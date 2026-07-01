# Orquestrador — "Import/cofrinho/acerto de verdade + mapas de satélite e exploração + conversor/IA/amigo completos"

> Método: `.cursor/skills/implementation-orchestrator/SKILL.md`. Single session, 1 agente, sem subagentes (cost-constitution). Deploy por gate (Pages OTA). **Nenhum gate toca o worker** — tudo é device/Pages (o import geocoda via Nominatim/Overpass, não pelo nosso worker). Base `1.9.9-rc` (DEC-412 shipped). Novos DECs **DEC-413 → DEC-425** (PROPOSED no decision-log; viram APPROVED ao fechar cada gate).
>
> **Status: ✅ TRAVAS CONFIRMADAS (Julio 2026-06-30) — todas em (a); 4 perguntas abertas respondidas com os defaults (§16).** G0 pode rodar já; depois **G1 → G11 em ordem, sem parar** até a DoD (§12). Os 14 pontos do Julio viram **11 gates de trabalho + G0 (provas)**, ordenados por risco/dependência/atrito.

---

## §0 — TL;DR

Julio listou **14 pontos** numa tacada. Um está **quase certo** (cofrinho acumula — mas o número grande do dia ainda infla, então vira trabalho); os outros são bugs de verdade + features novas. Vira **12 gates** (G0 provas + G1–G11), cada um deploya sozinho:

1. **Wise reimporta a transferência (e não dá pra desmarcar)** — o dedupe só olha `transactions`, nunca `settlements`; transferência vira `Settlement`, então nunca é reconhecida como duplicada; e transfer não tem toggle de incluir/excluir. → **G2 (keystone)**.
2. **Detalhe do gasto não mostra o evento** — só mostra fundo/wallet, nunca a `occurrenceId`. → **G9**.
3. **Import sem local/mapa** — `searchPlaceByName` existe mas o import nunca geocoda o comerciante/título; só a IA fazia isso. → **G3** (sem IA, best-effort, batelado).
4. **Conversor: moedas principais no topo + nome/país** — não existe mapa de metadados de moeda; a lista é só código, sem ordem. → **G8**.
5. **Conversor: só a moeda da conta carregada** — o snapshot é opt-in e puxado uma vez; faltam refresh automático + as majors sempre presentes/atualizadas. → **G8**.
6. **Mover dívida entre pessoas** (Debora→Bruno) com histórico e atribuição ("esses itens vieram da Debora"). Feature nova. → **G6**.
7. **Remover pessoa de vez (mesmo sem app)** — hoje só desconecta (vira "sem app" e continua na lista); `noapp` puro nem tem botão de remover. → **G7**.
8. **Cofrinho guarda a sobra, MAS o "livre hoje" ainda infla** — `calculateTodayFreeBudget` re-espalha o livre restante sobre menos dias, então não gastar hoje **aumenta** o número de amanhã (contradiz o cofrinho). → **G4 (invariante de dinheiro — cuidado máximo)**.
9. **Muita coisa cai em "Outros" no import** — `guessCategory` tem só 8 categorias com dicionário EU/espanhol enxuto. → **G3**.
10. **IA add: faltam campos (dividir com alguém etc.)** — o `ExpenseEditor` da IA tem categoria/descrição/data/local/fundo/wallet/evento, mas **não** tem editor de divisão (participantes/pagador/cotas). → **G10**.
11. **Mapa do detalhe em satélite** — hoje usa tiles OSM. → **G9**.
12. **Nova tela: gastos no mapa** (clusters por zoom + satélite + clicar pra ver + depois heatmap). Tela nova. → **G11**.
13. **Barra de rolagem voltou** — o CSS global de esconder é blindado (guardado por teste); a "volta" é uma superfície específica (panes do Leaflet / `width:0` vs `display:none`), não regra apagada. → **G1 (ganho rápido, alta irritação)**.
14. **Amigo Sincero fixa no mesmo gasto** — o gatilho é o gasto **mais recente por data** (numa importação em lote, um gasto caro antigo) e o veredito `no_plan` papagaia "esse gasto levou X% do livre" sem rodízio. → **G5**.

---

## §1 — Missão

Fazer o **import ser confiável** (transferência dedupada e desmarcável; local automático sem IA; menos "Outros"), o **dinheiro dizer a verdade** (a sobra do dia fica no **cofrinho**, não infla o "livre de hoje"), o **acerto ser flexível e rastreável** (mover dívida entre pessoas com histórico), a **gestão de pessoas ser completa** (remover de vez, mesmo sem app), o **conversor ser útil de imediato** (majors no topo, com nome/país, taxas frescas), a **IA capturar tudo** (inclusive divisão), o **mapa contar a história** (satélite no detalhe + uma tela de exploração dos gastos), o **Amigo Sincero variar**, e a **barra de rolagem sumir de novo**. Tudo **sem mexer na aritmética do dinheiro** exceto onde é o próprio pedido (G4, provado por invariância), **aditivo no schema** (sem migração Dexie) e **nunca bloqueando**.

---

## §2 — Não-negociáveis (ÂNCORAS)

- **Â-MONEY-INVARIANT** — o **total** livre da fase, os totais de Trecho/Pote e o net do owner ficam idênticos ao baseline. **G4 é a única mudança de math** e mexe **só na leitura diária** ("livre hoje"): o total do livre **não muda** — a sobra some do dia e aparece no cofrinho. Provado por teste de invariância (Σ diária + cofrinho = livre total, bit-a-bit).
- **Â-IMPORT-IDEMPOTENT** (G2) — reimportar o **mesmo** extrato **nunca** recria uma transferência já importada; toda linha (expense/fee/credit/**transfer**) é dedupada por `externalRef` contra `transactions` **e** `settlements`, e **toda** linha é desmarcável.
- **Â-ADDITIVE-SCHEMA** — todo campo novo é aditivo/opcional (`.passthrough()`), **sem migração Dexie**; registros/payloads antigos leem `undefined`.
- **Â-NEVER-BLOCK** — nenhum caminho de gasto/import/IA/mapa bloqueia; geocode/tiles/refresh de FX são best-effort e falham em silêncio (offline-first).
- **Â-DEBT-TRACEABLE** (G6) — mover dívida preserva o **histórico** e a **atribuição** ("estes itens vieram da Debora"); a soma pairwise total do owner **não muda** (só troca de titular). Nunca cria dívida-fantasma sem origem.
- **Â-PERSON-HIDE-NEVER-BREAK** (G7) — remover uma pessoa **esconde** o participante (soft-delete), **preserva** o histórico de rateios e **nunca** deixa dívida órfã (removível só sem saldo aberto — ou com acerto antes).
- **Â-PLACE-REAL** (G3) — quando o import resolve um lugar, ele grava **coordenadas reais** (forward-geocode do comerciante/título/cidade), não uma string solta; sem match → fica sem local (nunca inventa).
- **Â-NO-SCROLLBAR** (G1, herdado DEC-331/D-BUG-21) — nenhuma barra de rolagem visível em nenhuma tela/engine; o conteúdo rola, a barra não aparece. Blindado por `style-hygiene.test.ts`.
- **Â-SHARE-PRIVACY** (G6) — mover dívida/expor itens ao destinatário nunca vaza fundo/wallet/pool/saldo interno (herdado DEC-402/399).
- **t() em tudo, código em inglês**, comentários explicam o "porquê".

---

## §3 — Baseline (o que JÁ existe e funciona — reusar, não recriar)

- **Wise import** — `domain/import/wise-csv.ts` (parse), `domain/import/wise-import.ts` (`classifyWiseRows`, `guessCategory`, `extractCity`, `wiseExternalRef`, `WISE_REF_PREFIX='wise:'`, `ClassifyWiseContext.existingSettlements?` **já declarado, não usado**), `domain/import/wise-transfer.ts` (classificação de transferência: `matchParticipantByName`, `transferAllocationStatus`, `buildDefaultAllocations`), `domain/orchestrators/import-orchestrators.ts` (`commitWiseImport`, `commitWiseTransfers` — marca `Settlement.externalRef = wiseExternalRef(rowId)`; `undoWiseImportBatch`), UI `features/import/WiseImportPage.tsx`.
- **Local** — `utils/places.ts`: `searchPlaceByName`/`searchPlacesByName` (nome→coords, Nominatim), `reverseGeocodePlace` (coords→nome), `searchNearbyPlaces` (Overpass), `isOnline`; stamp em background `features/location/stamp-expense-location.ts`; campo `features/location/PlaceField.tsx`. Gasto carrega `placeLabel/latitude/longitude/placeId/placeNameSource` (`domain/types/transaction.ts`).
- **Mapa** — `features/location/ExpenseLocationMap.tsx` (`ExpenseLocationMap` com `interactive?`; `ExpenseLocationMapField` = preview→overlay via portal, DEC-398/406). Tiles: `https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png`, `maxZoom:19`.
- **Cofrinho (Model B)** — `domain/budget/piggy-ledger.ts`: `buildPiggyLedger` (replay diário vs ideal → `balanceCents`), `buildPiggySpendByDay`, `linearDailyIdealCents`, `buildRhythmDailyIdeals`. Ligado em `features/dashboard/useDashboardModel.ts` (`piggyIdealByDayCents`, `freePoolDropTodayCents` via `calculateDailyFreePoolDrop` DEC-411).
- **Livre do dia** — `domain/phases/rhythm.ts › calculateTodayFreeBudget` (subtrativo DEC-088; `todayAllowance = (freeRestante+gastoHoje) × pesoHoje ÷ diasEfetivos`), `calculateEffectiveSpendingDays`, `getDaySpendingWeight`.
- **Amigo Sincero** — `domain/budget/honest-friend.ts` (`buildHonestFriendV2`, veredito `no_plan/over_budget/over_pace/over_plan/on_plan`; `no_plan.impactPercent`), `domain/budget/honest-friend-extras.ts` (carrossel: `phase_progress/daily_left/top_category/receivable/piggy_movement`, `filterHomeAmigoExtras`), gatilho em `useDashboardModel.ts` (`amigoTriggerTx` = expense mais recente por data). i18n `amigo_no_plan` (pt-BR:832).
- **Acerto/pessoas** — `domain/splitting/splitting.ts` (`calculateDebts`, `ownerPairwiseBalances`, `summarizeOwnerDebts`, `thirdPartyDebts`, `buildParticipantStatement`, `createSettlement`), `domain/connections/people-view.ts` (`buildPeopleView` → status connected/invited/noapp + saldo), `features/shared/SharedExpensesPage.tsx` (settle sheet, statement, `handleRemovePerson`→`removeConnectedPerson` só desvincula), repos `settlement-repository`/`participant-repository`/`participantShare-repository`.
- **Conversor** — `features/converter/ConverterPage.tsx`, `domain/money/converter.ts` (`converterCurrencies`, `pairRate`), `domain/money/exchange.ts` (`listSelectableCurrencies`, `convertToBaseCents`, `resolveFrozenRate`), fetch `utils/exchange-rates.ts` (open.er-api.com → `FrozenExchangeRates.ratesToBase`, base-anchored). Setting `frozenRates` (opt-in, `app-settings.ts`).
- **IA add** — `features/assistant/AssistantSheet.tsx` (`ExpenseEditor`: categoria/descrição/data/`PlaceField`/`FundPicker`/`WalletPicker`/`EventPicker`; computa `isSplit` mas **sem editor de divisão**), `features/assistant/useAssistant.ts` (`ExpenseOp` já tem `participantIds`/`payerId`/`didSplit`).
- **Evento** — rota `/event/:id` → `features/event/EventGuidePage.tsx` (DEC-401, já existe) — o detalhe do gasto pode **linkar** pra cá.
- **Scrollbar** — `src/styles/globals.css`: `.no-scrollbar` + universal `* { scrollbar-width:none !important }` + `*::-webkit-scrollbar { width:0 !important }` + reforços `html.cap-native`; guardado por `style-hygiene.test.ts`.

---

## §4 — O problema (causa-raiz lida no código, confiança ALTA salvo nota)

1. **Transferência reimporta e não desmarca** — `wise-import.ts › classifyWiseRows` monta `importedRefs` **só** de `existingTransactions` (`tx.externalRef`). Mas transferência é comitada por `commitWiseTransfers` como **`Settlement`** com `externalRef = wiseExternalRef(rowId)` — nunca uma `transaction`. Logo a transferência **nunca** entra em `importedRefs` → sempre volta como `new`. `ClassifyWiseContext.existingSettlements?` **já está declarado** (L85) mas não é consumido. Além disso, a UI comita transfer quando as alocações estão "balanceadas" (`transferAllocationStatus`), **sem** um toggle incluir/excluir por linha como os outros kinds têm. **Confiança ALTA.** → **G2.**
2. **Detalhe do gasto sem evento** — `features/expenses/ExpenseDetailPage.tsx` renderiza categoria/data/hora/fundo/wallet/custo pessoal e o mapa, mas só checa `tx.sessionId` (parent/split session); **nunca** lê `tx.occurrenceId` pra mostrar o evento. A rota `/event/:id` já existe (linkável). → **G9.**
3. **Import não geocoda** — `searchPlaceByName` (Nominatim) e o pipeline `stamp-expense-location.ts` já existem, mas rodam só no save da IA/entrada manual, **nunca** para linhas do import. `extractCity` pega os tokens UPPERCASE finais do comerciante (a "cidade" do Wise) mas isso só vira `city` string, não coords. → import fica sem `latitude/longitude/placeId`. → **G3.**
4/5. **Conversor pobre + só a base carregada** — não há **nenhum** mapa de metadados de moeda no `src` (só no bundle `dist`); `listSelectableCurrencies` (`exchange.ts`) só dedupa/uppercasa códigos, sem ordem nem nome/país. E `frozenRates` é **opt-in** e puxado **uma vez** (`utils/exchange-rates.ts`); a lista do conversor só mostra o que está no snapshot + extras. Como o snapshot é **base-anchored** (`ratesToBase`), qualquer par converte — o buraco real é (a) sem majors garantidas/ordenadas com nome, (b) sem refresh automático quando online. → **G8.**
6. **Sem mover dívida entre pessoas** — o modelo é `Settlement{debtorId, creditorId, amountCents,...}` e a UI (`SharedExpensesPage`) só tem cobrar/pagar/lembrar/remover; **não** há "mover a dívida da Debora pro Bruno". A dívida vem de `ParticipantShare` (por item); mover fielmente = reatribuir as shares (A→B) com marca de origem, não um settlement sintético que perde o "de quem/quais itens". **Feature nova.** → **G6.**
7. **Remover pessoa só desconecta** — `handleRemovePerson` → `removeConnectedPerson(id)` **tombstona o peerLink + desvincula** o participante (I1/DEC-370): a pessoa **continua** na lista como `noapp`. E o botão de remover (SharedExpensesPage L2114) só aparece quando `linkedActorId !== null || peerLinkFor(...)` — um `noapp` **puro** (digitado, sem app) **não tem** como ser removido. Bate exatamente com o relato. → **G7.**
8. **"Livre hoje" infla com a sobra (contradiz o cofrinho)** — `rhythm.ts › calculateTodayFreeBudget`: `startOfDayFree = freeRestante + gastoHoje`; `todayAllowance = startOfDayFree × pesoHoje ÷ diasEfetivos`. Passando um dia **sem gastar**, `freeRestante` fica alto e `diasEfetivos` (de hoje até o fim) **diminui** → a mesada de amanhã **sobe**. O cofrinho (`buildPiggyLedger`, Model B) acumula a sobra **certo**, e o **extra** `daily_left` já capa no ideal-base quando há buffer (DEC-279) — mas o **número herói** ("livre pra usar hoje") **não** capa. Resultado: a sobra aparece **duas vezes** na percepção (no cofrinho **e** inflando o dia). **Confiança ALTA no mecanismo; o "quanto incomoda" é de produto.** → **G4.**
9. **Muito "Outros" no import** — `guessCategory` roda `CATEGORY_RULES`: **8** categorias (transport/accommodation/health/market/bar/restaurant/entertainment/clothing) com dicionário enxuto e EU/espanhol. Qualquer coisa fora cai em `other`. Não usa `detailsType`/direção nem o tipo do POI resolvido. → **G3.**
10. **IA add sem divisão** — `AssistantSheet › ExpenseEditor` tem categoria/descrição/data/local/fundo/wallet/evento e **computa** `isSplit = op.didSplit || op.payerId !== op.ownerId`, mas **não** renderiza editor de divisão (quem participa, quem pagou, igual/custom). O `ExpenseOp` já carrega `participantIds/payerId/didSplit` — falta a UI (e talvez outros campos: hora, nota, marcar `isShared`). → **G10.**
11. **Detalhe do gasto em OSM, não satélite** — `ExpenseLocationMap.tsx` L60 usa `tile.openstreetmap.org`. → trocar/alternar pra Esri World Imagery. → **G9.**
12. **Sem tela de mapa dos gastos** — não existe rota/tela que agrega as coords de **todas** as transações num mapa com clusters por zoom, satélite, clique→detalhe e (fase 2) heatmap. Superfície nova. → **G11.**
13. **Barra de rolagem "voltou"** — o CSS global é **blindado** (universal `*` + `html/body/*::-webkit-scrollbar { width:0 !important }` + `html.cap-native`, travado por `style-hygiene.test.ts`). Então não é regra apagada: é (a) o **Leaflet** injeta CSS próprio e panes com scroll, e/ou (b) `width:0` deixa um **track fantasma** em alguns engines onde só `display:none` mata, e/ou (c) uma superfície nova com `overflow` que renderiza um affordance próprio. **Investigação-primeiro.** → **G1.**
14. **Amigo fixa num gasto** — `useDashboardModel.ts › amigoTriggerTx` = `phaseTxsForInsights.filter(expense).sort(date desc)[0]` = o **mais recente por data**. Numa importação em lote, o "mais recente por data" pode ser um **gasto caro antigo** (ex.: ingresso de semanas atrás) e fica **preso** até chegar algo com data posterior. O veredito `no_plan` então repete `amigo_no_plan` = "Esse gasto levou {percent}% do dinheiro livre que ainda restava" (pt-BR:832), **sem rodízio, sem dedupe do que já foi dito, sem preferir o veredito de ritmo**. → **G5.**

---

## §5 — Princípios de design

- **Reuse-first.** G2 usa `ClassifyWiseContext.existingSettlements?` (já existe) + o padrão de toggle dos outros kinds. G3 usa `searchPlaceByName`/`stamp-expense-location`. G4 usa `piggyBalance`/`baseDailyIdeal` (já no `useDashboardModel`) — a mesma régua do `daily_left`. G6 usa `ParticipantShare`/`buildParticipantStatement`. G8 usa `pairRate`/`ratesToBase` (base-anchored já converte qualquer par). G9 usa `/event/:id` + `ExpenseLocationMap`. G11 usa `ExpenseLocationMap` (Leaflet já carregado) + libs de cluster/heat.
- **Math num lugar só (G4).** O cap do "livre hoje" vive **dentro** de `calculateTodayFreeBudget` (função pura), não na UI. O **total** livre nunca muda; só a leitura diária. Invariância provada por teste.
- **Aditivo/idempotente.** Campos novos opcionais (`ParticipantShare.reassignedFrom?`, `Transaction.geocodeSource?` se preciso), `.passthrough()`, sem migração. Dedupe é set de `externalRef`.
- **Domínio puro decide privacidade/atribuição.** Mover dívida e o que o destinatário vê são funções puras testáveis.
- **Nunca bloquear.** Geocode do import, refresh de FX e tiles de satélite são best-effort; falham em silêncio, offline-first.

---

## §6 — Mapa causa-raiz → correção (arquivo › símbolo › fix › gate)

| # | Sintoma | Arquivo › símbolo | Causa-raiz | Fix | Gate |
|---|---|---|---|---|---|
| 13 | Barra de rolagem voltou | `styles/globals.css` (universal) + Leaflet CSS | `width:0` deixa track fantasma; panes do Leaflet; superfície nova sem util | Reproduzir → `display:none !important` no `*::-webkit-scrollbar`; cobrir panes Leaflet; assert no `style-hygiene.test.ts` | G1 |
| 1 | Transfer reimporta / não desmarca | `domain/import/wise-import.ts › classifyWiseRows` | dedupe ignora `settlements`; transfer não tem toggle | consumir `existingSettlements` no set de `importedRefs`; marcar transfer `duplicate_import`; toggle incluir/excluir + default-off p/ dup | G2 |
| 3 | Import sem local | `orchestrators/import-orchestrators.ts › commitWiseImport`; `utils/places.ts › searchPlaceByName` | import nunca geocoda | após commit, enfileirar geocode best-effort (merchant/title/`extractCity`) → grava coords; batelado/rate-limit | G3 |
| 9 | Muito "Outros" | `wise-import.ts › CATEGORY_RULES/guessCategory` | dicionário curto/EU | expandir ruleset (marcas/keywords/categorias) + sinais (`detailsType`, POI type) | G3 |
| 8 | "Livre hoje" infla | `domain/phases/rhythm.ts › calculateTodayFreeBudget` | re-espalha livre restante ÷ menos dias | capar `todayAllowance` no ideal-base quando cofrinho>0 (sobra fica no cofrinho); total intacto | G4 |
| 14 | Amigo repete gasto | `useDashboardModel.ts › amigoTriggerTx`; `honest-friend.ts › no_plan` | gatilho = 1 tx (mais recente por data); sem rodízio | preferir veredito de ritmo; rodiziar destaque entre top-N; dedupe última tx citada | G5 |
| 6 | Mover dívida entre pessoas | `domain/splitting/splitting.ts`; `SharedExpensesPage.tsx` | sem operação de transferência | reatribuir `ParticipantShare` A→B com `reassignedFrom` + log; net total intacto; atribuição visível | G6 |
| 7 | Remover pessoa de vez | `SharedExpensesPage.tsx › handleRemovePerson`; `connections/*` | só desvincula; `noapp` sem botão | soft-delete do participante (esconde) sem saldo aberto; `noapp` também removível; histórico preservado | G7 |
| 4/5 | Conversor: majors/nome + refresh | `domain/money/exchange.ts`; `utils/exchange-rates.ts`; `ConverterPage.tsx` | sem metadados de moeda; snapshot 1x | mapa `currency-meta` (nome/país/flag/prioridade) + ordenar; auto-refresh quando stale + majors sempre presentes | G8 |
| 2 | Detalhe sem evento | `features/expenses/ExpenseDetailPage.tsx` | não lê `occurrenceId` | linha "Evento" → nome + link `/event/:id` | G9 |
| 11 | Detalhe em satélite | `features/location/ExpenseLocationMap.tsx` L60 | tiles OSM | Esri World Imagery + toggle mapa/satélite | G9 |
| 10 | IA add sem divisão | `features/assistant/AssistantSheet.tsx › ExpenseEditor` | sem editor de split | editor de divisão (participantes/pagador/igual-custom) + campos faltantes (paridade QuickAdd) | G10 |
| 12 | Tela de gastos no mapa | (novo) `features/map/*`, `app/router.tsx` | não existe | rota `/mapa`: clusters por zoom + satélite + clique→detalhe; heatmap fase 2 | G11 |

---

## §7 — Conselhos (inline, nesta sessão de autoria — 1 request, sem subagentes)

> Cost contract: os 6 conselhos abaixo rodaram **inline** na sessão de autoria (não geram request por agente). Cada um: Brief neutro → vozes cegas → red team → síntese → DEC/TRAVA.

### Council A — `/council` · Dedupe + desmarcar transferência do Wise (keystone) → **DEC-413**

**Decision Brief (neutro).** Reimportar o extrato reprocessa a **transferência** toda vez; os outros kinds aparecem "duplicado"/"já importado" e são desmarcáveis, a transferência **nunca**. Fato: transfer comita como `Settlement` com `externalRef=wiseExternalRef(rowId)`; `classifyWiseRows` só olha `existingTransactions` pro dedupe; `ClassifyWiseContext.existingSettlements?` existe e está vazio. Viés a resistir: "é só um checkbox" (o dedupe está de fato quebrado pra settlements).

**Architect** — Duas correções ortogonais e baratas: (1) no `classifyWiseRows`, alimentar `importedRefs` **também** com `existingSettlements.map(s=>s.externalRef)` — assim a transferência reimportada vira `duplicate_import` como qualquer outra; (2) dar à transferência o **mesmo** contrato de seleção dos outros (`includeByDefault=false` quando dup, e um toggle por linha na UI). Reusa `wiseExternalRef`. **Rec:** dedupe por settlement + toggle. **Confidence:** HIGH. **Outros perdem:** o `WiseImportPage` guarda o estado de transfer em `transferState` separado do `included` dos gastos — o toggle precisa cobrir os dois caminhos.

**Advocate (user)** — O usuário quer o **mesmo** comportamento previsível: "já importei isso → vem marcado como duplicado e desligado; se eu quiser, ligo". Zero exceção pra transferência. **Rec:** paridade total de UX. **Confidence:** HIGH. **Outros perdem:** mostrar **por que** está desligada ("já importada em DD/MM") evita o usuário reimportar sem querer.

**Critic** — Risco: a transferência pode ter sido comitada como `Settlement` **e** `transaction` (wallet move + split criam ambos). Dedupe só por `externalRef` do settlement pode deixar passar um caminho. E `undoWiseImportBatch` precisa continuar casando o mesmo ref. **Rec:** dedupe pela **união** de refs (transactions ∪ settlements) e teste dos 4 desfechos de transfer. **Confidence:** MED. **Outros perdem:** linhas colapsadas por `TransferWise ID` repetido — o ref é por `rowId` único, ok.

**Red Team (matar "dedupe por settlement").** Se um dia a transferência comitar sem `externalRef` (bug), o dedupe falha silencioso e volta a duplicar. Mitigação: a união de refs + um **teste de idempotência de ponta a ponta** (importar 2x o mesmo CSV → 0 novos settlements/transactions na 2ª) trava a regressão; e o toggle dá a saída manual mesmo se o dedupe errar.

**Síntese (Chair).** **Consenso:** consumir `existingSettlements` no dedupe + paridade de seleção. **Tensões:** Critic quer união de refs + teste E2E. **Recomendação (lente = Architect + Critic):** **DEC-413 / L-WISE-DEDUP default (a)** — `classifyWiseRows` deduz por `externalRef` contra **transactions ∪ settlements**; transferência ganha `status` (`duplicate_import`/`new`), `includeByDefault=false` quando dup, e **toggle por linha** com o motivo ("já importada"); `undoWiseImportBatch` inalterado. **Condições:** teste de idempotência (2ª importação = 0 novos) + 4 desfechos de transfer. **O que viraria:** **alt (b)** = além disso, uma tabela leve de "refs já importados" (tombstone) por trip, se algum caminho comitar sem `externalRef`. **Confidence:** HIGH.

### Council B — `/council` · Mover dívida entre pessoas com histórico → **DEC-414**

**Decision Brief (neutro).** Julio: "a Debora me deve €12, o Bruno me deve €40; quero **mover** os €12 da Debora pro Bruno → Debora zera, Bruno passa a €52; com histórico, e o Bruno vê que aqueles itens vieram de outra pessoa." Fato: dívida = Σ `ParticipantShare` (por item) + `Settlement`; `ownerPairwiseBalances` calcula o net por pessoa; statement é por item (`buildParticipantStatement`). Viés a resistir: "cria um settlement da Debora e cobra o Bruno" (perde o **quais itens** e o **porquê**).

**Architect** — Duas modelagens. **(a) Reatribuir shares:** trocar `participantId` das shares escolhidas de Debora→Bruno, com `reassignedFrom=Debora` (aditivo) + um registro de movimento. Os **itens** viajam: o statement do Bruno passa a listá-los com "movido da Debora"; o net cai/sobe por construção; nada de dívida-fantasma. **(b) Settlements sintéticos:** `Settlement(Debora→owner, 12)` + uma cobrança nascida-confirmada `owner→Bruno, 12` com nota. Mais simples, mas o Bruno vê "€12 (outros)" **sem** os itens. Julio pediu os itens → **(a)**. **Rec:** reatribuir shares. **Confidence:** HIGH. **Outros perdem:** mover **valor parcial** sem item claro (ex.: "move €12 quaisquer") precisa de uma regra — mover shares até somar ~€12, ou permitir só mover itens inteiros.

**Advocate** — O modelo mental é "esses gastos agora são do Bruno". Selecionar **itens** (ou um valor que o app resolve em itens) e mover, com o Bruno vendo a lista + "originalmente da Debora". Precisa de **desfazer**. **Rec:** mover por itens, com trilha e undo. **Confidence:** HIGH. **Outros perdem:** e se o Bruno não usa o app? A trilha ainda tem que aparecer no statement que eu compartilho com ele (link).

**Critic** — Reatribuir `participantId` de uma share **muda o passado** — relatórios/insights que agrupam por pessoa mudam retroativamente. E se a Debora **já aceitou** (P2P) aquele item, mover quebra o espelho dela. **Rec:** só permitir mover shares **não** entregues/aceitas por P2P; manter `reassignedFrom` pra auditar; nunca tocar `Settlement` já feito. **Confidence:** MED. **Outros perdem:** invariante — a soma pairwise **total** do owner não pode mudar (só troca de titular); provar por teste.

**Red Team (matar "reatribuir shares").** Mudar `participantId` histórico é a maior fonte de bug (retroatividade + espelho P2P). Mitigação (vira o lock): mover é uma **operação registrada** (movement log com `fromParticipantId/toParticipantId/shareIds/at`), só sobre shares **locais não-aceitas**, com `reassignedFrom` preservando a origem pra UI e auditoria; itens já reconciliados por P2P ficam de fora (ou exigem acerto antes). Se ficar arriscado → alt (b) settlements sintéticos.

**Síntese (Chair).** **Consenso:** mover **itens** (reatribuindo shares) com origem visível + histórico + undo; net total intacto; nunca dívida-fantasma. **Tensões:** Advocate (riqueza/itens) vs Critic (retroatividade/P2P). **Recomendação (lente = Advocate + Architect, cinto do Critic):** **DEC-414 / L-DEBT-MOVE default (a)** — nova op `reassignShares(fromId, toId, shareIds)`: seta `share.participantId=to` + `share.reassignedFrom=from` (aditivo) + grava um `DebtMovement` (log); statement do destinatário mostra os itens com "movido de {nome}"; só shares **locais não aceitas por P2P**; `Â-DEBT-TRACEABLE`. UI no `SharedExpensesPage` (no statement da pessoa: "mover para…"). **Condições:** teste de invariância (soma pairwise total do owner = baseline) + teste de atribuição visível + undo. **O que viraria:** **alt (b)** = settlement da origem + cobrança nascida-confirmada no destino com nota (sem itens) — se a reatribuição histórica for julgada arriscada demais. **Confidence:** MED-HIGH.

### Council C — `/council` · "Livre hoje" não pode inflar com a sobra (invariante) → **DEC-415**

**Decision Brief (neutro).** Julio: "quando passa um dia e eu **não** uso o dinheiro, **não** é pra aumentar o valor por dia — é pra ir tudo pro **cofrinho**." Fato: `calculateTodayFreeBudget` faz `allowance = (livreRestante+gastoHoje) × pesoHoje ÷ diasEfetivos`; subgastar sobe `livreRestante` e baixa `diasEfetivos` → mesada de amanhã **sobe**. O cofrinho (`buildPiggyLedger`) já acumula a sobra; o extra `daily_left` já capa no ideal-base com buffer>0 (DEC-279); o **herói** não capa. **Â-MONEY-INVARIANT:** o **total** livre não pode mudar. Viés a resistir: "mexer no livre é perigoso" — sim, por isso o total fica intacto; muda **só a leitura do dia**.

**Architect** — Fazer o herói herdar a mesma régua do `daily_left`: quando `piggyBalance>0` e há `baseDailyIdeal`, `todayAllowance = min(baseDailyIdeal, allowanceAtual)`. A **diferença** (o que não foi liberado hoje) **permanece** no livre total e é o que o cofrinho contabiliza — nada some, só não é derramado no dia. Puro, dentro de `calculateTodayFreeBudget` (novos params opcionais `piggyBalanceCents?`/`baseDailyIdealCents?`, retrocompatível). **Rec:** cap no ideal-base. **Confidence:** HIGH. **Outros perdem:** dias de pico (peso 1.5) — o ideal-base tem que respeitar o peso do dia (cap = ideal-base **do dia**, não o flat).

**Advocate** — O usuário quer estabilidade: "meu teto de hoje é ~€X (o ideal), o que sobrou está guardado, visível no cofrinho". Ver a mesada subir sozinha destrói a confiança no cofrinho. **Rec:** teto estável + cofrinho crescendo. **Confidence:** HIGH. **Outros perdem:** precisa de uma linha clara ("hoje até €X · no cofrinho €Y") pra não parecer que "sumiu" dinheiro.

**Critic** — Perigo de **quebrar a invariância**: se o cap subtrair do total, o livre encolhe (bug de dinheiro). E o "gasto de hoje" já entra no `startOfDayFree` — capar depois de já ter gastado pode dar número estranho (negativo/duplo). **Rec:** o cap afeta **só** `todayAllowance`/`freeToday` (display do dia); `avgUntilEndFlat` e o total ficam **exatamente** iguais; teste de invariância obrigatório. **Confidence:** MED-HIGH. **Outros perdem:** o dia em que o cofrinho é **usado** (saldo cai) — o cap tem que soltar de volta suavemente, sem degrau feio.

**Red Team (matar "cap no ideal-base").** Se o cofrinho e o cap não forem a **mesma** fonte, dá pra contar a sobra duas vezes OU sumir com ela. Mitigação: um **único** teste-âncora — em qualquer dia, **Σ(mesada diária liberada até hoje) + saldo do cofrinho = livre consumível acumulado** (bit-a-bit vs baseline). Se não fechar, o gate não passa. Isso amarra cap↔cofrinho numa identidade só.

**Síntese (Chair).** **Consenso:** capar o herói no ideal-base do dia quando há cofrinho; **total intacto**; sobra visível no cofrinho, não no dia. **Tensões:** Critic (invariância/edge) vs Advocate (estabilidade). **Recomendação (lente = Advocate + garantia do Critic):** **DEC-415 / L-COFRINHO-DAILY default (a)** — `calculateTodayFreeBudget` ganha `piggyBalanceCents?`/`baseDailyIdealCents?` (opcionais, retrocompat); com buffer>0, `todayAllowance = min(idealBaseDoDia, allowance)` (idem `freeToday`); `avgUntilEndFlat` e o **total** inalterados; `useDashboardModel` passa `piggyLedger.balance` + `baseDailyIdeal`. **Condições:** teste-âncora Σdiária+cofrinho = livre (bit-a-bit); sem params = comportamento byte-idêntico; dias de pico respeitados; UI "hoje até €X · cofrinho €Y". **O que viraria:** **alt (b)** = deixar o herói como está e só **rotular** ("livre acumulado; ideal do dia €X; cofrinho €Y") sem capar — se capar o herói for julgado arriscado pro modelo mental de "posso usar tudo se quiser". **Confidence:** MED-HIGH.

### Council D — `/council` · Nova tela: gastos no mapa (clusters/heatmap/satélite) → **DEC-416**

**Decision Brief (neutro).** Julio quer uma tela nova: todos os gastos num mapa (satélite), **juntando** pontos por nível de zoom (cluster), clicar num cluster/ponto e ver os gastos, quantos por lugar; depois, um **heatmap**. Fato: gastos carregam `latitude/longitude/placeLabel`; Leaflet já está no bundle (`ExpenseLocationMap`); muitos gastos **não** têm coords ainda (G3 melhora isso). Viés a resistir: "faz tudo (cluster+heat+satélite+filtros) num gate" (escopo enorme).

**Advocate** — O valor central: abrir o mapa em satélite, ver **onde** gastei, tocar um cluster e ver a lista com totais. Heatmap é encantamento (fase 2). MVP tem que ser **rápido e bonito** com o que já tem coords. **Rec:** MVP = clusters + satélite + tap→lista; heat depois. **Confidence:** HIGH. **Outros perdem:** estado "poucos gastos com local" precisa de um empty-state honesto (+ CTA pro G3 preencher).

**Architect** — Reusar Leaflet + `leaflet.markercluster` (cluster por zoom, testado, leve) e, na fase 2, `leaflet.heat`. Rota `/mapa` lazy (code-split, como as outras). O domínio agrega puro: `buildExpenseMapPoints(transactions)` → pontos {lat,lng,count,totalCents,txIds}; a UI só desenha. Satélite = mesmo `tileLayer` do G9 (Esri). **Rec:** markercluster + agregador puro + rota lazy. **Confidence:** HIGH. **Outros perdem:** dependência nova (`leaflet.markercluster`) — pequena, mas é dep nova (confirmar com Julio via lock).

**Critic** — Performance com centenas de pontos + tiles de satélite em 3G/offline. E privacidade: um mapa com a casa/hotel exato. **Rec:** virtualizar via cluster (markercluster já ajuda), lazy tiles, e **não** compartilhar esse mapa (é só do dono, local). Offline → tiles não carregam, cai num aviso, sem travar. **Confidence:** MED. **Outros perdem:** clicar num cluster de muitos itens precisa paginar a lista.

**Red Team (matar "MVP cluster+satélite").** Dep nova (`leaflet.markercluster`) pode brigar com o code-split/lazy e pesar no bundle. Mitigação: carregar a lib **dentro** do chunk lazy da tela `/mapa` (não no core), com `lazyWithRetry`; se a dep incomodar, fase 1 pode agrupar por **arredondamento de coordenada** (grid) sem lib — cluster "caseiro" — e adicionar markercluster só se valer.

**Síntese (Chair).** **Consenso:** tela nova lazy, satélite, cluster por zoom, tap→detalhe; heatmap fase 2; agregador puro; não compartilhável. **Tensões:** Architect (lib pronta) vs Critic/Red (dep nova/bundle). **Recomendação (lente = Advocate + Architect):** **DEC-416 / L-MAP-SCREEN default (a)** — rota `/mapa` lazy; `domain/map/expense-map.ts › buildExpenseMapPoints` (puro); UI com `leaflet.markercluster` (dentro do chunk lazy) + tiles Esri; tap no cluster/ponto → sheet com lista (total + itens, paginada) → item abre `/expenses/:id`; empty-state honesto + CTA "preencher locais" (G3). **Heatmap = follow-up** (fase 2, `leaflet.heat`). **Condições:** só coords reais; offline não trava; não compartilhável; bundle do core inalterado (lib no chunk lazy). **O que viraria:** **alt (b)** = cluster caseiro por grid (sem dep nova) OU incluir heatmap já no G11 se o tempo permitir. **Confidence:** HIGH.

### Council E — `/council` · Amigo Sincero variar (parar de fixar num gasto) → **DEC-417**

**Decision Brief (neutro).** Julio: "o Amigo fica sempre no mesmo gasto (o mais caro, de semanas atrás), como se só tivesse isso pra falar." Fato: `amigoTriggerTx` = expense **mais recente por data** (em lote, pode ser um caro antigo); veredito `no_plan` = "esse gasto levou X% do livre" (pt-BR:832), sem rodízio; o carrossel de extras (`honest-friend-extras`) já dá variedade, mas o **slide 0** (veredito) fixa. Viés a resistir: "troca o gatilho pro maior" (só muda **qual** gasto fixa, não resolve a monotonia).

**Advocate** — O Amigo tem que soar vivo: hoje fala de ritmo, amanhã de uma categoria, depois de um gasto notável — e **nunca** repetir o mesmo gasto duas vezes seguidas. Quando há ritmo/plano, **prefira** o veredito de ritmo (útil e sempre novo) ao "esse gasto levou X%". **Rec:** preferir ritmo + rodízio + dedupe. **Confidence:** HIGH. **Outros perdem:** "notável" ≠ "mais recente" — o gasto citado deveria ser **relevante** (grande vs seu padrão), não só o último.

**Architect** — Barato e puro: (1) escolher o trigger por **relevância** (ex.: maior desvio vs mediana da fase) entre os **top-N** recentes, não `sort(date)[0]`; (2) manter um pequeno **estado de "já citei"** (últimas 1-2 tx/ tópicos citados) pra rodiziar; (3) quando `no_plan` mas há ritmo, cair no veredito de ritmo. Estado pode viver em `settings` (aditivo) ou derivar do dia. **Rec:** seleção por relevância + rodízio + fallback de ritmo. **Confidence:** MED-HIGH. **Outros perdem:** rodízio determinístico (por dia) evita "piscar" a cada render.

**Critic** — Rodízio demais vira ruído ("fala coisa diferente toda hora, nada fica"). E "relevância" mal calibrada pode escolher um gasto bobo. **Rec:** rodízio **estável por dia** (muda no máximo 1x/dia), e a régua de relevância reusa `SINGLE_EXPENSE_DOMINANCE`/desvio já existente. **Confidence:** MED. **Outros perdem:** se não há nada novo a dizer, é ok **repetir menos** (silenciar o slide de gasto) em vez de forçar.

**Red Team (matar "seleção por relevância + rodízio").** Estado de "já citei" persistido pode ficar dessincronizado (backup/restore) e travar num tópico. Mitigação: o rodízio é **derivado** (função do dia + hash das tx), não um contador frágil; sem persistência crítica. E há sempre um fallback factual (ritmo) que nunca "acaba".

**Síntese (Chair).** **Consenso:** preferir veredito de ritmo quando existir; trigger por **relevância** entre recentes; **dedupe/rodízio estável por dia**; o "gasto levou X%" vira **um** slide rotativo, não o herói fixo. **Tensões:** Advocate (variedade) vs Critic (estabilidade/ruído). **Recomendação (lente = Advocate + Architect, freio do Critic):** **DEC-417 / L-AMIGO-VARIETY default (a)** — (1) `amigoTriggerTx` = mais **relevante** (maior desvio vs mediana da fase) entre os top-N recentes; (2) quando `no_plan` e há ritmo/plano, o veredito de ritmo tem prioridade; (3) rodízio **derivado do dia** (muda ≤1x/dia) escolhe o slide de destaque, sem repetir a última tx citada. Tudo puro/testável. **Condições:** determinístico por dia (não pisca); régua de relevância reusa o que já existe; nunca força quando não há sinal. **O que viraria:** **alt (b)** = mínimo — só **dedupe** (não repetir a mesma tx 2 sessões seguidas) sem mudar a seleção. **Confidence:** MED-HIGH.

### Council F — `/council` · Remover pessoa de vez (mesmo sem app) → **DEC-418**

**Decision Brief (neutro).** Julio: "quero remover a pessoa **de vez**, mesmo sem app, pra ela não ficar na lista à força; hoje eu removo a conexão e o nome continua lá como 'sem app'." Fato: `handleRemovePerson`→`removeConnectedPerson` **desvincula** (peerLink tombstone) mas mantém o `Participant` → vira `noapp`; o botão remover só aparece pra quem tem `linkedActorId`/peerLink → `noapp` puro **não tem** remover. `buildPeopleView` itera `participants`; soft-delete some da lista (se `getByTripId` filtra `deletedAt`). Viés a resistir: "apagar de verdade" (o app é hide-never-delete; o histórico de rateios precisa sobreviver).

**Advocate** — "Remover" pro usuário = **sumir da lista de pessoas**. Precisa valer pra **todos** os status (connected/invited/**noapp**). Se a pessoa tem saldo aberto, avisar e oferecer acertar antes; se zero, remover é um toque. **Rec:** remover = esconder o participante, pra qualquer status. **Confidence:** HIGH. **Outros perdem:** o histórico antigo (um gasto dividido com ela) deve continuar coerente — mostrar o **nome** no histórico mesmo com a pessoa "removida".

**Architect** — Soft-delete: `participant.deletedAt = now` (aditivo, já é o padrão do app). `buildPeopleView`/`getByTripId` passam a excluir `deletedAt !== null` (confirmar o filtro no repo). Uma op `removePerson(id)` que, além do soft-delete, tombstona peerLink se houver (reusa `removeConnectedPerson` como sub-passo). Statement/insights leem o nome via id (histórico intacto). **Rec:** soft-delete + excluir da view. **Confidence:** HIGH. **Outros perdem:** owner **nunca** é removível; e a pessoa com saldo aberto precisa de uma trava (senão o net do owner fica órfão).

**Critic** — Remover alguém com **dívida aberta** deixa o dinheiro pendurado (net do owner conta a dívida dela). E se ela é `linkedActorId` de um espelho P2P vivo, sumir localmente pode confundir. **Rec:** só permitir remover com **saldo zero** (ou depois de acertar/perdoar); manter a trilha. **Confidence:** MED-HIGH. **Outros perdem:** "esconder mas manter no histórico" tem que ser à prova de reaparecer (um novo share reabriria a pessoa? — remover deve valer até uma ação explícita).

**Red Team (matar "soft-delete sem checar saldo").** Esconder alguém com dívida aberta corrompe a percepção do net ("some a pessoa, fica o valor"). Mitigação (vira o lock): `removePerson` **exige saldo aberto = 0** (ou oferece "acertar/perdoar antes"); com saldo, o botão explica e leva ao acerto. Assim `Â-PERSON-HIDE-NEVER-BREAK` se mantém.

**Síntese (Chair).** **Consenso:** remover = **soft-delete** do participante (esconde da lista, qualquer status, inclusive `noapp`), histórico preservado, owner nunca. **Tensões:** Advocate (remover sempre) vs Critic (trava de saldo). **Recomendação (lente = Advocate + freio do Critic):** **DEC-418 / L-REMOVE-PERSON default (a)** — nova op `removePerson(id)`: soft-delete `deletedAt` + tombstone de peerLink se houver; `buildPeopleView`/repo excluem `deletedAt`; botão "remover pessoa" aparece pra **todos** os status (não só conectados), com trava de **saldo aberto = 0** (senão CTA "acertar antes"); histórico mostra o nome via id. **Condições:** owner nunca removível; teste "removido some da lista mas o gasto histórico ainda credita o nome"; nada de dívida órfã. **O que viraria:** **alt (b)** = permitir remover **sempre** com um aviso forte "o saldo dela será descartado/mantido no histórico" (se Julio preferir liberdade total a trava). **Confidence:** HIGH.

### Decisões diretas (sem fork — clareza alta)

- **DEC-419 (G3)** — **Import geocoda o local (sem IA).** Após `commitWiseImport`, enfileirar as despesas importadas no pipeline de stamp (`stamp-expense-location.ts`) usando `merchant`/`description`/`extractCity` como consulta → `searchPlaceByName` grava `placeLabel+coords+placeId` (`placeNameSource='import'`). Batelado + rate-limit (Nominatim ~1 req/s), best-effort, offline-safe. Vale pra **todas** as entradas novas do import. `Â-PLACE-REAL`/`Â-NEVER-BLOCK`.
- **DEC-420 (G3)** — **Categorização mais rica (sem IA).** Expandir `CATEGORY_RULES`: mais marcas/keywords por categoria + novas categorias plausíveis (ex.: `groceries` já é `market`; adicionar cobertura pra serviços/telecom/saques/`fee`), usar `detailsType`/direção como sinal e, quando o local for resolvido (DEC-419), o **tipo do POI** (Overpass/Nominatim `class/type`) como fallback de categoria. Data-driven (a lista continua a fonte). Preview segue editável (1 toque corrige).
- **DEC-421 (G9)** — **Detalhe do gasto mostra o evento.** `ExpenseDetailPage` lê `tx.occurrenceId`; se houver, renderiza uma linha "Evento" com o nome, linkando pra `/event/:id` (guia). Reuso puro (sem math).
- **DEC-422 (G9)** — **Mapa do detalhe em satélite.** `ExpenseLocationMap` troca o `tileLayer` pra **Esri World Imagery** (`https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}`, `maxZoom:19`, attribution Esri) com um **toggle mapa/satélite** (satélite como default, DEC-lock L-SATELLITE). Mesmo provider reusado no G11.
- **DEC-423 (G8)** — **Conversor: majors no topo + nome/país + refresh.** Novo `domain/money/currency-meta.ts` (mapa `code → {name, country, flag, priority}` cobrindo BRL/USD/EUR/CAD/CHF/GBP/JPY/… no topo por `priority`); `listSelectableCurrencies` passa a **ordenar por prioridade** e a UI mostra código + nome/país. E o snapshot `frozenRates` **auto-refresha** quando online e stale (ex.: > X h), sempre incluindo as majors (base-anchored já converte qualquer par). Best-effort/offline-safe.
- **DEC-424 (G10)** — **IA add com divisão + paridade de campos.** `AssistantSheet › ExpenseEditor` ganha um editor de **divisão** (participantes multi-select, pagador, igual/custom) escrevendo `participantIds/payerId/didSplit`/shares, além dos campos faltantes pra paridade com o QuickAdd (hora, nota, `isShared`). Reusa os componentes de split existentes. Confirm 1-toque intacto.
- **DEC-425 (G1)** — **Barra de rolagem some (de novo).** Investigar a superfície que reexpõe (provável Leaflet/`width:0`); endurecer o global com `display:none !important` no `*::-webkit-scrollbar` (além do `width:0`), cobrir os panes/containers do Leaflet, e adicionar a asserção no `style-hygiene.test.ts`. `Â-NO-SCROLLBAR`.

---

## §8 — Change-set (por gate)

**G0 — Baseline + provas (sem código de produção)**
- `tests` — caracterização do estado atual antes de mexer: (a) idempotência do import HOJE (documenta o bug do transfer duplicando); (b) `calculateTodayFreeBudget` sobe a mesada ao subgastar (documenta a inflação); (c) `amigoTriggerTx` = mais recente por data. Servem de "antes" pros gates.

**G1 — Barra de rolagem some (DEC-425) — `2.0.0-rc`**
- `src/styles/globals.css` — `*::-webkit-scrollbar`, `html/body::-webkit-scrollbar` ganham `display:none !important` (além de `width:0`); cobrir os panes/containers do Leaflet (`.leaflet-container`, `.leaflet-pane`) se reexpõem.
- `features/**` — auditar containers `overflow-*` novos (mapas, sheets) sem afordância própria.
- `tests` — `style-hygiene.test.ts` assere `display:none` no universal + root.

**G2 — Import idempotente + transfer desmarcável (DEC-413) — `2.0.1-rc`**
- `domain/import/wise-import.ts` — `classifyWiseRows`: `importedRefs` = refs de `existingTransactions` **∪** `existingSettlements`; transferência recebe `status`/`includeByDefault=false` quando dup.
- `features/import/WiseImportPage.tsx` — toggle incluir/excluir por transferência (paridade com os outros kinds) + motivo ("já importada em DD/MM"); `transferState` respeita o dedupe.
- `domain/orchestrators/import-orchestrators.ts` — `commitWiseTransfers` não recomita refs já presentes; `undoWiseImportBatch` inalterado.
- `tests` — idempotência (2ª importação = 0 novos); 4 desfechos de transfer; dup vem desmarcada.
- i18n `import.transfer_already_imported*` (pt/en/es).

**G3 — Import geocoda + categoriza melhor (DEC-419 + DEC-420) — `2.0.2-rc`**
- `domain/import/wise-import.ts` — `CATEGORY_RULES` expandido (marcas/keywords/categorias) + sinais (`detailsType`/direção); `guessCategory` opcionalmente aceita o tipo de POI resolvido.
- `domain/orchestrators/import-orchestrators.ts` — após commit, enfileirar as despesas no stamp de local.
- `features/location/stamp-expense-location.ts` — aceitar seed de consulta (merchant/title/`extractCity`); batelar + rate-limit; best-effort.
- `tests` — `guessCategory` cobre casos que hoje caem em "outros"; geocode mapeado (mock de rede) grava coords; offline não trava.
- i18n (se surgirem rótulos novos de categoria) (pt/en/es).

**G4 — "Livre hoje" não infla (cofrinho) (DEC-415) — `2.0.3-rc` (invariante de dinheiro)**
- `domain/phases/rhythm.ts` — `calculateTodayFreeBudget(+piggyBalanceCents?, +baseDailyIdealCents?)`: com buffer>0, `todayAllowance/freeToday = min(idealBaseDoDia, …)`; `avgUntilEndFlat` e total inalterados.
- `features/dashboard/useDashboardModel.ts` — passar `piggyLedger.balance` + `baseDailyIdeal` ao cálculo; herói lê o valor capado.
- UI — linha "hoje até €X · cofrinho €Y" onde o herói aparece.
- `tests` — **teste-âncora** Σ(mesada diária liberada) + cofrinho = livre consumível (bit-a-bit vs baseline); sem params = byte-idêntico; dia de pico respeitado; dia que usa o cofrinho solta suave.

**G5 — Amigo Sincero varia (DEC-417) — `2.0.4-rc`**
- `features/dashboard/useDashboardModel.ts` — `amigoTriggerTx` = mais **relevante** (maior desvio vs mediana) entre top-N recentes; rodízio derivado do dia; dedupe da última tx citada.
- `domain/budget/honest-friend.ts` — quando `no_plan` e há ritmo/plano, priorizar o veredito de ritmo; o "gasto levou X%" vira slide rotativo.
- `tests` — determinístico por dia (não pisca); não repete a mesma tx; prefere ritmo quando disponível.

**G6 — Mover dívida entre pessoas (DEC-414) — `2.0.5-rc`**
- `domain/types/participant-share.ts` — `reassignedFrom?: string | null` (aditivo, `.passthrough()`).
- `domain/splitting/splitting.ts` — `reassignShares(fromId, toId, shareIds)` (puro): troca `participantId`, marca `reassignedFrom`; `buildParticipantStatement` mostra "movido de {nome}".
- `domain/types/debt-movement.ts` (novo, aditivo) + repo/persistência leve do log (`fromId/toId/shareIds/at`).
- `features/shared/SharedExpensesPage.tsx` — no statement da pessoa: "mover para…" (escolher destino + itens/valor) + histórico + undo; só shares locais não aceitas por P2P.
- `tests` — invariância (soma pairwise total do owner = baseline); atribuição visível no destino; undo; P2P-aceita fica de fora.
- i18n `settle.move_debt*`/`settle.moved_from` (pt/en/es).

**G7 — Remover pessoa de vez (DEC-418) — `2.0.6-rc`**
- `domain/connections/*` (ou orchestrator de pessoas) — `removePerson(id)`: soft-delete `deletedAt` + tombstone de peerLink se houver; trava de saldo aberto = 0.
- `data/repositories/participant-repository` — confirmar/garantir que `getByTripId` exclui `deletedAt !== null`.
- `domain/connections/people-view.ts` — `buildPeopleView` ignora `deletedAt`.
- `features/shared/SharedExpensesPage.tsx` — botão "remover pessoa" pra **todos** os status (inclusive `noapp`); com saldo → CTA "acertar antes"; owner nunca.
- `tests` — removido some da lista mas o histórico credita o nome; trava de saldo; owner protegido.
- i18n `connections.remove_person*`/`connections.settle_before_remove` (pt/en/es).

**G8 — Conversor: majors/nome/país + refresh (DEC-423) — `2.0.7-rc`**
- `domain/money/currency-meta.ts` (novo) — `code → {name, country, flag, priority}` (majors com prioridade alta).
- `domain/money/exchange.ts` — `listSelectableCurrencies` ordena por `priority` (majors no topo), resto alfabético.
- `features/converter/ConverterPage.tsx` — mostrar código + nome/país (+ flag) nas listas.
- `utils/exchange-rates.ts` + refresh — auto-atualizar `frozenRates` quando online e stale (limiar de horas), garantindo as majors; best-effort/offline-safe.
- `tests` — ordem (majors primeiro); meta resolvida; refresh dispara só quando stale/online; base-anchored converte par não-base.
- i18n (nomes de moeda via meta; rótulos) (pt/en/es).

**G9 — Detalhe do gasto: evento + satélite (DEC-421 + DEC-422) — `2.0.8-rc`**
- `features/expenses/ExpenseDetailPage.tsx` — linha "Evento" (lê `occurrenceId`) → nome + link `/event/:id`.
- `features/location/ExpenseLocationMap.tsx` — `tileLayer` Esri World Imagery + toggle mapa/satélite (satélite default).
- `tests` — detalhe renderiza evento quando há `occurrenceId`; sem evento não renderiza a linha.
- i18n `expense.event_label`/`map.satellite`/`map.map` (pt/en/es).

**G10 — IA add: divisão + paridade de campos (DEC-424) — `2.0.9-rc`**
- `features/assistant/AssistantSheet.tsx` — `ExpenseEditor` ganha editor de divisão (participantes/pagador/igual-custom) + hora/nota/`isShared`; reusa componentes de split.
- `features/assistant/useAssistant.ts` — `patchDraft` cobre `participantIds/payerId/didSplit`/shares; validação.
- `tests` — editar split no preview escreve o op certo; confirm gera shares corretas; sem split = comportamento atual.
- i18n `assistant.split_*` (pt/en/es).

**G11 — Tela de gastos no mapa (DEC-416) — `2.1.0-rc`**
- `domain/map/expense-map.ts` (novo, puro) — `buildExpenseMapPoints(transactions)` → pontos {lat,lng,count,totalCents,txIds}.
- `features/map/ExpenseMapPage.tsx` (novo, rota `/mapa`, lazy) — Leaflet + `leaflet.markercluster` (no chunk lazy) + tiles Esri; tap no cluster/ponto → sheet com lista paginada → item abre `/expenses/:id`; empty-state + CTA "preencher locais".
- `app/router.tsx` — rota `/mapa` lazy; entrada no menu/descobrir.
- `package.json` — dep `leaflet.markercluster` (+ types).
- `tests` — `buildExpenseMapPoints` agrega certo (count/total); só coords reais; offline não trava.
- i18n `map.*` (pt/en/es). **Heatmap = follow-up.**

---

## §9 — Estratégia de testes

- **G0** — caracterização (documenta os "antes": transfer duplica, mesada infla, trigger por data).
- **G1** — `style-hygiene.test.ts` assere `display:none` universal + root; sem barra em containers novos.
- **G2** — idempotência ponta-a-ponta (2ª importação do mesmo CSV = 0 novos); dedupe por `settlements`; dup desmarcada; 4 desfechos de transfer.
- **G3** — `guessCategory` cobre um lote de merchants que hoje caem em "outros"; geocode do import grava coords (mock de rede); offline/sem match não trava nem inventa local.
- **G4** — **teste-âncora** Σ(mesada diária liberada até hoje) + saldo do cofrinho = livre consumível acumulado (bit-a-bit vs baseline); sem os params novos = byte-idêntico; dia de pico respeita o peso; usar o cofrinho solta suave.
- **G5** — determinístico por dia; não repete a mesma tx; prefere ritmo quando há plano/ritmo; relevância escolhe o gasto certo.
- **G6** — invariância (soma pairwise total do owner = baseline após mover); destino mostra "movido de {nome}"; undo restaura; P2P-aceita não é movível.
- **G7** — removido some da view mas o histórico credita o nome; trava de saldo aberto; owner nunca removível; `noapp` removível.
- **G8** — ordenação (majors primeiro); meta resolvida (nome/país); refresh só stale+online; par não-base converte via base-anchored.
- **G9** — detalhe renderiza evento com `occurrenceId` (e link); satélite ativa o tile Esri.
- **G10** — editar split no preview → op/shares corretas; confirm 1-toque; sem split intacto.
- **G11** — `buildExpenseMapPoints` agrega count/total; só coords reais; offline não trava.
- **Baseline** — suíte sem novas falhas; `tsc --noEmit` limpo; `npm run build` verde a cada gate.

---

## §10 — Gates & ordem (por risco/dependência/atrito)

| Gate | Entrega | DEC | Versão | Worker | Dep |
|---|---|---|---|---|---|
| G0 | Baseline + provas (caracterização) | — | — | não | — |
| G1 | Barra de rolagem some (ganho rápido) | DEC-425 | 2.0.0-rc | não | — |
| G2 | Import idempotente + transfer desmarcável (keystone) | DEC-413 | 2.0.1-rc | não | G0 |
| G3 | Import geocoda + categoriza melhor | DEC-419/420 | 2.0.2-rc | não | G2 |
| G4 | "Livre hoje" não infla (cofrinho) — invariante | DEC-415 | 2.0.3-rc | não | G0 |
| G5 | Amigo Sincero varia | DEC-417 | 2.0.4-rc | não | G0 |
| G6 | Mover dívida entre pessoas | DEC-414 | 2.0.5-rc | não | G0 |
| G7 | Remover pessoa de vez | DEC-418 | 2.0.6-rc | não | — |
| G8 | Conversor: majors/nome/país + refresh | DEC-423 | 2.0.7-rc | não | — |
| G9 | Detalhe: evento + mapa satélite | DEC-421/422 | 2.0.8-rc | não | — |
| G10 | IA add: divisão + paridade de campos | DEC-424 | 2.0.9-rc | não | — |
| G11 | Tela de gastos no mapa (heatmap = follow-up) | DEC-416 | 2.1.0-rc | não | G3, G9 |

> Ordem pensada pra **ganho rápido primeiro** (G1 scrollbar), depois a **verdade do import** (G2/G3), a **verdade do dinheiro** (G4, isolada), e o resto por independência. G11 vem por último (maior superfície nova) e ganha de G3 (mais gastos com local) e G9 (provider de satélite). G4–G10 são bastante independentes e podem reordenar se algum apertar o contexto.

---

## §11 — Riscos & mitigações

- **Quebrar a invariância do dinheiro (G4)** → o cap afeta **só** a leitura do dia; teste-âncora (Σdiária+cofrinho = livre) trava antes de seguir; sem params = byte-idêntico.
- **Reatribuição histórica de shares (G6)** → só shares locais não aceitas por P2P; `reassignedFrom` + log preservam origem; teste de invariância pairwise; se arriscado → alt (b) settlements sintéticos.
- **Dedupe silencioso (G2)** → união de refs (tx ∪ settlements) + teste de idempotência E2E; o toggle é a rede de segurança manual.
- **Migração acidental** → todo campo novo é aditivo/`.passthrough()`; teste de registro/payload antigo lendo `undefined`.
- **Rede no import/refresh/tiles (G3/G8/G9/G11)** → tudo best-effort, offline-safe; Nominatim rate-limit (~1 req/s) batelado; falha em silêncio.
- **Bundle/dep nova (G11)** → `leaflet.markercluster` só no chunk lazy da tela; core inalterado; alt = cluster caseiro por grid.
- **Escopo grande (12 gates)** → G10 (IA split) e G11 (mapa) são os candidatos a virar follow-up se o contexto apertar; G1/G7/G8/G9 são quick wins independentes.
- **Privacidade (G6/G11)** → nunca vaza fundo/wallet/pool; o mapa de gastos é local, não compartilhável.

---

## §12 — Definition of Done (da leva)

G0→G9 verdes (G10/G11 idealmente; senão registrados como follow-up). Import: reimportar o mesmo extrato **não** recria transferência e **tudo** é desmarcável; entradas novas ganham local automático; menos "Outros". Dinheiro: a sobra do dia fica **no cofrinho**, o "livre hoje" **não infla** (invariância provada). Amigo Sincero **varia** (não fixa num gasto). Acerto: dá pra **mover dívida** entre pessoas com histórico e atribuição. Pessoas: dá pra **remover de vez** (inclusive sem app), sem dívida órfã. Conversor: majors no topo, com nome/país, taxas frescas. Detalhe: mostra o **evento** e o mapa em **satélite**. IA add: dá pra **dividir**. Tela de **gastos no mapa** (clusters + satélite + clique). Barra de rolagem **sumiu**. Suíte sem novas falhas; `tsc`/`build` verdes; dev-log + decision-log (DEC-413→425 → APPROVED) + release-notes por versão.

---

## §13 — Deploy

Por gate: bump (`package.json` + `app-version.ts` + `public/version.json` + `release-notes.ts` pt/en/es + `package-lock.json`) → commit por item + fecha-gate → push master → Pages auto-build. **Nenhum gate roda `wrangler deploy`** (o worker não muda nesta leva; o geocode/refresh usa Nominatim/Overpass/open.er-api direto do device). OTA como sempre.

---

## §14 — Contexto pro executor (refresh em cada gate)

Reler antes de cada gate: este doc (§ do gate + §2 ÂNCORAS), `dev-log.md` (Current State), e a ÂNCORA relevante. No boundary de cada gate, imprimir o bloco NON-NEGOTIABLES (§2) + CURRENT STATE (5 linhas: gate ativo, último commit, contagem de testes, riscos, escopo). Mid-gate a cada 3 milestones: reler regras críticas + dev-log. **G4 é o gate de maior cuidado** (dinheiro) — o teste-âncora tem que passar antes de qualquer commit que feche o gate.

---

## §15 — Glossário

- **Transferência (Wise transfer)** — linha `TRANSFER` com contraparte nomeada; comita como `Settlement` (dívida/wallet-move/split), não como gasto — por isso o dedupe precisa olhar `settlements`.
- **externalRef** — `wise:{rowId}`, a chave de dedupe cross-source gravada em transaction **e** settlement.
- **Cofrinho** — `buildPiggyLedger` (Model B): a sobra de cada dia vs o ideal vira saldo guardado; o "livre hoje" não deve derramar essa sobra de volta no dia (G4).
- **Livre hoje (herói)** — `calculateTodayFreeBudget.todayAllowance/freeToday` — a leitura do dia; o **total** livre é outra coisa (não muda em G4).
- **Mover dívida** — `reassignShares`: troca o titular de shares (por item) com `reassignedFrom` + log; o net total do owner não muda, só de titular.
- **Remover pessoa** — soft-delete do `Participant` (`deletedAt`), esconde da lista, preserva histórico; ≠ desconectar (que só tira o vínculo P2P).
- **Pontos do mapa** — `buildExpenseMapPoints`: agregação pura de coords → clusters {count,total,txIds}.

---

## §16 — TRAVAS (✅ CONFIRMADAS por Julio 2026-06-30 — todas em (a))

> Julio confirmou **todas as 7 travas em (a)** e as **4 perguntas abertas nos defaults** (2026-06-30). Não há mais fork em aberto: o executor roda G0→G11 **sem parar** até a DoD (§12).

| Trava | Gate | Default (a) recomendado | Alternativa (b) |
|---|---|---|---|
| **L-WISE-DEDUP** | G2 | dedupe por `externalRef` contra **transactions ∪ settlements** + transfer desmarcável (dup default-off) | + tabela leve de "refs já importados" (tombstone) por trip |
| **L-DEBT-MOVE** | G6 | **reatribuir shares** A→B com `reassignedFrom` + log (itens viajam, origem visível), só shares locais não-P2P | **settlements sintéticos** (origem→owner + cobrança owner→destino com nota, sem itens) |
| **L-COFRINHO-DAILY** | G4 | **capar** "livre hoje" no ideal-base do dia quando cofrinho>0 (sobra fica no cofrinho); total intacto | não capar; só **rotular** ("livre acumulado; ideal €X; cofrinho €Y") |
| **L-MAP-SCREEN** | G11 | MVP = **clusters + satélite + tap→detalhe**; heatmap = follow-up; `leaflet.markercluster` no chunk lazy | cluster **caseiro por grid** (sem dep nova) **ou** já incluir heatmap no G11 |
| **L-AMIGO-VARIETY** | G5 | trigger por **relevância** + preferir ritmo + **rodízio/dedupe** estável por dia | **mínimo**: só dedupe (não repetir a mesma tx 2 sessões seguidas) |
| **L-REMOVE-PERSON** | G7 | soft-delete pra **qualquer status**, com **trava de saldo aberto = 0** (senão acertar antes) | permitir **sempre**, com aviso forte "o saldo será descartado/mantido no histórico" |
| **L-SATELLITE** | G9 | **satélite como default** + toggle mapa/satélite | satélite **only** (sem toggle) |

**Perguntas abertas — ✅ RESPONDIDAS por Julio 2026-06-30 (defaults):**
1. **Refresh de FX (G8):** ✅ **12h** — re-puxa as taxas automaticamente quando online e o snapshot passar de 12h; best-effort/offline-safe.
2. **Majors do topo (G8):** ✅ **BRL, USD, EUR, CAD, CHF, GBP, JPY** (nessa prioridade; o resto alfabético abaixo).
3. **Mover dívida (G6):** ✅ **por itens selecionados** (fiel); "mover €X" é conveniência que seleciona itens até somar o valor.
4. **Categorias novas (G3):** ✅ **enriquecer as 8 atuais + poucas novas de alto valor** (ex.: `services`, `cash`/saque) — data-driven, preview editável.

---

## §17 — Apêndice: arquivos-chave

- **Import:** `domain/import/{wise-import,wise-transfer,wise-csv}.ts`, `domain/orchestrators/import-orchestrators.ts`, `features/import/WiseImportPage.tsx`, `features/location/stamp-expense-location.ts`, `utils/places.ts`.
- **Dinheiro/cofrinho:** `domain/phases/rhythm.ts`, `domain/budget/piggy-ledger.ts`, `features/dashboard/useDashboardModel.ts`.
- **Amigo:** `domain/budget/{honest-friend,honest-friend-extras}.ts`, `features/dashboard/useDashboardModel.ts`, i18n `amigo_*`.
- **Acerto/pessoas:** `domain/splitting/splitting.ts`, `domain/connections/people-view.ts`, `domain/types/participant-share.ts`, `data/repositories/{settlement,participant,participantShare}-repository`, `features/shared/SharedExpensesPage.tsx`.
- **Conversor:** `domain/money/{converter,exchange}.ts`, `domain/money/currency-meta.ts` (novo), `utils/exchange-rates.ts`, `features/converter/ConverterPage.tsx`, `domain/types/app-settings.ts` (`frozenRates`).
- **Detalhe/mapa:** `features/expenses/ExpenseDetailPage.tsx`, `features/location/ExpenseLocationMap.tsx`, `features/event/EventGuidePage.tsx` (`/event/:id`), `features/map/ExpenseMapPage.tsx` (novo), `domain/map/expense-map.ts` (novo), `app/router.tsx`.
- **IA:** `features/assistant/{AssistantSheet,useAssistant}.ts(x)`, `domain/assistant/*`.
- **Scrollbar:** `src/styles/globals.css`, `src/tests/**/style-hygiene.test.ts`.




