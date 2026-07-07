#!/usr/bin/env node
// scripts/post-roundup.js
// ---------------------------------------------------------------------------
// Posts a window-based roundup carousel:
//   Slide 1  — overview listing all active festivals, series, and standalone
//              performances for the window (no per-performer detail)
//   Slides 2+ — one detail image per event, with performers where applicable
//
// Usage:
//   node scripts/post-roundup.js --window weekend     # this Fri–Sun (default)
//   node scripts/post-roundup.js --window today
//   node scripts/post-roundup.js --window tomorrow
//   node scripts/post-roundup.js --window week
//   node scripts/post-roundup.js --window month
//   node scripts/post-roundup.js --dry-run
//   node scripts/post-roundup.js --format story
// ---------------------------------------------------------------------------

import { writeFileSync }           from 'node:fs';
import { tmpdir }                  from 'node:os';
import { join }                    from 'node:path';
import Anthropic                   from '@anthropic-ai/sdk';
import { sanity }                  from '../lib/sanity.js';
import { renderWeekendImage,
         renderEventImage,
         renderFestivalDayImage }  from '../lib/render-image.js';
import { buildWeekendCaption,
         buildFestivalCaption,
         buildIndividualCaption }  from '../lib/captions.js';
import { postImageToDiscord }      from '../lib/discord.js';
import { postToInstagram,
         postCarouselToInstagram } from './social/instagram.js';
import { postToFacebook,
         postAlbumToFacebook }     from './social/facebook.js';
import { ANTHROPIC_API_KEY }       from '../lib/config.js';

const DRY_RUN      = process.argv.includes('--dry-run');
const FORMAT       = process.argv.includes('--format')
  ? (['story', 'portrait'].includes(process.argv[process.argv.indexOf('--format') + 1]) ? 'story' : 'square')
  : 'square';
const WINDOW       = process.argv.includes('--window')
  ? process.argv[process.argv.indexOf('--window') + 1]
  : 'weekend';
const EXCLUDE      = process.argv.includes('--exclude')
  ? process.argv[process.argv.indexOf('--exclude') + 1].split(',').map(s => s.trim().toLowerCase())
  : [];
const ONLY_FESTIVAL = process.argv.includes('--festival')
  ? process.argv[process.argv.indexOf('--festival') + 1].trim().toLowerCase()
  : null;
const MAX_PER_PAGE = 8;

// ---------------------------------------------------------------------------

function getWindowBounds(window) {
  const TZ  = 'America/Toronto';
  const now = new Date();

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
    const toMon   = dayNum === 0 ? -6 : 1 - dayNum;
    const mon = new Date(Date.UTC(y, m - 1, d + toMon));
    const sun = new Date(Date.UTC(y, m - 1, d + toMon + 6));
    return { start: iso(mon, '00:00:00'), end: iso(sun, '23:59:59') };
  }
  if (window === 'month') {
    const first = new Date(Date.UTC(y, m - 1, 1));
    const last  = new Date(Date.UTC(y, m, 0));
    return { start: iso(first, '00:00:00'), end: iso(last, '23:59:59') };
  }
  throw new Error(`Unknown window: ${window}`);
}

function formatWindowLabel(window, { start, end }) {
  const TZ     = 'America/Toronto';
  const months = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];
  const monthDay = iso => {
    const parts = new Intl.DateTimeFormat('en-CA', { timeZone: TZ, month: '2-digit', day: 'numeric' })
      .formatToParts(new Date(iso));
    return { month: +parts.find(p => p.type === 'month').value, day: +parts.find(p => p.type === 'day').value };
  };
  if (window === 'today' || window === 'tomorrow') {
    const { month, day } = monthDay(start);
    return `${months[month - 1]} ${day}`;
  }
  const s = monthDay(start);
  const e = monthDay(end);
  return s.month === e.month
    ? `${months[s.month - 1]} ${s.day} – ${e.day}`
    : `${months[s.month - 1]} ${s.day} – ${months[e.month - 1]} ${e.day}`;
}

// ---------------------------------------------------------------------------
// Fetch all top-level events for the window
// ---------------------------------------------------------------------------
async function fetchWindowEvents({ start, end }) {
  const festivals = await sanity.fetch(`
    *[_type == "festival" && (
      (dateTime >= $start && dateTime <= $end) ||
      count(schedule[startTime <= $end && endTime >= $start]) > 0
    )] | order(dateTime asc) {
      _id, title, venue, neighbourhood, instagramHandle, facebookHandle, genre, dateTime,
      schedule, externalLink, notes, image
    }
  `, { start, end });

  const seriesRaw = await sanity.fetch(`
    *[_type == "performance" && defined(series) && dateTime >= $start && dateTime <= $end] {
      "s": series-> { _id, title, venue, neighbourhood, instagramHandle, facebookHandle, genre, externalLink, notes, image }
    }
  `, { start, end });
  const seenSeries = new Set();
  const series = [];
  for (const { s } of seriesRaw) {
    if (s && !seenSeries.has(s._id)) { seenSeries.add(s._id); series.push(s); }
  }

  const standalone = await sanity.fetch(`
    *[_type == "performance" && !defined(festival) && !defined(series) && dateTime >= $start && dateTime <= $end]
    | order(dateTime asc) {
      _id, artist, venue, neighbourhood, instagramHandle, facebookHandle, genre, dateTime, externalLink, notes, image
    }
  `, { start, end });

  const all = [
    ...festivals.map(e => ({ ...e, _source: 'festival' })),
    ...series.map(e =>    ({ ...e, _source: 'series' })),
    ...standalone.map(p => ({ ...p, title: p.artist, _source: 'standalone' })),
  ];

  // Deduplicate by venue: series > festival > standalone
  const priority = { series: 0, festival: 1, standalone: 2 };
  const byVenue  = new Map();
  for (const e of all) {
    const existing = byVenue.get(e.venue);
    if (!existing || priority[e._source] < priority[existing._source]) byVenue.set(e.venue, e);
  }
  return all.filter(e => byVenue.get(e.venue) === e);
}

// Fetch performers for a festival or series in the window
async function fetchPerformers(id, type, { start, end }) {
  const refField = type === 'festival' ? 'festival' : 'series';
  return sanity.fetch(
    `*[_type == "performance" && ${refField}._ref == $id && dateTime >= $start && dateTime <= $end]
     | order(dateTime asc) { artist, dateTime }`,
    { id, start, end }
  );
}

function stripYear(name) {
  return (name ?? '').replace(/\s+20\d{2}/, '').replace(/\s+'?\d{2}\b/, '').trim();
}

async function rankEvents(events) {
  if (events.length <= 1) return events;
  const client = new Anthropic({ apiKey: ANTHROPIC_API_KEY });
  const list = events.map((e, i) => `${i}: ${e.title} | venue: ${e.venue}`).join('\n');
  const msg = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 256,
    messages: [{ role: 'user', content: `Rank these Toronto events from biggest/most prominent to smallest. Return ONLY a JSON array of the original index numbers in ranked order, e.g. [2,0,3,1]. No explanation.\n\n${list}` }],
  });
  const raw = msg.content[0].text.trim().replace(/^```json|```$/g, '').trim();
  try {
    const order = JSON.parse(raw);
    return order.map(i => events[i]);
  } catch {
    console.warn('  ⚠ Could not parse ranking, keeping original order.');
    return events;
  }
}

async function findHandles(events) {
  const handles = {};
  events.forEach((e, i) => { if (e.instagramHandle) handles[String(i)] = e.instagramHandle; });
  const missing = events.map((e, i) => ({ i, e })).filter(({ i }) => !handles[String(i)]);
  if (missing.length > 0) {
    const client = new Anthropic({ apiKey: ANTHROPIC_API_KEY });
    const list = missing.map(({ i, e }) => `${i}: ${e.title} | venue: ${e.venue}`).join('\n');
    const msg = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 512,
      messages: [{ role: 'user', content: `Find Instagram handles for these Toronto events/artists. Return ONLY a JSON object mapping index (string) to "@handle" or null if unsure. Example: {"0": "@dowestfest", "1": null}\n\n${list}` }],
    });
    const jsonMatch = msg.content[0].text.trim().match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try {
        const parsed = JSON.parse(jsonMatch[0]);
        for (const [k, v] of Object.entries(parsed)) { if (v) handles[k] = v; }
      } catch { console.warn('  ⚠ Could not parse handles response.'); }
    }
  }
  if (!DRY_RUN) {
    await Promise.allSettled(
      Object.entries(handles)
        .filter(([i, h]) => !events[+i]?.instagramHandle && h)
        .map(([i, h]) => sanity.patch(events[+i]._id).set({ instagramHandle: h }).commit())
    );
  }
  return handles;
}

async function makeImagePublicUrl(buffer, suffix = '') {
  const filename = `roundup-${WINDOW}${suffix}-${Date.now()}.png`;
  const asset    = await sanity.assets.upload('image', buffer, { filename, contentType: 'image/png' });
  return `${asset.url}?w=1080&fm=jpg`;
}

// ---------------------------------------------------------------------------

async function main() {
  console.log(`\n📅 Roundup poster — window: ${WINDOW} · format: ${FORMAT}${DRY_RUN ? ' (DRY RUN)' : ''}\n`);

  const bounds    = getWindowBounds(WINDOW);
  const dateLabel = formatWindowLabel(WINDOW, bounds);
  console.log(`  Window: ${bounds.start} → ${bounds.end}`);

  const raw    = await fetchWindowEvents(bounds);
  const events = raw
    .map(e => ({ ...e, title: stripYear(e.title) }))
    .filter(e => !EXCLUDE.some(ex => e.title.toLowerCase().includes(ex)))
    .filter(e => !ONLY_FESTIVAL || e.title.toLowerCase().includes(ONLY_FESTIVAL));

  if (events.length === 0) {
    console.log('No events found for this window.\n');
    return;
  }

  console.log(`\nFound ${events.length} event(s):`);
  events.forEach(e => console.log(`  · [${e._source}] ${e.title}`));

  console.log('\nRanking by prominence…');
  const ranked = await rankEvents(events);
  ranked.forEach(e => console.log(`  · ${e.title}`));

  console.log('\nLooking up handles…');
  const handles    = await findHandles(ranked);
  const foundCount = Object.keys(handles).length;
  console.log(`  Found ${foundCount} handle(s)${foundCount ? ': ' + Object.values(handles).join(', ') : ''}`);

  // ── Single-festival mode: one slide per day ──────────────────────────────
  const singleFestival = ranked.length === 1 && ranked[0]._source === 'festival';

  let allBufs;
  let caption;

  if (singleFestival) {
    const festival   = ranked[0];
    const performers = await fetchPerformers(festival._id, 'festival', bounds);
    caption          = buildFestivalCaption(festival, performers, WINDOW);

    // Group performers by calendar day
    const byDay = new Map();
    for (const p of performers) {
      const key = new Date(p.dateTime).toDateString();
      if (!byDay.has(key)) byDay.set(key, []);
      byDay.get(key).push(p);
    }

    console.log(`\nBuilding per-day slides (${byDay.size} day(s))…`);
    allBufs = [];
    for (const [day, dayPerfs] of byDay) {
      allBufs.push(renderFestivalDayImage(festival, dayPerfs, FORMAT, WINDOW));
      console.log(`  · ${day}: ${dayPerfs.length} performer(s)`);
    }
  } else {
    // ── Overview + one detail per event ──────────────────────────────────
    const overviewBuf = renderWeekendImage(ranked, FORMAT, 1, 1, MAX_PER_PAGE, dateLabel, WINDOW);
    caption           = buildWeekendCaption(ranked, handles, WINDOW);

    console.log('\nBuilding detail slides…');
    const detailBufs = [];
    for (const event of ranked) {
      if (event._source === 'standalone') {
        detailBufs.push(renderEventImage(event, FORMAT));
        console.log(`  · standalone: ${event.title}`);
      } else {
        const performers = await fetchPerformers(event._id, event._source, bounds);
        detailBufs.push(renderEventImage(event, FORMAT, performers, WINDOW));
        console.log(`  · ${event._source}: ${event.title} (${performers.length} performers)`);
      }
    }
    allBufs = [overviewBuf, ...detailBufs];
  }

  const totalSlides = allBufs.length;

  console.log(`\n${totalSlides} slide(s) total.`);
  console.log('\nCaption preview:\n' + caption.split('\n').map(l => `  ${l}`).join('\n'));

  if (DRY_RUN) {
    for (const [i, buffer] of allBufs.entries()) {
      const label   = i === 0 ? 'overview' : `detail-${i}`;
      const outPath = join(tmpdir(), `roundup-${WINDOW}-${label}.png`);
      writeFileSync(outPath, buffer);
      console.log(`\n[DRY RUN] Slide ${i + 1}/${totalSlides} written to ${outPath}`);
      await postImageToDiscord(buffer, `roundup-${WINDOW}-${label}.png`, i === 0 ? caption : `(slide ${i + 1}: ${ranked[i - 1]?.title ?? ''})`);
    }
    console.log('\n[DRY RUN] All slides sent to Discord.');
    console.log('\n✅ Done (dry run).\n');
    return;
  }

  const imageUrls = await Promise.all(allBufs.map((buf, i) => makeImagePublicUrl(buf, `-${i + 1}`)));

  const results = await Promise.allSettled([
    postCarouselToInstagram(imageUrls, caption),
    postAlbumToFacebook(imageUrls, caption),
  ]);

  results.forEach((r, i) => {
    if (r.status === 'rejected') console.error(`  ✗ ${i === 0 ? 'Instagram' : 'Facebook'} failed: ${r.reason.message}`);
    else console.log(`  ✓ ${i === 0 ? 'Instagram' : 'Facebook'}`);
  });

  await postImageToDiscord(allBufs[0], `roundup-${WINDOW}.png`, caption);
  console.log('  ✓ Discord');
  console.log('\n✅ Done.\n');
}

main().catch(err => { console.error(err); process.exit(1); });
