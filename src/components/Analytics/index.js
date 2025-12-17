const express = require('express');
const router = express.Router();

// Import controllers
const analyticsController = require('./AnalyticsController');
const userWiseRoutes = require('./UserWise');

// Routes

// GET /api/analytics/total-employees - Get total employees count
router.get('/total-employees', analyticsController.getTotalEmployees);

// GET /api/analytics/active-members - Get active members (logged in within last 3-4 days)
// Query params: ?daysThreshold=4 (default: 4, can be 3)
router.get('/active-members', analyticsController.getActiveMembers);

// GET /api/analytics/departments - Get departments breakdown
router.get('/departments', analyticsController.getDepartments);

// GET /api/analytics/growth-rate - Calculate growth rate
// Query params: ?period=month (or 'year'), ?compareMonths=1 (default: 1)
router.get('/growth-rate', analyticsController.getGrowthRate);

// GET /api/analytics/overview - Get all analytics overview (combined)
router.get('/overview', analyticsController.getOverview);

// User-wise analytics routes
router.use('/userwise', userWiseRoutes);

module.exports = router;

