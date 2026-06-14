# Pacote 3 — Local & Hora + Multi-moeda + Segurança & Sharing — Log

## Current State
- Fase: 5 | Gate: 2 ✅ | Milestone: M7 done | Done: 7/24 | Tests: 748 (+19) | Versão: 0.12.3 | Último deploy: PRODUÇÃO trippilot.pages.dev (0.12.3) | Build: ✅
- Dexie SCHEMA_VERSION=4 (próxima migração = v5 no M14, ÚNICA do pacote). BACKUP_VERSION=5 ✅ (bumped no M1).
- PRÓXIMO: GATE 3 / M8 (UI moeda+valor no QuickAdd) → fecha a Fase 5 (0.13.0).

## Decisões tomadas durante a execução
- Deploy em PRODUÇÃO (--branch=main → trippilot.pages.dev) a cada gate, a pedido do Julio (supera o "preview" do pacote).
- M1: campos de local em Transaction são NÃO indexados (placeLabel/latitude/longitude/placeId) → SEM migração Dexie no M1; só backup v5 + backfill no repo/seed.
- M1: backup v5 = normalizeBackupToV5 (encadeia v4) preenchendo os 4 campos com null; parse e emergency-snapshot migrados.
- M2/M3: boundary de geoloc isolada em utils/geolocation.ts (getCurrentCoords com timeout, retorna null em erro/negado/sem suporte). Lógica pura (haversine, shouldReaskPlace, placesEqual) em domain/location/location.ts.
- M3: local "grudento" guardado em AppSettings.currentPlace; repergunta GPS só se deslocou > 150m (DEFAULT_REASK_THRESHOLD_METERS). Toggle locationCaptureEnabled (off por padrão) em Settings.
- M4 (escopo): CurrentPlace.lat/lng agora nullable (nome manual sem GPS). Lista de POIs (Overpass) NÃO feita — entregue reverse-geocode (Nominatim) opt-in/online-only via toque "Buscar nome", + recentes derivados do histórico (offline) + nome manual. Honra ÂNCORA 10 (rede só opt-in) e privacidade (coords só saem nesse toque explícito).
- M4: boundary isolada em utils/places.ts (reverseGeocodePlace) — navigator.onLine + timeout/abort + fallback null. Domínio puro deriveRecentPlaces/aggregateByPlace em domain/location.
- M5: hora via localClockTime; linha de local (ícone+label) só quando há placeLabel; detalhe ganha linha Hora + Local e edição do lugar (limpar = remove; renomear mantém coords, descarta placeId se o nome mudou).
- M6: saída ativa usa o MESMO local grudento (settings.currentPlace); captura GPS 1× ao abrir sessão ativa; cabeçalho mostra "em [lugar]" + sheet pra renomear/limpar; itens da sessão herdam o local.
- M7: filtro ?place= em ExpenseListPage com chips por lugar (ordenados por gasto via aggregateByPlace) + cabeçalho do lugar com contagem.

## Deploys
- 0.12.2 (GATE 1) → PRODUÇÃO https://trippilot.pages.dev (deploy id https://544a59ad.trippilot.pages.dev)
- 0.12.3 (GATE 2) → PRODUÇÃO https://trippilot.pages.dev (deploy id https://b11f228e.trippilot.pages.dev)

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

### GATE 2 — Local: contexto + exibição → 0.12.3 ✅
- [x] M4 Lugares próximos (online reverse-geocode opt-in) + busca/nome manual + recentes (offline)
- [x] M5 Hora+local na lista/detalhe (+ editar lugar)
- [x] M6 Saída ativa mostra o local (+ trocar no toque)
- [x] M7 "Gastos por lugar" (filtro + agregação)
- [x] Checkpoint: 0.12.3 + deploy prod + commit (748 testes, build OK)

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
