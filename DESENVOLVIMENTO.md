# Rodar o Café com Deus Shine na sua máquina

O objetivo deste documento é simples: **nenhum erro de build deve ser descoberto em
produção de novo.** O ciclo do Netlify é de ~1min16 por tentativa e queima um deploy;
o ciclo aqui é de segundos.

---

## 1. Uma vez só: preparar a máquina

**Node.js 20 ou mais novo** (o Netlify usa a 24). Confira com:

```bash
node -v
```

Se não tiver, instale de [nodejs.org](https://nodejs.org) — a versão LTS serve.

Depois, dentro da pasta do projeto:

```bash
npm install
```

---

## 2. Uma vez só: as variáveis de ambiente

O arquivo `.env.local` **nunca vai para o Git nem para nenhum zip** — ele é seu, local.
Use os mesmos valores que estão no Netlify, senão o ambiente local fala com um Supabase
diferente do de produção e você testa a coisa errada.

### Jeito recomendado: deixar a CLI do Netlify buscar

```bash
npm install -g netlify-cli
netlify link          # escolha o site cafecomdeuslagoinha
netlify dev           # sobe o Next.js já com as variáveis do site
```

`netlify dev` injeta as variáveis do painel automaticamente — você não copia chave
nenhuma à mão, e não corre o risco de o local ficar com uma chave velha (foi exatamente
isso que causou o "Forbidden use of secret API key in browser" em produção).

### Jeito manual

Crie `.env.local` na raiz com as cinco variáveis do painel do Netlify
(*Site configuration → Environment variables*):

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
GOOGLE_OAUTH_CLIENT_ID=
GOOGLE_OAUTH_CLIENT_SECRET=
GOOGLE_OAUTH_REFRESH_TOKEN=
```

As três do Google são opcionais: sem elas o app sobe normal e só o **Mural** avisa que
o envio não está configurado. As três primeiras são obrigatórias — a aplicação se recusa
a subir sem elas, de propósito (`lib/env.ts`).

---

## 3. O dia a dia

```bash
npm run dev
```

Abre em <http://localhost:3000>. A tela recarrega sozinha a cada arquivo salvo.

### Antes de qualquer deploy

```bash
npm run check
```

Roda o TypeScript e o ESLint. **É este comando que teria pego o erro que derrubou o
deploy da v43** (`readonly` num campo tipado como `Json`) — em uns 10 segundos, sem
gastar um deploy. O `npm run dev` sozinho **não** pega: o Turbopack compila sem checar
tipos, quem checa é o `next build`.

E antes de subir de verdade:

```bash
npm run build
```

É o mesmo comando que o Netlify roda. Se passar aqui, passa lá.

---

## 4. Sobre o banco de dados

**Atenção: o ambiente local aponta para o Supabase de PRODUÇÃO.** É o mesmo banco, os
mesmos dados. O que você criar, editar ou apagar testando na sua máquina acontece de
verdade.

Hoje isso é pouco arriscado (a tabela `participants` está zerada), mas deixa de ser no
instante em que a primeira participante real se cadastrar.

### Por que não um projeto Supabase separado para desenvolvimento

O plano gratuito permite 2 projetos ativos por organização, e os dois já estão em uso:
`cafe-com-deus-shine` e `GC Manager - Lagoinha Alphaville`. Um terceiro exigiria pausar
um deles (o GC Manager está em produção, de outra base de usuários) ou subir de plano.

### A saída, quando houver dado real: Supabase local

Precisa do [Docker Desktop](https://www.docker.com/products/docker-desktop/) instalado.

```bash
npm install -g supabase
supabase start
```

Ele sobe um Postgres na sua máquina e **aplica sozinho todas as migrations de
`supabase/migrations`** — o schema sai idêntico ao de produção, vazio. No fim ele
imprime a URL e as chaves locais; coloque essas três no `.env.local` no lugar das de
produção e você tem um ambiente isolado de verdade.

Para parar: `supabase stop`.

Vale o esforço no dia em que houver dado de gente de verdade no banco. Antes disso, o
ganho real está no passo 3 — que é onde os erros dos últimos deploys estavam.

---

## 5. O que não funciona igual no local

| | Local | Produção |
|---|---|---|
| Mural (Google Drive) | só com as três variáveis do Google no `.env.local` | configurado |
| Envio para o Drive | o `Origin` enviado ao Google vira `http://localhost:3000`, e é o que o navegador usa — funciona | domínio do site |
| Cookies de sessão | sem `secure` (é http) | com `secure` |
| `upgrade-insecure-requests` na CSP | desligado — em http ele derrubaria o ambiente | ligado |

---

## 6. Quando algo quebrar

- **"Configuração de ambiente inválida"** ao subir: falta variável no `.env.local`, ou
  uma delas está com a chave errada. A mensagem diz qual e onde pegar a certa.
- **Erro de tipo no `npm run check`**: é o mesmo erro que o Netlify daria, com o mesmo
  texto. Corrija antes de subir.
- **Mural diz que não foi configurado**: faltam as três variáveis do Google. Normal em
  desenvolvimento.
