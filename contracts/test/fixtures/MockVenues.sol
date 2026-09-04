// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract MockExactInputVenue {
    IERC20 public immutable tokenIn;
    IERC20 public immutable tokenOut;

    constructor(IERC20 tokenIn_, IERC20 tokenOut_) {
        tokenIn = tokenIn_;
        tokenOut = tokenOut_;
    }

    function swap(uint256 amountIn, uint256 amountOut, address recipient) public virtual {
        require(tokenIn.transferFrom(msg.sender, address(this), amountIn), "INPUT_TRANSFER_FAILED");
        require(tokenOut.transfer(recipient, amountOut), "OUTPUT_TRANSFER_FAILED");
    }
}

contract MockPartialSpendVenue is MockExactInputVenue {
    constructor(IERC20 tokenIn_, IERC20 tokenOut_) MockExactInputVenue(tokenIn_, tokenOut_) {}

    function swap(uint256 amountIn, uint256 amountOut, address recipient) public virtual override {
        require(tokenIn.transferFrom(msg.sender, address(this), amountIn - 1), "INPUT_TRANSFER_FAILED");
        require(tokenOut.transfer(recipient, amountOut), "OUTPUT_TRANSFER_FAILED");
    }
}

contract MockShortOutputVenue is MockExactInputVenue {
    uint256 public shortOutput;

    constructor(IERC20 tokenIn_, IERC20 tokenOut_) MockExactInputVenue(tokenIn_, tokenOut_) {}

    function setShortOutput(uint256 amount) external {
        shortOutput = amount;
    }

    function swap(uint256 amountIn, uint256, address recipient) public virtual override {
        require(tokenIn.transferFrom(msg.sender, address(this), amountIn), "INPUT_TRANSFER_FAILED");
        require(tokenOut.transfer(recipient, shortOutput), "OUTPUT_TRANSFER_FAILED");
    }
}

contract MockRevertingVenue {
    error RouteReverted();

    function swap(uint256, uint256, address) external pure {
        revert RouteReverted();
    }
}

contract MockWrongRecipientVenue is MockExactInputVenue {
    address public immutable wrongRecipient;

    constructor(IERC20 tokenIn_, IERC20 tokenOut_, address wrongRecipient_) MockExactInputVenue(tokenIn_, tokenOut_) {
        wrongRecipient = wrongRecipient_;
    }

    function swap(uint256 amountIn, uint256 amountOut, address) public virtual override {
        require(tokenIn.transferFrom(msg.sender, address(this), amountIn), "INPUT_TRANSFER_FAILED");
        require(tokenOut.transfer(wrongRecipient, amountOut), "OUTPUT_TRANSFER_FAILED");
    }
}

contract MockReentrantVenue is MockExactInputVenue {
    address public callback;
    bytes public callbackData;

    constructor(IERC20 tokenIn_, IERC20 tokenOut_) MockExactInputVenue(tokenIn_, tokenOut_) {}

    function setCallback(address callback_, bytes calldata callbackData_) external {
        callback = callback_;
        callbackData = callbackData_;
    }

    function swap(uint256 amountIn, uint256 amountOut, address recipient) public virtual override {
        require(tokenIn.transferFrom(msg.sender, address(this), amountIn), "INPUT_TRANSFER_FAILED");
        (bool success,) = callback.call(callbackData);
        require(success, "REENTRANCY_REJECTED");
        require(tokenOut.transfer(recipient, amountOut), "OUTPUT_TRANSFER_FAILED");
    }
}
