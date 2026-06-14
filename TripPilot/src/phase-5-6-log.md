# Pacote 3 — Local & Hora + Multi-moeda + Segurança & Sharing — Log

## Current State
- Fase: 5 | Gate: 1 ✅ | Milestone: M3 done | Done: 3/24 | Tests: 729 (+21) | Versão: 0.12.2 | Último deploy: PRODUÇÃO trippilot.pages.dev (0.12.2) | Build: ✅
- Dexie SCHEMA_VERSION=4 (próxima migração = v5 no M14, ÚNICA do pacote). BACKUP_VERSION=5 ✅ (bumped no M1).
- PRÓXIMO: GATE 2 / M4 (lugares próximos online + busca/nome manual).

## Decisões tomadas durante a execução
- Deploy em PRODUÇÃO (--branch=main → trippilot.pages.dev) a cada gate, a pedido do Julio (supera o "preview" do pacote).
- M1: campos de local em Transaction são NÃO indexados (placeLabel/latitude/longitude/placeId) → SEM migração Dexie no M1; só backup v5 + backfill no repo/seed.
- M1: backup v5 = normalizeBackupToV5 (encadeia v4) preenchendo os 4 campos com null; parse e emergency-snapshot migrados.
- M2/M3: boundary de geoloc isolada em utils/geolocation.ts (getCurrentCoords com timeout, retorna null em erro/negado/sem suporte). Lógica pura (haversine, shouldReaskPlace, placesEqual) em domain/location/location.ts.
- M3: local "grudento" guardado em AppSettings.currentPlace; repergunta GPS só se deslocou > 150m (DEFAULT_REASK_THRESHOLD_METERS). Toggle locationCaptureEnabled (off por padrão) em Settings.

## Deploys
- 0.12.2 (GATE 1) → PRODUÇÃO https://trippilot.pages.dev (deploy id https://544a59ad.trippilot.pages.dev)

## GATE 0 — Baseline (sem deploy)
- [x] Node 22.22.3 confirmado
- [x] npm run test → 708 passing (84 files) — BASELINE
- [x] npx tsc --noEmit → 0 erros
- [x] npm run build → OK (maior chunk vendor-react 287KB, sem aviso >500KB)
- [x] Confirmado Dexie SCHEMA_VERSION=4 + BACKUP_VERSION=4
- [x] State file criado

## FASE 5 — LOCAL & HORA + MULTI-MOEDA

### GATE 1 — Local: captura → 0.12.2 ✅
- [x] M1 Campos de local em Transaction + backup v5
- [x] M2 GPS opt-in + permissão + fallback
- [x] M3 Local "grudento" (lembra/repergunta por área)
- [x] Checkpoint: version/deploy/novidades 0.12.2 + commit (729 testes, build OK, deploy prod)

### GATE 2 — Local: contexto + exibição → 0.12.3
- [ ] M4 Lugares próximos (online) + busca/nome manual
- [ ] M5 Hora+local na lista/detalhe
- [ ] M6 Saída ativa mostra o local
- [ ] M7 "Gastos por lugar"
- [ ] Checkpoint: 0.12.3 + commit

### GATE 3 — Multi-moeda + i18n + testes → FASE 5 COMPLETA → 0.13.0
- [ ] M8 UI moeda+valor no QuickAdd
- [ ] M9 Conversão + guardar original
- [ ] M10 Débito de carteira por moeda
- [ ] M11 Snapshot de câmbio offline (opt-in)
- [ ] M12 i18n + nota de privacidade do local
- [ ] M13 Testes Fase 5 (≥18 novos)
- [ ] Checkpoint: 0.13.0 + commit

## >>> TRANSIÇÃO FASE 5 → FASE 6 (continuar sem parar) <<<

## FASE 6 — SEGURANÇA, COMPARTILHAMENTO & SHARE TARGET

### GATE 4 — Histórico de snapshots → 0.13.1
- [ ] M14 Tabela de snapshots (ÚNICA migração Dexie → v5)
- [ ] M15 Restaurar "para ontem"
- [ ] M16 Testes (poda, leitura/escrita, restore)
- [ ] Checkpoint: 0.13.1 + commit

### GATE 5 — Cofre + viewer → 0.13.2
- [ ] M17 Cofre pra nuvem via share sheet + lembrete
- [ ] M18 Visualizador HTML read-only
- [ ] M19 Testes (share fallback, geração HTML)
- [ ] Checkpoint: 0.13.2 + commit

### GATE 6 — Lock + Share Target + i18n + testes → FASE 6 COMPLETA → 0.14.0
- [ ] M20 Bloqueio PIN/biometria (off por padrão)
- [ ] M21 Web Share Target (manifest + rota)
- [ ] M22 i18n Fase 6
- [ ] M23 Testes Fase 6 (≥12 novos)
- [ ] Checkpoint: 0.14.0 + commit

## GATE 7 — Testes finais + brain + deploy final → 0.14.1
- [ ] Testes todos verdes (≥30 novos)
- [ ] Smoke golden path
- [ ] Brain atualizado (DECs)
- [ ] Deploy final 0.14.1 (produção)
- [ ] Entrega (resumo)
