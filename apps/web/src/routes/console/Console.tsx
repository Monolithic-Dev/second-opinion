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
        <div className="card" style={{ maxWidth: 440, margin: '0 auto' }}>
          <h1>Family console</h1>
          <SignIn approvers={state.people.filter((p) => p.canApprove)} />
        </div>
      </main>
    );
  }

  const pending = state.holds.filter((h) => h.status === 'pending').length;
  return (
    <div className="container">
      <div className="shell">
        <nav className="side" aria-label="Family console">
          <NavLink to="/family" end>Overview</NavLink>
          <NavLink to="/family/holds">Requests{pending > 0 && <span className="badge warn" aria-label={`${pending} waiting`}>{pending}</span>}</NavLink>
          <NavLink to="/family/circle">Family and payees</NavLink>
          <NavLink to="/family/policy">Rules</NavLink>
          <NavLink to="/family/insights">Insights</NavLink>
          <NavLink to="/family/inbox">Notifications</NavLink>
          <div className="small muted" style={{ padding: '8px 14px' }}>Signed in as <strong>{me.name}</strong></div>
          <button type="button" className="btn ghost" onClick={() => void logout()}>Sign out</button>
        </nav>
        <main id="console-main" aria-label="Console content"><Outlet /></main>
      </div>
    </div>
  );
}
