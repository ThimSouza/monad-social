import { useMemo, useState } from 'react';
import { Bell, AtSign, Heart, Repeat2, Zap, Shield, ChevronDown } from 'lucide-react';
import BottomNav from '@/components/BottomNav';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

type AlertKind = 'mention' | 'like' | 'repost' | 'system' | 'security';

type AlertFilter = 'all' | 'unread' | AlertKind;

type AlertItem = {
  id: string;
  kind: AlertKind;
  title: string;
  body: string;
  time: string;
  read: boolean;
};

const MOCK_ALERTS: AlertItem[] = [
  {
    id: '1',
    kind: 'mention',
    title: '@lena_web3 mentioned you',
    body: '“Parallel execution on Monad is wild — @your_handle check this thread.”',
    time: '12 min',
    read: false,
  },
  {
    id: '2',
    kind: 'like',
    title: 'New likes on your pulse',
    body: 'Kenji and 24 others liked your post on Pulse.',
    time: '1 h',
    read: false,
  },
  {
    id: '3',
    kind: 'repost',
    title: 'Repost',
    body: '@marcusc_dev reposted your pulse.',
    time: '3 h',
    read: true,
  },
  {
    id: '4',
    kind: 'system',
    title: 'Network',
    body: 'Monad Testnet revision updated — no action required for your wallet.',
    time: 'Yesterday',
    read: true,
  },
  {
    id: '5',
    kind: 'security',
    title: 'Session',
    body: 'Silent session key registered for this device. Revoke from profile if needed.',
    time: '2 d',
    read: true,
  },
];

const iconFor = (kind: AlertKind) => {
  switch (kind) {
    case 'mention':
      return AtSign;
    case 'like':
      return Heart;
    case 'repost':
      return Repeat2;
    case 'security':
      return Shield;
    default:
      return Zap;
  }
};

function matchesFilter(item: AlertItem, filter: AlertFilter): boolean {
  if (filter === 'all') return true;
  if (filter === 'unread') return !item.read;
  return item.kind === filter;
}

const FILTER_LABELS: Record<AlertFilter, string> = {
  all: 'All alerts',
  unread: 'Unread only',
  mention: 'Mentions',
  like: 'Likes',
  repost: 'Reposts',
  system: 'Network',
  security: 'Security',
};

const Alerts = () => {
  const [filter, setFilter] = useState<AlertFilter>('all');
  const unread = MOCK_ALERTS.filter(a => !a.read).length;

  const visible = useMemo(
    () => MOCK_ALERTS.filter(item => matchesFilter(item, filter)),
    [filter]
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
              {unread > 0 ? (
                <p className="text-xs font-medium text-accent">{unread} unread</p>
              ) : (
                <p className="text-xs text-muted-foreground">You’re all caught up</p>
              )}
            </div>
          </div>
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
        </header>

        <section className="flex flex-col gap-3" aria-label="Notifications">
          {visible.length === 0 ? (
            <div className="surface-panel flex flex-col items-center gap-2 py-16 text-center">
              <Bell className="h-8 w-8 text-muted-foreground" strokeWidth={1.5} aria-hidden />
              <p className="text-sm font-medium text-foreground">No alerts here</p>
              <p className="max-w-xs text-xs text-muted-foreground">
                Try another filter or switch back to <span className="text-foreground/90">All alerts</span>.
              </p>
            </div>
          ) : null}
          {visible.map(item => {
            const Icon = iconFor(item.kind);
            return (
              <article
                key={item.id}
                className={`surface-panel flex gap-4 p-5 transition-opacity touch-press-soft ${
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
                    <time className="shrink-0 text-[11px] font-medium tabular-nums text-muted-foreground">
                      {item.time}
                    </time>
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

        <p className="pb-4 text-center text-xs leading-relaxed text-muted-foreground">
          Demo alerts — wire to your indexer or subgraph for live activity.
        </p>
      </div>

      <BottomNav />
    </div>
  );
};

export default Alerts;
