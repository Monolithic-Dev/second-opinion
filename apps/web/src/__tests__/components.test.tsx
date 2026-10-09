import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { EmptyState, QuorumMeter, StatusBadge, TraceView } from '../components/parts';
import { RiskCard } from '../components/RiskCard';
import { formatDuration, formatMoney, timeAgo, timeLeft } from '../format';

describe('format helpers', () => {
  it('formats money without cents when whole', () => {
    expect(formatMoney(100_000)).toBe('$1,000');
    expect(formatMoney(2_450)).toBe('$24.50');
    expect(formatMoney(null)).toBe('—');
  });

  it('describes elapsed and remaining time', () => {
    const now = new Date('2026-10-09T12:00:00Z');
    expect(timeAgo('2026-10-09T11:59:50Z', now)).toBe('just now');
    expect(timeAgo('2026-10-09T11:55:00Z', now)).toBe('5 min ago');
    expect(timeAgo('2026-10-09T09:00:00Z', now)).toBe('3 h ago');
    expect(timeAgo('2026-10-07T12:00:00Z', now)).toBe('2 days ago');
    expect(timeLeft('2026-10-09T12:08:00Z', now)).toBe('8 min left');
    expect(timeLeft('2026-10-09T11:00:00Z', now)).toBe('expired');
    expect(formatDuration(42)).toBe('42 s');
    expect(formatDuration(null)).toBe('—');
    expect(formatDuration(5400)).toBe('1.5 h');
  });
});

describe('RiskCard', () => {
  it('shows the level in words and an icon, never colour alone, and lists every flag', () => {
    render(<RiskCard card={{ title: 'Held: possible scam', level: 'hold', flags: ['Asks for gift cards', 'Pressure to act right now'], advice: 'Real banks never ask for gift cards.' }} />);
    expect(screen.getByRole('region', { name: /Held: Held: possible scam/ })).toBeInTheDocument();
    expect(screen.getByText(/Held: possible scam/)).toBeInTheDocument();
    expect(screen.getAllByRole('listitem').map((li) => li.textContent)).toEqual(['Asks for gift cards', 'Pressure to act right now']);
    expect(screen.getByText('Real banks never ask for gift cards.')).toBeInTheDocument();
  });

  it('renders a caution card without a list when there are no flags', () => {
    render(<RiskCard card={{ title: 'Be careful', level: 'caution', flags: [], advice: '' }} />);
    expect(screen.queryByRole('list')).toBeNull();
    expect(screen.getByRole('region', { name: /Careful/ })).toBeInTheDocument();
  });
});

describe('QuorumMeter', () => {
  it('says how many approvals are in', () => {
    const { rerender } = render(<QuorumMeter approve={1} deny={0} required={2} />);
    expect(screen.getByText('1 of 2 approvals')).toBeInTheDocument();
    rerender(<QuorumMeter approve={1} deny={0} required={1} />);
    expect(screen.getByText('1 of 1 approval')).toBeInTheDocument();
    rerender(<QuorumMeter approve={1} deny={1} required={2} />);
    expect(screen.getByText('Declined')).toBeInTheDocument();
  });
});

describe('StatusBadge, EmptyState, TraceView', () => {
  it('labels hold statuses in plain language', () => {
    const { rerender } = render(<StatusBadge status="pending" />);
    expect(screen.getByText('Waiting for you')).toBeInTheDocument();
    rerender(<StatusBadge status="denied" />);
    expect(screen.getByText('Cancelled')).toBeInTheDocument();
    rerender(<StatusBadge status="released" />);
    expect(screen.getByText('Approved')).toBeInTheDocument();
    rerender(<StatusBadge status="expired" />);
    expect(screen.getByText('Expired, stayed blocked')).toBeInTheDocument();
  });

  it('shows an empty state with guidance', () => {
    render(<EmptyState title="Nothing needs your attention">New requests appear here.</EmptyState>);
    expect(screen.getByText('Nothing needs your attention')).toBeInTheDocument();
    expect(screen.getByText('New requests appear here.')).toBeInTheDocument();
  });

  it('lists the real tool calls with timing and flags failures', () => {
    render(
      <TraceView
        traceId="abc"
        trace={[
          { tool: 'check_message', args: {}, ok: true, ms: 7, summary: 'hold 100' },
          { tool: 'place_hold', args: {}, ok: false, ms: 3, code: 'FORBIDDEN', summary: 'blocked' },
        ]}
      />,
    );
    expect(screen.getAllByRole('listitem')).toHaveLength(2);
    expect(screen.getByText('check_message')).toBeInTheDocument();
    expect(screen.getByText('7 ms')).toBeInTheDocument();
    expect(screen.getByText('trace id abc')).toBeInTheDocument();
  });
});
