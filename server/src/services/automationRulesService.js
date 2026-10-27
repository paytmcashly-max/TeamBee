'use strict';

const fs = require('fs');
const path = require('path');

const AUTOMATION_DATA_DIR = path.join(__dirname, '..', 'data', 'automation');

function ensureDir() {
  if (!fs.existsSync(AUTOMATION_DATA_DIR)) {
    fs.mkdirSync(AUTOMATION_DATA_DIR, { recursive: true });
  }
}

function getStorePath(tenantId) {
  ensureDir();
  const safeId = String(tenantId).replace(/[^a-zA-Z0-9_-]/g, '_');
  return path.join(AUTOMATION_DATA_DIR, `${safeId}.json`);
}

function getDefaultAutomationConfig(tenantId) {
  return {
    tenantId,
    botEnabled: true,
    autoAssignEnabled: true,
    welcomeMessage: '👋 Welcome to our WhatsApp Business Hub! How can our team assist you today?',
    agentHandoffKeywords: ['agent', 'human', 'support', 'help', 'representative', 'executive', 'talk to human'],
    catalogKeywords: ['catalog', 'products', 'shop', 'pricing', 'price list', 'items', 'menu', 'services'],
    paymentKeywords: ['pay', 'payment', 'upi', 'googlepay', 'phonepe', 'paytm', 'qr code'],
    customRules: [
      {
        id: 'rule_hours',
        trigger: 'timings',
        matchType: 'contains', // 'exact' | 'contains'
        response: '⏰ Our customer support is active Monday to Saturday from 9:00 AM to 8:00 PM IST.',
        buttons: ['💬 Leave Message', '🛍️ View Catalog'],
      },
      {
        id: 'rule_location',
        trigger: 'address',
        matchType: 'contains',
        response: '📍 We are headquartered in Bengaluru, India. We ship and provide digital services pan-India.',
        buttons: ['🛍️ View Catalog', '💬 Talk to Human'],
      },
    ],
    updatedAt: new Date().toISOString(),
  };
}

class AutomationRulesService {
  static getConfig(tenantId) {
    try {
      const filePath = getStorePath(tenantId);
      if (fs.existsSync(filePath)) {
        return JSON.parse(fs.readFileSync(filePath, 'utf8'));
      }
    } catch (err) {
      console.error('[AutomationRulesService]: Error reading config:', err.message);
    }

    const defaultConfig = getDefaultAutomationConfig(tenantId);
    try {
      fs.writeFileSync(getStorePath(tenantId), JSON.stringify(defaultConfig, null, 2), 'utf8');
    } catch (saveErr) {
      console.error('[AutomationRulesService]: Error writing config:', saveErr.message);
    }
    return defaultConfig;
  }

  static updateConfig(tenantId, newConfig) {
    ensureDir();
    const current = this.getConfig(tenantId);
    const updated = {
      ...current,
      ...newConfig,
      updatedAt: new Date().toISOString(),
    };
    fs.writeFileSync(getStorePath(tenantId), JSON.stringify(updated, null, 2), 'utf8');
    return updated;
  }
}

module.exports = AutomationRulesService;
