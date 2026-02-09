const nodemailer = require('nodemailer');
const OTPVerificationModel = require('./OTPVerificationSchema');

/**
 * Controller to send a verification email with a code and save it to a separate collection
 */
exports.sendVerificationEmail = async (req, res, next) => {
    try {
        let { email, verificationCode } = req.body;

        if (!email) {
            return res.status(400).json({
                success: false,
                message: 'Please provide an email address'
            });
        }

        const normalizedEmail = email.trim().toLowerCase();

        // Automatically generate a 6-digit code if not provided
        if (!verificationCode) {
            verificationCode = Math.floor(100000 + Math.random() * 900000).toString();
        }

        // Save new OTP record (overwrites old one for this email if you want, 
        // but here we just create a new one, old ones will expire via TTL)
        const newOTP = new OTPVerificationModel({
            email: normalizedEmail,
            otp: verificationCode
        });

        console.log('--- Saving OTP to Collection ---');
        console.log('Email:', normalizedEmail);
        console.log('Code:', verificationCode);

        await newOTP.save();

        // Create a transporter using SMTP configurations
        const transporter = nodemailer.createTransport({
            host: process.env.SMTP_HOST || 'smtp.gmail.com',
            port: process.env.SMTP_PORT || 587,
            secure: process.env.SMTP_SECURE === 'true',
            auth: {
                user: process.env.SMTP_USER,
                pass: process.env.SMTP_PASS
            }
        });

        // Email options
        const mailOptions = {
            from: `"The Bliss Portal" <${process.env.SMTP_USER}>`,
            to: normalizedEmail,
            subject: 'Email Verification Code - The Bliss Portal',
            text: `Your verification code is: ${verificationCode}. Please enter this code to verify your account.`,
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e1e1e1; border-radius: 8px;">
                    <h2 style="color: #333; text-align: center;">Account Verification</h2>
                    <p>Hello,</p>
                    <p>Thank you for using <strong>The Bliss Portal</strong>. Please use the following verification code to complete your action:</p>
                    <div style="background-color: #f4f4f4; padding: 15px; text-align: center; font-size: 24px; font-weight: bold; color: #ff9800; border-radius: 4px; margin: 20px 0;">
                        ${verificationCode}
                    </div>
                    <p>This code will expire in 10 minutes.</p>
                    <p>If you did not request this code, please ignore this email.</p>
                    <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;">
                    <p style="font-size: 12px; color: #888; text-align: center;">
                        &copy; 2026 The Bliss Portal. All rights reserved.
                    </p>
                </div>
            `
        };

        // Send the email
        await transporter.sendMail(mailOptions);

        res.status(200).json({
            success: true,
            message: 'Verification email sent successfully',
            verificationCode: verificationCode // Return for testing
        });
    } catch (error) {
        console.error('Error sending verification email:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to send verification email',
            error: error.message
        });
    }
};

/**
 * Controller to verify the provided code using the dedicated collection
 */
exports.verifyVerificationCode = async (req, res, next) => {
    try {
        const { email, verificationCode } = req.body;

        console.log('--- Verifying OTP Debug ---');
        console.log('Request Email:', email);
        console.log('Request Code:', verificationCode);

        if (!email || !verificationCode) {
            return res.status(400).json({
                success: false,
                message: 'Please provide email and verification code'
            });
        }

        const normalizedEmail = email.trim().toLowerCase();
        const trimmedCode = verificationCode.toString().trim();

        // Find the most recent valid OTP for this email
        const otpRecord = await OTPVerificationModel.findOne({
            email: normalizedEmail,
            otp: trimmedCode
        }).sort({ createdAt: -1 });

        if (!otpRecord) {
            console.log('No valid OTP record found for:', normalizedEmail, 'with code:', trimmedCode);
            return res.status(400).json({
                success: false,
                message: 'Invalid or expired verification code'
            });
        }

        console.log('Valid OTP record found. Verification successful.');

        // Delete all OTP records for this email after successful verification
        await OTPVerificationModel.deleteMany({ email: normalizedEmail });

        res.status(200).json({
            success: true,
            message: 'Email verified successfully'
        });
    } catch (error) {
        console.error('Error verifying code:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to verify code',
            error: error.message
        });
    }
};
