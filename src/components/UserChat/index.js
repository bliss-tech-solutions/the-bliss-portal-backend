const express = require('express');
const router = express.Router();
const userChatController = require('./UserChatController');

// ============================================================
// USER MANAGEMENT
// ============================================================
// Get all users for chat initiation (excluding current user)
router.get('/userchat/users', userChatController.getUsersForChat);

// ============================================================
// CONVERSATION MANAGEMENT
// ============================================================
// Get all conversations for current user (with pagination and filtering)
router.get('/userchat/conversations', userChatController.getConversations);

// Create or get existing conversation (smart endpoint for frontend)
router.post('/userchat/conversation/start', userChatController.createOrGetConversation);

// Get conversation details with participant info
router.get('/userchat/conversation/:conversationId/details', userChatController.getConversationDetails);

// Delete conversation for user (soft delete)
router.delete('/userchat/conversation/:conversationId', userChatController.deleteConversation);

// Search conversations by name or message content
router.get('/userchat/conversations/search', userChatController.searchConversations);

// Legacy: Create conversation (kept for backward compatibility)
router.post('/userchat/conversations', userChatController.createConversation);

// ============================================================
// MESSAGE MANAGEMENT
// ============================================================
// Get messages for a conversation (paginated)
router.get('/userchat/messages/:conversationId', userChatController.getMessages);

// Send a new message
router.post('/userchat/messages', userChatController.sendMessage);

// Mark messages as read
router.post('/userchat/messages/read', userChatController.markMessagesAsRead);

// ============================================================
// GROUP MANAGEMENT
// ============================================================
// Add member to group
router.post('/userchat/group/add', userChatController.addGroupMember);

// Remove member from group
router.post('/userchat/group/remove', userChatController.removeGroupMember);

// Update group info (name, icon)
router.put('/userchat/group/:conversationId/info', userChatController.updateGroupInfo);

// Make user a group admin
router.post('/userchat/group/:conversationId/admin', userChatController.makeGroupAdmin);

// Leave group
router.post('/userchat/group/:conversationId/leave', userChatController.leaveGroup);

module.exports = router;
