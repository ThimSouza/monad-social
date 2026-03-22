import type { PulseCall } from '@/lib/pulse7702Session';

export type RelayRequestBody = {
  userAddress: string;
  calls: { to: string; value: string; data: string }[];
  sessionSig: string;
};

export async function relayExecute(baseUrl: string, body: RelayRequestBody): Promise<{ hash: string }> {
  const url = `${baseUrl.replace(/\/$/, '')}/relay`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(text || `Relay HTTP ${res.status}`);
  try {
    return JSON.parse(text) as { hash: string };
  } catch {
    throw new Error(text);
  }
}

export function serializeCalls(calls: PulseCall[]): RelayRequestBody['calls'] {
  return calls.map(c => ({
    to: c.to,
    value: c.value.toString(),
    data: c.data,
  }));
}
