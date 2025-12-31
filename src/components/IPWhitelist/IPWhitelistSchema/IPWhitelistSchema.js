const mongoose = require('mongoose');
const { Schema } = mongoose;

// Simple IP Whitelist Schema - stores only the active IP
const IPWhitelistSchema = new Schema(
    {
        ipAddress: {
            type: String,
            required: true,
            unique: true,
            trim: true
        },
        isActive: {
            type: Boolean,
            default: true
        },
        description: {
            type: String,
            default: ''
        }
    },
    {
        timestamps: true,
        collection: 'ipWhitelist'
    }
);

// Index for faster lookups
IPWhitelistSchema.index({ isActive: 1 });

const IPWhitelistModel = mongoose.model('IPWhitelist', IPWhitelistSchema);

module.exports = IPWhitelistModel;

