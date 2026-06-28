# KICKOFF — Leva "O Home conta a verdade" (evento ao vivo + ritmo honesto + acerto só meu · parte 2)

**Você é** um(a) engenheiro(a) full-stack sênior aplicando esta leva **sozinho(a), nesta sessão, de ponta a ponta** — domínio→UI, testar junto, commitar por item, deploy por gate, brain em sync.

**Fonte de verdade:** `TripPilot/brain/documents/2026-06-27-live-event-rhythm-settle-truth-orchestrator.md`. Leia **§0–§9 uma vez**, depois execute **G0 já**, e **G1 → G7 em ordem após o lock do §16**.

**Estado da leva:** o doc está **⏳ AWAITING LOCK** (defaults já adotados por conselho inline). **G0 (baseline) pode rodar já.** Antes de codar G1→G7, confirme/flipe os locks do §16 (4 originais + 1 fork de escopo no G6; default = recomendação do conselho). **Parte 2** — a parte 1 ("Eventos que reservam de verdade", DEC-385→389) já shippou `1.7.5-rc`; **não re-rode**. Esta leva **consome** aquele trabalho (reserva consumível, acerto ego) e faz o **Home mostrar a verdade** + dois itens de entrada/edição de gasto (IA completável, mapa fixo).

## A descoberta-chave (keystone — causa REAL, verificada lendo o código, confiança ALTA)
A parte 1 consertou o **dinheiro** (reserva do evento consumível), mas escolhas de **exibição** deixaram o Home incoerente: (1) `domain/planning/occurrences.ts › isOccurrenceActiveToday`/`isEventVisibleOnHome` excluem `linkedSessionId !== null` → ao abrir a saída, **o evento some** do Home (sobra o card da saída, que conta 0 nos gastos manuais); (2) a "média até o fim" é **ponderada por pico** (`rhythm.ts › avgDailyUntilEndCents`, 32 em vez de ~18), o **detalhe do dia** espalha a **reserva cheia** do evento (`allowance-map.ts › indexPlanByDay`, não o consumível/dias-restantes), e o **cofrinho** usa um **ideal flat** (`piggy-ledger.ts › linearDailyIdealCents`, "8,72"); (3) **Pessoas** usa **saldos do min-transfer** (`people-view.ts › buildPeopleView` ← `calculateParticipantBalances`) → vaza terceiros ("Bruno recebe 122"). Gaps pontuais: o **Wise import** não chama `stampExpenseLocation` (geocode); o **copiloto** (`copilot-insights.ts › summarizePeakHour`/`summarizeWeekdayPattern`) é dominado por **1 compra grande**. **Batch 2b (entrada/edição de gasto):** a **entrada por IA** (`useAssistant`/`assistant-quickadd-draft.ts`) cria gastos crus — sem fundo/evento/wallet, sem repasse por item no batch, e `expenseOpToQuickAddDraft` **nem carrega `occurrenceId`**; o **mapa do gasto** (`ExpenseLocationMap.tsx`, Leaflet com `dragging`/`touchZoom` ligados) **prende a rolagem**. **Fix:** (G1) evento ao vivo visível com progresso; (G2) detalhe/livre honestos + evento consumível no detalhe; (G3) cofrinho ciente do ritmo; (G4) Pessoas net fiel par-a-par; (G5) Wise geocode + copiloto honesto; (G6) IA completável (campos essenciais + repasse por item carregando o evento); (G7) mapa inline fixo → toque expande.

## Contrato de autonomia (9 regras, condensado)
1. **Sem subagent / sem Task tool / tudo inline** nesta sessão (custo é por request).
2. **Não peça permissão entre work units** depois do lock — fechar gate = commit→deploy→dev-log→próximo.
3. **Não narre o que vai fazer — faça.** Minimize prosa.
4. **Reuse o que existe** (DEC-385 `event-budget.ts`; `rhythm.ts`/`allowance-map.ts`; `piggy-ledger`; DEC-389 `stampExpenseLocation`; DEC-388 `summarizeOwnerDebts`/`thirdPartyDebts`; DEC-357 `buildPeopleView`; `useAssistant` `patchDraft`/`openFullEditor`/`expenseOpToQuickAddDraft`; `ExpenseLocationMap`) — não reinvente.
5. **Código em inglês; UI via `t()`** (pt/en/es); doc/brain em português.
6. **Domínio antes de UI**, uma mudança por vez, **teste junto**.
7. **Terminal WSL:** sempre `git --no-pager`; commit via `G=/usr/bin/git; "$G" commit -m "…"`; nunca pager/editor/`-i`.
8. **Brain em sync:** dev-log todo milestone; decision-log nas DECs; product-spec/budget-model/project-status nos momentos certos.
9. **Hand-off final termina com `AskQuestion`** — só num stop genuíno (DoD toda TRUE, ou contexto acabando), nunca no meio.

## Decisões já adotadas (defaults; só pare se Julio flipar)
- **DEC-390** evento ao vivo visível com progresso, mesmo com saída ativa (G1 · L-LIVE) · **DEC-391** allowance do evento no detalhe do dia = consumível/dias-restantes (G2, direto) · **DEC-392** livre do dia honesto: base+pico+evento + média de verdade (G2 · L-AVERAGE) · **DEC-393** cofrinho ciente do ritmo (G3 · L-PIGGY, muda Model B) · **DEC-394** Pessoas net fiel par-a-par owner↔pessoa + terceiros colapsados (G4 · L-PEOPLE) · **DEC-395** Wise forward-geocode pela descrição (G5, direto) · **DEC-396** copiloto guarda contra 1 compra dominante (G5, direto) · **DEC-397** entrada por IA completável: campos essenciais no sheet + repasse por item ao editor completo carregando `occurrenceId` + paridade nos demais pontos de IA (G6 · L-AI-ENRICH, fork = escopo) · **DEC-398** mapa do gasto inline fixo → toque expande pra interativo (G7, direto).

## ÂNCORA (cole a cada 3 milestones / em cada fronteira de gate)
```
ÂNCORA — O Home conta a verdade (evento ao vivo + ritmo honesto + acerto só meu)
- A aritmética do livre/Trecho/Pote e do ACERTO (saldos/totais/net-do-owner) é INVARIANTE vs baseline.
- Evento que está ACONTECENDO continua visível com progresso real, mesmo com saída ativa; nunca some (Â-LIVE-EVENT).
- "Livre do dia" é HONESTO: base do dia comum + delta de pico + evento explícitos; "média" é média de verdade (Â-HONEST-DAY).
- O cofrinho mede contra a allowance REAL do dia (ritmo/eventos), não um flat [sob lock L-PIGGY] (Â-PIGGY-RHYTHM).
- "Pessoas" mostra só o que é MEU (owner↔pessoa, net fiel); terceiros vão pro registro colapsado, sem sumir (Â-EGO-PEOPLE).
- Wise resolve o local pela descrição (best-effort); copiloto não conclui de 1 compra; nunca bloquear; t(); código em inglês.
CURRENT STATE: gate=<g> · last_commit=<sha> · tests=<n passing/known-base> · risks=<...> · scope=<itens>
```

## Ordem dos gates (+ versão alvo)
- **G0** baseline (`install`/`test`/`build`/`tsc`) + DEC-390→398 como `PROPOSED`.
- **G1** evento ao vivo (visível + progresso, mesmo com saída) → `1.8.0-rc` (HEADLINE).
- **G2** livre do dia honesto (base+pico+evento, média de verdade) + evento consumível no detalhe → `1.8.1-rc`.
- **G3** cofrinho ciente do ritmo → `1.8.2-rc` (§16 L-PIGGY).
- **G4** acerto "Pessoas" ego-cêntrico (net fiel par-a-par) → `1.8.3-rc` (§16 L-PEOPLE).
- **G5** Wise geocode + copiloto honesto → `1.8.4-rc`.
- **G6** entrada por IA completável (campos essenciais + repasse por item carregando o evento + paridade) → `1.8.5-rc` (§16 L-AI-ENRICH).
- **G7** mapa do gasto fixo → toque expande → `1.8.6-rc`.

## Per-milestone (5-point) + deploy
Antes de cada commit: (1) liste AC satisfeitos; (2) cite 3 AC anteriores em risco + verifique (sempre **A1/A6 invariância de livre/Trecho/Pote/net-do-owner** + **A5 nunca bloquear gasto/import**); (3) testes sem novas falhas; (4) sinalize arquivo fora de escopo; (5) atualize dev-log. **Deploy por gate:** bump `package.json` + `src/utils/app-version.ts` + `public/version.json` + `package-lock.json` (+ release note pt/en/es em `src/utils/release-notes.ts`) → `G=/usr/bin/git; "$G" commit -m "…"` + push `master` → Pages auto-build. Verifique `/version.json`. (Esta leva **não** toca o worker.)

## G0 — comandos exatos (rode já)
```bash
cd /home/julio/projetos/trip-budget-copilot/TripPilot
npm install
npm run test 2>&1 | tail -40
npm run build 2>&1 | tail -20
npx tsc --noEmit 2>&1 | tail -20
git --no-pager log --oneline -6   # topo deve ser 1.7.5-rc (parte 1) — confirmar parte 2
```
Registre as contagens baseline no `src/dev-log.md`; DEC-390→398 como `PROPOSED`. Depois do lock do §16, **execute G1→G7, sem parar até a Definition of Done (§12) estar toda TRUE** (ou contexto acabando → feche o gate atual limpo + hand-off no dev-log).

**Confirme em UMA linha que leu o orchestrator e começou o G0 — depois continue sem esperar resposta (G1→G7 após o lock do §16).**
