#!/usr/bin/env node
// scripts/post-lyric.js
// ---------------------------------------------------------------------------
// Generates a short music lyric via Claude and posts it to Facebook.
//
// Usage:
//   node scripts/post-lyric.js
//   node scripts/post-lyric.js --dry-run
// ---------------------------------------------------------------------------

import Anthropic from '@anthropic-ai/sdk';
import { ANTHROPIC_API_KEY, FB_PAGE_ID, FB_ACCESS_TOKEN } from '../lib/config.js';

const DRY_RUN = process.argv.includes('--dry-run');
const client  = new Anthropic({ apiKey: ANTHROPIC_API_KEY });
const GRAPH   = 'https://graph.facebook.com/v19.0';

async function generateLyric() {
  const msg = await client.messages.create({
    model:      'claude-haiku-4-5-20251001',
    max_tokens: 200,
    messages:   [{
      role:    'user',
      content: `Write a single short, evocative music lyric (2–4 lines) that captures the feeling of discovering live music outdoors in a city.
It should feel poetic and universal — not specific to any artist or song.
Return only the lyric, no quotes, no explanation.`,
    }],
  });
  return msg.content[0].text.trim();
}

async function postToFacebook(message) {
  const body = new URLSearchParams({ message, access_token: FB_ACCESS_TOKEN });
  const res  = await fetch(`${GRAPH}/${FB_PAGE_ID}/feed`, { method: 'POST', body });
  const json = await res.json();
  if (json.error) throw new Error(`Meta API error: ${JSON.stringify(json.error)}`);
  return json;
}

async function main() {
  console.log('\n🎵 Generating lyric…');
  const lyric = await generateLyric();
  console.log(`\n${lyric}\n`);

  if (DRY_RUN) {
    console.log('[DRY RUN] Would post to Facebook.\n');
    return;
  }

  console.log('→ Posting to Facebook…');
  const post = await postToFacebook(lyric);
  console.log(`✓ Posted (id: ${post.id})\n`);
}

main().catch(err => { console.error(err); process.exit(1); });
