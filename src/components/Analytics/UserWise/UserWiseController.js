const UserDetailsModel = require('../../UserDetails/UserDetailsSchema/UserDetailsSchema');
const AddTaskAssignModel = require('../../AddTaskAssign/AddTaskAssignSchema/AddTaskAssignSchema');
const CheckInCheckOutModel = require('../../CheckInCheckOutApi/CheckInCheckOutSchema/CheckInCheckOutSchema');

const userWiseController = {
    // GET /api/analytics/userwise/:userId - Get user-wise analytics data
    getUserWiseData: async (req, res, next) => {
        try {
            const { userId } = req.params;

            if (!userId) {
                return res.status(400).json({
                    success: false,
                    message: 'userId is required'
                });
            }

            // Get user details
            const user = await UserDetailsModel.findOne({ userId });
            if (!user) {
                return res.status(404).json({
                    success: false,
                    message: 'User not found'
                });
            }

            // Get tasks where user is receiver (assigned to them)
            const tasks = await AddTaskAssignModel.find({
                receiverUserId: userId,
                isArchived: false // Exclude archived tasks
            }).sort({ createdAt: -1 });

            // Calculate task statistics
            const totalTasks = tasks.length;
            const completedTasks = tasks.filter(task => task.taskStatus === 'completed').length;
            const pendingTasks = tasks.filter(task => task.taskStatus === 'pending').length;
            const inProgressTasks = tasks.filter(task => task.taskStatus === 'in_progress').length;
            const cancelledTasks = tasks.filter(task => task.taskStatus === 'cancelled').length;

            // Get check-in/check-out data
            const checkInOutRecord = await CheckInCheckOutModel.findOne({ userId });
            const checkInOutTimes = checkInOutRecord?.CheckInCheckOutTime || [];

            // Calculate check-in average (number of check-ins per day in last 30 days)
            const last30Days = new Date();
            last30Days.setDate(last30Days.getDate() - 30);
            
            const checkInsLast30Days = checkInOutTimes.filter(entry => {
                if (!entry.checkInAt) return false;
                const checkInDate = new Date(entry.checkInAt);
                return checkInDate >= last30Days;
            }).length;

            const checkInAverage = checkInsLast30Days / 30; // Average per day

            // Calculate check-out average
            const checkOutsLast30Days = checkInOutTimes.filter(entry => {
                if (!entry.checkOutAt) return false;
                const checkOutDate = new Date(entry.checkOutAt);
                return checkOutDate >= last30Days;
            }).length;

            const checkOutAverage = checkOutsLast30Days / 30; // Average per day

            // Calculate working hours average
            const workingHoursData = checkInOutTimes
                .filter(entry => entry.checkInAt && entry.checkOutAt && entry.totalHours)
                .map(entry => entry.totalHours);

            let workingHoursAverage = 0;
            if (workingHoursData.length > 0) {
                const totalHours = workingHoursData.reduce((sum, hours) => sum + hours, 0);
                workingHoursAverage = totalHours / workingHoursData.length;
            }

            // Get task list with minimal details
            const taskList = tasks.map(task => ({
                _id: task._id,
                taskName: task.taskName,
                taskStatus: task.taskStatus,
                clientName: task.clientName,
                priority: task.priority,
                category: task.category,
                createdAt: task.createdAt,
                updatedAt: task.updatedAt,
                timeTracking: task.timeTracking,
                receiverUserId: task.receiverUserId
            }));

            const response = {
                success: true,
                message: 'User-wise analytics retrieved successfully',
                data: {
                    user: {
                        userId: user.userId,
                        name: `${user.firstName} ${user.lastName}`,
                        email: user.email,
                        role: user.role,
                        position: user.position
                    },
                    tasks: {
                        totalTasks,
                        completedTasks,
                        pendingTasks,
                        inProgressTasks,
                        cancelledTasks,
                        taskList
                    },
                    attendance: {
                        checkInAverage: parseFloat(checkInAverage.toFixed(2)),
                        checkOutAverage: parseFloat(checkOutAverage.toFixed(2)),
                        workingHoursAverage: parseFloat(workingHoursAverage.toFixed(2)),
                        totalCheckIns: checkInsLast30Days,
                        totalCheckOuts: checkOutsLast30Days,
                        totalWorkingDays: workingHoursData.length
                    },
                    period: {
                        days: 30,
                        from: last30Days.toISOString(),
                        to: new Date().toISOString()
                    }
                }
            };

            res.status(200).json(response);
        } catch (error) {
            next(error);
        }
    },

    // GET /api/analytics/userwise/:userId/tasks - Get user's task list only
    getUserTasks: async (req, res, next) => {
        try {
            const { userId } = req.params;
            const { status, limit = 50, skip = 0 } = req.query;

            if (!userId) {
                return res.status(400).json({
                    success: false,
                    message: 'userId is required'
                });
            }

            const query = {
                receiverUserId: userId,
                isArchived: false
            };

            if (status) {
                query.taskStatus = status;
            }

            const tasks = await AddTaskAssignModel.find(query)
                .sort({ createdAt: -1 })
                .limit(parseInt(limit))
                .skip(parseInt(skip));

            const totalCount = await AddTaskAssignModel.countDocuments(query);

            const taskList = tasks.map(task => ({
                _id: task._id,
                taskName: task.taskName,
                taskStatus: task.taskStatus,
                clientName: task.clientName,
                priority: task.priority,
                category: task.category,
                createdAt: task.createdAt,
                updatedAt: task.updatedAt,
                timeTracking: task.timeTracking
            }));

            res.status(200).json({
                success: true,
                message: 'User tasks retrieved successfully',
                data: {
                    tasks: taskList,
                    total: totalCount,
                    limit: parseInt(limit),
                    skip: parseInt(skip)
                }
            });
        } catch (error) {
            next(error);
        }
    },

    // GET /api/analytics/userwise/:userId/stats - Get user statistics only
    getUserStats: async (req, res, next) => {
        try {
            const { userId } = req.params;

            if (!userId) {
                return res.status(400).json({
                    success: false,
                    message: 'userId is required'
                });
            }

            // Get task statistics
            const tasks = await AddTaskAssignModel.find({
                receiverUserId: userId,
                isArchived: false
            });

            const totalTasks = tasks.length;
            const completedTasks = tasks.filter(task => task.taskStatus === 'completed').length;
            const pendingTasks = tasks.filter(task => task.taskStatus === 'pending').length;
            const inProgressTasks = tasks.filter(task => task.taskStatus === 'in_progress').length;

            // Get check-in/check-out statistics
            const checkInOutRecord = await CheckInCheckOutModel.findOne({ userId });
            const checkInOutTimes = checkInOutRecord?.CheckInCheckOutTime || [];

            const last30Days = new Date();
            last30Days.setDate(last30Days.getDate() - 30);

            const checkInsLast30Days = checkInOutTimes.filter(entry => {
                if (!entry.checkInAt) return false;
                return new Date(entry.checkInAt) >= last30Days;
            }).length;

            const checkOutsLast30Days = checkInOutTimes.filter(entry => {
                if (!entry.checkOutAt) return false;
                return new Date(entry.checkOutAt) >= last30Days;
            }).length;

            const workingHoursData = checkInOutTimes
                .filter(entry => entry.checkInAt && entry.checkOutAt && entry.totalHours)
                .map(entry => entry.totalHours);

            let workingHoursAverage = 0;
            if (workingHoursData.length > 0) {
                const totalHours = workingHoursData.reduce((sum, hours) => sum + hours, 0);
                workingHoursAverage = totalHours / workingHoursData.length;
            }

            const checkInAverage = checkInsLast30Days / 30;
            const checkOutAverage = checkOutsLast30Days / 30;

            res.status(200).json({
                success: true,
                message: 'User statistics retrieved successfully',
                data: {
                    tasks: {
                        total: totalTasks,
                        completed: completedTasks,
                        pending: pendingTasks,
                        inProgress: inProgressTasks
                    },
                    attendance: {
                        checkInAverage: parseFloat(checkInAverage.toFixed(2)),
                        checkOutAverage: parseFloat(checkOutAverage.toFixed(2)),
                        workingHoursAverage: parseFloat(workingHoursAverage.toFixed(2))
                    },
                    period: {
                        days: 30,
                        from: last30Days.toISOString(),
                        to: new Date().toISOString()
                    }
                }
            });
        } catch (error) {
            next(error);
        }
    }
};

module.exports = userWiseController;


