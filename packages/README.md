# UnlockedStage Scripts

Three Node.js scripts to automate event discovery → Sanity → social posting.

## Setup

```bash
npm install
cp .env.example .env
# fill in your secrets
```

### `.env`

```
SANITY_PROJECT_ID=7txzz67e
SANITY_DATASET=production
SANITY_TOKEN=          # write token from sanity.io/manage → API → Tokens
ANTHROPIC_API_KEY=     # from console.anthropic.com

# Meta Graph API — see "Getting Meta credentials" below
IG_USER_ID=
IG_ACCESS_TOKEN=
FB_PAGE_ID=
FB_ACCESS_TOKEN=

# Base URL where your server hosts tmp images (for Meta to fetch)
# In production: swap makeImagePublicUrl() for a real S3/R2/Sanity upload
IMAGE_BASE_URL=https://your-server.com/tmp
```

---

## Sanity schema

You need two document types in your Sanity project: `event` (already exists) and `source`.

Add `source` to your schema:

```js
// schemas/source.js
import { defineType, defineField } from 'sanity'
import { LinkIcon } from '@sanity/icons'

export const source = defineType({
  name: 'source',
  title: 'Event Source',
  type: 'document',
  icon: LinkIcon,
  fields: [
    defineField({ name: 'url',           type: 'url',     title: 'Page URL',      validation: r => r.required() }),
    defineField({ name: 'venue',         type: 'string',  title: 'Venue Name',    validation: r => r.required() }),
    defineField({ name: 'neighbourhood', type: 'string',  title: 'Neighbourhood', validation: r => r.required() }),
    defineField({ name: 'description',   type: 'text',    title: 'Description' }),
    defineField({ name: 'active',        type: 'boolean', title: 'Active',        initialValue: true }),
  ],
})
```

Also add `postedToSocial` to your `event` schema:

```js
defineField({ name: 'postedToSocial', type: 'boolean', title: 'Posted to Social', initialValue: false })
```

The 5 initial sources (STACKT Market, COC, TO Live, Tapestry Opera, Hamilton Public Library)
are already seeded in your Sanity production dataset.

---

## Scripts

### 1. `npm run scrape` — Scrape known sources

Queries active `source` documents from Sanity, scrapes each page, extracts events via
Claude, and publishes new ones. Dedupes against `externalLink`.

```bash
npm run scrape
npm run scrape -- --dry-run
```

To add a new source: create a `source` document in Sanity Studio, or ask Claude to do it.

---

### 2. `npm run discover` — Discover new sources

Uses Claude + web_search to find event listing pages not already in Sanity, scrapes them,
and saves both the new source documents and any new events directly to Sanity.

```bash
npm run discover
npm run discover -- --city "Hamilton" --genre "jazz"
npm run discover -- --dry-run
```

---

### 3. `npm run post` — Post to Instagram & Facebook

Fetches unposted events from Sanity, renders a 1080×1080 PNG, and posts to IG + FB
with the event link as the first comment. Marks events as `postedToSocial: true` when done.

```bash
npm run post
npm run post -- --dry-run              # renders image locally, no API calls
npm run post -- --format story         # 1080×1350 story format
npm run post -- --id <sanity-event-id> # post one specific event
```

---

## Getting Meta credentials

1. Go to [developers.facebook.com](https://developers.facebook.com) → My Apps → Create App → Business.
2. Add the **Instagram Graph API** and **Pages API** products.
3. Under **Graph API Explorer**, select your app and your Facebook Page.
4. Request permissions: `instagram_basic`, `instagram_content_publish`, `pages_manage_posts`, `pages_read_engagement`.
5. Generate a long-lived Page Access Token (valid 60 days — set up a cron to refresh it).
6. Get your Instagram Business Account ID:
   ```
   GET /me/accounts → find your page id
   GET /{page-id}?fields=instagram_business_account
   ```

---

## Scheduling with cron

```cron
# Scrape known sources every day at 8am
0 8 * * * cd /path/to/unlocked-scripts && node scripts/scrape-known-sources.js >> logs/scrape.log 2>&1

# Discover new sources every Monday at 9am
0 9 * * 1 cd /path/to/unlocked-scripts && node scripts/discover-new-sources.js >> logs/discover.log 2>&1

# Post to social every day at 10am
0 10 * * * cd /path/to/unlocked-scripts && node scripts/post-to-social.js >> logs/post.log 2>&1
```
