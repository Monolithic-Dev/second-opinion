import { useState, type FormEvent } from 'react';
import { useAuth } from '../hooks/useAuth';
import type { Person } from '../types';
import { ErrorNote } from './parts';

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
    <form onSubmit={submit} className="stack" aria-label="Family sign-in">
      <p className="muted small">Sign in as a family member to review requests.</p>
      <label>
        Who are you?
        <select value={personId} onChange={(e) => setPersonId(e.target.value)}>
          {approvers.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </label>
      <label>
        PIN
        <input type="password" inputMode="numeric" autoComplete="current-password" value={pin} onChange={(e) => setPin(e.target.value)} maxLength={32} required />
        <span className="field-hint">Demo PINs: Priya 1234, Arjun 5678</span>
      </label>
      {error && <ErrorNote message={error} />}
      <button className="btn primary" type="submit" disabled={busy || !personId || !pin}>{busy ? 'Signing in…' : 'Sign in'}</button>
    </form>
  );
}
