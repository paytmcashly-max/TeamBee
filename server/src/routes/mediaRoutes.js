const express = require('express');
const router = express.Router();
const MediaController = require('../controllers/mediaController');
const { authenticateToken } = require('../middleware/authMiddleware');

// Serve capability-named uploaded assets
router.get('/file/:filename', MediaController.getFile);

// Protected routes requiring staff authentication
router.post('/upload', express.json({ limit: '15mb' }), authenticateToken, MediaController.uploadFile);
router.get('/whatsapp/:mediaId', authenticateToken, MediaController.getWhatsAppMedia);

module.exports = router;
