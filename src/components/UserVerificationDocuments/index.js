const express = require('express');
const router = express.Router();

// Import controller
const userVerificationDocumentsController = require('./UserVerificationDocumentsController');

// Routes
// GET /api/userverificationdocuments/getAll - Get all user verification documents
router.get('/userverificationdocuments/getAll', userVerificationDocumentsController.getAll);

// GET /api/userverificationdocuments/getByUserId/:userId - Get verification documents by userId
router.get('/userverificationdocuments/getByUserId/:userId', userVerificationDocumentsController.getByUserId);

// POST /api/userverificationdocuments/create - Create new user verification document
router.post('/userverificationdocuments/create', userVerificationDocumentsController.create);

module.exports = router;