// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import {IAqua} from "@1inch/aqua/src/interfaces/IAqua.sol";
import {Vm} from "forge-std/Vm.sol";
import {MandateAquaApp} from "../src/MandateAquaApp.sol";
import {MockERC20} from "./fixtures/MockTokens.sol";
import {MockExactInputVenue} from "./fixtures/MockVenues.sol";
import {TestMandateFixture} from "./fixtures/TestMandateFixture.sol";

contract TestMandateHandler {
    Vm private constant VM = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));

    MandateAquaApp private immutable app;
    IAqua private immutable aqua;
    MandateAquaApp.Strategy private strategy;
    MockERC20 private immutable tokenIn;
    MockERC20 private immutable tokenOut;
    MockExactInputVenue private immutable venue;
    address private immutable maker;
    address private immutable agent;
    uint256 private immutable inputAllocation;
    uint256 private immutable outputDust;
    bool public revokedObserved;

    bool public failuresPreserveState = true;
    uint256 public successfulOutput;

    constructor(
        MandateAquaApp app_,
        IAqua aqua_,
        MandateAquaApp.Strategy memory strategy_,
        MockERC20 tokenIn_,
        MockERC20 tokenOut_,
        MockExactInputVenue venue_,
        uint256 inputAllocation_,
        uint256 outputDust_
    ) {
        app = app_;
        aqua = aqua_;
        strategy = strategy_;
        tokenIn = tokenIn_;
        tokenOut = tokenOut_;
        venue = venue_;
        maker = strategy_.maker;
        agent = strategy_.agent;
        inputAllocation = inputAllocation_;
        outputDust = outputDust_;
    }

    function execute(uint96 rawAmount) external {
        uint256 amount = (uint256(rawAmount) % 10e18) + 1;
        bytes32 hash = app.strategyHash(strategy);
        (uint256 usedBefore,,) = _state(hash);
        uint256 makerInputBefore = tokenIn.balanceOf(maker);
        uint256 makerOutputBefore = tokenOut.balanceOf(maker);
        uint256 appInputBefore = tokenIn.balanceOf(address(app));
        uint256 appOutputBefore = tokenOut.balanceOf(address(app));

        VM.prank(agent);
        try app.execute(
            strategy,
            amount,
            amount,
            uint64(block.timestamp),
            abi.encodeCall(MockExactInputVenue.swap, (amount, amount, address(app)))
        ) returns (
            uint256 amountOut
        ) {
            successfulOutput += amountOut;
        } catch {
            (uint256 usedAfter,,) = _state(hash);
            failuresPreserveState = failuresPreserveState && usedAfter == usedBefore
                && tokenIn.balanceOf(maker) == makerInputBefore && tokenOut.balanceOf(maker) == makerOutputBefore
                && tokenIn.balanceOf(address(app)) == appInputBefore
                && tokenOut.balanceOf(address(app)) == appOutputBefore;
        }
    }

    function revoke() external {
        VM.prank(maker);
        try app.revoke(app.strategyHash(strategy)) {} catch {}
        if (_isRevoked()) revokedObserved = true;
    }

    function revocationPersists() external view returns (bool) {
        return !revokedObserved || _isRevoked();
    }

    function outputIsOnlyMakerOwned() external view returns (bool) {
        return tokenOut.balanceOf(agent) == 0 && tokenOut.balanceOf(address(app)) == outputDust;
    }

    function aquaBalancesMatchSettlement() external view returns (bool) {
        bytes32 hash = app.strategyHash(strategy);
        (uint256 inputBalance, uint256 outputBalance) =
            aqua.safeBalances(maker, address(app), hash, address(tokenIn), address(tokenOut));
        (uint256 used,,) = _state(hash);
        return inputBalance == inputAllocation - used && outputBalance == successfulOutput;
    }

    function _isRevoked() private view returns (bool) {
        (,, bool revoked) = _state(app.strategyHash(strategy));
        return revoked;
    }

    function _state(bytes32 hash) private view returns (uint256 used, bool activated, bool revoked) {
        address ignoredMaker;
        (ignoredMaker, used, activated, revoked) = app.mandates(hash);
    }
}

contract MandateAquaAppInvariantTest is TestMandateFixture {
    uint256 private constant INPUT_DUST = 7;
    uint256 private constant OUTPUT_DUST = 11;

    TestMandateHandler private handler;

    function setUp() public virtual override {
        super.setUp();
        _activate(strategy);
        tokenIn.mint(address(app), INPUT_DUST);
        tokenOut.mint(address(app), OUTPUT_DUST);
        handler = new TestMandateHandler(app, aqua, strategy, tokenIn, tokenOut, venue, INPUT_ALLOCATION, OUTPUT_DUST);
        targetContract(address(handler));
    }

    function invariant_UsedInputNeverExceedsTotal() public view {
        assertLe(_used(strategy), strategy.maxInputTotal, "used input exceeded immutable total cap");
    }

    function invariant_RevokedMandateNeverReactivates() public view {
        assertTrue(handler.revocationPersists(), "revoked mandate reactivated");
    }

    function invariant_FailedCallsChangeNoStateOrBalances() public view {
        assertTrue(handler.failuresPreserveState(), "failed execution mutated state or balances");
    }

    function invariant_SuccessfulOutputReachesMakerOnly() public view {
        assertTrue(handler.outputIsOnlyMakerOwned(), "output reached agent or escaped app baseline");
    }

    function invariant_AttributableAppBalancesAndAllowancesReturnToBaseline() public view {
        assertEq(tokenIn.balanceOf(address(app)), INPUT_DUST, "input baseline changed");
        assertEq(tokenOut.balanceOf(address(app)), OUTPUT_DUST, "output baseline changed");
        assertEq(tokenIn.allowance(address(app), address(venue)), 0, "target allowance persisted");
        assertEq(tokenOut.allowance(address(app), address(aqua)), 0, "Aqua allowance persisted");
        assertTrue(handler.aquaBalancesMatchSettlement(), "Aqua balances diverged from successful settlement");
    }

    function _state(bytes32 hash) private view returns (uint256 used, bool activated, bool revoked) {
        address ignoredMaker;
        (ignoredMaker, used, activated, revoked) = app.mandates(hash);
    }
}
