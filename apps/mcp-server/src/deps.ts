import type { Clock } from '@second-opinion/shared';
import type { Db, Repos } from '@second-opinion/store';
import type { Config } from './config';
import type { Logger } from './logging';

export interface Deps {
  db: Db;
  repos: Repos;
  clock: Clock;
  config: Config;
  log: Logger;
}
