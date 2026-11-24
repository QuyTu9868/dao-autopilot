# Security review

Scope: GovToken, TestGovernor, Voter, VoterHub, DaoReactive (Solidity 0.8.29, OpenZeppelin 5.4.0, reactive-lib-omni 0.1.0). Test network only.

## Tests

- Foundry: 36 tests, all passing (`cd contracts && forge test`).
- Coverage of the project's own logic: DaoReactive 100% lines and branches, VoterHub 100%, Voter 100% lines and 90% branches, overall branches 95.7%. GovToken and TestGovernor are thin OpenZeppelin wrappers (the uncovered lines are override forwarders with no logic).
- Two fuzz tests: the confidence threshold boundary (vote if and only if confidence is at least the owner's threshold) and the per-wallet mint cap.
- Mutation check: changing the threshold comparison from `<` to `<=` makes the fuzz test fail with counterexample `1,1`, so the boundary test is real. The fixed-value tests alone did not catch that mutation.
- DaoReactive is tested against a mock system contract, including decoding of a real `ProposalCreated` payload, title truncation, and ignoring logs from other contracts.

## Slither 0.11.5

14 results, none High or Medium.

| Finding | Verdict |
|---|---|
| unused-return on `governor.castVote` (2) | Not an issue. The return value is the vote weight, not needed. |
| missing-zero-check on constructor and setter addresses (6) | Low. Deploy scripts pass real addresses. `setAiAgent(0)` by the admin would only disable verdicts, no funds are at risk. |
| reentrancy-events (5) | Informational. Events are emitted after external calls, state is written before. `Voter.castVerdict` sets `voted = true` before calling the Governor. |
| naming-convention `CLOCK_MODE` | Required by the ERC-6372 interface. |

## Exit path analysis (no funds, but state can get stuck)

The contracts hold no user funds. The only balance is ETH in VoterHub used to pay callback fees, with no withdraw function (a test-network operating budget).

1. Verdict with no vote: if a verdict is recorded but the Reactive callback fails (for example the proposal is not Active), nobody can retrigger it. The owner can always call `voteManual` while voting is open, and the AI service only submits verdicts once a proposal is Active, so this only happens if the callback is delayed past the voting window.
2. A single registered AI address can submit any verdict for any voter. This is stated in the app footer and README as the trust assumption. The owner stays in control through the confidence threshold and `voteManual`.
3. Spam: anyone can create one Voter per address. The AI service judges at most 50 voters per proposal (`MAX_VOTERS_PER_PROPOSAL`), so a flood of empty Voters could crowd out later real ones. Voters without a policy are skipped without calling the model. Acceptable for a test deployment, needs an allowlist or fee on `createVoter` before real use.
4. Delegation snapshot: votes are counted when a proposal opens, so delegating after a proposal is posted gives that voter zero weight. The app says this at the delegate step.
5. Replayed or duplicate callbacks revert harmlessly (`AlreadyVoted`, `AlreadyJudged`).

## Access control summary

| Function | Who can call |
|---|---|
| `Voter.setPolicy`, `setMinConfidence`, `voteManual` | Voter owner |
| `Voter.recordVerdict`, `castVerdict` | VoterHub only |
| `VoterHub.submitVerdict` | Registered AI address |
| `VoterHub.requestReview`, `castVerdict` | Callback proxy, and only with the DaoReactive address as callback sender |
| `VoterHub.setAiAgent` | Hub admin (deployer) |
| `DaoReactive.setHub` | Deployer, once |
| `DaoReactive.react` | Reactive system contract only |
| `GovToken.mint` | Anyone, capped at 1000 DAOT per wallet |
