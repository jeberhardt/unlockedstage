#!/usr/bin/env node
// scripts/post-weekend-roundup.js
// ---------------------------------------------------------------------------
// Fetches all events for the upcoming weekend (Fri–Sun) and posts a roundup
// to Instagram and Facebook.  Only event titles are shown — no times, no
// venues.  If there are more events than fit on one image, multiple images
// are posted as a carousel / album.
//
// Usage:
//   node scripts/post-weekend-roundup.js              # post to IG + FB
//   node scripts/post-weekend-roundup.js --dry-run    # render only + Discord preview
//   node scripts/post-weekend-roundup.js --format story
// ---------------------------------------------------------------------------

import { writeFileSync }             from 'node:fs';
import { tmpdir }                    from 'node:os';
import { join }                      from 'node:path';
import Anthropic                     from '@anthropic-ai/sdk';
import { sanity }                    from '../lib/sanity.js';
import { renderWeekendImage }        from '../lib/render-image.js';
import { buildWeekendCaption }       from '../lib/captions.js';
import { postImageToDiscord }        from '../lib/discord.js';
import { postToInstagram,
         postCarouselToInstagram }   from './social/instagram.js';
import { postToFacebook,
         postAlbumToFacebook }       from './social/facebook.js';
import { ANTHROPIC_API_KEY }         from '../lib/config.js';

const DRY_RUN      = process.argv.includes('--dry-run');
const FORMAT       = process.argv.includes('--format') && process.argv[process.argv.indexOf('--format') + 1] === 'story'
  ? 'story' : 'square';
const MAX_PER_PAGE = 8;

// ---------------------------------------------------------------------------
// Return ISO start/end strings bracketing this weekend (Fri 00:00 – Sun 23:59)
// in America/Toronto time.
// ---------------------------------------------------------------------------
function getWeekendBounds() {
  const TZ  = 'America/Toronto';
  const now = new Date();

  // Day of week in Toronto (0=Sun … 6=Sat)
  const shortDay = now.toLocaleDateString('en-CA', { weekday: 'short', timeZone: TZ });
  const dayNum   = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 }[shortDay];

  // Days from today to this weekend's Friday (negative = already past Friday)
  const toFri = dayNum === 0 ? -2 : 5 - dayNum;

  // Today's calendar date in Toronto (returns "YYYY-MM-DD" for en-CA)
  const todayStr = now.toLocaleDateString('en-CA', {
    timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit',
  });
  const [y, m, d] = todayStr.split('-').map(Number);

  // Toronto UTC offset string, e.g. "GMT-4" → "-04:00"
  const tzPart    = new Intl.DateTimeFormat('en-US', { timeZone: TZ, timeZoneName: 'shortOffset' })
    .formatToParts(now).find(p => p.type === 'timeZoneName').value;
  const offsetH   = parseInt(tzPart.replace('GMT', ''), 10) || 0;
  const sign      = offsetH <= 0 ? '-' : '+';
  const offsetStr = `${sign}${String(Math.abs(offsetH)).padStart(2, '0')}:00`;

  const friDate = new Date(Date.UTC(y, m - 1, d + toFri));
  const sunDate = new Date(Date.UTC(y, m - 1, d + toFri + 2));
  const iso     = (date, time) => `${date.toISOString().slice(0, 10)}T${time}${offsetStr}`;

  return { start: iso(friDate, '00:00:00'), end: iso(sunDate, '23:59:59') };
}

// ---------------------------------------------------------------------------
function formatWeekendLabel(start, end) {
  const TZ     = 'America/Toronto';
  const months = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];

  function monthDay(iso) {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: TZ, month: '2-digit', day: 'numeric',
    }).formatToParts(new Date(iso));
    return {
      month: +parts.find(p => p.type === 'month').value,
      day:   +parts.find(p => p.type === 'day').value,
    };
  }

  const fri = monthDay(start);
  const sun = monthDay(end);
  return fri.month === sun.month
    ? `${months[fri.month - 1]} ${fri.day} – ${sun.day}`
    : `${months[fri.month - 1]} ${fri.day} – ${months[sun.month - 1]} ${sun.day}`;
}

function stripYear(name) {
  return name.replace(/\s+20\d{2}/, '').replace(/\s+'?\d{2}\b/, '').trim();
}

// If the event notes start with a series name (e.g. "Spring Live Music Series - …"),
// return "{shortened venue}: {series name}", otherwise return the venue as-is.
function venueGroupTitle(venue, notes) {
  const series = (notes ?? '').match(/^(.+?(?:Series|Festival)\b[^.\-]*)(?:\s*[-.])/i)?.[1].trim();
  if (!series) return venue;
  const short = venue.replace(/\s+(Historic\s+District|BIA|Centre|Center|District)\b.*$/i, '').trim();
  return `${short}: ${series}`;
}

// ---------------------------------------------------------------------------
async function fetchWeekendEvents({ start, end }) {
  console.log(`  Querying events from ${start} to ${end}`);

  const events = await sanity.fetch(`
    *[_type == "event" && dateTime >= $start && dateTime <= $end] | order(dateTime asc) {
      _id, title, artist, genre, dateTime, venue, notes, instagramHandle, facebookHandle
    }
  `, { start, end });

  // Collapse title-less events that share a venue into one entry using the
  // venue name as the title (e.g. six Access Fest performers → "Access Fest").
  // Single-performer venues and titled events are kept as-is.
  const venueCounts = new Map();
  for (const e of events) {
    if (!e.title) venueCounts.set(e.venue, (venueCounts.get(e.venue) ?? 0) + 1);
  }

  const seenTitles = new Set();
  const seenVenues = new Set();
  const result = [];

  for (const e of events) {
    if (e.title) {
      if (!seenTitles.has(e.title)) { seenTitles.add(e.title); result.push({ ...e, title: stripYear(e.title) }); }
    } else if ((venueCounts.get(e.venue) ?? 0) > 1) {
      if (!seenVenues.has(e.venue)) { seenVenues.add(e.venue); result.push({ ...e, title: stripYear(venueGroupTitle(e.venue, e.notes)) }); }
    } else {
      result.push({ ...e, artist: stripYear(e.artist) });
    }
  }

  return result;
}

// ---------------------------------------------------------------------------
// Rank events from biggest to smallest using Claude.
// ---------------------------------------------------------------------------
async function rankEvents(events) {
  const client = new Anthropic({ apiKey: ANTHROPIC_API_KEY });

  const list = events.map((e, i) =>
    `${i}: ${e.title || e.artist} | venue: ${e.venue} | notes: ${e.notes ?? ''}`
  ).join('\n');

  const msg = await client.messages.create({
    model:      'claude-sonnet-4-6',
    max_tokens: 256,
    messages:   [{
      role:    'user',
      content: `Rank these Toronto weekend events from biggest/most prominent to smallest.
Consider: multi-day festivals, audience capacity, headline artist fame, long-running annual events.
Return ONLY a JSON array of the original index numbers in ranked order, e.g. [2,0,3,1].
No explanation.

${list}`,
    }],
  });

  const raw = msg.content[0].text.trim().replace(/^```json|```$/g, '').trim();
  try {
    const order = JSON.parse(raw);
    return order.map(i => events[i]);
  } catch {
    console.warn('  ⚠ Could not parse ranking response, keeping original order.');
    return events;
  }
}

// ---------------------------------------------------------------------------
// Build a handles map for the ranked events.
// Uses instagramHandle stored in Sanity where available; asks Claude for the
// rest, then writes any newly found handles back to Sanity.
// Returns an object mapping event index → "@handle".
// ---------------------------------------------------------------------------
async function findHandles(events) {
  const handles = {};

  // Seed from Sanity
  events.forEach((e, i) => {
    if (e.instagramHandle) handles[String(i)] = e.instagramHandle;
  });

  // Which events still need a handle?
  const missing = events
    .map((e, i) => ({ i, e }))
    .filter(({ i, e }) => !handles[String(i)]);

  if (missing.length > 0) {
    const client = new Anthropic({ apiKey: ANTHROPIC_API_KEY });
    const list = missing.map(({ i, e }) =>
      `${i}: ${e.title || e.artist} | venue: ${e.venue}`
    ).join('\n');

    const msg = await client.messages.create({
      model:      'claude-sonnet-4-6',
      max_tokens: 512,
      messages:   [{
        role:    'user',
        content: `Find the Instagram handles for these Toronto events, festivals, or artists.
Return ONLY a JSON object mapping index (as string) to "@handle", or null if you are not confident.
Example: {"0": "@dowestfest", "1": null, "2": "@luminatofestival"}
Only include handles you are highly confident are correct and currently active. Return null for anything uncertain.

${list}`,
      }],
    });

    const raw      = msg.content[0].text.trim();
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try {
        const parsed = JSON.parse(jsonMatch[0]);
        for (const [key, val] of Object.entries(parsed)) {
          if (val) handles[key] = val;
        }
      } catch {
        console.warn('  ⚠ Could not parse handles response.');
      }
    }
  }

  // Write any Claude-found handles back to Sanity for future use
  if (!DRY_RUN) {
    await Promise.allSettled(
      Object.entries(handles)
        .filter(([i, h]) => !events[+i]?.instagramHandle && h)
        .map(([i, h]) =>
          sanity.patch(events[+i]._id).set({ instagramHandle: h }).commit()
        )
    );
  }

  return handles;
}

// ---------------------------------------------------------------------------
function chunkEvents(events) {
  const pages = [];
  for (let i = 0; i < events.length; i += MAX_PER_PAGE) {
    pages.push(events.slice(i, i + MAX_PER_PAGE));
  }
  return pages;
}

// ---------------------------------------------------------------------------
async function makeImagePublicUrl(buffer, suffix = '') {
  const filename = `weekend-roundup${suffix}-${Date.now()}.png`;
  const asset    = await sanity.assets.upload('image', buffer, { filename, contentType: 'image/png' });
  return `${asset.url}?w=1080&fm=jpg`;
}

// ---------------------------------------------------------------------------
async function main() {
  console.log(`\n📅 Weekend roundup poster — format: ${FORMAT}${DRY_RUN ? ' (DRY RUN)' : ''}\n`);

  const bounds    = getWeekendBounds();
  const events    = await fetchWeekendEvents(bounds);
  const dateLabel = formatWeekendLabel(bounds.start, bounds.end);

  if (events.length === 0) {
    console.log('No events found for this weekend.\n');
    return;
  }

  console.log(`Found ${events.length} event(s), ranking by prominence…`);
  const ranked = await rankEvents(events);
  ranked.forEach(e => console.log(`  · ${e.title || e.artist}`));

  console.log('\n  Looking up social handles…');
  const handles = await findHandles(ranked);
  const foundCount = Object.keys(handles).length;
  console.log(`  Found ${foundCount} handle(s)${foundCount ? ': ' + Object.values(handles).join(', ') : ''}`);

  const pages      = chunkEvents(ranked);
  const totalPages = pages.length;
  const buffers    = pages.map((chunk, i) =>
    renderWeekendImage(chunk, FORMAT, i + 1, totalPages, MAX_PER_PAGE, dateLabel)
  );
  const caption    = buildWeekendCaption(ranked, handles);

  console.log(`\n  ${totalPages} image(s) to post.`);
  console.log('\n  Caption preview:\n' + caption.split('\n').map(l => `    ${l}`).join('\n'));

  if (DRY_RUN) {
    for (const [i, buffer] of buffers.entries()) {
      const outPath = join(tmpdir(), `weekend-roundup-preview-${i + 1}.png`);
      writeFileSync(outPath, buffer);
      console.log(`\n  [DRY RUN] Image ${i + 1}/${totalPages} written to ${outPath}`);
      await postImageToDiscord(buffer, `weekend-roundup-preview-${i + 1}.png`, i === 0 ? caption : `(slide ${i + 1})`);
    }
    console.log('  [DRY RUN] Image(s) sent to Discord.');
    console.log('\n✅ Done (dry run).\n');
    return;
  }

  // Upload all images in parallel
  const imageUrls = await Promise.all(
    buffers.map((buf, i) => makeImagePublicUrl(buf, totalPages > 1 ? `-${i + 1}` : ''))
  );

  const results = await Promise.allSettled([
    totalPages === 1
      ? postToInstagram(imageUrls[0], caption)
      : postCarouselToInstagram(imageUrls, caption),
    totalPages === 1
      ? postToFacebook(imageUrls[0], caption)
      : postAlbumToFacebook(imageUrls, caption),
  ]);

  results.forEach((r, i) => {
    if (r.status === 'rejected') {
      console.error(`  ✗ ${i === 0 ? 'Instagram' : 'Facebook'} failed: ${r.reason.message}`);
    }
  });

  console.log('\n✅ Done.\n');
}

main().catch(err => { console.error(err); process.exit(1); });
