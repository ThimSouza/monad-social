# Monad Social — contracts

Solidity **0.8.28**, EVM **Prague** (Monad Pectra fork), Foundry.

## Build & test

```bash
forge build
forge test
```

## Deploy (Monad Testnet)

Load `PRIVATE_KEY` (hex with `0x` prefix) in `.env`, then:

```bash
source .env
forge script script/Deploy.s.sol:Deploy \
  --rpc-url https://testnet-rpc.monad.xyz \
  --broadcast \
  -vvvv
```

Copy the three deployed addresses from the output.

## Verify on MonadVision (Sourcify)

Per [Monad docs — Foundry verification](https://docs.monad.xyz/guides/verify-smart-contract/foundry) and [BlockVision — verify on Monad explorer](https://docs.blockvision.org/reference/verify-smart-contract-on-monad-explorer):

Always pass **`--rpc-url`** (BlockVision’s Foundry example). Use **`--verifier sourcify`** and a **trailing slash** on the Sourcify base URL.

**Important:** Do **not** put the Sourcify host under `[etherscan]` in `foundry.toml`. Foundry will call it like an Etherscan ABI API → HTML `Cannot GET /` and “host only” errors. See [BlockVision troubleshooting](https://docs.blockvision.org/reference/verify-smart-contract-on-monad-explorer).

```bash
# Posts (testnet)
forge verify-contract <POSTS_ADDRESS> src/Posts.sol:Posts \
  --rpc-url https://testnet-rpc.monad.xyz \
  --chain 10143 \
  --verifier sourcify \
  --verifier-url 'https://sourcify-api-monad.blockvision.org/' \
  --watch

# Interactions
forge verify-contract <INTERACTIONS_ADDRESS> src/Interactions.sol:Interactions \
  --rpc-url https://testnet-rpc.monad.xyz \
  --chain 10143 \
  --verifier sourcify \
  --verifier-url 'https://sourcify-api-monad.blockvision.org/' \
  --watch

# SocialGraph
forge verify-contract <SOCIAL_GRAPH_ADDRESS> src/SocialGraph.sol:SocialGraph \
  --rpc-url https://testnet-rpc.monad.xyz \
  --chain 10143 \
  --verifier sourcify \
  --verifier-url 'https://sourcify-api-monad.blockvision.org/' \
  --watch
```

If the CLI prints a warning but the explorer shows a green check, treat it as success (noted in Monad docs).

**Mainnet:** `--rpc-url https://rpc.monad.xyz`, `--chain 143`, same `--verifier-url`.

### Manual verification

- [Verify Contract — MonadVision](https://monadvision.com/verify-contract) (mainnet UI; use testnet explorer for chain 10143).

### Monadscan (Etherscan API)

You can also verify with Etherscan-style API + API key (see Monad docs for `forge verify-contract --verifier etherscan`).

## Reproducible compiler settings

`foundry.toml` sets:

- `solc_version = "0.8.28"`
- `evm_version = "prague"`
- `bytecode_hash = "ipfs"` (helps Sourcify match on-chain bytecode)
