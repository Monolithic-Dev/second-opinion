import { useEffect, useState } from 'react';
import { Badge, Spinner } from '../../components/parts';
import {
  IconBell,
  IconCheckCircle,
  IconClock,
  IconLock,
  IconMail,
  IconSave,
  IconShieldCheck,
  IconSmartphone,
  IconUser,
  IconXCircle,
} from '../../components/icons';
import { formatMoney, timeAgo } from '../../format';
import { useAppState } from '../../hooks/useAppState';
import { useAuth } from '../../hooks/useAuth';

/* ── Customization Profile Storage ── */
interface CaregiverCustomization {
  displayName: string;
  avatarColor: string;
  contactMethod: 'push' | 'sms' | 'email';
  phoneNumber: string;
  emailAddress: string;
  alertThreshold: 'all' | 'high_risk' | 'scam_only';
  quietHoursOverride: boolean;
  notes: string;
}

const AVATAR_COLORS = [
  { name: 'Electric Indigo', value: 'linear-gradient(135deg, #4361ee 0%, #3046b8 100%)', border: '#4361ee' },
  { name: 'Emerald Safe', value: 'linear-gradient(135deg, #10b981 0%, #059669 100%)', border: '#10b981' },
  { name: 'Cyber Cyan', value: 'linear-gradient(135deg, #06b6d4 0%, #0891b2 100%)', border: '#06b6d4' },
  { name: 'Royal Purple', value: 'linear-gradient(135deg, #8b5cf6 0%, #6d28d9 100%)', border: '#8b5cf6' },
  { name: 'Ruby Guard', value: 'linear-gradient(135deg, #f43f5e 0%, #be123c 100%)', border: '#f43f5e' },
  { name: 'Sunset Amber', value: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)', border: '#f59e0b' },
];

const DEFAULT_PREFS: CaregiverCustomization = {
  displayName: '',
  avatarColor: AVATAR_COLORS[0]?.value ?? 'linear-gradient(135deg, #4361ee 0%, #3046b8 100%)',
  contactMethod: 'push',
  phoneNumber: '+1 (555) 019-2834',
  emailAddress: 'caregiver@familyguard.internal',
  alertThreshold: 'all',
  quietHoursOverride: true,
  notes: 'Primary emergency contact for Dorothy. Available 24/7 for gift-card scam alerts.',
};

export function Profile() {
  const { personId, logout, login } = useAuth();
  const { state } = useAppState();
  const [switching, setSwitching] = useState(false);
  const [savedToast, setSavedToast] = useState(false);

  const me = state?.people.find((p) => p.id === personId);
  const otherApprovers = state?.people.filter((p) => p.canApprove && p.id !== personId) ?? [];
  const elder = state?.people.find((p) => p.role === 'elder');

  // Load custom preferences from localStorage
  const [prefs, setPrefs] = useState<CaregiverCustomization>(() => {
    try {
      const stored = localStorage.getItem(`so-caregiver-prefs-${personId}`);
      if (stored) return { ...DEFAULT_PREFS, ...JSON.parse(stored) };
    } catch {
      // ignore
    }
    return {
      ...DEFAULT_PREFS,
      displayName: me?.name ?? 'Priya Sharma',
    };
  });

  useEffect(() => {
    if (me && !prefs.displayName) {
      setPrefs((p) => ({ ...p, displayName: me.name }));
    }
  }, [me, prefs.displayName]);

  function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (personId) {
      localStorage.setItem(`so-caregiver-prefs-${personId}`, JSON.stringify(prefs));
      setSavedToast(true);
      setTimeout(() => setSavedToast(false), 3000);
    }
  }

  if (!state) return <Spinner />;

  if (!me) {
    return (
      <div className="card">
        <p className="muted">Please sign in from the family console.</p>
      </div>
    );
  }

  const initials = (prefs.displayName || me.name)
    .split(' ')
    .map((n) => n[0])
    .filter(Boolean)
    .slice(0, 2)
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
      {/* Toast Notification */}
      {savedToast && (
        <div className="toast" role="status" aria-live="polite">
          <span className="row" style={{ gap: 8, alignItems: 'center' }}>
            <IconCheckCircle size={18} style={{ color: 'var(--ok)' }} />
            Profile customization and dispatch rules saved!
          </span>
        </div>
      )}

      {/* Header */}
      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16 }}>
        <div>
          <div className="row" style={{ gap: 8, marginBottom: 4 }}>
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                fontSize: '0.72rem',
                fontWeight: 800,
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
                color: 'var(--brand)',
                background: 'var(--brand-soft)',
                border: '1px solid var(--brand-border)',
                borderRadius: 'var(--radius-full)',
                padding: '3px 10px',
              }}
            >
              <span className="pulse-dot" />
              Verified Caregiver Identity
            </span>
            <span className="small muted">Fail-Closed Household Security</span>
          </div>
          <h1 style={{ margin: 0, fontSize: 'var(--text-2xl)', letterSpacing: '-0.03em' }}>Caregiver Profile & Customization</h1>
          <p className="muted small" style={{ margin: 'var(--space-1) 0 0' }}>
            Manage your personal verification credentials, quorum approval threshold, and real-time notification dispatch channels.
          </p>
        </div>

        <button
          type="button"
          className="btn ghost small"
          onClick={() => void logout()}
          style={{ gap: 6, color: 'var(--danger)', border: '1px solid var(--danger-border)' }}
        >
          <IconXCircle size={14} />
          Sign out
        </button>
      </div>

      {/* Hero Profile Card */}
      <section
        className="card animate-fade-in"
        style={{
          display: 'grid',
          gap: 'var(--space-4)',
          background: 'linear-gradient(180deg, var(--surface) 0%, var(--surface-2) 100%)',
          border: '1px solid var(--border-strong)',
          boxShadow: 'var(--shadow-md)',
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
          {/* Avatar with customized gradient */}
          <div
            aria-hidden="true"
            style={{
              width: 80,
              height: 80,
              borderRadius: '50%',
              background: prefs.avatarColor,
              color: '#ffffff',
              fontWeight: 900,
              fontSize: '2rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 8px 24px rgba(0,0,0,0.18)',
              border: '3px solid var(--surface)',
              flexShrink: 0,
              transition: 'background var(--transition)',
              letterSpacing: '-0.02em',
            }}
          >
            {initials}
          </div>

          <div className="grow" style={{ minWidth: 220 }}>
            <div className="row" style={{ gap: 'var(--space-2)', alignItems: 'center', marginBottom: 4 }}>
              <h2 style={{ margin: 0, fontSize: 'var(--text-xl)', fontWeight: 800 }}>
                {prefs.displayName || me.name}
              </h2>
              <Badge tone="ok">Active Approver</Badge>
              {me.approverRank && (
                <span className="badge brand" style={{ fontSize: 'var(--text-xs)' }}>
                  Quorum Rank #{me.approverRank}
                </span>
              )}
            </div>
            <p className="muted small" style={{ margin: 0, lineHeight: 1.5 }}>
              Primary family contact for <strong>{elder?.name ?? 'Dorothy'}</strong> · Auth ID: <code style={{ fontFamily: 'var(--mono)', fontSize: '0.8rem' }}>{me.id}</code>
            </p>
          </div>
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
          <div style={{ padding: '12px 14px', background: 'var(--surface)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}>
            <div className="muted small" style={{ fontWeight: 600 }}>Quorum Role</div>
            <div style={{ fontWeight: 700, marginTop: 4, display: 'flex', alignItems: 'center', gap: 6, color: 'var(--brand)' }}>
              <IconShieldCheck size={16} />
              <span>{me.canApprove ? 'Authorized Approver' : 'Viewer Only'}</span>
            </div>
            <div className="muted small" style={{ fontSize: '0.75rem', marginTop: 2 }}>
              {me.approverRank === 1 ? 'Primary first-responder' : 'Escalation fallback member'}
            </div>
          </div>

          <div style={{ padding: '12px 14px', background: 'var(--surface)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}>
            <div className="muted small" style={{ fontWeight: 600 }}>Household ID</div>
            <div style={{ fontWeight: 700, fontFamily: 'var(--mono)', marginTop: 4, color: 'var(--text)' }}>
              hh_demo
            </div>
            <div className="muted small" style={{ fontSize: '0.75rem', marginTop: 2 }}>
              Dorothy&apos;s Household Circle
            </div>
          </div>

          <div style={{ padding: '12px 14px', background: 'var(--surface)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}>
            <div className="muted small" style={{ fontWeight: 600 }}>Auth Method</div>
            <div style={{ fontWeight: 700, marginTop: 4, display: 'flex', alignItems: 'center', gap: 6, color: 'var(--ok)' }}>
              <IconLock size={15} />
              <span>PIN Verified</span>
            </div>
            <div className="muted small" style={{ fontSize: '0.75rem', marginTop: 2 }}>
              Demo PIN: {demoPins[me.id] ?? '••••'}
            </div>
          </div>
        </div>
      </section>

      {/* Interactive Customization Form */}
      <section className="card animate-slide-up" style={{ border: '1px solid var(--border)' }}>
        <div style={{ marginBottom: 'var(--space-4)' }}>
          <h2 style={{ margin: '0 0 6px', fontSize: 'var(--text-lg)', fontWeight: 800 }}>
            Caregiver Preferences &amp; Notification Rules
          </h2>
          <p className="muted small" style={{ margin: 0 }}>
            Personalize your identity appearance and define how Second Opinion dispatches payment hold alerts to you.
          </p>
        </div>

        <form onSubmit={handleSave} className="stack" style={{ gap: 'var(--space-4)' }}>
          {/* Avatar Color Choice */}
          <div>
            <label style={{ marginBottom: 8, display: 'block' }}>
              Avatar Color Scheme
              <span className="field-hint" style={{ display: 'block' }}>Choose your visual identity accent across the family console</span>
            </label>
            <div className="chips" style={{ gap: 8 }}>
              {AVATAR_COLORS.map((col) => {
                const isSelected = prefs.avatarColor === col.value;
                return (
                  <button
                    key={col.name}
                    type="button"
                    onClick={() => setPrefs((p) => ({ ...p, avatarColor: col.value }))}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      padding: '6px 14px',
                      borderRadius: 'var(--radius-full)',
                      border: isSelected ? `2px solid ${col.border}` : '1px solid var(--border)',
                      background: isSelected ? 'var(--surface-2)' : 'var(--surface)',
                      cursor: 'pointer',
                      fontWeight: isSelected ? 700 : 500,
                      fontSize: 'var(--text-xs)',
                      color: 'var(--text)',
                      transition: 'all var(--transition-fast)',
                    }}
                  >
                    <span
                      style={{
                        width: 14,
                        height: 14,
                        borderRadius: '50%',
                        background: col.value,
                        display: 'inline-block',
                      }}
                    />
                    {col.name}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Form grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 'var(--space-4)' }}>
            <label>
              Display Name
              <input
                type="text"
                value={prefs.displayName}
                onChange={(e) => setPrefs((p) => ({ ...p, displayName: e.target.value }))}
                placeholder="Your full name"
                required
              />
              <span className="field-hint">Shown in audit trails and Alexa+ approval logs</span>
            </label>

            <label>
              Preferred Dispatch Channel
              <select
                value={prefs.contactMethod}
                onChange={(e) => setPrefs((p) => ({ ...p, contactMethod: e.target.value as CaregiverCustomization['contactMethod'] }))}
              >
                <option value="push">Instant Push Notification (PWA / Mobile)</option>
                <option value="sms">SMS Text Alert (Twilio / AWS SNS)</option>
                <option value="email">Email Digest + Instant Urgent Holds</option>
              </select>
              <span className="field-hint">How Second Opinion reaches you when a payment is held</span>
            </label>

            <label>
              Emergency Phone Number
              <input
                type="tel"
                value={prefs.phoneNumber}
                onChange={(e) => setPrefs((p) => ({ ...p, phoneNumber: e.target.value }))}
                placeholder="+1 (555) 000-0000"
              />
              <span className="field-hint">Used for urgent fallback voice alerts</span>
            </label>

            <label>
              Alert Urgency Filter
              <select
                value={prefs.alertThreshold}
                onChange={(e) => setPrefs((p) => ({ ...p, alertThreshold: e.target.value as CaregiverCustomization['alertThreshold'] }))}
              >
                <option value="all">Notify on all holds (Standard Quorum)</option>
                <option value="high_risk">Only High Risk / Extortion (Score &gt; 50)</option>
                <option value="scam_only">Gift Cards &amp; Impersonation Only</option>
              </select>
              <span className="field-hint">Filter out minor holds during working hours</span>
            </label>
          </div>

          <label>
            Caregiver Notes &amp; Relationship Context
            <textarea
              rows={2}
              value={prefs.notes}
              onChange={(e) => setPrefs((p) => ({ ...p, notes: e.target.value }))}
              placeholder="Notes on availability or relationship..."
            />
            <span className="field-hint">Visible to other household approvers and the policy manager</span>
          </label>

          <label className="row" style={{ gap: 10, cursor: 'pointer', userSelect: 'none' }}>
            <input
              type="checkbox"
              style={{ width: 'auto', minHeight: 'auto', margin: 0 }}
              checked={prefs.quietHoursOverride}
              onChange={(e) => setPrefs((p) => ({ ...p, quietHoursOverride: e.target.checked }))}
            />
            <div>
              <strong>Quiet Hours Emergency Override:</strong> Allow critical high-severity scam alerts to bypass do-not-disturb between 10:00 PM and 7:00 AM.
            </div>
          </label>

          <div className="row" style={{ gap: 12, marginTop: 8 }}>
            <button type="submit" className="btn primary" style={{ gap: 8 }}>
              <IconSave size={16} />
              Save Profile Preferences
            </button>
            <button
              type="button"
              className="btn ghost"
              onClick={() => {
                setPrefs({ ...DEFAULT_PREFS, displayName: me.name });
                localStorage.removeItem(`so-caregiver-prefs-${personId}`);
                setSavedToast(true);
                setTimeout(() => setSavedToast(false), 2000);
              }}
            >
              Reset to Defaults
            </button>
          </div>
        </form>
      </section>

      {/* Quorum Authority & Security Policies */}
      <div className="split" style={{ gridTemplateColumns: '1.2fr 1fr' }}>
        <section className="card stack" style={{ gap: 'var(--space-3)' }}>
          <h2 style={{ margin: 0, fontSize: 'var(--text-lg)', display: 'flex', alignItems: 'center', gap: 8 }}>
            <IconShieldCheck size={18} style={{ color: 'var(--brand)' }} />
            <span>Quorum &amp; Veto Authority</span>
          </h2>
          <p className="small muted" style={{ margin: 0 }}>
            Under Second Opinion&apos;s deterministic fail-closed architecture, your security authority operates under strict protocols:
          </p>
          <ul className="stack" style={{ listStyle: 'none', padding: 0, margin: 0, gap: 'var(--space-2)' }}>
            <li
              className="row"
              style={{
                padding: '12px 14px',
                background: 'var(--surface-2)',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--border)',
                gap: 12,
                alignItems: 'flex-start',
              }}
            >
              <IconXCircle size={18} style={{ color: 'var(--danger)', marginTop: 2, flexShrink: 0 }} />
              <div style={{ fontSize: 'var(--text-sm)', lineHeight: 1.5 }}>
                <strong>Single-Veto Supremacy:</strong> If you or any designated caregiver clicks Deny, the payment is immediately and permanently blocked. An approval from another member cannot override your veto.
              </div>
            </li>
            <li
              className="row"
              style={{
                padding: '12px 14px',
                background: 'var(--surface-2)',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--border)',
                gap: 12,
                alignItems: 'flex-start',
              }}
            >
              <IconClock size={18} style={{ color: 'var(--warn)', marginTop: 2, flexShrink: 0 }} />
              <div style={{ fontSize: 'var(--text-sm)', lineHeight: 1.5 }}>
                <strong>Fail-Closed Expiration:</strong> If no approver responds before the policy deadline expires, the hold is marked expired and the payment remains cancelled. It never releases automatically.
              </div>
            </li>
            <li
              className="row"
              style={{
                padding: '12px 14px',
                background: 'var(--surface-2)',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--border)',
                gap: 12,
                alignItems: 'flex-start',
              }}
            >
              <IconCheckCircle size={18} style={{ color: 'var(--ok)', marginTop: 2, flexShrink: 0 }} />
              <div style={{ fontSize: 'var(--text-sm)', lineHeight: 1.5 }}>
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
              <span>Active Dispatch Channels</span>
            </h2>
            <div className="stack" style={{ gap: 'var(--space-2)' }}>
              <div
                className="row"
                style={{
                  padding: '10px 14px',
                  background: 'var(--surface-2)',
                  borderRadius: 'var(--radius-sm)',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <div className="row" style={{ gap: 8, alignItems: 'center' }}>
                  <IconSmartphone size={16} style={{ color: 'var(--brand)' }} />
                  <span className="small" style={{ fontWeight: 600 }}>Mobile Push Alert</span>
                </div>
                <Badge tone="ok">Live &amp; Active</Badge>
              </div>

              <div
                className="row"
                style={{
                  padding: '10px 14px',
                  background: 'var(--surface-2)',
                  borderRadius: 'var(--radius-sm)',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <div className="row" style={{ gap: 8, alignItems: 'center' }}>
                  <IconMail size={16} style={{ color: 'var(--info)' }} />
                  <span className="small" style={{ fontWeight: 600 }}>Caregiver Email Digest</span>
                </div>
                <Badge tone="ok">Enabled</Badge>
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
          <h2 id="history" style={{ margin: 0, fontSize: 'var(--text-lg)', fontWeight: 800 }}>
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
