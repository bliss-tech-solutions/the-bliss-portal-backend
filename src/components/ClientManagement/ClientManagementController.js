const ClientManagementModel = require('./ClientManagementSchema/ClientManagementSchema');
const { getIO } = require('../../utils/socket');

const clientManagementController = {
    // GET /api/clientmanagement/getAllClientsData - Get all clients
    getAllClientsData: async (req, res, next) => {
        try {
            const { status, city } = req.query; // Optional filters
            
            // Build query
            const query = {};
            if (status) {
                query.status = status; // Filter by status (active/inactive)
            }
            if (city) {
                query.city = { $regex: new RegExp(city, 'i') }; // Case-insensitive city search
            }
            
            const clients = await ClientManagementModel.find(query).sort({ createdAt: -1 });
            
            res.status(200).json({
                success: true,
                message: 'Clients retrieved successfully',
                data: clients,
                count: clients.length
            });
        } catch (error) {
            next(error);
        }
    },

    // GET /api/clientmanagement/getById/:clientId - Get client by ID
    getById: async (req, res, next) => {
        try {
            const { clientId } = req.params;
            
            const client = await ClientManagementModel.findById(clientId);
            
            if (!client) {
                return res.status(404).json({
                    success: false,
                    message: 'Client not found'
                });
            }
            
            res.status(200).json({
                success: true,
                message: 'Client retrieved successfully',
                data: client
            });
        } catch (error) {
            next(error);
        }
    },

    // GET /api/clientmanagement/getClientsByUserId/:userId - Get clients assigned to a specific user
    getClientsByUserId: async (req, res, next) => {
        try {
            const { userId } = req.params;
            
            // Find all clients where the userId is in the assignedUsers array
            const clients = await ClientManagementModel.find({
                'assignedUsers.userId': userId
            }).sort({ createdAt: -1 });
            
            if (clients.length === 0) {
                return res.status(200).json({
                    success: true,
                    message: 'No clients found for this user',
                    data: [],
                    count: 0
                });
            }
            
            res.status(200).json({
                success: true,
                message: 'Clients retrieved successfully',
                data: clients,
                count: clients.length
            });
        } catch (error) {
            next(error);
        }
    },

    // POST /api/clientmanagement/create - Create new client
    create: async (req, res, next) => {
        try {
            const {
                clientName,
                city,
                onboardDate,
                status,
                itsDataReceived,
                assignedUsers
            } = req.body;

            // Validate required fields
            if (!clientName || !city || !onboardDate) {
                return res.status(400).json({
                    success: false,
                    message: 'Missing required fields: clientName, city, and onboardDate are required'
                });
            }

            // Validate status
            const normalizedStatus = status || 'active';
            if (!['active', 'inactive'].includes(normalizedStatus)) {
                return res.status(400).json({
                    success: false,
                    message: 'Status must be either "active" or "inactive"'
                });
            }

            // Validate onboardDate
            const date = new Date(onboardDate);
            if (isNaN(date.getTime())) {
                return res.status(400).json({
                    success: false,
                    message: 'Invalid onboardDate format. Please provide a valid date.'
                });
            }

            // Validate itsDataReceived
            const dataReceived = itsDataReceived !== undefined ? Boolean(itsDataReceived) : false;

            // Validate and normalize assignedUsers
            let normalizedAssignedUsers = [];
            if (assignedUsers !== undefined) {
                if (!Array.isArray(assignedUsers)) {
                    return res.status(400).json({
                        success: false,
                        message: 'assignedUsers must be an array'
                    });
                }

                const userIds = new Set(); // Track unique userIds
                for (const user of assignedUsers) {
                    if (!user.userId || !user.name) {
                        return res.status(400).json({
                            success: false,
                            message: 'Each assigned user must have userId and name'
                        });
                    }

                    // Check for duplicate userIds
                    if (userIds.has(user.userId)) {
                        return res.status(400).json({
                            success: false,
                            message: `Duplicate user found: ${user.name} (${user.userId})`
                        });
                    }
                    userIds.add(user.userId);

                    normalizedAssignedUsers.push({
                        userId: user.userId,
                        name: user.name.trim()
                    });
                }
            }

            // Check for duplicate client name (case-insensitive)
            const existingClient = await ClientManagementModel.findOne({
                clientName: { $regex: new RegExp(`^${clientName}$`, 'i') }
            });

            if (existingClient) {
                return res.status(400).json({
                    success: false,
                    message: 'Client name already exists. Please use a different name.',
                    data: {
                        existingClientId: existingClient._id,
                        existingClientName: existingClient.clientName
                    }
                });
            }

            const newClient = new ClientManagementModel({
                clientName: clientName.trim(),
                city: city.trim(),
                onboardDate: date,
                status: normalizedStatus,
                itsDataReceived: dataReceived,
                assignedUsers: normalizedAssignedUsers
            });

            const savedClient = await newClient.save();

            // Emit socket event for real-time client creation
            try {
                const io = getIO && getIO();
                if (io) {
                    // Emit globally for client list updates
                    io.emit('client:created', {
                        clientId: String(savedClient._id),
                        client: savedClient
                    });

                    // Emit to assigned users' rooms
                    if (savedClient.assignedUsers && savedClient.assignedUsers.length > 0) {
                        savedClient.assignedUsers.forEach(user => {
                            io.to(`user:${user.userId}`).emit('client:assigned', {
                                clientId: String(savedClient._id),
                                client: savedClient
                            });
                        });
                    }
                }
            } catch (e) {
                console.warn('Socket emission failed:', e.message);
            }

            res.status(201).json({
                success: true,
                message: 'Client created successfully',
                data: savedClient
            });
        } catch (error) {
            next(error);
        }
    },

    // PUT /api/clientmanagement/update/:clientId - Update client
    update: async (req, res, next) => {
        try {
            const { clientId } = req.params;
            const {
                clientName,
                city,
                onboardDate,
                status,
                itsDataReceived,
                assignedUsers
            } = req.body;

            // Check if client exists
            const client = await ClientManagementModel.findById(clientId);
            if (!client) {
                return res.status(404).json({
                    success: false,
                    message: 'Client not found'
                });
            }

            // Check for duplicate client name if clientName is being updated
            if (clientName !== undefined && clientName !== client.clientName) {
                const existingClient = await ClientManagementModel.findOne({
                    clientName: { $regex: new RegExp(`^${clientName}$`, 'i') },
                    _id: { $ne: clientId } // Exclude current client
                });

                if (existingClient) {
                    return res.status(400).json({
                        success: false,
                        message: 'Client name already exists. Please use a different name.',
                        data: {
                            existingClientId: existingClient._id,
                            existingClientName: existingClient.clientName
                        }
                    });
                }
            }

            // Build update object (only update provided fields)
            const updateData = {};
            if (clientName !== undefined) updateData.clientName = clientName.trim();
            if (city !== undefined) updateData.city = city.trim();
            if (onboardDate !== undefined) {
                const date = new Date(onboardDate);
                if (isNaN(date.getTime())) {
                    return res.status(400).json({
                        success: false,
                        message: 'Invalid onboardDate format. Please provide a valid date.'
                    });
                }
                updateData.onboardDate = date;
            }
            if (status !== undefined) {
                if (!['active', 'inactive'].includes(status)) {
                    return res.status(400).json({
                        success: false,
                        message: 'Status must be either "active" or "inactive"'
                    });
                }
                updateData.status = status;
            }
            if (itsDataReceived !== undefined) {
                updateData.itsDataReceived = Boolean(itsDataReceived);
            }
            if (assignedUsers !== undefined) {
                if (!Array.isArray(assignedUsers)) {
                    return res.status(400).json({
                        success: false,
                        message: 'assignedUsers must be an array'
                    });
                }

                const normalizedAssignedUsers = [];
                const userIds = new Set();
                
                for (const user of assignedUsers) {
                    if (!user.userId || !user.name) {
                        return res.status(400).json({
                            success: false,
                            message: 'Each assigned user must have userId and name'
                        });
                    }

                    if (userIds.has(user.userId)) {
                        return res.status(400).json({
                            success: false,
                            message: `Duplicate user found: ${user.name} (${user.userId})`
                        });
                    }
                    userIds.add(user.userId);

                    normalizedAssignedUsers.push({
                        userId: user.userId,
                        name: user.name.trim()
                    });
                }
                updateData.assignedUsers = normalizedAssignedUsers;
            }

            const updatedClient = await ClientManagementModel.findByIdAndUpdate(
                clientId,
                updateData,
                { new: true, runValidators: true }
            );

            // Emit socket event for real-time client update
            try {
                const io = getIO && getIO();
                if (io) {
                    // Emit globally for client list updates
                    io.emit('client:updated', {
                        clientId: String(clientId),
                        client: updatedClient
                    });

                    // Emit to assigned users' rooms
                    if (updatedClient.assignedUsers && updatedClient.assignedUsers.length > 0) {
                        updatedClient.assignedUsers.forEach(user => {
                            io.to(`user:${user.userId}`).emit('client:updated', {
                                clientId: String(clientId),
                                client: updatedClient
                            });
                        });
                    }
                }
            } catch (e) {
                console.warn('Socket emission failed:', e.message);
            }

            res.status(200).json({
                success: true,
                message: 'Client updated successfully',
                data: updatedClient
            });
        } catch (error) {
            next(error);
        }
    },

    // DELETE /api/clientmanagement/delete/:clientId - Delete client
    delete: async (req, res, next) => {
        try {
            const { clientId } = req.params;

            const client = await ClientManagementModel.findById(clientId);
            if (!client) {
                return res.status(404).json({
                    success: false,
                    message: 'Client not found'
                });
            }

            await ClientManagementModel.findByIdAndDelete(clientId);

            // Emit socket event for real-time client deletion
            try {
                const io = getIO && getIO();
                if (io) {
                    // Emit globally for client list updates
                    io.emit('client:deleted', {
                        clientId: String(clientId),
                        clientName: client.clientName
                    });

                    // Emit to assigned users' rooms
                    if (client.assignedUsers && client.assignedUsers.length > 0) {
                        client.assignedUsers.forEach(user => {
                            io.to(`user:${user.userId}`).emit('client:deleted', {
                                clientId: String(clientId),
                                clientName: client.clientName
                            });
                        });
                    }
                }
            } catch (e) {
                console.warn('Socket emission failed:', e.message);
            }

            res.status(200).json({
                success: true,
                message: 'Client deleted successfully',
                data: {
                    deletedClientId: clientId,
                    clientName: client.clientName
                }
            });
        } catch (error) {
            next(error);
        }
    },

    // POST /api/clientmanagement/:clientId/attachments - Add attachment to client
    addAttachment: async (req, res, next) => {
        try {
            const { clientId } = req.params;
            const { link, notes, month, uploadedBy } = req.body;

            // Validate required fields
            if (!link || !month || !uploadedBy) {
                return res.status(400).json({
                    success: false,
                    message: 'Missing required fields: link, month, and uploadedBy are required'
                });
            }

            // Validate month
            const validMonths = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
            if (!validMonths.includes(month)) {
                return res.status(400).json({
                    success: false,
                    message: 'Invalid month. Must be one of: Jan, Feb, Mar, Apr, May, Jun, Jul, Aug, Sep, Oct, Nov, Dec'
                });
            }

            // Validate uploadedBy
            if (!uploadedBy.userId || !uploadedBy.name) {
                return res.status(400).json({
                    success: false,
                    message: 'uploadedBy must have userId and name'
                });
            }

            // Check if client exists
            const client = await ClientManagementModel.findById(clientId);
            if (!client) {
                return res.status(404).json({
                    success: false,
                    message: 'Client not found'
                });
            }

            // Create attachment object
            const newAttachment = {
                link: link.trim(),
                notes: notes ? notes.trim() : '',
                month: month,
                uploadedBy: {
                    userId: uploadedBy.userId,
                    name: uploadedBy.name.trim()
                }
            };

            // Add attachment to client
            client.attachments.push(newAttachment);
            const savedClient = await client.save();

            // Get the newly added attachment (last one in array)
            const addedAttachment = savedClient.attachments[savedClient.attachments.length - 1];

            // Emit socket event for real-time attachment addition
            try {
                const io = getIO && getIO();
                if (io) {
                    const socketPayload = {
                        clientId: String(clientId),
                        userId: addedAttachment.uploadedBy.userId,
                        attachment: addedAttachment
                    };

                    // Emit to client-specific room
                    io.to(`client:${clientId}`).emit('client:attachment:added', socketPayload);

                    // Emit to userId-specific room for this attachment's uploader
                    io.to(`user:${addedAttachment.uploadedBy.userId}`).emit('client:attachment:added', socketPayload);

                    // Emit to client-user combination room for filtered views
                    io.to(`client:${clientId}:user:${addedAttachment.uploadedBy.userId}`).emit('client:attachment:added', socketPayload);

                    // Emit globally
                    io.emit('client:attachment:added', socketPayload);

                    // Emit to assigned users' rooms
                    if (savedClient.assignedUsers && savedClient.assignedUsers.length > 0) {
                        savedClient.assignedUsers.forEach(user => {
                            io.to(`user:${user.userId}`).emit('client:attachment:added', socketPayload);
                        });
                    }
                }
            } catch (e) {
                console.warn('Socket emission failed:', e.message);
            }

            res.status(201).json({
                success: true,
                message: 'Attachment added successfully',
                data: addedAttachment
            });
        } catch (error) {
            next(error);
        }
    },

    // GET /api/clientmanagement/:clientId/attachments - Get all attachments for a client
    getAttachments: async (req, res, next) => {
        try {
            const { clientId } = req.params;
            const { month } = req.query; // Optional filter by month

            // Check if client exists
            const client = await ClientManagementModel.findById(clientId);
            if (!client) {
                return res.status(404).json({
                    success: false,
                    message: 'Client not found'
                });
            }

            let attachments = client.attachments || [];

            // Filter by month if provided
            if (month) {
                const validMonths = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
                if (!validMonths.includes(month)) {
                    return res.status(400).json({
                        success: false,
                        message: 'Invalid month. Must be one of: Jan, Feb, Mar, Apr, May, Jun, Jul, Aug, Sep, Oct, Nov, Dec'
                    });
                }
                attachments = attachments.filter(att => att.month === month);
            }

            // Sort by createdAt (newest first)
            attachments = attachments.sort((a, b) => b.createdAt - a.createdAt);

            res.status(200).json({
                success: true,
                message: 'Attachments retrieved successfully',
                data: attachments,
                count: attachments.length
            });
        } catch (error) {
            next(error);
        }
    },

    // GET /api/clientmanagement/:clientId/attachments/sortedByUserId - Get attachments for a client sorted by userId
    getAttachmentsSortedByUserId: async (req, res, next) => {
        try {
            const { clientId } = req.params;
            const { month } = req.query; // Optional filter by month

            // Check if client exists
            const client = await ClientManagementModel.findById(clientId);
            if (!client) {
                return res.status(404).json({
                    success: false,
                    message: 'Client not found'
                });
            }

            let attachments = client.attachments || [];

            // Filter by month if provided
            if (month) {
                const validMonths = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
                if (!validMonths.includes(month)) {
                    return res.status(400).json({
                        success: false,
                        message: 'Invalid month. Must be one of: Jan, Feb, Mar, Apr, May, Jun, Jul, Aug, Sep, Oct, Nov, Dec'
                    });
                }
                attachments = attachments.filter(att => att.month === month);
            }

            // Group attachments by userId
            const attachmentsByUserId = {};
            
            attachments.forEach(attachment => {
                const userId = attachment.uploadedBy.userId;
                const userName = attachment.uploadedBy.name;
                
                if (!attachmentsByUserId[userId]) {
                    attachmentsByUserId[userId] = {
                        userId: userId,
                        userName: userName,
                        attachments: []
                    };
                }
                
                attachmentsByUserId[userId].attachments.push(attachment);
            });

            // Convert to array and sort by userId/userName
            const sortedAttachments = Object.values(attachmentsByUserId).sort((a, b) => {
                return a.userName.localeCompare(b.userName);
            });

            // Sort attachments within each user group by createdAt (newest first)
            sortedAttachments.forEach(userGroup => {
                userGroup.attachments.sort((a, b) => {
                    const dateA = new Date(a.createdAt);
                    const dateB = new Date(b.createdAt);
                    return dateB - dateA;
                });
            });

            res.status(200).json({
                success: true,
                message: 'Attachments retrieved and sorted by userId successfully',
                data: sortedAttachments,
                count: sortedAttachments.length,
                totalAttachments: attachments.length
            });
        } catch (error) {
            next(error);
        }
    },

    // GET /api/clientmanagement/:clientId/attachments/byUserId/:userId - Get attachments for a client filtered by userId
    getAttachmentsByClientIdAndUserId: async (req, res, next) => {
        try {
            const { clientId, userId } = req.params;
            const { month } = req.query; // Optional filter by month

            // Check if client exists
            const client = await ClientManagementModel.findById(clientId);
            if (!client) {
                return res.status(404).json({
                    success: false,
                    message: 'Client not found'
                });
            }

            // Filter attachments by userId
            let attachments = client.attachments.filter(
                att => att.uploadedBy.userId === userId
            ) || [];

            // Filter by month if provided
            if (month) {
                const validMonths = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
                if (!validMonths.includes(month)) {
                    return res.status(400).json({
                        success: false,
                        message: 'Invalid month. Must be one of: Jan, Feb, Mar, Apr, May, Jun, Jul, Aug, Sep, Oct, Nov, Dec'
                    });
                }
                attachments = attachments.filter(att => att.month === month);
            }

            // Sort by createdAt (newest first)
            attachments = attachments.sort((a, b) => {
                const dateA = new Date(a.createdAt);
                const dateB = new Date(b.createdAt);
                return dateB - dateA;
            });

            // Get user info from first attachment if available
            const userInfo = attachments.length > 0 ? attachments[0].uploadedBy : null;

            res.status(200).json({
                success: true,
                message: 'Attachments retrieved successfully',
                data: {
                    clientId: String(clientId),
                    userId: userId,
                    userName: userInfo ? userInfo.name : null,
                    attachments: attachments,
                    count: attachments.length
                }
            });
        } catch (error) {
            next(error);
        }
    },

    // PUT /api/clientmanagement/:clientId/attachments/:attachmentId - Update attachment
    updateAttachment: async (req, res, next) => {
        try {
            const { clientId, attachmentId } = req.params;
            const { link, notes, month } = req.body;

            // Check if client exists
            const client = await ClientManagementModel.findById(clientId);
            if (!client) {
                return res.status(404).json({
                    success: false,
                    message: 'Client not found'
                });
            }

            // Find attachment index
            const attachmentIndex = client.attachments.findIndex(
                att => att._id.toString() === attachmentId
            );

            if (attachmentIndex === -1) {
                return res.status(404).json({
                    success: false,
                    message: 'Attachment not found'
                });
            }

            // Validate month if provided
            if (month !== undefined) {
                const validMonths = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
                if (!validMonths.includes(month)) {
                    return res.status(400).json({
                        success: false,
                        message: 'Invalid month. Must be one of: Jan, Feb, Mar, Apr, May, Jun, Jul, Aug, Sep, Oct, Nov, Dec'
                    });
                }
                client.attachments[attachmentIndex].month = month;
            }

            // Update fields if provided
            if (link !== undefined) {
                client.attachments[attachmentIndex].link = link.trim();
            }
            if (notes !== undefined) {
                client.attachments[attachmentIndex].notes = notes.trim();
            }

            const savedClient = await client.save();
            const updatedAttachment = savedClient.attachments[attachmentIndex];

            // Emit socket event for real-time attachment update
            try {
                const io = getIO && getIO();
                if (io) {
                    const socketPayload = {
                        clientId: String(clientId),
                        attachmentId: String(attachmentId),
                        userId: updatedAttachment.uploadedBy.userId,
                        attachment: updatedAttachment
                    };

                    // Emit to client-specific room
                    io.to(`client:${clientId}`).emit('client:attachment:updated', socketPayload);

                    // Emit to userId-specific room for this attachment's uploader
                    io.to(`user:${updatedAttachment.uploadedBy.userId}`).emit('client:attachment:updated', socketPayload);

                    // Emit to client-user combination room for filtered views
                    io.to(`client:${clientId}:user:${updatedAttachment.uploadedBy.userId}`).emit('client:attachment:updated', socketPayload);

                    // Emit globally
                    io.emit('client:attachment:updated', socketPayload);

                    // Emit to assigned users' rooms
                    if (savedClient.assignedUsers && savedClient.assignedUsers.length > 0) {
                        savedClient.assignedUsers.forEach(user => {
                            io.to(`user:${user.userId}`).emit('client:attachment:updated', socketPayload);
                        });
                    }
                }
            } catch (e) {
                console.warn('Socket emission failed:', e.message);
            }

            res.status(200).json({
                success: true,
                message: 'Attachment updated successfully',
                data: updatedAttachment
            });
        } catch (error) {
            next(error);
        }
    },

    // DELETE /api/clientmanagement/:clientId/attachments/:attachmentId - Delete attachment
    deleteAttachment: async (req, res, next) => {
        try {
            const { clientId, attachmentId } = req.params;

            // Check if client exists
            const client = await ClientManagementModel.findById(clientId);
            if (!client) {
                return res.status(404).json({
                    success: false,
                    message: 'Client not found'
                });
            }

            // Find attachment
            const attachment = client.attachments.id(attachmentId);
            if (!attachment) {
                return res.status(404).json({
                    success: false,
                    message: 'Attachment not found'
                });
            }

            // Get userId before removing attachment
            const deletedUserId = attachment.uploadedBy.userId;

            // Remove attachment
            attachment.remove();
            await client.save();

            // Emit socket event for real-time attachment deletion
            try {
                const io = getIO && getIO();
                if (io) {
                    const socketPayload = {
                        clientId: String(clientId),
                        attachmentId: String(attachmentId),
                        userId: deletedUserId
                    };

                    // Emit to client-specific room
                    io.to(`client:${clientId}`).emit('client:attachment:deleted', socketPayload);

                    // Emit to userId-specific room for the attachment's uploader
                    io.to(`user:${deletedUserId}`).emit('client:attachment:deleted', socketPayload);

                    // Emit to client-user combination room for filtered views
                    io.to(`client:${clientId}:user:${deletedUserId}`).emit('client:attachment:deleted', socketPayload);

                    // Emit globally
                    io.emit('client:attachment:deleted', socketPayload);

                    // Emit to assigned users' rooms
                    if (client.assignedUsers && client.assignedUsers.length > 0) {
                        client.assignedUsers.forEach(user => {
                            io.to(`user:${user.userId}`).emit('client:attachment:deleted', socketPayload);
                        });
                    }
                }
            } catch (e) {
                console.warn('Socket emission failed:', e.message);
            }

            res.status(200).json({
                success: true,
                message: 'Attachment deleted successfully',
                data: {
                    deletedAttachmentId: attachmentId,
                    clientId: clientId
                }
            });
        } catch (error) {
            next(error);
        }
    }
};

module.exports = clientManagementController;

