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
    <div className="stack">
      <h1>Requests</h1>
      <div className="chips" role="group" aria-label="Filter by status">
        {FILTERS.map((f) => (
          <button key={f.key} type="button" className="chip" aria-pressed={filter === f.key} style={filter === f.key ? { background: 'var(--brand-soft)', borderColor: 'var(--brand)' } : undefined} onClick={() => setFilter(f.key)}>
            {f.label} ({f.key === 'all' ? state.holds.length : state.holds.filter((h) => h.status === f.key).length})
          </button>
        ))}
      </div>
      <div className="card" style={{ padding: 0, overflowX: 'auto' }}>
        {rows.length === 0 ? (
          <EmptyState title="Nothing here">{filter === 'all' ? 'Paused requests will be listed here.' : 'No requests with this status.'}</EmptyState>
        ) : (
          <table>
            <caption className="sr-only">Paused requests</caption>
            <thead><tr><th scope="col">Request</th><th scope="col">Amount</th><th scope="col">Status</th><th scope="col">Approvals</th><th scope="col">When</th></tr></thead>
            <tbody>
              {rows.map((h) => (
                <tr key={h.holdId} className="link" onClick={() => navigate(`/family/holds/${h.holdId}`)}>
                  <td><Link to={`/family/holds/${h.holdId}`}>{h.description}</Link><div className="small muted">{h.flags.slice(0, 2).join(' · ')}</div></td>
                  <td>{formatMoney(h.amountCents)}</td>
                  <td><StatusBadge status={h.status} /></td>
                  <td><QuorumMeter approve={h.votes.approve} deny={h.votes.deny} required={h.quorumRequired} /></td>
                  <td className="muted small">{timeAgo(h.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
