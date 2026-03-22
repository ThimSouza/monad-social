import React, { createContext, useContext, useState, useCallback } from 'react';
import { getPostAuthorFromProfile } from '@/lib/profileStorage';

/** In-memory attachment (data URL). For production, swap for CDN/IPFS URLs. */
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
  timestamp: Date;
  likes: number;
  reposts: number;
  comments: number;
  views: number;
  liked: boolean;
  reposted: boolean;
  /** Pulses created via the composer (Profile “Pulses” tab). */
  isMine?: boolean;
}

interface FeedContextType {
  posts: Post[];
  addPost: (content: string, attachments?: PostAttachment[]) => void;
  toggleLike: (id: string) => void;
  toggleRepost: (id: string) => void;
}

const MOCK_POSTS: Post[] = [
  {
    id: '1',
    author: 'Kenji Nakamura',
    handle: '@kenji_monad',
    avatar: 'KN',
    content: 'Just deployed my first smart contract on Monad. 10,000 TPS is no joke — confirmation in under a second. The future of DeFi is parallel. ⚡',
    timestamp: new Date(Date.now() - 120000),
    likes: 847,
    reposts: 203,
    comments: 56,
    views: 12400,
    liked: false,
    reposted: false,
  },
  {
    id: '2',
    author: 'Lena Petrova',
    handle: '@lena_web3',
    avatar: 'LP',
    content: 'Parallel execution changes everything. Ran a stress test with 50 concurrent transactions — all confirmed in the same block. Ethereum could never 🔥',
    timestamp: new Date(Date.now() - 300000),
    likes: 1243,
    reposts: 412,
    comments: 89,
    views: 28700,
    liked: true,
    reposted: false,
  },
  {
    id: '3',
    author: 'Marcus Chen',
    handle: '@marcusc_dev',
    avatar: 'MC',
    content: 'Gas fees on Monad: 0.001 MON. Gas fees on Ethereum: my entire portfolio. Choose wisely. 💎',
    timestamp: new Date(Date.now() - 600000),
    likes: 2156,
    reposts: 678,
    comments: 134,
    views: 45200,
    liked: false,
    reposted: true,
  },
  {
    id: '4',
    author: 'Aisha Rahman',
    handle: '@aisha_builds',
    avatar: 'AR',
    content: 'Built a real-time social feed where every like is an on-chain transaction. On Monad it actually works without lag. This is what mass adoption looks like.',
    timestamp: new Date(Date.now() - 900000),
    likes: 567,
    reposts: 145,
    comments: 32,
    views: 8900,
    liked: false,
    reposted: false,
  },
];

const FeedContext = createContext<FeedContextType>({
  posts: [],
  addPost: () => {},
  toggleLike: () => {},
  toggleRepost: () => {},
});

/** Max still images per pulse (JPEG / PNG / WebP). */
export const MAX_PHOTOS_PER_POST = 4;

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
  const [posts, setPosts] = useState<Post[]>(MOCK_POSTS);

  const addPost = useCallback((content: string, attachments?: PostAttachment[]) => {
    const trimmed = content.trim();
    const list = attachments?.length
      ? attachments.filter(a => a.kind === 'image').slice(0, MAX_PHOTOS_PER_POST)
      : undefined;
    if (!trimmed && !list?.length) return;

    const who = getPostAuthorFromProfile();
    const newPost: Post = {
      id: Date.now().toString(),
      author: who.author,
      handle: who.handle,
      avatar: who.avatar,
      content: trimmed,
      attachments: list,
      timestamp: new Date(),
      likes: 0,
      reposts: 0,
      comments: 0,
      views: 0,
      liked: false,
      reposted: false,
      isMine: true,
    };
    setPosts(prev => [newPost, ...prev]);
  }, []);

  const toggleLike = useCallback((id: string) => {
    setPosts(prev =>
      prev.map(p =>
        p.id === id
          ? { ...p, liked: !p.liked, likes: p.liked ? p.likes - 1 : p.likes + 1 }
          : p
      )
    );
  }, []);

  const toggleRepost = useCallback((id: string) => {
    setPosts(prev =>
      prev.map(p =>
        p.id === id
          ? { ...p, reposted: !p.reposted, reposts: p.reposted ? p.reposts - 1 : p.reposts + 1 }
          : p
      )
    );
  }, []);

  return (
    <FeedContext.Provider value={{ posts, addPost, toggleLike, toggleRepost }}>
      {children}
    </FeedContext.Provider>
  );
};
