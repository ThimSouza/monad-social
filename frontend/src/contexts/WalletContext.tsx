import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import { BrowserProvider, JsonRpcSigner, type Eip1193Provider } from 'ethers';
import { ensureMonadTestnet, MONAD_TESTNET_CHAIN_ID } from '@/lib/monadChain';
import { getBrowserEthereum } from '@/lib/browserEthereum';
import { formatProviderError } from '@/lib/formatProviderError';

interface WalletContextType {
  address: string | null;
  /** True after accounts are authorized and the wallet is on Monad Testnet. */
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
  /** Last wallet connection failure (user reject, missing wallet, etc.). Cleared on success. */
  connectionError: string | null;
  clearConnectionError: () => void;
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
  connectionError: null,
  clearConnectionError: () => {},
});

export const useWallet = () => useContext(WalletContext);

function formatWalletError(err: unknown): string {
  return formatProviderError(err);
}

export const WalletProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [address, setAddress] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [provider, setProvider] = useState<BrowserProvider | null>(null);
  const [signer, setSigner] = useState<JsonRpcSigner | null>(null);
  const [chainId, setChainId] = useState<number | null>(null);
  const [connectionError, setConnectionError] = useState<string | null>(null);

  const rawEthereumRef = useRef<Eip1193Provider | null>(null);
  /** Serialize concurrent login attempts (silent reconnect vs Connect click). */
  const loginChainRef = useRef<Promise<void>>(Promise.resolve());

  const shortAddress = address ? `${address.slice(0, 6)}...${address.slice(-4)}` : '';
  const isMonadTestnet = chainId === MONAD_TESTNET_CHAIN_ID;
  const isConnected = !!(address && provider);

  const refreshChain = useCallback(async (bp: BrowserProvider) => {
    try {
      const net = await bp.getNetwork();
      setChainId(Number(net.chainId));
    } catch {
      setChainId(null);
    }
  }, []);

  const resetWalletSession = useCallback(() => {
    setAddress(null);
    setProvider(null);
    setSigner(null);
    setChainId(null);
    rawEthereumRef.current = null;
  }, []);

  const disconnect = useCallback(() => {
    resetWalletSession();
    setConnectionError(null);
  }, [resetWalletSession]);

  const clearConnectionError = useCallback(() => setConnectionError(null), []);

  /**
   * Standard login: injected provider → switch/add Monad Testnet → signer + provider.
   * Does not commit React state until chain id is 10143.
   */
  const establishSession = useCallback(
    async (eth: Eip1193Provider, accounts: string[]) => {
      const run = async () => {
        if (!accounts[0]) {
          throw new Error('Wallet returned no accounts.');
        }

        rawEthereumRef.current = eth;
        await ensureMonadTestnet(eth);

        const bp = new BrowserProvider(eth);
        const sig = await bp.getSigner();
        const signerAddr = (await sig.getAddress()).toLowerCase();
        if (signerAddr !== accounts[0].toLowerCase()) {
          throw new Error('Active wallet account does not match the authorized account.');
        }

        await refreshChain(bp);
        const nid = Number((await bp.getNetwork()).chainId);
        if (nid !== MONAD_TESTNET_CHAIN_ID) {
          throw new Error('Wallet must be on Monad Testnet (chain id 10143).');
        }

        setAddress(accounts[0]);
        setSigner(sig);
        setProvider(bp);
        setConnectionError(null);
      };

      const prev = loginChainRef.current;
      const next = prev.catch(() => {}).then(() => run());
      loginChainRef.current = next.catch(() => {});
      await next;
    },
    [refreshChain]
  );

  const connect = useCallback(async () => {
    setIsConnecting(true);
    setConnectionError(null);
    try {
      const eth = getBrowserEthereum();
      if (!eth) {
        const msg =
          'No browser wallet detected. Install MetaMask or Rabby, allow this site, and try again.';
        setConnectionError(msg);
        resetWalletSession();
        return;
      }
      const accounts = (await eth.request({ method: 'eth_requestAccounts' })) as string[];
      if (!accounts?.[0]) {
        const msg = 'Wallet returned no accounts.';
        setConnectionError(msg);
        resetWalletSession();
        return;
      }
      await establishSession(eth, accounts);
    } catch (e) {
      const msg = formatWalletError(e);
      setConnectionError(msg);
      resetWalletSession();
    } finally {
      setIsConnecting(false);
    }
  }, [establishSession, resetWalletSession]);

  /** Silent reconnect when the site reloads and the wallet already has a Monad account. */
  useEffect(() => {
    const eth = getBrowserEthereum();
    if (!eth) return;
    let cancelled = false;
    void (async () => {
      try {
        const accounts = (await eth.request({ method: 'eth_accounts' })) as string[];
        if (cancelled || !accounts?.[0]) return;
        await establishSession(eth, accounts);
      } catch {
        /* Wallet locked or user must click Connect */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [establishSession]);

  useEffect(() => {
    const eth = rawEthereumRef.current as
      | (Eip1193Provider & {
          on?: (e: string, fn: (...args: unknown[]) => void) => void;
          removeListener?: (e: string, fn: (...args: unknown[]) => void) => void;
        })
      | null;
    if (!eth?.on) return;

    const onChain = () => {
      void (async () => {
        if (!provider) return;
        await refreshChain(provider);
        try {
          const net = await provider.getNetwork();
          if (Number(net.chainId) !== MONAD_TESTNET_CHAIN_ID) {
            resetWalletSession();
            setConnectionError('Monad Testnet required — switch network and connect again.');
          }
        } catch {
          /* ignore */
        }
      })();
    };

    const onAccounts = (accs: unknown) => {
      const list = accs as string[] | undefined;
      if (!list?.length) {
        disconnect();
        return;
      }
      const injector = rawEthereumRef.current;
      if (!injector) return;
      setIsConnecting(true);
      void establishSession(injector, list)
        .catch(e => {
          resetWalletSession();
          setConnectionError(formatWalletError(e));
        })
        .finally(() => setIsConnecting(false));
    };

    eth.on('chainChanged', onChain);
    eth.on('accountsChanged', onAccounts);
    return () => {
      eth.removeListener?.('chainChanged', onChain);
      eth.removeListener?.('accountsChanged', onAccounts);
    };
  }, [provider, refreshChain, disconnect, establishSession, resetWalletSession]);

  const switchToMonadTestnet = useCallback(async () => {
    const eth = getBrowserEthereum() ?? rawEthereumRef.current;
    if (!eth) throw new Error('No browser wallet found. Install MetaMask, Rabby, or another EIP-1193 wallet.');
    await ensureMonadTestnet(eth);
    if (provider) await refreshChain(provider);
  }, [provider, refreshChain]);

  return (
    <WalletContext.Provider
      value={{
        address,
        isConnected,
        isConnecting,
        connect,
        disconnect,
        shortAddress,
        provider,
        signer,
        chainId,
        isMonadTestnet,
        switchToMonadTestnet,
        connectionError,
        clearConnectionError,
      }}
    >
      {children}
    </WalletContext.Provider>
  );
};
