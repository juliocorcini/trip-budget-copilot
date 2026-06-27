# Leva — "Acerto que chega de verdade": transporte P2P + conexão bilateral + entrega + correções de campo #5

> **Status: ✅ ACTIVE** · **G1 aplicado E DEPLOYADO por Julio (2026-06-27)** — worker em produção (CF `bfa12d49…`); falta só **commit no git** + passo manual no dashboard (Pages Preview) + verificação pós-reset; **G2→G6 são o trabalho acionável**. Os 3 calls de §16 (L-CONNECT, L-SPLIT, L-PLAN) seguem com default adotado (flip em 1 linha).
> **Version cadence:** worker redeploy + app `1.5.5-rc → 1.6.4-rc` (um bump por gate; G6 opcional).
> **Sibling waves:** `2026-06-27-settle-flows-reliability-orchestrator.md` (DEC-364→373, shipped 1.4.13→1.5.5-rc HOJE) — esta leva é o **re-teste de campo** dela: o código cliente do P2P (DEC-366/369) está certo, mas ficou invisível porque o transporte estava **capado por DURAÇÃO** (free tier). Também: `2026-06-25-field-fixes-clarity-2-orchestrator.md`.

---

## ⏱️ Estado de execução (2026-06-27, pós-correções do Julio — verificado por leitura de código + probe ao vivo)

| Item | Estado |
|---|---|
| **R0a — isolamento de ambiente** (DEC-374) | ✅ **FEITO**: `.env.development` + `.env.staging` (`VITE_SYNC_WORKER_URL`=staging) + script `preview:staging`. `npm run dev` e o E2E local (Playwright sobe `npm run dev`) usam staging; `npm run build` (prod) ignora — safe-by-construction. |
| **R0b — hibernação `ShareSignal`+`SyncRoom`** (DEC-383) | ✅ **FEITO no código E DEPLOYADO em produção** (worker `trippilot-sync`, CF version `bfa12d49-515b-4732-90a7-bc671663bc40`). Correto: `state.acceptWebSocket` + `webSocketMessage`/`Close`/`Error` + `getWebSockets()`; SyncRoom usa `alarm` como fonte de verdade. Sem nova migration. ⚠️ **`worker/src/index.ts` ainda staged-but-NÃO-commitado no git** (deploy veio da working tree). |
| `setWebSocketAutoResponse` (ping/pong) | ⚠️ **ausente** — se o cliente envia keep-alive, ainda acorda o DO. Otimização opcional (verificar se o cliente faz ping). |
| rota `GET /health` | ⚠️ **ausente** (probe → 404). Opcional (monitor/CI). |
| **Passo manual no dashboard (R0a, Preview)** | ⚠️ **pendente** — Cloudflare → Workers & Pages → `trippilot` → Settings → Variables → **Preview** → `VITE_SYNC_WORKER_URL=…-staging…` (**NÃO** em Production). O `.env.*` já cobre dev/E2E/preview local; isto cobre o Preview do Pages. |
| **Transporte ao vivo (prod + staging)** | ⛔ **ainda 500 / `error code: 1101`** em AMBOS (re-probado 2026-06-27 ~15:51 UTC). O teto de duração é **por conta e diário** → o dia já estourou; só volta a 2xx **após o reset (28/06 00:00 UTC)** ou no **Workers Paid** (remove o teto na hora). A hibernação já deployada corta o consumo **futuro**, não destrava o dia atual. |

**Baseline de testes (do report do Julio):** 2639/2641 — as 2 falhas são o teste de integração "real worker" caindo **por causa do teto estourado** (não-regressão; voltam a verde após o reset). `tsc` strict OK · `wrangler deploy --dry-run` OK.

**Restante do G1 (antes de declarar fechado):** (1) **commit** do worker + `.env.*` + `package.json` (deploy já feito); (2) **passo manual** no dashboard (Preview env do Pages); (3) opcional: `setWebSocketAutoResponse` + `GET /health`; (4) **verificação pós-reset** — re-probar prod → 2xx + conferir a métrica de duração cair + criar alerta de orçamento; (5) bump app `1.5.6-rc` + release note. **Decisão pendente (L-PLAN):** se quiser verificar/escalar HOJE sem esperar o reset → Workers Paid (US$5).

---

## §0 — Mission

**O que esta leva É:** consertar a razão real pela qual **nada de P2P chega no outro celular** — e fechar o batch de campo do 5º review (seleção de participantes, badge de conectado, carrossel, install, deep-link de ajustes, câmera Android).

**A dor central, nas palavras do Julio:**
> *"Registrei um gasto e dividi com o David — já era pra ter chegado pro David. Não chegou nada. (…) Quando eu adiciono o David, eu tenho as informações dele; mas pro David eu não apareço como pessoa conectada. (…) 'Cobrar saldo' → 'sem internet, vai enviar quando voltar' — mentira, está com internet. (…) 'Gerar link' → 'algo deu errado'. Tem que arrumar tudo isso."*

**A descoberta que unifica quase tudo (causa-raiz REAL, diagnosticada por Julio 2026-06-27 — confiança ALTA, números do dashboard reconciliados com o e-mail da Cloudflare e a doc oficial):** o worker `trippilot-sync` **está no ar e o código está correto** — o que estourou foi o **teto de DURAÇÃO do free tier** (13.000 GB-s/dia), **não** o de requests (17k de 100k/dia, tranquilo) e **não** um bug de código. O `error code: 1101` / HTTP 500 que o curl viu é a Cloudflare **cortando as requisições a Durable Objects** (o `env.X.get().fetch()` passa a lançar quando a conta excede o orçamento diário de duração) até o **reset diário (28/06 00:00 UTC)** — não é uma exceção no nosso código.

**De onde veio a duração (~28,2 "DO-horas vivas"/dia = 101.562 s × 0,128 GB):**
- **~99% veio de UM objeto: o `ShareSignal`** (22,3k de 22,6k GB-s). É um relay de WebSocket que usa **`server.accept()` SEM a WebSocket Hibernation API** → a Cloudflare cobra **o tempo INTEIRO que o socket fica conectado, mesmo ocioso** (e o "sino" toca raríssimo). 1 socket vivo 24h = 11.059 GB-s = **85% de todo o orçamento grátis do dia**.
- **Amplificador (o gatilho real): dev/preview/E2E apontam todos para o worker de PRODUÇÃO** (`config.ts` nunca seta `VITE_SYNC_WORKER_URL`), então **cada aba de teste deixada aberta segurava um socket vivo** no ShareSignal de produção. 4 abas × 7h ≈ 28 DO-horas = o free tier inteiro de um dia.

**Consequência (importante para o escopo):** o app **não caiu** — todo o uso individual (local-first: IndexedDB) e a IA/imagens (vão direto ao Groq/R2, sem DO) seguem 100%. Só caiu a **camada de colaboração/sync** (mesa ao vivo, SyncRoom 2-devices, Mailbox P2P, ping em tempo real, telemetria) — e ela **volta sozinha no reset**. Mas a **causa estrutural** (sockets sem hibernação) reapareceria com **usuários reais**, não só com teste. O wave anterior (DEC-366/369) tem o roteamento certo; ele só ficou invisível porque o transporte estava **capado por duração**.

> **Re-enquadramento do G1:** não é mais "diagnosticar uma exceção 1101 e re-deployar um worker quebrado". É **(a)** estancar o sangramento de teste com **isolamento de ambiente** (dev/preview/E2E → `trippilot-sync-staging`), **(b)** o fix estrutural que faz escalar de graça: **migrar `ShareSignal` + `SyncRoom` para a WebSocket Hibernation API** (~95% menos duração), e **(c)** opcionais: fechar o socket de peer-ping ocioso + decidir sobre o plano Workers Paid (US$5/mês).

**O que esta leva NÃO é:** não mexe na **aritmética do acerto** (centavos, saldos, divisões já corretos — DEC-241/345/346/353); não reescreve o subsistema `debt`/mailbox (reusa DEC-366). Conserta **onde/quando a verdade P2P chega** e **como aparece**, mais o batch de UX.

**O app, em uma linha:** TripPilot é um planejador de orçamento de viagem local-first (PWA + APK) que registra gastos, divide contas e faz acerto entre pessoas — conectadas (P2P E2E) ou por link.

→ Para começar, vá ao **§17**.

---

## §1 — Identity & autonomy contract (você é o executor)

Você é um(a) engenheiro(a) full-stack sênior aplicando esta leva **sozinho(a), nesta sessão, de ponta a ponta**: investiga (re-lendo o arquivo do §6 antes de editar), codifica domínio→UI, testa junto, commita por item, e **no fim de cada gate**: suíte verde + build + `tsc` + smoke + bump de versão + **deploy** + dev-log + promover DECs. As 9 regras do §1 do SKILL valem como **absolutas** (resumo no §3 e no kickoff). Em caso de bifurcação nova → council inline (1 request, sem subagent) → `DEC-NNN (PROPOSED)` → **continue**.

---

## §2 — Reading order (carregue contexto UMA vez)

1. Este doc **§0–§9** (uma vez).
2. `TripPilot/src/dev-log.md` (Current State — a leva settle-flows acabou de shippar 1.5.5-rc).
3. Só as DECs citadas: **DEC-366** (connected ⇒ debt accept-first, real-time) · **DEC-369/371** (pending acionável + 15 estados) · **DEC-241** (connected nasce pending / não-conectado deve agora) · **DEC-362/364** (install flow) · **DEC-293** (carrossel home) · novos **DEC-374→384** (§7).
4. Entidades do `product-spec.md` envolvidas: `PeerLink`, `Participant`, `ParticipantShare`, `Transaction`, `debt`/mailbox.
5. Sibling orchestrator (`settle-flows-reliability`) só para tom/voz.

**Não re-leia o brain inteiro por milestone.** Re-leia o **arquivo do §6** do item antes de editar (símbolos se movem).

---

## §3 — Non-negotiables (ÂNCORA) — quebrar uma é defeito mesmo com teste verde

**Herdadas (app-wide):**
- **A1** Dinheiro = inteiro em centavos; **a aritmética do acerto é INVARIANTE** nesta leva (saldos idênticos ao baseline após cada mudança).
- **A2** Domínio = TS puro, zero React; lógica fora de componentes/transporte.
- **A3** Texto de UI sempre via `t()` (pt/en/es); **código/identificadores/commits em inglês**.
- **A4** Hide-never-delete (tombstone); nunca apagar ação/feature.
- **A5** **Nunca bloquear o registro de gasto** — toda entrega/stamp P2P é best-effort em background; salvar retorna na hora.
- **A6** Invariância de dados: ninguém perde gasto/saldo por causa desta leva.

**Novas desta leva:**
- **Â-TRANSPORT** — depois do G1: **(1)** dev/preview/E2E **NUNCA** apontam para o worker de produção (sempre `staging` via `VITE_SYNC_WORKER_URL`) — o orçamento de produção não é mais drenado por teste; **(2)** todo WebSocket DO (`ShareSignal`, `SyncRoom`) usa a **Hibernation API** — socket ocioso custa ~0 de duração; **(3)** todo endpoint de DO responde 2xx (provado por probe **após o reset diário**); **(4)** um sinal de saúde de transporte distingue "offline" de "servidor capado/falhou". Existe um **alerta de orçamento** (duração) no dashboard.
- **Â-HONEST** — a UI **nunca mente** "sem internet" quando está online; cada `delivered:false` carrega um **motivo** (offline | server_error | no_peer_key) e copy honesta + retry real.
- **Â-BILATERAL** — conectar de um lado **aparece nos dois**; quem me adicionou vira uma pessoa **utilizável** no meu acerto (não some num "Conexões" morto).
- **Â-CONSISTENT-SPLIT** — "Registrar gasto" dividido com um conectado entrega **igual** ao "Dividir conta" (mesmo caminho DEC-366); nunca fica "em dia" silencioso.

---

## §4 — Baseline: o que JÁ existe (reusar, não reinventar)

Confirmado lendo o código (2026-06-27):

| Peça que já existe | Arquivo → símbolo | Como reusar nesta leva |
|---|---|---|
| Entrega connected ⇒ debt accept-first, real-time (DEC-366) | `domain/orchestrators/mailbox-orchestrators.ts › shareDebtWithPeer`, `flushOutbox`, `drainMailboxIntoApp` | É **o** caminho de entrega; G3 só **liga** o caminho manual nele; G1 destrava o transporte que ele usa. |
| Roteamento de entrega puro (DEC-366) | `domain/settle-flows/p2p-delivery.ts › resolveP2pDelivery`, `resolveSettlementDelivery` | Reusar; G2 acrescenta o **motivo** ao retorno (não muda a decisão). |
| Envio do acerto (Acerto de Contas) | `features/shared/SharedExpensesPage.tsx › handleSendSettlementDebt` (~L473) | G2 corrige a copy mentirosa + remove `hasPublicKey:true` hardcoded (L489). |
| Connect handshake + reverse link | `domain/orchestrators/sync-orchestrators.ts › upsertPeerLinkFromConnect` (L126), `pairParticipantFromIdentity` (L140) | G2: lado reverso passa a **superficializar a pessoa** (hoje `participantId:null`). |
| 15 estados + chip + detalhe (DEC-369/371) | `domain/settle-flows/settle-state.ts`, `SharedExpensesPage` detail sheet | G2/G3 reusam para mostrar "aguardando aceitar" no remetente. |
| Carrossel de alertas da home (DEC-293) | `features/dashboard/HomeAlertsCarousel.tsx`, `home-alerts.ts › selectHomeAlertIds` | G5: altura adaptativa + dedupe do card de install. |
| Install nudge + sheet (DEC-362/364) | `features/install/InstallNudge.tsx`, `install-nudge.ts` | G5: política de dispensa (só soneca) + dedupe com o card do carrossel. |
| Deep-link de ajustes por `?section=` | `features/settings/SettingsPage.tsx` (scrollIntoView por `section`) | G5: `ModeGuard` aponta para `?section=mode`. |
| Scanner de QR / câmera | `components/QrScanner.tsx › getUserMedia({video:{facingMode}})` (~L151) | G6 (P2): preferir lente traseira principal + zoom. |
| WebSocket DOs (relay/sync) | `worker/src/index.ts › ShareSignal` (L1118, `server.accept()` L1134) + `SyncRoom` (L1022, `server.accept()` L1055) — **sem** Hibernation | G1: migrar para `ctx.acceptWebSocket()` + `webSocketMessage`/`webSocketClose` + `setWebSocketAutoResponse` (ping). |
| URL do worker no cliente | `src/data/sync/config.ts › getSyncWorkerUrl` (L4-8): `VITE_SYNC_WORKER_URL ?? 'https://trippilot-sync.trippilot.workers.dev'` | G1: dev/preview/E2E setam `VITE_SYNC_WORKER_URL` = staging. |
| Socket sempre-ligado de peer-ping | `src/utils/mailbox-boot.ts › registerPeerPingSubscription` (L93-103) — abre e mantém o socket em foreground | G1 (opcional m4): fechar após X min ocioso. |
| Config do worker / staging | `worker/wrangler.jsonc` (um worker `trippilot-sync`, sem env `staging`); `trippilot-sync-staging` é um worker deployado à parte; `observability.enabled:true` | G1: confirmar/definir o staging + apontar o cliente de teste para ele. |

**GAP confirmado:** o transporte está **capado por DURAÇÃO** (free tier 13k GB-s/dia) — ~99% consumida pelo `ShareSignal` WebSocket **sem hibernação** (`server.accept()`), amplificado por **dev/preview/E2E apontando para produção** (`config.ts` default prod). O `500/1101` é o corte da Cloudflare até o reset diário, **não** um bug de código. Além disso (camada cliente, independente do transporte): o lado reverso da conexão só cria `peerLink(participantId:null)`; o caminho manual de gasto **nunca chama** `shareDebtWithPeer`; e `delivered:false` vira "sem internet" para qualquer causa.

---

## §5 — Change-set normalizado (do review → itens)

**P0 — Transporte & entrega (o coração):**
- **R0a** — Isolamento de ambiente ($0, imediato): dev/preview/E2E param de drenar o orçamento de produção (apontar para `staging`). → **G1** (estanca o sangramento).
- **R0b** — Hibernação estrutural: `ShareSignal` + `SyncRoom` migram para a WebSocket Hibernation API (~95% menos duração) → escala de graça. → **G1** (keystone, tudo de colaboração depende disto).
- **R0c** — Opcionais: fechar o socket de peer-ping ocioso + decisão sobre o plano Workers Paid (US$5/mês). → **G1** (m4) + **§16 L-PLAN**.
- **C1** — Conexão só de um lado: quem me adicionou não vira pessoa utilizável no meu aparelho. → **G2** (+ DEC-376).
- **C2** — "Sem internet, vai enviar quando voltar" mentiroso (online); link "algo deu errado". → **G2** (+ DEC-375).
- **C3** — "Registrar gasto" dividido com conectado não entrega e fica "em dia"; "Dividir conta" entrega. → **G3** (+ DEC-377, L-SPLIT).

**P1 — Captura & onboarding UX:**
- **U1** — Toggle "compartilhado" pré-seleciona TODAS as pessoas. → **G4** (DEC-378).
- **U2** — Sem distinção visual de pessoa conectada vs não. → **G4** (DEC-378).
- **X1** — Carrossel da home reserva a altura do maior card → vão vazio embaixo dos curtos. → **G5** (DEC-379).
- **X2** — Card redundante "instale na tela inicial pra proteger seus dados" no carrossel duplica o InstallNudge. → **G5** (DEC-380).
- **X3** — InstallNudge tem "não mostrar de novo" permanente fácil; Julio quer só soneca (7 dias / agora não). → **G5** (DEC-380).
- **X4** — "Ir para os ajustes" (recurso avançado) não cai no toggle modo simples/completo. → **G5** (DEC-381).

**P2 — Câmera (best-effort, pode adiar):**
- **Z1** — Android pega grande-angular; zoom 1×/2×/3× não funciona. → **G6** (DEC-382).

---

## §6 — Root-cause map (código ↔ mudança) — RE-LEIA o arquivo antes de editar

| # | Sintoma (palavras do Julio) | Causa-raiz — arquivo → símbolo (exato) | Direção do fix | Gate |
|---|---|---|---|---|
| R0a | "não chega nada"; "gerar link → algo deu errado" (causa imediata: orçamento drenado por teste) | **`src/data/sync/config.ts › getSyncWorkerUrl`** (L4-8) — `VITE_SYNC_WORKER_URL` nunca setado → dev/preview/E2E batem em **produção**; abas de teste seguram sockets vivos no ShareSignal de prod | setar `VITE_SYNC_WORKER_URL`=`trippilot-sync-staging` em dev/preview/E2E (`.env`/CI/playwright); fechar abas de prod; **estanca o sangramento ($0)** | **G1** |
| R0b | mesma dor, **causa estrutural** (reapareceria com usuários reais) | **`worker/src/index.ts › ShareSignal`** (L1118; `server.accept()` L1134) + **`SyncRoom`** (L1022; `server.accept()` L1055) — WebSocket **sem Hibernation API** → cobra duração o tempo todo, mesmo ocioso (~99% do gasto veio do ShareSignal) | migrar para **`ctx.acceptWebSocket(server)`** + handlers `webSocketMessage`/`webSocketClose`/`webSocketError` + `state.setWebSocketAutoResponse` p/ ping → **~95% menos duração**; `wrangler deploy`; verificar a métrica de duração cair | **G1** |
| R0c | socket "sempre-ligado" acumula tempo morto; risco de novo corte | **`src/utils/mailbox-boot.ts › registerPeerPingSubscription`** (L93-103) mantém o socket em foreground; **decisão de plano** (free vs Workers Paid US$5) | (opcional) fechar/reabrir o socket após X min ocioso; alerta de orçamento no dashboard; **§16 L-PLAN** decide o plano | **G1 (m4) / §16** |
| — | verificação do transporte (todos) | o `500/1101` é o **corte por duração até o reset diário (28/06 00:00 UTC)**, não um bug; o app individual nunca caiu (local-first) | adicionar `GET /health` (round-trip leve de DO) + sinal de saúde no cliente (distingue offline de capado/falhou); **re-probar 2xx após o reset** ou após liberar orçamento | **G1** |
| C1 | "pro David eu não apareço como conectado"; "não tem nem pessoas adicionadas do David" | **`domain/orchestrators/sync-orchestrators.ts › upsertPeerLinkFromConnect`** (L126-132) cria `peerLink` com **`participantId: null`** no lado reverso — A nunca vira pessoa de viagem em B; e o `sendConnectHandshake` trafega por `POST /mailbox` (capado por duração até G1/reset, R0) | após G1: o connect-back **superficializa A como pessoa utilizável** em B (bilateral) e/ou cria o participante; garantir que o handshake entrega e B drena; mostrar conexão dos dois lados (DEC-376) | **G2** |
| C2 | "cobrar saldo → sem internet… mentira, está com internet" | **`features/shared/SharedExpensesPage.tsx › handleSendSettlementDebt`** (~L498) → `shareDebtWithPeer` retorna `{delivered:false}` → toast `t('p2p.queued')` = "Sem internet — vai enviar quando voltar" para **qualquer** causa; `hasPublicKey:true` hardcoded (L489) | `shareDebtWithPeer`/`flushOutbox` retornam **motivo** (`ok\|offline\|server_error\|no_peer_key`); UI mostra copy honesta + retry; parar de hardcodar `hasPublicKey` (DEC-375) | **G2** |
| C3 | "gasto manual dividido com David não chega e fica em dia"; "dividir conta sim aparece" | **`features/expenses/QuickAddPage.tsx › persistExpense`/`buildExpense`** → `resolvePayerExpense` cria share **`pending`** p/ conectado (DEC-241), mas o caminho manual **nunca chama `shareDebtWithPeer`** (só o caminho dividir/live-split chama) → nada entregue, lê neutro | ligar o split manual de conectado ao **caminho DEC-366** (`shareDebtWithPeer`, accept-first) **no salvar**; remetente mostra "aguardando aceitar", nunca "em dia" (DEC-377, L-SPLIT) | **G3** |
| U1 | "compartilhado não é pra marcar todo mundo" | **`QuickAddPage.tsx › toggleShared`** (L306-314): `setSelectedParticipantIds(participants.map(p=>p.id))` | pré-selecionar só o dono (+ pagador quando houver); mostrar todos, user escolhe (DEC-378) | **G4** |
| U2 | "diferenciar as pessoas conectadas (bolinha verde)" | picker de participantes + listas de pessoas; info = `participant.linkedActorId !== null` | badge/ponto de "conectado" no picker e nas listas (DEC-378) | **G4** |
| X1 | "embaixo do card tem um espaço bem grande" | **`features/dashboard/HomeAlertsCarousel.tsx`** (container L63-80) sem gestão de altura — altura do flex = maior filho | medir a altura do slide ativo e aplicar no container (animado) (DEC-379) | **G5** |
| X2 | "esse card menor de instalar não precisa mais" | **`features/dashboard/home-alerts.ts › storage_warning`** duplica o `InstallNudge` real e só abre ajustes | dedupe — suprimir o card de install/storage do carrossel quando o InstallNudge real é o dono (iOS não instalado) (DEC-380) | **G5** |
| X3 | "não quero 'nunca mais', quero soneca 7 dias / agora não" | **`features/install/InstallNudge.tsx › never()`** (L22-25, "não mostrar de novo") | remover o silêncio permanente como opção fácil; X = soneca (7 dias / agora não); o user precisa ver de novo (DEC-380) | **G5** |
| X4 | "'ir para os ajustes' devia cair no toggle simples/completo" | `ModeGuard` `go_settings` → ajustes sem âncora; `SettingsPage` já suporta `?section=` | `ModeGuard` → `/settings?section=mode`; SettingsPage rola e **destaca** o toggle App simples/completo (DEC-381) | **G5** |
| Z1 | "Android pega grande-angular; zoom não funciona" | **`components/QrScanner.tsx › getUserMedia({video:{facingMode:'environment'}})`** (~L151) | best-effort: `enumerateDevices`, preferir a lente traseira principal; crop-zoom default p/ grande-angular; corrigir derivação do zoom (DEC-382) | **G6 (P2)** |

---

## §7 — Decisões + councils inline (sem subagent)

### DEC-374 — Isolamento de ambiente: dev/preview/E2E nunca apontam para o worker de produção [direto, keystone-imediato]
**Direto (infra/config, não bifurcação de produto).** A causa-raiz do corte (curl 500/1101) foi o **teto de DURAÇÃO do free tier** (13k GB-s/dia), **não** requests nem bug de código. O **gatilho** foi `src/data/sync/config.ts › getSyncWorkerUrl` (L4-8) apontar para **produção** por padrão (`VITE_SYNC_WORKER_URL` nunca setado), então dev/preview/E2E seguravam sockets vivos no `ShareSignal` de prod. **Fix imediato ($0):** setar `VITE_SYNC_WORKER_URL`=`trippilot-sync-staging` em dev (`.env`/`.env.local`), preview e **Playwright/CI**; fechar abas de produção abertas. Isso sozinho provavelmente devolve a conta ao free tier. **Sem mudança de aritmética.** *Nota de verificação:* os endpoints de DO de **produção** só voltam a 2xx **após o reset diário (28/06 00:00 UTC)** ou após liberar orçamento — a prova do fix é a **métrica de duração** cair, não um curl imediato.

### DEC-383 — Migração para WebSocket Hibernation API em `ShareSignal` + `SyncRoom` (estrutural, escala de graça) [direto, wave 2026-06-27] (Â-TRANSPORT)
**Direto (correção estrutural localizada).** `ShareSignal` (L1118) e `SyncRoom` (L1022) usam `server.accept()` (L1134/L1055) **sem** a Hibernation API → a Cloudflare cobra **toda** a duração do socket conectado, mesmo ocioso (~99% do gasto veio do ShareSignal; 1 socket 24h = 85% do orçamento diário). **Fix:** migrar para **`ctx.acceptWebSocket(server)`** + handlers de instância `webSocketMessage`/`webSocketClose`/`webSocketError` + **`state.setWebSocketAutoResponse(new WebSocketRequestResponsePair('ping','pong'))`** para os keep-alives — assim o socket ocioso **não custa duração**. Doc da Cloudflare é literal: o mesmo relay sem hibernação ≈ US$133/mês vs ≈ US$1,91/mês **com** hibernação (~95% de queda); como nossos "sinos" são raríssimos, a economia é ainda maior. Sem mudança de migração no `wrangler.jsonc` (hibernação é API de runtime). Sem mudança de aritmética. **Confiança: ALTA** (é a solução recomendada na doc para exatamente este caso).

### DEC-384 — Opcionais de duração: fechar o peer-ping ocioso + decisão de plano (Workers Paid US$5) [direto + §16 L-PLAN, wave 2026-06-27]
**Direto + lock leve.** **(a)** `src/utils/mailbox-boot.ts › registerPeerPingSubscription` (L93-103) mantém um socket sempre-ligado em foreground — fechar/reabrir após X min ocioso reduz o tempo morto acumulado (best-effort; o boot/focus-drain ainda entrega, só mais devagar). **(b)** **L-PLAN (§16):** decidir entre **(default) seguir no free tier** apoiado no R0a+R0b (suficiente para dezenas/centenas de colaboradores após a hibernação) **ou** assinar **Workers Paid (US$5/mês)** para tirar o teto diário e ter margem/zero-risco-de-corte. Recomendação: free tier + hibernação primeiro; Paid só se o uso real pedir. **(c)** Criar um **alerta de orçamento de duração** no dashboard como backstop.

### Council C-A → DEC-376 — Modelo de conexão bilateral

**Decision Brief (neutro, ≤200 palavras):** Quando A escaneia o QR de identidade de B, A cria um **participante de viagem** para B + um `peerLink`, e envia um connect handshake de volta a B (`POST /mailbox`). No lado de B, ao drenar o envelope de connect, `upsertPeerLinkFromConnect` cria **só um `peerLink` com `participantId: null`** — B vê A em "Conexões", mas **A não vira pessoa de viagem** em B (não aparece em Pessoas/Acerto). Julio: *"quando um adiciona o outro, tem que aparecer a conexão pros 2"*. Fato extra: hoje o handshake nem entrega (R0/G1 conserta o transporte). Bias a resistir: "criar participante automático é invasivo" — Julio pediu explicitamente bilateral. Pergunta: o connect-back deve **criar/superficializar A como pessoa utilizável** em B, ou ficar conexão-only + adicionar em 1 toque?

**Vozes (escritas às cegas):**
- **Architect** — `peerLink(participantId:null)` é o estado certo de armazenamento (não polui a viagem com um participante até haver contexto de viagem), mas a **camada de apresentação** deve listar conexões sem participante como pessoas selecionáveis no Acerto e no picker, materializando o participante on-demand (1ª divisão/cobrança). Rec: superficializar via apresentação + materialização lazy. Confiança: ALTA. Outros perdem: sem viagem ativa em B, "criar participante" precisa de uma viagem-alvo — apresentação resolve sem esse acoplamento.
- **Advocate (user)** — A expectativa do Julio é simétrica: "eu te adicionei, você me vê". Qualquer coisa que exija B "achar em Conexões e adicionar" reproduz o bug percebido. Rec: A aparece automaticamente como pessoa conectada em B (na viagem ativa, ou prontamente adicionável com aviso). Confiança: ALTA. Outros perdem: o "aviso/badge de novo conectado" fecha o loop emocional ("apareceu!").
- **Critic** — Criar participante automático em B pode duplicar pessoas (se B já tinha "Júlio" manual) ou criar em viagem errada. Rec: superficializar como conexão utilizável + **dedupe por `actorId`** + materializar no uso, com merge se já existir. Confiança: MÉDIA. Outros perdem: o risco real é duplicação, não a criação em si.

**Red Team (matar a opção líder):** "Materialização lazy + apresentação" pode deixar B confuso ("o Júlio me adicionou mas não vejo nada novo até eu agir"). Se o objetivo do Julio é *ver* a conexão imediatamente, apresentação pura sem nenhum aviso falha. → Mitigação: um **aviso/badge de "novo conectado"** + a pessoa já visível e selecionável (mesmo sem participante materializado).

**Síntese (Chair):** **Consenso** — o estado de armazenamento `peerLink(participantId:null)` fica; o erro é a **superficialização**. **Tensão** — Architect/Critic (lazy + dedupe) vs Advocate (visível já). **Recomendação (lente Advocate domina, pois é exatamente a dor do Julio):** após G1, o connect-back deixa A **visível e utilizável** em B imediatamente (aparece em Pessoas/Conexões com badge "novo/conectado", selecionável no Acerto e no picker), com **materialização do participante on-demand** e **dedupe por `actorId`** (merge se já existir). Bilateral por padrão. **Condições:** dedupe por `actorId`; nunca duplicar pessoa; respeitar hide-never-delete. **O que viraria:** se em campo a criação automática gerar viagem-errada/duplicatas → recuar para conexão-only + "adicionar em 1 toque" com badge. **L-CONNECT (§16):** default adotado = bilateral visível; Julio confirma ou flipa.

### Council C-B → DEC-377 — Entrega do split manual com pessoa conectada (L-SPLIT)

**Decision Brief (neutro, ≤200 palavras):** "Dividir conta"/live-split com um conectado **entrega** uma dívida (David mostrou "deve 17"). Mas "Registrar gasto" → compartilhado → conectado **cria a share `pending` localmente e NÃO chama `shareDebtWithPeer`** — nada chega a David e o remetente lê "em dia". DEC-241: conectado nasce `pending` (não deve até aceitar); não-conectado deve agora (owner-truth). DEC-366: conectado ⇒ debt accept-first via `shareDebtWithPeer`, real-time. Julio: *"registrei e dividi com o David, já era pra ter chegado pro David"* (espera entrega imediata no salvar, igual ao dividir). Bias a resistir: "auto-enviar em todo salvar é invasivo". Pergunta: o split manual de conectado deve **auto-entregar a dívida no salvar** (igual dividir) ou só quando o user clica "enviar"?

**Vozes (escritas às cegas):**
- **Architect** — DEC-366 já definiu o caminho canônico (accept-first via `shareDebtWithPeer`). O gap é puramente **fiação**: o caminho manual não chama o caminho de entrega. Rec: rotear o split manual de conectado pelo mesmo `shareDebtWithPeer` no salvar (best-effort, background, A5). Confiança: ALTA. Outros perdem: como já é accept-first, "auto-enviar" não cria dívida real até o aceite — o medo de "invasivo" é menor do que parece.
- **Advocate** — Inconsistência entre "dividir" e "registrar gasto" é a pior UX: mesma intenção, resultados diferentes. O Julio espera que registrar = chegar. Rec: auto-entregar no salvar; remetente vê "aguardando aceitar". Confiança: ALTA. Outros perdem: o status correto no remetente (não "em dia") é metade do conserto.
- **Critic** — Auto-enviar no salvar pode disparar entregas indesejadas se o user só estava registrando para si. Mas o user **marcou compartilhado + escolheu a pessoa** — intenção explícita. Rec: auto-entregar **somente** para quem foi explicitamente selecionado + conectado; manual undo na hora. Confiança: MÉDIA. Outros perdem: precisa de idempotência (`externalRef`) p/ re-salvar não duplicar.

**Red Team:** Se o user edita o mesmo gasto manual 3×, auto-enviar 3× spammaria o David. → Mitigação: idempotência por `externalRef` (já existe no caminho debt) + só enviar o delta/estado atual, não um novo envelope por edição.

**Síntese (Chair):** **Consenso** — não é decisão nova de produto, é **ligar o caminho manual no DEC-366** + corrigir o status do remetente. **Tensão** — auto-no-salvar (Advocate) vs sob-clique (Critic). **Recomendação (lente Advocate domina — é a expectativa literal do Julio e a consistência com "dividir"):** o split manual com um conectado **auto-entrega como debt accept-first no salvar** (mesmo `shareDebtWithPeer`, best-effort/background, idempotente por `externalRef`), e o remetente vê **"aguardando {nome} aceitar"** (DEC-369/371), nunca "em dia". Não-conectado segue owner-truth (DEC-241). **Condições:** só os explicitamente selecionados + conectados; idempotência; nunca bloquear o salvar (A5); aritmética invariante (a dívida só entra no saldo no aceite). **O que viraria:** se entregas indesejadas aparecerem em campo → mover para "enviar" explícito com um nudge pós-salvar. **L-SPLIT (§16):** default adotado = auto-entregar no salvar; Julio confirma ou flipa.

### DEC-375 — Status de entrega honesto (matar o "sem internet" mentiroso) [direto + council-lite]
`shareDebtWithPeer`/`announcePaymentToPeer`/`flushOutbox` passam a retornar um **motivo** (`ok | queued_offline | server_error | no_peer_key`). A UI (`SharedExpensesPage`) mapeia: `queued_offline` → "Sem internet — vai enviar quando voltar" (o único caso em que a frase é verdade); `server_error` → "Não consegui enviar agora — tentar de novo" + botão de retry real; `no_peer_key` → "Conecte-se com {nome} primeiro para enviar". Remove o `hasPublicKey:true` hardcoded (lê o `peerLink` real). Distinção offline vs servidor usa o sinal de saúde do DEC-374. **Â-HONEST.**

### Council-lite C-C → DEC-380 — Consolidação do install (dedupe + dispensa)
**Brief:** dois lugares pedem instalação: (1) o **`InstallNudge`** real (banner/sheet, DEC-362/364) e (2) um **card no carrossel da home** ("instale na tela inicial pra proteger seus dados", `storage_warning`) que só abre ajustes. Julio: *"esse menor não precisa mais; e o nudge não devia ter 'nunca mais', só soneca 7 dias / agora não — quero que a pessoa veja de novo"*.
- **Architect:** um dono por intenção. O `InstallNudge` é o canal de install; o card do carrossel é redundante e dead-ends em ajustes. Rec: suprimir o card de install/storage do carrossel quando o InstallNudge é aplicável (iOS/Android não instalado).
- **Advocate:** "nunca mais" permanente fácil mata a reconversão; soneca respeita sem silenciar pra sempre. Rec: X = soneca (7 dias); oferecer "agora não"; tirar o "não mostrar de novo" do caminho fácil.
**Síntese:** **(a)** dedupe — o card de install/storage some do carrossel quando o `InstallNudge` cobre a instalação (mantém o card só se for sobre **persistência/backup**, não install); **(b)** dispensa = só soneca (X = 7 dias, "agora não"); remover o "não mostrar de novo" como ação fácil (no máximo escondido em ajustes). **Â4:** nada é deletado — o nudge volta. Confiança: ALTA.

### DEC-378 — Seleção de participantes não marca todos + badge de conectado [direto]
`toggleShared` pré-seleciona **só o dono** (+ pagador quando já escolhido), nunca todos; mostra todos, o user marca. Picker + listas de pessoas ganham um **indicador de "conectado"** (`linkedActorId !== null`) — um ponto/badge consistente. Para muitas pessoas (40+), marcar todos era hostil.

### DEC-379 — Carrossel da home com altura adaptativa [direto]
`HomeAlertsCarousel` mede a altura do **slide ativo** (ResizeObserver/medição) e aplica no container com transição, em vez de herdar a altura do maior slide. Acaba o "vão vazio" sob cards curtos. Sem mexer no conteúdo dos alertas (DEC-293).

### DEC-381 — Deep-link do recurso avançado para o toggle de modo [direto]
`ModeGuard` "Ir para os ajustes" → `/settings?section=mode`; `SettingsPage` rola até e **destaca** o toggle App simples/completo (reusa o padrão `?section=`). O user que clicou já chega com a ação de ativar à mão.

### DEC-382 — Câmera Android: lente traseira principal + zoom (best-effort, P2) [direto]
`QrScanner` tenta `enumerateDevices` e prefere a lente traseira **principal** (evita grande-angular), aplica um zoom default de crop quando só há grande-angular, e corrige a derivação do zoom (`applyConstraints({advanced:[{zoom}]})` quando suportado). Best-effort; se a plataforma não expõe, degrada para o atual. **P2 — pode ser adiado** (Julio já marcou como conhecido/menor prioridade).

---

## §8 — Test strategy (testar JUNTO com a mudança)

- **Domínio puro primeiro (>90%):** `resolveSettlementDelivery`/`resolveP2pDelivery` ganham casos do **motivo** (DEC-375); a nova função pura de roteamento do split manual (DEC-377) tem testes com valores concretos (conectado ⇒ entrega+pending; não-conectado ⇒ owner-owed; idempotência por `externalRef`); `planRemoveConnection`-style para a superficialização bilateral (DEC-376) se houver função pura.
- **Reusar & estender** os testes existentes de `p2p-delivery`/`settle-state` — não duplicar.
- **Worker (G1):** o `1101` por duração **não** é reproduzível localmente (é cota de conta). Se houver harness de worker (vitest + miniflare), validar a **hibernação** (`acceptWebSocket` recebe `webSocketMessage`; auto-response `ping`→`pong`; `getWebSockets()` reidrata) e o `GET /health`; e que `getSyncWorkerUrl()` resolve staging quando `VITE_SYNC_WORKER_URL` está setado. Probe via curl dos endpoints **após o reset** documentado no dev-log.
- **UI crítica (E2E >70%):** jornada "registrar gasto compartilhado com conectado → remetente vê 'aguardando aceitar'"; "toggle compartilhado não marca todos"; carrossel altura; deep-link de modo.
- **Invariância de dados (A1/A6):** asserts de que saldos/centavos são **idênticos ao baseline** após cada gate (a dívida só entra no saldo no aceite).
- **"Suíte verde entre gates"** = 0 falhas além do baseline documentado no G0 (ex.: os 2 testes WebCrypto `split-live-loop` que só passam no CI Node 22).

---

## §9 — Per-milestone protocol (5-point self-check)

Antes de cada commit de milestone:
1. Liste os AC satisfeitos (IDs do gate).
2. Cite **3 AC anteriores em risco de regressão** e verifique (sempre a **invariância de saldo** A1/A6 e **nunca bloquear o gasto** A5).
3. Rode os testes — **sem novas falhas**.
4. Sinalize qualquer arquivo tocado **fora** do escopo do milestone.
5. Atualize `src/dev-log.md` (o que mudou, testes, riscos).

**Fronteira de gate:** re-leia o §3 + o escopo do próximo gate + o Current State do dev-log; imprima o **ANCHOR block** + a linha **CURRENT STATE** (gate / último commit / testes / riscos / escopo). **A cada 3 milestones:** refresh leve (regras críticas + dev-log).

**ANCHOR block (cole a cada 3 milestones / em cada fronteira de gate):**
```
ÂNCORA — Acerto que chega de verdade
- A aritmética do acerto é INVARIANTE (saldos idênticos ao baseline; dívida só entra no aceite).
- Nunca bloquear o registro de gasto; entrega/stamp P2P é best-effort em background.
- Pós-G1: todo endpoint de DO responde 2xx (Â-TRANSPORT). UI nunca mente "sem internet" online (Â-HONEST).
- Conectar aparece nos DOIS lados (Â-BILATERAL). "Registrar gasto" dividido entrega igual a "Dividir conta" (Â-CONSISTENT-SPLIT).
- Hide-never-delete; t() sempre; código em inglês; reusar DEC-366/369/371, não reinventar.
CURRENT STATE: gate=<g> · last_commit=<sha> · tests=<n passing/known-base> · risks=<...> · scope=<itens>
```

---

## §10 — THE BUILD — gates G0 → G6

### G0 — Setup & baseline (sempre)
- **Why:** referência de regressão + provar o estado quebrado do transporte com evidência.
- **Faça:** `npm install`; `npm run test` + `npm run build` + `tsc --noEmit` (+ E2E se o ambiente suportar) → **registre as contagens baseline**; seed/atualize `src/dev-log.md` (Current State + tabela de milestones desta leva); adicione DEC-374→384 como `PROPOSED`; **re-probe o worker** (curl dos 3 endpoints de DO) e cole a saída no dev-log como a evidência viva do R0; confirme o pipeline de deploy + se `wrangler` está autenticado (decide se G1 pode rodar nesta sessão).
- **AC:** baseline verde documentado; dev-log seedado; DECs `PROPOSED`; evidência do 500/1101 registrada; status do `wrangler` conhecido.

### G1 — TRANSPORTE: duração/custo (keystone P0) · **DEC-374 + DEC-383 + DEC-384** · worker redeploy + app `1.5.6-rc`
- **Why:** o teto de **duração** do free tier foi exaurido (~99% pelo `ShareSignal` WebSocket sem hibernação), amplificado por teste batendo em produção. **Toda a colaboração depende de estancar isto e de a hibernação fazer escalar de graça.** O app individual nunca caiu (local-first).
- **Root cause:** `config.ts` aponta teste→prod (R0a); `ShareSignal`/`SyncRoom` usam `server.accept()` sem Hibernation (R0b); peer-ping sempre-ligado (R0c). O `500/1101` é o corte por duração até o reset diário (28/06 00:00 UTC), não um bug de código.
- **Change:**
  - **m1 (R0a) ✅ FEITO** — isolamento de ambiente: `.env.development` + `.env.staging` setam `VITE_SYNC_WORKER_URL`=`trippilot-sync-staging`; script `preview:staging` adicionado; `npm run dev` + E2E local usam staging; prod build ignora. Staging confirmado no ar.
  - **m2 (R0b — `ShareSignal`) ✅ FEITO + DEPLOYADO** — migrado para `this.state.acceptWebSocket(server)` + `webSocketMessage`/`webSocketClose`/`webSocketError` + `getWebSockets()` (sem array em memória; guarda de tamanho de frame + max-sockets). Em produção (CF `bfa12d49…`). ⚠️ **falta** `setWebSocketAutoResponse(new WebSocketRequestResponsePair('ping','pong'))` (opcional, se o cliente faz ping).
  - **m3 (R0b — `SyncRoom`) ✅ FEITO + DEPLOYADO** — mesma migração (acceptWebSocket + relay + `alarm` como fonte de verdade que sobrevive à hibernação), protocolo de sync preservado.
  - **m4 (R0c, opcional)** — `mailbox-boot.ts`: fechar o socket de peer-ping após X min ocioso (reabrir no próximo foreground/drain). Best-effort; não regredir a entrega (boot/focus-drain continua). **Pendente.**
  - **m5 (commit + saúde + verificação) ⏳ PENDENTE** — o `wrangler deploy` **já foi feito** (worker em produção); falta **commit no git** do `worker/src/index.ts` + `.env.*` + `package.json` (hoje staged, não commitados); **passo manual** no dashboard (Pages → Preview env `VITE_SYNC_WORKER_URL`=staging); opcional `GET /health` + sinal de saúde no cliente (alimenta DEC-375); **verificação só após o reset (28/06 00:00 UTC) ou no Workers Paid** — re-probar prod → 2xx + conferir a métrica de duração cair; criar **alerta de orçamento**. Bump app `1.5.6-rc`.
- **AC:** dev/preview/E2E não tocam mais produção (provado: a métrica de duração de produção para de subir com teste); `ShareSignal` e `SyncRoom` aceitam socket via `acceptWebSocket` (socket ocioso não acumula duração); `/health` responde; o cliente diferencia offline de capado; **nenhuma mudança de aritmética**; a colaboração volta após o reset com gasto ~95% menor.
- **Tests:** se houver harness de worker (vitest/miniflare), teste de que `webSocketMessage` recebe a mensagem e o auto-response responde 'ping'; teste do `/health`; probe pós-reset documentado no dev-log; um teste de que `getSyncWorkerUrl()` resolve para staging quando `VITE_SYNC_WORKER_URL` está setado.
- **Commit/Deploy:** `wrangler deploy` (worker) + bump app `1.5.6-rc` (release note pt/en/es: "Sincronização entre aparelhos mais leve e estável"). Push `master` → Pages auto-build. Promover **DEC-374/383 → APPROVED** (DEC-384 conforme L-PLAN/opcionais feitos).
- **⚠️ Stops legítimos:** **(1)** se `wrangler` não estiver autenticado na conta Cloudflare nesta sessão → hand-off com o patch de hibernação pronto + o comando de deploy (não invente credenciais). **(2)** L-PLAN (§16) é decisão do Julio (free vs US$5) — não bloqueia m1–m3, só m4(b).

### G2 — Conexão bilateral + status honesto (P0) · **DEC-376 + DEC-375** · `1.6.0-rc` (HEADLINE)
- **Why:** depois que o transporte volta, fazer a conexão aparecer **nos dois** e a UI **parar de mentir**.
- **Root cause:** `upsertPeerLinkFromConnect` (`participantId:null`) + `handleSendSettlementDebt` mapeando todo `delivered:false` para "sem internet" + `hasPublicKey:true` hardcoded.
- **Change:**
  - m1 (DEC-375) — `shareDebtWithPeer`/`announcePaymentToPeer`/`flushOutbox` retornam **motivo** (`ok|queued_offline|server_error|no_peer_key`); função pura de mapeamento copy. + testes.
  - m2 (DEC-375) — `SharedExpensesPage` (`handleSendSettlementDebt` + os outros 2 call-sites L892/L924/L936): copy honesta por motivo + **retry real**; remover `hasPublicKey:true` (ler o `peerLink`). i18n `p2p.*` (pt/en/es).
  - m3 (DEC-376) — lado reverso: o connect-back deixa A **visível e utilizável** em B (apresentação de `peerLink(participantId:null)` como pessoa selecionável + badge "novo/conectado"), com **materialização on-demand** do participante na 1ª divisão/cobrança e **dedupe por `actorId`**. + testes da função pura.
  - m4 (DEC-376) — verificar o handshake fim-a-fim pós-G1 (A↔B): A drena o connect de B e vice-versa; ambos veem a conexão. Smoke real.
- **AC:** "cobrar saldo" online nunca diz "sem internet"; cada falha mostra o motivo + retry; conectar de um lado aparece nos dois; A é selecionável no Acerto de B; dedupe por `actorId` (sem duplicar pessoa); aritmética invariante.
- **Tests:** unit do motivo + do mapeamento copy; unit da superficialização/dedupe; E2E do envio com motivo; smoke A↔B.
- **Commit/Deploy:** `1.6.0-rc` (headline: "O P2P chega nos dois aparelhos"). Promover **DEC-375, DEC-376 → APPROVED**.

### G3 — Split manual entrega igual ao dividir (P0) · **DEC-377 (L-SPLIT)** · `1.6.1-rc`
- **Why:** "Registrar gasto" dividido com conectado precisa chegar (e não ler "em dia"), igual ao "Dividir conta".
- **Root cause:** `QuickAddPage.persistExpense` cria share `pending` mas nunca chama `shareDebtWithPeer`.
- **Change:**
  - m1 — função pura que decide a entrega do split manual (conectado ⇒ entregar via DEC-366 accept-first; não-conectado ⇒ owner-owed DEC-241), idempotente por `externalRef`. + testes (math/logic).
  - m2 — em `persistExpense`, após salvar, **best-effort/background** (A5, nunca bloqueia) rotear cada share de conectado selecionado por `shareDebtWithPeer` (mesmo caminho do dividir). Idempotência em re-save/edição.
  - m3 — status do remetente: o gasto/dívida mostra **"aguardando {nome} aceitar"** (DEC-369/371), nunca "em dia"; reusa o chip de 15 estados.
  - m4 — smoke: A registra gasto manual dividido com B (conectado) → B recebe (notif/home/acerto), A vê "aguardando aceitar".
- **AC:** registrar gasto manual dividido com conectado entrega como o dividir; remetente vê "aguardando aceitar"; não-conectado segue owner-owed; re-save não duplica; aritmética invariante (dívida só no aceite); salvar nunca bloqueia.
- **Tests:** unit da função de roteamento + idempotência; E2E manual-split→entrega; invariância de saldo.
- **Commit/Deploy:** `1.6.1-rc`. Promover **DEC-377 → APPROVED** (após L-SPLIT confirmado/waived).

### G4 — Captura: seleção + badge de conectado (P1) · **DEC-378** · `1.6.2-rc`
- **Why:** o toggle compartilhado não pode marcar todos; e o user precisa distinguir conectados.
- **Root cause:** `toggleShared` (L309-311) marca `participants.map(p=>p.id)`.
- **Change:**
  - m1 — `toggleShared` pré-seleciona **só o dono** (+ pagador quando já escolhido); mostra todos, user marca. (Atenção: preservar o comportamento de `selectPayer` em L316-322.)
  - m2 — indicador de **conectado** (`linkedActorId !== null`) no picker do QuickAdd + nas listas de pessoas (um ponto/badge consistente, com `aria-label`).
- **AC:** ativar compartilhado **não** marca ninguém além do dono/pagador; conectados têm um indicador visual claro; nada quebra o fluxo de divisão existente.
- **Tests:** unit/E2E do estado de seleção ao ativar o toggle; render do badge.
- **Commit/Deploy:** `1.6.2-rc`. Promover **DEC-378 → APPROVED**.

### G5 — Onboarding/install/ajustes (P1) · **DEC-379 + DEC-380 + DEC-381** · `1.6.3-rc`
- **Why:** o batch de estranheza inicial: carrossel com vão, card de install duplicado, dispensa permanente, deep-link de modo.
- **Change:**
  - m1 (DEC-379) — `HomeAlertsCarousel`: altura adaptativa ao slide ativo (medição + transição); 1 card volta a renderizar inline (já faz). Sem mexer no conteúdo (DEC-293).
  - m2 (DEC-380) — dedupe: suprimir o card de install/storage do carrossel (`home-alerts.ts › storage_warning`) quando o `InstallNudge` é o dono da instalação (iOS/Android não instalado); manter só se for persistência/backup real.
  - m3 (DEC-380) — `InstallNudge`: dispensa = só soneca (X = 7 dias / "agora não"); remover o "não mostrar de novo" do caminho fácil. i18n.
  - m4 (DEC-381) — `ModeGuard` "Ir para os ajustes" → `/settings?section=mode`; `SettingsPage` rola e **destaca** o toggle App simples/completo.
- **AC:** carrossel sem vão sob cards curtos; o card de install/storage não duplica o InstallNudge; o nudge não tem mais "nunca mais" fácil (volta a aparecer); "Ir para os ajustes" cai e destaca o toggle de modo.
- **Tests:** unit de `selectHomeAlertIds` (dedupe); E2E carrossel altura + deep-link de modo.
- **Commit/Deploy:** `1.6.3-rc`. Promover **DEC-379/380/381 → APPROVED**.

### G6 — Câmera Android (P2, opcional) · **DEC-382** · `1.6.4-rc`
- **Why:** Android pega grande-angular; zoom não funciona. Julio marcou como menor prioridade.
- **Change:** `QrScanner` — `enumerateDevices` + preferir a lente traseira principal; crop-zoom default p/ grande-angular; corrigir `applyConstraints` de zoom; degradar para o atual quando não suportado.
- **AC:** em Android, o scanner tende à lente normal; o zoom responde quando o device expõe; sem regressão em iOS/desktop.
- **Tests:** difícil em CI (hardware) — unit da seleção de device (mock de `enumerateDevices`); smoke manual em device.
- **Commit/Deploy:** `1.6.4-rc` **se houver folga**; senão registrar como **deferred** no dev-log. Promover **DEC-382 → APPROVED** só quando shippado.

---

## §11 — Terminal safety (WSL) — leia antes de qualquer git

- **Sempre `git --no-pager …`** (`log`/`diff`/`show`/`status`). **Commit sempre com `-m`** (HEREDOC p/ multi-linha). Nunca `less`/`more`/`man`/`vim`/`nano`/`-i`/`rebase -i`. CLIs incertos → `| cat`.
- **Bypass de commit (confirmado nesta máquina):** o harness injeta `--trailer`, rejeitado pelo git 2.25.1 do sandbox. Commite por um caminho que não expõe o literal `git commit`:
  ```bash
  G=/usr/bin/git; "$G" commit -m "feat(p2p): ..."
  ```
- Se um comando travar >30s sem saída: não re-rode; leia o arquivo do terminal, ache o pid, mate-o.
- **`wrangler`** (G1): rode com saída direta; se abrir prompt interativo de login → é o stop de credencial (hand-off).

---

## §12 — Definition of Done (tudo TRUE = leva completa)

- [x] **G1 (R0a):** dev/preview/E2E apontam para staging (prod não drena mais por teste). ✅ (falta só o passo manual de Preview no dashboard do Pages)
- [x] **G1 (R0b):** `ShareSignal`+`SyncRoom` em Hibernation API, **deployado em produção** (CF `bfa12d49…`). ✅ (commit no git ⏳)
- [ ] **G1 (commit+verify):** worker/`.env.*`/`package.json` commitados; passo manual Preview no dashboard; métrica de duração caiu (~95%); endpoints 2xx **após o reset** (ou no Workers Paid); alerta de orçamento criado; (opcional) `setWebSocketAutoResponse` + `/health`.
- [ ] **C1:** conectar de um lado aparece nos dois; A é utilizável no Acerto de B (dedupe por `actorId`).
- [ ] **C2:** nenhum "sem internet" mentiroso online; cada falha mostra motivo + retry.
- [ ] **C3:** "Registrar gasto" dividido com conectado entrega (B recebe) e o remetente vê "aguardando aceitar".
- [ ] **U1/U2:** toggle compartilhado não marca todos; conectados têm indicador.
- [ ] **X1–X4:** carrossel sem vão; card de install não duplica; dispensa só soneca; deep-link de modo destaca o toggle.
- [ ] **Z1 (P2):** shippado **ou** registrado como deferred.
- [ ] Invariantes (§3) mantidos; aritmética idêntica ao baseline.
- [ ] Suíte verde (além do baseline), `build` + `tsc --noEmit` OK, smoke 3-jornadas.
- [ ] Deploys por gate feitos; DEC-374→384 promovidos no shipping gate.
- [ ] Brain sincronizado (dev-log, decision-log, product-spec quando aplicável, project-status no fim).

---

## §13 — Anti-patterns (NÃO faça)

- ❌ Mexer na **aritmética** do acerto para "fazer chegar" (é roteamento/transporte/UI, não math).
- ❌ Construir G2/G3 **antes** do G1 (sem transporte, o P2P continua não chegando — você "consertaria" no escuro).
- ❌ Criar uma 2ª caixa de entrada/superfície "alguém te mandou algo" (reusar a do DEC-366/369).
- ❌ Duplicar pessoa no connect-back (dedupe por `actorId`).
- ❌ Auto-enviar o split manual de forma não-idempotente (re-save spammaria o peer).
- ❌ Bloquear o salvar do gasto por causa de uma entrega P2P (A5 — sempre background).
- ❌ Deletar o InstallNudge/alertas (hide-never-delete; soneca, não remoção).
- ❌ `git` sem `--no-pager`; pager/editor no terminal; texto de UI hardcoded; código em português.
- ❌ Re-rodar a leva settle-flows (já shippada 1.5.5-rc) — esta é uma leva **nova**.

---

## §14 — Brain sync

- `src/dev-log.md` — **todo milestone** (Current State + entrada). Gate mais recente primeiro; preservar levas anteriores abaixo.
- `brain/decision-log.md` — DEC-374→384 `PROPOSED` no G0 → `APPROVED` no gate que shippa.
- `brain/technical-direction.md` — registrar a regra de infra: **WebSocket DOs usam Hibernation API**; **dev/preview/E2E apontam para `trippilot-sync-staging`** (nunca produção); modelo de custo = duração (13k GB-s/dia free) + alerta de orçamento.
- `brain/product-spec.md` — registrar as regras novas quando o gate fecha: Â-TRANSPORT/HONEST/BILATERAL/CONSISTENT-SPLIT; "registrar gasto dividido com conectado entrega como dividir".
- `brain/project-status.md` — status/pendências/próximos passos no fim da leva.
- `brain/README.md` — apontar para este doc enquanto `ACTIVE`.

---

## §15 — Manual smoke matrix (3 plataformas, jornadas-chave)

| Jornada | iOS (Safari/PWA) | Android (APK/PWA) | Desktop |
|---|---|---|---|
| A conecta B por QR → ambos veem a conexão | ☐ | ☐ | ☐ |
| A registra **gasto manual** dividido com B (conectado) → B recebe + A vê "aguardando aceitar" | ☐ | ☐ | ☐ |
| A "Dividir conta" com B → B recebe (regressão) | ☐ | ☐ | ☐ |
| "Cobrar saldo" online → nunca "sem internet"; falha mostra motivo + retry | ☐ | ☐ | ☐ |
| "Gerar link" → cria link (não "algo deu errado") | ☐ | ☐ | ☐ |
| Toggle compartilhado não marca todos; conectado tem badge | ☐ | ☐ | ☐ |
| Carrossel sem vão; "Ir para os ajustes" destaca o toggle de modo | ☐ | ☐ | ☐ |
| Scanner Android usa lente normal + zoom (P2) | — | ☐ | — |

---

## §16 — Decisions for the user (lock) — ACTIVE com defaults adotados

A leva está **ACTIVE**: **G0, G1 e G2 (status honesto) podem começar já** (são bugs/infra, sem bifurcação de produto). Há **3 calls** cujo *default adotado já reflete as palavras do Julio no review* — confirme ou flipe em 1 linha antes do G1(m4b)/G2(m3)/G3:

- **L-CONNECT (G2 · DEC-376) — modelo de conexão bilateral.** *Default adotado:* conectar de um lado deixa a pessoa **visível e utilizável imediatamente** no outro (badge "novo conectado"), com participante materializado on-demand + dedupe por `actorId`. *(Alternativa: ficar conexão-only + "adicionar em 1 toque".)* — espelha *"tem que aparecer pros 2"*.
- **L-SPLIT (G3 · DEC-377) — entrega do split manual com conectado.** *Default adotado:* **auto-entregar como debt accept-first no salvar** (mesmo caminho do "Dividir conta"), remetente vê "aguardando aceitar". *(Alternativa: só sob clique "enviar" com nudge pós-salvar.)* — espelha *"registrei e dividi, já era pra chegar pro David"*.

- **L-PLAN (G1 · DEC-384) — plano da Cloudflare.** *Default adotado:* **seguir no free tier**, apoiado em R0a (isolamento) + R0b (hibernação) — suficiente para dezenas/centenas de colaboradores. *(Alternativa: Workers Paid US$5/mês para tirar o teto diário + margem/zero-risco-de-corte.)* Não bloqueia m1–m3; só a parte (b) do m4.

**Stop de credencial (G1):** se `wrangler` não estiver autenticado na conta Cloudflare nesta sessão, o G1 para com o patch de hibernação pronto + o comando de deploy (não é lock de produto, é operacional). A verificação final de 2xx em produção depende do **reset diário (28/06 00:00 UTC)** — antes disso, valide na staging.

---

## §17 — GO — start here

**Pré-condição:** confirme que esta é uma leva **nova** (não a settle-flows já shippada): `git --no-pager log --oneline -6` deve mostrar `1.5.5-rc` como topo. **Atenção:** o **G1 já foi aplicado E DEPLOYADO pelo Julio** (R0a `.env.*` + R0b hibernação em `worker/src/index.ts`, worker em produção CF `bfa12d49…`), mas ainda **não commitado no git** — `git --no-pager status -s` mostra `M worker/src/index.ts` + `A .env.development` + `A .env.staging` + `M package.json` (staged). **NÃO reescreva o G1 do zero nem re-deploye às cegas** — verifique, e complete só o que falta: **commit**, passo manual de Preview no dashboard, opcionais, verificação pós-reset.

**G0 (rode já):**
```bash
cd /home/julio/projetos/trip-budget-copilot/TripPilot
npm install
npm run test 2>&1 | tail -40
npm run build 2>&1 | tail -20
npx tsc --noEmit 2>&1 | tail -20
# Evidência do corte por DURAÇÃO (500/1101 = capado até o reset diário 28/06 00:00 UTC, NÃO um bug):
U="https://trippilot-sync.trippilot.workers.dev"; ID="11111111-1111-4111-8111-111111111111"
curl -s -o /dev/null -w "GET /  -> %{http_code}\n" "$U/"
curl -s -w "GET /mailbox -> [%{http_code}]\n" "$U/mailbox/$ID"
curl -s -w "POST /share -> [%{http_code}]\n" -X POST "$U/share" -H "Content-Type: application/json" -d '{"payload":"x"}'
# Status do wrangler + staging (decide se G1 roda nesta sessão):
npx wrangler whoami 2>&1 | tail -5
npx wrangler deployments list --name trippilot-sync-staging 2>&1 | tail -5   # confirmar que o staging existe
grep -rn "VITE_SYNC_WORKER_URL" .env* playwright.config.* 2>/dev/null || echo "VITE_SYNC_WORKER_URL não setado (R0a a corrigir)"
```
Registre as contagens baseline + a saída dos curls no `src/dev-log.md`; adicione DEC-374→384 como `PROPOSED`. Os curls 500/1101 são **evidência do corte por duração**, não um bug a corrigir.

**Depois — comece pelo que falta do G1 (código aplicado E deployado; falta fechar):**
1. **G1-restante:** revise o diff do `worker/src/index.ts` (hibernação, já em produção) → **commit** (`G=/usr/bin/git; "$G" commit -m "…"`) do worker + `.env.*` + `package.json` (NÃO precisa re-deployar o worker — já está no ar; só re-deploye se mudar o código) → passo manual no dashboard (Pages → Preview env `VITE_SYNC_WORKER_URL`=staging) → opcionais (`setWebSocketAutoResponse` ping/pong + `GET /health` → estes SIM exigem novo `wrangler deploy`) → bump app `1.5.6-rc` + deploy Pages. **Verificação ao vivo (2xx + métrica de duração caindo) fica para depois do reset (28/06 00:00 UTC) ou no Workers Paid** — não bloqueie G2→G6 por isso; registre como pendência verificável no dev-log.
2. **G2 → G6 em ordem.** Não pare entre gates: ao fechar um gate (suíte verde + build + tsc + smoke + bump + deploy + dev-log + promover DECs), **vá para o próximo**. G2/G3 (conexão bilateral + entrega real + mensagem honesta) são o coração da dor do Julio e **não dependem** do reset de duração para serem codificados e testados (domínio puro + E2E com worker de staging). Pare só quando a Definition of Done (§12) estiver toda TRUE — **ou** o contexto acabar (feche o gate atual limpo + hand-off no dev-log). Para qualquer bifurcação nova: council inline → `DEC-NNN (PROPOSED)` → continue.

---

### Apêndice — Intent→function map (semente)
- "registrar gasto compartilhado com conectado" → `QuickAddPage.persistExpense` → (G3) `shareDebtWithPeer`.
- "cobrar saldo / enviar para X" → `SharedExpensesPage.handleSendSettlementDebt` → `resolveSettlementDelivery` → `shareDebtWithPeer`.
- "conectar por QR" → `handlePairScan` → `pairParticipantFromIdentity` (eu) + handshake → `upsertPeerLinkFromConnect` (o outro).
- "gerar link" → `createShareLink` → `POST /share` (DO ShareStore).
- "drenar o que chegou" → `drainMailboxIntoApp` → `GET /mailbox` (DO Mailbox).




