import { DatabaseSync } from 'node:sqlite';
import { mkdirSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const MIGRATIONS_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'migrations');

/** A prepared statement. Rows are plain objects; the stores cast them to their row types. */
export interface Stmt {
  run(...params: unknown[]): { changes: number | bigint; lastInsertRowid: number | bigint };
  get(...params: unknown[]): any;
  all(...params: unknown[]): any[];
}

/**
 * A small database handle over Node's built-in SQLite (`node:sqlite`, Node 22+), so installing the project never compiles a native module.
 * It offers the few operations the stores use: prepare/exec, pragma and nestable transactions.
 */
export class Db {
  private depth = 0;

  constructor(private readonly raw: DatabaseSync) {}

  prepare(sql: string): Stmt {
    const st = this.raw.prepare(sql);
    // node:sqlite returns rows with a null prototype; copy them into ordinary objects so equality checks and spreads behave as usual.
    const plain = <T>(row: T): T => (row && typeof row === 'object' ? ({ ...row } as T) : row);
    return {
      run: (...p) => st.run(...(p as never[])),
      get: (...p) => plain(st.get(...(p as never[]))),
      all: (...p) => st.all(...(p as never[])).map(plain),
    };
  }

  exec(sql: string): void {
    this.raw.exec(sql);
  }

  pragma(setting: string): void {
    this.raw.exec(`PRAGMA ${setting}`);
  }

  close(): void {
    this.raw.close();
  }

  /** Returns a function that runs `fn` in a transaction (a savepoint when already inside one). It rolls back and rethrows on error. */
  transaction<T>(fn: () => T): () => T {
    return () => {
      const name = `sp_${this.depth}`;
      this.raw.exec(this.depth === 0 ? 'BEGIN' : `SAVEPOINT ${name}`);
      this.depth++;
      try {
        const result = fn();
        this.depth--;
        this.raw.exec(this.depth === 0 ? 'COMMIT' : `RELEASE ${name}`);
        return result;
      } catch (e) {
        this.depth--;
        this.raw.exec(this.depth === 0 ? 'ROLLBACK' : `ROLLBACK TO ${name}; RELEASE ${name}`);
        throw e;
      }
    };
  }
}

/** Open (and create) a database. `:memory:` is allowed. WAL, foreign keys and a busy timeout are always set. */
export function openDb(path: string): Db {
  if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true });
  const db = new Db(new DatabaseSync(path));
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  db.pragma('busy_timeout = 3000');
  return db;
}

export interface MigrationFile {
  version: number;
  name: string;
  sql: string;
}

export function loadMigrations(dir = MIGRATIONS_DIR): MigrationFile[] {
  return readdirSync(dir)
    .filter((f) => /^\d{3}_.+\.sql$/.test(f))
    .sort()
    .map((f) => ({ version: Number(f.slice(0, 3)), name: f, sql: readFileSync(join(dir, f), 'utf8') }));
}

/** Forward-only migrations, each in its own transaction. Idempotent. Returns versions applied now. */
export function migrate(db: Db, migrations: MigrationFile[] = loadMigrations()): number[] {
  db.exec('CREATE TABLE IF NOT EXISTS schema_migrations (version INTEGER PRIMARY KEY, name TEXT NOT NULL, applied_at TEXT NOT NULL)');
  const done = new Set((db.prepare('SELECT version FROM schema_migrations').all() as { version: number }[]).map((r) => r.version));
  const applied: number[] = [];
  for (const m of migrations) {
    if (done.has(m.version)) continue;
    db.transaction(() => {
      db.exec(m.sql);
      db.prepare('INSERT INTO schema_migrations (version, name, applied_at) VALUES (?, ?, ?)').run(m.version, m.name, new Date().toISOString());
    })();
    applied.push(m.version);
  }
  return applied;
}

export function schemaVersion(db: Db): number {
  const row = db.prepare('SELECT MAX(version) AS v FROM schema_migrations').get() as { v: number | null } | undefined;
  return row?.v ?? 0;
}
