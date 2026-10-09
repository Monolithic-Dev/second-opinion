import { useEffect, useRef, useState } from 'react';

export const EVENT_TYPES = ['hold.created', 'hold.resolved', 'check.done', 'policy.updated', 'payee.updated', 'reset'] as const;
export type EventName = (typeof EVENT_TYPES)[number];

/**
 * Subscribe to the simulator's server-sent events. The browser reconnects by itself; `connected` reflects the stream state so the
 * UI can say when live updates are paused. The handler is kept in a ref so callers don't need to memoise it.
 */
export function useEvents(onEvent: (type: EventName, data: Record<string, unknown>) => void): boolean {
  const handler = useRef(onEvent);
  handler.current = onEvent;
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    if (typeof EventSource === 'undefined') return;
    const es = new EventSource('/api/events');
    es.onopen = () => setConnected(true);
    es.onerror = () => setConnected(false);
    for (const type of EVENT_TYPES) {
      es.addEventListener(type, (e) => {
        try {
          handler.current(type, JSON.parse((e as MessageEvent<string>).data) as Record<string, unknown>);
        } catch {
          /* ignore a malformed frame */
        }
      });
    }
    return () => es.close();
  }, []);

  return connected;
}
