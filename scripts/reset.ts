import { rmSync } from 'node:fs';
import { seed } from './seed';

/** Delete the local SQLite files and re-seed the demo household. Safe to run repeatedly. */
const dbPath = process.env.DB_PATH ?? './data/second-opinion.db';
if (dbPath === ':memory:') throw new Error('DB_PATH must be a file path to reset');
for (const suffix of ['', '-wal', '-shm']) rmSync(dbPath + suffix, { force: true });
seed(dbPath);
