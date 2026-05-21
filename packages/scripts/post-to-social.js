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

import { writeFileSync } from 'node:fs';
import { tmpdir }        from 'node:os';
import { join }          from 'node:path';
import { fetchNextUnpostedEvent, markAsPosted, sanity } from '../lib/sanity.js';
import { renderEventImage }                          from '../lib/render-image.js';
import {
  IG_USER_ID, IG_ACCESS_TOKEN,
  FB_PAGE_ID, FB_ACCESS_TOKEN,
} from '../lib/config.js';

// ---------------------------------------------------------------------------
// CLI args
// ---------------------------------------------------------------------------
const DRY_RUN   = process.argv.includes('--dry-run');
const NO_IMAGE  = process.argv.includes('--no-image');
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
async function postToInstagram(imageUrl, caption) {
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

  console.log(`  ✓ Instagram post published (id: ${published.id})`);
  return published.id;
}

// ---------------------------------------------------------------------------
// Facebook: upload photo → post caption → comment
// ---------------------------------------------------------------------------
async function postToFacebook(imageUrl, caption) {
  console.log('  → Facebook: uploading photo…');
  const photo = await graphPost(`/${FB_PAGE_ID}/photos`, {
    url:          imageUrl,
    caption,
    access_token: FB_ACCESS_TOKEN,
  });

  console.log(`  ✓ Facebook post published (post_id: ${photo.post_id})`);
  return photo.post_id;
}

// ---------------------------------------------------------------------------
// Facebook: text-only post (no image)
// ---------------------------------------------------------------------------
async function postTextToFacebook(caption) {
  console.log('  → Facebook: posting to feed…');
  const post = await graphPost(`/${FB_PAGE_ID}/feed`, {
    message:      caption,
    access_token: FB_ACCESS_TOKEN,
  });
  console.log(`  ✓ Facebook post published (post_id: ${post.id})`);
  return post.id;
}

// ---------------------------------------------------------------------------
async function makeImagePublicUrl(buffer, eventId) {
  const filename = `social-${eventId}-${Date.now()}.png`;
  const asset = await sanity.assets.upload('image', buffer, {
    filename,
    contentType: 'image/png',
  });
  return `${asset.url}?w=1080`;
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
    `🎵 ${event.title || event.artist}`,
    `📅 ${dateStr} at ${timeStr}`,
    `📍 ${event.venue}, ${event.neighbourhood}`,
    '',
    event.notes ? event.notes.slice(0, 200) : '',
    '',
    `${hashtag} #Toronto #UnlockedStage #LiveMusic`,
    '',
    event.externalLink ? `🎟️ ${event.externalLink}` : '🎟️ unlockedstage.ca',
  ].filter(l => l !== undefined).join('\n').trim();
}

// ---------------------------------------------------------------------------
// Process a single event
// ---------------------------------------------------------------------------
async function processEvent(event) {
  console.log(`\n🎶 ${event.artist} @ ${event.venue}`);

  const buffer  = NO_IMAGE ? null : renderEventImage(event, FORMAT);
  const caption = buildCaption(event);

  console.log('  Caption preview:\n' + caption.split('\n').map(l => `    ${l}`).join('\n'));

  if (DRY_RUN) {
    const outPath = join(tmpdir(), `${event._id}-preview.png`);
    writeFileSync(outPath, buffer);
    console.log(`  [DRY RUN] Image written to ${outPath}`);
    return;
  }

  if (NO_IMAGE) {
    const result = await Promise.allSettled([
      postTextToFacebook(caption),
    ]);
    if (result[0].status === 'fulfilled') {
      await markAsPosted(event._id);
      console.log(`  ✓ Marked as posted in Sanity.`);
    } else {
      console.error(`  ✗ Facebook failed: ${result[0].reason.message}`);
    }
    return;
  }

  // Make image available at a public URL for Meta's API
  const imageUrl = await makeImagePublicUrl(buffer, event._id);

  const results = await Promise.allSettled([
    postToInstagram(imageUrl, caption),
    postToFacebook(imageUrl, caption),
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

  let event;

  if (SINGLE_ID) {
    event = await sanity.fetch(`*[_type == "event" && _id == $id][0]`, { id: SINGLE_ID });
    if (!event) { console.error(`Event ${SINGLE_ID} not found.`); process.exit(1); }
  } else {
    event = await fetchNextUnpostedEvent();
  }

  if (!event) {
    console.log('Nothing to do. No upcoming unposted events.\n');
    return;
  }

  await processEvent(event);

  console.log('\n✅ Done.\n');
}

main().catch(err => { console.error(err); process.exit(1); });
