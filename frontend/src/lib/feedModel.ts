/** In-memory attachment (data URL) when composing; on-chain posts may only store image count. */
export interface PostAttachment {
  id: string;
  url: string;
  kind: 'image';
}

export interface Post {
  id: string;
  author: string;
  handle: string;
  avatar: string;
  content: string;
  attachments?: PostAttachment[];
  /** From JSON `contentURI` when text is inline but images are count-only on-chain. */
  onChainImageCount?: number;
  timestamp: Date;
  likes: number;
  reposts: number;
  comments: number;
  views: number;
  liked: boolean;
  reposted: boolean;
  /** Pulses published by the connected wallet (matches indexer `author_id`). */
  isMine?: boolean;
  txHash?: string;
  /** Same as `id` for indexer-backed posts. */
  onChainPostId?: string;
  authorAddress?: string;
}

export const MAX_PHOTOS_PER_POST = 4;
