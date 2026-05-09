# Noctwave — Product Requirements Document
### ETHPrague 2026 · Two-Developer Build

---

## 0. How to Use This Document

This PRD is the single source of truth for implementation. It is written to be used directly with Claude Code. Every section is actionable: exact package names, contract function signatures, API endpoints, and data schemas are specified. When in doubt, refer to this document before the design doc (`NOCTWAVE_v2.md`).

**Developer A** owns: smart contracts, backend key-delivery service, Swarm upload service, Apify actor.  
**Developer B** owns: Next.js frontend, all UI flows, wallet connection, video pipeline, Superfluid stream UI.  

Shared code lives in `/src/lib/` and is built collaboratively. Integration points are defined in Section 8.

---

## 1. Project Overview

**Product:** A censorship-resistant publishing platform. Creators upload video/text to Swarm (encrypted). Subscribers pay per-second via Superfluid streaming. Content decrypts on-demand via ECDH. Payments are private via EIP-5564 stealth addresses.

**Chain:** Base Sepolia testnet  
**Repo layout:** monorepo — `/contracts`, `/backend`, `/frontend`  
**Target demo time:** ~36 hours of build

---

## 1a. Chain Reference — Base Sepolia

**Chain ID:** `84532`  
**RPC:** `https://sepolia.base.org`  
**Block explorer:** `https://sepolia.basescan.org`  
**Faucet:** `https://faucet.quicknode.com/base/sepolia`

All contracts deploy here. All frontend wallet config points here. No other chains.

| Contract / Service | Address on Base Sepolia |
|---|---|
| CFAv1Forwarder (Superfluid) | `0xcfA132E353cB4E398080B9700609bb008eceB125` |
| Superfluid Host | `0x4C073B3baB6d8826b8C5b229f3cfdC1eC6E47E74` |
| USDC | `0x036CbD53842c5426634e7929541eC2318f3dCF7e` |
| USDCx (Super Token) | Check [app.superfluid.finance](https://app.superfluid.finance) for Base Sepolia wrapper |
| NoctwaveRegistry | `<fill after Dev A deploys>` |
| VaultFactory | `<fill after Dev A deploys>` |

**Wagmi config (single chain, no switching):**
```typescript
import { baseSepolia } from 'wagmi/chains'

const config = getDefaultConfig({
  appName: 'Noctwave',
  projectId: process.env.NEXT_PUBLIC_WC_PROJECT_ID!,
  chains: [baseSepolia],   // Base Sepolia only
  ssr: true,
})
```

---

## 2. Repository Structure

```
noctwave/
├── contracts/                    # Dev A — Foundry project
│   ├── src/
│   │   ├── NoctwaveRegistry.sol
│   │   └── SubscriptionVault.sol
│   ├── script/
│   │   └── Deploy.s.sol
│   ├── test/
│   └── foundry.toml
│
└── frontend/                     # Next.js app — all logic lives here
    ├── src/
    │   ├── app/
    │   │   ├── page.tsx                      # Landing / discovery (reads contract events directly)
    │   │   ├── api/
    │   │   │   └── swarm/
    │   │   │       └── upload/route.ts        # Server-side Swarm upload proxy (accesses Bee node)
    │   │   ├── creator/
    │   │   │   ├── onboard/page.tsx           # Creator setup
    │   │   │   └── [ens]/page.tsx             # Creator dashboard (runs key sync on load)
    │   │   └── watch/
    │   │       └── [ens]/[postId]/page.tsx    # Post viewer
    │   ├── components/
    │   ├── hooks/
    │   └── lib/                              # All shared modules
    │       ├── crypto.ts                     # AES-GCM encrypt/decrypt + key derivation
    │       ├── stealth.ts                    # EIP-5564 stealth addresses
    │       ├── swarmClient.ts               # bee-js wrapper (reads via gateway, writes via API route)
    │       └── keyDelivery.ts               # Key sync logic — called from creator dashboard
    ├── package.json
    └── next.config.ts
```

---

## 3. Tech Stack — Exact Packages

### Frontend (`frontend/package.json`)

```json
{
  "dependencies": {
    "next": "15.x",
    "react": "19.x",
    "wagmi": "^2.14",
    "viem": "^2.21",
    "@rainbow-me/rainbowkit": "^2.2",
    "@tanstack/react-query": "^5.62",
    "@ethersphere/bee-js": "^8.x",
    "@ffmpeg/ffmpeg": "^0.12.x",
    "@ffmpeg/util": "^0.12.x",
    "hls.js": "^1.5.x",
    "@xmtp/xmtp-js": "^12.x",
    "@noble/secp256k1": "^2.1",
    "@noble/hashes": "^1.6",
    "apify-client": "^2.9",
    "ethers": "^6.13"
  }
}
```

> **Note on ffmpeg.wasm:** Requires `next.config.ts` to set `headers` for `Cross-Origin-Opener-Policy: same-origin` and `Cross-Origin-Embedder-Policy: require-corp` — SharedArrayBuffer is required.

> **No separate backend package.** All logic — Swarm I/O, key delivery, Apify — runs inside the Next.js app. Swarm writes that need a Bee node are proxied through a Next.js API route (`/api/swarm/upload`). Everything else runs in the browser.

### Contracts

```
forge init contracts
cd contracts
forge install OpenZeppelin/openzeppelin-contracts
forge install superfluid-finance/ethereum-contracts
```

---

## 4. Environment Variables

```bash
# .env (frontend reads from this; Next.js loads it automatically)

# Chain
NEXT_PUBLIC_CHAIN_ID=84532          # Base Sepolia
NEXT_PUBLIC_RPC_URL=https://sepolia.base.org

# Superfluid — same address on ALL EVM networks
NEXT_PUBLIC_CFA_FORWARDER=0xcfA132E353cB4E398080B9700609bb008eceB125

# Tokens on Base Sepolia
NEXT_PUBLIC_USDC_ADDRESS=0x036CbD53842c5426634e7929541eC2318f3dCF7e
# USDCx (Super Token) — wrap USDC before streaming
# Deploy via Superfluid dashboard or use existing wrapper on Base Sepolia
NEXT_PUBLIC_USDCX_ADDRESS=<deploy_or_find>

# Deployed contracts (fill after Dev A deploys)
NEXT_PUBLIC_REGISTRY_ADDRESS=<deployed>
NEXT_PUBLIC_VAULT_FACTORY_ADDRESS=<deployed>

# Swarm
SWARM_BEE_URL=http://localhost:1633          # or hosted Bee endpoint from gift code
SWARM_POSTAGE_BATCH_ID=<from_gift_code>      # Get from Áron Soós at booth
NEXT_PUBLIC_SWARM_GATEWAY=https://api.gateway.ethswarm.org

# Backend private key (for key delivery service — NOT the user's key)
KEY_DELIVERY_PRIVATE_KEY=<backend_hot_wallet>

# Apify (if building agent)
APIFY_TOKEN=<from_apify_dashboard>

# XMTP env
NEXT_PUBLIC_XMTP_ENV=dev                     # or 'production'
```

---

## 5. Smart Contracts — Dev A

### 5.1 `NoctwaveRegistry.sol`

Registers creators and issues ENS-style subnames. For the hackathon this is a standalone registry (not a real ENS registrar) that stores `name → wallet` mappings and emits events that the frontend reads.

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

contract NoctwaveRegistry {
    // name e.g. "alice" → registered wallet
    mapping(string => address) public nameToOwner;
    mapping(address => string) public ownerToName;

    // ENS text records stored on-chain for simplicity
    // key: keccak256(name + recordKey) → value
    mapping(bytes32 => string) public textRecords;

    event NameRegistered(string indexed name, address indexed owner);
    event TextRecordSet(string indexed name, string key, string value);

    error NameTaken();
    error NotOwner();

    function register(string calldata name) external {
        if (nameToOwner[name] != address(0)) revert NameTaken();
        nameToOwner[name] = msg.sender;
        ownerToName[msg.sender] = name;
        emit NameRegistered(name, msg.sender);
    }

    function setTextRecord(string calldata name, string calldata key, string calldata value) external {
        if (nameToOwner[name] != msg.sender) revert NotOwner();
        textRecords[keccak256(abi.encodePacked(name, key))] = value;
        emit TextRecordSet(name, key, value);
    }

    function getTextRecord(string calldata name, string calldata key) external view returns (string memory) {
        return textRecords[keccak256(abi.encodePacked(name, key))];
    }

    // Resolve name → address
    function resolve(string calldata name) external view returns (address) {
        return nameToOwner[name];
    }
}
```

**Text record keys used by the app:**
- `"swarm-feed"` → Swarm Feed root CID (hex)
- `"price"` → subscription price in USDC/month as string (e.g. `"10"`)
- `"description"` → creator bio
- `"thumbnail"` → public thumbnail Swarm CID
- `"stealth-meta"` → EIP-5564 stealth meta-address

---

### 5.2 `SubscriptionVault.sol`

One vault is deployed per creator. Superfluid streams flow into this contract. It also stores which subscriber addresses have active streams, used by the backend key delivery service.

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { ISuperToken } from "@superfluid-finance/ethereum-contracts/contracts/interfaces/superfluid/ISuperToken.sol";
import { SuperTokenV1Library } from "@superfluid-finance/ethereum-contracts/contracts/apps/SuperTokenV1Library.sol";

contract SubscriptionVault {
    using SuperTokenV1Library for ISuperToken;

    address public creator;
    ISuperToken public acceptedToken;   // USDCx
    int96 public requiredFlowRate;      // minimum wei/sec to be considered subscribed

    // Track subscriber stealth addresses for key delivery
    // stealthAddress → true if they have an active stream
    mapping(address => bool) public activeSubscribers;
    address[] public subscriberList;

    event SubscriberAdded(address indexed subscriber);
    event SubscriberRemoved(address indexed subscriber);

    constructor(address _creator, address _token, int96 _flowRate) {
        creator = _creator;
        acceptedToken = ISuperToken(_token);
        requiredFlowRate = _flowRate;
    }

    // Called by Superfluid protocol when a stream is opened/updated/deleted
    // Implement as a SuperApp callback or use CFAv1Forwarder events off-chain
    // For hackathon: backend listens to CFAv1Forwarder FlowUpdated events
    // and calls this function to sync state
    function recordSubscriber(address subscriber, bool active) external {
        // Only callable by backend key delivery hot wallet OR self
        // For hackathon: open access (add auth in production)
        if (active && !activeSubscribers[subscriber]) {
            activeSubscribers[subscriber] = true;
            subscriberList.push(subscriber);
            emit SubscriberAdded(subscriber);
        } else if (!active && activeSubscribers[subscriber]) {
            activeSubscribers[subscriber] = false;
            emit SubscriberRemoved(subscriber);
        }
    }

    function isSubscribed(address subscriber) external view returns (bool) {
        return activeSubscribers[subscriber];
    }

    function getSubscribers() external view returns (address[] memory) {
        return subscriberList;
    }
}
```

**Key note on Superfluid streams to this vault:**
Streams are opened directly from subscriber wallet to `vault.address` using the `CFAv1Forwarder` contract. The vault does not need to be a SuperApp to receive streams — streams can flow to any address. The backend detects them via event listening.

**Flow rate calculation:**
```
// $10/month = 10 USDC/month
// USDC has 6 decimals → 10 * 1e6 = 10_000_000 per month
// seconds per month ≈ 2_592_000
// flowRate = 10_000_000 / 2_592_000 ≈ 3858 wei/sec (6 decimal USDC)
// But USDCx wraps USDC to 18 decimals:
// flowRate = (10 * 1e18) / 2_592_000 ≈ 3_858_024_691_358 wei/sec
```

---

### 5.3 `VaultFactory.sol`

Simple factory so each creator deploys their own vault in one transaction from the frontend.

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./SubscriptionVault.sol";

contract VaultFactory {
    mapping(address => address) public creatorVault;
    event VaultDeployed(address indexed creator, address vault);

    function deploy(address token, int96 flowRate) external returns (address) {
        SubscriptionVault vault = new SubscriptionVault(msg.sender, token, flowRate);
        creatorVault[msg.sender] = address(vault);
        emit VaultDeployed(msg.sender, address(vault));
        return address(vault);
    }
}
```

---

### 5.4 Deployment Script (`script/Deploy.s.sol`)

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import "../src/NoctwaveRegistry.sol";
import "../src/VaultFactory.sol";

contract Deploy is Script {
    function run() external {
        vm.startBroadcast();
        NoctwaveRegistry registry = new NoctwaveRegistry();
        VaultFactory factory = new VaultFactory();
        console.log("Registry:", address(registry));
        console.log("VaultFactory:", address(factory));
        vm.stopBroadcast();
    }
}
```

Deploy command:
```bash
forge script script/Deploy.s.sol \
  --rpc-url https://sepolia.base.org \
  --private-key $DEPLOYER_KEY \
  --broadcast \
  --verify
```

---

## 6. Frontend Library Modules — Dev A

### 6.1 Swarm Client (`frontend/src/lib/swarmClient.ts`)

All Swarm I/O goes through this module. Uses `bee-js` v8.

**Reads** (gateway, no auth, runs in browser): fetch via `NEXT_PUBLIC_SWARM_GATEWAY`.  
**Writes** (Bee node, requires postage batch): proxied through `/api/swarm/upload` Next.js route so the Bee node URL never touches the browser. The API route reads `SWARM_BEE_URL` and `SWARM_POSTAGE_BATCH_ID` server-side.

```typescript
import { Bee, Utils } from '@ethersphere/bee-js'

const bee = new Bee(process.env.SWARM_BEE_URL!)
const BATCH_ID = process.env.SWARM_POSTAGE_BATCH_ID!

// Upload arbitrary bytes, return CID (hex reference)
export async function swarmUpload(data: Uint8Array, contentType = 'application/octet-stream'): Promise<string> {
  const result = await bee.uploadData(BATCH_ID, data, { contentType })
  return result.reference  // 64-char hex string
}

// Upload a file with a name (for HLS segments, thumbnails)
export async function swarmUploadFile(data: Uint8Array, filename: string, contentType: string): Promise<string> {
  const result = await bee.uploadFile(BATCH_ID, data, filename, { contentType })
  return result.reference
}

// Upload a directory (HLS manifest + segments)
export async function swarmUploadDirectory(files: { data: Uint8Array, name: string, contentType: string }[]): Promise<string> {
  const fileObjects = files.map(f => ({
    data: f.data,
    name: f.name,
    type: f.contentType,
  }))
  const result = await bee.uploadCollection(BATCH_ID, fileObjects, { indexDocument: 'index.m3u8' })
  return result.reference
}

// Download bytes from gateway (no Bee node needed for reads)
export async function swarmDownload(reference: string): Promise<Uint8Array> {
  const data = await bee.downloadData(reference)
  return data
}

// Public gateway URL for frontend use
export function swarmGatewayUrl(reference: string, path = ''): string {
  const gateway = process.env.NEXT_PUBLIC_SWARM_GATEWAY ?? 'https://api.gateway.ethswarm.org'
  return path ? `${gateway}/bzz/${reference}/${path}` : `${gateway}/bzz/${reference}`
}

// --- Swarm Feeds ---
// topic must be a 32-byte Uint8Array
export async function feedCreate(topic: Uint8Array, ownerWallet: { address: string, sign: (data: Uint8Array) => Promise<Uint8Array> }) {
  const writer = bee.makeFeedWriter('sequence', topic, ownerWallet.address)
  return writer
}

export async function feedUpdate(
  topic: Uint8Array,
  ownerAddress: string,
  data: Uint8Array,
  signer: { sign: (data: Uint8Array) => Promise<Uint8Array> }
) {
  const writer = bee.makeFeedWriter('sequence', topic, ownerAddress, signer)
  const result = await writer.upload(BATCH_ID, data)
  return result
}

export async function feedRead(topic: Uint8Array, ownerAddress: string): Promise<Uint8Array> {
  const reader = bee.makeFeedReader('sequence', topic, ownerAddress)
  const { reference } = await reader.download()
  return bee.downloadData(reference)
}

// Standard topic hashes used by the app
export const TOPICS = {
  CONTENT_ROOT: Utils.keccak256Hash('noctwave-content-root'),   // creator's post index
  PROFILE: Utils.keccak256Hash('noctwave-profile'),
}
```

---

### 6.2 Key Delivery (`frontend/src/lib/keyDelivery.ts`)

No persistent process. Key delivery runs in the **creator's browser** when they open their dashboard. There is no always-on listener.

**Key storage — Swarm Feeds (no backend KV):**  
For each (creator, subscriber, postCID) triple there is a deterministic Swarm Feed:
- topic = `keccak256Hash("noctwave-key:" + lookupAddress)`
- feed owner = creator address (only creator can write)

The subscriber reads the same feed directly from the Swarm gateway — no API call needed.

**Tradeoff vs. real-time event listener:** Key delivery is not instant. It happens the next time the creator opens their dashboard. For the demo this is fine — the creator opens the dashboard after the subscriber subscribes, which is the natural demo flow.

```typescript
// frontend/src/lib/keyDelivery.ts
import { createPublicClient, http, parseAbi } from 'viem'
import { baseSepolia } from 'viem/chains'
import { Bee, Utils } from '@ethersphere/bee-js'
import { encryptKey, computeLookupAddress } from './crypto'

const VAULT_ABI = parseAbi([
  'event SubscriberAdded(address indexed subscriber)',
  'function getSubscribers() view returns (address[])',
])

const client = createPublicClient({ chain: baseSepolia, transport: http(process.env.NEXT_PUBLIC_RPC_URL) })

// Derive the Swarm Feed topic for a specific key slot
function keyFeedTopic(lookupAddress: string): Uint8Array {
  return Utils.keccak256Hash(`noctwave-key:${lookupAddress}`)
}

// Returns all subscribers who have ever opened a stream (from on-chain events)
export async function getSubscribersFromChain(vaultAddress: string): Promise<string[]> {
  const logs = await client.getLogs({
    address: vaultAddress as `0x${string}`,
    event: { type: 'event', name: 'SubscriberAdded', inputs: [{ type: 'address', name: 'subscriber', indexed: true }] },
    fromBlock: 0n,
  })
  return [...new Set(logs.map(log => log.args.subscriber as string))]
}

// Called from creator dashboard on load.
// postKeys: Map<postCID, rawContentKeyK>
// feedSigner: creator's wallet signer (from useSignMessage / wagmi)
// encryptForSubscriber: fn that encrypts K for a given subscriber address
export async function syncSubscriberKeys(params: {
  creatorAddress: string
  vaultAddress: string
  postKeys: Map<string, Uint8Array>
  bee: Bee
  batchId: string
  feedSigner: { address: string; sign: (data: Uint8Array) => Promise<Uint8Array> }
  encryptForSubscriber: (contentKey: Uint8Array, subscriberAddress: string, postCID: string) => Promise<Uint8Array>
}) {
  const { creatorAddress, vaultAddress, postKeys, bee, batchId, feedSigner, encryptForSubscriber } = params
  const subscribers = await getSubscribersFromChain(vaultAddress)

  for (const subscriber of subscribers) {
    for (const [postCID, contentKey] of postKeys.entries()) {
      const lookupAddress = computeLookupAddress(creatorAddress, subscriber, postCID)
      const topic = keyFeedTopic(lookupAddress)

      // Skip if already delivered
      try {
        const reader = bee.makeFeedReader('sequence', topic, feedSigner.address)
        await reader.download()
        continue
      } catch {
        // Not yet written — fall through
      }

      const encryptedKey = await encryptForSubscriber(contentKey, subscriber, postCID)
      const { reference } = await bee.uploadData(batchId, encryptedKey)

      const writer = bee.makeFeedWriter('sequence', topic, feedSigner.address, feedSigner)
      await writer.upload(batchId, new TextEncoder().encode(reference))
    }
  }
}

// Called from subscriber's browser — reads directly from Swarm, no API call
export async function fetchEncryptedKey(params: {
  creatorAddress: string
  subscriberAddress: string
  postCID: string
  gatewayUrl: string
}): Promise<Uint8Array | null> {
  const { creatorAddress, subscriberAddress, postCID, gatewayUrl } = params
  const lookupAddress = computeLookupAddress(creatorAddress, subscriberAddress, postCID)
  const topic = keyFeedTopic(lookupAddress)

  // Read the feed via public gateway (no Bee node, no API)
  const bee = new Bee(gatewayUrl)
  try {
    const reader = bee.makeFeedReader('sequence', topic, creatorAddress)
    const { reference } = await reader.download()
    return bee.downloadData(reference)
  } catch {
    return null  // creator hasn't synced yet
  }
}
```

**`encryptForSubscriber` implementation (creator's dashboard page):**

Since the creator cannot sign on behalf of the subscriber, key wrapping uses a creator-derived secret per slot:

```typescript
// In the creator dashboard component:
const { signMessageAsync } = useSignMessage()

const encryptForSubscriber = async (contentKey: Uint8Array, subscriberAddress: string, postCID: string) => {
  // Creator signs a deterministic per-slot message → unique secret only creator can produce
  const sig = await signMessageAsync({
    message: `noctwave-key-slot:${subscriberAddress.toLowerCase()}:${postCID}`
  })
  const slotSecret = toBytes(keccak256(toBytes(sig as `0x${string}`)))
  return encryptKey(contentKey, slotSecret)
}
```

**Subscriber decryption (post viewer page):**

The subscriber requests the same slot secret from the creator indirectly — they sign a paired message and the creator's signature wraps a key that can only be verified by matching lookup. For the hackathon, the subscriber fetches the encrypted key from Swarm and decrypts using `deriveSharedSecret` (their own `signMessageAsync` call), which produces the matching entropy because both messages hash to the same `lookupAddress`-derived nonce.

> **Hackathon simplification acknowledged:** The symmetric scheme here provides access control via on-chain stream verification, not pure cryptographic separation. Proper ECDH (subscriber registers a public key, creator uses ECDH) is the production path.

---

### 6.3 Crypto Module (`frontend/src/lib/crypto.ts`) — **Shared, built by Dev A**

This is the core encryption/decryption module. All app code imports from it.

```typescript
import { keccak256, toBytes, concat, toHex } from 'viem'
import * as secp from '@noble/secp256k1'
import { sha256 } from '@noble/hashes/sha256'

// Compute the deterministic Swarm lookup address for a subscriber's key
export function computeLookupAddress(
  creatorAddress: string,
  subscriberAddress: string,
  postCID: string
): string {
  return keccak256(concat([
    toBytes(creatorAddress),
    toBytes(subscriberAddress),
    toBytes(postCID as `0x${string}`)
  ]))
}

// Derive shared secret from subscriber's wallet signature
// Called on the SUBSCRIBER side in the frontend
export async function deriveSharedSecret(
  creatorAddress: string,
  postCID: string,
  signMessage: (message: string) => Promise<string>
): Promise<Uint8Array> {
  const message = `noctwave-decrypt:${creatorAddress.toLowerCase()}:${postCID}`
  const signature = await signMessage(message)
  return toBytes(keccak256(toBytes(signature as `0x${string}`)))
}

// Encrypt content key K for a subscriber — called on CREATOR side in backend
// Uses ECDH: shared secret = keccak256(subscriber's signing key material)
// For hackathon simplicity: we use a deterministic signing approach
// Creator's backend cannot derive the subscriber's private key, so:
// We use a creator-side ECDH: sharedSecret = creator_privkey * subscriber_pubkey
// But since we don't have subscriber pubkey at upload time easily,
// we use the symmetric approach: store the raw key encrypted with AES
// using the lookupAddress as a key derivation input (known to subscriber too)
// SIMPLIFIED FOR HACKATHON: Store key encrypted with keccak256(lookupAddress + creatorSecret)
// Subscriber derives the same value using signMessage
export async function encryptKey(
  contentKey: Uint8Array,
  sharedSecret: Uint8Array
): Promise<Uint8Array> {
  // AES-256-GCM encryption
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const cryptoKey = await crypto.subtle.importKey(
    'raw', sharedSecret.slice(0, 32), { name: 'AES-GCM' }, false, ['encrypt']
  )
  const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, cryptoKey, contentKey)
  // Prepend IV to ciphertext
  const result = new Uint8Array(12 + encrypted.byteLength)
  result.set(iv, 0)
  result.set(new Uint8Array(encrypted), 12)
  return result
}

export async function decryptKey(
  encryptedKey: Uint8Array,
  sharedSecret: Uint8Array
): Promise<Uint8Array> {
  const iv = encryptedKey.slice(0, 12)
  const ciphertext = encryptedKey.slice(12)
  const cryptoKey = await crypto.subtle.importKey(
    'raw', sharedSecret.slice(0, 32), { name: 'AES-GCM' }, false, ['decrypt']
  )
  const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, cryptoKey, ciphertext)
  return new Uint8Array(decrypted)
}

// Encrypt content (video segment, post body, image)
export async function encryptContent(
  data: Uint8Array,
  contentKey: Uint8Array
): Promise<{ ciphertext: Uint8Array; iv: Uint8Array }> {
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const cryptoKey = await crypto.subtle.importKey(
    'raw', contentKey, { name: 'AES-GCM' }, false, ['encrypt']
  )
  const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, cryptoKey, data)
  return { ciphertext: new Uint8Array(encrypted), iv }
}

export async function decryptContent(
  ciphertext: Uint8Array,
  iv: Uint8Array,
  contentKey: Uint8Array
): Promise<Uint8Array> {
  const cryptoKey = await crypto.subtle.importKey(
    'raw', contentKey, { name: 'AES-GCM' }, false, ['decrypt']
  )
  const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, cryptoKey, ciphertext)
  return new Uint8Array(decrypted)
}

// Generate random 32-byte AES content key
export function generateContentKey(): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(32))
}
```

**Shared secret protocol (how creator encrypts for subscriber):**

Since the backend cannot call `signMessage` on behalf of the subscriber, we use a symmetric trick:

1. Creator stores the content key encrypted with `keccak256(lookupAddress)` as the "public wrapping key"
2. Subscriber derives the same `lookupAddress = keccak256(creatorAddr + subscriberAddr + postCID)` — they know all three values
3. Subscriber signs `"noctwave-decrypt:{creatorAddress}:{postCID}"` to get entropy, then uses that to derive the final decryption key

> This means the creator's backend must also know the subscriber's address at publish time. This is fine because the subscriber's stream sender address (their stealth address) is visible on-chain.

---

### 6.4 EIP-5564 Stealth Addresses (`frontend/src/lib/stealth.ts`) — Shared, Dev A implements

```typescript
import * as secp from '@noble/secp256k1'
import { keccak256, toBytes, toHex } from 'viem'

// Parse stealth meta-address: "st:eth:0x{spendPubKey}{viewPubKey}"
export function parseStealthMetaAddress(metaAddress: string): {
  spendingPublicKey: Uint8Array
  viewingPublicKey: Uint8Array
} {
  // Strip "st:eth:0x" prefix
  const hex = metaAddress.replace('st:eth:0x', '')
  const spendingPublicKey = toBytes(`0x${hex.slice(0, 66)}`)  // 33 bytes compressed
  const viewingPublicKey = toBytes(`0x${hex.slice(66)}`)      // 33 bytes compressed
  return { spendingPublicKey, viewingPublicKey }
}

// Generate a stealth meta-address from two public keys
export function generateStealthMetaAddress(
  spendingPublicKey: Uint8Array,
  viewingPublicKey: Uint8Array
): string {
  return `st:eth:0x${toHex(spendingPublicKey).slice(2)}${toHex(viewingPublicKey).slice(2)}`
}

// EIP-5564 Scheme 1 (SECP256k1)
// Sender calls this with recipient's stealth meta-address
export function generateStealthAddress(stealthMetaAddress: string): {
  stealthAddress: string
  ephemeralPublicKey: Uint8Array
  viewTag: number
} {
  const { spendingPublicKey, viewingPublicKey } = parseStealthMetaAddress(stealthMetaAddress)

  // Generate ephemeral keypair
  const ephemeralPrivKey = secp.utils.randomPrivateKey()
  const ephemeralPubKey = secp.getPublicKey(ephemeralPrivKey, true)  // compressed

  // Shared secret: ECDH(ephemeralPrivKey, viewingPublicKey)
  const sharedSecretPoint = secp.getSharedSecret(ephemeralPrivKey, viewingPublicKey)
  const sharedSecret = keccak256(toBytes(toHex(sharedSecretPoint.slice(1, 33))))  // hash x-coordinate

  // View tag = first byte of shared secret
  const viewTag = toBytes(sharedSecret)[0]

  // Stealth public key = spendingPublicKey + sharedSecret * G
  const sharedSecretScalar = BigInt(sharedSecret)
  const spendPoint = secp.ProjectivePoint.fromHex(toHex(spendingPublicKey).slice(2))
  const addend = secp.ProjectivePoint.BASE.multiply(sharedSecretScalar)
  const stealthPoint = spendPoint.add(addend)
  const stealthPublicKey = stealthPoint.toRawBytes(true)

  // Derive stealth address from stealth public key
  const stealthAddress = publicKeyToAddress(stealthPublicKey)

  return { stealthAddress, ephemeralPublicKey: ephemeralPubKey, viewTag }
}

// Recipient checks if an announcement belongs to them
export function checkStealthAddress(
  ephemeralPublicKey: Uint8Array,
  viewTag: number,
  viewingPrivateKey: Uint8Array,
  spendingPublicKey: Uint8Array
): { isForMe: boolean; stealthAddress?: string } {
  const sharedSecretPoint = secp.getSharedSecret(viewingPrivateKey, ephemeralPublicKey)
  const sharedSecret = keccak256(toBytes(toHex(sharedSecretPoint.slice(1, 33))))

  if (toBytes(sharedSecret)[0] !== viewTag) return { isForMe: false }

  const sharedSecretScalar = BigInt(sharedSecret)
  const spendPoint = secp.ProjectivePoint.fromHex(toHex(spendingPublicKey).slice(2))
  const addend = secp.ProjectivePoint.BASE.multiply(sharedSecretScalar)
  const stealthPoint = spendPoint.add(addend)
  const stealthPublicKey = stealthPoint.toRawBytes(true)
  const stealthAddress = publicKeyToAddress(stealthPublicKey)

  return { isForMe: true, stealthAddress }
}

function publicKeyToAddress(publicKey: Uint8Array): string {
  const hash = keccak256(publicKey.slice(1))  // keccak256 of uncompressed pubkey without 04 prefix
  return `0x${hash.slice(-40)}`
}
```

---

## 7. Frontend — Dev B

### 7.1 App Setup (`frontend/src/app/`)

**`layout.tsx`** — Root layout with RainbowKit + Wagmi providers:

```typescript
'use client'
import { RainbowKitProvider, getDefaultConfig } from '@rainbow-me/rainbowkit'
import { WagmiProvider } from 'wagmi'
import { baseSepolia } from 'wagmi/chains'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import '@rainbow-me/rainbowkit/styles.css'

const config = getDefaultConfig({
  appName: 'Noctwave',
  projectId: process.env.NEXT_PUBLIC_WC_PROJECT_ID!,  // WalletConnect Cloud project ID
  chains: [baseSepolia],
  ssr: true,
})

const queryClient = new QueryClient()

export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        <WagmiProvider config={config}>
          <QueryClientProvider client={queryClient}>
            <RainbowKitProvider>
              {children}
            </RainbowKitProvider>
          </QueryClientProvider>
        </WagmiProvider>
      </body>
    </html>
  )
}
```

**`next.config.ts`** — Required for ffmpeg.wasm SharedArrayBuffer:

```typescript
const nextConfig = {
  async headers() {
    return [{
      source: '/(.*)',
      headers: [
        { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
        { key: 'Cross-Origin-Embedder-Policy', value: 'require-corp' },
      ],
    }]
  },
}
export default nextConfig
```

---

### 7.2 Wagmi Contract Hooks (`frontend/src/hooks/useContracts.ts`)

```typescript
import { useReadContract, useWriteContract, useWatchContractEvent } from 'wagmi'
import { parseAbi } from 'viem'

const REGISTRY_ABI = parseAbi([
  'function register(string name) external',
  'function setTextRecord(string name, string key, string value) external',
  'function getTextRecord(string name, string key) view returns (string)',
  'function resolve(string name) view returns (address)',
  'event NameRegistered(string indexed name, address indexed owner)',
])

const VAULT_FACTORY_ABI = parseAbi([
  'function deploy(address token, int96 flowRate) external returns (address)',
  'function creatorVault(address) view returns (address)',
])

const CFA_FORWARDER_ABI = parseAbi([
  'function createFlow(address token, address sender, address receiver, int96 flowRate, bytes userData) external returns (bool)',
  'function deleteFlow(address token, address sender, address receiver, bytes userData) external returns (bool)',
  'function getFlowrate(address token, address sender, address receiver) view returns (int96)',
  'event FlowUpdated(address indexed token, address indexed sender, address indexed receiver, int96 flowRate, int256 totalSenderFlowRate, int256 totalReceiverFlowRate, bytes userData)',
])

export function useRegistry() {
  const { writeContractAsync } = useWriteContract()
  const registryAddress = process.env.NEXT_PUBLIC_REGISTRY_ADDRESS as `0x${string}`

  return {
    register: (name: string) => writeContractAsync({
      address: registryAddress,
      abi: REGISTRY_ABI,
      functionName: 'register',
      args: [name],
    }),
    setTextRecord: (name: string, key: string, value: string) => writeContractAsync({
      address: registryAddress,
      abi: REGISTRY_ABI,
      functionName: 'setTextRecord',
      args: [name, key, value],
    }),
  }
}

export function useCFAForwarder() {
  const { writeContractAsync } = useWriteContract()
  const CFA_ADDRESS = '0xcfA132E353cB4E398080B9700609bb008eceB125'

  const openStream = (receiverVault: string, flowRate: bigint) =>
    writeContractAsync({
      address: CFA_ADDRESS,
      abi: CFA_FORWARDER_ABI,
      functionName: 'createFlow',
      args: [
        process.env.NEXT_PUBLIC_USDCX_ADDRESS as `0x${string}`,
        '0x', // sender = msg.sender, pass address(0) or use forwarder pattern
        receiverVault as `0x${string}`,
        BigInt(flowRate),
        '0x',
      ],
    })

  const closeStream = (receiverVault: string) =>
    writeContractAsync({
      address: CFA_ADDRESS,
      abi: CFA_FORWARDER_ABI,
      functionName: 'deleteFlow',
      args: [
        process.env.NEXT_PUBLIC_USDCX_ADDRESS as `0x${string}`,
        '0x',
        receiverVault as `0x${string}`,
        '0x',
      ],
    })

  return { openStream, closeStream }
}

// Helper: convert monthly USDC price to flow rate
export function monthlyToFlowRate(usdcPerMonth: number): bigint {
  // USDCx has 18 decimals
  const monthlyWei = BigInt(Math.floor(usdcPerMonth * 1e18))
  const secondsPerMonth = BigInt(2_592_000)
  return monthlyWei / secondsPerMonth
}
```

---

### 7.3 Video Upload Hook (`frontend/src/hooks/useVideoUpload.ts`)

```typescript
import { FFmpeg } from '@ffmpeg/ffmpeg'
import { fetchFile, toBlobURL } from '@ffmpeg/util'
import { useState, useRef } from 'react'

export function useVideoUpload() {
  const ffmpegRef = useRef(new FFmpeg())
  const [progress, setProgress] = useState(0)
  const [stage, setStage] = useState<'idle' | 'transcoding' | 'uploading' | 'done'>('idle')

  async function loadFFmpeg() {
    const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd'
    const ffmpeg = ffmpegRef.current
    if (ffmpeg.loaded) return
    await ffmpeg.load({
      coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
      wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
    })
    ffmpeg.on('progress', ({ progress: p }) => setProgress(Math.round(p * 100)))
  }

  async function transcodeAndUpload(
    file: File,
    contentKey: Uint8Array,
    uploadToSwarm: (data: Uint8Array, filename: string) => Promise<string>
  ): Promise<{ manifestCID: string; thumbnailCID: string }> {
    setStage('transcoding')
    await loadFFmpeg()
    const ffmpeg = ffmpegRef.current

    await ffmpeg.writeFile('input.mp4', await fetchFile(file))

    // Extract thumbnail at 0s
    await ffmpeg.exec(['-i', 'input.mp4', '-ss', '00:00:01', '-vframes', '1', '-q:v', '2', 'thumb.jpg'])

    // Transcode to HLS (single quality tier for hackathon)
    await ffmpeg.exec([
      '-i', 'input.mp4',
      '-c:v', 'libx264', '-crf', '28', '-preset', 'fast',
      '-c:a', 'aac',
      '-hls_time', '6',
      '-hls_list_size', '0',
      '-hls_segment_filename', 'segment%03d.ts',
      'index.m3u8'
    ])

    setStage('uploading')
    const { encryptContent } = await import('../lib/crypto')

    // Upload thumbnail (public — no encryption)
    const thumbData = await ffmpeg.readFile('thumb.jpg') as Uint8Array
    const thumbnailCID = await uploadToSwarm(thumbData, 'thumb.jpg')

    // Read and encrypt each segment, then upload
    const segmentCIDs: string[] = []
    let i = 0
    while (true) {
      const segName = `segment${String(i).padStart(3, '0')}.ts`
      try {
        const segData = await ffmpeg.readFile(segName) as Uint8Array
        const { ciphertext, iv } = await encryptContent(segData, contentKey)
        // Prepend IV to ciphertext before upload
        const blob = new Uint8Array(12 + ciphertext.byteLength)
        blob.set(iv, 0); blob.set(ciphertext, 12)
        const cid = await uploadToSwarm(blob, segName)
        segmentCIDs.push(cid)
        i++
      } catch { break }
    }

    // Build custom manifest that uses Swarm CIDs instead of filenames
    const gateway = process.env.NEXT_PUBLIC_SWARM_GATEWAY
    const manifest = [
      '#EXTM3U',
      '#EXT-X-VERSION:3',
      '#EXT-X-TARGETDURATION:6',
      ...segmentCIDs.flatMap(cid => ['#EXTINF:6.0,', `${gateway}/bzz/${cid}`]),
      '#EXT-X-ENDLIST'
    ].join('\n')

    const manifestCID = await uploadToSwarm(new TextEncoder().encode(manifest), 'index.m3u8')
    setStage('done')

    return { manifestCID, thumbnailCID }
  }

  return { transcodeAndUpload, progress, stage }
}
```

---

### 7.4 Video Player Component (`frontend/src/components/VideoPlayer.tsx`)

```typescript
'use client'
import Hls from 'hls.js'
import { useEffect, useRef } from 'react'
import { decryptContent } from '../lib/crypto'

interface Props {
  manifestCID: string
  contentKey: Uint8Array | null   // null until subscriber decrypts
}

export function VideoPlayer({ manifestCID, contentKey }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const gateway = process.env.NEXT_PUBLIC_SWARM_GATEWAY

  useEffect(() => {
    if (!contentKey || !videoRef.current) return
    const video = videoRef.current

    // Use HLS.js with a custom loader that decrypts segments on the fly
    const hls = new Hls({
      loader: class extends Hls.DefaultConfig.loader {
        load(context, config, callbacks) {
          // Intercept segment requests and decrypt
          super.load(context, config, {
            ...callbacks,
            onSuccess: async (response, stats, context2, networkDetails) => {
              if (context.type === 'fragmentData' && contentKey) {
                const encrypted = new Uint8Array(response.data as ArrayBuffer)
                const iv = encrypted.slice(0, 12)
                const ciphertext = encrypted.slice(12)
                const decrypted = await decryptContent(ciphertext, iv, contentKey)
                response.data = decrypted.buffer
              }
              callbacks.onSuccess(response, stats, context2, networkDetails)
            }
          })
        }
      }
    })

    hls.loadSource(`${gateway}/bzz/${manifestCID}`)
    hls.attachMedia(video)

    return () => hls.destroy()
  }, [manifestCID, contentKey, gateway])

  return <video ref={videoRef} controls style={{ width: '100%' }} />
}
```

---

### 7.5 Pages

#### `app/creator/onboard/page.tsx` — Creator Setup (Dev B)

Steps:
1. Connect wallet (RainbowKit `ConnectButton`)
2. Choose a name → call `registry.register(name)`
3. Set monthly price → call `vaultFactory.deploy(USDCx, flowRate)`
4. Generate stealth meta-address (from wallet's signing key via `generateStealthMetaAddress`)
5. Set ENS text records: `swarm-feed`, `price`, `stealth-meta`
6. Store creator's content key in local state (generated fresh, saved to Swarm KV)

#### `app/creator/[ens]/page.tsx` — Creator Dashboard (Dev B)

- Shows all published posts (read from Swarm Feed)
- Upload video button → `useVideoUpload` → encrypts and uploads → calls backend `/api/publish`
- Shows subscriber count (from vault contract)
- Real-time earnings display (read Superfluid flow rate)

#### `app/watch/[ens]/[postId]/page.tsx` — Post Viewer (Dev B)

Steps:
1. Fetch post metadata from Swarm via Feed
2. Check if subscriber has active stream: `cfaForwarder.getFlowrate(USDCx, subscriber, vault) > 0`
3. If subscribed:
   a. Compute `lookupAddress = computeLookupAddress(creatorAddr, subscriberAddr, postCID)`
   b. Fetch `encryptedKey` from backend `/api/key?lookup={lookupAddress}`
   c. Call `deriveSharedSecret(creatorAddr, postCID, signMessage)`
   d. `contentKey = decryptKey(encryptedKey, sharedSecret)`
   e. Render `<VideoPlayer manifestCID={...} contentKey={contentKey} />`
4. If not subscribed: show `<SubscribeButton vault={vault} flowRate={flowRate} />`

#### `app/page.tsx` — Discovery (Dev B)

Static list of creators (resolved from registry contract events) with thumbnails and descriptions. For hackathon: query `NameRegistered` events from registry contract, resolve each to get Swarm profile data.

---

### 7.6 Subscribe Button Component (`frontend/src/components/SubscribeButton.tsx`)

```typescript
'use client'
import { useState } from 'react'
import { useAccount } from 'wagmi'
import { useCFAForwarder, monthlyToFlowRate } from '../hooks/useContracts'
import { generateStealthAddress } from '../lib/stealth'

interface Props {
  creatorENS: string
  vaultAddress: string
  monthlyPrice: number
  stealthMetaAddress: string
}

export function SubscribeButton({ creatorENS, vaultAddress, monthlyPrice, stealthMetaAddress }: Props) {
  const { address } = useAccount()
  const { openStream } = useCFAForwarder()
  const [subscribing, setSubscribing] = useState(false)

  async function handleSubscribe() {
    setSubscribing(true)
    try {
      // Generate stealth address for privacy
      const { stealthAddress, ephemeralPublicKey, viewTag } = generateStealthAddress(stealthMetaAddress)

      // Open Superfluid stream FROM stealth address TO vault
      // Note: subscriber must fund the stealth address first, or
      // for hackathon simplicity, stream from main wallet to vault
      // and use stealth address for the ENS text record only
      const flowRate = monthlyToFlowRate(monthlyPrice)
      await openStream(vaultAddress, flowRate)

      // Notify backend that subscription is active
      await fetch('/api/subscribe', {
        method: 'POST',
        body: JSON.stringify({
          creatorENS,
          subscriberAddress: address,
          stealthAddress,
          ephemeralPubKey: Array.from(ephemeralPublicKey),
          viewTag,
        })
      })
    } finally {
      setSubscribing(false)
    }
  }

  return (
    <button onClick={handleSubscribe} disabled={subscribing}>
      {subscribing ? 'Subscribing...' : `Subscribe $${monthlyPrice}/month`}
    </button>
  )
}
```

---

### 7.7 Real-time Stream Balance Display (`frontend/src/components/StreamBalance.tsx`)

```typescript
'use client'
import { useEffect, useState } from 'react'
import { useReadContract } from 'wagmi'
import { parseAbi } from 'viem'

// Shows draining balance in real-time — the key visual for judges
export function StreamBalance({ token, sender, receiver }: {
  token: string; sender: string; receiver: string
}) {
  const [displayBalance, setDisplayBalance] = useState('0.000000')

  const { data: flowRate } = useReadContract({
    address: '0xcfA132E353cB4E398080B9700609bb008eceB125',
    abi: parseAbi(['function getFlowrate(address token, address sender, address receiver) view returns (int96)']),
    functionName: 'getFlowrate',
    args: [token as `0x${string}`, sender as `0x${string}`, receiver as `0x${string}`],
    query: { refetchInterval: 5000 }
  })

  useEffect(() => {
    if (!flowRate) return
    const ratePerMs = Number(flowRate) / 1e18 / 1000  // USDCx to USDC per ms

    const interval = setInterval(() => {
      setDisplayBalance(prev => {
        const val = parseFloat(prev) - ratePerMs * 100  // update every 100ms
        return Math.max(0, val).toFixed(6)
      })
    }, 100)

    return () => clearInterval(interval)
  }, [flowRate])

  return (
    <div className="stream-balance">
      <span className="label">Streaming at</span>
      <span className="rate">${(Number(flowRate ?? 0) / 1e18 * 2_592_000).toFixed(2)}/month</span>
      <span className="balance draining">${displayBalance}</span>
    </div>
  )
}
```

---

## 8. API Routes (`frontend/src/app/api/`)

One route only. Everything else runs in the browser directly.

### `POST /api/swarm/upload`

Server-side proxy for Swarm writes. The Bee node (`SWARM_BEE_URL`) is server-only — the browser can't reach it directly (CORS, localhost). This route accepts binary data and forwards it to the Bee node.

```typescript
// Request: raw binary body (application/octet-stream)
// Query params:
//   ?type=data       → bee.uploadData (default)
//   ?type=file&name=index.m3u8&ct=application/vnd.apple.mpegurl → bee.uploadFile

// Response:
{ reference: string }   // 64-char hex Swarm CID
```

**Everything else is client-side:**

| Operation | How |
|---|---|
| Read encrypted content from Swarm | `fetch(NEXT_PUBLIC_SWARM_GATEWAY + '/bzz/' + cid)` — direct in browser |
| Read subscriber's encrypted key | `fetchEncryptedKey()` from `keyDelivery.ts` — reads Swarm Feed via gateway |
| List creators for discovery page | `wagmi getLogs({ eventName: 'NameRegistered' })` — direct RPC call |
| Key sync on subscribe | `syncSubscriberKeys()` called from creator dashboard — runs in browser |
| Check subscription status | `useReadContract({ functionName: 'getFlowrate' })` — wagmi hook |

---

## 9. Data Schemas

### Post Metadata (stored in Swarm Feed as JSON)

```typescript
interface PostMetadata {
  id: string                  // UUID
  title: string
  excerpt: string             // first 200 chars, unencrypted
  content_type: 'video' | 'text' | 'image'
  thumbnail_cid: string       // public, unencrypted
  
  // For video:
  manifest_cid?: string       // encrypted HLS manifest CID
  duration_seconds?: number
  
  // For text:
  body_cid?: string           // encrypted text blob CID
  
  published_at: number        // unix timestamp
  paid: boolean               // false = public, true = subscribers only
  creator_address: string
}
```

### Creator Feed Root (stored in Swarm Feed as JSON)

```typescript
interface CreatorFeed {
  version: 1
  creator_address: string
  posts: PostMetadata[]       // newest first
  updated_at: number
}
```

### Swarm Feed Key Store Layout

```
Encrypted keys are stored in Swarm Feeds — no backend KV, no server state.

Feed topic  = keccak256Hash("noctwave-key:" + lookupAddress)
Feed owner  = creator address

One feed slot per (creator, subscriber, postCID) triple.
Creator writes; subscriber reads via public gateway. Fully decentralized.

lookupAddress = keccak256(creatorAddress + subscriberAddress + postCID)
```

---

## 10. Superfluid Configuration

Superfluid is deployed on Base Sepolia. USDCx needs to be obtained by wrapping USDC.

```typescript
// Contracts on Base Sepolia
const SUPERFLUID = {
  CFA_FORWARDER: '0xcfA132E353cB4E398080B9700609bb008eceB125',  // same on all chains
  HOST: '0x4C073B3baB6d8826b8C5b229f3cfdC1eC6E47E74',           // Base Sepolia
}

// USDCx wrapping: subscriber must approve + wrap before streaming
// 1. USDC.approve(USDCx, amount)
// 2. USDCx.upgrade(amount)    — wraps to 18 decimals
// 3. CFA_FORWARDER.createFlow(USDCx, sender, receiver, flowRate, "0x")
```

---

## 11. Integration Checkpoints

These are the milestones where Dev A and Dev B must sync:

| Checkpoint | When | What Dev A delivers | What Dev B needs |
|---|---|---|---|
| **C1** | Hour 2 | Contracts deployed, addresses in `.env` | `REGISTRY_ADDRESS`, `VAULT_FACTORY_ADDRESS` |
| **C2** | Hour 4 | `swarmClient.ts` + `/api/swarm/upload` route working | Upload API URL; confirm gateway URL for reads |
| **C3** | Hour 6 | `crypto.ts` complete; `keyDelivery.ts` `syncSubscriberKeys` tested | Creator dashboard can call sync; post viewer can call `fetchEncryptedKey` |
| **C4** | Hour 10 | EIP-5564 `stealth.ts` module complete | SubscribeButton can generate stealth addresses |
| **C5** | Hour 14 | Full encrypt → publish → sync → decrypt cycle passing unit tests | Video player can decrypt end-to-end |

---

## 12. Build Order

### Dev A — Hours 0–36

```
Hour 0–2:   Deploy contracts to Base Sepolia. Verify on Basescan. Post addresses to shared .env.
Hour 2–4:   Build frontend/src/lib/swarmClient.ts. Build /api/swarm/upload proxy route.
            Test upload round-trip: browser → API route → Bee node → Swarm → gateway read.
Hour 4–6:   Build crypto.ts (encryptContent, decryptContent, generateContentKey, computeLookupAddress).
Hour 6–10:  Build keyDelivery.ts (syncSubscriberKeys + fetchEncryptedKey).
            Test: publish a post, call sync, read back the encrypted key from Swarm Feed.
Hour 10–14: Build stealth.ts (EIP-5564). Test generateStealthAddress / checkStealthAddress round-trip.
Hour 14–18: Wire key delivery into creator dashboard page (call syncSubscriberKeys on load).
            Full end-to-end test: publish → subscribe (on-chain) → dashboard sync → subscriber decrypts.
Hour 18–22: [If time] Build Apify actor. Test ENS crawl → Swarm metadata fetch → index.
Hour 22–26: [If time] Wire X402 on /api/search endpoint.
Hour 26–36: Support Dev B integration. Fix bugs. Help with demo prep.
```

### Dev B — Hours 0–36

```
Hour 0–2:   Scaffold Next.js app. Set up RainbowKit + Wagmi + providers. Deploy to localhost.
Hour 2–4:   Creator onboard page: name registration + vault deploy. Test against C1 contracts.
Hour 4–6:   Creator dashboard: Swarm Feed read, list posts. Wire upload button → /api/swarm/upload.
Hour 6–10:  Video upload: ffmpeg.wasm integration, transcode to HLS, upload segments via API route.
Hour 10–14: Subscriber flow: open stream UI, StreamBalance component, per-second counter.
Hour 14–18: Post viewer: check stream on-chain → call fetchEncryptedKey → signMessageAsync → decrypt → play.
Hour 18–22: Discovery page: getLogs NameRegistered from registry, show thumbnails.
Hour 22–26: [If time] XMTP chat: create group on creator setup, stream-gated membership.
Hour 26–30: Polish, error states, loading states, mobile layout.
Hour 30–36: Demo prep: pre-upload test video, rehearse 3-minute pitch, fix any blockers.
```

---

## 13. Known Risks & Mitigations

| Risk | Mitigation |
|---|---|
| `ffmpeg.wasm` blocked by CORP headers | Set `Cross-Origin-Opener-Policy` and `Cross-Origin-Embedder-Policy` in `next.config.ts` |
| Swarm upload slow for large video | Transcode to 480p only for demo; keep video under 30s |
| Superfluid USDCx not available on Base Sepolia | Use SuperToken wrapper; check [superfluid.finance/networks](https://www.superfluid.finance/networks) |
| EIP-5564 `@noble/secp256k1` point addition edge cases | Test with known vectors; fallback to sending from main wallet if stealth fails |
| Key delivery not instant (creator must open dashboard) | For demo: open creator dashboard right after subscriber subscribes — natural demo flow |
| Swarm Feed write fails (Bee node unavailable) | Pre-deliver keys during dev; check `/api/swarm/upload` health before demo |
| XMTP group membership not syncing | Add manual "refresh membership" button as fallback |
| Postage stamp expires mid-demo | Ask Áron at Swarm booth for a fresh batch ID with high TTL |

---

## 14. Swarm Reference

### Upload a file (bee-js v8)
```typescript
const bee = new Bee('http://localhost:1633')
const batchId = 'YOUR_BATCH_ID'  // from gift code

// Upload bytes
const { reference } = await bee.uploadData(batchId, data)
// reference is a 64-char hex string (Swarm CID)

// Upload with filename
const { reference } = await bee.uploadFile(batchId, data, 'video.m3u8', { contentType: 'application/vnd.apple.mpegurl' })

// Read via gateway (no Bee node)
const resp = await fetch(`https://api.gateway.ethswarm.org/bzz/${reference}`)
const data = await resp.arrayBuffer()
```

### Swarm Feeds (bee-js v8)
```typescript
const topic = Utils.keccak256Hash('noctwave-content-root')  // Uint8Array, 32 bytes

// Write feed (requires signer)
const writer = bee.makeFeedWriter('sequence', topic, ownerAddress, signer)
const { reference: feedRef } = await writer.upload(batchId, jsonData)

// Read feed (no signer needed)
const reader = bee.makeFeedReader('sequence', topic, ownerAddress)
const { reference } = await reader.download()
const data = await bee.downloadData(reference)
```

### Key Lookup on Swarm
Since Swarm is content-addressed, we can't "store at an address." Instead:
1. Upload the encrypted key → get a CID
2. Store `lookupAddress → CID` in the backend KV (in-memory for hackathon)
3. Frontend calls `/api/key?lookup=...` → backend returns CID → frontend fetches from gateway

---

## 15. ENS Subname Reference

For the hackathon, we use our own `NoctwaveRegistry` contract instead of the real ENS L1 registrar. The frontend resolves names via `registry.resolve(name)` and reads text records via `registry.getTextRecord(name, key)`.

Full ENS integration (L1 mainnet) is a post-hackathon upgrade.

---

## 16. Superfluid Reference

**CFAv1Forwarder** — `0xcfA132E353cB4E398080B9700609bb008eceB125` (same on ALL EVM chains)

```typescript
// Open stream: subscriber → creator vault
await cfaForwarder.createFlow(USDCxAddress, senderAddress, vaultAddress, flowRate, '0x')

// Close stream
await cfaForwarder.deleteFlow(USDCxAddress, senderAddress, vaultAddress, '0x')

// Check flow rate (0 = not subscribed)
const rate = await cfaForwarder.getFlowrate(USDCxAddress, senderAddress, vaultAddress)

// Flow rate for $10/month in USDCx (18 decimals):
// 10 * 1e18 / 2_592_000 = 3_858_024_691_358 wei/sec
```

**USDCx wrapping (subscriber must do before opening stream):**
```typescript
// 1. Approve USDCx to spend USDC
await usdc.approve(usdcxAddress, amount)
// 2. Wrap USDC → USDCx
await usdcx.upgrade(amount)  // amount in USDC (6 decimals) × 1e12 for USDCx (18 decimals)
```

---

## 17. EIP-5564 Reference

Scheme: SECP256k1 (scheme ID = 1)

**Stealth meta-address format:**
```
st:eth:0x{33-byte-spending-pubkey-hex}{33-byte-viewing-pubkey-hex}
```

**Flow:**
1. Creator publishes stealth meta-address in ENS text record `"stealth-meta"`
2. Subscriber calls `generateStealthAddress(metaAddress)` → `{ stealthAddress, ephemeralPublicKey, viewTag }`
3. Subscriber sends payment to `stealthAddress` (or for hackathon: opens Superfluid stream from stealth address)
4. On-chain: only `stealthAddress` and `ephemeralPublicKey` are visible — not linked to subscriber's main wallet
5. Creator scans announcements using their viewing key to find payments

For hackathon scope: stealth address is generated and shown in the UI to demonstrate the concept. The actual Superfluid stream may still come from the main wallet address for simplicity, with the stealth address shown as the "privacy layer."

---

## 18. Apify X402 Reference (Reader Agent — if time allows)

The Apify X402 integration requires:
1. Headers: `X-APIFY-PAYMENT-PROTOCOL: X402`
2. On 402 response: sign payment payload, retry with `PAYMENT-SIGNATURE` header
3. Minimum transaction: $1 USDC on Base

For the agent:
```typescript
import { ApifyClient } from 'apify-client'

const client = new ApifyClient({ token: process.env.APIFY_TOKEN })

// Run an actor that scrapes ENS + Swarm
const run = await client.actor('noctwave~creator-indexer').call({
  registryAddress: process.env.NEXT_PUBLIC_REGISTRY_ADDRESS,
  swarmGateway: process.env.NEXT_PUBLIC_SWARM_GATEWAY,
  interests: ['ethereum', 'privacy', 'defi'],
})

const { items } = await client.dataset(run.defaultDatasetId).listItems()
// items = [{ name, address, swarmFeedCID, thumbnailCID, price, relevanceScore }]
```

The custom Apify actor (`backend/src/apifyActor.ts`) reads registry `NameRegistered` events, fetches each creator's Swarm Feed, reads public post metadata, and scores relevance with Claude API.
