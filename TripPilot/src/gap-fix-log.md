# Gap Fix Log — TripPilot

## Current State
- **Gate ativo**: 8
- **Gap ativo**: verificação final + deploy
- **Gaps resolvidos**: 36/36
- **Testes**: 156 passing (baseline 105 + 51 novos)
- **Build/Typecheck**: clean
- **Commits**: Gate 1 b8259f8 · Gate 2 d395af6 · Gate 3 fa460e1 · Gate 4 4f4e756 · Gate 5 8b9f8b9 · Gate 6 f9cc287 · Gate 7 (ver git log)
- **Nota git**: usar `bash -c 'git commit ...'` (git local não suporta --trailer)

## Por gate

### Gate 0 — Baseline
- [x] Baseline: 105 tests ✅ · typecheck ✅ · build ✅ (commit base dd5c404)
- [x] State file criado

### Gate 1 — Integridade financeira
- [x] GAP-001 — saque = createTransferTransaction banco→cash — arquivos: QuickAddPage.tsx, wallet-orchestrators.ts — teste: transactions.test.ts
- [x] GAP-010 — transferência via createTransferTransaction, origem≠destino validado, pool/categoria removidos — QuickAddPage.tsx
- [x] GAP-011 — reconciliação cria ajuste via reconcileWallet (sheet com diff, categoria p/ negativo, justificativa p/ positivo) — WalletsPage.tsx
- [x] GAP-006 — "Registrar total atual" cria ajuste pela DIFERENÇA via calculateReportedTotalDiff; negativo exige confirmação — OutingPage.tsx
- [x] Testes novos: transactions.test.ts (9 testes: expense, transfer/withdrawal, adjustment ±, total diff)
- [x] Extra do gate: orquestradores wallet+expense criados (D-H); registerExpense atômico via db.transaction

### Gate 2 — Outing Mode
- [x] M2.0 — primitivos BottomSheet + Toast (antecipados no Gate 1, ToastHost no main.tsx)
- [x] GAP-015 — SessionStartConfigForm (nome, 3 limites, avg drink, quick values editáveis) + deriveSessionLimits fallback €5 — OutingPage.tsx, outing.ts
- [x] GAP-005 — getProgressiveAlerts ligado ao quick-add; toast por tom (amigo_sincero/calmo/direto); navigator.vibrate; firedAlertPercents na Session (1x por marco) — OutingPage.tsx, session.ts
- [x] GAP-012 — split na sessão via BottomSheet; buildSharesWithPayer extraído p/ domain/splitting (reusado no QuickAdd); calculateSessionTotal usa personalCostCents — OutingPage.tsx, splitting.ts, outing.ts
- [x] GAP-002 — SessionReview: total, itens editáveis, carteira em lote, diferença de caixa opcional, típica/especial + excludeFromLearning, CTA confirmar — OutingPage.tsx
- [x] GAP-007 — updateProfileFromTransaction chamado no endOutingSession (itens não-excluídos, personalCost p/ shared); especial NÃO atualiza — outing-orchestrators.ts
- [x] Orquestrador endOutingSession (db.transaction atômico) + 3 testes; registerExpense + 1 teste; deriveSessionLimits + 3 testes

### Gate 3 — Dados seguros
- [x] GAP-003 — BackupData com 21 tabelas; BACKUP_VERSION=2; buildFullBackup exporta inclusive soft-deleted; v1 importa com tabelas ausentes = [] — backup.ts, backup-orchestrators.ts
- [x] GAP-004 — importBackup merge por revision/updatedAt via mergeBackupData; .catch(()=>{}) eliminado; tudo numa db.transaction — backup-orchestrators.ts, BackupPage.tsx
- [x] GAP-029 — backupFileSchema (Zod) valida antes de gravar; erro claro via Toast; zero gravação parcial — schemas.ts, backup.ts
- [x] GAP-021 — CSV 19 colunas base (+Hora, Viagem, Caixa/Sessão, Quem pagou, Custo pessoal, Valor compartilhado, Observações, Moeda, Valor base) + modo avançado (+ID, Status, Criado/Atualizado, Dispositivo) — csv-export.ts, BackupPage.tsx
- [x] Testes: round-trip por tabela, merge revision (3), zod reject/normalize (2), csv (3) — 10 novos

### Gate 4 — Orçamento completo
- [x] GAP-018 — getAvailablePoolsForPhase (DEC-039/040): pools por link de fase + globais (ícone "public"); auto-select só com 1 operacional; empty-state com CTA "Criar fundo" → /funds — budget.ts, QuickAddPage.tsx
- [x] GAP-017 — global pools por `scope === 'global'` (não mais por nome); múltiplos globais listados como cards — DashboardPage.tsx
- [x] GAP-008 — future floor manual (D-I): campo "Reservar para esta fase" na criação de fundo + edição por link no painel expandido do fundo; linha informativa no Planner; dashboard já reflete via calculateFutureFloor — FundsPage.tsx, PlannerPage.tsx, budget.ts
- [x] GAP-009 — envelopes (DEC-042): painel expandido por fundo com edição da reserva protegida, CRUD de envelopes allocation (criar/editar valor/soft delete) via createEnvelope — FundsPage.tsx, budget.ts
- [x] GAP-019 — edge cases DEC-053 confirmatórios: (a) sheet "orçamento zerado" no QuickAdd quando freeToSpend ≤ 0; (b) sheet over-max na sessão com memória de 15 min (overMaxConfirmedAt); (c) sheet manter/mover/dividir ao registrar com sessão cruzando fase — QuickAddPage.tsx, OutingPage.tsx
- [x] Testes: getAvailablePoolsForPhase (4), futureFloor no link (2), createEnvelope (1) — 7 novos (futureFloor no freeToSpend já coberto)

### Gate 5 — UX e estado vivo
- [x] GAP-013 — useLiveSettings (dexie liveQuery, D-F): AppShell aplica tema E idioma ao vivo, sem refresh — useLiveSettings.ts, AppShell.tsx
- [x] GAP-014 — i18n.changeLanguage(settings.language) no boot (main.tsx) + live no AppShell — main.tsx, AppShell.tsx
- [x] GAP-016 — findPendingSharedTransactions (D-C): pendente = share de terceiro com dívida não coberta por settlement; card some quando vazio; tap → /shared — splitting.ts, DashboardPage.tsx + 4 testes
- [x] GAP-020 — calculateOccasionForecasts ligado ao ScenarioPlan ativo da fase: contadores mostram "X restantes" (primário) + "Y feitas" (secundário); fallback para contagem quando sem plano — DashboardPage.tsx
- [x] GAP-024 — header: nome da fase → /trip; sino → /shared (DEC-060) — DashboardPage.tsx
- [x] GAP-025 — window.confirm do delete substituído por BottomSheet; rg "alert(|prompt(|window.confirm" src/ → 0 (só comentário) — ExpenseDetailPage.tsx

### Gate 6 — Polish de fluxo
- [x] GAP-026 — carteiras no onboarding (DEC-051): passo de carteiras com "Cartão de crédito" editável (default wallet) + cash opcional; createOnboardingEntities estendido — onboarding.ts, OnboardingPage.tsx
- [x] GAP-027 — campo datetime-local opcional (default agora) no QuickAdd; permite gasto retroativo — QuickAddPage.tsx
- [x] GAP-028 — DEFAULT_QUICK_ADD_VALUES_CENTS [300,500,700,1000,1500] no domain (D-B); fallback divergente da OutingPage eliminado; highlight via findHighlightedQuickValueIndex (mais próximo do avg drink); editáveis no start config (GAP-015) E durante a sessão via sheet — outing.ts, app-settings-repository.ts, OutingPage.tsx
- [x] GAP-022 — settings completo (D-A, D-J): moeda padrão (chips 8 moedas); reminder default 7 dias + opção 14 na lista; lastBackupDate já persistido no export (verificado); banner discreto no dashboard via isBackupReminderDue → /settings/backup; vibração confirmada funcional (OutingPage L197) — SettingsPage.tsx, app-settings-repository.ts, backup.ts, DashboardPage.tsx
- [x] GAP-023 — "Mais" com Sobre (D-D): item "Sobre" na seção Aplicativo → /about (AboutPage: versão via APP_VERSION, link backup, nota local-first); Relatórios NÃO adicionado — MorePage.tsx, AboutPage.tsx, router.tsx, app-version.ts
- [x] Testes: isBackupReminderDue (4) — 4 novos

### Gate 7 — Infra + brain
- [x] GAP-031 — Dexie v2 com índices compostos ([tripId+order], [tripId+date], [budgetPoolId+phaseId], [budgetPoolId+kind], [phaseId+budgetPoolId], [phaseId+type], [phaseId+category], [budgetPoolId+type]) + db.on('populate') seedando appSettings e device — schema.ts, database.ts, seed.ts (novo), app-settings-repository.ts
- [x] GAP-032 — settle via BottomSheet com confirmação e valor parcial (clamp no total da dívida, hint do restante); suggestSimplifiedSettlements implementado de verdade (net balance + matching guloso); card "Simplificar dívidas" quando 3+ envolvidos e redução real — splitting.ts, SharedExpensesPage.tsx + 4 testes
- [x] GAP-033 — en.json e es.json com 100% das 401 chaves do pt-BR, traduzidos (paridade verificada por script); os 3 idiomas funcionam na Settings — en.json, es.json
- [x] GAP-035 — demo ganhou: 2 gastos shared com participantShares (metade da Ana não paga), 1 sessão bar completed com 3 itens + sessionItems, 1 settlement parcial de €6 — demo-data.ts, WelcomePage.tsx
- [x] GAP-036 — toast "Pronto para uso offline" na primeira ativação do SW (DEC-053d); precache melhorado: SW parseia index.html no install e cacheia os assets hasheados do build (sem plugin) — pwa.ts, sw.js (cache v2)
- [x] GAP-030 — orquestradores em src/domain/orchestrators/ (registerExpense, endOutingSession, withdrawCash, transferBetweenWallets, reconcileWallet, buildFullBackup, importBackup) com testes; +6 testes wallet-orchestrators; refactor restante anotado como débito (DEC-067)
- [x] GAP-034 — zustand + react-hook-form removidos do package.json (0 imports); @capacitor/core mantido (DEC-017)
- [x] Brain atualizado: project-status.md reescrito (D1–D6 + gap-fix, débitos registrados); decision-log DEC-061..070 (= D-A..D-J); contradições corrigidas (domain-functions nota DEC-067, database-schema v2, v1-screen-list Reports D3+, gap-analysis com banner RESOLVIDO); version bump 0.1.0 → 0.2.0

### Gate 8 — Verificação final + deploy
- [ ] Re-auditoria 36/36
- [ ] Deploy

## Decisões aplicadas
- [x] D-A backup reminder 7 dias (DEC-061)
- [x] D-B quick-add €3/5/7/10/15 (DEC-062)
- [x] D-C pendência = share de terceiro sem settlement (DEC-063)
- [x] D-D sem Relatórios; com Sobre (DEC-064)
- [x] D-E en/es traduzidos (DEC-065)
- [x] D-F useLiveQuery para settings (DEC-066)
- [x] D-G remover deps sem uso (DEC-068)
- [x] D-H orquestradores parciais (DEC-067)
- [x] D-I future floor manual apenas (DEC-069)
- [x] D-J lastBackupDate + banner reminder (DEC-070)

## Problemas extras encontrados (NÃO corrigir — só anotar)
- (vazio)
