import React, { useState, useEffect } from 'react';
import { Sparkles, X, CheckCheck, Send, RefreshCw } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useChat } from '../../context/ChatContext';

export default function TemplateModal({ isOpen, onClose }) {
  const { token } = useAuth();
  const { activeChat } = useChat();

  const [templates, setTemplates] = useState([]);
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [variables, setVariables] = useState({});
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState(null);

  useEffect(() => {
    if (!isOpen || !token) return;
    async function loadTemplates() {
      setLoading(true);
      try {
        const res = await fetch('/api/templates', {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        if (data.success && data.templates.length > 0) {
          setTemplates(data.templates);
          setSelectedTemplate(data.templates[0]);
          initVariables(data.templates[0]);
        }
      } catch (err) {
        console.error('Failed to load templates:', err);
      } finally {
        setLoading(false);
      }
    }
    loadTemplates();
  }, [isOpen, token]);

  const initVariables = (tpl) => {
    let defaults = {};
    if (tpl.exampleVariables) {
      try {
        const arr = JSON.parse(tpl.exampleVariables);
        arr.forEach((val, idx) => {
          defaults[idx + 1] = val;
        });
      } catch (e) {}
    }
    // Prefill customer name if variable 1
    if (activeChat?.contact?.name) {
      defaults[1] = activeChat.contact.name;
    }
    setVariables(defaults);
  };

  const handleSelectTemplate = (tpl) => {
    setSelectedTemplate(tpl);
    initVariables(tpl);
  };

  const handleVariableChange = (num, val) => {
    setVariables((prev) => ({ ...prev, [num]: val }));
  };

  // Render preview with interpolated variables
  const getRenderedPreview = () => {
    if (!selectedTemplate) return '';
    let text = selectedTemplate.bodyText;
    Object.keys(variables).forEach((key) => {
      text = text.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), variables[key] || `{{${key}}}`);
    });
    return text;
  };

  const handleSend = async () => {
    if (!activeChat || !selectedTemplate) return;
    setSending(true);
    setMessage(null);

    try {
      const res = await fetch('/api/templates/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          chatId: activeChat.id,
          templateId: selectedTemplate.id,
          variables,
        }),
      });

      const data = await res.json();
      if (data.success) {
        setMessage({ type: 'success', text: 'WhatsApp template delivered successfully!' });
        setTimeout(() => {
          onClose();
        }, 1200);
      } else {
        setMessage({ type: 'error', text: data.error || 'Failed to dispatch template' });
      }
    } catch (err) {
      setMessage({ type: 'error', text: err.message });
    } finally {
      setSending(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay">
      <div className="modal-content" style={{ maxWidth: '780px' }}>
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
              <Sparkles size={20} />
            </div>
            <div>
              <h3 style={{ fontSize: '16px', color: '#fff' }}>Meta Approved WhatsApp Templates</h3>
              <p style={{ fontSize: '11.5px', color: 'var(--text-secondary)' }}>
                Select pre-approved template & interpolate custom variables for +{activeChat?.contact?.waId}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="btn btn-ghost" style={{ padding: '6px' }}>
            <X size={18} />
          </button>
        </div>

        {/* Content Body: Split view (Template selector + Live Preview) */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', minHeight: '380px' }}>
          {/* Left: Template Selector & Variables */}
          <div style={{ padding: '20px', borderRight: '1px solid var(--border-subtle)' }}>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#fff', marginBottom: '8px' }}>
              Select Approved Meta Template
            </label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '16px' }}>
              {templates.map((tpl) => (
                <button
                  key={tpl.id}
                  onClick={() => handleSelectTemplate(tpl)}
                  style={{
                    padding: '10px 12px',
                    borderRadius: '8px',
                    textAlign: 'left',
                    background: selectedTemplate?.id === tpl.id ? 'var(--bg-surface-active)' : 'var(--bg-surface)',
                    border: `1px solid ${selectedTemplate?.id === tpl.id ? 'var(--wa-primary)' : 'var(--border-subtle)'}`,
                    color: '#fff',
                    cursor: 'pointer',
                    transition: 'all 0.15s',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontWeight: '600', fontSize: '13px' }}>{tpl.name}</span>
                    <span
                      style={{
                        fontSize: '9.5px',
                        background: 'rgba(16, 185, 129, 0.15)',
                        color: '#34d399',
                        padding: '1px 5px',
                        borderRadius: '3px',
                      }}
                    >
                      {tpl.category}
                    </span>
                  </div>
                  <div
                    style={{
                      fontSize: '11px',
                      color: 'var(--text-muted)',
                      marginTop: '4px',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {tpl.bodyText}
                  </div>
                </button>
              ))}
            </div>

            {/* Dynamic Variable Inputs */}
            {selectedTemplate && (
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#fff', marginBottom: '8px' }}>
                  Dynamic Variable Fields
                </label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {Object.keys(variables).map((key) => (
                    <div key={key}>
                      <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Variable {`{{${key}}}`}</span>
                      <input
                        type="text"
                        value={variables[key]}
                        onChange={(e) => handleVariableChange(key, e.target.value)}
                        placeholder={`Value for {{${key}}}`}
                        style={{
                          width: '100%',
                          background: 'var(--bg-surface)',
                          border: '1px solid var(--border-medium)',
                          borderRadius: '6px',
                          padding: '6px 10px',
                          color: '#fff',
                          fontSize: '12px',
                          outline: 'none',
                          marginTop: '2px',
                        }}
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Right: Authentic WhatsApp Live Preview */}
          <div
            style={{
              padding: '20px',
              background: '#090d16',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
            }}
          >
            <div>
              <div style={{ fontSize: '11.5px', fontWeight: '600', color: 'var(--text-muted)', marginBottom: '12px' }}>
                WHATSAPP CLIENT LIVE PREVIEW
              </div>

              {/* Mock WhatsApp Chat Bubble */}
              {selectedTemplate && (
                <div
                  style={{
                    background: '#182236',
                    borderRadius: '12px',
                    padding: '14px',
                    border: '1px solid var(--border-subtle)',
                    boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
                    maxWidth: '320px',
                  }}
                >
                  {selectedTemplate.headerContent && (
                    <div style={{ fontWeight: '700', fontSize: '13px', color: '#fff', marginBottom: '6px' }}>
                      {selectedTemplate.headerContent}
                    </div>
                  )}

                  <div style={{ fontSize: '13px', color: '#e2e8f0', whiteSpace: 'pre-wrap', lineHeight: 1.45 }}>
                    {getRenderedPreview()}
                  </div>

                  {selectedTemplate.footerText && (
                    <div style={{ fontSize: '10.5px', color: 'var(--text-muted)', marginTop: '8px' }}>
                      {selectedTemplate.footerText}
                    </div>
                  )}

                  {/* WhatsApp Quick Reply / Call to Action Buttons */}
                  {selectedTemplate.buttons && (
                    <div
                      style={{
                        borderTop: '1px solid rgba(255,255,255,0.08)',
                        marginTop: '10px',
                        paddingTop: '8px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '6px',
                      }}
                    >
                      {JSON.parse(selectedTemplate.buttons).map((btn, idx) => (
                        <div
                          key={idx}
                          style={{
                            textAlign: 'center',
                            fontSize: '12px',
                            color: '#38bdf8',
                            fontWeight: '600',
                            padding: '4px',
                            background: 'rgba(56, 189, 248, 0.08)',
                            borderRadius: '6px',
                          }}
                        >
                          {btn.text}
                        </div>
                      ))}
                    </div>
                  )}

                  <div
                    style={{
                      textAlign: 'right',
                      fontSize: '10px',
                      color: 'var(--text-muted)',
                      marginTop: '6px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'flex-end',
                      gap: '4px',
                    }}
                  >
                    <span>Now</span>
                    <CheckCheck size={12} style={{ color: 'var(--wa-blue-tick)' }} />
                  </div>
                </div>
              )}
            </div>

            {/* Bottom Actions */}
            <div style={{ marginTop: '20px' }}>
              {message && (
                <div
                  style={{
                    padding: '8px 12px',
                    borderRadius: '6px',
                    marginBottom: '10px',
                    fontSize: '12px',
                    background: message.type === 'success' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                    color: message.type === 'success' ? '#34d399' : '#fca5a5',
                  }}
                >
                  {message.text}
                </div>
              )}

              <button
                onClick={handleSend}
                disabled={sending}
                className="btn btn-primary"
                style={{ width: '100%', padding: '10px', fontSize: '13px' }}
              >
                <Send size={15} />
                {sending ? 'Dispatching via Meta API...' : 'Dispatch Template Message'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
