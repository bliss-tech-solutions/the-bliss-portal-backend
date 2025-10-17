const express = require('express');
const router = express.Router();

// Import controller
const userDetailsController = require('./UserDetailsController');

// Routes
// GET /api/userdetails/getUserDetails - Get all user details
router.get('/getUserDetails', userDetailsController.getUserDetails);

// POST /api/userdetails/addUserDetails - Create new user details
router.post('/addUserDetails', userDetailsController.addUserDetails);

// POST /api/generateUserCredential - Generate user credentials
router.post('/generateUserCredential', userDetailsController.generateUserCredential);

// POST /api/signIn - User sign in
router.post('/signIn', userDetailsController.signIn);

// POST /api/updatePassword - Update user password
router.post('/updatePassword', userDetailsController.updatePassword);

module.exports = router;
