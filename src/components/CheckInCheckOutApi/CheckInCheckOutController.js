const CheckInCheckOutModel = require('./CheckInCheckOutSchema/CheckInCheckOutSchema');
const { getIO } = require('../../utils/socket');

const checkInCheckOutController = {
    // POST /api/checkin - Check in for the day
    checkIn: async (req, res, next) => {
        try {
            const { userId, checkInReason, reason, status } = req.body;

            if (!userId) {
                return res.status(400).json({
                    success: false,
                    message: 'userId is required'
                });
            }

            const today = new Date().toISOString().split('T')[0];
            const now = new Date();

            let doc = await CheckInCheckOutModel.findOne({ userId });

            if (!doc) {
                const newEntry = { date: today, checkInAt: now };
                if (typeof checkInReason === 'string' && checkInReason.trim()) newEntry.checkInReason = checkInReason.trim();
                else if (typeof reason === 'string' && reason.trim()) newEntry.checkInReason = reason.trim();
                if (typeof status === 'string' && status.trim()) newEntry.checkInStatus = status.trim();
                doc = new CheckInCheckOutModel({
                    userId,
                    CheckInCheckOutTime: [newEntry]
                });
                await doc.save();
            } else {
                const entry = doc.CheckInCheckOutTime.find(e => e.date === today);
                if (entry && entry.checkInAt) {
                    return res.status(400).json({ success: false, message: 'User already checked in today' });
                }
                if (entry) {
                    entry.checkInAt = now;
                    if (typeof checkInReason === 'string' && checkInReason.trim()) entry.checkInReason = checkInReason.trim();
                    else if (typeof reason === 'string' && reason.trim()) entry.checkInReason = reason.trim();
                    if (typeof status === 'string' && status.trim()) entry.checkInStatus = status.trim();
                } else {
                    const newEntry = { date: today, checkInAt: now };
                    if (typeof checkInReason === 'string' && checkInReason.trim()) newEntry.checkInReason = checkInReason.trim();
                    else if (typeof reason === 'string' && reason.trim()) newEntry.checkInReason = reason.trim();
                    if (typeof status === 'string' && status.trim()) newEntry.checkInStatus = status.trim();
                    doc.CheckInCheckOutTime.push(newEntry);
                }
                await doc.save();
            }

            // Emit real-time analytics update for active members
            try {
                const io = getIO && getIO();
                if (io) {
                    io.to('analytics').emit('analytics:activeMembersUpdated', {
                        userId,
                        timestamp: new Date().toISOString()
                    });
                    io.to('analytics').emit('analytics:overviewUpdated', {
                        timestamp: new Date().toISOString()
                    });
                }
            } catch (socketError) {
                // Ignore socket errors, don't fail the API
                console.error('Socket.IO error in checkIn:', socketError.message);
            }

            res.status(201).json({
                success: true,
                message: 'Check-in successful',
                data: doc
            });
        } catch (error) {
            next(error);
        }
    },

    // GET /api/checkin/status?userId=USER_ID - Is user checked in today (server local date)
    getCheckInStatus: async (req, res, next) => {
        try {
            const { userId } = req.query;
            if (!userId) {
                return res.status(400).json({ success: false, message: 'userId is required' });
            }

            const now = new Date();
            const y = now.getFullYear();
            const m = String(now.getMonth() + 1).padStart(2, '0');
            const d = String(now.getDate()).padStart(2, '0');
            const todayLocal = `${y}-${m}-${d}`; // server-local YYYY-MM-DD

            const doc = await CheckInCheckOutModel.findOne({ userId });
            const entry = doc ? (doc.CheckInCheckOutTime || []).find(e => e.date === todayLocal) : null;

            if (entry && entry.checkInAt) {
                return res.status(200).json({ checkedIn: true, timestamp: entry.checkInAt.toISOString() });
            }
            return res.status(200).json({ checkedIn: false });
        } catch (error) {
            next(error);
        }
    },

    // GET /api/checkout/status?userId=USER_ID - Is user checked out today (server local date)
    getCheckOutStatus: async (req, res, next) => {
        try {
            const { userId } = req.query;
            if (!userId) {
                return res.status(400).json({ success: false, message: 'userId is required' });
            }

            const now = new Date();
            const y = now.getFullYear();
            const m = String(now.getMonth() + 1).padStart(2, '0');
            const d = String(now.getDate()).padStart(2, '0');
            const todayLocal = `${y}-${m}-${d}`; // server-local YYYY-MM-DD

            const doc = await CheckInCheckOutModel.findOne({ userId });
            const entry = doc ? (doc.CheckInCheckOutTime || []).find(e => e.date === todayLocal) : null;

            if (entry && entry.checkOutAt) {
                return res.status(200).json({ checkedOut: true, timestamp: entry.checkOutAt.toISOString() });
            }
            return res.status(200).json({ checkedOut: false });
        } catch (error) {
            next(error);
        }
    },

    // POST /api/checkout - Check out for the day
    checkOut: async (req, res, next) => {
        try {
            const { userId, checkOutReason, reason: checkoutReasonLegacy, status } = req.body;

            if (!userId) {
                return res.status(400).json({
                    success: false,
                    message: 'userId is required'
                });
            }

            const today = new Date().toISOString().split('T')[0];
            const now = new Date();

            const doc = await CheckInCheckOutModel.findOne({ userId });
            if (!doc) {
                return res.status(400).json({ success: false, message: 'User must check in before checking out' });
            }

            const entry = doc.CheckInCheckOutTime.find(e => e.date === today);
            if (!entry || !entry.checkInAt) {
                return res.status(400).json({ success: false, message: 'User must check in before checking out' });
            }
            if (entry.checkOutAt) {
                return res.status(400).json({ success: false, message: 'User already checked out today' });
            }

            entry.checkOutAt = now;
            entry.totalHours = Math.round(((now - entry.checkInAt) / (1000 * 60 * 60)) * 100) / 100;
            if (typeof checkOutReason === 'string' && checkOutReason.trim()) entry.checkOutReason = checkOutReason.trim();
            else if (typeof checkoutReasonLegacy === 'string' && checkoutReasonLegacy.trim()) entry.checkOutReason = checkoutReasonLegacy.trim();
            // keep backward-compatible field if legacy 'reason' provided
            if (typeof checkoutReasonLegacy === 'string' && checkoutReasonLegacy.trim()) entry.reason = checkoutReasonLegacy.trim();
            if (typeof status === 'string' && status.trim()) entry.checkOutStatus = status.trim();
            await doc.save();

            // Emit real-time analytics update for active members (check-out doesn't change active status, but emit for consistency)
            try {
                const io = getIO && getIO();
                if (io) {
                    io.to('analytics').emit('analytics:overviewUpdated', {
                        timestamp: new Date().toISOString()
                    });
                }
            } catch (socketError) {
                // Ignore socket errors, don't fail the API
                console.error('Socket.IO error in checkOut:', socketError.message);
            }

            res.status(200).json({ success: true, message: 'Check-out successful', data: doc });
        } catch (error) {
            next(error);
        }
    },

    // GET /api/checkin/:userId/today - Get today's check-in/out record for a user
    getTodayRecord: async (req, res, next) => {
        try {
            const { userId } = req.params;
            const today = new Date().toISOString().split('T')[0];

            const doc = await CheckInCheckOutModel.findOne({ userId });
            if (!doc) {
                return res.status(200).json({ success: true, message: 'No record found for today', data: null });
            }
            const entry = doc.CheckInCheckOutTime.find(e => e.date === today) || null;

            return res.status(200).json({
                success: true,
                message: entry ? 'Today\'s record retrieved successfully' : 'No record found for today',
                data: entry
            });
        } catch (error) {
            next(error);
        }
    },

    // GET /api/checkin/:userId/history - Get check-in/out history for a user
    getUserHistory: async (req, res, next) => {
        try {
            const { userId } = req.params;
            const { startDate, endDate, limit = 30 } = req.query;

            const doc = await CheckInCheckOutModel.findOne({ userId });
            if (!doc) {
                return res.status(200).json({ success: true, message: 'User history retrieved successfully', data: [], count: 0 });
            }

            let entries = doc.CheckInCheckOutTime || [];
            if (startDate && endDate) {
                entries = entries.filter(e => e.date >= startDate && e.date <= endDate);
            } else if (startDate) {
                entries = entries.filter(e => e.date >= startDate);
            } else if (endDate) {
                entries = entries.filter(e => e.date <= endDate);
            }

            entries.sort((a, b) => (a.date < b.date ? 1 : -1));
            const limited = entries.slice(0, parseInt(limit));

            res.status(200).json({ success: true, message: 'User history retrieved successfully', data: limited, count: limited.length });
        } catch (error) {
            next(error);
        }
    },

    // GET /api/checkin/all - Get all check-in/out records (admin view)
    getAllRecords: async (req, res, next) => {
        try {
            const { date, limit = 50 } = req.query;

            const docs = await CheckInCheckOutModel.find({}).limit(1000);
            let flattened = [];
            for (const d of docs) {
                for (const e of (d.CheckInCheckOutTime || [])) {
                    if (!date || e.date === date) {
                        flattened.push({ userId: d.userId, ...e });
                    }
                }
            }
            flattened.sort((a, b) => (a.date < b.date ? 1 : -1));
            const limited = flattened.slice(0, parseInt(limit));

            res.status(200).json({ success: true, message: 'All records retrieved successfully', data: limited, count: limited.length });
        } catch (error) {
            next(error);
        }
    }
};

module.exports = checkInCheckOutController;
