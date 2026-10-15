const axios = require('axios');
const { v4: uuidv4 } = require('uuid');

const META_GRAPH_URL = 'https://graph.facebook.com';
const API_VERSION = process.env.META_API_VERSION || 'v20.0';

function isLiveMetaToken(token) {
  if (!token) return false;
  if (token === 'MOCK_TOKEN') return false;
  if (token.startsWith('EAAG_PERMANENT_META_SYSTEM_USER_TOKEN')) return false;
  return token.length > 30;
}

class MetaApiService {
  /**
   * Send outbound text message via Meta Cloud API
   */
  static async sendTextMessage(tenant, toPhoneNumber, text) {
    const cleanPhone = toPhoneNumber.replace(/\D/g, '');

    // If live credentials configured, dispatch real Meta Graph API call
    if (tenant.phoneNumberId && isLiveMetaToken(tenant.accessToken)) {
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
              Authorization: `Bearer ${tenant.accessToken}`,
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

    if (tenant.phoneNumberId && isLiveMetaToken(tenant.accessToken)) {
      try {
        const url = `${META_GRAPH_URL}/${API_VERSION}/${tenant.phoneNumberId}/messages`;
        const mediaPayload = {
          link: mediaUrl,
        };
        if (caption) mediaPayload.caption = caption;
        if (filename && type === 'document') mediaPayload.filename = filename;

        const response = await axios.post(
          url,
          {
            messaging_product: 'whatsapp',
            recipient_type: 'individual',
            to: cleanPhone,
            type: type.toLowerCase(),
            [type.toLowerCase()]: mediaPayload,
          },
          {
            headers: {
              Authorization: `Bearer ${tenant.accessToken}`,
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

    if (tenant.phoneNumberId && isLiveMetaToken(tenant.accessToken)) {
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
              Authorization: `Bearer ${tenant.accessToken}`,
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
    if (!tenant.wabaId || !tenant.accessToken || tenant.accessToken === 'MOCK_TOKEN') {
      return { success: false, reason: 'WABA ID or Access Token not configured' };
    }

    try {
      const url = `${META_GRAPH_URL}/${API_VERSION}/${tenant.wabaId}/message_templates`;
      const response = await axios.get(url, {
        headers: { Authorization: `Bearer ${tenant.accessToken}` },
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
}

module.exports = MetaApiService;
