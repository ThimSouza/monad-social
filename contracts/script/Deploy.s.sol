// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {Posts}        from "../src/Posts.sol";
import {Interactions} from "../src/Interactions.sol";
import {SocialGraph}  from "../src/SocialGraph.sol";

/// @notice Sequential deploy of all three contracts.
///         Interactions depends on Posts address, so order matters.
///
/// Usage (testnet):
///   forge script script/Deploy.s.sol \
///     --rpc-url https://testnet-rpc.monad.xyz \
///     --private-key $PRIVATE_KEY \
///     --broadcast \
///     --verify \
///     --verifier sourcify \
///     --verifier-url https://sourcify-api-monad.blockvision.org
///
/// Usage (mainnet):
///   forge script script/Deploy.s.sol \
///     --profile mainnet \
///     --private-key $PRIVATE_KEY \
///     --broadcast \
///     --verify \
///     --verifier sourcify \
///     --verifier-url https://sourcify-api-monad.blockvision.org
contract Deploy is Script {
    function run() external {
        uint256 deployerKey = vm.envUint("PRIVATE_KEY");
        address deployer    = vm.addr(deployerKey);

        console.log("===== Monad Social Deploy =====");
        console.log("Deployer :", deployer);
        console.log("Chain ID :", block.chainid);
        console.log("");

        vm.startBroadcast(deployerKey);

        Posts posts = new Posts();
        console.log("Posts        :", address(posts));

        Interactions interactions = new Interactions(address(posts));
        console.log("Interactions :", address(interactions));

        SocialGraph socialGraph = new SocialGraph();
        console.log("SocialGraph  :", address(socialGraph));

        vm.stopBroadcast();

        // Print ready-to-paste blocks for frontend and indexer
        console.log("");
        console.log("===== .env.local (frontend) =====");
        console.log("NEXT_PUBLIC_POSTS_ADDRESS=%s",        address(posts));
        console.log("NEXT_PUBLIC_INTERACTIONS_ADDRESS=%s", address(interactions));
        console.log("NEXT_PUBLIC_SOCIAL_GRAPH_ADDRESS=%s", address(socialGraph));

        console.log("");
        console.log("===== config.yaml (Envio indexer) =====");
        console.log("# posts_address:        %s", address(posts));
        console.log("# interactions_address: %s", address(interactions));
        console.log("# social_graph_address: %s", address(socialGraph));
    }
}
