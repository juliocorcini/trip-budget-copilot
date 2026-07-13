# TripPilot — Orquestrador "Itinerary Polish" (fonte de verdade de execução)

> **Última atualização:** 2026-07-10 · **App:** 2.12.0-rc → 2.13.0-rc por gate
> **Status:** ⏳ AWAITING KICKOFF
> **Deadline:** 14/Jul/2026 (antes da viagem de 15/Jul)
>
> **Origem:** Council de evolução pós-wave "Itinerary Copilot". 15 features de polish e funcionalidade avançada para transformar o itinerário de "funcional" em "indispensável em campo".

---

## 0. Missão

O itinerário V1 está no ar (2.12.0-rc). O objetivo desta wave é:
1. **Visual — fazer o itinerário PARECER** vivo, não uma lista flat
2. **Contextual — trazer info pro momento certo** (premissa ao gastar, companions no split)
3. **Inteligente — conectar itinerário ao financeiro** (gasto por leg, deep links)
4. **Avançado — GPS, mapa, notificações, sharing**

**Implementar → testar → corrigir → só avança quando PERFEITO → deploy.**

**Vá para §14 para começar.**

---

## 1. Identidade & regras absolutas

1. SEM subagents / SEM Task tool. Tudo inline, nesta sessão.
2. NÃO peça permissão para avançar. Milestone done → testes verdes → next.
3. Código → inglês. UI → `t()` com pt-BR/en/es.
4. Domínio antes de UI, uma mudança por vez, teste junto com a mudança.
5. Terminal WSL: sempre `git --no-pager`, sempre `git commit -m`. Nunca pager.
6. Deploy via `bash scripts/deploy.sh`. Version bump nos 3 lugares ANTES.
7. ZERO impacto em telas existentes fora das que esta wave toca.
8. O itinerário continua OPT-IN (ÂNCORA-ITIN-1 da wave anterior).
9. NENHUMA feature nova altera o cálculo de livre/cofrinho/planner.

---

## 2. Não-negociáveis (ÂNCORA)

```
ÂNCORA-ITIN-1: Opt-in, zero impacto sem itinerário
ÂNCORA-ITIN-2: Card só com legs > 0
ÂNCORA-ITIN-3: Prepaid informativo (nunca cria transação)
ÂNCORA-POL-1: Nenhuma feature de polish altera cálculos financeiros
ÂNCORA-POL-2: GPS é opt-in, permission request explícita, fallback sem GPS funciona
ÂNCORA-POL-3: Notificações são opt-in, permission request explícita
ÂNCORA-POL-4: Companion no QuickAdd é SUGESTÃO (não override) — user pode remover
ÂNCORA-POL-5: Spent vs planned é READ-ONLY — visualização, nunca impacta os dados
```

---

## 3. Baseline

- **Version:** 2.12.0-rc
- **Tests:** 327 files / 3391 passed / 2 pre-existing failed
- **tsc:** 0 errors
- **Build:** OK
- **Itinerary V1:** Schema V14/V15, 5 domain functions, 5 UI components, 2 Worker endpoints

---

## 4. Arquivos-chave (ler antes de modificar)

| Área | Arquivo |
|------|---------|
| Itinerary Page | `src/features/itinerary/ItineraryPage.tsx` |
| Context Card | `src/features/itinerary/ItineraryContextCard.tsx` |
| Domain | `src/domain/itinerary/itinerary-domain.ts` |
| Entity type | `src/domain/types/itinerary-leg.ts` |
| Leg Form | `src/features/itinerary/LegFormSheet.tsx` |
| Copilot Flow | `src/features/itinerary/ItineraryCopilotFlow.tsx` |
| Dashboard | `src/features/dashboard/DashboardPage.tsx` |
| QuickAdd | `src/features/expenses/QuickAddSheet.tsx` |
| Map | `src/features/map/` ou `src/features/location/` |
| Router | `src/router.tsx` |

---

## 5. Change-set completo (16 features)

| ID | Feature | Esforço | Gate |
|----|---------|:-------:|:----:|
| P00 | **Conversational Flow** — IA pergunta sequencial (modo "Passo a passo") | ALTO | G1 |
| P01 | Color coding por tipo de dia (scroll + card + agenda) | BAIXO | G1 |
| P02 | Progress bar da viagem (barra macro: onde estou) | BAIXO | G1 |
| P03 | Timeline visual (barra vertical com nós, não lista flat) | MÉDIO | G1 |
| P04 | Swipe animado entre dias (transição lateral) | BAIXO | G1 |
| P05 | Budget premise contextual no QuickAdd | BAIXO | G2 |
| P06 | Companion-aware QuickAdd (pré-sugere participantes) | MÉDIO | G2 |
| P07 | Spent vs planned por leg (gasto vs budget em cada trecho) | MÉDIO | G2 |
| P08 | Quick notes por leg (notas pessoais, lembretes, checklist) | BAIXO | G2 |
| P09 | Card expandido no Home (tap expande com timeline resumida) | MÉDIO | G3 |
| P10 | Booking checklist (view "o que falta comprar") | MÉDIO | G3 |
| P11 | Deep link gasto→leg (tap no gasto → info do trecho) | MÉDIO | G3 |
| P12 | Rota do itinerário no mapa (linhas entre cidades) | ALTO | G4 |
| P13 | GPS auto-detect cidade (atualiza current leg) | ALTO | G4 |
| P14 | Notificação de próximo transporte | ALTO | G5 |
| P15 | Sharing do itinerário (link exportável ou PDF) | ALTO | G5 |

---

## 6. Detalhamento por feature

### P00 — Conversational Flow (PRIORIDADE MÁXIMA)

**O que**: O modo "💬 Passo a passo" deve ter uma conversa sequencial onde a IA faz perguntas uma a uma e o user responde. Hoje AMBOS os modos vão para a mesma textarea vazia — o modo guiado NÃO EXISTE.

**Estado atual** (bug/gap confirmado):
- `ItineraryCopilotFlow.tsx` linha 131 e 141: ambos botões fazem `setStage('input')`
- O stage `input` é a mesma textarea para os dois modos
- Não existe stage `conversation` / `guided` / `step_by_step`

**Como deve funcionar (design original):**

1. User escolhe "💬 Passo a passo"
2. IA faz perguntas SEQUENCIAIS (chat bubble UX):
   - **Pergunta 1**: "Quais cidades você vai visitar nessa viagem?" → user responde
   - **Pergunta 2**: "Quantos dias em cada cidade?" → user responde
   - **Pergunta 3**: "Como você vai viajar entre elas? (avião, trem, ônibus...)" → user responde
   - **Pergunta 4**: "Já tem hospedagem reservada? Onde vai ficar em cada?" → user responde
   - **Pergunta 5**: "Algum evento especial planejado? (festivais, day trips...)" → user responde
   - **Pergunta 6**: "Qual o budget diário aproximado?" → user responde
3. Ao final: IA consolida TODAS as respostas em um único `buildItinerary()` call
4. Preview aparece (stage `preview` — já funciona)

**Implementação:**

- Novo stage: `'guided'`
- Novo state: `guidedStep: number`, `guidedAnswers: Record<number, string>`
- Perguntas hardcoded no client (NÃO depende da IA para gerar perguntas):

```typescript
const GUIDED_QUESTIONS = [
  { key: 'cities', icon: '🌍' },
  { key: 'duration', icon: '📅' },
  { key: 'transport', icon: '🚂' },
  { key: 'accommodation', icon: '🏠' },
  { key: 'events', icon: '🎉' },
  { key: 'budget', icon: '💰' },
] as const;
// Labels via t(`itinerary.guided_q_${key}`)
```

- UI: chat-like com bolha da IA (pergunta) e bolha do user (resposta), scroll para baixo
- Campo de input no bottom (tipo chat), botão "Próxima →" ou Enter avança
- Ao responder a última pergunta: consolida em texto e chama `buildItinerary` com o compilado
- Compilação: `"Cidades: {a1}\nDuração: {a2}\nTransporte: {a3}\nHospedagem: {a4}\nEventos: {a5}\nBudget: {a6}"`

**Visual:**
```
┌─────────────────────────────────────┐
│ 🤖 Quais cidades você vai visitar?  │ (bolha IA)
│                                     │
│           Veneza, Ljubljana, ┐      │ (bolha user)
│           Bruxelas, Amsterdam│      │
│                              ┘      │
│ 🤖 Quantos dias em cada?           │ (bolha IA)
│                                     │
│                    [input field]     │
│                    [Próxima →]       │
└─────────────────────────────────────┘
```

**Worker**: NÃO precisa de endpoint novo. O `buildItinerary` já aceita texto livre. A compilação das respostas é feita client-side antes de enviar.

**ACs:**
- [ ] Botão "Passo a passo" abre stage `guided` (NÃO `input`)
- [ ] 6 perguntas sequenciais em chat UX
- [ ] User responde com input + Enter/botão
- [ ] Ao final: consolida e chama buildItinerary
- [ ] Preview funciona normalmente após build
- [ ] Botão "Já tenho as infos" continua indo pro textarea (funcionalidade existente intacta)
- [ ] i18n: perguntas em 3 idiomas

---

### P01 — Color coding por tipo de dia

**O que**: Cada tipo de dia tem uma cor de fundo sutil no scroll de datas e no header da leg.

| dayType | Cor | Emoji |
|---------|-----|-------|
| `full` | green-50 (claro) / green-900 (escuro) | 🟢 |
| `transit` | blue-50 / blue-900 | 🔵 |
| `festival` | purple-50 / purple-900 | 🟣 |
| `rest` | gray-100 / gray-800 | ⚪ |
| `day_trip` | amber-50 / amber-900 | 🟡 |

**Onde aplicar:**
1. Botão de cada dia no scroll horizontal → background da cor do tipo
2. Header da leg (📍 Cidade) → borda esquerda colorida
3. Context card no Home → pequeno dot colorido ao lado do nome da cidade

**Implementação:**
- Utility function: `getDayTypeColor(dayType: DayType): { bg: string; text: string; border: string }`
- Lookup da leg para o dia selecionado → cor da date pill
- CSS classes condicionais (tailwind)

---

### P02 — Progress bar da viagem

**O que**: Barra horizontal fina mostrando progresso percentual da viagem (dia atual / total de dias).

**Onde**: Topo da ItineraryPage, abaixo do header e acima do scroll de dias.

**Visual:**
```
Dia 8 de 21 ─────────▋────────────── 38%
```
- Barra: `h-1.5 rounded-full`, cor primary, fundo surface-high
- Label: "Dia N de T" à esquerda, porcentagem à direita
- Se hoje < arrivalDate da 1ª leg: "Começa em X dias"
- Se hoje > departureDate da última leg: "Viagem concluída! 🎉"

---

### P03 — Timeline visual (barra vertical)

**O que**: Substituir a lista flat de agenda por uma timeline vertical com:
- Barra vertical contínua (`w-0.5 bg-border-faint`)
- Nós circulares no cruzamento com cada item (cor por tipo)
- Items alinhados à direita da barra
- Hora no nó (se disponível), label + detalhe ao lado

**Estrutura HTML:**
```html
<div class="relative pl-6">
  <!-- Vertical bar -->
  <div class="absolute left-[11px] top-0 bottom-0 w-0.5 bg-border-faint" />
  
  <!-- Timeline item -->
  <div class="relative flex items-start gap-3 pb-4">
    <!-- Node -->
    <div class="absolute left-[-14px] top-1 w-4 h-4 rounded-full border-2 {colorByType}" />
    <!-- Content -->
    <div class="pl-3">
      <span class="text-xs font-mono text-primary">{time}</span>
      <p class="text-sm">{label}</p>
      <p class="text-xs text-dim">{detail}</p>
    </div>
  </div>
</div>
```

**Cores dos nós:**
- arrival = teal (chegou!)
- departure = amber (partindo)
- accommodation = indigo (dormindo)
- highlight = primary (atividade)

---

### P04 — Swipe animado entre dias

**O que**: Touch swipe left/right muda o dia selecionado (como um mini carrossel de conteúdo).

**Implementação:**
- `onTouchStart` / `onTouchEnd` no container da timeline/agenda
- Calcular `deltaX` — se > 50px threshold, avançar/retroceder dia
- Transição CSS: `transform: translateX()` com `transition: transform 200ms ease-out`
- O scroll de datas acompanha (scroll-into-view do dia ativo)

**Guard:** Se há apenas 1 dia, swipe não faz nada.

---

### P05 — Budget premise contextual no QuickAdd

**O que**: Ao abrir o QuickAdd durante a viagem, se existe uma leg para hoje com `budgetPremise`, mostrar uma nota sutil acima do campo de valor.

**Visual:**
```
┌─────────────────────────────────────────┐
│ 💡 Budget do dia: café + almoço simples │
│    + jantar takeaway (~R$130)           │
└─────────────────────────────────────────┘
```

**Implementação:**
- Hook: `useItineraryDayContext(tripId, today)` → `{ currentLeg, budgetPremise, dailyBudgetCents, companions }`
- No QuickAdd, se `budgetPremise` existe, render componente `<ItineraryBudgetHint />`
- Componente dismissável (tap no X fecha por hoje — estado local)
- Texto via `budgetPremise` da leg (já preenchido pela IA)

---

### P06 — Companion-aware QuickAdd

**O que**: Quando o user abre split/divisão no QuickAdd, os companions da leg de hoje são PRÉ-SUGERIDOS na lista de participantes.

**Implementação:**
- O hook `useItineraryDayContext` já traz `companions: string[]`
- No split participant selector: mostrar section "Companheiros de hoje" no topo
- Companions pré-selecionados (ÂNCORA-POL-4: user pode desmarcar livremente)
- Matching: nome do companion → participant do trip (fuzzy match ou exato)
- Se companion não é participante cadastrado: mostrar "Adicionar {nome}?" com 1-tap

---

### P07 — Spent vs planned por leg

**O que**: Na tela de agenda, mostrar quanto foi gasto vs o budget planejado para aquela leg.

**Visual no header da leg:**
```
📍 Lucerna (CH) · 🟢 Dia cheio · 👥 Solo
[████████░░░░] Gasto: R$280 / R$450 (62%)
```

**Implementação:**
- Domain function nova: `getLegSpend(tripId, legArrival, legDeparture)` → { totalSpentCents, currency }
- Query: soma `transactions` onde `date >= legArrival && date <= legDeparture` e `tripId` matches
- A barra é `<div class="h-1.5 bg-primary rounded-full" style="width: {percent}%">`
- Cor muda: <80% = green, 80-100% = amber, >100% = red
- Se leg não tem `dailyBudgetCents`: mostrar só o total gasto, sem barra

**ÂNCORA-POL-5**: Isso é READ-ONLY. Não cria nenhum dado. Não afeta livre/cofrinho.

---

### P08 — Quick notes por leg

**O que**: Campo de notas pessoais por leg — lembretes, dicas, mini-checklist.

**Implementação:**
- A ItineraryLeg JÁ TEM campo `highlights: string[]`. Vamos usar esse campo + adicionar um novo campo `personalNotes: string | null` na entidade.
- Schema migration: V15 → V16 (ou next): adicionar campo `personalNotes` (nullable, sem index)
- Na agenda page: seção colapsável "📝 Notas" abaixo do budget premise
- Tap para editar inline (textarea que salva on blur)
- Exibição em markdown light (bold, listas, links)

**Alternativa zero-migration:** Usar o campo `highlights` para notas pessoais também (já é string[]). Separar visualmente: highlights da IA vs notas do user via prefixo `[note]`. Decisão: prefiro campo novo (`personalNotes`) — mais limpo, não polui highlights.

---

### P09 — Card expandido no Home

**O que**: O ItineraryContextCard no Home tem dois estados:
1. **Colapsado** (atual): cidade + dia + próximo transporte + "Ver agenda"
2. **Expandido** (novo): mostra TODA a agenda do dia em miniatura + barra de budget

**Interação:**
- Tap anywhere (exceto "Ver agenda") → toggle expand/collapse
- "Ver agenda →" → navega para `/itinerary`
- Estado persiste por sessão (localStorage key `itinerary_card_expanded`)

**Visual expandido:**
```
📍 Lucerna · Dia 19/21
━━━━━━━━━━▓━━━━━━━━ 90% trip
🏠 Hotel Waldstätterhof
⏭️ 09:35 🚂 → Zürich
━━━━━━━━━━━━━━━━━━━━━━━
09:35  🚂 Lucerna → Zürich
11:00  📸 Old Town walking
14:30  ✈️ ZRH → MAD
━━━━━━━━━━━━━━━━━━━━━━━
Budget: R$120 / R$180 [████░░] 67%
[Ver agenda completa →]
```

---

### P10 — Booking checklist

**O que**: View dedicada que filtra legs/transportes/hospedagem onde `bookingStatus !== 'purchased'`.

**URL**: `/itinerary/checklist`

**Visual:**
```
📋 O que falta comprar

🟡 PRICED (preço fechado, falta comprar)
  🚂 Veneza → Ljubljana · Trenitalia · €34.40
  🏠 Hostel Tresor (Ljubljana) · 2 noites · €48

🟠 ESTIMATED (sem preço definido)
  🚌 Zurique → Madrid · FlixBus · ~€45

🟢 BOOKED (reservado, não pago)
  🏠 St Christopher's (Amsterdam) · 1 noite · €42
```

**Agrupamento**: por bookingStatus (priced → estimated → booked → none), dentro de cada grupo ordenado por data.

**Ações**: Tap em item → opção de marcar como "purchased" (atualiza `bookingStatus` da leg).

---

### P11 — Deep link gasto→leg

**O que**: Na lista de gastos (ExpensesPage), gastos que caem dentro do período de uma leg mostram um badge discreto com a cidade.

**Visual na lista de gastos:**
```
☕ Café da manhã         €4.20    📍 Lucerna
🍕 Pizza Margherita     €8.50    📍 Verona
```

**Tap no badge** → navega para `/itinerary?date={expense.date}` (abre a agenda no dia).

**Implementação:**
- Hook: `useExpenseLegMapping(tripId, expenses)` → Map<expenseId, legCityName>
- Para cada expense: achar a leg onde `expense.date >= arrivalDate && expense.date <= departureDate`
- Render: badge de texto pequeno à direita do valor
- Performante: pré-compute o mapping uma vez quando expenses mudam (useMemo)

---

### P12 — Rota do itinerário no mapa

**O que**: No mapa existente do app, mostrar linhas/polylines conectando as cidades do itinerário na ordem cronológica.

**Implementação:**
- Geocode de cada `cityName` → lat/lng (pode usar o geocode que já existe no app)
- Desenhar polyline com Leaflet: `L.polyline(points, { color, dashArray })`
- Markers para cada cidade com ícone por tipo de dia
- Cores da polyline: trechos já percorridos (solid) vs futuros (dashed)
- O mapa já existe em `/map` — adicionar layer condicional quando legs existem

**Geocoding strategy:**
- Usar API de geocode existente no app (se já tem)
- Cache: salvar lat/lng na leg (`cityLat`, `cityLng`) — novo campo OU `metadata`
- Fallback: se não tem coordenadas, não mostrar a rota (graceful degradation)

---

### P13 — GPS auto-detect cidade

**O que**: Com permissão do user, detectar a posição GPS atual e atualizar qual leg está "ativa" (em vez de depender só da data).

**Lógica:**
1. GPS ativo → pegar coordenadas
2. Comparar com `cityLat/cityLng` das legs (se geocoded)
3. Se distância < 50km de alguma leg → marca como "current" (override da data)
4. Se distância > 50km de todas → fallback para data (comportamento atual)

**ÂNCORA-POL-2:** GPS é opt-in. Primeiro uso mostra: "Quer que o app detecte onde você está?" → [Permitir] [Não agora]. Permissão via `navigator.geolocation.getCurrentPosition`.

**Guard**: Se location API não disponível (sem HTTPS, permission denied), comportamento = fallback por data.

---

### P14 — Notificação de próximo transporte

**O que**: Push notification (Web Notification API ou local notification via Capacitor) alertando antes de um transporte.

**Triggers:**
- 1h antes do horário de departure (se `departureTime` definido)
- Mensagem: "⏰ Seu {tipo} para {destino} sai em 1h ({hora})"

**Implementação:**
- Service Worker scheduling: `self.registration.showNotification()` com timer
- Se Capacitor (APK): `@capacitor/local-notifications`
- User configura: ON/OFF no settings + antecedência (30min / 1h / 2h)

**ÂNCORA-POL-3:** Primeira vez que tenta agendar → request permission. Se negado, feature desliga silenciosamente.

---

### P15 — Sharing do itinerário

**O que**: Exportar o itinerário para compartilhar com companheiros de viagem.

**Formatos:**
1. **Link legível** (página pública estática): gera HTML autocontido, hospeda no Pages como blob
2. **Texto simples** (WhatsApp/Telegram): copia resumo formatado pro clipboard
3. **PDF** (futuro, stretch): usa a mesma engine de export do Diário

**Formato texto (WhatsApp):**
```
🗺️ Eurotrip Julio — 15/Jul a 04/Ago

📍 Veneza (15-17 Jul) · ✈️ Iberia MAD→VCE · 🏠 Anda Venice Hostel
📍 Ljubljana (17-19 Jul) · 🚂 Trenitalia · 🏠 Hostel Tresor
📍 Bruxelas (21-28 Jul) · ✈️ Ryanair · 🏠 2GO4 Hostel
...

Gerado por TripPilot · trippilot.pages.dev
```

**Implementação:**
- Botão "Compartilhar" no header da ItineraryPage
- Sheet com 3 opções: [📋 Copiar texto] [🔗 Criar link] [📄 PDF]
- "Copiar texto": `navigator.clipboard.writeText(formatted)`
- "Criar link": usa padrão do app (share blob → worker → slug)

---

## 7. Organização em Gates

### G0 — Baseline & Setup
- Confirmar suite verde, tsc, build
- Semear dev-log com esta wave

### G1 — Core Fix + Visual Foundation (P00, P01, P02, P03, P04) → 2.12.1-rc
**Objetivo**: Corrigir o flow conversacional que nunca foi implementado + transformar a aparência da timeline/agenda.
- **P00 Conversational Flow (fix)**, color coding, progress bar, timeline vertical, swipe

### G2 — Contextual Intelligence (P05, P06, P07, P08) → 2.12.2-rc
**Objetivo**: Trazer informação do itinerário pro momento de gasto e registro.
- Premissa no QuickAdd, companions, spent/planned, notas pessoais

### G3 — Expanded Card & Checklist (P09, P10, P11) → 2.12.3-rc
**Objetivo**: Melhorar o Home card e conectar gastos ao itinerário.
- Card expandido, booking checklist, deep link expense→leg

### G4 — Map & Location (P12, P13) → 2.12.4-rc
**Objetivo**: Visualização geográfica e inteligência de localização.
- Rota no mapa, GPS auto-detect

### G5 — Push & Share (P14, P15) → 2.13.0-rc (minor bump = nova capacidade)
**Objetivo**: Notificações proativas e export/compartilhamento.
- Notificação de transporte, sharing

---

## 8. Estratégia de testes

### Unit (Vitest):
- `getDayTypeColor` — retorna cores corretas para cada tipo
- `getLegSpend` — soma gastos corretamente por período da leg
- `useExpenseLegMapping` — mapeia expenses para legs corretamente
- `formatItineraryForShare` — gera texto formatado corretamente
- `buildBookingChecklist` — filtra e agrupa corretamente

### Component (se necessário):
- Card expandido: render com/sem legs, expand/collapse
- Timeline: render com 0, 1, 5 items
- Budget hint: render com/sem premissa

### Regressão:
- Suite inteira verde entre cada gate
- ZERO impacto em telas de gasto/budget/planner (ÂNCORA-POL-1)
- QuickAdd funciona normal quando não há itinerário

---

## 9. Protocolo por milestone

Antes de avançar:
1. ✅ Código implementado conforme AC
2. ✅ Testes novos escritos e passando
3. ✅ Suite inteira: `npm run test` — 0 failures novas
4. ✅ `tsc --noEmit` — 0 erros
5. ✅ `npm run build` — sucesso
6. ✅ Nomear 3 ACs anteriores com risco de regressão
7. ✅ Nenhum arquivo fora do escopo
8. ✅ dev-log atualizado

Deploy a cada GATE via `bash scripts/deploy.sh`.

---

## 10. THE BUILD — Acceptance Criteria por Gate

### G1 — Core Fix + Visual Foundation

**ACs (P00 — Conversational Flow):**
- [ ] Botão "Passo a passo" abre stage `guided` (NÃO vai pro textarea)
- [ ] 6 perguntas sequenciais renderizam em chat-like UI
- [ ] User digita resposta + Enter → próxima pergunta aparece (scroll automático)
- [ ] Ao responder a última: consolida em texto e faz build (loading → preview)
- [ ] Botão "Já tenho as infos" continua funcionando como antes (stage `input`)
- [ ] i18n: perguntas guiadas em pt-BR/en/es

**ACs (P01-P04 — Visual):**
- [ ] Scroll de dias mostra cores por tipo (5 tipos, 5 cores distintas)
- [ ] Header da leg tem borda colorida lateral
- [ ] Context card tem dot de cor ao lado da cidade
- [ ] Progress bar mostra "Dia N de T" com porcentagem
- [ ] Progress bar correta para antes, durante, e depois da viagem
- [ ] Timeline vertical com barra contínua e nós coloridos
- [ ] Nós com cores por tipo (arrival=teal, departure=amber, accommodation=indigo, highlight=primary)
- [ ] Swipe left = próximo dia, swipe right = dia anterior
- [ ] Swipe atualiza o scroll e a timeline simultaneamente
- [ ] Guard: swipe desabilitado com 1 dia, progress bar mostra "100%" no último dia
- [ ] Suite verde, tsc limpo, build verde

### G2 — Contextual Intelligence

**ACs:**
- [ ] QuickAdd mostra budget premise do dia quando leg existe
- [ ] Budget hint dismissável (X fecha, reaparece no próximo gasto)
- [ ] QuickAdd sem leg ativa = ZERO mudança visual (regressão)
- [ ] Split participant list mostra "Companheiros de hoje" section se companions > 0
- [ ] Companions pré-selecionados mas removíveis (ÂNCORA-POL-4)
- [ ] Se companion não é participante: opção de adicionar
- [ ] Spent vs planned: barra de progresso na agenda com cores (green/amber/red)
- [ ] Spent calculado por date range (não por leg ID — legs não existem nas transactions)
- [ ] Leg sem dailyBudgetCents: mostrar só total gasto
- [ ] Quick notes: campo editável na agenda, salva on blur
- [ ] Schema migration (se necessário) funciona sem quebrar dados
- [ ] Suite verde, tsc limpo, build verde

### G3 — Card & Checklist

**ACs:**
- [ ] Card no Home: tap toggle expand/collapse com animação
- [ ] Expandido: mostra timeline resumida + budget bar
- [ ] "Ver agenda →" navega para /itinerary
- [ ] Booking checklist: view em /itinerary/checklist
- [ ] Agrupa por bookingStatus (priced > estimated > booked > none)
- [ ] Tap marca como "purchased" (update leg + toast)
- [ ] Gastos na ExpensesPage mostram badge discreto com cidade
- [ ] Tap no badge navega para agenda no dia correto
- [ ] Badge SÓ aparece se leg existe para aquela data
- [ ] Suite verde, tsc limpo, build verde

### G4 — Map & Location

**ACs:**
- [ ] Mapa mostra polyline conectando cidades do itinerário
- [ ] Markers com ícones por tipo de dia
- [ ] Trechos passados = linha sólida, futuros = linha tracejada
- [ ] Graceful: sem coordenadas = sem polyline (não crash)
- [ ] GPS opt-in: primeiro uso pede permissão
- [ ] GPS detecta cidade correta (<50km)
- [ ] GPS fallback: se negado ou indisponível, usa data (comportamento atual)
- [ ] GPS atualiza current leg override no card e agenda
- [ ] Suite verde, tsc limpo, build verde

### G5 — Push & Share

**ACs:**
- [ ] Notificação: fires 1h antes do transporte (configurable)
- [ ] Permission request no primeiro agendamento
- [ ] Funciona em Capacitor (local notification) e web (Push API)
- [ ] Settings: toggle ON/OFF + antecedência
- [ ] Sharing texto: copia formatted clipboard (WhatsApp-friendly)
- [ ] Sharing link: gera blob page com itinerário visual (HTML)
- [ ] Share sheet com 2 opções (texto, link)
- [ ] Suite verde, tsc limpo, build verde
- [ ] Deploy final 2.13.0-rc com Pages + Worker

---

## 11. DoD — Definition of Done (wave completa)

- [ ] Todos os 15 features implementados e testados
- [ ] Visual: timeline vertical, cores, progress bar, swipe
- [ ] Contextual: premissa e companions no QuickAdd
- [ ] Inteligente: spent/planned, deep link, checklist
- [ ] Avançado: mapa, GPS, notificações, sharing
- [ ] Suite verde (0 failures novas)
- [ ] tsc limpo, builds verdes
- [ ] 5 deploys (G1→G5)
- [ ] Apex: 2.13.0-rc
- [ ] ÂNCORA-POL-1: nenhum cálculo financeiro alterado

---

## 12. Context Refresh Protocol

A cada gate boundary:
1. Re-ler §2 (ÂNCORAS)
2. Rodar suite: `npm run test`
3. Rodar: `tsc --noEmit` + `npm run build`
4. Output:
```
ÂNCORAS: ITIN-1 ✓ ITIN-2 ✓ ITIN-3 ✓ POL-1 ✓ POL-2 ✓ POL-3 ✓ POL-4 ✓ POL-5 ✓
Gate: [G?] | Tests: [X/Y] | Build: [OK] | tsc: [OK]
```

---

## 13. Riscos e mitigações

| Risco | Prob | Mitigação |
|-------|:----:|-----------|
| Spent vs planned requer join complexo | MED | Query simples por date range. Se lento, index por date. |
| GPS accuracy em cidade = flaky | MED | Threshold 50km. Se flaky, desabilita auto e usa date. |
| Timeline visual quebra em legs com muitos items | LOW | Max height com scroll interno. |
| Notificação não funciona em background (PWA) | HIGH | Background sync limitado. Workaround: reminder ao abrir o app. |
| Share link expõe dados financeiros | LOW | Share = APENAS itinerário (cidades, datas). Nada financeiro. |

---

## 14. Kickoff — COMECE AQUI

1. Leia §0-§9 inteiro
2. Execute G0 (baseline: test, build, tsc, dev-log)
3. Prossiga G1→G5 em sequência
4. Deploy a cada gate
5. Ao terminar G5: verifique §11 (DoD) — todas TRUE → wave fechada

**Critério de parada**: §11 ALL TRUE + apex verde com 2.13.0-rc.
