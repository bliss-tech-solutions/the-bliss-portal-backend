const ProductsModel = require('./ProductsSchema/ProductsSchema');

const productsController = {
    // GET /api/products/getAll - Get all products (excludes archived by default)
    getAll: async (req, res, next) => {
        try {
            const { includeArchived } = req.query; // Optional query param to include archived products
            
            // Build query - exclude archived by default
            const query = includeArchived === 'true' ? {} : { archived: false };
            
            const products = await ProductsModel.find(query).sort({ createdAt: -1 });
            
            res.status(200).json({
                success: true,
                message: 'Products retrieved successfully',
                data: products,
                count: products.length
            });
        } catch (error) {
            next(error);
        }
    },

    // GET /api/products/getById/:productId - Get product by ID (includes archived)
    getById: async (req, res, next) => {
        try {
            const { productId } = req.params;
            
            const product = await ProductsModel.findById(productId);
            
            if (!product) {
                return res.status(404).json({
                    success: false,
                    message: 'Product not found'
                });
            }
            
            res.status(200).json({
                success: true,
                message: 'Product retrieved successfully',
                data: product
            });
        } catch (error) {
            next(error);
        }
    },

    // GET /api/products/getByCategory/:categoryName - Get products by category (excludes archived by default)
    getByCategory: async (req, res, next) => {
        try {
            const { categoryName } = req.params;
            const { includeArchived } = req.query; // Optional query param to include archived products
            
            // Build query - exclude archived by default
            const query = { 
                categoriesName: categoryName,
                ...(includeArchived !== 'true' ? { archived: false } : {})
            };
            
            const products = await ProductsModel.find(query).sort({ createdAt: -1 });
            
            res.status(200).json({
                success: true,
                message: `Products in category '${categoryName}' retrieved successfully`,
                data: products,
                count: products.length
            });
        } catch (error) {
            next(error);
        }
    },

    // POST /api/products/create - Create new product
    create: async (req, res, next) => {
        try {
            const {
                productImage,
                productTitle,
                productDescription,
                productQuantity,
                productPrice,
                categoriesName
            } = req.body;

            // Normalize categoriesName - handle both string and array
            let normalizedCategoryName = categoriesName;
            if (Array.isArray(categoriesName)) {
                normalizedCategoryName = categoriesName.length > 0 ? categoriesName[0] : null;
            } else if (typeof categoriesName === 'string') {
                normalizedCategoryName = categoriesName.trim();
            } else {
                normalizedCategoryName = null;
            }

            // Validate required fields
            if (!productTitle || !normalizedCategoryName || productPrice === undefined) {
                return res.status(400).json({
                    success: false,
                    message: 'Missing required fields: productTitle, productPrice, and categoriesName are required'
                });
            }

            // Check for duplicate product title (case-insensitive)
            const existingProduct = await ProductsModel.findOne({
                productTitle: { $regex: new RegExp(`^${productTitle}$`, 'i') },
                archived: false // Only check non-archived products
            });

            if (existingProduct) {
                return res.status(400).json({
                    success: false,
                    message: 'Product title already exists. Please use a different title.',
                    data: {
                        existingProductId: existingProduct._id,
                        existingProductTitle: existingProduct.productTitle
                    }
                });
            }

            // Validate productPrice
            const price = Number.isFinite(Number(productPrice)) 
                ? Number(productPrice) 
                : null;
            
            if (price === null || price < 0) {
                return res.status(400).json({
                    success: false,
                    message: 'productPrice must be a valid positive number'
                });
            }

            // Validate productQuantity if provided
            const quantity = productQuantity !== undefined 
                ? (Number.isFinite(Number(productQuantity)) ? Number(productQuantity) : 0)
                : 0;

            // Normalize productImage to array
            let normalizedImages = [];
            if (productImage) {
                if (Array.isArray(productImage)) {
                    normalizedImages = productImage.filter(Boolean); // Remove empty values
                } else if (typeof productImage === 'string') {
                    normalizedImages = [productImage]; // Convert single string to array
                }
            }

            const newProduct = new ProductsModel({
                productImage: normalizedImages,
                productTitle,
                productDescription: productDescription || undefined,
                productQuantity: quantity,
                productPrice: price,
                categoriesName: normalizedCategoryName
            });

            const savedProduct = await newProduct.save();

            res.status(201).json({
                success: true,
                message: 'Product created successfully',
                data: savedProduct
            });
        } catch (error) {
            next(error);
        }
    },

    // PUT /api/products/update/:productId - Update product
    update: async (req, res, next) => {
        try {
            const { productId } = req.params;
            const {
                productImage,
                productTitle,
                productDescription,
                productQuantity,
                productPrice,
                categoriesName
            } = req.body;

            // Check if product exists
            const product = await ProductsModel.findById(productId);
            if (!product) {
                return res.status(404).json({
                    success: false,
                    message: 'Product not found'
                });
            }

            // Check for duplicate product title if productTitle is being updated
            if (productTitle !== undefined && productTitle !== product.productTitle) {
                const existingProduct = await ProductsModel.findOne({
                    productTitle: { $regex: new RegExp(`^${productTitle}$`, 'i') },
                    _id: { $ne: productId }, // Exclude current product
                    archived: false // Only check non-archived products
                });

                if (existingProduct) {
                    return res.status(400).json({
                        success: false,
                        message: 'Product title already exists. Please use a different title.',
                        data: {
                            existingProductId: existingProduct._id,
                            existingProductTitle: existingProduct.productTitle
                        }
                    });
                }
            }

            // Build update object (only update provided fields)
            const updateData = {};
            if (productImage !== undefined) {
                // Normalize productImage to array
                if (Array.isArray(productImage)) {
                    updateData.productImage = productImage.filter(Boolean); // Remove empty values
                } else if (typeof productImage === 'string') {
                    updateData.productImage = [productImage]; // Convert single string to array
                } else {
                    updateData.productImage = []; // Default to empty array
                }
            }
            if (productTitle !== undefined) updateData.productTitle = productTitle;
            if (productDescription !== undefined) updateData.productDescription = productDescription;
            if (productQuantity !== undefined) {
                updateData.productQuantity = Number.isFinite(Number(productQuantity)) 
                    ? Number(productQuantity) 
                    : product.productQuantity;
            }
            if (productPrice !== undefined) {
                const price = Number.isFinite(Number(productPrice)) ? Number(productPrice) : null;
                if (price === null || price < 0) {
                    return res.status(400).json({
                        success: false,
                        message: 'productPrice must be a valid positive number'
                    });
                }
                updateData.productPrice = price;
            }
            if (categoriesName !== undefined) {
                // Normalize categoriesName - handle both string and array
                if (Array.isArray(categoriesName)) {
                    updateData.categoriesName = categoriesName.length > 0 ? categoriesName[0] : product.categoriesName;
                } else if (typeof categoriesName === 'string') {
                    updateData.categoriesName = categoriesName.trim();
                }
            }

            const updatedProduct = await ProductsModel.findByIdAndUpdate(
                productId,
                updateData,
                { new: true, runValidators: true }
            );

            res.status(200).json({
                success: true,
                message: 'Product updated successfully',
                data: updatedProduct
            });
        } catch (error) {
            next(error);
        }
    },

    // DELETE /api/products/delete/:productId - Archive product (soft delete)
    delete: async (req, res, next) => {
        try {
            const { productId } = req.params;

            const product = await ProductsModel.findById(productId);
            if (!product) {
                return res.status(404).json({
                    success: false,
                    message: 'Product not found'
                });
            }

            // Set archived flag to true instead of deleting
            const updatedProduct = await ProductsModel.findByIdAndUpdate(
                productId,
                { archived: true },
                { new: true }
            );

            res.status(200).json({
                success: true,
                message: 'Product archived successfully',
                data: {
                    productId: productId,
                    productTitle: product.productTitle,
                    archived: true,
                    product: updatedProduct
                }
            });
        } catch (error) {
            next(error);
        }
    },

    // PUT /api/products/restore/:productId - Restore archived product
    restore: async (req, res, next) => {
        try {
            const { productId } = req.params;

            const product = await ProductsModel.findById(productId);
            if (!product) {
                return res.status(404).json({
                    success: false,
                    message: 'Product not found'
                });
            }

            // Set archived flag to false
            const restoredProduct = await ProductsModel.findByIdAndUpdate(
                productId,
                { archived: false },
                { new: true }
            );

            res.status(200).json({
                success: true,
                message: 'Product restored successfully',
                data: restoredProduct
            });
        } catch (error) {
            next(error);
        }
    }
};

module.exports = productsController;

