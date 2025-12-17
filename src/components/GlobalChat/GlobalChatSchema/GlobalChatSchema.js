const mongoose = require('mongoose');
const { Schema } = mongoose;

// Global Chat Message Schema - ALL users can see ALL messages
const GlobalChatMessageSchema = new Schema(
    {
        senderId: { 
            type: String, 
            required: true,
            trim: true 
        },
        senderName: { 
            type: String, 
            required: true,
            trim: true 
        },
        senderEmail: { 
            type: String, 
            trim: true,
            default: '' 
        },
        message: { 
            type: String, 
            required: true,
            trim: true 
        },
        messageType: { 
            type: String, 
            enum: ['text', 'image', 'video', 'file'],
            default: 'text',
            required: true 
        },
        time: { 
            type: String, 
            required: true,
            trim: true 
        },
        archived: { 
            type: Boolean, 
            default: false 
        }
    },
    {
        timestamps: true,
        collection: 'globalchatmessages'
    }
);

// Index for efficient querying
GlobalChatMessageSchema.index({ createdAt: -1 });
GlobalChatMessageSchema.index({ senderId: 1 });
GlobalChatMessageSchema.index({ archived: 1 });

// Export Model
const GlobalChatMessageModel = mongoose.model('GlobalChatMessage', GlobalChatMessageSchema);

module.exports = GlobalChatMessageModel;

