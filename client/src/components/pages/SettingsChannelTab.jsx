import React from 'react';
import { RefreshCw } from 'lucide-react';

export default function SettingsChannelTab({
  formState,
  setFormState,
  tenantName,
  isTenantAdmin,
  saving,
  testingConn,
  copiedWebhook,
  templateCount,
  onCopyWebhook,
  onTestConnection,
  onSave,
  onNavigateView,
}) {
  return (
    <>
      <div className="page-card">
        <div className="page-card-header">
          <div>
            <h2 className="page-card-title">Your WhatsApp channel</h2>
            <p className="page-card-subtitle">{formState.name || tenantName}</p>
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
              onClick={onCopyWebhook}
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

      <form onSubmit={onSave} className="page-card page-stack" style={{ gap: '14px' }}>
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
            placeholder={
              formState.isConfigured
                ? 'Token saved securely — enter new token only to rotate'
                : 'Paste permanent system user access token'
            }
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
              onClick={onTestConnection}
            >
              <RefreshCw size={13} className={testingConn ? 'animate-spin' : ''} />
              <span>{testingConn ? 'Testing...' : 'Test connection'}</span>
            </button>
          </div>
        )}
      </form>
    </>
  );
}
