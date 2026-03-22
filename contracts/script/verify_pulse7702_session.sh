#!/usr/bin/env bash
# Verify Pulse7702Session on Monad Testnet (Sourcify / MonadVision).
# Set PULSE7702_SESSION_ADDRESS in contracts/.env (or export it), then:
#   cd contracts && chmod +x script/verify_pulse7702_session.sh && ./script/verify_pulse7702_session.sh

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

if [[ -f .env ]]; then
  # shellcheck disable=SC1091
  set -a && source .env && set +a
fi

: "${PULSE7702_SESSION_ADDRESS:?Set PULSE7702_SESSION_ADDRESS in .env or export it}"

exec forge verify-contract "$PULSE7702_SESSION_ADDRESS" src/Pulse7702Session.sol:Pulse7702Session \
  --rpc-url https://testnet-rpc.monad.xyz \
  --chain 10143 \
  --verifier sourcify \
  --verifier-url 'https://sourcify-api-monad.blockvision.org/' \
  --watch
