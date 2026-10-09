import type { Db } from '@second-opinion/store';

const BUCKETS_MS = [5, 25, 100, 500, 2500];

/** In-process Prometheus counters for tool calls. Counts only, never message text or ids. */
export class Metrics {
  private calls = new Map<string, number>();
  private hist = new Map<string, { buckets: number[]; sum: number; count: number }>();

  observeTool(tool: string, outcome: 'ok' | 'error', ms: number): void {
    const key = `${tool}\u0000${outcome}`;
    this.calls.set(key, (this.calls.get(key) ?? 0) + 1);
    const h = this.hist.get(tool) ?? { buckets: BUCKETS_MS.map(() => 0), sum: 0, count: 0 };
    BUCKETS_MS.forEach((b, i) => {
      if (ms <= b) h.buckets[i]!++;
    });
    h.sum += ms;
    h.count++;
    this.hist.set(tool, h);
  }

  /** Prometheus text format. Business gauges (checks, holds, queued notifications) are read from the database at scrape time. */
  render(db: Db): string {
    const out: string[] = ['# HELP so_tool_calls_total MCP tool calls by outcome.', '# TYPE so_tool_calls_total counter'];
    for (const [k, v] of [...this.calls].sort()) {
      const [tool, outcome] = k.split('\u0000');
      out.push(`so_tool_calls_total{tool="${tool}",outcome="${outcome}"} ${v}`);
    }
    out.push('# HELP so_tool_duration_ms MCP tool handler time in milliseconds.', '# TYPE so_tool_duration_ms histogram');
    for (const [tool, h] of [...this.hist].sort()) {
      BUCKETS_MS.forEach((b, i) => out.push(`so_tool_duration_ms_bucket{tool="${tool}",le="${b}"} ${h.buckets[i]}`));
      out.push(`so_tool_duration_ms_bucket{tool="${tool}",le="+Inf"} ${h.count}`, `so_tool_duration_ms_sum{tool="${tool}"} ${h.sum}`, `so_tool_duration_ms_count{tool="${tool}"} ${h.count}`);
    }
    const gauge = (name: string, help: string, label: string, sql: string) => {
      out.push(`# HELP ${name} ${help}`, `# TYPE ${name} gauge`);
      for (const r of db.prepare(sql).all() as Array<{ k: string; n: number }>) out.push(`${name}{${label}="${r.k}"} ${r.n}`);
    };
    gauge('so_checks', 'Stored checks by verdict.', 'verdict', 'SELECT verdict AS k, COUNT(*) AS n FROM checks GROUP BY verdict');
    gauge('so_holds', 'Holds by status.', 'status', 'SELECT status AS k, COUNT(*) AS n FROM holds GROUP BY status');
    gauge('so_notifications', 'Notification outbox by status.', 'status', 'SELECT status AS k, COUNT(*) AS n FROM notifications GROUP BY status');
    return out.join('\n') + '\n';
  }
}
