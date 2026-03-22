/**
 * Pinata: sign up, then API Keys → New Key → enable file pinning. Copy the JWT into VITE_PINATA_JWT.
 * Docs: https://docs.pinata.cloud/account-management/api-keys
 *
 * VITE_ vars are visible in the browser — use a key scoped to pinning only; for production prefer a backend proxy.
 */
export function getPinataJwt(): string | null {
  const j = (import.meta.env.VITE_PINATA_JWT as string | undefined)?.trim();
  return j && j.length > 0 ? j : null;
}

export function isIpfsUploadConfigured(): boolean {
  return !!getPinataJwt();
}

/** Gateway base URL; must end with /ipfs/ for standard gateways. */
export function getIpfsGatewayBase(): string {
  const g = (import.meta.env.VITE_IPFS_GATEWAY_URL as string | undefined)?.trim();
  if (g) {
    return g.endsWith('/') ? g : `${g}/`;
  }
  return 'https://gateway.pinata.cloud/ipfs/';
}

export function cidToHttpUrl(cid: string): string {
  const c = cid.replace(/^ipfs:\/\//, '').replace(/^\//, '');
  const base = getIpfsGatewayBase();
  return `${base}${c}`;
}
