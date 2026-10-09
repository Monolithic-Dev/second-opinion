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
    <article className="card" aria-labelledby={`h-${hold.holdId}`}>
      <div className="row">
        <h3 id={`h-${hold.holdId}`} className="grow">{hold.description}</h3>
        <StatusBadge status={hold.status} />
      </div>
      <p className="muted small">
        {formatMoney(hold.amountCents)}
        {hold.payee ? ` · ${hold.payee}` : ''}
        {pending ? ` · ${timeLeft(hold.expiresAt, now)}` : ''}
      </p>
      {hold.flags.length > 0 && (
        <ul className="small" aria-label="Why it looks risky">
          {hold.flags.map((f) => <li key={f}>{f}</li>)}
        </ul>
      )}
      {hold.reasonText.length > 0 && <p className="small muted">Household rules: {hold.reasonText.join('; ')}</p>}
      <QuorumMeter approve={hold.votes.approve} deny={hold.votes.deny} required={hold.quorumRequired} />
      {pending && <VoteButtons holdId={hold.holdId} alreadyVoted={alreadyVoted} onVoted={onVoted} />}
    </article>
  );
}
