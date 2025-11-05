const AddTaskAssignModel = require('./AddTaskAssignSchema/AddTaskAssignSchema');

const addTaskAssignController = {
    // GET /api/addtaskassign - list all tasks
    getAll: async (req, res, next) => {
        try {
            const tasks = await AddTaskAssignModel.find();
            res.status(200).json({
                success: true,
                message: 'Tasks retrieved successfully',
                data: tasks,
                count: tasks.length
            });
        } catch (error) {
            next(error);
        }
    },

    // PUT /api/addtaskassign/:taskId/archive - archive a task
    archive: async (req, res, next) => {
        try {
            const { taskId } = req.params;
            const { actorUserId } = req.body; // optional: who archived
            const updated = await AddTaskAssignModel.findByIdAndUpdate(
                taskId,
                { isArchived: true, archivedAt: new Date(), archivedBy: actorUserId || undefined },
                { new: true }
            );
            if (!updated) return res.status(404).json({ success: false, message: 'Task not found' });
            res.status(200).json({ success: true, message: 'Task archived', data: updated });
        } catch (error) {
            next(error);
        }
    },

    // PUT /api/addtaskassign/:taskId/unarchive - unarchive a task
    unarchive: async (req, res, next) => {
        try {
            const { taskId } = req.params;
            const updated = await AddTaskAssignModel.findByIdAndUpdate(
                taskId,
                { isArchived: false },
                { new: true }
            );
            if (!updated) return res.status(404).json({ success: false, message: 'Task not found' });
            res.status(200).json({ success: true, message: 'Task unarchived', data: updated });
        } catch (error) {
            next(error);
        }
    },

    // GET /api/getTaskAssign/archived - list archived tasks (optionally by user)
    getArchived: async (req, res, next) => {
        try {
            const { userId } = req.query; // optional filter
            const filter = { isArchived: true };
            if (userId) {
                filter.$or = [{ userId }, { receiverUserId: userId }];
            }
            const tasks = await AddTaskAssignModel.find(filter);
            res.status(200).json({ success: true, message: 'Archived tasks retrieved', data: tasks, count: tasks.length });
        } catch (error) {
            next(error);
        }
    },

    // POST /api/addtaskassign/:taskId/chat - append a chat message
    addChatMessage: async (req, res, next) => {
        try {
            const { taskId } = req.params;
            const { userId, user, time, message } = req.body;

            const updated = await AddTaskAssignModel.findByIdAndUpdate(
                taskId,
                { $push: { chatMessages: { userId, user, time, message } } },
                { new: true }
            );

            if (!updated) {
                return res.status(404).json({ success: false, message: 'Task not found' });
            }

            res.status(200).json({ success: true, message: 'Chat message added', data: updated });
        } catch (error) {
            next(error);
        }
    },
    // GET /api/addtaskassign/:userId - list tasks for a user (both assigned by and assigned to)
    getByUserId: async (req, res, next) => {
        try {
            const { userId } = req.params;
            
            // Find tasks where user is either assigner (userId) OR receiver (receiverUserId)
            const tasks = await AddTaskAssignModel.find({
                $or: [
                    { userId: userId },           // Tasks assigned BY this user
                    { receiverUserId: userId }    // Tasks assigned TO this user
                ]
            });
            
            res.status(200).json({
                success: true,
                message: 'Tasks retrieved successfully',
                data: tasks,
                count: tasks.length
            });
        } catch (error) {
            next(error);
        }
    },

    // POST /api/addtaskassign - create a task
    create: async (req, res, next) => {
        try {
            const { userId, receiverUserId, taskName, clientName, category, priority, timeSpend, description, taskImages } = req.body;

            const newTask = new AddTaskAssignModel({
                userId,
                receiverUserId,
                taskName,
                clientName,
                category,
                priority,
                timeSpend,
                description,
                taskImages: Array.isArray(taskImages) ? taskImages : []
            });

            const saved = await newTask.save();
            res.status(201).json({ success: true, message: 'Task created successfully', data: saved });
        } catch (error) {
            next(error);
        }
    },

    // PUT /api/addtaskassign/:taskId/status - update task status
    updateStatus: async (req, res, next) => {
        try {
            const { taskId } = req.params;
            const { taskStatus } = req.body;

            // Validate status
            if (!taskStatus || !['pending', 'completed'].includes(taskStatus)) {
                return res.status(400).json({ 
                    success: false, 
                    message: 'Invalid status. Must be "pending" or "completed"' 
                });
            }

            const updated = await AddTaskAssignModel.findByIdAndUpdate(
                taskId,
                { taskStatus },
                { new: true, runValidators: true }
            );

            if (!updated) {
                return res.status(404).json({ success: false, message: 'Task not found' });
            }

            res.status(200).json({ 
                success: true, 
                message: `Task status updated to ${taskStatus}`, 
                data: updated 
            });
        } catch (error) {
            next(error);
        }
    }
};

module.exports = addTaskAssignController;


