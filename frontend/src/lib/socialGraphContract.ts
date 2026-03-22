import { Interface } from 'ethers';

export const SOCIAL_GRAPH_ABI = [
  'function follow(address followee) external',
  'function unfollow(address followee) external',
  'function isFollowing(address follower, address followee) view returns (bool)',
] as const;

const iface = new Interface([...SOCIAL_GRAPH_ABI]);

export function getSocialGraphContractAddress(): string | null {
  const a = import.meta.env.VITE_SOCIAL_GRAPH_CONTRACT_ADDRESS as string | undefined;
  if (!a || !/^0x[a-fA-F0-9]{40}$/.test(a)) return null;
  if (a.toLowerCase() === '0x0000000000000000000000000000000000000000') return null;
  return a;
}

export function encodeFollowData(followee: string): string {
  return iface.encodeFunctionData('follow', [followee]);
}

export function encodeUnfollowData(followee: string): string {
  return iface.encodeFunctionData('unfollow', [followee]);
}
