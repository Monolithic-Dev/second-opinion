import { useEffect, useState, type ReactNode } from 'react';
import { NavLink } from 'react-router-dom';
import { api } from '../api';
import { useAppState } from '../hooks/useAppState';
import { Badge } from './parts';

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
    <div className="row" aria-label="System status" style={{ gap: 'var(--space-2)' }}>
      <Badge tone={mcp === null ? 'neutral' : mcp ? 'ok' : 'danger'}>
        {mcp === null ? 'Checking…' : mcp ? 'MCP server connected' : 'MCP server unreachable'}
      </Badge>
      <Badge tone={live ? 'info' : 'neutral'}>
        <span
          aria-hidden="true"
          style={{
            display: 'inline-block',
            width: 6,
            height: 6,
            borderRadius: '50%',
            background: live ? '#00caee' : 'var(--muted)',
            boxShadow: live ? '0 0 8px #00caee' : 'none',
            marginRight: 2,
          }}
        />
        {live ? 'Live' : 'Offline'}
      </Badge>
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
          <svg className="brand-mark" viewBox="0 0 32 32" aria-hidden="true">
            <defs>
              <linearGradient id="shieldGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#3b82f6" />
                <stop offset="100%" stopColor="#1d4ed8" />
              </linearGradient>
            </defs>
            <rect width="32" height="32" rx="10" fill="url(#shieldGrad)" />
            <path
              d="M16 6l8 3.2v6.4c0 5.4-3.6 9.4-8 11.4-4.4-2-8-6-8-11.4V9.2z"
              fill="#ffffff"
            />
            <path
              d="M16 9.5v13.5c3.2-1.6 5.8-4.7 5.8-8.8V11.8z"
              fill="rgba(255, 255, 255, 0.25)"
            />
            <path
              d="M13.5 15.5l2 2 3.5-3.5"
              stroke="#2563eb"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
            />
          </svg>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ lineHeight: 1.15 }}>Second Opinion</span>
            <span
              style={{
                fontSize: '0.68rem',
                fontWeight: 600,
                color: 'var(--muted)',
                letterSpacing: '0.04em',
                textTransform: 'uppercase',
              }}
            >
              Payment Guard for Alexa+
            </span>
          </div>
        </NavLink>

        <nav className="nav" aria-label="Main">
          <NavLink to="/demo">
            <span aria-hidden="true">🎙️</span>
            Live demo
          </NavLink>
          <NavLink to="/family">
            <span aria-hidden="true">🛡️</span>
            Family console
          </NavLink>
        </nav>

        <div className="right">
          <HealthPill />
        </div>
      </header>
      <div id="main">{children}</div>
    </>
  );
}
