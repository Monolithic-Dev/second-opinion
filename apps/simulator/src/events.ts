import type { Response } from 'express';

export const MAX_SSE_CLIENTS = 50;

export type EventType = 'hold.created' | 'hold.resolved' | 'check.done' | 'policy.updated' | 'payee.updated' | 'reset';
export type Publish = (type: EventType, data: Record<string, unknown>) => void;

/** Server-sent events fan-out. One stream per open page; heartbeats keep proxies from closing idle streams. */
export class EventHub {
  private clients = new Set<Response>();
  private nextId = 1;

  get size(): number {
    return this.clients.size;
  }

  /** Returns false (and writes nothing) when the connection cap is reached. */
  subscribe(res: Response, heartbeatMs = 15_000): boolean {
    if (this.clients.size >= MAX_SSE_CLIENTS) return false;
    res.status(200).set({
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    });
    res.flushHeaders?.();
    res.write('retry: 2000\n: connected\n\n');
    this.clients.add(res);
    const beat = setInterval(() => res.write(': ping\n\n'), heartbeatMs);
    beat.unref();
    res.on('close', () => {
      clearInterval(beat);
      this.clients.delete(res);
    });
    return true;
  }

  publish: Publish = (type, data) => {
    const frame = `id: ${this.nextId++}\nevent: ${type}\ndata: ${JSON.stringify({ ...data, at: new Date().toISOString() })}\n\n`;
    for (const c of this.clients) {
      try {
        c.write(frame);
      } catch {
        this.clients.delete(c);
      }
    }
  };

  closeAll(): void {
    for (const c of this.clients) c.end();
    this.clients.clear();
  }
}
