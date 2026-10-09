import { Link, useParams } from 'react-router-dom';
import { api } from '../../api';
import { ErrorNote, QuorumMeter, Spinner, StatusBadge } from '../../components/parts';
import { VoteButtons } from '../../components/VoteButtons';
import { formatDateTime, formatMoney, timeLeft } from '../../format';
import { useAppState } from '../../hooks/useAppState';
import { useAuth } from '../../hooks/useAuth';
import { useLive } from '../../hooks/useLive';

export function HoldDetailPage() {
  const { holdId = '' } = useParams();
  const { personId } = useAuth();
  const { refresh } = useAppState();
  const detail = useLive(() => api.holdDetail(holdId), [holdId]);

  if (detail.loading && !detail.data) return <Spinner />;
  if (!detail.data) return <div className="stack"><Link to="/family/holds">Back to requests</Link><ErrorNote message={detail.error ?? 'Request not found.'} /></div>;

  const { hold, risk, votes, timeline } = detail.data;
  const pending = hold.status === 'pending';
  const approves = votes.filter((v) => v.decision === 'approve').length;
  const denies = votes.filter((v) => v.decision === 'deny').length;
  const iVoted = votes.some((v) => v.approverId === personId);

  return (
    <div className="stack">
      <Link to="/family/holds">← All requests</Link>
      <div className="row">
        <h1 className="grow" style={{ margin: 0 }}>{hold.description}</h1>
        <StatusBadge status={hold.status} />
      </div>
      <p className="muted" style={{ margin: 0 }}>
        {formatMoney(hold.amountCents)}{hold.payee ? ` to ${hold.payee}` : ''} · asked {formatDateTime(hold.createdAt)}
        {pending ? ` · ${timeLeft(hold.expiresAt)}` : hold.resolvedAt ? ` · decided ${formatDateTime(hold.resolvedAt)}` : ''}
      </p>

      <div className="split">
        <div className="stack">
          <section className="card" aria-labelledby="said">
            <h2 id="said">What was said</h2>
            <blockquote style={{ margin: 0, paddingLeft: 12, borderLeft: '4px solid var(--border)' }}>{risk.text || 'Not recorded'}</blockquote>
          </section>
          <section className={`risk ${risk.verdict}`} aria-labelledby="why" style={{ marginTop: 0 }}>
            <h3 id="why">Why it was paused</h3>
            {risk.flags.length > 0 ? <ul>{risk.flags.map((f) => <li key={f}>{f}</li>)}</ul> : <p>No scam red flags; paused by your household rules.</p>}
            {risk.reasonText.length > 0 && <p className="advice">Household rules: {risk.reasonText.join('; ')}</p>}
          </section>
          <section className="card" aria-labelledby="tl">
            <h2 id="tl">What happened</h2>
            <ol className="timeline">
              {timeline.map((e, i) => (
                <li key={i}><strong>{e.label}</strong>{e.by ? ` · ${e.by}` : ''}<div className="small muted">{formatDateTime(e.at)}</div></li>
              ))}
            </ol>
            {hold.escalationLevel > 0 && <p className="small muted">Escalated to the next approver after waiting.</p>}
          </section>
        </div>

        <div className="stack">
          <section className="card" aria-labelledby="decision">
            <h2 id="decision">{pending ? 'Your decision' : 'Decision'}</h2>
            <QuorumMeter approve={approves} deny={denies} required={hold.quorumRequired} />
            {votes.length > 0 && (
              <ul className="stack" style={{ listStyle: 'none', padding: 0 }}>
                {votes.map((v) => (
                  <li key={v.approverId}><strong>{v.name}</strong> {v.decision === 'approve' ? 'approved' : 'declined'}{v.note ? ` · “${v.note}”` : ''}<div className="small muted">{formatDateTime(v.decidedAt)}</div></li>
                ))}
              </ul>
            )}
            {pending ? (
              <VoteButtons holdId={hold.holdId} alreadyVoted={iVoted} onVoted={() => { void detail.reload(); void refresh(); }} />
            ) : (
              <p className="muted">This request is closed.{hold.status === 'expired' ? ' Nobody answered in time, so it stayed blocked.' : ''}</p>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
