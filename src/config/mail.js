const nodemailer = require('nodemailer');

// Parse env: process.env values are strings; port must be Number, SMTP_SECURE must be boolean
const port = Number(process.env.SMTP_PORT || 587);
const secure = String(process.env.SMTP_SECURE || 'false').toLowerCase() === 'true';

const transporterOptions = {
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port,
  secure: port === 465 ? true : secure,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
  requireTLS: port === 587,
  tls: { servername: 'smtp.gmail.com' },
  family: 4,
  connectionTimeout: 60000,
  greetingTimeout: 60000,
  socketTimeout: 60000,
};

// Log SMTP config safely (never log password)
console.log('SMTP CONFIG:', {
  host: process.env.SMTP_HOST,
  port,
  secure,
  user: process.env.SMTP_USER,
  passExists: !!process.env.SMTP_PASS,
});

let transporter = null;

function getTransporter() {
  if (!transporter) {
    transporter = nodemailer.createTransport(transporterOptions);
  }
  return transporter;
}

/**
 * Verify SMTP connection on startup. Call after env is loaded (e.g. in app.js).
 * Logs success or full error; does not throw.
 */
async function verifySmtpConnection() {
  try {
    const t = getTransporter();
    await t.verify();
    console.log('✅ SMTP connection verified successfully');
  } catch (err) {
    console.error('❌ SMTP verification failed:', {
      message: err.message,
      code: err.code,
      response: err.response,
      responseCode: err.responseCode,
    });
  }
}

module.exports = {
  getTransporter,
  verifySmtpConnection,
};
