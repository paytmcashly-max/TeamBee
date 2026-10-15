const express = require('express');
const router = express.Router();
const BroadcastController = require('../controllers/broadcastController');
const { authenticateToken, requireRole } = require('../middleware/authMiddleware');

router.get('/', authenticateToken, BroadcastController.listBroadcasts);
router.post('/', authenticateToken, requireRole(['ADMIN', 'SUPERVISOR']), BroadcastController.createBroadcast);

module.exports = router;
