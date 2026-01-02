const mongoose = require('mongoose');

const TaskSchema = new mongoose.Schema({
    title: {
        type: String,
        required: [true, 'Task title is required'],
        trim: true
    },
    priority: {
        type: String,
        enum: ['Low', 'Medium', 'High'],
        default: 'Medium'
    },
    status: {
        type: String,
        enum: ['Not Started', 'In Process', 'Completed'],
        default: 'Not Started'
    },
    referenceData: [{
        type: {
            type: String,
            enum: ['image', 'text'],
            required: true
        },
        content: {
            type: String,
            required: true
        }
    }],
    createdAt: {
        type: Date,
        default: Date.now
    },
    updatedAt: {
        type: Date,
        default: Date.now
    }
});

const DailyWorkingSchema = new mongoose.Schema({
    userId: {
        type: String,
        required: true
    },
    date: {
        type: Date,
        default: Date.now
    },
    tasks: [TaskSchema]
}, {
    timestamps: true
});

// Create index for fast lookups by userId and date
DailyWorkingSchema.index({ userId: 1, date: 1 });

module.exports = mongoose.model('DailyWorking', DailyWorkingSchema);
