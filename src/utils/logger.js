const fs = require('fs');
const path = require('path');

// Ensure logs directory exists
const logsDir = path.join(__dirname, '../../logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

const logger = {
  info: (message) => {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] INFO: ${message}\n`;
    console.log(logMessage.trim());
    
    // Write to file
    fs.appendFileSync(path.join(logsDir, 'app.log'), logMessage);
  },

  error: (message) => {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] ERROR: ${message}\n`;
    console.error(logMessage.trim());
    
    // Write to file
    fs.appendFileSync(path.join(logsDir, 'error.log'), logMessage);
  },

  warn: (message) => {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] WARN: ${message}\n`;
    console.warn(logMessage.trim());
    
    // Write to file
    fs.appendFileSync(path.join(logsDir, 'app.log'), logMessage);
  }
};

module.exports = logger;
