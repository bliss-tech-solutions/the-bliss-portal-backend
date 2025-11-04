const mongoose = require('mongoose');
const { Schema } = mongoose;

const LeaveSchema = new Schema({
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    status: { type: String, enum: ['pending', 'approved', 'rejected', 'partially_approved', 'cancelled'], default: 'pending' },
    approvedDates: { type: [Date], default: [] },
    rejectedDates: { type: [Date], default: [] },
    instructions: { type: String },
    history: [{
        status: { type: String, required: true },
        at: { type: Date, default: Date.now },
        by: { type: String },
        note: { type: String },
        approvedDates: { type: [Date], default: [] },
        rejectedDates: { type: [Date], default: [] }
    }],
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
});

const MonthlyLeavesSchema = new Schema({
    month: { type: String, required: true }, // e.g., "OCT", "NOV"
    leaves: [LeaveSchema],
    reason: { type: String },
}, { _id: false });

const UserLeavesSchema = new Schema({
    userId: { type: String, required: true, unique: true, index: true },
    months: [MonthlyLeavesSchema]
}, {
    timestamps: true,
    collection: 'userLeaves'
});

const UserLeavesModel = mongoose.model('UserLeaves', UserLeavesSchema);
module.exports = UserLeavesModel;


