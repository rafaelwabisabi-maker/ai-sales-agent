# Client Acquisition & Delivery Workflow — AI Sales Agent
> **Version:** 1.0 | **Created:** 2026-02-23
> **Based on:** OUTREACH-SALES-WORKFLOW-TEMPLATE.md (Semeadora universal template)
> **Product:** Embeddable AI sales chat widget (Claude Haiku + Node.js + SQLite)
> **Dual purpose:** (1) Service sold to clients, (2) Internal tool for AnimaRH/NP/WW

---

## Product Overview

| Feature | What |
|---------|------|
| Chat Widget | Vanilla JS, iframe-isolated, 2-line embed |
| AI Engine | Claude Haiku 4.5, 7-phase sales flow |
| Lead Capture | Webhooks → N8N → Google Sheets + Telegram + Email |
| Booking | Cal.com integration (opens in new tab) |
| Analytics | Conversation logs, lead quality score, phase tracking |
| Deploy | Docker + Railway, self-hosted option |

---

## Pricing Model

| Package | Setup Fee | Monthly | Includes | Target |
|---------|-----------|---------|----------|--------|
| **Starter** | $500 | $297/mo | Widget + 500 conversations/mo + basic webhook + Cal.com | Solo/SMB with website |
| **Professional** | $1,000 | $497/mo | Widget + 2K conv/mo + Sheets CRM + Telegram alerts + n8n automations | Growing companies |
| **Enterprise** | $2,500 | $997/mo | Unlimited + custom AI training + multi-language + dedicated support | Large operations |
| **AnimaRH Add-on** | Included | +$97/mo | Widget for client career pages | AnimaRH recruitment clients |

**Internal use (zero cost):**
- AnimaRH career page → lead qual for candidates
- Naturprogramme landing → school inquiry qualification
- Wandel Weise → healing session booking

---

## ICP — Ideal Client Profile

### Tier 1 — Quick Wins
| Criteria | Value |
|----------|-------|
| Business | Service-based (consulting, coaching, agency, clinic) |
| Website | Has website with traffic but no chat/booking |
| Pain | "I get inquiries but can't respond fast enough" / "leads go cold" |
| Budget | $500-1,000 setup is nothing vs lost leads |
| Tech | Can paste 2 lines of HTML (or has a webmaster) |

### Tier 2 — Strategic
| Criteria | Value |
|----------|-------|
| Business | SaaS, e-commerce, real estate |
| Need | Lead qualification at scale |
| Volume | 1K+ website visitors/month |
| Budget | $1,000+ setup, $497+/month |

### Tier 3 — AnimaRH Client Upsell
- Every AnimaRH recruitment client with a career page
- Embed widget on their careers page → qualify candidates → feed into AnimaRH pipeline
- Zero acquisition cost (existing relationship)

---

## Acquisition Funnel (7 Steps)

### Step 0: Weekly Review (10 min)
- Check demo requests (if website live)
- Check AnimaRH client list for upsell opportunities
- Check NP/WW internal deployment status

### Step 1: Lead Generation

**Sources:**
| Source | How | Expected Volume |
|--------|-----|----------------|
| AnimaRH clients | Upsell during client meetings | 1-2/month |
| LinkedIn content | Posts about "AI sales qualification" | 2-3 inquiries/month |
| Product demo page | Self-service demo on website | When deployed |
| Referrals | "Know a business that needs this?" | After each install |
| NP/WW showcase | "This is what powers our booking" | Organic |
| Cold outreach | Target agencies/consultancies | 5/week |

### Step 2: Demo + Qualification

**Demo flow (15 min):**
1. Show live widget on demo page (2 min)
2. Walk through conversation as a visitor (5 min)
3. Show admin view: lead capture, webhooks, analytics (3 min)
4. Show embed process: "Just paste 2 lines" (2 min)
5. Answer questions + pricing (3 min)

**Qualification questions:**
- "How many inquiries do you get per month?"
- "How fast do you respond right now?"
- "What happens to leads that don't get a response?"
- "Do you have a booking/scheduling tool?"

### Step 3: Onboarding (post-sale)

**Client Onboarding SOP (based on docs/CLIENT-ONBOARDING.md):**

| Day | Step | Responsible |
|-----|------|------------|
| 0 | Client fills 14-question questionnaire | Client |
| 1 | Build config.json from questionnaire answers | Us |
| 2 | Deploy instance (Docker/Railway) | Us |
| 2 | Run 5 test conversations internally | Us |
| 3 | Client review: test widget on staging | Client |
| 4 | Embed on production site | Client (with our guide) |
| 5 | N8N webhooks live (Sheets + Telegram + Email) | Us |
| 7 | 1-week check-in: review first real conversations | Both |
| 30 | 1-month review: conversion metrics, AI tuning | Both |

### Step 4: N8N Setup SOP (for each client)

**Per-client N8N workflow setup:**
1. Create Google Sheet: `[Client] - AI Sales Leads`
   - Columns: Date, Name, Email, Phone, Conversation_ID, Lead_Score, Source
2. Create Telegram channel (or use existing)
3. Build N8N workflow:
   - Webhook trigger (from AI widget)
   - Parse lead data
   - Write to Google Sheet
   - Send Telegram alert
   - Send email notification to client
4. Test with sample webhook payload
5. Activate and monitor

**Webhook payload (from widget):**
```json
{
  "event": "lead_captured",
  "conversation_id": "abc123",
  "lead": {
    "name": "João Silva",
    "email": "joao@empresa.com",
    "phone": "+55...",
    "interest": "consulting services",
    "score": 85
  },
  "metadata": {
    "client_id": "client_xyz",
    "widget_version": "1.0",
    "timestamp": "2026-02-23T14:00:00Z"
  }
}
```

### Step 5: Client Success Monitoring

**KPIs per client (monthly report):**
| Metric | Target | Formula |
|--------|--------|---------|
| Conversations started | varies | Count(new conversations) |
| Lead capture rate | >40% | Leads captured / Conversations |
| Booking rate | >15% | Bookings / Conversations |
| Avg conversation length | 4-8 messages | Avg(messages per conversation) |
| AI cost per lead | <$0.50 | Total Haiku cost / Leads |
| Response quality | >4/5 | Manual review score |

### Step 6: Renewal + Upsell

| When | Action |
|------|--------|
| Monthly | Send KPI report to client |
| Month 3 | Offer AI training update (new FAQ, new products) |
| Month 6 | Upsell: add second widget (different page/language) |
| Month 12 | Annual review + pricing adjustment |

### Step 7: Internal Deployment Checklist

**For AnimaRH, NP, WW — use widget internally:**

| Project | Page | AI Persona | Goal |
|---------|------|-----------|------|
| AnimaRH | Career page | "Recrutador Digital AnimaRH" | Qualify candidates before human contact |
| Naturprogramme | school-landing.html | "Elisabeth's Nature Guide" | Qualify school inquiries → book discovery call |
| Wandel Weise | wandel-weise.at | "Healing Journey Guide" | Qualify clients → book session |
| KRAFTWERK | pitch app | "KRAFTWERK Concierge" | Answer investor questions → book meeting |

---

## Deploy Checklist

- [ ] Deploy to Railway (Docker ready)
- [ ] Set up demo page with live widget
- [ ] Create CLIENTS_CRM with first 3 internal deploys
- [ ] Build N8N workflow template (importable, not just reference)
- [ ] Create pricing page / one-pager
- [ ] Integrate `/aisales` command in bot.py
- [ ] Embed on NP school-landing.html (first internal deploy)
