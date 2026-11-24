# Latency measurements (2026-11-16, Base Sepolia + Reactive Lasna)

Runs: 5. Times come from the `timestampMs` of the block that contains each transaction (Base Sepolia blocks are 200 ms).

| Step | Min | Median | Max |
|---|---|---|---|
| Round 1: ProposalCreated to ReviewRequested (Reactive callback) | 2400 ms | 2600 ms | 3400 ms |
| Round 2: VerdictSubmitted to Voted (Reactive callback casts the vote) | 1200 ms | 1600 ms | 3200 ms |
| Gemini judging one proposal (5 calls) | 1253 ms | 2335 ms | 7138 ms |

From posting a proposal to the vote being recorded (includes the 60 second voting delay set in the Governor): 65.8 s, 64.2 s, 67.2 s, 65.2 s, 66.4 s.

## Transaction hashes per run

| Run | Propose | ReviewRequested callback | submitVerdict | Voted (callback vote) | Round 1 | Round 2 |
|---|---|---|---|---|---|---|
| 1 | 0xa3d5aed513250816112227b237dc542661a076616b8a433d4d962da8c756a4df | 0x70f2577f7450736041a5fbc9259237e971e71c640e26fb1a04da244bd7263459 | 0xcb9273a444536ff24d48b5f2ee7606e9e1ffa43ef0a5e1943075785a4455336c | 0x0e949d2cf4e98d5ea831ace6781fd530b54a4ef181d0e81c32ace3ed2821ccaf | 2600 ms | 1200 ms |
| 2 | 0x5d93a1217b41b3abcbe86fe03980336530e5a9f2b31d9795167cc6f1f1356832 | 0x509e9eae2245eb230296425549d0933cf543e9b3e5a6ed23070f99b73d2ceb22 | 0xee1b4bcdf19725b66f4898d01e1fba466c4c724e58469057199c78ddb514a7c7 | 0xd21a0e7b3e5d9aa5206f81d023ca068d0f449f4e5a760d73f492ca1ddb817435 | 2600 ms | 1600 ms |
| 3 | 0xd1a9332ec447c1423568ecd2595379fe881fdab36821c1afa5acda4975f55a7b | 0x9b02162271bfd5ced366389c57f402f97a1cc7b5d408f5e006414d38239d2478 | 0xbdaaf2a9b58d46330a3b63d24a57830c1b1728c39c0247a5868ede38e8c1202a | 0xd14ff301e74e54c2db97087e28e5d31093f152d759978573a999857765632f38 | 2400 ms | 3200 ms |
| 4 | 0x1d784d3ddc6cd3ee94c1120f3fb0ceb0b160027deb376912547871941a87b4f9 | 0xdf456b80a77b7b9116ba9173840bd381ce32f33c79a0905af79344fc384c7b81 | 0x025dc240aa6f97d784f4b3fb369642b4a978e07242822a3c911ba9dfcdd30b50 | 0xd28953f365c5d8b1a348a7eeb231306bebf556c3950a04fc2859be3354fd63cd | 3400 ms | 1800 ms |
| 5 | 0x77bd2bdadf1e4b8bc39d0aaf96c70a0bc6bc929ba0ebf0ae6ec31028b4464db5 | 0x9358e42db8751a4f446e998a02cb27abc83839cc24599ae92a40f3384fab7536 | 0x7fd3e80d9d05fede4fc6a7cdc74f6ad52a8a01fdeb7189ce05bdc62857e22ebe | 0x7799484d6178e771d654cf3dabc93d9d9f1f96c24a2ea5f153022106709f3351 | 2600 ms | 1200 ms |

## End-to-end test through the UI

Playwright drives the real app (Vite) with a mock wallet that signs with a fresh wallet holding 0.01 Base Sepolia ETH, against the real Base Sepolia and Reactive Lasna deployments.

- Connect, mint, create Voter, delegate, save policy: 24 seconds (5 transactions, no console errors).
- Post a proposal until the UI shows "Voted For": 71 seconds.
- Rejected signature: the UI shows "You rejected the request in your wallet. Nothing was sent." and the button works again.
- Two Voters with opposite policies on one proposal: For 1000, Against 500.

Not covered: a real wallet (MetaMask or a mobile wallet). The mock wallet proves the UI flow and contracts are correct, not that a real wallet flow is.
