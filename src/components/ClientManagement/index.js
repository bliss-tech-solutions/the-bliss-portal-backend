const express = require('express');
const router = express.Router();

// Import controller
const clientManagementController = require('./ClientManagementController');

// Routes
// GET /api/clientmanagement/getAllClientsData - Get all clients
router.get('/clientmanagement/getAllClientsData', clientManagementController.getAllClientsData);

// GET /api/clientmanagement/getById/:clientId - Get client by ID
router.get('/clientmanagement/getById/:clientId', clientManagementController.getById);

// POST /api/clientmanagement/create - Create new client
router.post('/clientmanagement/create', clientManagementController.create);

// PUT /api/clientmanagement/update/:clientId - Update client
router.put('/clientmanagement/update/:clientId', clientManagementController.update);

// DELETE /api/clientmanagement/delete/:clientId - Delete client
router.delete('/clientmanagement/delete/:clientId', clientManagementController.delete);

module.exports = router;

