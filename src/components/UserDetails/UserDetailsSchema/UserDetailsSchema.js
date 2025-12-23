const mongoose = require('mongoose');
const { Schema } = mongoose;

// User Details Schema
const UserDetailsSchema = new Schema(
    {
        // Human-friendly unique identifier for users (separate from Mongo _id)
        userId: { type: String, unique: true, index: true },
        firstName: { type: String, required: true },
        lastName: { type: String, required: true },
        email: { type: String, required: true },
        number: { type: String, required: true },
        role: { type: String, required: true },
        // Position depends on role (e.g., Execution -> SME, user -> various)
        position: { type: String },
        details: { type: String }, // textarea content
        maritalStatus: { type: String },
        birthDate: { type: Date },
        address: { type: String },
        pincode: { type: String },
        languages: { type: [String] }, // array of languages
        skills: { type: [String] }, // array of skills
        profilePhoto: { type: String }, // URL to uploaded profile photo
        // Generated credentials
        userEmail: { type: String },
        Password: { type: String },
    },
    {
        timestamps: true,
        collection: 'userDetails', // Collection in bliss-production database
    }
);

// Export Model
const UserDetailsModel = mongoose.model('UserDetails', UserDetailsSchema);

module.exports = UserDetailsModel;
