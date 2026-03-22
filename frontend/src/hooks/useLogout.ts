import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useWallet } from '@/contexts/WalletContext';

/** Clears wallet session and returns to the landing (login) screen. */
export function useLogout() {
  const navigate = useNavigate();
  const { disconnect } = useWallet();

  return useCallback(() => {
    disconnect();
    navigate('/', { replace: true });
  }, [disconnect, navigate]);
}
