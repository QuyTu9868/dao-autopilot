# Demo video (2:37)

File: `submission/video/dao-autopilot-demo.mp4` (1440x900, English voice by Gemini TTS, burned-in subtitles). Recorded from a real run on Base Sepolia and Reactive Lasna with a fresh test wallet; long waits are fast-forwarded and said so.

| Scene | On screen | Voice |
|---|---|---|
| intro | First screen, two DAOs to choose from | DAOs vote on dozens of proposals, and nobody has time to read them all. Skip them, and you lose your voice. Delegate, and you lose control. DAO Autopilot is a third option. You write a policy, and your wallet votes for you, with a veto in your hand. |
| setup | Connect a fresh wallet, mint, create voter (fee), delegate | I connect a fresh test wallet. The app walks me through it in order: mint test tokens, create my own voter contract for a small fee, and delegate my votes to it. I stay the owner. |
| policy | Example policy, veto window, save | Then my policy, in plain English. Support security spending, oppose cuts to it, and skip anything unrelated. I also set a veto window, so I can block any vote before it lands. |
| post | Post three proposals: 50,000 mismatch, honest 5,000, dark mode | Now three proposals. Two of them say: pay the auditor five thousand tokens. But one of them actually sends fifty thousand. The third is about dark mode. A Reactive contract on Lasna picks up each proposal within about three seconds. |
| wait | Relayed by Reactive, both AI sources read the actions | Two independent AI sources, both Gemini models, decode what each proposal really does on chain, and compare it with the text and my policy. A verdict only counts when both agree. Voting opens after one minute, so I skip ahead. |
| veto | Verdicts arrive, the owner vetoes the honest payment | Both sources agree. The honest audit payment fits my policy, so my voter will vote For when the window closes. I change my mind, and veto it. |
| resultswait | Veto window runs out (fast forward, no voice) | (none) |
| results | Mismatch voted Against, veto held, dark mode skipped | The fifty thousand payout is caught as a mismatch, and voted Against. My veto held, so there is no vote there. Dark mode is unrelated, so it is skipped. Reactive's cron releases each vote only after the window, and every step links to its transaction. |
| history | The voter's history and counters | My voter keeps its own history: every verdict, its reason, and what happened. |
| treasury | Treasury DAO: executed treasury payout | The same loop runs on a second DAO with a real treasury and a timelock. There, an approved audit payment was queued, executed, and the treasury paid out five thousand tokens. |
| end | End card with measured latency | Event to callback in about two point six seconds, and verdict to vote in about one point six. Two AI sources must agree, and the owner can always veto or vote manually. DAO Autopilot is open source, on Base Sepolia and Reactive Lasna. |

The previous cut (version 3, before the veto window and two AI sources) is kept as `dao-autopilot-demo-v3.mp4`.
