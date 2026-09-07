// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";

/// @dev Immutable MockUSDC-to-MockDAI route for public Sepolia Mandate integration proofs.
contract SepoliaExactInputVenue {
    using SafeERC20 for IERC20;

    uint256 internal constant SEPOLIA_CHAIN_ID = 11_155_111;

    IERC20 public immutable TOKEN_IN;
    IERC20 public immutable TOKEN_OUT;
    address public immutable INPUT_RECIPIENT;
    uint256 public immutable OUTPUT_RATE_NUMERATOR;
    uint256 public immutable OUTPUT_RATE_DENOMINATOR;

    error WrongChain(uint256 actualChainId);
    error InvalidConfiguration();
    error OutputBelowMinimum(uint256 actualAmountOut, uint256 minimumAmountOut);

    event Swapped(address indexed caller, address indexed recipient, uint256 amountIn, uint256 amountOut);

    constructor(
        IERC20 tokenIn,
        IERC20 tokenOut,
        address inputRecipient,
        uint256 outputRateNumerator,
        uint256 outputRateDenominator
    ) {
        if (block.chainid != SEPOLIA_CHAIN_ID) revert WrongChain(block.chainid);
        if (
            address(tokenIn) == address(0) || address(tokenOut) == address(0) || inputRecipient == address(0)
                || address(tokenIn) == address(tokenOut) || outputRateNumerator == 0 || outputRateDenominator == 0
        ) revert InvalidConfiguration();

        TOKEN_IN = tokenIn;
        TOKEN_OUT = tokenOut;
        INPUT_RECIPIENT = inputRecipient;
        OUTPUT_RATE_NUMERATOR = outputRateNumerator;
        OUTPUT_RATE_DENOMINATOR = outputRateDenominator;
    }

    function swap(uint256 amountIn, uint256 minimumAmountOut, address recipient) external returns (uint256 amountOut) {
        amountOut = Math.mulDiv(amountIn, OUTPUT_RATE_NUMERATOR, OUTPUT_RATE_DENOMINATOR);
        if (amountOut < minimumAmountOut) revert OutputBelowMinimum(amountOut, minimumAmountOut);

        TOKEN_IN.safeTransferFrom(msg.sender, INPUT_RECIPIENT, amountIn);
        TOKEN_OUT.safeTransfer(recipient, amountOut);
        emit Swapped(msg.sender, recipient, amountIn, amountOut);
    }
}
