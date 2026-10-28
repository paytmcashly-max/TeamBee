import React, { useState, useEffect } from 'react';
import {
  Bot,
  Zap,
  Sparkles,
  CheckCircle2,
  Plus,
  Trash2,
  UserCheck,
  ShoppingBag,
  CreditCard,
  MessageSquare,
  Activity,
  ToggleLeft,
  ToggleRight,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';

function TriggerBlock({ icon, iconColor, iconBg, label, badge, badgeColor, badgeBg, desc, value, onChange, placeholder }) {
  return (
    <div className="dt-trigger-block">
      <div className="dt-trigger-block-header">
        <div className="dt-trigger-icon" style={{ background: iconBg, color: iconColor }}>
          {icon}
        </div>
        <div className="dt-trigger-meta">
          <div className="dt-trigger-title-row">
            <span className="dt-trigger-title">{label}</span>
            <span className="dt-trigger-badge" style={{ background: badgeBg, color: badgeColor }}>{badge}</span>
          </div>
          <p className="dt-trigger-desc">{desc}</p>
        </div>
      </div>
      <input
        type="text"
        className="dt-input"
        value={value}
        onChange={onChange}
        placeholder={placeholder}
      />
    </div>
  );
}

export default function AutomationView({ onBack, onOpenInbox }) {
  const { token } = useAuth();
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [botEnabled, setBotEnabled] = useState(true);
  const [welcomeMessage, setWelcomeMessage] = useState('');
  const [handoffKeywords, setHandoffKeywords] = useState('');
  const [catalogKeywords, setCatalogKeywords] = useState('');
  const [paymentKeywords, setPaymentKeywords] = useState('');
  const [customRules, setCustomRules] = useState([]);
  const [showRuleModal, setShowRuleModal] = useState(false);
  const [newTrigger, setNewTrigger] = useState('');
  const [newResponse, setNewResponse] = useState('');

  const loadConfig = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/automation/config', {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      const data = await res.json();
      if (data.success && data.config) {
        const c = data.config;
        setBotEnabled(c.botEnabled !== false);
        setWelcomeMessage(c.welcomeMessage || '');
        setHandoffKeywords((c.agentHandoffKeywords || []).join(', '));
        setCatalogKeywords((c.catalogKeywords || []).join(', '));
        setPaymentKeywords((c.paymentKeywords || []).join(', '));
        setCustomRules(c.customRules || []);
      }
    } catch {
      toast.error('Failed to load automation settings');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadConfig(); }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload = {
        botEnabled,
        welcomeMessage: welcomeMessage.trim(),
        agentHandoffKeywords: handoffKeywords.split(',').map(s => s.trim()).filter(Boolean),
        catalogKeywords: catalogKeywords.split(',').map(s => s.trim()).filter(Boolean),
        paymentKeywords: paymentKeywords.split(',').map(s => s.trim()).filter(Boolean),
        customRules,
      };
      const res = await fetch('/api/automation/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (data.success) toast.success('Automation rules saved');
      else toast.error(data.error || 'Save failed');
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleAddRule = (e) => {
    e.preventDefault();
    if (!newTrigger.trim() || !newResponse.trim()) {
      toast.error('Trigger and response are required');
      return;
    }
    setCustomRules(prev => [...prev, {
      id: `rule_${Date.now().toString().slice(-6)}`,
      trigger: newTrigger.trim(),
      response: newResponse.trim(),
    }]);
    setNewTrigger('');
    setNewResponse('');
    setShowRuleModal(false);
    toast.success('Rule added — click Save to commit');
  };

  return (
    <div className="dt-page">
      {/* Page Header */}
      <div className="dt-page-header">
        <div className="dt-page-header-left">
          <div className="dt-page-icon" style={{ background: 'rgba(37, 211, 102, 0.12)', color: 'var(--wa-primary)' }}>
            <Bot size={18} />
          </div>
          <div>
            <h1 className="dt-page-title">AI Chatbot &amp; Automations</h1>
            <p className="dt-page-desc">
              Keyword-triggered replies, catalog showcasing &amp; instant human handoff
            </p>
          </div>
        </div>
        <div className="dt-page-header-right">
          {/* Bot Toggle */}
          <button
            type="button"
            onClick={() => setBotEnabled(v => !v)}
            className={`dt-toggle-btn ${botEnabled ? 'dt-toggle-on' : 'dt-toggle-off'}`}
            title={botEnabled ? 'Bot is Active — click to pause' : 'Bot is Paused — click to enable'}
          >
            {botEnabled ? <ToggleRight size={20} /> : <ToggleLeft size={20} />}
            <span>{botEnabled ? 'Bot Active' : 'Bot Paused'}</span>
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="dt-btn dt-btn-primary dt-btn-sm"
          >
            <CheckCircle2 size={15} />
            <span>{saving ? 'Saving…' : 'Save Rules'}</span>
          </button>
        </div>
      </div>

      {/* Page Body */}
      <div className="dt-page-body">
        {loading ? (
          <div className="dt-empty-state"><div className="dt-spinner" /><p>Loading automation config…</p></div>
        ) : (
          <>
            {/* How it works banner */}
            <div className="dt-info-banner">
              <div className="dt-info-banner-title">
                <Sparkles size={15} style={{ color: 'var(--wa-primary)' }} />
                <span>How DoubleTick Flow Automation Works</span>
              </div>
              <div className="dt-flow-steps">
                <div className="dt-flow-step">
                  <div className="dt-flow-step-num" style={{ background: 'rgba(56, 189, 248, 0.15)', color: '#0284c7' }}>1</div>
                  <div>
                    <div className="dt-flow-step-title">Customer Inbound</div>
                    <div className="dt-flow-step-desc">Customer texts or taps a button like "View Catalog", "Pay", or "Talk to Human"</div>
                  </div>
                </div>
                <div className="dt-flow-arrow">→</div>
                <div className="dt-flow-step">
                  <div className="dt-flow-step-num" style={{ background: 'rgba(37, 211, 102, 0.15)', color: '#16a34a' }}>2</div>
                  <div>
                    <div className="dt-flow-step-title">0ms Smart Match</div>
                    <div className="dt-flow-step-desc">Engine checks keyword triggers and interactive reply payloads instantly</div>
                  </div>
                </div>
                <div className="dt-flow-arrow">→</div>
                <div className="dt-flow-step">
                  <div className="dt-flow-step-num" style={{ background: 'rgba(245, 158, 11, 0.15)', color: '#d97706' }}>3</div>
                  <div>
                    <div className="dt-flow-step-title">Auto Action</div>
                    <div className="dt-flow-step-desc">Sends product cards, UPI payment intent, or routes to a live agent</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Welcome Message */}
            <div className="dt-card">
              <div className="dt-card-header">
                <div className="dt-card-icon" style={{ background: 'rgba(18, 140, 126, 0.10)', color: 'var(--wa-teal)' }}>
                  <MessageSquare size={16} />
                </div>
                <div>
                  <div className="dt-card-title">Welcome Greeting</div>
                  <div className="dt-card-desc">Sent when a customer texts "hi", "hello", or "menu" for the first time</div>
                </div>
              </div>
              <textarea
                rows={3}
                className="dt-textarea"
                value={welcomeMessage}
                onChange={e => setWelcomeMessage(e.target.value)}
                placeholder="e.g. 👋 Welcome to our WhatsApp Store! Reply with CATALOG to see our products or PAY to make a payment."
              />
            </div>

            {/* Intelligent Triggers */}
            <div className="dt-card">
              <div className="dt-card-header">
                <div className="dt-card-icon" style={{ background: 'rgba(99, 102, 241, 0.10)', color: '#6366f1' }}>
                  <Zap size={16} />
                </div>
                <div>
                  <div className="dt-card-title">Built-in Intelligent Triggers</div>
                  <div className="dt-card-desc">Comma-separated keywords — when matched, the bot auto-responds with the configured action</div>
                </div>
              </div>
              <div className="dt-triggers-list">
                <TriggerBlock
                  icon={<UserCheck size={16} />}
                  iconBg="rgba(245, 158, 11, 0.12)"
                  iconColor="#d97706"
                  label="Live Agent Handoff"
                  badge="Auto Open + Priority Tag"
                  badgeBg="rgba(245, 158, 11, 0.12)"
                  badgeColor="#b45309"
                  desc="Sets chat to OPEN, tags with 'Agent Requested', and notifies available staff"
                  value={handoffKeywords}
                  onChange={e => setHandoffKeywords(e.target.value)}
                  placeholder="agent, human, support, help, representative"
                />
                <TriggerBlock
                  icon={<ShoppingBag size={16} />}
                  iconBg="rgba(37, 211, 102, 0.12)"
                  iconColor="var(--wa-primary)"
                  label="Product Catalog Showcase"
                  badge="Auto Buttons"
                  badgeBg="rgba(37, 211, 102, 0.12)"
                  badgeColor="#15803d"
                  desc="Displays featured catalog items with ₹ prices and Buy / Pay action buttons"
                  value={catalogKeywords}
                  onChange={e => setCatalogKeywords(e.target.value)}
                  placeholder="catalog, products, shop, pricing, menu"
                />
                <TriggerBlock
                  icon={<CreditCard size={16} />}
                  iconBg="rgba(56, 189, 248, 0.12)"
                  iconColor="#0284c7"
                  label="Instant UPI Payment"
                  badge="NPCI 1-Click Pay"
                  badgeBg="rgba(56, 189, 248, 0.12)"
                  badgeColor="#0369a1"
                  desc="Sends your UPI VPA and 1-click payment intent for GPay, PhonePe, Paytm &amp; BHIM"
                  value={paymentKeywords}
                  onChange={e => setPaymentKeywords(e.target.value)}
                  placeholder="pay, payment, upi, googlepay, phonepe, qr code"
                />
              </div>
            </div>

            {/* Custom Rules */}
            <div className="dt-card">
              <div className="dt-card-header">
                <div className="dt-card-icon" style={{ background: 'rgba(99, 102, 241, 0.10)', color: '#6366f1' }}>
                  <Bot size={16} />
                </div>
                <div style={{ flex: 1 }}>
                  <div className="dt-card-title">Custom Auto-Responder Rules <span className="dt-count-badge">{customRules.length}</span></div>
                  <div className="dt-card-desc">Create keyword-to-reply mappings for FAQs like timings, address, refund policy</div>
                </div>
                <button
                  onClick={() => setShowRuleModal(true)}
                  className="dt-btn dt-btn-secondary dt-btn-sm"
                >
                  <Plus size={14} /> Add Rule
                </button>
              </div>

              {customRules.length === 0 ? (
                <div className="dt-rules-empty">
                  <Bot size={24} style={{ color: 'var(--text-muted)', opacity: 0.5 }} />
                  <span>No custom rules yet. Add one to automate FAQ replies.</span>
                </div>
              ) : (
                <div className="dt-rules-list">
                  {customRules.map(r => (
                    <div key={r.id} className="dt-rule-row">
                      <div className="dt-rule-trigger">
                        <span className="dt-rule-trigger-label">When:</span>
                        <code className="dt-rule-keyword">"{r.trigger}"</code>
                      </div>
                      <div className="dt-rule-arrow">→</div>
                      <div className="dt-rule-response">{r.response}</div>
                      <button
                        onClick={() => setCustomRules(prev => prev.filter(x => x.id !== r.id))}
                        className="dt-btn dt-btn-ghost dt-btn-icon"
                        style={{ color: '#ef4444' }}
                        title="Delete rule"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* Add Rule Modal */}
      {showRuleModal && (
        <div className="dt-modal-overlay" onClick={() => setShowRuleModal(false)}>
          <div className="dt-modal" onClick={e => e.stopPropagation()}>
            <div className="dt-modal-header">
              <div className="dt-modal-title">Add Custom Keyword Rule</div>
              <button onClick={() => setShowRuleModal(false)} className="dt-btn dt-btn-ghost dt-btn-icon">✕</button>
            </div>
            <form onSubmit={handleAddRule} className="dt-modal-body">
              <div className="dt-field">
                <label className="dt-label">When message contains *</label>
                <input
                  type="text"
                  required
                  className="dt-input"
                  value={newTrigger}
                  onChange={e => setNewTrigger(e.target.value)}
                  placeholder="e.g. warranty, discount, address"
                />
              </div>
              <div className="dt-field">
                <label className="dt-label">Bot Auto-Reply *</label>
                <textarea
                  rows={3}
                  required
                  className="dt-textarea"
                  value={newResponse}
                  onChange={e => setNewResponse(e.target.value)}
                  placeholder="Type the message the bot will send automatically…"
                />
              </div>
              <div className="dt-modal-actions">
                <button type="button" onClick={() => setShowRuleModal(false)} className="dt-btn dt-btn-secondary dt-btn-sm">Cancel</button>
                <button type="submit" className="dt-btn dt-btn-primary dt-btn-sm">Add Rule</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
