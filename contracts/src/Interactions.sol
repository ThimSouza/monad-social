// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Posts} from "./Posts.sol";

/// @title  Interactions
/// @notice Likes and comments associated with posts.
///         Likes on different posts are completely independent state —
///         Monad can execute them in parallel with zero re-execution.
contract Interactions {
    // -------------------------------------------------------------------------
    // Types
    // -------------------------------------------------------------------------

    struct Comment {
        address author;
        uint256 postId;
        string  contentURI;
        uint64  createdAt;
        bool    deleted;
    }

    // -------------------------------------------------------------------------
    // State
    // -------------------------------------------------------------------------

    Posts public immutable postsContract;

    uint256 public totalComments;

    /// postId => total likes
    mapping(uint256 => uint256) public likeCount;

    /// postId => user => liked?
    mapping(uint256 => mapping(address => bool)) public hasLiked;

    /// commentId => Comment
    mapping(uint256 => Comment) public comments;

    /// postId => list of commentIds
    mapping(uint256 => uint256[]) private _commentsByPost;

    // -------------------------------------------------------------------------
    // Events
    // -------------------------------------------------------------------------

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

    // -------------------------------------------------------------------------
    // Errors
    // -------------------------------------------------------------------------

    error PostNotFound();
    error AlreadyLiked();
    error NotLiked();
    error EmptyContentURI();
    error NotCommentAuthor();
    error CommentNotFound();
    error CommentAlreadyDeleted();

    // -------------------------------------------------------------------------
    // Constructor
    // -------------------------------------------------------------------------

    constructor(address postsAddress) {
        postsContract = Posts(postsAddress);
    }

    // -------------------------------------------------------------------------
    // Internal helpers
    // -------------------------------------------------------------------------

    function _assertPostExists(uint256 postId) internal view {
        Posts.Post memory p = postsContract.getPost(postId);
        if (p.author == address(0) || p.deleted) revert PostNotFound();
    }

    // -------------------------------------------------------------------------
    // Like / Unlike
    // -------------------------------------------------------------------------

    /// @notice Likes a post. Likes on distinct posts are independent state —
    ///         parallel execution with no re-execution on Monad.
    function like(uint256 postId) external {
        _assertPostExists(postId);
        if (hasLiked[postId][msg.sender]) revert AlreadyLiked();

        hasLiked[postId][msg.sender] = true;
        likeCount[postId]++;

        emit Liked(postId, msg.sender);
    }

    function unlike(uint256 postId) external {
        if (!hasLiked[postId][msg.sender]) revert NotLiked();

        hasLiked[postId][msg.sender] = false;
        likeCount[postId]--;

        emit Unliked(postId, msg.sender);
    }

    // -------------------------------------------------------------------------
    // Comments
    // -------------------------------------------------------------------------

    /// @param contentURI  IPFS URI of the comment content
    function createComment(uint256 postId, string calldata contentURI)
        external
        returns (uint256 commentId)
    {
        if (bytes(contentURI).length == 0) revert EmptyContentURI();
        _assertPostExists(postId);

        commentId = ++totalComments;

        comments[commentId] = Comment({
            author:     msg.sender,
            postId:     postId,
            contentURI: contentURI,
            createdAt:  uint64(block.timestamp),
            deleted:    false
        });

        _commentsByPost[postId].push(commentId);

        emit CommentCreated(commentId, postId, msg.sender, contentURI, uint64(block.timestamp));
    }

    function deleteComment(uint256 commentId) external {
        Comment storage c = comments[commentId];
        if (c.author == address(0)) revert CommentNotFound();
        if (c.author != msg.sender)  revert NotCommentAuthor();
        if (c.deleted)               revert CommentAlreadyDeleted();

        c.deleted = true;

        emit CommentDeleted(commentId, msg.sender);
    }

    // -------------------------------------------------------------------------
    // Read
    // -------------------------------------------------------------------------

    function getComment(uint256 commentId) external view returns (Comment memory) {
        return comments[commentId];
    }

    function commentsByPost(uint256 postId) external view returns (uint256[] memory) {
        return _commentsByPost[postId];
    }
}
