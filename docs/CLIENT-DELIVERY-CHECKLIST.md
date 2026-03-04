# Client Delivery Checklist

> Step-by-step checklist for delivering the AI Sales Agent to a new client.
> **Source:** CLIENT-ACQUISITION-WORKFLOW.md Step 3 (Onboarding) + Step 4 (N8N Setup)
> **Timeline:** 3-5 business days from receiving questionnaire answers to live widget.

---

## Phase 1: Intake (Day 0)

- [ ] Client fills CLIENT-ONBOARDING.md questionnaire (14 questions)
- [ ] Received: company info, services, pricing, differentiators
- [ ] Received: objection handling responses (5 scenarios)
- [ ] Received: FAQ (10-20 questions + answers)
- [ ] Received: brand colors (primary + accent hex codes)
- [ ] Received: Cal.com booking link
- [ ] Received: notification preference (Telegram / Email / Both)
- [ ] Received: website platform info (WordPress / Wix / Webflow / other)

---

## Phase 2: Configuration (Day 1)

### Config File
- [ ] Copy `config-CLIENT-TEMPLATE.json` → `config.json`
- [ ] Fill company section from questionnaire answers
- [ ] Fill services array (name, description, priceRange, idealFor per service)
- [ ] Fill differentiators (3-5 items)
- [ ] Fill widget section (colors, greeting, position)
- [ ] Fill booking section (Cal.com link, duration, title)
- [ ] Fill qualification criteria (adapt weights to client's sales process)
- [ ] Fill objectionHandling section (5 responses from questionnaire)
- [ ] Fill faq array (questions + answers)
- [ ] Fill boundaries section (what NOT to do/offer/answer)
- [ ] Set language (pt-BR / en / es / de)

### Environment
- [ ] Set ANTHROPIC_API_KEY
- [ ] Set ALLOWED_ORIGINS (client's website domain)
- [ ] Set WEBHOOK_SECRET (generate unique per client)
- [ ] Set NODE_ENV=production

---

## Phase 3: Deploy (Day 2)

### Railway Deployment
- [ ] Create new Railway project for this client
- [ ] Connect GitHub repo (or deploy Docker image)
- [ ] Set environment variables (from Phase 2)
- [ ] Upload config.json (Railway file mount or env var)
- [ ] Verify deploy succeeds (check Railway logs)
- [ ] Test health endpoint: `GET https://[client-app].railway.app/health`
- [ ] Note the production URL: `https://_________________.railway.app`

### Verify Core Functions
- [ ] Start a test conversation via API or widget
- [ ] Confirm AI responds with correct company name + services
- [ ] Confirm booking card shows correct Cal.com link
- [ ] Confirm rate limiting works
- [ ] Check SQLite DB created in data/ directory

---

## Phase 4: N8N Setup (Day 2-3)

### Google Sheet
- [ ] Create Google Sheet: `[Client Name] - AI Sales Leads`
- [ ] Add "Leads" tab with columns: Date | Name | Email | Company | Need | Notes | Conversation ID | Score | Status | Source | Call Date
- [ ] Share with N8N service account

### N8N Workflows
- [ ] Build Lead Capture workflow (reference: n8n-workflows/lead-capture-workflow.json)
  - [ ] Webhook trigger → Google Sheets append → Telegram notification → 5min wait → Gmail follow-up
- [ ] Build Booking Made workflow (reference: n8n-workflows/booking-made-workflow.json)
  - [ ] Webhook trigger → Google Sheet update → Telegram notification
- [ ] Activate both workflows
- [ ] Copy webhook URLs into client's config.json → webhooks section
- [ ] Redeploy with updated config.json

### Verify N8N
- [ ] Trigger test lead capture → check Google Sheet row added
- [ ] Trigger test lead capture → check Telegram notification received
- [ ] Trigger test booking → check Google Sheet updated
- [ ] Trigger test booking → check Telegram notification received
- [ ] Test webhook retry (temporarily break URL, restore, verify retry works)

---

## Phase 5: Testing (Day 3-4)

### Internal Testing
- [ ] Run all 6 scenarios from TEST-CONVERSATIONS.md
- [ ] Minimum 10 total test conversations
- [ ] All webhooks firing correctly
- [ ] Google Sheet populating correctly
- [ ] Telegram notifications arriving
- [ ] No errors in server logs

### Client Review
- [ ] Share 3-5 conversation transcripts with client
- [ ] Client approves: tone, accuracy, service descriptions
- [ ] Client approves: objection handling responses
- [ ] Client approves: booking flow
- [ ] Iterate if needed (adjust config.json → redeploy → retest)

---

## Phase 6: Go Live (Day 4-5)

### Embed on Client Website
- [ ] Share EMBED-GUIDE.md with client (or their webmaster)
- [ ] Embed code:
  ```html
  <script>window.SA_CONFIG={apiUrl:"https://[CLIENT-APP].railway.app"};</script>
  <script src="https://[CLIENT-APP].railway.app/widget/embed.js" defer></script>
  ```
- [ ] Client adds to staging first → verify appearance
- [ ] Client adds to production → verify live
- [ ] Test on desktop + mobile

### Final Verification
- [ ] Widget appears on client's live website
- [ ] Conversation works end-to-end on production
- [ ] Lead captured → Google Sheet row → Telegram alert
- [ ] Booking card → Cal.com link works
- [ ] No CORS errors (check browser console)

---

## Phase 7: Handoff (Day 5)

### Client Deliverables
- [ ] Access to Google Sheet (shared with client's email)
- [ ] Telegram group with notifications (client added)
- [ ] EMBED-GUIDE.md sent (for future pages)
- [ ] Support contact (email/WhatsApp for issues)

### Internal Records
- [ ] Update CLIENTS_CRM with:
  - Status: Ativo
  - Deploy_URL: Railway URL
  - Google_Sheet_ID: Sheet URL
  - Webhook_URLs: N8N endpoints
  - Go_Live_Date: today
- [ ] First invoice sent (setup fee)
- [ ] Recurring billing set up (monthly fee)

---

## Phase 8: Post-Launch (Week 1-4)

| Day | Action |
|-----|--------|
| +1 | Check server logs for errors |
| +3 | Review first 5 real conversations |
| +7 | 1-week check-in with client: first impressions, any issues |
| +7 | Review KPIs: conversations started, lead capture rate, booking rate |
| +14 | Tune AI if needed (adjust config, retrain on new objections) |
| +30 | 1-month review: full metrics report, conversion analysis |
| +30 | Send KPI report to client |
| +30 | Discuss: what's working, what needs adjustment |

---

## Emergency Procedures

### Widget Not Working
1. Check Railway status → is app running?
2. Check health endpoint → `GET /health`
3. Check ALLOWED_ORIGINS → does it include client's domain?
4. Check browser console → CORS errors?

### AI Giving Wrong Answers
1. Review conversation in SQLite DB
2. Check config.json → services/differentiators/FAQ correct?
3. Adjust config.json → redeploy
4. If persistent → review conversation-engine.js system prompt

### Webhooks Not Firing
1. Check server logs → any webhook errors?
2. Check N8N → is workflow active?
3. Check webhook_log table in SQLite → any failed attempts?
4. Test webhook URL directly with curl
5. Check WEBHOOK_SECRET matches between server and N8N
