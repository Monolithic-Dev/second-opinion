import { useState } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { useAppState } from '../../hooks/useAppState';
import { formatMoney, timeAgo } from '../../format';
import {
  IconUser,
  IconShieldCheck,
  IconLock,
  IconCheckCircle,
  IconXCircle,
  IconClock,
  IconBell,
  IconLogOut,
  IconSmartphone,
  IconMail,
} from '../../components/icons';
import { Badge, Spinner } from '../../components/parts';

export function Profile() {
  const { personId, logout, login } = useAuth();
  const { state } = useAppState();
  const [switching, setSwitching] = useState(false);

  if (!state) return <Spinner />;

  const me = state.people.find((p) => p.id === personId);
  const otherApprovers = state.people.filter((p) => p.canApprove && p.id !== personId);
  const elder = state.people.find((p) => p.role === 'elder');

  if (!me) {
    return (
      <div className="card">
        <p className="muted">Please sign in from the family console.</p>
      </div>
    );
  }

  const initials = me.name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase();

  // Statistics for this approver
  const totalDecided = state.holds.filter((h) => h.status === 'released' || h.status === 'denied');
  const deniedHolds = state.holds.filter((h) => h.status === 'denied');
  const releasedHolds = state.holds.filter((h) => h.status === 'released');
  const pendingHolds = state.holds.filter((h) => h.status === 'pending');

  const demoPins: Record<string, string> = {
    p_priya: '1234',
    p_arjun: '5678',
  };

  async function handleSwitch(targetId: string) {
    setSwitching(true);
    const pin = demoPins[targetId] ?? '1234';
    await login(targetId, pin);
    setSwitching(false);
  }

  return (
    <div className="stack" style={{ gap: 'var(--space-5)' }}>
      {/* Header */}
      <div>
        <h1 style={{ margin: 0, fontSize: 'var(--text-2xl)' }}>Caregiver Profile</h1>
        <p className="muted small" style={{ margin: 'var(--space-1) 0 0' }}>
          Identity credentials, quorum authority status, and personal approval history
        </p>
      </div>

      {/* Main Profile Card */}
      <section
        className="card"
        style={{
          display: 'grid',
          gap: 'var(--space-4)',
          background: 'linear-gradient(180deg, var(--surface) 0%, var(--surface-2) 100%)',
          border: '1px solid var(--border)',
        }}
      >
        <div
          className="row"
          style={{
            gap: 'var(--space-4)',
            alignItems: 'center',
            flexWrap: 'wrap',
          }}
        >
          {/* Avatar */}
          <div
            aria-hidden="true"
            style={{
              width: 72,
              height: 72,
              borderRadius: '50%',
              background: 'linear-gradient(135deg, var(--brand) 0%, #1d4ed8 100%)',
              color: '#ffffff',
              fontWeight: 800,
              fontSize: '1.75rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 4px 16px rgba(37,99,235,0.25)',
              border: '3px solid var(--surface)',
              flexShrink: 0,
            }}
          >
            {initials}
          </div>

          <div className="grow" style={{ minWidth: 200 }}>
            <div className="row" style={{ gap: 'var(--space-2)', alignItems: 'center', marginBottom: 4 }}>
              <h2 style={{ margin: 0, fontSize: 'var(--text-xl)' }}>{me.name}</h2>
              <Badge tone="ok">Active Caregiver</Badge>
              {me.approverRank && (
                <span className="badge info" style={{ fontSize: 'var(--text-xs)' }}>
                  Approver #{me.approverRank}
                </span>
              )}
            </div>
            <p className="muted small" style={{ margin: 0 }}>
              {me.contactLabel ? `Contact: ${me.contactLabel}` : 'Primary family contact'} · Protecting{' '}
              <strong>{elder?.name ?? 'Dorothy'}</strong>
            </p>
          </div>

          <button
            type="button"
            className="btn ghost small"
            onClick={() => void logout()}
            style={{ gap: 6, color: 'var(--danger)', alignSelf: 'flex-start' }}
          >
            <IconLogOut size={14} />
            Sign out
          </button>
        </div>

        {/* Quick specs grid */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: 'var(--space-3)',
            paddingTop: 'var(--space-3)',
            borderTop: '1px solid var(--border)',
          }}
        >
          <div style={{ padding: '10px 14px', background: 'var(--surface)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}>
            <div className="muted small" style={{ fontWeight: 600 }}>Quorum Role</div>
            <div style={{ fontWeight: 700, marginTop: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
              <IconShieldCheck size={16} style={{ color: 'var(--brand)' }} />
              <span>{me.canApprove ? 'Authorized Approver' : 'Viewer Only'}</span>
            </div>
            <div className="muted small" style={{ fontSize: '0.75rem', marginTop: 2 }}>
              {me.approverRank === 1 ? 'First in notification sequence' : 'Escalation fallback member'}
            </div>
          </div>

          <div style={{ padding: '10px 14px', background: 'var(--surface)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}>
            <div className="muted small" style={{ fontWeight: 600 }}>Household ID</div>
            <div style={{ fontWeight: 700, fontFamily: 'var(--mono)', marginTop: 4 }}>
              hh_demo
            </div>
            <div className="muted small" style={{ fontSize: '0.75rem', marginTop: 2 }}>
              Dorothy&apos;s Household Circle
            </div>
          </div>

          <div style={{ padding: '10px 14px', background: 'var(--surface)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}>
            <div className="muted small" style={{ fontWeight: 600 }}>Auth Method</div>
            <div style={{ fontWeight: 700, marginTop: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
              <IconLock size={15} style={{ color: 'var(--ok)' }} />
              <span>PIN Verified</span>
            </div>
            <div className="muted small" style={{ fontSize: '0.75rem', marginTop: 2 }}>
              Demo PIN: {demoPins[me.id] ?? '••••'}
            </div>
          </div>
        </div>
      </section>

      {/* Quorum Authority & Security Policies */}
      <div className="split" style={{ gridTemplateColumns: '1.2fr 1fr' }}>
        <section className="card stack" style={{ gap: 'var(--space-3)' }}>
          <h2 style={{ margin: 0, fontSize: 'var(--text-lg)', display: 'flex', alignItems: 'center', gap: 8 }}>
            <IconShieldCheck size={18} style={{ color: 'var(--brand)' }} />
            <span>Quorum & Veto Authority</span>
          </h2>
          <p className="small muted" style={{ margin: 0 }}>
            Under Second Opinion&apos;s deterministic fail-closed architecture, your security authority operates under strict protocols:
          </p>
          <ul className="stack" style={{ listStyle: 'none', padding: 0, margin: 0, gap: 'var(--space-2)' }}>
            <li
              className="row"
              style={{
                padding: '10px 12px',
                background: 'var(--surface-2)',
                borderRadius: 'var(--radius-xs)',
                border: '1px solid var(--border)',
                gap: 10,
                alignItems: 'flex-start',
              }}
            >
              <IconXCircle size={18} style={{ color: 'var(--danger)', marginTop: 2, flexShrink: 0 }} />
              <div>
                <strong>Single-Veto Supremacy:</strong> If you or any designated caregiver clicks Deny, the payment is immediately and permanently blocked. An approval from another member cannot override your veto.
              </div>
            </li>
            <li
              className="row"
              style={{
                padding: '10px 12px',
                background: 'var(--surface-2)',
                borderRadius: 'var(--radius-xs)',
                border: '1px solid var(--border)',
                gap: 10,
                alignItems: 'flex-start',
              }}
            >
              <IconClock size={18} style={{ color: 'var(--warn)', marginTop: 2, flexShrink: 0 }} />
              <div>
                <strong>Fail-Closed Expiration:</strong> If no approver responds before the policy deadline expires, the hold is marked expired and the payment remains cancelled. It never releases automatically.
              </div>
            </li>
            <li
              className="row"
              style={{
                padding: '10px 12px',
                background: 'var(--surface-2)',
                borderRadius: 'var(--radius-xs)',
                border: '1px solid var(--border)',
                gap: 10,
                alignItems: 'flex-start',
              }}
            >
              <IconCheckCircle size={18} style={{ color: 'var(--ok)', marginTop: 2, flexShrink: 0 }} />
              <div>
                <strong>Cryptographic Audit Trail:</strong> Every vote records your profile identifier, timestamp, and optional rationale note for regulatory compliance and household visibility.
              </div>
            </li>
          </ul>
        </section>

        {/* Notifications & Fast Switcher */}
        <div className="stack" style={{ gap: 'var(--space-4)' }}>
          <section className="card stack" style={{ gap: 'var(--space-3)' }}>
            <h2 style={{ margin: 0, fontSize: 'var(--text-lg)', display: 'flex', alignItems: 'center', gap: 8 }}>
              <IconBell size={18} style={{ color: 'var(--brand)' }} />
              <span>Dispatch Channels</span>
            </h2>
            <div className="stack" style={{ gap: 'var(--space-2)' }}>
              <div
                className="row"
                style={{
                  padding: '8px 12px',
                  background: 'var(--surface-2)',
                  borderRadius: 'var(--radius-xs)',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <div className="row" style={{ gap: 8, alignItems: 'center' }}>
                  <IconSmartphone size={16} style={{ color: 'var(--brand)' }} />
                  <span className="small" style={{ fontWeight: 600 }}>In-App Push</span>
                </div>
                <Badge tone="ok">Live</Badge>
              </div>

              <div
                className="row"
                style={{
                  padding: '8px 12px',
                  background: 'var(--surface-2)',
                  borderRadius: 'var(--radius-xs)',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <div className="row" style={{ gap: 8, alignItems: 'center' }}>
                  <IconMail size={16} style={{ color: 'var(--info)' }} />
                  <span className="small" style={{ fontWeight: 600 }}>Caregiver Email</span>
                </div>
                <Badge tone="ok">File Digest</Badge>
              </div>
            </div>
          </section>

          {/* Switch Profile for Testing */}
          {otherApprovers.length > 0 && (
            <section
              className="card stack"
              style={{
                gap: 'var(--space-2)',
                border: '1px dashed var(--brand)',
                background: 'var(--brand-soft)',
              }}
            >
              <strong className="small" style={{ color: 'var(--brand)' }}>
                Demo Profile Quick Switcher
              </strong>
              <p className="small muted" style={{ margin: 0 }}>
                Test multi-approver quorum flows by switching identities instantly:
              </p>
              <div className="stack" style={{ gap: 'var(--space-2)', marginTop: 4 }}>
                {otherApprovers.map((o) => (
                  <button
                    key={o.id}
                    type="button"
                    className="btn small"
                    disabled={switching}
                    onClick={() => void handleSwitch(o.id)}
                    style={{
                      justifyContent: 'flex-start',
                      background: 'var(--surface)',
                      borderColor: 'var(--border)',
                      gap: 8,
                    }}
                  >
                    <IconUser size={14} />
                    <span>Switch to {o.name} (Approver #{o.approverRank})</span>
                  </button>
                ))}
              </div>
            </section>
          )}
        </div>
      </div>

      {/* Household Decisions History */}
      <section className="card" aria-labelledby="history">
        <div className="row" style={{ justifyContent: 'space-between', marginBottom: 'var(--space-3)' }}>
          <h2 id="history" style={{ margin: 0, fontSize: 'var(--text-lg)' }}>
            Household Decision History
          </h2>
          <span className="small muted">
            {deniedHolds.length} blocked · {releasedHolds.length} approved · {pendingHolds.length} pending
          </span>
        </div>

        {totalDecided.length === 0 ? (
          <p className="muted small">No resolved payment decisions recorded in this session.</p>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th scope="col">Description</th>
                  <th scope="col">Amount</th>
                  <th scope="col">Outcome</th>
                  <th scope="col">Time</th>
                </tr>
              </thead>
              <tbody>
                {totalDecided.slice(0, 5).map((h) => (
                  <tr key={h.holdId}>
                    <td style={{ fontWeight: 600 }}>{h.description}</td>
                    <td>{formatMoney(h.amountCents)}</td>
                    <td>
                      <span className={`badge ${h.status === 'denied' ? 'danger' : 'ok'}`}>
                        {h.status === 'denied' ? 'Cancelled / Blocked' : 'Approved'}
                      </span>
                    </td>
                    <td className="muted small">{timeAgo(h.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
