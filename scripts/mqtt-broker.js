// @ts-check
'use strict';

/**
 * Aedes MQTT Broker for E2E testing
 * Runs a local MQTT broker with persistence
 */

const aedes = require('aedes');
const net = require('net');
const http = require('http');
const ws = require('ws');
const path = require('path');
const fs = require('fs');

const PORT = process.env.MQTT_PORT || 1883;
const WS_PORT = process.env.MQTT_WS_PORT || 8084;
const LOG_DIR = path.join(__dirname, '../.e2e/mqtt');

// Ensure log directory exists
if (!fs.existsSync(LOG_DIR)) {
  fs.mkdirSync(LOG_DIR, { recursive: true });
}

const logFile = path.join(LOG_DIR, `broker-${new Date().toISOString().replace(/:/g, '-')}.log`);
const logStream = fs.createWriteStream(logFile, { flags: 'a' });

function log(/** @type {string} */ message) {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] ${message}\n`;
  logStream.write(logMessage);
  console.log(logMessage.trim());
}

// Create MQTT broker instance
const broker = new aedes();

// Event handlers
broker.on('client', (client) => {
  log(`Client Connected: ${client.id}`);
});

broker.on('clientDisconnect', (client) => {
  log(`Client Disconnected: ${client.id}`);
});

broker.on('publish', (packet, client) => {
  if (client) {
    log(`Published: ${packet.topic} from ${client.id}`);
  }
});

broker.on('subscribe', (subscriptions, client) => {
  log(`Subscribed: ${JSON.stringify(subscriptions.map(s => s.topic))} from ${client.id}`);
});

// Create TCP server
const server = net.createServer(broker.handle);

server.listen(PORT, () => {
  log(`Aedes MQTT Broker started on port ${PORT}`);
  log(`Logs: ${logFile}`);
});

// Create WebSocket server
const httpServer = http.createServer();
const wsServer = new ws.Server({ server: httpServer });

wsServer.on('connection', (socket) => {
  const stream = ws.createWebSocketStream(socket);
  broker.handle(stream);
});

httpServer.listen(WS_PORT, () => {
  log(`Aedes MQTT WebSocket started on port ${WS_PORT}`);
});

// Graceful shutdown
process.on('SIGINT', () => {
  log('SIGINT received, shutting down...');
  broker.close(() => {
    server.close(() => {
      httpServer.close(() => {
        log('Broker closed');
        logStream.end();
        process.exit(0);
      });
    });
  });
});

process.on('SIGTERM', () => {
  log('SIGTERM received, shutting down...');
  broker.close(() => {
    server.close(() => {
      httpServer.close(() => {
        log('Broker closed');
        logStream.end();
        process.exit(0);
      });
    });
  });
});
