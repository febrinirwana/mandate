// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import {IRegistry} from "@ensv2/contracts/registry/interfaces/IRegistry.sol";
import {IPermissionedRegistry} from "@ensv2/contracts/registry/interfaces/IPermissionedRegistry.sol";
import {Script} from "forge-std/Script.sol";
import {EnsNamehash} from "./EnsNamehash.sol";

interface IVerifiableFactory {
    function deployProxy(address implementation, uint256 salt, bytes calldata data) external returns (address proxy);

    function verifyContract(address proxy) external view returns (address implementation);
}

interface IUserRegistryInitializer {
    function initialize(address rootAccount, uint256 roleBitmap) external;
}

interface IPermissionedResolverInitializer {
    function initialize(address admin, uint256 roleBitmap, bytes[] calldata setters) external;

    function hasRootRoles(uint256 roleBitmap, address account) external view returns (bool);
}

/// @dev Creates the treasury-controlled ENSv2 namespace used solely for Mandate agent identities.
contract ProvisionEnsNamespace is Script {
    uint256 internal constant SEPOLIA_CHAIN_ID = 11_155_111;

    IPermissionedRegistry internal constant ETH_REGISTRY =
        IPermissionedRegistry(0xBDC85dD5b15D7ecb354cd7cb6f2c50b4f2c4F0E2);
    IVerifiableFactory internal constant VERIFIABLE_FACTORY =
        IVerifiableFactory(0x10dC6333CDFe1FCEf624c6e0a8221b91804Cd7ef);
    address internal constant USER_REGISTRY_IMPLEMENTATION = 0x624a25d67B59D587752EbEc8DdeD8827dAe52050;
    address internal constant RESOLVER_IMPLEMENTATION = 0x9EAe5C2730a7dD16BDD1DeE6421a1B91e3B0365e;

    bytes32 internal constant ETH_REGISTRY_CODE_HASH =
        0x99a6ba74173ac220fd9d7a2000a8142cf52d98c7a17ac6abc6d74fa17d8f086c;
    bytes32 internal constant VERIFIABLE_FACTORY_CODE_HASH =
        0x810afc44bd6c35ac974ab80a8cf983cc6e514364b7a214b3a25df2d4e1e7ba60;
    bytes32 internal constant USER_REGISTRY_IMPLEMENTATION_CODE_HASH =
        0xd679dfbaf84c259c5421131dddc2bf674ac008c0494d776500284e37e96f1d2b;
    bytes32 internal constant RESOLVER_IMPLEMENTATION_CODE_HASH =
        0x7a5bbb7f5a8e46232a4437e8eea6cc6e935266ade1b8b027e4e04fb9ca8efd47;

    uint256 internal constant ROLE_REGISTRAR = 1 << 0;
    uint256 internal constant ROLE_SET_PARENT = 1 << 8;
    uint256 internal constant ROLE_UNREGISTER = 1 << 12;
    uint256 internal constant ROLE_SET_SUBREGISTRY = 1 << 20;
    uint256 internal constant ROLE_SET_ADDR = 1 << 0;
    uint256 internal constant ROLE_SET_PARENT_ADMIN = ROLE_SET_PARENT << 128;

    error WrongChain(uint256 actualChainId);
    error CodeMissing(address account);
    error OfficialCodeHashMismatch(address account, bytes32 actualCodeHash);
    error InvalidParentLabel();
    error InvalidAddress();
    error ParentUnavailable(IPermissionedRegistry.Status status);
    error ParentOwnershipMismatch(address actualOwner);
    error ParentAuthorityMissing();
    error NamespaceAlreadyConfigured(address registry);
    error FactoryVerificationMismatch(address proxy, address implementation);
    error NamespaceLinkMismatch();
    error NamespaceAuthorityMismatch();

    function run() external returns (address registry, address resolver, bytes32 parentNode) {
        if (block.chainid != SEPOLIA_CHAIN_ID) revert WrongChain(block.chainid);

        address owner = vm.envAddress("SEPOLIA_OWNER_ADDRESS");
        address agent = vm.envAddress("SEPOLIA_AGENT_ADDRESS");
        string memory parentLabel = vm.envString("SEPOLIA_PARENT_LABEL");
        if (owner == address(0) || agent == address(0)) revert InvalidAddress();
        parentNode = deriveEthParentNode(parentLabel);

        uint256 parentLabelId = _preflight(owner, parentLabel);

        vm.startBroadcast();
        registry = VERIFIABLE_FACTORY.deployProxy(
            USER_REGISTRY_IMPLEMENTATION,
            _registrySalt(owner, parentLabel),
            abi.encodeCall(IUserRegistryInitializer.initialize, (owner, userRegistryInitialRoles()))
        );
        resolver = VERIFIABLE_FACTORY.deployProxy(
            RESOLVER_IMPLEMENTATION,
            _resolverSalt(owner, parentLabel),
            abi.encodeCall(IPermissionedResolverInitializer.initialize, (owner, resolverInitialRoles(), new bytes[](0)))
        );
        ETH_REGISTRY.setSubregistry(parentLabelId, IRegistry(registry));
        IPermissionedRegistry(registry).setParent(ETH_REGISTRY, parentLabel);
        IPermissionedRegistry(registry).revokeRootRoles(ROLE_SET_PARENT | ROLE_SET_PARENT_ADMIN, owner);
        vm.stopBroadcast();

        _verify(owner, parentLabel, registry, resolver);
    }

    function deriveEthParentNode(string memory parentLabel) public pure returns (bytes32) {
        if (!EnsNamehash.isNormalizedLabel(parentLabel)) revert InvalidParentLabel();
        return EnsNamehash.derive(EnsNamehash.ethNode(), parentLabel);
    }

    function userRegistryInitialRoles() public pure returns (uint256) {
        return ROLE_REGISTRAR | ROLE_SET_PARENT | ROLE_UNREGISTER | ROLE_SET_PARENT_ADMIN;
    }

    function resolverInitialRoles() public pure returns (uint256) {
        return ROLE_SET_ADDR;
    }

    function _preflight(address owner, string memory parentLabel) private view returns (uint256 parentLabelId) {
        _validateOfficialContracts();

        parentLabelId = uint256(keccak256(bytes(parentLabel)));
        IPermissionedRegistry.State memory state = ETH_REGISTRY.getState(parentLabelId);
        if (state.status != IPermissionedRegistry.Status.REGISTERED) revert ParentUnavailable(state.status);

        address parentOwner = ETH_REGISTRY.ownerOf(state.tokenId);
        if (parentOwner != owner) revert ParentOwnershipMismatch(parentOwner);
        if (!ETH_REGISTRY.hasRoles(parentLabelId, ROLE_SET_SUBREGISTRY, owner)) revert ParentAuthorityMissing();

        IRegistry existingRegistry = ETH_REGISTRY.getSubregistry(parentLabel);
        if (address(existingRegistry) != address(0)) revert NamespaceAlreadyConfigured(address(existingRegistry));
    }

    function _verify(address owner, string memory parentLabel, address registry, address resolver) private view {
        if (VERIFIABLE_FACTORY.verifyContract(registry) != USER_REGISTRY_IMPLEMENTATION) {
            revert FactoryVerificationMismatch(registry, USER_REGISTRY_IMPLEMENTATION);
        }
        if (VERIFIABLE_FACTORY.verifyContract(resolver) != RESOLVER_IMPLEMENTATION) {
            revert FactoryVerificationMismatch(resolver, RESOLVER_IMPLEMENTATION);
        }
        if (address(ETH_REGISTRY.getSubregistry(parentLabel)) != registry) revert NamespaceLinkMismatch();

        (IRegistry canonicalParent, string memory canonicalLabel) = IRegistry(registry).getParent();
        if (
            address(canonicalParent) != address(ETH_REGISTRY)
                || keccak256(bytes(canonicalLabel)) != keccak256(bytes(parentLabel))
        ) {
            revert NamespaceLinkMismatch();
        }

        IPermissionedRegistry userRegistry = IPermissionedRegistry(registry);
        if (
            !userRegistry.hasRootRoles(ROLE_REGISTRAR | ROLE_UNREGISTER, owner)
                || userRegistry.hasRootRoles(ROLE_SET_PARENT | ROLE_SET_PARENT_ADMIN, owner)
                || !IPermissionedResolverInitializer(resolver).hasRootRoles(ROLE_SET_ADDR, owner)
        ) revert NamespaceAuthorityMismatch();
    }

    function _validateOfficialContracts() private view {
        if (address(ETH_REGISTRY).code.length == 0) revert CodeMissing(address(ETH_REGISTRY));
        if (address(VERIFIABLE_FACTORY).code.length == 0) revert CodeMissing(address(VERIFIABLE_FACTORY));
        if (USER_REGISTRY_IMPLEMENTATION.code.length == 0) revert CodeMissing(USER_REGISTRY_IMPLEMENTATION);
        if (RESOLVER_IMPLEMENTATION.code.length == 0) revert CodeMissing(RESOLVER_IMPLEMENTATION);
        if (address(ETH_REGISTRY).codehash != ETH_REGISTRY_CODE_HASH) {
            revert OfficialCodeHashMismatch(address(ETH_REGISTRY), address(ETH_REGISTRY).codehash);
        }
        if (address(VERIFIABLE_FACTORY).codehash != VERIFIABLE_FACTORY_CODE_HASH) {
            revert OfficialCodeHashMismatch(address(VERIFIABLE_FACTORY), address(VERIFIABLE_FACTORY).codehash);
        }
        if (USER_REGISTRY_IMPLEMENTATION.codehash != USER_REGISTRY_IMPLEMENTATION_CODE_HASH) {
            revert OfficialCodeHashMismatch(USER_REGISTRY_IMPLEMENTATION, USER_REGISTRY_IMPLEMENTATION.codehash);
        }
        if (RESOLVER_IMPLEMENTATION.codehash != RESOLVER_IMPLEMENTATION_CODE_HASH) {
            revert OfficialCodeHashMismatch(RESOLVER_IMPLEMENTATION, RESOLVER_IMPLEMENTATION.codehash);
        }
    }

    function _registrySalt(address owner, string memory parentLabel) private pure returns (uint256) {
        return uint256(keccak256(abi.encode(owner, parentLabel, "mandate-user-registry-v1")));
    }

    function _resolverSalt(address owner, string memory parentLabel) private pure returns (uint256) {
        return uint256(keccak256(abi.encode(owner, parentLabel, "mandate-agent-resolver-v1")));
    }
}
