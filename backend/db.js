/**
 * SQLite Persistence Layer
 *
 * Tables:
 * - conversations: core conversation state
 * - messages: individual messages with role + content
 * - webhook_log: every webhook attempt (success + failure)
 *
 * Uses better-sqlite3 (synchronous, fast, production-grade).
 */

'use strict';

const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const DB_PATH = process.env.DB_PATH || path.join(__dirname, 'data', 'conversations.db');

// Ensure data directory exists
const dataDir = path.dirname(DB_PATH);
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const db = new Database(DB_PATH);

// Performance settings
db.pragma('journal_mode = WAL');
db.pragma('synchronous = NORMAL');
db.pragma('foreign_keys = ON');

// --- Schema ---
db.exec(`
  CREATE TABLE IF NOT EXISTS conversations (
    id TEXT PRIMARY KEY,
    phase TEXT NOT NULL DEFAULT 'greeting',
    lead_data TEXT NOT NULL DEFAULT '{}',
    qualification_score INTEGER NOT NULL DEFAULT 0,
    booking_offered INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    last_activity TEXT NOT NULL DEFAULT (datetime('now')),
    message_count INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    conversation_id TEXT NOT NULL,
    role TEXT NOT NULL,
    content TEXT NOT NULL,
    timestamp TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id);
  CREATE INDEX IF NOT EXISTS idx_conversations_last_activity ON conversations(last_activity);

  CREATE TABLE IF NOT EXISTS webhook_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    conversation_id TEXT,
    event TEXT NOT NULL,
    payload TEXT NOT NULL DEFAULT '{}',
    status TEXT NOT NULL DEFAULT 'pending',
    error TEXT,
    attempts INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    last_attempt TEXT
  );

  CREATE INDEX IF NOT EXISTS idx_webhook_status ON webhook_log(status);

  CREATE TABLE IF NOT EXISTS follow_ups (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    conversation_id TEXT NOT NULL,
    email TEXT NOT NULL,
    lead_data TEXT NOT NULL DEFAULT '{}',
    follow_up_number INTEGER NOT NULL DEFAULT 1,
    status TEXT NOT NULL DEFAULT 'pending',
    scheduled_at TEXT NOT NULL DEFAULT (datetime('now')),
    sent_at TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS idx_follow_ups_status ON follow_ups(status);
  CREATE INDEX IF NOT EXISTS idx_follow_ups_conversation ON follow_ups(conversation_id);
`);

// --- Prepared Statements ---
const stmts = {
  createConversation: db.prepare(`
    INSERT INTO conversations (id, phase, lead_data, qualification_score, booking_offered, created_at, last_activity, message_count)
    VALUES (?, ?, ?, ?, ?, datetime('now'), datetime('now'), 0)
  `),

  getConversation: db.prepare(`
    SELECT * FROM conversations WHERE id = ?
  `),

  updateConversation: db.prepare(`
    UPDATE conversations
    SET phase = ?, lead_data = ?, qualification_score = ?, booking_offered = ?,
        last_activity = datetime('now'), message_count = ?
    WHERE id = ?
  `),

  conversationExists: db.prepare(`
    SELECT 1 FROM conversations WHERE id = ?
  `),

  addMessage: db.prepare(`
    INSERT INTO messages (conversation_id, role, content, timestamp)
    VALUES (?, ?, ?, datetime('now'))
  `),

  getMessages: db.prepare(`
    SELECT role, content, timestamp FROM messages
    WHERE conversation_id = ? ORDER BY id ASC
  `),

  incrementMessageCount: db.prepare(`
    UPDATE conversations SET message_count = message_count + 1, last_activity = datetime('now') WHERE id = ?
  `),

  deleteConversation: db.prepare(`
    DELETE FROM conversations WHERE id = ?
  `),

  getConversationCount: db.prepare(`
    SELECT COUNT(*) as total FROM conversations
  `),

  getActiveConversationCount: db.prepare(`
    SELECT COUNT(*) as active FROM conversations WHERE phase != 'ended'
  `),

  cleanupOldConversations: db.prepare(`
    DELETE FROM conversations WHERE last_activity < datetime('now', ?)
  `),

  // Webhook log
  logWebhook: db.prepare(`
    INSERT INTO webhook_log (conversation_id, event, payload, status, error, attempts, last_attempt)
    VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
  `),

  updateWebhookStatus: db.prepare(`
    UPDATE webhook_log SET status = ?, error = ?, attempts = ?, last_attempt = datetime('now')
    WHERE id = ?
  `),

  getFailedWebhooks: db.prepare(`
    SELECT * FROM webhook_log WHERE status = 'failed' AND attempts < 3
  `),

  getPendingRetryWebhooks: db.prepare(`
    SELECT * FROM webhook_log WHERE status = 'retry_pending'
  `),

  getWebhookStats: db.prepare(`
    SELECT
      COUNT(CASE WHEN status = 'sent' AND created_at > datetime('now', '-1 day') THEN 1 END) as sent_24h,
      COUNT(CASE WHEN status = 'failed' AND created_at > datetime('now', '-1 day') THEN 1 END) as failed_24h,
      COUNT(CASE WHEN status = 'retry_pending' THEN 1 END) as pending_retry
    FROM webhook_log
  `),

  // Follow-up statements
  getStaleConversations: db.prepare(`
    SELECT c.id, c.lead_data, c.phase, c.last_activity, c.booking_offered
    FROM conversations c
    WHERE c.phase = 'ended'
      AND c.booking_offered = 0
      AND c.last_activity < datetime('now', ? || ' hours')
      AND c.lead_data LIKE '%"email"%'
      AND NOT EXISTS (
        SELECT 1 FROM follow_ups f
        WHERE f.conversation_id = c.id AND f.follow_up_number = ?
      )
  `),

  createFollowUp: db.prepare(`
    INSERT INTO follow_ups (conversation_id, email, lead_data, follow_up_number, status, scheduled_at)
    VALUES (?, ?, ?, ?, 'pending', datetime('now'))
  `),

  getPendingFollowUps: db.prepare(`
    SELECT * FROM follow_ups WHERE status = 'pending'
  `),

  updateFollowUpStatus: db.prepare(`
    UPDATE follow_ups SET status = ?, sent_at = CASE WHEN ? = 'sent' THEN datetime('now') ELSE sent_at END
    WHERE id = ?
  `),

  hasBooking: db.prepare(`
    SELECT 1 FROM conversations WHERE id = ? AND booking_offered = 1
  `),

  getFollowUpStats: db.prepare(`
    SELECT
      COUNT(CASE WHEN status = 'sent' THEN 1 END) as total_sent,
      COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending,
      COUNT(CASE WHEN status = 'sent' AND sent_at > datetime('now', '-1 day') THEN 1 END) as sent_24h
    FROM follow_ups
  `)
};

// --- Public API ---

function createConversation(id, phase, leadData, qualificationScore, bookingOffered) {
  stmts.createConversation.run(
    id,
    phase || 'greeting',
    JSON.stringify(leadData || {}),
    qualificationScore || 0,
    bookingOffered ? 1 : 0
  );
}

function getConversation(id) {
  const row = stmts.getConversation.get(id);
  if (!row) return null;

  const messages = stmts.getMessages.all(id);

  return {
    id: row.id,
    phase: row.phase,
    leadData: JSON.parse(row.lead_data),
    qualificationScore: row.qualification_score,
    bookingOffered: !!row.booking_offered,
    createdAt: row.created_at,
    lastActivity: row.last_activity,
    messageCount: row.message_count,
    messages
  };
}

function conversationExists(id) {
  return !!stmts.conversationExists.get(id);
}

function addMessage(conversationId, role, content) {
  stmts.addMessage.run(conversationId, role, content);
  stmts.incrementMessageCount.run(conversationId);
}

function updateConversation(id, updates) {
  const current = stmts.getConversation.get(id);
  if (!current) return false;

  const phase = updates.phase || current.phase;
  const leadData = updates.leadData ? JSON.stringify(updates.leadData) : current.lead_data;
  const qualificationScore = updates.qualificationScore !== undefined ? updates.qualificationScore : current.qualification_score;
  const bookingOffered = updates.bookingOffered !== undefined ? (updates.bookingOffered ? 1 : 0) : current.booking_offered;
  const messageCount = updates.messageCount !== undefined ? updates.messageCount : current.message_count;

  stmts.updateConversation.run(phase, leadData, qualificationScore, bookingOffered, messageCount, id);
  return true;
}

function getConversationCount() {
  const total = stmts.getConversationCount.get().total;
  const active = stmts.getActiveConversationCount.get().active;
  return { total, active };
}

function cleanupOldConversations(hoursOld) {
  const modifier = `-${hoursOld || 48} hours`;
  const result = stmts.cleanupOldConversations.run(modifier);
  return result.changes;
}

// Webhook log functions
function logWebhook(conversationId, event, payload, status, error, attempts) {
  const result = stmts.logWebhook.run(
    conversationId,
    event,
    JSON.stringify(payload),
    status || 'pending',
    error || null,
    attempts || 0
  );
  return result.lastInsertRowid;
}

function updateWebhookStatus(id, status, error, attempts) {
  stmts.updateWebhookStatus.run(status, error || null, attempts, id);
}

function getFailedWebhooks() {
  return stmts.getFailedWebhooks.all().map(row => ({
    ...row,
    payload: JSON.parse(row.payload)
  }));
}

function getWebhookStats() {
  return stmts.getWebhookStats.get();
}

// Follow-up functions
function getStaleConversations(hoursOld, followUpNumber) {
  const modifier = `-${hoursOld}`;
  return stmts.getStaleConversations.all(modifier, followUpNumber).map(row => ({
    ...row,
    leadData: JSON.parse(row.lead_data),
    bookingOffered: !!row.booking_offered
  }));
}

function createFollowUp(conversationId, email, leadData, followUpNumber) {
  const result = stmts.createFollowUp.run(
    conversationId,
    email,
    JSON.stringify(leadData || {}),
    followUpNumber
  );
  return result.lastInsertRowid;
}

function getPendingFollowUps() {
  return stmts.getPendingFollowUps.all().map(row => ({
    ...row,
    leadData: JSON.parse(row.lead_data)
  }));
}

function updateFollowUpStatus(id, status) {
  stmts.updateFollowUpStatus.run(status, status, id);
}

function hasBooking(conversationId) {
  return !!stmts.hasBooking.get(conversationId);
}

function getFollowUpStats() {
  return stmts.getFollowUpStats.get();
}

function close() {
  db.close();
}

module.exports = {
  createConversation,
  getConversation,
  conversationExists,
  addMessage,
  updateConversation,
  getConversationCount,
  cleanupOldConversations,
  logWebhook,
  updateWebhookStatus,
  getFailedWebhooks,
  getWebhookStats,
  getStaleConversations,
  createFollowUp,
  getPendingFollowUps,
  updateFollowUpStatus,
  hasBooking,
  getFollowUpStats,
  close
};
