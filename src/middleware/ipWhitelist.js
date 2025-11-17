const ipWhitelist = (req, res, next) => {
    // Skip IP whitelisting in production or on Render
    const isRender = process.env.RENDER === 'true' || process.env.RENDER_EXTERNAL_URL;
    if (process.env.NODE_ENV === 'production' || isRender) {
        console.log('🌐 Production/Render mode: IP whitelisting disabled');
        return next();
    }

    // Only apply IP whitelisting in development
    const allowedIP = process.env.IP_ADDRESS;

    if (!allowedIP) {
        console.warn('⚠️  IP_ADDRESS not configured in .env file - allowing all IPs in development');
        return next();
    }

    // Get client IP address
    const clientIP = req.ip ||
        req.connection.remoteAddress ||
        req.socket.remoteAddress ||
        (req.connection.socket ? req.connection.socket.remoteAddress : null) ||
        req.headers['x-forwarded-for']?.split(',')[0]?.trim();

    console.log(`🔍 Client IP: ${clientIP}, Allowed IP: ${allowedIP}`);

    // Check if client IP matches allowed IP (only in development)
    // Allow both the specific IP and localhost for development
    if (clientIP === allowedIP || clientIP === `::ffff:${allowedIP}` || clientIP === '::1' || clientIP === '127.0.0.1') {
        console.log(`✅ Development mode: IP ${clientIP} is whitelisted`);
        next();
    } else {
        console.log(`❌ Development mode: IP ${clientIP} is not whitelisted`);
        res.status(403).json({
            success: false,
            message: 'Access denied. Your IP address is not authorized in development mode.',
            clientIP: clientIP,
            allowedIP: allowedIP,
            environment: 'development'
        });
    }
};

module.exports = ipWhitelist;
