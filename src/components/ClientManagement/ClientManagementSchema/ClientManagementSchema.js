const mongoose = require('mongoose');
const { Schema } = mongoose;

// Assigned User Schema (embedded in ClientManagement)
const AssignedUserSchema = new Schema({
    userId: { type: String, required: true },
    name: { type: String, required: true },
    position: { type: String, required: false }
}, { _id: false });

// Attachment Schema (embedded in ClientManagement)
const AttachmentSchema = new Schema({
    link: {
        type: String,
        required: true,
        trim: true
    },
    notes: {
        type: String,
        default: '',
        trim: true
    },
    month: {
        type: String,
        enum: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
        required: true
    },
    uploadedBy: {
        userId: { type: String, required: true },
        name: { type: String, required: true }
    },
    archived: {
        type: Boolean,
        default: false
    }
}, {
    timestamps: true,
    _id: true
});

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
        },
        itsDataReceived: {
            type: Boolean,
            default: false
        },
        assignedUsers: {
            type: [AssignedUserSchema],
            default: []
        },
        attachments: {
            type: [AttachmentSchema],
            default: []
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

