-- ChatFlow Initial Database Schema Migration for PostgreSQL
-- High-Performance Multi-Tenant Relational Storage for WhatsApp Shared Inbox SaaS

-- Enable UUID extension if using uuid_generate_v4
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. TENANTS (BUSINESSES)
CREATE TABLE IF NOT EXISTS tenants (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(100) UNIQUE NOT NULL,
    waba_id VARCHAR(100),
    phone_number_id VARCHAR(100),
    access_token TEXT,
    webhook_verify_token VARCHAR(255),
    webhook_verify_token_hash VARCHAR(64),
    app_secret VARCHAR(255),
    display_phone_number VARCHAR(50),
    plan VARCHAR(50) DEFAULT 'PRO',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 2. AGENTS (STAFF / USERS)
CREATE TABLE IF NOT EXISTS agents (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    tenant_id TEXT NOT NULL,
    email VARCHAR(255) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL,
    avatar_url TEXT,
    role VARCHAR(50) DEFAULT 'AGENT' CHECK (role IN ('ADMIN', 'AGENT', 'SUPERVISOR')),
    status VARCHAR(50) DEFAULT 'OFFLINE' CHECK (status IN ('ONLINE', 'BUSY', 'OFFLINE')),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_agents_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    CONSTRAINT uq_agents_tenant_email UNIQUE (tenant_id, email)
);
CREATE INDEX IF NOT EXISTS idx_agents_tenant_role ON agents(tenant_id, role);

-- 3. CONTACTS (CUSTOMERS / END USERS)
CREATE TABLE IF NOT EXISTS contacts (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    tenant_id TEXT NOT NULL,
    wa_id VARCHAR(50) NOT NULL, -- WhatsApp international number e.g. 919876543210
    name VARCHAR(255),
    email VARCHAR(255),
    custom_attributes TEXT DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_contacts_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    CONSTRAINT uq_contacts_tenant_wa UNIQUE (tenant_id, wa_id)
);
CREATE INDEX IF NOT EXISTS idx_contacts_tenant_wa ON contacts(tenant_id, wa_id);

-- 4. CHATS (CONVERSATION SESSIONS)
CREATE TABLE IF NOT EXISTS chats (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    tenant_id TEXT NOT NULL,
    contact_id TEXT NOT NULL,
    assigned_agent_id TEXT,
    status VARCHAR(50) DEFAULT 'UNASSIGNED' CHECK (status IN ('UNASSIGNED', 'OPEN', 'RESOLVED')),
    last_message_preview TEXT,
    last_message_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    last_customer_message_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    unread_count INTEGER DEFAULT 0,
    tags TEXT DEFAULT '[]',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_chats_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    CONSTRAINT fk_chats_contact FOREIGN KEY (contact_id) REFERENCES contacts(id) ON DELETE CASCADE,
    CONSTRAINT fk_chats_assigned_agent FOREIGN KEY (assigned_agent_id) REFERENCES agents(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_chats_tenant_status ON chats(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_chats_tenant_agent ON chats(tenant_id, assigned_agent_id);
CREATE INDEX IF NOT EXISTS idx_chats_tenant_last_msg ON chats(tenant_id, last_message_at DESC);

-- 5. MESSAGES (INTERACTION LOGS / TRANSCRIPTS)
CREATE TABLE IF NOT EXISTS messages (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    chat_id TEXT NOT NULL,
    tenant_id TEXT NOT NULL,
    sender_type VARCHAR(50) NOT NULL CHECK (sender_type IN ('CUSTOMER', 'AGENT', 'SYSTEM', 'BOT', 'NOTE')),
    sender_id TEXT,
    wa_message_id VARCHAR(255) UNIQUE, -- Meta WAMID
    client_message_id VARCHAR(128), -- Browser-generated idempotency key
    message_type VARCHAR(50) DEFAULT 'TEXT' CHECK (message_type IN ('TEXT', 'IMAGE', 'AUDIO', 'VIDEO', 'DOCUMENT', 'STICKER', 'LOCATION', 'CONTACTS', 'INTERACTIVE', 'TEMPLATE', 'NOTE')),
    content TEXT,
    media_url TEXT,
    media_mime_type VARCHAR(100),
    media_filename VARCHAR(255),
    media_id VARCHAR(255),
    raw_payload TEXT,
    direction VARCHAR(20) NOT NULL CHECK (direction IN ('INBOUND', 'OUTBOUND')),
    status VARCHAR(50) DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'SENT', 'DELIVERED', 'READ', 'FAILED')),
    error_code VARCHAR(100),
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_messages_chat FOREIGN KEY (chat_id) REFERENCES chats(id) ON DELETE CASCADE,
    CONSTRAINT fk_messages_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    CONSTRAINT fk_messages_sender_agent FOREIGN KEY (sender_id) REFERENCES agents(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_messages_chat_created ON messages(chat_id, created_at ASC);
CREATE INDEX IF NOT EXISTS idx_messages_wa_id ON messages(wa_message_id);
CREATE INDEX IF NOT EXISTS idx_messages_tenant_created ON messages(tenant_id, created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS uq_messages_tenant_client_id ON messages(tenant_id, client_message_id) WHERE client_message_id IS NOT NULL;

-- 6. TEMPLATES (APPROVED META WHATSAPP TEMPLATES)
CREATE TABLE IF NOT EXISTS templates (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    tenant_id TEXT NOT NULL,
    name VARCHAR(255) NOT NULL,
    category VARCHAR(50) DEFAULT 'UTILITY' CHECK (category IN ('MARKETING', 'UTILITY', 'AUTHENTICATION')),
    language VARCHAR(20) DEFAULT 'en',
    status VARCHAR(50) DEFAULT 'APPROVED' CHECK (status IN ('APPROVED', 'PENDING', 'REJECTED')),
    header_type VARCHAR(50) DEFAULT 'NONE',
    header_content TEXT,
    body_text TEXT NOT NULL,
    footer_text TEXT,
    buttons TEXT DEFAULT '[]',
    example_variables TEXT DEFAULT '[]',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_templates_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    CONSTRAINT uq_templates_tenant_name_lang UNIQUE (tenant_id, name, language)
);

-- 7. BROADCASTS & CAMPAIGNS
CREATE TABLE IF NOT EXISTS broadcasts (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    tenant_id TEXT NOT NULL,
    template_id TEXT NOT NULL,
    name VARCHAR(255) NOT NULL,
    total_count INTEGER DEFAULT 0,
    sent_count INTEGER DEFAULT 0,
    delivered_count INTEGER DEFAULT 0,
    read_count INTEGER DEFAULT 0,
    failed_count INTEGER DEFAULT 0,
    variables TEXT DEFAULT '{}',
    status VARCHAR(50) DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'RUNNING', 'COMPLETED', 'PAUSED')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_broadcasts_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    CONSTRAINT fk_broadcasts_template FOREIGN KEY (template_id) REFERENCES templates(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS broadcast_recipients (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    broadcast_id TEXT NOT NULL,
    phone VARCHAR(50) NOT NULL,
    name VARCHAR(255),
    wa_message_id VARCHAR(255),
    status VARCHAR(50) DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'PROCESSING', 'SENT', 'DELIVERED', 'READ', 'FAILED')),
    attempts INTEGER DEFAULT 0,
    error_message TEXT,
    sent_at TIMESTAMP WITH TIME ZONE,
    delivered_at TIMESTAMP WITH TIME ZONE,
    read_at TIMESTAMP WITH TIME ZONE,
    last_error TEXT,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_broadcast_recipients_broadcast FOREIGN KEY (broadcast_id) REFERENCES broadcasts(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_broadcast_recipients_status ON broadcast_recipients(broadcast_id, status);

-- 8. DURABLE WEBHOOK EVENT INBOX
CREATE TABLE IF NOT EXISTS webhook_events (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    tenant_id TEXT,
    payload_hash VARCHAR(64) UNIQUE NOT NULL,
    payload TEXT NOT NULL,
    status VARCHAR(50) DEFAULT 'RECEIVED' CHECK (status IN ('RECEIVED', 'PROCESSING', 'PROCESSED', 'FAILED')),
    attempts INTEGER DEFAULT 0,
    last_error TEXT,
    received_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    processed_at TIMESTAMP WITH TIME ZONE,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_webhook_events_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_webhook_events_status_received ON webhook_events(status, received_at);
CREATE INDEX IF NOT EXISTS idx_webhook_events_tenant_received ON webhook_events(tenant_id, received_at);
