const mongoose = require('mongoose');

const otpVerificationSchema = new mongoose.Schema({
    email: {
        type: String,
        required: true,
        trim: true,
        lowercase: true
    },
    otp: {
        type: String,
        required: true
    },
    createdAt: {
        type: Date,
        default: Date.now,
        expires: 600 // Automatically delete after 600 seconds (10 minutes)
    }
}, {
    timestamps: true,
    collection: 'verificationOTPs'
});

const OTPVerificationModel = mongoose.model('OTPVerification', otpVerificationSchema);

module.exports = OTPVerificationModel;
