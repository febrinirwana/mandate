// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import {IAqua} from "@1inch/aqua/src/interfaces/IAqua.sol";
import {IPermissionedRegistry} from "@ensv2/contracts/registry/interfaces/IPermissionedRegistry.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";

interface IAddrResolver {
    function addr(bytes32 node) external view returns (address);
}

contract MandateAquaApp {
    using SafeERC20 for IERC20;

    struct Strategy {
        address maker;
        address agent;
        address ensRegistry;
        address ensResolver;
        string ensLabel;
        bytes32 ensNode;
        address tokenIn;
        address tokenOut;
        address swapTarget;
        bytes4 swapSelector;
        uint256 minRateNumerator;
        uint256 minRateDenominator;
        uint256 maxInputPerCall;
        uint256 maxInputTotal;
        uint64 validAfter;
        uint64 validUntil;
        bytes32 salt;
    }

    struct MandateState {
        address maker;
        uint256 usedInput;
        bool activated;
        bool revoked;
    }

    struct Inspection {
        bytes32 strategyHash;
        address maker;
        uint256 usedInput;
        bool activated;
        bool revoked;
    }

    IAqua public immutable AQUA;
    uint64 public immutable MAX_MANDATE_DURATION;
    uint64 internal constant MAX_ALLOWED_MANDATE_DURATION = 365 days;

    mapping(bytes32 strategyHash => MandateState mandate) public mandates;

    bool private entered;

    error InvalidStrategy();
    error AlreadyActivated();
    error NotMaker();
    error NotAgent();
    error MandateInactive();
    error MandateRevokedError();
    error NotStarted();
    error Expired();
    error ExecutionDeadlineExpired();
    error ENSNotRegistered();
    error ENSExpired();
    error ENSOwnerMismatch();
    error ENSAddressMismatch();
    error AquaStrategyInactive();
    error AquaBalanceInsufficient();
    error ZeroAmount();
    error PerCallCapExceeded();
    error TotalCapExceeded();
    error WrongSelector();
    error RouteCallFailed(bytes4 selector, bytes32 reasonHash);
    error InputTransferMismatch();
    error InputNotFullySpent();
    error OutputTooLow();
    error ResidualBalance();
    error ResidualAllowance();
    error ReentrantCall();

    event MandateActivated(bytes32 indexed strategyHash, address indexed maker, address indexed agent, bytes strategy);
    event MandateExecuted(
        bytes32 indexed strategyHash,
        address indexed maker,
        address indexed agent,
        uint256 amountIn,
        uint256 amountOut,
        uint256 usedInputAfter
    );
    event MandateRevoked(bytes32 indexed strategyHash, address indexed maker);

    modifier nonReentrant() {
        if (entered) revert ReentrantCall();
        entered = true;
        _;
        entered = false;
    }

    constructor(IAqua aqua, uint64 maxMandateDuration) {
        bool invalidConstructor =
            address(aqua) == address(0) || maxMandateDuration == 0 || maxMandateDuration > MAX_ALLOWED_MANDATE_DURATION;
        if (invalidConstructor) revert InvalidStrategy();
        AQUA = aqua;
        MAX_MANDATE_DURATION = maxMandateDuration;
    }

    function strategyHash(Strategy calldata strategy) external pure returns (bytes32) {
        return _strategyHash(strategy);
    }

    function minimumOutput(Strategy calldata strategy, uint256 amountIn) external pure returns (uint256) {
        if (strategy.minRateNumerator == 0 || strategy.minRateDenominator == 0) revert InvalidStrategy();
        return Math.mulDiv(amountIn, strategy.minRateNumerator, strategy.minRateDenominator, Math.Rounding.Ceil);
    }

    function activate(Strategy calldata strategy) external nonReentrant {
        if (msg.sender != strategy.maker) revert NotMaker();
        _validate(strategy);

        bytes32 hash = _strategyHash(strategy);
        if (mandates[hash].activated) revert AlreadyActivated();
        _requireAquaActive(strategy, hash);

        mandates[hash] = MandateState({maker: strategy.maker, usedInput: 0, activated: true, revoked: false});
        emit MandateActivated(hash, strategy.maker, strategy.agent, abi.encode(strategy));
    }

    function revoke(bytes32 hash) external nonReentrant {
        MandateState storage mandate = mandates[hash];
        if (msg.sender != mandate.maker) revert NotMaker();
        if (!mandate.activated) revert MandateInactive();
        if (mandate.revoked) revert MandateRevokedError();

        mandate.revoked = true;
        emit MandateRevoked(hash, mandate.maker);
    }

    function inspect(Strategy calldata strategy) external view returns (Inspection memory) {
        bytes32 hash = _strategyHash(strategy);
        MandateState memory mandate = mandates[hash];
        return Inspection({
            strategyHash: hash,
            maker: mandate.maker,
            usedInput: mandate.usedInput,
            activated: mandate.activated,
            revoked: mandate.revoked
        });
    }

    function execute(
        Strategy calldata strategy,
        uint256 amountIn,
        uint256 agentMinOut,
        uint64 executionDeadline,
        bytes calldata routeData
    ) external nonReentrant returns (uint256 amountOut) {
        _validate(strategy);

        bytes32 hash = _strategyHash(strategy);
        MandateState storage mandate = mandates[hash];
        if (!mandate.activated || mandate.maker != strategy.maker) revert MandateInactive();
        if (mandate.revoked) revert MandateRevokedError();
        if (block.timestamp < strategy.validAfter) revert NotStarted();
        if (block.timestamp >= strategy.validUntil) revert Expired();
        if (block.timestamp > executionDeadline) revert ExecutionDeadlineExpired();
        if (msg.sender != strategy.agent) revert NotAgent();

        _requireCurrentIdentity(strategy);

        if (amountIn == 0) revert ZeroAmount();
        if (amountIn > strategy.maxInputPerCall) revert PerCallCapExceeded();
        if (amountIn > strategy.maxInputTotal - mandate.usedInput) revert TotalCapExceeded();
        if (routeData.length < 4 || _selector(routeData) != strategy.swapSelector) revert WrongSelector();

        (uint256 availableInput,) = _requireAquaActive(strategy, hash);
        if (availableInput < amountIn) revert AquaBalanceInsufficient();

        uint256 immutableMinOut =
            Math.mulDiv(amountIn, strategy.minRateNumerator, strategy.minRateDenominator, Math.Rounding.Ceil);

        mandate.usedInput += amountIn;

        IERC20 tokenIn = IERC20(strategy.tokenIn);
        IERC20 tokenOut = IERC20(strategy.tokenOut);
        uint256 inputBaseline = tokenIn.balanceOf(address(this));
        uint256 outputBaseline = tokenOut.balanceOf(address(this));

        AQUA.pull(strategy.maker, hash, strategy.tokenIn, amountIn, address(this));

        uint256 pulledInputBalance = tokenIn.balanceOf(address(this));
        if (pulledInputBalance < inputBaseline || pulledInputBalance - inputBaseline != amountIn) {
            revert InputTransferMismatch();
        }

        tokenIn.forceApprove(strategy.swapTarget, amountIn);
        (bool succeeded, bytes memory routeReturnData) = strategy.swapTarget.call(routeData);
        if (!succeeded) _revertRouteCall(routeReturnData);
        tokenIn.forceApprove(strategy.swapTarget, 0);

        if (tokenIn.balanceOf(address(this)) != inputBaseline) revert InputNotFullySpent();

        uint256 outputBalance = tokenOut.balanceOf(address(this));
        if (outputBalance <= outputBaseline) revert OutputTooLow();
        amountOut = outputBalance - outputBaseline;
        if (amountOut < immutableMinOut || amountOut < agentMinOut) revert OutputTooLow();

        tokenOut.forceApprove(address(AQUA), amountOut);
        AQUA.push(strategy.maker, address(this), hash, strategy.tokenOut, amountOut);
        tokenOut.forceApprove(address(AQUA), 0);

        if (tokenIn.balanceOf(address(this)) != inputBaseline || tokenOut.balanceOf(address(this)) != outputBaseline) {
            revert ResidualBalance();
        }
        if (
            tokenIn.allowance(address(this), strategy.swapTarget) != 0
                || tokenOut.allowance(address(this), address(AQUA)) != 0
        ) {
            revert ResidualAllowance();
        }

        emit MandateExecuted(hash, strategy.maker, strategy.agent, amountIn, amountOut, mandate.usedInput);
    }

    function _validate(Strategy calldata strategy) private view {
        if (
            strategy.maker == address(0) || strategy.agent == address(0) || strategy.ensRegistry == address(0)
                || strategy.ensResolver == address(0) || strategy.tokenIn == address(0)
                || strategy.tokenOut == address(0) || strategy.swapTarget == address(0)
                || strategy.tokenIn == strategy.tokenOut || strategy.swapSelector == bytes4(0)
                || strategy.minRateNumerator == 0 || strategy.minRateDenominator == 0 || strategy.maxInputPerCall == 0
                || strategy.maxInputTotal == 0 || strategy.maxInputPerCall > strategy.maxInputTotal
                || strategy.validUntil <= strategy.validAfter
                || strategy.validUntil - strategy.validAfter > MAX_MANDATE_DURATION || strategy.ensNode == bytes32(0)
                || !_isNormalizedLabel(strategy.ensLabel)
        ) revert InvalidStrategy();
    }

    function _requireCurrentIdentity(Strategy calldata strategy) private view {
        IPermissionedRegistry.State memory state =
            IPermissionedRegistry(strategy.ensRegistry).getState(uint256(keccak256(bytes(strategy.ensLabel))));
        if (state.status != IPermissionedRegistry.Status.REGISTERED) revert ENSNotRegistered();
        if (state.expiry <= block.timestamp) revert ENSExpired();
        if (IPermissionedRegistry(strategy.ensRegistry).ownerOf(state.tokenId) != strategy.agent) {
            revert ENSOwnerMismatch();
        }
        if (IPermissionedRegistry(strategy.ensRegistry).getResolver(strategy.ensLabel) != strategy.ensResolver) {
            revert ENSAddressMismatch();
        }
        if (IAddrResolver(strategy.ensResolver).addr(strategy.ensNode) != strategy.agent) revert ENSAddressMismatch();
    }

    function _requireAquaActive(Strategy calldata strategy, bytes32 hash)
        private
        view
        returns (uint256 inputBalance, uint256 outputBalance)
    {
        try AQUA.safeBalances(strategy.maker, address(this), hash, strategy.tokenIn, strategy.tokenOut) returns (
            uint256 inputBalance_, uint256 outputBalance_
        ) {
            return (inputBalance_, outputBalance_);
        } catch {
            revert AquaStrategyInactive();
        }
    }

    function _strategyHash(Strategy calldata strategy) private pure returns (bytes32) {
        return keccak256(abi.encode(strategy));
    }

    function _isNormalizedLabel(string calldata label) private pure returns (bool) {
        bytes calldata value = bytes(label);
        if (value.length == 0) return false;

        for (uint256 i = 0; i < value.length; ++i) {
            bytes1 character = value[i];
            if (character == "." || character == 0x00 || (character >= "A" && character <= "Z")) return false;
        }
        return true;
    }

    function _selector(bytes calldata routeData) private pure returns (bytes4 selector) {
        assembly ("memory-safe") {
            selector := calldataload(routeData.offset)
        }
    }

    function _revertRouteCall(bytes memory returnData) private pure {
        bytes4 selector;
        if (returnData.length >= 4) {
            assembly ("memory-safe") {
                selector := mload(add(returnData, 0x20))
            }
        }
        revert RouteCallFailed(selector, keccak256(returnData));
    }
}
