import { useState, type FormEvent } from 'react';
import { useAuth } from '../hooks/useAuth';
import type { Person } from '../types';
import { ErrorNote } from './parts';
import { IconLock } from './icons';

/**
 * Family sign-in. The demo PINs are shown on purpose: they are documented demo credentials, and the server refuses them in
 * production. A real deployment would use a proper identity provider.
 */
export function SignIn({ approvers }: { approvers: Person[] }) {
  const { login } = useAuth();
  const [personId, setPersonId] = useState(approvers[0]?.id ?? '');
  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(await login(personId, pin));
    setBusy(false);
  }

  return (
    <form
      onSubmit={submit}
      className="stack"
      aria-label="Family sign-in"
      style={{
        background: 'var(--surface)',
        padding: 'var(--space-4)',
        borderRadius: 'var(--radius)',
        border: '1px solid var(--border)',
        boxShadow: 'var(--shadow-sm)',
        gap: 'var(--space-3)',
      }}
    >
      <div className="row" style={{ gap: 'var(--space-2)' }}>
        <div
          style={{
            width: 32,
            height: 32,
            borderRadius: 'var(--radius-sm)',
            background: 'var(--brand-muted)',
            color: 'var(--brand)',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          <IconLock size={18} />
        </div>
        <div>
          <strong style={{ fontSize: 'var(--text-base)', display: 'block' }}>Approver Authentication</strong>
          <p className="muted small" style={{ margin: 0 }}>
            Sign in as a family member to review requests.
          </p>
        </div>
      </div>

      <label>
        Who are you?
        <select
          value={personId}
          onChange={(e) => setPersonId(e.target.value)}
          style={{ fontWeight: 600 }}
        >
          {approvers.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name} {p.approverRank ? `(Approver #${p.approverRank})` : ''}
            </option>
          ))}
        </select>
      </label>

      <label>
        PIN
        <input
          type="password"
          inputMode="numeric"
          autoComplete="current-password"
          value={pin}
          onChange={(e) => setPin(e.target.value)}
          maxLength={32}
          required
          placeholder="••••"
          style={{ letterSpacing: '0.2em', fontSize: '1.2rem', fontFamily: 'var(--mono)' }}
        />
        <span className="field-hint">Demo PINs: Priya 1234, Arjun 5678</span>
      </label>

      {error && <ErrorNote message={error} />}

      <button
        className="btn primary"
        type="submit"
        disabled={busy || !personId || !pin}
        style={{ marginTop: 'var(--space-1)' }}
      >
        {busy ? 'Signing in…' : 'Sign in'}
      </button>
    </form>
  );
}
