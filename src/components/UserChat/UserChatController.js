const ConversationModel = require('./UserChatSchema/ConversationSchema');
const MessageModel = require('./UserChatSchema/MessageSchema');
const UserDetailsModel = require('../UserDetails/UserDetailsSchema/UserDetailsSchema');
const { getIO } = require('../../utils/socket');
const { cacheHelper } = require('../../config/redis');

const userChatController = {
    // ============================================================
    // USER MANAGEMENT
    // ============================================================

    // GET /api/userchat/users - Get all users for chat initiation (excluding current user)
    getUsersForChat: async (req, res, next) => {
        try {
            const { userId } = req.query;
            if (!userId) {
                return res.status(400).json({
                    success: false,
                    message: 'userId is required'
                });
            }

            // Fetch all users except the current user
            const users = await UserDetailsModel.find({
                userId: { $ne: userId }
            }).select('userId firstName lastName email profilePhoto role position')
                .sort({ firstName: 1 });

            res.status(200).json({
                success: true,
                data: users,
                count: users.length
            });
        } catch (error) {
            next(error);
        }
    },

    // ============================================================
    // CONVERSATION MANAGEMENT
    // ============================================================

    // GET /api/userchat/conversations - Get all conversations for current user
    getConversations: async (req, res, next) => {
        try {
            const { userId, limit = 50, skip = 0, archived = false } = req.query;
            if (!userId) {
                return res.status(400).json({
                    success: false,
                    message: 'userId is required'
                });
            }

            const limitNum = parseInt(limit);
            const skipNum = parseInt(skip);
            const isArchived = archived === 'true';

            // Find conversations where user is a participant and not deleted for them
            const conversations = await ConversationModel.find({
                participants: userId,
                deletedFor: { $ne: userId },
                isArchived: isArchived
            })
                .sort({ updatedAt: -1 })
                .skip(skipNum)
                .limit(limitNum)
                .lean();

            // Collect all unique participant IDs from fetched conversations
            const allParticipantIds = new Set();
            conversations.forEach(conv => {
                if (conv.participants) {
                    conv.participants.forEach(p => allParticipantIds.add(p));
                }
            });

            // Fetch details for all participants
            const userDetailsMap = new Map();
            if (allParticipantIds.size > 0) {
                const users = await UserDetailsModel.find({
                    userId: { $in: Array.from(allParticipantIds) }
                }).select('userId firstName lastName profilePhoto role position');

                users.forEach(user => {
                    userDetailsMap.set(user.userId, user);
                });
            }

            // Populate fresh participantDetails for each conversation
            const populatedConversations = conversations.map(conv => {
                // Get fresh details from map
                const details = conv.participants.map(pId => {
                    const user = userDetailsMap.get(pId);
                    if (user) {
                        return {
                            userId: user.userId,
                            firstName: user.firstName,
                            lastName: user.lastName,
                            profilePhoto: user.profilePhoto, // Ensure this field exists in your UserDetails schema
                            role: user.role,
                            position: user.position
                        };
                    }
                    return null;
                }).filter(Boolean);

                // Fallback to stored participantDetails if fetch failed for some reason, or use fresh ones
                return {
                    ...conv,
                    participantDetails: details.length > 0 ? details : conv.participantDetails
                };
            });

            const total = await ConversationModel.countDocuments({
                participants: userId,
                deletedFor: { $ne: userId },
                isArchived: isArchived
            });

            res.status(200).json({
                success: true,
                data: populatedConversations,
                total,
                limit: limitNum,
                skip: skipNum
            });
        } catch (error) {
            next(error);
        }
    },

    // POST /api/userchat/conversation/start - Create or get existing conversation
    createOrGetConversation: async (req, res, next) => {
        try {
            const { userId, otherUserId, participants, type, groupName, groupIcon } = req.body;

            if (type === 'individual') {
                // For individual chat, check if conversation already exists
                if (!otherUserId) {
                    return res.status(400).json({
                        success: false,
                        message: 'otherUserId is required for individual chat'
                    });
                }

                const conversationParticipants = [userId, otherUserId];

                const existing = await ConversationModel.findOne({
                    type: 'individual',
                    participants: { $all: conversationParticipants, $size: 2 }
                });

                if (existing) {
                    // Remove userId from deletedFor if they deleted it previously
                    if (existing.deletedFor && existing.deletedFor.includes(userId)) {
                        existing.deletedFor = existing.deletedFor.filter(id => id !== userId);
                        await existing.save();
                    }

                    return res.status(200).json({
                        success: true,
                        data: existing,
                        message: 'Conversation already exists'
                    });
                }

                // Fetch participant details for analytics
                const participantDetails = await UserDetailsModel.find({
                    userId: { $in: conversationParticipants }
                }).select('userId firstName lastName profilePhoto role position');

                const newConversation = new ConversationModel({
                    participants: conversationParticipants,
                    type: 'individual',
                    createdBy: userId,
                    participantDetails: participantDetails.map(p => ({
                        userId: p.userId,
                        firstName: p.firstName,
                        lastName: p.lastName,
                        profilePhoto: p.profilePhoto,
                        role: p.role,
                        position: p.position
                    }))
                });

                await newConversation.save();
                return res.status(201).json({
                    success: true,
                    data: newConversation,
                    message: 'Individual conversation created'
                });

            } else if (type === 'group') {
                // For group chat
                if (!participants || participants.length < 2) {
                    return res.status(400).json({
                        success: false,
                        message: 'At least 2 participants required for group chat'
                    });
                }

                if (!groupName) {
                    return res.status(400).json({
                        success: false,
                        message: 'groupName is required for group chat'
                    });
                }

                // Ensure creator is in participants
                if (!participants.includes(userId)) {
                    participants.push(userId);
                }

                // Fetch participant details for analytics
                const participantDetails = await UserDetailsModel.find({
                    userId: { $in: participants }
                }).select('userId firstName lastName profilePhoto role position');

                const newConversation = new ConversationModel({
                    participants,
                    type: 'group',
                    groupName,
                    groupIcon: groupIcon || null,
                    groupAdmin: [userId], // Creator is the first admin
                    createdBy: userId,
                    participantDetails: participantDetails.map(p => ({
                        userId: p.userId,
                        firstName: p.firstName,
                        lastName: p.lastName,
                        profilePhoto: p.profilePhoto,
                        role: p.role,
                        position: p.position
                    }))
                });

                await newConversation.save();

                // Emit socket event to all participants
                try {
                    const io = getIO();
                    if (io) {
                        participants.forEach(participantId => {
                            io.to(`user:${participantId}`).emit('userchat:conversation:created', newConversation);
                        });
                    }
                } catch (err) {
                    console.error('Socket emission failed:', err);
                }

                return res.status(201).json({
                    success: true,
                    data: newConversation,
                    message: 'Group conversation created'
                });
            } else {
                return res.status(400).json({
                    success: false,
                    message: 'Invalid conversation type. Must be "individual" or "group"'
                });
            }
        } catch (error) {
            next(error);
        }
    },

    // POST /api/userchat/conversations - Create a new conversation (LEGACY - kept for backward compatibility)
    createConversation: async (req, res, next) => {
        try {
            const { participants, type, groupName, creatorId } = req.body;

            if (type === 'individual') {
                // Check if already exists
                const existing = await ConversationModel.findOne({
                    type: 'individual',
                    participants: { $all: participants, $size: 2 }
                });
                if (existing) {
                    return res.status(200).json({
                        success: true,
                        data: existing,
                        message: 'Conversation already exists'
                    });
                }
            }

            // Fetch participant details
            const participantDetails = await UserDetailsModel.find({
                userId: { $in: participants }
            }).select('userId firstName lastName profilePhoto role position');

            const newConversation = new ConversationModel({
                participants,
                type: type || 'individual',
                groupName: type === 'group' ? groupName : undefined,
                groupAdmin: type === 'group' ? [creatorId] : [],
                createdBy: creatorId,
                participantDetails: participantDetails.map(p => ({
                    userId: p.userId,
                    firstName: p.firstName,
                    lastName: p.lastName,
                    profilePhoto: p.profilePhoto,
                    role: p.role,
                    position: p.position
                }))
            });

            await newConversation.save();
            res.status(201).json({ success: true, data: newConversation });
        } catch (error) {
            next(error);
        }
    },

    // GET /api/userchat/conversation/:conversationId/details - Get conversation details
    getConversationDetails: async (req, res, next) => {
        try {
            const { conversationId } = req.params;
            const { userId } = req.query;

            const conversation = await ConversationModel.findById(conversationId);

            if (!conversation) {
                return res.status(404).json({
                    success: false,
                    message: 'Conversation not found'
                });
            }

            // Check if user is a participant
            if (!conversation.participants.includes(userId)) {
                return res.status(403).json({
                    success: false,
                    message: 'You are not a participant in this conversation'
                });
            }

            // Populate fresh participant details
            const participantDetails = await UserDetailsModel.find({
                userId: { $in: conversation.participants }
            }).select('userId firstName lastName profilePhoto role position email');

            const conversationData = conversation.toObject();
            conversationData.participantDetails = participantDetails;

            res.status(200).json({
                success: true,
                data: conversationData
            });
        } catch (error) {
            next(error);
        }
    },

    // DELETE /api/userchat/conversation/:conversationId - Delete conversation for user
    deleteConversation: async (req, res, next) => {
        try {
            const { conversationId } = req.params;
            const { userId } = req.body;

            if (!userId) {
                return res.status(400).json({
                    success: false,
                    message: 'userId is required'
                });
            }

            const conversation = await ConversationModel.findByIdAndUpdate(
                conversationId,
                { $addToSet: { deletedFor: userId } },
                { new: true }
            );

            if (!conversation) {
                return res.status(404).json({
                    success: false,
                    message: 'Conversation not found'
                });
            }

            res.status(200).json({
                success: true,
                message: 'Conversation deleted',
                data: conversation
            });
        } catch (error) {
            next(error);
        }
    },

    // GET /api/userchat/conversations/search - Search conversations
    searchConversations: async (req, res, next) => {
        try {
            const { userId, query, limit = 20 } = req.query;

            if (!userId || !query) {
                return res.status(400).json({
                    success: false,
                    message: 'userId and query are required'
                });
            }

            const limitNum = parseInt(limit);

            // Search in conversations where user is a participant
            const conversations = await ConversationModel.find({
                participants: userId,
                deletedFor: { $ne: userId },
                $or: [
                    { groupName: { $regex: query, $options: 'i' } },
                    { 'participantDetails.firstName': { $regex: query, $options: 'i' } },
                    { 'participantDetails.lastName': { $regex: query, $options: 'i' } },
                    { 'lastMessage.text': { $regex: query, $options: 'i' } }
                ]
            }).limit(limitNum);

            res.status(200).json({
                success: true,
                data: conversations,
                count: conversations.length
            });
        } catch (error) {
            next(error);
        }
    },

    // ============================================================
    // MESSAGE MANAGEMENT
    // ============================================================

    // GET /api/userchat/messages/:conversationId - Get messages for a conversation (paginated)
    getMessages: async (req, res, next) => {
        try {
            const { conversationId } = req.params;
            const { limit = 50, skip = 0, userId } = req.query;

            const limitNum = parseInt(limit);
            const skipNum = parseInt(skip);

            // Using descending order to get latest messages first, chunked
            const messages = await MessageModel.find({
                conversationId,
                deletedFor: { $ne: userId },
                isDeleted: false
            })
                .sort({ createdAt: -1 })
                .skip(skipNum)
                .limit(limitNum);

            const total = await MessageModel.countDocuments({
                conversationId,
                deletedFor: { $ne: userId },
                isDeleted: false
            });

            res.status(200).json({
                success: true,
                data: messages.reverse(), // Reverse back to chronological for UI
                total,
                limit: limitNum,
                skip: skipNum
            });
        } catch (error) {
            next(error);
        }
    },

    // POST /api/userchat/messages - Send a new message
    sendMessage: async (req, res, next) => {
        try {
            const {
                conversationId,
                senderId,
                senderName,
                message,
                messageType,
                time,
                replyTo,
                deviceInfo,
                platform
            } = req.body;

            if (!conversationId) {
                return res.status(400).json({
                    success: false,
                    message: 'conversationId is required. Please create a conversation first.'
                });
            }

            if (!message || !senderId) {
                return res.status(400).json({
                    success: false,
                    message: 'senderId and message are required'
                });
            }

            const newMessage = new MessageModel({
                conversationId,
                senderId,
                senderName,
                message,
                messageType: messageType || 'text',
                time,
                replyTo: replyTo || null,
                deliveryStatus: 'sent',
                messageMetadata: {
                    deviceInfo: deviceInfo || 'web',
                    platform: platform || 'web'
                }
            });

            await newMessage.save();

            // Update last message in conversation and increment message count
            await ConversationModel.findByIdAndUpdate(conversationId, {
                lastMessage: {
                    text: message,
                    senderId,
                    senderName,
                    createdAt: new Date()
                },
                $inc: { messageCount: 1 }
            });

            // Emit via socket
            try {
                const io = getIO();
                if (io) {
                    // Emit to conversation room
                    io.to(String(conversationId)).emit('userchat:message', newMessage);

                    // Get conversation to notify participants
                    const conversation = await ConversationModel.findById(conversationId);
                    if (conversation) {
                        // Notify participants who are NOT the sender
                        conversation.participants.forEach(participant => {
                            if (String(participant) !== String(senderId)) {
                                io.to(`user:${participant}`).emit('userchat:notification', {
                                    conversationId,
                                    senderId,
                                    senderName,
                                    message: message.substring(0, 50),
                                    messageType,
                                    timestamp: new Date()
                                });
                            }
                        });

                        // Mark as delivered for all participants except sender
                        setTimeout(async () => {
                            await MessageModel.findByIdAndUpdate(newMessage._id, {
                                deliveryStatus: 'delivered'
                            });
                            io.to(String(conversationId)).emit('userchat:delivered', {
                                messageId: newMessage._id,
                                conversationId
                            });
                        }, 100);
                    }
                }
            } catch (err) {
                console.error('Socket emission failed:', err);
            }

            res.status(201).json({ success: true, data: newMessage });
        } catch (error) {
            next(error);
        }
    },

    // POST /api/userchat/messages/read - Mark messages as read
    markMessagesAsRead: async (req, res, next) => {
        try {
            const { conversationId, userId } = req.body;

            if (!conversationId || !userId) {
                return res.status(400).json({
                    success: false,
                    message: 'conversationId and userId are required'
                });
            }

            // Find all unread messages in this conversation (not sent by this user)
            const unreadMessages = await MessageModel.find({
                conversationId,
                senderId: { $ne: userId },
                'readBy.userId': { $ne: userId }
            });

            if (unreadMessages.length === 0) {
                return res.status(200).json({
                    success: true,
                    message: 'No unread messages',
                    count: 0
                });
            }

            // Update all unread messages
            const readAt = new Date();
            await MessageModel.updateMany(
                {
                    conversationId,
                    senderId: { $ne: userId },
                    'readBy.userId': { $ne: userId }
                },
                {
                    $push: {
                        readBy: {
                            userId,
                            readAt
                        }
                    },
                    $set: { deliveryStatus: 'read' }
                }
            );

            // Emit socket event
            try {
                const io = getIO();
                if (io) {
                    io.to(String(conversationId)).emit('userchat:read', {
                        conversationId,
                        userId,
                        readAt,
                        messageIds: unreadMessages.map(m => m._id)
                    });
                }
            } catch (err) {
                console.error('Socket emission failed:', err);
            }

            res.status(200).json({
                success: true,
                message: 'Messages marked as read',
                count: unreadMessages.length
            });
        } catch (error) {
            next(error);
        }
    },

    // ============================================================
    // GROUP MANAGEMENT
    // ============================================================

    // POST /api/userchat/group/add - Add member to group
    addGroupMember: async (req, res, next) => {
        try {
            const { conversationId, userId, addedBy } = req.body;

            if (!conversationId || !userId) {
                return res.status(400).json({
                    success: false,
                    message: 'conversationId and userId are required'
                });
            }

            const conversation = await ConversationModel.findById(conversationId);

            if (!conversation) {
                return res.status(404).json({
                    success: false,
                    message: 'Conversation not found'
                });
            }

            if (conversation.type !== 'group') {
                return res.status(400).json({
                    success: false,
                    message: 'This is not a group conversation'
                });
            }

            // Check if user is already a participant
            if (conversation.participants.includes(userId)) {
                return res.status(400).json({
                    success: false,
                    message: 'User is already a member of this group'
                });
            }

            // Add user to participants
            conversation.participants.push(userId);

            // Fetch user details for analytics
            const userDetail = await UserDetailsModel.findOne({ userId })
                .select('userId firstName lastName profilePhoto role position');

            if (userDetail) {
                conversation.participantDetails.push({
                    userId: userDetail.userId,
                    firstName: userDetail.firstName,
                    lastName: userDetail.lastName,
                    profilePhoto: userDetail.profilePhoto,
                    role: userDetail.role,
                    position: userDetail.position
                });
            }

            await conversation.save();

            // Emit socket event
            try {
                const io = getIO();
                if (io) {
                    io.to(String(conversationId)).emit('userchat:member:added', {
                        conversationId,
                        userId,
                        userDetail,
                        addedBy
                    });
                    // Notify the new member
                    io.to(`user:${userId}`).emit('userchat:conversation:created', conversation);
                }
            } catch (err) {
                console.error('Socket emission failed:', err);
            }

            res.status(200).json({
                success: true,
                data: conversation,
                message: 'Member added to group'
            });
        } catch (error) {
            next(error);
        }
    },

    // POST /api/userchat/group/remove - Remove member from group
    removeGroupMember: async (req, res, next) => {
        try {
            const { conversationId, userId, removedBy } = req.body;

            if (!conversationId || !userId) {
                return res.status(400).json({
                    success: false,
                    message: 'conversationId and userId are required'
                });
            }

            const conversation = await ConversationModel.findById(conversationId);

            if (!conversation) {
                return res.status(404).json({
                    success: false,
                    message: 'Conversation not found'
                });
            }

            if (conversation.type !== 'group') {
                return res.status(400).json({
                    success: false,
                    message: 'This is not a group conversation'
                });
            }

            // Remove user from participants
            conversation.participants = conversation.participants.filter(p => p !== userId);
            conversation.participantDetails = conversation.participantDetails.filter(p => p.userId !== userId);

            // If user was admin, remove from admin list
            if (conversation.groupAdmin.includes(userId)) {
                conversation.groupAdmin = conversation.groupAdmin.filter(a => a !== userId);
            }

            await conversation.save();

            // Emit socket event
            try {
                const io = getIO();
                if (io) {
                    io.to(String(conversationId)).emit('userchat:member:removed', {
                        conversationId,
                        userId,
                        removedBy
                    });
                }
            } catch (err) {
                console.error('Socket emission failed:', err);
            }

            res.status(200).json({
                success: true,
                data: conversation,
                message: 'Member removed from group'
            });
        } catch (error) {
            next(error);
        }
    },

    // PUT /api/userchat/group/:conversationId/info - Update group info
    updateGroupInfo: async (req, res, next) => {
        try {
            const { conversationId } = req.params;
            const { groupName, groupIcon, userId } = req.body;

            const conversation = await ConversationModel.findById(conversationId);

            if (!conversation) {
                return res.status(404).json({
                    success: false,
                    message: 'Conversation not found'
                });
            }

            if (conversation.type !== 'group') {
                return res.status(400).json({
                    success: false,
                    message: 'This is not a group conversation'
                });
            }

            // Check if user is admin
            if (!conversation.groupAdmin.includes(userId)) {
                return res.status(403).json({
                    success: false,
                    message: 'Only group admins can update group info'
                });
            }

            if (groupName) conversation.groupName = groupName;
            if (groupIcon !== undefined) conversation.groupIcon = groupIcon;

            await conversation.save();

            // Emit socket event
            try {
                const io = getIO();
                if (io) {
                    io.to(String(conversationId)).emit('userchat:conversation:updated', {
                        conversationId,
                        groupName,
                        groupIcon,
                        updatedBy: userId
                    });
                }
            } catch (err) {
                console.error('Socket emission failed:', err);
            }

            res.status(200).json({
                success: true,
                data: conversation,
                message: 'Group info updated'
            });
        } catch (error) {
            next(error);
        }
    },

    // POST /api/userchat/group/:conversationId/admin - Make user admin
    makeGroupAdmin: async (req, res, next) => {
        try {
            const { conversationId } = req.params;
            const { userId, requesterId } = req.body;

            const conversation = await ConversationModel.findById(conversationId);

            if (!conversation) {
                return res.status(404).json({
                    success: false,
                    message: 'Conversation not found'
                });
            }

            if (conversation.type !== 'group') {
                return res.status(400).json({
                    success: false,
                    message: 'This is not a group conversation'
                });
            }

            // Check if requester is admin
            if (!conversation.groupAdmin.includes(requesterId)) {
                return res.status(403).json({
                    success: false,
                    message: 'Only group admins can promote members'
                });
            }

            // Check if user is a participant
            if (!conversation.participants.includes(userId)) {
                return res.status(400).json({
                    success: false,
                    message: 'User is not a member of this group'
                });
            }

            // Check if already admin
            if (conversation.groupAdmin.includes(userId)) {
                return res.status(400).json({
                    success: false,
                    message: 'User is already a group admin'
                });
            }

            conversation.groupAdmin.push(userId);
            await conversation.save();

            // Emit socket event
            try {
                const io = getIO();
                if (io) {
                    io.to(String(conversationId)).emit('userchat:admin:added', {
                        conversationId,
                        userId,
                        promotedBy: requesterId
                    });
                }
            } catch (err) {
                console.error('Socket emission failed:', err);
            }

            res.status(200).json({
                success: true,
                data: conversation,
                message: 'User promoted to admin'
            });
        } catch (error) {
            next(error);
        }
    },

    // POST /api/userchat/group/:conversationId/leave - Leave group
    leaveGroup: async (req, res, next) => {
        try {
            const { conversationId } = req.params;
            const { userId } = req.body;

            const conversation = await ConversationModel.findById(conversationId);

            if (!conversation) {
                return res.status(404).json({
                    success: false,
                    message: 'Conversation not found'
                });
            }

            if (conversation.type !== 'group') {
                return res.status(400).json({
                    success: false,
                    message: 'This is not a group conversation'
                });
            }

            // Remove user from participants
            conversation.participants = conversation.participants.filter(p => p !== userId);
            conversation.participantDetails = conversation.participantDetails.filter(p => p.userId !== userId);

            // If user was admin, remove from admin list
            if (conversation.groupAdmin.includes(userId)) {
                conversation.groupAdmin = conversation.groupAdmin.filter(a => a !== userId);
            }

            await conversation.save();

            // Emit socket event
            try {
                const io = getIO();
                if (io) {
                    io.to(String(conversationId)).emit('userchat:member:left', {
                        conversationId,
                        userId
                    });
                }
            } catch (err) {
                console.error('Socket emission failed:', err);
            }

            res.status(200).json({
                success: true,
                message: 'Left group successfully'
            });
        } catch (error) {
            next(error);
        }
    }
};

module.exports = userChatController;
