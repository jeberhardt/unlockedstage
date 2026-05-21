import { DISCORD_WEBHOOK_URL } from './config.js';

export async function postScrapeSummary(eventNames) {
  const content = eventNames.length === 0
    ? '**Scrape complete** — no new events found.'
    : `**${eventNames.length} new event${eventNames.length === 1 ? '' : 's'} added**\n${eventNames.map(name => `• ${name}`).join('\n')}`;
  const res = await fetch(DISCORD_WEBHOOK_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Discord webhook: ${res.status} ${err}`);
  }
}
