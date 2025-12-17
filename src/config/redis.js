const redis = require('redis');

let redisClient = null;

// Initialize Redis client
const initRedis = async () => {
    try {
        const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
        
        redisClient = redis.createClient({
            url: redisUrl,
            socket: {
                reconnectStrategy: (retries) => {
                    if (retries > 10) {
                        console.error('❌ Redis: Too many reconnection attempts, giving up');
                        return new Error('Too many retries');
                    }
                    return Math.min(retries * 100, 3000);
                }
            }
        });

        // Error handling
        redisClient.on('error', (err) => {
            console.error('❌ Redis Client Error:', err);
        });

        redisClient.on('connect', () => {
            console.log('✅ Redis: Connected to Redis server');
        });

        redisClient.on('ready', () => {
            console.log('✅ Redis: Client ready to use');
        });

        redisClient.on('end', () => {
            console.log('🔌 Redis: Connection closed');
        });

        // Connect to Redis
        await redisClient.connect();
        
        return redisClient;
    } catch (error) {
        console.error('❌ Redis connection failed:', error.message);
        console.warn('⚠️ Continuing without Redis cache...');
        return null;
    }
};

// Get Redis client
const getRedisClient = () => {
    return redisClient;
};

// Check if Redis is connected
const isRedisConnected = () => {
    return redisClient && redisClient.isReady;
};

// Cache helper functions
const cacheHelper = {
    // Get cached data
    async get(key) {
        try {
            if (!isRedisConnected()) return null;
            const data = await redisClient.get(key);
            return data ? JSON.parse(data) : null;
        } catch (error) {
            console.error(`Redis GET error for key "${key}":`, error.message);
            return null;
        }
    },

    // Set cache with expiration (in seconds)
    async set(key, value, expirationSeconds = 300) {
        try {
            if (!isRedisConnected()) return false;
            const stringValue = JSON.stringify(value);
            if (expirationSeconds) {
                await redisClient.setEx(key, expirationSeconds, stringValue);
            } else {
                await redisClient.set(key, stringValue);
            }
            return true;
        } catch (error) {
            console.error(`Redis SET error for key "${key}":`, error.message);
            return false;
        }
    },

    // Delete cache
    async delete(key) {
        try {
            if (!isRedisConnected()) return false;
            await redisClient.del(key);
            return true;
        } catch (error) {
            console.error(`Redis DELETE error for key "${key}":`, error.message);
            return false;
        }
    },

    // Delete multiple keys matching a pattern
    async deletePattern(pattern) {
        try {
            if (!isRedisConnected()) return false;
            const keys = await redisClient.keys(pattern);
            if (keys.length > 0) {
                await redisClient.del(keys);
            }
            return true;
        } catch (error) {
            console.error(`Redis DELETE PATTERN error for "${pattern}":`, error.message);
            return false;
        }
    }
};

// Close Redis connection
const closeRedis = async () => {
    try {
        if (redisClient && redisClient.isOpen) {
            await redisClient.quit();
            console.log('✅ Redis: Connection closed gracefully');
        }
    } catch (error) {
        console.error('❌ Redis close error:', error.message);
    }
};

module.exports = {
    initRedis,
    getRedisClient,
    isRedisConnected,
    cacheHelper,
    closeRedis
};

