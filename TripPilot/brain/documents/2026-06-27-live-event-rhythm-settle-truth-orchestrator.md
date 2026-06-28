# Leva — "O Home conta a verdade": evento ao vivo + ritmo honesto + acerto só meu (parte 2)

> **Status: ✅ LOCKED** (os 4 locks originais do §16 decididos por Julio em 2026-06-27 = **todos os defaults**) · ⏳ **escopo em expansão** — batch **2b** adicionou **G6 (DEC-397, entrada por IA completável)** e **G7 (DEC-398, mapa do gasto fixo→expande)**; L-MAP é direto, L-AI-ENRICH tem 1 fork de escopo (default adotado). **G0 (baseline) pode rodar já; G1→G7 acionáveis assim que o escopo fechar.**
> **Version cadence:** app `1.7.5-rc → 1.8.x-rc` (um bump por gate; G1→G7 = `1.8.0` → `1.8.6-rc`).
> **Sibling waves:** `2026-06-27-event-budget-truth-orchestrator.md` (DEC-385→389, **shipped 1.7.0→1.7.5-rc**) — aquela leva criou a **reserva consumível** (`occurrenceId`, `eventReserveRemainingCents`, `eventDailyAllowanceCents`) e o **acerto ego-cêntrico** (lista principal). **Esta leva (parte 2) consome esse trabalho:** agora que a reserva é real, o Home precisa **mostrar** o evento ao vivo, o ritmo do dia de forma honesta, o cofrinho coerente com o ritmo, e estender o ego-cêntrico para a **lista de Pessoas** + fechar o **Wise geocode** e a **honestidade do copiloto**. Modelo de orçamento: `documents/budget-model-master-decision-2026-06-17.md` — esta leva **não** muda a aritmética do livre/Trecho/Pote/acerto (só **exibição** + a regra de **visibilidade** do evento ativo; e, **sob lock**, o **ideal diário do cofrinho**).

---

## §0 — Mission

**O que esta leva É:** fazer o Home **contar a verdade** depois que a leva anterior consertou a reserva do evento por baixo. Hoje a reserva do evento já é segurada e consumida corretamente (DEC-385), mas a tela **esconde** o evento no instante em que uma saída fica ativa, **não mostra** o progresso do evento ao vivo (gasto/restante/por-dia/dias restantes), **mistura** o ritmo de pico com a "média" de um jeito enganoso, mantém o **cofrinho num ritmo flat irreal**, ainda **vaza terceiros** na lista de Pessoas, **não** geocoda o local no import do Wise, e deixa o **copiloto tirar conclusão de uma única compra grande**.

**A dor central, nas palavras do Julio (review de campo 2026-06-27, em uso real no meio de um evento):**

> *"Estou no meio de um evento e fiz um gasto por fora da saída ativa, pelo gasto manual — funcionou, tirou da reserva (o detalhe do livre foi de 100 → 93 pras ocasiões), MAS não tenho nenhuma indicação na tela inicial de quanto o evento ainda tem. O que aparece é o card da saída ativa mostrando 0 gastos (porque não usei a saída). O evento que estou vivendo agora **parou de aparecer** — acho que sumiu porque já estou no meio dele; antes aparecia. Tem que aparecer enquanto o evento está acontecendo: quanto já gastei, com o quê, quando, quanto sobra e quanto sobra pros outros dias. (…) O 'livre para usar nessa fase' não mostra o valor do evento junto — só no detalhe (lá diz 53 = 27 livre + 25 do evento), fora diz 'dia de pico, livre até 27' sem citar o evento. E mistura: diz 'média diária até o fim da fase 32' sendo que tenho 18 dias e 327 livres → a média seria ~18, não 32. (…) O cofrinho sempre fala '8,72 do ritmo' como se fosse o ritmo de todo dia — mas o ritmo muda (hoje é pico, 27). O que sobra do livre do dia tinha que ir pro cofre comparado com o ritmo REAL do dia. (…) Festas de Burgos tinha 4 dias, ontem passou e não usei quase nada — devia refazer a conta: em vez de 25/dia, uns 34 pelos 3 dias que sobraram, e atualizar automático quando eu gasto. (…) No acerto: 'cobranças entre outros' está muito em cima — joga pra baixo. E em Pessoas ainda aparece 'Bruno recebe 122' e 'Débora deve 49 ao Bruno' — eu não quero saber disso aqui; essa tela é pra eu saber quem ME deve ou quanto EU devo. A informação de terceiros é importante mas em outro menu, fechadinha. (…) No copiloto, 'hora de pico 15h, 43%' e 'fim de semana custa X' — fiz UMA compra de 150 num horário, e ele tira conclusão disso; fica perdido. Pesquise e corrija com o conselho."*

**A descoberta que unifica (causa-raiz, confiança ALTA — verificada lendo o código 2026-06-27):** a leva anterior consertou o **dinheiro** (a reserva do evento é consumível), mas três guardas/escolhas de **exibição** deixaram o Home incoerente: (1) `domain/planning/occurrences.ts › isOccurrenceActiveToday` e `isEventVisibleOnHome` retornam **false** quando `linkedSessionId !== null` → ao abrir a saída, o evento **some** do Home (sobra só o card da saída, que conta 0 nos gastos manuais); (2) a "média até o fim da fase" usa o **peso de pico de hoje** (`avgDailyUntilEndCents = freeToSpend × todayWeight / effectiveDays`), inflando o número, e o cofrinho usa um **ideal diário linear flat** (`piggy-ledger.ts › linearDailyIdealCents`) que ignora o ritmo; e o **detalhe do dia** espalha a **reserva cheia** do evento (`allowance-map.ts › indexPlanByDay`, `reservedCents/totalDays`) por todos os dias em vez do **consumível/dias-restantes**; (3) a lista de **Pessoas** (`connections/people-view.ts › buildPeopleView`) usa **saldos do min-transfer** (`calculateParticipantBalances(debts)`), que roteia por terceiros → "Bruno recebe 122" inclui o que não é meu. Mais dois gaps pontuais: o **Wise import** (`import-orchestrators.ts › commitWiseImport`) **não** chama o `stampExpenseLocation` (G5 só fiou QuickAdd+IA); o **copiloto** (`copilot-insights.ts › summarizePeakHour`/`summarizeWeekdayPattern`) tem guarda de amostra fraca (≥3 despesas; ≥1 dia de cada) e é dominado por **uma** compra grande.

**O que esta leva NÃO é:** **não** muda a aritmética do **livre**, do **Trecho/Pote** (D14) nem do **acerto** (saldos/dívidas — DEC-241/345); a maioria dos itens é **exibição/clareza** + a **regra de visibilidade** do evento ativo. As **duas** mudanças com risco real são, **sob §16 lock**: (a) o **ideal diário do cofrinho** virar ciente do ritmo (toca o Model B ratificado, DEC-279/261), e (b) os **saldos de Pessoas** passarem a ser **net fiel par-a-par** owner↔pessoa (em vez do min-transfer) — o **total** do owner permanece idêntico ao baseline (provado por teste).

**Escopo adicional (review de campo 2026-06-27, parte 2b — "passar tudo pelo conselho"):** além do Home, dois itens de **entrada/edição de gasto** entraram na leva — **(K)** a **entrada por IA** cria gastos "crus": não dá pra completar info (fundo/evento/wallet) nem **repassar cada gasto** pela tela de gasto manual completa (e o batch de N gastos não tem edição/repasse por item); **(L)** o **mapa do gasto** (`ExpenseLocationMap`, Leaflet com `dragging` ligado) **engole a rolagem** da página ao tocar. Viram **G6** (DEC-397) e **G7** (DEC-398). Nenhum dos dois toca aritmética.

**O app, em uma linha:** TripPilot é um planejador de orçamento de viagem local-first (PWA + APK) que registra gastos, divide contas e faz acerto entre pessoas — conectadas (P2P E2E) ou por link.

→ Para começar, vá ao **§17**.

---

## §1 — Identity & autonomy contract (você é o executor)

Você é um(a) engenheiro(a) full-stack sênior aplicando esta leva **sozinho(a), nesta sessão, de ponta a ponta**: investiga (re-lendo o arquivo do §6 antes de editar), codifica **domínio→UI**, testa junto, commita por item, e **no fim de cada gate**: suíte verde + `build` + `tsc --noEmit` + smoke + bump de versão + **deploy** (push master → Pages auto-build) + dev-log + promover DECs. As 9 regras do §1 do SKILL valem como **absolutas** (sem subagent; tudo inline nesta sessão; não pedir permissão entre work units depois do lock; minimizar prosa; reusar o que existe; código em inglês, UI via `t()`; domínio antes de UI; `git --no-pager` + commit por `G=/usr/bin/git`; hand-off final só num stop genuíno). Bifurcação nova → council inline (1 request) → `DEC-NNN (PROPOSED)` → continue.

---

## §2 — Reading order (carregue contexto UMA vez)

1. Este doc **§0–§9** (uma vez).
2. `TripPilot/src/dev-log.md` (Current State — a leva-irmã acabou de shippar `1.7.5-rc`).
3. Só as DECs citadas: **DEC-385→389** (reserva consumível/atribuição/sobra/geocode IA/acerto ego — base desta parte 2) · **DEC-072** (Evento) · **DEC-088/168/239** (livre do dia, breakdown base+pico) · **DEC-261/279** (cofrinho buffer/ledger — Model B, C14) · **DEC-177/178/183/184 + B10** (copiloto cross-cuts) · **DEC-357/359** (a UNA view de Pessoas) · **DEC-200** (Wise import) · **DEC-367** (location) · **DEC-246/389** (entrada por IA, draft/handoff) · **DEC-368** (mapa do gasto, Leaflet) · novos **DEC-390→398** (§7).
4. Entidades: `PlannedOccurrence`, `Transaction.occurrenceId`, `BudgetPool`, `ParticipantShare`, `Settlement`, piggy-ledger.

**Não re-leia o brain inteiro por milestone.** Re-leia o **arquivo do §6** do item antes de editar (símbolos se movem).

---

## §3 — Non-negotiables (ÂNCORA) — quebrar uma é defeito mesmo com teste verde

**Herdadas (app-wide):**

- **A1** Dinheiro = inteiro em centavos; a **aritmética do livre, do Trecho/Pote (D14) e do ACERTO (saldos/dívidas — DEC-241/345)** é **INVARIANTE** nesta leva.
- **A2** Domínio = TS puro, zero React; lógica fora de componentes/transporte.
- **A3** Texto de UI sempre via `t()` (pt/en/es); **código/identificadores/commits em inglês**.
- **A4** Hide-never-delete (tombstone); nunca apagar ação/feature/gasto/informação (terceiros vão pro registro, não somem).
- **A5** **Nunca bloquear o registro de gasto** — geocode/atribuição são best-effort em background; salvar/importar retorna na hora.
- **A6** Invariância de dados: ninguém perde gasto/saldo por causa desta leva; o **total** do owner no acerto é idêntico ao baseline.

**Novas desta leva:**

- **Â-LIVE-EVENT** — um evento que está **acontecendo** (hoje dentro do intervalo, não confirmado) **continua visível** no Home com **progresso real** (gasto atribuído + restante consumível + por-dia-restante + dias restantes), **mesmo com uma saída ativa**; nunca some por ter começado. O card da saída e o bloco do evento **coexistem** sem dupla contagem (o "consumido do evento" é a verdade; o total da saída ⊂ dele).
- **Â-HONEST-DAY** — o "livre do dia" é **honesto**: o detalhe lidera com a **base do dia comum**, mostra o **delta de pico** explícito e o **evento** explícito; a palavra "média" só rotula um número que **é** uma média (até o fim da fase = `livre / dias de calendário restantes`). Nenhum número rotulado engana.
- **Â-PIGGY-RHYTHM** *(sob lock L-PIGGY)* — o cofrinho mede o que sobrou contra a **allowance REAL do dia** (ciente do ritmo de pico e dos eventos), não contra um flat `orçamento/dias`; a soma dos ideais diários ao longo da fase **conserva** o orçamento (reconciliação C14 re-derivada).
- **Â-EGO-PEOPLE** — a tela de **Pessoas** mostra **só o que é MEU**: saldo e detalhe por pessoa = **net fiel par-a-par** owner↔pessoa (não o min-transfer entre terceiros); o **total** do owner é idêntico ao baseline (A6). Cobrança entre terceiros que eu registrei vai pra um **registro colapsado**, sem sumir (A4).
- **Â-PLACE-PARITY** — o Wise import resolve o local pela descrição com o **mesmo** caminho best-effort do QuickAdd/IA (`stampExpenseLocation`, DEC-389): opt-in/online-only/never-throws, fallback GPS; nunca bloqueia o import (A5).
- **Â-COPILOT-HONESTY** — um insight do copiloto só afirma um padrão quando há **amostra real**; uma **única** transação não pode virar "hora de pico/dia caro"; quando 1 compra domina a métrica, o card **se cala** ou mostra a ressalva "com base em N compras".

---

## §4 — Baseline: o que JÁ existe (reusar, não reinventar)

Confirmado lendo o código (2026-06-27):

| Peça que já existe | Arquivo → símbolo | Como reusar nesta leva |
| --- | --- | --- |
| Reserva consumível + por-dia (DEC-385) | `domain/budget/event-budget.ts › eventConsumedSpentCents`, `eventReserveRemainingCents`, `eventDailyAllowanceCents`; `eventHasEnded` | **G1** alimenta o VM de progresso do evento ao vivo; **G2** usa `eventDailyAllowanceCents` no detalhe do dia (em vez do flat). |
| Visibilidade do evento no Home (DEC-072) | `domain/planning/occurrences.ts › isOccurrenceActiveToday` (L58), `isEventVisibleOnHome` (L104), `selectVisibleEvents` (L135), `isWithinOccurrenceInterval` (L46) | **G1** adiciona um seletor irmão `selectActiveEventsInProgress` que **não** exclui `linkedSessionId` (só intervalo + kind + não-confirmado); os existentes seguem para o heads-up de eventos futuros. |
| Atribuição de gasto ao evento (DEC-386) | `domain/planning/occurrences.ts › selectAttributableEvents` (já decoupla a saída); `Transaction.occurrenceId` | **G1** o "consumido do evento" já existe via `occurrenceId`; o bloco ao vivo lista esses gastos (com o quê/quando/quanto). |
| Card de evento + saída ativa no Home | `features/dashboard/DashboardCards.tsx › renderDashboardCard('today_events')` (L449), card da saída ativa; `useDashboardModel.ts › todayEvents` (VM enriquecido) | **G1** estende o VM para eventos-em-progresso e renderiza o bloco ao vivo coexistindo com a saída. |
| Livre do dia (base + pico) | `domain/phases/rhythm.ts › calculateTodayFreeBudget` (`avgDailyUntilEndCents`, `isPeakDay`, `getDaySpendingWeight`); `allowance-map.ts › normalAllowanceCents`/`indexPlanByDay` | **G2** adiciona a média **plana** + relabel; o detalhe lidera com `normalAllowanceCents` (base) + delta de pico + evento; corrige o flat do evento. |
| Render do livre/hero + detalhe do dia | `DashboardCards.tsx` (hero L740-803: `free_per_day`/`peak_day_free`/`avg_daily_until_end`); detalhe do dia (sheet) | **G2** acrescenta a linha do evento de hoje no hero e o breakdown base+pico+evento no detalhe. |
| Cofrinho (buffer + ledger, DEC-279/261) | `domain/budget/piggy-ledger.ts › linearDailyIdealCents`, `buildPiggyLedger`; reconciliação C14 | **G3** (lock) troca o ideal flat por um ideal **por-dia ciente do ritmo** (mesmos pesos do `rhythm.ts`), excluindo dias com reserva de evento; re-deriva o invariante. |
| A UNA view de Pessoas (DEC-357/359) | `domain/connections/people-view.ts › buildPeopleView(participants, balances, peerLinks)` | **G4** alimenta `balances` com **net fiel par-a-par** owner↔pessoa (novo puro), não o min-transfer. |
| Acerto ego-cêntrico (DEC-388) | `domain/splitting/splitting.ts › ownerInvolvedDebts`, `thirdPartyDebts`, `summarizeOwnerDebts`, `calculateParticipantBalances`, `buildParticipantStatement`; `features/shared/SharedExpensesPage.tsx` (registro de terceiros `order-[25]`) | **G4** novo puro `ownerPairwiseBalances`/statement filtrado owner-involved; **move** o registro de terceiros pra baixo/colapsado; `calculateDebts`/`summarizeOwnerDebts` **intocados**. |
| Geocode no salvar (DEC-389) | `features/location/stamp-expense-location.ts › stampExpenseLocation`; `utils/places.ts › searchPlaceByName` | **G5** chama `stampExpenseLocation` no commit do Wise (best-effort, por linha com descrição). |
| Wise import | `domain/orchestrators/import-orchestrators.ts › commitWiseImport`; `features/import/WiseImportPage.tsx` | **G5** após o commit, dispara o stamp best-effort das txs importadas com descrição. |
| Copiloto cross-cuts (DEC-177/183/184/B10) | `domain/copilot/copilot-insights.ts › summarizePeakHour` (L394), `summarizeWeekdayPattern` (L230); `pattern-reading.ts` (tom) | **G5** adiciona guardas de amostra/dominância (1 tx ≥ X% → cala/ressalva), espelhando o `MIN_SAMPLES` que os insights do dashboard já usam. |

**GAP confirmado:** o evento ativo **some** do Home ao iniciar a saída (`linkedSessionId` em `isOccurrenceActiveToday`/`isEventVisibleOnHome`); **não há** bloco de progresso do evento ao vivo; a "média até o fim" é **ponderada por pico** (não é média); o **detalhe do dia** espalha a reserva **cheia** do evento (não o consumível/dias-restantes); o cofrinho usa **ideal flat**; Pessoas usa **saldos do min-transfer** (vaza terceiros); o **Wise não geocoda**; o copiloto **não** guarda contra 1 compra dominante.

---

## §5 — Change-set normalizado (do briefing → itens)

**P0 — Evento ao vivo (o que mais dói):**

- **E-LIVE** — enquanto um evento acontece, o Home mostra um **bloco de progresso** (gasto atribuído com o quê/quando · restante consumível · por-dia-restante · dias restantes), **mesmo com saída ativa**; deixa de sumir. → **G1** (DEC-390).
- **E-DETAIL** — no detalhe do dia, a allowance do evento é **consumível por dias restantes** (recompõe quando gasto), não a reserva cheia flat. → **G2** (DEC-391).

**P1 — Dia & ritmo honestos:**

- **D-HONEST** — o detalhe do "livre do dia" lidera com a **base do dia comum** + **delta de pico** explícito + **evento** explícito; a "média até o fim" vira uma **média de verdade** (ou relabel do peso de hoje); o **evento de hoje** aparece no resumo do livre (hero). → **G2** (DEC-392).
- **P-RHYTHM** — o cofrinho mede o sobrado contra a **allowance real do dia** (ritmo/eventos), não o flat `8,72`. → **G3** (DEC-393, lock).
- **S-EGO-PEOPLE** — Pessoas mostra só owner↔pessoa (net fiel par-a-par); "cobranças entre outros" desce/colapsa; detalhe de terceiros sob demanda. → **G4** (DEC-394).

**P2 — Fechar gaps:**

- **W-PLACE** — o Wise import resolve o local pela descrição (paridade DEC-389). → **G5** (DEC-395).
- **C-HONEST** — o copiloto guarda contra 1 compra dominante (hora de pico, dia da semana). → **G5** (DEC-396).

**P1 — Entrada & edição de gasto (parte 2b):**

- **K-AI-ENRICH** — a entrada por IA permite completar o essencial (fundo/evento/wallet) no sheet **e** repassar cada gasto (incl. no batch) pela tela de gasto manual completa; paridade nos demais pontos de IA. → **G6** (DEC-397).
- **L-MAP-FIXED** — o mapa do gasto fica fixo (não prende a rolagem); ao tocar, expande pra mover/zoom. → **G7** (DEC-398).

---

## §6 — Root-cause map (código ↔ mudança) — RE-LEIA o arquivo antes de editar

| # | Sintoma (palavras do Julio) | Causa-raiz — arquivo → símbolo (exato) | Direção do fix | Gate |
| --- | --- | --- | --- | --- |
| E-LIVE | "o evento que estou vivendo parou de aparecer; só vejo o card da saída ativa com 0 gastos" | `domain/planning/occurrences.ts › isOccurrenceActiveToday` (L58-61) e `isEventVisibleOnHome` (L110-111) retornam **false** se `linkedSessionId !== null` → `useDashboardModel.todayEvents` perde o evento ao abrir a saída; o card da saída mostra só o total da sessão (0 nos gastos manuais) | novo puro `selectActiveEventsInProgress(occurrences, todayIso)` = kind 'event', não-confirmado, **dentro do intervalo, independente de `linkedSessionId`**; VM de progresso (consumido via `eventConsumedSpentCents` + lista de txs do `occurrenceId`, restante via `eventReserveRemainingCents`, por-dia via `eventDailyAllowanceCents`, dias restantes); bloco "Evento acontecendo" no Home coexistindo com a saída (sem dupla contagem) | **G1** |
| E-DETAIL | "Festas tinha 4 dias, ontem passou e não usei — devia ser ~34 pelos 3 dias que sobraram, e atualizar quando eu gasto" | `domain/phases/allowance-map.ts › indexPlanByDay` espalha `occurrenceReserve = reservedCents / totalDays` (flat por TODOS os dias), ignora consumo e dias restantes | usar `eventDailyAllowanceCents(occ, txs, todayIso)` (consumível / dias restantes) por dia do intervalo a partir de hoje; recomputa ao gastar | **G2** |
| D-HONEST (média) | "média diária até o fim 32, mas tenho 18 dias e 327 livres → seria ~18" | `domain/phases/rhythm.ts › calculateTodayFreeBudget › avgDailyUntilEndCents` = `freeToSpend × todayWeight / effectiveDays` (ponderado por pico); render em `DashboardCards.tsx` L796 `dashboard.avg_daily_until_end` | adicionar `avgUntilEndFlatCents = freeToSpend / diasDeCalendárioRestantes` (média verdadeira); relabel a linha ponderada como "ritmo de hoje" (i18n) — ver §16 L-AVERAGE | **G2** |
| D-HONEST (detalhe) | "no detalhe diz 'livre 27 / dia de pico +13 / festas +25' — devia dizer a base do dia comum primeiro" | detalhe do dia usa o livre já-pondera­do; `allowance-map.ts › normalAllowanceCents` (base do dia comum) existe mas não lidera o texto | o detalhe lidera com **base do dia comum** + **delta de pico** explícito + **evento** explícito (reusa `normalAllowanceCents` + peso); i18n | **G2** |
| D-HONEST (hero) | "o 'livre nessa fase' não cita o evento; só no detalhe (53 = 27 + 25)" | `DashboardCards.tsx` hero (L756-803) mostra `free_per_day`/`peak_day_free` mas não a parcela do **evento de hoje** | surfaçar "+{evento hoje} do evento" no resumo do livre (reusa o `eventDailyAllowanceCents` do dia); i18n | **G2** |
| P-RHYTHM | "o cofrinho fala 8,72 todo dia como se fosse o ritmo de todo dia, mas hoje é pico (27)" | `domain/budget/piggy-ledger.ts › linearDailyIdealCents` = `phaseBudget / totalDays` (flat); `buildPiggyLedger` replay vs esse ideal constante | ideal **por-dia ciente do ritmo** (mesmos pesos `getDaySpendingWeight`, Σ = orçamento), excluindo dias com reserva de evento (têm envelope próprio); re-derivar a reconciliação C14 + testes — ver §16 L-PIGGY | **G3** |
| S-EGO-PEOPLE | "Bruno recebe 122 / Débora deve 49 ao Bruno aparece em Pessoas — não quero saber disso aqui; é pra eu ver quem ME deve" | `domain/connections/people-view.ts › buildPeopleView(…, balances, …)` recebe `balances` do **min-transfer** (`calculateParticipantBalances(debtSummary.debts)`) → roteia por terceiros; `buildParticipantStatement` mostra linhas de terceiros; registro em `SharedExpensesPage` está alto (`order-[25]`) | novo puro `ownerPairwiseBalances(ownerId, shares, settlements, participants)` (net fiel owner↔pessoa) → alimenta `buildPeopleView`; statement por pessoa filtra owner-involved; **mover** o registro de terceiros pra baixo/colapsado; `calculateDebts`/`summarizeOwnerDebts` intocados (total do owner == baseline) — ver §16 L-PEOPLE | **G4** |
| W-PLACE | "o import do Wise não pega a descrição do local pra achar no mapa" | `domain/orchestrators/import-orchestrators.ts › commitWiseImport` grava as txs sem location; `stampExpenseLocation` (DEC-389) só é chamado no QuickAdd/IA | após o commit, disparar `stampExpenseLocation` best-effort para cada tx importada com descrição/`placeLabel` (forward-geocode + fallback GPS); nunca bloqueia o import (A5) | **G5** |
| C-HONEST | "fiz UMA compra de 150 e ele diz 'hora de pico 15h 43%' / 'fim de semana caro' — fica perdido" | `domain/copilot/copilot-insights.ts › summarizePeakHour` (L394: guarda só `expenseCount < 3`) e `summarizeWeekdayPattern` (L230: ≥1 dia de cada) — uma compra grande domina o bucket | guarda de **dominância** (se 1 tx ≥ ~60% do total da métrica → null) + **mín. de dias distintos** (≥3 dias com gasto p/ hora de pico; ≥2 de cada lado p/ semana); ou ressalva "com base em N compras"; espelha os `MIN_SAMPLES` dos insights do dashboard | **G5** |
| K-AI-ENRICH | "a entrada por IA só cria os gastos; não dá pra definir fundo/evento/nada, nem repassar cada gasto pela tela de gasto manual completa" | `features/assistant/useAssistant.ts`: `patchDraft` edita poucos campos; `openFullEditor` só p/ **gasto único** (e auto só em foreign); `confirmBatch` **sem** edição/repasse por item; `assistant-quickadd-draft.ts › expenseOpToQuickAddDraft` **não** carrega `occurrenceId` (perde o evento). Idem nos outros pontos de IA (group-split, plano, recibo) | (c) expor no sheet os campos essenciais (fundo/evento/wallet via `patchDraft`) **+** "abrir no editor completo" **por item** (handoff QuickAdd carregando `occurrenceId`, válido no batch); auditar os demais pontos de IA e dar paridade; confirm 1-toque nunca bloqueia (A5) | **G6** |
| L-MAP-FIXED | "o mapa do gasto engole a rolagem; quero ele fixo e, ao tocar, expandir pra mover/zoom" | `features/location/ExpenseLocationMap.tsx`: `L.map` com `dragging`/`touchZoom` **default ligados** (só `scrollWheelZoom:false`) → o mapa inline captura o pan do dedo e prende a rolagem | inline = preview **não-interativo** (desliga drag/zoom/tap) que não prende a rolagem; **toque → expande** num mapa interativo (bottom-sheet/fullscreen) com drag/zoom; mesmo componente + flag `interactive` | **G7** |

---

## §7 — Decisões + councils inline (sem subagent)

> Os councils completos (Decision Brief → vozes cegas → red team → síntese) rodaram **inline (1 request)** na sessão de autoria; abaixo está o destilado executável. DEC-391 e DEC-395 são diretos (bug/paridade, sem fork real).

### Council A → DEC-390 — Evento **ao vivo** continua visível com progresso (E-LIVE)

**Brief:** com a reserva consumível (DEC-385), um evento que acontece tem dados de progresso reais (consumido via `occurrenceId`, restante, por-dia). Mas `isOccurrenceActiveToday`/`isEventVisibleOnHome` excluem `linkedSessionId !== null` → ao abrir a saída, o evento some do Home; o card da saída mostra só o total da sessão (0 nos gastos manuais). Como mostrar "como vai meu evento?" sem poluir o topo (a saída já está lá)? *Chat-lean a resistir: "junta tudo num card só" pode embolar.*
**Vozes (cegas):** **Advocate** — o Home tem que responder, num relance: gastei X (com o quê/quando), sobra Y, por-dia Z, faltam N dias. A saída é a contagem ao vivo da sessão; o evento é o envelope. Mantê-los distintos e adjacentes. Rec: **bloco "Evento acontecendo" dedicado**, sempre visível enquanto ativo. ALTA. *Outros perdem:* manual/Wise/IA não passam pela saída — o progresso não pode morar só no card da saída. · **Architect** — não sobrecarregar `isOccurrenceActiveToday` (é a regra "sem sessão" usada noutros lugares). Novo seletor `selectActiveEventsInProgress` (intervalo + kind + não-confirmado, **ignora `linkedSessionId`**) + VM de progresso reusando as funções do `event-budget.ts`. ALTA. *Outros perdem:* quando há saída ligada, o botão "Começar agora" do day-card vira "Abrir saída" (deep-link), sem duplicar. · **Critic** — risco de 2 cards confundirem; relacioná-los visualmente ("Saída de {evento}") e evitar dupla contagem na exibição: o **consumido do evento** (que já inclui o gasto atribuído + o da saída) é a verdade; o card da saída fica como o tally ao vivo. MÉDIA.
**Red Team:** "só conserta o card da saída pra mostrar o restante do evento" — falha: um evento pode estar ativo **sem** saída (gastos manuais), então o progresso não pode viver dentro da saída. Rejeitada.
**Síntese (lente Advocate + guarda do Architect):** novo seletor + **bloco de progresso do evento** sempre que houver evento ativo (com ou sem saída); reusa as funções do `event-budget.ts`; com saída ligada, o bloco aponta pra ela e o card da saída segue como tally; sem dupla contagem (o consumido do evento é a fonte). **Condições:** relacionar visualmente; lista de gastos do evento (o quê/quando) via `occurrenceId`. **O que viraria:** se 2 superfícies ficarem ruidosas → card **combinado** evento+saída (L-LIVE alternativa b). **Confiança: ALTA.**

### DEC-391 — Allowance do evento no **detalhe do dia** = consumível/dias-restantes (E-DETAIL) [direto]

`allowance-map.ts › indexPlanByDay` espalha a reserva **cheia** (`reservedCents/totalDays`) por todos os dias. Trocar pela allowance **consumível** do evento (`eventDailyAllowanceCents` = `remaining / diasRestantes` a partir de hoje), que **recompõe** quando se gasta (Festas: 100 reservado, ~5 gasto, 3 dias restantes → ~31/dia, não 25). Mesma fonte que o day-card já usa (DEC-385) — só estende ao mapa do detalhe. Sem mudança de aritmética do livre. **Bug fix; sem fork.**

### Council B → DEC-392 — "Livre do dia" honesto: base + pico + evento, e média de verdade (D-HONEST)

**Brief:** (1) a "média até o fim" usa o peso de pico de hoje → 32 em vez de ~18 (327/18); (2) o detalhe diz "livre 27 / dia de pico +13 / festas +25" sem liderar pela **base do dia comum**; (3) o evento de hoje não aparece no resumo do livre, só no detalhe. *Chat-lean a resistir: "é só renomear" — mas ele espera ver ~18 de verdade.*
**Vozes (cegas):** **Advocate** — um número rotulado "média" tem que **ser** média (livre/dias = ~18). O peso de pico é outra coisa ("hoje você pode até X"). O detalhe lidera com a base (€13), depois "+pico €13", depois "+evento €25". O evento de hoje aparece no hero, não só no detalhe. ALTA. · **Architect** — `normalAllowanceCents` (base do dia comum) já existe; média plana verdadeira = `freeToSpend / diasDeCalendárioRestantes`. Adicionar `avgUntilEndFlatCents` distinto do peso; relabel o ponderado. Pro evento no hero, reusar o `eventDailyAllowanceCents` do dia. Baixo risco (exibição/labels). ALTA. · **Critic** — mudar um número rotulado confunde quem voltou; manter os dois mas rotular com precisão ("ritmo de hoje" vs "média até o fim"); **não** mexer na matemática do livre do hero. MÉDIA.
**Red Team:** "só relabel, sem média plana" — ignora que ele espera explicitamente ~18; a média plana é a âncora honesta. Rejeitada (relabel sozinho vira a alternativa do lock).
**Síntese (lente Advocate + guarda do Critic):** relabel a linha ponderada como **"ritmo de hoje"** E adicionar uma **média plana verdadeira** ("média até o fim", calendário); o detalhe lidera com **base + delta de pico + evento**; o hero surfaça a parcela do **evento de hoje**. Invariância: a matemática do livre do hero intocada. **O que viraria:** se preferir simplicidade → só a média plana (sem manter o ritmo), L-AVERAGE alt. **Confiança: ALTA.**

### Council C → DEC-393 — Cofrinho **ciente do ritmo** (P-RHYTHM) [keystone de risco · lock]

**Brief:** o ledger do cofrinho compara o gasto do dia contra um **ideal constante** (`linearDailyIdealCents` = orçamento/dias ≈ 8,72), ignorando o pico e os eventos. O histórico diz "gastou X de 8,72" todo dia. O Julio quer que o ideal seja a **allowance REAL do dia** (pico maior) e que a sobra do dia deposite contra essa allowance. O Model B (DEC-279/261) usou de propósito um ideal constante por **path-independence/reconciliação**. *Chat-lean a resistir: "ele tem razão, muda logo" — mas há um invariante ratificado.*
**Vozes (cegas):** **Advocate** — o cofrinho tem que significar "o que poupei vs o que eu PODIA gastar naquele dia". Um ideal flat num dia de pico subestima a allowance e reporta o depósito errado. Usar a allowance ponderada do dia como ideal. ALTA. · **Architect** — viável: trocar o ideal constante por uma **série de ideais por-dia** dos mesmos pesos (`getDaySpendingWeight`), normalizada para Σ = orçamento; **excluir** dias com reserva de evento (têm envelope próprio, senão conta 2×). Manter o replay path-dependente do Model B (`max(0, bal + ideal − spent)`). O invariante C14 de reconciliação precisa ser **re-derivado** contra a série por-dia. MÉDIA — toca um modelo ratificado + testes. *Outros perdem:* o ideal do cofrinho tem que usar a **mesma base** (trueFree) do hero, senão dois "ideais" divergem. · **Critic** — é a mudança mais arriscada (Model B + invariante + testes). Um ideal por-dia torna o ledger path- **e** ritmo-dependente; garantir que Σ ideais ao longo dos dias decorridos ainda reconcilia e que o saldo não pode ser "gamed". Precisa de teste forte. Recomendo **§16 LOCK**. MÉDIA.
**Red Team:** manter o flat e só **consertar a CÓPIA** ("8,72 é a média da viagem; hoje você tem 27 disponível"). Mais barato, zero risco de modelo. Forte: talvez a dor seja a cópia enganosa, não a matemática.
**Síntese:** dois caminhos viáveis — **(A)** adotar o ideal por-dia ciente do ritmo (mais verdadeiro, mais arriscado, muda Model B + testes) ou **(B)** manter o flat e tornar a cópia honesta (barato, sem risco). **Lente que pesa aqui:** se queremos o cofrinho refletindo o ritmo que o resto do app já usa → (A); se queremos zero risco de modelo → (B). **Recomendação:** (A) com um teste de reconciliação forte, **mas vira o §16 L-PIGGY** (decisão do Julio). **O que viraria:** sinais de instabilidade na reconciliação → cair pra (B) no V1 e agendar (A). **Confiança: MÉDIA.**

### Council D → DEC-394 — Acerto "Pessoas" **ego-cêntrico** (S-EGO-PEOPLE)

**Brief:** o G6 (DEC-388) deixou a **lista** principal ego-cêntrica, mas a tela de **Pessoas** + saldos ainda usa min-transfer (`buildPeopleView(calculateParticipantBalances(debts))`) → "Bruno recebe 122" inclui terceiros, e abrir uma pessoa mostra linhas de terceiros. O registro de "cobranças entre outros" está alto. O Julio quer Pessoas só owner↔pessoa, registro embaixo/colapsado (detalhe de terceiros sob demanda, sem sumir). *Chat-lean a resistir: "filtra o min-transfer e pronto".*
**Vozes (cegas):** **Advocate** — Pessoas responde "o que há entre EU e ESTA pessoa?" — só owner↔pessoa. Terceiros (Débora↔Bruno) no registro, não na linha do Bruno. Mover o registro pra baixo. ALTA. · **Architect** — computar o **net par-a-par owner-involved** direto das shares+settlements (fiel), não do min-transfer (que roteia por terceiros e pode esconder/inflar o número de uma pessoa). Novo puro `ownerPairwiseBalances(ownerId, shares, settlements, participants)` → alimenta `buildPeopleView`; statement por pessoa filtra owner-involved. `calculateDebts` intocado (views de grupo noutros lugares não mudam). ALTA. *Outros perdem:* o hero "te devem/você deve" já usa `summarizeOwnerDebts` (net correto); trocar Pessoas para par-a-par mantém **cada pessoa** fiel e o **total** do owner idêntico ao baseline. · **Critic** — par-a-par fiel pode mostrar MAIS relações que o min-transfer (devo à Débora E o Bruno me deve, mesmo com net 0 entre eles) — é o ponto (honesto), mas garantir que o **total** do owner reconcilia com o baseline. Testar. MÉDIA.
**Red Team:** só filtrar os saldos do min-transfer para owner-involved (mais barato). Contra: o min-transfer pode rotear a dívida do owner por um terceiro → o número de uma pessoa ficaria errado/ausente; o par-a-par fiel é necessário pra correção. Rejeitada.
**Síntese (lente Architect):** `ownerPairwiseBalances` fiel alimenta os saldos + statement de Pessoas; registro de terceiros movido pra baixo/colapsado; `calculateDebts`/`summarizeOwnerDebts` intocados; total do owner == baseline (testado). Estende a DEC-388. **O que viraria:** se o par-a-par mostrar relações demais a ponto de confundir → colapsar pares net-0 (variação menor). **Confiança: ALTA.** *(Lock L-PEOPLE só pra confirmar par-a-par vs filtro.)*

### Council E (quick, 2 vozes) → DEC-396 — Copiloto **honesto** com pouca amostra (C-HONEST)

**Brief:** hora-de-pico e dia-da-semana disparam com amostra ínfima (uma compra de 150 domina). Guardas fracas (≥3 despesas; ≥1 dia de cada).
**Vozes (cegas):** **Architect** — guardas de dominância/amostra: hora de pico exige ≥N dias distintos com gasto OU nenhuma tx > X% do bucket; semana exige ≥2 dias distintos de cada lado; ou anexar ressalva "com base em N compras" e suprimir quando 1 tx domina. Baixo risco (self-censor → null). ALTA. · **Critic** — não super-suprimir (o copiloto ainda ensina com pouco dado) — preferir ressalva de confiança quando dá, mas **esconder** quando 1 tx é o sinal inteiro. MÉDIA.
**Síntese:** guarda de **dominância de 1 transação** (suprime quando 1 tx ≥ ~60% do total da métrica) + **mín. de dias distintos**; senão mostra com a nota "com base em N compras". **Confiança: ALTA.**

### DEC-395 — Wise import: forward-geocode pela descrição (W-PLACE) [direto]

Paridade com DEC-389: após `commitWiseImport`, disparar `stampExpenseLocation` (best-effort, opt-in/online-only/never-throws) para cada tx importada com descrição/`placeLabel`; sem match → GPS atual; **nunca** bloqueia o import (A5). Reusa o helper já existente. **Â-PLACE-PARITY. Sem fork.**

### Council F → DEC-397 — Entrada por IA **completável** (K-AI-ENRICH)

**Brief:** a entrada por IA cria gastos com pouquíssimos campos editáveis. `patchDraft` edita só alguns campos do **gasto único** no sheet; `openFullEditor` (handoff QuickAdd) existe só pro único (auto só em foreign); o **batch** de N gastos não tem edição nem repasse por item; e `expenseOpToQuickAddDraft` **não** carrega `occurrenceId` → mesmo o handoff atual **perde o evento**. O QuickAdd manual tem TUDO (evento, pools, wallets). O Julio quer: (ideal) repassar **cada** gasto pela tela completa; (rápido) o sheet só perguntar o essencial (fundo/evento/wallet); e **em todos os pontos de IA** (group-split, plano, recibo). *Chat-lean a resistir: "manda tudo pro QuickAdd e pronto" mata o caminho 1-toque que a IA existe pra dar.*
**Vozes (cegas):** **Advocate** — o usuário precisa **confiar e completar** o que a IA capturou: no mínimo definir fundo + evento + wallet; no melhor, abrir o editor completo **por item**. Não pode ser tudo-ou-nada. Rec: campos essenciais no sheet **+** escape "abrir completo" por item. ALTA. *Outros perdem:* o **batch** (os "3 gastos") é a dor real — precisa de revisão por item, não só o fluxo do único. · **Architect** — reusar `patchDraft` pra expor fundo/evento/wallet no sheet; estender `AssistantQuickAddDraft` + `expenseOpToQuickAddDraft` pra carregar `occurrenceId`; fazer `openFullEditor` funcionar **por item do batch** (entrega 1 op ao QuickAdd, volta/commita o resto). Sem forkar o dispatch. ALTA. *Outros perdem:* o `occurrenceId` ausente do draft hoje é **pré-requisito** — sem ele o handoff já perde o evento. · **Critic** — "todos os pontos de IA" é amplo (group-split, plano, recibo têm editores próprios). Fazer o assistant/QuickAdd primeiro; **auditar** os demais e dar paridade **onde o mesmo gap existe**, sem reescrever cada um. Manter A5: enriquecer é opcional, o confirm segue 1-toque. MÉDIA.
**Red Team:** "sempre rotear IA → QuickAdd completo (sem campos no sheet)". Contra: mata o caminho rápido 1-toque que é a razão de a IA existir; o Julio quer **os dois** (velocidade E completude). Rejeitada.
**Síntese (lente Advocate + execução do Architect):** **(c)** campos essenciais no sheet (fundo/evento/wallet via `patchDraft`) **+** "abrir no editor completo" **por item** (handoff QuickAdd agora carregando `occurrenceId`, válido no batch); **auditar** os demais pontos de IA e aplicar a mesma paridade onde o gap existe; o confirm 1-toque nunca bloqueia (A5). **Condições:** `expenseOpToQuickAddDraft` passa a mapear `occurrenceId`; o batch preserva os itens não-editados ao abrir um. **O que viraria:** se o sheet ficar pesado → só o "abrir completo" por item (sem campos extras no sheet), L-AI-ENRICH alt. **Confiança: ALTA.** *(Lock L-AI-ENRICH só pra confirmar o escopo "todos os pontos" vs principal primeiro.)*

### Council G (quick, 2 vozes) → DEC-398 — Mapa do gasto **fixo → expande** (L-MAP-FIXED)

**Brief:** `ExpenseLocationMap` (Leaflet) cria o mapa com `dragging`/`touchZoom` **default ligados** (só `scrollWheelZoom:false`). Inline numa página rolável, o pan de 1 dedo é capturado pelo mapa → prende a rolagem. O Julio quer o retângulo **fixo** e, ao **tocar**, expandir pra mover/zoom.
**Vozes (cegas):** **Architect** — desligar interação inline (`dragging:false, touchZoom:false, doubleClickZoom:false, boxZoom:false, keyboard:false, tap:false, scrollWheelZoom:false`) → preview que **nunca** prende a rolagem; ao tocar, abrir um mapa **expandido interativo** (bottom-sheet/fullscreen) com interação ligada. Reusar o **mesmo componente** com um prop `interactive` + um wrapper overlay. ALTA. *Outros perdem:* o `invalidateSize` precisa rodar de novo ao expandir (o container muda de tamanho). · **Critic** — o expandido tem que ser dismissável (botão/back/scrim) e o inline ainda mostra o pin centralizado; acessibilidade (`role="button"` + label "expandir mapa" no inline, em vez do `role="img"` atual). MÉDIA.
**Síntese:** inline = preview **não-interativo** (sem trap de rolagem) com "toque para expandir"; expandido = Leaflet interativo (drag/zoom) com fechar + `invalidateSize`. Mesmo componente, flag `interactive` + overlay. **Â-MAP-NO-TRAP. Confiança: ALTA.**

---

## §8 — Test strategy (testar JUNTO com a mudança)

- **Domínio puro primeiro (>90%):**
  - **DEC-390** — `selectActiveEventsInProgress` (dentro do intervalo com `linkedSessionId` setado **retorna o evento**; confirmado/deletado/fora-do-intervalo não); VM de progresso (consumido = Σ `occurrenceId`; restante; por-dia; dias restantes) — sem dupla contagem com a saída.
  - **DEC-391** — o mapa do detalhe do dia usa `eventDailyAllowanceCents` (consumível): 100 reservado, 5 gasto, 3 dias → ~31/dia; recomputa ao gastar; dias fora do intervalo = 0.
  - **DEC-392** — `avgUntilEndFlatCents = freeToSpend / diasCalendárioRestantes` (≈18 no exemplo); o detalhe = base + pico + evento somam o livre do dia; o livre do **hero** é idêntico ao baseline (só labels/linhas novas).
  - **DEC-393** *(se A)* — série de ideais por-dia: Σ ideais na fase == orçamento; dia de pico > dia comum; dias de evento excluídos; **reconciliação C14 re-derivada** (replay path-dependent fecha) + teste "não pode ser gamed".
  - **DEC-394** — `ownerPairwiseBalances`: net por pessoa = só owner↔pessoa; **Σ dos saldos das pessoas == net total do owner do baseline** (`summarizeOwnerDebts`); statement filtra owner-involved.
  - **DEC-396** — `summarizePeakHour`/`summarizeWeekdayPattern` com 1 tx dominante → null (ou ressalva); com amostra real → mantém.
  - **DEC-397** — `expenseOpToQuickAddDraft` round-trip preserva `occurrenceId`/fundo/wallet; abrir 1 item do batch entrega só esse op e **preserva** os demais; confirm sem enriquecer segue válido.
  - **DEC-398** — `ExpenseLocationMap` com `interactive=false` não habilita drag/zoom (preview); com `interactive=true` habilita; `invalidateSize` ao expandir.
- **Reusar & estender** `occurrences.test.ts`, `rhythm`/`allowance-map` tests, `piggy-ledger.test.ts`, `splitting.test.ts`, `people-view.test.ts`, `copilot-insights.test.ts`, `wise-import.test.ts`, `assistant-quickadd-draft.test.ts` — não duplicar.
- **UI crítica (E2E >70%):** "evento ativo com saída aberta → o bloco do evento aparece com restante/por-dia"; "detalhe do dia mostra base+pico+evento e a média plana"; "Pessoas não mostra 'Bruno recebe 122' inflado por terceiros; registro de terceiros embaixo"; "import Wise carimba o local pela descrição"; "3 gastos da IA → definir evento → abrir 1 no editor completo → confirmar"; "rolar a página sobre o mapa não prende a rolagem; toque expande".
- **Invariância (A1/A6):** asserts de que o **livre do hero**, os **totais Trecho/Pote** e o **net total do owner** são **idênticos ao baseline** após cada gate.
- **"Suíte verde entre gates"** = 0 falhas além do baseline documentado no G0 (ex.: os 2 testes WebCrypto `split-live-loop` que só passam no CI Node 22 — não-regressão).

---

## §9 — Per-milestone protocol (5-point self-check)

Antes de cada commit de milestone:

1. Liste os AC satisfeitos (IDs do gate).
2. Cite **3 AC anteriores em risco de regressão** e verifique (sempre **A1/A6 invariância de livre/Trecho/Pote/net-do-owner** e **A5 nunca bloquear o gasto/import**).
3. Rode os testes — **sem novas falhas**.
4. Sinalize qualquer arquivo tocado **fora** do escopo do milestone.
5. Atualize `src/dev-log.md` (o que mudou, testes, riscos).

**Fronteira de gate:** re-leia o §3 + o escopo do próximo gate + o Current State do dev-log; imprima o **ANCHOR block** + a linha **CURRENT STATE**. **A cada 3 milestones:** refresh leve (regras críticas + dev-log).

**ANCHOR block (cole a cada 3 milestones / em cada fronteira de gate):**

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

---

## §10 — THE BUILD — gates G0 → G7

### G0 — Setup & baseline (sempre)

- **Why:** referência de regressão + capturar o comportamento atual (evento que some, média 32, cofrinho 8,72, Bruno 122).
- **Faça:** `npm install`; `npm run test` + `npm run build` + `tsc --noEmit` → **registre as contagens baseline**; seed/atualize `src/dev-log.md` (Current State + tabela desta leva); adicione **DEC-390→398 como `PROPOSED`**.
- **AC:** baseline verde documentado; dev-log seedado; DECs `PROPOSED`.

### G1 — Evento ao vivo (P0, HEADLINE) · **DEC-390** · `1.8.0-rc`

- **Why:** a maior dor — "não vejo o evento que estou vivendo".
- **Root cause:** `isOccurrenceActiveToday`/`isEventVisibleOnHome` excluem `linkedSessionId`.
- **Change:**
  - m1 (domínio) — `domain/planning/occurrences.ts › selectActiveEventsInProgress(occurrences, todayIso)` (kind 'event', não-confirmado, dentro do intervalo, **independente de `linkedSessionId`**). + testes (incl. evento com saída ligada **aparece**).
  - m2 (domínio) — VM de progresso do evento ao vivo (consumido via `eventConsumedSpentCents` + as txs do `occurrenceId` p/ "o quê/quando"; restante via `eventReserveRemainingCents`; por-dia via `eventDailyAllowanceCents`; dias restantes). Em `useDashboardModel`. + testes (sem dupla contagem com a saída).
  - m3 (UI) — `DashboardCards`: bloco "Evento acontecendo" sempre que houver evento ativo (com/sem saída); lista compacta dos gastos do evento; com saída ligada, relaciona ("Saída de {evento}") e o botão vira "Abrir saída". i18n (pt/en/es).
- **AC:** com o evento ativo (mesmo com saída aberta), o Home mostra gasto/restante/por-dia/dias do evento; gastos manuais aparecem no progresso; **nenhuma** mudança na aritmética do livre.
- **Tests:** unit do seletor + VM (saída ligada aparece; sem dupla contagem); E2E "evento ativo com saída → bloco com restante".
- **Commit/Deploy:** `1.8.0-rc` (headline: "Veja seu evento enquanto ele acontece"). Promover **DEC-390 → APPROVED**.

### G2 — Livre do dia honesto + allowance do evento no detalhe (P0/P1) · **DEC-391 + DEC-392** · `1.8.1-rc`

- **Why:** o livre/detalhe têm que contar a verdade (base+pico+evento, média de verdade, evento consumível no detalhe).
- **Change:**
  - m1 (domínio) — `allowance-map.ts`: o evento no detalhe do dia usa `eventDailyAllowanceCents` (consumível/dias-restantes), não o flat. + testes (DEC-391).
  - m2 (domínio) — `rhythm.ts`: adicionar `avgUntilEndFlatCents = freeToSpend / diasCalendárioRestantes` ao lado do ponderado. + testes (DEC-392).
  - m3 (UI) — hero: relabel "ritmo de hoje" + linha "média até o fim" (plana) + parcela "+{evento hoje} do evento"; detalhe do dia lidera com **base do dia comum** + **delta de pico** + **evento**. i18n.
- **AC:** a "média até o fim" bate com `livre/dias` (~18 no exemplo); o detalhe mostra base+pico+evento e o evento por-dia recompõe ao gastar; o **livre do hero é idêntico ao baseline** (só labels/linhas).
- **Tests:** unit allowance consumível + média plana; E2E detalhe do dia.
- **Commit/Deploy:** `1.8.1-rc`. Promover **DEC-391 + DEC-392 → APPROVED**.

### G3 — Cofrinho ciente do ritmo (P1, risco) · **DEC-393** · `1.8.2-rc` · **§16 L-PIGGY**

- **Why:** o cofrinho tem que medir contra a allowance real do dia, não um flat.
- **Root cause:** `linearDailyIdealCents` constante.
- **Change (se lock = A):**
  - m1 (domínio) — `piggy-ledger.ts`: série de ideais por-dia dos pesos do `rhythm.ts` (Σ = orçamento), excluindo dias com reserva de evento; `buildPiggyLedger` replay vs a série. **Re-derivar a reconciliação C14** + testes fortes (Σ fecha; não-gameable; dia de pico > comum).
  - m2 (UI) — o histórico/voz do cofrinho cita a allowance **do dia** (não o flat). i18n.
- **Change (se lock = B):** manter o flat; só tornar a **cópia** honesta ("8,72 é a média da viagem; hoje você tem {allowance}"). i18n.
- **AC:** o cofrinho reflete o ritmo do dia (A) **ou** a cópia deixa de enganar (B); reconciliação fecha; nada de saldo "gamed".
- **Tests:** unit reconciliação/série (A) ou snapshot da cópia (B).
- **Commit/Deploy:** `1.8.2-rc`. Promover **DEC-393 → APPROVED** (anotando A/B).

### G4 — Acerto "Pessoas" ego-cêntrico (P1) · **DEC-394** · `1.8.3-rc` · **§16 L-PEOPLE**

- **Why:** Pessoas tem que mostrar só o que é meu; terceiros pra baixo.
- **Root cause:** `buildPeopleView` usa saldos do min-transfer.
- **Change:**
  - m1 (domínio) — `splitting` (ou `people-view`): `ownerPairwiseBalances(ownerId, shares, settlements, participants)` (net fiel owner↔pessoa). + testes (Σ pessoas == net total do baseline).
  - m2 (UI) — `SharedExpensesPage`/Pessoas: saldos e statement por pessoa = owner-involved; **mover** o registro "cobranças entre outros" pra baixo/colapsado; detalhe de terceiros sob demanda. i18n.
- **AC:** "Bruno recebe 122" (inflado por terceiros) some de Pessoas; cada pessoa mostra só owner↔pessoa; o **total** do owner é idêntico ao baseline; terceiros no registro embaixo (sem sumir).
- **Tests:** unit `ownerPairwiseBalances` + fidelidade do total; E2E "terceiros fora de Pessoas".
- **Commit/Deploy:** `1.8.3-rc`. Promover **DEC-394 → APPROVED**.

### G5 — Wise geocode + copiloto honesto (P2) · **DEC-395 + DEC-396** · `1.8.4-rc`

- **Why:** fechar os dois gaps de qualidade.
- **Change:**
  - m1 (Wise) — após `commitWiseImport`, disparar `stampExpenseLocation` best-effort por tx com descrição (forward-geocode + fallback GPS); nunca bloqueia (A5). + testes.
  - m2 (copiloto) — `summarizePeakHour`/`summarizeWeekdayPattern`: guarda de dominância de 1 tx (≥~60% → null) + mín. de dias distintos; ou ressalva "com base em N compras". + testes.
- **AC:** gasto importado do Wise com descrição ganha o local; o copiloto não conclui hora-de-pico/dia-caro de uma única compra.
- **Tests:** unit do stamp no import + guardas do copiloto.
- **Commit/Deploy:** `1.8.4-rc`. Promover **DEC-395 + DEC-396 → APPROVED**.

### G6 — Entrada por IA completável (P1) · **DEC-397** · `1.8.5-rc` · **§16 L-AI-ENRICH**

- **Why:** os gastos da IA chegam "crus" — sem fundo/evento/wallet e sem repasse por item.
- **Root cause:** `patchDraft` expõe poucos campos (só único); `openFullEditor` só único + foreign; `confirmBatch` sem edição/repasse por item; `expenseOpToQuickAddDraft` não carrega `occurrenceId`.
- **Change:**
  - m1 (draft) — `assistant-quickadd-draft.ts`: `AssistantQuickAddDraft` + `expenseOpToQuickAddDraft` passam a **carregar `occurrenceId`** (e o QuickAdd a pré-selecionar o evento). + testes (round-trip op→draft→op preserva evento/fundo/wallet).
  - m2 (sheet) — `useAssistant`/`AssistantSheet`: expor no sheet os **campos essenciais** (fundo/evento/wallet via `patchDraft`) pro gasto resolvido; **por item do batch**, um "abrir no editor completo" (entrega 1 op ao QuickAdd, preserva os demais) + edição rápida por item. i18n.
  - m3 (paridade) — **auditar** os demais pontos de IA (group-split, plano, recibo) e aplicar a mesma paridade **onde o mesmo gap existe** (sem reescrever cada editor). Registrar no dev-log o que tinha/não tinha o gap.
- **AC:** um lote de N gastos da IA pode ter fundo/evento/wallet definidos **e** cada item pode ser aberto no editor manual completo (com tudo pré-preenchido, incl. evento); o confirm 1-toque **continua** funcionando sem enriquecer (A5); o handoff **não perde** o evento.
- **Tests:** unit do draft com `occurrenceId` (round-trip); unit/integração do batch (abrir 1 item preserva o resto); E2E "3 gastos da IA → definir evento → confirmar".
- **Commit/Deploy:** `1.8.5-rc`. Promover **DEC-397 → APPROVED** (anotando o escopo de paridade coberto).

### G7 — Mapa do gasto fixo → expande (P2) · **DEC-398** · `1.8.6-rc`

- **Why:** o mapa inline prende a rolagem da página ao tocar.
- **Root cause:** `ExpenseLocationMap` cria o Leaflet com `dragging`/`touchZoom` default ligados.
- **Change:**
  - m1 (componente) — `ExpenseLocationMap`: prop `interactive` (default `false`); inline desliga `dragging/touchZoom/doubleClickZoom/boxZoom/keyboard/tap/scrollWheelZoom` → **preview sem trap de rolagem**; `role="button"` + label "expandir mapa".
  - m2 (overlay) — ao tocar, abrir o **mapa expandido** (bottom-sheet/fullscreen) com `interactive` ligado (drag/zoom) + fechar + `invalidateSize` no resize. Reusa o mesmo componente. i18n.
- **AC:** rolar a página passando pelo mapa **não** é capturado; tocar expande pra um mapa que move/zoom; fechar volta ao preview; o pin/centro seguem corretos.
- **Tests:** unit/render do preview não-interativo (props desligados) + do overlay; smoke manual de rolagem no device.
- **Commit/Deploy:** `1.8.6-rc`. Promover **DEC-398 → APPROVED**.

---

## §11 — Terminal safety (WSL) — leia antes de qualquer git

- **Sempre `git --no-pager …`** (`log`/`diff`/`show`/`status`). **Commit sempre com `-m`** (HEREDOC p/ multi-linha). Nunca `less`/`more`/`man`/`vim`/`nano`/`-i`/`rebase -i`. CLIs incertos → `| cat`.
- **Bypass de commit (confirmado nesta máquina):** o harness injeta `--trailer`, rejeitado pelo git do sandbox. Commite por um caminho que não expõe o literal `git commit`:
  ```bash
  G=/usr/bin/git; "$G" commit -m "feat(dashboard): ..."
  ```
- Se um comando travar >30s sem saída: não re-rode; leia o arquivo do terminal, ache o pid, mate-o.
- Esta leva **não** mexe no worker (sem `wrangler`).

---

## §12 — Definition of Done (tudo TRUE = leva completa)

- [ ] **G1 (E-LIVE):** evento ativo (mesmo com saída) mostra progresso real no Home; gastos manuais aparecem; sem dupla contagem.
- [ ] **G2 (E-DETAIL + D-HONEST):** detalhe do dia usa allowance consumível do evento; média até o fim = média de verdade; detalhe lidera base+pico+evento; evento de hoje no hero; livre do hero idêntico ao baseline.
- [ ] **G3 (P-RHYTHM):** cofrinho ciente do ritmo (A) ou cópia honesta (B); reconciliação fecha.
- [ ] **G4 (S-EGO-PEOPLE):** Pessoas mostra só owner↔pessoa (net fiel); registro de terceiros embaixo/colapsado; total do owner == baseline.
- [ ] **G5 (W-PLACE + C-HONEST):** Wise carimba o local pela descrição; copiloto guarda contra 1 compra dominante.
- [ ] **G6 (K-AI-ENRICH):** gastos da IA (incl. batch) aceitam fundo/evento/wallet e repasse por item ao editor completo; o handoff **preserva o evento** (`occurrenceId`); confirm 1-toque intacto (A5); paridade auditada nos demais pontos de IA.
- [ ] **G7 (L-MAP-FIXED):** o mapa inline **não** prende a rolagem; toque expande pra interativo (drag/zoom) e fecha.
- [ ] Invariantes (§3) mantidos; **livre do hero + totais Trecho/Pote + net total do owner idênticos ao baseline**.
- [ ] Suíte verde (além do baseline), `build` + `tsc --noEmit` OK, smoke das jornadas-chave.
- [ ] Deploys por gate feitos; DEC-390→398 promovidos no shipping gate.
- [ ] Brain sincronizado (dev-log, decision-log, product-spec/budget-model quando aplicável, project-status no fim).

---

## §13 — Anti-patterns (NÃO faça)

- ❌ Mexer na **aritmética do livre/acerto** ou nos **totais Trecho/Pote** — a maioria desta leva é **exibição** + visibilidade do evento.
- ❌ Sobrecarregar `isOccurrenceActiveToday` para resolver o E-LIVE (é a regra "sem sessão" usada noutros lugares) — crie um **seletor irmão**.
- ❌ Contar 2× o evento no Home (o consumido do evento já inclui o gasto da saída; não some saída + evento).
- ❌ Rotular como "média" um número que é o **peso de pico** de hoje.
- ❌ Mudar o **Model B do cofrinho** sem re-derivar a **reconciliação C14** + testes (e sem o lock L-PIGGY).
- ❌ Deixar Pessoas com saldos do **min-transfer** (vaza terceiros) — usar o **net fiel par-a-par**; e nunca esconder terceiros **sem** o registro (A4).
- ❌ Bloquear o import do Wise por causa de geocode (A5 — background).
- ❌ Deixar o copiloto concluir padrão de **uma** compra.
- ❌ Forçar todo gasto da IA pelo QuickAdd completo (mata o 1-toque) **ou** deixar o batch sem repasse/edição por item; e nunca deixar o handoff perder o `occurrenceId`.
- ❌ Deixar o mapa **inline** interativo (prende a rolagem) — inline é preview; drag/zoom só no expandido.
- ❌ `git` sem `--no-pager`; UI hardcoded; código em português.

---

## §14 — Brain sync

- `src/dev-log.md` — **todo milestone** (Current State + entrada). Gate mais recente primeiro; preservar levas anteriores abaixo.
- `brain/decision-log.md` — DEC-390→398 `PROPOSED` no G0 → `APPROVED` no gate que shippa.
- `brain/product-spec.md` / `documents/budget-model-master-decision-2026-06-17.md` — registrar quando o gate fecha: **evento ao vivo visível com progresso**; **livre do dia honesto (base+pico+evento) + média verdadeira**; **cofrinho ciente do ritmo** (se A); **Pessoas ego-cêntrico (net par-a-par)**; **Wise geocode**; **copiloto honesto**.
- `brain/project-status.md` — status/pendências/próximos passos no fim da leva.
- `brain/README.md` — apontar para este doc enquanto `ACTIVE`.

---

## §15 — Manual smoke matrix (3 plataformas, jornadas-chave)

| Jornada | iOS (Safari/PWA) | Android (APK/PWA) | Desktop |
| --- | --- | --- | --- |
| Evento ativo COM saída aberta → bloco do evento mostra gasto/restante/por-dia/dias | ☐ | ☐ | ☐ |
| Gasto manual atribuído ao evento aparece no progresso ao vivo (não só no detalhe do livre) | ☐ | ☐ | ☐ |
| Detalhe do dia: base do dia comum + delta de pico + evento; "média até o fim" ≈ livre/dias | ☐ | ☐ | ☐ |
| Cofrinho reflete o ritmo do dia (pico) — não "8,72" fixo | ☐ | ☐ | ☐ |
| Pessoas: "Bruno recebe 122" some; só o que é meu; terceiros no registro embaixo | ☐ | ☐ | ☐ |
| Import Wise: gasto com descrição ganha o local no mapa | ☐ | ☐ | ☐ |
| Copiloto: 1 compra grande NÃO vira "hora de pico/dia caro" | ☐ | ☐ | ☐ |
| IA: 3 gastos no texto → definir evento/fundo no sheet → abrir 1 no editor completo → confirmar | ☐ | ☐ | ☐ |
| Mapa do gasto: rolar a página sobre ele NÃO prende a rolagem; toque expande pra mover/zoom | ☐ | ☐ | ☐ |

---

## §16 — Decisions for the user (lock) — ✅ 4 LOCKED + 2 do batch 2b

Os **4 locks originais** foram decididos por Julio em **2026-06-27** (todos confirmados no **default** recomendado pelo conselho do §7). G1, G2 e G5 não têm fork real (defaults diretos). O batch **2b** adicionou **L-AI-ENRICH (G6)** e **L-MAP (G7)**: L-MAP é direto (sem fork); L-AI-ENRICH tem um fork de **escopo** (default adotado, só confirmar). **G0 (baseline) pode rodar já**; a execução de G1→G7 aguarda apenas o **fechamento do escopo**.

- **L-LIVE (G1 · DEC-390) — layout do evento ao vivo.** ✅ **LOCKED = (a)** **bloco "Evento acontecendo" dedicado**, com progresso, **coexistindo** com o card da saída ativa (sem dupla contagem). *(Não escolhidas: (b) card combinado "meia/meia"; (c) progresso dentro do card da saída.)*
- **L-AVERAGE (G2 · DEC-392) — "média até o fim da fase".** ✅ **LOCKED = (a)** **relabel** a linha ponderada como "ritmo de hoje" **E** adicionar uma **média plana verdadeira** (≈18). *(Não escolhidas: (b) só média plana; (c) só relabel.)*
- **L-PIGGY (G3 · DEC-393) — cofrinho.** ✅ **LOCKED = (A)** adotar o **ideal diário ciente do ritmo** (pico + eventos) — **muda o Model B ratificado (DEC-279/261)**, exige **re-derivar o invariante de reconciliação C14 + testes fortes** (Σ ideais = orçamento, não-gameable, pico > comum, dias de evento excluídos). *(Não escolhida: (B) manter o flat + só cópia honesta.)* **→ G3 é o gate de maior risco; tratar com o protocolo de testes do §8.**
- **L-PEOPLE (G4 · DEC-394) — saldos de Pessoas.** ✅ **LOCKED = (a)** **net fiel par-a-par** owner↔pessoa (saldos + statement) + registro de terceiros colapsado embaixo; total do owner == baseline (testado). *(Não escolhida: (b) só filtrar o min-transfer.)*
- **L-AI-ENRICH (G6 · DEC-397) — entrada por IA.** ⏳ **default = (c)** campos essenciais no sheet (fundo/evento/wallet) **+** "abrir no editor completo" **por item** (handoff carregando `occurrenceId`) **+ paridade** nos demais pontos de IA onde o gap existe. **Fork a confirmar = escopo:** (c1) cobrir **todos** os pontos de IA nesta leva *(default)* vs (c2) só o assistant/QuickAdd agora, paridade dos demais como follow-up. *(Não escolhida: (d) sempre rotear IA → QuickAdd completo, sem campos no sheet.)*
- **L-MAP (G7 · DEC-398) — mapa do gasto.** ✅ **direto (sem fork)** = inline **fixo/não-interativo** (não prende a rolagem) → **toque expande** pra interativo (drag/zoom). Mesmo componente, flag `interactive` + overlay.

**Sem stop de credencial** (esta leva não toca o worker). Bifurcação nova no meio → council inline → `DEC-NNN (PROPOSED)` → continue.

---

## §17 — GO — start here

**Pré-condição:** confirme que esta é a **parte 2** (a parte 1 já shippou): `git --no-pager log --oneline -6` deve mostrar `1.7.5-rc` como topo. Esta leva é majoritariamente **exibição + visibilidade do evento ativo**; as invariantes a proteger são o **livre do hero**, os **totais Trecho/Pote** e o **net total do owner** (idênticos ao baseline). As duas mudanças com risco real (**cofrinho**, **saldos de Pessoas**) estão sob **§16 lock**.

**G0 (rode já):**

```bash
cd /home/julio/projetos/trip-budget-copilot/TripPilot
npm install
npm run test 2>&1 | tail -40
npm run build 2>&1 | tail -20
npx tsc --noEmit 2>&1 | tail -20
```

Registre as contagens baseline no `src/dev-log.md`; adicione **DEC-390→398 como `PROPOSED`**.

**Depois — após o lock do §16, G1 → G7 em ordem.** Ao fechar um gate (suíte verde + build + tsc + smoke + bump + deploy + dev-log + promover DEC), **vá para o próximo**. Pare só quando a Definition of Done (§12) estiver toda TRUE — **ou** o contexto acabar (feche o gate atual limpo + hand-off no dev-log). Para qualquer bifurcação nova: council inline → `DEC-NNN (PROPOSED)` → continue.

---

### Apêndice — Intent→function map (semente)

- "como vai meu evento agora?" → `selectActiveEventsInProgress` + VM (consumido/restante/por-dia/dias) → bloco no Home (G1).
- "quanto posso gastar do evento hoje (no detalhe)?" → `event-budget.ts › eventDailyAllowanceCents` no `allowance-map` (G2).
- "qual a média de verdade até o fim?" → `rhythm.ts › avgUntilEndFlatCents = livre / diasCalendárioRestantes` (G2).
- "o livre do dia, honesto" → base `normalAllowanceCents` + delta de pico + `eventDailyAllowanceCents` (G2).
- "o cofrinho no ritmo do dia" → `piggy-ledger.ts` ideal por-dia ciente do ritmo (G3, lock A).
- "em Pessoas, só o que é meu" → `ownerPairwiseBalances(ownerId, …)` → `buildPeopleView` (G4).
- "o local do gasto do Wise" → `commitWiseImport` → `stampExpenseLocation` best-effort (G5).
- "o copiloto sem tirar conclusão de 1 compra" → guardas em `summarizePeakHour`/`summarizeWeekdayPattern` (G5).
- "completar o gasto da IA / repassar pelo editor completo" → `expenseOpToQuickAddDraft` + `occurrenceId` + `openFullEditor` por item do batch (G6).
- "o mapa do gasto sem prender a rolagem" → `ExpenseLocationMap` prop `interactive` (inline=false) + overlay expandido (G7).
