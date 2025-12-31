const express = require('express');
const router = express.Router();
const ipWhitelistController = require('./IPWhitelistController');

// Routes - Always allow IP whitelist management routes (to add/update IPs)
// POST /api/ipwhitelist/setIP - Set the IP (simple - replaces any old IP)
router.post('/ipwhitelist/setIP', ipWhitelistController.setIP);

// GET /api/ipwhitelist/getCurrentIP - Get the currently active IP
router.get('/ipwhitelist/getCurrentIP', ipWhitelistController.getCurrentIP);

// POST /api/ipwhitelist/addMyIP - Automatically add current client IP
router.post('/ipwhitelist/addMyIP', ipWhitelistController.addMyIP);

// GET /api/ipwhitelist/getMyPublicIP - Get the public IP that backend sees
router.get('/ipwhitelist/getMyPublicIP', ipWhitelistController.getMyPublicIP);

module.exports = router;

