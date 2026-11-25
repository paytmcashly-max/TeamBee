import React from 'react';

export default function SettingsBillingTab({ billing }) {
  return (
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
  );
}
