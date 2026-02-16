const express = require('express');
const router = express.Router();
const sendVerificationEmailController = require('./sendVerificationEmailController');

// Route to send verification email
router.post('/realEstate/send-verification-email', sendVerificationEmailController.sendVerificationEmail);
// Alias for clients calling /send-verification-email (e.g. under /api)
router.post('/send-verification-email', sendVerificationEmailController.sendVerificationEmail);

// Route to verify the code
router.post('/realEstate/verify-verification-code', sendVerificationEmailController.verifyVerificationCode);

// Temporary test endpoint: GET /api/email-test
router.get('/email-test', sendVerificationEmailController.emailTest);

module.exports = router;