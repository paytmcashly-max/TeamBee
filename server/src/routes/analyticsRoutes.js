const express = require('express');
const router = express.Router();
const AnalyticsController = require('../controllers/analyticsController');
const { authenticateToken, requireRole } = require('../middleware/authMiddleware');

router.get('/overview', authenticateToken, requireRole('ADMIN', 'SUPERVISOR'), AnalyticsController.overview);

module.exports = router;
