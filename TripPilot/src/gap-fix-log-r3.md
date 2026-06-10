# Gap Fix Log R3 — TripPilot

## Current State
- **Gate ativo**: Gate 3 (Amigo Sincero v2 + simulador)
- **Requisito ativo**: R-11
- **Itens resolvidos**: 10/26
- **Testes**: 246 unit (+18) + 29 e2e
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
- [ ] R-11 — Amigo Sincero baseado no plano + ImpactDetail
- [ ] R-12 — Simulador multi-métrica

### Gate 4 — Taxonomia (R-13..18)
- [ ] R-13 — Catálogo de subcategorias por tipo
- [ ] R-14 — Stepper ≥10s
- [ ] R-15 — Itens da sessão mostram subcategoria
- [ ] R-16 — Split pergunta o que foi
- [ ] R-17 — Eventos: 2 níveis
- [ ] R-18 — Detalhe de saída com itens específicos

### Gate 5 — Planner overhaul (R-19..24)
- [ ] R-19 — Margem livre ao vivo
- [ ] R-20 — Alerta over-budget no topo + negativo
- [ ] R-21 — Menu de categoria
- [ ] R-22 — Classificação por fase + cadeado real
- [ ] R-23 — Evento abre edição do evento
- [ ] R-24 — Perfis: editar e remover

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
