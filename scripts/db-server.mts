/**
 * Local Postgres for development, with nothing to install.
 *
 * Runs a real PostgreSQL 17 server from the `embedded-postgres` package against
 * a data directory inside the repo (.pgdata, gitignored). Production points
 * DATABASE_URL at Neon/Supabase instead and never runs this.
 *
 *   npm run db        # start, stays in the foreground until Ctrl-C
 */
import EmbeddedPostgres from 'embedded-postgres';
import fs from 'node:fs';
import path from 'node:path';

const DATA_DIR = path.resolve(process.cwd(), '.pgdata');
const PORT = Number(process.env.LOCAL_PG_PORT ?? 55432);
const USER = 'volt';
const PASSWORD = 'volt';
const DATABASE = 'voltv';

const pg = new EmbeddedPostgres({
  databaseDir: DATA_DIR,
  user: USER,
  password: PASSWORD,
  port: PORT,
  persistent: true,
});

const alreadyInitialised = fs.existsSync(path.join(DATA_DIR, 'PG_VERSION'));

if (!alreadyInitialised) {
  console.log('[db] initialising cluster in .pgdata (first run only)…');
  await pg.initialise();
}

await pg.start();
console.log(`[db] postgres listening on 127.0.0.1:${PORT}`);

if (!alreadyInitialised) {
  // Created by hand rather than via createDatabase(): initdb picks the host's
  // locale (WIN1252 on this machine) and we need UTF-8 for editorial copy.
  const client = pg.getPgClient('postgres');
  await client.connect();
  await client.query(
    `CREATE DATABASE "${DATABASE}" WITH ENCODING 'UTF8' TEMPLATE template0 LC_COLLATE 'C' LC_CTYPE 'C'`,
  );
  await client.end();
  console.log(`[db] created database "${DATABASE}" (UTF8)`);
}

console.log(
  `[db] DATABASE_URL="postgresql://${USER}:${PASSWORD}@127.0.0.1:${PORT}/${DATABASE}"`,
);
console.log('[db] ready — leave this running, Ctrl-C to stop');

let stopping = false;
const shutdown = async () => {
  if (stopping) return;
  stopping = true;
  console.log('\n[db] stopping…');
  try {
    await pg.stop();
  } catch {
    // server already gone
  }
  process.exit(0);
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
process.on('SIGHUP', shutdown);
