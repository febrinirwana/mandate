// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import {IPermissionedRegistry} from "@ensv2/contracts/registry/interfaces/IPermissionedRegistry.sol";
import {Script} from "forge-std/Script.sol";

/// @dev Uses the treasury's registry-level ROLE_UNREGISTER authority as the public stop path.
contract StopEnsIdentity is Script {
    uint256 internal constant SEPOLIA_CHAIN_ID = 11_155_111;

    error WrongChain(uint256 actualChainId);
    error CodeMissing(address account);
    error IdentityNotRegistered();
    error IdentityStillRegistered();

    function run() external {
        if (block.chainid != SEPOLIA_CHAIN_ID) revert WrongChain(block.chainid);

        IPermissionedRegistry registry = IPermissionedRegistry(vm.envAddress("SEPOLIA_IDENTITY_REGISTRY"));
        string memory label = vm.envString("SEPOLIA_IDENTITY_LABEL");
        if (address(registry).code.length == 0) revert CodeMissing(address(registry));

        uint256 labelId = uint256(keccak256(bytes(label)));
        if (registry.getState(labelId).status != IPermissionedRegistry.Status.REGISTERED) {
            revert IdentityNotRegistered();
        }

        vm.startBroadcast();
        registry.unregister(labelId);
        vm.stopBroadcast();

        if (registry.getState(labelId).status == IPermissionedRegistry.Status.REGISTERED) {
            revert IdentityStillRegistered();
        }
    }
}
