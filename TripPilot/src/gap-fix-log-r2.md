# Gap Fix Log R2 — TripPilot

## Current State
- **Gate ativo**: 3 | **Item ativo**: migração Dexie v3
- **Itens resolvidos**: 10/23 (+FIELD-13, FIELD-14, GAP-R2-004, 005, 006, 007)
- **Testes**: 157 unit (baseline 156) + 22 e2e (baseline 22)
- **Build/Typecheck**: clean
- **Migração Dexie v3**: pendente (Gate 3)
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
- [ ] confirmationStatus + phaseProfileSettings + Phase.rhythm + PlannedOccurrence estendida + índices
- [ ] Types + factories + Zod + backup v3 + testes de migração

### Gate 4 — Shares confirmáveis + CRUD
- [ ] DEC-071 / FIELD-03 — confirmação de shares
- [ ] DEC-080 / FIELD-11 — editar/apagar fundos e fases

### Gate 5 — Fase rica
- [ ] DEC-074 / FIELD-01 — atividades por fase + catálogo 17 presets
- [ ] DEC-075 / FIELD-02 — ritmo + dias de pico

### Gate 6 — Eventos planejados
- [ ] DEC-072 + DEC-073 / FIELD-05 — occurrences UI, reservas, card do dia, one-off

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
