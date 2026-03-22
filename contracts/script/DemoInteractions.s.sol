// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Script, console} from "forge-std/Script.sol";
import {Posts}        from "../src/Posts.sol";
import {Interactions} from "../src/Interactions.sol";
import {SocialGraph}  from "../src/SocialGraph.sol";

/// @notice Demo script: create posts, likes, a comment, and an optional follow.
///
/// Required env:
///   PRIVATE_KEY, POSTS_ADDRESS, INTERACTIONS_ADDRESS, SOCIAL_GRAPH_ADDRESS
///
/// Optional env:
///   LIKER_PRIVATE_KEY — second EOA private key (0x...) to add another like on the first post
///   FOLLOWEE_ADDRESS  — address to follow (default: 0x000...0001)
///
/// Usage:
///   source .env && forge script script/DemoInteractions.s.sol:DemoInteractions \
///     --rpc-url https://testnet-rpc.monad.xyz --broadcast -vvvv
contract DemoInteractions is Script {
    function run() external {
        uint256 deployerKey = vm.envUint("PRIVATE_KEY");
        address deployer    = vm.addr(deployerKey);

        address postsAddr        = vm.envAddress("POSTS_ADDRESS");
        address interactionsAddr = vm.envAddress("INTERACTIONS_ADDRESS");
        address socialGraphAddr  = vm.envAddress("SOCIAL_GRAPH_ADDRESS");

        Posts        posts        = Posts(postsAddr);
        Interactions interactions = Interactions(interactionsAddr);
        SocialGraph  socialGraph  = SocialGraph(socialGraphAddr);

        address followee = vm.envOr("FOLLOWEE_ADDRESS", address(uint160(1)));

        console.log("===== Monad Social demo interactions =====");
        console.log("Deployer     :", deployer);
        console.log("Posts        :", postsAddr);
        console.log("Interactions :", interactionsAddr);
        console.log("SocialGraph  :", socialGraphAddr);
        console.log("");

        // --- Primary wallet: two posts (independent state → parallel-friendly), likes, comment, follow
        vm.startBroadcast(deployerKey);

        uint256 post1 = posts.createPost("ipfs://bafybeidemopost1-monad-social-demo");
        uint256 post2 = posts.createPost("ipfs://bafybeidemopost2-monad-social-demo");

        interactions.like(post1);
        interactions.like(post2);

        interactions.createComment(post1, "ipfs://bafybeidemocomment1-monad-social-demo");

        if (followee != deployer) {
            socialGraph.follow(followee);
        } else {
            console.log("(skip follow: FOLLOWEE_ADDRESS equals deployer)");
        }

        vm.stopBroadcast();

        console.log("Post 1 id    :", post1);
        console.log("Post 2 id    :", post2);
        console.log("Like count p1:", interactions.likeCount(post1));
        console.log("Like count p2:", interactions.likeCount(post2));

        // --- Optional second wallet: extra like on post 1
        uint256 likerKey = vm.envOr("LIKER_PRIVATE_KEY", uint256(0));
        if (likerKey != 0) {
            address liker = vm.addr(likerKey);
            if (liker == deployer) {
                console.log("LIKER_PRIVATE_KEY matches deployer; skip second like on post 1");
            } else {
                console.log("Second liker :", liker);
                vm.startBroadcast(likerKey);
                interactions.like(post1);
                vm.stopBroadcast();
                console.log("Like count p1 after 2nd wallet:", interactions.likeCount(post1));
            }
        } else {
            console.log("Set LIKER_PRIVATE_KEY in .env to add a second like on post 1 from another EOA");
        }

        console.log("");
        console.log("Done.");
    }
}
