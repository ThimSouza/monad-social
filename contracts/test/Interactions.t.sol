// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Test} from "forge-std/Test.sol";
import {Posts} from "../src/Posts.sol";
import {Interactions} from "../src/Interactions.sol";

contract InteractionsTest is Test {
    Posts        posts;
    Interactions interactions;

    address alice = makeAddr("alice");
    address bob   = makeAddr("bob");
    address carol = makeAddr("carol");

    uint256 alicePostId;

    event Liked(uint256 indexed postId, address indexed user);
    event Unliked(uint256 indexed postId, address indexed user);
    event CommentCreated(
        uint256 indexed commentId,
        uint256 indexed postId,
        address indexed author,
        string  contentURI,
        uint64  createdAt
    );
    event CommentDeleted(uint256 indexed commentId, address indexed author);

    function setUp() public {
        posts        = new Posts();
        interactions = new Interactions(address(posts));

        vm.prank(alice);
        alicePostId = posts.createPost("ipfs://QmAlicePost");
    }

    // -------------------------------------------------------------------------
    // like
    // -------------------------------------------------------------------------

    function test_Like_EmitsEvent() public {
        vm.prank(bob);
        vm.expectEmit(true, true, false, false);
        emit Liked(alicePostId, bob);
        interactions.like(alicePostId);
    }

    function test_Like_IncrementsCount() public {
        vm.prank(bob);   interactions.like(alicePostId);
        vm.prank(carol); interactions.like(alicePostId);

        assertEq(interactions.likeCount(alicePostId), 2);
    }

    function test_Like_SetsHasLiked() public {
        vm.prank(bob);
        interactions.like(alicePostId);

        assertTrue(interactions.hasLiked(alicePostId, bob));
        assertFalse(interactions.hasLiked(alicePostId, carol));
    }

    /// @notice Likes on different posts are 100% independent state — no conflict on Monad.
    function test_Like_MultiplePosts_Independent() public {
        vm.prank(bob);
        uint256 bobPostId = posts.createPost("ipfs://QmBobPost");

        vm.prank(carol); interactions.like(alicePostId);
        vm.prank(alice); interactions.like(bobPostId);

        assertEq(interactions.likeCount(alicePostId), 1);
        assertEq(interactions.likeCount(bobPostId),   1);
    }

    function test_RevertWhen_Like_AlreadyLiked() public {
        vm.prank(bob);
        interactions.like(alicePostId);

        vm.prank(bob);
        vm.expectRevert(Interactions.AlreadyLiked.selector);
        interactions.like(alicePostId);
    }

    function test_RevertWhen_Like_PostNotFound() public {
        vm.prank(bob);
        vm.expectRevert(Interactions.PostNotFound.selector);
        interactions.like(999);
    }

    function test_RevertWhen_Like_DeletedPost() public {
        vm.prank(alice);
        posts.deletePost(alicePostId);

        vm.prank(bob);
        vm.expectRevert(Interactions.PostNotFound.selector);
        interactions.like(alicePostId);
    }

    // -------------------------------------------------------------------------
    // unlike
    // -------------------------------------------------------------------------

    function test_Unlike_DecrementsCount() public {
        vm.prank(bob); interactions.like(alicePostId);
        vm.prank(bob); interactions.unlike(alicePostId);

        assertEq(interactions.likeCount(alicePostId), 0);
        assertFalse(interactions.hasLiked(alicePostId, bob));
    }

    function test_Unlike_EmitsEvent() public {
        vm.prank(bob); interactions.like(alicePostId);

        vm.prank(bob);
        vm.expectEmit(true, true, false, false);
        emit Unliked(alicePostId, bob);
        interactions.unlike(alicePostId);
    }

    function test_RevertWhen_Unlike_NotLiked() public {
        vm.prank(bob);
        vm.expectRevert(Interactions.NotLiked.selector);
        interactions.unlike(alicePostId);
    }

    // -------------------------------------------------------------------------
    // createComment
    // -------------------------------------------------------------------------

    function test_CreateComment_StoresData() public {
        vm.warp(2_000_000);
        vm.prank(bob);
        uint256 commentId = interactions.createComment(alicePostId, "ipfs://QmComment");

        Interactions.Comment memory c = interactions.getComment(commentId);
        assertEq(c.author,     bob);
        assertEq(c.postId,     alicePostId);
        assertEq(c.contentURI, "ipfs://QmComment");
        assertEq(c.createdAt,  2_000_000);
        assertFalse(c.deleted);
    }

    function test_CreateComment_AppendsToPost() public {
        vm.prank(bob);   interactions.createComment(alicePostId, "ipfs://QmC1");
        vm.prank(carol); interactions.createComment(alicePostId, "ipfs://QmC2");

        uint256[] memory ids = interactions.commentsByPost(alicePostId);
        assertEq(ids.length, 2);
    }

    function test_CreateComment_EmitsEvent() public {
        vm.prank(bob);
        vm.expectEmit(true, true, true, false);
        emit CommentCreated(1, alicePostId, bob, "ipfs://QmC", 0);
        interactions.createComment(alicePostId, "ipfs://QmC");
    }

    function test_RevertWhen_CreateComment_EmptyURI() public {
        vm.prank(bob);
        vm.expectRevert(Interactions.EmptyContentURI.selector);
        interactions.createComment(alicePostId, "");
    }

    function test_RevertWhen_CreateComment_PostNotFound() public {
        vm.prank(bob);
        vm.expectRevert(Interactions.PostNotFound.selector);
        interactions.createComment(999, "ipfs://QmC");
    }

    // -------------------------------------------------------------------------
    // deleteComment
    // -------------------------------------------------------------------------

    function test_DeleteComment_SetsDeletedFlag() public {
        vm.prank(bob);
        uint256 commentId = interactions.createComment(alicePostId, "ipfs://QmC");

        vm.prank(bob);
        interactions.deleteComment(commentId);

        assertTrue(interactions.getComment(commentId).deleted);
    }

    function test_RevertWhen_DeleteComment_NotAuthor() public {
        vm.prank(bob);
        uint256 commentId = interactions.createComment(alicePostId, "ipfs://QmC");

        vm.prank(carol);
        vm.expectRevert(Interactions.NotCommentAuthor.selector);
        interactions.deleteComment(commentId);
    }

    function test_RevertWhen_DeleteComment_AlreadyDeleted() public {
        vm.prank(bob);
        uint256 commentId = interactions.createComment(alicePostId, "ipfs://QmC");

        vm.prank(bob); interactions.deleteComment(commentId);

        vm.prank(bob);
        vm.expectRevert(Interactions.CommentAlreadyDeleted.selector);
        interactions.deleteComment(commentId);
    }
}
