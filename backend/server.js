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
const MQTT_PASS = "racing2026";
const MQTT_TOPIC = "balone2/telemetry/tire_fl";
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
  mqttClient.subscribe(MQTT_TOPIC, (err) => {
    if (!err) {
      console.log(`[MQTT] Subscribed to ${MQTT_TOPIC}`);
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
  if (topic === MQTT_TOPIC) {
    resetHeartbeat();
    const rawString = message.toString();
    
    // Log to file
    logToCsv(rawString);

    // Parse String CSV to JSON Array
    // e.g. "25.1,26.2,25.5..." -> [25.1, 26.2, 25.5, ...]
    try {
      const parsedTemps = rawString.split(',').map(Number);
      
      // Ensure we have valid data before broadcasting
      if (parsedTemps.length > 0 && !isNaN(parsedTemps[0])) {
        io.emit('telemetry', {
          wheel: 'front_left',
          temps: parsedTemps
        });
      }
    } catch (e) {
      console.error('[MQTT] Failed to parse message:', e);
    }
  }
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`[Backend] Server running on port ${PORT}`);
});
