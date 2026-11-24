# Programar com IA no Termux Studio

O editor **code-server** pode hospedar extensões de assistência de código compatíveis com Open VSX/ARM64. Para agentes que usam ferramentas MCP há uma ponte **local** `mcp/server.mjs` via **stdio**, sem porta HTTP e sem acesso remoto automático.

## MCP local (para cliente compatível instalado no Debian)

No cliente MCP que roda dentro do próprio Debian, configure aproximadamente:

```json
{
  "mcpServers": {
    "termux-studio": {
      "command": "node",
      "args": ["/root/Termux-Studio/mcp/server.mjs"],
      "env": {
        "PROJECTS_DIR": "/root/projects",
        "TERMUX_STUDIO_MCP_WRITE": "0"
      }
    }
  }
}
```

Ajuste os caminhos. O programa disponibiliza `list_projects` e `read_project_file`. Para permitir **gravações**, o usuário precisa trocar `TERMUX_STUDIO_MCP_WRITE` para `1` e reiniciar esse cliente local. A gravação só aceita arquivos de texto/código dentro de pastas de projetos; não acessa diretórios ocultos, segredos nem links simbólicos externos. Revise as alterações pelo Git antes de aprovar commits.

## Como a IA pode operar

- **Pelo navegador:** usar uma extensão IA compatível com code-server, configurada pelo usuário com seu provedor e permissões. Compatibilidade e limites dependem da extensão e do ARM64.
- **Em um agente local com MCP:** ler e editar projetos com as ferramentas locais acima. A instalação do cliente é uma etapa à parte.
- **Pelo ChatGPT nesta conversa:** só se houver um conector remoto compatível, autorizado e instalado ou por fluxo via GitHub. Este MCP stdio **não torna o ChatGPT remotamente conectado** por si só.

Não exponha `mcp/server.mjs` como HTTP nem crie um proxy público de comandos. Execução remota de testes e terminal exigirá um mecanismo separado de autorização e auditoria. O MCP local desta fase não executa comandos.
