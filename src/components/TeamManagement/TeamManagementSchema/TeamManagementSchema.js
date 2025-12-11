const mongoose = require('mongoose');
const { Schema } = mongoose;

// Team Member Schema (embedded in Team)
const TeamMemberSchema = new Schema({
    userId: { type: String, required: true }, // UserDetails userId
    name: { type: String, required: true }, // User's name
    role: { 
        type: String, 
        enum: ['member', 'teamLeader'], 
        default: 'member',
        required: true 
    }
}, { _id: false });

// Team Management Schema
const TeamManagementSchema = new Schema(
    {
        teamName: { type: String, required: true, unique: true },
        members: { 
            type: [TeamMemberSchema], 
            required: true,
            validate: {
                validator: function(members) {
                    return members && members.length > 0;
                },
                message: 'Team must have at least one member'
            }
        },
        teamLeader: { 
            type: String, 
            required: true 
        } // userId of the team leader
    },
    {
        timestamps: true,
        collection: 'teamManagement', // Collection in database
    }
);

// Export Model
const TeamManagementModel = mongoose.model('TeamManagement', TeamManagementSchema);

module.exports = TeamManagementModel;

