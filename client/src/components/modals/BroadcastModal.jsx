import React, { useState, useEffect } from 'react';
import {
  Send,
  X,
  Radio,
  Users,
  CheckCircle2,
  AlertCircle,
  Clock,
  Sparkles,
  RefreshCw,
  Plus,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

export default function BroadcastModal({ isOpen, onClose }) {
  const { token, agent } = useAuth();
  const [broadcasts, setBroadcasts] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [contacts, setContacts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [activeView, setActiveView] = useState('list'); // 'list' | 'create'

  // Campaign Form State
  const [campaignName, setCampaignName] = useState('');
  const [selectedTemplateId, setSelectedTemplateId] = useState('');
  const [selectedContactIds, setSelectedContactIds] = useState([]);
  const [contactTags, setContactTags] = useState({}); // contactId -> string[] (union of its chats' tags)
  const [audienceTag, setAudienceTag] = useState('');
  const [variables, setVariables] = useState({});
  const [launching, setLaunching] = useState(false);
  const [feedback, setFeedback] = useState(null);

  useEffect(() => {
    if (!isOpen || !agent) return;
    loadData();
  }, [isOpen, agent, token]);

  // Escape closes the dialog (with the other modals' overlay-click rule).
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [bcRes, tplRes] = await Promise.all([
        fetch('/api/broadcasts', { headers: { Authorization: `Bearer ${token}` } }),
        fetch('/api/templates', { headers: { Authorization: `Bearer ${token}` } }),
      ]);

      const [bcData, tplData] = await Promise.all([bcRes.json(), tplRes.json()]);

      if (bcData.success) setBroadcasts(bcData.broadcasts);
      if (!tplData.success) {
        setFeedback({ type: 'error', text: tplData.error || 'Failed to load templates' });
      } else {
        // Only APPROVED templates can legally be broadcast; offering the
        // rest produced campaigns that failed at send time.
        const approved = (tplData.templates || []).filter((t) => t.status === 'APPROVED');
        setTemplates(approved);
        if (!approved.some((t) => t.id === selectedTemplateId)) {
          setSelectedTemplateId(approved[0]?.id || '');
        }
      }

      // Audience: page through the conversation list (it is capped at 100
      // per request) instead of silently truncating at the first page, and
      // surface failures instead of showing an empty, error-free picker.
      const uniqueContacts = [];
      const seen = new Set();
      let cursor = null;
      let pages = 0;
      let audienceFailed = false;
      do {
        const params = new URLSearchParams({ filter: 'all', status: 'ALL', limit: '100' });
        if (cursor) params.set('cursor', cursor);
        const chatRes = await fetch(`/api/chats?${params.toString()}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const chatData = await chatRes.json();
        if (!chatData.success) {
          audienceFailed = true;
          break;
        }
        (chatData.chats || []).forEach((c) => {
          if (!c.contact) return;
          let chatTags = [];
          try {
            const parsed = c.tags ? JSON.parse(c.tags) : [];
            if (Array.isArray(parsed)) chatTags = parsed;
          } catch (parseError) {}
          if (chatTags.length) {
            setContactTags((prev) => {
              const merged = new Set([...(prev[c.contact.id] || []), ...chatTags]);
              return { ...prev, [c.contact.id]: [...merged] };
            });
          }
          if (!seen.has(c.contact.id)) {
            seen.add(c.contact.id);
            uniqueContacts.push(c.contact);
          }
        });
        cursor = chatData.pagination?.hasMore ? chatData.pagination.nextCursor : null;
        pages += 1;
      } while (cursor && pages < 20);
      if (audienceFailed) {
        setFeedback({ type: 'error', text: 'Failed to load the contact list — the audience may be incomplete. Close and retry.' });
      }
      setContacts(uniqueContacts);
      // Deliberate selection only: a bulk send must never default to
      // "everyone" — one wrong click used to broadcast to all customers.
      setSelectedContactIds((prev) => prev.filter((id) => seen.has(id)));
    } catch (err) {
      console.error('Failed to load broadcast data:', err);
      setFeedback({ type: 'error', text: `Failed to load broadcast data: ${err.message}` });
    } finally {
      setLoading(false);
    }
  };

  const selectedTemplate = templates.find((t) => t.id === selectedTemplateId);

  // Tag-targeted audience: the picker can be narrowed to one tag (tags are
  // managed per chat in the contact sidebar). Selecting stays deliberate —
  // choosing a tag filters the list, it never auto-selects anyone.
  const allAudienceTags = [...new Set(Object.values(contactTags).flat())].sort((a, b) => a.localeCompare(b));
  const visibleContacts = audienceTag
    ? contacts.filter((c) => (contactTags[c.id] || []).includes(audienceTag))
    : contacts;
  const visibleAllSelected =
    visibleContacts.length > 0 && visibleContacts.every((c) => selectedContactIds.includes(c.id));

  // Template placeholders ({{1}}, {{2}}, ...) collected per campaign — the
  // worker used to substitute literal "Sample N" text because this form
  // never asked for values.
  const placeholderIndexes = selectedTemplate
    ? [...new Set([...String(selectedTemplate.bodyText || '').matchAll(/\{\{(\d+)\}\}/g)].map((m) => m[1]))]
    : [];
  const missingVariables = placeholderIndexes.filter(
    (index) => index !== '1' && !(variables[index] || '').trim()
  );
  const renderTemplatePreview = (bodyText) =>
    String(bodyText || '').replace(/\{\{(\d+)\}\}/g, (_, index) => {
      const value = (variables[index] || '').trim();
      if (value) return value;
      return index === '1' ? '<customer name>' : `{{${index}}}`;
    });

  const handleLaunch = async (e) => {
    e.preventDefault();
    if (!campaignName.trim() || !selectedTemplateId) return;
    if (missingVariables.length > 0) {
      setFeedback({
        type: 'error',
        text: `Fill in the template variable${missingVariables.length > 1 ? 's' : ''} ${missingVariables.map((i) => `{{${i}}}`).join(', ')} before launching.`,
      });
      return;
    }

    setLaunching(true);
    setFeedback(null);

    try {
      const res = await fetch('/api/broadcasts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: campaignName.trim(),
          templateId: selectedTemplateId,
          contactIds: selectedContactIds,
          variables,
        }),
      });

      const data = await res.json();
      if (data.success) {
        setFeedback({
          type: 'success',
          text: `🎉 Broadcast queued! ${data.broadcast?.totalCount || selectedContactIds.length} messages will be dispatched in the background.`,
        });
        setCampaignName('');
        await loadData();
        setTimeout(() => {
          setActiveView('list');
          setFeedback(null);
        }, 1800);
      } else {
        setFeedback({
          type: 'error',
          text: data.error || 'Failed to dispatch broadcast',
        });
      }
    } catch (err) {
      setFeedback({ type: 'error', text: err.message });
    } finally {
      setLaunching(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="broadcast-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(5, 8, 15, 0.85)',
        backdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 50,
        padding: '20px',
      }}
    >
      <div
        className="broadcast-dialog"
        role="dialog"
        aria-modal="true"
        aria-label="Broadcast campaigns"
        style={{
          background: 'var(--bg-sidebar)',
          border: '1px solid var(--border-medium)',
          borderRadius: 'var(--radius-xl)',
          width: '800px',
          maxWidth: '100%',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: 'var(--shadow-card)',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '16px 24px',
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
                background: 'rgba(56, 189, 248, 0.15)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#38bdf8',
              }}
            >
              <Radio size={20} />
            </div>
            <div>
              <h2 style={{ fontSize: '16px', fontWeight: '700', color: '#fff' }}>
                WhatsApp Outbound Broadcast Campaigns
              </h2>
              <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                Dispatch pre-approved Meta WhatsApp templates to customer segments
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              onClick={() => setActiveView(activeView === 'list' ? 'create' : 'list')}
              className="btn btn-secondary"
              style={{ fontSize: '12px', padding: '6px 12px' }}
            >
              {activeView === 'list' ? '+ New Campaign' : 'View Campaigns'}
            </button>
            <button onClick={onClose} className="btn btn-ghost" style={{ padding: '6px' }} aria-label="Close broadcasts">
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="broadcast-body" style={{ flex: 1, overflowY: 'auto', padding: '24px' }}>
          {feedback && (
            <div
              style={{
                padding: '12px 16px',
                borderRadius: '8px',
                marginBottom: '16px',
                fontSize: '13px',
                fontWeight: '500',
                background: feedback.type === 'success' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                color: feedback.type === 'success' ? '#34d399' : '#f87171',
                border: `1px solid ${feedback.type === 'success' ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`,
              }}
            >
              {feedback.text}
            </div>
          )}

          {activeView === 'list' ? (
            /* Campaign History List */
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                <span style={{ fontSize: '13px', fontWeight: '600', color: '#fff' }}>
                  Campaign Dispatch History ({broadcasts.length})
                </span>
                <button onClick={loadData} className="btn btn-ghost" style={{ fontSize: '11px', padding: '4px 8px' }}>
                  <RefreshCw size={12} /> Refresh
                </button>
              </div>

              {loading ? (
                <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                  Loading campaigns...
                </div>
              ) : broadcasts.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '50px 20px', color: 'var(--text-muted)' }}>
                  <Radio size={36} style={{ margin: '0 auto 12px auto', opacity: 0.4 }} />
                  <p style={{ fontSize: '14px', color: '#fff', marginBottom: '4px' }}>No campaigns launched yet</p>
                  <p style={{ fontSize: '12px' }}>
                    Click "+ New Campaign" to broadcast an approved WhatsApp template to your leads.
                  </p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {broadcasts.map((bc) => (
                    <div
                      key={bc.id}
                      className="broadcast-card"
                      style={{
                        background: 'var(--bg-surface)',
                        border: '1px solid var(--border-medium)',
                        borderRadius: 'var(--radius-md)',
                        padding: '14px 18px',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                      }}
                    >
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ fontWeight: '700', fontSize: '14px', color: '#fff' }}>{bc.name}</span>
                          <span
                            style={{
                              fontSize: '10.5px',
                              background: 'rgba(56, 189, 248, 0.15)',
                              color: '#38bdf8',
                              padding: '1px 6px',
                              borderRadius: '4px',
                            }}
                          >
                            Template: {bc.template?.name}
                          </span>
                        </div>
                        <div style={{ fontSize: '11.5px', color: 'var(--text-muted)', marginTop: '4px' }}>
                          Launched on {new Date(bc.createdAt).toLocaleDateString('en-IN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </div>

                      {/* Stats Badges */}
                      <div className="broadcast-card-stats" style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                        <div style={{ textAlign: 'center' }}>
                          <div style={{ fontSize: '16px', fontWeight: '700', color: '#fff' }}>{bc.totalCount}</div>
                          <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Total</div>
                        </div>
                        <div style={{ textAlign: 'center' }}>
                          <div style={{ fontSize: '16px', fontWeight: '700', color: '#10b981' }}>{bc.sentCount}</div>
                          <div style={{ fontSize: '10px', color: '#10b981' }}>Sent</div>
                        </div>
                        <div style={{ textAlign: 'center' }}>
                          <div style={{ fontSize: '16px', fontWeight: '700', color: '#f87171' }}>{bc.failedCount}</div>
                          <div style={{ fontSize: '10px', color: '#f87171' }}>Failed</div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            /* Create New Campaign Form */
            <form onSubmit={handleLaunch} style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12.5px', fontWeight: '600', color: '#fff', marginBottom: '6px' }}>
                  Campaign Name
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Festival offer announcement for existing customers"
                  value={campaignName}
                  onChange={(e) => setCampaignName(e.target.value)}
                  style={{
                    width: '100%',
                    background: 'var(--bg-surface)',
                    border: '1px solid var(--border-medium)',
                    borderRadius: 'var(--radius-md)',
                    padding: '8px 12px',
                    color: '#fff',
                    fontSize: '13px',
                    outline: 'none',
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12.5px', fontWeight: '600', color: '#fff', marginBottom: '6px' }}>
                  Choose Approved Meta WhatsApp Template
                </label>
                <select
                  value={selectedTemplateId}
                  onChange={(e) => setSelectedTemplateId(e.target.value)}
                  style={{
                    width: '100%',
                    background: 'var(--bg-surface)',
                    border: '1px solid var(--border-medium)',
                    borderRadius: 'var(--radius-md)',
                    padding: '8px 12px',
                    color: '#fff',
                    fontSize: '13px',
                    outline: 'none',
                  }}
                >
                  {templates.map((tpl) => (
                    <option key={tpl.id} value={tpl.id}>
                      {tpl.name} ({tpl.category} • {tpl.language})
                    </option>
                  ))}
                </select>

                {selectedTemplate && (
                  <div
                    style={{
                      background: 'rgba(0, 0, 0, 0.25)',
                      border: '1px solid var(--border-subtle)',
                      borderRadius: '8px',
                      padding: '10px 14px',
                      marginTop: '8px',
                      fontSize: '12.5px',
                      color: 'var(--text-secondary)',
                      lineHeight: 1.45,
                    }}
                  >
                    <div style={{ fontSize: '11px', color: '#25D366', fontWeight: '600', marginBottom: '4px' }}>
                      Template Message Body Preview:
                    </div>
                    {renderTemplatePreview(selectedTemplate.bodyText)}
                  </div>
                )}

                {placeholderIndexes.length > 0 && (
                  <div style={{ marginTop: '10px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {placeholderIndexes.map((index) => (
                      <div key={index}>
                        <label style={{ display: 'block', fontSize: '11.5px', fontWeight: '600', color: '#fff', marginBottom: '4px' }}>
                          Variable {`{{${index}}}`}
                          {index === '1' ? ' — defaults to each customer’s name when left blank' : ''}
                        </label>
                        <input
                          type="text"
                          value={variables[index] || ''}
                          maxLength={1000}
                          onChange={(e) =>
                            setVariables((prev) => ({ ...prev, [index]: e.target.value }))
                          }
                          placeholder={index === '1' ? "e.g. the customer's name" : `Value for {{${index}}}`}
                          style={{
                            width: '100%',
                            background: 'var(--bg-surface)',
                            border: '1px solid var(--border-medium)',
                            borderRadius: 'var(--radius-md)',
                            padding: '8px 12px',
                            color: '#fff',
                            fontSize: '13px',
                            outline: 'none',
                          }}
                        />
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Target Audience */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <label style={{ fontSize: '12.5px', fontWeight: '600', color: '#fff' }}>
                    Target Contacts ({selectedContactIds.length} of {contacts.length} selected)
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      if (visibleAllSelected) {
                        const visibleIds = new Set(visibleContacts.map((c) => c.id));
                        setSelectedContactIds((prev) => prev.filter((id) => !visibleIds.has(id)));
                      } else {
                        setSelectedContactIds((prev) => [
                          ...new Set([...prev, ...visibleContacts.map((c) => c.id)]),
                        ]);
                      }
                    }}
                    className="btn btn-ghost"
                    style={{ fontSize: '11px', padding: '2px 6px' }}
                  >
                    {visibleAllSelected ? 'Deselect' : 'Select'} {audienceTag ? `"${audienceTag}"` : 'All'}
                  </button>
                </div>

                {allAudienceTags.length > 0 && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                    <span style={{ fontSize: '11.5px', color: 'var(--text-secondary)' }}>Audience tag:</span>
                    <select
                      value={audienceTag}
                      onChange={(e) => setAudienceTag(e.target.value)}
                      style={{
                        background: 'var(--bg-surface)',
                        color: '#fff',
                        border: '1px solid var(--border-medium)',
                        borderRadius: '6px',
                        padding: '5px 8px',
                        fontSize: '12px',
                        outline: 'none',
                      }}
                    >
                      <option value="">All contacts ({contacts.length})</option>
                      {allAudienceTags.map((tag) => (
                        <option key={tag} value={tag}>
                          {tag} ({contacts.filter((c) => (contactTags[c.id] || []).includes(tag)).length})
                        </option>
                      ))}
                    </select>
                    {audienceTag && (
                      <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                        Showing {visibleContacts.length} tagged contact{visibleContacts.length === 1 ? '' : 's'}
                      </span>
                    )}
                  </div>
                )}

                <div
                  style={{
                    maxHeight: '130px',
                    overflowY: 'auto',
                    border: '1px solid var(--border-medium)',
                    borderRadius: 'var(--radius-md)',
                    padding: '8px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '4px',
                    background: 'var(--bg-surface)',
                  }}
                >
                  {visibleContacts.map((contact) => (
                    <label
                      key={contact.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        fontSize: '12px',
                        color: '#fff',
                        cursor: 'pointer',
                        padding: '4px 6px',
                        borderRadius: '4px',
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={selectedContactIds.includes(contact.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedContactIds((prev) => [...prev, contact.id]);
                          } else {
                            setSelectedContactIds((prev) => prev.filter((id) => id !== contact.id));
                          }
                        }}
                      />
                      <span>
                        {contact.name || 'Customer'} (+{contact.waId})
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Submit Button */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
                <button
                  type="button"
                  onClick={() => setActiveView('list')}
                  className="btn btn-secondary"
                  style={{ padding: '8px 16px', fontSize: '12.5px' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={launching || selectedContactIds.length === 0 || missingVariables.length > 0}
                  className="btn btn-primary"
                  style={{ padding: '8px 20px', fontSize: '12.5px', gap: '6px' }}
                >
                  <Send size={14} />
                  <span>{launching ? 'Launching Broadcast...' : 'Launch Broadcast Campaign'}</span>
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
