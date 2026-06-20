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
import { renderEventImage }                            from '../lib/render-image.js';
import { postImageToDiscord }                          from '../lib/discord.js';
import { buildIndividualCaption }                      from '../lib/captions.js';
import { postToInstagram }                             from './social/instagram.js';
import { postToFacebook, postTextToFacebook }          from './social/facebook.js';

// ---------------------------------------------------------------------------
// CLI args
// ---------------------------------------------------------------------------
const DRY_RUN   = process.argv.includes('--dry-run');
const NO_IMAGE  = process.argv.includes('--no-image');
const FORMAT    = process.argv.includes('--format') && process.argv[process.argv.indexOf('--format') + 1] === 'square'
  ? 'square' : 'story';
const SINGLE_ID = process.argv.includes('--id')
  ? process.argv[process.argv.indexOf('--id') + 1]
  : null;
const WINDOW    = process.argv.includes('--window')
  ? process.argv[process.argv.indexOf('--window') + 1]
  : null;

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
// Process a single event
// ---------------------------------------------------------------------------
async function processEvent(event) {
  console.log(`\n🎶 ${event.artist} @ ${event.venue}`);

  const buffer  = NO_IMAGE ? null : renderEventImage(event, FORMAT, [], WINDOW);
  const caption = buildIndividualCaption(event);

  console.log('  Caption preview:\n' + caption.split('\n').map(l => `    ${l}`).join('\n'));

  if (DRY_RUN) {
    const outPath = join(tmpdir(), `${event._id}-preview.png`);
    writeFileSync(outPath, buffer);
    console.log(`  [DRY RUN] Image written to ${outPath}`);
    await postImageToDiscord(buffer, `${event._id}-preview.png`, caption);
    console.log(`  [DRY RUN] Image sent to Discord.`);
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
    event = await sanity.fetch(`*[_id == $id][0]`, { id: SINGLE_ID });
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
