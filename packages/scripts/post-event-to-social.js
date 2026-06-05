#!/usr/bin/env node
// scripts/post-event-to-social.js
// ---------------------------------------------------------------------------
// Posts a single named event (festival / titled event) to Instagram and
// Facebook.  Picks the next unposted titled event ordered by date, then marks
// all Sanity rows sharing that title as eventPostedToSocial = true.
//
// Usage:
//   node scripts/post-event-to-social.js                        # post next unposted event
//   node scripts/post-event-to-social.js --id <id>              # post one specific event
//   node scripts/post-event-to-social.js --dry-run              # render only + Discord preview
//   node scripts/post-event-to-social.js --format story
//   node scripts/post-event-to-social.js --window today         # filter performers to today
//   node scripts/post-event-to-social.js --window weekend       # filter performers to this weekend
//   node scripts/post-event-to-social.js --window week          # filter performers to this week
//   node scripts/post-event-to-social.js --window month         # filter performers to this month
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
const FORMAT    = process.argv.includes('--format') && process.argv[process.argv.indexOf('--format') + 1] === 'square'
  ? 'square' : 'story';
const SINGLE_ID = process.argv.includes('--id')
  ? process.argv[process.argv.indexOf('--id') + 1]
  : null;
const WINDOW    = process.argv.includes('--window')
  ? process.argv[process.argv.indexOf('--window') + 1]
  : null; // today | weekend | week | month

// ---------------------------------------------------------------------------
// Return {start, end} ISO strings for the requested window in Toronto time.
// ---------------------------------------------------------------------------
function getWindowBounds(window) {
  const TZ  = 'America/Toronto';
  const now  = new Date();

  const todayStr = now.toLocaleDateString('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' });
  const [y, m, d] = todayStr.split('-').map(Number);

  const tzPart  = new Intl.DateTimeFormat('en-US', { timeZone: TZ, timeZoneName: 'shortOffset' })
    .formatToParts(now).find(p => p.type === 'timeZoneName').value;
  const offsetH = parseInt(tzPart.replace('GMT', ''), 10) || 0;
  const sign    = offsetH <= 0 ? '-' : '+';
  const offset  = `${sign}${String(Math.abs(offsetH)).padStart(2, '0')}:00`;
  const iso     = (date, time) => `${date.toISOString().slice(0, 10)}T${time}${offset}`;

  if (window === 'today') {
    const today = new Date(Date.UTC(y, m - 1, d));
    return { start: iso(today, '00:00:00'), end: iso(today, '23:59:59') };
  }

  if (window === 'weekend') {
    const shortDay = now.toLocaleDateString('en-CA', { weekday: 'short', timeZone: TZ });
    const dayNum   = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 }[shortDay];
    const toFri    = dayNum === 0 ? -2 : 5 - dayNum;
    const fri = new Date(Date.UTC(y, m - 1, d + toFri));
    const sun = new Date(Date.UTC(y, m - 1, d + toFri + 2));
    return { start: iso(fri, '00:00:00'), end: iso(sun, '23:59:59') };
  }

  if (window === 'week') {
    const shortDay = now.toLocaleDateString('en-CA', { weekday: 'short', timeZone: TZ });
    const dayNum   = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 }[shortDay];
    const mon = new Date(Date.UTC(y, m - 1, d - (dayNum === 0 ? 6 : dayNum - 1)));
    const sun = new Date(Date.UTC(y, m - 1, d - (dayNum === 0 ? 6 : dayNum - 1) + 6));
    return { start: iso(mon, '00:00:00'), end: iso(sun, '23:59:59') };
  }

  if (window === 'month') {
    const first = new Date(Date.UTC(y, m - 1, 1));
    const last  = new Date(Date.UTC(y, m, 0)); // last day of month
    return { start: iso(first, '00:00:00'), end: iso(last, '23:59:59') };
  }

  return null; // no window — caller uses full schedule range
}

// Fetch individual performer events that belong to this named event's schedule window.
async function fetchPerformers(event) {
  if (!event.schedule?.length) return [];

  const windowBounds = WINDOW ? getWindowBounds(WINDOW) : null;
  const start = windowBounds?.start ?? event.schedule[0].startTime;
  const end   = windowBounds?.end   ?? event.schedule[event.schedule.length - 1].endTime;

  return sanity.fetch(`
    *[_type == "event" && venue == $venue && !defined(title) && dateTime >= $start && dateTime <= $end]
    | order(dateTime asc) { artist, dateTime }
  `, { venue: event.venue, start, end });
}

async function makeImagePublicUrl(buffer, eventId) {
  const filename = `event-${eventId}-${Date.now()}.png`;
  const asset    = await sanity.assets.upload('image', buffer, { filename, contentType: 'image/png' });
  return `${asset.url}?w=1080&fm=jpg`;
}

async function processEvent(event) {
  console.log(`\n🎪 ${event.title} @ ${event.venue}`);

  const performers = await fetchPerformers(event);
  if (performers.length) console.log(`  ${performers.length} performer(s): ${performers.map(p => p.artist).join(', ')}`);

  const buffer  = renderEventImage(event, FORMAT, performers, WINDOW);
  const caption = buildFestivalCaption(event, performers, WINDOW);

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
  console.log(`\n🎪 Event poster — format: ${FORMAT}${WINDOW ? ` · window: ${WINDOW}` : ''}${DRY_RUN ? ' (DRY RUN)' : ''}\n`);

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
