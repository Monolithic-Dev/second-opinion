import { NavLink, Outlet } from 'react-router-dom';
import { SignIn } from '../../components/SignIn';
import { Spinner } from '../../components/parts';
import { useAppState } from '../../hooks/useAppState';
import { useAuth } from '../../hooks/useAuth';

/** The caregiver's console. Everything inside needs a family sign-in; the server enforces it too, this is only the front door. */
export function Console() {
  const { personId, ready, logout } = useAuth();
  const { state, loading, error } = useAppState();

  if (!ready || loading) return <main className="container"><Spinner /></main>;
  if (!state) return <main className="container"><p className="field-error" role="alert">{error ?? 'Could not load the household.'}</p></main>;

  const me = state.people.find((p) => p.id === personId);
  if (!personId || !me) {
    return (
      <main className="container">
        <div className="card" style={{ maxWidth: 460, margin: 'var(--space-6) auto', padding: 'var(--space-5)' }}>
          <div className="row" style={{ gap: 'var(--space-2)', marginBottom: 'var(--space-3)' }}>
            <span aria-hidden="true" style={{ fontSize: '1.8rem' }}>🛡️</span>
            <div>
              <h1 style={{ margin: 0, fontSize: 'var(--text-xl)' }}>Family console</h1>
              <p className="muted small" style={{ margin: 0 }}>Protecting Dorothy's Alexa+ transactions</p>
            </div>
          </div>
          <SignIn approvers={state.people.filter((p) => p.canApprove)} />
        </div>
      </main>
    );
  }

  const pending = state.holds.filter((h) => h.status === 'pending').length;
  const initials = me.name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase();

  return (
    <div className="container">
      <div className="shell">
        <nav className="side" aria-label="Family console">
          <div style={{ padding: '8px 14px 12px', borderBottom: '1px solid var(--border)', marginBottom: 6 }}>
            <span style={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--muted)', letterSpacing: '0.05em' }}>
              Household Guard
            </span>
            <div style={{ fontWeight: 700, fontSize: 'var(--text-base)', color: 'var(--text)' }}>
              Dorothy's Family
            </div>
          </div>

          <NavLink to="/family" end>
            <span className="row" style={{ gap: 8 }}>
              <span aria-hidden="true">📊</span>
              Overview
            </span>
          </NavLink>

          <NavLink to="/family/holds">
            <span className="row" style={{ gap: 8 }}>
              <span aria-hidden="true">🛡️</span>
              Requests
            </span>
            {pending > 0 && (
              <span className="badge warn" aria-label={`${pending} waiting`}>
                {pending}
              </span>
            )}
          </NavLink>

          <NavLink to="/family/circle">
            <span className="row" style={{ gap: 8 }}>
              <span aria-hidden="true">👥</span>
              Family and payees
            </span>
          </NavLink>

          <NavLink to="/family/policy">
            <span className="row" style={{ gap: 8 }}>
              <span aria-hidden="true">⚙️</span>
              Rules
            </span>
          </NavLink>

          <NavLink to="/family/insights">
            <span className="row" style={{ gap: 8 }}>
              <span aria-hidden="true">📈</span>
              Insights
            </span>
          </NavLink>

          <NavLink to="/family/inbox">
            <span className="row" style={{ gap: 8 }}>
              <span aria-hidden="true">🔔</span>
              Notifications
            </span>
          </NavLink>

          <div
            style={{
              marginTop: 'var(--space-3)',
              padding: '12px 14px',
              borderTop: '1px solid var(--border)',
              display: 'grid',
              gap: 8,
            }}
          >
            <div className="row" style={{ gap: 10 }}>
              <div
                aria-hidden="true"
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: '50%',
                  background: 'linear-gradient(135deg, var(--brand) 0%, var(--brand-hover) 100%)',
                  color: '#fff',
                  fontWeight: 700,
                  fontSize: '0.85rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {initials}
              </div>
              <div className="grow small" style={{ lineHeight: 1.25 }}>
                <div className="muted" style={{ fontSize: '0.75rem' }}>
                  Signed in as
                </div>
                <strong>{me.name}</strong>
              </div>
            </div>

            <button
              type="button"
              className="btn ghost small"
              onClick={() => void logout()}
              style={{ width: '100%', justifyContent: 'flex-start', padding: '6px 8px', minHeight: 32 }}
            >
              <span aria-hidden="true">🚪</span>
              Sign out
            </button>
          </div>
        </nav>
        <main id="console-main" aria-label="Console content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
