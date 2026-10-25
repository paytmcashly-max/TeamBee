const express = require('express');
const router = express.Router();
const TemplateController = require('../controllers/templateController');
const BroadcastController = require('../controllers/broadcastController');
const { authenticateToken, requireRole } = require('../middleware/authMiddleware');

router.get('/', authenticateToken, TemplateController.listTemplates);
router.post('/', authenticateToken, requireRole('ADMIN'), TemplateController.createTemplate);
router.post('/sync', authenticateToken, requireRole('ADMIN'), TemplateController.syncTemplates);
router.post('/send', authenticateToken, TemplateController.sendTemplate);

// Backwards-compatible aliases. Broadcast behavior is implemented in one
// controller so the legacy /api/templates/broadcasts path cannot diverge from
// /api/broadcasts.
router.get('/broadcasts', authenticateToken, BroadcastController.listBroadcasts);
router.post('/broadcasts', authenticateToken, requireRole('ADMIN', 'SUPERVISOR'), BroadcastController.createBroadcast);

module.exports = router;
