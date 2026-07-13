# Análise — Eurotrip Jul/Ago 2026: dados, gaps e evolução do app

> **Data**: 2026-07-10
> **Contexto**: Julio tem uma planilha com TODOS os detalhes da viagem (15/Jul – 04/Ago, 21 dias, 10+ cidades). Pergunta: como o TripPilot pode absorver essa riqueza de informação E ajudá-lo em tempo real durante a viagem?

---

## §1 — Radiografia dos dados (o que a planilha contém)

### 1.1 Estrutura

| Campo | O que é | Uso para o app |
|-------|---------|----------------|
| Data | Dia exato do gasto/item | Mapeamento 1:1 com dias de cada fase |
| Bloco | "Italia/Eslovenia/Belgica", "Bruxelas/Amsterdam/Berlin", "Freiburg/Suíça/Madrid" | = Trechos/Fases no app |
| Categoria | Alimentação, Transporte, Hospedagem, Bebidas, Passeios, Lockers | = categorias existentes + nova "Lockers" |
| Subcategoria | Comida, Intercity, Local, Aéreo, Hostel, Hotel, Consumo, Cidade, etc. | = subcategorias DEC-095 |
| Status | Comprado / Estimado / Adquirido / Fechado | Tracker de confirmação |
| Moeda original | BRL / EUR / CHF | Multi-moeda existente |
| Valor original | Valor na moeda do pagamento | Import direto |
| Valor EUR plano | Quanto isso representa no orçamento base | Conversão para base currency |
| "Conta no que falta pagar?" | Sim/Não | Se entra ou não no budget diário |
| Tipo | Variável / Fixo / Já pago | Classificação para budget tracking |
| Link/observação | Horários, notas de booking, condições | Dados de itinerário |
| Premissa detalhada | O que aquele valor COBRE exatamente | Contexto de decisão em tempo real |

### 1.2 Perfil da viagem

| Métrica | Valor |
|---------|-------|
| Duração | 21 dias (15/Jul – 04/Ago) |
| Cidades | Mestre/Veneza → Ljubljana → Trieste → Verona → Bruxelas → Bruges → Amsterdam → Berlin → Freiburg → Lucerna → Interlaken → Zurique → Madrid → Burgos |
| Blocos/Fases naturais | 3 (Itália+Eslovênia+Bélgica / Bruxelas+Amsterdam+Berlin / Freiburg+Suíça+Madrid) |
| Moedas | BRL, EUR, CHF |
| Itens já pagos (Comprado) | ~18 transportes + voos |
| Itens adquiridos (booking feito, pagamento pendente) | ~8 hospedagens |
| Itens estimados | ~55 linhas (comida, bebida, transporte local, lockers) |
| Itens fechados (preço travado, falta comprar) | ~7 (Bruges trem, lockers, atividades) |
| Acompanhantes variáveis | Jessika+Farfan (Veneza), primo (Ljubljana), amigos (Tomorrowland, Mestre) |
| Eventos especiais | Tomorrowland (4 dias), Giardino Giusti+Funicolare (Verona), Lindt Chocolate (Zurique), Jules Verne bar |
| Média de permanência por cidade | ~2 dias (ritmo rápido "pauleira") |

### 1.3 Padrões de gasto identificados

| Tipo de dia | Padrão de custo | Frequência |
|-------------|-----------------|------------|
| **Dia de transição** (cidade → cidade) | Budget reduzido (~BRL 90-120 comida + BRL 30-60 local) | ~8 dias |
| **Dia cheio numa cidade** | Budget padrão (~BRL 120-150 comida + BRL 20-70 local + BRL 20-30 bebidas) | ~8 dias |
| **Dia de festival** (Tomorrowland) | Budget elevado (~BRL 130 comida + BRL 90 bebidas + BRL 40 local) × 4 dias | 4 dias |
| **Bate-volta** (Bruges, Trieste, Verona, Interlaken) | Budget médio + transporte intercity fixo | ~4 dias |

### 1.4 Informações que a planilha tem e o app NÃO absorve hoje

1. **Horários de transporte** — "09:23-10:38", "06:55-08:40", "16:06-18:05"
2. **Premissas detalhadas** — "cobre 1 lanche no aeroporto + 1 refeição simples na chegada"
3. **Status de booking** (4 estados: Comprado/Adquirido/Estimado/Fechado)
4. **Roteiro do dia** — sequência implícita (manhã em X, tarde transporte, noite em Y)
5. **Companheiros por dia** — "com Jessika e Farfan", "com o primo"
6. **Links de reservas** — referências para voltar e ver detalhes
7. **Distinção "já pago" vs "conta no orçamento"** — o que afeta o livre diário

---

## §2 — O que o app JÁ absorve hoje (mapeamento direto)

| Dado da planilha | Feature existente no app | Observação |
|------------------|--------------------------|-------------|
| Blocos → Trechos | Fases + BudgetPool dedicado (DEC-219) | Direto — 3 fases |
| Valores estimados por dia | Orçamento da fase (livre/dia) | Soma dos estimados = budget do trecho |
| Categorias/Subcategorias | Sistema de categorias (DEC-095, 17 cats + 110 subcats) | Match quase perfeito |
| Eventos especiais (Tomorrowland, Giardino) | PlannedOccurrence com reserva (DEC-072/385) | ✅ evento com reserva consumível |
| Multi-moeda (EUR/BRL/CHF) | Multi-currency (DEC-158/435) com taxa automática | ✅ |
| Sub-destinos (Ljubljana, Verona) | `kind: 'sub_destination'` em PlannedOccurrence | ⚠️ existe mas nunca evoluiu muito |
| "Livre hoje" no dia | Hero da Home + allowance map | ✅ core feature |
| Dias de pico vs calmo | Phase Rhythm & Peak Days (DEC-075) | Pode mapear dias de festival como pico |
| Itens já pagos | -- | ⚠️ existe conceito de "Tipo: Já pago" implícito mas não é first-class |

---

## §3 — Os GAPS: o que falta para a experiência "copiloto de eurotrip"

### Gap 1: Itinerário do dia — "O que vem agora?"

**Dor**: Julio está em Mestre às 7h, precisa saber: "pegar o trem às 09:23 para Verona, voltar às 18:27, pizza com amigos em Mestre à noite". Hoje o app fala de DINHEIRO, não de SEQUÊNCIA.

**O que seria**: Uma timeline do dia mostrando blocos horários (transporte, atividade, refeição) com as informações-chave: horário, local, link/nota, status (confirmado/estimado).

**Nível de esforço**: MÉDIO — novo modelo `DayScheduleItem` ou extensão de `PlannedOccurrence` com campo `scheduledTime`.

### Gap 2: Tracker de transportes — "Qual meu próximo trem/voo?"

**Dor**: 18 transportes comprados com horários específicos. Hoje o app os trata como gasto, não como logística. Julio precisa de um "próximo transporte" rápido: "FlixBus 16:06 para Lucerna, plataforma X".

**O que seria**: Card no Home ou seção de "Próximo transporte" que puxa o transporte mais próximo do dia com: hora, origem, destino, companhia, status.

**Nível de esforço**: BAIXO-MÉDIO — é uma view filtrada sobre PlannedOccurrences/transações com metadata de transporte.

### Gap 3: Budget "já pago" vs "dia a dia" — separação clara

**Dor**: O voo Iberia (R$379) e o hostel (R$280) já foram pagos. Eles NÃO devem pressionar o "livre hoje". Mas o app soma tudo na mesma verba.

**O que existiu**: O campo "Conta no que ainda falta pagar?" da planilha faz exatamente essa distinção.

**O que seria**: Um estado `prepaid` em transações/eventos que:
- Aparece no custo TOTAL da viagem (visão "quanto a viagem toda custa")
- NÃO entra no cálculo de "livre hoje" / "livre na fase"
- Tem uma seção própria ("Já pago antes da viagem: €X")

**Nível de esforço**: MÉDIO — já existe a lógica de `PhaseSpendLens` com "Fora desta conta"; estender com classificação explícita de prepaid.

### Gap 4: Premissas de gasto — "O que esse budget cobre?"

**Dor**: Julio estimou R$120 para comida num dia de transição, e a premissa é "café no aeroporto + 1 refeição simples na chegada". Se ele gasta €8 no café, precisa saber: "ok, faltam ~€12 para a refeição da noite — kebab ou pizza, nada de restaurante".

**O que seria**: Campo `premise` ou `budgetNote` no PlannedOccurrence / no dia / no perfil de atividade, visível quando o usuário consulta o "livre hoje" ou registra um gasto. O app mostra: "Comida hoje (R$120): pensado para café simples + refeição barata na chegada".

**Nível de esforço**: BAIXO — é um campo de texto rico em PlannedOccurrence ou nas notas do ScenarioPlan.

### Gap 5: Companheiros do dia — "Com quem estou hoje?"

**Dor**: Veneza é com Jessika e Farfan (pode dividir gastos). Ljubljana é com o primo (hospedagem grátis). Tomorrowland é com os amigos. O split e o padrão de gasto mudam conforme quem está junto.

**O que seria**: Um indicador por dia/sub-destino de "companheiros ativos" que:
- Sugere split com essas pessoas ao registrar gasto
- Ajusta a expectativa de gasto (hostel grátis quando com primo)
- Aparece na timeline do dia

**Nível de esforço**: MÉDIO — extensão de PlannedOccurrence com `companions[]` + lógica de sugestão no QuickAdd.

### Gap 6: Status de bookings — "O que preciso comprar/reservar?"

**Dor**: 4 estados na planilha (Comprado/Adquirido/Estimado/Fechado). Julio quer saber: "o que falta fechar antes de viajar?" e durante: "aquela atividade em Zurique, já comprei o ingresso?"

**O que seria**: Um campo `bookingStatus` em PlannedOccurrence:
- `purchased` — pago e confirmado
- `booked` — reservado, pagamento pendente
- `priced` — preço fixado, falta comprar
- `estimated` — valor estimado, pode mudar

Um checklist "Preparação da viagem" com itens pendentes.

**Nível de esforço**: BAIXO — enum novo + view de lista filtrada.

### Gap 7: Custo por cidade calibrado — "Zurique ≠ Ljubljana"

**Dor**: A planilha tem premissas diferentes por cidade: Ljubljana = "burek/pizza/burger barato", Zurique = "fast food caro, mercado ajuda". O mesmo "almoço simples" custa €5 em Ljubljana e €18 em Zurique.

**O que seria**: O sub-destino carregar `costMultiplier` ou `typicalValues` locais que ajustam o "livre hoje" e as sugestões do simulador. "Você está em Zurique — seu típico de almoço aqui é ~€15, não €8".

**Nível de esforço**: MÉDIO — é uma extensão do per-phase ActivityProfile com valores por sub-destino.

### Gap 8: Dias de transição como conceito — "Hoje é dia de estrada"

**Dor**: Dia de transição tem padrão totalmente diferente: menos refeições, mais lanches de aeroporto/estação, budget reduzido. Hoje o app trata todos os dias com o mesmo ritmo.

**O que seria**: Um `dayType` (full_day / transit_day / rest_day / festival_day) que ajusta automaticamente:
- O "livre hoje" esperado
- As sugestões do simulador
- O tom do "amigo sincero"

**Nível de esforço**: BAIXO-MÉDIO — extensão do Phase Rhythm (DEC-075) com tipos de dia além de pico/calmo.

---

## §4 — Proposta de evolução: "Modo Eurotrip"

### Conceito

O TripPilot já é excelente como **copiloto financeiro**. Para a próxima fase (eurotrip rápida, 2 dias por cidade), ele precisa evoluir para **copiloto de viagem completo** — não só "posso gastar?" mas "o que faço agora? onde vou? quanto tenho para isso?".

### 4.1 Feature: Itinerário do Dia (Day Agenda)

**O que é**: Uma view por dia mostrando os blocos do dia em ordem cronológica.

```
┌─────────────────────────────────────────┐
│  📅 17 Jul — Veneza → Ljubljana          │
│  Com: primo                              │
├─────────────────────────────────────────┤
│  ☀️ MANHÃ                                │
│  • Café/padaria em Mestre (budget ~€5)  │
│                                          │
│  🚌 14:00 GoOpti Mestre → Ljubljana     │
│     Status: ✅ Comprado · Chegada 18:30  │
│                                          │
│  🌙 NOITE                                │
│  • Jantar simples em Ljubljana (~€10)   │
│  • "burek, pizza, burger ou prato do    │
│     dia barato"                          │
│                                          │
│  🏠 Hospedagem: casa do primo (grátis)  │
│                                          │
│  💰 Budget do dia: R$150 (comida+local) │
│     Já pago: GoOpti €34,40              │
└─────────────────────────────────────────┘
```

**Valor**: Julio abre o app de manhã e vê TUDO do dia. Não precisa abrir planilha, Google Calendar, booking separado.

### 4.2 Feature: Card "Próximo" (Next Up)

**O que é**: Um card no Home que mostra o próximo item agendado que requer ação.

```
┌─────────────────────────────────┐
│  ⏭️ PRÓXIMO                      │
│  🚂 Regionale → Verona          │
│  09:23 · Plataforma TBD         │
│  Status: ✅ Comprado (€13)       │
│  Volta: 18:27 Verona → Mestre   │
└─────────────────────────────────┘
```

**Valor**: Glanceability máxima. Abre o app → vê o que vem. Sem scroll, sem busca.

### 4.3 Feature: Budget Contextual por Dia

**O que é**: O "livre hoje" ganha uma camada de contexto que explica O QUE aquele dinheiro cobre.

```
┌─────────────────────────────────────────┐
│  💰 Livre hoje: R$150                    │
│                                          │
│  📋 Pensado para:                        │
│  • Café/padaria cedo (Mestre) ~R$25     │
│  • Almoço simples (pizza/panino) ~R$60  │
│  • Jantar leve (kebab/takeaway) ~R$50   │
│  • Pequenos trajetos ~R$30              │
│                                          │
│  💡 Dica: dia de transição — lanches     │
│     de estação rendem mais que           │
│     restaurante sentado                  │
└─────────────────────────────────────────┘
```

**Valor**: Julio não precisa lembrar da premissa. O app já sabe o que cada euro cobre.

### 4.4 Feature: Separação Prepaid/On-trip

**O que é**: Custos "já pagos antes da viagem" ficam numa faixa separada.

```
┌─────────────────────────────────────────┐
│  Custo total da viagem: €2.450          │
│  ├── Já pago (antes de embarcar): €820  │
│  │   (voos, trens, hostels pagos)       │
│  ├── Reservado (pagar na hora): €550    │
│  │   (hostels adquiridos, ingressos)    │
│  └── Orçamento diário livre: €1.080     │
│      (comida, transporte local,         │
│       bebidas, imprevistos)             │
└─────────────────────────────────────────┘
```

**Valor**: O "livre por dia" não é poluído por voos pagos há 2 meses. Visão honesta de quanto FALTA gastar.

### 4.5 Feature: Booking Checklist

**O que é**: Uma lista de tudo que precisa ser feito antes/durante a viagem.

```
┌─────────────────────────────────────────┐
│  📋 Pendências                           │
│                                          │
│  ⬜ Locker Freiburg Hbf (~€5)           │
│  ⬜ Locker Zürich HB (CHF 12)           │
│  ⬜ Trem Bruxelas↔Bruges (€36)          │
│  ⬜ Madrid→Burgos ALSA (€23) — pós-voo  │
│  ✅ FlixBus Ljubljana→Trieste (R$103)   │
│  ✅ ICE Amsterdam→Berlin (€68)          │
│  ... (mais 14 comprados)                │
└─────────────────────────────────────────┘
```

**Valor**: Em 30 segundos, sabe o que precisa resolver. Conforme compra, dá check.

---

## §5 — Mapeamento: planilha → modelo de dados do TripPilot

### 5.1 Fases

| Bloco da planilha | Fase no app | Período | Budget diário estimado |
|-------------------|-------------|---------|------------------------|
| Italia/Eslovenia/Belgica | Fase 1 | 15-21 Jul (7 dias) | ~R$150/dia |
| Bruxelas/Amsterdam/Berlin | Fase 2 | 21-31 Jul (10 dias) | ~R$180/dia (festival infla) |
| Freiburg/Suíça/Madrid | Fase 3 | 01-04 Ago (4 dias) | ~R$200/dia (Suíça é cara) |

### 5.2 Eventos com reserva

| Evento | Tipo | Reserva | Dias | Fase |
|--------|------|---------|------|------|
| Tomorrowland | Festival | R$1.040 (4×(130+90+40)) | 23-26 Jul | 2 |
| Giardino Giusti + Funicolare | Passeio | R$140 | 20 Jul | 1 |
| Lindt Home of Chocolate | Museu | CHF 17 | 04 Ago | 3 |
| Jules Verne (1 drink) | Bar especial | CHF 20 | 04 Ago | 3 |
| Bruges bate-volta | Sub-destino | R$185 (trem+comida+bebida+local) | 27 Jul | 2 |

### 5.3 Sub-destinos

| Sub-destino | Dentro da fase | Dias | Companheiros |
|-------------|---------------|------|--------------|
| Veneza/Mestre | Fase 1 | 15-16, 19-21 Jul | Jessika, Farfan, amigos |
| Ljubljana | Fase 1 | 17-19 Jul | Primo |
| Trieste | Fase 1 | 19 Jul | Solo |
| Verona | Fase 1 | 20 Jul | Solo → amigos (noite) |
| Bruxelas | Fase 2 | 21-23, 27-28 Jul | Brasileiros, amigos |
| Boom (Tomorrowland) | Fase 2 | 23-26 Jul | Grupo festival |
| Amsterdam | Fase 2 | 28-29 Jul | Solo |
| Berlin | Fase 2 | 30-31 Jul | Solo/amigos |
| Freiburg | Fase 3 | 01-02 Ago | Solo |
| Lucerna | Fase 3 | 02-04 Ago | Solo |
| Interlaken | Fase 3 | 03 Ago | Solo |
| Zurique | Fase 3 | 04 Ago | Solo |

### 5.4 Transportes como itinerário

| ID | Data | Hora | Rota | Companhia | Status | Valor |
|----|------|------|------|-----------|--------|-------|
| T01 | 15/Jul | -- | Burgos → MAD T4 | ALSA | ✅ Comprado | €11,42 |
| T02 | 15/Jul | -- | MAD → VCE | Iberia | ✅ Comprado | R$379,71 |
| T03 | 16/Jul | madrugada | VCE → Mestre | ATVO | ✅ Comprado | €12,00 |
| T04 | 17/Jul | →18:30 | Mestre → Ljubljana | GoOpti | ✅ Comprado | €34,40 |
| T05 | 19/Jul | →09:10 | Ljubljana → Trieste | FlixBus | ✅ Comprado | R$103 |
| T06 | 19/Jul | →19:09 | Trieste → Mestre | Regionale | ✅ Comprado | R$126 |
| T07 | 20/Jul | 09:23-10:38 | Mestre → Verona | Regionale | ✅ Comprado | €13,00 |
| T07B | 20/Jul | 18:27-19:37 | Verona → Mestre | Regionale | ✅ Comprado | €9,80 |
| T08 | 21/Jul | 04:20-04:40 | Mestre → VCE | ATVO | ✅ Comprado | R$83,22 |
| T09 | 21/Jul | 06:55-08:40 | VCE → BRU | Brussels Airlines | ✅ Comprado | €61,78 |
| T10 | 27/Jul | -- | Bruxelas ↔ Bruges | SNCB | Fechado | €36,00 |
| T11 | 28/Jul | -- | Brussels-North → Amsterdam | -- | ✅ Comprado | R$85 |
| T12 | 30/Jul | -- | Amsterdam → Berlin | ICE | ✅ Comprado | €68,00 |
| T13 | 01/Ago | 09:57-16:37 | Berlin → Freiburg | FlixTrain | ✅ Comprado | R$124 |
| T14 | 02/Ago | 16:06-18:05 | Freiburg → Luzern | -- | ✅ Comprado | €35,99 |
| T15 | 04/Ago | 09:35-10:25 | Luzern → Zürich HB | -- | ✅ Comprado | R$132 |
| T16 | 04/Ago | -- | Zürich HB↔Kilchberg+Flughafen | SBB | Fechado | CHF 10,80 |
| T17 | 04/Ago | 18:30-20:55 | ZRH → MAD | Air Europa | ✅ Comprado | CHF 66 |
| T18 | 04/Ago | -- | Madrid → Burgos | ALSA | Fechado | €23 |

---

## §6 — Objetivos para o app ao vivo na eurotrip

### Prioridade 1 — "Abro o app e sei tudo do dia" (consulta rápida)

O app precisa responder INSTANTANEAMENTE:
1. **Onde estou dormindo esta noite?** — hospedagem do dia com endereço/nome
2. **Qual meu próximo transporte?** — hora, de onde para onde, status
3. **Quanto posso gastar hoje?** — livre do dia COM contexto (o que cobre)
4. **Com quem estou?** — companheiros ativos (para split automático)
5. **O que posso fazer?** — atividades planejadas disponíveis

### Prioridade 2 — "Registro sem pensar" (captura rápida durante o dia)

1. Registrar gasto em <5 segundos (QuickAdd existente ✅)
2. Saber na hora se está dentro do orçamento do dia (hero existente ✅)
3. Atribuir gasto ao sub-destino certo automaticamente (pela data)
4. Split automático com companheiros do dia
5. Voz "12 euros pizza em Veneza" (IA existente ✅)

### Prioridade 3 — "Decisão consciente" (simulação em tempo real)

1. "Posso pegar um vaporetto (€9,50) ou ando?" → simulador existente ✅
2. "Se gastar €20 no gelato/café, ainda tenho para o jantar?" → com premissa
3. "Zurique é cara — quanto posso gastar no almoço?" → contexto local
4. "Estou economizando? Posso me dar esse drink?" → cofrinho ✅

---

## §7 — Roadmap sugerido: o que implementar para a Eurotrip

### Wave A — Preparação (ANTES de 15/Jul) — importar os dados

| Item | O que | Esforço | Impacto |
|------|-------|---------|---------|
| A1 | Importar a planilha como uma viagem completa (fases + eventos + sub-destinos) | MÉDIO | Todos os dados no app |
| A2 | Marcar transportes com horários (campo `scheduledTime` em PlannedOccurrence) | BAIXO | Base para itinerário |
| A3 | Marcar itens como "já pago" (não conta no livre diário) | BAIXO | Budget honesto |
| A4 | Preencher premissas nos eventos/dias (campo `notes` ou `premise`) | BAIXO | Contexto disponível |

### Wave B — Itinerário do dia (a feature nova principal)

| Item | O que | Esforço | Impacto |
|------|-------|---------|---------|
| B1 | View "Agenda do dia" — timeline cronológica dos itens do dia | MÉDIO | O "abro e sei tudo" |
| B2 | Card "Próximo" no Home — o próximo transporte/atividade com horário | BAIXO | Glanceability |
| B3 | Premissa no hero — ao expandir "livre hoje", ver o que cobre | BAIXO | Decisão informada |
| B4 | Hospedagem do dia visível no agenda | BAIXO | "Onde durmo?" resolvido |

### Wave C — Eurotrip polish (durante a viagem)

| Item | O que | Esforço | Impacto |
|------|-------|---------|---------|
| C1 | Tipo de dia (transição/cheio/festival) ajustando expectativas | BAIXO | Ritmo inteligente |
| C2 | Companheiros por sub-destino (sugere split) | MÉDIO | Menos taps no split |
| C3 | Custo calibrado por sub-destino (típico local) | MÉDIO | Simulador honesto |

---

## §8 — Decisões a tomar (para o Julio)

1. **Implementar agora (antes de 15/Jul) ou planejar para v2?**
   - Se implementar: Wave A é obrigatória, Wave B é o diferencial
   - Se planejar: este documento vira o spec da feature

2. **Import automático da planilha CSV ou manual?**
   - Auto: parsear o CSV e criar a viagem completa (elegante, 1 ação)
   - Manual: criar as fases/eventos um a um usando o app (funciona hoje, trabalhoso)

3. **O itinerário é uma tela nova ou uma extensão do Home?**
   - Tela nova `/agenda` — mais espaço, view dedicada
   - Extensão do Home — card "Agenda do dia" abaixo do hero (menor mas mais acessível)

4. **Transportes como eventos com horário ou conceito separado?**
   - Extensão de PlannedOccurrence (menos código, já tem reserva/confirmação)
   - Entidade nova `TransportLeg` (mais semântica, mais código)

---

## §9 — Quick wins: o que JÁ dá para fazer com o app HOJE

Sem NENHUMA implementação nova, usando o app como está:

1. **Criar 3 fases** com as datas e budgets da planilha
2. **Criar eventos** para Tomorrowland, Giardino, Lindt, Jules Verne — com reserva
3. **Criar sub-destinos** para cada cidade (Ljubljana, Verona, etc.)
4. **Configurar perfis de atividade** por fase com os típicos da planilha (comida €20/dia, bebidas €5/dia, etc.)
5. **Registrar os gastos "já pagos"** como transações passadas (ficam no histórico sem afetar o livre)
6. **Usar o campo de notas** dos eventos para as premissas detalhadas

**Limitação**: não vai ter a view de itinerário, nem o "próximo transporte", nem a separação visual prepaid vs on-trip. Funciona como copiloto financeiro, não como copiloto de viagem completo.

---

## §10 — Resumo executivo

| Aspecto | Estado atual | Gap | Solução proposta |
|---------|-------------|-----|------------------|
| Budget diário | ✅ Excelente | Falta contexto (premissas) | Campo premise visível no hero |
| Eventos especiais | ✅ Funciona | -- | Usar como está |
| Sub-destinos | ⚠️ Básico | Falta companheiros + custo local | Extensão com companions + typicals |
| Transporte | ❌ Não existe como logística | Total | Card "Próximo" + agenda por dia |
| Itinerário | ❌ Não existe | Total | View de agenda do dia |
| Prepaid separation | ⚠️ Parcial | Falta ser first-class | Flag prepaid + seção separada |
| Booking tracker | ❌ Não existe | Total | Status field + checklist view |
| Premissas/contexto | ❌ Não existe | Total | Campo premise + display contextual |
| Tipo de dia | ⚠️ Peak days | Falta transit/festival/rest | Extensão do rhythm com dayType |

**Conclusão**: O TripPilot hoje cobre ~60% do que Julio precisa (o financeiro é sólido). Os 40% restantes são de **logística + contexto** — transformar o app de "controle de gastos inteligente" em "copiloto de viagem completo" que sabe não só QUANTO, mas QUANDO, ONDE e O QUÊ.
