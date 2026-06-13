# Pacote 2 — Insights v2 + Ciclo de Fase + Motivação + Continuidade — Log

## Current State
- Fase: 4 🚧 | Gate: 4 ✅ | Milestone: M17 done | Done: 17/26 | Tests: 677 (+63 desde baseline) | Versão: 0.11.1 | Último deploy: master.trippilot.pages.dev (5bc46a45) | Build: ✅
- PRÓXIMO: GATE 5 / M18 (ajuste contínuo de perfis) — Fase 4. Continuar sem parar.

## Decisões tomadas durante a execução
- M1: prioridade data-driven (`INSIGHT_PRIORITY`) — projection 80 > rhythm 60 > balance 50 > next 40 > avg 30 > streak 20. Ordena priority desc, desempate por tone (warning primeiro). Teto fixo de 4 removido; substituído por `INSIGHT_SAFETY_CAP=12` só p/ não explodir o carrossel. `MAX_INSIGHTS_PER_DAY` renomeado → `INSIGHT_SAFETY_CAP`.
- M2: auto-rotação a cada 7s (`INSIGHT_AUTO_ROTATE_MS`), pausa 12s após interação (`INSIGHT_RESUME_DELAY_MS`). Pausa em onPointerDown/onWheel/dot-click (NÃO em onScroll, p/ self-scroll não se auto-pausar). Respeita prefers-reduced-motion. Helpers puros `nextInsightIndex`/`shouldAutoRotateInsights` testados.
- M3: Modo Simples (SimpleHome) mostra no máximo 1 insight — o de maior prioridade E só se tone==='warning'. Nunca carrossel. O completo recebe tudo.
- M4: ritmo/categoria — input novo `categoryRhythm[]` montado no `useDashboardModel` (perfis×forecasts: planned = totalPlanned×typicalValueCents, agrupado por categoria; spent = soma personalCost da fase). Builder dispara só com ≥3 dias E consumedFraction ≥ elapsedFraction×`CATEGORY_RHYTHM_FACTOR(1.5)`; reporta a pior categoria. Tap → /expenses?category=. Prioridade 65.
- M5: dia perigoso — agrega gasto/dia-da-semana sobre as transações PASSADAS da fase (exclui hoje → é previsão, não reação). Dispara só com `DANGER_DAY_MIN_SAMPLES(2)`+ amostras E média do dia ≥ `DANGER_DAY_FACTOR(1.8)`× média dos outros dias. Detalhe (sheet) mostra média+multiplicador. Prioridade 70. weekday localizado via Intl (helper `weekdayLabel`).
- M6: fim do dia — `nowHour` novo no input (model passa `new Date().getHours()`). Dispara só se `nowHour ≥ END_OF_DAY_HOUR(18)` E nada registrado hoje na fase E dentro da janela da fase. Tap → /quick-add. Prioridade 100 (topo).
- M7: check-in — `dailyCheckIn:{date,intent}|null` em AppSettings (não-indexado, backfill no repo + seed). Domínio puro `domain/check-in` (getActiveCheckIn/createDailyCheckIn/shouldPromptCheckIn + catálogo de intents). Card movível `daily_checkin` no registry, logo abaixo do hero. Grava via appSettingsRepository.update + reload. Modo Simples NÃO recebe o card (ÂNCORA 14).
- M8: COMPLETA (não reduzida). Notificação respondível: SW (`CHECKIN_TAG`, cache v9) grava o intent direto em `appSettings` (read-modify-write — nunca cria o registro, BUG-003) e faz broadcast `APP_DATA_CHANGED`; bridge novo `registerCheckInNotificationBridge` → `notifyAppDataChanged`. Fallback gracioso: sem suporte a Actions, o toque abre /dashboard (reusa focusOrOpen). Disparo é BEST-EFFORT: `maybeShowCheckInPrompt` no boot, janela da manhã (5–13h), 1×/dia (safeLocalStorage), permission=granted. Scheduling em background real exige push/Notification Triggers (indisponível, local-first) — registrado como limitação honesta.
- M9: detector PURO em `domain/phases/phase-cycle.ts` — `findEndedPhaseWithSuccessor` (última fase encerrada COM sucessora viva; fim de dia inclusivo, BUG-002) + `detectPhaseLeftover` (só com leftover>0 E não-handled). Sobra = free-to-spend do pool operacional avaliado com a PRÓXIMA fase como corrente (`calculateFreeToSpend(..., next.id)`) — número honesto/conservador (respeita reservas/floors). Decisão de produto: a "sobra de fase" é o dinheiro livre que entra na próxima fase (não há carteira separada por fase neste modelo subtrativo de pool compartilhado). Sheet auto-abre só no Modo COMPLETO (ÂNCORA 14); fechar = carry_next (marca handled → não repete). Campo não-indexado `phaseLeftoverHandled:string[]` em AppSettings (backfill + seed).
- M10: orquestrador atômico `applyPhaseLeftover` (`db.transaction` em budgetPools+envelopes+appSettings). 3 destinos: carry_next (no-op, fica livre), reserve (cria envelope protected_reserve no pool operacional — totais intactos), shopping (transferência pool→pool via `computePoolTransfer` puro — preserva o total da viagem, ÂNCORA 13/15). TODOS marcam handled (idempotente via `markPhaseLeftoverHandled`). UI: 1 botão por pool global em `leftoverTargets`.
- M11: builder puro `buildPhaseCountdown` (insights.ts). Input novo `nextPhase:{name,daysUntilStart}|null` (model acha a fase futura mais próxima; daysUntilStart = getTotalDays(today,next)-1). Dispara só em 1..`COUNTDOWN_WINDOW_DAYS(5)` E free>0; €/dia = free / daysUntilStart. Tone neutral (não polui o Simples). Prioridade 55. Tap → /trip. Ícone flight_takeoff.
- M13: +24 testes no gate (phase-cycle 12, pool-transfer 3, orquestrador 4, countdown 5). Fase 3 inteira: +49 vs baseline 614.
- M14: camada de motivação PURA em `domain/budget/motivation.ts` — `projectTripEndSurplus` (extrapola o ritmo diário sobre os dias restantes; pode ser negativo), `calculateSavingsGoalProgress` (ratio 0..1, gap, onTrack vs projeção). Card movível `savings_goal` (logo abaixo do check-in) só aparece se a meta foi definida; tap → /settings. Meta = `savingsGoalCents:number|null` em AppSettings (não-indexado, backfill+seed, ÂNCORA 18). ÂNCORA 11: NUNCA é input de `calculateFreeToSpend` — só leitura.
- M15: `calculatePiggyBank` puro — subgasto acumulado = ideal-linear-até-hoje − gasto, nunca negativo, clamp da fração em 1. Card movível `piggy_bank` só aparece com cofrinho>0. Decisão de produto: ritmo LINEAR no nível-viagem (não ponderado) — número motivacional simples, read-only. Dias da viagem: `getTotalDays(trip.start,trip.end)` + `getDayNumber(trip.start)` (clamp 0..total).
- M16: seção "Meta de economia" na SettingsPage (mesmo padrão quick-add: input local + salvar + remover). Mostra meta atual; placeholder = meta atual ou 200.
- M17: +14 testes E6 (projectTripEndSurplus 5, savings-goal 4, piggy 4, invariância free-to-spend 1). A invariância é estrutural: a meta não é parâmetro de `calculateFreeToSpend`, então o "livre" é idêntico com/sem meta (ÂNCORA 11 provada). Total 677.

## Deploys
- 0.10.2 (GATE 1) → https://master.trippilot.pages.dev (https://6c0f7900.trippilot.pages.dev)
- 0.10.3 (GATE 2) → https://master.trippilot.pages.dev (https://f1abd098.trippilot.pages.dev)
- 0.11.0 (GATE 3 — FASE 3 COMPLETA) → https://master.trippilot.pages.dev (https://37431597.trippilot.pages.dev)
- 0.11.1 (GATE 4 — meta + cofrinho) → https://master.trippilot.pages.dev (https://5bc46a45.trippilot.pages.dev)

---

## GATE 0 — Baseline (sem deploy)
- [x] export PATH Node 22.22.3 confirmado
- [x] npm run test → 614 passing (74 files) — BASELINE
- [x] npx tsc --noEmit → 0 erros
- [x] npm run build → OK (maior chunk 287KB react, sem aviso > 500KB)
- [x] State file criado

## FASE 3 — INSIGHTS v2 + CHECK-IN + CICLO DE FASE

### GATE 1 — Insights liberados + ordenação + auto-rotação → 0.10.2 ✅
- [x] M1 Prioridade + remover teto (insights.ts)
- [x] M2 Auto-rotação (DashboardCards.tsx, pausa ao tocar, respeita reduced-motion)
- [x] M3 Guarda de appMode (SimpleHome — sem mural de insights)
- [x] Checkpoint: version/deploy/novidades 0.10.2 + commit

### GATE 2 — Builders calibrados + check-in → 0.10.3 ✅
- [x] M4 Ritmo por categoria (builder puro, ≥3 dias + desproporcional)
- [x] M5 Dia perigoso (gatilho calibrado, anti-spam)
- [x] M6 Fim do dia (só sem registro + ≥18h)
- [x] M7 Check-in card (intent do dia em AppSettings, sem migração)
- [x] M8 Check-in por notificação (COMPLETA: respondível + fallback abrir-app; disparo best-effort)
- [x] i18n pt/en/es de tudo do gate (no mesmo commit — ÂNCORA 16)
- [x] Testes: M4 (4), M5 (4), M6 (4), check-in helper (4) = 16 novos
- [x] Checkpoint: version/deploy/novidades 0.10.3 + commit

### GATE 3 — Ciclo de fase + i18n + testes → FASE 3 COMPLETA → 0.11.0 ✅
- [x] M9 Sobra de fase (BottomSheet de decisão; detector puro testado)
- [x] M10 Mover sobra entre pools (orquestrador atômico, preserva total)
- [x] M11 Contagem regressiva entre fases (builder na janela de transição)
- [x] M12 i18n Fase 3 (pt/en/es no mesmo commit)
- [x] M13 Testes Fase 3 (+24 no gate; +49 na fase vs baseline)
- [x] Checkpoint: version/deploy/novidades 0.11.0 + commit

>>> TRANSIÇÃO FASE 3 → FASE 4 (continue) <<<

## HANDOFF FASE 4 (de GATE 3 → GATE 4)
- Fase 3 commitada+deployada (0.11.0). Verde: 663 testes, tsc 0, build sem chunk>500KB.
- Estado: insights sem teto+ordenados+auto-rotação; builders calibrados (ritmo/categoria, dia perigoso, fim do dia); check-in card+notificação; ciclo de fase (sobra→sheet→mover atômico preserva total; countdown). Modo Simples segue mínimo.
- Invariantes a respeitar na Fase 4: ÂNCORA 11 (cofrinho/meta = LEITURA derivada, NUNCA pool real, NUNCA altera "livre hoje"/DEC-088), ÂNCORA 12 (aprendizado sugere, nunca grava sozinho; special/exclude fora; sessão=1 ocasião DEC-115), ÂNCORA 14 (Simples mínimo), ÂNCORA 15 (cents + teste math), ÂNCORA 16 (i18n no mesmo commit), ÂNCORA 18 (AppSettings/Trip campos não-indexados sem migração).
- `model.savings` (calculateLastOutingSavings) já existe — base do M15 (cofrinho).
- PRÓXIMO: GATE 4 / M14 meta de economia. Continuar sem pedir OK.

## FASE 4 — MOTIVAÇÃO + CONTINUIDADE

### GATE 4 — Meta + cofrinho → 0.11.1 ✅
- [x] M14 Meta de economia + card de progresso
- [x] M15 Cofrinho (leitura derivada, não altera livre)
- [x] M16 UI da meta (Settings/Trip)
- [x] M17 Testes E6 (+14: projeção, meta, cofrinho, invariância free-to-spend)
- [x] Checkpoint: version/deploy/novidades 0.11.1 + commit

### GATE 5 — Aprendizado in-trip → 0.11.2
- [ ] M18 Ajuste contínuo de perfis (sugerido)
- [ ] M19 Sugestão "atualizar valores" (D7 — mostra, não muda sozinho)
- [ ] M20 Testes aprendizado
- [ ] Checkpoint: version/deploy/novidades 0.11.2 + commit

### GATE 6 — Templates + i18n + testes → FASE 4 COMPLETA → 0.12.0
- [ ] M21 Lições → priors (fim da viagem)
- [ ] M22 Salvar template
- [ ] M23 Aplicar template
- [ ] M24 i18n Fase 4
- [ ] M25 Testes Fase 4 (≥12 novos)
- [ ] Checkpoint: version/deploy/novidades 0.12.0 + commit

## GATE 7 — Testes finais + brain + deploy final → 0.12.1
- [ ] Testes todos verdes (≥30 novos)
- [ ] Smoke golden path
- [ ] Brain atualizado (DECs)
- [ ] Deploy final 0.12.1
- [ ] Entrega (resumo)
