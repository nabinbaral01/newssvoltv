# Volt V

A full-stack editorial publishing platform: a public magazine front end and a
role-gated admin panel with first-party analytics.

Built on the structural lesson from high-volume editorial sites — **category and
content type are two independent axes**. A post is *Movies × Review*, never
"Movie Reviews". Everything downstream (navigation, archives, dashboards, the
sitemap) follows from that.

---

## Quick start

```bash
npm install
cp .env.example .env      # then fill in the secrets — see below
npm run db                # starts a local Postgres 17, leave it running
npm run db:migrate        # apply migrations (first run only)
npm run seed              # ~130 posts, 15 writers, ~46k page views
npm run dev               # http://localhost:3000
```



### The local database

`npm run db` runs a **real PostgreSQL 17** from the `embedded-postgres` package
against `.pgdata/` in the repo — no Docker, no install, no account. It stays in
the foreground; Ctrl-C stops it. In production you point `DATABASE_URL` at Neon
or Supabase and never run it.

The cluster is created with UTF-8 explicitly, because `initdb` otherwise inherits
the host locale (WIN1252 on Windows) and mangles editorial copy.

---

## Environment

| Variable | Required | What it does |
|---|---|---|
| `DATABASE_URL` | yes | Postgres connection string |
| `AUTH_SECRET` | yes | Session JWT signing key (`openssl rand -base64 32`) |
| `AUTH_URL` | prod | Canonical URL for Auth.js callbacks |
| `ANALYTICS_SALT` | yes | HMAC salt for visitor and IP hashing. **Rotating it anonymises all history** — that is the point |
| `CRON_SECRET` | prod | Bearer token for `/api/cron` |
| `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET` | no | Google sign-in. The button is hidden when unset |
| `MEDIA_DRIVER` | no | `local` (default, writes to `public/uploads`) or `s3` |
| `S3_*` | if s3 | Bucket, region, endpoint, keys, public URL |
| `NEXT_PUBLIC_SITE_URL` | prod | Used in canonical URLs, OG tags, sitemap and RSS |

---

## Stack

Next.js 16 (App Router, server components) · TypeScript · Tailwind v4 ·
PostgreSQL via Prisma 6 · Auth.js v5 (credentials + Google, JWT sessions) ·
TipTap 3 · Recharts · d3-geo choropleth · Zod on both sides of every boundary ·
Playwright.

---

## Architecture notes

### Two taxonomy axes

`Category` (Movies, TV, Gaming, …) and `ContentType` (News, Review, List, …) are
separate models. The mega-menu renders categories as columns and content types as
their children; `/[category]/[segment]` resolves `segment` as a content type
first and falls back to a post slug, which is why the two never collide.

### Editorial flags, not a ranking algorithm

`isFeatured`, `isTrending` and `isEditorPick` are manual booleans on `Post`. They
beat a ranking algorithm until there is real traffic to rank on, and they are what
the homepage modules read.

### Caching and revalidation

Homepage modules go through `unstable_cache` with tag-based invalidation. Server
actions call `updateTag()` (read-your-own-writes); the cron route calls
`revalidateTag(tag, 'max')`, since a route handler has no own-write to read back.

`unstable_cache` round-trips its payload through JSON, so `Date` objects come back
as strings on a cache hit. `cachedQuery()` in `src/lib/queries.ts` revives them —
without that, every `.toISOString()` in a card component is a runtime error on the
second request.

### Rendering

`next build` prerenders ~188 pages: every category, every category × content-type
archive, and the 200 most recent articles. Older articles render on first request
and are then cached the same way. Publishing calls `updateTag(POSTS_TAG)`, which
invalidates all of it at once.

The site header reads the session to decide between "Sign In Now" and the account
menu, so the *request* is dynamic even where the page data is cached — the DB is
not touched again, but there is no full-route HTML cache while a session is in
play. Making the header client-rendered would buy static HTML at the cost of a
sign-in flash on every page; the trade went the other way deliberately.

Pagination lives in child components (`CategoryArchive`, `FormatArchive`) rather
than the page body, because reading `searchParams` opts a request out of the
full-route cache and page one should not pay for page two's existence.

### Analytics pipeline

```
client beacon  →  /api/track  →  PageView + VisitSession  →  nightly rollup  →  DailyMetric  →  dashboards
                                        (raw, 14 months)                          (forever)
```

Dashboards **never** scan the raw table. At 50k views a day that is ~18M rows a
year; `DailyMetric` holds one row per `(day, dimension, value)` and every chart
reads it. Raw events are used in exactly three documented places: realtime (last
5 minutes), demographic cross-tabs, and nothing else.

Rebuild rollups by hand with `npm run rollup -- 90`.

### Demographics are a sample, and the UI says so

Age and gender are not observable from web traffic. HTTP requests carry no such
field, and inferring them from browsing behaviour is unreliable and, in the UK and
EU, regulated profiling. `/admin/analytics/demographics` combines three sources and
labels which is which:

1. **Self-declared** — optional birth year and gender on the account. Accurate,
   partial. In the seeded data this covers ~7% of traffic.
2. **Survey** — an on-site poll, reported with its sample size and a 95% margin
   of error.
3. **Panel** — modelled third-party shares (GA4-shaped). Audience-level only, and
   the cross-tab filters disable themselves when it is selected.

Every demographic figure carries a `CoverageBadge`. Below 25% coverage it turns
amber and says so in words. A 7% sample must never be able to look like a census.

### Privacy

- Raw IPs are never written. They are HMAC-hashed on arrival and dropped.
- The consent banner defaults to essential-only; `/api/track` returns 204 without
  storing anything until consent is given — checked server-side, not just client-side.
- Do Not Track and Global Privacy Control are honoured as refusals, and a browser
  sending either is never shown the banner.
- `/api/cron?job=retention` deletes raw events older than 14 months. Rollups, which
  contain no identifiers, are kept.
- `/account` exports everything held about a reader as JSON, and deletes it.
- `/privacy` documents exactly what the code does, including the cookie table.

### Charts

Colour is assigned by job, not by taste. Single-series charts use volt cyan
(`--chart-primary`); categorical series use a fixed six-slot order that was
validated for lightness band, chroma floor, CVD separation and contrast against
**both** surfaces before being written down. Ordered categories (age bands, screen
widths) use a one-hue sequential ramp so the order is visible in the colour.
Every chart has a legend when it has two or more series, a table view, and a CSV
export — identity is never carried by colour alone.

---

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Development server |
| `npm run build` | `prisma generate` then `next build` |
| `npm run db` | Local Postgres (foreground) |
| `npm run db:migrate` | `prisma migrate dev` |
| `npm run db:reset` | Drop, re-migrate, re-seed |
| `npm run seed` | Regenerate all demo data |
| `npm run backup:demo` | Dump the demo data to `.backups/<timestamp>.json` |
| `npm run backup:demo -- --restore <file>` | Put a dump back |
| `npm run reset:demo` | **Dry run** — report what going-live would remove |
| `npm run reset:demo -- --confirm` | Strip the demo data, keep your real work |
| `npm run rollup -- 90` | Rebuild the last 90 days of `DailyMetric` |
| `npm test` | Playwright end-to-end suite |

### Cron

`/api/cron?job=…` runs the scheduled work, authenticated by `CRON_SECRET`:

| Job | Schedule | Purpose |
|---|---|---|
| `publish` | every 5 min | Release `SCHEDULED` posts whose time has come |
| `rollup` | nightly | Rebuild the last 3 days of `DailyMetric` |
| `retention` | weekly | Delete raw events past 14 months |

`vercel.json` wires all three. On other platforms point any scheduler at the same
URLs with `Authorization: Bearer $CRON_SECRET`.

---

## Going live

The seed is a showroom, not a starting point — 118 posts and ~46k invented page
views. Deploying with it still in place means your real traffic lands on top of
fabricated numbers, which is worse than either extreme because nothing on the
dashboard tells you which is which.

```bash
npm run backup:demo                 # reversible: dumps what the reset removes
npm run reset:demo                  # dry run: prints exactly what would go
npm run reset:demo -- --confirm     # do it
```

The seed marks everything it creates — reader accounts and subscribers on
`@readers.example`, generated art under `/uploads/seed/` — so the reset can be
precise. It removes the seeded posts, the fake readers and subscribers, all
analytics, and the generated cover art and avatars. It keeps your posts, your
uploads, the staff accounts, the taxonomy, the site settings, and the audit log,
which is a ledger and is never cleared.

Afterwards analytics start from a genuine zero.

## Deploying to Vercel

Run this first — it catches every misconfiguration that would otherwise surface
as a broken production site:

```bash
npm run preflight
```

### 1. Database

Vercel's own Postgres is Neon underneath, so either works.

- **Vercel dashboard → Storage → Create → Postgres**, or [neon.tech](https://neon.tech)
- Copy the **pooled** connection string (the host contains `-pooler`). Serverless
  opens a connection per invocation and an unpooled URL exhausts the server.
- Keep `?sslmode=require`

```bash
DATABASE_URL="postgresql://…-pooler.….neon.tech/voltv?sslmode=require"
npx prisma migrate deploy     # creates the schema, no seed data
```

### 2. Media — `local` will not work

Vercel's filesystem is read-only, so an upload throws rather than 404s.

**Vercel dashboard → Storage → Create → Blob.** `BLOB_READ_WRITE_TOKEN` is
injected automatically; then set `MEDIA_DRIVER="blob"`. Cloudflare R2 or S3 work
too via `MEDIA_DRIVER="s3"`.

Anything uploaded while the driver was `local` stays on your laptop and 404s in
production — re-upload it. Preflight counts these for you.

### 3. Environment variables

In **Settings → Environment Variables**:

| Variable | Value |
|---|---|
| `DATABASE_URL` | pooled Postgres URL |
| `AUTH_SECRET` | `openssl rand -base64 32` — a fresh one, not the dev value |
| `AUTH_URL` · `NEXT_PUBLIC_SITE_URL` | `https://your-app.vercel.app` |
| `ANALYTICS_SALT` · `CRON_SECRET` | fresh random values |
| `MEDIA_DRIVER` | `blob` |
| `RESEND_API_KEY` · `EMAIL_FROM` | from a **verified domain**, not `onboarding@resend.dev` |
| `AUTH_GOOGLE_ID` · `AUTH_GOOGLE_SECRET` | optional; both or neither |

### 4. Deploy

```bash
vercel login
vercel --prod
```

Or push to GitHub and import the repo in the Vercel dashboard.

### 5. Afterwards

- **Google sign-in**: add `https://your-app.vercel.app/api/auth/callback/google`
  to the OAuth client's authorised redirect URIs.
- **Email**: two drivers, SMTP first when both are set. SMTP costs nothing and
  sends to anyone — Gmail needs an app password, not the account password. The
  Resend path needs a verified domain at resend.com/domains: its shared
  `onboarding@resend.dev` sender only delivers to the Resend account owner, so
  invitations and password resets to anyone else are refused. That is an
  anti-abuse rule, not a billing limit, and a paid plan does not lift it. Users
  & roles states which driver is live and where mail will land.
- **Cron**: `vercel.json` ships a Hobby-compatible single nightly job. Hobby
  allows two jobs at daily frequency, so scheduled posts go live on the nightly
  pass rather than within five minutes. On Pro, copy `vercel.pro.json` over
  `vercel.json` to split the jobs back out.
- **Geo** works automatically on Vercel (`x-vercel-ip-country` and friends).
  Self-hosting? Set `x-geo-country`, `x-geo-region` and `x-geo-city` at your
  proxy from a MaxMind GeoLite2 lookup — `src/lib/analytics.ts` reads them.

---

## Testing

```bash
npm test            # headless
npm run test:ui     # Playwright UI mode
```

The suite starts its own dev server on port 3100 and runs against the seeded
database. It covers the publish flow end to end, comment moderation from
submission to approval, the role permission matrix, and the analytics beacon —
including that it stays silent before consent and under GPC.

---

## Known limitations

- **Rate limiting is in-process.** Fine for one instance; swap the `Map` in
  `src/lib/rate-limit.ts` for Redis on a multi-instance deploy. The call sites
  do not change.
- **Mail needs a driver before it leaves the building.** With neither SMTP nor
  Resend configured, invitations and resets are printed to the server log
  instead of sent, and the admin screen offers the link to copy by hand. That is
  deliberate — the flows work end to end on a laptop with no account and no
  network — but it means a fresh deploy sends nothing until `SMTP_*` or
  `RESEND_API_KEY` is set.
- **`npm audit` reports a dev-only advisory** in the Prisma CLI's transitive
  `deepmerge-ts`. It is not in the runtime dependency graph.
- **Seeded cover art is procedural SVG**, which is why `dangerouslyAllowSVG` is on
  (sandboxed, script-free, per Next's guidance). Real uploads are raster.

Every film, series, game, studio and person in the seed data is invented. A demo
database full of fabricated reporting about real works and real people would be
indistinguishable from fake news the moment someone screenshotted it.
