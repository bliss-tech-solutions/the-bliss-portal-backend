const express = require('express');
const router = express.Router();

// Import all API routes
const testDummyApiRoutes = require('../components/TestDummyApi');
const userDetailsRoutes = require('../components/UserDetails'); 
const addTaskAssignRoutes = require('../components/AddTaskAssign');
const chatRoutes = require('../components/Chat');

// Register all routes
router.use('/testdummyapi', testDummyApiRoutes);
router.use('/', userDetailsRoutes); // Direct access without /userdetails/
router.use('/', addTaskAssignRoutes);
router.use('/', chatRoutes);

// API Info endpoint
router.get('/', (req, res) => {
    res.json({
        message: 'Welcome to The Bliss Portal API',
        version: '1.0.0',
        endpoints: {
            health: '/health',
            testdummyapi: '/api/testdummyapi'
        }
    });
});

module.exports = router;
