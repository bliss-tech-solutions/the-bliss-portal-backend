const ChatThreadModel = require('./ChatSchema/ChatThreadSchema');
const AddTaskAssignModel = require('../AddTaskAssign/AddTaskAssignSchema/AddTaskAssignSchema');

const chatController = {
    // POST /api/chat/messages - create or append to thread
    createMessage: async (req, res, next) => {
        try {
            const { taskId, senderId, receiverId, userName, message, time } = req.body;

            const update = {
                $push: { messages: { senderId, receiverId, userId: senderId, userName, message, time } },
                $set: { updatedAt: new Date() }
            };
            const options = { upsert: true, new: true, setDefaultsOnInsert: true };
            const thread = await ChatThreadModel.findOneAndUpdate({ taskId }, update, options);

            // Update task metadata
            await AddTaskAssignModel.findByIdAndUpdate(taskId, {
                lastMessage: message,
                lastMessageAt: new Date(),
                chatCount: thread.messages.length
            });

            // Emit socket event if available
            try {
                const { getIO } = require('../../utils/socket');
                const io = getIO && getIO();
                if (io) io.to(String(taskId)).emit('chat:new', {
                    taskId,
                    message: { senderId, receiverId, userId: senderId, userName, message, time }
                });
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
            const thread = await ChatThreadModel.findOne({ taskId });
            const messages = thread ? thread.messages : [];
            res.status(200).json({ success: true, data: messages, count: messages.length });
        } catch (error) {
            next(error);
        }
    },

    // GET /api/chat/messages/user/:userId  (list messages by user across tasks)
    listByUser: async (req, res, next) => {
        try {
            const { userId } = req.params;

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
            res.status(200).json({ success: true, data: all, count: all.length });
        } catch (error) {
            next(error);
        }
    }
};

module.exports = chatController;


