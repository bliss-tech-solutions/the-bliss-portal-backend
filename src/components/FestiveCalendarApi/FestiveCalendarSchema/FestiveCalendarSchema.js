const mongoose = require('mongoose');
const { Schema } = mongoose;

// Festive Calendar Schema - stores multiple notes per date
const FestiveCalendarSchema = new Schema(
    {
        date: { type: String, required: true, index: true }, // YYYY-MM-DD
        notes: [
            {
                note: { type: String, required: true }, // Corresponds to "Event Title"
                eventType: { type: String }, // e.g., "Meeting (Red)", "Task (Green)", etc.
                userId: { type: String },
                color: { type: String },
                archive: { type: Boolean, default: false },
                description: { type: String },
                createdAt: { type: Date, default: Date.now }
            }
        ]
    },
    {
        timestamps: true,
        collection: 'festiveCalendar'
    }
);

// Unique one doc per date
FestiveCalendarSchema.index({ date: 1 }, { unique: true });

const FestiveCalendarModel = mongoose.model('FestiveCalendar', FestiveCalendarSchema);
module.exports = FestiveCalendarModel;


