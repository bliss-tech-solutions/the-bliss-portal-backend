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

// GET /api/realEstate/amenities/getAll
router.get('/realEstate/amenities/getAll', realEstateProjectController.getAllAmenities);

module.exports = router;