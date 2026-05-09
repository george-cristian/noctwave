// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { ISuperToken } from "./interfaces/ISuperToken.sol";

contract SubscriptionVault {
    address public creator;
    ISuperToken public acceptedToken;
    int96 public requiredFlowRate;

    mapping(address => bool) public activeSubscribers;
    address[] public subscriberList;

    event SubscriberAdded(address indexed subscriber);
    event SubscriberRemoved(address indexed subscriber);

    constructor(address _creator, address _token, int96 _flowRate) {
        creator = _creator;
        acceptedToken = ISuperToken(_token);
        requiredFlowRate = _flowRate;
    }

    // Called by the subscriber's browser after opening a Superfluid stream.
    // Open access for hackathon — add caller auth in production.
    function recordSubscriber(address subscriber, bool active) external {
        if (active && !activeSubscribers[subscriber]) {
            activeSubscribers[subscriber] = true;
            subscriberList.push(subscriber);
            emit SubscriberAdded(subscriber);
        } else if (!active && activeSubscribers[subscriber]) {
            activeSubscribers[subscriber] = false;
            emit SubscriberRemoved(subscriber);
        }
    }

    function isSubscribed(address subscriber) external view returns (bool) {
        return activeSubscribers[subscriber];
    }

    function getSubscribers() external view returns (address[] memory) {
        return subscriberList;
    }
}
