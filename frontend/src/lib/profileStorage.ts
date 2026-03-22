export const PROFILE_STORAGE_KEY = 'monad_pulse_profile';

export type ProfileLink = { url: string; label: string };

export type StoredProfile = {
  displayName: string;
  handle: string;
  bio: string;
  links: ProfileLink[];
};

export const DEFAULT_PROFILE: StoredProfile = {
  displayName: 'Monad Builder',
  handle: 'your_handle',
  bio:
    'Building decentralized social on Monad. Parallel execution, tactile UX, on-chain when it matters.',
  links: [{ url: 'https://monad.xyz', label: 'monad.xyz' }],
};

const MAX_NAME = 50;
const MAX_HANDLE = 30;
const MAX_BIO = 280;
const MAX_LINKS = 2;
const MAX_LABEL = 40;

function clampLinks(links: unknown): ProfileLink[] {
  if (!Array.isArray(links)) return [];
  const out: ProfileLink[] = [];
  for (const item of links.slice(0, MAX_LINKS)) {
    if (!item || typeof item !== 'object') continue;
    const url = typeof (item as ProfileLink).url === 'string' ? (item as ProfileLink).url.trim() : '';
    const label = typeof (item as ProfileLink).label === 'string' ? (item as ProfileLink).label.trim() : '';
    if (!url) continue;
    out.push({
      url: url.slice(0, 500),
      label: label.slice(0, MAX_LABEL),
    });
  }
  return out;
}

export function loadStoredProfile(): StoredProfile {
  try {
    const raw = localStorage.getItem(PROFILE_STORAGE_KEY);
    if (!raw) return { ...DEFAULT_PROFILE, links: [...DEFAULT_PROFILE.links] };
    const p = JSON.parse(raw) as Partial<StoredProfile>;
    const linksParsed =
      'links' in p && Array.isArray(p.links) ? clampLinks(p.links) : [...DEFAULT_PROFILE.links];
    return {
      displayName:
        typeof p.displayName === 'string' && p.displayName.trim()
          ? p.displayName.trim().slice(0, MAX_NAME)
          : DEFAULT_PROFILE.displayName,
      handle:
        typeof p.handle === 'string' && p.handle.trim()
          ? normalizeHandleSlug(p.handle).slice(0, MAX_HANDLE) || DEFAULT_PROFILE.handle
          : DEFAULT_PROFILE.handle,
      bio: typeof p.bio === 'string' ? p.bio.slice(0, MAX_BIO) : DEFAULT_PROFILE.bio,
      links: linksParsed,
    };
  } catch {
    return { ...DEFAULT_PROFILE, links: [...DEFAULT_PROFILE.links] };
  }
}

export function saveStoredProfile(profile: StoredProfile): void {
  const normalized: StoredProfile = {
    displayName: profile.displayName.trim().slice(0, MAX_NAME) || DEFAULT_PROFILE.displayName,
    handle: normalizeHandleSlug(profile.handle).slice(0, MAX_HANDLE) || DEFAULT_PROFILE.handle,
    bio: profile.bio.slice(0, MAX_BIO),
    links: profile.links
      .slice(0, MAX_LINKS)
      .map(l => ({
        url: l.url.trim().slice(0, 500),
        label: l.label.trim().slice(0, MAX_LABEL),
      }))
      .filter(l => l.url.length > 0),
  };
  localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(normalized));
}

/** For new pulses: read display name and @handle from storage. */
export function getPostAuthorFromProfile(): { author: string; handle: string; avatar: string } {
  const p = loadStoredProfile();
  const author = p.displayName.trim() || DEFAULT_PROFILE.displayName;
  const slug = p.handle.trim() || DEFAULT_PROFILE.handle;
  const handle = `@${slug}`;
  const initials = author
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(w => w[0]?.toUpperCase() ?? '')
    .join('')
    .slice(0, 2);
  const avatar = initials || 'YO';
  return { author, handle, avatar };
}

export function normalizeHandleSlug(raw: string): string {
  const s = raw.trim().replace(/^@+/, '').toLowerCase();
  return s.replace(/[^a-z0-9_]/g, '').replace(/_+/g, '_');
}

export function isValidHttpUrl(url: string): boolean {
  const t = url.trim();
  if (!t) return false;
  try {
    const u = new URL(t.startsWith('http://') || t.startsWith('https://') ? t : `https://${t}`);
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
}

export function normalizeUrlInput(url: string): string {
  const t = url.trim();
  if (!t) return '';
  if (t.startsWith('http://') || t.startsWith('https://')) return t;
  return `https://${t}`;
}
