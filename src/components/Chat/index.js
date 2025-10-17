const express = require('express');
const router = express.Router();

const chatController = require('./ChatController');

// Create message
router.post('/chat/messages', chatController.createMessage);

// List messages by task
router.get('/chat/messages', chatController.listByTask);

// List messages by user
router.get('/chat/messages/user/:userId', chatController.listByUser);

module.exports = router;




