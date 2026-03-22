import type { BrowserProvider } from 'ethers';

export const MONAD_TESTNET_CHAIN_ID = 10143;
export const MONAD_TESTNET_HEX = '0x' + MONAD_TESTNET_CHAIN_ID.toString(16);

export const MONAD_TESTNET = {
  chainId: MONAD_TESTNET_HEX,
  chainName: 'Monad Testnet',
  nativeCurrency: { name: 'MON', symbol: 'MON', decimals: 18 },
  rpcUrls: [import.meta.env.VITE_MONAD_RPC_URL || 'https://testnet-rpc.monad.xyz'],
  blockExplorerUrls: ['https://testnet.monadvision.com'],
} as const;

export async function ensureMonadTestnet(ethereum: {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
}): Promise<void> {
  try {
    await ethereum.request({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: MONAD_TESTNET_HEX }],
    });
  } catch (e: unknown) {
    const code = (e as { code?: number })?.code;
    if (code === 4902) {
      await ethereum.request({
        method: 'wallet_addEthereumChain',
        params: [
          {
            chainId: MONAD_TESTNET_HEX,
            chainName: MONAD_TESTNET.chainName,
            nativeCurrency: MONAD_TESTNET.nativeCurrency,
            rpcUrls: [...MONAD_TESTNET.rpcUrls],
            blockExplorerUrls: [...MONAD_TESTNET.blockExplorerUrls],
          },
        ],
      });
      return;
    }
    throw e;
  }
}

export async function readDelegatedImplementation(
  provider: BrowserProvider,
  eoa: string
): Promise<string | null> {
  const code = await provider.getCode(eoa);
  if (!code || code === '0x') return null;
  if (!code.startsWith('0xef0100')) return null;
  return ('0x' + code.slice(8)).toLowerCase();
}
