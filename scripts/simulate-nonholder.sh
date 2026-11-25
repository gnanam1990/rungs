#!/usr/bin/env bash
# T-E03: a wallet without an Agent ID cannot open a line on mainnet. eth_call only: no transaction, no gas.
# Usage: RUNGS_POOL_ADDRESS=0x… BSC_RPC_URL=https://bsc-rpc.publicnode.com scripts/simulate-nonholder.sh
set -euo pipefail
: "${RUNGS_POOL_ADDRESS:?set RUNGS_POOL_ADDRESS}"
RPC="${BSC_RPC_URL:-https://bsc-rpc.publicnode.com}"
NON_HOLDER=0x000000000000000000000000000000000000dEaD
WANT=$(cast sig "NotAgentId()")
OUT=$(cast call --rpc-url "$RPC" --from "$NON_HOLDER" "$RUNGS_POOL_ADDRESS" "openLine()" 2>&1 || true)
if echo "$OUT" | grep -qi "$WANT\|NotAgentId"; then
  echo "T-E03 OK: openLine from a non-holder reverts NotAgentId ($WANT)"
else
  echo "T-E03 FAILED: expected NotAgentId ($WANT), got: $OUT" >&2
  exit 1
fi
