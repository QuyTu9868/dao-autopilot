# Demo video script (target 2:40, hard limit 3:00)

Language: English. Screen recording with voice over. Record twice, keep the better take as the main file and the other as backup.

Before recording
- AI service running (`cd ai-service && npm start`), app open on the deployed link or `localhost:5173`.
- A test wallet with Base Sepolia ETH and **no** DAOT, no Voter yet, so the whole setup is on screen.
- A second browser tab with the VoterHub address on the block explorer, for the last shot.
- Close other tabs and notifications. 1080p, browser zoom 110 percent so text is readable.

## Shots

| Time | On screen | Voice over |
|---|---|---|
| 0:00 to 0:15 | App first screen, setup lobe on the left, one proposal on the right. | "DAOs vote on dozens of proposals and nobody has time to read them. If you skip, you lose your voice. If you delegate, you lose control. DAO Autopilot is a third option." |
| 0:15 to 0:40 | Click Connect wallet. Then Mint, Create my voter, Delegate. Each step turns green. | "I connect a fresh test wallet. The app tells me what is missing and in what order: mint test tokens, create my own voter contract, delegate my votes to it. I stay the owner." |
| 0:40 to 1:00 | Click Use an example, show the policy text, set the confidence slider to 70, Save policy. | "Now my policy, in plain language: support security spending, oppose cuts to it, skip anything unrelated. Below 70 percent confidence my voter will not vote." |
| 1:00 to 1:25 | Pick the first example proposal, Post proposal. Show the new row with the trail and the countdown. | "I post a proposal. Everything from here is automatic. The Governor emits an event, a Reactive contract on Lasna sees it and calls back into my voter's hub." (Show Posted and Relayed stops filling.) |
| 1:25 to 1:50 | Speed up the 60 second wait (2x or a cut). Verdict stop fills green, reason appears. | "An off-chain service reads the proposal text and my policy and asks Gemini. Verdict: For, confidence 100, and the reason is stored on-chain." |
| 1:50 to 2:10 | Vote stop fills, "Voted For" appears, tally shows For 1,000. Click a tx link, show it on the explorer. | "Reactive sees the verdict event and calls back again. My voter votes with my delegated tokens. Every stop links to its transaction." |
| 2:10 to 2:30 | Post the second example (cut the audit budget): verdict Against, coral stop. Then the third (dark mode): Skip, lilac stop, "did not vote". | "Different proposal, different outcome. An unrelated one is skipped, and the app says so instead of guessing." |
| 2:30 to 2:50 | Show the README measurements table or the measurements file. | "Event to callback takes about 2.6 seconds, verdict to vote about 1.6. One AI address submits verdicts, that is the trust assumption, and you can always vote manually. Code and contracts are open source on Base Sepolia and Reactive Lasna. Thanks." |

## Notes

- Speak slowly, short sentences. About 330 words in total.
- The 60 second voting delay is a Governor setting for demos. Say it once, then cut it.
- Do not show `.env`, private keys or the wallet recovery phrase. Use a wallet with test tokens only.
- If Gemini is slow on the day, re-record that shot. Do not fake the result.
