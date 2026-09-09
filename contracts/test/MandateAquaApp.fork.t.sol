// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import {IAqua} from "@1inch/aqua/src/interfaces/IAqua.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {Test} from "forge-std/Test.sol";
import {Vm} from "forge-std/Vm.sol";
import {MandateAquaApp} from "../src/MandateAquaApp.sol";
import {MockAddrResolver, MockPermissionedRegistry} from "./fixtures/MockIdentity.sol";

interface IWETH is IERC20 {
    function deposit() external payable;
}

contract MandateAquaAppForkTest is Test {
    address private constant AQUA = 0x1111113CCf1426A8E30e2bfF5E005d929bF6a90a;
    address private constant WETH = 0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2;
    address private constant USDC = 0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48;
    address private constant CREATE2_DEPLOYER = 0x4e59b44847b379578588920cA78FbF26c0B4956C;
    bytes32 private constant CREATE2_SALT = keccak256("mandate-phase6-mainnet-v1");
    uint64 private constant MAX_MANDATE_DURATION = 30 days;
    address private constant MAKER = address(0xA11CE);
    address private constant AGENT = address(0xA93E17);
    string private constant MANIFEST_PATH = "../packages/contracts/src/deployments/mainnet.json";

    IAqua private aqua = IAqua(AQUA);
    IERC20 private tokenIn = IERC20(WETH);
    IERC20 private tokenOut = IERC20(USDC);

    function testProductionMandateSettlesCaptured1inchRouteWithExactDeltas() public {
        if (block.chainid != 1) vm.skip(true);
        string memory manifest = vm.readFile(MANIFEST_PATH);
        uint256 verificationBlock = vm.parseUint(vm.parseJsonString(manifest, ".verificationBlock.number"));
        assertEq(block.chainid, 1, "fork is not Ethereum mainnet");
        assertEq(block.number, verificationBlock, "fork does not match venue manifest block");

        bytes memory routeData = vm.parseJsonBytes(manifest, ".route.calldata");
        uint256 amountIn = vm.parseUint(vm.parseJsonString(manifest, ".route.amountIn"));
        uint256 minimumOut = vm.parseUint(vm.parseJsonString(manifest, ".route.routeMinimumOut"));
        address router = vm.parseJsonAddress(manifest, ".route.target");
        address expectedApp = vm.parseJsonAddress(manifest, ".route.caller");

        MandateAquaApp app = _deployProductionApp(expectedApp);
        MockPermissionedRegistry registry = new MockPermissionedRegistry();
        MockAddrResolver resolver = new MockAddrResolver();
        MandateAquaApp.Strategy memory strategy = _strategy(app, registry, resolver, router, amountIn, minimumOut);
        bytes32 strategyHash = app.strategyHash(strategy);

        vm.deal(MAKER, amountIn);
        vm.prank(MAKER);
        IWETH(WETH).deposit{value: amountIn}();
        vm.prank(MAKER);
        tokenIn.approve(AQUA, type(uint256).max);
        _configureIdentity(registry, resolver, strategy);
        _activate(app, strategy, amountIn);

        uint256 makerInputBefore = tokenIn.balanceOf(MAKER);
        uint256 makerOutputBefore = tokenOut.balanceOf(MAKER);
        (uint248 virtualInputBefore,) = aqua.rawBalances(MAKER, address(app), strategyHash, WETH);
        (uint248 virtualOutputBefore,) = aqua.rawBalances(MAKER, address(app), strategyHash, USDC);

        uint256 snapshot = vm.snapshotState();
        vm.prank(AGENT);
        uint256 simulatedOutput = app.execute(strategy, amountIn, minimumOut, uint64(block.timestamp), routeData);
        assertGe(simulatedOutput, minimumOut, "simulation output is below admitted minimum");
        assertTrue(vm.revertToState(snapshot), "simulation state was not restored");

        vm.recordLogs();
        vm.prank(AGENT);
        uint256 amountOut = app.execute(strategy, amountIn, minimumOut, uint64(block.timestamp), routeData);
        emit log_named_uint("inputAmount", amountIn);
        emit log_named_uint("outputAmount", amountOut);
        Vm.Log[] memory logs = vm.getRecordedLogs();

        assertEq(tokenIn.balanceOf(MAKER), makerInputBefore - amountIn, "maker input delta is not exact");
        assertEq(tokenOut.balanceOf(MAKER), makerOutputBefore + amountOut, "maker output delta is not exact");
        assertEq(tokenIn.balanceOf(address(app)), 0, "app retained input");
        assertEq(tokenOut.balanceOf(address(app)), 0, "app retained output");
        assertEq(tokenIn.balanceOf(AGENT), 0, "agent received input");
        assertEq(tokenOut.balanceOf(AGENT), 0, "agent received output");
        assertEq(tokenIn.allowance(address(app), router), 0, "router approval remained");
        assertEq(tokenOut.allowance(address(app), AQUA), 0, "Aqua approval remained");

        (uint248 virtualInputAfter,) = aqua.rawBalances(MAKER, address(app), strategyHash, WETH);
        (uint248 virtualOutputAfter,) = aqua.rawBalances(MAKER, address(app), strategyHash, USDC);
        assertEq(virtualInputAfter, virtualInputBefore - amountIn, "Aqua input delta is not exact");
        assertEq(virtualOutputAfter, virtualOutputBefore + amountOut, "Aqua output delta is not exact");
        assertTrue(_containsEvent(logs, AQUA, keccak256("Pulled(address,address,bytes32,address,uint256)")));
        assertTrue(_containsEvent(logs, AQUA, keccak256("Pushed(address,address,bytes32,address,uint256)")));
        assertTrue(
            _containsEvent(
                logs, address(app), keccak256("MandateExecuted(bytes32,address,address,uint256,uint256,uint256)")
            )
        );
    }

    function _deployProductionApp(address expected) private returns (MandateAquaApp app) {
        bytes memory initCode =
            abi.encodePacked(type(MandateAquaApp).creationCode, abi.encode(IAqua(AQUA), MAX_MANDATE_DURATION));
        address computed = address(
            uint160(
                uint256(keccak256(abi.encodePacked(bytes1(0xff), CREATE2_DEPLOYER, CREATE2_SALT, keccak256(initCode))))
            )
        );
        assertEq(computed, expected, "manifest caller differs from deterministic app");

        (bool success,) = CREATE2_DEPLOYER.call(abi.encodePacked(CREATE2_SALT, initCode));
        assertTrue(success, "deterministic Mandate deployment failed");
        assertGt(expected.code.length, 0, "Mandate runtime was not deployed");
        app = MandateAquaApp(expected);
    }

    function _strategy(
        MandateAquaApp app,
        MockPermissionedRegistry registry,
        MockAddrResolver resolver,
        address router,
        uint256 amountIn,
        uint256 minimumOut
    ) private view returns (MandateAquaApp.Strategy memory) {
        return MandateAquaApp.Strategy({
            maker: MAKER,
            agent: AGENT,
            ensRegistry: address(registry),
            ensResolver: address(resolver),
            ensLabel: "mandate-agent",
            ensNode: keccak256("mandate-agent.eth"),
            tokenIn: WETH,
            tokenOut: USDC,
            swapTarget: router,
            swapSelector: bytes4(0x07ed2379),
            minRateNumerator: minimumOut,
            minRateDenominator: amountIn,
            maxInputPerCall: amountIn,
            maxInputTotal: amountIn,
            validAfter: uint64(block.timestamp),
            validUntil: uint64(block.timestamp + 1 days),
            salt: keccak256(abi.encodePacked("mandate-phase6-live-route", address(app)))
        });
    }

    function _configureIdentity(
        MockPermissionedRegistry registry,
        MockAddrResolver resolver,
        MandateAquaApp.Strategy memory strategy
    ) private {
        uint256 labelId = uint256(keccak256(bytes(strategy.ensLabel)));
        registry.setState(
            labelId,
            MockPermissionedRegistry.State({
                status: MockPermissionedRegistry.Status.REGISTERED,
                expiry: strategy.validUntil + 1,
                latestOwner: AGENT,
                tokenId: 1,
                resource: 0
            })
        );
        registry.setOwner(1, AGENT);
        registry.setResolver(strategy.ensLabel, address(resolver));
        resolver.setAddr(strategy.ensNode, AGENT);
    }

    function _activate(MandateAquaApp app, MandateAquaApp.Strategy memory strategy, uint256 amountIn) private {
        address[] memory tokens = new address[](2);
        tokens[0] = WETH;
        tokens[1] = USDC;
        uint256[] memory amounts = new uint256[](2);
        amounts[0] = amountIn;

        vm.prank(MAKER);
        bytes32 aquaHash = aqua.ship(address(app), abi.encode(strategy), tokens, amounts);
        assertEq(aquaHash, app.strategyHash(strategy), "Aqua and Mandate hashes diverged");
        vm.prank(MAKER);
        app.activate(strategy);
    }

    function _containsEvent(Vm.Log[] memory logs, address emitter, bytes32 signature) private pure returns (bool) {
        for (uint256 i; i < logs.length; ++i) {
            if (logs[i].emitter == emitter && logs[i].topics.length > 0 && logs[i].topics[0] == signature) return true;
        }
        return false;
    }
}
