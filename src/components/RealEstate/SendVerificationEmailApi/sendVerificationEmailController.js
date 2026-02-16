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

    const transporter = await getTransporter();
    const fromUser = process.env.SMTP_USER || 'noreply@example.com';
    const mailOptions = {
        from: `"Collective" <${fromUser}>`,
        to: normalizedEmail,
        subject: "Your verification code for Collective",
        text: `Your Collective verification code is ${verificationCode}. This code expires in 10 minutes. If you didn’t request it, ignore this email.`,
        html: `
        <div style="margin:0;padding:0;background:#f6f8fb;">
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#f6f8fb;">
            <tr>
              <td align="center" style="padding:28px 12px;">
                
                <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" style="width:600px;max-width:600px;background:#ffffff;border:1px solid #e8eef5;border-radius:14px;overflow:hidden;">
                  
                  <!-- Header -->
                  <tr>
                    <td style="padding:22px 24px;background:#0b1220;">
                      <div style="font-family:Arial,Helvetica,sans-serif;font-size:18px;line-height:24px;color:#ffffff;font-weight:700;">
                        Collective
                      </div>
                      <div style="font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:18px;color:#cbd5e1;margin-top:2px;">
                        Account verification
                      </div>
                    </td>
                  </tr>
      
                  <!-- Body -->
                  <tr>
                    <td style="padding:26px 24px 10px 24px;">
                      <div style="font-family:Arial,Helvetica,sans-serif;font-size:18px;line-height:26px;color:#0f172a;font-weight:700;">
                        Verify your email address
                      </div>
      
                      <div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:22px;color:#334155;margin-top:10px;">
                        Hi there, <br/>
                        Use the verification code below to complete your request on <strong>Collective</strong>.
                      </div>
      
                      <!-- Code box -->
                      <div style="margin:18px 0 14px 0;">
                        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
                          <tr>
                            <td align="center" style="padding:16px;background:#f1f5f9;border:1px dashed #cbd5e1;border-radius:12px;">
                              <div style="font-family:Arial,Helvetica,sans-serif;font-size:28px;letter-spacing:6px;line-height:34px;color:#0b1220;font-weight:800;">
                                ${verificationCode}
                              </div>
                              <div style="font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:18px;color:#64748b;margin-top:6px;">
                                This code expires in <strong>10 minutes</strong>.
                              </div>
                            </td>
                          </tr>
                        </table>
                      </div>
      
                      <div style="font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:20px;color:#475569;">
                        If you didn’t request this code, you can safely ignore this email.
                      </div>
      
                      <div style="height:14px;"></div>
      
                      <!-- Tip -->
                      <div style="font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:18px;color:#64748b;">
                        For your security, please do not share this code with anyone.
                      </div>
                    </td>
                  </tr>
      
                  <!-- Footer -->
                  <tr>
                    <td style="padding:16px 24px 22px 24px;">
                      <hr style="border:0;border-top:1px solid #e8eef5;margin:0 0 14px 0;">
                      <div style="font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:18px;color:#94a3b8;text-align:center;">
                        © 2026 Collective. All rights reserved.
                      </div>
                    </td>
                  </tr>
      
                </table>
      
              </td>
            </tr>
          </table>
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
    const isTimeout = /timeout|ETIMEDOUT|ESOCKETTIMEDOUT/i.test(error.message || '');
    const hint = isTimeout
      ? ' (On Render free tier, outbound SMTP is blocked; upgrade to a paid instance or use an HTTP email API.)'
      : '';
    const clientError = process.env.NODE_ENV === 'production'
      ? (isTimeout ? `Connection timeout${hint}` : undefined)
      : error.message + hint;
    sendError(res, 500, 'Failed to send verification email', clientError);
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
    const transporter = await getTransporter();
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
