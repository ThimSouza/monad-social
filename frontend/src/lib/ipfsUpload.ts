import { getPinataJwt } from '@/lib/ipfsConfig';

const PINATA_PIN_FILE = 'https://api.pinata.cloud/pinning/pinFileToIPFS';

export type PinataPinResponse = {
  IpfsHash?: string;
  PinSize?: number;
  Timestamp?: string;
};

/**
 * Upload a single file to IPFS via Pinata `pinFileToIPFS` (browser-safe with a scoped JWT).
 */
export async function uploadBlobToIpfs(blob: Blob, filename: string): Promise<string> {
  const jwt = getPinataJwt();
  if (!jwt) {
    throw new Error(
      'IPFS upload is not configured. Set VITE_PINATA_JWT in frontend/.env (Pinata → API Keys → JWT).'
    );
  }

  const form = new FormData();
  form.append('file', blob, filename);

  const res = await fetch(PINATA_PIN_FILE, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${jwt}`,
    },
    body: form,
  });

  const json = (await res.json().catch(() => ({}))) as PinataPinResponse & { error?: { details?: string } };

  if (!res.ok) {
    const hint = typeof json.error?.details === 'string' ? json.error.details : JSON.stringify(json);
    throw new Error(`Pinata upload failed (${res.status}): ${hint}`);
  }

  const hash = json.IpfsHash;
  if (!hash || typeof hash !== 'string') {
    throw new Error('Pinata response missing IpfsHash.');
  }

  return hash;
}

/** Convert a `data:image/...;base64,...` URL from the composer into a Blob for upload. */
export function extensionFromDataUrl(dataUrl: string): string {
  const m = dataUrl.match(/^data:image\/([^;]+)/i);
  const t = m?.[1]?.toLowerCase() ?? '';
  if (t === 'jpeg' || t === 'pjpeg' || t === 'jpg') return 'jpg';
  if (t === 'png') return 'png';
  if (t === 'webp') return 'webp';
  return 'bin';
}

export function dataUrlToBlob(dataUrl: string): Blob {
  const comma = dataUrl.indexOf(',');
  if (comma === -1) throw new Error('Invalid data URL.');
  const meta = dataUrl.slice(0, comma);
  const data = dataUrl.slice(comma + 1);
  const mimeMatch = meta.match(/data:([^;]+)/);
  const mime = mimeMatch?.[1]?.trim() || 'application/octet-stream';

  if (meta.includes(';base64')) {
    const binary = atob(data);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return new Blob([bytes], { type: mime });
  }

  const decoded = decodeURIComponent(data);
  return new Blob([decoded], { type: mime });
}
