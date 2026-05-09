// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IENSRegistry {
    function setSubnodeRecord(bytes32 node, bytes32 label, address owner, address resolver, uint64 ttl) external;
    function owner(bytes32 node) external view returns (address);
}

interface IPublicResolver {
    function setText(bytes32 node, string calldata key, string calldata value) external;
    function text(bytes32 node, string calldata key) external view returns (string memory);
    function setAddr(bytes32 node, address addr) external;
    function addr(bytes32 node) external view returns (address);
}

// Deployed on Ethereum Sepolia. Issues alice.noctwave.eth subdomains to creators
// and lets them set ENS text records (swarm-feed, price, description, thumbnail, stealth-meta).
contract NoctwaveSubdomainRegistrar {
    IENSRegistry public immutable registry;
    IPublicResolver public immutable resolver;
    bytes32 public immutable rootNode; // namehash("noctwave.eth")

    mapping(bytes32 => address) public labelHashToOwner;
    mapping(address => string) public ownerToLabel;

    event SubdomainRegistered(string label, address indexed owner, bytes32 indexed node);
    event TextRecordSet(string indexed label, string key, string value);

    error LabelTaken();
    error NotSubdomainOwner();

    constructor(address _registry, address _resolver, bytes32 _rootNode) {
        registry = IENSRegistry(_registry);
        resolver = IPublicResolver(_resolver);
        rootNode = _rootNode;
    }

    function register(string calldata label) external {
        bytes32 labelHash = keccak256(bytes(label));
        if (labelHashToOwner[labelHash] != address(0)) revert LabelTaken();

        bytes32 subnodeHash = keccak256(abi.encodePacked(rootNode, labelHash));

        labelHashToOwner[labelHash] = msg.sender;
        ownerToLabel[msg.sender] = label;

        // This contract owns the subnode so it can manage resolver records on the creator's behalf
        registry.setSubnodeRecord(rootNode, labelHash, address(this), address(resolver), 0);

        // Set ETH address so alice.noctwave.eth resolves to the creator's wallet
        resolver.setAddr(subnodeHash, msg.sender);

        emit SubdomainRegistered(label, msg.sender, subnodeHash);
    }

    function setTextRecord(string calldata label, string calldata key, string calldata value) external {
        bytes32 labelHash = keccak256(bytes(label));
        if (labelHashToOwner[labelHash] != msg.sender) revert NotSubdomainOwner();

        bytes32 subnodeHash = keccak256(abi.encodePacked(rootNode, labelHash));
        resolver.setText(subnodeHash, key, value);

        emit TextRecordSet(label, key, value);
    }

    function getTextRecord(string calldata label, string calldata key) external view returns (string memory) {
        bytes32 subnodeHash = keccak256(abi.encodePacked(rootNode, keccak256(bytes(label))));
        return resolver.text(subnodeHash, key);
    }

    // Returns the creator wallet for a given label — mirrors ENS addr() resolution
    function resolve(string calldata label) external view returns (address) {
        return labelHashToOwner[keccak256(bytes(label))];
    }

    // Returns the ENS node hash for a subdomain label — useful for frontend ENS SDK calls
    function subnodeOf(string calldata label) external view returns (bytes32) {
        return keccak256(abi.encodePacked(rootNode, keccak256(bytes(label))));
    }
}
