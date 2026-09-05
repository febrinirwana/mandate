// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import {IAqua} from "@1inch/aqua/src/interfaces/IAqua.sol";
import {MandateAquaApp} from "../src/MandateAquaApp.sol";
import {MockFailingAqua} from "./fixtures/MockFailingAqua.sol";
import {MockPermissionedRegistry} from "./fixtures/MockIdentity.sol";
import {
    MockBalanceMutationToken,
    MockERC20,
    MockFalseReturnToken,
    MockFeeOnTransferToken,
    MockReentrantToken
} from "./fixtures/MockTokens.sol";
import {
    MockExactInputVenue,
    MockPartialSpendVenue,
    MockReentrantVenue,
    MockRevertingVenue,
    MockShortOutputVenue,
    MockWrongRecipientVenue
} from "./fixtures/MockVenues.sol";
import {TestMandateFixture} from "./fixtures/TestMandateFixture.sol";

contract MandateAquaAppTest is TestMandateFixture {
    function testConstructorRejectsExcessiveMaxDuration() public {
        vm.expectRevert(MandateAquaApp.InvalidStrategy.selector);
        new MandateAquaApp(aqua, 366 days);
    }

    function testActivateRequiresMaker() public {
        vm.expectRevert(MandateAquaApp.NotMaker.selector);
        vm.prank(OTHER);
        app.activate(strategy);
    }

    function testActivateRejectsInvalidFields() public {
        MandateAquaApp.Strategy memory invalid = strategy;
        invalid.ensLabel = "invalid.label";

        vm.expectRevert(MandateAquaApp.InvalidStrategy.selector);
        vm.prank(MAKER);
        app.activate(invalid);
    }

    function testActivateRejectsExcessiveDuration() public {
        MandateAquaApp.Strategy memory invalid = strategy;
        invalid.validUntil = invalid.validAfter + MAX_MANDATE_DURATION + 1;

        vm.expectRevert(MandateAquaApp.InvalidStrategy.selector);
        vm.prank(MAKER);
        app.activate(invalid);
    }

    function testActivateRejectsDuplicateHash() public {
        _activate(strategy);

        vm.expectRevert(MandateAquaApp.AlreadyActivated.selector);
        vm.prank(MAKER);
        app.activate(strategy);
    }

    function testActivateRequiresBothAquaTokensActive() public {
        address[] memory tokens = new address[](1);
        tokens[0] = strategy.tokenIn;
        uint256[] memory amounts = new uint256[](1);
        amounts[0] = INPUT_ALLOCATION;
        vm.prank(MAKER);
        aqua.ship(address(app), abi.encode(strategy), tokens, amounts);

        vm.expectRevert();
        vm.prank(MAKER);
        app.activate(strategy);
    }

    function testActivateRequiresExactAquaAndLocalHashEquality() public {
        MandateAquaApp.Strategy memory shipped = strategy;
        shipped.salt = keccak256("different-aqua-strategy");
        _ship(shipped, INPUT_ALLOCATION, OUTPUT_ALLOCATION);

        vm.expectRevert();
        vm.prank(MAKER);
        app.activate(strategy);
    }

    function testExecuteRejectsWrongCaller() public {
        _activate(strategy);

        vm.expectRevert(MandateAquaApp.NotAgent.selector);
        vm.prank(OTHER);
        app.execute(strategy, 1e18, 1e18, uint64(block.timestamp), _route(1e18, 1e18, address(app)));
    }

    function testExecuteRejectsUnregisteredENSName() public {
        _activate(strategy);
        registry.setState(
            uint256(keccak256(bytes(strategy.ensLabel))),
            MockPermissionedRegistry.State({
                status: MockPermissionedRegistry.Status.AVAILABLE,
                expiry: strategy.validUntil + 1,
                latestOwner: AGENT,
                tokenId: 1,
                resource: 0
            })
        );

        vm.expectRevert(MandateAquaApp.ENSNotRegistered.selector);
        _execute(strategy, 1e18, 1e18);
    }

    function testExecuteRejectsExpiredENSName() public {
        _activate(strategy);
        registry.setState(
            uint256(keccak256(bytes(strategy.ensLabel))),
            MockPermissionedRegistry.State({
                status: MockPermissionedRegistry.Status.REGISTERED,
                expiry: uint64(block.timestamp),
                latestOwner: AGENT,
                tokenId: 1,
                resource: 0
            })
        );

        vm.expectRevert(MandateAquaApp.ENSExpired.selector);
        _execute(strategy, 1e18, 1e18);
    }

    function testExecuteUsesCurrentENSStateTokenId() public {
        _activate(strategy);
        registry.setState(
            uint256(keccak256(bytes(strategy.ensLabel))),
            MockPermissionedRegistry.State({
                status: MockPermissionedRegistry.Status.REGISTERED,
                expiry: strategy.validUntil + 1,
                latestOwner: AGENT,
                tokenId: 2,
                resource: 0
            })
        );
        registry.setOwner(2, OTHER);

        vm.expectRevert(MandateAquaApp.ENSOwnerMismatch.selector);
        _execute(strategy, 1e18, 1e18);
    }

    function testExecuteRejectsENSOwnerMismatch() public {
        _activate(strategy);
        registry.setOwner(1, OTHER);

        vm.expectRevert(MandateAquaApp.ENSOwnerMismatch.selector);
        _execute(strategy, 1e18, 1e18);
    }

    function testExecuteRejectsENSResolverMismatch() public {
        _activate(strategy);
        registry.setResolver(strategy.ensLabel, OTHER);

        vm.expectRevert(MandateAquaApp.ENSAddressMismatch.selector);
        _execute(strategy, 1e18, 1e18);
    }

    function testExecuteRejectsENSReadRevert() public {
        _activate(strategy);
        registry.setRevertReads(true);

        vm.expectRevert();
        _execute(strategy, 1e18, 1e18);
    }

    function testExecuteRejectsResolverReadRevert() public {
        _activate(strategy);
        resolver.setRevertReads(true);

        vm.expectRevert();
        _execute(strategy, 1e18, 1e18);
    }

    function testExecuteHonorsTimeWindowEdges() public {
        MandateAquaApp.Strategy memory timed = strategy;
        timed.validAfter = 100;
        timed.validUntil = 200;
        _configureIdentity(timed, AGENT);
        _activate(timed);

        vm.warp(100);
        _execute(timed, 1e18, 1e18);
        vm.warp(199);
        _execute(timed, 1e18, 1e18);
        vm.warp(200);

        vm.expectRevert(MandateAquaApp.Expired.selector);
        _execute(timed, 1e18, 1e18);
    }

    function testExecuteRejectsZeroAmount() public {
        _activate(strategy);

        vm.expectRevert(MandateAquaApp.ZeroAmount.selector);
        _execute(strategy, 0, 0);
    }

    function testExecuteAllowsExactPerCallAndTotalBoundaries() public {
        MandateAquaApp.Strategy memory capped = strategy;
        capped.maxInputPerCall = 10e18;
        capped.maxInputTotal = 20e18;
        _configureIdentity(capped, AGENT);
        _activate(capped);

        _execute(capped, 10e18, 10e18);
        _execute(capped, 10e18, 10e18);
        assertEq(_used(capped), 20e18, "exact total cap was not recorded");
    }

    function testExecuteRejectsPerCallCapBreach() public {
        _activate(strategy);

        vm.expectRevert(MandateAquaApp.PerCallCapExceeded.selector);
        _execute(strategy, PER_CALL_CAP + 1, PER_CALL_CAP + 1);
    }

    function testExecuteRejectsCumulativeCapBreach() public {
        MandateAquaApp.Strategy memory capped = strategy;
        capped.maxInputPerCall = 10e18;
        capped.maxInputTotal = 15e18;
        _configureIdentity(capped, AGENT);
        _activate(capped);
        _execute(capped, 10e18, 10e18);

        vm.expectRevert(MandateAquaApp.TotalCapExceeded.selector);
        _execute(capped, 6e18, 6e18);
    }

    function testExecuteUsesCeilingRateFloor() public {
        MandateAquaApp.Strategy memory rated = strategy;
        rated.minRateNumerator = 3;
        rated.minRateDenominator = 2;
        _configureIdentity(rated, AGENT);
        _activate(rated);

        vm.expectRevert(MandateAquaApp.OutputTooLow.selector);
        _execute(rated, 1, 1);
        _execute(rated, 1, 2);
    }

    function testExecuteRejectsSelectorMismatch() public {
        _activate(strategy);
        bytes memory wrongSelector = abi.encodeWithSelector(bytes4(keccak256("wrong(uint256)")), 1e18);

        vm.expectRevert(MandateAquaApp.WrongSelector.selector);
        vm.prank(AGENT);
        app.execute(strategy, 1e18, 1e18, uint64(block.timestamp), wrongSelector);
    }

    function testExecuteRejectsExpiredExecutionDeadline() public {
        _activate(strategy);
        vm.warp(block.timestamp + 1);

        vm.expectRevert(MandateAquaApp.ExecutionDeadlineExpired.selector);
        vm.prank(AGENT);
        app.execute(strategy, 1e18, 1e18, uint64(block.timestamp - 1), _route(1e18, 1e18, address(app)));
    }

    function testExecutePullsExactlySettlesOutputAndClearsAllowances() public {
        bytes32 hash = _activate(strategy);
        uint256 makerInputBefore = tokenIn.balanceOf(MAKER);
        uint256 makerOutputBefore = tokenOut.balanceOf(MAKER);
        uint256 amount = 10e18;

        _execute(strategy, amount, amount);

        assertEq(tokenIn.balanceOf(MAKER), makerInputBefore - amount, "maker input was not pulled exactly");
        assertEq(tokenOut.balanceOf(MAKER), makerOutputBefore + amount, "maker did not receive output");
        assertEq(tokenIn.balanceOf(address(app)), 0, "input residue remained");
        assertEq(tokenOut.balanceOf(address(app)), 0, "output residue remained");
        assertEq(venue.observedInputAllowance(), amount, "target approval was not exact");
        assertEq(tokenIn.allowance(address(app), address(venue)), 0, "target allowance remained");
        assertEq(tokenOut.allowance(address(app), address(aqua)), 0, "Aqua allowance remained");
        (uint256 inputBalance, uint256 outputBalance) =
            aqua.safeBalances(MAKER, address(app), hash, address(tokenIn), address(tokenOut));
        assertEq(inputBalance, INPUT_ALLOCATION - amount, "Aqua input balance was not decremented");
        assertEq(outputBalance, amount, "Aqua output balance was not incremented");
    }

    function testExecuteEmitsExactSettlementFields() public {
        bytes32 hash = _activate(strategy);
        uint256 amount = 10e18;

        vm.expectEmit(true, true, true, true, address(app));
        emit MandateAquaApp.MandateExecuted(hash, MAKER, AGENT, amount, amount, amount);
        _execute(strategy, amount, amount);
    }

    function testExecutePreservesDirectDustBaselines() public {
        _activate(strategy);
        uint256 inputDust = 7;
        uint256 outputDust = 11;
        tokenIn.mint(address(app), inputDust);
        tokenOut.mint(address(app), outputDust);

        _execute(strategy, 1e18, 1e18);

        assertEq(tokenIn.balanceOf(address(app)), inputDust, "input dust was attributed");
        assertEq(tokenOut.balanceOf(address(app)), outputDust, "output dust was attributed");
    }

    function testRouteRevertRollsBackStateAndBalances() public {
        MockRevertingVenue revertingVenue = new MockRevertingVenue();
        MandateAquaApp.Strategy memory routed = strategy;
        routed.swapTarget = address(revertingVenue);
        routed.swapSelector = MockRevertingVenue.swap.selector;
        routed.salt = keccak256("reverting-route");
        _configureIdentity(routed, AGENT);
        _activate(routed);
        uint256 usedBefore = _used(routed);
        uint256 makerInputBefore = tokenIn.balanceOf(MAKER);
        uint256 makerOutputBefore = tokenOut.balanceOf(MAKER);

        bytes memory routeRevert = abi.encodeWithSelector(MockRevertingVenue.RouteReverted.selector);
        vm.expectRevert(
            abi.encodeWithSelector(
                MandateAquaApp.RouteCallFailed.selector,
                MockRevertingVenue.RouteReverted.selector,
                keccak256(routeRevert)
            )
        );
        vm.prank(AGENT);
        app.execute(
            routed,
            1e18,
            1e18,
            uint64(block.timestamp),
            abi.encodeCall(MockRevertingVenue.swap, (1e18, 1e18, address(app)))
        );
        _assertRollback(routed, usedBefore, makerInputBefore, makerOutputBefore);
    }

    function testShortOutputRollsBackStateAndBalances() public {
        MockShortOutputVenue shortVenue = new MockShortOutputVenue(tokenIn, tokenOut);
        shortVenue.setShortOutput(1);
        tokenOut.mint(address(shortVenue), 1e18);
        MandateAquaApp.Strategy memory routed = strategy;
        routed.swapTarget = address(shortVenue);
        routed.salt = keccak256("short-output");
        _configureIdentity(routed, AGENT);
        _activate(routed);
        uint256 makerInputBefore = tokenIn.balanceOf(MAKER);
        uint256 makerOutputBefore = tokenOut.balanceOf(MAKER);

        vm.expectRevert(MandateAquaApp.OutputTooLow.selector);
        vm.prank(AGENT);
        app.execute(routed, 1e18, 1e18, uint64(block.timestamp), _route(1e18, 1e18, address(app)));
        _assertRollback(routed, 0, makerInputBefore, makerOutputBefore);
    }

    function testPartialSpendRollsBackStateAndBalances() public {
        MockPartialSpendVenue partialVenue = new MockPartialSpendVenue(tokenIn, tokenOut);
        tokenOut.mint(address(partialVenue), 1e18);
        MandateAquaApp.Strategy memory routed = strategy;
        routed.swapTarget = address(partialVenue);
        routed.salt = keccak256("partial-spend");
        _configureIdentity(routed, AGENT);
        _activate(routed);
        uint256 makerInputBefore = tokenIn.balanceOf(MAKER);
        uint256 makerOutputBefore = tokenOut.balanceOf(MAKER);

        vm.expectRevert(MandateAquaApp.InputNotFullySpent.selector);
        vm.prank(AGENT);
        app.execute(routed, 1e18, 1e18, uint64(block.timestamp), _route(1e18, 1e18, address(app)));
        _assertRollback(routed, 0, makerInputBefore, makerOutputBefore);
    }

    function testFalseReturnTokenRollsBackStateAndBalances() public {
        MockFalseReturnToken falseToken = new MockFalseReturnToken();
        MockExactInputVenue falseVenue = new MockExactInputVenue(falseToken, tokenOut);
        falseToken.mint(MAKER, INPUT_ALLOCATION);
        tokenOut.mint(address(falseVenue), 1e18);
        vm.prank(MAKER);
        falseToken.approve(address(aqua), type(uint256).max);
        MandateAquaApp.Strategy memory routed = _strategy(address(falseToken), address(tokenOut), address(falseVenue));
        routed.salt = keccak256("false-token");
        _configureIdentity(routed, AGENT);
        _activate(routed);

        vm.expectRevert();
        vm.prank(AGENT);
        app.execute(routed, 1e18, 1e18, uint64(block.timestamp), _route(1e18, 1e18, address(app)));
        assertEq(_used(routed), 0, "false-return token changed state");
    }

    function testInputBalanceMutationRollsBackStateAndBalances() public {
        MockBalanceMutationToken mutationToken = new MockBalanceMutationToken();
        MockExactInputVenue mutationVenue = new MockExactInputVenue(mutationToken, tokenOut);
        mutationToken.mint(MAKER, INPUT_ALLOCATION);
        tokenOut.mint(address(mutationVenue), 1e18);
        vm.prank(MAKER);
        mutationToken.approve(address(aqua), type(uint256).max);
        MandateAquaApp.Strategy memory routed =
            _strategy(address(mutationToken), address(tokenOut), address(mutationVenue));
        routed.salt = keccak256("input-balance-mutation");
        _configureIdentity(routed, AGENT);
        _activate(routed);
        mutationToken.setMutationRecipient(address(app));
        uint256 makerInputBefore = mutationToken.balanceOf(MAKER);
        vm.expectRevert(MandateAquaApp.InputTransferMismatch.selector);
        vm.prank(AGENT);
        app.execute(routed, 1e18, 1e18, uint64(block.timestamp), _route(1e18, 1e18, address(app)));
        assertEq(_used(routed), 0, "input mutation changed used input");
        assertEq(mutationToken.balanceOf(MAKER), makerInputBefore, "input mutation did not roll back");
    }

    function testOutputTokenCallbackRollsBackStateAndBalances() public {
        MockReentrantToken callbackToken = new MockReentrantToken();
        MockExactInputVenue callbackVenue = new MockExactInputVenue(tokenIn, callbackToken);
        callbackToken.mint(address(callbackVenue), 1e18);
        MandateAquaApp.Strategy memory routed =
            _strategy(address(tokenIn), address(callbackToken), address(callbackVenue));
        routed.salt = keccak256("output-token-callback");
        _configureIdentity(routed, AGENT);
        _activate(routed);
        callbackToken.setCallback(
            address(app),
            abi.encodeCall(app.execute, (routed, 1e18, 1e18, uint64(block.timestamp), _route(1e18, 1e18, address(app))))
        );
        uint256 makerInputBefore = tokenIn.balanceOf(MAKER);
        vm.expectRevert();
        vm.prank(AGENT);
        app.execute(routed, 1e18, 1e18, uint64(block.timestamp), _route(1e18, 1e18, address(app)));
        assertEq(_used(routed), 0, "output callback changed used input");
        assertEq(tokenIn.balanceOf(MAKER), makerInputBefore, "output callback did not roll back input");
        assertEq(callbackToken.balanceOf(MAKER), 0, "output callback credited maker");
    }

    function testFeeOnTransferTokenRollsBackStateAndBalances() public {
        MockFeeOnTransferToken feeToken = new MockFeeOnTransferToken(100, ATTACKER);
        MockExactInputVenue feeVenue = new MockExactInputVenue(feeToken, tokenOut);
        feeToken.mint(MAKER, INPUT_ALLOCATION);
        tokenOut.mint(address(feeVenue), 1e18);
        vm.prank(MAKER);
        feeToken.approve(address(aqua), type(uint256).max);
        MandateAquaApp.Strategy memory routed = _strategy(address(feeToken), address(tokenOut), address(feeVenue));
        routed.salt = keccak256("fee-token");
        _configureIdentity(routed, AGENT);
        _activate(routed);
        uint256 makerInputBefore = feeToken.balanceOf(MAKER);

        vm.expectRevert(MandateAquaApp.InputTransferMismatch.selector);
        vm.prank(AGENT);
        app.execute(routed, 1e18, 1e18, uint64(block.timestamp), _route(1e18, 1e18, address(app)));
        assertEq(_used(routed), 0, "fee token changed used input");
        assertEq(feeToken.balanceOf(MAKER), makerInputBefore, "fee token call did not roll back");
    }

    function testReentrantTokenRollsBackStateAndBalances() public {
        MockReentrantToken reentrantToken = new MockReentrantToken();
        MockExactInputVenue reentrantVenue = new MockExactInputVenue(reentrantToken, tokenOut);
        reentrantToken.mint(MAKER, INPUT_ALLOCATION);
        tokenOut.mint(address(reentrantVenue), 1e18);
        vm.prank(MAKER);
        reentrantToken.approve(address(aqua), type(uint256).max);
        MandateAquaApp.Strategy memory routed =
            _strategy(address(reentrantToken), address(tokenOut), address(reentrantVenue));
        routed.salt = keccak256("reentrant-token");
        _configureIdentity(routed, AGENT);
        _activate(routed);
        reentrantToken.setCallback(
            address(app),
            abi.encodeCall(app.execute, (routed, 1e18, 1e18, uint64(block.timestamp), _route(1e18, 1e18, address(app))))
        );

        vm.expectRevert();
        vm.prank(AGENT);
        app.execute(routed, 1e18, 1e18, uint64(block.timestamp), _route(1e18, 1e18, address(app)));
        assertEq(_used(routed), 0, "reentrant token changed used input");
    }

    function testMaliciousRecipientVenueRollsBackStateAndBalances() public {
        MockWrongRecipientVenue maliciousVenue = new MockWrongRecipientVenue(tokenIn, tokenOut, ATTACKER);
        tokenOut.mint(address(maliciousVenue), 1e18);
        MandateAquaApp.Strategy memory routed = strategy;
        routed.swapTarget = address(maliciousVenue);
        routed.salt = keccak256("wrong-recipient");
        _configureIdentity(routed, AGENT);
        _activate(routed);
        uint256 makerInputBefore = tokenIn.balanceOf(MAKER);
        uint256 makerOutputBefore = tokenOut.balanceOf(MAKER);

        vm.expectRevert(MandateAquaApp.OutputTooLow.selector);
        vm.prank(AGENT);
        app.execute(routed, 1e18, 1e18, uint64(block.timestamp), _route(1e18, 1e18, address(app)));
        _assertRollback(routed, 0, makerInputBefore, makerOutputBefore);
        assertEq(tokenOut.balanceOf(ATTACKER), 0, "malicious output escaped rollback");
    }

    function testReentrantVenueRollsBackStateAndBalances() public {
        MockReentrantVenue reentrantVenue = new MockReentrantVenue(tokenIn, tokenOut);
        tokenOut.mint(address(reentrantVenue), 1e18);
        MandateAquaApp.Strategy memory routed = strategy;
        routed.swapTarget = address(reentrantVenue);
        routed.salt = keccak256("reentrant-venue");
        _configureIdentity(routed, AGENT);
        _activate(routed);
        reentrantVenue.setCallback(
            address(app),
            abi.encodeCall(app.execute, (routed, 1e18, 1e18, uint64(block.timestamp), _route(1e18, 1e18, address(app))))
        );

        vm.expectRevert();
        vm.prank(AGENT);
        app.execute(routed, 1e18, 1e18, uint64(block.timestamp), _route(1e18, 1e18, address(app)));
        assertEq(_used(routed), 0, "reentrant venue changed used input");
    }

    function test_RevertWhenAquaPushFailsRollsBackStateAndBalances() public {
        MockFailingAqua failingAqua = new MockFailingAqua();
        MandateAquaApp failingApp = new MandateAquaApp(IAqua(address(failingAqua)), MAX_MANDATE_DURATION);
        MockERC20 failingInput = new MockERC20("Failing Input", "FIN");
        MockERC20 failingOutput = new MockERC20("Failing Output", "FOUT");
        MockExactInputVenue failingVenue = new MockExactInputVenue(failingInput, failingOutput);
        failingInput.mint(MAKER, INPUT_ALLOCATION);
        failingOutput.mint(address(failingVenue), 1e18);
        vm.prank(MAKER);
        failingInput.approve(address(failingAqua), type(uint256).max);
        MandateAquaApp.Strategy memory failingStrategy =
            _strategy(address(failingInput), address(failingOutput), address(failingVenue));
        failingStrategy.salt = keccak256("failing-aqua-push");
        _configureIdentity(failingStrategy, AGENT);

        address[] memory tokens = new address[](2);
        tokens[0] = address(failingInput);
        tokens[1] = address(failingOutput);
        uint256[] memory amounts = new uint256[](2);
        amounts[0] = INPUT_ALLOCATION;
        vm.prank(MAKER);
        failingAqua.ship(address(failingApp), abi.encode(failingStrategy), tokens, amounts);
        vm.prank(MAKER);
        failingApp.activate(failingStrategy);

        vm.expectRevert(MockFailingAqua.PushFailed.selector);
        vm.prank(AGENT);
        failingApp.execute(
            failingStrategy, 1e18, 1e18, uint64(block.timestamp), _route(1e18, 1e18, address(failingApp))
        );
        (, uint256 used,,) = failingApp.mandates(failingApp.strategyHash(failingStrategy));
        assertEq(used, 0, "failed Aqua push changed used input");
        assertEq(failingInput.balanceOf(MAKER), INPUT_ALLOCATION, "failed Aqua push moved maker input");
    }

    function testRevokeIsMakerOnlyIrreversibleAndStopsExecution() public {
        bytes32 hash = _activate(strategy);

        vm.expectRevert(MandateAquaApp.NotMaker.selector);
        vm.prank(OTHER);
        app.revoke(hash);
        vm.prank(MAKER);
        app.revoke(hash);

        vm.expectRevert(MandateAquaApp.MandateRevokedError.selector);
        _execute(strategy, 1e18, 1e18);
        vm.expectRevert(MandateAquaApp.MandateRevokedError.selector);
        vm.prank(MAKER);
        app.revoke(hash);
    }
}
