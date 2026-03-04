#!/usr/bin/env node
/**
 * Full conversation test — simulates a real prospect talking to the VantArc AI agent.
 * Tests: professionalism, discovery flow, pitch relevance, booking push.
 */
'use strict';

const BASE_URL = 'http://localhost:3001';

const messages = [
  "Hi! I'm a musician based in Vienna. I've been releasing music independently for about 2 years now but I feel like my brand isn't where it should be. I'm not reaching the right audience.",
  "I make electronic music, kind of ambient-techno. I've released 2 EPs on Bandcamp and Spotify but the streams are low. I have about 3,000 monthly listeners. My name is Lukas, by the way.",
  "Honestly, I've tried doing everything myself - social media, a basic logo from Canva, even tried running some Instagram ads. But nothing really clicks. I feel like I need a real strategy, not just random posts.",
  "My budget is flexible. I could probably commit around 1,500 EUR to start. Is that enough for something meaningful?",
  "That sounds interesting. What makes VantArc different from other agencies? I've heard promises before.",
  "OK I'm interested. My email is lukas.sound@gmail.com - what would the next step look like?"
];

async function sendMessage(convId, text) {
  const res = await fetch(`${BASE_URL}/api/conversations/${convId}/messages`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message: text })
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`HTTP ${res.status}: ${err}`);
  }
  return res.json();
}

async function main() {
  console.log('='.repeat(60));
  console.log('  VantArc AI Agent — Full Conversation Test');
  console.log('='.repeat(60));

  // Start conversation
  const startRes = await fetch(`${BASE_URL}/api/conversations`, { method: 'POST' });
  const startData = await startRes.json();
  const convId = startData.conversationId;

  console.log(`\nConversation ID: ${convId}\n`);
  console.log(`[AGENT] ${startData.message}`);
  console.log('');

  // Run through all messages
  for (let i = 0; i < messages.length; i++) {
    console.log(`[PROSPECT] ${messages[i]}`);
    console.log('');

    try {
      const response = await sendMessage(convId, messages[i]);
      console.log(`[AGENT] ${response.message}`);

      if (response.actions && response.actions.length > 0) {
        console.log(`  >> ACTIONS: ${JSON.stringify(response.actions)}`);
      }
      console.log(`  >> Phase: ${response.phase}`);
      console.log('');
    } catch (err) {
      console.error(`  >> ERROR: ${err.message}`);
      break;
    }
  }

  // Get final conversation state
  const finalRes = await fetch(`${BASE_URL}/api/conversations/${convId}`);
  const finalData = await finalRes.json();

  console.log('='.repeat(60));
  console.log('  CONVERSATION SUMMARY');
  console.log('='.repeat(60));
  console.log(`  Phase: ${finalData.phase}`);
  console.log(`  Messages: ${finalData.messageCount}`);
  console.log(`  Lead Data: ${JSON.stringify(finalData.leadData, null, 2)}`);
  console.log(`  Qualification Score: ${finalData.qualificationScore}`);
  console.log(`  Booking Offered: ${finalData.bookingOffered}`);
  console.log('='.repeat(60));
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
