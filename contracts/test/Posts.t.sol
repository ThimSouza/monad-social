// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Test, console} from "forge-std/Test.sol";
import {Posts} from "../src/Posts.sol";

contract PostsTest is Test {
    Posts posts;

    address alice = makeAddr("alice");
    address bob   = makeAddr("bob");
    address carol = makeAddr("carol");

    event PostCreated(uint256 indexed postId, address indexed author, string contentURI, uint64 createdAt);
    event PostDeleted(uint256 indexed postId, address indexed author);

    function setUp() public {
        posts = new Posts();
    }

    // -------------------------------------------------------------------------
    // createPost
    // -------------------------------------------------------------------------

    function test_CreatePost_EmitsEvent() public {
        vm.prank(alice);
        vm.expectEmit(true, true, false, false);
        emit PostCreated(1, alice, "ipfs://QmAlice", 0);
        posts.createPost("ipfs://QmAlice");
    }

    function test_CreatePost_IncrementsTotalPosts() public {
        vm.prank(alice);
        posts.createPost("ipfs://QmAlice");
        assertEq(posts.totalPosts(), 1);

        vm.prank(bob);
        posts.createPost("ipfs://QmBob");
        assertEq(posts.totalPosts(), 2);
    }

    function test_CreatePost_StoresCorrectData() public {
        vm.warp(1_000_000);
        vm.prank(alice);
        uint256 id = posts.createPost("ipfs://QmTest");

        Posts.Post memory p = posts.getPost(id);
        assertEq(p.author,     alice);
        assertEq(p.contentURI, "ipfs://QmTest");
        assertEq(p.createdAt,  1_000_000);
        assertFalse(p.deleted);
    }

    function test_CreatePost_TracksAuthorPostIds() public {
        vm.startPrank(alice);
        posts.createPost("ipfs://QmA1");
        posts.createPost("ipfs://QmA2");
        vm.stopPrank();

        assertEq(posts.postCountByAuthor(alice), 2);
        uint256[] memory ids = posts.postsByAuthor(alice);
        assertEq(ids[0], 1);
        assertEq(ids[1], 2);
    }

    /// @notice Simulates N users posting concurrently — independent state per author.
    function test_CreatePost_MultipleAuthorsParallel() public {
        address[5] memory users = [alice, bob, carol, makeAddr("dave"), makeAddr("eve")];

        for (uint256 i = 0; i < users.length; i++) {
            vm.prank(users[i]);
            posts.createPost(string.concat("ipfs://Qm", vm.toString(i)));
        }

        assertEq(posts.totalPosts(), 5);

        for (uint256 i = 0; i < users.length; i++) {
            assertEq(posts.postCountByAuthor(users[i]), 1);
        }
    }

    function test_RevertWhen_CreatePost_EmptyURI() public {
        vm.prank(alice);
        vm.expectRevert(Posts.EmptyContentURI.selector);
        posts.createPost("");
    }

    // -------------------------------------------------------------------------
    // deletePost
    // -------------------------------------------------------------------------

    function test_DeletePost_SetsDeletedFlag() public {
        vm.prank(alice);
        uint256 id = posts.createPost("ipfs://QmA");

        vm.prank(alice);
        posts.deletePost(id);

        assertTrue(posts.getPost(id).deleted);
    }

    function test_DeletePost_EmitsEvent() public {
        vm.prank(alice);
        uint256 id = posts.createPost("ipfs://QmA");

        vm.prank(alice);
        vm.expectEmit(true, true, false, false);
        emit PostDeleted(id, alice);
        posts.deletePost(id);
    }

    function test_RevertWhen_DeletePost_NotAuthor() public {
        vm.prank(alice);
        uint256 id = posts.createPost("ipfs://QmA");

        vm.prank(bob);
        vm.expectRevert(Posts.NotAuthor.selector);
        posts.deletePost(id);
    }

    function test_RevertWhen_DeletePost_DoesNotExist() public {
        vm.prank(alice);
        vm.expectRevert(Posts.PostDoesNotExist.selector);
        posts.deletePost(999);
    }

    function test_RevertWhen_DeletePost_AlreadyDeleted() public {
        vm.prank(alice);
        uint256 id = posts.createPost("ipfs://QmA");

        vm.prank(alice);
        posts.deletePost(id);

        vm.prank(alice);
        vm.expectRevert(Posts.AlreadyDeleted.selector);
        posts.deletePost(id);
    }
}
