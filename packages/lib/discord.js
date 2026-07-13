import { DISCORD_WEBHOOK_URL } from './config.js';

export async function postImageToDiscord(buffer, filename, caption) {
  const form = new FormData();
  form.append('file', new Blob([buffer], { type: 'image/png' }), filename);
  if (caption) form.append('payload_json', JSON.stringify({ content: caption }));
  const res = await fetch(DISCORD_WEBHOOK_URL, { method: 'POST', body: form });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Discord webhook: ${res.status} ${err}`);
  }
}

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

export async function postCancellationCheckSummary(findings) {
  const content = findings.length === 0
    ? '**Cancellation check** — no possible cancellations found.'
    : `**Cancellation check** — ${findings.length} possible cancellation${findings.length === 1 ? '' : 's'} found\n` +
      findings.map(f => `• [${f.confidence}] ${f.event.title || f.event.artist} @ ${f.event.venue}${f.evidence ? `\n   ${f.evidence}` : ''}`).join('\n');
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
