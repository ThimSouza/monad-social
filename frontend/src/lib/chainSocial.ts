import { Contract, type BrowserProvider, type JsonRpcSigner, type ContractTransactionReceipt } from 'ethers';
import {
  INTERACTIONS_ABI,
  encodeLikeData,
  encodeUnlikeData,
  encodeCreateCommentData,
  buildCommentContentUri,
  parseCommentCreatedId,
} from '@/lib/interactionsContract';
import { SOCIAL_GRAPH_ABI } from '@/lib/socialGraphContract';

export async function readLikeSnapshot(
  provider: BrowserProvider,
  interactionsAddress: string,
  postId: bigint,
  userAddress: string
): Promise<{ hasLiked: boolean; likeCount: bigint }> {
  const c = new Contract(interactionsAddress, [...INTERACTIONS_ABI], provider);
  const [hasLiked, likeCount] = await Promise.all([
    c.hasLiked(postId, userAddress),
    c.likeCount(postId),
  ]);
  return { hasLiked: Boolean(hasLiked), likeCount: BigInt(likeCount.toString()) };
}

export async function readIsFollowing(
  provider: BrowserProvider,
  socialGraphAddress: string,
  follower: string,
  followee: string
): Promise<boolean> {
  const c = new Contract(socialGraphAddress, [...SOCIAL_GRAPH_ABI], provider);
  const v = await c.isFollowing(follower, followee);
  return Boolean(v);
}

export async function likeWithSigner(
  signer: JsonRpcSigner,
  interactionsAddress: string,
  postId: bigint
): Promise<{ hash: string; receipt: ContractTransactionReceipt }> {
  const c = new Contract(interactionsAddress, [...INTERACTIONS_ABI], signer);
  const tx = await c.like(postId);
  const receipt = await tx.wait();
  if (!receipt) throw new Error('Transaction confirmed without a receipt.');
  return { hash: receipt.hash, receipt };
}

export async function unlikeWithSigner(
  signer: JsonRpcSigner,
  interactionsAddress: string,
  postId: bigint
): Promise<{ hash: string; receipt: ContractTransactionReceipt }> {
  const c = new Contract(interactionsAddress, [...INTERACTIONS_ABI], signer);
  const tx = await c.unlike(postId);
  const receipt = await tx.wait();
  if (!receipt) throw new Error('Transaction confirmed without a receipt.');
  return { hash: receipt.hash, receipt };
}

export async function createCommentWithSigner(
  signer: JsonRpcSigner,
  interactionsAddress: string,
  postId: bigint,
  commentText: string
): Promise<{ hash: string; commentId: string | null; receipt: ContractTransactionReceipt }> {
  const uri = buildCommentContentUri(commentText);
  const c = new Contract(interactionsAddress, [...INTERACTIONS_ABI], signer);
  const tx = await c.createComment(postId, uri);
  const receipt = await tx.wait();
  if (!receipt) throw new Error('Transaction confirmed without a receipt.');
  const commentId = parseCommentCreatedId(receipt, interactionsAddress);
  return { hash: receipt.hash, commentId, receipt };
}

export async function followWithSigner(
  signer: JsonRpcSigner,
  socialGraphAddress: string,
  followee: string
): Promise<{ hash: string; receipt: ContractTransactionReceipt }> {
  const c = new Contract(socialGraphAddress, [...SOCIAL_GRAPH_ABI], signer);
  const tx = await c.follow(followee);
  const receipt = await tx.wait();
  if (!receipt) throw new Error('Transaction confirmed without a receipt.');
  return { hash: receipt.hash, receipt };
}

export async function unfollowWithSigner(
  signer: JsonRpcSigner,
  socialGraphAddress: string,
  followee: string
): Promise<{ hash: string; receipt: ContractTransactionReceipt }> {
  const c = new Contract(socialGraphAddress, [...SOCIAL_GRAPH_ABI], signer);
  const tx = await c.unfollow(followee);
  const receipt = await tx.wait();
  if (!receipt) throw new Error('Transaction confirmed without a receipt.');
  return { hash: receipt.hash, receipt };
}
