const AddTaskAssignModel = require('./AddTaskAssignSchema/AddTaskAssignSchema');
const UserScheduleModel = require('../UserSchedule/UserScheduleSchema');

const isFiniteNumber = (value) => Number.isFinite(value) && !Number.isNaN(value);

const coerceMinutes = (value) => {
    if (isFiniteNumber(value)) return Math.round(value);
    if (typeof value === 'string') {
        const trimmed = value.trim();
        if (!trimmed) return undefined;
        const parsed = Number(trimmed);
        return isFiniteNumber(parsed) ? Math.round(parsed) : undefined;
    }
    return undefined;
};

const HH_MM_REGEX = /^\d{1,2}:\d{2}(:\d{2})?$/;

const parseSlotTimestamp = (slot, key) => {
    if (!slot) return null;
    const rawValue = slot[key];
    if (!rawValue) return null;

    const tryDate = new Date(rawValue);
    if (!Number.isNaN(tryDate.getTime())) {
        return tryDate;
    }

    if (slot.slotDate && typeof rawValue === 'string' && HH_MM_REGEX.test(rawValue)) {
        const base = new Date(slot.slotDate);
        if (Number.isNaN(base.getTime())) return null;
        const parts = rawValue.split(':').map((segment) => Number(segment));
        if (parts.some((part) => Number.isNaN(part))) return null;
        const [hours, minutes, seconds = 0] = parts;
        base.setHours(hours, minutes, seconds, 0);
        return base;
    }

    return null;
};

const pad = (value) => value.toString().padStart(2, '0');

const formatSlotTimestamp = (originalValue, dateObj) => {
    if (!dateObj) return originalValue;
    if (typeof originalValue === 'string' && HH_MM_REGEX.test(originalValue) && !originalValue.includes('T')) {
        const hours = pad(dateObj.getHours());
        const minutes = pad(dateObj.getMinutes());
        const seconds = originalValue.split(':').length === 3 ? pad(dateObj.getSeconds()) : undefined;
        return seconds ? `${hours}:${minutes}:${seconds}` : `${hours}:${minutes}`;
    }
    return dateObj.toISOString();
};

const toUTCStartOfDay = (dateLike) => {
    const date = new Date(dateLike);
    if (Number.isNaN(date.getTime())) return null;
    date.setUTCHours(0, 0, 0, 0);
    return date;
};

const addMinutesToDate = (date, minutes) => new Date(date.getTime() + minutes * 60000);

const adjustSlotForExtension = (task, slotId, additionalMinutes) => {
    if (!task || !task.slots || !Array.isArray(task.slots)) return;
    if (!additionalMinutes) return;

    const targetSlotIndex = task.slots.findIndex((slot) => slot && slot._id && slot._id.toString() === slotId.toString());
    if (targetSlotIndex === -1) return;

    const targetSlot = task.slots[targetSlotIndex];
    targetSlot.extensionMinutes = (targetSlot.extensionMinutes || 0) + additionalMinutes;
    targetSlot.durationMinutes = Math.max(0, (targetSlot.durationMinutes || 0) + additionalMinutes);

    const originalEnd = targetSlot.end;
    const parsedEnd = parseSlotTimestamp(targetSlot, 'end');
    if (parsedEnd) {
        parsedEnd.setMinutes(parsedEnd.getMinutes() + additionalMinutes);
        targetSlot.end = formatSlotTimestamp(originalEnd, parsedEnd);
    }

    for (let index = targetSlotIndex + 1; index < task.slots.length; index += 1) {
        const slot = task.slots[index];
        if (!slot) continue;

        const originalStart = slot.start;
        const parsedStart = parseSlotTimestamp(slot, 'start');
        if (parsedStart) {
            parsedStart.setMinutes(parsedStart.getMinutes() + additionalMinutes);
            slot.start = formatSlotTimestamp(originalStart, parsedStart);
        }

        const originalSlotEnd = slot.end;
        const parsedSlotEnd = parseSlotTimestamp(slot, 'end');
        if (parsedSlotEnd) {
            parsedSlotEnd.setMinutes(parsedSlotEnd.getMinutes() + additionalMinutes);
            slot.end = formatSlotTimestamp(originalSlotEnd, parsedSlotEnd);
        }
    }

    if (!task.timeTracking) {
        task.timeTracking = {
            originalSlotMinutes: 0,
            totalExtendedMinutes: 0,
            totalWorkedMinutes: 0
        };
    }

    task.timeTracking.totalExtendedMinutes = task.slots.reduce(
        (minutes, slot) => minutes + (slot?.extensionMinutes || 0),
        0
    );
};

const resolveSlotInterval = (slot) => {
    if (!slot) return null;
    const intervalStart = parseSlotTimestamp(slot, 'start');
    const intervalEnd = parseSlotTimestamp(slot, 'end');
    if (!intervalStart || !intervalEnd) return null;
    return { startDate: intervalStart, endDate: intervalEnd };
};

const hasScheduleConflict = async ({ userId, startDate, endDate, excludeTaskId } = {}) => {
    if (!userId || !startDate || !endDate) return null;
    const query = {
        userId,
        start: { $lt: endDate },
        end: { $gt: startDate }
    };
    if (excludeTaskId) {
        query.taskId = { $ne: excludeTaskId };
    }
    return UserScheduleModel.findOne(query).lean();
};

const syncTaskSchedule = async (taskDoc) => {
    if (!taskDoc || !taskDoc.receiverUserId) return;
    const slots = Array.isArray(taskDoc.slots) ? taskDoc.slots : [];
    if (!slots.length) {
        await UserScheduleModel.deleteMany({ taskId: taskDoc._id });
        return;
    }

    const slotIds = slots
        .map((slot) => (slot && slot._id ? slot._id : null))
        .filter(Boolean);

    if (slotIds.length) {
        await UserScheduleModel.deleteMany({
            taskId: taskDoc._id,
            slotId: { $nin: slotIds }
        });
    } else {
        await UserScheduleModel.deleteMany({ taskId: taskDoc._id });
    }

    const bulkOps = slots
        .map((slot) => {
            if (!slot) return null;
            const interval = resolveSlotInterval(slot);
            if (!interval) return null;
            return {
                updateOne: {
                    filter: { taskId: taskDoc._id, slotId: slot._id },
                    update: {
                        $set: {
                            userId: taskDoc.receiverUserId,
                            start: interval.startDate,
                            end: interval.endDate
                        }
                    },
                    upsert: true
                }
            };
        })
        .filter(Boolean);

    if (bulkOps.length) {
        await UserScheduleModel.bulkWrite(bulkOps);
    }
};

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

    // GET /api/getTaskAssignByDate?userId=&date=
    getByUserIdAndDate: async (req, res, next) => {
        try {
            const { userId, date } = req.query;

            if (!userId || !date) {
                return res.status(400).json({
                    success: false,
                    message: 'userId and date query parameters are required'
                });
            }

            const targetDate = new Date(date);
            if (Number.isNaN(targetDate.getTime())) {
                return res.status(400).json({
                    success: false,
                    message: 'Invalid date value. Expected YYYY-MM-DD'
                });
            }

            const dayStart = toUTCStartOfDay(targetDate);
            if (!dayStart) {
                return res.status(400).json({
                    success: false,
                    message: 'Unable to normalize provided date'
                });
            }
            const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60000);

            const tasks = await AddTaskAssignModel.find({
                $or: [{ userId }, { receiverUserId: userId }],
                slots: { $exists: true, $ne: [] }
            }).lean();

            const results = [];
            tasks.forEach((task) => {
                const filteredSlots = (task.slots || [])
                    .map((slot) => {
                        const interval = resolveSlotInterval(slot);
                        let overlaps = false;
                        if (interval) {
                            overlaps = interval.startDate < dayEnd && interval.endDate > dayStart;
                        } else if (slot.slotDate) {
                            const slotDate = new Date(slot.slotDate);
                            overlaps =
                                !Number.isNaN(slotDate.getTime()) &&
                                slotDate >= dayStart &&
                                slotDate < dayEnd;
                        }
                        if (!overlaps) return null;

                        const startDate = parseSlotTimestamp(slot, 'start');
                        const endDate = parseSlotTimestamp(slot, 'end');
                        let derivedDuration = slot.durationMinutes;
                        if ((!derivedDuration || derivedDuration <= 0) && startDate && endDate) {
                            derivedDuration = Math.max(
                                0,
                                Math.round((endDate.getTime() - startDate.getTime()) / 60000)
                            );
                        }

                        return {
                            slotId: slot._id,
                            start: startDate ? startDate.toISOString() : slot.start || null,
                            end: endDate ? endDate.toISOString() : slot.end || null,
                            slotDate: slot.slotDate
                                ? new Date(slot.slotDate).toISOString().split('T')[0]
                                : startDate
                                ? startDate.toISOString().split('T')[0]
                                : null,
                            status: slot.status || 'scheduled',
                            durationMinutes: derivedDuration || null,
                            extensionMinutes: slot.extensionMinutes || 0
                        };
                    })
                    .filter(Boolean);

                if (filteredSlots.length) {
                    results.push({
                        taskId: task._id,
                        taskName: task.taskName,
                        userId: task.userId,
                        receiverUserId: task.receiverUserId,
                        taskStatus: task.taskStatus,
                        category: task.category,
                        priority: task.priority,
                        clientName: task.clientName,
                        slots: filteredSlots
                    });
                }
            });

            const totalSlots = results.reduce(
                (count, task) => count + (task.slots ? task.slots.length : 0),
                0
            );

            res.status(200).json({
                success: true,
                message: totalSlots
                    ? 'Tasks and slots retrieved for the selected date'
                    : 'No slots found for the selected date',
                data: {
                    userId,
                    date: dayStart.toISOString().split('T')[0],
                    totalTasks: results.length,
                    totalSlots,
                    tasks: results
                }
            });
        } catch (error) {
            next(error);
        }
    },

    // POST /api/addtaskassign - create a task
    create: async (req, res, next) => {
        try {
            const {
                userId,
                receiverUserId,
                position,
                workParentType,
                workChildType,
                taskName,
                clientName,
                category,
                priority,
                timeSpend,
                description,
                taskImages,
                attachments,
                slots,
                slot
            } = req.body;

            const normalizedTaskImages = Array.isArray(taskImages)
                ? taskImages.filter(Boolean)
                : taskImages
                    ? [taskImages]
                    : [];

            const normalizedAttachments = Array.isArray(attachments)
                ? attachments.filter(Boolean)
                : attachments
                    ? [attachments]
                    : [];

            const normalizeSlot = (slotPayload = {}) => {
                if (!slotPayload) return undefined;

                const start = slotPayload.start ?? undefined;
                const end = slotPayload.end ?? undefined;
                let durationMinutes = Number.isFinite(slotPayload.durationMinutes)
                    ? slotPayload.durationMinutes
                    : undefined;

                if (
                    durationMinutes === undefined &&
                    typeof slotPayload.durationMinutes === 'string' &&
                    slotPayload.durationMinutes.trim() !== ''
                ) {
                    const parsed = Number(slotPayload.durationMinutes);
                    durationMinutes = Number.isFinite(parsed) ? parsed : undefined;
                }

                if (durationMinutes === undefined && start && end) {
                    const startDate = new Date(start);
                    const endDate = new Date(end);
                    if (!Number.isNaN(startDate.getTime()) && !Number.isNaN(endDate.getTime())) {
                        durationMinutes = Math.max(0, Math.round((endDate - startDate) / 60000));
                    }
                }

                const slotDate =
                    slotPayload.slotDate && !Number.isNaN(new Date(slotPayload.slotDate).getTime())
                        ? new Date(slotPayload.slotDate)
                        : undefined;

                let extensionMinutes = 0;
                if (Number.isFinite(slotPayload.extensionMinutes)) {
                    extensionMinutes = slotPayload.extensionMinutes;
                } else if (
                    typeof slotPayload.extensionMinutes === 'string' &&
                    slotPayload.extensionMinutes.trim() !== ''
                ) {
                    const parsedExtension = Number(slotPayload.extensionMinutes);
                    extensionMinutes = Number.isFinite(parsedExtension) ? parsedExtension : 0;
                }

                return {
                    start,
                    end,
                    slotDate,
                    durationMinutes,
                    status: slotPayload.status || 'scheduled',
                    extensionMinutes,
                    extensionHistory: Array.isArray(slotPayload.extensionHistory)
                        ? slotPayload.extensionHistory
                        : []
                };
            };

            let normalizedSlots = [];
            if (Array.isArray(slots) && slots.length) {
                normalizedSlots = slots
                    .map(normalizeSlot)
                    .filter(Boolean);
            } else if (slot) {
                const parsed = normalizeSlot(slot);
                if (parsed) normalizedSlots.push(parsed);
            }

            const originalSlotMinutes = normalizedSlots.reduce(
                (minutes, current) => minutes + (current?.durationMinutes || 0),
                0
            );

            const totalExtendedMinutes = normalizedSlots.reduce(
                (minutes, current) => minutes + (current?.extensionMinutes || 0),
                0
            );

            if (receiverUserId && normalizedSlots.length) {
                for (const slot of normalizedSlots) {
                    const interval = resolveSlotInterval(slot);
                    if (!interval) {
                        return res.status(400).json({
                            success: false,
                            message: 'Each slot must include a valid start, end, and slotDate to determine availability'
                        });
                    }
                    if (interval.endDate <= interval.startDate) {
                        return res.status(400).json({
                            success: false,
                            message: 'Slot end time must be after the start time'
                        });
                    }
                    const conflict = await hasScheduleConflict({
                        userId: receiverUserId,
                        startDate: interval.startDate,
                        endDate: interval.endDate
                    });
                    if (conflict) {
                        return res.status(409).json({
                            success: false,
                            message: 'Receiver already has a booking in the requested time range',
                            data: {
                                conflictingScheduleId: conflict._id,
                                conflictingTaskId: conflict.taskId,
                                conflictingSlotId: conflict.slotId
                            }
                        });
                    }
                }
            }

            const newTask = new AddTaskAssignModel({
                userId,
                receiverUserId,
                position,
                workParentType,
                workChildType,
                taskName,
                clientName,
                category,
                priority,
                timeSpend,
                description,
                taskImages: normalizedTaskImages,
                attachments: normalizedAttachments,
                slots: normalizedSlots,
                timeTracking: {
                    originalSlotMinutes,
                    totalExtendedMinutes,
                    totalWorkedMinutes: 0
                }
            });

            const saved = await newTask.save();
            await syncTaskSchedule(saved);

            // Emit socket event for real-time updates
            try {
                const { getIO } = require('../../utils/socket');
                const io = getIO && getIO();
                if (io) {
                    // Emit to task-specific room
                    io.to(String(saved._id)).emit('task:created', {
                        taskId: String(saved._id),
                        task: saved
                    });

                    // Emit to receiver user room (if assigned to someone)
                    if (saved.receiverUserId) {
                        io.to(`user:${saved.receiverUserId}`).emit('task:assigned', {
                            taskId: String(saved._id),
                            task: saved
                        });
                    }

                    // Emit to creator user room
                    if (saved.userId) {
                        io.to(`user:${saved.userId}`).emit('task:created', {
                            taskId: String(saved._id),
                            task: saved
                        });
                    }

                    // Emit to global tasks room for task list updates
                    io.emit('task:new', {
                        taskId: String(saved._id),
                        task: saved
                    });
                }
            } catch (e) {
                // Ignore socket errors, don't break the API response
                console.warn('Socket emission failed:', e.message);
            }

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

            // Emit socket event for real-time status updates
            try {
                const { getIO } = require('../../utils/socket');
                const io = getIO && getIO();
                if (io) {
                    // Emit to task-specific room
                    io.to(String(taskId)).emit('task:statusUpdated', {
                        taskId: String(taskId),
                        taskStatus,
                        task: updated
                    });

                    // Emit to receiver user room
                    if (updated.receiverUserId) {
                        io.to(`user:${updated.receiverUserId}`).emit('task:statusUpdated', {
                            taskId: String(taskId),
                            taskStatus,
                            task: updated
                        });
                    }

                    // Emit to creator user room
                    if (updated.userId) {
                        io.to(`user:${updated.userId}`).emit('task:statusUpdated', {
                            taskId: String(taskId),
                            taskStatus,
                            task: updated
                        });
                    }

                    // Emit to global for task list updates
                    io.emit('task:updated', {
                        taskId: String(taskId),
                        taskStatus,
                        task: updated
                    });
                }
            } catch (e) {
                console.warn('Socket emission failed:', e.message);
            }

            res.status(200).json({
                success: true,
                message: `Task status updated to ${taskStatus}`,
                data: updated
            });
        } catch (error) {
            next(error);
        }
    },

    // POST /api/addtaskassign/:taskId/slots/:slotId/request-extension - request extra time for a slot
    requestSlotExtension: async (req, res, next) => {
        try {
            const { taskId, slotId } = req.params;
            const { requestedBy, minutesRequested, reason } = req.body || {};

            const normalizedMinutes = coerceMinutes(minutesRequested);
            if (!requestedBy || !normalizedMinutes || normalizedMinutes <= 0) {
                return res.status(400).json({
                    success: false,
                    message: 'requestedBy and a positive minutesRequested value are required'
                });
            }

            const task = await AddTaskAssignModel.findById(taskId);
            if (!task) {
                return res.status(404).json({ success: false, message: 'Task not found' });
            }

            const slot = task.slots.id(slotId);
            if (!slot) {
                return res.status(404).json({ success: false, message: 'Slot not found for this task' });
            }

            slot.extensionHistory.push({
                requestedBy,
                requestedAt: new Date(),
                minutesRequested: normalizedMinutes,
                reason,
                status: 'pending'
            });

            task.markModified('slots');
            const savedTask = await task.save();
            const savedSlot = savedTask.slots.id(slotId);
            const savedExtension = savedSlot.extensionHistory[savedSlot.extensionHistory.length - 1];

            res.status(201).json({
                success: true,
                message: 'Extension request submitted',
                data: {
                    taskId: savedTask._id,
                    slotId: savedSlot._id,
                    extensionRequest: savedExtension
                }
            });
        } catch (error) {
            next(error);
        }
    },

    // PUT /api/addtaskassign/:taskId/slots/:slotId/extensions/:extensionId/respond - approve/reject extension
    respondToSlotExtension: async (req, res, next) => {
        try {
            const { taskId, slotId, extensionId } = req.params;
            const { decision, respondedBy } = req.body || {};

            if (!['approved', 'rejected'].includes(decision)) {
                return res.status(400).json({
                    success: false,
                    message: 'decision must be either "approved" or "rejected"'
                });
            }

            if (!respondedBy) {
                return res.status(400).json({
                    success: false,
                    message: 'respondedBy is required'
                });
            }

            const task = await AddTaskAssignModel.findById(taskId);
            if (!task) {
                return res.status(404).json({ success: false, message: 'Task not found' });
            }

            const slot = task.slots.id(slotId);
            if (!slot) {
                return res.status(404).json({ success: false, message: 'Slot not found for this task' });
            }

            const extensionRequest = slot.extensionHistory.id(extensionId);
            if (!extensionRequest) {
                return res.status(404).json({ success: false, message: 'Extension request not found' });
            }

            if (extensionRequest.status !== 'pending') {
                return res.status(409).json({
                    success: false,
                    message: `Extension request already ${extensionRequest.status}`
                });
            }

            extensionRequest.status = decision;
            extensionRequest.respondedBy = respondedBy;
            extensionRequest.respondedAt = new Date();

            let adjustmentMinutes = 0;
            if (decision === 'approved') {
                adjustmentMinutes = extensionRequest.minutesRequested || 0;
                if (adjustmentMinutes > 0 && task.receiverUserId) {
                    const slotIndex = task.slots.findIndex(
                        (slotItem) => slotItem && slotItem._id && slotItem._id.toString() === slotId.toString()
                    );

                    const proposedTask = task.toObject();
                    adjustSlotForExtension(proposedTask, slotId, adjustmentMinutes);

                    if (slotIndex !== -1) {
                        for (let index = slotIndex; index < proposedTask.slots.length; index += 1) {
                            const candidateSlot = proposedTask.slots[index];
                            const interval = resolveSlotInterval(candidateSlot);
                            if (!interval) {
                                return res.status(400).json({
                                    success: false,
                                    message: 'Unable to compute updated slot interval for conflict validation'
                                });
                            }
                            const conflict = await hasScheduleConflict({
                                userId: task.receiverUserId,
                                startDate: interval.startDate,
                                endDate: interval.endDate,
                                excludeTaskId: task._id
                            });
                            if (conflict) {
                                return res.status(409).json({
                                    success: false,
                                    message: 'Extension overlaps with another booking',
                                    data: {
                                        conflictingScheduleId: conflict._id,
                                        conflictingTaskId: conflict.taskId,
                                        conflictingSlotId: conflict.slotId
                                    }
                                });
                            }
                        }
                    }
                }

                adjustSlotForExtension(task, slotId, adjustmentMinutes);
            }

            task.markModified('slots');
            task.markModified('timeTracking');

            const savedTask = await task.save();
            await syncTaskSchedule(savedTask);

            res.status(200).json({
                success: true,
                message: `Extension ${decision}`,
                data: {
                    task: savedTask,
                    slotId,
                    extensionId,
                    adjustmentMinutes
                }
            });
        } catch (error) {
            next(error);
        }
    },

    // GET /api/availability - provide a day's bookings and free intervals for a user
    getAvailability: async (req, res, next) => {
        try {
            const {
                receiverUserId,
                userId,
                date,
                durationMinutes
            } = req.query;

            const targetUserId = receiverUserId || userId;
            if (!targetUserId) {
                return res.status(400).json({
                    success: false,
                    message: 'receiverUserId (or userId) is required'
                });
            }

            if (!date) {
                return res.status(400).json({
                    success: false,
                    message: 'date query parameter is required (YYYY-MM-DD)'
                });
            }

            const baseDate = new Date(date);
            if (Number.isNaN(baseDate.getTime())) {
                return res.status(400).json({
                    success: false,
                    message: 'Invalid date value'
                });
            }

            const normalizedDuration = durationMinutes ? coerceMinutes(durationMinutes) : undefined;
            if (durationMinutes && (!normalizedDuration || normalizedDuration <= 0)) {
                return res.status(400).json({
                    success: false,
                    message: 'durationMinutes must be a positive number'
                });
            }

            const dayStart = toUTCStartOfDay(baseDate);
            if (!dayStart) {
                return res.status(400).json({
                    success: false,
                    message: 'Unable to normalize provided date'
                });
            }
            const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60000);

            const scheduleEntries = await UserScheduleModel.find({
                userId: targetUserId,
                end: { $gt: dayStart },
                start: { $lt: dayEnd }
            })
                .sort({ start: 1 })
                .lean();

            const taskIds = Array.from(
                new Set(scheduleEntries.map((entry) => entry.taskId?.toString()).filter(Boolean))
            );

            const taskDocs = taskIds.length
                ? await AddTaskAssignModel.find({ _id: { $in: taskIds } })
                      .select('slots taskStatus')
                      .lean()
                : [];

            const taskMap = taskDocs.reduce((accumulator, task) => {
                if (!task || !task._id) return accumulator;
                accumulator[task._id.toString()] = task;
                return accumulator;
            }, {});

            const bookings = scheduleEntries.map((entry) => {
                const task = taskMap[entry.taskId?.toString()];
                const slot = task?.slots?.find((item) => item && item._id?.toString() === entry.slotId?.toString());
                const slotDate = slot?.slotDate ? new Date(slot.slotDate) : null;
                const duration = Math.max(
                    0,
                    Math.round((new Date(entry.end).getTime() - new Date(entry.start).getTime()) / 60000)
                );
                return {
                    _id: slot?._id || entry._id,
                    taskId: entry.taskId,
                    slotId: entry.slotId,
                    start: new Date(entry.start).toISOString(),
                    end: new Date(entry.end).toISOString(),
                    slotDate: slotDate ? slotDate.toISOString().split('T')[0] : new Date(entry.start).toISOString().split('T')[0],
                    status: slot?.status || 'scheduled',
                    taskStatus: task?.taskStatus,
                    durationMinutes: slot?.durationMinutes ?? duration
                };
            });

            const normalizedIntervals = scheduleEntries
                .map((entry) => {
                    const entryStart = new Date(entry.start);
                    const entryEnd = new Date(entry.end);
                    if (Number.isNaN(entryStart.getTime()) || Number.isNaN(entryEnd.getTime())) return null;
                    const start = entryStart < dayStart ? new Date(dayStart) : entryStart;
                    const end = entryEnd > dayEnd ? new Date(dayEnd) : entryEnd;
                    if (end <= start) return null;
                    return { start, end };
                })
                .filter(Boolean)
                .sort((a, b) => a.start - b.start);

            const freeSlots = [];
            let cursor = new Date(dayStart);
            normalizedIntervals.forEach((interval) => {
                if (interval.start > cursor) {
                    const freeStart = new Date(cursor);
                    const freeEnd = new Date(Math.min(interval.start.getTime(), dayEnd.getTime()));
                    if (!normalizedDuration || ((freeEnd - freeStart) / 60000) >= normalizedDuration) {
                        freeSlots.push({
                            start: freeStart.toISOString(),
                            end: freeEnd.toISOString(),
                            slotDate: freeStart.toISOString().split('T')[0]
                        });
                    }
                }
                if (interval.end > cursor) {
                    cursor = new Date(interval.end);
                }
            });

            if (cursor < dayEnd) {
                if (!normalizedDuration || ((dayEnd - cursor) / 60000) >= normalizedDuration) {
                    freeSlots.push({
                        start: cursor.toISOString(),
                        end: dayEnd.toISOString(),
                        slotDate: cursor.toISOString().split('T')[0]
                    });
                }
            }

            const hasBookings = bookings.length > 0;
            const message = hasBookings
                ? 'Availability computed for the selected date'
                : 'All slots are free for the selected date';

            res.status(200).json({
                success: true,
                message,
                data: {
                    userId: targetUserId,
                    date: dayStart.toISOString().split('T')[0],
                    durationFilterMinutes: normalizedDuration || null,
                    bookings,
                    freeSlots,
                    summary: {
                        totalBookedSlots: bookings.length,
                        totalFreeSlots: freeSlots.length,
                        fullyFreeDay: !hasBookings
                    }
                }
            });
        } catch (error) {
            next(error);
        }
    }
};

module.exports = addTaskAssignController;


