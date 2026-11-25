'use strict';

const CommerceService = require('../services/commerceService');
const MetaApiService = require('../services/metaApiService');
const { broadcastNewMessage } = require('../services/socketService');
const { canAccessChat } = require('../middleware/authMiddleware');

class CommerceController {
  static async listProducts(req, res) {
    try {
      const tenantId = req.tenantId;
      const [products, settings] = await Promise.all([
        CommerceService.getProducts(tenantId, req.db),
        CommerceService.getSettings(tenantId, req.db),
      ]);
      return res.json({ success: true, products, settings });
    } catch (err) {
      console.error('[CommerceController.listProducts]:', err);
      return res.status(err.statusCode || 500).json({
        success: false,
        error: err.statusCode ? err.message : 'Failed to fetch catalog products',
      });
    }
  }

  static async saveProduct(req, res) {
    try {
      const product = await CommerceService.saveProduct(req.tenantId, req.body, req.db);
      return res.status(201).json({ success: true, product });
    } catch (err) {
      console.error('[CommerceController.saveProduct]:', err);
      return res.status(err.statusCode || 500).json({
        success: false,
        error: err.statusCode ? err.message : 'Failed to save product',
      });
    }
  }

  static async deleteProduct(req, res) {
    try {
      const removed = await CommerceService.deleteProduct(req.tenantId, req.params.id, req.db);
      if (!removed) {
        return res.status(404).json({ success: false, error: 'Product not found' });
      }
      return res.json({ success: true, message: 'Product removed' });
    } catch (err) {
      console.error('[CommerceController.deleteProduct]:', err);
      return res.status(err.statusCode || 500).json({
        success: false,
        error: err.statusCode ? err.message : 'Failed to delete product',
      });
    }
  }

  static async getSettings(req, res) {
    try {
      const settings = await CommerceService.getSettings(req.tenantId, req.db);
      return res.json({ success: true, settings });
    } catch (err) {
      return res.status(err.statusCode || 500).json({
        success: false,
        error: err.statusCode ? err.message : 'Failed to get payment settings',
      });
    }
  }

  static async updateSettings(req, res) {
    try {
      const settings = await CommerceService.updateSettings(req.tenantId, req.body, req.db);
      return res.json({ success: true, settings });
    } catch (err) {
      return res.status(err.statusCode || 500).json({
        success: false,
        error: err.statusCode ? err.message : 'Failed to update payment settings',
      });
    }
  }

  static async generatePaymentLink(req, res) {
    try {
      const parsedAmount = Number(req.body?.amount);
      if (!Number.isFinite(parsedAmount) || parsedAmount <= 0 || parsedAmount > 10_000_000) {
        return res.status(400).json({ success: false, error: 'Valid payment amount is required' });
      }
      const orderId =
        typeof req.body?.orderId === 'string' && req.body.orderId.trim()
          ? req.body.orderId.trim().slice(0, 40)
          : `ORD-${Date.now().toString().slice(-6)}`;
      const note =
        typeof req.body?.note === 'string' && req.body.note.trim()
          ? req.body.note.trim().slice(0, 200)
          : `Order ${orderId}`;

      const settings = await CommerceService.getSettings(req.tenantId, req.db);
      const upiLink = CommerceService.generateUpiLink({
        vpa: settings.upiId || 'merchant@upi',
        merchantName: settings.merchantName || 'WhatsApp Store',
        amount: parsedAmount,
        orderId,
        note,
      });

      return res.json({
        success: true,
        orderId,
        amount: parsedAmount,
        currency: settings.currency || 'INR',
        upiLink,
        vpa: settings.upiId || 'merchant@upi',
        merchantName: settings.merchantName || 'WhatsApp Store',
      });
    } catch (err) {
      return res.status(500).json({ success: false, error: 'Failed to generate payment link' });
    }
  }

  /**
   * Send a rich WhatsApp Product Card directly to the customer in the active chat
   */
  static async sendProductToChat(req, res) {
    try {
      const { chatId } = req.params;
      const productId = typeof req.body?.productId === 'string' ? req.body.productId.trim() : '';
      const customNote =
        typeof req.body?.customNote === 'string' ? req.body.customNote.trim().slice(0, 500) : '';
      const tenantId = req.tenantId;
      const agentId = req.agent.id;

      if (!productId) {
        return res.status(400).json({ success: false, error: 'productId is required' });
      }

      const chat = await req.db((db) =>
        db.chat.findUnique({
          where: { id: chatId },
          include: { contact: true, tenant: true },
        })
      );

      if (!chat || chat.tenantId !== tenantId) {
        return res.status(404).json({ success: false, error: 'Chat not found' });
      }
      if (!canAccessChat(req.agent, chat)) {
        return res.status(403).json({ success: false, error: 'You do not have access to this conversation' });
      }

      const products = await CommerceService.getProducts(tenantId, req.db);
      const product = products.find((p) => p.id === productId);
      if (!product) {
        return res.status(404).json({ success: false, error: 'Product not found in catalog' });
      }

      const settings = await CommerceService.getSettings(tenantId, req.db);
      const upiLink = CommerceService.generateUpiLink({
        vpa: settings.upiId || 'merchant@upi',
        merchantName: settings.merchantName || 'WhatsApp Store',
        amount: product.price,
        orderId: `TB-${product.sku || product.id}`,
        note: `Buy ${product.title}`,
      });

      const bodyText = `🛍️ *${product.title}*\n\n${product.description || ''}\n\n🏷️ *Price:* ₹${Number(product.price).toLocaleString('en-IN')}\n${customNote ? `\n💬 *Note from team:* ${customNote}` : ''}`;

      const buttons = [
        { id: `btn_pay_${product.id}`, title: `💳 Pay ₹${product.price}`.slice(0, 20) },
        { id: `btn_order_${product.id}`, title: '📦 Order Now' },
        { id: 'btn_agent', title: '💬 Talk to Human' },
      ];

      const apiResult = await MetaApiService.sendInteractiveButtons(
        chat.tenant,
        chat.contact.waId,
        bodyText,
        buttons
      );

      const rawPayload = JSON.stringify({
        commerce: {
          type: 'PRODUCT',
          productId: product.id,
          title: product.title,
          description: product.description || '',
          price: product.price,
          currency: product.currency || 'INR',
          imageUrl: product.imageUrl || null,
          sku: product.sku,
          paymentLink: upiLink,
        },
        buttons,
      });

      const now = new Date();
      const message = await req.db((db) =>
        db.message.create({
          data: {
            chatId: chat.id,
            tenantId,
            senderType: 'AGENT',
            senderId: agentId,
            messageType: 'INTERACTIVE',
            content: bodyText,
            mediaUrl: product.imageUrl || null,
            rawPayload,
            direction: 'OUTBOUND',
            status: apiResult.success ? 'SENT' : 'FAILED',
            errorCode: apiResult.success ? null : String(apiResult.code || 'SEND_FAILED'),
            errorMessage: apiResult.success ? null : String(apiResult.error || 'Product send failed'),
            waMessageId: apiResult.wamid || null,
            createdAt: now,
          },
          include: {
            senderAgent: { select: { id: true, name: true, avatarUrl: true } },
          },
        })
      );

      await req.db((db) =>
        db.chat.update({
          where: { id: chat.id },
          data: {
            lastMessagePreview: `🛍️ Product: ${product.title} (₹${product.price})`,
            lastMessageAt: now,
            status: chat.status === 'UNASSIGNED' ? 'OPEN' : chat.status,
            assignedAgentId: chat.assignedAgentId || agentId,
          },
        })
      );

      broadcastNewMessage(tenantId, chat.id, message, chat.assignedAgentId || agentId);
      return res.status(apiResult.success ? 201 : 502).json({
        success: apiResult.success,
        message,
        ...(apiResult.success ? {} : { error: apiResult.error || 'Failed to deliver product message' }),
      });
    } catch (err) {
      console.error('[CommerceController.sendProductToChat]:', err);
      return res.status(500).json({ success: false, error: 'Failed to dispatch product message' });
    }
  }

  /**
   * Send an instant WhatsApp UPI Payment Request bubble directly to the customer
   */
  static async sendPaymentRequest(req, res) {
    try {
      const { chatId } = req.params;
      const parsedAmount = Number(req.body?.amount);
      const orderId =
        typeof req.body?.orderId === 'string' && req.body.orderId.trim()
          ? req.body.orderId.trim().slice(0, 40)
          : `TB-${Date.now().toString().slice(-6)}`;
      const note =
        typeof req.body?.note === 'string' && req.body.note.trim()
          ? req.body.note.trim().slice(0, 200)
          : '';
      const tenantId = req.tenantId;
      const agentId = req.agent.id;

      if (!Number.isFinite(parsedAmount) || parsedAmount <= 0 || parsedAmount > 10_000_000) {
        return res.status(400).json({ success: false, error: 'Valid payment amount is required' });
      }

      const chat = await req.db((db) =>
        db.chat.findUnique({
          where: { id: chatId },
          include: { contact: true, tenant: true },
        })
      );

      if (!chat || chat.tenantId !== tenantId) {
        return res.status(404).json({ success: false, error: 'Chat not found' });
      }
      if (!canAccessChat(req.agent, chat)) {
        return res.status(403).json({ success: false, error: 'You do not have access to this conversation' });
      }

      const settings = await CommerceService.getSettings(tenantId, req.db);
      const upiLink = CommerceService.generateUpiLink({
        vpa: settings.upiId || 'merchant@upi',
        merchantName: settings.merchantName || 'WhatsApp Store',
        amount: parsedAmount,
        orderId,
        note: note || `Order ${orderId}`,
      });

      const bodyText = `💳 *Payment Request: ₹${parsedAmount.toLocaleString('en-IN')}*\n\n🔖 *Ref:* ${orderId}\n📝 *Description:* ${note || 'Instant Order Payment'}\n🏛️ *Payee VPA:* \`${settings.upiId || 'merchant@upi'}\`\n\nTap below to pay directly using GPay, PhonePe, Paytm or any UPI app.`;

      const buttons = [
        { id: `btn_pay_upi_${orderId}`, title: `⚡ Pay ₹${parsedAmount}`.slice(0, 20) },
        { id: 'btn_pay_confirm', title: '✅ I Have Paid' },
        { id: 'btn_agent', title: '💬 Need Help' },
      ];

      const apiResult = await MetaApiService.sendInteractiveButtons(
        chat.tenant,
        chat.contact.waId,
        bodyText,
        buttons
      );

      const rawPayload = JSON.stringify({
        commerce: {
          type: 'PAYMENT_REQUEST',
          orderId,
          amount: parsedAmount,
          currency: settings.currency || 'INR',
          note: note || 'Instant Order Payment',
          vpa: settings.upiId || 'merchant@upi',
          merchantName: settings.merchantName || 'WhatsApp Store',
          paymentLink: upiLink,
        },
        buttons,
      });

      const now = new Date();
      const message = await req.db((db) =>
        db.message.create({
          data: {
            chatId: chat.id,
            tenantId,
            senderType: 'AGENT',
            senderId: agentId,
            messageType: 'INTERACTIVE',
            content: bodyText,
            rawPayload,
            direction: 'OUTBOUND',
            status: apiResult.success ? 'SENT' : 'FAILED',
            errorCode: apiResult.success ? null : String(apiResult.code || 'SEND_FAILED'),
            errorMessage: apiResult.success ? null : String(apiResult.error || 'Payment request send failed'),
            waMessageId: apiResult.wamid || null,
            createdAt: now,
          },
          include: {
            senderAgent: { select: { id: true, name: true, avatarUrl: true } },
          },
        })
      );

      await req.db((db) =>
        db.chat.update({
          where: { id: chat.id },
          data: {
            lastMessagePreview: `💳 Payment Request: ₹${parsedAmount.toLocaleString('en-IN')}`,
            lastMessageAt: now,
            status: chat.status === 'UNASSIGNED' ? 'OPEN' : chat.status,
            assignedAgentId: chat.assignedAgentId || agentId,
          },
        })
      );

      broadcastNewMessage(tenantId, chat.id, message, chat.assignedAgentId || agentId);
      return res.status(apiResult.success ? 201 : 502).json({
        success: apiResult.success,
        message,
        upiLink,
        ...(apiResult.success ? {} : { error: apiResult.error || 'Failed to send payment request' }),
      });
    } catch (err) {
      console.error('[CommerceController.sendPaymentRequest]:', err);
      return res.status(500).json({ success: false, error: 'Failed to send payment request' });
    }
  }
}

module.exports = CommerceController;
