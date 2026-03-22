/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_PULSE7702_IMPLEMENTATION?: string;
  readonly VITE_RELAYER_URL?: string;
  readonly VITE_MONAD_RPC_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
