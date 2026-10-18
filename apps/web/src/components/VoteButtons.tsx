import { useState } from 'react';
import { ApiError, api } from '../api';
import { ErrorNote } from './parts';
import { IconCheck, IconX, IconClock } from './icons';

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
        <input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Add a note (optional)"
          maxLength={300}
          disabled={off}
          style={{
            background: 'var(--surface-2)',
            borderColor: 'var(--border)',
            fontSize: 'var(--text-sm)',
          }}
        />
      </label>
      <div className="row" style={{ gap: 'var(--space-3)' }}>
        <button
          type="button"
          className="btn ok grow"
          disabled={off}
          onClick={() => vote('approve')}
          style={{ letterSpacing: '0.01em', gap: '8px' }}
        >
          {busy === 'approve' ? (
            'Saving…'
          ) : (
            <>
              <IconCheck size={16} />
              Approve
            </>
          )}
        </button>
        <button
          type="button"
          className="btn danger grow"
          disabled={off}
          onClick={() => vote('deny')}
          style={{ letterSpacing: '0.01em', gap: '8px' }}
        >
          {busy === 'deny' ? (
            'Saving…'
          ) : (
            <>
              <IconX size={16} />
              Deny
            </>
          )}
        </button>
      </div>
      {alreadyVoted && (
        <div
          className="row small muted"
          style={{
            background: 'var(--surface-2)',
            padding: '8px 12px',
            borderRadius: 'var(--radius-xs)',
            border: '1px solid var(--border)',
            gap: 'var(--space-2)',
            alignItems: 'center',
          }}
        >
          <IconClock size={15} style={{ color: 'var(--info)' }} />
          <span>You voted. Waiting for the other approver.</span>
        </div>
      )}
      {error && <ErrorNote message={error} />}
    </div>
  );
}
