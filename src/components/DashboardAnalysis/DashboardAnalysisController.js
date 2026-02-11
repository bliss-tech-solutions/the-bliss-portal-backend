const NodeCache = require('node-cache');
const UserDetailsModel = require('../UserDetails/UserDetailsSchema/UserDetailsSchema');
const CheckInCheckOutModel = require('../CheckInCheckOutApi/CheckInCheckOutSchema/CheckInCheckOutSchema');
const AddTaskAssignModel = require('../AddTaskAssign/AddTaskAssignSchema/AddTaskAssignSchema');
const ClientManagementModel = require('../ClientManagement/ClientManagementSchema/ClientManagementSchema');

// Initialize cache with 120 second TTL (2 minutes)
const dashboardCache = new NodeCache({ stdTTL: 120, checkperiod: 130 });

const dashboardAnalysisController = {
    // GET /api/dashboard/analysis - Get dashboard data for all users or specific user
    getDashboardData: async (req, res, next) => {
        try {
            const { userId, skip = 0, limit = 100, startDate, endDate } = req.query;

            // Generate cache key based on query parameters
            const cacheKey = `dashboard:${userId || 'all'}:${skip}:${limit}:${startDate || ''}:${endDate || ''}`;

            // Check cache first
            const cachedData = dashboardCache.get(cacheKey);
            if (cachedData) {
                // Return cached data with same NDJSON streaming format
                res.setHeader('Content-Type', 'application/x-ndjson');
                res.setHeader('Transfer-Encoding', 'chunked');
                res.setHeader('X-Cache', 'HIT'); // Indicate cache hit

                cachedData.forEach(record => {
                    res.write(JSON.stringify(record) + '\n');
                });
                return res.end();
            }

            // 1) Setup Streaming Headers (NDJSON)
            res.setHeader('Content-Type', 'application/x-ndjson');
            res.setHeader('Transfer-Encoding', 'chunked');
            res.setHeader('X-Cache', 'MISS'); // Indicate cache miss

            // 2) Helper for IST Date (YYYY-MM-DD)
            const now = new Date();
            const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
            const istOffset = 5.5 * 60 * 60 * 1000;
            const istDate = new Date(utc + istOffset);
            const todayIST = istDate.toISOString().split('T')[0];

            // 3) Define User Query
            let userQuery = { role: { $nin: [/HR/i, /Admin/i] } };
            if (userId) userQuery = { userId };

            // Fetch all clients with status and deliverables
            const allSystemClients = await ClientManagementModel.find({}, 'clientName status monthlyDeliverables').lean();

            // Calculate total unique client count
            const totalSystemClients = allSystemClients.length;

            const activeClients = allSystemClients.filter(c => c.status === 'active').map(c => c.clientName);
            const inactiveClients = allSystemClients.filter(c => c.status === 'inactive').map(c => c.clientName);

            // Calculate Deliverables Totals (Reels/Combos) for ACTIVE clients
            const currentMonthSlug = new Date().toLocaleString('en-US', { month: 'short', year: 'numeric' });
            let reelsTotal = 0;
            let reelsCompleted = 0;
            let combosTotal = 0;
            let combosCompleted = 0;

            allSystemClients.forEach(client => {
                if (client.status === 'active') { // Only count active clients
                    const monthData = client.monthlyDeliverables?.find(m => m.month === currentMonthSlug);

                    if (monthData) {
                        // Process Reels
                        const reelsCategory = monthData.categories?.find(c => c.type === 'reels');
                        if (reelsCategory) {
                            reelsTotal += reelsCategory.items.length;
                            reelsCompleted += reelsCategory.items.filter(i => i.status).length;
                        } else {
                            reelsTotal += 3; // Default
                        }

                        // Process Combos
                        const combosCategory = monthData.categories?.find(c => c.type === 'combos');
                        if (combosCategory) {
                            combosTotal += combosCategory.items.length;
                            combosCompleted += combosCategory.items.filter(i => i.status).length;
                        } else {
                            combosTotal += 1; // Default
                        }
                    } else {
                        // No data for this month -> Use defaults
                        reelsTotal += 3;
                        combosTotal += 1;
                    }
                }
            });

            // Calculate Task Totals (Global or User-specific)
            const globalTaskQuery = {};
            if (userId) {
                // If specific user, we need to know their role to decide query, 
                // BUT since we are fetching users anyway, we can rely on the user loop for specific user stats 
                // OR we can just query broadly for the summary if that's acceptable.
                // However, for single user "Summary", we usually expect that user's stats.
                // The issue user reported was likely for "All Users" view (count 644).
                // For "All Users" view, we want a system-wide distinct task count.
                // Let's assume for Summary we want unique tasks involved.

                // If userId is present, we might just query where they are sender OR receiver to be safe, 
                // OR we can rely on the aggregated logic if we want to be very specific.
                // But the user complained about the "Structure" and "Calculation".
                // Let's make "Grand Totals" accurate for the scope.

                // For simplicity and accuracy of "Total Tasks", let's use $or for specific user 
                // to capture everything they are involved in, or stick to role-based if we had the role.
                // Since we don't have the role here easily without fetching the user first, 
                // and the code fetches users later...

                // actually, if userId is passed, the `users` array has 1 item.
                // The loop calculates that user's stats.
                // So for single user, the loop accumulation is actually fine (no double counting).
                // The problem is strictly for Multiple Users (All Users).

                // So, IF userId is NOT present, we run a global query.
                // IF userId IS present, we can let the loop handle it (accumulation of 1 is correct).
                // But to standardize, let's just use the Accumulated values for Single User (userId present)
                // and Global Query for All Users (userId missing).
            }

            let globalTasksStats = {
                totalTaskAdded: 0,
                totalCompleted: 0,
                totalPending: 0,
                totalInProgress: 0,
                TotalTaskAllocationClients: 0
            };

            if (!userId) {
                // Global Query for All Users context
                const taskFilter = {};
                if (startDate || endDate) {
                    taskFilter.createdAt = {};
                    if (startDate) taskFilter.createdAt.$gte = new Date(startDate);
                    if (endDate) {
                        const end = new Date(endDate);
                        end.setHours(23, 59, 59, 999);
                        taskFilter.createdAt.$lte = end;
                    }
                }

                const allGlobalTasks = await AddTaskAssignModel.find(taskFilter, 'taskStatus clientName').lean();
                const uniqueClients = new Set(allGlobalTasks.map(t => t.clientName).filter(Boolean));

                globalTasksStats = {
                    totalTaskAdded: allGlobalTasks.length,
                    totalCompleted: allGlobalTasks.filter(t => t.taskStatus === 'completed').length,
                    totalPending: allGlobalTasks.filter(t => t.taskStatus === 'pending').length,
                    totalInProgress: allGlobalTasks.filter(t => t.taskStatus === 'in_progress').length,
                    TotalTaskAllocationClients: uniqueClients.size
                };
            }

            // ✅ GRAND TOTALS
            const grandTotals = {
                type: 'summary',
                users: 0,
                totalSystemClients: activeClients.length,
                tasks: {
                    totalTaskAdded: globalTasksStats.totalTaskAdded,
                    // totalAllocated: 0, // REMOVED
                    totalCompleted: globalTasksStats.totalCompleted,
                    totalPending: globalTasksStats.totalPending,
                    totalInProgress: globalTasksStats.totalInProgress,
                    TotalTaskAllocationClients: globalTasksStats.TotalTaskAllocationClients
                },
                deliverables: {
                    reelsTotal,
                    reelsCompleted,
                    combosTotal,
                    combosCompleted,
                    clientsCount: activeClients.length
                },
                usersLinks: [],
                clientsList: {
                    active: activeClients,
                    inactive: inactiveClients
                }
            };

            // 4) Fetch all users at once (batch query instead of cursor for better performance with 35 users)
            const users = await UserDetailsModel.find(
                userQuery,
                'userId firstName lastName email role position'
            )
                .skip(parseInt(skip))
                .limit(parseInt(limit))
                .lean(); // Use lean() for better performance

            // Array to store all records for caching
            const allRecords = [];

            // 5) Process all users with parallel queries
            const userResults = await Promise.all(users.map(async (user) => {
                const currentUserId = user.userId;
                const role = (user.role || '').toString();
                const isExecutionRole = role.toLowerCase() === 'execution';
                const isContentProvider = role.toLowerCase() === 'contentprovider';

                // 🚀 PARALLEL QUERY EXECUTION - Run all 3 queries simultaneously
                const [attendanceRecord, allTasks, assignedClients] = await Promise.all([
                    // Query 1: Attendance
                    CheckInCheckOutModel.findOne(
                        { userId: currentUserId },
                        'CheckInCheckOutTime' // Only fetch needed field
                    ).lean(),

                    // Query 2: Tasks (only if not content provider)
                    !isContentProvider ? (async () => {
                        const taskQuery = {};
                        if (isExecutionRole) {
                            taskQuery.userId = currentUserId;
                        } else {
                            taskQuery.receiverUserId = currentUserId;
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

                        return AddTaskAssignModel.find(
                            taskQuery,
                            'taskStatus clientName receiverUserId createdAt' // Only fetch needed fields
                        ).sort({ createdAt: -1 }).lean();
                    })() : Promise.resolve([]),

                    // Query 3: Clients
                    ClientManagementModel.find(
                        { 'assignedUsers.userId': currentUserId },
                        'clientName attachments monthlyDeliverables assignedUsers' // Only fetch needed fields
                    ).lean()
                ]);

                // --- Process Attendance ---
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

                // --- Process Tasks ---
                let taskData = {};
                if (!isContentProvider && allTasks.length >= 0) {
                    const clientList = [...new Set(allTasks.map(t => t.clientName).filter(Boolean))];

                    taskData = {
                        totalTaskAdded: isExecutionRole ? allTasks.length : undefined,
                        totalAllocated: !isExecutionRole ? allTasks.length : undefined,
                        totalCompleted: allTasks.filter(t => t.taskStatus === 'completed').length,
                        totalPending: allTasks.filter(t => t.taskStatus === 'pending').length,
                        totalInProgress: allTasks.filter(t => t.taskStatus === 'in_progress').length,
                        TotalTaskAllocationClients: assignedClients.length, // Now using management count
                        clientList,
                        assignedToUsers: isExecutionRole
                            ? [...new Set(allTasks.map(t => t.receiverUserId).filter(Boolean))]
                            : undefined
                    };
                }

                // --- Process Content & Deliverables ---
                let contentData = {};
                const currentMonthSlug = new Date().toLocaleString('en-US', { month: 'short', year: 'numeric' });

                if (isContentProvider) {
                    const userAttachments = assignedClients.flatMap(c =>
                        c.attachments?.filter(a => a.uploadedBy?.userId === currentUserId && !a.archived) || []
                    );

                    const currentShortMonth = new Date().toLocaleString('en-US', { month: 'short' });
                    const totalUploadedThisMonth = userAttachments.filter(a => a.month === currentShortMonth).length;

                    const uploadedClients = [];
                    const pendingClients = [];

                    assignedClients.forEach(c => {
                        const hasUserUpload = c.attachments?.some(a => a.uploadedBy?.userId === currentUserId && !a.archived);
                        if (hasUserUpload) uploadedClients.push(c.clientName);
                        else pendingClients.push(c.clientName);
                    });

                    contentData = {
                        totalClients: assignedClients.length, // Management count
                        totalUploadedContent: userAttachments.length,
                        totalUploadedThisMonth,
                        uploadedClientsHistory: [...new Set(uploadedClients)],
                        uploadPendingClientHistory: [...new Set(pendingClients)]
                    };
                }

                // Deliverables progress per client (Fixed to use categories)
                const clientDeliverables = assignedClients.map(c => {
                    const progress = c.monthlyDeliverables?.find(d => d.month === currentMonthSlug);

                    let reels = { total: 3, completed: 0 };
                    let combos = { total: 1, completed: 0 };

                    if (progress) {
                        const reelsCat = progress.categories?.find(cat => cat.type === 'reels');
                        if (reelsCat) {
                            reels = {
                                total: reelsCat.items.length,
                                completed: reelsCat.items.filter(i => i.status).length
                            };
                        }

                        const combosCat = progress.categories?.find(cat => cat.type === 'combos');
                        if (combosCat) {
                            combos = {
                                total: combosCat.items.length,
                                completed: combosCat.items.filter(i => i.status).length
                            };
                        }
                    }

                    return {
                        clientName: c.clientName,
                        month: currentMonthSlug,
                        reels,
                        combos
                    };
                });

                return {
                    type: 'user',
                    user: {
                        userId: user.userId,
                        fullName: `${user.firstName} ${user.lastName}`,
                        role: user.role,
                        position: user.position || 'N/A'
                    },
                    totalAssignedClients: assignedClients.length, // Unique clients assigned to this user
                    attendance: {
                        todayDate: todayIST,
                        todayRecord: todayAttendance
                            ? {
                                checkInAt: todayAttendance.checkInAt,
                                checkOutAt: todayAttendance.checkOutAt,
                                status: todayAttendance.DayStatus
                            }
                            : null,
                        history: (startDate || endDate)
                            ? filteredAttendance.map(a => ({
                                date: a.date,
                                status: a.DayStatus
                            }))
                            : undefined
                    },
                    tasks: !isContentProvider ? taskData : undefined,
                    content: isContentProvider ? contentData : undefined,
                    clientDeliverables
                };
            }));

            // 6) Accumulate totals and write to stream
            for (const results of userResults) {
                grandTotals.users += 1;
                
                const role = (results.user.role || '').toLowerCase();
                const userLink = {
                    userId: results.user.userId,
                    name: results.user.fullName,
                    arole: results.user.role,
                    position: results.user.position
                };

                // Add role-specific stats
                if (role === 'execution') {
                    userLink.totalTaskAdded = results.tasks?.totalTaskAdded || 0;
                    userLink.totalCompleted = results.tasks?.totalCompleted || 0;
                } else if (role === 'contentprovider') {
                    userLink.totalUploadedContent = results.content?.totalUploadedContent || 0;
                    userLink.uploadPendingCount = results.content?.uploadPendingClientHistory?.length || 0;
                } else {
                    // Standard user role
                    userLink.totalAllocated = results.tasks?.totalAllocated || 0;
                    userLink.totalCompleted = results.tasks?.totalCompleted || 0;
                }

                grandTotals.usersLinks.push(userLink);

                if (results.tasks) {
                    // Only accumulate for grandTotals if we are in Single User mode (userId is present)
                    // If userId is NOT present, we calculated global stats above.
                    if (userId) {
                        // Logic for single user accumulation
                        if (typeof results.tasks.totalTaskAdded === 'number') {
                            grandTotals.tasks.totalTaskAdded += results.tasks.totalTaskAdded;
                        }
                        // totalAllocated removed

                        grandTotals.tasks.totalCompleted += results.tasks.totalCompleted || 0;
                        grandTotals.tasks.totalPending += results.tasks.totalPending || 0;
                        grandTotals.tasks.totalInProgress += results.tasks.totalInProgress || 0;
                        grandTotals.tasks.TotalTaskAllocationClients += results.tasks.TotalTaskAllocationClients || 0;
                    }
                }

                if (Array.isArray(results.clientDeliverables)) {
                    // We don't need to sum up deliverables here anymore as we calculated global totals from allSystemClients
                    // But we can check if we want to confirm user-assigned client counts or similar logic. 
                    // For now, removing the double counting into grandTotals.deliverables to avoid confusion with the global active client calculation.
                }

                // Write single user record to stream
                res.write(JSON.stringify(results) + '\n');
                allRecords.push(results);
            }

            // Write final summary record
            res.write(JSON.stringify(grandTotals) + '\n');
            allRecords.push(grandTotals);

            // Cache the complete result for next request
            dashboardCache.set(cacheKey, allRecords);

            res.end();
        } catch (error) {
            next(error);
        }
    },

    // Helper method to clear cache (optional - for manual cache invalidation)
    clearCache: (req, res, next) => {
        try {
            dashboardCache.flushAll();
            res.status(200).json({
                success: true,
                message: 'Dashboard cache cleared successfully'
            });
        } catch (error) {
            next(error);
        }
    }
};

module.exports = dashboardAnalysisController;
