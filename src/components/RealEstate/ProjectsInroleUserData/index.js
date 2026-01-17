const express = require('express');
const router = express.Router();
const projectsInroleUserDataController = require('./ProjectsInroleUserDataController');

// POST /api/realEstate/project/enroll - Enroll user in project
router.post('/realEstate/project/enroll', projectsInroleUserDataController.enrollInProject);

// GET /api/realEstate/project/enroll/getAll - Get all enrollments
router.get('/realEstate/project/enroll/getAll', projectsInroleUserDataController.getAllEnrollments);

// GET /api/realEstate/project/enroll/user/:userId - Get enrollments by user ID
router.get('/realEstate/project/enroll/user/:userId', projectsInroleUserDataController.getEnrollmentsByUserId);

module.exports = router;