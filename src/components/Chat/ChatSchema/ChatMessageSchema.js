const mongoose = require('mongoose');
const { Schema } = mongoose;

// Chat message stored separately for scalability
const ChatMessageSchema = new Schema(
    {
        taskId: { type: Schema.Types.ObjectId, ref: 'AddTaskAssign' },
        taskRef: { type: String }, // optional human-readable id if needed
        userId: { type: String },  // from UserDetails.userId
        userName: { type: String },
        message: { type: String },
        time: { type: String } // keep provided display time
    },
    {
        timestamps: true,
        collection: 'chatMessages'
    }
);

const ChatMessageModel = mongoose.model('ChatMessage', ChatMessageSchema);

module.exports = ChatMessageModel;




