#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/.."

if [ -f .env ]; then
  set -a
  # Arquivo local gerenciado pelo dono do aparelho; não use .env de terceiros.
  source .env
  set +a
fi

export HOST=127.0.0.1
export PORT="${PORT:-4173}"
export PROJECTS_DIR="${PROJECTS_DIR:-$HOME/projects}"
mkdir -p "$PROJECTS_DIR" "$HOME/.cache/termux-studio"

if ! command -v code-server >/dev/null; then
  echo 'code-server não instalado. Execute bash scripts/install-debian.sh.' >&2
  exit 1
fi
if [ ! -f dist/index.html ]; then
  echo 'Painel não compilado. Execute npm install && npm run build.' >&2
  exit 1
fi

if ! curl -fsS --max-time 2 http://127.0.0.1:8080/healthz >/dev/null 2>&1; then
  echo 'Inicializando code-server em 127.0.0.1:8080...'
  nohup code-server --bind-addr 127.0.0.1:8080 --auth password "$PROJECTS_DIR" \
    > "$HOME/.cache/termux-studio/code-server.log" 2>&1 < /dev/null &
fi

echo 'Painel React: http://127.0.0.1:4173'
echo 'Editor: http://127.0.0.1:8080'
echo 'Para acesso externo, use Cloudflare Tunnel + Access para os dois serviços.'
node server/index.mjs
