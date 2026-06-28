# KICKOFF — Leva "Eventos que reservam de verdade" (reserva multi-dia + atribuição de gasto + sobra + local pela IA + acerto só meu)

**Você é** um(a) engenheiro(a) full-stack sênior aplicando esta leva **sozinho(a), nesta sessão, de ponta a ponta** — domínio→UI, testar junto, commitar por item, deploy por gate, brain em sync.

**Fonte de verdade:** `TripPilot/brain/documents/2026-06-27-event-budget-truth-orchestrator.md`. Leia **§0–§9 uma vez**, depois execute **G0 já**, e **G1 → G6 em ordem após o lock do §16**.

**Estado da leva:** o doc está **⏳ AWAITING LOCK** (defaults já adotados por conselho inline). **G0 (baseline) pode rodar já.** Antes de codar G1→G6, confirme/flipe os **4 locks** do §16 (default = recomendação do conselho). Leva **NOVA** — a P2P (DEC-374→384) já shippou `1.6.4-rc`; **não re-rode**.

## A descoberta-chave (keystone — causa REAL, verificada lendo o código, confiança ALTA)
O `PlannedOccurrence` (Evento) tem `reservedCents`, mas `domain/budget/budget.ts › calculateEventReserves` só o subtrai do livre **enquanto `!isConfirmed && linkedSessionId===null`**. Quando o evento "começa" (saída → `linkedSessionId`), a reserva é **liberada inteira** de volta ao livre → o **livre/média diária pula** no dia 1 e o valor do evento é **contado 2×**. E o único jeito de "gastar do evento" é a **saída ativa** (campos limitados). **Fix:** (G1) atribuição explícita de gasto ao evento (`occurrenceId`); (G2) reserva **consumível** (`remaining = max(0, reservado − gastoAtribuído)`, não vaza no início) + allowance por-dia; (G3) Wise→evento; (G4) sobra com 3 destinos; (G5) local pelo nome da IA; (G6) acerto ego-cêntrico. **Ordem obrigatória: G1 (atribuição) antes de G2 (reserva)** — o `remaining` depende do gasto atribuído.

## Contrato de autonomia (9 regras, condensado)
1. **Sem subagent / sem Task tool / tudo inline** nesta sessão (custo é por request).
2. **Não peça permissão entre work units** depois do lock — fechar gate = commit→deploy→dev-log→próximo.
3. **Não narre o que vai fazer — faça.** Minimize prosa.
4. **Reuse o que existe** (DEC-072 evento; `rhythm.ts` allowance; `piggy-ledger`/Potes; DEC-367 location; DEC-375/376 transporte; `summarizeOwnerDebts`) — não reinvente.
5. **Código em inglês; UI via `t()`** (pt/en/es); doc/brain em português.
6. **Domínio antes de UI**, uma mudança por vez, **teste junto**.
7. **Terminal WSL:** sempre `git --no-pager`; commit via `G=/usr/bin/git; "$G" commit -m "…"`; nunca pager/editor/`-i`.
8. **Brain em sync:** dev-log todo milestone; decision-log nas DECs; product-spec/budget-model/project-status nos momentos certos.
9. **Hand-off final termina com `AskQuestion`** — só num stop genuíno (DoD toda TRUE, ou contexto acabando), nunca no meio.

## Decisões já adotadas (defaults; só pare se Julio flipar)
- **DEC-385** reserva de evento **consumível** + allowance por-dia (G2 · L-RESERVE) · **DEC-386** atribuição explícita via `occurrenceId`, evento XOR saída, manual/IA/Wise (G1+G3 · L-ATTRIBUTION) · **DEC-387** sobra → perguntar 3 destinos (livre default/cofrinho/pote), conserva 1:1 (G4 · L-LEFTOVER) · **DEC-388** acerto ego-cêntrico + menu secundário + roteamento de terceiros (G6 · L-SETTLE-SCOPE) · **DEC-389** forward-geocode do nome da IA, fallback GPS (G5, direto).

## ÂNCORA (cole a cada 3 milestones / em cada fronteira de gate)
```
ÂNCORA — Eventos que reservam de verdade
- A aritmética do ACERTO e do Trecho/Pote é INVARIANTE (saldos/totais idênticos ao baseline).
- A reserva do evento é SEGURADA e CONSUMIDA pelo gasto atribuído; o livre da fase NUNCA pula; nunca 2× (Â-EVENT-RESERVE).
- Atribuir gasto a evento é EXPLÍCITO (occurrenceId), 1 toque; evento XOR saída; manual/IA/Wise (Â-ATTRIBUTION).
- Sobra conservada 1:1 ao destino escolhido, rotulada, pendente até resolver, nunca auto-decidida (Â-LEFTOVER-CONSERVED).
- Acerto mostra só o que é MEU; dívida de terceiros sai do principal + roteada aos envolvidos, sem sumir (Â-EGO-SETTLE).
- Nunca bloquear o gasto; geocode/atribuição/entrega best-effort; hide-never-delete; t(); código em inglês.
CURRENT STATE: gate=<g> · last_commit=<sha> · tests=<n passing/known-base> · risks=<...> · scope=<itens>
```

## Ordem dos gates (+ versão alvo)
- **G0** baseline (`install`/`test`/`build`/`tsc`) + DEC-385→389 como `PROPOSED`.
- **G1** atribuição de gasto ao evento (`occurrenceId`, enabler) → `1.7.0-rc`.
- **G2** reserva consumível + livre que não pula (keystone, corrige P5) → `1.7.1-rc` (HEADLINE).
- **G3** Wise import → marcar selecionados como do evento → `1.7.2-rc`.
- **G4** sobra no fim do evento (3 destinos) → `1.7.3-rc`.
- **G5** IA acha o local pelo nome → `1.7.4-rc`.
- **G6** acerto só meu + roteamento de terceiros → `1.7.5-rc`.

## Per-milestone (5-point) + deploy
Antes de cada commit: (1) liste AC satisfeitos; (2) cite 3 AC anteriores em risco + verifique (sempre **A1/A6 invariância de saldo/Trecho/Pote** + **A5 nunca bloquear gasto**); (3) testes sem novas falhas; (4) sinalize arquivo fora de escopo; (5) atualize dev-log. **Deploy por gate:** bump `package.json` + `src/utils/app-version.ts` + `public/version.json` + `package-lock.json` (+ release note pt/en/es em `src/utils/release-notes.ts`) → `G=/usr/bin/git; "$G" commit -m "…"` + push `master` → Pages auto-build. Verifique `/version.json`. (Esta leva **não** toca o worker.)

## G0 — comandos exatos (rode já)
```bash
cd /home/julio/projetos/trip-budget-copilot/TripPilot
npm install
npm run test 2>&1 | tail -40
npm run build 2>&1 | tail -20
npx tsc --noEmit 2>&1 | tail -20
git --no-pager log --oneline -6   # topo deve ser 1.6.4-rc (leva P2P) — confirmar leva NOVA
```
Registre as contagens baseline no `src/dev-log.md`; DEC-385→389 como `PROPOSED`. Depois do lock do §16, **execute G1→G6, sem parar até a Definition of Done (§12) estar toda TRUE** (ou contexto acabando → feche o gate atual limpo + hand-off no dev-log).

**Confirme em UMA linha que leu o orchestrator e começou o G0 — depois continue sem esperar resposta (G1→G6 após o lock do §16).**
