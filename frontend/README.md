# Monad Social — frontend (Vite + React)

## Environment

| Variable | Purpose |
|----------|---------|
| `VITE_POSTS_CONTRACT_ADDRESS` | Deployed `Posts` — required for on-chain pulses from the composer. |
| `VITE_INTERACTIONS_CONTRACT_ADDRESS` | Deployed `Interactions` — likes/comments use the **on-chain post id** from `Posts`. |
| `VITE_SOCIAL_GRAPH_CONTRACT_ADDRESS` | Deployed `SocialGraph` — follow/unfollow when the post has `authorAddress`. |
| `VITE_MONAD_RPC_URL` | Optional RPC override for reads (defaults to public testnet RPC). |
| `VITE_HASURA_GRAPHQL_URL` | Hasura endpoint (`…/v1/graphql`). **Dev:** leave unset to use the Vite proxy at `/hasura/v1/graphql` (see `vite.config.ts`). |
| `VITE_HASURA_ADMIN_SECRET` | Optional; local Envio often allows **public** read access without this. |
| `VITE_PINATA_JWT` | **Pinata JWT** for browser IPFS uploads when the post includes photos (see below). |
| `VITE_IPFS_GATEWAY_URL` | Optional. Base URL to load `ipfs://` CIDs in the feed (default: `https://gateway.pinata.cloud/ipfs/`). |

Copy **`frontend/.env.example`** → **`.env`** and fill addresses from **`../contracts/.env`** after deploy.

### IPFS images (Pinata)

1. Create a free **[Pinata](https://pinata.cloud)** account.
2. **API Keys** → **New Key** → enable permissions for **pinning** / **pinFileToIPFS** (file upload).
3. Copy the **JWT** into **`VITE_PINATA_JWT`** in `frontend/.env` (this is the credential you were asking about — Pinata uses a JWT instead of a separate “API key + secret” pair in the new flow).
4. Restart `npm run dev`. Publishing a post **with photos** uploads each image to IPFS first, then stores the **CIDs** inside the on-chain JSON `contentURI`. The feed resolves them via **`VITE_IPFS_GATEWAY_URL`** so images display on the site.

**Security:** `VITE_*` values are embedded in the frontend bundle. Use a **restricted** Pinata key (pin-only). For production, prefer a small backend that pins server-side.

**CORS:** If the browser blocks requests to `api.pinata.cloud`, add a dev proxy or use Pinata’s recommended [signed JWT / gateway patterns](https://docs.pinata.cloud/).

### Indexer-powered feed

The feed **does not** use mock posts. It loads **`Post`** rows from your **Envio + Hasura** GraphQL API (same as `indexer/README.md`).

1. Run the indexer locally: `cd indexer && npm run dev` (Hasura on **8080** by default).
2. Run the frontend: `cd frontend && npm run dev` (defaults to **5173**; `/hasura` is proxied to Hasura so the browser avoids CORS).
3. Production / custom hosts: set **`VITE_HASURA_GRAPHQL_URL`** to the full `https://…/v1/graphql` URL (and fix CORS on Hasura if needed).

## Wallet connection

- **Standard EIP-1193 login** (`window.ethereum`): request accounts, switch/add **Monad Testnet (10143)**, then you’re connected.
- **On-chain actions** (post, like, comment, follow) each send a **normal contract transaction** — your wallet prompts every time.
- No EIP-7702, relayer, or session keys in this UI.

## On-chain pulses

1. Set contract env vars above.
2. Publish from the composer — confirms `Posts.createPost` in the wallet.
3. Likes/comments use `Interactions` with `onChainPostId`; follow uses `SocialGraph` for `authorAddress` on posts you created from the wallet.

## Run

```bash
npm install
cp .env.example .env   # first time
npm run dev
```

## Optional: Pulse7702Session (contracts only)

The repo still includes **`../contracts/src/Pulse7702Session.sol`** for EIP-7702 experiments, but **this frontend no longer uses it**. Deploy it only if you build a separate flow or relayer.
