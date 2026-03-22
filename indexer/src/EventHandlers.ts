/// <reference path="./envio-generated.d.ts" />
import { Posts, SocialGraph, Interactions } from "generated";

const addr = (a: string) => a.toLowerCase();

Posts.PostCreated.handler(async ({ event, context }) => {
  const author = addr(event.params.author);
  const postId = event.params.postId.toString();
  const block = BigInt(event.block.number);
  const ts = BigInt(event.params.createdAt);

  const acc =
    (await context.Account.get(author)) ??
    ({
      id: author,
      postCount: 0n,
      followerCount: 0n,
      followingCount: 0n,
    } as const);

  context.Account.set({
    ...acc,
    id: author,
    postCount: acc.postCount + 1n,
  });

  context.Post.set({
    id: postId,
    author: author,
    contentURI: event.params.contentURI,
    createdAtBlock: block,
    createdAtTimestamp: ts,
    updatedAtTimestamp: ts,
    deleted: false,
    likeCount: 0n,
    commentCount: 0n,
  });
});

Posts.PostDeleted.handler(async ({ event, context }) => {
  const postId = event.params.postId.toString();
  const post = await context.Post.get(postId);
  if (!post || post.deleted) return;

  const ts = BigInt(event.block.timestamp);

  context.Post.set({
    ...post,
    deleted: true,
    updatedAtTimestamp: ts,
  });
});

SocialGraph.Followed.handler(async ({ event, context }) => {
  const follower = addr(event.params.follower);
  const followee = addr(event.params.followee);
  const id = `${follower}-${followee}`;
  const block = BigInt(event.block.number);

  const existingEdge = await context.Follow.get(id);
  if (existingEdge?.active) return;

  for (const a of [follower, followee]) {
    const acc =
      (await context.Account.get(a)) ??
      ({
        id: a,
        postCount: 0n,
        followerCount: 0n,
        followingCount: 0n,
      } as const);
    context.Account.set({ ...acc, id: a });
  }

  const followerAcc = await context.Account.get(follower);
  const followeeAcc = await context.Account.get(followee);
  if (followerAcc && followeeAcc) {
    context.Account.set({
      ...followerAcc,
      followingCount: followerAcc.followingCount + 1n,
    });
    context.Account.set({
      ...followeeAcc,
      followerCount: followeeAcc.followerCount + 1n,
    });
  }

  context.Follow.set({
    id,
    follower: follower,
    following: followee,
    active: true,
    updatedAtBlock: block,
  });
});

SocialGraph.Unfollowed.handler(async ({ event, context }) => {
  const follower = addr(event.params.follower);
  const followee = addr(event.params.followee);
  const id = `${follower}-${followee}`;
  const block = BigInt(event.block.number);

  const edge = await context.Follow.get(id);
  if (!edge?.active) return;

  const followerAcc = await context.Account.get(follower);
  const followeeAcc = await context.Account.get(followee);
  if (followerAcc && followeeAcc) {
    context.Account.set({
      ...followerAcc,
      followingCount:
        followerAcc.followingCount > 0n
          ? followerAcc.followingCount - 1n
          : 0n,
    });
    context.Account.set({
      ...followeeAcc,
      followerCount:
        followeeAcc.followerCount > 0n ? followeeAcc.followerCount - 1n : 0n,
    });
  }

  context.Follow.set({
    ...edge,
    active: false,
    updatedAtBlock: block,
  });
});

Interactions.Liked.handler(async ({ event, context }) => {
  const user = addr(event.params.user);
  const postId = event.params.postId.toString();
  const id = `${user}-${postId}`;
  const block = BigInt(event.block.number);

  const acc =
    (await context.Account.get(user)) ??
    ({
      id: user,
      postCount: 0n,
      followerCount: 0n,
      followingCount: 0n,
    } as const);
  context.Account.set({ ...acc, id: user });

  const post = await context.Post.get(postId);
  if (!post) return;

  const prev = await context.Like.get(id);
  const wasActive = prev?.active ?? false;

  context.Like.set({
    id,
    user: user,
    post: postId,
    active: true,
    updatedAtBlock: block,
  });

  if (!wasActive) {
    context.Post.set({
      ...post,
      likeCount: post.likeCount + 1n,
    });
  }
});

Interactions.Unliked.handler(async ({ event, context }) => {
  const user = addr(event.params.user);
  const postId = event.params.postId.toString();
  const id = `${user}-${postId}`;
  const block = BigInt(event.block.number);

  const prev = await context.Like.get(id);
  if (!prev?.active) return;

  const post = await context.Post.get(postId);
  if (!post) return;

  context.Like.set({
    ...prev,
    active: false,
    updatedAtBlock: block,
  });

  context.Post.set({
    ...post,
    likeCount: post.likeCount > 0n ? post.likeCount - 1n : 0n,
  });
});

Interactions.CommentCreated.handler(async ({ event, context }) => {
  const author = addr(event.params.author);
  const postId = event.params.postId.toString();
  const commentId = event.params.commentId.toString();
  const block = BigInt(event.block.number);
  const ts = BigInt(event.params.createdAt);

  const acc =
    (await context.Account.get(author)) ??
    ({
      id: author,
      postCount: 0n,
      followerCount: 0n,
      followingCount: 0n,
    } as const);
  context.Account.set({ ...acc, id: author });

  const post = await context.Post.get(postId);
  if (!post) return;

  context.Comment.set({
    id: commentId,
    post: postId,
    author: author,
    contentURI: event.params.contentURI,
    createdAtBlock: block,
    createdAtTimestamp: ts,
    deleted: false,
    updatedAtBlock: block,
  });

  context.Post.set({
    ...post,
    commentCount: post.commentCount + 1n,
  });
});

Interactions.CommentDeleted.handler(async ({ event, context }) => {
  const commentId = event.params.commentId.toString();
  const block = BigInt(event.block.number);

  const comment = await context.Comment.get(commentId);
  if (!comment || comment.deleted) return;

  const postId =
    typeof comment.post === "string"
      ? comment.post
      : (comment as { post_id: string }).post_id;
  const post = await context.Post.get(postId);
  if (!post) return;

  context.Comment.set({
    ...comment,
    deleted: true,
    updatedAtBlock: block,
  });

  context.Post.set({
    ...post,
    commentCount: post.commentCount > 0n ? post.commentCount - 1n : 0n,
  });
});
