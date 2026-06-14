# Pacote 3 — Local & Hora + Multi-moeda + Segurança & Sharing — Log

## Current State
- Pacote 3 ✅ COMPLETO | Gate: 7 ✅ | Done: 24/24 | Tests: 814 (+106 vs baseline 708) | Versão: 0.14.1 | Último deploy: PRODUÇÃO trippilot.pages.dev (0.14.1) | Build: ✅ (SW cache v11)
- Dexie SCHEMA_VERSION=5 ✅ (M14 — a ÚNICA migração do pacote: tabela localSnapshots). BACKUP_VERSION=5 ✅ (bumped no M1).
- DONE: GATE 7 — suite final verde, tsc 0, build sem chunk>500KB, brain (product-spec/technical-direction/project-status/decision-log/master-plan), 0.14.1 deployado em PRODUÇÃO. Pacote 3 encerrado.

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
- M8/M9: seletor de moeda no QuickAdd (`<select>`, default = base) aparece só quando há opção estrangeira (carteira OU snapshot de câmbio). Taxa = "1 {moeda} = ? {base}" (base-por-1-estrangeira), pré-preenchida do snapshot congelado e EDITÁVEL. Conversão ao vivo "≈ base"; salvar bloqueado sem taxa válida. `convertToBaseCents/transactionBasePersonalCostCents/resolveFrozenRate/listSelectableCurrencies` puros em `domain/money/exchange.ts`. Factory aceita `baseCurrencyAmountCents?`+`exchangeRate?` (default = amount/null → 100% retrocompatível).
- DECISÃO (correção de orçamento, além do escopo literal do M10): `calculatePoolSpent` e `calculateSpentOnDate` (impacto no orçamento, ambos em base) agora passam por `transactionBasePersonalCostCents` → gasto estrangeiro entra pelo valor BASE no "livre pra usar"/"gasto do dia". É NO-OP pra moeda única (exchangeRate null) — zero regressão nos 708 testes. Agregações secundárias (insights/danger-day, outing, learning, suggestions, share-card, planning) seguem no valor cru (escopo: gasto estrangeiro é exceção; unificar depois se preciso).
- M10: `calculateWalletBalance(wallet, txs, baseCurrency)` + helper `transactionWalletAmountCents` (mesma moeda→original; carteira base→base; edge triplo→original, documentado fora de escopo). Call sites: WalletsPage ×2 (passa trip.baseCurrency) + testes atualizados.
- M11: boundary `utils/exchange-rates.ts` (open.er-api.com, sem chave) — opt-in/online-only/timeout/fallback null; inverte "estrangeira por base" → "base por estrangeira" (ratesToBase). `AppSettings.frozenRates` (não-indexado, backfill+seed). Settings ganha seção "Câmbio" (atualizar taxas + data/contagem). Reusa `isOnline` de places.
- M12: i18n pt/en/es de tudo do gate (expenses.currency_*/exchange_rate_*, settings.fx_*).
- M13: +26 testes no gate — exchange.ts (convert/personal-base/resolveFrozen/listCurrencies/poolSpent multi-moeda), carteira 3 casos (base→convertido, mesma→original, edge→original), boundary fx (mock fetch: sucesso inverte, offline/erro/!ok/result≠success→null). Fase 5 total +66 vs baseline (alvo do M13 era ≥18).
- M14 (ÚNICA migração Dexie do pacote): SCHEMA_VERSION 4→5, SCHEMA_V5={...V4, localSnapshots:'id, createdAt'}; `this.version(5).stores(SCHEMA_V5)` SEM upgrade() (tabela nova → Dexie cria e preserva dados existentes — padrão confirmado). Tabela LOCAL-only: NÃO está em BACKUP_TABLE_KEYS, então buildFullBackup não a exporta e importBackup não a toca.
- M14: tipo `LocalSnapshot {id(=dia YYYY-MM-DD), createdAt(ISO), expenseCount, json}` — NÃO é SyncMetadata, repo standalone (sem BaseRepository). id=dia → put dedup natural 1×/dia. Puros em `domain/local-snapshots` (snapshotDayId, sortNewestFirst, hasSnapshotForDay, selectSnapshotsToPrune, parseSnapshotJson). Boundary `utils/local-snapshot.ts`: recordDailyLocalSnapshot (best-effort, dedup por dia, buildFullBackup→put→poda os além de N=7) + restoreLocalSnapshot (parseSnapshotJson→importBackup 'replace'→true; json inválido→false, DB intacto).
- M14: gatilho reusa o de recordExpenseForSnapshot — chamado no QuickAdd (persistExpense) E no fim da saída (OutingPage), ambos `void` best-effort e dedup por dia (custo zero em dias repetidos).
- M15: Settings ganha seção "Avançado" → lista os pontos (data via formatDate(id) + hora local + nº de gastos) → toque abre BottomSheet de confirmação (aviso "substitui e não desfaz") → restoreLocalSnapshot → reload()+toast+navega pro dashboard. Reusa o fluxo de import atômico (mesmo padrão do BackupPage).
- M16: +12 testes — puros (poda mantém N mais novos, cap custom, sort não-mutante, hasSnapshotForDay, snapshotDayId, parse inválido→null) + integração via fake-indexeddb (sem trip→nada; 1×/dia; poda 7+1→7 dropando o mais antigo; restore replace dropa drift; json ruim→false sem tocar DB).
- M17: `downloadFile` (csv-export.ts) JÁ faz share-first (navigator.share com File) + fallback download — então o "enviar backup" reusa esse boundary (DRY, sem refatorar). BackupPage: botão primário re-enquadrado como "Enviar backup" (ícone ios_share, chama handleExport que já marca lastBackupDate) + banner de lembrete reusando `isBackupReminderDue(settings, Date.now())`. Sem segundo botão redundante.
- M18: `domain/sharing/trip-report.ts` — `buildTripReport` (puro) agrega TUDO em BASE via `transactionBasePersonalCostCents` (consistente com o orçamento): total gasto/orçamento/%, por fase (ordem cronológica), por categoria e por lugar (desc), nº de saídas + total das saídas, nº de gastos. `renderTripReportHtml(report, labels)` gera HTML self-contained (CSS inline, ZERO rede/script, escapeHtml em todo texto do usuário; labels injetadas p/ i18n). BackupPage: botão "Exportar resumo (HTML)" → carrega sessions, monta labels via t(), downloadFile text/html.
- M19: +11 testes — trip-report (totais base incl. estrangeiro convertido, exclui deletado/não-gasto, categorias/lugares/fases, saídas, %; HTML é doc completo com totais certos, offline sem 'http'/script, escapa injeção) + download-file (share quando suportado, fallback download sem Web Share, fallback quando share rejeita não-abort).
- M20 (lock): `AppSettings` ganha `appLockEnabled`(off default)+`appLockPinHash`+`appLockPinSalt` (não-indexados → SEM migração Dexie; backfill no repo + seed). Boundary `utils/app-lock.ts`: PBKDF2-SHA256 (100k iter, salt 16B aleatório) via Web Crypto — PIN NUNCA em claro; `hashPin/verifyPin` (compare timing-safe em hex, nunca lança) + `isValidPin` (4–8 dígitos). `LockScreen` (features/security) só verifica o PIN, não lê/exporta dados. `AppLockGate` (app/, abaixo do AppDataProvider em RootLayout) tranca o Outlet quando lock on + não desbloqueado; allowlist NUNCA trancada: `/ /welcome /onboarding /rescue /sync` (BootGate decide recuperação no `/`; DB evicted não tem settings → lock não engata — ÂNCORA 12). Sessão que começa SEM lock fica destrancada (ativar mid-sessão não tranca na hora); cold start com lock → pede PIN. Re-lock em background NÃO implementado (evita atrito/bug; boot-only atende o "abrir pede PIN"). Settings: toggle + sheet definir/alterar PIN (coleta 2×, valida, hash, salva). Desativar/alterar não re-pede PIN (já está atrás do lock).
- M20 (corte sancionado): biometria/WebAuthn ADIADA — entregue PIN-only (o pacote permite o corte). Registrar em DEC no GATE 7.
- M20: cast `salt as BufferSource` no deriveBits (TS DOM lib tipa salt sobre ArrayBuffer puro; mesmo padrão de sync/crypto.ts).
- M21 (Share Target): `manifest.json` (estático) ganha `share_target` {method GET, action /quick-add, params title/text/url}. Parser puro `domain/sharing/share-intake.ts` `parseSharedExpense` → 1º token monetário (regex + parseLocaleNumber, aceita 1.234,56 e 1,234.56) vira valor (>0; senão null) + descrição (title→text→url). QuickAdd lê os params nos initializers de amount/description (só PRÉ-PREENCHE, nunca salva — ÂNCORA 13). SW já serve /quick-add offline (networkFirst nav → fallback index.html); bump CACHE_NAME v9→v10 pra o manifest novo (cacheFirst) chegar aos instalados via toast de update (DEC-082).
- M22: i18n pt/en/es — `settings.lock_*` (título/toggle/hint/alterar/definir/novo/confirmar/inválido/divergente/salvo/desativado) + namespace `lock` (title/subtitle/pin_placeholder/wrong_pin/unlock/recovery_hint). Mesmo commit (ÂNCORA 16).
- M23: +17 testes (alvo ≥12) — app-lock (isValidPin 4–8; hash hex 64/salt 32, PIN não aparece; verify certo/errado; salt único + reprodução com mesmo salt; malformado→false sem lançar), share-intake (decimal ponto/vírgula, milhar nos 2 formatos, 1º token de title+text, sem número→null, zero→null, URL só descrição nunca valor, vazio→''), app-lock-gate (lock off→children; lock on rota protegida→PIN screen; allowlist recuperação NUNCA trancada; settings carregando→children). Total 814 verde, tsc 0, build sem chunk>500KB.

## Deploys
- 0.12.2 (GATE 1) → PRODUÇÃO https://trippilot.pages.dev (deploy id https://544a59ad.trippilot.pages.dev)
- 0.12.3 (GATE 2) → PRODUÇÃO https://trippilot.pages.dev (deploy id https://b11f228e.trippilot.pages.dev)
- 0.13.0 (GATE 3 — FASE 5 COMPLETA) → PRODUÇÃO https://trippilot.pages.dev (deploy id https://507ef5b3.trippilot.pages.dev)
- 0.13.1 (GATE 4) → PRODUÇÃO https://trippilot.pages.dev (deploy id https://9f9f8f1e.trippilot.pages.dev)
- 0.13.2 (GATE 5) → PRODUÇÃO https://trippilot.pages.dev (deploy id https://d7a41f20.trippilot.pages.dev)
- 0.14.0 (GATE 6 — FASE 6 COMPLETA) → PRODUÇÃO https://trippilot.pages.dev (deploy id https://10466c6c.trippilot.pages.dev)
- 0.14.1 (GATE 7 — PACOTE 3 FINALIZADO: brain + testes finais + SW cache v11) → PRODUÇÃO https://trippilot.pages.dev (deploy id https://dcb3208a.trippilot.pages.dev)

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

### GATE 3 — Multi-moeda + i18n + testes → FASE 5 COMPLETA → 0.13.0 ✅
- [x] M8 UI moeda+valor no QuickAdd (seletor data-driven + taxa + conversão ao vivo)
- [x] M9 Conversão + guardar original (factory base+rate; detalhe mostra "X CZK ≈ Y EUR"; edição recalcula base)
- [x] M10 Débito de carteira por moeda (3 casos testados)
- [x] M11 Snapshot de câmbio offline (opt-in) — boundary + Settings "Câmbio"
- [x] M12 i18n pt/en/es (mesmo commit — ÂNCORA 16)
- [x] M13 Testes Fase 5 (+26 no gate; +66 na fase, ≥18 exigidos) — verde 774, tsc 0, build sem chunk>500KB
- [x] Checkpoint: 0.13.0 + deploy PRODUÇÃO + commit

## >>> TRANSIÇÃO FASE 5 → FASE 6 (continuar sem parar) <<<

## HANDOFF FASE 6 (de GATE 3 → GATE 4)
- Fase 5 commitada+deployada (0.13.0). Verde: 774 testes, tsc 0, build sem chunk>500KB.
- Estado: local opcional em cada gasto (grudento, recentes offline, reverse-geocode opt-in, gastos por lugar); multi-moeda (captura+conversão, guarda original+base+taxa, carteira debita por moeda, snapshot de câmbio congelado opt-in). Orçamento usa valor BASE (livre/gasto-do-dia corretos com moeda estrangeira).
- Invariantes a respeitar na Fase 6: ÂNCORA 8 (privacidade/opt-in: lock off por padrão, recuperação NUNCA trancada), ÂNCORA 10 (offline intacto: share/HTML/lock não dependem de rede), ÂNCORA 11 (original preservado), ÂNCORA 12 (Share Target pré-preenche, nunca salva sozinho), ÂNCORA 14 (campos não-indexados; SÓ o M14 migra Dexie → v5), ÂNCORA 15 (cents + teste), ÂNCORA 16 (i18n no mesmo commit).
- Dexie ainda em SCHEMA_VERSION=4 — o M14 é a ÚNICA migração do pacote (sobe pra v5: tabela localSnapshots). Confirmar a versão atual no schema.ts antes de subir +1.
- PRÓXIMO: GATE 4 / M14 (tabela de snapshots locais). Continuar sem pedir OK.

## FASE 6 — SEGURANÇA, COMPARTILHAMENTO & SHARE TARGET

### GATE 4 — Histórico de snapshots → 0.13.1 ✅
- [x] M14 Tabela de snapshots (ÚNICA migração Dexie → v5) + repo + gatilho diário + poda
- [x] M15 Restaurar "para ontem" (Settings › Avançado, BottomSheet de confirmação, import atômico)
- [x] M16 Testes (+12: poda, leitura/escrita, restore via import)
- [x] Checkpoint: 0.13.1 + deploy PRODUÇÃO + commit (786 testes, tsc 0, build sem chunk>500KB)

### GATE 5 — Cofre + viewer → 0.13.2 ✅
- [x] M17 Cofre pra nuvem via share sheet (Web Share + fallback download) + lembrete (isBackupReminderDue)
- [x] M18 Visualizador HTML read-only (buildTripReport + renderTripReportHtml, self-contained/offline)
- [x] M19 Testes (+11: share fallback, geração HTML, agregação base)
- [x] Checkpoint: 0.13.2 + deploy PRODUÇÃO + commit (797 testes, tsc 0, build sem chunk>500KB)

### GATE 6 — Lock + Share Target + i18n + testes → FASE 6 COMPLETA → 0.14.0 ✅
- [x] M20 Bloqueio PIN (off por padrão; PBKDF2/Web Crypto; recuperação nunca trancada) — biometria ADIADA (corte sancionado)
- [x] M21 Web Share Target (manifest share_target + parser puro + QuickAdd pré-preenche; SW cache v10)
- [x] M22 i18n Fase 6 (settings.lock_* + namespace lock; mesmo commit)
- [x] M23 Testes Fase 6 (+17 no gate, ≥12 exigidos: PIN hash, share-target parser, lock gating)
- [x] Checkpoint: 0.14.0 + deploy PRODUÇÃO + commit (814 testes, tsc 0, build sem chunk>500KB)

## GATE 7 — Testes finais + brain + deploy final → 0.14.1 ✅
- [x] Testes todos verdes — 814 (98 files), +106 vs baseline 708 (>30 exigidos)
- [x] tsc --noEmit → 0 erros | build → maior chunk vendor-react 287KB (sem aviso >500KB)
- [x] Smoke golden path: coberto pela suíte verde (domínio: location, exchange, wallets multi-moeda, local-snapshots, share-intake, app-lock, app-lock-gate) + build OK. Smoke de UI em campo fica pro Julio (Next Steps do project-status).
- [x] Brain atualizado: DEC-157..161 (decision-log), product-spec (seção Pacote 3), technical-direction (Dexie v5/backup v5/manifest share_target), project-status (métricas+deploys+tech-debt+next steps), master-plan (Fases 5 e 6 ✅)
- [x] Deploy final 0.14.1 (produção) + SW cache v11 (toast de update p/ instalados 0.14.0)
- [x] Entrega (resumo)
