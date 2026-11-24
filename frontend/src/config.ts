import { getDefaultConfig } from '@rainbow-me/rainbowkit'
import { parseAbi } from 'viem'
import { baseSepolia } from 'wagmi/chains'

export const chain = baseSepolia
export const EXPLORER = 'https://sepolia.basescan.org'
export const BLOCKSCOUT = 'https://base-sepolia.blockscout.com/api/v2'
export const FAUCET_URL = 'https://www.alchemy.com/faucets/base-sepolia'

export const HUB = '0x3AD291e582CfCEa430795cad7e2cFFb413856609' as const

// Hai DAO demo. Mỗi DAO có token biểu quyết riêng, vì một ví chỉ ủy quyền một token cho một địa chỉ.
export type Dao = {
  key: string
  name: string
  blurb: string
  governor: `0x${string}`
  token: `0x${string}`
  symbol: string
  treasury?: `0x${string}`
}
export const DAOS: Dao[] = [
  {
    key: 'demo',
    name: 'Demo DAO',
    blurb: 'Fast demo governor. Proposals are signals or token transfers.',
    governor: '0x57A847aDB9ea784678F7582CBf54252952eF9eFe',
    token: '0x20C623ae1dA4C32d096443097A6d523c1B2caf60',
    symbol: 'DAOT',
  },
  {
    key: 'treasury',
    name: 'Treasury DAO',
    blurb: 'Built like a real DAO: a 20,000 TDAO treasury held by a timelock. Passed proposals are queued, then executed.',
    governor: '0x3ACdDD1F5e156F68b29b469DB08673ef38F797a9',
    token: '0x18e5eb53461F67ec2df67eD4cA5f60a55a86db90',
    symbol: 'TDAO',
    treasury: '0xEb0daf93da515424063Af1F2106ed824002276b9',
  },
]

// Tên hiển thị của các nguồn AI đã đăng ký trên Hub.
export const AGENT_NAMES: Record<string, string> = {
  '0x8d41be50e8adc8892ca03a9ce3d0998ae6eb9637': 'Gemini 3.1 Flash-Lite',
  '0x3f7766680d69e0523307ec4f815b86071ac5b68d': 'Gemini 3.5 Flash-Lite',
}

export const wagmiConfig = getDefaultConfig({
  appName: 'DAO Autopilot',
  projectId: import.meta.env.VITE_WALLETCONNECT_PROJECT_ID || 'demo-project-id',
  chains: [chain],
})

export const tokenAbi = parseAbi([
  'function mint(uint256 amount)',
  'function minted(address) view returns (uint256)',
  'function balanceOf(address) view returns (uint256)',
  'function delegates(address) view returns (address)',
  'function delegate(address delegatee)',
  'function transfer(address to, uint256 value) returns (bool)',
])

export const hubAbi = parseAbi([
  'function createVoter(address governor) payable returns (address)',
  'function voterOf(address owner, address governor) view returns (address)',
  'function voterFee() view returns (uint256)',
  'function threshold() view returns (uint8)',
  'function agentCount() view returns (uint256)',
  'function proposalCount() view returns (uint256)',
  'function proposalAt(uint256) view returns ((address governor, uint256 id, string title, uint48 seenAt))',
  'event AgentVerdict(address indexed voter, uint256 indexed proposalId, address indexed agent, uint8 verdict, uint8 confidence, string reason)',
])

export const voterAbi = parseAbi([
  'function policy() view returns (string)',
  'function minConfidence() view returns (uint8)',
  'function vetoWindow() view returns (uint32)',
  'function setPolicy(string policy)',
  'function setMinConfidence(uint8 value)',
  'function setVetoWindow(uint32 seconds_)',
  'function veto(uint256 proposalId)',
  'function results(uint256) view returns (uint8 verdict, uint8 confidence, bool voted, bool vetoed, uint48 readyAt, string reason)',
  'function judgedCount() view returns (uint256)',
  'function judgedAt(uint256) view returns (uint256)',
  'function forCount() view returns (uint32)',
  'function againstCount() view returns (uint32)',
  'function skipCount() view returns (uint32)',
  'function vetoCount() view returns (uint32)',
  'function lowConfidenceCount() view returns (uint32)',
])

export const governorAbi = parseAbi([
  'function propose(address[] targets, uint256[] values, bytes[] calldatas, string description) returns (uint256)',
  'function hashProposal(address[] targets, uint256[] values, bytes[] calldatas, bytes32 descriptionHash) view returns (uint256)',
  'function state(uint256) view returns (uint8)',
  'function proposalVotes(uint256) view returns (uint256 against, uint256 forVotes, uint256 abstain)',
  'function proposalSnapshot(uint256) view returns (uint256)',
  'function proposalDeadline(uint256) view returns (uint256)',
])

export const MINT_AMOUNT = 1000n * 10n ** 18n
