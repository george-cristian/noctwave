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
