#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/.."

require_build=0
case "${1:-}" in
  '') ;;
  --require-build) require_build=1 ;;
  *) echo 'Uso: bash scripts/verify-local.sh [--require-build]' >&2; exit 2 ;;
esac

printf '\n=== Termux Studio: verificação local ===\n'
node --version
for script in scripts/*.sh; do bash -n "$script"; done
for module in server/*.mjs tests/*.mjs; do node --check "$module"; done
npm test

if [ -d node_modules ]; then
  npm run build
  test -s dist/index.html || { echo 'Build não criou dist/index.html' >&2; exit 1; }
else
  printf '\nBuild React pendente: execute npm install e rode npm run build.\n'
  if [ "$require_build" -eq 1 ]; then
    echo 'Falha: build obrigatório não verificado (--require-build).' >&2
    exit 2
  fi
fi
