// api/index.js - Vercel serverless function
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
require('dotenv').config();

// Import database connection
const connectDB = require('../src/config/database');

// Import routes
const routes = require('../src/routes');

// Import middleware
const errorHandler = require('../src/middleware/errorHandler');
const notFound = require('../src/middleware/notFound');

const app = express();

// Trust proxy for accurate IP detection
app.set('trust proxy', true);

// Security middleware
app.use(helmet());

// CORS configuration
app.use(cors({
    origin: [
        'http://localhost:3000',
        'http://localhost:2711',
        'http://localhost:3001',
        'https://yourwebsite.com',
        'https://www.yourwebsite.com',
        'https://bliss-portal.com',
        'https://www.bliss-portal.com',
        'https://the-bliss-portal-backend.vercel.app'
    ],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    optionsSuccessStatus: 200
}));

// Logging middleware
app.use(morgan('combined'));

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Health check endpoint
app.get('/health', (req, res) => {
    res.status(200).json({
        status: 'OK',
        message: 'The Bliss Portal Backend is running',
        timestamp: new Date().toISOString()
    });
});

// API routes
app.use('/api', routes);

// Error handling middleware
app.use(notFound);
app.use(errorHandler);

// Connect to MongoDB
connectDB();

// Export for Vercel
module.exports = app;
