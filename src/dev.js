// src/dev.js - Local development server
require('dotenv').config();
const app = require('./configs/server');
const { connectDB, closeDB } = require('./configs/database');

const PORT = process.env.PORT || 8080;

(async () => {
  try {
    await connectDB();
    app.listen(PORT, () => {
      console.log(`🚀 Local server running at http://localhost:${PORT}`);
      console.log(`📊 Health check: http://localhost:${PORT}/health`);
      console.log(`🗄️ DB status: http://localhost:${PORT}/db-status`);
    });
  } catch (error) {
    console.error('❌ Failed to start local server:', error);
    process.exit(1);
  }
})();

// Graceful shutdown for local development
process.on('SIGINT', async () => {
  console.log('\n🛑 Shutting down local server...');
  await closeDB();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\n🛑 Shutting down local server...');
  await closeDB();
  process.exit(0);
});
