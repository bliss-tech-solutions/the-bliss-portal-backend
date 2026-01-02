const express = require('express');
const router = express.Router();
const dailyWorkingController = require('./DailyWorkingController');

// Create task
router.post('/daily-working/create', dailyWorkingController.createTask);

// Get all tasks
router.get('/daily-working/all', dailyWorkingController.getAllTasks);

// Get tasks for a specific user
router.get('/daily-working/user/:userId', dailyWorkingController.getUserTasks);

// Update task
router.patch('/daily-working/update/:taskId', dailyWorkingController.updateTask);

// Delete task
router.delete('/daily-working/delete/:taskId', dailyWorkingController.deleteTask);

module.exports = router;
