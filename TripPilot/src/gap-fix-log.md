# Gap Fix Log — TripPilot

## Current State
- **Gate ativo**: 2
- **Gap ativo**: GAP-015 (após M2.0 — primitivos já criados no Gate 1)
- **Gaps resolvidos**: 4/36
- **Testes**: 114 passing (baseline 105 + 9 novos)
- **Build/Typecheck**: clean
- **Commit Gate 1**: b8259f8
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
- [ ] GAP-015 — configuração de limites no início da sessão
- [ ] GAP-005 — alertas progressivos + vibração
- [ ] GAP-012 — split dentro da sessão
- [ ] GAP-002 — revisão de encerramento
- [ ] GAP-007 — motor de aprendizado ligado
- [ ] Orquestrador endOutingSession + teste

### Gate 3 — Dados seguros
- [ ] GAP-003 — backup com 21 tabelas + versionamento
- [ ] GAP-004 — merge por revision
- [ ] GAP-029 — Zod no import
- [ ] GAP-021 — CSV 17 campos + avançado
- [ ] Teste round-trip

### Gate 4 — Orçamento completo
- [ ] GAP-018 — pools filtrados por fase
- [ ] GAP-017 — personal shopping por scope
- [ ] GAP-008 — future floor manual
- [ ] GAP-009 — gestão de envelopes
- [ ] GAP-019 — edge cases DEC-053 (a)(b)(c)

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
