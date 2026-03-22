// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Test} from "forge-std/Test.sol";
import {SocialGraph} from "../src/SocialGraph.sol";

contract SocialGraphTest is Test {
    SocialGraph graph;

    address alice = makeAddr("alice");
    address bob   = makeAddr("bob");
    address carol = makeAddr("carol");

    event Followed(address indexed follower, address indexed followee);
    event Unfollowed(address indexed follower, address indexed followee);

    function setUp() public {
        graph = new SocialGraph();
    }

    // -------------------------------------------------------------------------
    // follow
    // -------------------------------------------------------------------------

    function test_Follow_SetsIsFollowing() public {
        vm.prank(alice);
        graph.follow(bob);

        assertTrue(graph.isFollowing(alice, bob));
    }

    function test_Follow_UpdatesCounters() public {
        vm.prank(alice);
        graph.follow(bob);

        assertEq(graph.followerCount(bob),    1);
        assertEq(graph.followingCount(alice), 1);
    }

    function test_Follow_EmitsEvent() public {
        vm.prank(alice);
        vm.expectEmit(true, true, false, false);
        emit Followed(alice, bob);
        graph.follow(bob);
    }

    /// @notice Multiple independent follows — parallel execution with no state conflict on Monad.
    function test_Follow_ManyUsersIndependent() public {
        address[4] memory users  = [alice, bob, carol, makeAddr("dave")];
        address           target = makeAddr("celebrity");

        for (uint256 i = 0; i < users.length; i++) {
            vm.prank(users[i]);
            graph.follow(target);
        }

        assertEq(graph.followerCount(target), 4);

        for (uint256 i = 0; i < users.length; i++) {
            assertTrue(graph.isFollowing(users[i], target));
        }
    }

    function test_RevertWhen_Follow_Self() public {
        vm.prank(alice);
        vm.expectRevert(SocialGraph.CannotFollowSelf.selector);
        graph.follow(alice);
    }

    function test_RevertWhen_Follow_AlreadyFollowing() public {
        vm.prank(alice);
        graph.follow(bob);

        vm.prank(alice);
        vm.expectRevert(SocialGraph.AlreadyFollowing.selector);
        graph.follow(bob);
    }

    // -------------------------------------------------------------------------
    // unfollow
    // -------------------------------------------------------------------------

    function test_Unfollow_ClearsIsFollowing() public {
        vm.prank(alice); graph.follow(bob);
        vm.prank(alice); graph.unfollow(bob);

        assertFalse(graph.isFollowing(alice, bob));
    }

    function test_Unfollow_DecrementsCounters() public {
        vm.prank(alice); graph.follow(bob);
        vm.prank(alice); graph.unfollow(bob);

        assertEq(graph.followerCount(bob),    0);
        assertEq(graph.followingCount(alice), 0);
    }

    function test_Unfollow_EmitsEvent() public {
        vm.prank(alice); graph.follow(bob);

        vm.prank(alice);
        vm.expectEmit(true, true, false, false);
        emit Unfollowed(alice, bob);
        graph.unfollow(bob);
    }

    function test_RevertWhen_Unfollow_NotFollowing() public {
        vm.prank(alice);
        vm.expectRevert(SocialGraph.NotFollowing.selector);
        graph.unfollow(bob);
    }

    // -------------------------------------------------------------------------
    // getStats
    // -------------------------------------------------------------------------

    function test_GetStats_ReturnsCorrectValues() public {
        vm.prank(alice); graph.follow(bob);
        vm.prank(carol); graph.follow(bob);
        vm.prank(alice); graph.follow(carol);

        (uint256 bobFollowers, uint256 bobFollowing) = graph.getStats(bob);
        assertEq(bobFollowers, 2);
        assertEq(bobFollowing, 0);

        (uint256 aliceFollowers, uint256 aliceFollowing) = graph.getStats(alice);
        assertEq(aliceFollowers, 0);
        assertEq(aliceFollowing, 2);
    }
}
