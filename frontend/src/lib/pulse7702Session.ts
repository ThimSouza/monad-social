import {
  Contract,
  Interface,
  Wallet,
  getBytes,
  keccak256,
  solidityPacked,
  type JsonRpcSigner,
  type BrowserProvider,
} from 'ethers';
import { signAuthorizationFromBrowser } from '@/lib/eip7702Auth';
import { PULSE7702_SESSION_ABI } from '@/lib/pulse7702Abi';
import { readDelegatedImplementation } from '@/lib/monadChain';

const SESSION_PK_KEY = 'pulse7702_session_pk';

export type PulseCall = { to: string; value: bigint; data: string };

export function getStoredSessionWallet(): Wallet | null {
  if (typeof sessionStorage === 'undefined') return null;
  const pk = sessionStorage.getItem(SESSION_PK_KEY);
  if (!pk) return null;
  try {
    return new Wallet(pk);
  } catch {
    return null;
  }
}

export function createStoredSessionWallet(): Wallet {
  const w = Wallet.createRandom();
  sessionStorage.setItem(SESSION_PK_KEY, w.privateKey);
  return w;
}

export function clearStoredSessionWallet(): void {
  sessionStorage.removeItem(SESSION_PK_KEY);
}

export async function signRelayPayload(sessionWallet: Wallet, relayNonce: bigint, calls: PulseCall[]): Promise<string> {
  let encoded = '0x';
  for (const c of calls) {
    encoded += solidityPacked(['address', 'uint256', 'bytes'], [c.to, c.value, c.data]).slice(2);
  }
  const digest = keccak256(solidityPacked(['uint256', 'bytes'], [relayNonce, encoded]));
  return sessionWallet.signMessage(getBytes(digest));
}

function implAddressOrThrow(): string {
  const a = import.meta.env.VITE_PULSE7702_IMPLEMENTATION as string | undefined;
  if (!a || !/^0x[a-fA-F0-9]{40}$/.test(a)) {
    throw new Error(
      'Defina VITE_PULSE7702_IMPLEMENTATION com o endereço do contrato Pulse7702Session deployado na Monad Testnet.'
    );
  }
  return a.toLowerCase();
}

/** One type-4 tx: EIP-7702 delegate + register session signer (wallet pop-up). */
export async function delegateAndRegisterSession(
  signer: JsonRpcSigner,
  provider: BrowserProvider,
  ethereum: { request: (args: { method: string; params?: unknown[] }) => Promise<unknown> }
): Promise<{ sessionWallet: Wallet; txHash: string }> {
  const impl = implAddressOrThrow();
  const userAddr = (await signer.getAddress()).toLowerCase();
  const sessionWallet = getStoredSessionWallet() ?? createStoredSessionWallet();

  const i = new Interface(PULSE7702_SESSION_ABI);
  const setData = i.encodeFunctionData('setSessionSigner', [sessionWallet.address]);

  const calls: PulseCall[] = [{ to: userAddr, value: 0n, data: setData }];

  const nonce = await provider.getTransactionCount(userAddr, 'pending');
  const auth = await signAuthorizationFromBrowser(ethereum, {
    address: impl,
    chainId: (await provider.getNetwork()).chainId,
    nonce: BigInt(nonce) + 1n,
  });

  const delegated = new Contract(userAddr, PULSE7702_SESSION_ABI, signer);
  const tx = await delegated.execute(
    calls.map(c => [c.to, c.value, c.data]),
    { type: 4, authorizationList: [auth] }
  );
  const receipt = await tx.wait();
  return { sessionWallet, txHash: receipt?.hash ?? tx.hash };
}

export async function fetchRelayNonce(provider: BrowserProvider, userAddress: string): Promise<bigint> {
  const c = new Contract(userAddress, PULSE7702_SESSION_ABI, provider);
  return (await c.relayNonce()) as bigint;
}

export async function fetchSessionSignerOnChain(
  provider: BrowserProvider,
  userAddress: string
): Promise<string | null> {
  const c = new Contract(userAddress, PULSE7702_SESSION_ABI, provider);
  const addr = (await c.sessionSigner()) as string;
  if (!addr || addr === '0x0000000000000000000000000000000000000000') return null;
  return addr.toLowerCase();
}

export async function isDelegatedToOurImpl(
  provider: BrowserProvider,
  userAddress: string
): Promise<boolean> {
  const impl = import.meta.env.VITE_PULSE7702_IMPLEMENTATION as string | undefined;
  if (!impl) return false;
  const del = await readDelegatedImplementation(provider, userAddress);
  return del === impl.toLowerCase();
}
