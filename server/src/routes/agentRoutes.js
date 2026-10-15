const express = require('express');
const router = express.Router();
const AgentController = require('../controllers/agentController');
const { authenticateToken, requireRole } = require('../middleware/authMiddleware');

router.get('/', authenticateToken, AgentController.listAgents);
router.post('/', authenticateToken, requireRole('ADMIN'), AgentController.createAgent);
router.put('/:id', authenticateToken, AgentController.updateAgent);
router.get('/analytics', authenticateToken, requireRole('ADMIN', 'SUPERVISOR'), AgentController.getAnalytics);

module.exports = router;
