#!/usr/bin/env bash
set -u
cd "$(dirname "${BASH_SOURCE[0]}")/.."
echo '=== Termux Studio: diagnóstico Debian ==='
echo "Sistema: $(uname -s) / $(uname -m)"
echo "Node: $(node --version 2>/dev/null || echo ausente)"
echo "npm: $(npm --version 2>/dev/null || echo ausente)"
echo "code-server: $(code-server --version 2>/dev/null | head -1 || echo ausente)"
echo "Painel compilado: $([ -f dist/index.html ] && echo sim || echo nao)"
echo "Projetos: ${PROJECTS_DIR:-$HOME/projects}"
if curl -fsS --max-time 2 http://127.0.0.1:8080/healthz >/dev/null 2>&1; then
  echo 'Editor 8080: ONLINE'
else
  echo 'Editor 8080: OFFLINE'
fi
if curl -fsS --max-time 2 http://127.0.0.1:4173/api/dashboard >/dev/null 2>&1; then
  echo 'Painel 4173: ONLINE'
else
  echo 'Painel 4173: OFFLINE'
fi
