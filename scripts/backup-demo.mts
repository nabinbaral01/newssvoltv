/**
 * Dumps everything `reset:demo` would delete to a JSON file, so the reset is
 * reversible. The embedded Postgres build ships no pg_dump, hence doing it
 * through Prisma.
 *
 *   npm run backup:demo              # write .backups/<timestamp>.json
 *   npm run backup:demo -- --restore .backups/<file>.json
 */
import { PrismaClient } from '@prisma/client';
import fs from 'node:fs/promises';
import path from 'node:path';

const prisma = new PrismaClient();
const args = process.argv.slice(2);
const restoreIndex = args.indexOf('--restore');
const BATCH = 2_000;

const n = (v: number) => v.toLocaleString();

async function dump() {
  const dir = path.resolve(process.cwd(), '.backups');
  await fs.mkdir(dir, { recursive: true });

  const payload = {
    takenAt: new Date().toISOString(),
    users: await prisma.user.findMany({ where: { email: { endsWith: '@readers.example' } } }),
    newsletter: await prisma.newsletter.findMany({ where: { email: { endsWith: '@readers.example' } } }),
    mediaAssets: await prisma.mediaAsset.findMany({ where: { url: { startsWith: '/uploads/seed/' } } }),
    posts: await prisma.post.findMany({ where: { coverImage: { startsWith: '/uploads/seed/' } } }),
    pageViews: await prisma.pageView.findMany(),
    visitSessions: await prisma.visitSession.findMany(),
    dailyMetrics: await prisma.dailyMetric.findMany(),
    surveyResponses: await prisma.surveyResponse.findMany(),
    panelDemographics: await prisma.panelDemographic.findMany(),
  };

  const file = path.join(dir, `demo-${payload.takenAt.replace(/[:.]/g, '-')}.json`);
  await fs.writeFile(file, JSON.stringify(payload), 'utf8');
  const { size } = await fs.stat(file);

  console.log('backed up:');
  for (const [key, value] of Object.entries(payload)) {
    if (Array.isArray(value)) console.log(`  ${key.padEnd(20)} ${n(value.length)}`);
  }
  console.log(`\nwritten to ${path.relative(process.cwd(), file)} (${(size / 1024 / 1024).toFixed(1)} MB)`);
  return file;
}

/**
 * The dump is JSON, so every row arrives untyped. Each createMany call below
 * targets the table the rows came out of, and Prisma validates the shape at
 * runtime — the cast just stops `any` from spreading through the file.
 */
type Rows = Record<string, unknown>[];

type Backup = {
  takenAt: string;
  users: Rows;
  newsletter: Rows;
  mediaAssets: Rows;
  posts: Rows;
  pageViews: Rows;
  visitSessions: Rows;
  dailyMetrics: Rows;
  surveyResponses: Rows;
  panelDemographics: Rows;
};

/** createMany in batches — a single call would blow the parameter limit. */
async function insertAll<T>(label: string, rows: T[], create: (chunk: T[]) => Promise<{ count: number }>) {
  let total = 0;
  for (let i = 0; i < rows.length; i += BATCH) {
    const { count } = await create(rows.slice(i, i + BATCH));
    total += count;
  }
  console.log(`  ${label.padEnd(20)} ${n(total)}`);
}

async function restore(file: string) {
  const data = JSON.parse(await fs.readFile(file, 'utf8')) as Backup;
  console.log(`restoring from ${path.basename(file)} (taken ${data.takenAt})\n`);

  // Order matters: rows that others reference go back first.
  await insertAll('users', data.users, (c) =>
    prisma.user.createMany({ data: c as never, skipDuplicates: true }));
  await insertAll('posts', data.posts, (c) =>
    prisma.post.createMany({ data: c as never, skipDuplicates: true }));
  await insertAll('media', data.mediaAssets, (c) =>
    prisma.mediaAsset.createMany({ data: c as never, skipDuplicates: true }));
  await insertAll('newsletter', data.newsletter, (c) =>
    prisma.newsletter.createMany({ data: c as never, skipDuplicates: true }));
  await insertAll('visitSessions', data.visitSessions, (c) =>
    prisma.visitSession.createMany({ data: c as never, skipDuplicates: true }));
  await insertAll('pageViews', data.pageViews, (c) =>
    prisma.pageView.createMany({ data: c as never, skipDuplicates: true }));
  await insertAll('dailyMetrics', data.dailyMetrics, (c) =>
    prisma.dailyMetric.createMany({ data: c as never, skipDuplicates: true }));
  await insertAll('surveyResponses', data.surveyResponses, (c) =>
    prisma.surveyResponse.createMany({ data: c as never, skipDuplicates: true }));
  await insertAll('panelDemographics', data.panelDemographics, (c) =>
    prisma.panelDemographic.createMany({ data: c as never, skipDuplicates: true }));

  console.log('\nrestored. Note: post↔tag links and deleted cover-art files are not');
  console.log('part of this dump — re-run `npm run seed` for a full demo rebuild.');
}

async function main() {
  if (restoreIndex >= 0) {
    const file = args[restoreIndex + 1];
    if (!file) throw new Error('--restore needs a path to a backup file');
    await restore(path.resolve(file));
  } else {
    await dump();
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
