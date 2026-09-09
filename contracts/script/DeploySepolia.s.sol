// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import {IAqua} from "@1inch/aqua/src/interfaces/IAqua.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {Script} from "forge-std/Script.sol";
import {MandateAquaApp} from "../src/MandateAquaApp.sol";
import {SepoliaExactInputVenue} from "../src/SepoliaExactInputVenue.sol";

interface IDeploymentMintableERC20 is IERC20 {
    function mint(address account, uint256 amount) external;
}

/// @dev Deploys Mandate against the verified official Aqua Sepolia runtime.
contract DeploySepolia is Script {
    uint256 internal constant SEPOLIA_CHAIN_ID = 11_155_111;
    address internal constant OFFICIAL_SEPOLIA_AQUA = 0x1111113CCf1426A8E30e2bfF5E005d929bF6a90a;
    bytes32 internal constant OFFICIAL_SEPOLIA_AQUA_CODE_HASH =
        0x720bc02d220db318164dc3bade86eec1f3655bdc00fc1174de7d816a95c341f8;
    IDeploymentMintableERC20 internal constant OFFICIAL_MOCK_USDC =
        IDeploymentMintableERC20(0x768F42455A2D082E23ceeF7d51e5787C82d67a39);
    IDeploymentMintableERC20 internal constant OFFICIAL_MOCK_DAI =
        IDeploymentMintableERC20(0x5472C5725A00B7bA11F0794A79D08ade6F4683bD);
    uint256 internal constant OUTPUT_RATE_NUMERATOR = 1e12;
    uint256 internal constant OUTPUT_RATE_DENOMINATOR = 1;
    uint256 internal constant VENUE_OUTPUT_LIQUIDITY = 1_000_000e18;
    uint64 internal constant DEFAULT_MAX_MANDATE_DURATION = 30 days;
    uint64 internal constant MAX_MANDATE_DURATION = 365 days;

    error WrongChain(uint256 actualChainId);
    error InvalidMaxMandateDuration(uint256 duration);
    error AquaCodeHashMismatch(bytes32 actualCodeHash);
    error InvalidInputRecipient();
    error CodeMissing(address account);
    error VenueFundingMismatch();

    function run() external returns (IAqua aqua, MandateAquaApp app, SepoliaExactInputVenue venue) {
        if (block.chainid != SEPOLIA_CHAIN_ID) revert WrongChain(block.chainid);
        return _deploy(
            vm.envAddress("SEPOLIA_VENUE_INPUT_RECIPIENT"),
            vm.envOr("SEPOLIA_MAX_MANDATE_DURATION", uint256(DEFAULT_MAX_MANDATE_DURATION))
        );
    }

    function _deploy(address inputRecipient, uint256 configuredDuration)
        internal
        returns (IAqua aqua, MandateAquaApp app, SepoliaExactInputVenue venue)
    {
        if (inputRecipient == address(0)) revert InvalidInputRecipient();
        if (configuredDuration == 0 || configuredDuration > MAX_MANDATE_DURATION) {
            revert InvalidMaxMandateDuration(configuredDuration);
        }

        bytes32 actualCodeHash = OFFICIAL_SEPOLIA_AQUA.codehash;
        if (actualCodeHash != OFFICIAL_SEPOLIA_AQUA_CODE_HASH) revert AquaCodeHashMismatch(actualCodeHash);
        if (address(OFFICIAL_MOCK_USDC).code.length == 0) revert CodeMissing(address(OFFICIAL_MOCK_USDC));
        if (address(OFFICIAL_MOCK_DAI).code.length == 0) revert CodeMissing(address(OFFICIAL_MOCK_DAI));

        aqua = IAqua(OFFICIAL_SEPOLIA_AQUA);
        vm.startBroadcast();
        app = new MandateAquaApp(aqua, uint64(configuredDuration));
        venue = new SepoliaExactInputVenue(
            OFFICIAL_MOCK_USDC, OFFICIAL_MOCK_DAI, inputRecipient, OUTPUT_RATE_NUMERATOR, OUTPUT_RATE_DENOMINATOR
        );
        OFFICIAL_MOCK_DAI.mint(address(venue), VENUE_OUTPUT_LIQUIDITY);
        vm.stopBroadcast();

        if (OFFICIAL_MOCK_DAI.balanceOf(address(venue)) < VENUE_OUTPUT_LIQUIDITY) {
            revert VenueFundingMismatch();
        }
    }
}
