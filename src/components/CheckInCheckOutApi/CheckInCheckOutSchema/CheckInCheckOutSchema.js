const mongoose = require('mongoose');
const { Schema } = mongoose;

// Check In Check Out Schema
const CheckInCheckOutSchema = new Schema(
    {
        userId: { type: String, required: true, unique: true, index: true },
        CheckInCheckOutTime: [
            {
                date: { type: String, required: true }, // YYYY-MM-DD
                checkInAt: { type: Date },
                checkOutAt: { type: Date },
                totalHours: { type: Number },
                reason: { type: String },
                checkInReason: { type: String },
                checkOutReason: { type: String },
                checkInStatus: { type: String },
                checkOutStatus: { type: String }
            }
        ]
    },
    {
        timestamps: true,
        collection: 'checkInCheckOut',
    }
);

// Export Model
const CheckInCheckOutModel = mongoose.model('CheckInCheckOut', CheckInCheckOutSchema);

module.exports = CheckInCheckOutModel;
