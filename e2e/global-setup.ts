import { PrismaClient, Role } from '@prisma/client';
import bcrypt from 'bcryptjs';

/**
 * Guarantees the accounts the suite signs in as exist and hold the roles the
 * assertions depend on.
 *
 * Earlier versions borrowed seeded staff accounts, which broke the moment an
 * admin changed somebody's role through the UI — a real thing to do, and not
 * something a test should forbid. These accounts are owned by the suite.
 */
const PASSWORD = 'e2e-password-2026';

const ACCOUNTS = [
  { email: 'e2e.admin@voltv.test', name: 'E2E Admin', slug: 'e2e-admin', role: Role.ADMIN },
  { email: 'e2e.editor@voltv.test', name: 'E2E Editor', slug: 'e2e-editor', role: Role.EDITOR },
  { email: 'e2e.author@voltv.test', name: 'E2E Author', slug: 'e2e-author', role: Role.AUTHOR },
];

export default async function globalSetup() {
  const prisma = new PrismaClient();
  const hashedPassword = await bcrypt.hash(PASSWORD, 10);

  for (const account of ACCOUNTS) {
    await prisma.user.upsert({
      where: { email: account.email },
      // `update` matters as much as `create`: it puts the role back if a
      // previous run — or a person — changed it.
      update: { role: account.role, hashedPassword, name: account.name },
      create: { ...account, hashedPassword },
    });
  }

  const categories = await prisma.category.count();
  const contentTypes = await prisma.contentType.count();
  if (!categories || !contentTypes) {
    throw new Error(
      'The taxonomy is empty — run `npm run seed` (or create a category and a content type) before the suite.',
    );
  }

  await prisma.$disconnect();
}
