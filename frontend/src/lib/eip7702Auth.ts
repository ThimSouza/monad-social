import { Signature } from 'ethers';

export type BrowserAuthorization = {
  chainId: bigint;
  address: string;
  nonce: bigint;
  signature: Signature;
};

/** EIP-7702 authorization tuple for `authorizationList` on type-4 txs. */
export async function signAuthorizationFromBrowser(
  ethereum: { request: (args: { method: string; params?: unknown[] }) => Promise<unknown> },
  partial: { address: string; chainId: bigint; nonce: bigint }
): Promise<BrowserAuthorization> {
  const addr = partial.address;
  const chainIdHex = '0x' + partial.chainId.toString(16);
  const nonceHex = '0x' + partial.nonce.toString(16);

  const attempts: { method: string; params: unknown[] }[] = [
    { method: 'wallet_signAuthorization', params: [{ address: addr, chainId: chainIdHex, nonce: nonceHex }] },
    {
      method: 'wallet_signAuthorization',
      params: [[{ contractAddress: addr, address: addr, chainId: chainIdHex, nonce: nonceHex }]],
    },
    { method: 'eth_signAuthorization', params: [{ address: addr, chainId: chainIdHex, nonce: nonceHex }] },
  ];

  let last: unknown;
  for (const a of attempts) {
    try {
      const raw = await ethereum.request(a);
      const sig = normalizeAuthSignature(raw);
      if (sig) {
        return {
          chainId: partial.chainId,
          address: addr,
          nonce: partial.nonce,
          signature: Signature.from(sig),
        };
      }
    } catch (e) {
      last = e;
    }
  }

  throw new Error(
    'Esta carteira não expõe assinatura EIP-7702 (ex.: wallet_signAuthorization). Use MetaMask atualizado ou outra carteira compatível com Monad.',
    { cause: last }
  );
}

function normalizeAuthSignature(raw: unknown): { r: string; s: string; yParity: number } | null {
  if (raw == null) return null;
  if (typeof raw === 'string') {
    try {
      const sig = Signature.from(raw);
      return { r: sig.r, s: sig.s, yParity: sig.yParity };
    } catch {
      return null;
    }
  }
  if (typeof raw !== 'object') return null;
  const o = raw as Record<string, string | number | bigint>;
  const r = o.r != null ? String(o.r) : null;
  const s = o.s != null ? String(o.s) : null;
  if (!r || !s) return null;
  let yParity: number;
  if (o.yParity !== undefined) yParity = Number(o.yParity);
  else if (o.v !== undefined) {
    const v = Number(o.v);
    yParity = v === 0 || v === 27 ? 0 : 1;
  } else return null;
  return { r, s, yParity };
}
