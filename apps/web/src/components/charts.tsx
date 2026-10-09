import { SIGNAL_LABEL } from '../format';
import type { Insights } from '../types';

/**
 * Charts are plain SVG: no chart library, small bundle, full control over accessibility. Each chart has a text summary for
 * screen readers and a data table fallback, so nothing is conveyed by the picture alone.
 */

const VERDICT_FILL = { allow: 'var(--ok)', caution: 'var(--warn)', hold: 'var(--danger)' } as const;

export function ChecksPerDay({ data }: { data: Insights['checksByDay'] }) {
  if (data.length === 0) return <p className="muted">No checks in this period yet.</p>;
  const W = 640;
  const H = 180;
  const pad = { l: 28, r: 8, t: 8, b: 28 };
  const max = Math.max(1, ...data.map((d) => d.allow + d.caution + d.hold));
  const bw = Math.min(40, (W - pad.l - pad.r) / data.length - 6);
  const x = (i: number) => pad.l + i * ((W - pad.l - pad.r) / data.length) + 3;
  const y = (v: number) => pad.t + (H - pad.t - pad.b) * (1 - v / max);
  const total = data.reduce((a, d) => a + d.allow + d.caution + d.hold, 0);
  const held = data.reduce((a, d) => a + d.hold, 0);
  const summary = `Checks per day over ${data.length} days: ${total} in total, ${held} held as likely scams.`;

  return (
    <figure style={{ margin: 0 }}>
      <svg className="chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={summary}>
        <line x1={pad.l} x2={W - pad.r} y1={y(0)} y2={y(0)} stroke="var(--border)" />
        <text x={pad.l - 6} y={y(max) + 4} textAnchor="end">{max}</text>
        <text x={pad.l - 6} y={y(0) + 4} textAnchor="end">0</text>
        {data.map((d, i) => {
          let top = y(0);
          return (
            <g key={d.date}>
              {(['allow', 'caution', 'hold'] as const).map((k) => {
                const h = (d[k] / max) * (H - pad.t - pad.b);
                top -= h;
                return h > 0 ? <rect key={k} x={x(i)} y={top} width={bw} height={h} fill={VERDICT_FILL[k]} rx={2} /> : null;
              })}
              <text x={x(i) + bw / 2} y={H - 10} textAnchor="middle">{d.date.slice(5)}</text>
            </g>
          );
        })}
      </svg>
      <figcaption className="row small muted">
        <span><span className="badge ok">OK</span></span>
        <span><span className="badge warn">Careful</span></span>
        <span><span className="badge danger">Held</span></span>
      </figcaption>
      <details>
        <summary>Show as a table</summary>
        <table>
          <thead><tr><th>Day</th><th>OK</th><th>Careful</th><th>Held</th></tr></thead>
          <tbody>{data.map((d) => <tr key={d.date}><td>{d.date}</td><td>{d.allow}</td><td>{d.caution}</td><td>{d.hold}</td></tr>)}</tbody>
        </table>
      </details>
    </figure>
  );
}

export function RedFlagBars({ data }: { data: Insights['topSignals'] }) {
  if (data.length === 0) return <p className="muted">No red flags found in this period.</p>;
  const max = Math.max(...data.map((d) => d.count));
  return (
    <ul className="stack" style={{ listStyle: 'none', padding: 0, margin: 0 }} aria-label="Most common red flags">
      {data.map((d) => (
        <li key={d.id}>
          <div className="row small"><span className="grow">{SIGNAL_LABEL[d.id] ?? d.id}</span><strong>{d.count}</strong></div>
          <div className="bar" aria-hidden="true"><span style={{ width: `${(d.count / max) * 100}%` }} /></div>
        </li>
      ))}
    </ul>
  );
}
