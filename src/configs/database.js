// ./configs/database.js
const mongoose = require('mongoose');
const { mongoUri } = require('./vars');

// Initialize connection monitoring
require('../utils/connectionMonitor');

mongoose.set('strictQuery', true);
mongoose.set('bufferCommands', false);
if (process.env.NODE_ENV === 'development') mongoose.set('debug', true);

// Cache across warm serverless invocations
let cached = global.__mongoose;
if (!cached) {
  cached = global.__mongoose = { conn: null, promise: null, listenersAttached: false };
}

function attachListenersOnce() {
  if (cached.listenersAttached) return;
  const conn = mongoose.connection;

  conn.on('connected', () => {
    console.log('✅ MongoDB connected successfully');
  });
  conn.on('error', (err) => {
    console.error('❌ MongoDB connection error:', err);
  });
  conn.on('disconnected', () => {
    console.log('⚠️ MongoDB disconnected');
  });
  conn.on('reconnected', () => {
    console.log('🔄 MongoDB reconnected');
  });

  cached.listenersAttached = true;
}

async function connectDB() {
  if (cached.conn) return cached.conn;

  if (!cached.promise) {
    attachListenersOnce();
    cached.promise = mongoose.connect(mongoUri, {
      // Serverless + M0/M2 friendly
      maxPoolSize: 5,
      minPoolSize: 0,
      serverSelectionTimeoutMS: 10_000,
      socketTimeoutMS: 30_000,
      connectTimeoutMS: 30_000,
      waitQueueTimeoutMS: 10_000,
      maxIdleTimeMS: 60_000,
      retryWrites: true,
      w: 'majority',
      appName: 'SchoolOfBreath',
      heartbeatFrequencyMS: 10_000,
    }).then((m) => m);
  }

  cached.conn = await cached.promise;
  return cached.conn;
}

// In serverless, you normally DON'T call close()—instances are recycled.
// Keep this only for local/dev scripts.
async function closeDB() {
  if (!cached.conn) return;
  await mongoose.connection.close();
  cached.conn = null;
  cached.promise = null;
  console.log('🛑 MongoDB disconnected gracefully');
}

async function getConnectionStatus() {
  const state = mongoose.connection.readyState;
  const states = { 0: 'disconnected', 1: 'connected', 2: 'connecting', 3: 'disconnecting' };
  return {
    state: states[state],
    isConnected: state === 1,
    host: mongoose.connection.host,
    port: mongoose.connection.port,
    name: mongoose.connection.name,
    collections: Object.keys(mongoose.connection.collections || {}).length,
  };
}

module.exports = { connectDB, closeDB, getConnectionStatus };