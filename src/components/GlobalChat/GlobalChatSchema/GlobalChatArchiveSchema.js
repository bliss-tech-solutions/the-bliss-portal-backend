const mongoose = require('mongoose');
const { Schema } = mongoose;

// Global Chat Archive Schema - Tracks which messages each user has archived
const GlobalChatArchiveSchema = new Schema(
    {
        userId: { 
            type: String, 
            required: true,
            unique: true,  // One archive document per user
            trim: true,
            index: true
        },
        archivedMessageIds: [{ 
            type: Schema.Types.ObjectId, 
            ref: 'GlobalChatMessage',
            index: true
        }]
    },
    {
        timestamps: true,
        collection: 'globalchatarchives'
    }
);

// Index for efficient querying
GlobalChatArchiveSchema.index({ userId: 1 });
GlobalChatArchiveSchema.index({ archivedMessageIds: 1 });

// Export Model
const GlobalChatArchiveModel = mongoose.model('GlobalChatArchive', GlobalChatArchiveSchema);

module.exports = GlobalChatArchiveModel;


