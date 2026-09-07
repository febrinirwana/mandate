// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import {IAqua} from "@1inch/aqua/src/interfaces/IAqua.sol";
import {Script} from "forge-std/Script.sol";
import {MandateAquaApp} from "../src/MandateAquaApp.sol";

/// @dev Deploys Mandate against the verified official Aqua Sepolia runtime.
contract DeploySepolia is Script {
    uint256 internal constant SEPOLIA_CHAIN_ID = 11_155_111;
    address internal constant OFFICIAL_SEPOLIA_AQUA = 0x1111113CCf1426A8E30e2bfF5E005d929bF6a90a;
    bytes32 internal constant OFFICIAL_SEPOLIA_AQUA_CODE_HASH =
        0x720bc02d220db318164dc3bade86eec1f3655bdc00fc1174de7d816a95c341f8;
    uint64 internal constant DEFAULT_MAX_MANDATE_DURATION = 30 days;
    uint64 internal constant MAX_MANDATE_DURATION = 365 days;

    error WrongChain(uint256 actualChainId);
    error InvalidMaxMandateDuration(uint256 duration);
    error AquaCodeHashMismatch(bytes32 actualCodeHash);

    function run() external returns (IAqua aqua, MandateAquaApp app) {
        if (block.chainid != SEPOLIA_CHAIN_ID) revert WrongChain(block.chainid);

        uint256 configuredDuration = vm.envOr("SEPOLIA_MAX_MANDATE_DURATION", uint256(DEFAULT_MAX_MANDATE_DURATION));
        if (configuredDuration == 0 || configuredDuration > MAX_MANDATE_DURATION) {
            revert InvalidMaxMandateDuration(configuredDuration);
        }

        bytes32 actualCodeHash = OFFICIAL_SEPOLIA_AQUA.codehash;
        if (actualCodeHash != OFFICIAL_SEPOLIA_AQUA_CODE_HASH) revert AquaCodeHashMismatch(actualCodeHash);

        aqua = IAqua(OFFICIAL_SEPOLIA_AQUA);
        vm.startBroadcast();
        app = new MandateAquaApp(aqua, uint64(configuredDuration));
        vm.stopBroadcast();
    }
}
