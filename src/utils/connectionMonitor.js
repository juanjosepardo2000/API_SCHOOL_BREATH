const mongoose = require('mongoose');

/**
 * Connection monitoring utility for MongoDB Atlas M0 cluster
 * Tracks connection metrics and provides real-time monitoring
 */

class ConnectionMonitor {
  constructor() {
    this.stats = {
      connectionsOpened: 0,
      connectionsClosed: 0,
      errors: 0,
      lastError: null,
      startTime: Date.now(),
      lastActivity: Date.now()
    };
    
    this.setupEventListeners();
    this.startPeriodicLogging();
  }

  setupEventListeners() {
    mongoose.connection.on('connected', () => {
      this.stats.connectionsOpened++;
      this.stats.lastActivity = Date.now();
      console.log('📊 Connection Monitor: Connected');
    });

    mongoose.connection.on('disconnected', () => {
      this.stats.connectionsClosed++;
      this.stats.lastActivity = Date.now();
      console.log('📊 Connection Monitor: Disconnected');
    });

    mongoose.connection.on('error', (err) => {
      this.stats.errors++;
      this.stats.lastError = {
        message: err.message,
        timestamp: new Date().toISOString(),
        code: err.code
      };
      console.error('📊 Connection Monitor: Error', err.message);
    });

    mongoose.connection.on('reconnected', () => {
      this.stats.lastActivity = Date.now();
      console.log('📊 Connection Monitor: Reconnected');
    });
  }

  startPeriodicLogging() {
    // Log stats every minute
    setInterval(() => {
      this.logStats();
    }, 60000);
  }

  getCurrentStats() {
    const uptime = Date.now() - this.stats.startTime;
    const currentState = mongoose.connection.readyState;
    const states = {
      0: 'disconnected',
      1: 'connected',
      2: 'connecting',
      3: 'disconnecting'
    };

    return {
      ...this.stats,
      currentState: states[currentState],
      isConnected: currentState === 1,
      uptime: Math.round(uptime / 1000), // seconds
      memoryUsage: this.getMemoryUsage(),
      connectionPool: this.getConnectionPoolInfo()
    };
  }

  getMemoryUsage() {
    const usage = process.memoryUsage();
    return {
      rss: `${Math.round(usage.rss / 1024 / 1024)} MB`,
      heapTotal: `${Math.round(usage.heapTotal / 1024 / 1024)} MB`,
      heapUsed: `${Math.round(usage.heapUsed / 1024 / 1024)} MB`,
      external: `${Math.round(usage.external / 1024 / 1024)} MB`
    };
  }

  getConnectionPoolInfo() {
    // Note: Mongoose doesn't expose detailed pool info
    // This is a simplified representation
    return {
      readyState: mongoose.connection.readyState,
      host: mongoose.connection.host,
      port: mongoose.connection.port,
      name: mongoose.connection.name,
      collections: Object.keys(mongoose.connection.collections || {}).length
    };
  }

  logStats() {
    const stats = this.getCurrentStats();
    
    console.log('\n📊 MongoDB Connection Monitor Stats:');
    console.log(`   State: ${stats.currentState}`);
    console.log(`   Uptime: ${stats.uptime}s`);
    console.log(`   Connections Opened: ${stats.connectionsOpened}`);
    console.log(`   Connections Closed: ${stats.connectionsClosed}`);
    console.log(`   Errors: ${stats.errors}`);
    console.log(`   Memory RSS: ${stats.memoryUsage.rss}`);
    console.log(`   Collections: ${stats.connectionPool.collections}`);
    
    if (stats.lastError) {
      console.log(`   Last Error: ${stats.lastError.message} (${stats.lastError.timestamp})`);
    }
    
    // Warning if too many connections opened
    if (stats.connectionsOpened > 50) {
      console.log('⚠️  WARNING: High number of connections opened. Check for connection leaks.');
    }
    
    // Warning if errors are high
    if (stats.errors > 10) {
      console.log('⚠️  WARNING: High error count. Check database connectivity.');
    }
    
    console.log('');
  }

  resetStats() {
    this.stats = {
      connectionsOpened: 0,
      connectionsClosed: 0,
      errors: 0,
      lastError: null,
      startTime: Date.now(),
      lastActivity: Date.now()
    };
    console.log('📊 Connection Monitor: Stats reset');
  }
}

// Create singleton instance
const connectionMonitor = new ConnectionMonitor();

module.exports = connectionMonitor;
