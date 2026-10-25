const axios = require('axios');
const { v4: uuidv4 } = require('uuid');
const { decryptSecret } = require('./credentialCrypto');

const META_GRAPH_URL = 'https://graph.facebook.com';
const API_VERSION = process.env.META_API_VERSION || 'v20.0';

function isLiveConfig(tenant) {
  const accessToken = resolveAccessToken(tenant);
  if (!tenant || !accessToken || !tenant.phoneNumberId) return false;
  if (accessToken === 'MOCK_TOKEN' || accessToken.startsWith('EAAG_PERMANENT_META_SYSTEM_USER_TOKEN')) return false;
  if (tenant.phoneNumberId.startsWith('PHONE_ID_')) return false;
  return accessToken.length > 30;
}

function hasLiveAccessToken(tenant) {
  const accessToken = decryptSecret(tenant?.accessToken);
  return Boolean(
    accessToken &&
      accessToken !== 'MOCK_TOKEN' &&
      !accessToken.startsWith('EAAG_PERMANENT_META_SYSTEM_USER_TOKEN') &&
      accessToken.length > 30
  );
}

function resolveAccessToken(tenant) {
  if (hasLiveAccessToken(tenant)) return decryptSecret(tenant.accessToken);
  // Deployment-wide fallback: a valid system-user token configured in the
  // environment must not be shadowed by a stale or placeholder tenant token.
  const envToken = process.env.META_ACCESS_TOKEN;
  if (envToken && envToken !== 'MOCK_TOKEN' && !envToken.startsWith('EAAG_PERMANENT_META_SYSTEM_USER_TOKEN') && envToken.length > 30) {
    return envToken;
  }
  return decryptSecret(tenant?.accessToken);
}

function mockAllowed() {
  return process.env.NODE_ENV !== 'production'
    && process.env.META_ALLOW_MOCK !== 'false'
    && process.env.META_MODE !== 'live';
}

function missingLiveConfigError() {
  return {
    success: false,
    error: 'Meta Cloud API credentials are not configured for live delivery',
    code: 'META_NOT_CONFIGURED',
  };
}

class MetaApiService {
  /**
   * Send outbound text message via Meta Cloud API
   */
  static async sendTextMessage(tenant, toPhoneNumber, text) {
    const cleanPhone = toPhoneNumber.replace(/\D/g, '');
    if (!/^\d{3,32}$/.test(cleanPhone) || typeof text !== 'string' || !text.trim()) {
      return { success: false, error: 'Invalid WhatsApp text message', code: 'INVALID_MESSAGE' };
    }

    // If live credentials configured, dispatch real Meta Graph API call
    if (isLiveConfig(tenant)) {
      const accessToken = resolveAccessToken(tenant);
      try {
        const url = `${META_GRAPH_URL}/${API_VERSION}/${tenant.phoneNumberId}/messages`;
        const response = await axios.post(
          url,
          {
            messaging_product: 'whatsapp',
            recipient_type: 'individual',
            to: cleanPhone,
            type: 'text',
            text: { preview_url: false, body: text },
          },
          {
            headers: {
              Authorization: `Bearer ${accessToken}`,
              'Content-Type': 'application/json',
            },
            timeout: 10000,
          }
        );

        const wamid = response.data?.messages?.[0]?.id || `wamid.HBgL${uuidv4().replace(/-/g, '')}`;
        return { success: true, wamid, data: response.data };
      } catch (err) {
        console.error('[Meta API Outbound Error]:', err.response?.data || err.message);
        const errorData = err.response?.data?.error || {};
        return {
          success: false,
          error: errorData.message || err.message,
          code: errorData.code || 'HTTP_ERROR',
        };
      }
    }

    if (!mockAllowed()) return missingLiveConfigError();

    // Sandbox / Simulation fallback: generates valid Meta-format WAMID
    const mockWamid = `wamid.HBgL${uuidv4().replace(/-/g, '').slice(0, 24)}MOCK`;
    console.log(`[Meta API Sandbox]: Sent mock outbound message to +${cleanPhone} -> WAMID: ${mockWamid}`);
    return {
      success: true,
      wamid: mockWamid,
      isMock: true,
    };
  }

  /**
   * Send outbound media message (image, video, document, audio)
   */
  static async sendMediaMessage(tenant, toPhoneNumber, { type, mediaUrl, caption, filename }) {
    const cleanPhone = toPhoneNumber.replace(/\D/g, '');
    const normalizedType = String(type || '').toLowerCase();
    if (!/^\d{3,32}$/.test(cleanPhone) || !['image', 'video', 'audio', 'document'].includes(normalizedType) || !/^https:\/\//i.test(mediaUrl || '')) {
      return { success: false, error: 'Invalid WhatsApp media message', code: 'INVALID_MESSAGE' };
    }

    if (isLiveConfig(tenant)) {
      const accessToken = resolveAccessToken(tenant);
      try {
        const url = `${META_GRAPH_URL}/${API_VERSION}/${tenant.phoneNumberId}/messages`;
        const mediaPayload = {
          link: mediaUrl,
        };
        if (caption) mediaPayload.caption = caption;
        if (filename && normalizedType === 'document') mediaPayload.filename = filename;

        const response = await axios.post(
          url,
          {
            messaging_product: 'whatsapp',
            recipient_type: 'individual',
            to: cleanPhone,
            type: normalizedType,
            [normalizedType]: mediaPayload,
          },
          {
            headers: {
              Authorization: `Bearer ${accessToken}`,
              'Content-Type': 'application/json',
            },
            timeout: 15000,
          }
        );

        const wamid = response.data?.messages?.[0]?.id || `wamid.HBgL${uuidv4().replace(/-/g, '')}`;
        return { success: true, wamid, data: response.data };
      } catch (err) {
        console.error('[Meta API Media Outbound Error]:', err.response?.data || err.message);
        return {
          success: false,
          error: err.response?.data?.error?.message || err.message,
        };
      }
    }

    if (!mockAllowed()) return missingLiveConfigError();
    const mockWamid = `wamid.HBgL${uuidv4().replace(/-/g, '').slice(0, 24)}MEDIA_MOCK`;
    return {
      success: true,
      wamid: mockWamid,
      isMock: true,
    };
  }

  /**
   * Send WhatsApp Template Message (for initiating outbound conversations outside 24-hr window)
   */
  static async sendTemplateMessage(tenant, toPhoneNumber, templateName, languageCode = 'en', components = []) {
    const cleanPhone = toPhoneNumber.replace(/\D/g, '');
    if (!/^\d{3,32}$/.test(cleanPhone) || typeof templateName !== 'string' || !/^[a-z0-9_]{1,512}$/i.test(templateName)) {
      return { success: false, error: 'Invalid WhatsApp template message', code: 'INVALID_MESSAGE' };
    }

    if (isLiveConfig(tenant)) {
      const accessToken = resolveAccessToken(tenant);
      try {
        const url = `${META_GRAPH_URL}/${API_VERSION}/${tenant.phoneNumberId}/messages`;
        const response = await axios.post(
          url,
          {
            messaging_product: 'whatsapp',
            recipient_type: 'individual',
            to: cleanPhone,
            type: 'template',
            template: {
              name: templateName,
              language: { code: languageCode },
              components: components.length > 0 ? components : undefined,
            },
          },
          {
            headers: {
              Authorization: `Bearer ${accessToken}`,
              'Content-Type': 'application/json',
            },
            timeout: 10000,
          }
        );

        const wamid = response.data?.messages?.[0]?.id || `wamid.HBgL${uuidv4().replace(/-/g, '')}`;
        return { success: true, wamid, data: response.data };
      } catch (err) {
        console.error('[Meta API Template Error]:', err.response?.data || err.message);
        return {
          success: false,
          error: err.response?.data?.error?.message || err.message,
        };
      }
    }

    if (!mockAllowed()) return missingLiveConfigError();
    const mockWamid = `wamid.HBgL${uuidv4().replace(/-/g, '').slice(0, 24)}TPL_MOCK`;
    return {
      success: true,
      wamid: mockWamid,
      isMock: true,
    };
  }

  /**
   * Pull approved message templates from Meta Cloud API
   */
  static async fetchMetaTemplates(tenant) {
    const accessToken = resolveAccessToken(tenant);
    if (!tenant?.wabaId || !accessToken) {
      return { success: false, reason: 'WABA ID or Access Token not configured' };
    }

    try {
      const url = `${META_GRAPH_URL}/${API_VERSION}/${tenant.wabaId}/message_templates`;
      const response = await axios.get(url, {
        headers: { Authorization: `Bearer ${accessToken}` },
        params: { limit: 100 },
        timeout: 10000,
      });

      return {
        success: true,
        templates: response.data?.data || [],
      };
    } catch (err) {
      console.error('[Meta API Fetch Templates Error]:', err.response?.data || err.message);
      return {
        success: false,
        error: err.response?.data?.error?.message || err.message,
      };
    }
  }

  /**
   * Create a message template on Meta for review. Approval is Meta's
   * decision — a successful call returns the template with status
   * PENDING (or APPROVED when Meta auto-approves).
   */
  static async createMetaTemplate(tenant, { name, language, category, components }) {
    const accessToken = resolveAccessToken(tenant);
    if (!tenant?.wabaId || !accessToken) {
      return { success: false, reason: 'WABA ID or Access Token not configured' };
    }

    try {
      const url = `${META_GRAPH_URL}/${API_VERSION}/${tenant.wabaId}/message_templates`;
      const response = await axios.post(
        url,
        { name, language, category, components },
        {
          headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
          timeout: 15000,
        }
      );

      return { success: true, template: response.data };
    } catch (err) {
      const metaErr = err.response?.data?.error;
      console.error('[Meta API Create Template Error]:', err.response?.data || err.message);
      return {
        success: false,
        error: metaErr?.error_user_msg || metaErr?.message || err.message,
        code: metaErr?.code,
      };
    }
  }

  /**
   * Send WhatsApp Interactive Button Message (Quick Action Buttons)
   */
  static async sendInteractiveButtons(tenant, toPhoneNumber, bodyText, buttons = []) {
    const cleanPhone = toPhoneNumber.replace(/\D/g, '');
    if (!/^\d{3,32}$/.test(cleanPhone) || typeof bodyText !== 'string' || !bodyText.trim() || !Array.isArray(buttons) || buttons.length < 1) {
      return { success: false, error: 'Invalid WhatsApp interactive message', code: 'INVALID_MESSAGE' };
    }

    if (isLiveConfig(tenant)) {
      const accessToken = resolveAccessToken(tenant);
      try {
        const url = `${META_GRAPH_URL}/${API_VERSION}/${tenant.phoneNumberId}/messages`;
        const response = await axios.post(
          url,
          {
            messaging_product: 'whatsapp',
            recipient_type: 'individual',
            to: cleanPhone,
            type: 'interactive',
            interactive: {
              type: 'button',
              body: { text: bodyText },
              action: {
                buttons: buttons.slice(0, 3).map((b, i) => ({
                  type: 'reply',
                  reply: {
                    id: b.id || `btn_${i + 1}`,
                    title: (b.title || b.text || `Option ${i + 1}`).slice(0, 20),
                  },
                })),
              },
            },
          },
          {
            headers: {
              Authorization: `Bearer ${accessToken}`,
              'Content-Type': 'application/json',
            },
            timeout: 10000,
          }
        );

        const wamid = response.data?.messages?.[0]?.id || `wamid.HBgL${uuidv4().replace(/-/g, '')}`;
        return { success: true, wamid, data: response.data };
      } catch (err) {
        console.error('[Meta API Interactive Error]:', err.response?.data || err.message);
        return {
          success: false,
          error: err.response?.data?.error?.message || err.message,
        };
      }
    }

    if (!mockAllowed()) return missingLiveConfigError();
    const mockWamid = `wamid.HBgL${uuidv4().replace(/-/g, '').slice(0, 24)}BTN_MOCK`;
    return {
      success: true,
      wamid: mockWamid,
      isMock: true,
    };
  }
}

module.exports = MetaApiService;
