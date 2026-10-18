import { Link, useParams } from 'react-router-dom';
import { api } from '../../api';
import { ErrorNote, QuorumMeter, Spinner, StatusBadge } from '../../components/parts';
import { VoteButtons } from '../../components/VoteButtons';
import { IconAlertTriangle } from '../../components/icons';
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
  if (!detail.data) {
    return (
      <div className="stack">
        <Link to="/family/holds">← All requests</Link>
        <ErrorNote message={detail.error ?? 'Request not found.'} />
      </div>
    );
  }

  const { hold, risk, votes, timeline } = detail.data;
  const pending = hold.status === 'pending';
  const approves = votes.filter((v) => v.decision === 'approve').length;
  const denies = votes.filter((v) => v.decision === 'deny').length;
  const iVoted = votes.some((v) => v.approverId === personId);

  return (
    <div className="stack" style={{ gap: 'var(--space-4)' }}>
      <div className="row" style={{ gap: 'var(--space-2)' }}>
        <Link to="/family/holds" style={{ fontWeight: 600 }}>
          ← All requests
        </Link>
      </div>

      <div
        className="card"
        style={{
          background: 'linear-gradient(180deg, var(--surface) 0%, var(--surface-2) 100%)',
          borderLeft: pending ? '6px solid var(--danger)' : '6px solid var(--ok)',
          padding: 'var(--space-5)',
        }}
      >
        <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div className="grow">
            <div className="row" style={{ gap: 'var(--space-2)', marginBottom: 'var(--space-1)' }}>
              <span className="small mono muted">ID: {hold.holdId}</span>
              <span
                className={`badge ${risk.verdict === 'hold' ? 'danger' : risk.verdict === 'caution' ? 'warn' : 'ok'}`}
                style={{ fontSize: '0.72rem' }}
              >
                Risk Score: {risk.score}/100
              </span>
            </div>
            <h1 style={{ margin: 0, fontSize: 'var(--text-2xl)' }}>{hold.description}</h1>
            <p className="muted" style={{ margin: 'var(--space-2) 0 0', fontSize: 'var(--text-base)' }}>
              <strong style={{ color: 'var(--text)', fontSize: 'var(--text-lg)', fontFamily: 'var(--mono)' }}>
                {formatMoney(hold.amountCents)}
              </strong>
              {hold.payee ? ` to ${hold.payee}` : ''} · asked {formatDateTime(hold.createdAt)}
              {pending
                ? ` · ${timeLeft(hold.expiresAt)}`
                : hold.resolvedAt
                  ? ` · decided ${formatDateTime(hold.resolvedAt)}`
                  : ''}
            </p>
          </div>
          <StatusBadge status={hold.status} />
        </div>
      </div>

      <div className="split" style={{ gridTemplateColumns: 'minmax(0, 1.3fr) minmax(0, 1fr)' }}>
        <div className="stack" style={{ gap: 'var(--space-4)' }}>
          <section className="card" aria-labelledby="said">
            <h2 id="said">What was said</h2>
            <blockquote
              style={{
                margin: 0,
                padding: 'var(--space-3) var(--space-4)',
                background: 'var(--surface-2)',
                borderLeft: '4px solid var(--brand)',
                borderRadius: '0 var(--radius-sm) var(--radius-sm) 0',
                color: 'var(--text)',
                fontStyle: 'normal',
                fontSize: 'var(--text-base)',
                lineHeight: 1.5,
              }}
            >
              {risk.text || 'Not recorded'}
            </blockquote>
          </section>

          <section className={`risk ${risk.verdict}`} aria-labelledby="why" style={{ marginTop: 0 }}>
            <h3 id="why">Why it was paused</h3>
            {risk.flags.length > 0 ? (
              <ul>
                {risk.flags.map((f) => (
                  <li key={f}>{f}</li>
                ))}
              </ul>
            ) : (
              <p>No scam red flags; paused by your household rules.</p>
            )}
            {risk.reasonText.length > 0 && <p className="advice">Household rules: {risk.reasonText.join('; ')}</p>}
          </section>

          <section className="card" aria-labelledby="tl">
            <h2 id="tl">What happened</h2>
            <ol className="timeline">
              {timeline.map((e, i) => (
                <li key={i}>
                  <strong>{e.label}</strong>
                  {e.by ? ` · ${e.by}` : ''}
                  <div className="small muted">{formatDateTime(e.at)}</div>
                </li>
              ))}
            </ol>
            {hold.escalationLevel > 0 && (
              <div
                className="row small muted"
                style={{
                  marginTop: 'var(--space-2)',
                  background: 'var(--surface-2)',
                  padding: '8px 12px',
                  borderRadius: 'var(--radius-xs)',
                  gap: 6,
                  alignItems: 'center',
                }}
              >
                <IconAlertTriangle size={15} style={{ color: 'var(--warn)' }} />
                <span>Escalated to the next approver after waiting.</span>
              </div>
            )}
          </section>
        </div>

        <div className="stack" style={{ gap: 'var(--space-4)' }}>
          <section className="card" aria-labelledby="decision">
            <h2 id="decision">{pending ? 'Your decision' : 'Decision'}</h2>
            <div style={{ marginBottom: 'var(--space-3)' }}>
              <QuorumMeter approve={approves} deny={denies} required={hold.quorumRequired} />
            </div>

            {votes.length > 0 && (
              <ul className="stack" style={{ listStyle: 'none', padding: 0, gap: 'var(--space-2)' }}>
                {votes.map((v) => (
                  <li
                    key={v.approverId}
                    style={{
                      background: 'var(--surface-2)',
                      padding: '10px 14px',
                      borderRadius: 'var(--radius-sm)',
                      border: '1px solid var(--border)',
                    }}
                  >
                    <div>
                      <strong>{v.name}</strong> {v.decision === 'approve' ? 'approved' : 'declined'}
                      {v.note ? ` · “${v.note}”` : ''}
                    </div>
                    <div className="small muted">{formatDateTime(v.decidedAt)}</div>
                  </li>
                ))}
              </ul>
            )}

            {pending ? (
              <VoteButtons
                holdId={hold.holdId}
                alreadyVoted={iVoted}
                onVoted={() => {
                  void detail.reload();
                  void refresh();
                }}
              />
            ) : (
              <div
                className="muted"
                style={{
                  background: 'var(--surface-2)',
                  padding: '12px 16px',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--border)',
                }}
              >
                This request is closed.
                {hold.status === 'expired' ? ' Nobody answered in time, so it stayed blocked.' : ''}
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
