const prisma = require('../db/prisma');

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
          webhookVerifyToken: true,
          appSecret: true,
          plan: true,
          createdAt: true,
          updatedAt: true,
          accessToken: true,
        },
      });

      if (!tenant) {
        return res.status(404).json({ success: false, error: 'Tenant not found' });
      }

      // Mask access token for security (e.g. EAAG...xxxx)
      const maskedToken = tenant.accessToken
        ? `${tenant.accessToken.slice(0, 8)}...${tenant.accessToken.slice(-6)}`
        : null;

      return res.json({
        success: true,
        settings: {
          ...tenant,
          accessToken: maskedToken,
          isConfigured: Boolean(tenant.phoneNumberId && tenant.wabaId && tenant.accessToken),
          webhookUrl: `${req.protocol}://${req.get('host')}/webhook`,
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

      const updateData = {};
      if (name) updateData.name = name;
      if (wabaId !== undefined) updateData.wabaId = wabaId;
      if (phoneNumberId !== undefined) updateData.phoneNumberId = phoneNumberId;
      if (webhookVerifyToken !== undefined) updateData.webhookVerifyToken = webhookVerifyToken;
      if (appSecret !== undefined) updateData.appSecret = appSecret;
      if (displayPhoneNumber !== undefined) updateData.displayPhoneNumber = displayPhoneNumber;

      // Only update access token if a new, unmasked token string was submitted
      if (accessToken && !accessToken.includes('...')) {
        updateData.accessToken = accessToken.trim();
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
