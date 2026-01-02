const DailyWorking = require('./DailyWorkingSchema/DailyWorkingSchema');
const { getIO } = require('../../utils/socket');
const mongoose = require('mongoose');

/**
 * @desc Create a new daily task
 * @route POST /api/daily-working/create
 */
exports.createTask = async (req, res, next) => {
    try {
        const { userId, title, priority, status, referenceData, date } = req.body;

        // Use current date if not provided, and normalize it to the start of the day
        const workDate = date ? new Date(date) : new Date();
        workDate.setHours(0, 0, 0, 0);

        const newTask = {
            _id: new mongoose.Types.ObjectId(),
            title,
            priority: priority || 'Medium',
            status: status || 'Not Started',
            referenceData: referenceData || [],
            createdAt: new Date(),
            updatedAt: new Date()
        };

        const dailyEntry = await DailyWorking.findOneAndUpdate(
            { userId, date: workDate },
            { $push: { tasks: newTask } },
            { upsert: true, new: true, setDefaultsOnInsert: true }
        );

        // Emit socket event for real-time update
        const io = getIO();
        if (io) {
            io.emit('dailyTaskCreated', { userId, task: newTask });
            io.to(`user:${userId}`).emit('userDailyTaskCreated', newTask);
        }

        res.status(201).json({
            success: true,
            message: 'Task created successfully',
            data: dailyEntry,
            newTask
        });
    } catch (error) {
        next(error);
    }
};

/**
 * @desc Get all tasks
 * @route GET /api/daily-working/all
 */
exports.getAllTasks = async (req, res, next) => {
    try {
        const entries = await DailyWorking.find().sort({ date: -1 });
        res.status(200).json({
            success: true,
            count: entries.length,
            data: entries
        });
    } catch (error) {
        next(error);
    }
};

/**
 * @desc Get tasks for a specific user
 * @route GET /api/daily-working/user/:userId
 */
exports.getUserTasks = async (req, res, next) => {
    try {
        const { userId } = req.params;
        const entries = await DailyWorking.find({ userId }).sort({ date: -1 });
        res.status(200).json({
            success: true,
            count: entries.length,
            data: entries
        });
    } catch (error) {
        next(error);
    }
};

/**
 * @desc Update a daily task within the array
 * @route PATCH /api/daily-working/update/:taskId
 */
exports.updateTask = async (req, res, next) => {
    try {
        const { taskId } = req.params;
        const updateData = req.body;

        // Construct update object with positional operator
        const updateObj = {};
        for (const key in updateData) {
            updateObj[`tasks.$.${key}`] = updateData[key];
        }
        updateObj['tasks.$.updatedAt'] = new Date();

        const dailyEntry = await DailyWorking.findOneAndUpdate(
            { "tasks._id": taskId },
            { $set: updateObj },
            { new: true, runValidators: true }
        );

        if (!dailyEntry) {
            return res.status(404).json({
                success: false,
                message: 'Task not found'
            });
        }

        const task = dailyEntry.tasks.find(t => t._id.toString() === taskId);

        // Emit socket event for real-time update
        const io = getIO();
        if (io) {
            io.emit('dailyTaskUpdated', { userId: dailyEntry.userId, task });
            io.to(`user:${dailyEntry.userId}`).emit('userDailyTaskUpdated', task);
        }

        res.status(200).json({
            success: true,
            message: 'Task updated successfully',
            data: task
        });
    } catch (error) {
        next(error);
    }
};

/**
 * @desc Delete a daily task from the array
 * @route DELETE /api/daily-working/delete/:taskId
 */
exports.deleteTask = async (req, res, next) => {
    try {
        const { taskId } = req.params;

        const dailyEntry = await DailyWorking.findOneAndUpdate(
            { "tasks._id": taskId },
            { $pull: { tasks: { _id: taskId } } },
            { new: true }
        );

        if (!dailyEntry) {
            return res.status(404).json({
                success: false,
                message: 'Task not found'
            });
        }

        // Emit socket event for real-time update
        const io = getIO();
        if (io) {
            io.emit('dailyTaskDeleted', { taskId, userId: dailyEntry.userId });
            io.to(`user:${dailyEntry.userId}`).emit('userDailyTaskDeleted', { taskId });
        }

        res.status(200).json({
            success: true,
            message: 'Task deleted successfully'
        });
    } catch (error) {
        next(error);
    }
};
