'use strict';

const CommerceService = require('../services/commerceService');
const MetaApiService = require('../services/metaApiService');
const { broadcastNewMessage } = require('../services/socketService');
const { v4: uuidv4 } = require('uuid');

class CommerceController {
  static async listProducts(req, res) {
    try {
      const tenantId = req.tenantId;
      const products = CommerceService.getProducts(tenantId);
      const settings = CommerceService.getSettings(tenantId);
      return res.json({ success: true, products, settings });
    } catch (err) {
      console.error('[CommerceController.listProducts]:', err);
      return res.status(500).json({ success: false, error: 'Failed to fetch catalog products' });
    }
  }

  static async saveProduct(req, res) {
    try {
      const tenantId = req.tenantId;
      const product = CommerceService.saveProduct(tenantId, req.body);
      return res.status(201).json({ success: true, product });
    } catch (err) {
      console.error('[CommerceController.saveProduct]:', err);
      return res.status(500).json({ success: false, error: 'Failed to save product' });
    }
  }

  static async deleteProduct(req, res) {
    try {
      const tenantId = req.tenantId;
      const { id } = req.params;
      CommerceService.deleteProduct(tenantId, id);
      return res.json({ success: true, message: 'Product removed' });
    } catch (err) {
      console.error('[CommerceController.deleteProduct]:', err);
      return res.status(500).json({ success: false, error: 'Failed to delete product' });
    }
  }

  static async getSettings(req, res) {
    try {
      const settings = CommerceService.getSettings(req.tenantId);
      return res.json({ success: true, settings });
    } catch (err) {
      return res.status(500).json({ success: false, error: 'Failed to get payment settings' });
    }
  }

  static async updateSettings(req, res) {
    try {
      const settings = CommerceService.updateSettings(req.tenantId, req.body);
      return res.json({ success: true, settings });
    } catch (err) {
      return res.status(500).json({ success: false, error: 'Failed to update payment settings' });
    }
  }

  static async generatePaymentLink(req, res) {
    try {
      const tenantId = req.tenantId;
      const { amount, note, orderId = `ORD-${Date.now().toString().slice(-6)}` } = req.body;
      const settings = CommerceService.getSettings(tenantId);

      const upiLink = CommerceService.generateUpiLink({
        vpa: settings.upiId || 'merchant@upi',
        merchantName: settings.merchantName || 'WhatsApp Store',
        amount: Number(amount) || 0,
        orderId,
        note: note || `Order ${orderId}`,
      });

      return res.json({
        success: true,
        orderId,
        amount: Number(amount) || 0,
        currency: 'INR',
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
      const { productId, customNote } = req.body;
      const tenantId = req.tenantId;
      const agentId = req.agent.id;

      const chat = await req.db((db) =>
        db.chat.findUnique({
          where: { id: chatId },
          include: { contact: true, tenant: true },
        })
      );

      if (!chat || chat.tenantId !== tenantId) {
        return res.status(404).json({ success: false, error: 'Chat not found' });
      }

      const products = CommerceService.getProducts(tenantId);
      const product = products.find((p) => p.id === productId);
      if (!product) {
        return res.status(404).json({ success: false, error: 'Product not found in catalog' });
      }

      const settings = CommerceService.getSettings(tenantId);
      const upiLink = CommerceService.generateUpiLink({
        vpa: settings.upiId || 'merchant@upi',
        merchantName: settings.merchantName || 'WhatsApp Store',
        amount: product.price,
        orderId: `TB-${product.sku || product.id}`,
        note: `Buy ${product.title}`,
      });

      const bodyText = `🛍️ *${product.title}*\n\n${product.description}\n\n🏷️ *Price:* ₹${product.price.toLocaleString('en-IN')}\n${customNote ? `\n💬 *Note from team:* ${customNote}` : ''}`;

      const buttons = [
        { id: `btn_pay_${product.id}`, title: `💳 Pay ₹${product.price}`.slice(0, 20) },
        { id: `btn_order_${product.id}`, title: '📦 Order Now' },
        { id: 'btn_agent', title: '💬 Talk to Human' },
      ];

      // Dispatch to Meta WhatsApp Cloud API
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
          description: product.description,
          price: product.price,
          currency: 'INR',
          imageUrl: product.imageUrl,
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
          },
        })
      );

      broadcastNewMessage(tenantId, chat.id, message, chat.assignedAgentId || agentId);
      return res.status(201).json({ success: true, message });
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
      const { amount, note, orderId = `TB-${Date.now().toString().slice(-6)}` } = req.body;
      const tenantId = req.tenantId;
      const agentId = req.agent.id;

      if (!amount || Number(amount) <= 0) {
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

      const settings = CommerceService.getSettings(tenantId);
      const upiLink = CommerceService.generateUpiLink({
        vpa: settings.upiId || 'merchant@upi',
        merchantName: settings.merchantName || 'WhatsApp Store',
        amount: Number(amount),
        orderId,
        note: note || `Order ${orderId}`,
      });

      const bodyText = `💳 *Payment Request: ₹${Number(amount).toLocaleString('en-IN')}*\n\n🔖 *Ref:* ${orderId}\n📝 *Description:* ${note || 'Instant Order Payment'}\n🏛️ *Payee VPA:* \`${settings.upiId || 'merchant@upi'}\`\n\nTap below to pay directly using GPay, PhonePe, Paytm or any UPI app.`;

      const buttons = [
        { id: `btn_pay_upi_${orderId}`, title: `⚡ Pay ₹${Number(amount)}`.slice(0, 20) },
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
          amount: Number(amount),
          currency: 'INR',
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
            lastMessagePreview: `💳 Payment Request: ₹${Number(amount).toLocaleString('en-IN')}`,
            lastMessageAt: now,
            status: chat.status === 'UNASSIGNED' ? 'OPEN' : chat.status,
          },
        })
      );

      broadcastNewMessage(tenantId, chat.id, message, chat.assignedAgentId || agentId);
      return res.status(201).json({ success: true, message, upiLink });
    } catch (err) {
      console.error('[CommerceController.sendPaymentRequest]:', err);
      return res.status(500).json({ success: false, error: 'Failed to send payment request' });
    }
  }
}

module.exports = CommerceController;
