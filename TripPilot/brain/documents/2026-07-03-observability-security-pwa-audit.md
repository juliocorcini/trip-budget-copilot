# Auditoria Sênior — Observabilidade, Segurança, Conversor e Instalação PWA

> Last updated: 2026-07-03
> Tipo: **Relatório de investigação (diagnóstico + plano de aplicação). NENHUM código foi alterado.**
> Autor do pedido: Julio. Papel assumido: engenheiro de software sênior (arquitetura distribuída, observabilidade, SRE) + revisão de segurança + 2 bugs de campo.
> Escopo em UMA passada, num único documento (por pedido explícito: "fazer tudo em um grande documento antes… não parar por estar grande").

---

## 0. Como ler este documento

Este relatório reúne **quatro frentes** que você trouxe na mesma mensagem:

| Parte | Tema | Origem do pedido |
|------|------|------------------|
| **A** | Auditoria de **segurança** (checklist de 7 itens de pentest) | Sua lista "Rate limit ausente… SQLi/IDOR" |
| **B** | Bug de UI: **seletor de moeda saindo do viewport** no conversor | Relato de campo |
| **C** | **Instalação PWA**: "Adicionar à tela inicial" deveria já disparar a instalação | Relato de campo |
| **D** | Auditoria de **observabilidade / logging / diagnóstico de falhas** (o pedido central) | `brain/documents/sistemaDeLogs` |
| **E** | **Backlog priorizado** unificando A→D (P0–P3 + esforço Tier 3) | Consolidação |
| **F** | **Apêndice de evidências** (arquivos + linhas citadas) | Rastreabilidade |

### Política de verdade / confiança (regra `fact-verification`)

Cada achado carrega um selo:

- **VERIFICADO** — confirmado lendo o código do repositório (arquivo + linha citados).
- **ALTA/ MÉDIA CONFIANÇA** — inferência forte a partir de múltiplos pontos do código.
- **NÃO SE APLICA** — o item do checklist genérico **não existe** nesta arquitetura (e explico por quê, em vez de inventar uma vulnerabilidade).

> **Reenquadramento honesto e importante (VERIFICADO).** Vários itens da sua lista de segurança vêm de um pentest de **aplicação web com login/servidor/sessão** (rate-limit de login, enumeração de usuário por e-mail, JWT na URL, hash de senha na resposta). O TripPilot **não tem** contas de usuário no servidor, login, e-mail, senha nem JWT — é **local-first** (IndexedDB) com uma fina camada de borda em Cloudflare Worker que **só vê ciphertext** (DEC-206/207) e telemetria anônima (DEC-248/251). Então parte do checklist **não se aplica literalmente**; para cada um, mapeio o **análogo real** que existe aqui e digo se é risco de verdade. Isso é mais útil (e honesto) do que fingir que há um endpoint de login para "consertar".

### Stack real (para as recomendações baterem com a realidade — VERIFICADO)

- **Front:** React 19 + TypeScript + Vite, **PWA** com service worker escrito à mão (`public/sw.js`), hospedado no **Cloudflare Pages**.
- **Dados:** **IndexedDB via Dexie** (local-first, offline). Nada de banco no servidor como fonte de verdade.
- **Borda:** um **Cloudflare Worker** (`TripPilot/worker/src/index.ts`, 2.185 linhas) + **Durable Objects** (SyncRoom, Mailbox, ShareSignal, ShareStore, TelemetryStore) + **KV** + **R2**. Proxy de IA (Groq), share E2E, telemetria.
- **Nativo:** shell **Capacitor** (APK Android) + OTA (Capgo).

> Consequência para a Parte D: **Winston/Pino** (que você citou) são bibliotecas do **Node.js**. O Worker roda no runtime **workerd** (não Node por padrão) e o front roda no **browser** — em nenhum dos dois o Winston/Pino é a escolha idiomática. Eu **atendo a intenção** (logs estruturados + níveis + masking + correlação) com a ferramenta **certa para cada runtime** e explico o porquê na §D.6.

---

# PARTE A — Auditoria de Segurança

Resumo executivo: **2 itens são reais e valem correção imediata** (falta de headers de segurança → clickjacking; ausência de rate limit nos endpoints de IA/ingest). **4 itens não se aplicam** à arquitetura atual (login/JWT/enumeração/hash de senha) — explico o análogo. **SQLi está OK** (queries parametrizadas). **IDOR** é mitigado por design (capability URLs + bearer no admin), com **1 ressalva** (comparação de token não constante-no-tempo).

### Mapa rápido do seu checklist → realidade TripPilot

| # | Item do checklist | Aplica? | Veredito | Severidade |
|---|-------------------|---------|----------|------------|
| 1 | Rate limit ausente (brute force) | **Parcial → SIM** (nos endpoints de IA/ingest, não em login) | Real: sem limite por IP/instalação | **P1 (alto, custo/abuso)** |
| 2 | CORS refletindo Origin | **Não como descrito** | É `*` fixo (wildcard), não reflexão; sem cookies → risco baixo, mas dá pra endurecer | **P2** |
| 3 | PII/dado demais na resposta (até hash de senha) | **Não** (nunca há senha/hash aqui) | Respostas são ciphertext ou telemetria agregada; única exposição é **nome de exibição** no `/admin` (por decisão) | **P3 (revisar)** |
| 4 | JWT na URL / token vivo pós-logout | **Não** (não há JWT) | Análogo = **capability URL** do share (`/s/:id#key`) + **write-token**; revogação existe (DELETE) | **P2** |
| 5 | Enumeração de usuário | **Não** (não há login/e-mail) | Análogo = 404 vs 410 vs 200 em `/share/:id`, mas o id é UUID inguessável | **P3** |
| 6 | Clickjacking (falta header) | **SIM** | Real e fácil: não há `X-Frame-Options`/CSP `frame-ancestors` em lugar nenhum | **P1 (fácil)** |
| 7 | SQL Injection / IDOR (parada de linha) | **SIM avaliar** | **SQLi: OK** (parametrizado). **IDOR: OK por design**, com 1 ressalva (compare de token) | **P1 verificado** |

---

## A.1 — Rate limit ausente (VERIFICADO — aplica-se aos endpoints de borda)

**O que a sua lista diz:** "Rate limit ausente 5 de 5. Brute force de graça. → limite por IP + conta."

**O que existe de verdade no código:**

- Não há login/conta/senha para "brutar". O que **existe e é abusável** são os endpoints públicos do Worker: `POST /ocr`, `POST /unit-extract`, `POST /assistant`, `POST /transcribe`, `POST /t` (telemetria), `POST /e` (erros), `POST /share`, `POST /mailbox/:id`.
- **Nenhum** desses tem rate limit por IP ou por instalação. As únicas defesas presentes (VERIFICADO em `worker/src/index.ts`):
  - **Caps de tamanho/quantidade** por recurso: `MAILBOX_MAX_MESSAGES=40`, `SHARE_RESP_MAX_ITEMS=300`, `OCR_MAX_IMAGE_CHARS=9_000_000`, `ASSISTANT_MAX_TEXT_CHARS=2_000`, `TELEMETRY_MAX_BODY_BYTES=8000`.
  - **Repasse do 429 upstream do Groq** (`rateLimitBody()`), que só reage **depois** de gastar sua cota gratuita do Groq.

**Risco real (ALTA CONFIANÇA):** não é roubo de senha; é **abuso de custo e cota**. Um atacante (ou um bug de retry) pode:
1. Esvaziar sua cota gratuita do Groq (RPD 1000/2000 — os próprios limites estão no código, `GROQ_FREE_LIMITS`), deixando a IA fora do ar para usuários reais (DoS de cota).
2. Inflar a **duração de Durable Object** (já houve incidente de free-tier — ver report `2026-06-27-durable-objects-duration-fix.md`) martelando `/share`, `/mailbox`, `/t`.
3. Encher a tabela de telemetria/erros (mitigado por `ERRORS_TABLE_CAP=500` + `pruneErrors`, mas o **ingest** em si não é limitado).

**Aplicação recomendada:**

- **A.1.a (P1) — Rate limit por IP no Worker**, barato e sem estado externo pesado. Duas opções:
  - **Cloudflare WAF Rate Limiting Rules** (config no dashboard, custo zero de código): ex. "≤ 20 req/min por IP em `/ocr|/assistant|/transcribe`". É a opção mais robusta e recomendada.
  - **No código**, um **Durable Object "RateLimiter"** com janela deslizante (token bucket) chaveado por `CF-Connecting-IP` + `X-Install-Id`. Exemplo mínimo:

```ts
// worker/src/rate-limit.ts (NOVO — proposta)
const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 20;

export class RateLimiter {
  private hits: number[] = [];
  constructor(private state: DurableObjectState) {}
  async fetch(): Promise<Response> {
    const now = Date.now();
    this.hits = this.hits.filter((t) => now - t < WINDOW_MS);
    if (this.hits.length >= MAX_PER_WINDOW) {
      return Response.json({ error: 'rate_limited', retryAfterSec: 60 }, { status: 429 });
    }
    this.hits.push(now);
    await this.state.storage.setAlarm(now + WINDOW_MS); // auto-limpa
    return Response.json({ ok: true });
  }
}
// no fetch principal, antes de handleOcr/handleAssistant:
// const key = `${request.headers.get('CF-Connecting-IP')}:${installId}`;
// const rl = env.RATE_LIMITER.get(env.RATE_LIMITER.idFromName(key));
// if ((await rl.fetch('https://rl/hit')).status === 429) return json(rateLimitBody(fn, ...), 429);
```

- **A.1.b (P2) — Cost guard:** já existe telemetria de tokens (`recordAiUsage`); adicionar um **teto diário por instalação** (ex.: bloquear a partir de N chamadas/dia por `installId`) usando o mesmo `TelemetryStore`.
- **A.1.c (P3):** alerta de budget no dashboard Cloudflare (Groq/DO/R2) — a rede de segurança de custo.

---

## A.2 — CORS "refletindo Origin" (VERIFICADO — na verdade é wildcard)

**O que a sua lista diz:** "CORS refletindo Origin 4 de 5 → allowlist de origem."

**Realidade (VERIFICADO, `worker/src/index.ts` linha 86):**

```ts
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, X-Share-Token, Authorization, X-Install-Id',
};
```

Não há **reflexão do `Origin`** (o padrão perigoso é `res.setHeader('ACAO', req.headers.origin)` + `Allow-Credentials: true`, que permite cross-site autenticado). Aqui é **`*` fixo** e **não há cookies/credenciais** (o worker não usa `Set-Cookie`; auth do admin é `Authorization: Bearer` explícito, não ambiente). Ou seja, a classe de ataque CSRF-via-CORS **não se aplica**.

**Ressalva honesta (MÉDIA CONFIANÇA):** `*` está tecnicamente correto para uma API pública sem credenciais, mas:
- O endpoint **`/admin/*`** também herda `*`. Como ele exige `Authorization: Bearer <ADMIN_TOKEN>` e o token **não** é enviado automaticamente pelo browser, `*` não vaza dados sozinho. Ainda assim, **restringir CORS do `/admin` à origem do painel** é defesa em profundidade barata.

**Aplicação recomendada (P2):**
- Manter `*` nos endpoints públicos de IA/share.
- Para `/admin/*`, responder `Access-Control-Allow-Origin: https://trippilot.pages.dev` (allowlist), e nunca ligar `Allow-Credentials`.

---

## A.3 — "PII/dado demais na resposta (teve até hash de senha)" (NÃO SE APLICA + 1 nuance)

**Realidade (VERIFICADO):** não existe senha nem hash de senha em nenhuma resposta — não há autenticação por senha no servidor. O PIN de app-lock é **local**, guardado só como hash PBKDF2-SHA256 + salt no IndexedDB (`utils/app-lock.ts`), e **nunca** trafega. As respostas do Worker são:
- **Ciphertext** (share statement/responses, mailbox, imagens legadas) — o Worker não consegue ler (chave AES fica no fragmento da URL).
- **Telemetria agregada** no `/admin/*`.

**Única exposição de PII real (VERIFICADO, por decisão de produto):** o `/admin/installs` e `/admin/ai-usage` retornam `displayName` (nome humano do dono), `locale`, `country` (derivado do header CF), `platform`, `browser` e um `installId` pseudônimo. Isso é **intencional** (calibração do Julio em DEC-248: "nome humano é permitido; a linha vermelha é valor monetário"). O `/admin/*` é **gated por bearer token**, então não é exposição pública.

**Aplicação recomendada (P3 — revisão, não bug):**
- Confirmar que o `ADMIN_TOKEN` é forte e rotacionável (é secret do Worker — OK).
- Documentar no brain que `displayName + country` são o **teto** de PII exposta e que qualquer campo novo no `/admin` passa pela allowlist (o ingest já rejeita chave fora do allowlist — `TELEMETRY_COUNTERS`/`TELEMETRY_FLAGS`).
- Nenhuma resposta pública devolve conteúdo de transação (VERIFICADO no domínio `domain/telemetry`: "NEVER values, items, balances, place names, dates").

---

## A.4 — "JWT na URL / token vivo pós-logout" (NÃO SE APLICA como JWT; análogo = capability URL)

**Realidade (VERIFICADO):** não há JWT. O modelo de compartilhamento é **capability-based**:
- **`/s/:id#<AES-key>`** (share link, DEC-207) e **`/g/:id`** (group claim). O **id** é a capacidade de leitura; a **chave AES** vive só no **fragmento** (`#…`), que **não é enviado ao servidor** por design (fica no cliente). Isso é forte.
- **Write-token** do dono (`randomToken()` de 24 bytes) só circula como **hash SHA-256** no Durable Object (`ShareStore.verify`); a revogação existe: `DELETE /share/:id` → futuras leituras retornam **410**.

**Riscos reais desse modelo (MÉDIA CONFIANÇA):**
1. **Vazamento do link** (ele É a senha). Se o usuário cola o `/s/:id#key` num chat público, qualquer um lê. Mitigadores: TTL (90 dias, deslizante), revogação. Aceitável para o caso de uso, mas...
2. **Referrer leak (VERIFICADO — falta header):** não há **`Referrer-Policy`** em lugar nenhum (grep vazio). Se a página `/s/:id#key` carregar um recurso externo, o fragmento `#key` **não** vaza no Referer (fragmentos nunca vão no Referer), mas o **path `/s/:id`** pode vazar. Como o id sozinho não decripta nada, o risco é baixo — mas `Referrer-Policy: no-referrer` é higiene barata.
3. **"Token vivo pós-logout":** não há logout (local-first). O análogo é "revoguei o link e ele ainda lê?" — **não**: o DELETE marca `revoked` e serve 410 (VERIFICADO em `ShareStore.revoke`).

**Aplicação recomendada (P2):** adicionar `Referrer-Policy: strict-origin-when-cross-origin` (ou `no-referrer`) global no `_headers`, e reforçar no app o aviso "quem tiver este link vê seus dados" ao gerar o share.

---

## A.5 — Enumeração de usuário (NÃO SE APLICA; análogo mínimo)

**Realidade:** sem login/e-mail, não há "esse e-mail existe?". O análogo é a distinção de status em `/share/:id`: **404** (não existe) vs **410** (revogado) vs **200** (existe). Um atacante que adivinhasse ids poderia mapear estados — **mas os ids são UUID v4 inguessáveis** (`crypto.randomUUID()`), então enumeração é inviável na prática (VERIFICADO). **Sem ação** além de manter ids como UUID (nunca sequenciais).

---

## A.6 — Clickjacking / falta de header (VERIFICADO — REAL, P1, correção de 1 minuto)

**Realidade (VERIFICADO):** grep por `X-Frame-Options`, `Content-Security-Policy`, `frame-ancestors`, `Strict-Transport-Security`, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy` em **todo** o `TripPilot/` → **nenhuma ocorrência**. O único `public/_headers` só coloca CORS em `/version.json` e `/bundles/*`:

```
/version.json
  Access-Control-Allow-Origin: *
  Cache-Control: no-store
/bundles/*
  Access-Control-Allow-Origin: *
```

Ou seja, **todo o app** (incluindo as páginas de convidado `/s/:id` e `/g/:id`, que mostram saldos/dívidas) pode ser colocado num `<iframe>` de terceiro → **clickjacking possível**.

**Aplicação recomendada (P1 — a melhor relação esforço/valor do relatório):** acrescentar um bloco global no `public/_headers` do Cloudflare Pages. Proposta:

```
/*
  X-Frame-Options: DENY
  Content-Security-Policy: frame-ancestors 'none'
  X-Content-Type-Options: nosniff
  Referrer-Policy: strict-origin-when-cross-origin
  Permissions-Policy: geolocation=(self), microphone=(self), camera=(self)
  Strict-Transport-Security: max-age=31536000; includeSubDomains
```

> Cuidados de validação antes de aplicar (não aplicado agora):
> - `frame-ancestors 'none'`/`X-Frame-Options: DENY` **quebra** se algo legítimo embute o app num iframe (ex.: preview). Hoje não há esse uso → seguro.
> - Uma **CSP completa** (com `script-src`/`style-src`) precisa de teste porque o app injeta estilos via Tailwind/inline `style` e usa Google Fonts / Material Symbols; comece só com `frame-ancestors` (não quebra nada) e evolua a CSP num gate dedicado com testes.
> - `Permissions-Policy` deve liberar `geolocation`/`microphone`/`camera` para `self` (o app usa GPS, voz e câmera) — senão quebra funcionalidades.

---

## A.7 — SQL Injection & IDOR (VERIFICADO — "parada de linha", avaliados)

**SQL Injection: OK (VERIFICADO).** Todo acesso SQLite (no `TelemetryStore` Durable Object) usa **queries parametrizadas** com `?` e binda valores como argumentos — nunca concatena input do usuário na string SQL. Exemplos (VERIFICADO em `worker/src/index.ts`):

```ts
this.sql.exec(`DELETE FROM heartbeats WHERE install_id = ?`, id);
this.sql.exec(`INSERT INTO ai_usage (...) VALUES (?, ?, ?, ?, 1) ON CONFLICT(...) DO UPDATE ...`, installId, day, fn, tokens);
```

Os únicos trechos com SQL montado por template string são **nomes de coluna vindos de constantes internas** (`TELEMETRY_COUNTERS`/`TELEMETRY_FLAGS`), não de input — portanto não injetáveis. Além disso o ingest **valida com regex/allowlist** (`TELEMETRY_ID_RE`, `TELEMETRY_DAY_RE`, `bad_counter:<key>`). **Sem ação.**

**IDOR: OK por design, com 1 ressalva (VERIFICADO).**
- Acesso a recursos é **capability-based** (id UUID inguessável = a autorização). Não há "troque o id 123 pelo 124 e veja dados de outro" porque não há ids sequenciais nem objetos por-usuário adivinháveis.
- O `/admin/*` é **gated** por bearer token.
- **Ressalva (P2):** a comparação do token admin **não é constante no tempo**:

```ts
// worker/src/index.ts (handleAdmin)
if (!token || token !== env.ADMIN_TOKEN) return json({ error: 'unauthorized' }, 401);
```

`!==` sai no primeiro byte diferente → **timing side-channel** teórico para adivinhar o token byte a byte. O app já tem um comparador constante para o PIN (`timingSafeEqualHex` em `utils/app-lock.ts`); o mesmo padrão deve ser usado aqui.

**Aplicação recomendada (P2):** comparar o token admin em tempo constante:

```ts
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
// if (!token || !safeEqual(token, env.ADMIN_TOKEN)) return json({ error: 'unauthorized' }, 401);
```

---

# PARTE B — Bug: seletor de moeda saindo do viewport (Conversor)

**Selo:** VERIFICADO (root cause identificado no código). **Severidade: P1** (afeta uso real, fácil de corrigir).

**Arquivo:** `src/features/converter/ConverterPage.tsx`.

**Sintoma (seu relato):** "na página de conversão de moeda o campo de seleção de moeda está indo para fora do viewport".

**Root cause (VERIFICADO):** os dois `<select>` de moeda ficam dentro de um flexbox de 3 filhos (`from` | botão ⇄ | `to`):

```tsx
<div className="flex items-end gap-2">
  <div className="flex flex-1 flex-col gap-1.5"> ... <select className={selectClass}> ... </div>
  <button ...>⇄</button>
  <div className="flex flex-1 flex-col gap-1.5"> ... <select className={selectClass}> ... </div>
</div>
```

com

```tsx
const selectClass = 'flex-1 px-3 py-2.5 rounded-xl ... appearance-none text-center';
```

O problema é o comportamento padrão de flex item: **`min-width: auto`**. Um `<select>` tem largura **intrínseca baseada na opção selecionada mais longa**, e desde o DEC-423 as opções passaram a incluir o **nome localizado da moeda** via `Intl.DisplayNames` (ex.: `🇧🇷 BRL · real brasileiro`, `🇨🇭 CHF · franco suíço`). Como `min-width: auto` **impede o flex item de encolher abaixo do conteúdo**, o `<select>` (e o `<div class="flex-1">` que o envolve) **estoura** o container de 430px e empurra o layout para fora do viewport (aparece scroll horizontal / o segundo select some pela direita). É o clássico bug "flexbox não encolhe por causa de `min-width: auto`".

Contribuintes secundários:
- `text-center` + `appearance-none` num select nativo com texto longo não trunca — só transborda.
- O wrapper `.flex-1` também não tem `min-w-0`, então nem o wrapper nem o select podem encolher.

**Aplicação recomendada (fix cirúrgico — NÃO aplicado):**
1. Adicionar **`min-w-0`** ao `selectClass` e aos dois wrappers `.flex-1` (permite o flex item encolher abaixo do conteúdo intrínseco):

```tsx
// wrappers
<div className="flex flex-1 min-w-0 flex-col gap-1.5"> ... </div>
// selectClass
const selectClass =
  'flex-1 min-w-0 w-full px-3 py-2.5 rounded-xl text-sm font-semibold bg-surface-container text-on-surface outline-none appearance-none text-center';
```

2. (Opcional, robustez) encurtar o rótulo dentro do `<option>` quando o nome for muito longo, ou truncar via `text-overflow` — mas em `<option>` nativo o truncamento é limitado; o `min-w-0` já resolve o overflow do container.

**Verificação sugerida (quando for aplicar):** Playwright abrindo `/converter` em viewport 360×640 com `i18n` em pt/en/es, garantindo `document.documentElement.scrollWidth <= clientWidth` (sem scroll horizontal) e os dois selects visíveis.

---

# PARTE C — Instalação PWA: "Adicionar à tela inicial" deveria disparar a instalação

**Selo:** VERIFICADO (comportamento e causas identificados). **Severidade: P1** (é uma promessa de UX quebrada em parte dos casos).

**Seu relato:** "Instalar o atalho na tela inicial — para instalar, abra no Chrome ou Edge e use 'Adicionar à tela inicial'. Na web, quando clico nisso já deveria abrir para eu instalar o app, já deveria começar todo o processo de instalação do PWA."

**Como funciona hoje (VERIFICADO):**

1. No boot (`main.tsx`), `captureInstallPrompt()` registra listener de **`beforeinstallprompt`** e guarda o evento em `deferredInstallPrompt` (`utils/pwa.ts`).
2. `useInstallPrompt()` expõe `available = isInstallPromptAvailable() && !isStandaloneDisplayMode()`.
3. Em `InstallOptions.tsx`:
   - **Se `available === true`** → renderiza um **botão** "Instalar como app" que chama `install()` → `promptAppInstall()` → `deferredInstallPrompt.prompt()`. **Isso já dispara a instalação nativa.** ✅
   - **Se `available === false`** → renderiza um **`<div>` estático** (não clicável) com o texto `install.shortcut_cta` + `install.pwa_browser_hint` ("abra no Chrome/Edge e use Adicionar à tela inicial"). **É exatamente o que você viu** — um cartão de instruções que **não faz nada ao clicar**.

**Root cause (por que `available` é `false` mesmo em Chrome/Edge — MÉDIA/ALTA CONFIANÇA):** `beforeinstallprompt` é um evento **condicional e efêmero** do Chromium. Ele **não dispara** (logo o botão que instala com 1 toque não aparece) quando:
- O app **já foi instalado** uma vez (o Chrome não reoferece).
- Os **critérios de instalabilidade** não foram atendíssimos naquele carregamento (engajamento, manifmanifest, SW, https).
- O evento **disparou antes** do `captureInstallPrompt()` rodar (corrida de boot) — menos provável aqui porque a captura é no topo do `main.tsx`, mas possível em cold start lento.
- O navegador **não é Chromium** (Firefox/Safari nunca disparam) — aí realmente **não existe** API programática e o passo manual é inevitável.

Ou seja: **quando o navegador suporta, o app já instala com 1 toque; o cartão "estático" só aparece no fallback** — e o fallback está mudo, dando a impressão de que "clico e não acontece nada".

**O que dá pra melhorar (aplicações recomendadas — NÃO aplicado):**

- **C.1 (P1) — Fallback ativo, nunca mudo.** Transformar o `<div>` estático num **botão** que:
  - se `available` virou `true` no meio tempo, chama `install()`;
  - senão, **tenta forçar** um `reg.update()`/re-checagem e, se ainda assim não houver prompt, **abre um passo-a-passo visual** (o mesmo infográfico do iOS, mas para Android/desktop) explicando "Menu ⋮ → Instalar app / Adicionar à tela inicial", em vez de só um texto. Hoje o iOS já tem infográfico (`/guides/ios-install.png`); Android/desktop no fallback só têm texto.
- **C.2 (P2) — Reaproveitar melhor o evento.** `promptAppInstall()` já preserva o evento em `dismissed` (bom). Garantir que a captura cubra o caso "evento chegou antes do React montar" guardando-o num buffer de módulo (já é o caso) e **re-notificando** ao montar (o `subscribeInstallPromptAvailability` já cobre).
- **C.3 (P3) — Mensageria honesta por navegador.** Detectar `deviceBrowserFamily()` (já existe) e, no fallback, dizer a frase certa: Chrome/Edge Android → "toque em ⋮ e 'Instalar app'"; Firefox → "menu → Instalar"; Safari iOS → o infográfico (já existe). Evita mandar "abra no Chrome" para quem já está no Chrome.

> Limite honesto (VERIFICADO/ALTA CONFIANÇA): **não dá para "começar a instalação do PWA" por JavaScript sem o `beforeinstallprompt`.** O botão de 1-toque só existe quando o Chromium oferece o evento. Nos demais casos (iOS Safari, ou Chrome que decidiu não oferecer), o passo é obrigatoriamente manual — o que podemos fazer é **nunca deixar o cartão mudo** e guiar visualmente. É o teto técnico da plataforma, não uma falha corrigível 100%.

---

# PARTE D — Auditoria de Observabilidade, Logging e Diagnóstico de Falhas

> Este é o pedido central (`brain/documents/sistemaDeLogs`). Entrego: (D.1) lista de problemas, (D.2) falhas silenciosas, (D.3) falta de contexto, (D.4) segurança em logs, (D.5) o que já existe de bom, (D.6) arquitetura de logging ideal para ESTA stack, (D.7) exemplos de código, (D.8) níveis, (D.9) correlação, (D.10) masking, (D.11) observabilidade avançada.

## D.0 — Números do diagnóstico (VERIFICADO por varredura no `src/`, excluindo testes)

| Métrica | Valor | Leitura |
|--------|-------|---------|
| Blocos `try { … }` | **319** | O app tenta MUITA coisa defensivamente |
| `catch { … }` **sem binding** (erro descartado) | **237** | **~74% dos catches jogam o erro fora** |
| `catch (e) { … }` com binding | **61** | E dos que bindam, poucos logam |
| `console.*` no app inteiro | **25** | Praticamente **nenhum log** (em ~600 arquivos) |
| `console.*` no Worker (2.185 linhas) | **1** | A borda é **cega** |

**Conclusão de uma frase (ALTA CONFIANÇA):** o TripPilot é **muito robusto para o usuário** (quase nada quebra a tela graças aos 237 `catch` que engolem tudo) e **quase cego para o desenvolvedor** (25 logs no app, 1 no worker). Toda essa robustez tem o preço de **falhas silenciosas**: quando algo dá errado em campo, não há trilha.

## D.1 — Deficiências de logging (VERIFICADO)

1. **Ausência de logs estruturados (JSON).** Nenhum log é JSON. Os 25 `console.*` são strings livres (`console.error('[SW] Registration failed:', err)`). O Worker, que roda atrás do Cloudflare (onde `console.log` vira **Workers Logs**, já habilitado — ver D.11), praticamente **não emite nada** (1 chamada).
2. **Sem logger central.** Cada arquivo decide (quase sempre por omissão) o que fazer com o erro. Não há `logger.info/warn/error`. Não há formato, não há nível, não há sink.
3. **Logs pouco úteis.** Onde existem, são mensagens humanas sem contexto de máquina (sem `action`, `installId`, `requestId`, `module`, `durationMs`).
4. **Worker sem logging de request.** Nenhum log de "recebi POST /assistant, respondi 200 em 812ms, gastei 940 tokens". O `recordAiUsage` grava tokens no SQLite, mas isso é métrica de produto, não log operacional.

## D.2 — Falhas silenciosas (VERIFICADO — o achado mais grave)

**237 `catch {}` sem binding.** O erro é **capturado e descartado sem sequer olhar para ele**. Exemplos representativos (VERIFICADO):

- **Boundaries de dados/borda que somem sem rastro:**

```ts
// utils/telemetry.ts (sendHeartbeatIfDue)
} catch {
  /* swallow — telemetry must never surface to the user */
}
// utils/error-report.ts (flushPendingErrorReports)
} catch {
  /* swallow — error reporting must never surface to the user */
}
```

- **Orquestrador de share (push do convidado) — se falhar, o usuário só vê "não enviou", e você nunca sabe por quê:**

```ts
// domain/orchestrators/share-link-orchestrators.ts (pushGuestResponses)
} catch {
  return false;   // por quê? rede? cripto? parse? — perdido para sempre
}
```

- **Geolocalização, storage, cripto, notificações, live-update:** dezenas de `catch { return null }` / `catch { return }` idênticos.

**Por que é grave:** a decisão "nunca estourar para o usuário" está **certa** (é local-first, offline, UX-first). O problema é que "não estourar" virou "**não registrar**". O correto é: **engolir para o usuário, mas registrar para o operador.** Hoje só a primeira metade acontece.

**Casos onde o silêncio é aceitável (e devem continuar sem log):** guardas de ambiente triviais (`typeof window === 'undefined'`), `db.close()` em teardown, `URL.revokeObjectURL`. A regra proposta (D.6) separa "erro esperado/benigno" de "erro que merece um `warn/error`".

## D.3 — Falta de contexto (VERIFICADO)

Os poucos logs não têm nenhum dos campos que o seu pedido lista:

| Campo pedido | Existe hoje? | Onde poderia sair de graça |
|---|---|---|
| `userId` | Não (não há user) → usar **`installId`** | `getInstallationId()` já existe (`utils/entity-factory`) |
| `requestId` (correlação) | **Não** | Precisa ser criado (D.9) |
| `action`/evento | Não | O app já tem "verbos" (ex.: `log_expense`, `settle_debt`, `share_create`) |
| `timestamp` | Só no crash buffer | `new Date().toISOString()` |
| `service`/`module` | Não | Nome do arquivo/feature |

Hoje é **impossível rastrear uma requisição ponta a ponta** (app → Worker → Groq → Worker → app), porque nada carrega um identificador comum.

## D.4 — Segurança em logs / Data Masking (VERIFICADO — parcialmente já resolvido!)

**Boa notícia (VERIFICADO):** o app **já tem masking** no caminho de erros que vai para o servidor, e ele é **defense-in-depth** (cliente + servidor):

```ts
// domain/telemetry/telemetry.ts (scrubErrorMessage)  — cliente
raw.replace(/\s+/g, ' ').replace(/\d{4,}/g, '#').trim().slice(0, 240)
// worker/src/index.ts (scrubErrorMessageServer)      — servidor (idêntico)
```

Ou seja, qualquer sequência de 4+ dígitos (ids, valores em centavos, tokens, timestamps) vira `#` antes de ser persistida em `errors`. E o ingest de telemetria **rejeita** qualquer chave fora do allowlist não-monetário.

**Riscos remanescentes (MÉDIA CONFIANÇA):**
1. **Os 25 `console.*` locais não passam por scrub.** Ex.: `console.error('[assistant] pending image OCR failed', err)` — se o `err` contiver a mensagem/valor, ele vai cru para o console do device (e para qualquer ferramenta futura que capture console). Em produção, `console` deveria ser **desligado** ou **roteado pelo logger com masking**.
2. **O Worker não loga request bodies** hoje (bom!), mas quando adicionarmos logging (D.6), há o risco de logar o **texto do `/assistant`** (que contém nomes de pessoas e o que a pessoa gastou) ou a **imagem do `/ocr`**. **Regra dura:** nunca logar `text`, `imageDataUrl`, `blob`, `audioBase64`, `X-Share-Token`, `Authorization`, `key` (fragmento). O logger proposto tem um **denylist de chaves** que redige automaticamente.
3. **Groq como subprocessador:** o texto do assistente e a imagem do recibo **saem do device** para o Groq (isso é opt-in e documentado — DEC-206/209). Não é log, mas é o ponto onde PII cruza a fronteira; o logger nunca deve **duplicar** esse conteúdo em log.

## D.5 — O que já existe de bom (não reinventar — VERIFICADO)

O TripPilot **já tem meia infraestrutura de observabilidade local-first**; o plano deve **construir sobre ela**, não substituí-la:

- **Crash buffer rotativo** (`utils/crash-log.ts`): últimos 10 crashes em localStorage, com detecção de loop (`isCrashLooping`). Captura `window.onerror` + `unhandledrejection` (em `main.tsx`) + `ErrorBoundary`.
- **Flush anônimo de erros para o Worker** (`utils/error-report.ts` → `POST /e`), com high-water mark (cada crash reportado no máx. 1×), opt-out (`telemetryEnabled`) e masking.
- **Telemetria de uso** (`utils/telemetry.ts` → `POST /t`) + **dashboard admin** (`/admin/*`) com DAU/WAU/MAU, versões, erros deduplicados por hash, tokens de IA por instalação.
- **Diagnóstico de campo** (`utils/diagnostics.ts`): bloco copiável com ambiente + estado do IndexedDB + crash log, para quando a tela trava. **Excelente** — é o embrião do que um logger estruturado formalizaria.
- **Workers observability já LIGADO** (`wrangler.jsonc`: `"observability": { "enabled": true }`) — a plataforma já está coletando `console.log` do Worker; só falta **emitir** logs estruturados.

## D.6 — Arquitetura de logging ideal (para ESTA stack)

Princípio: **um logger estruturado por runtime, mesmo schema JSON, masking no núcleo, plugado no que já existe.** Não usar Winston/Pino (Node) — usar um logger fino próprio (≈120 linhas) que:
- no **browser**: escreve JSON no `console` em dev, e em prod **silencia o console** e roteia `warn/error` para o **crash buffer + `/e`** já existentes;
- no **Worker**: escreve `console.log(JSON.stringify(entry))` (capturado pelo Workers Logs / Logpush).

### Schema de log padrão (JSON) — o "contrato"

```jsonc
{
  "ts": "2026-07-03T09:41:12.882Z", // ISO 8601 UTC
  "level": "error",                  // debug|info|warn|error|fatal
  "msg": "share push failed",        // curto, estável, sem PII
  "service": "app" | "worker",       // qual runtime
  "module": "share-orchestrator",    // arquivo/feature
  "action": "share_push_response",   // o verbo do domínio
  "requestId": "b1f3…",              // correlação ponta a ponta
  "installId": "a9c2…",              // "userId" pseudônimo (nunca PII)
  "appVersion": "2.1.5-rc",
  "platform": "android-pwa",
  "durationMs": 812,                 // quando aplicável
  "err": { "name": "TypeError", "message": "#", "stack": "…" } // message já com masking
}
```

### Regra de tratamento de erro (substitui o `catch {}` mudo)

- **Erro benigno/esperado** (offline, permissão negada, storage indisponível): `logger.debug` (ou nada, se for guarda trivial). Continua engolindo para o usuário.
- **Erro inesperado** (parse que deveria funcionar, cripto, dispatch de engine): `logger.warn`/`logger.error` **com `err` e `action`**, e **depois** engole para o usuário. Nunca mais um `catch {}` vazio num caminho de negócio.

## D.7 — Exemplos de código (propostas — NÃO aplicadas)

### D.7.1 — Logger do browser (`src/utils/logger.ts`, NOVO)

```ts
import { getInstallationId } from '@/utils/entity-factory';
import { APP_VERSION } from '@/utils/app-version';
import { telemetryPlatform } from '@/utils/telemetry';
import { recordCrash } from '@/utils/crash-log';
import { scrubErrorMessage } from '@/domain/telemetry';

type Level = 'debug' | 'info' | 'warn' | 'error' | 'fatal';
const ORDER: Record<Level, number> = { debug: 10, info: 20, warn: 30, error: 40, fatal: 50 };
const MIN_LEVEL: Level = import.meta.env.DEV ? 'debug' : 'warn';

// Chaves que NUNCA podem ser logadas (masking por denylist).
const REDACT = new Set(['text', 'imageDataUrl', 'audioBase64', 'blob', 'key', 'writeToken', 'token', 'authorization', 'x-share-token', 'pin']);

function safeMeta(meta?: Record<string, unknown>): Record<string, unknown> {
  if (!meta) return {};
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(meta)) {
    if (REDACT.has(k.toLowerCase())) { out[k] = '[redacted]'; continue; }
    out[k] = typeof v === 'string' ? scrubErrorMessage(v) : v;
  }
  return out;
}

function emit(level: Level, action: string, meta?: Record<string, unknown>, err?: unknown): void {
  if (ORDER[level] < ORDER[MIN_LEVEL]) return;
  const entry = {
    ts: new Date().toISOString(),
    level, service: 'app', action,
    installId: safe(getInstallationId), appVersion: APP_VERSION, platform: safe(telemetryPlatform),
    ...safeMeta(meta),
    ...(err ? { err: describe(err) } : {}),
  };
  // dev: console legível; prod: silêncio no console + rota para o buffer existente.
  if (import.meta.env.DEV) (console[level === 'fatal' ? 'error' : level] ?? console.log)(entry);
  if (level === 'error' || level === 'fatal') recordCrash({ message: `${action}: ${describe(err).message}` });
}

function describe(err: unknown) {
  if (err instanceof Error) return { name: err.name, message: scrubErrorMessage(err.message), stack: err.stack };
  return { name: 'NonError', message: scrubErrorMessage(String(err)) };
}
function safe<T>(fn: () => T): T | null { try { return fn(); } catch { return null; } }

export const logger = {
  debug: (a: string, m?: Record<string, unknown>) => emit('debug', a, m),
  info:  (a: string, m?: Record<string, unknown>) => emit('info', a, m),
  warn:  (a: string, m?: Record<string, unknown>, e?: unknown) => emit('warn', a, m, e),
  error: (a: string, m?: Record<string, unknown>, e?: unknown) => emit('error', a, m, e),
};
```

### D.7.2 — Como o `catch {}` mudo passa a ser (exemplo real)

```ts
// ANTES (domain/orchestrators/share-link-orchestrators.ts)
} catch {
  return false;
}

// DEPOIS
} catch (err) {
  logger.warn('share_push_response_failed', { module: 'share-orchestrator', shareId: statement.share.shareId }, err);
  return false; // continua engolindo para o usuário — mas agora há trilha
}
```

> Note: `shareId` é um UUID inguessável (não é PII); `err.message` passa pelo `scrubErrorMessage`. Nunca logamos o `blob`/`key`.

### D.7.3 — Logger do Worker (`worker/src/logger.ts`, NOVO)

```ts
type Level = 'debug' | 'info' | 'warn' | 'error' | 'fatal';

export function log(level: Level, action: string, ctx: {
  requestId: string; installId?: string; route?: string; status?: number;
  durationMs?: number; err?: unknown; [k: string]: unknown;
}): void {
  const { err, ...rest } = ctx;
  // Workers Logs captura console.log; JSON.stringify torna o log consultável.
  console.log(JSON.stringify({
    ts: new Date().toISOString(), level, service: 'worker', action, ...rest,
    ...(err ? { err: { name: (err as Error)?.name, message: String((err as Error)?.message ?? err) } } : {}),
  }));
}
```

### D.7.4 — Middleware de request no Worker (correlação + timing)

```ts
// no export default fetch(...)
const requestId = request.headers.get('X-Request-Id') ?? crypto.randomUUID();
const started = Date.now();
try {
  const res = await route(request, env, ctx, requestId, installId); // rotas atuais + requestId
  log('info', 'request', { requestId, installId, route: url.pathname, status: res.status, durationMs: Date.now() - started });
  res.headers.set('X-Request-Id', requestId); // devolve para o app fechar a correlação
  return res;
} catch (err) {
  log('error', 'request_unhandled', { requestId, route: url.pathname, durationMs: Date.now() - started, err });
  return json({ error: 'internal', requestId }, 500);
}
```

## D.8 — Níveis de log (política)

| Nível | Quando | Exemplos no TripPilot |
|------|--------|------------------------|
| `debug` | Detalhe de fluxo, só em dev | "geolocation timeout, resolvendo null"; "SW updatefound" |
| `info` | Evento de negócio normal | "request 200"; "heartbeat enviado"; "share criado" |
| `warn` | Algo falhou mas há fallback | "OCR falhou, caindo pra manual"; "push do convidado falhou, vai reenviar" |
| `error` | Falha inesperada num caminho de negócio | "dispatch de engine lançou"; "decrypt do statement falhou com chave válida" |
| `fatal` | App/rota inutilizável | ErrorBoundary pegou; IndexedDB não abre (wedge) |

Em **produção o piso é `warn`** no browser (não spammar console do usuário) e `info` no Worker (Workers Logs aguenta e é onde você investiga). Em **dev, `debug`**.

## D.9 — Correlação de requisições (requestId ponta a ponta)

Fluxo proposto (VERIFICADO como viável na arquitetura atual):
1. App gera `requestId = crypto.randomUUID()` por ação de IA/share e envia em **`X-Request-Id`** (o `aiRequestHeaders()` em `data/sync/config.ts` é o lugar natural para injetar).
2. Worker lê/gera o `requestId`, usa em **todos** os logs daquela request, e o **devolve** no header `X-Request-Id`.
3. App loga o mesmo `requestId` no `warn/error` do resultado.
4. Resultado: um único id liga "usuário tocou em salvar" → "Worker chamou Groq" → "voltou 429" → "app entrou em cooldown". Com o `installId` junto, dá para reconstruir a jornada de uma instalação específica sem nenhum PII.

## D.10 — Data Masking (garantia automática)

- **Já existe** `scrubErrorMessage` (cliente) + `scrubErrorMessageServer` (servidor) — **manter e reusar no logger** (o exemplo D.7.1 já chama).
- **Adicionar** o **denylist de chaves** (`REDACT`) para que, mesmo por engano, `text`/`imageDataUrl`/`key`/`token` nunca entrem num log.
- **Regra de ouro documentada no brain:** conteúdo financeiro (valores, itens, saldos, nomes de lugar, datas) e segredos (chave AES, write-token, PIN, Authorization) **nunca** vão para log. Nome de pessoa: só o `installId`/`displayName` já permitido pela telemetria, nunca a lista de participantes de um gasto.

## D.11 — Observabilidade avançada (diferencial, opcional)

Ordem de custo-benefício **para Cloudflare** (não ELK/Grafana-Loki self-hosted, que exigiriam infra que o projeto deliberadamente evita):

1. **Workers Logs (já habilitado!).** `wrangler.jsonc` já tem `observability.enabled: true`. Assim que o Worker emitir JSON (D.7.3), os logs ficam **consultáveis por campo** no dashboard Cloudflare — custo ~zero, zero infra. **É o primeiro passo, e o de maior retorno.**
2. **Logpush → destino externo** (R2/S3/Datadog) se um dia quiser retenção longa/consulta pesada. Opcional.
3. **OpenTelemetry no Worker** via `@microlabs/otel-cf-workers` (tracing distribuído app→worker→Groq). Só quando o volume justificar — é o "diferencial" do seu pedido, mas **não** é necessário no estágio atual (1 Worker, tráfego pequeno). Fica como fase futura.
4. **Métricas de produto** já existem no `TelemetryStore` (DAU/tokens/errors). Complementar com **RED** (Rate/Errors/Duration) por rota vindo dos logs de request (D.7.4).

> Recomendação honesta: **não** montar ELK Stack nem Grafana+Loki agora. Seriam servidores para manter, contrariando o design zero-custo/zero-infra do projeto. Workers Logs + logger estruturado entregam 90% do valor com 0% da operação. ELK/OTel entram só se o produto escalar.

## D.12 — Plano de adoção do logging (sem big-bang)

1. **Fase 1 (P1, baixo risco):** criar `utils/logger.ts` (browser) + `worker/logger.ts`. Ligar o middleware de request no Worker (D.7.4). Ganho imediato: **visibilidade total da borda** com Workers Logs.
2. **Fase 2 (P1):** trocar os **~25 `console.*`** existentes por `logger.*`. Silenciar `console` em prod.
3. **Fase 3 (P2, incremental):** varrer os **237 `catch {}`** por **camada de negócio** (começar por `domain/orchestrators/**`, `data/sync/**`, `utils/ai-*`), classificando cada um em "benigno → debug/nada" ou "inesperado → warn/error com err". **Não** mexer nos guardas triviais.
4. **Fase 4 (P3):** requestId ponta a ponta + (opcional) OTel.

---

# PARTE E — Backlog priorizado (unifica A→D)

> **Atualização 2026-07-03 (mesmo dia):** a 1ª leva cirúrgica foi **aplicada e deployada** (`2.1.4-rc`, DEC-436→438): **SEC-1 ✅** (headers ao vivo no apex), **SEC-3 ✅** (worker `d36cdb89`), **BUG-CONV ✅**. Ver `2026-07-03-security-converter-hardening-orchestrator.md`.
>
> **Atualização 2026-07-03 (mega-leva, mesmo dia):** TODO o restante foi **aplicado e deployado** (`2.2.0-rc`, DEC-439→444, worker `85edfeed`, Pages `6d4ec69e`): **SEC-2 ✅** (rate limit nativo `ratelimits` — 429 verificado ao vivo no 21º hit), **SEC-4 ✅** (admin CORS allowlist — probes evil/allowlisted ok), **OBS-1 ✅** (logger JSON worker+app + middleware de request), **OBS-2 ✅** (25 console.* migrados, prod silencioso), **OBS-3 ✅** (catch sweep da camada de negócio — boundaries de IA + orchestrators), **OBS-4 ✅** (X-Request-Id ponta a ponta, echo verificado), **PWA-1/2 ✅** (fallback de instalação ativo + guia por navegador pt/en/es). **OBS-5 (OpenTelemetry) deliberadamente não aplicado** (recomendação D.11 deste audit). Ver `2026-07-03-observability-ratelimit-pwa-orchestrator.md`. **Backlog deste audit: FECHADO.**

Esforço em **Tier 3** (padrão do projeto: estimativa ÷ ~3.3).

| ID | Item | Parte | Sev | Esforço bruto → Tier 3 | Risco |
|----|------|-------|-----|------------------------|-------|
| **SEC-1** | Headers de segurança globais no `_headers` (clickjacking + nosniff + referrer + permissions) | A.6 | **P1** | 2h → **~40min** | Baixo (só `frame-ancestors` primeiro) |
| **SEC-2** | Rate limit por IP nos endpoints de IA/ingest (WAF ou DO) | A.1 | **P1** | 8h → **~2.5h** | Médio (validar limites) |
| **SEC-3** | Comparação constante-no-tempo do `ADMIN_TOKEN` | A.7 | P2 | 1h → **~20min** | Baixo |
| **SEC-4** | CORS allowlist no `/admin/*` + `Referrer-Policy` no share | A.2/A.4 | P2 | 2h → **~40min** | Baixo |
| **BUG-CONV** | `min-w-0` nos selects/wrappers do conversor | B | **P1** | 1h → **~20min** | Baixo |
| **PWA-1** | Fallback de instalação ativo (botão + infográfico Android/desktop) | C.1 | **P1** | 4h → **~1.2h** | Baixo |
| **PWA-2** | Mensagem por-navegador no fallback | C.3 | P3 | 2h → **~40min** | Baixo |
| **OBS-1** | Logger estruturado (browser + worker) + middleware de request | D.7 | **P1** | 8h → **~2.5h** | Baixo |
| **OBS-2** | Migrar 25 `console.*` → logger; silenciar console em prod | D.12-2 | P1 | 3h → **~1h** | Baixo |
| **OBS-3** | Varredura dos 237 `catch {}` por camada (negócio primeiro) | D.12-3 | P2 | 16h → **~5h** | Médio (volume) |
| **OBS-4** | requestId ponta a ponta (app→worker→app) | D.9 | P2 | 4h → **~1.2h** | Baixo |
| **OBS-5** | (Opcional) OpenTelemetry no Worker | D.11 | P3 | 12h → **~3.6h** | Médio |

**Sugestão de primeira leva (1 sessão, alto retorno):** SEC-1 + BUG-CONV + SEC-3 (correções cirúrgicas de minutos) e, em seguida, OBS-1 (o logger, que destrava tudo o mais). SEC-2 e PWA-1 na leva seguinte.

---

# PARTE F — Apêndice de evidências (rastreabilidade)

| Achado | Arquivo | Evidência |
|--------|---------|-----------|
| CORS `*` fixo (não reflexão) | `worker/src/index.ts` | L85–91 `CORS_HEADERS` |
| Sem rate limit; só caps + repasse de 429 | `worker/src/index.ts` | `rateLimitBody`, `MAILBOX_MAX_*`, `SHARE_RESP_MAX_*` |
| SQL parametrizado (sem SQLi) | `worker/src/index.ts` | `TelemetryStore.*` (todos `sql.exec(?, arg)`) |
| Compare de admin não constante | `worker/src/index.ts` | `handleAdmin`: `token !== env.ADMIN_TOKEN` |
| Sem headers de segurança | `public/_headers` | só CORS em `/version.json`, `/bundles/*` |
| Grep vazio p/ X-Frame/CSP/Referrer | `TripPilot/**` | nenhuma ocorrência |
| Capability URL + write-token hash | `worker/src/index.ts` (`ShareStore`) + `domain/orchestrators/share-link-orchestrators.ts` | chave no `#fragment`, `sha256Hex(token)` |
| Rotas de convidado públicas | `src/app/router.tsx` | `/s/:id`, `/g/:id` (fora do BootGate) |
| Bug conversor (flex sem min-w-0) | `src/features/converter/ConverterPage.tsx` | `selectClass` + `flex items-end gap-2` |
| PWA: fallback estático mudo | `src/features/install/InstallOptions.tsx` | ramo `!available` = `<div>` de instruções |
| PWA: captura do prompt | `src/utils/pwa.ts` + `src/main.tsx` | `captureInstallPrompt`, `beforeinstallprompt` |
| 237 `catch {}` / 25 `console.*` | `src/**` (varredura) | ver D.0 |
| Masking já existente | `domain/telemetry/telemetry.ts` + `worker/src/index.ts` | `scrubErrorMessage` / `scrubErrorMessageServer` |
| Crash buffer + flush | `utils/crash-log.ts`, `utils/error-report.ts` | `recordCrash`, `flushPendingErrorReports` |
| Diagnóstico de campo | `utils/diagnostics.ts` | `collectDiagnostics` |
| Workers observability ON | `worker/wrangler.jsonc` | `"observability": { "enabled": true }` |

---

## Encerramento

- **Segurança:** as duas ações que valem de verdade **agora** são os **headers de segurança** (SEC-1, clickjacking — 40 min) e o **rate limit** de borda (SEC-2, custo/abuso). O resto do seu checklist ou não se aplica (login/JWT/enumeração/senha) ou já está coberto (SQLi/IDOR), com a ressalva do compare de token.
- **Conversor:** bug real e simples — `min-w-0` nos flex items.
- **PWA:** quando o navegador deixa, o app **já** instala com 1 toque; falta **nunca deixar o fallback mudo** e guiar visualmente (o teto é da plataforma).
- **Observabilidade (o pedido central):** o app é robusto e **cego**. O caminho certo **não é Winston/Pino**, e sim um **logger estruturado fino por runtime** (browser + Worker), reusando o **masking e o crash-buffer que já existem** e ligando o **Workers Logs que já está habilitado**. Isso transforma 237 falhas silenciosas em trilha investigável, sem trair o local-first nem o custo-zero.

*Nenhum arquivo de código foi modificado por este relatório — é diagnóstico + plano, conforme a regra de separação investigação × implementação.*
