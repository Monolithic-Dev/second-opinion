import { useState, type FormEvent } from 'react';
import { ApiError, api } from '../../api';
import { Badge, EmptyState, ErrorNote, Spinner } from '../../components/parts';
import { useAppState } from '../../hooks/useAppState';
import type { Payee } from '../../types';
import {
  IconUser,
  IconShield,
  IconPill,
  IconZap,
  IconUsers,
  IconBuilding,
} from '../../components/icons';

const KINDS: Array<{ value: Payee['kind']; label: string }> = [
  { value: 'pharmacy', label: 'Pharmacy' },
  { value: 'utility', label: 'Utility' },
  { value: 'family', label: 'Family' },
  { value: 'merchant', label: 'Merchant / Shop' },
  { value: 'other', label: 'Other' },
];

function KindIcon({ kind }: { kind: Payee['kind'] }) {
  const size = 16;
  switch (kind) {
    case 'pharmacy':
      return <IconPill size={size} style={{ color: 'var(--brand)' }} />;
    case 'utility':
      return <IconZap size={size} style={{ color: 'var(--warn)' }} />;
    case 'family':
      return <IconUsers size={size} style={{ color: 'var(--ok)' }} />;
    default:
      return <IconBuilding size={size} style={{ color: 'var(--muted)' }} />;
  }
}

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
    <div className="stack" style={{ gap: 'var(--space-5)' }}>
      <div>
        <h1 style={{ margin: 0, fontSize: 'var(--text-2xl)' }}>Family and payees</h1>
        <p className="muted small" style={{ margin: 'var(--space-1) 0 0' }}>
          Manage the care circle and whitelisted trusted recipients
        </p>
      </div>

      <section className="card" aria-labelledby="people">
        <h2 id="people">Who protects Dorothy</h2>
        <ul className="stack" style={{ listStyle: 'none', padding: 0, margin: 0, gap: 'var(--space-2)' }}>
          {[...state.people]
            .sort((a, b) => Number(b.role === 'elder') - Number(a.role === 'elder') || a.approverRank - b.approverRank)
            .map((p) => (
              <li
                key={p.id}
                className="row"
                style={{
                  background: 'var(--surface-2)',
                  padding: '12px 16px',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--border)',
                }}
              >
                <div
                  aria-hidden="true"
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: '50%',
                    background: p.role === 'elder' ? 'var(--info-bg)' : 'var(--brand-soft)',
                    color: p.role === 'elder' ? 'var(--info)' : 'var(--brand)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  {p.role === 'elder' ? <IconUser size={18} /> : <IconShield size={18} />}
                </div>
                <strong className="grow" style={{ fontSize: 'var(--text-base)' }}>
                  {p.name}
                </strong>
                {p.role === 'elder' ? (
                  <Badge tone="info">Lives here</Badge>
                ) : (
                  <Badge tone={p.canApprove ? 'ok' : 'neutral'}>
                    {p.canApprove ? `Approver #${p.approverRank}` : 'Can view only'}
                  </Badge>
                )}
                <span className="muted small">{p.contactLabel ?? ''}</span>
              </li>
            ))}
        </ul>
        <p className="small muted" style={{ marginTop: 'var(--space-3)', lineHeight: 1.5 }}>
          The person who lives here can never approve their own requests. Approver #2 is asked if #1 does not answer in time.
        </p>
      </section>

      <section className="card" aria-labelledby="payees">
        <h2 id="payees">Trusted payees</h2>
        <p className="small muted" style={{ marginBottom: 'var(--space-3)' }}>
          Payments to these are not slowed down by the new-payee rule. They never override a scam warning such as gift cards.
        </p>

        {state.payees.length === 0 ? (
          <EmptyState title="No trusted payees yet">
            Add the pharmacy, the electric company, and anyone Dorothy pays regularly.
          </EmptyState>
        ) : (
          <div className="table-wrap">
            <table>
              <caption className="sr-only">Trusted payees</caption>
              <thead>
                <tr>
                  <th scope="col">Name</th>
                  <th scope="col">Type</th>
                  <th scope="col">
                    <span className="sr-only">Remove</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {state.payees.map((p) => {
                  const kInfo = KINDS.find((k) => k.value === p.kind);
                  return (
                    <tr key={p.id}>
                      <td style={{ fontWeight: 600, color: 'var(--text)' }}>
                        {p.name}
                      </td>
                      <td>
                        <span className="row" style={{ gap: 8, alignItems: 'center' }}>
                          <KindIcon kind={p.kind} />
                          <span>{kInfo?.label ?? p.kind}</span>
                        </span>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <button
                          type="button"
                          className="btn ghost small"
                          disabled={busy}
                          aria-label={`Remove ${p.name}`}
                          onClick={() => void run(() => api.removePayee(p.name), `${p.name} removed.`)}
                          style={{ color: 'var(--danger)' }}
                        >
                          Remove
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <form
          onSubmit={add}
          className="row"
          style={{
            marginTop: 'var(--space-4)',
            alignItems: 'end',
            background: 'var(--surface-2)',
            padding: 'var(--space-3) var(--space-4)',
            borderRadius: 'var(--radius-sm)',
            border: '1px solid var(--border)',
            gap: 'var(--space-3)',
          }}
          aria-label="Add a trusted payee"
        >
          <label className="grow" style={{ minWidth: 0, flexBasis: 180 }}>
            Name
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={100}
              placeholder="e.g. Corner Bakery"
              required
            />
          </label>
          <label>
            Type
            <select value={kind} onChange={(e) => setKind(e.target.value as Payee['kind'])}>
              {KINDS.map((k) => (
                <option key={k.value} value={k.value}>
                  {k.label}
                </option>
              ))}
            </select>
          </label>
          <button className="btn primary" type="submit" disabled={busy || !name.trim()}>
            Add
          </button>
        </form>

        <div role="status" className="small muted" style={{ marginTop: 'var(--space-2)', fontWeight: 600 }}>
          {notice}
        </div>
        {error && <ErrorNote message={error} />}
      </section>
    </div>
  );
}
