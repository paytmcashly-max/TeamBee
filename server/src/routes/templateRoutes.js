const express = require('express');
const router = express.Router();
const TemplateController = require('../controllers/templateController');
const { authenticateToken, requireRole } = require('../middleware/authMiddleware');

router.get('/', authenticateToken, TemplateController.listTemplates);
router.post('/sync', authenticateToken, requireRole('ADMIN'), TemplateController.syncTemplates);
router.post('/send', authenticateToken, TemplateController.sendTemplate);

// Broadcasts
router.get('/broadcasts', authenticateToken, TemplateController.listBroadcasts);
router.post('/broadcasts', authenticateToken, requireRole('ADMIN', 'SUPERVISOR'), TemplateController.createBroadcast);

module.exports = router;
