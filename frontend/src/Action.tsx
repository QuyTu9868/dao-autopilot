import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { usePublicClient } from 'wagmi'
import { EXPLORER, chain } from './config'
import { classifyError, type TxState } from './tx'

type Props = {
  label: string
  run: () => Promise<`0x${string}`>
  disabled?: boolean
  onConfirmed?: (hash: `0x${string}`) => void
  tone?: 'yellow' | 'coral' | 'blue' | 'lilac'
}

// Một nút ký giao dịch với trạng thái rõ ràng: signing, pending, confirmed, rejected, failed.
export function Action({ label, run, disabled, onConfirmed, tone = 'yellow' }: Props) {
  const [tx, setTx] = useState<TxState>({ kind: 'idle' })
  const client = usePublicClient({ chainId: chain.id })
  const qc = useQueryClient()
  const busy = tx.kind === 'signing' || tx.kind === 'pending'

  async function go() {
    setTx({ kind: 'signing' })
    let hash: `0x${string}` | undefined
    try {
      hash = await run()
      setTx({ kind: 'pending', hash })
      const receipt = await client!.waitForTransactionReceipt({ hash })
      if (receipt.status !== 'success') {
        setTx({ kind: 'failed', message: 'The transaction was reverted on-chain.', hash })
        return
      }
      setTx({ kind: 'confirmed', hash })
      await qc.invalidateQueries()
      onConfirmed?.(hash)
    } catch (err) {
      const s = classifyError(err)
      setTx(s.kind === 'failed' && hash ? { ...s, hash } : s)
    }
  }

  return (
    <div className="action">
      <button type="button" className={`capsule ${tone}`} onClick={go} disabled={disabled || busy}>
        {tx.kind === 'signing' ? 'Confirm in your wallet' : tx.kind === 'pending' ? 'Confirming' : label}
      </button>
      <p className={`txline ${tx.kind}`} role="status" aria-live="polite">
        {tx.kind === 'signing' && 'Waiting for your signature. Nothing is sent until you confirm.'}
        {tx.kind === 'pending' && <>Sent, waiting for confirmation. <TxLink hash={tx.hash} /></>}
        {tx.kind === 'confirmed' && <>Confirmed. <TxLink hash={tx.hash} /></>}
        {tx.kind === 'rejected' && 'You rejected the request in your wallet. Nothing was sent. Press the button to try again.'}
        {tx.kind === 'failed' && <>Failed: {tx.message} {tx.hash && <TxLink hash={tx.hash} />}</>}
      </p>
    </div>
  )
}

export function TxLink({ hash, text = 'View transaction' }: { hash: string; text?: string }) {
  return (
    <a href={`${EXPLORER}/tx/${hash}`} target="_blank" rel="noreferrer">
      {text}
    </a>
  )
}
