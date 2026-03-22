import { MapPin, Link as LinkIcon, Calendar, TrendingUp, Heart, Zap, Camera, Pencil, LogOut } from 'lucide-react';
import { useWallet } from '@/contexts/WalletContext';
import { useLogout } from '@/hooks/useLogout';
import { useFeed } from '@/contexts/FeedContext';
import BottomNav from '@/components/BottomNav';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  loadStoredProfile,
  saveStoredProfile,
  normalizeHandleSlug,
  isValidHttpUrl,
  normalizeUrlInput,
  DEFAULT_PROFILE,
  type StoredProfile,
  type ProfileLink,
} from '@/lib/profileStorage';

const TABS = ['Pulses', 'Replies', 'Highlights'] as const;

const AVATAR_STORAGE_KEY = 'monad_pulse_profile_avatar';
const MAX_FILE_BYTES = 5 * 1024 * 1024;
const AVATAR_MAX_EDGE = 512;
const JPEG_QUALITY = 0.85;

const ACCEPT_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

function resizeImageToJpegDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      const img = new Image();
      img.onload = () => {
        let w = img.naturalWidth;
        let h = img.naturalHeight;
        if (w < 1 || h < 1) {
          reject(new Error('Invalid image'));
          return;
        }
        if (w > AVATAR_MAX_EDGE || h > AVATAR_MAX_EDGE) {
          if (w >= h) {
            h = Math.round((h * AVATAR_MAX_EDGE) / w);
            w = AVATAR_MAX_EDGE;
          } else {
            w = Math.round((w * AVATAR_MAX_EDGE) / h);
            h = AVATAR_MAX_EDGE;
          }
        }
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Could not process image'));
          return;
        }
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL('image/jpeg', JPEG_QUALITY));
      };
      img.onerror = () => reject(new Error('Could not load image'));
      img.src = dataUrl;
    };
    reader.onerror = () => reject(new Error('Could not read file'));
    reader.readAsDataURL(file);
  });
}

function initialsFromName(name: string): string {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map(w => w[0]?.toUpperCase() ?? '')
      .join('')
      .slice(0, 2) || 'YO'
  );
}

function padLinksForEdit(links: ProfileLink[]): [ProfileLink, ProfileLink] {
  const a = links[0] ?? { url: '', label: '' };
  const b = links[1] ?? { url: '', label: '' };
  return [
    { url: a.url ?? '', label: a.label ?? '' },
    { url: b.url ?? '', label: b.label ?? '' },
  ];
}

function linkDisplayLabel(url: string, label: string): string {
  if (label.trim()) return label.trim();
  try {
    const u = new URL(url.startsWith('http') ? url : `https://${url}`);
    return u.hostname.replace(/^www\./, '') || url;
  } catch {
    return url;
  }
}

const Profile = () => {
  const { shortAddress } = useWallet();
  const logout = useLogout();
  const { posts } = useFeed();
  const [activeTab, setActiveTab] = useState<(typeof TABS)[number]>('Pulses');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [profile, setProfile] = useState<StoredProfile>(() => loadStoredProfile());
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState<StoredProfile>(() => loadStoredProfile());

  useEffect(() => {
    try {
      const stored = localStorage.getItem(AVATAR_STORAGE_KEY);
      if (stored?.startsWith('data:image')) setAvatarUrl(stored);
    } catch {
      /* ignore */
    }
  }, []);

  const openFilePicker = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const onAvatarSelected = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    if (!ACCEPT_TYPES.includes(file.type)) {
      toast.error('Please use JPEG, PNG, WebP, or GIF.');
      return;
    }
    if (file.size > MAX_FILE_BYTES) {
      toast.error('File is too large (max 5 MB).');
      return;
    }

    try {
      const dataUrl = await resizeImageToJpegDataUrl(file);
      if (dataUrl.length > 4_500_000) {
        toast.error('Image is still too large after processing. Try another photo.');
        return;
      }
      setAvatarUrl(dataUrl);
      localStorage.setItem(AVATAR_STORAGE_KEY, dataUrl);
      toast.success('Profile photo updated');
    } catch {
      toast.error('Could not load the image.');
    }
  }, []);

  const removeAvatar = useCallback(() => {
    setAvatarUrl(null);
    try {
      localStorage.removeItem(AVATAR_STORAGE_KEY);
    } catch {
      /* ignore */
    }
    toast.success('Photo removed');
  }, []);

  const startEdit = useCallback(() => {
    const current = loadStoredProfile();
    setProfile(current);
    setDraft({
      ...current,
      links: padLinksForEdit(current.links),
    });
    setIsEditing(true);
  }, []);

  const cancelEdit = useCallback(() => {
    setIsEditing(false);
    setDraft(loadStoredProfile());
  }, []);

  const saveEdit = useCallback(() => {
    const slug = normalizeHandleSlug(draft.handle);
    if (!slug) {
      toast.error('Username must contain letters, numbers, or underscores.');
      return;
    }

    const builtLinks: ProfileLink[] = [];
    const pairs = padLinksForEdit(draft.links);
    for (const row of pairs) {
      const raw = row.url.trim();
      if (!raw) continue;
      const full = normalizeUrlInput(raw);
      if (!isValidHttpUrl(full)) {
        toast.error(`Invalid link URL: ${raw.slice(0, 40)}${raw.length > 40 ? '…' : ''}`);
        return;
      }
      let label = row.label.trim();
      if (!label) label = linkDisplayLabel(full, '');
      builtLinks.push({ url: full, label: label.slice(0, 40) });
    }

    const next: StoredProfile = {
      displayName: draft.displayName.trim() || DEFAULT_PROFILE.displayName,
      handle: slug,
      bio: draft.bio,
      links: builtLinks,
    };
    saveStoredProfile(next);
    setProfile(next);
    setIsEditing(false);
    toast.success('Profile saved');
  }, [draft]);

  const userPosts = useMemo(() => posts.filter(p => p.isMine), [posts]);
  const totalLikes = posts.reduce((sum, p) => sum + p.likes, 0);
  const avatarLetter = initialsFromName(profile.displayName);

  return (
    <div className="relative min-h-screen pb-28">
      <div className="relative h-40 overflow-hidden">
        <div className="absolute inset-0 mesh-backdrop" />
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-background/20 to-background" />
      </div>

      <div className="relative mx-auto max-w-lg px-5">
        <div className="-mt-16 flex flex-col gap-6">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div className="flex flex-col gap-2">
              <input
                ref={fileInputRef}
                type="file"
                accept={ACCEPT_TYPES.join(',')}
                className="sr-only"
                aria-label="Upload profile photo"
                onChange={onAvatarSelected}
              />
              <button
                type="button"
                onClick={openFilePicker}
                className="group relative flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-2xl border-4 border-background bg-card text-2xl font-semibold text-primary shadow-lift touch-press-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              >
                {avatarUrl ? (
                  <img src={avatarUrl} alt="Your profile photo" className="h-full w-full object-cover" />
                ) : (
                  <span aria-hidden>{avatarLetter}</span>
                )}
                <span className="absolute inset-0 flex items-center justify-center bg-background/65 opacity-0 transition-opacity duration-200 group-hover:opacity-100 group-focus-visible:opacity-100">
                  <Camera className="h-8 w-8 text-foreground" strokeWidth={2} aria-hidden />
                </span>
              </button>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={openFilePicker}
                  className="text-xs font-semibold text-primary hover:underline"
                >
                  Change photo
                </button>
                {avatarUrl ? (
                  <button
                    type="button"
                    onClick={removeAvatar}
                    className="text-xs font-medium text-muted-foreground hover:text-foreground hover:underline"
                  >
                    Remove
                  </button>
                ) : null}
              </div>
            </div>
            <button
              type="button"
              onClick={logout}
              className="flex min-h-11 items-center justify-center gap-2 rounded-2xl border border-border/70 bg-card/90 px-5 py-2.5 text-xs font-semibold text-foreground shadow-soft transition-colors hover:bg-muted/40 touch-press"
            >
              <LogOut className="h-4 w-4 shrink-0" strokeWidth={2} aria-hidden />
              Log out
            </button>
          </div>

          <div className="flex flex-col gap-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                {isEditing ? (
                  <div className="flex flex-col gap-3">
                    <div>
                      <label htmlFor="profile-display-name" className="mb-1.5 block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                        Display name
                      </label>
                      <Input
                        id="profile-display-name"
                        value={draft.displayName}
                        onChange={e => setDraft(d => ({ ...d, displayName: e.target.value.slice(0, 50) }))}
                        placeholder="Your name"
                        className="rounded-2xl border-border/60 bg-muted/30"
                        maxLength={50}
                      />
                    </div>
                    <div>
                      <label htmlFor="profile-handle" className="mb-1.5 block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                        Username
                      </label>
                      <div className="flex items-stretch overflow-hidden rounded-2xl border border-border/60 bg-muted/30">
                        <span className="flex items-center border-r border-border/50 bg-muted/50 px-3 text-sm text-muted-foreground">
                          @
                        </span>
                        <Input
                          id="profile-handle"
                          value={draft.handle}
                          onChange={e =>
                            setDraft(d => ({
                              ...d,
                              handle: e.target.value.replace(/^@+/, '').slice(0, 30),
                            }))
                          }
                          placeholder="your_handle"
                          className="rounded-none border-0 bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0"
                          autoComplete="username"
                          spellCheck={false}
                        />
                      </div>
                      <p className="mt-1 text-[10px] text-muted-foreground">Letters, numbers, and underscores only.</p>
                    </div>
                    <div>
                      <label htmlFor="profile-bio" className="mb-1.5 block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                        Bio
                      </label>
                      <Textarea
                        id="profile-bio"
                        value={draft.bio}
                        onChange={e => setDraft(d => ({ ...d, bio: e.target.value.slice(0, 280) }))}
                        placeholder="Tell others about you"
                        rows={4}
                        className="resize-none rounded-2xl border-border/60 bg-muted/30"
                        maxLength={280}
                      />
                      <p className="mt-1 text-right text-[10px] tabular-nums text-muted-foreground">{draft.bio.length}/280</p>
                    </div>
                    <div className="space-y-3">
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Links (up to 2)</p>
                      {[0, 1].map(i => (
                        <div key={i} className="grid gap-2 sm:grid-cols-2">
                          <Input
                            value={padLinksForEdit(draft.links)[i].url}
                            onChange={e => {
                              const pair = padLinksForEdit(draft.links);
                              pair[i] = { ...pair[i], url: e.target.value };
                              setDraft(d => ({ ...d, links: [...pair] }));
                            }}
                            placeholder={i === 0 ? 'https://yoursite.com' : 'Second URL (optional)'}
                            className="rounded-2xl border-border/60 bg-muted/30"
                            inputMode="url"
                            autoComplete="url"
                          />
                          <Input
                            value={padLinksForEdit(draft.links)[i].label}
                            onChange={e => {
                              const pair = padLinksForEdit(draft.links);
                              pair[i] = { ...pair[i], label: e.target.value.slice(0, 40) };
                              setDraft(d => ({ ...d, links: [...pair] }));
                            }}
                            placeholder="Link label (optional)"
                            className="rounded-2xl border-border/60 bg-muted/30"
                            maxLength={40}
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <>
                    <h2 className="text-scale-xl font-semibold tracking-tight text-foreground">{profile.displayName}</h2>
                    <p className="text-sm text-muted-foreground">@{profile.handle}</p>
                  </>
                )}
                {shortAddress ? (
                  <p className="mt-2 font-mono text-xs font-medium text-accent tabular-nums">{shortAddress}</p>
                ) : null}
              </div>
              {isEditing ? (
                <div className="flex shrink-0 flex-col gap-2 sm:flex-row">
                  <button
                    type="button"
                    onClick={cancelEdit}
                    className="min-h-10 rounded-2xl border border-border/70 bg-card/90 px-4 py-2 text-xs font-semibold text-foreground shadow-soft touch-press"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={saveEdit}
                    className="min-h-10 rounded-2xl gradient-brand px-4 py-2 text-xs font-semibold text-primary-foreground shadow-soft touch-press"
                  >
                    Save
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={startEdit}
                  className="flex shrink-0 items-center gap-2 rounded-2xl border border-border/70 bg-card/90 px-4 py-2.5 text-xs font-semibold text-foreground shadow-soft transition-colors hover:bg-muted/40 touch-press"
                >
                  <Pencil className="h-3.5 w-3.5" strokeWidth={2} />
                  Edit profile
                </button>
              )}
            </div>

            {!isEditing ? (
              <p className="text-scale-sm max-w-prose leading-relaxed text-foreground/90 whitespace-pre-wrap">
                {profile.bio.trim() ? profile.bio : <span className="text-muted-foreground">No bio yet. Tap Edit profile to add one.</span>}
              </p>
            ) : null}

            {!isEditing ? (
              <div className="flex flex-wrap gap-x-6 gap-y-3 text-xs text-muted-foreground">
                <span className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 shrink-0 opacity-70" strokeWidth={2} />
                  On-chain
                </span>
                {profile.links.map((link, idx) => (
                  <a
                    key={`${link.url}-${idx}`}
                    href={link.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 font-medium text-primary underline-offset-2 hover:text-accent hover:underline"
                  >
                    <LinkIcon className="h-4 w-4 shrink-0 opacity-70" strokeWidth={2} />
                    {linkDisplayLabel(link.url, link.label)}
                  </a>
                ))}
                <span className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 shrink-0 opacity-70" strokeWidth={2} />
                  Joined March 2026
                </span>
              </div>
            ) : null}
          </div>

          <div className="flex flex-col gap-3 sm:flex-row">
            <div className="surface-panel flex flex-1 flex-col items-center gap-2 px-4 py-5">
              <Zap className="h-4 w-4 text-accent" strokeWidth={2} />
              <span className="text-xl font-semibold tabular-nums text-foreground">{userPosts.length}</span>
              <span className="text-center text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Pulses
              </span>
            </div>
            <div className="surface-panel flex flex-1 flex-col items-center gap-2 px-4 py-5">
              <Heart className="h-4 w-4 text-destructive" strokeWidth={2} />
              <span className="text-xl font-semibold tabular-nums text-foreground">{totalLikes.toLocaleString()}</span>
              <span className="text-center text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Likes
              </span>
            </div>
            <div className="surface-panel flex flex-1 flex-col items-center gap-2 px-4 py-5">
              <TrendingUp className="h-4 w-4 text-primary" strokeWidth={2} />
              <span className="text-xl font-semibold tabular-nums text-foreground">9.4k</span>
              <span className="text-center text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Reach
              </span>
            </div>
          </div>

          <div className="flex border-b border-border/60">
            {TABS.map(tab => (
              <button
                key={tab}
                type="button"
                onClick={() => setActiveTab(tab)}
                className={`min-h-12 flex-1 py-3 text-center text-sm font-semibold transition-colors touch-press-soft ${
                  activeTab === tab
                    ? 'border-b-2 border-primary text-foreground'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>

          <div className="pb-4">
            {activeTab === 'Pulses' && userPosts.length === 0 && (
              <div className="surface-panel flex flex-col items-center gap-3 py-16 text-center">
                <Zap className="h-8 w-8 text-muted-foreground" strokeWidth={1.5} />
                <p className="text-sm text-muted-foreground">No pulses yet. Open the feed and publish one.</p>
              </div>
            )}
            {activeTab === 'Pulses' &&
              userPosts.map(post => {
                const imgs = post.attachments?.filter(a => a.kind === 'image') ?? [];
                return (
                  <div key={post.id} className="border-b border-border/50 py-5 last:border-0">
                    {post.content ? (
                      <p className="text-sm leading-relaxed text-foreground" style={{ overflowWrap: 'break-word' }}>
                        {post.content}
                      </p>
                    ) : null}
                    {imgs.length > 0 ? (
                      <div className="mt-2 flex flex-col gap-2">
                        <div className={`grid gap-2 ${imgs.length === 1 ? 'grid-cols-1' : 'grid-cols-2'}`}>
                          {imgs.map(att => (
                            <div
                              key={att.id}
                              className="overflow-hidden rounded-2xl border border-primary/20 bg-muted/30"
                            >
                              <img
                                src={att.url}
                                alt="Photo"
                                className="max-h-48 w-full object-cover"
                                loading="lazy"
                              />
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : null}
                    <span className="mt-2 block text-xs text-muted-foreground">
                      {post.likes} likes · {post.reposts} reposts
                    </span>
                  </div>
                );
              })}
            {activeTab !== 'Pulses' && (
              <div className="surface-panel py-16 text-center">
                <p className="text-sm text-muted-foreground">Coming soon</p>
              </div>
            )}
          </div>
        </div>
      </div>
      <BottomNav />
    </div>
  );
};

export default Profile;
