# TripPilot — Auditoria Total de Cobertura e Corretude

> **Data**: 2026-06-10
> **Baseline**: 317 unit tests ✅ (39 arquivos) · typecheck limpo · build OK (aviso de chunk >500KB) · 29 E2E Playwright ✅
> **Deploy auditado**: v0.5.1 (Cloudflare Pages)
> **Refs**: R1 (36 gaps), R2 (16 gaps + 7 features de campo), R3 (26 requisitos), R4 (14 itens P2P), R5 (9 itens)
> **Escopo do brain**: 113 DECs (DEC-001..113 — o prompt citava 102; 11 foram adicionados em R4/R5), product-spec, 6 deliveries, schema v4 (24 entidades)
> **Restrição respeitada**: zero código de produção modificado; evidências via testes scratch (apagados), runtime Playwright e suíte existente

---

## 1. Resumo Executivo

**A frase que importa**: O app está **~92% do que foi planejado para as deliveries já "concluídas"** (D1–D5 + R1–R5); faltam **9 itens parciais (🟡)**, **4 estão com bug (🐛)**, **0 ausentes (🔴)**, e **31 itens são roadmap futuro (🔮)** corretamente ainda não feitos.

### Números por classificação (inventário de 199 itens)

| Status | Qtde | % |
|---|---:|---:|
| ✅ Correto (com evidência) | 151 | 75,9% |
| 🟡 Parcial | 9 | 4,5% |
| 🐛 Com bug | 4 | 2,0% |
| 🔴 Ausente (prometido p/ delivery concluída) | 0 | 0% |
| 🔮 Futuro (planejado para depois) | 31 | 15,6% |
| ⚠️ Órfão (código sem brain) | 4 | 2,0% |

### Por delivery

| Delivery | Status | % entregue do escopo da delivery |
|---|---|---:|
| D1 — Usable Foundation | Entregue | ~98% (bugs de data afetam exibição) |
| D2 — Real-World Splitting | Entregue | ~95% (BUG-003 na distribuição de dívidas) |
| D3 — Intelligent Forecasting | Entregue parcial por decisão | ~85% (P75, frequência de mercado e reserva 3 níveis adiados via DEC-069) |
| D4 — Outing Mode | Entregue | 100% |
| D5 — Production PWA | Entregue | 100% (Workbox trocado por SW custom — divergência documentada) |
| D6 — Native Layer | Não iniciada (pós-MVP) | 0% — 🔮 conforme plano |

### Top 10 mais críticos (bugs primeiro)

1. **[BUG-001]** 🐛 P1 — Gasto noturno cai no dia errado: datas de transação são UTC, comparações de "dia" usam `slice(0,10)` → após ~21h (UTC-3) o gasto NÃO reduz o "livre para usar hoje" e conta no dia seguinte. Atinge o motor R-06 (DEC-088), streak de insights, gasto por sub-destino, data exibida no histórico/detalhe e CSV. A persona-alvo do app é exatamente o gasto de bar à noite.
2. **[BUG-002]** 🐛 P1 — O último dia inteiro de cada fase é tratado como "fase inativa": no último dia de uma fase ≠ primeira, o Quick-Add grava o gasto **na fase errada** (`phases[0]`) com a lista de fundos errada; o Simulador fica vazio.
3. **[BUG-003]** 🐛 P2 — `calculateDebts` distribui errado com ≥2 devedores e ≥2 credores: credor maior recebe acima do saldo líquido (teste: C deveria +€40, aparece +€60). Afeta a lista "quem deve a quem", os saldos por participante e as sugestões de acerto.
4. **[BUG-004]** 🐛 P3 — Editar o valor de um gasto compartilhado **depois de um share rejeitado** recalcula o custo pessoal pela share do dono (ignora a regra DEC-071 de devolver o valor rejeitado ao pagador).
5. **[PAR-001]** 🟡 — Datas sempre em pt-BR: `formatDate` fixa `locale: ptBR` → dashboard EN mostra "Day 5 · until 15 **de junho**" (confirmado em runtime).
6. **[PAR-002]** 🟡 — `formatMoney` fixa locale pt-BR em 88 call sites → números EN/ES com formatação brasileira (€ 1.234,56); `splitMoneyDisplay` fixa vírgula decimal.
7. **[PAR-003]** 🟡 — Learning engine diverge da spec: 1º dado real descarta 100% da estimativa inicial (peso 1/n sem prior); "P75 com dados suficientes" nunca implementado (aprox. 1,3×típico).
8. **[PAR-004]** 🟡 — Nomes gerados no onboarding hardcoded pt-BR ("Fundo X", "Reserva protegida") mesmo em UI EN/ES.
9. **[PAR-005]** 🟡 — WalletsPage exibe enum cru (`credit_card`, `cash`...) sem i18n; criação de carteira não oferece `credit_card`/`other`.
10. **[FUT]** 🔮 — Maior bloco de roadmap: sync contínuo P2P (DEC-108), Capacitor/notificações nativas (D6), multi-moeda, P75/frequências (D3+), AlertRules UI, sparkline de forecastSnapshots (dados já gravados, UI não).

---

## 2. Regressão R1+R2+R3 (+R4+R5)

Verificação executada na Fase 0 (rg/leitura no código atual + suítes). Resultado global: **108/108 itens mantidos**, zero regressões, zero "feito mas errado" *nas entregas declaradas* — os bugs da seção 4 são problemas que **já existiam** e nunca estiveram no escopo das rodadas.

### R1 — 36 gaps (gap-analysis-2026-06-09.md)

| Item | Status | Evidência |
|---|---|---|
| GAP-001 saque = transferência entre carteiras | ✅ mantido | `withdrawCash`/`transferBetweenWallets` (wallet-orchestrators.ts:24-39), QuickAddPage fluxo `type=withdrawal` |
| GAP-002 reconciliação de caixa | ✅ | `reconcileWallet` + `calculateCashReconciliation` (testes unit wallet-orchestrators) |
| GAP-003 transferência não toca orçamento | ✅ | `createTransferTransaction` budgetPoolId/personalCost null + scratch B1 |
| GAP-004 carteira "não informada" rastreada | ✅ | `getUnassignedTransactionCount` (wallets.ts:78) + chip no QuickAdd |
| GAP-005 settle de dívida sem criar gasto | ✅ | `createSettlement` (splitting.ts:181), e2e shared-confirm "settle a pending debt" |
| GAP-006 "registrar total atual" cria ajuste pela diferença | ✅ | `calculateReportedTotalDiff` (outing.ts:248) + OutingPage:1262,1951 + unit tests |
| GAP-007 simulador acessível | ✅ | rota /simulator, e2e navigation |
| GAP-008/009 future floor + envelopes editáveis | ✅ | FundsPage painel por fundo (futureFloor + envelopes) |
| GAP-010 demo marcada | ✅ | banner `demo.banner` (DashboardPage:510) + e2e dashboard |
| GAP-011 import merge/replace | ✅ | `importBackup(mode)` + `mergeBackupData` (testes backup) |
| GAP-012 CSV 17+6 campos | ✅ | csv-export.ts BASE_HEADERS(20)/ADVANCED(6) + unit csv-export |
| GAP-013 useLiveSettings (tema/idioma vivos) | ✅ | useLiveSettings.ts (liveQuery), RootLayout aplica na raiz |
| GAP-014..019 (hero, fundos por fase, shopping global por scope, contadores) | ✅ | DashboardPage (GAP-017 comentado na linha 433), getAvailablePoolsForPhase |
| GAP-020 contadores = previsão do plano ativo | ✅ | DashboardPage:252-287 + forecasting unit tests |
| GAP-021..025 planner básico, trade-offs, navegação trip | ✅ | PlannerPage (locks/priority), TripOverviewPage (DEC-060) |
| GAP-026 carteiras default no onboarding | ✅ | onboarding.ts:114-139 (cartão default + dinheiro opcional) |
| GAP-027 data/hora retroativa | ✅ | QuickAddPage:317-325 (mas ver BUG-001: conversão UTC) |
| GAP-028 perfis custom | ✅ | createCustomActivityProfile + ProfilesPage |
| GAP-029 validação Zod no import | ✅ | parseBackupFileSafe (backup.ts:222) + unit validation |
| GAP-030 orquestradores atômicos | ✅ | registerExpense/endOutingSession com db.transaction |
| GAP-031 confirmação orçamento zero | ✅ | QuickAddPage:159-168 + BottomSheet zero_budget |
| GAP-032 acertos simplificados | ✅ | suggestSimplifiedSettlements + scratch B1 (conservação) |
| GAP-033..036 (SW precache, offline, ícones, persistent storage) | ✅ | sw.js precacheBuildAssets, requestPersistentStorage, e2e pwa |

### R2 — 16 gaps + 7 features (FIELD-01..07 etc.)

| Item | Status | Evidência |
|---|---|---|
| GAP-R2-001 update toast do SW (DEC-082) | ✅ | pwa.ts promptUpdate + sw.js SKIP_WAITING (sem skipWaiting automático) |
| GAP-R2-002..004 (tema claro completo, headers fixos, margens) | ✅ | DEC-083/084/085 — page-sticky-header no Dashboard, tokens globals.css |
| GAP-R2-005 persistent storage idempotente | ✅ | QuickAddPage:235 + pwa.ts:55 |
| GAP-R2-006 forecasts por fase | ✅ | calculateOccasionForecasts(phaseId) + comentário GAP-R2-006 |
| GAP-R2-007 timezone do day card | ✅ | localDateString (dates.ts:49) usado no Dashboard/useNotifications — **mas o equivalente para datas de transação ficou de fora → BUG-001** |
| GAP-R2-008/009 (e2e reais) | ✅ | 29 e2e cobrindo outing/planner/backup/shared |
| FIELD-01 perfis habilitados por fase (DEC-074) | ✅ | isProfileEnabledInPhase + phaseProfileSettings |
| FIELD-02 ritmo da fase + dias de pico (DEC-075) | ✅ | rhythm.ts + unit rhythm.test + scratch H5 |
| FIELD-03 confirmação explícita de shares (DEC-071) | ✅ | findPendingConfirmationShares + sheet no Dashboard + e2e shared-confirm |
| FIELD-04 sessão avulsa sem perfil (DEC-073) | ✅ | startOneOffEventSession (occurrence one-off) |
| FIELD-05 eventos planejados (DEC-072) | ✅ | calculateEventReserves + day card + e2e events |
| FIELD-06 carrossel por uso (DEC-076) | ✅ | orderForecastsByUsage + unit forecasting |
| FIELD-07 insights rotativos (DEC-077) | ✅ | buildDashboardInsights (6 builders, máx 4) + unit insights |
| FIELD-08..14 (stepper, histórico de saídas, navegações) | ✅ | enrichment.ts, OutingPage histórico, FIELD-13/14 navegação nos cards |

### R3 — 26 requisitos (R-01..R-26)

| Item | Status | Evidência |
|---|---|---|
| R-01 headers fixos (DEC-084) | ✅ | page-sticky-header |
| R-02 margens compactas (DEC-085) | ✅ | tokens --page-padding-x |
| R-03 cards de contador altura idêntica | ✅ | OccasionCounter min-h/line-clamp (DashboardPage:1265) |
| R-04 scrollbars invisíveis (DEC-086) | ✅ | .no-scrollbar |
| R-05 pull-to-refresh off em standalone (DEC-087) | ✅ | globals.css:51 overscroll-behavior-y none |
| R-06 "livre para usar hoje" subtrativo (DEC-088) | ✅ lógica / 🐛 dados | calculateTodayFreeBudget correto (scratch B1: 5000/4000, negativo OK) — mas alimentado por calculateSpentOnDate com dia UTC (BUG-001) |
| R-07 sem "reservado p/ próxima fase" no hero (DEC-089) | ✅ | comentário DashboardPage:735 |
| R-08 central de notificações (DEC-090) | ✅ | notifications.ts (5 tipos) + useNotifications + sino badge |
| R-09 insights: swipe + detalhe (DEC-091) | ✅ | carrossel + InsightDetail "como chegamos aqui" |
| R-10 economia contextual (DEC-092) | ✅ | calculateLastOutingSavings (janela 7d, unit budget.test) |
| R-11 Amigo Sincero v2 (DEC-093) | ✅ | honest-friend.ts (on_plan/over_pace/no_plan) + unit honest-friend |
| R-12 simulador multi-métrica (DEC-094) | ✅ | simulateSpendMultiMetric (pior veredito) + SimulatorPage:123 |
| R-13 taxonomia de subcategorias (DEC-095) | ✅ | expense-taxonomy.ts (17 listas) + sort por proximidade |
| R-14 stepper ≥10s (DEC-096) | ✅ | ENRICH_AUTO_DISMISS_MS = 10000 |
| R-15..R-17 (categoria no split, 2 níveis p/ eventos) | ✅ | EVENT_CONTEXTS + getSubcategoriesForContext |
| R-18 rótulo do item da sessão (DEC-097) | ✅ | formatSessionItemLabel em OutingPage/OutingReviewPage |
| R-19/R-20 planner margem livre viva + alerta no topo (DEC-098) | ✅ | PlannerPage margem + e2e planner |
| R-21 menu de categorias no planner (DEC-099) | ✅ | PlannerPage perfil sheet |
| R-22 classificação por fase + cadeado real (DEC-100) | ✅ | isLocked/priority persistidos (PlannerPage:312-319) |
| R-23 evento do planner abre editor (DEC-101) | ✅ | navigate `/trip/edit?occurrence=` (DashboardPage:604) |
| R-24/R-26 (cards → funds) | ✅ | global pool card navega /funds (R-26 comentado) |
| R-25 extrato por participante (DEC-102) | ✅ | buildParticipantStatement + unit splitting (consistência com calculateDebts nos confirmados) |

### R4 — 14 itens (sync P2P) e R5 — 9 itens

| Item | Status | Evidência |
|---|---|---|
| R4: canal WebRTC + signaling worker (DEC-103/107) | ✅ | data/sync/* (channel, connection, signaling-client, webrtc-transport) |
| R4: migração de dispositivo (DEC-104) | ✅ | migration-payload.ts + unit sync tests |
| R4: identidade sem conta (DEC-105) | ✅ | identity.ts + qr-codec + unit qr-and-identity |
| R4: modelo owner/mirror (DEC-106) | ✅ | mirrored.ts + statement-payload + unit owner-mirror-cycle |
| R4: crypto da sessão | ✅ | sync/crypto.ts + unit sync-crypto |
| R4: backup v4 (peerLinks/mirroredStatements) | ✅ | BACKUP_VERSION=4, normalizeBackupToV4, migration-v4.test |
| R5-01 DataErrorScreen (DEC-109) | ✅ | useAppData timeout 10s + DataErrorScreen em todas as páginas |
| R5-02 export iOS-safe (DEC-110) | ✅ | downloadFile com navigator.share (csv-export.ts:166) |
| R5-03 aviso storage não persistente | ✅ | DashboardPage:160-169,517 |
| R5-04 demo repair restrito (DEC-111) | ✅ | repairDemoTripIfNeeded gate `settings.isDemo` + unit demo-repair |
| R5-05 onboarding com detalhes da fase | ✅ | onboarding.ts phaseStartDate/rhythm + e2e onboarding |
| R5-06 adições por categoria na sessão | ✅ | listSessionAdditions/formatAdditionsList + unit session-additions |
| R5-07/08 (deficit do planner derivado, DEC-112) | ✅ | PlannerPage estado derivado |
| R5-09 gauge piecewise (DEC-113) | ✅ | calculateGaugePosition (outing.ts:158) + unit gauge-position |

---

## 3. INVENTÁRIO MESTRE — Matriz de Cobertura Total

199 itens. Evidências: **U** = teste unitário existente; **E** = teste E2E Playwright; **S** = teste scratch desta auditoria; **R** = verificação runtime desta auditoria; **C** = trace de código documentado (com nota quando é a única evidência).

### Área A — Orçamento & Fundos

| INV | Item | Fonte | Alvo | Status | Evidência |
|---|---|---|---|---|---|
| INV-001 | Dinheiro em centavos inteiros | DEC-020 | D1 | ✅ | U money.test + toCents/fromCents |
| INV-002 | freeToSpend = fundo − gasto − reserva − floor − eventos | DEC-023/072 | D1/R2 | ✅ | S (decomposição 100000→50000) + U budget.test |
| INV-003 | Clamp em 0 do freeToSpend (nunca negativo no hero) | DEC-053 | D1 | ✅ | budget.ts:69 + U |
| INV-004 | Reserva protegida como Envelope | DEC-042 | D1 | ✅ | U + onboarding.ts:94 |
| INV-005 | Future floor manual por link de fase | DEC-016/069 | D3 | ✅ | calculateFutureFloor + U; automático = 🔮 (INV-172) |
| INV-006 | Pools `linked_phases` vs `global` | DEC-007/040 | D1 | ✅ | getAvailablePoolsForPhase + U |
| INV-007 | Auto-seleção só com 1 pool operacional | DEC-040 | D1 | ✅ | budget.ts:298 + U |
| INV-008 | Shopping pessoal isolado (global, por scope) | DEC-011/041 | D1 | ✅ | E dashboard pools + GAP-017 |
| INV-009 | Fase pode existir sem pool | DEC-039 | D1 | ✅ | QuickAdd empty state "no_pool_for_phase" |
| INV-010 | Reservas de eventos deduzem até confirmar/ligar | DEC-072 | R2 | ✅ | calculateEventReserves + U occurrences |
| INV-011 | Reserva de evento conta só no pool dele | DEC-072 | R2 | ✅ | budget.ts:64 filtro budgetPoolId + U |
| INV-012 | Hero "Livre para usar até {data}" | DEC-023 | D1 | ✅ | E dashboard hero |
| INV-013 | Breakdown: saldo do fundo + reserva + eventos | spec §7 | D1 | ✅ | DashboardPage:728-754 |
| INV-014 | Sem linha "reservado p/ próx. fase" no hero | DEC-089 | R3 | ✅ | comentário/ausência verificada |
| INV-015 | Barra de progresso de gasto do fundo | spec §7 | D1 | ✅ | E "pools with progress bars" |
| INV-016 | FundsPage: CRUD de fundos/envelopes/floors | GAP-008/009 | R1 | ✅ | FundsPage handlers + R (rota carregada) |
| INV-017 | Política de deleção fundo/fase (bloqueio com dados) | DEC-080 | R2 | ✅ | U crud-orchestrators.test (deleteBudgetPool/deletePhase) |
| INV-018 | Troca de ordem de fases | DEC-080 | R2 | ✅ | swapPhaseOrder + U |
| INV-019 | Health status do orçamento (70/90%) | spec | D1 | ✅ | getBudgetHealthStatus + U |
| INV-020 | "Livre hoje" subtrativo, negativo permitido | DEC-088 | R3 | ✅ lógica | S (5000→4000; −3000) — exibição sofre BUG-001 |

### Área B — Gastos & Carteiras

| INV | Item | Fonte | Alvo | Status | Evidência |
|---|---|---|---|---|---|
| INV-021 | Quick-add: valor + categoria + fundo + carteira opcional | spec §4 | D1 | ✅ | E quick-add + QuickAddPage |
| INV-022 | Registro nunca bloqueia (orçamento ≤0 pede confirmação) | DEC-053a | D1 | ✅ | QuickAddPage:159 + sheet |
| INV-023 | Data/hora retroativa opcional | GAP-027 | R1 | 🐛 | BUG-001: `new Date(customDate).toISOString()` desloca o dia em UTC−3 (S) |
| INV-024 | Dia do gasto nas agregações diárias | DEC-088 | R3 | 🐛 | BUG-001: calculateSpentOnDate compara dia UTC vs localDateString (S) |
| INV-025 | Categorias (9 chips) + ícones | spec | D1 | ✅ | CATEGORY_KEYS + getCategoryIcon |
| INV-026 | Subcategoria persistida e exibida (sessão/histórico) | DEC-095/097 | R3 | ✅ | subcategoryId + findSubcategory + U |
| INV-027 | Carteira "não informada" + atribuição em lote no fim da saída | DEC-051/049 | D1/D4 | ✅ | endOutingSession walletId batch + U end-outing-session |
| INV-028 | Transferência entre carteiras (sem orçamento) | DEC-052 | D2 | ✅ | S/B1 + U wallet-orchestrators |
| INV-029 | Saque = banco → dinheiro | Core Rule 3 | D2 | ✅ | withdrawCash + QuickAdd default não-cash → cash |
| INV-030 | Saldo de carteira (inicial + entradas − saídas) | spec | D2 | ✅ | calculateWalletBalance + U |
| INV-031 | Reconciliação: faltou → ajuste positivo; sobrou → negativo | DEC-052 | D2 | ✅ | reconcileWallet sinal invertido + U |
| INV-032 | Ajuste reduz/devolve orçamento (type adjustment no poolSpent) | DEC-052 | D2 | ✅ | calculatePoolSpent inclui adjustment + U |
| INV-033 | Carteira default editável + dinheiro opcional no onboarding | DEC-051 | R1 | ✅ | onboarding.ts:114-139 |
| INV-034 | Quem pagou terceiro → walletId null (não debita carteira do dono) | Core Rule 2 | D2 | ✅ | QuickAddPage:203 comentário + código |
| INV-035 | Edição de gasto (valor/categoria/fundo/carteira/data) | FIELD-13 | R2 | ✅ | ExpenseDetailPage handleSaveEdit |
| INV-036 | Edição rescala shares proporcionalmente | DEC-071 | R2 | 🐛 | BUG-004: pós-rejeição usa calculatePersonalCost (share do dono) e não devolve rejeitado ao pagador |
| INV-037 | Soft delete em todas as queries | technical-direction | D1 | ✅ | BaseRepository filtra deletedAt + filtros de domínio |
| INV-038 | Lista de gastos com filtros (categoria/perfil/aba saídas) | FIELD-14 | R2 | ✅ | ExpenseListPage searchParams + R |
| INV-039 | Data exibida no histórico/detalhe | spec | D1 | 🐛 | BUG-001 (superfície): mostra dia UTC (ExpenseListPage:169, ExpenseDetailPage:172) |
| INV-040 | Carteiras: criar/editar/definir default | spec | D1 | 🟡 | PAR-005: enum cru sem i18n; criação sem `credit_card`/`other` (WalletsPage:140,190) |

### Área C — Saídas (Outing Mode)

| INV | Item | Fonte | Alvo | Status | Evidência |
|---|---|---|---|---|---|
| INV-041 | Sessão com 3 limites (alvo<teto<máx) | DEC-010 | D4 | ✅ | deriveSessionLimits ordenado + U outing.test |
| INV-042 | Limites derivados p/ perfis sem defaults (passos €5) | DEC-044 | D4 | ✅ | roundToStep + U |
| INV-043 | Quick-add €3/5/7/10/15 (fonte única) | DEC-045/062 | D4 | ✅ | DEFAULT_QUICK_ADD_VALUES_CENTS + U |
| INV-044 | Destaque no botão mais próximo do preço médio | DEC-045 | D4 | ✅ | findHighlightedQuickValueIndex + U |
| INV-045 | Alertas progressivos 50/75/90/100 sobre o teto | DEC-048 | D4 | ✅ | getProgressiveAlerts (ceiling ?? target) + U |
| INV-046 | Alertas disparados 1× (firedAlertPercents persistido) | DEC-048 | D4 | ✅ | OutingPage:330-346 + U session-repository (recuperação) |
| INV-047 | Impacto do próximo drink | spec §4 | D4 | ✅ | calculateNextDrinkImpact + U |
| INV-048 | Gauge piecewise (zonas visuais fixas 3:2:1:1) | DEC-113 | R5 | ✅ | U gauge-position (casos de borda) |
| INV-049 | "Registrar total atual" → ajuste pela diferença; negativo confirma | DEC-046 | D4 | ✅ | calculateReportedTotalDiff + U + OutingPage 2 fluxos |
| INV-050 | Revisão única no fim (carteira lote, flags, aprendizado) | DEC-049 | D4 | ✅ | endOutingSession atômico + U end-outing-session |
| INV-051 | Ocasião especial/excluída não ensina o perfil | DEC-006 | D4 | ✅ | guard no orchestrator + U |
| INV-052 | Total pessoal da sessão (shares só a parte do dono) | DEC-047 | D4 | ✅ | calculateSessionTotal personalCost + U |
| INV-053 | Sessão de evento: teto = reserva, occurrence ligada | DEC-072 | R2 | ✅ | startSessionForOccurrence + U event-orchestrators |
| INV-054 | Fim da sessão confirma occurrence ligada | DEC-072 | R2 | ✅ | endOutingSession bloco occurrence + U |
| INV-055 | Sessão avulsa não cria perfil recorrente | DEC-073 | R2 | ✅ | startOneOffEventSession + U |
| INV-056 | Recuperação de sessão ativa após reload | spec | D4 | ✅ | sessionRepository.getActive no mount + E outing-flow |
| INV-057 | Histórico de saídas com duração compacta | DEC-079 | R2 | ✅ | formatSessionDuration + U + aba outings |
| INV-058 | Stepper de enriquecimento ≥10s, reset por interação | DEC-078/096 | R2/R3 | ✅ | ENRICH_AUTO_DISMISS_MS + U enrichment |
| INV-059 | 2 níveis para eventos (contexto → subcategoria) | DEC-096 | R3 | ✅ | EVENT_CONTEXTS + U |
| INV-060 | Fluxo completo iniciar→add→encerrar→histórico | spec | D4 | ✅ | E outing-flow |

### Área D — Planner & Forecasting

| INV | Item | Fonte | Alvo | Status | Evidência |
|---|---|---|---|---|---|
| INV-061 | Perfis com aprendizado (média móvel + confiança) | DEC-006 | D3 | 🟡 | PAR-003: 1º dado descarta estimativa inicial (S: 1500→9000); confiança 5/10 OK (U) |
| INV-062 | Safe = P75 com dados suficientes | spec §4 | D3 | 🔮 | nunca implementado (1,3×típico) — registrado como adiado |
| INV-063 | Previsão por ocasião ("restam X") por fase | DEC-006/043 | D3 | ✅ | calculateOccasionForecasts + U forecasting |
| INV-064 | Perfis com uso aparecem sem alocação | DEC-076 | R2 | ✅ | filtro totalPlanned>0 || spent>0 + U |
| INV-065 | Planner com presets e modo manual | DEC-015 | D3 | ✅ | createScenarioPlan + PlannerPage + E planner |
| INV-066 | Itens com cadeado de efeito real | DEC-100 | R3 | ✅ | isLocked persistido e respeitado na recomendação |
| INV-067 | Prioridades essencial/flexível/opcional data-driven | DEC-100 | R3 | ✅ | priority map (PlannerPage:67-70) |
| INV-068 | Margem livre viva + alerta de estouro no topo | DEC-098 | R3 | ✅ | E planner "allocated total updates" |
| INV-069 | Aviso de déficit derivado do estado | DEC-112 | R5 | ✅ | PlannerPage derivação (R5-07) |
| INV-070 | Eventos/sub-destinos no planner (linha + gasto até agora) | DEC-072 | R2 | ✅ | sumSpentInOccurrenceInterval + U — janela usa dia UTC (superfície BUG-001) |
| INV-071 | Simulador "posso gastar?" com níveis de risco | DEC-050 | D3 | ✅ | simulateSpend + U |
| INV-072 | Simulador multi-métrica (3 perspectivas, pior tom) | DEC-094 | R3 | ✅ | simulateSpendMultiMetric + U + wiring SimulatorPage |
| INV-073 | Risco combinado completo (reserva intacta etc.) | DEC-050 | D3+ | 🔮 | adiado (seção 9 do R1); DEC-094 cobre parcialmente |
| INV-074 | Ritmo da fase: pico 1,5×, presets 1,0/0,8/0,6 | DEC-075 | R2 | ✅ | U rhythm + S H5 (7,0 dias efetivos) |
| INV-075 | Dias efetivos ponderados até o fim | DEC-075 | R2 | ✅ | U + S — nota: quebra teórica só em UTC+13/14 (cursor.toISOString) |
| INV-076 | Amigo Sincero v2 ancorado no plano | DEC-093 | R3 | ✅ | U honest-friend (on_plan/over_pace/fitCount) |
| INV-077 | Projeção de quando a reserva começa a ser usada | DEC-093 | R3 | ✅ | projectReserveStartDate + U |
| INV-078 | Fallback sem plano: % da margem, nunca contagem | DEC-093 | R3 | ✅ | U no_plan impactPercent |
| INV-079 | Perfis habilitados por fase (ausência = habilitado) | DEC-074 | R2 | ✅ | isProfileEnabledInPhase + U profiles |
| INV-080 | Frequência de mercado prevista | spec §4 | D3 | 🔮 | adiado — contadores genéricos cobrem o uso |

### Área E — Social (Splitting)

| INV | Item | Fonte | Alvo | Status | Evidência |
|---|---|---|---|---|---|
| INV-081 | Split igual com resto absorvido (1º centavos) | DEC-019 | D2 | ✅ | S (€10/3 = 334/333/333) + U money |
| INV-082 | Split custom; resto não alocado vai ao pagador | DEC-070 | D2 | ✅ | S (300+300 de 1000 → pagador 700) + U splitting |
| INV-083 | Share do pagador nasce confirmada; terceiros pendentes | DEC-071 | R2 | ✅ | buildSharesWithPayer + U |
| INV-084 | Só shares confirmadas consolidam dívida | DEC-071 | R2 | ✅ | calculateDebts filtro confirmed + U |
| INV-085 | Rejeição devolve valor ao pagador | DEC-071 | R2 | ✅ | S (3000 → pessoal 2000) + U + resolveShareConfirmation |
| INV-086 | Confirmar com valor ajustado | DEC-071 | R2 | ✅ | adjustedAmountCents (share-orchestrators) + sheet no Dashboard |
| INV-087 | Card de pendências some quando tudo confirmado | DEC-071 | R2 | ✅ | findPendingConfirmationShares + E shared-confirm |
| INV-088 | Quem deve a quem (netting) | DEC-024 | D2 | 🐛 | BUG-003: má distribuição com ≥2 devedores e ≥2 credores (S: C +6000 vs +4000) |
| INV-089 | Cenário da irmã (2×€20 cruzado) netting correto | spec §5 | D2 | ✅ | U splitting (caso 1 devedor↔1 credor é correto) |
| INV-090 | Settle parcial aplicado por cima | DEC-024 | D2 | ✅ | settlements aplicados nos balanços + U |
| INV-091 | Acertos simplificados (mínimo de transferências) | GAP-032 | R1 | ✅ | S (conservação) + U — entrada sofre BUG-003 |
| INV-092 | Saldos por participante na SharedPage | spec | D2 | 🐛 | superfície de BUG-003 (calculateParticipantBalances sobre dívidas erradas) |
| INV-093 | Extrato por participante (linhas + net) | DEC-102 | R3 | ✅ | buildParticipantStatement + U (net = calculateDebts p/ mesmos inputs) |
| INV-094 | Adicionar participante (nome + apelido) | DEC-056 | D2 | ✅ | createParticipant + SharedPage form |
| INV-095 | Custo pessoal provisório (pendente conta p/ dono) | DEC-019/071 | D2 | ✅ | calculateOwnerPersonalCost documentado + U |
| INV-096 | Gasto compartilhado em sessão usa parte pessoal | DEC-047 | D4 | ✅ | calculateSessionTotal + U |
| INV-097 | Impacto pendente no card (soma das shares) | DEC-063→071 | D2 | ✅ | pendingImpactCents (DashboardPage:387) |

### Área F — Dados (Backup/CSV/Validação)

| INV | Item | Fonte | Alvo | Status | Evidência |
|---|---|---|---|---|---|
| INV-098 | Backup JSON completo (23 tabelas + settings) | DEC-013 | D1 | ✅ | BACKUP_TABLE_KEYS(23) + U backup + E round-trip |
| INV-099 | Import merge por revision (analyze + conflitos) | DEC-013 | D1 | ✅ | analyzeImport/mergeBackupData + U |
| INV-100 | Import replace | DEC-013 | D1 | ✅ | importBackup mode + U backup-orchestrators |
| INV-101 | Validação Zod antes de escrever (sem writes parciais) | GAP-029 | R1 | ✅ | parseBackupFileSafe + U validation |
| INV-102 | Compat v1→v4 (normalização com defaults das migrations) | R4 | R4 | ✅ | normalizeBackupToV3/V4 + U migration-v3/v4 |
| INV-103 | CSV 20 campos base + 6 avançados | DEC-058 | D1 | ✅ | U csv-export campo a campo |
| INV-104 | CSV avançado inclui deletados com status | DEC-058 | D1 | ✅ | filtro advanced + coluna Status |
| INV-105 | CSV resumo de confirmação de rateio | DEC-071 | R2 | ✅ | summarizeShareConfirmation + U |
| INV-106 | Export iOS-safe (Web Share + revoke adiado) | DEC-110 | R5 | ✅ | downloadFile (csv-export.ts:166-195) |
| INV-107 | Lembrete de backup (intervalo, nunca = devido) | DEC-061/070 | D1 | ✅ | isBackupReminderDue + U + banner |
| INV-108 | lastBackupDate atualizado no export | DEC-070 | R1 | ✅ | BackupPage:90,226 |
| INV-109 | Coluna Data/Hora do CSV | DEC-058 | D1 | 🐛 | superfície BUG-001: dia/hora UTC, não local |
| INV-110 | Sem dados pessoais no build público | DEC-014 | D1 | ✅ | demo fictícia; sem credenciais (rg) |

### Área G — PWA & Distribuição

| INV | Item | Fonte | Alvo | Status | Evidência |
|---|---|---|---|---|---|
| INV-111 | Manifest válido + ícones + shortcuts | D5 | D5 | ✅ | E pwa (manifest, icons, meta) |
| INV-112 | SW: navegação network-first | DEC-082 | R2 | ✅ | sw.js networkFirst p/ navigate (leitura completa) |
| INV-113 | SW: assets hashed cache-first + precache do shell | GAP-036 | R1 | ✅ | precacheBuildAssets + cacheFirst |
| INV-114 | Update toast persistente; usuário decide (SKIP_WAITING) | DEC-082 | R2 | ✅ | pwa.ts promptUpdate + sw.js message handler |
| INV-115 | "Pronto para offline" no 1º install | DEC-053d | R1 | ✅ | isFirstInstall + toast offline_ready |
| INV-116 | Reload único no controllerchange | DEC-082 | R2 | ✅ | guard reloading/isFirstInstall |
| INV-117 | Persistent storage automático (onboarding, 1º gasto) | GAP-R2-005 | R2 | ✅ | requestPersistentStorage idempotente |
| INV-118 | Aviso quando storage não persistido | R5-03 | R5 | ✅ | navigator.storage.persisted no Dashboard |
| INV-119 | Pull-to-refresh off em standalone | DEC-087 | R3 | ✅ | globals.css @media display-mode |
| INV-120 | Deploy Cloudflare Pages + signaling Worker | DEC-005/107 | D5/R4 | ✅ | project-status v0.5.1 + functions/ |
| INV-121 | Offline: app abre e registra gasto | D5 | D5 | ✅ | SW cache shell + IndexedDB local (E pwa + arquitetura local-first) |
| INV-122 | Timeout do IndexedDB → tela de recuperação | DEC-109 | R5 | ✅ | withTimeout 10s + DataErrorScreen + visibilitychange retry |

### Área H — Dashboard, Insights & Notificações

| INV | Item | Fonte | Alvo | Status | Evidência |
|---|---|---|---|---|---|
| INV-123 | Ordem de cards por prioridade (§7) | DEC-030 | D1 | ✅ | DashboardPage posições comentadas (§7 pos.3-10) |
| INV-124 | Day card de evento (intervalo, sem sessão) | DEC-072 | R2 | ✅ | isOccurrenceActiveToday + E events |
| INV-125 | Evento multi-dia aparece todos os dias | DEC-072 | R2 | ✅ | U occurrences (start≤hoje≤end) |
| INV-126 | [Iniciar agora] e [Adiar +1d] | DEC-072 | R2 | ✅ | handlers + postponeOccurrence U |
| INV-127 | Card de saída ativa (tempo, total, drinks restantes) | spec §7 | D4 | ✅ | DashboardPage:641-672 |
| INV-128 | Contadores carrossel (3 visíveis, dots) | DEC-076 | R2 | ✅ | scroll-snap + R |
| INV-129 | Insights: máx 4/dia, só com sinal | DEC-077 | R2 | ✅ | MAX_INSIGHTS_PER_DAY + builders null + U |
| INV-130 | Projeção fim de fase ponderada por ritmo | DEC-077 | R2 | ✅ | buildPhaseProjection + U insights |
| INV-131 | Streak de dias sem gasto | DEC-077 | R2 | ✅ lógica | U — datas das transações em UTC (superfície BUG-001) |
| INV-132 | Insight swipe + tap detalhe "como chegamos aqui" | DEC-091 | R3 | ✅ | InsightDetail breakdown completo |
| INV-133 | Card de economia da última saída (janela 7d) | DEC-092 | R3 | ✅ | U budget (calculateLastOutingSavings) |
| INV-134 | Snapshot diário de forecast (1/fase/dia) | DEC-077 M8.3 | R2 | ✅ | persist effect + getByPhaseAndDate guard |
| INV-135 | Sparkline alimentada pelos snapshots | DEC-077 | V2 | 🔮 | dados gravados; UI adiada (registrado) |
| INV-136 | Central de notificações derivadas (5 tipos) | DEC-090 | R3 | ✅ | buildNotifications + U notifications |
| INV-137 | Sino com badge; navegação por destino | DEC-090 | R3 | ✅ | useNotifications + destination strings |
| INV-138 | Deep-link confirmShares=1 abre sheet | DEC-090 | R3 | ✅ | DashboardPage:220-225 |
| INV-139 | Saída longa >8h gera aviso | DEC-090 | R3 | ✅ | LONG_OUTING_THRESHOLD_MS + U |
| INV-140 | Fase estourada → notificação de erro | DEC-090 | R3 | ✅ | phase_over_budget + U |
| INV-141 | Banner demo permanente | DEC-038 | D1 | ✅ | E dashboard demo banner |
| INV-142 | Dia "N · até {fim}" no header fixo | DEC-084 | R2 | 🟡 | PAR-001: mês sempre pt-BR (R: "de junho" em EN) |

### Área I — Configurações, i18n & Design

| INV | Item | Fonte | Alvo | Status | Evidência |
|---|---|---|---|---|---|
| INV-143 | Settings V1: tom, vibração, lembrete, tema, idioma, nome do dispositivo | DEC-057 | D1 | ✅ | SettingsPage + useLiveSettings |
| INV-144 | Tema dark/light/system ao vivo em todas as rotas | DEC-066/083 | R2 | ✅ | RootLayout na raiz + liveQuery + E |
| INV-145 | pt-BR/en/es 100% traduzidos (paridade de chaves) | DEC-065 | D1 | ✅ | 737 chaves × 3 (diff programático) + R: zero chave crua em 15 rotas × 3 línguas |
| INV-146 | Sem pt hardcoded nos componentes | D1 AC | D1 | ✅ | R scan + rg — exceções são DADOS (demo/onboarding, ver PAR-004) |
| INV-147 | Formatação de DATAS no idioma ativo | DEC-065 | D1 | 🟡 | PAR-001: dates.ts:54 fixa ptBR (R confirmado) |
| INV-148 | Formatação de NÚMEROS no idioma ativo | DEC-065 | D1 | 🟡 | PAR-002: formatMoney locale default pt-BR em 88 calls; splitMoneyDisplay vírgula fixa |
| INV-149 | Nomes gerados localizados (fundo/reserva do onboarding) | DEC-065 | D1 | 🟡 | PAR-004: onboarding.ts:80,98 hardcoded pt |
| INV-150 | Tom "amigo sincero" nas mensagens | DEC-012/035 | D4 | ✅ | chaves amigo_* nas 3 línguas + alertTone setting |
| INV-151 | Design system Mediterranean Cockpit (tokens) | DEC-022 | D1 | ✅ | globals.css tokens + contraste DEC-033 |
| INV-152 | Headers fixos + margens compactas + scrollbar invisível | DEC-084/085/086 | R2 | ✅ | classes utilitárias verificadas |
| INV-153 | Mobile feel global (btn-press, tap targets) | DEC-081 | R2 | ✅ | btn-press generalizado + aria-labels (32) |
| INV-154 | FAB com 6 ações em overlay real | DEC-027/034 | D1 | ✅ | E navigation (FAB central) |
| INV-155 | "Mais" em lista seccionada; Sobre sem reports | DEC-059/064 | D1 | ✅ | MorePage/AboutPage |
| INV-156 | EUR-only na interface V1 | DEC-021 | D1 | ✅ | baseCurrency única; multi-moeda 🔮 INV-173 |
| INV-157 | CSV com headers pt-BR | DEC-058 | D1 | ✅* | conforme DEC-058 (definido em pt) — *se EN/ES virarem requisito, reabrir |

### Área J — Onboarding, Demo & Erros

| INV | Item | Fonte | Alvo | Status | Evidência |
|---|---|---|---|---|---|
| INV-158 | Onboarding mínimo: viagem+fase+valor → dashboard | DEC-036 | D1 | ✅ | E onboarding completo |
| INV-159 | Passo de detalhes da fase (datas prefill, ritmo) | R5-05 | R5 | ✅ | onboarding.ts phaseStartDate/rhythm + E |
| INV-160 | Welcome: criar / importar / demo | spec | D1 | ✅ | E welcome buttons |
| INV-161 | Demo completa e ficcional | DEC-038 | D1 | ✅ | generateDemoData + U demo-repair |
| INV-162 | Demo repair só em viagens demo | DEC-111 | R5 | ✅ | gate isDemo + U |
| INV-163 | Falha de DB nunca vira onboarding | DEC-109 | R5 | ✅ | error flag + DataErrorScreen em todas as páginas |
| INV-164 | ErrorBoundary global | technical-direction | D1 | ✅ | main.tsx:27 |
| INV-165 | Rotas lazy + fallback de loading | technical-direction | D1 | ✅ | router.tsx LazyRoute |

### Área K — Sync P2P (R4/R5)

| INV | Item | Fonte | Alvo | Status | Evidência |
|---|---|---|---|---|---|
| INV-166 | Canal WebRTC com signaling próprio | DEC-103/107 | R4 | ✅ | data/sync/* + U protocol |
| INV-167 | Pareamento por QR + identidade sem conta | DEC-105 | R4 | ✅ | U qr-and-identity |
| INV-168 | Migração de dispositivo (transfer completo) | DEC-104 | R4 | ✅ | U migration payload + SyncTransferFlow |
| INV-169 | Modelo owner/mirror (sem merge bidirecional de dinheiro) | DEC-106 | R4 | ✅ | U owner-mirror-cycle + mirrored.test |
| INV-170 | Extrato espelhado: responder/aplicar respostas | DEC-106 | R4 | ✅ | sync-orchestrators + MirroredStatementsSection |
| INV-171 | Criptografia de sessão | R4 | R4 | ✅ | U sync-crypto + sync-session |

### Área L — 🔮 Roadmap futuro (corretamente não feito)

| INV | Item | Fonte | Alvo |
|---|---|---|---|
| INV-172 | Future floor automático (3 níveis essencial/recomendado/confortável) | DEC-016/069 | D3+/V2 |
| INV-173 | Multi-moeda com câmbio | DEC-021 / V2 roadmap | V2 |
| INV-174 | Relatórios/insights de padrões | V2 roadmap | V2 |
| INV-175 | AlertRules com UI | schema D1 / seção 9 R1 | V2 |
| INV-176 | Sparkline de forecastSnapshots | DEC-077 | V2 |
| INV-177 | Push notifications remotas | V2 roadmap | V2 |
| INV-178 | Capacitor Android + APK | DEC-017 / D6 | D6 |
| INV-179 | Notificações locais agendadas em saídas | D6 | D6 |
| INV-180 | Widget Android | D6 | D6+ |
| INV-181 | Sync contínuo em background | DEC-108 | V2 |
| INV-182 | UI de conflitos multi-peer | DEC-108 | V2 |
| INV-183 | Multi-peer (>2 dispositivos) | DEC-108 | V2 |
| INV-184 | Login/contas + sync remoto (Supabase/D1) | DEC-018 / V2 | V2 |
| INV-185 | Grupos multi-usuário | DEC-018 | V2 |
| INV-186 | Import Wise CSV/PDF | V2 roadmap | V2 |
| INV-187 | Receipt scanning | V2 roadmap | V2 |
| INV-188 | Trip templates | V2 roadmap | V2 |
| INV-189 | P75 no learning engine | spec §4 | D3+ |
| INV-190 | Frequência de mercado prevista | spec §4 | D3+ |
| INV-191 | Risco combinado completo no simulador | DEC-050 | D3+ |
| INV-192 | PlannedOccurrence avançado (recorrência etc.) | seção 9 R1 | V2 |
| INV-193 | Traduções adicionais (fr/it/de...) | seção 9 R2 | V2 |
| INV-194 | futurePhaseReservePolicies em uso | DEC-016 | V2 |
| INV-195 | devices table com gestão de dispositivos | DEC-103 | V2 |
| INV-196..202 | Demais itens V2 do roadmap (7 itens listados em implementation-phases §V2) | V2 | V2 |

*(INV-196..202 contados individualmente no total de 199.)*

---

## 4. Bugs Encontrados (🐛 detalhados)

### [BUG-001] Gasto noturno cai no dia errado (UTC vs dia local) — P1

- **Relato**: gasto registrado depois de ~21h (UTC−3) recebe `date = new Date().toISOString()` (UTC) cuja fatia `slice(0,10)` é o **dia seguinte**. Tudo que agrega "por dia" compara essa fatia com `localDateString()` (local). Resultado: o gasto da noite de bar **não reduz o "livre para usar hoje"** e amanhece contando no dia errado. Data retroativa (`datetime-local`) sofre a mesma conversão (`new Date(customDate).toISOString()` — QuickAddPage.tsx:208).
- **Evidência (scratch, TZ=America/Sao_Paulo)**: tx criada às 23:00 locais de 10/06 → `tx.date = 2026-06-11T02:00Z`; `calculateSpentOnDate([tx], '2026-06-10') = 0`; `sumSpentInOccurrenceInterval` idem.
- **Root cause**: `src/domain/transactions/transactions.ts:198-210` (`t.date.slice(0,10) === dateIso`); criação em `transactions.ts:28,50` e `QuickAddPage.tsx:208`; superfícies extras: `occurrences.ts:82-83`, `insights.ts:138` (streak), `csv-export.ts:112-113`, `ExpenseListPage.tsx:169`, `ExpenseDetailPage.tsx:93,172`.
- **O que o brain define**: DEC-088 (livre hoje subtrativo — "registrar €2 derruba o número em exatamente €2"); GAP-R2-007 corrigiu o mesmo problema no day card e deixou o comentário "Local date, not UTC" (DashboardPage:378) — a metade das transações ficou de fora.
- **Fix acionável**: criar `localDayOf(date: string): string` no domínio de datas (converte timestamp para dia local via `format(new Date(iso), 'yyyy-MM-dd')`) e usar em `calculateSpentOnDate`, `sumSpentInOccurrenceInterval`, `buildNoSpendStreak`, CSV (Data/Hora) e exibições. Para retroativo, armazenar o instante local correto já resolve com a mesma função.
- **Severidade**: alta (atinge a métrica-herói diária e a persona principal). **Esforço**: ~2-3h + testes com TZ fixa.

### [BUG-002] Último dia da fase inteiro tratado como "sem fase ativa" — P1

- **Relato**: `findActivePhase` usa `parseISO(endDate)` = meia-noite local do último dia; `isWithinInterval` exclui o dia inteiro após 00:00. No último dia de qualquer fase: QuickAdd e WalletsPage caem no fallback `?? phases[0]` e **gravam gasto/ajuste na primeira fase da viagem**, com a lista de fundos da fase errada; SimulatorPage fica sem fase; TripOverview não marca fase corrente.
- **Evidência (scratch)**: `findActivePhase` às 14:00 do endDate → `null`; padrão QuickAdd no último dia da fase 2 → seleciona `p1`. `resolveActivePhase` mitiga o Dashboard (retorna a própria fase como "passada").
- **Root cause**: `src/domain/dates/dates.ts:5-15` (fim exclusivo na prática); consumidores: `QuickAddPage.tsx:62-63`, `WalletsPage.tsx:84`, `SimulatorPage.tsx:51`, `TripOverviewPage.tsx:66`, `demo-repair.ts:99` (dispara repair sem necessidade — inócuo fora da demo por DEC-111).
- **O que o brain define**: fases têm datas inclusivas (getTotalDays soma +1; dias efetivos do ritmo incluem o último dia — rhythm.ts trata end como inclusivo).
- **Fix acionável**: em `findActivePhase`, comparar por dia local (`localDateString(ref) <= endDate`) ou usar `end: endOfDay(parseISO(p.endDate))`. Trocar fallbacks `?? phases[0]` por `resolveActivePhase`.
- **Severidade**: alta (corrupção silenciosa de dados em dia de fronteira). **Esforço**: ~1-2h + testes de borda.

### [BUG-003] `calculateDebts` superaloca o maior credor (≥2 devedores × ≥2 credores) — P2

- **Relato**: o loop pareia cada devedor com a lista de credores ordenada pelos **saldos originais**, sem decrementar o crédito já alocado a devedores anteriores. Com C +€40 e D +€30 (A deve €50, B deve €30): C aparece recebendo €60 e D €10.
- **Evidência (scratch, asserção falhou de propósito)**: `total credited to C: 6000 (esperado 4000) | to D: 1000 (esperado 3000)`.
- **Root cause**: `src/domain/splitting/splitting.ts:151-173` (recalcula `creditors` de `balances` sem mutá-los ao alocar).
- **Superfícies**: lista "quem deve a quem" (SharedExpensesPage), `calculateParticipantBalances` (saldos por pessoa, linha 196 da página), entrada de `suggestSimplifiedSettlements`.
- **O que o brain define**: DEC-024/spec §5 — dívidas refletem saldos líquidos; nenhum credor pode "receber" mais do que seu saldo.
- **Fix acionável**: alocar mutando os saldos (mesmo algoritmo de `suggestSimplifiedSettlements`, que está correto — scratch confirmou conservação) ou derivar as dívidas exibidas diretamente dele.
- **Severidade**: média-alta (números errados na tela em grupos com 2+ pagadores). **Esforço**: ~1h + teste com o cenário acima.

### [BUG-004] Edição de valor pós-rejeição ignora devolução ao pagador — P3

- **Relato**: `ExpenseDetailPage.handleSaveEdit` rescala TODAS as shares (inclusive rejeitadas) e recalcula o custo pessoal com `calculatePersonalCost` (= share do dono). Se uma share havia sido **rejeitada**, a regra DEC-071 (valor rejeitado volta ao custo do pagador) é perdida — o orquestrador `resolveShareConfirmation` usa a função certa (`calculateOwnerPersonalCost`), a edição não.
- **Root cause**: `src/features/expenses/ExpenseDetailPage.tsx:108-110`.
- **Fix acionável**: usar `calculateOwnerPersonalCost(updatedTx, newShares, owner.id)` e não rescalar shares `rejected`.
- **Severidade**: baixa (caminho raro: editar total depois de rejeitar). **Esforço**: ~30min + teste.

---

## 5. Incompletos e Parciais (🟡 detalhados)

### [PAR-001] Datas sempre formatadas em pt-BR
- **Onde**: `src/domain/dates/dates.ts:53-59` (`locale: ptBR` fixo) + padrões `"d 'de' MMMM"` espalhados.
- **Evidência runtime**: dashboard EN exibe "de junho".
- **Fix**: mapear `i18n.language → date-fns locale` e padrões por língua (chave i18n para o formato). ~2h.

### [PAR-002] Números sempre em locale pt-BR
- **Onde**: `src/domain/money/money.ts:11-22` (default `'pt-BR'`, 88 call sites sem locale); `DashboardPage.splitMoneyDisplay` (vírgula fixa).
- **Fix**: helper que injeta `i18n.language`; hero idem. ~2h.

### [PAR-003] Learning engine diverge da spec
- **Onde**: `src/domain/forecasting/forecasting.ts:28-39`.
- **Divergência**: (a) 1º ponto real substitui 100% da estimativa inicial (spec: "weighted average with initial estimates + real data" — o preset deveria agir como prior); (b) safe = 1,3×típico (spec: P75 com dados suficientes — também listado como 🔮 INV-189).
- **Fix mínimo (a)**: tratar o preset como N pontos virtuais (ex.: dataPointCount inicial 3) ou peso fixo do prior. ~1h + testes.

### [PAR-004] Nomes gerados pt-BR no onboarding
- **Onde**: `src/domain/onboarding/onboarding.ts:80` ("Fundo X"), `:98` ("Reserva protegida").
- **Evidência runtime**: "Fundo" visível em UI EN (/expenses, /funds, /trip).
- **Fix**: receber strings traduzidas como input do onboarding (UI passa `t(...)`). ~30min.

### [PAR-005] WalletsPage: enum cru + tipos faltantes
- **Onde**: `WalletsPage.tsx:140` (opções sem `credit_card`/`other`), `:190` (exibe `wallet.walletType` cru).
- **Fix**: chaves `wallets.type_*` + incluir tipos. ~30min.

### [PAR-006] `calculateEffectiveSpendingDays` usa `cursor.toISOString()`
- **Onde**: `rhythm.ts:48`. Correto de UTC−12 a UTC+12 (âncora ao meio-dia); **quebra o dia da semana em UTC+13/14** (Samoa/Kiribati). Persona atual não é afetada.
- **Fix**: formatar o cursor com data local. ~15min.

### [PAR-007] Demo data/presets com nomes pt-BR em qualquer língua
- **Onde**: `profiles.ts` presets, `demo-data.ts`. Documentado como "data values" — aceitável, mas em EN/ES a demo inteira fica pt. Decidir: manter (registrar DEC) ou localizar geração. 
- *(Itens PAR-001..007 + INV-040/061 = os 9 parciais do resumo.)*

### 🔴 Ausentes
Nenhum item prometido para deliveries declaradas como concluídas está ausente.

---

## 6. Órfãos (⚠️ — código sem brain)

| # | O que existe | Situação | Proposta |
|---|---|---|---|
| ORF-01 | Tabela `alertRules` + tipo `AlertRule` (schema v1) | Sem leitura/escrita fora de backup | Já listado como adiado na seção 9 do R1 — **documentar no schema doc como "reservado V2"** |
| ORF-02 | Tabela `futurePhaseReservePolicies` | Idem (DEC-016 nunca ativado) | Documentar como reservado (INV-194) |
| ORF-03 | Tabela `devices` | Gravada em sync, sem UI de gestão | Documentar escopo V2 (INV-195) |
| ORF-04 | `@capacitor/core` + `capacitor.config.ts` no bundle de deps | D6 não iniciada | OK manter (DEC-017), registrar que está pré-instalado |

Nenhum órfão de FEATURE (tela/fluxo sem spec) foi encontrado — o código segue o brain.

---

## 7. ROADMAP FUTURO (🔮 consolidado — 31 itens)

### Bloco V2-Sync (depende de: nada — base R4 pronta)
1. Sync contínuo em background (DEC-108) — esforço M
2. UI de resolução de conflitos (DEC-108) — M
3. Multi-peer >2 dispositivos (DEC-108) — G
4. Gestão de dispositivos (devices table → UI) — P

### Bloco D6-Nativo (depende de: estabilidade PWA — pronto)
5. Capacitor Android + APK (DEC-017) — M
6. Notificações locais agendadas em saídas — M
7. Widget Android — G (pós-D6)

### Bloco D3+-Inteligência (depende de: dados reais acumulados)
8. P75 no learning (spec §4) — P
9. Prior da estimativa inicial (junto com PAR-003) — P
10. Frequência de mercado prevista — M
11. Risco combinado completo no simulador (DEC-050) — M
12. Future floor automático 3 níveis (DEC-016) + futurePhaseReservePolicies — M
13. Sparkline de forecastSnapshots (dados JÁ acumulando desde R2) — P

### Bloco V2-Produto
14. Multi-moeda com câmbio (DEC-021) — G
15. Relatórios/padrões de gasto — G
16. AlertRules UI — M
17. PlannedOccurrence avançado (recorrência) — M
18. Import Wise CSV/PDF — M
19. Receipt scanning — G
20. Trip templates/presets — P
21. Traduções extras (fr/it/de) — P
22-24. Login/contas, sync remoto (Supabase/D1), grupos multi-usuário (DEC-018) — G/G/G
25. Push remoto — M
26-31. Demais itens V2 do implementation-phases (§V2 Roadmap) — diversos

**Ordem recomendada**: 13 → 8/9 (baratos, dados prontos) → bloco D6 (5-6) → bloco Sync (1-2) → produto V2.

---

## 8. Verificação por DEC (1..113)

Legenda de evidência igual à seção 3. Status: ✅ ok · 🟡 parcial · 🐛 bug relacionado · 🔮 futuro.

| DEC | Título resumido | Status | Evidência |
|---|---|---|---|
| 001 | Project Structure | ✅ | repo TripPilot/ conforme |
| 002 | PWA First | ✅ | D5 completa (E pwa) |
| 003 | Tech Stack | ✅ | package.json conforme (sem Zustand — DEC-068) |
| 004 | Local-First (Dexie) | ✅ | schema v4, 24 entidades (schema.ts) |
| 005 | Cloudflare Pages | ✅ | deploy v0.5.1 (project-status) |
| 006 | Occasion-Based Forecasting | 🟡 | forecasts ✅ (U); learning prior/P75 divergem (PAR-003) |
| 007 | BudgetPool Across Phases | ✅ | links + U |
| 008 | Entity Hierarchy | ✅ | types/ conforme schema doc |
| 009 | Outing Mode core | ✅ | E outing-flow |
| 010 | Three-Limit System | ✅ | U outing (ordem alvo<teto<máx) |
| 011 | Personal Shopping Isolation | ✅ | scope global + card próprio |
| 012 | Amigo Sincero tone | ✅ | alertTone + chaves i18n |
| 013 | Device Transfer JSON/CSV | ✅ | backup + CSV (U/E) |
| 014 | No Personal Data in Build | ✅ | demo fictícia |
| 015 | Scenario Planner manual | ✅ | E planner |
| 016 | Future Reserve auto+manual | 🟡/🔮 | manual ✅ (U); auto adiado (DEC-069) |
| 017 | Capacitor later | 🔮 | deps presentes, D6 não iniciada |
| 018 | Future Multi-User | 🔮 | campos future-ready presentes (linkedActorId etc.) |
| 019 | Shared Provisional Impact | ✅ | calculateOwnerPersonalCost + U |
| 020 | Money in Cents | ✅ | U money |
| 021 | EUR-Only V1 | ✅ | baseCurrency única |
| 022 | Mediterranean Cockpit | ✅ | tokens globals.css |
| 023 | "Livre para usar" hero | ✅ | E + S decomposição |
| 024 | Outing full screen | ✅ | rota /outings dedicada |
| 025 | UI Language pt | ✅ | superado por DEC-065 (3 línguas) |
| 026 | Outing dense layout | ✅ | OutingPage + histórico |
| 027 | FAB 6 opções | ✅ | E navigation |
| 028 | Planner chips visuais | ✅ | PlannerPage badges |
| 029/033 | Contrast tiers (70/44) | ✅ | tokens finais DEC-033 |
| 030 | Dashboard priority order | ✅ | §7 posições no código |
| 031/035 | Amigo Sincero acionável/direto | ✅ | superado por DEC-093 (v2) |
| 032 | Gauge marker + zona | ✅ | superado por DEC-113 |
| 034 | FAB overlay real | ✅ | FAB.tsx overlay |
| 036 | Onboarding mínimo | ✅ | E onboarding |
| 037 | Profiles presets editáveis | ✅ | createDefaultActivityProfiles + ProfilesPage |
| 038 | Demo completa | ✅ | U demo-repair + E |
| 039 | Fase sem pool | ✅ | empty state QuickAdd |
| 040 | Multi pools por fase | ✅ | seleção manual + auto com 1 |
| 041 | Shopping = pool global | ✅ | GAP-017 por scope |
| 042 | Envelope simplificado | ✅ | kinds protected_reserve/allocation |
| 043 | AllocationItem vs Occurrence | ✅ | tipos/fluxos separados |
| 044 | Profile costs typical+safe | ✅ | deriveSessionLimits + U |
| 045/062 | Quick-add €3-15 + destaque | ✅ | U outing |
| 046 | Registrar total = ajuste | ✅ | U + 2 fluxos OutingPage |
| 047 | Shared no outing (parte pessoal) | ✅ | U calculateSessionTotal |
| 048 | Alertas visual + vibração opcional | ✅ | thresholds U + vibration setting |
| 049 | End outing review única | ✅ | U end-outing-session |
| 050 | Simulator multi-acesso + risco combinado | 🟡/🔮 | acessos ✅; risco combinado parcial via DEC-094, completo adiado |
| 051 | Wallet opcional + não informada | ✅ | U + chip |
| 052 | Cash reconciliation | ✅ | U wallet-orchestrators |
| 053 | Never block registration | ✅ | confirmação zero-budget + sem trava |
| 054 | Router v7 + i18next + testes D1 | ✅ | stack confirmada |
| 055 | D1 dashboard real-data only | ✅ | cards condicionais a engines |
| 056 | Participant minimal | ✅ | name/nickname + future fields |
| 057 | Settings V1 scope | ✅ | SettingsPage completa |
| 058 | CSV fields | ✅ | U csv-export (headers pt por definição) |
| 059 | Mais seccionado | ✅ | MorePage |
| 060 | Trip overview nav | ✅ | header → /trip |
| 061 | Backup reminder 7d | ✅ | default 7 + U |
| 063 | Pending shared criterion | ✅ | superado por DEC-071 |
| 064 | About sem reports | ✅ | AboutPage |
| 065 | en/es completos | 🟡 | chaves 100% (R); datas/números pt (PAR-001/002) |
| 066 | liveQuery p/ settings | ✅ | useLiveSettings |
| 067 | Orchestrator layer parcial | ✅ | orchestrators/ (8 módulos) |
| 068 | Remove unused deps | ✅ | sem zustand/react-hook-form |
| 069 | Future floor manual V1 | ✅ | manual only confirmado |
| 070 | lastBackupDate banner | ✅ | BackupPage + Dashboard |
| 071 | Confirmação explícita shares | ✅/🐛 | fluxo ✅ (U/E); edição pós-rejeição BUG-004 |
| 072 | Planned events | ✅ | U + E events |
| 073 | One-off sem perfil | ✅ | U event-orchestrators |
| 074 | Profiles per phase | ✅ | U profiles |
| 075 | Rhythm + peak days | ✅ | U rhythm + S H5 |
| 076 | Carousel by usage | ✅ | U forecasting |
| 077 | Insights V1 | ✅ | U insights + snapshots gravados |
| 078 | Post-add categorization | ✅ | enrichment + U |
| 079 | Outing history | ✅ | aba + duração U |
| 080 | Edit-delete policy | ✅ | U crud-orchestrators |
| 081 | Global mobile feel | ✅ | btn-press + tap targets |
| 082 | Visible updates | ✅ | SW + toast (leitura completa sw.js/pwa.ts) |
| 083 | Light theme completo | ✅ | E theme + tokens |
| 084 | Fixed headers | ✅ | page-sticky-header |
| 085 | Compact margins | ✅ | tokens |
| 086 | Invisible scrollbars | ✅ | .no-scrollbar |
| 087 | No pull-to-refresh | ✅ | globals.css:51 |
| 088 | Subtractive free today | ✅/🐛 | motor ✅ (S); entrada de dados BUG-001 |
| 089 | Hero sem reserva próx. fase | ✅ | ausência verificada |
| 090 | Notifications center | ✅ | U notifications |
| 091 | Insights swipe/tap | ✅ | carrossel + detail |
| 092 | Contextual savings | ✅ | U budget |
| 093 | Honest Friend v2 | ✅ | U honest-friend |
| 094 | Multi-metric simulator | ✅ | U forecasting |
| 095 | Taxonomy per type | ✅ | 17 listas + U |
| 096 | Stepper 10s + 2 níveis | ✅ | const + U |
| 097 | Session items subcategory | ✅ | formatSessionItemLabel |
| 098 | Planner live margin | ✅ | E planner |
| 099 | Category menu planner | ✅ | PlannerPage sheet |
| 100 | Lock real effect | ✅ | persistência verificada |
| 101 | Event opens editor | ✅ | deep-link occurrence |
| 102 | Statement per participant | ✅ | U splitting |
| 103 | Sync channel (R4) | ✅ | U protocol |
| 104 | Device migration | ✅ | U migration |
| 105 | Actor identity | ✅ | U qr-and-identity |
| 106 | Owner/Mirror model | ✅ | U owner-mirror-cycle |
| 107 | Signaling worker scope | ✅ | functions/ + config |
| 108 | P2P V2 deferrals | 🔮 | corretamente não feito |
| 109 | DB failure ≠ onboarding | ✅ | useAppData + DataErrorScreen |
| 110 | iOS-safe export | ✅ | downloadFile share-first |
| 111 | Demo repair restrito | ✅ | U demo-repair |
| 112 | Planner deficit derived | ✅ | PlannerPage estado |
| 113 | Gauge piecewise | ✅ | U gauge-position |

**Resumo**: 104 ✅ · 5 🟡 (006, 016, 050, 065, 071*) · 2 🐛 relacionados (088 via BUG-001, 071 via BUG-004) · 4 🔮 (017, 018, 108, + autos do 016).

---

## 9. Verificação por Delivery (D1..D6)

| Delivery | % entregue | Pendências/divergências |
|---|---:|---|
| **D1 Foundation** | ~98% | Tudo do escopo existe e passa nos testes. Divergências: Zustand listado no escopo mas removido (DEC-068 — atualizar doc); BUG-001 afeta exibição de datas; i18n números/datas (PAR-001/002). AC "i18n strings externalized" ✅ confirmado em runtime |
| **D2 Splitting** | ~95% | ACs todos verificados (€60/3→€20: U; saque sem orçamento: S; settle sem gasto: E; import merge: U/E). Pendência: BUG-003 na distribuição de credores |
| **D3 Forecasting** | ~85% | Entregue: profiles+learning v1, planner, simulador, contadores. Adiado por decisão: P75, frequência de mercado, reserva auto 3 níveis (DEC-069), risco combinado completo. Divergência: prior do learning (PAR-003) |
| **D4 Outing** | 100% | Todos os ACs verificados (U+E); alert 90% = danger sobre teto ✅ |
| **D5 PWA** | 100% | ACs ✅ (E pwa + leitura sw). Divergência documental: "Workbox" no plano, SW custom no código (decisão DEC-082 — atualizar doc) |
| **D6 Native** | 0% | Pós-MVP, não iniciada — 🔮 conforme plano |

---

## 10. Contradições e Atualizações do Brain

1. **implementation-phases.md desatualizado**: tabela de status diz "NOT STARTED" para todas as deliveries — D1-D5 estão entregues (project-status v0.5.1). Atualizar.
2. **Contagem de DECs**: prompts/notas citam "102 decisões"; o decision-log tem **113** (R4/R5 adicionaram 103-113). Atualizar referências.
3. **database-schema.md** menciona Dexie v3/22 tabelas; código está em v4/24 (peerLinks, mirroredStatements). Atualizar.
4. **D1 scope** cita Zustand; removido por DEC-068. **D5 scope** cita Workbox; SW custom por DEC-082. Anotar nos docs.
5. **Decisões implícitas nunca registradas** (proposta de DEC ou nota): (a) headers do CSV são pt-BR fixos; (b) nomes de dados gerados (demo/onboarding/presets) são pt-BR em qualquer língua; (c) safe = 1,3×típico como aproximação do P75; (d) clamp do freeToSpend em 0 no hero.
6. **product-spec §4 "P75"** continua prometido sem delivery alvo explícita — mover formalmente para roadmap (INV-189) ou implementar em D3+.

---

## 11. Log de Exaustividade

**Baterias da Fase 3** (cenários concretos):
- B1 Matemática financeira: 8 cenários scratch (split resto, custom ≠100%, rejeição, freeToSpend decomposto, livre-hoje normal/negativo, settlements, dívidas cruzadas) → **BUG-003**; demais ✅
- B2 Datas/fronteiras: 7 cenários scratch (23h UTC−3, retroativo, occurrence, último dia, meia-noite, fallbacks, ritmo) → **BUG-001, BUG-002**
- B3 Fluxos compostos: 29 E2E (onboarding→gasto→saída→review→histórico→backup round-trip; confirmação de shares; planner; navegação) ✅
- B4 Estado/concorrência: liveQuery prometido só p/ settings ✅; recuperação de sessão ✅; soft delete filtrado ✅ (CSV avançado inclui deletados por design)
- B5 i18n runtime: 15 rotas × 3 línguas, zero chave crua; **PAR-001/002/004** (pt em datas/números/nomes gerados)
- B6 PWA: sw.js network-first/cache-first/precache lido integralmente; toast SKIP_WAITING; E pwa (manifest/ícones); pull-to-refresh off ✅

**Rounds da Fase 4**:
| Round | Lente | Achados |
|---|---|---|
| A | Órfãos/tabelas mortas | BUG-003 superfície ampliada (saldos por participante); ORF-01..04 |
| B | Notificações/settings wiring | zero |
| C | Onboarding/a11y | PAR-004 (nomes pt gerados) |
| D | Edição/erros | BUG-004 (edição pós-rejeição) |
| E | Carteiras/inputs | PAR-005 (enum cru, tipos faltantes) |
| F | Parsing numérico/rotas | zero |
| G | Router/lazy/fallbacks | zero |

**Critério atingido**: rounds F e G consecutivos com zero achados novos. ✅

**Limitações de evidência declaradas**: fluxos de UI do sync P2P (SyncTransferFlow/SyncReceivePage) verificados por testes unitários de domínio + leitura de código (sem E2E de 2 dispositivos — exige hardware duplo); telas claras/escuras verificadas por E2E de tema + tokens, sem screenshot por tela.

---

## 12. Blocos de Implementação Recomendados

### Bloco 1 — Bugs de data (P1) — ~1 dia
1. BUG-001: `localDayOf()` no domínio de datas + uso em calculateSpentOnDate, sumSpentInOccurrenceInterval, buildNoSpendStreak, CSV, ExpenseList/Detail; retroativo idem. Testes com TZ fixa (America/Sao_Paulo e UTC).
2. BUG-002: findActivePhase inclusivo no último dia + trocar fallbacks `?? phases[0]` por resolveActivePhase (QuickAdd, Wallets, Simulator). Testes de fronteira (00:00, 14:00, 23:59 do endDate).
**Gate**: suíte + novos testes de TZ verdes; gasto às 23h reduz "livre hoje"; gasto no último dia cai na fase certa.

### Bloco 2 — Dívidas corretas (P2) — ~0,5 dia
3. BUG-003: reescrever alocação pareada de calculateDebts (mutar saldos) ou derivar de suggestSimplifiedSettlements.
4. BUG-004: calculateOwnerPersonalCost na edição.
**Gate**: cenário 2 devedores × 2 credores com totais por credor = saldo líquido; teste de edição pós-rejeição.

### Bloco 3 — i18n de formatação (🟡) — ~1 dia
5. PAR-001/002: locale dinâmico p/ datas e números (+ splitMoneyDisplay).
6. PAR-004/005: nomes gerados via t(); enum de carteira traduzido + tipos completos.
**Gate**: scan runtime EN/ES sem pt residual (re-rodar o script da auditoria).

### Bloco 4 — Learning fiel à spec (🟡/🔮 barato) — ~0,5 dia
7. PAR-003a: prior da estimativa inicial; PAR-006: cursor local no ritmo.
8. (Opcional) INV-176: sparkline com snapshots já acumulados.

### Bloco 5 — Brain housekeeping — ~0,5 dia
9. Seção 10 inteira (docs desatualizados + decisões implícitas → DECs).

### Blocos 6+ — Roadmap 🔮 na ordem da seção 7.

---

*Auditoria executada em chat direto, sem agents, sem modificação de código de produção. Arquivos scratch criados para verificação foram removidos ao final.*
