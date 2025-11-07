const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const path = require('path');
require('dotenv').config();

// Import database connection
const connectDB = require('./src/config/database');

// Import routes
const routes = require('./src/routes');

// Import middleware
const errorHandler = require('./src/middleware/errorHandler');
const notFound = require('./src/middleware/notFound');
const ipWhitelist = require('./src/middleware/ipWhitelist');

const app = express();
const http = require('http');
const server = http.createServer(app);
let io; // socket.io instance

// Trust proxy for accurate IP detection
app.set('trust proxy', true);

// Security middleware
app.use(helmet());

// IP Whitelist middleware (only allow specific IP)
app.use(ipWhitelist);

// CORS configuration - Allow multiple websites
const corsOrigins = [
    'http://localhost:3000',
    'http://localhost:2711',
    'http://localhost:3001',
    'https://yourwebsite.com',
    'https://www.yourwebsite.com',
    'https://bliss-portal.com',
    'https://www.bliss-portal.com',
    "https://the-bliss-portal-backend.vercel.app/"
];

app.use(cors({
    origin: corsOrigins,
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

// Static files
app.use('/public', express.static(path.join(__dirname, 'public')));

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

const PORT = process.env.PORT || 3000;

// Setup Socket.IO
try {
    const { Server } = require('socket.io');
    const { setIO } = require('./src/utils/socket');
    io = new Server(server, {
        cors: {
            origin: corsOrigins,
            methods: ['GET', 'POST']
        }
    });

    // Set IO instance for use in controllers
    setIO(io);

    io.on('connection', (socket) => {
        console.log('🧩 Socket connected:', socket.id);
        // allow rooms per task for scoped chat
        socket.on('joinTask', (taskId) => {
            socket.join(String(taskId));
        });

        // allow clients to subscribe to a specific festive date room
        socket.on('joinFestiveDate', (date) => {
            if (typeof date === 'string' && date.trim()) {
                socket.join(`festive:${date.trim()}`);
            }
        });

        // allow clients to subscribe to specific user updates
        socket.on('joinUser', (userId) => {
            if (typeof userId === 'string' && userId.trim()) {
                socket.join(`user:${userId.trim()}`);
            }
        });

        // allow clients to subscribe to slot updates for a specific user
        socket.on('joinUserSlots', (userId) => {
            if (typeof userId === 'string' && userId.trim()) {
                socket.join(`userSlots:${userId.trim()}`);
            }
        });

        // allow assigners to subscribe to their task updates
        socket.on('joinAssigner', (assignerId) => {
            if (typeof assignerId === 'string' && assignerId.trim()) {
                socket.join(`assigner:${assignerId.trim()}`);
            }
        });

        // allow receivers to subscribe to their task updates
        socket.on('joinReceiver', (receiverId) => {
            if (typeof receiverId === 'string' && receiverId.trim()) {
                socket.join(`receiver:${receiverId.trim()}`);
            }
        });

        socket.on('disconnect', () => {
            console.log('🔌 Socket disconnected:', socket.id);
        });
    });
} catch (e) {
    console.warn('Socket.IO not initialized (module not installed). Run: npm i socket.io');
}

// Connect to MongoDB
connectDB();

server.listen(PORT, () => {
    console.log(`🚀 Server is running on port ${PORT}`);
    console.log(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`🌐 Health check: http://localhost:${PORT}/health`);
});

module.exports = app;
