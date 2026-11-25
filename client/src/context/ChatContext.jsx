import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from './AuthContext';
import { useSocket } from './SocketContext';
import { apiFetch } from '../services/apiClient';
import { mergeMessage, mergeMessageLists, playInboundChime, sortChatsByRecent } from '../utils/chatHelpers';

const ChatContext = createContext(null);

export function ChatProvider({ children }) {
  const { agent } = useAuth();
  const { socket, connected, joinChat, leaveChat } = useSocket();

  const [chats, setChats] = useState([]);
  const [chatCounts, setChatCounts] = useState({ all: 0, unassigned: 0, mine: 0 });
  const [activeChatId, setActiveChatId] = useState(null);
  const [activeChat, setActiveChat] = useState(null);
  const [messages, setMessages] = useState([]);
  const [messagingWindow, setMessagingWindow] = useState({ isOpen: true, hoursRemaining: 24 });
  const [loadingChats, setLoadingChats] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [chatPagination, setChatPagination] = useState({ hasMore: false, nextCursor: null });
  const [messagePagination, setMessagePagination] = useState({ hasMore: false, nextBefore: null });

  const messagesCacheRef = useRef({});
  const activeChatIdRef = useRef(null);
  const wasConnectedRef = useRef(false);
  const typingTimersRef = useRef({});
  activeChatIdRef.current = activeChatId;

  const [tabFilter, setTabFilter] = useState('all'); // 'all' | 'unassigned' | 'mine'
  const [statusFilter, setStatusFilter] = useState('ALL'); // 'ALL' | 'OPEN' | 'UNASSIGNED' | 'RESOLVED'
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [typingUsers, setTypingUsers] = useState({});
  const [replyToMessage, setReplyToMessage] = useState(null);

  useEffect(() => {
    const handleFocus = () => {
      document.title = 'TeamBee • WhatsApp Team Inbox for Customer Conversations';
    };
    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchQuery), 250);
    return () => clearTimeout(timer);
  }, [searchQuery]);

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

      const data = await apiFetch(`/api/chats?${params.toString()}`);
      setChats((previous) => (cursor ? [...previous, ...(data.chats || [])] : data.chats || []));
      if (data.counts) setChatCounts(data.counts);
      setChatPagination(data.pagination || { hasMore: false, nextCursor: null });
    } catch (err) {
      console.error('Fetch chats error:', err);
    } finally {
      if (!silent) setLoadingChats(false);
    }
  }, [agent, tabFilter, statusFilter, debouncedSearch]);

  const loadMoreChats = useCallback(() => {
    if (chatPagination.hasMore && chatPagination.nextCursor) {
      return fetchChats(true, chatPagination.nextCursor);
    }
    return Promise.resolve();
  }, [chatPagination, fetchChats]);

  useEffect(() => {
    if (!agent) {
      setChats([]);
      setActiveChatId(null);
      setActiveChat(null);
      setMessages([]);
      messagesCacheRef.current = {};
      return;
    }
    fetchChats();
  }, [agent, fetchChats]);

  const loadChat = useCallback(async (chatId) => {
    if (!chatId || !agent) return;
    joinChat(chatId).catch(() => {});

    try {
      const [chatData, msgData] = await Promise.all([
        apiFetch(`/api/chats/${chatId}`),
        apiFetch(`/api/messages/${chatId}?limit=100`),
      ]);

      const fetchedMessages = msgData.messages || [];
      const fetchedWindow = msgData.messagingWindow || { isOpen: true, hoursRemaining: 24 };
      const fetchedChat = chatData.chat || null;
      const pagination = msgData.pagination || { hasMore: false, nextBefore: null };

      messagesCacheRef.current[chatId] = {
        messages: fetchedMessages,
        messagingWindow: fetchedWindow,
        chat: fetchedChat,
        pagination,
      };

      if (activeChatIdRef.current === chatId) {
        if (fetchedChat) setActiveChat(fetchedChat);
        setMessages(fetchedMessages);
        setMessagingWindow(fetchedWindow);
        setMessagePagination(pagination);
        setChats((previous) => previous.map((chat) => (
          chat.id === chatId ? { ...chat, unreadCount: 0 } : chat
        )));
      }
    } catch (err) {
      console.error('Load chat error:', err);
    } finally {
      if (activeChatIdRef.current === chatId) {
        setLoadingMessages(false);
      }
    }
  }, [agent, joinChat]);

  useEffect(() => {
    if (!agent) {
      wasConnectedRef.current = false;
      return;
    }
    if (connected && wasConnectedRef.current) {
      fetchChats(true);
      if (activeChatIdRef.current) loadChat(activeChatIdRef.current);
    }
    wasConnectedRef.current = connected;
  }, [connected, agent, fetchChats, loadChat]);

  const loadOlderMessages = useCallback(async () => {
    const chatId = activeChatIdRef.current;
    const before = messagePagination.nextBefore;
    if (!chatId || !agent || !messagePagination.hasMore || !before) return;

    const data = await apiFetch(`/api/messages/${chatId}?limit=100&before=${encodeURIComponent(before)}`);
    const nextPagination = data.pagination || { hasMore: false, nextBefore: null };
    setMessages((previous) => mergeMessageLists(data.messages || [], previous));
    messagesCacheRef.current[chatId] = {
      ...(messagesCacheRef.current[chatId] || {}),
      messages: mergeMessageLists(data.messages || [], messagesCacheRef.current[chatId]?.messages || []),
      pagination: nextPagination,
    };
    setMessagePagination(nextPagination);
  }, [messagePagination, agent]);

  const selectChat = useCallback((chatId) => {
    if (activeChatIdRef.current && activeChatIdRef.current !== chatId) {
      leaveChat(activeChatIdRef.current);
    }
    setTypingUsers({});
    setReplyToMessage(null);

    if (!chatId) {
      setActiveChatId(null);
      activeChatIdRef.current = null;
      setActiveChat(null);
      setMessages([]);
      setMessagePagination({ hasMore: false, nextBefore: null });
      return;
    }

    setActiveChatId(chatId);
    activeChatIdRef.current = chatId;

    const existingChat = chats.find((c) => c.id === chatId);
    const cachedEntry = messagesCacheRef.current[chatId];
    setActiveChat(existingChat || cachedEntry?.chat || { id: chatId, status: 'OPEN', contact: { name: 'Customer' } });

    if (cachedEntry && Array.isArray(cachedEntry.messages)) {
      setMessages(cachedEntry.messages);
      if (cachedEntry.messagingWindow) setMessagingWindow(cachedEntry.messagingWindow);
      setMessagePagination(cachedEntry.pagination || { hasMore: false, nextBefore: null });
      setLoadingMessages(false);
    } else {
      setMessages([]);
      setMessagePagination({ hasMore: false, nextBefore: null });
      setLoadingMessages(true);
    }

    loadChat(chatId);
  }, [chats, leaveChat, loadChat]);

  useEffect(() => {
    if (!socket) return;

    const handleNewMessage = ({ chatId, message }) => {
      if (message.senderType === 'CUSTOMER' || message.direction === 'INBOUND') {
        if (typeof document !== 'undefined' && document.hidden) {
          document.title = '(1) New WhatsApp Message • TeamBee';
        }
        playInboundChime();
      }

      if (messagesCacheRef.current[chatId]) {
        const cachedList = messagesCacheRef.current[chatId].messages || [];
        messagesCacheRef.current[chatId].messages = mergeMessage(cachedList, message);
      }

      if (chatId === activeChatIdRef.current) {
        setMessages((prev) => mergeMessage(prev, message));
      }

      setChats((prev) => {
        const index = prev.findIndex((c) => c.id === chatId);
        if (index === -1) {
          fetchChats(true);
          return prev;
        }
        const updated = [...prev];
        updated[index] = {
          ...updated[index],
          lastMessagePreview: message.content || `[${message.messageType}]`,
          lastMessageAt: message.createdAt,
          ...(message.direction === 'INBOUND' && message.senderType === 'CUSTOMER'
            ? { lastCustomerMessageAt: message.createdAt }
            : {}),
          unreadCount: chatId === activeChatIdRef.current ? 0 : (updated[index].unreadCount || 0) + 1,
        };
        return sortChatsByRecent(updated);
      });
    };

    const handleChatPreviewUpdated = ({ chatId, lastMessage, lastMessageAt, direction, senderType }) => {
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
          ...(direction === 'INBOUND' && senderType === 'CUSTOMER' ? { lastCustomerMessageAt: lastMessageAt } : {}),
          unreadCount: chatId === activeChatIdRef.current ? 0 : (updated[index].unreadCount || 0) + 1,
        };
        return sortChatsByRecent(updated);
      });
    };

    const handleStatusUpdate = ({ chatId, messageId, waMessageId, status }) => {
      const updateStatus = (list) => list.map((m) => (
        m.waMessageId === waMessageId || m.id === messageId ? { ...m, status } : m
      ));

      if (messagesCacheRef.current[chatId]) {
        messagesCacheRef.current[chatId].messages = updateStatus(messagesCacheRef.current[chatId].messages || []);
      }
      if (chatId === activeChatIdRef.current) {
        setMessages((prev) => updateStatus(prev));
      }
    };

    const handleChatAssigned = ({ chatId, assignedAgentId, assignedAgentName, status }) => {
      fetchChats(true);
      const patch = (item) => ({
        ...item,
        assignedAgentId,
        status,
        assignedAgent: assignedAgentName ? { name: assignedAgentName, id: assignedAgentId } : null,
      });
      setChats((prev) => prev.map((c) => (c.id === chatId ? patch(c) : c)));
      if (activeChatIdRef.current === chatId) {
        setActiveChat((prev) => (prev ? patch(prev) : null));
      }
    };

    const handleChatStatusChanged = ({ chatId, status }) => {
      fetchChats(true);
      setChats((prev) => prev.map((c) => (c.id === chatId ? { ...c, status } : c)));
      if (activeChatIdRef.current === chatId) {
        setActiveChat((prev) => (prev ? { ...prev, status } : null));
      }
    };

    const handleAgentTyping = ({ chatId, agentName, isTyping }) => {
      if (chatId !== activeChatIdRef.current || !agentName) return;
      if (typingTimersRef.current[agentName]) {
        clearTimeout(typingTimersRef.current[agentName]);
      }
      setTypingUsers((prev) => ({ ...prev, [agentName]: isTyping }));
      if (isTyping) {
        typingTimersRef.current[agentName] = setTimeout(() => {
          setTypingUsers((prev) => ({ ...prev, [agentName]: false }));
        }, 4000);
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
      Object.values(typingTimersRef.current).forEach(clearTimeout);
      typingTimersRef.current = {};
    };
  }, [socket, fetchChats]);

  const sendMessage = async (content, options = 'TEXT', mediaUrl = null, mediaFilename = null) => {
    if (!activeChatId || !agent) return;

    const payload = typeof options === 'object' && options !== null
      ? {
          content,
          messageType: options.messageType || 'TEXT',
          mediaUrl: options.mediaUrl || null,
          mediaFilename: options.mediaFilename || null,
          isInternal: Boolean(options.isInternal),
          buttons: options.buttons || [],
          replyToMessageId: options.replyToMessageId || null,
        }
      : {
          content,
          messageType: typeof options === 'string' ? options : 'TEXT',
          mediaUrl,
          mediaFilename,
          isInternal: false,
          buttons: [],
          replyToMessageId: null,
        };

    const clientMessageId = `temp-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    payload.clientMessageId = clientMessageId;
    const targetChatId = activeChatId;
    const nowIso = new Date().toISOString();

    const optimisticMessage = {
      id: clientMessageId,
      chatId: targetChatId,
      senderType: 'AGENT',
      direction: 'OUTBOUND',
      senderAgentId: agent.id,
      senderAgent: { id: agent.id, name: agent.name },
      messageType: payload.messageType,
      content: payload.content,
      mediaUrl: payload.mediaUrl,
      mediaFilename: payload.mediaFilename,
      buttons: payload.buttons?.length ? JSON.stringify(payload.buttons) : null,
      status: 'PENDING',
      isInternal: payload.isInternal,
      clientMessageId,
      createdAt: nowIso,
      updatedAt: nowIso,
    };

    setMessages((prev) => {
      const next = [...prev, optimisticMessage];
      if (messagesCacheRef.current[targetChatId]) {
        messagesCacheRef.current[targetChatId].messages = next;
      }
      return next;
    });

    setChats((prev) => {
      const idx = prev.findIndex((c) => c.id === targetChatId);
      if (idx === -1) return prev;
      const copy = [...prev];
      copy[idx] = {
        ...copy[idx],
        lastMessagePreview: payload.content || `[${payload.messageType}]`,
        lastMessageAt: nowIso,
      };
      return sortChatsByRecent(copy);
    });

    try {
      const data = await apiFetch(`/api/messages/${targetChatId}`, {
        method: 'POST',
        body: JSON.stringify(payload),
      });

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
        const next = err.data?.message
          ? mergeMessage(prev, { ...err.data.message, clientMessageId })
          : prev.map((m) => (m.id === clientMessageId ? { ...m, status: 'FAILED', errorMessage: err.message } : m));
        if (messagesCacheRef.current[targetChatId]) {
          messagesCacheRef.current[targetChatId].messages = next;
        }
        return next;
      });
      throw err;
    }
  };

  const assignChat = async (chatId, targetAgentId) => {
    if (!agent) return;
    const optimisticStatus = targetAgentId ? 'OPEN' : 'UNASSIGNED';
    setChats((prev) => prev.map((c) => (
      c.id === chatId ? { ...c, assignedAgentId: targetAgentId, status: optimisticStatus } : c
    )));
    if (activeChatIdRef.current === chatId) {
      setActiveChat((prev) => (prev ? { ...prev, assignedAgentId: targetAgentId, status: optimisticStatus } : null));
    }

    try {
      const data = await apiFetch(`/api/chats/${chatId}/assign`, {
        method: 'PUT',
        body: JSON.stringify({ agentId: targetAgentId }),
      });
      fetchChats(true);
      if (activeChatIdRef.current === chatId && data.chat) {
        setActiveChat(data.chat);
      }
      return data;
    } catch (err) {
      fetchChats(true);
      throw err;
    }
  };

  const updateChatStatus = async (chatId, status) => {
    if (!agent) return;
    setChats((prev) => prev.map((c) => (c.id === chatId ? { ...c, status } : c)));
    if (activeChatIdRef.current === chatId) {
      setActiveChat((prev) => (prev ? { ...prev, status } : null));
    }

    try {
      const data = await apiFetch(`/api/chats/${chatId}/status`, {
        method: 'PUT',
        body: JSON.stringify({ status }),
      });
      fetchChats(true);
      if (activeChatIdRef.current === chatId && data.chat) {
        setActiveChat(data.chat);
      }
      return data;
    } catch (err) {
      fetchChats(true);
      throw err;
    }
  };

  const snoozeChat = async (chatId, untilIso) => {
    if (!agent) return;
    const data = await apiFetch(`/api/chats/${chatId}/snooze`, {
      method: 'PUT',
      body: JSON.stringify({ until: untilIso }),
    });
    fetchChats(true);
    if (activeChatIdRef.current === chatId && data.chat) {
      setActiveChat(data.chat);
    }
    return data;
  };

  const updateChatTags = async (chatId, tags) => {
    if (!agent) return;
    const data = await apiFetch(`/api/chats/${chatId}/tags`, {
      method: 'PUT',
      body: JSON.stringify({ tags }),
    });
    const serialized = JSON.stringify(data.tags || []);
    if (activeChatIdRef.current === chatId) {
      setActiveChat((prev) => (prev ? { ...prev, tags: serialized } : null));
    }
    setChats((prev) => prev.map((c) => (c.id === chatId ? { ...c, tags: serialized } : c)));
    return data;
  };

  const updateContact = async (chatId, contactData) => {
    if (!agent) return;
    const data = await apiFetch(`/api/chats/${chatId}/contact`, {
      method: 'PUT',
      body: JSON.stringify(contactData),
    });
    if (data.contact) {
      if (activeChatIdRef.current === chatId) {
        setActiveChat((prev) => (prev ? { ...prev, contact: data.contact } : null));
      }
      setChats((prev) => prev.map((c) => (c.id === chatId ? { ...c, contact: data.contact } : c)));
    }
    return data;
  };

  return (
    <ChatContext.Provider
      value={{
        chats,
        chatCounts,
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
        replyToMessage,
        setReplyToMessage,
        selectChat,
        sendMessage,
        assignChat,
        updateChatStatus,
        snoozeChat,
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
