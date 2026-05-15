const { WebSocketServer, WebSocket } = require('ws');
const http = require('http');

// Create HTTP server for health checks
const httpServer = http.createServer((req, res) => {
  if (req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', clients: wss.clients.size }));
  } else {
    res.writeHead(404);
    res.end();
  }
});

// Create WebSocket server on port 8080
const wss = new WebSocketServer({ server: httpServer });

// Store connected dashboard clients
const dashboardClients = new Set();

// Store latest telemetry data
const telemetryData = {
  tire_temps: {
    front_left: Array(16).fill(25),
    front_right: Array(16).fill(25),
    rear_left: Array(16).fill(25),
    rear_right: Array(16).fill(25),
  },
  lastUpdate: Date.now()
};

wss.on('connection', (ws, req) => {
  const clientType = req.url === '/dashboard' ? 'dashboard' : 'esp32';
  console.log(`[WebSocket] New ${clientType} client connected`);
  
  if (clientType === 'dashboard') {
    dashboardClients.add(ws);
    // Send current state to new dashboard client
    ws.send(JSON.stringify({
      type: 'initial_state',
      data: telemetryData
    }));
  }

  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message.toString());
      console.log('[WebSocket] Received:', data.type, data.wheel || '');
      
      // Handle tire telemetry from ESP32
      if (data.type === 'tire_telemetry') {
        const wheelMap = {
          'front_left': 'front_left',
          'front_right': 'front_right',
          'rear_left': 'rear_left',
          'rear_right': 'rear_right',
          'fl': 'front_left',
          'fr': 'front_right',
          'rl': 'rear_left',
          'rr': 'rear_right'
        };
        
        const wheelKey = wheelMap[data.wheel?.toLowerCase()];
        if (wheelKey && Array.isArray(data.data) && data.data.length === 16) {
          telemetryData.tire_temps[wheelKey] = data.data;
          telemetryData.lastUpdate = Date.now();
          
          // Broadcast to all dashboard clients
          const broadcastData = JSON.stringify({
            type: 'tire_update',
            wheel: wheelKey,
            temps: data.data,
            timestamp: telemetryData.lastUpdate
          });
          
          dashboardClients.forEach((client) => {
            if (client.readyState === WebSocket.OPEN) {
              client.send(broadcastData);
            }
          });
        }
      }
      
      // Handle other telemetry types
      if (data.type === 'vehicle_telemetry') {
        const broadcastData = JSON.stringify({
          type: 'vehicle_update',
          data: data.data,
          timestamp: Date.now()
        });
        
        dashboardClients.forEach((client) => {
          if (client.readyState === WebSocket.OPEN) {
            client.send(broadcastData);
          }
        });
      }
    } catch (error) {
      console.error('[WebSocket] Error parsing message:', error.message);
    }
  });

  ws.on('close', () => {
    console.log(`[WebSocket] ${clientType} client disconnected`);
    dashboardClients.delete(ws);
  });

  ws.on('error', (error) => {
    console.error('[WebSocket] Error:', error.message);
    dashboardClients.delete(ws);
  });
});

const PORT = process.env.WS_PORT || 8080;
httpServer.listen(PORT, () => {
  console.log(`[WebSocket] Server running on port ${PORT}`);
  console.log(`[WebSocket] Dashboard clients connect to: ws://localhost:${PORT}/dashboard`);
  console.log(`[WebSocket] ESP32 clients connect to: ws://localhost:${PORT}`);
});
