const { getTransporter } = require('../../../config/mail');
const OTPVerificationModel = require('./OTPVerificationSchema');

/**
 * Safely send JSON error response so the API never crashes with raw 500
 */
function sendError(res, statusCode, message, errorDetail = null) {
  try {
    const body = { success: false, message };
    if (errorDetail != null) body.error = errorDetail;
    res.status(statusCode).json(body);
  } catch (e) {
    console.error('Failed to send error response:', e);
    try {
      res.status(statusCode).type('json').end(JSON.stringify({ success: false, message }));
    } catch (_) {}
  }
}

/**
 * Controller to send a verification email with a code and save it to a separate collection.
 * Always returns JSON; never throws or sends raw 500.
 */
exports.sendVerificationEmail = async (req, res, next) => {
  try {
    let { email, verificationCode } = req.body || {};

    if (!email) {
      return res.status(400).json({
        success: false,
        message: 'Please provide an email address',
      });
    }

    const normalizedEmail = String(email).trim().toLowerCase();
    if (!normalizedEmail) {
      return res.status(400).json({
        success: false,
        message: 'Please provide an email address',
      });
    }

    // Automatically generate a 6-digit code if not provided
    if (!verificationCode) {
      verificationCode = Math.floor(100000 + Math.random() * 900000).toString();
    } else {
      verificationCode = String(verificationCode).trim();
    }

    // Save new OTP record
    const newOTP = new OTPVerificationModel({
      email: normalizedEmail,
      otp: verificationCode,
    });

    console.log('--- Saving OTP to Collection ---');
    console.log('Email:', normalizedEmail);
    console.log('Code:', verificationCode);

    await newOTP.save();

    const transporter = getTransporter();
    const fromUser = process.env.SMTP_USER || 'noreply@example.com';

    const mailOptions = {
      from: `"The Bliss Portal" <${fromUser}>`,
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
            `,
    };

    await transporter.sendMail(mailOptions);

    return res.status(200).json({
      success: true,
      message: 'Verification email sent successfully',
      verificationCode: verificationCode,
    });
  } catch (error) {
    // Log full SMTP error for Render logs (exact error from Nodemailer)
    console.error('Error sending verification email:', {
      message: error.message,
      code: error.code,
      response: error.response,
      responseCode: error.responseCode,
      command: error.command,
      stack: error.stack,
    });
    sendError(
      res,
      500,
      'Failed to send verification email',
      process.env.NODE_ENV === 'production' ? undefined : error.message
    );
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
    sendError(res, 500, 'Failed to verify code', error.message);
  }
};

/**
 * GET /email-test — temporary test endpoint: sends a test email and returns result.
 * Use to verify SMTP on Render; check Render logs for full error details.
 */
exports.emailTest = async (req, res) => {
  try {
    const transporter = getTransporter();
    const to = process.env.SMTP_USER || 'developer.bliss@gmail.com';
    const result = await transporter.sendMail({
      from: `"The Bliss Portal Test" <${process.env.SMTP_USER}>`,
      to,
      subject: 'SMTP Test - The Bliss Portal',
      text: 'This is a test email from the backend. If you received this, SMTP is working.',
    });
    console.log('Email test result:', { messageId: result.messageId, accepted: result.accepted });
    res.status(200).json({
      success: true,
      message: 'Test email sent',
      messageId: result.messageId,
      to,
    });
  } catch (error) {
    console.error('Email test failed:', {
      message: error.message,
      code: error.code,
      response: error.response,
      responseCode: error.responseCode,
    });
    sendError(res, 500, 'Test email failed', error.message);
  }
};
