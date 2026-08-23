/**
 * Volt V seed.
 *
 * Produces a database that looks like a live publication on its 90th day:
 * ~130 posts across both taxonomy axes, 15 staff writers, a reader base with
 * partially-declared demographics, and ~50,000 page views with plausible
 * geography, device mix and acquisition sources — so every dashboard has real
 * shapes in it the first time you open one.
 *
 *   npm run seed
 */
import { PrismaClient, CommentStatus, DeviceType, Gender, PostStatus, Role } from '@prisma/client';
import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';

import {
  AGE_MIX, AUTHORS, BODY_SENTENCES, CAMPAIGNS, CATEGORIES, CATEGORY_FORMATS, CLOSERS,
  CONTENT_TYPES, DEVICE_MIX, ELEMENTS, FRANCHISES, GENDER_MIX, GEO, HEADLINE_KITS, MONTHS,
  OPENERS, ORDINALS, PEOPLE, PULL_QUOTES, READER_FIRST_NAMES, READER_LAST_NAMES, SOURCE_MIX,
  STUDIOS, TAG_POOL, UNITS, VERDICTS,
} from './seed/fixtures.mts';
import { ensureSeedDir, writeAvatar, writeCover } from './seed/covers.mts';
import { autoExcerpt, bullets, doc, docToText, h, p, quote, readingTime } from '../src/lib/content.ts';
import { slugify } from '../src/lib/slug.ts';
import { rebuildRollups } from '../scripts/rollup.mts';

const prisma = new PrismaClient();

const TOTAL_POSTS = 130;
const WINDOW_DAYS = 90;
const TARGET_PAGEVIEWS = 50_000;
const READER_COUNT = 900;
/** Share of readers who fill in the optional birth year / gender fields. */
const DEMOGRAPHIC_OPT_IN = 0.62;

// ---------------------------------------------------------------- randomness

/** Deterministic PRNG — same seed, same database, every run. */
function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = mulberry32(0x0107);

const pick = <T,>(xs: readonly T[]): T => xs[Math.floor(rand() * xs.length)];
const int = (min: number, max: number) => min + Math.floor(rand() * (max - min + 1));
const chance = (p: number) => rand() < p;

function weighted<T,>(entries: [T, number][]): T {
  const total = entries.reduce((sum, [, w]) => sum + w, 0);
  let roll = rand() * total;
  for (const [value, w] of entries) {
    roll -= w;
    if (roll <= 0) return value;
  }
  return entries[entries.length - 1][0];
}

const shuffle = <T,>(xs: T[]): T[] => {
  const out = [...xs];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
};

const DAY = 86_400_000;
const now = Date.now();
const daysAgo = (d: number) => new Date(now - d * DAY);

// ---------------------------------------------------------------- copy

type Ctx = { franchise: string; category: string };

function fill(template: string, ctx: Ctx): string {
  const person = pick(PEOPLE);
  return template
    .replace(/\{franchise\}/g, ctx.franchise)
    .replace(/\{category\}/g, ctx.category)
    .replace(/\{studio\}/g, pick(STUDIOS))
    .replace(/\{person2\}/g, pick(PEOPLE.filter((n) => n !== person)))
    .replace(/\{person\}/g, person)
    .replace(/\{element\}/g, pick(ELEMENTS))
    .replace(/\{verdict\}/g, pick(VERDICTS))
    .replace(/\{unit\}/g, pick(UNITS))
    .replace(/\{ordinal\}/g, pick(ORDINALS))
    .replace(/\{month\}/g, pick(MONTHS))
    .replace(/\{year\}/g, String(int(2026, 2028)))
    .replace(/\{bignum\}/g, `$${int(88, 340)}M`)
    .replace(/\{n\}/g, String(pick([3, 4, 5, 6, 7, 8, 9, 10, 12, 15])))
    .replace(/\{n\}/g, String(int(3, 12)));
}

function buildBody(ctx: Ctx) {
  const nodes = [];
  nodes.push(p(fill(pick(OPENERS), ctx)));
  nodes.push(p(fill(pick(BODY_SENTENCES), ctx) + ' ' + fill(pick(BODY_SENTENCES), ctx)));

  const sections = int(2, 4);
  for (let s = 0; s < sections; s++) {
    nodes.push(h(2, fill(pick([
      'What {franchise} Gets Right',
      'The {element} Question',
      'Where It Goes From Here',
      'What {studio} Is Actually Betting On',
      'The Part Everyone Will Argue About',
    ]), ctx)));
    const paras = int(2, 3);
    for (let i = 0; i < paras; i++) {
      const sentences = Array.from({ length: int(2, 4) }, () => fill(pick(BODY_SENTENCES), ctx));
      nodes.push(p(sentences.join(' ')));
    }
    if (s === 0 && chance(0.55)) nodes.push(quote(fill(pick(PULL_QUOTES), ctx)));
    if (s === 1 && chance(0.4)) {
      nodes.push(bullets(Array.from({ length: int(3, 5) }, () => fill(pick(BODY_SENTENCES), ctx))));
    }
  }

  nodes.push(p(fill(pick(CLOSERS), ctx)));
  return doc(...nodes);
}

// ---------------------------------------------------------------- main

async function main() {
  console.log('[seed] clearing existing data…');
  await prisma.$executeRawUnsafe(`
    TRUNCATE TABLE "DailyMetric", "PanelDemographic", "SurveyResponse", "PageView",
      "VisitSession", "AuditLog", "Comment", "PostRevision", "MediaAsset", "Newsletter",
      "SiteSetting", "_PostTags", "Post", "Tag", "ContentType", "Category", "Account", "User"
    RESTART IDENTITY CASCADE
  `);
  ensureSeedDir();

  // -------------------------------------------------------------- taxonomy
  console.log('[seed] taxonomy…');
  const categories = await Promise.all(
    CATEGORIES.map((c) => prisma.category.create({ data: c })),
  );
  const categoryBySlug = new Map(categories.map((c) => [c.slug, c]));

  const contentTypes = await Promise.all(
    CONTENT_TYPES.map((t) => prisma.contentType.create({ data: t })),
  );
  const contentTypeBySlug = new Map(contentTypes.map((t) => [t.slug, t]));

  const tags = await Promise.all(
    TAG_POOL.map((name) => prisma.tag.create({ data: { name, slug: slugify(name) } })),
  );

  // -------------------------------------------------------------- staff
  console.log('[seed] staff…');
  const staffPassword = await bcrypt.hash('volt-admin-2026', 10);
  const authors = await Promise.all(
    AUTHORS.map((a) => {
      const slug = slugify(a.name);
      const accent = categoryBySlug.get(a.beat)?.colour ?? '#00E88F';
      return prisma.user.create({
        data: {
          name: a.name,
          email: `${slug.replace(/-/g, '.')}@voltv.example`,
          slug,
          hashedPassword: staffPassword,
          role: a.role as Role,
          bio: a.bio,
          image: writeAvatar(a.name, slug, accent),
          socialLinks: { x: `https://x.com/${slug.replace(/-/g, '')}`, bluesky: `https://bsky.app/profile/${slug}.voltv.example` },
          createdAt: daysAgo(WINDOW_DAYS + int(30, 400)),
          lastLoginAt: daysAgo(int(0, 6)),
          country: pick(['US', 'GB', 'CA', 'AU', 'IN']),
          birthYear: 2026 - int(24, 48),
          gender: weighted(GENDER_MIX as [string, number][]) as Gender,
        },
      });
    }),
  );
  const authorsByBeat = new Map<string, typeof authors>();
  AUTHORS.forEach((a, i) => {
    const list = authorsByBeat.get(a.beat) ?? [];
    list.push(authors[i]);
    authorsByBeat.set(a.beat, list);
  });

  // -------------------------------------------------------------- readers
  console.log(`[seed] ${READER_COUNT} readers…`);
  const readerPassword = await bcrypt.hash('volt-reader-2026', 10);
  const readerRows = Array.from({ length: READER_COUNT }, (_, i) => {
    const first = pick(READER_FIRST_NAMES);
    const last = pick(READER_LAST_NAMES);
    const geo = weighted(GEO.map((g) => [g, g.share] as [typeof GEO[number], number]));
    const city = weighted(geo.cities.map((c) => [c, c.weight] as [typeof geo.cities[number], number]));
    const declares = chance(DEMOGRAPHIC_OPT_IN);
    const ageBucket = weighted(AGE_MIX);
    const [lowAge, highAge] = ageBucket === '65+' ? [65, 78] : ageBucket.split('-').map(Number);
    return {
      name: `${first} ${last}`,
      email: `${slugify(first)}.${slugify(last)}.${i}@readers.example`,
      slug: `${slugify(first)}-${slugify(last)}-${i}`,
      hashedPassword: readerPassword,
      role: Role.READER,
      createdAt: daysAgo(int(0, WINDOW_DAYS + 60)),
      lastLoginAt: chance(0.6) ? daysAgo(int(0, 30)) : null,
      country: geo.code,
      city: city.city,
      // Optional fields — the coverage gap here is the honest part of the
      // demographics dashboard, so it is modelled rather than papered over.
      birthYear: declares ? 2026 - int(lowAge, highAge) : null,
      gender: declares && chance(0.93) ? (weighted(GENDER_MIX) as Gender) : null,
    };
  });
  await prisma.user.createMany({ data: readerRows });
  const readers = await prisma.user.findMany({
    where: { role: Role.READER },
    select: { id: true, country: true, name: true },
  });
  const readersByCountry = new Map<string, typeof readers>();
  for (const r of readers) {
    const list = readersByCountry.get(r.country ?? '') ?? [];
    list.push(r);
    readersByCountry.set(r.country ?? '', list);
  }

  // -------------------------------------------------------------- posts
  console.log(`[seed] ${TOTAL_POSTS} posts…`);
  const categoryMix: [string, number][] = [
    ['movies', 0.26], ['tv', 0.22], ['gaming', 0.16], ['comics', 0.1],
    ['anime', 0.1], ['reality-tv', 0.1], ['videos', 0.06],
  ];
  const usedSlugs = new Set<string>();
  const usedTitles = new Set<string>();

  type SeededPost = {
    id: string; slug: string; categorySlug: string; publishedAt: Date | null;
    status: PostStatus; popularity: number; authorId: string; categoryId: string;
    contentTypeId: string;
  };
  const seededPosts: SeededPost[] = [];
  const mediaRows: {
    url: string; filename: string; mimeType: string; width: number; height: number;
    sizeBytes: number; altText: string; uploadedById: string; createdAt: Date;
  }[] = [];

  for (let i = 0; i < TOTAL_POSTS; i++) {
    const categorySlug = weighted(categoryMix);
    const category = categoryBySlug.get(categorySlug)!;
    const allowedFormats = CATEGORY_FORMATS[categorySlug];
    const kit = weighted(
      HEADLINE_KITS.filter((k) => allowedFormats.includes(k.contentType))
        .map((k) => [k, k.weight] as [typeof HEADLINE_KITS[number], number]),
    );
    const contentType = contentTypeBySlug.get(kit.contentType)!;
    const franchise = pick(FRANCHISES[categorySlug]);
    const ctx: Ctx = { franchise, category: category.name };

    let title = fill(pick(kit.templates), ctx);
    let guard = 0;
    while (usedTitles.has(title) && guard++ < 12) title = fill(pick(kit.templates), ctx);
    usedTitles.add(title);

    let slug = slugify(title);
    let n = 2;
    while (usedSlugs.has(slug)) slug = `${slugify(title)}-${n++}`;
    usedSlugs.add(slug);

    // Recency-weighted publication dates: more of the archive is recent.
    const age = Math.floor(Math.pow(rand(), 1.7) * WINDOW_DAYS);
    let status: PostStatus = PostStatus.PUBLISHED;
    let publishedAt: Date | null = new Date(daysAgo(age).getTime() + int(6, 21) * 3_600_000);
    let scheduledFor: Date | null = null;

    const roll = rand();
    if (roll > 0.965) {
      status = PostStatus.SCHEDULED;
      publishedAt = null;
      scheduledFor = new Date(now + int(1, 9) * DAY);
    } else if (roll > 0.93) {
      status = PostStatus.DRAFT;
      publishedAt = null;
    } else if (roll > 0.905) {
      status = PostStatus.IN_REVIEW;
      publishedAt = null;
    } else if (roll > 0.885) {
      status = PostStatus.ARCHIVED;
    }

    const beatAuthors = authorsByBeat.get(categorySlug) ?? authors;
    const author = pick(chance(0.82) ? beatAuthors : authors);
    const coverUrl = writeCover(slug, category.colour);
    const body = buildBody(ctx);
    const bodyText = docToText(body);
    const excerpt = autoExcerpt(bodyText, 190);

    const isReview = kit.contentType === 'reviews';
    const created = await prisma.post.create({
      data: {
        title,
        slug,
        excerpt,
        body: body as object,
        bodyText,
        coverImage: coverUrl,
        coverAlt: `${franchise} key art`,
        categoryId: category.id,
        contentTypeId: contentType.id,
        authorId: author.id,
        status,
        publishedAt,
        scheduledFor,
        readingTimeMinutes: readingTime(bodyText),
        rating: isReview ? Math.round((5 + rand() * 4.5) * 2) / 2 : null,
        metaTitle: title.length > 58 ? `${title.slice(0, 55)}…` : title,
        metaDescription: autoExcerpt(bodyText, 155),
        ogImage: coverUrl,
        createdAt: publishedAt ?? scheduledFor ?? daysAgo(int(0, 20)),
        tags: {
          connect: shuffle([
            ...tags.filter((t) => t.name === franchise),
            ...shuffle(tags).slice(0, int(4, 8)),
          ]).slice(0, int(5, 9)).map((t) => ({ id: t.id })),
        },
      },
    });

    mediaRows.push({
      url: coverUrl,
      filename: `${slug}.svg`,
      mimeType: 'image/svg+xml',
      width: 1600,
      height: 900,
      sizeBytes: int(2400, 5200),
      altText: `${franchise} key art`,
      uploadedById: author.id,
      createdAt: created.createdAt,
    });

    seededPosts.push({
      id: created.id,
      slug,
      categorySlug,
      publishedAt,
      status,
      // A handful of posts do the numbers that most posts never do.
      popularity: chance(0.06) ? 6 + rand() * 9 : 0.35 + rand() * 1.9,
      authorId: author.id,
      categoryId: category.id,
      contentTypeId: contentType.id,
    });
  }

  // Editorial placement flags, applied to recent published posts only.
  const publishedRecent = seededPosts
    .filter((p) => p.status === PostStatus.PUBLISHED && p.publishedAt)
    .sort((a, b) => b.publishedAt!.getTime() - a.publishedAt!.getTime());

  const featured = publishedRecent.slice(0, 3);
  const trending = shuffle(publishedRecent.slice(0, 40)).slice(0, 9);
  const picks = shuffle(publishedRecent.slice(0, 60)).slice(0, 8);
  await prisma.post.updateMany({ where: { id: { in: featured.map((p) => p.id) } }, data: { isFeatured: true } });
  await prisma.post.updateMany({ where: { id: { in: trending.map((p) => p.id) } }, data: { isTrending: true } });
  await prisma.post.updateMany({ where: { id: { in: picks.map((p) => p.id) } }, data: { isEditorPick: true } });

  await prisma.mediaAsset.createMany({ data: mediaRows });
  for (const tag of tags) {
    const count = await prisma.post.count({ where: { tags: { some: { id: tag.id } } } });
    await prisma.tag.update({ where: { id: tag.id }, data: { useCount: count } });
  }

  // Revision history for a slice of posts, so the editor has something to show.
  for (const post of shuffle(publishedRecent).slice(0, 24)) {
    const full = await prisma.post.findUnique({ where: { id: post.id } });
    if (!full) continue;
    for (let r = 0; r < int(1, 3); r++) {
      await prisma.postRevision.create({
        data: {
          postId: full.id,
          authorId: full.authorId,
          title: r === 0 ? full.title : `${full.title} (working title)`,
          excerpt: full.excerpt,
          body: full.body as object,
          note: pick(['autosave', 'copy edit', 'headline change', 'legal pass']),
          createdAt: new Date((full.publishedAt ?? full.createdAt).getTime() - int(1, 48) * 3_600_000),
        },
      });
    }
  }

  // -------------------------------------------------------------- traffic
  console.log(`[seed] ~${TARGET_PAGEVIEWS.toLocaleString()} page views…`);

  // Daily volume curve: steady growth, weekend dip, two news spikes.
  const dayWeights: number[] = [];
  for (let d = WINDOW_DAYS - 1; d >= 0; d--) {
    const date = daysAgo(d);
    const growth = 0.62 + (WINDOW_DAYS - d) / WINDOW_DAYS * 0.55;
    const dow = date.getUTCDay();
    const weekly = dow === 0 || dow === 6 ? 0.78 : dow === 2 || dow === 3 ? 1.08 : 1;
    const spike = d === 11 ? 2.4 : d === 12 ? 1.7 : d === 43 ? 1.9 : 1;
    dayWeights.push(growth * weekly * spike * (0.92 + rand() * 0.16));
  }
  const weightSum = dayWeights.reduce((a, b) => a + b, 0);

  // A visitor pool with a long tail of one-time readers and a loyal core.
  const VISITOR_POOL = 15_000;
  const visitorSeen = new Set<number>();
  const pickVisitor = () =>
    chance(0.22) ? int(0, Math.floor(VISITOR_POOL * 0.08)) : int(0, VISITOR_POOL - 1);

  const livePosts = seededPosts.filter((p) => p.status === PostStatus.PUBLISHED && p.publishedAt);
  const staticPaths = ['/', '/movies', '/tv', '/gaming', '/anime', '/comics', '/reality-tv', '/search', '/videos'];

  let pvBuffer: Record<string, unknown>[] = [];
  let sessionBuffer: Record<string, unknown>[] = [];
  let pageViewCount = 0;
  const viewsByPost = new Map<string, number>();

  const flush = async (force = false) => {
    if (pvBuffer.length >= 1200 || (force && pvBuffer.length)) {
      await prisma.pageView.createMany({ data: pvBuffer as never });
      pvBuffer = [];
    }
    if (sessionBuffer.length >= 1200 || (force && sessionBuffer.length)) {
      await prisma.visitSession.createMany({ data: sessionBuffer as never });
      sessionBuffer = [];
    }
  };

  const avgPagesPerSession = 1.92;
  const targetSessions = Math.round(TARGET_PAGEVIEWS / avgPagesPerSession);

  for (let idx = 0; idx < WINDOW_DAYS; idx++) {
    const d = WINDOW_DAYS - 1 - idx;
    const sessionsToday = Math.round((dayWeights[idx] / weightSum) * targetSessions);
    const dayStart = daysAgo(d).setUTCHours(0, 0, 0, 0);

    // Posts eligible to be read on this day, weighted by freshness.
    const eligible = livePosts.filter((p) => p.publishedAt!.getTime() <= dayStart + DAY);
    if (!eligible.length) continue;
    const eligibleWeights: [SeededPost, number][] = eligible.map((post) => {
      const ageDays = Math.max(0, (dayStart - post.publishedAt!.getTime()) / DAY);
      const decay = Math.exp(-ageDays / 9) + 0.045;
      return [post, decay * post.popularity];
    });

    for (let s = 0; s < sessionsToday; s++) {
      const geo = weighted(GEO.map((g) => [g, g.share] as [typeof GEO[number], number]));
      const city = weighted(geo.cities.map((c) => [c, c.weight] as [typeof geo.cities[number], number]));
      const deviceRow = weighted(DEVICE_MIX.map((d) => [d, d.share] as [typeof DEVICE_MIX[number], number]));
      const os = weighted(deviceRow.os);
      const browser = weighted(deviceRow.browsers);
      const sourceRow = weighted(SOURCE_MIX.map((s) => [s, s.share] as [typeof SOURCE_MIX[number], number]));
      const referrer = sourceRow.referrers.length ? pick(sourceRow.referrers) : null;
      const campaign = sourceRow.source === 'social' || sourceRow.source === 'referral'
        ? (chance(0.18) ? pick(CAMPAIGNS) : null)
        : sourceRow.source === 'direct' && chance(0.06) ? CAMPAIGNS[0] : null;

      const visitorIndex = pickVisitor();
      const isNew = !visitorSeen.has(visitorIndex);
      visitorSeen.add(visitorIndex);
      const visitorId = crypto.createHash('sha256').update(`seed-visitor-${visitorIndex}`).digest('hex').slice(0, 32);

      // Peak reading hours skew to lunchtime and evening, local-ish.
      const hour = weighted([[7, 3], [8, 5], [9, 6], [10, 7], [11, 8], [12, 9], [13, 8], [14, 7], [15, 7], [16, 7], [17, 8], [18, 9], [19, 10], [20, 10], [21, 8], [22, 6], [23, 4], [0, 3], [1, 2], [2, 1], [3, 1], [4, 1], [5, 1], [6, 2]] as [number, number][]);
      const startedAt = new Date(dayStart + hour * 3_600_000 + int(0, 3_599) * 1000);

      const pages = chance(0.56) ? 1 : chance(0.6) ? 2 : chance(0.65) ? 3 : int(4, 8);
      const sessionId = crypto.randomUUID();

      const loggedIn = chance(0.12);
      const countryReaders = readersByCountry.get(geo.code);
      const user = loggedIn && countryReaders?.length ? pick(countryReaders) : null;

      let entryPath = '/';
      let exitPath = '/';

      for (let pageIndex = 0; pageIndex < pages; pageIndex++) {
        const readsPost = pageIndex === 0 ? sourceRow.source !== 'direct' || chance(0.45) : chance(0.86);
        const post = readsPost ? weighted(eligibleWeights) : null;
        const path = post ? `/${post.categorySlug}/${post.slug}` : pick(staticPaths);
        if (pageIndex === 0) entryPath = path;
        exitPath = path;

        if (post) viewsByPost.set(post.id, (viewsByPost.get(post.id) ?? 0) + 1);

        const engaged = post ? chance(0.62) : chance(0.3);
        pvBuffer.push({
          postId: post?.id ?? null,
          path,
          sessionId,
          visitorId,
          referrer: pageIndex === 0 ? referrer : null,
          utmSource: pageIndex === 0 ? campaign?.utmSource ?? null : null,
          utmMedium: pageIndex === 0 ? campaign?.utmMedium ?? null : null,
          utmCampaign: pageIndex === 0 ? campaign?.utmCampaign ?? null : null,
          country: geo.code,
          region: city.region,
          city: city.city,
          latitude: city.lat,
          longitude: city.lon,
          deviceType: deviceRow.device as DeviceType,
          browser,
          os,
          screenWidth: deviceRow.device === 'MOBILE' ? pick([360, 390, 393, 412, 430]) : deviceRow.device === 'TABLET' ? pick([768, 820, 1024]) : pick([1280, 1440, 1536, 1920, 2560]),
          timeOnPageSeconds: engaged ? int(45, 420) : int(3, 44),
          scrollDepthPercent: engaged ? int(45, 100) : int(5, 44),
          isNewVisitor: isNew && pageIndex === 0,
          userId: user?.id ?? null,
          createdAt: new Date(startedAt.getTime() + pageIndex * int(30, 260) * 1000),
        });
        pageViewCount++;
      }

      sessionBuffer.push({
        visitorId,
        startedAt,
        endedAt: new Date(startedAt.getTime() + pages * int(40, 300) * 1000),
        pageCount: pages,
        entryPath,
        exitPath,
        isBounce: pages === 1,
        country: geo.code,
        region: city.region,
        city: city.city,
        deviceType: deviceRow.device as DeviceType,
        browser,
        os,
        source: sourceRow.source,
        referrer,
        userId: user?.id ?? null,
      });

      await flush();
    }
    if (idx % 15 === 0) process.stdout.write(`  day ${idx + 1}/${WINDOW_DAYS}\r`);
  }
  await flush(true);
  console.log(`\n[seed] ${pageViewCount.toLocaleString()} page views written`);

  console.log('[seed] syncing post view counts…');
  for (const [postId, count] of viewsByPost) {
    await prisma.post.update({ where: { id: postId }, data: { viewCount: count } });
  }

  // -------------------------------------------------------------- comments
  console.log('[seed] comments…');
  const commentBodies = [
    'The second act point about pacing is exactly what bothered me and I could not name it until now.',
    'Respectfully disagree on the ending — it earns the ambiguity.',
    'Finally someone said it. The score is doing 80% of the emotional work.',
    'Great piece. Any word on whether the same team is back for the next one?',
    'I watched it twice this week and the rewatch completely changed my read on the villain.',
    'This is the most balanced take I have read on it, most coverage went straight to hyperbole.',
    'Hard no from me. The middle hour is unwatchable.',
    'Bookmarking this for when the finale drops.',
    'The comparison to the previous season is unfair, different budget entirely.',
    'Would love a follow-up on the production side of this.',
  ];
  const topComments: { id: string; postId: string }[] = [];
  for (const post of livePosts) {
    const views = viewsByPost.get(post.id) ?? 0;
    const count = Math.min(28, Math.round((views / 90) * (0.4 + rand())));
    for (let c = 0; c < count; c++) {
      const reader = pick(readers);
      const status = weighted([
        [CommentStatus.APPROVED, 0.84],
        [CommentStatus.PENDING, 0.11],
        [CommentStatus.SPAM, 0.05],
      ] as [CommentStatus, number][]);
      const created = await prisma.comment.create({
        data: {
          postId: post.id,
          userId: reader.id,
          body: pick(commentBodies),
          status,
          createdAt: new Date(post.publishedAt!.getTime() + int(1, 72) * 3_600_000),
        },
        select: { id: true, postId: true },
      });
      if (status === CommentStatus.APPROVED) topComments.push(created);
    }
  }
  // Threading: a slice of approved comments get replies.
  for (const parent of shuffle(topComments).slice(0, Math.floor(topComments.length * 0.22))) {
    await prisma.comment.create({
      data: {
        postId: parent.postId,
        parentId: parent.id,
        userId: pick(readers).id,
        body: pick([
          'This is the read I came round to as well after the second viewing.',
          'Counterpoint: that only works if you assume the timeline is linear.',
          'Same. Glad it was not just me.',
          'Source on that? Genuinely curious.',
        ]),
        status: CommentStatus.APPROVED,
        createdAt: daysAgo(int(0, 40)),
      },
    });
  }

  // -------------------------------------------------------------- newsletter
  console.log('[seed] newsletter, survey and panel data…');
  await prisma.newsletter.createMany({
    data: Array.from({ length: 940 }, (_, i) => {
      const created = daysAgo(Math.floor(Math.pow(rand(), 1.4) * WINDOW_DAYS));
      const confirmed = chance(0.71);
      return {
        email: `subscriber.${i}@readers.example`,
        confirmed,
        confirmedAt: confirmed ? new Date(created.getTime() + int(1, 90) * 60_000) : null,
        source: weighted([['footer', 0.5], ['article-band', 0.28], ['signup-modal', 0.16], ['import', 0.06]] as [string, number][]),
        createdAt: created,
      };
    }),
  });

  // Survey source: an occasional one-question on-site poll. Small sample,
  // projected — the dashboard labels it as such and never merges it silently.
  await prisma.surveyResponse.createMany({
    data: shuffle(Array.from({ length: 1400 }, (_, i) => i)).map((i) => ({
      visitorId: crypto.createHash('sha256').update(`seed-visitor-${i}`).digest('hex').slice(0, 32),
      questionKey: chance(0.55) ? 'age' : 'gender',
      answer: '',
      createdAt: daysAgo(int(0, WINDOW_DAYS)),
    })).map((row) => ({
      ...row,
      answer: row.questionKey === 'age' ? weighted(AGE_MIX) : weighted(GENDER_MIX),
    })),
    skipDuplicates: true,
  });

  // Third-party panel figures (GA4-shaped): modelled shares, never per-visitor.
  const panelRows: { day: Date; questionKey: string; bucket: string; share: number }[] = [];
  for (let d = 0; d < WINDOW_DAYS; d += 7) {
    const day = new Date(daysAgo(d).setUTCHours(0, 0, 0, 0));
    const ageJitter = AGE_MIX.map(([bucket, share]) => [bucket, share * (0.86 + rand() * 0.28)] as [string, number]);
    const ageTotal = ageJitter.reduce((a, [, s]) => a + s, 0);
    ageJitter.forEach(([bucket, share]) => panelRows.push({ day, questionKey: 'age', bucket, share: share / ageTotal }));
    const genderJitter = GENDER_MIX.filter(([g]) => g !== 'PREFER_NOT_TO_SAY')
      .map(([bucket, share]) => [bucket, share * (0.9 + rand() * 0.2)] as [string, number]);
    const genderTotal = genderJitter.reduce((a, [, s]) => a + s, 0);
    genderJitter.forEach(([bucket, share]) => panelRows.push({ day, questionKey: 'gender', bucket, share: share / genderTotal }));
  }
  await prisma.panelDemographic.createMany({ data: panelRows, skipDuplicates: true });

  // -------------------------------------------------------------- settings
  console.log('[seed] site settings…');
  const settings: [string, unknown][] = [
    ['site.name', 'Volt V'],
    ['site.tagline', 'Screens, panels and controllers — covered properly.'],
    ['site.logo', ''],
    ['site.description', 'Volt V is an entertainment publication covering film, television, comics, gaming and anime with reporting, reviews and rankings.'],
    ['social.links', { x: 'https://x.com/voltv', youtube: 'https://youtube.com/@voltv', bluesky: 'https://bsky.app/profile/voltv.example', rss: '/rss.xml' }],
    ['homepage.modules', ['trending', 'hero', 'secondary', 'category:movies', 'category:tv', 'category:gaming', 'editors-picks', 'category:anime', 'category:comics', 'mixed-feed', 'newsletter']],
    ['homepage.adSlots', { betweenSections: true, sidebar: true, inArticle: true }],
    ['footer.columns', [
      { heading: 'Explore', links: [{ label: 'Movies', href: '/movies' }, { label: 'TV', href: '/tv' }, { label: 'Gaming', href: '/gaming' }, { label: 'Anime', href: '/anime' }, { label: 'Comics', href: '/comics' }, { label: 'Reality TV', href: '/reality-tv' }] },
      { heading: 'About', links: [{ label: 'Our Team', href: '/about/team' }, { label: 'Editorial Standards', href: '/about/standards' }, { label: 'Careers', href: '/about/careers' }] },
      { heading: 'Contact', links: [{ label: 'Press', href: '/contact/press' }, { label: 'Tips', href: '/contact/tips' }, { label: 'Advertising', href: '/contact/advertising' }] },
      { heading: 'Legal', links: [{ label: 'Privacy Policy', href: '/privacy' }, { label: 'Cookie Policy', href: '/privacy#cookies' }, { label: 'Terms of Use', href: '/terms' }] },
    ]],
  ];
  for (const [key, value] of settings) {
    await prisma.siteSetting.create({ data: { key, value: value as object } });
  }

  // -------------------------------------------------------------- audit log
  const auditActions = ['post.publish', 'post.update', 'comment.approve', 'user.role.change', 'settings.update', 'media.upload'];
  await prisma.auditLog.createMany({
    data: Array.from({ length: 220 }, () => {
      const actor = pick(authors);
      return {
        userId: actor.id,
        action: pick(auditActions),
        entity: pick(['Post', 'Comment', 'User', 'SiteSetting', 'MediaAsset']),
        entityId: pick(seededPosts).id,
        ipHash: crypto.createHash('sha256').update(`seed-ip-${int(1, 40)}`).digest('hex').slice(0, 32),
        createdAt: daysAgo(int(0, WINDOW_DAYS)),
      };
    }),
  });

  // -------------------------------------------------------------- rollups
  console.log('[seed] building daily rollups…');
  const rows = await rebuildRollups(prisma, { from: daysAgo(WINDOW_DAYS + 1), to: new Date() });

  const counts = {
    posts: await prisma.post.count(),
    published: await prisma.post.count({ where: { status: PostStatus.PUBLISHED } }),
    users: await prisma.user.count(),
    comments: await prisma.comment.count(),
    pageViews: await prisma.pageView.count(),
    sessions: await prisma.visitSession.count(),
    metrics: rows,
  };
  console.log('\n[seed] done:', counts);
  console.log('[seed] admin login: mara.delacroix@voltv.example / volt-admin-2026');
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
