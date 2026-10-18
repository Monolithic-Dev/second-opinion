import { Link } from 'react-router-dom';
import { Badge, EmptyState, Spinner } from '../../components/parts';
import { timeAgo } from '../../format';
import { useAppState } from '../../hooks/useAppState';

const KIND = {
  hold_requested: 'New request',
  hold_escalated: 'Still waiting',
  hold_resolved: 'Decision made',
} as const;

const CHANNEL = {
  console: 'Log',
  db: 'In-app',
  email_html: 'Email (file)',
} as const;

const CHANNEL_ICON = {
  console: '💻',
  db: '📱',
  email_html: '✉️',
} as const;

const TONE = {
  queued: 'warn',
  sent: 'ok',
  failed: 'danger',
} as const;

export function Inbox() {
  const { state } = useAppState();
  if (!state) return <Spinner />;
  const name = (id: string) => state.people.find((p) => p.id === id)?.name ?? id;

  return (
    <div className="stack" style={{ gap: 'var(--space-4)' }}>
      <div>
        <h1 style={{ margin: 0, fontSize: 'var(--text-2xl)' }}>Notifications</h1>
        <p className="muted small" style={{ margin: 'var(--space-1) 0 0' }}>
          Everything we told the family, and whether it was delivered. Delivery is simulated: emails are written to a file and nothing is actually sent.
        </p>
      </div>

      <div className="card" style={{ padding: 0, overflowX: 'auto', border: '1px solid var(--border)' }}>
        {state.notifications.length === 0 ? (
          <EmptyState title="No notifications yet">
            They appear when a request is paused, escalated or decided.
          </EmptyState>
        ) : (
          <table>
            <caption className="sr-only">Notifications</caption>
            <thead>
              <tr>
                <th scope="col">Type</th>
                <th scope="col">To</th>
                <th scope="col">About</th>
                <th scope="col">Channel</th>
                <th scope="col">Status</th>
                <th scope="col">When</th>
              </tr>
            </thead>
            <tbody>
              {state.notifications.map((n) => (
                <tr key={n.id}>
                  <td>
                    <span style={{ fontWeight: 600, color: 'var(--text)' }}>
                      {KIND[n.kind]}
                    </span>
                  </td>
                  <td>
                    <span style={{ fontWeight: 500 }}>{name(n.recipientId)}</span>
                  </td>
                  <td>
                    <Link
                      to={`/family/holds/${n.holdId}`}
                      style={{ fontWeight: 600, color: 'var(--brand)' }}
                    >
                      {n.description}
                    </Link>
                  </td>
                  <td>
                    <span className="row small" style={{ gap: 6 }}>
                      <span aria-hidden="true">{CHANNEL_ICON[n.channel]}</span>
                      <span>{CHANNEL[n.channel]}</span>
                    </span>
                  </td>
                  <td>
                    <div className="row" style={{ gap: 6 }}>
                      <Badge tone={TONE[n.status]}>
                        {n.status === 'sent' ? 'Delivered' : n.status === 'queued' ? 'Queued' : 'Failed'}
                      </Badge>
                      {n.attempts > 1 && (
                        <span className="small muted" style={{ fontFamily: 'var(--mono)' }}>
                          · {n.attempts} tries
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="muted small" style={{ whiteSpace: 'nowrap' }}>
                    {timeAgo(n.createdAt)}
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
