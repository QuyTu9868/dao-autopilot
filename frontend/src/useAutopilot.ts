import { useAccount, useBalance, useReadContract } from 'wagmi'
import { zeroAddress } from 'viem'
import { HUB, chain, hubAbi, tokenAbi, voterAbi, type Dao } from './config'

const poll = { refetchInterval: 4000 }
export const MIN_GAS = 300_000_000_000_000n // 0.0003 ETH

// Trạng thái thiết lập của ví đang kết nối trên một DAO. Mỗi bước phụ thuộc bước trước.
export function useSetup(dao: Dao) {
  const { address, isConnected, chainId } = useAccount()
  const rightChain = isConnected && chainId === chain.id
  const enabled = !!address
  const common = { chainId: chain.id } as const

  const eth = useBalance({ address, chainId: chain.id, query: { enabled, ...poll } })
  const minted = useReadContract({ address: dao.token, abi: tokenAbi, functionName: 'minted', args: [address!], ...common, query: { enabled, ...poll } })
  const voterQ = useReadContract({ address: HUB, abi: hubAbi, functionName: 'voterOf', args: [address!, dao.governor], ...common, query: { enabled, ...poll } })
  const voter = voterQ.data && voterQ.data !== zeroAddress ? voterQ.data : undefined
  const delegatee = useReadContract({ address: dao.token, abi: tokenAbi, functionName: 'delegates', args: [address!], ...common, query: { enabled, ...poll } })
  const policy = useReadContract({ address: voter!, abi: voterAbi, functionName: 'policy', ...common, query: { enabled: !!voter, ...poll } })
  const minConf = useReadContract({ address: voter!, abi: voterAbi, functionName: 'minConfidence', ...common, query: { enabled: !!voter, ...poll } })
  const vetoWindow = useReadContract({ address: voter!, abi: voterAbi, functionName: 'vetoWindow', ...common, query: { enabled: !!voter, ...poll } })
  const fee = useReadContract({ address: HUB, abi: hubAbi, functionName: 'voterFee', ...common })

  const hasGas = (eth.data?.value ?? 0n) >= MIN_GAS
  const done = [
    rightChain && hasGas,
    (minted.data ?? 0n) > 0n,
    !!voter,
    !!voter && delegatee.data?.toLowerCase() === voter.toLowerCase(),
    !!policy.data && policy.data.trim().length > 0,
  ]
  return {
    dao,
    address, isConnected, rightChain, hasGas, ethLoaded: eth.data !== undefined,
    voter, policy: policy.data ?? '', minConf: minConf.data ?? 70, vetoWindow: Number(vetoWindow.data ?? 0),
    fee: fee.data ?? 0n,
    done,
    current: done.findIndex((d) => !d), // -1 khi xong hết
  }
}
