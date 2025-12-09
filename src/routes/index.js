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
const productsRoutes = require('../components/Products');
const clientManagementRoutes = require('../components/ClientManagement');
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
router.use('/', productsRoutes);
router.use('/', clientManagementRoutes);
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
            getAllProducts: '/api/products/getAll',
            getProductById: '/api/products/getById/:productId',
            getProductsByCategory: '/api/products/getByCategory/:categoryName',
            createProduct: '/api/products/create',
            updateProduct: '/api/products/update/:productId',
            deleteProduct: '/api/products/delete/:productId',
            getAllClients: '/api/clientmanagement/getAllClientsData',
            getClientById: '/api/clientmanagement/getById/:clientId',
            createClient: '/api/clientmanagement/create',
            updateClient: '/api/clientmanagement/update/:clientId',
            deleteClient: '/api/clientmanagement/delete/:clientId'
        }
    });
});

module.exports = router;
