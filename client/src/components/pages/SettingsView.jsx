import React, { useState, useEffect } from 'react';
import { Copy, Check, RefreshCw } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useChat } from '../../context/ChatContext';
import { apiFetch } from '../../services/apiClient';
import SandboxSimulatorCard from './SandboxSimulatorCard';

export default function SettingsView({ onNavigateView }) {
  const { agent, tenant, updateTenantInfo } = useAuth();
  const { setTabFilter, setStatusFilter, fetchChats } = useChat();

  const [activeTab, setActiveTab] = useState('channel'); // 'general' | 'channel' | 'billing'
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testingConn, setTestingConn] = useState(false);
  const [copiedWebhook, setCopiedWebhook] = useState(false);
  const [templateCount, setTemplateCount] = useState(0);
  const [billing, setBilling] = useState(null);
  const [feedback, setFeedback] = useState(null);

  const [formState, setFormState] = useState({
    name: '',
    slug: '',
    displayPhoneNumber: '',
    phoneNumberId: '',
    wabaId: '',
    accessToken: '',
    appSecret: '',
    webhookVerifyToken: '',
    webhookUrl: '',
    isConfigured: false,
  });

  useEffect(() => {
    let mounted = true;
    async function loadSettings() {
      setLoading(true);
      try {
        const [settingsData, tplData, billingData] = await Promise.all([
          apiFetch('/api/tenant/settings'),
          apiFetch('/api/templates').catch(() => ({ templates: [] })),
          apiFetch('/api/billing/status').catch(() => null),
        ]);
        if (!mounted) return;
        const s = settingsData.settings || {};
        setFormState({
          name: s.name || tenant?.name || '',
          slug: s.slug || tenant?.slug || '',
          displayPhoneNumber: s.displayPhoneNumber || '',
          phoneNumberId: s.phoneNumberId || '',
          wabaId: s.wabaId || '',
          accessToken: '',
          appSecret: '',
          webhookVerifyToken: '',
          webhookUrl: s.webhookUrl || '',
          isConfigured: Boolean(s.isConfigured),
        });
        setBilling(
          s.billing || billingData
            ? {
                ...(s.billing || {}),
                subscriptionStatus: billingData?.subscriptionStatus || 'ACTIVE',
                trialEndsAt: billingData?.trialEndsAt || null,
                billingConfigured: Boolean(billingData?.configured),
                availablePlans: billingData?.plans || s.billing?.availablePlans,
              }
            : null
        );
        setTemplateCount((tplData.templates || []).filter((t) => t.status === 'APPROVED').length);
      } catch (err) {
        if (mounted) setFeedback({ type: 'error', text: err.message });
      } finally {
        if (mounted) setLoading(false);
      }
    }
    loadSettings();
    return () => {
      mounted = false;
    };
  }, [tenant?.name, tenant?.slug]);

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    setFeedback(null);
    try {
      const payload = {
        name: formState.name,
        displayPhoneNumber: formState.displayPhoneNumber,
        phoneNumberId: formState.phoneNumberId,
        wabaId: formState.wabaId,
      };
      // Only transmit secrets when explicitly provided for rotation.
      if (formState.accessToken.trim()) payload.accessToken = formState.accessToken.trim();
      if (formState.appSecret.trim()) payload.appSecret = formState.appSecret.trim();
      if (formState.webhookVerifyToken.trim()) payload.webhookVerifyToken = formState.webhookVerifyToken.trim();

      const data = await apiFetch('/api/tenant/settings', {
        method: 'PUT',
        body: JSON.stringify(payload),
      });

      if (data.tenant) {
        updateTenantInfo(data.tenant);
        setFormState((prev) => ({
          ...prev,
          accessToken: '',
          appSecret: '',
          webhookVerifyToken: '',
          isConfigured: Boolean(data.tenant.hasMetaConfigured),
        }));
      }
      setFeedback({ type: 'success', text: 'Workspace and Meta Cloud API credentials updated safely.' });
    } catch (err) {
      setFeedback({ type: 'error', text: err.message });
    } finally {
      setSaving(false);
    }
  };

  const handleTestConnection = async () => {
    setTestingConn(true);
    setFeedback(null);
    try {
      const data = await apiFetch('/api/templates/sync', { method: 'POST' });
      setTemplateCount((data.templates || []).filter((t) => t.status === 'APPROVED').length);
      setFeedback({ type: 'success', text: `Connection verified! Synced ${data.count || 0} templates from Meta Cloud API.` });
    } catch (err) {
      setFeedback({ type: 'error', text: err.message });
    } finally {
      setTestingConn(false);
    }
  };

  const handleCopyWebhook = async () => {
    if (!formState.webhookUrl) return;
    await navigator.clipboard?.writeText(formState.webhookUrl).catch(() => {});
    setCopiedWebhook(true);
    setTimeout(() => setCopiedWebhook(false), 1800);
  };

  const handleJumpToUnassigned = () => {
    setStatusFilter('ALL');
    setTabFilter('unassigned');
    fetchChats(true);
    onNavigateView?.('inbox');
  };

  const isTenantAdmin = agent?.role === 'ADMIN';

  return (
    <div className="page-scroll-container" data-node-id="2:14">
      <div className="workspace-page-header" style={{ padding: '20px 0 12px 0' }}>
        <div className="page-header-text">
          <h1 className="page-header-title">Workspace settings</h1>
          <p className="page-header-subtitle">
            Keep your WhatsApp Business channel connected and your team ready.
          </p>
        </div>

        <span className="page-pill-badge neutral">
          {isTenantAdmin ? 'Admin access' : `${agent?.role || 'Staff'} access`}
        </span>
      </div>

      <div className="page-tabs-row">
        <button
          type="button"
          className={`page-tab-btn ${activeTab === 'general' ? 'active' : ''}`}
          onClick={() => setActiveTab('general')}
        >
          General
        </button>
        <button
          type="button"
          className={`page-tab-btn ${activeTab === 'channel' ? 'active' : ''}`}
          onClick={() => setActiveTab('channel')}
        >
          WhatsApp channel
        </button>
        <button
          type="button"
          className={`page-tab-btn ${activeTab === 'billing' ? 'active' : ''}`}
          onClick={() => setActiveTab('billing')}
        >
          Billing
        </button>
      </div>

      {feedback && (
        <div className={`tb-alert ${feedback.type}`} style={{ marginBottom: '16px' }}>
          <span>{feedback.text}</span>
          <button
            type="button"
            onClick={() => setFeedback(null)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', fontWeight: 700 }}
          >
            ×
          </button>
        </div>
      )}

      {loading ? (
        <p className="tb-hint">Loading workspace configuration...</p>
      ) : (
        <div className="page-two-col">
          <div className="page-stack">
            {activeTab === 'general' && (
              <form onSubmit={handleSave} className="page-card page-stack" style={{ gap: '14px' }}>
                <div>
                  <h2 className="page-card-title">Workspace identity</h2>
                  <p className="page-card-subtitle">Core details shown across your inbox sidebar and templates.</p>
                </div>

                <div className="tb-form-grid-2">
                  <div className="tb-field">
                    <label className="tb-label">Organization name</label>
                    <input
                      type="text"
                      className="tb-input"
                      value={formState.name}
                      disabled={!isTenantAdmin}
                      onChange={(e) => setFormState((prev) => ({ ...prev, name: e.target.value }))}
                    />
                  </div>
                  <div className="tb-field">
                    <label className="tb-label">Workspace slug</label>
                    <input type="text" className="tb-input" value={formState.slug} disabled />
                  </div>
                </div>

                <div className="tb-field">
                  <label className="tb-label">Meta Webhook callback URL</label>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <input type="text" className="tb-input" value={formState.webhookUrl} readOnly />
                    <button type="button" className="btn btn-secondary" onClick={handleCopyWebhook}>
                      {copiedWebhook ? <Check size={14} /> : <Copy size={14} />}
                      <span>{copiedWebhook ? 'Copied' : 'Copy'}</span>
                    </button>
                  </div>
                </div>

                {isTenantAdmin && (
                  <div>
                    <button type="submit" className="btn btn-primary" disabled={saving}>
                      {saving ? 'Saving...' : 'Save general settings'}
                    </button>
                  </div>
                )}
              </form>
            )}

            {activeTab === 'channel' && (
              <>
                <div className="page-card">
                  <div className="page-card-header">
                    <div>
                      <h2 className="page-card-title">Your WhatsApp channel</h2>
                      <p className="page-card-subtitle">{formState.name || tenant?.name}</p>
                    </div>
                    <span className={`page-pill-badge ${formState.isConfigured ? '' : 'warning'}`}>
                      ● {formState.isConfigured ? 'Connected' : 'Setup required'}
                    </span>
                  </div>

                  <div style={{ fontSize: '22px', fontWeight: 700, color: 'var(--tb-text-primary)' }}>
                    {formState.displayPhoneNumber || 'Channel display number not set'}
                  </div>
                  <div className="tb-hint" style={{ marginTop: '4px' }}>
                    Official WhatsApp Business Platform · Meta Cloud API
                  </div>

                  <div className="channel-meta-grid">
                    <div>
                      <div className="tb-hint">Webhook endpoint</div>
                      <button
                        type="button"
                        onClick={handleCopyWebhook}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: 'var(--tb-primary-green)',
                          fontWeight: 600,
                          fontSize: '12.5px',
                          cursor: 'pointer',
                          padding: 0,
                          marginTop: '3px',
                        }}
                      >
                        {copiedWebhook ? '✓ Copied URL' : 'Copy callback URL'}
                      </button>
                    </div>
                    <div>
                      <div className="tb-hint">Channel status</div>
                      <div style={{ fontSize: '13px', fontWeight: 600, marginTop: '3px' }}>
                        {formState.isConfigured ? '✓ Verified' : 'Needs credentials'}
                      </div>
                    </div>
                    <div>
                      <div className="tb-hint">Approved templates</div>
                      <button
                        type="button"
                        onClick={() => onNavigateView?.('templates')}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: 'var(--tb-primary-green)',
                          fontWeight: 600,
                          fontSize: '13px',
                          cursor: 'pointer',
                          padding: 0,
                          marginTop: '3px',
                        }}
                      >
                        {templateCount} template{templateCount === 1 ? '' : 's'} ↗
                      </button>
                    </div>
                  </div>
                </div>

                <form onSubmit={handleSave} className="page-card page-stack" style={{ gap: '14px' }}>
                  <div>
                    <h3 className="page-card-title">Connection credentials</h3>
                    <p className="page-card-subtitle">
                      Existing tokens and secrets remain encrypted on the server and are never exposed back to the browser.
                    </p>
                  </div>

                  <div className="tb-form-grid-2">
                    <div className="tb-field">
                      <label className="tb-label">Phone number ID</label>
                      <input
                        type="text"
                        className="tb-input"
                        disabled={!isTenantAdmin}
                        value={formState.phoneNumberId}
                        onChange={(e) => setFormState((prev) => ({ ...prev, phoneNumberId: e.target.value }))}
                        placeholder="1092837465001"
                      />
                    </div>
                    <div className="tb-field">
                      <label className="tb-label">WhatsApp Business Account ID</label>
                      <input
                        type="text"
                        className="tb-input"
                        disabled={!isTenantAdmin}
                        value={formState.wabaId}
                        onChange={(e) => setFormState((prev) => ({ ...prev, wabaId: e.target.value }))}
                        placeholder="WABA ID"
                      />
                    </div>
                  </div>

                  <div className="tb-field">
                    <label className="tb-label">Display WhatsApp number</label>
                    <input
                      type="text"
                      className="tb-input"
                      disabled={!isTenantAdmin}
                      value={formState.displayPhoneNumber}
                      onChange={(e) => setFormState((prev) => ({ ...prev, displayPhoneNumber: e.target.value }))}
                      placeholder="+91 98765 00001"
                    />
                  </div>

                  <div className="tb-field">
                    <label className="tb-label">System user access token</label>
                    <input
                      type="password"
                      className="tb-input"
                      disabled={!isTenantAdmin}
                      value={formState.accessToken}
                      onChange={(e) => setFormState((prev) => ({ ...prev, accessToken: e.target.value }))}
                      placeholder={formState.isConfigured ? 'Token saved securely — enter new token only to rotate' : 'Paste permanent system user access token'}
                    />
                  </div>

                  <div className="tb-form-grid-2">
                    <div className="tb-field">
                      <label className="tb-label">Rotate Meta App Secret (optional)</label>
                      <input
                        type="password"
                        className="tb-input"
                        disabled={!isTenantAdmin}
                        value={formState.appSecret}
                        onChange={(e) => setFormState((prev) => ({ ...prev, appSecret: e.target.value }))}
                        placeholder="Leave blank to keep existing secret"
                      />
                    </div>
                    <div className="tb-field">
                      <label className="tb-label">Rotate Webhook Verify Token (optional)</label>
                      <input
                        type="password"
                        className="tb-input"
                        disabled={!isTenantAdmin}
                        value={formState.webhookVerifyToken}
                        onChange={(e) => setFormState((prev) => ({ ...prev, webhookVerifyToken: e.target.value }))}
                        placeholder="Leave blank to keep current verify token"
                      />
                    </div>
                  </div>

                  {isTenantAdmin && (
                    <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', paddingTop: '6px' }}>
                      <button type="submit" className="btn btn-primary" disabled={saving}>
                        {saving ? 'Updating...' : 'Update credentials'}
                      </button>
                      <button
                        type="button"
                        className="btn btn-secondary"
                        disabled={testingConn}
                        onClick={handleTestConnection}
                      >
                        <RefreshCw size={13} className={testingConn ? 'animate-spin' : ''} />
                        <span>{testingConn ? 'Testing...' : 'Test connection'}</span>
                      </button>
                    </div>
                  )}
                </form>
              </>
            )}

            {activeTab === 'billing' && (
              <div className="page-card page-stack" style={{ gap: '16px' }}>
                <div className="page-card-header" style={{ marginBottom: 0 }}>
                  <div>
                    <h2 className="page-card-title">{billing?.planName || 'Workspace Plan'}</h2>
                    <p className="page-card-subtitle">
                      ₹{Number(billing?.priceMonthlyInr || 0).toLocaleString('en-IN')}/month ·{' '}
                      {billing?.subscriptionStatus === 'TRIAL' && billing?.trialEndsAt
                        ? `Trial ends ${new Date(billing.trialEndsAt).toLocaleDateString('en-IN')}`
                        : `Subscription ${billing?.subscriptionStatus || 'ACTIVE'}`}
                    </p>
                  </div>
                  <span className="page-pill-badge">
                    {billing?.subscriptionStatus || billing?.badge || billing?.plan || 'ACTIVE'}
                  </span>
                </div>

                <div className="audience-metrics-row" style={{ margin: 0 }}>
                  <div>
                    <div className="audience-metric-num">
                      {billing?.agentsUsed || 0} / {billing?.maxAgents || '—'}
                    </div>
                    <div className="audience-metric-label">Active staff seats</div>
                  </div>
                  <div>
                    <div className="audience-metric-num">
                      {Number(billing?.messagesUsed || 0).toLocaleString('en-IN')}
                    </div>
                    <div className="audience-metric-label">Messages this month</div>
                  </div>
                  <div>
                    <div className="audience-metric-num">{billing?.broadcastsCount || 0}</div>
                    <div className="audience-metric-label">Broadcast campaigns run</div>
                  </div>
                </div>

                {billing?.availablePlans && (
                  <div className="tb-table-wrap">
                    <table className="tb-table">
                      <thead>
                        <tr>
                          <th>Plan tier</th>
                          <th>Staff seats</th>
                          <th>Monthly price</th>
                          <th>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {Object.entries(billing.availablePlans).map(([key, plan]) => {
                          const seats = plan.agents ?? plan.maxAgents ?? '—';
                          const priceInr =
                            plan.priceMonthlyInr ?? Math.round((plan.amountPaise || 0) / 100);
                          const isCurrent = billing.plan === key;
                          return (
                            <tr
                              key={key}
                              style={{
                                background: isCurrent ? 'var(--tb-green-pill-bg)' : undefined,
                              }}
                            >
                              <td style={{ fontWeight: 600 }}>{plan.name || key}</td>
                              <td>{seats}</td>
                              <td>₹{Number(priceInr || 0).toLocaleString('en-IN')}/mo</td>
                              <td>
                                {isCurrent
                                  ? billing.subscriptionStatus === 'TRIAL'
                                    ? 'Current · Trial'
                                    : 'Current'
                                  : 'Available'}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}

                {billing && !billing.billingConfigured && (
                  <p className="tb-hint" style={{ margin: 0 }}>
                    Self-serve Razorpay checkout is standing by until Razorpay keys are configured on the server.
                  </p>
                )}
              </div>
            )}
          </div>

          <SandboxSimulatorCard onViewUnassigned={handleJumpToUnassigned} />
        </div>
      )}
    </div>
  );
}
