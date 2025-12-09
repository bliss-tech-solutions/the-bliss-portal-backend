const ClientManagementModel = require('./ClientManagementSchema/ClientManagementSchema');

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

    // POST /api/clientmanagement/create - Create new client
    create: async (req, res, next) => {
        try {
            const {
                clientName,
                city,
                onboardDate,
                status
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
                status: normalizedStatus
            });

            const savedClient = await newClient.save();

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
                status
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

            const updatedClient = await ClientManagementModel.findByIdAndUpdate(
                clientId,
                updateData,
                { new: true, runValidators: true }
            );

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
    }
};

module.exports = clientManagementController;

