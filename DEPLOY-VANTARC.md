# VantArc AI Sales Agent — Deploy Guide

> **For:** Friedo (VantArc Agency)
> **Prepared by:** Rafael
> **Date:** March 2026

---

## What This Is

An AI-powered chat widget that goes on your website and:
1. Talks to visitors 24/7 (like a consultant, not a bot)
2. Qualifies leads (asks the right questions, scores fit)
3. Shows real calendar availability (Cal.com integration)
4. Books discovery calls automatically
5. Follows up with leads who don't book (24h + 48h emails via N8N)

The AI is configured specifically for VantArc Agency — your services, your tone, your differentiators.

---

## What You Need Before Deploying

| Item | Where to Get It | Time |
|------|----------------|------|
| **Anthropic API Key** | [console.anthropic.com](https://console.anthropic.com) — sign up, add billing, create key | 5 min |
| **Cal.com Account** | [cal.com](https://cal.com) — free tier works. Create an event called "Discovery Call" (30 min) | 10 min |
| **Railway Account** | [railway.com](https://railway.com) — sign up with GitHub. Free tier gives $5/month credit | 2 min |
| **Your website domain** | So we can set CORS (e.g. `https://vantarc.at`) | Already have |

### Optional (for automated lead capture):
| Item | Where to Get It |
|------|----------------|
| N8N instance | Self-host or [n8n.cloud](https://n8n.cloud) |
| Google Sheets | For CRM tracking |
| Telegram Bot | For instant lead alerts |

---

## Step 1: Deploy to Railway (10 minutes)

### 1.1 Install Railway CLI
```bash
# macOS
brew install railway

# Or npm
npm install -g @railway/cli
```

### 1.2 Login
```bash
railway login
```

### 1.3 Create Project
```bash
cd ai-sales-agent   # the folder you received
railway init         # creates new project — name it "vantarc-ai-agent"
```

### 1.4 Set Environment Variables
```bash
# REQUIRED
railway variables set ANTHROPIC_API_KEY=sk-ant-your-key-here
railway variables set NODE_ENV=production
railway variables set ALLOWED_ORIGINS=https://vantarc.at
railway variables set WEBHOOK_SECRET=$(openssl rand -hex 16)
railway variables set CONFIG_PATH=config-vantarc.json

# CAL.COM (for real-time availability)
railway variables set CALCOM_API_KEY=cal_live_your-key
railway variables set CALCOM_EVENT_SLUG=discovery-call
railway variables set CALCOM_USERNAME=vantarc
```

### 1.5 Deploy
```bash
railway up
```

Railway will build the Docker image and deploy it. Takes about 2 minutes.

### 1.6 Get Your URL
```bash
railway domain
```
This gives you something like `vantarc-ai-agent.up.railway.app`. That's your backend URL.

### 1.7 Verify
Open in browser:
```
https://vantarc-ai-agent.up.railway.app/health
```
You should see: `{"status":"ok", "model":"claude-haiku-4-5-20251001", ...}`

---

## Step 2: Set Up Cal.com (5 minutes)

1. Go to [cal.com](https://cal.com) and create account (or login)
2. Create an event type:
   - **Title:** Discovery Call — VantArc
   - **Duration:** 30 minutes
   - **URL slug:** `discovery-call`
3. Set your available hours
4. Get your API key:
   - Go to Settings > Developer > API Keys
   - Create a new key
   - Copy it — that's your `CALCOM_API_KEY`
5. Your username is in your Cal.com profile URL: `cal.com/YOUR_USERNAME`

---

## Step 3: Embed on Your Website (2 minutes)

Add these 2 lines before `</body>` on any page:

```html
<script>
  window.SA_CONFIG = { backendUrl: 'https://vantarc-ai-agent.up.railway.app' };
</script>
<script src="https://vantarc-ai-agent.up.railway.app/widget/embed.js" async></script>
```

Replace `vantarc-ai-agent.up.railway.app` with your actual Railway domain.

### Platform-specific:

**WordPress:**
- Appearance > Theme Editor > footer.php — paste before `</body>`
- Or use "Insert Headers and Footers" plugin

**Wix:**
- Settings > Custom Code > Add Code > Body End

**Webflow:**
- Project Settings > Custom Code > Footer Code

**Plain HTML:**
- Paste before `</body>` in your HTML file

---

## Step 4: Test It

1. Open your website
2. Wait 3 seconds — the chat bubble appears (bottom-right)
3. Click it — you should see: "Hey! Looking for marketing support or help developing your creative project?"
4. Have a test conversation — pretend you're an artist looking for branding help
5. The AI should:
   - Ask discovery questions (what do you do, what do you need, budget, timeline)
   - Recommend the most relevant VantArc service
   - Handle objections naturally
   - Offer to book a discovery call
   - Capture lead data (name, email, company)

---

## Step 5: N8N Webhooks (Optional — for lead alerts)

If you want instant Telegram/Email notifications when leads come in:

1. Set up N8N (self-hosted or n8n.cloud)
2. Build 3 workflows following the templates in `n8n-workflows/README.md`:
   - Lead capture → Google Sheets + Telegram + Email
   - Booking made → Update sheet + notify
   - Follow-up sequence → 24h/48h re-engagement emails
3. Copy the webhook URLs into Railway:
```bash
railway variables set WEBHOOK_LEAD=https://your-n8n/webhook/lead-captured
railway variables set WEBHOOK_BOOKING=https://your-n8n/webhook/booking-made
railway variables set WEBHOOK_FOLLOWUP=https://your-n8n/webhook/follow-up-due
```
4. Update `config-vantarc.json` webhooks section with the URLs and redeploy

---

## Costs

| Service | Cost |
|---------|------|
| **Claude Haiku API** | ~$0.02-0.05 per full conversation (very cheap) |
| **Railway hosting** | $5/month (Hobby plan) or free tier |
| **Cal.com** | Free tier works |
| **Total** | ~$5-10/month for light usage |

At 100 conversations/month, expect ~$7-10/month total.

---

## File Structure

```
ai-sales-agent/
├── backend/
│   ├── server.js                    # Main server
│   ├── config-vantarc.json          # YOUR config (VantArc-specific)
│   ├── conversation-engine.js       # AI sales flow
│   ├── db.js                        # SQLite database
│   ├── .env.example                 # Environment variable template
│   └── ...
├── widget/
│   ├── chat-widget.html             # The chat UI
│   └── embed.js                     # 2-line embed loader
├── n8n-workflows/                   # N8N reference templates
├── docs/                            # Setup guides
├── Dockerfile                       # Docker build
└── railway.toml                     # Railway config
```

---

## Customizing

### Change the greeting
Edit `config-vantarc.json` > `widget.greeting`

### Change colors
Edit `config-vantarc.json` > `widget.primaryColor` and `widget.accentColor`

### Change services/pricing
Edit `config-vantarc.json` > `company.services`

### Add German language
Change `config-vantarc.json` > `company.language` from `"en"` to `"de"`

After any config change: `railway up` to redeploy.

---

## Monitoring

- **Health check:** `https://YOUR-DOMAIN.up.railway.app/health`
- **Railway dashboard:** See logs, CPU, memory at [railway.com/dashboard](https://railway.com/dashboard)
- **Conversation data:** Stored in SQLite on Railway (auto-cleaned after 48h)

---

## Support

Questions? Contact Rafael.
