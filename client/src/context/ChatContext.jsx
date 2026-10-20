import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from './AuthContext';
import { useSocket } from './SocketContext';

const ChatContext = createContext(null);

function sameMessage(left, right) {
  return Boolean(
    (left?.id && right?.id && left.id === right.id) ||
    (left?.waMessageId && right?.waMessageId && left.waMessageId === right.waMessageId) ||
    (left?.clientMessageId && right?.clientMessageId && left.clientMessageId === right.clientMessageId)
  );
}

function mergeMessage(list, incoming) {
  const existingIndex = list.findIndex((message) => sameMessage(message, incoming));
  if (existingIndex === -1) return [...list, incoming];
  const merged = [...list];
  merged[existingIndex] = { ...merged[existingIndex], ...incoming };
  return merged;
}

function mergeMessageLists(left, right) {
  const merged = right.reduce((list, message) => mergeMessage(list, message), [...left]);
  return merged.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
}

export function ChatProvider({ children }) {
  const { token, agent, isAdmin } = useAuth();
  const { socket, connected, joinChat, leaveChat } = useSocket();

  const [chats, setChats] = useState([]);
  const [activeChatId, setActiveChatId] = useState(null);
  const [activeChat, setActiveChat] = useState(null);
  const [messages, setMessages] = useState([]);
  const [messagingWindow, setMessagingWindow] = useState({ isOpen: true, hoursRemaining: 24 });
  const [loadingChats, setLoadingChats] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [chatPagination, setChatPagination] = useState({ hasMore: false, nextCursor: null });
  const [messagePagination, setMessagePagination] = useState({ hasMore: false, nextBefore: null });

  // ⚡ Memory cache for 0ms instant chat switching across conversations
  const messagesCacheRef = useRef({});
  const activeChatIdRef = useRef(null);
  activeChatIdRef.current = activeChatId;

  // Filters
  const [tabFilter, setTabFilter] = useState('mine'); // 'mine' | 'unassigned' | 'all'
  const [statusFilter, setStatusFilter] = useState('OPEN'); // 'OPEN' | 'UNASSIGNED' | 'RESOLVED' | 'ALL'
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [typingUsers, setTypingUsers] = useState({});

  // ⚡ Debounce search input by 300ms to eliminate network spam & spinner flicker
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  /**
   * Fetch chats from backend
   */
  const fetchChats = useCallback(async (silent = false, cursor = null) => {
    if (!agent) return;
    if (!silent) setLoadingChats(true);
    try {
      const params = new URLSearchParams({
        filter: tabFilter,
        status: statusFilter,
        search: debouncedSearch,
        limit: '100',
      });
      if (cursor) params.set('cursor', cursor);

      const res = await fetch(`/api/chats?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success) {
        setChats((previous) => cursor ? [...previous, ...(data.chats || [])] : data.chats || []);
        setChatPagination(data.pagination || { hasMore: false, nextCursor: null });
      }
    } catch (err) {
      console.error('Fetch chats error:', err);
    } finally {
      if (!silent) setLoadingChats(false);
    }
  }, [agent, token, tabFilter, statusFilter, debouncedSearch]);

  const loadMoreChats = useCallback(() => {
    if (chatPagination.hasMore && chatPagination.nextCursor) {
      return fetchChats(true, chatPagination.nextCursor);
    }
    return Promise.resolve();
  }, [chatPagination, fetchChats]);

  useEffect(() => {
    fetchChats();
  }, [fetchChats]);

  /**
   * Fetch messages and chat details in background without freezing UI
   */
  const loadChat = useCallback(
    async (chatId) => {
      if (!chatId || !agent) return;

      // Join Socket.io room asynchronously in background (don't block network fetches)
      joinChat(chatId).catch((err) => console.warn('Socket join warning:', err));

      try {
        const [chatRes, msgRes] = await Promise.all([
          fetch(`/api/chats/${chatId}`, { headers: { Authorization: `Bearer ${token}` } }),
          fetch(`/api/messages/${chatId}?limit=100`, { headers: { Authorization: `Bearer ${token}` } }),
        ]);

        const chatData = await chatRes.json();
        const msgData = await msgRes.json();

        const fetchedMessages = msgData.success ? msgData.messages : [];
        const fetchedWindow = msgData.messagingWindow || { isOpen: true, hoursRemaining: 24 };
        const fetchedChat = chatData.success ? chatData.chat : null;

        // Cache so future re-opens are instant 0ms
        messagesCacheRef.current[chatId] = {
          messages: fetchedMessages,
          messagingWindow: fetchedWindow,
          chat: fetchedChat,
          pagination: msgData.pagination || { hasMore: false, nextBefore: null },
        };

        // Only commit to active state if user is STILL viewing this exact chat
        if (activeChatIdRef.current === chatId) {
          if (fetchedChat) {
            setActiveChat(fetchedChat);
          }
          if (msgData.success) {
            setMessages(fetchedMessages);
            setMessagingWindow(fetchedWindow);
            setMessagePagination(msgData.pagination || { hasMore: false, nextBefore: null });
            setChats((previous) => previous.map((chat) =>
              chat.id === chatId ? { ...chat, unreadCount: 0 } : chat
            ));
          }
        }
      } catch (err) {
        console.error('Load chat error:', err);
      } finally {
        if (activeChatIdRef.current === chatId) {
          setLoadingMessages(false);
        }
      }
    },
    [agent, token, joinChat]
  );

  // Reconcile state after a socket reconnect. Socket.IO does not replay
  // events emitted while the browser was offline.
  useEffect(() => {
    if (!connected || !agent) return;
    fetchChats(true);
    if (activeChatIdRef.current) loadChat(activeChatIdRef.current);
  }, [connected, agent, token, fetchChats, loadChat]);

  const loadOlderMessages = useCallback(async () => {
    const chatId = activeChatIdRef.current;
    const before = messagePagination.nextBefore;
    if (!chatId || !agent || !messagePagination.hasMore || !before) return;

    const res = await fetch(`/api/messages/${chatId}?limit=100&before=${encodeURIComponent(before)}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.error || 'Failed to load older messages');
    setMessages((previous) => mergeMessageLists(data.messages || [], previous));
    messagesCacheRef.current[chatId] = {
      ...(messagesCacheRef.current[chatId] || {}),
      messages: mergeMessageLists(data.messages || [], messagesCacheRef.current[chatId]?.messages || []),
      pagination: data.pagination || { hasMore: false, nextBefore: null },
    };
    setMessagePagination(data.pagination || { hasMore: false, nextBefore: null });
  }, [messagePagination, agent, token]);

  /**
   * ⚡ Instant 0ms Chat Selection:
   * Sets activeChat and cached messages synchronously so UI flips immediately.
   */
  const selectChat = (chatId) => {
    if (activeChatId && activeChatId !== chatId) {
      leaveChat(activeChatId);
    }

    if (!chatId) {
      setActiveChatId(null);
      activeChatIdRef.current = null;
      setActiveChat(null);
      setMessages([]);
      setMessagePagination({ hasMore: false, nextBefore: null });
      return;
    }

    // 1. Immediately update activeChatId & activeChat from in-memory chats list (0ms UI latency)
    setActiveChatId(chatId);
    activeChatIdRef.current = chatId;

    const existingChat = chats.find((c) => c.id === chatId);
    const cachedEntry = messagesCacheRef.current[chatId];

    if (existingChat) {
      setActiveChat(existingChat);
    } else if (cachedEntry?.chat) {
      setActiveChat(cachedEntry.chat);
    } else {
      setActiveChat({ id: chatId, status: 'OPEN', contact: { name: 'Customer' } });
    }

    // 2. If messages are cached from previous view, render immediately (0ms)
    if (cachedEntry && Array.isArray(cachedEntry.messages)) {
      setMessages(cachedEntry.messages);
      if (cachedEntry.messagingWindow) {
        setMessagingWindow(cachedEntry.messagingWindow);
      }
      setMessagePagination(cachedEntry.pagination || { hasMore: false, nextBefore: null });
      setLoadingMessages(false);
    } else {
      setMessages([]);
      setMessagePagination({ hasMore: false, nextBefore: null });
      setLoadingMessages(true);
    }

    // 3. Sync fresh messages & details from server in background
    loadChat(chatId);
  };

  /**
   * Real-time Socket.io event listeners
   */
  useEffect(() => {
    if (!socket) return;

    // Incoming new message (customer or agent)
    const handleNewMessage = ({ chatId, message }) => {
      // Play pleasant sound chime for customer messages
      if (message.senderType === 'CUSTOMER' || message.direction === 'INBOUND') {
        try {
          const AudioContext = window.AudioContext || window.webkitAudioContext;
          if (AudioContext) {
            const ctx = new AudioContext();
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
            osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.12); // A5
            gain.gain.setValueAtTime(0.15, ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.35);
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start();
            osc.stop(ctx.currentTime + 0.35);
          }
        } catch (e) {}
      }

      // Update in-memory cache
      if (messagesCacheRef.current[chatId]) {
        const cachedList = messagesCacheRef.current[chatId].messages || [];
        messagesCacheRef.current[chatId].messages = mergeMessage(cachedList, message);
      }

      // If belongs to currently open chat canvas, append immediately
      if (chatId === activeChatIdRef.current) {
        setMessages((prev) => mergeMessage(prev, message));
      }

      // Update previews in conversation list
      setChats((prev) => {
        const index = prev.findIndex((c) => c.id === chatId);
        if (index === -1) {
          fetchChats();
          return prev;
        }
        const updated = [...prev];
        updated[index] = {
          ...updated[index],
          lastMessagePreview: message.content || `[${message.messageType}]`,
          lastMessageAt: message.createdAt,
          unreadCount: chatId === activeChatIdRef.current ? 0 : (updated[index].unreadCount || 0) + 1,
        };
        // Sort newest on top
        return updated.sort((a, b) => new Date(b.lastMessageAt) - new Date(a.lastMessageAt));
      });
    };

    // The server emits previews only to authorized queue/role rooms. This
    // keeps list ordering and unread counts live without exposing full message
    // payloads to unrelated agents.
    const handleChatPreviewUpdated = ({ chatId, lastMessage, lastMessageAt }) => {
      setChats((prev) => {
        const index = prev.findIndex((chat) => chat.id === chatId);
        if (index === -1) {
          fetchChats(true);
          return prev;
        }
        const updated = [...prev];
        updated[index] = {
          ...updated[index],
          lastMessagePreview: lastMessage,
          lastMessageAt,
          unreadCount: chatId === activeChatIdRef.current ? 0 : (updated[index].unreadCount || 0) + 1,
        };
        return updated.sort((a, b) => new Date(b.lastMessageAt) - new Date(a.lastMessageAt));
      });
    };

    // Message delivery status update (SENT -> DELIVERED -> READ)
    const handleStatusUpdate = ({ chatId, messageId, waMessageId, status }) => {
      if (messagesCacheRef.current[chatId]) {
        const cachedList = messagesCacheRef.current[chatId].messages || [];
        messagesCacheRef.current[chatId].messages = cachedList.map((m) =>
          m.waMessageId === waMessageId || m.id === messageId ? { ...m, status } : m
        );
      }
      if (chatId === activeChatIdRef.current) {
        setMessages((prev) =>
          prev.map((m) => {
            if (m.waMessageId === waMessageId || m.id === messageId) {
              return { ...m, status };
            }
            return m;
          })
        );
      }
    };

    // Chat assignment change
    const handleChatAssigned = ({ chatId, assignedAgentId, assignedAgentName, status }) => {
      fetchChats(true);
      setChats((prev) =>
        prev.map((c) => {
          if (c.id === chatId) {
            return {
              ...c,
              assignedAgentId,
              status,
              assignedAgent: assignedAgentName ? { name: assignedAgentName, id: assignedAgentId } : null,
            };
          }
          return c;
        })
      );
      if (activeChatId === chatId) {
        setActiveChat((prev) =>
          prev
            ? {
                ...prev,
                assignedAgentId,
                status,
                assignedAgent: assignedAgentName ? { name: assignedAgentName, id: assignedAgentId } : null,
              }
            : null
        );
      }
    };

    // Chat status changed (UNASSIGNED / OPEN / RESOLVED)
    const handleChatStatusChanged = ({ chatId, status }) => {
      fetchChats(true);
      setChats((prev) =>
        prev.map((c) => (c.id === chatId ? { ...c, status } : c))
      );
      if (activeChatId === chatId) {
        setActiveChat((prev) => (prev ? { ...prev, status } : null));
      }
    };

    // Agent typing indicator
    const handleAgentTyping = ({ chatId, agentName, isTyping }) => {
      if (chatId === activeChatId) {
        setTypingUsers((prev) => ({ ...prev, [agentName]: isTyping }));
      }
    };

    socket.on('new_message', handleNewMessage);
    socket.on('chat_preview_updated', handleChatPreviewUpdated);
    socket.on('message_status_updated', handleStatusUpdate);
    socket.on('chat_assigned', handleChatAssigned);
    socket.on('chat_status_changed', handleChatStatusChanged);
    socket.on('agent_typing', handleAgentTyping);

    return () => {
      socket.off('new_message', handleNewMessage);
      socket.off('chat_preview_updated', handleChatPreviewUpdated);
      socket.off('message_status_updated', handleStatusUpdate);
      socket.off('chat_assigned', handleChatAssigned);
      socket.off('chat_status_changed', handleChatStatusChanged);
      socket.off('agent_typing', handleAgentTyping);
    };
  }, [socket, activeChatId, fetchChats]);

  /**
   * Send outbound message or private note with flexible options
   */
  const sendMessage = async (content, options = 'TEXT', mediaUrl = null, mediaFilename = null) => {
    if (!activeChatId || !agent) return;

    let payload = {
      content,
      messageType: 'TEXT',
      mediaUrl: null,
      mediaFilename: null,
      isInternal: false,
      buttons: [],
    };

    if (typeof options === 'string') {
      payload.messageType = options;
      payload.mediaUrl = mediaUrl;
      payload.mediaFilename = mediaFilename;
    } else if (typeof options === 'object' && options !== null) {
      payload.messageType = options.messageType || 'TEXT';
      payload.mediaUrl = options.mediaUrl || null;
      payload.mediaFilename = options.mediaFilename || null;
      payload.isInternal = !!options.isInternal;
      payload.buttons = options.buttons || [];
    }

    // ⚡ Instant Optimistic UI (0ms latency): Append bubble immediately with PENDING clock
    const tempId = `temp-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    const clientMessageId = tempId;
    payload.clientMessageId = clientMessageId;
    const targetChatId = activeChatId;
    const nowIso = new Date().toISOString();

    const optimisticMessage = {
      id: tempId,
      chatId: targetChatId,
      senderType: 'AGENT',
      direction: 'OUTBOUND',
      senderAgentId: agent?.id,
      senderAgent: agent ? { id: agent.id, name: agent.name } : null,
      messageType: payload.messageType,
      content: payload.content,
      mediaUrl: payload.mediaUrl,
      mediaFilename: payload.mediaFilename,
      buttons: payload.buttons ? (typeof payload.buttons === 'string' ? payload.buttons : JSON.stringify(payload.buttons)) : null,
      status: 'PENDING',
      isInternal: payload.isInternal,
      clientMessageId,
      createdAt: nowIso,
      updatedAt: nowIso,
    };

    // Instant append in active chat
    setMessages((prev) => {
      const next = [...prev, optimisticMessage];
      if (messagesCacheRef.current[targetChatId]) {
        messagesCacheRef.current[targetChatId].messages = next;
      }
      return next;
    });

    // Instant update in left conversation list
    setChats((prev) => {
      const idx = prev.findIndex((c) => c.id === targetChatId);
      if (idx === -1) return prev;
      const copy = [...prev];
      copy[idx] = {
        ...copy[idx],
        lastMessagePreview: payload.content || `[${payload.messageType}]`,
        lastMessageAt: nowIso,
      };
      return copy.sort((a, b) => new Date(b.lastMessageAt) - new Date(a.lastMessageAt));
    });

    try {
      const res = await fetch(`/api/messages/${targetChatId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!data.success) {
        setMessages((prev) => {
          const next = data.message
            ? mergeMessage(prev, { ...data.message, clientMessageId })
            : prev.map((m) => (m.id === tempId ? { ...m, status: 'FAILED', errorMessage: data.error } : m));
          if (messagesCacheRef.current[targetChatId]) {
            messagesCacheRef.current[targetChatId].messages = next;
          }
          return next;
        });
        throw new Error(data.error || 'Failed to send message');
      }

      // Replace optimistic message with confirmed database record
      setMessages((prev) => {
        const next = mergeMessage(prev, { ...data.message, clientMessageId });
        if (messagesCacheRef.current[targetChatId]) {
          messagesCacheRef.current[targetChatId].messages = next;
        }
        return next;
      });
      return data;
    } catch (err) {
      setMessages((prev) => {
        const next = prev.map((m) => (m.id === tempId ? { ...m, status: 'FAILED', errorMessage: err.message } : m));
        if (messagesCacheRef.current[targetChatId]) {
          messagesCacheRef.current[targetChatId].messages = next;
        }
        return next;
      });
      throw err;
    }
  };

  /**
   * Assign chat to an agent or claim it
   */
  const assignChat = async (chatId, targetAgentId) => {
    if (!agent) return;
    // Optimistic update in state
    setChats((prev) =>
      prev.map((c) =>
        c.id === chatId
          ? {
              ...c,
              assignedAgentId: targetAgentId,
              status: targetAgentId ? 'OPEN' : 'UNASSIGNED',
            }
          : c
      )
    );
    if (activeChatId === chatId) {
      setActiveChat((prev) =>
        prev
          ? {
              ...prev,
              assignedAgentId: targetAgentId,
              status: targetAgentId ? 'OPEN' : 'UNASSIGNED',
            }
          : null
      );
    }

    try {
      const res = await fetch(`/api/chats/${chatId}/assign`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ agentId: targetAgentId }),
      });
      const data = await res.json();
      if (data.success) {
        fetchChats(true);
        if (activeChatId === chatId) {
          setActiveChat(data.chat);
        }
      }
      return data;
    } catch (err) {
      fetchChats(true);
    }
  };

  /**
   * Update chat status (OPEN, RESOLVED, UNASSIGNED)
   */
  const updateChatStatus = async (chatId, status) => {
    if (!agent) return;
    // Optimistic update in state
    setChats((prev) =>
      prev.map((c) => (c.id === chatId ? { ...c, status } : c))
    );
    if (activeChatId === chatId) {
      setActiveChat((prev) => (prev ? { ...prev, status } : null));
    }

    try {
      const res = await fetch(`/api/chats/${chatId}/status`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ status }),
      });
      const data = await res.json();
      if (data.success) {
        fetchChats(true);
        if (activeChatId === chatId) {
          setActiveChat(data.chat);
        }
      }
      return data;
    } catch (err) {
      fetchChats(true);
    }
  };

  /**
   * Update chat tags
   */
  const updateChatTags = async (chatId, tags) => {
    if (!agent) return;
    const res = await fetch(`/api/chats/${chatId}/tags`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ tags }),
    });
    const data = await res.json();
    if (data.success && activeChat) {
      setActiveChat((prev) => ({ ...prev, tags: JSON.stringify(data.tags) }));
      setChats((prev) =>
        prev.map((c) => (c.id === chatId ? { ...c, tags: JSON.stringify(data.tags) } : c))
      );
    }
    return data;
  };

  /**
   * Update contact CRM details (name, email, customAttributes)
   */
  const updateContact = async (chatId, contactData) => {
    if (!agent) return;
    const res = await fetch(`/api/chats/${chatId}/contact`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(contactData),
    });
    const data = await res.json();
    if (data.success && data.contact) {
      if (activeChatId === chatId) {
        setActiveChat((prev) => (prev ? { ...prev, contact: data.contact } : null));
      }
      setChats((prev) =>
        prev.map((c) => (c.id === chatId ? { ...c, contact: data.contact } : c))
      );
    }
    return data;
  };

  return (
    <ChatContext.Provider
      value={{
        chats,
        activeChatId,
        activeChat,
        messages,
        messagingWindow,
         loadingChats,
         loadingMessages,
         chatPagination,
         messagePagination,
        tabFilter,
        setTabFilter,
        statusFilter,
        setStatusFilter,
        searchQuery,
        setSearchQuery,
        typingUsers,
        selectChat,
        sendMessage,
        assignChat,
        updateChatStatus,
        updateChatTags,
        updateContact,
         fetchChats,
         loadMoreChats,
         loadOlderMessages,
      }}
    >
      {children}
    </ChatContext.Provider>
  );
}

export function useChat() {
  const ctx = useContext(ChatContext);
  if (!ctx) throw new Error('useChat must be used within ChatProvider');
  return ctx;
}
