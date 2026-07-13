# Design — Itinerário da Viagem: a feature de logística do TripPilot

> **Data**: 2026-07-10
> **Contexto**: Julio quer uma feature onde a IA conversa com o user para montar o itinerário dia a dia (cidades, transportes, horários), que se conecta ao budget mas vive num espaço SEPARADO, sem poluir o app. O itinerário sabe "onde estou agora" e "o que vem depois", e os gastos se vinculam à etapa da viagem.

---

## §1 — O Problema que resolve

**Hoje**: O TripPilot é um copiloto FINANCEIRO. Sabe quanto gastar, mas não sabe ONDE você está, PRA ONDE vai, nem QUANDO. O viajante precisa de outro lugar (Google Calendar, planilha, email) para saber "meu trem é às 09:23" ou "chego em Zurique 10:25".

**Depois**: O TripPilot sabe o ROTEIRO COMPLETO. "Você está em Lucerna. Às 09:35 pega o trem para Zurique. Chega 10:25. Almoço + Lindt às 12h. Às 18:30 voa pra Madrid. Budget do dia: R$180." Tudo num lugar só.

**O diferencial**: Nenhum app de BUDGET faz isso. E nenhum app de ITINERÁRIO (TripIt, Wanderlog) tem budget inteligente. O TripPilot seria o PRIMEIRO que une "onde vou + quanto tenho".

---



## §2 — Princípios de design



### P1: Separação visual clara — o itinerário NÃO polui o fluxo de budget

O itinerário é uma **camada paralela**, não misturada com gastos/planner/saída. Pense em duas "lentes" do app:

- **Lente financeira** (o que já existe): Dashboard → Gastos → Planner → Simulador
- **Lente logística** (nova): Itinerário → "Onde estou" → "O que vem" → "Próximo transporte"

Elas se CONECTAM (cada etapa do itinerário tem budget associado), mas vivem em espaços diferentes na UI.

### P2: Complementa, não substitui — funciona com 0 itinerário preenchido

Se o user nunca preencher itinerário, o app funciona EXATAMENTE como hoje. O itinerário é um ADDON. Nenhuma tela existente quebra.

### P3: IA constrói, user confirma — criação por conversa

O itinerário não é preenchido manualmente campo a campo. A IA FAZ PERGUNTAS e constrói. O user confirma/ajusta. Mesmo modelo mental do DEC-492 (AI Copilot Planning).

### P4: "Agora / Próximo" é um card, não uma tela

A informação mais valiosa ("onde estou e o que vem") aparece como um CARD no Home, não exige navegar para outra tela. Tap no card → tela completa do itinerário.

---



## §3 — O modelo de dados



### Entidade: `ItineraryLeg` (etapa do itinerário)

```typescript
interface ItineraryLeg {
  id: string;
  tripId: string;
  
  // Sequência
  order: number;
  
  // Onde
  cityName: string;              // "Lucerna"
  countryCode?: string;          // "CH"
  
  // Quando
  arrivalDate: string;           // "2026-08-02" (ISO)
  arrivalTime?: string;          // "18:05" (opcional)
  departureDate: string;         // "2026-08-04"
  departureTime?: string;        // "09:35"
  
  // Como chega
  arrivalTransport?: {
    type: 'flight' | 'train' | 'bus' | 'car' | 'ferry' | 'other';
    company?: string;            // "FlixTrain"
    route?: string;              // "Freiburg → Luzern"
    bookingStatus: 'purchased' | 'booked' | 'priced' | 'estimated' | 'none';
    cost?: { amount: number; currency: string };
    isPrepaid: boolean;
    reference?: string;          // link ou código de reserva
    notes?: string;
  };
  
  // Onde dorme
  accommodation?: {
    name: string;                // "Capsule Hotel Lucerne"
    type: 'hotel' | 'hostel' | 'apartment' | 'friend' | 'airbnb' | 'camping' | 'other';
    bookingStatus: 'purchased' | 'booked' | 'priced' | 'estimated' | 'none';
    cost?: { amount: number; currency: string };
    isPrepaid: boolean;
    nights: number;
    reference?: string;
    notes?: string;              // "2 diárias, hotel cápsula"
  };
  
  // Budget dessa etapa
  dailyBudget?: { amount: number; currency: string };
  budgetPremise?: string;        // "Suíça cara: fast food + mercado, sem restaurante"
  
  // Contexto
  companions?: string[];         // ["Jessika", "Farfan"]
  dayType?: 'full' | 'transit' | 'festival' | 'rest' | 'day_trip';
  highlights?: string[];         // ["Lindt Chocolate 12h", "Jules Verne bar"]
  
  // Vínculo com o modelo existente
  linkedPhaseId?: string;        // Liga à fase do budget
  linkedSubDestinationId?: string; // Liga ao sub-destino existente
}
```



### Relação com o modelo existente

```
Trip
 ├── Phase (Trecho) ─── BudgetPool ─── "quanto posso gastar"
 │    └── PlannedOccurrence (Evento) ─── "Tomorrowland, Giardino"
 │    └── ScenarioPlan ─── "15 bares × €30"
 │
 └── Itinerary (NOVO) ─── ItineraryLeg[] ─── "onde, quando, como"
      └── links → Phase (cada leg pertence a uma fase)
      └── links → PlannedOccurrence (highlights viram eventos)
```

**A separação é clara**:

- `Phase` + `BudgetPool` + `ScenarioPlan` = o DINHEIRO
- `ItineraryLeg` = a LOGÍSTICA
- Eles se CONECTAM por `linkedPhaseId` (cada leg está dentro de uma fase)
- Mas vivem em tabelas diferentes, telas diferentes, fluxos diferentes

---



## §4 — O fluxo com IA: criação do itinerário por conversa



### 4.1 Entrada no fluxo

**Onde**: "Planejar" tab → botão "Criar itinerário" (ou durante o onboarding expandido)

**Requisito**: Já ter uma viagem criada com datas (não precisa ter fases prontas — a IA pode sugerir as fases a partir do itinerário)

### 4.2 A conversa (fluxo estruturado com chips)

```
┌─────────────────────────────────────────────────────────┐
│  🤖 Vou te ajudar a montar o roteiro da viagem.         │
│     Me conta: quais cidades você vai visitar?           │
│                                                          │
│  [Chips de texto livre]                                  │
│  User: "Veneza, Ljubljana, Trieste, Verona, Bruxelas,  │
│         Amsterdam, Berlin, Freiburg, Lucerna, Zurique"  │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│  🤖 Boa! 10 cidades. Qual a ordem e quanto tempo em    │
│     cada uma? (pode ser aproximado)                      │
│                                                          │
│  [Sugestão: arrasto/reordeno as cidades]                │
│  User: "Veneza 2 dias, Ljubljana 2, Trieste 1 dia,     │
│         Verona 1 dia, Bruxelas 7 (Tomorrowland no      │
│         meio), Amsterdam 2, Berlin 2, Freiburg 1,      │
│         Lucerna 2, Zurique 1"                           │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│  🤖 Entendi! Agora, sobre como você se desloca entre   │
│     as cidades — já comprou algum transporte?           │
│                                                          │
│  [Chips: Sim, alguns / Sim, todos / Ainda não]          │
│  User: "Sim, alguns"                                    │
│                                                          │
│  🤖 Me conta quais (pode colar texto, mandar fotos     │
│     de confirmação, ou falar um por um):                │
│                                                          │
│  User: "Burgos→Madrid ALSA €11,42 / Madrid→Veneza     │
│         Iberia R$379 / GoOpti Mestre→Ljubljana €34     │
│         chegada 18:30 / FlixBus Ljubljana→Trieste     │
│         chegada 09:10..."                               │
│                                                          │
│  🤖 Perfeito. Capturei 18 transportes:                 │
│     [lista resumida]                                     │
│     Tá certo? [✅ Confirmar / ✏️ Ajustar]               │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│  🤖 Hospedagem — onde você vai dormir em cada cidade?   │
│                                                          │
│  [Chips: Hotel / Hostel / Amigo / Airbnb / Não sei]    │
│  User por cidade:                                        │
│  • Veneza: "Anda Venice Hostel, 15-17 e 19-21"         │
│  • Ljubljana: "casa do meu primo, grátis"              │
│  • Bruxelas: "BX Downtown Brussels"                     │
│  • ...                                                   │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│  🤖 Quase lá! Tem algum evento especial ou atividade   │
│     que já sabe? (festival, ingresso, tour...)          │
│                                                          │
│  User: "Tomorrowland 4 dias em Boom/Bruxelas,          │
│         Giardino Giusti em Verona €14,                  │
│         Lindt Chocolate em Zurique CHF 17"             │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│  🤖 Pronto! Montei seu itinerário:                      │
│                                                          │
│  📅 15 Jul — Chegada Veneza (voo Madrid→VCE)           │
│  📅 16 Jul — Veneza dia cheio                           │
│  📅 17 Jul — Veneza → Ljubljana (GoOpti 18:30)         │
│  ...                                                     │
│  📅 04 Ago — Zurique → Madrid (Air Europa 18:30)       │
│                                                          │
│  [👀 Ver completo] [✅ Salvar] [✏️ Ajustar]             │
└─────────────────────────────────────────────────────────┘
```



### 4.3 Princípios da conversa

1. **Perguntas em camadas** — começa amplo (cidades), vai detalhando (transportes, hospedagem, eventos)
2. **Aceita qualquer formato** — texto livre, lista, colado de outro lugar
3. **Confirma antes de salvar** — mostra o resumo, user valida
4. **Não exige completude** — se não sabe o transporte de uma cidade, pula. Pode completar depois.
5. **Conecta com o budget** — no final, sugere "quer que eu gere um plano de budget com base no roteiro?" (link para DEC-492)



### 4.4 Input alternativo: "Já tenho tudo organizado"

Para o caso do Julio (ou quem colou texto/planilha):

```
┌─────────────────────────────────────────────────────────┐
│  🤖 Como quer montar o itinerário?                      │
│                                                          │
│  [💬 Me pergunta passo a passo]                          │
│  [📋 Já tenho as informações — vou colar aqui]          │
│  [📷 Tenho prints/confirmações]                          │
└─────────────────────────────────────────────────────────┘
```

Se escolhe "já tenho": campo de texto grande onde cola o que tiver. A IA parseia e gera o itinerário. User confirma/ajusta.

---



## §5 — A UX: onde o itinerário aparece no app



### 5.1 Home — Card "Agora / Próximo" (NÃO polui)

O Home ganha UM card novo no topo (abaixo do hero "Livre hoje"), que só aparece SE o itinerário existir:

```
┌───────────────────────────────────────────┐
│  💰 Livre hoje: R$150                      │  ← Hero existente
├───────────────────────────────────────────┤
│  📍 Lucerna · Dia 19 de 21                │  ← Card de contexto (NOVO)
│  ⏭️ 09:35 Trem → Zürich (50 min)          │
│  🏠 Capsule Hotel (última noite)          │
│  [Ver agenda do dia →]                     │
└───────────────────────────────────────────┘
│  ... cards existentes (ocasiões,           │
│      insights, etc.) ...                   │
```

**Regras do card**:

- Se NÃO tem itinerário → card não aparece (app = como antes)
- Se tem itinerário mas hoje não tem nada agendado → "Dia livre em {cidade}"
- Se tem transporte → mostra o próximo com hora
- Tap → abre a tela completa do itinerário



### 5.2 Tela "Itinerário" — vista por dia (SEPARADA)

Acesso: tap no card Home OU aba "Mais" → "Itinerário da viagem"

```
┌───────────────────────────────────────────┐
│  ← Itinerário                    📅 Mapa  │
├───────────────────────────────────────────┤
│  ◄ 03 Ago ─── 04 AGO ─── fim ►          │  ← Scroll horizontal de dias
├───────────────────────────────────────────┤
│                                            │
│  📍 Lucerna → Zürich → Madrid → Burgos   │
│  Tipo: Dia de transição                   │
│                                            │
│  ──────────────────────────────────────── │
│                                            │
│  09:35  🚂 Trem Luzern → Zürich HB       │
│         50 min · ✅ Comprado (R$132)       │
│                                            │
│  10:25  📍 Chegada Zürich                  │
│         🔒 Locker XL na estação (CHF 12)  │
│                                            │
│  10:45  🚂 S-Bahn → Kilchberg             │
│         Lindt Home of Chocolate            │
│                                            │
│  12:00  🍫 Lindt (ingresso CHF 17)        │
│         ✅ Fechado                          │
│                                            │
│  14:00  🚂 S-Bahn → Zürich HB             │
│                                            │
│  15:00  🍸 Jules Verne (1 drink ~CHF 20)  │
│         Walk-in, sem reserva               │
│                                            │
│  17:00  🚂 S-Bahn → Flughafen             │
│                                            │
│  18:30  ✈️ Air Europa ZRH → MAD           │
│         ✅ Comprado · Chegada 20:55        │
│                                            │
│  22:30  🚌 ALSA Madrid → Burgos (~€23)    │
│         ⬜ Ainda não comprado              │
│                                            │
│  ──────────────────────────────────────── │
│                                            │
│  💰 Budget do dia                          │
│  Comida: R$160 (fast food + snack aero)   │
│  Transporte local: R$20                    │
│  Extras: CHF 37 (Lindt + drink)           │
│                                            │
│  💡 Zurique é cara. Mercado/take away      │
│     no almoço rende mais que restaurante.  │
│                                            │
└───────────────────────────────────────────┘
```



### 5.3 Onde NÃO aparece (para não poluir)

- **Dashboard financeiro** — intocado. Continua com hero + cards de ocasiões + insights
- **Planner** — intocado. Continua com [-] N [+] de perfis
- **Gastos** — intocado. Lista de transações como está
- **Simulador** — intocado. Mas PODE ler o contexto do itinerário para enrichment ("Você está em Zurique — café aqui custa ~CHF 5")
- **Saída** — intocada



### 5.4 A CONEXÃO sutil: gasto → etapa

Quando o user registra um gasto (QuickAdd), o app sabe automaticamente em qual `ItineraryLeg` ele está (pela data + cidade). Isso permite:

1. **Agrupamento automático** — "Gastos em Lucerna: €45 total"
2. **Budget por etapa** — "Você definiu R$200/dia em Lucerna. Já gastou R$120. Faltam R$80."
3. **Insight contextual** — "Em Lucerna você gastou 20% menos que o planejado. Legal!"

O vínculo é AUTOMÁTICO (por data/fase) — o user não precisa selecionar "estou na etapa X" a cada gasto.

---



## §6 — O paralelo com o que já existe


| Conceito existente | O que é                                  | Como se liga ao itinerário                                                                                    |
| ------------------ | ---------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| **Fase/Trecho**    | Período com budget                       | Cada `ItineraryLeg` pertence a uma fase. A IA pode CRIAR as fases a partir do itinerário.                     |
| **Sub-destino**    | PlannedOccurrence kind='sub_destination' | Um `ItineraryLeg` SUBSTITUI o sub-destino. Mais rico, mais completo. Migration path: sub-destinos viram legs. |
| **Evento**         | PlannedOccurrence com reserva            | Highlights de uma leg (Tomorrowland, Lindt) continuam como PlannedOccurrence vinculados à leg.                |
| **ScenarioPlan**   | Quantos bares/restaurantes/mercados      | O `dailyBudget` + `budgetPremise` da leg alimenta o planner. A IA pode gerar o plano POR CIDADE.              |




### A evolução natural:

1. **Hoje**: Viagem → Fases → Budget → Gastos
2. **Com itinerário**: Viagem → **Itinerário** (cidades/logística) → **gera** Fases → Budget por fase → Gastos com contexto

O itinerário vira a **FONTE** das fases — não o contrário. Se o user monta o roteiro primeiro, as fases se criam automaticamente a partir dele. Se prefere criar fases manualmente (como hoje), o itinerário é opcional.

---



## §7 — Como NÃO confundir / não poluir o app



### 7.1 Dois "modos" de uso, ambos válidos


| Modo                            | Quem usa                                       | Experiência                                           |
| ------------------------------- | ---------------------------------------------- | ----------------------------------------------------- |
| **Financeiro puro** (como hoje) | Quem só quer controlar gastos                  | App = exatamente como está. Zero itinerário.          |
| **Financeiro + Roteiro**        | Quem quer saber "onde/quando" além de "quanto" | Card no Home + tela de agenda. Budget funciona igual. |




### 7.2 O itinerário é OPT-IN, nunca forçado

- Não aparece no onboarding obrigatório
- Não polui nenhuma tela existente
- O card no Home SÓ aparece se criou itinerário
- Pode deletar o itinerário inteiro e o budget continua perfeito



### 7.3 Navegação limpa

```
Home
├── 💰 Hero "Livre hoje" .................. financeiro
├── 📍 Card contexto/próximo .............. itinerário (se existir)
├── 🎯 Carrossel de ocasiões .............. financeiro
├── 💡 Insights ........................... financeiro
└── ...

Tab "Mais"
├── 📋 Itinerário da viagem ............... entrada para a tela completa
├── 🗺️ Mapa de gastos .................... existente
├── 📊 Relatórios ......................... existente
└── ...
```

O itinerário vive em "Mais" (onde já existem Mapa, Diário, etc.) e projeta UM card no Home. Não adiciona tab. Não adiciona complexidade na navegação principal.

---



## §8 — Integração com o budget: o vínculo natural



### 8.1 De itinerário → budget (geração automática)

Ao criar o itinerário, a IA SUGERE:

- Criar fases com base nos blocos de cidades
- Gerar um plano de budget por fase (DEC-492 style)
- Definir típicos por cidade ("Zurique: almoço €18, Berlin: almoço €8")
- Marcar transportes prepaid (já pagos) como não-contáveis no livre diário

O user aceita ou ajusta. Nunca é silencioso.

### 8.2 De budget → itinerário (enriquecimento)

Quando o user registra gastos durante a viagem:

- O itinerário mostra "gastou X de Y planejado nesta cidade"
- O card de "Próximo" sabe que o transporte já foi pago (não mostra como gasto)
- Insight: "Em Amsterdam você gastou 15% menos que em Berlin — bom trabalho"



### 8.3 Gastos que o itinerário já sabe

Transportes e hospedagens no itinerário (com `isPrepaid: true`) são gastos que JÁ EXISTEM — não precisam ser re-registrados como transação. O app sabe: "voo Iberia R$379 já pago" sem que o user registre de novo.

Se `isPrepaid: false` (ainda vai pagar): quando pagar, pode converter em transação com 1 tap.

---



## §9 — Risco e mitigação: como não virar "mais uma coisa"


| Risco                                                    | Mitigação                                                                                            |
| -------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| "Mais uma feature que ninguém usa"                       | Opt-in total. Tela de Gastos/Planner/Saída intocadas.                                                |
| "Tela vazia se não preencher"                            | Card no Home SÓ aparece com itinerário. Sem itinerário = app idêntico a hoje.                        |
| "Confusão entre gasto e itinerário"                      | Gastos = tela de Gastos (como sempre). Itinerário = tela separada. Nunca se misturam visualmente.    |
| "Horário errado e user perde o trem"                     | Disclaimer claro: "horários são referência pessoal — confirme com a companhia". Não é fonte oficial. |
| "Duplicação: transporte está no itinerário E nos gastos" | Se `isPrepaid=true` no itinerário, NÃO cria transação automática. O user controla.                   |
| "Complexidade de manutenção durante a viagem"            | Edição rápida: tap na leg → editar campo. Não precisa re-rodar IA.                                   |


---



## §10 — Implementação em ondas



### Onda 1 — Modelo + IA conversacional (o core)

- Schema `ItineraryLeg` no Dexie
- Worker endpoint `POST /itinerary-copilot/build` (recebe contexto → retorna legs estruturadas)
- Tela de conversa para criar itinerário (mesmo padrão do AI Copilot Planning)
- CRUD básico de legs (editar/remover)



### Onda 2 — Display (card + tela)

- Card "Contexto/Próximo" no Home
- Tela completa de agenda por dia (`/itinerary`)
- Scroll de dias, timeline, informações de transporte



### Onda 3 — Integração com budget

- Link automático leg → phase
- `isPrepaid` flag + seção visual "Já pago"
- Budget por leg (sugestão da IA)
- Premissas visíveis no "De onde vem" do hero



### Onda 4 — Polish

- "Onde estou agora" baseado em GPS + data (auto-detecta a leg ativa)
- Notificação "Próximo transporte em 1h"
- Sharing: "Compartilhar meu roteiro" (link read-only, como o "acompanhe a viagem")
- Widget Android com próximo transporte

---



## §11 — Conclusão: por que isso faz sentido

1. **É o próximo passo natural** — O TripPilot já tem o "quanto", agora ganha o "onde/quando/como"
2. **Não compete com TripIt** — Não parseia emails automaticamente. É o USER que conta para a IA (ou cola texto). Muito mais simples e confiável.
3. **Reusa a infra** — Worker + Groq + schema Dexie + IndexedDB. Mesmo padrão do DEC-492.
4. **Diferencial competitivo** — "Monte seu roteiro + budget numa conversa com IA" → ninguém faz isso.
5. **Opt-in total** — Quem não quer, não vê. Zero regressão.
6. **Resolve o problema do Julio** — Abrir o app no dia 20/Jul e saber: "trem 09:23 para Verona, volta 18:27, budget R$130 para comida + €17 Giardino, pizza com amigos à noite em Mestre".

---



## §12 — Perguntas em aberto (para decidir)

1. **O itinerário gera fases automaticamente ou só sugere?**
  - Gera: user confirma → pronto
  - Sugere: user cria manualmente depois  
    
  Sugere, mas ja deixa pronto para o user confirmar e ja criar a fase.
2. **Sub-destinos existentes viram legs ou coexistem?**
  - Migration: legs substituem sub-destinos
  - Coexistência: ambos existem, legs são "mais ricos"  
    
  Substitui, mas vai ter que entender se n vai ter mais pontos para mudar, por exemplo na criação não tinha nada que gerava um automatico? se n melhor ainda, nunca usamos o subdestino direito..  

3. **O AI Copilot Planning (DEC-492) e o Itinerary Copilot são a MESMA conversa ou separados?**
  - Mesma: "Monte minha viagem" → roteiro + budget de uma vez
  - Separados: um para roteiro, outro para budget (mais simples, menos ambicioso)  
  sim, coisas separadas, um coida só do plano de budget, outro cuida só do roteiro, itinerario..  

4. **Prepaid no itinerário cria transação ou é só informativo?**
  - Cria: valor aparece no total de gastos da viagem (read-only, tag "pré-viagem")
  - Informativo: só aparece no itinerário e no "custo total" separado  
  informativo, só no itinerario.  

5. **Quando implementar?**
  - Antes da eurotrip (15/Jul) — apertado mas possível para Onda 1+2
  - Após a eurotrip — com calma, usando a experiência de campo para refinar  
    
  Antes da eurotrip.

