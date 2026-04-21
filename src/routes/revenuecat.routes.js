const express = require('express');
const controller = require('../controllers/revenuecat.controller');

const router = express.Router();

router.post('/', express.raw({ type: 'application/json', limit: '1mb' }), controller.receiveWebhook);

module.exports = router;
