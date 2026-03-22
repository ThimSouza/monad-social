import { useMemo, useState, useEffect, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Bell, Heart, MessageCircle, Zap, ChevronDown, Wallet } from 'lucide-react';
import BottomNav from '@/components/BottomNav';
import { useWallet } from '@/contexts/WalletContext';
import { fetchAlertsForPostOwner, type AlertKind, type IndexerAlertItem } from '@/lib/indexerAlerts';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';

function readStorageKey(addr: string): string {
  return `pulse_alerts_read_v1_${addr.toLowerCase()}`;
}

type AlertFilter = 'all' | 'unread' | AlertKind;

type DisplayAlert = IndexerAlertItem & { read: boolean };

const FILTER_LABELS: Record<AlertFilter, string> = {
  all: 'All',
  unread: 'Unread',
  like: 'Likes',
  comment: 'Comments',
};

function loadReadIds(addr: string | null): Set<string> {
  if (!addr) return new Set();
  try {
    const raw = localStorage.getItem(readStorageKey(addr));
    const arr = raw ? (JSON.parse(raw) as unknown) : [];
    return new Set(Array.isArray(arr) ? arr.filter((x): x is string => typeof x === 'string') : []);
  } catch {
    return new Set();
  }
}

function iconFor(kind: AlertKind) {
  switch (kind) {
    case 'like':
      return Heart;
    case 'comment':
      return MessageCircle;
    default:
      return Zap;
  }
}

function matchesFilter(item: DisplayAlert, filter: AlertFilter): boolean {
  if (filter === 'all') return true;
  if (filter === 'unread') return !item.read;
  return item.kind === filter;
}

const Alerts = () => {
  const { address, connect, isConnecting } = useWallet();
  const [filter, setFilter] = useState<AlertFilter>('all');
  const [readIds, setReadIds] = useState<Set<string>>(() => loadReadIds(address ?? null));

  useEffect(() => {
    setReadIds(loadReadIds(address));
  }, [address]);

  const {
    data: rawItems = [],
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ['indexerAlerts', address ?? ''],
    queryFn: () => fetchAlertsForPostOwner(address!),
    enabled: !!address,
    staleTime: 20_000,
    refetchInterval: 45_000,
  });

  const items: DisplayAlert[] = useMemo(
    () => rawItems.map(a => ({ ...a, read: readIds.has(a.id) })),
    [rawItems, readIds]
  );

  const visible = useMemo(() => items.filter(item => matchesFilter(item, filter)), [items, filter]);

  const unreadCount = useMemo(() => items.filter(i => !i.read).length, [items]);

  const markRead = useCallback(
    (id: string) => {
      if (!address) return;
      setReadIds(prev => {
        if (prev.has(id)) return prev;
        const next = new Set(prev);
        next.add(id);
        try {
          localStorage.setItem(readStorageKey(address), JSON.stringify([...next]));
        } catch {
          /* ignore quota */
        }
        return next;
      });
    },
    [address]
  );

  return (
    <div className="relative min-h-screen pb-28 pt-6">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-44 mesh-backdrop opacity-45" />

      <div className="relative mx-auto flex max-w-lg flex-col gap-6 px-5">
        <header className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-border/50 bg-card shadow-soft">
              <Bell className="h-5 w-5 text-primary" strokeWidth={2} aria-hidden />
            </div>
            <div className="flex flex-col gap-0.5">
              <span className="wordmark text-[11px]">Inbox</span>
              <h1 className="heading-section text-xl">Alerts</h1>
              {!address ? (
                <p className="text-xs text-muted-foreground">Connect to see activity on your posts</p>
              ) : unreadCount > 0 ? (
                <p className="text-xs font-medium text-accent">{unreadCount} unread</p>
              ) : (
                <p className="text-xs text-muted-foreground">You’re all caught up</p>
              )}
            </div>
          </div>
          {address ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  aria-label={`Filter alerts, current: ${FILTER_LABELS[filter]}`}
                  className="flex min-h-11 items-center gap-2 rounded-2xl border border-border/70 bg-card/90 px-4 py-2.5 text-xs font-semibold text-muted-foreground shadow-soft transition-colors hover:bg-muted/40 hover:text-foreground touch-press-soft data-[state=open]:ring-2 data-[state=open]:ring-ring/40"
                >
                  <span className="max-w-[8rem] truncate text-foreground">{FILTER_LABELS[filter]}</span>
                  <ChevronDown className="h-4 w-4 shrink-0 opacity-70" strokeWidth={2} aria-hidden />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-56 rounded-2xl border-border/60 p-2" align="end">
                <DropdownMenuLabel className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">
                  Show
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuRadioGroup value={filter} onValueChange={v => setFilter(v as AlertFilter)}>
                  {(Object.keys(FILTER_LABELS) as AlertFilter[]).map(key => (
                    <DropdownMenuRadioItem
                      key={key}
                      value={key}
                      className="rounded-xl py-2.5 pl-8 pr-2 text-sm focus:bg-muted/60"
                    >
                      {FILTER_LABELS[key]}
                    </DropdownMenuRadioItem>
                  ))}
                </DropdownMenuRadioGroup>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : null}
        </header>

        {!address ? (
          <div className="surface-panel flex flex-col items-center gap-4 py-14 text-center">
            <Wallet className="h-10 w-10 text-muted-foreground" strokeWidth={1.5} aria-hidden />
            <div className="space-y-1">
              <p className="text-sm font-semibold text-foreground">Wallet not connected</p>
              <p className="max-w-xs text-xs text-muted-foreground">
                Alerts only show <strong>likes</strong> and <strong>comments</strong> on pulses where{' '}
                <strong>you</strong> are the author.
              </p>
            </div>
            <Button type="button" onClick={() => void connect()} disabled={isConnecting} className="rounded-xl">
              {isConnecting ? 'Connecting…' : 'Connect wallet'}
            </Button>
          </div>
        ) : null}

        {address && isError ? (
          <div className="rounded-2xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            <p className="font-semibold">Could not load alerts</p>
            <p className="mt-1 text-xs opacity-90">{error instanceof Error ? error.message : String(error)}</p>
            <button
              type="button"
              onClick={() => void refetch()}
              className="mt-3 rounded-xl border border-border/60 bg-card px-3 py-2 text-xs font-medium touch-press-soft"
            >
              Retry
            </button>
          </div>
        ) : null}

        {address && isLoading ? (
          <div className="flex flex-col gap-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="surface-panel h-24 animate-pulse rounded-2xl bg-muted/30" aria-hidden />
            ))}
          </div>
        ) : null}

        {address && !isLoading && !isError ? (
          <section className="flex flex-col gap-3" aria-label="Notifications">
            {visible.length === 0 ? (
              <div className="surface-panel flex flex-col items-center gap-2 py-16 text-center">
                <Bell className="h-8 w-8 text-muted-foreground" strokeWidth={1.5} aria-hidden />
                <p className="text-sm font-medium text-foreground">No alerts here</p>
                <p className="max-w-xs text-xs text-muted-foreground">
                  {filter === 'all'
                    ? 'When someone likes or comments on a pulse you published on-chain, it will show up here.'
                    : 'Try another filter or choose All.'}
                </p>
              </div>
            ) : null}
            {visible.map(item => {
              const Icon = iconFor(item.kind);
              return (
                <article
                  key={item.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => markRead(item.id)}
                  onKeyDown={e => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      markRead(item.id);
                    }
                  }}
                  className={`surface-panel flex cursor-pointer gap-4 p-5 transition-opacity touch-press-soft ${
                    item.read ? 'opacity-85' : 'ring-1 ring-primary/20'
                  }`}
                >
                  <div
                    className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-border/50 ${
                      item.read ? 'bg-muted/40' : 'bg-primary/12'
                    }`}
                  >
                    <Icon
                      className={`h-5 w-5 ${item.kind === 'like' ? 'text-destructive' : item.read ? 'text-muted-foreground' : 'text-primary'}`}
                      strokeWidth={2}
                      aria-hidden
                    />
                  </div>
                  <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <h2 className="text-sm font-semibold leading-snug text-foreground">{item.title}</h2>
                    </div>
                    <p className="text-sm leading-relaxed text-muted-foreground">{item.body}</p>
                    {!item.read ? (
                      <span className="mt-1 inline-flex w-fit items-center rounded-full bg-primary/15 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-primary">
                        New
                      </span>
                    ) : null}
                  </div>
                </article>
              );
            })}
          </section>
        ) : null}

        {address ? (
          <p className="pb-4 text-center text-xs leading-relaxed text-muted-foreground">
            Only activity on <strong>your</strong> on-chain posts (indexed via Hasura / Envio).
          </p>
        ) : null}
      </div>

      <BottomNav />
    </div>
  );
};

export default Alerts;
