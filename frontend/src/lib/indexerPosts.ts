import type { Post } from '@/lib/feedModel';
import { cidToHttpUrl } from '@/lib/ipfsConfig';
import { parsePulseContentUri } from '@/lib/postsContract';

const POSTS_QUERY = `
  query IndexerPosts($limit: Int!, $viewer: String!) {
    Post(
      where: { deleted: { _eq: false } }
      order_by: { createdAtTimestamp: desc }
      limit: $limit
    ) {
      id
      author_id
      contentURI
      createdAtTimestamp
      likeCount
      commentCount
      likes(where: { active: { _eq: true }, user_id: { _eq: $viewer } }) {
        id
      }
    }
  }
`;

export type IndexerPostRow = {
  id: string;
  author_id: string;
  contentURI: string;
  createdAtTimestamp: string;
  likeCount: string;
  commentCount: string;
  likes: { id: string }[];
};

export type IndexerPostsResponse = {
  data?: { Post: IndexerPostRow[] };
  errors?: { message: string }[];
};

const VERCEL_HASURA_PROXY_PATH = '/api/hasura';

/** GraphQL HTTP endpoint (Hasura). Dev: Vite proxy `/hasura`. Prod (Vercel): `/api/hasura` serverless → EC2. */
export function getIndexerGraphqlUrl(): string {
  const env = (import.meta.env.VITE_HASURA_GRAPHQL_URL as string | undefined)?.trim();
  if (env) return env;
  if (import.meta.env.DEV) {
    return `${typeof window !== 'undefined' ? window.location.origin : ''}/hasura/v1/graphql`;
  }
  if (typeof window !== 'undefined') {
    return `${window.location.origin}${VERCEL_HASURA_PROXY_PATH}`;
  }
  return 'http://127.0.0.1:8080/v1/graphql';
}

/** Admin secret is added by Vercel `/api/hasura` — do not send from the browser. */
export function shouldSendHasuraAdminSecretFromClient(url: string): boolean {
  if (url.includes(VERCEL_HASURA_PROXY_PATH)) return false;
  return true;
}

function shortAddr(a: string): string {
  const x = a.startsWith('0x') ? a : `0x${a}`;
  if (x.length < 12) return x;
  return `${x.slice(0, 6)}…${x.slice(-4)}`;
}

export function mapIndexerRowToPost(row: IndexerPostRow, viewerAddress: string | null): Post {
  const author = row.author_id.toLowerCase();
  const { text, imageCount, ipfsCids } = parsePulseContentUri(row.contentURI);
  const tsSec = Number(row.createdAtTimestamp);
  const ms = Number.isFinite(tsSec) ? tsSec * 1000 : Date.now();

  const liked = viewerAddress ? row.likes?.length > 0 : false;

  const attachments =
    ipfsCids?.map((cid, i) => ({
      id: `ipfs-${row.id}-${i}`,
      url: cidToHttpUrl(cid),
      kind: 'image' as const,
    })) ?? undefined;

  const showCountOnly = imageCount > 0 && !attachments?.length;

  return {
    id: row.id,
    author: shortAddr(author),
    handle: `@${author.slice(0, 8)}`,
    avatar: author.slice(2, 4).toUpperCase() || '0X',
    content: text,
    attachments,
    onChainImageCount: showCountOnly ? imageCount : undefined,
    timestamp: new Date(ms),
    likes: Number(row.likeCount) || 0,
    reposts: 0,
    comments: Number(row.commentCount) || 0,
    views: 0,
    liked,
    reposted: false,
    isMine: !!(viewerAddress && viewerAddress.toLowerCase() === author),
    onChainPostId: row.id,
    authorAddress: author.startsWith('0x') ? author : `0x${author}`,
  };
}

export async function fetchIndexerPosts(limit: number, viewerAddress: string | null): Promise<IndexerPostRow[]> {
  const url = getIndexerGraphqlUrl();
  const viewer = (viewerAddress ?? '').toLowerCase();

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  const secret = (import.meta.env.VITE_HASURA_ADMIN_SECRET as string | undefined)?.trim();
  if (secret && shouldSendHasuraAdminSecretFromClient(url)) {
    headers['x-hasura-admin-secret'] = secret;
  }

  const res = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      query: POSTS_QUERY,
      variables: { limit, viewer },
    }),
  });

  const json = (await res.json()) as IndexerPostsResponse;
  if (!res.ok) {
    throw new Error(`Indexer HTTP ${res.status}`);
  }
  if (json.errors?.length) {
    throw new Error(json.errors.map(e => e.message).join('; '));
  }
  return json.data?.Post ?? [];
}
