import { Zap, Wallet } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useWallet } from '@/contexts/WalletContext';
import { useEffect } from 'react';
import { toast } from 'sonner';
/** Abstract network / chain motif (decorative). */
function BlockchainNetworkArt() {
  return (
    <svg
      className="landing-scan-slow pointer-events-none absolute bottom-0 left-1/2 h-[min(42vh,400px)] w-[min(140vw,900px)] -translate-x-1/2 text-accent/50"
      viewBox="0 0 900 360"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <defs>
        <linearGradient id="ln1" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="hsl(188 72% 48%)" stopOpacity="0.15" />
          <stop offset="50%" stopColor="hsl(258 86% 64%)" stopOpacity="0.45" />
          <stop offset="100%" stopColor="hsl(188 72% 48%)" stopOpacity="0.15" />
        </linearGradient>
        <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="2" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      {/* Links */}
      <path
        className="landing-chain-dash"
        d="M80 220 L220 140 L380 180 L520 100 L720 160 L820 90"
        stroke="url(#ln1)"
        strokeWidth="1.25"
        strokeLinecap="round"
      />
      <path
        className="landing-chain-dash"
        style={{ animationDelay: '-0.6s' }}
        d="M120 280 L280 240 L440 260 L600 200 L780 240"
        stroke="hsl(258 70% 55% / 0.25)"
        strokeWidth="1"
        strokeLinecap="round"
      />
      <path
        d="M200 320 L360 200 L540 220 L700 140"
        stroke="hsl(188 60% 45% / 0.2)"
        strokeWidth="0.75"
        strokeLinecap="round"
      />
      {/* Nodes */}
      {[
        [80, 220],
        [220, 140],
        [380, 180],
        [520, 100],
        [720, 160],
        [820, 90],
        [440, 260],
        [600, 200],
      ].map(([cx, cy], i) => (
        <g key={i} filter="url(#glow)">
          <circle cx={cx} cy={cy} r="5" className="fill-primary/40" />
          <circle cx={cx} cy={cy} r="2.5" className="fill-accent" />
        </g>
      ))}
    </svg>
  );
}

const BG_IMAGE =
  'https://images.unsplash.com/photo-1639762681485-074b7f938ba0?auto=format&fit=crop&w=1920&q=85';

const Landing = () => {
  const { connect, isConnected, isConnecting, connectionError, clearConnectionError } = useWallet();
  const navigate = useNavigate();
  useEffect(() => {
    if (isConnected) navigate('/feed');
  }, [isConnected, navigate]);

  useEffect(() => {
    if (!connectionError) return;
    toast.error('Could not connect wallet', { description: connectionError, duration: 6000 });
    clearConnectionError();
  }, [connectionError, clearConnectionError]);

  return (
    <div className="relative flex min-h-screen flex-col overflow-hidden bg-background">
      {/* Photo layer — blockchain / digital asset aesthetic */}
      <img
        src={BG_IMAGE}
        alt=""
        className="pointer-events-none absolute inset-0 h-full w-full scale-105 object-cover opacity-[0.22] saturate-[1.15]"
        decoding="async"
      />

      {/* Color grade + depth */}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-background via-background/85 to-background" />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-tr from-primary/25 via-transparent to-accent/15" />
      <div className="mesh-backdrop pointer-events-none absolute inset-0 opacity-90" />

      {/* Moving tech grid */}
      <div className="landing-tech-grid pointer-events-none absolute inset-0" />

      {/* Soft orbs */}
      <div
        className="pointer-events-none absolute -left-32 top-1/4 h-72 w-72 rounded-full bg-primary/20 blur-[100px]"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute -right-24 bottom-1/3 h-64 w-64 rounded-full bg-accent/15 blur-[90px]"
        aria-hidden
      />

      <BlockchainNetworkArt />

      {/* Bottom vignette */}
      <div
        className="pointer-events-none absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-background via-background/80 to-transparent"
        aria-hidden
      />

      <main className="relative z-10 flex flex-1 flex-col items-center justify-center px-6 py-12 sm:py-16">
        <div className="flex w-full max-w-md flex-col items-stretch">
          <div className="mb-10 flex flex-col items-center text-center">
            <div className="landing-float-soft mb-8 flex h-24 w-24 items-center justify-center rounded-3xl border border-white/[0.12] bg-gradient-to-br from-card/80 to-card/40 p-1 shadow-[0_0_0_1px_hsl(258_86%_64%_/0.2),0_24px_48px_-12px_hsl(0_0%_0%_/0.55)] backdrop-blur-2xl">
              <div className="flex h-full w-full items-center justify-center rounded-[1.35rem] gradient-brand shadow-fab ring-4 ring-primary/10">
                <Zap className="h-10 w-10 text-primary-foreground drop-shadow-[0_0_12px_hsl(0_0%_100%_/0.35)]" strokeWidth={2} aria-hidden />
              </div>
            </div>

            <h1 className="heading-display">
              <span className="gradient-text-brand">Pulse</span>
            </h1>
            <p className="text-scale-base mt-6 max-w-sm text-pretty text-muted-foreground">
              A social network that you control the privacy of your identity and activity.
            </p>
          </div>

          <div className="relative overflow-hidden rounded-2xl border border-white/[0.08] bg-card/40 p-6 shadow-[0_0_0_1px_hsl(258_86%_64%_/0.08)_inset,0_20px_50px_-20px_hsl(0_0%_0%_/0.5)] backdrop-blur-2xl">
            <div
              className="pointer-events-none absolute -right-20 -top-20 h-40 w-40 rounded-full bg-primary/20 blur-3xl"
              aria-hidden
            />
            <div
              className="pointer-events-none absolute -bottom-16 -left-16 h-36 w-36 rounded-full bg-accent/10 blur-3xl"
              aria-hidden
            />

            <button
              type="button"
              onClick={() => void connect()}
              disabled={isConnecting}
              className="landing-shimmer-btn relative flex min-h-12 w-full items-center justify-center gap-3 rounded-2xl gradient-brand px-6 py-3.5 text-base font-semibold text-primary-foreground shadow-fab transition-all duration-200 hover:brightness-110 hover:shadow-[0_0_32px_-4px_hsl(258_86%_64%_/0.45)] active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50"
            >
              <Wallet className="relative z-[1] h-5 w-5 shrink-0" strokeWidth={2} />
              <span className="relative z-[1]">
                {isConnecting ? 'Connecting…' : 'Sign in with wallet'}
              </span>
            </button>
            <p className="relative z-[1] mt-4 text-center text-xs leading-relaxed text-muted-foreground">
              MetaMask, Rabby, or any EIP-1193 wallet on <strong>Monad Testnet</strong> (chain 10143). Each on-chain
              action opens your wallet to confirm a normal transaction.
            </p>
          </div>

          <p className="mt-10 text-center text-[10px] font-medium uppercase tracking-[0.2em] text-muted-foreground/60">
            Powered by Monad
          </p>
        </div>
      </main>
    </div>
  );
};

export default Landing;
