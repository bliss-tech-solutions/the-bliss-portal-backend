const express = require('express');
const router = express.Router();
const salaryCalculationController = require('./SalaryCalculationController');

router.get('/calculate/:userId', salaryCalculationController.calculateSalary);
router.get('/calculate-all-users', salaryCalculationController.calculateAllUsersSalary);
router.get('/calculate-all/:userId', salaryCalculationController.calculateAllMonthsSalary);

module.exports = router;
