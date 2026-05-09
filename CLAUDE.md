@.agents/skills/ethglobal-skills/SKILL.md

# Noctwave — Claude Code Instructions
### ETHPrague 2026 Hackathon · Base Sepolia · 36-Hour Build

---

## Project at a Glance

Censorship-resistant publishing platform: creators upload encrypted video/text to Swarm, subscribers pay per-second via Superfluid streaming, content decrypts on-demand via ECDH, payments are private via EIP-5564 stealth addresses.

**PRD:** `PRD.md` is the single source of truth. Check it before inventing interfaces.  
**Design doc:** `NOCTWAVE.md` has the "why" behind every decision.

---

## Monorepo Layout

```
noctwave/
├── contracts/          # Dev A — Foundry (NoctwaveRegistry, SubscriptionVault, VaultFactory)
└── frontend/           # Next.js 15 app — all logic lives here, no separate backend
    └── src/
        ├── app/
        │   ├── api/swarm/upload/route.ts  # Only API route: server-side Bee node proxy for writes
        │   ├── creator/[ens]/page.tsx     # Runs key delivery sync on load
        │   └── watch/[ens]/[postId]/      # Fetches key from Swarm Feed, decrypts in browser
        ├── components/
        ├── hooks/      # Wagmi contract hooks
        └── lib/        # All shared modules
            ├── crypto.ts        # AES-GCM + key derivation
            ├── stealth.ts       # EIP-5564
            ├── swarmClient.ts   # bee-js wrapper
            └── keyDelivery.ts   # Key sync (called from dashboard, not a persistent process)
```

---

## Chain & Deployed Contracts

**Chain:** Base Sepolia only. Chain ID `84532`. Never add multi-chain logic.

| Contract / Service        | Address                                      |
|---------------------------|----------------------------------------------|
| CFAv1Forwarder (Superfluid) | `0xcfA132E353cB4E398080B9700609bb008eceB125` |
| Superfluid Host           | `0x4C073B3baB6d8826b8C5b229f3cfdC1eC6E47E74` |
| USDC (Base Sepolia)       | `0x036CbD53842c5426634e7929541eC2318f3dCF7e` |
| NoctwaveRegistry          | Fill from `.env` after Dev A deploys         |
| VaultFactory              | Fill from `.env` after Dev A deploys         |

**RPC:** `https://sepolia.base.org`  
**Explorer:** `https://sepolia.basescan.org`

---

## Tech Stack — Exact Versions

### Frontend (single package — no separate backend)
- `next@15.x`, `react@19.x`
- `wagmi@^2.14`, `viem@^2.21`
- `@rainbow-me/rainbowkit@^2.2`
- `@tanstack/react-query@^5.62`
- `@ethersphere/bee-js@^8.x`
- `@ffmpeg/ffmpeg@^0.12.x`, `@ffmpeg/util@^0.12.x`
- `hls.js@^1.5.x`
- `@xmtp/xmtp-js@^12.x`
- `@noble/secp256k1@^2.1`, `@noble/hashes@^1.6`
- `apify-client@^2.9`
- `ethers@^6.13`

### Contracts
- Foundry with `forge`
- OpenZeppelin contracts, Superfluid ethereum-contracts

---

## Coding Standards

### General
- **Hackathon pace:** ship it. No premature abstractions. Three similar lines beats a helper function invented speculatively. Don't add error handling for states that can't happen.
- TypeScript everywhere. No `any` unless fighting a library type.
- No comments that explain what — only comments that explain why (hidden invariant, workaround, non-obvious constraint).
- No trailing summary comments, no "// added for X" comments.

### Solidity
- Pragma `^0.8.24`. Use custom errors (`error Foo()`), not revert strings.
- No SafeMath (not needed post-0.8). Minimal gas optimization — this is testnet.
- Events on every state change. Index the address params.
- Keep contracts small: each contract does one thing.
- Never use `address(0)` checks unless the logic actually depends on it.

### TypeScript / React
- Wagmi hooks for all contract reads/writes — never construct raw RPC calls manually.
- `useReadContract` for reads, `useWriteContract` for writes, `useWatchContractEvent` for events.
- `parseAbi` from viem for inline ABIs — don't maintain a separate ABI JSON file.
- Next.js App Router (`app/` directory). Server components by default; add `'use client'` only when needed (hooks, wallet, browser APIs).
- Never import `ethers` in new code — use `viem` instead. `ethers` is only in the tree because of `@xmtp/xmtp-js`.

### Crypto / Key Handling
- Never log, persist, or transmit raw content keys. Keys live in React state or are passed as args — they never hit localStorage, a cookie, or a server response.
- AES-256-GCM with a random 12-byte IV prepended to every ciphertext. See `frontend/src/lib/crypto.ts`.
- Shared secret is derived from `signMessageAsync` — one wallet prompt, works with any wallet. Never use MetaMask-specific `eth_decrypt` or `eth_getEncryptionPublicKey` (deprecated).
- The signing message format is canonical: `"noctwave-decrypt:{creatorAddress.toLowerCase()}:{postCID}"`.

### Swarm
- All reads go through the public gateway directly from the browser: `NEXT_PUBLIC_SWARM_GATEWAY/bzz/{cid}`.
- All writes are proxied through `POST /api/swarm/upload` (Next.js API route) because the Bee node is server-only. The browser never talks to the Bee node directly.
- `SWARM_BEE_URL` and `SWARM_POSTAGE_BATCH_ID` are server-side env vars only — never `NEXT_PUBLIC_`.
- Never require end users to run a Bee node. The Swarm HTTP gateway is the only client-side dependency.
- Swarm ACT is NOT used — confirmed with Swarm mentor. ACT requires a local Bee node; we use custom ECDH instead.
- CIDs are 64-char hex strings (not IPFS CIDs).
- Encrypted subscriber keys are stored in **Swarm Feeds** (one feed slot per creator+subscriber+postCID triple). No backend KV store. Topic = `keccak256Hash("noctwave-key:" + lookupAddress)`, owner = creator address.

### Superfluid
- Always use `CFAv1Forwarder` for stream operations — never call the Host directly.
- USDCx has 18 decimals (USDC has 6). Flow rate formula: `(usdcPerMonth * 1e18) / 2_592_000`.
- Subscribers must wrap USDC → USDCx before opening a stream. Add this step to the subscribe UI.
- Check subscription status via `getFlowrate(USDCx, sender, vault) > 0`.

### EIP-5564 Stealth Addresses
- Implementation is in `frontend/src/lib/stealth.ts`. Do not reimplement inline.
- For hackathon: stream may come from main wallet; stealth address is shown in UI to demonstrate privacy concept. Document this limitation clearly in UI copy.
- Never store stealth private keys anywhere except the subscriber's local browser.

---

## Architecture Decisions — Do Not Revisit

These are settled. Do not propose alternatives.

| Decision | Rationale |
|---|---|
| No Swarm ACT | Requires Bee node; end users won't run one |
| Wallet-agnostic signing only (`eth_sign`) | MetaMask `eth_decrypt` is deprecated; this works with every wallet |
| Base Sepolia only | Single chain simplifies everything for a 36h hackathon |
| Foundry not Hardhat | Faster compilation, better fork testing |
| `viem` not `ethers` | Wagmi v2 uses viem; mixing is painful |
| Next.js App Router | Modern, SSR-friendly for Wagmi |
| ffmpeg.wasm in-browser | No server-side transcoding dependency; self-contained demo |

---

## Critical Next.js Config

`next.config.ts` MUST include CORP/COEP headers for ffmpeg.wasm SharedArrayBuffer:

```typescript
async headers() {
  return [{
    source: '/(.*)',
    headers: [
      { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
      { key: 'Cross-Origin-Embedder-Policy', value: 'require-corp' },
    ],
  }]
}
```

Without these, `@ffmpeg/ffmpeg` will throw at runtime.

---

## Environment Variables

All values come from `.env` in the repo root. Frontend vars are prefixed `NEXT_PUBLIC_`. Never hardcode addresses that are in `.env`.

Key vars:
```
NEXT_PUBLIC_CHAIN_ID=84532
NEXT_PUBLIC_RPC_URL=https://sepolia.base.org
NEXT_PUBLIC_CFA_FORWARDER=0xcfA132E353cB4E398080B9700609bb008eceB125
NEXT_PUBLIC_USDC_ADDRESS=0x036CbD53842c5426634e7929541eC2318f3dCF7e
NEXT_PUBLIC_USDCX_ADDRESS=<fill>
NEXT_PUBLIC_REGISTRY_ADDRESS=<fill after deploy>
NEXT_PUBLIC_VAULT_FACTORY_ADDRESS=<fill after deploy>
SWARM_BEE_URL=http://localhost:1633       # server-only — never NEXT_PUBLIC_
SWARM_POSTAGE_BATCH_ID=<from booth>      # server-only — never NEXT_PUBLIC_
NEXT_PUBLIC_SWARM_GATEWAY=https://api.gateway.ethswarm.org
APIFY_TOKEN=<from dashboard>
NEXT_PUBLIC_WC_PROJECT_ID=<WalletConnect Cloud>
```

---

## Common Commands

```bash
# Frontend (the whole app — there is no separate backend process)
cd frontend && npm install && npm run dev

# Contracts
cd contracts
forge build
forge test
forge script script/Deploy.s.sol --rpc-url https://sepolia.base.org --private-key $DEPLOYER_KEY --broadcast --verify
```

---

## Data Schemas

### Post Metadata (stored as JSON in Swarm Feed)
```typescript
interface PostMetadata {
  id: string            // UUID
  title: string
  excerpt: string       // ≤200 chars, always public
  content_type: 'video' | 'text' | 'image'
  thumbnail_cid: string // public, unencrypted
  manifest_cid?: string // encrypted HLS manifest CID (video)
  body_cid?: string     // encrypted text blob CID (text)
  duration_seconds?: number
  published_at: number  // unix timestamp
  paid: boolean
  creator_address: string
}
```

### ENS Text Record Keys
- `swarm-feed` — Swarm Feed root CID (hex)
- `price` — subscription price as USDC/month string (e.g. `"10"`)
- `description` — creator bio
- `thumbnail` — public thumbnail Swarm CID
- `stealth-meta` — EIP-5564 stealth meta-address

---

## Key Delivery Protocol (critical — read this)

1. Creator generates random AES-256-GCM key `K` per post.
2. Content encrypted with `K` → uploaded to Swarm via `/api/swarm/upload` → `postCID`.
3. For each subscriber, `lookupAddress = keccak256(creatorAddr + subscriberAddr + postCID)`.
4. Creator signs `"noctwave-key-slot:{subscriberAddr}:{postCID}"` → derives `slotSecret` → encrypts `K` with `slotSecret`.
5. Encrypted `K` uploaded to Swarm; reference written to a **Swarm Feed** at `topic = keccak256Hash("noctwave-key:" + lookupAddress)`, owner = creator address.
6. This runs in the creator's browser from `syncSubscriberKeys()` called on dashboard load — **no persistent backend process**.
7. Subscriber calls `fetchEncryptedKey()` from `keyDelivery.ts` → reads Swarm Feed directly from gateway (no API call).
8. Subscriber decrypts `K` via `signMessageAsync` → decrypts content.

**Key delivery timing:** Happens when the creator next opens their dashboard after a new subscriber joins. Not real-time, but correct for the demo (creator opens dashboard during the demo).

---

## API Routes

One server-side route only. Everything else is client-side.

| Route | Method | Purpose |
|---|---|---|
| `/api/swarm/upload` | POST | Server-side proxy: forwards binary data to Bee node, returns Swarm CID |

**Not API routes (all client-side):**
- Creator list: `getLogs({ eventName: 'NameRegistered' })` via wagmi
- Subscriber key fetch: `fetchEncryptedKey()` reads Swarm Feed via public gateway
- Key sync: `syncSubscriberKeys()` runs in creator's browser on dashboard load
- Subscription check: `useReadContract({ functionName: 'getFlowrate' })`

---

## Developer Ownership

| Area | Owner |
|---|---|
| Smart contracts | Dev A |
| `frontend/src/lib/crypto.ts` | Dev A |
| `frontend/src/lib/stealth.ts` | Dev A |
| `frontend/src/lib/swarmClient.ts` | Dev A |
| `frontend/src/lib/keyDelivery.ts` | Dev A |
| `frontend/src/app/api/swarm/upload/route.ts` | Dev A |
| Creator dashboard key sync wiring | Dev A |
| Next.js app, all other UI | Dev B |
| Wagmi contract hooks | Dev B |
| Video pipeline (`useVideoUpload`) | Dev B |

Integration checkpoints are defined in `PRD.md` Section 11.

---

## Priority Order for Demo

If behind, cut in this order (from PRD Section 9 of NOCTWAVE.md):

**Never cut:**
- Swarm content publish + display
- Superfluid per-second streaming + real-time balance counter
- ENS name registration
- Content encryption/decryption (one wallet prompt to unlock)
- Cancel-anytime with instant stream stop

**Cut first:**
- In-browser ffmpeg.wasm → pre-upload a test video, hardcode its CID
- Stealth address wiring (describe concept, show generation in UI)
- CommitmentVault

**Cut second:**
- No-loss yield vault (describe in pitch, skip the build)
- XMTP chat (mention as roadmap)
- Apify discovery (show static list)

---

## Footguns & Known Issues

- **ffmpeg.wasm requires SharedArrayBuffer** → needs CORP/COEP headers in `next.config.ts`. Without them it fails silently or with a cryptic error.
- **USDCx is 18 decimals, USDC is 6.** The flow rate must use `1e18`, not `1e6`. This is a common bug.
- **Swarm writes go through `/api/swarm/upload`, not the browser directly.** The Bee node is on `localhost:1633` and unreachable from the browser. All write calls must go through the Next.js API route. If you get CORS errors or connection refused on Swarm writes, you're hitting the Bee node from the browser — fix the call site.
- **`SWARM_BEE_URL` and `SWARM_POSTAGE_BATCH_ID` are server-only.** Never prefix them with `NEXT_PUBLIC_`. They must only appear in the `/api/swarm/upload` route, never in client components or `lib/`.
- **Wagmi `createFlow` sender field.** When using `CFAv1Forwarder.createFlow`, pass `address(0)` as sender — the forwarder uses `msg.sender`. Passing the user's address causes a revert.
- **XMTP client must be initialized once per session.** Don't recreate it on every render — store in a ref or context.
- **HLS.js custom loader.** The decrypt-on-the-fly loader must call the original `onSuccess` callback after decryption, not before — easy to get ordering wrong.
- **Swarm Feed updates overwrite previous index.** The feed stores the latest CID only — fetch the current feed root, append the new post to the JSON array, then write the updated array back. Don't lose existing posts.
- **Key delivery is not real-time.** The creator must open their dashboard for `syncSubscriberKeys` to run. During the demo, open the creator dashboard right after the subscriber subscribes.
- **Postage stamp TTL.** Get a batch with high TTL from Áron Soós at the Swarm booth before the demo. A batch that expires mid-demo ends the demo.
