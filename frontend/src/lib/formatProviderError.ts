/**
 * Human-readable string from wallet RPC errors (MetaMask, Rabby, etc.).
 * Many wallets throw plain objects; String(err) becomes "[object Object]".
 */
export function formatProviderError(err: unknown): string {
  if (err == null) return 'Unknown error';
  if (typeof err === 'string') return err;
  if (err instanceof Error) {
    const m = err.message?.trim();
    if (m) return m;
  }

  if (typeof err !== 'object') return String(err);

  const o = err as Record<string, unknown>;

  // Ethers v6 / viem-style
  if (typeof o.shortMessage === 'string' && o.shortMessage.trim()) return o.shortMessage.trim();
  if (o.info && typeof o.info === 'object') {
    const info = o.info as Record<string, unknown>;
    if (typeof info.message === 'string' && info.message.trim()) return info.message.trim();
    if (info.error && typeof info.error === 'object') {
      const ie = info.error as Record<string, unknown>;
      if (typeof ie.message === 'string' && ie.message.trim()) return ie.message.trim();
    }
  }

  if (typeof o.message === 'string' && o.message.trim()) return o.message.trim();
  if (typeof o.reason === 'string' && o.reason.trim()) return o.reason.trim();

  // Nested { error: { message } } (common in Rabby / web3 providers)
  if (o.error !== undefined) {
    const nested = formatProviderError(o.error);
    if (nested && nested !== 'Unknown error' && nested !== '[object Object]') return nested;
  }

  if (o.data && typeof o.data === 'object') {
    const d = o.data as Record<string, unknown>;
    if (typeof d.message === 'string' && d.message.trim()) return d.message.trim();
  }

  const code = o.code;
  if (code === 4001 || code === '4001') return 'Request rejected in wallet.';
  if (code === -32002) return 'Wallet request already pending — check your wallet extension.';

  try {
    const s = JSON.stringify(o);
    if (s && s !== '{}') return s;
  } catch {
    /* ignore */
  }

  return 'Wallet returned an error (see browser console for details).';
}
