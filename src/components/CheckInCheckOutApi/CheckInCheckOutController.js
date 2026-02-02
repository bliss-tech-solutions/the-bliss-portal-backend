const CheckInCheckOutModel = require('./CheckInCheckOutSchema/CheckInCheckOutSchema');
const { getIO } = require('../../utils/socket');

// Helper to get IST time details
const getISTTime = () => {
    const now = new Date();
    const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
    const istOffset = 5.5 * 60 * 60 * 1000;
    const istDate = new Date(utc + istOffset);

    return {
        realNow: now, // The actual absolute time (for DB saving)
        istDate: istDate, // The time shifted to IST (for logic)
        today: istDate.toISOString().split('T')[0], // IST YYYY-MM-DD
        hours: istDate.getUTCHours(), // IST hours
        minutes: istDate.getUTCMinutes() // IST minutes
    };
};

const checkInCheckOutController = {
    // POST /api/checkin - Check in for the day
    checkIn: async (req, res, next) => {
        try {
            const { userId, checkInReason, reason, status, checkInType } = req.body;

            if (!userId) {
                return res.status(400).json({
                    success: false,
                    message: 'userId is required'
                });
            }

            const { today, hours: checkInHour, minutes: checkInMinute, realNow: now } = getISTTime();

            // Determine check-in type (default to OFFICE if not provided)
            const type = checkInType || 'OFFICE';

            // Calculate DayStatus based on check-in type and time
            const checkInTimeInMinutes = checkInHour * 60 + checkInMinute;
            const cutoffTimeInMinutes = 10 * 60 + 50; // 10:50 AM

            let dayStatus = 'PENDING';

            // If check-in type is WORK, MEETING or external work, bypass time rules
            if (type === 'WORK' || type === 'MEETING' || type === 'EXTERNAL_WORK' ||
                type === 'CLIENT_VISIT' || type === 'SITE_WORK') {
                // External business work - always set to PENDING (can become FULL day)
                dayStatus = 'PENDING';
            } else {
                // Regular OFFICE check-in - apply time rules
                if (checkInTimeInMinutes > cutoffTimeInMinutes) {
                    dayStatus = 'HALF'; // Late check-in
                } else {
                    dayStatus = 'PENDING';
                }
            }

            let doc = await CheckInCheckOutModel.findOne({ userId });

            if (!doc) {
                const newEntry = {
                    date: today,
                    checkInAt: now,
                    DayStatus: dayStatus,
                    checkInType: type
                };
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
                    entry.DayStatus = dayStatus;
                    entry.checkInType = type;
                    if (typeof checkInReason === 'string' && checkInReason.trim()) entry.checkInReason = checkInReason.trim();
                    else if (typeof reason === 'string' && reason.trim()) entry.checkInReason = reason.trim();
                    if (typeof status === 'string' && status.trim()) entry.checkInStatus = status.trim();
                } else {
                    const newEntry = {
                        date: today,
                        checkInAt: now,
                        DayStatus: dayStatus,
                        checkInType: type
                    };
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

            const { today: todayLocal } = getISTTime();

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

            const { today: todayLocal } = getISTTime();

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

            const { today, hours: checkOutHour, minutes: checkOutMinute, realNow: now } = getISTTime();

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

            entry.checkOutAt = now; // Save actual UTC time
            entry.totalHours = Math.round(((now - entry.checkInAt) / (1000 * 60 * 60)) * 100) / 100;

            // Calculate final DayStatus based on check-in type, check-in time, and check-out time
            const checkOutTimeInMinutes = checkOutHour * 60 + checkOutMinute;

            // Convert stored checkInAt (UTC/Absolute) to IST for logic comparison
            const checkInAtUTC = entry.checkInAt.getTime() + (entry.checkInAt.getTimezoneOffset() * 60000); // effectively entry.checkInAt.getTime() on server
            const checkInAtIST = new Date(checkInAtUTC + (5.5 * 60 * 60 * 1000));

            const checkInHour = checkInAtIST.getUTCHours();
            const checkInMinute = checkInAtIST.getUTCMinutes();
            const checkInTimeInMinutes = checkInHour * 60 + checkInMinute;
            const checkInCutoff = 10 * 60 + 50; // 10:50 AM

            const checkInType = entry.checkInType || 'OFFICE';

            // Determine DayStatus based on type and times
            if (checkInType === 'WORK' || checkInType === 'MEETING' || checkInType === 'EXTERNAL_WORK' ||
                checkInType === 'CLIENT_VISIT' || checkInType === 'SITE_WORK') {
                // WORK types: 7:00 PM cutoff (no late penalty)
                const workCutoff = 19 * 60; // 7:00 PM (19:00)
                if (checkOutTimeInMinutes >= workCutoff) {
                    entry.DayStatus = 'FULL';
                } else {
                    entry.DayStatus = 'HALF';
                }
            } else {
                // OFFICE type: Different cutoffs based on check-in time
                const noonCutoff = 12 * 60; // 12:00 PM (noon)

                if (checkInTimeInMinutes > noonCutoff) {
                    // Checked in after 12:00 PM (noon): Always HALF day (no redemption)
                    entry.DayStatus = 'HALF';
                } else if (checkInTimeInMinutes <= checkInCutoff) {
                    // Checked in on time (before 10:50 AM): 7:00 PM cutoff
                    const onTimeCutoff = 19 * 60; // 7:00 PM (19:00)
                    if (checkOutTimeInMinutes >= onTimeCutoff) {
                        entry.DayStatus = 'FULL';
                    } else {
                        entry.DayStatus = 'HALF';
                    }
                } else {
                    // Checked in late (10:50 AM - 12:00 PM): 7:30 PM cutoff
                    const lateCutoff = 19 * 60 + 30; // 7:30 PM (19:30)
                    if (checkOutTimeInMinutes >= lateCutoff) {
                        entry.DayStatus = 'FULL';
                    } else {
                        entry.DayStatus = 'HALF';
                    }
                }
            }

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
            const { today } = getISTTime();

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

    // GET /api/checkin/analysis - Get detailed attendance analysis
    getAnalysis: async (req, res, next) => {
        try {
            const { userId, startDate, endDate, month, year, date } = req.query;

            // 1. Determine Date Range
            let start, end;
            const todayIST = getISTTime().today;

            if (date) {
                start = date;
                end = date;
            } else if (startDate && endDate) {
                start = startDate;
                end = endDate;
            } else if (month && year) {
                const m = parseInt(month);
                const y = parseInt(year);
                // Create dates in IST strings YYYY-MM-DD
                const firstDay = new Date(Date.UTC(y, m - 1, 1));
                const lastDay = new Date(Date.UTC(y, m, 0)); // Last day of month
                start = firstDay.toISOString().split('T')[0];
                end = lastDay.toISOString().split('T')[0];
            } else {
                // Default to current month
                const now = new Date();
                const m = now.getMonth();
                const y = now.getFullYear();
                const firstDay = new Date(Date.UTC(y, m, 1));
                const lastDay = new Date(Date.UTC(y, m + 1, 0));
                start = firstDay.toISOString().split('T')[0];
                end = lastDay.toISOString().split('T')[0];
            }

            const pipeline = [];

            // 2. Filter by User if provided
            if (userId) {
                pipeline.push({ $match: { userId: userId } });
            }

            // 3. Unwind entries
            pipeline.push({ $unwind: '$CheckInCheckOutTime' });

            // 4. Match Date Range
            pipeline.push({
                $match: {
                    'CheckInCheckOutTime.date': { $gte: start, $lte: end }
                }
            });

            // 5. Group by User to collect records for processing
            pipeline.push({
                $group: {
                    _id: '$userId',
                    records: { $push: '$CheckInCheckOutTime' }
                }
            });

            const results = await CheckInCheckOutModel.aggregate(pipeline);

            // 6. Post-process results (Calculate hours, handle missing checkout)
            const analysisData = results.map(userRecord => {
                let totalWorkingHours = 0;
                let fullDays = 0;
                let halfDays = 0;
                let pendingDays = 0; // Days that are still legitimately pending (e.g. today before logic applied? usually 0 if we force calc)

                const processedRecords = userRecord.records.map(entry => {
                    let totalHours = entry.totalHours || 0;
                    let dayStatus = entry.DayStatus;
                    let checkOutAt = entry.checkOutAt;
                    let isAutoCheckout = false;

                    // CHECKOUT MISSING LOGIC
                    if (!checkOutAt && entry.checkInAt) {
                        isAutoCheckout = true;

                        // Construct 2:00 PM (14:00) IST for the entry date
                        // entry.date is YYYY-MM-DD string
                        // We need to create a Date object corresponding to 14:00 IST on that day

                        // Parse YYYY-MM-DD
                        const [y, m, d] = entry.date.split('-').map(Number);

                        // Create UTC date that corresponds to 14:00 IST
                        // 14:00 IST = 08:30 UTC
                        const autoCheckOutDate = new Date(Date.UTC(y, m - 1, d, 8, 30, 0));

                        checkOutAt = autoCheckOutDate;

                        // Calculate Duration
                        // checkInAt is stored as Date (UTC). 
                        const durationMs = autoCheckOutDate - entry.checkInAt;
                        totalHours = Math.round((durationMs / (1000 * 60 * 60)) * 100) / 100;
                        if (totalHours < 0) totalHours = 0; // Should not happen unless checkin is after 2pm

                        // Force DayStatus to HALF as per requirement
                        dayStatus = 'HALF';
                    }

                    // Accumulate Counts
                    totalWorkingHours += totalHours;
                    if (dayStatus === 'FULL') fullDays++;
                    else if (dayStatus === 'HALF') halfDays++;
                    else pendingDays++;

                    return {
                        date: entry.date,
                        checkInAt: entry.checkInAt,
                        checkOutAt: checkOutAt,
                        totalHours: totalHours,
                        checkInStatus: entry.checkInStatus,
                        checkOutStatus: entry.checkOutStatus,
                        reason: entry.reason || entry.checkInReason, // Legacy/Fallback
                        checkInReason: entry.checkInReason,
                        checkOutReason: entry.checkOutReason,
                        checkInType: entry.checkInType,
                        DayStatus: dayStatus,
                        isAutoCheckout
                    };
                });

                // Sort processed records by date desc
                processedRecords.sort((a, b) => (a.date < b.date ? 1 : -1));

                return {
                    userId: userRecord._id,
                    summary: {
                        totalWorkingHours: Math.round(totalWorkingHours * 100) / 100,
                        fullDays,
                        halfDays,
                        pendingDays,
                        totalDaysPresent: processedRecords.length
                    },
                    records: processedRecords
                };
            });

            res.status(200).json({
                success: true,
                message: 'Analysis data retrieved successfully',
                data: analysisData,
                meta: {
                    start,
                    end
                }
            });

        } catch (error) {
            next(error);
        }
    },

    getAllRecords: async (req, res, next) => {
        try {
            const { date, startDate, endDate, page = 1, limit = 50 } = req.query;
            const pageNumber = parseInt(page);
            const limitNumber = parseInt(limit);
            const skip = (pageNumber - 1) * limitNumber;

            const pipeline = [];

            // 1. Unwind to get individual check-in/out entries
            pipeline.push({ $unwind: '$CheckInCheckOutTime' });

            // 2. Match stage for filtering
            const matchStage = {};

            if (date) {
                matchStage['CheckInCheckOutTime.date'] = date;
            } else if (startDate && endDate) {
                matchStage['CheckInCheckOutTime.date'] = { $gte: startDate, $lte: endDate };
            } else if (startDate) {
                matchStage['CheckInCheckOutTime.date'] = { $gte: startDate };
            } else if (endDate) {
                matchStage['CheckInCheckOutTime.date'] = { $lte: endDate };
            }

            if (Object.keys(matchStage).length > 0) {
                pipeline.push({ $match: matchStage });
            }

            // 3. Sort by date descending (latest first)
            pipeline.push({ $sort: { 'CheckInCheckOutTime.date': -1, 'CheckInCheckOutTime.checkInAt': -1 } });

            // 4. Facet for data and total count
            pipeline.push({
                $facet: {
                    metadata: [{ $count: 'total' }],
                    data: [
                        { $skip: skip },
                        { $limit: limitNumber },
                        {
                            $project: {
                                _id: 0,
                                userId: 1,
                                date: '$CheckInCheckOutTime.date',
                                checkInAt: '$CheckInCheckOutTime.checkInAt',
                                checkOutAt: '$CheckInCheckOutTime.checkOutAt',
                                totalHours: '$CheckInCheckOutTime.totalHours',
                                reason: '$CheckInCheckOutTime.reason',
                                checkInReason: '$CheckInCheckOutTime.checkInReason',
                                checkOutReason: '$CheckInCheckOutTime.checkOutReason',
                                checkInStatus: '$CheckInCheckOutTime.checkInStatus',
                                checkOutStatus: '$CheckInCheckOutTime.checkOutStatus',
                                checkInType: '$CheckInCheckOutTime.checkInType',
                                DayStatus: '$CheckInCheckOutTime.DayStatus'
                            }
                        }
                    ]
                }
            });

            const result = await CheckInCheckOutModel.aggregate(pipeline);

            const data = result[0].data;
            const totalDocs = result[0].metadata[0] ? result[0].metadata[0].total : 0;
            const totalPages = Math.ceil(totalDocs / limitNumber);

            res.status(200).json({
                success: true,
                message: 'All records retrieved successfully',
                data: data,
                pagination: {
                    totalDocs,
                    totalPages,
                    currentPage: pageNumber,
                    limit: limitNumber
                }
            });
        } catch (error) {
            next(error);
        }
    }
};

module.exports = checkInCheckOutController;
