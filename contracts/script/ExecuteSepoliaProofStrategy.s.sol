// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import {IAqua} from "@1inch/aqua/src/interfaces/IAqua.sol";
import {MandateAquaApp} from "../src/MandateAquaApp.sol";
import {SepoliaExactInputVenue} from "../src/SepoliaExactInputVenue.sol";
import {SepoliaProofConfig} from "./SepoliaProofConfig.sol";

/// @dev Executes exactly one public Sepolia integration-proof trade from the dedicated agent account.
contract ExecuteSepoliaProofStrategy is SepoliaProofConfig {
    error ProofAlreadyExecuted(uint256 usedInput);
    error ProofExecutionMismatch();

    function run() external returns (uint256 amountOut) {
        if (block.chainid != SEPOLIA_CHAIN_ID) revert WrongChain(block.chainid);

        Proof memory proof = _readProof();
        MandateAquaApp.Inspection memory beforeInspection = proof.app.inspect(proof.strategy);
        if (!beforeInspection.activated || beforeInspection.revoked || beforeInspection.usedInput != 0) {
            revert ProofAlreadyExecuted(beforeInspection.usedInput);
        }

        uint256 expectedOutput = _proofOutput(TRADE_AMOUNT);
        bytes memory routeData =
            abi.encodeCall(SepoliaExactInputVenue.swap, (TRADE_AMOUNT, expectedOutput, address(proof.app)));
        vm.startBroadcast();
        amountOut = proof.app
            .execute(proof.strategy, TRADE_AMOUNT, expectedOutput, uint64(block.timestamp + 5 minutes), routeData);
        vm.stopBroadcast();

        MandateAquaApp.Inspection memory afterInspection = proof.app.inspect(proof.strategy);
        (uint248 inputBalance, uint8 inputTokenCount) = IAqua(OFFICIAL_SEPOLIA_AQUA)
            .rawBalances(proof.strategy.maker, address(proof.app), proof.strategyHash, address(OFFICIAL_MOCK_USDC));
        (uint248 outputBalance, uint8 outputTokenCount) = IAqua(OFFICIAL_SEPOLIA_AQUA)
            .rawBalances(proof.strategy.maker, address(proof.app), proof.strategyHash, address(OFFICIAL_MOCK_DAI));
        if (
            amountOut != expectedOutput || afterInspection.usedInput != TRADE_AMOUNT
                || inputBalance != INPUT_ALLOCATION - TRADE_AMOUNT || outputBalance != expectedOutput
                || inputTokenCount != 2 || outputTokenCount != 2
        ) revert ProofExecutionMismatch();
    }
}
