const { cacheHelper, isRedisConnected } = require('../config/redis');
const crypto = require('crypto');

/**
 * Generate cache key from request
 */
const generateCacheKey = (req) => {
    const method = req.method;
    const path = req.originalUrl || req.path;
    const query = req.query;
    
    // Create a hash from query parameters for consistent key
    const queryString = Object.keys(query)
        .sort()
        .map(key => `${key}=${query[key]}`)
        .join('&');
    
    // Create cache key: method:path:queryHash
    const keyString = `${method}:${path}${queryString ? ':' + crypto.createHash('md5').update(queryString).digest('hex') : ''}`;
    
    // Replace special characters and limit length
    return keyString.replace(/[^a-zA-Z0-9:]/g, '_').substring(0, 200);
};

/**
 * Redis Cache Middleware
 * Automatically caches GET requests and invalidates cache on POST/PUT/DELETE
 * 
 * Options:
 * - duration: Cache duration in seconds (default: 300 = 5 minutes)
 * - excludedRoutes: Array of route patterns to exclude from caching
 * - excludedMethods: Array of HTTP methods to exclude (default: [])
 */
const redisCache = (options = {}) => {
    const {
        duration = 300, // 5 minutes default
        excludedRoutes = [],
        excludedMethods = [],
        skipCache = false // Set to true to disable caching
    } = options;

    return async (req, res, next) => {
        // Skip if Redis is not connected
        if (!isRedisConnected() || skipCache) {
            return next();
        }

        const method = req.method.toUpperCase();
        const path = req.path;

        // Skip excluded methods
        if (excludedMethods.includes(method)) {
            return next();
        }

        // Skip excluded routes
        if (excludedRoutes.some(pattern => path.match(pattern))) {
            return next();
        }

        // Handle GET requests - Cache responses
        if (method === 'GET') {
            const cacheKey = `cache:${generateCacheKey(req)}`;
            
            try {
                // Try to get from cache
                const cachedData = await cacheHelper.get(cacheKey);
                
                if (cachedData) {
                    // Add cache header
                    res.setHeader('X-Cache', 'HIT');
                    res.setHeader('X-Cache-Key', cacheKey);
                    
                    return res.status(200).json({
                        ...cachedData,
                        cached: true
                    });
                }

                // Cache miss - Store original json method
                const originalJson = res.json.bind(res);
                
                // Override res.json to cache the response
                res.json = function(data) {
                    // Only cache successful responses and if not already cached manually
                    if (res.statusCode >= 200 && res.statusCode < 300 && !data.cached) {
                        // Cache the response (clone data to avoid modifying original)
                        const dataToCache = { ...data };
                        // Remove cached flag if exists to avoid storing it
                        if (dataToCache.cached !== undefined) {
                            delete dataToCache.cached;
                        }
                        
                        cacheHelper.set(cacheKey, dataToCache, duration).catch(err => {
                            console.error('Cache set error:', err.message);
                        });
                    }
                    
                    // Set cache headers
                    res.setHeader('X-Cache', 'MISS');
                    res.setHeader('X-Cache-Key', cacheKey);
                    
                    // Call original json method
                    return originalJson(data);
                };

                return next();
            } catch (error) {
                console.error('Cache middleware error:', error.message);
                return next();
            }
        }

        // Handle POST/PUT/DELETE - Invalidate related caches
        if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(method)) {
            // Store original json method
            const originalJson = res.json.bind(res);
            
            // Override res.json to invalidate cache after successful operations
            res.json = async function(data) {
                // Only invalidate on successful operations
                if (res.statusCode >= 200 && res.statusCode < 300) {
                    try {
                        // Invalidate caches related to this path
                        const basePath = path.replace(/\/\d+$/, '').replace(/\/[^/]+$/, ''); // Remove last param segments
                        const fullPath = path;
                        
                        // Invalidate exact path caches
                        await cacheHelper.deletePattern(`cache:GET:${fullPath}*`);
                        await cacheHelper.deletePattern(`cache:POST:${fullPath}*`);
                        await cacheHelper.deletePattern(`cache:PUT:${fullPath}*`);
                        await cacheHelper.deletePattern(`cache:DELETE:${fullPath}*`);
                        
                        // Also invalidate parent resource caches
                        if (basePath !== fullPath) {
                            await cacheHelper.deletePattern(`cache:GET:${basePath}*`);
                        }
                        
                        // For nested resources, invalidate parent caches
                        // e.g., /api/clientmanagement/:clientId/attachments invalidates /api/clientmanagement/*
                        const parts = basePath.split('/').filter(p => p && !p.match(/^:/));
                        if (parts.length > 2) {
                            const parentPath = '/' + parts.slice(0, -1).join('/');
                            await cacheHelper.deletePattern(`cache:GET:${parentPath}*`);
                        }
                    } catch (error) {
                        console.error('Cache invalidation error:', error.message);
                    }
                }
                
                return originalJson(data);
            };

            return next();
        }

        // For other methods, just pass through
        return next();
    };
};

/**
 * Manual cache invalidation helper
 * Use this in controllers when you need custom cache invalidation
 */
const invalidateCache = async (pattern) => {
    try {
        if (isRedisConnected()) {
            await cacheHelper.deletePattern(pattern);
        }
    } catch (error) {
        console.error('Cache invalidation error:', error.message);
    }
};

module.exports = {
    redisCache,
    invalidateCache,
    generateCacheKey
};

