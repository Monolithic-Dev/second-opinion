import { Link } from 'react-router-dom';
import { api } from '../../api';
import { ChecksPerDay, RedFlagBars } from '../../components/charts';
import { EmptyState, ErrorNote, Spinner, StatusBadge } from '../../components/parts';
import { formatDuration, formatMoney, timeAgo } from '../../format';
import { useAppState } from '../../hooks/useAppState';
import { useLive } from '../../hooks/useLive';
import { IconShieldCheck, IconClock, IconSearch, IconZap, IconAlertTriangle, IconCheckCircle } from '../../components/icons';

export function Dashboard() {
  const { state } = useAppState();
  const insights = useLive(() => api.insights(30), []);
  if (!state) return <Spinner />;

  const pending = state.holds.filter((h) => h.status === 'pending');
  const i = insights.data;
  const checks = i ? i.checksByDay.reduce((a, d) => a + d.allow + d.caution + d.hold, 0) : 0;
  const elder = state.people.find((p) => p.role === 'elder')?.name ?? 'Your family member';

  return (
    <div className="stack" style={{ gap: 'var(--space-5)' }}>
      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 'var(--text-2xl)' }}>Overview</h1>
          <p className="muted small" style={{ margin: 'var(--space-1) 0 0' }}>
            Real-time protection status, active review queue, and 30-day threat metrics
          </p>
        </div>
        <div className="status-pill ok" style={{ fontSize: '0.75rem', padding: '4px 10px' }}>
          <span className="pulse-dot" />
          Guard Active
        </div>
      </div>

      {pending.length > 0 ? (
        <div className="banner warn" role="status" style={{ borderLeft: '6px solid var(--warn)' }}>
          <IconAlertTriangle size={20} style={{ color: 'var(--warn)', flexShrink: 0 }} />
          <span className="grow">
            {pending.length} {pending.length === 1 ? 'request needs' : 'requests need'} your decision
          </span>
          <Link className="btn" to="/family/holds" style={{ background: 'var(--surface)', borderColor: 'var(--warn)' }}>
            Review
          </Link>
        </div>
      ) : (
        <div className="banner ok" role="status" style={{ borderLeft: '6px solid var(--ok)' }}>
          <IconCheckCircle size={20} style={{ color: 'var(--ok)', flexShrink: 0 }} />
          <span>{elder} is protected. Nothing needs your attention.</span>
        </div>
      )}

      <section className="tiles" aria-label="Last 30 days">
        <div className="card tile good">
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <div className="muted small" style={{ fontWeight: 600 }}>Protected, last 30 days</div>
            <div style={{ color: 'var(--ok)' }}><IconShieldCheck size={20} /></div>
          </div>
          <div className="value">{i ? formatMoney(i.protectedCents) : '—'}</div>
          <div className="small muted">in requests cancelled or left blocked</div>
        </div>

        <div className="card tile">
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <div className="muted small" style={{ fontWeight: 600 }}>Waiting for a decision</div>
            <div style={{ color: pending.length > 0 ? 'var(--warn)' : 'var(--muted)' }}><IconClock size={20} /></div>
          </div>
          <div className="value" style={{ color: pending.length > 0 ? 'var(--warn)' : 'var(--text)' }}>
            {pending.length}
          </div>
          <div className="small muted">pending family confirmation</div>
        </div>

        <div className="card tile">
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <div className="muted small" style={{ fontWeight: 600 }}>Requests checked</div>
            <div style={{ color: 'var(--brand)' }}><IconSearch size={20} /></div>
          </div>
          <div className="value">{i ? checks : '—'}</div>
          <div className="small muted">total checks processed</div>
        </div>

        <div className="card tile">
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <div className="muted small" style={{ fontWeight: 600 }}>Median time to decide</div>
            <div style={{ color: 'var(--info)' }}><IconZap size={20} /></div>
          </div>
          <div className="value">{i ? formatDuration(i.medianResponseSec) : '—'}</div>
          <div className="small muted">average caregiver turnaround</div>
        </div>
      </section>

      {insights.error && <ErrorNote message={insights.error} />}

      <div className="split" style={{ gridTemplateColumns: 'minmax(0,1.4fr) minmax(0,1fr)' }}>
        <section className="card" aria-labelledby="chk">
          <div className="row" style={{ justifyContent: 'space-between', marginBottom: 'var(--space-3)' }}>
            <h2 id="chk" style={{ margin: 0 }}>Requests checked per day</h2>
            <span className="small muted">Volume by risk classification</span>
          </div>
          {insights.loading ? <Spinner /> : i && <ChecksPerDay data={i.checksByDay} />}
        </section>

        <section className="card" aria-labelledby="flags">
          <div className="row" style={{ justifyContent: 'space-between', marginBottom: 'var(--space-3)' }}>
            <h2 id="flags" style={{ margin: 0 }}>Most common red flags</h2>
            <span className="small muted">Top scam signals</span>
          </div>
          {i && <RedFlagBars data={i.topSignals} />}
        </section>
      </div>

      <section className="card" aria-labelledby="recent">
        <div className="row" style={{ justifyContent: 'space-between', marginBottom: 'var(--space-3)' }}>
          <h2 id="recent" style={{ margin: 0 }}>Recent requests</h2>
          <Link to="/family/holds" className="small" style={{ fontWeight: 600 }}>
            See all →
          </Link>
        </div>
        {state.holds.length === 0 ? (
          <EmptyState title="No paused requests yet">
            When something looks risky, it will appear here.
          </EmptyState>
        ) : (
          <ul className="stack" style={{ listStyle: 'none', padding: 0, margin: 0, gap: 'var(--space-2)' }}>
            {state.holds.slice(0, 6).map((h) => (
              <li
                key={h.holdId}
                className="row"
                style={{
                  padding: '12px 14px',
                  background: 'var(--surface-2)',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--border)',
                  transition: 'all var(--transition-fast)',
                }}
              >
                <Link
                  className="grow"
                  to={`/family/holds/${h.holdId}`}
                  style={{ fontWeight: 600, color: 'var(--text)' }}
                >
                  {h.description}
                </Link>
                <span className="muted small">
                  {formatMoney(h.amountCents)} · {timeAgo(h.createdAt)}
                </span>
                <StatusBadge status={h.status} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
