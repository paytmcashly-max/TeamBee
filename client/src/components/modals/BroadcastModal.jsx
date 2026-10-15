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
  const { token } = useAuth();
  const [broadcasts, setBroadcasts] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [contacts, setContacts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [activeView, setActiveView] = useState('list'); // 'list' | 'create'

  // Campaign Form State
  const [campaignName, setCampaignName] = useState('');
  const [selectedTemplateId, setSelectedTemplateId] = useState('');
  const [selectedContactIds, setSelectedContactIds] = useState([]);
  const [variables, setVariables] = useState({});
  const [launching, setLaunching] = useState(false);
  const [feedback, setFeedback] = useState(null);

  useEffect(() => {
    if (!isOpen || !token) return;
    loadData();
  }, [isOpen, token]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [bcRes, tplRes, chatRes] = await Promise.all([
        fetch('/api/broadcasts', { headers: { Authorization: `Bearer ${token}` } }),
        fetch('/api/templates', { headers: { Authorization: `Bearer ${token}` } }),
        fetch('/api/chats?filter=all', { headers: { Authorization: `Bearer ${token}` } }),
      ]);

      const [bcData, tplData, chatData] = await Promise.all([
        bcRes.json(),
        tplRes.json(),
        chatRes.json(),
      ]);

      if (bcData.success) setBroadcasts(bcData.broadcasts);
      if (tplData.success && tplData.templates.length > 0) {
        setTemplates(tplData.templates);
        if (!selectedTemplateId) {
          setSelectedTemplateId(tplData.templates[0].id);
        }
      }
      if (chatData.success) {
        const uniqueContacts = [];
        const seen = new Set();
        (chatData.chats || []).forEach((c) => {
          if (c.contact && !seen.has(c.contact.id)) {
            seen.add(c.contact.id);
            uniqueContacts.push(c.contact);
          }
        });
        setContacts(uniqueContacts);
        // Default select all contacts
        setSelectedContactIds(uniqueContacts.map((c) => c.id));
      }
    } catch (err) {
      console.error('Failed to load broadcast data:', err);
    } finally {
      setLoading(false);
    }
  };

  const selectedTemplate = templates.find((t) => t.id === selectedTemplateId);

  const handleLaunch = async (e) => {
    e.preventDefault();
    if (!campaignName.trim() || !selectedTemplateId) return;

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
          text: `🎉 Broadcast launched! ${data.stats.sent} messages dispatched via Meta Cloud API.`,
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
            <button onClick={onClose} className="btn btn-ghost" style={{ padding: '6px' }}>
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '24px' }}>
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
                      <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
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
                  placeholder="e.g. Kota NEET 2026 Batch Announcement"
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
                    {selectedTemplate.bodyText}
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
                    onClick={() =>
                      setSelectedContactIds(
                        selectedContactIds.length === contacts.length ? [] : contacts.map((c) => c.id)
                      )
                    }
                    className="btn btn-ghost"
                    style={{ fontSize: '11px', padding: '2px 6px' }}
                  >
                    {selectedContactIds.length === contacts.length ? 'Deselect All' : 'Select All'}
                  </button>
                </div>

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
                  {contacts.map((contact) => (
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
                  disabled={launching || selectedContactIds.length === 0}
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
