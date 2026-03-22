import { Interface, keccak256, toUtf8Bytes, type ContractTransactionReceipt } from 'ethers';

export const INTERACTIONS_ABI = [
  'function like(uint256 postId) external',
  'function unlike(uint256 postId) external',
  'function hasLiked(uint256 postId, address user) view returns (bool)',
  'function likeCount(uint256 postId) view returns (uint256)',
  'function createComment(uint256 postId, string contentURI) external returns (uint256)',
  'event CommentCreated(uint256 indexed commentId, uint256 indexed postId, address indexed author, string contentURI, uint64 createdAt)',
] as const;

const interactionsInterface = new Interface([...INTERACTIONS_ABI]);

export function getInteractionsContractAddress(): string | null {
  const a = import.meta.env.VITE_INTERACTIONS_CONTRACT_ADDRESS as string | undefined;
  if (!a || !/^0x[a-fA-F0-9]{40}$/.test(a)) return null;
  if (a.toLowerCase() === '0x0000000000000000000000000000000000000000') return null;
  return a;
}

export function encodeLikeData(postId: bigint): string {
  return interactionsInterface.encodeFunctionData('like', [postId]);
}

export function encodeUnlikeData(postId: bigint): string {
  return interactionsInterface.encodeFunctionData('unlike', [postId]);
}

export function encodeCreateCommentData(postId: bigint, contentURI: string): string {
  return interactionsInterface.encodeFunctionData('createComment', [postId, contentURI]);
}

/** Short JSON payload as URI (same idea as post content URIs). */
export function buildCommentContentUri(text: string): string {
  const trimmed = text.trim().slice(0, 500);
  const digest = keccak256(toUtf8Bytes(trimmed)).slice(0, 18);
  const payload = JSON.stringify({ v: 1, text: trimmed, digest });
  return `data:application/json;utf-8,${encodeURIComponent(payload)}`;
}

export function parseCommentCreatedId(
  receipt: ContractTransactionReceipt,
  interactionsContractAddress: string
): string | null {
  const target = interactionsContractAddress.toLowerCase();
  for (const log of receipt.logs) {
    if (!log.address || log.address.toLowerCase() !== target) continue;
    try {
      const parsed = interactionsInterface.parseLog({
        topics: log.topics as string[],
        data: log.data,
      });
      if (parsed?.name === 'CommentCreated') {
        return String(parsed.args.commentId);
      }
    } catch {
      /* skip */
    }
  }
  return null;
}
