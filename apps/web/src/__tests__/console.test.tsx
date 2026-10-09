import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from '../App';
import type { HoldDetail, Insights, Payee } from '../types';
import { FakeEventSource, makeHold, makeState, mockFetch } from './helpers';

const INSIGHTS: Insights = {
  days: 30, protectedCents: 200_000,
  checksByDay: [{ date: '2026-10-08', allow: 3, caution: 1, hold: 2 }, { date: '2026-10-09', allow: 1, caution: 0, hold: 1 }],
  holdsByStatus: { pending: 1, approved: 0, released: 2, denied: 3, expired: 1 },
  topSignals: [{ id: 'GIFT_CARD', count: 5 }, { id: 'URGENCY', count: 3 }],
  medianResponseSec: 95,
};

const DETAIL: HoldDetail = {
  hold: {
    holdId: 'hold_aaa', householdId: 'hh_demo', status: 'pending', description: 'Purchase of $1,000 to gift cards', amountCents: 100_000, payee: 'gift cards',
    actionType: 'purchase', quorumRequired: 2, escalationLevel: 1, createdAt: '2026-10-09T12:00:00.000Z', expiresAt: new Date(Date.now() + 5 * 60_000).toISOString(),
    resolvedAt: null, resolvedBy: null, note: null,
  },
  risk: { verdict: 'hold', score: 100, flags: ['Asks for gift cards', 'Pressure to act right now'], reasonText: ['The request looks like a scam'], text: 'The bank says I have to buy gift cards today' },
  votes: [{ approverId: 'p_priya', name: 'Priya', decision: 'approve', note: 'looks fine', decidedAt: '2026-10-09T12:01:00.000Z' }],
  timeline: [
    { type: 'hold.created', label: 'Request paused', at: '2026-10-09T12:00:00.000Z', by: null },
    { type: 'approval.vote', label: 'Vote recorded (approve)', at: '2026-10-09T12:01:00.000Z', by: 'Priya' },
  ],
};

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>,
  );
}

const common = (extra: Parameters<typeof mockFetch>[0] = {}) => ({
  'GET /api/auth/me': () => ({ json: { personId: 'p_priya' } }),
  'GET /healthz': () => ({ json: { ok: true, mcp: true } }),
  'GET /api/family/insights': () => ({ json: INSIGHTS }),
  ...extra,
});

beforeEach(() => {
  FakeEventSource.reset();
  vi.stubGlobal('EventSource', FakeEventSource);
});

describe('Family console', () => {
  it('T-CON-1 the front door asks for sign-in; the console never shows data to a signed-out visitor', async () => {
    mockFetch(common({ 'GET /api/auth/me': () => ({ json: { personId: null } }), 'GET /api/state': () => ({ json: makeState({ holds: [makeHold()] }) }) }));
    renderAt('/family');
    expect(await screen.findByRole('form', { name: 'Family sign-in' })).toBeInTheDocument();
    expect(screen.queryByText('Purchase of $1,000 to gift cards')).toBeNull();
    expect(screen.queryByRole('navigation', { name: 'Family console' })).toBeNull();
  });

  it('T-CON-2 the overview leads with what needs a decision, then shows protection, trend and red flags', async () => {
    mockFetch(common({ 'GET /api/state': () => ({ json: makeState({ holds: [makeHold(), makeHold({ holdId: 'hold_bbb', status: 'denied', description: 'Transfer of $500' })] }) }) }));
    renderAt('/family');
    expect(await screen.findByText('1 request needs your decision')).toBeInTheDocument();
    expect(await screen.findByText('$2,000')).toBeInTheDocument();
    const tiles = screen.getByRole('region', { name: 'Last 30 days' });
    expect(within(tiles).getByText('Waiting for a decision')).toBeInTheDocument();
    expect(within(tiles).getByText('8')).toBeInTheDocument();
    expect(within(tiles).getByText('1.6 min'.replace('1.6', '2'))).toBeInTheDocument();
    expect(screen.getByRole('img', { name: /8 in total, 3 held as likely scams/ })).toBeInTheDocument();
    expect(screen.getByText('Gift cards')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Transfer of $500' })).toHaveAttribute('href', '/family/holds/hold_bbb');
  });

  it('shows a calm all-clear when nothing is waiting', async () => {
    mockFetch(common({ 'GET /api/state': () => ({ json: makeState() }) }));
    renderAt('/family');
    expect(await screen.findByText(/Dorothy is protected/)).toBeInTheDocument();
  });

  it('T-CON-3 the request list filters by status', async () => {
    mockFetch(common({ 'GET /api/state': () => ({ json: makeState({ holds: [makeHold(), makeHold({ holdId: 'hold_bbb', status: 'denied', description: 'Transfer of $500' })] }) }) }));
    const user = userEvent.setup();
    renderAt('/family/holds');
    expect(await screen.findByRole('link', { name: 'Transfer of $500' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Waiting \(1\)/ }));
    expect(screen.queryByRole('link', { name: 'Transfer of $500' })).toBeNull();
    expect(screen.getByRole('link', { name: 'Purchase of $1,000 to gift cards' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Expired \(0\)/ }));
    expect(screen.getByText('Nothing here')).toBeInTheDocument();
  });

  it('T-CON-4 the request page explains what was said, why it was paused, who voted, and what happened', async () => {
    mockFetch(common({ 'GET /api/state': () => ({ json: makeState() }), 'GET /api/family/holds/hold_aaa': () => ({ json: DETAIL }) }));
    renderAt('/family/holds/hold_aaa');
    expect(await screen.findByRole('heading', { name: 'Purchase of $1,000 to gift cards' })).toBeInTheDocument();
    expect(screen.getByText('The bank says I have to buy gift cards today')).toBeInTheDocument();
    expect(screen.getByText('Asks for gift cards')).toBeInTheDocument();
    expect(screen.getByText(/Household rules: The request looks like a scam/)).toBeInTheDocument();
    expect(screen.getByText('Request paused')).toBeInTheDocument();
    expect(screen.getByText(/Vote recorded \(approve\)/)).toBeInTheDocument();
    expect(screen.getByText('Priya', { selector: 'li strong' })).toBeInTheDocument();
    expect(screen.getByText(/“looks fine”/)).toBeInTheDocument();
    expect(screen.getByText('1 of 2 approvals')).toBeInTheDocument();
    expect(screen.getByText(/Escalated to the next approver/)).toBeInTheDocument();
    // Priya already voted: her buttons are locked, the other approver is awaited
    expect(screen.getByRole('button', { name: 'Approve' })).toBeDisabled();
    expect(screen.getByText(/Waiting for the other approver/)).toBeInTheDocument();
  });

  it('a closed request offers no decision', async () => {
    const closed = { ...DETAIL, hold: { ...DETAIL.hold, status: 'expired' as const } };
    mockFetch(common({ 'GET /api/state': () => ({ json: makeState() }), 'GET /api/family/holds/hold_aaa': () => ({ json: closed }) }));
    renderAt('/family/holds/hold_aaa');
    expect(await screen.findByText(/This request is closed/)).toBeInTheDocument();
    expect(screen.getByText(/Nobody answered in time/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Approve' })).toBeNull();
  });

  it('T-CON-5 adding and removing a trusted payee calls the server and refreshes the list', async () => {
    let payees: Payee[] = [{ id: 'pay_1', name: 'greenleaf pharmacy', kind: 'pharmacy' }];
    const { calls } = mockFetch(common({
      'GET /api/state': () => ({ json: makeState({ payees }) }),
      'POST /api/family/payees': ({ body }) => { payees = [...payees, { id: 'pay_2', name: String((body as { name: string }).name).toLowerCase(), kind: 'merchant' }]; return { json: { payees } }; },
      'DELETE /api/family/payees': () => { payees = []; return { json: { payees } }; },
    }));
    const user = userEvent.setup();
    renderAt('/family/circle');
    expect(await screen.findByText('greenleaf pharmacy')).toBeInTheDocument();
    await user.type(screen.getByLabelText('Name'), 'Corner Bakery');
    await user.click(screen.getByRole('button', { name: 'Add' }));
    expect(await screen.findByText('corner bakery')).toBeInTheDocument();
    expect(calls.find((c) => c.method === 'POST' && c.path === '/api/family/payees')!.body).toMatchObject({ name: 'Corner Bakery', kind: 'merchant', householdId: 'hh_demo' });
    await user.click(screen.getByRole('button', { name: 'Remove greenleaf pharmacy' }));
    await waitFor(() => expect(screen.queryByText('greenleaf pharmacy')).toBeNull());
    expect(calls.some((c) => c.method === 'DELETE')).toBe(true);
  });

  it('T-CON-6 the rules form saves only what changed, and blocks invalid values before asking the server', async () => {
    const { calls } = mockFetch(common({
      'GET /api/state': () => ({ json: makeState() }),
      'PUT /api/family/policy': () => ({ json: { policy: makeState().policy, changed: ['maxSingleCents'] } }),
    }));
    const user = userEvent.setup();
    renderAt('/family/policy');
    const max = await screen.findByLabelText(/Single payment limit/);
    const save = screen.getByRole('button', { name: 'Save rules' });
    expect(save).toBeDisabled();

    await user.clear(max);
    await user.type(max, '5');
    expect(await screen.findByText(/between 10 and 50,000/)).toBeInTheDocument();
    expect(save).toBeDisabled();

    await user.clear(max);
    await user.type(max, '600');
    expect(save).toBeEnabled();
    await user.click(save);
    await waitFor(() => expect(calls.some((c) => c.method === 'PUT')).toBe(true));
    expect(calls.find((c) => c.method === 'PUT')!.body).toEqual({ householdId: 'hh_demo', patch: { maxSingleCents: 60_000 } });
  });

  it('two approvals cannot be chosen when only one approver exists', async () => {
    const one = makeState();
    one.people = one.people.filter((p) => p.id !== 'p_arjun');
    mockFetch(common({ 'GET /api/state': () => ({ json: one }) }));
    renderAt('/family/policy');
    const select = await screen.findByLabelText('Approvals needed');
    expect(within(select).getByRole('option', { name: 'Two family members' })).toBeDisabled();
  });

  it('T-CON-7 notifications show who was told, how, and whether it was delivered', async () => {
    mockFetch(common({
      'GET /api/state': () => ({ json: makeState({ notifications: [
        { id: 'ntf_1', recipientId: 'p_priya', channel: 'email_html', kind: 'hold_requested', status: 'sent', attempts: 1, holdId: 'hold_aaa', description: 'Purchase of $1,000 to gift cards', createdAt: new Date().toISOString(), sentAt: new Date().toISOString() },
        { id: 'ntf_2', recipientId: 'p_arjun', channel: 'console', kind: 'hold_escalated', status: 'failed', attempts: 4, holdId: 'hold_aaa', description: 'Purchase of $1,000 to gift cards', createdAt: new Date().toISOString(), sentAt: null },
      ] }) }),
    }));
    renderAt('/family/inbox');
    expect(await screen.findByText('New request')).toBeInTheDocument();
    expect(screen.getByText('Email (file)')).toBeInTheDocument();
    expect(screen.getByText('Delivered')).toBeInTheDocument();
    expect(screen.getByText('Failed')).toBeInTheDocument();
    expect(screen.getByText(/4 tries/)).toBeInTheDocument();
    expect(screen.getByText(/nothing is actually sent/)).toBeInTheDocument();
  });
});
