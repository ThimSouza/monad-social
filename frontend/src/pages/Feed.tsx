import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { getAddress } from 'ethers';
import { MessageCircle, Repeat2, Heart, Eye, Plus, Wallet, Loader2, ImagePlus, X, Image, UserPlus, UserMinus } from 'lucide-react';
import {
  useFeed,
  readPhotoAttachment,
  MAX_PHOTOS_PER_POST,
  type PostAttachment,
} from '@/contexts/FeedContext';
import { useWallet } from '@/contexts/WalletContext';
import BottomNav from '@/components/BottomNav';
import { toast } from 'sonner';
import { getPostsContractAddress } from '@/lib/postsContract';
import { createPostWithSigner } from '@/lib/chainPulsePublish';
import { isIpfsUploadConfigured } from '@/lib/ipfsConfig';
import { dataUrlToBlob, extensionFromDataUrl, uploadBlobToIpfs } from '@/lib/ipfsUpload';
import { getInteractionsContractAddress } from '@/lib/interactionsContract';
import { getSocialGraphContractAddress } from '@/lib/socialGraphContract';
import {
  readLikeSnapshot,
  likeWithSigner,
  unlikeWithSigner,
  createCommentWithSigner,
  readIsFollowing,
  followWithSigner,
  unfollowWithSigner,
} from '@/lib/chainSocial';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';

function timeAgo(date: Date) {
  const s = Math.floor((Date.now() - date.getTime()) / 1000);
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  return `${Math.floor(s / 3600)}h`;
}

function formatCount(n: number) {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return n.toString();
}

/** Concentric rings — shockwave / ripple style (not ECG). */
function ShockwavesMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden
    >
      <circle cx="12" cy="12" r="1.6" fill="currentColor" />
      <circle cx="12" cy="12" r="5" stroke="currentColor" strokeWidth="1.75" opacity={0.95} />
      <circle cx="12" cy="12" r="8.25" stroke="currentColor" strokeWidth="1.6" opacity={0.72} />
      <circle cx="12" cy="12" r="11" stroke="currentColor" strokeWidth="1.4" opacity={0.48} />
    </svg>
  );
}

const Feed = () => {
  const { posts, postsLoading, postsError, refetchPosts, patchPost, toggleLike, toggleRepost } = useFeed();
  const {
    shortAddress,
    address,
    isConnected,
    connect,
    provider,
    isMonadTestnet,
    signer,
    switchToMonadTestnet,
    connectionError,
    clearConnectionError,
  } = useWallet();
  const [composerOpen, setComposerOpen] = useState(false);
  const [text, setText] = useState('');
  const [composerMedia, setComposerMedia] = useState<PostAttachment[]>([]);
  const [publishing, setPublishing] = useState(false);
  const [likeBusyId, setLikeBusyId] = useState<string | null>(null);
  const [commentPostId, setCommentPostId] = useState<string | null>(null);
  const [commentDraft, setCommentDraft] = useState('');
  const [commentSubmitting, setCommentSubmitting] = useState(false);
  const [followBusy, setFollowBusy] = useState<string | null>(null);
  const [followByAuthor, setFollowByAuthor] = useState<Record<string, boolean>>({});
  const photoInputRef = useRef<HTMLInputElement>(null);
  const postsRef = useRef(posts);
  postsRef.current = posts;

  const interactionsAddr = getInteractionsContractAddress();
  const socialGraphAddr = getSocialGraphContractAddress();

  const chainPostSyncKey = useMemo(
    () =>
      posts
        .map(p => `${p.id}|${p.onChainPostId ?? ''}`)
        .sort()
        .join(';'),
    [posts]
  );

  const authorSyncKey = useMemo(
    () =>
      [...new Set(posts.map(p => p.authorAddress?.toLowerCase()).filter(Boolean) as string[])].sort().join('|'),
    [posts]
  );
  useEffect(() => {
    if (!connectionError) return;
    toast.error('Could not connect wallet', { description: connectionError, duration: 6000 });
    clearConnectionError();
  }, [connectionError, clearConnectionError]);

  /** Refresh like counts / hasLiked for posts that have an on-chain id. */
  useEffect(() => {
    if (!provider || !interactionsAddr || !address) return;
    let cancelled = false;
    void (async () => {
      for (const p of postsRef.current) {
        if (!p.onChainPostId || cancelled) continue;
        try {
          const pid = BigInt(p.onChainPostId);
          const snap = await readLikeSnapshot(provider, interactionsAddr, pid, address);
          if (cancelled) return;
          patchPost(p.id, { liked: snap.hasLiked, likes: Number(snap.likeCount) });
        } catch {
          /* ignore per post */
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [provider, interactionsAddr, address, chainPostSyncKey, patchPost]);

  /** Load follow edges for visible author addresses. */
  useEffect(() => {
    if (!provider || !socialGraphAddr || !address) return;
    const me = address.toLowerCase();
    const authors = [
      ...new Set(
        postsRef.current
          .map(p => p.authorAddress?.toLowerCase())
          .filter((a): a is string => !!a && a !== me)
      ),
    ];
    if (!authors.length) return;
    let cancelled = false;
    void (async () => {
      const next: Record<string, boolean> = {};
      for (const a of authors) {
        try {
          next[a] = await readIsFollowing(provider, socialGraphAddr, address, a);
        } catch {
          next[a] = false;
        }
        if (cancelled) return;
      }
      if (!cancelled) setFollowByAuthor(prev => ({ ...prev, ...next }));
    })();
    return () => {
      cancelled = true;
    };
  }, [provider, socialGraphAddr, address, authorSyncKey]);

  const ensureMonad = useCallback(async () => {
    if (isMonadTestnet) return;
    await switchToMonadTestnet();
  }, [isMonadTestnet, switchToMonadTestnet]);

  const photoCount = composerMedia.length;

  const onPhotosSelected = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const input = e.target;
    const picked = input.files?.length ? Array.from(input.files) : [];
    input.value = '';
    if (!picked.length) return;

    const room = MAX_PHOTOS_PER_POST - photoCount;
    if (room <= 0) {
      toast.error(`Up to ${MAX_PHOTOS_PER_POST} photos per pulse.`);
      return;
    }

    for (const file of picked.slice(0, room)) {
      try {
        const att = await readPhotoAttachment(file);
        setComposerMedia(prev => [...prev, att]);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Could not add photo.');
      }
    }
  }, [photoCount]);

  const removeComposerAttachment = useCallback((id: string) => {
    setComposerMedia(prev => prev.filter(m => m.id !== id));
  }, []);

  const handlePost = async () => {
    const trimmed = text.trim();
    if (!trimmed && composerMedia.length === 0) return;

    const postsAddr = getPostsContractAddress();

    if (!postsAddr) {
      toast.error('Posts contract not configured', {
        description: 'Set VITE_POSTS_CONTRACT_ADDRESS in frontend/.env. The feed only shows posts from the indexer.',
        duration: 5000,
      });
      return;
    }

    if (!isConnected || !signer) {
      toast.error('Connect your wallet', {
        description: 'Wallet required to call Posts.createPost on Monad Testnet.',
      });
      return;
    }

    if (!isMonadTestnet) {
      try {
        await switchToMonadTestnet();
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        toast.error('Switch to Monad Testnet', { description: msg });
        return;
      }
    }

    if (composerMedia.length > 0 && !isIpfsUploadConfigured()) {
      toast.error('Pinata / IPFS not configured', {
        description:
          'Add photos require VITE_PINATA_JWT (Pinata API Keys → JWT). See frontend README — IPFS section.',
        duration: 7000,
      });
      return;
    }

    setPublishing(true);
    try {
      const ipfsCids: string[] = [];
      for (let i = 0; i < composerMedia.length; i++) {
        const att = composerMedia[i];
        const blob = dataUrlToBlob(att.url);
        const ext = extensionFromDataUrl(att.url);
        const cid = await uploadBlobToIpfs(blob, `pulse-${Date.now()}-${i}.${ext}`);
        ipfsCids.push(cid);
      }

      const r = await createPostWithSigner(
        signer,
        postsAddr,
        trimmed,
        composerMedia.length,
        ipfsCids.length ? ipfsCids : undefined
      );
      const txHash = r.hash;
      setText('');
      setComposerMedia([]);
      setComposerOpen(false);
      toast.success('Pulse published on-chain', {
        description: `${txHash.slice(0, 10)}…${txHash.slice(-8)} · syncing to feed…`,
        duration: 3500,
      });
      void refetchPosts();
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      toast.error('On-chain post failed', { description: msg });
    } finally {
      setPublishing(false);
    }
  };

  const canPublish = text.trim().length > 0 || composerMedia.length > 0;

  const handleLike = async (uiPostId: string) => {
    const post = posts.find(p => p.id === uiPostId);
    if (!post) return;

    if (!interactionsAddr || !post.onChainPostId) {
      toggleLike(uiPostId);
      toast('Off-chain like', {
        description: interactionsAddr
          ? 'This post has no on-chain id yet (create it with an on-chain pulse first).'
          : 'Set VITE_INTERACTIONS_CONTRACT_ADDRESS for on-chain likes.',
        duration: 3000,
      });
      return;
    }

    if (!isConnected || !signer || !provider || !address) {
      toast.error('Connect wallet', { description: 'Required to like on-chain by post id.' });
      return;
    }

    try {
      await ensureMonad();
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      toast.error('Switch to Monad Testnet', { description: msg });
      return;
    }

    if (likeBusyId) return;
    setLikeBusyId(uiPostId);
    const postIdBn = BigInt(post.onChainPostId);
    try {
      if (post.liked) {
        await unlikeWithSigner(signer, interactionsAddr, postIdBn);
      } else {
        await likeWithSigner(signer, interactionsAddr, postIdBn);
      }
      const snap = await readLikeSnapshot(provider, interactionsAddr, postIdBn, address);
      patchPost(uiPostId, { liked: snap.hasLiked, likes: Number(snap.likeCount) });
      toast.success(post.liked ? 'Unliked on-chain' : 'Liked on-chain', { duration: 2500 });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      try {
        const snap = await readLikeSnapshot(provider, interactionsAddr, postIdBn, address);
        patchPost(uiPostId, { liked: snap.hasLiked, likes: Number(snap.likeCount) });
      } catch {
        /* ignore */
      }
      toast.error('Like transaction failed', { description: msg });
    } finally {
      setLikeBusyId(null);
    }
  };

  const openComment = (uiPostId: string) => {
    setCommentPostId(uiPostId);
    setCommentDraft('');
  };

  const submitComment = async () => {
    const text = commentDraft.trim();
    if (!commentPostId || !text) return;
    const post = posts.find(p => p.id === commentPostId);
    if (!post?.onChainPostId) {
      toast.error('No on-chain post id', { description: 'Comments are stored in the Interactions contract by post id.' });
      return;
    }
    if (!interactionsAddr) {
      toast.error('Set VITE_INTERACTIONS_CONTRACT_ADDRESS');
      return;
    }
    if (!isConnected || !signer || !provider || !address) {
      toast.error('Connect wallet');
      return;
    }
    try {
      await ensureMonad();
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      toast.error('Switch to Monad Testnet', { description: msg });
      return;
    }

    setCommentSubmitting(true);
    const pid = BigInt(post.onChainPostId);
    try {
      await createCommentWithSigner(signer, interactionsAddr, pid, text);
      patchPost(commentPostId, { comments: post.comments + 1 });
      toast.success('Comment on-chain');
      setCommentPostId(null);
      setCommentDraft('');
      void refetchPosts();
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      toast.error('Comment failed', { description: msg });
    } finally {
      setCommentSubmitting(false);
    }
  };

  const handleFollowToggle = async (authorLower: string) => {
    if (!socialGraphAddr) {
      toast.error('Set VITE_SOCIAL_GRAPH_CONTRACT_ADDRESS');
      return;
    }
    if (!isConnected || !signer || !provider || !address) {
      toast.error('Connect wallet');
      return;
    }
    if (authorLower === address.toLowerCase()) return;
    try {
      await ensureMonad();
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      toast.error('Switch to Monad Testnet', { description: msg });
      return;
    }

    const following = followByAuthor[authorLower] ?? false;
    setFollowBusy(authorLower);
    let followee: string;
    try {
      followee = getAddress(authorLower);
    } catch {
      toast.error('Invalid author address');
      setFollowBusy(null);
      return;
    }
    try {
      if (following) await unfollowWithSigner(signer, socialGraphAddr, followee);
      else await followWithSigner(signer, socialGraphAddr, followee);
      setFollowByAuthor(prev => ({ ...prev, [authorLower]: !following }));
      toast.success(following ? 'Unfollowed' : 'Following');
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      toast.error('Follow action failed', { description: msg });
    } finally {
      setFollowBusy(null);
    }
  };

  return (
    <div className="relative min-h-screen pb-28">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-48 mesh-backdrop opacity-50" />

      <header className="sticky top-0 z-40 border-b border-border/60 bg-background/75 backdrop-blur-2xl">
        <div className="mx-auto flex max-w-lg items-center justify-between gap-4 px-5 py-4">
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-border/50 bg-card/80 shadow-soft">
              <ShockwavesMark className="h-5 w-5 text-accent drop-shadow-[0_0_10px_hsl(188_72%_48%_/0.4)]" />
            </div>
            <div className="flex min-w-0 flex-col">
              <span className="wordmark text-[11px]">Feed</span>
              <span className="truncate text-scale-sm font-semibold text-foreground">Pulse</span>
            </div>
          </div>
          {isConnected ? (
            <span className="shrink-0 rounded-2xl border border-border/70 bg-card/90 px-4 py-2.5 text-xs font-medium tabular-nums text-muted-foreground shadow-soft">
              {shortAddress}
            </span>
          ) : (
            <button
              type="button"
              onClick={() => void connect()}
              className="flex shrink-0 items-center gap-2 rounded-2xl gradient-brand px-4 py-2.5 text-xs font-semibold text-primary-foreground shadow-fab touch-press disabled:opacity-40"
            >
              <Wallet className="h-4 w-4" strokeWidth={2} />
              Sign in
            </button>
          )}
        </div>

        {isConnected && !isMonadTestnet ? (
          <div className="border-t border-border/40 bg-muted/25 px-5 py-3 text-xs text-amber-200/90">
            Switch to <strong>Monad Testnet</strong> (chain 10143) to publish and interact on-chain.
          </div>
        ) : null}
      </header>

      {composerOpen && (
        <div className="mx-auto max-w-lg animate-fade-in border-b border-border/50 bg-card/40 px-5 py-6 backdrop-blur-sm">
          <input
            ref={photoInputRef}
            type="file"
            accept="image/jpeg,image/jpg,image/png,image/webp,image/pjpeg,.jpg,.jpeg,.png,.webp"
            multiple
            className="sr-only"
            aria-label="Add photos"
            onChange={onPhotosSelected}
          />
          <textarea
            value={text}
            onChange={e => setText(e.target.value.slice(0, 280))}
            placeholder="What’s on your mind?"
            className="w-full resize-none rounded-2xl border border-border/60 bg-muted/30 p-4 text-sm leading-relaxed text-foreground shadow-[0_1px_0_0_hsl(0_0%_100%_/0.03)_inset] placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/50"
            rows={4}
            autoFocus
          />

          <div className="mt-4 flex flex-col rounded-2xl border border-primary/25 bg-primary/5 p-4 shadow-[0_1px_0_0_hsl(0_0%_100%_/0.04)_inset]">
            <div className="mb-3 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/15 text-primary">
                  <Image className="h-4 w-4" strokeWidth={2} aria-hidden />
                </div>
                <div>
                  <p className="text-xs font-semibold text-foreground">Photos</p>
                  <p className="text-[10px] text-muted-foreground">JPEG, PNG, WebP · max 5 MB each</p>
                </div>
              </div>
              <span className="text-[10px] font-semibold tabular-nums text-muted-foreground">
                {photoCount}/{MAX_PHOTOS_PER_POST}
              </span>
            </div>
            {photoCount > 0 ? (
              <div className="mb-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                {composerMedia.map(m => (
                  <div
                    key={m.id}
                    className="relative aspect-square overflow-hidden rounded-xl border border-border/50 bg-muted/40"
                  >
                    <img src={m.url} alt="" className="h-full w-full object-cover" />
                    <button
                      type="button"
                      onClick={() => removeComposerAttachment(m.id)}
                      className="absolute right-1 top-1 flex h-7 w-7 items-center justify-center rounded-lg bg-background/90 shadow-soft touch-press"
                      aria-label="Remove photo"
                    >
                      <X className="h-3.5 w-3.5" strokeWidth={2} />
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="mb-3 text-[11px] leading-relaxed text-muted-foreground">No photos yet.</p>
            )}
            <button
              type="button"
              onClick={() => photoInputRef.current?.click()}
              disabled={photoCount >= MAX_PHOTOS_PER_POST}
              className="mt-auto flex min-h-10 w-full items-center justify-center gap-2 rounded-xl border border-primary/35 bg-card/80 py-2.5 text-xs font-semibold text-foreground transition-colors hover:bg-primary/10 disabled:opacity-40 touch-press-soft"
            >
              <ImagePlus className="h-4 w-4 text-primary" strokeWidth={2} />
              Add photos
            </button>
          </div>

          {photoCount > 0 && !isIpfsUploadConfigured() ? (
            <p className="mt-3 rounded-xl border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-[11px] leading-relaxed text-amber-100/90">
              Photos are uploaded to <strong>IPFS via Pinata</strong> before the on-chain post. Add{' '}
              <code className="rounded bg-muted/50 px-1 font-mono text-[10px]">VITE_PINATA_JWT</code> to{' '}
              <code className="rounded bg-muted/50 px-1 font-mono text-[10px]">frontend/.env</code> (Pinata
              dashboard → API Keys → JWT with pin permission).
            </p>
          ) : null}

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <span className={`text-xs font-medium ${text.length > 260 ? 'text-destructive' : 'text-muted-foreground'}`}>
              {text.length}/280
            </span>
            <button
              type="button"
              onClick={() => void handlePost()}
              disabled={!canPublish || publishing}
              className="min-h-11 rounded-2xl gradient-brand px-6 py-3 text-sm font-semibold text-primary-foreground shadow-fab disabled:opacity-40 touch-press"
            >
              {publishing ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" strokeWidth={2} />
                  {photoCount > 0 ? 'IPFS + chain…' : 'Publishing…'}
                </span>
              ) : (
                'Publish'
              )}
            </button>
          </div>
        </div>
      )}

      <div className="mx-auto flex max-w-lg flex-col gap-4 px-4 py-6">
        {postsError ? (
          <div className="rounded-2xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            <p className="font-semibold">Could not load feed from indexer</p>
            <p className="mt-1 text-xs opacity-90">{postsError}</p>
            <p className="mt-2 text-xs text-muted-foreground">
              Start Envio + Hasura (<code className="rounded bg-muted/80 px-1 font-mono">indexer/npm run dev</code>) and ensure{' '}
              <code className="rounded bg-muted/80 px-1 font-mono">VITE_HASURA_GRAPHQL_URL</code> points at{' '}
              <code className="rounded bg-muted/80 px-1 font-mono">/hasura/v1/graphql</code> (dev proxy) or{' '}
              <code className="rounded bg-muted/80 px-1 font-mono">http://127.0.0.1:8080/v1/graphql</code>.
            </p>
            <button
              type="button"
              onClick={() => void refetchPosts()}
              className="mt-3 rounded-xl border border-border/60 bg-card px-3 py-2 text-xs font-medium touch-press-soft"
            >
              Retry
            </button>
          </div>
        ) : null}
        {postsLoading && posts.length === 0 ? (
          <div className="flex flex-col gap-4">
            {[1, 2, 3].map(i => (
              <div
                key={i}
                className="surface-panel h-40 animate-pulse rounded-2xl bg-muted/30 p-5"
                aria-hidden
              />
            ))}
          </div>
        ) : null}
        {!postsLoading && !postsError && posts.length === 0 ? (
          <p className="rounded-2xl border border-border/50 bg-card/40 px-5 py-8 text-center text-sm text-muted-foreground">
            No pulses indexed yet. Publish one on-chain (composer) or run your demo script — the feed only shows what Envio has synced.
          </p>
        ) : null}
        {posts.map(post => (
          <article
            key={post.id}
            className="surface-panel flex flex-col gap-4 p-5 touch-press-soft"
          >
            <div className="flex gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-border/50 bg-primary/10 text-sm font-semibold text-primary shadow-soft">
                {post.avatar}
              </div>
              <div className="flex min-w-0 flex-1 flex-col gap-2">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <div className="flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-1">
                    <span className="text-sm font-semibold text-foreground">{post.author}</span>
                    <span className="text-xs text-muted-foreground">{post.handle}</span>
                    <span className="text-xs text-muted-foreground/80">· {timeAgo(post.timestamp)}</span>
                    {post.onChainPostId ? (
                      <span
                        className="rounded-lg bg-muted/60 px-2 py-0.5 font-mono text-[10px] text-muted-foreground"
                        title="On-chain post id (Interactions / indexer)"
                      >
                        #{post.onChainPostId}
                      </span>
                    ) : null}
                  </div>
                  {post.authorAddress &&
                  address &&
                  post.authorAddress.toLowerCase() !== address.toLowerCase() &&
                  socialGraphAddr ? (
                    <button
                      type="button"
                      onClick={() => void handleFollowToggle(post.authorAddress!.toLowerCase())}
                      disabled={followBusy === post.authorAddress!.toLowerCase()}
                      className={`ml-auto flex shrink-0 items-center gap-1 rounded-xl px-2.5 py-1 text-[10px] font-semibold transition-colors touch-press-soft ${
                        followByAuthor[post.authorAddress.toLowerCase()]
                          ? 'bg-muted/80 text-muted-foreground'
                          : 'bg-primary/15 text-primary'
                      } disabled:opacity-40`}
                    >
                      {followBusy === post.authorAddress.toLowerCase() ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : followByAuthor[post.authorAddress.toLowerCase()] ? (
                        <UserMinus className="h-3 w-3" strokeWidth={2} />
                      ) : (
                        <UserPlus className="h-3 w-3" strokeWidth={2} />
                      )}
                      {followByAuthor[post.authorAddress.toLowerCase()] ? 'Unfollow' : 'Follow'}
                    </button>
                  ) : null}
                </div>
                {post.content ? (
                  <p className="text-scale-sm leading-relaxed text-foreground/95" style={{ overflowWrap: 'break-word' }}>
                    {post.content}
                  </p>
                ) : null}
                {post.onChainImageCount && post.onChainImageCount > 0 ? (
                  <p className="text-[11px] text-muted-foreground">
                    {post.onChainImageCount} image{post.onChainImageCount === 1 ? '' : 's'} referenced on-chain (preview not stored in URI).
                  </p>
                ) : null}
                {post.attachments?.some(a => a.kind === 'image') ? (
                  <div
                    className={`grid gap-2 ${
                      post.attachments!.filter(a => a.kind === 'image').length === 1 ? 'grid-cols-1' : 'grid-cols-2'
                    }`}
                  >
                    {post.attachments!
                      .filter(a => a.kind === 'image')
                      .map(att => (
                        <div
                          key={att.id}
                          className="overflow-hidden rounded-2xl border border-primary/20 bg-muted/30"
                        >
                          <img
                            src={att.url}
                            alt="Photo attachment"
                            className="max-h-80 w-full object-contain"
                            loading="lazy"
                          />
                        </div>
                      ))}
                  </div>
                ) : null}
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => openComment(post.id)}
                    disabled={!post.onChainPostId || !interactionsAddr}
                    title={
                      !interactionsAddr
                        ? 'Set VITE_INTERACTIONS_CONTRACT_ADDRESS'
                        : !post.onChainPostId
                          ? 'Only posts with an on-chain id can receive comments'
                          : 'Comment on-chain'
                    }
                    className="flex min-h-10 items-center gap-2 rounded-xl px-3 py-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground touch-press-soft disabled:opacity-35"
                  >
                    <MessageCircle className="h-4 w-4" strokeWidth={2} />
                    <span className="tabular-nums">{formatCount(post.comments)}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => toggleRepost(post.id)}
                    className={`flex min-h-10 items-center gap-2 rounded-xl px-3 py-2 text-xs font-medium transition-colors touch-press-soft ${
                      post.reposted
                        ? 'bg-accent/15 text-accent'
                        : 'text-muted-foreground hover:bg-muted/60 hover:text-accent'
                    }`}
                  >
                    <Repeat2 className="h-4 w-4" strokeWidth={2} />
                    <span className="tabular-nums">{formatCount(post.reposts)}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleLike(post.id)}
                    disabled={likeBusyId === post.id}
                    className={`flex min-h-10 items-center gap-2 rounded-xl px-3 py-2 text-xs font-medium transition-colors touch-press-soft disabled:opacity-40 ${
                      post.liked
                        ? 'bg-destructive/10 text-destructive'
                        : 'text-muted-foreground hover:bg-muted/60 hover:text-destructive'
                    }`}
                  >
                    {likeBusyId === post.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" strokeWidth={2} />
                    ) : (
                      <Heart className={`h-4 w-4 ${post.liked ? 'fill-current' : ''}`} strokeWidth={2} />
                    )}
                    <span className="tabular-nums">{formatCount(post.likes)}</span>
                  </button>
                  <span className="ml-auto flex min-h-10 items-center gap-2 px-3 text-xs text-muted-foreground">
                    <Eye className="h-4 w-4" strokeWidth={2} />
                    <span className="tabular-nums">{formatCount(post.views)}</span>
                  </span>
                </div>
              </div>
            </div>
          </article>
        ))}
      </div>

      <button
        type="button"
        onClick={() => setComposerOpen(!composerOpen)}
        className="fixed bottom-28 right-5 z-50 flex h-14 w-14 items-center justify-center rounded-2xl gradient-brand text-primary-foreground shadow-fab transition-transform duration-200 hover:brightness-110 active:scale-95"
        aria-label={composerOpen ? 'Close composer' : 'New pulse'}
      >
        <Plus className="h-7 w-7" strokeWidth={2.5} />
      </button>

      <Dialog open={commentPostId !== null} onOpenChange={open => !open && setCommentPostId(null)}>
        <DialogContent className="max-w-md border-border/60 bg-background/95 sm:rounded-2xl">
          <DialogHeader>
            <DialogTitle>On-chain comment</DialogTitle>
          </DialogHeader>
          <p className="text-xs text-muted-foreground">
            Stored in <span className="font-mono">Interactions</span> for post id{' '}
            <span className="font-mono">
              {commentPostId ? posts.find(p => p.id === commentPostId)?.onChainPostId ?? '—' : '—'}
            </span>
            .
          </p>
          <Textarea
            value={commentDraft}
            onChange={e => setCommentDraft(e.target.value.slice(0, 500))}
            placeholder="Write a comment…"
            rows={4}
            className="resize-none rounded-xl"
          />
          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" onClick={() => setCommentPostId(null)}>
              Cancel
            </Button>
            <Button
              type="button"
              disabled={!commentDraft.trim() || commentSubmitting}
              onClick={() => void submitComment()}
            >
              {commentSubmitting ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Sending…
                </span>
              ) : (
                'Submit'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <BottomNav />
    </div>
  );
};

export default Feed;
