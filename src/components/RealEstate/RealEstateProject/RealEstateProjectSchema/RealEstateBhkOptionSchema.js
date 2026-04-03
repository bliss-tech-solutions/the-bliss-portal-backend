const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const realEstateBhkOptionSchema = new Schema(
    {
        name: { type: String, required: true, unique: true, trim: true }
    },
    {
        timestamps: true,
        collection: 'realEstateBhkOptions'
    }
);

const RealEstateBhkOptionModel = mongoose.model('RealEstateBhkOption', realEstateBhkOptionSchema);

module.exports = RealEstateBhkOptionModel;

