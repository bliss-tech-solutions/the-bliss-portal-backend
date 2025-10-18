const CheckInCheckOutModel = require('./CheckInCheckOutSchema/CheckInCheckOutSchema');

const checkInCheckOutController = {
    // POST /api/checkin - Check in for the day
    checkIn: async (req, res, next) => {
        try {
            const { userId, time, location, device, notes } = req.body;
            
            if (!userId || !time) {
                return res.status(400).json({
                    success: false,
                    message: 'userId and time are required'
                });
            }

            // Get today's date in YYYY-MM-DD format
            const today = new Date().toISOString().split('T')[0];
            const checkInTimestamp = new Date();

            // Check if user already checked in today
            const existingRecord = await CheckInCheckOutModel.findOne({ userId, date: today });
            
            if (existingRecord && existingRecord.checkIn.timestamp) {
                return res.status(400).json({
                    success: false,
                    message: 'User already checked in today'
                });
            }

            // Create or update record
            const checkInData = {
                userId,
                date: today,
                checkIn: {
                    time,
                    timestamp: checkInTimestamp,
                    location: location || null,
                    device: device || null
                },
                status: 'checked-in',
                notes: notes || null
            };

            const record = await CheckInCheckOutModel.findOneAndUpdate(
                { userId, date: today },
                checkInData,
                { upsert: true, new: true }
            );

            res.status(201).json({
                success: true,
                message: 'Check-in successful',
                data: record
            });
        } catch (error) {
            next(error);
        }
    },

    // POST /api/checkout - Check out for the day
    checkOut: async (req, res, next) => {
        try {
            const { userId, time, location, device, notes } = req.body;
            
            if (!userId || !time) {
                return res.status(400).json({
                    success: false,
                    message: 'userId and time are required'
                });
            }

            // Get today's date in YYYY-MM-DD format
            const today = new Date().toISOString().split('T')[0];
            const checkOutTimestamp = new Date();

            // Find today's record
            const existingRecord = await CheckInCheckOutModel.findOne({ userId, date: today });
            
            if (!existingRecord || !existingRecord.checkIn.timestamp) {
                return res.status(400).json({
                    success: false,
                    message: 'User must check in before checking out'
                });
            }

            if (existingRecord.checkOut.timestamp) {
                return res.status(400).json({
                    success: false,
                    message: 'User already checked out today'
                });
            }

            // Calculate total hours
            const checkInTime = existingRecord.checkIn.timestamp;
            const totalHours = (checkOutTimestamp - checkInTime) / (1000 * 60 * 60); // Convert to hours

            // Update record with check-out data
            const updatedRecord = await CheckInCheckOutModel.findOneAndUpdate(
                { userId, date: today },
                {
                    checkOut: {
                        time,
                        timestamp: checkOutTimestamp,
                        location: location || null,
                        device: device || null
                    },
                    totalHours: Math.round(totalHours * 100) / 100, // Round to 2 decimal places
                    status: 'checked-out',
                    notes: notes || existingRecord.notes
                },
                { new: true }
            );

            res.status(200).json({
                success: true,
                message: 'Check-out successful',
                data: updatedRecord
            });
        } catch (error) {
            next(error);
        }
    },

    // GET /api/checkin/:userId/today - Get today's check-in/out record for a user
    getTodayRecord: async (req, res, next) => {
        try {
            const { userId } = req.params;
            const today = new Date().toISOString().split('T')[0];

            const record = await CheckInCheckOutModel.findOne({ userId, date: today });

            if (!record) {
                return res.status(200).json({
                    success: true,
                    message: 'No record found for today',
                    data: null
                });
            }

            res.status(200).json({
                success: true,
                message: 'Today\'s record retrieved successfully',
                data: record
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

            let filter = { userId };
            
            // Add date range filter if provided
            if (startDate && endDate) {
                filter.date = { $gte: startDate, $lte: endDate };
            } else if (startDate) {
                filter.date = { $gte: startDate };
            } else if (endDate) {
                filter.date = { $lte: endDate };
            }

            const records = await CheckInCheckOutModel
                .find(filter)
                .sort({ date: -1 }) // Most recent first
                .limit(parseInt(limit));

            res.status(200).json({
                success: true,
                message: 'User history retrieved successfully',
                data: records,
                count: records.length
            });
        } catch (error) {
            next(error);
        }
    },

    // GET /api/checkin/all - Get all check-in/out records (admin view)
    getAllRecords: async (req, res, next) => {
        try {
            const { date, limit = 50 } = req.query;

            let filter = {};
            if (date) {
                filter.date = date;
            }

            const records = await CheckInCheckOutModel
                .find(filter)
                .sort({ date: -1, createdAt: -1 })
                .limit(parseInt(limit));

            res.status(200).json({
                success: true,
                message: 'All records retrieved successfully',
                data: records,
                count: records.length
            });
        } catch (error) {
            next(error);
        }
    }
};

module.exports = checkInCheckOutController;
