export type Level = 'debug' | 'info' | 'warn' | 'error';
export interface Logger {
  debug(msg: string, fields?: Record<string, unknown>): void;
  info(msg: string, fields?: Record<string, unknown>): void;
  warn(msg: string, fields?: Record<string, unknown>): void;
  error(msg: string, fields?: Record<string, unknown>): void;
}

const ORDER: Record<Level, number> = { debug: 10, info: 20, warn: 30, error: 40 };

/** JSON-lines logger on stderr. Never log message text above `debug`. */
export function createLogger(minLevel: Level = 'info', sink: (line: string) => void = (l) => process.stderr.write(l + '\n')): Logger {
  const write = (level: Level, msg: string, fields?: Record<string, unknown>) => {
    if (ORDER[level] < ORDER[minLevel]) return;
    sink(JSON.stringify({ t: new Date().toISOString(), level, msg, ...fields }));
  };
  return {
    debug: (m, f) => write('debug', m, f),
    info: (m, f) => write('info', m, f),
    warn: (m, f) => write('warn', m, f),
    error: (m, f) => write('error', m, f),
  };
}

export const silentLogger: Logger = { debug() {}, info() {}, warn() {}, error() {} };
