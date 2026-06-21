# Projeto "Coerência do App" — achados, decisões e implementação

**Data:** 2026-06-20 · **Origem:** Julio (segunda leva de achados de integrações incompletas + bugs de campo) ·
**Predecessor:** `integration-overlaps-audit-and-plan-2026-06-20.md` (B1/B2/C1–C3, A1 já entregue no 0.99.20).
**Status:** PLANO VIVO + execução em ondas. Cada item cita arquivo/linha que comprova o achado.
**Regra de ouro desta leva:** _enviar tudo testado, em ondas, sem regressão; testes entre cada onda; commit/version/deploy frequente._

---

## 0. Como li o código (sem achismo)

- Captura: `features/split/SplitPage.tsx`, `features/receipt/ReceiptScanPage.tsx`, `features/outing/OutingPage.tsx`, `domain/receipt/parse.ts`, `worker/src/index.ts` (OCR prompt L122-128).
- Divisão/mesa: `domain/split/{split,types,commit,claim-response}.ts`, `features/split/{SplitTablePage,useSplitLiveLink,live-link}.tsx`.
- Voz/IA: `utils/ai-transcribe.ts`, `worker/src/index.ts` (assistant prompt L149-195), `features/assistant/*`.
- Histórico: `features/expenses/ExpenseListPage.tsx` (+ `expense-feed.ts`), `domain/split/commit.ts`.
- Potes/fases: `domain/budget/pots.ts`, `features/trip/TripHubPage.tsx`, `features/dashboard/useDashboardModel.ts`.

**Infra de deploy (importante p/ priorização):** o front (Pages) faz auto-build no push p/ `master`. O **worker** (`trippilot-sync`, OCR/assistant/transcribe) **NÃO** está no CI — precisa de `wrangler deploy` manual. Logo, correções de **prompt** (OCR/assistant) ficam _code-ready_ mas só sobem ao vivo com deploy do worker.

---

## 1. Inventário de achados (todos os itens + os que encontrei)

Legenda status: 🔧 fix claro · 🧭 precisa decisão/conselho · 🧱 estrutural · ✅ feito.

### G — Bugs de campo (correção direta)

**F1 🔧 Não dá pra desselecionar item na divisão (a não ser que outra pessoa selecione depois).**
Causa-raiz (ALTA confiança): `SplitPage.toggleClaimFor` monta `nextIds` e chama `splitItemBetween(s, itemId, nextIds)`; quando você é o **único** dono e desmarca, `nextIds = []` e `splitItemBetween` faz **no-op** em lista vazia (`split.ts` L365-366 `if (participantIds.length === 0) return session;`). Por isso só "solta" quando sobra outro dono. Afeta também o `PassThePhoneSheet` (usa o mesmo `toggleClaimFor`).
Fix: quando `nextIds` ficar vazio, chamar `releaseClaim(s, itemId, participantId)` em vez do `splitItemBetween`. + teste unit do toggle (claim→release no caso "único dono").
Risco: BAIXO. Front. **Onda 1.**

**F2 🔧 Gasto vindo de "Dividir conta" esconde a melhor visão no histórico.**
Sintoma: no filtro **Todos** aparece como "evento único" → ao abrir, mostra total + itens como "grupo restaurante" (foto da nota), sem detalhar; só no filtro "gastos sem carteira informada" abre o gasto específico com divisão completa (quem pegou o quê, quanto cada um). A boa visão devia ser sempre.
Causa (a confirmar no detalhe): o feed agrupa por `Session` (`expense-feed.ts` `buildSessionFeed`; `ExpenseListPage` L69-71 "collapse a receipt/outing's N transactions into ONE row") e o card do grupo abre a visão de sessão/itens em vez da visão do **SplitRecord** (`splitMeta`, a divisão). O commit guarda a divisão no SplitRecord (`commit.ts` doc L13-18). Fix: quando a sessão tem `splitRecord`, o card/checkout deve levar à visão de divisão (ou fundir as duas), e não depender do filtro de carteira. **Onda 3** (investigar `ExpenseDetailPage` + feed).
Risco: MÉDIO. Front.

**F3 🧭/🔧 Potes aparecendo em fase que não é a deles (Viagem).**
Achado: na **Home** a regra D8 já esconde (pure `selectVisiblePots`, `pots.ts`; testado em `visible-pots.test.ts` com Tomorrowland 23/07 oculto em Burgos). Na **aba Viagem** a seção "Potes e planejados" lista **todos** de propósito (DEC-220/D9). O incômodo do Julio é ver, perto de um trecho que termina 15/07, um pote de 23/07 (de outro trecho). → **Decisão de produto** (mexe em DEC-220/D9): agrupar potes/eventos sob o trecho dono e/ou recolher os "de outro trecho" atrás de um "ver todos". Conselho em §2.4. **Onda 2** (após decisão).
Risco: BAIXO-MÉDIO. Front.

**F4 🔧 OCR confunde nome da atendente (e afins) com item.**
Causa: o `OCR_PROMPT` (`worker/src/index.ts` L122-128) lista o que NÃO é item (subtotal/tax/tip/service/discount/change/payment) mas **não** cobre nomes de garçom/atendente/caixa, nº de mesa/comanda, data/hora, endereço, telefone, "obrigado". Fix: endurecer o prompt com uma regra explícita de "texto não-produto" + heurística de defesa no `parse.ts` (descartar linha sem preço positivo já existe; manter). **Onda 4 (worker — code-ready).**
Risco: BAIXO (prompt). Precisa deploy do worker.

**F5 🔧/🧭 Item com quantidade > 1 na nota (2 pedidos) precisa virar 2 unidades.**
Estado: o domínio JÁ suporta (`SplitItem.qty/unitAmountCents`, `SplitClaim.units`, `claimWeight` usa `units/qty`). Gaps: (a) o OCR às vezes não preserva `qty` (prompt) → endurecer; (b) a **mesa ao vivo** (`SplitTablePage`) só deixa o convidado pegar a linha **inteira** (`fraction:1`, L167/L185) — não dá pra "peguei 1 de 2", e 2 convidados na mesma linha qty=2 geram **conflito** (peso 2>1) mesmo quando matematicamente daria 1 unidade cada. Fix faseado: prompt (worker) + expor `qty`/unidades no editor de item (front) + (maior) claim por unidade no convidado. **Onda 4 (prompt) + Onda 6 (UI de unidades).**
Risco: MÉDIO. Worker + front.

### V — Voz/IA

**F6 🔧 Voz/IA: ao abrir a tela completa pra detalhar (quem divide etc.), ela não vem pré-preenchida com o que o áudio extraiu.**
Causa: o assistente resolve o intent e oferece "detalhar", mas a navegação pra `QuickAddPage`/`SplitPage` não passa o estado já extraído (amount/desc/category/place/participants). Fix: passar o `AiIntent`/preview resolvido via state de navegação e hidratar a tela de destino. **Onda 5.** (Investigar `AssistantSheet`/`useAssistant` + `QuickAddPage` initial state.)
Risco: MÉDIO. Front.

**F7 🧱 Modo IA por voz DENTRO da Saída (adicionar rodada falando).**
Hoje a Saída (`OutingPage`) captura rodada a rodada por toque; não tem entrada por voz/IA. Fix: reusar o assistente (texto/voz) como atalho de "adicionar rodada" dentro da Saída. **Onda 7.**
Risco: MÉDIO. Front.

**F8 🧱 Ler nota DENTRO da Saída.**
A Saída não tem captura por foto/OCR; pra somar uma nota à saída hoje sai-se do fluxo. Fix: botão "ler nota" na Saída que reusa o motor de OCR e adiciona como rodada/itens da saída. Conecta com **B1** (motor único de captura). **Onda 7/B1.**
Risco: MÉDIO. Front.

### M — Mesa ao vivo / conexões

**F9 🧱 Mesa ao vivo trata quem já tem o app como estranho.**
Sintoma: ao abrir `/t/:id`, o convidado **sempre** digita nome (`SplitTablePage` L249-281, `getGuestName`), mesmo já sendo usuário do app; e ao fim **não** pergunta se ele quer **criar o gasto no próprio app** com os itens que pegou (quanto deu, impacto no orçamento dele). Fix (2 partes): (a) se o device é um usuário do app (tem perfil/owner/actorId conhecido), pré-preencher nome e marcar como `linked`; (b) no fim, oferecer "registrar no meu app" — virar um gasto do convidado a partir da fatia dele (reusa `commitSplit`/bridge no device do convidado). Conecta com **B2** (amigos persistentes). Conselho §2.3. **Onda 8/B2.**
Risco: MÉDIO-ALTO. Front (+ modelo de identidade).

### Estruturais herdados (do doc anterior, mantidos)
- **B1 🧱 Captura unificada** (Escanear nota ⟷ Dividir conta): 1 motor de OCR; após o scan, toggle "Só meu ↔ Dividir" (pré-marcado pela porta); `/receipt/scan` desemboca no componente do split com `mode=solo`. **Não reescrever o split.** (Conselho no doc anterior §2.1.)
- **B2 🧱 Camada "Amigos/Conexões" persistente** (resolve F9 de forma definitiva). (Conselho no doc anterior §2.2.)
- **C2 🧭 Saída vs Mesa ao vivo** — ponto de entrada "sozinho ou em grupo?". Conselho §2.5 (o Julio pediu pensar bem).
- **C3 🔧 Simulador → "salvar como planejado".**
- **A2 🔧 Dedup "Registrar mercado"** · **A3 🔧 Unificar linguagem de dívida** (4 superfícies).

---

## 2. Conselhos (inline, 1 request, sem subagentes)

### 2.1 Saída vs Mesa ao vivo (C2) — o Julio pediu pensar bem

**Decision Brief (neutro):** Saída (`/outings`) = captura **solo ao vivo** durante a noite (rodada a rodada). Mesa ao vivo (`/t/:id`) = dividir **ao fim** da noite entre pessoas. São momentos diferentes ("durante" vs "no fim"), mas ambos são "estou num rolê agora". O usuário se confunde. Pergunta: unificar a porta de entrada ("rolê novo → sozinho ou em grupo?") ou manter dois? Viés a resistir: "unificar é mais limpo".

**Advocate (usuário):** os dois resolvem dores distintas no tempo: Saída é registrar enquanto bebe; Mesa é rachar quando a conta chega. Forçar a escolher "sozinho/grupo" no início é cedo — muitas vezes começa solo e VIRA grupo. Rec: **uma porta "Rolê/Saída" que começa solo e tem um botão "dividir agora" que promove pra mesa** quando a conta chega. Confiança: MÉDIA-ALTA. Outros não veem: a transição solo→grupo é o caso real do bar.

**Architect:** Saída e Split são engines distintas (Session de rodadas vs SplitSession). Fundir as engines é caro e arriscado. Mas dá pra unir a **entrada** e fazer a Saída poder "exportar" suas rodadas como itens de um Split. Rec: manter 2 engines, 1 porta, ponte Saída→Split. Confiança: MÉDIA. Outros não veem: custo de fundir engines vivas.

**Critic:** "sozinho ou em grupo?" logo na entrada adiciona fricção no momento mais quente (o bar). E uma ponte Saída→Split mal feita duplica gastos (a rodada já lançada + o split). Rec: NÃO perguntar no início; oferecer "dividir" só quando o usuário pedir, e ao promover, **mover** (não duplicar) as rodadas. Confiança: ALTA. Outros não veem: risco de gasto duplicado na ponte.

**Red Team:** se a ponte Saída→Split mover rodadas já comprometidas em orçamento e algo falhar no meio, o usuário perde lançamentos. Qualquer unificação precisa ser atômica e reversível (padrão `commitSplit`/`undoSplitCommit`).

**Síntese (Chair):** **Consenso:** manter 2 engines; **unir a porta** e permitir transição **solo→grupo** sob demanda (não perguntar no início). **Recomendação (pesa Critic+Advocate):** (1) Saída ganha um "dividir esta saída" que cria um Split a partir das rodadas, atômico e reversível, sem duplicar; (2) o "sozinho/grupo" não é pergunta de entrada, é uma ação disponível. **Confiança:** MÉDIA-ALTA. **Flip:** se telemetria mostrar que quase todo rolê já começa em grupo, aí sim vale perguntar no início.

### 2.2 Item qty>1 — claim por unidade vs fração (F5)

**Decision Brief:** Linha qty=2 (2 pedidos do mesmo item). Queremos 2 pessoas pegando 1 unidade cada, cada uma pagando 1 unidade (não "metade da linha por acaso"). Domínio já tem `units`. A mesa do convidado hoje só faz linha-inteira. Pergunta: como deixar claro e correto pegar "1 de N"?

**Simplifier:** o caso 99% é "cada um pega 1". Rec: na mesa, para linha qty>1, mostrar **steppers de unidade por pessoa** (peguei 1, 2…) em vez de só inteiro; o `units` já calcula certo. Confiança: ALTA.

**Critic:** steppers em todo item poluem a tela rápida do bar. Rec: manter toque simples = pega 1 unidade; toque longo/edição abre o stepper; conflito só quando unidades somadas > qty. Confiança: MÉDIA-ALTA.

**Síntese:** para linhas qty>1, toque = +1 unidade (até qty), com chip "x de N"; usa `claim.units`. Para qty=1, comportamento atual (inteiro/fração). **Confiança:** ALTA. **Onda 6** (depende de prompt OCR confiável — Onda 4).

### 2.3 Mesa reconhece usuário do app + "registrar no meu app" (F9)

**Decision Brief:** Convidado em `/t/:id` que JÁ usa o app é tratado como anônimo (pede nome, não vira `linked`, não fecha como gasto dele). Sem servidor de contas. Pergunta: como reconhecer e fechar como gasto do convidado, local-first?

**Architect:** o device do convidado tem identidade (owner/actorId). Dá pra: (a) pré-preencher nome do perfil local; (b) ao "registrar no meu app", rodar um `commitSplit` LOCAL no device dele a partir da fatia que ele pegou (mesma bridge de orçamento). Sem precisar de servidor. Rec: SIM, camada fina. Confiança: MÉDIA-ALTA. Outros não veem: o cálculo da fatia dele já existe (`computeSplitTotals` → o total dele).

**Advocate:** é exatamente o "Splitwise sabe quem é você". Rec: priorizar "este sou eu" + "lançar no meu app (deu X, ficou Y no orçamento)". Confiança: ALTA.

**Critic:** o convidado pode não ter viagem/trip ativa → "lançar no meu app" precisa cair no onboarding leve (já existe T9, `SplitTablePage` L340-351). E reabrir o link não pode duplicar o lançamento dele. Rec: idempotência por `shareId`+actor. Confiança: MÉDIA.

**Síntese:** (1) pré-preencher identidade local na mesa; (2) ao fim, CTA "registrar no meu app" que cria o gasto do convidado a partir da fatia dele (idempotente), caindo no onboarding leve se não houver trip. **Conecta com B2.** **Confiança:** MÉDIA-ALTA. **Onda 8.**

### 2.4 Potes na aba Viagem (F3) — mexe em DEC-220/D9

**Decision Brief:** Home já esconde pote fora de fase (D8). Aba Viagem lista todos (D9). Julio acha confuso ver pote de 23/07 perto de um trecho que acaba 15/07. Mudar D9? Viés: "não esconder dinheiro".

**Advocate:** o usuário quer contexto, não sumiço: ver o pote, mas saber que é de outro trecho. Rec: **agrupar por trecho dono** (cabeçalho do trecho → seus potes/eventos) e os sem-data/ambientes numa seção "sempre". Confiança: ALTA.

**Critic:** esconder/recolher demais quebra a promessa "a aba lista tudo" (D9) e pode esconder um pote que o usuário quer achar. Rec: agrupar, não esconder; "de outro trecho" fica recolhido com "ver todos". Confiança: MÉDIA-ALTA.

**Síntese:** manter D9 (tudo acessível) mas **agrupar visualmente por trecho dono**, com os de outro trecho recolhidos. Não esconder. **Decisão nova a registrar (refina DEC-220/D9).** **Onda 2.** **Confiança:** MÉDIA-ALTA.

### 2.5 B1/B2 — ver doc anterior (§2.1, §2.2). Mantidas as sínteses: 2 portas/1 motor (B1) e camada fina de Amigos persistindo a identidade do pareamento (B2).

---

## 3. Plano de execução em ondas (com guardas de regressão)

Cada onda: implementar → `npm run typecheck` + `npm run test` (e E2E quando tocar fluxo coberto) → `npm run build` → bump de versão → commit → push (deploy Pages) → verificar `/version.json` + bundle ao vivo. Só passa pra próxima onda com verde e sem regressão.

| Onda | Itens | Camada | Deploy | Risco |
|---|---|---|---|---|
| 1 | **F1** deselect | front | Pages ✅ | BAIXO |
| 2 | **F3** potes agrupados por trecho | front | Pages ✅ | BAIXO-MÉDIO |
| 3 | **F2** histórico do split sempre detalhado | front | Pages ✅ | MÉDIO |
| 4 | **F4** OCR não-produto + **F5a** qty (prompt) | worker | wrangler ⚠️ | BAIXO |
| 5 | **F6** pré-preencher tela completa a partir da voz | front | Pages ✅ | MÉDIO |
| 6 | **F5b** claim por unidade na mesa | front | Pages ✅ | MÉDIO |
| 7 | **F7/F8** voz + ler nota dentro da Saída (ponte C2) | front | Pages ✅ | MÉDIO |
| 8 | **F9/B2** mesa reconhece usuário + registrar no app dele | front | Pages ✅ | MÉDIO-ALTO |
| 9 | **C3** simulador→planejado · **A2/A3** dedup/linguagem | front | Pages ✅ | BAIXO |
| — | **B1** captura unificada · **B2** completo · **C2** ponte completa | front | Pages | MÉDIO (épico próprio) |

> Worker (Onda 4) fica _code-ready_; sobe ao vivo quando o worker for deployado (`wrangler deploy` em `TripPilot/worker/`).

---

## 4. Decisões novas a registrar no decision-log (após implementação)
- **DEC-novo (F3):** aba Viagem agrupa potes/eventos por trecho dono (refina DEC-220/D9; D9 mantém "tudo acessível").
- **DEC-novo (F2):** gasto originado de split sempre abre a visão de divisão completa, independente de filtro.
- **DEC-novo (C2/F7/F8):** Saída pode "ler nota" e "adicionar por voz"; transição solo→grupo via ponte atômica Saída→Split.
- **DEC-novo (F9/B2):** mesa ao vivo reconhece usuário do app e oferece registrar a fatia como gasto no app do convidado (idempotente, local-first).
