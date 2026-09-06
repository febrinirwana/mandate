// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import {Test} from "forge-std/Test.sol";
import {DeploySepolia} from "../script/DeploySepolia.s.sol";
import {SetupEnsIdentity} from "../script/SetupEnsIdentity.s.sol";
import {StopEnsIdentity} from "../script/StopEnsIdentity.s.sol";

contract SepoliaScriptsTest is Test {
    function testDeploySepoliaRefusesAnyNonSepoliaChain() public {
        DeploySepolia script = new DeploySepolia();

        vm.expectRevert(abi.encodeWithSelector(DeploySepolia.WrongChain.selector, block.chainid));
        script.run();
    }

    function testDeploySepoliaRejectsMismatchedOfficialAquaCode() public {
        vm.chainId(11_155_111);
        vm.etch(0x1111113CCf1426A8E30e2bfF5E005d929bF6a90a, hex"6000");

        DeploySepolia script = new DeploySepolia();

        vm.expectRevert(abi.encodeWithSelector(DeploySepolia.AquaCodeHashMismatch.selector, keccak256(hex"6000")));
        script.run();
    }

    function testSetupEnsIdentityRefusesAnyNonSepoliaChain() public {
        SetupEnsIdentity script = new SetupEnsIdentity();

        vm.expectRevert(abi.encodeWithSelector(SetupEnsIdentity.WrongChain.selector, block.chainid));
        script.run();
    }

    function testSetupEnsIdentityDerivesChildNodeFromParentAndLabel() public {
        SetupEnsIdentity script = new SetupEnsIdentity();

        assertEq(
            script.deriveNode(0xdd7a036b39ddb68d00246a619eb9e530659628b15523b435bf9ad5c5c4d74c90, "agent"),
            0xdac922a62f53701c35dce88d9d2ee0b24f15871f4af98f6131b5a966abdc76b5
        );
    }

    function testSetupEnsIdentityRejectsNonNormalizedAsciiLabel() public {
        SetupEnsIdentity script = new SetupEnsIdentity();

        vm.expectRevert(SetupEnsIdentity.InvalidIdentityLabel.selector);
        script.deriveNode(0xdd7a036b39ddb68d00246a619eb9e530659628b15523b435bf9ad5c5c4d74c90, "-agent");
    }

    function testStopEnsIdentityRefusesAnyNonSepoliaChain() public {
        StopEnsIdentity script = new StopEnsIdentity();

        vm.expectRevert(abi.encodeWithSelector(StopEnsIdentity.WrongChain.selector, block.chainid));
        script.run();
    }
}
