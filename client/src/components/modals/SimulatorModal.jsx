import React, { useState } from 'react';
import { Radio, X, Send, Image as ImageIcon, FileText, CheckCheck, Sparkles } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useChat } from '../../context/ChatContext';

export default function SimulatorModal({ isOpen, onClose }) {
  const { token } = useAuth();
  const { activeChat } = useChat();

  const [senderPhone, setSenderPhone] = useState('919876543210');
  const [senderName, setSenderName] = useState('Aarav Patel');
  const [messageType, setMessageType] = useState('text');
  const [text, setText] = useState('Namaste, what is the scholarship criteria for the 2026 batch?');
  const [simulating, setSimulating] = useState(false);
  const [resultMessage, setResultMessage] = useState(null);

  const presets = [
    {
      label: 'Coaching Lead (Kota)',
      phone: '919876543210',
      name: 'Aarav Patel',
      type: 'text',
      text: 'Namaste maam, can I join the Kota offline batch starting this Monday? Please share fee concession info.',
    },
    {
      label: 'New Customer Lead (Mumbai)',
      phone: '919819999000',
      name: 'Pooja Hegde',
      type: 'text',
      text: 'Hello! I saw your advertisement on Instagram. Do you provide evening doubt clearing sessions?',
    },
    {
      label: 'Inbound Prescription / Document Image',
      phone: '919876543210',
      name: 'Aarav Patel',
      type: 'image',
      text: 'Sharing my Class 10 board mark sheet for scholarship evaluation.',
    },
    {
      label: 'Button Response (Click)',
      phone: '919876543210',
      name: 'Aarav Patel',
      type: 'interactive',
      text: 'Confirmed Free Demo Attendance',
    },
  ];

  const handleApplyPreset = (p) => {
    setSenderPhone(p.phone);
    setSenderName(p.name);
    setMessageType(p.type);
    setText(p.text);
  };

  const handleSimulateInbound = async (e) => {
    e.preventDefault();
    setSimulating(true);
    setResultMessage(null);

    try {
      const res = await fetch('/api/simulator/simulate-inbound', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          senderPhone,
          senderName,
          messageType,
          text,
          mediaUrl:
            messageType === 'image'
              ? 'https://images.unsplash.com/photo-1588072432836-e10032774350?w=800&auto=format&fit=crop'
              : undefined,
        }),
      });

      const data = await res.json();
      if (data.success) {
        setResultMessage({
          type: 'success',
          text: `Inbound WhatsApp message ingested! WAMID: ${data.wamid}. Check your Inbox canvas in real-time.`,
        });
      } else {
        setResultMessage({ type: 'error', text: data.error || 'Failed to simulate payload' });
      }
    } catch (err) {
      setResultMessage({ type: 'error', text: err.message });
    } finally {
      setSimulating(false);
    }
  };

  const handleSimulateStatus = async (status) => {
    setSimulating(true);
    setResultMessage(null);

    try {
      // Find latest outbound message in active chat or use fallback
      const waMessageId =
        activeChat?.messages?.find((m) => m.direction === 'OUTBOUND')?.waMessageId ||
        `wamid.HBgL${Math.random().toString(36).substring(2, 15)}`;

      const res = await fetch('/api/simulator/simulate-status', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          waMessageId,
          status,
        }),
      });

      const data = await res.json();
      if (data.success) {
        setResultMessage({
          type: 'success',
          text: `Delivery receipt transitioned to ${status}! Watch checkmarks update live on the message thread.`,
        });
      } else {
        setResultMessage({ type: 'error', text: data.error || 'Failed to simulate status' });
      }
    } catch (err) {
      setResultMessage({ type: 'error', text: err.message });
    } finally {
      setSimulating(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay">
      <div className="modal-content" style={{ maxWidth: '640px' }}>
        {/* Header */}
        <div
          style={{
            padding: '16px 20px',
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
                background: 'rgba(37, 211, 102, 0.15)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--wa-primary)',
              }}
            >
              <Radio size={20} />
            </div>
            <div>
              <h3 style={{ fontSize: '16px', color: '#fff' }}>Meta Webhook Inbound Simulator</h3>
              <p style={{ fontSize: '11.5px', color: 'var(--text-secondary)' }}>
                Simulate authentic Meta Cloud API payloads & test real-time Socket.io streaming
              </p>
            </div>
          </div>
          <button onClick={onClose} className="btn btn-ghost" style={{ padding: '6px' }}>
            <X size={18} />
          </button>
        </div>

        <div style={{ padding: '20px' }}>
          {resultMessage && (
            <div
              style={{
                padding: '10px 14px',
                borderRadius: 'var(--radius-md)',
                marginBottom: '16px',
                fontSize: '12.5px',
                background: resultMessage.type === 'success' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                color: resultMessage.type === 'success' ? '#34d399' : '#fca5a5',
                border: `1px solid ${resultMessage.type === 'success' ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`,
              }}
            >
              {resultMessage.text}
            </div>
          )}

          {/* Preset Buttons */}
          <div style={{ marginBottom: '16px' }}>
            <span style={{ fontSize: '11px', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
              One-Click Test Scenarios
            </span>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '6px' }}>
              {presets.map((p, idx) => (
                <button
                  key={idx}
                  onClick={() => handleApplyPreset(p)}
                  className="btn btn-secondary"
                  style={{ padding: '5px 10px', fontSize: '11.5px' }}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {/* Form */}
          <form onSubmit={handleSimulateInbound} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#fff', marginBottom: '4px' }}>
                  Customer WhatsApp Number
                </label>
                <input
                  type="text"
                  value={senderPhone}
                  onChange={(e) => setSenderPhone(e.target.value)}
                  placeholder="e.g. 919876543210"
                  style={{
                    width: '100%',
                    background: 'var(--bg-surface)',
                    border: '1px solid var(--border-medium)',
                    borderRadius: '6px',
                    padding: '8px 10px',
                    color: '#fff',
                    fontSize: '12.5px',
                    fontFamily: 'var(--font-mono)',
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#fff', marginBottom: '4px' }}>
                  Customer Profile Name
                </label>
                <input
                  type="text"
                  value={senderName}
                  onChange={(e) => setSenderName(e.target.value)}
                  placeholder="e.g. Aarav Patel"
                  style={{
                    width: '100%',
                    background: 'var(--bg-surface)',
                    border: '1px solid var(--border-medium)',
                    borderRadius: '6px',
                    padding: '8px 10px',
                    color: '#fff',
                    fontSize: '12.5px',
                  }}
                />
              </div>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#fff', marginBottom: '4px' }}>
                Payload Message Type
              </label>
              <select
                value={messageType}
                onChange={(e) => setMessageType(e.target.value)}
                style={{
                  width: '100%',
                  background: 'var(--bg-surface)',
                  border: '1px solid var(--border-medium)',
                  borderRadius: '6px',
                  padding: '8px 10px',
                  color: '#fff',
                  fontSize: '12.5px',
                }}
              >
                <option value="text">Text Message</option>
                <option value="image">Image Attachment (Medical / Academic Scorecard)</option>
                <option value="document">PDF Document</option>
                <option value="interactive">Interactive Button Reply</option>
              </select>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#fff', marginBottom: '4px' }}>
                Message Content / Caption
              </label>
              <textarea
                rows={3}
                value={text}
                onChange={(e) => setText(e.target.value)}
                style={{
                  width: '100%',
                  background: 'var(--bg-surface)',
                  border: '1px solid var(--border-medium)',
                  borderRadius: '6px',
                  padding: '8px 10px',
                  color: '#fff',
                  fontSize: '12.5px',
                  fontFamily: 'inherit',
                  resize: 'none',
                }}
              />
            </div>

            <button type="submit" disabled={simulating} className="btn btn-primary" style={{ padding: '10px' }}>
              <Send size={15} />
              {simulating ? 'Processing Webhook Ingestion...' : 'Fire Inbound Webhook Payload'}
            </button>
          </form>

          {/* Status Tick Simulation Section */}
          <div
            style={{
              marginTop: '20px',
              paddingTop: '16px',
              borderTop: '1px solid var(--border-subtle)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <div>
              <div style={{ fontSize: '12.5px', fontWeight: '600', color: '#fff' }}>
                Simulate Delivery Status Callbacks
              </div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                Trigger status webhooks to verify checkmark transitions
              </div>
            </div>

            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                onClick={() => handleSimulateStatus('DELIVERED')}
                disabled={simulating}
                className="btn btn-secondary"
                style={{ padding: '6px 10px', fontSize: '11.5px' }}
              >
                Delivered (✓✓ Grey)
              </button>
              <button
                onClick={() => handleSimulateStatus('READ')}
                disabled={simulating}
                className="btn btn-secondary"
                style={{ padding: '6px 10px', fontSize: '11.5px', color: '#38bdf8' }}
              >
                Read (✓✓ Blue)
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
