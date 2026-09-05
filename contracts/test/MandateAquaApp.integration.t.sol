// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import {Aqua} from "@1inch/aqua/src/Aqua.sol";
import {IAqua} from "@1inch/aqua/src/interfaces/IAqua.sol";
import {Vm} from "forge-std/Vm.sol";
import {MandateAquaApp} from "../src/MandateAquaApp.sol";
import {MockAddrResolver, MockPermissionedRegistry} from "./fixtures/MockIdentity.sol";
import {MockERC20} from "./fixtures/MockTokens.sol";
import {MockExactInputVenue} from "./fixtures/MockVenues.sol";
import {TestMandateFixture} from "./fixtures/TestMandateFixture.sol";

contract MandateAquaAppIntegrationTest is TestMandateFixture {
    uint256 private constant TRADE_AMOUNT = 10e18;

    struct Deployment {
        IAqua aqua;
        MandateAquaApp app;
        MockPermissionedRegistry registry;
        MockAddrResolver resolver;
        MockERC20 tokenIn;
        MockERC20 tokenOut;
        MockExactInputVenue venue;
    }

    function testLocalAquaSettlementSimulatesThenExecutesWithExactDeltas() public {
        vm.deal(AGENT, 1 ether);
        assertGt(AGENT.balance, 0, "agent has no gas");
        assertEq(tokenIn.balanceOf(AGENT), 0, "agent received input tokens");
        assertEq(tokenOut.balanceOf(AGENT), 0, "agent received output tokens");

        bytes32 hash = _activate(strategy);
        uint256 makerInputBefore = tokenIn.balanceOf(MAKER);
        uint256 makerOutputBefore = tokenOut.balanceOf(MAKER);
        (uint248 rawInputBefore, uint8 inputTokenCount) = aqua.rawBalances(MAKER, address(app), hash, address(tokenIn));
        (uint248 rawOutputBefore, uint8 outputTokenCount) =
            aqua.rawBalances(MAKER, address(app), hash, address(tokenOut));
        assertEq(inputTokenCount, 2, "input token is not active in Aqua");
        assertEq(outputTokenCount, 2, "output token is not active in Aqua");
        assertEq(rawInputBefore, INPUT_ALLOCATION, "unexpected input allocation");
        assertEq(rawOutputBefore, OUTPUT_ALLOCATION, "unexpected output allocation");

        uint256 simulation = vm.snapshotState();
        uint256 simulatedOutput = _execute(strategy, TRADE_AMOUNT, TRADE_AMOUNT);
        assertEq(simulatedOutput, TRADE_AMOUNT, "simulation returned unexpected output");
        assertTrue(vm.revertToState(simulation), "simulation state was not restored");
        assertEq(_used(strategy), 0, "simulation consumed strategy input");
        assertEq(tokenIn.balanceOf(MAKER), makerInputBefore, "simulation changed maker input");
        assertEq(tokenOut.balanceOf(MAKER), makerOutputBefore, "simulation changed maker output");

        vm.recordLogs();
        uint256 amountOut = _execute(strategy, TRADE_AMOUNT, TRADE_AMOUNT);
        Vm.Log[] memory logs = vm.getRecordedLogs();

        assertEq(amountOut, TRADE_AMOUNT, "execution returned unexpected output");
        assertEq(tokenIn.balanceOf(MAKER), makerInputBefore - TRADE_AMOUNT, "maker input delta is not exact");
        assertEq(tokenOut.balanceOf(MAKER), makerOutputBefore + TRADE_AMOUNT, "maker output delta is not exact");
        assertEq(_used(strategy), TRADE_AMOUNT, "used input is not exact");
        assertEq(tokenIn.balanceOf(address(app)), 0, "app retained input");
        assertEq(tokenOut.balanceOf(address(app)), 0, "app retained output");
        assertEq(tokenIn.allowance(address(app), address(venue)), 0, "venue approval remained");
        assertEq(tokenOut.allowance(address(app), address(aqua)), 0, "Aqua approval remained");
        assertEq(tokenIn.balanceOf(AGENT), 0, "agent received input tokens after execution");
        assertEq(tokenOut.balanceOf(AGENT), 0, "agent received output tokens after execution");

        (uint248 rawInputAfter, uint8 inputTokenCountAfter) =
            aqua.rawBalances(MAKER, address(app), hash, address(tokenIn));
        (uint248 rawOutputAfter, uint8 outputTokenCountAfter) =
            aqua.rawBalances(MAKER, address(app), hash, address(tokenOut));
        assertEq(inputTokenCountAfter, 2, "input token was deactivated");
        assertEq(outputTokenCountAfter, 2, "output token was deactivated");
        assertEq(rawInputAfter, INPUT_ALLOCATION - TRADE_AMOUNT, "Aqua input delta is not exact");
        assertEq(rawOutputAfter, TRADE_AMOUNT, "Aqua output delta is not exact");
        assertTrue(
            _containsEvent(logs, address(aqua), keccak256("Pulled(address,address,bytes32,address,uint256)")),
            "Aqua pull was not emitted"
        );
        assertTrue(
            _containsEvent(logs, address(aqua), keccak256("Pushed(address,address,bytes32,address,uint256)")),
            "Aqua push was not emitted"
        );
        assertTrue(
            _containsEvent(
                logs, address(app), keccak256("MandateExecuted(bytes32,address,address,uint256,uint256,uint256)")
            ),
            "Mandate execution was not emitted"
        );
    }

    function testLocalAquaSettlementRejectsWrongSignerCapPoorOutputAndRevocation() public {
        bytes32 hash = _activate(strategy);
        uint256 makerInputBefore = tokenIn.balanceOf(MAKER);

        vm.expectRevert(MandateAquaApp.NotAgent.selector);
        vm.prank(OTHER);
        app.execute(
            strategy,
            TRADE_AMOUNT,
            TRADE_AMOUNT,
            uint64(block.timestamp),
            _route(TRADE_AMOUNT, TRADE_AMOUNT, address(app))
        );

        uint256 capBreach = strategy.maxInputPerCall + 1;
        vm.expectRevert(MandateAquaApp.PerCallCapExceeded.selector);
        vm.prank(AGENT);
        app.execute(strategy, capBreach, capBreach, uint64(block.timestamp), _route(capBreach, capBreach, address(app)));

        vm.expectRevert(MandateAquaApp.OutputTooLow.selector);
        vm.prank(AGENT);
        app.execute(
            strategy,
            TRADE_AMOUNT,
            TRADE_AMOUNT + 1,
            uint64(block.timestamp),
            _route(TRADE_AMOUNT, TRADE_AMOUNT, address(app))
        );
        assertEq(_used(strategy), 0, "rejected execution consumed input");
        assertEq(tokenIn.balanceOf(MAKER), makerInputBefore, "rejected execution changed maker input");

        vm.prank(MAKER);
        app.revoke(hash);
        vm.expectRevert(MandateAquaApp.MandateRevokedError.selector);
        _execute(strategy, TRADE_AMOUNT, TRADE_AMOUNT);
    }

    function testCleanLocalDeploymentReproducesAddressesCodeAndStrategyHash() public {
        uint256 snapshot = vm.snapshotState();
        Deployment memory first = _deployClean();
        bytes32 firstHash = first.app.strategyHash(_strategyFor(first));
        bytes32 firstAquaCodehash = address(first.aqua).codehash;
        bytes32 firstAppCodehash = address(first.app).codehash;
        bytes32 firstVenueCodehash = address(first.venue).codehash;

        assertTrue(vm.revertToState(snapshot), "first local deployment was not reset");
        Deployment memory second = _deployClean();
        bytes32 secondHash = second.app.strategyHash(_strategyFor(second));

        assertEq(address(second.aqua), address(first.aqua), "Aqua address is not reproducible");
        assertEq(address(second.app), address(first.app), "Mandate address is not reproducible");
        assertEq(address(second.registry), address(first.registry), "registry address is not reproducible");
        assertEq(address(second.resolver), address(first.resolver), "resolver address is not reproducible");
        assertEq(address(second.tokenIn), address(first.tokenIn), "input token address is not reproducible");
        assertEq(address(second.tokenOut), address(first.tokenOut), "output token address is not reproducible");
        assertEq(address(second.venue), address(first.venue), "venue address is not reproducible");
        assertEq(address(second.aqua).codehash, firstAquaCodehash, "Aqua bytecode changed");
        assertEq(address(second.app).codehash, firstAppCodehash, "Mandate bytecode changed");
        assertEq(address(second.venue).codehash, firstVenueCodehash, "venue bytecode changed");
        assertEq(secondHash, firstHash, "strategy hash is not reproducible");
    }

    function _deployClean() private returns (Deployment memory deployment) {
        deployment.aqua = IAqua(address(new Aqua()));
        deployment.app = new MandateAquaApp(deployment.aqua, MAX_MANDATE_DURATION);
        deployment.registry = new MockPermissionedRegistry();
        deployment.resolver = new MockAddrResolver();
        deployment.tokenIn = new MockERC20("Local Input", "LIN");
        deployment.tokenOut = new MockERC20("Local Output", "LOUT");
        deployment.venue = new MockExactInputVenue(deployment.tokenIn, deployment.tokenOut);
    }

    function _strategyFor(Deployment memory deployment) private view returns (MandateAquaApp.Strategy memory) {
        return MandateAquaApp.Strategy({
            maker: MAKER,
            agent: AGENT,
            ensRegistry: address(deployment.registry),
            ensResolver: address(deployment.resolver),
            ensLabel: "mandate-agent",
            ensNode: keccak256("mandate-agent.eth"),
            tokenIn: address(deployment.tokenIn),
            tokenOut: address(deployment.tokenOut),
            swapTarget: address(deployment.venue),
            swapSelector: MockExactInputVenue.swap.selector,
            minRateNumerator: 1,
            minRateDenominator: 1,
            maxInputPerCall: PER_CALL_CAP,
            maxInputTotal: TOTAL_CAP,
            validAfter: uint64(block.timestamp),
            validUntil: uint64(block.timestamp + 1 days),
            salt: keccak256("local-reproducibility")
        });
    }

    function _containsEvent(Vm.Log[] memory logs, address emitter, bytes32 signature) private pure returns (bool) {
        for (uint256 i; i < logs.length; ++i) {
            if (logs[i].emitter == emitter && logs[i].topics.length > 0 && logs[i].topics[0] == signature) return true;
        }
        return false;
    }
}
