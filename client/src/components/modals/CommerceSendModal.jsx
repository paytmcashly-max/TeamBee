import React, { useState, useEffect } from 'react';
import { X, ShoppingBag, IndianRupee, Send } from 'lucide-react';
import { useChat } from '../../context/ChatContext';
import { apiFetch } from '../../services/apiClient';

export default function CommerceSendModal({ isOpen, onClose }) {
  const { activeChat } = useChat();
  const [tab, setTab] = useState('product'); // 'product' | 'payment'
  const [products, setProducts] = useState([]);
  const [settings, setSettings] = useState({ upiId: '', merchantName: '' });
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [selectedProductId, setSelectedProductId] = useState('');
  const [customNote, setCustomNote] = useState('');
  const [amount, setAmount] = useState('');
  const [paymentNote, setPaymentNote] = useState('');
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!isOpen) return;
    let active = true;
    setLoading(true);
    setError(null);
    apiFetch('/api/commerce/products')
      .then((data) => {
        if (!active) return;
        const list = data.products || [];
        setProducts(list);
        if (data.settings) setSettings(data.settings);
        if (list.length > 0) setSelectedProductId(list[0].id);
      })
      .catch((err) => {
        if (active) setError(err.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [isOpen]);

  if (!isOpen || !activeChat) return null;

  const handleSendProduct = async (e) => {
    e.preventDefault();
    if (!selectedProductId) return;
    setSending(true);
    setError(null);
    try {
      await apiFetch(`/api/commerce/send-product/${activeChat.id}`, {
        method: 'POST',
        body: JSON.stringify({ productId: selectedProductId, customNote: customNote.trim() || undefined }),
      });
      setCustomNote('');
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setSending(false);
    }
  };

  const handleSendPayment = async (e) => {
    e.preventDefault();
    const numeric = Number(amount);
    if (!Number.isFinite(numeric) || numeric <= 0) {
      setError('Enter a valid amount greater than 0.');
      return;
    }
    setSending(true);
    setError(null);
    try {
      await apiFetch(`/api/commerce/send-payment/${activeChat.id}`, {
        method: 'POST',
        body: JSON.stringify({ amount: numeric, note: paymentNote.trim() || undefined }),
      });
      setAmount('');
      setPaymentNote('');
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" style={{ maxWidth: '520px' }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header-bar">
          <div>
            <h3 className="modal-header-title">Send catalog card or UPI request</h3>
            <p className="modal-header-subtitle">
              To {activeChat.contact?.name || `+${activeChat.contact?.waId || ''}`}
            </p>
          </div>
          <button type="button" onClick={onClose} className="btn btn-ghost" style={{ padding: '6px' }}>
            <X size={18} />
          </button>
        </div>

        <div className="modal-body-pad page-stack" style={{ gap: '14px' }}>
          <div className="sandbox-type-pills">
            <button
              type="button"
              className={`sandbox-type-pill ${tab === 'product' ? 'active' : ''}`}
              onClick={() => setTab('product')}
            >
              <ShoppingBag size={12} style={{ marginRight: '5px', verticalAlign: '-1px' }} />
              Catalog product
            </button>
            <button
              type="button"
              className={`sandbox-type-pill ${tab === 'payment' ? 'active' : ''}`}
              onClick={() => setTab('payment')}
            >
              <IndianRupee size={12} style={{ marginRight: '4px', verticalAlign: '-1px' }} />
              UPI payment link
            </button>
          </div>

          {error && <div className="tb-alert error">{error}</div>}

          {tab === 'product' ? (
            loading ? (
              <p className="tb-hint">Loading catalog products...</p>
            ) : products.length === 0 ? (
              <p className="tb-hint">No products added yet. Managers can add items from Catalog in the sidebar.</p>
            ) : (
              <form onSubmit={handleSendProduct} className="page-stack" style={{ gap: '12px' }}>
                <div className="tb-field">
                  <label className="tb-label">Select product</label>
                  <select
                    className="tb-select"
                    value={selectedProductId}
                    onChange={(e) => setSelectedProductId(e.target.value)}
                  >
                    {products.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.title} — ₹{Number(p.price || 0).toLocaleString('en-IN')}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="tb-field">
                  <label className="tb-label">Optional message note</label>
                  <input
                    type="text"
                    className="tb-input"
                    value={customNote}
                    onChange={(e) => setCustomNote(e.target.value)}
                    placeholder="Recommended package for your team"
                  />
                </div>
                <button type="submit" className="btn btn-primary" disabled={sending}>
                  <Send size={14} />
                  <span>{sending ? 'Sending...' : 'Send product card'}</span>
                </button>
              </form>
            )
          ) : (
            <form onSubmit={handleSendPayment} className="page-stack" style={{ gap: '12px' }}>
              <div className="tb-hint">
                Payee VPA: <strong>{settings.upiId || 'Default workspace UPI'}</strong>
              </div>
              <div className="tb-field">
                <label className="tb-label">Amount (INR)</label>
                <input
                  type="number"
                  min="1"
                  step="any"
                  required
                  className="tb-input"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="999"
                />
              </div>
              <div className="tb-field">
                <label className="tb-label">Description (optional)</label>
                <input
                  type="text"
                  className="tb-input"
                  value={paymentNote}
                  onChange={(e) => setPaymentNote(e.target.value)}
                  placeholder="Invoice #204"
                />
              </div>
              <button type="submit" className="btn btn-primary" disabled={sending}>
                <Send size={14} />
                <span>{sending ? 'Sending...' : 'Send UPI payment request'}</span>
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
