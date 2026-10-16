# ⚡ Vendário PWA - Versão Otimizada para Cloudflare Pages

Esta pasta contém a aplicação PWA do **Vendário** preparada e otimizada especificamente para deploy no **Cloudflare Pages** (com tráfego/banda 100% gratuitos e ilimitados).

---

## 🛠️ O que foi adaptado para o Cloudflare Pages?

1. **Roteamento SPA sem erro 404 (`public/_redirects`):**
   - Regra `/* /index.html 200` adicionada para garantir que recarregar a página (F5) em rotas como `/carrinho`, `/pedidos`, `/perfil` funcione perfeitamente.

2. **Políticas de Cache e Segurança (`public/_headers`):**
   - `/static/*`: Cache longo e imutável de 1 ano (`max-age=31536000, immutable`).
   - `/service-worker.js`: `no-cache, no-store, must-revalidate` (para que novas versões do app cheguem imediatamente aos celulares dos clientes).
   - `/manifest.json` e `/index.html`: Sempre revalidados.
   - Cabeçalhos de segurança contra Clickjacking e MIME Sniffing (`X-Frame-Options`, `X-Content-Type-Options`).

3. **Resolução Inteligente de Domínio (`src/services/apiConfig.js`):**
   - Suporte nativo ao domínio padrão `*.pages.dev` do Cloudflare Pages.
   - O app reconhece que está na Cloudflare e redireciona chamadas de API diretamente para os servidores oficiais do Vendário (`https://dashboard.vendario.net` e `https://dashboard-vendario.web.app`), sem tentar rotas inexistentes.
   - Links de indicação e compartilhamento no WhatsApp continuam usando a URL oficial configurada.

---

## 🚀 Como Fazer o Deploy no Cloudflare Pages

### Opção A: Conectando com GitHub / GitLab (Recomendado)

1. No painel da **Cloudflare**, vá em **Workers & Pages** > **Create application** > **Pages** > **Connect to Git**.
2. Selecione o repositório do seu projeto.
3. Configure os parâmetros da build:
   - **Framework preset:** `Create React App`
   - **Build command:** `npm run build`
   - **Build output directory:** `build`
   - **Root directory:** `bigstore-pwa-cloudflare` (caso esteja no monorepo) ou `/` (se este diretório for um repositório isolado).
4. Adicione as variáveis de ambiente (veja abaixo).
5. Clique em **Save and Deploy**.

---

### Opção B: Deploy direto via Terminal (Wrangler CLI)

Caso prefira fazer o deploy direto do seu computador sem Git:

```powershell
# 1. Instale as dependências e faça o build
cd c:\Users\Cleideson\Work\vendario\bigstore-pwa-cloudflare
npm install
npm run build

# 2. Publique com o Wrangler (CLI oficial da Cloudflare)
npx wrangler pages deploy build --project-name=vendario-pwa
```

---

## 🔑 Variáveis de Ambiente (Environment Variables)

Configure no painel do Cloudflare Pages (**Settings** > **Environment variables**):

| Variável | Valor Padrão / Recomendado |
| :--- | :--- |
| `NODE_VERSION` | `20` ou `22` |
| `REACT_APP_FIREBASE_API_KEY` | `AIzaSyBxHhU7ibkto_1Eo1fv8PzhpbR_QGuBv40` |
| `REACT_APP_FIREBASE_AUTH_DOMAIN` | `vendario-50238.firebaseapp.com` |
| `REACT_APP_FIREBASE_PROJECT_ID` | `vendario-50238` |
| `REACT_APP_FIREBASE_STORAGE_BUCKET`| `vendario-50238.firebasestorage.app` |
| `REACT_APP_FIREBASE_MESSAGING_SENDER_ID` | `71791171183` |
| `REACT_APP_FIREBASE_APP_ID` | `1:71791171183:web:524ddef617e70c2d44df9a` |
| `REACT_APP_FIREBASE_DATABASE_URL`| `https://vendario-50238-default-rtdb.firebaseio.com` |
| `REACT_APP_API_URL` | `https://dashboard-vendario.web.app` |
| `GENERATE_SOURCEMAP` | `false` |

---

## ⚠️ Ponto Crítico de Configuração no Firebase

Após o primeiro deploy, a Cloudflare irá gerar uma URL para o seu app (ex: `https://vendario-pwa.pages.dev`).

1. Acesse o **Firebase Console** ([console.firebase.google.com](https://console.firebase.google.com)).
2. Vá em **Authentication** > aba **Settings** > seção **Authorized domains** (Domínios autorizados).
3. Clique em **Add domain** e adicione:
   - `vendario-pwa.pages.dev` (ou o nome do seu subdomínio na Cloudflare)
   - O seu domínio próprio se for usar um (ex: `mobile.vendario.net`).

> Se não adicionar este domínio, o Firebase Authentication bloqueará a autenticação de login e cadastro por motivo de segurança.
