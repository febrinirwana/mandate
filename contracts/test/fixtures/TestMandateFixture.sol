// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import {Aqua} from "@1inch/aqua/src/Aqua.sol";
import {IAqua} from "@1inch/aqua/src/interfaces/IAqua.sol";
import {Test} from "forge-std/Test.sol";
import {MandateAquaApp} from "../../src/MandateAquaApp.sol";
import {MockAddrResolver, MockPermissionedRegistry} from "./MockIdentity.sol";
import {MockERC20} from "./MockTokens.sol";
import {MockExactInputVenue} from "./MockVenues.sol";

abstract contract TestMandateFixture is Test {
    uint64 internal constant MAX_MANDATE_DURATION = 30 days;
    uint256 internal constant PER_CALL_CAP = 100e18;
    uint256 internal constant TOTAL_CAP = 1_000e18;
    uint256 internal constant INPUT_ALLOCATION = TOTAL_CAP;
    uint256 internal constant OUTPUT_ALLOCATION = 0;

    address internal constant MAKER = address(0xA11CE);
    address internal constant AGENT = address(0xA93E17);
    address internal constant OTHER = address(0xB0B);
    address internal constant ATTACKER = address(0xBAD);

    IAqua internal aqua;
    MandateAquaApp internal app;
    MockPermissionedRegistry internal registry;
    MockAddrResolver internal resolver;
    MockERC20 internal tokenIn;
    MockERC20 internal tokenOut;
    MockExactInputVenue internal venue;
    MandateAquaApp.Strategy internal strategy;

    function setUp() public virtual {
        aqua = IAqua(address(new Aqua()));
        app = new MandateAquaApp(aqua, MAX_MANDATE_DURATION);
        registry = new MockPermissionedRegistry();
        resolver = new MockAddrResolver();
        tokenIn = new MockERC20("Input Token", "IN");
        tokenOut = new MockERC20("Output Token", "OUT");
        venue = new MockExactInputVenue(tokenIn, tokenOut);

        tokenIn.mint(MAKER, INPUT_ALLOCATION);
        tokenOut.mint(address(venue), INPUT_ALLOCATION * 2);
        vm.prank(MAKER);
        tokenIn.approve(address(aqua), type(uint256).max);

        strategy = _strategy(address(tokenIn), address(tokenOut), address(venue));
        _configureIdentity(strategy, AGENT);
    }

    function _strategy(address tokenIn_, address tokenOut_, address target)
        internal
        view
        returns (MandateAquaApp.Strategy memory)
    {
        return MandateAquaApp.Strategy({
            maker: MAKER,
            agent: AGENT,
            ensRegistry: address(registry),
            ensResolver: address(resolver),
            ensLabel: "mandate-agent",
            ensNode: keccak256("mandate-agent.eth"),
            tokenIn: tokenIn_,
            tokenOut: tokenOut_,
            swapTarget: target,
            swapSelector: MockExactInputVenue.swap.selector,
            minRateNumerator: 1,
            minRateDenominator: 1,
            maxInputPerCall: PER_CALL_CAP,
            maxInputTotal: TOTAL_CAP,
            validAfter: uint64(block.timestamp),
            validUntil: uint64(block.timestamp + 1 days),
            salt: keccak256("mandate-test-salt")
        });
    }

    function _configureIdentity(MandateAquaApp.Strategy memory strategy_, address owner) internal {
        uint256 labelId = uint256(keccak256(bytes(strategy_.ensLabel)));
        registry.setState(
            labelId,
            MockPermissionedRegistry.State({
                status: MockPermissionedRegistry.Status.REGISTERED,
                expiry: strategy_.validUntil + 1,
                latestOwner: owner,
                tokenId: 1,
                resource: 0
            })
        );
        registry.setOwner(1, owner);
        registry.setResolver(strategy_.ensLabel, strategy_.ensResolver);
        resolver.setAddr(strategy_.ensNode, owner);
    }

    function _ship(MandateAquaApp.Strategy memory strategy_, uint256 inputAllocation, uint256 outputAllocation)
        internal
        returns (bytes32 strategyHash_)
    {
        address[] memory tokens = new address[](2);
        tokens[0] = strategy_.tokenIn;
        tokens[1] = strategy_.tokenOut;
        uint256[] memory amounts = new uint256[](2);
        amounts[0] = inputAllocation;
        amounts[1] = outputAllocation;

        vm.prank(strategy_.maker);
        strategyHash_ = aqua.ship(address(app), abi.encode(strategy_), tokens, amounts);
        assertEq(strategyHash_, app.strategyHash(strategy_), "Aqua and Mandate hashes diverged");
    }

    function _activate(MandateAquaApp.Strategy memory strategy_) internal returns (bytes32 strategyHash_) {
        strategyHash_ = _ship(strategy_, INPUT_ALLOCATION, OUTPUT_ALLOCATION);
        vm.prank(strategy_.maker);
        app.activate(strategy_);
    }

    function _route(uint256 amountIn, uint256 amountOut, address recipient) internal pure returns (bytes memory) {
        return abi.encodeCall(MockExactInputVenue.swap, (amountIn, amountOut, recipient));
    }

    function _execute(MandateAquaApp.Strategy memory strategy_, uint256 amountIn, uint256 amountOut)
        internal
        returns (uint256)
    {
        vm.prank(strategy_.agent);
        return
            app.execute(
                strategy_, amountIn, amountOut, uint64(block.timestamp), _route(amountIn, amountOut, address(app))
            );
    }

    function _used(MandateAquaApp.Strategy memory strategy_) internal view returns (uint256 used) {
        (, used,,) = app.mandates(app.strategyHash(strategy_));
    }

    function _assertRollback(
        MandateAquaApp.Strategy memory strategy_,
        uint256 usedBefore,
        uint256 makerInputBefore,
        uint256 makerOutputBefore
    ) internal view {
        assertEq(_used(strategy_), usedBefore, "failed call changed used input");
        assertEq(tokenIn.balanceOf(MAKER), makerInputBefore, "failed call changed maker input balance");
        assertEq(tokenOut.balanceOf(MAKER), makerOutputBefore, "failed call changed maker output balance");
    }
}
