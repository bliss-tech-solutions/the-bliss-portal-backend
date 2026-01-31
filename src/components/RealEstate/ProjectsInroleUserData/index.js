const express = require('express');
const router = express.Router();
const projectsInroleUserDataController = require('./ProjectsInroleUserDataController');

// POST /api/realEstate/project/enroll - Enroll user in project
router.post('/realEstate/project/enroll', projectsInroleUserDataController.enrollInProject);

// POST /api/realEstate/project/unenroll - Unenroll user from project
router.post('/realEstate/project/unenroll', projectsInroleUserDataController.unenrollFromProject);

// GET /api/realEstate/project/enroll/getAll - Get all enrollments
router.get('/realEstate/project/enroll/getAll', projectsInroleUserDataController.getAllEnrollments);

// GET /api/realEstate/project/enroll/user/:userId - Get enrollments by user ID
router.get('/realEstate/project/enroll/user/:userId', projectsInroleUserDataController.getEnrollmentsByUserId);

module.exports = router;