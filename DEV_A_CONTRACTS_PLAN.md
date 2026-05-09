# Dev A — Contracts Implementation Plan
### ETHPrague 2026 · Base Sepolia · Execute in order

---

## Prerequisites

```bash
# Required tools
forge --version        # Foundry — install from https://getfoundry.sh if missing
cast --version
```

You need:
- `DEPLOYER_KEY` — private key of your deployer wallet (funded with Base Sepolia ETH)
- `BASESCAN_API_KEY` — from https://sepolia.basescan.org (free account)
- Base Sepolia ETH — faucet: https://faucet.quicknode.com/base/sepolia

---

## Step 1 — Initialize Foundry project

```bash
# From repo root
forge init contracts --no-commit

# Remove boilerplate forge creates
rm contracts/src/Counter.sol
rm contracts/test/Counter.t.sol
rm contracts/script/Counter.s.sol
```

---

## Step 2 — Install dependencies

No dependencies to install. The three contracts have no external imports:

- `NoctwaveRegistry` — pure Solidity, no imports
- `SubscriptionVault` — imports only the local `ISuperToken` interface (Step 4)
- `VaultFactory` — imports only `SubscriptionVault`

> **Do NOT install `superfluid-finance/ethereum-contracts`.**
> The vault stores a `ISuperToken` type but calls zero Superfluid functions.
> We use a minimal local interface instead (Step 4) to avoid the ~300MB dependency.

---

## Step 3 — Write `contracts/foundry.toml`

Replace the generated `foundry.toml` with:

```toml
[profile.default]
src = "src"
out = "out"
libs = ["lib"]
solc = "0.8.24"

[rpc_endpoints]
base_sepolia = "https://sepolia.base.org"

[etherscan]
base_sepolia = { key = "${BASESCAN_API_KEY}", url = "https://api-sepolia.basescan.org/api" }
```

---

## Step 4 — Create `contracts/src/interfaces/ISuperToken.sol`

```bash
mkdir -p contracts/src/interfaces
```

**`contracts/src/interfaces/ISuperToken.sol`**
```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface ISuperToken {
    function balanceOf(address account) external view returns (uint256);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function upgrade(uint256 amount) external;
    function downgrade(uint256 amount) external;
}
```

---

## Step 5 — Create `contracts/src/NoctwaveRegistry.sol`

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

contract NoctwaveRegistry {
    mapping(string => address) public nameToOwner;
    mapping(address => string) public ownerToName;

    // key: keccak256(abi.encodePacked(name, recordKey)) → value
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

    function resolve(string calldata name) external view returns (address) {
        return nameToOwner[name];
    }
}
```

**Text record keys the app uses:**
| Key | Value |
|---|---|
| `swarm-feed` | Swarm Feed root CID (hex) |
| `price` | USDC/month as string, e.g. `"10"` |
| `description` | Creator bio |
| `thumbnail` | Public thumbnail Swarm CID |
| `stealth-meta` | EIP-5564 stealth meta-address |

---

## Step 6 — Create `contracts/src/SubscriptionVault.sol`

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { ISuperToken } from "./interfaces/ISuperToken.sol";

contract SubscriptionVault {
    address public creator;
    ISuperToken public acceptedToken;   // USDCx address
    int96 public requiredFlowRate;      // minimum wei/sec to be considered subscribed

    mapping(address => bool) public activeSubscribers;
    address[] public subscriberList;

    event SubscriberAdded(address indexed subscriber);
    event SubscriberRemoved(address indexed subscriber);

    constructor(address _creator, address _token, int96 _flowRate) {
        creator = _creator;
        acceptedToken = ISuperToken(_token);
        requiredFlowRate = _flowRate;
    }

    // Called by the subscriber's browser (SubscribeButton) after opening a Superfluid stream.
    // Open access for hackathon — add caller auth in production.
    function recordSubscriber(address subscriber, bool active) external {
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

**Flow rate reference:**
```
$10/month → USDCx (18 decimals):
flowRate = (10 * 1e18) / 2_592_000 = 3_858_024_691_358 wei/sec

Streams flow directly from subscriber wallet → vault address via CFAv1Forwarder.
The vault does NOT need to be a Superfluid SuperApp to receive streams.
```

---

## Step 7 — Create `contracts/src/VaultFactory.sol`

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./SubscriptionVault.sol";

contract VaultFactory {
    mapping(address => address) public creatorVault;

    event VaultDeployed(address indexed creator, address indexed vault);

    function deploy(address token, int96 flowRate) external returns (address) {
        SubscriptionVault vault = new SubscriptionVault(msg.sender, token, flowRate);
        creatorVault[msg.sender] = address(vault);
        emit VaultDeployed(msg.sender, address(vault));
        return address(vault);
    }
}
```

---

## Step 8 — Create `contracts/script/Deploy.s.sol`

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import "../src/NoctwaveRegistry.sol";
import "../src/VaultFactory.sol";

contract Deploy is Script {
    function run() external {
        require(block.chainid == 84532, "Must deploy on Base Sepolia (chainId 84532)");
        vm.startBroadcast();
        NoctwaveRegistry registry = new NoctwaveRegistry();
        VaultFactory factory = new VaultFactory();
        console.log("NoctwaveRegistry:", address(registry));
        console.log("VaultFactory:    ", address(factory));
        vm.stopBroadcast();
    }
}
```

---

## Step 9 — Write tests

### `contracts/test/NoctwaveRegistry.t.sol`

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import "../src/NoctwaveRegistry.sol";

contract NoctwaveRegistryTest is Test {
    NoctwaveRegistry registry;
    address alice = makeAddr("alice");
    address bob = makeAddr("bob");

    function setUp() public {
        registry = new NoctwaveRegistry();
    }

    function test_register() public {
        vm.prank(alice);
        registry.register("alice");
        assertEq(registry.nameToOwner("alice"), alice);
        assertEq(registry.ownerToName(alice), "alice");
    }

    function test_register_emitsEvent() public {
        vm.expectEmit(true, true, false, false);
        emit NoctwaveRegistry.NameRegistered("alice", alice);
        vm.prank(alice);
        registry.register("alice");
    }

    function test_register_reverts_NameTaken() public {
        vm.prank(alice);
        registry.register("alice");
        vm.prank(bob);
        vm.expectRevert(NoctwaveRegistry.NameTaken.selector);
        registry.register("alice");
    }

    function test_setTextRecord() public {
        vm.startPrank(alice);
        registry.register("alice");
        registry.setTextRecord("alice", "swarm-feed", "0xdeadbeef");
        vm.stopPrank();
        assertEq(registry.getTextRecord("alice", "swarm-feed"), "0xdeadbeef");
    }

    function test_setTextRecord_emitsEvent() public {
        vm.startPrank(alice);
        registry.register("alice");
        vm.expectEmit(true, false, false, true);
        emit NoctwaveRegistry.TextRecordSet("alice", "price", "10");
        registry.setTextRecord("alice", "price", "10");
        vm.stopPrank();
    }

    function test_setTextRecord_reverts_NotOwner() public {
        vm.prank(alice);
        registry.register("alice");
        vm.prank(bob);
        vm.expectRevert(NoctwaveRegistry.NotOwner.selector);
        registry.setTextRecord("alice", "swarm-feed", "0xdeadbeef");
    }

    function test_resolve() public {
        vm.prank(alice);
        registry.register("alice");
        assertEq(registry.resolve("alice"), alice);
    }

    function test_resolve_unknown_returnsZero() public view {
        assertEq(registry.resolve("nobody"), address(0));
    }

    function test_allAppTextRecordKeys() public {
        vm.startPrank(alice);
        registry.register("alice");
        registry.setTextRecord("alice", "swarm-feed", "0xabc");
        registry.setTextRecord("alice", "price", "10");
        registry.setTextRecord("alice", "description", "my bio");
        registry.setTextRecord("alice", "thumbnail", "0xdef");
        registry.setTextRecord("alice", "stealth-meta", "st:eth:0x1234");
        vm.stopPrank();

        assertEq(registry.getTextRecord("alice", "swarm-feed"), "0xabc");
        assertEq(registry.getTextRecord("alice", "price"), "10");
        assertEq(registry.getTextRecord("alice", "description"), "my bio");
        assertEq(registry.getTextRecord("alice", "thumbnail"), "0xdef");
        assertEq(registry.getTextRecord("alice", "stealth-meta"), "st:eth:0x1234");
    }
}
```

### `contracts/test/SubscriptionVault.t.sol`

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import "../src/SubscriptionVault.sol";

contract SubscriptionVaultTest is Test {
    SubscriptionVault vault;
    address creator     = makeAddr("creator");
    address subscriber1 = makeAddr("subscriber1");
    address subscriber2 = makeAddr("subscriber2");
    address mockToken   = makeAddr("token");
    int96   flowRate    = 3_858_024_691_358;   // $10/month in USDCx wei/sec

    function setUp() public {
        vault = new SubscriptionVault(creator, mockToken, flowRate);
    }

    function test_constructor_setsFields() public view {
        assertEq(vault.creator(), creator);
        assertEq(address(vault.acceptedToken()), mockToken);
        assertEq(vault.requiredFlowRate(), flowRate);
    }

    function test_recordSubscriber_adds() public {
        vault.recordSubscriber(subscriber1, true);
        assertTrue(vault.isSubscribed(subscriber1));
        assertEq(vault.getSubscribers()[0], subscriber1);
    }

    function test_recordSubscriber_emits_SubscriberAdded() public {
        vm.expectEmit(true, false, false, false);
        emit SubscriptionVault.SubscriberAdded(subscriber1);
        vault.recordSubscriber(subscriber1, true);
    }

    function test_recordSubscriber_removes() public {
        vault.recordSubscriber(subscriber1, true);
        vault.recordSubscriber(subscriber1, false);
        assertFalse(vault.isSubscribed(subscriber1));
    }

    function test_recordSubscriber_emits_SubscriberRemoved() public {
        vault.recordSubscriber(subscriber1, true);
        vm.expectEmit(true, false, false, false);
        emit SubscriptionVault.SubscriberRemoved(subscriber1);
        vault.recordSubscriber(subscriber1, false);
    }

    function test_recordSubscriber_noDoubleAdd() public {
        vault.recordSubscriber(subscriber1, true);
        vault.recordSubscriber(subscriber1, true);   // idempotent
        assertEq(vault.getSubscribers().length, 1);
    }

    function test_recordSubscriber_removeNonExistent_noOp() public {
        vault.recordSubscriber(subscriber1, false);  // was never added — no revert, no event
        assertFalse(vault.isSubscribed(subscriber1));
    }

    function test_isSubscribed_false_for_unknown() public view {
        assertFalse(vault.isSubscribed(subscriber1));
    }

    function test_getSubscribers_multiple() public {
        vault.recordSubscriber(subscriber1, true);
        vault.recordSubscriber(subscriber2, true);
        assertEq(vault.getSubscribers().length, 2);
        assertEq(vault.getSubscribers()[0], subscriber1);
        assertEq(vault.getSubscribers()[1], subscriber2);
    }
}
```

### `contracts/test/VaultFactory.t.sol`

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import "../src/VaultFactory.sol";
import "../src/SubscriptionVault.sol";

contract VaultFactoryTest is Test {
    VaultFactory factory;
    address creator   = makeAddr("creator");
    address creator2  = makeAddr("creator2");
    address mockToken = makeAddr("token");
    int96   flowRate  = 3_858_024_691_358;

    function setUp() public {
        factory = new VaultFactory();
    }

    function test_deploy_returnsVaultAddress() public {
        vm.prank(creator);
        address vaultAddr = factory.deploy(mockToken, flowRate);
        assertTrue(vaultAddr != address(0));
    }

    function test_deploy_storesInMapping() public {
        vm.prank(creator);
        address vaultAddr = factory.deploy(mockToken, flowRate);
        assertEq(factory.creatorVault(creator), vaultAddr);
    }

    function test_deploy_vaultHasCorrectFields() public {
        vm.prank(creator);
        address vaultAddr = factory.deploy(mockToken, flowRate);
        SubscriptionVault vault = SubscriptionVault(vaultAddr);
        assertEq(vault.creator(), creator);
        assertEq(address(vault.acceptedToken()), mockToken);
        assertEq(vault.requiredFlowRate(), flowRate);
    }

    function test_deploy_emitsVaultDeployed() public {
        vm.prank(creator);
        // Capture the vault address via return value; check event separately
        vm.recordLogs();
        address vaultAddr = factory.deploy(mockToken, flowRate);
        Vm.Log[] memory logs = vm.getRecordedLogs();
        // VaultDeployed(address indexed creator, address indexed vault)
        assertEq(logs.length, 1);
        assertEq(address(uint160(uint256(logs[0].topics[1]))), creator);
        assertEq(address(uint160(uint256(logs[0].topics[2]))), vaultAddr);
    }

    function test_deploy_overwrites_previous_vault() public {
        vm.startPrank(creator);
        factory.deploy(mockToken, flowRate);
        address secondVault = factory.deploy(mockToken, flowRate);
        vm.stopPrank();
        assertEq(factory.creatorVault(creator), secondVault);
    }

    function test_different_creators_get_different_vaults() public {
        vm.prank(creator);
        address vault1 = factory.deploy(mockToken, flowRate);
        vm.prank(creator2);
        address vault2 = factory.deploy(mockToken, flowRate);
        assertTrue(vault1 != vault2);
        assertEq(factory.creatorVault(creator), vault1);
        assertEq(factory.creatorVault(creator2), vault2);
    }
}
```

---

## Step 10 — Compile and test locally

```bash
cd contracts

# Compile — must be clean before deploying
forge build

# Run all tests
forge test -vv

# If any test fails, fix before proceeding to deploy
```

Expected output: all tests green, no compiler warnings.

---

## Step 11 — Deploy to Base Sepolia

```bash
cd contracts

# Set your keys (do not commit these)
export DEPLOYER_KEY=0x...your_private_key...
export BASESCAN_API_KEY=...your_basescan_key...

# Dry run first (no --broadcast)
forge script script/Deploy.s.sol \
  --rpc-url https://sepolia.base.org \
  --private-key $DEPLOYER_KEY

# If output looks correct, broadcast
forge script script/Deploy.s.sol \
  --rpc-url https://sepolia.base.org \
  --private-key $DEPLOYER_KEY \
  --broadcast \
  --verify \
  --verifier-url https://api-sepolia.basescan.org/api \
  --etherscan-api-key $BASESCAN_API_KEY
```

The output will contain two lines:
```
NoctwaveRegistry: 0x...
VaultFactory:     0x...
```

Copy both addresses.

---

## Step 12 — Post-deployment: update environment

Create `.env` at the repo root (copy from `.env.example` if it exists):

```bash
# Chain
NEXT_PUBLIC_CHAIN_ID=84532
NEXT_PUBLIC_RPC_URL=https://sepolia.base.org

# Superfluid (pre-deployed on all EVM chains)
NEXT_PUBLIC_CFA_FORWARDER=0xcfA132E353cB4E398080B9700609bb008eceB125

# Tokens on Base Sepolia
NEXT_PUBLIC_USDC_ADDRESS=0x036CbD53842c5426634e7929541eC2318f3dCF7e
NEXT_PUBLIC_USDCX_ADDRESS=<find on app.superfluid.finance for Base Sepolia>

# Deployed contracts — fill these in after Step 11
NEXT_PUBLIC_REGISTRY_ADDRESS=0x...
NEXT_PUBLIC_VAULT_FACTORY_ADDRESS=0x...

# Swarm
SWARM_BEE_URL=http://localhost:1633
SWARM_POSTAGE_BATCH_ID=<from Swarm booth gift code>
NEXT_PUBLIC_SWARM_GATEWAY=https://api.gateway.ethswarm.org

# Apify (if building agent)
APIFY_TOKEN=<from apify dashboard>

# WalletConnect Cloud
NEXT_PUBLIC_WC_PROJECT_ID=<from cloud.walletconnect.com>
```

Then update `CLAUDE.md` — replace the two `<fill after Dev A deploys>` rows in the address table with the real addresses.

**Communicate to Dev B (Integration Checkpoint C1):**
- `NEXT_PUBLIC_REGISTRY_ADDRESS`
- `NEXT_PUBLIC_VAULT_FACTORY_ADDRESS`
- Basescan verification links for both contracts

---

## Step 13 — Smoke test on Base Sepolia

```bash
# Verify registry is live
cast call $NEXT_PUBLIC_REGISTRY_ADDRESS \
  "resolve(string)(address)" "nobody" \
  --rpc-url https://sepolia.base.org
# Expected: 0x0000000000000000000000000000000000000000

# Verify factory is live
cast call $NEXT_PUBLIC_VAULT_FACTORY_ADDRESS \
  "creatorVault(address)(address)" 0x0000000000000000000000000000000000000000 \
  --rpc-url https://sepolia.base.org
# Expected: 0x0000000000000000000000000000000000000000
```

---

## Verification Checklist

- [ ] `forge build` — zero errors, zero warnings
- [ ] `forge test -vv` — all tests pass
- [ ] Both contracts verified on https://sepolia.basescan.org
- [ ] `.env` updated with deployed addresses
- [ ] `CLAUDE.md` address table updated
- [ ] Dev B notified (C1 checkpoint)

---

## Notes

- **USDCx address:** The USDC super token wrapper on Base Sepolia — find it at https://app.superfluid.finance (connect wallet, switch to Base Sepolia). Add to `.env` as `NEXT_PUBLIC_USDCX_ADDRESS`.
- **`recordSubscriber` caller:** With no backend, the subscriber's browser calls this after `createFlow`. The function is intentionally open-access for the hackathon.
- **`getSubscribers()` returns all-time list** (including lapsed). The `isSubscribed(addr)` check is the authoritative active state. `keyDelivery.ts` reads `SubscriberAdded` events — lapsed subscriber key delivery is acceptable for hackathon (they paid for past content).
- **Postage stamp:** Get from Áron Soós at the Swarm booth before the demo. High TTL is critical.
