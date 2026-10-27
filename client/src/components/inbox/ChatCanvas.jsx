import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Send,
  Paperclip,
  Zap,
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
  Copy,
  ShoppingBag,
  CreditCard,
  QrCode,
  Package,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useChat } from '../../context/ChatContext';
import { useSocket } from '../../context/SocketContext';
import { useToast } from '../../context/ToastContext';
import AuthedMedia from './AuthedMedia';
import ClosedWindowBar from './ClosedWindowBar';
import MessageActionSheet from './MessageActionSheet';

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

export default function ChatCanvas({ onOpenTemplatePicker, onToggleSidebar, isSidebarOpen, onBack }) {
  const { agent, isAdmin, token } = useAuth();
  const { emitTyping } = useSocket();
  const toast = useToast();
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
    snoozeChat,
    replyingTo,
    setReplyingTo,
  } = useChat();
  const [showSnoozeMenu, setShowSnoozeMenu] = useState(false);
  const [pendingMentions, setPendingMentions] = useState([]); // [{id, name}]
  const [mentionQuery, setMentionQuery] = useState(null); // string while an @token is being typed (NOTE mode)

  const mentionCandidates =
    mentionQuery === null
      ? []
      : agentsList.filter(
          (a) =>
            a.id !== agent?.id &&
            a.name.toLowerCase().includes(mentionQuery.toLowerCase())
        );

  const pickMention = (candidate) => {
    setInputContent((prev) => prev.replace(/@([\w ]*)$/, `@${candidate.name} `));
    setPendingMentions((prev) =>
      prev.some((m) => m.id === candidate.id) ? prev : [...prev, { id: candidate.id, name: candidate.name }]
    );
    setMentionQuery(null);
    textareaRef.current?.focus();
  };

  const snoozePresets = () => {
    const now = new Date();
    const inOneHour = new Date(now.getTime() + 60 * 60 * 1000);
    const tomorrowNine = new Date(now);
    tomorrowNine.setDate(tomorrowNine.getDate() + 1);
    tomorrowNine.setHours(9, 0, 0, 0);
    const nextWeek = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    return [
      { label: 'For 1 hour', until: inOneHour },
      { label: 'Tomorrow, 9 AM', until: tomorrowNine },
      { label: 'Next week', until: nextWeek },
    ];
  };

  const applySnooze = async (until) => {
    setShowSnoozeMenu(false);
    try {
      await snoozeChat(activeChat.id, until ? until.toISOString() : null);
    } catch (err) {
      toast.error(err.message);
    }
  };

  const [inputContent, setInputContent] = useState('');
  const [composeMode, setComposeMode] = useState('WHATSAPP'); // 'WHATSAPP' | 'NOTE' | 'INTERACTIVE'
  const [sending, setSending] = useState(false);
  const [agentsList, setAgentsList] = useState([]);
  const [showQuickReplies, setShowQuickReplies] = useState(false);
  const [tenantQuickReplies, setTenantQuickReplies] = useState([]);
  const [qrSearch, setQrSearch] = useState('');
  const [qrForm, setQrForm] = useState(null); // {id?, title, body, shortcut} while managing
  const [qrError, setQrError] = useState(null);
  const [showAttachmentMenu, setShowAttachmentMenu] = useState(false);
  const [attachUrl, setAttachUrl] = useState('');
  const [attachName, setAttachName] = useState('');
  const [interactiveButtons, setInteractiveButtons] = useState([
    'Yes, please',
    'No, thanks',
    'Talk to support',
  ]);
  const [newBtnInput, setNewBtnInput] = useState('');

  // DoubleTick WhatsApp Commerce & Payments
  const [showCommerceDrawer, setShowCommerceDrawer] = useState(false);
  const [commerceTab, setCommerceTab] = useState('products'); // 'products' | 'payment'
  const [catalogProducts, setCatalogProducts] = useState([]);
  const [catalogSettings, setCatalogSettings] = useState({ upiId: 'teambee@upi', merchantName: 'WhatsApp Store' });
  const [loadingCatalog, setLoadingCatalog] = useState(false);
  const [payAmount, setPayAmount] = useState('');
  const [payNote, setPayNote] = useState('');
  const [sendingCommerce, setSendingCommerce] = useState(false);

  useEffect(() => {
    if (!showCommerceDrawer) return;
    async function loadCatalog() {
      setLoadingCatalog(true);
      try {
        const res = await fetch('/api/commerce/products', {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        const data = await res.json();
        if (data.success) {
          setCatalogProducts(data.products || []);
          if (data.settings) setCatalogSettings(data.settings);
        }
      } catch (err) {
        console.error('Failed to load catalog:', err);
      } finally {
        setLoadingCatalog(false);
      }
    }
    loadCatalog();
  }, [showCommerceDrawer, token]);

  const handleSendProductToChat = async (product) => {
    if (!activeChat?.id) return;
    setSendingCommerce(true);
    try {
      const res = await fetch(`/api/commerce/send-product/${activeChat.id}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ productId: product.id }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success(`Product "${product.title}" sent to WhatsApp chat!`);
        setShowCommerceDrawer(false);
      } else {
        toast.error(data.error || 'Failed to send product');
      }
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSendingCommerce(false);
    }
  };

  const handleSendPaymentRequest = async (e) => {
    e.preventDefault();
    if (!activeChat?.id || !payAmount || Number(payAmount) <= 0) {
      toast.error('Please enter a valid payment amount');
      return;
    }
    setSendingCommerce(true);
    try {
      const res = await fetch(`/api/commerce/send-payment/${activeChat.id}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          amount: Number(payAmount),
          note: payNote.trim() || 'Order Payment',
        }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success(`Payment request for ₹${payAmount} sent!`);
        setShowCommerceDrawer(false);
        setPayAmount('');
        setPayNote('');
      } else {
        toast.error(data.error || 'Failed to send payment request');
      }
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSendingCommerce(false);
    }
  };

  const messagesEndRef = useRef(null);
  const messagesContainerRef = useRef(null);
  const textareaRef = useRef(null);
  const stickToBottomRef = useRef(true);
  const typingTimeoutRef = useRef(null);

  // Message actions (long-press on touch, right-click on desktop): a
  // small action sheet for the message — today it offers Copy for any
  // message that carries text. The send API has no reply-context support
  // yet, so Reply is deliberately not offered rather than faked.
  const [msgMenuMsg, setMsgMenuMsg] = useState(null);
  const pressTimerRef = useRef(null);
  const openMsgMenu = (msg) => {
    if (navigator.vibrate) {
      try {
        navigator.vibrate(10);
      } catch (err) {}
    }
    setMsgMenuMsg(msg);
  };
  const msgPressProps = (msg) => {
    if (!msg?.content) return {};
    return {
      onTouchStart: () => {
        clearTimeout(pressTimerRef.current);
        pressTimerRef.current = setTimeout(() => openMsgMenu(msg), 500);
      },
      onTouchEnd: () => clearTimeout(pressTimerRef.current),
      onTouchMove: () => clearTimeout(pressTimerRef.current),
      onContextMenu: (e) => {
        e.preventDefault();
        openMsgMenu(msg);
      },
    };
  };
  const copyMsgText = async () => {
    const text = msgMenuMsg?.content || '';
    setMsgMenuMsg(null);
    try {
      await navigator.clipboard.writeText(text);
    } catch (err) {
      const ta = document.createElement('textarea');
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      try {
        document.execCommand('copy');
      } catch (err2) {}
      ta.remove();
    }
  };
  useEffect(() => {
    if (!msgMenuMsg) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') setMsgMenuMsg(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [msgMenuMsg]);

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

  // Auto-grow the composer with the draft (up to the .chat-textarea
  // max-height of 120px, then it scrolls inside). The textarea is
  // rows={1} and nothing ever resized it, so a long message was edited
  // inside a one-line window and wrapped text looked clipped.
  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = 'auto';
    const borderY = ta.offsetHeight - ta.clientHeight;
    const full = ta.scrollHeight + borderY;
    ta.style.height = `${Math.min(full, 120)}px`;
    ta.style.overflowY = full > 120 ? 'auto' : 'hidden';
  }, [inputContent, activeChat?.id, composeMode]);

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

  // Build the display snapshot stored with an outgoing reply. The server
  // re-validates the target and derives the same shape, so this is purely
  // for instant (optimistic) rendering.
  const buildReplySnapshot = (msg) => ({
    messageId: msg.id,
    chatId: activeChat?.id,
    waMessageId: msg.waMessageId,
    content: String(msg.content || '').slice(0, 200),
    senderType: msg.senderType,
    senderName:
      msg.senderType === 'CUSTOMER'
        ? activeChat?.contact?.name || 'Customer'
        : msg.senderAgent?.name || 'Team',
  });

  const startReply = (msg) => {
    if (!msg?.waMessageId) return;
    setReplyingTo(buildReplySnapshot(msg));
    setMsgMenuMsg(null);
    // Notes cannot quote; if the agent was composing a note, switch back
    // to the WhatsApp composer so the reply actually goes to the customer.
    if (composeMode === 'NOTE') setComposeMode('WHATSAPP');
  };

  // Resolve the quote to render inside a bubble: server-attached replyTo
  // (history), a stored snapshot in rawPayload (live socket records), or
  // Meta's context pointer on an inbound reply resolved against the
  // messages already on screen.
  const resolveReplyTo = (msg) => {
    if (msg.replyTo?.waMessageId) return msg.replyTo;
    if (!msg.rawPayload) return null;
    try {
      const parsed = JSON.parse(msg.rawPayload);
      if (parsed?.replyTo?.waMessageId) return parsed.replyTo;
      const contextId = parsed?.context?.id;
      if (contextId) {
        const quoted = messages.find((m) => m.waMessageId === contextId);
        if (quoted) return buildReplySnapshot(quoted);
      }
    } catch (parseError) {}
    return null;
  };

  const handleSend = async (e) => {
    if (e) e.preventDefault();
    if (!inputContent.trim()) return;

    const content = inputContent.trim();
    // ⚡ Clear input immediately so user feels 0ms latency
    setInputContent('');
    setSending(true);
    // An armed reply belongs to exactly one send; take it now and clear
    // the chip. Restored below if the send fails.
    const replyForSend =
      composeMode !== 'NOTE' && replyingTo && activeChat && replyingTo.chatId === activeChat.id
        ? replyingTo
        : null;
    if (replyForSend) setReplyingTo(null);

    try {
      if (composeMode === 'NOTE') {
        // Send Private Team Note (with @mentions whose @Name survived edits)
        const mentionIds = pendingMentions
          .filter((m) => content.includes(`@${m.name}`))
          .map((m) => m.id);
        setPendingMentions([]);
        setMentionQuery(null);
        await sendMessage(content, {
          isInternal: true,
          messageType: 'NOTE',
          mentions: mentionIds,
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
          ...(replyForSend ? { replyTo: replyForSend } : {}),
        });
      } else {
        // Standard WhatsApp Outbound Message
        await sendMessage(content, {
          messageType: 'TEXT',
          ...(replyForSend ? { replyTo: replyForSend } : {}),
        });
      }
    } catch (err) {
      // Never destroy the agent's text on a failed send: restore the draft
      // (unless they have already started typing something new).
      setInputContent((prev) => (prev.trim() ? prev : content));
      if (replyForSend) setReplyingTo((prev) => prev || replyForSend);
      toast.info(err.message);
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
      toast.error(err.message);
    } finally {
      setSending(false);
    }
  };

  // Per-tenant quick replies from the API; the built-in starters below show
  // only until the workspace saves its own (admins manage them inline).
  const DEFAULT_QUICK_REPLIES = [
    { id: null, title: 'Greeting', shortcut: null, body: 'Namaste! Thanks for reaching out to us. How can I help you today?' },
    { id: null, title: 'Ask for details', shortcut: null, body: 'Could you please share a few more details so I can help you better?' },
    { id: null, title: 'Follow-up', shortcut: null, body: 'Thanks for your patience. We are checking this for you and will update you shortly.' },
    { id: null, title: 'Closing', shortcut: null, body: 'Thanks for contacting us. If you need anything else, just send us a message here. Have a great day!' },
  ];

  const qrApi = async (method, path, payload) => {
    const res = await fetch(`/api/quick-replies${path}`, {
      method,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: payload ? JSON.stringify(payload) : undefined,
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.error || 'Quick reply request failed');
    return data;
  };

  const refreshQuickReplies = async () => {
    try {
      const data = await qrApi('GET', '');
      setTenantQuickReplies(data.quickReplies || []);
    } catch (err) {
      // Starters remain available; management simply stays hidden offline.
      setTenantQuickReplies([]);
    }
  };

  useEffect(() => {
    if (token) refreshQuickReplies();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const saveQrForm = async () => {
    setQrError(null);
    try {
      if (qrForm.id) {
        await qrApi('PUT', `/${qrForm.id}`, qrForm);
      } else {
        await qrApi('POST', '', qrForm);
      }
      setQrForm(null);
      await refreshQuickReplies();
    } catch (err) {
      setQrError(err.message);
    }
  };

  const deleteQuickReply = async (reply) => {
    if (!window.confirm(`Delete quick reply "${reply.title}"?`)) return;
    try {
      await qrApi('DELETE', `/${reply.id}`);
      await refreshQuickReplies();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const quickReplies = tenantQuickReplies.length ? tenantQuickReplies : DEFAULT_QUICK_REPLIES;
  const visibleQuickReplies = quickReplies.filter((qr) => {
    const q = qrSearch.trim().toLowerCase().replace(/^\//, '');
    if (!q) return true;
    return (
      qr.title.toLowerCase().includes(q) ||
      qr.body.toLowerCase().includes(q) ||
      (qr.shortcut || '').includes(q)
    );
  });

  // Date-separated stream items, recomputed only when the messages
  // themselves change — not on every keystroke/socket tick re-render.
  const streamItems = useMemo(() => withDateSeparators(messages), [messages]);

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
          <h2 style={{ fontSize: '18px', color: 'var(--text-main)', marginBottom: '8px' }}>
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
      <div className="chat-canvas-header">
        <div className="fx" style={{ gap: 'var(--space-2)', minWidth: 0, flex: 1 }}>
          {/* Mobile Back Button: High contrast, easy tap */}
          {onBack && (
            <button
              type="button"
              onClick={onBack}
              className="btn-mobile-back btn-back"
              title="Back to conversation queue"
            >
              <ArrowLeft size={19} />
            </button>
          )}

          {/* Customer Avatar */}
          <div className="chat-avatar">
            {avatarLetter}
          </div>

          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span className="chat-title">{displayName}</span>
              <span className="desktop-only-header-control meta-chip" style={{ display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                <CheckCheck size={11} /> Meta Official
              </span>
            </div>
            {subText && (
              <div className="chat-sub">{subText}</div>
            )}
          </div>
        </div>

        {/* Action Controls: Status, Assignment (Desktop), Resolution & CRM Sidebar Toggle */}
        <div className="header-actions">
          {/* Snooze / follow-up reminder */}
          <div style={{ position: 'relative' }}>
            <button
              type="button"
              onClick={() => setShowSnoozeMenu((open) => !open)}
              className="btn btn-ghost chat-header-action"
              title={
                activeChat.snoozedUntil && new Date(activeChat.snoozedUntil) > new Date()
                  ? `Snoozed until ${new Date(activeChat.snoozedUntil).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}`
                  : 'Snooze / remind me later'
              }
              style={{
                padding: '6px',
                color:
                  activeChat.snoozedUntil && new Date(activeChat.snoozedUntil) > new Date()
                    ? '#f59e0b'
                    : 'var(--text-secondary)',
              }}
            >
              <Clock size={16} />
            </button>
            {showSnoozeMenu && (
              <>
                <div onClick={() => setShowSnoozeMenu(false)} style={{ position: 'fixed', inset: 0, zIndex: 40 }} />
                <div
                  style={{
                    position: 'absolute',
                    top: 'calc(100% + 6px)',
                    right: 0,
                    minWidth: '190px',
                    background: 'var(--bg-menu)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: '10px',
                    boxShadow: '0 18px 40px rgba(0,0,0,0.55)',
                    padding: '6px',
                    zIndex: 50,
                  }}
                >
                  <div style={{ fontSize: '10.5px', fontWeight: '700', color: 'var(--text-muted)', padding: '4px 8px', letterSpacing: '0.4px' }}>
                    SNOOZE THIS CHAT
                  </div>
                  {snoozePresets().map((preset) => (
                    <button
                      key={preset.label}
                      type="button"
                      onClick={() => applySnooze(preset.until)}
                      className="btn btn-ghost"
                      style={{ display: 'block', width: '100%', textAlign: 'left', padding: '10px 8px', fontSize: '12.5px', color: 'var(--text-main)' }}
                    >
                      {preset.label}
                    </button>
                  ))}
                  {activeChat.snoozedUntil && new Date(activeChat.snoozedUntil) > new Date() && (
                    <button
                      type="button"
                      onClick={() => applySnooze(null)}
                      className="btn btn-ghost"
                      style={{ display: 'block', width: '100%', textAlign: 'left', padding: '7px 8px', fontSize: '12.5px', color: '#f59e0b', borderTop: '1px solid var(--border-subtle)', marginTop: '4px' }}
                    >
                      Unsnooze now
                    </button>
                  )}
                </div>
              </>
            )}
          </div>

          {/* Status Badge */}
          <span
            className={
              isResolved
                ? 'badge badge-resolved chat-status-badge'
                : isUnassigned
                ? 'badge badge-unassigned chat-status-badge'
                : 'badge badge-open chat-status-badge'
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
                  onChange={(e) => assignChat(activeChat.id, e.target.value || null).catch((err) => toast.error(err.message))}
                  style={{
                    background: 'var(--bg-surface)',
                    color: 'var(--text-main)',
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
                onClick={() => assignChat(activeChat.id, agent.id).catch((err) => toast.error(err.message))}
                className="btn btn-primary btn-xs"
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
              onClick={() => updateChatStatus(activeChat.id, 'OPEN').catch((err) => toast.error(err.message))}
              className="btn btn-secondary chat-header-action"
              style={{ width: '34px', height: '34px', padding: 0 }}
              title="Reopen Conversation"
            >
              <RotateCcw size={14} />
            </button>
          ) : (
            <button
              onClick={() => updateChatStatus(activeChat.id, 'RESOLVED').catch((err) => toast.error(err.message))}
              className="btn btn-secondary chat-header-action"
              style={{ width: '34px', height: '34px', padding: 0 }}
              title="Mark Resolved"
            >
              <CheckCircle2 size={15} style={{ color: '#10b981' }} />
            </button>
          )}

          {/* CRM Info Button to toggle Customer sidebar */}
          <button className="chat-header-action"
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
      <div className={`window-bar ${messagingWindow.isOpen ? 'open' : 'closed'}`}>
        <div className="fx" style={{ gap: '6px', minWidth: 0, overflow: 'hidden' }}>
          {messagingWindow.isOpen ? (
            <>
              <Clock size={13} style={{ color: '#10b981', flexShrink: 0 }} />
              <span className="ellipsis">
                Meta 24h Window Active: {(() => { const hrs = parseFloat(messagingWindow.hoursRemaining); return Number.isFinite(hrs) ? (hrs >= 1 ? `${hrs.toFixed(1)}h` : `${Math.max(1, Math.round(hrs * 60))}m`) : '—'; })()} remaining
              </span>
            </>
          ) : (
            <>
              <AlertTriangle size={13} style={{ color: '#dc2626', flexShrink: 0 }} />
              <span className="ellipsis">
                24h Window Expired: Send template to re-engage
              </span>
            </>
          )}
        </div>

        <button
          onClick={onOpenTemplatePicker}
          className="btn btn-ghost btn-xs"
          style={{ color: '#25d366', flexShrink: 0 }}
        >
          <Sparkles size={12} /> Template
        </button>
      </div>

      {/* 3. Messages Stream */}
      <div
        className="messages-stream"
        role="log"
        aria-label="Chat messages"
        ref={messagesContainerRef}
        onScroll={handleMessageScroll}
       >
        {messagePagination?.hasMore && (
          <button
            type="button"
            onClick={() => loadOlderMessages().catch((error) => toast.error(error.message))}
            className="btn btn-secondary btn-xs"
            style={{ alignSelf: 'center' }}
          >
            Load older messages
          </button>
        )}
        {loadingMessages && messages.length === 0 ? (
          <div aria-hidden="true">
            <div className="skel skel-bubble" style={{ width: '46%' }} />
            <div className="skel skel-bubble right" style={{ width: '58%' }} />
            <div className="skel skel-bubble" style={{ width: '38%' }} />
            <div className="skel skel-bubble right" style={{ width: '42%' }} />
          </div>
        ) : messages.length === 0 ? (
          <div className="t-caption" style={{ textAlign: 'center', padding: 'var(--space-10) 0' }}>
            No messages logged in this session yet.
          </div>
        ) : (
          streamItems.map((msg) => {
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
            let noteMentions = [];
            if (isNote && msg.rawPayload) {
              try {
                const parsed = JSON.parse(msg.rawPayload);
                if (Array.isArray(parsed?.mentions)) noteMentions = parsed.mentions;
              } catch (parseError) {}
            }
            const mentionsMe = Boolean(agent?.id && noteMentions.includes(agent.id));

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
                        {mentionsMe && (
                          <span
                            style={{
                              fontSize: '9.5px',
                              background: '#f59e0b',
                              color: '#1c1005',
                              padding: '1px 6px',
                              borderRadius: '4px',
                              fontWeight: '800',
                            }}
                          >
                            YOU WERE MENTIONED
                          </span>
                        )}
                      </div>
                      <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                        {formatMsgTime(msg.createdAt)}
                      </span>
                    </div>
                    <div style={{ fontSize: '13px', color: '#fef3c7', lineHeight: 1.45, whiteSpace: 'pre-wrap' }}>
                      {msg.content}
                    </div>
                    {msg.senderAgent && (
                      <div style={{ fontSize: '10.5px', color: '#b45309', marginTop: '4px', textAlign: 'right' }}>
                        — {msg.senderAgent.name}
                      </div>
                    )}
                  </div>
                </div>
              );
            }

            // 3.3. Parse interactive buttons & commerce data
            let interactivePills = [];
            let commerceData = null;
            if (msg.messageType === 'INTERACTIVE' && msg.rawPayload) {
              try {
                const parsed = JSON.parse(msg.rawPayload);
                interactivePills = Array.isArray(parsed.buttons) ? parsed.buttons : [];
                commerceData = parsed.commerce || null;
              } catch (e) {}
            }

            // 3.4. Regular Inbound / Outbound WhatsApp Bubble
            return (
              <div
                key={msg.id}
                {...msgPressProps(msg)}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: isInbound ? 'flex-start' : 'flex-end',
                }}
              >
                <div className={isInbound ? 'msg-bubble-inbound' : 'msg-bubble-outbound'}>
                  {/* Quoted message (reply context) */}
                  {(() => {
                    const replyTo = resolveReplyTo(msg);
                    return replyTo ? (
                      <div className="msg-quote">
                        <div className="msg-quote-name">{replyTo.senderName}</div>
                        <div className="msg-quote-text">{replyTo.content}</div>
                      </div>
                    ) : null;
                  })()}

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
                          loading="lazy"
                          decoding="async"
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
                        <div style={{ padding: '18px 12px', borderRadius: '8px', background: 'rgba(15,23,42,0.04)', color: 'var(--text-muted)', fontSize: '12px', textAlign: 'center' }}>
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
                        <div style={{ padding: '12px', borderRadius: '8px', background: 'rgba(15,23,42,0.04)', color: 'var(--text-muted)', fontSize: '12px', textAlign: 'center' }}>
                          Voice message unavailable
                        </div>
                      )}
                    </div>
                  )}

                  {/* Media Content: Video */}
                  {msg.messageType === 'VIDEO' && (
                    <div style={{ marginBottom: '6px' }}>
                      {msg.mediaUrl ? (
                        <video controls preload="metadata" src={msg.mediaUrl} style={{ maxWidth: '100%', maxHeight: '220px', borderRadius: '8px', display: 'block' }} />
                      ) : msg.mediaId ? (
                        <AuthedMedia messageId={msg.id} kind="VIDEO" token={token} filename={msg.mediaFilename} />
                      ) : (
                        <div style={{ padding: '12px', borderRadius: '8px', background: 'rgba(15,23,42,0.04)', color: 'var(--text-muted)', fontSize: '12px', textAlign: 'center' }}>
                          Video unavailable
                        </div>
                      )}
                    </div>
                  )}

                  {/* Media Content: Document */}
                  {msg.messageType === 'DOCUMENT' && (
                    <div
                      style={{
                        background: 'rgba(15, 23, 42, 0.06)',
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

                  {/* WhatsApp Commerce & Product Card */}
                  {commerceData?.type === 'PRODUCT' && (
                    <div
                      style={{
                        background: '#ffffff',
                        border: '1px solid var(--border-medium)',
                        borderRadius: '10px',
                        overflow: 'hidden',
                        margin: '8px 0',
                        boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
                      }}
                    >
                      {commerceData.imageUrl && (
                        <img
                          src={commerceData.imageUrl}
                          alt={commerceData.title}
                          style={{ width: '100%', maxHeight: '140px', objectFit: 'cover', display: 'block' }}
                        />
                      )}
                      <div style={{ padding: '10px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                          <span style={{ fontSize: '13px', fontWeight: '700', color: 'var(--text-main)' }}>
                            {commerceData.title}
                          </span>
                          <span
                            style={{
                              background: 'rgba(37, 211, 102, 0.15)',
                              color: '#16a34a',
                              fontSize: '11.5px',
                              fontWeight: '800',
                              padding: '2px 8px',
                              borderRadius: '4px',
                            }}
                          >
                            ₹{Number(commerceData.price || 0).toLocaleString('en-IN')}
                          </span>
                        </div>
                        <div style={{ fontSize: '11.5px', color: 'var(--text-muted)', lineHeight: 1.35, marginBottom: '8px' }}>
                          {commerceData.description}
                        </div>
                        {commerceData.paymentLink && (
                          <a
                            href={commerceData.paymentLink}
                            target="_blank"
                            rel="noreferrer"
                            style={{
                              display: 'block',
                              textAlign: 'center',
                              background: 'var(--wa-primary)',
                              color: '#ffffff',
                              padding: '6px 10px',
                              borderRadius: '6px',
                              fontSize: '11.5px',
                              fontWeight: '700',
                              textDecoration: 'none',
                            }}
                          >
                            ⚡ Pay ₹{Number(commerceData.price || 0).toLocaleString('en-IN')} via UPI
                          </a>
                        )}
                      </div>
                    </div>
                  )}

                  {/* WhatsApp Instant UPI Payment Request Bubble */}
                  {commerceData?.type === 'PAYMENT_REQUEST' && (
                    <div
                      style={{
                        background: '#ffffff',
                        border: '1px solid rgba(37, 211, 102, 0.4)',
                        borderRadius: '10px',
                        padding: '12px',
                        margin: '8px 0',
                        boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', fontWeight: '700', color: '#16a34a', marginBottom: '4px' }}>
                        <CreditCard size={13} />
                        <span>INSTANT UPI PAYMENT REQUEST</span>
                      </div>
                      <div style={{ fontSize: '20px', fontWeight: '800', color: 'var(--text-main)', marginBottom: '2px' }}>
                        ₹{Number(commerceData.amount || 0).toLocaleString('en-IN')}
                      </div>
                      <div style={{ fontSize: '11.5px', color: 'var(--text-muted)', marginBottom: '6px' }}>
                        {commerceData.note} {commerceData.orderId ? `• Ref: ${commerceData.orderId}` : ''}
                      </div>
                      <div
                        style={{
                          fontSize: '11px',
                          color: 'var(--text-secondary)',
                          background: 'var(--bg-input)',
                          padding: '5px 8px',
                          borderRadius: '6px',
                          fontFamily: 'var(--font-mono)',
                          marginBottom: '8px',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                        }}
                      >
                        <span>UPI VPA: {commerceData.vpa || 'merchant@upi'}</span>
                        <button
                          type="button"
                          onClick={() => {
                            navigator.clipboard.writeText(commerceData.vpa || 'merchant@upi');
                            toast.success('UPI ID copied!');
                          }}
                          style={{
                            background: 'none',
                            border: 'none',
                            color: 'var(--wa-primary)',
                            cursor: 'pointer',
                            fontWeight: '700',
                            fontSize: '10.5px',
                          }}
                        >
                          COPY
                        </button>
                      </div>
                      {commerceData.paymentLink && (
                        <a
                          href={commerceData.paymentLink}
                          style={{
                            display: 'block',
                            textAlign: 'center',
                            background: '#16a34a',
                            color: '#ffffff',
                            padding: '7px 12px',
                            borderRadius: '6px',
                            fontSize: '12px',
                            fontWeight: '700',
                            textDecoration: 'none',
                          }}
                        >
                          ⚡ Open UPI App (GPay / PhonePe / Paytm)
                        </a>
                      )}
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
                            background: '#ffffff',
                            border: '1px solid var(--border-medium)',
                            borderRadius: '6px',
                            padding: '5px 8px',
                            fontSize: '11.5px',
                            color: '#128c7e',
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
                          <AlertTriangle size={12} style={{ color: '#dc2626' }} title={msg.errorMessage || 'Failed'} />
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

      {/* @mention picker (NOTE compose mode) */}
      {composeMode === 'NOTE' && mentionQuery !== null && mentionCandidates.length > 0 && (
        <div
          style={{
            position: 'absolute',
            bottom: '115px',
            left: '12px',
            background: 'var(--bg-surface)',
            border: '1px solid rgba(245, 158, 11, 0.4)',
            borderRadius: 'var(--radius-lg)',
            padding: '8px',
            boxShadow: 'var(--shadow-card)',
            zIndex: 20,
            minWidth: '210px',
            maxWidth: 'calc(100vw - 24px)',
          }}
        >
          <div style={{ fontSize: '10.5px', fontWeight: '700', color: '#f59e0b', padding: '2px 6px 6px 6px', letterSpacing: '0.4px' }}>
            MENTION A TEAMMATE
          </div>
          {mentionCandidates.slice(0, 6).map((candidate) => (
            <button
              key={candidate.id}
              type="button"
              onClick={() => pickMention(candidate)}
              className="btn btn-ghost"
              style={{ display: 'flex', width: '100%', textAlign: 'left', padding: '6px 8px', fontSize: '12.5px', color: 'var(--text-main)', alignItems: 'center', gap: '8px' }}
            >
              <span
                style={{
                  width: '22px',
                  height: '22px',
                  borderRadius: '50%',
                  background: 'rgba(245,158,11,0.2)',
                  color: '#f59e0b',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '10px',
                  fontWeight: '700',
                  flexShrink: 0,
                }}
              >
                {(candidate.name || '?').charAt(0).toUpperCase()}
              </span>
              {candidate.name}
              <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>{candidate.role}</span>
            </button>
          ))}
        </div>
      )}

      {/* 4. Quick Replies Flyout */}
      {showQuickReplies && (
        <div className="flyout">
          <div className="flyout-head">
            <span className="flyout-title"><Zap size={13} /> Quick Replies</span>
            <button
              onClick={() => { setShowQuickReplies(false); setQrForm(null); setQrError(null); }}
              className="btn btn-ghost btn-xs"
            >
              ✕ Close
            </button>
          </div>

          {qrForm ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '7px' }}>
              <input
                value={qrForm.title}
                onChange={(e) => setQrForm({ ...qrForm, title: e.target.value })}
                placeholder="Title, e.g. Price list"
                maxLength={80}
                className="input input-sm"
              />
              <input
                value={qrForm.shortcut || ''}
                onChange={(e) => setQrForm({ ...qrForm, shortcut: e.target.value })}
                placeholder="Shortcut (optional), e.g. price — type /price in the composer"
                maxLength={40}
                className="input input-sm"
              />
              <textarea
                value={qrForm.body}
                onChange={(e) => setQrForm({ ...qrForm, body: e.target.value })}
                placeholder="The message text agents will insert…"
                rows={3}
                maxLength={1000}
                className="input input-sm input-area"
              />
              {qrError && <div style={{ fontSize: '11.5px', color: '#b91c1c' }}>{qrError}</div>}
              <div style={{ display: 'flex', gap: '8px' }}>
                <button onClick={saveQrForm} className="btn btn-primary btn-xs">
                  {qrForm.id ? 'Save changes' : 'Add quick reply'}
                </button>
                <button onClick={() => { setQrForm(null); setQrError(null); }} className="btn btn-ghost btn-xs">
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <>
              <input
                value={qrSearch}
                onChange={(e) => setQrSearch(e.target.value)}
                placeholder="Search replies or shortcuts…"
                autoFocus
                className="input input-sm" style={{ marginBottom: '9px' }}
              />
              {visibleQuickReplies.length === 0 ? (
                <div style={{ fontSize: '12px', color: 'var(--text-muted)', padding: '6px 2px 10px 2px' }}>
                  No quick replies match “{qrSearch}”.
                </div>
              ) : (
                <div className="qr-grid">
                  {visibleQuickReplies.map((qr) => (
                    <div key={qr.id || qr.title} style={{ position: 'relative' }}>
                      <button
                        onClick={() => {
                          setInputContent(qr.body);
                          setShowQuickReplies(false);
                          setQrSearch('');
                          textareaRef.current?.focus();
                        }}
                        className="btn btn-secondary"
                        style={{ textAlign: 'left', padding: '6px 8px', fontSize: '11.5px', justifyContent: 'flex-start', width: '100%' }}
                      >
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontWeight: '600', color: 'var(--wa-primary)', display: 'flex', gap: '6px', alignItems: 'center' }}>
                            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{qr.title}</span>
                            {qr.shortcut && (
                              <span style={{ fontSize: '9.5px', background: 'rgba(37,211,102,0.14)', padding: '1px 5px', borderRadius: '4px', flexShrink: 0 }}>
                                /{qr.shortcut}
                              </span>
                            )}
                          </div>
                          <div style={{ fontSize: '10.5px', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '220px' }}>
                            {qr.body}
                          </div>
                        </div>
                      </button>
                      {isAdmin && qr.id && (
                        <span style={{ position: 'absolute', top: '4px', right: '4px', display: 'flex', gap: '2px' }}>
                          <button
                            type="button"
                            title="Edit"
                            onClick={() => { setQrForm({ id: qr.id, title: qr.title, body: qr.body, shortcut: qr.shortcut || '' }); setQrError(null); }}
                            className="btn btn-ghost btn-xs"
                          >
                            ✎
                          </button>
                          <button
                            type="button"
                            title="Delete"
                            onClick={() => deleteQuickReply(qr)}
                            className="btn btn-ghost"
                            style={{ padding: '2px 5px', fontSize: '10.5px', color: '#dc2626' }}
                          >
                            🗑
                          </button>
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '9px' }}>
                <span style={{ fontSize: '10.5px', color: 'var(--text-muted)' }}>
                  {tenantQuickReplies.length === 0
                    ? 'Starter replies shown — admins can add your own.'
                    : 'Tip: type /shortcut in the message box.'}
                </span>
                {isAdmin && (
                  <button
                    onClick={() => { setQrForm({ title: '', body: '', shortcut: '' }); setQrError(null); }}
                    className="btn btn-ghost"
                    style={{ padding: '3px 8px', fontSize: '11.5px', color: 'var(--wa-primary)' }}
                  >
                    + Add quick reply
                  </button>
                )}
              </div>
            </>
          )}
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
            <span style={{ fontSize: '11.5px', fontWeight: '600', color: 'var(--text-main)', display: 'inline-flex', alignItems: 'center', gap: '6px' }}><Paperclip size={13} /> Attach Media / Doc</span>
            <button
              onClick={() => setShowAttachmentMenu(false)}
              className="btn btn-ghost btn-xs"
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
              style={{ background: 'var(--bg-input)', border: '1px solid var(--border-medium)', borderRadius: '6px', padding: '7px 9px', color: 'var(--text-main)', fontSize: '12px', width: '100%' }}
            />
            <input
              type="text"
              value={attachName}
              onChange={(e) => setAttachName(e.target.value)}
              placeholder="File name (optional)"
              aria-label="Attachment file name"
              style={{ background: 'var(--bg-input)', border: '1px solid var(--border-medium)', borderRadius: '6px', padding: '7px 9px', color: 'var(--text-main)', fontSize: '12px', width: '100%' }}
            />
            <button
              onClick={() => {
                const url = attachUrl.trim();
                if (!/^https:\/\//i.test(url)) {
                  toast.error('Please paste a valid https:// file URL.');
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

      {/* 5.3 WhatsApp Commerce & UPI Payment Popover Drawer */}
      {showCommerceDrawer && (
        <div
          style={{
            position: 'absolute',
            bottom: '72px',
            left: '12px',
            right: '12px',
            maxWidth: '420px',
            background: 'var(--bg-surface)',
            border: '1px solid var(--border-medium)',
            borderRadius: '12px',
            padding: '14px',
            boxShadow: 'var(--shadow-card)',
            zIndex: 30,
            display: 'flex',
            flexDirection: 'column',
            gap: '10px',
            maxHeight: '380px',
            overflowY: 'auto',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', gap: '6px' }}>
              <button
                type="button"
                onClick={() => setCommerceTab('products')}
                style={{
                  background: commerceTab === 'products' ? 'rgba(37, 211, 102, 0.15)' : 'none',
                  color: commerceTab === 'products' ? '#16a34a' : 'var(--text-secondary)',
                  border: 'none',
                  borderRadius: '6px',
                  padding: '4px 10px',
                  fontSize: '12px',
                  fontWeight: '700',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                }}
              >
                <ShoppingBag size={13} />
                <span>Products ({catalogProducts.length})</span>
              </button>
              <button
                type="button"
                onClick={() => setCommerceTab('payment')}
                style={{
                  background: commerceTab === 'payment' ? 'rgba(37, 211, 102, 0.15)' : 'none',
                  color: commerceTab === 'payment' ? '#16a34a' : 'var(--text-secondary)',
                  border: 'none',
                  borderRadius: '6px',
                  padding: '4px 10px',
                  fontSize: '12px',
                  fontWeight: '700',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                }}
              >
                <CreditCard size={13} />
                <span>UPI Payment</span>
              </button>
            </div>
            <button
              onClick={() => setShowCommerceDrawer(false)}
              className="btn btn-ghost btn-xs"
            >
              ✕
            </button>
          </div>

          {commerceTab === 'products' ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {loadingCatalog ? (
                <div style={{ textAlign: 'center', padding: '20px', fontSize: '12px', color: 'var(--text-muted)' }}>
                  Loading catalog products...
                </div>
              ) : catalogProducts.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '20px', fontSize: '12px', color: 'var(--text-muted)' }}>
                  No products in catalog. Add products in Commerce view.
                </div>
              ) : (
                catalogProducts.map((p) => (
                  <div
                    key={p.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '8px 10px',
                      borderRadius: '8px',
                      border: '1px solid var(--border-subtle)',
                      background: 'var(--bg-app)',
                      gap: '10px',
                    }}
                  >
                    {p.imageUrl ? (
                      <img
                        src={p.imageUrl}
                        alt={p.title}
                        style={{ width: '40px', height: '40px', borderRadius: '6px', objectFit: 'cover' }}
                      />
                    ) : (
                      <div
                        style={{
                          width: '40px',
                          height: '40px',
                          borderRadius: '6px',
                          background: 'rgba(37, 211, 102, 0.12)',
                          color: 'var(--wa-primary)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <ShoppingBag size={18} />
                      </div>
                    )}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '12.5px', fontWeight: '700', color: 'var(--text-main)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {p.title}
                      </div>
                      <div style={{ fontSize: '11px', color: '#16a34a', fontWeight: '700' }}>
                        ₹{Number(p.price).toLocaleString('en-IN')}
                      </div>
                    </div>
                    <button
                      type="button"
                      disabled={sendingCommerce}
                      onClick={() => handleSendProductToChat(p)}
                      className="btn btn-primary btn-xs"
                      style={{ background: 'var(--wa-primary)', color: '#ffffff', fontWeight: '600' }}
                    >
                      {sendingCommerce ? 'Sending...' : 'Send'}
                    </button>
                  </div>
                ))
              )}
            </div>
          ) : (
            <form onSubmit={handleSendPaymentRequest} style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div>
                <label style={{ fontSize: '11px', fontWeight: '600', color: 'var(--text-main)', display: 'block', marginBottom: '3px' }}>
                  Amount (₹) *
                </label>
                <input
                  type="number"
                  required
                  min="1"
                  value={payAmount}
                  onChange={(e) => setPayAmount(e.target.value)}
                  placeholder="e.g. 999"
                  style={{
                    width: '100%',
                    padding: '6px 10px',
                    borderRadius: '6px',
                    border: '1px solid var(--border-medium)',
                    background: 'var(--bg-input)',
                    color: 'var(--text-main)',
                    fontSize: '13px',
                  }}
                />
              </div>

              <div>
                <label style={{ fontSize: '11px', fontWeight: '600', color: 'var(--text-main)', display: 'block', marginBottom: '3px' }}>
                  Note / Invoice Ref
                </label>
                <input
                  type="text"
                  value={payNote}
                  onChange={(e) => setPayNote(e.target.value)}
                  placeholder="e.g. Order #8241 or Consultation fee"
                  style={{
                    width: '100%',
                    padding: '6px 10px',
                    borderRadius: '6px',
                    border: '1px solid var(--border-medium)',
                    background: 'var(--bg-input)',
                    color: 'var(--text-main)',
                    fontSize: '12px',
                  }}
                />
              </div>

              <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                Payee VPA: <code>{catalogSettings.upiId || 'teambee@upi'}</code>
              </div>

              <button
                type="submit"
                disabled={sendingCommerce}
                className="btn btn-primary btn-sm"
                style={{ background: '#16a34a', color: '#ffffff', justifyContent: 'center', marginTop: '4px' }}
              >
                {sendingCommerce ? 'Dispatching...' : 'Send UPI Payment Request'}
              </button>
            </form>
          )}
        </div>
      )}

      {/* 6. Interactive Composer Container */}
      <div className={`chat-composer-box${composeMode === 'NOTE' ? ' note-mode' : ''}`}>
        {/* 6.1 Mode Switcher Tabs */}
        <div className="composer-mode-row">
          <div className="fx" style={{ gap: 'var(--space-1)', flexShrink: 0 }}>
            <button
              type="button"
              className={`composer-mode-tab mode-tab${composeMode === 'WHATSAPP' ? ' active-green' : ''}`}
              onClick={() => setComposeMode('WHATSAPP')}
            >
              <MessageSquare size={12} />
              <span>WhatsApp</span>
            </button>

            <button
              type="button"
              className={`composer-mode-tab mode-tab${composeMode === 'NOTE' ? ' active-amber' : ''}`}
              onClick={() => setComposeMode('NOTE')}
            >
              <Lock size={11} />
              <span>Team Note</span>
            </button>

            <button
              type="button"
              className={`composer-mode-tab mode-tab${composeMode === 'INTERACTIVE' ? ' active-sky' : ''}`}
              onClick={() => setComposeMode('INTERACTIVE')}
            >
              <Sparkles size={11} />
              <span>Buttons</span>
            </button>
          </div>

          {/* Quick Reaction Pills */}
          <div className="quick-reactions">
            {['👍', '🙏', '❤️', '🎓', '📚'].map((emoji) => (
              <button
                key={emoji}
                type="button"
                onClick={() => insertEmoji(emoji)}
                className="reaction-btn"
                title={`Insert ${emoji}`}
              >
                {emoji}
              </button>
            ))}
          </div>
        </div>

        {/* Closed 24h window: no fake input — a template CTA instead.
            Team Notes are exempt (internal, no window needed). */}
        {composeMode !== 'NOTE' && !messagingWindow.isOpen ? (
          <ClosedWindowBar onSendTemplate={onOpenTemplatePicker} />
        ) : (
          <>
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
                    background: 'rgba(15, 23, 42, 0.06)',
                    color: 'var(--text-main)',
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
                    style={{ background: 'none', border: 'none', color: '#dc2626', cursor: 'pointer', padding: 0 }}
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
                      color: 'var(--text-main)',
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
                    className="btn btn-secondary btn-xs"
                  >
                    +
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* 6.25 Armed reply chip: the message this send will quote */}
        {replyingTo && activeChat && replyingTo.chatId === activeChat.id && composeMode !== 'NOTE' && (
          <div className="reply-chip">
            <div className="reply-chip-body">
              <div className="reply-chip-name">Replying to {replyingTo.senderName}</div>
              <div className="reply-chip-text">{replyingTo.content}</div>
            </div>
            <button
              type="button"
              className="reply-chip-close"
              aria-label="Cancel reply"
              onClick={() => setReplyingTo(null)}
            >
              <X size={14} />
            </button>
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
              <Zap size={17} />
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

            <button
              type="button"
              onClick={() => {
                setShowCommerceDrawer(!showCommerceDrawer);
                setShowAttachmentMenu(false);
                setShowQuickReplies(false);
              }}
              className="btn-tool"
              style={{ color: showCommerceDrawer ? 'var(--wa-primary)' : 'var(--text-secondary)' }}
              title="Share Product Catalog / UPI Payment"
            >
              <ShoppingBag size={17} />
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
                const value = e.target.value;
                setInputContent(value);
                signalTyping();
                // "/" quick-reply shortcut: a lone slash token opens the
                // picker pre-filtered by whatever follows the slash.
                if (composeMode === 'WHATSAPP' && /^\/\S*$/.test(value)) {
                  setQrSearch(value.slice(1));
                  setShowQuickReplies(true);
                }
                // "@" mention picker (internal notes only): track the
                // trailing @token so the candidate list can filter live.
                if (composeMode === 'NOTE') {
                  const atMatch = value.match(/@([\w ]*)$/);
                  setMentionQuery(atMatch ? atMatch[1] : null);
                } else if (mentionQuery !== null) {
                  setMentionQuery(null);
                }
              }}
              onKeyDown={handleKeyDown}
              placeholder={
                composeMode === 'NOTE'
                  ? 'Write a private staff note...'
                  : composeMode === 'INTERACTIVE'
                  ? 'Question with buttons...'
                  : 'WhatsApp reply...'
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
                color: 'var(--text-main)',
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
          </>
        )}
      </div>

      {/* Message action sheet (long-press / right-click on a message) */}
      <MessageActionSheet
        msg={msgMenuMsg}
        onCopy={copyMsgText}
        onReply={() => msgMenuMsg && startReply(msgMenuMsg)}
        onClose={() => setMsgMenuMsg(null)}
      />
    </main>
  );
}
