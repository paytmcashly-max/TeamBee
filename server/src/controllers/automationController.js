'use strict';

const AutomationRulesService = require('../services/automationRulesService');

class AutomationController {
  static async getConfig(req, res) {
    try {
      const config = AutomationRulesService.getConfig(req.tenantId);
      return res.json({ success: true, config });
    } catch (err) {
      console.error('[AutomationController.getConfig]:', err);
      return res.status(500).json({ success: false, error: 'Failed to fetch automation config' });
    }
  }

  static async updateConfig(req, res) {
    try {
      const updated = AutomationRulesService.updateConfig(req.tenantId, req.body);
      return res.json({ success: true, config: updated });
    } catch (err) {
      console.error('[AutomationController.updateConfig]:', err);
      return res.status(500).json({ success: false, error: 'Failed to update automation config' });
    }
  }
}

module.exports = AutomationController;
