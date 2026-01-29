const express = require('express');
const router = express.Router();

const addTaskAssignController = require('./AddTaskAssignController');

// GET /api/addtaskassign - list tasks
router.get('/getTaskAssign', addTaskAssignController.getAll);

// GET /api/getTaskAssign/archived - list archived tasks (optional userId query)
router.get('/getTaskAssign/archived', addTaskAssignController.getArchived);

// GET /api/addtaskassign/:userId - list tasks for a user
router.get('/getTaskAssign/:userId', addTaskAssignController.getByUserId);

// GET /api/getTaskAssignByDate?userId=&date=
router.get('/getTaskAssignByDate', addTaskAssignController.getByUserIdAndDate);

// POST /api/addtaskassign - create task
router.post('/addtaskassign', addTaskAssignController.create);

// POST /api/addtaskassign/:taskId/chat - append chat message
router.post('/addtaskassign/:taskId/chat', addTaskAssignController.addChatMessage);

// PUT /api/addtaskassign/:taskId/archive - archive task
router.put('/addtaskassign/:taskId/archive', addTaskAssignController.archive);

// PUT /api/addtaskassign/:taskId - edit task
router.put('/addtaskassign/:taskId', addTaskAssignController.editTask);

// PUT /api/addtaskassign/:taskId/unarchive - unarchive task
router.put('/addtaskassign/:taskId/unarchive', addTaskAssignController.unarchive);

// PUT /api/addtaskassign/:taskId/status - update task status
router.put('/addtaskassign/:taskId/status', addTaskAssignController.updateStatus);

// GET /api/availability - compute suggestions and bookings for a user
router.get('/availability', addTaskAssignController.getAvailability);

// POST /api/addtaskassign/:taskId/slots/:slotId/request-extension - request extra time
router.post(
    '/addtaskassign/:taskId/slots/:slotId/request-extension',
    addTaskAssignController.requestSlotExtension
);

// PUT /api/addtaskassign/:taskId/slots/:slotId/extensions/:extensionId/respond - approve/reject extension
router.put(
    '/addtaskassign/:taskId/slots/:slotId/extensions/:extensionId/respond',
    addTaskAssignController.respondToSlotExtension
);

module.exports = router;


