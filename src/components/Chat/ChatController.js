const ChatThreadModel = require('./ChatSchema/ChatThreadSchema');
const AddTaskAssignModel = require('../AddTaskAssign/AddTaskAssignSchema/AddTaskAssignSchema');
const { cacheHelper } = require('../../config/redis');

const chatController = {
    // POST /api/chat/messages - create or append to thread
    createMessage: async (req, res, next) => {
        try {
            const { taskId, senderId, receiverId, userName, message, time } = req.body;
            const createdAt = new Date();

            const update = {
                $push: {
                    messages: {
                        senderId,
                        receiverId,
                        userId: senderId,
                        userName,
                        message,
                        time,
                        createdAt
                    }
                },
                $set: { updatedAt: createdAt }
            };
            const options = { upsert: true, new: true, setDefaultsOnInsert: true };
            const thread = await ChatThreadModel.findOneAndUpdate({ taskId }, update, options);

            // Update task metadata
            await AddTaskAssignModel.findByIdAndUpdate(taskId, {
                lastMessage: message,
                lastMessageAt: createdAt,
                chatCount: thread.messages.length
            });

            // Invalidate cache for this task's messages
            await cacheHelper.delete(`chat:messages:task:${taskId}`);
            // Invalidate cache for both sender and receiver user messages
            if (senderId) await cacheHelper.deletePattern(`chat:messages:user:${senderId}*`);
            if (receiverId) await cacheHelper.deletePattern(`chat:messages:user:${receiverId}*`);

            // Emit socket event if available
            try {
                const { getIO } = require('../../utils/socket');
                const io = getIO && getIO();
                if (io && thread?.messages?.length) {
                    const newMessage = thread.messages[thread.messages.length - 1];
                    const payload = {
                        taskId: String(taskId),
                        message: {
                            senderId: newMessage?.senderId || senderId,
                            receiverId: newMessage?.receiverId || receiverId,
                            userId: newMessage?.userId || senderId,
                            userName: newMessage?.userName || userName,
                            message: newMessage?.message || message,
                            time: newMessage?.time || time,
                            createdAt: newMessage?.createdAt || createdAt
                        },
                        playSound: true,
                        notificationType: 'chat_message',
                        message: `New message from ${newMessage?.userName || userName}`
                    };
                    io.to(String(taskId)).emit('chat:new', payload);
                    // Also emit to receiver if different from sender
                    if (receiverId && receiverId !== senderId) {
                        io.to(`user:${receiverId}`).emit('chat:new', payload);
                    }
                }
            } catch (e) { }

            res.status(201).json({ success: true, message: 'Message created', data: thread });
        } catch (error) {
            next(error);
        }
    },

    // GET /api/chat/messages?taskId=...  (list messages for a task)
    listByTask: async (req, res, next) => {
        try {
            const { taskId } = req.query;

            if (!taskId) {
                return res.status(400).json({
                    success: false,
                    message: 'taskId query parameter is required'
                });
            }

            // Build cache key
            const cacheKey = `chat:messages:task:${taskId}`;

            // Try to get from cache first
            const cachedData = await cacheHelper.get(cacheKey);
            if (cachedData) {
                return res.status(200).json({
                    success: true,
                    data: cachedData.messages,
                    count: cachedData.messages.length,
                    cached: true
                });
            }

            // Query database
            const thread = await ChatThreadModel.findOne({ taskId });
            const messages = thread ? thread.messages : [];

            // Cache the result for 60 seconds
            await cacheHelper.set(cacheKey, { messages }, 60);

            res.status(200).json({
                success: true,
                data: messages,
                count: messages.length,
                cached: false
            });
        } catch (error) {
            next(error);
        }
    },

    // GET /api/chat/messages/user/:userId  (list messages by user across tasks)
    listByUser: async (req, res, next) => {
        try {
            const { userId } = req.params;

            // Build cache key
            const cacheKey = `chat:messages:user:${userId}`;

            // Try to get from cache first
            const cachedData = await cacheHelper.get(cacheKey);
            if (cachedData) {
                return res.status(200).json({
                    success: true,
                    data: cachedData,
                    count: cachedData.length,
                    cached: true
                });
            }

            // Find threads where user is either sender or receiver
            const threads = await ChatThreadModel.find({
                $or: [
                    { 'messages.senderId': userId },    // Messages sent by user
                    { 'messages.receiverId': userId }   // Messages received by user
                ]
            });

            const all = [];
            threads.forEach(t => {
                t.messages.forEach(m => {
                    // Include message if user is sender OR receiver
                    if (m.senderId === userId || m.receiverId === userId) {
                        all.push({ taskId: t.taskId, ...m.toObject() });
                    }
                });
            });

            // sort by createdAt desc
            all.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

            // Cache the result for 60 seconds
            await cacheHelper.set(cacheKey, all, 60);

            res.status(200).json({
                success: true,
                data: all,
                count: all.length,
                cached: false
            });
        } catch (error) {
            next(error);
        }
    }
};

module.exports = chatController;


