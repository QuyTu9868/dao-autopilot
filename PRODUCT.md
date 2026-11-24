# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack
Vite + React + wagmi/viem, with RainbowKit and WalletConnect for wallet connection. Static build, deployable to Vercel or Netlify so judges can open it by link. Chosen by the user.

## Users
Token holders of a DAO who lack the time to read every governance proposal. They want a voice in votes without handing control to a delegate. First audience: hackathon judges (Reactive Omni Buildathon, track Reactive Meets AI) who open the demo by link, usually with a fresh test wallet, and must get through the whole flow without help. UI language: English.

## Product Purpose
The user writes a voting policy in plain language. When a proposal appears, an AI reads it against the policy and the user's wallet votes automatically, with the reason stored on-chain. Success: a stranger with a new wallet finishes connect, mint, delegate, write policy, and sees a proposal voted with a readable reason, with no instructions.

## Positioning
Other AI entries in the track score price or risk. This one reads the text of a proposal and compares it to the user's own written policy, then acts through Reactive callbacks (event to AI verdict to vote) with every step visible on-chain.

## Operating Context
Base Sepolia (Governor, token, Voter) and Reactive Lasna (reactive contract). Off-chain AI service uses Gemini and submits verdicts from one registered address. Voting window is short (60 seconds delay, 5 minutes voting) so a demo shows a full cycle live. Setup order is fixed: connect wallet, mint test token, delegate to Voter, then write the policy. Each step waits for the previous one.

## Capabilities and Constraints
- Token DAOT: public mint, 1000 per wallet maximum.
- Voter per owner: stores the policy, receives the AI verdict, votes via Reactive callback. Verdicts: For, Against, Skip, with confidence 0 to 100; below the threshold (default 70) it does not vote and only informs the user.
- One verdict per proposal. Only the registered AI address can submit. State this trust point plainly.
- Reasons are stored on-chain and shown to the user.
- Test networks only. No real funds.
- Wallet rejection of a signature must be handled and explained.

## Brand Commitments
Name: DAO Autopilot. No logo yet. No em dashes in any copy.

## Evidence on Hand
Deployed and verified contracts and real transaction hashes in the README and submission/evidence.md. Latency measured: median over 5 runs: event to ReviewRequested 2.6 s, verdict to vote 1.6 s. No testimonials, users, or benchmarks beyond those. Do not fabricate any.

## Product Principles
- Show the chain of cause and effect: proposal, AI reading, verdict, vote, each with a link to its transaction.
- Prerequisites first: never offer an action whose precondition is unmet; show what is missing and the one step that fixes it.
- Honest about the agent: show the reason and confidence behind every vote, and say when it did not vote and why.
- Transaction state is never ambiguous: pending, confirmed, failed, or rejected, always visible.

## Accessibility & Inclusion
Keyboard operable, readable contrast, status not conveyed by color alone. Works on a phone screen because judges and the user may use a mobile wallet.
