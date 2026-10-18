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
    if (known.current && [...ids].some((id) => !known.current!.has(id))) {
      setAnnounce('A new request needs your decision.');
    }
    known.current = ids;
  }, [pending]);

  return (
    <section className="phone" aria-labelledby="family-title">
      <div className="phone-head">
        <span style={{ fontWeight: 700, letterSpacing: '-0.01em' }}>
          {me ? `${me.name}'s phone` : 'Family phone'}
        </span>
        <div className="row" aria-hidden="true" style={{ gap: 6, fontSize: '0.72rem', opacity: 0.85 }}>
          <span>5G</span>
          <span>●●●</span>
          <span>100%</span>
        </div>
      </div>

      <div className="phone-body">
        <h2 id="family-title" className="sr-only">
          Family phone
        </h2>
        <div className="sr-only" aria-live="assertive">
          {announce}
        </div>

        {(loading || !ready) && <Spinner />}
        {error && !state && <p className="field-error" role="alert">{error}</p>}

        {ready && state && !personId && <SignIn approvers={approvers} />}

        {ready && state && personId && (
          <>
            <div
              className="row"
              style={{
                justifyContent: 'space-between',
                padding: 'var(--space-2) 0',
                borderBottom: '1px solid var(--border)',
              }}
            >
              <div className="row" style={{ gap: 'var(--space-2)' }}>
                <span
                  aria-hidden="true"
                  style={{
                    width: 10,
                    height: 10,
                    borderRadius: '50%',
                    background: pending.length > 0 ? 'var(--warn)' : 'var(--ok)',
                    boxShadow: pending.length > 0 ? '0 0 10px var(--warn-glow)' : '0 0 10px var(--ok-glow)',
                    display: 'inline-block',
                  }}
                />
                <strong className="grow" style={{ fontSize: 'var(--text-base)', color: 'var(--text)' }}>
                  {pending.length === 0 ? 'All clear' : `${pending.length} waiting for you`}
                </strong>
              </div>
              <button
                type="button"
                className="btn ghost small"
                onClick={() => void logout()}
                style={{ padding: '4px 10px', minHeight: 32 }}
              >
                Sign out
              </button>
            </div>

            {pending.length === 0 && (
              <EmptyState title="Nothing needs your attention">
                New requests from Dorothy's Echo appear here instantly.
              </EmptyState>
            )}

            {pending.map((h) => (
              <HoldCard
                key={h.holdId}
                hold={h}
                alreadyVoted={voted.has(h.holdId)}
                onVoted={() => {
                  setVoted((v) => new Set(v).add(h.holdId));
                  void refresh();
                }}
              />
            ))}

            {history.length > 0 && (
              <details style={{ marginTop: 'var(--space-2)' }}>
                <summary style={{ fontSize: 'var(--text-sm)', color: 'var(--muted)' }}>
                  Recent decisions
                </summary>
                <ul className="stack" style={{ listStyle: 'none', padding: 0, marginTop: 'var(--space-2)', gap: 'var(--space-2)' }}>
                  {history.map((h) => (
                    <li
                      key={h.holdId}
                      className="row small"
                      style={{
                        background: 'var(--surface)',
                        padding: '8px 12px',
                        borderRadius: 'var(--radius-xs)',
                        border: '1px solid var(--border)',
                        justifyContent: 'space-between',
                      }}
                    >
                      <span className="grow" style={{ fontWeight: 500 }}>
                        {h.description}{' '}
                        <span className="muted">
                          · {formatMoney(h.amountCents)} · {timeAgo(h.createdAt)}
                        </span>
                      </span>
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
