import { useEffect, useMemo, useRef, useState } from 'react';
import { useAppState } from '../hooks/useAppState';
import { useAuth } from '../hooks/useAuth';
import { HoldCard } from './HoldCard';
import { EmptyState, Spinner, StatusBadge } from './parts';
import { SignIn } from './SignIn';
import { formatMoney, timeAgo } from '../format';

/** Priya's phone: what the family sees the moment something is paused, with Approve / Deny. Updates live. */
export function FamilyPhone() {
  const { state, loading, error, refresh } = useAppState();
  const { personId, ready, logout } = useAuth();
  const [voted, setVoted] = useState<Set<string>>(new Set());
  const [announce, setAnnounce] = useState('');
  const known = useRef<Set<string> | null>(null);

  const pending = useMemo(() => (state?.holds ?? []).filter((h) => h.status === 'pending'), [state]);
  const history = useMemo(() => (state?.holds ?? []).filter((h) => h.status !== 'pending').slice(0, 4), [state]);
  const me = state?.people.find((p) => p.id === personId);
  const approvers = (state?.people ?? []).filter((p) => p.canApprove);

  // Tell screen-reader users when a new request needs a decision.
  useEffect(() => {
    const ids = new Set(pending.map((h) => h.holdId));
    if (known.current && [...ids].some((id) => !known.current!.has(id))) setAnnounce('A new request needs your decision.');
    known.current = ids;
  }, [pending]);

  return (
    <section className="phone" aria-labelledby="family-title">
      <div className="phone-head"><span>{me ? `${me.name}'s phone` : 'Family phone'}</span><span aria-hidden="true">●●●</span></div>
      <div className="phone-body">
        <h2 id="family-title" className="sr-only">Family phone</h2>
        <div className="sr-only" aria-live="assertive">{announce}</div>
        {(loading || !ready) && <Spinner />}
        {error && !state && <p className="field-error" role="alert">{error}</p>}
        {ready && state && !personId && <SignIn approvers={approvers} />}
        {ready && state && personId && (
          <>
            <div className="row">
              <strong className="grow">{pending.length === 0 ? 'All clear' : `${pending.length} waiting for you`}</strong>
              <button type="button" className="btn ghost" onClick={() => void logout()}>Sign out</button>
            </div>
            {pending.length === 0 && <EmptyState title="Nothing needs your attention">New requests from Dorothy's Echo appear here instantly.</EmptyState>}
            {pending.map((h) => (
              <HoldCard key={h.holdId} hold={h} alreadyVoted={voted.has(h.holdId)} onVoted={() => { setVoted((v) => new Set(v).add(h.holdId)); void refresh(); }} />
            ))}
            {history.length > 0 && (
              <details>
                <summary>Recent decisions</summary>
                <ul className="stack" style={{ listStyle: 'none', padding: 0 }}>
                  {history.map((h) => (
                    <li key={h.holdId} className="row small">
                      <span className="grow">{h.description} <span className="muted">· {formatMoney(h.amountCents)} · {timeAgo(h.createdAt)}</span></span>
                      <StatusBadge status={h.status} />
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </>
        )}
      </div>
    </section>
  );
}
