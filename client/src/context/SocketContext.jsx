import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import { io } from 'socket.io-client';
import { useAuth } from './AuthContext';

const SocketContext = createContext(null);

export function SocketProvider({ children }) {
  const { token, agent } = useAuth();
  const [connected, setConnected] = useState(false);
  const [activeChatRoom, setActiveChatRoom] = useState(null);
  const socketRef = useRef(null);

  useEffect(() => {
    if (!token || !agent) {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
        setConnected(false);
      }
      return;
    }

    // Connect to Socket.io server with JWT authentication handshake
    const socketUrl = import.meta.env.VITE_API_URL ? import.meta.env.VITE_API_URL.replace(/\/+$/, '') : '/';
    const socket = io(socketUrl, {
      auth: { token },
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 10,
      reconnectionDelay: 2000,
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      console.log('⚡ [Socket.io Connected]: Authenticated as', agent.name);
      setConnected(true);
    });

    socket.on('disconnect', (reason) => {
      console.log('⚠️ [Socket.io Disconnected]:', reason);
      setConnected(false);
    });

    socket.on('connect_error', (err) => {
      console.warn('❌ [Socket.io Connect Error]:', err.message);
      setConnected(false);
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
      setConnected(false);
    };
  }, [token, agent?.id]);

  /**
   * Securely join specific chat room with server RBAC check
   */
  const joinChat = (chatId) => {
    return new Promise((resolve, reject) => {
      if (!socketRef.current || !socketRef.current.connected) {
        return resolve({ success: false, reason: 'Socket not connected' });
      }

      socketRef.current.emit('join_chat', { chatId }, (ack) => {
        if (ack?.success) {
          setActiveChatRoom(chatId);
          resolve(ack);
        } else {
          console.warn('Room join rejected:', ack?.error);
          resolve(ack || { success: false });
        }
      });
    });
  };

  /**
   * Leave chat room
   */
  const leaveChat = (chatId) => {
    if (socketRef.current) {
      socketRef.current.emit('leave_chat', { chatId });
      setActiveChatRoom(null);
    }
  };

  /**
   * Emit agent typing indicator
   */
  const emitTyping = (chatId, isTyping) => {
    if (socketRef.current) {
      socketRef.current.emit('typing_indicator', { chatId, isTyping });
    }
  };

  return (
    <SocketContext.Provider
      value={{
        socket: socketRef.current,
        connected,
        activeChatRoom,
        joinChat,
        leaveChat,
        emitTyping,
      }}
    >
      {children}
    </SocketContext.Provider>
  );
}

export function useSocket() {
  const ctx = useContext(SocketContext);
  if (!ctx) throw new Error('useSocket must be used within SocketProvider');
  return ctx;
}
