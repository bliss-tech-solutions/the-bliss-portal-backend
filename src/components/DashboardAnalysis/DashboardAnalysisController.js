const UserDetailsModel = require('../UserDetails/UserDetailsSchema/UserDetailsSchema');
const CheckInCheckOutModel = require('../CheckInCheckOutApi/CheckInCheckOutSchema/CheckInCheckOutSchema');
const AddTaskAssignModel = require('../AddTaskAssign/AddTaskAssignSchema/AddTaskAssignSchema');
const ClientManagementModel = require('../ClientManagement/ClientManagementSchema/ClientManagementSchema');

const dashboardAnalysisController = {
    // GET /api/dashboard/analysis - Get dashboard data for all users or specific user
    getDashboardData: async (req, res, next) => {
        try {
            const { userId, skip = 0, limit = 100, startDate, endDate } = req.query;

            // 1. Setup Streaming Headers
            res.setHeader('Content-Type', 'application/x-ndjson');
            res.setHeader('Transfer-Encoding', 'chunked');

            // 2. Helper for IST Date
            const now = new Date();
            const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
            const istOffset = 5.5 * 60 * 60 * 1000;
            const istDate = new Date(utc + istOffset);
            const todayIST = istDate.toISOString().split('T')[0];

            // 3. Define User Query
            let userQuery = {
                role: { $nin: [/HR/i, /Admin/i] }
            };
            if (userId) {
                userQuery = { userId };
            }

            // 4. Create Cursor for Streaming
            const userCursor = UserDetailsModel.find(userQuery, 'userId firstName lastName email role position')
                .skip(parseInt(skip))
                .limit(parseInt(limit))
                .cursor();

            // 5. Iterate through cursor
            for (let user = await userCursor.next(); user != null; user = await userCursor.next()) {
                const results = await (async () => {
                    const userId = user.userId;
                    const role = user.role || '';
                    const isExecutionRole = role.toLowerCase() === 'execution';
                    const isContentProvider = role.toLowerCase() === 'contentprovider';

                    // --- Attendance Logic ---
                    const attendanceRecord = await CheckInCheckOutModel.findOne({ userId }).lean();
                    const allAttendanceEntries = attendanceRecord?.CheckInCheckOutTime || [];
                    const todayAttendance = allAttendanceEntries.find(entry => entry.date === todayIST);

                    let filteredAttendance = allAttendanceEntries;
                    if (startDate || endDate) {
                        filteredAttendance = allAttendanceEntries.filter(entry => {
                            if (startDate && entry.date < startDate) return false;
                            if (endDate && entry.date > endDate) return false;
                            return true;
                        });
                    }

                    // --- Task Logic (for User/Execution) ---
                    let taskData = {};
                    if (!isContentProvider) {
                        const taskQuery = {};
                        if (isExecutionRole) {
                            taskQuery.userId = userId;
                        } else {
                            taskQuery.receiverUserId = userId;
                        }

                        if (startDate || endDate) {
                            taskQuery.createdAt = {};
                            if (startDate) taskQuery.createdAt.$gte = new Date(startDate);
                            if (endDate) {
                                const end = new Date(endDate);
                                end.setHours(23, 59, 59, 999);
                                taskQuery.createdAt.$lte = end;
                            }
                        }

                        const allTasks = await AddTaskAssignModel.find(taskQuery).sort({ createdAt: -1 }).lean();
                        const clientList = [...new Set(allTasks.map(t => t.clientName).filter(Boolean))];

                        taskData = {
                            totalTaskAdded: isExecutionRole ? allTasks.length : undefined,
                            totalAllocated: !isExecutionRole ? allTasks.length : undefined,
                            totalCompleted: allTasks.filter(t => t.taskStatus === 'completed').length,
                            totalPending: allTasks.filter(t => t.taskStatus === 'pending').length,
                            totalInProgress: allTasks.filter(t => t.taskStatus === 'in_progress').length,
                            totalClients: clientList.length,
                            clientList,
                            assignedToUsers: isExecutionRole ? [...new Set(allTasks.map(t => t.receiverUserId).filter(Boolean))] : undefined
                        };
                    }

                    // --- Content & Deliverables Logic ---
                    let contentData = {};
                    const currentMonthSlug = new Date().toLocaleString('en-US', { month: 'short', year: 'numeric' });

                    // Fetch clients assigned to this user (for both Execution and ContentProvider)
                    const assignedClients = await ClientManagementModel.find({
                        'assignedUsers.userId': userId
                    }).lean();

                    if (isContentProvider) {
                        const userAttachments = assignedClients.flatMap(c =>
                            c.attachments?.filter(a => a.uploadedBy?.userId === userId && !a.archived) || []
                        );

                        const currentShortMonth = new Date().toLocaleString('en-US', { month: 'short' });
                        const totalUploadedThisMonth = userAttachments.filter(a => a.month === currentShortMonth).length;

                        const uploadedClients = [];
                        const pendingClients = [];

                        assignedClients.forEach(c => {
                            const hasUserUpload = c.attachments?.some(a => a.uploadedBy?.userId === userId && !a.archived);
                            if (hasUserUpload) uploadedClients.push(c.clientName);
                            else pendingClients.push(c.clientName);
                        });

                        contentData = {
                            totalClients: assignedClients.length,
                            totalUploadedContent: userAttachments.length,
                            totalUploadedThisMonth,
                            uploadedClientsHistory: [...new Set(uploadedClients)],
                            uploadPendingClientHistory: [...new Set(pendingClients)]
                        };
                    }

                    // For Admin/Execution/ContentProvider - Show deliverables progress per client
                    const clientDeliverables = assignedClients.map(c => {
                        const progress = c.monthlyDeliverables?.find(d => d.month === currentMonthSlug) || {
                            reels: { total: 3, completed: 0 },
                            combos: { total: 1, completed: 0 }
                        };
                        return {
                            clientName: c.clientName,
                            month: currentMonthSlug,
                            reels: progress.reels,
                            combos: progress.combos
                        };
                    });

                    return {
                        user: {
                            userId: user.userId,
                            fullName: `${user.firstName} ${user.lastName}`,
                            role: user.role,
                            position: user.position || 'N/A'
                        },
                        attendance: {
                            todayDate: todayIST,
                            todayRecord: todayAttendance ? {
                                checkInAt: todayAttendance.checkInAt,
                                checkOutAt: todayAttendance.checkOutAt,
                                status: todayAttendance.DayStatus
                            } : null,
                            history: (startDate || endDate) ? filteredAttendance.map(a => ({
                                date: a.date,
                                status: a.DayStatus
                            })) : undefined
                        },
                        tasks: !isContentProvider ? taskData : undefined,
                        content: isContentProvider ? contentData : undefined,
                        clientDeliverables: (isExecutionRole || isContentProvider || !userQuery.role) ? clientDeliverables : undefined
                    };
                })();

                // Write single user record to stream as NDJSON
                res.write(JSON.stringify(results) + '\n');
            }

            res.end();
        } catch (error) {
            next(error);
        }
    }
};

module.exports = dashboardAnalysisController;
