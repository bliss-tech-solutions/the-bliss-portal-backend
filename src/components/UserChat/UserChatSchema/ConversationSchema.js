const mongoose = require('mongoose');
const { Schema } = mongoose;

const ConversationSchema = new Schema(
    {
        participants: [{ type: String }], // String userId like "alok-bliss-206"
        type: { type: String, enum: ['individual', 'group'], default: 'individual' },
        groupName: { type: String },
        groupAdmin: [{ type: String }], // String userId for group admins
        groupIcon: { type: String }, // URL to group icon/photo
        createdBy: { type: String }, // userId who created the conversation

        // Last message preview (WhatsApp-style)
        lastMessage: {
            text: String,
            senderId: String,
            senderName: String,
            createdAt: { type: Date }
        },

        // User preferences
        isArchived: { type: Boolean, default: false }, // Archive conversation
        isMuted: [{ type: String }], // Array of userIds who muted this conversation
        deletedFor: [{ type: String }], // Array of userIds who deleted this conversation

        // Analytics fields
        messageCount: { type: Number, default: 0 }, // Total messages in conversation
        participantDetails: [{
            userId: String,
            firstName: String,
            lastName: String,
            profilePhoto: String,
            role: String,
            position: String
        }] // Snapshot of participant info for analytics
    },
    {
        timestamps: true,
        collection: 'conversations'
    }
);

// Indexes for better query performance
ConversationSchema.index({ participants: 1, updatedAt: -1 });
ConversationSchema.index({ type: 1 });
ConversationSchema.index({ 'lastMessage.createdAt': -1 });

const ConversationModel = mongoose.model('Conversation', ConversationSchema);

module.exports = ConversationModel;
