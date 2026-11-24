#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/.."
if [ ! -f remote/.env.gateway ]; then echo 'Copie remote/.env.gateway.example como remote/.env.gateway' >&2; exit 1; fi
if [ "$(stat -c '%a' remote/.env.gateway)" != '600' ]; then echo 'Execute chmod 600 remote/.env.gateway' >&2; exit 1; fi
exec node --env-file=remote/.env.gateway remote/gateway.mjs
