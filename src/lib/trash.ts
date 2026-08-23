/**
 * Trash policy.
 *
 * Lives here rather than beside the server actions because a `'use server'`
 * module may only export async functions — exporting a constant from one
 * breaks every import of that module, including the actions themselves.
 */

/** How long a deleted post stays recoverable before the cron purges it. */
export const TRASH_RETENTION_DAYS = 30;
