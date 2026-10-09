import { useState, type FormEvent } from 'react';
import { ApiError, api } from '../../api';
import { Badge, EmptyState, ErrorNote, Spinner } from '../../components/parts';
import { useAppState } from '../../hooks/useAppState';
import type { Payee } from '../../types';

const KINDS: Array<{ value: Payee['kind']; label: string }> = [
  { value: 'pharmacy', label: 'Pharmacy' }, { value: 'utility', label: 'Utility' }, { value: 'family', label: 'Family' },
  { value: 'merchant', label: 'Shop' }, { value: 'other', label: 'Other' },
];

export function Circle() {
  const { state, refresh } = useAppState();
  const [name, setName] = useState('');
  const [kind, setKind] = useState<Payee['kind']>('merchant');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState('');
  if (!state) return <Spinner />;

  async function run(action: () => Promise<unknown>, done: string) {
    setBusy(true);
    setError(null);
    setNotice('');
    try {
      await action();
      await refresh();
      setNotice(done);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Something went wrong.');
    } finally {
      setBusy(false);
    }
  }

  function add(e: FormEvent) {
    e.preventDefault();
    const n = name.trim();
    if (!n) return;
    void run(() => api.addPayee(n, kind), `${n} is now trusted.`).then(() => setName(''));
  }

  return (
    <div className="stack">
      <h1>Family and payees</h1>

      <section className="card" aria-labelledby="people">
        <h2 id="people">Who protects Dorothy</h2>
        <ul className="stack" style={{ listStyle: 'none', padding: 0, margin: 0 }}>
          {[...state.people].sort((a, b) => Number(b.role === 'elder') - Number(a.role === 'elder') || a.approverRank - b.approverRank).map((p) => (
            <li key={p.id} className="row">
              <strong className="grow">{p.name}</strong>
              {p.role === 'elder' ? <Badge tone="info">Lives here</Badge> : <Badge tone={p.canApprove ? 'ok' : 'neutral'}>{p.canApprove ? `Approver #${p.approverRank}` : 'Can view only'}</Badge>}
              <span className="muted small">{p.contactLabel ?? ''}</span>
            </li>
          ))}
        </ul>
        <p className="small muted">The person who lives here can never approve their own requests. Approver #2 is asked if #1 does not answer in time.</p>
      </section>

      <section className="card" aria-labelledby="payees">
        <h2 id="payees">Trusted payees</h2>
        <p className="small muted">Payments to these are not slowed down by the new-payee rule. They never override a scam warning such as gift cards.</p>
        {state.payees.length === 0 ? (
          <EmptyState title="No trusted payees yet">Add the pharmacy, the electric company, and anyone Dorothy pays regularly.</EmptyState>
        ) : (
          <div className="table-wrap"><table>
            <caption className="sr-only">Trusted payees</caption>
            <thead><tr><th scope="col">Name</th><th scope="col">Type</th><th scope="col"><span className="sr-only">Remove</span></th></tr></thead>
            <tbody>
              {state.payees.map((p) => (
                <tr key={p.id}>
                  <td style={{ textTransform: 'capitalize' }}>{p.name}</td>
                  <td>{KINDS.find((k) => k.value === p.kind)?.label ?? p.kind}</td>
                  <td style={{ textAlign: 'right' }}>
                    <button type="button" className="btn ghost" disabled={busy} aria-label={`Remove ${p.name}`} onClick={() => void run(() => api.removePayee(p.name), `${p.name} removed.`)}>Remove</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table></div>
        )}
        <form onSubmit={add} className="row" style={{ marginTop: 'var(--space-4)', alignItems: 'end' }} aria-label="Add a trusted payee">
          <label className="grow" style={{ minWidth: 0, flexBasis: 180 }}>Name<input value={name} onChange={(e) => setName(e.target.value)} maxLength={100} placeholder="e.g. Corner Bakery" required /></label>
          <label>Type<select value={kind} onChange={(e) => setKind(e.target.value as Payee['kind'])}>{KINDS.map((k) => <option key={k.value} value={k.value}>{k.label}</option>)}</select></label>
          <button className="btn primary" type="submit" disabled={busy || !name.trim()}>Add</button>
        </form>
        <div role="status" className="small muted">{notice}</div>
        {error && <ErrorNote message={error} />}
      </section>
    </div>
  );
}
