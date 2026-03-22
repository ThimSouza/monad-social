import { Interface, keccak256, toUtf8Bytes, type ContractTransactionReceipt } from 'ethers';

/** Minimal ABI for `Posts.createPost` + `PostCreated` parsing. */
export const POSTS_ABI = [
  'function createPost(string contentURI) external returns (uint256 postId)',
  'event PostCreated(uint256 indexed postId, address indexed author, string contentURI, uint64 createdAt)',
] as const;

const postsInterface = new Interface([...POSTS_ABI]);

const MAX_JSON_URI_CHARS = 6000;

export type ParsedPulseUri = {
  text: string;
  imageCount: number;
  /** IPFS CIDs (v2 JSON); load via `cidToHttpUrl` / gateway. */
  ipfsCids?: string[];
};

/**
 * Builds a `contentURI` stored on-chain: JSON (text + image count + optional IPFS CIDs for each photo).
 */
export function buildPulseContentUri(text: string, imageCount: number, ipfsCids?: string[]): string {
  const trimmed = text.trim().slice(0, 2500);
  const cids = ipfsCids?.length ? ipfsCids.filter(Boolean) : undefined;
  const count = cids?.length ?? imageCount;
  const digest = keccak256(
    toUtf8Bytes(JSON.stringify({ t: trimmed, i: count, ipfs: cids ?? [] }))
  ).slice(0, 18);

  const payload = JSON.stringify({
    v: 2,
    text: trimmed,
    images: count,
    digest,
    ...(cids?.length ? { ipfs: cids } : {}),
  });
  const dataUri = `data:application/json;utf-8,${encodeURIComponent(payload)}`;
  if (dataUri.length <= MAX_JSON_URI_CHARS) return dataUri;
  return `pulse:v1:${digest}:${count}:${keccak256(toUtf8Bytes(trimmed)).slice(2, 18)}`;
}

/** Decode `contentURI` from `Posts` / indexer (JSON data URI, compact pulse URI, or raw IPFS/http). */
export function parsePulseContentUri(uri: string): ParsedPulseUri {
  const fallback: ParsedPulseUri = { text: uri ? uri.slice(0, 600) : '(empty)', imageCount: 0 };
  if (!uri?.trim()) return { text: '(empty)', imageCount: 0 };
  try {
    if (uri.startsWith('data:application/json')) {
      const comma = uri.indexOf(',');
      if (comma === -1) return fallback;
      const raw = decodeURIComponent(uri.slice(comma + 1));
      const j = JSON.parse(raw) as { text?: string; images?: number; ipfs?: unknown };
      const ipfsCids = Array.isArray(j.ipfs)
        ? j.ipfs.filter((x): x is string => typeof x === 'string' && x.length > 0)
        : undefined;
      return {
        text: typeof j.text === 'string' ? j.text : '',
        imageCount: Number.isFinite(Number(j.images)) ? Number(j.images) : 0,
        ...(ipfsCids?.length ? { ipfsCids } : {}),
      };
    }
    if (uri.startsWith('pulse:v1:')) {
      const parts = uri.split(':');
      const imageCount = Number(parts[3]) || 0;
      return {
        text: '(Post body stored as hash only — older or oversized JSON URI.)',
        imageCount,
      };
    }
    if (uri.startsWith('ipfs://') || uri.startsWith('http://') || uri.startsWith('https://')) {
      return { text: uri, imageCount: 0 };
    }
  } catch {
    /* fall through */
  }
  return fallback;
}

export function encodeCreatePostData(contentURI: string): string {
  return postsInterface.encodeFunctionData('createPost', [contentURI]);
}

export function getPostsContractAddress(): string | null {
  const a = import.meta.env.VITE_POSTS_CONTRACT_ADDRESS as string | undefined;
  if (!a || !/^0x[a-fA-F0-9]{40}$/.test(a)) return null;
  if (a.toLowerCase() === '0x0000000000000000000000000000000000000000') return null;
  return a;
}

export function parsePostCreatedPostId(
  receipt: ContractTransactionReceipt,
  postsContractAddress: string
): string | null {
  const target = postsContractAddress.toLowerCase();
  for (const log of receipt.logs) {
    if (!log.address || log.address.toLowerCase() !== target) continue;
    try {
      const parsed = postsInterface.parseLog({
        topics: log.topics as string[],
        data: log.data,
      });
      if (parsed?.name === 'PostCreated') {
        return String(parsed.args.postId);
      }
    } catch {
      /* not this log */
    }
  }
  return null;
}
