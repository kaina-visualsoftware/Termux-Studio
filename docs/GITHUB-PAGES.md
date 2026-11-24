# Termux Studio: GitHub Pages + Termux remoto

## Objetivo

O site estático fica em `https://kaina-visualsoftware.github.io/Termux-Studio/`.
A API de projetos e o code-server continuam no Debian/Termux e só podem ser alcançados via túnel autenticado. O site estático não fornece terminal nem arquivos por si só.

## Publicação sem GitHub Actions

Na máquina de desenvolvimento com npm e git autenticado:

```bash
npm install
bash scripts/publish-pages.sh
```

O script gera o build Vite com base `/Termux-Studio/` e publica o conteúdo no branch `gh-pages`. No GitHub, configure **Settings > Pages > Deploy from a branch > gh-pages > /(root)**. Não requer consumir a cota de GitHub Actions para compilar o React; a publicação do Pages pode manter processamento próprio do GitHub.

## Conectar ao Debian

1. Configure dois aplicativos Cloudflare Access autenticados, um para `api.seudominio.com` (backend 127.0.0.1:4173) e outro para `ide.seudominio.com` (code-server 127.0.0.1:8080).
2. Configure no `.env` do backend `ALLOWED_ORIGIN=https://kaina-visualsoftware.github.io` **sem barra final** e `EDITOR_PUBLIC_URL=https://ide.seudominio.com`.
3. Proteja o túnel com Access **antes** de publicar DNS. A API do Termux não implementa login próprio; CORS restringe apenas quais sites podem ler respostas no navegador, **não substitui autenticação**.
4. No GitHub Pages, abra Configurações, informe `https://api.seudominio.com` em **URL da API**, salve e clique **Entrar na API**. Informe também a URL HTTPS do editor.
5. Teste por dados móveis fora do Wi-Fi. Uma sessão anônima deve ser bloqueada por Access em ambos os hostnames.

### CORS e cookies

A interface faz apenas `GET /api/dashboard` com `credentials: include`; o backend só reflete a origem exata cadastrada. Configure também CORS no Cloudflare Access, incluindo `Access-Control-Allow-Origin` com origem exata e `Access-Control-Allow-Credentials: true`, conforme a documentação do fornecedor.

Em alguns navegadores, cookies de terceiros impedem a consulta API do GitHub Pages mesmo após login. Se acontecer, mantenha GitHub Pages como página de entrada e acesse a versão do painel hospedada no mesmo domínio da API (origem compartilhada) ou faça a integração por um backend-for-frontend protegido. **Não desative o Access para contornar esse problema.**

## Segurança

- Sem senhas, tokens ou credenciais no React ou nos arquivos públicos do repositório.
- Host Node e code-server apenas no loopback.
- CORS não impede clientes diretos ou curl; Access deve autenticar antes da origem.
- O VS Code deve continuar com autenticação por senha adicional.
- O celular precisa permanecer ligado, com serviço ativo e conexão à internet.
- Não há aplicação remota habilitada neste commit: precisa de configuração real no Cloudflare e testes no Debian ARM64.
