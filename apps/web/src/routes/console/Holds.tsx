import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { EmptyState, QuorumMeter, Spinner, StatusBadge } from '../../components/parts';
import { formatMoney, timeAgo } from '../../format';
import { useAppState } from '../../hooks/useAppState';
import type { HoldStatus } from '../../types';

const FILTERS: Array<{ key: 'all' | HoldStatus; label: string }> = [
  { key: 'all', label: 'All' },
  { key: 'pending', label: 'Waiting' },
  { key: 'released', label: 'Approved' },
  { key: 'denied', label: 'Cancelled' },
  { key: 'expired', label: 'Expired' },
];

export function Holds() {
  const { state } = useAppState();
  const [filter, setFilter] = useState<'all' | HoldStatus>('all');
  const navigate = useNavigate();
  if (!state) return <Spinner />;
  const rows = state.holds.filter((h) => filter === 'all' || h.status === filter);

  return (
    <div className="stack" style={{ gap: 'var(--space-4)' }}>
      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 'var(--text-2xl)' }}>Requests</h1>
          <p className="muted small" style={{ margin: 'var(--space-1) 0 0' }}>
            Queue of all purchases, payments, and transfers submitted through Dorothy's Echo
          </p>
        </div>
      </div>

      <div className="chips" role="group" aria-label="Filter by status">
        {FILTERS.map((f) => {
          const count = f.key === 'all' ? state.holds.length : state.holds.filter((h) => h.status === f.key).length;
          const active = filter === f.key;
          return (
            <button
              key={f.key}
              type="button"
              className="chip"
              aria-pressed={active}
              style={
                active
                  ? {
                      background: 'var(--brand)',
                      color: 'var(--brand-ink)',
                      borderColor: 'var(--brand)',
                      fontWeight: 700,
                    }
                  : undefined
              }
              onClick={() => setFilter(f.key)}
            >
              {f.label} ({count})
            </button>
          );
        })}
      </div>

      <div className="card" style={{ padding: 0, overflowX: 'auto', border: '1px solid var(--border)' }}>
        {rows.length === 0 ? (
          <EmptyState title="Nothing here">
            {filter === 'all' ? 'Paused requests will be listed here.' : 'No requests with this status.'}
          </EmptyState>
        ) : (
          <table>
            <caption className="sr-only">Paused requests</caption>
            <thead>
              <tr>
                <th scope="col">Request</th>
                <th scope="col">Amount</th>
                <th scope="col">Status</th>
                <th scope="col">Approvals</th>
                <th scope="col">When</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((h) => (
                <tr key={h.holdId} className="link" onClick={() => navigate(`/family/holds/${h.holdId}`)}>
                  <td>
                    <Link
                      to={`/family/holds/${h.holdId}`}
                      style={{ fontWeight: 600, color: 'var(--text)', display: 'block' }}
                    >
                      {h.description}
                    </Link>
                    {h.flags.length > 0 && (
                      <div className="small muted" style={{ marginTop: 2 }}>
                        {h.flags.slice(0, 2).join(' · ')}
                      </div>
                    )}
                  </td>
                  <td>
                    <span
                      style={{
                        fontWeight: 700,
                        fontSize: 'var(--text-base)',
                        fontFamily: 'var(--mono)',
                        color: 'var(--text)',
                      }}
                    >
                      {formatMoney(h.amountCents)}
                    </span>
                  </td>
                  <td>
                    <StatusBadge status={h.status} />
                  </td>
                  <td>
                    <QuorumMeter approve={h.votes.approve} deny={h.votes.deny} required={h.quorumRequired} />
                  </td>
                  <td className="muted small" style={{ whiteSpace: 'nowrap' }}>
                    {timeAgo(h.createdAt)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
