import type { Metadata } from 'next';

import { UsersClient, type AuditRow, type UserRow } from './users-client';
import { PageHeader } from '@/components/admin/page-header';
import { CAPABILITIES, requireCapability, type Capability } from '@/lib/permissions';
import { prisma } from '@/lib/prisma';

export const metadata: Metadata = { title: 'Users & roles' };
export const dynamic = 'force-dynamic';

const ROLES = ['ADMIN', 'EDITOR', 'AUTHOR', 'READER'] as const;

export default async function UsersPage() {
  const admin = await requireCapability('users.manage');

  const [users, auditLog, readerCount] = await Promise.all([
    prisma.user.findMany({
      where: { role: { in: ['ADMIN', 'EDITOR', 'AUTHOR'] } },
      orderBy: [{ role: 'asc' }, { name: 'asc' }],
      select: {
        id: true, name: true, email: true, role: true, image: true,
        createdAt: true, lastLoginAt: true,
        _count: { select: { posts: true, comments: true } },
      },
    }),
    prisma.auditLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: 25,
      select: {
        id: true, action: true, entity: true, createdAt: true,
        user: { select: { name: true } },
      },
    }),
    prisma.user.count({ where: { role: 'READER' } }),
  ]);

  const rows: UserRow[] = users.map((user) => ({
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    image: user.image,
    createdAt: user.createdAt.toISOString(),
    lastLoginAt: user.lastLoginAt?.toISOString() ?? null,
    postCount: user._count.posts,
    commentCount: user._count.comments,
  }));

  const audit: AuditRow[] = auditLog.map((entry) => ({
    id: entry.id,
    action: entry.action,
    entity: entry.entity,
    createdAt: entry.createdAt.toISOString(),
    userName: entry.user?.name ?? null,
  }));

  const capabilities = Object.entries(CAPABILITIES) as [Capability, readonly string[]][];

  return (
    <>
      <PageHeader
        title="Users & roles"
        description={`${rows.length} staff accounts · ${readerCount.toLocaleString()} reader accounts`}
      />

      <UsersClient users={rows} auditLog={audit} currentUserId={admin.id} />

      <section className="mt-6 rounded-card border border-border bg-surface">
        <div className="border-b border-border p-4">
          <h2 className="text-sm font-semibold">Permission matrix</h2>
          <p className="mt-0.5 text-xs text-muted">
            Enforced in one place — every screen and server action checks the same table.
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[34rem] text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted">
                <th scope="col" className="p-3 font-medium">Capability</th>
                {ROLES.map((role) => (
                  <th key={role} scope="col" className="p-3 text-center font-medium">{role}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {capabilities.map(([capability, allowed]) => (
                <tr key={capability} className="border-b border-border/60 last:border-0">
                  <td className="p-3 font-mono text-xs">{capability}</td>
                  {ROLES.map((role) => (
                    <td key={role} className="p-3 text-center">
                      {allowed.includes(role) ? (
                        <span className="text-success" title="Allowed">✓<span className="sr-only">allowed</span></span>
                      ) : (
                        <span className="text-muted" title="Not allowed">·<span className="sr-only">not allowed</span></span>
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
