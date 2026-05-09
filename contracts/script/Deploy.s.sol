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
