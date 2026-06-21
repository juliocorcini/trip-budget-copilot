# Painel de Administração v1 — Planejamento Completo

> Data: 2026-06-21 · Autor: AI (inline, sem subagents) · Status: **EM IMPLEMENTAÇÃO** (Worker no ar; cliente + `/admin` em construção). DEC-248.
> Escopo: primeira versão de um painel para o Julio entender **quem usa** e **como usa** o TripPilot, **sem dado sensível**.
> Idioma do documento: PT-BR. Código (identificadores/comentários) sempre em inglês.

---

## 0. Calibração ratificada pelo Julio (sobrescreve o que diverge abaixo)

O rascunho original deste plano era "extremo" em privacidade (UUID anônimo, **sem nome**, consentimento opt-in). O Julio recalibrou — estas são as regras **vigentes** (qualquer trecho mais abaixo que conflite está superado):

1. **Nome SIM.** Pode enviar o **nome do dono** (`Participant.isOwner`, fallback `AppSettings.deviceName`). Privacy-first é o DNA, mas não a ponto de esconder quem usa.
2. **Dinheiro NUNCA.** A única linha vermelha é **valor monetário / conteúdo de transação** (valores, itens, saldos, nomes de lugar, datas de gasto). Tudo isso fica **fora**. Garantido no servidor por **allowlist no ingest** (chave fora da lista → HTTP 400; ver §6/§7).
3. **Consentimento on-by-default.** `telemetryEnabled` começa **ligado**, com aviso claro ("dados de uso anônimos por dispositivo p/ melhorar o app — nunca enviamos valores nem o conteúdo dos seus gastos") + **opt-out** de um toque nas Configurações.
4. **Envio ao abrir o app** (o user pode não entrar todo dia), **throttle ≤1 envio/dia UTC**, best-effort (`keepalive`), nunca bloqueia a UI, silencioso em falha/offline.
5. **Storage = Durable Object + SQLite** (`TelemetryStore`, migration `v5`) — **não** D1 (reusa o padrão de DO já no stack, sem provisioning novo).
6. **Admin gated por token** (`ADMIN_TOKEN` secret, `Bearer`) — `GET /admin/*` (leitura) + `DELETE /admin/install` (limpar lixo/teste). 401 sem token (verificado ao vivo).

---

## 1. Objetivo (o que o Julio pediu)

Um painel inicial onde o Julio consiga ter noção de:

- **Quem está usando** o app (usuários ativos, logar/listar quem está ativo).
- **Com que frequência** usam (quantas vezes, última vez que usou).
- **O que estão fazendo / quais funções usam** (dividir conta, cadastrar gastos, saídas, IA, etc.).
- Por instalação: "como está o uso do app pra essa pessoa" — nº de gastos, nº de divisões, nº de compras cadastradas, **com quem usou** (ver §5: vira **contagem**, nunca identidade).

**Restrição dura (palavra do Julio):** **nenhum dado sensível** — sem valores, sem dados pessoais do usuário, sem conteúdo. É sobre **uso do app**, não sobre as finanças de ninguém.

---

## 2. Realidade técnica (por que isto NÃO é "só um dashboard")

O TripPilot é **local-first / privacy-first**. Hoje:

| Fato | Implicação |
|------|------------|
| Todo dado do usuário vive no **IndexedDB do device** | Não existe um banco central de usuários pra "consultar". |
| Única infra central = Worker `trippilot-sync` (DOs SQLite: `SyncRoom`/`Mailbox`/`ShareSignal`/`ShareStore`, KV `SHARE_STORE`, secret `GROQ_API_KEY`) | O servidor só faz relay E2E (vê **ciphertext**) + proxies Groq (`/ocr`, `/assistant`, `/transcribe`). |
| `observability: true` no Worker | A Cloudflare já mostra **contagem de requests por rota** (ex.: quantos `/ocr`, `/assistant`), país, status — **mas não por usuário nem por feature local**. |
| `getInstallationId()` = UUID v4 em `localStorage` (`trippilot_device_id`) | Já temos um **identificador anônimo por instalação**, sem PII (é o mesmo `actorId` do P2P). |
| Precedentes de privacidade: flags opt-in (`cloudReceiptOcrEnabled`, `locationCaptureEnabled`, `mailboxEnabled`), ÂNCORA 8 (privacy-first), Worker que só vê ciphertext | Qualquer telemetria tem que respeitar esse DNA: anônima, minimal, transparente, desligável. |

**Conclusão:** não há telemetria nenhuma. Para responder "quem usa e como", precisamos **adicionar um pipeline de telemetria anônima** (cliente → Worker → store) + uma **tela de admin**. Este documento projeta isso de forma coerente com o privacy-first.

### 2.1 O que dá pra ver HOJE, sem código (freebie do Phase 0)
No dashboard da Cloudflare (Workers → `trippilot-sync` → Observability/Analytics) o Julio **já** consegue ver, sem implementar nada: volume de requests por rota (`/ocr`, `/assistant`, `/transcribe`, `/share`, `/rooms`, `/mailbox`), distribuição por país e status codes. Isso dá um primeiro pulso de "uso de features de nuvem", mas **não** diz quantas instalações ativas existem nem o que cada uma faz offline (a maioria do uso é local). Por isso o heartbeat (§6) é necessário.

---

## 3. Princípios inegociáveis (contrato de privacidade)

1. **Anônimo por design** — chave = `installId` (UUID pseudônimo já existente). Nunca e-mail, nome, telefone, conta.
2. **Minimização dura** — só **contadores** e **metadados grossos**. O servidor **rejeita** qualquer payload com campo fora do schema (não dá pra "vazar sem querer").
3. **Zero conteúdo / zero valor** — proibido: montantes, nomes (pessoas/viagens/carteiras), descrições, categorias de um gasto específico, coordenadas/lugares, identidades de peers, qualquer texto livre.
4. **Transparente e desligável** — aviso honesto no app + toggle nas Configurações (padrão do `mailboxEnabled`).
5. **Nunca bloqueia o app** — telemetria é best-effort, falha em silêncio, nunca trava um save (padrão do `safeLocalStorage`/crash-log).
6. **Portável / sem lock-in** — D1 é SQLite; dá pra exportar/migrar. Mesmo espírito do KV "id→ciphertext".

---

## 4. Decisões de arquitetura (do conselho)

Resumo do conselho inline (versão completa no chat que originou este doc):

| Decisão | Escolha v1 | Por quê | Alternativa (v2/condição) |
|---|---|---|---|
| **Modelo de coleta** | **Heartbeat diário anônimo**: o device computa seus contadores do IndexedDB e manda um snapshot compacto | Mais privado (só números), volume ínfimo (~1/install/dia), gera direto a tabela "por install" que o Julio quer | Firehose de eventos (funis/ordem de ações) → Analytics Engine no v2 |
| **Storage** | **Cloudflare D1** (SQLite): tabela `installs` (upsert, 1 linha/instalação) + `heartbeats` (série temporal) | Consulta relacional = lista de "usuários ativos + o que cada um usa"; free tier sobra no v1 | Analytics Engine quando volume/funis crescerem |
| **Consentimento** | **On-by-default, anônimo, com aviso + toggle** (a **RATIFICAR** — §11) | Cobertura real ("quem usa" só funciona com cobertura alta); dado é anônimo/agregado e reversível | **Opt-in** se o Julio quiser bandeira "zero telemetria" (cobertura ~5-15%) |
| **Auth do admin** | **Bearer token** (secret do Worker) no v1; **Cloudflare Access** quando conveniente | Simples e seguro pra um operador único; Access é zero-trust e robusto | Cloudflare Access (Google/email do Julio) |
| **UI do admin** | Página enxuta separada (rota protegida no app **ou** HTML servido pelo Worker) | Não polui o app do usuário; carrega rápido | App admin dedicado (overkill no v1) |

**Por que heartbeat e não eventos:** o pedido central é a foto "como está o uso pra essa pessoa" (contadores + última vez vista) e "quem está ativo". Um snapshot diário entrega isso com 1 request/dia/instalação e o mínimo de dado possível. Funis ("abriu split → escolheu pessoa → confirmou") são valiosos, mas são v2 e exigem mais dado/volume.

---

## 5. O que medir (mapeado aos pedidos) e o que é PROIBIDO

### 5.1 Métricas (tudo contador/inteiro ou metadado grosso)

**Identidade & contexto (metadados grossos):**
- `installId` (UUID anônimo) · `appVersion` · `platform` (`web` | `android-pwa` | `android-apk` | `ios-web`) · `locale` (ex.: `pt-BR`) · `country` (coarse, derivado do header `CF-IPCountry` no Worker — o cliente **não** manda IP) · `firstSeenAt` · `lastSeenAt`.

**Frequência de uso (→ "quantas vezes", "última vez"):**
- `lastSeenAt` (última vez vista) · `activeDays` (dias distintos com atividade) · `heartbeatCount` (nº de dias que reportou) · `daysSinceFirstSeen`.
- Derivados no servidor/painel: **DAU / WAU / MAU**, retenção por coorte.

**O que faz / quais funções (→ "o que estão fazendo"):** contadores cumulativos por instalação, computados do IndexedDB:
- `tripsCount` (viagens) · `expensesCount` (gastos cadastrados) · `outingsCount` (saídas) · `splitsCount` (divisões de conta criadas/confirmadas) · `receiptScansCount` (notas lidas) · `aiEntriesCount` (entradas via IA) · `settlementsCount` (acertos) · `plannedPurchasesCount` (compras planejadas) · `simulationsCount` (simulações "posso gastar?") · `backupsCount` · `wiseImportsCount` · `connectionsCount` (**nº de conexões/peers — número, NUNCA quem**).

**Flags de adoção (booleans → "usa tal função?"):**
- `usesAI` · `usesReceiptOcr` · `usesSplit` · `usesWallets` · `usesLocation` · `usesAppLock` · `usesMultiCurrency` · `isNativeApk`.

**Saúde (opcional, agregado):**
- `crashCount` (do buffer local `crash-log`, só **contagem**, sem stack/mensagem) — ajuda a ver estabilidade no campo sem expor nada.

### 5.2 PROIBIDO (linha vermelha)
Valores/montantes · nomes de pessoas, viagens, carteiras, lugares · descrições/notas · categoria de um gasto específico · coordenadas/place · **identidades de peers** (só `connectionsCount`) · qualquer texto livre · IP bruto (país coarse vem do CF no servidor, não do cliente) · stacks/mensagens de erro.

> **"Com quem usou"** (pedido do Julio) → no v1 vira **`connectionsCount`** (quantas conexões a instalação tem). Identidade de quem é proibida (re-identificação). Mostrar "rede de quem-conecta-com-quem" só seria possível com pseudônimos cruzados — **fora do escopo v1** e precisa decisão de privacidade própria.

---

## 6. Modelo de dados (Cloudflare D1)

Novo binding `D1` (`TELEMETRY_DB`) no Worker. Duas tabelas:

```sql
-- One row per installation (UPSERTed on every heartbeat). This IS the
-- "active users + what each one uses" list the admin wants.
CREATE TABLE IF NOT EXISTS installs (
  install_id      TEXT PRIMARY KEY,         -- anonymous UUID (no PII)
  first_seen_at   INTEGER NOT NULL,         -- epoch ms
  last_seen_at    INTEGER NOT NULL,
  app_version     TEXT,
  platform        TEXT,                     -- web | android-pwa | android-apk | ios-web
  locale          TEXT,
  country         TEXT,                     -- coarse, from CF-IPCountry (server-side)
  active_days     INTEGER NOT NULL DEFAULT 0,
  heartbeat_count INTEGER NOT NULL DEFAULT 0,
  -- usage counters (cumulative, integers only)
  trips_count            INTEGER NOT NULL DEFAULT 0,
  expenses_count         INTEGER NOT NULL DEFAULT 0,
  outings_count          INTEGER NOT NULL DEFAULT 0,
  splits_count           INTEGER NOT NULL DEFAULT 0,
  receipt_scans_count    INTEGER NOT NULL DEFAULT 0,
  ai_entries_count       INTEGER NOT NULL DEFAULT 0,
  settlements_count      INTEGER NOT NULL DEFAULT 0,
  planned_purchases_count INTEGER NOT NULL DEFAULT 0,
  simulations_count      INTEGER NOT NULL DEFAULT 0,
  backups_count          INTEGER NOT NULL DEFAULT 0,
  wise_imports_count     INTEGER NOT NULL DEFAULT 0,
  connections_count      INTEGER NOT NULL DEFAULT 0,
  crash_count            INTEGER NOT NULL DEFAULT 0,
  -- adoption flags (0/1)
  uses_ai INTEGER NOT NULL DEFAULT 0,
  uses_receipt_ocr INTEGER NOT NULL DEFAULT 0,
  uses_split INTEGER NOT NULL DEFAULT 0,
  uses_wallets INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_installs_last_seen ON installs(last_seen_at);

-- One row per (install, day). Powers DAU/WAU/MAU + retention time-series.
-- A daily snapshot keeps it tiny; raw counters live in `installs`.
CREATE TABLE IF NOT EXISTS heartbeats (
  install_id TEXT NOT NULL,
  day        TEXT NOT NULL,                 -- YYYY-MM-DD (device local day)
  app_version TEXT,
  platform   TEXT,
  PRIMARY KEY (install_id, day)
);
CREATE INDEX IF NOT EXISTS idx_heartbeats_day ON heartbeats(day);
```

**Por que duas tabelas:** `installs` responde "quem está ativo e o que faz" (consulta direta, 1 linha/instalação). `heartbeats` (PK composta, idempotente por dia) dá a série temporal pra DAU/WAU/MAU/retenção sem inflar nada. Volume: alguns milhares de instalações × 1 linha/dia = trivial pro free tier do D1.

---

## 7. Endpoints do Worker

Seguem o mesmo dispatch por `pathname` já usado (`if (method === 'POST' && url.pathname === '/x')`).

### 7.1 Ingest — `POST /t` (público, anônimo, com guardas)
- **Body** (JSON, schema fechado): `{ installId, appVersion, platform, locale, day, counters:{...}, flags:{...} }`.
- **Guardas (espelham os caps do mailbox):**
  - valida `installId` com `ACTOR_ID_RE` (8–64 hex/uuid);
  - tamanho do body capado (ex.: ≤ 4 KB) — não há campo grande legítimo;
  - **allowlist de chaves**: qualquer chave fora do schema → `400` (minimização forçada);
  - todos os counters precisam ser inteiros ≥ 0; flags 0/1;
  - rate-limit por `installId` (ex.: aceita 1 heartbeat/dia; ignora repetidos com `200` idempotente);
  - `country` é lido de `request.headers.get('CF-IPCountry')` **no servidor** (cliente nunca manda IP).
- **Efeito:** `UPSERT` em `installs` (atualiza `last_seen_at`, contadores, flags; soma `heartbeat_count`/`active_days` quando o `day` é novo) + `INSERT OR IGNORE` em `heartbeats(install_id, day)`.
- **Resposta:** `{ ok: true }` (best-effort; nunca vaza dado).

### 7.2 Consulta admin (token-gated) — prefixo `/admin/*`
Header `Authorization: Bearer <ADMIN_TOKEN>` (novo secret do Worker). Sem token → `401`.
- `GET /admin/overview` → KPIs: `dau`, `wau`, `mau`, `totalInstalls`, `newInstalls7d`, distribuição por `platform`/`appVersion`/`country`, somatórios de features (Σ splits, Σ expenses, …), retenção D1/D7/D30.
- `GET /admin/installs?sort=last_seen&limit=100&offset=0&active=7d` → a **lista** que o Julio quer: por instalação (anônima) com last_seen, versão, plataforma, país e os contadores/flags. Paginado.
- `GET /admin/timeseries?metric=dau&days=30` → série pro gráfico.
- (v2) `GET /admin/export.csv` → exportar.

> Auth: bearer token é o suficiente e simples pro v1 (operador único). Quando quiser, trocamos por **Cloudflare Access** (login Google/email do Julio) na frente das rotas `/admin/*` — zero código de auth, zero-trust.

---

## 8. Cliente (app)

Mantendo a arquitetura: **domínio puro** + **boundary** + **toggle/disclosure**.

### 8.1 Domínio puro — `src/domain/telemetry/`
- `buildHeartbeat(snapshot): HeartbeatPayload` — função **pura** que recebe os contadores já lidos e monta o payload mínimo (sem nada proibido). Testável com Vitest (números concretos).
- **Reuso:** os contadores saem de agregações que já existem (derivações do Copilot/Wrapped, `countActiveDays`, contagens de repositórios). Não recomputar regra de negócio — só **contar linhas** por tipo (transactions por `type`, sessions, splitSessions/commits, participantShares→connections via peerLinks, plannedPurchases, etc.). **Nunca** ler montantes.
- `shouldSendHeartbeat(lastSentDay, today)` — puro: true só quando virou o dia (debounce diário).

### 8.2 Boundary — `src/utils/telemetry.ts`
- `sendHeartbeat()` — lê o toggle; se off, no-op. Computa os contadores (consultas leves/contagens), chama `buildHeartbeat`, faz `POST /t` com timeout curto, **try/catch silencioso** (nunca propaga erro). Marca `lastTelemetryDay` em `localStorage`.
- Disparo: no **app open** (após boot, fora do caminho crítico — ex.: `requestIdleCallback`), respeitando o debounce diário. Sem timers agressivos.

### 8.3 Configuração & consentimento
- `AppSettings.telemetryEnabled: boolean` (não-indexado, sem migração — ÂNCORA 18), default conforme decisão ratificada (§11).
- Toggle nas Configurações no grupo **"Notificações & privacidade"** (já existe — DEC-171), com microcopy honesta em pt/en/es: o que é coletado (uso anônimo agregado), o que **não** é (nada de valores/nome/conteúdo), e que dá pra desligar. Espelha o texto do `cloudReceiptOcrEnabled`/`mailboxEnabled`.
- Onboarding: uma linha discreta de aviso (se on-by-default) com link pro toggle.

---

## 9. Painel Admin (UI v1)

Página enxuta (rota protegida `/admin` no app, gated por token, **ou** HTML estático servido pelo Worker). Seções:

1. **Overview (cards):** Instalações ativas **hoje / 7d / 30d** (DAU/WAU/MAU) · total de instalações · novas (7d) · retenção D1/D7/D30.
2. **Uso por feature (barras):** Σ por feature (divisões, gastos, saídas, IA, notas, acertos, simulações…) + **% de instalações que usam** cada uma (adoção).
3. **Distribuições:** por **versão** (pra ver adoção de update/OTA), **plataforma** (web/apk/ios), **país** (coarse), **locale**.
4. **Instalações ativas (a "lista" pedida):** tabela paginada, ordenável por última vez vista — colunas: `installId` (curto/anônimo), última vez vista, versão, plataforma, país, nº gastos, nº divisões, nº saídas, conexões, usa IA?, dias ativos. **Sem nada sensível.**
5. **Tendência (gráfico):** DAU ao longo de 30 dias.

UX: usar o design system existente (cards, tipografia). Mobile-friendly. Carregamento rápido (consultas D1 simples + paginação).

---

## 10. Privacidade & conformidade

- **Natureza do dado:** pseudônimo (UUID por install) + agregados/contadores + metadados grossos. **Sem PII**, sem conteúdo, sem valores, sem localização fina.
- **LGPD/GDPR (orientação, não aconselhamento jurídico):** telemetria **anônima/agregada com aviso transparente e opt-out fácil** é a prática padrão de apps que respeitam privacidade. O ponto sensível é o `installId` (identificador) → mitigado por minimização dura, ausência de PII e controle do usuário. Se o Julio quiser o teto de conformidade/marketing ("zero telemetria sem consentimento explícito"), o caminho é **opt-in** (§11). **Recomendo registrar a escolha como DEC** no decision-log e refletir na política/aviso do app.
- **Direito ao esquecimento:** como é anônimo, não há "conta" a apagar; desligar o toggle para de enviar. (Opcional v2: endpoint `DELETE /t/:installId` chamado pelo próprio device.)
- **Segurança do admin:** rotas `/admin/*` atrás de token/Access; D1 só acessível via Worker; CORS já restrito a métodos/headers conhecidos.

---

## 11. Decisões a RATIFICAR pelo Julio (antes de codar)

1. **Consentimento:** `telemetryEnabled` **on-by-default** (com aviso + opt-out) — *recomendado pelo conselho p/ cobertura real* — **ou** **opt-in** (pureza máxima, cobertura ~5-15%)?
2. **Lista de métricas (§5):** confirmar o conjunto e **confirmar que "com quem usou" = só `connectionsCount`** (sem identidades). Quer cortar/adicionar algum contador?

(Itens menores que sigo com default se não houver objeção: D1 como storage, bearer token no v1, painel como rota `/admin` no app.)

---

## 12. Fases de entrega (v1) — com ACs e estimativa (Tier 3)

> Tier 3 (brain + fases + AI ≈ ÷3.3). Cada fase: implementar → testar (Vitest/Playwright/tsc/build) → commit/version/deploy → verificar, sem regressão (segue o padrão das entregas anteriores).

**Phase 0 — Ratificação + freebie (≈0,5h).** Julio responde §11; enquanto isso, olhar Cloudflare Observability (§2.1) pra um primeiro pulso. **AC:** decisões registradas como DEC.

**Phase 1 — Backend D1 + ingest (≈10h→~3h).** Add binding `TELEMETRY_DB` (D1) no `wrangler.jsonc` + migração SQL (§6); endpoint `POST /t` com todas as guardas (§7.1). **ACs:** `/t` valida schema fechado, rejeita campos extras (400), upserta `installs`, idempotente em `heartbeats`, country via CF header, caps/rate-limit. Testes do parser/validador.

**Phase 2 — Cliente: domínio + boundary + toggle (≈14h→~4h).** `domain/telemetry` puro (+ testes Vitest com números), `utils/telemetry.ts` (POST best-effort, debounce diário, no-op se off), `AppSettings.telemetryEnabled` + toggle/disclosure i18n pt/en/es, disparo no app open. **ACs:** off → zero request; on → 1 heartbeat/dia; nunca bloqueia/erra visível; só contadores no payload (teste garante ausência de campos proibidos). Build + E2E verdes.

**Phase 3 — Endpoints admin + painel (≈16h→~5h).** `/admin/overview|installs|timeseries` (token-gated) + página `/admin` (cards + barras + tabela paginada + gráfico DAU). **ACs:** sem token → 401; overview/lista corretos contra dados semeados; paginação/ordenação; nada sensível na tela. Smoke E2E do gate admin.

**Phase 4 — Polish (≈8h→~2.5h).** Retenção por coorte, filtros de período, export CSV, microcopy final, doc no brain + DEC. **ACs:** retenção confere com fixture; CSV abre; decision-log atualizado.

**Total v1 ≈ ~15h efetivas (Tier 3)**, entregue em gates testados.

---

## 13. Riscos & mitigações

| Risco | Sev | Mitigação |
|---|---|---|
| On-by-default ferir percepção privacy-first | Médio | Aviso transparente + opt-out fácil + minimização dura + DEC registrada; opt-in continua disponível |
| Re-identificação por contadores raros | Baixo | Sem ligação a indivíduo; país coarse; sem cruzamento com conteúdo; "com quem" = só número |
| Telemetria atrapalhar performance/save | Baixo | Best-effort, idle, debounce diário, try/catch silencioso (padrão crash-log/safe-storage) |
| Vazar campo sem querer | Baixo | Schema fechado no servidor + teste no cliente que falha se aparecer campo proibido |
| D1 não escalar | Baixo (v1) | 1 linha/dia/install; Analytics Engine no v2 se explodir |
| Abuso do endpoint público `/t` | Médio | Caps de tamanho, rate-limit por installId, validação estrita (espelha mailbox) |

---

## 14. Futuro (v2+)

- **Eventos/funis** (Analytics Engine): ordem de ações, "abriu split → confirmou", drop-offs.
- **Cloudflare Access** no `/admin` (login do Julio) substituindo o token.
- **Coortes de retenção** ricas, segmentação por país/versão/plataforma.
- **`DELETE /t/:installId`** (esquecimento ativo) + painel de saúde (crash trends).
- **Rede de conexões** (quem-com-quem) — **só** com decisão de privacidade dedicada (provavelmente nunca, ou só com pseudônimos fortes).

---

## 15. Resumo de uma linha

v1 = **heartbeat diário anônimo** (device computa contadores) → **D1** → **painel mínimo token-gated**, on-by-default com aviso/opt-out e **minimização dura** (só números, zero conteúdo). Falta o Julio ratificar **consentimento** e **lista de métricas** (§11) antes de implementar.
