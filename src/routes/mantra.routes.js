const express = require('express');
const router = express.Router();
const mantraController = require('../controllers/mantra.controller');
const categoryController = require('../controllers/mantraCategory.controller');

/**
 * Category Routes (Public)
 */

// Get all deities with mantra counts
router.get('/categories/deities', categoryController.getDeities);

// Get all benefits with mantra counts
router.get('/categories/benefits', categoryController.getBenefits);

// Get all difficulties with mantra counts
router.get('/categories/difficulties', categoryController.getDifficulties);

// Get all categories grouped
router.get('/categories/all', categoryController.getAllCategories);

// Get category statistics
router.get('/categories/stats', categoryController.getCategoryStats);

/**
 * Public Routes (with email-based access control)
 */

// Get all mantras with filtering and pagination
router.get('/', mantraController.getMantras);

// Get mantras grouped by deity
router.get('/explore/by-deity', mantraController.getMantrasByDeity);

// Get mantras grouped by benefit
router.get('/explore/by-benefit', mantraController.getMantrasByBenefit);

// Get popular mantras
router.get('/popular/list', mantraController.getPopularMantras);

// Get single mantra by ID (must be after other routes to avoid conflicts)
router.get('/:id', mantraController.getMantraById);

/**
 * Admin Routes
 * Note: Add authentication middleware here when ready
 * Example: router.post('/', authMiddleware, mantraController.createMantra);
 */

// Create new mantra
router.post('/', mantraController.createMantra);

// Update mantra
router.put('/:id', mantraController.updateMantra);

// Delete mantra
router.delete('/:id', mantraController.deleteMantra);

// Update mantra positions (bulk update)
router.patch('/position/update', mantraController.updatePosition);

// Toggle mantra active status
router.patch('/:id/toggle-active', mantraController.toggleActive);

/**
 * Admin Routes - Categories
 */

// Create new category
router.post('/categories', categoryController.createCategory);

// Update category
router.put('/categories/:id', categoryController.updateCategory);

// Delete category
router.delete('/categories/:id', categoryController.deleteCategory);

module.exports = router;
