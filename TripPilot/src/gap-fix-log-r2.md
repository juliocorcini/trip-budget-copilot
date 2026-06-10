# Gap Fix Log R2 — TripPilot

## Current State
- **Gate ativo**: 7 | **Item ativo**: DEC-078 (FIELD-08)
- **Itens resolvidos**: 16/23 (+ infra v3 pronta)
- **Testes**: 202 unit (baseline 156) + 22 e2e (baseline 22)
- **Build/Typecheck**: clean
- **Migração Dexie v3**: FEITA (Gate 3) — NUNCA criar v4/v5
- **Notas de ambiente**: Node 22 p/ wrangler/playwright (`export PATH="$HOME/.nvm/versions/node/v22.22.3/bin:$PATH"`); git via `bash -c 'git commit -F /tmp/commit-msg.txt'`

## Por gate

### Gate 0 — Baseline + decision-log
- [x] Baseline: 156 unit ✅ · typecheck ✅ · build ✅ (sobre v0.2.0, commit 55c545a)
- [x] State file criado
- [x] DEC-071..083 registradas como approved; DEC-063 SUPERSEDED; DEC-019 anotada "implemented via DEC-071"

### Gate 1 — Distribuição + tema + mobile feel
- [x] DEC-082 / GAP-R2-001 — SW network-first (navegação) + cache-first (assets); skipWaiting só via mensagem; toast persistente "Nova versão" com tap→update→reload — arquivos: `public/sw.js`, `src/utils/pwa.ts`, `src/components/Toast.tsx` (persistent+onTap), locales ×3
- [x] DEC-083 / FIELD-12b + GAP-R2-002 — 9 tokens novos em `tokens.css` (`--nav-bar`, `--scrim`, `--border-*`, `--highlight-*`, `--glow`) com variantes claras; BottomNav, FAB scrim, Toast border, DashboardPage, OutingPage ×3, PlannerPage ×5 → tokens; varredura `#0F1419|#0A0F14|#EDE8E0` fora de tokens.css = 0
- [x] DEC-083 / GAP-R2-003 — `RootLayout.tsx` novo aplica `data-theme` + idioma + `theme-color` meta dinâmica na raiz do router (TODAS as rotas); AppShell vira layout puro
- [x] DEC-081 / FIELD-10 — `user-select:none` global (inputs/textarea/contenteditable preservados), tap-highlight transparente, `touch-action: manipulation` em button/a/[role=button] (`tokens.css`)

### Gate 2 — Correções rápidas
- [x] FIELD-13 — gastos recentes do dashboard viram botões → `/expenses/:id` com `btn-press` (DashboardPage)
- [x] FIELD-14 — `OccasionCounter` com `onClick` obrigatório → `/expenses?profile=<id>` (forecast) ou `?category=` (fallback); `ExpenseListPage` lê `useSearchParams` (profile + category), filtro por `activityProfileId` + chip com nome do perfil
- [x] GAP-R2-006 — `calculateOccasionForecasts(profiles, allocations, transactions, phaseId)` filtra transações por fase; teste novo "ignores transactions from other phases" (157 unit)
- [x] GAP-R2-007 — `text-danger` → `text-error` (FundsPage.tsx)
- [x] GAP-R2-004 — `ErrorBoundary.tsx` raiz (class component, tela do design system, botão recarregar, i18n ×3) envolvendo RouterProvider em main.tsx
- [x] GAP-R2-005 — `requestPersistentStorage()` idempotente (checa `persisted()`) chamado após onboarding (OnboardingPage), 1º gasto (QuickAddPage) e quick-add de sessão (OutingPage); status manual continua em Settings

### Gate 3 — Migração Dexie v3 unificada
- [x] `SCHEMA_V3`: tabela `phaseProfileSettings` (índice `[phaseId+activityProfileId]`) + `plannedOccurrences` com `[phaseId+plannedDate]`; `version(3).upgrade()` popula: shares→`confirmationStatus:'confirmed'`, phases→`rhythmPreset/peakDays:null`, occurrences→`endDate/kind('event')/reservedCents/linkedSessionId` defaults
- [x] Types: `ShareConfirmationStatus`, `PhaseRhythmPreset`, `OccurrenceKind`, `PhaseProfileSetting` (novo arquivo); `activityProfileId` nullable em PlannedOccurrence
- [x] Factories: shares nascem `pending` + payer `confirmed` (buildSharesWithPayer, DEC-071); `createPhase` com rhythm null; `createPlannedOccurrence` + `isOccurrenceActiveToday` (planning/occurrences.ts); `createPhaseProfileSetting` + `isProfileEnabledInPhase` (profiles)
- [x] Zod: phaseSchema com rhythmPreset/peakDays defaults; phaseProfileSettings no backupFileSchema
- [x] Backup v3: `BACKUP_VERSION=3`, tabela nova nas 21+1 keys, `normalizeBackupToV3` aplicado no parse (import de v2 = defaults da migração); CSV avançado ganhou coluna "Confirmação do rateio" (+shares no contexto)
- [x] Testes: migração v2→v3 real (fake-indexeddb, TripPilotDB parametrizado por nome), índice composto da tabela nova, normalização v2→v3, round-trip v3 — 161 unit verdes

### Gate 4 — Shares confirmáveis + CRUD
- [x] DEC-071 / FIELD-03 — `calculateDebts` só considera shares `confirmed`; `findPendingConfirmationShares` (shares de terceiros pending; substitui `findPendingSharedTransactions`/DEC-063); `calculateOwnerPersonalCost` (rejected devolve ao pagador); orchestrator `resolveShareConfirmation` (share+tx atômico, ajuste de valor opcional); card do dashboard conta shares pendentes e abre sheet confirmar/rejeitar/ajustar; SharedExpensesPage lista gastos compartilhados com badge de status por share — testes: cenário exato da irmã (2×€20 cruzados → 2 pendentes, dívidas zeradas antes e depois de confirmar) + 5 de personal cost + 3 de orchestrator
- [x] DEC-080 / FIELD-11 — orchestrators `deleteBudgetPool` (bloqueia ou reatribui txs; cascata soft em links/envelopes/policies), `deletePhase` (bloqueia com dados ou última fase; cascata em links/plans/items/settings/occurrences; compacta `order`), `swapPhaseOrder`; FundsPage: editar nome/valor + sheet de exclusão com reatribuição; TripEditPage: setas reordenar + sheet de exclusão com bloqueios explicados — 7 testes de orchestrator
- i18n: 27 chaves novas ×3 (confirmação, status, CRUD de fundo/fase); chave morta `dashboard.pending_expenses` removida ×3 — paridade 431

### Gate 5 — Fase rica
- [x] DEC-074 / FIELD-01 — catálogo data-driven `profile-presets.ts` (16 presets + "+ Outro" = 17 opções; id, category, icon, valores típicos EUR, `findProfileForPreset` por categoria, `createProfileFromPreset`); repository `phaseProfileSettingRepository` (índice composto); orchestrators `createProfileEnabledInPhase` (profile+setting atômico) e `setProfileEnabledInPhase` (upsert toggle); TripEditPage: grade de chips por fase (perfis da viagem com toggle + presets restantes + "+ Outro" custom via sheet); Planner hidrata/persiste SÓ habilitados (mata contaminação FIELD-04 no Planner); contadores do dashboard e seletor de início de saída (OutingPage) respeitam habilitados; perfil custom criado em sessão nasce habilitado na fase ativa — testes: catálogo (16 únicos, cents inteiros), match por categoria, default permissivo
- [x] DEC-075 / FIELD-02 — `phases/rhythm.ts`: `isPeakDay`, `getDaySpendingWeight` (pico=1.5; normal: intense=1.2/moderate=0.8/relaxed=0.6/null=1.0), `calculateEffectiveSpendingDays`, `calculateFreeToSpendPerDay` ponderado pelos dias restantes; TripEditPage: preset de ritmo (3 botões) + seletor S T Q Q S S D (`aria-pressed`); hero do dashboard mostra "livre por dia" ponderado + microcopy de dia de pico — testes: cenário da Mira (fds [5,6] pico + semana moderada → sábado > terça), relaxed 0.6, fase encerrada = 0
- i18n: 16 nomes de preset + atividades/ritmo/pico/dashboard ×3 — paridade mantida

### Gate 6 — Eventos planejados
- [x] DEC-072 / FIELD-05 — domínio: `calculateEventReserves` (deduz `reservedCents` de occurrences não-confirmadas/não-ligadas no `calculateFreeToSpend`, 6º parâmetro `occurrences` em todos os call sites via `useAppData().occurrences`), `postponeOccurrence` (+1 dia no intervalo todo), `sumSpentInOccurrenceInterval` (gasto por sub-destino); repository `plannedOccurrenceRepository`; TripEditPage: seção "Eventos desta fase" por fase (lista + sheet criar/editar com nome/data/intervalo/estimado/reserva/tipo, apagar soft, check verde quando confirmado); Dashboard: card do dia (`plannedDate<=hoje<=endDate` sem sessão) com [Iniciar agora]→`/outings/new?occurrence=id` e [Adiar]→+1d; hero ganha linha "Reservado p/ eventos"; OutingPage: pré-config da sessão do evento (nome, teto=reservedCents, `linkedSessionId` gravado via `startSessionForOccurrence`); `endOutingSession` confirma a occurrence ligada (`isConfirmed`+`linkedTransactionId`) e a reserva para de deduzir; Planner: linha informativa "Eventos: ..." (link p/ edição) + sub-destinos com gasto-até-agora
- [x] DEC-073 / FIELD-04 — fluxo custom de sessão pergunta "É um evento único?" (BottomSheet): SIM → `startOneOffEventSession` cria PlannedOccurrence ligada SEM ActivityProfile (Session.activityProfileId agora nullable); NÃO → fluxo atual de perfil custom; `SessionStartConfigForm` generalizado (initialName/initialLimits/initialQuickAddCents) p/ perfil, evento do card e one-off — testes: ciclo Parral completo (reserva 5000 deduz → link para sessão para de deduzir → encerrar confirma occurrence) + one-off cria zero profiles + reservas no budget (6 casos) + occurrences domain (10 casos)
- i18n: 22 chaves novas ×3 (eventos na fase, card do dia, planner, one-off) — paridade 485

### Gate 7 — Outing rico + histórico
- [ ] DEC-078 / FIELD-08 — stepper pós-valor
- [ ] DEC-079 / FIELD-09 — histórico de saídas

### Gate 8 — Dashboard final
- [ ] DEC-076 / FIELD-06 — carrossel
- [ ] DEC-077 / FIELD-07 — insights
- [ ] Montagem §7 + GAP-R2-008 aria + GAP-R2-009 e2e

### Gate 9 — Brain + verificação + deploy v0.3.0
- [ ] Brain + re-verificação 23/23 + deploy

## Problemas extras encontrados (NÃO corrigir — anotar)
- (vazio)
