#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/.."
if [ ! -f remote/.env.agent ]; then echo 'Execute primeiro scripts/install-remote-agent.sh' >&2; exit 1; fi
if [ "$(stat -c '%a' remote/.env.agent)" != '600' ]; then echo 'Execute chmod 600 remote/.env.agent' >&2; exit 1; fi
exec node --env-file=remote/.env.agent remote/agent.mjs
