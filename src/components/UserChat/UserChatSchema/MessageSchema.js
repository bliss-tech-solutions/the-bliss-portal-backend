const mongoose = require('mongoose');
const { Schema } = mongoose;

const MessageSchema = new Schema(
    {
        conversationId: { type: String, required: true, index: true }, // String ID of conversation
        senderId: { type: String, required: true }, // String userId like "alok-bliss-206"
        senderName: { type: String }, // For display purposes
        message: { type: String, required: true },
        messageType: { type: String, enum: ['text', 'image', 'video', 'file'], default: 'text' },
        time: { type: String }, // Display time like "16:56"

        // Delivery and read status
        deliveryStatus: {
            type: String,
            enum: ['sent', 'delivered', 'read'],
            default: 'sent'
        },
        readBy: [{
            userId: { type: String },
            readAt: { type: Date }
        }], // Array of objects with userId and timestamp

        // Message features
        replyTo: {
            type: String, // messageId being replied to
            ref: 'UserMessage'
        },
        isDeleted: { type: Boolean, default: false }, // Soft deletion
        deletedFor: [{ type: String }], // Array of userIds who deleted this message

        // Analytics metadata
        messageMetadata: {
            deviceInfo: { type: String }, // 'mobile', 'web', 'desktop'
            platform: { type: String }, // 'ios', 'android', 'web', 'windows', 'mac'
            ipAddress: { type: String }
        }
    },
    {
        timestamps: true,
        collection: 'userMessages'
    }
);

// Indexes for faster queries and analytics
MessageSchema.index({ conversationId: 1, createdAt: -1 });
MessageSchema.index({ senderId: 1, createdAt: -1 });
MessageSchema.index({ deliveryStatus: 1 });
MessageSchema.index({ 'readBy.userId': 1 });

const MessageModel = mongoose.model('UserMessage', MessageSchema);

module.exports = MessageModel;
