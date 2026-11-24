# Evidence

All on Base Sepolia (chain 84532) with Reactive Lasna (chain 5318007). Contract addresses are in the README.

## Three sample proposals, three correct outcomes

Policy: support spending on security, audits and bug bounties. Oppose any proposal that cuts the security budget or raises pay for core team members. If a proposal is unrelated or unclear, skip it. Model: gemini-3.1-flash-lite.

| Proposal | Propose tx | submitVerdict tx | Outcome |
|---|---|---|---|
| Allocate 5 percent of the treasury to a bug bounty program for the core contracts | `0x60c3dc160f8241086a9da4e8a3071983e5395da70035a66282bdd0df323a705d` | `0x79580d8ec4f58869bdbc86cef71b02b332d07fef185ae85d4d661fc78368bc8c` | For, 1000 votes |
| Cut the security audit budget in half to fund a larger marketing campaign | `0x1023a858ebe1b60578e13bb1f3f05e65eafc51dfd107a77aabb061a53431eab8` | `0x91437e9364ae6627552a8aac8e4f987a901fbb1ca098def277f7a98802c3257f` | Against, 1000 votes |
| Add a dark mode option to the community dashboard | `0x912f88de4f207b9298abd9ba5481d6abb0d479c2fc6ae4494b75a1b7d49070fc` | `0x9fd113b3de8faf37af6becf696674a13a2d96f3ce37f026aab647a0bc460beec` | Skip, no vote cast |

These three were run on the single-owner Voter used before VoterHub. The same loop now runs for every wallet through VoterHub (see below and [measurements.md](measurements.md)).

## Two voters, opposite policies, one proposal

One Voter with the security-supporting policy above, one Voter whose owner wrote "oppose spending on security audits and bug bounties, support marketing and growth". Proposal: allocate 5 percent of the treasury to a bug bounty program for the core contracts. The AI judged each Voter against its own policy: the first voted For with 1000 tokens, the second voted Against with 500 tokens.

## Stranger flow through the UI

A new wallet with only test ETH went from connect to a recorded vote through the app alone. Timings and tx hashes: [measurements.md](measurements.md).

## What a verdict looks like on-chain

For each Voter and proposal, `Voter.results(proposalId)` returns the verdict (1 For, 2 Against, 3 Skip), the confidence, the reason text and whether the Voter acted on it. The app shows the same data under each proposal.

## Version 4: action check, two AI sources, veto window (2026-11-24)

Contracts (all verified on Sourcify): VoterHub `0x3AD291e582CfCEa430795cad7e2cFFb413856609`, DaoReactive `0x0b2D1490Ea0E9A566eCcd61e8BaeAb81559c0f60` (Lasna), dev Voter `0xA7f2Ff3ea3a717871bc33a9219c18A6662E74cc4` with a 60 second veto window. Two AI sources must agree: gemini-3.1-flash-lite and gemini-3.5-flash-lite, each with its own wallet.

Two proposals with the same text, "Pay 5,000 DAOT to the auditor for a security audit of the core contracts":

| | P1: action sends 50,000 DAOT | P2: action sends 5,000 DAOT |
|---|---|---|
| Propose | `0xdd6b96da9a8e957bdd92f28550ef0831db1ee9b84c3f4585c5711cb67a9e37ee` | `0x8c9fee9b3a0b87cd70e78a2615a343986192c71b14d802ffeb0cce6bfd396fbe` |
| Source 1 (3.1 flash-lite) | Against, "Mismatch: the proposal claims a payment of 5,000 DAOT, but the on-chain action transfers 50,000 DAOT." `0x539ccd7acecebd321351db0ed2b2cc81b8a9be266f7a63f4066f45920b213ac2` | For `0x9a688972ad667ce017d8b26376564bcec7a3549721f1ca373710c2f645cb0a7e` |
| Source 2 (3.5 flash-lite) | Against, Mismatch `0xc33714c00e5527d9fc355d28d59341c8c8ebd8a85aa590d1459962e6ec0b4791` | For `0x92a0e0115273c090fa7e7a866c88f927f34e803feed615429ee6178d78d08884` |
| Owner action | none | Veto inside the window `0xebb9994ffb57983c5a5c9f2e2fb9eb8bc85206ad33874a5cf3c7b90380c96025` |
| Reactive (Lasna) | VoteQueued, then a Cron10 tick forwards the vote after the window | queued and forwarded the same way |
| Result on Base Sepolia | Voted Against with 1,000 DAOT `0x17f16de578abeaabb583ddea1de8704fea2ff4f3bf408e549f699793802a6e76` | No vote, VoteSkipped "vetoed by owner" `0x0ff0587cf14306d361367c77b90a26f6f6fbb532a9a848305ff2e22eb00beb67` |

Lasna transactions of the reactive contract for this run: VoteQueued and cron on `0xbce2c63ec2b76bac8fd7a0438e2665920fd3d8e33c630fe7f419d1685bf1638d`, `0x1b0f71024dbaf9535252360ca7f97355ea357f5c8e3bdf5b7f9ff8640c98367f`; VoteForwarded `0xc4e007a1f547909d5c2f0d94cac4c2baef391bdcec8c45080834a6e7c002df7e`, `0x7deb4fadfb41db38da970108a878007677bf717df2f11777a2df223ccb72601d` (the second also switches cron off).

## Incident: Reactive did not relay Base Sepolia events on 2026-11-23

For several hours, no reactive contract on Lasna reacted to new Base Sepolia events (old and new contracts alike, all with funds and active subscriptions per `rnk_getFilters`). On 2026-11-24 `rnk_getBlockSequences` showed Lasna processing Base Sepolia in real time again, and a test proposal was relayed in about 3 seconds. Nothing in the contracts changed.
