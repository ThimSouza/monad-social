# Monad Social — Envio HyperIndex

Indexes **Posts**, **Interactions**, and **SocialGraph** events on **Monad Testnet (10143)**.

## Prerequisites

- **Node.js ≥ 20** (recommended; some Envio deps warn on Node 18)
- **npm** (comes with Node)
- **Docker** running (Postgres + Hasura for local dev)

> Envio’s CLI may still use **pnpm** internally during `codegen` (it will install/use it if needed). Your day-to-day commands below stay **`npm`**.

## 1. Configure environment

```bash
cd indexer
cp .env.example .env
```

Edit `.env` and set (same addresses as in `contracts/.env`, but **names must use the `ENVIO_` prefix**):

| Variable | Source |
|----------|--------|
| `ENVIO_POSTS_ADDRESS` | `POSTS_ADDRESS` from contracts |
| `ENVIO_INTERACTIONS_ADDRESS` | `INTERACTIONS_ADDRESS` |
| `ENVIO_SOCIAL_GRAPH_ADDRESS` | `SOCIAL_GRAPH_ADDRESS` |
| `ENVIO_START_BLOCK` | Block where contracts were deployed (explorer or `cast receipt <tx>`). Use `0` only for a quick test (slow full scan). |

`config.yaml` reads these via `${ENVIO_...}`.

## 2. Install dependencies

```bash
npm install
```

This pulls the correct **native Envio binary** for your OS via `optionalDependencies` (`envio-linux-x64`, `envio-darwin-arm64`, etc.).

**`generated` is not an npm `file:` dependency** (that gets copied into `node_modules/.pnpm/…` without `*.res.js` and breaks the indexer). After install, **`postinstall` symlinks `node_modules/generated` → `../generated`**. If that ever looks wrong, run **`npm run link-generated`**. After the first `npm run codegen`, run **`npm install` once** (or `npm run link-generated`) so the symlink exists.

## 3. Generate code

After any change to `config.yaml`, `schema.graphql`, or `src/EventHandlers.ts`:

```bash
npm run codegen
```

## 4. Run the indexer (dev)

```bash
npm run dev
```

- Starts Docker services, syncs chain → DB, and opens the **Hasura** console.
- Default **admin secret** is often `testing` (see [Envio — Running locally](https://docs.envio.dev/docs/HyperIndex/running-locally)).

In Hasura → **Data**, explore entities: `Post`, `Like`, `Comment`, `Follow`, `Account`. After your `DemoInteractions` script, you should see new rows and updated counts.

### Visualize indexed data

| What | URL / action |
|------|----------------|
| **Hasura console** (browse tables, run GraphiQL) | [http://localhost:8080/console](http://localhost:8080/console) |
| **GraphQL API** (for apps / Altair / curl) | `http://localhost:8080/v1/graphql` |
| **Frontend (`../frontend`)** | With `npm run dev` on port **5173**, requests go to `/hasura/v1/graphql` (Vite proxy → this URL). Set `VITE_HASURA_GRAPHQL_URL` if you use another port or deploy remotely. |
| **Envio dev console** (project / sync status) | [https://envio.dev/console](https://envio.dev/console) |

1. Open **Hasura console** → sign in with admin secret **`testing`** (unless you changed it in Envio/Docker env).
2. **Data** → pick a table (`Post`, `Like`, `Comment`, `Follow`, `Account`) → **Browse rows**.
3. **API** → **GraphiQL**: open the **Documentation Explorer** (left panel) and expand `query_root` — Envio/Hasura may expose roots like `Post`, `Account`, `Like`, etc., with field names in **camelCase** or matching the DB (**snake_case**), depending on the metadata.

List available top-level queries (then pick a name from the response and build your query from the explorer):

```graphql
query Roots {
  __schema {
    queryType {
      fields {
        name
      }
    }
  }
}
```

From a terminal (lists root field names; then compose a query using GraphiQL’s explorer):

```bash
curl -s http://localhost:8080/v1/graphql \
  -H 'Content-Type: application/json' \
  -H 'x-hasura-admin-secret: testing' \
  --data '{"query":"query { __schema { queryType { fields { name } } } }"}' | jq .
```

For a custom UI later, point **Next.js + urql/Apollo** (or plain `fetch`) at `http://localhost:8080/v1/graphql` and use the same header (dev only) or [Hasura JWT / webhook auth](https://hasura.io/docs/latest/auth/authentication/index/) for production.

## 5. Stop and reset local stack

```bash
npx envio stop
```

## Troubleshooting

- **`Couldn't find envio binary`** — run `npm install` again so the matching `envio-*` optional package is present.
- **`Cannot find package 'generated'`** — run `npm run codegen`, then **`npm run link-generated`** (or `npm install`, which runs `postinstall`).
- **`Cannot find module './src/Handlers.res.js'`** (stack shows `node_modules/.pnpm/.../generated/`) — you’re resolving a **stale copy** of `generated`, not the real folder. Run **`npm run link-generated`** or **`rm -rf node_modules && npm install`** and check **`readlink -f node_modules/generated`** equals **`…/indexer/generated`**. This repo avoids `file:./generated` for that reason; use **`npm run link-generated`** after any tool that rewrote `node_modules`.
- **`The requested module 'generated' does not provide an export named 'Interactions'`** — Envio’s default `generated/index.js` uses `module.exports = { ...handlers }`. Node’s ESM loader does not treat spread properties as named exports, so `import { Interactions } from "generated"` fails. **`npm run codegen` already runs `scripts/fix-generated-cjs-exports.cjs` afterward** to patch the entry file. If you ran `envio codegen` directly, run `node scripts/fix-generated-cjs-exports.cjs` once, or use `npm run codegen` instead.
- **`null value in column "author_id" of relation "Comment"`** — HyperIndex maps GraphQL relations to SQL FK columns. In handlers, use **`author_id` / `post_id` / `user_id` / `follower_id` / `following_id`** in `context.*.set({...})`, not `author` / `post` / `user` / `follower` / `following`.
- **React “Invalid hook call” / `useState` of null (Ink TUI)** — often duplicate React copies between the app and `generated/node_modules`. Run with **`TUI_OFF=true npm run dev`** to use log mode instead of the terminal UI, or run `npm dedupe` / reinstall from a clean `node_modules`.
- **No events** — wrong addresses, wrong `ENVIO_START_BLOCK` (after your txs), or RPC issues. Set `ENVIO_START_BLOCK` near your deploy block and restart.

## References

- [HyperIndex configuration](https://docs.envio.dev/docs/HyperIndex/configuration-file)
- [Running the indexer locally](https://docs.envio.dev/docs/HyperIndex/running-locally)
