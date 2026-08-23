/**
 * Removes the seeded demo data and leaves a real publication behind.
 *
 * The seed marks everything it creates, which is what makes this safe:
 *   - reader accounts and subscribers use @readers.example addresses
 *   - generated cover art lives under /uploads/seed/
 *   - seeded posts are exactly the posts carrying that cover art
 *
 * Anything written by hand — your posts, your uploads, your accounts — has none
 * of those markers and is never touched.
 *
 *   npm run reset:demo             # dry run: reports, changes nothing
 *   npm run reset:demo -- --confirm
 *   npm run reset:demo -- --confirm --keep-analytics
 */
import { PrismaClient } from '@prisma/client';
import fs from 'node:fs/promises';
import path from 'node:path';

const prisma = new PrismaClient();

const args = new Set(process.argv.slice(2));
const CONFIRM = args.has('--confirm');
const KEEP_ANALYTICS = args.has('--keep-analytics');

const SEED_MEDIA_PREFIX = '/uploads/seed/';
const SEED_EMAIL_SUFFIX = '@readers.example';

const n = (value: number) => value.toLocaleString();

async function survey() {
  const [
    seededPosts, seededMedia, readers, subscribers,
    pageViews, sessions, metrics, surveys, panel,
    realPosts, staff, categories, contentTypes, settings, auditLogs, seededAvatars,
  ] = await Promise.all([
    prisma.post.count({ where: { coverImage: { startsWith: SEED_MEDIA_PREFIX } } }),
    prisma.mediaAsset.count({ where: { url: { startsWith: SEED_MEDIA_PREFIX } } }),
    prisma.user.count({ where: { email: { endsWith: SEED_EMAIL_SUFFIX } } }),
    prisma.newsletter.count({ where: { email: { endsWith: SEED_EMAIL_SUFFIX } } }),
    prisma.pageView.count(),
    prisma.visitSession.count(),
    prisma.dailyMetric.count(),
    prisma.surveyResponse.count(),
    prisma.panelDemographic.count(),
    prisma.post.count({ where: { NOT: { coverImage: { startsWith: SEED_MEDIA_PREFIX } } } }),
    prisma.user.count({ where: { NOT: { email: { endsWith: SEED_EMAIL_SUFFIX } } } }),
    prisma.category.count(),
    prisma.contentType.count(),
    prisma.siteSetting.count(),
    prisma.auditLog.count(),
    prisma.user.count({ where: { image: { startsWith: SEED_MEDIA_PREFIX } } }),
  ]);

  return {
    remove: { seededPosts, seededMedia, readers, subscribers, pageViews, sessions, metrics, surveys, panel, seededAvatars },
    keep: { realPosts, staff, categories, contentTypes, settings, auditLogs },
  };
}

function report(s: Awaited<ReturnType<typeof survey>>) {
  const { remove, keep } = s;

  console.log('\nWILL REMOVE');
  console.log(`  seeded posts (and their comments/revisions)  ${n(remove.seededPosts)}`);
  console.log(`  seeded cover art                             ${n(remove.seededMedia)}`);
  console.log(`  fake reader accounts                         ${n(remove.readers)}`);
  console.log(`  fake newsletter subscribers                  ${n(remove.subscribers)}`);
  console.log(`  seeded staff avatars (kept as initials)       ${n(remove.seededAvatars)}`);
  if (KEEP_ANALYTICS) {
    console.log('  analytics                                    kept (--keep-analytics)');
  } else {
    console.log(`  page views                                   ${n(remove.pageViews)}`);
    console.log(`  visit sessions                               ${n(remove.sessions)}`);
    console.log(`  daily rollups                                ${n(remove.metrics)}`);
    console.log(`  survey responses                             ${n(remove.surveys)}`);
    console.log(`  panel demographics                           ${n(remove.panel)}`);
  }

  console.log('\nWILL KEEP');
  console.log(`  your posts                                   ${n(keep.realPosts)}`);
  console.log(`  staff accounts                               ${n(keep.staff)}`);
  console.log(`  categories / content types                   ${n(keep.categories)} / ${n(keep.contentTypes)}`);
  console.log(`  site settings                                ${n(keep.settings)}`);
  console.log(`  audit log                                    ${n(keep.auditLogs)}  (a ledger — never cleared)`);
}

async function removeSeedFiles(): Promise<number> {
  const dir = path.resolve(process.cwd(), 'public/uploads/seed');
  try {
    const files = await fs.readdir(dir);
    await fs.rm(dir, { recursive: true, force: true });
    return files.length;
  } catch {
    return 0;
  }
}

async function main() {
  const before = await survey();
  report(before);

  if (!CONFIRM) {
    console.log('\nDRY RUN — nothing was changed.');
    console.log('Run it for real with:  npm run reset:demo -- --confirm');
    console.log('Keep the traffic data: npm run reset:demo -- --confirm --keep-analytics\n');
    return;
  }

  console.log('\nremoving…');

  // Deleting a post cascades to its comments and revisions, and nulls the
  // postId on any page view that referenced it.
  const posts = await prisma.post.deleteMany({
    where: { coverImage: { startsWith: SEED_MEDIA_PREFIX } },
  });
  console.log(`  posts                ${n(posts.count)}`);

  const media = await prisma.mediaAsset.deleteMany({
    where: { url: { startsWith: SEED_MEDIA_PREFIX } },
  });
  console.log(`  media rows           ${n(media.count)}`);

  const files = await removeSeedFiles();
  console.log(`  files from disk      ${n(files)}`);

  // Staff avatars were generated into the same folder but were never MediaAsset
  // rows, so deleting the files alone leaves every byline pointing at a 404.
  // The UI falls back to initials when image is null.
  const avatars = await prisma.user.updateMany({
    where: { image: { startsWith: SEED_MEDIA_PREFIX } },
    data: { image: null },
  });
  console.log(`  seeded avatars        ${n(avatars.count)} cleared (fall back to initials)`);

  const subscribers = await prisma.newsletter.deleteMany({
    where: { email: { endsWith: SEED_EMAIL_SUFFIX } },
  });
  console.log(`  subscribers          ${n(subscribers.count)}`);

  if (!KEEP_ANALYTICS) {
    const [views, sessions, metrics, surveys, panel] = await prisma.$transaction([
      prisma.pageView.deleteMany({}),
      prisma.visitSession.deleteMany({}),
      prisma.dailyMetric.deleteMany({}),
      prisma.surveyResponse.deleteMany({}),
      prisma.panelDemographic.deleteMany({}),
    ]);
    console.log(`  page views           ${n(views.count)}`);
    console.log(`  sessions             ${n(sessions.count)}`);
    console.log(`  rollups              ${n(metrics.count)}`);
    console.log(`  survey + panel       ${n(surveys.count + panel.count)}`);

    // viewCount is denormalised onto Post; leaving it would show traffic that
    // no longer has any events behind it.
    await prisma.post.updateMany({ data: { viewCount: 0 } });
    console.log('  post view counts     reset to 0');
  }

  // Readers own no posts, so this cannot orphan a byline. Guarded anyway.
  const authoring = await prisma.user.count({
    where: { email: { endsWith: SEED_EMAIL_SUFFIX }, posts: { some: {} } },
  });
  if (authoring > 0) {
    console.log(`  ! ${authoring} demo account(s) have posts — skipping those`);
  }

  const readers = await prisma.user.deleteMany({
    where: { email: { endsWith: SEED_EMAIL_SUFFIX }, posts: { none: {} } },
  });
  console.log(`  reader accounts      ${n(readers.count)}`);

  // useCount drives the public tag cloud; recompute rather than guess.
  await prisma.$executeRawUnsafe(`
    UPDATE "Tag" t SET "useCount" = COALESCE(counts.total, 0)
    FROM (
      SELECT tag."id" AS tag_id, COUNT(pt."A")::int AS total
      FROM "Tag" tag LEFT JOIN "_PostTags" pt ON pt."B" = tag."id"
      GROUP BY tag."id"
    ) counts
    WHERE counts.tag_id = t."id"
  `);
  const orphanTags = await prisma.tag.deleteMany({ where: { useCount: 0 } });
  console.log(`  unused tags          ${n(orphanTags.count)}`);

  const after = await survey();
  console.log('\nDONE. The database now holds:');
  console.log(`  ${n(after.keep.realPosts)} post(s) · ${n(after.keep.staff)} staff account(s) · ` +
    `${n(after.keep.categories)} categories · ${n(after.remove.pageViews)} page views`);
  console.log('\nAnalytics start from zero and count real visitors from here.\n');
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
