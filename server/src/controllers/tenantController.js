const prisma = require('../db/prisma');
const { encryptSecret, hashSecret } = require('../services/credentialCrypto');

class TenantController {
  /**
   * GET /api/tenant/settings: Fetch current Meta configuration and tenant profile
   */
  static async getSettings(req, res) {
    try {
      const tenant = await prisma.tenant.findUnique({
        where: { id: req.tenantId },
        select: {
          id: true,
          name: true,
          slug: true,
          wabaId: true,
          phoneNumberId: true,
          displayPhoneNumber: true,
          plan: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      if (!tenant) {
        return res.status(404).json({ success: false, error: 'Tenant not found' });
      }

      return res.json({
        success: true,
        settings: {
          ...tenant,
          // Credential values are intentionally never returned to clients.
         isConfigured: Boolean(tenant.phoneNumberId && tenant.wabaId && req.tenant.accessToken),
          // Built from the configured public API base — never from request
        // headers, which a spoofed X-Forwarded-Host could poison.
        webhookUrl: `${(process.env.PUBLIC_API_URL || process.env.RENDER_EXTERNAL_URL || `${req.protocol}://${req.get('host')}`).replace(/\/+$/, '')}/webhook`,
        },
      });
    } catch (error) {
      console.error('[Get Settings Error]:', error);
      return res.status(500).json({ success: false, error: 'Failed to retrieve settings' });
    }
  }

  /**
   * PUT /api/tenant/settings: Update Meta credentials (Admin Only)
   */
  static async updateSettings(req, res) {
    try {
      const {
        name,
        wabaId,
        phoneNumberId,
        accessToken,
        webhookVerifyToken,
        appSecret,
        displayPhoneNumber,
      } = req.body;

      const stringFields = {
        name,
        wabaId,
        phoneNumberId,
        accessToken,
        webhookVerifyToken,
        appSecret,
        displayPhoneNumber,
      };
      for (const [field, value] of Object.entries(stringFields)) {
        if (value !== undefined && typeof value !== 'string') {
          return res.status(400).json({ success: false, error: `${field} must be a string` });
        }
        if (typeof value === 'string' && value.length > 512) {
          return res.status(400).json({ success: false, error: `${field} is too long` });
        }
      }

      const updateData = {};
      if (name?.trim()) updateData.name = name.trim().slice(0, 120);
      if (wabaId !== undefined) updateData.wabaId = wabaId.trim() || null;
      if (phoneNumberId !== undefined) updateData.phoneNumberId = phoneNumberId.trim() || null;
       if (webhookVerifyToken !== undefined) {
         updateData.webhookVerifyToken = null;
         updateData.webhookVerifyTokenHash = webhookVerifyToken.trim() ? hashSecret(webhookVerifyToken.trim()) : null;
       }
       if (appSecret !== undefined) updateData.appSecret = appSecret.trim() ? encryptSecret(appSecret.trim()) : null;
      if (displayPhoneNumber !== undefined) updateData.displayPhoneNumber = displayPhoneNumber.trim() || null;

      // Only update access token if a new, unmasked token string was submitted
      if (accessToken?.trim() && !accessToken.includes('...')) {
         updateData.accessToken = encryptSecret(accessToken.trim());
      }

      const updated = await prisma.tenant.update({
        where: { id: req.tenantId },
        data: updateData,
      });

      return res.json({
        success: true,
        message: 'WhatsApp Business API credentials updated successfully',
        tenant: {
          id: updated.id,
          name: updated.name,
          wabaId: updated.wabaId,
          phoneNumberId: updated.phoneNumberId,
          displayPhoneNumber: updated.displayPhoneNumber,
           isConfigured: Boolean(updated.phoneNumberId && updated.wabaId && updated.accessToken),
        },
      });
    } catch (error) {
      console.error('[Update Settings Error]:', error);
      return res.status(500).json({ success: false, error: 'Failed to update credentials' });
    }
  }
}

module.exports = TenantController;
