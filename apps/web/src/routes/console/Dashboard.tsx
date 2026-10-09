import { Link } from 'react-router-dom';
import { api } from '../../api';
import { ChecksPerDay, RedFlagBars } from '../../components/charts';
import { EmptyState, ErrorNote, Spinner, StatusBadge } from '../../components/parts';
import { formatDuration, formatMoney, timeAgo } from '../../format';
import { useAppState } from '../../hooks/useAppState';
import { useLive } from '../../hooks/useLive';

export function Dashboard() {
  const { state } = useAppState();
  const insights = useLive(() => api.insights(30), []);
  if (!state) return <Spinner />;

  const pending = state.holds.filter((h) => h.status === 'pending');
  const i = insights.data;
  const checks = i ? i.checksByDay.reduce((a, d) => a + d.allow + d.caution + d.hold, 0) : 0;
  const elder = state.people.find((p) => p.role === 'elder')?.name ?? 'Your family member';

  return (
    <div className="stack">
      <h1>Overview</h1>
      {pending.length > 0 ? (
        <div className="banner warn" role="status">
          <span aria-hidden="true">!</span>
          <span className="grow">{pending.length} {pending.length === 1 ? 'request needs' : 'requests need'} your decision</span>
          <Link className="btn" to="/family/holds">Review</Link>
        </div>
      ) : (
        <div className="banner ok" role="status"><span aria-hidden="true">✓</span>{elder} is protected. Nothing needs your attention.</div>
      )}

      <section className="tiles" aria-label="Last 30 days">
        <div className="card tile good"><div className="muted small">Protected, last 30 days</div><div className="value">{i ? formatMoney(i.protectedCents) : '—'}</div><div className="small muted">in requests cancelled or left blocked</div></div>
        <div className="card tile"><div className="muted small">Waiting for a decision</div><div className="value">{pending.length}</div></div>
        <div className="card tile"><div className="muted small">Requests checked</div><div className="value">{i ? checks : '—'}</div></div>
        <div className="card tile"><div className="muted small">Median time to decide</div><div className="value">{i ? formatDuration(i.medianResponseSec) : '—'}</div></div>
      </section>
      {insights.error && <ErrorNote message={insights.error} />}

      <div className="split" style={{ gridTemplateColumns: 'minmax(0,1.4fr) minmax(0,1fr)' }}>
        <section className="card" aria-labelledby="chk">
          <h2 id="chk">Requests checked per day</h2>
          {insights.loading ? <Spinner /> : i && <ChecksPerDay data={i.checksByDay} />}
        </section>
        <section className="card" aria-labelledby="flags">
          <h2 id="flags">Most common red flags</h2>
          {i && <RedFlagBars data={i.topSignals} />}
        </section>
      </div>

      <section className="card" aria-labelledby="recent">
        <div className="row"><h2 id="recent" className="grow">Recent requests</h2><Link to="/family/holds">See all</Link></div>
        {state.holds.length === 0 ? (
          <EmptyState title="No paused requests yet">When something looks risky, it will appear here.</EmptyState>
        ) : (
          <ul className="stack" style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            {state.holds.slice(0, 6).map((h) => (
              <li key={h.holdId} className="row">
                <Link className="grow" to={`/family/holds/${h.holdId}`}>{h.description}</Link>
                <span className="muted small">{formatMoney(h.amountCents)} · {timeAgo(h.createdAt)}</span>
                <StatusBadge status={h.status} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
