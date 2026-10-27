import React, { useState, useEffect } from 'react';
import {
  Bot,
  Zap,
  ArrowLeft,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  Plus,
  Trash2,
  Edit3,
  Clock,
  UserCheck,
  ShoppingBag,
  CreditCard,
  MessageSquare,
  ShieldCheck,
  Sliders,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';

export default function AutomationView({ onBack, onOpenInbox }) {
  const { token } = useAuth();
  const toast = useToast();
  const [config, setConfig] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Editable fields
  const [botEnabled, setBotEnabled] = useState(true);
  const [welcomeMessage, setWelcomeMessage] = useState('');
  const [handoffKeywords, setHandoffKeywords] = useState('');
  const [catalogKeywords, setCatalogKeywords] = useState('');
  const [paymentKeywords, setPaymentKeywords] = useState('');
  const [customRules, setCustomRules] = useState([]);

  // New Rule form modal
  const [showRuleModal, setShowRuleModal] = useState(false);
  const [newTrigger, setNewTrigger] = useState('');
  const [newResponse, setNewResponse] = useState('');
  const [newButtons, setNewButtons] = useState(['🛍️ View Catalog', '💬 Talk to Agent']);

  const loadConfig = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/automation/config', {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      const data = await res.json();
      if (data.success && data.config) {
        setConfig(data.config);
        setBotEnabled(data.config.botEnabled !== false);
        setWelcomeMessage(data.config.welcomeMessage || '');
        setHandoffKeywords((data.config.agentHandoffKeywords || []).join(', '));
        setCatalogKeywords((data.config.catalogKeywords || []).join(', '));
        setPaymentKeywords((data.config.paymentKeywords || []).join(', '));
        setCustomRules(data.config.customRules || []);
      }
    } catch (err) {
      toast.error('Failed to load automation settings');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadConfig();
  }, []);

  const handleSaveConfig = async () => {
    setSaving(true);
    try {
      const payload = {
        botEnabled,
        welcomeMessage: welcomeMessage.trim(),
        agentHandoffKeywords: handoffKeywords.split(',').map((s) => s.trim()).filter(Boolean),
        catalogKeywords: catalogKeywords.split(',').map((s) => s.trim()).filter(Boolean),
        paymentKeywords: paymentKeywords.split(',').map((s) => s.trim()).filter(Boolean),
        customRules,
      };

      const res = await fetch('/api/automation/config', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (data.success) {
        toast.success('Automation rules saved successfully');
        setConfig(data.config);
      } else {
        toast.error(data.error || 'Failed to save automation rules');
      }
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleAddCustomRule = (e) => {
    e.preventDefault();
    if (!newTrigger.trim() || !newResponse.trim()) {
      toast.error('Trigger keyword and response are required');
      return;
    }
    const rule = {
      id: `rule_${Date.now().toString().slice(-6)}`,
      trigger: newTrigger.trim(),
      response: newResponse.trim(),
      buttons: newButtons.filter(Boolean),
    };
    setCustomRules((prev) => [...prev, rule]);
    setNewTrigger('');
    setNewResponse('');
    setShowRuleModal(false);
    toast.success('New auto-response rule added. Click "Save All Rules" to commit.');
  };

  const handleDeleteRule = (id) => {
    setCustomRules((prev) => prev.filter((r) => r.id !== id));
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: 'var(--bg-app)', overflowY: 'auto' }}>
      {/* Top Header */}
      <div
        style={{
          background: 'var(--bg-surface)',
          borderBottom: '1px solid var(--border-subtle)',
          padding: '16px 24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '12px',
          position: 'sticky',
          top: 0,
          zIndex: 10,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {onBack && (
            <button
              onClick={onBack}
              className="btn btn-ghost btn-sm"
              style={{ color: 'var(--text-secondary)', padding: '6px' }}
              title="Back"
            >
              <ArrowLeft size={18} />
            </button>
          )}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div
                style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '8px',
                  background: 'rgba(56, 189, 248, 0.12)',
                  color: '#0284c7',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Bot size={18} />
              </div>
              <h1 style={{ fontSize: '18px', fontWeight: '700', color: 'var(--text-main)', margin: 0 }}>
                DoubleTick AI Chatbot &amp; Flow Automation
              </h1>
              <span
                style={{
                  background: botEnabled ? 'rgba(37, 211, 102, 0.12)' : 'rgba(100, 116, 139, 0.12)',
                  color: botEnabled ? '#16a34a' : '#64748b',
                  fontSize: '11px',
                  fontWeight: '700',
                  padding: '2px 8px',
                  borderRadius: '12px',
                }}
              >
                {botEnabled ? '● Bot Active' : '○ Bot Paused'}
              </span>
            </div>
            <p style={{ fontSize: '12.5px', color: 'var(--text-muted)', margin: '2px 0 0 40px' }}>
              Instant auto-replies, keyword triggers, catalog showcase and 1-click human agent handoff
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button
            onClick={() => setBotEnabled(!botEnabled)}
            className="btn btn-secondary btn-sm"
            style={{
              color: botEnabled ? '#16a34a' : 'var(--text-muted)',
              fontWeight: '600',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <Bot size={14} />
            <span>{botEnabled ? 'Enabled' : 'Disabled'}</span>
          </button>
          <button
            onClick={handleSaveConfig}
            disabled={saving}
            className="btn btn-primary btn-sm"
            style={{
              background: 'var(--wa-primary)',
              color: '#ffffff',
              fontWeight: '600',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <CheckCircle2 size={15} />
            <span>{saving ? 'Saving...' : 'Save All Rules'}</span>
          </button>
        </div>
      </div>

      <div style={{ padding: '24px', maxWidth: '1100px', width: '100%', margin: '0 auto' }}>
        {/* Visual Bot Flow Architecture Banner */}
        <div
          style={{
            background: 'linear-gradient(135deg, rgba(37, 211, 102, 0.08) 0%, rgba(56, 189, 248, 0.08) 100%)',
            border: '1px solid rgba(37, 211, 102, 0.2)',
            borderRadius: '16px',
            padding: '20px',
            marginBottom: '24px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
            <Sparkles size={16} style={{ color: 'var(--wa-primary)' }} />
            <span style={{ fontSize: '13px', fontWeight: '700', color: 'var(--text-main)' }}>
              How DoubleTick Flow Automation Works
            </span>
          </div>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
              gap: '12px',
              fontSize: '12.5px',
              color: 'var(--text-secondary)',
            }}
          >
            <div style={{ background: 'var(--bg-surface)', padding: '12px', borderRadius: '10px', border: '1px solid var(--border-subtle)' }}>
              <div style={{ fontWeight: '700', color: '#0284c7', marginBottom: '4px' }}>1. Customer Inbound</div>
              Customer texts or clicks a button like "View Catalog", "Pay", or "Talk to Human".
            </div>
            <div style={{ background: 'var(--bg-surface)', padding: '12px', borderRadius: '10px', border: '1px solid var(--border-subtle)' }}>
              <div style={{ fontWeight: '700', color: '#16a34a', marginBottom: '4px' }}>2. 0ms Smart Matching</div>
              Engine checks keyword triggers and interactive reply payloads without delay.
            </div>
            <div style={{ background: 'var(--bg-surface)', padding: '12px', borderRadius: '10px', border: '1px solid var(--border-subtle)' }}>
              <div style={{ fontWeight: '700', color: '#d97706', marginBottom: '4px' }}>3. Auto-Action</div>
              Dispatches product cards, UPI payment intent, or routes chat to live agents.
            </div>
          </div>
        </div>

        {/* Section 1: Welcome Message & Main Greeting */}
        <div
          style={{
            background: 'var(--bg-surface)',
            border: '1px solid var(--border-subtle)',
            borderRadius: '12px',
            padding: '20px',
            marginBottom: '20px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
            <MessageSquare size={16} style={{ color: 'var(--wa-teal)' }} />
            <h2 style={{ fontSize: '15px', fontWeight: '700', color: 'var(--text-main)', margin: 0 }}>
              Default Welcome Greeting
            </h2>
          </div>
          <p style={{ fontSize: '12.5px', color: 'var(--text-muted)', marginBottom: '10px' }}>
            Sent automatically when a customer texts "hi", "hello", "menu", or initiates a conversation.
          </p>
          <textarea
            rows={2}
            value={welcomeMessage}
            onChange={(e) => setWelcomeMessage(e.target.value)}
            style={{
              width: '100%',
              padding: '10px 14px',
              borderRadius: '8px',
              border: '1px solid var(--border-medium)',
              background: 'var(--bg-input)',
              color: 'var(--text-main)',
              fontSize: '13px',
              resize: 'none',
            }}
          />
        </div>

        {/* Section 2: Core Automation Keyword Triggers */}
        <div
          style={{
            background: 'var(--bg-surface)',
            border: '1px solid var(--border-subtle)',
            borderRadius: '12px',
            padding: '20px',
            marginBottom: '20px',
          }}
        >
          <h2 style={{ fontSize: '15px', fontWeight: '700', color: 'var(--text-main)', marginBottom: '16px' }}>
            Built-in Intelligent Triggers
          </h2>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {/* 1. Live Agent Handoff */}
            <div
              style={{
                border: '1px solid var(--border-subtle)',
                borderRadius: '10px',
                padding: '14px',
                background: 'rgba(245, 158, 11, 0.04)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                <UserCheck size={16} style={{ color: '#d97706' }} />
                <span style={{ fontSize: '13.5px', fontWeight: '700', color: 'var(--text-main)' }}>
                  Live Human Agent Handoff
                </span>
                <span style={{ fontSize: '11px', background: 'rgba(245, 158, 11, 0.15)', color: '#b45309', padding: '1px 6px', borderRadius: '4px', fontWeight: '700' }}>
                  Auto Open &amp; Priority Tag
                </span>
              </div>
              <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '8px' }}>
                When matched, the chat status is set to OPEN, tagged with "Agent Requested", and a notification is sent to available staff.
              </p>
              <input
                type="text"
                value={handoffKeywords}
                onChange={(e) => setHandoffKeywords(e.target.value)}
                placeholder="agent, human, support, help, representative"
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  borderRadius: '6px',
                  border: '1px solid var(--border-medium)',
                  background: 'var(--bg-surface)',
                  color: 'var(--text-main)',
                  fontSize: '12.5px',
                }}
              />
            </div>

            {/* 2. Catalog & Pricing Trigger */}
            <div
              style={{
                border: '1px solid var(--border-subtle)',
                borderRadius: '10px',
                padding: '14px',
                background: 'rgba(37, 211, 102, 0.04)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                <ShoppingBag size={16} style={{ color: 'var(--wa-primary)' }} />
                <span style={{ fontSize: '13.5px', fontWeight: '700', color: 'var(--text-main)' }}>
                  Product Catalog &amp; Pricing Showcase
                </span>
                <span style={{ fontSize: '11px', background: 'rgba(37, 211, 102, 0.15)', color: '#15803d', padding: '1px 6px', borderRadius: '4px', fontWeight: '700' }}>
                  Auto Interactive Buttons
                </span>
              </div>
              <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '8px' }}>
                Automatically displays your featured catalog items with ₹ prices and "Buy / Pay" action buttons.
              </p>
              <input
                type="text"
                value={catalogKeywords}
                onChange={(e) => setCatalogKeywords(e.target.value)}
                placeholder="catalog, products, shop, pricing, price list, menu"
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  borderRadius: '6px',
                  border: '1px solid var(--border-medium)',
                  background: 'var(--bg-surface)',
                  color: 'var(--text-main)',
                  fontSize: '12.5px',
                }}
              />
            </div>

            {/* 3. Instant Payment Trigger */}
            <div
              style={{
                border: '1px solid var(--border-subtle)',
                borderRadius: '10px',
                padding: '14px',
                background: 'rgba(56, 189, 248, 0.04)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                <CreditCard size={16} style={{ color: '#0284c7' }} />
                <span style={{ fontSize: '13.5px', fontWeight: '700', color: 'var(--text-main)' }}>
                  Instant UPI Payment Details
                </span>
                <span style={{ fontSize: '11px', background: 'rgba(56, 189, 248, 0.15)', color: '#0369a1', padding: '1px 6px', borderRadius: '4px', fontWeight: '700' }}>
                  NPCI 1-Click Pay
                </span>
              </div>
              <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '8px' }}>
                Sends your official UPI VPA and 1-click payment intent for GPay, PhonePe, Paytm, and BHIM.
              </p>
              <input
                type="text"
                value={paymentKeywords}
                onChange={(e) => setPaymentKeywords(e.target.value)}
                placeholder="pay, payment, upi, googlepay, phonepe, paytm, qr code"
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  borderRadius: '6px',
                  border: '1px solid var(--border-medium)',
                  background: 'var(--bg-surface)',
                  color: 'var(--text-main)',
                  fontSize: '12.5px',
                }}
              />
            </div>
          </div>
        </div>

        {/* Section 3: Custom Business Keyword Rules */}
        <div
          style={{
            background: 'var(--bg-surface)',
            border: '1px solid var(--border-subtle)',
            borderRadius: '12px',
            padding: '20px',
            marginBottom: '20px',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
            <div>
              <h2 style={{ fontSize: '15px', fontWeight: '700', color: 'var(--text-main)', margin: 0 }}>
                Custom Auto-Responder Rules ({customRules.length})
              </h2>
              <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: '2px 0 0 0' }}>
                Match custom terms (e.g. "timings", "address", "refunds") with custom replies
              </p>
            </div>
            <button
              onClick={() => setShowRuleModal(true)}
              className="btn btn-secondary btn-sm"
              style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              <Plus size={14} /> Add Custom Rule
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {customRules.map((r) => (
              <div
                key={r.id}
                style={{
                  border: '1px solid var(--border-subtle)',
                  borderRadius: '8px',
                  padding: '12px 16px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '12px',
                }}
              >
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                    <span
                      style={{
                        background: 'rgba(15, 23, 42, 0.08)',
                        color: 'var(--text-main)',
                        fontSize: '12px',
                        fontWeight: '700',
                        padding: '2px 8px',
                        borderRadius: '4px',
                        fontFamily: 'var(--font-mono)',
                      }}
                    >
                      "{r.trigger}"
                    </span>
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>→ Replies with:</span>
                  </div>
                  <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>{r.response}</div>
                </div>

                <button
                  onClick={() => handleDeleteRule(r.id)}
                  className="btn btn-ghost btn-xs"
                  style={{ color: '#ef4444', padding: '6px' }}
                  title="Remove rule"
                >
                  <Trash2 size={15} />
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Add Custom Rule Modal */}
      {showRuleModal && (
        <div className="modal-backdrop" onClick={() => setShowRuleModal(false)}>
          <div
            className="modal-card"
            style={{ maxWidth: '440px', width: '90%' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <h3 style={{ fontSize: '16px', fontWeight: '700', margin: 0, color: 'var(--text-main)' }}>
                Add Custom Keyword Rule
              </h3>
              <button onClick={() => setShowRuleModal(false)} className="btn btn-ghost btn-xs">
                ✕
              </button>
            </div>

            <form onSubmit={handleAddCustomRule} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <label style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-main)', display: 'block', marginBottom: '4px' }}>
                  When customer message contains *
                </label>
                <input
                  type="text"
                  required
                  value={newTrigger}
                  onChange={(e) => setNewTrigger(e.target.value)}
                  placeholder="e.g. warranty, discount, address"
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: '8px',
                    border: '1px solid var(--border-medium)',
                    background: 'var(--bg-input)',
                    color: 'var(--text-main)',
                  }}
                />
              </div>

              <div>
                <label style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-main)', display: 'block', marginBottom: '4px' }}>
                  Bot Auto-Reply *
                </label>
                <textarea
                  rows={3}
                  required
                  value={newResponse}
                  onChange={(e) => setNewResponse(e.target.value)}
                  placeholder="Type the message the bot will send..."
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: '8px',
                    border: '1px solid var(--border-medium)',
                    background: 'var(--bg-input)',
                    color: 'var(--text-main)',
                    resize: 'none',
                  }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '10px' }}>
                <button
                  type="button"
                  onClick={() => setShowRuleModal(false)}
                  className="btn btn-secondary btn-sm"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary btn-sm"
                  style={{ background: 'var(--wa-primary)', color: '#ffffff' }}
                >
                  Add Rule
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
