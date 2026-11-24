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
node -e 'if (+process.versions.node.split(".")[0] < 20) process.exit(1)' || { echo 'Node >=20 exigido' >&2; exit 1; }
if [ ! -d node_modules/mqtt ]; then
  npm install --omit=dev --no-audit --no-fund
fi
if [ ! -f remote/.env.agent ]; then
  cp remote/.env.agent.example remote/.env.agent
  chmod 600 remote/.env.agent
  echo 'Preencha remote/.env.agent com suas credenciais de dispositivo geradas pelo broker.'
  echo 'Por segurança o instalador NÃO ativa acesso remoto até a configuração ser concluída.'
else
  chmod 600 remote/.env.agent
fi
printf 'Instalado. Para iniciar: bash scripts/start-remote-agent.sh\n'
