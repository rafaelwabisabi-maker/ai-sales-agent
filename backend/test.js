#!/usr/bin/env node
/**
 * AI Sales Agent — Automated Test Suite
 *
 * Tests: module loading, DB operations, conversation engine,
 * API endpoints (server must be running), and widget serving.
 *
 * Usage:
 *   node test.js          # Unit tests only (no server needed)
 *   node test.js --api    # Unit + API tests (start server first)
 */

'use strict';

require('dotenv').config();
const path = require('path');
const fs = require('fs');

const runApi = process.argv.includes('--api');
const BASE_URL = `http://localhost:${process.env.PORT || 3001}`;

let passed = 0;
let failed = 0;
const failures = [];

function assert(condition, name) {
  if (condition) {
    passed++;
    console.log(`  ✓ ${name}`);
  } else {
    failed++;
    failures.push(name);
    console.log(`  ✗ ${name}`);
  }
}

function assertEq(actual, expected, name) {
  if (actual === expected) {
    passed++;
    console.log(`  ✓ ${name}`);
  } else {
    failed++;
    failures.push(`${name} (got: ${JSON.stringify(actual)}, expected: ${JSON.stringify(expected)})`);
    console.log(`  ✗ ${name} (got: ${JSON.stringify(actual)}, expected: ${JSON.stringify(expected)})`);
  }
}

function assertIncludes(str, substr, name) {
  if (typeof str === 'string' && str.includes(substr)) {
    passed++;
    console.log(`  ✓ ${name}`);
  } else {
    failed++;
    failures.push(name);
    console.log(`  ✗ ${name}`);
  }
}

// ─────────────────────────────────────────
// Unit Tests: Conversation Engine
// ─────────────────────────────────────────
function testConversationEngine() {
  console.log('\n── Conversation Engine ──');

  const { buildSystemPrompt, parseActions, Conversation, PHASES } = require('./conversation-engine');

  // PHASES
  assert(PHASES.GREETING === 'greeting', 'PHASES.GREETING');
  assert(PHASES.DISCOVERY === 'discovery', 'PHASES.DISCOVERY');
  assert(PHASES.PITCH === 'pitch', 'PHASES.PITCH');
  assert(PHASES.CLOSE === 'close', 'PHASES.CLOSE');
  assert(PHASES.BOOKING === 'booking', 'PHASES.BOOKING');
  assert(PHASES.ENDED === 'ended', 'PHASES.ENDED');

  // buildSystemPrompt — basic
  const config = JSON.parse(fs.readFileSync(path.join(__dirname, 'config.json'), 'utf8'));
  const prompt = buildSystemPrompt(config);
  assert(typeof prompt === 'string', 'buildSystemPrompt returns string');
  assert(prompt.length > 100, 'System prompt is substantial');
  assertIncludes(prompt, config.company.name, 'Prompt includes company name');
  assertIncludes(prompt, 'BOOK_CALL', 'Prompt includes BOOK_CALL action');
  assertIncludes(prompt, 'CAPTURE_LEAD', 'Prompt includes CAPTURE_LEAD action');
  assertIncludes(prompt, 'END_CONVERSATION', 'Prompt includes END_CONVERSATION action');

  // buildSystemPrompt — backward compat (no availability data)
  const prompt2 = buildSystemPrompt(config, null);
  assert(typeof prompt2 === 'string', 'buildSystemPrompt with null availability returns string');
  assert(!prompt2.includes('REAL-TIME CALENDAR'), 'No availability section when data is null');

  // buildSystemPrompt — with availability data
  const configWithAvail = { ...config, availability: { enabled: true, defaultTimeZone: 'Europe/Vienna' } };
  const mockAvailability = {
    timeZone: 'Europe/Vienna',
    availableDates: ['Mon, Mar 3: 10:00 AM, 2:00 PM', 'Tue, Mar 4: 9:00 AM'],
    totalSlots: 5,
    totalDays: 2,
    bookingLink: 'https://cal.com/test'
  };
  const promptWithAvail = buildSystemPrompt(configWithAvail, mockAvailability);
  assertIncludes(promptWithAvail, 'REAL-TIME CALENDAR AVAILABILITY', 'Prompt includes availability section');
  assertIncludes(promptWithAvail, 'Mon, Mar 3', 'Prompt includes available date');
  assertIncludes(promptWithAvail, '5 slots', 'Prompt includes total slots');

  // buildSystemPrompt — availability disabled in config
  const configNoAvail = { ...config, availability: { enabled: false } };
  const promptNoAvail = buildSystemPrompt(configNoAvail, mockAvailability);
  assert(!promptNoAvail.includes('REAL-TIME CALENDAR'), 'No availability section when config disabled');

  // buildSystemPrompt — German language
  const configDe = { ...config, company: { ...config.company, language: 'de' } };
  const promptDe = buildSystemPrompt(configDe);
  assertIncludes(promptDe, 'German', 'German prompt includes language instruction');
  assertIncludes(promptDe, 'Sie', 'German prompt uses formal Sie');

  // parseActions — no actions
  const r1 = parseActions('Hello, how can I help?');
  assertEq(r1.actions.length, 0, 'parseActions: no actions in plain text');
  assertEq(r1.cleanText, 'Hello, how can I help?', 'parseActions: clean text preserved');

  // parseActions — single action
  const r2 = parseActions('Great chat!\n```action\n{"type": "BOOK_CALL", "reason": "qualified"}\n```');
  assertEq(r2.actions.length, 1, 'parseActions: extracts 1 action');
  assertEq(r2.actions[0].type, 'BOOK_CALL', 'parseActions: action type is BOOK_CALL');
  assertEq(r2.cleanText, 'Great chat!', 'parseActions: action block removed from text');

  // parseActions — multiple actions
  const r3 = parseActions('Nice!\n```action\n{"type":"CAPTURE_LEAD","data":{"name":"John"}}\n```\nMore text\n```action\n{"type":"BOOK_CALL","reason":"ready"}\n```');
  assertEq(r3.actions.length, 2, 'parseActions: extracts 2 actions');
  assertEq(r3.actions[0].type, 'CAPTURE_LEAD', 'parseActions: first action is CAPTURE_LEAD');
  assertEq(r3.actions[1].type, 'BOOK_CALL', 'parseActions: second action is BOOK_CALL');

  // parseActions — invalid JSON
  const r4 = parseActions('Hmm\n```action\n{bad json}\n```');
  assertEq(r4.actions.length, 0, 'parseActions: skips invalid JSON');
  assertEq(r4.cleanText, 'Hmm', 'parseActions: clean text after invalid action');

  // parseActions — action missing type
  const r5 = parseActions('Hi\n```action\n{"data":"no type"}\n```');
  assertEq(r5.actions.length, 0, 'parseActions: skips action without type field');

  // Conversation class
  const conv = new Conversation('test-123', config);
  assertEq(conv.id, 'test-123', 'Conversation.id');
  assertEq(conv.phase, 'greeting', 'Conversation starts in greeting phase');
  assertEq(conv.messages.length, 0, 'Conversation starts with 0 messages');
  assertEq(conv.bookingOffered, false, 'Conversation starts with bookingOffered=false');

  conv.addMessage('assistant', 'Hi there!');
  assertEq(conv.messages.length, 1, 'Message added');
  assertEq(conv.phase, 'greeting', 'Still greeting with 1 assistant message');

  conv.addMessage('user', 'Hello');
  conv.addMessage('assistant', 'What can I help with?');
  conv.addMessage('user', 'We need developers');
  conv.addMessage('assistant', 'Tell me more');
  assertEq(conv.phase, 'discovery', 'Moves to discovery with 3 assistant messages');

  conv.updateLeadData({ name: 'John', company: 'Acme' });
  assertEq(conv.leadData.name, 'John', 'Lead data name saved');
  assertEq(conv.leadData.company, 'Acme', 'Lead data company saved');

  conv.updateLeadData({ email: 'john@acme.com' });
  assertEq(conv.leadData.name, 'John', 'Lead data merge preserves existing');
  assertEq(conv.leadData.email, 'john@acme.com', 'Lead data merge adds new');

  const summary = conv.toSummary();
  assertEq(summary.id, 'test-123', 'Summary has id');
  assertEq(summary.messageCount, 5, 'Summary message count');
}

// ─────────────────────────────────────────
// Unit Tests: Database (core)
// ─────────────────────────────────────────
function testDatabase() {
  console.log('\n── Database ──');

  const testDbPath = path.join(__dirname, 'data', 'test-conversations.db');
  process.env.DB_PATH = testDbPath;

  delete require.cache[require.resolve('./db')];
  const db = require('./db');

  // Create
  db.createConversation('test-1', 'greeting', {}, 0, false);
  assert(db.conversationExists('test-1'), 'Conversation created and exists');
  assert(!db.conversationExists('nonexistent'), 'Non-existent conversation returns false');

  // Get
  const conv = db.getConversation('test-1');
  assertEq(conv.id, 'test-1', 'Get conversation ID');
  assertEq(conv.phase, 'greeting', 'Get conversation phase');
  assertEq(conv.qualificationScore, 0, 'Get conversation score');
  assertEq(conv.bookingOffered, false, 'Get conversation bookingOffered');
  assertEq(conv.messageCount, 0, 'Get conversation messageCount');

  // Add messages
  db.addMessage('test-1', 'assistant', 'Hello!');
  db.addMessage('test-1', 'user', 'Hi');
  const updated = db.getConversation('test-1');
  assertEq(updated.messageCount, 2, 'Message count incremented');
  assertEq(updated.messages.length, 2, 'Messages retrieved');
  assertEq(updated.messages[0].role, 'assistant', 'First message role');
  assertEq(updated.messages[0].content, 'Hello!', 'First message content');
  assertEq(updated.messages[1].role, 'user', 'Second message role');

  // Update
  db.updateConversation('test-1', { phase: 'discovery', leadData: { name: 'Test' }, qualificationScore: 50, bookingOffered: true });
  const after = db.getConversation('test-1');
  assertEq(after.phase, 'discovery', 'Phase updated');
  assertEq(after.leadData.name, 'Test', 'Lead data updated');
  assertEq(after.qualificationScore, 50, 'Score updated');
  assertEq(after.bookingOffered, true, 'bookingOffered updated');

  // Counts
  db.createConversation('test-2', 'ended', {}, 80, false);
  const counts = db.getConversationCount();
  assert(counts.total >= 2, 'Total count >= 2');
  assert(counts.active >= 1, 'Active count >= 1');

  // Webhook log
  const logId = db.logWebhook('test-1', 'onLeadCaptured', { name: 'Test' }, 'sent', null, 1);
  assert(logId > 0, 'Webhook logged with ID');
  const stats = db.getWebhookStats();
  assert(typeof stats.sent_24h === 'number', 'Webhook stats: sent_24h');
  assert(typeof stats.failed_24h === 'number', 'Webhook stats: failed_24h');

  // Cleanup
  db.close();
  try { fs.unlinkSync(testDbPath); } catch(e) {}
  delete process.env.DB_PATH;
}

// ─────────────────────────────────────────
// Unit Tests: Follow-up DB functions
// ─────────────────────────────────────────
function testFollowUpDatabase() {
  console.log('\n── Follow-Up Database ──');

  const testDbPath = path.join(__dirname, 'data', 'test-followup.db');
  process.env.DB_PATH = testDbPath;

  delete require.cache[require.resolve('./db')];
  const db = require('./db');

  // Setup: create an ended conversation with email in lead_data
  db.createConversation('fu-1', 'ended', { email: 'test@example.com', name: 'Tester' }, 60, false);
  db.addMessage('fu-1', 'assistant', 'Hi');
  db.addMessage('fu-1', 'user', 'Hello');

  // hasBooking — should be false (booking_offered = 0)
  assertEq(db.hasBooking('fu-1'), false, 'hasBooking: false when no booking');

  // hasBooking — true when booking_offered = 1
  db.createConversation('fu-booked', 'ended', {}, 80, true);
  assertEq(db.hasBooking('fu-booked'), true, 'hasBooking: true when booking offered');

  // createFollowUp
  const fuId = db.createFollowUp('fu-1', 'test@example.com', { name: 'Tester' }, 1);
  assert(fuId > 0, 'createFollowUp returns ID');

  // getPendingFollowUps
  const pending = db.getPendingFollowUps();
  assert(pending.length >= 1, 'getPendingFollowUps returns at least 1');
  assertEq(pending[0].conversation_id, 'fu-1', 'Pending follow-up has correct conversation_id');
  assertEq(pending[0].email, 'test@example.com', 'Pending follow-up has correct email');
  assertEq(pending[0].follow_up_number, 1, 'Pending follow-up has correct follow_up_number');
  assertEq(pending[0].status, 'pending', 'Pending follow-up status is pending');
  assert(pending[0].leadData && pending[0].leadData.name === 'Tester', 'Pending follow-up leadData parsed');

  // updateFollowUpStatus
  db.updateFollowUpStatus(fuId, 'sent');
  const afterSent = db.getPendingFollowUps();
  assertEq(afterSent.length, 0, 'No pending follow-ups after marking sent');

  // getFollowUpStats
  const fuStats = db.getFollowUpStats();
  assert(typeof fuStats.total_sent === 'number', 'Follow-up stats: total_sent exists');
  assert(typeof fuStats.pending === 'number', 'Follow-up stats: pending exists');
  assert(typeof fuStats.sent_24h === 'number', 'Follow-up stats: sent_24h exists');
  assertEq(fuStats.total_sent, 1, 'Follow-up stats: 1 sent');
  assertEq(fuStats.pending, 0, 'Follow-up stats: 0 pending');

  // getStaleConversations — note: this depends on timing, so we just verify it runs
  const stale = db.getStaleConversations(0, 2);
  assert(Array.isArray(stale), 'getStaleConversations returns array');

  // Cleanup
  db.close();
  try { fs.unlinkSync(testDbPath); } catch(e) {}
  delete process.env.DB_PATH;
}

// ─────────────────────────────────────────
// Unit Tests: Logger
// ─────────────────────────────────────────
function testLogger() {
  console.log('\n── Logger ──');

  delete require.cache[require.resolve('./logger')];
  const logger = require('./logger');
  assert(typeof logger.info === 'function', 'logger.info exists');
  assert(typeof logger.warn === 'function', 'logger.warn exists');
  assert(typeof logger.error === 'function', 'logger.error exists');
  assert(typeof logger.fatal === 'function', 'logger.fatal exists');
  assert(typeof logger.debug === 'function', 'logger.debug exists');
}

// ─────────────────────────────────────────
// Unit Tests: Webhooks module
// ─────────────────────────────────────────
function testWebhooksModule() {
  console.log('\n── Webhooks Module ──');

  const { fireWebhook, retryFailedWebhooks } = require('./webhooks');
  assert(typeof fireWebhook === 'function', 'fireWebhook exported');
  assert(typeof retryFailedWebhooks === 'function', 'retryFailedWebhooks exported');
}

// ─────────────────────────────────────────
// Unit Tests: Config validation (active config)
// ─────────────────────────────────────────
function testConfig() {
  console.log('\n── Config Validation ──');

  const config = JSON.parse(fs.readFileSync(path.join(__dirname, 'config.json'), 'utf8'));

  assert(config.company && config.company.name, 'Config: company.name exists');
  assert(config.company && config.company.tagline, 'Config: company.tagline exists');
  assert(Array.isArray(config.company?.services), 'Config: company.services is array');
  assert(config.company.services.length > 0, 'Config: at least 1 service');
  assert(Array.isArray(config.company?.differentiators), 'Config: differentiators is array');
  assert(config.booking && config.booking.link, 'Config: booking.link exists');
  assert(config.booking && config.booking.duration > 0, 'Config: booking.duration > 0');
  assert(config.qualification && config.qualification.criteria, 'Config: qualification.criteria exists');
  assert(config.qualification && config.qualification.minScore > 0, 'Config: qualification.minScore > 0');

  config.company.services.forEach((s, i) => {
    assert(s.name, `Config: service[${i}].name`);
    assert(s.description, `Config: service[${i}].description`);
    assert(s.priceRange, `Config: service[${i}].priceRange`);
    assert(s.idealFor, `Config: service[${i}].idealFor`);
  });

  const totalWeight = Object.values(config.qualification.criteria).reduce((sum, c) => sum + c.weight, 0);
  assertEq(totalWeight, 100, 'Config: qualification weights sum to 100');
}

// ─────────────────────────────────────────
// Unit Tests: VantArc config validation
// ─────────────────────────────────────────
function testVantArcConfig() {
  console.log('\n── VantArc Config Validation ──');

  const configPath = path.join(__dirname, 'config-vantarc.json');
  assert(fs.existsSync(configPath), 'config-vantarc.json exists');

  const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));

  // Basic fields
  assertEq(config.company.name, 'VantArc Agency', 'VantArc: company name');
  assert(config.company.tagline.length > 0, 'VantArc: has tagline');
  assertEq(config.company.services.length, 3, 'VantArc: 3 services');
  assert(config.company.differentiators.length >= 3, 'VantArc: at least 3 differentiators');

  // Services have required fields
  config.company.services.forEach((s, i) => {
    assert(s.name, `VantArc: service[${i}].name`);
    assert(s.description, `VantArc: service[${i}].description`);
    assert(s.priceRange, `VantArc: service[${i}].priceRange`);
    assert(s.idealFor, `VantArc: service[${i}].idealFor`);
  });

  // Widget
  assert(config.widget.primaryColor, 'VantArc: widget primaryColor');
  assert(config.widget.accentColor, 'VantArc: widget accentColor');
  assert(config.widget.greeting.length > 0, 'VantArc: widget greeting');

  // Booking
  assert(config.booking.link.includes('cal.com'), 'VantArc: booking uses Cal.com');
  assertEq(config.booking.duration, 30, 'VantArc: 30-minute call');

  // Qualification weights sum to 100
  const totalWeight = Object.values(config.qualification.criteria).reduce((sum, c) => sum + c.weight, 0);
  assertEq(totalWeight, 100, 'VantArc: qualification weights sum to 100');

  // New feature flags
  assert(config.availability, 'VantArc: availability section exists');
  assertEq(config.availability.enabled, true, 'VantArc: availability enabled');
  assertEq(config.availability.defaultTimeZone, 'Europe/Vienna', 'VantArc: timezone is Vienna');
  assertEq(config.availability.lookAheadDays, 14, 'VantArc: 14-day lookahead');

  assert(config.followUp, 'VantArc: followUp section exists');
  assertEq(config.followUp.enabled, true, 'VantArc: followUp enabled');
  assert(Array.isArray(config.followUp.intervals), 'VantArc: followUp intervals is array');
  assertEq(config.followUp.intervals[0], 24, 'VantArc: first interval is 24h');
  assertEq(config.followUp.intervals[1], 48, 'VantArc: second interval is 48h');

  // Webhook keys include new event
  assert(config.webhooks.hasOwnProperty('onFollowUpDue'), 'VantArc: webhooks has onFollowUpDue');
}

// ─────────────────────────────────────────
// Unit Tests: Widget files
// ─────────────────────────────────────────
function testWidgetFiles() {
  console.log('\n── Widget Files ──');

  const widgetDir = path.join(__dirname, '..', 'widget');
  assert(fs.existsSync(path.join(widgetDir, 'chat-widget.html')), 'chat-widget.html exists');
  assert(fs.existsSync(path.join(widgetDir, 'embed.js')), 'embed.js exists');

  const html = fs.readFileSync(path.join(widgetDir, 'chat-widget.html'), 'utf8');
  assertIncludes(html, 'sa-widget', 'Widget HTML has #sa-widget');
  assertIncludes(html, 'sa-messages', 'Widget HTML has #sa-messages');
  assertIncludes(html, 'sa-input', 'Widget HTML has #sa-input');
  assertIncludes(html, 'sa-trigger', 'Widget HTML has trigger button');
  assertIncludes(html, '/api/conversations', 'Widget calls conversation API');
  assertIncludes(html, '/api/config', 'Widget calls config API');
  assertIncludes(html, 'SA_WIDGET_STATE', 'Widget posts state to parent');

  const embed = fs.readFileSync(path.join(widgetDir, 'embed.js'), 'utf8');
  assertIncludes(embed, 'SA_CONFIG', 'Embed reads SA_CONFIG');
  assertIncludes(embed, 'iframe', 'Embed creates iframe');
  assertIncludes(embed, 'SA_WIDGET_STATE', 'Embed listens for widget state');
  assertIncludes(embed, 'chat-widget.html', 'Embed loads widget HTML');
}

// ─────────────────────────────────────────
// Unit Tests: Dockerfile & Railway
// ─────────────────────────────────────────
function testDeploymentFiles() {
  console.log('\n── Deployment Files ──');

  const root = path.join(__dirname, '..');
  assert(fs.existsSync(path.join(root, 'Dockerfile')), 'Dockerfile exists');
  assert(fs.existsSync(path.join(root, 'railway.toml')), 'railway.toml exists');
  assert(fs.existsSync(path.join(root, '.dockerignore')), '.dockerignore exists');

  const dockerfile = fs.readFileSync(path.join(root, 'Dockerfile'), 'utf8');
  assertIncludes(dockerfile, 'node:20', 'Dockerfile uses Node 20');
  assertIncludes(dockerfile, 'npm ci', 'Dockerfile uses npm ci');
  assertIncludes(dockerfile, 'EXPOSE 3001', 'Dockerfile exposes 3001');
  assertIncludes(dockerfile, 'HEALTHCHECK', 'Dockerfile has healthcheck');

  const railway = fs.readFileSync(path.join(root, 'railway.toml'), 'utf8');
  assertIncludes(railway, '/health', 'Railway config has health check path');
}

// ─────────────────────────────────────────
// Unit Tests: N8N workflow references
// ─────────────────────────────────────────
function testN8NWorkflows() {
  console.log('\n── N8N Workflow References ──');

  const n8nDir = path.join(__dirname, '..', 'n8n-workflows');

  // Lead capture
  const leadCapture = path.join(n8nDir, 'lead-capture-workflow.json');
  assert(fs.existsSync(leadCapture), 'lead-capture-workflow.json exists');
  const lcData = JSON.parse(fs.readFileSync(leadCapture, 'utf8'));
  assert(lcData.name, 'Lead capture workflow has name');
  assert(Array.isArray(lcData.nodes), 'Lead capture workflow has nodes');

  // Booking made
  const bookingMade = path.join(n8nDir, 'booking-made-workflow.json');
  assert(fs.existsSync(bookingMade), 'booking-made-workflow.json exists');

  // Follow-up sequence (NEW)
  const followUp = path.join(n8nDir, 'follow-up-sequence-workflow.json');
  assert(fs.existsSync(followUp), 'follow-up-sequence-workflow.json exists');
  const fuData = JSON.parse(fs.readFileSync(followUp, 'utf8'));
  assert(fuData.name, 'Follow-up workflow has name');
  assertIncludes(fuData.name, 'Follow-Up', 'Follow-up workflow name correct');
  assert(Array.isArray(fuData.nodes), 'Follow-up workflow has nodes');
  assert(fuData.nodes.length >= 5, 'Follow-up workflow has at least 5 nodes');

  // Check for kill switch node
  const hasKillSwitch = fuData.nodes.some(n => n.name.includes('Not Already Booked'));
  assert(hasKillSwitch, 'Follow-up workflow has kill switch (Not Already Booked)');

  // Check for 2 email templates
  const emailNodes = fuData.nodes.filter(n => n.type && n.type.includes('gmail'));
  assert(emailNodes.length >= 2, 'Follow-up workflow has at least 2 email templates');

  // README
  const readme = fs.readFileSync(path.join(n8nDir, 'README.md'), 'utf8');
  assertIncludes(readme, 'follow-up-sequence-workflow.json', 'README mentions follow-up workflow');
  assertIncludes(readme, 'onFollowUpDue', 'README mentions onFollowUpDue webhook');
}

// ─────────────────────────────────────────
// API Tests (only with --api flag)
// ─────────────────────────────────────────
async function testApi() {
  console.log('\n── API Endpoints ──');

  // Health
  let res = await fetch(`${BASE_URL}/health`);
  assertEq(res.status, 200, 'GET /health returns 200');
  let data = await res.json();
  assertEq(data.status, 'ok', 'Health status is ok');
  assert(data.model, 'Health returns model');

  // Config
  res = await fetch(`${BASE_URL}/api/config`);
  assertEq(res.status, 200, 'GET /api/config returns 200');
  data = await res.json();
  assert(data.company && data.company.name, '/api/config returns company.name');
  assert(data.booking && data.booking.link, '/api/config returns booking.link');
  assert(!data.qualification, '/api/config does NOT leak qualification criteria');
  assert(!data.webhooks, '/api/config does NOT leak webhooks');

  // Create conversation
  res = await fetch(`${BASE_URL}/api/conversations`, { method: 'POST' });
  assertEq(res.status, 200, 'POST /api/conversations returns 200');
  data = await res.json();
  assert(data.conversationId, 'Returns conversationId');
  assert(data.message, 'Returns greeting message');
  const convId = data.conversationId;

  // UUID format check
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  assert(uuidRegex.test(convId), 'conversationId is valid UUIDv4');

  // Exists check
  res = await fetch(`${BASE_URL}/api/conversations/${convId}/exists`);
  data = await res.json();
  assertEq(data.exists, true, 'Conversation exists after creation');

  // Get conversation
  res = await fetch(`${BASE_URL}/api/conversations/${convId}`);
  assertEq(res.status, 200, 'GET /api/conversations/:id returns 200');
  data = await res.json();
  assertEq(data.id, convId, 'Returns correct conversation');
  assertEq(data.phase, 'greeting', 'Phase is greeting');
  assert(Array.isArray(data.messages), 'Messages is array');
  assert(data.messages.length >= 1, 'Has at least greeting message');

  // Validation: invalid UUID
  res = await fetch(`${BASE_URL}/api/conversations/bad-id/exists`);
  assertEq(res.status, 400, 'Invalid UUID returns 400');

  // Validation: non-existent
  res = await fetch(`${BASE_URL}/api/conversations/00000000-0000-4000-a000-000000000000/exists`);
  data = await res.json();
  assertEq(data.exists, false, 'Non-existent conversation returns false');

  // Validation: empty message
  res = await fetch(`${BASE_URL}/api/conversations/${convId}/messages`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message: '' })
  });
  assertEq(res.status, 400, 'Empty message returns 400');

  // Validation: missing message
  res = await fetch(`${BASE_URL}/api/conversations/${convId}/messages`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({})
  });
  assertEq(res.status, 400, 'Missing message returns 400');

  // Validation: too long
  res = await fetch(`${BASE_URL}/api/conversations/${convId}/messages`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message: 'x'.repeat(2001) })
  });
  assertEq(res.status, 400, 'Too-long message returns 400');

  // Widget static files
  res = await fetch(`${BASE_URL}/widget/chat-widget.html`);
  assertEq(res.status, 200, 'GET /widget/chat-widget.html returns 200');
  const html = await res.text();
  assertIncludes(html, 'sa-widget', 'Widget HTML served correctly');

  res = await fetch(`${BASE_URL}/widget/embed.js`);
  assertEq(res.status, 200, 'GET /widget/embed.js returns 200');

  // 404 for nonexistent conversation
  res = await fetch(`${BASE_URL}/api/conversations/00000000-0000-4000-a000-000000000000`);
  assertEq(res.status, 404, 'Non-existent conversation returns 404');

  // Availability endpoint
  res = await fetch(`${BASE_URL}/api/availability`);
  // If availability is disabled, should be 404. If enabled but no Cal.com keys, should be 502.
  assert(res.status === 404 || res.status === 502, 'Availability endpoint returns 404 (disabled) or 502 (no Cal.com key)');
}

// ─────────────────────────────────────────
// Run all
// ─────────────────────────────────────────
async function main() {
  console.log('╔═══════════════════════════════════════╗');
  console.log('║   AI Sales Agent — Test Suite v2      ║');
  console.log('╚═══════════════════════════════════════╝');

  testConversationEngine();
  testDatabase();
  testFollowUpDatabase();
  testLogger();
  testWebhooksModule();
  testConfig();
  testVantArcConfig();
  testWidgetFiles();
  testDeploymentFiles();
  testN8NWorkflows();

  if (runApi) {
    try {
      await testApi();
    } catch(e) {
      console.log(`\n  ✗ API test error: ${e.message}`);
      failed++;
      failures.push(`API: ${e.message}`);
    }
  } else {
    console.log('\n── Skipping API tests (run with --api flag) ──');
  }

  console.log('\n════════════════════════════════════════');
  console.log(`  Results: ${passed} passed, ${failed} failed`);
  if (failures.length > 0) {
    console.log('\n  Failures:');
    failures.forEach(f => console.log(`    - ${f}`));
  }
  console.log('════════════════════════════════════════\n');

  process.exit(failed > 0 ? 1 : 0);
}

main();
