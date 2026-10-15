const express = require('express');
const router = express.Router();
const ChatController = require('../controllers/chatController');
const { authenticateToken } = require('../middleware/authMiddleware');

router.get('/', authenticateToken, ChatController.listChats);
router.get('/:id', authenticateToken, ChatController.getChatById);
router.put('/:id/assign', authenticateToken, ChatController.assignChat);
router.put('/:id/status', authenticateToken, ChatController.updateStatus);
router.put('/:id/tags', authenticateToken, ChatController.updateTags);
router.put('/:id/contact', authenticateToken, ChatController.updateContact);

module.exports = router;
