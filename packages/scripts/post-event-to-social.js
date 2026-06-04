#!/usr/bin/env node
// scripts/post-event-to-social.js
// ---------------------------------------------------------------------------
// Posts a single named event (festival / titled event) to Instagram and
// Facebook.  Picks the next unposted titled event ordered by date, then marks
// all Sanity rows sharing that title as eventPostedToSocial = true.
//
// Usage:
//   node scripts/post-event-to-social.js              # post next unposted event
//   node scripts/post-event-to-social.js --id <id>    # post one specific event
//   node scripts/post-event-to-social.js --dry-run    # render only + Discord preview
//   node scripts/post-event-to-social.js --format story
// ---------------------------------------------------------------------------

import { writeFileSync }                                  from 'node:fs';
import { tmpdir }                                         from 'node:os';
import { join }                                           from 'node:path';
import { fetchNextUnpostedNamedEvent, markEventAsPosted, sanity } from '../lib/sanity.js';
import { renderEventImage }                               from '../lib/render-image.js';
import { buildFestivalCaption }                           from '../lib/captions.js';
import { postImageToDiscord }                             from '../lib/discord.js';
import { postToInstagram }                                from './social/instagram.js';
import { postToFacebook }                                 from './social/facebook.js';

const DRY_RUN   = process.argv.includes('--dry-run');
const FORMAT    = process.argv.includes('--format') && process.argv[process.argv.indexOf('--format') + 1] === 'story'
  ? 'story' : 'square';
const SINGLE_ID = process.argv.includes('--id')
  ? process.argv[process.argv.indexOf('--id') + 1]
  : null;

async function makeImagePublicUrl(buffer, eventId) {
  const filename = `event-${eventId}-${Date.now()}.png`;
  const asset    = await sanity.assets.upload('image', buffer, { filename, contentType: 'image/png' });
  return `${asset.url}?w=1080`;
}

async function processEvent(event) {
  console.log(`\n🎪 ${event.title} @ ${event.venue}`);

  const buffer  = renderEventImage(event, FORMAT);
  const caption = buildFestivalCaption(event);

  console.log('  Caption preview:\n' + caption.split('\n').map(l => `    ${l}`).join('\n'));

  if (DRY_RUN) {
    const outPath = join(tmpdir(), `${event._id}-event-preview.png`);
    writeFileSync(outPath, buffer);
    console.log(`  [DRY RUN] Image written to ${outPath}`);
    await postImageToDiscord(buffer, `${event._id}-event-preview.png`, caption);
    console.log(`  [DRY RUN] Image sent to Discord.`);
    return;
  }

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
    await markEventAsPosted(event.title);
    console.log(`  ✓ Marked all "${event.title}" events as posted in Sanity.`);
  }
}

async function main() {
  console.log(`\n🎪 Event poster — format: ${FORMAT}${DRY_RUN ? ' (DRY RUN)' : ''}\n`);

  let event;

  if (SINGLE_ID) {
    event = await sanity.fetch(`*[_type == "event" && _id == $id][0] {
      _id, title, artist, genre, dateTime, venue, neighbourhood, externalLink, notes, instagramHandle, facebookHandle, schedule
    }`, { id: SINGLE_ID });
    if (!event) { console.error(`Event ${SINGLE_ID} not found.`); process.exit(1); }
    if (!event.title) { console.error(`Event ${SINGLE_ID} has no title — use post-to-social.js for performances.`); process.exit(1); }
  } else {
    event = await fetchNextUnpostedNamedEvent();
  }

  if (!event) {
    console.log('Nothing to do. No upcoming unposted named events.\n');
    return;
  }

  await processEvent(event);

  console.log('\n✅ Done.\n');
}

main().catch(err => { console.error(err); process.exit(1); });
