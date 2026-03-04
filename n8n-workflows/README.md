# N8N Workflow Templates

These JSON files are **reference templates**, NOT importable N8N exports.

They document the intended workflow logic so you can rebuild them manually in the N8N editor.

## Why Not Importable?

N8N's export format includes internal IDs, credential references, node version numbers, and a different connection schema. These files use a simplified format with `_comment` and `_note` fields for readability.

## Workflows

### 1. Lead Capture (`lead-capture-workflow.json`)

**Trigger:** POST webhook from backend when AI captures a lead (email/name/company)

**Flow:**
1. Receive webhook → extract lead data
2. **Google Sheets** — Append row to "Leads" tab (Date, Name, Email, Company, Need, Score, Status)
3. **Telegram** — Send notification: "New lead: [name] from [company], needs [role]"
4. **Wait 5 minutes**
5. **Gmail** — Send follow-up email to lead (template in JSON)

### 2. Booking Made (`booking-made-workflow.json`)

**Trigger:** POST webhook from backend when a booking is confirmed (or from Cal.com directly)

**Flow:**
1. Receive webhook → extract booking data
2. **Google Sheets** — Update lead row: Status → "Booked", add Call Date
3. **Telegram** — Send booking notification

### 3. Follow-Up Sequence (`follow-up-sequence-workflow.json`)

**Trigger:** POST webhook from backend when a follow-up is due (fired by server-side interval checker)

**Requires:** `config.followUp.enabled: true` and `webhooks.onFollowUpDue` URL set in config.json

**Flow:**
1. Receive webhook → extract: `email`, `leadData`, `followUpNumber`, `hoursSinceChat`, `bookingLink`
2. **Google Sheets** — Lookup lead by email to check current status
3. **Kill switch** — If Status is "Booked", stop (they already booked)
4. **Route by followUpNumber:**
   - `#1` (24h): Soft touch — "Did you have any more questions?"
   - `#2` (48h): Last touch — "No pressure, here's the booking link"
5. **Google Sheets** — Update "Follow-Up Status" column
6. **Telegram** — Notify team that follow-up was sent

**Webhook payload:**
```json
{
  "conversationId": "abc123",
  "email": "lead@example.com",
  "leadData": { "name": "...", "company": "...", "role_needed": "..." },
  "followUpNumber": 1,
  "hoursSinceChat": 24,
  "bookingLink": "https://cal.com/your-link",
  "timestamp": "2026-03-03T14:00:00Z"
}
```

## Setup Steps

1. **Make N8N accessible from the internet** (so Railway can reach it):
   - Option A: Cloudflare Tunnel (free, recommended)
   - Option B: ngrok
   - Option C: Host N8N on a VPS

2. **Create credentials in N8N:**
   - Google Sheets: OAuth2 or Service Account
   - Telegram: Bot token from @BotFather
   - Gmail: OAuth2 or App Password

3. **Build each workflow in N8N editor** following the flows above

4. **Copy webhook URLs** from N8N into your `config.json`:
   ```json
   "webhooks": {
     "onLeadCaptured": "https://your-n8n.example.com/webhook/lead-captured",
     "onBookingMade": "https://your-n8n.example.com/webhook/booking-made",
     "onConversationEnd": "https://your-n8n.example.com/webhook/conversation-end",
     "onFollowUpDue": "https://your-n8n.example.com/webhook/follow-up-due"
   }
   ```

5. **Test:** Run a conversation through the widget → check Google Sheet + Telegram

## Google Sheet Template

Create a sheet with a "Leads" tab:

| Date | Name | Email | Company | Need | Notes | Conversation ID | Score | Status | Source | Call Date | Follow-Up Status |
|------|------|-------|---------|------|-------|-----------------|-------|--------|--------|-----------|------------------|

Share the sheet with your N8N Google Sheets credential.
