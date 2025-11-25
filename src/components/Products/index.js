const express = require('express');
const router = express.Router();

// Import controller
const productsController = require('./ProductsController');

// Routes
// GET /api/products/getAll - Get all products
router.get('/products/getAll', productsController.getAll);

// GET /api/products/getById/:productId - Get product by ID
router.get('/products/getById/:productId', productsController.getById);

// GET /api/products/getByCategory/:categoryName - Get products by category
router.get('/products/getByCategory/:categoryName', productsController.getByCategory);

// POST /api/products/create - Create new product
router.post('/products/create', productsController.create);

// PUT /api/products/update/:productId - Update product
router.put('/products/update/:productId', productsController.update);

// DELETE /api/products/delete/:productId - Archive product (soft delete)
router.delete('/products/delete/:productId', productsController.delete);

// PUT /api/products/restore/:productId - Restore archived product
router.put('/products/restore/:productId', productsController.restore);

module.exports = router;

