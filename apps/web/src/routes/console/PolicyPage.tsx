import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react';
import { ApiError, api } from '../../api';
import { Badge, ErrorNote, Spinner } from '../../components/parts';
import { useAppState } from '../../hooks/useAppState';
import { buildPatch, DEFAULT_POLICY, TIMEZONES, toForm, validateForm, type PolicyForm } from '../../lib/policyForm';

function Field({ label, hint, error, children }: { label: string; hint?: string; error?: string | undefined; children: ReactNode }) {
  return (
    <label style={{ display: 'grid', gap: 4 }}>
      <span style={{ fontWeight: 600 }}>{label}</span>
      {children}
      {hint && <span className="field-hint">{hint}</span>}
      {error && <span className="field-error" role="alert">{error}</span>}
    </label>
  );
}

export function PolicyPage() {
  const { state, refresh } = useAppState();
  const saved = state?.policy;
  const approvers = state?.people.filter((p) => p.canApprove).length ?? 0;
  const [form, setForm] = useState<PolicyForm | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState('');

  // Adopt the saved policy when it first arrives or changes elsewhere, unless the user is mid-edit.
  const savedKey = JSON.stringify(saved);
  useEffect(() => {
    if (saved) setForm((f) => (f && JSON.stringify(buildPatch(f, saved)) !== '{}' ? f : toForm(saved)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [savedKey]);

  const errors = useMemo(() => (form ? validateForm(form, approvers) : {}), [form, approvers]);
  const patch = useMemo(() => (form && saved ? buildPatch(form, saved) : {}), [form, saved]);
  const dirty = Object.keys(patch).length > 0;
  const invalid = Object.keys(errors).length > 0;

  if (!state || !form || !saved) return <Spinner />;
  const set = <K extends keyof PolicyForm>(k: K, v: PolicyForm[K]) => {
    setNotice('');
    setForm({ ...form, [k]: v });
  };
  const zones = TIMEZONES.includes(form.timezone) ? TIMEZONES : [form.timezone, ...TIMEZONES];

  async function save(e: FormEvent) {
    e.preventDefault();
    if (!dirty || invalid) return;
    setBusy(true);
    setError(null);
    try {
      const r = await api.setPolicy(patch);
      await refresh();
      setNotice(r.changed.length ? `Saved: ${r.changed.length} ${r.changed.length === 1 ? 'rule' : 'rules'} changed.` : 'Nothing to change.');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not save the rules.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="stack" onSubmit={save} aria-label="Household rules" noValidate style={{ gap: 'var(--space-4)' }}>
      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 'var(--text-2xl)' }}>Rules</h1>
          <p className="muted small" style={{ margin: 'var(--space-1) 0 0' }}>
            Deterministic household limits, quiet hours, and quorum approvals configured for Dorothy
          </p>
        </div>
        {state.isDefault && <Badge tone="info">Standard rules in use</Badge>}
      </div>

      <div
        className="row small"
        style={{
          background: 'var(--surface-2)',
          padding: '10px 14px',
          borderRadius: 'var(--radius-sm)',
          border: '1px solid var(--border)',
          gap: 'var(--space-2)',
        }}
      >
        <span aria-hidden="true" style={{ fontSize: '1.1rem' }}>ℹ️</span>
        <span className="muted">
          These rules add extra checks around the scam detector. They can make things stricter, but they never allow something the detector paused as a scam.
        </span>
      </div>

      <fieldset className="card stack" style={{ gap: 'var(--space-3)' }}>
        <legend>
          <h2>💳 Payment limits</h2>
        </legend>
        <Field label="Single payment limit ($)" hint="Anything above this needs approval." error={errors.maxSingle}>
          <input inputMode="decimal" value={form.maxSingle} onChange={(e) => set('maxSingle', e.target.value)} aria-invalid={Boolean(errors.maxSingle)} />
        </Field>
        <Field label="Daily limit ($)" hint="Beyond this, requests are blocked until family acts in the console." error={errors.dailyCap}>
          <input inputMode="decimal" value={form.dailyCap} onChange={(e) => set('dailyCap', e.target.value)} aria-invalid={Boolean(errors.dailyCap)} />
        </Field>
        <Field label="Ask for approval above ($) when something looks risky" error={errors.requireApprovalAbove}>
          <input inputMode="decimal" value={form.requireApprovalAbove} onChange={(e) => set('requireApprovalAbove', e.target.value)} aria-invalid={Boolean(errors.requireApprovalAbove)} />
        </Field>
      </fieldset>

      <fieldset className="card stack" style={{ gap: 'var(--space-3)' }}>
        <legend>
          <h2>🌙 New payees and quiet hours</h2>
        </legend>
        <Field label="Wait for a new payee (minutes)" hint="The first payment to someone not on the trusted list needs approval until this has passed." error={errors.newPayeeCooloffMin}>
          <input inputMode="numeric" value={form.newPayeeCooloffMin} onChange={(e) => set('newPayeeCooloffMin', e.target.value)} aria-invalid={Boolean(errors.newPayeeCooloffMin)} />
        </Field>
        <div className="row" style={{ gap: 'var(--space-3)' }}>
          <div className="grow" style={{ minWidth: 140 }}>
            <Field label="Quiet hours start" error={errors.quietHoursStart}>
              <input type="time" value={form.quietHoursStart} onChange={(e) => set('quietHoursStart', e.target.value)} />
            </Field>
          </div>
          <div className="grow" style={{ minWidth: 140 }}>
            <Field label="Quiet hours end" error={errors.quietHoursEnd}>
              <input type="time" value={form.quietHoursEnd} onChange={(e) => set('quietHoursEnd', e.target.value)} />
            </Field>
          </div>
          <div className="grow" style={{ minWidth: 200 }}>
            <Field label="Time zone" error={errors.timezone}>
              <select value={form.timezone} onChange={(e) => set('timezone', e.target.value)}>
                {zones.map((z) => (
                  <option key={z} value={z}>
                    {z}
                  </option>
                ))}
              </select>
            </Field>
          </div>
        </div>
        <p className="small muted">During quiet hours, payments need approval. Set both times to 00:00 to turn this off.</p>
      </fieldset>

      <fieldset className="card stack" style={{ gap: 'var(--space-3)' }}>
        <legend>
          <h2>👥 Approvals</h2>
        </legend>
        <Field label="Approvals needed" error={errors.quorum}>
          <select value={form.quorum} onChange={(e) => set('quorum', e.target.value as '1' | '2')}>
            <option value="1">One family member</option>
            <option value="2" disabled={approvers < 2}>
              Two family members
            </option>
          </select>
        </Field>
        <Field label="Ask the next approver after (minutes)" error={errors.escalateAfterMin}>
          <input inputMode="numeric" value={form.escalateAfterMin} onChange={(e) => set('escalateAfterMin', e.target.value)} aria-invalid={Boolean(errors.escalateAfterMin)} />
        </Field>
        <Field label="Give up after (minutes)" hint="An unanswered request stays blocked; it is never released automatically." error={errors.holdTtlMin}>
          <input inputMode="numeric" value={form.holdTtlMin} onChange={(e) => set('holdTtlMin', e.target.value)} aria-invalid={Boolean(errors.holdTtlMin)} />
        </Field>
      </fieldset>

      <div
        className="row"
        style={{
          background: 'var(--surface)',
          padding: 'var(--space-3) var(--space-4)',
          borderRadius: 'var(--radius-sm)',
          border: '1px solid var(--border)',
          boxShadow: 'var(--shadow-sm)',
          position: 'sticky',
          bottom: 16,
          zIndex: 10,
        }}
      >
        <button className="btn primary" type="submit" disabled={busy || !dirty || invalid}>
          {busy ? 'Saving…' : 'Save rules'}
        </button>
        <button
          className="btn ghost"
          type="button"
          disabled={busy}
          onClick={() => {
            setNotice('');
            setForm(toForm(DEFAULT_POLICY));
          }}
        >
          Use standard rules
        </button>
        <span role="status" className="small muted" style={{ fontWeight: 600 }}>
          {notice || (dirty ? 'You have unsaved changes.' : '')}
        </span>
      </div>
      {error && <ErrorNote message={error} />}
    </form>
  );
}
