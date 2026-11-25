import React, { useState, useEffect } from 'react';
import { X, RefreshCw, Search, AlertTriangle, Check } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useChat } from '../../context/ChatContext';
import { apiFetch } from '../../services/apiClient';
import {
  getVariableIndexes,
  parseTemplateButtons,
  buildDefaultVariables,
  renderTemplateBody,
} from '../../utils/templateHelpers';

export default function TemplateModal({ isOpen, onClose }) {
  const { agent, tenant, isAdmin } = useAuth();
  const { activeChat, messagingWindow } = useChat();

  const [templates, setTemplates] = useState([]);
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [variables, setVariables] = useState({});
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [sending, setSending] = useState(false);
  const [feedback, setFeedback] = useState(null);

  useEffect(() => {
    if (!isOpen || !agent) return;
    let active = true;

    async function loadTemplates() {
      setLoading(true);
      setFeedback(null);
      try {
        const data = await apiFetch('/api/templates');
        if (!active) return;
        const list = (data.templates || []).filter((t) => t.status === 'APPROVED');
        setTemplates(list);
        if (list.length > 0) {
          setSelectedTemplate(list[0]);
          setVariables(buildDefaultVariables(list[0], activeChat?.contact?.name));
        } else {
          setSelectedTemplate(null);
          setVariables({});
        }
      } catch (err) {
        if (active) setFeedback({ type: 'error', text: err.message });
      } finally {
        if (active) setLoading(false);
      }
    }

    loadTemplates();
    return () => {
      active = false;
    };
  }, [isOpen, agent, activeChat?.contact?.name]);

  if (!isOpen) return null;

  const handleSelectTemplate = (tpl) => {
    setSelectedTemplate(tpl);
    setVariables(buildDefaultVariables(tpl, activeChat?.contact?.name));
    setFeedback(null);
  };

  const handleSync = async () => {
    setSyncing(true);
    setFeedback(null);
    try {
      const data = await apiFetch('/api/templates/sync', { method: 'POST' });
      const approved = (data.templates || []).filter((t) => t.status === 'APPROVED');
      setTemplates(approved);
      if (approved.length > 0 && !selectedTemplate) {
        handleSelectTemplate(approved[0]);
      }
      setFeedback({ type: 'success', text: `Synced ${data.count || approved.length} templates from Meta.` });
    } catch (err) {
      setFeedback({ type: 'error', text: err.message });
    } finally {
      setSyncing(false);
    }
  };

  const handleSend = async () => {
    if (!activeChat || !selectedTemplate) return;
    setSending(true);
    setFeedback(null);
    try {
      await apiFetch('/api/templates/send', {
        method: 'POST',
        body: JSON.stringify({
          chatId: activeChat.id,
          templateId: selectedTemplate.id,
          variables,
        }),
      });
      onClose();
    } catch (err) {
      setFeedback({ type: 'error', text: err.message });
    } finally {
      setSending(false);
    }
  };

  const filteredTemplates = templates.filter((tpl) =>
    `${tpl.name} ${tpl.category} ${tpl.bodyText}`.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const contactName = activeChat?.contact?.name || 'customer';
  const contactPhone = activeChat?.contact?.waId ? `+${activeChat.contact.waId}` : '';
  const isExpired = Boolean(activeChat && messagingWindow && !messagingWindow.isOpen);
  const variableIndexes = selectedTemplate ? getVariableIndexes(selectedTemplate.bodyText) : [];
  const ctaButtons = selectedTemplate ? parseTemplateButtons(selectedTemplate.buttons) : [];

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-content"
        style={{ maxWidth: '860px', overflow: 'hidden' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header-bar">
          <div>
            <h3 className="modal-header-title">Send an approved template</h3>
            <p className="modal-header-subtitle">
              {activeChat
                ? `Re-engage ${contactName}${contactPhone ? ` · ${contactPhone}` : ''}`
                : 'Select an active chat in Inbox before dispatching a template.'}
            </p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {isAdmin && (
              <button
                type="button"
                className="btn btn-secondary"
                onClick={handleSync}
                disabled={syncing}
                style={{ padding: '6px 11px', fontSize: '12px' }}
              >
                <RefreshCw size={13} className={syncing ? 'animate-spin' : ''} />
                <span>{syncing ? 'Syncing...' : 'Sync Meta'}</span>
              </button>
            )}
            <button type="button" onClick={onClose} className="btn btn-ghost" style={{ padding: '6px' }}>
              <X size={18} />
            </button>
          </div>
        </div>

        {isExpired && (
          <div style={{ padding: '14px 22px 0 22px' }}>
            <div className="tb-alert warning">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <AlertTriangle size={16} />
                <div>
                  <div style={{ fontWeight: 600 }}>Customer care window expired</div>
                  <div style={{ fontSize: '11.5px', fontWeight: 400 }}>
                    {contactName} must reply to your template before you can send free-form messages again.
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {feedback && (
          <div style={{ padding: '12px 22px 0 22px' }}>
            <div className={`tb-alert ${feedback.type}`}>{feedback.text}</div>
          </div>
        )}

        <div className="template-modal-grid">
          <div className="template-modal-list">
            <span className="details-section-label">APPROVED TEMPLATES</span>
            <div style={{ position: 'relative' }}>
              <Search
                size={14}
                style={{ position: 'absolute', left: '10px', top: '10px', color: 'var(--tb-text-secondary)' }}
              />
              <input
                type="text"
                className="tb-input"
                placeholder="Search templates..."
                style={{ paddingLeft: '30px', fontSize: '12.5px' }}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>

            {loading ? (
              <div className="tb-hint" style={{ padding: '16px 0' }}>Loading templates...</div>
            ) : filteredTemplates.length === 0 ? (
              <div className="tb-hint" style={{ padding: '16px 0' }}>No matching approved templates found.</div>
            ) : (
              filteredTemplates.map((tpl) => (
                <button
                  key={tpl.id}
                  type="button"
                  onClick={() => handleSelectTemplate(tpl)}
                  className={`template-list-card ${selectedTemplate?.id === tpl.id ? 'selected' : ''}`}
                >
                  <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--tb-text-primary)' }}>
                    {tpl.name}
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--tb-text-secondary)', marginTop: '2px' }}>
                    {tpl.category} · {tpl.language}
                  </div>
                  <div
                    style={{
                      fontSize: '11.5px',
                      color: 'var(--tb-text-secondary)',
                      marginTop: '6px',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {tpl.bodyText}
                  </div>
                </button>
              ))
            )}

            <div className="tb-hint" style={{ marginTop: 'auto', paddingTop: '6px' }}>
              <Check size={12} style={{ verticalAlign: '-2px', marginRight: '4px', color: 'var(--tb-primary-green)' }} />
              Only Meta-approved templates appear here.
            </div>
          </div>

          <div className="template-modal-detail">
            {selectedTemplate ? (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <h4 style={{ fontSize: '15px', fontWeight: 600, color: 'var(--tb-text-primary)' }}>
                      Personalize your message
                    </h4>
                    <span className="tb-hint">
                      Language: {selectedTemplate.language}
                    </span>
                  </div>
                  <span className="page-pill-badge">✓ Approved</span>
                </div>

                {variableIndexes.length > 0 && (
                  <div className="tb-form-grid-2">
                    {variableIndexes.map((idx) => (
                      <div key={idx} className="tb-field">
                        <label className="tb-label">Variable · {`{{${idx}}}`}</label>
                        <input
                          type="text"
                          className="tb-input"
                          value={variables[idx] || ''}
                          onChange={(e) => setVariables((prev) => ({ ...prev, [idx]: e.target.value }))}
                          placeholder={`Value for {{${idx}}}`}
                        />
                      </div>
                    ))}
                  </div>
                )}

                <div>
                  <div className="details-section-label" style={{ marginBottom: '8px' }}>
                    MESSAGE PREVIEW
                  </div>
                  <div className="wa-preview-surface">
                    <div className="wa-preview-bubble">
                      {selectedTemplate.headerContent && (
                        <div className="wa-preview-header">{selectedTemplate.headerContent}</div>
                      )}
                      <div className="wa-preview-body">
                        {renderTemplateBody(selectedTemplate.bodyText, variables)}
                      </div>
                      <div className="wa-preview-footer">
                        <span>{selectedTemplate.footerText || `${tenant?.name || 'TeamBee'} · Preview`}</span>
                      </div>
                    </div>
                    {ctaButtons.map((btn, i) => (
                      <div key={i} className="wa-preview-cta">
                        ↗ {typeof btn === 'string' ? btn : btn.text || btn.title}
                      </div>
                    ))}
                  </div>
                </div>
              </>
            ) : (
              <div className="tb-hint" style={{ margin: 'auto' }}>
                Choose a template on the left to personalize variables and preview.
              </div>
            )}
          </div>
        </div>

        <div className="modal-footer-bar">
          <span className="tb-hint">
            {selectedTemplate ? `${selectedTemplate.category} template · 1 recipient` : 'No template selected'}
          </span>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button
              type="button"
              className="btn btn-primary"
              disabled={!activeChat || !selectedTemplate || sending}
              onClick={handleSend}
            >
              <span>{sending ? 'Sending...' : 'Send template ↗'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
