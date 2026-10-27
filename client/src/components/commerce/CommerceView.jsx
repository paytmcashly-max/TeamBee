import React, { useState, useEffect } from 'react';
import {
  ShoppingBag,
  Plus,
  CreditCard,
  Trash2,
  Edit2,
  CheckCircle2,
  ExternalLink,
  QrCode,
  DollarSign,
  Package,
  Layers,
  ArrowLeft,
  RefreshCw,
  Copy,
  Check,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';

export default function CommerceView({ onBack, onOpenInbox }) {
  const { token } = useAuth();
  const toast = useToast();
  const [products, setProducts] = useState([]);
  const [settings, setSettings] = useState({ upiId: 'teambee@upi', merchantName: 'WhatsApp Store' });
  const [loading, setLoading] = useState(true);
  const [showProductModal, setShowProductModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [copiedVpa, setCopiedVpa] = useState(false);

  // Form state
  const [formTitle, setFormTitle] = useState('');
  const [formPrice, setFormPrice] = useState('');
  const [formDesc, setFormDesc] = useState('');
  const [formCategory, setFormCategory] = useState('General');
  const [formSku, setFormSku] = useState('');
  const [formImage, setFormImage] = useState('');
  const [formInStock, setFormInStock] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Settings form
  const [settingsUpiId, setSettingsUpiId] = useState('');
  const [settingsMerchant, setSettingsMerchant] = useState('');

  const loadCommerceData = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/commerce/products', {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      const data = await res.json();
      if (data.success) {
        setProducts(data.products || []);
        if (data.settings) {
          setSettings(data.settings);
          setSettingsUpiId(data.settings.upiId || '');
          setSettingsMerchant(data.settings.merchantName || '');
        }
      }
    } catch (err) {
      toast.error('Failed to load store catalog');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCommerceData();
  }, []);

  const openAddModal = () => {
    setEditingProduct(null);
    setFormTitle('');
    setFormPrice('');
    setFormDesc('');
    setFormCategory('General');
    setFormSku(`SKU-${Math.floor(1000 + Math.random() * 9000)}`);
    setFormImage('');
    setFormInStock(true);
    setShowProductModal(true);
  };

  const openEditModal = (p) => {
    setEditingProduct(p);
    setFormTitle(p.title);
    setFormPrice(p.price);
    setFormDesc(p.description || '');
    setFormCategory(p.category || 'General');
    setFormSku(p.sku || '');
    setFormImage(p.imageUrl || '');
    setFormInStock(p.inStock !== false);
    setShowProductModal(true);
  };

  const handleSaveProduct = async (e) => {
    e.preventDefault();
    if (!formTitle.trim() || !formPrice) {
      toast.error('Product title and price are required');
      return;
    }
    setSubmitting(true);
    try {
      const payload = {
        id: editingProduct?.id,
        title: formTitle.trim(),
        price: Number(formPrice),
        description: formDesc.trim(),
        category: formCategory.trim(),
        sku: formSku.trim(),
        imageUrl: formImage.trim(),
        inStock: formInStock,
      };
      const res = await fetch('/api/commerce/products', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (data.success) {
        toast.success(editingProduct ? 'Product updated' : 'Product added to catalog');
        setShowProductModal(false);
        loadCommerceData();
      } else {
        toast.error(data.error || 'Failed to save product');
      }
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteProduct = async (id) => {
    if (!window.confirm('Are you sure you want to delete this product?')) return;
    try {
      const res = await fetch(`/api/commerce/products/${id}`, {
        method: 'DELETE',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      const data = await res.json();
      if (data.success) {
        toast.success('Product removed');
        setProducts((prev) => prev.filter((p) => p.id !== id));
      }
    } catch (err) {
      toast.error('Failed to delete product');
    }
  };

  const handleSaveSettings = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/commerce/settings', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          upiId: settingsUpiId.trim(),
          merchantName: settingsMerchant.trim(),
        }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success('Payment settings updated');
        setSettings(data.settings);
        setShowSettingsModal(false);
      }
    } catch (err) {
      toast.error('Failed to update payment settings');
    }
  };

  const copyVpa = () => {
    navigator.clipboard.writeText(settings.upiId || 'teambee@upi');
    setCopiedVpa(true);
    setTimeout(() => setCopiedVpa(false), 2000);
    toast.success('UPI VPA copied to clipboard');
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: 'var(--bg-app)', overflowY: 'auto' }}>
      {/* Top Header */}
      <div
        style={{
          background: 'var(--bg-surface)',
          borderBottom: '1px solid var(--border-subtle)',
          padding: '16px 24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '12px',
          position: 'sticky',
          top: 0,
          zIndex: 10,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {onBack && (
            <button
              onClick={onBack}
              className="btn btn-ghost btn-sm"
              style={{ color: 'var(--text-secondary)', padding: '6px' }}
              title="Back"
            >
              <ArrowLeft size={18} />
            </button>
          )}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div
                style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '8px',
                  background: 'rgba(37, 211, 102, 0.12)',
                  color: 'var(--wa-primary)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <ShoppingBag size={18} />
              </div>
              <h1 style={{ fontSize: '18px', fontWeight: '700', color: 'var(--text-main)', margin: 0 }}>
                WhatsApp Commerce &amp; Catalog
              </h1>
              <span
                style={{
                  background: 'rgba(37, 211, 102, 0.12)',
                  color: '#16a34a',
                  fontSize: '11px',
                  fontWeight: '700',
                  padding: '2px 8px',
                  borderRadius: '12px',
                }}
              >
                DoubleTick Commerce
              </span>
            </div>
            <p style={{ fontSize: '12.5px', color: 'var(--text-muted)', margin: '2px 0 0 40px' }}>
              Share interactive product cards and collect instant UPI payments inside WhatsApp chats
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button
            onClick={() => setShowSettingsModal(true)}
            className="btn btn-secondary btn-sm"
            style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <CreditCard size={14} />
            <span>UPI &amp; Payments</span>
          </button>
          <button
            onClick={openAddModal}
            className="btn btn-primary btn-sm"
            style={{
              background: 'var(--wa-primary)',
              color: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontWeight: '600',
            }}
          >
            <Plus size={15} />
            <span>Add Product</span>
          </button>
        </div>
      </div>

      <div style={{ padding: '24px', maxWidth: '1200px', width: '100%', margin: '0 auto' }}>
        {/* Metric Cards Banner */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: '16px',
            marginBottom: '24px',
          }}
        >
          <div
            style={{
              background: 'var(--bg-surface)',
              border: '1px solid var(--border-subtle)',
              borderRadius: '12px',
              padding: '16px',
              display: 'flex',
              alignItems: 'center',
              gap: '14px',
            }}
          >
            <div
              style={{
                width: '42px',
                height: '42px',
                borderRadius: '10px',
                background: 'rgba(56, 189, 248, 0.12)',
                color: '#0284c7',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Package size={22} />
            </div>
            <div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: '500' }}>Active Products</div>
              <div style={{ fontSize: '20px', fontWeight: '800', color: 'var(--text-main)' }}>{products.length}</div>
            </div>
          </div>

          <div
            style={{
              background: 'var(--bg-surface)',
              border: '1px solid var(--border-subtle)',
              borderRadius: '12px',
              padding: '16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
              <div
                style={{
                  width: '42px',
                  height: '42px',
                  borderRadius: '10px',
                  background: 'rgba(37, 211, 102, 0.12)',
                  color: 'var(--wa-primary)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <CreditCard size={22} />
              </div>
              <div>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: '500' }}>Default UPI ID</div>
                <div style={{ fontSize: '14px', fontWeight: '700', color: 'var(--text-main)', fontFamily: 'var(--font-mono)' }}>
                  {settings.upiId || 'teambee@upi'}
                </div>
              </div>
            </div>
            <button
              onClick={copyVpa}
              className="btn btn-ghost btn-xs"
              style={{ padding: '6px', color: copiedVpa ? 'var(--wa-primary)' : 'var(--text-muted)' }}
              title="Copy UPI ID"
            >
              {copiedVpa ? <Check size={14} /> : <Copy size={14} />}
            </button>
          </div>

          <div
            style={{
              background: 'var(--bg-surface)',
              border: '1px solid var(--border-subtle)',
              borderRadius: '12px',
              padding: '16px',
              display: 'flex',
              alignItems: 'center',
              gap: '14px',
            }}
          >
            <div
              style={{
                width: '42px',
                height: '42px',
                borderRadius: '10px',
                background: 'rgba(245, 158, 11, 0.12)',
                color: '#d97706',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <QrCode size={22} />
            </div>
            <div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: '500' }}>WhatsApp Intent Mode</div>
              <div style={{ fontSize: '14px', fontWeight: '700', color: '#16a34a' }}>UPI 1-Click Pay Ready</div>
            </div>
          </div>
        </div>

        {/* Products Grid */}
        <div style={{ marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ fontSize: '15px', fontWeight: '700', color: 'var(--text-main)', margin: 0 }}>
            WhatsApp Store Items ({products.length})
          </h2>
          <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
            These items appear directly inside ChatCanvas for instant sharing
          </span>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '48px 0', color: 'var(--text-muted)' }}>
            Loading store catalog...
          </div>
        ) : products.length === 0 ? (
          <div
            style={{
              background: 'var(--bg-surface)',
              border: '1px dashed var(--border-medium)',
              borderRadius: '12px',
              padding: '48px 24px',
              textAlign: 'center',
            }}
          >
            <ShoppingBag size={36} style={{ color: 'var(--text-muted)', margin: '0 auto 12px' }} />
            <h3 style={{ fontSize: '15px', fontWeight: '700', color: 'var(--text-main)', marginBottom: '4px' }}>
              Your catalog is currently empty
            </h3>
            <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '16px' }}>
              Add products or services with pricing in ₹ to share them with customers inside chat.
            </p>
            <button onClick={openAddModal} className="btn btn-primary btn-sm">
              <Plus size={14} /> Add First Product
            </button>
          </div>
        ) : (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
              gap: '18px',
            }}
          >
            {products.map((p) => (
              <div
                key={p.id}
                style={{
                  background: 'var(--bg-surface)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: '12px',
                  overflow: 'hidden',
                  display: 'flex',
                  flexDirection: 'column',
                  transition: 'box-shadow 0.2s ease, transform 0.2s ease',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
                }}
              >
                {/* Product Image */}
                <div style={{ height: '150px', background: 'rgba(15, 23, 42, 0.04)', position: 'relative' }}>
                  {p.imageUrl ? (
                    <img
                      src={p.imageUrl}
                      alt={p.title}
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    />
                  ) : (
                    <div
                      style={{
                        width: '100%',
                        height: '100%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'var(--text-muted)',
                      }}
                    >
                      <ShoppingBag size={32} />
                    </div>
                  )}
                  <span
                    style={{
                      position: 'absolute',
                      top: '10px',
                      right: '10px',
                      background: 'rgba(0, 0, 0, 0.7)',
                      backdropFilter: 'blur(4px)',
                      color: '#ffffff',
                      fontSize: '11px',
                      fontWeight: '700',
                      padding: '3px 8px',
                      borderRadius: '6px',
                    }}
                  >
                    ₹{Number(p.price).toLocaleString('en-IN')}
                  </span>
                </div>

                {/* Body */}
                <div style={{ padding: '14px', flex: 1, display: 'flex', flexDirection: 'column' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '6px' }}>
                    <span style={{ fontSize: '10.5px', fontWeight: '600', color: '#0284c7', background: 'rgba(56, 189, 248, 0.12)', padding: '1px 6px', borderRadius: '4px' }}>
                      {p.category || 'General'}
                    </span>
                    <span style={{ fontSize: '10.5px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                      {p.sku || ''}
                    </span>
                  </div>

                  <h3 style={{ fontSize: '14.5px', fontWeight: '700', color: 'var(--text-main)', margin: '0 0 6px 0', lineHeight: 1.3 }}>
                    {p.title}
                  </h3>

                  <p
                    style={{
                      fontSize: '12.5px',
                      color: 'var(--text-muted)',
                      margin: '0 0 12px 0',
                      lineHeight: 1.4,
                      flex: 1,
                      display: '-webkit-box',
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical',
                      overflow: 'hidden',
                    }}
                  >
                    {p.description || 'No description provided.'}
                  </p>

                  {/* Actions */}
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      paddingTop: '10px',
                      borderTop: '1px solid var(--border-subtle)',
                      marginTop: 'auto',
                    }}
                  >
                    <div style={{ display: 'flex', gap: '4px' }}>
                      <button
                        onClick={() => openEditModal(p)}
                        className="btn btn-ghost btn-xs"
                        style={{ color: 'var(--text-secondary)', padding: '5px' }}
                        title="Edit product"
                      >
                        <Edit2 size={14} />
                      </button>
                      <button
                        onClick={() => handleDeleteProduct(p.id)}
                        className="btn btn-ghost btn-xs"
                        style={{ color: '#ef4444', padding: '5px' }}
                        title="Delete product"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>

                    {onOpenInbox && (
                      <button
                        onClick={onOpenInbox}
                        className="btn btn-secondary btn-xs"
                        style={{ fontSize: '11.5px', color: 'var(--wa-teal)', fontWeight: '600' }}
                      >
                        Open in Inbox
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add / Edit Product Modal */}
      {showProductModal && (
        <div className="modal-backdrop" onClick={() => setShowProductModal(false)}>
          <div
            className="modal-card"
            style={{ maxWidth: '480px', width: '90%' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ fontSize: '16px', fontWeight: '700', margin: 0, color: 'var(--text-main)' }}>
                {editingProduct ? 'Edit Catalog Product' : 'Add WhatsApp Store Product'}
              </h3>
              <button onClick={() => setShowProductModal(false)} className="btn btn-ghost btn-xs">
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveProduct} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <label style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-main)', display: 'block', marginBottom: '4px' }}>
                  Product / Service Title *
                </label>
                <input
                  type="text"
                  required
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  placeholder="e.g. Premium Cotton T-Shirt / Consultation"
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: '8px',
                    border: '1px solid var(--border-medium)',
                    background: 'var(--bg-input)',
                    color: 'var(--text-main)',
                  }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                  <label style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-main)', display: 'block', marginBottom: '4px' }}>
                    Price (INR ₹) *
                  </label>
                  <input
                    type="number"
                    required
                    min="1"
                    value={formPrice}
                    onChange={(e) => setFormPrice(e.target.value)}
                    placeholder="999"
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      borderRadius: '8px',
                      border: '1px solid var(--border-medium)',
                      background: 'var(--bg-input)',
                      color: 'var(--text-main)',
                    }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-main)', display: 'block', marginBottom: '4px' }}>
                    SKU Code
                  </label>
                  <input
                    type="text"
                    value={formSku}
                    onChange={(e) => setFormSku(e.target.value)}
                    placeholder="SKU-1001"
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      borderRadius: '8px',
                      border: '1px solid var(--border-medium)',
                      background: 'var(--bg-input)',
                      color: 'var(--text-main)',
                    }}
                  />
                </div>
              </div>

              <div>
                <label style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-main)', display: 'block', marginBottom: '4px' }}>
                  Category
                </label>
                <input
                  type="text"
                  value={formCategory}
                  onChange={(e) => setFormCategory(e.target.value)}
                  placeholder="e.g. Apparel, Digital Products, Food"
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: '8px',
                    border: '1px solid var(--border-medium)',
                    background: 'var(--bg-input)',
                    color: 'var(--text-main)',
                  }}
                />
              </div>

              <div>
                <label style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-main)', display: 'block', marginBottom: '4px' }}>
                  Product Image URL (Public HTTPS)
                </label>
                <input
                  type="url"
                  value={formImage}
                  onChange={(e) => setFormImage(e.target.value)}
                  placeholder="https://images.unsplash.com/..."
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: '8px',
                    border: '1px solid var(--border-medium)',
                    background: 'var(--bg-input)',
                    color: 'var(--text-main)',
                  }}
                />
              </div>

              <div>
                <label style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-main)', display: 'block', marginBottom: '4px' }}>
                  Description (shown on WhatsApp Card)
                </label>
                <textarea
                  rows={3}
                  value={formDesc}
                  onChange={(e) => setFormDesc(e.target.value)}
                  placeholder="Details, dimensions, or features..."
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: '8px',
                    border: '1px solid var(--border-medium)',
                    background: 'var(--bg-input)',
                    color: 'var(--text-main)',
                    resize: 'none',
                  }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '10px' }}>
                <button
                  type="button"
                  onClick={() => setShowProductModal(false)}
                  className="btn btn-secondary btn-sm"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="btn btn-primary btn-sm"
                  style={{ background: 'var(--wa-primary)', color: '#ffffff' }}
                >
                  {submitting ? 'Saving...' : editingProduct ? 'Save Changes' : 'Create Product'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Store & UPI Settings Modal */}
      {showSettingsModal && (
        <div className="modal-backdrop" onClick={() => setShowSettingsModal(false)}>
          <div
            className="modal-card"
            style={{ maxWidth: '440px', width: '90%' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <CreditCard size={18} style={{ color: 'var(--wa-primary)' }} />
                <h3 style={{ fontSize: '16px', fontWeight: '700', margin: 0, color: 'var(--text-main)' }}>
                  UPI &amp; Payment Gateway Settings
                </h3>
              </div>
              <button onClick={() => setShowSettingsModal(false)} className="btn btn-ghost btn-xs">
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveSettings} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-main)', display: 'block', marginBottom: '4px' }}>
                  Business UPI VPA / Handle *
                </label>
                <input
                  type="text"
                  required
                  value={settingsUpiId}
                  onChange={(e) => setSettingsUpiId(e.target.value)}
                  placeholder="e.g. teambee@okhdfcbank or merchant@upi"
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: '8px',
                    border: '1px solid var(--border-medium)',
                    background: 'var(--bg-input)',
                    color: 'var(--text-main)',
                    fontFamily: 'var(--font-mono)',
                  }}
                />
                <span style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', marginTop: '4px' }}>
                  Payments will be received directly into your bank account with 0% gateway commission.
                </span>
              </div>

              <div>
                <label style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-main)', display: 'block', marginBottom: '4px' }}>
                  Merchant / Payee Name
                </label>
                <input
                  type="text"
                  value={settingsMerchant}
                  onChange={(e) => setSettingsMerchant(e.target.value)}
                  placeholder="e.g. TeamBee Technologies"
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: '8px',
                    border: '1px solid var(--border-medium)',
                    background: 'var(--bg-input)',
                    color: 'var(--text-main)',
                  }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '10px' }}>
                <button
                  type="button"
                  onClick={() => setShowSettingsModal(false)}
                  className="btn btn-secondary btn-sm"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary btn-sm"
                  style={{ background: 'var(--wa-primary)', color: '#ffffff' }}
                >
                  Update Settings
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
