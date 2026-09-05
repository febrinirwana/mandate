// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import {IAqua} from "@1inch/aqua/src/interfaces/IAqua.sol";
import {Script} from "forge-std/Script.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {MandateAquaApp} from "../src/MandateAquaApp.sol";
import {LocalOnlyExactInputVenue} from "./LocalOnlyExactInputVenue.sol";

/// @dev Completes the deterministic local-Anvil fixture created by DeployLocal.
contract SetupLocalStrategy is Script {
    using SafeERC20 for IERC20;

    uint256 internal constant INPUT_ALLOCATION = 1_000e18;
    uint256 internal constant TRADE_AMOUNT = 10e18;
    bytes32 internal constant ENS_NODE = keccak256("mandate-agent.eth");
    string internal constant ENS_LABEL = "mandate-agent";

    function run() external returns (bytes32 strategyHash) {
        uint256 ownerKey = vm.envUint("LOCAL_OWNER_PRIVATE_KEY");
        uint256 agentKey = vm.envUint("LOCAL_AGENT_PRIVATE_KEY");
        address maker = vm.addr(ownerKey);
        address agent = vm.addr(agentKey);
        string memory json = vm.readFile("broadcast/local-deployment.json");
        IAqua aqua = IAqua(vm.parseJsonAddress(json, ".aqua"));
        MandateAquaApp app = MandateAquaApp(vm.parseJsonAddress(json, ".app"));
        address registry = vm.parseJsonAddress(json, ".registry");
        address resolver = vm.parseJsonAddress(json, ".resolver");
        IERC20 tokenIn = IERC20(vm.parseJsonAddress(json, ".tokenIn"));
        IERC20 tokenOut = IERC20(vm.parseJsonAddress(json, ".tokenOut"));
        LocalOnlyExactInputVenue venue = LocalOnlyExactInputVenue(vm.parseJsonAddress(json, ".venue"));
        require(agent == vm.envAddress("LOCAL_AGENT_ADDRESS"), "AGENT_ADDRESS_MISMATCH");
        require(tokenIn.balanceOf(agent) == 0 && tokenOut.balanceOf(agent) == 0, "AGENT_HAS_STRATEGY_TOKENS");
        require(keccak256(bytes(venue.DEPLOYMENT_SCOPE())) == keccak256("LOCAL_ANVIL_ONLY"), "NOT_LOCAL_VENUE");

        MandateAquaApp.Strategy memory strategy = MandateAquaApp.Strategy({
            maker: maker,
            agent: agent,
            ensRegistry: registry,
            ensResolver: resolver,
            ensLabel: ENS_LABEL,
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
            salt: keccak256("local-anvil-mandate")
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

        vm.startBroadcast(agentKey);
        uint256 amountOut = app.execute(
            strategy,
            TRADE_AMOUNT,
            TRADE_AMOUNT,
            uint64(block.timestamp + 5 minutes),
            abi.encodeCall(LocalOnlyExactInputVenue.swap, (TRADE_AMOUNT, TRADE_AMOUNT, address(app)))
        );
        vm.stopBroadcast();

        (uint248 rawInput, uint8 inputTokenCount) = aqua.rawBalances(maker, address(app), strategyHash, address(tokenIn));
        (uint248 rawOutput, uint8 outputTokenCount) = aqua.rawBalances(maker, address(app), strategyHash, address(tokenOut));
        require(amountOut == TRADE_AMOUNT, "UNEXPECTED_OUTPUT");
        require(rawInput == INPUT_ALLOCATION - TRADE_AMOUNT && rawOutput == TRADE_AMOUNT, "AQUA_DELTA_MISMATCH");
        require(inputTokenCount == 2 && outputTokenCount == 2, "AQUA_STRATEGY_INACTIVE");
        require(tokenIn.balanceOf(address(app)) == 0 && tokenOut.balanceOf(address(app)) == 0, "APP_RESIDUE");
        require(tokenIn.allowance(address(app), address(venue)) == 0, "VENUE_ALLOWANCE");
        require(tokenOut.allowance(address(app), address(aqua)) == 0, "AQUA_ALLOWANCE");

        vm.startBroadcast(ownerKey);
        app.revoke(strategyHash);
        vm.stopBroadcast();
    }
}
