import { useEffect, useState } from 'react';
import { Zap, ArrowUpRight } from 'lucide-react';
import BottomNav from '@/components/BottomNav';

const TX_TYPES = ['Like', 'Repost', 'Reply', 'Post'];
const USERS = ['kenji_monad', 'lena_web3', 'marcusc_dev', 'aisha_builds', 'dan_0x', 'sofia_chain'];

function randomTx() {
  const type = TX_TYPES[Math.floor(Math.random() * TX_TYPES.length)];
  const user = USERS[Math.floor(Math.random() * USERS.length)];
  const hash = '0x' + Math.random().toString(16).slice(2, 10);
  const mon = (Math.random() * 0.005 + 0.001).toFixed(4);
  return { id: Date.now() + Math.random(), type, user, hash, mon, time: 'now' };
}

const Dashboard = () => {
  const [tps, setTps] = useState(9847);
  const [transactions, setTransactions] = useState(() => Array.from({ length: 5 }, randomTx));

  useEffect(() => {
    const tpsInterval = setInterval(() => {
      setTps(prev => prev + Math.floor(Math.random() * 200 - 80));
    }, 1200);
    const txInterval = setInterval(() => {
      setTransactions(prev => [randomTx(), ...prev.slice(0, 4)]);
    }, 2500);
    return () => {
      clearInterval(tpsInterval);
      clearInterval(txInterval);
    };
  }, []);

  return (
    <div className="relative min-h-screen pb-28 pt-6">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-40 mesh-backdrop opacity-40" />
      <div className="relative mx-auto flex max-w-lg flex-col gap-6 px-5">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-border/50 bg-card shadow-soft">
            <Zap className="h-5 w-5 text-accent" strokeWidth={2} />
          </div>
          <div className="flex flex-col">
            <span className="wordmark text-[11px]">Network</span>
            <h1 className="heading-section text-xl">Dashboard</h1>
          </div>
        </div>

        <section className="surface-panel flex flex-col gap-5 p-6">
          <div className="flex items-center justify-between gap-4">
            <span className="text-sm font-medium text-muted-foreground">Live throughput</span>
            <span className="flex items-center gap-2 rounded-full bg-accent/15 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-accent">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-accent" />
              Live
            </span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-4xl font-semibold tabular-nums tracking-tight text-foreground">{tps.toLocaleString()}</span>
            <span className="text-sm font-medium text-muted-foreground">TPS</span>
          </div>
          <div className="flex h-14 items-end gap-1.5">
            {Array.from({ length: 24 }).map((_, i) => {
              const h = 24 + Math.random() * 76;
              return (
                <div
                  key={i}
                  className="flex-1 rounded-t-lg bg-gradient-to-t from-primary/25 to-primary/70 transition-all duration-500"
                  style={{ height: `${h}%`, minHeight: 6, maxHeight: '100%' }}
                />
              );
            })}
          </div>
        </section>

        <section className="surface-panel flex flex-col gap-5 p-6">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-muted-foreground">Recent activity</span>
            <ArrowUpRight className="h-4 w-4 text-muted-foreground" strokeWidth={2} />
          </div>
          <div className="flex flex-col gap-4">
            {transactions.map(tx => (
              <div
                key={tx.id}
                className="flex items-center justify-between gap-4 rounded-xl border border-border/40 bg-muted/20 px-4 py-3 animate-fade-in"
              >
                <div className="flex min-w-0 flex-1 items-center gap-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-card text-sm shadow-soft">
                    {tx.type === 'Like' ? '♥' : tx.type === 'Repost' ? '↻' : tx.type === 'Reply' ? '↩' : '✎'}
                  </span>
                  <div className="min-w-0">
                    <span className="block truncate text-sm font-medium text-foreground">@{tx.user}</span>
                    <p className="truncate font-mono text-[11px] text-muted-foreground">{tx.hash}…</p>
                  </div>
                </div>
                <div className="shrink-0 text-right">
                  <span className="block text-xs font-semibold text-accent">{tx.mon} MON</span>
                  <span className="text-[10px] text-muted-foreground">{tx.time}</span>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
      <BottomNav />
    </div>
  );
};

export default Dashboard;
