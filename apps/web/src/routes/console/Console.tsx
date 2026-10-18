import { NavLink, Outlet } from 'react-router-dom';
import { SignIn } from '../../components/SignIn';
import { Spinner } from '../../components/parts';
import {
  IconBell,
  IconGrid,
  IconList,
  IconLogOut,
  IconSettings,
  IconShieldCheck,
  IconTrendingUp,
  IconUser,
  IconUsers,
} from '../../components/icons';
import { useAppState } from '../../hooks/useAppState';
import { useAuth } from '../../hooks/useAuth';

function NavItem({
  to,
  end,
  icon,
  label,
  badge,
}: {
  to: string;
  end?: boolean;
  icon: React.ReactNode;
  label: string;
  badge?: number;
}) {
  return (
    <NavLink to={to} end={end}>
      <span className="row" style={{ gap: 10 }}>
        <span style={{ display: 'flex', alignItems: 'center', color: 'var(--muted)', flexShrink: 0 }}>{icon}</span>
        {label}
      </span>
      {badge != null && badge > 0 && (
        <span className="badge warn" aria-label={`${badge} waiting`} style={{ minWidth: 20, justifyContent: 'center' }}>
          {badge}
        </span>
      )}
    </NavLink>
  );
}

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
        <div
          style={{
            maxWidth: 420,
            margin: 'var(--space-7) auto',
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-lg)',
            boxShadow: 'var(--shadow-lg)',
            overflow: 'hidden',
          }}
        >
          {/* header bar */}
          <div
            style={{
              padding: 'var(--space-5)',
              borderBottom: '1px solid var(--border)',
              background: 'var(--surface-2)',
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--space-3)',
            }}
          >
            <span
              style={{
                width: 40,
                height: 40,
                borderRadius: 12,
                background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#fff',
                flexShrink: 0,
                boxShadow: '0 2px 8px rgba(37,99,235,0.3)',
              }}
            >
              <IconShieldCheck size={20} aria-hidden="true" style={{ strokeWidth: '2' }} />
            </span>
            <div>
              <h1 style={{ margin: 0, fontSize: 'var(--text-lg)', letterSpacing: '-0.02em' }}>Family console</h1>
              <p className="muted small" style={{ margin: 0 }}>Protecting Dorothy's Alexa+ transactions</p>
            </div>
          </div>
          <div style={{ padding: 'var(--space-5)' }}>
            <SignIn approvers={state.people.filter((p) => p.canApprove)} />
          </div>
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
          <div style={{ padding: '10px 14px 14px', borderBottom: '1px solid var(--border)', marginBottom: 4 }}>
            <span style={{ fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--muted)', letterSpacing: '0.06em' }}>
              Household Guard
            </span>
            <div style={{ fontWeight: 700, fontSize: 'var(--text-base)', color: 'var(--text)', marginTop: 2 }}>
              Dorothy's Family
            </div>
          </div>

          <NavItem to="/family" end icon={<IconGrid size={15} />} label="Overview" />
          <NavItem to="/family/holds" icon={<IconList size={15} />} label="Requests" badge={pending} />
          <NavItem to="/family/circle" icon={<IconUsers size={15} />} label="Family and payees" />
          <NavItem to="/family/policy" icon={<IconSettings size={15} />} label="Rules" />
          <NavItem to="/family/insights" icon={<IconTrendingUp size={15} />} label="Insights" />
          <NavItem to="/family/inbox" icon={<IconBell size={15} />} label="Notifications" />
          <NavItem to="/family/profile" icon={<IconUser size={15} />} label="Caregiver Profile" />

          <div
            style={{
              marginTop: 'auto',
              padding: '12px 14px',
              borderTop: '1px solid var(--border)',
              display: 'grid',
              gap: 10,
            }}
          >
            <NavLink
              to="/family/profile"
              className="row"
              style={{
                gap: 10,
                textDecoration: 'none',
                color: 'inherit',
                padding: '4px',
                borderRadius: 'var(--radius-sm)',
              }}
            >
              <div
                aria-hidden="true"
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: '50%',
                  background: 'linear-gradient(135deg, var(--brand) 0%, var(--brand-hover) 100%)',
                  color: '#fff',
                  fontWeight: 700,
                  fontSize: '0.82rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                  letterSpacing: '0.02em',
                }}
              >
                {initials}
              </div>
              <div className="grow small" style={{ lineHeight: 1.25, minWidth: 0 }}>
                <div className="muted" style={{ fontSize: '0.72rem' }}>Signed in as</div>
                <strong style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {me.name}
                </strong>
              </div>
            </NavLink>

            <button
              type="button"
              className="btn ghost small"
              onClick={() => void logout()}
              style={{ width: '100%', justifyContent: 'flex-start', padding: '6px 8px', minHeight: 32, gap: 8 }}
            >
              <IconLogOut size={14} aria-hidden="true" />
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
