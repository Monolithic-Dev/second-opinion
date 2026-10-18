import type { ReactNode } from 'react';
import { STATUS_LABEL } from '../format';
import type { HoldStatus, TraceEntry } from '../types';

export function Badge({ tone, children }: { tone: 'ok' | 'warn' | 'danger' | 'info' | 'neutral'; children: ReactNode }) {
  return (
    <span className={`badge ${tone}`}>
      <span
        aria-hidden="true"
        style={{
          width: 6,
          height: 6,
          borderRadius: '50%',
          backgroundColor: 'currentColor',
          display: 'inline-block',
          opacity: 0.9,
        }}
      />
      {children}
    </span>
  );
}

export function StatusBadge({ status }: { status: HoldStatus }) {
  const s = STATUS_LABEL[status];
  return <Badge tone={s.tone}>{s.label}</Badge>;
}

/** n of required approvals, plus any denial. Text first, segments second (segments are decorative). */
export function QuorumMeter({ approve, deny, required }: { approve: number; deny: number; required: number }) {
  const segs = Array.from({ length: required }, (_, i) => (deny > 0 && i === 0 ? 'deny' : i < approve ? 'on' : ''));
  return (
    <div className="row" role="group" aria-label="Approval progress" style={{ gap: 'var(--space-2)' }}>
      <span className="quorum" aria-hidden="true">
        {segs.map((c, i) => (
          <span key={i} className={`seg ${c}`} />
        ))}
      </span>
      <span className="small" style={{ fontWeight: 600 }}>
        {deny > 0 ? 'Declined' : `${approve} of ${required} ${required === 1 ? 'approval' : 'approvals'}`}
      </span>
    </div>
  );
}

export function EmptyState({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="empty" style={{ display: 'grid', justifyItems: 'center', gap: 'var(--space-2)' }}>
      <div
        aria-hidden="true"
        style={{
          width: 48,
          height: 48,
          borderRadius: '50%',
          background: 'var(--surface-2)',
          border: '1px solid var(--border)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '1.4rem',
          marginBottom: 'var(--space-1)',
          color: 'var(--muted)',
        }}
      >
        🛡️
      </div>
      <p style={{ margin: 0 }}>
        <strong>{title}</strong>
      </p>
      {children && <p className="small" style={{ margin: 0, maxWidth: 360 }}>{children}</p>}
    </div>
  );
}

/** Every MCP call the agent made for a turn, with timing: proof that the real server did the checking. */
export function TraceView({ trace, traceId }: { trace: TraceEntry[]; traceId?: string }) {
  if (trace.length === 0) return <p className="muted small">No tool calls yet.</p>;
  return (
    <div className="trace" role="list" aria-label="MCP tool calls">
      {trace.map((t, i) => (
        <div key={i} role="listitem" className={`t ${t.ok ? '' : 'bad'}`}>
          <div className="row" style={{ gap: 'var(--space-2)' }}>
            <span
              style={{
                width: 7,
                height: 7,
                borderRadius: '50%',
                background: t.ok ? 'var(--ok)' : 'var(--danger)',
                display: 'inline-block',
              }}
            />
            <strong style={{ letterSpacing: '-0.01em' }}>{t.tool}</strong>
          </div>
          <span style={{ color: 'var(--text-secondary)' }}>{t.summary}</span>
          <span
            className="small mono"
            style={{
              background: 'var(--surface)',
              padding: '2px 8px',
              borderRadius: 'var(--radius-xs)',
              border: '1px solid var(--border)',
              fontWeight: 600,
            }}
          >
            {t.ms} ms
          </span>
        </div>
      ))}
      {traceId && (
        <div className="muted small mono" style={{ marginTop: 'var(--space-1)', display: 'flex', justifyContent: 'flex-end' }}>
          trace id {traceId}
        </div>
      )}
    </div>
  );
}

export function Spinner({ label = 'Loading' }: { label?: string }) {
  return (
    <div className="row" role="status" style={{ justifyContent: 'center', padding: 'var(--space-4)', gap: 'var(--space-2)' }}>
      <svg
        aria-hidden="true"
        style={{ width: 20, height: 20, animation: 'spin 0.8s linear infinite' }}
        viewBox="0 0 24 24"
        fill="none"
      >
        <circle cx="12" cy="12" r="10" stroke="var(--border-strong)" strokeWidth="3" />
        <path d="M12 2a10 10 0 0 1 10 10" stroke="var(--brand)" strokeWidth="3" strokeLinecap="round" />
      </svg>
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
      <span className="muted small" style={{ fontWeight: 500 }}>{label}…</span>
    </div>
  );
}

export function ErrorNote({ message }: { message: string }) {
  return (
    <p
      className="field-error"
      role="alert"
      style={{
        margin: 0,
        background: 'var(--danger-bg)',
        border: '1px solid var(--danger-border)',
        borderRadius: 'var(--radius-sm)',
        padding: '10px 14px',
      }}
    >
      {message}
    </p>
  );
}
