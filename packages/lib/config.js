// lib/config.js
// ---------------------------------------------------------------------------
// All secrets come from environment variables. Create a .env file locally:
//
//   SANITY_PROJECT_ID=7txzz67e
//   SANITY_DATASET=production
//   SANITY_TOKEN=<your write token from sanity.io/manage>
//   ANTHROPIC_API_KEY=<your key>
//   IG_USER_ID=<instagram business account id>
//   IG_ACCESS_TOKEN=<long-lived page access token>
//   FB_PAGE_ID=<facebook page id>
//   FB_ACCESS_TOKEN=<long-lived page access token>
// ---------------------------------------------------------------------------

import 'node:process';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

// Load .env from the packages directory (works without installing dotenv)
try {
  const __dir = dirname(fileURLToPath(import.meta.url));
  const envPath = resolve(__dir, '..', '.env');
  const lines = readFileSync(envPath, 'utf8').split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const val = trimmed.slice(eq + 1).trim();
    if (!(key in process.env)) process.env[key] = val;
  }
} catch { /* no .env file — rely on real env vars */ }

export const SANITY_PROJECT_ID = process.env.SANITY_PROJECT_ID ?? '7txzz67e';
export const SANITY_DATASET    = process.env.SANITY_DATASET    ?? 'production';
export const SANITY_TOKEN      = process.env.SANITY_TOKEN;
export const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

export const IG_USER_ID      = process.env.IG_USER_ID;
export const IG_ACCESS_TOKEN = process.env.IG_ACCESS_TOKEN;
export const FB_PAGE_ID      = process.env.FB_PAGE_ID;
export const FB_ACCESS_TOKEN = process.env.FB_ACCESS_TOKEN;

export const DISCORD_WEBHOOK_URL = process.env.DISCORD_WEBHOOK_URL;

// Valid genre values matching your Sanity schema
export const VALID_GENRES = [
  'jazz', 'indie', 'classical', 'folk', 'electronic', 'rb', 'pop', 'hiphop', 'other'
];
