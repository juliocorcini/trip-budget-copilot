# Pacote 1 — Captura + Saída v2 + Modo Simples — Log

## Current State
- Fase: GATE 0 ✅ | Gate: 1 (próximo) | Milestone: M1 | Done: 1/26 | Tests: 511 (baseline 504, +7) | Versão: 0.8.3 | Último deploy: 789fe9cb.trippilot.pages.dev | Build: ✅

## Baseline (GATE 0)
- `npm run test` → 504 passed (64 files)
- `npx tsc --noEmit` → 0 errors
- Cloudflare: account `e146e88b34b2694243b1d74cee8de743` (juliojcmedeiros@gmail.com), project `trippilot` → trippilot.pages.dev (já existe)
- Deploy precisa de `CLOUDFLARE_ACCOUNT_ID=e146e88b34b2694243b1d74cee8de743` (2 contas → senão picker interativo trava o terminal)

## Decisões tomadas durante a execução
- M0: `release-notes.ts` com helpers puros (`resolveReleaseNoteLang`, `findReleaseNote`, `getPreviousReleaseNotes`, `getReleaseNoteItems`) + seção "Novidades" no AboutPage (atual + expandível anteriores).

## Deploys
- 0.8.3 (GATE 0) → https://789fe9cb.trippilot.pages.dev (alias master.trippilot.pages.dev)

## GATE 0 — Baseline + Novidades + pipeline (0.8.3) ✅
- [x] Baseline: test 504 / tsc 0 / build ok
- [x] M0: release-notes.ts + AboutPage "Novidades" + i18n (pt/en/es) + teste (7)
- [x] Bump 0.8.2 → 0.8.3 (package.json + app-version.ts)
- [x] Deploy 0.8.3 + commit

## FASE 1 — Captura Rápida + Saída v2
### GATE 1 — Captura no QuickAdd (0.8.4)
- [ ] M1 Calculadora no campo de valor (evaluateAmountExpression)
- [ ] M2 Memória por descrição (suggestFromDescription)
- [ ] M3 Repetir / favoritos (getFrequentExpenses)
- [ ] M4 Transporte ida-e-volta (duplicar no save)
- [ ] M5 Aviso de anomalia (detectAmountAnomaly)
### GATE 2 — Saída v2 (0.8.5)
- [ ] M6 Botões "últimos valores usados" (updateQuickValuesFromItem)
- [ ] M7 Repetir último item
- [ ] M8 Rodada (N × preço médio)
- [ ] M9 Rotação "quem paga" (suggestNextPayer)
- [ ] M10 Projeção temporal (projectTimeToCeiling)
### GATE 3 — Extras + i18n + testes → FASE 1 COMPLETA (0.9.0)
- [ ] M11 (Opcional) voz (parseVoiceExpense)
- [ ] M12 Simulador "pegar de amanhã"
- [ ] M13 i18n Gates 1-3
- [ ] M14 Testes Fase 1 (≥18 novos)

## FASE 2 — Modo Simples + Início Inteligente
### GATE 4 — Fundação do modo (0.9.1)
- [ ] M15 appMode em AppSettings
- [ ] M16 Onboarding 1-pergunta + escolha simples/completo
- [ ] M17 Defaults inteligentes por preset
### GATE 5 — UI do modo (0.9.2)
- [ ] M18 Dashboard simples
- [ ] M19 Nav mode-aware
- [ ] M20 Guardas de rota
- [ ] M21 Toggle "mudar de modo" em Settings
### GATE 6 — Adaptativo + polish + i18n + testes → FASE 2 COMPLETA (0.10.0)
- [ ] M22 Revelação adaptativa
- [ ] M23 Empty states/microcopy
- [ ] M24 i18n Fase 2
- [ ] M25 Testes Fase 2 (≥12 novos)

## GATE 7 — Testes finais + brain + deploy final (0.10.1)
- [ ] Testes todos verdes + contagem
- [ ] Smoke golden path
- [ ] Brain (DECs)
- [ ] Deploy final 0.10.1
