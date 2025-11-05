const mongoose = require('mongoose');
const { Schema } = mongoose;

const SalaryHistorySchema = new Schema({
    userId: { type: String, required: true, index: true },
    month: { type: Number, required: true }, // 1-12
    year: { type: Number, required: true },
    monthlySalary: { type: Number, required: true },
    paidLeavesAllowed: { type: Number, required: true },
    leavesTaken: { type: Number, required: true },
    unpaidLeaves: { type: Number, required: true },
    deductionPerLeave: { type: Number, required: true },
    totalDeduction: { type: Number, required: true },
    finalSalary: { type: Number, required: true },
    breakdown: { type: Object }, // optional detailed breakdown
    payslipUrl: { type: String }
}, {
    timestamps: true,
    collection: 'salaryHistory'
});

SalaryHistorySchema.index({ userId: 1, month: 1, year: 1 }, { unique: true });

module.exports = mongoose.model('SalaryHistory', SalaryHistorySchema);


