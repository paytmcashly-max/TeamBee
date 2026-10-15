const express = require('express');
const router = express.Router();
const MessageController = require('../controllers/messageController');
const { authenticateToken } = require('../middleware/authMiddleware');

router.get('/:chatId', authenticateToken, MessageController.getMessages);
router.post('/:chatId', authenticateToken, MessageController.sendMessage);

module.exports = router;
