/**
 * Checks a deployment's configuration before it ships.
 *
 * Every item here corresponds to something that fails *silently or late* in
 * production — a missing secret that only bites on first login, a media driver
 * that throws on first upload, an OAuth callback nobody whitelisted. Finding
 * them here costs a second; finding them in production costs a user.
 *
 *   npm run preflight
 *   npm run preflight -- --url https://your-app.vercel.app
 */
import { PrismaClient } from '@prisma/client';

type Check = { level: 'pass' | 'warn' | 'fail'; label: string; detail?: string };

const results: Check[] = [];
const pass = (label: string, detail?: string) => results.push({ level: 'pass', label, detail });
const warn = (label: string, detail?: string) => results.push({ level: 'warn', label, detail });
const fail = (label: string, detail?: string) => results.push({ level: 'fail', label, detail });

const args = process.argv.slice(2);
const urlArg = args[args.indexOf('--url') + 1];
const SITE = urlArg?.startsWith('http') ? urlArg : process.env.NEXT_PUBLIC_SITE_URL;

// ---------------------------------------------------------------- secrets

const required = ['DATABASE_URL', 'AUTH_SECRET', 'ANALYTICS_SALT', 'CRON_SECRET'];
for (const key of required) {
  const value = process.env[key];
  if (!value) fail(`${key} is not set`, 'Required in production.');
  else if (/replace-me|changeme|placeholder/i.test(value)) {
    fail(`${key} still holds a placeholder`, 'Generate a real value: openssl rand -base64 32');
  } else if ((key === 'AUTH_SECRET' || key === 'ANALYTICS_SALT') && value.length < 24) {
    warn(`${key} is short`, `${value.length} chars — use at least 32.`);
  } else {
    pass(`${key} set`);
  }
}

// ---------------------------------------------------------------- database

const dbUrl = process.env.DATABASE_URL ?? '';
if (dbUrl.includes('127.0.0.1') || dbUrl.includes('localhost')) {
  fail('DATABASE_URL points at localhost', 'A deployed app cannot reach your laptop. Use Neon/Supabase.');
} else if (dbUrl) {
  if (!/sslmode=require|sslmode=verify/.test(dbUrl)) {
    warn('DATABASE_URL has no sslmode', 'Hosted Postgres should use sslmode=require.');
  }
  if (!/connection_limit|pgbouncer|-pooler\./.test(dbUrl)) {
    warn('DATABASE_URL is unpooled', 'Serverless opens a connection per invocation — use the pooled URL.');
  }
}

// ---------------------------------------------------------------- site url

if (!SITE) {
  fail('NEXT_PUBLIC_SITE_URL is not set', 'Canonical URLs, OG tags, sitemap and reset links all use it.');
} else if (SITE.includes('localhost')) {
  fail('NEXT_PUBLIC_SITE_URL is localhost', `Password-reset emails would link to ${SITE}.`);
} else if (!SITE.startsWith('https://')) {
  warn('NEXT_PUBLIC_SITE_URL is not https');
} else {
  pass('NEXT_PUBLIC_SITE_URL', SITE);
}

// ---------------------------------------------------------------- media

const driver = process.env.MEDIA_DRIVER ?? 'local';
if (driver === 'local') {
  fail('MEDIA_DRIVER=local', 'Vercel\'s filesystem is read-only — uploads will throw. Use "blob" or "s3".');
} else if (driver === 'blob' && !process.env.BLOB_READ_WRITE_TOKEN) {
  fail('MEDIA_DRIVER=blob but no BLOB_READ_WRITE_TOKEN', 'Create a Blob store in the Vercel dashboard.');
} else if (driver === 's3' && !(process.env.S3_BUCKET && process.env.S3_PUBLIC_URL)) {
  fail('MEDIA_DRIVER=s3 is incomplete', 'S3_BUCKET and S3_PUBLIC_URL are both required.');
} else {
  pass(`MEDIA_DRIVER=${driver}`);
}

// ---------------------------------------------------------------- email

if (!process.env.RESEND_API_KEY) {
  warn('RESEND_API_KEY not set', 'Password reset will print to the log instead of emailing.');
} else {
  pass('RESEND_API_KEY set');
  const from = process.env.EMAIL_FROM ?? '';
  if (from.includes('onboarding@resend.dev')) {
    fail(
      'EMAIL_FROM is the Resend sandbox sender',
      'onboarding@resend.dev only delivers to your own address. Verify a domain first.',
    );
  } else if (!from.includes('@')) {
    warn('EMAIL_FROM looks wrong', from || '(empty)');
  } else {
    pass('EMAIL_FROM', from);
  }
}

// ---------------------------------------------------------------- google

const hasId = Boolean(process.env.AUTH_GOOGLE_ID);
const hasSecret = Boolean(process.env.AUTH_GOOGLE_SECRET);
if (hasId && hasSecret) {
  pass('Google sign-in enabled');
  if (SITE) {
    warn('Whitelist the production callback', `${SITE}/api/auth/callback/google`);
  }
} else if (hasId !== hasSecret) {
  warn('Google half-configured', 'Both AUTH_GOOGLE_ID and AUTH_GOOGLE_SECRET are needed; the button stays hidden.');
}

// ---------------------------------------------------------------- data

const prisma = new PrismaClient();
try {
  const [categories, contentTypes, admins, posts, seededPosts, pageViews] = await Promise.all([
    prisma.category.count(),
    prisma.contentType.count(),
    prisma.user.count({ where: { role: 'ADMIN' } }),
    prisma.post.count(),
    prisma.post.count({ where: { coverImage: { startsWith: '/uploads/seed/' } } }),
    prisma.pageView.count(),
  ]);

  pass('Database reachable', `${posts} posts, ${categories} categories`);
  if (!categories || !contentTypes) fail('Taxonomy is empty', 'Both axes need at least one row.');
  if (!admins) fail('No ADMIN account', 'Nobody could reach /admin.');
  if (seededPosts) {
    warn(`${seededPosts} seeded demo posts present`, 'Run: npm run reset:demo -- --confirm');
  }
  if (pageViews > 40_000 && seededPosts) {
    warn(`${pageViews.toLocaleString()} page views look seeded`, 'Real analytics should start from zero.');
  }

  const localMedia = await prisma.mediaAsset.count({ where: { url: { startsWith: '/uploads/' } } });
  if (localMedia && driver !== 'local') {
    warn(
      `${localMedia} media file(s) point at local disk`,
      'Uploaded before the driver changed — they will 404 in production.',
    );
  }
} catch (error) {
  fail('Cannot reach the database', error instanceof Error ? error.message : String(error));
} finally {
  await prisma.$disconnect();
}

// ---------------------------------------------------------------- report

const icon = { pass: '  ok  ', warn: ' warn ', fail: ' FAIL ' };
console.log('\nPreflight\n');
for (const r of results) {
  console.log(`${icon[r.level]} ${r.label}${r.detail ? `\n        ${r.detail}` : ''}`);
}

const fails = results.filter((r) => r.level === 'fail').length;
const warns = results.filter((r) => r.level === 'warn').length;
console.log(
  `\n${fails} blocking, ${warns} worth a look.` +
    (fails ? '\nFix the FAIL lines before deploying.\n' : '\nNothing blocking.\n'),
);

process.exit(fails ? 1 : 0);
