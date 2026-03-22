import { useState, useEffect, useRef, useCallback } from 'react';
import { Zap, MessageCircle, Repeat2, Heart, Eye, Plus, Wallet, Loader2, Fingerprint, ImagePlus, X, Image } from 'lucide-react';
import {
  useFeed,
  readPhotoAttachment,
  MAX_PHOTOS_PER_POST,
  type PostAttachment,
} from '@/contexts/FeedContext';
import { useWallet } from '@/contexts/WalletContext';
import { usePulse7702Session } from '@/hooks/usePulse7702Session';
import BottomNav from '@/components/BottomNav';
import { toast } from 'sonner';

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

const Feed = () => {
  const { posts, addPost, toggleLike, toggleRepost } = useFeed();
  const { shortAddress, isConnected, connect, provider, isMonadTestnet } = useWallet();
  const {
    busy: eip7702Busy,
    canRelay,
    delegated,
    sessionMatch,
    relayerConfigured,
    implConfigured,
    setup7702Session,
    sendSilentRelay,
  } = usePulse7702Session();
  const [composerOpen, setComposerOpen] = useState(false);
  const [text, setText] = useState('');
  const [composerMedia, setComposerMedia] = useState<PostAttachment[]>([]);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const [tps, setTps] = useState(9923);
  const [block, setBlock] = useState(1847293);

  useEffect(() => {
    const i = setInterval(() => {
      setTps(p => p + Math.floor(Math.random() * 150 - 60));
      setBlock(p => p + 1);
    }, 3000);
    return () => clearInterval(i);
  }, []);

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

  const handlePost = () => {
    const trimmed = text.trim();
    if (!trimmed && composerMedia.length === 0) return;
    addPost(trimmed, composerMedia.length ? composerMedia : undefined);
    setText('');
    setComposerMedia([]);
    setComposerOpen(false);
    toast.success('Pulse published', { duration: 2000 });
  };

  const canPublish = text.trim().length > 0 || composerMedia.length > 0;

  const handleLike = async (id: string) => {
    if (canRelay) {
      try {
        const { hash } = await sendSilentRelay([]);
        toggleLike(id);
        toast.success('Relayed — no wallet pop-up', {
          description: `${hash.slice(0, 10)}…${hash.slice(-8)}`,
          duration: 3500,
        });
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        toast.error('EIP-7702 relay failed', { description: msg });
      }
      return;
    }
    toggleLike(id);
    toast('Updated (demo)', { duration: 1500 });
  };

  const onSetup7702 = async () => {
    try {
      await setup7702Session();
      toast.success('EIP-7702 session ready', {
        description: 'Likes can use the relayer without a new wallet prompt.',
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      toast.error('EIP-7702 setup failed', { description: msg });
    }
  };

  return (
    <div className="relative min-h-screen pb-28">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-48 mesh-backdrop opacity-50" />

      <header className="sticky top-0 z-40 border-b border-border/60 bg-background/75 backdrop-blur-2xl">
        <div className="mx-auto flex max-w-lg items-center justify-between gap-4 px-5 py-4">
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-border/50 bg-card/80 shadow-soft">
              <Zap className="h-5 w-5 text-accent" strokeWidth={2} />
            </div>
            <div className="flex min-w-0 flex-col">
              <span className="wordmark text-[11px]">Feed</span>
              <span className="truncate text-scale-sm font-semibold text-foreground">Monad Pulse</span>
            </div>
          </div>
          {isConnected ? (
            <span className="shrink-0 rounded-2xl border border-border/70 bg-card/90 px-4 py-2.5 text-xs font-medium tabular-nums text-muted-foreground shadow-soft">
              {shortAddress}
            </span>
          ) : (
            <button
              type="button"
              onClick={connect}
              className="flex shrink-0 items-center gap-2 rounded-2xl gradient-brand px-4 py-2.5 text-xs font-semibold text-primary-foreground shadow-fab touch-press"
            >
              <Wallet className="h-4 w-4" strokeWidth={2} />
              Connect
            </button>
          )}
        </div>

        <div className="flex items-center justify-center gap-6 border-t border-border/40 bg-card/30 px-5 py-3 text-xs">
          <span className="flex items-center gap-2 font-medium text-accent">
            <span className="h-2 w-2 animate-pulse rounded-full bg-accent shadow-[0_0_8px_hsl(var(--accent)/0.6)]" />
            {tps.toLocaleString()} TPS
          </span>
          <span className="text-muted-foreground">0.8s latency</span>
          <span className="tabular-nums text-muted-foreground">#{block.toLocaleString()}</span>
        </div>

        {isConnected && provider && (
          <div className="border-t border-border/40 bg-muted/25 px-5 py-4 text-xs leading-relaxed text-muted-foreground">
            <div className="flex items-center gap-2 font-semibold text-foreground">
              <Fingerprint className="h-4 w-4 text-primary" strokeWidth={2} />
              EIP-7702 · silent session
            </div>
            <p className="mt-2 flex flex-wrap gap-x-2 gap-y-1">
              <span className={delegated ? 'text-accent' : undefined}>{delegated ? 'Delegated' : 'Not delegated'}</span>
              <span className="text-border">·</span>
              <span className={sessionMatch ? 'text-accent' : undefined}>
                {sessionMatch ? 'Session key OK' : 'Session pending'}
              </span>
              <span className="text-border">·</span>
              <span className={relayerConfigured ? 'text-accent' : undefined}>
                {relayerConfigured ? 'Relayer' : 'No VITE_RELAYER_URL'}
              </span>
              {canRelay ? <span className="text-accent"> · Silent likes</span> : null}
            </p>
            {!isMonadTestnet ? (
              <p className="mt-2 rounded-xl bg-amber-500/10 px-3 py-2 text-amber-200/90">
                Switch to Monad Testnet for EIP-7702.
              </p>
            ) : null}
            {!implConfigured ? (
              <p className="mt-2 rounded-xl bg-amber-500/10 px-3 py-2 text-amber-200/90">
                Set <code className="rounded-lg bg-muted/80 px-2 py-0.5 font-mono text-[10px]">VITE_PULSE7702_IMPLEMENTATION</code>{' '}
                after deploy.
              </p>
            ) : null}
            <button
              type="button"
              onClick={onSetup7702}
              disabled={eip7702Busy || !isMonadTestnet || !implConfigured}
              className="mt-3 flex min-h-11 w-full items-center justify-center gap-2 rounded-2xl border border-primary/35 bg-primary/10 px-4 py-3 text-xs font-semibold text-primary shadow-none transition-colors hover:bg-primary/15 disabled:opacity-40 touch-press-soft"
            >
              {eip7702Busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {eip7702Busy ? 'Signing delegation…' : 'Setup delegation + session (one prompt)'}
            </button>
            <p className="mt-3 text-[10px] leading-relaxed opacity-80">
              On Monad, 7702-delegated EOAs should stay above 10 MON (reserve balance).
            </p>
          </div>
        )}
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

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <span className={`text-xs font-medium ${text.length > 260 ? 'text-destructive' : 'text-muted-foreground'}`}>
              {text.length}/280
            </span>
            <button
              type="button"
              onClick={handlePost}
              disabled={!canPublish}
              className="min-h-11 rounded-2xl gradient-brand px-6 py-3 text-sm font-semibold text-primary-foreground shadow-fab disabled:opacity-40 touch-press"
            >
              Publish
            </button>
          </div>
        </div>
      )}

      <div className="mx-auto flex max-w-lg flex-col gap-4 px-4 py-6">
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
                <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                  <span className="text-sm font-semibold text-foreground">{post.author}</span>
                  <span className="text-xs text-muted-foreground">{post.handle}</span>
                  <span className="text-xs text-muted-foreground/80">· {timeAgo(post.timestamp)}</span>
                </div>
                {post.content ? (
                  <p className="text-scale-sm leading-relaxed text-foreground/95" style={{ overflowWrap: 'break-word' }}>
                    {post.content}
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
                    className="flex min-h-10 items-center gap-2 rounded-xl px-3 py-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground touch-press-soft"
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
                    onClick={() => handleLike(post.id)}
                    className={`flex min-h-10 items-center gap-2 rounded-xl px-3 py-2 text-xs font-medium transition-colors touch-press-soft ${
                      post.liked
                        ? 'bg-destructive/10 text-destructive'
                        : 'text-muted-foreground hover:bg-muted/60 hover:text-destructive'
                    }`}
                  >
                    <Heart className={`h-4 w-4 ${post.liked ? 'fill-current' : ''}`} strokeWidth={2} />
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

      <BottomNav />
    </div>
  );
};

export default Feed;
