import { pathToFileURL } from 'node:url';
import { systemClock } from '@second-opinion/shared';
import { migrate, openDb, schemaVersion, seedDemo } from '@second-opinion/store';

/** Create the database if needed, apply migrations and (idempotently) seed the fictional demo household. */
export function seed(dbPath = process.env.DB_PATH ?? './data/second-opinion.db'): void {
  const db = openDb(dbPath);
  migrate(db);
  const repos = seedDemo(db, systemClock);
  const people = repos.people.list('hh_demo').map((p) => `${p.name} (${p.role})`).join(', ');
  process.stdout.write(`seeded ${dbPath} (schema v${schemaVersion(db)}): hh_demo -> ${people}\n`);
  db.close();
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) seed();
