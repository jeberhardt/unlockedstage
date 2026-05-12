#!/usr/bin/env node
// scripts/post-to-social.js
// ---------------------------------------------------------------------------
// Fetches unposted events from Sanity, renders a social image for each,
// uploads to Instagram and Facebook, and posts the event link as the first
// comment.
//
// Usage:
//   node scripts/post-to-social.js                   # post all unposted
//   node scripts/post-to-social.js --id <sanity-id>  # post one specific event
//   node scripts/post-to-social.js --dry-run          # render only, no API calls
//   node scripts/post-to-social.js --format story     # use 4:5 story format
// ---------------------------------------------------------------------------

import { writeFileSync, unlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join }   from 'node:path';
import { fetchUnpostedEvents, markAsPosted, sanity } from '../lib/sanity.js';
import { renderEventImage }                          from '../lib/render-image.js';
import {
  IG_USER_ID, IG_ACCESS_TOKEN,
  FB_PAGE_ID, FB_ACCESS_TOKEN,
} from '../lib/config.js';

// ---------------------------------------------------------------------------
// CLI args
// ---------------------------------------------------------------------------
const DRY_RUN   = process.argv.includes('--dry-run');
const FORMAT    = process.argv.includes('--format') && process.argv[process.argv.indexOf('--format') + 1] === 'story'
  ? 'story' : 'square';
const SINGLE_ID = process.argv.includes('--id')
  ? process.argv[process.argv.indexOf('--id') + 1]
  : null;

// ---------------------------------------------------------------------------
// Meta Graph API helpers
// ---------------------------------------------------------------------------
const GRAPH = 'https://graph.facebook.com/v19.0';

async function graphPost(path, params) {
  const url  = new URL(`${GRAPH}${path}`);
  const body = new URLSearchParams(params);
  const res  = await fetch(url.toString(), { method: 'POST', body });
  const json = await res.json();
  if (json.error) throw new Error(`Meta API error on ${path}: ${JSON.stringify(json.error)}`);
  return json;
}

// ---------------------------------------------------------------------------
// Instagram: upload image container → publish → comment
// ---------------------------------------------------------------------------
async function postToInstagram(imageUrl, caption, commentText) {
  console.log('  → Instagram: creating media container…');
  const container = await graphPost(`/${IG_USER_ID}/media`, {
    image_url:    imageUrl,
    caption,
    access_token: IG_ACCESS_TOKEN,
  });

  console.log('  → Instagram: publishing…');
  const published = await graphPost(`/${IG_USER_ID}/media_publish`, {
    creation_id:  container.id,
    access_token: IG_ACCESS_TOKEN,
  });

  console.log('  → Instagram: posting first comment…');
  await graphPost(`/${published.id}/comments`, {
    message:      commentText,
    access_token: IG_ACCESS_TOKEN,
  });

  console.log(`  ✓ Instagram post published (id: ${published.id})`);
  return published.id;
}

// ---------------------------------------------------------------------------
// Facebook: upload photo → post caption → comment
// ---------------------------------------------------------------------------
async function postToFacebook(imageUrl, caption, commentText) {
  console.log('  → Facebook: uploading photo…');
  const photo = await graphPost(`/${FB_PAGE_ID}/photos`, {
    url:          imageUrl,
    caption,
    access_token: FB_ACCESS_TOKEN,
  });

  console.log('  → Facebook: posting first comment…');
  await graphPost(`/${photo.post_id}/comments`, {
    message:      commentText,
    access_token: FB_ACCESS_TOKEN,
  });

  console.log(`  ✓ Facebook post published (post_id: ${photo.post_id})`);
  return photo.post_id;
}

// ---------------------------------------------------------------------------
// Host the PNG temporarily so Meta can fetch it by URL.
// In production, upload to your CDN / S3 / Sanity assets instead.
// This helper writes to a temp file and assumes you have a tunnel (e.g. ngrok)
// or a deploy — swap `IMAGE_BASE_URL` for your real public URL.
// ---------------------------------------------------------------------------
const IMAGE_BASE_URL = process.env.IMAGE_BASE_URL ?? 'https://your-server.com/tmp';

async function makeImagePublicUrl(buffer, eventId) {
  // In a real deploy: upload buffer to S3/Cloudflare R2/Sanity and return URL.
  // For local testing with ngrok, write to a statically served tmp directory.
  const filename = `${eventId}-${Date.now()}.png`;
  const tmpPath  = join(tmpdir(), filename);
  writeFileSync(tmpPath, buffer);

  // You would serve tmpdir via a local HTTP server when testing locally.
  // In production replace this with an actual upload:
  //
  //   const { url } = await sanity.assets.upload('image', buffer, {
  //     filename,
  //     contentType: 'image/png',
  //   });
  //   return url + '?w=1080';
  //
  return `${IMAGE_BASE_URL}/${filename}`;
}

// ---------------------------------------------------------------------------
// Build caption & comment
// ---------------------------------------------------------------------------
function buildCaption(event) {
  const d = new Date(event.dateTime);
  const dateStr = d.toLocaleDateString('en-CA', {
    weekday: 'long', month: 'long', day: 'numeric', timeZone: 'America/Toronto'
  });
  const timeStr = d.toLocaleTimeString('en-CA', {
    hour: 'numeric', minute: '2-digit', timeZone: 'America/Toronto'
  });

  const genreMap = {
    jazz: '#jazz', indie: '#indie', classical: '#classical', folk: '#folk',
    electronic: '#electronic', rb: '#rnb', pop: '#pop', hiphop: '#hiphop', other: '#livemusic',
  };
  const hashtag = genreMap[event.genre] ?? '#livemusic';

  return [
    `🎵 ${event.artist}`,
    `📅 ${dateStr} at ${timeStr}`,
    `📍 ${event.venue}, ${event.neighbourhood}`,
    '',
    event.notes ? event.notes.slice(0, 200) : '',
    '',
    `${hashtag} #Toronto #UnlockedStage #LiveMusic`,
  ].filter(l => l !== undefined).join('\n').trim();
}

function buildComment(event) {
  if (!event.externalLink) return '🎟️ Tickets & info: unlockedstage.ca';
  return `🎟️ Full details & tickets: ${event.externalLink}`;
}

// ---------------------------------------------------------------------------
// Process a single event
// ---------------------------------------------------------------------------
async function processEvent(event) {
  console.log(`\n🎶 ${event.artist} @ ${event.venue}`);

  const buffer   = renderEventImage(event, FORMAT);
  const caption  = buildCaption(event);
  const comment  = buildComment(event);

  console.log('  Caption preview:\n' + caption.split('\n').map(l => `    ${l}`).join('\n'));
  console.log(`  Comment: ${comment}`);

  if (DRY_RUN) {
    // Write the image locally so you can inspect it
    const outPath = join(tmpdir(), `${event._id}-preview.png`);
    writeFileSync(outPath, buffer);
    console.log(`  [DRY RUN] Image written to ${outPath}`);
    return;
  }

  // Make image available at a public URL for Meta's API
  const imageUrl = await makeImagePublicUrl(buffer, event._id);

  const results = await Promise.allSettled([
    postToInstagram(imageUrl, caption, comment),
    postToFacebook(imageUrl, caption, comment),
  ]);

  results.forEach((r, i) => {
    if (r.status === 'rejected') {
      console.error(`  ✗ ${i === 0 ? 'Instagram' : 'Facebook'} failed: ${r.reason.message}`);
    }
  });

  const anySucceeded = results.some(r => r.status === 'fulfilled');
  if (anySucceeded) {
    await markAsPosted(event._id);
    console.log(`  ✓ Marked as posted in Sanity.`);
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
  console.log(`\n📱 Social poster — format: ${FORMAT}${DRY_RUN ? ' (DRY RUN)' : ''}\n`);

  let events;

  if (SINGLE_ID) {
    const doc = await sanity.fetch(`*[_type == "event" && _id == $id][0]`, { id: SINGLE_ID });
    if (!doc) { console.error(`Event ${SINGLE_ID} not found.`); process.exit(1); }
    events = [doc];
  } else {
    events = await fetchUnpostedEvents();
  }

  console.log(`${events.length} event(s) to post.\n`);

  if (events.length === 0) {
    console.log('Nothing to do. All events have been posted, or none exist.\n');
    return;
  }

  for (const event of events) {
    await processEvent(event);
  }

  console.log('\n✅ Done.\n');
}

main().catch(err => { console.error(err); process.exit(1); });
