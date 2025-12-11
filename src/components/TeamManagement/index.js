const express = require('express');
const router = express.Router();

// Import controller
const teamManagementController = require('./TeamManagementController');

// Routes
// GET /api/teammanagement/getAllTeams - Get all teams
router.get('/teammanagement/getAllTeams', teamManagementController.getAllTeams);

// GET /api/teammanagement/getTeamById/:teamId - Get team by ID
router.get('/teammanagement/getTeamById/:teamId', teamManagementController.getTeamById);

// GET /api/teammanagement/getTeamsByUserId/:userId - Get teams by user ID
router.get('/teammanagement/getTeamsByUserId/:userId', teamManagementController.getTeamsByUserId);

// POST /api/teammanagement/createTeam - Create new team
router.post('/teammanagement/createTeam', teamManagementController.createTeam);

// PUT /api/teammanagement/updateTeam/:teamId - Update team
router.put('/teammanagement/updateTeam/:teamId', teamManagementController.updateTeam);

// DELETE /api/teammanagement/deleteTeam/:teamId - Delete team
router.delete('/teammanagement/deleteTeam/:teamId', teamManagementController.deleteTeam);

module.exports = router;

