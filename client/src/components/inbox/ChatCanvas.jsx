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
  Lock,
  MessageSquare,
  Plus,
  Trash2,
  X,
  ExternalLink,
  MapPin,
  Flame,
  ArrowLeft,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useChat } from '../../context/ChatContext';
import { useSocket } from '../../context/SocketContext';

const API_BASE = (import.meta.env.VITE_API_URL || '').replace(/\/+$/, '');

function dayLabel(dateStr) {
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return null;
  const sameDay = (a, b) =>
    a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
  if (sameDay(d, new Date())) return 'Today';
  if (sameDay(d, new Date(Date.now() - 86400000))) return 'Yesterday';
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

// Interleave day separators into the message stream (WhatsApp-style).
function withDateSeparators(list) {
  const out = [];
  let lastDayKey = null;
  for (const message of list) {
    const d = new Date(message.createdAt);
    const key = Number.isNaN(d.getTime()) ? null : `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
    if (key && key !== lastDayKey) {
      out.push({ _separator: true, id: `sep-${key}`, label: dayLabel(message.createdAt) });
      lastDayKey = key;
    }
    out.push(message);
  }
  return out;
}

// Inbound media lives behind Meta's expiring URLs, so it is streamed through
// the authenticated backend proxy. The JWT travels in a header, so the binary
// is fetched as a blob and rendered from an object URL.
function AuthedMedia({ messageId, kind, token, filename }) {
  const [objectUrl, setObjectUrl] = useState(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let revoked = false;
    let createdUrl = null;
    (async () => {
      try {
        const res = await fetch(`${API_BASE}/api/messages/media/${messageId}`, {
          credentials: 'include',
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        if (!res.ok) throw new Error('media fetch failed');
        const blob = await res.blob();
        createdUrl = URL.createObjectURL(blob);
        if (!revoked) setObjectUrl(createdUrl);
      } catch (err) {
        if (!revoked) setFailed(true);
      }
    })();
    return () => {
      revoked = true;
      if (createdUrl) URL.revokeObjectURL(createdUrl);
    };
  }, [messageId, token]);

  if (failed) {
    return (
      <div style={{ padding: '18px 12px', borderRadius: '8px', background: 'rgba(255,255,255,0.06)', color: 'var(--text-muted)', fontSize: '12px', textAlign: 'center' }}>
        Media unavailable
      </div>
    );
  }
  if (!objectUrl) {
    return (
      <div style={{ padding: '18px 12px', borderRadius: '8px', background: 'rgba(255,255,255,0.06)', color: 'var(--text-muted)', fontSize: '12px', textAlign: 'center' }}>
        Loading media…
      </div>
    );
  }
  if (kind === 'IMAGE') {
    return <img src={objectUrl} alt="WhatsApp Attachment" style={{ maxWidth: '100%', maxHeight: '200px', borderRadius: '8px', display: 'block', objectFit: 'cover' }} />;
  }
  if (kind === 'AUDIO') {
    return <audio controls src={objectUrl} style={{ maxWidth: '100%' }} />;
  }
  if (kind === 'VIDEO') {
    return <video controls src={objectUrl} style={{ maxWidth: '100%', maxHeight: '220px', borderRadius: '8px', display: 'block' }} />;
  }
  return (
    <a href={objectUrl} target="_blank" rel="noreferrer" style={{ color: '#38bdf8', fontSize: '11.5px', fontWeight: 500 }}>
      {filename || 'Open document'}
    </a>
  );
}

export default function ChatCanvas({ onOpenTemplatePicker, onToggleSidebar, isSidebarOpen, onBack }) {
  const { agent, isAdmin, token } = useAuth();
  const { emitTyping } = useSocket();
  const {
    activeChat,
    messages,
    loadingMessages,
    sendMessage,
    assignChat,
    updateChatStatus,
    messagingWindow,
    typingUsers,
    messagePagination,
    loadOlderMessages,
  } = useChat();

  const [inputContent, setInputContent] = useState('');
  const [composeMode, setComposeMode] = useState('WHATSAPP'); // 'WHATSAPP' | 'NOTE' | 'INTERACTIVE'
  const [sending, setSending] = useState(false);
  const [agentsList, setAgentsList] = useState([]);
  const [showQuickReplies, setShowQuickReplies] = useState(false);
  const [showAttachmentMenu, setShowAttachmentMenu] = useState(false);
  const [attachUrl, setAttachUrl] = useState('');
  const [attachName, setAttachName] = useState('');
  const [interactiveButtons, setInteractiveButtons] = useState([
    'Yes, please',
    'No, thanks',
    'Talk to support',
  ]);
  const [newBtnInput, setNewBtnInput] = useState('');

  const messagesEndRef = useRef(null);
  const messagesContainerRef = useRef(null);
  const textareaRef = useRef(null);
  const stickToBottomRef = useRef(true);
  const typingTimeoutRef = useRef(null);

  // Auto-scroll follows new messages ONLY while the agent is already near
  // the bottom — yanking the view down while they read history (or select
  // text) destroys their place and their selection.
  useEffect(() => {
    if (messagesContainerRef.current && stickToBottomRef.current) {
      messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
    }
  }, [messages, typingUsers]);

  const handleMessageScroll = () => {
    const el = messagesContainerRef.current;
    if (!el) return;
    stickToBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 140;
  };

  // Debounced staff typing indicator (the socket event existed but the
  // composer never emitted it, so "Staff member is typing" could never show)
  const signalTyping = () => {
    if (!activeChat?.id) return;
    emitTyping(activeChat.id, true);
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      if (activeChat?.id) emitTyping(activeChat.id, false);
    }, 2500);
  };

  // Keep window and canvas header pinned to top when switching chats
  useEffect(() => {
    stickToBottomRef.current = true;
    window.scrollTo(0, 0);
    if (messagesContainerRef.current) {
      messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
    }
  }, [activeChat?.id]);

  // Load staff agents for reassignment dropdown
  useEffect(() => {
    async function loadAgents() {
      try {
        const res = await fetch('/api/agents', {
          credentials: 'include',
          headers: token ? { Authorization: `Bearer ${token}` } : {},
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
    if (!inputContent.trim()) return;

    const content = inputContent.trim();
    // ⚡ Clear input immediately so user feels 0ms latency
    setInputContent('');
    setSending(true);

    try {
      if (composeMode === 'NOTE') {
        // Send Private Team Note
        await sendMessage(content, {
          isInternal: true,
          messageType: 'NOTE',
        });
      } else if (composeMode === 'INTERACTIVE') {
        // Send WhatsApp Interactive Message with quick action buttons
        const formattedButtons = interactiveButtons
          .filter((b) => b.trim().length > 0)
          .slice(0, 3)
          .map((title, idx) => ({
            id: `btn_${idx + 1}`,
            title: title.trim().slice(0, 20),
          }));

        await sendMessage(content, {
          messageType: 'INTERACTIVE',
          buttons: formattedButtons,
        });
      } else {
        // Standard WhatsApp Outbound Message
        await sendMessage(content, {
          messageType: 'TEXT',
        });
      }
    } catch (err) {
      // Never destroy the agent's text on a failed send: restore the draft
      // (unless they have already started typing something new).
      setInputContent((prev) => (prev.trim() ? prev : content));
      alert(`Notice: ${err.message}`);
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

  // Quick Emoji Click
  const insertEmoji = (emoji) => {
    setInputContent((prev) => prev + emoji);
    textareaRef.current?.focus();
  };

  // Fast Attachment Handler
  const handleQuickAttachment = async (type, filename, url) => {
    setShowAttachmentMenu(false);
    setSending(true);
    try {
      await sendMessage(`Here is your requested ${filename}`, {
        messageType: type,
        mediaUrl: url,
        mediaFilename: filename,
      });
    } catch (err) {
      alert(`Attachment error: ${err.message}`);
    } finally {
      setSending(false);
    }
  };

  const quickReplies = [
    {
      label: 'Greeting',
      text: 'Namaste! Thanks for reaching out to us. How can I help you today?',
    },
    {
      label: 'Ask for details',
      text: 'Could you please share a few more details so I can help you better?',
    },
    {
      label: 'Follow-up',
      text: 'Thanks for your patience. We are checking this for you and will update you shortly.',
    },
    {
      label: 'Closing',
      text: 'Thanks for contacting us. If you need anything else, just send us a message here. Have a great day!',
    },
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

  // Extract contact details safely
  const contactName = activeChat?.contact?.name;
  const contactPhone = activeChat?.contact?.waId;
  const displayName = contactName && contactName.trim()
    ? contactName
    : (contactPhone ? `+${contactPhone}` : 'Customer');
  const subText = contactName && contactPhone
    ? `+${contactPhone}`
    : (activeChat?.status ? `Status: ${activeChat.status}` : '');
  const avatarLetter = contactName && contactName.trim()
    ? contactName.trim().charAt(0).toUpperCase()
    : (contactPhone ? '📱' : 'C');

  return (
    <main className="col-chat-canvas">
      {/* 1. Chat Header (Permanently pinned at top, safe from notches and dynamic island) */}
      <div
        className="chat-canvas-header"
        style={{
          padding: '10px 14px',
          background: 'rgba(14, 21, 36, 0.98)',
          backdropFilter: 'blur(12px)',
          borderBottom: '1px solid var(--border-subtle)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          zIndex: 50,
          gap: '8px',
          flexShrink: 0,
          position: 'sticky',
          top: 0,
          width: '100%',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0, flex: 1 }}>
          {/* Mobile Back Button: High contrast, easy tap */}
          {onBack && (
            <button
              type="button"
              onClick={onBack}
              className="btn-mobile-back"
              style={{
                width: '36px',
                height: '36px',
                minWidth: '36px',
                borderRadius: '50%',
                background: 'rgba(255, 255, 255, 0.1)',
                color: '#fff',
                border: 'none',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                flexShrink: 0,
              }}
              title="Back to conversation queue"
            >
              <ArrowLeft size={19} />
            </button>
          )}

          {/* Customer Avatar */}
          <div
            style={{
              width: '38px',
              height: '38px',
              minWidth: '38px',
              borderRadius: '50%',
              background: 'linear-gradient(135deg, #10b981 0%, #047857 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '15px',
              fontWeight: '700',
              color: '#fff',
              flexShrink: 0,
            }}
          >
            {avatarLetter}
          </div>

          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span
                style={{
                  fontWeight: '700',
                  fontSize: '15px',
                  color: '#fff',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  display: 'block',
                }}
              >
                {displayName}
              </span>
              <span
                className="desktop-only-header-control"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '3px',
                  fontSize: '10px',
                  background: 'rgba(37, 211, 102, 0.15)',
                  color: '#25D366',
                  padding: '1px 6px',
                  borderRadius: '4px',
                  fontWeight: '600',
                  whiteSpace: 'nowrap',
                }}
              >
                <CheckCheck size={11} /> Meta Official
              </span>
            </div>
            {subText && (
              <div style={{ fontSize: '11px', color: 'var(--text-secondary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {subText}
              </div>
            )}
          </div>
        </div>

        {/* Action Controls: Status, Assignment (Desktop), Resolution & CRM Sidebar Toggle */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
          {/* Status Badge */}
          <span
            className={
              isResolved
                ? 'badge badge-resolved'
                : isUnassigned
                ? 'badge badge-unassigned'
                : 'badge badge-open'
            }
            style={{ fontSize: '10px', padding: '3px 8px' }}
          >
            {activeChat.status}
          </span>

          {/* Desktop Only: Re-routing / Assignment Dropdown or Claim Button */}
          <div className="desktop-only-header-control">
            {isAdmin ? (
              <div style={{ position: 'relative' }}>
                <select
                  value={activeChat.assignedAgentId || ''}
                  onChange={(e) => assignChat(activeChat.id, e.target.value || null).catch((err) => alert(err.message))}
                  style={{
                    background: 'var(--bg-surface)',
                    color: '#fff',
                    border: '1px solid var(--border-medium)',
                    borderRadius: 'var(--radius-md)',
                    padding: '6px 24px 6px 8px',
                    fontSize: '12px',
                    cursor: 'pointer',
                    appearance: 'none',
                    outline: 'none',
                    fontFamily: 'inherit',
                    maxWidth: '120px',
                  }}
                >
                  <option value="">Unassigned</option>
                  {agentsList.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                    </option>
                  ))}
                </select>
                <ChevronDown
                  size={12}
                  style={{ position: 'absolute', right: '6px', top: '9px', pointerEvents: 'none', color: '#94a3b8' }}
                />
              </div>
            ) : isUnassigned ? (
              <button
                onClick={() => assignChat(activeChat.id, agent.id).catch((err) => alert(err.message))}
                className="btn btn-primary"
                style={{ padding: '5px 10px', fontSize: '11.5px' }}
              >
                <UserCheck size={13} /> Claim
              </button>
            ) : (
              <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                {activeChat.assignedAgent?.name || 'You'}
              </span>
            )}
          </div>

          {/* Resolve / Reopen Button */}
          {isResolved ? (
            <button
              onClick={() => updateChatStatus(activeChat.id, 'OPEN').catch((err) => alert(err.message))}
              className="btn btn-secondary"
              style={{ width: '34px', height: '34px', padding: 0 }}
              title="Reopen Conversation"
            >
              <RotateCcw size={14} />
            </button>
          ) : (
            <button
              onClick={() => updateChatStatus(activeChat.id, 'RESOLVED').catch((err) => alert(err.message))}
              className="btn btn-secondary"
              style={{ width: '34px', height: '34px', padding: 0 }}
              title="Mark Resolved"
            >
              <CheckCircle2 size={15} style={{ color: '#10b981' }} />
            </button>
          )}

          {/* CRM Info Button to toggle Customer sidebar */}
          <button
            type="button"
            onClick={onToggleSidebar}
            style={{
              width: '34px',
              height: '34px',
              borderRadius: '8px',
              background: isSidebarOpen ? 'rgba(37, 211, 102, 0.2)' : 'var(--bg-surface)',
              color: isSidebarOpen ? 'var(--wa-primary)' : 'var(--text-secondary)',
              border: '1px solid var(--border-medium)',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
            }}
            title="Customer CRM Details"
          >
            <Info size={16} />
          </button>
        </div>
      </div>

      {/* 2. WhatsApp 24-Hour Messaging Window Notice */}
      <div
        style={{
          background: messagingWindow.isOpen ? 'rgba(16, 185, 129, 0.08)' : 'rgba(239, 68, 68, 0.1)',
          borderBottom: `1px solid ${messagingWindow.isOpen ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.25)'}`,
          padding: '6px 16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          fontSize: '11.5px',
          gap: '8px',
          flexShrink: 0,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0, overflow: 'hidden' }}>
          {messagingWindow.isOpen ? (
            <>
              <Clock size={13} style={{ color: '#10b981', flexShrink: 0 }} />
              <span style={{ color: '#6ee7b7', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                Meta 24h Window Active: {(() => { const hrs = parseFloat(messagingWindow.hoursRemaining); return Number.isFinite(hrs) ? (hrs >= 1 ? `${hrs.toFixed(1)}h` : `${Math.max(1, Math.round(hrs * 60))}m`) : '—'; })()} remaining
              </span>
            </>
          ) : (
            <>
              <AlertTriangle size={13} style={{ color: '#f87171', flexShrink: 0 }} />
              <span style={{ color: '#fca5a5', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                24h Window Expired: Send template to re-engage
              </span>
            </>
          )}
        </div>

        <button
          onClick={onOpenTemplatePicker}
          className="btn btn-ghost"
          style={{ padding: '2px 6px', fontSize: '11px', color: '#25D366', gap: '4px', flexShrink: 0 }}
        >
          <Sparkles size={12} /> Template
        </button>
      </div>

      {/* 3. Messages Stream */}
      <div
        ref={messagesContainerRef}
        onScroll={handleMessageScroll}
        style={{
          flex: '1 1 0%',
          minHeight: 0,
          overflowY: 'auto',
          padding: '16px',
          display: 'flex',
          flexDirection: 'column',
          gap: '10px',
        }}
       >
        {messagePagination?.hasMore && (
          <button
            type="button"
            onClick={() => loadOlderMessages().catch((error) => alert(error.message))}
            className="btn btn-secondary"
            style={{ alignSelf: 'center', fontSize: '11px', padding: '5px 10px' }}
          >
            Load older messages
          </button>
        )}
        {loadingMessages && messages.length === 0 ? (
          <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '20px' }}>
            Fetching WhatsApp message logs...
          </div>
        ) : messages.length === 0 ? (
          <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '40px 0' }}>
            No messages logged in this session yet.
          </div>
        ) : (
          withDateSeparators(messages).map((msg) => {
            if (msg._separator) {
              return (
                <div key={msg.id} className="msg-date-separator">
                  {msg.label}
                </div>
              );
            }
            const isInbound = msg.direction === 'INBOUND';
            const isSystem = msg.senderType === 'SYSTEM';
            const isNote = msg.messageType === 'NOTE' || msg.senderType === 'NOTE';

            const formatMsgTime = (d) => {
              const parsed = new Date(d);
              return Number.isNaN(parsed.getTime())
                ? ''
                : parsed.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
            };

            // 3.1. System Log Bubble
            if (isSystem) {
              return (
                <div key={msg.id} className="msg-bubble-system">
                  {msg.content}
                </div>
              );
            }

            // 3.2. Private Internal Team Note Bubble
            if (isNote) {
              return (
                <div
                  key={msg.id}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    width: '100%',
                    margin: '4px 0',
                  }}
                >
                  <div
                    style={{
                      background: 'rgba(245, 158, 11, 0.1)',
                      border: '1px solid rgba(245, 158, 11, 0.35)',
                      borderRadius: '12px',
                      padding: '10px 14px',
                      maxWidth: '85%',
                      width: '100%',
                      boxShadow: '0 4px 12px rgba(0, 0, 0, 0.25)',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: '#f59e0b', fontWeight: '700' }}>
                        <Lock size={12} />
                        <span>INTERNAL NOTE • Team only</span>
                      </div>
                      <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                        {formatMsgTime(msg.createdAt)}
                      </span>
                    </div>
                    <div style={{ fontSize: '13px', color: '#fef3c7', lineHeight: 1.45, whiteSpace: 'pre-wrap' }}>
                      {msg.content}
                    </div>
                    {msg.senderAgent && (
                      <div style={{ fontSize: '10.5px', color: '#fbbf24', marginTop: '4px', textAlign: 'right' }}>
                        — {msg.senderAgent.name}
                      </div>
                    )}
                  </div>
                </div>
              );
            }

            // 3.3. Parse interactive buttons if message is interactive
            let interactivePills = [];
            if (msg.messageType === 'INTERACTIVE' && msg.rawPayload) {
              try {
                const parsed = JSON.parse(msg.rawPayload);
                interactivePills = Array.isArray(parsed.buttons) ? parsed.buttons : [];
              } catch (e) {}
            }

            // 3.4. Regular Inbound / Outbound WhatsApp Bubble
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
                    <div style={{ fontSize: '10.5px', color: '#a7f3d0', fontWeight: '600', marginBottom: '2px' }}>
                      {msg.senderAgent.name}
                    </div>
                  )}

                  {/* Media Content: Image */}
                  {msg.messageType === 'IMAGE' && (
                    <div style={{ marginBottom: '6px' }}>
                      {msg.mediaUrl ? (
                        <img
                          src={msg.mediaUrl}
                          alt="WhatsApp Attachment"
                          style={{
                            maxWidth: '100%',
                            maxHeight: '200px',
                            borderRadius: '8px',
                            display: 'block',
                            objectFit: 'cover',
                          }}
                        />
                      ) : msg.mediaId ? (
                        <AuthedMedia messageId={msg.id} kind="IMAGE" token={token} filename={msg.mediaFilename} />
                      ) : (
                        <div style={{ padding: '18px 12px', borderRadius: '8px', background: 'rgba(255,255,255,0.06)', color: 'var(--text-muted)', fontSize: '12px', textAlign: 'center' }}>
                          Media unavailable
                        </div>
                      )}
                    </div>
                  )}

                  {/* Media Content: Voice note / audio (previously rendered as
                      an empty bubble with only a filename caption) */}
                  {msg.messageType === 'AUDIO' && (
                    <div style={{ marginBottom: '6px' }}>
                      {msg.mediaUrl ? (
                        <audio controls src={msg.mediaUrl} style={{ maxWidth: '100%' }} />
                      ) : msg.mediaId ? (
                        <AuthedMedia messageId={msg.id} kind="AUDIO" token={token} filename={msg.mediaFilename} />
                      ) : (
                        <div style={{ padding: '12px', borderRadius: '8px', background: 'rgba(255,255,255,0.06)', color: 'var(--text-muted)', fontSize: '12px', textAlign: 'center' }}>
                          Voice message unavailable
                        </div>
                      )}
                    </div>
                  )}

                  {/* Media Content: Video */}
                  {msg.messageType === 'VIDEO' && (
                    <div style={{ marginBottom: '6px' }}>
                      {msg.mediaUrl ? (
                        <video controls src={msg.mediaUrl} style={{ maxWidth: '100%', maxHeight: '220px', borderRadius: '8px', display: 'block' }} />
                      ) : msg.mediaId ? (
                        <AuthedMedia messageId={msg.id} kind="VIDEO" token={token} filename={msg.mediaFilename} />
                      ) : (
                        <div style={{ padding: '12px', borderRadius: '8px', background: 'rgba(255,255,255,0.06)', color: 'var(--text-muted)', fontSize: '12px', textAlign: 'center' }}>
                          Video unavailable
                        </div>
                      )}
                    </div>
                  )}

                  {/* Media Content: Document */}
                  {msg.messageType === 'DOCUMENT' && (
                    <div
                      style={{
                        background: 'rgba(0,0,0,0.2)',
                        padding: '6px 10px',
                        borderRadius: '6px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        marginBottom: '6px',
                      }}
                    >
                      <FileText size={18} style={{ color: '#38bdf8' }} />
                      <div style={{ fontSize: '11.5px', fontWeight: '500', wordBreak: 'break-all' }}>
                        {msg.mediaUrl ? (
                          <a href={msg.mediaUrl} target="_blank" rel="noreferrer" style={{ color: '#38bdf8' }}>
                            {msg.mediaFilename || 'Document'}
                          </a>
                        ) : msg.mediaId ? (
                          <AuthedMedia messageId={msg.id} kind="DOCUMENT" token={token} filename={msg.mediaFilename} />
                        ) : (
                          msg.mediaFilename || 'Document'
                        )}
                      </div>
                    </div>
                  )}

                  {/* Text / Caption */}
                  <div style={{ fontSize: '13px', whiteSpace: 'pre-wrap', wordBreak: 'break-word', lineHeight: 1.45 }}>
                    {msg.content}
                  </div>

                  {/* Interactive Button Pills (Rendered on message) */}
                  {interactivePills.length > 0 && (
                    <div style={{ marginTop: '6px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      {interactivePills.map((btn, bIdx) => (
                        <div
                          key={bIdx}
                          style={{
                            background: 'rgba(255, 255, 255, 0.12)',
                            border: '1px solid rgba(255, 255, 255, 0.2)',
                            borderRadius: '6px',
                            padding: '5px 8px',
                            fontSize: '11.5px',
                            color: '#fff',
                            textAlign: 'center',
                            fontWeight: '600',
                          }}
                        >
                          🔘 {btn.title || btn.text || `Option ${bIdx + 1}`}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Footer: Time & Meta WhatsApp Tick Status */}
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'flex-end',
                      gap: '4px',
                      marginTop: '3px',
                      fontSize: '10px',
                      color: isInbound ? 'var(--text-muted)' : '#d1fae5',
                    }}
                  >
                    <span>{formatMsgTime(msg.createdAt)}</span>
                    {!isInbound && (
                      <span>
                        {msg.status === 'READ' ? (
                          <CheckCheck size={12} style={{ color: 'var(--wa-blue-tick)' }} title="Read by recipient" />
                        ) : msg.status === 'DELIVERED' ? (
                          <CheckCheck size={12} style={{ color: '#a7f3d0' }} title="Delivered to device" />
                        ) : msg.status === 'SENT' ? (
                          <Check size={12} style={{ color: '#a7f3d0' }} title="Sent via Meta Cloud API" />
                        ) : msg.status === 'FAILED' ? (
                          <AlertTriangle size={12} style={{ color: '#f87171' }} title={msg.errorMessage || 'Failed'} />
                        ) : (
                          <Clock size={11} title="Pending" />
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
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '4px 8px' }}>
            <span style={{ fontSize: '11.5px', color: 'var(--wa-primary)', fontStyle: 'italic' }}>
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
            bottom: '115px',
            left: '12px',
            right: '12px',
            background: 'var(--bg-surface)',
            border: '1px solid var(--border-medium)',
            borderRadius: 'var(--radius-lg)',
            padding: '12px',
            boxShadow: 'var(--shadow-card)',
            zIndex: 20,
            maxHeight: '260px',
            overflowY: 'auto',
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
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '6px' }}>
            {quickReplies.map((qr, idx) => (
              <button
                key={idx}
                onClick={() => {
                  setInputContent(qr.text);
                  setShowQuickReplies(false);
                  textareaRef.current?.focus();
                }}
                className="btn btn-secondary"
                style={{ textAlign: 'left', padding: '6px 8px', fontSize: '11.5px', justifyContent: 'flex-start' }}
              >
                <div>
                  <div style={{ fontWeight: '600', color: 'var(--wa-primary)' }}>{qr.label}</div>
                  <div
                    style={{
                      fontSize: '10.5px',
                      color: 'var(--text-muted)',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      maxWidth: '220px',
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

      {/* 5. Quick Attachment Flyout */}
      {showAttachmentMenu && (
        <div
          style={{
            position: 'absolute',
            bottom: '115px',
            left: '16px',
            background: 'var(--bg-surface)',
            border: '1px solid var(--border-medium)',
            borderRadius: 'var(--radius-lg)',
            padding: '10px',
            boxShadow: 'var(--shadow-card)',
            zIndex: 20,
            width: '260px',
            maxWidth: '90vw',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px', alignItems: 'center' }}>
            <span style={{ fontSize: '11.5px', fontWeight: '600', color: '#fff' }}>📎 Attach Media / Doc</span>
            <button
              onClick={() => setShowAttachmentMenu(false)}
              className="btn btn-ghost"
              style={{ padding: '2px 6px', fontSize: '11px' }}
            >
              ✕
            </button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <input
              type="url"
              value={attachUrl}
              onChange={(e) => setAttachUrl(e.target.value)}
              placeholder="Paste a public file URL (https://...)"
              aria-label="Attachment URL"
              style={{ background: '#0b1120', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '6px', padding: '7px 9px', color: '#fff', fontSize: '12px', width: '100%' }}
            />
            <input
              type="text"
              value={attachName}
              onChange={(e) => setAttachName(e.target.value)}
              placeholder="File name (optional)"
              aria-label="Attachment file name"
              style={{ background: '#0b1120', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '6px', padding: '7px 9px', color: '#fff', fontSize: '12px', width: '100%' }}
            />
            <button
              onClick={() => {
                const url = attachUrl.trim();
                if (!/^https:\/\//i.test(url)) {
                  alert('Please paste a valid https:// file URL.');
                  return;
                }
                const fromUrl = url.split('/').pop().split('?')[0];
                const filename = attachName.trim() || decodeURIComponent(fromUrl || 'attachment');
                const ext = filename.toLowerCase();
                const type = ext.endsWith('.pdf') || ext.endsWith('.doc') || ext.endsWith('.docx')
                  ? 'DOCUMENT'
                  : ext.endsWith('.mp4') || ext.endsWith('.mov')
                    ? 'VIDEO'
                    : ext.endsWith('.mp3') || ext.endsWith('.ogg') || ext.endsWith('.wav') || ext.endsWith('.m4a')
                      ? 'AUDIO'
                      : 'IMAGE';
                setAttachUrl('');
                setAttachName('');
                handleQuickAttachment(type, filename, url);
              }}
              className="btn btn-secondary"
              style={{ justifyContent: 'center', fontSize: '12px', padding: '6px 8px', gap: '8px' }}
            >
              <FileText size={14} style={{ color: '#38bdf8' }} />
              <span>Send file from URL</span>
            </button>
            <div style={{ fontSize: '10.5px', color: 'var(--text-muted)', lineHeight: 1.4 }}>
              The file must be publicly reachable over https. It is delivered to the customer exactly as hosted.
            </div>
          </div>
        </div>
      )}

      {/* 6. Interactive Composer Container */}
      <div
        className="chat-composer-box"
        style={{
          padding: '10px 12px',
          paddingBottom: 'max(10px, env(safe-area-inset-bottom, 10px))',
          background: 'rgba(14, 21, 36, 0.98)',
          borderTop: '1px solid var(--border-subtle)',
        }}
      >
        {/* 6.1 Mode Switcher Tabs */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '6px',
            overflowX: 'auto',
            gap: '8px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0 }}>
            <button
              type="button"
              onClick={() => setComposeMode('WHATSAPP')}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                padding: '4px 10px',
                borderRadius: '6px',
                fontSize: '11.5px',
                fontWeight: '600',
                cursor: 'pointer',
                border: 'none',
                background: composeMode === 'WHATSAPP' ? 'rgba(37, 211, 102, 0.18)' : 'transparent',
                color: composeMode === 'WHATSAPP' ? '#25D366' : 'var(--text-secondary)',
              }}
            >
              <MessageSquare size={12} />
              <span>WhatsApp</span>
            </button>

            <button
              type="button"
              onClick={() => setComposeMode('NOTE')}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                padding: '4px 10px',
                borderRadius: '6px',
                fontSize: '11.5px',
                fontWeight: '600',
                cursor: 'pointer',
                border: 'none',
                background: composeMode === 'NOTE' ? 'rgba(245, 158, 11, 0.18)' : 'transparent',
                color: composeMode === 'NOTE' ? '#f59e0b' : 'var(--text-secondary)',
              }}
            >
              <Lock size={11} />
              <span>Team Note</span>
            </button>

            <button
              type="button"
              onClick={() => setComposeMode('INTERACTIVE')}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                padding: '4px 10px',
                borderRadius: '6px',
                fontSize: '11.5px',
                fontWeight: '600',
                cursor: 'pointer',
                border: 'none',
                background: composeMode === 'INTERACTIVE' ? 'rgba(56, 189, 248, 0.18)' : 'transparent',
                color: composeMode === 'INTERACTIVE' ? '#38bdf8' : 'var(--text-secondary)',
              }}
            >
              <Sparkles size={11} />
              <span>Buttons</span>
            </button>
          </div>

          {/* Quick Reaction Pills */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '3px', flexShrink: 0 }}>
            {['👍', '🙏', '❤️', '🎓', '📚'].map((emoji) => (
              <button
                key={emoji}
                type="button"
                onClick={() => insertEmoji(emoji)}
                style={{
                  background: 'none',
                  border: 'none',
                  fontSize: '13px',
                  cursor: 'pointer',
                  padding: '3px 4px',
                  borderRadius: '4px',
                }}
                title={`Insert ${emoji}`}
              >
                {emoji}
              </button>
            ))}
          </div>
        </div>

        {/* 6.2 Interactive Buttons Config Bar (Visible only when in INTERACTIVE mode) */}
        {composeMode === 'INTERACTIVE' && (
          <div
            style={{
              background: 'rgba(56, 189, 248, 0.08)',
              border: '1px solid rgba(56, 189, 248, 0.25)',
              borderRadius: '8px',
              padding: '6px 10px',
              marginBottom: '6px',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
              <span style={{ fontSize: '11px', fontWeight: '600', color: '#38bdf8' }}>
                WhatsApp Action Buttons (Max 3)
              </span>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', alignItems: 'center' }}>
              {interactiveButtons.map((btn, idx) => (
                <span
                  key={idx}
                  style={{
                    fontSize: '11px',
                    background: 'rgba(255, 255, 255, 0.1)',
                    color: '#fff',
                    padding: '2px 6px',
                    borderRadius: '4px',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                  }}
                >
                  <span>{btn}</span>
                  <button
                    type="button"
                    onClick={() => setInteractiveButtons((prev) => prev.filter((_, i) => i !== idx))}
                    style={{ background: 'none', border: 'none', color: '#f87171', cursor: 'pointer', padding: 0 }}
                  >
                    ×
                  </button>
                </span>
              ))}

              {interactiveButtons.length < 3 && (
                <div style={{ display: 'inline-flex', gap: '3px' }}>
                  <input
                    type="text"
                    value={newBtnInput}
                    onChange={(e) => setNewBtnInput(e.target.value)}
                    placeholder="New button..."
                    maxLength={20}
                    style={{
                      background: 'var(--bg-surface)',
                      border: '1px solid var(--border-medium)',
                      borderRadius: '4px',
                      color: '#fff',
                      padding: '3px 6px',
                      outline: 'none',
                      width: '110px',
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        if (newBtnInput.trim()) {
                          setInteractiveButtons((prev) => [...prev, newBtnInput.trim()]);
                          setNewBtnInput('');
                        }
                      }
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => {
                      if (newBtnInput.trim()) {
                        setInteractiveButtons((prev) => [...prev, newBtnInput.trim()]);
                        setNewBtnInput('');
                      }
                    }}
                    className="btn btn-secondary"
                    style={{ padding: '2px 6px', fontSize: '11px' }}
                  >
                    +
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* 6.3 Input Box & Action Buttons */}
        <form onSubmit={handleSend} style={{ display: 'flex', alignItems: 'flex-end', gap: '8px' }}>
          {/* Quick Action Tools */}
          <div style={{ display: 'flex', gap: '2px', paddingBottom: '3px', flexShrink: 0 }}>
            <button
              type="button"
              onClick={() => setShowQuickReplies(!showQuickReplies)}
              className="btn-tool"
              style={{ color: showQuickReplies ? 'var(--wa-primary)' : 'var(--text-secondary)' }}
              title="Canned Quick Responses"
            >
              ⚡
            </button>

            <button
              type="button"
              onClick={() => setShowAttachmentMenu(!showAttachmentMenu)}
              className="btn-tool"
              style={{ color: showAttachmentMenu ? '#38bdf8' : 'var(--text-secondary)' }}
              title="Attach Document or Brochure"
            >
              <Paperclip size={17} />
            </button>
          </div>

          {/* Text Area (Fills all remaining width) */}
          <div style={{ flex: 1, minWidth: 0, position: 'relative' }}>
            <textarea
              ref={textareaRef}
              rows={1}
              value={inputContent}
              maxLength={4096}
              onChange={(e) => {
                setInputContent(e.target.value);
                signalTyping();
              }}
              onKeyDown={handleKeyDown}
              placeholder={
                composeMode === 'NOTE'
                  ? '🔒 Private staff note...'
                  : composeMode === 'INTERACTIVE'
                  ? 'Question with buttons...'
                  : messagingWindow.isOpen
                  ? 'WhatsApp reply...'
                  : '⚠️ 24-hr window expired. Use Template...'
              }
              className="chat-textarea"
              style={{
                width: '100%',
                background:
                  composeMode === 'NOTE'
                    ? 'rgba(245, 158, 11, 0.08)'
                    : composeMode === 'INTERACTIVE'
                    ? 'rgba(56, 189, 248, 0.08)'
                    : 'var(--bg-surface)',
                border:
                  composeMode === 'NOTE'
                    ? '1px solid rgba(245, 158, 11, 0.5)'
                    : composeMode === 'INTERACTIVE'
                    ? '1px solid rgba(56, 189, 248, 0.5)'
                    : '1px solid var(--border-medium)',
                borderRadius: '22px',
                color: '#fff',
                padding: '9px 14px',
                resize: 'none',
                outline: 'none',
                fontFamily: 'inherit',
                lineHeight: 1.4,
              }}
            />
            {inputContent.length > 3800 && (
              <span style={{ position: 'absolute', right: '12px', bottom: '-14px', fontSize: '10px', color: inputContent.length >= 4096 ? '#f87171' : 'var(--text-muted)' }}>
                {inputContent.length}/4096
              </span>
            )}
          </div>

          {/* Modern Circular WhatsApp Send Button */}
          <button
            type="submit"
            disabled={!inputContent.trim() || sending}
            className="chat-send-btn"
            style={{
              width: '40px',
              height: '40px',
              minWidth: '40px',
              borderRadius: '50%',
              background:
                composeMode === 'NOTE'
                  ? 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)'
                  : composeMode === 'INTERACTIVE'
                  ? 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)'
                  : 'linear-gradient(135deg, #25D366 0%, #128C7E 100%)',
              border: 'none',
              color: '#fff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              cursor: 'pointer',
              opacity: !inputContent.trim() || sending ? 0.6 : 1,
              boxShadow:
                composeMode === 'NOTE'
                  ? '0 4px 14px rgba(245, 158, 11, 0.35)'
                  : '0 4px 14px rgba(37, 211, 102, 0.35)',
            }}
            title={composeMode === 'NOTE' ? 'Send Team Note' : 'Send WhatsApp Message'}
          >
            {composeMode === 'NOTE' ? <Lock size={16} /> : <Send size={16} />}
          </button>
        </form>
      </div>
    </main>
  );
}
