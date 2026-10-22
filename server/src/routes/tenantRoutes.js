const express = require('express');
const router = express.Router();
const TenantController = require('../controllers/tenantController');
const { authenticateToken, requireRole } = require('../middleware/authMiddleware');

router.get('/settings', authenticateToken, requireRole('ADMIN', 'SUPERVISOR'), TenantController.getSettings);
router.put('/settings', authenticateToken, requireRole('ADMIN'), TenantController.updateSettings);

module.exports = router;
