import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { NavLink } from 'react-router-dom';
import { api } from '../api';
import { useAppState } from '../hooks/useAppState';
import { IconActivity, IconMoon, IconServer } from './icons';

/* ---------------------------------------------------------------
   Theme management — toggles [data-theme] on <html>
   ---------------------------------------------------------------- */
type Theme = 'dark' | 'light';

function getInitialTheme(): Theme {
  try {
    const stored = localStorage.getItem('so-theme') as Theme | null;
    if (stored === 'dark' || stored === 'light') return stored;
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  } catch {
    return 'dark';
  }
}

function applyTheme(t: Theme) {
  document.documentElement.setAttribute('data-theme', t);
  try { localStorage.setItem('so-theme', t); } catch { /* ignore */ }
}

function useTheme(): [Theme, () => void] {
  const [theme, setTheme] = useState<Theme>(getInitialTheme);

  useEffect(() => { applyTheme(theme); }, [theme]);

  const toggle = useCallback(() => {
    setTheme((t) => (t === 'dark' ? 'light' : 'dark'));
  }, []);

  return [theme, toggle];
}

/* ---------------------------------------------------------------
   MCP / Live health pill
   ---------------------------------------------------------------- */
function StatusDot({ ok }: { ok: boolean | null }) {
  const c = ok === null ? 'var(--muted)' : ok ? 'var(--ok)' : 'var(--danger)';
  return (
    <span
      aria-hidden="true"
      style={{
        display: 'inline-block',
        width: 6,
        height: 6,
        borderRadius: '50%',
        background: c,
        boxShadow: ok ? `0 0 6px ${c}` : 'none',
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
    const probe = () =>
      api.health().then((h) => alive && setMcp(h.mcp)).catch(() => alive && setMcp(false));
    void probe();
    const t = setInterval(probe, 8000);
    return () => { alive = false; clearInterval(t); };
  }, []);

  const pillStyle = (active: boolean | null, type: 'mcp' | 'live') => ({
    display: 'flex',
    alignItems: 'center',
    gap: 5,
    padding: '4px 10px',
    borderRadius: 'var(--radius-full)',
    background: 'var(--surface-2)',
    border: '1px solid var(--border)',
    fontSize: '0.72rem',
    fontWeight: 700,
    color: active
      ? type === 'mcp' ? 'var(--ok)' : 'var(--info)'
      : active === false ? 'var(--danger)' : 'var(--muted)',
    transition: 'all var(--transition-fast)',
    whiteSpace: 'nowrap' as const,
  });

  return (
    <div className="row" aria-label="System status" style={{ gap: 6 }}>
      <span style={pillStyle(mcp, 'mcp')}>
        <IconServer size={11} aria-hidden="true" />
        <StatusDot ok={mcp} />
        {mcp === null ? 'Checking…' : mcp ? 'MCP server connected' : 'MCP server unreachable'}
      </span>
      <span style={pillStyle(live ? true : null, 'live')}>
        <IconActivity size={11} aria-hidden="true" />
        <StatusDot ok={live ? true : null} />
        {live ? 'Live' : 'Offline'}
      </span>
    </div>
  );
}


/* ---------------------------------------------------------------
   SVG Logo — Premium shield + checkmark
   ---------------------------------------------------------------- */
function Logo({ size = 36 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 40 40"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      className="brand-logo"
    >
      <defs>
        <linearGradient id="logo-grad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#6b8eff" />
          <stop offset="100%" stopColor="#4361ee" />
        </linearGradient>
        <linearGradient id="logo-shine" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="rgba(255,255,255,0.25)" />
          <stop offset="100%" stopColor="rgba(255,255,255,0)" />
        </linearGradient>
        <filter id="logo-glow">
          <feGaussianBlur stdDeviation="1.5" result="blur" />
          <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
      </defs>
      {/* Background rounded rect */}
      <rect width="40" height="40" rx="10" fill="url(#logo-grad)" />
      {/* Shine overlay */}
      <rect width="40" height="40" rx="10" fill="url(#logo-shine)" />
      {/* Shield */}
      <path
        d="M20 8L10.5 12v7.5c0 5.8 4.1 10.2 9.5 12.5 5.4-2.3 9.5-6.7 9.5-12.5V12L20 8z"
        fill="white"
        opacity="0.95"
        filter="url(#logo-glow)"
      />
      {/* Checkmark */}
      <path
        d="M16 20.5l2.7 2.7 5.8-6"
        stroke="#4361ee"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/* ---------------------------------------------------------------
   Sun icon (for light mode button)
   ---------------------------------------------------------------- */
function SunIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="5" />
      <line x1="12" y1="1" x2="12" y2="3" />
      <line x1="12" y1="21" x2="12" y2="23" />
      <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
      <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
      <line x1="1" y1="12" x2="3" y2="12" />
      <line x1="21" y1="12" x2="23" y2="12" />
      <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
      <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
    </svg>
  );
}

/* ---------------------------------------------------------------
   Layout Shell
   ---------------------------------------------------------------- */
export function Layout({ children }: { children: ReactNode }) {
  const [theme, toggleTheme] = useTheme();

  return (
    <>
      <a href="#main" className="sr-only">Skip to content</a>

      <header className="app-header">
        {/* Logo + Brand */}
        <NavLink to="/" className="brand" aria-label="Second Opinion — home">
          <Logo size={36} />
          <div className="brand-text">
            <span className="brand-name">Second Opinion</span>
            <span className="brand-sub">Payment Guard · Alexa+</span>
          </div>
        </NavLink>

        {/* Top navigation */}
        <nav className="nav" aria-label="Main navigation">
          <NavLink to="/" end>Overview</NavLink>
          <NavLink to="/demo">Live demo</NavLink>
          <NavLink to="/family">Family console</NavLink>
        </nav>


        {/* Right-side actions */}
        <div className="header-actions">
          <HealthPill />

          <button
            type="button"
            className="theme-toggle"
            onClick={toggleTheme}
            aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            title={theme === 'dark' ? 'Light mode' : 'Dark mode'}
          >
            {theme === 'dark' ? <SunIcon size={15} /> : <IconMoon size={15} />}
          </button>
        </div>
      </header>

      <div id="main">{children}</div>
    </>
  );
}
