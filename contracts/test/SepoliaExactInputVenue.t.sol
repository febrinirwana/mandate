// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import {Test} from "forge-std/Test.sol";
import {MockERC20} from "./fixtures/MockTokens.sol";
import {SepoliaExactInputVenue} from "../src/SepoliaExactInputVenue.sol";

contract SepoliaExactInputVenueTest is Test {
    address private constant MAKER = address(0xA11CE);
    address private constant APP = address(0xB0B);
    address private constant RECIPIENT = address(0xCAFE);
    uint256 private constant INPUT_AMOUNT = 10e6;
    uint256 private constant OUTPUT_RATE_NUMERATOR = 1e12;

    MockERC20 private tokenIn;
    MockERC20 private tokenOut;
    SepoliaExactInputVenue private venue;

    function setUp() public {
        vm.chainId(11_155_111);
        tokenIn = new MockERC20("Mock USDC", "mUSDC");
        tokenOut = new MockERC20("Mock DAI", "mDAI");
        venue = new SepoliaExactInputVenue(tokenIn, tokenOut, MAKER, OUTPUT_RATE_NUMERATOR, 1);
        tokenIn.mint(APP, INPUT_AMOUNT);
        tokenOut.mint(address(venue), INPUT_AMOUNT * OUTPUT_RATE_NUMERATOR);

        vm.prank(APP);
        tokenIn.approve(address(venue), INPUT_AMOUNT);
    }

    function testSwapSettlesExactInputAtImmutableRate() public {
        uint256 outputAmount = INPUT_AMOUNT * OUTPUT_RATE_NUMERATOR;

        vm.prank(APP);
        uint256 returnedAmount = venue.swap(INPUT_AMOUNT, outputAmount, RECIPIENT);

        assertEq(returnedAmount, outputAmount);
        assertEq(tokenIn.balanceOf(MAKER), INPUT_AMOUNT);
        assertEq(tokenIn.balanceOf(address(venue)), 0);
        assertEq(tokenOut.balanceOf(RECIPIENT), outputAmount);
    }

    function testSwapRejectsMinimumAboveImmutableRate() public {
        vm.expectRevert(
            abi.encodeWithSelector(
                SepoliaExactInputVenue.OutputBelowMinimum.selector,
                INPUT_AMOUNT * OUTPUT_RATE_NUMERATOR,
                INPUT_AMOUNT * OUTPUT_RATE_NUMERATOR + 1
            )
        );
        vm.prank(APP);
        venue.swap(INPUT_AMOUNT, INPUT_AMOUNT * OUTPUT_RATE_NUMERATOR + 1, RECIPIENT);
    }

    function testConstructorRejectsNonSepoliaChain() public {
        vm.chainId(1);

        vm.expectRevert(abi.encodeWithSelector(SepoliaExactInputVenue.WrongChain.selector, uint256(1)));
        new SepoliaExactInputVenue(tokenIn, tokenOut, MAKER, OUTPUT_RATE_NUMERATOR, 1);
    }
}
