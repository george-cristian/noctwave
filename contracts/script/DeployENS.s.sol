// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import "../src/NoctwaveSubdomainRegistrar.sol";

// Deploy on Ethereum Sepolia (chainId 11155111)
// Prerequisites:
//   1. Register your ENS name (e.g. noctwave.eth) on https://app.ens.domains (switch to Sepolia)
//   2. Set ENS_ROOT_NODE in .env to the namehash of your registered name
//      Compute with: cast namehash noctwave.eth
//   3. After deployment, transfer ENS name ownership to the deployed contract address
//      via ENS app: Manage → Transfer
contract DeployENS is Script {
    function run() external {
        require(block.chainid == 11155111, "Must deploy on Ethereum Sepolia (chainId 11155111)");

        address ensRegistry  = vm.envAddress("ENS_REGISTRY");
        address ensResolver  = vm.envAddress("ENS_PUBLIC_RESOLVER");
        bytes32 rootNode     = vm.envBytes32("ENS_ROOT_NODE");

        vm.startBroadcast();
        NoctwaveSubdomainRegistrar registrar = new NoctwaveSubdomainRegistrar(
            ensRegistry,
            ensResolver,
            rootNode
        );
        console.log("NoctwaveSubdomainRegistrar:", address(registrar));
        vm.stopBroadcast();
    }
}
