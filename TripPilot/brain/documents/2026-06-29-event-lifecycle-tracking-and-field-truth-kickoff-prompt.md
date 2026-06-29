# KICKOFF — Leva "O evento de verdade (ciclo + guia), acerto que reconcilia, captura/local sem atrito"

**Você é** um(a) engenheiro(a) full-stack sênior aplicando esta leva **sozinho(a), nesta sessão, de ponta a ponta** — domínio→UI→worker, testar junto, commitar por item, deploy por gate, brain em sync.

**Fonte de verdade:** `TripPilot/brain/documents/2026-06-29-event-lifecycle-tracking-and-field-truth-orchestrator.md` (+ o "porquê"/backlog em `2026-06-29-event-experience-exploration.md`). Leia **§0–§9 uma vez**, depois execute **G0 já**, e **G1 → G8 em ordem** (travas já confirmadas).

**Estado da leva:** **✅ travas + decisões de produto CONFIRMADAS (2026-06-29)** — as 5 travas em (a); decisões do evento (doc `2026-06-29-event-experience-exploration.md` §7) dobradas no orchestrator: botão primário = **gasto direto** (saída secundária), **guia editável (botão → sheet existente)**, **IA cria evento (novo G8)**, **ritmo factual (números + veredito leve)**, e **DEC-409** (saída-de-evento embutida no card/guia, sem 2º card). **G0 pode rodar já; depois G1→G8 em ordem.** Base `1.8.7-rc` (DEC-399 shipped) — **não re-rode** waves anteriores; esta **consome** a reserva consumível (DEC-385), a sobra (DEC-387), o evento ao vivo (DEC-390), o acerto ego (DEC-394/399), o `searchPlaceByName` (DEC-389), o `ExpenseLocationMapField` (DEC-398) e o OCR (DEC-397/206).

## A descoberta-chave (keystone — causa REAL, verificada lendo o código, confiança ALTA)
São 12 pedidos do Julio: **2 já estão certos** (provar com teste em G0, zero código) — o evento já conta **só a minha parte** (`event-budget.ts` usa `transactionBasePersonalCostCents`) e o que devo lançado **já sai do livre** (`budget.ts › calculatePoolSpent`). Os **10 de trabalho**: (1) **o evento some ao fechar a saída** — `outing-orchestrators.ts › endOutingSession` (L92-105) seta `isConfirmed` no evento ao encerrar a saída; `discardOutingSession` (L154-165) desvincula/apaga; o modelo amarra 1 evento a 1 saída (`linkedSessionId`) → precisa de **ciclo próprio** (iniciar evento → várias saídas → encerrar) com `Session.occurrenceId?` + `PlannedOccurrence.startedAt?` aditivos e `eventConsumedSpentCents` somando todas as saídas sem double-count (G1, keystone). (2) **Sem guia do evento** — o detalhe é só o sheet de edição e o card corta em "+N mais" morto → **EventGuidePage** `/event/:id` (G2). (3) **Acerto não reconcilia** — `statement-payload.ts` não leva **settlements** no payload (net €50, itens €70, pagamento de €20 invisível) nem **local** por item → payload ganha `settlements?` + `statementLineSchema.place*` (G3). (4) **IA manda "Outros"** — worker `buildAssistantSystemPrompt` (L342) "when stated" + fallback `t('categories.*)` em `useAssistant.ts` (L706-708/L770-772) → prompt sempre descreve + cadeia descrição→local→neutro (G4, **muda o worker**). (5) **Sem busca de lugar** — `PlaceField.tsx` não expõe `searchPlaceByName` → campo de busca → coords reais (G5). (6) **Mapa expandido rola junto + retângulo por cima** — `ExpenseLocationMapField` faz overlay `fixed` **sem portal** → portar pra `overlayHost()` (G6). (7) **Card fecha ao rolar texto** — `BottomSheet.onBodyTouchStart` (L122-131) ignora scrollable aninhado → guard (G6). (8) **Colar imagem na IA** — `AssistantSheet InputArea` sem `onPaste` → acumula + OCR no enviar (G7).

## Contrato de autonomia (9 regras, condensado)
1. **Sem subagent / sem Task tool / tudo inline** nesta sessão (custo é por request).
2. **Não peça permissão entre work units** depois das travas — fechar gate = commit→deploy→dev-log→próximo.
3. **Não narre o que vai fazer — faça.** Minimize prosa.
4. **Reuse o que existe** (`event-budget.ts` DEC-385/390; `resolveEventLeftover` DEC-387; `buildParticipantStatement`/`filterStatementToCounterparty`/`buildParticipantSharePayload` DEC-394/399; `searchPlaceByName` DEC-389; `ExpenseLocationMapField` DEC-398; `extractReceiptViaCloud` DEC-397/206; `BottomSheet` portal/`overlayHost`) — não reinvente.
5. **Código em inglês; UI via `t()`** (pt/en/es); doc/brain em português.
6. **Domínio antes de UI**, uma mudança por vez, **teste junto**.
7. **Terminal WSL:** sempre `git --no-pager`; commit via `G=/usr/bin/git; "$G" commit -m "…"`; nunca pager/editor/`-i`.
8. **Brain em sync:** dev-log todo milestone; decision-log nas DECs; product-spec/budget-model/project-status nos momentos certos.
9. **Hand-off final termina com `AskQuestion`** — só num stop genuíno (DoD toda TRUE, ou contexto acabando), nunca no meio.

## Decisões já adotadas (CONFIRMADAS por Julio 2026-06-29 — §16)
- **DEC-400** evento com ciclo próprio (iniciar evento → saídas N:1 → encerrar), aditivo (G1 · L-EVENT-LIFECYCLE=a) · **DEC-401** guia `/event/:id` **editável (botão → sheet existente)** + ritmo **factual (números + veredito leve)** (G2 · L-EVENT-SURFACE=a) · **DEC-402** acerto reconcilia: settlements como linhas + local por item, nunca dado interno (G3 · L-SETTLE-DETAIL=a) · **DEC-403** IA escreve descrição factual; categoria nunca é descrição; fallback descrição→local→neutro (G4 · L-AI-DESC=a, **worker**) · **DEC-404** confirmar livre↔dívida + evento só minha parte (G0, prova, zero math) · **DEC-405** `PlaceField` busca por nome → coords reais (G5) · **DEC-406** mapa expandido por portal (G6) · **DEC-407** card não fecha ao rolar scrollable aninhado (G6) · **DEC-408** colar imagem na IA, acumula + OCR no enviar (G7 · L-AI-IMAGE=a) · **DEC-409** saída-de-evento embutida no card/guia (suprime o 2º card; nº grande = consumido do evento; botão primário = **gasto direto**) (G1+G2) · **DEC-410** **IA cria evento** (`plan_event`) (G8, **worker**).

## ÂNCORA (cole a cada 3 milestones / em cada fronteira de gate)
```
ÂNCORA — O evento de verdade, o acerto que reconcilia, captura/local sem atrito
- A aritmética do livre/Trecho/Pote e do ACERTO (saldos/totais/net-do-owner) é INVARIANTE vs baseline.
- Única mudança de math = somar MÚLTIPLAS saídas do evento, sem double-count (tx é occurrenceId XOR sessionId) (Â-EVENT-NO-DOUBLE-COUNT).
- Encerrar/descartar uma SAÍDA nunca encerra nem apaga o EVENTO; o evento só some quando explicitamente encerrado (Â-EVENT-LIFECYCLE).
- O que compartilho RECONCILIA: linhas (despesas + pagamentos) somam ao net real; o destinatário vê local/detalhe, nunca meu fundo/wallet/pool (Â-SETTLE-RECONCILES / Â-SHARE-PRIVACY).
- Lugar resolve coords REAIS; a IA escreve descrição de verdade (nunca a categoria); mapa nunca prende a rolagem; nunca bloquear; schema aditivo; t(); código em inglês.
CURRENT STATE: gate=<g> · last_commit=<sha> · tests=<n passing/known-base> · risks=<...> · scope=<itens>
```

## Ordem dos gates (+ versão alvo)
- **G0** baseline (`install`/`test`/`build`/`tsc`) + DEC-400→410 como `PROPOSED` + **provas** dos pontos 1 e 4 (DEC-404).
- **G1** ciclo de vida do evento (iniciar/saídas/encerrar; evento nunca some sozinho) **+ suprime/embute saída-de-evento (DEC-409); botão primário = gasto direto** → `1.9.0-rc` (HEADLINE, keystone).
- **G2** guia do evento (`/event/:id`, editável, ritmo opinativo, todas as despesas, saídas com saída ativa embutida, encerrar) → `1.9.1-rc`.
- **G3** acerto que reconcilia (settlements como linhas + local/detalhe por item) → `1.9.2-rc`.
- **G4** IA escreve descrição + provas livre↔dívida → `1.9.3-rc` (**`wrangler deploy` do worker**).
- **G5** buscar lugar por nome → GPS real → `1.9.4-rc`.
- **G6** mapa fixo por portal + card não fecha ao rolar texto → `1.9.5-rc`.
- **G7** colar imagem na IA (acumula + OCR no enviar) → `1.9.6-rc` (talvez worker/vision).
- **G8** IA cria evento (`plan_event`) → `1.9.7-rc` (**`wrangler deploy`**; pode compartilhar o deploy do G4).

## Per-milestone (5-point) + deploy
Antes de cada commit: (1) liste AC satisfeitos; (2) cite 3 AC anteriores em risco + verifique (sempre **A1/A6 invariância de livre/Trecho/Pote/net-do-owner** + **A5 nunca bloquear gasto/IA/import** + **Â-EVENT-NO-DOUBLE-COUNT**); (3) testes sem novas falhas; (4) sinalize arquivo fora de escopo; (5) atualize dev-log. **Deploy por gate:** bump `package.json` + `src/utils/app-version.ts` + `public/version.json` + `package-lock.json` (+ release note pt/en/es em `src/utils/release-notes.ts`) → `G=/usr/bin/git; "$G" commit -m "…"` + push `master` → Pages auto-build. Verifique `/version.json`. **G4, G8 (e talvez G7) também rodam `wrangler deploy`** do worker (G4+G8 podem compartilhar um deploy); os demais gates **não** tocam o worker.

## G0 — comandos exatos (rode já)
```bash
cd /home/julio/projetos/trip-budget-copilot/TripPilot
npm install
npm run test 2>&1 | tail -40
npm run build 2>&1 | tail -20
npx tsc --noEmit 2>&1 | tail -20
git --no-pager log --oneline -6   # topo deve ser 1.8.7-rc (DEC-399) — confirmar base
```
Registre as contagens baseline no `src/dev-log.md`; DEC-400→410 como `PROPOSED`; escreva as **provas** dos pontos 1 e 4 (split €30/3 → €10 no spent e no evento; "alguém pagou €10 por mim" → livre −€10). Travas já confirmadas (§16) → **execute G1→G8, sem parar até a Definition of Done (§12) estar toda TRUE** (ou contexto acabando → feche o gate atual limpo + hand-off no dev-log).

**Confirme em UMA linha que leu o orchestrator e começou o G0 — depois continue sem esperar resposta (G1→G8).**
