import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AppStateProvider } from '../hooks/useAppState';
import { AuthProvider } from '../hooks/useAuth';
import { Demo } from '../routes/Demo';
import { FakeEventSource, HOLD_TURN, makeHold, makeState, mockFetch } from './helpers';

function renderDemo() {
  return render(
    <MemoryRouter>
      <AuthProvider>
        <AppStateProvider>
          <Demo />
        </AppStateProvider>
      </AuthProvider>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  FakeEventSource.reset();
  vi.stubGlobal('EventSource', FakeEventSource);
});

describe('Demo screen', () => {
  it('T-WEB-1 an example request is sent to the server and the held answer, risk card and real MCP trace are shown', async () => {
    const { calls } = mockFetch({
      'GET /api/auth/me': () => ({ json: { personId: null } }),
      'GET /api/state': () => ({ json: makeState() }),
      'GET /healthz': () => ({ json: { ok: true, mcp: true } }),
      'POST /api/utter': () => ({ json: HOLD_TURN }),
    });
    const user = userEvent.setup();
    renderDemo();
    await user.click(await screen.findByRole('button', { name: 'Buy gift cards (a scam)' }));

    const log = await screen.findByRole('log', { name: 'Conversation' });
    expect(await within(log).findByText(/I've paused this/)).toBeInTheDocument();
    expect(within(log).getByText(/Held: possible scam/)).toBeInTheDocument();
    expect(within(log).getByText('Asks for gift cards')).toBeInTheDocument();

    const utter = calls.find((c) => c.path === '/api/utter')!;
    expect(utter.body).toMatchObject({ householdId: 'hh_demo', speaker: 'elder' });
    expect(String((utter.body as { text: string }).text)).toMatch(/five \$200 gift cards/);
    expect(utter.headers['x-requested-with']).toBe('so');

    await user.click(screen.getByText(/Developer trace/));
    expect(screen.getByText('check_message')).toBeInTheDocument();
    expect(screen.getByText('7 ms')).toBeInTheDocument();
  });

  it('T-WEB-2 the family phone asks for sign-in, then shows the pending request and sends Deny', async () => {
    let signedIn = false;
    const pending = makeHold();
    const { calls } = mockFetch({
      'GET /api/auth/me': () => ({ json: { personId: signedIn ? 'p_priya' : null } }),
      'POST /api/auth/login': () => { signedIn = true; return { json: { personId: 'p_priya' } }; },
      'GET /api/state': () => ({ json: makeState({ holds: [pending] }) }),
      'GET /healthz': () => ({ json: { ok: true, mcp: true } }),
      'POST /api/family/holds/hold_aaa/vote': () => ({ json: { holdId: 'hold_aaa', status: 'denied', votes: { approve: 0, deny: 1, required: 1 } } }),
    });
    const user = userEvent.setup();
    renderDemo();

    const form = await screen.findByRole('form', { name: 'Family sign-in' });
    await user.selectOptions(within(form).getByLabelText('Who are you?'), 'p_priya');
    await user.type(within(form).getByLabelText(/^PIN/), '1234');
    await user.click(within(form).getByRole('button', { name: 'Sign in' }));

    expect(await screen.findByText('1 waiting for you')).toBeInTheDocument();
    expect(screen.getByText('Priya\'s phone')).toBeInTheDocument();
    expect(calls.find((c) => c.path === '/api/auth/login')!.body).toEqual({ personId: 'p_priya', pin: '1234' });

    await user.click(screen.getByRole('button', { name: 'Deny' }));
    await waitFor(() => expect(calls.some((c) => c.path === '/api/family/holds/hold_aaa/vote')).toBe(true));
    expect(calls.find((c) => c.path === '/api/family/holds/hold_aaa/vote')!.body).toEqual({ decision: 'deny' });
  });

  it('T-WEB-3 a wrong PIN shows the server message and keeps the form', async () => {
    mockFetch({
      'GET /api/auth/me': () => ({ json: { personId: null } }),
      'POST /api/auth/login': () => ({ status: 401, json: { error: { code: 'BAD_CREDENTIALS', message: 'Wrong PIN.' } } }),
      'GET /api/state': () => ({ json: makeState() }),
      'GET /healthz': () => ({ json: { ok: true, mcp: true } }),
    });
    const user = userEvent.setup();
    renderDemo();
    const form = await screen.findByRole('form', { name: 'Family sign-in' });
    await user.type(within(form).getByLabelText(/^PIN/), '0000');
    await user.click(within(form).getByRole('button', { name: 'Sign in' }));
    expect(await within(form).findByRole('alert')).toHaveTextContent('Wrong PIN.');
    expect(screen.queryByText(/waiting for you/)).toBeNull();
  });

  it('T-WEB-4 when the family decides, Dorothy\'s device tells her; later events are ignored', async () => {
    mockFetch({
      'GET /api/auth/me': () => ({ json: { personId: null } }),
      'GET /api/state': () => ({ json: makeState() }),
      'GET /healthz': () => ({ json: { ok: true, mcp: true } }),
      'POST /api/utter': () => ({ json: HOLD_TURN }),
    });
    const user = userEvent.setup();
    renderDemo();
    await user.click(await screen.findByRole('button', { name: 'Buy gift cards (a scam)' }));
    await screen.findByText(/I've paused this/);

    const es = FakeEventSource.instances[0]!;
    act(() => es.emit('hold.resolved', { holdId: 'hold_other', status: 'denied' }));
    expect(screen.queryByText(/Your family said no/)).toBeNull();

    act(() => es.emit('hold.resolved', { holdId: 'hold_aaa', status: 'pending' }));
    expect(screen.queryByText(/Your family said no/)).toBeNull();

    act(() => es.emit('hold.resolved', { holdId: 'hold_aaa', status: 'denied' }));
    expect(await screen.findByText("Your family said no, so I've cancelled it. You're safe.")).toBeInTheDocument();

    act(() => es.emit('hold.resolved', { holdId: 'hold_aaa', status: 'denied' }));
    expect(screen.getAllByText(/Your family said no/)).toHaveLength(1);
  });

  it('T-WEB-5 an unreachable server is explained, not swallowed', async () => {
    mockFetch({
      'GET /api/auth/me': () => ({ json: { personId: null } }),
      'GET /api/state': () => ({ json: makeState() }),
      'GET /healthz': () => ({ json: { ok: true, mcp: true } }),
      'POST /api/utter': () => ({ status: 503, json: { error: { code: 'UNAVAILABLE', message: "I couldn't reach the safety checker, so nothing was done." } } }),
    });
    const user = userEvent.setup();
    renderDemo();
    await user.click(await screen.findByRole('button', { name: 'Pay the pharmacy $24' }));
    expect(await screen.findAllByText(/couldn't reach the safety checker/)).not.toHaveLength(0);
  });
});
