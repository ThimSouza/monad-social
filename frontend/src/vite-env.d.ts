/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_HASURA_GRAPHQL_URL?: string;
  readonly VITE_HASURA_ADMIN_SECRET?: string;
  readonly VITE_PINATA_JWT?: string;
  readonly VITE_IPFS_GATEWAY_URL?: string;
  readonly VITE_MONAD_RPC_URL?: string;
  readonly VITE_POSTS_CONTRACT_ADDRESS?: string;
  readonly VITE_INTERACTIONS_CONTRACT_ADDRESS?: string;
  readonly VITE_SOCIAL_GRAPH_CONTRACT_ADDRESS?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
