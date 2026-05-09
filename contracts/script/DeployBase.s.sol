// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import "../src/VaultFactory.sol";

// Deploy on Base Sepolia (chainId 84532)
contract DeployBase is Script {
    function run() external {
        require(block.chainid == 84532, "Must deploy on Base Sepolia (chainId 84532)");

        vm.startBroadcast();
        VaultFactory factory = new VaultFactory();
        console.log("VaultFactory:", address(factory));
        vm.stopBroadcast();
    }
}
