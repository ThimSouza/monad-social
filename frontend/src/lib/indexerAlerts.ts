import { getIndexerGraphqlUrl, shouldSendHasuraAdminSecretFromClient } from '@/lib/indexerPosts';

const LIKES_ON_MY_POSTS = `
  query AlertsLikes($me: String!) {
    Like(
      where: {
        active: { _eq: true }
        user_id: { _neq: $me }
        post: { author_id: { _eq: $me }, deleted: { _eq: false } }
      }
      order_by: { updatedAtBlock: desc }
      limit: 80
    ) {
      id
      user_id
      post_id
      updatedAtBlock
    }
  }
`;

const COMMENTS_ON_MY_POSTS = `
  query AlertsComments($me: String!) {
    Comment(
      where: {
        deleted: { _eq: false }
        author_id: { _neq: $me }
        post: { author_id: { _eq: $me }, deleted: { _eq: false } }
      }
      order_by: { createdAtTimestamp: desc }
      limit: 80
    ) {
      id
      post_id
      author_id
      contentURI
      createdAtTimestamp
    }
  }
`;

export type AlertKind = 'like' | 'comment';

export type IndexerAlertItem = {
  id: string;
  kind: AlertKind;
  title: string;
  body: string;
  /** Sort key: unix seconds for comments; block height for likes */
  sortKey: number;
};

type GqlResp<T> = { data?: T; errors?: { message: string }[] };

function shortAddr(a: string): string {
  const x = a.startsWith('0x') ? a : `0x${a}`;
  if (x.length < 12) return x;
  return `${x.slice(0, 6)}…${x.slice(-4)}`;
}

function timeAgoFromUnix(sec: number): string {
  const now = Math.floor(Date.now() / 1000);
  const s = Math.max(0, now - sec);
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  return `${Math.floor(s / 86400)}d`;
}

function parseCommentSnippet(uri: string): string {
  try {
    if (uri.startsWith('data:application/json')) {
      const comma = uri.indexOf(',');
      if (comma === -1) return '';
      const raw = decodeURIComponent(uri.slice(comma + 1));
      const j = JSON.parse(raw) as { text?: string };
      if (typeof j.text === 'string' && j.text.trim()) {
        const t = j.text.trim();
        return t.length > 120 ? `${t.slice(0, 117)}…` : t;
      }
    }
  } catch {
    /* ignore */
  }
  return uri.length > 80 ? `${uri.slice(0, 77)}…` : uri;
}

async function gqlFetch<T>(query: string, variables: Record<string, string>): Promise<T> {
  const url = getIndexerGraphqlUrl();
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  const secret = (import.meta.env.VITE_HASURA_ADMIN_SECRET as string | undefined)?.trim();
  if (secret && shouldSendHasuraAdminSecretFromClient(url)) {
    headers['x-hasura-admin-secret'] = secret;
  }

  const res = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify({ query, variables }),
  });
  const json = (await res.json()) as GqlResp<T>;
  if (!res.ok) throw new Error(`Indexer HTTP ${res.status}`);
  if (json.errors?.length) throw new Error(json.errors.map(e => e.message).join('; '));
  if (!json.data) throw new Error('Empty indexer response');
  return json.data;
}

/**
 * Notifications for the connected wallet: likes and comments on **your** posts only
 * (post `author_id` === connected address).
 */
export async function fetchAlertsForPostOwner(walletAddress: string): Promise<IndexerAlertItem[]> {
  const me = walletAddress.toLowerCase();

  const [likesData, commentsData] = await Promise.all([
    gqlFetch<{ Like: { id: string; user_id: string; post_id: string; updatedAtBlock: string }[] }>(
      LIKES_ON_MY_POSTS,
      { me }
    ),
    gqlFetch<{
      Comment: {
        id: string;
        post_id: string;
        author_id: string;
        contentURI: string;
        createdAtTimestamp: string;
      }[];
    }>(COMMENTS_ON_MY_POSTS, { me }),
  ]);

  const likes: IndexerAlertItem[] = (likesData.Like ?? []).map(row => ({
    id: `like-${row.id}`,
    kind: 'like' as const,
    title: `${shortAddr(row.user_id)} liked your pulse`,
    body: `Post #${row.post_id} · block ${row.updatedAtBlock}`,
    sortKey: Number(row.updatedAtBlock) || 0,
  }));

  const comments: IndexerAlertItem[] = (commentsData.Comment ?? []).map(row => {
    const ts = Number(row.createdAtTimestamp);
    const when = Number.isFinite(ts) ? timeAgoFromUnix(ts) : '—';
    const snippet = parseCommentSnippet(row.contentURI);
    return {
      id: `comment-${row.id}`,
      kind: 'comment' as const,
      title: `${shortAddr(row.author_id)} commented on your pulse`,
      body: snippet ? `Post #${row.post_id} · “${snippet}” · ${when}` : `Post #${row.post_id} · ${when}`,
      sortKey: Number.isFinite(ts) ? ts : 0,
    };
  });

  likes.sort((a, b) => b.sortKey - a.sortKey);
  comments.sort((a, b) => b.sortKey - a.sortKey);
  // Comments have real timestamps; likes only have block height — keep groups separate for sane ordering.
  return [...comments, ...likes];
}
