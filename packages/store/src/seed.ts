import type { Clock } from '@second-opinion/shared';
import { evaluate } from '@second-opinion/engine';
import type { Db } from './db';
import { createRepos, type Repos } from './repos';

export const DEMO_HOUSEHOLD = 'hh_demo';
export const DEMO_ELDER = 'p_dorothy';
export const DEMO_APPROVER = 'p_priya';
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
    repos.people.insert({ id: DEMO_APPROVER, household_id: DEMO_HOUSEHOLD, name: 'Priya', role: 'family', can_approve: 1, contact_label: "Priya's phone" });
    repos.payees.add(DEMO_HOUSEHOLD, 'Greenleaf Pharmacy', 'pharmacy', 'pay_seed1');
    repos.payees.add(DEMO_HOUSEHOLD, 'City Power & Light', 'utility', 'pay_seed2');

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
