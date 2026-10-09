import {
  newId,
  ToolError,
  type ActionType,
  type Channel,
  type Clock,
  type HistoryItem,
  type HoldStatus,
  type PayeeKind,
  type Signal,
  type Verdict,
} from '@second-opinion/shared';
import { normalize } from '@second-opinion/engine';
import type { Db } from './db';

export interface HouseholdRow { id: string; name: string; created_at: string }
export interface PersonRow {
  id: string; household_id: string; name: string; role: 'elder' | 'family'; can_approve: 0 | 1; contact_label: string | null;
}
export interface PayeeRow { id: string; household_id: string; name: string; kind: PayeeKind; created_at: string }
export interface CheckRow {
  id: string; household_id: string; text: string; channel: Channel; action_type: ActionType; amount_cents: number | null;
  payee: string | null; signals_json: string; score: number; verdict: Verdict; fingerprint: string; created_at: string;
}
export interface HoldRow {
  id: string; household_id: string; check_id: string; action_type: ActionType; amount_cents: number | null; payee: string | null;
  description: string; status: HoldStatus; approver_id: string | null; created_at: string; expires_at: string;
  resolved_at: string | null; resolved_by: string | null; note: string | null;
}
export interface AuditRow { id: string; household_id: string | null; type: string; payload_json: string; created_at: string }
export interface DecisionRow {
  id: string; household_id: string; check_id: string; trace_id: string; rule_set_version: string; verdict: Verdict; score: number;
  reasons_json: string; features_json: string; latency_ms: number; created_at: string;
}
export interface NewDecision {
  householdId: string; checkId: string; traceId: string; ruleSetVersion: string; verdict: Verdict; score: number;
  reasons: unknown; features: unknown; latencyMs: number;
}
export interface IdempotencyRow {
  tool: string; key: string; household_id: string | null; request_hash: string; response_json: string; created_at: string;
}

export interface NewCheck {
  householdId: string; text: string; channel: Channel; actionType: ActionType; amountCents?: number | undefined;
  payee?: string | undefined; signals: Signal[]; score: number; verdict: Verdict; fingerprint: string; createdAt?: string;
}
export interface NewHold {
  householdId: string; checkId: string; actionType: ActionType; amountCents?: number | undefined; payee?: string | undefined;
  description: string; ttlMs: number; id?: string;
}

export const DEFAULT_HOLD_TTL_MS = 10 * 60 * 1000;

export function normalizePayee(name: string): string {
  return normalize(name);
}

/** All data access. Pure SQL; authorization and business rules live in the tool layer. */
export function createRepos(db: Db, clock: Clock) {
  const now = () => clock().toISOString();

  const audit = {
    write(type: string, householdId: string | null, payload: unknown): void {
      db.prepare('INSERT INTO audit_events (id, household_id, type, payload_json, created_at) VALUES (?,?,?,?,?)').run(
        newId('evt'), householdId, type, JSON.stringify(payload ?? {}), now(),
      );
    },
    list(householdId: string, limit = 100): AuditRow[] {
      return db
        .prepare('SELECT * FROM audit_events WHERE household_id = ? ORDER BY created_at DESC, rowid DESC LIMIT ?')
        .all(householdId, limit) as AuditRow[];
    },
  };

  const households = {
    get: (id: string) => db.prepare('SELECT * FROM households WHERE id = ?').get(id) as HouseholdRow | undefined,
    insert(h: { id: string; name: string }): void {
      db.prepare('INSERT OR IGNORE INTO households (id, name, created_at) VALUES (?,?,?)').run(h.id, h.name, now());
    },
  };

  const people = {
    get: (id: string) => db.prepare('SELECT * FROM people WHERE id = ?').get(id) as PersonRow | undefined,
    list: (householdId: string) =>
      db.prepare('SELECT * FROM people WHERE household_id = ? ORDER BY name').all(householdId) as PersonRow[],
    approvers: (householdId: string) =>
      db.prepare("SELECT * FROM people WHERE household_id = ? AND role = 'family' AND can_approve = 1 ORDER BY name").all(householdId) as PersonRow[],
    insert(p: Omit<PersonRow, 'contact_label'> & { contact_label?: string | null }): void {
      db.prepare('INSERT OR IGNORE INTO people (id, household_id, name, role, can_approve, contact_label) VALUES (?,?,?,?,?,?)').run(
        p.id, p.household_id, p.name, p.role, p.can_approve, p.contact_label ?? null,
      );
    },
  };

  const payees = {
    list: (householdId: string) =>
      db.prepare('SELECT * FROM trusted_payees WHERE household_id = ? ORDER BY name').all(householdId) as PayeeRow[],
    /** Idempotent: adding an existing payee returns the existing row. */
    add(householdId: string, name: string, kind: PayeeKind, id: string = newId('pay')): PayeeRow {
      const key = normalizePayee(name);
      db.prepare('INSERT OR IGNORE INTO trusted_payees (id, household_id, name, kind, created_at) VALUES (?,?,?,?,?)').run(
        id, householdId, key, kind, now(),
      );
      return db.prepare('SELECT * FROM trusted_payees WHERE household_id = ? AND name = ?').get(householdId, key) as PayeeRow;
    },
    remove(householdId: string, name: string): boolean {
      return db.prepare('DELETE FROM trusted_payees WHERE household_id = ? AND name = ?').run(householdId, normalizePayee(name)).changes > 0;
    },
  };

  const checks = {
    insert(c: NewCheck, id: string = newId('chk')): CheckRow {
      db.prepare(
        `INSERT INTO checks (id, household_id, text, channel, action_type, amount_cents, payee, signals_json, score, verdict, fingerprint, created_at)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
      ).run(
        id, c.householdId, c.text, c.channel, c.actionType, c.amountCents ?? null, c.payee ?? null,
        JSON.stringify(c.signals), c.score, c.verdict, c.fingerprint, c.createdAt ?? now(),
      );
      return db.prepare('SELECT * FROM checks WHERE id = ?').get(id) as CheckRow;
    },
    get: (id: string) => db.prepare('SELECT * FROM checks WHERE id = ?').get(id) as CheckRow | undefined,
    recent: (householdId: string, limit = 20) =>
      db.prepare('SELECT * FROM checks WHERE household_id = ? ORDER BY created_at DESC, rowid DESC LIMIT ?').all(householdId, limit) as CheckRow[],
    /** Engine history: fingerprint per check plus its latest hold id. */
    history(householdId: string, limit = 200): HistoryItem[] {
      const rows = db
        .prepare(
          `SELECT c.id AS checkId, c.fingerprint AS fingerprint, c.created_at AS createdAt,
                  (SELECT h.id FROM holds h WHERE h.check_id = c.id ORDER BY h.created_at DESC, h.rowid DESC LIMIT 1) AS holdId
           FROM checks c WHERE c.household_id = ? ORDER BY c.created_at DESC, c.rowid DESC LIMIT ?`,
        )
        .all(householdId, limit) as Array<{ checkId: string; fingerprint: string; createdAt: string; holdId: string | null }>;
      return rows.map((r) => (r.holdId ? { checkId: r.checkId, fingerprint: r.fingerprint, createdAt: r.createdAt, holdId: r.holdId } : { checkId: r.checkId, fingerprint: r.fingerprint, createdAt: r.createdAt }));
    },
  };

  const fingerprints = {
    upsert(householdId: string, fingerprint: string, checkId: string, at: string = now()): void {
      db.prepare(
        `INSERT INTO fingerprints (household_id, fingerprint, first_seen, last_seen, seen_count, last_check_id)
         VALUES (?,?,?,?,1,?)
         ON CONFLICT (household_id, fingerprint) DO UPDATE SET last_seen = excluded.last_seen,
           seen_count = seen_count + 1, last_check_id = excluded.last_check_id`,
      ).run(householdId, fingerprint, at, at, checkId);
    },
    get: (householdId: string, fingerprint: string) =>
      db.prepare('SELECT * FROM fingerprints WHERE household_id = ? AND fingerprint = ?').get(householdId, fingerprint) as
        | { seen_count: number; first_seen: string; last_seen: string }
        | undefined,
  };

  const decisions = {
    /** Append-only (DB triggers forbid UPDATE/DELETE). One row per risk check, pinned to the rule-set version. */
    insert(d: NewDecision, id: string = newId('dec')): DecisionRow {
      db.prepare(
        `INSERT INTO decisions (id, household_id, check_id, trace_id, rule_set_version, verdict, score, reasons_json, features_json, latency_ms, created_at)
         VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
      ).run(
        id, d.householdId, d.checkId, d.traceId, d.ruleSetVersion, d.verdict, d.score,
        JSON.stringify(d.reasons), JSON.stringify(d.features), d.latencyMs, now(),
      );
      return db.prepare('SELECT * FROM decisions WHERE id = ?').get(id) as DecisionRow;
    },
    getByCheck: (checkId: string) => db.prepare('SELECT * FROM decisions WHERE check_id = ?').get(checkId) as DecisionRow | undefined,
    list: (householdId: string, limit = 100) =>
      db.prepare('SELECT * FROM decisions WHERE household_id = ? ORDER BY created_at DESC, rowid DESC LIMIT ?').all(householdId, limit) as DecisionRow[],
  };

  const idempotency = {
    get: (tool: string, key: string) =>
      db.prepare('SELECT * FROM idempotency_keys WHERE tool = ? AND key = ?').get(tool, key) as IdempotencyRow | undefined,
    put(row: { tool: string; key: string; householdId: string | null; requestHash: string; response: unknown }): void {
      db.prepare('INSERT INTO idempotency_keys (tool, key, household_id, request_hash, response_json, created_at) VALUES (?,?,?,?,?,?)').run(
        row.tool, row.key, row.householdId, row.requestHash, JSON.stringify(row.response), now(),
      );
    },
  };

  const holds = {
    /** Pending holds past `expires_at` become `expired` (they stay blocked; never auto-released). */
    expireStale(householdId?: string): string[] {
      const t = now();
      const rows = (householdId
        ? db.prepare("SELECT id, household_id FROM holds WHERE status = 'pending' AND expires_at < ? AND household_id = ?").all(t, householdId)
        : db.prepare("SELECT id, household_id FROM holds WHERE status = 'pending' AND expires_at < ?").all(t)) as Array<{ id: string; household_id: string }>;
      for (const r of rows) {
        db.prepare("UPDATE holds SET status = 'expired', resolved_at = ? WHERE id = ? AND status = 'pending'").run(t, r.id);
        audit.write('hold.expired', r.household_id, { holdId: r.id });
      }
      return rows.map((r) => r.id);
    },
    create(h: NewHold): HoldRow {
      const id = h.id ?? newId('hold');
      const created = clock();
      db.prepare(
        `INSERT INTO holds (id, household_id, check_id, action_type, amount_cents, payee, description, status, created_at, expires_at)
         VALUES (?,?,?,?,?,?,?, 'pending', ?, ?)`,
      ).run(
        id, h.householdId, h.checkId, h.actionType, h.amountCents ?? null, h.payee ?? null, h.description,
        created.toISOString(), new Date(created.getTime() + h.ttlMs).toISOString(),
      );
      return db.prepare('SELECT * FROM holds WHERE id = ?').get(id) as HoldRow;
    },
    get(id: string): HoldRow | undefined {
      const row = db.prepare('SELECT * FROM holds WHERE id = ?').get(id) as HoldRow | undefined;
      if (row?.status === 'pending') {
        holds.expireStale(row.household_id);
        return db.prepare('SELECT * FROM holds WHERE id = ?').get(id) as HoldRow;
      }
      return row;
    },
    byCheck: (checkId: string) =>
      db.prepare('SELECT * FROM holds WHERE check_id = ? ORDER BY created_at DESC, rowid DESC').all(checkId) as HoldRow[],
    listByStatus(householdId: string, status?: HoldStatus): HoldRow[] {
      holds.expireStale(householdId);
      return (status
        ? db.prepare('SELECT * FROM holds WHERE household_id = ? AND status = ? ORDER BY created_at DESC, rowid DESC').all(householdId, status)
        : db.prepare('SELECT * FROM holds WHERE household_id = ? ORDER BY created_at DESC, rowid DESC').all(householdId)) as HoldRow[];
    },
    setApprover(id: string, approverId: string): void {
      db.prepare('UPDATE holds SET approver_id = ? WHERE id = ?').run(approverId, id);
    },
    /**
     * Atomically move a pending hold to a final state. Throws CONFLICT if it is no longer pending.
     * approve -> `released` (approved + released in one step), deny -> `denied`.
     */
    resolve(id: string, decision: 'approve' | 'deny', resolvedBy: string, note?: string): HoldRow {
      return db.transaction(() => {
        const current = holds.get(id);
        if (!current) throw new ToolError('NOT_FOUND', `hold ${id} not found`);
        if (current.status !== 'pending') throw new ToolError('CONFLICT', `hold ${id} is already ${current.status}`);
        const status: HoldStatus = decision === 'approve' ? 'released' : 'denied';
        const res = db
          .prepare("UPDATE holds SET status = ?, resolved_at = ?, resolved_by = ?, note = ? WHERE id = ? AND status = 'pending'")
          .run(status, now(), resolvedBy, note ?? null, id);
        if (res.changes !== 1) throw new ToolError('CONFLICT', `hold ${id} was changed concurrently`);
        audit.write('hold.resolved', current.household_id, { holdId: id, decision, status, resolvedBy });
        return db.prepare('SELECT * FROM holds WHERE id = ?').get(id) as HoldRow;
      })();
    },
  };

  return {
    audit, households, people, payees, checks, fingerprints, decisions, idempotency, holds,
    transaction: <T>(fn: () => T): T => db.transaction(fn)(),
    now,
  };
}

export type Repos = ReturnType<typeof createRepos>;
