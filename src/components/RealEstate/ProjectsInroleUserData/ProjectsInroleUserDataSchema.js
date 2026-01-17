const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const projectsInroleUserDataSchema = new Schema({
    projectId: {
        type: Schema.Types.ObjectId,
        ref: 'RealEstateProject',
        required: true,
        unique: true
    },
    users: [{
        userId: {
            type: Schema.Types.ObjectId,
            ref: 'RealEstateUser'
        },
        enrolledAt: {
            type: Date,
            default: Date.now
        }
    }],
    groupSize: {
        type: Number,
        required: true
    },
    remainingGroupSize: {
        type: Number,
        required: true
    }
}, {
    timestamps: true,
    collection: 'ProjectsInroleUserData'
});

const ProjectsInroleUserDataModel = mongoose.model('ProjectsInroleUserData', projectsInroleUserDataSchema);

module.exports = ProjectsInroleUserDataModel;
