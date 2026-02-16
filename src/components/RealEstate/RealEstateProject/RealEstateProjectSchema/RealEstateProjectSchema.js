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
    projectPrice: {
        type: String,
        required: true
    },
    projectImages: {
        type: [String],
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
    tag: {
        type: String,
        enum: ['Exclusive deal', 'Limited time offer'],
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
