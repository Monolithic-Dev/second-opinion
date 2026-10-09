import type { ReactNode } from 'react';
import { STATUS_LABEL } from '../format';
import type { HoldStatus, TraceEntry } from '../types';

export function Badge({ tone, children }: { tone: 'ok' | 'warn' | 'danger' | 'info' | 'neutral'; children: ReactNode }) {
  return <span className={`badge ${tone}`}>{children}</span>;
}

export function StatusBadge({ status }: { status: HoldStatus }) {
  const s = STATUS_LABEL[status];
  return <Badge tone={s.tone}>{s.label}</Badge>;
}

/** n of required approvals, plus any denial. Text first, segments second (segments are decorative). */
export function QuorumMeter({ approve, deny, required }: { approve: number; deny: number; required: number }) {
  const segs = Array.from({ length: required }, (_, i) => (deny > 0 && i === 0 ? 'deny' : i < approve ? 'on' : ''));
  return (
    <div className="row" role="group" aria-label="Approval progress">
      <span className="quorum" aria-hidden="true">
        {segs.map((c, i) => (
          <span key={i} className={`seg ${c}`} />
        ))}
      </span>
      <span className="small">
        {deny > 0 ? 'Declined' : `${approve} of ${required} ${required === 1 ? 'approval' : 'approvals'}`}
      </span>
    </div>
  );
}

export function EmptyState({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="empty">
      <p><strong>{title}</strong></p>
      {children && <p className="small">{children}</p>}
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
          <strong>{t.tool}</strong>
          <span>{t.summary}</span>
          <span>{t.ms} ms</span>
        </div>
      ))}
      {traceId && <div className="muted">trace id {traceId}</div>}
    </div>
  );
}

export function Spinner({ label = 'Loading' }: { label?: string }) {
  return <p className="muted" role="status">{label}…</p>;
}

export function ErrorNote({ message }: { message: string }) {
  return <p className="field-error" role="alert">{message}</p>;
}
