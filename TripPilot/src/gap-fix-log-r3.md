# Gap Fix Log R3 — TripPilot

## Current State
- **Gate ativo**: CONCLUÍDO (7/7) | **Sessão R3 encerrada** — v0.4.0 no ar
- **Requisito ativo**: —
- **Itens resolvidos**: 26/26
- **Testes**: 264 unit + 29 e2e
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
- [x] R-25 — `buildParticipantStatement` (splitting.ts): rastreia o saldo item a item — toda share não-rejeitada que move o saldo da pessoa (`owes` p/ pagador, `is_owed` quando ela pagou), com descrição/subcategoria/data/valor/status + liquidações aplicadas; `netCents` (só confirmadas + settlements) bate com `calculateDebts`. Tap no participante em /shared → BottomSheet com saldo, linhas (label = subcategoria > descrição > categoria, badge de status, quem pagou) e liquidações. 7 testes (cenário €1,12 da Débora incluso: 0,75+0,37 rastreáveis)
- [x] R-26 — Varredura completa (lista abaixo): TODO `<button>` tem onClick em 22 páginas (42/42 no Outing, 24/24 no TripEdit etc.); órfãos corrigidos: TripOverview fases→/trip/edit e fundos→/funds, /shared gasto compartilhado→/expenses/:id, Dashboard pool global→/funds
- Checkpoint Gate 6: typecheck ✅ · 264 unit ✅ · build ✅ · 29 e2e ✅ · i18n ×3 paridade (683 chaves)

### Gate 7 — Brain + verificação + deploy
- [x] Brain atualizado: decision-log (DEC-084..102 conferidos, Last updated 2026-06-10) · project-status (R3 26/26, 264 testes, 683 chaves, v0.4.0) · product-spec (features 19–24) · database-schema (Transaction.subcategoryId + nota DEC-100 em priority)
- [x] package.json 0.4.0 + app-version.ts 0.4.0 + SW CACHE_NAME trippilot-v5
- [x] Verificação final: typecheck ✅ · 264 unit ✅ · build ✅ · 29 e2e ✅ · i18n 683 ×3 · 0 diálogos nativos · 0 strings hardcoded
- [x] Deploy v0.4.0: https://master.trippilot.pages.dev (https://73fa13fd.trippilot.pages.dev)

#### Re-verificação R-01..R-26 ("DONE quando" no código)

| R | DONE quando | Evidência no código |
|---|---|---|
| R-01 | headers fixos nas 3 telas | `.page-sticky-header` em Dashboard/ExpenseList/Planner + `useScrolled` |
| R-02 | margem única em todas as páginas | `--page-padding-x` (tokens.css) usado no AppShell main |
| R-03 | counters com altura igual | `min-h-[26px] line-clamp-2` + `min-h-[12px]` no OccasionCounter |
| R-04 | sem scrollbar visível | `.no-scrollbar` DEFINIDA em globals.css (5 usos) |
| R-05 | PWA sem pull-to-refresh | `@media (display-mode: standalone)` overscroll-behavior-y none |
| R-06 | 6,00−2,00=4,00 | `calculateTodayFreeBudget` subtrativo + teste com cenário exato |
| R-07 | sem "Reservado para agosto" no hero | linha+chave `reserved_future` removidas ×3 |
| R-08 | sino abre central | sino → /notifications (NotificationsPage + useNotifications) |
| R-09 | insight tem tap com destino/detalhe | carrossel snap + sheet de cálculo + navegação por tipo |
| R-10 | economia cita referência real | `calculateLastOutingSavings` + copy `savings_last_outing` |
| R-11 | nunca "197 saídas"; impacto detalhado | `buildHonestFriendV2` (plano, não saldo÷typical) + /impact |
| R-12 | simulador 3 métricas + pior veredito | `simulateSpendMultiMetric` (total/dia/plano) |
| R-13 | subcategorias ordenadas por proximidade | `EXPENSE_TAXONOMY` + `sortSubcategoriesByProximity` |
| R-14 | stepper 10s + reset por interação | `ENRICH_AUTO_DISMISS_MS=10000` + bump em pointer/scroll |
| R-15 | item sem subcategoria detalhável | botão "tap_to_detail" reabre stepper p/ item |
| R-16 | split também enriquece | `doSplitAdd` → `buildEnrichTarget` skipPayer |
| R-17 | evento: contexto → subcategoria | `EVENT_CONTEXTS` nível 1 + `getSubcategoriesForContext` |
| R-18 | review nunca mostra nome da sessão | `formatSessionItemLabel`: subcategoria > descrição > categoria |
| R-19 | margem atualiza a cada tap | `liveMarginCents = available − currentAllocated` no resumo sticky |
| R-20 | estouro visível sem rolar, negativo vermelho | banner DENTRO do sticky header + margem sem clamp em `--error` |
| R-21 | transporte €8→€1 e remover possíveis | menu de categoria: editar valor / remover da fase / classificação |
| R-22 | classificação difere entre fases | `priority` no ScenarioAllocationItem (por fase) + cadeado real c/ toast |
| R-23 | tap em "Veneza" abre edição de Veneza | eventos do Planner + card do dia → `/trip/edit?occurrence=id` |
| R-24 | editar típico de qualquer perfil; remover sem uso | ProfileForm modo edição + soft delete c/ regra de uso |
| R-25 | €1,12 da Débora rastreável | `buildParticipantStatement` + sheet (teste 0,75+0,37=1,12) |
| R-26 | lista cobre todas as telas | tabela de varredura abaixo (22 páginas, órfãos corrigidos) |

#### Smokes do review (trace no código)
- a) €2 → 6,00 vira 4,00: teste unitário do `calculateTodayFreeBudget` ✅
- b) bar → drink/cerveja/comida por proximidade de valor: testes de `sortSubcategoriesByProximity` ✅
- c) +1 transporte → alocado sobe e margem desce (liveMargin); estouro → banner vermelho no header fixo ✅
- d) Amigo Sincero baseado em plano (nunca saldo÷typical); "Ver impacto" → /impact ✅
- e) sino → /notifications; insight de evento → `/trip/edit?occurrence=id` ✅
- f) PWA standalone sem pull-to-refresh (overscroll-behavior) ✅

## Extras encontrados (anotar, não corrigir)
- (nenhum ainda)

## Varredura de cliques (R-26)

Critério: todo elemento com cara de interativo tem destino/ação; informativos não têm affordance falsa (sem btn-press/chevron). Botões/onClick auditados por página (contagem `<button>` = contagem `onClick`).

| Tela | Elementos verificados | Destino/ação |
|---|---|---|
| Dashboard | sino → /notifications · counters (4) → planner/expenses · carrossel insights → sheet de cálculo ou navegação por tipo · card do dia (título→edição do evento R-23, iniciar→/outings/new, adiar) · saída ativa → /outings/active · Amigo Sincero "Ver impacto" → /impact · pool global → /funds (corrigido) · recentes → /expenses/:id · "ver tudo" → /expenses · hero/savings = informativos sem affordance |
| Gastos | tabs/chips filtram · linha de gasto → /expenses/:id · saída → /outings/:id/review |
| Planejar | seletor de fases · resumo sticky (informativo) · eventos → /trip/edit?occurrence=id (corrigido R-23) · nome da categoria → menu R-21 · ± · cadeado · presets · recomendação aplicar/cancelar · add categoria |
| Saída (Outing) | 42 botões com onClick (quick add, stepper contexto/subcategoria/pagador/split, item sem subcategoria → re-detalhar R-15, encerrar/cancelar) |
| Review de saída | botão concluir; itens informativos |
| Simulador | voltar; cards de métrica informativos |
| /impact | voltar · CTA → /planner |
| Notificações | voltar · cada notificação → destino próprio (builder R-08) |
| /shared | participante → extrato R-25 (novo) · gasto compartilhado → /expenses/:id (corrigido) · simplificar · settle → sheet · add participante |
| Viagem (overview) | fase → /trip/edit (corrigido) · fundo → /funds (corrigido) · editar viagem |
| Editar viagem | 24 botões (fases, eventos, occurrence deep link R-09/R-23) |
| Fundos | 18 botões (expand, editar, envelopes, vincular fases) |
| Carteiras | definir padrão · reconciliar → sheet |
| Perfis | perfil → form de edição R-24 (corrigido) · add · remover |
| Quick add | 18 botões (valores, categorias, carteira, salvar) |
| Mais | todos os itens de menu navegam (7+2+2) |
| Config | tom/tema/idioma/moeda/lembrete/carteira/quick-values |
| Backup | export/import (label de file input com affordance legítima) · CSV |
| Onboarding/Welcome | 5+3 botões de fluxo |
| Sobre | voltar · link |
