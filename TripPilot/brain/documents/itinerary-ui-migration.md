# Itinerary UI Migration — Wireframe → App

> Version: 1.0 | Date: 2026-07-13
> Source: Stitch wireframes (`stitch_trippilot_travel_planner/`)
> Purpose: Complete specification for porting Stitch wireframe layouts into the TripPilot app
> Design system: Keep existing `tokens.css` / `design-system.md` — only port LAYOUT and UX patterns from wireframes

---

## Premissas

1. **Design system inalterado**: tokens de cor, tipografia, espaçamento, animações, anti-patterns seguem `design-system.md`. Os wireframes definem LAYOUT, ESTRUTURA e UX — nunca tokens.
2. **Dados existentes**: O app já tem toda a lógica de domínio. Esta migração é PURAMENTE visual/UX.
3. **Código em inglês**: Variáveis, nomes de componentes e comentários em inglês. Textos de UI via i18n.
4. **Dark mode é primário**: Todos os wireframes estão em dark mode, consistente com o nosso design system.
5. **Marcações**: `[EXISTE]` = funcionalidade já implementada, mudar só layout. `[NOVO]` = funcionalidade não existe no app, criar do zero. `[EVOLUÇÃO]` = existe parcialmente, precisa ser estendida.

---

## 1. Itinerary Empty State

**Wireframe**: `itinerary_empty_state/screen.png`
**Componente atual**: `ItineraryPage.tsx` (branch `legs.length === 0`)
**Rota**: `/itinerary`

### O que o wireframe mostra

- Header com "TripPilot" centralizado, hambúrguer esquerda, avatar direita
- Área central com ilustração estilizada:
  - Círculo grande cinza escuro com ícone de rota (estilo trilho sinuoso) em terracotta
  - Dois ícones menores flutuando ao redor (pin de localização + ícone de itinerário)
- Título: "Monte seu itinerário"
- Subtítulo: "Planeje cada detalhe da sua viagem ou deixe nossa IA cuidar de tudo para você."
- Botão primário: "Criar com IA" (background gradiente roxo/AI, ícone sparkle) — full width
- Botão secundário: "Criar manualmente" (outline, fundo transparente, ícone de edição) — full width
- Bottom nav padrão do app

### O que temos hoje

- Ícone `route` dentro de div com bg-primary/10, sem ícones flutuantes
- Título e subtítulo iguais ao wireframe (conteúdo ok, estilo diferente)
- Botão "Criar com IA" com background `var(--primary)` sólido, cor `var(--surface)`
- Botão "Criar manualmente" com background `var(--surface-high)`, borda `var(--border-faint)`

### Mudanças necessárias

| Nº | Elemento | Hoje | Wireframe | Ação |
|----|----------|------|-----------|------|
| 1.1 | Ilustração central | Div simples com ícone | Círculo grande com ícone estilizado + 2 ícones menores flutuantes | `[EVOLUÇÃO]` Criar composição com 3 elementos: círculo central (~96px) com ícone rota + 2 ícones menores (pin + itinerário) posicionados em offset com animação sutil float |
| 1.2 | Botão "Criar com IA" | `--primary` sólido | Gradiente AI (roxo) | `[EXISTE]` Trocar para `--ai-gradient` (já temos o token). Adicionar ícone `auto_awesome` |
| 1.3 | Botão "Criar manualmente" | Background sólido + borda | Outline transparente com borda sutil | `[EXISTE]` Trocar para variante ghost: fundo transparente, borda 1px `--on-surface` a 10%, ícone `edit_note` |
| 1.4 | Espaçamento | Centralizado com gap-5 | Mais espaço vertical entre ilustração e texto | `[EXISTE]` Aumentar gap entre ilustração e texto para ~32px, entre texto e botões para ~24px |
| 1.5 | Subtítulo | `text-sm text-on-surface-dim` | Texto mais claro, multilinhas centralizado | `[EXISTE]` Manter, ajustar para `max-w-[280px]` para forçar wrap natural bonito |

---

## 2. Itinerary — Transit Day View (TELA PRINCIPAL com legs)

**Wireframe**: `itinerary_transit_day_view/screen.png`
**Componente atual**: `ItineraryPage.tsx` (branch com legs, quando dayType é `transit`)
**Rota**: `/itinerary`

### O que o wireframe mostra

Esta é a mudança mais radical. O wireframe propõe uma **timeline vertical** em vez de cards de agenda.

#### Layout wireframe (de cima para baixo):

1. **Hero banner com imagem da cidade**:
   - Imagem de fundo (foto real da cidade, ex: janela de trem)
   - Overlay escuro
   - Badge: "DAY 4 · TRANSIT" em texto monospace laranja
   - Título grande: "On The Move" (ou nome da cidade)
   
2. **Timeline vertical** com linha laranja:
   - Linha vertical contínua na esquerda (cor primary)
   - Círculos (nós) na linha para cada ponto:
     - Círculo vazio = passado/departed
     - Círculo cheio com animação = ativo/próximo
   - Cada nó tem:
     - Badge de status ("DEPARTED", "NEXT STOP", "DESTINATION")
     - Horário + info (ex: "08:30 AM · TP1042")
     - Nome da cidade em tipografia grande e bold
     - Sub-cards opcionais:
       - "Lounge Access Available" com localização `[NOVO]`
       - Info de layover ("Arr 10:45 AM · Layover: 2h")
   - Ponto final: "DESTINATION" com hora estimada de chegada

3. **Bottom nav** padrão

### O que temos hoje

- Calendário horizontal de dias no topo
- Card hero da cidade com background colorido por dayType
- Lista de agenda cards (cards retangulares com borda lateral colorida)
- Seção de notas e budget premise
- FAB flutuante "+"

### Mudanças necessárias

| Nº | Elemento | Hoje | Wireframe | Ação |
|----|----------|------|-----------|------|
| 2.1 | Hero banner | Card retangular com cor sólida | Imagem de fundo + overlay + badge | `[EVOLUÇÃO]` Criar hero banner com: (a) fallback com gradiente sólido por dayType se não houver imagem; (b) futuramente: imagem da cidade via API. Badge com dayType em mono uppercase |
| 2.2 | Título do hero | Nome da cidade em `text-lg font-bold` | Nome da cidade GRANDE (display-level) | `[EXISTE]` Aumentar para `text-2xl` ou `text-3xl font-extrabold` dentro do hero |
| 2.3 | Layout de agenda | Cards retangulares empilhados verticalmente | Timeline vertical com linha + nós | `[EVOLUÇÃO]` Redesenhar agenda como timeline: linha vertical à esquerda (`border-l-2` em `--primary`), nós circulares nos pontos de evento, conteúdo à direita de cada nó |
| 2.4 | Eventos na timeline | Cards com borda lateral colorida | Nós inline com badge de status + info empilhada | `[EVOLUÇÃO]` Cada evento vira um nó na timeline: badge (DEPARTED/NEXT STOP/ARRIVAL), horário, nome da cidade em destaque, sub-cards com detalhes |
| 2.5 | Sub-cards em eventos | Não existe | Cards de contexto dentro de nós (lounge, layover info) | `[NOVO]` Adicionar suporte a sub-cards em cada nó da timeline para informações extras (ex: tipo de transporte, gate, lounge). Dados viriam de campos existentes (`arrivalTransport.notes`, `highlights`) |
| 2.6 | Calendário horizontal | Existe no topo | Aparece no wireframe `itinerary_gps_override_state` | `[EXISTE]` MANTER calendário horizontal, posicionar ACIMA do hero (como no override wireframe). Manter swipe |
| 2.7 | Status visual do nó | Não existe | Círculo vazio = passado, cheio = ativo, anel = futuro | `[NOVO]` Calcular status baseado em horário atual vs horário do evento: `past` (departureTime < now), `active` (happening now), `future` (not yet) |
| 2.8 | Hero imagem cidade | Não existe | Foto real da cidade como background | `[NOVO]` Fase futura: integrar API de imagens (Unsplash/Pexels) por nome da cidade. MVP: gradiente sólido por dayType. Adicionar campo `imageUrl` ao `ItineraryLeg` (opcional, preenchido pela IA ou manual) |

### Decisão de design: TRANSIT vs FULL day

O wireframe mostra a tela específica de um **transit day** (dia de deslocamento). Para dias `full`, `festival`, `rest`, `day_trip`, o layout é diferente — veja seção 6 (Highlight Notes View). A ItineraryPage deve renderizar **layouts diferentes por dayType**:
- `transit` → Timeline vertical (este wireframe)
- `full` / `festival` / `rest` / `day_trip` → Card hero + agenda de atividades (wireframe 6)

---

## 3. GPS Opt-In State

**Wireframe**: `itinerary_gps_opt_in_state/screen.png`
**Componente atual**: `ItineraryPage.tsx` (seção GPS, quando `!gps.enabled`)
**Rota**: `/itinerary`

### O que o wireframe mostra

Tela inteira dedicada ao opt-in (não é inline):
- Ícone GPS grande dentro de círculo marrom
- Título: "Detect current city automatically?"
- Descrição: "Allow TripPilot to use your location to instantly set up your local itinerary, find nearby transit, and estimate daily costs."
- Botão primário: "Enable GPS" (terracotta, full width)
- Link secundário: "Search manually instead"

### O que temos hoje

Um botão inline pequeno na ItineraryPage: `"Ativar GPS"` com ícone gps_fixed, fundo `bg-surface-high`.

### Mudanças necessárias

| Nº | Elemento | Hoje | Wireframe | Ação |
|----|----------|------|-----------|------|
| 3.1 | Layout de opt-in | Botão inline pequeno | Card centralizado grande com explicação completa | `[EVOLUÇÃO]` Trocar o botão inline por um **card de opt-in** centralizado que explica o valor do GPS. Card com padding generoso, ícone grande (48px), título bold, descrição, CTA + link secundário. Aparece apenas quando GPS nunca foi ativado antes |
| 3.2 | Ícone | `gps_fixed` 14px | Ícone GPS grande (48px) dentro de círculo decorativo | `[EVOLUÇÃO]` Ícone `gps_fixed` 48px dentro de div 80px com bg-primary/15 |
| 3.3 | Texto explicativo | Nenhum (só "Ativar GPS") | Descrição completa do valor | `[EVOLUÇÃO]` Adicionar i18n: `itinerary.gps_opt_in_title` + `itinerary.gps_opt_in_desc` |
| 3.4 | Ação secundária | Não existe | "Search manually instead" | `[NOVO]` Adicionar link "Buscar manualmente" que abre o seletor de leg sem GPS. Pode ser um dismiss do card de opt-in |
| 3.5 | Posicionamento | Inline no topo da tela | Centralizado no conteúdo principal | `[EVOLUÇÃO]` Quando GPS nunca foi ativado e o viajante está na ItineraryPage, mostrar o card de opt-in como seção proeminente entre o calendário e a agenda |

### Nota importante

O card de opt-in aparece APENAS na primeira vez. Depois que o viajante fez a escolha (ativou ou dispensou), muda para o estado inline discreto que temos hoje (ícone pequeno para reativar).

---

## 4. GPS Matched State

**Wireframe**: `itinerary_gps_matched_state/screen.png`
**Componente atual**: `ItineraryPage.tsx` (seção GPS, quando `gps.detectedLeg` e sem override)
**Rota**: `/itinerary`

### O que o wireframe mostra

Layout rico quando o GPS confirmou a cidade:

1. **Header**: "ACTIVE TRIP" badge + nome da trip ("European Autumn Tour")
2. **GPS status bar**: "Live GPS Tracking · Syncing local data" com ícone pulsante + botão "Disable GPS"
3. **Hero card com imagem**: Foto real da cidade (Paris com Torre Eiffel)
   - Badge: "Current Leg · Day 3 of 5"
   - Nome da cidade grande: "Paris"
   - Badge verde: "Location verified" com check
   - Info de clima: "18°C Clear" com ícone
4. **Today's Schedule**: Timeline com data
   - Lista de eventos com horário à esquerda, conteúdo à direita
   - Evento ativo ("Louvre Museum Tour") destacado com card expandido:
     - Badge "LIVE" em laranja
     - Descrição: "Pre-booked skip-the-line tickets..."
     - Dois botões de ação: "View Map" + "Tickets"
   - Linha vertical conectando eventos

### O que temos hoje

- Indicador inline verde com nome da cidade detectada
- Sem imagem, sem clima, sem "LIVE" badge
- Agenda é lista de cards (não timeline)

### Mudanças necessárias

| Nº | Elemento | Hoje | Wireframe | Ação |
|----|----------|------|-----------|------|
| 4.1 | Trip name no header | Não existe nesta tela | "ACTIVE TRIP" + nome da trip | `[EVOLUÇÃO]` Adicionar o nome da trip ativa acima do conteúdo quando GPS está matched |
| 4.2 | GPS status bar | Indicador inline pequeno | Barra completa com status + botão disable | `[EVOLUÇÃO]` Transformar o indicador GPS em barra de status: ícone pulsante + "GPS ativo · Cidade confirmada" + botão "Desativar" |
| 4.3 | Hero com imagem | Card com bg sólida por dayType | Card com imagem de fundo da cidade | `[EVOLUÇÃO]` Mesmo tratamento de 2.1 — hero com imagem. MVP: gradiente. Futuro: foto da cidade |
| 4.4 | "Location verified" | Não existe | Badge verde | `[NOVO]` Quando GPS confirma a cidade esperada (sem override), mostrar badge "Localização confirmada" com ícone check |
| 4.5 | Clima | Não existe | "18°C Clear" | `[NOVO]` Fase futura. Adicionar campo `weather` ao contexto de leg ou buscar via API de clima. Por ora: não implementar, mas reservar espaço no hero card |
| 4.6 | Evento ativo "LIVE" | Não existe | Badge "LIVE" no evento que está acontecendo agora | `[NOVO]` Calcular qual evento está acontecendo AGORA (horário atual entre startTime e endTime do evento). Marcar com badge "LIVE" pulsante em `--primary` |
| 4.7 | Botões de ação em eventos | Não existe | "View Map" + "Tickets" em eventos expandidos | `[NOVO]` Fase futura. Requer dados extras no ItineraryLeg (links de tickets, coordenadas de POI). Reservar espaço no layout |
| 4.8 | Timeline de eventos | Cards empilhados com borda lateral | Timeline vertical com linha + nós temporais | `[EVOLUÇÃO]` Mesmo redesign de 2.3 — timeline com horários à esquerda e conteúdo à direita |

---

## 5. GPS Override State

**Wireframe**: `itinerary_gps_override_state/screen.png`
**Componente atual**: `ItineraryPage.tsx` (seção GPS, quando `gpsOverrideActive`)
**Rota**: `/itinerary`

### O que o wireframe mostra

1. **Barra de override no topo**: Fundo `--surface-container-high` com:
   - Ícone GPS + "Ljubljana"
   - Texto secundário: "(era Veneza por data)"
   - Botão "USAR DATA" em destaque (fundo terracotta)
2. **Calendário horizontal** compacto (MON-FRI visível, TUE 13 selecionado com bolinha)
3. **Hero card com imagem** de Ljubljana:
   - Badge "GPS OVERRIDDEN" em laranja
   - Cidade grande: "Ljubljana, SI"
   - Sub-info: "Day 2 · Unexpected Detour"
   - Ícone sparkle no canto (sugestão AI)
4. **Timeline de eventos** similar ao transit day:
   - "10:00 AM" — Brunch at Kavarna Zvezda (card expandido com sugestão AI)
   - "1:00 PM" — Ljubljana Castle
   - "END OF DAY"

### O que temos hoje

- Barra de override inline com texto, funcional mas visualmente simples
- Sem imagem, sem badge "GPS OVERRIDDEN"
- Sem "Unexpected Detour" contextual

### Mudanças necessárias

| Nº | Elemento | Hoje | Wireframe | Ação |
|----|----------|------|-----------|------|
| 5.1 | Barra de override | Inline com bg-primary/10 | Card completo no topo com GPS info + botão prominente | `[EVOLUÇÃO]` Redesenhar como card proeminente: ícone GPS + cidade GPS + "(era {cidade} por data)" + botão "USAR DATA" com bg `--primary`. Padding generoso, rounded-2xl |
| 5.2 | Badge no hero | Não existe | "GPS OVERRIDDEN" em laranja | `[EVOLUÇÃO]` Adicionar badge condicional no hero: quando override ativo, mostrar "GPS OVERRIDE" em uppercase mono com `--primary` |
| 5.3 | Subtítulo contextual | Não existe | "Day 2 · Unexpected Detour" | `[NOVO]` Quando override ativo, mostrar texto contextual. "Unexpected Detour" pode ser label i18n `itinerary.gps_detour` |
| 5.4 | Sugestão AI no evento | Não existe | "Recommended by AI Copilot for quick bites near the center" | `[NOVO]` Fase futura. Requer integração AI para sugestões contextuais por cidade. Reservar espaço visual |
| 5.5 | "END OF DAY" marker | Não existe | Marcador no fim da timeline | `[NOVO]` Adicionar marcador visual "Fim do dia" no final da timeline quando não há mais eventos |

---

## 6. Highlight & Notes View (dia completo / full day)

**Wireframe**: `itinerary_highlight_notes_view/screen.png`
**Componente atual**: `ItineraryPage.tsx` (seções budget, agenda, notes)
**Rota**: `/itinerary`

### O que o wireframe mostra

Layout para dias `full` (não transit):

1. **Calendário horizontal** compacto no topo
2. **Hero card com imagem** de fundo:
   - Nome da cidade: "Ljubljana, SI"
   - "BUDGET DIÁRIO" em mono uppercase
   - Valor: "€45 / €80" em destaque
   - Badge: "On Track" com check (verde)
   - Barra de progresso abaixo do valor
3. **Seção AGENDA**:
   - Card de evento grande:
     - Horário "11:00" em destaque + "13:30" (duração)
     - Título: "Highlight: Tour pelo Castelo"
     - Localização: pin icon + "Grajska planota 1"
     - Tags: "Atração" + "€12"
     - Menu "..." no canto
4. **Card "Premissa do Dia"** (budget premise):
   - Ícone de lâmpada
   - Título bold
   - Texto descritivo multi-linha
5. **Seção "PERSONAL NOTES"**:
   - Header com label mono + botão "Editar" em terracotta
   - Texto da nota em card separado
6. **FAB** "+" no canto inferior direito

### O que temos hoje

- Hero card com bg sólida por dayType, sem imagem
- Budget bar dentro do hero card (gasto vs orçamento)
- Agenda como cards com borda lateral
- Budget premise como card com ícone lâmpada
- Notas como textarea inline
- FAB "+"

### Mudanças necessárias

| Nº | Elemento | Hoje | Wireframe | Ação |
|----|----------|------|-----------|------|
| 6.1 | Hero card | Bg sólida por dayType com badge | Imagem de fundo + budget proeminente + badge status | `[EVOLUÇÃO]` Hero com: imagem (fallback gradiente), cidade grande, budget diário com barra integrada, badge de status do budget ("On Track" / "Atenção" / "Acima") |
| 6.2 | Budget no hero | Barra fina + label `text-[10px]` | Budget é feature prominente: valor grande + "/ €80" + badge status | `[EVOLUÇÃO]` Aumentar visibilidade: valor em `text-xl font-bold`, meta em `text-sm`, badge status com cor semântica (verde/âmbar/vermelho) |
| 6.3 | Badge de budget status | Não existe | "On Track" com check verde | `[NOVO]` Calcular status: gasto < 80% meta = "On Track" (verde), 80-100% = "Atenção" (âmbar), >100% = "Acima" (vermelho). Badge pill com ícone check/warning/error |
| 6.4 | Evento com duração | Só horário inicial | Horário inicial + final (ex: "11:00" + "13:30") | `[NOVO]` Adicionar campo `endTime` ao highlight/evento ou calcular a partir de `duration`. Mostrar ambos horários empilhados |
| 6.5 | Localização em eventos | Não existe | Pin icon + endereço | `[NOVO]` Adicionar campo `location` ao `DayAgendaItem` (pode vir de `highlights[].location` no ItineraryLeg). Mostrar com ícone `location_on` |
| 6.6 | Tags em eventos | Não existe | Pills com tipo ("Atração") + custo ("€12") | `[NOVO]` Adicionar tags: tipo do highlight (atração/restaurante/etc) + custo estimado. Dados de `highlights[]` no ItineraryLeg |
| 6.7 | Seção "AGENDA" label | Não existe como label separado | Label mono uppercase "AGENDA" antes dos eventos | `[EVOLUÇÃO]` Adicionar section labels em mono uppercase com `tracking-[0.15em]` conforme design system |
| 6.8 | Notas — botão Editar | Textarea sempre visível | Label "PERSONAL NOTES" + botão "Editar" + texto em modo leitura | `[EVOLUÇÃO]` Mudar notas de textarea-always para: modo leitura com texto + botão "Editar" que transforma em textarea. Mais limpo e menos cognitivamente pesado |
| 6.9 | Premissa do dia | Card com ícone lâmpada | Design idêntico | `[EXISTE]` Manter layout atual, ajustar padding e tipografia para consistência com o resto |

---

## 7. Map — Split View Variant

**Wireframe**: `itinerary_map_split_view_variant/screen.png`
**Componente atual**: `ItineraryMapPage.tsx`
**Rota**: `/itinerary/map`

### O que o wireframe mostra

Tela dividida em duas seções:

1. **Metade superior — Mapa**:
   - Mapa escuro (dark tiles)
   - Rota com linhas coloridas:
     - Trecho percorrido = linha sólida laranja
     - Trecho futuro = linha pontilhada roxa/azul
   - Pins com labels: nome da cidade + "X Days" em mono
   - Pin ativo (Madrid) maior e com borda
   - Labels de cidades nos pins

2. **Metade inferior — Lista de legs**:
   - Cards empilhados com info resumida:
     - "DIAS 1-3" em mono uppercase
     - Nome da cidade grande
     - Descrição contextual
   - Card ativo ("DIAS 4-6 · ATUAL") destacado com borda lateral laranja + ícone
   - Card futuro com borda lateral roxa + ícone diferente

### O que temos hoje

- Mapa full-height (Leaflet, tiles claros padrão)
- Pins coloridos por dayType
- Linhas conectando (sólidas vs pontilhadas)
- Popups ao clicar
- Sem lista de legs abaixo

### Mudanças necessárias

| Nº | Elemento | Hoje | Wireframe | Ação |
|----|----------|------|-----------|------|
| 7.1 | Layout split | Mapa full-height | Split: mapa ~50% + lista ~50% | `[EVOLUÇÃO]` Dividir a tela: mapa na metade superior (h-[45vh]), lista scrollável na metade inferior. Mapa com pan/zoom funcional |
| 7.2 | Tiles do mapa | Tiles claros padrão (OSM) | Tiles escuros (dark mode) | `[EVOLUÇÃO]` Já temos `createTileLayer` — adicionar/usar tile layer escuro (ex: CartoDB Dark Matter, Mapbox Dark). Verificar se já existe opção dark |
| 7.3 | Labels nos pins | Popup ao clicar | Labels permanentes ao lado dos pins com cidade + "X Days" | `[EVOLUÇÃO]` Trocar popup por tooltip permanente com nome da cidade + duração (departureDate - arrivalDate + 1) |
| 7.4 | Lista de legs abaixo do mapa | Não existe | Cards com dias, cidade, descrição, status (atual/passado/futuro) | `[NOVO]` Adicionar lista de legs scrollável abaixo do mapa. Cada card: "DIAS X-Y" (mono), nome da cidade (bold), descrição (primeira highlight ou "Chegada e..."). Card ativo com borda lateral `--primary` |
| 7.5 | Scroll da lista sincronizado | Não existe | Ao clicar num card, mapa centra naquela cidade. Ao clicar num pin, lista scrolla para o card | `[NOVO]` Sincronização bidirecional: tap card → `map.flyTo(coords)`. Tap pin → scroll lista para card correspondente |
| 7.6 | Cores das linhas | Todas em mesma cor (dayType) | Percorrido = laranja sólido, futuro = azul pontilhado | `[EVOLUÇÃO]` Diferenciar: trecho já percorrido (arrivalDate < today) → `--primary` sólido. Trecho futuro → `--ai` pontilhado |
| 7.7 | Pin ativo | Mesmo tamanho que outros | Pin maior com borda mais grossa | `[EVOLUÇÃO]` Pin da leg atual: iconSize maior (18px vs 14px), borda 3px, sem opacity reduction |

---

## 8. Booking Checklist

**Wireframe**: `booking_checklist_status_grouping_variant/screen.png`
**Componente atual**: `BookingChecklistPage.tsx`
**Rota**: `/itinerary/checklist`

### O que o wireframe mostra

1. **Header**: Título grande "Booking Checklist" + subtítulo explicativo
2. **Agrupamento por status** com headers de seção:
   - **Booked** (dot laranja + "Reserved, pending payment")
   - **Priced** (dot verde + "Ready to buy")
   - **Estimated** (dot âmbar + "Needs final price check")
   - **None** (dot cinza + "Needs research")
3. **Cards por item**:
   - Ícone do tipo (hostel/avião/trem/ônibus)
   - Nome: "Hostel Tresor" / "Madrid → Venice"
   - Info mono: "REF: HT-8921-X" / "VUELING VY123"
   - Data mono: "Oct 12 – Oct 15" / "Oct 12, 14:30"
   - Valor no canto direito: "€120" / "€85" / "~€30" / "–"
   - **Botão de ação diferente por status**:
     - Booked → "Mark as Purchased" (outline)
     - Priced → "Record Purchase" (terracotta sólido)
     - Estimated → "Finalize & Buy" (outline)
     - None → "+ Update Details" (outline) + "Find options" (link)

### O que temos hoje

- Agrupamento por status existe
- Cards simples com emoji + rota/nome + custo
- Apenas um botão "Marcar como comprado" para todos

### Mudanças necessárias

| Nº | Elemento | Hoje | Wireframe | Ação |
|----|----------|------|-----------|------|
| 8.1 | Título | Sem título proeminente | "Booking Checklist" grande + subtítulo | `[EVOLUÇÃO]` Adicionar título `text-2xl font-bold` + subtítulo `text-sm text-on-surface-dim` no topo |
| 8.2 | Headers de seção | Label simples | Dot colorido + nome do status + descrição auxiliar | `[EVOLUÇÃO]` Header de seção: dot (6px circle, cor do status) + título bold + subtexto explicativo em dim. Usar `tracking-[0.05em]` |
| 8.3 | Cards | Cards minimalistas | Cards ricos com ícone + referência + data mono | `[EVOLUÇÃO]` Redesenhar card: ícone do tipo (Material Symbol, não emoji), nome bold, referência em JetBrains Mono, data em mono, valor alinhado à direita |
| 8.4 | Ícones | Emojis (✈️, 🚂, etc.) | Material Symbols (ícones do design system) | `[EVOLUÇÃO]` Trocar emojis por ícones: `flight`, `train`, `directions_bus`, `hotel`, `apartment`, etc. Cada um dentro de circle (40px) com bg do status a 10% |
| 8.5 | Referência | Não existe | Texto mono "REF: XX-XXXX" | `[NOVO]` Mostrar `arrivalTransport.bookingReference` ou `accommodation.bookingReference` em mono. Dados já existem no ItineraryLeg (campo `notes` pode conter, ou adicionar `bookingReference` se não existir) |
| 8.6 | Ação por status | Mesmo botão para todos | Botão diferente por status (cor, texto, estilo) | `[EVOLUÇÃO]` Botão contextual: `booked` → "Marcar como comprado" (ghost), `priced` → "Registrar compra" (primary sólido), `estimated` → "Finalizar e comprar" (ghost), `none` → "+ Atualizar" (ghost) |
| 8.7 | "Find options" para None | Não existe | Link de pesquisa para itens sem status | `[NOVO]` Fase futura. Link para busca externa ou sugestão. Reservar espaço |

---

## 9. Dashboard — Itinerary Info Variant (ItineraryContextCard expandido)

**Wireframe**: `dashboard_itinerary_info_variant/screen.png`
**Componente atual**: `ItineraryContextCard.tsx`
**Rota**: Dashboard (`/`)

### O que o wireframe mostra

Card expandido no dashboard com informação rica:

1. **Header do card**:
   - Dot colorido + "Barcelona" (cidade)
   - "Dia 3 de 21"
   - Menu "..." no canto
2. **Duas colunas** side-by-side:
   - TRANSPORTE: ícone trem + "14:30 para Madrid"
   - HOSPEDAGEM: ícone cama + "Generator Hostel"
3. **AGENDA DO DIA** (timeline compacta):
   - 09:00 — ○ Checkout
   - 10:30 — ● Sagrada Familia (cor)
   - 13:00 — ○ Almoço
   - **14:30** — ● Trem para Madrid (cor laranja, destaque)
   - 18:00 — ○ Hotel Check-in
4. **Orçamento do Dia**: "€78 / €120" com barra de progresso
5. **Link**: "Ver agenda completa →"
6. **Card separado abaixo**: "Amigo sincero" (IA tip sobre economia)

### O que temos hoje

- Card simples com cidade + dot + "Dia X de Y"
- Próximo transporte (emoji + destino)
- Hospedagem
- Expandido: agenda resumida (até 5 itens) + barra orçamento
- Link "Ver agenda"

### Mudanças necessárias

| Nº | Elemento | Hoje | Wireframe | Ação |
|----|----------|------|-----------|------|
| 9.1 | Colunas transporte/hospedagem | Itens empilhados verticalmente | Side-by-side em duas colunas com label mono uppercase | `[EVOLUÇÃO]` Criar grid 2-col para TRANSPORTE e HOSPEDAGEM: label mono uppercase em `text-[10px] tracking-[0.15em]`, ícone + info abaixo |
| 9.2 | Agenda timeline | Lista simples com time + label | Mini-timeline com dots coloridos por tipo | `[EVOLUÇÃO]` Redesenhar agenda como mini-timeline: horário à esquerda (mono), dot (cor por tipo), label à direita. Item ativo destacado (cor `--primary`) |
| 9.3 | Item ativo na agenda | Sem destaque | Cor laranja no horário + dot preenchido | `[EVOLUÇÃO]` O item cujo horário é o próximo transporte ou próximo evento futuro: horário em `--primary`, dot preenchido em `--primary` |
| 9.4 | Menu "..." | Não existe | Menu no canto superior direito do card | `[NOVO]` Adicionar menu "..." com opções: "Ir para itinerário", "Desativar GPS", "Esconder card" |
| 9.5 | Budget label | "formatMoney / formatMoney" | "Orçamento do Dia" em label + valores separados | `[EVOLUÇÃO]` Adicionar label "Orçamento do dia" em mono uppercase antes da barra + valores |

---

## 10. Dashboard — Visual Variant (alternativa com overview financeiro)

**Wireframe**: `dashboard_itinerary_visual_variant/screen.png`
**Componente atual**: `ItineraryContextCard.tsx` + Dashboard
**Rota**: Dashboard (`/`)

### O que o wireframe mostra

Versão mais compacta e focada em finanças:

1. **Itinerary card compacto**:
   - Pin GPS + "Burgos" + "DIA 14 DE 24"
   - "Ver agenda" link no canto
   - Dois sub-cards:
     - Ícone trem + "18:20 para Lisboa"
     - Ícone hospedagem + "Altido Castle Apartment"
2. **Overview section**:
   - Dois cards side-by-side:
     - "LIVRE HOJE" — "€ 31,91"
     - "RESERVA" — "€ 150,00"
3. **Últimos Gastos**: lista de transações recentes com ícones

### Decisão

Este wireframe mostra uma VARIANTE de design para o ItineraryContextCard + dashboard. As diferenças chave vs o wireframe 9:
- Card de itinerário mais compacto (sem agenda inline)
- Overview financeiro (LIVRE HOJE / RESERVA) como seção separada — isso já existe no dashboard atual
- Transporte e hospedagem como sub-cards em vez de colunas

### Mudanças necessárias

| Nº | Elemento | Hoje | Wireframe | Ação |
|----|----------|------|-----------|------|
| 10.1 | Sub-cards transporte/hospedagem | Texto inline | Cards com ícone + fundo sutil | `[EVOLUÇÃO]` Renderizar transporte e hospedagem como mini-cards com fundo `--surface-container`, ícone à esquerda (Material Symbol em circle 28px), texto à direita |
| 10.2 | "Ver agenda" posição | Link no rodapé do card | Link no canto superior direito (mesmo nível que cidade) | `[EVOLUÇÃO]` Mover "Ver agenda" para o header do card, alinhado à direita da cidade |

### Nota de implementação

Considerar oferecer AMBAS as variantes (info expandido vs visual compacto) como preferência do usuário ou como estado default (colapsado = visual, expandido = info). Isso já é parcialmente implementado com o toggle expand/collapse.

---

## 11. Dashboard — GPS Detecting State

**Wireframe**: `dashboard_gps_detecting_state/screen.png`
**Componente atual**: Dashboard + `ItineraryContextCard.tsx`
**Rota**: Dashboard (`/`)

### O que o wireframe mostra

Estado de loading do GPS no dashboard:

1. **Card de GPS no topo** (onde normalmente estaria o ItineraryContextCard):
   - Ícone GPS + skeleton/placeholder de texto
   - Badge "Detecting" com animação
   - "Finding your city..." com ícone sparkle
   - 3 placeholders retangulares (skeleton loading)
2. **Recent Activity**: lista de gastos recentes

### O que temos hoje

O ItineraryContextCard não mostra estado de loading/detecting para GPS — ele simplesmente não mostra dados de GPS até detectar.

### Mudanças necessárias

| Nº | Elemento | Hoje | Wireframe | Ação |
|----|----------|------|-----------|------|
| 11.1 | GPS detecting no dashboard | Não existe | Card skeleton com "Finding your city..." | `[NOVO]` Quando `gps.enabled && gps.detecting` no ItineraryContextCard: renderizar estado skeleton com placeholder animado + texto "Detectando cidade..." + badge "Detectando" pulsante |
| 11.2 | Skeleton placeholders | Não existe | 3 retângulos com shimmer animation | `[NOVO]` Usar Skeleton component (criar se não existir): divs com bg `--surface-container-high` e animação shimmer (gradient moving). 3 blocks representando: transporte, hospedagem, agenda |

---

## 12. Copilot — Choice Stage

**Wireframe**: `itinerary_copilot_choice_stage/screen.png`
**Componente atual**: `ItineraryCopilotFlow.tsx` (stage `choice`)
**Rota**: `/itinerary/create`

### O que o wireframe mostra

1. **Header**: seta voltar + "COPILOT" centralizado (mono uppercase)
2. **Ícone central**: Avião estilizado dentro de círculo cinza
3. **Título**: "Criar Itinerário" (grande, bold)
4. **Subtítulo**: "Sua IA ajudará a construir a viagem perfeita. Como você prefere começar?"
5. **Duas opções** (cards grandes):
   - "Passo a passo" — Ícone de roteiro + descrição. Fundo `--surface-container`
   - "Descrever livremente" — Ícone sparkle AI + descrição. Fundo com toque de `--ai` (gradiente sutil)

### O que temos hoje

Funcionalidade idêntica, layout básico.

### Mudanças necessárias

| Nº | Elemento | Hoje | Wireframe | Ação |
|----|----------|------|-----------|------|
| 12.1 | Header | Botão voltar genérico | "COPILOT" em mono uppercase centralizado | `[EVOLUÇÃO]` Header com seta voltar + "COPILOT" em `tracking-[0.15em] uppercase text-xs font-bold` centralizado |
| 12.2 | Ícone central | Sem ícone | Avião em círculo cinza escuro | `[EVOLUÇÃO]` Adicionar ícone `flight_takeoff` (48px) dentro de circle (80px) com bg `--surface-container` |
| 12.3 | Cards de opção | Botões simples | Cards grandes com ícone + título bold + descrição | `[EVOLUÇÃO]` Cada opção como card: rounded-2xl, padding 20px, ícone no circle (40px) à esquerda, título bold, descrição em dim abaixo. Card AI com toque de `--ai-bg-soft` |
| 12.4 | Diferenciação visual | Ambas opções iguais | "Descrever livremente" tem toque AI (borda ou bg sutilmente roxa) | `[EVOLUÇÃO]` Card AI: border 1px `--ai` a 15%, ou bg `--ai-bg-soft`. Ícone `auto_awesome` em `--ai` |

---

## 13. Copilot — Guided Question

**Wireframe**: `itinerary_copilot_guided_question/screen.png`
**Componente atual**: `ItineraryCopilotFlow.tsx` (stage `guided`)
**Rota**: `/itinerary/create`

### O que o wireframe mostra

1. **Header**: seta voltar + "Guided Mode"
2. **Barra de progresso**: "PERGUNTA 1 DE 6" (mono) + "16%" + barra laranja
3. **Ícone central grande**: Globo (🌍) dentro de círculo
4. **Pergunta grande**: "Quais cidades você vai visitar?" (tipografia display)
5. **Input**: Campo grande com placeholder "ex: Paris, Amsterdam, Berlim", ícone pin, borda azul de focus
6. **Helper text**: "Separe múltiplas cidades por vírgula."
7. **Botões no rodapé**: "Voltar" (ghost) + "Próximo →" (primary terracotta)

### O que temos hoje

Funcionalidade existe, layout mais simples.

### Mudanças necessárias

| Nº | Elemento | Hoje | Wireframe | Ação |
|----|----------|------|-----------|------|
| 13.1 | Barra de progresso | Sem barra | Barra laranja + "PERGUNTA X DE 6" mono + percentual | `[EVOLUÇÃO]` Adicionar progress bar: barra fina (`h-1`, `--primary`), label mono com número/total, percentual no canto |
| 13.2 | Pergunta | Tamanho normal | Tipografia display grande (`text-2xl` ou `text-3xl`) | `[EVOLUÇÃO]` Aumentar tamanho da pergunta para criar impacto visual. Espaço generoso acima e abaixo |
| 13.3 | Ícone central | Emoji pequeno | Ícone grande (48px) dentro de circle (80px) com bg sutil | `[EVOLUÇÃO]` Ícone Material Symbol (não emoji) em circle. Mapeamento: 🌍→`public`, 📅→`calendar_month`, 🚂→`train`, 🏠→`hotel`, 🎉→`celebration`, 💰→`savings` |
| 13.4 | Input | Input básico | Input grande com ícone pin, placeholder descritivo, borda de focus azul/AI | `[EVOLUÇÃO]` Input maior (py-4), ícone `location_on` à esquerda, focus ring em `--primary` |
| 13.5 | Helper text | Não existe | Texto auxiliar abaixo do input | `[NOVO]` Adicionar helper text contextual por pergunta (i18n) |
| 13.6 | Botões fixos no rodapé | Inline | Fixos no bottom da tela (sticky) | `[EVOLUÇÃO]` Botões Voltar + Próximo fixos no bottom (sticky), full-width dentro de container. "Próximo" em `--primary`, "Voltar" ghost |

---

## 14. Copilot — Free Text Input

**Wireframe**: `itinerary_copilot_free_text_input/screen.png`
**Componente atual**: `ItineraryCopilotFlow.tsx` (stage `input`)
**Rota**: `/itinerary/create`

### O que o wireframe mostra

1. **Header**: seta voltar + "TripPilot"
2. **Título**: "Descreva sua viagem" (bold, grande)
3. **Subtítulo**: "Conte para a IA os lugares, datas e o que você gosta de fazer. Ela cuida do resto."
4. **Textarea grande**: Com placeholder rico ("Ex: Vou para Kyoto de 10 a 15 de Outubro. Gosto de templos antigos..."). Borda sutil, fundo `--surface-container`
5. **Rodapé do textarea**: Ícones de atalho (pin, calendário) + contador "0 / 500"
6. **Botão**: "Gerar itinerário" (terracotta, full width) com ícone sparkle

### O que temos hoje

Textarea básico + botão "Gerar itinerário". Sem contador, sem ícones de atalho.

### Mudanças necessárias

| Nº | Elemento | Hoje | Wireframe | Ação |
|----|----------|------|-----------|------|
| 14.1 | Subtítulo | Sem subtítulo explicativo | Texto que explica o que escrever | `[EVOLUÇÃO]` Adicionar subtítulo i18n abaixo do título |
| 14.2 | Textarea | Input básico | Textarea grande com placeholder rico | `[EVOLUÇÃO]` Textarea `min-h-[200px]`, placeholder descritivo com exemplo real, fundo `--surface-container`, borda sutil |
| 14.3 | Contador de caracteres | Não existe | "0 / 500" no rodapé do textarea | `[NOVO]` Adicionar contador de caracteres: `${text.length} / 500` alinhado à direita no rodapé |
| 14.4 | Ícones de atalho | Não existe | Pin + calendário no rodapé do textarea | `[NOVO]` Fase futura. Ícones que inserem templates no texto (ex: clicar pin adiciona "Cidades: "). Reservar espaço |
| 14.5 | Botão com sparkle | Botão sem ícone | Ícone `auto_awesome` no botão | `[EXISTE]` Adicionar ícone sparkle ao botão "Gerar itinerário" |

---

## 15. Copilot — Loading State

**Wireframe**: `itinerary_copilot_loading_state/screen.png`
**Componente atual**: `ItineraryCopilotFlow.tsx` (stage `loading`)
**Rota**: `/itinerary/create`

### O que o wireframe mostra

1. **Ícone central**: Avião dentro de anel de progresso circular (laranja + roxo)
2. **Título**: "Desenhando seu itinerário..."
3. **Subtítulo**: "Nossa IA está organizando transportes, hospedagens e dicas para sua viagem."
4. **Checklist de progresso** (3 itens):
   - ✓ "Analisando preferências" (completo, check verde)
   - ✓ "Buscando melhores rotas" (completo, check verde)
   - ⟳ "Calculando orçamentos" (em andamento, spinner laranja, borda lateral laranja)

### O que temos hoje

Loading simples com spinner e mensagem.

### Mudanças necessárias

| Nº | Elemento | Hoje | Wireframe | Ação |
|----|----------|------|-----------|------|
| 15.1 | Anel de progresso | Spinner genérico | Anel circular com gradiente (laranja → roxo) ao redor do ícone | `[EVOLUÇÃO]` Criar anel de progresso com CSS animation: `border` com gradiente `--primary` → `--ai`, animação rotate 2s infinite |
| 15.2 | Ícone no centro | Sem ícone | Avião dentro do anel | `[EVOLUÇÃO]` Ícone `flight_takeoff` (32px) no centro do anel |
| 15.3 | Checklist de progresso | Não existe | Lista de steps com status (completo/em andamento) | `[NOVO]` Simular progresso em 3 fases: step 1 completa após ~2s, step 2 após ~4s, step 3 fica em andamento até resposta da API. Cada step: ícone check (completo) ou spinner (andamento) + texto + borda lateral |
| 15.4 | Subtítulo | Mensagem genérica | Subtítulo explicativo detalhado | `[EVOLUÇÃO]` Texto mais rico via i18n |

---

## 16. Copilot — Preview & Refine

**Wireframe**: `itinerary_copilot_preview_refine/screen.png`
**Componente atual**: `ItineraryCopilotFlow.tsx` (stage `preview`) + `ItineraryPreview.tsx`
**Rota**: `/itinerary/create`

### O que o wireframe mostra

1. **Badge**: "AI Generated" em pill roxa com sparkle
2. **Título**: "Your European Adventure"
3. **Subtítulo**: "21 dias, 14 cidades, 5 países" (resumo em dim)
4. **Cards de leg**:
   - Nome da cidade: "Paris, France" (bold)
   - Datas: "OCT 10 – OCT 14 · 4 DAYS" (mono)
   - Thumbnail da cidade no canto direito (foto pequena)
   - Sub-card hospedagem: ícone cama + "Le Meurice" + "Check-in: 15:00" (mono)
5. **Conector entre legs**: "TGV Lyria · 3h 15m" (ícone trem + info em mono)
6. **Input de refinamento**: "Adicione um dia em Roma..." + botão "Refinar"
7. **Botão principal**: "Usar este itinerário" (terracotta, full width, ícone check)

### O que temos hoje

Preview funcional com cards de leg, botão refinar, botão usar. Sem thumbnails, sem conectores estilizados.

### Mudanças necessárias

| Nº | Elemento | Hoje | Wireframe | Ação |
|----|----------|------|-----------|------|
| 16.1 | Badge "AI Generated" | Sem badge | Pill roxa com ícone sparkle | `[EVOLUÇÃO]` Adicionar pill no topo: bg `--ai-bg-soft`, text `--ai`, ícone `auto_awesome`, "Gerado por IA" |
| 16.2 | Resumo | Texto simples | Subtítulo estruturado "X dias, Y cidades, Z países" | `[EVOLUÇÃO]` Calcular e mostrar: totalDays, totalCities, totalCountries (de `countryCode`) |
| 16.3 | Thumbnail cidade | Não existe | Foto pequena no canto do card | `[NOVO]` Fase futura. Requer API de imagens. MVP: mostrar flag emoji do país ou ícone do dayType |
| 16.4 | Conector entre legs | Sem conector visual | Ícone transporte + "TGV Lyria · 3h 15m" entre cards | `[EVOLUÇÃO]` Adicionar conector entre cards: ícone do transporte + nome da companhia + duração estimada (se disponível). Fundo `--surface`, centralizado com linhas pontilhadas |
| 16.5 | Hospedagem no card | Texto simples | Sub-card com ícone cama + nome + check-in | `[EVOLUÇÃO]` Dentro do card de leg, se tem hospedagem: mini-card com ícone `hotel` em circle + nome + "Check-in: {arrivalTime}" em mono |
| 16.6 | Input de refinamento | Textarea + botão separado | Input inline com botão "Refinar" ao lado | `[EVOLUÇÃO]` Input single-line com placeholder rico + botão "Refinar" ao lado (inline-flex). Ícone sparkle no input |
| 16.7 | Botão "Usar" | Botão primário | Botão com ícone check (`check_circle`) | `[EVOLUÇÃO]` Adicionar ícone `check_circle` ao botão |

---

## 17. LegFormSheet (Formulário de Leg)

**Wireframe**: `legformsheet_overview_flow/screen.png`
**Componente atual**: `LegFormSheet.tsx`
**Rota**: Bottom sheet dentro de `/itinerary`

### O que o wireframe mostra

1. **Handle** (drag handle) no topo
2. **Título**: "Add Trip Leg" (bold, grande) + subtítulo: "Define location, dates, transport, and accommodation."
3. **Seção "Basic Information"** com ícone pin + título laranja:
   - DESTINATION CITY: input com ícone de busca
   - ARRIVAL DATE / DEPARTURE DATE: dois inputs lado a lado com ícones calendário
   - EST. ARRIVAL TIME / EST. DEPARTURE TIME: dois inputs lado a lado com ícones relógio
   - PACE: chips selecionáveis ("Active", "Relaxed", "Balanced") com ícones
   - COMPANIONS: input numérico
4. **Seção "Transport Details"** com ícone transporte + toggle:
   - Toggle azul (ativo) no canto
   - MODE OF TRANSPORT: (cortado no wireframe)
5. **Footer fixo**: 3 botões:
   - "EXCLUIR" (vermelho, ghost, ícone delete)
   - "CANCELAR" (ghost)
   - "SALVAR" (terracotta sólido)

### O que temos hoje

Form funcional com todos os campos, mas layout básico de inputs empilhados verticalmente.

### Mudanças necessárias

| Nº | Elemento | Hoje | Wireframe | Ação |
|----|----------|------|-----------|------|
| 17.1 | Título + subtítulo | Sem título proeminente | "Add Trip Leg" + subtítulo explicativo | `[EVOLUÇÃO]` Título bold grande + subtítulo dim no topo do sheet |
| 17.2 | Labels de seção | Labels inline sem destaque | "Basic Information" com ícone + cor `--primary` | `[EVOLUÇÃO]` Seções com ícone (pin, transporte, hospedagem) + título em `--primary` + padding vertical |
| 17.3 | Dates side-by-side | Empilhados verticalmente | Arrival Date / Departure Date em grid 2-col | `[EVOLUÇÃO]` Usar grid 2-col para: dates (arrival/departure) e times (arrival/departure). Labels em mono uppercase |
| 17.4 | Labels dos campos | `text-xs font-semibold` | Labels mono uppercase (tracking wide) | `[EVOLUÇÃO]` Labels em `text-[10px] tracking-[0.15em] uppercase font-bold text-on-surface-dim` (mono style) |
| 17.5 | PACE (dayType) | Select dropdown | Chips selecionáveis horizontais com ícone | `[EVOLUÇÃO]` Trocar select por chip group: chips horizontais scrolláveis, cada um com ícone + label. Chip selecionado: bg `--primary`, text `--on-primary`. Mapeamento: Active→`full`, Relaxed→`rest`, Balanced→`transit` (ou renomear) |
| 17.6 | COMPANIONS | Textarea com separação por vírgula | Input numérico (contador de pessoas) | `[EVOLUÇÃO]` O wireframe mostra "1" como número. Considerar: manter como lista de nomes (mais útil para splits) mas com UI de chips em vez de textarea |
| 17.7 | Toggle de seção | Toggle HTML checkbox | Toggle estilizado (switch) com cor azul quando ativo | `[EVOLUÇÃO]` Criar/usar componente ToggleSwitch: bg `--primary` quando on, bg `--surface-container-high` quando off. Posicionar no header da seção |
| 17.8 | Footer 3 botões | 1 botão "Salvar" | 3 botões fixos: Excluir (vermelho) + Cancelar + Salvar (terracotta) | `[EVOLUÇÃO]` Footer sticky com 3 botões: "EXCLUIR" (apenas se editando, ghost vermelho com ícone `delete`), "CANCELAR" (ghost), "SALVAR" (primary sólido). Usar `justify-between` |
| 17.9 | Input de busca cidade | Input text simples | Input com ícone de busca `search` | `[EVOLUÇÃO]` Adicionar ícone `search` à esquerda do input de cidade |

---

## 18. QuickAdd — Embedded Itinerary Reference

**Wireframe**: `quickadd_embedded_reference_variant/screen.png`
**Componente atual**: QuickAdd / AddExpensePage (usa `useItineraryDayContext`)
**Rota**: Tela de adicionar gasto

### O que o wireframe mostra

Integração do itinerário no QuickAdd:

1. **Header**: "Add Expense" + X (fechar) + check (salvar)
2. **Valor**: "€" + "0,00" grande (display)
3. **Contexto do itinerário**:
   - "📍 DAY 14 IN MADRID · BUDGET: €50,00" (mono)
   - Badge AI: "Expect ~€30 for transit today" (com ícone sparkle)
4. **Categorias**: Grid 2×4 de ícones (Dining, Transit, Shops, Culture, Stay, Drink, Groceries, Other)
5. **SPLIT WITH**: Avatares circulares (J, M, P, +) + "Equal split (1/3)"
6. **Nota**: Textarea com placeholder contextual ("Add a note... (e.g. Tapas at Mercado de San Miguel)")
7. **Footer**: Ícone câmera (attach receipt) + calendário + ícone info + Botão "Add Expense"

### O que temos hoje

O `useItineraryDayContext` já traz `currentLeg`, `budgetPremise`, `dailyBudgetCents`, `companions`. A UI do QuickAdd usa alguns desses dados.

### Mudanças necessárias

| Nº | Elemento | Hoje | Wireframe | Ação |
|----|----------|------|-----------|------|
| 18.1 | Contexto do itinerário | Parcialmente mostrado | Badge mono com dia + cidade + budget | `[EVOLUÇÃO]` Adicionar badge de contexto: "📍 DIA X EM {CIDADE} · BUDGET: €XX" (ou ícone `location_on` em vez de emoji). Mono, `text-xs`, `text-on-surface-dim` |
| 18.2 | Sugestão AI | Não existe como badge | "Expect ~€30 for transit today" com ícone sparkle | `[EVOLUÇÃO]` Mostrar `budgetPremise` como badge: bg `--ai-bg-soft`, text `--ai`, ícone `auto_awesome`. Texto resumido do premise |
| 18.3 | Placeholder contextual | Placeholder genérico | Placeholder que menciona a cidade ("Tapas at Mercado de San Miguel") | `[EVOLUÇÃO]` Gerar placeholder dinâmico baseado na cidade + categoria selecionada |
| 18.4 | Companions pré-sugeridos | Não implementado | Avatares dos companions já mostrados em SPLIT WITH | `[EVOLUÇÃO]` Se `companions` não vazio, mostrar os companions do itinerário como participantes pré-sugeridos no split (avatares com iniciais). User pode remover/adicionar |

---

## 19. Settings — Notifications & Reminders

**Wireframe**: `settings_notifications_reminders/screen.png`
**Componente atual**: `SettingsPage.tsx` (seção Notificações)
**Rota**: `/settings`

### O que o wireframe mostra

1. **Título**: "Settings" (grande)
2. **Seção "NOTIFICATIONS"** (mono uppercase):
   - **Card "Transport Reminder"**:
     - Ícone transporte (ônibus em circle)
     - Título: "Transport Reminder"
     - Subtítulo: "Alerts before departure"
     - Toggle (ativo, em `--primary`)
     - "Advance notice" label
     - 3 opções em segmented control: "30 minutes" | "1 hour" | "2 hours"
   - **Card "Budget Alerts"** `[NOVO]`:
     - Ícone carteira em circle
     - Título: "Budget Alerts"
     - Subtítulo: "When nearing daily limit"
     - Toggle (inativo)

### O que temos hoje

- Toggle "Lembrete de transporte" + helper text + select dropdown para lead time
- Sem "Budget Alerts"

### Mudanças necessárias

| Nº | Elemento | Hoje | Wireframe | Ação |
|----|----------|------|-----------|------|
| 19.1 | Card de Transport Reminder | ToggleRow simples | Card com ícone circle + título + subtítulo + toggle | `[EVOLUÇÃO]` Redesenhar como card: ícone em circle (40px, bg `--primary` a 10%), título bold, subtítulo dim, toggle à direita |
| 19.2 | Seletor de lead time | `<select>` dropdown | Segmented control (3 opções inline) | `[EVOLUÇÃO]` Trocar dropdown por segmented control: 3 botões side-by-side, o selecionado com bg `--surface-container-high` e borda sutil. Rounded-full |
| 19.3 | Budget Alerts | Não existe | Card com toggle para alertas de orçamento | `[NOVO]` Nova feature: notificação quando gasto do dia atinge X% do dailyBudget. Toggle + configuração de threshold. Fase futura |

---

## 20. Transport Reminder — In-App Notification

**Wireframe**: `transport_reminder_neomorphic_variant/screen.png`
**Componente atual**: `transport-reminder-boot.ts` (usa Web Notification API)
**Contexto**: Overlay/modal quando lembrete dispara

### O que o wireframe mostra

Notificação in-app (não nativa):
- Background blurrado (conteúdo da tela por trás)
- Card centralizado com estilo neumórfico:
  - Ícone avião em circle
  - "Transport Reminder" (bold)
  - "🛫 Your flight to Ljubljana departs in 1h (08:30)"
  - Botão "GOT IT" (outline, terracotta)

### O que temos hoje

Notificação nativa do browser (Web Notification API) — não tem UI in-app.

### Mudanças necessárias

| Nº | Elemento | Hoje | Wireframe | Ação |
|----|----------|------|-----------|------|
| 20.1 | Notificação in-app | Web Notification API (nativa do OS) | Card modal in-app com blur background | `[NOVO]` Além da notificação nativa, quando o app está em foreground: mostrar modal/overlay in-app com: backdrop blur, card centralizado, ícone do transporte, mensagem formatada, botão "OK" |
| 20.2 | Estilo do card | N/A | Neumórfico com sombras internas | `[EVOLUÇÃO]` Usar bg `--surface-container`, border sutil, sem neumorfismo puro (não combina com nosso DS). Adaptar: card com rounded-2xl, padding 24px, ícone grande |

### Decisão

Manter a notificação nativa (funciona com app em background) E adicionar notificação in-app visual quando o app está em foreground. O wireframe mostra apenas a versão in-app.

---

## Resumo de componentes novos a criar

| Componente | Wireframe(s) | Prioridade |
|-----------|-------------|-----------|
| `TimelineView` | 2, 4, 5 | ALTA — redesign core da agenda |
| `HeroBanner` (com fallback de imagem) | 2, 4, 5, 6 | ALTA — hero card com suporte a imagem |
| `SegmentedControl` | 19 | MÉDIA — substituir dropdown |
| `SkeletonLoader` | 11 | MÉDIA — estado de loading |
| `ChipGroup` | 17 | MÉDIA — seletor de dayType no form |
| `InAppNotification` | 20 | BAIXA — overlay de lembrete |
| `BudgetStatusBadge` | 6 | MÉDIA — badge "On Track"/"Atenção" |
| `MapLegList` | 7 | MÉDIA — lista de legs abaixo do mapa |
| `ProgressChecklist` | 15 | BAIXA — loading com steps |

---

## Resumo de features [NOVO] — requerem lógica além de UI

| Feature | Wireframe | Dados necessários | Prioridade |
|---------|-----------|-------------------|-----------|
| Imagens de cidades no hero | 2, 4, 5, 6, 16 | API de imagens (Unsplash/Pexels) ou campo `imageUrl` na leg | BAIXA (MVP com gradiente) |
| Clima no hero card | 4 | API de clima por cidade | BAIXA |
| Badge "LIVE" em eventos | 4 | Cálculo: evento.startTime ≤ now ≤ evento.endTime | MÉDIA |
| "END OF DAY" marker | 5 | Sem dados novos — lógica de renderização | BAIXA |
| Sugestão AI contextual | 5 | Integração AI para sugerir atividades por cidade | BAIXA |
| Budget Alerts | 19 | `budgetAlertEnabled`, `budgetAlertThreshold` em AppSettings | MÉDIA |
| Notificação in-app | 20 | Event system para show/dismiss overlay | MÉDIA |
| Localização em eventos | 6 | Campo `location` em highlights | MÉDIA |
| Tags em eventos | 6 | Campo `type` + `costCents` em highlights | MÉDIA |
| Booking reference | 8 | Campo `bookingReference` em transport/accommodation | MÉDIA |
| Sincronização mapa ↔ lista | 7 | Lógica de scroll + flyTo | MÉDIA |

---

## Ordem de implementação sugerida

### Wave 1 — Core redesign (ALTA prioridade)
1. `TimelineView` — componente de timeline vertical
2. `HeroBanner` — hero card com gradiente/imagem
3. Redesign ItineraryPage (transit day → timeline, full day → hero + agenda melhorada)
4. Redesign ItineraryContextCard (colunas transporte/hospedagem, mini-timeline)

### Wave 2 — Polish (MÉDIA prioridade)
5. Redesign BookingChecklistPage (cards ricos, ações por status)
6. Redesign LegFormSheet (seções, chips, footer 3 botões)
7. Redesign Copilot flow (progress bar, ícones, preview com conectores)
8. GPS states (opt-in card, detecting skeleton, override proeminente)

### Wave 3 — Features novas (BAIXA prioridade, futura)
9. Map split view (lista de legs + sincronização)
10. Imagens de cidades
11. Badge "LIVE" em eventos
12. Budget Alerts
13. In-app notifications
14. Clima no hero

---

## Notas para o implementador

1. **Não mudar tokens**: Toda cor, fonte, espaçamento vem de `tokens.css`. Os wireframes usam tokens DIFERENTES (ex: "AI Purple" vs nosso "AI Indigo") — usar os NOSSOS tokens.
2. **Emojis**: Nosso design system proíbe emojis na UI. Os wireframes usam emojis em alguns lugares (🛫, 📍). Substituir por Material Symbols (`flight_takeoff`, `location_on`).
3. **Neumorfismo**: O wireframe 20 usa neumorfismo. Nosso DS não permite — usar tonal layering (bg shift).
4. **Imagens de cidades**: MVP sem imagens. Usar gradientes por dayType como fallback. Quando implementar imagens: lazy load, placeholder skeleton, cache agressivo.
5. **Timeline component**: Criar como componente genérico (`TimelineView`) que aceita itens com: status (past/active/future), time, content (ReactNode). Reusável em transit day, full day, e context card.
6. **Responsividade**: Todos os layouts são mobile-first (max-width 430px). Desktop: centralizar com mx-auto.
7. **Accessibility**: Garantir que timeline tem role="list", itens tem role="listitem", botões tem aria-labels.
