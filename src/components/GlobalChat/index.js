const express = require('express');
const router = express.Router();

// Import controller
const globalChatController = require('./GlobalChatController');

// Routes
// POST /api/globalchat/messages - Create a new global chat message
router.post('/globalchat/messages', globalChatController.createMessage);

// GET /api/globalchat/messages - Get all global chat messages (with pagination)
router.get('/globalchat/messages', globalChatController.getMessages);

// GET /api/globalchat/messages/recent - Get recent messages (last N messages)
router.get('/globalchat/messages/recent', globalChatController.getRecentMessages);

// POST /api/globalchat/messages/archive - Set archived status (true/false) for a message
router.post('/globalchat/messages/archive', globalChatController.archiveMessage);

// GET /api/globalchat/messages/archived - Get archived messages for a user
router.get('/globalchat/messages/archived', globalChatController.getArchivedMessages);

// DELETE /api/globalchat/messages/:messageId - Delete a message (only own messages)
router.delete('/globalchat/messages/:messageId', globalChatController.deleteMessage);

module.exports = router;

