# KICKOFF — Leva "Import/cofrinho/acerto de verdade + mapas de satélite e exploração + conversor/IA/amigo completos"

**Você é** um(a) engenheiro(a) full-stack sênior aplicando esta leva **sozinho(a), nesta sessão, de ponta a ponta** — domínio→UI, testar junto, commitar por item, deploy por gate, brain em sync. **Sem worker nesta leva** (tudo é device/Pages).

**Fonte de verdade:** `TripPilot/brain/documents/2026-06-30-field-fixes-maps-money-truth-orchestrator.md`. Leia **§0–§9 uma vez**, depois execute **G0 já**, e **G1 → G11 em ordem**.

**Estado da leva:** ✅ **7 travas CONFIRMADAS (Julio 2026-06-30 — todas em (a)) + 4 perguntas abertas respondidas nos defaults** (FX refresh **12h**; majors **BRL/USD/EUR/CAD/CHF/GBP/JPY**; mover dívida **por itens**; categorias **enriquecer + poucas novas**). **Não há fork em aberto — não pergunte nada; rode G0 e siga G1→G11 sem parar** até a DoD (§12). Base `1.9.9-rc` (DEC-412 shipped) — **não re-rode** waves anteriores; esta **consome** o que já existe (`ClassifyWiseContext.existingSettlements?` — declarado; `searchPlaceByName`/`stamp-expense-location` DEC-389; `buildPiggyLedger` DEC-279/411; `calculateTodayFreeBudget` DEC-088; `honest-friend*`; `splitting.ts`/`buildParticipantStatement`; `/event/:id` DEC-401; `ExpenseLocationMap` DEC-398/406; conversor DEC-256).

## A descoberta-chave (causas REAIS, verificadas lendo o código, confiança ALTA)
São **14 pedidos** do Julio → **11 gates + G0**. Keystone = **import de verdade**. (1) **Transferência reimporta e não desmarca** — `wise-import.ts › classifyWiseRows` monta `importedRefs` **só** de `existingTransactions`; transferência comita como **`Settlement`** (com `externalRef=wiseExternalRef(rowId)`), nunca `transaction`, então nunca é dedupada; `ClassifyWiseContext.existingSettlements?` existe e está **vazio**; e transfer não tem toggle incluir/excluir (G2, keystone). (2) **Detalhe sem evento** — `ExpenseDetailPage` nunca lê `tx.occurrenceId` (G9). (3) **Import sem local** — `searchPlaceByName`/`stamp-expense-location` existem mas nunca rodam pro import; `extractCity` só vira string (G3). (4/5) **Conversor** — **não há** mapa de metadados de moeda no `src`; `listSelectableCurrencies` só uppercasa códigos, sem ordem/nome; `frozenRates` é opt-in puxado 1x (base-anchored já converte qualquer par) → majors no topo + nome/país + auto-refresh (G8). (6) **Mover dívida entre pessoas** — modelo `Settlement{debtor,creditor}`; dívida = Σ `ParticipantShare`; mover fiel = **reatribuir shares** A→B com `reassignedFrom` + log (G6). (7) **Remover pessoa** — `handleRemovePerson`→`removeConnectedPerson` só **desvincula** (vira `noapp`, continua na lista); `noapp` puro nem tem botão → **soft-delete** do participante (G7). (8) **"Livre hoje" infla** — `rhythm.ts › calculateTodayFreeBudget` re-espalha o livre restante ÷ menos dias, então subgastar **sobe** a mesada de amanhã; o cofrinho já acumula certo, mas o herói não capa → capar no ideal-base quando cofrinho>0 (G4, **invariante de dinheiro**). (9) **Muito "Outros"** — `CATEGORY_RULES` só 8 categorias EU-enxutas → expandir (G3). (10) **IA add sem divisão** — `ExpenseEditor` computa `isSplit` mas não tem editor de split (G10). (11) **Detalhe em satélite** — `ExpenseLocationMap` L60 usa OSM → Esri (G9). (12) **Tela de gastos no mapa** — não existe → rota `/mapa` cluster+satélite+tap→detalhe; heatmap follow-up (G11). (13) **Barra de rolagem "voltou"** — o CSS global é **blindado** (guardado por `style-hygiene.test.ts`); é superfície específica (Leaflet/`width:0` vs `display:none`) → investigar + endurecer (G1, ganho rápido). (14) **Amigo fixa num gasto** — `amigoTriggerTx` = mais recente **por data** (em lote, um caro antigo); `no_plan` papagaia "esse gasto levou X%" sem rodízio → relevância + preferir ritmo + dedupe (G5).

## Contrato de autonomia (9 regras, condensado)
1. **Sem subagent / sem Task tool / tudo inline** nesta sessão (custo é por request).
2. **Não peça permissão entre work units** depois das travas confirmadas — fechar gate = commit→deploy→dev-log→próximo.
3. **Não narre o que vai fazer — faça.** Minimize prosa.
4. **Reuse o que existe** (`existingSettlements` no dedupe; `searchPlaceByName`/`stamp-expense-location`; `buildPiggyLedger`+`baseDailyIdeal`; `ParticipantShare`/`buildParticipantStatement`; `pairRate`/`ratesToBase`; `/event/:id`; `ExpenseLocationMap`; componentes de split) — não reinvente.
5. **Código em inglês; UI via `t()`** (pt/en/es); doc/brain em português.
6. **Domínio antes de UI**, uma mudança por vez, **teste junto**.
7. **Terminal WSL:** sempre `git --no-pager`; commit via `G=/usr/bin/git; "$G" commit -m "…"`; nunca pager/editor/`-i`.
8. **Brain em sync:** dev-log todo milestone; decision-log nas DECs (DEC-413→425); product-spec/budget-model/project-status nos momentos certos.
9. **Hand-off final termina com `AskQuestion`** — só num stop genuíno (DoD toda TRUE, ou contexto acabando), nunca no meio.

## Decisões (DEC-413→425 · defaults §16 = (a) até Julio confirmar)
- **DEC-413** import idempotente: dedupe por `externalRef` contra transactions **∪** settlements + transfer desmarcável (G2 · L-WISE-DEDUP=a) · **DEC-419** import geocoda o local sem IA (merchant/title/`extractCity`→coords, batelado/best-effort) (G3) · **DEC-420** `CATEGORY_RULES` expandido + sinais (`detailsType`/POI) (G3) · **DEC-415** capar "livre hoje" no ideal-base quando cofrinho>0; total intacto (G4 · L-COFRINHO-DAILY=a, **invariante**) · **DEC-417** Amigo: relevância + preferir ritmo + rodízio/dedupe por dia (G5 · L-AMIGO-VARIETY=a) · **DEC-414** mover dívida = reatribuir shares A→B com `reassignedFrom`+log, só shares locais não-P2P (G6 · L-DEBT-MOVE=a) · **DEC-418** remover pessoa = soft-delete p/ qualquer status, trava saldo=0 (G7 · L-REMOVE-PERSON=a) · **DEC-423** conversor: `currency-meta` (nome/país/prioridade) + majors no topo + auto-refresh (G8) · **DEC-421** detalhe mostra evento→`/event/:id` (G9) · **DEC-422** mapa do detalhe em satélite (Esri) + toggle (G9 · L-SATELLITE=a) · **DEC-424** IA add com divisão + paridade de campos (G10) · **DEC-416** tela `/mapa`: clusters+satélite+tap→detalhe; heatmap follow-up (G11 · L-MAP-SCREEN=a) · **DEC-425** barra de rolagem some (endurecer global + Leaflet) (G1).

## ÂNCORA (cole a cada 3 milestones / em cada fronteira de gate)
```
ÂNCORA — Import/cofrinho/acerto de verdade + mapas + conversor/IA/amigo
- O TOTAL do livre/Trecho/Pote e o net pairwise do owner é INVARIANTE vs baseline.
- Única mudança de math = a LEITURA DO DIA ("livre hoje" capa no ideal-base quando cofrinho>0); o total NÃO muda; Σ(mesada diária) + cofrinho = livre (bit-a-bit) (Â-MONEY-INVARIANT).
- Reimportar o mesmo extrato NUNCA recria transferência já importada; tudo é desmarcável (Â-IMPORT-IDEMPOTENT).
- Mover dívida preserva histórico + atribuição ("veio da {nome}") e o net total não muda, só de titular; nunca dívida órfã (Â-DEBT-TRACEABLE / Â-PERSON-HIDE-NEVER-BREAK).
- Local do import = coords REAIS (nunca inventa); satélite/tiles/refresh/geocode best-effort e offline-safe; nunca bloquear; schema aditivo; sem barra de rolagem; t(); código em inglês.
CURRENT STATE: gate=<g> · last_commit=<sha> · tests=<n passing/known-base> · risks=<...> · scope=<itens>
```

## Ordem dos gates (+ versão alvo · nenhum toca o worker)
- **G0** baseline (`install`/`test`/`build`/`tsc`) + DEC-413→425 como `PROPOSED` + **provas** de caracterização (transfer duplica hoje; mesada infla ao subgastar; trigger por data).
- **G1** barra de rolagem some (endurecer global + Leaflet) → `2.0.0-rc` (ganho rápido).
- **G2** import idempotente + transfer desmarcável (dedupe por settlements) → `2.0.1-rc` (keystone).
- **G3** import geocoda o local + categoriza melhor → `2.0.2-rc`.
- **G4** "livre hoje" não infla (cofrinho) → `2.0.3-rc` (**invariante — teste-âncora obrigatório**).
- **G5** Amigo Sincero varia → `2.0.4-rc`.
- **G6** mover dívida entre pessoas (com histórico) → `2.0.5-rc`.
- **G7** remover pessoa de vez (inclusive sem app) → `2.0.6-rc`.
- **G8** conversor: majors/nome/país + refresh → `2.0.7-rc`.
- **G9** detalhe: evento + mapa satélite → `2.0.8-rc`.
- **G10** IA add: divisão + paridade de campos → `2.0.9-rc`.
- **G11** tela de gastos no mapa (heatmap = follow-up) → `2.1.0-rc`.

## Per-milestone (5-point) + deploy
Antes de cada commit: (1) liste AC satisfeitos; (2) cite 3 AC anteriores em risco + verifique (sempre **invariância do TOTAL livre/Trecho/Pote/net-do-owner** + **nunca bloquear gasto/import/IA** + **Â-IMPORT-IDEMPOTENT** + **sem barra de rolagem**); (3) testes sem novas falhas; (4) sinalize arquivo fora de escopo; (5) atualize dev-log. **Deploy por gate:** bump `package.json` + `src/utils/app-version.ts` + `public/version.json` + `package-lock.json` (+ release note pt/en/es em `src/utils/release-notes.ts`) → `G=/usr/bin/git; "$G" commit -m "…"` + push `master` → Pages auto-build. Verifique `/version.json`. **Nenhum gate roda `wrangler deploy`.**

## G0 — comandos exatos (rode já)
```bash
cd /home/julio/projetos/trip-budget-copilot/TripPilot
npm install
npm run test 2>&1 | tail -40
npm run build 2>&1 | tail -20
npx tsc --noEmit 2>&1 | tail -20
git --no-pager log --oneline -6   # topo deve ser 1.9.9-rc (DEC-412) — confirmar base
```
Registre as contagens baseline no `src/dev-log.md`; DEC-413→425 como `PROPOSED`; escreva as **provas de caracterização** (import do mesmo CSV 2x duplica a transferência hoje; `calculateTodayFreeBudget` sobe a mesada ao subgastar; `amigoTriggerTx` = mais recente por data). Travas confirmadas (§16, todas em (a)) → **execute G1→G11 direto, sem parar até a Definition of Done (§12) estar toda TRUE** (ou contexto acabando → feche o gate atual limpo + hand-off no dev-log). **Não pergunte nada entre gates.**

**Confirme em UMA linha que leu o orchestrator e começou o G0 — depois continue sem esperar resposta (G1→G11).**
