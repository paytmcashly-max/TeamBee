import React, { useState, useMemo } from 'react';
import { Plus, Search, ArrowUpRight } from 'lucide-react';
import { useChat } from '../../context/ChatContext';
import { formatFullDate, formatRelativeListTime, parseJsonArray } from '../../utils/formatters';

export default function ContactsView({ onOpenChatInInbox, onOpenNewChat }) {
  const { chats, loadingChats, selectChat } = useChat();
  const [searchQuery, setSearchQuery] = useState('');

  const contactsList = useMemo(() => {
    const byContactId = new Map();
    chats.forEach((chat) => {
      if (!chat.contact) return;
      const existing = byContactId.get(chat.contact.id);
      if (!existing || new Date(chat.lastMessageAt) > new Date(existing.lastMessageAt)) {
        byContactId.set(chat.contact.id, {
          ...chat.contact,
          chatId: chat.id,
          chatStatus: chat.status,
          lastMessageAt: chat.lastMessageAt,
          tags: parseJsonArray(chat.tags),
          assignedAgentName: chat.assignedAgent?.name || 'Unassigned',
        });
      }
    });
    return Array.from(byContactId.values());
  }, [chats]);

  const filtered = contactsList.filter((c) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return `${c.name || ''} ${c.waId || ''} ${c.email || ''}`.toLowerCase().includes(q);
  });

  const handleOpenThread = (chatId) => {
    selectChat(chatId);
    if (onOpenChatInInbox) onOpenChatInInbox();
  };

  return (
    <div className="page-scroll-container">
      <div className="workspace-page-header" style={{ padding: '20px 0 18px 0' }}>
        <div className="page-header-text">
          <h1 className="page-header-title">Contacts directory</h1>
          <p className="page-header-subtitle">
            Customers and leads synced from conversations in your active queue.
          </p>
        </div>

        <button type="button" className="btn btn-primary" onClick={onOpenNewChat}>
          <Plus size={15} />
          <span>New contact chat</span>
        </button>
      </div>

      <div className="page-card">
        <div className="page-card-header">
          <h2 className="page-card-title">Customers ({filtered.length})</h2>
          <div style={{ position: 'relative', width: '100%', maxWidth: '240px', flex: '1 1 180px' }}>
            <Search size={14} style={{ position: 'absolute', left: '10px', top: '10px', color: 'var(--tb-text-secondary)' }} />
            <input
              type="text"
              className="tb-input"
              style={{ paddingLeft: '30px', paddingTop: '6px', paddingBottom: '6px', fontSize: '12px' }}
              placeholder="Search name, phone, or email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        {loadingChats && chats.length === 0 ? (
          <p className="tb-hint">Loading customer contacts...</p>
        ) : filtered.length === 0 ? (
          <p className="tb-hint">No matching contacts found.</p>
        ) : (
          <div className="tb-table-wrap">
            <table className="tb-table">
              <thead>
                <tr>
                  <th>Contact</th>
                  <th>WhatsApp</th>
                  <th>Owner</th>
                  <th>Added</th>
                  <th>Last message</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((contact) => (
                  <tr key={contact.id}>
                    <td>
                      <div style={{ fontWeight: 600 }}>{contact.name || `+${contact.waId}`}</div>
                      {contact.email && <div className="tb-hint">{contact.email}</div>}
                    </td>
                    <td>+{contact.waId}</td>
                    <td>{contact.assignedAgentName}</td>
                    <td>{formatFullDate(contact.createdAt)}</td>
                    <td>{formatRelativeListTime(contact.lastMessageAt) || '—'}</td>
                    <td style={{ textAlign: 'right' }}>
                      <button
                        type="button"
                        className="btn btn-secondary"
                        style={{ padding: '5px 10px', fontSize: '11.5px' }}
                        onClick={() => handleOpenThread(contact.chatId)}
                      >
                        <span>Open chat</span>
                        <ArrowUpRight size={13} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
