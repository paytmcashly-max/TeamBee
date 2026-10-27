'use strict';

const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const MetaApiService = require('./metaApiService');

const COMMERCE_DATA_DIR = path.join(__dirname, '..', 'data', 'commerce');

function ensureDir() {
  if (!fs.existsSync(COMMERCE_DATA_DIR)) {
    fs.mkdirSync(COMMERCE_DATA_DIR, { recursive: true });
  }
}

function getStorePath(tenantId) {
  ensureDir();
  const safeId = String(tenantId).replace(/[^a-zA-Z0-9_-]/g, '_');
  return path.join(COMMERCE_DATA_DIR, `${safeId}.json`);
}

function getStarterProducts() {
  return [
    {
      id: 'prod_starter_suite',
      title: 'WhatsApp Growth Starter Kit',
      description: 'Automated broadcast campaigns, 500 template credits, interactive quick buttons & fast WABA setup.',
      price: 999,
      currency: 'INR',
      category: 'Software & SaaS',
      sku: 'TB-START-01',
      imageUrl: 'https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=600&auto=format&fit=crop&q=80',
      inStock: true,
      createdAt: new Date().toISOString(),
    },
    {
      id: 'prod_vip_concierge',
      title: 'Omnichannel VIP Concierge',
      description: 'Dedicated account manager, customized keyword bot flows, multi-agent round robin & 24/7 SLA.',
      price: 2499,
      currency: 'INR',
      category: 'Services',
      sku: 'TB-VIP-02',
      imageUrl: 'https://images.unsplash.com/photo-1556742049-0a67e5572263?w=600&auto=format&fit=crop&q=80',
      inStock: true,
      createdAt: new Date().toISOString(),
    },
    {
      id: 'prod_broadcast_pack',
      title: 'High-Speed Broadcast Credits (5,000)',
      description: 'Ultra-low latency delivery queue with real-time delivery, read-rate and button click analytics.',
      price: 1899,
      currency: 'INR',
      category: 'Add-ons',
      sku: 'TB-BC-5000',
      imageUrl: 'https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?w=600&auto=format&fit=crop&q=80',
      inStock: true,
      createdAt: new Date().toISOString(),
    },
  ];
}

class CommerceService {
  static getTenantStore(tenantId) {
    try {
      const filePath = getStorePath(tenantId);
      if (fs.existsSync(filePath)) {
        const raw = fs.readFileSync(filePath, 'utf8');
        return JSON.parse(raw);
      }
    } catch (err) {
      console.error('[CommerceService]: Error reading store:', err.message);
    }

    // Default store initialized with sample products
    const defaultStore = {
      tenantId,
      settings: {
        upiId: 'teambee@upi',
        merchantName: 'TeamBee WhatsApp Store',
        currency: 'INR',
        razorpayKeyId: '',
      },
      products: getStarterProducts(),
      orders: [],
      updatedAt: new Date().toISOString(),
    };

    try {
      fs.writeFileSync(getStorePath(tenantId), JSON.stringify(defaultStore, null, 2), 'utf8');
    } catch (saveErr) {
      console.error('[CommerceService]: Error writing initial store:', saveErr.message);
    }

    return defaultStore;
  }

  static saveTenantStore(tenantId, store) {
    ensureDir();
    store.updatedAt = new Date().toISOString();
    fs.writeFileSync(getStorePath(tenantId), JSON.stringify(store, null, 2), 'utf8');
    return store;
  }

  static getProducts(tenantId) {
    const store = this.getTenantStore(tenantId);
    return store.products || [];
  }

  static saveProduct(tenantId, productData) {
    const store = this.getTenantStore(tenantId);
    store.products = store.products || [];

    const now = new Date().toISOString();
    let product;

    if (productData.id) {
      const idx = store.products.findIndex((p) => p.id === productData.id);
      if (idx !== -1) {
        product = {
          ...store.products[idx],
          ...productData,
          price: Number(productData.price) || 0,
          updatedAt: now,
        };
        store.products[idx] = product;
      } else {
        product = {
          id: productData.id,
          ...productData,
          price: Number(productData.price) || 0,
          createdAt: now,
          updatedAt: now,
        };
        store.products.push(product);
      }
    } else {
      product = {
        id: `prod_${uuidv4().replace(/-/g, '').slice(0, 12)}`,
        title: productData.title || 'Untitled Product',
        description: productData.description || '',
        price: Number(productData.price) || 0,
        currency: productData.currency || 'INR',
        category: productData.category || 'General',
        sku: productData.sku || `SKU-${Math.floor(1000 + Math.random() * 9000)}`,
        imageUrl: productData.imageUrl || '',
        inStock: productData.inStock !== false,
        createdAt: now,
        updatedAt: now,
      };
      store.products.push(product);
    }

    this.saveTenantStore(tenantId, store);
    return product;
  }

  static deleteProduct(tenantId, productId) {
    const store = this.getTenantStore(tenantId);
    store.products = (store.products || []).filter((p) => p.id !== productId);
    this.saveTenantStore(tenantId, store);
    return true;
  }

  static getSettings(tenantId) {
    const store = this.getTenantStore(tenantId);
    return store.settings || {
      upiId: 'teambee@upi',
      merchantName: 'TeamBee WhatsApp Store',
      currency: 'INR',
      razorpayKeyId: '',
    };
  }

  static updateSettings(tenantId, newSettings) {
    const store = this.getTenantStore(tenantId);
    store.settings = {
      ...(store.settings || {}),
      ...newSettings,
    };
    this.saveTenantStore(tenantId, store);
    return store.settings;
  }

  /**
   * Generates standard NPCI UPI Intent Link
   * upi://pay?pa=...&pn=...&am=...&tn=...&cu=INR
   */
  static generateUpiLink({ vpa, merchantName, amount, orderId, note }) {
    const cleanVpa = String(vpa || 'merchant@upi').trim();
    const cleanPn = encodeURIComponent(String(merchantName || 'Store').trim());
    const cleanAm = Number(amount || 0).toFixed(2);
    const cleanTn = encodeURIComponent(String(note || orderId || 'Payment').trim());
    return `upi://pay?pa=${cleanVpa}&pn=${cleanPn}&am=${cleanAm}&tn=${cleanTn}&cu=INR`;
  }
}

module.exports = CommerceService;
