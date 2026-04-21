// src/index.js
require('dotenv').config();
const app = require('./configs/server');          // your Express app (no app.listen here)
const { connectDB } = require('./configs/database'); // serverless-cached connection

module.exports = async (req, res) => {
  // Ensure the cached Mongo connection is ready for this instance
  await connectDB();
  // Hand off to Express (acts like a request handler)
  return app(req, res);
};