import { Link } from 'react-router-dom';
import {
  IconShieldCheck,
  IconArrowRight,
  IconZap,
  IconLock,
  IconUsers,
  IconServer,
  IconAlertTriangle,
  IconCheckCircle,
  IconClock,
  IconActivity,
} from '../components/icons';

/* ── Tiny inline icons for the feature grid ── */
function FeatureCard({
  icon,
  color,
  bgColor,
  title,
  body,
  delay = 0,
}: {
  icon: React.ReactNode;
  color: string;
  bgColor: string;
  title: string;
  body: string;
  delay?: number;
}) {
  return (
    <div
      className="card animate-slide-up"
      style={{
        padding: '28px',
        display: 'flex',
        flexDirection: 'column',
        gap: 16,
        animationDelay: `${delay}ms`,
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-lg)',
        transition: 'all var(--transition)',
      }}
    >
      <div
        style={{
          width: 48,
          height: 48,
          borderRadius: 14,
          background: bgColor,
          color,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        {icon}
      </div>
      <div>
        <h3 style={{ margin: '0 0 8px', fontSize: 'var(--text-md)', fontWeight: 700 }}>{title}</h3>
        <p className="muted small" style={{ margin: 0, lineHeight: 1.65 }}>{body}</p>
      </div>
    </div>
  );
}

function StatItem({ value, label }: { value: string; label: string }) {
  return (
    <div style={{ textAlign: 'center', padding: '0 var(--space-5)' }}>
      <div style={{
        fontSize: 'clamp(1.8rem, 3.5vw, 2.8rem)',
        fontWeight: 900,
        letterSpacing: '-0.04em',
        background: 'linear-gradient(135deg, var(--brand-light) 0%, var(--brand) 100%)',
        WebkitBackgroundClip: 'text',
        WebkitTextFillColor: 'transparent',
        lineHeight: 1.1,
      }}>
        {value}
      </div>
      <div className="muted small" style={{ marginTop: 4, fontWeight: 500 }}>{label}</div>
    </div>
  );
}

export function Landing() {
  return (
    <div>
      {/* ═══════════════════════════════════════════════════════════
          HERO SECTION
          ═══════════════════════════════════════════════════════════ */}
      <section
        style={{
          position: 'relative',
          padding: 'clamp(64px, 10vw, 120px) 24px clamp(48px, 7vw, 96px)',
          textAlign: 'center',
          overflow: 'hidden',
        }}
      >
        {/* Hero gradient orbs */}
        <div aria-hidden="true" style={{
          position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none',
        }}>
          <div style={{
            position: 'absolute',
            top: '-30%', left: '50%',
            transform: 'translateX(-50%)',
            width: '80vw', maxWidth: 900,
            height: '80vw', maxHeight: 900,
            background: 'radial-gradient(ellipse at center, rgba(67, 97, 238, 0.15) 0%, transparent 65%)',
            borderRadius: '50%',
            animation: 'orb-drift 12s ease-in-out infinite',
          }} />
          <div style={{
            position: 'absolute',
            top: '20%', left: '-10%',
            width: 400, height: 400,
            background: 'radial-gradient(ellipse, rgba(124, 58, 237, 0.08) 0%, transparent 70%)',
            borderRadius: '50%',
            animation: 'orb-drift 15s ease-in-out infinite reverse',
          }} />
          <div style={{
            position: 'absolute',
            top: '10%', right: '-8%',
            width: 350, height: 350,
            background: 'radial-gradient(ellipse, rgba(6, 182, 212, 0.07) 0%, transparent 70%)',
            borderRadius: '50%',
            animation: 'orb-drift 18s ease-in-out infinite',
            animationDelay: '-6s',
          }} />
        </div>

        <div style={{ maxWidth: 860, margin: '0 auto', position: 'relative', zIndex: 1 }}>
          {/* Hackathon badge */}
          <div
            className="animate-fade-in"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              padding: '6px 16px',
              borderRadius: 'var(--radius-full)',
              background: 'var(--brand-soft)',
              border: '1px solid var(--brand-border)',
              fontSize: '0.78rem',
              fontWeight: 700,
              color: 'var(--brand)',
              marginBottom: 28,
              letterSpacing: '0.02em',
            }}
          >
            <span className="pulse-dot" />
            <span>Amazon Developer Hackathon 2026 · Alexa+ Payment Guard</span>
          </div>

          {/* Headline */}
          <h1
            className="animate-slide-up"
            style={{
              fontSize: 'clamp(2.6rem, 6vw, 4.8rem)',
              fontWeight: 900,
              lineHeight: 1.05,
              letterSpacing: '-0.04em',
              margin: '0 0 24px',
              color: 'var(--text)',
              animationDelay: '60ms',
            }}
          >
            Zero-Trust Payment{' '}
            <br />
            <span
              style={{
                background: 'linear-gradient(135deg, var(--brand-light) 0%, var(--brand) 40%, var(--accent) 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
              }}
            >
              Security for Voice AI
            </span>
          </h1>

          {/* Subtitle */}
          <p
            className="animate-slide-up"
            style={{
              fontSize: 'clamp(1.05rem, 2vw, 1.25rem)',
              lineHeight: 1.7,
              maxWidth: 680,
              margin: '0 auto 40px',
              color: 'var(--muted)',
              fontWeight: 400,
              animationDelay: '120ms',
            }}
          >
            A deterministic risk engine, MCP server, and real-time family quorum circle that
            halts elder financial fraud before funds leave the account — without ever delegating
            the verdict to a language model.
          </p>

          {/* CTA Row */}
          <div
            className="row animate-slide-up"
            style={{
              justifyContent: 'center',
              gap: 12,
              flexWrap: 'wrap',
              marginBottom: 64,
              animationDelay: '180ms',
            }}
          >
            <Link
              to="/demo"
              className="btn primary big"
              style={{
                padding: '15px 30px',
                fontSize: '1rem',
                fontWeight: 800,
                borderRadius: 'var(--radius)',
                gap: 10,
                letterSpacing: '-0.01em',
              }}
            >
              <span>Launch Live Simulator</span>
              <IconArrowRight size={18} />
            </Link>

            <Link
              to="/family"
              className="btn big"
              style={{
                padding: '15px 26px',
                fontSize: '1rem',
                fontWeight: 700,
                borderRadius: 'var(--radius)',
                gap: 10,
                background: 'var(--surface)',
                borderColor: 'var(--border-strong)',
              }}
            >
              <IconShieldCheck size={18} style={{ color: 'var(--brand)' }} />
              <span>Open Family Console</span>
            </Link>
          </div>

          {/* Guarantees bar */}
          <div
            className="animate-slide-up"
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))',
              gap: 1,
              background: 'var(--border)',
              borderRadius: 'var(--radius-lg)',
              overflow: 'hidden',
              border: '1px solid var(--border)',
              boxShadow: 'var(--shadow-md)',
              animationDelay: '240ms',
            }}
          >
            {[
              { icon: <IconLock size={18} />, color: 'var(--danger)', bg: 'var(--danger-bg)', label: 'Fail Closed', sub: 'Never auto-releases' },
              { icon: <IconZap size={18} />, color: 'var(--brand)', bg: 'var(--brand-soft)', label: 'Rules Decide', sub: 'Zero AI verdicts' },
              { icon: <IconServer size={18} />, color: 'var(--ok)', bg: 'var(--ok-bg)', label: 'Streamable MCP', sub: 'RFC-compliant' },
              { icon: <IconUsers size={18} />, color: 'var(--info)', bg: 'var(--info-bg)', label: 'Family Quorum', sub: 'Single veto wins' },
            ].map((g) => (
              <div
                key={g.label}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  padding: '18px 20px',
                  background: 'var(--surface)',
                  textAlign: 'left',
                }}
              >
                <div style={{
                  width: 36, height: 36,
                  borderRadius: 10,
                  background: g.bg,
                  color: g.color,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  flexShrink: 0,
                }}>
                  {g.icon}
                </div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: '0.875rem', color: 'var(--text)' }}>{g.label}</div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--muted)', fontWeight: 500, marginTop: 1 }}>{g.sub}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════
          STATS BAR
          ═══════════════════════════════════════════════════════════ */}
      <section style={{
        borderTop: '1px solid var(--border)',
        borderBottom: '1px solid var(--border)',
        background: 'var(--surface)',
        padding: '40px 24px',
      }}>
        <div style={{
          maxWidth: 900,
          margin: '0 auto',
          display: 'flex',
          justifyContent: 'space-around',
          flexWrap: 'wrap',
          gap: 24,
          alignItems: 'center',
        }}>
          <StatItem value="&lt;50ms" label="Risk engine latency" />
          <div style={{ width: 1, height: 48, background: 'var(--border)', flexShrink: 0 }} />
          <StatItem value="100%" label="Deterministic verdicts" />
          <div style={{ width: 1, height: 48, background: 'var(--border)', flexShrink: 0 }} />
          <StatItem value="297" label="Tests passing" />
          <div style={{ width: 1, height: 48, background: 'var(--border)', flexShrink: 0 }} />
          <StatItem value="0" label="AI hallucinations possible" />
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════
          ARCHITECTURE — 3 PILLARS
          ═══════════════════════════════════════════════════════════ */}
      <section style={{ maxWidth: 1200, margin: '0 auto', padding: 'clamp(48px,7vw,96px) 24px' }}>
        <div style={{ textAlign: 'center', marginBottom: 48 }}>
          <div style={{
            display: 'inline-block',
            padding: '5px 14px',
            borderRadius: 'var(--radius-full)',
            background: 'var(--brand-soft)',
            border: '1px solid var(--brand-border)',
            fontSize: '0.72rem',
            fontWeight: 800,
            color: 'var(--brand)',
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
            marginBottom: 16,
          }}>
            Defense in Depth Architecture
          </div>
          <h2 style={{
            fontSize: 'clamp(1.6rem, 3.5vw, 2.6rem)',
            fontWeight: 900,
            margin: 0,
            letterSpacing: '-0.035em',
          }}>
            Three layers of protection,<br />
            <span style={{ color: 'var(--muted)', fontWeight: 400 }}>working in perfect harmony</span>
          </h2>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 20 }}>
          <FeatureCard
            icon={<IconAlertTriangle size={22} />}
            color="var(--danger)"
            bgColor="var(--danger-bg)"
            title="1. Deterministic Risk Engine"
            body="Pure TypeScript rules evaluating gift-card extortion, government impersonation, urgent velocity spikes, quiet-hour boundaries, and more. Rules decide the verdict — models never do."
            delay={40}
          />
          <FeatureCard
            icon={<IconServer size={22} />}
            color="var(--brand)"
            bgColor="var(--brand-soft)"
            title="2. Streamable MCP Server"
            body="Production Streamable HTTP server with Zod schema validation, origin filtering, and strict error contracts. Exposes standardised tools to Alexa+ orchestrators without leaking credentials."
            delay={100}
          />
          <FeatureCard
            icon={<IconUsers size={22} />}
            color="var(--ok)"
            bgColor="var(--ok-bg)"
            title="3. Family Quorum Circle"
            body="Configurable 1 or 2-approver quorum with automatic escalation fallbacks. A single caregiver denial kills the transaction permanently. Elder users cannot self-approve flagged payments."
            delay={160}
          />
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════
          HOW IT WORKS — TIMELINE
          ═══════════════════════════════════════════════════════════ */}
      <section style={{
        background: 'var(--surface)',
        borderTop: '1px solid var(--border)',
        borderBottom: '1px solid var(--border)',
        padding: 'clamp(48px, 7vw, 96px) 24px',
      }}>
        <div style={{ maxWidth: 900, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 56 }}>
            <div style={{
              display: 'inline-block',
              padding: '5px 14px',
              borderRadius: 'var(--radius-full)',
              background: 'var(--ok-bg)',
              border: '1px solid var(--ok-border)',
              fontSize: '0.72rem',
              fontWeight: 800,
              color: 'var(--ok)',
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              marginBottom: 16,
            }}>
              Request Lifecycle
            </div>
            <h2 style={{ fontSize: 'clamp(1.5rem, 3vw, 2.4rem)', fontWeight: 900, margin: 0, letterSpacing: '-0.03em' }}>
              What happens when Dorothy says{' '}
              <span style={{ fontStyle: 'italic', color: 'var(--brand)' }}>"Alexa, pay $200"</span>
            </h2>
          </div>

          <div style={{ display: 'grid', gap: 16 }}>
            {[
              {
                step: '01',
                icon: <IconActivity size={18} />,
                color: 'var(--brand)',
                bg: 'var(--brand-soft)',
                title: 'MCP Tool Call Received',
                body: 'Alexa+ calls the Second Opinion MCP server. Origin is validated and the payload is schema-checked with Zod before any processing begins.',
              },
              {
                step: '02',
                icon: <IconZap size={18} />,
                color: 'var(--warn)',
                bg: 'var(--warn-bg)',
                title: 'Risk Engine Scores the Request',
                body: 'The deterministic engine evaluates 12+ fraud signals: gift-card patterns, impersonation keywords, time-of-day rules, daily velocity limits, and payee trust lists.',
              },
              {
                step: '03',
                icon: <IconLock size={18} />,
                color: 'var(--danger)',
                bg: 'var(--danger-bg)',
                title: 'High-Risk: Payment is Placed on Hold',
                body: 'Risky transactions are frozen immediately. Dorothy hears a calm voice explanation. Alexa+ is told the payment is under review — no funds move.',
              },
              {
                step: '04',
                icon: <IconUsers size={18} />,
                color: 'var(--purple)',
                bg: 'var(--purple-soft)',
                title: 'Family Caregiver Receives Approval Request',
                body: 'Priya gets an instant push notification with full context: the amount, the payee, and every signal that triggered the hold. She can approve or deny in one tap.',
              },
              {
                step: '05',
                icon: <IconCheckCircle size={18} />,
                color: 'var(--ok)',
                bg: 'var(--ok-bg)',
                title: 'Quorum Decision is Final and Audited',
                body: 'A single denial kills the request permanently. Every decision is logged with a timestamp and caregiver identity for the audit trail — and reported back to Alexa+ via MCP.',
              },
            ].map((s) => (
              <div
                key={s.step}
                className="animate-slide-up"
                style={{
                  display: 'grid',
                  gridTemplateColumns: '52px 1fr',
                  gap: 16,
                  alignItems: 'start',
                }}
              >
                <div style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 4,
                  paddingTop: 4,
                }}>
                  <div style={{
                    width: 44,
                    height: 44,
                    borderRadius: 'var(--radius)',
                    background: s.bg,
                    border: `1px solid ${s.color}`,
                    color: s.color,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                    opacity: 0.9,
                  }}>
                    {s.icon}
                  </div>
                </div>
                <div style={{
                  background: 'var(--surface-2)',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius)',
                  padding: '18px 20px',
                }}>
                  <div style={{
                    fontSize: '0.7rem',
                    fontWeight: 800,
                    color: s.color,
                    textTransform: 'uppercase',
                    letterSpacing: '0.08em',
                    marginBottom: 4,
                  }}>
                    Step {s.step}
                  </div>
                  <h4 style={{ margin: '0 0 6px', fontSize: '1rem', fontWeight: 700 }}>{s.title}</h4>
                  <p className="muted small" style={{ margin: 0, lineHeight: 1.65 }}>{s.body}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════
          ADDITIONAL FEATURES GRID
          ═══════════════════════════════════════════════════════════ */}
      <section style={{ maxWidth: 1200, margin: '0 auto', padding: 'clamp(48px,7vw,96px) 24px' }}>
        <div style={{ textAlign: 'center', marginBottom: 48 }}>
          <h2 style={{ fontSize: 'clamp(1.5rem, 3vw, 2.2rem)', fontWeight: 900, margin: '0 0 12px', letterSpacing: '-0.03em' }}>
            Enterprise-grade by design
          </h2>
          <p className="muted" style={{ maxWidth: 560, margin: '0 auto', fontSize: '1.05rem' }}>
            Every design decision made for real-world deployment, not a demo.
          </p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 16 }}>
          {[
            { icon: <IconLock size={20} />, color: 'var(--danger)', bg: 'var(--danger-bg)', title: 'Fail Closed by Default', body: 'Any error in check, hold, or approval path means the payment is NOT executed. No exception.' },
            { icon: <IconZap size={20} />, color: 'var(--brand)', bg: 'var(--brand-soft)', title: 'No AI in the Verdict Path', body: 'LLMs can rephrase explanations, but zero ML code touches the allow/hold/deny decision.' },
            { icon: <IconActivity size={20} />, color: 'var(--ok)', bg: 'var(--ok-bg)', title: 'Full Audit Trail', body: 'Every MCP call, risk check, hold, and caregiver decision is timestamped and queryable.' },
            { icon: <IconClock size={20} />, color: 'var(--warn)', bg: 'var(--warn-bg)', title: 'Quiet Hour Enforcement', body: 'Configurable quiet hours block all high-risk payments automatically during sleeping hours.' },
            { icon: <IconServer size={20} />, color: 'var(--info)', bg: 'var(--info-bg)', title: 'Stateless Streamable HTTP', body: 'MCP server is stateless, horizontally scalable, and compliant with the 2024-11 MCP spec.' },
            { icon: <IconShieldCheck size={20} />, color: 'var(--purple)', bg: 'var(--purple-soft)', title: 'Zod Schema Validation', body: 'Every tool input and output validated with Zod schemas. Malformed calls return structured errors.' },
          ].map((f, i) => (
            <FeatureCard
              key={f.title}
              icon={f.icon}
              color={f.color}
              bgColor={f.bg}
              title={f.title}
              body={f.body}
              delay={i * 40}
            />
          ))}
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════
          CTA SECTION
          ═══════════════════════════════════════════════════════════ */}
      <section style={{ maxWidth: 1200, margin: '0 auto', padding: '0 24px clamp(64px,10vw,120px)' }}>
        <div
          style={{
            position: 'relative',
            borderRadius: 'var(--radius-2xl)',
            padding: 'clamp(40px, 6vw, 72px) clamp(32px, 5vw, 64px)',
            background: 'linear-gradient(135deg, var(--brand-dark) 0%, var(--brand) 50%, var(--brand-light) 100%)',
            overflow: 'hidden',
            textAlign: 'center',
            boxShadow: 'var(--shadow-brand-lg)',
          }}
        >
          {/* Decorative orbs inside CTA */}
          <div aria-hidden="true" style={{
            position: 'absolute', top: '-30%', left: '-10%',
            width: 400, height: 400,
            background: 'radial-gradient(circle, rgba(255,255,255,0.12) 0%, transparent 70%)',
            borderRadius: '50%',
            pointerEvents: 'none',
          }} />
          <div aria-hidden="true" style={{
            position: 'absolute', bottom: '-40%', right: '-5%',
            width: 500, height: 500,
            background: 'radial-gradient(circle, rgba(6,182,212,0.2) 0%, transparent 70%)',
            borderRadius: '50%',
            pointerEvents: 'none',
          }} />

          <div style={{ position: 'relative', zIndex: 1 }}>
            <div style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              padding: '5px 14px',
              borderRadius: 'var(--radius-full)',
              background: 'rgba(255,255,255,0.15)',
              border: '1px solid rgba(255,255,255,0.25)',
              fontSize: '0.72rem',
              fontWeight: 800,
              color: '#fff',
              textTransform: 'uppercase' as const,
              letterSpacing: '0.08em',
              marginBottom: 24,
            }}>
              <span className="pulse-dot" style={{ background: '#fff' }} />
              Live Interactive Demo
            </div>

            <h2 style={{
              fontSize: 'clamp(1.6rem, 3.5vw, 2.8rem)',
              fontWeight: 900,
              color: '#fff',
              margin: '0 0 16px',
              letterSpacing: '-0.035em',
            }}>
              Watch the system catch a scam in real time
            </h2>
            <p style={{
              color: 'rgba(255,255,255,0.8)',
              fontSize: '1.05rem',
              margin: '0 auto 36px',
              maxWidth: 560,
              lineHeight: 1.6,
            }}>
              Experience Dorothy's Echo Show and Priya's mobile caregiver console simultaneously. Trigger real scam scenarios and watch the quorum system respond.
            </p>

            <div className="row" style={{ justifyContent: 'center', gap: 12, flexWrap: 'wrap' }}>
              <Link
                to="/demo"
                className="btn big"
                style={{
                  background: '#fff',
                  color: 'var(--brand-dark)',
                  fontWeight: 800,
                  gap: 10,
                  borderColor: 'transparent',
                  boxShadow: '0 4px 20px rgba(0,0,0,0.2)',
                }}
              >
                <span>Try Scam Scenarios Now</span>
                <IconArrowRight size={18} />
              </Link>
              <Link
                to="/family"
                className="btn big"
                style={{
                  background: 'rgba(255,255,255,0.12)',
                  color: '#fff',
                  fontWeight: 700,
                  borderColor: 'rgba(255,255,255,0.3)',
                  gap: 10,
                }}
              >
                <IconUsers size={18} />
                <span>Open Family Console</span>
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
