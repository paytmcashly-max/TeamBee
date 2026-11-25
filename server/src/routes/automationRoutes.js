'use strict';

const express = require('express');
const router = express.Router();
const AutomationController = require('../controllers/automationController');
const { authenticateToken, requireRole } = require('../middleware/authMiddleware');

router.get('/config', authenticateToken, requireRole('ADMIN', 'SUPERVISOR'), AutomationController.getConfig);
router.put('/config', authenticateToken, requireRole('ADMIN', 'SUPERVISOR'), AutomationController.updateConfig);

module.exports = router;
