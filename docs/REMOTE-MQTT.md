# Termux Studio Remote — servidor próprio, sem cota mensal no aplicativo

## Objetivo e limites reais

O agente instalado no Debian/Termux estabelece conexão **de saída** MQTT sobre TLS até um broker auto-hospedado. Um gateway separado recebe requisições MCP por HTTP **apenas em 127.0.0.1**, valida a credencial e encaminha pelo MQTT ao agente. O agente trabalha somente em `PROJECTS_DIR`, responde pelo MQTT e registra um log de auditoria enxuto no stderr.

Não existe bloqueio mensal nem contabilização de créditos no código. Isso **não** significa recursos infinitos: servidor, tráfego, energia, conexão e acesso das plataformas de IA continuam sujeitos a custos e limites próprios. Há limites operacionais de tamanho de mensagem, simultaneidade e tempo de execução para proteger o dispositivo.

Nesta primeira versão, o transporte remoto funciona via MQTT com usuário/senha por dispositivo e ACLs do broker; o gateway aceita **Bearer token** de comprimento mínimo. **Esse Bearer NÃO é o fluxo OAuth 2.1 necessário para compatibilidade ampla com clientes MCP remotos (incluindo determinados fluxos do ChatGPT)**. O gateway precisa de camada OAuth compatível antes da homologação de clientes que o exigem. Não marque “conectado ao ChatGPT” até realmente cadastrar e testar a conexão.

## Componentes

- `remote/agent.mjs`: conecta-se à infraestrutura na inicialização, reinscreve no tópico em reconexões; nunca recebe portas de entrada.
- `remote/workspace.mjs`: lista projetos, lê arquivos de código, grava com permissão expressa, executa `npm test`, `npm run build`, `git status --short` sem invocar um shell genérico.
- `remote/gateway.mjs`: atende MCP JSON-RPC pelo loopback, autentica Bearer, correlaciona mensagens MQTT e devolve respostas com timeout.
- `remote/rpc.mjs`: espera correlação por ID e dispositivo, limita a 4 requisições simultâneas.
- `deploy/mosquitto`: exemplos de broker e ACL com TLS.

## Preparação do broker (VPS próprio)

1. Disponibilize um servidor sob seu controle, com hostname DNS `mqtt.example.com`, Mosquitto 2 e porta 8883/TCP.
2. Emita certificado TLS válido para o hostname e ajuste os caminhos de `deploy/mosquitto/mosquitto.conf.example`. Não libere o listener em 1883.
3. Crie o password file com `mosquitto_passwd -c /etc/mosquitto/termux-studio.passwd ts-gateway` e depois `mosquitto_passwd /etc/mosquitto/termux-studio.passwd meutermux01`. O nome do usuário do agente precisa ser exatamente o `DEVICE_ID`. **Nunca grave as senhas no repositório.**
4. Instale o ACL file de `deploy/mosquitto/termux-studio.acl.example`. Ele dá ao gateway permissão de enviar requests e receber responses, e ao agente somente seus tópicos vinculados ao username. Recarregue o serviço após atualizar ACLs e credenciais.
5. Faça testes de rejeição com credenciais erradas e usuário de outro dispositivo.

Usar senha+TLS com ACL por tópico é uma base. Para dispositivos administrados por várias pessoas, prefira certificados individuais e o plugin Dynamic Security com revogação.

## Debian no Termux: agente

```bash
# No Debian (dev-linux), com Git e Node >=20 disponíveis
git clone https://github.com/kaina-visualsoftware/Termux-Studio.git
cd Termux-Studio
bash scripts/install-remote-agent.sh
# Preencha remote/.env.agent com credenciais criadas no broker; chmod 600
bash scripts/start-remote-agent.sh
```

O comando do instalador prepara dependências, arquivo de configuração e permissões, **mas não gera credenciais mágicas**: o broker deve existir. O processo deve permanecer ativo por um supervisor apropriado ao Termux. Evite presumir systemd dentro do PRoot. Suspendê-lo ou desligar o celular interrompe a conexão.

**Princípio do menor privilégio:** início com `REMOTE_ALLOW_WRITE=0` e `REMOTE_ALLOW_EXECUTE=0`. Para aprovar escrita/testes de projetos controlados, configure `REMOTE_TRUSTED_PROJECTS=projetoA,projetoB` e habilite as duas opções separadamente. Scripts npm dos projetos podem executar código arbitrário sob a conta Debian; **somente marque como confiável um projeto cujo código você revisou**. Nenhuma API permite `bash -c` livre.

## Gateway MCP: VPS

```bash
npm install --omit=dev
cp remote/.env.gateway.example remote/.env.gateway
chmod 600 remote/.env.gateway
# configure credenciais do broker e token forte
bash scripts/start-remote-gateway.sh
```

O gateway atende **somente** `http://127.0.0.1:8787/mcp` e recusa qualquer Origin de navegador. Para atender um cliente remoto, publique-o atrás de reverse proxy com HTTPS; exija autenticação com OAuth 2.1 ou camada compatível e jamais exponha o broker ou `/mcp` sem TLS/autenticação. Um Bearer de desenvolvimento pode ser usado por clientes que aceitam token manual, não equivale a OAuth. Recomenda-se firewall, logs sem segredos, backups de configuração e rotação das senhas.

## Testes e verificação

```bash
npm test
node --test tests/remote.test.mjs
```

Antes de chamar essa fase de concluída, confirme numa VPS real e no Debian ARM64: conexão e reconexão MQTT, credenciais revogadas, isolamento de tópicos, autorização de projetos, tempos-limite, testes e builds, quedas de rede, e uma sessão MCP por HTTPS/OAuth. Teste também tentativas de leitura de `.env` e symlinks.

## Roadmap do modelo semelhante ao Desktop Commander

1. **MVP:** broker próprio, agente de saída MQTT, gateway RPC/MCP, acesso a arquivos/testes (código criado; execução real pendente).
2. Provisionamento fácil de dispositivo: login de administrador, código de pareamento de uso único, credenciais exclusivas e revogação pelo painel React.
3. OAuth 2.1 + suporte integral a versões atuais de Streamable HTTP, para conectar clientes MCP compatíveis.
4. Dashboard no GitHub Pages com status de dispositivos, aprovação por projeto e auditoria sem expor tokens.
5. Instalador guiado e supervisor confiável no Android/Termux, limites de tempo e recuperação após suspensão.
6. Homologação ponta a ponta com ChatGPT e outros clientes, conforme permissões de cada plataforma.

**Atenção:** um endpoint MCP acessível por qualquer IA depende de suporte e autorização da própria IA. Sem esse suporte, o fallback pode usar GitHub para transportar solicitações, independentemente da nossa cota de agente.
