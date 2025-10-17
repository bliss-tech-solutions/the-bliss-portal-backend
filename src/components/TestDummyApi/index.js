const express = require('express');
const router = express.Router();

// Import controller
const testDummyController = require('./TestControllers');

// Routes
// GET /api/testdummyapi - Get all data
router.get('/', testDummyController.getAll);

// POST /api/testdummyapi - Create new data
router.post('/', testDummyController.create);

module.exports = router;