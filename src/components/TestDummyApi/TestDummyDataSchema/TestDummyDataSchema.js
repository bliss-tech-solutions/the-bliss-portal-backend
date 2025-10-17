const mongoose = require('mongoose');
const { Schema } = mongoose;

// Test Dummy User Schema
const TestDummyUserSchema = new Schema(
    {
        name: { type: String, required: true },
        email: { type: String, required: true },
        number: { type: String, required: true },
        password: { type: String, required: true },
    },
    {
        timestamps: true,
        collection: 'tesDummyData',
    }
);

// Export Model
const TestDummyDataModel = mongoose.model('TestDummyData', TestDummyUserSchema);

module.exports = TestDummyDataModel;
