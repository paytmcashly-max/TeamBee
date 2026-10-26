import React, { useState, useEffect } from 'react';
import { Sparkles, X, CheckCheck, Send, RefreshCw, Plus } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useChat } from '../../context/ChatContext';

function getVariableIndexes(bodyText = '') {
  return [...new Set(
    [...String(bodyText).matchAll(/\{\{(\d+)\}\}/g)].map((match) => Number(match[1]))
  )].sort((a, b) => a - b);
}

function parseTemplateButtons(value) {
  if (!value) return [];
  try {
    const parsed = typeof value === 'string' ? JSON.parse(value) : value;
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export default function TemplateModal({ isOpen, onClose }) {
  const { token, agent } = useAuth();
  const { activeChat, replyingTo, setReplyingTo } = useChat();

  const [templates, setTemplates] = useState([]);
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [variables, setVariables] = useState({});
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState(null);
  const [syncing, setSyncing] = useState(false);

  // Create-template form (ADMIN): submits to Meta for review via the
  // backend; approval itself is Meta's decision.
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createForm, setCreateForm] = useState({
    name: '',
    language: 'en_US',
    category: 'UTILITY',
    headerText: '',
    bodyText: '',
    footerText: '',
    qr1: '',
    qr2: '',
    urlText: '',
    urlValue: '',
  });
  const [createExamples, setCreateExamples] = useState({});
  const setField = (key, value) => setCreateForm((prev) => ({ ...prev, [key]: value }));

  const handleCreate = async () => {
    setCreating(true);
    setMessage(null);
    try {
      const varIdx = getVariableIndexes(createForm.bodyText);
      const res = await fetch('/api/templates', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: createForm.name.trim(),
          language: createForm.language,
          category: createForm.category,
          bodyText: createForm.bodyText,
          bodyExamples: varIdx.map((n) => createExamples[n] || ''),
          headerText: createForm.headerText,
          footerText: createForm.footerText,
          quickReplies: [createForm.qr1, createForm.qr2].filter((t) => t.trim()),
          urlButton:
            createForm.urlText.trim() && createForm.urlValue.trim()
              ? { text: createForm.urlText, url: createForm.urlValue }
              : null,
        }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Template creation failed');
      setMessage({
        type: 'success',
        text: `Template "${data.template.name}" submitted to Meta — status: ${data.template.status}. Approval is Meta's decision; it will appear in this list, and Sync refreshes its status.`,
      });
      setShowCreate(false);
      setCreateForm({
        name: '',
        language: 'en_US',
        category: 'UTILITY',
        headerText: '',
        bodyText: '',
        footerText: '',
        qr1: '',
        qr2: '',
        urlText: '',
        urlValue: '',
      });
      setCreateExamples({});
      await loadTemplates();
    } catch (err) {
      setMessage({ type: 'error', text: err.message });
    } finally {
      setCreating(false);
    }
  };

  const loadTemplates = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/templates', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success) {
        setTemplates(data.templates);
        if (data.templates.length > 0) {
          setSelectedTemplate(data.templates[0]);
          initVariables(data.templates[0]);
        } else {
          setSelectedTemplate(null);
        }
      }
    } catch (err) {
      console.error('Failed to load templates:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!isOpen || !agent) return;
    loadTemplates();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, agent, token]);

  const handleSync = async () => {
    setSyncing(true);
    setMessage(null);
    try {
      const res = await fetch('/api/templates/sync', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!data.success) {
        throw new Error(data.error || 'Sync failed');
      }
      setMessage({
        type: 'success',
        text: `Synced ${data.count} template${data.count === 1 ? '' : 's'} from Meta${data.removed ? `, removed ${data.removed} outdated` : ''}.`,
      });
      await loadTemplates();
    } catch (err) {
      setMessage({ type: 'error', text: `Template sync failed: ${err.message}` });
    } finally {
      setSyncing(false);
    }
  };

  const initVariables = (tpl) => {
    let defaults = {};
    const variableIndexes = getVariableIndexes(tpl.bodyText || '');
    if (variableIndexes.length > 0) {
      if (tpl.exampleVariables) {
        try {
          const arr = JSON.parse(tpl.exampleVariables);
          arr.forEach((val, idx) => {
            if (variableIndexes.includes(idx + 1)) defaults[idx + 1] = val;
          });
        } catch (e) {}
      }
      for (const i of variableIndexes) {
        if (!defaults[i]) {
          defaults[i] = i === 1 && activeChat?.contact?.name ? activeChat.contact.name : `Value ${i}`;
        }
      }
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
    // bodyText can be NULL (Meta returns no body for some templates) — the
    // old code crashed the whole app on .replace. A function replacer also
    // stops "$&"/"$1" sequences in values from garbling the preview.
    let text = selectedTemplate.bodyText || '';
    Object.keys(variables).forEach((key) => {
      text = text.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), () => variables[key] || `{{${key}}}`);
    });
    return text;
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
          ...(replyingTo && replyingTo.chatId === activeChat.id
            ? { replyToMessageId: replyingTo.messageId }
            : {}),
        }),
      });

      const data = await res.json();
      if (data.success) {
        if (replyingTo && replyingTo.chatId === activeChat.id) setReplyingTo(null);
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
    <div
      className="modal-overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="modal-content" role="dialog" aria-modal="true" aria-label="WhatsApp templates" style={{ maxWidth: '780px' }}>
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
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            {agent?.role === 'ADMIN' && (
              <button
                onClick={handleSync}
                disabled={syncing}
                className="btn btn-secondary"
                style={{ padding: '6px 10px', fontSize: '11.5px', gap: '6px' }}
                title="Fetch the latest approved templates from Meta and remove outdated ones"
              >
                <RefreshCw size={13} className={syncing ? 'spin' : ''} />
                {syncing ? 'Syncing...' : 'Sync from Meta'}
              </button>
            )}
            {agent?.role === 'ADMIN' && (
              <button
                onClick={() => setShowCreate((v) => !v)}
                className="btn btn-secondary"
                style={{ padding: '6px 10px', fontSize: '11.5px', gap: '6px' }}
                title="Create a new template and submit it to Meta for approval"
              >
                <Plus size={13} />
                New Template
              </button>
            )}
            <button onClick={onClose} className="btn btn-ghost" style={{ padding: '6px' }} aria-label="Close templates">
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Create Template (ADMIN): submits to Meta for review */}
        {showCreate && agent?.role === 'ADMIN' && (
          <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-subtle)', background: 'rgba(37, 211, 102, 0.04)' }}>
            <div style={{ fontSize: '13px', fontWeight: 600, color: '#fff', marginBottom: '4px' }}>Create a new template</div>
            <p style={{ fontSize: '11.5px', color: 'var(--text-secondary)', marginBottom: '12px', lineHeight: 1.5 }}>
              This is submitted to Meta for review — approval is Meta's decision and can take minutes to hours.
              Utility templates (reminders, confirmations) are reviewed lighter and cost less than Marketing ones.
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '10px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px' }}>Template name *</label>
                <input
                  value={createForm.name}
                  onChange={(e) => setField('name', e.target.value)}
                  placeholder="demo_class_reminder"
                  style={{ width: '100%', background: 'var(--bg-input)', border: '1px solid var(--border-medium)', borderRadius: '8px', color: '#fff', padding: '8px 10px', fontSize: '13px', outline: 'none', fontFamily: 'var(--font-mono)' }}
                />
                <div style={{ fontSize: '10.5px', color: 'var(--text-muted)', marginTop: '3px' }}>Lowercase, numbers, underscores only</div>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px' }}>Language</label>
                <select
                  value={createForm.language}
                  onChange={(e) => setField('language', e.target.value)}
                  style={{ width: '100%', background: 'var(--bg-input)', border: '1px solid var(--border-medium)', borderRadius: '8px', color: '#fff', padding: '8px 10px', fontSize: '13px', outline: 'none' }}
                >
                  <option value="en_US">English (en_US)</option>
                  <option value="en">English (en)</option>
                  <option value="hi">Hindi (hi)</option>
                </select>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px' }}>Category</label>
                <select
                  value={createForm.category}
                  onChange={(e) => setField('category', e.target.value)}
                  style={{ width: '100%', background: 'var(--bg-input)', border: '1px solid var(--border-medium)', borderRadius: '8px', color: '#fff', padding: '8px 10px', fontSize: '13px', outline: 'none' }}
                >
                  <option value="UTILITY">Utility — reminder / confirmation</option>
                  <option value="MARKETING">Marketing — offer / promotion</option>
                  <option value="AUTHENTICATION">Authentication — OTP</option>
                </select>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px' }}>Header text (optional)</label>
                <input
                  value={createForm.headerText}
                  onChange={(e) => setField('headerText', e.target.value)}
                  placeholder="e.g. Class Reminder"
                  maxLength={60}
                  style={{ width: '100%', background: 'var(--bg-input)', border: '1px solid var(--border-medium)', borderRadius: '8px', color: '#fff', padding: '8px 10px', fontSize: '13px', outline: 'none' }}
                />
              </div>
            </div>
            <div style={{ marginTop: '10px' }}>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px' }}>Message body *</label>
              <textarea
                value={createForm.bodyText}
                onChange={(e) => setField('bodyText', e.target.value)}
                placeholder={'Hello {{1}}, your demo class is scheduled on {{2}} at {{3}}. Please reply to confirm.'}
                rows={4}
                maxLength={1024}
                style={{ width: '100%', background: 'var(--bg-input)', border: '1px solid var(--border-medium)', borderRadius: '8px', color: '#fff', padding: '8px 10px', fontSize: '13px', outline: 'none', resize: 'vertical', lineHeight: 1.5 }}
              />
              <div style={{ fontSize: '10.5px', color: 'var(--text-muted)', marginTop: '3px' }}>
                Use {'{{1}}'}, {'{{2}}'}… for values that change per customer — keep them in order.
              </div>
            </div>
            {getVariableIndexes(createForm.bodyText).length > 0 && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '10px', marginTop: '10px' }}>
                {getVariableIndexes(createForm.bodyText).map((n) => (
                  <div key={n}>
                    <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px' }}>
                      Example for {'{{' + n + '}}'} *
                    </label>
                    <input
                      value={createExamples[n] || ''}
                      onChange={(e) => setCreateExamples((prev) => ({ ...prev, [n]: e.target.value }))}
                      placeholder={n === 1 ? 'e.g. Aarav' : 'e.g. value'}
                      style={{ width: '100%', background: 'var(--bg-input)', border: '1px solid var(--border-medium)', borderRadius: '8px', color: '#fff', padding: '8px 10px', fontSize: '13px', outline: 'none' }}
                    />
                  </div>
                ))}
              </div>
            )}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '10px', marginTop: '10px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px' }}>Footer text (optional)</label>
                <input
                  value={createForm.footerText}
                  onChange={(e) => setField('footerText', e.target.value)}
                  placeholder="e.g. Apex EduCare Academy"
                  maxLength={60}
                  style={{ width: '100%', background: 'var(--bg-input)', border: '1px solid var(--border-medium)', borderRadius: '8px', color: '#fff', padding: '8px 10px', fontSize: '13px', outline: 'none' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px' }}>Quick-reply button 1 (optional)</label>
                <input
                  value={createForm.qr1}
                  onChange={(e) => setField('qr1', e.target.value)}
                  placeholder="e.g. Confirm"
                  maxLength={25}
                  style={{ width: '100%', background: 'var(--bg-input)', border: '1px solid var(--border-medium)', borderRadius: '8px', color: '#fff', padding: '8px 10px', fontSize: '13px', outline: 'none' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px' }}>Quick-reply button 2 (optional)</label>
                <input
                  value={createForm.qr2}
                  onChange={(e) => setField('qr2', e.target.value)}
                  placeholder="e.g. Reschedule"
                  maxLength={25}
                  style={{ width: '100%', background: 'var(--bg-input)', border: '1px solid var(--border-medium)', borderRadius: '8px', color: '#fff', padding: '8px 10px', fontSize: '13px', outline: 'none' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px' }}>Website button text (optional)</label>
                <input
                  value={createForm.urlText}
                  onChange={(e) => setField('urlText', e.target.value)}
                  placeholder="e.g. Visit Website"
                  maxLength={25}
                  style={{ width: '100%', background: 'var(--bg-input)', border: '1px solid var(--border-medium)', borderRadius: '8px', color: '#fff', padding: '8px 10px', fontSize: '13px', outline: 'none' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px' }}>Website URL</label>
                <input
                  value={createForm.urlValue}
                  onChange={(e) => setField('urlValue', e.target.value)}
                  placeholder="https://…"
                  style={{ width: '100%', background: 'var(--bg-input)', border: '1px solid var(--border-medium)', borderRadius: '8px', color: '#fff', padding: '8px 10px', fontSize: '13px', outline: 'none' }}
                />
              </div>
            </div>
            <div style={{ display: 'flex', gap: '8px', marginTop: '14px', flexWrap: 'wrap' }}>
              <button
                onClick={handleCreate}
                disabled={creating || !createForm.name.trim() || !createForm.bodyText.trim()}
                className="btn btn-primary"
                style={{ padding: '9px 16px', fontSize: '12.5px' }}
              >
                {creating ? 'Submitting…' : 'Submit for Meta review'}
              </button>
              <button onClick={() => setShowCreate(false)} className="btn btn-ghost" style={{ padding: '9px 12px', fontSize: '12.5px' }}>
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Content Body: Responsive Split view (Template selector + Live Preview) */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', minHeight: '380px' }}>
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
                    <span
                      style={{
                        fontSize: '9.5px',
                        background: tpl.status === 'APPROVED' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(245, 158, 11, 0.15)',
                        color: tpl.status === 'APPROVED' ? '#34d399' : '#fbbf24',
                        padding: '1px 5px',
                        borderRadius: '3px',
                      }}
                    >
                      {tpl.status}
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
                    {tpl.bodyText || '(no body text)'}
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
                {Object.keys(variables).length > 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {Object.keys(variables).map((key) => (
                      <div key={key}>
                        <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Variable {`{{${key}}}`}</span>
                        <input
                          type="text"
                          value={variables[key]}
                          maxLength={1000}
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
                ) : (
                  <div style={{ fontSize: '12px', color: 'var(--text-secondary)', background: 'var(--bg-surface)', padding: '10px', borderRadius: '6px', border: '1px solid var(--border-subtle)' }}>
                    ✅ This template uses standard pre-approved wording and requires no variable inputs.
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Right: Authentic WhatsApp Live Preview */}
          <div
            style={{
              padding: '20px',
              background: 'var(--bg-app)',
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
                  {parseTemplateButtons(selectedTemplate.buttons).map((btn, idx) => (
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
                disabled={sending || !selectedTemplate || selectedTemplate.status !== 'APPROVED'}
                className="btn btn-primary"
                style={{ width: '100%', padding: '10px', fontSize: '13px' }}
              >
                <Send size={15} />
                {sending ? 'Dispatching via Meta API...' : 'Dispatch Template Message'}
              </button>
              {selectedTemplate && selectedTemplate.status !== 'APPROVED' && (
                <div style={{ fontSize: '11px', color: '#fbbf24', marginTop: '8px' }}>
                  This template is {selectedTemplate.status} on Meta and cannot be sent. Sync from Meta or choose an approved template.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
