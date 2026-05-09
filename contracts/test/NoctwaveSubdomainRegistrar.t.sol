// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import "../src/NoctwaveSubdomainRegistrar.sol";

// Minimal ENS registry mock
contract MockENSRegistry {
    mapping(bytes32 => address) public owners;
    mapping(bytes32 => address) public resolvers;

    function setSubnodeRecord(bytes32 node, bytes32 label, address nodeOwner, address nodeResolver, uint64) external {
        bytes32 sub = keccak256(abi.encodePacked(node, label));
        owners[sub] = nodeOwner;
        resolvers[sub] = nodeResolver;
    }

    function owner(bytes32 node) external view returns (address) {
        return owners[node];
    }
}

// Minimal ENS resolver mock
contract MockPublicResolver {
    mapping(bytes32 => mapping(string => string)) private _texts;
    mapping(bytes32 => address) private _addresses;

    function setText(bytes32 node, string calldata key, string calldata value) external {
        _texts[node][key] = value;
    }

    function text(bytes32 node, string calldata key) external view returns (string memory) {
        return _texts[node][key];
    }

    function setAddr(bytes32 node, address a) external {
        _addresses[node] = a;
    }

    function addr(bytes32 node) external view returns (address) {
        return _addresses[node];
    }
}

contract NoctwaveSubdomainRegistrarTest is Test {
    NoctwaveSubdomainRegistrar registrar;
    MockENSRegistry ensRegistry;
    MockPublicResolver ensResolver;

    bytes32 constant ROOT_NODE = keccak256("noctwave.eth");

    address alice = makeAddr("alice");
    address bob   = makeAddr("bob");

    function setUp() public {
        ensRegistry = new MockENSRegistry();
        ensResolver = new MockPublicResolver();
        registrar   = new NoctwaveSubdomainRegistrar(address(ensRegistry), address(ensResolver), ROOT_NODE);
    }

    function test_register() public {
        vm.prank(alice);
        registrar.register("alice");
        assertEq(registrar.resolve("alice"), alice);
        assertEq(registrar.ownerToLabel(alice), "alice");
    }

    function test_register_setsENSAddr() public {
        vm.prank(alice);
        registrar.register("alice");
        bytes32 sub = registrar.subnodeOf("alice");
        assertEq(ensResolver.addr(sub), alice);
    }

    function test_register_emitsEvent() public {
        bytes32 expectedNode = keccak256(abi.encodePacked(ROOT_NODE, keccak256(bytes("alice"))));
        vm.expectEmit(false, true, true, false);
        emit NoctwaveSubdomainRegistrar.SubdomainRegistered("alice", alice, expectedNode);
        vm.prank(alice);
        registrar.register("alice");
    }

    function test_register_reverts_LabelTaken() public {
        vm.prank(alice);
        registrar.register("alice");
        vm.prank(bob);
        vm.expectRevert(NoctwaveSubdomainRegistrar.LabelTaken.selector);
        registrar.register("alice");
    }

    function test_setTextRecord() public {
        vm.startPrank(alice);
        registrar.register("alice");
        registrar.setTextRecord("alice", "swarm-feed", "0xdeadbeef");
        vm.stopPrank();
        assertEq(registrar.getTextRecord("alice", "swarm-feed"), "0xdeadbeef");
    }

    function test_setTextRecord_emitsEvent() public {
        vm.startPrank(alice);
        registrar.register("alice");
        vm.expectEmit(true, false, false, true);
        emit NoctwaveSubdomainRegistrar.TextRecordSet("alice", "price", "10");
        registrar.setTextRecord("alice", "price", "10");
        vm.stopPrank();
    }

    function test_setTextRecord_reverts_NotSubdomainOwner() public {
        vm.prank(alice);
        registrar.register("alice");
        vm.prank(bob);
        vm.expectRevert(NoctwaveSubdomainRegistrar.NotSubdomainOwner.selector);
        registrar.setTextRecord("alice", "swarm-feed", "0xdeadbeef");
    }

    function test_resolve_unknown_returnsZero() public view {
        assertEq(registrar.resolve("nobody"), address(0));
    }

    function test_allAppTextRecordKeys() public {
        vm.startPrank(alice);
        registrar.register("alice");
        registrar.setTextRecord("alice", "swarm-feed",  "0xabc");
        registrar.setTextRecord("alice", "price",       "10");
        registrar.setTextRecord("alice", "description", "my bio");
        registrar.setTextRecord("alice", "thumbnail",   "0xdef");
        registrar.setTextRecord("alice", "stealth-meta","st:eth:0x1234");
        vm.stopPrank();

        assertEq(registrar.getTextRecord("alice", "swarm-feed"),   "0xabc");
        assertEq(registrar.getTextRecord("alice", "price"),        "10");
        assertEq(registrar.getTextRecord("alice", "description"),  "my bio");
        assertEq(registrar.getTextRecord("alice", "thumbnail"),    "0xdef");
        assertEq(registrar.getTextRecord("alice", "stealth-meta"), "st:eth:0x1234");
    }

    function test_subnodeOf() public view {
        bytes32 expected = keccak256(abi.encodePacked(ROOT_NODE, keccak256(bytes("alice"))));
        assertEq(registrar.subnodeOf("alice"), expected);
    }
}
