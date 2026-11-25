import React, { useState, useEffect } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { apiFetch } from '../../services/apiClient';

export default function AutomationView() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState(null);

  const [botEnabled, setBotEnabled] = useState(true);
  const [welcomeMessage, setWelcomeMessage] = useState('');
  const [handoffKeywords, setHandoffKeywords] = useState('');
  const [catalogKeywords, setCatalogKeywords] = useState('');
  const [paymentKeywords, setPaymentKeywords] = useState('');
  const [customRules, setCustomRules] = useState([]);

  const [autoAssignEnabled, setAutoAssignEnabled] = useState(false);
  const [officeHoursStart, setOfficeHoursStart] = useState('');
  const [officeHoursEnd, setOfficeHoursEnd] = useState('');
  const [officeHoursTimezone, setOfficeHoursTimezone] = useState('Asia/Kolkata');

  const [newTrigger, setNewTrigger] = useState('');
  const [newResponse, setNewResponse] = useState('');

  useEffect(() => {
    let active = true;
    Promise.all([
      apiFetch('/api/automation/config'),
      apiFetch('/api/tenant/settings').catch(() => null),
    ])
      .then(([autoData, tenantData]) => {
        if (!active) return;
        const c = autoData.config || {};
        setBotEnabled(c.botEnabled !== false);
        setWelcomeMessage(c.welcomeMessage || '');
        setHandoffKeywords((c.agentHandoffKeywords || []).join(', '));
        setCatalogKeywords((c.catalogKeywords || []).join(', '));
        setPaymentKeywords((c.paymentKeywords || []).join(', '));
        setCustomRules(Array.isArray(c.customRules) ? c.customRules : []);

        const s = tenantData?.settings;
        if (s) {
          setAutoAssignEnabled(Boolean(s.autoAssignEnabled));
          setOfficeHoursStart(s.officeHoursStart || '');
          setOfficeHoursEnd(s.officeHoursEnd || '');
          setOfficeHoursTimezone(s.officeHoursTimezone || 'Asia/Kolkata');
        }
      })
      .catch((err) => {
        if (active) setFeedback({ type: 'error', text: err.message });
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const parseCsvList = (str) => str.split(',').map((s) => s.trim()).filter(Boolean);

  const handleSaveAll = async (e) => {
    e.preventDefault();
    setSaving(true);
    setFeedback(null);
    try {
      await Promise.all([
        apiFetch('/api/automation/config', {
          method: 'PUT',
          body: JSON.stringify({
            botEnabled,
            welcomeMessage,
            agentHandoffKeywords: parseCsvList(handoffKeywords),
            catalogKeywords: parseCsvList(catalogKeywords),
            paymentKeywords: parseCsvList(paymentKeywords),
            customRules,
          }),
        }),
        apiFetch('/api/tenant/settings', {
          method: 'PUT',
          body: JSON.stringify({
            autoAssignEnabled,
            officeHoursStart: officeHoursStart.trim() || null,
            officeHoursEnd: officeHoursEnd.trim() || null,
            officeHoursTimezone: officeHoursTimezone.trim() || 'Asia/Kolkata',
          }),
        }),
      ]);
      setFeedback({ type: 'success', text: 'Automation rules and routing settings saved.' });
    } catch (err) {
      setFeedback({ type: 'error', text: err.message });
    } finally {
      setSaving(false);
    }
  };

  const handleAddRule = () => {
    if (!newTrigger.trim() || !newResponse.trim()) return;
    setCustomRules((prev) => [
      ...prev,
      {
        id: `rule_${Date.now()}`,
        trigger: newTrigger.trim(),
        matchType: 'contains',
        response: newResponse.trim(),
      },
    ]);
    setNewTrigger('');
    setNewResponse('');
  };

  return (
    <div className="page-scroll-container">
      <div className="workspace-page-header" style={{ padding: '20px 0 18px 0' }}>
        <div className="page-header-text">
          <h1 className="page-header-title">Automation &amp; routing</h1>
          <p className="page-header-subtitle">
            Configure round-robin assignment, office hours away replies, and keyword responses.
          </p>
        </div>
      </div>

      {feedback && (
        <div className={`tb-alert ${feedback.type}`} style={{ marginBottom: '16px' }}>
          <span>{feedback.text}</span>
        </div>
      )}

      {loading ? (
        <p className="tb-hint">Loading automation configuration...</p>
      ) : (
        <form onSubmit={handleSaveAll} className="page-two-col">
          <div className="page-stack">
            <div className="page-card page-stack" style={{ gap: '14px' }}>
              <div className="page-card-header" style={{ marginBottom: 0 }}>
                <div>
                  <h2 className="page-card-title">Keyword auto-responder</h2>
                  <p className="page-card-subtitle">Trigger automated WhatsApp flows on customer replies</p>
                </div>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12.5px', fontWeight: 600, cursor: 'pointer' }}>
                  <input type="checkbox" checked={botEnabled} onChange={(e) => setBotEnabled(e.target.checked)} />
                  <span>{botEnabled ? 'Enabled' : 'Paused'}</span>
                </label>
              </div>

              <div className="tb-field">
                <label className="tb-label">Welcome message</label>
                <textarea rows={2} className="tb-textarea" value={welcomeMessage} onChange={(e) => setWelcomeMessage(e.target.value)} />
              </div>

              <div className="tb-form-grid-2">
                <div className="tb-field">
                  <label className="tb-label">Human handoff keywords</label>
                  <input type="text" className="tb-input" value={handoffKeywords} onChange={(e) => setHandoffKeywords(e.target.value)} />
                </div>
                <div className="tb-field">
                  <label className="tb-label">Catalog keywords</label>
                  <input type="text" className="tb-input" value={catalogKeywords} onChange={(e) => setCatalogKeywords(e.target.value)} />
                </div>
              </div>

              <div className="tb-field">
                <label className="tb-label">Payment / UPI keywords</label>
                <input type="text" className="tb-input" value={paymentKeywords} onChange={(e) => setPaymentKeywords(e.target.value)} />
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '6px' }}>
                <span className="details-section-label">CUSTOM RULES ({customRules.length})</span>
              </div>

              {customRules.map((rule) => (
                <div
                  key={rule.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '10px',
                    padding: '10px 12px',
                    borderRadius: '8px',
                    background: 'var(--tb-light-bg)',
                    border: '1px solid var(--tb-border-light)',
                  }}
                >
                  <div>
                    <div style={{ fontSize: '12.5px', fontWeight: 600 }}>When text contains "{rule.trigger}"</div>
                    <div className="tb-hint">{rule.response}</div>
                  </div>
                  <button
                    type="button"
                    className="btn btn-ghost"
                    style={{ padding: '4px' }}
                    onClick={() => setCustomRules((prev) => prev.filter((r) => r.id !== rule.id))}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}

              <div className="tb-form-grid-2">
                <input
                  type="text"
                  className="tb-input"
                  placeholder="Keyword trigger (e.g. refund)"
                  value={newTrigger}
                  onChange={(e) => setNewTrigger(e.target.value)}
                />
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input
                    type="text"
                    className="tb-input"
                    placeholder="Auto reply text"
                    value={newResponse}
                    onChange={(e) => setNewResponse(e.target.value)}
                  />
                  <button type="button" className="btn btn-secondary" onClick={handleAddRule}>
                    <Plus size={14} />
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div className="page-card page-stack" style={{ gap: '14px' }}>
            <h3 className="page-card-title">Queue routing &amp; office hours</h3>

            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', fontWeight: 500, cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={autoAssignEnabled}
                onChange={(e) => setAutoAssignEnabled(e.target.checked)}
              />
              <span>Auto-assign new unassigned chats round-robin</span>
            </label>

            <div className="tb-form-grid-2">
              <div className="tb-field">
                <label className="tb-label">Opens (24h HH:MM)</label>
                <input
                  type="text"
                  className="tb-input"
                  placeholder="09:00"
                  value={officeHoursStart}
                  onChange={(e) => setOfficeHoursStart(e.target.value)}
                />
              </div>
              <div className="tb-field">
                <label className="tb-label">Closes (24h HH:MM)</label>
                <input
                  type="text"
                  className="tb-input"
                  placeholder="19:00"
                  value={officeHoursEnd}
                  onChange={(e) => setOfficeHoursEnd(e.target.value)}
                />
              </div>
            </div>

            <div className="tb-field">
              <label className="tb-label">Workspace timezone</label>
              <input
                type="text"
                className="tb-input"
                value={officeHoursTimezone}
                onChange={(e) => setOfficeHoursTimezone(e.target.value)}
              />
            </div>

            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'Saving...' : 'Save automation settings'}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
