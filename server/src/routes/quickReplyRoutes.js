const express = require('express');
const router = express.Router();
const QuickReplyController = require('../controllers/quickReplyController');
const { authenticateToken, requireRole } = require('../middleware/authMiddleware');

router.get('/', authenticateToken, QuickReplyController.list);
router.post('/', authenticateToken, requireRole('ADMIN', 'SUPERVISOR'), QuickReplyController.create);
router.put('/:id', authenticateToken, requireRole('ADMIN', 'SUPERVISOR'), QuickReplyController.update);
router.delete('/:id', authenticateToken, requireRole('ADMIN', 'SUPERVISOR'), QuickReplyController.remove);

module.exports = router;
