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
                brochureLink,
                deliverableConfigs,
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

                // No restrictions - allow same user multiple times with any positions
                for (const user of assignedUsers) {
                    if (!user.userId || !user.name) {
                        return res.status(400).json({
                            success: false,
                            message: 'Each assigned user must have userId and name'
                        });
                    }

                    normalizedAssignedUsers.push({
                        userId: user.userId,
                        name: user.name.trim(),
                        position: user.position ? user.position.trim() : null
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
                brochureLink: brochureLink ? String(brochureLink).trim() : '',
                deliverableConfigs: deliverableConfigs || [],
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
                brochureLink,
                deliverableConfigs,
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
            if (brochureLink !== undefined) {
                updateData.brochureLink = String(brochureLink).trim();
            }
            if (deliverableConfigs !== undefined) {
                updateData.deliverableConfigs = deliverableConfigs;
            }
            if (assignedUsers !== undefined) {
                if (!Array.isArray(assignedUsers)) {
                    return res.status(400).json({
                        success: false,
                        message: 'assignedUsers must be an array'
                    });
                }

                const normalizedAssignedUsers = [];
                // No restrictions - allow same user multiple times with any positions

                for (const user of assignedUsers) {
                    if (!user.userId || !user.name) {
                        return res.status(400).json({
                            success: false,
                            message: 'Each assigned user must have userId and name'
                        });
                    }

                    normalizedAssignedUsers.push({
                        userId: user.userId,
                        name: user.name.trim(),
                        position: user.position ? user.position.trim() : null
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

            let attachments = (client.attachments || []).filter(att => !att.archived);


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

            let attachments = (client.attachments || []).filter(att => !att.archived);


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

    // GET /api/clientmanagement/:clientId/attachments/byUserId/:userId - Get attachments for a client (shows all attachments if userId is an assigner)
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

            // Check if userId is an assigner for this client
            const isAssigned = client.assignedUsers && client.assignedUsers.some(
                user => user.userId === userId
            );

            if (!isAssigned) {
                return res.status(403).json({
                    success: false,
                    message: 'User is not assigned to this client. Only assigned users can view attachments.'
                });
            }

            // If user is an assigner, show ALL non-archived attachments for the client
            let attachments = (client.attachments || []).filter(att => !att.archived);

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

            // Get the requesting user's info from assignedUsers
            const requestingUser = client.assignedUsers.find(user => user.userId === userId);

            res.status(200).json({
                success: true,
                message: 'Attachments retrieved successfully',
                data: {
                    clientId: String(clientId),
                    userId: userId,
                    userName: requestingUser ? requestingUser.name : null,
                    isAssigned: true,
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

            // Get userId before archiving attachment
            const deletedUserId = attachment.uploadedBy.userId;
            const attachmentName = attachment.notes || 'Attachment';

            // Soft delete: set archived to true instead of removing
            attachment.archived = true;
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
    },

    // PATCH /api/clientmanagement/:clientId/deliverables/update - Toggle any deliverable status dynamically
    updateDeliverableStatus: async (req, res, next) => {
        try {
            const { clientId } = req.params;
            const { type, index, status, month } = req.body; // type: e.g. 'drone', 'cinematic', index: 0-indexed, status: boolean

            if (!type || index === undefined || index < 0) {
                return res.status(400).json({
                    success: false,
                    message: 'Type and non-negative index are required.'
                });
            }

            const client = await ClientManagementModel.findById(clientId);
            if (!client) {
                return res.status(404).json({
                    success: false,
                    message: 'Client not found'
                });
            }

            // Find config for this type
            const config = client.deliverableConfigs.find(c => c.type === type);
            if (!config) {
                return res.status(400).json({
                    success: false,
                    message: `Deliverable type "${type}" is not configured for this client.`
                });
            }

            // Check index bounds
            if (index >= config.targetCount) {
                return res.status(400).json({
                    success: false,
                    message: `Invalid index for ${type}. Target count is ${config.targetCount}.`
                });
            }

            const currentMonth = month || new Date().toLocaleString('en-US', { month: 'short', year: 'numeric' });

            let entryIndex = client.monthlyDeliverables.findIndex(d => d.month === currentMonth);

            if (entryIndex === -1) {
                // Initialize new month entry using ALL deliverableConfigs
                const categories = client.deliverableConfigs.map(conf => ({
                    type: conf.type,
                    items: Array(conf.targetCount).fill(null).map(() => ({ status: false, updatedAt: new Date() }))
                }));

                const newEntry = {
                    month: currentMonth,
                    categories: categories,
                    updatedAt: new Date()
                };
                client.monthlyDeliverables.push(newEntry);
                entryIndex = client.monthlyDeliverables.length - 1;
            }

            // Find or create category in the current month entry
            let categoryIndex = client.monthlyDeliverables[entryIndex].categories.findIndex(c => c.type === type);

            if (categoryIndex === -1) {
                // If category missing (maybe added to config later), initialize it
                client.monthlyDeliverables[entryIndex].categories.push({
                    type: type,
                    items: Array(config.targetCount).fill(null).map(() => ({ status: false, updatedAt: new Date() }))
                });
                categoryIndex = client.monthlyDeliverables[entryIndex].categories.length - 1;
            }

            const category = client.monthlyDeliverables[entryIndex].categories[categoryIndex];

            // Ensure array has enough elements (safety)
            while (category.items.length <= index) {
                category.items.push({ status: false, updatedAt: new Date() });
            }

            // Toggle or set status
            const item = category.items[index];
            item.status = status !== undefined ? Boolean(status) : !item.status;
            item.updatedAt = new Date();

            client.monthlyDeliverables[entryIndex].updatedAt = new Date();

            await client.save();

            // Emit socket event for real-time update
            try {
                const io = getIO && getIO();
                if (io) {
                    // 1. Granular update
                    io.emit('client:deliverable:updated', {
                        clientId,
                        month: currentMonth,
                        type,
                        index,
                        status: item.status
                    });

                    // 2. Full Summary for dashboard
                    const summary = calculateClientSummary(client, currentMonth);
                    io.emit('client:summary:updated', {
                        clientId,
                        month: currentMonth,
                        summary
                    });
                }
            } catch (e) {
                console.warn('Socket emission failed:', e.message);
            }

            res.status(200).json({
                success: true,
                message: `${type} updated successfully`,
                data: client.monthlyDeliverables[entryIndex]
            });
        } catch (error) {
            next(error);
        }
    },

    // GET /api/clientmanagement/deliverables/summary - Get deliverables summary for all clients
    getDeliverablesSummary: async (req, res, next) => {
        try {
            const { month, userId } = req.query; // Optional: filter by month or userId
            const currentMonth = month || new Date().toLocaleString('en-US', { month: 'short', year: 'numeric' });

            const query = { status: 'active' };
            if (userId) {
                query['assignedUsers.userId'] = userId;
            }

            const clients = await ClientManagementModel.find(query).sort({ clientName: 1 });

            const summary = clients.map(client => calculateClientSummary(client, currentMonth));

            res.status(200).json({
                success: true,
                message: 'Deliverables summary retrieved successfully',
                month: currentMonth,
                data: summary,
                count: summary.length
            });
        } catch (error) {
            next(error);
        }
    },

    // GET /api/clientmanagement/deliverables/export - Get data for Excel export
    getDeliverablesExportData: async (req, res, next) => {
        try {
            const { startDate, endDate, city } = req.query;

            if (!startDate || !endDate) {
                return res.status(400).json({
                    success: false,
                    message: 'startDate and endDate are required.'
                });
            }

            const start = new Date(startDate);
            const end = new Date(endDate);

            if (isNaN(start.getTime()) || isNaN(end.getTime())) {
                return res.status(400).json({
                    success: false,
                    message: 'Invalid date format.'
                });
            }

            // Generate list of months in the range (e.g. ["Jan 2026", "Feb 2026"])
            const monthsInRange = [];
            let current = new Date(start.getFullYear(), start.getMonth(), 1);
            while (current <= end) {
                monthsInRange.push(current.toLocaleString('en-US', { month: 'short', year: 'numeric' }));
                current.setMonth(current.getMonth() + 1);
            }

            // Build query
            const query = { status: 'active' };
            if (city) {
                query.city = { $regex: new RegExp(city, 'i') };
            }

            const clients = await ClientManagementModel.find(query).sort({ clientName: 1 });

            const exportData = clients.map(client => {
                const row = {
                    "Client Name": client.clientName,
                    "City": client.city,
                    "Onboard Date": client.onboardDate ? new Date(client.onboardDate).toLocaleDateString() : 'N/A'
                };

                // Initialize totals for each configured deliverable type
                const totals = {};
                client.deliverableConfigs.forEach(conf => {
                    totals[conf.label || conf.type] = 0;
                });

                // Aggregate across requested months
                client.monthlyDeliverables.forEach(monthEntry => {
                    if (monthsInRange.includes(monthEntry.month)) {
                        monthEntry.categories.forEach(cat => {
                            const config = client.deliverableConfigs.find(c => c.type === cat.type);
                            const label = config ? (config.label || config.type) : cat.type;

                            const completed = cat.items.filter(item => item.status === true).length;
                            totals[label] = (totals[label] || 0) + completed;
                        });
                    }
                });

                // Add totals to row
                Object.assign(row, totals);

                return row;
            });

            res.status(200).json({
                success: true,
                message: 'Export data generated successfully',
                data: exportData,
                count: exportData.length,
                meta: {
                    startDate,
                    endDate,
                    monthsTracked: monthsInRange
                }
            });
        } catch (error) {
            next(error);
        }
    },

    // GET /api/clientmanagement/deliverables/export - Optimized data for Excel export
    getDeliverablesExportData: async (req, res, next) => {
        try {
            const { startDate, endDate, city } = req.query;

            if (!startDate || !endDate) {
                return res.status(400).json({
                    success: false,
                    message: 'startDate and endDate are required.'
                });
            }

            const start = new Date(startDate);
            const end = new Date(endDate);

            if (isNaN(start.getTime()) || isNaN(end.getTime())) {
                return res.status(400).json({
                    success: false,
                    message: 'Invalid date format.'
                });
            }

            // Generate list of months in the range (e.g. ["Jan 2026", "Feb 2026"])
            const monthsInRange = [];
            let current = new Date(start.getFullYear(), start.getMonth(), 1);
            while (current <= end) {
                monthsInRange.push(current.toLocaleString('en-US', { month: 'short', year: 'numeric' }));
                current.setMonth(current.getMonth() + 1);
            }

            // Build query
            const query = { status: 'active' };
            if (city) {
                query.city = { $regex: new RegExp(city, 'i') };
            }

            const clients = await ClientManagementModel.find(query).sort({ clientName: 1 });

            // Flatten data for easy frontend Excel export
            const exportData = clients.map(client => {
                const row = {
                    "Client Name": client.clientName,
                    "City": client.city,
                    "Onboard Date": client.onboardDate ? new Date(client.onboardDate).toLocaleDateString() : 'N/A'
                };

                // Initialize counts for EVERY configured category for this client
                client.deliverableConfigs.forEach(conf => {
                    const label = conf.label || conf.type;
                    row[label] = 0;
                });

                // Sum up completed items across the requested months
                client.monthlyDeliverables.forEach(monthEntry => {
                    if (monthsInRange.includes(monthEntry.month)) {
                        monthEntry.categories.forEach(cat => {
                            const config = client.deliverableConfigs.find(c => c.type === cat.type);
                            const label = config ? (config.label || config.type) : cat.type;

                            const completedCount = cat.items.filter(item => item.status === true).length;
                            row[label] = (row[label] || 0) + completedCount;
                        });
                    }
                });

                return row;
            });

            res.status(200).json({
                success: true,
                message: 'Export data generated successfully',
                data: exportData,
                count: exportData.length
            });
        } catch (error) {
            next(error);
        }
    },

    // GET /api/clientmanagement/tracker/:userId - Get bulk tracker data for a specific user
    getTrackerDataByUserId: async (req, res, next) => {
        try {
            const { userId } = req.params;

            // Find all clients assigned to this user
            const clients = await ClientManagementModel.find({
                'assignedUsers.userId': userId,
                status: 'active'
            }).sort({ clientName: 1 });

            if (clients.length === 0) {
                return res.status(200).json({
                    success: true,
                    message: 'No clients found for this user',
                    data: []
                });
            }

            const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

            const trackerData = clients.map(client => {
                const monthlyStatus = {};

                // Initialize all months as false
                months.forEach(m => {
                    monthlyStatus[m] = false;
                });

                // Mark months as true if they have at least one non-archived attachment
                if (client.attachments && client.attachments.length > 0) {
                    client.attachments.forEach(att => {
                        if (!att.archived && months.includes(att.month)) {
                            monthlyStatus[att.month] = true;
                        }
                    });
                }

                return {
                    clientId: client._id,
                    clientName: client.clientName,
                    city: client.city,
                    monthlyStatus: monthlyStatus
                };
            });

            res.status(200).json({
                success: true,
                message: 'Tracker data retrieved successfully',
                data: trackerData,
                count: trackerData.length
            });
        } catch (error) {
            next(error);
        }
    },

    // GET /api/clientmanagement/attachment-link - Get attachment link by clientId, year and month
    getAttachmentLink: async (req, res, next) => {
        try {
            const { clientId, year, month } = req.query;

            // Validate required fields
            if (!clientId || !year || !month) {
                return res.status(400).json({
                    success: false,
                    message: 'Missing required query parameters: clientId, year, and month are required'
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

            // Filter attachments by month, year (from createdAt) and non-archived
            let matchingAttachments = (client.attachments || []).filter(att => {
                if (att.archived) return false;
                if (att.month !== month) return false;

                // Extract year from createdAt
                const attYear = new Date(att.createdAt).getFullYear().toString();
                return attYear === year.toString();
            });

            if (matchingAttachments.length === 0) {
                return res.status(404).json({
                    success: false,
                    message: `No matching attachment found for year ${year} and month ${month}`
                });
            }

            // Sort by createdAt (newest first) and get the first one
            matchingAttachments.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
            const latestAttachment = matchingAttachments[0];

            res.status(200).json({
                success: true,
                message: 'Attachment link retrieved successfully',
                data: {
                    link: latestAttachment.link,
                    attachment: latestAttachment
                }
            });
        } catch (error) {
            next(error);
        }
    }
};

// Helper function to calculate summary for a specific client and month
const calculateClientSummary = (client, currentMonth) => {
    // Find the deliverables for the specified month
    const monthData = client.monthlyDeliverables.find(d => d.month === currentMonth);

    let totalCompleted = 0;
    let totalTarget = 0;

    const categoriesSummary = client.deliverableConfigs.map(config => {
        const categoryData = monthData ? monthData.categories.find(c => c.type === config.type) : null;

        const target = config.targetCount || 0;
        const status = categoryData
            ? categoryData.items.map(item => item.status || false)
            : Array(target).fill(false);

        const completed = status.filter(s => s === true).length;

        totalCompleted += completed;
        totalTarget += target;

        return {
            type: config.type,
            label: config.label,
            completed,
            total: target,
            pending: target - completed,
            status
        };
    });

    return {
        clientId: client._id,
        clientName: client.clientName,
        city: client.city,
        assignedUsers: client.assignedUsers,
        month: currentMonth,
        deliverables: categoriesSummary,
        overallProgress: {
            totalItems: totalTarget,
            completedItems: totalCompleted,
            pendingItems: totalTarget - totalCompleted,
            percentageComplete: totalTarget > 0 ? Math.round((totalCompleted / totalTarget) * 100) : 0
        }
    };
};

module.exports = clientManagementController;

