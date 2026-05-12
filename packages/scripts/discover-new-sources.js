#!/usr/bin/env node
// scripts/discover-new-sources.js
// ---------------------------------------------------------------------------
// Uses Claude + web_search to find event listing pages not already in Sanity,
// scrapes them for events, and saves both the new sources and events to Sanity.
//
// Usage:
//   node scripts/discover-new-sources.js
//   node scripts/discover-new-sources.js --dry-run
//   node scripts/discover-new-sources.js --city "Hamilton" --genre "jazz"
// ---------------------------------------------------------------------------

import Anthropic from '@anthropic-ai/sdk';
import * as cheerio from 'cheerio';
import {
  fetchSources, fetchExistingLinks,
  createAndPublishSource, sanity,
} from '../lib/sanity.js';
import { ANTHROPIC_API_KEY, VALID_GENRES } from '../lib/config.js';

// ---------------------------------------------------------------------------
// CLI args
// ---------------------------------------------------------------------------
const DRY_RUN = process.argv.includes('--dry-run');
const cityArg  = process.argv.find((_, i, a) => a[i - 1] === '--city')  ?? 'Toronto';
const genreArg = process.argv.find((_, i, a) => a[i - 1] === '--genre') ?? null;

const client = new Anthropic({ apiKey: ANTHROPIC_API_KEY });

// ---------------------------------------------------------------------------
// Use Claude + web_search to find new source pages
// ---------------------------------------------------------------------------
async function discoverSourcePages(knownUrls) {
  const genreClause = genreArg ? ` focusing on ${genreArg} music` : '';
  const today       = new Date().toISOString().slice(0, 10);

  const systemPrompt = `
You are a research agent helping discover live music event pages in ${cityArg}${genreClause}.
Today is ${today}.
Use web_search to find event LISTING pages (venue calendars, festival sites, ticketing pages)
that list multiple upcoming events — not individual event pages.
Return a JSON array of objects, each with:
  - url:           string (the event listing page URL)
  - venue:         string (venue or organiser name)
  - neighbourhood: string (area in ${cityArg})
  - description:   string (one sentence about what kind of events this page lists)
Return ONLY the raw JSON array, no markdown, no explanation.
  `.trim();

  const knownList = [...knownUrls].join('\n') || '(none yet)';

  const response = await client.messages.create({
    model:      'claude-sonnet-4-20250514',
    max_tokens: 2000,
    tools: [{ type: 'web_search_20250305', name: 'web_search' }],
    system:   systemPrompt,
    messages: [{
      role:    'user',
      content: `Find live music event listing pages in ${cityArg}${genreClause} NOT already in this list:\n${knownList}`,
    }],
  });

  const textBlocks = response.content.filter(b => b.type === 'text');
  const raw        = textBlocks.at(-1)?.text?.trim().replace(/^```json|```$/g, '').trim() ?? '[]';
  try { return JSON.parse(raw); }
  catch { console.warn('  ⚠ Could not parse source list from Claude.'); return []; }
}

// ---------------------------------------------------------------------------
// Fetch + strip page text
// ---------------------------------------------------------------------------
async function fetchPageText(url) {
  const res  = await fetch(url, { headers: { 'User-Agent': 'UnlockedStage-Bot/1.0' } });
  const html = await res.text();
  const $    = cheerio.load(html);
  $('script, style, nav, footer, iframe, noscript').remove();
  return $('body').text().replace(/\s+/g, ' ').trim().slice(0, 12000);
}

// ---------------------------------------------------------------------------
// Extract events from a page via Claude
// ---------------------------------------------------------------------------
async function extractEventsFromPage(pageText, source) {
  const today  = new Date().toISOString().slice(0, 10);
  const prompt = `
Extract live music / performance events from this page.
Source URL: ${source.url}
Default venue: "${source.venue}"
Default neighbourhood: "${source.neighbourhood}"

Return a JSON array. Each event:
  - artist:        string
  - genre:         one of: ${VALID_GENRES.join(', ')}
  - dateTime:      ISO 8601 (Toronto: -05:00 or -04:00)
  - venue:         string
  - neighbourhood: string
  - externalLink:  string (specific event URL or source URL as fallback)
  - notes:         string (optional)

Only include events after ${today}. Only include FREE events — skip any event with an admission fee or ticket purchase required. Return ONLY raw JSON array.

Page content:
${pageText}
  `.trim();

  const msg = await client.messages.create({
    model:      'claude-sonnet-4-20250514',
    max_tokens: 2000,
    messages:   [{ role: 'user', content: prompt }],
  });

  const raw = msg.content[0].text.trim().replace(/^```json|```$/g, '').trim();
  try { return JSON.parse(raw); }
  catch { return []; }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
  console.log(`\n🌐 Discovering new event sources in ${cityArg}…\n`);

  // Load current state from Sanity
  const existingSources = await fetchSources();
  const knownUrls       = new Set(existingSources.map(s => s.url));
  const existingLinks   = await fetchExistingLinks();

  console.log(`   ${knownUrls.size} known source(s), ${existingLinks.size} existing events in Sanity.\n`);

  // Ask Claude to find new pages
  console.log('→ Asking Claude to search for new event pages…');
  const discovered = await discoverSourcePages(knownUrls);
  const newSources  = discovered.filter(s => !knownUrls.has(s.url));
  console.log(`  Found ${discovered.length} candidate(s), ${newSources.length} are new.\n`);

  if (newSources.length === 0) {
    console.log('No new sources found. Try --city or --genre flags for a more specific search.\n');
    return;
  }

  let totalNewSources = 0;
  let totalNewEvents  = 0;

  for (const source of newSources) {
    console.log(`→ ${source.venue}`);
    console.log(`  ${source.url}`);
    if (source.description) console.log(`  ${source.description}`);

    // Scrape the page
    let pageText;
    try {
      pageText = await fetchPageText(source.url);
    } catch (err) {
      console.error(`  ✗ Fetch failed: ${err.message}`);
      continue;
    }

    const events    = await extractEventsFromPage(pageText, source);
    const newEvents = events.filter(e => !existingLinks.has(e.externalLink));
    console.log(`  ${events.length} event(s) found, ${newEvents.length} new.`);

    if (DRY_RUN) {
      console.log('  [DRY RUN] Would save source to Sanity:', JSON.stringify(source, null, 2));
      newEvents.forEach(e => console.log('  [DRY RUN] Would publish event:', e.artist));
      console.log();
      continue;
    }

    // Save the source to Sanity
    try {
      await createAndPublishSource({
        url:           source.url,
        venue:         source.venue,
        neighbourhood: source.neighbourhood,
        description:   source.description ?? '',
      });
      knownUrls.add(source.url);
      totalNewSources++;
      console.log(`  ✓ Source saved to Sanity.`);
    } catch (err) {
      console.error(`  ✗ Failed to save source: ${err.message}`);
    }

    // Publish new events
    for (const event of newEvents) {
      const doc = {
        _type:         'event',
        artist:        event.artist,
        genre:         VALID_GENRES.includes(event.genre) ? event.genre : 'other',
        dateTime:      event.dateTime,
        venue:         event.venue,
        neighbourhood: event.neighbourhood,
        externalLink:  event.externalLink,
        notes:         event.notes ?? '',
      };

      try {
        await sanity.create(doc);
        existingLinks.add(event.externalLink);
        totalNewEvents++;
        console.log(`  ✓ Published: ${event.artist} @ ${event.venue}`);
      } catch (err) {
        console.error(`  ✗ Failed: ${err.message}`);
      }
    }
    console.log();
  }

  console.log(`✅ Done. ${totalNewSources} new source(s) and ${totalNewEvents} new event(s) saved to Sanity.\n`);
}

main().catch(err => { console.error(err); process.exit(1); });
