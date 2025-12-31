const GlobalChatMessageModel = require('./GlobalChatSchema/GlobalChatSchema');
const { getIO } = require('../../utils/socket');
const { cacheHelper } = require('../../config/redis');

const globalChatController = {
    // POST /api/globalchat/messages - Create a new global chat message
    createMessage: async (req, res, next) => {
        try {
            const { senderId, senderName, senderEmail, message, messageType, time } = req.body;

            // Validate required fields
            if (!senderId || !senderName || !message || !time) {
                return res.status(400).json({
                    success: false,
                    message: 'Missing required fields: senderId, senderName, message, and time are required'
                });
            }

            // Validate messageType
            const validMessageTypes = ['text', 'image', 'video', 'file'];
            const normalizedMessageType = messageType || 'text';
            if (!validMessageTypes.includes(normalizedMessageType)) {
                return res.status(400).json({
                    success: false,
                    message: 'Invalid messageType. Must be one of: text, image, video, file'
                });
            }

            // Create new message
            const newMessage = new GlobalChatMessageModel({
                senderId: senderId.trim(),
                senderName: senderName.trim(),
                senderEmail: senderEmail ? senderEmail.trim() : '',
                message: message.trim(),
                messageType: normalizedMessageType,
                time: time.trim()
            });

            const savedMessage = await newMessage.save();

            // Invalidate cache for global chat messages
            await cacheHelper.deletePattern('globalchat:messages:*');
            await cacheHelper.deletePattern('globalchat:messages:recent:*');

            // Emit socket event for real-time message broadcasting
            try {
                const io = getIO && getIO();
                if (io) {
                    const socketPayload = {
                        _id: String(savedMessage._id),
                        senderId: savedMessage.senderId,
                        senderName: savedMessage.senderName,
                        senderEmail: savedMessage.senderEmail,
                        message: savedMessage.message,
                        messageType: savedMessage.messageType,
                        time: savedMessage.time,
                        createdAt: savedMessage.createdAt
                    };

                    // Broadcast to all users in global-chat room
                    io.to('global-chat').emit('globalchat:new', socketPayload);

                    // Also emit globally for backward compatibility
                    io.emit('globalchat:new', socketPayload);
                }
            } catch (e) {
                console.warn('Socket emission failed:', e.message);
            }

            res.status(201).json({
                success: true,
                message: 'Global chat message created successfully',
                data: savedMessage
            });
        } catch (error) {
            next(error);
        }
    },

    // GET /api/globalchat/messages - Get all global chat messages (with pagination, excludes archived messages for userId)
    getMessages: async (req, res, next) => {
        try {
            const { limit = 100, skip = 0, sort = 'asc', userId } = req.query;

            // Validate limit (max 500)
            const limitNum = Math.min(parseInt(limit) || 100, 500);
            const skipNum = parseInt(skip) || 0;
            const sortOrder = sort === 'desc' ? -1 : 1; // 'asc' = 1, 'desc' = -1

            // Validate skip
            if (skipNum < 0) {
                return res.status(400).json({
                    success: false,
                    message: 'skip must be a non-negative number'
                });
            }

            // Build cache key
            const cacheKey = `globalchat:messages:limit${limitNum}:skip${skipNum}:sort${sort}`;

            // Try to get from cache first
            const cachedData = await cacheHelper.get(cacheKey);
            if (cachedData) {
                return res.status(200).json({
                    success: true,
                    message: 'Global chat messages retrieved successfully (cached)',
                    data: cachedData.messages,
                    total: cachedData.total,
                    limit: limitNum,
                    skip: skipNum,
                    count: cachedData.messages.length,
                    cached: true
                });
            }

            // Build query - exclude archived messages (archived = false or null)
            let query = { archived: { $ne: true } };

            // Get total count (excluding archived messages)
            const total = await GlobalChatMessageModel.countDocuments(query);

            // Apply sorting and pagination
            const messages = await GlobalChatMessageModel.find(query)
                .sort({ createdAt: sortOrder })
                .skip(skipNum)
                .limit(limitNum)
                .exec();

            // Cache the result for 60 seconds
            await cacheHelper.set(cacheKey, {
                messages,
                total,
                limit: limitNum,
                skip: skipNum
            }, 60);

            res.status(200).json({
                success: true,
                message: 'Global chat messages retrieved successfully',
                data: messages,
                total: total,
                limit: limitNum,
                skip: skipNum,
                count: messages.length,
                cached: false
            });
        } catch (error) {
            next(error);
        }
    },

    // GET /api/globalchat/messages/recent - Get recent messages (last N messages, returns ALL messages including archived)
    getRecentMessages: async (req, res, next) => {
        try {
            const { count = 50 } = req.query;

            // Validate count (max 500)
            const countNum = Math.min(parseInt(count) || 50, 500);

            if (countNum <= 0) {
                return res.status(400).json({
                    success: false,
                    message: 'count must be a positive number'
                });
            }

            // Build cache key
            const cacheKey = `globalchat:messages:recent:count${countNum}`;

            // Try to get from cache first
            const cachedData = await cacheHelper.get(cacheKey);
            if (cachedData) {
                return res.status(200).json({
                    success: true,
                    message: 'Recent global chat messages retrieved successfully (cached)',
                    data: cachedData,
                    count: cachedData.length,
                    cached: true
                });
            }

            // Get recent messages sorted by createdAt descending (newest first)
            // Return ALL messages including archived ones (no filter)
            const messages = await GlobalChatMessageModel.find({})
                .sort({ createdAt: -1 })
                .limit(countNum)
                .exec();

            // Reverse to show oldest first (chronological order)
            const reversedMessages = messages.reverse();

            // Cache the result for 30 seconds
            await cacheHelper.set(cacheKey, reversedMessages, 30);

            res.status(200).json({
                success: true,
                message: 'Recent global chat messages retrieved successfully',
                data: reversedMessages,
                count: reversedMessages.length,
                cached: false
            });
        } catch (error) {
            next(error);
        }
    },

    // POST /api/globalchat/messages/archive - Set archived status for a message (only own messages)
    archiveMessage: async (req, res, next) => {
        try {
            const { messageId, userId, archived } = req.body;

            // Validate required fields
            if (!messageId || !userId || archived === undefined) {
                return res.status(400).json({
                    success: false,
                    message: 'messageId, userId, and archived (true/false) are required'
                });
            }

            // Validate archived is boolean
            if (typeof archived !== 'boolean') {
                return res.status(400).json({
                    success: false,
                    message: 'archived must be a boolean value (true or false)'
                });
            }

            // Check if message exists
            const message = await GlobalChatMessageModel.findById(messageId);
            if (!message) {
                return res.status(404).json({
                    success: false,
                    message: 'Message not found'
                });
            }

            // Verify user can only archive their own messages
            if (message.senderId !== userId.trim()) {
                return res.status(403).json({
                    success: false,
                    message: 'You can only archive your own messages'
                });
            }

            // Update archived status
            message.archived = archived;
            await message.save();

            // Invalidate cache when archive status changes
            await cacheHelper.deletePattern('globalchat:messages:*');
            await cacheHelper.deletePattern('globalchat:messages:recent:*');

            res.status(200).json({
                success: true,
                message: `Message ${archived ? 'archived' : 'unarchived'} successfully`,
                data: {
                    messageId: messageId,
                    userId: userId.trim(),
                    archived: archived
                }
            });
        } catch (error) {
            next(error);
        }
    },


    // GET /api/globalchat/messages/archived - Get archived messages (archived = true)
    getArchivedMessages: async (req, res, next) => {
        try {
            const { userId } = req.query;

            // Build query - get archived messages
            let query = { archived: true };

            // If userId provided, only show messages from that user
            if (userId) {
                query.senderId = userId.trim();
            }

            // Get archived messages
            const archivedMessages = await GlobalChatMessageModel.find(query)
                .sort({ createdAt: -1 }) // Newest first
                .exec();

            res.status(200).json({
                success: true,
                message: 'Archived messages retrieved successfully',
                data: archivedMessages,
                count: archivedMessages.length
            });
        } catch (error) {
            next(error);
        }
    },

    // DELETE /api/globalchat/messages/:messageId - Delete a message (only own messages)
    deleteMessage: async (req, res, next) => {
        try {
            const { messageId } = req.params;
            const { userId } = req.body;

            // Validate required fields
            if (!userId) {
                return res.status(400).json({
                    success: false,
                    message: 'userId is required in request body'
                });
            }

            // Check if message exists
            const message = await GlobalChatMessageModel.findById(messageId);
            if (!message) {
                return res.status(404).json({
                    success: false,
                    message: 'Message not found'
                });
            }

            // Verify user can only delete their own messages
            if (message.senderId !== userId.trim()) {
                return res.status(403).json({
                    success: false,
                    message: 'You can only delete your own messages'
                });
            }

            // Delete the message
            await GlobalChatMessageModel.findByIdAndDelete(messageId);

            // Invalidate cache when message is deleted
            await cacheHelper.deletePattern('globalchat:messages:*');
            await cacheHelper.deletePattern('globalchat:messages:recent:*');

            // Emit socket event for real-time message deletion
            try {
                const io = getIO && getIO();
                if (io) {
                    const socketPayload = {
                        messageId: String(messageId),
                        deleted: true
                    };

                    // Broadcast to all users in global-chat room
                    io.to('global-chat').emit('globalchat:deleted', socketPayload);
                    console.log('📤 Emitted globalchat:deleted to global-chat room:', socketPayload);
                    
                    // Also emit globally for all connected clients (even if not in room)
                    io.emit('globalchat:deleted', socketPayload);
                    console.log('📤 Emitted globalchat:deleted globally:', socketPayload);
                } else {
                    console.warn('⚠️ Socket.IO instance not available');
                }
            } catch (e) {
                console.warn('❌ Socket emission failed:', e.message);
            }

            res.status(200).json({
                success: true,
                message: 'Message deleted successfully',
                data: {
                    messageId: messageId,
                    deleted: true
                }
            });
        } catch (error) {
            next(error);
        }
    }
};

module.exports = globalChatController;

