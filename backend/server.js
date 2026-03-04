require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { v4: uuidv4 } = require('uuid');
const Anthropic = require('@anthropic-ai/sdk');
const fs = require('fs');
const path = require('path');
const { buildSystemPrompt, parseActions, PHASES } = require('./conversation-engine');
const db = require('./db');
const logger = require('./logger');
const { fireWebhook, retryFailedWebhooks } = require('./webhooks');

const app = express();
const PORT = process.env.PORT || 3001;

// --- Config ---
const configPath = process.env.CONFIG_PATH || path.join(__dirname, 'config.json');
let config;
try {
  config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
} catch (e) {
  logger.fatal('Missing config.json — copy config-example.json to config.json and customize it');
  process.exit(1);
}

// Validate required config fields
const requiredFields = [
  ['company.name', config.company?.name],
  ['company.tagline', config.company?.tagline],
  ['company.services', config.company?.services],
  ['booking.link', config.booking?.link],
  ['qualification.criteria', config.qualification?.criteria]
];
const missing = requiredFields.filter(([, val]) => !val).map(([key]) => key);
if (missing.length > 0) {
  logger.fatal({ missing }, 'config.json missing required fields');
  process.exit(1);
}

const maxMessages = (config.limits && config.limits.maxMessages) || 30;
const maxTokens = (config.limits && config.limits.maxTokens) || 500;
const modelName = config.model || 'claude-haiku-4-5-20251001';

// --- Claude Client ---
const anthropic = new Anthropic.default({
  timeout: 30 * 1000,  // 30s timeout — don't let users stare at typing dots forever
  maxRetries: 1         // 1 automatic retry on transient errors
});

// --- Security ---
app.use(helmet({
  contentSecurityPolicy: false,  // Widget needs inline styles
  crossOriginEmbedderPolicy: false  // Widget is embedded via iframe
}));

// --- Rate Limiting ---
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,  // 15 minutes
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests. Please try again later.' },
  handler: (req, res, next, options) => {
    logger.warn({ ip: req.ip, path: req.path }, 'Global rate limit hit');
    res.status(429).json(options.message);
  }
});

const conversationStartLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,  // 1 hour
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many conversations started. Please try again later.' },
  handler: (req, res, next, options) => {
    logger.warn({ ip: req.ip }, 'Conversation start rate limit hit');
    res.status(429).json(options.message);
  }
});

const messageLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,  // 15 minutes
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many messages. Please slow down.' },
  handler: (req, res, next, options) => {
    logger.warn({ ip: req.ip }, 'Message rate limit hit');
    res.status(429).json(options.message);
  }
});

// --- Middleware ---
app.use(globalLimiter);
// CORS — require ALLOWED_ORIGINS in production
const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',').map(o => o.trim())
  : null;

if (!allowedOrigins && process.env.NODE_ENV === 'production') {
  logger.fatal('ALLOWED_ORIGINS not configured — refusing to start in production');
  process.exit(1);
}

app.use(cors({
  origin: allowedOrigins || ['http://localhost:3001', 'http://localhost:3000'],
  methods: ['GET', 'POST'],
  credentials: true
}));
app.use(express.json({ limit: '10kb' }));

// --- Validation helpers ---
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function validateConversationId(id) {
  return typeof id === 'string' && UUID_REGEX.test(id);
}

// --- Cost estimation (rough cents) ---
function estimateCost(inputTokens, outputTokens, model) {
  // Haiku: $1/$5 per million tokens (input/output)
  // Sonnet: $3/$15 per million tokens
  const isHaiku = model.includes('haiku');
  const inputRate = isHaiku ? 1 : 3;
  const outputRate = isHaiku ? 5 : 15;
  return ((inputTokens * inputRate) + (outputTokens * outputRate)) / 1_000_000;
}

// --- Serve widget static files ---
app.use('/widget', express.static(path.join(__dirname, '..', 'widget')));

// --- Serve demo dashboard ---
app.use('/demo', express.static(path.join(__dirname, '..', 'deploy')));
app.get('/', (req, res) => res.redirect('/demo/index.html'));

// --- Health check ---
app.get('/health', (req, res) => {
  const counts = db.getConversationCount();
  const webhookStats = db.getWebhookStats();
  const response = {
    status: 'ok',
    conversations: counts,
    webhooks: webhookStats,
    uptime: Math.floor(process.uptime()),
    model: modelName
  };
  if (config.followUp?.enabled) {
    response.followUps = db.getFollowUpStats();
  }
  if (config.availability?.enabled) {
    response.availability = 'enabled';
  }
  res.json(response);
});

// --- Get widget config (public — no secrets) ---
app.get('/api/config', (req, res) => {
  res.json({
    company: {
      name: config.company.name,
      tagline: config.company.tagline,
      language: config.company.language
    },
    widget: config.widget,
    booking: {
      link: config.booking.link,
      duration: config.booking.duration
    }
  });
});

// --- Cal.com availability check ---
async function fetchCalcomAvailability(timeZone) {
  const calApiKey = process.env.CALCOM_API_KEY;
  const eventSlug = process.env.CALCOM_EVENT_SLUG;
  const username = process.env.CALCOM_USERNAME;
  if (!calApiKey || !eventSlug || !username) return null;

  const now = new Date();
  const lookAhead = config.availability?.lookAheadDays || 14;
  const startDate = now.toISOString().split('T')[0];
  const endDate = new Date(now.getTime() + lookAhead * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  const tz = timeZone || config.availability?.defaultTimeZone || 'UTC';

  const url = `https://api.cal.com/v2/slots?eventTypeSlug=${encodeURIComponent(eventSlug)}&username=${encodeURIComponent(username)}&start=${encodeURIComponent(startDate + 'T00:00:00Z')}&end=${encodeURIComponent(endDate + 'T23:59:59Z')}&timeZone=${encodeURIComponent(tz)}`;

  const calRes = await fetch(url, {
    headers: {
      'cal-api-version': '2024-09-04',
      'Authorization': `Bearer ${calApiKey}`
    },
    signal: AbortSignal.timeout(5000)
  });

  if (!calRes.ok) {
    const errorText = await calRes.text();
    logger.warn({ status: calRes.status, error: errorText }, 'Cal.com API error');
    return null;
  }

  const calData = await calRes.json();
  const slots = calData.data || {};
  const availableDates = Object.keys(slots).filter(date => slots[date].length > 0);

  return {
    timeZone: tz,
    start: startDate,
    end: endDate,
    availableDates: availableDates.slice(0, 7).map(date => {
      const daySlots = slots[date];
      const times = daySlots.slice(0, 3).map(s => {
        const d = new Date(s.start);
        return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', timeZone: tz });
      });
      const dateStr = new Date(date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: tz });
      return `${dateStr}: ${times.join(', ')}${daySlots.length > 3 ? ` (+${daySlots.length - 3} more)` : ''}`;
    }),
    totalSlots: Object.values(slots).reduce((sum, s) => sum + s.length, 0),
    totalDays: availableDates.length,
    bookingLink: config.booking.link
  };
}

app.get('/api/availability', async (req, res) => {
  if (!config.availability?.enabled) {
    return res.status(404).json({ error: 'Availability checking not enabled' });
  }
  try {
    const data = await fetchCalcomAvailability(req.query.timeZone);
    if (!data) {
      return res.status(502).json({ error: 'Calendar service unavailable or not configured' });
    }
    res.json(data);
  } catch (error) {
    logger.error({ err: error }, 'Error checking availability');
    res.status(500).json({ error: 'Failed to check availability' });
  }
});

// --- Start new conversation ---
app.post('/api/conversations', conversationStartLimiter, async (req, res) => {
  try {
    const id = uuidv4();
    const greeting = config.widget.greeting || `Hi! I'm here to help. What brings you to ${config.company.name} today?`;

    db.createConversation(id, PHASES.GREETING, {}, 0, false);
    db.addMessage(id, 'assistant', greeting);

    logger.info({ conversationId: id }, 'Conversation started');

    res.json({
      conversationId: id,
      message: greeting
    });
  } catch (error) {
    logger.error({ err: error }, 'Error starting conversation');
    res.status(500).json({ error: 'Failed to start conversation' });
  }
});

// --- Check if conversation exists (for widget reconnection) ---
app.get('/api/conversations/:id/exists', (req, res) => {
  if (!validateConversationId(req.params.id)) {
    return res.status(400).json({ error: 'Invalid conversation ID' });
  }
  const exists = db.conversationExists(req.params.id);
  res.json({ exists });
});

// --- Send message ---
app.post('/api/conversations/:id/messages', messageLimiter, async (req, res) => {
  const startTime = Date.now();
  try {
    const { id } = req.params;
    const { message } = req.body;

    // Validate conversation ID
    if (!validateConversationId(id)) {
      return res.status(400).json({ error: 'Invalid conversation ID' });
    }

    // Validate message
    if (!message || typeof message !== 'string') {
      return res.status(400).json({ error: 'Message is required' });
    }

    const trimmed = message.trim();
    if (trimmed.length === 0) {
      return res.status(400).json({ error: 'Message cannot be empty' });
    }
    if (trimmed.length > 2000) {
      return res.status(400).json({ error: 'Message too long (max 2000 characters)' });
    }

    const conversation = db.getConversation(id);
    if (!conversation) {
      return res.status(404).json({ error: 'Conversation not found' });
    }

    if (conversation.phase === 'ended') {
      return res.status(400).json({ error: 'Conversation has ended' });
    }

    // Cost cap: check message count BEFORE calling Claude
    if (conversation.messageCount >= maxMessages) {
      logger.warn({ conversationId: id, messageCount: conversation.messageCount }, 'Conversation cost cap reached');
      const capMessage = config.company.language === 'pt-BR'
        ? `Foi ótimo conversar com você! Para os próximos passos, agende uma conversa diretamente com nossa equipe: ${config.booking.link}`
        : `This has been a great conversation! For next steps, book a call with the team directly: ${config.booking.link}`;

      db.addMessage(id, 'assistant', capMessage);
      db.updateConversation(id, { phase: 'ended' });

      return res.json({
        message: capMessage,
        actions: [{ type: 'SHOW_BOOKING', bookingLink: config.booking.link, duration: config.booking.duration }],
        phase: 'ended',
        conversationId: id
      });
    }

    // Add user message to DB
    db.addMessage(id, 'user', trimmed);

    // Re-fetch to get updated messages for API
    const updated = db.getConversation(id);
    const messagesForAPI = updated.messages.map(m => ({ role: m.role, content: m.content }));

    // Fetch live availability if enabled (non-blocking fallback)
    let availabilityData = null;
    if (config.availability?.enabled) {
      try {
        availabilityData = await fetchCalcomAvailability();
      } catch (err) {
        logger.warn({ err: err.message }, 'Failed to fetch Cal.com availability — continuing without it');
      }
    }

    // Call Claude
    const systemPrompt = buildSystemPrompt(config, availabilityData);
    const response = await anthropic.messages.create({
      model: modelName,
      max_tokens: maxTokens,
      system: systemPrompt,
      messages: messagesForAPI
    });

    // Log token usage (CRITICAL for cost monitoring)
    const inputTokens = response.usage.input_tokens;
    const outputTokens = response.usage.output_tokens;
    const cost = estimateCost(inputTokens, outputTokens, modelName);
    logger.info({
      conversationId: id,
      inputTokens,
      outputTokens,
      model: modelName,
      estimatedCostUSD: cost.toFixed(6),
      responseTimeMs: Date.now() - startTime
    }, 'Claude API call');

    const rawContent = response.content[0].text;
    const { cleanText, actions } = parseActions(rawContent, logger);

    // Process actions
    const actionResults = [];
    for (const action of actions) {
      const result = await processAction(action, id, updated);
      actionResults.push(result);
      logger.info({ conversationId: id, actionType: action.type }, 'Action processed');
    }

    // Add assistant response to DB
    db.addMessage(id, 'assistant', cleanText);

    // Estimate phase from message count
    const assistantCount = updated.messages.filter(m => m.role === 'assistant').length + 1;
    let phase;
    if (assistantCount <= 1) phase = PHASES.GREETING;
    else if (assistantCount <= 4) phase = PHASES.DISCOVERY;
    else if (assistantCount <= 6) phase = PHASES.PITCH;
    else phase = PHASES.CLOSE;

    // Update phase in DB (unless action already set it to ended)
    const currentConv = db.getConversation(id);
    if (currentConv.phase !== 'ended') {
      db.updateConversation(id, { phase });
    }

    res.json({
      message: cleanText,
      actions: actionResults,
      phase: currentConv.phase !== 'ended' ? phase : 'ended',
      conversationId: id
    });
  } catch (error) {
    logger.error({ err: error, conversationId: req.params.id, responseTimeMs: Date.now() - startTime }, 'Error processing message');
    res.status(500).json({ error: 'Failed to process message' });
  }
});

// --- Get conversation (with messages for widget reconnection) ---
app.get('/api/conversations/:id', (req, res) => {
  if (!validateConversationId(req.params.id)) {
    return res.status(400).json({ error: 'Invalid conversation ID' });
  }

  const conversation = db.getConversation(req.params.id);
  if (!conversation) {
    return res.status(404).json({ error: 'Conversation not found' });
  }
  res.json({
    id: conversation.id,
    phase: conversation.phase,
    leadData: conversation.leadData,
    qualificationScore: conversation.qualificationScore,
    messageCount: conversation.messageCount,
    bookingOffered: conversation.bookingOffered,
    createdAt: conversation.createdAt,
    lastActivity: conversation.lastActivity,
    messages: conversation.messages
  });
});

// --- Process actions from the AI ---
async function processAction(action, conversationId, conversation) {
  switch (action.type) {
    case 'BOOK_CALL':
      db.updateConversation(conversationId, { bookingOffered: true });
      return {
        type: 'SHOW_BOOKING',
        bookingLink: config.booking.link,
        duration: config.booking.duration
      };

    case 'CAPTURE_LEAD': {
      const currentLead = conversation.leadData || {};
      const mergedLead = { ...currentLead, ...action.data };
      db.updateConversation(conversationId, { leadData: mergedLead });
      await fireWebhook('onLeadCaptured', {
        conversationId,
        leadData: action.data,
        timestamp: new Date().toISOString()
      }, conversationId, config.webhooks);
      return { type: 'LEAD_CAPTURED', data: action.data };
    }

    case 'END_CONVERSATION':
      db.updateConversation(conversationId, {
        phase: 'ended',
        qualificationScore: action.qualificationScore || 0
      });
      await fireWebhook('onConversationEnd', {
        conversationId,
        leadData: conversation.leadData,
        qualificationScore: action.qualificationScore || 0,
        reason: action.reason,
        messageCount: conversation.messageCount,
        timestamp: new Date().toISOString()
      }, conversationId, config.webhooks);
      return { type: 'CONVERSATION_ENDED', reason: action.reason };

    default:
      logger.warn({ conversationId, actionType: action.type }, 'Unknown action type');
      return { type: 'UNKNOWN_ACTION', original: action };
  }
}

// --- Cleanup old conversations (>48 hours) — runs every 30 min ---
setInterval(() => {
  const deleted = db.cleanupOldConversations(48);
  if (deleted > 0) {
    logger.info({ deleted }, 'Cleaned up stale conversations');
  }
}, 30 * 60 * 1000);

// --- Retry failed webhooks — runs every 5 min ---
setInterval(() => {
  retryFailedWebhooks(config.webhooks).catch(err => {
    logger.error({ err: err.message }, 'Error retrying failed webhooks');
  });
}, 5 * 60 * 1000);

// --- Follow-up system: check for stale conversations every 15 min ---
if (config.followUp?.enabled) {
  const followUpIntervals = config.followUp.intervals || [24, 48];

  setInterval(async () => {
    try {
      for (let i = 0; i < followUpIntervals.length; i++) {
        const hoursOld = followUpIntervals[i];
        const followUpNumber = i + 1;
        const stale = db.getStaleConversations(hoursOld, followUpNumber);

        for (const conv of stale) {
          const email = conv.leadData?.email;
          if (!email) continue;

          // Kill switch: skip if they booked in the meantime
          if (db.hasBooking(conv.id)) {
            logger.info({ conversationId: conv.id, followUpNumber }, 'Follow-up skipped — booking exists');
            continue;
          }

          db.createFollowUp(conv.id, email, conv.leadData, followUpNumber);

          await fireWebhook('onFollowUpDue', {
            conversationId: conv.id,
            email,
            leadData: conv.leadData,
            followUpNumber,
            hoursSinceChat: hoursOld,
            qualificationScore: conv.qualification_score,
            bookingLink: config.booking.link,
            timestamp: new Date().toISOString()
          }, conv.id, config.webhooks);

          logger.info({ conversationId: conv.id, email, followUpNumber, hoursOld }, 'Follow-up triggered');
        }
      }
    } catch (err) {
      logger.error({ err: err.message }, 'Error in follow-up checker');
    }
  }, 15 * 60 * 1000);

  logger.info({ intervals: followUpIntervals }, 'Follow-up system enabled');
}

// --- Graceful shutdown ---
function shutdown(signal) {
  logger.info({ signal }, 'Shutting down gracefully');
  db.close();
  process.exit(0);
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

// --- Start ---
app.listen(PORT, () => {
  const counts = db.getConversationCount();
  logger.info({
    port: PORT,
    company: config.company.name,
    model: modelName,
    maxMessages,
    maxTokens,
    conversations: counts
  }, 'AI Sales Agent started');
});
