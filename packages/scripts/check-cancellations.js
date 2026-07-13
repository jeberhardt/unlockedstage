#!/usr/bin/env node
// scripts/check-cancellations.js
// ---------------------------------------------------------------------------
// Uses Claude + web_search to check upcoming events for cancellation,
// postponement, or closure announcements — venue/organizer websites, their
// Instagram/Facebook/X posts, and Toronto weather-cancellation news.
//
// Safe by default: this only REPORTS findings (console + Discord). It never
// writes to Sanity unless you pass --apply, and even then only high-confidence
// findings get flagged `cancelled = true`. Medium/low-confidence findings are
// always left for manual review — an AI web search is not a reliable enough
// signal on its own to tell the public a free show is cancelled.
//
// Once an event is flagged `cancelled` (here or by hand in Studio), run
// post-cancelled-events.js to alert followers.
//
// Usage:
//   node scripts/check-cancellations.js                     # check today's events, report only
//   node scripts/check-cancellations.js --apply              # also mark high-confidence hits cancelled in Sanity
//   node scripts/check-cancellations.js --window tomorrow
//   node scripts/check-cancellations.js --window weekend
//   node scripts/check-cancellations.js --dry-run             # no Sanity writes, no Discord post
// ---------------------------------------------------------------------------

import Anthropic from '@anthropic-ai/sdk';
import { sanity } from '../lib/sanity.js';
import { ANTHROPIC_API_KEY } from '../lib/config.js';
import { postCancellationCheckSummary } from '../lib/discord.js';

const DRY_RUN = process.argv.includes('--dry-run');
const APPLY   = process.argv.includes('--apply');
const WINDOW  = process.argv.includes('--window')
  ? process.argv[process.argv.indexOf('--window') + 1]
  : 'today';

const client = new Anthropic({ apiKey: ANTHROPIC_API_KEY });
const TZ     = 'America/Toronto';

// ---------------------------------------------------------------------------
// Return {start, end} ISO strings for the requested window in Toronto time.
// ---------------------------------------------------------------------------
function getWindowBounds(window) {
  const now = new Date();

  const todayStr  = now.toLocaleDateString('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' });
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
    const toMon = dayNum === 0 ? -6 : 1 - dayNum;
    const mon = new Date(Date.UTC(y, m - 1, d + toMon));
    const sun = new Date(Date.UTC(y, m - 1, d + toMon + 6));
    return { start: iso(mon, '00:00:00'), end: iso(sun, '23:59:59') };
  }
  throw new Error(`Unknown window: ${window}`);
}

// ---------------------------------------------------------------------------
// Fetch candidate performances/festivals in the window, not already cancelled
// ---------------------------------------------------------------------------
async function fetchCandidates({ start, end }) {
  return sanity.fetch(`
    *[(_type == "performance" || _type == "festival") && cancelled != true && dateTime >= $start && dateTime <= $end]
    | order(dateTime asc) {
      _id, _type, title, artist, venue, neighbourhood, dateTime, externalLink,
      "parentTitle": coalesce(festival->title, series->title),
      "parentLink":  coalesce(festival->externalLink, series->externalLink),
      "parentIG":    coalesce(festival->instagramHandle, series->instagramHandle),
      "parentFB":    coalesce(festival->facebookHandle, series->facebookHandle),
    }
  `, { start, end });
}

// ---------------------------------------------------------------------------
// Ask Claude to research a single event's cancellation status
// ---------------------------------------------------------------------------
async function checkCancellation(event) {
  const name     = event.title || event.artist;
  const link     = event.externalLink || event.parentLink;
  const handles  = [event.parentIG, event.parentFB].filter(Boolean).join(' / ');
  const dateLabel = new Intl.DateTimeFormat('en-CA', {
    timeZone: TZ, weekday: 'long', month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true,
  }).format(new Date(event.dateTime));

  const prompt = `
You are checking whether a specific live music event has been cancelled, postponed, or called off.

Event: ${name}${event.parentTitle ? ` (part of ${event.parentTitle})` : ''}
Venue: ${event.venue}, ${event.neighbourhood}, Toronto
Scheduled: ${dateLabel}
${link ? `Event/venue link: ${link}` : ''}
${handles ? `Social handles: ${handles}` : ''}

Use web_search to look for a cancellation, postponement, or closure announcement specific to
THIS event — check the venue or organizer's website, their Instagram/Facebook/X posts, and any
Toronto weather-related event cancellation news for today. Do not assume cancellation just
because weather is bad generally somewhere — look for a statement specific to this event or venue.

Return ONLY raw JSON, no markdown: { "cancelled": boolean, "confidence": "high"|"medium"|"low", "evidence": string }
"evidence" should be a short quote or URL supporting your answer, or "" if cancelled is false.
  `.trim();

  const msg = await client.messages.create({
    model:      'claude-sonnet-5',
    max_tokens: 1024,
    tools:      [{ type: 'web_search_20250305', name: 'web_search' }],
    messages:   [{ role: 'user', content: prompt }],
  });

  const allText   = msg.content.filter(b => b.type === 'text').map(b => b.text).join('\n');
  const jsonMatch = allText.match(/\{[\s\S]*\}/);
  try {
    const parsed = JSON.parse(jsonMatch ? jsonMatch[0] : allText);
    return {
      cancelled:  !!parsed.cancelled,
      confidence: ['high', 'medium', 'low'].includes(parsed.confidence) ? parsed.confidence : 'low',
      evidence:   parsed.evidence ?? '',
    };
  } catch {
    console.warn(`  ⚠ Could not parse Claude response for ${name}`);
    return { cancelled: false, confidence: 'low', evidence: '' };
  }
}

// ---------------------------------------------------------------------------

async function main() {
  console.log(`\n🔎 Cancellation check — window: ${WINDOW}${DRY_RUN ? ' (DRY RUN)' : ''}${APPLY ? ' (--apply)' : ''}\n`);

  const bounds     = getWindowBounds(WINDOW);
  const candidates = await fetchCandidates(bounds);
  console.log(`  ${candidates.length} event(s) to check.\n`);

  if (candidates.length === 0) {
    console.log('Nothing to check.\n');
    return;
  }

  const findings = [];

  for (const event of candidates) {
    const name = event.title || event.artist;
    console.log(`→ ${name} @ ${event.venue}`);
    const result = await checkCancellation(event);
    if (result.cancelled) {
      console.log(`  ⚠ Possibly cancelled [${result.confidence}]${result.evidence ? ` — ${result.evidence}` : ''}`);
      findings.push({ event, ...result });
    } else {
      console.log('  ✓ No cancellation found');
    }
  }

  const highConfidence = findings.filter(f => f.confidence === 'high');
  const needsReview     = findings.filter(f => f.confidence !== 'high');

  console.log(`\n${findings.length} possible cancellation(s): ${highConfidence.length} high-confidence, ${needsReview.length} need manual review.`);

  if (needsReview.length > 0) {
    console.log('\nNeeds manual review (confidence too low to auto-flag):');
    needsReview.forEach(f => console.log(`  · [${f.confidence}] ${f.event.title || f.event.artist} — ${f.evidence || '(no evidence given)'}`));
  }

  if (highConfidence.length > 0) {
    if (APPLY && !DRY_RUN) {
      console.log('\nMarking high-confidence findings as cancelled in Sanity…');
      await Promise.allSettled(highConfidence.map(f => sanity.patch(f.event._id).set({ cancelled: true }).commit()));
      highConfidence.forEach(f => console.log(`  ✓ ${f.event.title || f.event.artist}`));
      console.log('\nRun post-cancelled-events.js to alert followers.');
    } else {
      console.log('\nHigh-confidence findings (re-run with --apply to flag these `cancelled` in Sanity):');
      highConfidence.forEach(f => console.log(`  · ${f.event.title || f.event.artist} — ${f.evidence}`));
    }
  }

  if (!DRY_RUN) {
    try {
      await postCancellationCheckSummary(findings);
    } catch (err) {
      console.warn(`⚠ Discord summary failed: ${err.message}`);
    }
  }

  console.log('\n✅ Done.\n');
}

main().catch(err => { console.error(err); process.exit(1); });
