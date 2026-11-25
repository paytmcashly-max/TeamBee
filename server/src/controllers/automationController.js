'use strict';

const AutomationRulesService = require('../services/automationRulesService');

class AutomationController {
  static async getConfig(req, res) {
    try {
      const config = await AutomationRulesService.getConfig(req.tenantId, req.db);
      return res.json({ success: true, config });
    } catch (err) {
      console.error('[AutomationController.getConfig]:', err);
      return res.status(err.statusCode || 500).json({
        success: false,
        error: err.statusCode ? err.message : 'Failed to fetch automation config',
      });
    }
  }

  static async updateConfig(req, res) {
    try {
      const updated = await AutomationRulesService.updateConfig(req.tenantId, req.body, req.db);
      return res.json({ success: true, config: updated });
    } catch (err) {
      console.error('[AutomationController.updateConfig]:', err);
      return res.status(err.statusCode || 500).json({
        success: false,
        error: err.statusCode ? err.message : 'Failed to update automation config',
      });
    }
  }
}

module.exports = AutomationController;
