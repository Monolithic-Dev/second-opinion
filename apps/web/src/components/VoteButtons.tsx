import { useState } from 'react';
import { ApiError, api } from '../api';
import { ErrorNote } from './parts';

interface Props {
  holdId: string;
  /** Voting is closed (finished hold). */
  disabled?: boolean;
  /** This approver already voted. */
  alreadyVoted?: boolean;
  onVoted: () => void;
}

/** Note field plus Approve / Deny. Both buttons lock while a vote is in flight so it cannot be double-tapped. */
export function VoteButtons({ holdId, disabled = false, alreadyVoted = false, onVoted }: Props) {
  const [busy, setBusy] = useState<'approve' | 'deny' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const off = disabled || alreadyVoted || busy !== null;

  async function vote(decision: 'approve' | 'deny') {
    setBusy(decision);
    setError(null);
    try {
      await api.vote(holdId, decision, note.trim() || undefined);
      onVoted();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not record your decision.');
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="stack" style={{ marginTop: 'var(--space-3)' }}>
      <label>
        <span className="sr-only">Note (optional)</span>
        <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Add a note (optional)" maxLength={300} disabled={off} />
      </label>
      <div className="row">
        <button type="button" className="btn ok grow" disabled={off} onClick={() => vote('approve')}>
          {busy === 'approve' ? 'Saving…' : 'Approve'}
        </button>
        <button type="button" className="btn danger grow" disabled={off} onClick={() => vote('deny')}>
          {busy === 'deny' ? 'Saving…' : 'Deny'}
        </button>
      </div>
      {alreadyVoted && <p className="small muted">You voted. Waiting for the other approver.</p>}
      {error && <ErrorNote message={error} />}
    </div>
  );
}
