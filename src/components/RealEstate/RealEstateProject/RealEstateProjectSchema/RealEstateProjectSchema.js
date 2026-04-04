const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const realEstateProjectSchema = new Schema({
    projectName: {
        type: String,
        required: true
    },
    projectLocation: {
        type: String,
        required: true
    },
    projectType: {
        type: String,
        required: false,
        trim: true
    },
    bhk: {
        type: String,
        required: false,
        trim: true
    },
    projectImages: {
        type: [String],
        default: []
    },
    floorPlanImages: {
        type: [String],
        default: []
    },
    projectSlideHeroImages: {
        type: [String],
        default: []
    },
    projectCards: {
        type: [
            {
                title: { type: String, required: true, trim: true },
                value: { type: String, required: true, trim: true },
                icon: { type: String, required: true, trim: true }
            }
        ],
        default: []
    },
    groupSize: {
        type: Number,
        required: true
    },
    projectDescriptionAndDetails: {
        type: String,
        required: true
    },
    latitude: {
        type: String,
        required: false
    },
    longitude: {
        type: String,
        required: false
    },
    amenities: [
        {
            name: { type: String, required: true },
            icon: { type: String, required: true }
        }
    ],
    status: {
        type: String,
        enum: ['active', 'inactive'],
        default: 'active'
    }
}, {
    timestamps: true,
    collection: 'realEstateProjects'
});

const RealEstateProjectModel = mongoose.model('RealEstateProject', realEstateProjectSchema);

module.exports = RealEstateProjectModel;
