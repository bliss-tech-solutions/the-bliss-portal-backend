const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const path = require('path');
require('dotenv').config();

// Import database connection
const connectDB = require('./src/config/database');

// Import Redis
const { initRedis, closeRedis } = require('./src/config/redis');

// Import routes
const routes = require('./src/routes');
const { setIO } = require('./src/utils/socket');

// Import middleware
const errorHandler = require('./src/middleware/errorHandler');
const notFound = require('./src/middleware/notFound');
const ipWhitelist = require('./src/middleware/ipWhitelist');
const { redisCache } = require('./src/middleware/redisCache');

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
    "http://localhost:5173",
    'http://localhost:2711',
    'http://localhost:3001',
    'https://yourwebsite.com',
    'https://www.yourwebsite.com',
    'https://bliss-portal.com',
    'https://www.bliss-portal.com',
    'https://the-bliss-portal.vercel.app',
    "https://the-bliss-portal.vercel.app/",
    "https://www.the-bliss-portal.vercel.app",
    "https://www.the-bliss-portal.vercel.app/",
    "https://techerudite-assignment-three.vercel.app",
    // Render deployment URLs (add your actual Render domain)
    process.env.RENDER_EXTERNAL_URL || null,
    process.env.FRONTEND_URL || null
].filter(Boolean);

app.use(cors({
    origin: corsOrigins,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
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

// Redis Cache Middleware (applied globally to API routes)
// Exclude authentication, real-time endpoints, and routes with manual caching
app.use('/api', redisCache({
    duration: 120, // 2 minutes default cache duration
    excludedRoutes: [
        /\/signin/i,
        /\/signIn/i,
        /\/auth/i,
        /\/checkin/i,
        /\/checkout/i,
        /\/socket/i,
        /\/globalchat\/messages/i, // Has manual caching in controller
        /\/chat\/messages/i, // Has manual caching in controller
        /\/userverificationdocuments/i, // Exclude to ensure real-time salary updates
        /\/teammanagement/i,
        /\/addtaskassign/i,
        /\/leavesapi/i,
        /\/leave\//i,
        /\/salaryCalculation/i,

    ],
    excludedMethods: [] // Cache all GET requests
}));

// Root endpoint
app.get('/', (req, res) => {
    res.status(200).json({
        message: 'Welcome to The Bliss Portal Backend API',
        version: '1.0.0',
        status: 'OK',
        endpoints: {
            health: '/health',
            api: '/api',
            apiInfo: '/api/'
        },
        timestamp: new Date().toISOString()
    });
});

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
    io = new Server(server, {
        cors: {
            origin: corsOrigins,
            methods: ['GET', 'POST']
        }
    });
    setIO(io);

    io.on('connection', (socket) => {
        console.log('🧩 Socket connected:', socket.id);
        // allow rooms per task for scoped chat
        socket.on('joinTask', (taskId) => {
            if (!taskId) return;
            socket.join(String(taskId));
        });

        // backward-compatible event name used by older clients
        socket.on('join-task-room', (payload = {}) => {
            const { taskId } = payload;
            if (!taskId) return;
            socket.join(String(taskId));
        });

        socket.on('leave-task-room', (payload = {}) => {
            const { taskId } = payload;
            if (!taskId) return;
            socket.leave(String(taskId));
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

        // allow clients to subscribe to specific client updates
        socket.on('joinClient', (clientId) => {
            if (typeof clientId === 'string' && clientId.trim()) {
                socket.join(`client:${clientId.trim()}`);
            }
        });

        socket.on('leaveClient', (clientId) => {
            if (typeof clientId === 'string' && clientId.trim()) {
                socket.leave(`client:${clientId.trim()}`);
            }
        });

        // allow clients to subscribe to specific client-user combination for filtered attachment views
        socket.on('joinClientUser', (payload) => {
            const { clientId, userId } = payload || {};
            if (typeof clientId === 'string' && clientId.trim() && typeof userId === 'string' && userId.trim()) {
                socket.join(`client:${clientId.trim()}:user:${userId.trim()}`);
            }
        });

        socket.on('leaveClientUser', (payload) => {
            const { clientId, userId } = payload || {};
            if (typeof clientId === 'string' && clientId.trim() && typeof userId === 'string' && userId.trim()) {
                socket.leave(`client:${clientId.trim()}:user:${userId.trim()}`);
            }
        });

        // allow clients to subscribe to global chat room
        socket.on('joinGlobalChat', () => {
            socket.join('global-chat');
            console.log('✅ Socket joined global-chat room:', socket.id);
        });

        socket.on('leaveGlobalChat', () => {
            socket.leave('global-chat');
            console.log('👋 Socket left global-chat room:', socket.id);
        });

        // Analytics room subscriptions
        socket.on('joinAnalytics', () => {
            socket.join('analytics');
            console.log('📊 Client joined analytics room:', socket.id);
        });

        socket.on('leaveAnalytics', () => {
            socket.leave('analytics');
            console.log('👋 Client left analytics room:', socket.id);
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

// Initialize Redis
initRedis();

// Graceful shutdown
process.on('SIGTERM', async () => {
    console.log('SIGTERM signal received: closing HTTP server and Redis');
    await closeRedis();
    server.close(() => {
        console.log('HTTP server closed');
        process.exit(0);
    });
});

process.on('SIGINT', async () => {
    console.log('SIGINT signal received: closing HTTP server and Redis');
    await closeRedis();
    server.close(() => {
        console.log('HTTP server closed');
        process.exit(0);
    });
});

// Setup Cron Jobs
try {
    const cron = require('node-cron');
    const userVerificationDocumentsController = require('./src/components/UserVerificationDocuments/UserVerificationDocumentsController');

    // Run every day at 00:00 (Midnight)
    cron.schedule('0 0 * * *', async () => {
        console.log('⏰ Running Daily Salary Increment Job:', new Date().toISOString());
        try {
            const mockRes = {
                status: (code) => ({
                    json: (data) => console.log(`✅ Salary Job Result: ${JSON.stringify(data)}`)
                })
            };
            const mockNext = (err) => console.error('❌ Salary Job Error:', err);

            await userVerificationDocumentsController.applyPendingIncrements({}, mockRes, mockNext);
        } catch (error) {
            console.error('❌ Critical Cron Job Error:', error);
        }
    });
    console.log('📅 Cron Jobs Initialized');
} catch (e) {
    console.warn('Cron setup failed:', e.message);
}

server.listen(PORT, () => {
    console.log(`🚀 Server is running on port ${PORT}`);
    console.log(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`🌐 Health check: http://localhost:${PORT}/health`);
});

module.exports = app;
