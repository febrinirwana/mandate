// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/// @dev Test-only venue. It has no pricing logic and MUST NOT be deployed outside local Anvil proof runs.
contract LocalOnlyExactInputVenue {
    using SafeERC20 for IERC20;

    string public constant DEPLOYMENT_SCOPE = "LOCAL_ANVIL_ONLY";

    IERC20 public immutable TOKEN_IN;
    IERC20 public immutable TOKEN_OUT;

    constructor(IERC20 tokenIn, IERC20 tokenOut) {
        TOKEN_IN = tokenIn;
        TOKEN_OUT = tokenOut;
    }

    function swap(uint256 amountIn, uint256 amountOut, address recipient) external {
        TOKEN_IN.safeTransferFrom(msg.sender, address(this), amountIn);
        TOKEN_OUT.safeTransfer(recipient, amountOut);
    }
}
