# DAO Autopilot

Write your DAO voting policy in plain language. When a proposal appears, two independent AI sources read it, including what it actually does on-chain, and your wallet votes for you. You can veto any vote before it lands. Every reason is stored on-chain.

Built for the Reactive Omni Buildathon, track **Reactive Meets AI**. Runs on **Base Sepolia** (tokens, Governors, voters) and **Reactive Lasna** (the reactive contract). Test networks only, no real funds.

- App: https://dao-autopilot.vercel.app
- Demo video: _link to be added_
- Contract addresses: see [Deployed contracts](#deployed-contracts)

## Why it is different

Other AI entries in this track score prices or risk. DAO Autopilot reads a proposal the way a careful delegate would: the **text**, the **on-chain actions** it would execute, and **your own written policy**. It catches proposals whose text and actions disagree (for example "pay the auditor 5,000 tokens" while the action sends 50,000). The whole loop runs through Reactive callbacks and a Reactive cron schedule, and every step is a public transaction you can open from the app.

## How it works

```mermaid
sequenceDiagram
    participant U as You
    participant G as Governor (Base Sepolia)
    participant R as DaoReactive (Lasna)
    participant H as VoterHub + your Voter (Base Sepolia)
    participant AI as Two AI sources (Gemini)

    U->>H: createVoter(governor) + fee, setPolicy, delegate tokens
    U->>G: propose(...)  (anyone can post)
    G-->>R: ProposalCreated
    R->>H: callback requestReview (stores title)
    H-->>AI: ReviewRequested
    AI->>AI: decode on-chain actions, read text and each Voter's policy
    AI->>H: submitVerdict per source (For / Against / Skip, confidence, reason)
    Note over H: final only when both sources agree
    H-->>R: VerdictSubmitted (with veto deadline)
    Note over R: queue; a Cron10 tick fires once the veto window is over
    U-->>H: optional veto() inside the window
    R->>H: callback castVerdict
    H->>G: Voter.castVote (unless vetoed, skipped or below your threshold)
```

1. **Round 1, event to callback.** A watched Governor emits `ProposalCreated`. The reactive contract on Lasna sees it and calls `VoterHub.requestReview` on Base Sepolia.
2. **AI.** Each AI source listens for `ReviewRequested`, decodes the proposal's targets and calldata into readable actions (contract ABI from the explorer, signature lookup otherwise), and asks Gemini to compare text, actions and the owner's policy. Voters with no voting power at the snapshot are skipped, so empty Voters cost nothing.
3. **Agreement.** The Hub accepts one verdict per source and finalizes only when the threshold (2 of 2) agrees. If the sources disagree, no vote is cast and the app shows what each said.
4. **Round 2, verdict to vote, with a veto window.** On `VerdictSubmitted`, the reactive contract either calls back at once or, if the owner set a veto window, queues the vote and subscribes to Reactive's `Cron10` events. Each tick (about 10 s) sends the votes whose window is over, then unsubscribes when the queue is empty. The owner can veto from the app until then.

## Try it

1. Open the app and pick a DAO: **Demo DAO** (fast, signal and transfer proposals) or **Treasury DAO** (built like a real DAO: a 20,000 TDAO treasury in a timelock; passed proposals are queued, then executed).
2. Connect a test wallet on Base Sepolia (test ETH from a [faucet](https://www.alchemy.com/faucets/base-sepolia)), mint test tokens, create your Voter (0.0005 ETH, pays its callbacks and keeps spam out), delegate, write a policy. Optionally set a confidence threshold and a veto window.
3. Post a test proposal or an example, such as "Pay auditor 5,000 (sends 50,000)". Voting opens after 1 minute and runs 5 minutes. Watch the trail: Posted, Relayed, Verdict, Vote, each stop linked to its transaction, plus the decoded actions and each AI source's verdict.

Delegate **before** a proposal is posted: votes are counted when a proposal opens.

## Measured and shown

- Median over 5 runs: event to callback 2.6 s, verdict to vote 1.6 s, Gemini 2.3 s. [submission/measurements.md](submission/measurements.md)
- Mismatch caught by both sources and voted Against, a matching proposal vetoed by its owner, every transaction hash: [submission/evidence.md](submission/evidence.md)

## Deployed contracts

Base Sepolia (chain 84532), all verified on Sourcify:

| Contract | Address |
|---|---|
| VoterHub | `0x3AD291e582CfCEa430795cad7e2cFFb413856609` |
| Demo DAO: TestGovernor | `0x57A847aDB9ea784678F7582CBf54252952eF9eFe` |
| Demo DAO: GovToken (DAOT) | `0x20C623ae1dA4C32d096443097A6d523c1B2caf60` |
| Treasury DAO: TreasuryGovernor | `0x3ACdDD1F5e156F68b29b469DB08673ef38F797a9` |
| Treasury DAO: TimelockController | `0xEb0daf93da515424063Af1F2106ed824002276b9` |
| Treasury DAO: GovToken (TDAO) | `0x18e5eb53461F67ec2df67eD4cA5f60a55a86db90` |
| Callback proxy (Reactive) | `0x476F44b11F5C942c58f4c8E3d0300E5710743585` |

Reactive Lasna (chain 5318007):

| Contract | Address |
|---|---|
| DaoReactive | `0x0b2D1490Ea0E9A566eCcd61e8BaeAb81559c0f60` |

Registered AI sources: `0x8D41Be50E8aDC8892ca03A9CE3d0998AE6eB9637` (Gemini 3.1 Flash-Lite) and `0x3F7766680d69e0523307eC4F815B86071ac5B68d` (Gemini 3.5 Flash-Lite), threshold 2.

## Trust assumptions and limits

- **Two registered AI sources** must agree before a verdict counts. Both are run by this project, so they reduce model error, not operator trust. You stay in control through your confidence threshold, the veto window and manual voting.
- The AI service judges at most 50 Voters per proposal. The creation fee and the skip of Voters without voting power make flooding costly, but a real deployment needs a stronger limit.
- Votes are counted when a proposal opens, so delegate first.
- Governor timings are short on purpose (60 s delay, 5 min voting, 60 s timelock) so a demo shows a full cycle. The veto window is capped at 180 s to fit inside voting.
- On 2026-11-23 Reactive Lasna stopped relaying Base Sepolia events for several hours and recovered on its own. See the incident note in [submission/evidence.md](submission/evidence.md).

Security notes, Slither results and test coverage: [submission/security.md](submission/security.md).

## Run it yourself

Needs Node 20+, [Foundry](https://book.getfoundry.sh/), a Gemini API key.

```bash
cp .env.example .env          # fill in keys and addresses, never commit it
```

**Contracts**

```bash
cd contracts
forge install --no-git foundry-rs/forge-std OpenZeppelin/openzeppelin-contracts@v5.4.0 Reactive-Network/reactive-lib-omni
forge test                    # 49 tests
```

**AI sources** (both must run for verdicts to become final)

```bash
cd ai-service && npm install
npm start                     # source 1, key AI_SERVICE_PRIVATE_KEY
npm run start:agent2          # source 2, key AI2_SERVICE_PRIVATE_KEY, model from agent2.env
```

Or run both in one container: `docker build -t dao-autopilot-ai ai-service` (see `ai-service/Dockerfile`, `render.yaml` for a Render deploy with a `/health` endpoint).

**Reactive funds**

```bash
node --env-file=.env scripts/reactive-funds.mjs          # report
node --env-file=.env scripts/reactive-funds.mjs --fund   # top up via depositTo when below 50 proposals
```

**App**

```bash
cd frontend && npm install && npm run dev
```

Optional: set `VITE_WALLETCONNECT_PROJECT_ID` in `frontend/.env` (free at cloud.reown.com) for mobile wallets.

### Deployment

1. `forge script script/Deploy.s.sol ...` deploys the Demo DAO token and Governor; `forge script script/DeployTreasury.s.sol ...` deploys the Treasury DAO (timelock, token with treasury, Governor, roles).
2. On Lasna: `forge create src/DaoReactive.sol:DaoReactive --value 4ether --constructor-args 84532`, then `addGovernor(<governor>)` for each DAO.
3. On Base Sepolia: `forge create src/VoterHub.sol:VoterHub --constructor-args "[<ai1>,<ai2>]" 2 500000000000000 <callback proxy> <DaoReactive>`, then `addGovernor(<governor>)` for each DAO and send some ETH to the Hub for callback fees.
4. On Lasna: `setHub(<VoterHub>)` once.
5. Verify with `forge verify-contract --verifier sourcify` (add `--chain 5318007` for Lasna).

Fund reactive contracts through the system contract's `depositTo(address)`, which settles debt first. Faucets: Base Sepolia ETH from any public faucet or the Base bridge; lREACT by sending Sepolia ETH to the Reactive faucet contract (1 ETH gives 100 lREACT).

## Repo layout

| Path | What |
|---|---|
| `contracts/` | Solidity: tokens, Governors, Voter, VoterHub, DaoReactive, Foundry tests |
| `ai-service/` | AI source: action decoding, Gemini judging, verdict submission, health endpoint |
| `frontend/` | Vite, React, wagmi, RainbowKit app |
| `scripts/` | Latency measurement, Reactive funds check, wallet helper |
| `submission/` | Measurements, security notes, evidence, video script |
| `PRODUCT.md`, `DESIGN.md` | Product context and visual system of the app |

## Safety

Use new wallets that only hold test tokens. Private keys live only in `.env` or the hosting platform's secret settings. Never use mainnet.

## License

MIT, see [LICENSE](LICENSE).
