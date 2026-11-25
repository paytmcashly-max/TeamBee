'use strict';

const { v4: uuidv4 } = require('uuid');
const prisma = require('../db/prisma');
const { withTenantDb, rlsContextEnabled } = require('../db/withTenant');

const DEFAULT_WELCOME_MESSAGE = '👋 Welcome to our WhatsApp Business Hub! How can our team assist you today?';
const DEFAULT_HANDOFF_KEYWORDS = ['agent', 'human', 'support', 'help', 'representative', 'executive', 'talk to human'];
const DEFAULT_CATALOG_KEYWORDS = ['catalog', 'products', 'shop', 'pricing', 'price list', 'items', 'menu', 'services'];
const DEFAULT_PAYMENT_KEYWORDS = ['pay', 'payment', 'upi', 'googlepay', 'phonepe', 'paytm', 'qr code'];
const DEFAULT_CUSTOM_RULES = [
  {
    id: 'rule_hours',
    trigger: 'timings',
    matchType: 'contains',
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
];

function safeJsonArray(raw, fallback) {
  if (Array.isArray(raw)) return raw;
  if (typeof raw !== 'string' || !raw) return fallback;
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : fallback;
  } catch {
    return fallback;
  }
}

function cleanKeywordList(list, fieldName) {
  if (!Array.isArray(list) || list.length > 50) {
    const err = new Error(`${fieldName} must be an array of at most 50 keywords`);
    err.statusCode = 400;
    throw err;
  }
  return list
    .map((kw) => (typeof kw === 'string' ? kw.trim().slice(0, 60) : ''))
    .filter(Boolean);
}

function cleanCustomRules(rules) {
  if (!Array.isArray(rules) || rules.length > 50) {
    const err = new Error('customRules must be an array of at most 50 items');
    err.statusCode = 400;
    throw err;
  }
  return rules
    .map((rule) => {
      if (!rule || typeof rule !== 'object') return null;
      const trigger = typeof rule.trigger === 'string' ? rule.trigger.trim().slice(0, 100) : '';
      const response = typeof rule.response === 'string' ? rule.response.trim().slice(0, 1000) : '';
      if (!trigger || !response) return null;
      const matchType = rule.matchType === 'exact' ? 'exact' : 'contains';
      const buttons = Array.isArray(rule.buttons)
        ? rule.buttons.map((b) => String(b || '').trim().slice(0, 20)).filter(Boolean).slice(0, 3)
        : [];
      return {
        id: typeof rule.id === 'string' && rule.id.trim() ? rule.id.trim().slice(0, 64) : `rule_${uuidv4().slice(0, 8)}`,
        trigger,
        matchType,
        response,
        buttons,
      };
    })
    .filter(Boolean);
}

function getDefaultAutomationConfig(tenantId) {
  return {
    tenantId,
    botEnabled: true,
    autoAssignEnabled: true,
    welcomeMessage: DEFAULT_WELCOME_MESSAGE,
    agentHandoffKeywords: [...DEFAULT_HANDOFF_KEYWORDS],
    catalogKeywords: [...DEFAULT_CATALOG_KEYWORDS],
    paymentKeywords: [...DEFAULT_PAYMENT_KEYWORDS],
    customRules: DEFAULT_CUSTOM_RULES.map((r) => ({ ...r, buttons: [...r.buttons] })),
    updatedAt: null,
  };
}

function shapeConfigRow(row) {
  return {
    tenantId: row.tenantId,
    botEnabled: Boolean(row.botEnabled),
    autoAssignEnabled: Boolean(row.autoAssignEnabled),
    welcomeMessage: row.welcomeMessage || DEFAULT_WELCOME_MESSAGE,
    agentHandoffKeywords: safeJsonArray(row.agentHandoffKeywords, DEFAULT_HANDOFF_KEYWORDS),
    catalogKeywords: safeJsonArray(row.catalogKeywords, DEFAULT_CATALOG_KEYWORDS),
    paymentKeywords: safeJsonArray(row.paymentKeywords, DEFAULT_PAYMENT_KEYWORDS),
    customRules: safeJsonArray(row.customRules, DEFAULT_CUSTOM_RULES),
    updatedAt: row.updatedAt,
  };
}

function runScoped(tenantId, dbAccessor, fn) {
  if (typeof dbAccessor === 'function') return dbAccessor(fn);
  return rlsContextEnabled() ? withTenantDb(tenantId, fn) : fn(prisma);
}

class AutomationRulesService {
  static async getConfig(tenantId, dbAccessor = null) {
    const row = await runScoped(tenantId, dbAccessor, (db) =>
      db.automationConfig.findUnique({ where: { tenantId } })
    );
    return row ? shapeConfigRow(row) : getDefaultAutomationConfig(tenantId);
  }

  static async updateConfig(tenantId, newConfig = {}, dbAccessor = null) {
    if (!newConfig || typeof newConfig !== 'object' || Array.isArray(newConfig)) {
      const err = new Error('Configuration payload must be a JSON object');
      err.statusCode = 400;
      throw err;
    }
    const current = await this.getConfig(tenantId, dbAccessor);

    let botEnabled = current.botEnabled;
    if (newConfig.botEnabled !== undefined) {
      if (typeof newConfig.botEnabled !== 'boolean') {
        const err = new Error('botEnabled must be a boolean');
        err.statusCode = 400;
        throw err;
      }
      botEnabled = newConfig.botEnabled;
    }

    let autoAssignEnabled = current.autoAssignEnabled;
    if (newConfig.autoAssignEnabled !== undefined) {
      if (typeof newConfig.autoAssignEnabled !== 'boolean') {
        const err = new Error('autoAssignEnabled must be a boolean');
        err.statusCode = 400;
        throw err;
      }
      autoAssignEnabled = newConfig.autoAssignEnabled;
    }

    let welcomeMessage = current.welcomeMessage;
    if (newConfig.welcomeMessage !== undefined) {
      if (typeof newConfig.welcomeMessage !== 'string') {
        const err = new Error('welcomeMessage must be a string');
        err.statusCode = 400;
        throw err;
      }
      welcomeMessage = newConfig.welcomeMessage.trim().slice(0, 1000) || DEFAULT_WELCOME_MESSAGE;
    }

    const agentHandoffKeywords =
      newConfig.agentHandoffKeywords !== undefined
        ? cleanKeywordList(newConfig.agentHandoffKeywords, 'agentHandoffKeywords')
        : current.agentHandoffKeywords;
    const catalogKeywords =
      newConfig.catalogKeywords !== undefined
        ? cleanKeywordList(newConfig.catalogKeywords, 'catalogKeywords')
        : current.catalogKeywords;
    const paymentKeywords =
      newConfig.paymentKeywords !== undefined
        ? cleanKeywordList(newConfig.paymentKeywords, 'paymentKeywords')
        : current.paymentKeywords;
    const customRules =
      newConfig.customRules !== undefined
        ? cleanCustomRules(newConfig.customRules)
        : current.customRules;

    const data = {
      botEnabled,
      autoAssignEnabled,
      welcomeMessage,
      agentHandoffKeywords: JSON.stringify(agentHandoffKeywords),
      catalogKeywords: JSON.stringify(catalogKeywords),
      paymentKeywords: JSON.stringify(paymentKeywords),
      customRules: JSON.stringify(customRules),
    };

    const saved = await runScoped(tenantId, dbAccessor, (db) =>
      db.automationConfig.upsert({
        where: { tenantId },
        update: data,
        create: { id: uuidv4(), tenantId, ...data },
      })
    );
    return shapeConfigRow(saved);
  }
}

module.exports = AutomationRulesService;
