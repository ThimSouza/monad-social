// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/// @title  Posts
/// @notice Stores post references on-chain.
///         Content lives on IPFS; only the URI is stored here.
///         Each post belongs to an independent author → natural parallel execution.
contract Posts {
    // -------------------------------------------------------------------------
    // Types
    // -------------------------------------------------------------------------

    struct Post {
        address author;
        string  contentURI;  // ipfs://Qm...
        uint64  createdAt;
        bool    deleted;
    }

    // -------------------------------------------------------------------------
    // State
    // -------------------------------------------------------------------------

    uint256 public totalPosts;

    /// postId => Post
    mapping(uint256 => Post) public posts;

    /// author => list of postIds
    mapping(address => uint256[]) private _postsByAuthor;

    // -------------------------------------------------------------------------
    // Events
    // -------------------------------------------------------------------------

    event PostCreated(
        uint256 indexed postId,
        address indexed author,
        string  contentURI,
        uint64  createdAt
    );

    event PostDeleted(uint256 indexed postId, address indexed author);

    // -------------------------------------------------------------------------
    // Errors
    // -------------------------------------------------------------------------

    error NotAuthor();
    error PostDoesNotExist();
    error AlreadyDeleted();
    error EmptyContentURI();

    // -------------------------------------------------------------------------
    // Write
    // -------------------------------------------------------------------------

    /// @notice Creates a post pointing to content stored on IPFS.
    /// @param  contentURI  Content URI (e.g. ipfs://QmXyz...)
    /// @return postId      Sequential ID of the created post
    function createPost(string calldata contentURI) external returns (uint256 postId) {
        if (bytes(contentURI).length == 0) revert EmptyContentURI();

        postId = ++totalPosts;

        posts[postId] = Post({
            author:     msg.sender,
            contentURI: contentURI,
            createdAt:  uint64(block.timestamp),
            deleted:    false
        });

        _postsByAuthor[msg.sender].push(postId);

        emit PostCreated(postId, msg.sender, contentURI, uint64(block.timestamp));
    }

    /// @notice Soft-deletes a post. Only the author can delete it.
    function deletePost(uint256 postId) external {
        Post storage post = posts[postId];
        if (post.author == address(0)) revert PostDoesNotExist();
        if (post.author != msg.sender)  revert NotAuthor();
        if (post.deleted)               revert AlreadyDeleted();

        post.deleted = true;

        emit PostDeleted(postId, msg.sender);
    }

    // -------------------------------------------------------------------------
    // Read
    // -------------------------------------------------------------------------

    function getPost(uint256 postId) external view returns (Post memory) {
        return posts[postId];
    }

    function postsByAuthor(address author) external view returns (uint256[] memory) {
        return _postsByAuthor[author];
    }

    function postCountByAuthor(address author) external view returns (uint256) {
        return _postsByAuthor[author].length;
    }
}
