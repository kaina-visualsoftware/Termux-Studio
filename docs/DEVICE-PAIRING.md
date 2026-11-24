# R3 — Pareamento de uso único (pré-produção)

**Estado:** código testado localmente. VPS, broker, domínio e dispositivo **não estão instalados**. O projeto não possui cota mensal de chamadas, mas infraestrutura de terceiros pode ter preços/limites.

## Arquitetura

1. O administrador cria primeiro uma conta MQTT específica no broker Mosquitto, com ACL por username e certificado TLS (`deploy/mosquitto`).
2. Um serviço separado de pareamento mantém temporariamente uma senha MQTT cifrada com AES-256-GCM e um hash SHA-256 do código de uso único. O código expira em no máximo 10 minutos, não pode ser resgatado duas vezes e não fica salvo em claro.
3. O Termux envia código + ID via **HTTPS** ao endereço `POST /v1/pair`. A resposta traz somente a credencial deste dispositivo. O cliente grava `remote/.env.agent` com permissão `0600`, sem permitir escrita/execução remota por padrão.
4. O agente inicia a conexão MQTT de saída. Não há porta de entrada no celular. O gateway MCP continua um processo **separado** e não está exposto automaticamente.

## 1. VPS e broker (administrador)

Instale e configure Mosquitto, domínio e certificados de confiança. Nunca use `mqtt://`, listener 1883 ou `allow_anonymous true`. Consulte `docs/REMOTE-MQTT.md`. Crie o usuário do dispositivo em `/etc/mosquitto/termux-studio.passwd` **interativamente**, sem usar a opção `-b`, que deixa a senha visível na linha de comando:

```bash
sudo mosquitto_passwd /etc/mosquitto/termux-studio.passwd meutermux01
```

Defina uma senha aleatória **com pelo menos 32 caracteres alfanuméricos**. Guarde-a em um gerenciador de segredos até o pareamento. Após a alteração, faça o Mosquitto recarregar a configuração e teste a autenticação/ACL da conta. A conta precisa ter **somente** os tópicos do dispositivo correspondente. A gestão automatizada de credenciais e a revogação ainda são trabalho futuro.

## 2. Serviço de pareamento no servidor

Crie `/etc/termux-studio/pairing.env` protegido com `chmod 600` a partir de `remote/.env.pairing.example` e gere `PAIRING_MASTER_KEY` com `openssl rand -hex 32`. O processo precisa ter acesso exclusivo ao diretório `PAIRING_DIR` (permissão `0700`). Configure `deploy/vps/pairing.service.example` e `deploy/vps/Caddyfile.example` adaptando usuário, diretórios, DNS e certificados HTTPS. Não exponha a porta 8790 na internet.

Para executar localmente na VPS sem systemd, use `bash scripts/start-pairing-server.sh`. O serviço só responde em `127.0.0.1:8790`; o proxy HTTPS faz a entrega ao dispositivo.

## 3. Administrador emite um código

Use as **mesmas** credenciais do usuário criado no Mosquitto. No terminal privado da VPS, execute:

```bash
set +o history
read -rs -p 'Senha MQTT do dispositivo: ' PAIRING_MQTT_PASSWORD; echo
export PAIRING_MQTT_PASSWORD
export PAIRING_MQTT_URL='mqtts://mqtt.example.com:8883'
# Carregue PAIRING_MASTER_KEY e PAIRING_DIR pelo ambiente protegido do administrador.
node remote/pairing-admin.mjs issue meutermux01
unset PAIRING_MQTT_PASSWORD
```

O comando imprime um código forte e o horário de expiração. Compartilhe o código apenas por canal privado com quem controla o Termux. Não o grave em repositório/issue/print público. O backend não gera usuários MQTT por conta própria e não precisa de privilégios sobre o arquivo de senhas do broker.

## 4. Termux (Debian 13)

```bash
cd ~/projects/Termux-Studio  # ajuste ao caminho real do projeto
bash scripts/install-remote-agent.sh
# O comando a seguir solicita o código temporário:
node remote/pair-agent.mjs https://pair.example.com/v1/pair meutermux01
bash scripts/start-remote-agent.sh
```

O instalador recusa sobrescrever uma configuração existente. Para trocar o dispositivo, primeiro pare o agente, revogue a conta MQTT anterior no servidor e guarde o backup fora do repositório. Não ative `REMOTE_ALLOW_WRITE` ou `REMOTE_ALLOW_EXECUTE` antes de revisar os projetos confiáveis.

## 5. Checagem de segurança e recuperação

- Testar código incorreto, expirado, repetido, alterado e dispositivo diferente.
- Certificar que a resposta ocorre com `Cache-Control: no-store` e sem credenciais em logs.
- Testar duas tentativas simultâneas: apenas uma pode funcionar.
- Verificar TLS válido; recusar redirecionamentos, HTTP e URL com credenciais.
- Para revogar um dispositivo, remover/desabilitar seu usuário MQTT no broker e reiniciar/recarregar a autenticação; revogar também sessões/tokens MCP relacionados.
- O gateway MCP da v0.3 tem Bearer estático; **não** está pronto para login OAuth de ChatGPT, Claude ou Gemini. A integração de clientes depende de autenticação e suporte de cada plataforma.

## Pendências de produção

Hospedar broker+HTTPS, instalar o agente no Debian ARM64, automatizar criação e revogação de usuário Mosquitto (sem vazamento de senha), implementar OAuth 2.1 para MCP, multi-dispositivo e homologar o percurso real com um cliente autorizado. Somente depois dessas etapas considerar a experiência equivalente à do Desktop Commander.
