const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const mqtt = require('mqtt');
const fs = require('fs-extra');
const path = require('path');
const cors = require('cors');

const app = express();
app.use(cors());
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// Configuration
const MQTT_BROKER = "wss://q2d87a43.ala.asia-southeast1.emqxsl.com:8084/mqtt";
const MQTT_USER = "dongtaan_vcu";
const MQTT_PASS = process.env.MQTT_PASS || ""; // set in the environment, never in source
const MQTT_TOPIC_TIRE = "balone2/telemetry/tire_fl";
const MQTT_TOPIC_SUSP = "balone2/telemetry/suspension";
const MQTT_TOPIC_VCU = "balone2/telemetry/vcu";
const LOG_DIR = path.join(__dirname, 'logs');
const HEARTBEAT_TIMEOUT = 5000;

// Google Sheets Integration Config
const GOOGLE_SHEETS_URL = process.env.GOOGLE_SHEETS_URL || "https://script.google.com/macros/s/AKfycbysmJ1sYQjHO9nmdxr3DOWdSeLUxNQrc2VeBicpkzS-kwQQHGg9T4DR-FpH9xhrCFY/exec";
const BATCH_INTERVAL_MS = 5000; // Upload to Google Sheets every 5 seconds
let vcuBuffer = [];

if (GOOGLE_SHEETS_URL) {
  console.log(`[Google Sheets] Enabled. Targeting URL: ${GOOGLE_SHEETS_URL}`);
} else {
  console.warn(`[Google Sheets] Disabled. (GOOGLE_SHEETS_URL environment variable is not set)`);
}

// Function to upload buffered telemetry data to Google Sheets in batches
const sendBatchToGoogleSheets = async () => {
  if (vcuBuffer.length === 0) return;
  if (!GOOGLE_SHEETS_URL) {
    // Clear buffer to prevent memory leaks if not configured
    vcuBuffer = [];
    return;
  }

  const batchToSend = [...vcuBuffer];
  vcuBuffer = [];

  try {
    const response = await fetch(GOOGLE_SHEETS_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ rows: batchToSend }),
    });

    const result = await response.json();
    if (result.status === "success") {
      console.log(`[Google Sheets] Successfully uploaded ${batchToSend.length} rows.`);
    } else {
      console.error(`[Google Sheets] Apps Script error:`, result.message);
      // Prepend failed batch back to buffer for retry
      vcuBuffer = [...batchToSend, ...vcuBuffer];
    }
  } catch (error) {
    console.error(`[Google Sheets] Network/Upload error:`, error.message);
    // Prepend failed batch back to buffer for retry
    vcuBuffer = [...batchToSend, ...vcuBuffer];
    // Keep buffer under 5000 rows to prevent high memory usage if offline for a long time
    if (vcuBuffer.length > 5000) {
      vcuBuffer = vcuBuffer.slice(-5000);
    }
  }
};

// Periodically trigger Google Sheets upload
setInterval(sendBatchToGoogleSheets, BATCH_INTERVAL_MS);

// Ensure logs directory exists
fs.ensureDirSync(LOG_DIR);

let esp32Timeout = null;
let isEsp32Online = false;

// Socket.io Connection
io.on('connection', (socket) => {
  console.log(`[Socket.io] Client connected: ${socket.id}`);
  socket.emit('status', isEsp32Online ? 'ONLINE' : 'OFFLINE');

  socket.on('disconnect', () => {
    console.log(`[Socket.io] Client disconnected: ${socket.id}`);
  });
});

// Setup MQTT
const mqttClient = mqtt.connect(MQTT_BROKER, {
  username: MQTT_USER,
  password: MQTT_PASS,
});

mqttClient.on('connect', () => {
  console.log(`[MQTT] Connected to HiveMQ Cloud`);
  
  mqttClient.subscribe(MQTT_TOPIC_TIRE, (err) => {
    if (!err) {
      console.log(`[MQTT] Subscribed to ${MQTT_TOPIC_TIRE}`);
    } else {
      console.error(`[MQTT] Subscription error:`, err);
    }
  });

  mqttClient.subscribe(MQTT_TOPIC_SUSP, (err) => {
    if (!err) {
      console.log(`[MQTT] Subscribed to ${MQTT_TOPIC_SUSP}`);
    } else {
      console.error(`[MQTT] Subscription error:`, err);
    }
  });

  mqttClient.subscribe(MQTT_TOPIC_VCU, (err) => {
    if (!err) {
      console.log(`[MQTT] Subscribed to ${MQTT_TOPIC_VCU}`);
    } else {
      console.error(`[MQTT] Subscription error:`, err);
    }
  });
});

// Heartbeat function
const resetHeartbeat = () => {
  if (!isEsp32Online) {
    isEsp32Online = true;
    io.emit('status', 'ONLINE');
    console.log('[System] ESP32 is ONLINE');
  }

  if (esp32Timeout) clearTimeout(esp32Timeout);

  esp32Timeout = setTimeout(() => {
    isEsp32Online = false;
    io.emit('status', 'OFFLINE');
    console.log('[System] ESP32 is OFFLINE (No data for 5 seconds)');
  }, HEARTBEAT_TIMEOUT);
};

// Log data to CSV
const logToCsv = (rawString) => {
  const date = new Date();
  const dateString = date.toISOString().split('T')[0]; // YYYY-MM-DD
  const logFile = path.join(LOG_DIR, `telemetry_${dateString}.csv`);
  
  const timestamp = date.toISOString();
  const logLine = `${timestamp},${rawString}\n`;

  fs.appendFile(logFile, logLine, (err) => {
    if (err) console.error('[Logger] Failed to write to log:', err);
  });
};

mqttClient.on('message', (topic, message) => {
  const rawString = message.toString();
  resetHeartbeat();
  logToCsv(`${topic},${rawString}`);

  if (topic === MQTT_TOPIC_TIRE) {
    try {
      const parsedTemps = rawString.split(',').map(Number).filter(n => !isNaN(n));
      
      // Ensure we have valid data before broadcasting
      if (parsedTemps.length > 0) {
        io.emit('telemetry', {
          wheel: 'front_left',
          temps: parsedTemps
        });
      }
    } catch (e) {
      console.error('[MQTT] Failed to parse tire message:', e);
    }
  } else if (topic === MQTT_TOPIC_SUSP) {
    try {
      const nums = rawString.split(',').map(Number).filter(n => !isNaN(n));
      if (nums.length >= 4) {
        io.emit('suspension', {
          damperTravel: {
            fl: nums[0],
            fr: nums[1],
            rl: nums[2],
            rr: nums[3]
          },
          gForces: nums.length >= 6 ? { lat: nums[4], lon: nums[5] } : null,
          angles: nums.length >= 9 ? { roll: nums[6], pitch: nums[7], yaw: nums[8] } : null
        });
      }
    } catch (e) {
      console.error('[MQTT] Failed to parse suspension message:', e);
    }
  } else if (topic === MQTT_TOPIC_VCU) {
    try {
      const parsed = JSON.parse(rawString);
      io.emit('vcu', parsed);
      // Buffer VCU data for Google Sheets batch upload
      vcuBuffer.push(parsed);
    } catch (e) {
      console.error('[MQTT] Failed to parse VCU message:', e);
    }
  }
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`[Backend] Server running on port ${PORT}`);
});
