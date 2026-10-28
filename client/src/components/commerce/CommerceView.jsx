import React, { useState, useEffect } from 'react';
import {
  ShoppingBag,
  Plus,
  CreditCard,
  Trash2,
  Edit2,
  CheckCircle2,
  QrCode,
  Package,
  Copy,
  Check,
  Settings,
  Tag,
  Store,
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

  const [formTitle, setFormTitle] = useState('');
  const [formPrice, setFormPrice] = useState('');
  const [formDesc, setFormDesc] = useState('');
  const [formCategory, setFormCategory] = useState('General');
  const [formSku, setFormSku] = useState('');
  const [formImage, setFormImage] = useState('');
  const [formInStock, setFormInStock] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [settingsUpiId, setSettingsUpiId] = useState('');
  const [settingsMerchant, setSettingsMerchant] = useState('');

  const loadData = async () => {
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
    } catch {
      toast.error('Failed to load catalog');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  const openAdd = () => {
    setEditingProduct(null);
    setFormTitle(''); setFormPrice(''); setFormDesc('');
    setFormCategory('General');
    setFormSku(`SKU-${Math.floor(1000 + Math.random() * 9000)}`);
    setFormImage(''); setFormInStock(true);
    setShowProductModal(true);
  };

  const openEdit = (p) => {
    setEditingProduct(p);
    setFormTitle(p.title); setFormPrice(p.price); setFormDesc(p.description || '');
    setFormCategory(p.category || 'General'); setFormSku(p.sku || '');
    setFormImage(p.imageUrl || ''); setFormInStock(p.inStock !== false);
    setShowProductModal(true);
  };

  const handleSaveProduct = async (e) => {
    e.preventDefault();
    if (!formTitle.trim() || !formPrice) { toast.error('Title and price required'); return; }
    setSubmitting(true);
    try {
      const res = await fetch('/api/commerce/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({
          id: editingProduct?.id,
          title: formTitle.trim(), price: Number(formPrice),
          description: formDesc.trim(), category: formCategory.trim(),
          sku: formSku.trim(), imageUrl: formImage.trim(), inStock: formInStock,
        }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success(editingProduct ? 'Product updated' : 'Product added');
        setShowProductModal(false);
        loadData();
      } else toast.error(data.error || 'Save failed');
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this product?')) return;
    try {
      const res = await fetch(`/api/commerce/products/${id}`, {
        method: 'DELETE',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      const data = await res.json();
      if (data.success) {
        toast.success('Product removed');
        setProducts(prev => prev.filter(p => p.id !== id));
      }
    } catch { toast.error('Delete failed'); }
  };

  const handleSaveSettings = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/commerce/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ upiId: settingsUpiId.trim(), merchantName: settingsMerchant.trim() }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success('Payment settings updated');
        setSettings(data.settings);
        setShowSettingsModal(false);
      }
    } catch { toast.error('Settings update failed'); }
  };

  const copyVpa = () => {
    navigator.clipboard.writeText(settings.upiId || 'teambee@upi');
    setCopiedVpa(true);
    setTimeout(() => setCopiedVpa(false), 2000);
    toast.success('UPI ID copied');
  };

  const inStockCount = products.filter(p => p.inStock !== false).length;

  return (
    <div className="dt-page">
      {/* Page Header */}
      <div className="dt-page-header">
        <div className="dt-page-header-left">
          <div className="dt-page-icon" style={{ background: 'rgba(37, 211, 102, 0.12)', color: 'var(--wa-primary)' }}>
            <ShoppingBag size={18} />
          </div>
          <div>
            <h1 className="dt-page-title">WhatsApp Commerce &amp; Catalog</h1>
            <p className="dt-page-desc">
              Share interactive product cards &amp; collect instant UPI payments inside chats
            </p>
          </div>
        </div>
        <div className="dt-page-header-right">
          <button
            onClick={() => setShowSettingsModal(true)}
            className="dt-btn dt-btn-secondary dt-btn-sm"
          >
            <CreditCard size={14} />
            <span>UPI &amp; Payments</span>
          </button>
          <button onClick={openAdd} className="dt-btn dt-btn-primary dt-btn-sm">
            <Plus size={15} />
            <span>Add Product</span>
          </button>
        </div>
      </div>

      {/* Page Body */}
      <div className="dt-page-body">
        {/* Stats Row */}
        <div className="dt-stats-grid">
          <div className="dt-stat-card">
            <div className="dt-stat-icon" style={{ background: 'rgba(56, 189, 248, 0.12)', color: '#0284c7' }}>
              <Package size={18} />
            </div>
            <div className="dt-stat-body">
              <div className="dt-stat-label">Active Products</div>
              <div className="dt-stat-value">{inStockCount}</div>
              <div className="dt-stat-sub">{products.length} total in catalog</div>
            </div>
          </div>

          <div className="dt-stat-card" style={{ cursor: 'pointer' }} onClick={copyVpa}>
            <div className="dt-stat-icon" style={{ background: 'rgba(37, 211, 102, 0.12)', color: 'var(--wa-primary)' }}>
              <CreditCard size={18} />
            </div>
            <div className="dt-stat-body">
              <div className="dt-stat-label">UPI Payment ID</div>
              <div className="dt-stat-value" style={{ fontSize: '14px', fontFamily: 'var(--font-mono)', letterSpacing: 0 }}>
                {settings.upiId || 'teambee@upi'}
              </div>
              <div className="dt-stat-sub" style={{ color: copiedVpa ? '#16a34a' : undefined }}>
                {copiedVpa ? '✓ Copied!' : 'Click to copy VPA'}
              </div>
            </div>
            <div style={{ marginLeft: 'auto', color: copiedVpa ? '#16a34a' : 'var(--text-muted)' }}>
              {copiedVpa ? <Check size={16} /> : <Copy size={16} />}
            </div>
          </div>

          <div className="dt-stat-card">
            <div className="dt-stat-icon" style={{ background: 'rgba(245, 158, 11, 0.10)', color: '#d97706' }}>
              <QrCode size={18} />
            </div>
            <div className="dt-stat-body">
              <div className="dt-stat-label">Merchant</div>
              <div className="dt-stat-value" style={{ fontSize: '14px' }}>{settings.merchantName || 'WhatsApp Store'}</div>
              <div className="dt-stat-sub" style={{ color: '#16a34a' }}>UPI 1-Click Pay Ready</div>
            </div>
          </div>
        </div>

        {/* Products Section Header */}
        <div className="dt-section-header">
          <div className="dt-section-title">
            <Store size={15} />
            <span>Catalog Items</span>
          </div>
          <span className="dt-section-count">{products.length} product{products.length !== 1 ? 's' : ''}</span>
        </div>

        {/* Products Grid */}
        {loading ? (
          <div className="dt-empty-state"><div className="dt-spinner" /><p>Loading catalog…</p></div>
        ) : products.length === 0 ? (
          <div className="dt-empty-state dt-empty-dashed">
            <div className="dt-empty-icon" style={{ background: 'rgba(37, 211, 102, 0.10)', color: 'var(--wa-primary)' }}>
              <ShoppingBag size={28} />
            </div>
            <h3>Catalog is empty</h3>
            <p>Add products or services with ₹ pricing to share them inside WhatsApp chats.</p>
            <button onClick={openAdd} className="dt-btn dt-btn-primary dt-btn-sm">
              <Plus size={14} /> Add First Product
            </button>
          </div>
        ) : (
          <div className="dt-products-grid">
            {products.map(p => (
              <div key={p.id} className="dt-product-card">
                {/* Image */}
                <div className="dt-product-image">
                  {p.imageUrl ? (
                    <img src={p.imageUrl} alt={p.title} className="dt-product-img" />
                  ) : (
                    <div className="dt-product-img-placeholder">
                      <ShoppingBag size={28} />
                    </div>
                  )}
                  <div className="dt-product-price-tag">
                    ₹{Number(p.price).toLocaleString('en-IN')}
                  </div>
                  {p.inStock === false && (
                    <div className="dt-product-oos-tag">Out of Stock</div>
                  )}
                </div>

                {/* Body */}
                <div className="dt-product-body">
                  <div className="dt-product-meta">
                    <span className="dt-product-category">{p.category || 'General'}</span>
                    {p.sku && <span className="dt-product-sku">{p.sku}</span>}
                  </div>
                  <h3 className="dt-product-title">{p.title}</h3>
                  <p className="dt-product-desc">
                    {p.description || 'No description provided.'}
                  </p>
                </div>

                {/* Actions */}
                <div className="dt-product-actions">
                  <div className="dt-product-action-left">
                    <button
                      onClick={() => openEdit(p)}
                      className="dt-btn dt-btn-ghost dt-btn-icon"
                      title="Edit"
                    >
                      <Edit2 size={14} />
                    </button>
                    <button
                      onClick={() => handleDelete(p.id)}
                      className="dt-btn dt-btn-ghost dt-btn-icon"
                      style={{ color: '#ef4444' }}
                      title="Delete"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                  {onOpenInbox && (
                    <button
                      onClick={onOpenInbox}
                      className="dt-btn dt-btn-secondary dt-btn-xs"
                    >
                      Open in Chat
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add/Edit Product Modal */}
      {showProductModal && (
        <div className="dt-modal-overlay" onClick={() => setShowProductModal(false)}>
          <div className="dt-modal dt-modal-md" onClick={e => e.stopPropagation()}>
            <div className="dt-modal-header">
              <div className="dt-modal-title">
                {editingProduct ? 'Edit Product' : 'Add New Product'}
              </div>
              <button onClick={() => setShowProductModal(false)} className="dt-btn dt-btn-ghost dt-btn-icon">✕</button>
            </div>
            <form onSubmit={handleSaveProduct} className="dt-modal-body">
              <div className="dt-field">
                <label className="dt-label">Product / Service Title *</label>
                <input type="text" required className="dt-input" value={formTitle} onChange={e => setFormTitle(e.target.value)} placeholder="e.g. Premium Cotton T-Shirt" />
              </div>
              <div className="dt-form-row">
                <div className="dt-field">
                  <label className="dt-label">Price (₹) *</label>
                  <input type="number" required min="1" className="dt-input" value={formPrice} onChange={e => setFormPrice(e.target.value)} placeholder="999" />
                </div>
                <div className="dt-field">
                  <label className="dt-label">SKU Code</label>
                  <input type="text" className="dt-input" value={formSku} onChange={e => setFormSku(e.target.value)} placeholder="SKU-1001" />
                </div>
              </div>
              <div className="dt-field">
                <label className="dt-label">Category</label>
                <input type="text" className="dt-input" value={formCategory} onChange={e => setFormCategory(e.target.value)} placeholder="Apparel, Digital, Food…" />
              </div>
              <div className="dt-field">
                <label className="dt-label">Image URL (Public HTTPS)</label>
                <input type="url" className="dt-input" value={formImage} onChange={e => setFormImage(e.target.value)} placeholder="https://images.unsplash.com/…" />
              </div>
              <div className="dt-field">
                <label className="dt-label">Description</label>
                <textarea rows={3} className="dt-textarea" value={formDesc} onChange={e => setFormDesc(e.target.value)} placeholder="Details, features, or dimensions…" />
              </div>
              <label className="dt-checkbox-label">
                <input type="checkbox" checked={formInStock} onChange={e => setFormInStock(e.target.checked)} className="dt-checkbox" />
                <span>In Stock</span>
              </label>
              <div className="dt-modal-actions">
                <button type="button" onClick={() => setShowProductModal(false)} className="dt-btn dt-btn-secondary dt-btn-sm">Cancel</button>
                <button type="submit" disabled={submitting} className="dt-btn dt-btn-primary dt-btn-sm">
                  {submitting ? 'Saving…' : editingProduct ? 'Save Changes' : 'Create Product'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* UPI Settings Modal */}
      {showSettingsModal && (
        <div className="dt-modal-overlay" onClick={() => setShowSettingsModal(false)}>
          <div className="dt-modal" onClick={e => e.stopPropagation()}>
            <div className="dt-modal-header">
              <div className="dt-modal-title">UPI &amp; Payment Settings</div>
              <button onClick={() => setShowSettingsModal(false)} className="dt-btn dt-btn-ghost dt-btn-icon">✕</button>
            </div>
            <form onSubmit={handleSaveSettings} className="dt-modal-body">
              <div className="dt-field">
                <label className="dt-label">Business UPI VPA / Handle *</label>
                <input type="text" required className="dt-input dt-input-mono" value={settingsUpiId} onChange={e => setSettingsUpiId(e.target.value)} placeholder="merchant@okhdfcbank" />
                <span className="dt-field-hint">Payments go directly to your bank — 0% gateway commission</span>
              </div>
              <div className="dt-field">
                <label className="dt-label">Merchant / Payee Name</label>
                <input type="text" className="dt-input" value={settingsMerchant} onChange={e => setSettingsMerchant(e.target.value)} placeholder="e.g. TeamBee Technologies" />
              </div>
              <div className="dt-modal-actions">
                <button type="button" onClick={() => setShowSettingsModal(false)} className="dt-btn dt-btn-secondary dt-btn-sm">Cancel</button>
                <button type="submit" className="dt-btn dt-btn-primary dt-btn-sm">Save Settings</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
