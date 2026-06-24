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
const MQTT_BROKER = "wss://2898b29c070f4985b025bbc1d2e1d216.s1.eu.hivemq.cloud:8884/mqtt";
const MQTT_USER = "dongtaan_vcu";
const MQTT_PASS = "Frank2007";
const MQTT_TOPIC_TIRE = "balone2/telemetry/tire_fl";
const MQTT_TOPIC_SUSP = "balone2/telemetry/suspension";
const MQTT_TOPIC_VCU = "balone2/telemetry/vcu";
const LOG_DIR = path.join(__dirname, 'logs');
const HEARTBEAT_TIMEOUT = 5000;

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
    } catch (e) {
      console.error('[MQTT] Failed to parse VCU message:', e);
    }
  }
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`[Backend] Server running on port ${PORT}`);
});
