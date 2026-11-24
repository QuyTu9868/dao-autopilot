# Security review

Scope: GovToken, TestGovernor, TreasuryGovernor, Voter, VoterHub, DaoReactive (Solidity 0.8.29, OpenZeppelin 5.4.0, reactive-lib-omni 0.1.0), version 4. Test networks only.

## Tests

- Foundry: 49 tests, all passing (`cd contracts && forge test`): 39 for the token, Governors, Hub and Voter, 10 for the reactive contract.
- Fuzz tests: the confidence threshold boundary (vote if and only if confidence is at least the owner's threshold) and the per-wallet mint cap.
- Mutation check: changing the threshold comparison from `<` to `<=` makes the fuzz test fail with counterexample `1,1`.
- DaoReactive is tested against a mock system contract: decoding a real `ProposalCreated` payload, title truncation, ignoring unwatched Governors and foreign cron sources, the veto queue (queued until a Cron10 tick after the window, cron subscribed only while the queue is not empty).
- Full Treasury DAO lifecycle: proposal, vote through the Hub, queue in the timelock, execute, treasury pays out.
- Multi-source rules: 2 of 3 agree, disagreement means no vote, one verdict per source, removed source loses the right, final verdict cannot change.

## Slither 0.11.5

17 results, none High or Medium after fixes.

| Finding | Verdict |
|---|---|
| reentrancy-no-eth in `DaoReactive._drain` | Fixed: the queue is updated before any callback request (check-effects-interactions). The callee is the trusted system contract. |
| uninitialized-local in `_drain` | Fixed (explicit initialization). |
| events-maths on `setThreshold`, `setVoterFee` | Fixed: both emit events. |
| unused-return on `governor.castVote` | Not an issue. The return value is the vote weight. |
| missing-zero-check on constructor and setter addresses | Low. Deploy scripts pass real addresses. |
| reentrancy-events | Informational. Events after external calls, state written before. |
| timestamp | Intended: the veto window is a time window. A validator can shift a timestamp by seconds, not minutes. |
| naming-convention `CLOCK_MODE` | Required by ERC-6372. |

## Exit path analysis

The contracts hold no user funds. VoterHub holds ETH from creation fees and top-ups to pay callbacks; the admin can `withdraw` it. The Treasury DAO's tokens sit in the TimelockController and leave only through a passed, queued and executed proposal.

1. Verdict with no vote: if the vote callback fails or arrives after voting closes, nobody can retrigger it. The owner can always `voteManual` while voting is open.
2. Disagreeing sources: no verdict becomes final, so the Voter never votes on that proposal. This is the intended safe default; the owner can vote manually.
3. Veto: the owner can veto any time before the vote is cast. A vetoed proposal is closed out by the queued callback without voting.
4. Trust: two registered AI sources must agree. Both are run by this project. The owner keeps control through the threshold, the veto window and manual voting.
5. Spam: one Voter per address per Governor, a 0.0005 ETH fee per Voter, and Voters without voting power at the snapshot are skipped before any model call. The AI service still caps work at 50 Voters per proposal.
6. Replayed or duplicate callbacks revert harmlessly (`AlreadyVoted`, `AlreadyFinal`, `AlreadySubmitted`).
7. Reactive funds: if the reactive contract runs out of lREACT it stops reacting. `scripts/reactive-funds.mjs` reports and tops up through `depositTo`, and the AI service warns when funds drop below 50 proposals.

## Access control summary

| Function | Who can call |
|---|---|
| `Voter.setPolicy`, `setMinConfidence`, `setVetoWindow`, `voteManual`, `veto` | Voter owner |
| `Voter.recordVerdict`, `castVerdict` | VoterHub only |
| `VoterHub.createVoter` | Anyone, with the fee, once per Governor |
| `VoterHub.submitVerdict` | Registered AI sources, once each per Voter and proposal |
| `VoterHub.requestReview`, `castVerdict` | Callback proxy, only with the DaoReactive address as callback sender |
| `VoterHub.addGovernor`, `setAgent`, `setThreshold`, `setVoterFee`, `withdraw` | Hub admin (deployer) |
| `DaoReactive.addGovernor`, `setHub` (once) | Deployer |
| `DaoReactive.react` | Reactive system contract only |
| `GovToken.mint` | Anyone, capped at 1000 per wallet |
| Treasury `TimelockController` | Proposer and canceller: TreasuryGovernor only; executor: anyone after the delay; admin role renounced |
