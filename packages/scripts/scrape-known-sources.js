#!/usr/bin/env node
// scripts/scrape-known-sources.js
// ---------------------------------------------------------------------------
// Fetches active source documents from Sanity, scrapes each page for events,
// dedupes against existing events, and publishes new ones.
//
// Usage:
//   node scripts/scrape-known-sources.js
//   node scripts/scrape-known-sources.js --dry-run
// ---------------------------------------------------------------------------

import Anthropic from '@anthropic-ai/sdk';
import * as cheerio from 'cheerio';
import { fetchSources, fetchExistingLinks, sanity } from '../lib/sanity.js';
import { ANTHROPIC_API_KEY, VALID_GENRES } from '../lib/config.js';
import { postScrapeSummary } from '../lib/discord.js';

const DRY_RUN = process.argv.includes('--dry-run');
const client  = new Anthropic({ apiKey: ANTHROPIC_API_KEY });

const THIN_CONTENT_THRESHOLD = 3000;

function extractText(html) {
  const $ = cheerio.load(html);
  $('script, style, nav, footer, iframe, noscript').remove();
  return $('body').text().replace(/\s+/g, ' ').trim().slice(0, 12000);
}

async function fetchPageTextWithPuppeteer(url) {
  const { default: puppeteer } = await import('puppeteer');
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });
  try {
    const page = await browser.newPage();
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });

    // Some calendars (e.g. Tockify) fire additional requests after networkidle2
    // and render content asynchronously. Wait up to 10s for meaningful text to appear.
    await page.waitForFunction(
      min => document.body.innerText.replace(/\s+/g, ' ').trim().length > min,
      { timeout: 10000 },
      THIN_CONTENT_THRESHOLD,
    ).catch(() => {}); // proceed even if content stays thin

    const html = await page.content();
    return extractText(html);
  } finally {
    await browser.close();
  }
}

async function fetchTockifyText(url) {
  const calname = url.match(/tockify\.com\/([^/?#]+)/)?.[1];
  if (!calname) throw new Error(`Cannot extract Tockify calendar name from ${url}`);

  const res    = await fetch(`https://tockify.com/api/ngevent?calname=${calname}&max=100`, {
    headers: { 'User-Agent': 'UnlockedStage-Bot/1.0' },
  });
  const json   = await res.json();
  const events = json?.events ?? [];

  return events.map(e => {
    const title = e.content?.summary?.text     ?? '';
    const desc  = e.content?.description?.text ?? '';
    const start = e.when?.start?.millis ? new Date(e.when.start.millis).toISOString() : '';
    const link  = `https://tockify.com/${calname}/detail/${e.eid?.uid}/${e.eid?.tid}`;
    return `Event: ${title}\nDate: ${start}\nDescription: ${desc}\nLink: ${link}`;
  }).join('\n\n');
}

async function fetchPageText(url) {
  if (url.includes('tockify.com')) {
    console.log('  → Tockify API…');
    return fetchTockifyText(url);
  }

  const res  = await fetch(url, { headers: { 'User-Agent': 'UnlockedStage-Bot/1.0' } });
  const html = await res.text();
  const text = extractText(html);
  if (text.length < THIN_CONTENT_THRESHOLD) {
    console.log('  ↩ Static fetch returned thin content, retrying with Puppeteer…');
    return fetchPageTextWithPuppeteer(url);
  }
  return text;
}

async function extractEvents(pageText, source) {
  const today  = new Date().toISOString().slice(0, 10);
  const prompt = `
You are extracting live music / performance events from a scraped web page.
Source URL: ${source.url}
Default venue if not specified: "${source.venue}"
Default neighbourhood if not specified: "${source.neighbourhood}"

Extract every distinct upcoming event and return a JSON array.
Each event object must have:
  - artist:           string (performer or event name)
  - genre:            one of: ${VALID_GENRES.join(', ')}
  - dateTime:         ISO 8601 string (Toronto timezone: -05:00 or -04:00 depending on DST)
  - venue:            string
  - neighbourhood:    string
  - externalLink:     string (full URL to the specific event page, or source URL as fallback)
  - notes:            string (description, price, anything useful — optional)
  - instagramHandle:  string (Instagram handle if found on the page, e.g. "@dowestfest" — omit if not present)
  - facebookHandle:   string (Facebook handle if found on the page — omit if not present)
  - schedule:         array of {startTime, endTime} ISO 8601 strings for multi-day events (one entry per day). Omit for single-day events or when times are unknown.

Rules:
- Only include events after ${today}. Skip past events and undated listings.
- Only include FREE events. Skip any event that requires a ticket purchase or has an admission fee.
- If genre is unclear, use "other".
- Return ONLY the raw JSON array, no markdown, no explanation.

Page content:
${pageText}
  `.trim();

  const msg = await client.messages.create({
    model:      'claude-sonnet-4-20250514',
    max_tokens: 4096,
    messages:   [{ role: 'user', content: prompt }],
  });

  const raw = msg.content[0].text.trim().replace(/^```json|```$/g, '').trim();
  try { return JSON.parse(raw); }
  catch { console.warn(`  ⚠ Could not parse JSON for ${source.url}`); return []; }
}

async function main() {
  console.log('\n🔍 Fetching sources from Sanity…');
  const sources = await fetchSources();
  console.log(`   ${sources.length} active source(s) found.\n`);

  if (sources.length === 0) {
    console.log('No active sources in Sanity. Add source documents via the Studio.\n');
    return;
  }

  const existingLinks = await fetchExistingLinks();
  console.log(`   ${existingLinks.size} events already in Sanity.\n`);

  let totalNew = 0;
  const newEventNames = [];

  for (const source of sources) {
    console.log(`→ ${source.venue}`);
    console.log(`  ${source.url}`);

    let pageText;
    try {
      pageText = await fetchPageText(source.url);
    } catch (err) {
      console.error(`  ✗ Fetch failed: ${err.message}`);
      continue;
    }

    const events    = await extractEvents(pageText, source);
    const newEvents = events.filter(e => !existingLinks.has(e.externalLink));
    console.log(`  ${events.length} event(s) on page, ${newEvents.length} new.\n`);

    for (const event of newEvents) {
      const doc = {
        _type:           'event',
        artist:          event.artist,
        genre:           VALID_GENRES.includes(event.genre) ? event.genre : 'other',
        dateTime:        event.dateTime,
        venue:           event.venue,
        neighbourhood:   event.neighbourhood,
        externalLink:    event.externalLink,
        notes:           event.notes ?? '',
        ...(event.instagramHandle ? { instagramHandle: event.instagramHandle } : {}),
        ...(event.facebookHandle  ? { facebookHandle:  event.facebookHandle  } : {}),
        ...(event.schedule?.length ? { schedule: event.schedule.map(s => ({ _type: 'object', startTime: s.startTime, endTime: s.endTime })) } : {}),
      };

      if (DRY_RUN) {
        console.log('  [DRY RUN]', JSON.stringify(doc, null, 2));
        continue;
      }

      try {
        await sanity.create(doc);
        existingLinks.add(event.externalLink);
        totalNew++;
        newEventNames.push(`${event.artist} @ ${event.venue}`);
        console.log(`  ✓ Published: ${event.artist} @ ${event.venue}`);
      } catch (err) {
        console.error(`  ✗ Failed to publish ${event.artist}: ${err.message}`);
      }
    }
  }

  console.log(`\n✅ Done. ${totalNew} new event(s) published.\n`);

  if (!DRY_RUN) {
    try {
      await postScrapeSummary(newEventNames);
    } catch (err) {
      console.warn(`⚠ Discord summary failed: ${err.message}`);
    }
  }
}

main().catch(err => { console.error(err); process.exit(1); });
