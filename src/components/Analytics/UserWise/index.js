const express = require('express');
const router = express.Router();

// Import controller
const userWiseController = require('./UserWiseController');

// Routes - Specific routes must come before the general :userId route

// GET /api/analytics/userwise/:userId/tasks - Get user's task list only
// Query params: ?status=pending&limit=50&skip=0
router.get('/:userId/tasks', userWiseController.getUserTasks);

// GET /api/analytics/userwise/:userId/stats - Get user statistics only (tasks count, averages)
router.get('/:userId/stats', userWiseController.getUserStats);

// GET /api/analytics/userwise/:userId - Get complete user-wise analytics data
router.get('/:userId', userWiseController.getUserWiseData);

module.exports = router;

