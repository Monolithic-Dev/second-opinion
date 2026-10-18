import { formatMoney, timeLeft } from '../format';
import type { HoldRow } from '../types';
import { QuorumMeter, StatusBadge } from './parts';
import { VoteButtons } from './VoteButtons';

interface Props {
  hold: HoldRow;
  /** The signed-in approver already voted on this hold. */
  alreadyVoted?: boolean;
  onVoted: () => void;
  now?: Date;
}

/** A paused request as a family member sees it, with the Approve / Deny decision. */
export function HoldCard({ hold, alreadyVoted = false, onVoted, now }: Props) {
  const pending = hold.status === 'pending';
  return (
    <article
      className="card"
      aria-labelledby={`h-${hold.holdId}`}
      style={{
        borderTop: pending ? '4px solid var(--danger)' : undefined,
        background: 'var(--surface)',
        display: 'grid',
        gap: 'var(--space-2)',
      }}
    >
      <div className="row" style={{ alignItems: 'flex-start', gap: 'var(--space-2)' }}>
        <h3 id={`h-${hold.holdId}`} className="grow" style={{ margin: 0, fontSize: 'var(--text-base)', lineHeight: 1.3 }}>
          {hold.description}
        </h3>
        <StatusBadge status={hold.status} />
      </div>

      <p className="muted small" style={{ margin: 0 }}>
        {formatMoney(hold.amountCents)}
        {hold.payee ? ` · ${hold.payee}` : ''}
        {pending ? ` · ${timeLeft(hold.expiresAt, now)}` : ''}
      </p>

      {hold.flags.length > 0 && (
        <ul
          className="small"
          aria-label="Why it looks risky"
          style={{
            margin: 'var(--space-1) 0',
            paddingLeft: '1.4em',
            display: 'grid',
            gap: 2,
            color: 'var(--danger)',
            fontWeight: 500,
          }}
        >
          {hold.flags.map((f) => (
            <li key={f}>{f}</li>
          ))}
        </ul>
      )}

      {hold.reasonText.length > 0 && (
        <p className="small muted" style={{ margin: 'var(--space-1) 0' }}>
          Household rules: {hold.reasonText.join('; ')}
        </p>
      )}

      <div style={{ paddingTop: 'var(--space-1)', borderTop: '1px solid var(--border)' }}>
        <QuorumMeter approve={hold.votes.approve} deny={hold.votes.deny} required={hold.quorumRequired} />
      </div>

      {pending && <VoteButtons holdId={hold.holdId} alreadyVoted={alreadyVoted} onVoted={onVoted} />}
    </article>
  );
}
