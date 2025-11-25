const mongoose = require('mongoose');
const { Schema } = mongoose;

// Products Schema
const ProductsSchema = new Schema(
    {
        productImage: { type: [String], default: [] }, // Array of URLs to product images
        productTitle: { type: String, required: true },
        productDescription: { type: String },
        productQuantity: { type: Number, default: 0 },
        productPrice: { type: Number, required: true },
        categoriesName: { type: String, required: true },
        archived: { type: Boolean, default: false } // Soft delete flag
    },
    {
        timestamps: true,
        collection: 'products', // Collection in database
    }
);

// Export Model
const ProductsModel = mongoose.model('Products', ProductsSchema);

module.exports = ProductsModel;

