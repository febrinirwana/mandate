// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import {IAqua} from "@1inch/aqua/src/interfaces/IAqua.sol";
import {IPermissionedRegistry} from "@ensv2/contracts/registry/interfaces/IPermissionedRegistry.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {MandateAquaApp} from "../src/MandateAquaApp.sol";
import {SepoliaExactInputVenue} from "../src/SepoliaExactInputVenue.sol";
import {SepoliaProofConfig} from "./SepoliaProofConfig.sol";
import {EnsNamehash} from "./EnsNamehash.sol";

interface IMintableERC20 is IERC20 {
    function mint(address account, uint256 amount) external;
}

interface IProofResolver {
    function addr(bytes32 node) external view returns (address);
}

/// @dev Ships and activates a short-lived public Sepolia integration-proof strategy.
contract SetupSepoliaProofStrategy is SepoliaProofConfig {
    using SafeERC20 for IERC20;

    error CodeMissing(address account);
    error AppBindingMismatch();
    error IdentityBindingMismatch();
    error AquaBalanceMismatch();
    error MandateStateMismatch();

    function run() external returns (bytes32 strategyHash, address venue) {
        if (block.chainid != SEPOLIA_CHAIN_ID) revert WrongChain(block.chainid);

        MandateAquaApp app = MandateAquaApp(vm.envAddress("SEPOLIA_MANDATE_APP"));
        address owner = vm.envAddress("SEPOLIA_OWNER_ADDRESS");
        _preflight(app, owner);

        uint64 validAfter = uint64(block.timestamp);
        uint64 validUntil = validAfter + PROOF_DURATION;
        bytes32 salt = keccak256(abi.encode(owner, address(app), validAfter, "sepolia-integration-proof-v1"));

        vm.startBroadcast();
        SepoliaExactInputVenue proofVenue = new SepoliaExactInputVenue(
            OFFICIAL_MOCK_USDC, OFFICIAL_MOCK_DAI, owner, OUTPUT_RATE_NUMERATOR, OUTPUT_RATE_DENOMINATOR
        );
        venue = address(proofVenue);
        MandateAquaApp.Strategy memory strategy = _strategy(venue, validAfter, validUntil, salt);
        strategyHash = app.strategyHash(strategy);
        IMintableERC20(address(OFFICIAL_MOCK_USDC)).mint(owner, INPUT_ALLOCATION);
        IMintableERC20(address(OFFICIAL_MOCK_DAI)).mint(venue, _proofOutput(INPUT_ALLOCATION));
        OFFICIAL_MOCK_USDC.forceApprove(address(OFFICIAL_SEPOLIA_AQUA), INPUT_ALLOCATION);
        address[] memory tokens = new address[](2);
        tokens[0] = address(OFFICIAL_MOCK_USDC);
        tokens[1] = address(OFFICIAL_MOCK_DAI);
        uint256[] memory amounts = new uint256[](2);
        amounts[0] = INPUT_ALLOCATION;
        IAqua(OFFICIAL_SEPOLIA_AQUA).ship(address(app), abi.encode(strategy), tokens, amounts);
        app.activate(strategy);
        vm.stopBroadcast();

        Proof memory proof = Proof({app: app, venue: venue, strategyHash: strategyHash, strategy: strategy});
        _writeProof(proof);
        _verify(proof);
    }

    function _preflight(MandateAquaApp app, address owner) private view {
        if (
            address(app).code.length == 0 || address(OFFICIAL_MOCK_USDC).code.length == 0
                || address(OFFICIAL_MOCK_DAI).code.length == 0
        ) {
            revert CodeMissing(address(app));
        }
        if (address(app.AQUA()) != OFFICIAL_SEPOLIA_AQUA || app.MAX_MANDATE_DURATION() < PROOF_DURATION) {
            revert AppBindingMismatch();
        }

        IPermissionedRegistry registry = IPermissionedRegistry(vm.envAddress("SEPOLIA_IDENTITY_REGISTRY"));
        string memory label = vm.envString("SEPOLIA_IDENTITY_LABEL");
        string memory parentLabel = vm.envString("SEPOLIA_PARENT_LABEL");
        address agent = vm.envAddress("SEPOLIA_AGENT_ADDRESS");
        address resolver = vm.envAddress("SEPOLIA_IDENTITY_RESOLVER");
        bytes32 node = EnsNamehash.derive(EnsNamehash.derive(EnsNamehash.ethNode(), parentLabel), label);
        IPermissionedRegistry.State memory state = registry.getState(uint256(keccak256(bytes(label))));
        if (
            owner == address(0) || agent == address(0) || address(registry).code.length == 0
                || resolver.code.length == 0 || !EnsNamehash.isNormalizedLabel(parentLabel)
                || !EnsNamehash.isNormalizedLabel(label) || state.status != IPermissionedRegistry.Status.REGISTERED
                || state.expiry <= block.timestamp || registry.ownerOf(state.tokenId) != agent
                || registry.getResolver(label) != resolver || IProofResolver(resolver).addr(node) != agent
        ) revert IdentityBindingMismatch();
    }

    function _verify(Proof memory proof) private view {
        (uint248 inputBalance, uint8 inputTokens) = IAqua(OFFICIAL_SEPOLIA_AQUA)
            .rawBalances(proof.strategy.maker, address(proof.app), proof.strategyHash, address(OFFICIAL_MOCK_USDC));
        (uint248 outputBalance, uint8 outputTokens) = IAqua(OFFICIAL_SEPOLIA_AQUA)
            .rawBalances(proof.strategy.maker, address(proof.app), proof.strategyHash, address(OFFICIAL_MOCK_DAI));
        if (inputBalance != INPUT_ALLOCATION || outputBalance != 0 || inputTokens != 2 || outputTokens != 2) {
            revert AquaBalanceMismatch();
        }
        MandateAquaApp.Inspection memory inspection = proof.app.inspect(proof.strategy);
        if (
            inspection.strategyHash != proof.strategyHash || inspection.maker != proof.strategy.maker
                || inspection.usedInput != 0 || !inspection.activated || inspection.revoked
        ) revert MandateStateMismatch();
    }
}
