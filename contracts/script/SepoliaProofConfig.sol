// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import {IAqua} from "@1inch/aqua/src/interfaces/IAqua.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {Script} from "forge-std/Script.sol";
import {MandateAquaApp} from "../src/MandateAquaApp.sol";
import {EnsNamehash} from "./EnsNamehash.sol";

abstract contract SepoliaProofConfig is Script {
    uint256 internal constant SEPOLIA_CHAIN_ID = 11_155_111;
    address internal constant OFFICIAL_SEPOLIA_AQUA = 0x1111113CCf1426A8E30e2bfF5E005d929bF6a90a;
    IERC20 internal constant OFFICIAL_MOCK_USDC = IERC20(0x768F42455A2D082E23ceeF7d51e5787C82d67a39);
    IERC20 internal constant OFFICIAL_MOCK_DAI = IERC20(0x5472C5725A00B7bA11F0794A79D08ade6F4683bD);
    uint256 internal constant INPUT_ALLOCATION = 100e6;
    uint256 internal constant TRADE_AMOUNT = 10e6;
    uint256 internal constant OUTPUT_RATE_NUMERATOR = 1e12;
    uint256 internal constant OUTPUT_RATE_DENOMINATOR = 1;
    uint64 internal constant PROOF_DURATION = 1 days;
    string internal constant PROOF_PATH = "broadcast/sepolia-proof.json";

    struct Proof {
        MandateAquaApp app;
        address venue;
        bytes32 strategyHash;
        MandateAquaApp.Strategy strategy;
    }

    error WrongChain(uint256 actualChainId);
    error InvalidProofConfiguration();
    error ProofConfigurationMismatch();

    function _strategy(address venue, uint64 validAfter, uint64 validUntil, bytes32 salt)
        internal
        view
        returns (MandateAquaApp.Strategy memory)
    {
        string memory parentLabel = vm.envString("SEPOLIA_PARENT_LABEL");
        string memory identityLabel = vm.envString("SEPOLIA_IDENTITY_LABEL");
        if (!EnsNamehash.isNormalizedLabel(parentLabel) || !EnsNamehash.isNormalizedLabel(identityLabel)) {
            revert InvalidProofConfiguration();
        }

        return MandateAquaApp.Strategy({
            maker: vm.envAddress("SEPOLIA_OWNER_ADDRESS"),
            agent: vm.envAddress("SEPOLIA_AGENT_ADDRESS"),
            ensRegistry: vm.envAddress("SEPOLIA_IDENTITY_REGISTRY"),
            ensResolver: vm.envAddress("SEPOLIA_IDENTITY_RESOLVER"),
            ensLabel: identityLabel,
            ensNode: EnsNamehash.derive(EnsNamehash.derive(EnsNamehash.ethNode(), parentLabel), identityLabel),
            tokenIn: address(OFFICIAL_MOCK_USDC),
            tokenOut: address(OFFICIAL_MOCK_DAI),
            swapTarget: venue,
            swapSelector: bytes4(keccak256("swap(uint256,uint256,address)")),
            minRateNumerator: OUTPUT_RATE_NUMERATOR,
            minRateDenominator: OUTPUT_RATE_DENOMINATOR,
            maxInputPerCall: TRADE_AMOUNT,
            maxInputTotal: INPUT_ALLOCATION,
            validAfter: validAfter,
            validUntil: validUntil,
            salt: salt
        });
    }

    function _readProof() internal view returns (Proof memory proof) {
        string memory json = vm.readFile(PROOF_PATH);
        proof.app = MandateAquaApp(vm.parseJsonAddress(json, ".app"));
        proof.venue = vm.parseJsonAddress(json, ".venue");
        proof.strategyHash = vm.parseJsonBytes32(json, ".strategyHash");
        proof.strategy = _strategy(
            proof.venue,
            uint64(vm.parseJsonUint(json, ".validAfter")),
            uint64(vm.parseJsonUint(json, ".validUntil")),
            vm.parseJsonBytes32(json, ".salt")
        );
        if (proof.app.strategyHash(proof.strategy) != proof.strategyHash) revert ProofConfigurationMismatch();
    }

    function _writeProof(Proof memory proof) internal {
        string memory json = vm.serializeAddress("proof", "app", address(proof.app));
        json = vm.serializeAddress("proof", "venue", proof.venue);
        json = vm.serializeBytes32("proof", "strategyHash", proof.strategyHash);
        json = vm.serializeUint("proof", "validAfter", proof.strategy.validAfter);
        json = vm.serializeUint("proof", "validUntil", proof.strategy.validUntil);
        json = vm.serializeBytes32("proof", "salt", proof.strategy.salt);
        vm.writeJson(json, PROOF_PATH);
    }

    function _proofOutput(uint256 amountIn) internal pure returns (uint256) {
        return amountIn * OUTPUT_RATE_NUMERATOR / OUTPUT_RATE_DENOMINATOR;
    }
}
