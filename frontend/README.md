# DAO Autopilot app

Vite, React, TypeScript, wagmi v2, viem and RainbowKit v2. Base Sepolia only.

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # static build in dist/
```

Optional `frontend/.env`:

```
VITE_WALLETCONNECT_PROJECT_ID=   # free at cloud.reown.com, needed for mobile wallets
```

Contract addresses live in `src/config.ts`. The visual system is documented in the repo root `DESIGN.md`.
