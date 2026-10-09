import { Link } from 'react-router-dom';
import { Badge, EmptyState, Spinner } from '../../components/parts';
import { timeAgo } from '../../format';
import { useAppState } from '../../hooks/useAppState';

const KIND = { hold_requested: 'New request', hold_escalated: 'Still waiting', hold_resolved: 'Decision made' } as const;
const CHANNEL = { console: 'Log', db: 'In-app', email_html: 'Email (file)' } as const;
const TONE = { queued: 'warn', sent: 'ok', failed: 'danger' } as const;

export function Inbox() {
  const { state } = useAppState();
  if (!state) return <Spinner />;
  const name = (id: string) => state.people.find((p) => p.id === id)?.name ?? id;
  return (
    <div className="stack">
      <h1>Notifications</h1>
      <p className="muted">Everything we told the family, and whether it was delivered. Delivery is simulated: emails are written to a file and nothing is actually sent.</p>
      <div className="card" style={{ padding: 0, overflowX: 'auto' }}>
        {state.notifications.length === 0 ? (
          <EmptyState title="No notifications yet">They appear when a request is paused, escalated or decided.</EmptyState>
        ) : (
          <table>
            <caption className="sr-only">Notifications</caption>
            <thead><tr><th scope="col">Type</th><th scope="col">To</th><th scope="col">About</th><th scope="col">Channel</th><th scope="col">Status</th><th scope="col">When</th></tr></thead>
            <tbody>
              {state.notifications.map((n) => (
                <tr key={n.id}>
                  <td>{KIND[n.kind]}</td>
                  <td>{name(n.recipientId)}</td>
                  <td><Link to={`/family/holds/${n.holdId}`}>{n.description}</Link></td>
                  <td>{CHANNEL[n.channel]}</td>
                  <td><Badge tone={TONE[n.status]}>{n.status === 'sent' ? 'Delivered' : n.status === 'queued' ? 'Queued' : 'Failed'}</Badge>{n.attempts > 1 && <span className="small muted"> · {n.attempts} tries</span>}</td>
                  <td className="muted small">{timeAgo(n.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
