const mongoose = require('mongoose');
const { Schema } = mongoose;

// Check In Check Out Schema
const CheckInCheckOutSchema = new Schema(
    {
        userId: { type: String, required: true, index: true }, // reference to UserDetails.userId
        date: { type: String, required: true }, // format: "2025-10-16" (YYYY-MM-DD)
        checkIn: {
            time: { type: String }, // format: "09:30 AM" or "09:30:00"
            timestamp: { type: Date }, // actual check-in time
            location: { type: String }, // optional: GPS coordinates or address
            device: { type: String } // optional: device info
        },
        checkOut: {
            time: { type: String }, // format: "06:30 PM" or "18:30:00"
            timestamp: { type: Date }, // actual check-out time
            location: { type: String }, // optional: GPS coordinates or address
            device: { type: String } // optional: device info
        },
        totalHours: { type: Number }, // calculated total working hours
        status: {
            type: String,
            enum: ['checked-in', 'checked-out', 'absent'],
            default: 'checked-in'
        },
        notes: { type: String } // optional notes for the day
    },
    {
        timestamps: true,
        collection: 'checkInCheckOut',
    }
);

// Compound index to ensure one record per user per date
CheckInCheckOutSchema.index({ userId: 1, date: 1 }, { unique: true });

// Export Model
const CheckInCheckOutModel = mongoose.model('CheckInCheckOut', CheckInCheckOutSchema);

module.exports = CheckInCheckOutModel;
