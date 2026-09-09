// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import {IPermissionedRegistry} from "@ensv2/contracts/registry/interfaces/IPermissionedRegistry.sol";
import {IRegistry} from "@ensv2/contracts/registry/interfaces/IRegistry.sol";
import {Script} from "forge-std/Script.sol";
import {EnsNamehash} from "./EnsNamehash.sol";

interface IRepairEnsAddressResolver {
    function addr(bytes32 node) external view returns (address);
    function hasRootRoles(uint256 roleBitmap, address account) external view returns (bool);
    function setAddr(bytes32 node, address account) external;
}

/// @dev Repairs the pre-standard-namehash resolver record created by an early namespace provisioner.
contract RepairEnsIdentity is Script {
    uint256 internal constant SEPOLIA_CHAIN_ID = 11_155_111;
    uint256 internal constant ROLE_SET_ADDR = 1 << 0;

    IRegistry internal constant ETH_REGISTRY = IRegistry(0xBDC85dD5b15D7ecb354cd7cb6f2c50b4f2c4F0E2);

    error WrongChain(uint256 actualChainId);
    error CodeMissing(address account);
    error InvalidIdentityLabel();
    error NamespaceLinkMismatch();
    error IdentityStateMismatch();
    error ResolverAuthorityMissing();
    error UnexpectedResolverBindings(address standardAddress, address legacyAddress);
    error IdentityBindingMismatch();

    function run() external returns (bytes32 standardNode, bytes32 legacyNode) {
        if (block.chainid != SEPOLIA_CHAIN_ID) revert WrongChain(block.chainid);

        address owner = vm.envAddress("SEPOLIA_OWNER_ADDRESS");
        address agent = vm.envAddress("SEPOLIA_AGENT_ADDRESS");
        IPermissionedRegistry registry = IPermissionedRegistry(vm.envAddress("SEPOLIA_IDENTITY_REGISTRY"));
        IRepairEnsAddressResolver resolver = IRepairEnsAddressResolver(vm.envAddress("SEPOLIA_IDENTITY_RESOLVER"));
        string memory parentLabel = vm.envString("SEPOLIA_PARENT_LABEL");
        string memory label = vm.envString("SEPOLIA_IDENTITY_LABEL");
        (standardNode, legacyNode) = deriveNodes(parentLabel, label);

        _preflight(owner, agent, registry, resolver, parentLabel, label);

        address standardAddress = resolver.addr(standardNode);
        address legacyAddress = resolver.addr(legacyNode);
        if (standardAddress == agent && legacyAddress == address(0)) return (standardNode, legacyNode);
        if (standardAddress != address(0) || legacyAddress != agent) {
            revert UnexpectedResolverBindings(standardAddress, legacyAddress);
        }

        vm.startBroadcast();
        resolver.setAddr(standardNode, agent);
        resolver.setAddr(legacyNode, address(0));
        vm.stopBroadcast();

        if (resolver.addr(standardNode) != agent || resolver.addr(legacyNode) != address(0)) {
            revert IdentityBindingMismatch();
        }
    }

    function deriveNodes(string memory parentLabel, string memory label)
        public
        pure
        returns (bytes32 standardNode, bytes32 legacyNode)
    {
        if (!EnsNamehash.isNormalizedLabel(parentLabel) || !EnsNamehash.isNormalizedLabel(label)) {
            revert InvalidIdentityLabel();
        }

        standardNode = EnsNamehash.derive(EnsNamehash.derive(EnsNamehash.ethNode(), parentLabel), label);
        bytes32 legacyParentNode = keccak256(abi.encodePacked(keccak256(bytes("eth")), keccak256(bytes(parentLabel))));
        legacyNode = EnsNamehash.derive(legacyParentNode, label);
    }

    function _preflight(
        address owner,
        address agent,
        IPermissionedRegistry registry,
        IRepairEnsAddressResolver resolver,
        string memory parentLabel,
        string memory label
    ) private view {
        if (owner == address(0) || agent == address(0)) revert InvalidIdentityLabel();
        if (address(ETH_REGISTRY).code.length == 0) revert CodeMissing(address(ETH_REGISTRY));
        if (address(registry).code.length == 0) revert CodeMissing(address(registry));
        if (address(resolver).code.length == 0) revert CodeMissing(address(resolver));
        if (address(ETH_REGISTRY.getSubregistry(parentLabel)) != address(registry)) revert NamespaceLinkMismatch();

        (IRegistry canonicalParent, string memory canonicalLabel) = IRegistry(address(registry)).getParent();
        if (
            address(canonicalParent) != address(ETH_REGISTRY)
                || keccak256(bytes(canonicalLabel)) != keccak256(bytes(parentLabel))
        ) revert NamespaceLinkMismatch();

        IPermissionedRegistry.State memory state = registry.getState(uint256(keccak256(bytes(label))));
        if (
            state.status != IPermissionedRegistry.Status.REGISTERED || state.expiry <= block.timestamp
                || registry.ownerOf(state.tokenId) != agent || registry.getResolver(label) != address(resolver)
        ) revert IdentityStateMismatch();
        if (!resolver.hasRootRoles(ROLE_SET_ADDR, owner)) revert ResolverAuthorityMissing();
    }
}
