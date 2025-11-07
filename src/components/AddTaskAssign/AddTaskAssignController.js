const AddTaskAssignModel = require('./AddTaskAssignSchema/AddTaskAssignSchema');
const SlotConfigModel = require('./AddTaskAssignSchema/SlotConfigSchema');
const { getIO } = require('../../utils/socket');

// Helper function to emit socket events safely
const emitSocketEvent = (event, data, rooms = []) => {
    try {
        const io = getIO && getIO();
        if (io) {
            // Emit to specific rooms
            rooms.forEach(room => {
                io.to(room).emit(event, data);
            });
            // Also emit globally for general updates
            io.emit(event, data);
        }
    } catch (error) {
        // Silently ignore socket errors to prevent API failures
        console.warn('Socket emit error:', error.message);
    }
};

// Helper function to find task by taskId across all user documents
const findTaskById = async (taskId) => {
    const doc = await AddTaskAssignModel.findOne({ 'tasks._id': taskId });
    if (!doc) return null;
    const task = doc.tasks.id(taskId);
    return { doc, task };
};

// Generate default slot template from DB config (supports dynamic positions with lunch break)
const generateSlotTemplate = async (position) => {
    const cfg = await SlotConfigModel.getSingleton();
    const officeStartMinutes = (cfg.officeStartHour || 11) * 60;
    const officeEndMinutes = (cfg.officeEndHour || 19) * 60;

    const normalized = (position || '').toLowerCase();

    // Lunch break configuration - adjust based on position
    // For Graphics Designer: lunch starts at 13:20, for Video Editor: lunch starts at 13:00
    let lunchStartMin = (cfg.lunchStartHour || 13) * 60 + (cfg.lunchStartMinutes || 20);
    if (normalized.includes('video')) {
        // Video Editor: lunch starts at 13:00 (no extra minutes)
        lunchStartMin = (cfg.lunchStartHour || 13) * 60;
    }
    const lunchStartMinutes = lunchStartMin;
    const lunchEndMinutes = (cfg.lunchEndHour || 14) * 60 + (cfg.lunchEndMinutes || 50);
    // Priority: exact dynamic map match -> known aliases -> default graphics
    let posCfg = cfg.graphics || { blockMinutes: 60, gapMinutes: 20 };

    // Check dynamic positions map first
    if (cfg.positions && typeof cfg.positions.get === 'function') {
        const direct = cfg.positions.get(normalized);
        if (direct) {
            posCfg = direct;
        } else {
            // Fallback to known aliases
            const isVideo = normalized.includes('video');
            const isGraphic = normalized.includes('graphic');
            posCfg = isVideo ? (cfg.video || { blockMinutes: 120, gapMinutes: 20 }) :
                isGraphic ? (cfg.graphics || { blockMinutes: 60, gapMinutes: 20 }) : posCfg;
        }
    } else {
        // No positions map, use known aliases
        const isVideo = normalized.includes('video');
        const isGraphic = normalized.includes('graphic');
        posCfg = isVideo ? (cfg.video || { blockMinutes: 120, gapMinutes: 20 }) :
            isGraphic ? (cfg.graphics || { blockMinutes: 60, gapMinutes: 20 }) : posCfg;
    }
    const blockMinutes = posCfg.blockMinutes;
    const gapMinutes = posCfg.gapMinutes;

    const slots = [];

    // Generate slots before lunch break
    // Stop when adding a slot would cause it to end after lunch starts
    let cursor = officeStartMinutes;
    while (cursor + blockMinutes <= lunchStartMinutes) {
        const startTotal = cursor;
        const endTotal = cursor + blockMinutes;
        const startHH = String(Math.floor(startTotal / 60)).padStart(2, '0');
        const startMM = String(startTotal % 60).padStart(2, '0');
        const endHH = String(Math.floor(endTotal / 60)).padStart(2, '0');
        const endMM = String(endTotal % 60).padStart(2, '0');
        slots.push({ startTime: `${startHH}:${startMM}`, endTime: `${endHH}:${endMM}`, status: 'free', bufferAfterMinutes: gapMinutes });
        cursor = endTotal + gapMinutes;

        // Check if next slot would overlap with lunch break
        if (cursor + blockMinutes > lunchStartMinutes) {
            break;
        }
    }

    // Skip lunch break and start from lunchEndMinutes
    cursor = lunchEndMinutes;

    // Generate slots after lunch break
    while (cursor + blockMinutes <= officeEndMinutes) {
        const startTotal = cursor;
        const endTotal = cursor + blockMinutes;
        const startHH = String(Math.floor(startTotal / 60)).padStart(2, '0');
        const startMM = String(startTotal % 60).padStart(2, '0');
        const endHH = String(Math.floor(endTotal / 60)).padStart(2, '0');
        const endMM = String(endTotal % 60).padStart(2, '0');
        slots.push({ startTime: `${startHH}:${startMM}`, endTime: `${endHH}:${endMM}`, status: 'free', bufferAfterMinutes: gapMinutes });
        cursor = endTotal + gapMinutes;
    }

    return slots;
};

// Helper: get current slot config
const getSlotConfig = async () => SlotConfigModel.getSingleton();

// Helper: Organize slots by year/month/date structure
const organizeSlotsByDate = async (dateStr, selectedSlotTimes = [], position, category) => {
    // Parse date: "2025-11-05" -> year=2025, month=11, day=5
    const dateParts = dateStr ? dateStr.split('-') : [];
    if (dateParts.length !== 3) {
        throw new Error('Invalid date format. Use YYYY-MM-DD');
    }
    const year = parseInt(dateParts[0]);
    const month = parseInt(dateParts[1]);
    const day = parseInt(dateParts[2]);

    // Generate default slot times based on position or category
    const defaultSlotTimes = await generateSlotTemplate(position || category || 'Graphics Designer');

    // Create slotTimes array: mark selected ones as booked, others as free
    const slotTimes = defaultSlotTimes.map(slot => {
        // Check if this slot is in selectedSlotTimes
        const isSelected = selectedSlotTimes.some(selected =>
            selected.startTime === slot.startTime && selected.endTime === slot.endTime
        );
        return {
            startTime: slot.startTime,
            endTime: slot.endTime,
            status: isSelected ? 'booked' : 'free',
            bufferAfterMinutes: slot.bufferAfterMinutes,
            bufferEndsAt: isSelected ? new Date() : undefined
        };
    });

    // If selectedSlotTimes provided but not in defaults, add them as booked
    selectedSlotTimes.forEach(selected => {
        const exists = slotTimes.some(s => s.startTime === selected.startTime && s.endTime === selected.endTime);
        if (!exists) {
            slotTimes.push({
                startTime: selected.startTime,
                endTime: selected.endTime,
                status: 'booked',
                bufferAfterMinutes: selected.bufferAfterMinutes || 20,
                bufferEndsAt: new Date()
            });
        }
    });

    // Build year → month → date structure
    return [{
        year,
        months: [{
            month,
            monthDates: [{
                monthDate: day,
                slotTime: slotTimes
            }]
        }]
    }];
};

const addTaskAssignController = {
    // GET /api/addtaskassign - list all tasks (flattened from all users)
    getAll: async (req, res, next) => {
        try {
            const docs = await AddTaskAssignModel.find();
            // Flatten tasks from all users
            const allTasks = docs.reduce((acc, doc) => {
                const tasks = (doc.tasks || []).map(task => ({
                    ...task.toObject(),
                    receiverId: doc.receiverId,
                    position: doc.position
                }));
                return acc.concat(tasks);
            }, []);
            res.status(200).json({
                success: true,
                message: 'Tasks retrieved successfully',
                data: allTasks,
                count: allTasks.length
            });
        } catch (error) {
            next(error);
        }
    },

    // GET /api/getTaskAssign/assigner/:assignerId - get all tasks assigned by an assigner
    // Query params: ?status=pending|completed (optional filter)
    //              ?isArchived=true|false (optional filter)
    getByAssignerId: async (req, res, next) => {
        try {
            const { assignerId } = req.params;
            const { status, isArchived } = req.query;

            // Build match conditions for tasks (support legacy 'assignedBy')
            const baseAssignerMatch = {
                $or: [
                    { 'tasks.assignerId': assignerId },
                    { 'tasks.assignedBy': assignerId }
                ]
            };
            const taskMatchConditions = { ...baseAssignerMatch };

            if (status) {
                taskMatchConditions['tasks.taskStatus'] = status;
            }

            if (isArchived !== undefined) {
                taskMatchConditions['tasks.isArchived'] = isArchived === 'true';
            }

            // Use aggregation to find tasks across all user documents
            const docs = await AddTaskAssignModel.aggregate([
                // Match documents that have tasks assigned by this assigner (new or legacy)
                { $match: baseAssignerMatch },
                // Unwind tasks array
                { $unwind: '$tasks' },
                // Match tasks assigned by this user and apply filters
                { $match: taskMatchConditions },
                // Project the fields we need
                {
                    $project: {
                        taskId: '$tasks._id',
                        assignerId: { $ifNull: ['$tasks.assignerId', '$tasks.assignedBy'] },
                        receiverId: { $ifNull: ['$receiverId', '$userId'] },
                        receiverPosition: '$position',
                        taskName: '$tasks.taskName',
                        clientName: '$tasks.clientName',
                        category: '$tasks.category',
                        priority: '$tasks.priority',
                        timeSpend: '$tasks.timeSpend',
                        description: '$tasks.description',
                        taskImages: '$tasks.taskImages',
                        taskStatus: '$tasks.taskStatus',
                        date: '$tasks.date',
                        position: '$tasks.position',
                        slotsBook: '$tasks.slotsBook',
                        chatMeta: '$tasks.chatMeta',
                        isArchived: '$tasks.isArchived',
                        archivedAt: '$tasks.archivedAt',
                        archivedBy: '$tasks.archivedBy',
                        createdAt: '$tasks.createdAt',
                        updatedAt: '$tasks.updatedAt'
                    }
                },
                // Sort by creation date (newest first)
                { $sort: { createdAt: -1 } }
            ]);

            // Emit socket event for assigner task list update
            emitSocketEvent('assigner:tasksUpdated', {
                assignerId,
                tasks: docs,
                count: docs.length
            }, [`assigner:${assignerId}`]);

            res.status(200).json({
                success: true,
                message: `Tasks assigned by ${assignerId} retrieved successfully`,
                data: docs,
                count: docs.length,
                assignerId
            });
        } catch (error) { next(error); }
    },

    // GET /api/getTaskAssign/receiver/:receiverId - get tasks assigned to a receiver
    // Query params: ?status=pending|completed (optional filter)
    //              ?isArchived=true|false (optional filter)
    getByReceiverId: async (req, res, next) => {
        try {
            const { receiverId } = req.params;
            const { status, isArchived } = req.query;

            // Find user document (support legacy 'userId')
            const doc = await AddTaskAssignModel.findOne({ $or: [{ receiverId }, { userId: receiverId }] });
            if (!doc) {
                // Return empty result instead of 404 when no tasks/schedule exists yet
                emitSocketEvent('receiver:tasksUpdated', {
                    receiverId,
                    tasks: [],
                    count: 0
                }, [`receiver:${receiverId}`, `userSlots:${receiverId}`]);
                return res.status(200).json({
                    success: true,
                    message: 'No tasks for receiver',
                    data: { receiverId, tasks: [] },
                    count: 0,
                    receiverId,
                    type: 'receiver'
                });
            }

            // Filter tasks based on query params
            let filteredTasks = doc.tasks || [];

            if (status) {
                filteredTasks = filteredTasks.filter(task => task.taskStatus === status);
            }

            if (isArchived !== undefined) {
                const archivedFilter = isArchived === 'true';
                filteredTasks = filteredTasks.filter(task => task.isArchived === archivedFilter);
            }

            // Emit socket event for receiver task list update
            emitSocketEvent('receiver:tasksUpdated', {
                receiverId,
                tasks: filteredTasks.map(t => t.toObject()),
                count: filteredTasks.length
            }, [`receiver:${receiverId}`, `userSlots:${receiverId}`]);

            res.status(200).json({
                success: true,
                message: 'Tasks retrieved successfully',
                data: {
                    ...doc.toObject(),
                    tasks: filteredTasks
                },
                count: filteredTasks.length,
                receiverId,
                type: 'receiver'
            });
        } catch (error) { next(error); }
    },

    // GET /api/getTaskAssign/:userId - get tasks for a user (legacy endpoint - kept for backward compatibility)
    // Query params: ?type=receiver|assigner (default: receiver)
    //              ?status=pending|completed (optional filter)
    //              ?isArchived=true|false (optional filter)
    getByUserId: async (req, res, next) => {
        try {
            const { userId } = req.params;
            const { type = 'receiver', status, isArchived } = req.query;

            // If type is 'assigner', get tasks assigned BY this user
            if (type === 'assigner') {
                // Build match conditions for tasks (after unwind, fields are directly accessible)
                const taskMatchConditions = { 'tasks.assignerId': userId };

                if (status) {
                    taskMatchConditions['tasks.taskStatus'] = status;
                }

                if (isArchived !== undefined) {
                    taskMatchConditions['tasks.isArchived'] = isArchived === 'true';
                }

                // Use aggregation to find tasks across all user documents
                const docs = await AddTaskAssignModel.aggregate([
                    // Match documents that have tasks assigned by this assigner
                    { $match: { 'tasks.assignerId': userId } },
                    // Unwind tasks array
                    { $unwind: '$tasks' },
                    // Match tasks assigned by this user and apply filters
                    { $match: taskMatchConditions },
                    // Project the fields we need
                    {
                        $project: {
                            taskId: '$tasks._id',
                            assignerId: '$tasks.assignerId',
                            receiverId: '$receiverId',
                            receiverPosition: '$position',
                            taskName: '$tasks.taskName',
                            clientName: '$tasks.clientName',
                            category: '$tasks.category',
                            priority: '$tasks.priority',
                            timeSpend: '$tasks.timeSpend',
                            description: '$tasks.description',
                            taskImages: '$tasks.taskImages',
                            taskStatus: '$tasks.taskStatus',
                            date: '$tasks.date',
                            position: '$tasks.position',
                            slotsBook: '$tasks.slotsBook',
                            chatMeta: '$tasks.chatMeta',
                            isArchived: '$tasks.isArchived',
                            archivedAt: '$tasks.archivedAt',
                            archivedBy: '$tasks.archivedBy',
                            createdAt: '$tasks.createdAt',
                            updatedAt: '$tasks.updatedAt'
                        }
                    },
                    // Sort by creation date (newest first)
                    { $sort: { createdAt: -1 } }
                ]);

                return res.status(200).json({
                    success: true,
                    message: `Tasks assigned by ${userId} retrieved successfully`,
                    data: docs,
                    count: docs.length,
                    userId,
                    type: 'assigner'
                });
            }

            // Default: Get tasks assigned TO this user (receiver)
            let query = { receiverId: userId };

            // Build filter for tasks if status or isArchived is provided
            if (status || isArchived !== undefined) {
                const doc = await AddTaskAssignModel.findOne({ receiverId: userId });
                if (!doc) {
                    return res.status(200).json({
                        success: true,
                        message: 'No tasks for receiver',
                        data: { receiverId: userId, tasks: [] },
                        count: 0,
                        receiverId: userId,
                        type: 'receiver'
                    });
                }

                // Filter tasks based on query params
                let filteredTasks = doc.tasks || [];

                if (status) {
                    filteredTasks = filteredTasks.filter(task => task.taskStatus === status);
                }

                if (isArchived !== undefined) {
                    const archivedFilter = isArchived === 'true';
                    filteredTasks = filteredTasks.filter(task => task.isArchived === archivedFilter);
                }

                return res.status(200).json({
                    success: true,
                    message: 'Tasks retrieved successfully',
                    data: {
                        ...doc.toObject(),
                        tasks: filteredTasks
                    },
                    count: filteredTasks.length,
                    receiverId: userId,
                    type: 'receiver'
                });
            }

            // No filters, return all tasks for this user
            const doc = await AddTaskAssignModel.findOne({ receiverId: userId });
            if (!doc) {
                return res.status(200).json({
                    success: true,
                    message: 'No tasks for receiver',
                    data: { receiverId: userId, tasks: [] },
                    count: 0,
                    receiverId: userId,
                    type: 'receiver'
                });
            }

            res.status(200).json({
                success: true,
                message: 'Tasks retrieved successfully',
                data: doc,
                count: doc.tasks ? doc.tasks.length : 0,
                receiverId: userId,
                type: 'receiver'
            });
        } catch (error) { next(error); }
    },

    // GET /api/getTaskAssign/:userId/slots-availability?date=2025-11-05&position=Graphics%20Designer
    // Get available (free/booked) slots for a user on a specific date
    getUserSlotsAvailability: async (req, res, next) => {
        try {
            const { userId } = req.params;
            const { date, position } = req.query;

            if (!date) {
                return res.status(400).json({ success: false, message: 'date query parameter is required (format: YYYY-MM-DD)' });
            }

            // Parse date
            const dateParts = date.split('-');
            if (dateParts.length !== 3) {
                return res.status(400).json({ success: false, message: 'Invalid date format. Use YYYY-MM-DD' });
            }
            const year = parseInt(dateParts[0]);
            const month = parseInt(dateParts[1]);
            const day = parseInt(dateParts[2]);

            // Find user document (support legacy 'userId')
            const doc = await AddTaskAssignModel.findOne({ $or: [{ receiverId: userId }, { userId }] });

            // Get user's position (from doc or query param)
            const userPosition = position || doc?.position || 'Graphics Designer';

            // Generate default slot template for this position
            const defaultSlots = await generateSlotTemplate(userPosition);

            // Find booked slots from all tasks for this date
            const bookedSlots = new Set();
            if (doc && doc.tasks) {
                doc.tasks.forEach(task => {
                    if (task.slotsBook && Array.isArray(task.slotsBook)) {
                        task.slotsBook.forEach(yearObj => {
                            if (yearObj.year === year) {
                                yearObj.months?.forEach(monthObj => {
                                    if (monthObj.month === month) {
                                        monthObj.monthDates?.forEach(dateObj => {
                                            if (dateObj.monthDate === day) {
                                                dateObj.slotTime?.forEach(slot => {
                                                    if (slot.status === 'booked' || slot.status === 'completed') {
                                                        bookedSlots.add(`${slot.startTime}-${slot.endTime}`);
                                                    }
                                                });
                                            }
                                        });
                                    }
                                });
                            }
                        });
                    }
                });
            }

            // Combine default slots with booked status
            const slotsWithStatus = defaultSlots.map(slot => {
                const slotKey = `${slot.startTime}-${slot.endTime}`;
                const isBooked = bookedSlots.has(slotKey);
                return {
                    startTime: slot.startTime,
                    endTime: slot.endTime,
                    status: isBooked ? 'booked' : 'free',
                    bufferAfterMinutes: slot.bufferAfterMinutes
                };
            });

            res.status(200).json({
                success: true,
                message: 'User slots availability retrieved',
                data: {
                    receiverId: userId,
                    date,
                    position: userPosition,
                    slots: slotsWithStatus,
                    freeSlots: slotsWithStatus.filter(s => s.status === 'free'),
                    bookedSlots: slotsWithStatus.filter(s => s.status === 'booked')
                }
            });
        } catch (error) {
            next(error);
        }
    },

    // POST /api/addtaskassign - create a task (assign to receiver user)
    create: async (req, res, next) => {
        try {
            const {
                userId,         // original field name (task creator/sender)
                receiverUserId, // execution user id (alternative to userId)
                position,
                assignedBy,     // assigner user id
                taskName,
                clientName,
                category,
                priority,
                timeSpend,
                description,
                taskImages,
                date,
                slots,          // original field name (deprecated, use taskSlotsTimes)
                taskSlots,      // deprecated, use taskSlotsTimes
                taskSlotsTimes  // [{ startTime, endTime, status, bufferAfterMinutes }] - selected slots to book
            } = req.body;

            // Support both old format (userId/receiverUserId) and new format
            const executionUserId = receiverUserId || userId;
            const assignerId = assignedBy || userId;

            if (!executionUserId || !taskName) {
                return res.status(400).json({ success: false, message: 'receiverUserId (or userId) and taskName are required' });
            }

            if (!date) {
                return res.status(400).json({ success: false, message: 'date is required (format: YYYY-MM-DD)' });
            }

            // Selected slots to mark as booked (if provided)
            const selectedSlots = Array.isArray(taskSlotsTimes) ? taskSlotsTimes : [];

            // Generate default slots and organize by year/month/date
            // Use position first, fallback to category, then default
            const slotPosition = position || category || 'Graphics Designer';
            const slotsBook = await organizeSlotsByDate(date, selectedSlots, slotPosition, category);

            // Upsert logic
            let doc = await AddTaskAssignModel.findOne({ receiverId: executionUserId });
            if (!doc) {
                doc = new AddTaskAssignModel({
                    receiverId: executionUserId,
                    position: position || undefined,
                    tasks: []
                });
            }

            doc.tasks.push({
                assignerId: assignerId,
                taskName,
                clientName,
                category,
                priority,
                timeSpend,
                description,
                taskImages: Array.isArray(taskImages) ? taskImages : [],
                taskStatus: 'pending',
                date,
                position,
                slotsBook,
                chatMeta: { lastMessage: null, lastMessageAt: null, chatCount: 0 },
                isArchived: false
            });

            await doc.save();

            // Get the newly created task
            const newTask = doc.tasks[doc.tasks.length - 1];

            // Emit socket event for task creation
            emitSocketEvent('task:created', {
                taskId: String(newTask._id),
                receiverId: executionUserId,
                assignerId: assignerId,
                task: newTask.toObject(),
                userDoc: doc.toObject()
            }, [
                `user:${executionUserId}`,
                `user:${assignerId}`,
                `userSlots:${executionUserId}`,
                `assigner:${assignerId}`,
                `receiver:${executionUserId}`,
                String(newTask._id)
            ]);

            res.status(201).json({ success: true, message: 'Task created successfully', data: doc });
        } catch (error) { next(error); }
    },

    // GET /api/getTaskAssign/slot-templates?position=Graphics%20Designer
    slotTemplates: async (req, res, next) => {
        try {
            const { position } = req.query;
            const slots = await generateSlotTemplate(position || 'Graphics Designer');
            res.status(200).json({ success: true, data: { position: position || 'Graphics Designer', slots } });
        } catch (error) { next(error); }
    },

    // GET /api/getTaskAssign/slot-config - get current slot configuration
    getSlotConfig: async (req, res, next) => {
        try {
            const cfg = await getSlotConfig();
            res.status(200).json({
                success: true,
                data: {
                    officeStartHour: cfg.officeStartHour,
                    officeEndHour: cfg.officeEndHour,
                    lunchStartHour: cfg.lunchStartHour,
                    lunchStartMinutes: cfg.lunchStartMinutes,
                    lunchEndHour: cfg.lunchEndHour,
                    lunchEndMinutes: cfg.lunchEndMinutes,
                    graphics: cfg.graphics,
                    video: cfg.video,
                    positions: cfg.positions ? Object.fromEntries(cfg.positions) : {}
                }
            });
        } catch (error) { next(error); }
    },

    // PUT /api/getTaskAssign/slot-config - update slot configuration
    updateSlotConfig: async (req, res, next) => {
        try {
            const { officeStartHour, officeEndHour, lunchStartHour, lunchStartMinutes, lunchEndHour, lunchEndMinutes, graphics, video, positions } = req.body;
            const cfg = await SlotConfigModel.getSingleton();

            if (officeStartHour !== undefined) cfg.officeStartHour = officeStartHour;
            if (officeEndHour !== undefined) cfg.officeEndHour = officeEndHour;
            if (lunchStartHour !== undefined) cfg.lunchStartHour = lunchStartHour;
            if (lunchStartMinutes !== undefined) cfg.lunchStartMinutes = lunchStartMinutes;
            if (lunchEndHour !== undefined) cfg.lunchEndHour = lunchEndHour;
            if (lunchEndMinutes !== undefined) cfg.lunchEndMinutes = lunchEndMinutes;
            if (graphics) cfg.graphics = graphics;
            if (video) cfg.video = video;
            if (positions) {
                // Convert object to Map if needed
                if (cfg.positions && typeof cfg.positions.set === 'function') {
                    Object.entries(positions).forEach(([key, value]) => {
                        cfg.positions.set(key.toLowerCase(), value);
                    });
                } else {
                    cfg.positions = new Map(Object.entries(positions).map(([k, v]) => [k.toLowerCase(), v]));
                }
            }

            await cfg.save();

            const configData = {
                officeStartHour: cfg.officeStartHour,
                officeEndHour: cfg.officeEndHour,
                lunchStartHour: cfg.lunchStartHour,
                lunchStartMinutes: cfg.lunchStartMinutes,
                lunchEndHour: cfg.lunchEndHour,
                lunchEndMinutes: cfg.lunchEndMinutes,
                graphics: cfg.graphics,
                video: cfg.video,
                positions: cfg.positions ? Object.fromEntries(cfg.positions) : {}
            };

            // Emit socket event for slot config update
            emitSocketEvent('slotConfig:updated', configData, []);

            res.status(200).json({
                success: true,
                message: 'Slot configuration updated',
                data: configData
            });
        } catch (error) { next(error); }
    },


    // GET /api/addtaskassign/:taskId/slots - list slots for a task (year/month/date structure)
    // Optional query params: ?year=2025&month=11&date=5
    getSlots: async (req, res, next) => {
        try {
            const { taskId } = req.params;
            const { year, month, date } = req.query;
            const result = await findTaskById(taskId);
            if (!result) return res.status(404).json({ success: false, message: 'Task not found' });

            let slotsBook = result.task.slotsBook || [];

            // Filter by year/month/date if provided
            if (year) {
                slotsBook = slotsBook.filter(y => y.year === parseInt(year));
                if (month) {
                    slotsBook = slotsBook.map(y => ({
                        ...y,
                        months: y.months.filter(m => m.month === parseInt(month))
                    }));
                    if (date) {
                        slotsBook = slotsBook.map(y => ({
                            ...y,
                            months: y.months.map(m => ({
                                ...m,
                                monthDates: m.monthDates.filter(d => d.monthDate === parseInt(date))
                            }))
                        }));
                    }
                }
            }

            res.status(200).json({ success: true, data: slotsBook });
        } catch (error) { next(error); }
    },

    // POST /api/addtaskassign/:taskId/slots - add a slot to specific date
    // Body: { year, month, date, startTime, endTime, status, bufferAfterMinutes }
    addSlot: async (req, res, next) => {
        try {
            const { taskId } = req.params;
            const { year, month, date, startTime, endTime, status = 'booked', bufferAfterMinutes = 20 } = req.body;

            if (!year || !month || !date || !startTime || !endTime) {
                return res.status(400).json({ success: false, message: 'year, month, date, startTime, endTime are required' });
            }

            const result = await findTaskById(taskId);
            if (!result) return res.status(404).json({ success: false, message: 'Task not found' });

            let slotsBook = result.task.slotsBook || [];

            // Find or create year
            let yearObj = slotsBook.find(y => y.year === parseInt(year));
            if (!yearObj) {
                yearObj = { year: parseInt(year), months: [] };
                slotsBook.push(yearObj);
            }

            // Find or create month
            let monthObj = yearObj.months.find(m => m.month === parseInt(month));
            if (!monthObj) {
                monthObj = { month: parseInt(month), monthDates: [] };
                yearObj.months.push(monthObj);
            }

            // Find or create date
            let dateObj = monthObj.monthDates.find(d => d.monthDate === parseInt(date));
            if (!dateObj) {
                dateObj = { monthDate: parseInt(date), slotTime: [] };
                monthObj.monthDates.push(dateObj);
            }

            // Add slot time
            dateObj.slotTime.push({
                startTime,
                endTime,
                status,
                bufferAfterMinutes,
                bufferEndsAt: status === 'booked' ? new Date() : undefined
            });

            await result.doc.save();

            // Emit socket event for slot addition
            emitSocketEvent('slot:added', {
                taskId: String(result.task._id),
                receiverId: result.doc.receiverId,
                assignerId: result.task.assignerId,
                slot: {
                    year: parseInt(year),
                    month: parseInt(month),
                    date: parseInt(date),
                    startTime,
                    endTime,
                    status,
                    bufferAfterMinutes
                },
                task: result.task.toObject()
            }, [
                `user:${result.doc.receiverId}`,
                `userSlots:${result.doc.receiverId}`,
                `assigner:${result.task.assignerId}`,
                `receiver:${result.doc.receiverId}`,
                String(result.task._id)
            ]);

            res.status(201).json({ success: true, message: 'Slot added', data: result.task.slotsBook });
        } catch (error) { next(error); }
    },

    // PUT /api/addtaskassign/:taskId/slots/:slotId/status - update slot status
    updateSlotStatus: async (req, res, next) => {
        try {
            const { taskId, slotId } = req.params;
            const { status } = req.body; // 'free' | 'booked' | 'completed' | 'canceled'
            if (!['free', 'booked', 'completed', 'canceled'].includes(status)) {
                return res.status(400).json({ success: false, message: 'Invalid slot status' });
            }
            const result = await findTaskById(taskId);
            if (!result) return res.status(404).json({ success: false, message: 'Task not found' });

            // Search through year → month → date → slotTime to find the slot
            let foundSlot = null;
            const slotsBook = result.task.slotsBook || [];

            for (const yearObj of slotsBook) {
                for (const monthObj of yearObj.months) {
                    for (const dateObj of monthObj.monthDates) {
                        const slot = dateObj.slotTime.id(slotId);
                        if (slot) {
                            foundSlot = slot;
                            break;
                        }
                    }
                    if (foundSlot) break;
                }
                if (foundSlot) break;
            }

            if (!foundSlot) return res.status(404).json({ success: false, message: 'Slot not found' });

            foundSlot.status = status;
            if (status === 'completed') {
                foundSlot.bufferEndsAt = new Date();
            } else if (status === 'booked') {
                foundSlot.bufferEndsAt = new Date();
            } else {
                foundSlot.bufferEndsAt = undefined;
            }

            await result.doc.save();

            // Emit socket event for slot status update
            emitSocketEvent('slot:statusUpdated', {
                taskId: String(result.task._id),
                receiverId: result.doc.receiverId,
                assignerId: result.task.assignerId,
                slotId: String(slotId),
                status,
                slot: foundSlot.toObject(),
                task: result.task.toObject()
            }, [
                `user:${result.doc.receiverId}`,
                `userSlots:${result.doc.receiverId}`,
                `assigner:${result.task.assignerId}`,
                `receiver:${result.doc.receiverId}`,
                String(result.task._id)
            ]);

            res.status(200).json({ success: true, message: 'Slot status updated', data: result.task.slotsBook });
        } catch (error) { next(error); }
    },

    // PUT /api/addtaskassign/:taskId/status - update task status
    updateStatus: async (req, res, next) => {
        try {
            const { taskId } = req.params;
            const { taskStatus, receiverId: bodyReceiverId, assignerId: bodyAssignerId } = req.body;
            if (!taskStatus || !['pending', 'completed'].includes(taskStatus)) {
                return res.status(400).json({ success: false, message: 'Invalid status. Must be "pending" or "completed"' });
            }
            const result = await findTaskById(taskId);
            if (!result) return res.status(404).json({ success: false, message: 'Task not found' });

            // Backfill missing required identifiers for legacy docs before save
            // receiverId at root
            if (!result.doc.receiverId) {
                // Prefer body value, else legacy userId
                if (bodyReceiverId) {
                    result.doc.receiverId = bodyReceiverId;
                } else if (result.doc.userId) {
                    result.doc.receiverId = result.doc.userId;
                }
            }
            // assignerId on the task
            if (!result.task.assignerId) {
                if (bodyAssignerId) {
                    result.task.assignerId = bodyAssignerId;
                } else if (result.task.assignedBy) {
                    result.task.assignerId = result.task.assignedBy;
                }
            }
            result.task.taskStatus = taskStatus;
            await result.doc.save();

            // Emit socket event for task status update
            emitSocketEvent('task:statusUpdated', {
                taskId: String(result.task._id),
                receiverId: result.doc.receiverId,
                assignerId: result.task.assignerId,
                taskStatus,
                task: result.task.toObject()
            }, [
                `user:${result.doc.receiverId}`,
                `userSlots:${result.doc.receiverId}`,
                `assigner:${result.task.assignerId}`,
                `receiver:${result.doc.receiverId}`,
                String(result.task._id)
            ]);

            res.status(200).json({ success: true, message: `Task status updated to ${taskStatus}`, data: result.task });
        } catch (error) { next(error); }
    },

    // PUT /api/addtaskassign/:taskId/archive - archive task
    archive: async (req, res, next) => {
        try {
            const { taskId } = req.params;
            const { actorUserId } = req.body;
            const result = await findTaskById(taskId);
            if (!result) return res.status(404).json({ success: false, message: 'Task not found' });
            result.task.isArchived = true;
            result.task.archivedAt = new Date();
            result.task.archivedBy = actorUserId || undefined;
            await result.doc.save();

            // Emit socket event for task archive
            emitSocketEvent('task:archived', {
                taskId: String(result.task._id),
                receiverId: result.doc.receiverId,
                assignerId: result.task.assignerId,
                archivedBy: actorUserId,
                task: result.task.toObject()
            }, [
                `user:${result.doc.receiverId}`,
                `userSlots:${result.doc.receiverId}`,
                `assigner:${result.task.assignerId}`,
                `receiver:${result.doc.receiverId}`,
                String(result.task._id)
            ]);

            res.status(200).json({ success: true, message: 'Task archived', data: result.task });
        } catch (error) { next(error); }
    },

    // PUT /api/addtaskassign/:taskId/unarchive - unarchive task
    unarchive: async (req, res, next) => {
        try {
            const { taskId } = req.params;
            const result = await findTaskById(taskId);
            if (!result) return res.status(404).json({ success: false, message: 'Task not found' });
            result.task.isArchived = false;
            await result.doc.save();

            // Emit socket event for task unarchive
            emitSocketEvent('task:unarchived', {
                taskId: String(result.task._id),
                receiverId: result.doc.receiverId,
                assignerId: result.task.assignerId,
                task: result.task.toObject()
            }, [
                `user:${result.doc.receiverId}`,
                `userSlots:${result.doc.receiverId}`,
                `assigner:${result.task.assignerId}`,
                `receiver:${result.doc.receiverId}`,
                String(result.task._id)
            ]);

            res.status(200).json({ success: true, message: 'Task unarchived', data: result.task });
        } catch (error) { next(error); }
    },

    // GET /api/getTaskAssign/archived - list archived tasks across users (optional receiverId filter)
    getArchived: async (req, res, next) => {
        try {
            const { userId, receiverId } = req.query;
            const matchUserId = receiverId || userId;
            const match = matchUserId ? { receiverId: matchUserId } : {};
            const docs = await AddTaskAssignModel.aggregate([
                { $match: match },
                { $project: { receiverId: 1, tasks: { $filter: { input: '$tasks', as: 't', cond: { $eq: ['$$t.isArchived', true] } } } } }
            ]);
            res.status(200).json({ success: true, message: 'Archived tasks retrieved', data: docs });
        } catch (error) { next(error); }
    },

    // POST /api/addtaskassign/:taskId/chat - append chat message
    addChatMessage: async (req, res, next) => {
        try {
            const { taskId } = req.params;
            const { userId, user, time, message } = req.body;
            const result = await findTaskById(taskId);
            if (!result) return res.status(404).json({ success: false, message: 'Task not found' });
            result.task.chatMeta.lastMessage = message || result.task.chatMeta.lastMessage;
            result.task.chatMeta.lastMessageAt = new Date();
            result.task.chatMeta.chatCount = (result.task.chatMeta.chatCount || 0) + 1;
            await result.doc.save();

            // Emit socket event for chat message
            emitSocketEvent('task:chatMessage', {
                taskId: String(result.task._id),
                receiverId: result.doc.receiverId,
                assignerId: result.task.assignerId,
                messageUserId: userId,
                messageUser: user,
                message,
                time,
                chatMeta: result.task.chatMeta.toObject(),
                task: result.task.toObject()
            }, [
                `user:${result.doc.receiverId}`,
                `userSlots:${result.doc.receiverId}`,
                `assigner:${result.task.assignerId}`,
                `receiver:${result.doc.receiverId}`,
                String(result.task._id)
            ]);

            res.status(200).json({ success: true, message: 'Chat message added', data: result.task });
        } catch (error) { next(error); }
    }
};

module.exports = addTaskAssignController;


