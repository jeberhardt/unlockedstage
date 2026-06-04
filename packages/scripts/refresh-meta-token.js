#!/usr/bin/env node
// scripts/refresh-fb-token.js
// ---------------------------------------------------------------------------
// Exchanges a short-lived user token for a never-expiring Page access token
// and writes it back to packages/.env.
//
// Usage:
//   node scripts/refresh-fb-token.js --user-token <short-lived-token>
//
// Get the short-lived token from:
//   developers.facebook.com/tools/explorer → select your app → Generate Access Token
//   (User token, with pages_manage_posts + pages_read_engagement permissions)
// ---------------------------------------------------------------------------

import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname }            from 'node:path';
import { fileURLToPath }               from 'node:url';
import { FB_APP_ID, FB_APP_SECRET, FB_PAGE_ID } from '../lib/config.js';

const GRAPH = 'https://graph.facebook.com/v19.0';

const tokenIndex = process.argv.indexOf('--user-token');
if (tokenIndex === -1 || !process.argv[tokenIndex + 1]) {
  console.error('Usage: node scripts/refresh-fb-token.js --user-token <short-lived-token>');
  process.exit(1);
}
const shortLivedToken = process.argv[tokenIndex + 1];

async function graphGet(path, params) {
  const url = new URL(`${GRAPH}${path}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const res  = await fetch(url.toString());
  const json = await res.json();
  if (json.error) throw new Error(`Meta API error on ${path}: ${JSON.stringify(json.error)}`);
  return json;
}

async function main() {
  console.log('\n1. Exchanging for long-lived user token…');
  const longLived = await graphGet('/oauth/access_token', {
    grant_type:        'fb_exchange_token',
    client_id:         FB_APP_ID,
    client_secret:     FB_APP_SECRET,
    fb_exchange_token: shortLivedToken,
  });
  console.log(`   Long-lived token expires in: ${Math.round(longLived.expires_in / 86400)} days`);

  console.log('\n2. Fetching Page access token…');
  const page = await graphGet(`/${FB_PAGE_ID}`, {
    fields:       'access_token,name',
    access_token: longLived.access_token,
  });
  console.log(`   Page: ${page.name}`);
  console.log(`   Token: ${page.access_token.slice(0, 20)}…`);

  console.log('\n3. Writing FB_ACCESS_TOKEN and IG_ACCESS_TOKEN to .env…');
  const __dir   = dirname(fileURLToPath(import.meta.url));
  const envPath = resolve(__dir, '..', '.env');
  let env = readFileSync(envPath, 'utf8');

  function upsertEnvKey(src, key, value) {
    return src.includes(`${key}=`)
      ? src.replace(new RegExp(`^${key}=.*`, 'm'), `${key}=${value}`)
      : src.trimEnd() + `\n${key}=${value}\n`;
  }

  env = upsertEnvKey(env, 'FB_ACCESS_TOKEN', page.access_token);
  env = upsertEnvKey(env, 'IG_ACCESS_TOKEN', page.access_token);

  writeFileSync(envPath, env);
  console.log('   ✓ .env updated.\n');
  console.log('Done. This Page token does not expire unless you revoke app access.\n');
}

main().catch(err => { console.error(err); process.exit(1); });
