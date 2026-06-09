# Gap Fix Log — TripPilot

## Current State
- **Gate ativo**: 5
- **Gap ativo**: GAP-013
- **Gaps resolvidos**: 18/36
- **Testes**: 138 passing (baseline 105 + 33 novos)
- **Build/Typecheck**: clean
- **Commits**: Gate 1 b8259f8 · Gate 2 d395af6 · Gate 3 fa460e1 · Gate 4 (ver git log)
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
- [ ] GAP-013 — settings vivos (useLiveQuery)
- [ ] GAP-014 — idioma restaurado no boot
- [ ] GAP-016 — pendência real (D-C)
- [ ] GAP-020 — contadores = previsão
- [ ] GAP-024 — navegação do header
- [ ] GAP-025 — zero diálogos nativos

### Gate 6 — Polish de fluxo
- [ ] GAP-026 — carteiras no onboarding
- [ ] GAP-027 — data/hora no QuickAdd
- [ ] GAP-028 — quick-add values alinhados
- [ ] GAP-022 — settings completo
- [ ] GAP-023 — "Mais" com Sobre

### Gate 7 — Infra + brain
- [ ] GAP-031 — índices compostos + populate
- [ ] GAP-032 — settle parcial + simplificação
- [ ] GAP-033 — en/es completos
- [ ] GAP-035 — demo com shared/sessão/settlement
- [ ] GAP-036 — indicador offline
- [ ] GAP-030 — orquestradores parciais (D-H)
- [ ] GAP-034 — deps sem uso removidas
- [ ] Brain atualizado (project-status, decision-log D-A..D-J, contradições, gap-analysis status, version bump)

### Gate 8 — Verificação final + deploy
- [ ] Re-auditoria 36/36
- [ ] Deploy

## Decisões aplicadas
- [ ] D-A backup reminder 7 dias
- [ ] D-B quick-add €3/5/7/10/15
- [ ] D-C pendência = share de terceiro sem settlement
- [ ] D-D sem Relatórios; com Sobre
- [ ] D-E en/es traduzidos
- [ ] D-F useLiveQuery para settings
- [ ] D-G remover deps sem uso
- [ ] D-H orquestradores parciais
- [ ] D-I future floor manual apenas
- [ ] D-J lastBackupDate + banner reminder

## Problemas extras encontrados (NÃO corrigir — só anotar)
- (vazio)
