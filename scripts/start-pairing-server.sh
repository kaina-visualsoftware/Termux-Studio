#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/.."
if [ ! -f remote/.env.pairing ]; then echo 'Arquivo remote/.env.pairing ausente' >&2; exit 1; fi
if [ "$(stat -c '%a' remote/.env.pairing)" != 600 ]; then echo 'Execute chmod 600 remote/.env.pairing' >&2; exit 1; fi
exec node --env-file=remote/.env.pairing remote/pairing-server.mjs
