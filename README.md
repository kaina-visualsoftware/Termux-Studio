# Termux Studio — React + VS Code Online

Painel React/TypeScript para descobrir projetos e abrir cada diretório no **code-server** (VS Code pelo navegador), executado em um **Termux + Debian 13 (ARM64)**. O projeto não é uma cópia do VS Code: utiliza o code-server oficial e abre seus projetos reais.

## Funcionalidades da v0.1.0

- Interface React responsiva, com painel de status, busca de projetos e navegação.
- API Node HTTP sem dependências, servindo a aplicação compilada e enumerando **somente diretórios de primeiro nível** em `PROJECTS_DIR` (sem listar pastas ocultas ou symlinks).
- Status do code-server usando a rota local `/healthz`.
- Acesso direto à pasta pelo parâmetro `folder` suportado pelo code-server.
- Configuração de URL pública HTTPS do editor (por navegador); localmente aceita `127.0.0.1`.
- Processo Node escutando somente loopback; URL pública pode ser encaminhada por túnel autenticado.
- Scripts de instalação e execução no Debian; testes automatizados do backend.

## Arquitetura

```text
Navegador ─────── HTTPS + Cloudflare Access ─────── cloudflared
     │                                                      │
     ├─ https://hub.exemplo.com ──────────────────── 127.0.0.1:4173 ─ React + API Node
     │                                                      │
     └─ https://ide.exemplo.com ──────────────────── 127.0.0.1:8080 ─ code-server
                                                           │
                                                     ~/projects no Debian
```

**Atenção:** use Cloudflare **Access** para proteger as DUAS URLs antes de habilitar as rotas públicas. Um túnel sem uma política Access **não autentica o visitante**. Mantenha `code-server` com `--auth password` mesmo por trás do Access. Nunca exponha 8080/4173 diretamente na internet nem altere `HOST` para `0.0.0.0`.

## Pré-requisitos

- Android com Termux e Debian 13 via PRoot (`dev-linux` já configurado no seu ambiente).
- Arquitetura `aarch64` (ARM64); Node.js **20.19+** ou 22+; npm; `curl`.
- Rede durante a instalação dos pacotes. Android pode suspender aplicações em segundo plano; para uso contínuo, avalie as configurações de bateria do sistema e o `termux-wake-lock`. Isso não garante execução 24 horas.
- Não é necessário Docker, systemd nem GitHub Actions.

## Instalar no Debian 13

**1.** Copie ou extraia o ZIP dentro do filesystem do Debian, por exemplo `/root/termux-vscode-hub`, e abra o Debian:

```bash
dev-linux
cd /root/termux-vscode-hub
bash scripts/install-debian.sh
```

O instalador verifica a versão do Node, instala o `code-server` por meio do instalador oficial (caso necessário), cria a configuração `.env`, instala dependências React e compila a interface. O instalador do code-server pode apresentar particularidades do PRoot; acompanhe a saída e corrija dependências se necessário. **Não há garantia de que o script rode sem ajustes em todo aparelho.**

**2.** Revise `.env`:

```ini
HOST=127.0.0.1
PORT=4173
PROJECTS_DIR=/root/projects
EDITOR_PUBLIC_URL=http://127.0.0.1:8080
```

Use o diretório real onde estão os seus projetos no filesystem **do Debian**. Evite `/sdcard` para repositórios Git, como a documentação do code-server recomenda.

**3.** Inicie:

```bash
bash scripts/start-debian.sh
```

- Painel: `http://127.0.0.1:4173`
- Editor: `http://127.0.0.1:8080`

Na primeira inicialização, o code-server gera a senha padrão em `~/.config/code-server/config.yaml`. Troque-a por uma senha forte antes do acesso externo; nunca a envie em mensagens ou a salve neste repositório.

## Abrir o editor fora de casa (Internet, dados móveis)

Método recomendado: [Cloudflare Tunnel](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/) + [Cloudflare Access](https://developers.cloudflare.com/cloudflare-one/access-controls/applications/http-apps/self-hosted-public-app/). Requer conta Cloudflare e domínio sob seu controle. Não é necessário abrir portas no roteador.

1. Configure um túnel no painel Cloudflare Zero Trust, com um conector `cloudflared` rodando em uma máquina que consiga alcançar os dois serviços locais. Para o Termux, o conector deverá alcançar `127.0.0.1:4173` e `127.0.0.1:8080`. Escolha um método de instalação de `cloudflared` compatível com seu ARM64; PRoot pode exigir ajustes.
2. Publique dois hostnames: `hub.seudominio.com` → `http://127.0.0.1:4173`; `ide.seudominio.com` → `http://127.0.0.1:8080`.
3. **Antes de divulgar os hostnames, configure e teste Cloudflare Access com políticas `Allow` limitadas exclusivamente às suas contas** para ambas as aplicações. Idealmente ative a validação de tokens Access pelo túnel (Protect with Access). Verifique em navegador anônimo que visitantes não autenticados NÃO acessam nenhuma página.
4. Configure `EDITOR_PUBLIC_URL=https://ide.seudominio.com` no `.env` do painel e reinicie-o. Alternativamente, em **Configurações** da interface informe esse endereço e salve no navegador (sobrepõe `.env` naquele navegador).
5. Autentique-se pelo Cloudflare Access, depois pela senha do code-server. Não desligue as duas proteções.

Evite usar túneis temporários ou domínios públicos sem controle de acesso.

### Restrição importante sobre acesso ChatGPT

O React permite que **você** use o editor remoto por um navegador. Isso **não cria automaticamente um conector MCP para o ChatGPT**. Um serviço MCP autenticado e com ferramentas autorizadas seria uma etapa futura e separada.

## Executar durante desenvolvimento

Após `npm install`, inicie em terminais separados:

```bash
# Terminal A: API e dashboard compilado
npm run build && npm start
# Terminal B (opcional): Vite com HMR
npm run dev
```

O Vite escuta `127.0.0.1:5173` e encaminha `/api/*` ao serviço Node em `127.0.0.1:4173`.

## Diagnóstico

```bash
bash scripts/check-debian.sh
```

## Testes

```bash
npm test      # testes Node (não precisa npm install)
npm run build # compilação de React (requer npm install)
```

## Limitações

- O painel não oferece edição de código diretamente: ela ocorre no code-server aberto em outra aba.
- Não há provisionamento remoto, execução de comandos pelo painel ou gerenciador de usuários.
- O code-server e extensões ARM64 variam em compatibilidade; extensões com binários x86 podem falhar.
- Debian PRoot geralmente não dispõe de systemd, por isso os scripts usam processos no usuário.
- Não foi instalado nem verificado no seu Termux devido à limitação do Desktop Commander. Neste ambiente o registro npm não respondeu, de forma que a compilação React ainda precisa ser executada em um ambiente com rede; a sintaxe TSX foi validada e os testes Node passaram.

## Referências oficiais

- [code-server: instalação Linux/ARM64](https://coder.com/docs/code-server/install/)
- [code-server: instalação no Termux](https://coder.com/docs/code-server/termux/)
- [code-server: acesso seguro](https://coder.com/docs/code-server/guide/)
- [Cloudflare: aplicações self-hosted](https://developers.cloudflare.com/cloudflare-one/access-controls/applications/http-apps/self-hosted-public-app/)

## Termux Studio Remote (piloto auto-hospedado, sem cota mensal da aplicação)

Foi adicionada uma arquitetura de acesso remoto via **MQTT sobre TLS** e gateway **MCP**. O agente inicia uma conexão de saída, sem abrir porta no Android; o gateway autentica requisições e encaminha ao agente. Ferramentas previstas: `list_projects`, `read_file`, `write_file`, `run_tests`, `run_build`, `git_status`. Operações de escrita e execução exigem ativação explícita por projeto confiável.

Leia [docs/REMOTE-MQTT.md](docs/REMOTE-MQTT.md) para preparar o Mosquitto, configurar credenciais, instalar no Debian e validar. A infraestrutura de broker e OAuth precisa ser implantada e testada antes de disponibilizar acesso a IAs remotas. Não há limite de chamadas por mês no código, mas continuam existindo limites de capacidade/segurança e possíveis custos da infraestrutura e do provedor de IA.
