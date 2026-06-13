# Pacote 2 — Insights v2 + Ciclo de Fase + Motivação + Continuidade — Log

## Current State
- Fase: 3 | Gate: 1 ✅ | Milestone: M3 done | Done: 4/26 | Tests: 623 (+9) | Versão: 0.10.2 | Último deploy: master.trippilot.pages.dev | Build: ✅

## Decisões tomadas durante a execução
- M1: prioridade data-driven (`INSIGHT_PRIORITY`) — projection 80 > rhythm 60 > balance 50 > next 40 > avg 30 > streak 20. Ordena priority desc, desempate por tone (warning primeiro). Teto fixo de 4 removido; substituído por `INSIGHT_SAFETY_CAP=12` só p/ não explodir o carrossel. `MAX_INSIGHTS_PER_DAY` renomeado → `INSIGHT_SAFETY_CAP`.
- M2: auto-rotação a cada 7s (`INSIGHT_AUTO_ROTATE_MS`), pausa 12s após interação (`INSIGHT_RESUME_DELAY_MS`). Pausa em onPointerDown/onWheel/dot-click (NÃO em onScroll, p/ self-scroll não se auto-pausar). Respeita prefers-reduced-motion. Helpers puros `nextInsightIndex`/`shouldAutoRotateInsights` testados.
- M3: Modo Simples (SimpleHome) mostra no máximo 1 insight — o de maior prioridade E só se tone==='warning'. Nunca carrossel. O completo recebe tudo.

## Deploys
- 0.10.2 (GATE 1) → https://master.trippilot.pages.dev (https://6c0f7900.trippilot.pages.dev)

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

### GATE 2 — Builders calibrados + check-in → 0.10.3
- [ ] M4 Ritmo por categoria (builder puro, ≥3 dias + desproporcional)
- [ ] M5 Dia perigoso (gatilho calibrado, anti-spam)
- [ ] M6 Fim do dia (só sem registro + ≥18h)
- [ ] M7 Check-in card (intent do dia em AppSettings, sem migração)
- [ ] M8 Check-in por notificação (best-effort; cortável a "abrir app")
- [ ] Checkpoint: version/deploy/novidades 0.10.3 + commit

### GATE 3 — Ciclo de fase + i18n + testes → FASE 3 COMPLETA → 0.11.0
- [ ] M9 Sobra de fase (BottomSheet de decisão)
- [ ] M10 Mover sobra entre pools (orquestrador atômico, preserva total)
- [ ] M11 Contagem regressiva entre fases
- [ ] M12 i18n Fase 3 (pt/en/es)
- [ ] M13 Testes Fase 3 (≥18 novos)
- [ ] Checkpoint: version/deploy/novidades 0.11.0 + commit

>>> TRANSIÇÃO FASE 3 → FASE 4 (continue) <<<

## FASE 4 — MOTIVAÇÃO + CONTINUIDADE

### GATE 4 — Meta + cofrinho → 0.11.1
- [ ] M14 Meta de economia + card de progresso
- [ ] M15 Cofrinho (leitura derivada, não altera livre)
- [ ] M16 UI da meta (Settings/Trip)
- [ ] M17 Testes E6
- [ ] Checkpoint: version/deploy/novidades 0.11.1 + commit

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
