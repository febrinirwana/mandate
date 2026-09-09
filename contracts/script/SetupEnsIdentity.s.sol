// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import {IPermissionedRegistry} from "@ensv2/contracts/registry/interfaces/IPermissionedRegistry.sol";
import {IRegistry} from "@ensv2/contracts/registry/interfaces/IRegistry.sol";
import {Script} from "forge-std/Script.sol";
import {EnsNamehash} from "./EnsNamehash.sol";

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
        bytes32 parentNode = deriveEthParentNode(vm.envString("SEPOLIA_PARENT_LABEL"));
        uint64 expiry = uint64(vm.envUint("SEPOLIA_IDENTITY_EXPIRY"));
        bytes32 node = deriveNode(parentNode, label);

        if (address(registry).code.length == 0) revert CodeMissing(address(registry));
        if (address(resolver).code.length == 0) revert CodeMissing(address(resolver));
        if (agent == address(0)) revert InvalidIdentityLabel();
        if (expiry <= block.timestamp || expiry > block.timestamp + MAX_IDENTITY_DURATION) {
            revert InvalidIdentityExpiry(expiry);
        }

        uint256 labelId = uint256(keccak256(bytes(label)));
        IPermissionedRegistry.State memory beforeState = registry.getState(labelId);
        if (beforeState.status != IPermissionedRegistry.Status.AVAILABLE) {
            revert IdentityUnavailable(beforeState.status);
        }

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

    /// @dev Computes the ENS child node from the selected parent and normalized immediate label.
    function deriveNode(bytes32 parentNode, string memory label) public pure returns (bytes32) {
        if (!EnsNamehash.isNormalizedLabel(label)) revert InvalidIdentityLabel();
        return EnsNamehash.derive(parentNode, label);
    }

    function deriveEthParentNode(string memory parentLabel) public pure returns (bytes32) {
        if (!EnsNamehash.isNormalizedLabel(parentLabel)) revert InvalidIdentityLabel();
        return EnsNamehash.derive(EnsNamehash.ethNode(), parentLabel);
    }
}
