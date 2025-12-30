const express = require('express');
const router = express.Router();

const leavesController = require('./LeavesController');

// POST /api/leave/request - Submit leave entries for a month
router.post('/leave/request', leavesController.request);

// GET /api/leave/get/:userId/:month - Get leaves for specific month
router.get('/leave/get/:userId/:month', leavesController.getByMonth);

// GET /api/leave/getAll/:userId - Get all leaves across all months
router.get('/leave/getAll/:userId', leavesController.getAll);

// GET /api/leave/getAllLeaves - Get all leaves from all users (HR/Admin)
router.get('/leave/getAllLeaves', leavesController.getAllLeaves);

// POST /api/leave/approve/:userId/:month/:leaveId - Approve leave
router.post('/leave/approve/:userId/:month/:leaveId', leavesController.approve);

// POST /api/leave/reject/:userId/:month/:leaveId - Reject leave
router.post('/leave/reject/:userId/:month/:leaveId', leavesController.reject);

// POST /api/leave/updateBatch - Bulk update leaves
router.post('/leave/updateBatch', leavesController.updateBatch);

// DELETE /api/leave/delete/:userId/:month/:leaveId - Delete leave
router.delete('/leave/delete/:userId/:month/:leaveId', leavesController.deleteLeave);

module.exports = router;