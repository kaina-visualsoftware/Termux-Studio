# Roadmap — Termux Studio

| Etapa | Escopo | Estado |
| --- | --- | --- |
| F0 | Arquitetura React + Node + code-server; modelo de segurança | Especificado |
| F1 | Dashboard React, API local de leitura, lista de projetos, abertura do editor | Código criado; teste real no ARM64 pendente |
| F2 | Instalação no Debian PRoot, compilação React e confirmação de login no code-server | Pendente |
| F3 | Cloudflare Tunnel + Access, dois hostnames, testes remotos e de acesso negado | Pendente |
| F4 | Persistência controlada no Android/Termux e recuperação após suspensão | Pendente |
| F5 | Integração opcional com Termux Bridge / MCP autenticado, ferramentas específicas e auditáveis | Planejado, fora do MVP |

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

## Nova frente — Termux Studio Remote

| Marco | Escopo | Estado |
| --- | --- | --- |
| R0 | Protocolos MQTT+RPC, ACLs e política de acesso a workspaces | Implementado localmente; testes de unidade aprovados |
| R1 | Agente Debian ARM64 persistente + broker Mosquitto TLS real | Código preparado; implantação e testes reais pendentes |
| R2 | Gateway MCP HTTP com correlação por dispositivo e autenticação Bearer piloto | Código preparado; integração real pendente |
| R3 | OAuth 2.1, sessões MCP modernas, cadastro/revogação de dispositivos | Pendente |
| R4 | Painel React para pareamento, estados e autorizações | Pendente |
| R5 | Testes externos ponta a ponta com ChatGPT e outros clientes MCP | Pendente |

**Sem cota mensal artificial**, mas não sem limites de infraestrutura ou segurança. Não confundir testes de unidade locais com homologação real.
