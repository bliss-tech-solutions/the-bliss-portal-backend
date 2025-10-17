const mongoose = require('mongoose');
const { Schema } = mongoose;

// AddTaskAssign Schema (from provided frontend form)
const AddTaskAssignSchema = new Schema(
    {
        userId: { type: String }, // reference to UserDetails.userId - Creator/Sender
        receiverUserId: { type: String }, // Task receiver
        taskName: { type: String },
        clientName: { type: String },
        category: { type: String },
        priority: { type: String },
        timeSpend: { type: String }, // e.g., "12:45:00"
        description: { type: String },
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


