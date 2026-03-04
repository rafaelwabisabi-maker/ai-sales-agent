# Test Conversation Scenarios

> Run these 6 scenarios before going live with any client. Each tests a different path through the 7-phase sales flow.
> **Expected:** 10-15 test conversations total (mix of these scenarios + variations).

---

## Scenario 1: Happy Path (Full Funnel)

**Goal:** Lead arrives → qualifies → gets pitched → books call
**Persona:** Ideal client, budget-ready, decision maker

**Messages to send:**
1. "Hi, I'm looking for help with [client's service area]"
2. "We're a [matching ICP description] company"
3. "Yes, we have budget set aside for this"
4. "That sounds good, what's the process?"
5. "Sure, I'd love to book a call"

**Check:**
- [ ] Bot greets naturally, asks discovery questions
- [ ] Bot identifies need and matches to a service
- [ ] Bot pitches relevant service with differentiators
- [ ] Bot presents booking option
- [ ] Booking card appears with Cal.com link
- [ ] Webhook fires: `onLeadCaptured` (check server logs)
- [ ] Webhook fires: `onConversationEnd` (check server logs)

---

## Scenario 2: Price Objection

**Goal:** Test objection handling for "too expensive"
**Persona:** Interested but price-sensitive

**Messages to send:**
1. "Hi, I need [service]"
2. "We're a small team, about 10 people"
3. "That sounds interesting but honestly way too expensive for us"
4. "I just can't justify that spend right now"

**Check:**
- [ ] Bot handles objection using config.objectionHandling.tooExpensive
- [ ] Bot reframes value (not just repeats price)
- [ ] Bot offers alternative (smaller package, trial) if available
- [ ] Bot doesn't get defensive or pushy
- [ ] If prospect remains uninterested, bot gracefully ends

---

## Scenario 3: "Not Now" / Timing Objection

**Goal:** Test the "interested but not ready" path
**Persona:** Good fit but wrong timing

**Messages to send:**
1. "We're looking into [service] for next quarter"
2. "Right now we're focused on other priorities"
3. "Maybe in 3-6 months"

**Check:**
- [ ] Bot acknowledges timing respectfully
- [ ] Bot still captures lead info (email at minimum)
- [ ] Bot suggests booking a future touchpoint
- [ ] No pushy follow-up

---

## Scenario 4: Wrong Fit (Boundary Test)

**Goal:** Test that bot respects boundaries from config.boundaries
**Persona:** Asks for services the client doesn't offer

**Messages to send:**
1. "Do you offer [service NOT in config]?"
2. "What about [client type NOT served]?"
3. "Can you help with [question bot should NOT answer]?"

**Check:**
- [ ] Bot politely says "we don't offer that"
- [ ] Bot redirects to what IS offered
- [ ] Bot doesn't make up services or prices
- [ ] Bot stays helpful, not dismissive

---

## Scenario 5: Rapid Qualifier (Quick Lead)

**Goal:** Test lead capture when prospect gives info fast
**Persona:** Knows exactly what they want, gives email quickly

**Messages to send:**
1. "Hi, I need [specific service] ASAP. My email is prospect@company.com"
2. "Yes, budget is fine. When can we start?"

**Check:**
- [ ] Bot captures email immediately via CAPTURE_LEAD action
- [ ] Bot doesn't force through all discovery phases
- [ ] Bot adapts pace to prospect's urgency
- [ ] Booking offered promptly
- [ ] Webhook fires with lead data including email

---

## Scenario 6: Stress Test (Edge Cases)

**Goal:** Test robustness against unusual inputs
**Messages to send:**
1. Very long message (500+ characters)
2. "asdfghjkl" (gibberish)
3. Empty-looking message: "..."
4. Rude/hostile: "this is a scam"
5. Competitor mention: "why should I use you instead of [competitor]?"
6. Off-topic: "what's the weather like?"

**Check:**
- [ ] Bot handles each gracefully
- [ ] No error messages shown to user
- [ ] Bot redirects to conversation goal
- [ ] Rate limiting kicks in if messages too fast
- [ ] No crashes or hung states

---

## QA Checklist (After All Scenarios)

### Widget UI
- [ ] Trigger button appears after delay (default 3s)
- [ ] Chat opens on click
- [ ] Close button works
- [ ] Messages scroll properly
- [ ] Mobile responsive (test at 375px width)
- [ ] Brand colors match config

### Backend
- [ ] Health endpoint returns OK: `GET /health`
- [ ] Conversations persist across page reload (localStorage ID)
- [ ] Rate limiting works (try sending 6+ conversations rapidly)
- [ ] Message limit enforced (default 30 messages max)
- [ ] Token costs tracked in logs

### Webhooks
- [ ] `onLeadCaptured` fires when email captured
- [ ] `onConversationEnd` fires when conversation ends
- [ ] Webhook payload matches schema in CLIENT-ACQUISITION-WORKFLOW.md
- [ ] Retry works (temporarily break webhook URL, fix, check retry)

### Data
- [ ] Conversations saved to SQLite
- [ ] Lead data correct in webhook payload
- [ ] No PII leaking in logs (check Pino output)

---

## Pass Criteria

**Minimum before go-live:**
- All 6 scenarios run without errors
- At least 10 total conversations completed
- Webhooks tested and confirmed firing
- Client reviews 3+ conversations and approves tone
- Widget tested on client's actual website (staging)
