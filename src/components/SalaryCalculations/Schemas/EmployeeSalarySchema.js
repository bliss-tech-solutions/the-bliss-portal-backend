const mongoose = require('mongoose');
const { Schema } = mongoose;

const EmployeeSalarySchema = new Schema({
    userId: { type: String, required: true, unique: true, index: true },
    monthlySalary: { type: Number, required: true },
    effectiveFrom: { type: Date, required: true },
    employeeType: { type: String }
}, {
    timestamps: true,
    collection: 'employeeSalaries'
});

module.exports = mongoose.model('EmployeeSalary', EmployeeSalarySchema);


