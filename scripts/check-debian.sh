#!/usr/bin/env bash
set -uo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/.."

echo '=== Termux Studio: diagnóstico Debian ==='
echo "Sistema: $(uname -s) / $(uname -m)"

if command -v node >/dev/null 2>&1; then
  echo "Node: $(node --version)"
else
  echo 'Node: ausente'
fi
if command -v npm >/dev/null 2>&1; then
  echo "npm: $(npm --version)"
else
  echo 'npm: ausente'
fi
if command -v code-server >/dev/null 2>&1; then
  version="$(code-server --version 2>/dev/null | head -n 1)"
  echo "code-server: ${version:-falha ao consultar versão}"
else
  echo 'code-server: ausente'
fi

echo "Painel compilado: $([ -s dist/index.html ] && echo sim || echo nao)"
echo "Projetos: ${PROJECTS_DIR:-$HOME/projects}"

if command -v curl >/dev/null 2>&1 && curl -fsS --max-time 2 http://127.0.0.1:8080/healthz >/dev/null 2>&1; then
  echo 'Editor 8080: ONLINE (responde ao healthcheck; confirme autenticação separadamente)'
else
  echo 'Editor 8080: OFFLINE'
fi
if command -v curl >/dev/null 2>&1 && curl -fsS --max-time 2 http://127.0.0.1:4173/api/dashboard >/dev/null 2>&1; then
  echo 'Painel 4173: ONLINE'
else
  echo 'Painel 4173: OFFLINE'
fi
