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
    return () => { alive = false; clearInterval(t); };
  }, []);
  return (
    <div className="row" aria-label="System status">
      <Badge tone={mcp === null ? 'neutral' : mcp ? 'ok' : 'danger'}>{mcp === null ? 'Checking…' : mcp ? 'MCP server connected' : 'MCP server unreachable'}</Badge>
      <Badge tone={live ? 'info' : 'neutral'}>{live ? 'Live' : 'Offline'}</Badge>
    </div>
  );
}

export function Layout({ children }: { children: ReactNode }) {
  return (
    <>
      <a href="#main" className="sr-only">Skip to content</a>
      <header className="app-header">
        <NavLink to="/demo" className="brand" aria-label="Second Opinion home">
          <svg className="brand-mark" viewBox="0 0 32 32" aria-hidden="true"><rect width="32" height="32" rx="8" fill="var(--brand)" /><path d="M16 6l8 3v6c0 5-3.4 8.6-8 11-4.6-2.4-8-6-8-11V9z" fill="var(--brand-ink)" /></svg>
          Second Opinion
        </NavLink>
        <nav className="nav" aria-label="Main">
          <NavLink to="/demo">Live demo</NavLink>
        </nav>
        <div className="right"><HealthPill /></div>
      </header>
      <div id="main">{children}</div>
    </>
  );
}
