// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import {MandateAquaApp} from "../src/MandateAquaApp.sol";
import {TestMandateFixture} from "./fixtures/TestMandateFixture.sol";

contract MandateAquaAppFuzzTest is TestMandateFixture {
    function testFuzz_MinimumOutputUsesFullPrecisionCeiling(uint64 amountIn, uint64 numerator, uint64 denominator)
        public
        view
    {
        amountIn = uint64(bound(amountIn, 1, type(uint64).max));
        numerator = uint64(bound(numerator, 1, type(uint64).max));
        denominator = uint64(bound(denominator, 1, type(uint64).max));

        uint256 product = uint256(amountIn) * uint256(numerator);
        uint256 expected = (product / denominator) + (product % denominator == 0 ? 0 : 1);
        assertEq(app.minimumOutput(strategy, amountIn), expected, "minimum output did not round up");
    }

    function testFuzz_ExactAllowedAmountNeverExceedsTotal(uint96 rawAmount) public {
        uint256 amount = bound(uint256(rawAmount), 1, PER_CALL_CAP);
        _activate(strategy);

        _execute(strategy, amount, amount);

        assertEq(_used(strategy), amount, "used input did not equal exact input");
        assertLe(_used(strategy), strategy.maxInputTotal, "used input exceeded total cap");
    }

    function testFuzz_CumulativeCapRejectsOneUnitOver(uint64 firstRaw, uint64 secondRaw) public {
        uint256 first = bound(uint256(firstRaw), 1, 50e18);
        uint256 second = bound(uint256(secondRaw), 1, 50e18);
        MandateAquaApp.Strategy memory capped = strategy;
        capped.maxInputPerCall = 50e18;
        capped.maxInputTotal = first + second;
        _configureIdentity(capped, AGENT);
        _activate(capped);

        _execute(capped, first, first);
        _execute(capped, second, second);

        vm.expectRevert(MandateAquaApp.TotalCapExceeded.selector);
        _execute(capped, 1, 1);
    }

    function testFuzz_PerCallCapRejectsOneUnitOver(uint64 rawCap) public {
        uint256 cap = bound(uint256(rawCap), 1, 50e18);
        MandateAquaApp.Strategy memory capped = strategy;
        capped.maxInputPerCall = cap;
        capped.maxInputTotal = cap + 1;
        _configureIdentity(capped, AGENT);
        _activate(capped);

        vm.expectRevert(MandateAquaApp.PerCallCapExceeded.selector);
        _execute(capped, cap + 1, cap + 1);
    }

    function testFuzz_ExecutionDeadlineIsInclusive(uint64 offset) public {
        offset = uint64(bound(offset, 0, 1 days));
        _activate(strategy);
        uint64 deadline = uint64(block.timestamp) + offset;
        vm.warp(deadline);

        vm.prank(AGENT);
        app.execute(strategy, 1e18, 1e18, deadline, _route(1e18, 1e18, address(app)));
    }
}
