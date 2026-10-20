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

export default function ChatCanvas({ onOpenTemplatePicker, onToggleSidebar, isSidebarOpen, onBack }) {
  const { agent, isAdmin, token } = useAuth();
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
  const [interactiveButtons, setInteractiveButtons] = useState([
    'Book Live Demo',
    'Download Syllabus',
    'Talk to Counselor',
  ]);
  const [newBtnInput, setNewBtnInput] = useState('');

  const messagesEndRef = useRef(null);
  const messagesContainerRef = useRef(null);
  const textareaRef = useRef(null);

  // Safe container-only auto-scroll (never scrolls window, document, or header off-screen)
  useEffect(() => {
    if (messagesContainerRef.current) {
      messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
    }
  }, [messages, typingUsers]);

  // Keep window and canvas header pinned to top when switching chats
  useEffect(() => {
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
      setInputContent('');
    } catch (err) {
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
      label: 'NEET Fees & Batches',
      text: 'Namaste! Our NEET 2026-27 batch fee is ₹85,000/year including study materials, weekly tests, and Kota top mentors.',
    },
    {
      label: 'Demo Class Schedule',
      text: 'You can attend a complimentary 2-hour Live Demo this Saturday at 5 PM. Would you like us to register your slot?',
    },
    {
      label: 'Center Location & Timings',
      text: 'Our center is open Mon-Sat from 9 AM to 7 PM at 3rd Floor, Apex Tower, Kota / Bandra West, Mumbai.',
    },
    {
      label: 'Scholarship Test',
      text: 'We offer up to 90% scholarship based on the Apex Talent Hunt Test (ATHT) conducted every Sunday online and offline.',
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
                  onChange={(e) => assignChat(activeChat.id, e.target.value || null)}
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
                onClick={() => assignChat(activeChat.id, agent.id)}
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
              onClick={() => updateChatStatus(activeChat.id, 'OPEN')}
              className="btn btn-secondary"
              style={{ width: '34px', height: '34px', padding: 0 }}
              title="Reopen Conversation"
            >
              <RotateCcw size={14} />
            </button>
          ) : (
            <button
              onClick={() => updateChatStatus(activeChat.id, 'RESOLVED')}
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
                Meta 24h Window Active: {messagingWindow.hoursRemaining}h remaining
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
          messages.map((msg) => {
            const isInbound = msg.direction === 'INBOUND';
            const isSystem = msg.senderType === 'SYSTEM';
            const isNote = msg.messageType === 'NOTE' || msg.senderType === 'NOTE';

            const formatMsgTime = (d) =>
              new Date(d).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });

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
                      <img
                        src={msg.mediaUrl || 'https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?w=600'}
                        alt="WhatsApp Attachment"
                        style={{
                          maxWidth: '100%',
                          maxHeight: '200px',
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
                        {msg.mediaFilename || 'Document.pdf'}
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
          <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
            <button
              onClick={() =>
                handleQuickAttachment(
                  'DOCUMENT',
                  'NEET_Course_Brochure_2026.pdf',
                  'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf'
                )
              }
              className="btn btn-secondary"
              style={{ justifyContent: 'flex-start', fontSize: '11.5px', padding: '5px 8px', gap: '8px' }}
            >
              <FileText size={14} style={{ color: '#38bdf8' }} />
              <span>Kota NEET Brochure (PDF)</span>
            </button>

            <button
              onClick={() =>
                handleQuickAttachment(
                  'DOCUMENT',
                  'Fee_Structure_Installments_2026.pdf',
                  'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf'
                )
              }
              className="btn btn-secondary"
              style={{ justifyContent: 'flex-start', fontSize: '11.5px', padding: '5px 8px', gap: '8px' }}
            >
              <FileText size={14} style={{ color: '#10b981' }} />
              <span>Fee Structure & EMI</span>
            </button>

            <button
              onClick={() =>
                handleQuickAttachment(
                  'IMAGE',
                  'Apex_Scholarship_Admit_Card.jpg',
                  'https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?w=600'
                )
              }
              className="btn btn-secondary"
              style={{ justifyContent: 'flex-start', fontSize: '11.5px', padding: '5px 8px', gap: '8px' }}
            >
              <ImageIcon size={14} style={{ color: '#f59e0b' }} />
              <span>Scholarship Admit Card (JPG)</span>
            </button>
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
              onChange={(e) => setInputContent(e.target.value)}
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
