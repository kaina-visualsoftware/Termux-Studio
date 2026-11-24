# Roadmap — Termux Studio

| Etapa | Escopo | Estado |
| --- | --- | --- |
| F0 | Arquitetura React + Node + code-server; modelo de segurança | Especificado |
| F1 | Dashboard React, API local de leitura, lista de projetos, abertura do editor | Código criado; teste real no ARM64 pendente |
| F2 | Instalação no Debian PRoot, compilação React e confirmação de login no code-server | Pendente |
| F3 | GitHub Pages e conexão remota via Cloudflare Tunnel + Access | Frontend/API e instruções criados; configuração e testes reais pendentes |
| F4 | Persistência controlada no Android/Termux e recuperação após suspensão | Pendente |
| F5 | Integração de IA: MCP local, futuro conector remoto autenticado e auditoria | MCP stdio local preparado; remoto e homologação pendentes |

## Critérios de homologação F2

- `bash scripts/check-debian.sh` detecta ARM64, Node e code-server.
- `npm test` e `npm run build` funcionam no Debian real.
- `http://127.0.0.1:8080` exige senha; nunca fica com autenticação desativada.
- Dashboard lista apenas diretórios permitidos e abre o workspace esperado.

## Critérios de homologação F3

- Acesso via dados móveis, fora da rede local.
- Cloudflare Access nega sessões não autenticadas em **ambos os hostnames**.
- code-server exige senha separada e utiliza conexões WebSocket sem falhas.
- Portas locais não ficam diretamente acessíveis pela internet.
- Reinicialização, perda de rede e suspensão Android têm comportamento documentado.
