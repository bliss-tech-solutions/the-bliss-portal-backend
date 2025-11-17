const ipWhitelist = (req, res, next) => {
    // Check if IP whitelisting is enabled (via ALLOW_IP_WHITELIST env var)
    const enableWhitelist = process.env.ALLOW_IP_WHITELIST === 'true';
    
    // If whitelisting is not explicitly enabled, skip it
    if (!enableWhitelist) {
        return next();
    }

    // Get allowed IPs from environment variable
    // Can be single IP or comma-separated list: "192.168.1.1,10.0.0.1"
    const allowedIPsString = process.env.ALLOWED_IPS || process.env.IP_ADDRESS;

    if (!allowedIPsString) {
        console.warn('⚠️  ALLOWED_IPS not configured - allowing all IPs');
        return next();
    }

    // Parse allowed IPs (support comma-separated list)
    const allowedIPs = allowedIPsString.split(',').map(ip => ip.trim()).filter(Boolean);

    // Get client IP address
    // On Render/proxied environments, use x-forwarded-for header
    const clientIP = req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
        req.headers['x-real-ip'] ||
        req.ip ||
        req.connection.remoteAddress ||
        req.socket.remoteAddress ||
        (req.connection.socket ? req.connection.socket.remoteAddress : null) ||
        'unknown';

    console.log(`🔍 Client IP: ${clientIP}, Allowed IPs: ${allowedIPs.join(', ')}`);

    // Check if client IP matches any allowed IP
    // Support IPv4, IPv6, and localhost variations
    const isAllowed = allowedIPs.some(allowedIP => {
        // Exact match
        if (clientIP === allowedIP) return true;
        
        // IPv6 mapped IPv4 (::ffff:192.168.1.1)
        if (clientIP === `::ffff:${allowedIP}`) return true;
        
        // Localhost variations
        if ((clientIP === '::1' || clientIP === '127.0.0.1') && 
            (allowedIP === '127.0.0.1' || allowedIP === 'localhost')) return true;
        
        // CIDR notation support (basic - for single IP, just check exact match)
        // For full CIDR support, you'd need a library like ipaddr.js
        return false;
    });

    if (isAllowed) {
        console.log(`✅ IP ${clientIP} is whitelisted`);
        next();
    } else {
        console.log(`❌ IP ${clientIP} is not whitelisted`);
        res.status(403).json({
            success: false,
            message: 'Access denied. Your IP address is not authorized.',
            clientIP: clientIP,
            allowedIPs: allowedIPs,
            environment: process.env.NODE_ENV || 'development'
        });
    }
};

module.exports = ipWhitelist;
