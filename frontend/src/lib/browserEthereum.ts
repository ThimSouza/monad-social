import type { Eip1193Provider } from 'ethers';

type Ethereumish = Eip1193Provider & {
  providers?: Eip1193Provider[];
  isMetaMask?: boolean;
};

/**
 * Resolves the injected EIP-1193 provider (MetaMask, Rabby, etc.).
 * Handles multi-injector setups where `window.ethereum` is an array or has `.providers`.
 */
export function getBrowserEthereum(): Eip1193Provider | null {
  if (typeof window === 'undefined') return null;
  const w = window as Window & { ethereum?: unknown };
  const raw = w.ethereum;
  if (raw == null) return null;

  if (Array.isArray(raw) && raw.length > 0) {
    return pickPreferredProvider(raw as Ethereumish[]);
  }

  if (typeof raw === 'object' && raw !== null && 'providers' in raw) {
    const providers = (raw as Ethereumish).providers;
    if (Array.isArray(providers) && providers.length > 0) {
      return pickPreferredProvider(providers as Ethereumish[]);
    }
  }

  return raw as Eip1193Provider;
}

function pickPreferredProvider(list: Ethereumish[]): Eip1193Provider {
  const mm = list.find(p => p.isMetaMask);
  return (mm ?? list[0]) as Eip1193Provider;
}
