import React, { useState } from 'react';
import { MessageSquare, X } from 'lucide-react';
import { useChat } from '../../context/ChatContext';
import { apiFetch } from '../../services/apiClient';

export default function NewChatModal({ isOpen, onClose }) {
  const { selectChat, fetchChats } = useChat();

  const [countryCode, setCountryCode] = useState('91');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [initialMessage, setInitialMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const fullPhone = `${countryCode.replace(/\D/g, '')}${phoneNumber.replace(/\D/g, '')}`;
    if (fullPhone.length < 8) {
      setError('Please enter a valid phone number with country code.');
      setLoading(false);
      return;
    }

    try {
      const data = await apiFetch('/api/chats/initiate', {
        method: 'POST',
        body: JSON.stringify({
          phone: fullPhone,
          name: customerName.trim() || undefined,
          initialMessage: initialMessage.trim() || undefined,
        }),
      });

      await fetchChats(true);
      selectChat(data.chat.id);
      setPhoneNumber('');
      setCustomerName('');
      setInitialMessage('');
      onClose();
    } catch (err) {
      setError(err.message || 'Failed to start conversation.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" style={{ maxWidth: '500px' }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header-bar">
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '8px',
                background: 'var(--tb-green-pill-bg)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--tb-primary-green)',
              }}
            >
              <MessageSquare size={18} />
            </div>
            <div>
              <h3 className="modal-header-title">Start a new chat</h3>
              <p className="modal-header-subtitle">
                Create or open a conversation by WhatsApp phone number
              </p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="btn btn-ghost" style={{ padding: '6px' }}>
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body-pad page-stack">
            {error && <div className="tb-alert error">{error}</div>}

            <div className="tb-field">
              <label className="tb-label">WhatsApp number</label>
              <div style={{ display: 'grid', gridTemplateColumns: '90px 1fr', gap: '8px' }}>
                <input
                  type="text"
                  className="tb-input"
                  value={countryCode}
                  onChange={(e) => setCountryCode(e.target.value)}
                  placeholder="91"
                />
                <input
                  type="tel"
                  required
                  className="tb-input"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  placeholder="98765 43210"
                />
              </div>
            </div>

            <div className="tb-field">
              <label className="tb-label">Customer name (optional)</label>
              <input
                type="text"
                className="tb-input"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder="Priya Nair"
              />
            </div>

            <div className="tb-field">
              <label className="tb-label">Opening message (optional)</label>
              <textarea
                rows={3}
                className="tb-textarea"
                value={initialMessage}
                onChange={(e) => setInitialMessage(e.target.value)}
                placeholder="Type an opening note or leave blank to open the thread first..."
              />
            </div>
          </div>

          <div className="modal-footer-bar">
            <span className="tb-hint">Format: Country code + number</span>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button type="button" className="btn btn-secondary" onClick={onClose}>
                Cancel
              </button>
              <button type="submit" className="btn btn-primary" disabled={loading}>
                {loading ? 'Opening...' : 'Start chat ↗'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
