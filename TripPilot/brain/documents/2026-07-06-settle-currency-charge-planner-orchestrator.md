# Orquestrador — Leva "Acerto multi-moeda, Cobrança rica & Planejador coerente"

**Status: 🏁 CLOSED (2026-07-06)** · Versões efetivas: `2.7.3-rc → 2.7.5-rc (G1+G2+G3 num só OTA, Pages c3e31be1) → 2.7.6-rc (G4, Pages 7337fc50)` · DEC-474..477 APPROVED · Suíte final 3236/3236 · Irmãos: `2026-06-24-coherence…`, `2026-06-25-discovery…`, `2026-06-25-field-fixes…`

---

## §0 Missão

Consertar o acerto de contas para que **cada dívida viva e seja cobrada na moeda original** (perfume R$380 → cobra R$380, nunca €380), eliminar **dívidas fantasma** ("Felipe deve a Bruno 167", "Julio te deve 53" para si mesmo), fazer **Pessoas == Resolver** (a verdade é pairwise), enriquecer a **página de cobrança** (fotos dos itens, formas de pagamento filtradas pela moeda da dívida, link da cobrança dentro da mensagem) e alinhar o **planejador** ao modelo "feito vs restante" para que Home, Viagem e Planejador falem o mesmo número.

O que esta leva **NÃO** é: não muda o cofrinho, não muda verbas/potes (DEC-456), não muda o fluxo de registrar gasto, não toca o worker (rotas existentes bastam), não reescreve o group-split.

A dor, nas palavras do Julio: *"Se é um gasto em real eu tenho que cobrar em real… O número que eu sei que está certo é o do Pessoas… o planejador está marcando o que vai ser junto com o que já foi e está comendo todo o resto… a foto não está lá… já deveria mostrar como me pagar… a mensagem tem que levar junto o link."*

Vá ao §17 para começar.

## §1 Identidade & contrato de autonomia

Você é o executor único desta leva, nesta sessão. Sem subagentes/Task tool. Não pedir permissão entre milestones/gates. Código em inglês; UI via `t()`; doc/brain em pt-BR. Domínio antes de UI, teste junto com a mudança. Terminal WSL: `git --no-pager`, commit só com `-m` (bypass `G=/usr/bin/git`). Brain sempre em sincronia (dev-log por milestone; DECs por gate).

## §2 Ordem de leitura

Este doc §0–§9 → `src/dev-log.md` (Current State) → DEC-471/472/473 (contexto da última leva), DEC-394/388/399/402/407 (acerto ego-cêntrico + payload), DEC-433/457 (payment methods no /g/ + fotos R2), DEC-462/463 (plano por fase + countFrom). Não re-ler o brain inteiro por milestone.

## §3 Não-negociáveis (ÂNCORA)

1. **Dinheiro = cents inteiros**; domínio = TS puro, zero React.
2. **Â-MOEDA-ORIGINAL (novo)**: dívida nasce, vive, é exibida e é cobrada na moeda da transação. **NUNCA converter dívida entre moedas** — nem para exibir total. Buckets por moeda, sempre.
3. **Â-PAIRWISE-FIEL (novo)**: o grafo de dívidas do acerto é pairwise-fiel — **nenhuma aresta que não exista nas shares confirmadas** (regra Splitwise: "ninguém passa a dever para quem nunca deveu"). Min-transfer (`suggestSimplifiedSettlements`) fica restrito ao group-split.
4. **Â-EGO-SETTLE (DEC-388/394)**: lista principal = só o que é meu; terceiros em registro display-only; Pessoas == Resolver por construção.
5. **Data-invariance**: onde a mudança é de exibição/atribuição, os totais do owner por moeda batem com as shares confirmadas − settlements (teste prova).
6. **Hide-never-delete**; nunca bloquear o registro de gasto; payloads evoluem **aditivos + opcionais** (guest antigo continua parseando).
7. **Â-PLANO-UMA-RÉGUA (novo)**: reserva do plano = `Σ max(0, planejado×típico − gasto-no-escopo-janelado)` com a MESMA régua (`matchesProfilePlanScope` + `countFromIso` + mesmo conjunto de txs) em Home, Planejador e Viagem. Uma função pura, três leitores.

## §4 Baseline — o que já existe (confirmado no código)

| Arquivo | Símbolo | Estado |
|---|---|---|
| `domain/splitting/splitting.ts` | `DebtEntry` (sem currency), `calculateDebts` (greedy, mistura moedas), `ownerPairwiseBalances` (fiel, 1 moeda), `buildParticipantStatement` (net único), `summarizeOwnerDebts`, `thirdPartyDebts`, `ownerInvolvedDebts`, `resolveSettlementStanding`, `createSettlement(currency ✓)` | GAP: moeda ausente no grafo |
| `domain/types/transaction.ts` | `currency`, `amountCents`, `baseCurrencyAmountCents`, `exchangeRate` | fonte da moeda ✓ |
| `domain/sync/statement-payload.ts` | `statementLineSchema` (sem currency/images), `statementPayloadSchema` (currency única, netCents único, sem paymentMethods), `buildParticipantSharePayload` | GAP: aditivos por moeda/foto/pagamento |
| `domain/sync/mirrored.ts` + `types/mirrored-statement.ts` | `buildMirroredStatement` (aceita self), `MirroredLine` (sem images/currency) | GAP: guard self + campos |
| `orchestrators/sync-orchestrators.ts` | `storeMirroredStatement` (sem guard de self-ingestão) | GAP raiz do "Julio te deve 53" |
| `orchestrators/share-link-orchestrators.ts` | `createShareLink`/`refreshShareLink` (payload pronto por closure) | ponto de injeção de fotos/métodos |
| `domain/payment/payment-methods.ts` | `PaymentMethod` (sem `currencies`), `buildPaymentInstructions` (sem filtro) | GAP |
| `features/shared/useRemindMessage.ts` | mensagem + métodos, **sem link** | GAP |
| `features/shared/ShareLinkSheet.tsx` | `handleShareOrCopy` (`shareLink.message`), publish/republish | reuso |
| `features/shared/MirroredStatementsSection.tsx` | render das linhas (lugar DEC-402), sem fotos/métodos/nets por moeda | GAP |
| `features/expenses/expense-share.ts` | `uploadExpenseImages` (attachments → R2 plaintext, DEC-348/457) | padrão a reusar |
| `data/sync/media-link.ts` | `uploadImage`, `imageUrl` | reuso direto |
| `domain/forecasting/forecasting.ts` | `matchesProfilePlanScope`, `countProfileOccasions`, `calculateOccasionForecasts` (`estimatedRemainingCostCents` usa `safeValueCents`!) | régua existente |
| `features/dashboard/useDashboardModel.ts` | loop `allocatedCents`/`allocatedSpentCents` (clamp por perfil, janela countFrom) + `calculateTrueFree` | modelo CORRETO (vira função compartilhada) |
| `features/planning/PlannerPage.tsx` | `liveMarginCents = available − currentAllocated` (dupla contagem), persist debounce 500ms **perdido no unmount** (cleanup limpa o timer sem flush) | GAP raiz do planner |
| `features/trip/TripHubPage.tsx` | `categoryRows` (gasto fase inteira SEM janela countFrom; sem tag "fora do plano"; "Livre nessa fase" = free bruto sem plano) | GAP |
| `features/expenses/QuickAddPage.tsx` L1595 | `t('expenses.fronted_hint')` | chave AUSENTE nos 3 locales |

## §5 Change-set normalizado

**P0** — D01 chave `expenses.fronted_hint` (×3 locales) · D02 dívida na moeda original (grafo+UI) · D03 self-debt guard ("Julio te deve") · D04 dívidas fantasma (pairwise-fiel; Pessoas==Resolver).
**P1** — D05 página de cobrança com fotos dos itens · D06 formas de pagamento por moeda (tipo+editor+filtro) · D07 métodos de pagamento NA página de cobrança · D08 link da cobrança dentro da mensagem de lembrete · D09 planejador "feito vs restante" + margem == home · D10 flush do plano ao sair + card Viagem janelado/rotulado/"livre após plano".
**P2** — D11 nets por moeda também no payload/guest (viaja junto com D05/D07).

## §6 Mapa de causa-raiz (código ↔ mudança)

| Sintoma | Causa exata | Direção | Gate |
|---|---|---|---|
| `expenses.fronted_hint` cru | chave ausente em `pt-BR/en/es.json` (DEC-473 f1 esqueceu os locales) | adicionar chave ×3 | G1 |
| Perfume R$380 cobrado €380 | `DebtEntry` sem moeda; `calculateDebts` soma `shareAmountCents` de moedas diferentes; UI formata tudo em `trip.baseCurrency` | grafo por (par, moeda); UI agrupa por moeda | G1+G2 |
| "Felipe deve a Bruno 167" | alocação greedy do `calculateDebts` REROTEIA saldos (viola "não criar credor novo") | grafo pairwise-fiel direto das shares−settlements | G1+G2 |
| "Julio Corsini te deve 53" | `storeMirroredStatement` aceita payload cujo `owner.actorId` == instalação local (Julio abriu o próprio link) | guard: rejeitar self-ingestão; filtrar/expurgar legado na UI | G2 |
| Pessoas ≠ Resolver | Pessoas usa `ownerPairwiseBalances` (fiel), Resolver usa grafo greedy | ambos leem o MESMO grafo pairwise por moeda | G2 |
| Foto não chega no link | `statementLineSchema` sem imagens; publish não sobe attachments | linha ganha `images` (modelo DEC-457); publish sobe via `uploadImage` | G3 |
| Guest não vê como pagar | payload sem `paymentMethods` (o `/g/` já tem, DEC-433) | payload ganha métodos (aditivos), filtrados por moeda | G3 |
| Pix de EUR mostrado para dívida BRL | `PaymentMethod` sem escopo de moeda | campo `currencies?: string[]` (vazio = todas) + editor + filtro | G3 |
| Mensagem sem link | `useRemindMessage` não recebe URL; `handleRemind` não cria/reusa link | garantir link (criar se faltar) e anexar URL na mensagem | G3 |
| Margem do planner ≠ home (−71 vs −19) | planner subtrai alocação CHEIA de um free que JÁ desconta o gasto (dupla contagem); home subtrai só o restante clampado | margem = `available − reserva-restante` (mesma função) | G4 |
| "17 bares viram 255 comendo o resto" | idem — 16 já feitas continuam reservadas | reserva conta só `max(0, planejado − feito)` | G4 |
| Editar plano não reflete na Viagem | persist debounce 500ms é CANCELADO no unmount (cleanup do effect) | flush no unmount + `visibilitychange` | G4 |
| Card Viagem "Bar 103 de 45 / Restaurante 106 sem plano" confuso | `categoryRows` sem janela `countFromIso` e sem rótulo p/ gasto sem meta; "Livre nessa fase" ignora o plano | mesma régua janelada + tag "fora do plano" + linha "livre após o plano" | G4 |

## §7 Decisões + conselhos inline

### Conselho A — modelo multi-moeda da dívida → **DEC-474**
*Brief:* shares guardam cents na moeda ORIGINAL da transação; o grafo soma tudo como se fosse uma moeda e a UI formata na moeda base. Julio exige cobrar na moeda original. Splitwise (VERIFICADO 06/07/2026, splitwise.com/api + FAQ): mantém **um saldo por moeda**, sem conversão automática (conversão é ação explícita/Pro). Tricount (VERIFICADO, help.tricount.com): converte tudo para a moeda base na entrada — modelo rejeitado explicitamente pelo Julio. Viés a resistir: "converter é mais simples de exibir".
*Strategist:* per-currency é o padrão do líder (Splitwise) e a única leitura que nunca mente; conversão embute taxa arbitrária numa DÍVIDA (atrito social). Rec: buckets por moeda. Conf: HIGH. Outros esquecem: settlements JÁ carregam `currency` — o modelo nativo do dado é per-currency.
*Architect:* `DebtEntry.currency` + chave `(debtor,creditor,currency)` é mudança local em `splitting.ts`; conversão exigiria taxa por-share e reabriria toda a math de câmbio (exchangeRate por transação ≠ taxa de cobrança). Rec: per-currency, zero conversão no domínio. Conf: HIGH. Outros esquecem: `netCents` único em payload/mirrored precisa de plano de compatibilidade aditiva.
*Critic:* o risco é a UI explodir em chips de moeda para 99% dos casos que são mono-moeda; e um total "te devem" que não soma mais. Rec: per-currency com UI que colapsa para o formato atual quando só há 1 moeda. Conf: MED. Outros esquecem: settlements antigos gravados na moeda base precisam abater o bucket certo (usar `settlement.currency`).
*Advocate:* o usuário pensa "me deve R$380 e €12", nunca "€391,37". Mostrar exatamente isso. Conf: HIGH. Outros esquecem: a mensagem de cobrança também precisa citar os valores por moeda.
*Red team:* "converter para base com a taxa da transação seria 1 número só e o Felipe pagaria em qualquer moeda" — morre porque a taxa da data da compra ≠ taxa do pagamento; cobrar €380 por R$380 foi exatamente o bug reportado; Splitwise valida que usuários preferem buckets.
*Síntese (Chair):* **per-currency em todo o grafo/statement/UI; nenhuma conversão; UI colapsa quando mono-moeda; settlements abatem o bucket da própria `currency`.** Lente dominante: Advocate (é uma dívida social, não contábil). Flip: se Julio pedir "total aproximado em €", adicionar linha display-only "≈ €X" SEM tocar o domínio. Conf: HIGH.

### Conselho B — Resolver: pairwise-fiel vs min-transfer → **DEC-475**
*Brief:* `calculateDebts` alastra saldos com alocação greedy → inventa "Felipe→Bruno 167" e "Débora→Julio 91". `ownerPairwiseBalances` (Pessoas) é fiel e o Julio a declarou fonte da verdade. Splitwise (VERIFICADO): "simplify debts" é OFF por default, opt-in, com regra dura "ninguém deve para quem não devia". DEC-388 já removeu o toggle de simplificação do acerto pessoal. Viés a resistir: "min-transfer é matematicamente ótimo".
*Strategist:* min-transfer otimiza nº de transferências à custa de CONFIANÇA; o produto é confiança. Rec: pairwise default. Conf: HIGH. Esquecem: o group-split (`/g/`) continua sendo o lugar certo do min-transfer (grupo fechado opt-in).
*Architect:* reescrever `calculateDebts` como pairwise+moeda mantém a assinatura (transactions/shares/participants/settlements/ownerId) e conserta TODOS os leitores de uma vez (hero, home, standing, partições). Netting entre pares (A→B 50, B→A 20 ⇒ A→B 30) preserva net por pessoa. Conf: HIGH. Esquecem: settlements hoje abatem GLOBALMENTE (não por par) — na pairwise têm que abater a aresta do par certo, com teste para pagamento "a mais" virando crédito reverso.
*Critic:* pairwise pode listar MAIS linhas para resolver (é o preço da fidelidade) e terceiro↔terceiro real (Felipe pagou, Bruno participou) continua existindo — não confundir com o fantasma. Rec: manter registro de terceiros display-only (DEC-388) e testar com os números do Julio. Conf: MED. Esquecem: `resolveSettlementStanding` soma tudo — por moeda agora.
*Advocate:* "quem me deve, quanto e em quê" — em Pessoas E em Resolver, idênticos, sem surpresa. Conf: HIGH. Esquecem: o hero "te devem X · você deve Y" também precisa dos buckets.
*Red team:* "min-transfer com rótulo 'sugestão' educaria o usuário" — morre: o Julio JÁ interpretou as linhas como dívidas reais; Splitwise só oferece isso opt-in por grupo, e nosso acerto é ego-cêntrico (DEC-388 removeu de propósito).
*Síntese:* **grafo pairwise-fiel por moeda como ÚNICO grafo do acerto pessoal; `suggestSimplifiedSettlements` fica exclusivo do group-split; guard de self-ingestão em `storeMirroredStatement` + expurgo de espelho self na UI.** Lente: Critic/Advocate juntos (fidelidade > otimização). Flip: grupo grande com malha densa pedindo "como pagar com menos transferências" → apontar para Divisões em grupo. Conf: HIGH.

### Conselho C — modelo do planejador → **DEC-477**
*Brief:* planner subtrai alocação cheia do free atual (dupla contagem: −71); home subtrai só o restante clampado (−19, correto); card Viagem mistura janelas e não rotula gasto sem meta; edits somem se sair <500ms (debounce cancelado no unmount). Julio: "ele está marcando o que vai ser junto com o que já foi… tive que pôr 17 bares para aparecer 1 restante… conselho decide". Viés a resistir: "só arrumar o número do header".
*Strategist:* o planejador deve responder "quanto do meu futuro ainda está comprometido" — passado não se planeja. Modelo done/remaining espelha Splitwise-like honestidade e o mental model do Julio. Rec: reserva = só restante. Conf: HIGH. Esquecem: o stepper deve continuar controlando o TOTAL planejado (17), senão quebra countFrom/DEC-463.
*Architect:* extrair a régua do home (`matchesProfilePlanScope` + clamp por perfil + janela countFrom) para UMA função pura em `domain/forecasting` e fazer os 3 leitores consumirem-na; margem do planner = `available − reserveRemaining` ⇒ IDÊNTICA ao home por construção (teste de igualdade). Flush do persist no unmount/pagehide. Conf: HIGH. Esquecem: TripHub `categoryRows` também não aplica a janela — é o "Bar 103 de 45".
*Critic:* mostrar "feito" dentro do planner pode confundir com o contador do card metas; e clamp por perfil esconde estouro (bar 103 de 45 zera a reserva mas o excesso já saiu do free — correto, mas precisa aparecer como "estourou +58"). Rec: linha por perfil "N feitas · M restantes · estourou +X quando aplicável". Conf: MED. Esquecem: perfis com gasto e SEM plano precisam de rótulo ("fora do plano"), não de linha muda.
*Advocate:* o Julio quer bater o olho e entender: "165 na fase − 19 reservado = 146 livre" nos TRÊS lugares, e o que ele edita persistir na hora. Conf: HIGH. Esquecem: feedback visível de salvamento ("salvo ✓") custa pouco e mata a desconfiança.
*Red team:* "mudar o home para subtrair alocação cheia unificaria igual" — morre: dupla-conta o gasto (o free JÁ desceu quando gastou) e faria o hero mentir para baixo; o modelo correto é o do home (DEC-236/FIELD-18 já validado em campo).
*Síntese:* **função pura única `calculatePlanProgress` (done/remaining/reserva por perfil + totais, janelada e clampada); planner mostra feito·restante·estouro por linha e margem = available − reserva (== home); flush do persist no unmount/visibilitychange; card Viagem usa a mesma régua com janela + tag "fora do plano" + "livre após o plano".** Lente: Architect (uma régua, três leitores). Flip: se o campo mostrar que "feito" no planner confunde, esconder atrás de um toggle de detalhe — a MARGEM não volta a dupla-contar em nenhum cenário. Conf: HIGH.

### Decisões diretas (sem conselho — diretriz explícita do Julio)
- **DEC-476**: página de cobrança ganha fotos dos itens (modelo R2 DEC-457, aditivo), formas de pagamento do owner filtradas pela moeda do bucket devido (modelo DEC-433), e a mensagem de "Lembrar/Cobrar" SEMPRE leva o link da cobrança (criando/reusando o share link do participante).
- D01 (`fronted_hint`) é defeito da DEC-473 — sem DEC nova.

## §8 Estratégia de teste

Domínio puro primeiro: `splitting.test.ts` estendido com os números REAIS do Julio (perfume 380 BRL, buckets EUR/BRL, netting pairwise, settlements por moeda, "nenhuma aresta nova"), `statement-payload.test.ts` (currency/images/paymentMethods aditivos — payload velho parseia), `payment-methods` (filtro por moeda; vazio = todas), `forecasting` (`calculatePlanProgress`: clamp, janela, fora-do-plano, igualdade com o loop do home). UI crítica: manter suíte existente verde; smoke manual 3 jornadas. Invariância: por moeda, `−Σ ownerPairwiseBalances == net owner` do grafo novo. Baseline conhecida: 2 falhas `split-live-loop` (WebCrypto/Node) — verdes só no CI.

## §9 Protocolo por milestone

5-point check (ACs satisfeitos; 3 ACs anteriores em risco verificados; testes sem falha nova; arquivos fora de escopo flagados; dev-log). Refresh leve a cada 3 milestones; ANCHOR+CURRENT STATE a cada gate.

## §10 THE BUILD — gates

### G0 — Setup & baseline
`npm install` (se preciso) · `npm run test` · `npx tsc --noEmit` · `npm run build` · registrar contagens · dev-log seed · DEC-474..477 PROPOSED no decision-log.
**AC-G0**: baseline verde documentada.

### G1 — Domínio multi-moeda pairwise (+ fronted_hint) — D01, D02, D04 (domínio)
- m1: chave `expenses.fronted_hint` ×3 locales.
- m2: `DebtEntry.currency`; `calculateDebts` vira pairwise-fiel por (par, moeda) com netting e settlements por aresta/moeda (mesma assinatura); `summarizeOwnerDebts`/`thirdPartyDebts`/`ownerInvolvedDebts`/`resolveSettlementStanding`/`calculateParticipantBalances` cientes de moeda (agrupamentos `ByCurrency` onde preciso); `ownerPairwiseBalancesByCurrency`.
- m3: `buildParticipantStatement` → `StatementLine.currency` + `nets: PerCurrencyNet[]` (mantém `netCents` = bucket da moeda base p/ compat); `filterStatementToCounterparty` idem.
- m4: testes (números do Julio + invariância + aresta-nova=proibida).
**AC-G1**: perfume 380 BRL nunca aparece como EUR no grafo; nenhum par inventado; suíte verde.

### G2 — UI do acerto por moeda + guards — D02, D03, D04 (UI) → deploy `2.7.4-rc`
- m1: guard self-ingestão em `storeMirroredStatement` (actorId local ⇒ rejeita) + `MirroredStatementsSection` filtra/expurga espelhos self legados.
- m2: `SharedExpensesPage` — Resolver/hero/pessoas/settle sheet/remind por bucket de moeda (colapsa se mono-moeda); `handleRemind` usa `debt.currency`.
- m3: home (`useDashboardModel`/cards "te devem · você deve") por moeda (chips; colapsa se mono).
- m4: testes + gate close (suíte, tsc, build, bump, deploy, DECs 474/475 APPROVED).
**AC-G2**: Pessoas == Resolver (mesmos pares e valores por moeda); "Julio te deve" impossível; smoke 3 jornadas.

### G3 — Página de cobrança rica — D05..D08, D11 → deploy `2.7.5-rc`
- m1: `PaymentMethod.currencies?: string[]` + editor (chips de moeda) + `buildPaymentInstructions(currency?)` + testes.
- m2: `statement-payload` aditivos: `line.currency`, `line.images` (modelo `ExpenseShareImage`), `payload.nets`, `payload.paymentMethods` (com currencies); `mirrored-statement`/`buildMirroredStatement` idem; testes de compat.
- m3: publish sobe fotos dos attachments das linhas (reuso `uploadImage`, cache por attachment, best-effort) e injeta métodos habilitados; `SharedExpensesPage.buildPayload`/`ShareLinkSheet` plugados.
- m4: guest (`MirroredStatementsSection`): thumbs por linha + viewer, nets por moeda, bloco "como pagar {owner}" filtrado pela moeda do bucket devido (copiar valor), settle proposal por bucket.
- m5: `useRemindMessage` ganha `url` + `currency`; `handleRemind` garante link (cria se faltar) e anexa URL; `SplitShareNudgeSheet` idem; gate close + DEC-476 APPROVED.
**AC-G3**: link mostra foto do perfume; devedor BRL vê SÓ métodos BRL (ou sem escopo); mensagem carrega o link.

### G4 — Planejador coerente — D09, D10 → deploy `2.7.6-rc`
- m1: `calculatePlanProgress` puro em `domain/forecasting` (por perfil: done, planned, spentCents janelado/escopado, plannedCents, reserveCents; totais) + testes (incl. igualdade com o modelo do home).
- m2: `useDashboardModel` consome a função (invariância bit-a-bit do hero — teste).
- m3: `PlannerPage` — linha por perfil "N feitas · M restantes (+estourou X)"; header `alocado / já usado / reservado / margem = available − reserva`; flush do persist no unmount + `visibilitychange` (+ "salvo ✓").
- m4: `TripHubPage` — categoryRows com janela countFrom + mesma régua; tag "fora do plano"; card mostra "livre após o plano"; gate close + DEC-477 APPROVED.
**AC-G4**: margem do planner == "no plano" do home (mesmo valor absoluto); editar e voltar imediatamente reflete na Viagem; 17 bares/16 feitas reserva SÓ 1.

### G5 — Regressão final & brain
Suíte inteira + tsc + build; smoke matrix; `project-status.md`, `product-spec.md` (regras novas), `README` pointer; dev-log fechamento.

## §11 Terminal (WSL)

`git --no-pager` sempre; commit `G=/usr/bin/git; "$G" commit -m "…"`; nunca pager/editor; comando >30s sem output = ler terminal file / matar pid.

## §12 Definition of Done

- [ ] D01–D10 entregues (D11 junto de G3); ÂNCORAS intactas.
- [ ] Suíte verde (além das 2 baseline), `tsc --noEmit` limpo, `build` verde por gate.
- [ ] Deploys `2.7.4-rc`, `2.7.5-rc`, `2.7.6-rc` publicados (Pages auto via push) e `/version.json` conferido no final.
- [ ] DEC-474..477 APPROVED; dev-log + brain sincronizados.

## §13 Anti-padrões desta leva

Não converter moeda "só para mostrar um total"; não manter o grafo greedy "por compat"; não criar payload v2 (aditivos em v1); não tocar `suggestSimplifiedSettlements` (group-split); não mudar a math do cofrinho/verba; não re-uploadar fotos sem cache por attachment; não "consertar" o home — ele é a referência do G4.

## §14 Brain sync

dev-log por milestone; decision-log G0 (PROPOSED) e por gate (APPROVED); product-spec (moeda original nas dívidas; formas de pagamento por moeda; modelo done/remaining do planner) no G5; project-status no G5.

## §15 Smoke matrix (manual, pós-deploy)

| Jornada | Web | APK (OTA) |
|---|---|---|
| Registrar gasto BRL dividido → Resolver mostra R$ | ☐ | ☐ |
| Compartilhar link → guest vê foto + como pagar (moeda certa) + marca pago | ☐ | ☐ |
| Editar plano → voltar → Viagem/Home batem na hora | ☐ | ☐ |

## §16 Lock

Diretrizes já dadas pelo Julio no briefing (moeda original; Pessoas é a verdade; foto+pagamento+link; planner pelo conselho) — **lock dispensado**, doc ACTIVE. Recomendações dos conselhos alinham 1:1 com o pedido.

## §17 GO

G0: `cd TripPilot && npm run test` → `npx tsc --noEmit` → `npm run build`; registrar baseline; DECs PROPOSED; depois G1→G4 na ordem, fechando cada gate (suíte+tsc+build+bump+deploy+dev-log) antes do próximo. Não parar até o §12 estar todo TRUE.
