// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import {Aqua} from "@1inch/aqua/src/Aqua.sol";
import {IAqua} from "@1inch/aqua/src/interfaces/IAqua.sol";
import {Script} from "forge-std/Script.sol";
import {MandateAquaApp} from "../src/MandateAquaApp.sol";
import {MockAddrResolver, MockPermissionedRegistry} from "../test/fixtures/MockIdentity.sol";
import {MockERC20} from "../test/fixtures/MockTokens.sol";
import {LocalOnlyExactInputVenue} from "./LocalOnlyExactInputVenue.sol";

/// @dev Deploys only a deterministic local-Anvil fixture. It does not target a public network.
contract DeployLocal is Script {
    uint64 internal constant MAX_MANDATE_DURATION = 30 days;
    uint256 internal constant INPUT_ALLOCATION = 1_000e18;
    uint256 internal constant VENUE_OUTPUT_ALLOCATION = 2_000e18;
    bytes32 internal constant ENS_NODE = keccak256("mandate-agent.eth");
    string internal constant ENS_LABEL = "mandate-agent";

    function run()
        external
        returns (
            IAqua aqua,
            MandateAquaApp app,
            MockPermissionedRegistry registry,
            MockAddrResolver resolver,
            MockERC20 tokenIn,
            MockERC20 tokenOut,
            LocalOnlyExactInputVenue venue
        )
    {
        uint256 deployerKey = vm.envUint("LOCAL_DEPLOYER_PRIVATE_KEY");
        address agent = vm.envAddress("LOCAL_AGENT_ADDRESS");

        vm.startBroadcast(deployerKey);
        aqua = IAqua(address(new Aqua()));
        app = new MandateAquaApp(aqua, MAX_MANDATE_DURATION);
        registry = new MockPermissionedRegistry();
        resolver = new MockAddrResolver();
        tokenIn = new MockERC20("Local Input", "LIN");
        tokenOut = new MockERC20("Local Output", "LOUT");
        venue = new LocalOnlyExactInputVenue(tokenIn, tokenOut);
        tokenIn.mint(vm.addr(vm.envUint("LOCAL_OWNER_PRIVATE_KEY")), INPUT_ALLOCATION);
        tokenOut.mint(address(venue), VENUE_OUTPUT_ALLOCATION);
        _configureIdentity(registry, resolver, agent);
        vm.stopBroadcast();

        string memory object = "localDeployment";
        string memory json = vm.serializeAddress(object, "aqua", address(aqua));
        json = vm.serializeAddress(object, "app", address(app));
        json = vm.serializeAddress(object, "registry", address(registry));
        json = vm.serializeAddress(object, "resolver", address(resolver));
        json = vm.serializeAddress(object, "tokenIn", address(tokenIn));
        json = vm.serializeAddress(object, "tokenOut", address(tokenOut));
        json = vm.serializeAddress(object, "venue", address(venue));
        vm.createDir("broadcast", true);
        vm.writeJson(json, "broadcast/local-deployment.json");
    }

    function _configureIdentity(MockPermissionedRegistry registry, MockAddrResolver resolver, address agent) private {
        registry.setState(
            uint256(keccak256(bytes(ENS_LABEL))),
            MockPermissionedRegistry.State({
                status: MockPermissionedRegistry.Status.REGISTERED,
                expiry: uint64(block.timestamp + 2 days),
                latestOwner: agent,
                tokenId: 1,
                resource: 0
            })
        );
        registry.setOwner(1, agent);
        registry.setResolver(ENS_LABEL, address(resolver));
        resolver.setAddr(ENS_NODE, agent);
    }
}
