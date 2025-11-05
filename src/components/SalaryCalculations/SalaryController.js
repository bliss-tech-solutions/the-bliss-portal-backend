const EmployeeSalary = require('./Schemas/EmployeeSalarySchema');
const SalaryRules = require('./Schemas/SalaryRulesSchema');
const SalaryHistory = require('./Schemas/SalaryHistorySchema');
const UserLeaves = require('../LeavesApi/LeavesSchema/LeavesSchema');

const ensureRules = async () => {
    let rules = await SalaryRules.findOne({});
    if (!rules) rules = await SalaryRules.create({});
    return rules;
};

const getDaysInRange = (start, end) => {
    const dates = [];
    const d = new Date(start);
    const e = new Date(end);
    while (d <= e) { dates.push(new Date(d)); d.setDate(d.getDate() + 1); }
    return dates;
};

const countApprovedDaysForMonth = (doc, monthStr) => {
    if (!doc) return 0;
    const month = (doc.months || []).find(m => m.month === monthStr.toUpperCase());
    if (!month) return 0;
    let count = 0;
    for (const leave of (month.leaves || [])) {
        if (leave.status === 'approved') {
            count += getDaysInRange(leave.startDate, leave.endDate).length;
        } else if (leave.status === 'partially_approved') {
            count += (leave.approvedDates || []).length;
        }
    }
    return count;
};

const salaryController = {
    // Employee salary management
    upsertEmployee: async (req, res, next) => {
        try {
            const { userId, monthlySalary, effectiveFrom, employeeType } = req.body;
            const updated = await EmployeeSalary.findOneAndUpdate(
                { userId },
                { userId, monthlySalary, effectiveFrom, employeeType },
                { upsert: true, new: true }
            );
            res.status(200).json({ success: true, data: updated });
        } catch (e) { next(e); }
    },
    getEmployee: async (req, res, next) => {
        try { const doc = await EmployeeSalary.findOne({ userId: req.params.userId }); res.status(200).json({ success: true, data: doc }); }
        catch (e) { next(e); }
    },
    getAllEmployees: async (_req, res, next) => {
        try { const docs = await EmployeeSalary.find({}); res.status(200).json({ success: true, data: docs, count: docs.length }); }
        catch (e) { next(e); }
    },

    // Rules
    getRules: async (_req, res, next) => { try { const rules = await ensureRules(); res.status(200).json({ success: true, data: rules }); } catch (e) { next(e); } },
    updateRules: async (req, res, next) => {
        try {
            const { paidLeavesPerMonth, deductionPerLeave } = req.body; const rules = await ensureRules();
            if (typeof paidLeavesPerMonth === 'number') rules.paidLeavesPerMonth = paidLeavesPerMonth;
            if (typeof deductionPerLeave === 'number') rules.deductionPerLeave = deductionPerLeave;
            await rules.save(); res.status(200).json({ success: true, data: rules });
        }
        catch (e) { next(e); }
    },

    // Salary calculation
    calculate: async (req, res, next) => {
        try {
            const { userId } = req.params; let { month, year } = req.params;
            month = parseInt(month, 10); year = parseInt(year, 10);
            const monthStr = new Date(year, month - 1, 1).toLocaleString('en-US', { month: 'short' }).toUpperCase();

            const emp = await EmployeeSalary.findOne({ userId });
            if (!emp) return res.status(404).json({ success: false, message: 'Employee salary not found' });
            const rules = await ensureRules();
            const leavesDoc = await UserLeaves.findOne({ userId });
            const leavesTaken = countApprovedDaysForMonth(leavesDoc, monthStr);
            const paidLeavesAllowed = rules.paidLeavesPerMonth;
            const unpaidLeaves = Math.max(0, leavesTaken - paidLeavesAllowed);
            const deductionPerLeave = rules.deductionPerLeave;
            const totalDeduction = unpaidLeaves * deductionPerLeave;
            const finalSalary = Math.max(0, emp.monthlySalary - totalDeduction);

            const breakdown = { month: monthStr, year, leavesTaken, paidLeavesAllowed, unpaidLeaves };

            const saved = await SalaryHistory.findOneAndUpdate(
                { userId, month, year },
                { userId, month, year, monthlySalary: emp.monthlySalary, paidLeavesAllowed, leavesTaken, unpaidLeaves, deductionPerLeave, totalDeduction, finalSalary, breakdown },
                { upsert: true, new: true }
            );
            res.status(200).json({ success: true, data: saved });
        } catch (e) { next(e); }
    },
    getCalculated: async (req, res, next) => {
        try { const { userId, month, year } = req.params; const doc = await SalaryHistory.findOne({ userId, month: parseInt(month, 10), year: parseInt(year, 10) }); res.status(200).json({ success: true, data: doc }); }
        catch (e) { next(e); }
    },
    bulkCalculate: async (req, res, next) => {
        try {
            let { month, year } = req.params; month = parseInt(month, 10); year = parseInt(year, 10);
            const emps = await EmployeeSalary.find({});
            const results = [];
            for (const emp of emps) {
                req.params.userId = emp.userId; req.params.month = String(month); req.params.year = String(year);
                const fakeRes = { status: () => ({ json: (obj) => results.push(obj.data) }) };
                await salaryController.calculate(req, fakeRes, next);
            }
            res.status(200).json({ success: true, data: results, count: results.length });
        } catch (e) { next(e); }
    },

    history: async (req, res, next) => {
        try {
            const { userId } = req.params; const { month, year } = req.query;
            const filter = { userId }; if (month) filter.month = parseInt(month, 10); if (year) filter.year = parseInt(year, 10);
            const docs = await SalaryHistory.find(filter).sort({ year: -1, month: -1 });
            res.status(200).json({ success: true, data: docs, count: docs.length });
        } catch (e) { next(e); }
    },
    generatePayslip: async (req, res, next) => {
        try { const { userId, month, year } = req.params; const doc = await SalaryHistory.findOne({ userId, month: parseInt(month, 10), year: parseInt(year, 10) }); if (!doc) return res.status(404).json({ success: false, message: 'Salary not calculated' }); /* attach URL if you generate */ res.status(200).json({ success: true, data: doc }); }
        catch (e) { next(e); }
    }
};

module.exports = salaryController;


