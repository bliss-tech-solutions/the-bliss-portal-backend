const IPWhitelistModel = require('./IPWhitelistSchema/IPWhitelistSchema');
const { cacheHelper } = require('../../config/redis');

const IP_WHITELIST_CACHE_KEY = 'ip:whitelist:active';
const CACHE_TTL = 60; // 1 minute cache (short for faster updates)

const ipWhitelistController = {
    // POST /api/ipwhitelist/setIP - Set the IP (simple - replaces any old IP)
    setIP: async (req, res, next) => {
        try {
            console.log('📝 setIP request:', { body: req.body, headers: req.headers['content-type'] });
            
            const { ipAddress, description } = req.body || {};

            if (!ipAddress || typeof ipAddress !== 'string' || ipAddress.trim() === '') {
                return res.status(400).json({
                    success: false,
                    message: 'ipAddress is required and must be a non-empty string',
                    receivedBody: req.body
                });
            }

            // Remove /32 if present (MongoDB format)
            const cleanIP = ipAddress.replace('/32', '').trim();

            // Deactivate all existing IPs
            await IPWhitelistModel.updateMany(
                { isActive: true },
                { isActive: false }
            );

            // Check if IP already exists
            let ipEntry = await IPWhitelistModel.findOne({ ipAddress: cleanIP });

            if (ipEntry) {
                // Reactivate and update
                ipEntry.isActive = true;
                ipEntry.description = description || ipEntry.description || 'Active IP';
                ipEntry.updatedAt = new Date();
                await ipEntry.save();
            } else {
                // Create new entry
                ipEntry = new IPWhitelistModel({
                    ipAddress: cleanIP,
                    description: description || 'Active IP',
                    isActive: true
                });
                await ipEntry.save();
            }

            // Clear cache immediately
            await cacheHelper.delete(IP_WHITELIST_CACHE_KEY);

            res.status(200).json({
                success: true,
                message: `IP ${cleanIP} has been set. Backend will now only work with this IP.`,
                data: {
                    activeIP: cleanIP,
                    ipEntry: ipEntry,
                    note: 'No need to update Render environment variables. Just update IP in MongoDB and backend will use it automatically.'
                }
            });
        } catch (error) {
            if (error.code === 11000) {
                return res.status(400).json({
                    success: false,
                    message: 'IP address already exists'
                });
            }
            next(error);
        }
    },

    // GET /api/ipwhitelist/getCurrentIP - Get the currently active IP
    getCurrentIP: async (req, res, next) => {
        try {
            const activeIP = await IPWhitelistModel.findOne({ isActive: true }).sort({ updatedAt: -1 });
            
            if (!activeIP) {
                return res.status(200).json({
                    success: true,
                    message: 'No IP whitelist configured',
                    data: {
                        activeIP: null,
                        note: 'Add an IP to restrict backend API access'
                    }
                });
            }

            res.status(200).json({
                success: true,
                message: 'Current active IP',
                data: {
                    activeIP: activeIP.ipAddress,
                    description: activeIP.description,
                    updatedAt: activeIP.updatedAt,
                    note: 'Only this IP can access the backend APIs'
                }
            });
        } catch (error) {
            next(error);
        }
    },

    // POST /api/ipwhitelist/addMyIP - Automatically add current client IP
    addMyIP: async (req, res, next) => {
        try {
            const { description } = req.body;

            // Get client IP address
            const clientIP = req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
                req.headers['x-real-ip'] ||
                req.ip ||
                req.connection.remoteAddress ||
                req.socket.remoteAddress ||
                (req.connection.socket ? req.connection.socket.remoteAddress : null) ||
                'unknown';

            if (clientIP === 'unknown') {
                return res.status(400).json({
                    success: false,
                    message: 'Could not detect your IP address'
                });
            }

            // Remove /32 if present
            const cleanIP = clientIP.replace('/32', '').trim();

            // Deactivate all existing IPs
            await IPWhitelistModel.updateMany(
                { isActive: true },
                { isActive: false }
            );

            // Check if IP already exists
            let ipEntry = await IPWhitelistModel.findOne({ ipAddress: cleanIP });

            if (ipEntry) {
                // Reactivate and update
                ipEntry.isActive = true;
                ipEntry.description = description || ipEntry.description || 'Auto-added from current connection';
                ipEntry.updatedAt = new Date();
                await ipEntry.save();
            } else {
                // Create new entry
                ipEntry = new IPWhitelistModel({
                    ipAddress: cleanIP,
                    description: description || 'Auto-added from current connection',
                    isActive: true
                });
                await ipEntry.save();
            }

            // Clear cache immediately
            await cacheHelper.delete(IP_WHITELIST_CACHE_KEY);

            res.status(201).json({
                success: true,
                message: `Your IP (${cleanIP}) has been added. Only this IP can now access the APIs.`,
                data: {
                    ipAddress: cleanIP,
                    ipEntry: ipEntry,
                    note: 'This IP will work on both Render (live) and local. No need to update Render environment variables!'
                }
            });
        } catch (error) {
            if (error.code === 11000) {
                return res.status(400).json({
                    success: false,
                    message: 'IP address already exists'
                });
            }
            next(error);
        }
    },

    // GET /api/ipwhitelist/getMyPublicIP - Get the office WiFi's public IP (what backend sees)
    getMyPublicIP: async (req, res, next) => {
        try {
            // Get the IP that the backend sees (this is your office WiFi's PUBLIC IP)
            // All office devices on same WiFi will show the SAME public IP
            const publicIP = req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
                req.headers['x-real-ip'] ||
                req.ip ||
                req.connection.remoteAddress ||
                req.socket.remoteAddress ||
                (req.connection.socket ? req.connection.socket.remoteAddress : null) ||
                'unknown';

            // Get currently whitelisted IP
            const activeIP = await IPWhitelistModel.findOne({ isActive: true }).sort({ updatedAt: -1 });

            res.status(200).json({
                success: true,
                message: 'Office WiFi Public IP (what backend sees)',
                data: {
                    officeWiFiPublicIP: publicIP,  // This is what you need to whitelist in MongoDB!
                    note: 'All office devices on this WiFi share this same public IP',
                    yourLocalIP: '192.168.1.30 (from WiFi settings - NOT what backend sees)',
                    currentlyWhitelistedIP: activeIP ? activeIP.ipAddress : null,
                    isWhitelisted: activeIP && activeIP.ipAddress === publicIP,
                    instruction: activeIP && activeIP.ipAddress === publicIP
                        ? '✅ Office WiFi IP is whitelisted. All office devices will work!'
                        : `⚠️ Add this public IP (${publicIP}) to MongoDB. All office devices on this WiFi will then work.`
                }
            });
        } catch (error) {
            next(error);
        }
    }
};

module.exports = ipWhitelistController;

