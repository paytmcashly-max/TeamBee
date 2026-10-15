import React, { useState, useEffect, useRef } from 'react';
import {
  Send,
  Paperclip,
  Smile,
  Clock,
  Check,
  CheckCheck,
  AlertTriangle,
  FileText,
  Image as ImageIcon,
  UserCheck,
  CheckCircle2,
  RotateCcw,
  Sparkles,
  Phone,
  Info,
  ChevronDown,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useChat } from '../../context/ChatContext';

export default function ChatCanvas({ onOpenTemplatePicker, onToggleSidebar, isSidebarOpen }) {
  const { agent, isAdmin } = useAuth();
  const {
    activeChat,
    messages,
    loadingMessages,
    sendMessage,
    assignChat,
    updateChatStatus,
    messagingWindow,
    typingUsers,
  } = useChat();

  const [inputContent, setInputContent] = useState('');
  const [sending, setSending] = useState(false);
  const [agentsList, setAgentsList] = useState([]);
  const [showQuickReplies, setShowQuickReplies] = useState(false);
  const messagesEndRef = useRef(null);

  // Auto-scroll to bottom of messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, typingUsers]);

  // Load staff agents for reassignment dropdown
  useEffect(() => {
    async function loadAgents() {
      try {
        const token = localStorage.getItem('chatflow_token');
        const res = await fetch('/api/agents', {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        if (data.success) {
          setAgentsList(data.agents);
        }
      } catch (err) {
        console.error('Failed to load agents:', err);
      }
    }
    loadAgents();
  }, []);

  const handleSend = async (e) => {
    if (e) e.preventDefault();
    if (!inputContent.trim() || sending) return;

    const content = inputContent.trim();
    setInputContent('');
    setSending(true);

    try {
      await sendMessage(content, 'TEXT');
    } catch (err) {
      alert(`Delivery notice: ${err.message}`);
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const quickReplies = [
    { label: 'NEET Fees & Batches', text: 'Namaste! Our NEET 2026-27 batch fee is ₹85,000/year including study materials, weekly tests, and Kota top mentors.' },
    { label: 'Demo Class Schedule', text: 'You can attend a complimentary 2-hour Live Demo this Saturday at 5 PM. Would you like us to register your slot?' },
    { label: 'Center Location & Timings', text: 'Our center is open Mon-Sat from 9 AM to 7 PM at 3rd Floor, Apex Tower, Kota / Bandra West, Mumbai.' },
    { label: 'Scholarship Test', text: 'We offer up to 90% scholarship based on the Apex Talent Hunt Test (ATHT) conducted every Sunday online and offline.' },
  ];

  if (!activeChat) {
    return (
      <main className="col-chat-canvas" style={{ alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center', maxWidth: '380px', padding: '30px' }}>
          <div
            style={{
              width: '70px',
              height: '70px',
              borderRadius: '20px',
              background: 'rgba(37, 211, 102, 0.1)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 20px auto',
              color: 'var(--wa-primary)',
            }}
          >
            <Phone size={34} />
          </div>
          <h2 style={{ fontSize: '18px', color: '#fff', marginBottom: '8px' }}>
            WhatsApp Shared Team Inbox
          </h2>
          <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
            Select an active customer conversation from the left queue to read messages, reassign agents, or dispatch WhatsApp Cloud API replies.
          </p>
        </div>
      </main>
    );
  }

  const isAssignedToMe = activeChat.assignedAgentId === agent?.id;
  const isUnassigned = activeChat.status === 'UNASSIGNED';
  const isResolved = activeChat.status === 'RESOLVED';

  return (
    <main className="col-chat-canvas">
      {/* 1. Chat Header */}
      <div
        style={{
          padding: '12px 20px',
          background: 'rgba(15, 22, 36, 0.95)',
          backdropFilter: 'blur(10px)',
          borderBottom: '1px solid var(--border-subtle)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          zIndex: 5,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          {/* Customer Avatar */}
          <div
            style={{
              width: '42px',
              height: '42px',
              borderRadius: '50%',
              background: 'linear-gradient(135deg, #10b981 0%, #047857 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '16px',
              fontWeight: '700',
              color: '#fff',
            }}
          >
            {activeChat.contact?.name ? activeChat.contact.name.charAt(0).toUpperCase() : 'C'}
          </div>

          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontWeight: '700', fontSize: '15.5px', color: '#fff' }}>
                {activeChat.contact?.name || 'Customer'}
              </span>
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '3px',
                  fontSize: '10.5px',
                  background: 'rgba(37, 211, 102, 0.15)',
                  color: '#25D366',
                  padding: '1px 6px',
                  borderRadius: '4px',
                  fontWeight: '600',
                }}
              >
                <CheckCheck size={12} /> WhatsApp Official
              </span>
            </div>
            <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
              +{activeChat.contact?.waId} • Channel: Cloud API v20.0
            </div>
          </div>
        </div>

        {/* Action Controls: Assignment, Resolution, Sidebar Toggle */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {/* Status Badge */}
          <span
            className={
              isResolved
                ? 'badge badge-resolved'
                : isUnassigned
                ? 'badge badge-unassigned'
                : 'badge badge-open'
            }
          >
            {activeChat.status}
          </span>

          {/* Re-routing / Assignment Dropdown or Claim Button */}
          {isAdmin ? (
            <div style={{ position: 'relative' }}>
              <select
                value={activeChat.assignedAgentId || ''}
                onChange={(e) => assignChat(activeChat.id, e.target.value || null)}
                style={{
                  background: 'var(--bg-surface)',
                  color: '#fff',
                  border: '1px solid var(--border-medium)',
                  borderRadius: 'var(--radius-md)',
                  padding: '6px 26px 6px 10px',
                  fontSize: '12.5px',
                  cursor: 'pointer',
                  appearance: 'none',
                  outline: 'none',
                  fontFamily: 'inherit',
                }}
              >
                <option value="">Unassigned</option>
                {agentsList.map((a) => (
                  <option key={a.id} value={a.id}>
                    Assign: {a.name} ({a.role})
                  </option>
                ))}
              </select>
              <ChevronDown
                size={13}
                style={{ position: 'absolute', right: '8px', top: '10px', pointerEvents: 'none', color: '#94a3b8' }}
              />
            </div>
          ) : isUnassigned ? (
            <button
              onClick={() => assignChat(activeChat.id, agent.id)}
              className="btn btn-primary"
              style={{ padding: '6px 12px', fontSize: '12px' }}
            >
              <UserCheck size={14} /> Claim Chat
            </button>
          ) : (
            <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
              Assigned: {activeChat.assignedAgent?.name || 'You'}
            </span>
          )}

          {/* Resolve / Reopen Button */}
          {isResolved ? (
            <button
              onClick={() => updateChatStatus(activeChat.id, 'OPEN')}
              className="btn btn-secondary"
              style={{ padding: '6px 12px', fontSize: '12px' }}
            >
              <RotateCcw size={13} /> Reopen
            </button>
          ) : (
            <button
              onClick={() => updateChatStatus(activeChat.id, 'RESOLVED')}
              className="btn btn-secondary"
              style={{ padding: '6px 12px', fontSize: '12px' }}
            >
              <CheckCircle2 size={13} style={{ color: '#10b981' }} /> Resolve
            </button>
          )}

          {/* CRM Sidebar Toggle */}
          <button
            onClick={onToggleSidebar}
            className="btn btn-ghost"
            style={{
              padding: '6px 8px',
              color: isSidebarOpen ? 'var(--wa-primary)' : 'var(--text-secondary)',
            }}
            title="Toggle CRM Sidebar"
          >
            <Info size={17} />
          </button>
        </div>
      </div>

      {/* 2. WhatsApp 24-Hour Messaging Window Notice */}
      <div
        style={{
          background: messagingWindow.isOpen ? 'rgba(16, 185, 129, 0.08)' : 'rgba(239, 68, 68, 0.1)',
          borderBottom: `1px solid ${messagingWindow.isOpen ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.25)'}`,
          padding: '6px 20px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          fontSize: '12px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {messagingWindow.isOpen ? (
            <>
              <Clock size={13} style={{ color: '#10b981' }} />
              <span style={{ color: '#6ee7b7' }}>
                WhatsApp 24-Hour Customer Window Active • {messagingWindow.hoursRemaining} hours remaining for freeform replies.
              </span>
            </>
          ) : (
            <>
              <AlertTriangle size={14} style={{ color: '#f87171' }} />
              <span style={{ color: '#fca5a5' }}>
                WhatsApp 24-Hour Reply Window Expired • Customer must be re-engaged with an approved Template message.
              </span>
            </>
          )}
        </div>

        <button
          onClick={onOpenTemplatePicker}
          className="btn btn-ghost"
          style={{ padding: '2px 8px', fontSize: '11.5px', color: '#25D366', gap: '4px' }}
        >
          <Sparkles size={12} /> Use Meta Template
        </button>
      </div>

      {/* 3. Messages Stream */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '20px 24px',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
        }}
      >
        {loadingMessages ? (
          <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '20px' }}>
            Fetching WhatsApp message logs...
          </div>
        ) : messages.length === 0 ? (
          <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '40px 0' }}>
            No messages logged in this session yet.
          </div>
        ) : (
          messages.map((msg) => {
            const isInbound = msg.direction === 'INBOUND';
            const isSystem = msg.senderType === 'SYSTEM';

            if (isSystem) {
              return (
                <div key={msg.id} className="msg-bubble-system">
                  {msg.content}
                </div>
              );
            }

            const formatMsgTime = (d) =>
              new Date(d).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });

            return (
              <div
                key={msg.id}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: isInbound ? 'flex-start' : 'flex-end',
                }}
              >
                <div className={isInbound ? 'msg-bubble-inbound' : 'msg-bubble-outbound'}>
                  {/* Sender label if outbound agent */}
                  {!isInbound && msg.senderAgent && (
                    <div style={{ fontSize: '11px', color: '#a7f3d0', fontWeight: '600', marginBottom: '2px' }}>
                      {msg.senderAgent.name}
                    </div>
                  )}

                  {/* Media Content: Image */}
                  {msg.messageType === 'IMAGE' && (
                    <div style={{ marginBottom: '6px' }}>
                      <img
                        src={msg.mediaUrl || 'https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?w=600'}
                        alt="WhatsApp Attachment"
                        style={{
                          maxWidth: '280px',
                          maxHeight: '220px',
                          borderRadius: '8px',
                          display: 'block',
                          objectFit: 'cover',
                        }}
                      />
                    </div>
                  )}

                  {/* Media Content: Document */}
                  {msg.messageType === 'DOCUMENT' && (
                    <div
                      style={{
                        background: 'rgba(0,0,0,0.2)',
                        padding: '8px 12px',
                        borderRadius: '6px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        marginBottom: '6px',
                      }}
                    >
                      <FileText size={20} style={{ color: '#38bdf8' }} />
                      <div style={{ fontSize: '12px', fontWeight: '500' }}>
                        {msg.mediaFilename || 'Document.pdf'}
                      </div>
                    </div>
                  )}

                  {/* Text / Caption */}
                  <div style={{ fontSize: '13.5px', whiteSpace: 'pre-wrap', wordBreak: 'break-word', lineHeight: 1.45 }}>
                    {msg.content}
                  </div>

                  {/* Footer: Time & Meta WhatsApp Tick Status */}
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'flex-end',
                      gap: '4px',
                      marginTop: '4px',
                      fontSize: '10.5px',
                      color: isInbound ? 'var(--text-muted)' : '#d1fae5',
                    }}
                  >
                    <span>{formatMsgTime(msg.createdAt)}</span>
                    {!isInbound && (
                      <span>
                        {msg.status === 'READ' ? (
                          <CheckCheck size={13} style={{ color: 'var(--wa-blue-tick)' }} title="Read by recipient" />
                        ) : msg.status === 'DELIVERED' ? (
                          <CheckCheck size={13} style={{ color: '#a7f3d0' }} title="Delivered to device" />
                        ) : msg.status === 'SENT' ? (
                          <Check size={13} style={{ color: '#a7f3d0' }} title="Sent via Meta Cloud API" />
                        ) : msg.status === 'FAILED' ? (
                          <AlertTriangle size={13} style={{ color: '#f87171' }} title={msg.errorMessage || 'Failed'} />
                        ) : (
                          <Clock size={12} title="Pending" />
                        )}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}

        {/* Live typing indicator */}
        {Object.entries(typingUsers).some(([, isTyping]) => isTyping) && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 12px' }}>
            <span style={{ fontSize: '12px', color: 'var(--wa-primary)', fontStyle: 'italic' }}>
              Staff member is typing...
            </span>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* 4. Quick Replies Flyout */}
      {showQuickReplies && (
        <div
          style={{
            position: 'absolute',
            bottom: '80px',
            left: '20px',
            right: '20px',
            background: 'var(--bg-surface)',
            border: '1px solid var(--border-medium)',
            borderRadius: 'var(--radius-lg)',
            padding: '12px',
            boxShadow: 'var(--shadow-card)',
            zIndex: 20,
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
            <span style={{ fontSize: '12px', fontWeight: '600', color: '#fff' }}>⚡ Canned Quick Responses</span>
            <button
              onClick={() => setShowQuickReplies(false)}
              className="btn btn-ghost"
              style={{ padding: '2px 6px', fontSize: '11px' }}
            >
              ✕ Close
            </button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px' }}>
            {quickReplies.map((qr, idx) => (
              <button
                key={idx}
                onClick={() => {
                  setInputContent(qr.text);
                  setShowQuickReplies(false);
                }}
                className="btn btn-secondary"
                style={{ textAlign: 'left', padding: '8px 10px', fontSize: '12px', justifyContent: 'flex-start' }}
              >
                <div>
                  <div style={{ fontWeight: '600', color: 'var(--wa-primary)' }}>{qr.label}</div>
                  <div
                    style={{
                      fontSize: '11px',
                      color: 'var(--text-muted)',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      maxWidth: '240px',
                    }}
                  >
                    {qr.text}
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* 5. Interactive Composer Box */}
      <div
        style={{
          padding: '14px 20px',
          background: 'rgba(15, 22, 36, 0.98)',
          borderTop: '1px solid var(--border-subtle)',
        }}
      >
        <form onSubmit={handleSend} style={{ display: 'flex', alignItems: 'flex-end', gap: '10px' }}>
          {/* Quick Reply & Template Action Buttons */}
          <div style={{ display: 'flex', gap: '4px', paddingBottom: '4px' }}>
            <button
              type="button"
              onClick={() => setShowQuickReplies(!showQuickReplies)}
              className="btn btn-ghost"
              style={{ padding: '8px', color: showQuickReplies ? 'var(--wa-primary)' : 'var(--text-secondary)' }}
              title="Canned Quick Responses"
            >
              ⚡
            </button>
            <button
              type="button"
              onClick={onOpenTemplatePicker}
              className="btn btn-ghost"
              style={{ padding: '8px', color: 'var(--text-secondary)' }}
              title="Send Approved WhatsApp Template"
            >
              <Sparkles size={17} />
            </button>
          </div>

          {/* Text Area */}
          <div style={{ flex: 1, position: 'relative' }}>
            <textarea
              rows={2}
              value={inputContent}
              onChange={(e) => setInputContent(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={
                messagingWindow.isOpen
                  ? 'Type an official WhatsApp reply... (Press Enter to send)'
                  : '⚠️ 24-hr window expired. Use Template above or type to override...'
              }
              style={{
                width: '100%',
                background: 'var(--bg-surface)',
                border: '1px solid var(--border-medium)',
                borderRadius: 'var(--radius-md)',
                color: '#fff',
                padding: '10px 14px',
                fontSize: '13.5px',
                resize: 'none',
                outline: 'none',
                fontFamily: 'inherit',
                lineHeight: 1.4,
              }}
            />
          </div>

          {/* Send Button */}
          <button
            type="submit"
            disabled={!inputContent.trim() || sending}
            className="btn btn-primary"
            style={{
              padding: '10px 16px',
              height: '42px',
              borderRadius: 'var(--radius-md)',
              opacity: !inputContent.trim() || sending ? 0.6 : 1,
            }}
          >
            <Send size={16} />
            <span>Send</span>
          </button>
        </form>
      </div>
    </main>
  );
}
