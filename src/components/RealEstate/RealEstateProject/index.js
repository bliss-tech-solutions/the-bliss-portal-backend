const express = require('express');
const router = express.Router();
const realEstateProjectController = require('./RealEstateProjectController');

// POST /api/realEstate/project/create
router.post('/realEstate/project/create', realEstateProjectController.createProject);

// GET /api/realEstate/project/getAll
router.get('/realEstate/project/getAll', realEstateProjectController.getAllProjects);

// GET /api/realEstate/project/getById/:id
router.get('/realEstate/project/getById/:id', realEstateProjectController.getProjectById);

// PUT /api/realEstate/project/update/:id
router.put('/realEstate/project/update/:id', realEstateProjectController.updateProject);

// DELETE /api/realEstate/project/delete/:id
router.delete('/realEstate/project/delete/:id', realEstateProjectController.deleteProject);

// POST /api/realEstate/projectType/create - Create new project type/category
router.post('/realEstate/projectType/create', realEstateProjectController.createProjectType);

// GET /api/realEstate/projectType/getAll - Get all project types/categories
router.get('/realEstate/projectType/getAll', realEstateProjectController.getAllProjectTypes);

// POST /api/realEstate/bhk/create - Create new BHK option
router.post('/realEstate/bhk/create', realEstateProjectController.createBhkOption);

// GET /api/realEstate/bhk/getAll - Get all BHK options
router.get('/realEstate/bhk/getAll', realEstateProjectController.getAllBhkOptions);

// GET /api/realEstate/amenities/getAll
router.get('/realEstate/amenities/getAll', realEstateProjectController.getAllAmenities);

module.exports = router;