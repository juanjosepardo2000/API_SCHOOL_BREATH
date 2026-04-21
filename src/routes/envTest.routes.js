const express = require('express');
const router = express.Router();

const {
  getAllSystemVars,
  getSystemeSystemVars,
  getLLMSystemVars,
  getMessagingSystemVars,
  getPaymentSystemVars
} = require('../controllers/systemVars.controller');

/**
 * @route   GET /api/system-vars
 * @desc    Get all system variables configuration
 * @access  Public
 */
router.get('/', getAllSystemVars);

/**
 * @route   GET /api/system-vars/systeme
 * @desc    Get Systeme.io system variables
 * @access  Public
 */
router.get('/systeme', getSystemeSystemVars);

/**
 * @route   GET /api/system-vars/llm
 * @desc    Get LLM system variables
 * @access  Public
 */
router.get('/llm', getLLMSystemVars);

/**
 * @route   GET /api/system-vars/messaging
 * @desc    Get messaging system variables
 * @access  Public
 */
router.get('/messaging', getMessagingSystemVars);

/**
 * @route   GET /api/system-vars/payment
 * @desc    Get payment system variables
 * @access  Public
 */
router.get('/payment', getPaymentSystemVars);

module.exports = router;
