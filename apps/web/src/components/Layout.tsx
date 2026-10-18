import { useEffect, useState, type ReactNode } from 'react';
import { NavLink } from 'react-router-dom';
import { api } from '../api';
import { useAppState } from '../hooks/useAppState';
import { IconActivity, IconServer, IconShieldCheck } from './icons';

function StatusDot({ ok }: { ok: boolean | null }) {
  const color = ok === null ? 'var(--muted)' : ok ? 'var(--ok)' : 'var(--danger)';
  return (
    <span
      aria-hidden="true"
      style={{
        display: 'inline-block',
        width: 7,
        height: 7,
        borderRadius: '50%',
        background: color,
        boxShadow: ok ? `0 0 6px ${color}` : 'none',
        flexShrink: 0,
      }}
    />
  );
}

function HealthPill() {
  const { live } = useAppState();
  const [mcp, setMcp] = useState<boolean | null>(null);

  useEffect(() => {
    let alive = true;
    const probe = () => api.health().then((h) => alive && setMcp(h.mcp)).catch(() => alive && setMcp(false));
    void probe();
    const t = setInterval(probe, 8000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, []);

  return (
    <div
      className="row"
      aria-label="System status"
      style={{ gap: 'var(--space-2)', fontSize: 'var(--text-xs)', fontWeight: 600 }}
    >
      <span
        className="row"
        style={{
          gap: 6,
          padding: '5px 10px',
          borderRadius: 'var(--radius-full)',
          background: 'var(--surface-2)',
          border: '1px solid var(--border)',
          color: mcp ? 'var(--ok)' : mcp === false ? 'var(--danger)' : 'var(--muted)',
        }}
      >
        <IconServer size={12} aria-hidden="true" />
        <StatusDot ok={mcp} />
        {mcp === null ? 'Checking…' : mcp ? 'MCP server connected' : 'MCP server unreachable'}
      </span>

      <span
        className="row"
        style={{
          gap: 6,
          padding: '5px 10px',
          borderRadius: 'var(--radius-full)',
          background: 'var(--surface-2)',
          border: '1px solid var(--border)',
          color: live ? 'var(--info)' : 'var(--muted)',
        }}
      >
        <IconActivity size={12} aria-hidden="true" />
        <StatusDot ok={live ? true : null} />
        {live ? 'Live' : 'Offline'}
      </span>
    </div>
  );
}

export function Layout({ children }: { children: ReactNode }) {
  return (
    <>
      <a href="#main" className="sr-only">
        Skip to content
      </a>
      <header className="app-header">
        <NavLink to="/demo" className="brand" aria-label="Second Opinion home">
          <span
            aria-hidden="true"
            style={{
              width: 34,
              height: 34,
              borderRadius: 10,
              background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              boxShadow: '0 2px 8px rgba(37,99,235,0.35)',
            }}
          >
            <IconShieldCheck size={18} style={{ color: '#fff', strokeWidth: '2' }} aria-hidden="true" />
          </span>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            <span style={{ lineHeight: 1.15, letterSpacing: '-0.02em' }}>Second Opinion</span>
            <span
              style={{
                fontSize: '0.65rem',
                fontWeight: 600,
                color: 'var(--muted)',
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
              }}
            >
              Payment Guard · Alexa+
            </span>
          </div>
        </NavLink>

        <nav className="nav" aria-label="Main">
          <NavLink to="/" end>Overview</NavLink>
          <NavLink to="/demo">Live demo</NavLink>
          <NavLink to="/family">Family console</NavLink>
        </nav>

        <div className="right">
          <HealthPill />
        </div>
      </header>
      <div id="main">{children}</div>
    </>
  );
}
