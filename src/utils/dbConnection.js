const mongoose = require('mongoose');
const { mongoUri } = require('../configs/vars');

/**
 * Standardized database connection utility
 * Provides consistent connection handling across utility scripts
 */

let isConnected = false;

/**
 * Connect to database with optimized settings
 * @returns {Promise<mongoose.Connection>}
 */
async function connectToDatabase() {
  if (isConnected) {
    return mongoose.connection;
  }

  try {
    await mongoose.connect(mongoUri, {
      maxPoolSize: 5,
      minPoolSize: 0,
      serverSelectionTimeoutMS: 10000,
      socketTimeoutMS: 30000,
      connectTimeoutMS: 30000,
      retryWrites: true,
      w: 'majority',
      appName: 'SchoolOfBreath-Utility',
      heartbeatFrequencyMS: 10000,
      maxIdleTimeMS: 60000,
      waitQueueTimeoutMS: 10000,
    });

    isConnected = true;
    console.log('✅ Database utility connected successfully');
    return mongoose.connection;
  } catch (error) {
    console.error('❌ Database utility connection failed:', error);
    throw error;
  }
}

/**
 * Close database connection
 * @returns {Promise<void>}
 */
async function closeDatabaseConnection() {
  if (!isConnected) return;

  try {
    await mongoose.connection.close();
    isConnected = false;
    console.log('🛑 Database utility disconnected gracefully');
  } catch (error) {
    console.error('❌ Error closing database utility connection:', error);
    throw error;
  }
}

/**
 * Execute function with automatic database connection cleanup
 * @param {Function} fn - Function to execute with database connection
 * @returns {Promise<any>} - Result of the executed function
 */
async function withDatabaseConnection(fn) {
  let connection;
  
  try {
    connection = await connectToDatabase();
    const result = await fn(connection);
    return result;
  } catch (error) {
    console.error('❌ Error in database operation:', error);
    throw error;
  } finally {
    if (connection) {
      await closeDatabaseConnection();
    }
  }
}

/**
 * Get database connection status
 * @returns {Object} - Connection status information
 */
function getConnectionInfo() {
  const state = mongoose.connection.readyState;
  const states = {
    0: 'disconnected',
    1: 'connected',
    2: 'connecting', 
    3: 'disconnecting'
  };

  return {
    state: states[state],
    isConnected: state === 1,
    host: mongoose.connection.host,
    port: mongoose.connection.port,
    name: mongoose.connection.name,
    readyState: state
  };
}

/**
 * Wait for database connection to be established
 * @param {number} timeout - Timeout in milliseconds
 * @returns {Promise<boolean>} - True if connected, false if timeout
 */
async function waitForConnection(timeout = 10000) {
  const startTime = Date.now();
  
  while (mongoose.connection.readyState !== 1) {
    if (Date.now() - startTime > timeout) {
      return false;
    }
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  
  return true;
}

module.exports = {
  connectToDatabase,
  closeDatabaseConnection,
  withDatabaseConnection,
  getConnectionInfo,
  waitForConnection
};
