import React from 'react';
import {
  MessageSquare,
  LayoutDashboard,
  Users,
  FileText,
  Radio,
  ShoppingBag,
  Shield,
  Settings,
  ChevronDown,
  LogOut,
  Bot,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useChat } from '../../context/ChatContext';

export default function WorkspaceSidebar({
  currentView = 'inbox',
  onSelectView,
  onOpenSettings,
  onOpenSimulator,
  onCloseMobile,
}) {
  const { agent, tenant, isAdmin, isManager, logout } = useAuth();
  const { chatCounts, chats } = useChat();

  const totalChatCount = chatCounts?.all ?? chats?.length ?? 0;
  const isWhatsAppConfigured = Boolean(tenant?.hasMetaConfigured);

  const navigate = (view) => {
    if (onSelectView) onSelectView(view);
    if (onCloseMobile) onCloseMobile();
  };

  const navItems = [
    { id: 'inbox', label: 'Inbox', icon: MessageSquare, badge: totalChatCount, visible: true },
    { id: 'overview', label: 'Overview', icon: LayoutDashboard, visible: isManager },
    { id: 'contacts', label: 'Contacts', icon: Users, visible: true },
    { id: 'templates', label: 'Templates', icon: FileText, visible: true },
    { id: 'broadcasts', label: 'Broadcasts', icon: Radio, visible: isManager },
    { id: 'automation', label: 'Automation', icon: Bot, visible: isManager },
    { id: 'commerce', label: 'Catalog', icon: ShoppingBag, visible: isManager },
    { id: 'team', label: 'Team', icon: Shield, visible: isManager },
    { id: 'settings', label: 'Settings', icon: Settings, visible: isAdmin },
  ];

  const roleLabel = agent?.role === 'ADMIN'
    ? 'Admin'
    : agent?.role === 'SUPERVISOR'
      ? 'Supervisor'
      : 'Agent';

  return (
    <aside className="workspace-nav" data-name="Workspace navigation">
      <div className="workspace-nav-brand">
        <div className="workspace-nav-logo-row">
          <div className="workspace-nav-logo-icon">
            <MessageSquare size={16} />
          </div>
          <span className="workspace-nav-title">TeamBee</span>
        </div>
        <span className="workspace-nav-tagline">TEAM INBOX, IN SYNC</span>
      </div>

      <div
        className="workspace-switcher"
        onClick={() => (isAdmin ? navigate('settings') : navigate('inbox'))}
        title={isAdmin ? 'Open workspace settings' : tenant?.name || 'Workspace'}
      >
        <div className="workspace-switcher-info">
          <span className="workspace-switcher-name">
            {tenant?.name || 'TeamBee Workspace'}
          </span>
          <span className="workspace-switcher-slug">
            {tenant?.slug || 'workspace'}
          </span>
        </div>
        <ChevronDown size={15} className="workspace-switcher-chevron" />
      </div>

      <div className="workspace-nav-section">
        <span className="workspace-nav-section-label">WORKSPACE</span>

        <nav className="workspace-nav-links">
          {navItems
            .filter((item) => item.visible)
            .map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  type="button"
                  className={`workspace-nav-item ${currentView === item.id ? 'active' : ''}`}
                  onClick={() => navigate(item.id)}
                >
                  <div className="workspace-nav-item-content">
                    <Icon size={17} />
                    <span>{item.label}</span>
                  </div>
                  {typeof item.badge === 'number' && (
                    <span className="workspace-nav-badge">{item.badge}</span>
                  )}
                </button>
              );
            })}
        </nav>
      </div>

      <div className="workspace-nav-spacer" />

      <div
        className="workspace-channel-status"
        onClick={() => isAdmin && onOpenSettings?.()}
        style={{ cursor: isAdmin ? 'pointer' : 'default' }}
        title="WhatsApp Meta Cloud API Status"
      >
        <div className="channel-status-indicator">
          <span
            className="channel-status-dot"
            style={{ color: isWhatsAppConfigured ? 'var(--tb-nav-status-green)' : '#f59e0b' }}
          >
            ●
          </span>
          <span className="channel-status-title">
            {isWhatsAppConfigured ? 'WhatsApp connected' : 'Setup required'}
          </span>
        </div>
        <span className="channel-status-phone">
          {tenant?.displayPhoneNumber || 'Channel number unset'}
        </span>
        <span className="channel-status-meta">
          Powered by Meta Cloud API
        </span>
      </div>

      {isAdmin && (
        <button
          type="button"
          className="workspace-nav-footer-link"
          onClick={() => {
            if (onOpenSimulator) onOpenSimulator();
            if (onCloseMobile) onCloseMobile();
          }}
          title="Open WhatsApp Inbound Simulator"
        >
          <Bot size={16} />
          <span>Simulator &amp; Tools</span>
        </button>
      )}

      <div className="workspace-nav-divider" />

      <div className="workspace-user-profile">
        <div className="workspace-user-info">
          <span className="workspace-user-name">
            {agent?.name || 'Team Member'}
          </span>
          <span className="workspace-user-role">
            {roleLabel} · {agent?.status === 'BUSY' ? 'Busy' : 'Available'}
          </span>
        </div>
        <button
          type="button"
          onClick={logout}
          className="workspace-user-logout"
          title="Sign out of TeamBee"
        >
          <LogOut size={15} />
        </button>
      </div>
    </aside>
  );
}
