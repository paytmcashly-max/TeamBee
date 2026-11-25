'use strict';

const { v4: uuidv4 } = require('uuid');
const prisma = require('../db/prisma');
const { withTenantDb, rlsContextEnabled } = require('../db/withTenant');

const VPA_PATTERN = /^[a-zA-Z0-9._-]{2,}@[a-zA-Z0-9.-]{2,}$/;

function validationError(message, statusCode = 400) {
  const err = new Error(message);
  err.statusCode = statusCode;
  return err;
}

function runScoped(tenantId, dbAccessor, fn) {
  if (typeof dbAccessor === 'function') return dbAccessor(fn);
  return rlsContextEnabled() ? withTenantDb(tenantId, fn) : fn(prisma);
}

function defaultSettings() {
  return {
    upiId: 'teambee@upi',
    merchantName: 'TeamBee WhatsApp Store',
    currency: 'INR',
  };
}

class CommerceService {
  static async getProducts(tenantId, dbAccessor = null) {
    return runScoped(tenantId, dbAccessor, (db) =>
      db.commerceProduct.findMany({
        where: { tenantId },
        orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
        take: 200,
      })
    );
  }

  static async saveProduct(tenantId, productData = {}, dbAccessor = null) {
    if (!productData || typeof productData !== 'object' || Array.isArray(productData)) {
      throw validationError('Invalid product payload');
    }

    const title = typeof productData.title === 'string' ? productData.title.trim().slice(0, 160) : '';
    const price = Number(productData.price);
    if (!title) throw validationError('Product title is required');
    if (!Number.isFinite(price) || price <= 0 || price > 10_000_000) {
      throw validationError('Product price must be a positive number up to 10,000,000');
    }

    const description =
      typeof productData.description === 'string' ? productData.description.trim().slice(0, 500) : '';
    const category =
      typeof productData.category === 'string' && productData.category.trim()
        ? productData.category.trim().slice(0, 80)
        : 'General';
    const currency =
      typeof productData.currency === 'string' && /^[A-Z]{3}$/.test(productData.currency.trim())
        ? productData.currency.trim()
        : 'INR';
    const sku =
      typeof productData.sku === 'string' && productData.sku.trim()
        ? productData.sku.trim().slice(0, 40)
        : `SKU-${Math.floor(1000 + Math.random() * 9000)}`;
    const imageUrl =
      typeof productData.imageUrl === 'string' && /^https:\/\//i.test(productData.imageUrl.trim())
        ? productData.imageUrl.trim().slice(0, 500)
        : null;
    const inStock = productData.inStock !== false;

    if (productData.id !== undefined) {
      if (typeof productData.id !== 'string' || !productData.id.trim()) {
        throw validationError('Invalid product ID');
      }
      return runScoped(tenantId, dbAccessor, async (db) => {
        const existing = await db.commerceProduct.findFirst({
          where: { id: productData.id.trim(), tenantId },
        });
        if (!existing) throw validationError('Product not found', 404);
        return db.commerceProduct.update({
          where: { id: existing.id },
          data: { title, description, price, currency, category, sku, imageUrl, inStock },
        });
      });
    }

    return runScoped(tenantId, dbAccessor, (db) =>
      db.commerceProduct.create({
        data: {
          id: `prod_${uuidv4().replace(/-/g, '').slice(0, 12)}`,
          tenantId,
          title,
          description,
          price,
          currency,
          category,
          sku,
          imageUrl,
          inStock,
        },
      })
    );
  }

  static async deleteProduct(tenantId, productId, dbAccessor = null) {
    if (typeof productId !== 'string' || !productId.trim()) {
      throw validationError('Invalid product ID');
    }
    const res = await runScoped(tenantId, dbAccessor, (db) =>
      db.commerceProduct.deleteMany({
        where: { id: productId.trim(), tenantId },
      })
    );
    return (res?.count || 0) > 0;
  }

  static async getSettings(tenantId, dbAccessor = null) {
    const row = await runScoped(tenantId, dbAccessor, (db) =>
      db.commerceSettings.findUnique({ where: { tenantId } })
    );
    if (!row) return defaultSettings();
    return {
      upiId: row.upiId,
      merchantName: row.merchantName,
      currency: row.currency,
      updatedAt: row.updatedAt,
    };
  }

  static async updateSettings(tenantId, newSettings = {}, dbAccessor = null) {
    if (!newSettings || typeof newSettings !== 'object' || Array.isArray(newSettings)) {
      throw validationError('Invalid commerce settings payload');
    }
    const current = await this.getSettings(tenantId, dbAccessor);

    let upiId = current.upiId;
    if (newSettings.upiId !== undefined) {
      if (typeof newSettings.upiId !== 'string') throw validationError('upiId must be a string');
      const trimmed = newSettings.upiId.trim().slice(0, 120);
      if (trimmed && !VPA_PATTERN.test(trimmed)) {
        throw validationError('Please enter a valid UPI VPA (e.g. brand@okaxis)');
      }
      upiId = trimmed;
    }

    let merchantName = current.merchantName;
    if (newSettings.merchantName !== undefined) {
      if (typeof newSettings.merchantName !== 'string') throw validationError('merchantName must be a string');
      merchantName = newSettings.merchantName.trim().slice(0, 120) || 'TeamBee WhatsApp Store';
    }

    const currency =
      typeof newSettings.currency === 'string' && /^[A-Z]{3}$/.test(newSettings.currency.trim())
        ? newSettings.currency.trim()
        : current.currency || 'INR';

    const saved = await runScoped(tenantId, dbAccessor, (db) =>
      db.commerceSettings.upsert({
        where: { tenantId },
        update: { upiId, merchantName, currency },
        create: { id: uuidv4(), tenantId, upiId, merchantName, currency },
      })
    );
    return {
      upiId: saved.upiId,
      merchantName: saved.merchantName,
      currency: saved.currency,
      updatedAt: saved.updatedAt,
    };
  }

  /**
   * Generates standard NPCI UPI Intent Link
   * upi://pay?pa=...&pn=...&am=...&tn=...&cu=INR
   */
  static generateUpiLink({ vpa, merchantName, amount, orderId, note }) {
    const cleanVpa = encodeURIComponent(String(vpa || 'merchant@upi').trim());
    const cleanPn = encodeURIComponent(String(merchantName || 'Store').trim());
    const cleanAm = Number(amount || 0).toFixed(2);
    const cleanTn = encodeURIComponent(String(note || orderId || 'Payment').trim());
    return `upi://pay?pa=${cleanVpa}&pn=${cleanPn}&am=${cleanAm}&tn=${cleanTn}&cu=INR`;
  }
}

module.exports = CommerceService;
