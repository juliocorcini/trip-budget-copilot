# Leva — "Eventos que reservam de verdade": reserva multi-dia + atribuição de gasto + sobra + local pela IA + acerto só meu

> **Status: ⏳ AWAITING LOCK** (defaults adotados por conselho inline) · **G0 pode começar já** (baseline, sem bifurcação). **G1→G6 são o trabalho acionável após o lock do §16.**
> **Version cadence:** app `1.6.4-rc → 1.7.x-rc` (um bump por gate; G5/G6 podem virar opcionais).
> **Sibling waves:** `2026-06-27-p2p-delivery-truth-orchestrator.md` (DEC-374→384, shipped 1.6.4-rc) — o transporte P2P já chega; esta leva **reusa** esse canal (DEC-375/376) para rotear dívida de terceiros (P6). Modelo de orçamento: `budget-model-master-decision-2026-06-17.md` (Trecho/Pote/Evento/Compra) — esta leva **corrige o consumo da reserva de Evento** sem mexer no Trecho/Pote.

---

## §0 — Mission

**O que esta leva É:** consertar como um **Evento dentro de uma fase** reserva e **consome** dinheiro ao longo dos seus vários dias — hoje a reserva é um lump que vaza inteiro para o "livre" quando o evento começa (bug P5) — e dar formas de **atribuir gastos reais ao evento** (manual / IA / Wise) sem depender da saída ativa, **resolver a sobra** no fim, **achar o local certo pelo nome** que a IA capturou, e fazer o **acerto de contas mostrar só o que é meu**.

**A dor central, nas palavras do Julio:**

> *"Quando um evento é criado dentro de uma fase e eu seleciono um valor pra usar, não preciso gastar tudo pela função saída — ou gasto tudo pela saída ou não gasto. (…) Passou o primeiro dia do evento e ele meio que não reserva mais o valor do livre — a média diária sobe muito, e ainda junta com o que já tinha separado pro evento, o limite do dia fica gigante. Fica errado, não pode ficar assim. (…) Saí pro evento, fiz uns 4 gastos pelo Wise; pôr todos pela saída ativa é ruim (perde informação) — prefiro uma dívida certa, ou uma entrada por IA, ou selecionar no import do Wise e já marcar como gastos do evento. (…) Se sobrar no fim, me pergunta: volta pro livre, vai pro cofrinho (com histórico 'sobra do evento X'), ou um pote separado do mesmo dinheiro? (…) No acerto, quero contar só comigo — o que eu devo / me devem. Se a Débora deve 49 ao Bruno só porque eu registrei, não tem que aparecer pra mim; quem tem que ver é o Bruno. Pensar tudo com o conselho."*

**A descoberta que unifica (causa-raiz, confiança ALTA — verificada lendo o código 2026-06-27):** o `PlannedOccurrence` (Evento) tem `reservedCents`, mas `domain/budget/budget.ts › calculateEventReserves` só o subtrai do livre **enquanto `!isConfirmed && linkedSessionId === null`**. No instante em que o evento "começa" (uma saída é iniciada a partir dele → `linkedSessionId`), a reserva é **liberada inteira** de volta ao livre; o gasto real entra em `totalSpentCents` por um caminho independente. Resultado: (1) o "livre hoje"/média diária **pula** no dia 1; (2) o valor do evento é **contado 2×** (some da reserva e reaparece no livre, enquanto o card do evento ainda mostra o mesmo valor "pra gastar aqui"). E o único jeito de "gastar do evento" é a **saída ativa**, que limita os campos — por isso o Julio não consegue lançar gastos ricos (Wise/IA/dívida) contra o evento.

**O que esta leva NÃO é:** **não** mexe na aritmética de **Trecho/Pote** (DEC-219/D14) nem na do **acerto** (centavos/saldos — DEC-241/345). Muda **intencionalmente** o consumo da reserva de **Evento** (com invariante própria: nunca contar 2×, nunca pular). Não reescreve o transporte P2P (reusa DEC-375/376) nem o cofrinho (reusa DEC-279/261) nem os Potes (reusa `global` BudgetPool).

**O app, em uma linha:** TripPilot é um planejador de orçamento de viagem local-first (PWA + APK) que registra gastos, divide contas e faz acerto entre pessoas — conectadas (P2P E2E) ou por link.

→ Para começar, vá ao **§17**.

---

## §1 — Identity & autonomy contract (você é o executor)

Você é um(a) engenheiro(a) full-stack sênior aplicando esta leva **sozinho(a), nesta sessão, de ponta a ponta**: investiga (re-lendo o arquivo do §6 antes de editar), codifica **domínio→UI**, testa junto, commita por item, e **no fim de cada gate**: suíte verde + `build` + `tsc --noEmit` + smoke + bump de versão + **deploy** (push master → Pages auto-build) + dev-log + promover DECs. As 9 regras do §1 do SKILL valem como **absolutas** (sem subagent; tudo inline nesta sessão; não pedir permissão entre work units depois do lock; minimizar prosa; reusar o que existe; código em inglês, UI via `t()`; domínio antes de UI; `git --no-pager` + commit por `G=/usr/bin/git`; hand-off final só num stop genuíno). Bifurcação nova → council inline (1 request) → `DEC-NNN (PROPOSED)` → continue.

---

## §2 — Reading order (carregue contexto UMA vez)

1. Este doc **§0–§9** (uma vez).
2. `TripPilot/src/dev-log.md` (Current State — a leva P2P acabou de shippar `1.6.4-rc`).
3. Só as DECs citadas: **DEC-072** (Evento/sub-destino + reserva) · **DEC-219/D14** (Trecho/Pote, não tocar) · **DEC-241/345** (acerto, invariante) · **DEC-261/279** (cofrinho buffer/ledger) · **DEC-367** (location-on-save, probable name) · **DEC-200** (Wise import) · **DEC-375/376** (transporte P2P, reusar) · novos **DEC-385→389** (§7).
4. Entidades do `product-spec.md`/`budget-model-master-decision-2026-06-17.md`: `PlannedOccurrence`, `BudgetPool` (`global`=Pote), `Transaction`, `ParticipantShare`, `Settlement`, piggy-ledger.

**Não re-leia o brain inteiro por milestone.** Re-leia o **arquivo do §6** do item antes de editar (símbolos se movem).

---

## §3 — Non-negotiables (ÂNCORA) — quebrar uma é defeito mesmo com teste verde

**Herdadas (app-wide):**

- **A1** Dinheiro = inteiro em centavos; a **aritmética do ACERTO** (saldos/dívidas — DEC-241/345) e a do **Trecho/Pote** (D14) são **INVARIANTES** nesta leva.
- **A2** Domínio = TS puro, zero React; lógica fora de componentes/transporte.
- **A3** Texto de UI sempre via `t()` (pt/en/es); **código/identificadores/commits em inglês**.
- **A4** Hide-never-delete (tombstone); nunca apagar ação/feature/gasto.
- **A5** **Nunca bloquear o registro de gasto** — atribuição/geocode/entrega são best-effort em background; salvar retorna na hora.
- **A6** Invariância de dados: ninguém perde gasto/saldo por causa desta leva.

**Novas desta leva:**

- **Â-EVENT-RESERVE** — o valor do Evento é **segurado** (não liberado no início) e **consumido** pelo gasto **atribuído** ao evento; o "livre hoje" da fase **nunca pula** porque o evento começou; o dinheiro do evento **nunca conta 2×** (reserva remanescente = `max(0, reservado − gastoAtribuído)`).
- **Â-ATTRIBUTION** — atribuir um gasto a um evento é **explícito** (campo `occurrenceId`), de 1 toque, pré-sugerido quando há evento ativo; um gasto é de **evento OU de saída**, nunca ambos; funciona igual em manual / IA / Wise.
- **Â-LEFTOVER-CONSERVED** — a sobra do evento (`reservado − gasto > 0`) é **conservada 1:1** ao destino escolhido (livre / cofrinho rotulado / pote dedicado), **nunca auto-decidida**, sempre **rotulada com o nome do evento**, e fica **pendente** até o usuário resolver (nunca some, A4).
- **Â-EGO-SETTLE** — o acerto do owner mostra **só** dívidas onde ele é parte (fiel ao **net real** das shares/settlements, não derivado do min-transfer entre terceiros); dívida terceiro↔terceiro sai do principal e é **roteada aos envolvidos** via P2P (DEC-375/376), sem sumir (A4).
- **Â-PLACE-FALLBACK** — o forward-geocode do nome capturado pela IA é **opt-in / online-only / never-throws**; sem match → cai no **GPS atual** (caminho DEC-367); coords só saem do device na busca explícita (igual ao reverse, ÂNCORA 8).

---

## §4 — Baseline: o que JÁ existe (reusar, não reinventar)

Confirmado lendo o código (2026-06-27):


| Peça que já existe                           | Arquivo → símbolo                                                                                                                     | Como reusar nesta leva                                                                                                                       |
| -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| Reserva de evento deduz do livre (DEC-072)   | `domain/budget/budget.ts › calculateEventReserves` (L41-55) + `calculateFreeToSpend › eventReservesCents` (L86-89)                    | **G2** muda a fórmula: `remaining = max(0, reservado − gastoAtribuído)`, sem liberar no início.                                              |
| Breakdown "de onde vem" do livre (DEC-168)   | `budget.ts › buildFreeToSpendBreakdown › 'event_reserves'` (L176)                                                                     | **G2** mantém a linha refletindo a reserva **remanescente** (não a cheia).                                                                   |
| Modelo do Evento                             | `domain/types/planned-occurrence.ts › PlannedOccurrence` (`reservedCents`, `plannedDate`/`endDate`, `linkedSessionId`, `isConfirmed`) | **G1** acrescenta o vínculo de gasto; **G2** revê `linkedSessionId`/`isConfirmed` como gatilho de liberação.                                 |
| Helpers de evento (intervalo/visibilidade)   | `domain/planning/occurrences.ts › isOccurrenceActiveToday` (L44), `selectVisibleEvents` (L101), `sumSpentInOccurrenceInterval` (L130) | **G1** reusa `isOccurrenceActiveToday`/`selectVisibleEvents` p/ o seletor; `sumSpentInOccurrenceInterval` é o fallback do §16 L-ATTRIBUTION. |
| Allowance diária subtrativa da fase          | `domain/phases/rhythm.ts › calculateTodayFreeBudget`; `allowance-map.ts › buildPhaseAllowanceMap`                                     | **G2** espelha o padrão p/ a allowance **por-dia do evento** (`remaining / diasRestantes`).                                                  |
| Tipo da transação + schema (campos aditivos) | `domain/types/transaction.ts › Transaction`; `domain/validation/schemas.ts › transactionSchema` (`.passthrough()`)                    | **G1** adiciona `occurrenceId: string                                                                                                        |
| Criação de gasto                             | `domain/transactions/transactions.ts › createExpenseTransaction`                                                                      | **G1** aceita `occurrenceId` opcional (default null).                                                                                        |
| QuickAdd (manual + confirm da IA)            | `features/expenses/QuickAddPage.tsx › persistExpense`                                                                                 | **G1** adiciona o seletor de evento (pré-sugerido); grava `occurrenceId`.                                                                    |
| Wise import (seleção + pool por fase)        | `domain/orchestrators/import-orchestrators.ts › commitWiseImport` (L83)                                                               | **G3** aceita um alvo de evento p/ as linhas selecionadas (grava `occurrenceId`).                                                            |
| Location-on-save (probable name, DEC-367)    | `domain/location/save-location.ts › resolveSaveLocation`; `utils/places.ts › reverseGeocodePlace` (L75), `searchNearbyPlaces` (L36)   | **G5** acrescenta `searchPlaceByName` (forward) + fia no save da IA; fallback GPS já existe.                                                 |
| Cofrinho (buffer + ledger, DEC-279/261)      | `domain/budget/piggy-ledger.ts › buildPiggyLedger`                                                                                    | **G4** opção (b): a sobra entra como entrada rotulada "Sobra de {evento}".                                                                   |
| Potes (`global` pool)                        | `domain/budget/budget.ts › createBudgetPool` (`scope:'global'`); `computeTripBudgetTotals` (à parte do total)                         | **G4** opção (c): pote dedicado "Sobra de {evento}", à parte do livre.                                                                       |
| Acerto ego-cêntrico                          | `domain/splitting/splitting.ts › calculateDebts` (L247), `summarizeOwnerDebts` (L351, já filtra owner-involved)                       | **G6** deriva a lista/saldos de `summarizeOwnerDebts`; nova derivação `thirdPartyDebts` separada.                                            |
| Transporte P2P (entrega + motivo)            | `domain/orchestrators/p2p-orchestrators.ts › shareDebtWithPeer`; `mailbox-orchestrators.ts › flushOutbox` (DEC-375/376)               | **G6** roteia a dívida de terceiros aos envolvidos por este canal (best-effort).                                                             |


**GAP confirmado:** a reserva do evento **vaza inteira** ao iniciar (`calculateEventReserves` para de subtrair quando `linkedSessionId`/`isConfirmed`), inflando o livre e contando 2×; **não há** vínculo de gasto→evento fora da saída/`linkedTransactionId` (1 tx); **não há** forward-geocode (nome→coords); o acerto **já** filtra o owner no hero (`summarizeOwnerDebts`), mas a **lista de pessoas/saldos** ainda expõe terceiros e **não roteia** a dívida de terceiros aos envolvidos.

---

## §5 — Change-set normalizado (do briefing → itens)

**P0 — Orçamento do evento (o coração):**

- **B-ATTR** — atribuir gasto **manual/IA** a um evento ativo (campo `occurrenceId` explícito, 1 toque). → **G1** (DEC-386). *Pré-requisito do B-RESERVE.*
- **B-RESERVE** — a reserva do evento **não vaza no início**; é consumida pelo gasto atribuído; allowance **por-dia do evento** (sobra rola pros dias restantes); livre da fase **não pula**; nunca 2×. → **G2** (DEC-385). *Corrige o P5.*
- **B-WISE** — no import do Wise, selecionar linhas e marcá-las como gastos do evento (sem uma-a-uma na saída). → **G3** (DEC-386 cont.).
- **B-LEFTOVER** — no fim do evento com sobra, **perguntar** o destino (livre / cofrinho rotulado / pote dedicado), conservando 1:1. → **G4** (DEC-387).

**P1 — Captura & acerto:**

- **L-PLACE** — a IA capta o nome do estabelecimento; no salvar, achar o local exato desse nome; sem match → GPS atual. → **G5** (DEC-389).
- **S-EGO** — o acerto mostra só o que é meu; dívida de terceiros sai do principal e é roteada/registrada à parte. → **G6** (DEC-388).

---

## §6 — Root-cause map (código ↔ mudança) — RE-LEIA o arquivo antes de editar


| #          | Sintoma (palavras do Julio)                                                                                                    | Causa-raiz — arquivo → símbolo (exato)                                                                                                                                                                                                                                                      | Direção do fix                                                                                                                                                                                                                                                                        | Gate                                                                                                                                                                                                     |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| B-RESERVE  | "passou o 1º dia e não reserva mais; a média sobe; junta com o que separei; limite gigante; fica errado"                       | `**domain/budget/budget.ts › calculateEventReserves`** (L41-55): filtra `!isConfirmed && linkedSessionId===null` → ao iniciar, deduz **0** (libera tudo); o gasto entra por `calculatePoolSpent` (L264) sem relação com a reserva → conta 2× e o livre pula                                 | reserva passa a ser `**remaining = max(0, reservedCents − attributedSpent(occ))`** e **continua** sendo subtraída após o início; novo módulo `domain/budget/event-budget.ts` com a allowance por-dia (`remaining / diasRestantes`); `buildFreeToSpendBreakdown` mostra a remanescente | **G2**                                                                                                                                                                                                   |
| B-ATTR     | "ou gasto tudo pela saída ou não gasto"; "prefiro uma dívida certa / entrada por IA"                                           | `**domain/types/transaction.ts › Transaction`** não tem `occurrenceId`; só `linkedSessionId` (saída) ou `linkedTransactionId` (1 tx, em `PlannedOccurrence`) ligam ao evento                                                                                                                | add `occurrenceId: string                                                                                                                                                                                                                                                             | null`(aditivo,`.passthrough()`, sem migração);` createExpenseTransaction`aceita; seletor de evento (pré-sugerido por`isOccurrenceActiveToday`) em` QuickAddPage.persistExpense` (manual + confirm da IA) |
| B-WISE     | "saí pro evento, 4 gastos no Wise; pôr um a um na saída é ruim — quero selecionar e marcar como do evento"                     | `**domain/orchestrators/import-orchestrators.ts › commitWiseImport**` (L83-177) já filtra `drafts` selecionados + pool por fase, mas não há alvo de **evento**                                                                                                                              | aceitar um `occurrenceId` (ou `occurrenceByRowId`) opcional e gravá-lo nas txs das linhas escolhidas; UI do import: "marcar selecionados como gastos de {evento ativo}"                                                                                                               | **G3**                                                                                                                                                                                                   |
| B-LEFTOVER | "se sobrar: volta pro livre / cofrinho com 'sobra do evento X' / um pote separado do mesmo dinheiro"                           | não existe fluxo de fim-de-evento; reusos: `piggy-ledger.ts` (cofrinho), `createBudgetPool('global')` (pote), `selectVisibleEvents`/`endDate` (detecção)                                                                                                                                    | detectar evento terminado (`endDate < hoje`) com `remaining>0` → estado "sobra pendente" → prompt 3 destinos, conservando 1:1, rótulo "Sobra de {evento}"; pendente até resolver (A4)                                                                                                 | **G4**                                                                                                                                                                                                   |
| L-PLACE    | "a IA capta o nome do lugar; quero que ele procure o local exato desse nome; se não achar, salva com onde eu estava"           | `**utils/places.ts`** só tem `reverseGeocodePlace` (coords→nome) e `searchNearbyPlaces`; **não há** forward (nome→coords); `save-location.ts › resolveSaveLocation` usa `autoName`+`fix` (GPS)                                                                                              | add `searchPlaceByName(name, near?)` (Nominatim `/search`, opt-in/online-only/never-throws, enviesado pela coordenada atual); no save da IA, se há `placeLabel`, resolver coords desse nome (verified `'user'`/`'auto'`); sem match → `fix` GPS (DEC-367)                             | **G5**                                                                                                                                                                                                   |
| S-EGO      | "Débora deve 49 ao Bruno só porque eu registrei aparece pra mim — não tem que aparecer; quem vê é o Bruno; eu conto só comigo" | `**domain/splitting/splitting.ts › summarizeOwnerDebts`** (L351) já filtra owner-involved no hero, MAS `calculateDebts` (L247) gera o grafo min-transfer completo e a **lista de pessoas/saldos** (`SharedExpensesPage`) usa saldos que incluem terceiros; não há roteamento aos envolvidos | lista/saldos do acerto derivam de `summarizeOwnerDebts` (fiel ao net real); nova função pura `thirdPartyDebts(debts, ownerId)` p/ um menu secundário display-only; roteamento best-effort de cada dívida de terceiros aos 2 envolvidos via `shareDebtWithPeer` (DEC-375/376)          | **G6**                                                                                                                                                                                                   |


---

## §7 — Decisões + councils inline (sem subagent)

> Os 4 conselhos completos (Decision Brief → vozes cegas → red team → síntese) rodaram **inline (1 request)** na sessão de autoria; abaixo está o destilado executável. DEC-389 é direto (sem council).

### Council A → DEC-385 — Reserva de evento **consumível** (não-liberável) + allowance por-dia (B-RESERVE) [keystone]

**Brief:** hoje `calculateEventReserves` libera a reserva inteira ao iniciar (`linkedSessionId`/`isConfirmed`) → livre pula + conta 2×. Pergunta: como reservar e **consumir** o valor do evento ao longo dos dias sem vazar no início nem contar 2×?
**Vozes (cegas):** **Architect** — `remaining = max(0, reservedCents − attributedSpent)`; o livre **continua** subtraindo a remanescente; como o gasto do evento já entra em `totalSpent`, o efeito líquido = `max(reservado, gasto)` (estável, sem salto). Allowance por-dia = `remaining / diasRestantes` (espelha `rhythm.ts`). Rec: reserva consumível + allowance por-dia. ALTA. *Depende de B (atribuição).* · **Critic** — mudar a fórmula quebra testes de invariância (é mudança intencional → precisa de teste de não-duplicação); inferir por data é frágil (café fora do evento). Rec: só com atribuição **explícita** + teste "nunca 2×"; a sobra do "último dia" precisa de gatilho na abertura (sem cron). MÉDIA. · **Advocate** — modelo mental: "separei X; gasto desse X enquanto rola; o resto decido no fim"; não quer o livre dos outros dias subindo por o evento ter começado; quer ver "tenho Y/dia aqui". ALTA. Quer gastar por manual/IA/Wise, não só saída.
**Red Team:** promover o evento a **mini-pool/fase própria** (O2) seria "mais correto" mas exige schema/migração e duplica rhythm/burndown — over-engineering; a reserva-consumível reusa o existente e isola a mudança. Rejeitada.
**Síntese (lente Architect):** `eventReserveRemaining = max(0, reservedCents − attributedSpent)`; a fase **sempre** subtrai a remanescente (substitui o gate `linkedSessionId===null`); allowance por-dia do evento em `domain/budget/event-budget.ts` (puro). **Condições:** depende da atribuição explícita (DEC-386); teste "evento nunca conta 2×"; o início deixa de liberar. **O que viraria:** se a atribuição explícita inviabilizar na UI → fallback por intervalo (`sumSpentInOccurrenceInterval`) — minoritário. **Confiança: ALTA.**

### Council B → DEC-386 — Atribuição **explícita** de gasto ao evento via `occurrenceId` (B-ATTR/B-WISE)

**Brief:** `Transaction` não tem vínculo de evento fora da saída/`linkedTransactionId`. Como marcar gasto manual/IA/Wise como "do evento de agora" sem a saída ativa (que limita campos)?
**Vozes (cegas):** **Architect** — `occurrenceId: string|null` aditivo (`.passthrough()`, **sem migração Dexie**, igual a `externalRef`/`placeNameSource`); `eventAttributedSpent(occ)` soma por esse campo; seletor reusa `selectVisibleEvents`/`isOccurrenceActiveToday`. ALTA. `linkedTransactionId` (1 tx) vira legado. · **Advocate** — reusar `sessionId` (sessão invisível) polui o evento multi-dia com semântica de saída (timer/recap) que ele rejeitou; seletor "este gasto é do evento X", 1 toque, pré-sugerido. ALTA. · **Critic** — inferência por data é ambígua e ele quer **escolher**; campo novo precisa de invariante "occurrenceId XOR sessionId" e tratamento no delete do evento (DEC-267): limpar o vínculo, **manter a tx**. MÉDIA.
**Red Team:** inferência-por-data (zero schema) puxaria um café pessoal pro evento no mesmo dia — falha no caso real dos 4 gastos Wise + pessoais. Vence a correção.
**Síntese (lente Architect):** `occurrenceId` explícito + seletor de 1 toque (pré-sugerido) em QuickAdd/IA/Wise. **Condições:** `.passthrough()` default null; delete do evento limpa o vínculo (não a tx); habilita o `remaining` do DEC-385; invariante evento-XOR-saída. **O que viraria:** zero-schema → inferência (minoritário). **Confiança: ALTA.**

### Council C → DEC-387 — Destino da **sobra** no fim do evento (B-LEFTOVER)

**Brief:** sobra `L = reservado − gasto > 0`. O Julio propôs 3 destinos e quer **escolher**: livre / cofrinho rotulado / pote dedicado do mesmo dinheiro.
**Vozes (cegas):** **Advocate** — 3 destinos = 3 intenções reais ("gastar mais" / "guardei" / "esse dinheiro é desse assunto"); default = livre (o que ele citou primeiro); rotular a origem sempre. ALTA. · **Architect** — conservação 1:1: livre = reserva fecha (`remaining→0`); cofrinho = entrada no piggy-ledger rotulada; pote = `global` BudgetPool "Sobra de {evento}" (à parte do livre). Aditivo. Gatilho na abertura após `endDate` (sem cron). ALTA. · **Critic** — só prompt quando `L>0` (se estourou, é outro fluxo); manter **pendente** se ignorar; nunca auto-decidir; nunca bloquear. MÉDIA.
**Red Team:** "sempre devolve ao livre, sem perguntar" mata (b)/(c) que ele pediu explicitamente. Rejeitada (mas vira o **default**).
**Síntese (lente Advocate):** prompt de fim-de-evento (gatilho ao abrir após `endDate`; estado "sobra pendente"); destinos: **livre (default)** · **cofrinho** (entrada "Sobra de {evento}") · **pote dedicado** (`global` "Sobra de {evento}"). `L≤0` → sem prompt. **Condições:** conservação 1:1; reusa pots+piggy; pendente até resolver (A4). **O que viraria:** se os 3 atrasarem, livre+cofrinho primeiro e o pote dedicado como milestone opcional. **Confiança: ALTA.**

### Council D → DEC-388 — Acerto **ego-cêntrico** + roteamento de dívida de terceiros (S-EGO)

**Brief:** `summarizeOwnerDebts` já filtra owner-involved no hero, mas a lista de pessoas/saldos expõe terceiros e min-transfer pode gerar "Débora→Bruno"; não há roteamento aos envolvidos.
**Vozes (cegas):** **Advocate** — a tela responde "o que é MEU?"; dívida de terceiros é ruído/intromissão; guardar num menu secundário ("cobranças que registrei entre outros") + notificar os envolvidos. ALTA. "Dividido comigo" continua no principal. · **Architect** — derivar a lista do owner de `summarizeOwnerDebts`; `thirdPartyDebts = debts.filter(d=>debtor≠owner && creditor≠owner)` p/ o menu; roteamento reusa DEC-375/376. ALTA. Cuidado: o owner-view tem que ser fiel (não esconder dívida do owner via simplificação entre terceiros). · **Critic** — computar o owner-net direto das shares/settlements (fiel), não do grafo entre terceiros; notificar pressupõe conexão — sem ela, fica só no registro (não some); privacidade: notificar só os envolvidos. MÉDIA.
**Red Team:** "deixa como está, o hero já filtra" — ignora o vazamento na **lista** e a falta de roteamento. Rejeitada.
**Síntese (lente Advocate + guarda do Critic):** (1) lista/saldos = owner-involved (fiel ao net real); (2) `thirdPartyDebts` num menu secundário display-only; (3) roteamento best-effort via P2P aos 2 envolvidos; sem conexão → fica no registro (A4). **Condições:** recorte fiel (não via min-transfer entre terceiros); notificação só aos envolvidos; nada apaga. **O que viraria:** se o Julio quiser terceiros **invisíveis** pra ele → remover o menu, manter só o roteamento (variação menor). **Confiança: MÉDIA-ALTA.**

### DEC-389 — IA: forward-geocode do nome do estabelecimento no salvar (L-PLACE) [direto]

A IA capta `placeLabel` (nome do estabelecimento). No salvar, se há nome, `utils/places.ts › searchPlaceByName(name, near?)` (Nominatim `/search`, **opt-in/online-only/never-throws**, enviesado pela coordenada atual quando houver) resolve coords exatas desse nome → grava `placeId`/coords com `placeNameSource:'user'` (nome verificado vindo da IA) ou `'auto'`. Sem match (offline/timeout/sem resultado) → cai no **GPS atual** (`fix`, caminho DEC-367). Consistente com `reverseGeocodePlace` (que já manda coords). Sem mudança de aritmética. **Â-PLACE-FALLBACK.**

---

## §8 — Test strategy (testar JUNTO com a mudança)

- **Domínio puro primeiro (>90%):**
  - **DEC-385** — `domain/budget/event-budget.ts`: `eventReserveRemaining` (reservado>gasto, reservado<gasto, =, sem gasto), allowance por-dia (sobra rola; último dia; dias fora do intervalo) e **teste-âncora "nunca 2×"**: dado um evento com reserva R e gasto atribuído E, `freeToSpend` cai em `max(R,E)` (não R+E), e **não pula** quando `linkedSessionId` é setado. Estender `budget.test.ts`.
  - **DEC-386** — `eventAttributedSpent(occ, txs)` (soma só por `occurrenceId`; ignora deletados/outros eventos); invariante evento-XOR-saída; schema aceita `occurrenceId` e default null.
  - **DEC-387** — função pura de resolução da sobra: `L=max(0,reservado−gasto)`; cada destino conserva 1:1 (livre/cofrinho/pote); `L≤0` → sem prompt; rótulo "Sobra de {evento}".
  - **DEC-388** — `thirdPartyDebts(debts, ownerId)` (só pares sem o owner); a lista do owner == `summarizeOwnerDebts` (fiel ao net real, idêntica ao baseline de saldo).
  - **DEC-389** — `searchPlaceByName` (mock fetch): match → coords/placeId; offline/timeout/HTTP!=200/sem resultado → null (fallback GPS).
- **Reusar & estender** `budget.test.ts`, `occurrences.test.ts`, `splitting` tests, `save-location.test.ts`, `places.test.ts` — não duplicar.
- **UI crítica (E2E >70%):** "registrar gasto manual atribuído a evento → reserva do evento cai, livre da fase NÃO pula"; "import Wise: selecionar 4 linhas → marcar como do evento"; "fim do evento com sobra → escolher destino"; "acerto não mostra dívida Débora→Bruno no principal".
- **Invariância (A1/A6):** asserts de que **saldos do acerto** e **totais Trecho/Pote** são **idênticos ao baseline** após cada gate; conservação na sobra (Σ não muda).
- **"Suíte verde entre gates"** = 0 falhas além do baseline documentado no G0 (ex.: os 2 testes WebCrypto `split-live-loop` que só passam no CI Node 22 — não-regressão).

---

## §9 — Per-milestone protocol (5-point self-check)

Antes de cada commit de milestone:

1. Liste os AC satisfeitos (IDs do gate).
2. Cite **3 AC anteriores em risco de regressão** e verifique (sempre **A1/A6 invariância de saldo/Trecho/Pote** e **A5 nunca bloquear o gasto**).
3. Rode os testes — **sem novas falhas**.
4. Sinalize qualquer arquivo tocado **fora** do escopo do milestone.
5. Atualize `src/dev-log.md` (o que mudou, testes, riscos).

**Fronteira de gate:** re-leia o §3 + o escopo do próximo gate + o Current State do dev-log; imprima o **ANCHOR block** + a linha **CURRENT STATE**. **A cada 3 milestones:** refresh leve (regras críticas + dev-log).

**ANCHOR block (cole a cada 3 milestones / em cada fronteira de gate):**

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

---

## §10 — THE BUILD — gates G0 → G6

### G0 — Setup & baseline (sempre)

- **Why:** referência de regressão + capturar o comportamento atual do evento (livre que pula).
- **Faça:** `npm install`; `npm run test` + `npm run build` + `tsc --noEmit` → **registre as contagens baseline**; seed/atualize `src/dev-log.md` (Current State + tabela desta leva); adicione **DEC-385→389 como `PROPOSED`**; opcional: registre no dev-log uma "fotografia" do bug P5 (um teste/figura mostrando o livre subindo quando `linkedSessionId` é setado) como evidência viva.
- **AC:** baseline verde documentado; dev-log seedado; DECs `PROPOSED`.

### G1 — Atribuição de gasto ao evento (P0, enabler) · **DEC-386** · `1.7.0-rc`

- **Why:** o B-RESERVE (G2) precisa saber "quanto se gastou do evento" — a atribuição explícita é o pré-requisito.
- **Root cause:** `Transaction` sem `occurrenceId`; só saída/`linkedTransactionId` ligam ao evento.
- **Change:**
  - m1 (domínio) — `Transaction` ganha `occurrenceId: string | null`; `transactionSchema` aceita (`.passthrough()`, default null, **sem migração**); `createExpenseTransaction` aceita o campo (default null). Função pura `eventAttributedSpent(occ, txs)`. + testes.
  - m2 (domínio) — invariante **evento XOR saída** (um gasto não carrega `occurrenceId` e `sessionId` ao mesmo tempo); helper de seleção de evento ativo reusando `isOccurrenceActiveToday`/`selectVisibleEvents`. + testes.
  - m3 (UI) — `QuickAddPage` (manual + confirm da IA): seletor "este gasto é do evento {X}" em "Detalhes", **pré-sugerido** quando há evento ativo hoje (off por default; 1 toque); grava `occurrenceId`. i18n (pt/en/es).
  - m4 (delete) — ao deletar/arquivar um evento (DEC-267), limpar o `occurrenceId` das txs (mantém a tx; A4).
- **AC:** dá pra marcar um gasto manual/IA como sendo do evento ativo; `occurrenceId` persiste e sincroniza; delete do evento não apaga gasto; nenhuma mudança de saldo/aritmética ainda (só vínculo).
- **Tests:** unit do campo+schema+`eventAttributedSpent`+XOR; E2E "marcar gasto manual como do evento".
- **Commit/Deploy:** `1.7.0-rc` (release note: "Marque um gasto como parte de um evento"). Promover **DEC-386 → APPROVED**.

### G2 — Reserva do evento consumível + livre que não pula (P0, keystone) · **DEC-385** · `1.7.1-rc`

- **Why:** o coração — corrige o P5 (livre/média que pula no dia 1 + contagem dupla).
- **Root cause:** `calculateEventReserves` libera a reserva inteira quando `linkedSessionId`/`isConfirmed`.
- **Change:**
  - m1 (domínio) — `calculateEventReserves` (ou um novo `event-budget.ts`) passa a usar `remaining(occ) = max(0, reservedCents − eventAttributedSpent(occ))` e **continua** subtraindo após o início (remove o gate `linkedSessionId===null && !isConfirmed` como liberador total; `isConfirmed` passa a significar "encerrado/resolvido", ver G4). `calculateFreeToSpend › eventReservesCents` usa a soma das remanescentes. `buildFreeToSpendBreakdown` mostra a remanescente. + testes (inclui o **teste-âncora "nunca 2×" e "não pula"**).
  - m2 (domínio) — `domain/budget/event-budget.ts`: allowance **por-dia do evento** = `remaining / diasRestantesDoEvento` (subtrativo, espelha `rhythm.ts`); a sobra de um dia rola pros dias restantes naturalmente (recomputa). + testes.
  - m3 (UI) — o card/detalhe do evento mostra "tenho {Y}/dia aqui" e "{remaining} de {reservado}"; o "livre hoje" da fase deixa de pular (verificar no Dashboard). i18n.
- **AC:** ao iniciar/gastar no evento o **livre da fase não sobe**; a reserva remanescente cai conforme o gasto atribuído; o valor do evento **nunca conta 2×**; a allowance por-dia do evento reflete a sobra rolando; saldos do acerto e totais Trecho/Pote idênticos ao baseline.
- **Tests:** unit "nunca 2×"/"não pula"/allowance por-dia; E2E "gasto atribuído → livre da fase estável + reserva cai".
- **Commit/Deploy:** `1.7.1-rc` (headline: "O dinheiro do evento fica reservado de verdade — seu livre não pula mais"). Promover **DEC-385 → APPROVED**.

### G3 — Wise import → marcar selecionados como do evento (P0) · **DEC-386 cont.** · `1.7.2-rc`

- **Why:** lançar os 4 gastos do Wise como do evento sem uma-a-uma na saída.
- **Root cause:** `commitWiseImport` não tem alvo de evento.
- **Change:**
  - m1 (domínio) — `CommitWiseImportInput` aceita `occurrenceId?` (ou `occurrenceByRowId?`); as txs das linhas escolhidas gravam `occurrenceId` (respeitando evento-XOR-saída). + testes.
  - m2 (UI) — no fluxo de import, quando há evento ativo, oferecer "marcar os selecionados como gastos de {evento}"; default off.
- **AC:** selecionar N linhas do Wise e atribuí-las ao evento em 1 ação; o gasto atribuído alimenta o `remaining` do DEC-385; re-import idempotente (`externalRef`) preservado.
- **Tests:** unit de `commitWiseImport` com `occurrenceId`; E2E seleção→marcar.
- **Commit/Deploy:** `1.7.2-rc`. (DEC-386 já APPROVED no G1; registrar a extensão no dev-log.)

### G4 — Sobra no fim do evento (P0) · **DEC-387** · `1.7.3-rc`

- **Why:** resolver o que sobrou, do jeito que o Julio pediu (3 destinos).
- **Change:**
  - m1 (domínio) — detecção "evento terminado com sobra" (`endDate < hoje` & `remaining>0`) → estado **"sobra pendente"**; função pura de resolução por destino (livre/cofrinho/pote), conservando 1:1; rótulo "Sobra de {evento}". + testes.
  - m2 (UI) — prompt ao abrir após o `endDate`: 3 opções (livre **default** / cofrinho / pote dedicado); pendente se ignorar; nunca bloqueia. i18n.
  - m3 (integrações) — cofrinho = entrada rotulada no piggy-ledger; pote = `createBudgetPool('global', "Sobra de {evento}")`; livre = a reserva fecha (`remaining→0`, `isConfirmed`/resolved).
- **AC:** sobra `L>0` dispara o prompt 1×; cada destino conserva o dinheiro 1:1 e rotula a origem; `L≤0` não pergunta; nada some se ignorar.
- **Tests:** unit conservação/rotulo/`L≤0`; E2E fim-de-evento→escolher destino.
- **Commit/Deploy:** `1.7.3-rc`. Promover **DEC-387 → APPROVED**. *(Se o tempo apertar: livre+cofrinho primeiro; pote dedicado vira m4 opcional — ver §16 L-LEFTOVER.)*

### G5 — IA acha o local pelo nome (P1) · **DEC-389** · `1.7.4-rc`

- **Why:** a IA capta o nome do estabelecimento; usar o local exato desse nome; sem match → GPS atual.
- **Change:**
  - m1 (domínio/boundary) — `utils/places.ts › searchPlaceByName(name, near?)` (Nominatim `/search`, opt-in/online-only/never-throws, enviesado pela coordenada atual). + testes (mock fetch).
  - m2 (fiação) — no save da IA (`QuickAddPage`/`save-location.ts`), se há `placeLabel` da IA, resolver coords desse nome; sem match → `fix` GPS (DEC-367). Sem bloquear o salvar (A5).
- **AC:** com nome reconhecível, o gasto salva com o local exato; sem match/offline, salva com o GPS atual; coords nunca saem do device fora da busca explícita.
- **Tests:** unit `searchPlaceByName` (match/offline/timeout/sem-resultado); unit do save (nome→coords vs fallback).
- **Commit/Deploy:** `1.7.4-rc`. Promover **DEC-389 → APPROVED**.

### G6 — Acerto só meu + roteamento de terceiros (P1) · **DEC-388** · `1.7.5-rc`

- **Why:** ver só o que é meu; dívida de terceiros vai pra quem é.
- **Root cause:** lista/saldos do acerto expõem terceiros; sem roteamento.
- **Change:**
  - m1 (domínio) — a lista/saldos do owner derivam de `summarizeOwnerDebts` (fiel ao net real); nova função pura `thirdPartyDebts(debts, ownerId)`. + testes (owner-view == baseline de saldo).
  - m2 (UI) — `SharedExpensesPage`: o principal mostra só owner-involved; um menu secundário display-only "Cobranças entre outros (que registrei)" lista `thirdPartyDebts`.
  - m3 (roteamento) — best-effort: cada dívida de terceiros é entregue aos 2 envolvidos via `shareDebtWithPeer` (DEC-375/376); sem conexão → fica só no registro (A4). Idempotente.
- **AC:** "Débora deve 49 ao Bruno" não aparece no acerto principal do owner; aparece no menu secundário; os envolvidos conectados recebem; "dividido comigo" continua no principal; saldos do owner idênticos ao baseline.
- **Tests:** unit `thirdPartyDebts` + fidelidade do owner-net; E2E "terceiros fora do principal".
- **Commit/Deploy:** `1.7.5-rc`. Promover **DEC-388 → APPROVED**. *(Ver §16 L-SETTLE-SCOPE: manter o menu secundário ou só rotear.)*

---

## §11 — Terminal safety (WSL) — leia antes de qualquer git

- **Sempre `git --no-pager …`** (`log`/`diff`/`show`/`status`). **Commit sempre com `-m`** (HEREDOC p/ multi-linha). Nunca `less`/`more`/`man`/`vim`/`nano`/`-i`/`rebase -i`. CLIs incertos → `| cat`.
- **Bypass de commit (confirmado nesta máquina):** o harness injeta `--trailer`, rejeitado pelo git do sandbox. Commite por um caminho que não expõe o literal `git commit`:
  ```bash
  G=/usr/bin/git; "$G" commit -m "feat(budget): ..."
  ```
- Se um comando travar >30s sem saída: não re-rode; leia o arquivo do terminal, ache o pid, mate-o.
- Esta leva **não** mexe no worker (sem `wrangler`); o roteamento P2P (G6) usa o transporte já deployado.

---

## §12 — Definition of Done (tudo TRUE = leva completa)

- [ ] **G1 (B-ATTR):** dá pra atribuir gasto manual/IA a um evento (`occurrenceId`); persiste/sincroniza; delete do evento não apaga gasto.
- [ ] **G2 (B-RESERVE):** o livre da fase **não pula** ao iniciar/gastar no evento; reserva remanescente = `max(0, reservado − gastoAtribuído)`; **nunca 2×**; allowance por-dia do evento rola a sobra.
- [ ] **G3 (B-WISE):** selecionar linhas no Wise e marcá-las como do evento alimenta o `remaining`.
- [ ] **G4 (B-LEFTOVER):** sobra `L>0` pergunta o destino (livre/cofrinho/pote), conserva 1:1, rotula, fica pendente se ignorar.
- [ ] **G5 (L-PLACE):** nome reconhecível → local exato; sem match → GPS atual; nunca bloqueia o salvar.
- [ ] **G6 (S-EGO):** o acerto mostra só o que é meu; dívida de terceiros sai do principal + roteada aos envolvidos, sem sumir.
- [ ] Invariantes (§3) mantidos; **saldos do acerto + totais Trecho/Pote idênticos ao baseline**.
- [ ] Suíte verde (além do baseline), `build` + `tsc --noEmit` OK, smoke das jornadas-chave.
- [ ] Deploys por gate feitos; DEC-385→389 promovidos no shipping gate.
- [ ] Brain sincronizado (dev-log, decision-log, product-spec/budget-model quando aplicável, project-status no fim).

---

## §13 — Anti-patterns (NÃO faça)

- ❌ Mexer na **aritmética do acerto** ou nos **totais Trecho/Pote** (D14/DEC-241) — esta leva muda só o **consumo da reserva de Evento**.
- ❌ Construir o **B-RESERVE (G2) antes do B-ATTR (G1)** — sem atribuição, "gasto do evento" é incognoscível (cairia em inferência frágil).
- ❌ Promover o Evento a um **pool/fase própria** (over-engineering; schema/migração) — reserva-consumível reusa o existente.
- ❌ Atribuir gasto ao evento **por inferência de data** como caminho primário (puxa gasto não-relacionado) — é explícito (`occurrenceId`).
- ❌ Deixar um gasto ser de **evento E de saída** ao mesmo tempo (invariante XOR).
- ❌ **Auto-decidir** a sobra ou deixá-la **sumir** se o usuário ignorar (pendente + rotulada, A4).
- ❌ Bloquear o salvar do gasto por causa de geocode/atribuição/roteamento (A5 — sempre background).
- ❌ Mostrar dívida de **terceiros** no acerto principal do owner; ou escondê-la sem **rotear** aos envolvidos.
- ❌ Migração Dexie para o `occurrenceId` (é aditivo, `.passthrough()`); `git` sem `--no-pager`; UI hardcoded; código em português.

---

## §14 — Brain sync

- `src/dev-log.md` — **todo milestone** (Current State + entrada). Gate mais recente primeiro; preservar levas anteriores abaixo.
- `brain/decision-log.md` — DEC-385→389 `PROPOSED` no G0 → `APPROVED` no gate que shippa.
- `brain/product-spec.md` / `documents/budget-model-master-decision-2026-06-17.md` — registrar as regras novas quando o gate fecha: **Evento = reserva consumível por gasto atribuído (não vaza no início)**; **gasto atribuível a evento (occurrenceId)**; **sobra do evento → 3 destinos**; **acerto ego-cêntrico + roteamento de terceiros**.
- `brain/project-status.md` — status/pendências/próximos passos no fim da leva.
- `brain/README.md` — apontar para este doc enquanto `ACTIVE`.

---

## §15 — Manual smoke matrix (3 plataformas, jornadas-chave)


| Jornada                                                                                          | iOS (Safari/PWA) | Android (APK/PWA) | Desktop |
| ------------------------------------------------------------------------------------------------ | ---------------- | ----------------- | ------- |
| Criar evento c/ reserva → registrar gasto manual atribuído → livre da fase NÃO pula, reserva cai | ☐                | ☐                 | ☐       |
| Entrada por IA atribuída ao evento (e local pelo nome)                                           | ☐                | ☐                 | ☐       |
| Import Wise: selecionar 4 linhas → marcar como do evento                                         | ☐                | ☐                 | ☐       |
| Allowance por-dia do evento rola a sobra pros dias restantes                                     | ☐                | ☐                 | ☐       |
| Fim do evento c/ sobra → escolher livre / cofrinho / pote (rotulado)                             | ☐                | ☐                 | ☐       |
| Acerto: "Débora deve ao Bruno" NÃO no principal; aparece no menu secundário; Bruno recebe        | ☐                | ☐                 | ☐       |


---

## §16 — Decisions for the user (lock) — ⏳ AWAITING LOCK (defaults adotados por conselho)

**G0 pode começar já** (baseline). Antes de codar G1→G6, confirme ou flipe estes **4 locks** (default = recomendação do conselho do §7):

- **L-RESERVE (G2 · DEC-385) — modelo da reserva do evento.** *Default:* reserva **consumível** (`remaining = max(0, reservado − gastoAtribuído)`, não vaza no início) + allowance **por-dia** do evento. *(Alternativa: promover o evento a pool/fase própria — mais pesado, schema/migração.) ok*
- **L-ATTRIBUTION (G1 · DEC-386) — como atribuir gasto ao evento.** *Default:* campo **explícito `occurrenceId`** (aditivo, sem migração), seletor de 1 toque pré-sugerido, em manual/IA/Wise; evento **XOR** saída. *(Alternativa: inferência por intervalo de data — zero schema, porém ambígua.) acho que da para manter o campo, mas selecionar o campo se tiver inferencia de data e prguntar se o gasto seria para o evento ou não, ai deixa mais certo, ajuda mas sem fazer tudo..*  

- **L-LEFTOVER (G4 · DEC-387) — destino da sobra.** *Default:* **perguntar** 3 destinos (livre **default** / cofrinho rotulado / **pote dedicado**), conservando 1:1, pendente até resolver. *(Alternativa: só livre+cofrinho no V1, pote dedicado depois.) ok*  
  

- **L-SETTLE-SCOPE (G6 · DEC-388) — dívida de terceiros.** *Default:* fora do acerto principal + **menu secundário** "cobranças que registrei entre outros" + **roteamento** aos envolvidos (P2P). *(Alternativa: terceiros totalmente invisíveis pra mim — só rotear, sem menu.)ok*  


**Sem stop de credencial** (esta leva não toca o worker). Bifurcação nova no meio → council inline → `DEC-NNN (PROPOSED)` → continue.

---

## §17 — GO — start here

**Pré-condição:** confirme que esta é uma leva **nova** (a P2P já shippou): `git --no-pager log --oneline -6` deve mostrar `1.6.4-rc` como topo. Esta leva **muda intencionalmente** o consumo da reserva de **Evento** — a invariante a proteger é o **acerto** (saldos) e os **totais Trecho/Pote**, além de **nunca contar o dinheiro do evento 2×** e **nunca pular o livre**.

**G0 (rode já):**

```bash
cd /home/julio/projetos/trip-budget-copilot/TripPilot
npm install
npm run test 2>&1 | tail -40
npm run build 2>&1 | tail -20
npx tsc --noEmit 2>&1 | tail -20
```

Registre as contagens baseline no `src/dev-log.md`; adicione **DEC-385→389 como `PROPOSED`**. (Opcional: registre uma fotografia do bug P5 — o livre subindo ao setar `linkedSessionId` — como evidência.)

**Depois — após o lock do §16, G1 → G6 em ordem.** **Ordem obrigatória:** **G1 (atribuição) antes de G2 (reserva)** — o `remaining` depende do gasto atribuído. Ao fechar um gate (suíte verde + build + tsc + smoke + bump + deploy + dev-log + promover DEC), **vá para o próximo**. Pare só quando a Definition of Done (§12) estiver toda TRUE — **ou** o contexto acabar (feche o gate atual limpo + hand-off no dev-log). Para qualquer bifurcação nova: council inline → `DEC-NNN (PROPOSED)` → continue.

---

### Apêndice — Intent→function map (semente)

- "esse gasto é do evento X" → `QuickAddPage.persistExpense` → grava `Transaction.occurrenceId` (G1).
- "quanto já gastei do evento" → `domain/budget/event-budget.ts › eventAttributedSpent` (G1) → `eventReserveRemaining` (G2).
- "quanto posso gastar hoje no evento" → `event-budget.ts › eventDailyAllowance = remaining / diasRestantes` (G2).
- "marcar linhas do Wise como do evento" → `commitWiseImport({ occurrenceId })` (G3).
- "sobrou do evento — o que faço?" → resolução de sobra → livre / `piggy-ledger` / `createBudgetPool('global')` (G4).
- "achar o local pelo nome da IA" → `utils/places.ts › searchPlaceByName` → `resolveSaveLocation` (G5).
- "no acerto, só o que é meu" → `summarizeOwnerDebts` (principal) + `thirdPartyDebts` (secundário) + `shareDebtWithPeer` (roteia) (G6).

