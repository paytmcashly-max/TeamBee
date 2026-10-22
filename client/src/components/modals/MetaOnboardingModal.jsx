import React, { useState, useEffect } from 'react';
import { Shield, Key, Phone, CheckCircle, Copy, AlertCircle, RefreshCw, X } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

export default function MetaOnboardingModal({ isOpen, onClose }) {
  const { token, agent, updateTenantInfo } = useAuth();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);
  const [message, setMessage] = useState(null);

  const [formData, setFormData] = useState({
    wabaId: '',
    phoneNumberId: '',
    accessToken: '',
    displayPhoneNumber: '',
    webhookVerifyToken: '',
    webhookUrl: '',
    isConfigured: false,
  });

  useEffect(() => {
    if (!isOpen || !agent) return;
    async function fetchSettings() {
      setLoading(true);
      try {
        const res = await fetch('/api/tenant/settings', {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        if (data.success) {
          setFormData({
            wabaId: data.settings.wabaId || '',
            phoneNumberId: data.settings.phoneNumberId || '',
            displayPhoneNumber: data.settings.displayPhoneNumber || '',
            webhookVerifyToken: data.settings.webhookVerifyToken || '',
            // Never derive the webhook URL from the page origin (that is
            // the FRONTEND's address); fall back to the API base instead.
            webhookUrl:
              data.settings.webhookUrl ||
              `${(import.meta.env.VITE_API_URL || '').replace(/\/+$/, '')}/webhook`,
            // The stored token is never prefilled into the form (the API
            // returns only a mask); blank means "keep the existing token".
            accessToken: '',
            isConfigured: data.settings.isConfigured || false,
          });
        }
      } catch (err) {
        console.error('Fetch settings error:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchSettings();
  }, [isOpen, agent, token]);

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    setMessage(null);

    try {
      const res = await fetch('/api/tenant/settings', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(formData),
      });

      const data = await res.json();
      if (data.success) {
        setMessage({ type: 'success', text: 'Meta Cloud API credentials saved successfully!' });
        updateTenantInfo(data.tenant);
      } else {
        setMessage({ type: 'error', text: data.error || 'Failed to save credentials' });
      }
    } catch (err) {
      setMessage({ type: 'error', text: err.message });
    } finally {
      setSaving(false);
    }
  };

  const copyWebhookUrl = () => {
    navigator.clipboard.writeText(formData.webhookUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Escape closes the dialog.
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="modal-overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="modal-content" role="dialog" aria-modal="true" aria-label="Meta WhatsApp settings" style={{ maxWidth: '640px' }}>
        {/* Header */}
        <div
          style={{
            padding: '16px 20px',
            borderBottom: '1px solid var(--border-subtle)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '8px',
                background: 'rgba(37, 211, 102, 0.15)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--wa-primary)',
              }}
            >
              <Shield size={20} />
            </div>
            <div>
              <h3 style={{ fontSize: '16px', color: '#fff' }}>Meta WhatsApp Cloud API Onboarding</h3>
              <p style={{ fontSize: '11.5px', color: 'var(--text-secondary)' }}>
                Configure permanent access token, WABA ID, and webhook handshake
              </p>
            </div>
          </div>
          <button onClick={onClose} className="btn btn-ghost" style={{ padding: '6px' }} aria-label="Close settings">
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div style={{ padding: '20px' }}>
          {message && (
            <div
              style={{
                padding: '10px 14px',
                borderRadius: 'var(--radius-md)',
                marginBottom: '16px',
                fontSize: '12.5px',
                background: message.type === 'success' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                color: message.type === 'success' ? '#34d399' : '#fca5a5',
                border: `1px solid ${message.type === 'success' ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`,
              }}
            >
              {message.text}
            </div>
          )}

          {/* Webhook Callback Endpoint Banner */}
          <div
            style={{
              background: 'var(--bg-surface)',
              borderRadius: 'var(--radius-md)',
              padding: '12px 14px',
              border: '1px solid var(--border-subtle)',
              marginBottom: '18px',
            }}
          >
            <div style={{ fontSize: '11.5px', fontWeight: '600', color: 'var(--text-secondary)', marginBottom: '6px' }}>
              META WEBHOOK CALLBACK URL
            </div>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <input
                type="text"
                readOnly
                value={formData.webhookUrl}
                style={{
                  flex: 1,
                  background: '#090d16',
                  border: '1px solid var(--border-medium)',
                  borderRadius: '6px',
                  padding: '7px 10px',
                  fontSize: '12px',
                  color: '#94a3b8',
                  fontFamily: 'var(--font-mono)',
                }}
              />
              <button onClick={copyWebhookUrl} className="btn btn-secondary" style={{ padding: '7px 12px', fontSize: '12px' }}>
                <Copy size={13} />
                {copied ? 'Copied!' : 'Copy'}
              </button>
            </div>
          </div>

          <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {/* Permanent Access Token */}
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#fff', marginBottom: '5px' }}>
                Permanent System User Access Token (with whatsapp_business_messaging permissions)
              </label>
              <input
                type="password"
                autoComplete="off"
                placeholder={
                  formData.isConfigured
                    ? 'Token already configured — paste a new one only to replace it'
                    : 'EAAG... paste your permanent system-user token'
                }
                value={formData.accessToken}
                onChange={(e) => setFormData({ ...formData, accessToken: e.target.value })}
                style={{
                  width: '100%',
                  background: 'var(--bg-surface)',
                  border: '1px solid var(--border-medium)',
                  borderRadius: 'var(--radius-md)',
                  padding: '9px 12px',
                  color: '#fff',
                  fontSize: '12.5px',
                  fontFamily: 'var(--font-mono)',
                  outline: 'none',
                }}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              {/* WhatsApp Business Account ID */}
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#fff', marginBottom: '5px' }}>
                  WABA ID (Account ID)
                </label>
                <input
                  type="text"
                  placeholder="e.g. 1092837465001"
                  value={formData.wabaId}
                  onChange={(e) => setFormData({ ...formData, wabaId: e.target.value })}
                  style={{
                    width: '100%',
                    background: 'var(--bg-surface)',
                    border: '1px solid var(--border-medium)',
                    borderRadius: 'var(--radius-md)',
                    padding: '9px 12px',
                    color: '#fff',
                    fontSize: '12.5px',
                    outline: 'none',
                  }}
                />
              </div>

              {/* Phone Number ID */}
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#fff', marginBottom: '5px' }}>
                  Phone Number ID
                </label>
                <input
                  type="text"
                  placeholder="e.g. 1092837465999"
                  value={formData.phoneNumberId}
                  onChange={(e) => setFormData({ ...formData, phoneNumberId: e.target.value })}
                  style={{
                    width: '100%',
                    background: 'var(--bg-surface)',
                    border: '1px solid var(--border-medium)',
                    borderRadius: 'var(--radius-md)',
                    padding: '9px 12px',
                    color: '#fff',
                    fontSize: '12.5px',
                    outline: 'none',
                  }}
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              {/* Display Phone Number */}
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#fff', marginBottom: '5px' }}>
                  Display Phone Number
                </label>
                <input
                  type="text"
                  placeholder="Your WhatsApp display number"
                  value={formData.displayPhoneNumber}
                  onChange={(e) => setFormData({ ...formData, displayPhoneNumber: e.target.value })}
                  style={{
                    width: '100%',
                    background: 'var(--bg-surface)',
                    border: '1px solid var(--border-medium)',
                    borderRadius: 'var(--radius-md)',
                    padding: '9px 12px',
                    color: '#fff',
                    fontSize: '12.5px',
                    outline: 'none',
                  }}
                />
              </div>

              {/* Webhook Verification Secret */}
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#fff', marginBottom: '5px' }}>
                  Webhook Verify Token (Secret Handshake)
                </label>
                <input
                  type="text"
                  placeholder="Your webhook verify token"
                  value={formData.webhookVerifyToken}
                  onChange={(e) => setFormData({ ...formData, webhookVerifyToken: e.target.value })}
                  style={{
                    width: '100%',
                    background: 'var(--bg-surface)',
                    border: '1px solid var(--border-medium)',
                    borderRadius: 'var(--radius-md)',
                    padding: '9px 12px',
                    color: '#fff',
                    fontSize: '12.5px',
                    outline: 'none',
                  }}
                />
              </div>
            </div>

            {/* Submit */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
              <button type="button" onClick={onClose} className="btn btn-secondary">
                Cancel
              </button>
              <button type="submit" disabled={saving} className="btn btn-primary">
                {saving ? 'Validating & Saving...' : 'Save Meta Configuration'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
