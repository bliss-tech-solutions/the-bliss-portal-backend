const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const realEstateUserSchema = new Schema({
    fullName: {
        type: String,
        required: true
    },
    mobileNumber: {
        type: String,
        required: true,
        unique: true
    },
    email: {
        type: String,
        required: true,
        unique: true
    },
    password: {
        type: String,
        required: true
    },
    isArchived: {
        type: Boolean,
        default: false
    }
}, {
    timestamps: true,
    collection: 'realEstateUsers'
});

const RealEstateUserModel = mongoose.model('RealEstateUser', realEstateUserSchema);

module.exports = RealEstateUserModel;
