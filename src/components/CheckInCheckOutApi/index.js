const express = require('express');
const router = express.Router();

// Import controller
const checkInCheckOutController = require('./CheckInCheckOutController');

// Routes

// POST /api/checkin - Check in for the day
router.post('/checkin', checkInCheckOutController.checkIn);

// POST /api/checkout - Check out for the day
router.post('/checkout', checkInCheckOutController.checkOut);

// GET /api/checkin/status - check-in status for today
router.get('/checkin/status', checkInCheckOutController.getCheckInStatus);

// GET /api/checkout/status - check-out status for today
router.get('/checkout/status', checkInCheckOutController.getCheckOutStatus);

// GET /api/checkin/analysis - Get detailed attendance analysis
router.get('/checkin/analysis', checkInCheckOutController.getAnalysis);

// GET /api/checkin/:userId/today - Get today's record for a user
router.get('/checkin/:userId/today', checkInCheckOutController.getTodayRecord);

// GET /api/checkin/:userId/history - Get user's check-in/out history
router.get('/checkin/:userId/history', checkInCheckOutController.getUserHistory);

// GET /api/checkin/all - Get all records (admin view)
router.get('/checkin/all', checkInCheckOutController.getAllRecords);

module.exports = router;
