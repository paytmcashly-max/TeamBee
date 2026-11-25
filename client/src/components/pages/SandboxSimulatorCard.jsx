import React, { useState } from 'react';
import { CheckCheck } from 'lucide-react';
import { useChat } from '../../context/ChatContext';
import { apiFetch } from '../../services/apiClient';

const MESSAGE_TYPES = [
  { id: 'text', label: 'Text' },
  { id: 'image', label: 'Image' },
  { id: 'document', label: 'Document' },
  { id: 'interactive', label: 'Button' },
];

export default function SandboxSimulatorCard({ onViewUnassigned }) {
  const { messages, fetchChats } = useChat();

  const [senderName, setSenderName] = useState('Taylor · Test customer');
  const [senderPhone, setSenderPhone] = useState('12025550147');
  const [messageType, setMessageType] = useState('text');
  const [text, setText] = useState("Hi! I'd love to know more about your latest plans.");
  const [simulating, setSimulating] = useState(false);
  const [result, setResult] = useState(null);

  const latestOutboundWithWamid = [...(messages || [])]
    .reverse()
    .find((m) => m.direction === 'OUTBOUND' && m.waMessageId);

  const formatSimulatorError = (err) => {
    if (err?.status === 404) {
      return {
        type: 'warning',
        text: 'Sandbox simulator is disabled on this server. Set ENABLE_SIMULATOR=true in environment variables when local testing is needed.',
      };
    }
    return { type: 'error', text: err.message };
  };

  const handleSimulateInbound = async (e) => {
    e.preventDefault();
    setSimulating(true);
    setResult(null);
    try {
      const data = await apiFetch('/api/simulator/simulate-inbound', {
        method: 'POST',
        body: JSON.stringify({
          senderPhone,
          senderName,
          messageType,
          text,
          mediaUrl:
            messageType === 'image'
              ? 'https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?w=800&auto=format&fit=crop'
              : undefined,
        }),
      });
      await fetchChats(true);
      setResult({
        type: 'success',
        text: `Test message added to your inbox (${data.wamid}).`,
      });
    } catch (err) {
      setResult(formatSimulatorError(err));
    } finally {
      setSimulating(false);
    }
  };

  const handleSimulateStatus = async (status) => {
    if (!latestOutboundWithWamid?.waMessageId) return;
    setSimulating(true);
    setResult(null);
    try {
      await apiFetch('/api/simulator/simulate-status', {
        method: 'POST',
        body: JSON.stringify({
          waMessageId: latestOutboundWithWamid.waMessageId,
          status,
        }),
      });
      setResult({ type: 'success', text: `Simulated ${status} webhook receipt.` });
    } catch (err) {
      setResult(formatSimulatorError(err));
    } finally {
      setSimulating(false);
    }
  };

  return (
    <div className="page-card" data-name="Sandbox Simulator">
      <h3 className="page-card-title" style={{ marginBottom: '8px' }}>Try it before you go live</h3>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
        <span className="page-pill-badge warning" style={{ borderRadius: '5px', fontSize: '10px', padding: '2px 7px' }}>
          SANDBOX
        </span>
        <span className="tb-hint">No real WhatsApp messages are sent.</span>
      </div>

      <form onSubmit={handleSimulateInbound} className="page-stack" style={{ gap: '12px' }}>
        <div className="tb-field">
          <label className="tb-label">Customer name</label>
          <input
            type="text"
            className="tb-input"
            value={senderName}
            onChange={(e) => setSenderName(e.target.value)}
            required
          />
        </div>

        <div className="tb-field">
          <label className="tb-label">Customer phone</label>
          <input
            type="text"
            className="tb-input"
            value={senderPhone}
            onChange={(e) => setSenderPhone(e.target.value)}
            required
          />
        </div>

        <div className="tb-field">
          <label className="tb-label">Message type</label>
          <div className="sandbox-type-pills">
            {MESSAGE_TYPES.map((t) => (
              <button
                key={t.id}
                type="button"
                className={`sandbox-type-pill ${messageType === t.id ? 'active' : ''}`}
                onClick={() => setMessageType(t.id)}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        <div className="tb-field">
          <label className="tb-label">Incoming message</label>
          <textarea
            rows={3}
            className="tb-textarea"
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
        </div>

        <p className="tb-hint">Arrives in queue via authentic WebhookParserService ingestion.</p>

        <button type="submit" className="btn btn-primary" style={{ width: '100%' }} disabled={simulating}>
          {simulating ? 'Simulating...' : 'Simulate incoming message ↗'}
        </button>
      </form>

      {result && (
        <div className={`tb-alert ${result.type}`} style={{ marginTop: '14px', flexDirection: 'column', alignItems: 'flex-start' }}>
          <span>{result.text}</span>
          {result.type === 'success' && onViewUnassigned && (
            <button
              type="button"
              onClick={onViewUnassigned}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--tb-primary-green)',
                fontWeight: 600,
                fontSize: '12px',
                cursor: 'pointer',
                padding: 0,
              }}
            >
              View in Unassigned →
            </button>
          )}
        </div>
      )}

      {latestOutboundWithWamid && (
        <div style={{ marginTop: '16px', paddingTop: '14px', borderTop: '1px solid var(--tb-border-light)' }}>
          <div className="tb-hint" style={{ marginBottom: '8px' }}>
            Simulate delivery callback for latest outbound thread:
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              type="button"
              className="btn btn-secondary"
              style={{ flex: 1, padding: '6px 10px', fontSize: '12px' }}
              disabled={simulating}
              onClick={() => handleSimulateStatus('DELIVERED')}
            >
              <CheckCheck size={13} />
              <span>Mark Delivered</span>
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              style={{ flex: 1, padding: '6px 10px', fontSize: '12px' }}
              disabled={simulating}
              onClick={() => handleSimulateStatus('READ')}
            >
              <CheckCheck size={13} color="var(--tb-primary-green)" />
              <span>Mark Read</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
