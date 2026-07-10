# AI-Powered Planning — Especificação Completa

> **Data:** 2026-07-10
> **Origem:** Auditoria marketing-vs-realidade (gap F4) + visão de produto (Julio)
> **Validado por:** Council brainstorm (4 perspectivas + red team + síntese)
> **Objetivo:** Fazer o dashboard do TripPilot entregar os counters de ocasiões desde o PRIMEIRO uso, com planejamento automático enriquecido por IA contextual.

---

## O Problema

O marketing do TripPilot promete "3 noites no bar, 5 idas ao mercado, 1 passeio" no dashboard. Na realidade, esses counters só aparecem quando o usuário configura manualmente um `ScenarioPlan` no Planejador. Sem plano = dashboard vazio de counters = a feature headline do marketing é invisível.

**Impacto medido:**
- Novo usuário instala → vê dashboard sem counters → "cadê as noites de bar?"
- O setup manual exige: ir ao Planejador → entender perfis → ajustar quantidades → salvar
- Estimativa: <20% dos usuários fazem isso espontaneamente

---

## Solução: 3 Fases Incrementais

Cada fase é deployável e útil sozinha. Fase 2 e 3 são upgrades opcionais.

---

### Fase 1 — Smart Onboarding (SEM IA) · ~6h

**Conceito:** Durante a criação da fase (onboarding ou editor), perguntar "o que você quer fazer?" com chips de atividade. Ao confirmar, o app gera automaticamente um plano com distribuição proporcional.

#### UX Flow

```
[Onboarding existente]
  Nome da trip → Nome da fase → Datas → Moeda → Orçamento → Reserva protegida
  
[NOVO PASSO] "O que vai ter nessa fase?"
  ┌─────────────────────────────────────────────────────┐
  │  O que você quer fazer nessa fase?                   │
  │                                                      │
  │  [🍺 Bar]  [🛒 Mercado]  [🍽️ Restaurante]           │
  │  [🏛️ Passeio]  [☕ Café]  [🚌 Transporte]           │
  │  [🎉 Vida noturna]  [🏖️ Praia]  [🛍️ Compras]       │
  │  [+ Outro]                                           │
  │                                                      │
  │  Selecione os tipos de atividade que planeja fazer.  │
  │  O app vai criar um plano inicial que você pode      │
  │  ajustar depois.                                     │
  │                                                      │
  │              [Continuar]                              │
  └─────────────────────────────────────────────────────┘
```

**Nota:** Este passo JÁ EXISTE parcialmente como DEC-074 (Per-Phase Activities — "O que vai ter nessa fase?" com chip grid). A diferença é que DEC-074 cria `phaseProfileSettings` (habilita/desabilita perfis), mas **NÃO cria um ScenarioPlan**. A Fase 1 estende o DEC-074: ao confirmar os chips, ALÉM de criar os profile settings, cria o `ScenarioPlan` + `ScenarioAllocationItem` automaticamente.

#### Lógica de Distribuição (sem IA)

```typescript
interface AutoPlanInput {
  selectedProfileIds: string[];
  profiles: ActivityProfile[];
  freeToSpendCents: number;  // orçamento - reserva protegida - eventos reservados
}

interface AutoPlanOutput {
  allocations: Array<{
    activityProfileId: string;
    quantity: number;
    estimatedUnitCostCents: number;
  }>;
  totalAllocatedCents: number;
  remainingFreeCents: number;
}
```

**Algoritmo:**
1. Para cada perfil selecionado, usar `typicalValueCents` do preset (ex: bar = 3500, mercado = 1800)
2. Calcular a "fatia" proporcional: `weight = typicalValue / sumOfAllTypicals`
3. Calcular a quantia: `quantity = floor((freeToSpend * weight) / typicalValue)`
4. Verificar que `sum(quantity * typical) ≤ freeToSpend` — ajustar se necessário
5. Criar `ScenarioPlan` + `ScenarioAllocationItem` por perfil

**Spending level default:** A Fase 1 (sem IA) assume **`balanced`** como spending_level
para todas as atividades. Os `typicalValueCents` dos presets correspondem ao nível "balanced"
do destination cluster detectado. Se a Fase 2 (IA) for usada depois, ela substitui o plano
com valores mais precisos e o spending_level escolhido pelo usuário.

**Resultado imediato:** O dashboard mostra counters (ex: "🍺 4 restantes / ~€35") logo após o onboarding.

#### Integração com DEC-074

O passo "O que vai ter nessa fase?" do DEC-074 (chip grid de atividades) é o ponto de integração natural:

- **Hoje:** selecionar chips → cria `phaseProfileSettings` → fim
- **Fase 1:** selecionar chips → cria `phaseProfileSettings` + `ScenarioPlan` + `ScenarioAllocationItem` → mostra resumo do plano → CTA "Ajustar no planejador"

Se o usuário pula o passo de atividades, nenhum plano é criado (opt-in por seleção).

#### Comportamento no Editor de Fase

Quando o usuário edita uma fase existente que NÃO tem plano:
- Mostrar um card: "Essa fase não tem plano de ocasiões. Quer criar um?"
- CTA: "Criar plano" → abre os chips → gera plano automático

#### "Revertível"

Botão no Planner: "Remover plano automático" → soft-delete do ScenarioPlan. Counters voltam ao modo "sem plano" (mostram só contagem bruta). Power users que preferem manual puro não ficam presos.

---

### Fase 2 — AI Copilot Planning (COM IA via Groq) · ~12h

**Conceito:** O copiloto de IA recebe as informações da viagem, identifica o que falta saber, faz perguntas inteligentes ao usuário, e gera um plano completo e justificado. O fluxo é bidirecional:

```
App → IA (dados da viagem) → IA responde com PERGUNTAS
→ App mostra perguntas ao user → User responde
→ App → IA (dados + respostas) → IA gera PLANO COMPLETO
→ App mostra plano → User aceita/ajusta
```

**Princípio fundamental:** A IA só funciona se receber as informações certas. Ela NÃO vai gerar um plano no escuro. O flow é projetado para que a IA PEÇA o que precisa saber.

---

#### Step 1: Enviar Contexto Inicial

O app coleta TUDO que já sabe da viagem e envia para o Worker:

```
POST /plan-copilot/analyze
Content-Type: application/json

{
  "trip_name": "Eurotrip 2026",
  "phases": [
    {
      "name": "Amsterdam",
      "start_date": "2026-08-01",
      "end_date": "2026-08-10",
      "budget_cents": 80000,
      "reserve_cents": 10000,
      "currency": "EUR"
    }
  ],
  "selected_activities": ["bar", "market", "restaurant", "outing", "museum"],
  "existing_profiles": {
    "bar": { "typical_cents": 3500, "data_points": 0 },
    "market": { "typical_cents": 1800, "data_points": 0 }
  },
  "spending_so_far": null,  // null = fresh trip, object = mid-trip re-plan
  "language": "pt-BR"
}
```

#### Step 2: IA Analisa e Retorna Perguntas

A IA NÃO gera o plano neste step. Ela analisa o que recebeu, identifica as lacunas e retorna perguntas estruturadas:

```json
{
  "understood": {
    "summary": "Viagem a Amsterdam, 10 dias, €800 (€100 reserva, €700 livres). Atividades: bar, mercado, restaurante, passeio, museu.",
    "destination_recognized": true,
    "destination_details": "Amsterdam, Países Baixos — cidade com custo de vida alto para Europa."
  },
  "questions": [
    {
      "id": "accommodation",
      "text": "Onde você vai ficar em Amsterdam?",
      "why": "Quem fica em hotel come mais fora; quem fica com amigos/família cozinha mais.",
      "type": "single_choice",
      "options": [
        { "id": "family", "label": "Com família ou amigos", "emoji": "🏠" },
        { "id": "hostel", "label": "Hostel (com cozinha)", "emoji": "🛏️" },
        { "id": "hotel", "label": "Hotel (sem cozinha)", "emoji": "🏨" },
        { "id": "airbnb", "label": "Airbnb / apartamento", "emoji": "🏡" }
      ],
      "allow_custom": true
    },
    {
      "id": "nightlife_style",
      "text": "Quando sai à noite, como é normalmente?",
      "why": "Ajuda a estimar o custo por noite no bar.",
      "type": "single_choice",
      "options": [
        { "id": "light", "label": "2-3 drinks, tranquilo", "emoji": "🍷" },
        { "id": "moderate", "label": "4-5 drinks, noite normal", "emoji": "🍺" },
        { "id": "heavy", "label": "Noite longa, vários drinks", "emoji": "🎉" }
      ],
      "allow_custom": true
    },
    {
      "id": "food_style",
      "text": "Qual sua preferência para refeições?",
      "why": "Define se gasta mais em mercado ou em restaurante.",
      "type": "single_choice",
      "options": [
        { "id": "cook_mostly", "label": "Cozinho na maioria dos dias", "emoji": "👨‍🍳" },
        { "id": "mix", "label": "Metade cozinha, metade restaurante", "emoji": "🍽️" },
        { "id": "eat_out", "label": "Como fora quase sempre", "emoji": "🍕" }
      ],
      "allow_custom": true
    },
    {
      "id": "trip_vibe",
      "text": "Qual o clima dessa viagem?",
      "why": "Define o equilíbrio entre economia e experiência.",
      "type": "single_choice",
      "options": [
        { "id": "budget", "label": "Econômica — gastar o mínimo", "emoji": "💰" },
        { "id": "balanced", "label": "Equilibrada — mix de tudo", "emoji": "⚖️" },
        { "id": "social", "label": "Social — priorizar saídas", "emoji": "🎊" },
        { "id": "cultural", "label": "Cultural — museus e passeios", "emoji": "🏛️" }
      ],
      "allow_custom": true
    }
  ],
  "already_known": [
    "Amsterdam é uma cidade cara para vida noturna (~€5-8 por cerveja no centro)",
    "Mercados como Albert Heijn e Jumbo são acessíveis (~€15-25 por compra)",
    "Muitos museus têm entrada entre €15-22 (Rijksmuseum, Van Gogh)"
  ]
}
```

**Regras da IA para gerar perguntas:**
- A IA decide QUANTAS e QUAIS perguntas fazer com base no contexto
- Viagem de 3 dias? Provavelmente 2 perguntas bastam (vibe + comida)
- Viagem de 30 dias multi-destino? Pode ter 4-5 perguntas
- Cada pergunta tem um "why" — o usuário entende POR QUE está sendo perguntado
- Todas as perguntas têm opções + campo livre ("Outro")
- NUNCA mais que 5-6 perguntas — depois desse limite, a IA deve inferir

#### Step 2b: UX das Perguntas

A tela das perguntas é LEVE — não parece formulário. Parece conversa:

```
┌─────────────────────────────────────────────────────┐
│  🤖 Copiloto de orçamento                            │
│                                                      │
│  Entendi! Você vai para Amsterdam, 10 dias, €800.    │
│                                                      │
│  Já sei que:                                         │
│  • Amsterdam é cara para vida noturna (~€5-8/cerveja)│
│  • Mercados tipo Albert Heijn são acessíveis         │
│  • Museus custam entre €15-22                        │
│                                                      │
│  ─────────────────────────────────────────────────── │
│                                                      │
│  Para montar um plano preciso, preciso saber:        │
│                                                      │
│  Onde você vai ficar?                                │
│  Quem fica em hotel come mais fora; quem fica        │
│  com amigos cozinha mais.                            │
│                                                      │
│  🏠 Com família ou amigos                            │
│  🛏️ Hostel (com cozinha)                             │
│  🏨 Hotel (sem cozinha)                              │
│  🏡 Airbnb / apartamento                             │
│  💬 Outro: [______________]                          │
│                                                      │
│  ─────────────────────────────────────────────────── │
│                                                      │
│  Quando sai à noite, como é normalmente?             │
│  Ajuda a estimar o custo por noite.                  │
│                                                      │
│  🍷 2-3 drinks, tranquilo                            │
│  🍺 4-5 drinks, noite normal                         │
│  🎉 Noite longa, vários drinks                       │
│  💬 Outro: [______________]                          │
│                                                      │
│  ─────────────────────────────────────────────────── │
│                                                      │
│  (... mais perguntas ...)                            │
│                                                      │
│     [Gerar meu plano]   [Prefiro manual]             │
└─────────────────────────────────────────────────────┘
```

**Design principles:**
- Todas as perguntas aparecem numa ÚNICA tela scrollável (não wizard multi-step)
- Cada pergunta tem o "why" em texto menor — explica a relevância
- A seção "Já sei que:" mostra que a IA NÃO está no escuro — ela já sabe coisas sobre o destino
- Chips com emoji = toque rápido, não digitação
- "Outro" permite texto livre para cada pergunta
- "Prefiro manual" SEMPRE visível — sem pressão
- UX mobile-first: chips grandes (48px min), scroll natural

#### Step 3: Enviar Respostas e Gerar Plano

```
POST /plan-copilot/generate
Content-Type: application/json

{
  "session_id": "...",  // link com o analyze anterior
  "answers": {
    "accommodation": "family",
    "nightlife_style": "moderate",
    "food_style": "cook_mostly",
    "trip_vibe": "balanced"
  }
}
```

#### Step 4: IA Retorna Plano Lean (Worker enriquece)

**O que a IA retorna (lean — sem totais, sem enriquecimento):**

```json
{
  "plan": {
    "activities": [
      {
        "type": "bar",
        "spending_level": "balanced",
        "suggested_quantity": 3,
        "typical_cost_cents": 4500,
        "reasoning": "3-5 drinks por noite em Amsterdam, cerveja €6-8 + possível snack. 3 noites em 10 dias é conservador para estilo equilibrado."
      },
      {
        "type": "market",
        "spending_level": "balanced",
        "suggested_quantity": 6,
        "typical_cost_cents": 2200,
        "reasoning": "Ficando com família e cozinhando, ~6 idas ao mercado para 10 dias. Albert Heijn/Jumbo: €18-25 por compra com ingredientes básicos."
      },
      {
        "type": "restaurant",
        "spending_level": "balanced",
        "suggested_quantity": 3,
        "typical_cost_cents": 3000,
        "reasoning": "Restaurante casual em Amsterdam: prato principal + bebida = €25-35/pessoa. 3 refeições em 10 dias."
      },
      {
        "type": "outing",
        "spending_level": "balanced",
        "suggested_quantity": 3,
        "typical_cost_cents": 2200,
        "reasoning": "Rijksmuseum €22, Van Gogh €20, passeio de barco ~€18. Muitos passeios gratuitos complementam."
      },
      {
        "type": "transport",
        "spending_level": "balanced",
        "suggested_quantity": 8,
        "typical_cost_cents": 900,
        "reasoning": "GVB dagkaart €9/dia. 8 dos 10 dias usando transporte público (2 dias andando)."
      }
    ],
    "free_budget_cents": 70000
  },
  "context_used": {
    "destination": "Amsterdam, Países Baixos",
    "duration": "10 dias",
    "budget": "€800 (€100 reserva, €700 livres)",
    "spending_style": "balanced",
    "priority_categories": null,
    "accommodation": "Com família ou amigos",
    "nightlife": "4-5 drinks, noite normal",
    "food": "Cozinha na maioria dos dias"
  },
  "insights": [
    "Ficando com família e cozinhando, você economiza bastante em comida — isso abre espaço para mais saídas.",
    "Amsterdam tem muitos passeios gratuitos (canais, Vondelpark, mercados de rua).",
    "Dica: o I amsterdam City Card (€65/24h) cobre vários museus e transporte — pode valer se quiser fazer tudo em 1-2 dias."
  ],
  "confidence": "medium-high"
}
```

**O que o Worker calcula e adiciona:**
```json
{
  "total_planned_cents": 49500,
  "margin_cents": 20500,
  "margin_percent": 29
}
```
`total_planned_cents = (3×4500) + (6×2200) + (3×3000) + (3×2200) + (8×900) = 13500 + 13200 + 9000 + 6600 + 7200 = 49500`
`margin = 70000 - 49500 = 20500 (29%)`
_(Nota: o Worker calcula isso, não a IA.)_

**O que o Client enriquece via lookup table (ver seção "Lookup Table"):**
```json
{
  "type": "bar",
  "spending_level": "balanced",
  "suggested_quantity": 3,
  "typical_cost_cents": 4500,
  "reasoning": "...",
  "expected_min_cost_cents": 4000,
  "expected_max_cost_cents": 5500,
  "cost_scope": "per_person_per_night",
  "includes": ["3-5 drinks", "possível snack ou petisco", "locais de preço médio"],
  "usually_not_included": ["cocktails premium", "entrada de club/balada", "táxi de volta"],
  "assumption": "Noite em bar ou pub, preço médio, sem balada"
}
```

#### Step 4b: UX do Resultado — Disclosure Progressivo

O resultado mostra o plano com 3 camadas de informação:
1. **Sempre visível**: valor + quantidade + 1 frase do que cobre + faixa
2. **Ao tap**: detalhes (includes, not_included, reasoning da IA)
3. **Cabeçalho**: resumo das escolhas do usuário (spending_style + respostas)

```
┌─────────────────────────────────────────────────────┐
│  ✨ Seu plano de orçamento                           │
│                                                      │
│  ┌─────────────────────────────────────────────────┐ │
│  │  Seu estilo de viagem                           │ │
│  │                                                  │ │
│  │  ⚖️ Equilibrado                                  │ │
│  │                                                  │ │
│  │  📍 Amsterdam · 10 dias · €700 livres            │ │
│  │  🏠 Com família · 👨‍🍳 Cozinha na maioria         │ │
│  │  🍺 Saídas moderadas                             │ │
│  │                                                  │ │
│  │  [Alterar preferências]                          │ │
│  └─────────────────────────────────────────────────┘ │
│                                                      │
│  ─────────────────────────────────────────────────── │
│                                                      │
│  🍺 Noite em bar                              [tap] │
│  3 noites × ~€45 = €135                             │
│  3-5 drinks, possível snack, locais de preço médio  │
│  Faixa esperada: €40-55 por noite                    │
│                                                      │
│  🛒 Compra de mercado                         [tap] │
│  6 idas × ~€22 = €132                               │
│  Alimentos básicos para 1-2 dias de refeições       │
│  Faixa esperada: €18-28 por compra                   │
│                                                      │
│  🍽️ Restaurante casual                        [tap] │
│  3 refeições × ~€30 = €90                           │
│  Prato principal + bebida simples                    │
│  Faixa esperada: €25-40 por refeição                 │
│                                                      │
│  🏛️ Passeio / atração                         [tap] │
│  3 passeios × ~€22 = €66                            │
│  Museu ou atração + transporte até o local           │
│  Faixa esperada: €18-30 por passeio                  │
│                                                      │
│  🚌 Transporte diário                         [tap] │
│  8 dias × ~€9 = €72                                 │
│  Dia inteiro de metro/tram/ônibus                    │
│  Faixa esperada: €7-10 por dia                       │
│                                                      │
│  ─────────────────────────────────────────────────── │
│                                                      │
│  📊 Resumo (calculado pelo app)                      │
│  Total planejado:  €495                              │
│  Livres:           €700                              │
│  Margem livre:     €205 (29%)                        │
│  Para imprevistos, compras e surpresas               │
│                                                      │
│  ─────────────────────────────────────────────────── │
│                                                      │
│  💡 Dicas:                                           │
│  • Ficando com família, você economiza em comida.    │
│  • Amsterdam tem muitos passeios gratuitos.          │
│  • I amsterdam City Card (€65/24h) pode valer       │
│    para museus + transporte em 1-2 dias.             │
│                                                      │
│  ⚠️ Os valores deste plano consideram o estilo       │
│  selecionado. Escolhas mais caras ou diferentes      │
│  das descritas podem aumentar o gasto real.          │
│                                                      │
│  ─────────────────────────────────────────────────── │
│                                                      │
│  [✓ Usar este plano]                                 │
│  [✏️ Ajustar no planejador]                          │
│  [🔄 Refazer com outras preferências]                │
│                                                      │
└─────────────────────────────────────────────────────┘
```

**Ao tap em uma atividade (bottom sheet / expandir):**

```
┌─────────────────────────────────────────────────────┐
│  🍺 Noite em bar                                     │
│                                                      │
│  Como chegamos nesse valor?                          │
│                                                      │
│  Seu estilo: Equilibrado                             │
│  Cidade: Amsterdam                                   │
│                                                      │
│  ✅ Este valor considera:                             │
│  • 3-5 drinks (cerveja €6-8 ou similar)              │
│  • Possível snack ou petisco                         │
│  • Bares e pubs de preço médio                       │
│                                                      │
│  ⚠️ Normalmente NÃO cobre:                          │
│  • Cocktails premium (€10-15 cada)                   │
│  • Entrada de club/balada (€10-20)                   │
│  • Táxi de volta                                     │
│                                                      │
│  ─────────────────────────────────────────────────── │
│                                                      │
│  Outros estilos nesta cidade:                        │
│  💰 Econômico: €25-35 (2-3 cervejas, sem food)      │
│  ⚖️ Equilibrado: €40-55 (atual)                     │
│  🍽️ Confortável: €55-80 (cocktails, food, entrada)  │
│  ✨ Flexível: €80+ (premium, sem limite)             │
│                                                      │
│  [Alterar para outro estilo]                         │
│  [Alterar quantidade]                                │
│  [Alterar valor estimado]                            │
│                                                      │
└─────────────────────────────────────────────────────┘
```

**Princípio de disclosure:** informações que a maioria precisa (valor, frase, faixa) ficam
sempre visíveis. Detalhes complementares (includes, not_included, estilos alternativos,
reasoning) ficam ao tap. A mensagem "valores consideram o estilo selecionado" é sempre visível.

**Comportamento dos botões:**
- **"Usar este plano"**: cria `ScenarioPlan` + `ScenarioAllocationItem` + atualiza `typicalValueCents` dos perfis. Dashboard imediatamente mostra counters.
- **"Ajustar no planejador"**: cria o plano E navega ao Planner para ajuste fino ([-]/[+])
- **"Refazer com outras preferências"**: volta ao Step 2b (perguntas) com as respostas pré-preenchidas

#### Privacy Disclosure

Mostrado UMA VEZ, antes do primeiro envio:

```
┌─────────────────────────────────────────────────────┐
│  ℹ️ Como o copiloto funciona                         │
│                                                      │
│  Para criar um plano personalizado, vamos enviar     │
│  as informações da sua viagem (destino, datas,       │
│  orçamento e suas respostas) para nosso servidor,    │
│  que usa inteligência artificial para sugerir um     │
│  plano realista com preços locais.                   │
│                                                      │
│  ✓ Nenhum dado pessoal é enviado (nome, email, etc.) │
│  ✓ Os dados não ficam armazenados no servidor        │
│  ✓ O provedor de IA não treina com seus dados        │
│  ✓ Funciona igual ao leitor de recibos do app        │
│                                                      │
│  Não quer usar? O plano manual funciona              │
│  perfeitamente sem internet.                         │
│                                                      │
│    [Entendi, continuar]  [Prefiro manual]            │
└─────────────────────────────────────────────────────┘
```

#### Fallback Offline

Se a IA não responder (offline, erro, timeout >10s):
1. Usar o plano da Fase 1 (distribuição proporcional com presets)
2. Toast: "Sem internet — criamos um plano básico. Quando conectar, o copiloto pode ajustar."
3. No Planner: manter botão "Refazer com copiloto" para quando estiver online

#### Prompt Engineering

**Prompt para Step 2 (analyze — gerar perguntas) — v5 validada:**

```
You are a travel budget planning copilot. The user is setting up a trip 
and wants an AI-assisted spending plan. You will receive their trip details 
and must return:

1. A summary of what you understood
2. What you already know about the destination (local prices, tips)
3. QUESTIONS you need answered to create an accurate plan

MANDATORY QUESTIONS (always include these as the FIRST two questions):

1. "spending_style" — How the user prefers to spend during the trip.
   Options (4 levels, default selection = "balanced"):
   - budget: "Economizar ao máximo" — mercado, comida preparada em casa, 
     atrações gratuitas e transporte econômico.
   - balanced: "Econômico, mas aproveitando" — maioria das refeições 
     econômicas, algumas refeições fora e algumas saídas.
   - comfortable: "Equilibrado para mais" — mistura de mercado, restaurantes, 
     cafés, passeios pagos e vida noturna.
   - flexible: "Quero aproveitar sem me limitar muito" — restaurantes melhores, 
     drinks, experiências e maior liberdade de escolha.

2. "priority_categories" (optional, multi_choice) — Where the user wants to 
   spend MORE money. Up to 2 selections:
   - food, nightlife, outings, transport_comfort, shopping, distribute_equally.
   This question is OPTIONAL — skip if the trip is very short (≤3 days) or 
   the budget is very tight (leaves little room for prioritization).

RULES FOR ADDITIONAL QUESTIONS:
- Ask ONLY what you NEED to create a good plan (don't ask for fun)
- Each question must have single_choice or multi_choice options with emoji + label
- Each question must explain WHY you're asking (1 sentence)
- Max 5 questions total for trips ≤7 days, max 6 for longer trips
  (the 2 mandatory questions count toward this limit)
- Always include allow_custom: true (the user can type anything)
- Adapt additional questions to the context:
  - 3-day city trip? Skip accommodation, ask food style
  - 30-day multi-country? Ask about pace, accommodation, cooking
  - Festival trip? Ask about ticket costs, drinking habits
- Options should be in the user's language ({language})
- Never ask about things the user already told you

Return JSON only with this exact structure:
{
  "understood": { "summary": "...", "destination_recognized": bool, "destination_details": "..." },
  "questions": [
    { "id": "spending_style", "text": "...", "why": "...", "type": "single_choice",
      "options": [
        { "id": "budget", "label": "...", "emoji": "💰" },
        { "id": "balanced", "label": "...", "emoji": "⚖️", "default": true },
        { "id": "comfortable", "label": "...", "emoji": "🍽️" },
        { "id": "flexible", "label": "...", "emoji": "✨" }
      ], "allow_custom": true },
    { "id": "priority_categories", "text": "...", "why": "...", "type": "multi_choice",
      "max_selections": 2,
      "options": [
        { "id": "food", "label": "...", "emoji": "🍽️" },
        { "id": "nightlife", "label": "...", "emoji": "🍺" },
        { "id": "outings", "label": "...", "emoji": "🏛️" },
        { "id": "transport_comfort", "label": "...", "emoji": "🚕" },
        { "id": "shopping", "label": "...", "emoji": "🛍️" },
        { "id": "distribute_equally", "label": "...", "emoji": "📊" }
      ], "allow_custom": true },
    ...additional context-dependent questions...
  ],
  "already_known": ["fact about destination prices", ...]
}
```

**Prompt para Step 4 (generate — gerar plano) — v5 validada:**

```
You are a travel budget planning copilot. Given the trip details and the 
user's answers to your questions, generate a complete spending plan.

WHAT EACH ACTIVITY TYPE MEANS (cost = the FULL occasion, not a single item):
- "bar": a full night out — 3-5 drinks, maybe a snack, maybe cover/entrance. NOT 1 beer.
- "market": a full grocery shopping trip — enough food for 1-2 days of cooking. NOT street food.
- "restaurant": a full meal — main course + drink, maybe dessert. NOT just the plate.
- "outing": a day activity — museum ticket + transport to get there, or a tour, or a boat ride.
- "transport": a FULL DAY of getting around the city (metro/bus/tram). NOT a single ticket.
- "festival": a festival day — ticket + food + drinks at the venue.
- "special": a one-off experience (concert, show, special dinner).

HOW spending_level AFFECTS BOTH PRICE AND QUANTITY (critical):

The user's spending_style answer defines the spending_level for each activity.
spending_level changes WHAT the occasion looks like, not just the price:

| Level | Bar example | Restaurant example | Market example |
|-------|------------|-------------------|---------------|
| budget | 2-3 beers, no food, no cover | takeaway/fast casual/meal deal | basic staples only |
| balanced | 3-5 drinks, possible snack | casual restaurant, main + drink | staples + some ready meals |
| comfortable | cocktails, food, possible cover | nicer restaurant, starter or dessert | quality ingredients, some imported |
| flexible | premium venue, cocktails, late night | fine dining, full menu | gourmet, imported, no budget limit |

spending_level also changes QUANTITY (example for 7-day trip):
| Level | Market trips | Restaurant meals | Bar nights |
|-------|-------------|-----------------|-----------|
| budget | 3-4 | 1-2 | 0-1 |
| balanced | 2-3 | 3-5 | 1-2 |
| comfortable | 1-2 | 5-8 | 2-3 |
| flexible | 0-1 | 7-10 | 2-4 |

If the user chose priority_categories, increase quantity and/or quality for 
those categories and decrease others to compensate within the budget.

Trip data: {full context from step 1}
User answers: {answers from step 3}

RULES:
- Typical costs MUST reflect real local prices in {destination} (2025-2026)
- NEVER output typical_cost_cents = 0 or suggested_quantity = 0 for any activity
- spending_level in each activity MUST match the user's spending_style answer
  (unless priority_categories override a specific category up/down)
- Do NOT compute or return any totals — the server calculates all arithmetic
- Do NOT include accommodation or flights in activities
- Leave room for at least 15-25% margin (be CONSERVATIVE with quantities)
- Output reasoning and insights in the user's language ({language})
- Costs are in CENTS (integer), currency is {currency}

BUDGET vs STYLE CONFLICT:
If the budget cannot support the chosen spending_level for the full trip duration,
DO NOT silently lower prices below local reality. Instead:
- Set confidence to "low"
- Add an insight explaining the conflict: "Com esse orçamento, manter estilo 
  confortável por todos os X dias não parece viável. Mantivemos conforto nas 
  categorias prioritárias e economizamos nas demais."
- Lower the spending_level of non-priority categories first

Return JSON only:
{
  "plan": {
    "activities": [
      {
        "type": "bar|market|restaurant|outing|transport|festival|special",
        "spending_level": "budget|balanced|comfortable|flexible",
        "suggested_quantity": N,
        "typical_cost_cents": N,
        "reasoning": "..."
      }
    ],
    "free_budget_cents": N
  },
  "context_used": {
    "destination": "...",
    "duration": "...",
    "budget": "...",
    "spending_style": "budget|balanced|comfortable|flexible",
    "priority_categories": ["..."] or null,
    ...other user answers...
  },
  "insights": ["...", "..."],
  "confidence": "low|medium|medium-high|high"
}
```

> **Regra de implementação (Worker)**: o Worker NUNCA repassa `total_planned_cents`,
> `margin_cents` ou `margin_percent` da IA. O Worker calcula deterministicamente:
> ```ts
> const totalPlannedCents = activities.reduce(
>   (total, a) => total + a.suggested_quantity * a.typical_cost_cents, 0
> );
> const marginCents = freeBudgetCents - totalPlannedCents;
> const marginPercent = Math.round((marginCents / freeBudgetCents) * 100);
> ```
> E **rejeita** qualquer resposta onde `typical_cost_cents <= 0`, `suggested_quantity <= 0`,
> ou `!Number.isInteger(typical_cost_cents)`.

#### Worker Implementation

O Worker já tem a infra de Groq (usado pelo `/ocr`). Dois novos endpoints:

```
POST /plan-copilot/analyze   → Step 2 (gera perguntas)
POST /plan-copilot/generate  → Step 4 (gera plano)
```

Ambos usam o mesmo pattern do `/ocr`:
- Rate limit por IP (classe `RL_AI`, 20 req/min)
- Nenhum dado armazenado (processado e descartado)
- Timeout: 15s → fallback
- Groq model: `llama-3.3-70b-versatile` (rápido, bom em JSON)
- `response_format: { type: 'json_object' }` para garantir JSON válido
- `temperature: 0.3` para respostas consistentes

#### Validação de Teste dos Prompts (2026-07-10)

Testado com 5 destinos reais (Amsterdam, Bangkok, Lisboa, Barcelona, London) contra a API Groq.
Script: `scripts/test-plan-copilot-prompts.mjs`. 6 iterações (v1→v5b).

**Resultado final (v5, com validador honesto):**

| Dimensão | Resultado | Nota |
|----------|-----------|------|
| Analyze (perguntas) | ✅ 5/5 | Perguntas relevantes, spending_level incluído, conhecimento do destino |
| Preço unitário | ✅ ~14/15 atividades na faixa | Preços realistas para todos os destinos testados |
| Aritmética (total) | ❌ 0/5 | LLM erra a soma em 100% dos casos → RESOLVER NO SERVIDOR |
| Estrutura JSON | ✅ 5/5 | Campos válidos, types corretos, spending_level presente |

**Preços validados contra dados reais 2026 (web research):**

| Destino | Bar | Market | Restaurant | Outing | Transport |
|---------|-----|--------|------------|--------|-----------|
| Amsterdam | €45 ✅ | €20 ✅ | €30 ✅ | €25 ✅ | €9 ✅ |
| Bangkok | $14 ✅ | $9 ✅ | $8 ✅ | $5 ✅ | $3 ✅ |
| Lisboa | €20 ✅ | €17 ~✅ | €15 ✅ | €8 ✅ | €7 ✅ |

Faixas esperadas baseadas em dados de Numbeo, SpendSanity, TravelGuideTip (2026).

**Decisões de arquitetura (conselho inline 10/07):**

1. **REMOVER `total_planned_cents` da resposta da IA** — o Worker calcula:
   ```ts
   const totalPlannedCents = activities.reduce(
     (total, a) => total + a.suggested_quantity * a.typical_cost_cents, 0
   );
   ```
   E rejeita respostas com `typical_cost_cents <= 0` ou `suggested_quantity <= 0`.

2. **Spending level é pergunta OBRIGATÓRIA** — primeira pergunta da IA, 4 níveis:
   - Budget (economizar ao máximo)
   - Balanced (equilíbrio — padrão selecionado)
   - Comfortable (comer fora, locais melhores)
   - Flexible (sem muita limitação)
   Seguido opcionalmente de "Onde quer gastar mais?" (multi-select).

3. **Divisão IA/Client para enriquecimento** — a IA retorna APENAS:
   `{type, spending_level, suggested_quantity, typical_cost_cents, reasoning}`
   O CLIENT enriquece com `{includes, usually_not_included, expected_min, expected_max,
   cost_scope, assumption}` via LOOKUP TABLE determinística indexada por
   `(type × spending_level × destination_cluster)`.

4. **Lookup table por destination_cluster** — 6 clusters:
   - `expensive_european`: Amsterdam, London, Paris, Zurique, Oslo, Copenhague
   - `mid_european`: Barcelona, Lisboa, Berlin, Praga, Budapeste, Roma, Atenas
   - `cheap_asian`: Bangkok, Hanoi, Bali, Kuala Lumpur, Ho Chi Minh, Phnom Penh
   - `expensive_asian`: Tokyo, Singapura, Hong Kong, Seoul, Taipei
   - `north_america`: NYC, LA, Toronto, Chicago, San Francisco, Vancouver
   - `latin_america`: CDMX, Buenos Aires, São Paulo, Lima, Bogotá, Santiago
   Fallback: `mid_european`.
   _(Americas splitado em 2 clusters porque NYC e CDMX têm preços incompatíveis.)_

5. **Disclosure progressivo na UI** — para cada atividade:
   - **Visível**: valor + 1 frase do que cobre + faixa esperada
   - **Ao tap**: detalhes completos (includes, not_included, como chegamos ao valor)
   Exemplo: "Noite em bar · €45 · 3-5 drinks, possível snack e entrada · Faixa: €40-55"
   Ao tap: "Cocktails e entrada de club podem ultrapassar esta estimativa"

6. **Orçamento deve limitar o estilo, não falsificar preços** — se o budget não
   comporta "comfortable", a IA deve dizer isso e sugerir alternativas, não baixar
   os preços artificialmente abaixo da realidade local.

**JSON expandido (IA + Client):**
```ts
// O que a IA retorna
interface AIPlanActivity {
  type: 'bar' | 'market' | 'restaurant' | 'outing' | 'transport' | 'festival' | 'special';
  spending_level: 'budget' | 'balanced' | 'comfortable' | 'flexible';
  suggested_quantity: number;
  typical_cost_cents: number;  // FULL occasion per person, in cents
  reasoning: string;           // WHY this price for this destination
}

// O que o Client adiciona via lookup table
interface EnrichedPlanActivity extends AIPlanActivity {
  expected_min_cost_cents: number;
  expected_max_cost_cents: number;
  cost_scope: 'per_person_per_meal' | 'per_person_per_night' | 'per_person_per_day' | 'per_shopping_trip';
  includes: string[];            // "prato principal, bebida simples"
  usually_not_included: string[];  // "cocktails, entrada e sobremesa"
  assumption: string;            // "Refeição casual em restaurante de preço médio"
}
```

#### Lookup Table — Enrichment Data (Client-Side)

A lookup table é indexada por `(destination_cluster, activity_type, spending_level)`.
O Client usa esta tabela para enriquecer cada atividade retornada pela IA com
`includes`, `usually_not_included`, `expected_min/max`, `cost_scope` e `assumption`.

**Todos os valores em centavos da moeda local do cluster.**

##### Destination Clusters

| Cluster | Cidades exemplo | Moeda ref. |
|---------|----------------|-----------|
| `expensive_european` | Amsterdam, London, Paris, Zurique, Oslo, Copenhague | EUR/GBP |
| `mid_european` | Barcelona, Lisboa, Berlin, Praga, Budapeste, Roma, Atenas | EUR |
| `cheap_asian` | Bangkok, Hanoi, Bali, Kuala Lumpur, Ho Chi Minh, Phnom Penh | USD |
| `expensive_asian` | Tokyo, Singapura, Hong Kong, Seoul, Taipei | USD |
| `north_america` | NYC, LA, Toronto, Chicago, San Francisco, Vancouver | USD |
| `latin_america` | CDMX, Buenos Aires, São Paulo, Lima, Bogotá, Santiago | USD |

Fallback quando destino não mapeado: `mid_european`.

> **Nota sobre moedas:** A tabela usa a moeda de referência do cluster para facilitar manutenção.
> A conversão para a moeda da viagem do usuário é feita pelo Client via taxa de câmbio do momento.
> As cidades com moeda diferente da referência (ex: London em GBP dentro de expensive_european)
> são armazenadas na moeda local real — o Client sabe a moeda de cada cidade.

---

##### `expensive_european` (Amsterdam, London, Paris, Zurique, Oslo)

Fontes: holland-explorer.com (2026), londonwebcam.co.uk (2026), bitterzoet.com (2026), Numbeo Jul 2026.

**Bar (cost_scope: per_person_per_night)**

| Level | min | max | includes | usually_not_included | assumption |
|-------|----:|----:|----------|---------------------|------------|
| budget | 2500 | 3500 | 2-3 cervejas ou bebidas simples | comida, entrada de club, cocktails | Pub ou bar tranquilo, sem noite longa |
| balanced | 4000 | 5500 | 3-5 drinks, possível snack ou petisco | cocktails premium, entrada de club, táxi | Noite em bar ou pub, preço médio |
| comfortable | 5500 | 8000 | cocktails, comida de bar, possível entrada | club premium, bottle service, transporte noturno | Bar/cocktail bar, com food e possível cover |
| flexible | 8000 | 15000 | drinks premium, comida, entrada, transporte | bottle service, VIP areas | Noite longa, venues premium, sem limite estrito |

**Market (cost_scope: per_shopping_trip)**

| Level | min | max | includes | usually_not_included | assumption |
|-------|----:|----:|----------|---------------------|------------|
| budget | 1500 | 2200 | pão, arroz, ovos, frango, frutas, vegetais básicos | queijos importados, vinhos, produtos premium | Compra básica para 1-2 dias, marcas locais |
| balanced | 2000 | 2800 | staples + alguns prontos, café, snacks | produtos gourmet, vinhos caros | Compra normal para 1-2 dias, com conveniência |
| comfortable | 2500 | 3500 | ingredientes de qualidade, queijos, vinhos simples | orgânicos premium, trufas, ingredientes raros | Compra boa com ingredientes para cozinhar bem |
| flexible | 3500 | 5500 | ingredientes premium, importados, vinhos | marcas ultra-premium | Sem restrição de orçamento no mercado |

**Restaurant (cost_scope: per_person_per_meal)**

| Level | min | max | includes | usually_not_included | assumption |
|-------|----:|----:|----------|---------------------|------------|
| budget | 1200 | 2000 | takeaway, fast casual, meal deal ou pub econômico | bebida, sobremesa, entrada | Refeição rápida ou pub simples |
| balanced | 2500 | 4000 | restaurante casual, prato principal, possível bebida | entrada e sobremesa juntos, cocktails | Refeição casual sentada, preço médio |
| comfortable | 4000 | 6000 | restaurante melhor, bebida, possível entrada ou sobremesa | menu degustação, vinhos premium | Restaurante bom, com complementos |
| flexible | 6000 | 12000 | restaurante premium, menu completo, drinks | Michelin, vinhos raríssimos | Jantar especial, sem preocupação com preço |

**Outing (cost_scope: per_person_per_day)**

| Level | min | max | includes | usually_not_included | assumption |
|-------|----:|----:|----------|---------------------|------------|
| budget | 800 | 1500 | atrações gratuitas, parques, caminhada | museus pagos, tours, experiências | Passeios gratuitos e exploração a pé |
| balanced | 1800 | 3000 | museu ou atração + transporte até o local | tours privados, experiências premium | Museu ou atração principal com deslocamento |
| comfortable | 3000 | 5000 | atração + tour guiado ou experiência | VIP, skip-the-line premium | Experiência completa com guia ou tour |
| flexible | 5000 | 10000 | experiências premium, tours privados | charter, helicóptero | Sem limitação, experiências top |

**Transport (cost_scope: per_person_per_day)**

| Level | min | max | includes | usually_not_included | assumption |
|-------|----:|----:|----------|---------------------|------------|
| budget | 500 | 750 | ônibus/tram, caminhar bastante | metrô em horário de pico, táxi | Somente ônibus + muita caminhada |
| balanced | 750 | 1000 | metro/tram/ônibus ilimitado (daily cap) | táxi, Uber, bicicleta alugada | Transporte público misto, dia inteiro |
| comfortable | 1000 | 1800 | transporte público + 1-2 Uber/táxi curtos | táxi para tudo, transfers privados | Público + conveniência quando necessário |
| flexible | 1800 | 3500 | táxi/Uber frequente, sem restrição | transfer privado, limusine | Táxi quando quiser, conforto total |

---

##### `mid_european` (Barcelona, Lisboa, Berlin, Praga, Budapeste)

Fontes: numbeo.com Jul 2026, gezikolik.net (2026), spaininspired.com (2025), thetraveler.org (2025).

**Bar (cost_scope: per_person_per_night)**

| Level | min | max | includes | usually_not_included | assumption |
|-------|----:|----:|----------|---------------------|------------|
| budget | 1500 | 2500 | 2-3 cervejas ou cañas | comida, cocktails, entrada | Bar simples, cervejas locais |
| balanced | 2500 | 4000 | 3-5 drinks, possível tapas/petisco | cocktails premium, entrada de club | Noite em bar local, preço médio |
| comfortable | 4000 | 6000 | cocktails, tapas, possível entrada | balada premium, bottle service | Bar/cocktail bar com food |
| flexible | 6000 | 10000 | drinks premium, comida, entrada, transporte | VIP | Noite longa, sem limite |

**Market (cost_scope: per_shopping_trip)**

| Level | min | max | includes | usually_not_included | assumption |
|-------|----:|----:|----------|---------------------|------------|
| budget | 1000 | 1800 | pão, arroz, ovos, frango, frutas, vegetais | queijos importados, vinhos | Compra básica para 1-2 dias |
| balanced | 1500 | 2500 | staples + prontos, café, snacks | produtos gourmet | Compra normal para 1-2 dias |
| comfortable | 2000 | 3200 | ingredientes de qualidade, vinho simples | orgânicos premium | Compra boa |
| flexible | 3000 | 4500 | ingredientes premium, importados | ultra-premium | Sem restrição |

**Restaurant (cost_scope: per_person_per_meal)**

| Level | min | max | includes | usually_not_included | assumption |
|-------|----:|----:|----------|---------------------|------------|
| budget | 800 | 1500 | menú del día, fast casual, kebab | bebida, sobremesa | Refeição econômica |
| balanced | 1500 | 2800 | restaurante casual, prato + bebida | entrada e sobremesa | Refeição sentada, preço acessível |
| comfortable | 2800 | 4500 | restaurante bom, bebida, possível entrada | degustação, vinhos premium | Jantar em restaurante de qualidade |
| flexible | 4500 | 8000 | restaurante top, menu completo | Michelin | Sem preocupação com preço |

**Outing (cost_scope: per_person_per_day)**

| Level | min | max | includes | usually_not_included | assumption |
|-------|----:|----:|----------|---------------------|------------|
| budget | 500 | 1200 | atrações gratuitas, praias, caminhada | museus pagos, tours | Exploração gratuita |
| balanced | 1200 | 2200 | museu ou atração + transporte | tours privados | Museu ou atração com deslocamento |
| comfortable | 2200 | 3500 | atração + tour ou experiência | VIP | Experiência completa |
| flexible | 3500 | 7000 | experiências premium | charter | Sem limitação |

**Transport (cost_scope: per_person_per_day)**

| Level | min | max | includes | usually_not_included | assumption |
|-------|----:|----:|----------|---------------------|------------|
| budget | 300 | 500 | ônibus/tram, caminhar bastante | metrô frequente, táxi | Ônibus + caminhada |
| balanced | 500 | 800 | metro/tram/ônibus (T-Casual ou similar) | táxi, Uber | Transporte público dia inteiro |
| comfortable | 800 | 1500 | público + 1-2 táxi/Uber | táxi frequente | Público + conveniência |
| flexible | 1500 | 3000 | táxi/Uber frequente | transfer privado | Conforto total |

---

##### `cheap_asian` (Bangkok, Hanoi, Bali, KL) — valores em USD cents

Fontes: thatbangkoklife.com (2026), offpaththailand.com (2026), everycity.guide (2026), Numbeo Jul 2026.

**Bar (cost_scope: per_person_per_night)**

| Level | min | max | includes | usually_not_included | assumption |
|-------|----:|----:|----------|---------------------|------------|
| budget | 500 | 1000 | 2-3 cervejas locais em bar simples | cocktails, rooftop, comida | Bar local, cervejas baratas |
| balanced | 1000 | 1800 | 3-5 drinks, possível petisco | cocktails em rooftop, club | Bar tourist-area ou local melhor |
| comfortable | 1800 | 3000 | cocktails, comida, bar melhor | rooftop premium, bottle service | Bar/cocktail bar com food |
| flexible | 3000 | 6000 | rooftop bar, cocktails premium | bottle service VIP | Noite premium, sem limite |

**Market (cost_scope: per_shopping_trip)**

| Level | min | max | includes | usually_not_included | assumption |
|-------|----:|----:|----------|---------------------|------------|
| budget | 400 | 800 | arroz, ovos, vegetais, frutas locais | importados, produtos ocidentais | Compra básica em mercado local |
| balanced | 700 | 1200 | staples + prontos, snacks, café | queijos, vinhos, orgânicos | Compra normal, mix local + conveniência |
| comfortable | 1000 | 1800 | ingredientes de qualidade, importados | orgânicos premium | Supermercado bom (Tops, Big C melhor) |
| flexible | 1500 | 3000 | qualquer coisa, Villa Market | ultra-premium | Sem restrição |

**Restaurant (cost_scope: per_person_per_meal)**

| Level | min | max | includes | usually_not_included | assumption |
|-------|----:|----:|----------|---------------------|------------|
| budget | 200 | 500 | street food ou food court | bebida especial, sobremesa | Pad thai, noodle soup, rice & curry |
| balanced | 500 | 1000 | restaurante local, prato + bebida | restaurante ocidental | Refeição sentada em local restaurant |
| comfortable | 1000 | 1800 | restaurante melhor, bebida, talvez sobremesa | fine dining | Restaurante casual internacional |
| flexible | 1800 | 4000 | restaurante premium, menu completo | Michelin, degustação | Sem preocupação |

**Outing (cost_scope: per_person_per_day)**

| Level | min | max | includes | usually_not_included | assumption |
|-------|----:|----:|----------|---------------------|------------|
| budget | 200 | 500 | templos gratuitos, mercados, caminhada | entradas pagas, tours | Exploração gratuita |
| balanced | 500 | 1200 | templo pago ou atração + transporte | tours privados | Atração principal com deslocamento |
| comfortable | 1200 | 2500 | tour guiado, experiência | VIP, barco privado | Experiência completa |
| flexible | 2500 | 5000 | experiências premium, tours privados | charter | Sem limite |

**Transport (cost_scope: per_person_per_day)**

| Level | min | max | includes | usually_not_included | assumption |
|-------|----:|----:|----------|---------------------|------------|
| budget | 100 | 300 | BTS/MRT + ônibus, caminhar | táxi, Grab | Transporte público somente |
| balanced | 250 | 500 | BTS/MRT + 1-2 Grab curtos | Grab frequente | Público + Grab quando necessário |
| comfortable | 500 | 1000 | Grab frequente, BTS/MRT | Grab exclusivo | Mix confortável |
| flexible | 1000 | 2500 | Grab/táxi para tudo | transfer privado | Conforto total, sem transporte público |

---

##### `expensive_asian` (Tokyo, Singapura, Hong Kong) — valores em USD cents

Estimativas baseadas em Numbeo Jul 2026 + budget travel guides.

**Bar** | budget: 1500-2500 | balanced: 2500-4500 | comfortable: 4500-8000 | flexible: 8000-15000 |
**Market** | budget: 800-1500 | balanced: 1200-2200 | comfortable: 2000-3000 | flexible: 3000-5000 |
**Restaurant** | budget: 600-1200 | balanced: 1200-2500 | comfortable: 2500-5000 | flexible: 5000-12000 |
**Outing** | budget: 500-1200 | balanced: 1200-2500 | comfortable: 2500-4500 | flexible: 4500-10000 |
**Transport** | budget: 400-800 | balanced: 700-1200 | comfortable: 1000-2000 | flexible: 2000-4000 |

_(Includes/not_included seguem o mesmo padrão dos clusters acima, adaptados ao contexto local.)_

---

##### `north_america` (NYC, LA, Toronto, Chicago) — valores em USD cents

Estimativas baseadas em Numbeo Jul 2026 + budget travel guides.

**Bar** | budget: 2000-3500 | balanced: 3500-5500 | comfortable: 5500-9000 | flexible: 9000-18000 |
**Market** | budget: 1500-2500 | balanced: 2000-3000 | comfortable: 2800-4000 | flexible: 4000-6000 |
**Restaurant** | budget: 1000-1800 | balanced: 1800-3500 | comfortable: 3500-6000 | flexible: 6000-15000 |
**Outing** | budget: 800-1500 | balanced: 1500-3000 | comfortable: 3000-5000 | flexible: 5000-12000 |
**Transport** | budget: 500-800 | balanced: 700-1200 | comfortable: 1200-2500 | flexible: 2500-5000 |

---

##### `latin_america` (CDMX, Buenos Aires, São Paulo, Lima) — valores em USD cents

Estimativas baseadas em Numbeo Jul 2026 + budget travel guides.

**Bar** | budget: 500-1000 | balanced: 1000-2000 | comfortable: 2000-3500 | flexible: 3500-7000 |
**Market** | budget: 400-800 | balanced: 700-1200 | comfortable: 1000-1800 | flexible: 1500-3000 |
**Restaurant** | budget: 300-700 | balanced: 700-1500 | comfortable: 1500-3000 | flexible: 3000-6000 |
**Outing** | budget: 300-800 | balanced: 800-1500 | comfortable: 1500-2500 | flexible: 2500-5000 |
**Transport** | budget: 100-300 | balanced: 250-500 | comfortable: 500-1200 | flexible: 1200-2500 |

---

##### Implementação TypeScript

A lookup table será um módulo TypeScript importável (`src/domain/plan-copilot/enrichment-lookup.ts`):

```ts
type DestinationCluster = 
  | 'expensive_european' | 'mid_european' 
  | 'cheap_asian' | 'expensive_asian' 
  | 'north_america' | 'latin_america';

type ActivityType = 'bar' | 'market' | 'restaurant' | 'outing' | 'transport';
type SpendingLevel = 'budget' | 'balanced' | 'comfortable' | 'flexible';

interface EnrichmentData {
  expected_min_cost_cents: number;
  expected_max_cost_cents: number;
  cost_scope: string;
  includes: string[];
  usually_not_included: string[];
  assumption: string;
}

const ENRICHMENT_TABLE: Record<
  DestinationCluster,
  Record<ActivityType, Record<SpendingLevel, EnrichmentData>>
> = { /* data from tables above */ };

function getClusterForCity(city: string): DestinationCluster { /* mapping */ }
function enrichActivity(activity: AIPlanActivity, cluster: DestinationCluster): EnrichedPlanActivity { /* lookup + merge */ }
```

##### Manutenção da Tabela

- **Atualização**: revisão trimestral dos valores usando Numbeo + web research
- **Novas cidades**: adicionar ao mapping de clusters; se não se encaixar, criar novo cluster
- **i18n**: `includes` e `usually_not_included` são keys de tradução, não strings hardcoded
- **Override por cidade**: se uma cidade específica divergir muito do cluster (ex: Oslo vs Amsterdam),
  permitir override por cidade que sobrescreve os valores do cluster

---

#### Integração: Onboarding + Planner

**No Onboarding:**
Após o passo de atividades (DEC-074 estendido pela Fase 1):
- Se online: "Quer que o copiloto monte seu plano? [Sim] [Prefiro manual]"
- Se "Sim": disclosure → analyze → perguntas → respostas → generate → resultado
- Se offline ou "Manual": plano automático da Fase 1

**No Planner:**
Dois modos de operação — toggle no header:

```
[Modo manual]  [🤖 Modo assistido]
```

- **Manual:** [-]/[+] como hoje, zero mudança
- **Assistido:** mostra botão "Gerar plano com copiloto" que inicia o mesmo flow (analyze → perguntas → generate → resultado → aplicar/ajustar)

---

### Fase 3 — Mid-Trip Re-plan (COM IA) · ~4h

**Conceito:** No Planner, botão "Refazer com copiloto" que re-envia o contexto atual (com spending patterns) e propõe um novo plano.

#### Botão no Planner

```
┌─────────────────────────────────────────────────────┐
│  Planejador · Amsterdam                              │
│                                                      │
│  [Modo manual]  [🤖 Modo assistido]                  │
│                                                      │
│  (se modo manual: [-] [+] como hoje)                 │
│  (se modo assistido: "Refazer com copiloto")         │
└─────────────────────────────────────────────────────┘
```

#### Input Enriquecido para Mid-Trip

```json
{
  "destination": "Amsterdam, Netherlands",
  "remaining_days": 6,
  "remaining_budget_cents": 42000,
  "currency": "EUR",
  "activities": ["bar", "market", "restaurant", "outing"],
  "spending_style": "balanced",
  "priority_categories": null,
  "current_spending": {
    "bar": { "occasions_done": 3, "avg_cost_cents": 4200, "total_spent_cents": 12600 },
    "market": { "occasions_done": 4, "avg_cost_cents": 1900, "total_spent_cents": 7600 },
    "restaurant": { "occasions_done": 1, "avg_cost_cents": 3500, "total_spent_cents": 3500 },
    "outing": { "occasions_done": 1, "avg_cost_cents": 2200, "total_spent_cents": 2200 }
  },
  "traveler_context": "staying_with_family"
}
```

**Herança de spending_level:** O re-plan herda o `spending_style` e `priority_categories`
do plano original. A IA pode sugerir mudanças de nível se os gastos reais mostrarem que o
usuário está gastando consistentemente acima ou abaixo do planejado (ex: "Seus gastos em bar
estão acima do nível equilibrado — posso ajustar para confortável nessa categoria?").

**A IA agora tem dados REAIS** do usuário — os custos médios reais substituem estimativas genéricas. O re-plan é significativamente mais preciso que o plano inicial.

#### Resultado: Diff do Plano

```
┌─────────────────────────────────────────────────────┐
│  🤖 Plano atualizado (6 dias restantes, €420)        │
│                                                      │
│  🍺 Bar:    antes 4 → agora 2  (já fez 3, média €42)│
│  🛒 Mercado: antes 7 → agora 4  (já fez 4, média €19│
│  🍽️ Rest.:  antes 3 → agora 2  (já fez 1, média €35)│
│  🏛️ Passeio: antes 2 → agora 1  (já fez 1, média €22│
│                                                      │
│  💡 Com base nos seus gastos reais, ajustei as        │
│     quantidades para caber nos €420 restantes.        │
│                                                      │
│  [✓ Aplicar] [Manter plano atual] [Ajustar manual]   │
└─────────────────────────────────────────────────────┘
```

---

## Decisão sobre G1: Custo Típico no Counter

### Validado pelo Council (unânime)

**Substituir "X feitas" por "~€X/{unidade}"** no sublabel dos planned OccasionCounters.

**Razões:**
- O label principal já mostra "N restantes de {nome}" — o remaining está coberto
- "X feitas" é redundante e backward-looking
- O custo fecha a decisão: "3 restantes / ~€35" = tudo que o usuário precisa
- O marketing promete o custo — o app deve entregar
- O done count continua acessível ao tocar o counter (abre lista filtrada)

**Implementação:**
- Em `DashboardCards.tsx`: sublabel dos planned counters muda de `t('dashboard.occasion_done', { count })` para `~${formatMoney(profile.typicalValueCents, currency)}/${unidade}`
- O `unidade` é derivado do nome do perfil (ex: "noite" para bar, "ida" para mercado)
- Gate: mostrar custo quando `typicalValueCents > 0` (sempre verdadeiro com presets)

---

## Decisão sobre "Troca Inteligente" (G4)

### Validado pelo Council

Implementar como **insight card no carousel de insights** (não no carousel do Amigo Sincero).

**Razões:**
- O Amigo Sincero é voz/emoção; a Troca Inteligente é informação/cálculo
- O carousel de insights é onde vivem leituras factuais (DEC-317)
- Tom casual com CTA: "💡 Troca possível: 1 {{from}} a menos = {{gain}} {{to}} a mais. Ajustar?"
- O tap leva ao Planner

---

## Resumo de Estimativas

| Fase | Escopo | Tempo (raw) | Tier 3 |
|------|--------|:-----------:|:------:|
| G1: Custo no counter | Sublabel → custo típico | 30min | 10min |
| G4: Troca Inteligente | Insight card + domain fn | 4h | 1.3h |
| Fase 1: Smart Onboarding | Chips → plano automático | 6h | 2h |
| Fase 2: AI Copilot Planning | Worker 2 endpoints + UX perguntas + disclosure + resultado | 12h | 4h |
| Fase 3: Mid-trip Re-plan | Botão "refazer" + diff UX | 4h | 1.3h |
| G2: Tom coloquial | Strings i18n | 2h | 40min |
| **Total** | | **28.5h** | **~9.5h** |

---

## Riscos e Mitigações

| Risco | Probabilidade | Impacto | Mitigação |
|-------|:------------:|:-------:|-----------|
| IA erra preços do destino | Média | Médio | Frame como "estimativa"; user sempre pode editar; learning engine corrige com dados reais |
| Offline no onboarding | Alta (viajando) | Alto | Fase 1 funciona sem IA; Fase 2 é fallback graceful |
| Privacy concern | Baixa | Alto | Disclosure explícito; opt-in; dados não armazenados; provedor não treina |
| Auto-plan com assumptions erradas | Média | Médio | "Revertível" (remover plano); distribuição conservadora; frame como "sugestão" |
| Latência da IA no onboarding | Baixa (Groq ~1-2s) | Baixo | Loading state com "Analisando sua viagem..."; timeout 10s → fallback para Fase 1 |

---

## Próximos Passos

1. **Implementar G1** (30min) — custo típico no sublabel
2. **Implementar Fase 1** (6h) — smart onboarding sem IA
3. **Implementar G4** (4h) — insight de troca inteligente
4. ~~**Projetar prompts para Fase 2**~~ ✅ Concluído (v5, 6 iterações, 3 destinos validados)
5. ~~**Lookup table com dados reais**~~ ✅ Concluído (6 clusters × 5 types × 4 levels, fontes 2026)
6. **Implementar Fase 2** (12h) — AI Copilot: Worker endpoints + lookup table module + UX perguntas com spending_style + disclosure progressivo + integração onboarding + planner
7. **Implementar Fase 3** (4h) — mid-trip re-plan com herança de spending_level e dados reais
