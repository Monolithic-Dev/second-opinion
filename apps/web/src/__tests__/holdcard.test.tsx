import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { HoldCard } from '../components/HoldCard';
import { makeHold, mockFetch } from './helpers';

describe('HoldCard', () => {
  it('shows what was paused and why, with the approval progress', () => {
    render(<HoldCard hold={makeHold({ quorumRequired: 2, votes: { approve: 1, deny: 0 } })} onVoted={() => {}} />);
    expect(screen.getByRole('heading', { name: 'Purchase of $1,000 to gift cards' })).toBeInTheDocument();
    expect(screen.getByText(/\$1,000 · gift cards/)).toBeInTheDocument();
    expect(screen.getByText('Asks for gift cards')).toBeInTheDocument();
    expect(screen.getByText(/Household rules: The request looks like a scam/)).toBeInTheDocument();
    expect(screen.getByText('1 of 2 approvals')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Approve' })).toBeEnabled();
  });

  it('sends the decision with the note and the CSRF header, then reports it', async () => {
    const { calls } = mockFetch({ 'POST /api/family/holds/hold_aaa/vote': () => ({ json: { holdId: 'hold_aaa', status: 'denied', votes: { approve: 0, deny: 1, required: 1 } } }) });
    const onVoted = vi.fn();
    const user = userEvent.setup();
    render(<HoldCard hold={makeHold()} onVoted={onVoted} />);
    await user.type(screen.getByPlaceholderText('Add a note (optional)'), 'not my bank');
    await user.click(screen.getByRole('button', { name: 'Deny' }));
    await waitFor(() => expect(onVoted).toHaveBeenCalledTimes(1));
    expect(calls[0]).toMatchObject({ method: 'POST', path: '/api/family/holds/hold_aaa/vote', body: { decision: 'deny', note: 'not my bank' } });
    expect(calls[0]!.headers['x-requested-with']).toBe('so');
  });

  it('locks both buttons while the vote is in flight so it cannot be double-tapped', async () => {
    let release: (v: { json: unknown }) => void = () => {};
    mockFetch({ 'POST /api/family/holds/hold_aaa/vote': () => new Promise((r) => { release = r; }) });
    const user = userEvent.setup();
    render(<HoldCard hold={makeHold()} onVoted={() => {}} />);
    await user.click(screen.getByRole('button', { name: 'Approve' }));
    expect(screen.getByRole('button', { name: 'Saving…' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Deny' })).toBeDisabled();
    release({ json: { holdId: 'hold_aaa', status: 'released', votes: { approve: 1, deny: 0, required: 1 } } });
    await waitFor(() => expect(screen.getByRole('button', { name: 'Approve' })).toBeEnabled());
  });

  it('shows the server message when a vote is refused', async () => {
    mockFetch({ 'POST /api/family/holds/hold_aaa/vote': () => ({ status: 409, json: { error: { code: 'CONFLICT', message: 'hold hold_aaa is already denied' } } }) });
    const onVoted = vi.fn();
    const user = userEvent.setup();
    render(<HoldCard hold={makeHold()} onVoted={onVoted} />);
    await user.click(screen.getByRole('button', { name: 'Approve' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('already denied');
    expect(onVoted).not.toHaveBeenCalled();
  });

  it('does not offer a decision on a finished hold, and waits when you already voted', () => {
    const { rerender } = render(<HoldCard hold={makeHold({ status: 'denied' })} onVoted={() => {}} />);
    expect(screen.queryByRole('button', { name: 'Approve' })).toBeNull();
    expect(screen.getByText('Cancelled')).toBeInTheDocument();
    rerender(<HoldCard hold={makeHold({ quorumRequired: 2, votes: { approve: 1, deny: 0 } })} alreadyVoted onVoted={() => {}} />);
    expect(screen.getByRole('button', { name: 'Approve' })).toBeDisabled();
    expect(screen.getByText(/Waiting for the other approver/)).toBeInTheDocument();
  });
});
