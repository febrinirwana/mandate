// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import {Aqua} from "@1inch/aqua/src/Aqua.sol";
import {IAqua} from "@1inch/aqua/src/interfaces/IAqua.sol";
import {Script} from "forge-std/Script.sol";
import {MandateAquaApp} from "../src/MandateAquaApp.sol";

/// @dev Deploys the pinned Aqua source because no compatible official Sepolia deployment is admitted yet.
contract DeploySepolia is Script {
    uint256 internal constant SEPOLIA_CHAIN_ID = 11_155_111;
    uint64 internal constant DEFAULT_MAX_MANDATE_DURATION = 30 days;
    uint64 internal constant MAX_MANDATE_DURATION = 365 days;

    error WrongChain(uint256 actualChainId);
    error InvalidMaxMandateDuration(uint256 duration);

    function run() external returns (IAqua aqua, MandateAquaApp app) {
        if (block.chainid != SEPOLIA_CHAIN_ID) revert WrongChain(block.chainid);

        uint256 configuredDuration = vm.envOr("SEPOLIA_MAX_MANDATE_DURATION", uint256(DEFAULT_MAX_MANDATE_DURATION));
        if (configuredDuration == 0 || configuredDuration > MAX_MANDATE_DURATION) {
            revert InvalidMaxMandateDuration(configuredDuration);
        }

        vm.startBroadcast();
        aqua = IAqua(address(new Aqua()));
        app = new MandateAquaApp(aqua, uint64(configuredDuration));
        vm.stopBroadcast();
    }
}
