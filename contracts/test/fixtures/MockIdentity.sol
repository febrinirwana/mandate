// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

contract MockPermissionedRegistry {
    enum Status {
        AVAILABLE,
        RESERVED,
        REGISTERED
    }

    struct State {
        Status status;
        uint64 expiry;
        address latestOwner;
        uint256 tokenId;
        uint256 resource;
    }

    mapping(uint256 => State) private states;
    mapping(uint256 => address) private tokenOwners;
    mapping(bytes32 => address) private resolvers;
    bool public revertReads;

    function setRevertReads(bool value) external {
        revertReads = value;
    }

    function setState(uint256 labelId, State calldata state) external {
        states[labelId] = state;
    }

    function setOwner(uint256 tokenId, address owner) external {
        tokenOwners[tokenId] = owner;
    }

    function setResolver(string calldata label, address resolver) external {
        resolvers[keccak256(bytes(label))] = resolver;
    }

    function getState(uint256 labelId) external view returns (State memory) {
        if (revertReads) revert("REGISTRY_READ_REVERTED");
        return states[labelId];
    }

    function ownerOf(uint256 tokenId) external view returns (address) {
        if (revertReads) revert("REGISTRY_READ_REVERTED");
        return tokenOwners[tokenId];
    }

    function getResolver(string calldata label) external view returns (address) {
        if (revertReads) revert("REGISTRY_READ_REVERTED");
        return resolvers[keccak256(bytes(label))];
    }
}

contract MockAddrResolver {
    mapping(bytes32 => address) private resolvedAddresses;
    bool public revertReads;

    function setRevertReads(bool value) external {
        revertReads = value;
    }

    function setAddr(bytes32 node, address account) external {
        resolvedAddresses[node] = account;
    }

    function addr(bytes32 node) external view returns (address) {
        if (revertReads) revert("RESOLVER_READ_REVERTED");
        return resolvedAddresses[node];
    }
}
