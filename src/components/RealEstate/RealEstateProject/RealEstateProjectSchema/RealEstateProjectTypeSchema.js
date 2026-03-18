const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const realEstateProjectTypeSchema = new Schema(
    {
        name: { type: String, required: true, unique: true, trim: true }
    },
    {
        timestamps: true,
        collection: 'realEstateProjectTypes'
    }
);

const RealEstateProjectTypeModel = mongoose.model('RealEstateProjectType', realEstateProjectTypeSchema);

module.exports = RealEstateProjectTypeModel;