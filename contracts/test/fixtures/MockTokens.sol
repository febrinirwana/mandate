// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract MockERC20 is ERC20 {
    constructor(string memory name_, string memory symbol_) ERC20(name_, symbol_) {}

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}

contract MockFeeOnTransferToken is MockERC20 {
    uint16 public immutable feeBps;
    address public immutable feeRecipient;

    constructor(uint16 feeBps_, address feeRecipient_) MockERC20("Fee Token", "FEE") {
        require(feeBps_ <= 10_000, "INVALID_FEE");
        feeBps = feeBps_;
        feeRecipient = feeRecipient_;
    }

    function _update(address from, address to, uint256 value) internal virtual override {
        if (from == address(0) || to == address(0) || feeBps == 0) {
            super._update(from, to, value);
            return;
        }

        uint256 fee = (value * feeBps) / 10_000;
        super._update(from, feeRecipient, fee);
        super._update(from, to, value - fee);
    }
}

contract MockFalseReturnToken is MockERC20 {
    constructor() MockERC20("False Token", "FALSE") {}

    function transfer(address, uint256) public pure virtual override returns (bool) {
        return false;
    }

    function transferFrom(address, address, uint256) public pure virtual override returns (bool) {
        return false;
    }
}

contract MockBalanceMutationToken is MockERC20 {
    address public mutationRecipient;
    constructor() MockERC20("Mutation Token", "MUTATE") {}

    function setMutationRecipient(address recipient) external {
        mutationRecipient = recipient;
    }

    function _update(address from, address to, uint256 value) internal virtual override {
        super._update(from, to, value);
        if (from != address(0) && to == mutationRecipient) _mint(to, 1);
    }
}

contract MockReentrantToken is MockERC20 {
    address public callback;
    bytes public callbackData;
    bool private entering;

    constructor() MockERC20("Reentrant Token", "REENTRANT") {}

    function setCallback(address callback_, bytes calldata callbackData_) external {
        callback = callback_;
        callbackData = callbackData_;
    }

    function _update(address from, address to, uint256 value) internal virtual override {
        super._update(from, to, value);

        if (entering || callback == address(0) || from == address(0) || to == address(0)) return;

        entering = true;
        (bool success,) = callback.call(callbackData);
        entering = false;
        require(success, "REENTRANCY_REJECTED");
    }
}
