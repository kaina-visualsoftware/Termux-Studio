# Etapa F2 — validação local e pendências

## Resultado em 24/11/2026

- **15 de 15 testes Node aprovados** no ambiente de desenvolvimento Linux x86-64 (Node 22).
- 12 testes de regras do backend já existentes.
- 3 testes novos exercitando um processo real do servidor HTTP: resposta do dashboard e headers, bloqueio de métodos/rotas, e arquivos estáticos inexistentes.
- Sintaxe dos módulos Node e dos scripts Bash verificada.
- O pacote React **não foi compilado** aqui: o registro npm não pôde ser alcançado. Não registrar build como aprovado.
- **Não houve execução em Debian 13 ARM64 / Termux**, instalação de code-server, Cloudflare Tunnel nem teste pelo celular.

## Como reproduzir em ambiente com npm acessível

```bash
git checkout feat/f2-backend-validation
npm install --no-audit --no-fund
bash scripts/verify-local.sh
```

Se a rede estiver disponível, o verificador executará também `npm run build` após encontrar `node_modules`.

## Próxima validação em Debian PRoot

1. Conferir arquitetura `aarch64`, Node >=20.19, npm e espaço disponível.
2. Executar `bash scripts/install-debian.sh` e verificar se `code-server` instala no dispositivo, sem presumir que toda dependência nativa funciona em PRoot.
3. Executar `bash scripts/verify-local.sh`, `bash scripts/start-debian.sh` e `bash scripts/check-debian.sh`.
4. Verificar que o editor exige senha; ambas as portas continuam em loopback.
5. Só na etapa F3 configurar dois hostnames no Cloudflare Tunnel, **ambos** protegidos pelo Cloudflare Access; confirmar que acesso anônimo é negado.

A F2 só poderá ser considerada concluída após build e teste no Debian ARM64 real. Não publicar os serviços sem autenticação.
