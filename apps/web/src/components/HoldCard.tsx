import { useState } from 'react';
import { ApiError, api } from '../api';
import { formatMoney, timeLeft } from '../format';
import type { HoldRow } from '../types';
import { ErrorNote, QuorumMeter, StatusBadge } from './parts';

interface Props {
  hold: HoldRow;
  /** The signed-in approver already voted on this hold. */
  alreadyVoted?: boolean;
  onVoted: () => void;
  now?: Date;
}

/** A paused request as a family member sees it, with the Approve / Deny decision. Buttons lock while a vote is in flight. */
export function HoldCard({ hold, alreadyVoted = false, onVoted, now }: Props) {
  const [busy, setBusy] = useState<'approve' | 'deny' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const pending = hold.status === 'pending';

  async function vote(decision: 'approve' | 'deny') {
    setBusy(decision);
    setError(null);
    try {
      await api.vote(hold.holdId, decision, note.trim() || undefined);
      onVoted();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not record your decision.');
    } finally {
      setBusy(null);
    }
  }

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
      {pending && (
        <div className="stack" style={{ marginTop: 'var(--space-3)' }}>
          <label>
            <span className="sr-only">Note (optional)</span>
            <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Add a note (optional)" maxLength={300} disabled={busy !== null || alreadyVoted} />
          </label>
          <div className="row">
            <button type="button" className="btn ok grow" disabled={busy !== null || alreadyVoted} onClick={() => vote('approve')}>
              {busy === 'approve' ? 'Saving…' : 'Approve'}
            </button>
            <button type="button" className="btn danger grow" disabled={busy !== null || alreadyVoted} onClick={() => vote('deny')}>
              {busy === 'deny' ? 'Saving…' : 'Deny'}
            </button>
          </div>
          {alreadyVoted && <p className="small muted">You voted. Waiting for the other approver.</p>}
        </div>
      )}
      {error && <ErrorNote message={error} />}
    </article>
  );
}
