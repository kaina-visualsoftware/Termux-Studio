#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/.."

if ! command -v apt-get >/dev/null; then
  echo 'Execute este instalador dentro do Debian 13 (dev-linux), não no Termux nativo.' >&2
  exit 1
fi

if ! command -v node >/dev/null || ! command -v npm >/dev/null || ! command -v curl >/dev/null; then
  echo 'Instalando dependências de sistema (Debian)...'
  apt-get update
  apt-get install -y ca-certificates curl nodejs npm
fi

node -e "const v=process.versions.node.split('.').map(Number);if(v[0]<20||(v[0]===20&&v[1]<19)){console.error('Node >=20.19 necessário; atual: '+process.version);process.exit(1)}"

if ! command -v code-server >/dev/null; then
  echo 'Instalando code-server pelo script oficial (coder.com)...'
  tmpfile="$(mktemp)"
  trap 'rm -f "$tmpfile"' EXIT
  curl -fsSL https://code-server.dev/install.sh -o "$tmpfile"
  sh "$tmpfile"
fi

if [ ! -f .env ]; then
  cp .env.example .env
  sed -i "s|PROJECTS_DIR=/root/projects|PROJECTS_DIR=$HOME/projects|" .env
fi
mkdir -p "$HOME/projects"

npm install
npm run build

echo
echo 'Instalação preparada. Execute: bash scripts/start-debian.sh'
echo 'Senha do code-server: arquivo ~/.config/code-server/config.yaml após a primeira inicialização.'
