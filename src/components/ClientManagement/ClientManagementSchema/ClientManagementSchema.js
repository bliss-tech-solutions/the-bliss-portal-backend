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
        brochureLink: {
            type: String,
            default: '',
            trim: true
        },
        deliverableConfigs: [{
            type: { type: String, required: true }, // e.g. "reels", "drone"
            label: { type: String, required: true }, // e.g. "Reels", "Drone Shots"
            targetCount: { type: Number, required: true, default: 0 }
        }],
        assignedUsers: {
            type: [AssignedUserSchema],
            default: []
        },
        attachments: {
            type: [AttachmentSchema],
            default: []
        },
        monthlyDeliverables: [{
            month: { type: String, required: true }, // e.g. "Feb 2026"
            categories: [{
                type: { type: String, required: true }, // Matches deliverableConfigs.type
                items: [{
                    status: { type: Boolean, default: false },
                    updatedAt: { type: Date, default: Date.now }
                }]
            }],
            updatedAt: { type: Date, default: Date.now }
        }]
    },
    {
        timestamps: true,
        collection: 'clientManagement', // Collection in database
    }
);

// Export Model
const ClientManagementModel = mongoose.model('ClientManagement', ClientManagementSchema);

module.exports = ClientManagementModel;

