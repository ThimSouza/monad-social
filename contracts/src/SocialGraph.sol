// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title  SocialGraph
/// @notice Follow/unfollow graph between users.
///         Each (follower, followee) pair is completely independent state —
///         a natural candidate for parallel execution on Monad.
contract SocialGraph {
    // -------------------------------------------------------------------------
    // State
    // -------------------------------------------------------------------------

    /// follower => followee => is following?
    mapping(address => mapping(address => bool)) public isFollowing;

    /// address => number of followers
    mapping(address => uint256) public followerCount;

    /// address => number of accounts being followed
    mapping(address => uint256) public followingCount;

    // -------------------------------------------------------------------------
    // Events
    // -------------------------------------------------------------------------

    event Followed(address indexed follower, address indexed followee);
    event Unfollowed(address indexed follower, address indexed followee);

    // -------------------------------------------------------------------------
    // Errors
    // -------------------------------------------------------------------------

    error CannotFollowSelf();
    error AlreadyFollowing();
    error NotFollowing();

    // -------------------------------------------------------------------------
    // Write
    // -------------------------------------------------------------------------

    function follow(address followee) external {
        if (followee == msg.sender)            revert CannotFollowSelf();
        if (isFollowing[msg.sender][followee]) revert AlreadyFollowing();

        isFollowing[msg.sender][followee] = true;
        followerCount[followee]++;
        followingCount[msg.sender]++;

        emit Followed(msg.sender, followee);
    }

    function unfollow(address followee) external {
        if (!isFollowing[msg.sender][followee]) revert NotFollowing();

        isFollowing[msg.sender][followee] = false;
        followerCount[followee]--;
        followingCount[msg.sender]--;

        emit Unfollowed(msg.sender, followee);
    }

    // -------------------------------------------------------------------------
    // Read
    // -------------------------------------------------------------------------

    /// @return followers  Number of followers `user` has
    /// @return following  Number of accounts `user` is following
    function getStats(address user)
        external
        view
        returns (uint256 followers, uint256 following)
    {
        return (followerCount[user], followingCount[user]);
    }
}
