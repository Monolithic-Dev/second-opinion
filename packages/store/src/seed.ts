import type { Clock } from '@second-opinion/shared';
import { evaluate } from '@second-opinion/engine';
import type { Db } from './db';
import { migrate } from './db';
import { createRepos, type Repos } from './repos';

export const DEMO_HOUSEHOLD = 'hh_demo';
export const DEMO_ELDER = 'p_dorothy';
export const DEMO_APPROVER = 'p_priya';
export const DEMO_SECOND_APPROVER = 'p_arjun';
export const HERO_TEXT = 'The bank says I have to buy five $200 gift cards today or my account is frozen.';

/**
 * Seed the fictional demo household (idempotent). Includes a denied gift-card hold from three days ago so a
 * repeat request is recognised ("same as <weekday>"). All data is synthetic.
 */
export function seedDemo(db: Db, clock: Clock): Repos {
  const repos = createRepos(db, clock);
  db.transaction(() => {
    repos.households.insert({ id: DEMO_HOUSEHOLD, name: "Dorothy's household" });
    repos.people.insert({ id: DEMO_ELDER, household_id: DEMO_HOUSEHOLD, name: 'Dorothy', role: 'elder', can_approve: 0, contact_label: 'Echo (kitchen)' });
    repos.people.insert({ id: DEMO_APPROVER, household_id: DEMO_HOUSEHOLD, name: 'Priya', role: 'family', can_approve: 1, contact_label: "Priya's phone", approver_rank: 1 });
    repos.people.insert({ id: DEMO_SECOND_APPROVER, household_id: DEMO_HOUSEHOLD, name: 'Arjun', role: 'family', can_approve: 1, contact_label: "Arjun's phone", approver_rank: 2 });
    repos.payees.add(DEMO_HOUSEHOLD, 'Greenleaf Pharmacy', 'pharmacy', 'pay_seed1');
    repos.payees.add(DEMO_HOUSEHOLD, 'City Power & Light', 'utility', 'pay_seed2');

    // A month of ordinary payments so the behavior layer has a baseline (amount anomaly, payee velocity).
    const ordinary: Array<[string, number, string, number]> = [
      ['chk_seedp1', 2400, 'greenleaf pharmacy', 26], ['chk_seedp2', 8640, 'city power & light', 22],
      ['chk_seedp3', 3100, 'greenleaf pharmacy', 18], ['chk_seedp4', 2800, 'greenleaf pharmacy', 12],
      ['chk_seedp5', 2500, 'greenleaf pharmacy', 8], ['chk_seedp6', 3000, 'greenleaf pharmacy', 4],
    ];
    for (const [id, cents, payee, daysAgo] of ordinary) {
      if (repos.checks.get(id)) continue;
      const at = new Date(clock().getTime() - daysAgo * 24 * 60 * 60 * 1000).toISOString();
      repos.checks.insert(
        { householdId: DEMO_HOUSEHOLD, text: `Pay ${payee} $${(cents / 100).toFixed(2)}`, channel: 'voice', actionType: 'payment', amountCents: cents, payee,
          signals: [{ id: 'TRUSTED_PAYEE', weight: -40, evidence: payee }], score: 0, verdict: 'allow', fingerprint: 'NONE', createdAt: at },
        id,
      );
    }

    if (!repos.checks.get('chk_seed1')) {
      const past = new Date(clock().getTime() - 3 * 24 * 60 * 60 * 1000).toISOString();
      const ctx = { actionType: 'purchase' as const, payee: 'gift cards' };
      const r = evaluate(HERO_TEXT, ctx);
      repos.checks.insert(
        { householdId: DEMO_HOUSEHOLD, text: HERO_TEXT, channel: 'voice', actionType: 'purchase', amountCents: 100000, payee: 'gift cards',
          signals: r.signals, score: r.score, verdict: r.verdict, fingerprint: r.fingerprint, createdAt: past },
        'chk_seed1',
      );
      repos.fingerprints.upsert(DEMO_HOUSEHOLD, r.fingerprint, 'chk_seed1', past);
      db.prepare(
        `INSERT OR IGNORE INTO holds (id, household_id, check_id, action_type, amount_cents, payee, description, status, approver_id, created_at, expires_at, resolved_at, resolved_by, note)
         VALUES ('hold_seed1', ?, 'chk_seed1', 'purchase', 100000, 'gift cards', '5 x $200 gift cards', 'denied', ?, ?, ?, ?, ?, 'Not a real bank call')`,
      ).run(DEMO_HOUSEHOLD, DEMO_APPROVER, past, past, past, DEMO_APPROVER);
    }
  })();
  return repos;
}

/**
 * Drop every table (and with it every trigger and index), re-run the migrations and re-seed the demo household.
 * For demos and tests only: it destroys the audit log. Never expose it in production.
 */
export function resetDb(db: Db, clock: Clock): Repos {
  db.pragma('foreign_keys = OFF');
  try {
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'").all() as Array<{ name: string }>;
    db.transaction(() => {
      for (const t of tables) db.exec(`DROP TABLE IF EXISTS "${t.name.replace(/"/g, '""')}"`);
    })();
  } finally {
    db.pragma('foreign_keys = ON');
  }
  migrate(db);
  return seedDemo(db, clock);
}
