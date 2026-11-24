#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/.."

printf '\n=== Termux Studio: verificação local ===\n'
node --version
for script in scripts/*.sh; do bash -n "$script"; done
for module in server/*.mjs tests/*.mjs; do node --check "$module"; done
npm test
if [ -d node_modules ]; then
  npm run build
else
  printf '\nBuild React pendente: execute npm ci (se houver lockfile) ou npm install e rode npm run build.\n'
fi
