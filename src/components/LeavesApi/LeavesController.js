const UserLeavesModel = require('./LeavesSchema/LeavesSchema');
const { getIO } = require('../../utils/socket');
const { invalidateCache } = require('../../middleware/redisCache');

// Helper: generate all dates between start and end
const getAllDatesInRange = (startDate, endDate) => {
    const dates = [];
    const start = new Date(startDate);
    const end = new Date(endDate);
    const current = new Date(start);
    while (current <= end) {
        dates.push(new Date(current));
        current.setDate(current.getDate() + 1);
    }
    return dates;
};

const leavesController = {
    // POST /api/leave/request - Submit leave entries for a month
    request: async (req, res, next) => {
        try {
            const { userId, month, leaves, reason } = req.body;
            if (!userId || !month || !Array.isArray(leaves) || leaves.length === 0) {
                return res.status(400).json({ success: false, message: 'userId, month, and non-empty leaves array are required' });
            }
            const monthUpper = month.toUpperCase();
            const leaveEntries = leaves.map(l => ({
                startDate: new Date(l.startDate),
                endDate: new Date(l.endDate),
                status: 'pending',
                history: [{ status: 'pending', at: new Date(), by: userId }]
            }));

            const doc = await UserLeavesModel.findOne({ userId });
            if (!doc) {
                const newDoc = new UserLeavesModel({
                    userId,
                    months: [{ month: monthUpper, reason, leaves: leaveEntries }]
                });
                const saved = await newDoc.save();

                // Invalidate cache
                await invalidateCache('cache:*leave*');

                try {
                    const io = getIO && getIO();
                    if (io) {
                        const payload = { 
                            userId, 
                            month: monthUpper, 
                            reason, 
                            leaves: leaveEntries, 
                            doc: saved,
                            playSound: true,
                            notificationType: 'leave_requested',
                            notificationMessage: 'New leave request submitted'
                        };
                        io.emit('leave:requested', payload);
                        io.to(`user:${userId}`).emit('leave:requested', payload);
                        io.to('analytics').emit('leave:requested', payload);
                    }
                } catch (_) { }
                return res.status(201).json({ success: true, data: saved });
            }

            const monthEntry = doc.months.find(m => m.month === monthUpper);
            if (monthEntry) {
                // Check for overlapping dates
                for (const newLeave of leaveEntries) {
                    for (const existingLeave of monthEntry.leaves) {
                        const newStart = newLeave.startDate.getTime();
                        const newEnd = newLeave.endDate.getTime();
                        const existStart = existingLeave.startDate.getTime();
                        const existEnd = existingLeave.endDate.getTime();
                        // Check if dates overlap
                        if ((newStart >= existStart && newStart <= existEnd) || (newEnd >= existStart && newEnd <= existEnd) || (newStart <= existStart && newEnd >= existEnd)) {
                            return res.status(400).json({
                                success: false,
                                message: `Leave dates already exist. Overlap: ${new Date(newStart).toISOString().split('T')[0]} to ${new Date(newEnd).toISOString().split('T')[0]}`
                            });
                        }
                    }
                }
                monthEntry.leaves.push(...leaveEntries);
            } else {
                doc.months.push({ month: monthUpper, reason, leaves: leaveEntries });
            }
            const saved = await doc.save();

            // Invalidate cache
            await invalidateCache('cache:*leave*');

            try {
                const io = getIO && getIO();
                if (io) {
                    const payload = { userId, month: monthUpper, reason, leaves: leaveEntries, doc: saved };
                    io.emit('leave:requested', payload);
                    io.to(`user:${userId}`).emit('leave:requested', payload);
                    io.to('analytics').emit('leave:requested', payload);
                }
            } catch (_) { }

            res.status(201).json({ success: true, data: saved });
        } catch (error) { next(error); }
    },

    // GET /api/leave/get/:userId/:month - Get leaves for specific month
    getByMonth: async (req, res, next) => {
        try {
            const { userId, month } = req.params;
            if (!userId || !month) return res.status(400).json({ success: false, message: 'userId and month are required' });
            const monthUpper = month.toUpperCase();
            const doc = await UserLeavesModel.findOne({ userId });
            if (!doc) return res.status(200).json({ success: true, data: [] });
            const monthEntry = doc.months.find(m => m.month === monthUpper);
            res.status(200).json({ success: true, data: monthEntry ? monthEntry.leaves : [] });
        } catch (error) { next(error); }
    },

    // GET /api/leave/getAll/:userId - Get all leaves across all months
    getAll: async (req, res, next) => {
        try {
            const { userId } = req.params;
            if (!userId) return res.status(400).json({ success: false, message: 'userId is required' });
            const doc = await UserLeavesModel.findOne({ userId });
            res.status(200).json({ success: true, data: doc || { userId, months: [] } });
        } catch (error) { next(error); }
    },

    // GET /api/leave/getAllLeaves - Get all leaves from all users (HR/Admin view)
    getAllLeaves: async (req, res, next) => {
        try {
            const docs = await UserLeavesModel.find({}).sort({ createdAt: -1 });
            res.status(200).json({ success: true, data: docs, count: docs.length });
        } catch (error) { next(error); }
    },

    // POST /api/leave/approve/:userId/:month/:leaveId
    approve: async (req, res, next) => {
        try {
            const { userId, month, leaveId } = req.params;
            const { approverId, instructions, approvedDates, rejectedDates } = req.body;
            if (!userId || !month || !leaveId || !approverId) {
                return res.status(400).json({ success: false, message: 'userId, month, leaveId, and approverId are required' });
            }
            const monthUpper = month.toUpperCase();
            const doc = await UserLeavesModel.findOne({ userId });
            if (!doc) return res.status(404).json({ success: false, message: 'User not found' });
            const monthEntry = doc.months.find(m => m.month === monthUpper);
            if (!monthEntry) return res.status(404).json({ success: false, message: 'Month not found' });
            const leave = monthEntry.leaves.id(leaveId);
            if (!leave) return res.status(404).json({ success: false, message: 'Leave not found' });

            const allRequestedDates = getAllDatesInRange(leave.startDate, leave.endDate);

            if (Array.isArray(approvedDates)) {
                const approved = approvedDates.map(d => new Date(d));
                const rejected = Array.isArray(rejectedDates)
                    ? rejectedDates.map(d => new Date(d))
                    : allRequestedDates.filter(d => !approved.some(ad => ad.getTime() === d.getTime()));

                // Validate dates are within range
                for (const ad of approved) {
                    if (ad < leave.startDate || ad > leave.endDate) {
                        return res.status(400).json({ success: false, message: 'Approved dates must be within leave range' });
                    }
                }
                for (const rd of rejected) {
                    if (rd < leave.startDate || rd > leave.endDate) {
                        return res.status(400).json({ success: false, message: 'Rejected dates must be within leave range' });
                    }
                }

                leave.approvedDates = approved;
                leave.rejectedDates = rejected;

                // Determine status
                if (approved.length === 0) {
                    leave.status = 'rejected';
                } else if (approved.length < allRequestedDates.length) {
                    leave.status = 'partially_approved';
                } else {
                    leave.status = 'approved';
                }
            } else {
                // No dates specified - approve all
                leave.status = 'approved';
                leave.approvedDates = allRequestedDates;
                leave.rejectedDates = [];
            }

            if (instructions !== undefined) leave.instructions = instructions;
            leave.history.push({
                status: leave.status,
                at: new Date(),
                by: approverId,
                note: instructions,
                approvedDates: leave.approvedDates,
                rejectedDates: leave.rejectedDates
            });
            leave.updatedAt = new Date();
            await doc.save();

            // Invalidate cache
            await invalidateCache('cache:*leave*');

            try {
                const io = getIO && getIO();
                if (io) {
                    const payload = {
                        userId,
                        month: monthUpper,
                        leaveId,
                        status: leave.status,
                        approvedDates: leave.approvedDates,
                        rejectedDates: leave.rejectedDates,
                        leave,
                        playSound: true,
                        notificationType: 'leave_updated',
                        notificationMessage: `Leave request ${leave.status}`
                    };
                    io.emit('leave:updated', payload);
                    io.to(`user:${userId}`).emit('leave:updated', payload);
                    io.to('analytics').emit('leave:updated', payload);
                }
            } catch (_) { }

            res.status(200).json({ success: true, data: leave });
        } catch (error) { next(error); }
    },

    // POST /api/leave/reject/:userId/:month/:leaveId
    reject: async (req, res, next) => {
        try {
            const { userId, month, leaveId } = req.params;
            const { approverId, instructions, rejectedDates } = req.body;
            if (!userId || !month || !leaveId || !approverId) {
                return res.status(400).json({ success: false, message: 'userId, month, leaveId, and approverId are required' });
            }
            const monthUpper = month.toUpperCase();
            const doc = await UserLeavesModel.findOne({ userId });
            if (!doc) return res.status(404).json({ success: false, message: 'User not found' });
            const monthEntry = doc.months.find(m => m.month === monthUpper);
            if (!monthEntry) return res.status(404).json({ success: false, message: 'Month not found' });
            const leave = monthEntry.leaves.id(leaveId);
            if (!leave) return res.status(404).json({ success: false, message: 'Leave not found' });

            const allRequestedDates = getAllDatesInRange(leave.startDate, leave.endDate);

            if (Array.isArray(rejectedDates)) {
                const rejected = rejectedDates.map(d => new Date(d));
                const approved = allRequestedDates.filter(d => !rejected.some(rd => rd.getTime() === d.getTime()));

                // Validate dates are within range
                for (const rd of rejected) {
                    if (rd < leave.startDate || rd > leave.endDate) {
                        return res.status(400).json({ success: false, message: 'Rejected dates must be within leave range' });
                    }
                }

                leave.rejectedDates = rejected;
                leave.approvedDates = approved;

                // Determine status
                if (rejected.length === 0) {
                    leave.status = 'approved';
                } else if (rejected.length < allRequestedDates.length) {
                    leave.status = 'partially_approved';
                } else {
                    leave.status = 'rejected';
                }
            } else {
                // No dates specified - reject all
                leave.status = 'rejected';
                leave.rejectedDates = allRequestedDates;
                leave.approvedDates = [];
            }

            if (instructions !== undefined) leave.instructions = instructions;
            leave.history.push({
                status: leave.status,
                at: new Date(),
                by: approverId,
                note: instructions,
                approvedDates: leave.approvedDates,
                rejectedDates: leave.rejectedDates
            });
            leave.updatedAt = new Date();
            await doc.save();

            // Invalidate cache
            await invalidateCache('cache:*leave*');

            try {
                const io = getIO && getIO();
                if (io) {
                    const payload = {
                        userId,
                        month: monthUpper,
                        leaveId,
                        status: leave.status,
                        approvedDates: leave.approvedDates,
                        rejectedDates: leave.rejectedDates,
                        leave,
                        playSound: true,
                        notificationType: 'leave_updated',
                        notificationMessage: `Leave request ${leave.status}`
                    };
                    io.emit('leave:updated', payload);
                    io.to(`user:${userId}`).emit('leave:updated', payload);
                    io.to('analytics').emit('leave:updated', payload);
                }
            } catch (_) { }

            res.status(200).json({ success: true, data: leave });
        } catch (error) { next(error); }
    },

    // POST /api/leave/updateBatch
    updateBatch: async (req, res, next) => {
        try {
            const { userId, month, updates, approverId } = req.body;
            if (!userId || !month || !Array.isArray(updates) || !approverId) {
                return res.status(400).json({ success: false, message: 'userId, month, updates array, and approverId are required' });
            }

            const monthUpper = month.toUpperCase();
            const doc = await UserLeavesModel.findOne({ userId });
            if (!doc) return res.status(404).json({ success: false, message: 'User not found' });
            const monthEntry = doc.months.find(m => m.month === monthUpper);
            if (!monthEntry) return res.status(404).json({ success: false, message: 'Month not found' });

            const results = [];

            for (const update of updates) {
                const { leaveId, action, approvedDates, rejectedDates, instructions } = update;
                const leave = monthEntry.leaves.id(leaveId);
                if (!leave) continue;

                const allRequestedDates = getAllDatesInRange(leave.startDate, leave.endDate);

                if (action === 'approve') {
                    if (Array.isArray(approvedDates)) {
                        const approved = approvedDates.map(d => new Date(d));
                        const rejected = Array.isArray(rejectedDates)
                            ? rejectedDates.map(d => new Date(d))
                            : allRequestedDates.filter(d => !approved.some(ad => ad.getTime() === d.getTime()));

                        leave.approvedDates = approved;
                        leave.rejectedDates = rejected;
                        if (approved.length === 0) leave.status = 'rejected';
                        else if (approved.length < allRequestedDates.length) leave.status = 'partially_approved';
                        else leave.status = 'approved';
                    } else {
                        leave.status = 'approved';
                        leave.approvedDates = allRequestedDates;
                        leave.rejectedDates = [];
                    }
                } else if (action === 'reject') {
                    if (Array.isArray(rejectedDates)) {
                        const rejected = rejectedDates.map(d => new Date(d));
                        const approved = allRequestedDates.filter(d => !rejected.some(rd => rd.getTime() === d.getTime()));
                        leave.rejectedDates = rejected;
                        leave.approvedDates = approved;
                        if (rejected.length === 0) leave.status = 'approved';
                        else if (rejected.length < allRequestedDates.length) leave.status = 'partially_approved';
                        else leave.status = 'rejected';
                    } else {
                        leave.status = 'rejected';
                        leave.rejectedDates = allRequestedDates;
                        leave.approvedDates = [];
                    }
                }

                if (instructions !== undefined) leave.instructions = instructions;
                leave.history.push({
                    status: leave.status,
                    at: new Date(),
                    by: approverId,
                    note: instructions,
                    approvedDates: leave.approvedDates,
                    rejectedDates: leave.rejectedDates
                });
                leave.updatedAt = new Date();
                results.push(leave);
            }

            await doc.save();

            // Invalidate cache
            await invalidateCache('cache:*leave*');

            // Emit sockets for each updated leave
            try {
                const io = getIO && getIO();
                if (io) {
                    for (const leave of results) {
                        const payload = {
                            userId,
                            month: monthUpper,
                            leaveId: leave._id,
                            status: leave.status,
                            approvedDates: leave.approvedDates,
                            rejectedDates: leave.rejectedDates,
                            leave
                        };
                        io.emit('leave:updated', payload);
                        io.to(`user:${userId}`).emit('leave:updated', payload);
                        io.to('analytics').emit('leave:updated', payload);
                    }
                }
            } catch (_) { }

            res.status(200).json({ success: true, data: results });
        } catch (error) { next(error); }
    },

    // DELETE /api/leave/delete/:userId/:month/:leaveId
    deleteLeave: async (req, res, next) => {
        try {
            const { userId, month, leaveId } = req.params;
            if (!userId || !month || !leaveId) {
                return res.status(400).json({ success: false, message: 'userId, month, and leaveId are required' });
            }
            const monthUpper = month.toUpperCase();
            const doc = await UserLeavesModel.findOne({ userId });
            if (!doc) return res.status(404).json({ success: false, message: 'User not found' });
            const monthEntry = doc.months.find(m => m.month === monthUpper);
            if (!monthEntry) return res.status(404).json({ success: false, message: 'Month not found' });
            const leave = monthEntry.leaves.id(leaveId);
            if (!leave) return res.status(404).json({ success: false, message: 'Leave not found' });
            if (leave.status === 'approved') {
                return res.status(400).json({ success: false, message: 'Cannot delete approved leave' });
            }
            leave.status = 'cancelled';
            leave.history.push({ status: 'cancelled', at: new Date(), by: userId });
            leave.updatedAt = new Date();
            await doc.save();

            // Invalidate cache
            await invalidateCache('cache:*leave*');

            try {
                const io = getIO && getIO();
                if (io) {
                    const payload = { userId, month: monthUpper, leaveId, status: 'cancelled' };
                    io.emit('leave:deleted', payload);
                    io.to(`user:${userId}`).emit('leave:deleted', payload);
                    io.to('analytics').emit('leave:deleted', payload);
                }
            } catch (_) { }

            res.status(200).json({ success: true, data: leave });
        } catch (error) { next(error); }
    }
};

module.exports = leavesController;