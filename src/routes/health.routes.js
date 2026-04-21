const express = require('express');
const router = express.Router();
const { getConnectionStatus } = require('../configs/database');
const mongoose = require('mongoose');

/**
 * @route   GET /health
 * @desc    Comprehensive health check endpoint
 * @access  Public
 */
router.get('/', async (req, res) => {
  try {
    const dbStatus = await getConnectionStatus();
    const memoryUsage = process.memoryUsage();
    
    // Test database connectivity
    let dbHealthy = false;
    try {
      await mongoose.connection.db.admin().ping();
      dbHealthy = true;
    } catch (err) {
      console.error('Database ping failed:', err.message);
    }

    const healthStatus = {
      status: dbHealthy ? 'healthy' : 'unhealthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: process.env.NODE_ENV || 'development',
      version: process.version,
      memory: {
        rss: `${Math.round(memoryUsage.rss / 1024 / 1024)} MB`,
        heapTotal: `${Math.round(memoryUsage.heapTotal / 1024 / 1024)} MB`,
        heapUsed: `${Math.round(memoryUsage.heapUsed / 1024 / 1024)} MB`,
        external: `${Math.round(memoryUsage.external / 1024 / 1024)} MB`
      },
      database: {
        ...dbStatus,
        healthy: dbHealthy
      }
    };

    const statusCode = dbHealthy ? 200 : 503;
    res.status(statusCode).json(healthStatus);
  } catch (error) {
    console.error('Health check error:', error);
    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: error.message
    });
  }
});

/**
 * @route   GET /db-status
 * @desc    Database connection status information
 * @access  Public
 */
router.get('/db-status', async (req, res) => {
  try {
    const dbStatus = await getConnectionStatus();
    
    // Get additional connection metrics
    const connectionStats = {
      readyState: mongoose.connection.readyState,
      host: mongoose.connection.host,
      port: mongoose.connection.port,
      name: mongoose.connection.name,
      collections: Object.keys(mongoose.connection.collections).length,
      models: Object.keys(mongoose.models).length
    };

    res.status(200).json({
      timestamp: new Date().toISOString(),
      connection: dbStatus,
      metrics: connectionStats
    });
  } catch (error) {
    console.error('Database status check error:', error);
    res.status(500).json({
      timestamp: new Date().toISOString(),
      error: error.message
    });
  }
});

module.exports = router;
