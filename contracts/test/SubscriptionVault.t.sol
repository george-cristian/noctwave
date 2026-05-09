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
    int96   flowRate    = 3_858_024_691_358; // $10/month in USDCx wei/sec

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
        vault.recordSubscriber(subscriber1, true);
        assertEq(vault.getSubscribers().length, 1);
    }

    function test_recordSubscriber_removeNonExistent_noOp() public {
        vault.recordSubscriber(subscriber1, false);
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
