import { useCallback, useEffect, useState } from 'react';
import { useWallet } from '@/contexts/WalletContext';
import {
  delegateAndRegisterSession,
  fetchRelayNonce,
  fetchSessionSignerOnChain,
  getStoredSessionWallet,
  isDelegatedToOurImpl,
  signRelayPayload,
  type PulseCall,
} from '@/lib/pulse7702Session';
import { relayExecute, serializeCalls } from '@/lib/relayerClient';

export function usePulse7702Session() {
  const { signer, provider, address, switchToMonadTestnet } = useWallet();
  const relayerUrl = import.meta.env.VITE_RELAYER_URL as string | undefined;
  const impl = import.meta.env.VITE_PULSE7702_IMPLEMENTATION as string | undefined;

  const [tick, setTick] = useState(0);
  const [busy, setBusy] = useState(false);
  const [delegated, setDelegated] = useState(false);
  const [sessionMatch, setSessionMatch] = useState(false);

  useEffect(() => {
    if (!provider || !address || !impl || impl === '0x0000000000000000000000000000000000000000') {
      setDelegated(false);
      setSessionMatch(false);
      return;
    }
    let cancelled = false;
    (async () => {
      const del = await isDelegatedToOurImpl(provider, address);
      const onChain = await fetchSessionSignerOnChain(provider, address);
      const local = getStoredSessionWallet();
      const match = !!(local && onChain === local.address.toLowerCase());
      if (!cancelled) {
        setDelegated(del);
        setSessionMatch(match);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [provider, address, impl, tick]);

  const canRelay =
    !!(relayerUrl && delegated && sessionMatch && address && impl && impl !== '0x0000000000000000000000000000000000000000');

  const setup7702Session = useCallback(async () => {
    if (!signer || !provider) throw new Error('Liga a carteira primeiro.');
    const eth = (typeof window !== 'undefined' ? (window as unknown as { ethereum?: unknown }).ethereum : null) as
      | { request: (args: { method: string; params?: unknown[] }) => Promise<unknown> }
      | undefined;
    if (!eth) throw new Error('Carteira browser em falta.');
    setBusy(true);
    try {
      await switchToMonadTestnet();
      await delegateAndRegisterSession(signer, provider, eth);
      setTick(t => t + 1);
    } finally {
      setBusy(false);
    }
  }, [signer, provider, switchToMonadTestnet]);

  const sendSilentRelay = useCallback(
    async (calls: PulseCall[]) => {
      if (!canRelay || !address || !provider || !relayerUrl) {
        throw new Error('Modo silencioso indisponível (delegação, sessão ou relayer).');
      }
      const sw = getStoredSessionWallet();
      if (!sw) throw new Error('Chave de sessão em falta — executa a configuração EIP-7702 outra vez.');
      const nonce = await fetchRelayNonce(provider, address);
      const sessionSig = await signRelayPayload(sw, nonce, calls);
      return relayExecute(relayerUrl, {
        userAddress: address,
        calls: serializeCalls(calls),
        sessionSig,
      });
    },
    [canRelay, address, provider, relayerUrl]
  );

  return {
    busy,
    delegated,
    sessionMatch,
    canRelay,
    relayerConfigured: !!relayerUrl,
    implConfigured: !!impl && impl !== '0x0000000000000000000000000000000000000000',
    setup7702Session,
    sendSilentRelay,
    refresh: () => setTick(t => t + 1),
  };
}
