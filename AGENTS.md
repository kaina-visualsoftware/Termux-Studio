# AGENTS.md — Termux Studio

## Meta do sistema
Fornecer acesso ao editor VS Code pelo navegador em um Debian ARM64 hospedado no Termux, por meio de um painel React e de um servidor de editor code-server. Priorizar simplicidade, configuração local, facilidade de instalação, segurança e desempenho em dispositivos móveis.

## Regras não negociáveis

1. **Não implementar um clone do VS Code**: aproveitar code-server; React é o dashboard.
2. **Nunca publicar terminal ou editor sem autenticação.** code-server exige senha; acesso externo exige HTTPS e uma política de identidade como Cloudflare Access. Não usar `--auth none`.
3. **Portas de origem sempre em loopback (`127.0.0.1`).** Um túnel com autenticação pode encaminhar a origem local.
4. **Compatibilidade primeiro com Debian 13 ARM64 no PRoot do Termux**, sem presumir systemd, Docker, root Android ou ferramentas do desktop.
5. Não rodar comandos arbitrários por API HTTP. O backend do dashboard somente consulta status e lista diretórios permitidos.
6. Não transmitir ou registrar senhas, tokens, chaves SSH, `.env`, diretórios ocultos ou dados sensíveis.
7. Não solicitar GitHub Actions; testar com Node no Debian/Termux quando possível.
8. Alterações relevantes exigem documentação, testes de segurança e validação do fluxo local e remoto antes de publicar.
9. Separar fases de planejamento, implementação e validação; não marcar etapas como testadas no Termux sem execução real.

## Comandos

```bash
npm test
npm install
npm run build
bash scripts/check-debian.sh
bash scripts/start-debian.sh
```

## Qualidade

- Validar entrada e URLs tanto no frontend quanto no backend.
- Não permitir path traversal, symlinks externos, acesso não autorizado ou proxies com destino arbitrário.
- Mensagens de erro claras e acessíveis; não colocar segredos em logs.
- Interface responsiva, foco visível, sem dependência de CDN para a operação do painel.
