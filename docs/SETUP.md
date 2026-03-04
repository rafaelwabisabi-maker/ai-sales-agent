# AI Sales Agent — Setup Guide

## Quick Start (Local Dev)

```bash
cd ai-sales-agent/backend
cp .env.example .env        # Add your ANTHROPIC_API_KEY
cp config-example.json config.json  # Customize for your company
npm install
npm run dev                  # Runs on http://localhost:3001
```

Then open `widget/chat-widget.html` in a browser to test.

## Deploy to Railway (Recommended)

1. Push to GitHub
2. Go to railway.app → New Project → Deploy from GitHub
3. Set environment variables:
   - `ANTHROPIC_API_KEY` = your key
   - `PORT` = 3001
   - `ALLOWED_ORIGINS` = https://yoursite.com
4. Upload `config.json` via Railway's file mount or include in env as `CONFIG_JSON`
5. Railway gives you a URL like `https://ai-sales-agent-xxx.railway.app`

## Embed on Any Website

Add to the `<body>` of any page:

```html
<script>
  window.SA_CONFIG = {
    apiUrl: 'https://ai-sales-agent-xxx.railway.app',
    companyName: 'Your Company',
    primaryColor: '#2563eb'
  };
</script>
<script src="https://ai-sales-agent-xxx.railway.app/widget/embed.js" defer></script>
```

## Set Up Cal.com

1. Create account at cal.com
2. Create an event type (e.g., "Discovery Call", 30 min)
3. Copy the booking link
4. Add to `config.json` → `booking.link`

## Set Up N8N Automation

1. Install N8N (Docker or n8n.cloud)
2. Import workflows from `n8n-workflows/` folder
3. Configure:
   - Google Sheets credentials
   - Gmail credentials (for follow-up emails)
   - Telegram Bot token + chat ID
4. Activate workflows
5. Copy webhook URLs → paste into `config.json` → `webhooks`

## Set Up Google Sheet (CRM)

Create a Google Sheet with these columns in a "Leads" tab:

| Date | Name | Email | Company | Role Needed | Notes | Conversation ID | Status | Source | Call Date |
|------|------|-------|---------|-------------|-------|-----------------|--------|--------|-----------|

Share it with your N8N Google Sheets service account.

## White-Label for Clients

Each client gets their own `config.json` with:
- Their company info, services, differentiators
- Their brand colors
- Their Cal.com link
- Their Google Sheet ID
- Their N8N webhook URLs

Deploy a separate Railway instance per client, or use multi-tenant routing (v2).

## Cost Estimate (per client)

| Item | Cost/month |
|------|-----------|
| Railway hosting | $5 |
| Claude API (Sonnet, ~500 convos/mo) | $15-30 |
| Cal.com | Free tier |
| N8N Cloud | $20 (or self-host free) |
| Google Sheets | Free |
| **Total** | **$40-55/month** |

Sell at $297-497/month. Margin: 85-90%.
