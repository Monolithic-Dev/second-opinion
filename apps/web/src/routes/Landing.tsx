import { Link } from 'react-router-dom';
import {
  IconShieldCheck,
  IconArrowRight,
  IconZap,
  IconLock,
  IconCheckCircle,
  IconUsers,
  IconSparkles,
  IconMonitor,
  IconServer,
  IconClock,
  IconAlertTriangle,
} from '../components/icons';

export function Landing() {
  return (
    <div style={{ paddingBottom: 'var(--space-8)' }}>
      {/* Hero Section */}
      <section
        style={{
          position: 'relative',
          padding: 'clamp(48px, 8vw, 96px) 24px clamp(40px, 6vw, 80px)',
          textAlign: 'center',
          overflow: 'hidden',
          background: 'radial-gradient(ellipse 80% 50% at 50% -20%, rgba(37, 99, 235, 0.15), transparent)',
        }}
      >
        <div style={{ maxWidth: 900, margin: '0 auto', position: 'relative', zIndex: 1 }}>
          {/* Badge */}
          <div
            className="row"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              padding: '6px 14px',
              borderRadius: 'var(--radius-full)',
              background: 'var(--surface-2)',
              border: '1px solid var(--border)',
              boxShadow: 'var(--shadow-sm)',
              fontSize: 'var(--text-xs)',
              fontWeight: 600,
              color: 'var(--text)',
              marginBottom: 'var(--space-4)',
            }}
          >
            <span className="pulse-dot" style={{ background: 'var(--brand)' }} />
            <span>Amazon Developer Hackathon 2026 · Alexa+ Payment Guard</span>
          </div>

          {/* Main Headline */}
          <h1
            style={{
              fontSize: 'clamp(2.4rem, 5.5vw, 4.2rem)',
              fontWeight: 800,
              lineHeight: 1.1,
              letterSpacing: '-0.035em',
              margin: '0 0 var(--space-4)',
              color: 'var(--text)',
            }}
          >
            Zero-Trust Payment Security <br />
            <span
              style={{
                background: 'linear-gradient(135deg, #2563eb 0%, #3b82f6 50%, #60a5fa 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
              }}
            >
              for the Voice AI Era
            </span>
          </h1>

          {/* Subtitle */}
          <p
            className="muted"
            style={{
              fontSize: 'clamp(1.05rem, 2vw, 1.3rem)',
              lineHeight: 1.6,
              maxWidth: 720,
              margin: '0 auto var(--space-6)',
              fontWeight: 400,
            }}
          >
            A deterministic risk engine, Model Context Protocol (MCP) server, and real-time family quorum circle that halts elder financial fraud before funds leave the bank account.
          </p>

          {/* CTA Buttons */}
          <div
            className="row"
            style={{
              justifyContent: 'center',
              gap: 'var(--space-3)',
              flexWrap: 'wrap',
              marginBottom: 'var(--space-7)',
            }}
          >
            <Link
              to="/demo"
              className="btn primary"
              style={{
                padding: '14px 26px',
                fontSize: 'var(--text-base)',
                fontWeight: 700,
                borderRadius: 'var(--radius)',
                gap: 10,
                boxShadow: '0 4px 20px rgba(37, 99, 235, 0.35)',
              }}
            >
              <span>Launch Live Simulator</span>
              <IconArrowRight size={18} />
            </Link>

            <Link
              to="/family"
              className="btn"
              style={{
                padding: '14px 24px',
                fontSize: 'var(--text-base)',
                fontWeight: 600,
                borderRadius: 'var(--radius)',
                background: 'var(--surface)',
                borderColor: 'var(--border)',
                gap: 8,
              }}
            >
              <IconShieldCheck size={18} style={{ color: 'var(--brand)' }} />
              <span>Open Family Console</span>
            </Link>
          </div>

          {/* Enterprise Guarantees Bar */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
              gap: 'var(--space-3)',
              padding: 'var(--space-4)',
              background: 'var(--surface)',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border)',
              boxShadow: 'var(--shadow-md)',
              textAlign: 'left',
            }}
          >
            <div className="row" style={{ gap: 10, alignItems: 'center' }}>
              <div style={{ color: 'var(--danger)' }}><IconLock size={18} /></div>
              <div>
                <div style={{ fontWeight: 700, fontSize: 'var(--text-sm)' }}>Fail Closed</div>
                <div className="muted small" style={{ fontSize: '0.72rem' }}>Never auto-releases</div>
              </div>
            </div>

            <div className="row" style={{ gap: 10, alignItems: 'center' }}>
              <div style={{ color: 'var(--brand)' }}><IconZap size={18} /></div>
              <div>
                <div style={{ fontWeight: 700, fontSize: 'var(--text-sm)' }}>Rules Decide</div>
                <div className="muted small" style={{ fontSize: '0.72rem' }}>Zero AI hallucinations</div>
              </div>
            </div>

            <div className="row" style={{ gap: 10, alignItems: 'center' }}>
              <div style={{ color: 'var(--ok)' }}><IconServer size={18} /></div>
              <div>
                <div style={{ fontWeight: 700, fontSize: 'var(--text-sm)' }}>Streamable MCP</div>
                <div className="muted small" style={{ fontSize: '0.72rem' }}>RFC compliant protocols</div>
              </div>
            </div>

            <div className="row" style={{ gap: 10, alignItems: 'center' }}>
              <div style={{ color: 'var(--info)' }}><IconUsers size={18} /></div>
              <div>
                <div style={{ fontWeight: 700, fontSize: 'var(--text-sm)' }}>Family Quorum</div>
                <div className="muted small" style={{ fontSize: '0.72rem' }}>Single veto supremacy</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 3 Pillars Architecture Section */}
      <section style={{ maxWidth: 1100, margin: '0 auto', padding: '0 24px' }}>
        <div style={{ textAlign: 'center', marginBottom: 'var(--space-6)' }}>
          <span style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--brand)', letterSpacing: '0.08em' }}>
            Defense in Depth Architecture
          </span>
          <h2 style={{ fontSize: 'var(--text-2xl)', fontWeight: 800, margin: '8px 0 0', letterSpacing: '-0.02em' }}>
            Built for High-Stakes Payment Protection
          </h2>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 'var(--space-4)' }}>
          {/* Pillar 1 */}
          <div
            className="card"
            style={{
              padding: 'var(--space-5)',
              display: 'flex',
              flexDirection: 'column',
              gap: 'var(--space-3)',
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-md)',
              position: 'relative',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                width: 42,
                height: 42,
                borderRadius: 12,
                background: 'var(--danger-bg)',
                color: 'var(--danger)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <IconAlertTriangle size={22} />
            </div>
            <h3 style={{ margin: 0, fontSize: 'var(--text-lg)', fontWeight: 700 }}>
              1. Deterministic Risk Engine
            </h3>
            <p className="muted small" style={{ margin: 0, lineHeight: 1.6 }}>
              Pure TypeScript engine evaluating payments against gift card extortion, government impersonation, urgent velocity spikes, and quiet hour boundaries. <strong>Rules decide verdicts; models never do.</strong>
            </p>
          </div>

          {/* Pillar 2 */}
          <div
            className="card"
            style={{
              padding: 'var(--space-5)',
              display: 'flex',
              flexDirection: 'column',
              gap: 'var(--space-3)',
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-md)',
              position: 'relative',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                width: 42,
                height: 42,
                borderRadius: 12,
                background: 'var(--brand-muted)',
                color: 'var(--brand)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <IconServer size={22} />
            </div>
            <h3 style={{ margin: 0, fontSize: 'var(--text-lg)', fontWeight: 700 }}>
              2. Model Context Protocol (MCP)
            </h3>
            <p className="muted small" style={{ margin: 0, lineHeight: 1.6 }}>
              Production Streamable HTTP server exposing standardized tools to Alexa+ orchestrators. Enforces strict Zod schema validation, origin filtering, and explicit error contracts without exposing raw banking credentials.
            </p>
          </div>

          {/* Pillar 3 */}
          <div
            className="card"
            style={{
              padding: 'var(--space-5)',
              display: 'flex',
              flexDirection: 'column',
              gap: 'var(--space-3)',
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-md)',
              position: 'relative',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                width: 42,
                height: 42,
                borderRadius: 12,
                background: 'var(--ok-bg)',
                color: 'var(--ok)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <IconUsers size={22} />
            </div>
            <h3 style={{ margin: 0, fontSize: 'var(--text-lg)', fontWeight: 700 }}>
              3. Family Caregiver Quorum
            </h3>
            <p className="muted small" style={{ margin: 0, lineHeight: 1.6 }}>
              Configurable 1 or 2-approver quorum with automatic escalation fallbacks. Any single caregiver denial decisively kills the transaction. Resident elders can never authorize their own flagged transfers.
            </p>
          </div>
        </div>
      </section>

      {/* Live Simulation Preview Showcase */}
      <section style={{ maxWidth: 1100, margin: 'var(--space-7) auto 0', padding: '0 24px' }}>
        <div
          className="card"
          style={{
            padding: 'var(--space-6)',
            background: 'linear-gradient(135deg, var(--surface) 0%, var(--surface-2) 100%)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-lg)',
            boxShadow: 'var(--shadow-lg)',
          }}
        >
          <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
            <div>
              <span className="badge info" style={{ fontSize: '0.72rem', marginBottom: 8 }}>
                Experience It Live
              </span>
              <h3 style={{ margin: 0, fontSize: 'var(--text-xl)' }}>
                Test the Dual-Screen Interactive Hardware Simulator
              </h3>
              <p className="muted small" style={{ margin: '4px 0 0', maxWidth: 600 }}>
                Witness real-time Alexa+ voice audio synthesis on Dorothy&apos;s Echo Show alongside Priya&apos;s mobile caregiver push notification and instant quorum decisioning.
              </p>
            </div>

            <Link
              to="/demo"
              className="btn primary"
              style={{
                padding: '12px 20px',
                fontWeight: 700,
                gap: 8,
              }}
            >
              <span>Try Scam Scenarios Now</span>
              <IconArrowRight size={16} />
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
