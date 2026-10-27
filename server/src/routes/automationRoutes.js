'use strict';

const express = require('express');
const router = express.Router();
const AutomationController = require('../controllers/automationController');
const { authenticateToken } = require('../middleware/authMiddleware');

router.get('/config', authenticateToken, AutomationController.getConfig);
router.put('/config', authenticateToken, AutomationController.updateConfig);

module.exports = router;
