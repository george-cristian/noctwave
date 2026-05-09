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
    int96   flowRate  = 3_858_024_691_358; // $10/month in USDCx wei/sec

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
        vm.recordLogs();
        address vaultAddr = factory.deploy(mockToken, flowRate);
        Vm.Log[] memory logs = vm.getRecordedLogs();
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
