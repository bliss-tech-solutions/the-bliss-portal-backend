const UserDetailsModel = require('../UserDetails/UserDetailsSchema/UserDetailsSchema');
const CheckInCheckOutModel = require('../CheckInCheckOutApi/CheckInCheckOutSchema/CheckInCheckOutSchema');
const { getIO } = require('../../utils/socket');

const analyticsController = {
    // GET /api/analytics/total-employees - Get total employees count with real-time updates
    getTotalEmployees: async (req, res, next) => {
        try {
            const totalEmployees = await UserDetailsModel.countDocuments();
            
            const response = {
                success: true,
                message: 'Total employees retrieved successfully',
                data: {
                    totalEmployees,
                    timestamp: new Date().toISOString()
                }
            };

            res.status(200).json(response);
        } catch (error) {
            next(error);
        }
    },

    // GET /api/analytics/active-members - Get active members (logged in within last 3-4 days)
    getActiveMembers: async (req, res, next) => {
        try {
            const { daysThreshold = 4 } = req.query; // Default: 4 days (can be 3 or 4)
            const thresholdDays = parseInt(daysThreshold, 10);
            
            // Calculate cutoff date
            const cutoffDate = new Date();
            cutoffDate.setDate(cutoffDate.getDate() - thresholdDays);
            cutoffDate.setHours(0, 0, 0, 0); // Start of day

            // Get all users
            const allUsers = await UserDetailsModel.find({}, 'userId firstName lastName email role position');
            
            // Get all check-in records
            const checkInRecords = await CheckInCheckOutModel.find({});
            
            // Create a map of userId -> most recent check-in date
            const lastCheckInMap = new Map();
            checkInRecords.forEach(record => {
                if (record.CheckInCheckOutTime && record.CheckInCheckOutTime.length > 0) {
                    // Find most recent check-in
                    const mostRecent = record.CheckInCheckOutTime
                        .filter(entry => entry.checkInAt)
                        .sort((a, b) => new Date(b.checkInAt) - new Date(a.checkInAt))[0];
                    
                    if (mostRecent && mostRecent.checkInAt) {
                        const checkInDate = new Date(mostRecent.checkInAt);
                        const existing = lastCheckInMap.get(record.userId);
                        if (!existing || checkInDate > existing) {
                            lastCheckInMap.set(record.userId, checkInDate);
                        }
                    }
                }
            });

            // Separate active and inactive users
            const activeMembers = [];
            const inactiveMembers = [];
            const noCheckInRecords = [];

            allUsers.forEach(user => {
                const lastCheckIn = lastCheckInMap.get(user.userId);
                const userData = {
                    userId: user.userId,
                    name: `${user.firstName} ${user.lastName}`,
                    email: user.email,
                    role: user.role,
                    position: user.position,
                    lastCheckIn: lastCheckIn ? lastCheckIn.toISOString() : null,
                    daysSinceLastCheckIn: lastCheckIn 
                        ? Math.floor((new Date() - lastCheckIn) / (1000 * 60 * 60 * 24))
                        : null
                };

                if (!lastCheckIn) {
                    noCheckInRecords.push(userData);
                } else if (lastCheckIn >= cutoffDate) {
                    activeMembers.push(userData);
                } else {
                    inactiveMembers.push(userData);
                }
            });

            const response = {
                success: true,
                message: 'Active members retrieved successfully',
                data: {
                    activeCount: activeMembers.length,
                    inactiveCount: inactiveMembers.length,
                    noRecordCount: noCheckInRecords.length,
                    totalUsers: allUsers.length,
                    thresholdDays,
                    cutoffDate: cutoffDate.toISOString(),
                    activeMembers,
                    inactiveMembers,
                    noCheckInRecords: noCheckInRecords.slice(0, 10) // Limit no-record users for response
                }
            };

            res.status(200).json(response);
        } catch (error) {
            next(error);
        }
    },

    // GET /api/analytics/departments - Get departments breakdown
    getDepartments: async (req, res, next) => {
        try {
            // Get all users grouped by role (department)
            const departmentAggregation = await UserDetailsModel.aggregate([
                {
                    $group: {
                        _id: '$role',
                        count: { $sum: 1 },
                        users: {
                            $push: {
                                userId: '$userId',
                                name: { $concat: ['$firstName', ' ', '$lastName'] },
                                email: '$email',
                                position: '$position'
                            }
                        }
                    }
                },
                {
                    $project: {
                        _id: 0,
                        department: '$_id',
                        count: 1,
                        users: 1
                    }
                },
                {
                    $sort: { count: -1 }
                }
            ]);

            // Also get position breakdown within departments
            const positionAggregation = await UserDetailsModel.aggregate([
                {
                    $match: { position: { $exists: true, $ne: null, $ne: '' } }
                },
                {
                    $group: {
                        _id: {
                            role: '$role',
                            position: '$position'
                        },
                        count: { $sum: 1 }
                    }
                },
                {
                    $project: {
                        _id: 0,
                        department: '$_id.role',
                        position: '$_id.position',
                        count: 1
                    }
                },
                {
                    $sort: { department: 1, count: -1 }
                }
            ]);

            const response = {
                success: true,
                message: 'Departments retrieved successfully',
                data: {
                    totalDepartments: departmentAggregation.length,
                    departments: departmentAggregation,
                    positionBreakdown: positionAggregation,
                    summary: departmentAggregation.map(dept => ({
                        department: dept.department,
                        count: dept.count
                    }))
                }
            };

            res.status(200).json(response);
        } catch (error) {
            next(error);
        }
    },

    // GET /api/analytics/growth-rate - Calculate growth rate
    getGrowthRate: async (req, res, next) => {
        try {
            const { period = 'month', compareMonths = 1 } = req.query;
            // period: 'month' or 'year'
            // compareMonths: how many months back to compare (default: 1 = current vs previous month)

            // Get all users with creation dates
            const allUsers = await UserDetailsModel.find({}, 'createdAt userId').sort({ createdAt: 1 });

            const now = new Date();
            let currentPeriodStart, currentPeriodEnd, previousPeriodStart, previousPeriodEnd;

            if (period === 'month') {
                // Current month
                currentPeriodStart = new Date(now.getFullYear(), now.getMonth(), 1);
                currentPeriodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

                // Previous month(s)
                const monthsBack = parseInt(compareMonths, 10) || 1;
                previousPeriodStart = new Date(now.getFullYear(), now.getMonth() - monthsBack, 1);
                previousPeriodEnd = new Date(now.getFullYear(), now.getMonth() - monthsBack + 1, 0, 23, 59, 59, 999);
            } else if (period === 'year') {
                // Current year
                currentPeriodStart = new Date(now.getFullYear(), 0, 1);
                currentPeriodEnd = new Date(now.getFullYear(), 11, 31, 23, 59, 59, 999);

                // Previous year
                previousPeriodStart = new Date(now.getFullYear() - 1, 0, 1);
                previousPeriodEnd = new Date(now.getFullYear() - 1, 11, 31, 23, 59, 59, 999);
            }

            // Count users in each period
            let currentPeriodCount = 0;
            let previousPeriodCount = 0;

            allUsers.forEach(user => {
                const createdAt = new Date(user.createdAt);
                if (createdAt >= currentPeriodStart && createdAt <= currentPeriodEnd) {
                    currentPeriodCount++;
                }
                if (createdAt >= previousPeriodStart && createdAt <= previousPeriodEnd) {
                    previousPeriodCount++;
                }
            });

            // Calculate cumulative counts (total up to each period)
            const cumulativeCurrent = allUsers.filter(user => 
                new Date(user.createdAt) <= currentPeriodEnd
            ).length;

            const cumulativePrevious = allUsers.filter(user => 
                new Date(user.createdAt) <= previousPeriodEnd
            ).length;

            // Calculate growth rate
            // Growth Rate Formula: ((Current - Previous) / Previous) * 100
            let newEmployeeGrowthRate = 0;
            let cumulativeGrowthRate = 0;

            if (previousPeriodCount > 0) {
                newEmployeeGrowthRate = ((currentPeriodCount - previousPeriodCount) / previousPeriodCount) * 100;
            } else if (currentPeriodCount > 0) {
                newEmployeeGrowthRate = 100; // 100% growth if previous was 0 and current > 0
            }

            if (cumulativePrevious > 0) {
                cumulativeGrowthRate = ((cumulativeCurrent - cumulativePrevious) / cumulativePrevious) * 100;
            } else if (cumulativeCurrent > 0) {
                cumulativeGrowthRate = 100;
            }

            const response = {
                success: true,
                message: 'Growth rate calculated successfully',
                data: {
                    period,
                    currentPeriod: {
                        start: currentPeriodStart.toISOString(),
                        end: currentPeriodEnd.toISOString(),
                        newEmployees: currentPeriodCount,
                        cumulativeEmployees: cumulativeCurrent
                    },
                    previousPeriod: {
                        start: previousPeriodStart.toISOString(),
                        end: previousPeriodEnd.toISOString(),
                        newEmployees: previousPeriodCount,
                        cumulativeEmployees: cumulativePrevious
                    },
                    growthRate: {
                        newEmployeeGrowthRate: parseFloat(newEmployeeGrowthRate.toFixed(2)),
                        cumulativeGrowthRate: parseFloat(cumulativeGrowthRate.toFixed(2)),
                        formula: '((Current - Previous) / Previous) * 100'
                    },
                    totalEmployees: allUsers.length,
                    calculationDate: new Date().toISOString()
                }
            };

            res.status(200).json(response);
        } catch (error) {
            next(error);
        }
    },

    // GET /api/analytics/overview - Get all analytics overview (combined)
    getOverview: async (req, res, next) => {
        try {
            // Get total employees
            const totalEmployees = await UserDetailsModel.countDocuments();

            // Get active members (4 days threshold)
            const cutoffDate = new Date();
            cutoffDate.setDate(cutoffDate.getDate() - 4);
            cutoffDate.setHours(0, 0, 0, 0);

            const checkInRecords = await CheckInCheckOutModel.find({});
            const lastCheckInMap = new Map();
            checkInRecords.forEach(record => {
                if (record.CheckInCheckOutTime && record.CheckInCheckOutTime.length > 0) {
                    const mostRecent = record.CheckInCheckOutTime
                        .filter(entry => entry.checkInAt)
                        .sort((a, b) => new Date(b.checkInAt) - new Date(a.checkInAt))[0];
                    if (mostRecent && mostRecent.checkInAt) {
                        const checkInDate = new Date(mostRecent.checkInAt);
                        const existing = lastCheckInMap.get(record.userId);
                        if (!existing || checkInDate > existing) {
                            lastCheckInMap.set(record.userId, checkInDate);
                        }
                    }
                }
            });

            const allUsers = await UserDetailsModel.find({}, 'userId');
            let activeCount = 0;
            allUsers.forEach(user => {
                const lastCheckIn = lastCheckInMap.get(user.userId);
                if (lastCheckIn && lastCheckIn >= cutoffDate) {
                    activeCount++;
                }
            });

            // Get departments count
            const departmentAggregation = await UserDetailsModel.aggregate([
                {
                    $group: {
                        _id: '$role',
                        count: { $sum: 1 }
                    }
                },
                {
                    $project: {
                        _id: 0,
                        department: '$_id',
                        count: 1
                    }
                },
                {
                    $sort: { count: -1 }
                }
            ]);

            // Calculate growth rate (monthly)
            const allUsersWithDates = await UserDetailsModel.find({}, 'createdAt').sort({ createdAt: 1 });
            const now = new Date();
            const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
            const currentMonthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
            const previousMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
            const previousMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);

            let currentMonthCount = 0;
            let previousMonthCount = 0;
            allUsersWithDates.forEach(user => {
                const createdAt = new Date(user.createdAt);
                if (createdAt >= currentMonthStart && createdAt <= currentMonthEnd) currentMonthCount++;
                if (createdAt >= previousMonthStart && createdAt <= previousMonthEnd) previousMonthCount++;
            });

            let growthRate = 0;
            if (previousMonthCount > 0) {
                growthRate = ((currentMonthCount - previousMonthCount) / previousMonthCount) * 100;
            } else if (currentMonthCount > 0) {
                growthRate = 100;
            }

            const response = {
                success: true,
                message: 'Analytics overview retrieved successfully',
                data: {
                    totalEmployees,
                    activeMembers: {
                        count: activeCount,
                        inactiveCount: totalEmployees - activeCount,
                        threshold: '4 days'
                    },
                    departments: {
                        count: departmentAggregation.length,
                        breakdown: departmentAggregation.map(d => ({
                            department: d.department,
                            count: d.count
                        }))
                    },
                    growthRate: {
                        monthly: parseFloat(growthRate.toFixed(2)),
                        currentMonthNewEmployees: currentMonthCount,
                        previousMonthNewEmployees: previousMonthCount
                    },
                    timestamp: new Date().toISOString()
                }
            };

            res.status(200).json(response);
        } catch (error) {
            next(error);
        }
    }
};

module.exports = analyticsController;

