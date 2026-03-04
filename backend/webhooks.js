/**
 * Webhook System with Retry Logic
 *
 * Features:
 * - Exponential backoff: 1s, 4s, 16s (3 attempts max)
 * - Every attempt logged to webhook_log table
 * - Never blocks the user's chat response
 * - Periodic retry of failed webhooks (called from server)
 * - Webhook secret header for authentication
 */

'use strict';

const db = require('./db');
const logger = require('./logger');

const MAX_ATTEMPTS = 3;
const BACKOFF_BASE_MS = 1000; // 1s, 4s, 16s

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Fire a webhook with retry logic.
 * Returns immediately — retries happen in background.
 * Never throws — failures are logged, not propagated.
 */
async function fireWebhook(event, payload, conversationId, webhookConfig) {
  const url = webhookConfig?.[event];
  if (!url) return;

  const secret = process.env.WEBHOOK_SECRET || '';

  // Log the initial attempt
  const logId = db.logWebhook(conversationId, event, payload, 'pending', null, 0);

  // Fire-and-forget with retry
  _fireWithRetry(url, event, payload, secret, conversationId, logId, 1).catch(() => {});
}

async function _fireWithRetry(url, event, payload, secret, conversationId, logId, attempt) {
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Webhook-Secret': secret
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(10000) // 10s timeout per attempt
    });

    if (response.ok) {
      db.updateWebhookStatus(logId, 'sent', null, attempt);
      logger.info({ conversationId, event, attempt }, 'Webhook sent');
      return;
    }

    const errorMsg = `HTTP ${response.status}`;
    logger.warn({ conversationId, event, attempt, status: response.status }, 'Webhook HTTP error');

    if (attempt >= MAX_ATTEMPTS) {
      db.updateWebhookStatus(logId, 'failed', errorMsg, attempt);
      logger.error({ conversationId, event, attempts: attempt }, 'Webhook permanently failed');
      return;
    }

    // Retry with exponential backoff
    db.updateWebhookStatus(logId, 'retrying', errorMsg, attempt);
    const delayMs = BACKOFF_BASE_MS * Math.pow(4, attempt - 1); // 1s, 4s, 16s
    await sleep(delayMs);
    return _fireWithRetry(url, event, payload, secret, conversationId, logId, attempt + 1);

  } catch (error) {
    const errorMsg = error.message || 'Unknown error';
    logger.warn({ conversationId, event, attempt, err: errorMsg }, 'Webhook network error');

    if (attempt >= MAX_ATTEMPTS) {
      db.updateWebhookStatus(logId, 'failed', errorMsg, attempt);
      logger.error({ conversationId, event, attempts: attempt }, 'Webhook permanently failed');
      return;
    }

    db.updateWebhookStatus(logId, 'retrying', errorMsg, attempt);
    const delayMs = BACKOFF_BASE_MS * Math.pow(4, attempt - 1);
    await sleep(delayMs);
    return _fireWithRetry(url, event, payload, secret, conversationId, logId, attempt + 1);
  }
}

/**
 * Retry all failed webhooks (called periodically).
 * Picks up webhooks that exhausted retries and tries once more.
 */
async function retryFailedWebhooks(webhookConfig) {
  const failed = db.getFailedWebhooks();
  if (failed.length === 0) return 0;

  const secret = process.env.WEBHOOK_SECRET || '';
  let retried = 0;

  for (const wh of failed) {
    const url = webhookConfig?.[wh.event];
    if (!url) continue;

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Webhook-Secret': secret
        },
        body: JSON.stringify(wh.payload),
        signal: AbortSignal.timeout(10000)
      });

      if (response.ok) {
        db.updateWebhookStatus(wh.id, 'sent', null, wh.attempts + 1);
        logger.info({ webhookId: wh.id, event: wh.event }, 'Failed webhook retried successfully');
      } else {
        db.updateWebhookStatus(wh.id, 'failed', `HTTP ${response.status}`, wh.attempts + 1);
      }
    } catch (error) {
      db.updateWebhookStatus(wh.id, 'failed', error.message, wh.attempts + 1);
    }
    retried++;
  }

  if (retried > 0) {
    logger.info({ retried }, 'Retried failed webhooks');
  }
  return retried;
}

module.exports = { fireWebhook, retryFailedWebhooks };
