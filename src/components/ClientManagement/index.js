const express = require('express');
const router = express.Router();

// Import controller
const clientManagementController = require('./ClientManagementController');

// Routes
// GET /api/clientmanagement/getAllClientsData - Get all clients
router.get('/clientmanagement/getAllClientsData', clientManagementController.getAllClientsData);

// GET /api/clientmanagement/getById/:clientId - Get client by ID
router.get('/clientmanagement/getById/:clientId', clientManagementController.getById);

// GET /api/clientmanagement/getClientsByUserId/:userId - Get clients assigned to a specific user
router.get('/clientmanagement/getClientsByUserId/:userId', clientManagementController.getClientsByUserId);

// POST /api/clientmanagement/create - Create new client
router.post('/clientmanagement/create', clientManagementController.create);

// PUT /api/clientmanagement/update/:clientId - Update client
router.put('/clientmanagement/update/:clientId', clientManagementController.update);

// DELETE /api/clientmanagement/delete/:clientId - Delete client
router.delete('/clientmanagement/delete/:clientId', clientManagementController.delete);

// Attachment management routes
// POST /api/clientmanagement/:clientId/attachments - Add attachment to client
router.post('/clientmanagement/:clientId/attachments', clientManagementController.addAttachment);

// GET /api/clientmanagement/:clientId/attachments - Get all attachments for a client
router.get('/clientmanagement/:clientId/attachments', clientManagementController.getAttachments);

// GET /api/clientmanagement/:clientId/attachments/sortedByUserId - Get attachments for a client sorted by userId
router.get('/clientmanagement/:clientId/attachments/sortedByUserId', clientManagementController.getAttachmentsSortedByUserId);

// GET /api/clientmanagement/:clientId/attachments/byUserId/:userId - Get attachments for a client filtered by userId
router.get('/clientmanagement/:clientId/attachments/byUserId/:userId', clientManagementController.getAttachmentsByClientIdAndUserId);

// PUT /api/clientmanagement/:clientId/attachments/:attachmentId - Update attachment
router.put('/clientmanagement/:clientId/attachments/:attachmentId', clientManagementController.updateAttachment);

// DELETE /api/clientmanagement/:clientId/attachments/:attachmentId - Delete attachment
router.delete('/clientmanagement/:clientId/attachments/:attachmentId', clientManagementController.deleteAttachment);

module.exports = router;

