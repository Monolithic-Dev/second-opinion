import { ACTION_TYPES, CHANNELS, HOLD_STATUSES, MAX_AMOUNT_CENTS, SIGNAL_IDS, ToolError, VERDICTS } from '@second-opinion/shared';
import type { PersonRow } from '@second-opinion/store';
import { z } from 'zod';
import type { Deps } from '../deps';
import { idSchema } from './define';

export const signalSchema = z.object({ id: z.enum(SIGNAL_IDS), weight: z.number(), evidence: z.string() });
export const cardSchema = z.object({
  title: z.string(),
  level: z.enum(VERDICTS),
  flags: z.array(z.string()),
  advice: z.string(),
});
export const similarSchema = z.object({ checkId: z.string(), date: z.string(), holdId: z.string().optional() });
export const holdStatusSchema = z.enum(HOLD_STATUSES);
export const actionTypeSchema = z.enum(ACTION_TYPES);
export const channelSchema = z.enum(CHANNELS);
export const amountSchema = z.number().int().min(0).max(MAX_AMOUNT_CENTS);
export const householdIdSchema = idSchema.describe('Household id, e.g. hh_demo');

export function requireHousehold(deps: Deps, householdId: string): void {
  if (!deps.repos.households.get(householdId)) throw new ToolError('NOT_FOUND', `household ${householdId} not found`);
}

/** Only a family member with can_approve=1 in this household. The elder can never approve. */
export function requireApprover(deps: Deps, householdId: string, personId: string): PersonRow {
  const person = deps.repos.people.get(personId);
  if (!person || person.household_id !== householdId) throw new ToolError('FORBIDDEN', 'not a member of this household');
  if (person.role !== 'family' || person.can_approve !== 1) throw new ToolError('FORBIDDEN', 'only an approver can do this');
  return person;
}
