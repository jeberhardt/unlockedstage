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
import { renderEventImage, renderFestivalDayImage }       from '../lib/render-image.js';
import { buildFestivalCaption }                           from '../lib/captions.js';
import { postImageToDiscord }                             from '../lib/discord.js';
import { postToInstagram, postCarouselToInstagram }       from './social/instagram.js';
import { postToFacebook, postAlbumToFacebook }            from './social/facebook.js';

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

  if (window === 'tomorrow') {
    const tomorrow = new Date(Date.UTC(y, m - 1, d + 1));
    return { start: iso(tomorrow, '00:00:00'), end: iso(tomorrow, '23:59:59') };
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

// Fetch performances linked to this festival or series within the window.
async function fetchPerformers(event, windowBounds = null) {
  if (!['festival', 'series'].includes(event._type)) return [];

  const refField     = event._type === 'festival' ? 'festival' : 'series';
  const schedStart   = event.schedule?.[0]?.startTime ?? event.dateTime;
  const schedEnd     = event.schedule?.[event.schedule.length - 1]?.endTime ?? event.dateTime;
  const start        = windowBounds?.start ?? schedStart;
  const end          = windowBounds?.end   ?? schedEnd;

  return sanity.fetch(
    `*[_type == "performance" && ${refField}._ref == $id && dateTime >= $start && dateTime <= $end]
     | order(dateTime asc) { artist, dateTime, venue }`,
    { id: event._id, start, end }
  );
}

// Group performers by Toronto calendar date, excluding past days.
// Returns Map<'YYYY-MM-DD', performer[]>.
function groupByDay(performers) {
  const TZ    = 'America/Toronto';
  const today = new Date().toLocaleDateString('en-CA', { timeZone: TZ });
  const groups = new Map();
  for (const p of performers) {
    const day = new Date(p.dateTime).toLocaleDateString('en-CA', { timeZone: TZ });
    if (day < today) continue; // skip past days
    if (!groups.has(day)) groups.set(day, []);
    groups.get(day).push(p);
  }
  return groups;
}

async function makeImagePublicUrl(buffer, eventId) {
  const filename = `event-${eventId}-${Date.now()}.png`;
  const asset    = await sanity.assets.upload('image', buffer, { filename, contentType: 'image/png' });
  return `${asset.url}?w=1080&fm=jpg`;
}

async function processEvent(event) {
  console.log(`\n🎪 ${event.title} @ ${event.venue}`);

  const windowBounds = WINDOW ? getWindowBounds(WINDOW) : null;
  const performers   = await fetchPerformers(event, windowBounds);
  console.log(`  ${performers.length} performer(s) in window`);

  const byDay     = groupByDay(performers);
  const isMultiDay = byDay.size > 1;
  const caption    = buildFestivalCaption(event, [], WINDOW);

  console.log('  Caption preview:\n' + caption.split('\n').map(l => `    ${l}`).join('\n'));

  if (isMultiDay) {
    // Carousel — one slide per day
    const days    = Array.from(byDay.entries()); // [['2026-06-20', [...]], ...]
    const buffers = days.map(([, dayPerformers]) =>
      renderFestivalDayImage(event, dayPerformers, FORMAT, WINDOW)
    );
    console.log(`  Building ${days.length}-slide carousel (one per day)…`);
    days.forEach(([date, dp]) => console.log(`    · ${date}: ${dp.length} performer(s)`));

    if (DRY_RUN) {
      for (const [i, buffer] of buffers.entries()) {
        const [date] = days[i];
        const outPath = join(tmpdir(), `${event._id}-day${i + 1}-preview.png`);
        writeFileSync(outPath, buffer);
        console.log(`  [DRY RUN] Slide ${i + 1} written to ${outPath}`);
        await postImageToDiscord(buffer, `${event._id}-day${i + 1}.png`, i === 0 ? caption : `(slide ${i + 1}: ${date})`);
      }
      console.log(`  [DRY RUN] All slides sent to Discord.`);
      return;
    }

    const imageUrls = await Promise.all(buffers.map((buf, i) => makeImagePublicUrl(buf, `${event._id}-${i + 1}`)));
    const results   = await Promise.allSettled([
      postCarouselToInstagram(imageUrls, caption),
      postAlbumToFacebook(imageUrls, caption),
    ]);
    results.forEach((r, i) => {
      if (r.status === 'rejected') console.error(`  ✗ ${i === 0 ? 'Instagram' : 'Facebook'} failed: ${r.reason.message}`);
      else console.log(`  ✓ ${i === 0 ? 'Instagram' : 'Facebook'}`);
    });

  } else {
    // Single image — use day template if we have performers, otherwise standard event image
    const dayPerformers = byDay.size === 1 ? Array.from(byDay.values())[0] : [];
    const buffer = dayPerformers.length > 0
      ? renderFestivalDayImage(event, dayPerformers, FORMAT, WINDOW)
      : renderEventImage(event, FORMAT, [], WINDOW);

    if (DRY_RUN) {
      const outPath = join(tmpdir(), `${event._id}-event-preview.png`);
      writeFileSync(outPath, buffer);
      console.log(`  [DRY RUN] Image written to ${outPath}`);
      await postImageToDiscord(buffer, `${event._id}-event-preview.png`, caption);
      console.log(`  [DRY RUN] Image sent to Discord.`);
      return;
    }

    const imageUrl = await makeImagePublicUrl(buffer, event._id);
    const results  = await Promise.allSettled([
      postToInstagram(imageUrl, caption),
      postToFacebook(imageUrl, caption),
    ]);
    results.forEach((r, i) => {
      if (r.status === 'rejected') console.error(`  ✗ ${i === 0 ? 'Instagram' : 'Facebook'} failed: ${r.reason.message}`);
      else console.log(`  ✓ ${i === 0 ? 'Instagram' : 'Facebook'}`);
    });
  }

  const anySucceeded = true; // mark regardless — we've already posted what we can
  if (anySucceeded && !DRY_RUN) {
    await markEventAsPosted(event.title);
    console.log(`  ✓ Marked all "${event.title}" events as posted in Sanity.`);
  }
}

async function main() {
  console.log(`\n🎪 Event poster — format: ${FORMAT}${WINDOW ? ` · window: ${WINDOW}` : ''}${DRY_RUN ? ' (DRY RUN)' : ''}\n`);

  let event;

  if (SINGLE_ID) {
    event = await sanity.fetch(`*[_id == $id][0] {
      _id, _type, title, artist, genre, dateTime, venue, neighbourhood, externalLink, notes, instagramHandle, facebookHandle, schedule
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
