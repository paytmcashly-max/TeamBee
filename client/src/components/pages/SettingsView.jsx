import React, { useState, useEffect } from 'react';
import { Copy, Check } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useChat } from '../../context/ChatContext';
import { apiFetch } from '../../services/apiClient';
import SandboxSimulatorCard from './SandboxSimulatorCard';
import SettingsChannelTab from './SettingsChannelTab';
import SettingsBillingTab from './SettingsBillingTab';

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
              <SettingsChannelTab
                formState={formState}
                setFormState={setFormState}
                tenantName={tenant?.name}
                isTenantAdmin={isTenantAdmin}
                saving={saving}
                testingConn={testingConn}
                copiedWebhook={copiedWebhook}
                templateCount={templateCount}
                onCopyWebhook={handleCopyWebhook}
                onTestConnection={handleTestConnection}
                onSave={handleSave}
                onNavigateView={onNavigateView}
              />
            )}

            {activeTab === 'billing' && <SettingsBillingTab billing={billing} />}
          </div>

          <SandboxSimulatorCard onViewUnassigned={handleJumpToUnassigned} />
        </div>
      )}
    </div>
  );
}
