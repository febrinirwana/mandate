// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import {IAqua} from "@1inch/aqua/src/interfaces/IAqua.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract MockFailingAqua is IAqua {
    error PushFailed();

    mapping(bytes32 => uint256) private balances;
    mapping(bytes32 => bool) private activeTokens;

    function rawBalances(address maker, address app, bytes32 strategyHash, address token)
        external
        view
        returns (uint248 balance, uint8 tokensCount)
    {
        return (uint248(balances[_key(maker, app, strategyHash, token)]), 2);
    }

    function safeBalances(address maker, address app, bytes32 strategyHash, address token0, address token1)
        external
        view
        returns (uint256 balance0, uint256 balance1)
    {
        bytes32 key0 = _key(maker, app, strategyHash, token0);
        bytes32 key1 = _key(maker, app, strategyHash, token1);
        if (!activeTokens[key0]) revert SafeBalancesForTokenNotInActiveStrategy(maker, app, strategyHash, token0);
        if (!activeTokens[key1]) revert SafeBalancesForTokenNotInActiveStrategy(maker, app, strategyHash, token1);
        return (balances[key0], balances[key1]);
    }

    function ship(address app, bytes calldata strategy, address[] calldata tokens, uint256[] calldata amounts)
        external
        returns (bytes32 strategyHash)
    {
        require(tokens.length == amounts.length, "LENGTH_MISMATCH");
        strategyHash = keccak256(strategy);
        emit Shipped(msg.sender, app, strategyHash, strategy);
        for (uint256 i; i < tokens.length; ++i) {
            bytes32 key = _key(msg.sender, app, strategyHash, tokens[i]);
            activeTokens[key] = true;
            balances[key] = amounts[i];
            emit Pushed(msg.sender, app, strategyHash, tokens[i], amounts[i]);
        }
    }

    function dock(address app, bytes32 strategyHash, address[] calldata tokens) external {
        for (uint256 i; i < tokens.length; ++i) {
            bytes32 key = _key(msg.sender, app, strategyHash, tokens[i]);
            activeTokens[key] = false;
            balances[key] = 0;
        }
        emit Docked(msg.sender, app, strategyHash);
    }

    function pull(address maker, bytes32 strategyHash, address token, uint256 amount, address to) external {
        bytes32 key = _key(maker, msg.sender, strategyHash, token);
        uint256 balance = balances[key];
        require(activeTokens[key] && balance >= amount, "INSUFFICIENT_AQUA_BALANCE");
        balances[key] = balance - amount;
        require(IERC20(token).transferFrom(maker, to, amount), "PULL_TRANSFER_FAILED");
        emit Pulled(maker, msg.sender, strategyHash, token, amount);
    }

    function push(address, address, bytes32, address, uint256) external pure {
        revert PushFailed();
    }

    function _key(address maker, address app, bytes32 strategyHash, address token) private pure returns (bytes32) {
        return keccak256(abi.encode(maker, app, strategyHash, token));
    }
}
