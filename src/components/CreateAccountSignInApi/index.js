const express = require('express');
const router = express.Router();

// Import controller
const createAccountSignInApiController = require('./CreateAccountSignInApiController');

// Routes
// GET /api/createaccountsignin/check - Check if API is available
router.get('/createaccountsignin/check', createAccountSignInApiController.check);

// POST /api/createaccountsignin/signin - Admin sign-in validation
router.post('/createaccountsignin/signin', createAccountSignInApiController.signIn);

module.exports = router;

