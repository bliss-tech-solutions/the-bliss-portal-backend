const express = require('express');
const router = express.Router();
const dashboardAnalysisController = require('./DashboardAnalysisController');

// GET /api/dashboard/analysis
// Supports ?userId=... for user-wise data
router.get('/analysis', dashboardAnalysisController.getDashboardData);

// DELETE /api/dashboard/cache - Clear dashboard cache (optional)
router.delete('/cache', dashboardAnalysisController.clearCache);

module.exports = router;