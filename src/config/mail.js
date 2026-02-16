const nodemailer = require('nodemailer');
const dns = require('dns').promises;

// Parse env: process.env values are strings; port must be Number, SMTP_SECURE must be boolean
const port = Number(process.env.SMTP_PORT || 587);
const secure = String(process.env.SMTP_SECURE || 'false').toLowerCase() === 'true';
const hostname = process.env.SMTP_HOST || 'smtp.gmail.com';

// Render (and many clouds) have no IPv6 outbound → ENETUNREACH. Force IPv4 by resolving A record.
let resolvedHost = hostname;
async function ensureIPv4Host() {
  if (resolvedHost !== hostname) return resolvedHost;
  try {
    const aRecords = await dns.resolve4(hostname);
    if (aRecords && aRecords[0]) {
      resolvedHost = aRecords[0];
      console.log('SMTP: using IPv4 address', resolvedHost, 'for', hostname);
    }
  } catch (e) {
    console.warn('SMTP: could not resolve IPv4 for', hostname, e.message);
  }
  return resolvedHost;
}

const transporterOptions = {
  host: hostname,
  port,
  secure: port === 465 ? true : secure,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
  requireTLS: port === 587,
  tls: { servername: hostname },
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

async function getTransporter() {
  if (transporter) return transporter;
  const host = await ensureIPv4Host();
  transporter = nodemailer.createTransport({
    ...transporterOptions,
    host,
  });
  return transporter;
}

/**
 * Verify SMTP connection on startup. Call after env is loaded (e.g. in app.js).
 * Logs success or full error; does not throw.
 */
async function verifySmtpConnection() {
  try {
    const t = await getTransporter();
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
