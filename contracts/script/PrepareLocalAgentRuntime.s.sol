// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import {IAqua} from "@1inch/aqua/src/interfaces/IAqua.sol";
import {Script} from "forge-std/Script.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {MandateAquaApp} from "../src/MandateAquaApp.sol";
import {LocalOnlyExactInputVenue} from "./LocalOnlyExactInputVenue.sol";

/// @dev Prepares, but does not execute, a deterministic local-only agent runtime fixture.
contract PrepareLocalAgentRuntime is Script {
    using SafeERC20 for IERC20;

    uint256 internal constant INPUT_ALLOCATION = 1_000e18;
    bytes32 internal constant ENS_NODE = keccak256("mandate-agent.eth");

    function run() external returns (bytes32 strategyHash) {
        uint256 ownerKey = vm.envUint("LOCAL_OWNER_PRIVATE_KEY");
        address agent = vm.envAddress("LOCAL_AGENT_ADDRESS");
        string memory json = vm.readFile("broadcast/local-deployment.json");
        IAqua aqua = IAqua(vm.parseJsonAddress(json, ".aqua"));
        MandateAquaApp app = MandateAquaApp(vm.parseJsonAddress(json, ".app"));
        IERC20 tokenIn = IERC20(vm.parseJsonAddress(json, ".tokenIn"));
        IERC20 tokenOut = IERC20(vm.parseJsonAddress(json, ".tokenOut"));
        LocalOnlyExactInputVenue venue = LocalOnlyExactInputVenue(vm.parseJsonAddress(json, ".venue"));

        MandateAquaApp.Strategy memory strategy = MandateAquaApp.Strategy({
            maker: vm.addr(ownerKey),
            agent: agent,
            ensRegistry: vm.parseJsonAddress(json, ".registry"),
            ensResolver: vm.parseJsonAddress(json, ".resolver"),
            ensLabel: "mandate-agent",
            ensNode: ENS_NODE,
            tokenIn: address(tokenIn),
            tokenOut: address(tokenOut),
            swapTarget: address(venue),
            swapSelector: LocalOnlyExactInputVenue.swap.selector,
            minRateNumerator: 1,
            minRateDenominator: 1,
            maxInputPerCall: 100e18,
            maxInputTotal: INPUT_ALLOCATION,
            validAfter: uint64(block.timestamp),
            validUntil: uint64(block.timestamp + 1 days),
            salt: keccak256("local-agent-runtime")
        });

        vm.startBroadcast(ownerKey);
        tokenIn.forceApprove(address(aqua), type(uint256).max);
        address[] memory tokens = new address[](2);
        tokens[0] = address(tokenIn);
        tokens[1] = address(tokenOut);
        uint256[] memory amounts = new uint256[](2);
        amounts[0] = INPUT_ALLOCATION;
        strategyHash = aqua.ship(address(app), abi.encode(strategy), tokens, amounts);
        require(strategyHash == app.strategyHash(strategy), "STRATEGY_HASH_MISMATCH");
        app.activate(strategy);
        vm.stopBroadcast();
    }
}
