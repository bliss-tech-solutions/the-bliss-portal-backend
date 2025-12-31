const IPWhitelistModel = require('../components/IPWhitelist/IPWhitelistSchema/IPWhitelistSchema');
const { cacheHelper } = require('../config/redis');

const IP_WHITELIST_CACHE_KEY = 'ip:whitelist:active';
const CACHE_TTL = 60; // 1 minute cache (short for faster updates)

// Helper function to get allowed IPs from MongoDB (with caching)
const getAllowedIPs = async () => {
    try {
        // Try cache first
        const cached = await cacheHelper.get(IP_WHITELIST_CACHE_KEY);
        if (cached && Array.isArray(cached) && cached.length > 0) {
            return cached;
        }

        // Fetch from database
        const activeIP = await IPWhitelistModel.findOne({ isActive: true }).sort({ updatedAt: -1 });
        
        if (!activeIP) {
            // Fallback to environment variable if no IP in database
            const allowedIPsString = process.env.ALLOWED_IPS || process.env.IP_ADDRESS;
            if (allowedIPsString) {
                return allowedIPsString.split(',').map(ip => ip.trim()).filter(Boolean);
            }
            return [];
        }

        const ipAddresses = [activeIP.ipAddress];

        // Cache the result
        await cacheHelper.set(IP_WHITELIST_CACHE_KEY, ipAddresses, CACHE_TTL);

        return ipAddresses;
    } catch (error) {
        console.error('Error fetching allowed IPs from database:', error.message);
        // Fallback to environment variable if database fails
        const allowedIPsString = process.env.ALLOWED_IPS || process.env.IP_ADDRESS;
        if (allowedIPsString) {
            return allowedIPsString.split(',').map(ip => ip.trim()).filter(Boolean);
        }
        return [];
    }
};

const ipWhitelist = async (req, res, next) => {
    // Always allow IP whitelist management routes (to add/update IPs)
    if (req.path.startsWith('/api/ipwhitelist')) {
        return next();
    }

    // Always allow OPTIONS requests (CORS preflight)
    if (req.method === 'OPTIONS') {
        return next();
    }

    // Check if IP whitelisting is enabled (via ALLOW_IP_WHITELIST env var)
    const enableWhitelist = process.env.ALLOW_IP_WHITELIST === 'true';
    
    // If whitelisting is not explicitly enabled, skip it
    if (!enableWhitelist) {
        return next();
    }

    // Get allowed IPs from MongoDB (with fallback to env var)
    const allowedIPs = await getAllowedIPs();

    // If no IPs configured, allow all (for initial setup)
    if (!allowedIPs || allowedIPs.length === 0) {
        console.warn('⚠️  No allowed IPs configured in database or env - allowing all IPs');
        return next();
    }

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
