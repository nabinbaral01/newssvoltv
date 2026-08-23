/**
 * Prepares an empty production database for real use.
 *
 * `prisma migrate deploy` creates tables and nothing else — no categories, no
 * content types, no admin — so a freshly deployed site has no way to log in and
 * no taxonomy to file a post under. This fills exactly that gap and stops:
 * no posts, no fake readers, no invented analytics.
 *
 *   npm run bootstrap -- --email you@example.com --name "Your Name"
 *   npm run bootstrap -- --email you@example.com --password 'chosen-password'
 *
 * Safe to re-run: everything is an upsert.
 */
import { PrismaClient, Role } from '@prisma/client';
import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';

import { CATEGORIES, CONTENT_TYPES } from '../prisma/seed/fixtures.mts';
import { slugify } from '../src/lib/slug.ts';

const prisma = new PrismaClient();

function arg(name: string): string | undefined {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

const email = (arg('email') ?? process.env.ADMIN_EMAIL ?? '').toLowerCase().trim();
const name = arg('name') ?? process.env.ADMIN_NAME ?? 'Administrator';
const suppliedPassword = arg('password') ?? process.env.ADMIN_PASSWORD;

if (!email || !email.includes('@')) {
  console.error('\nAn admin email is required:\n');
  console.error('  npm run bootstrap -- --email you@example.com --name "Your Name"\n');
  process.exit(1);
}

// A generated password is stronger than one typed in a hurry, and it is shown
// once rather than sitting in shell history.
const password = suppliedPassword ?? crypto.randomBytes(12).toString('base64url');

console.log('\nBootstrapping…\n');

for (const category of CATEGORIES) {
  await prisma.category.upsert({
    where: { slug: category.slug },
    update: {},
    create: category,
  });
}
console.log(`  categories      ${CATEGORIES.length}`);

for (const type of CONTENT_TYPES) {
  await prisma.contentType.upsert({ where: { slug: type.slug }, update: {}, create: type });
}
console.log(`  content types   ${CONTENT_TYPES.length}`);

const admin = await prisma.user.upsert({
  where: { email },
  // Re-running promotes an existing account rather than duplicating it.
  update: { role: Role.ADMIN, ...(suppliedPassword ? { hashedPassword: await bcrypt.hash(password, 10) } : {}) },
  create: {
    email,
    name,
    slug: await (async () => {
      const base = slugify(name) || 'admin';
      let candidate = base;
      let n = 2;
      while (await prisma.user.findUnique({ where: { slug: candidate }, select: { id: true } })) {
        candidate = `${base}-${n++}`;
      }
      return candidate;
    })(),
    role: Role.ADMIN,
    hashedPassword: await bcrypt.hash(password, 10),
  },
  select: { id: true, email: true, role: true, createdAt: true, updatedAt: true },
});

const isNew = admin.createdAt.getTime() === admin.updatedAt.getTime();
console.log(`  admin account   ${admin.email} (${isNew ? 'created' : 'promoted to ADMIN'})`);

const settings: [string, unknown][] = [
  ['site.name', process.env.SITE_NAME ?? 'Volt V'],
  ['site.tagline', 'Screens, panels and controllers — covered properly.'],
  ['site.description', 'An entertainment publication covering film, television, comics, gaming and anime.'],
  ['site.logo', ''],
  ['social.links', { rss: '/rss.xml' }],
  ['homepage.modules', ['trending', 'hero', 'secondary', 'editors-picks', 'mixed-feed', 'newsletter']],
  ['homepage.adSlots', { betweenSections: false, sidebar: false, inArticle: false }],
  [
    'footer.columns',
    [
      { heading: 'Explore', links: CATEGORIES.slice(0, 5).map((c) => ({ label: c.name, href: `/${c.slug}` })) },
      { heading: 'Legal', links: [{ label: 'Privacy Policy', href: '/privacy' }, { label: 'Terms of Use', href: '/terms' }] },
    ],
  ],
];

for (const [key, value] of settings) {
  await prisma.siteSetting.upsert({
    where: { key },
    update: {},
    create: { key, value: value as object },
  });
}
console.log(`  site settings   ${settings.length}`);

const counts = {
  posts: await prisma.post.count(),
  pageViews: await prisma.pageView.count(),
};

console.log('\nDone. The database holds the taxonomy, your admin account and');
console.log(`settings — ${counts.posts} posts and ${counts.pageViews} page views, as it should.\n`);

if (!suppliedPassword && isNew) {
  console.log('  Sign in with:');
  console.log(`    email     ${admin.email}`);
  console.log(`    password  ${password}`);
  console.log('\n  Shown once. Change it from /account after signing in.\n');
}

await prisma.$disconnect();
