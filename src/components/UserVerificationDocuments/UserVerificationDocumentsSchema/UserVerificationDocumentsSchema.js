const mongoose = require('mongoose');
const { Schema } = mongoose;

// User Verification Documents Schema
const UserVerificationDocumentsSchema = new Schema(
    {
        // User identification
        userId: { type: String, required: true, index: true },

        // Personal Information
        name: { type: String, required: true },
        department: { type: String, required: true },
        position: { type: String, required: true },
        jobType: { type: String, required: true }, // e.g., full-time, part-time, contract

        // Salary Information
        beforeBlissSalary: { type: Number }, // Salary before joining Bliss
        blissSalary: { type: Number }, // Current salary at Bliss
        pfFund: { type: Number }, // Automatically calculated (10% of blissSalary)

        // Salary Increment History
        salaryIncrementHistory: [{
            incrementPercent: { type: Number },
            oldSalary: { type: Number },
            newSalary: { type: Number },
            incrementAmount: { type: Number },
            pfAmount: { type: Number },
            effectiveDate: { type: Date },
            note: { type: String },
            status: {
                type: String,
                enum: ['pending_approval', 'approved', 'active', 'rejected', 'superseded'],
                default: 'pending_approval'
            },
            createdAt: { type: Date, default: Date.now }
        }],

        // Date Information
        joiningDate: { type: Date, required: true },

        // Address Information
        currentAddress: { type: String, required: true },
        permanentAddress: { type: String, required: true },

        // Experience
        experience: { type: String }, // Can be years or description

        // Bank Details (stored as an object)
        bankDetails: {
            accountHolderName: { type: String },
            accountNumber: { type: String },
            bankName: { type: String },
            ifscCode: { type: String },
            branchName: { type: String },
            accountType: { type: String } // e.g., savings, current
        },

        // Document Uploads (URLs or file paths)
        aadharCardImage: { type: String }, // URL to uploaded Aadhar card image
        passportPhoto: { type: String }, // URL to uploaded passport photo
        offerLetter: { type: String }, // URL to uploaded offer letter
    },
    {
        timestamps: true,
        collection: 'userVerificationDocuments', // Collection in database
    }
);

// Export Model
const UserVerificationDocumentsModel = mongoose.model('UserVerificationDocuments', UserVerificationDocumentsSchema);

module.exports = UserVerificationDocumentsModel;

