export type VoteDecision = 'approve' | 'deny';
export interface Vote {
  approverId: string;
  decision: VoteDecision;
}

export type QuorumState = 'pending' | 'approved' | 'denied';

export interface Tally {
  state: QuorumState;
  approvals: number;
  denials: number;
  required: number;
}

/** A single deny vetoes. Approved only when `required` distinct approvers approved. Order of votes never matters. */
export function tally(votes: Vote[], required: number): Tally {
  const byApprover = new Map<string, VoteDecision>();
  for (const v of votes) byApprover.set(v.approverId, v.decision);
  let approvals = 0;
  let denials = 0;
  for (const d of byApprover.values()) d === 'approve' ? approvals++ : denials++;
  const state: QuorumState = denials > 0 ? 'denied' : approvals >= required ? 'approved' : 'pending';
  return { state, approvals, denials, required };
}

export type AddVoteResult = { kind: 'added'; votes: Vote[] } | { kind: 'duplicate'; votes: Vote[] } | { kind: 'conflict'; votes: Vote[] };

/** Idempotent for an identical repeat vote; a different vote from the same approver is a conflict. */
export function addVote(votes: Vote[], vote: Vote): AddVoteResult {
  const prior = votes.find((v) => v.approverId === vote.approverId);
  if (!prior) return { kind: 'added', votes: [...votes, vote] };
  return { kind: prior.decision === vote.decision ? 'duplicate' : 'conflict', votes };
}
