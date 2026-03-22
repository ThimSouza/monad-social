import React, { createContext, useContext, useState, useCallback, useMemo, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useWallet } from '@/contexts/WalletContext';
import { fetchIndexerPosts, mapIndexerRowToPost } from '@/lib/indexerPosts';
import type { Post, PostAttachment } from '@/lib/feedModel';
import { MAX_PHOTOS_PER_POST } from '@/lib/feedModel';

export type { Post, PostAttachment };
export { MAX_PHOTOS_PER_POST };

const INDEXER_POST_LIMIT = 200;
const INDEXER_QUERY_KEY = ['indexerPosts'] as const;

interface FeedContextType {
  posts: Post[];
  postsLoading: boolean;
  postsError: string | null;
  /** Refetch from Hasura / Envio indexer (e.g. after a successful on-chain tx). */
  refetchPosts: () => Promise<unknown>;
  /** Merge fields into a post by id (e.g. after like tx or client-only repost toggle). */
  patchPost: (id: string, patch: Partial<Pick<Post, 'liked' | 'likes' | 'comments' | 'reposts' | 'reposted'>>) => void;
  toggleLike: (id: string) => void;
  toggleRepost: (id: string) => void;
}

const FeedContext = createContext<FeedContextType>({
  posts: [],
  postsLoading: true,
  postsError: null,
  refetchPosts: async () => {},
  patchPost: () => {},
  toggleLike: () => {},
  toggleRepost: () => {},
});

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

function fileExtension(file: File): string {
  const m = file.name.match(/\.([a-zA-Z0-9]+)$/);
  return m ? m[1].toLowerCase() : '';
}

/** MIME often empty on Windows / some mobile pickers — use extension fallback. */
function isPhotoFile(file: File): { ok: true } | { ok: false; reason: 'gif' | 'heic' | 'unknown' } {
  const t = (file.type || '').toLowerCase().trim();
  const ext = fileExtension(file);

  if (t === 'image/gif' || ext === 'gif') return { ok: false, reason: 'gif' };

  if (
    t.includes('heic') ||
    t.includes('heif') ||
    ext === 'heic' ||
    ext === 'heif'
  ) {
    return { ok: false, reason: 'heic' };
  }

  const mimePhoto =
    t === 'image/jpeg' ||
    t === 'image/jpg' ||
    t === 'image/pjpeg' ||
    t === 'image/png' ||
    t === 'image/x-png' ||
    t === 'image/webp';

  const extPhoto = ext === 'jpg' || ext === 'jpeg' || ext === 'png' || ext === 'webp';

  const octetUnknown = t === '' || t === 'application/octet-stream';

  if (mimePhoto || (octetUnknown && extPhoto) || (t.startsWith('image/') && extPhoto)) {
    return { ok: true };
  }

  if (octetUnknown && !ext) return { ok: false, reason: 'unknown' };

  return { ok: false, reason: 'unknown' };
}

function readFileAsDataUrl(file: File): Promise<PostAttachment> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const url = reader.result as string;
      resolve({
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
        url,
        kind: 'image',
      });
    };
    reader.onerror = () => reject(new Error('Could not read the file.'));
    reader.readAsDataURL(file);
  });
}

/** Photo area only — JPEG, PNG, WebP (no GIF). */
export function readPhotoAttachment(file: File): Promise<PostAttachment> {
  return new Promise((resolve, reject) => {
    const check = isPhotoFile(file);
    if (!check.ok) {
      if (check.reason === 'gif') {
        reject(new Error('GIF files are not supported. Use JPEG, PNG, or WebP.'));
        return;
      }
      if (check.reason === 'heic') {
        reject(new Error('HEIC/HEIF is not supported. Export as JPEG or PNG, then upload.'));
        return;
      }
      reject(new Error('Photos must be JPEG, PNG, or WebP.'));
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      reject(new Error('Each photo must be 5 MB or smaller.'));
      return;
    }
    readFileAsDataUrl(file).then(resolve).catch(reject);
  });
}

export const useFeed = () => useContext(FeedContext);

export const FeedProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { address } = useWallet();
  const queryClient = useQueryClient();
  const [patches, setPatches] = useState<Record<string, Partial<Post>>>({});

  const {
    data: rows = [],
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: [...INDEXER_QUERY_KEY, address ?? ''],
    queryFn: () => fetchIndexerPosts(INDEXER_POST_LIMIT, address),
    refetchInterval: 20_000,
    staleTime: 8_000,
  });

  const basePosts = useMemo(
    () => rows.map(r => mapIndexerRowToPost(r, address)),
    [rows, address]
  );

  const baseRef = useRef(basePosts);
  baseRef.current = basePosts;

  const posts = useMemo(
    () => basePosts.map(p => ({ ...p, ...patches[p.id] })),
    [basePosts, patches]
  );

  const postsError = isError
    ? error instanceof Error
      ? error.message
      : String(error)
    : null;

  const patchPost = useCallback((id: string, patch: Partial<Pick<Post, 'liked' | 'likes' | 'comments' | 'reposts' | 'reposted'>>) => {
    setPatches(prev => ({
      ...prev,
      [id]: { ...prev[id], ...patch },
    }));
  }, []);

  const toggleLike = useCallback((id: string) => {
    setPatches(prev => {
      const base = baseRef.current.find(p => p.id === id);
      if (!base) return prev;
      const cur = { ...base, ...prev[id] };
      const liked = !cur.liked;
      return {
        ...prev,
        [id]: {
          ...prev[id],
          liked,
          likes: liked ? cur.likes + 1 : Math.max(0, cur.likes - 1),
        },
      };
    });
  }, []);

  const toggleRepost = useCallback((id: string) => {
    setPatches(prev => {
      const base = baseRef.current.find(p => p.id === id);
      if (!base) return prev;
      const cur = { ...base, ...prev[id] };
      const reposted = !cur.reposted;
      return {
        ...prev,
        [id]: {
          ...prev[id],
          reposted,
          reposts: reposted ? cur.reposts + 1 : Math.max(0, cur.reposts - 1),
        },
      };
    });
  }, []);

  const refetchPosts = useCallback(
    () => queryClient.invalidateQueries({ queryKey: [...INDEXER_QUERY_KEY] }),
    [queryClient]
  );

  return (
    <FeedContext.Provider
      value={{
        posts,
        postsLoading: isLoading,
        postsError,
        refetchPosts,
        patchPost,
        toggleLike,
        toggleRepost,
      }}
    >
      {children}
    </FeedContext.Provider>
  );
};
