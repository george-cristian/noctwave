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
