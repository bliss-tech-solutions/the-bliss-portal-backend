const express = require('express');
const router = express.Router();

// Import all API routes
const testDummyApiRoutes = require('../components/TestDummyApi');
const userDetailsRoutes = require('../components/UserDetails');
const addTaskAssignRoutes = require('../components/AddTaskAssign');
const chatRoutes = require('../components/Chat');
const checkInCheckOutRoutes = require('../components/CheckInCheckOutApi');
const festiveCalendarRoutes = require('../components/FestiveCalendarApi');
const leavesRoutes = require('../components/LeavesApi');

// Register all routes
// router.use('/testdummyapi', testDummyApiRoutes);
router.use('/', userDetailsRoutes); // Direct access without /userdetails/
router.use('/', addTaskAssignRoutes);
router.use('/', chatRoutes);
router.use('/', checkInCheckOutRoutes);
router.use('/', festiveCalendarRoutes);
router.use('/', leavesRoutes);

// API Info endpoint
router.get('/', (req, res) => {
    res.json({
        message: 'Welcome to The Bliss Portal API',
        version: '1.0.0',
        endpoints: {
            health: '/health',
            testdummyapi: '/api/testdummyapi',
            addUserDetails: '/api/addUserDetails',
            getUserDetails: '/api/getUserDetails',
            generateUserCredential: '/api/generateUserCredential',
            signIn: '/api/signIn',
            updatePassword: '/api/updatePassword',
            addTaskAssign: '/api/addtaskassign',
            getTaskAssign: '/api/getTaskAssign',
            getTaskAssignByUserId: '/api/getTaskAssign/:userId',
            chatMessages: '/api/chat/messages',
            checkIn: '/api/checkin',
            checkOut: '/api/checkout',
            getTodayRecord: '/api/checkin/:userId/today',
            getUserHistory: '/api/checkin/:userId/history',
            getAllRecords: '/api/checkin/all'
        }
    });
});

module.exports = router;
