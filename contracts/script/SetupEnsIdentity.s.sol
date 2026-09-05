// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import {IPermissionedRegistry} from "@ensv2/contracts/registry/interfaces/IPermissionedRegistry.sol";
import {IRegistry} from "@ensv2/contracts/registry/interfaces/IRegistry.sol";
import {Script} from "forge-std/Script.sol";

interface IEnsAddressResolver {
    function addr(bytes32 node) external view returns (address);
    function setAddr(bytes32 node, address account) external;
}

/// @dev Registers a short-lived agent label in a treasury-controlled PermissionedRegistry.
contract SetupEnsIdentity is Script {
    uint256 internal constant SEPOLIA_CHAIN_ID = 11_155_111;
    uint64 internal constant MAX_IDENTITY_DURATION = 365 days;

    error WrongChain(uint256 actualChainId);
    error CodeMissing(address account);
    error InvalidIdentityLabel();
    error InvalidIdentityExpiry(uint64 expiry);
    error IdentityUnavailable(IPermissionedRegistry.Status status);
    error IdentityBindingMismatch();

    function run() external returns (uint256 tokenId) {
        if (block.chainid != SEPOLIA_CHAIN_ID) revert WrongChain(block.chainid);

        IPermissionedRegistry registry = IPermissionedRegistry(vm.envAddress("SEPOLIA_IDENTITY_REGISTRY"));
        IEnsAddressResolver resolver = IEnsAddressResolver(vm.envAddress("SEPOLIA_IDENTITY_RESOLVER"));
        address agent = vm.envAddress("SEPOLIA_AGENT_ADDRESS");
        string memory label = vm.envString("SEPOLIA_IDENTITY_LABEL");
        bytes32 node = vm.envBytes32("SEPOLIA_IDENTITY_NODE");
        uint64 expiry = uint64(vm.envUint("SEPOLIA_IDENTITY_EXPIRY"));

        if (address(registry).code.length == 0) revert CodeMissing(address(registry));
        if (address(resolver).code.length == 0) revert CodeMissing(address(resolver));
        if (agent == address(0) || node == bytes32(0) || !_isNormalizedLabel(label)) revert InvalidIdentityLabel();
        if (expiry <= block.timestamp || expiry > block.timestamp + MAX_IDENTITY_DURATION) {
            revert InvalidIdentityExpiry(expiry);
        }

        uint256 labelId = uint256(keccak256(bytes(label)));
        IPermissionedRegistry.State memory beforeState = registry.getState(labelId);
        if (beforeState.status != IPermissionedRegistry.Status.AVAILABLE) revert IdentityUnavailable(beforeState.status);

        vm.startBroadcast();
        tokenId = registry.register(label, agent, IRegistry(address(0)), address(resolver), 0, expiry);
        resolver.setAddr(node, agent);
        vm.stopBroadcast();

        IPermissionedRegistry.State memory afterState = registry.getState(labelId);
        if (
            afterState.status != IPermissionedRegistry.Status.REGISTERED || afterState.expiry != expiry
                || registry.ownerOf(afterState.tokenId) != agent || registry.getResolver(label) != address(resolver)
                || resolver.addr(node) != agent
        ) revert IdentityBindingMismatch();
    }

    function _isNormalizedLabel(string memory label) private pure returns (bool) {
        bytes memory value = bytes(label);
        if (value.length == 0) return false;

        for (uint256 i; i < value.length; ++i) {
            bytes1 character = value[i];
            if (character == "." || character == 0x00 || (character >= "A" && character <= "Z")) return false;
        }
        return true;
    }
}
