import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { renderNotification } from './templates';
import type { Adapter, Notification } from './types';

/** Logs a one-line summary (no message text beyond the hold description). */
export function consoleAdapter(log: (line: string) => void = (l) => process.stderr.write(l + '\n')): Adapter {
  return {
    channel: 'console',
    send(n: Notification) {
      log(JSON.stringify({ notify: n.kind, to: n.recipientId, hold: n.payload.holdId }));
    },
  };
}

/** The row itself is the in-app inbox entry; nothing else to deliver. */
export function dbAdapter(): Adapter {
  return { channel: 'db', send() {} };
}

export type FileWriter = (path: string, content: string) => void;

const defaultWriter: FileWriter = (path, content) => {
  mkdirSync(join(path, '..'), { recursive: true });
  writeFileSync(path, content, 'utf8');
};

/** Safe file name: ids only contain [a-z0-9_]. Anything else is rejected rather than sanitised. */
const SAFE_ID = /^[A-Za-z0-9_-]{1,80}$/;

/**
 * Writes the rendered HTML email to `<dir>/<notificationId>.html`. NO email is sent (simulated delivery).
 * Idempotent: a re-send overwrites the same file.
 */
export function emailHtmlAdapter(dir: string, write: FileWriter = defaultWriter): Adapter {
  return {
    channel: 'email_html',
    send(n: Notification) {
      if (!SAFE_ID.test(n.id)) throw new Error('unsafe notification id');
      const { html } = renderNotification(n.kind, n.payload);
      write(join(dir, `${n.id}.html`), html);
    },
  };
}
