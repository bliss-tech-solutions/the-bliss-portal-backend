const mongoose = require('mongoose');
const { Schema, Types } = mongoose;

// AddTaskAssign Schema (from provided frontend form)
const AddTaskAssignSchema = new Schema(
    {
        userId: { type: String }, // reference to UserDetails.userId - Creator/Sender
        receiverUserId: { type: String }, // Task receiver
        position: { type: String }, // e.g. graphic_designer, video_editor
        workParentType: { type: String },
        workChildType: { type: String },
        taskName: { type: String },
        clientName: { type: String },
        category: { type: String },
        priority: { type: String },
        timeSpend: { type: String }, // e.g., "12:45:00"
        description: { type: String },
        taskImages: { type: [String], default: [] }, // Cloudinary URLs
        attachments: { type: [String], default: [] },
        slots: [
            {
                _id: { type: Schema.Types.ObjectId, default: () => new Types.ObjectId() },
                start: { type: String }, // frontend sends HH:mm or ISO strings
                end: { type: String },
                slotDate: { type: Date }, // optional actual day for the slot
                durationMinutes: { type: Number },
                status: {
                    type: String,
                    enum: ['scheduled', 'active', 'completed', 'expired', 'cancelled'],
                    default: 'scheduled'
                },
                extensionMinutes: { type: Number, default: 0 },
                extensionHistory: [
                    {
                        requestedBy: { type: String },
                        requestedAt: { type: Date },
                        minutesRequested: { type: Number },
                        reason: { type: String },
                        status: {
                            type: String,
                            enum: ['pending', 'approved', 'rejected'],
                            default: 'pending'
                        },
                        respondedBy: { type: String },
                        respondedAt: { type: Date }
                    }
                ]
            }
        ],
        signOutRequests: [
            {
                requestedBy: { type: String },
                requestedAt: { type: Date },
                reason: { type: String },
                status: {
                    type: String,
                    enum: ['pending', 'approved', 'rejected'],
                    default: 'pending'
                },
                respondedBy: { type: String },
                respondedAt: { type: Date }
            }
        ],
        timeTracking: {
            originalSlotMinutes: { type: Number, default: 0 },
            totalExtendedMinutes: { type: Number, default: 0 },
            totalWorkedMinutes: { type: Number, default: 0 },
            completedAt: { type: Date }
        },
        taskStatus: { type: String, enum: ['pending', 'in_progress', 'completed', 'cancelled'], default: 'pending' },
        // Chat messages for task-specific conversations
        chatMessages: [
            {
                userId: { type: String },
                user: { type: String },
                time: { type: Date },
                message: { type: String }
            }
        ],
        // Archive controls
        isArchived: { type: Boolean, default: false },
        archivedAt: { type: Date },
        archivedBy: { type: String }, // userId of the actor
        // Chat decoupled into separate collection; keep metadata for quick views
        lastMessage: { type: String },
        lastMessageAt: { type: Date },
        chatCount: { type: Number, default: 0 }
    },
    {
        timestamps: true,
        collection: 'addTaskAssign'
    }
);

// Export Model
const AddTaskAssignModel = mongoose.model('AddTaskAssign', AddTaskAssignSchema);

module.exports = AddTaskAssignModel;


