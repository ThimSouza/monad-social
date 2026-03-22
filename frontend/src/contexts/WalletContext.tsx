import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { BrowserProvider, JsonRpcSigner, type Eip1193Provider } from 'ethers';
import { ensureMonadTestnet, MONAD_TESTNET_CHAIN_ID } from '@/lib/monadChain';

interface WalletContextType {
  address: string | null;
  isConnected: boolean;
  isConnecting: boolean;
  connect: () => Promise<void>;
  disconnect: () => void;
  shortAddress: string;
  provider: BrowserProvider | null;
  signer: JsonRpcSigner | null;
  chainId: number | null;
  isMonadTestnet: boolean;
  switchToMonadTestnet: () => Promise<void>;
}

const WalletContext = createContext<WalletContextType>({
  address: null,
  isConnected: false,
  isConnecting: false,
  connect: async () => {},
  disconnect: () => {},
  shortAddress: '',
  provider: null,
  signer: null,
  chainId: null,
  isMonadTestnet: false,
  switchToMonadTestnet: async () => {},
});

export const useWallet = () => useContext(WalletContext);

export const WalletProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [address, setAddress] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [provider, setProvider] = useState<BrowserProvider | null>(null);
  const [signer, setSigner] = useState<JsonRpcSigner | null>(null);
  const [chainId, setChainId] = useState<number | null>(null);

  const shortAddress = address ? `${address.slice(0, 6)}...${address.slice(-4)}` : '';
  const isMonadTestnet = chainId === MONAD_TESTNET_CHAIN_ID;

  const refreshChain = useCallback(async (bp: BrowserProvider) => {
    try {
      const net = await bp.getNetwork();
      setChainId(Number(net.chainId));
    } catch {
      setChainId(null);
    }
  }, []);

  useEffect(() => {
    if (!provider) return;
    const onChain = () => {
      refreshChain(provider);
    };
    if ((provider as unknown as { on?: (e: string, fn: () => void) => void }).on) {
      (provider as unknown as { on: (e: string, fn: () => void) => void }).on('chainChanged', onChain);
    }
    return () => {
      if ((provider as unknown as { removeListener?: (e: string, fn: () => void) => void }).removeListener) {
        (provider as unknown as { removeListener: (e: string, fn: () => void) => void }).removeListener(
          'chainChanged',
          onChain
        );
      }
    };
  }, [provider, refreshChain]);

  const switchToMonadTestnet = useCallback(async () => {
    const eth = (typeof window !== 'undefined' ? (window as unknown as { ethereum?: unknown }).ethereum : null) as
      | { request: (args: { method: string; params?: unknown[] }) => Promise<unknown> }
      | undefined;
    if (!eth) throw new Error('Carteira não encontrada');
    await ensureMonadTestnet(eth);
    if (provider) await refreshChain(provider);
  }, [provider, refreshChain]);

  const connect = useCallback(async () => {
    setIsConnecting(true);
    try {
      if (typeof window !== 'undefined' && (window as unknown as { ethereum?: unknown }).ethereum) {
        const eth = (window as unknown as { ethereum: Eip1193Provider }).ethereum;
        const bp = new BrowserProvider(eth);
        const accounts = await bp.send('eth_requestAccounts', []);
        if (accounts[0]) {
          setAddress(accounts[0]);
          const sig = await bp.getSigner();
          setSigner(sig);
          setProvider(bp);
          await refreshChain(bp);
        }
      } else {
        await new Promise(r => setTimeout(r, 800));
        setAddress('0x742d35Cc6634C0532925a3b844Bc9e7595f2bD38');
        setProvider(null);
        setSigner(null);
        setChainId(null);
      }
    } catch {
      await new Promise(r => setTimeout(r, 800));
      setAddress('0x742d35Cc6634C0532925a3b844Bc9e7595f2bD38');
      setProvider(null);
      setSigner(null);
      setChainId(null);
    } finally {
      setIsConnecting(false);
    }
  }, [refreshChain]);

  const disconnect = useCallback(() => {
    setAddress(null);
    setProvider(null);
    setSigner(null);
    setChainId(null);
  }, []);

  return (
    <WalletContext.Provider
      value={{
        address,
        isConnected: !!address,
        isConnecting,
        connect,
        disconnect,
        shortAddress,
        provider,
        signer,
        chainId,
        isMonadTestnet,
        switchToMonadTestnet,
      }}
    >
      {children}
    </WalletContext.Provider>
  );
};
