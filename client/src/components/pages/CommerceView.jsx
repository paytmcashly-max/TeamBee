import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Copy, Check } from 'lucide-react';
import { apiFetch } from '../../services/apiClient';

export default function CommerceView() {
  const [products, setProducts] = useState([]);
  const [settings, setSettings] = useState({ upiId: '', merchantName: 'TeamBee Store' });
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [feedback, setFeedback] = useState(null);

  const [title, setTitle] = useState('');
  const [price, setPrice] = useState('');
  const [category, setCategory] = useState('General');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);

  const loadCatalog = async () => {
    setLoading(true);
    try {
      const data = await apiFetch('/api/commerce/products');
      setProducts(data.products || []);
      if (data.settings) setSettings(data.settings);
    } catch (err) {
      setFeedback({ type: 'error', text: err.message });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCatalog();
  }, []);

  const handleAddProduct = async (e) => {
    e.preventDefault();
    if (!title.trim() || !price) return;
    setSaving(true);
    setFeedback(null);
    try {
      await apiFetch('/api/commerce/products', {
        method: 'POST',
        body: JSON.stringify({
          title: title.trim(),
          price: Number(price),
          category: category.trim() || 'General',
          description: description.trim(),
          inStock: true,
        }),
      });
      setTitle('');
      setPrice('');
      setDescription('');
      setFeedback({ type: 'success', text: 'Product added to WhatsApp catalog.' });
      await loadCatalog();
    } catch (err) {
      setFeedback({ type: 'error', text: err.message });
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteProduct = async (id) => {
    try {
      await apiFetch(`/api/commerce/products/${id}`, { method: 'DELETE' });
      await loadCatalog();
    } catch (err) {
      setFeedback({ type: 'error', text: err.message });
    }
  };

  const handleSavePaymentSettings = async (e) => {
    e.preventDefault();
    setSaving(true);
    setFeedback(null);
    try {
      await apiFetch('/api/commerce/settings', {
        method: 'PUT',
        body: JSON.stringify(settings),
      });
      setFeedback({ type: 'success', text: 'Merchant UPI settings updated.' });
    } catch (err) {
      setFeedback({ type: 'error', text: err.message });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="page-scroll-container">
      <div className="workspace-page-header" style={{ padding: '20px 0 18px 0' }}>
        <div className="page-header-text">
          <h1 className="page-header-title">Commerce &amp; catalog</h1>
          <p className="page-header-subtitle">
            Manage product cards and UPI payment links shared inside customer chats.
          </p>
        </div>
      </div>

      {feedback && (
        <div className={`tb-alert ${feedback.type}`} style={{ marginBottom: '16px' }}>
          <span>{feedback.text}</span>
        </div>
      )}

      <div className="page-two-col">
        <div className="page-card">
          <div className="page-card-header">
            <h2 className="page-card-title">Catalog products ({products.length})</h2>
          </div>

          {loading ? (
            <p className="tb-hint">Loading products...</p>
          ) : products.length === 0 ? (
            <p className="tb-hint">No products in catalog yet. Add your first item on the right.</p>
          ) : (
            <div className="tb-table-wrap">
              <table className="tb-table">
                <thead>
                  <tr>
                    <th>Title</th>
                    <th>Category</th>
                    <th>Price</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {products.map((p) => (
                    <tr key={p.id}>
                      <td>
                        <div style={{ fontWeight: 600 }}>{p.title}</div>
                        {p.description && <div className="tb-hint">{p.description}</div>}
                      </td>
                      <td>{p.category || 'General'}</td>
                      <td style={{ fontWeight: 600 }}>₹{Number(p.price || 0).toLocaleString('en-IN')}</td>
                      <td style={{ textAlign: 'right' }}>
                        <button
                          type="button"
                          className="btn btn-ghost"
                          style={{ padding: '5px' }}
                          onClick={() => handleDeleteProduct(p.id)}
                          title="Delete product"
                        >
                          <Trash2 size={14} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="page-stack">
          <form onSubmit={handleAddProduct} className="page-card page-stack" style={{ gap: '12px' }}>
            <h3 className="page-card-title">Add catalog item</h3>
            <div className="tb-field">
              <label className="tb-label">Product name</label>
              <input
                type="text"
                required
                className="tb-input"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Growth Plan Pack"
              />
            </div>
            <div className="tb-form-grid-2">
              <div className="tb-field">
                <label className="tb-label">Price (INR)</label>
                <input
                  type="number"
                  min="1"
                  required
                  className="tb-input"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  placeholder="1499"
                />
              </div>
              <div className="tb-field">
                <label className="tb-label">Category</label>
                <input
                  type="text"
                  className="tb-input"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                />
              </div>
            </div>
            <div className="tb-field">
              <label className="tb-label">Short description</label>
              <input
                type="text"
                className="tb-input"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Shared in product cards"
              />
            </div>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              <Plus size={14} />
              <span>Add product</span>
            </button>
          </form>

          <form onSubmit={handleSavePaymentSettings} className="page-card page-stack" style={{ gap: '12px' }}>
            <div className="page-card-header" style={{ marginBottom: 0 }}>
              <h3 className="page-card-title">Merchant UPI settings</h3>
              {settings.upiId && (
                <button
                  type="button"
                  className="btn btn-secondary"
                  style={{ padding: '4px 9px', fontSize: '11.5px' }}
                  onClick={() => {
                    navigator.clipboard?.writeText(settings.upiId).catch(() => {});
                    setCopied(true);
                    setTimeout(() => setCopied(false), 1500);
                  }}
                >
                  {copied ? <Check size={12} /> : <Copy size={12} />}
                  <span>{copied ? 'Copied' : 'Copy UPI'}</span>
                </button>
              )}
            </div>
            <div className="tb-field">
              <label className="tb-label">Merchant display name</label>
              <input
                type="text"
                className="tb-input"
                value={settings.merchantName || ''}
                onChange={(e) => setSettings((prev) => ({ ...prev, merchantName: e.target.value }))}
              />
            </div>
            <div className="tb-field">
              <label className="tb-label">UPI ID (VPA)</label>
              <input
                type="text"
                className="tb-input"
                value={settings.upiId || ''}
                onChange={(e) => setSettings((prev) => ({ ...prev, upiId: e.target.value }))}
                placeholder="brand@okaxis"
              />
            </div>
            <button type="submit" className="btn btn-secondary" disabled={saving}>
              Save UPI settings
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
