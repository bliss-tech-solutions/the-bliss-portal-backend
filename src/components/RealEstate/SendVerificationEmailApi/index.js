const express = require('express');
const router = express.Router();
const sendVerificationEmailController = require('./sendVerificationEmailController');

// Route to send verification email
router.post('/realEstate/send-verification-email', sendVerificationEmailController.sendVerificationEmail);

// Route to verify the code
router.post('/realEstate/verify-verification-code', sendVerificationEmailController.verifyVerificationCode);

module.exports = router;
