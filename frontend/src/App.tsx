import { useState } from 'react'
import { ConnectButton } from '@rainbow-me/rainbowkit'
import { SetupRoute } from './Setup'
import { Proposals, type Posted } from './Proposals'
import { History } from './History'
import { useSetup } from './useAutopilot'
import { DAOS, chain } from './config'

function initialDao() {
  try {
    const k = localStorage.getItem('dao')
    return DAOS.find((d) => d.key === k) ?? DAOS[0]
  } catch {
    return DAOS[0]
  }
}

export default function App() {
  const [dao, setDao] = useState(initialDao)
  const s = useSetup(dao)
  const [posted, setPosted] = useState<Posted[]>([])

  const pick = (key: string) => {
    const d = DAOS.find((x) => x.key === key)!
    setDao(d)
    try {
      localStorage.setItem('dao', key)
    } catch {
      /* lưu lựa chọn chỉ là tiện ích */
    }
  }

  return (
    <>
      <header className="bar">
        <a className="brand" href="/" aria-label="DAO Autopilot home">
          <svg width="34" height="34" viewBox="0 0 34 34" aria-hidden="true">
            <path d="M4 22c0-9 6-16 15-16 7 0 11 4 11 10 0 7-6 12-13 12-6 0-13 0-13-6z" fill="#8ED462" />
            <circle cx="22" cy="14" r="4" fill="#FF705D" />
          </svg>
          DAO Autopilot
        </a>
        <div className="bar-right">
          <span className="chip net">{chain.name}</span>
          {s.isConnected && <ConnectButton showBalance={false} chainStatus="none" accountStatus="address" />}
        </div>
      </header>

      <main>
        <h1 className="sr">DAO Autopilot</h1>
        <p className="lede">
          Write your voting policy in plain words. Two independent AI sources read every new proposal, including what it actually does on-chain, and your voter casts the vote for you. You can veto any vote before it lands. Every step is on-chain and linked.
        </p>
        <div className="daos" role="group" aria-label="Choose a DAO">
          {DAOS.map((d) => (
            <button key={d.key} type="button" className={`daotab ${d.key === dao.key ? 'on' : ''}`} aria-pressed={d.key === dao.key} onClick={() => pick(d.key)}>
              <span className="dname">{d.name}</span>
              <span className="dblurb">{d.blurb}</span>
            </button>
          ))}
        </div>
        <div className="shell">
          <section aria-labelledby="setup-h" className="lobe">
            <h2 id="setup-h">Your autopilot</h2>
            <SetupRoute s={s} />
            {s.voter && <History s={s} />}
          </section>
          <Proposals s={s} posted={posted} onPosted={(p) => setPosted((cur) => [p, ...cur])} />
        </div>
      </main>

      <footer>
        <p>
          Test network only, no real funds. Verdicts count only when both registered AI sources agree; that pair of addresses is the trust assumption, and you can always veto or vote manually. Votes and reasons are public on Base Sepolia.
        </p>
      </footer>
    </>
  )
}
