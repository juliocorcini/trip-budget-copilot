# Estudo Profundo — Modelo Mental de Orçamento (Fases × Fundos × Carteiras)

> Data: 2026-06-17
> Autor: Sessão de produto com Julio (Product Lead)
> Status: **ESTUDO / PROPOSTA** — nenhuma decisão implementada ainda; aguarda escolha de direção do Julio
> Gatilho: Julio (o próprio criador) tentou modelar a viagem real "Europa 2026" e **se sentiu confuso sobre onde colocar cada valor**. Conclusão dele: "se EU me confundo, um usuário novo se confunde — isso é um dos problemas mais importantes do app."

---

## 0. Por que este documento existe (a frase que não pode ser ignorada)

> "Eu li a sua explicação e eu ainda não sei direito aonde colocar cada coisa."
> — Julio, criador do produto, depois de uma explicação passo a passo correta.

Quando **o criador do produto**, que conhece o modelo de dados, não consegue mapear uma viagem real para o app sem hesitar, o problema **não é o usuário** — é o modelo conceitual. Este estudo trata isso como um problema de **arquitetura de informação e produto**, não como dúvida de uso.

A pergunta central deste documento:

> **O que é, conceitualmente, uma viagem no TripPilot — e quantos conceitos um usuário precisa entender para responder "onde meu dinheiro vai"?**

---

## 1. A viagem canônica (referência para todo o estudo)

A "Europa 2026" do Julio é o caso real que vamos usar como pedra de toque. Qualquer modelo proposto precisa modelá-la sem fricção.

| Bloco | Período | Dinheiro | Natureza |
|---|---|---|---|
| **Burgos** | 06/06 → 15/07 | **628 €** | Estadia (custo de vida) |
| **Eurotrip** | 15/07 → 04/08 | **678 €** | Viagem por várias cidades (custo de vida) |
| **Volta / Final** | 04/08 → 16/08 | **131 €** | Estadia final (custo de vida) |
| **Tomorrowland** | ~23/07 → 26/07 (dentro da Eurotrip) | **+200 €** | **Evento delimitado, dinheiro ADICIONAL e à parte**, gasto ao longo do tempo (já gastou 50 € em junho) |

Total de custo de vida = 628 + 678 + 131 = **1.437 €**. Mais **200 €** exclusivos do Tomorrowland.

Características que o modelo PRECISA capturar bem:
1. **Blocos cronológicos sequenciais com orçamentos diferentes** (628 / 678 / 131).
2. **Um evento que "corta" um bloco no meio** e tem **dinheiro próprio, adicional**, não incluso no bloco.
3. **Gasto antecipado**: comprar coisa do evento **antes** dele acontecer e **em outro bloco** (50 € em junho, durante Burgos, para um evento de julho).
4. Tudo precisa ser respondido com **perguntas fáceis e respostas fáceis** — sem o usuário "pensar muito".

Perguntas explícitas do Julio que este estudo precisa responder:
- "Eu deveria ter 3 fases ou 5 fases (cortando a Eurotrip antes/durante/depois do Tomorrowland)?"
- "O que é um fundo sem uma fase? Por que existe essa separação?"
- "Por que carteira me confunde tanto e complica a cabeça?"

---

## 2. Diagnóstico — por que está confuso (a raiz real)

Esta é a parte mais importante. A confusão **não é falta de explicação**; são **três problemas estruturais** acumulados.

### 2.1 PROBLEMA 1 — O modelo se contradiz entre eras (a causa raiz)

O conceito de "como o dinheiro se relaciona com as fases" **mudou de direção no meio do projeto e nunca foi reconciliado**. Hoje convivem dois modelos opostos:

**Era A — "Pote compartilhado + reservas" (modelo original)**
- `DEC-007`: *"A BudgetPool can serve multiple non-consecutive phases."* (um fundo atravessa várias fases)
- `DEC-008`: *"Phase = when. Pool = how much money. Envelope = what for. Conflating them causes bugs."* (três conceitos deliberadamente separados)
- `DEC-016` / `DEC-069`: **future floor** — você "tranca" dinheiro do fundo para fases futuras.
- Premissa: *"€760 must last for two separate Burgos stays."* Um pote só, reservas internas.

**Era B — "Um fundo por fase" (pivô posterior)**
- `DEC-089` (2026-06-10), textual: *"each phase now has its own fund, nothing from the current phase rolls to the next. ... Line is a leftover from the single-fund era and confuses the current per-phase model."*
- Ou seja: o projeto **declarou** migração para "1 fundo por fase" e chamou o modelo antigo de "era do fundo único" que "confunde".

**A contradição não resolvida:**
- `DEC-153` (Pacote 2, **depois** da DEC-089) **reafirma o modelo antigo**: *"a subtractive **shared-pool model** has no per-phase wallet"* e **rejeita** explicitamente *"a separate per-phase wallet (rejected: contradicts the shared-pool model)."*
- O **código segue o modelo antigo**: o onboarding cria **um único `BudgetPool`** ligado às fases (`createOnboardingEntities`), e o dashboard mostra o primeiro fundo, não o da fase ativa:

```234:245:TripPilot/src/features/dashboard/useDashboardModel.ts
    const linkedPools = pools.filter((p) => p.scope === 'linked_phases');
    const primaryPool = linkedPools[0];
    const fts =
      primaryPool && activePhase
        ? calculateFreeToSpend(
            primaryPool,
            envelopes.filter((e) => e.budgetPoolId === primaryPool.id),
            filterTransactionsByPool(transactions, primaryPool.id),
            links.filter((l) => l.budgetPoolId === primaryPool.id),
            activePhase.id,
            occurrences,
            plannedPurchases,
```

```63:63:TripPilot/src/features/trip/TripHubPage.tsx
  const primaryPool = pools.find((p) => p.scope === 'linked_phases');
```

**Consequência concreta:** se o usuário seguir a intuição da DEC-089 ("3 fases = 3 fundos"), o dashboard **continua mostrando o fundo #1** mesmo quando ele entra na Eurotrip ou na Volta — porque o código pega `linkedPools[0]`, não o fundo da **fase ativa**. O modelo "1 fundo por fase" foi **declarado mas nunca implementado de ponta a ponta**. O usuário cai exatamente no buraco entre as duas eras.

> **Veredito do diagnóstico:** o app está confuso porque **ele próprio não decidiu o que é**. Não há um modelo mental único e coerente para o dinheiro. Tudo o mais (telas, ajuda, onboarding) herda essa indefinição.

### 2.2 PROBLEMA 2 — Sobrecarga de conceitos ("o que é um fundo sem fase?")

Para responder "onde meu dinheiro vai", o usuário hoje pode esbarrar em **~10 conceitos**:

`Trip` · `Phase` · `BudgetPool (global | linked_phases)` · `BudgetPoolPhaseLink` · `futureFloorCents` · `Envelope (protected_reserve | allocation)` · `PlannedOccurrence (event | sub_destination, reservedCents)` · `ScenarioAllocationItem` · `Wallet` · `phaseProfileSettings`.

A pergunta do Julio — *"o que é um fundo sem uma fase?"* — é o sintoma perfeito. A separação Fase (quando) × Fundo (quanto) × Envelope (para quê) é **tecnicamente correta** (`DEC-008`) e ótima para o motor de cálculo. Mas é **invisível para a cabeça do usuário**, que pensa em uma coisa só: *"nesse pedaço da viagem eu tenho X para gastar."* Para ele, **fase e dinheiro são a mesma coisa**. O app força a desmembrar o que a mente une.

### 2.3 PROBLEMA 3 — "Carteira" (wallet) colide com "fundo" (a confusão de vocabulário)

No código, `Wallet` é **onde o dinheiro está fisicamente** (Wise, dinheiro vivo, cartão) — `walletType`, `initialBalanceCents`, `isDefault`. É ortogonal ao orçamento. Mas:
- "Carteira", "Fundo" e "Pote" **soam todos como 'lugar onde guardo dinheiro'**. O usuário não tem como saber que um é "onde está" e o outro é "para que serve".
- Existe até "Carteira não informada" (`DEC-051`), reforçando que é mais um campo a preencher.

Isso é **exatamente o problema que o YNAB resolve** com uma regra explícita (ver §3).

---

## 3. Pesquisa — como os melhores apps resolvem isso (fundamentado e citado)

> Protocolo de verificação: fontes oficiais, acessadas em 2026-06-17.

### 3.1 YNAB — separar "ONDE está" de "PARA QUE serve" (e NÃO casar os dois)
**VERIFIED** — [ynab.com/blog](https://www.ynab.com/blog/the-relationship-between-your-budget-your-accounts-its-complicated), [support.ynab.com](https://support.ynab.com/en_us/category-balances-versus-account-balances-an-overview-ryvnKB_Ac)

- **Contas** = onde o dinheiro está fisicamente (a geladeira/despensa). **Categorias** = para que ele serve (o plano de refeições). *"You don't know where the dollars are, but you do know exactly what you need them for. And that's all that really matters."*
- Regra de ouro deles: **evitar casar categoria com conta**, porque *"matching categories to accounts adds unnecessary friction... friction in your plan almost always has a negative effect."*
- Tradução para o TripPilot: **"Carteira" (onde) e "orçamento da fase/pote" (para quê) são coisas diferentes e o usuário NÃO deveria precisar pensar nas duas ao registrar um gasto.** A carteira deve ser opcional/avançada; o orçamento é o que importa.

### 3.2 TravelSpend — líder de mercado escolheu **simplicidade radical**
**VERIFIED** — [App Store](https://apps.apple.com/us/app/travelspend-travel-budget-app/id1434284824), [help.travel-spend.com](https://help.travel-spend.com/travel-budget/3shM3rgJUHqqd4VcV38Vqt/how-to-create-a-travel-budget/3shM3rgJUL1iiD2EW9fQ84)

- *"TravelSpend uses a **single overall budget for simplicity**."* Eles têm artigo dedicado defendendo essa escolha.
- **Não têm fases.** Têm: um orçamento total, **orçamento diário dinâmico** (resto ÷ dias restantes) e **categorias** para detalhar. 500k+ downloads com esse modelo.
- Lição: o mercado **premia simplicidade**. Multi-fase é um diferencial do TripPilot — mas só vale se for **mais simples de entender**, não mais complexo.

### 3.3 Monzo Pots / Starling Spaces — "um pote por finalidade" é intuitivo e amado
**VERIFIED** — [monzo.com/pots](https://monzo.com/pots), [monzo.com/blog](https://monzo.com/blog/save-money-wedding-monzo-pots)

- "Pote" = dinheiro separado por **finalidade**, com **nome**, **meta opcional** e **cadeado opcional**. *"Separate your money by purpose so it doesn't all sit in one pile."*
- As pessoas **naturalmente** criam um pote por finalidade (caso real: noiva criou **9 potes**, um por fornecedor do casamento, cada um com meta e prazo).
- Lição direta para o Tomorrowland: é **um pote** — dinheiro com nome, valor-alvo (200 €), que você enche/gasta ao longo do tempo. **Não é uma fase.** E valida a intuição do Julio ("cada coisa um pote") — desde que "pote" seja **finalidade**, não **tempo**.

### 3.4 Síntese da pesquisa
| Fonte | Princípio | Aplicação no TripPilot |
|---|---|---|
| YNAB | Onde está ≠ para que serve; não casar os dois | Demover "Carteira" para opcional/avançado |
| TravelSpend | Um orçamento, recálculo diário, simplicidade vende | Fase = um número simples por bloco |
| Monzo Pots | Um pote por finalidade, com meta e cadeado | Tomorrowland = um "pote de evento", não fase |

---

## 4. Conselho — Rodada 1: o modelo conceitual

**Pergunta:** *O que deve ser uma viagem no TripPilot? Devemos unificar Fase e Fundo num conceito só ("cada fase tem seu próprio orçamento")? O que fazer com "fundos sem fase" e com "carteiras"?*

**Perspectivas consultadas:** Arquiteto · Crítico (advogado do diabo) · Advogado do Usuário · Simplificador · Estrategista.

### 🏛️ Arquiteto
A separação Phase/Pool/Envelope (`DEC-008`) existe por bons motivos técnicos: um pote pode atravessar duas estadias Burgos não-consecutivas (`DEC-007`), o motor (`calculateFreeToSpend`) opera sobre pool+links+envelopes. **Destruir isso seria caro e arriscado.** PORÉM: a separação pode virar **detalhe de implementação**, não vocabulário de usuário. Proposta: manter as tabelas, mas na **UX padrão** apresentar **"a fase tem um orçamento"** (1 pool dedicado por fase criado automaticamente). O caso multi-fase-compartilhado (DEC-007) vira **modo avançado** ("este orçamento vale para mais de um trecho"). O número do dashboard PRECISA seguir a **fase ativa** (corrigir o `linkedPools[0]`). **Bottom line:** não mude o schema; mude o que o usuário vê — 1 fase ⇒ 1 orçamento por padrão, compartilhamento como exceção avançada.

### 🔴 Crítico (devil's advocate)
Cuidado com a "falsa simplicidade". Se cada fase vira um envelope fechado e o usuário gasta a mais numa fase, o app vai dizer "acabou" enquanto ele *sente* que ainda tem dinheiro da viagem toda no bolso — e aí ele desconfia do app (risco ALTO de quebra de confiança). O modelo "pote compartilhado + reservas" existia justamente para refletir "é tudo meu dinheiro". Migrar para silos pode **trocar uma confusão (onde coloco) por outra (por que o app diz que acabou se eu tenho dinheiro?)**. Também: **migração de dados** dos usuários atuais (Julio incluso) que já têm 1 pool — quem recria os N pools? Risco MÉDIO de corromper saldos. **Bottom line:** a simplicidade tem que vir com um "vazamento controlado" (poder remanejar entre fases com 1 toque) e um plano de migração, senão troca-se um problema por outro.

### 👤 Advogado do Usuário
O usuário pensa assim: *"de tal dia a tal dia eu tenho X."* Ponto. Ele **não tem o conceito** "fundo", "pool", "link", "envelope". A palavra "fundo" e a palavra "carteira" são ruído. O modelo vencedor é: **"trecho da viagem" com um valor**, e pronto. "Carteira" deve **sumir do fluxo de registro** por padrão (YNAB confirma: onde o dinheiro está não importa para decidir se posso gastar). A pergunta-teste: *"Quanto posso gastar hoje?"* → uma resposta, um número, sem o usuário escolher pote/carteira. **Bottom line:** 1 conceito visível ("trecho com orçamento") + tudo o mais escondido até ser pedido.

### ⚪ Simplificador
Reduza ao osso. Hoje são ~10 conceitos; o usuário precisa de **2**:
1. **Trechos** da viagem (cada um com um valor e datas) — responde "quando e quanto".
2. **Potes** (opcionais) para dinheiro com finalidade própria (Tomorrowland, compras) — responde "dinheiro à parte".
"Fundo", "BudgetPool", "Envelope", "Link", "future floor" → **vocabulário interno, nunca exposto**. "Carteira" → opcional, fora do caminho feliz. **Bottom line:** 2 substantivos para o usuário: **Trecho** e **Pote**. Todo o resto é encanamento.

### ♟️ Estrategista
O diferencial do TripPilot é "decisão em tempo real" + multi-fase. Mas a pesquisa mostra que **a simplicidade é o fosso real** (TravelSpend domina sendo simples). Se o app for "mais poderoso e mais confuso", perde. Se for "mais poderoso E tão simples quanto", ganha. A unificação Fase=Orçamento posiciona o TripPilot como *"o app de viagem que entende que sua viagem tem capítulos"* — sem cobrar imposto de complexidade. **Bottom line:** unificar é alinhado com o posicionamento; complexidade exposta é dívida estratégica.

### Consenso (todos concordam)
- **O schema não precisa ser destruído** — a separação técnica pode virar invisível.
- **O usuário deve enxergar no máximo 2 conceitos**: o "trecho/fase com orçamento" e o "pote" (opcional).
- **"Carteira" deve sair do caminho feliz** (opcional/avançado), confirmado pelo YNAB.
- **O dashboard deve seguir a fase ATIVA** (o `linkedPools[0]` é um bug conceitual herdado da era do fundo único).

### Divergência
- **Crítico vs. resto:** silos por fase podem quebrar a sensação de "é tudo meu dinheiro". Mitigação aceita por todos: **remanejar entre trechos com 1 toque** (herdando o mecanismo de "sobra de fase" da `DEC-153`) e deixar visível o **total da viagem** além do "livre hoje".

### Síntese da Rodada 1
Adotar **"1 fase = 1 orçamento"** como modelo mental padrão (alinha com a intenção da `DEC-089`, com a intuição do Julio e com Monzo). Manter as tabelas atuais, mas: (a) criar **1 pool dedicado por fase automaticamente**; (b) **renomear/ocultar** o vocabulário interno (o usuário vê "orçamento do trecho", não "fundo/pool"); (c) **carteira opcional** fora do registro padrão; (d) corrigir o dashboard para seguir a **fase ativa**; (e) oferecer **remanejar entre trechos** com 1 toque para preservar a sensação de "dinheiro único". Compartilhar um orçamento entre trechos não-consecutivos vira **modo avançado** (preserva `DEC-007`).

**Confiança: ALTA** — convergência forte + respaldo de mercado (YNAB/TravelSpend/Monzo) + alinhamento com decisão interna já tomada (DEC-089).

---

## 5. Conselho — Rodada 2: o evento que corta a fase (Tomorrowland)

**Pergunta:** *Tomorrowland deve virar uma fase (3 → 5 fases: Eurotrip-antes / Tomorrowland / Eurotrip-depois / ...)? Uma sub-fase? Ou um "pote de evento" com dinheiro próprio?* Modo: **debate** (Proponente vs Oponente vs Juiz) + Advogado do Usuário.

### ⚖️ Proponente — "Tomorrowland deveria ser uma fase"
Tem data de início e fim, tem orçamento próprio, é um período distinto. Virar fase reusa tudo que já existe (ritmo, eventos, contadores) e aparece no mapa da viagem. Cumpre o desejo do Julio de "ver o Tomorrowland separado".

### ⚔️ Oponente — "Tomorrowland NÃO é uma fase"
Três argumentos fortes:
1. **Quebra a continuidade.** Fatiar a Eurotrip em "antes/durante/depois" obriga o usuário a **recriar o mesmo contexto 2 vezes** (mesmas cidades, mesmos perfis, mesmo ritmo) — é fragmentação artificial. À pergunta "5 fases?" a resposta honesta é: sim, e fica pior. O próprio Julio sentiu isso: *"não vai começando a ficar confuso?"* Vai.
2. **A natureza do dinheiro é diferente.** Os 200 € são **adicionais e gastos ao longo do tempo, inclusive ANTES e FORA do evento** (50 € em junho, durante Burgos). Uma fase é um intervalo de tempo fechado — ela **não consegue** receber um gasto datado em junho sem distorcer Burgos. Um **pote** consegue: é dinheiro por finalidade, atemporal.
3. **Aninhamento.** Um evento dentro de uma fase com dinheiro próprio é, por definição, um **sub-orçamento** — exatamente o que Monzo chama de "pote". Forçar isso a ser "fase" mistura dois eixos (tempo × finalidade).

### 👤 Advogado do Usuário
"Pote do Tomorrowland" é instantaneamente compreensível: tem nome, tem 200 €, eu gasto quando quiser, vejo o saldo baixar. "Fase Tomorrowland dentro da fase Eurotrip" exige explicação — e exigir explicação é o pecado que estamos tentando matar. Além disso, com pote o gasto de junho **não suja** o número de Burgos.

### 👨‍⚖️ Juiz — veredito
O Proponente vence só no ponto "tem começo e fim". O Oponente vence nos três pontos que importam para **este** caso: continuidade, natureza atemporal/adicional do dinheiro, e clareza. **Veredito: Tomorrowland é um "pote de evento", não uma fase.** As datas do evento podem existir como **marcador no calendário** da fase (para o card "começar agora" no dia), mas o **dinheiro vive no pote**. Portanto a Europa 2026 tem **3 trechos + 1 pote de evento** — não 5 fases.

### Síntese da Rodada 2
- **Não fatiar a Eurotrip.** Mantém-se **3 trechos**.
- **Tomorrowland = pote de evento** (nome, 200 €, opcionalmente datas e meta), do qual se gasta a qualquer momento, de qualquer trecho, inclusive antes do evento.
- Conceitualmente, **um "pote" generaliza dois casos de uso atuais**: o fundo `global` (compras pessoais — `DEC-041`) e o "evento com dinheiro próprio". Ou seja, **já existe no app** (fundo global) — falta só **nome e enquadramento certos** ("Pote") e um caminho de criação óbvio.

**Confiança: ALTA** — o caso de gasto antecipado em junho **prova** que tempo (fase) e finalidade (pote) são eixos diferentes.

---

## 6. Conselho — Rodada 3: onboarding e entrada de dados (pergunta fácil → resposta fácil)

**Pergunta:** *Como um usuário novo (e o Julio) montam a Europa 2026 sem pensar?* Perspectivas: Simplificador · Advogado do Usuário · Conector (analogias) · Arquiteto.

### ⚪ Simplificador
O onboarding deve fazer **1 pergunta**: *"Quanto você tem e até quando?"* (já existe — `buildQuickOnboardingInput`). Trechos e potes são **adicionados depois, sob demanda**, nunca exigidos. Ninguém deveria ver a palavra "fundo" para começar.

### 👤 Advogado do Usuário
O fluxo natural para a Europa 2026 deveria ser:
1. "Nova viagem: Europa 2026, 06/06 a 16/08, € " → vejo o app funcionando.
2. "Dividir em trechos?" → adiciono Burgos (628), Eurotrip (678), Volta (131). Cada trecho pede só **nome + datas + valor**. Zero menção a pool/link.
3. "Tem algum dinheiro à parte, com finalidade própria?" → crio o **pote Tomorrowland (200 €)**.
4. Pronto. O número de hoje aparece sozinho conforme a data.
Cada passo é uma **pergunta de uma linha**. É isso que o Julio pediu: "pergunta fácil, resposta fácil".

### 🔗 Conector (analogias de outras áreas)
- **Calendário/Agenda:** uma viagem é como um calendário com **capítulos** (trechos). Ninguém estranha "capítulos" num calendário.
- **Monzo Pots:** "dinheiro à parte" = pote com nome e meta. Padrão mental já existente no público.
- **Netflix/temporadas:** a viagem é a série; os trechos são episódios; o pote é um "especial". A metáfora "capítulos + um especial" é mais natural que "fundos vinculados a fases via links".

### 🏛️ Arquiteto
Tecnicamente, cada "trecho criado" dispara: criar `Phase` + criar `BudgetPool(scope: linked_phases)` + `BudgetPoolPhaseLink` — **automaticamente, escondido**. Cada "pote criado" = `BudgetPool(scope: global)` (já funciona hoje). O registro de gasto **pré-seleciona o orçamento do trecho ativo**; potes aparecem como opção secundária (chip 🌐). Carteira **só** aparece se o usuário ativar "controlar carteiras" nas configurações. **Bottom line:** dá para entregar o modelo simples **sem migração traumática** — é orquestração na criação + cosmética de vocabulário + correção do dashboard para a fase ativa.

### Síntese da Rodada 3
Onboarding de 1 pergunta (mantido) → **assistente opcional de trechos** (nome+datas+valor cada) → **pergunta opcional de "dinheiro à parte" (potes)**. Vocabulário: **"Trecho"** e **"Pote"**. "Fundo/pool/link/envelope/carteira" somem do caminho feliz. Registro de gasto cai automaticamente no trecho ativo.

---

## 7. Recomendação consolidada — o modelo unificado

> Uma frase: **uma Viagem tem Trechos (quando + quanto) e, opcionalmente, Potes (dinheiro à parte por finalidade). É só isso que o usuário vê.**

### 7.1 Os 2 conceitos visíveis

| Conceito do usuário | O que é | Mapeia para (interno, escondido) |
|---|---|---|
| **Trecho** | Um pedaço da viagem com **datas + um orçamento** | `Phase` + `BudgetPool(linked_phases)` dedicado + `BudgetPoolPhaseLink` (1:1 por padrão) |
| **Pote** | Dinheiro **à parte**, com nome e valor-alvo, gasto a qualquer momento | `BudgetPool(scope: global)` (já existe — `DEC-041`) |

Conceitos que **deixam de ser expostos** (viram encanamento): "Fundo/BudgetPool", "Link", "Envelope", "future floor", "ScenarioAllocationItem". **"Carteira"** vira **opcional** e fora do registro padrão (alinhado ao YNAB).

### 7.2 Regras do modelo
1. **Padrão: 1 trecho = 1 orçamento dedicado.** O dashboard mostra **o orçamento do trecho ATIVO** (corrige o `linkedPools[0]`).
2. **Sensação de "dinheiro único" preservada:** mostra-se também o **total da viagem**, e há **"remanejar entre trechos" com 1 toque** (reusa a mecânica de sobra de fase — `DEC-153`).
3. **Pote = finalidade, atemporal.** Recebe gasto de qualquer trecho e em qualquer data (resolve o gasto de 50 € em junho sem sujar Burgos).
4. **Avançado (escondido):** "este orçamento vale para mais de um trecho" reativa o caso `DEC-007` (duas estadias Burgos compartilhando um pote) sem poluir o caminho feliz.
5. **Carteira é opcional**, ativável em Configurações ("controlar onde o dinheiro está").

### 7.3 Como a Europa 2026 fica no modelo novo
- **Trecho Burgos** (06/06–15/07): **628 €**.
- **Trecho Eurotrip** (16/07–04/08): **678 €**.
- **Trecho Volta** (05/08–16/08): **131 €**.
- **Pote Tomorrowland**: **200 €** (datas 23–26/07 opcionais como marcador). Gasto de 50 € em junho cai no pote; trecho Burgos intacto.
- Dashboard: ao abrir, mostra o número do **trecho ativo** automaticamente; card do **pote Tomorrowland** à parte. **Zero** uso das palavras "fundo", "link", "reserva", "carteira".

Compare com o modelo de hoje, que para a mesma viagem exigiria: 1 fundo de 1.437 € + 3 links + 2 future floors (678 e 131) ajustados manualmente na virada de fase + 1 fundo global + entender por que o dashboard mostra o fundo errado. **Essa é a distância entre o que existe e o que deveria existir.**

---

## 8. Opções de direção (decisão do Julio — mudança de alto impacto)

> Pela regra de engenharia §6.2 (mudanças de alto impacto exigem confirmação), **nada será implementado** sem o Julio escolher. As opções abaixo são incrementais — pode-se parar em qualquer nível.

### Opção A — "Cosmética + dashboard certo" (menor esforço, alto ganho)
- Corrigir o dashboard/TripHub para seguir a **fase ativa** (não `linkedPools[0]`).
- Renomear no UI: "Fundo" → "Orçamento do trecho"; introduzir o nome **"Pote"** para fundos globais.
- Esconder "Carteira" do registro padrão (toggle em Configurações).
- **Não** mexe no schema. **Não** mexe em migração.
- Resolve ~70% da confusão. Risco: BAIXO.

### Opção B — "Modelo unificado" (recomendada)
- Tudo da Opção A **+** assistente de **Trechos** (cria Phase+Pool+Link automaticamente, 1:1) **+** fluxo de **Potes** explícito **+** "remanejar entre trechos" com 1 toque **+** total-da-viagem visível.
- Compartilhar orçamento entre trechos vira **modo avançado**.
- Migração suave: usuários atuais com 1 pool continuam funcionando (1 pool ligado a N fases = "modo avançado" por padrão); oferecer "dividir por trecho" opcional.
- Risco: MÉDIO (orquestração + migração + textos), sem destruir schema.

### Opção C — "Refundação do schema" (não recomendada agora)
- Fundir Phase e Pool numa entidade só no banco.
- Alto custo, alto risco de regressão, ganho marginal sobre B (que já entrega a simplicidade percebida). **Evitar.**

---

## 9. Esboço de implementação (se a Opção B for escolhida — alto nível, não comprometido)

1. **Correção do "fundo ativo"** (`useDashboardModel.ts`, `TripHubPage.tsx`): selecionar o pool da **fase ativa** em vez de `linkedPools[0]`. Testes de não-regressão para o caso "1 pool / N fases" (modelo atual) e "1 pool por fase" (modelo novo).
2. **Orquestrador `createPhaseWithBudget`**: criar Phase + Pool dedicado + Link numa transação atômica (reusa padrões de `onboarding-orchestrators`).
3. **Vocabulário** (`pt-BR.json`/`en`/`es`): "Trecho", "Pote", "Orçamento do trecho"; remover "Fundo/Carteira" do caminho feliz.
4. **Fluxo de Potes**: atalho explícito "Adicionar dinheiro à parte" → cria `BudgetPool(global)` com nome + valor (+ datas/meta opcionais).
5. **Remanejar entre trechos**: generalizar `applyPhaseLeftover`/`computePoolTransfer` (`DEC-153`) para transferência manual trecho→trecho a 1 toque, preservando o total.
6. **Carteira opcional**: toggle em Configurações ("controlar onde o dinheiro está"); por padrão, registro não pede carteira.
7. **Migração**: detectar trips com 1 pool/N fases; manter funcionando como "avançado"; oferecer um assistente "dividir orçamento por trecho".
8. **Decisão de brain**: registrar como nova decisão (DEC-2xx) que **reconcilia DEC-007/DEC-089/DEC-153** e define o modelo "Trecho + Pote" como canônico — encerrando a contradição de eras.

---

## 10. Perguntas em aberto para o Julio (decisões de produto)

1. **Silos vs. dinheiro único:** quando um trecho "estoura", o app deve (a) avisar mas deixar gastar do total da viagem, (b) bloquear visualmente, ou (c) sugerir remanejar de outro trecho? (Hoje a regra é "nunca bloquear" — `DEC-053`.)
   → **DECIDIDO (2026-06-17): (c) sugerir remanejar de outro trecho com 1 toque.**
2. **Pote com data:** o "pote de evento" deve poder ter datas (para o card "começar agora") **e** continuar atemporal para gastos? (Recomendação: sim — datas são só um marcador.) → ver estudo Parte II (visibilidade de potes).
3. **Meta no pote:** mostrar barra de progresso "150/200 € usados" estilo Monzo? (Recomendação: sim.)
4. **Carteira:** concorda em torná-la **opcional/avançada** por padrão? (Recomendação: sim, respaldado pelo YNAB.) → **MATIZADO (2026-06-17):** sim, opcional por padrão, MAS é load-bearing para escolha de origem do gasto + import Wise. Ver estudo Parte II (Carteira).
5. **Nomenclatura:** "Trecho" e "Pote" servem, ou prefere "Etapa"/"Fase" e "Reserva"/"Extra"? → **DECIDIDO (2026-06-17): "Trecho" + "Pote".**

> **Continuação:** as questões levantadas na sessão de 2026-06-17 (visibilidade de potes na Home, carteira × import Wise, fases sobrepostas, contingências de orçamento trip×trechos, preservação de especificidades sem regressão, e exposição "por baixo dos panos" em Configurações) são tratadas em profundidade no documento irmão: **`budget-mental-model-study-part2-2026-06-17.md`**.

---

## 11. Resumo executivo (1 parágrafo)

O app **consegue** modelar a Europa 2026 hoje, mas exige que o usuário entenda ~10 conceitos e navegue uma **contradição não resolvida** entre "pote compartilhado + reservas" (DEC-007/153, que o código segue) e "1 fundo por fase" (DEC-089, declarado mas não implementado — o dashboard ainda lê o fundo errado). Isso é a causa real da confusão do próprio criador. A pesquisa (YNAB, TravelSpend, Monzo) e três rodadas de conselho convergem para um modelo de **2 conceitos visíveis — Trecho (quando+quanto) e Pote (dinheiro à parte por finalidade)** — com todo o resto virando encanamento escondido, "Carteira" opcional, e o dashboard seguindo a **fase ativa**. Tomorrowland é um **Pote de evento, não uma 4ª/5ª fase** (o gasto de 50 € em junho prova que tempo e finalidade são eixos distintos). Recomenda-se a **Opção B**, sem refundar o schema, com plano de migração suave — e registrar uma decisão que **reconcilie as eras** e encerre a ambiguidade.
