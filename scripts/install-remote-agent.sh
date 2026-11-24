#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/.."
if ! command -v node >/dev/null; then
  echo 'Node.js >= 20 é necessário. Instale Node no Debian antes de continuar.' >&2
  exit 1
fi
if ! command -v npm >/dev/null; then
  echo 'npm não encontrado.' >&2; exit 1
fi
node -e 'const [major,minor]=process.versions.node.split(".").map(Number);if(major<20||(major===20&&minor<19)) process.exit(1)' || { echo 'Node >=20.19 exigido' >&2; exit 1; }
if [ ! -d node_modules/mqtt ]; then
  npm install --omit=dev --no-audit --no-fund
fi
if [ -f remote/.env.agent ]; then
  chmod 600 remote/.env.agent
  echo 'Identidade existente preservada. Verifique as credenciais antes de iniciar o agente.'
else
  echo 'Sem identidade configurada. Escolha UM dos métodos:'
  echo '  Pareamento: node remote/pair-agent.mjs https://pair.seudominio.com/v1/pair meu-dispositivo'
  echo '  Manual: cp remote/.env.agent.example remote/.env.agent && chmod 600 remote/.env.agent'
fi
printf 'Instalado. Para iniciar: bash scripts/start-remote-agent.sh\n'
