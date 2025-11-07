const express = require('express');
const router = express.Router();

const addTaskAssignController = require('./AddTaskAssignController');

// GET /api/addtaskassign - list tasks
router.get('/getTaskAssign', addTaskAssignController.getAll);

// GET /api/getTaskAssign/archived - list archived tasks (optional userId query)
router.get('/getTaskAssign/archived', addTaskAssignController.getArchived);

// GET /api/getTaskAssign/slot-templates - get generated template by position (query)
router.get('/getTaskAssign/slot-templates', addTaskAssignController.slotTemplates);

// GET /api/getTaskAssign/slot-config - get current slot configuration
router.get('/getTaskAssign/slot-config', addTaskAssignController.getSlotConfig);

// PUT /api/getTaskAssign/slot-config - update slot configuration
router.put('/getTaskAssign/slot-config', addTaskAssignController.updateSlotConfig);

// GET /api/getTaskAssign/assigner/:assignerId - get all tasks assigned by an assigner
router.get('/getTaskAssign/assigner/:assignerId', addTaskAssignController.getByAssignerId);

// GET /api/getTaskAssign/receiver/:receiverId - get tasks assigned to a receiver
router.get('/getTaskAssign/receiver/:receiverId', addTaskAssignController.getByReceiverId);

// GET /api/getTaskAssign/:userId - get tasks for a user (legacy - kept for backward compatibility)
router.get('/getTaskAssign/:userId', addTaskAssignController.getByUserId);

// GET /api/getTaskAssign/:userId/slots-availability - get available slots for user on date
router.get('/getTaskAssign/:userId/slots-availability', addTaskAssignController.getUserSlotsAvailability);

// POST /api/addtaskassign - create task
router.post('/addtaskassign', addTaskAssignController.create);

// POST /api/addtaskassign/:taskId/chat - append chat message
router.post('/addtaskassign/:taskId/chat', addTaskAssignController.addChatMessage);

// PUT /api/addtaskassign/:taskId/archive - archive task
router.put('/addtaskassign/:taskId/archive', addTaskAssignController.archive);

// PUT /api/addtaskassign/:taskId/unarchive - unarchive task
router.put('/addtaskassign/:taskId/unarchive', addTaskAssignController.unarchive);

// PUT /api/addtaskassign/:taskId/status - update task status
router.put('/addtaskassign/:taskId/status', addTaskAssignController.updateStatus);

// GET /api/addtaskassign/:taskId/slots - list slots for a task
router.get('/addtaskassign/:taskId/slots', addTaskAssignController.getSlots);

// POST /api/addtaskassign/:taskId/slots - add a slot
router.post('/addtaskassign/:taskId/slots', addTaskAssignController.addSlot);

// PUT /api/addtaskassign/:taskId/slots/:slotId/status - update slot status
router.put('/addtaskassign/:taskId/slots/:slotId/status', addTaskAssignController.updateSlotStatus);

module.exports = router;


