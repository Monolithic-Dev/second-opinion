import { SIGNAL_LABEL } from '../format';
import type { Insights } from '../types';

/**
 * Charts are plain SVG: no chart library, small bundle, full control over accessibility.
 * Each chart has a text summary for screen readers and a data table fallback, so nothing is conveyed by the picture alone.
 */

const VERDICT_FILL = {
  allow: 'url(#gradAllow)',
  caution: 'url(#gradCaution)',
  hold: 'url(#gradHold)',
} as const;

export function ChecksPerDay({ data }: { data: Insights['checksByDay'] }) {
  if (data.length === 0) return <p className="muted">No checks in this period yet.</p>;
  const W = 640;
  const H = 200;
  const pad = { l: 32, r: 16, t: 16, b: 32 };
  const max = Math.max(1, ...data.map((d) => d.allow + d.caution + d.hold));
  const bw = Math.min(42, Math.max(18, (W - pad.l - pad.r) / data.length - 8));
  const x = (i: number) => pad.l + i * ((W - pad.l - pad.r) / data.length) + 4;
  const y = (v: number) => pad.t + (H - pad.t - pad.b) * (1 - v / max);
  const total = data.reduce((a, d) => a + d.allow + d.caution + d.hold, 0);
  const held = data.reduce((a, d) => a + d.hold, 0);
  const summary = `Checks per day over ${data.length} days: ${total} in total, ${held} held as likely scams.`;

  return (
    <figure style={{ margin: 0, display: 'grid', gap: 'var(--space-3)' }}>
      <svg className="chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={summary}>
        <defs>
          <linearGradient id="gradAllow" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#10b981" />
            <stop offset="100%" stopColor="#047857" />
          </linearGradient>
          <linearGradient id="gradCaution" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#f59e0b" />
            <stop offset="100%" stopColor="#b45309" />
          </linearGradient>
          <linearGradient id="gradHold" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#ef4444" />
            <stop offset="100%" stopColor="#b91c1c" />
          </linearGradient>
        </defs>

        {/* Horizontal gridlines */}
        <line x1={pad.l} x2={W - pad.r} y1={y(max)} y2={y(max)} stroke="var(--border)" strokeDasharray="3,3" />
        <line x1={pad.l} x2={W - pad.r} y1={y(max / 2)} y2={y(max / 2)} stroke="var(--border)" strokeDasharray="3,3" />
        <line x1={pad.l} x2={W - pad.r} y1={y(0)} y2={y(0)} stroke="var(--border-strong)" strokeWidth="1.5" />

        {/* Y Axis text */}
        <text x={pad.l - 8} y={y(max) + 4} textAnchor="end" style={{ fill: 'var(--muted)', fontSize: 11, fontWeight: 600 }}>
          {max}
        </text>
        <text x={pad.l - 8} y={y(0) + 4} textAnchor="end" style={{ fill: 'var(--muted)', fontSize: 11, fontWeight: 600 }}>
          0
        </text>

        {/* Stacked bars */}
        {data.map((d, i) => {
          let top = y(0);
          return (
            <g key={d.date} className="bar-group">
              {(['allow', 'caution', 'hold'] as const).map((k) => {
                const h = (d[k] / max) * (H - pad.t - pad.b);
                top -= h;
                return h > 0 ? (
                  <rect
                    key={k}
                    x={x(i)}
                    y={top}
                    width={bw}
                    height={h}
                    fill={VERDICT_FILL[k]}
                    rx={3}
                    style={{ transition: 'all 0.3s ease' }}
                  />
                ) : null;
              })}
              <text x={x(i) + bw / 2} y={H - 12} textAnchor="middle" style={{ fill: 'var(--muted)', fontSize: 11, fontWeight: 600 }}>
                {d.date.slice(5)}
              </text>
            </g>
          );
        })}
      </svg>

      <figcaption className="row small" style={{ gap: 'var(--space-3)', justifyContent: 'center' }}>
        <span className="row" style={{ gap: 6 }}>
          <span className="badge ok">OK</span>
          <span className="muted">Safe / Approved</span>
        </span>
        <span className="row" style={{ gap: 6 }}>
          <span className="badge warn">Careful</span>
          <span className="muted">Caution required</span>
        </span>
        <span className="row" style={{ gap: 6 }}>
          <span className="badge danger">Held</span>
          <span className="muted">Held as scam</span>
        </span>
      </figcaption>

      <details style={{ marginTop: 'var(--space-2)' }}>
        <summary>Show as a table</summary>
        <div className="table-wrap" style={{ marginTop: 'var(--space-2)' }}>
          <table>
            <thead>
              <tr>
                <th scope="col">Day</th>
                <th scope="col">OK</th>
                <th scope="col">Careful</th>
                <th scope="col">Held</th>
              </tr>
            </thead>
            <tbody>
              {data.map((d) => (
                <tr key={d.date}>
                  <td className="mono">{d.date}</td>
                  <td><span className="badge ok">{d.allow}</span></td>
                  <td><span className="badge warn">{d.caution}</span></td>
                  <td><span className="badge danger">{d.hold}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </figure>
  );
}

export function RedFlagBars({ data }: { data: Insights['topSignals'] }) {
  if (data.length === 0) return <p className="muted">No red flags found in this period.</p>;
  const max = Math.max(...data.map((d) => d.count), 1);
  return (
    <ul className="stack" style={{ listStyle: 'none', padding: 0, margin: 0, gap: 'var(--space-3)' }} aria-label="Most common red flags">
      {data.map((d) => {
        const pct = Math.round((d.count / max) * 100);
        return (
          <li
            key={d.id}
            style={{
              background: 'var(--surface-2)',
              padding: '10px 14px',
              borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--border)',
              display: 'grid',
              gap: '6px',
            }}
          >
            <div className="row small" style={{ justifyContent: 'space-between' }}>
              <span className="grow" style={{ fontWeight: 600, color: 'var(--text)' }}>
                {SIGNAL_LABEL[d.id] ?? d.id}
              </span>
              <div className="row" style={{ gap: 'var(--space-2)' }}>
                <span className="badge danger" style={{ fontSize: '0.75rem' }}>
                  {pct}% of incidents
                </span>
                <strong style={{ fontSize: 'var(--text-base)', color: 'var(--danger)' }}>{d.count}</strong>
              </div>
            </div>
            <div className="bar" aria-hidden="true" style={{ height: 8 }}>
              <span
                style={{
                  width: `${pct}%`,
                  background: 'linear-gradient(90deg, #f87171 0%, #dc2626 100%)',
                }}
              />
            </div>
          </li>
        );
      })}
    </ul>
  );
}
