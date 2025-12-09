const mongoose = require('mongoose');
const { Schema } = mongoose;

// Client Management Schema
const ClientManagementSchema = new Schema(
    {
        clientName: { type: String, required: true },
        city: { type: String, required: true },
        onboardDate: { type: Date, required: true },
        status: { 
            type: String, 
            enum: ['active', 'inactive'], 
            default: 'active',
            required: true 
        }
    },
    {
        timestamps: true,
        collection: 'clientManagement', // Collection in database
    }
);

// Export Model
const ClientManagementModel = mongoose.model('ClientManagement', ClientManagementSchema);

module.exports = ClientManagementModel;

