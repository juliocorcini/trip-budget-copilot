# Gap Fix Log R3 — TripPilot

## Current State
- **Gate ativo**: Gate 6 (Dívidas + cliques)
- **Requisito ativo**: R-25
- **Itens resolvidos**: 24/26
- **Testes**: 257 unit (+29) + 29 e2e
- **Build/Typecheck**: clean
- **Notas de ambiente**: Node 22 p/ wrangler/playwright (`export PATH="$HOME/.nvm/versions/node/v22.22.3/bin:$PATH"`); git via `bash -c 'git commit -F /tmp/commit-msg.txt'`; NUNCA criar Dexie v4 sem necessidade real de índice

## Por gate

### Gate 0 — Baseline + decision-log
- [x] Baseline: 228 unit ✅ · typecheck ✅ · build ✅ (sobre v0.3.0, commit 0bc779c)
- [x] State file criado
- [x] DEC-084..102 registradas como APPROVED no decision-log (Last updated 2026-06-10)

### Gate 1 — App feel (R-01..05)
- [x] R-01 — Headers fixos: padrão único `.page-sticky-header` (sticky, fundo `--surface`, full-bleed, elevação `.is-scrolled` via hook `useScrolled`) aplicado a Dashboard (header dia+fase+sino), Gastos (título+tabs+chips de filtro) e Planner (header+seletor de fases+resumo) — z-30, abaixo de nav/sheets
- [x] R-02 — Token `--page-padding-x: 16px` em tokens.css; AppShell main usa o token; Dashboard perdeu TODOS os `mx-5` (cards alinhados à mesma margem); carrossel full-bleed (`-mx`/`px` com o token)
- [x] R-03 — OccasionCounter com altura determinística: nome reserva 2 linhas (`min-h-[26px] line-clamp-2`), sublabel reserva `min-h-[12px]`, wrapper `flex` estica os cards
- [x] R-04 — Root cause: classe `no-scrollbar` usada em 5 lugares mas NUNCA definida. Definida em globals.css (`scrollbar-width:none` + `::-webkit-scrollbar{display:none}`) — corrige filtros de Gastos, carrossel, seletor de fases do Planner e 2 scrollers do OutingPage de uma vez
- [x] R-05 — `@media (display-mode: standalone) { html, body { overscroll-behavior-y: none } }` em globals.css — PWA instalado sem pull-to-refresh, browser preservado

### Gate 2 — Dashboard certo (R-06..10)
- [x] R-06 — Root cause confirmado: `calculateFreeToSpendPerDay(fts.freeToSpendCents …)` recalculava a média após cada gasto. Novo `calculateTodayFreeBudget` (rhythm.ts): allowance fixada no início do dia (FTS + gastos de hoje, ponderada por ritmo) − `calculateSpentOnDate` (novo, transactions.ts) = livre hoje (pode ficar negativo, exibido em cor de erro); média recalculada virou linha secundária `avg_daily_until_end`. 6 testes (cenário 6,00−2,00=4,00 incluso)
- [x] R-07 — Origem da linha: chave i18n `dashboard.reserved_future` ("Reservado para agosto" HARDCODED no copy!) exibindo `fts.futureFloorCents`. Linha removida do hero + chave removida ×3; mecânica de future floor intacta (budget.ts não tocado; Fundos/Planner continuam exibindo)
- [x] R-08 — `domain/insights/notifications.ts` (builder puro, 5 tipos derivados: shares pendentes→sheet de confirmação via `?confirmShares=1`, evento de hoje→iniciar sessão, backup vencido→/settings/backup, saída ≥8h→/outings/active, fase estourada→/planner) + hook `useNotifications` compartilhado + `NotificationsPage` (rota /notifications, empty state) + sino → /notifications com badge numérico. 7 testes
- [x] R-09 — Carrossel scroll-snap (mesma técnica do carrossel de counters), swipe troca, dots navegam; tap por tipo: projeção/ritmo/streak → BottomSheet "Como cheguei nisso" com o cálculo aberto (builder ganhou spentCents/budgetCents/perDayCents/daysElapsed/daysRemaining); dívida → /shared; custo por saída → /expenses?tab=outings; próximo evento → /trip/edit?occurrence=id (TripEditPage abre a sheet do evento direto — base do R-23)
- [x] R-10 — `calculateLastOutingSavings` (budget.ts): última saída encerrada ≤7d com perfil de typical confiável; copy nova `savings_last_outing` cita a saída, o gasto, a economia E a referência (€Z normal); % sem base eliminado. 5 testes

### Gate 3 — Amigo Sincero v2 + simulador (R-11..12)
- [x] R-11 — Root cause: `generateAmigoSinceroInsight` fazia saldo ÷ typical (sem plano). Novo `domain/budget/honest-friend.ts`: `buildHonestFriendV2` compara plano da categoria do último gasto perfilado (planejado vs feito vs quantos ainda cabem no livre) → kinds `on_plan`/`over_pace`/`no_plan`; `projectReserveStartDate` projeta a data em que a reserva começa a ser usada no ritmo atual. Card do Dashboard reescrito (3 mensagens por kind + data de reserva); "Ver impacto completo" → nova rota `/impact` (`ImpactDetailPage`: gasto-gatilho, planejado vs gasto por categoria, projeção fim de fase, risco de reserva, CTA Planner) — NÃO abre mais o simulador. `generateAmigoSinceroInsight` + `calculateSavings` (deprecadas) removidas com seus testes. 7 testes novos
- [x] R-12 — `simulateSpendMultiMetric` (forecasting.ts): 3 perspectivas — total (simulateSpend reaproveitado), dia a dia (valor ÷ allowance de hoje do motor R-06 = dias equivalentes) e plano (ocasiões planejadas restantes que deixam de caber); veredito = pior das 3 (`ok`/`attention`/`risk`). SimulatorPage reescrita: veredito + 3 cards de métrica; chaves `risk_*`/`after`/`percent_used` substituídas por `verdict_*`/`exceeded`/`metric_*`. 9 testes (cenário Julio incluso)
- Checkpoint Gate 3: typecheck ✅ · 255 unit ✅ · build ✅ · 29 e2e ✅ · i18n ×3 paridade (550 chaves)

### Gate 4 — Taxonomia (R-13..18)
- [x] R-13 — `domain/outing/expense-taxonomy.ts` (data-driven): 17 listas (16 categorias de preset + tickets) + fallback genérico, 4-10 subcategorias cada `{id, labelKey taxonomy.*, icon, typicalCents}`; `sortSubcategoriesByProximity` ordena por |typical−valor| (€3→jogos primeiro, €10→couvert); `findSubcategory` p/ render global. Campo `subcategoryId: string | null` em Transaction (NÃO indexado → Dexie continua v3; type+factories+Zod com `.default(null)` p/ backups antigos+CSV coluna "Subcategoria"). Labels ×3 idiomas (116 chaves/idioma)
- [x] R-14 — `ENRICH_AUTO_DISMISS_MS` 3000→10000; `onPointerDown`/`onScrollCapture` no stepper fazem bump do state (novo objeto) → timer reseta a cada interação
- [x] R-15 — Histórico da sessão ativa: item com subcategoria mostra ícone+nome (`taxonomy.*`); sem subcategoria vira botão "Toque para detalhar" que reabre o stepper para AQUELE item (skipPayer)
- [x] R-16 — `doSplitAdd` abre o stepper (mesmo componente) após salvar o split com `skipPayer: true` — pergunta só O QUE foi (pagador/rateio já definidos)
- [x] R-17 — Sessões de evento (activityProfileId null): stepper nível 1 = `EVENT_CONTEXTS` (bar/restaurant/market/transport/gifts/entertainment/other, gravado como `category`, labels `categories.*` existentes) → nível 2 = subcategorias do contexto (gravado como `subcategoryId`)
- [x] R-18 — `formatSessionItemLabel`: subcategoria > descrição própria > categoria — NUNCA o nome da sessão; aplicado no review de fim de sessão e no OutingReviewPage (ícone da subcategoria + linha secundária com o contexto p/ eventos)
- Checkpoint Gate 4: typecheck ✅ · 257 unit ✅ · build ✅ · 29 e2e ✅ · i18n ×3 paridade (666 chaves)

### Gate 5 — Planner overhaul (R-19..24)
- [x] R-19 — Root cause: resumo exibia `freeMarginCents` (available − BASELINE alocado), que ignora +/− até "déficit". Novo `liveMarginCents = availableCents − currentAllocatedCents` no resumo (sticky) — cada tap atualiza na hora; `freeMarginCents` mantido só p/ lógica de déficit/recomendação
- [x] R-20 — Margem negativa NÃO clampada (era `Math.max(0, …)`), exibida em `--error`; banner de over-allocation movido p/ DENTRO do sticky header (primeira coisa visível, ícone error + borda vermelha), versão antiga no meio da página removida
- [x] R-21 — Tap no nome/ícone da categoria → BottomSheet com: editar valor típico (atualiza ActivityProfile + `estimatedUnitCostCents` da alocação da fase), classificação da fase (3 botões), remover da fase (PhaseProfileSetting isEnabled=false + delete da alocação — transporte €8→€1 e remover agora possíveis)
- [x] R-22 — `priority` agora vive no `ProfileState` (hidratada do `ScenarioAllocationItem.priority`, persistida no item → POR FASE); badge/recomendação/preset usam a do estado (não mais `getPriority(category)` global); cadeado com efeito real: `updateCount` bloqueado com toast, preset já pulava, controles dimmed + ícone na cor do perfil quando travado
- [x] R-23 — Linha única de eventos do Planner virou lista de botões individuais → `/trip/edit?occurrence=id` (sheet do evento abre direto via deep link do R-09); card do dia no Dashboard idem (título tappável)
- [x] R-24 — ProfileForm ganhou modo edição (`initial` + campo valor seguro + label Salvar); ProfilesPage: tap no perfil → form de edição (nome, ícone, típico, seguro) + botão remover; remoção segura: com gastos registrados → desabilita em todas as fases (PhaseProfileSetting) + toast warning; sem uso → soft delete
- Checkpoint Gate 5: typecheck ✅ · 257 unit ✅ · build ✅ · 29 e2e ✅ · i18n ×3 paridade (677 chaves)

### Gate 6 — Dívidas + cliques (R-25..26)
- [ ] R-25 — Extrato por participante
- [ ] R-26 — Varredura de cliques

### Gate 7 — Brain + verificação + deploy
- [ ] Brain atualizado (decision-log, project-status, product-spec, database-schema)
- [ ] package.json 0.4.0
- [ ] Verificação 26/26 + smokes + i18n ×3
- [ ] Deploy v0.4.0

## Extras encontrados (anotar, não corrigir)
- (nenhum ainda)

## Varredura de cliques (R-26)
- (preencher no Gate 6)
