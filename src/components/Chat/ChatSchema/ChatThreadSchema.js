const mongoose = require('mongoose');
const { Schema } = mongoose;

const MessageSchema = new Schema(
    {
        senderId: { type: String },
        receiverId: { type: String },
        userId: { type: String },
        userName: { type: String },
        message: { type: String },
        time: { type: String },
        createdAt: { type: Date, default: Date.now }
    },
    { _id: false }
);

const ChatThreadSchema = new Schema(
    {
        taskId: { type: Schema.Types.ObjectId, ref: 'AddTaskAssign', unique: true, index: true },
        messages: { type: [MessageSchema], default: [] }
    },
    {
        timestamps: true,
        collection: 'chatThreads'
    }
);

const ChatThreadModel = mongoose.model('ChatThread', ChatThreadSchema);

module.exports = ChatThreadModel;


