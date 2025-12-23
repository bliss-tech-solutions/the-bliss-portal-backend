const express = require('express');
const router = express.Router();

const salaryController = require('./SalaryController');

// Employee salary management
router.post('/salary/employee', salaryController.upsertEmployee);
router.get('/salary/employee/:userId', salaryController.getEmployee);
router.get('/salary/all', salaryController.getAllEmployees);

// Rules
router.get('/salary/rules', salaryController.getRules);
router.put('/salary/rules', salaryController.updateRules);

// Salary calculation
router.post('/salary/calculate/:userId/:month/:year', salaryController.calculate);
router.get('/salary/calculate/:userId/:month/:year', salaryController.getCalculated);
router.post('/salary/calculate/bulk/:month/:year', salaryController.bulkCalculate);

// Salary history/payslip
router.get('/salary/history/:userId', salaryController.history);
router.post('/salary/generate-payslip/:userId/:month/:year', salaryController.generatePayslip);

module.exports = router;