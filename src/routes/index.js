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
const userVerificationDocumentsRoutes = require('../components/UserVerificationDocuments');
const createAccountSignInApiRoutes = require('../components/CreateAccountSignInApi');
const clientManagementRoutes = require('../components/ClientManagement');
const teamManagementRoutes = require('../components/TeamManagement');
const globalChatRoutes = require('../components/GlobalChat');
const analyticsRoutes = require('../components/Analytics');
// const salaryRoutes = require('../components/salaryCalculations');

// Register all routes
// router.use('/testdummyapi', testDummyApiRoutes);
router.use('/', userDetailsRoutes); // Direct access without /userdetails/
router.use('/', addTaskAssignRoutes);
router.use('/', chatRoutes);
router.use('/', checkInCheckOutRoutes);
router.use('/', festiveCalendarRoutes);
router.use('/', leavesRoutes);
router.use('/', userVerificationDocumentsRoutes);
router.use('/', createAccountSignInApiRoutes);
router.use('/', clientManagementRoutes);
router.use('/', teamManagementRoutes);
router.use('/', globalChatRoutes);
router.use('/analytics', analyticsRoutes);
// router.use('/', salaryRoutes);

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
            getAllRecords: '/api/checkin/all',
            createUserVerificationDocument: '/api/userverificationdocuments/create',
            getAllUserVerificationDocuments: '/api/userverificationdocuments/getAll',
            getUserVerificationDocumentByUserId: '/api/userverificationdocuments/getByUserId/:userId',
            createAccountSignInCheck: '/api/createaccountsignin/check',
            createAccountSignIn: '/api/createaccountsignin/signin',
            getAllClients: '/api/clientmanagement/getAllClientsData',
            getClientById: '/api/clientmanagement/getById/:clientId',
            getClientsByUserId: '/api/clientmanagement/getClientsByUserId/:userId',
            createClient: '/api/clientmanagement/create',
            updateClient: '/api/clientmanagement/update/:clientId',
            deleteClient: '/api/clientmanagement/delete/:clientId',
            getAllTeams: '/api/teammanagement/getAllTeams',
            getTeamById: '/api/teammanagement/getTeamById/:teamId',
            getTeamsByUserId: '/api/teammanagement/getTeamsByUserId/:userId',
            createTeam: '/api/teammanagement/createTeam',
            updateTeam: '/api/teammanagement/updateTeam/:teamId',
            deleteTeam: '/api/teammanagement/deleteTeam/:teamId',
            createGlobalChatMessage: '/api/globalchat/messages',
            getGlobalChatMessages: '/api/globalchat/messages',
            getRecentGlobalChatMessages: '/api/globalchat/messages/recent',
            analytics: {
                totalEmployees: '/api/analytics/total-employees',
                activeMembers: '/api/analytics/active-members?daysThreshold=4',
                departments: '/api/analytics/departments',
                growthRate: '/api/analytics/growth-rate?period=month&compareMonths=1',
                overview: '/api/analytics/overview',
                userWise: {
                    getUserWiseData: '/api/analytics/userwise/:userId',
                    getUserTasks: '/api/analytics/userwise/:userId/tasks?status=&limit=50&skip=0',
                    getUserStats: '/api/analytics/userwise/:userId/stats'
                }
            }
        }
    });
});

module.exports = router;
