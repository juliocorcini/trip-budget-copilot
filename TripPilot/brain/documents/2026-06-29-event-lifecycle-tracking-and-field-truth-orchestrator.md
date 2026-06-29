# Orquestrador — "O evento de verdade (ciclo + guia), o acerto que reconcilia, e captura/local sem atrito"

> Método: `.cursor/skills/implementation-orchestrator/SKILL.md`. Single session, 1 agente, sem subagentes (cost-constitution). Deploy por gate (Pages OTA; o **worker muda** em G4 e G8 — e possivelmente G7 — ver §13). Base `1.8.7-rc` (DEC-399 shipped). Novos DECs **DEC-400 → DEC-410** (PROPOSED no decision-log; viram APPROVED ao fechar cada gate).
>
> **Status: ✅ LOCKS + DECISÕES DE PRODUTO CONFIRMADOS (2026-06-29).** G0 pode rodar já. As 5 travas = **(a)**. Decisões de produto do evento (do doc de exploração `2026-06-29-event-experience-exploration.md`, §7) confirmadas pelo Julio e **dobradas aqui** (este doc é a fonte de execução; a exploração é o "porquê"/backlog):
> - **Botão primário do evento ao vivo = registrar gasto do evento** (atribuição direta); "iniciar saída (foco)" é secundário (DEC-409).
> - **Guia do evento = EDITÁVEL via botão "editar evento" → abre o sheet de edição já existente** (reuso, não editor novo no guia), além de acompanhar + encerrar (DEC-401).
> - **IA cria evento = SIM, nesta leva** → novo **G8** (DEC-410, worker).
> - **Ritmo do guia = factual com números + veredito leve** ("€Y/dia · hoje €Z · no ritmo/segura um pouco") — factual-first (DEC-401).
> - **DEC-409** (unificar o card de saída-de-evento dentro do evento) entra em **G1 (supressão/embed no card) + G2 (embed no guia)**.

---

## §0 — TL;DR

Julio listou 12 pontos numa tacada. Dois já estão **corretos** e só precisam de teste-prova (não de código); os outros 10 viram trabalho, em 7 gates por risco/dependência:

1. **(✓ já certo)** A conta do evento conta **só a minha parte** — `event-budget.ts` usa `transactionBasePersonalCostCents` em todo lugar. €30÷3 entra como €10. → **prova com teste, zero código.**
2. **Guia do evento** — hoje o card mostra 3 gastos e esconde o resto em "+N mais" sem saída. Falta uma **tela completa** de acompanhamento (total, uso, ritmo, "segurar?", todas as despesas com onde/quando/como, saídas, histórico). → **G2**.
3. **Ciclo de vida do evento** — hoje "iniciar agora" abre uma saída e **encerrar/descartar a saída faz o evento sumir** (`endOutingSession` marca `isConfirmed`; `discardOutingSession` desvincula/apaga). Quer: **iniciar evento → iniciar saída (várias) → encerrar evento**. → **G1 (keystone)**.
4. **(✓ já certo)** O que eu devo (lançado como gasto) **já sai** do livre — `calculatePoolSpent` soma o custo pessoal. → **prova com teste + nota; zero math.**
5. **Acerto que reconcilia** — o link manda as despesas, mas **não as quitações**: net mostra €50 e os itens somam €70 (o pagamento de €20 é invisível). E falta **local/detalhe por item** pro destinatário. → **G3**.
6. **IA escreve a descrição** — hoje vem a **categoria** ("Outros") como descrição. → **G4 (worker)**.
7. **Buscar lugar por nome → GPS real** — todo seletor de local só mostra próximos/recentes; falta um **campo de busca** que resolve coordenadas reais (`searchPlaceByName` já existe, não está plugado na UI). → **G5**.
8/9. **Mapa do gasto** — ao expandir, o mapa **rola junto com a página** e o retângulo inline **aparece por cima** do expandido. → **G6**.
10. **Card flutuante** — rolar dentro de um campo de texto **dispara o fechar** do menu. → **G6**.
11. **(conselho pedido)** Sem descrição mas com local → **usar o local como descrição?** Sim, com cadeia de fallback. → **G4** (DEC-403).
12. **Colar imagem no campo da IA** — no Android, colar imagem(ns) no textarea e, ao enviar, processá-las como a função de foto já faz. → **G7**.

**Refinamentos (2026-06-29, doc de exploração + decisões do Julio):**
- **Dois cards (saída + evento)** viram **um**: a saída-de-evento fica **embutida** no card/guia do evento; botão primário = **gasto direto** (saída = foco opcional). → **DEC-409 (G1/G2)**.
- **IA cria evento** ("vou no show sábado, reservo €100"). → **DEC-410 (novo G8)**.
- **Guia editável** via botão → sheet existente + **ritmo factual (com números, veredito leve)**. → **DEC-401 (G2)**.

---

## §1 — Missão

Fazer o **evento** ser uma entidade de verdade com **ciclo próprio** (iniciar → várias saídas → encerrar) e um **guia completo** de acompanhamento; fazer o **acerto compartilhado reconciliar** (despesas + pagamentos + local por item) sem vazar nada privado; e tirar o **atrito de captura** (IA escreve descrição, colar imagem, buscar lugar por nome) e os **bugs de mapa/card**. Tudo sem mexer na **aritmética do dinheiro** (livre/Trecho/Pote/net-do-owner invariantes), aditivo no schema (sem migração), nunca bloqueando.

---

## §2 — Não-negociáveis (ÂNCORAS)

- **Â-MONEY-INVARIANT** — livre do hero, totais Trecho/Pote e net total do owner ficam **idênticos ao baseline**. A única mudança de math é **somar múltiplas saídas** do evento (G1), preservando o no-double-count **bit-a-bit** (prova com teste de invariância).
- **Â-EVENT-LIFECYCLE** (novo, G1) — o evento tem ciclo próprio: `planned → started → ended`. **Encerrar ou descartar uma SAÍDA nunca encerra nem apaga o evento.** O evento só sai da tela quando **explicitamente encerrado**.
- **Â-EVENT-NO-DOUBLE-COUNT** (G1) — consumido do evento = atribuído (`occurrenceId`) **+ Σ saídas do evento** (`session.occurrenceId`); cada gasto contado **uma vez** (tx é `occurrenceId` XOR `sessionId` — Â-ATTRIBUTION mantida).
- **Â-SETTLE-RECONCILES** (novo, G3) — as linhas que compartilho **somam ao net real**: despesas **e** pagamentos. Nunca net €50 com itens €70.
- **Â-SHARE-PRIVACY** (G3) — o destinatário vê só o que faz sentido pra ELE (descrição, data, categoria, **local/mapa**), **nunca** meu fundo/wallet/pool/saldo interno.
- **Â-PLACE-REAL** (G5) — escolher um lugar resolve **coordenadas reais** (forward-geocode), não uma string solta.
- **Â-AI-MEANINGFUL** (G4) — a IA escreve uma **descrição de verdade**; o app **nunca** usa a categoria como descrição (fallback: descrição → local → rótulo neutro).
- **Â-NEVER-BLOCK** (A5 herdado) — nenhum caminho de gasto/IA/import bloqueia; geocode/OCR/IA são best-effort e falham em silêncio.
- **Â-ADDITIVE-SCHEMA** — todo campo novo é **aditivo/opcional** (`.passthrough()`), **sem migração Dexie**; payloads/registros antigos leem `undefined`.
- **Â-MAP-NO-TRAP** (herdado DEC-398, reforçado G6) — o mapa nunca prende a rolagem; o expandido é **fixo de verdade** (portal) e os controles ficam sempre visíveis.
- **t() em tudo, código em inglês**, comentários explicam o "porquê".

---

## §3 — Baseline (o que JÁ existe e funciona — reusar, não recriar)

- **Reserva consumível do evento (DEC-385/386)** — `domain/budget/event-budget.ts`: `eventAttributedSpent`, `eventConsumedSpentCents`, `eventReserveRemainingCents`, `eventDailyAllowanceCents`, `buildLiveEventProgress`. **Tudo já usa `transactionBasePersonalCostCents`** (= só a minha parte). **Ponto 1 do Julio JÁ está certo.**
- **Evento ao vivo no Home (DEC-390)** — `domain/planning/occurrences.ts › isEventInProgress`; render em `features/dashboard/DashboardCards.tsx` (case `live_event`, ~L542-686): título, consumido/reservado, barra, restante/per-day/dias, **3 gastos + "+N mais"** (L648-651), botões.
- **Sobra do evento encerrado (DEC-387)** — `event-budget.ts › isEventLeftoverPending/selectPendingEventLeftovers`; `outing-orchestrators.ts › resolveEventLeftover` (free/piggy/pot, conserva 1:1).
- **Atribuição XOR (DEC-386)** — `transaction.ts › occurrenceId?`; factory dropa `sessionId` quando há `occurrenceId`. `event-budget.ts › isEventSessionExclusive`.
- **Statement por participante (DEC-102) + ego-cêntrico (DEC-394/399)** — `splitting.ts › buildParticipantStatement` (linhas owes/is_owed + `settlements[]` + `netCents`), `filterStatementToCounterparty`; payload em `domain/sync/statement-payload.ts` (`buildStatementPayload`, `buildParticipantSharePayload`, `thirdParty?`). Guest: `features/shared/MirroredStatementsSection.tsx`; link `/s/:id` → `SharedLinkPage` → `ingestSharedLink` → `/shared-with-me`.
- **Lugar (DEC-389/367)** — `utils/places.ts`: `searchNearbyPlaces` (Overpass), `reverseGeocodePlace` (coords→nome), **`searchPlaceByName` (nome→coords, JÁ EXISTE)**; UI `features/location/PlaceField.tsx`; stamp `features/location/stamp-expense-location.ts`. Gasto carrega `placeLabel/latitude/longitude/placeId/placeNameSource` (`transaction.ts`).
- **Mapa (DEC-398)** — `features/location/ExpenseLocationMap.tsx` (`ExpenseLocationMap` com `interactive?`, preview `pointer-events-none`; `ExpenseLocationMapField` = preview→overlay).
- **BottomSheet (DEC-022/193/194/195)** — `components/BottomSheet.tsx`: portal pra `app-overlay-root`, drag-to-dismiss (`decideBodyDrag`, `onBodyTouchStart/Move`), back nativo + Escape.
- **IA (DEC-397)** — `features/assistant/useAssistant.ts` (`runPlan`, `confirm`, `confirmBatch`, `scanReceiptPhoto`→`extractReceiptViaCloud`), `AssistantSheet.tsx` (`InputArea` com textarea + câmera via `useImageSourceChooser`); planner no worker `worker/src/index.ts` (`buildAssistantSystemPrompt`, L294+).

---

## §4 — O problema (causa-raiz lida no código, confiança ALTA)

1. **Evento some ao fechar a saída** — `outing-orchestrators.ts › endOutingSession` (L92-105): ao encerrar a saída, acha a occurrence com `linkedSessionId === session.id` e **seta `isConfirmed = true`** → reserva para, prompt de sobra dispara, evento sai do Home. E `discardOutingSession` (L154-165): evento com reserva → **desvincula** (`linkedSessionId: null`); sem reserva → **soft-delete**. Em ambos o evento "desaparece". Modelo atual amarra **um** evento a **uma** saída (`linkedSessionId` único). **→ G1.**
2. **Sem guia do evento** — o detalhe do evento é só o **sheet de edição** (`/trip/edit?occurrence=`); o card ao vivo corta em 3 gastos com "+N mais" **morto** (texto, não navega). Não há tela de acompanhamento (ritmo, todas as despesas, onde/quando, saídas, histórico). **→ G2.**
3. **Acerto não reconcilia** — `statement-payload.ts`: o payload carrega `netCents` (que **inclui** quitações) e `lines` = **só shares de despesa** (owes/is_owed); **não há array de settlements** no payload. Resultado: net €50, itens somam €70, o pagamento de €20 é **invisível** pro Bruno. E `statementLineSchema` (L20-31) **não tem campos de local** → o destinatário não vê onde foi o gasto. **→ G3.**
4. **IA manda categoria como descrição** — worker `buildAssistantSystemPrompt` (L342): *"description = a short human label … **when stated**"* → o modelo deixa `description` vazio quando não foi dito explicitamente; aí `useAssistant.ts` (L706-708 e L770-772) faz fallback **`t('categories.${op.category}')`** → "Outros". **→ G4.**
5. **Sem busca de lugar por nome** — `PlaceField.tsx` tem renomear (string solta), usar GPS atual, próximos, "achar nome online" (reverse dos coords atuais) e recentes — **mas nenhum campo que digita um nome e resolve coordenadas reais**. `searchPlaceByName` existe (DEC-389) mas só roda no save da IA/Wise, nunca exposto ao usuário. **→ G5.**
6. **Mapa expandido rola junto + retângulo por cima** — `ExpenseLocationMap.tsx › ExpenseLocationMapField`: o overlay é `fixed inset-0 z-50` **sem portal** → dentro de um ancestral transformado (página rolável) o `fixed` vira relativo ao ancestral (rola junto, esconde header/X); e os panes do Leaflet inline (z-index 200-700) **furam** o `z-50`. **→ G6.**
7. **Card fecha ao rolar texto** — `BottomSheet.tsx › onBodyTouchStart` (L122-131): só checa `bodyRef.scrollTop`. Um textarea/scrollable aninhado scrolla internamente (bodyRef fica em scrollTop 0), então `decideBodyDrag` retorna `drag` e começa a fechar. **→ G6.**
8. **Sem colar imagem na IA** — `AssistantSheet.tsx › InputArea` (textarea L325-340) **não tem `onPaste`**; o caminho de foto é **uma** imagem via `scanReceiptPhoto`→`extractReceiptViaCloud`. Não dá pra colar/acumular imagens no campo de texto. **→ G7.**

---

## §5 — Princípios de design

- **Reuse-first.** O evento reusa a reserva consumível (DEC-385), a sobra (DEC-387) e o `buildLiveEventProgress` (DEC-390). O acerto reusa `buildParticipantStatement`/`filterStatementToCounterparty`/`buildParticipantSharePayload` (DEC-394/399). O lugar reusa `searchPlaceByName` (DEC-389). O mapa reusa `ExpenseLocationMapField` (DEC-398) — inclusive no guest do acerto. O paste reusa `extractReceiptViaCloud` (DEC-397/206).
- **Schema aditivo.** `Session.occurrenceId?`, `PlannedOccurrence.startedAt?`, `statementLineSchema.place*` + `statementPayloadSchema.settlements?` — todos opcionais, `.passthrough()`, sem migração.
- **Math num lugar só.** A soma de múltiplas saídas vive em `eventConsumedSpentCents`; tudo (livre, detalhe, guia) lê de lá → invariância garantida por construção.
- **Privacidade no domínio.** O que o guest vê é decidido por funções puras testáveis (não na UI).
- **Nunca bloquear.** Geocode/OCR/IA best-effort; confirm 1-toque intacto.

---

## §6 — Mapa causa-raiz → correção (arquivo › símbolo › fix › gate)

| # | Sintoma | Arquivo › símbolo | Causa-raiz | Fix | Gate |
|---|---|---|---|---|---|
| 1 | Evento conta só minha parte? | `domain/budget/event-budget.ts › liveSpendBaseCostCents` | — | **Já certo** (`transactionBasePersonalCostCents`); só teste-prova | G0 |
| 2 | Evento some ao fechar saída | `domain/orchestrators/outing-orchestrators.ts › endOutingSession` L92-105; `discardOutingSession` L154-165; `startSessionForOccurrence` | 1 saída = 1 evento; fim/descartar saída confirma/apaga evento | `Session.occurrenceId?` + `PlannedOccurrence.startedAt?`; ações iniciar-evento/iniciar-saída/encerrar-evento; fim de saída **não** confirma evento; consumido soma todas as saídas; descartar saída não toca evento | G1 |
| 3 | Sem guia do evento | `features/dashboard/DashboardCards.tsx` case `live_event` L542-686 ("+N mais" morto) | detalhe = só sheet de edição | Nova **EventGuidePage** (rota) com total/uso/restante/ritmo + **todas** as despesas (onde/quando/como) + saídas + histórico + encerrar | G2 |
| 4 | Livre desconta o que devo? | `domain/budget/budget.ts › calculatePoolSpent` | — | **Já certo** (custo pessoal entra no spent); teste-prova + nota | G0 |
| 5 | Acerto não reconcilia | `domain/sync/statement-payload.ts › statementPayloadSchema` L47-65 (sem settlements; line sem local) | payload só leva despesas; net inclui quitações invisíveis | `statementPayloadSchema.settlements?` (linhas de pagamento) + `statementLineSchema.place*`; `StatementLine` ganha local; guest renderiza pagamentos + detalhe/mapa | G3 |
| 6 | IA manda "Outros" | `worker/src/index.ts › buildAssistantSystemPrompt` L342 + `useAssistant.ts` L706-708/L770-772 | prompt "when stated" + fallback = categoria | prompt **sempre** escreve descrição curta; fallback do device = descrição → `placeLabel` → rótulo neutro (nunca categoria) | G4 |
| 7 | Sem busca de lugar | `features/location/PlaceField.tsx` (sem search); `utils/places.ts › searchPlaceByName` (existe, não plugado) | UI nunca expôs forward-geocode | campo de busca + resultados → escolher salva **coords reais**; melhora a UI | G5 |
| 8/9 | Mapa rola junto + retângulo por cima | `features/location/ExpenseLocationMap.tsx › ExpenseLocationMapField` | overlay `fixed` sem portal (ancestral transformado) + z dos panes Leaflet | `createPortal(overlayHost())` + z acima do Leaflet; preview já `pointer-events-none` | G6 |
| 10 | Card fecha ao rolar texto | `components/BottomSheet.tsx › onBodyTouchStart` L122-131 | só checa bodyRef.scrollTop, ignora scrollable aninhado | bail quando o toque nasce dentro de textarea/input/`[contenteditable]`/`[data-no-sheet-drag]`/scrollable que ainda pode rolar | G6 |
| 11 | Local como descrição? | `useAssistant.ts` (fallback) | — | **Conselho C**: sim, cadeia descrição→local→neutro (parte do G4) | G4 |
| 12 | Colar imagem na IA | `features/assistant/AssistantSheet.tsx › InputArea` (sem onPaste) | textarea sem paste; foto é 1 imagem | `onPaste` captura imagem(ns) → acumula (thumbs) → no enviar, OCR cada uma + funde com o texto no fluxo de lote | G7 |

---

## §7 — Conselhos (inline, nesta sessão de autoria — 1 request, sem subagentes)

> Cost contract: os 4 conselhos abaixo rodaram **inline** na sessão de autoria deste doc (não geram request por agente). Cada um: Brief neutro → vozes cegas → red team → síntese → DEC.

### Council A — `/council` · Modelo do ciclo de vida do evento (keystone) → **DEC-400**

**Decision Brief (neutro).** Hoje um evento (`PlannedOccurrence`) amarra-se a **uma** saída via `linkedSessionId`; encerrar a saída seta `isConfirmed` (encerra o evento) e descartar desvincula/apaga. Julio quer: **iniciar o evento** (sem saída), depois **iniciar saída** (várias, abre/fecha), e **encerrar o evento** explicitamente (só aí some). Fatos: reserva consumível (DEC-385) e sobra (DEC-387) dependem de `isConfirmed`=encerrado; atribuição é tx `occurrenceId` XOR `sessionId`; `eventConsumedSpentCents` hoje soma atribuído + **uma** `linkedSessionId`. Viés a resistir: "é só renomear o botão" (o problema é o modelo 1:1, não o label).

**Architect** — O acoplamento 1:1 é a doença. Mínimo coerente e aditivo: (1) `Session.occurrenceId?: string|null` → uma saída pertence a um evento; várias saídas, um evento. (2) `eventConsumedSpentCents` = atribuído (`occurrenceId` na tx) **+ Σ** spend das sessions com `session.occurrenceId === occ.id` (em vez do `linkedSessionId` único) — mantém tx XOR, zero double-count. (3) `endOutingSession` **para de** setar `isConfirmed` no evento. (4) `startedAt?` marca "evento iniciado". (5) "encerrar evento" = caminho DEC-387 (isConfirmed + sobra). Reusa tudo; legado lê `linkedSessionId` como compat. **Rec:** decouple aditivo. **Confidence:** HIGH. **Outros perdem:** sem migração, mas `buildLiveEventProgress.linkedSessionId` (singular) precisa virar "tem saída ativa?" derivado das sessions.

**Advocate (user)** — O modelo mental do Julio é claríssimo: o evento é o "guarda-chuva" (uma festa de 3 dias), as saídas são idas pontuais. "Encerrei a saída e o evento sumiu" é traição de modelo mental. Tem que ter 3 gestos distintos: **iniciar evento** (vira "ao vivo"), **iniciar saída** (aparece só depois de iniciado), **encerrar evento** (só aqui some). Encerrar/descartar saída tem que ser obviamente seguro pro evento. **Rec:** 3 gestos explícitos + evento persiste. **Confidence:** HIGH. **Outros perdem:** o estado "iniciado mas sem saída" precisa existir e mostrar gasto direto (atribuído) sem exigir saída.

**Critic (devil's advocate)** — Risco: dois jeitos de gastar num evento (atribuído direto vs via saída) podem **contar duas vezes** se a soma incluir os dois sem cuidado. E `discardOutingSession` hoje tem lógica reserva-vs-one-off que, se uma saída agora pertence a um evento, **não pode** apagar o evento. Pior caso: encerrar evento com saída **ainda aberta** → o que acontece com a saída? **Rec:** travar invariante de no-double-count com teste e definir "encerrar evento fecha as saídas abertas dele". **Confidence:** MED. **Outros perdem:** o `endOutingSession` legado (linkedSessionId) tem que continuar funcionando pra eventos antigos no meio do caminho.

**Strategist** — Evento robusto é diferencial (concorrentes fazem "trip", não "evento dentro da fase com reserva e saídas"). Mas não vire um mini-pool/fase (over-engineering rejeitado na parte 1). O sweet spot: evento = entidade leve com **status derivável** (planned/started/ended) e saídas N:1, reusando reserva/sobra. **Rec:** entidade leve, status, N:1. **Confidence:** HIGH. **Outros perdem:** "iniciar evento" pode ser implícito (data chegou) — mas Julio quer **explícito**; `startedAt` resolve ambos (gesto OU data).

**Red Team (matar o líder = "decouple aditivo").** Se `Session.occurrenceId` e `occurrenceId` direto coexistem, a superfície de bug de contagem dobra; e o `linkedSessionId` legado vira um terceiro caminho → 3 fontes de "spend do evento". Poderia ser **mais simples** manter `linkedSessionId` e só adicionar flags de start/end (uma saída por vez). Resposta: uma saída por vez **contradiz** o pedido ("várias saídas no mesmo evento"). Mitigação do triplo-caminho: `eventConsumedSpentCents` vira **uma** função que soma `occurrenceId`-direto **∪** sessions-do-evento (tratando `linkedSessionId` legado como uma session-do-evento), com **teste de invariância** provando = baseline pra eventos de 1 saída. O triplo-caminho colapsa em um.

**Síntese (Chair).** **Consenso:** decouple aditivo, evento N:1 com status, reusa reserva/sobra, sem migração. **Tensões:** Critic quer garantia anti-double-count + regra de "encerrar com saída aberta"; Strategist quer leveza; Advocate quer 3 gestos. **Recomendação (lente dominante = Advocate + execução do Architect):** **DEC-400** — `Session.occurrenceId?` + `PlannedOccurrence.startedAt?` (aditivos); `eventConsumedSpentCents` soma atribuído ∪ sessions-do-evento (legado `linkedSessionId` incluso); `endOutingSession` **não** confirma o evento; `discardOutingSession` nunca toca o evento; ações **iniciar evento / iniciar saída / encerrar evento** (encerrar = DEC-387; encerra saídas abertas do evento primeiro). **Condições:** teste de invariância (evento de 1 saída = baseline bit-a-bit) + teste de 2 saídas (soma certa, sem double-count) + teste "encerrar saída mantém evento ao vivo". **O que viraria:** se a soma ∪ ficar arriscada → **L-EVENT-LIFECYCLE alt (b)**: mantém `linkedSessionId` único, só adiciona start/end explícitos (uma saída ativa por vez, as outras viram histórico) — mais pobre, mas trivial. **Confidence:** HIGH.

### Council B — `/council` · Superfície do guia do evento → **DEC-401**

**Decision Brief (neutro).** O card ao vivo mostra 3 gastos + "+N mais" (texto morto). Julio quer "uma tela completa OU um menu flutuante" pra acompanhar **tudo**: total, uso, ritmo ("segurar?"), todas as despesas (onde/quando/como), navegar e lembrar o que já foi feito. `buildLiveEventProgress` já dá consumido/restante/per-day/dias/expenses. Viés a resistir: "expandir o card resolve" (Julio falou em "tela completa" e "guia/navegar").

**Advocate** — É um **guia**, não um popover. "Navegar pelo evento, entender, lembrar o que já foi feito" = uma página dedicada com seções: cabeçalho (reserva/consumido/restante/ritmo + veredito "pode/segura"), saídas (cada uma com seu total), **todas** as despesas agrupadas por dia com local/categoria, e o botão encerrar. Tocar no card → essa página. **Rec:** página dedicada. **Confidence:** HIGH. **Outros perdem:** precisa funcionar pra evento **track-only** (sem reserva) também.

**Architect** — Reusar `buildLiveEventProgress` estendido (já é puro, view-model). Página nova `EventGuidePage` (rota `/event/:id`), lazy. Sem novo cálculo: ritmo/veredito derivam de `perDayCents` vs gasto-de-hoje (mesma régua do DEC-393). Cada despesa reusa o item de lista de gastos existente (com mini-mapa via `ExpenseLocationMapField`). **Rec:** rota lazy + view-model estendido. **Confidence:** HIGH. **Outros perdem:** "agrupar por saída" exige saber a session de cada despesa (já temos `source: attributed|outing` + sessionId).

**Critic** — Uma página cheia pode ficar pesada/lenta com 200 gastos. E "veredito" (segura/pode) é subjetivo — se errar, perde confiança. **Rec:** virtualizar/limitar e tornar o veredito factual ("no ritmo: restam €X em N dias = €Y/dia; hoje você já gastou €Z"). **Confidence:** MED. **Outros perdem:** estado vazio (evento iniciado, zero gasto) precisa ser bonito, não um buraco.

**Síntese (Chair).** **Consenso:** página dedicada reusando o view-model; despesas completas com local; encerrar ali. **Tensões:** Critic (peso + veredito factual) vs Advocate (riqueza). **Recomendação (lente = Advocate + Architect):** **DEC-401** — `EventGuidePage` (`/event/:id`, lazy), seções cabeçalho/ritmo/saídas/despesas-por-dia(com local)/**editar (botão→sheet existente)**/encerrar; card e "+N mais" passam a **navegar** pra cá. **Decisões do Julio (2026-06-29) dobradas:** (1) editar = **botão "editar evento" que abre o sheet de edição já existente** (reuso, não um editor novo no guia), além de acompanhar + encerrar; (2) o **ritmo** é **factual com números** + veredito **leve** ("restam €X em N dias = €Y/dia; hoje você já gastou €Z" + cue curto "no ritmo"/"segura um pouco" — factual-first); (3) a **saída ativa** do evento aparece **embutida** aqui (DEC-409), não como card separado. **Condições:** estado vazio cuidado; track-only suportado; editar reusa o sheet/validação do TripEdit (sem nova math). **O que viraria:** **L-EVENT-SURFACE alt (b)** = bottom-sheet expansível em vez de rota. **Confidence:** HIGH.

### Council C — `/council` · Descrição da IA quando vazia (pedido explícito do Julio) → **DEC-403**

**Decision Brief (neutro).** A IA hoje manda a **categoria** como descrição ("Outros"). Worker diz "description … when stated" → vem vazio; device cai em `t('categories.${category}')`. Julio: "se não tiver descrição mas tiver local, usa o local? a própria IA podia escrever a melhor descrição." Viés a resistir: "é só trocar o fallback" (o ideal é a IA escrever **e** um fallback decente).

**Advocate** — O usuário quer ler "Cerveja no Bar do Zé", não "Outros". Duas frentes: (1) a IA **sempre** escreve uma descrição curta (o melhor palpite do que foi); (2) se mesmo assim vier vazia, **local** ("Bar do Zé") é uma descrição muito melhor que a categoria. Categoria como descrição é o **pior** fallback. **Rec:** IA escreve + fallback descrição→local→neutro. **Confidence:** HIGH. **Outros perdem:** se nem local houver, um rótulo neutro ("Gasto") é melhor que "Outros" (que confunde com a categoria literal).

**Architect** — Duas mudanças baratas e independentes: prompt do worker (G4 muda o worker mesmo) + cadeia de fallback no device (`useAssistant.ts`, os 2 pontos). A cadeia tem que rodar **depois** que o local foi resolvido (ou usar `op.place`/`placeLabel` se já presente no draft). **Rec:** prompt + cadeia pura testável. **Confidence:** HIGH. **Outros perdem:** o `place` da IA pode ser nome bruto ("zé") — usar como descrição crua pode ficar feio; capitalizar/usar o `placeLabel` resolvido é melhor (mas não bloquear esperando geocode).

**Critic** — Forçar a IA a "sempre descrever" pode gerar alucinação ("Jantar romântico" pra um lançamento de €4). Melhor pedir **factual e curto** ("o que foi", não "invente"). E usar local como descrição pode duplicar info (a UI já mostra o local). **Rec:** prompt factual; local como descrição só quando **não** há descrição, e a UI evita repetir local+descrição idênticos. **Confidence:** MED.

**Red Team.** Se a descrição = local e o local também aparece no item, fica redundante ("Bar do Zé" / "Bar do Zé"). Mitigação: quando a descrição vier do local (fallback), a UI do item **não** repete o local como subtítulo (flag de origem). E o prompt pede descrição **só do que dá pra inferir** do texto, nunca inventar.

**Síntese (Chair).** **Consenso:** IA escreve descrição factual curta; categoria **nunca** é descrição. **Tensões:** Critic (alucinação/redundância) vs Advocate (riqueza). **Recomendação (lente = Advocate, temperada pelo Critic):** **DEC-403 / L-AI-DESC default (a)** — (1) prompt do worker: "description = sempre um rótulo humano curto do que foi, factual, derivado do texto; nunca a categoria"; (2) device: cadeia `description (trim) → placeLabel → t('assistant.expense_fallback')` (rótulo neutro), **nunca** `t('categories.*)`; (3) item não repete local quando a descrição veio do local. **Condições:** prompt factual (sem inventar); fallback não bloqueia em geocode. **O que viraria:** **alt (b)** = só corrige o fallback (descrição→local→neutro) sem tocar o worker (se não quiser redeploy do worker agora). **Confidence:** HIGH.

### Council D — `/council` · Acerto que reconcilia + privacidade do item → **DEC-402**

**Decision Brief (neutro).** O link manda `netCents` (que **inclui** quitações) + `lines` = só despesas. O Bruno vê itens somando €70 mas net €50 — o pagamento de €20 some. E a linha não tem **local**. Julio: "tem que aparecer o item de €20 que paguei; e cada item, o destinatário poder ver detalhes/local; não precisa falar do meu fundo, só o que faz sentido pra ele." Viés a resistir: "é só mostrar o net" (Julio quer **rastreabilidade item a item**).

**Advocate** — Reconciliação é confiança: o Bruno tem que **somar na mão** e bater. Então as **quitações** têm que virar linhas ("Você me pagou €20" / "Paguei você €X") junto das despesas, e o net = soma das linhas. E poder tocar um item e ver **local no mapa** + descrição/data/categoria. **Rec:** settlements como linhas + local por item. **Confidence:** HIGH. **Outros perdem:** o sinal importa — "você me pagou" reduz o que ELE me deve; a direção tem que ficar óbvia.

**Architect** — `ParticipantStatement` **já tem** `settlements[]`; o que falta é o **payload** carregá-las e o guest renderizar. Aditivo: `statementPayloadSchema.settlements?` (id, direção do ponto de vista do destinatário, valor, data, nota) + `statementLineSchema.place*` (label/lat/lng/placeId). `StatementLine` (splitting) ganha local (já copia descrição/categoria da tx). Guest reusa `ExpenseLocationMapField`. **Rec:** schema aditivo + reusa mapa. **Confidence:** HIGH. **Outros perdem:** `filterStatementToCounterparty` já mantém só owner↔pessoa (settlements inclusas) — a redação ego-cêntrica do DEC-399 continua valendo.

**Critic (privacidade)** — Mandar lat/lng exato de cada gasto pode expor mais do que o necessário (casa, hotel). E nunca pode vazar fundo/wallet/pool. **Rec:** local **opt-in/already-known** — mandar `placeLabel` sempre é ok; coords/mapa só quando o gasto **foi compartilhado com aquela pessoa** (ele participou) e o owner não desligou. **Confidence:** MED. **Outros perdem:** legado sem local lê `undefined` (sem mapa) — ok.

**Red Team.** Expor coords de **todos** os itens a um terceiro é o maior risco. Mitigação (vira o lock): **L-SETTLE-DETAIL default (a)** = manda label+coords+mapa **só** das despesas que aquela pessoa **participou** (ela já esteve lá); descrição/data/categoria sempre; **nunca** fundo/wallet/pool/saldo. Quitações sempre como linhas. Se o owner quiser zero coords → alt (b).

**Síntese (Chair).** **Consenso:** quitações viram linhas (net reconcilia) + detalhe/local por item, nunca dado interno. **Tensões:** Advocate (riqueza) vs Critic (coords). **Recomendação (lente = Advocate + Architect, cinto do Critic):** **DEC-402 / L-SETTLE-DETAIL default (a)** — payload ganha `settlements?` (linhas de pagamento com direção) e `statementLineSchema.place*`; guest mostra pagamentos + "ver detalhes/local" (mapa via `ExpenseLocationMapField`) das despesas que a pessoa participou; descrição/data/categoria sempre; fundo/wallet/pool **nunca**. **Condições:** net = Σ linhas (despesas + quitações) provado por teste; coords só de itens compartilhados com a pessoa. **O que viraria:** **alt (b)** = settlements como linhas, **sem** coords (só `placeLabel` texto) — mais privado, menos útil no mapa. **Confidence:** HIGH.

### Decisões diretas (sem fork — clareza alta)

- **DEC-404 (G0/G4)** — **Confirmar (não mudar)** que o que devo (lançado) sai do livre: `calculatePoolSpent` soma `transactionBasePersonalCostCents`. Adicionar **teste-prova** ("alguém pagou por mim €10 → livre cai €10"; "split €30/3 → meu custo €10 entra no spent e no evento") + nota. **Zero math.**
- **DEC-405 (G5)** — `PlaceField` ganha campo de **busca por nome** → `searchPlaceByName(near=coords atuais)` → lista de resultados reais → escolher salva `placeLabel + coords + placeId` (`placeNameSource='user'`). Debounce, best-effort, nunca bloqueia. Melhora a UI do seletor.
- **DEC-406 (G6)** — `ExpenseLocationMapField`: o overlay expandido vai por **`createPortal(overlayHost())`** (escapa o ancestral transformado → `fixed` de verdade) + z acima dos panes Leaflet; preview segue `pointer-events-none`. Espelha o `BottomSheet`/`AttachmentViewer`.
- **DEC-407 (G6)** — `BottomSheet.onBodyTouchStart`/`onBodyTouchMove`: **bail** (não inicia drag) quando o toque nasce dentro de `textarea/input/[contenteditable]/[data-no-sheet-drag]` ou de um scrollable aninhado que ainda pode rolar na direção do gesto. `decideBodyDrag` ganha esse guard (puro, testável).
- **DEC-408 (G7, L-AI-IMAGE)** — `AssistantSheet InputArea` textarea ganha `onPaste`: captura imagem(ns) do clipboard → acumula (thumbnails com remover) → no **enviar**, OCR cada uma (reusa `extractReceiptViaCloud`/vision) e funde com o texto no fluxo de lote (`runPlan`/`confirmBatch`). **Default (a):** acumula N imagens + texto. **alt (b):** uma imagem por vez (paridade com a foto atual).
- **DEC-409 (G1+G2 · Â-EVENT-LIFECYCLE)** — saída-de-evento vive **dentro** do evento: quando `session.occurrenceId` está setado (DEC-400), o Home **suprime** o card `active_outing` standalone daquela saída; a saída ativa aparece **embutida** no card `live_event` (G1) e no guia (G2) — cronômetro + tally da saída + teto/alertas + "abrir saída" — e o número grande é o **consumido do evento** (real). Saída **sem** evento mantém o card de hoje. Botão primário do evento ao vivo = **registrar gasto do evento** (atribuição direta); "iniciar saída (foco)" secundário. Conselho E (ver doc de exploração §4). **Zero math.**
- **DEC-410 (G8 · IA cria evento · worker)** — a IA passa a **criar evento** ("vou no show sábado, reservo €100"). Worker `buildAssistantSystemPrompt` ganha a ação **`plan_event`** (nome/data/reserva opcional); novo `ExecOp` de evento + `dispatch.executeEvent` (cria `PlannedOccurrence` via `createPlannedOccurrence`, na fase do dia); preview/confirm no `AssistantSheet` (mesma régua de confirm 1-toque, editável). Depende de G1 (entidade evento) e do worker. **Â-NEVER-BLOCK.** Decisão direta do Julio (incluir nesta leva).

---

## §8 — Change-set (por gate)

**G1 — Ciclo de vida do evento (DEC-400) — `1.9.0-rc`**
- `domain/types/session.ts` — `occurrenceId?: string | null` (aditivo, `.passthrough()`); schema Zod do backup idem.
- `domain/types/planned-occurrence.ts` — `startedAt?: string | null` (aditivo).
- `domain/budget/event-budget.ts` — `eventConsumedSpentCents`/`buildLiveEventProgress`: somar atribuído ∪ **todas** as sessions com `session.occurrenceId === occ.id` (legado `linkedSessionId` tratado como uma delas); `LiveEventProgress` expõe "tem saída ativa?" derivado.
- `domain/orchestrators/outing-orchestrators.ts` — `endOutingSession`: **remover** o `isConfirmed=true` do evento; `discardOutingSession`: **não** mexer no evento (só a saída); novo `startOutingForEvent` (saída com `occurrenceId`, sem amarrar evento); novos `startEvent(occId)` (`startedAt`) e `endEvent(occId)` (fecha saídas abertas do evento → caminho DEC-387/sobra).
- `domain/planning/occurrences.ts` — predicados de visibilidade/started cientes de `startedAt`.
- `features/dashboard/DashboardCards.tsx` — botões: "iniciar evento" (quando não iniciado) → **"registrar gasto do evento" (primário, atribuição direta)** + "iniciar saída (foco)" (secundário) + "encerrar evento" (quando iniciado); "iniciar saída" usa `startOutingForEvent`. **DEC-409:** quando há saída ativa **deste** evento (`session.occurrenceId`), embutir a saída no card `live_event` (cronômetro + tally + teto/alertas + "abrir saída") em vez do número de 3 gastos; o número grande segue o consumido do evento.
- `features/dashboard/useDashboardModel.ts` — **DEC-409:** suprimir o card `active_outing` quando `activeSession.occurrenceId` aponta pra um evento ao vivo (passar o vínculo pro `liveEvents`); saída sem evento mantém `active_outing`.
- i18n `dashboard.event_start`/`event_log_expense`/`event_start_outing`/`event_end` + confirmação (pt/en/es).

**G2 — Guia do evento (DEC-401 + DEC-409 embed) — `1.9.1-rc`**
- `domain/budget/event-budget.ts` — estender `LiveEventProgress` (ou novo `buildEventGuide`): saídas (id/nome/total/aberta?), despesas por dia, **ritmo factual com números e veredito leve** ("€Y/dia · hoje €Z" + cue curto "no ritmo"/"segura um pouco", régua de `eventDailyAllowanceCents` vs gasto-de-hoje — factual-first, sem tom agressivo).
- `features/event/EventGuidePage.tsx` (novo, rota `/event/:id`, lazy) — cabeçalho (reserva/consumido/restante/per-day/dias + ritmo factual), saídas (com a **saída ativa embutida** — DEC-409), **todas** as despesas (local via `ExpenseLocationMapField`), um **botão "editar evento" que abre o sheet de edição já existente** (reuso do `TripEditPage`/sheet do evento — NÃO um editor novo no guia), encerrar evento. Estado vazio + track-only.
- `app/router.tsx` — rota `/event/:id` lazy.
- `features/dashboard/DashboardCards.tsx` — card e "+N mais" **navegam** pra `/event/:id`.
- i18n `event.*` (pt/en/es).

**G3 — Acerto que reconcilia (DEC-402) — `1.9.2-rc`**
- `domain/splitting/splitting.ts` — `StatementLine` ganha `placeLabel/latitude/longitude/placeId` (copiados da tx em `buildParticipantStatement`).
- `domain/sync/statement-payload.ts` — `statementLineSchema` ganha `place*` opcionais; `statementPayloadSchema.settlements?` (linhas de pagamento: id, direção do destinatário, valor, data, nota?); `buildStatementPayload`/`toPayloadLine`/`buildParticipantSharePayload` encodam settlements (do `statement.settlements`) e local (só de itens compartilhados com a pessoa).
- `domain/types/mirrored-statement.ts` — repassa settlements + local (display-only).
- `features/shared/MirroredStatementsSection.tsx` (+ `SharedExpensesPage.tsx` preview) — renderiza pagamentos como linhas (sinal/direção) + "ver detalhes/local" por item (mapa). Net reconcilia visível.
- i18n `sync.settlement_paid`/`settlement_received`/`item_location` (pt/en/es).

**G4 — IA escreve descrição + livre↔dívida (DEC-403 + DEC-404) — `1.9.3-rc` (worker muda)**
- `worker/src/index.ts` — `buildAssistantSystemPrompt`: description = sempre rótulo humano curto/factual, nunca a categoria.
- `features/assistant/useAssistant.ts` — cadeia de fallback `description→placeLabel→t('assistant.expense_fallback')` nos 2 pontos (L706-708/L770-772); remover `t('categories.*)` como descrição.
- UI do item: não repetir local quando a descrição veio do local.
- `tests` — DEC-404: prova livre desconta dívida lançada + evento conta só minha parte.
- i18n `assistant.expense_fallback` (pt/en/es).

**G5 — Buscar lugar por nome (DEC-405) — `1.9.4-rc`**
- `features/location/PlaceField.tsx` — campo de busca (debounce) → `searchPlaceByName` → resultados → escolher salva coords reais + `placeNameSource='user'`; melhora UI.
- (auditar outros seletores de local; dar paridade.)
- i18n `places.search_*` (pt/en/es).

**G6 — Mapa fixo + card não fecha ao rolar texto (DEC-406 + DEC-407) — `1.9.5-rc`**
- `features/location/ExpenseLocationMap.tsx` — `ExpenseLocationMapField`: overlay via `createPortal(overlayHost())` + z acima do Leaflet.
- `components/BottomSheet.tsx` — `onBodyTouchStart`/`decideBodyDrag`: guard contra scrollable/textarea aninhado.
- `tests` — overlay portado; `decideBodyDrag` ignora alvo scrollable.

**G7 — Colar imagem na IA (DEC-408) — `1.9.6-rc` (pode mudar o worker/vision)**
- `features/assistant/AssistantSheet.tsx` — `onPaste` no textarea → acumula imagens (thumbs + remover).
- `features/assistant/useAssistant.ts` — pendências de imagem; no enviar, OCR cada + funde com texto no lote.
- i18n `assistant.pasted_image*` (pt/en/es).

**G8 — IA cria evento (DEC-410) — `1.9.7-rc` (worker muda; pode compartilhar o deploy do G4)**
- `worker/src/index.ts` — `buildAssistantSystemPrompt`: nova ação **`plan_event`** (campos `name`/`date`/`reservedAmount?`); exemplo no prompt.
- `domain/assistant/plan.ts` — novo `ExecOp` de evento (`kind:'event'`) + `planEvent`.
- `domain/assistant/dispatch.ts` — `executeEvent` cria `PlannedOccurrence` via `createPlannedOccurrence` (fase do dia, reserva opcional, `startedAt` se "começa agora").
- `features/assistant/{useAssistant.ts,AssistantSheet.tsx}` — preview/confirm do evento (editável, confirm 1-toque).
- `tests` — `planEvent` (texto→op), `executeEvent` (op→occurrence), no-block.
- i18n `assistant.event_*` (pt/en/es).

---

## §9 — Estratégia de testes

- **G0/G4 (provas)** — `event-budget`/`budget`: split €30/3 → €10 no spent e no evento; "alguém pagou por mim €10" → livre −€10. Invariância: net total do owner = baseline.
- **G1** — evento de 1 saída = baseline **bit-a-bit** (`eventConsumedSpentCents`); 2 saídas somam certo sem double-count; **encerrar saída mantém evento ao vivo**; descartar saída não toca evento; encerrar evento fecha saídas abertas + dispara sobra (DEC-387).
- **G2** — `buildEventGuide`: despesas/dia, saídas, ritmo factual; track-only e vazio.
- **G3** — payload: net = Σ (despesas confirmadas + settlements); settlements aparecem como linhas com direção certa; local só de itens compartilhados com a pessoa; **nunca** fundo/wallet; round-trip Zod; payload antigo lê `undefined`.
- **G5** — `searchPlaceByName` mapeado pra resultados; escolher salva coords (mock de rede).
- **G6** — overlay portado pra `app-overlay-root`; `decideBodyDrag` retorna `abort` quando alvo é scrollable.
- **G7** — paste acumula N imagens; enviar dispara OCR×N + funde texto.
- **Baseline**: ~2781/2783 (as 2 `split-live-loop` são WebCrypto/Node-18, verdes no CI Node 22). `tsc --noEmit` limpo, `npm run build` verde a cada gate.

---

## §10 — Gates & ordem (por risco/dependência)

| Gate | Entrega | DEC | Versão | Worker | Dep |
|---|---|---|---|---|---|
| G0 | Baseline + provas (pontos 1 e 4) | DEC-404 | — | não | — |
| G1 | Ciclo de vida do evento (keystone) + suprime/embute saída-de-evento | DEC-400/409 | 1.9.0-rc | não | G0 |
| G2 | Guia do evento (editável via sheet + ritmo factual + saída embutida) | DEC-401/409 | 1.9.1-rc | não | G1 |
| G3 | Acerto que reconcilia (settlements + local) | DEC-402 | 1.9.2-rc | não | G0 |
| G4 | IA escreve descrição + provas livre↔dívida | DEC-403/404 | 1.9.3-rc | **sim** | G0 |
| G5 | Buscar lugar por nome → GPS | DEC-405 | 1.9.4-rc | não | — |
| G6 | Mapa fixo + card não fecha ao rolar texto | DEC-406/407 | 1.9.5-rc | não | — |
| G7 | Colar imagem na IA (pode adiar se o contexto apertar) | DEC-408 | 1.9.6-rc | talvez | G4 |
| G8 | IA cria evento (`plan_event`) | DEC-410 | 1.9.7-rc | **sim** | G1, G4 |

---

## §11 — Riscos & mitigações

- **Double-count no evento (G1)** → teste de invariância bit-a-bit (1 saída = baseline) trava antes de seguir.
- **Migração acidental** → todo campo é aditivo/`.passthrough()`; teste de payload/backup antigo lendo `undefined`.
- **Privacidade no acerto (G3)** → coords só de itens que a pessoa participou; fundo/wallet/pool nunca no payload (teste negativo).
- **Worker (G4/G7)** → redeploy isolado; o device degrada gracioso se o prompt novo não estiver no ar (fallback local cobre).
- **Escopo grande** → G7 (colar imagem) e G8 (IA cria evento) são os candidatos a adiar/virar follow-up; G5/G6 são independentes e podem reordenar. G8 depende de G1 (entidade evento) + worker (compartilha deploy com G4).
- **Card unificado (DEC-409)** → é supressão condicional (`session.occurrenceId`); o caso saída-sem-evento fica intacto (teste de não-regressão). Risco baixo, mas a saída ativa embutida não pode perder destaque (teto/alertas).

---

## §12 — Definition of Done (da leva)

G0→G6 verdes (G7/G8 idealmente; senão registrados como follow-up). Pontos 1 e 4 provados. Evento: iniciar/encerrar explícito, várias saídas, **nunca some sozinho**, **um card só** (saída embutida, sem €0 fantasma), guia completo **editável** (botão → sheet existente) com ritmo **factual** (números + veredito leve), botão primário = gasto direto. Acerto reconcilia com local. IA escreve descrição **e cria evento**. Buscar lugar por nome funciona. Mapa fixo + card não fecha ao rolar texto. Invariância do dinheiro mantida; suíte sem novas falhas; `tsc`/`build` verdes; dev-log + decision-log (DEC-400→410 → APPROVED) + release-notes por versão.

---

## §13 — Deploy

Por gate: bump (`package.json` + `app-version.ts` + `public/version.json` + `release-notes.ts` pt/en/es + `package-lock.json`) → commit por item + fecha-gate → push master → Pages auto-build. **G4, G8 (e talvez G7) também rodam `wrangler deploy`** do worker (os demais gates **não** tocam o worker; G4 e G8 podem **compartilhar um único deploy** se executados em sequência). Worker e device são compatíveis nos dois sentidos (prompt novo + fallback local; ações desconhecidas são ignoradas pelo device).

---

## §14 — Contexto pro executor (refresh em cada gate)

Reler antes de cada gate: este doc (§ do gate), `dev-log.md` (Current State), e a ÂNCORA relevante. Imprimir o bloco NON-NEGOTIABLES (§2) + CURRENT STATE (5 linhas) no boundary de cada gate. Mid-gate a cada 3 milestones: reler regras críticas + dev-log.

---

## §15 — Glossário

- **Evento** = `PlannedOccurrence` (kind `event`/`sub_destination`) com reserva opcional e ciclo próprio.
- **Saída (outing)** = `Session`; agora N:1 com o evento via `occurrenceId`.
- **Consumido do evento** = atribuído (`occurrenceId` na tx) ∪ spend das saídas do evento.
- **Acerto** = statement por pessoa (despesas + quitações) que reconcilia ao net.

---

## §16 — TRAVAS (✅ CONFIRMADAS por Julio 2026-06-29 — todas em (a))

| Trava | Gate | ✅ Escolhido (a) | Alternativa (não usada) |
|---|---|---|---|
| **L-EVENT-LIFECYCLE** | G1 | **(a)** decouple aditivo: `Session.occurrenceId?` + `startedAt?`, N saídas por evento, fim de saída não encerra evento | (b) manter `linkedSessionId` único + flags start/end (1 saída ativa por vez) |
| **L-EVENT-SURFACE** | G2 | **(a)** página dedicada `/event/:id` (guia navegável) | (b) bottom-sheet expansível a partir do card |
| **L-SETTLE-DETAIL** | G3 | **(a)** settlements como linhas + local/mapa **só** de itens que a pessoa participou; nunca fundo/wallet | (b) settlements como linhas, **sem** coords (só `placeLabel` texto) |
| **L-AI-DESC** | G4 | **(a)** prompt do worker (sempre descreve) **+** fallback descrição→local→neutro | (b) só o fallback no device (não toca o worker agora) |
| **L-AI-IMAGE** | G7 | **(a)** acumular N imagens + texto, OCR no enviar | (b) uma imagem por vez (paridade com a foto atual) |

**Adendo (2026-06-29):** o documento de exploração `2026-06-29-event-experience-exploration.md` resolve por conselho o problema dos **dois cards (saída + evento)** → **DEC-409** (suprimir o card `active_outing` standalone quando a saída pertence a um evento; a saída ativa vive **dentro** do card/guia do evento). Depende de `Session.occurrenceId` (G1) → DEC-409 entra no escopo de **G1 (supressão/embed no card) + G2 (embed no guia)**.

**Decisões de produto do evento (§7 do doc de exploração — ✅ respondidas por Julio 2026-06-29, sem mais forks):**
| Pergunta | ✅ Decisão | Onde |
|---|---|---|
| Botão primário do evento ao vivo | **Registrar gasto do evento** (atribuição direta); "iniciar saída (foco)" secundário | G1 (DEC-409) |
| Guia do evento editável? | **Sim, via botão "editar evento" que abre o sheet de edição já existente** (reuso, não editor novo no guia) + acompanhar + encerrar | G2 (DEC-401) |
| IA cria evento? | **Sim, nesta leva** → novo **G8** (`plan_event`) | G8 (DEC-410) |
| Ritmo/veredito | **Factual com números + veredito leve** ("€Y/dia · hoje €Z · no ritmo/segura um pouco") — factual-first | G2 (DEC-401) |
| "Iniciar evento" explícito vs auto-na-data | **Explícito** (`startedAt` cobre ambos) | G1 (DEC-400) |

---

## §17 — Apêndice: arquivos-chave

- Evento/budget: `domain/budget/event-budget.ts`, `domain/orchestrators/outing-orchestrators.ts`, `domain/types/{session,planned-occurrence,transaction}.ts`, `domain/planning/occurrences.ts`, `features/dashboard/DashboardCards.tsx`, `features/event/EventGuidePage.tsx` (novo), `app/router.tsx`.
- Acerto: `domain/splitting/splitting.ts`, `domain/sync/statement-payload.ts`, `domain/types/mirrored-statement.ts`, `features/shared/{MirroredStatementsSection,SharedExpensesPage,SharedLinkPage}.tsx`.
- IA: `worker/src/index.ts` (`buildAssistantSystemPrompt`), `features/assistant/{useAssistant.ts,AssistantSheet.tsx}`.
- Lugar/mapa/sheet: `utils/places.ts`, `features/location/{PlaceField,ExpenseLocationMap,stamp-expense-location}.tsx/.ts`, `components/BottomSheet.tsx`.
