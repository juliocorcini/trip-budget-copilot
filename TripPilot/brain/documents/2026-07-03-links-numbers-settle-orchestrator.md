# Orchestrator — Mega-leva "Links que se apresentam + Números que batem + Acerto sem atrito"

> Status: ✅ **ACTIVE** (locks do §16 TODOS resolvidos pelo Julio em 2026-07-03 via AskQuestion — nenhum gate bloqueado). Autorado 2026-07-03; execução pendente (Julio pediu "plan-only" nesta sessão).
> Versões: base **`2.2.0-rc`** → `2.2.1-rc` (G1) → `2.2.2-rc` (G3) → `2.2.3-rc` (G5) → **`2.3.0-rc`** (G6). Worker deploya em G4/G5.
> Decisões: **DEC-445→451 PROPOSED** em `decision-log.md`; cada gate promove as suas para APPROVED ao fechar.
> Método: `.cursor/skills/implementation-orchestrator/SKILL.md`. Inline, 1 sessão, sem subagents. Kickoff: `2026-07-03-links-numbers-settle-kickoff-prompt.md`.
> Council: rodado inline em 2026-07-03 (Strategist/Architect/Critic/Advocate + Red Team) — síntese distilada nos DECs; Julio **destravou além da recomendação** em 2 pontos (preview rico DEFAULT-ON; mover dívida SEM aceite) — ver §7.

## §0 — Mission

Sete pedidos do review de campo do Julio (2026-07-03), nas palavras dele:

| Item | Pedido (resumo fiel) | P |
|---|---|---|
| **D01** | "quando eu compartilhar algum link e a pessoa colar no whatsapp, já mostrar título, texto, imagem… se eu mando um link de divisão em grupo, já estar no preview o nome, o valor, quantidade de pessoas sempre atualizado, foto do que é" | P0 |
| **D02** | "os links deveriam ser slugs, não códigos gigantescos… fácil para o user ler e até digitar" | P1 |
| **D03** | "a fase tinha 628, o insight fala fecha em 873, o detalhe fala gasto 602, o livre hoje fala 345, a aba de gastos mostra 734 (com gasto de coisas futuras, hotel de outra fase e de outra verba)… bem confuso" | P0 |
| **D04** | "a tela de gastos mostra todos os gastos — mostrar só os da fase atual? ou poder escolher: todos / fase atual / uma fase específica" | P1 |
| **D05** | "colocar no onboarding para o user escolher já se quer claro, escuro ou de acordo com o sistema" | P2 |
| **D06** | "criei uma divisão com o Bruno… logo depois chega uma notificação pedindo para EU confirmar a divisão. Qual a necessidade, se eu mesmo estou registrando?" | P1 |
| **D07** | "por que eu não posso mover a dívida para o Bruno (conectado)? Tem que atualizar o aparelho de quem sai e de quem entra, com histórico claro: a dívida existia, foi retirada de tal pessoa e movida para tal pessoa" | P1 |

**Fora de escopo (deliberado):** og:image GERADA dinamicamente (satori/workers-og — começa com imagem estática com marca por tipo + foto real quando o share tiver); tracing/analytics de cliques em links; slugs retroativos para links já compartilhados (velhos continuam funcionando por id); CSP completa (leva própria); roteamento P2P de dívidas de TERCEIROS do DEC-388 m3 (aqui é só mover dívida MINHA para conectado).

O app: TripPilot, PWA local-first (React 19 + Dexie), worker Cloudflare (`trippilot-sync`) com KV/R2/DOs, links de compartilhamento E2E (`/s|/t|/g/:id#k=chave`). Vá ao §17 para começar.

## §1 — Identity & autonomy contract

Você é o executor sênior full-stack desta leva, sozinho, nesta sessão. Sem subagents, sem Task tool. Não pare entre milestones/gates; o único stop legítimo é DoD completo, blocker de credencial/custo, ou fim real de contexto (feche o gate atual limpo antes). Código/commits em inglês; UI via `t()` pt/en/es; docs do brain em pt-BR. Terminal: §11 SEMPRE.

## §2 — Reading order (uma vez, no início)

1. Este doc §0–§9 (você está aqui) → 2. `src/dev-log.md` (Current State) → 3. Só as DEC citadas: DEC-207 (capability link), DEC-297/340/355 (grupo `/g/`), DEC-345/346 (debt/payment mailbox), DEC-414 (mover dívida local), DEC-430 (bloqueio honesto do mover-pra-conectado), DEC-427 (herói "livre hoje"), DEC-091 (insight detail), DEC-436→444 (headers/rate-limit/logger — não regredir) → 4. `product-spec.md` §§ de sharing/fases/orçamento se precisar → 5. O orquestrador irmão `2026-07-03-observability-ratelimit-pwa-orchestrator.md` para tom e pipeline. NÃO releia o brain inteiro por milestone.

## §3 — Não-negociáveis (ÂNCORA)

Herdados (app-wide): dinheiro = **cents inteiros**; domínio = **TS puro, zero React**; toda string de UI via `t()` (pt-BR/en/es); hide-never-delete; nunca bloquear o registro de gasto; testes junto com a mudança; deploy por gate.

Novos desta leva:

- **Â-KEY-IN-FRAGMENT**: a chave AES **continua exclusivamente no fragmento** (`#k=`). Nenhum gate manda a chave ao servidor, loga, ou a põe em slug/preview. O slug encurta o **caminho**, nunca a chave.
- **Â-PREVIEW-SUMMARY-ONLY**: o preview blob é plaintext deliberado (DEC-445), mas carrega SÓ resumo: título, descrição composta, total, moeda, nº de pessoas, updatedAt, 1 imgId. **NUNCA** lista de gastos, nomes de participantes item a item, writeToken, chave, ou payload decifrado. Tamanho ≤ 1 KB, validado no worker.
- **Â-OLD-LINKS-LIVE**: todo link já compartilhado (id cru) continua abrindo para sempre. Slug é camada NOVA de resolução, não substituição.
- **Â-NUMBERS-EVIDENCE-FIRST**: em D03, mudar **rótulo/explicação** é livre; mudar **matemática** só com evidência do G2 (dupla contagem real demonstrada em teste) + teste de invariância dos demais números. "Explicar" nunca vira "alterar por acidente".
- **Â-MOVE-VISIBLE-BOTH-SIDES**: mover dívida NUNCA é silencioso — histórico + proveniência ("veio de {nome}") no MEU aparelho e no do destinatário; undo do owner propaga reversão. O aparelho do peer nunca é mutado sem registro visível.
- **Â-WORKER-GUARDS-KEPT**: rate-limit/CORS/logger/headers das levas DEC-436→444 intocados; rotas novas do worker entram COM logEvent + validação de tamanho, e leituras continuam sem rate limit.

## §4 — Baseline (confirmado no código)

| Área | Arquivo → símbolo | O que já existe |
|---|---|---|
| Links | `src/domain/sync/share-link.ts` → `buildShareUrl/buildSplitTableUrl/buildGroupSplitUrl`, prefixos `/s/ /t/ /g/` | URL = `origin + prefix + shareId + #k=key`; `parseShareKeyFromHash` |
| Links | `src/features/group-split/group-link.ts` → `publishGroupSplit/republishGroupSplit/buildGroupSplitLink`; `src/features/split/live-link.ts` idem; `src/domain/orchestrators/share-link-orchestrators.ts` → `buildShareUrl` | Owner publica/republica ciphertext via `share-client.ts › createShare/putShareStatement`; origem via `getShareOrigin()` (apex `trippilot.pages.dev` no nativo) |
| Worker | `worker/src/index.ts` → `POST /share` (L825, id = 24 bytes random), `PUT/GET /share/:id`, `/share/:id/responses`, `/img/:id` (R2 plaintext DEC-348) | KV `SHARE_STORE` (id→ciphertext+meta, TTL); worker NUNCA lê o conteúdo |
| Meta HTML | `index.html` | `<title>TripPilot</title>` e **zero** tag OG/twitter — preview no WhatsApp hoje é URL crua |
| Pages | **não existe pasta `functions/`** — deploy é `dist/` estático + `public/_headers` (DEC-436) | Function nova é aditiva; `_headers` intocado |
| Números | `src/features/dashboard/useDashboardModel.ts` L386-388, L451-455 | insight spent = tx com `phaseId === activePhase` (TODAS as verbas); `phaseBudgetCents` do insight = `fts.freeToSpendCents + calculatePoolSpent(phaseTxs)` — **reconstruído**, ≠ valor configurado da fase |
| Números | `src/features/dashboard/InsightDetail.tsx` L27-50 (`phase_projection`), `ImpactDetailPage.tsx` | Linhas: gasto até agora / ritmo / total projetado / orçamento da fase — sem reconciliar com hero/lista |
| Números | `src/features/expenses/ExpenseListPage.tsx` L159-165 → `totalCents` | Soma **a viagem inteira** (todas as fases/verbas); filtros existentes em `expense-filters.ts` (categoria/atividade/lugar/método — SEM fase) |
| Hero | DEC-427 "Livre para usar hoje" (escopo consumível pós-reservas) | Outro escopo ≠ insight ≠ lista — raiz da confusão D03 |
| Tema | `src/domain/types/app-settings.ts` → `themePreference`; `SettingsPage.tsx` L838 → `updateSetting({ themePreference })` | Persistência e aplicação prontas; falta só o passo no onboarding (`OnboardingPage.tsx` → `detailedSteps[]` + `ongoingStep` + `modeStep`) |
| Notificação | `src/domain/insights/notifications.ts` → `buildNotifications` (`pending_share`, destino `/dashboard?confirmShares=1`); `useNotifications.ts` → `findPendingConfirmationShares` | Dispara para TODA share `pending` não-do-pagador; i18n pt `dashboard.pending_share` = "aguardando **sua** confirmação" (direção errada quando quem falta é o peer) |
| Shares | `src/domain/splitting/splitting.ts` → `resolveShareBirthStatus` (L220-228): não-conectado nasce `confirmed`; **conectado nasce `pending`** aguardando o aceite DELE (DEC-345 accept-first) | O caso do Bruno: notificação legítima, TEXTO errado |
| Mover dívida | `splitting.ts` → `isShareReassignable` (bloqueia origem conectada), `classifyMoveDestination` (L952 — destino conectado → "cobre, não mova"), `reassignShares/revertReassignedShares/createDebtMovement`; `SharedExpensesPage.tsx` (sheet de mover); tabela local `debtMovements` (schema V13); `StatementLine.reassignedFromId/Name` | DEC-414 (mover local↔local) SHIPPED; DEC-430 bloqueou destino conectado com explicação + atalho "Cobrar" |
| Mailbox | `src/domain/types/mailbox.ts` → `MailboxPayloadKind` (`statement/backup/connect/debt/payment/group_invite`); `mailbox-envelope.ts` → `VALID_KINDS`; `mailbox-orchestrators.ts` | Canal cifrado pronto; worker é opaco (kind novo NÃO toca o worker) |
| Preview de contagem | worker `/share/:id/responses` já conta respostas SEM decifrar | dá "pessoas na mesa" ao vivo para o preview sem quebrar E2E |

## §5 — Change-set normalizado

- **P0**: D01 (preview rico default-ON), D03 (lente de números).
- **P1**: D02 (slugs), D04 (filtro de fase), D06 (notificação direcional), D07 (mover dívida pra conectado, imediato).
- **P2**: D05 (tema no onboarding).

## §6 — Root-cause map (código ↔ mudança)

| # | Sintoma | Root cause (arquivo → símbolo) | Direção do fix | Gate |
|---|---|---|---|---|
| D01 | Link no WhatsApp = URL crua | `index.html` sem OG; conteúdo é ciphertext que o crawler jamais decifra (chave no fragmento, crawler não executa JS) | Preview blob plaintext opcional ao lado do ciphertext (client compõe, worker guarda/serve) + Pages Function injeta OG por rota + OG global estático no `index.html` | G4+G5 |
| D02 | `/g/AbCd0f9…` ilegível | id = 24 bytes base64url (`worker/src/index.ts` L311) | Slug legível no caminho: KV `slug:{slug}→shareId`, client manda `slugBase` no create; `#k=` fica (Â-KEY-IN-FRAGMENT) | G4+G5 |
| D03 | 628 vs 873/884 vs 602 vs 345 vs 734 | QUATRO escopos sem reconciliação: insight = `phaseId`-attributed todas-as-verbas (`useDashboardModel` L386/455); "orçamento da fase" = reconstruído `free+spent`; hero = consumível pós-reservas; lista = viagem inteira | G2 reproduz com fixture do caso real (hotel de outra fase/verba) → `PhaseSpendLens` canônica → linhas que SOMAM em InsightDetail/ImpactDetail/lista | G2+G3 |
| D04 | Lista mistura fases | `ExpenseListPage.tsx` sem escopo de fase (`expense-filters.ts` só categoria/atividade/lugar/método) | Escopo `phaseId` novo no filtro; default = fase ativa quando existir; chips "Fase atual / Todas / {fase}" | G1 |
| D05 | Tema só nas Settings | `OnboardingPage.tsx` não pergunta | Passo de 1 toque (3 cards Claro/Escuro/Sistema, default Sistema, pulável) nos DOIS fluxos (viagem + ongoing), reusando `updateSetting({ themePreference })` | G1 |
| D06 | "Confirme a divisão que VOCÊ criou" | Share do Bruno (conectado) nasce `pending` por design (DEC-345), mas `notifications.ts` + i18n tratam todo `pending` como "aguardando SUA confirmação" e mandam pro sheet de confirmar | Copy direcional "aguardando aceite de {nomes}" + destino `/shared` (lembrar/cobrar), nunca o sheet do owner; AC extra: split só com não-conectados NÃO gera notificação nenhuma | G1 |
| D07 | "Não posso mover para o Bruno" | `classifyMoveDestination` roteia conectado → "cobre, não mova" (DEC-430, deliberado à época) | Destino conectado vira MOVÍVEL: `reassignShares` local imediato + `debt_move` no mailbox (aplica no aparelho do Bruno com proveniência) + reversão propagada no undo; pessoa-origem conectada recebe retract informativo | G6 |

## §7 — Decisões (council 2026-07-03 + locks do Julio)

Council inline rodado no chat (4 vozes + red team). Julio travou:

- **DEC-445 (D01)** — Preview rico **DEFAULT-ON** com kill-switch nas Settings. Julio, verbatim: "não temos tanto ponto de privacidade assim… pode sim mostrar imagens e tudo mais, se quiser fazer algo nas configurações que o user desliga, tudo bem, mas padrão pode usar sim". O council recomendava opt-in; o Julio destravou default-ON — registrado como decisão de produto dele. Guarda que fica: Â-PREVIEW-SUMMARY-ONLY + aviso 1-linha na UI de compartilhar ("quem tiver o link vê o resumo") + caveat de cache do WhatsApp no texto do toggle.
- **DEC-446 (D02)** — Slug no caminho; chave permanece no fragmento (lock `slug-id`). Digitável de verdade só seria possível entregando a chave ao servidor — rejeitado (Â-KEY-IN-FRAGMENT).
- **DEC-447 (D03)** — Lente única `PhaseSpendLens` + explainers que reconciliam (lock `lens`); matemática só muda com evidência do G2 (Â-NUMBERS-EVIDENCE-FIRST).
- **DEC-448 (D04)** — Filtro de fase na lista, default = fase ativa (com "Todas" a 1 toque, escolha lembrada na sessão).
- **DEC-449 (D05)** — Passo de tema no onboarding, pulável, default Sistema.
- **DEC-450 (D06)** — Notificação direcional. Regra: quem registra NUNCA é cobrado a confirmar o que registrou; `pending_share` = "aguardando aceite de {nome}" com destino `/shared`.
- **DEC-451 (D07)** — Mover para conectado **IMEDIATO** (lock `instant`, contra a recomendação accept-first do council — decisão do Julio): aplica no owner na hora, `debt_move` atualiza o aparelho do Bruno automaticamente com histórico/proveniência, undo propaga `debt_move` reverso. Mitigação do risco apontado pelo Critic: proveniência visível dos dois lados + o Bruno pode contestar pelo fluxo de payment/reject já existente + tudo fica no histórico (Â-MOVE-VISIBLE-BOTH-SIDES).

Diretas (sem council): OG estático global no `index.html` (fallback universal); og:image = foto do share quando houver (`/img/:r2Id`), senão imagem estática com marca por tipo (`public/og/*.png`); descrição do preview composta NO CLIENTE no idioma do dono (server não traduz).

## §8 — Test strategy

- **Domínio puro primeiro (>90%)**: `slugifyShareName` (acentos, colisão, charset, tamanho); `buildSharePreview` (campos, caps, NUNCA chave/writeToken — teste negativo explícito); `PhaseSpendLens` (fixture espelhando o caso do Julio: fase 628 configurada, hotel de fase futura em outra verba, evento atribuído — as linhas SOMAM); `buildNotifications` direcional (conectado-pendente vs não-conectado); `classifyMoveDestination` novo contrato; `buildDebtMoveEnvelope/applyDebtMove` (proveniência, idempotência por id, reverso restaura baseline — net total INVARIANTE).
- **Worker**: testes de unidade dos handlers novos (`/preview/:idOrSlug` shape + 404 + cap de tamanho; slug create colisão→sufixo; resolve slug→id). `tsc` worker limpo.
- **Invariância (Â-NUMBERS-EVIDENCE-FIRST)**: snapshot dos números atuais do fixture ANTES do G3; depois do G3 os mesmos valores continuam idênticos onde não houve evidência de bug.
- **UI crítica**: teste de componente do passo de tema (persiste `themePreference`); do chip de fase (default fase ativa, "Todas" mostra tudo); i18n das chaves novas nas 3 línguas (padrão do install-guide.test).
- **Suíte verde entre gates** = 0 falhas além do baseline documentado no G0 (Node 22; hoje 2995/2995).

## §9 — Per-milestone protocol

O 5-point self-check antes de todo commit (ACs satisfeitos; 3 ACs anteriores em risco verificados — SEMPRE incluir "net total de dívidas invariante" e "links antigos abrem"; suíte sem falha nova; arquivos fora de escopo flagados; dev-log atualizado). ANCHOR block + CURRENT STATE a cada 3 milestones e em toda fronteira de gate.

## §10 — THE BUILD (G0→G7)

### G0 — Setup & baseline (sem versão)
`nvm use 22; npm install`; rodar `npm run test` + `npm run build` + `npx tsc --noEmit` (app e worker); registrar contagens; seed do `src/dev-log.md` (Current State + tabela desta leva); conferir DEC-445→451 PROPOSED; conferir pipeline (Pages conta **e146e88b**, worker `trippilot-sync`; re-rodar `fetch-live-apk` DEPOIS do bundle — landmine do APK 17 MB). **AC**: baseline verde documentado.

### G1 — Quick wins de confiança (`2.2.1-rc`) — D04+D05+D06
- **m1 (D04)**: `expense-filters.ts` ganha escopo `phaseId: string | 'all'`; `ExpenseListPage` chips "Fase atual"/"Todas"/por-fase no painel de filtros; default = fase ativa (viagem com fases); `totalCents` reflete o escopo e o header diz o escopo ("Total · Fase atual"). Dia a dia/ongoing → default Todas.
- **m2 (D05)**: passo de tema no `OnboardingPage` (fluxos viagem + ongoing), 3 cards, default `system`, pulável; grava junto do write existente (`updateSetting`).
- **m3 (D06)**: `buildNotifications` recebe `pendingSharePeerNames`; copy pt/en/es nova "aguardando aceite de {{names}}" (tom informativo, não imperativo); destino `/shared`; `useNotifications` deriva nomes de participants∩connected; AC-negativo: split 100% não-conectados → zero notificação (`resolveShareBirthStatus` já garante — teste pina).
- **Fecho**: suíte + build + tsc + smoke 3 jornadas; bump `2.2.1-rc` + sw bump + release note; deploy Pages; DEC-448/449/450 → APPROVED; dev-log.

### G2 — Números: investigação com o caso real (sem deploy) — D03 parte 1
- **m1**: fixture `phase-spend-lens.fixture.ts` espelhando o relato: fase ativa com orçamento configurado ~628, gasto atribuído 602, hotel pago agora de fase futura noutra verba, evento com reserva, hero 345, lista 734. Reproduzir CADA número com as funções atuais (`calculateFreeToSpend`, `calculatePoolSpent`, insight builder) e documentar a fórmula de cada superfície num addendum §6-A deste doc.
- **m2**: veredito por número: rótulo enganoso (explicar) vs dupla contagem real (corrigir com teste). Hipóteses a validar: (a) "orçamento da fase 884" = `free+spent` reconstruído ≠ 628 configurado → rótulo; (b) 602 vs 345 = atribuído-à-fase vs consumível-pós-reservas → explicar; (c) hotel de outra verba dentro do 602? se sim, é atribuição errada → corrigir.
- **AC**: addendum escrito; cada um dos 6 números do relato tem fórmula, arquivo→símbolo e veredito; DEC-447 refinada com o achado.

### G3 — Números: lente + explainers (`2.2.2-rc`) — D03 parte 2
- **m1**: `src/domain/budget/phase-spend-lens.ts` puro — `buildPhaseSpendLens(...)` → `{ configuredPhaseBudgetCents, attributedSpentCents, consumableSpentCents, reservedEventCents, paidNowOtherPhasesCents, otherPoolsCents, tripTotalCents, reconciliation[] }` com testes de soma exata.
- **m2**: `InsightDetail` (phase_projection) e `ImpactDetailPage` ganham bloco "de onde vêm esses números" com as linhas da lente (as linhas SOMAM na frente do usuário; distingue "orçamento configurado da fase" de "orçamento disponível calculado").
- **m3**: lista de gastos: sob o total, 1 linha de escopo ("inclui X de outras fases · ver só a fase atual" quando escopo=Todas — link pro chip do G1).
- **m4**: correções de matemática SÓ as do veredito G2, cada uma com teste próprio + invariância dos demais números.
- **Fecho**: suíte + invariância + build + tsc + smoke; bump `2.2.2-rc`; deploy Pages; DEC-447 → APPROVED; dev-log + ANCHOR.

### G4 — Links: infra worker + client (worker deploy) — D01+D02 parte 1
- **m1 (domínio)**: `src/domain/sync/share-preview.ts` puro — `slugifyShareName(name)` (lowercase, sem acento, `a-z0-9-`, ≤40) e `buildSharePreview(input)` → `{ v:1, kind:'group'|'split'|'statement', title≤80, description≤200 (composta localizada no cliente), totalCents, currency, peopleCount, updatedAt, imgId? }`. Testes incl. negativo (nunca key/writeToken).
- **m2 (worker)**: `POST /share` aceita `preview?` + `slugBase?` → valida (≤1 KB, schema), grava KV `preview:{id}` (mesmo TTL) e `slug:{slug}→id` (colisão → sufixo novo, 3 tentativas), devolve `{ id, slug?, writeToken }`; `PUT /share/:id` atualiza preview; revoke apaga preview+slug. `GET /preview/:idOrSlug` público (CORS `*`, sem rate limit — leitura), devolve preview + `responsesCount` do meta (pessoas ao vivo sem decifrar). `GET/PUT /share/:slug` resolve slug→id (Â-OLD-LINKS-LIVE: id cru continua). Tudo com `logEvent` + rota-template (Â-WORKER-GUARDS-KEPT).
- **m3 (client)**: `share-client.ts › createShare/putShareStatement` ganham `preview`/`slugBase`; `group-link.ts`, `live-link.ts`, `share-link-orchestrators.ts` compõem o preview no publish/republish (título = nome do grupo/divisão; descrição localizada; imgId quando o share tem foto R2) e usam `slug` no `build*Url` quando presente (creds ganham `slug?`).
- **m4 (settings)**: `appSettings.sharePreviewEnabled` (default true) + toggle nas Settings com o caveat de cache do WhatsApp; OFF → publish não manda preview e republish/revoke apaga o existente; aviso 1-linha nas UIs de compartilhar.
- **Fecho**: testes worker+domínio; `tsc` ambos; `wrangler deploy` (conta correta); probe: create com preview → `GET /preview/:slug` 200 com shape, sem chave; dev-log; DEC-445/446 seguem PROPOSED até o G5 provar o crawler.

### G5 — Links: superfície OG (`2.2.3-rc`) — D01+D02 parte 2
- **m1**: OG global estático no `index.html` (title/description/og:image marca, twitter:card) + `public/og/{group,split,statement,default}.png` (imagens com marca).
- **m2**: **Pages Function** `functions/[[path]].ts` cobrindo `/g/:x`, `/t/:x`, `/s/:x` — busca `GET {worker}/preview/:x` (timeout curto, fallback = HTML intocado), injeta `<meta>` OG/twitter por cima do `index.html` do asset (`env.ASSETS.fetch`), `Cache-Control: public, max-age=60` ("sempre atualizado" na prática do crawler). Sem UA-sniffing — injeta para todos.
- **m3**: rota SPA resolve slug: `/g/:slug` sem preview local → `GET /share/:slug` já resolve (m2 do G4); guest pages inalteradas no resto.
- **m4 (probe real)**: `curl -A "WhatsApp/2"` e `curl -A "facebookexternalhit/1.1"` no apex → HTML com og:title/og:image do share de teste; colar link real num chat do WhatsApp e conferir o card (manual, smoke §15). Red-team check do council: se a Function não interceptar a rota SPA no Pages, degradar para OG estático global e registrar follow-up — NÃO shippar quebrado.
- **Fecho**: suíte + build + tsc; bump `2.2.3-rc`; deploy Pages; DEC-445/446 → APPROVED; dev-log + ANCHOR.

### G6 — Acerto: mover dívida para conectado (`2.3.0-rc`) — D07
- **m1 (domínio)**: `MailboxPayloadKind` += `'debt_move'` (+ `VALID_KINDS`); `src/domain/splitting/debt-move.ts` puro — `buildDebtMoveEnvelope({ movedShares, fromPersonName, direction: 'apply'|'revert' })` e `applyDebtMove(...)` idempotente por share id, marcando proveniência (`movedFrom`) — net total invariante (testes com números concretos).
- **m2**: `classifyMoveDestination` → destino conectado vira elegível (`connected_movable`); manter "cobrar" como ação alternativa no sheet (hide-never-delete). `SharedExpensesPage`: mover para conectado = `reassignShares` local imediato + `debtMovementRepository` + enqueue `debt_move` (mailbox, best-effort com retry existente); undo = revert local + `debt_move` reverso. Pessoa-ORIGEM conectada → também recebe `debt_move` informativo (itens saíram, com histórico).
- **m3 (destinatário)**: drain do mailbox trata `debt_move`: aplica no espelho do Bruno com linha de histórico "veio de {fromPersonName}, movido por {owner}" + notificação; tela de pessoa/statement do Bruno mostra a proveniência (reusa `reassignedFromId/Name` + `StatementLine`).
- **m4 (i18n+copy)**: pt/en/es do sheet (sem o aviso "cobre, não mova" para conectado), histórico, notificação do destinatário.
- **Fecho**: suíte inteira + build + tsc + smoke (mover local→conectado nos 2 aparelhos simulados via testes de orquestrador); bump **`2.3.0-rc`** + sw + release notes pt/en/es; deploy Pages (worker não muda — kind é opaco); DEC-451 → APPROVED; dev-log + ANCHOR.

### G7 — Brain sync final (sem versão)
`decision-log.md` (banner + DEC-445→451 APPROVED com o que shippou), `src/dev-log.md` fechamento, `product-spec.md` (preview de links, slugs, lente de fase, mover-para-conectado), `project-status.md`, `README.md` banner. Commit final.

## §11 — Terminal safety (WSL)

`git --no-pager` SEMPRE; commit multi-linha via arquivo: `Write /tmp/msg.txt` → subshell `sh -c 'git commit -F /tmp/msg.txt'` (**confirmado nesta máquina**: o harness injeta `--trailer`, o git 2.25.1 rejeita; o subshell contorna). Nunca pager/editor/`-i`. Comando >30s sem output: ler terminal file, achar pid, matar.

## §12 — Definition of Done

- [ ] Colar um link `/g/` real no WhatsApp mostra card com nome do grupo, "total X · N pessoas", e imagem (foto do share quando houver; senão a com marca) — verificado com link real.
- [ ] O MESMO link continua abrindo o board do guest normalmente (chave no fragmento intacta — Â-KEY-IN-FRAGMENT).
- [ ] Link novo tem slug legível (`/g/churras-do-bruno-x7f2#k=…`); link antigo por id cru continua abrindo (Â-OLD-LINKS-LIVE).
- [ ] `GET /preview/:slug` nunca expõe chave/writeToken/itens (teste negativo + probe).
- [ ] Toggle nas Settings desliga o preview (share novo sem preview; republish apaga o antigo).
- [ ] Os 6 números do relato do Julio têm fórmula documentada (§6-A) e as superfícies mostram linhas que SOMAM; nenhum número não-diagnosticado mudou (teste de invariância).
- [ ] Lista de gastos abre na fase atual por padrão com "Todas" a 1 toque; total reflete o escopo.
- [ ] Onboarding pergunta o tema (1 toque, pulável) e persiste.
- [ ] Registrar divisão com conectado → notificação diz "aguardando aceite de {nome}" (destino `/shared`); com só não-conectados → nenhuma notificação.
- [ ] Mover dívida Débora→Bruno (conectado): imediato no meu aparelho; o aparelho do Bruno mostra os itens com "veio de Débora" + histórico; undo reverte nos dois; net total invariante em todos os passos.
- [ ] Suíte verde (Node 22, baseline do G0), `tsc` app+worker limpos, build/OTA ok, deploys verificados (APK 8.469.341 B preservado), brain sincronizado.

## §13 — Anti-patterns desta leva

- ❌ Chave AES em slug, preview, log ou query string (fragmento SEMPRE).
- ❌ Preview com lista de gastos/nomes por item ou > 1 KB.
- ❌ "Consertar" um número do D03 sem o veredito do G2 (mudar matemática para "explicar").
- ❌ Quebrar link antigo por id cru, ou regredir rate-limit/CORS/logger (DEC-439→443).
- ❌ Accept-first no debt_move (Julio travou IMEDIATO) — mas silencioso também não: proveniência+histórico são obrigatórios (Â-MOVE-VISIBLE-BOTH-SIDES).
- ❌ UA-sniffing na Pages Function (injeta para todos); esquecer o fallback HTML-intocado se o worker não responder.
- ❌ Passo de onboarding obrigatório (tema é pulável — drop-off).

## §14 — Brain sync

dev-log a cada milestone; DEC-445→451 PROPOSED→APPROVED por gate; product-spec/project-status/README no G7 (ou no fecho do gate que shippar o conceito).

## §15 — Manual smoke matrix (chave)

| Jornada | Web desktop | Android PWA | APK |
|---|---|---|---|
| Colar link de grupo no WhatsApp → card rico → abrir → board | ✓ (WhatsApp Web) | ✓ | ✓ |
| Lista de gastos: default fase atual → "Todas" → volta | ✓ | ✓ | ✓ |
| Criar divisão com conectado → notificação direcional → mover dívida → ver proveniência nos 2 lados | ✓ | ✓ | ✓ (2 devices) |

## §16 — Locks do usuário — ✅ TODOS RESOLVIDOS (2026-07-03, AskQuestion no chat)

| Lock | Resposta do Julio |
|---|---|
| Escopo/ordem | **Mega-leva única**, gates na ordem do council (quick wins → números → links → dívida) |
| L-PREVIEW | **Rico DEFAULT-ON** ("pode sim mostrar imagens e tudo mais"), kill-switch nas Settings |
| L-SLUG | **slug-id** (slug no caminho, chave no fragmento) |
| L-NUMBERS | **lens** (investigar caso real → lente única + reconciliação) |
| L-DEBT-MOVE | **instant** (sem aceite; atualização + histórico nos dois aparelhos) |
| Execução | **plan-only** nesta sessão — kickoff em sessão/momento que o Julio escolher |

## §17 — GO (primeiros comandos)

```bash
cd /home/julio/projetos/trip-budget-copilot/TripPilot
export NVM_DIR="$HOME/.nvm" && . "$NVM_DIR/nvm.sh" && nvm use 22
npm install && npm run test 2>&1 | tail -5 && npx tsc --noEmit && (cd worker && npx tsc --noEmit)
```

Registrar baseline no dev-log → executar G1→G7 na ordem, fechando cada gate limpo (suíte + build + smoke + bump + deploy + dev-log + DECs). Não parar até o §12 estar todo TRUE, salvo blocker genuíno — e o hand-off final termina com AskQuestion.

---

## §6-A — Addendum de investigação dos números (preencher no G2)

> Reservado: fórmula por superfície (arquivo→símbolo), valor reproduzido do fixture, veredito rótulo-vs-bug, e a decisão final da lente.
