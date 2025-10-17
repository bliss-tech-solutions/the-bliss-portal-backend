const express = require('express');
const router = express.Router();

const addTaskAssignController = require('./AddTaskAssignController');

// GET /api/addtaskassign - list tasks
router.get('/getTaskAssign', addTaskAssignController.getAll);

// GET /api/getTaskAssign/archived - list archived tasks (optional userId query)
router.get('/getTaskAssign/archived', addTaskAssignController.getArchived);

// GET /api/addtaskassign/:userId - list tasks for a user
router.get('/getTaskAssign/:userId', addTaskAssignController.getByUserId);

// POST /api/addtaskassign - create task
router.post('/addtaskassign', addTaskAssignController.create);

// POST /api/addtaskassign/:taskId/chat - append chat message
router.post('/addtaskassign/:taskId/chat', addTaskAssignController.addChatMessage);

// PUT /api/addtaskassign/:taskId/archive - archive task
router.put('/addtaskassign/:taskId/archive', addTaskAssignController.archive);

// PUT /api/addtaskassign/:taskId/unarchive - unarchive task
router.put('/addtaskassign/:taskId/unarchive', addTaskAssignController.unarchive);

module.exports = router;


