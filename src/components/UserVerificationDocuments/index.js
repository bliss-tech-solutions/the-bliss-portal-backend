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

// PUT /api/userverificationdocuments/updateByUserId/:userId - Update verification document by userId
router.put('/userverificationdocuments/updateByUserId/:userId', userVerificationDocumentsController.updateByUserId);

// PATCH /api/userverificationdocuments/incrementSalary/:userId - Increment salary by percentage
router.patch('/userverificationdocuments/incrementSalary/:userId', userVerificationDocumentsController.incrementSalary);

// GET /api/userverificationdocuments/salaryDetails/:userId - Get current salary and pending/completed increments
router.get('/userverificationdocuments/salaryDetails/:userId', userVerificationDocumentsController.getSalaryDetails);

// POST /api/userverificationdocuments/applyPendingIncrements - Apply all pending increments that are due
router.post('/userverificationdocuments/applyPendingIncrements', userVerificationDocumentsController.applyPendingIncrements);

// PATCH /api/userverificationdocuments/approveIncrement/:userId/:incrementId - Approve or reject an increment
router.patch('/userverificationdocuments/approveIncrement/:userId/:incrementId', userVerificationDocumentsController.approveIncrement);

module.exports = router;
