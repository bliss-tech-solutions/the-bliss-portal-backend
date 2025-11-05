const mongoose = require('mongoose');
const { Schema } = mongoose;

const SalaryRulesSchema = new Schema({
    paidLeavesPerMonth: { type: Number, default: 1 },
    deductionPerLeave: { type: Number, default: 500 }
}, {
    timestamps: true,
    collection: 'salaryRules'
});

module.exports = mongoose.model('SalaryRules', SalaryRulesSchema);


