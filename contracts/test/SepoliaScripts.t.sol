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

    function testSetupEnsIdentityRefusesAnyNonSepoliaChain() public {
        SetupEnsIdentity script = new SetupEnsIdentity();

        vm.expectRevert(abi.encodeWithSelector(SetupEnsIdentity.WrongChain.selector, block.chainid));
        script.run();
    }

    function testStopEnsIdentityRefusesAnyNonSepoliaChain() public {
        StopEnsIdentity script = new StopEnsIdentity();

        vm.expectRevert(abi.encodeWithSelector(StopEnsIdentity.WrongChain.selector, block.chainid));
        script.run();
    }
}
