const mongoose = require('mongoose');
const { Schema } = mongoose;

// Slot time object within a date
const SlotTimeSchema = new Schema(
    {
        startTime: { type: String, required: true }, // e.g., "10:30"
        endTime: { type: String, required: true },   // e.g., "11:30"
        status: { type: String, enum: ['free', 'booked', 'completed', 'canceled'], default: 'booked' },
        bufferAfterMinutes: { type: Number, default: 20 },
        bufferEndsAt: { type: Date }
    },
    { _id: true }
);

// Date schema containing array of slotTimes
const DateSlotsSchema = new Schema(
    {
        monthDate: { type: Number, required: true }, // day of month (1-31)
        slotTime: [SlotTimeSchema]
    },
    { _id: false }
);

// Month schema containing array of dates
const MonthSlotsSchema = new Schema(
    {
        month: { type: Number, required: true }, // month number (1-12)
        monthDates: [DateSlotsSchema]
    },
    { _id: false }
);

// Year schema containing array of months
const YearSlotsSchema = new Schema(
    {
        year: { type: Number, required: true }, // year (e.g., 2025)
        months: [MonthSlotsSchema]
    },
    { _id: false }
);

// Embedded task inside the user's document
const EmbeddedTaskSchema = new Schema(
    {
        assignerId: { type: String, required: true }, // ASSIGNER_USER_ID (who assigned the task)
        taskName: { type: String, required: true },
        clientName: { type: String },
        category: { type: String },
        priority: { type: String, default: 'Medium' },
        timeSpend: { type: String },
        description: { type: String },
        taskImages: { type: [String], default: [] },
        taskStatus: { type: String, enum: ['pending', 'completed'], default: 'pending' },
        date: { type: String }, // e.g., "2025-11-05"
        position: { type: String },
        // Booked slots organized by year → month → date → slotTimes
        slotsBook: [YearSlotsSchema],
        // Chat metadata for quick access
        chatMeta: {
            lastMessage: { type: String, default: null },
            lastMessageAt: { type: Date, default: null },
            chatCount: { type: Number, default: 0 }
        },
        isArchived: { type: Boolean, default: false }
    },
    { timestamps: true }
);

// User-centric AddTaskAssign Schema
const AddTaskAssignSchema = new Schema(
    {
        receiverId: { type: String, required: true }, // RECEIVER/EXECUTION_USER_ID (who receives/executes the task)
        position: { type: String },
        // Tasks assigned to this user
        tasks: [EmbeddedTaskSchema]
    },
    {
        timestamps: true,
        collection: 'addTaskAssign'
    }
);

AddTaskAssignSchema.index({ receiverId: 1 }, { unique: true });

const AddTaskAssignModel = mongoose.model('AddTaskAssign', AddTaskAssignSchema);

module.exports = AddTaskAssignModel;