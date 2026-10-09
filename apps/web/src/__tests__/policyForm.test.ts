import { describe, expect, it } from 'vitest';
import { buildPatch, DEFAULT_POLICY, toForm, validateForm } from '../lib/policyForm';

describe('policy form', () => {
  it('round-trips the default policy through dollars and back with no change', () => {
    const form = toForm(DEFAULT_POLICY);
    expect(form.maxSingle).toBe('500');
    expect(form.requireApprovalAbove).toBe('200');
    expect(form.dailyCap).toBe('1500');
    expect(buildPatch(form, DEFAULT_POLICY)).toEqual({});
    expect(validateForm(form, 2)).toEqual({});
  });

  it('builds a patch with only the changed fields, in cents', () => {
    const form = { ...toForm(DEFAULT_POLICY), maxSingle: '600.50', quorum: '2' as const, quietHoursStart: '23:00' };
    expect(buildPatch(form, DEFAULT_POLICY)).toEqual({ maxSingleCents: 60_050, quorum: 2, quietHoursStart: '23:00' });
  });

  it('catches the same mistakes the server does, with plain messages', () => {
    const f = toForm(DEFAULT_POLICY);
    expect(validateForm({ ...f, maxSingle: '5' }, 2).maxSingle).toMatch(/between 10 and 50,000/);
    expect(validateForm({ ...f, maxSingle: 'abc' }, 2).maxSingle).toBeTruthy();
    expect(validateForm({ ...f, maxSingle: '12.345' }, 2).maxSingle).toBeTruthy();
    expect(validateForm({ ...f, dailyCap: '100', maxSingle: '500' }, 2).dailyCap).toMatch(/at least the single-payment limit/);
    expect(validateForm({ ...f, escalateAfterMin: '10', holdTtlMin: '10' }, 2).escalateAfterMin).toMatch(/before the request expires/);
    expect(validateForm({ ...f, quietHoursStart: '25:00' }, 2).quietHoursStart).toBeTruthy();
    expect(validateForm({ ...f, quietHoursEnd: '6am' }, 2).quietHoursEnd).toBeTruthy();
    expect(validateForm({ ...f, timezone: 'Mars/Base' }, 2).timezone).toBeTruthy();
    expect(validateForm({ ...f, newPayeeCooloffMin: '-5' }, 2).newPayeeCooloffMin).toBeTruthy();
  });

  it('refuses two approvals when the household has only one approver', () => {
    const f = { ...toForm(DEFAULT_POLICY), quorum: '2' as const };
    expect(validateForm(f, 1).quorum).toMatch(/at least two approvers/);
    expect(validateForm(f, 2).quorum).toBeUndefined();
  });

  it('does not report a cross-field error when a single field is already wrong', () => {
    const e = validateForm({ ...toForm(DEFAULT_POLICY), maxSingle: 'x', dailyCap: '100' }, 2);
    expect(e.maxSingle).toBeTruthy();
    expect(e.dailyCap).toBeUndefined();
  });
});
