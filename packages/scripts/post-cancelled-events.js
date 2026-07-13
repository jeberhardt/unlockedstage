#!/usr/bin/env node
// scripts/post-cancelled-events.js
// ---------------------------------------------------------------------------
// Posts a cancellation alert for one or more events — e.g. outdoor shows
// called off for bad weather. Renders the "CANCELLED" stamp template (no
// FREE ribbon) and posts a single image listing the affected events.
//
// By default, finds performances/festivals flagged `cancelled == true` in
// Sanity (check the box in Studio) that haven't already had an alert posted
// and are today or later. After a real (non-dry-run) post, marks them
// `cancellationPosted = true` so a re-run doesn't post duplicates — and, for
// events picked via --ids, also sets `cancelled = true` so Studio state
// matches what was announced.
//
// Usage:
//   node scripts/post-cancelled-events.js                        # post all flagged-cancelled events
//   node scripts/post-cancelled-events.js --ids <id1,id2,...>    # bypass the flag, post these specific events
//   node scripts/post-cancelled-events.js --reason "high winds"
//   node scripts/post-cancelled-events.js --format square
//   node scripts/post-cancelled-events.js --dry-run
// ---------------------------------------------------------------------------

import { writeFileSync }              from 'node:fs';
import { tmpdir }                     from 'node:os';
import { join }                       from 'node:path';
import { sanity }                     from '../lib/sanity.js';
import { renderCancelledImage }       from '../lib/render-image.js';
import { buildCancelledCaption }      from '../lib/captions.js';
import { postImageToDiscord }         from '../lib/discord.js';
import { postToInstagram }            from './social/instagram.js';
import { postToFacebook }             from './social/facebook.js';

const DRY_RUN = process.argv.includes('--dry-run');
const FORMAT  = process.argv.includes('--format') && process.argv[process.argv.indexOf('--format') + 1] === 'square'
  ? 'square' : 'story';
const IDS = process.argv.includes('--ids')
  ? process.argv[process.argv.indexOf('--ids') + 1].split(',').map(s => s.trim()).filter(Boolean)
  : [];
const REASON = process.argv.includes('--reason')
  ? process.argv[process.argv.indexOf('--reason') + 1]
  : 'poor weather';

const EVENT_FIELDS = `_id, _type, title, artist, genre, dateTime, venue, neighbourhood`;

async function fetchExplicit(ids) {
  const events = await sanity.fetch(
    `*[_id in $ids]{ ${EVENT_FIELDS} }`,
    { ids }
  );
  const missing = ids.filter(id => !events.some(e => e._id === id));
  if (missing.length > 0) console.warn(`  ⚠ Not found: ${missing.join(', ')}`);
  return events;
}

async function fetchFlaggedCancelled() {
  const TZ = 'America/Toronto';
  const startOfToday = new Date().toLocaleDateString('en-CA', { timeZone: TZ }) + 'T00:00:00';
  return sanity.fetch(
    `*[(_type == "performance" || _type == "festival") && cancelled == true && cancellationPosted != true && dateTime >= $startOfToday]
     | order(dateTime asc) { ${EVENT_FIELDS} }`,
    { startOfToday }
  );
}

async function makeImagePublicUrl(buffer) {
  const filename = `cancelled-${Date.now()}.png`;
  const asset    = await sanity.assets.upload('image', buffer, { filename, contentType: 'image/png' });
  return `${asset.url}?w=1080&fm=jpg`;
}

async function markPosted(events, { alsoSetCancelled }) {
  await Promise.allSettled(events.map(e => {
    const patch = sanity.patch(e._id).set({ cancellationPosted: true, ...(alsoSetCancelled ? { cancelled: true } : {}) });
    return patch.commit();
  }));
}

async function main() {
  console.log(`\n⚠️  Cancellation alert — format: ${FORMAT}${DRY_RUN ? ' (DRY RUN)' : ''}\n`);

  const events = IDS.length > 0 ? await fetchExplicit(IDS) : await fetchFlaggedCancelled();

  if (events.length === 0) {
    console.log(IDS.length > 0
      ? 'No matching events found.'
      : 'No events flagged as cancelled (and not yet posted) today or later.\n');
    if (IDS.length > 0) process.exit(1);
    return;
  }

  events.sort((a, b) => new Date(a.dateTime) - new Date(b.dateTime));
  events.forEach(e => console.log(`  · ${e.title || e.artist} @ ${e.venue}`));

  const reasonText = `Due to ${REASON}`;
  const buffer      = renderCancelledImage(events, FORMAT, reasonText);
  const caption     = buildCancelledCaption(events, REASON);

  console.log('\nCaption preview:\n' + caption.split('\n').map(l => `  ${l}`).join('\n'));

  if (DRY_RUN) {
    const outPath = join(tmpdir(), `cancelled-preview.png`);
    writeFileSync(outPath, buffer);
    console.log(`\n[DRY RUN] Image written to ${outPath}`);
    await postImageToDiscord(buffer, 'cancelled-preview.png', caption);
    console.log('[DRY RUN] Image sent to Discord.');
    console.log('\n✅ Done (dry run).\n');
    return;
  }

  const imageUrl = await makeImagePublicUrl(buffer);
  const results  = await Promise.allSettled([
    postToInstagram(imageUrl, caption),
    postToFacebook(imageUrl, caption),
  ]);
  results.forEach((r, i) => {
    if (r.status === 'rejected') console.error(`  ✗ ${i === 0 ? 'Instagram' : 'Facebook'} failed: ${r.reason.message}`);
    else console.log(`  ✓ ${i === 0 ? 'Instagram' : 'Facebook'}`);
  });

  await postImageToDiscord(buffer, 'cancelled.png', caption);
  console.log('  ✓ Discord');

  await markPosted(events, { alsoSetCancelled: IDS.length > 0 });
  console.log(`  ✓ Marked ${events.length} event(s) as cancellationPosted in Sanity.`);

  console.log('\n✅ Done.\n');
}

main().catch(err => { console.error(err); process.exit(1); });
