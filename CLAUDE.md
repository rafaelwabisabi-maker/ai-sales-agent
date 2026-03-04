# AI Sales Agent

Embeddable AI sales chat widget that qualifies leads, pitches services, handles objections, and books discovery calls — fully automated. White-label per client.

## Status (Feb 2026)

| Area | Status | Detail |
|------|--------|--------|
| Chat widget | ✅ Built | Vanilla JS, iframe-isolated, responsive, mobile-ready |
| AI conversation | ✅ Built | Claude Haiku, 7-phase sales flow, action system |
| Persistence | ✅ Built | SQLite (better-sqlite3, WAL mode), localStorage recovery |
| Security | ✅ Built | Rate limiting, helmet, input validation, cost cap |
| Webhooks | ✅ Built | Exponential backoff retry, fire-and-forget, DB logging |
| Logging | ✅ Built | Pino structured JSON, token cost tracking per message |
| Docker + deploy | ✅ Ready | Dockerfile + railway.toml, not yet deployed |
| N8N automation | ❌ Pending | Reference templates exist, need manual N8N setup |
| Google Sheet CRM | ❌ Pending | Part of N8N setup (Phase 6) |
| Telegram alerts | ❌ Pending | Part of N8N setup (Phase 6) |
| Email follow-up | ❌ Pending | Part of N8N setup (Phase 6) |
| Client config template | ✅ Ready | config-CLIENT-TEMPLATE.json mapped to questionnaire |
| Client delivery checklist | ✅ Ready | docs/CLIENT-DELIVERY-CHECKLIST.md (8-phase process) |
| Test scenarios | ✅ Ready | docs/TEST-CONVERSATIONS.md (6 QA scenarios) |
| Client acquisition workflow | ✅ Ready | CLIENT-ACQUISITION-WORKFLOW.md (pricing, ICP, funnel) |
| Live client config | ❌ Pending | Blocked on client materials (Phase 8) |

## Stack

- **Backend:** Node.js (Express) — `backend/server.js`
- **AI Model:** Claude Haiku 4.5 (configurable via `config.model`) — NOT Sonnet
- **Widget:** Vanilla HTML/CSS/JS — NOT React. Iframe-isolated via `embed.js`
- **Database:** SQLite via better-sqlite3 (WAL mode, 3 tables)
- **Booking:** Cal.com link (opens in new tab) — NOT embedded API
- **CRM:** Google Sheets via N8N webhook (not built yet)
- **Automation:** N8N (webhooks → Sheet + Telegram + Email)
- **Hosting:** Railway (Docker) — not yet deployed
- **Logging:** Pino (JSON in prod, pretty-print in dev)
- **Security:** helmet, express-rate-limit, UUID validation

## Architecture

```
[Client Website]
    ↓ embed.js (2-line script)
[iframe: chat-widget.html]
    ↓ REST API
[Express Backend (server.js)]
    ↓                ↓
[Claude Haiku]   [SQLite DB]
    ↓
[Webhook system (webhooks.js)]
    ↓         ↓         ↓
[N8N: Sheets] [Telegram] [Email]
```

## File Map

```
ai-sales-agent/
├── backend/
│   ├── server.js              # Express server, all endpoints, rate limiting, cost cap
│   ├── conversation-engine.js # System prompt builder, action parser, phase constants
│   ├── db.js                  # SQLite persistence (3 tables, WAL, prepared statements)
│   ├── logger.js              # Pino structured logging
│   ├── webhooks.js            # Webhook fire + retry (3 attempts, exponential backoff)
│   ├── config.json            # Active config (gitignored) — copy from config-example.json
│   ├── config-example.json    # Template config with all fields documented
│   ├── config-CLIENT-TEMPLATE.json  # Blank template mapped to onboarding questionnaire
│   ├── package.json           # Dependencies: express, better-sqlite3, pino, helmet, etc.
│   ├── .env                   # Environment vars (gitignored) — copy from .env.example
│   ├── .env.example           # All env vars documented
│   └── data/                  # SQLite DB files (gitignored, auto-created)
├── widget/
│   ├── chat-widget.html       # Full chat UI (HTML + CSS + JS, single file)
│   └── embed.js               # 2-line embed loader, iframe creator, size toggle
├── docs/
│   ├── CLIENT-ONBOARDING.md   # 14-question client questionnaire
│   ├── CLIENT-DELIVERY-CHECKLIST.md  # Step-by-step delivery process (8 phases)
│   ├── TEST-CONVERSATIONS.md  # 6 QA scenarios + pass criteria
│   ├── EMBED-GUIDE.md         # Widget install guide (WordPress, Wix, Webflow, etc.)
│   ├── PRODUCT-OFFER.md       # Pricing tiers, sales pitch, objection handling
│   └── SETUP.md               # Quick start + Railway deploy + N8N + Cal.com
├── n8n-workflows/             # Reference templates (NOT importable — see README)
│   ├── README.md              # Explains these are reference, not N8N exports
│   ├── lead-capture-workflow.json
│   └── booking-made-workflow.json
├── CLIENT-ACQUISITION-WORKFLOW.md # Full acquisition funnel: pricing, ICP, onboarding, N8N setup
├── config-template-artist.json # Pre-built artist/musician vertical template
├── Dockerfile                 # Production container (node:20, healthcheck)
├── railway.toml               # Railway deploy config
├── .dockerignore              # Build exclusions
├── .gitignore                 # Git exclusions (data/, .env, etc.)
└── CLAUDE.md                  # This file — project source of truth
```

## API Endpoints

| Method | Path | Purpose | Rate Limit |
|--------|------|---------|------------|
| GET | `/health` | Health check + stats (conversations, webhooks, uptime, model) | Global 100/15min |
| GET | `/api/config` | Public widget config (company, widget, booking — no secrets) | Global |
| POST | `/api/conversations` | Start new conversation → returns greeting | 5/hour per IP |
| GET | `/api/conversations/:id/exists` | Check if conversation still exists (widget reconnection) | Global |
| GET | `/api/conversations/:id` | Get conversation with all messages | Global |
| POST | `/api/conversations/:id/messages` | Send user message → returns AI response + actions | 30/15min per IP |

## Conversation Flow

7 phases: `GREETING → DISCOVERY → PITCH → OBJECTION → CLOSE → BOOKING → ENDED`

The AI (via `conversation-engine.js buildSystemPrompt()`) manages the sales flow. It uses inline `\`\`\`action` JSON blocks to trigger:
- `CAPTURE_LEAD` — saves email/name/company to DB + fires `onLeadCaptured` webhook
- `BOOK_CALL` — shows booking card in widget with Cal.com link
- `END_CONVERSATION` — ends chat + fires `onConversationEnd` webhook

## Configuration

Each client gets a `config.json` (copy from `config-example.json`):
- `company` — name, tagline, services, differentiators, target market
- `widget` — colors, position, greeting, trigger delay
- `booking` — Cal.com link, duration, title
- `qualification` — min score, weighted criteria
- `model` — Claude model ID (default: `claude-haiku-4-5-20250929`)
- `limits` — maxMessages (default: 30), maxTokens (default: 500)
- `webhooks` — onLeadCaptured, onBookingMade, onConversationEnd URLs

## Environment Variables

See `backend/.env.example`:
- `ANTHROPIC_API_KEY` — required
- `PORT` — default 3001
- `NODE_ENV` — development/production
- `ALLOWED_ORIGINS` — comma-separated CORS origins
- `WEBHOOK_SECRET` — sent as X-Webhook-Secret header
- `LOG_LEVEL` — debug/info/warn/error
- `DB_PATH` — SQLite file path (default: ./data/sales-agent.db)

## Key Design Decisions

1. **Haiku not Sonnet** — 3x cheaper ($1/$5 vs $3/$15 per million tokens). Fast enough for chat. Configurable per client if needed.
2. **Vanilla JS not React** — Widget is a single HTML file. No build step, no framework deps. Loads fast, embeds anywhere.
3. **SQLite not Postgres** — Zero config, file-based, WAL mode for concurrent reads. Good enough for single-server deploy. Switch to Postgres if needed (db.js abstracts it).
4. **iframe isolation** — Widget styles don't conflict with host site CSS. Config passed via postMessage.
5. **Fire-and-forget webhooks** — Never block the user's chat response. Retry in background.
6. **Cost cap** — Hard limit on messages per conversation (default 30). Prevents runaway API costs.

## What's NOT Built Yet (Next Sessions)

### Phase 6: N8N + Sheet + Telegram + Email
- N8N must be reachable from Railway (Cloudflare Tunnel recommended)
- Build 3 workflows manually in N8N (reference JSONs exist but aren't importable)
- Set up: Google Sheets OAuth, Telegram bot, Gmail credentials
- Wire webhook URLs into config.json

### Phase 8: Client Delivery (blocked on client materials)
- Fill config.json from client answers (via CLIENT-ONBOARDING.md questionnaire)
- 10-15 test conversations to tune prompts
- Set up Cal.com event
- Embed on client website
- Full end-to-end test on production

## Dual Purpose

1. **Service**: Sell to clients via friend's agency ($500 setup + recurring)
2. **Product**: Use internally for AnimaRH / other projects

## Plan File

Full roadmap + session reports: `~/.claude/plans/keen-marinating-squid.md`
