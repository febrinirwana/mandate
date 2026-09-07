// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import {IPermissionedRegistry} from "@ensv2/contracts/registry/interfaces/IPermissionedRegistry.sol";
import {MandateAquaApp} from "../src/MandateAquaApp.sol";
import {SepoliaProofConfig} from "./SepoliaProofConfig.sol";

/// @dev Builds a zero-value agent call that reaches ENS validation before reverting on a stopped identity.
contract BuildSepoliaStopProbe is SepoliaProofConfig {
    uint64 internal constant PROBE_WINDOW = 5 minutes;
    string internal constant STOP_PROBE_PATH = "broadcast/sepolia-stop-probe.json";

    error IdentityStillRegistered();
    error ProofExpired();

    function run() external returns (address target, bytes memory data) {
        if (block.chainid != SEPOLIA_CHAIN_ID) revert WrongChain(block.chainid);

        Proof memory proof = _readProof();
        if (
            IPermissionedRegistry(proof.strategy.ensRegistry)
                .getState(uint256(keccak256(bytes(proof.strategy.ensLabel))))
                .status == IPermissionedRegistry.Status.REGISTERED
        ) revert IdentityStillRegistered();
        if (block.timestamp >= proof.strategy.validUntil) revert ProofExpired();

        uint64 deadline = uint64(block.timestamp + PROBE_WINDOW);
        target = address(proof.app);
        data = abi.encodeCall(MandateAquaApp.execute, (proof.strategy, 0, 0, deadline, bytes("")));

        string memory json = vm.serializeAddress("probe", "to", target);
        json = vm.serializeBytes("probe", "data", data);
        json = vm.serializeBytes("probe", "expectedError", abi.encodePacked(MandateAquaApp.ENSNotRegistered.selector));
        json = vm.serializeBytes32("probe", "strategyHash", proof.strategyHash);
        json = vm.serializeUint("probe", "deadline", deadline);
        vm.writeJson(json, STOP_PROBE_PATH);
    }
}
