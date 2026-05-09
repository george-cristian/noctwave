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
