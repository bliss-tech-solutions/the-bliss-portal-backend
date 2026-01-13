const express = require('express');
const router = express.Router();
const realEstateUserController = require('./realEstateUserController');

// POST /api/realEstate/create - Create New User
router.post('/realEstate/create', realEstateUserController.createUser);

// POST /api/realEstate/login - Login User
router.post('/realEstate/login', realEstateUserController.loginUser);

// PUT /api/realEstate/update/:id - Update User Details
router.put('/realEstate/update/:id', realEstateUserController.updateUser);

// DELETE /api/realEstate/delete/:id - Archive User
router.delete('/realEstate/delete/:id', realEstateUserController.deleteUser);

module.exports = router;
