// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import {Test} from "forge-std/Test.sol";
import {DeploySepolia} from "../script/DeploySepolia.s.sol";
import {ProvisionEnsNamespace} from "../script/ProvisionEnsNamespace.s.sol";
import {SetupEnsIdentity} from "../script/SetupEnsIdentity.s.sol";
import {StopEnsIdentity} from "../script/StopEnsIdentity.s.sol";
import {RepairEnsIdentity} from "../script/RepairEnsIdentity.s.sol";
import {ExecuteSepoliaProofStrategy} from "../script/ExecuteSepoliaProofStrategy.s.sol";
import {SetupSepoliaProofStrategy} from "../script/SetupSepoliaProofStrategy.s.sol";
import {SepoliaProofConfig} from "../script/SepoliaProofConfig.sol";
import {BuildSepoliaStopProbe} from "../script/BuildSepoliaStopProbe.s.sol";

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

    function testProvisionEnsNamespaceRefusesAnyNonSepoliaChain() public {
        ProvisionEnsNamespace script = new ProvisionEnsNamespace();

        vm.expectRevert(abi.encodeWithSelector(ProvisionEnsNamespace.WrongChain.selector, block.chainid));
        script.run();
    }

    function testProvisionEnsNamespaceRejectsModifiedOfficialRegistryCode() public {
        vm.chainId(11_155_111);
        vm.setEnv("SEPOLIA_OWNER_ADDRESS", "0xf48DBc49B23669e8B08fC6c08e0aB61cf7301466");
        vm.setEnv("SEPOLIA_AGENT_ADDRESS", "0x77606352f523f8a076498aB8BeFF3af3BC1e492A");
        vm.setEnv("SEPOLIA_PARENT_LABEL", "mandate-f48d");
        vm.etch(0xBDC85dD5b15D7ecb354cd7cb6f2c50b4f2c4F0E2, hex"6000");
        vm.etch(0x10dC6333CDFe1FCEf624c6e0a8221b91804Cd7ef, hex"6000");
        vm.etch(0x624a25d67B59D587752EbEc8DdeD8827dAe52050, hex"6000");
        vm.etch(0x9EAe5C2730a7dD16BDD1DeE6421a1B91e3B0365e, hex"6000");

        ProvisionEnsNamespace script = new ProvisionEnsNamespace();

        vm.expectRevert(
            abi.encodeWithSelector(
                ProvisionEnsNamespace.OfficialCodeHashMismatch.selector,
                0xBDC85dD5b15D7ecb354cd7cb6f2c50b4f2c4F0E2,
                keccak256(hex"6000")
            )
        );
        script.run();
    }

    function testEnsScriptsUseStandardNamehash() public {
        ProvisionEnsNamespace provision = new ProvisionEnsNamespace();
        SetupEnsIdentity setup = new SetupEnsIdentity();
        RepairEnsIdentity repair = new RepairEnsIdentity();

        bytes32 parentNode = provision.deriveEthParentNode("mandate-test");
        assertEq(parentNode, 0xd73c596f4f79b222fa0f4358616377627ec437235166aeec8741e3507ced9a8a);
        assertEq(
            setup.deriveNode(parentNode, "agent"), 0x38487fa23703342a9da685adffe972546c61377db5e07135a27fadf646e14e64
        );

        (bytes32 standardNode, bytes32 legacyNode) = repair.deriveNodes("mandate-test", "agent");
        assertEq(standardNode, 0x38487fa23703342a9da685adffe972546c61377db5e07135a27fadf646e14e64);
        assertEq(legacyNode, 0x0b4b546c72d29758482cdc0641d2f33ce055313dc77d7ccac472a0d399618bd6);
    }

    function testProvisionEnsNamespaceRejectsNonNormalizedParentLabel() public {
        ProvisionEnsNamespace script = new ProvisionEnsNamespace();

        vm.expectRevert(ProvisionEnsNamespace.InvalidParentLabel.selector);
        script.deriveEthParentNode("-mandate");
    }

    function testProvisionEnsNamespaceGrantsOnlyRequiredRootRoles() public {
        ProvisionEnsNamespace script = new ProvisionEnsNamespace();

        assertEq(script.userRegistryInitialRoles(), (1 << 0) | (1 << 8) | (1 << 12) | ((1 << 8) << 128));
        assertEq(script.resolverInitialRoles(), 1 << 0);
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

    function testRepairEnsIdentityRefusesAnyNonSepoliaChain() public {
        RepairEnsIdentity script = new RepairEnsIdentity();

        vm.expectRevert(abi.encodeWithSelector(RepairEnsIdentity.WrongChain.selector, block.chainid));
        script.run();
    }

    function testRepairEnsIdentityRejectsNonNormalizedLabels() public {
        RepairEnsIdentity script = new RepairEnsIdentity();

        vm.expectRevert(RepairEnsIdentity.InvalidIdentityLabel.selector);
        script.deriveNodes("-mandate", "agent");
    }

    function testSetupSepoliaProofStrategyRefusesAnyNonSepoliaChain() public {
        SetupSepoliaProofStrategy script = new SetupSepoliaProofStrategy();

        vm.expectRevert(abi.encodeWithSelector(SepoliaProofConfig.WrongChain.selector, block.chainid));
        script.run();
    }

    function testExecuteSepoliaProofStrategyRefusesAnyNonSepoliaChain() public {
        ExecuteSepoliaProofStrategy script = new ExecuteSepoliaProofStrategy();

        vm.expectRevert(abi.encodeWithSelector(SepoliaProofConfig.WrongChain.selector, block.chainid));
        script.run();
    }

    function testBuildSepoliaStopProbeRefusesAnyNonSepoliaChain() public {
        BuildSepoliaStopProbe script = new BuildSepoliaStopProbe();

        vm.expectRevert(abi.encodeWithSelector(SepoliaProofConfig.WrongChain.selector, block.chainid));
        script.run();
    }

    function testStopEnsIdentityRefusesAnyNonSepoliaChain() public {
        StopEnsIdentity script = new StopEnsIdentity();

        vm.expectRevert(abi.encodeWithSelector(StopEnsIdentity.WrongChain.selector, block.chainid));
        script.run();
    }
}
