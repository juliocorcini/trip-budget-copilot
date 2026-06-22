# Comparador de Custo-Benefício (preço por unidade) — Conselho + Estudo (2026-06-22)

> Data: 2026-06-22 · Autor: assistente (a pedido do Julio) · Status: **ESTUDO + RECOMENDAÇÃO DO CONSELHO — pendente de ratificação do Julio sobre escopo.**
> Truth policy: nada aqui é decisão até virar `DEC-*` no `decision-log.md`. Este documento é um estudo; a DEC proposta (§5) ainda **não** foi registrada.
> Cost contract: o conselho abaixo rodou **inline, nesta sessão (1 request, sem subagentes)** — conforme `inline-council-no-subagents.mdc`.
> Pedido do Julio (resumo): adicionar um **comparador de custo-benefício por peso/unidade** — no mercado, dado o mesmo produto (ou produtos diferentes) em tamanhos/preços diferentes (ex.: chocolate 20g vs 100g; 120g por €1 vs 200g por €2), dizer qual rende mais por unidade (g/kg, ml/L, unidade, e talvez %). Entradas por **texto, voz e foto da etiqueta**. Levar ao conselho para decidir **se faz sentido** para o app/usuário e **onde** moraria; se fizer sentido, fazer; se não, não fazer.

---

## 0. Veredito em uma linha

**SIM — mas só a versão enxuta e determinística (V1), espelhando a calculadora de câmbio (DEC-256/FB-04): conta pura + intent de IA por texto/voz, 0 token, offline, escopo estrito a preço-por-unidade-de-medida.** A **foto da etiqueta** (V2) fica condicionada ao gate de orçamento de token (FB-18/FB-26) e **não** entra agora. **Não** prometer "qualidade/%/preço no Brasil" (isso é o C12, já vetado).

---

## 1. Fatos verificados (pesquisa desta sessão, 2026-06-22)

- **União Europeia — preço por unidade é OBRIGATÓRIO na etiqueta. VERIFICADO** (EUR-Lex, Diretiva **98/6/EC**, consolidada 2022-05-28). A diretiva exige que o comerciante indique o **preço de venda** *e* o **preço por unidade de medida** (por kg, L, m, m², m³ ou unidade usual do país), "de forma inequívoca, fácil de identificar e claramente legível", **inclusive em anúncios** — exatamente "para facilitar a comparação de preços". Exceções: quando o preço unitário é idêntico ao de venda; venda a granel mostra só o unitário; Estados-membros podem dispensar quando "não for útil ou puder causar confusão". **Implicação:** para um viajante **na Europa**, o caso-âncora do Julio (mesmo produto, tamanhos diferentes) **já está parcialmente resolvido na prateleira** — o €/kg está impresso. O ganho marginal do app é maior **fora da UE** (cobertura varia; **NÃO VERIFICADO** para o Brasil) e nos casos que a etiqueta **não** facilita (marcas diferentes lado a lado, "leve 3 pague 2", promo vs normal, unidades trocadas de propósito).
- **Categoria de apps dedicados existe e é saturada. VERIFICADO** (busca 2026): Aisle Audit, PriceDuel, GroceryChop, worthulator, usfinancecalculators e outros. Padrão comum: comparam **N itens** (até 3–5), **convertem unidades** automaticamente, funcionam **offline**, mostram **"best value" + % de economia** e veredito ("best value / empate técnico"); alguns com desconto/imposto/yield. A matemática é sempre `preço ÷ quantidade normalizada`. **Implicação:** isto **não é diferencial competitivo defensável** por si só — quem quer muito baixa um app dedicado grátis. Para o TripPilot, é **adjacência/gancho**, não pilar.
- **Pitch da categoria (confirmado nos próprios apps):** embalagens são desenhadas para confundir; a maioria não faz a conta de cabeça; mesmo com €/kg impresso, comparar "5×20g vs 1×100g" ou marcas diferentes ainda dá trabalho. O problema é **real e universal** — a questão é o custo de oportunidade de resolvê-lo dentro do TripPilot.

### Baseline interno relevante (o que já existe / está decidido)
- **Precedente direto — Calculadora de câmbio (DEC-256 / FB-04, aprovada, Gate 6 pendente):** decidiu **tela dedicada `/converter` + intent de IA "quanto é X em Y?"** que **não cria gasto** (a IA só extrai `{amount, from, to}` e **o app faz a conta localmente** com taxas em cache — barato, offline, sem queimar token). O comparador é o **gêmeo** desse padrão.
- **Modo "Dia a dia" (DEC-250, ratificado):** `Trip.kind='ongoing'` com gate de capacidades; "ir ao mercado no dia a dia" é o caso de uso onde o comparador mais brilha. Reforça o reposicionamento "TripPilot não é só viagem".
- **Infra de IA reutilizável (VERIFICADO no baseline do field-feedback):** `features/assistant/AssistantSheet.tsx` + `domain/assistant/*` (intents texto/voz); **CC-IMG** (DEC-275, chooser tirar-foto/galeria extraído do `AttachmentSection.tsx`); **Groq vision** no worker `/ocr` (tem visão; não navega na web); governança/cooldown de token (FB-18/FB-26).
- **FAB** (`components/FAB.tsx`, grupo de captura) e **Guia** (`domain/guide/guide-catalog.ts`) são os pontos de acesso de 1ª classe (mesmo padrão do câmbio).
- **Regra dura herdada do C12 (vetado):** **nada de "preço no Brasil"/preço de mercado externo** — Groq não navega na web; preço alucinado violaria `fact-verification.mdc`. O comparador trabalha **só com os números que o usuário fornece** (digitados, falados ou lidos da própria etiqueta) — a fonte é o input do usuário, não a memória do LLM.

---

## 2. Conselho inline (`/council`)

> Protocolo: Decision Brief neutro → perspectivas escritas às cegas (cada uma reancorada no brief, sem citar as outras) → red team → síntese do Chair.

### Decision Brief (neutro)
Avaliar se o TripPilot deve ganhar um **comparador de custo-benefício**: dados ≥2 produtos com **preço + quantidade** (g, kg, ml, L, unidade), dizer qual tem o melhor preço **por unidade normalizada**. Entradas: texto, voz, foto da etiqueta. Decidir: **(1)** faz sentido para o produto? **(2)** o usuário usaria? **(3)** onde moraria? — com mínima regressão.

Fatos: a **matemática é trivial, pura, determinística, offline, 0 token**. Há **precedente aprovado** (câmbio DEC-256: tela + intent de IA, conta local). O app tem **modo Dia a dia** (DEC-250). Na **UE a etiqueta já mostra €/kg por lei** (verificado). Há **9 gates de field-feedback em andamento** (Gates 4–9 pendentes).

_Vieses a resistir:_ (a) o entusiasmo do próprio pedido ("todo mundo precisa", "faz total sentido") — tratar como hipótese, não dado; (b) "é só uma calculadorinha trivial" — o que decide não é a conta, é o encaixe e o custo de oportunidade.

### Perspectivas (cada uma às cegas)

**Strategist** — otimiza posição de longo prazo e custo de oportunidade; teme feature órfã e diluição de foco. O diferencial defensável do TripPilot é o **forecasting de orçamento**, não comparação de compras — categoria **à parte e saturada** (verificado), grátis em apps dedicados. Logo, **não é diferencial competitivo** por si só. O valor estratégico real é ser um **gancho de abertura diária no mercado** que **materializa o reposicionamento "não é só viagem, é Dia a dia"** (DEC-250) — o mesmo papel do câmbio na viagem. Risco de posição: virar item de menu morto num app que está **enxugando** sinaliza dispersão. **Rec:** fazer **enxuto, como utilitário-gancho do Dia a dia** (irmão do câmbio), nunca como pilar; só se o custo marginal for quase nulo. **Confiança: MÉDIA-ALTA.** _Outros perdem:_ o ativo único não é a conta — é o TripPilot já saber a moeda/contexto e pré-preencher; sem isso, é genérico e perdível.

**Architect** — otimiza viabilidade/reuso; teme duplicação e queima de token. Núcleo é um domínio **puro e minúsculo**: `compareUnitPrice(items[]) → {bestId, perUnit, savingsPct}` com normalização de unidades (g↔kg, ml↔L, un) — determinístico, testável, offline, **0 token**, na linhagem do scenario planner ("todo número explicável"). Há **molde pronto**: o padrão do câmbio (DEC-256: `domain/money/converter.ts` + `ConverterPage` + intent informativo no AssistantSheet). O comparador é o **gêmeo**. Foto reusa **CC-IMG (DEC-275)** + Groq vision. **Rec:** domínio puro + intent texto/voz (P) + tela opcional (M); foto **atrás do gate de token** (FB-18/FB-26). **Confiança: ALTA.** _Outros perdem:_ a lista de unidades tem que ser **data-driven**; e "comparar %/qualidade" **não** é o mesmo problema — misturar quebra a pureza do módulo.

**Critic** — advogado do diabo; busca a falha. Três golpes. **(1) Redundância na Europa:** verificado que a etiqueta **já mostra €/kg por lei** — o caso-âncora do Julio (na Europa) **já está na prateleira**; ele só precisa *ler*. **(2) Extração errada = compra errada:** foto de etiqueta é **mais difícil** que nota (peso variável, "leve 3 pague 2", promo vs normal, €/kg já impresso); se a IA ler 200g como 20g, o app recomenda o produto errado e **quebra confiança num app de dinheiro** (classe de risco do C12). **(3) Scope creep:** entra numa **adjacência saturada** com 9 gates pendentes; vira canivete suíço. **Rec:** se fizer, **V1 só texto/manual determinístico**, escopo **estrito a preço-por-unidade-de-medida** (nada de %, qualidade ou "preço no Brasil"), **sempre exibindo os números** para o usuário confirmar antes do veredito; foto fora do V1. **Confiança: MÉDIA-ALTA.** _Outros perdem:_ na UE o ganho marginal sobre a etiqueta é pequeno — medir antes de investir em tela/foto.

**Advocate** — otimiza valor real e simplicidade; teme fricção. O problema é **genuíno e universal**: mesmo com €/kg na etiqueta, quase ninguém compara mentalmente "5×20g vs 1×100g", e a embalagem confunde (verificado: é o pitch da categoria). Sonho do usuário: na gôndola, **falar ou digitar "A: 200g por 2€, B: 100g por 1€"** e ver na hora **"empatados — €10/kg"** ou **"o A rende 31% mais por kg"**. Tem que estar **onde o polegar já vai** (FAB) e ser **instantâneo e offline**. A foto é luxo, não essencial — **texto/voz** resolve 80% e é mais rápido na correria. **Rec:** V1 minimalista — N produtos (preço + quantidade), resultado grande com veredito e % de economia; **0 token, offline**; voz reusando o que já existe. **Confiança: ALTA.** _Outros perdem:_ consistência de privacidade/token — texto/voz sob `aiQuickEntryEnabled`, foto sob `cloudReceiptOcrEnabled`.

### Red Team (matar a opção líder: "fazer enxuto, espelhando o câmbio")
É **scope creep clássico**. (1) O caso-âncora do Julio acontece **na Europa, onde a lei já põe €/kg na etiqueta** — o app recalcularia o que está impresso a 10cm do olho. (2) Categoria **saturada e grátis** — quem quer muito baixa um dedicado; não retém ninguém. (3) A parte "sexy" (foto) é **a mais arriscada** (OCR de etiqueta erra) e a que **compete pelo free tier do Groq**, já gargalo do core. (4) O time está **fechando 9 gates** — abrir frente adjacente sinaliza dispersão. **Mundo mais seguro:** não fazer agora; no máximo um **intent de texto trivial** colado no pipeline do câmbio (sem tela, sem foto), e só promover com demanda medida.

### Síntese (Chair)
- **Consenso (todos):** a **conta é trivial, barata e segura**; **se** fizer, espelhar o câmbio (DEC-256) — **domínio puro + entrada**, **0 token no caminho texto/voz**, **offline**, escopo **estrito a preço-por-unidade-de-medida**; **nunca** prometer qualidade/% subjetivos nem "preço no Brasil" (C12, vetado).
- **Tensões reais:** Advocate + Architect ("é barato, universal e tem molde pronto → fazer enxuto") **×** Critic + parte do Strategist ("na UE a etiqueta já resolve · categoria saturada · foto queima token · scope creep no meio de 9 gates"). E: **tela dedicada** (vale no Brasil/sem etiqueta) **×** **só intent** (suficiente onde a etiqueta já dá €/kg).
- **Recomendação — SIM, só a versão enxuta e determinística, faseada** (ver §3).
- **Lente de maior peso para ESTA decisão: Architect.** O que torna isto seguro e barato é o **reuso exato do padrão do câmbio**; o que mata o risco do Critic é **restringir o escopo à conta determinística** e deixar foto/IA atrás do gate de token. O Strategist concorda em fazer só como **gancho-utilitário do Dia a dia**.
- **O que reverteria / minoria vence:** se a base estiver **majoritariamente na UE** (etiqueta já mostra €/kg), a **tela dedicada pode não se pagar** → fazer **só o intent de IA por texto/voz** e cortar a tela. Cenário oposto (Dia a dia no Brasil / sem etiqueta): **tela + foto** ganham peso. Por isso o intent vem primeiro; tela/foto são incrementais.
- **Confiança:** **ALTA** de que a versão enxuta/determinística faz sentido e é quase grátis; **MÉDIA** sobre a foto-da-etiqueta (valor × custo de token × dificuldade de OCR).

### Respostas diretas às 3 perguntas do Julio
1. **Faz sentido para o app?** **Sim, na versão enxuta** — utilitário-gancho do **Dia a dia**, irmão do câmbio. **Não** como pilar nem como foto-IA de cara.
2. **O usuário quer/usaria?** Problema real e universal (verificado). Mas na **Europa a etiqueta já mostra €/kg** — maior valor no **Dia a dia fora da UE** e no caminho **"pergunto rápido por texto/voz"**.
3. **Onde moraria?** Onde mora o câmbio: **intent no AssistantSheet** (texto/voz, conta local) **+ mini-tela acessível pelo FAB e Guia**. Foto depois, atrás do gate de token.

---

## 3. Recomendação faseada

### V1 — enxuto, determinístico (recomendado)
- **Escopo estrito:** comparação de **preço por unidade de medida** (peso g/kg, volume ml/L, contagem/unidade, pacote/multipack). **Nada** de qualidade, % subjetivo, ou preço de mercado externo.
- **Entradas:** (a) **manual/tela** — N produtos com `{preço, quantidade, unidade}`; (b) **intent de IA por texto/voz** — "qual vale mais, A 200g por 2€ ou B 100g por 1€?" → a IA **só extrai** os pares `{preço, quantidade, unidade}` e **o app faz a conta localmente** (0 token de cálculo; offline-friendly), **sem criar gasto** (intent informativo, idêntico ao câmbio).
- **Saída:** preço por unidade normalizada de cada item, **o vencedor**, **% de economia** vs o mais caro, e um veredito honesto ("empate técnico" quando < ~3%). **Sempre exibir os números** lidos/digitados, editáveis, antes do veredito.
- **Acesso:** chip no **FAB** (grupo de captura, junto do câmbio) + entrada no **Guia** + (futuro) atalho no Copiloto.

### V2 — foto da etiqueta (condicionado, talvez nunca)
- Foto via **CC-IMG (DEC-275)** + Groq vision lê `{preço, quantidade, unidade}` da etiqueta → cai no mesmo motor do V1. **Atrás do gate de orçamento de token** (FB-18/FB-26) e com **confirmação obrigatória** dos valores lidos. Só se houver demanda medida e folga de token.

### Encaixe no roadmap
- **Irmão do Gate 6 (Câmbio).** Reusa o mesmíssimo padrão (domínio puro + intent + tela). **Não** abrir frente nova fora do pipeline. Idealmente implementar **junto ou logo após** o câmbio, aproveitando o `converter` recém-criado como molde.

### Condições inegociáveis
- Escopo estrito a preço/unidade-de-medida; 0 token no caminho texto; nada de "preço no Brasil"/qualidade; números sempre visíveis e editáveis; foto só no V2 com gate de token; entra **dentro** do pipeline (perto do câmbio).

---

## 4. Spec de implementação (V1) — para a IA implementar depois

> Formato do master plan: Causa/Abordagem → ACs → Testes → Anti-regressão → Esforço/Risco. Código em inglês; copy em pt-BR/en/es.

- **Abordagem.**
  1. **Domínio puro (novo, ex.: `src/domain/shopping/unit-price.ts` — confirmar convenção de pasta; pode co-locar perto de `domain/money/`):**
     `normalizeQuantity(value, unit) → { baseValue, baseUnit }` (g/kg→g; ml/L→ml; un→un) e
     `compareUnitPrice(items: { id, priceCents, quantity, unit }[]) → { perUnit: {id, cents, baseUnit}[], bestId, savingsPctVsWorst, tie }`.
     Determinístico, sem dependência de IA/rede. Lista de unidades **data-driven** (`UNIT_DEFINITIONS`), espelhando `listSelectableCurrencies` do câmbio.
  2. **Intent de IA (texto/voz)** no `domain/assistant/*` + `AssistantSheet.tsx`: nova intent **informativa** `compare_unit_price` que extrai os pares `{amount, quantity, unit}` e chama `compareUnitPrice` **localmente**; **não** cria transação (mesmo contrato do intent de câmbio DEC-256). Gate `aiQuickEntryEnabled`.
  3. **Mini-tela `features/shopping/ComparatorPage.tsx` (`/comparador`)**: lista de produtos (preço + quantidade + seletor de unidade), botão "+ produto", resultado grande (vencedor + % + por-unidade de cada), "⇄"/limpar. Espelhar a estrutura fina de `ConverterPage` (DEC-256).
  4. **Acesso:** chip no `components/FAB.tsx` (grupo de captura, ao lado do câmbio) + entrada em `domain/guide/guide-catalog.ts` (rota tem que existir — o teste do guia guarda isso).
- **ACs.** (1) `compareUnitPrice` acerta a normalização e o vencedor (incl. unidades mistas g↔kg, ml↔L). (2) "120g por €1" vs "200g por €2" → vencedor **120g** (€8,33/kg vs €10/kg), com % correto. (3) Empate < ~3% mostra "empate técnico". (4) Intent de IA por texto/voz responde sem criar gasto. (5) Tela acessível pelo FAB/Guia; rota existe. (6) Funciona **offline** e com **0 token** no caminho texto/manual. (7) Números lidos/digitados sempre visíveis e editáveis antes do veredito.
- **Testes.** Unit `unit-price`: normalização; vencedor; empate; multipack; divisão por zero/qtd ausente (degrada sem crash). Intent: extrai `{amount, quantity, unit}` e a conta bate. Render: tela soma/compara ao vivo; guia-route test verde.
- **Anti-regressão.** Módulo **puro e isolado** (não toca orçamento, carteiras, `convertToBaseCents`, nem o motor de gasto). Intent informativo **nunca** cria transação. Reusar CC-IMG/Groq só no V2. Não criar 2º padrão de captura de imagem.
- **Esforço/Risco.** **V1 = M** (conta P + intent P + tela M, com molde do câmbio) / risco **baixo**. **V2 (foto) = M** / risco **médio** (OCR de etiqueta + token) — só com gate.

---

## 5. Estado de ratificação + DEC proposta

### 5.1 Pendente do Julio (decisão de produto)
1. **Escopo do V1:** **tela `/comparador` + intent de IA** (recomendado) **ou** **só o intent** (mais barato, suficiente onde a etiqueta já dá €/kg) **ou** **só a tela**?
2. **Encaixe:** junto do **Gate 6 (Câmbio)** (recomendado) ou item/gate próprio?
3. **V2 (foto da etiqueta):** registrar como backlog condicionado ao gate de token (recomendado) ou descartar?

### 5.2 DEC registrada (ratificada por Julio — V1 implementado)
- **DEC-283** — *Comparador de custo-benefício (preço por unidade):* módulo determinístico puro (`domain/shopping/unit-price.ts`) + intent de IA informativo `compare_unit_price` (texto/voz, conta local, 0 token, não cria gasto) + mini-tela `/comparator` no FAB/Guia/Ajuda, espelhando o padrão do câmbio (DEC-256). Escopo **estrito a preço-por-unidade-de-medida**; **sem** qualidade/%/"preço no Brasil" (herda o veto do C12). **Foto da etiqueta = V2** atrás do gate de token (FB-18/FB-26), com confirmação dos valores lidos.
  - _Resolução de id:_ DEC-281/282 acabaram **consumidos pelo Gate 3** (FB-16/FB-23, shipped em 0.99.42), então o próximo id livre foi **DEC-283** — registrado no `decision-log.md`.

---

### Apêndice — Mapa pedido → item → arquivos-âncora
| Pedido do Julio | Parte | Arquivos-âncora |
|---|---|---|
| Comparar por peso/volume/unidade | Conta (V1) | **novo** `domain/shopping/unit-price.ts` (puro) |
| "Pergunto qual vale mais" (texto/voz) | Intent IA (V1) | `features/assistant/AssistantSheet.tsx`, `domain/assistant/*` (nova intent `compare_unit_price`, conta local — molde DEC-256) |
| Tela na hora, no mercado | Mini-tela (V1) | **novo** `features/shopping/ComparatorPage.tsx` (`/comparador`), `components/FAB.tsx`, `domain/guide/guide-catalog.ts` |
| Foto dos preços/etiquetas | Foto (V2, condicionado) | `features/attachments/AttachmentSection.tsx`/`ImageSourceChooser` (CC-IMG/DEC-275), worker `/ocr` (Groq vision), gate de token (FB-18/FB-26) |
| "Preço no Brasil" / qualidade / % | **Fora de escopo** | — (vetado: C12 / `fact-verification.mdc`) |
