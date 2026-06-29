# Exploração — A experiência de EVENTO de ponta a ponta (descoberta + design)

> Documento de **descoberta/design** (não é orquestrador). Pedido do Julio: "pensar em todo o fluxo do evento — todos os inputs, entradas, leitura, interações que o user tem com tudo de evento — e explorar tudo que dá pra melhorar." Gatilho concreto: ao iniciar uma saída dentro de um evento, o Home mostra **dois cards** (saída ativa + evento ativo) fazendo a mesma coisa; e o card de saída mostra **€0** enquanto o do evento mostra o total real. Tudo aqui foi **lido no código** (confiança ALTA) — referências em §2/§3.
>
> Relação com o orquestrador `2026-06-29-event-lifecycle-tracking-and-field-truth-orchestrator.md`: este doc **alimenta** aquele — confirma G1/G2 e acrescenta **DEC-409** (unificar o card de saída-de-evento). Nada aqui muda a aritmética do dinheiro.

---

## §0 — O que é um "evento" hoje (modelo mental atual, lido no código)

Um **evento** é uma `PlannedOccurrence` (`domain/types/planned-occurrence.ts`) de `kind` `event` (ou `sub_destination`), dentro de uma **fase**, com:

- `reservedCents` — dinheiro **reservado** (ou `null` = só acompanhar, sem envelope).
- `plannedDate` / `endDate` — quando acontece (1 dia ou intervalo).
- `isConfirmed` — hoje significa **"encerrado/resolvido"** (a reserva para de descontar; a sobra foi tratada).
- `linkedSessionId` — a **saída** (Session) ligada (hoje: no máximo UMA).
- `linkedTransactionId`, `budgetPoolId`, `estimatedCostCents`, `activityProfileId`, `notes`.

A **saída (outing)** é uma `Session` (`domain/types/session.ts`): teto/alvo (`targetCents/ceilingCents/maxCents`), `quickAddValuesCents`, `avgDrinkPriceCents`, alertas (50/75/90/100), `startedAt/endedAt`. É o **modo foco** de um rolê (uma noite de bar), com quick-add, rounds e contagem de "quantas bebidas faltam".

**A reserva é consumível (DEC-385):** `eventReserveRemainingCents = max(0, reserved − consumed)`, e `consumed` = gastos **atribuídos** ao evento (`tx.occurrenceId`) **+** gastos da saída ligada (`tx.sessionId === linkedSessionId`). Tudo em **custo pessoal** (`transactionBasePersonalCostCents`) — por isso o evento já conta **só a minha parte** (€30÷3 = €10). Fonte: `domain/budget/event-budget.ts`.

**Atribuição XOR (DEC-386):** um gasto pertence a um evento **OU** a uma saída, nunca aos dois (a fábrica dropa `sessionId` quando há `occurrenceId`). **Importante:** dá pra gastar no evento **sem** saída — basta marcar o gasto com o evento (QuickAdd/IA), e a reserva conta certo. **A saída não é pré-requisito.**

---

## §1 — O ciclo de vida do evento (estados + transições, HOJE vs DESEJADO)

### HOJE (o que o código faz)

```
planned ──(data chega)──> "ativo hoje" (card do dia / live_event)
   │                              │
   │                      "iniciar agora" ──> cria SAÍDA + linka (linkedSessionId)
   │                              │
   │                      encerra a saída ──> endOutingSession seta isConfirmed=TRUE  ❌ ENCERRA O EVENTO
   │                              │
   │                      descarta a saída ──> desvincula (com reserva) / apaga (sem reserva)  ❌ EVENTO SOME
   └──(data passa c/ sobra)──> prompt de sobra (free/cofrinho/pote) ──> isConfirmed=true
```

**Problemas estruturais:** (1) não existe "iniciar o evento" — o primeiro gesto já cria uma saída; (2) encerrar/descartar a saída **mexe no evento**; (3) só dá pra ter **uma** saída por evento; (4) não existe "encerrar o evento" explícito.

### DESEJADO (Julio + conselho A → DEC-400)

```
planned ──"iniciar evento"(startedAt)──> EVENTO AO VIVO (sem saída obrigatória)
   │                                         │  gasta direto (occurrenceId) OU
   │                                         │  "iniciar saída" ──> saída N:1 (várias, abre/fecha)
   │                                         │       └─ encerrar saída ──> só fecha a SAÍDA (evento segue)
   │                                         │       └─ descartar saída ──> só descarta a SAÍDA (evento intocado)
   └────────────────"encerrar evento"───────┴──> fecha saídas abertas + sobra (DEC-387) ──> some da tela
```

Estados: **planned → started → ended**. O evento só some quando **explicitamente encerrado**.

---

## §2 — Inventário COMPLETO de interações (inputs / leituras / ações)

> Tudo que o usuário faz/vê em torno de um evento, com arquivo·símbolo. ✅ = funciona · ⚠️ = funciona mas confuso/incompleto · ❌ = falta/quebrado.

### A. CRIAR um evento


| Caminho                             | Onde                                                                    | Estado                                   |
| ----------------------------------- | ----------------------------------------------------------------------- | ---------------------------------------- |
| Planner (planejar evento na fase)   | `features/planning/PlannerPage.tsx` · `createPlannedOccurrence`         | ✅                                        |
| Trip edit (criar/editar occurrence) | `features/trip/TripEditPage.tsx` (`/trip/edit?occurrence=`)             | ✅                                        |
| Saída one-off vira evento           | `features/outing/OutingPage.tsx` · `startOneOffEventSession` (L555-580) | ✅ (mas amarra 1:1)                       |
| Via IA ("vou num show sábado")      | —                                                                       | ❌ não existe (IA cria gasto, não evento) |
| Sub-destination (cidade)            | `kind: 'sub_destination'`                                               | ✅ (card do dia)                          |


### B. CONFIGURAR


| O quê                                            | Onde                                         | Estado |
| ------------------------------------------------ | -------------------------------------------- | ------ |
| Reserva (`reservedCents`) ou track-only (`null`) | TripEdit/Planner                             | ✅      |
| Datas (1 dia / intervalo)                        | TripEdit/Planner                             | ✅      |
| Pool/fundo do evento                             | herda da fase                                | ✅      |
| Adiar (+1 dia)                                   | `postponeOccurrence` · botão "adiar" no card | ✅      |


### C. INICIAR


| Gesto                              | Onde                                                        | Estado                                   |
| ---------------------------------- | ----------------------------------------------------------- | ---------------------------------------- |
| "Iniciar agora" (card do dia/live) | `DashboardCards.tsx` L494/L668 → `/outings/new?occurrence=` | ⚠️ cria **saída**, não "inicia o evento" |
| "Iniciar o evento" (sem saída)     | —                                                           | ❌ não existe (DEC-400)                   |


### D. GASTAR no evento


| Caminho                                           | Onde                                                                                   | Estado                        |
| ------------------------------------------------- | -------------------------------------------------------------------------------------- | ----------------------------- |
| Atribuição direta (escolher o evento no QuickAdd) | `features/expenses/QuickAddPage.tsx` · EventPicker (DEC-397) · `tx.occurrenceId`       | ✅ (conta certo, sem saída)    |
| Via IA com evento                                 | `useAssistant`/`expenseOpToQuickAddDraft` carrega `occurrenceId` (DEC-397)             | ✅                             |
| Via saída (quick-add/rounds/repeat)               | `OutingPage.tsx` · `quickAddSessionExpense`/`addRoundExpenses`/`repeatLastSessionItem` | ✅                             |
| Wise import marcado pra evento                    | —                                                                                      | ❌ import não atribui a evento |


### E. LER / ACOMPANHAR


| Superfície                                                         | Onde                                                   | Estado                                 |
| ------------------------------------------------------------------ | ------------------------------------------------------ | -------------------------------------- |
| Card "ativo hoje" (sub-destination)                                | `DashboardCards.tsx` case `today_events` L449-508      | ✅                                      |
| Card "evento ao vivo" (consumido/restante/per-day/dias + 3 gastos) | case `live_event` L542-686                             | ⚠️ corta em "+N mais" **morto**        |
| "+N mais" (ver o resto)                                            | L648-651                                               | ❌ é texto, não navega                  |
| Heads-up "começa em N dias"                                        | case via `upcomingEvents` L513-539                     | ✅                                      |
| Tela/guia completo do evento (ritmo, tudo, saídas, histórico)      | —                                                      | ❌ não existe (DEC-401)                 |
| "+X do evento hoje" no hero                                        | `useDashboardModel.ts` `todayEventAllowanceCents` L347 | ✅                                      |
| Tocar no card do evento                                            | L463/L565 → `/trip/edit?occurrence=` (sheet de edição) | ⚠️ abre **edição**, não acompanhamento |


### F. SAÍDA dentro do evento (foco)


| O quê                                                            | Onde                                              | Estado                               |
| ---------------------------------------------------------------- | ------------------------------------------------- | ------------------------------------ |
| Card "saída ativa" (elapsed + gasto **da sessão** + drinks-left) | case `active_outing` L770-805 → `/outings/active` | ❌ **2º card**, mostra €0, redundante |
| Card do evento com saída ligada → botão "abrir saída"            | L658-664 → `/outings/active` (**mesmo destino**)  | ❌ duplica o card de saída            |
| Foco (teto/alertas/rounds/quick-add/drinks-left)                 | `OutingPage.tsx`                                  | ✅ (valor real do foco)               |


### G. ENCERRAR


| Gesto                                          | Onde                                                           | Estado                                            |
| ---------------------------------------------- | -------------------------------------------------------------- | ------------------------------------------------- |
| Encerrar a saída                               | `endOutingSession` L92-105                                     | ❌ marca `isConfirmed` no **evento** → evento some |
| Descartar a saída                              | `discardOutingSession` L154-165                                | ❌ desvincula/apaga o evento                       |
| "Encerrar o evento" explícito                  | —                                                              | ❌ não existe (DEC-400)                            |
| Sobra do evento encerrado (free/cofrinho/pote) | `selectPendingEventLeftovers`/`resolveEventLeftover` (DEC-387) | ✅ (mas dispara cedo demais, no fim da saída)      |


### H. OUTRAS interações


| O quê                                      | Onde                                           | Estado                                         |
| ------------------------------------------ | ---------------------------------------------- | ---------------------------------------------- |
| Acerto: gastos compartilhados num evento   | `splitting.ts`/acerto                          | ✅ entra no acerto normal                       |
| Acerto: ver que um gasto foi "do evento X" | —                                              | ❌ não rotula no acerto (nem precisa pro outro) |
| Apagar evento mantendo gastos              | `deleteEventKeepingExpenses` (DEC-386)         | ✅                                              |
| Copiloto/insights sobre o evento           | `copilot-insights.ts`/`buildDashboardInsights` | ⚠️ genérico, não "evento"                      |
| Notificação de ritmo do evento ("segura")  | —                                              | ❌ não existe                                   |
| Multi-fase / janela D-7                    | `isEventVisibleOnHome` L132-155                | ✅                                              |


---

## §3 — Mapa de fricção (o que está errado/confuso hoje)

1. **Dois cards (saída + evento)** — quando a saída é de um evento, o Home mostra `live_event` **e** `active_outing`; **ambos** navegam pra `/outings/active`. Redundância. → **Conselho E / DEC-409**.
2. **Saída mostra €0** — `active_outing` mostra `sessionTotalCents` (só a sessão); no início é €0, enquanto o evento mostra o total real → parece quebrado, quebra confiança. → **DEC-409**.
3. **"Iniciar agora" mente** — o gesto diz "iniciar" mas cria uma **saída**; não há "iniciar o evento". → **DEC-400**.
4. **Encerrar/descartar a saída mexe no evento** — `endOutingSession` confirma o evento; `discardOutingSession` desvincula/apaga. O evento some sem o usuário pedir. → **DEC-400**.
5. **Uma saída por evento** — não dá pra fazer várias idas. → **DEC-400**.
6. **"+N mais" morto** — esconde gastos sem caminho pra ver. → **DEC-401**.
7. **Tocar no card abre EDIÇÃO** — não acompanhamento. → **DEC-401**.
8. **Sobra dispara cedo** — hoje a sobra é resolvida ao fim da **saída** (via `isConfirmed`), não ao fim do **evento**. → **DEC-400** (sobra só no "encerrar evento").
9. **Saída parece obrigatória** — embora dê pra gastar direto; a UI empurra a saída como o caminho. → **DEC-400/409** (saída = modo foco **opcional**).
10. **IA não cria evento** — só gasto. (oportunidade §6)

---

## §4 — CONSELHO E (`/council`) · Relação saída ↔ evento (dois cards / €0 / foco)

> Inline, nesta sessão de autoria (1 request, sem subagentes).

**Decision Brief (neutro).** Com um evento ao vivo e uma saída iniciada, o Home renderiza dois cards independentes: `live_event` (consumido **real** do evento = atribuído + saída) e `active_outing` (gasto **só** da sessão, €0 no início), e os dois levam a `/outings/active`. Fatos: dá pra gastar no evento **sem** saída (atribuição direta já conta — DEC-386); a saída agrega teto/alertas/drinks-left/rounds (modo foco); DEC-400 fará saídas **N:1** com o evento (`session.occurrenceId`); só há **1 saída ativa** por vez (`sessionRepository.getActive`). Viés a resistir: "é só esconder um card" (a questão é qual é o hub e o que a saída agrega).

**Architect** — A saída é uma entidade genérica (serve pra uma noite de bar **sem** evento). A correção limpa usa o `session.occurrenceId` do DEC-400: quando a saída **pertence a um evento**, **não** renderizar o `active_outing` standalone; em vez disso **embutir** a saída ativa **dentro** do card/guia do evento (seção "saída ativa" com elapsed + tally da saída + teto/alertas + "abrir saída"), e o número grande do contexto é o **consumido do evento** (real). Saída **sem** evento mantém o card `active_outing` como hoje. Uma fonte de verdade visual por contexto, zero math nova. **Rec:** supressão condicional + embed. **Confidence:** HIGH. **Outros perdem:** depende do `session.occurrenceId` (G1) — sem ele não dá pra saber se a saída é de evento.

**Advocate** — O usuário pensa: o **evento** é o lugar; a saída é "agora tô na rua". Dois cards = ruído, e o €0 isolado é mentira visual. Quer **um** card do evento que, havendo saída ativa, mostre "🔴 saída ativa · €X · abrir" embutido, com o número grande sendo o do **evento**. E como dá pra gastar sem saída, a saída deve ser **secundária/opcional** — um botão "iniciar saída (modo foco)" pra quando quiser teto/alertas, não o caminho principal. **Rec:** card único do evento, saída embutida e opcional. **Confidence:** HIGH. **Outros perdem:** o caso comum (saída de bar **sem** evento) não pode regredir — mantém o card próprio.

**Critic** — Cuidado: a saída ativa é um estado que o usuário **precisa** enxergar (está gravando, tem teto). Se embutir no evento e o destaque sumir, ele perde o controle do teto. E há cantos: saída sem evento (comum), 2 eventos ao vivo + 1 saída (a saída pertence a 1 só via `occurrenceId`), saída que o usuário esquece aberta. **Rec:** embutir **com presença forte** (não subtexto), preservar teto/alertas, e manter o caminho saída-sem-evento intacto. **Confidence:** MED. **Outros perdem:** se a saída embutida ficar discreta demais, o teto deixa de proteger.

**Strategist** — "Evento com saídas embutidas" é um modelo superior ao dos concorrentes (que só têm 'trip' ou 'expense' avulso). O evento vira o **hub**; a saída, um sub-modo. Não explodir a UI. **Rec:** evento = hub, saída = sub-modo. **Confidence:** HIGH. **Outros perdem:** "iniciar saída" precisa aparecer **só depois** de "iniciar evento" (sequência do DEC-400) pra não reintroduzir o gesto enganoso.

**Red Team (matar o líder = "supressão condicional + embed").** E se a maioria das saídas NÃO tiver evento? Aí o embed só ajuda o caso evento+saída e adiciona um caminho a manter. E se o usuário quiser ver a saída ativa "sempre no mesmo lugar" independente de contexto? Resposta: o embed é **só** pra saída-de-evento; saída-sem-evento mantém exatamente o card de hoje (zero regressão no caso comum). Como só há **1 saída ativa**, não há "lista de saídas ativas" pra centralizar. O custo é uma renderização condicional, não um novo subsistema. O Red Team não derruba — só reforça que o caso sem-evento fica intacto.

**Síntese (Chair).** **Consenso:** o card `active_outing` standalone **não deve coexistir** com o card do evento quando a saída é **daquele** evento; a saída-de-evento vive **dentro** do card/guia do evento (com presença forte: elapsed + tally + teto/alertas + "abrir saída"); o número grande do contexto é o **consumido do evento** (real); saída-**sem**-evento mantém o card próprio; a saída é **opcional** pro gasto (atribuição direta basta). **Tensões:** Critic (não esconder a saída ativa) vs Advocate (um card só) → resolve embutindo **com destaque**, não escondendo. **Recomendação (lente dominante = Advocate + execução do Architect):** **DEC-409** — quando `session.occurrenceId` está setado, o Home **suprime** o `active_outing` standalone daquela saída; o card `live_event` (G1) e o guia (G2) mostram a **saída ativa embutida**; o número grande é o consumido do evento. **Condições:** `session.occurrenceId` (G1); teto/alertas preservados; destaque visual forte; caso saída-sem-evento intacto. **O que viraria:** se o caso evento+saída for raríssimo, o ganho é pequeno — mas como não há regressão no caso comum, segue valendo. **Confidence:** HIGH.

---

## §5 — A experiência-alvo (north star) — como o evento deve fluir

1. **Planejo** o evento (Planner/TripEdit) com reserva (ou track-only) e datas. Ele aparece como heads-up ("começa em N dias").
2. No dia (ou quando quiser), **"iniciar evento"** → o evento fica **ao vivo** no Home: um card com reserva/consumido/restante/per-day/dias + ritmo factual.
3. **Gasto** de duas formas, ambas contando certo: (a) lanço um gasto e marco "do evento" (sem saída); (b) **"iniciar saída"** quando quero o **modo foco** (teto/alertas/rounds) — a saída aparece **embutida** no card do evento, não como 2º card.
4. **Acompanho** tocando o card → **guia do evento** (`/event/:id`): tudo — total/uso/ritmo ("pode/segura"), **todas** as despesas por dia (onde/quando, com mapa), as **saídas** (cada uma com seu total), histórico.
5. Faço **quantas saídas** quiser; encerrar/descartar uma saída **nunca** mexe no evento.
6. No fim, **"encerrar evento"** → fecha saídas abertas + pergunta o destino da **sobra** (free/cofrinho/pote) → o evento sai da tela e tudo atualiza pra encerrado.
7. No **acerto**, os gastos do evento que dividi entram normalmente; o outro vê o item com local/detalhe (DEC-402), sem saber do meu fundo.

---

## §6 — Backlog de melhorias (priorizado) — "tudo que dá pra fazer"

**P0 (já no orquestrador):**

- Ciclo iniciar/saídas N:1/encerrar (DEC-400, G1).
- Guia do evento `/event/:id` (DEC-401, G2).
- Unificar card saída-de-evento (DEC-409, G1/G2).

**P1 (forte candidato a entrar):**

- **Ritmo factual + veredito do evento** no guia: "restam €X em N dias = €Y/dia; hoje você já gastou €Z" + tom (pode/segura). Reusa `eventDailyAllowanceCents`.
- **Saída opcional explícita**: o botão primário do evento é "registrar gasto do evento"; "iniciar saída (foco)" é secundário.
- **Histórico/timeline do evento**: o que foi feito, quando (lê de `buildLiveEventProgress.expenses` + saídas).

**P2 (explorar depois):**

- **IA cria evento** ("vou no show sábado, reservo €100") → `plan_event` ExecOp.
- **Wise/import atribuível a evento** (paridade com DEC-389/386).
- **Notificação de ritmo** do evento ("você está acima do ritmo do evento X").
- **Copiloto ciente de evento** (insight dedicado quando um evento domina o gasto do dia).
- **Múltiplas saídas ativas** (hoje só 1) — se algum dia fizer sentido.
- **Encerrar evento com resumo** ("Tomorrowland: €420 de €500, sobra €80 → cofrinho").
- **Rotular no acerto** que um item foi de um evento (opcional, só se ajudar o outro).

---

## §7 — Perguntas em aberto pro Julio (decisões de produto)

1. **Botão primário do evento ao vivo:** "registrar gasto do evento" (atribuição direta) **ou** "iniciar saída"? (recomendo gasto direto primário, saída secundária).  
sim gasto primario.  

2. **"Iniciar evento" é necessário** ou o evento já fica "ao vivo" sozinho quando a data chega (e o gesto vira "encerrar quando acabar")? (Julio pediu explícito o "iniciar evento"; `startedAt` cobre os dois).  
acho legal iniciar o evento  

3. **Guia do evento** deve permitir **editar** o evento (reserva/datas) ou só acompanhar + encerrar? (recomendo acompanhar + encerrar; editar continua no sheet).  
acho que pode permitir editar sim, mas algo como um botão de editar evento que leva ao mesmo sheet ja existente mostrando o evento para editar.  
  

4. **IA cria evento** entra nesta leva (novo gate) ou vira leva futura? (recomendo futura — esta já é grande).  
pode colocar nessa agora.  

5. **Ritmo/veredito**: quão "opinativo" pode ser ("segura!") vs factual puro? (recomendo factual com leve tom).  
factual acho..

---

## §8 — Como isto alimenta o orquestrador

- **G1** (DEC-400) ganha o **DEC-409 m**: ao adicionar `session.occurrenceId`, suprimir o `active_outing` standalone da saída-de-evento e **embutir** a saída ativa no card `live_event` (elapsed + tally + teto/alertas + abrir). Botão primário = gasto direto; "iniciar saída" secundário.
- **G2** (DEC-401) embute a **saída ativa** também no guia `/event/:id`, com a timeline/histórico e o ritmo factual.
- Sem mudança de math; tudo aditivo. As perguntas do §7 podem refinar o escopo antes de G1.

