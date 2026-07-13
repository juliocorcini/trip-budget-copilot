# TripPilot — Orquestrador "Itinerary Visual Redesign" (Wave 1 + 2 + 3 — COMPLETO)

> **Última atualização:** 2026-07-13 · **App:** 2.13.1-rc → 2.14.0-rc...2.15.x-rc
> **Status:** ✅ ACTIVE — pronto para rodar. Sem perguntas abertas.
> **Fonte:** Wireframes Stitch (21 telas), doc de migração `itinerary-ui-migration.md`, design system `design-system.md`.
> **Particularidade:** Leva VISUAL de longa duração. Cada gate inclui Protocolo de Verificação Visual (PVV). Mecanismos de recuperação de contexto em §9.

---

## §0. Missão

Você é um engenheiro full-stack sênior **aplicando o redesign visual completo do módulo de itinerário do TripPilot**, sozinho, nesta sessão. O app já existe e está no ar (2.13.1-rc).

**O que fazer:**
1. Redesenhar visualmente TODAS as telas do itinerário para corresponder aos wireframes Stitch
2. Criar componentes novos necessários (TimelineView, HeroBanner, etc.)
3. Adicionar features visuais novas que os wireframes introduzem (badges LIVE, skeleton loading, etc.)
4. Manter toda a lógica de domínio intacta

**O que NÃO fazer:**
- NÃO mudar `itinerary-domain.ts` ou qualquer lógica de domínio
- NÃO integrar APIs externas (imagens de cidades, clima)
- NÃO mudar tokens do design system
- NÃO mudar a bottom nav ou o shell do app

**Wireframes de referência** (ler com Read tool ANTES de implementar cada gate):
Pasta: `/mnt/c/Users/julio/Downloads/stitch_trippilot_travel_planner/stitch_trippilot_travel_planner/`

**Vá para §17 para começar.**

---

## §1. Identidade & regras absolutas

1. **SEM subagents / SEM Task tool.** Tudo inline.
2. **NÃO peça permissão.** Gate termina → commit → deploy → próximo.
3. **NÃO pare.** Continue até §12 TRUE ou contexto acabar (feche o gate limpo → handoff).
4. **Código em inglês.** UI via `t()`.
5. **Tokens do design system** — NUNCA hardcoded.
6. **Deploy via `scripts/deploy.sh`** SEMPRE.
7. **Terminal WSL safe** (§11).
8. **Brain sync** (§14).

---

## §2. Ordem de leitura (uma vez no início + a cada re-entry)

1. Este documento §0–§9
2. `src/dev-log.md` — **estado de execução** (qual gate/milestone está em andamento)
3. `brain/documents/itinerary-ui-migration.md` §correspondente ao gate atual
4. `brain/documents/design-system.md` + `src/styles/tokens.css` — tokens vigentes
5. O wireframe PNG do gate atual (Read tool na imagem)

---

## §3. ÂNCORA (releia ANTES de cada gate + a cada 3 milestones)

```
═══════════════════════════════════════════════════════
ÂNCORA — Itinerary Visual Redesign (COMPLETO)
· VIS-1: Tokens.css = ÚNICA fonte de cor/fonte/espaçamento
· VIS-2: Emojis PROIBIDOS na UI → Material Symbols
· VIS-3: Sem neumorfismo → tonal layering
· VIS-4: transition-all PROIBIDO → propriedades explícitas
· VIS-5: Dados sparse DEVEM degradar gracefully (sem crash, sem "vazio feio")
· VIS-6: Viewport de screenshot = 375×812
· VIS-7: itinerary-domain.ts INTOCADO — zero mudança em lógica de domínio
· VIS-8: Checklist visual do wireframe = critério de passagem do gate
· VIS-9: Sem APIs externas (imagens, clima) — MVP com gradientes
CURRENT STATE: gate=?? | milestone=?? | version=?? | tests=?? | scope=??
═══════════════════════════════════════════════════════
```

---

## §4. Baseline — componentes existentes

| Componente | Arquivo | Wave | O que muda |
|---|---|---|---|
| ItineraryPage | `features/itinerary/ItineraryPage.tsx` | 1 | Layout completo: timeline, hero, GPS |
| ItineraryContextCard | `features/itinerary/ItineraryContextCard.tsx` | 1 | Colunas, mini-timeline, skeleton |
| BookingChecklistPage | `features/itinerary/BookingChecklistPage.tsx` | 2 | Cards ricos, ações por status |
| LegFormSheet | `features/itinerary/LegFormSheet.tsx` | 2 | Seções, chips, footer |
| ItineraryCopilotFlow | `features/itinerary/ItineraryCopilotFlow.tsx` | 2 | Todos os stages |
| ItineraryMapPage | `features/itinerary/ItineraryMapPage.tsx` | 3 | Split view + lista |
| SettingsPage | `features/settings/SettingsPage.tsx` | 3 | Segmented control |
| useGpsLegDetect | `features/itinerary/useGpsLegDetect.ts` | — | NÃO MUDA |
| itinerary-domain.ts | `domain/itinerary/itinerary-domain.ts` | — | NÃO MUDA |

---

## §5. Change-set normalizado

### Wave 1 — Core (P0)
- V01: TimelineView component (NOVO)
- V02: HeroBanner component (NOVO)
- V03: BudgetStatusBadge component (NOVO)
- V04: ItineraryPage — empty state
- V05: ItineraryPage — GPS states (opt-in, detecting, matched, override)
- V06: ItineraryPage — transit day (timeline)
- V07: ItineraryPage — full day (hero + agenda)
- V08: ItineraryContextCard (colunas, timeline, skeleton)

### Wave 2 — Polish (P1)
- V09: BookingChecklistPage (cards ricos)
- V10: LegFormSheet (seções, chips, footer)
- V11: CopilotFlow — choice stage
- V12: CopilotFlow — guided stage
- V13: CopilotFlow — free text stage
- V14: CopilotFlow — loading stage
- V15: CopilotFlow — preview stage

### Wave 3 — Extensions (P2)
- V16: ItineraryMapPage (split view)
- V17: Settings notifications (segmented control, card)
- V18: QuickAdd contexto itinerário
- V19: In-app transport reminder notification
- V20: Badge "LIVE" em eventos ativos
- V21: Skeleton loader component

---

## §6. Root-cause map

| Vxx | Arquivo alvo | Posição no código | Wireframe |
|-----|-------------|-------------------|-----------|
| V01 | `NEW: components/TimelineView.tsx` | Criar | `itinerary_transit_day_view` |
| V02 | `NEW: components/HeroBanner.tsx` | Criar | `itinerary_gps_matched_state`, `itinerary_highlight_notes_view` |
| V03 | `NEW: components/BudgetStatusBadge.tsx` | Criar | `itinerary_highlight_notes_view` |
| V04 | `ItineraryPage.tsx` | L160-203 | `itinerary_empty_state` |
| V05 | `ItineraryPage.tsx` | L272-320 | `itinerary_gps_*` (4 wireframes) |
| V06 | `ItineraryPage.tsx` | L424-480 (agenda) | `itinerary_transit_day_view` |
| V07 | `ItineraryPage.tsx` | L360-413 (hero) | `itinerary_highlight_notes_view` |
| V08 | `ItineraryContextCard.tsx` | L87-179 | `dashboard_itinerary_*` (3 wireframes) |
| V09 | `BookingChecklistPage.tsx` | L80-184 | `booking_checklist_status_grouping_variant` |
| V10 | `LegFormSheet.tsx` | L32-357 | `legformsheet_overview_flow` |
| V11-V15 | `ItineraryCopilotFlow.tsx` | Stages | `itinerary_copilot_*` (5 wireframes) |
| V16 | `ItineraryMapPage.tsx` | Full file | `itinerary_map_split_view_variant` |
| V17 | `SettingsPage.tsx` | Notifications section | `settings_notifications_reminders` |
| V18 | QuickAdd page | Context section | `quickadd_embedded_reference_variant` |
| V19 | `NEW: components/InAppNotification.tsx` | Criar | `transport_reminder_neomorphic_variant` |
| V20 | TimelineView (extension) | Badge rendering | `itinerary_gps_matched_state` |
| V21 | `NEW: components/SkeletonLoader.tsx` | Criar | `dashboard_gps_detecting_state` |

---

## §7. Decisões

- **DEC-470:** Timeline vertical APENAS para transit days. Full days: HeroBanner + agenda cards melhorados.
- **DEC-471:** Sem imagens de cidades. Hero usa gradiente por dayType. Campo `imageUrl` reservado no tipo (não implementar).
- **DEC-472:** Renderização condicional por dayType na ItineraryPage.
- **DEC-473:** PVV: Playwright screenshots (375×812) + checklist + 3 cenários + side-by-side.
- **DEC-474:** Manter design system (tokens.css). Wireframes definem layout, não tokens.

---

## §8. Estratégia de testes

### Testes tradicionais
- Style hygiene: 0 `transition-all`.
- `tsc --noEmit`: limpo após cada gate.
- `npm run build`: sucesso.
- Suite existente: 0 failures novas.

### PVV — Protocolo de Verificação Visual (CRÍTICO)

**Para CADA gate que modifica um componente visual, nesta ordem exata:**

```
ANTES de implementar:
  1. Read wireframe PNG → extrair checklist numerado de elementos visuais
  2. Documentar checklist no dev-log

DEPOIS de implementar:
  3. Rodar dev server (npm run dev) se não estiver rodando
  4. Playwright screenshot (375×812)
  5. Read screenshot + Read wireframe → comparar item por item
  6. Listar divergências
  7. Se divergências: fixar → re-screenshot → re-verificar
  8. Quando checklist 100% ✅ → embedar side-by-side no chat

3 CENÁRIOS de screenshot:
  A. Normal: dados completos (horários, companhia, hospedagem, transport)
  B. Mínimo: 1 leg, sem horário, sem hospedagem, nome curto
  C. Extremo: 5+ legs, nomes longos ("São José dos Campos"), muitos companions
```

### Segundo passe visual
No último gate de cada Wave: screenshots de TUDO que foi modificado na Wave. Comparar todos com wireframes. Fixar divergências.

---

## §9. Recuperação de contexto (CRÍTICO para sessão longa)

Esta leva é longa (9 gates, ~15h). O contexto VAI degradar. Mecanismos de proteção:

### 9.1 dev-log como state machine

O `src/dev-log.md` é a ÚNICA fonte de verdade sobre onde estamos na execução. Estrutura:

```markdown
# Itinerary Visual Redesign — dev-log

## Current State
- **Gate:** G3
- **Milestone:** M3.2
- **Version:** 2.14.1-rc
- **Tests:** 47 pass, 0 fail
- **Risks:** Nenhum
- **Last commit:** feat(itinerary): redesign ContextCard columns

## Wave 1
### G0 — Setup ✅
- M0.1: Baseline ✅ (47 tests, 0 fails)
- M0.2: Playwright scaffold ✅
...
### G1 — Components ✅
...
### G2 — ItineraryPage ✅ → 2.14.0-rc deployed
...
### G3 — ContextCard 🔧 IN PROGRESS
- M3.1: Colunas ✅
- M3.2: Mini-timeline → IN PROGRESS
...
```

Se o contexto zerar ou a sessão reiniciar:
1. Ler `src/dev-log.md` → saber exatamente onde parou
2. Ler este documento §3 (ÂNCORA) + o gate atual em §10
3. Ler o arquivo do componente atual
4. Continuar de onde parou

### 9.2 ANCHOR block a cada 3 milestones

O ANCHOR block (§3) é impresso a cada 3 milestones e em cada gate boundary. Isso força o modelo a reler as invariantes e evita drift.

### 9.3 Gate-level re-entry

Cada gate é auto-contido. Se o contexto morrer no meio de G4, uma nova sessão pode:
1. Ler dev-log → "G4 M4.1 ✅, M4.2 IN PROGRESS"
2. Ler este doc §10 → G4 milestones
3. Retomar M4.2

### 9.4 Commit após cada milestone

Cada milestone tem um commit. Se o contexto morrer, o código commitado está seguro. A nova sessão lê os commits + dev-log e retoma.

### 9.5 Deploy por gate (não por Wave)

Cada gate que modifica a UI faz deploy. Assim, se a sessão morrer no G6, os gates G0-G5 já estão deployados e validados.

---

## §10. THE BUILD — Gates G0 → G9

---

### G0 — Setup, baseline, scaffolding visual

**Milestones:**
- M0.1: Rodar `npm run test`, `npm run build`, `tsc --noEmit`. Documentar contagens.
- M0.2: Criar `tests/e2e/visual-verification.spec.ts` com seed data e screenshot logic.
- M0.3: Criar/atualizar `src/dev-log.md`. Adicionar DECs 470-474 como PROPOSED.
- M0.4: Screenshots "antes" de: ItineraryPage (4 estados), ContextCard, Checklist, Copilot.

**AC:** [G0-AC1] Baseline documentado. [G0-AC2] Playwright visual spec criado. [G0-AC3] dev-log semeado. [G0-AC4] Screenshots before.

---

### G1 — Componentes base (TimelineView + HeroBanner + BudgetStatusBadge + SkeletonLoader)

**Wireframes ref:** `itinerary_transit_day_view`, `itinerary_highlight_notes_view`, `dashboard_gps_detecting_state`

**Milestones:**
- M1.1: **TimelineView** — Componente genérico com linha vertical, nós por status (past/active/future), conteúdo ReactNode. Props: `items: TimelineItem[]`. Pulse animation no nó ativo.
- M1.2: **HeroBanner** — Card full-width com gradiente por dayType, cidade grande, badge tipo, budget bar, children slot. Gradientes: full=verde-teal, transit=azul-cinza, festival=roxo-magenta, rest=cinza-slate, day_trip=âmbar-laranja.
- M1.3: **BudgetStatusBadge** — Badge pill: "On Track" (verde/<80%), "Atenção" (âmbar/80-100%), "Acima" (vermelho/>100%).
- M1.4: **SkeletonLoader** — Divs com shimmer animation. Props: `lines: number, width?: string`.

**PVV checklist:**
- [ ] Timeline: linha 2px `--primary`, nós circulares distintos, pulse no ativo
- [ ] Timeline: funciona com 1 item e com 8+ itens
- [ ] Timeline: sem horário → nó sem label, graceful
- [ ] HeroBanner: gradiente visível por dayType (testar full, transit, festival)
- [ ] HeroBanner: cidade ≥text-2xl bold, badge presente, budget bar se dados existem
- [ ] BudgetStatusBadge: 3 estados visuais distintos
- [ ] SkeletonLoader: shimmer animation visível

**AC:** [G1-AC1..4] Cada componente renderiza corretamente. PVV ✅. tsc limpo.
**Commit por milestone.** Sem deploy (não integrado).

---

### G2 — ItineraryPage redesign (empty + GPS + transit + full day)

**Wireframes ref:** `itinerary_empty_state`, `itinerary_gps_opt_in_state`, `itinerary_gps_matched_state`, `itinerary_gps_override_state`, `itinerary_transit_day_view`, `itinerary_highlight_notes_view`

**Milestones:**
- M2.1: **Empty state** — Composição 3 ícones, botão AI com `--ai-gradient`, botão manual ghost.
- M2.2: **GPS opt-in** — Card proeminente com ícone 48px, título, descrição, CTA, dismiss. i18n novo.
- M2.3: **GPS detecting** — SkeletonLoader + "Detectando cidade..." Badge pulsante.
- M2.4: **GPS matched** — Barra de status "GPS ativo · Confirmado" + badge "Location verified".
- M2.5: **GPS override** — Card no topo: ícone GPS + cidade + "(era {cidade})" + botão "USAR DATA" prominente.
- M2.6: **Transit day** — Integrar TimelineView. Converter DayAgendaItem → TimelineItem. Badges: DEPARTED/NEXT STOP/DESTINATION. Status por horário vs now.
- M2.7: **Full day** — Integrar HeroBanner + BudgetStatusBadge. Section labels mono. Notas: modo leitura + "Editar".
- M2.8: **Calendário + progress bar** — Ajustar visual, manter funcionalidade.

**PVV checklist (4 screenshots: empty, transit, full, GPS override):**
- [ ] Empty: 3 ícones compostos, botão AI gradiente, botão manual ghost
- [ ] GPS opt-in: card grande com ícone + CTA (se primeira vez)
- [ ] GPS override: card proeminente com "USAR DATA"
- [ ] Transit: timeline vertical com badges e nós
- [ ] Full: HeroBanner com gradiente + budget badge
- [ ] Notas: modo leitura com "Editar"
- [ ] Section labels mono uppercase
- [ ] Zero emojis
- [ ] Funcionalidade intacta: swipe, FAB, editar, excluir

**AC:** [G2-AC1..8] Cada estado renderiza corretamente. PVV ✅. Sem regressão funcional. tsc + tests limpos.
**Deploy:** `scripts/deploy.sh` → 2.14.0-rc

---

### G3 — ItineraryContextCard redesign

**Wireframes ref:** `dashboard_itinerary_info_variant`, `dashboard_itinerary_visual_variant`, `dashboard_gps_detecting_state`

**Milestones:**
- M3.1: **Colunas transporte/hospedagem** — Grid 2-col com labels mono, sub-cards com ícone circle.
- M3.2: **Mini-timeline na agenda** — Horário mono + dots coloridos + item ativo em primary.
- M3.3: **GPS detecting skeleton** — SkeletonLoader quando detecting.
- M3.4: **Budget label + barra** — "Orçamento do dia" mono + valores + barra.
- M3.5: **"Ver agenda" reposicionado** — Link no header do card, alinhado à direita.

**PVV checklist (3 screenshots: colapsado, expandido, GPS detecting):**
- [ ] Colunas side-by-side com labels mono
- [ ] Mini-timeline com dots e horários
- [ ] Item ativo em primary
- [ ] Skeleton com shimmer
- [ ] Budget com label mono + barra

**AC:** [G3-AC1..5] PVV ✅. tsc + tests limpos.
**Deploy:** `scripts/deploy.sh` → 2.14.1-rc

---

### G4 — BookingChecklistPage redesign

**Wireframe ref:** `booking_checklist_status_grouping_variant`

**Milestones:**
- M4.1: **Título + subtítulo** grande.
- M4.2: **Headers de seção** com dot + nome + descrição auxiliar.
- M4.3: **Cards ricos** — ícone Material Symbol em circle, nome bold, ref mono, data mono, valor à direita.
- M4.4: **Ação contextual por status** — botão diferente por status (texto, estilo, cor).

**PVV checklist:**
- [ ] Título grande + subtítulo
- [ ] Headers com dot colorido + descrição
- [ ] Cards com ícone circle (não emoji)
- [ ] Referência em mono
- [ ] Ações diferentes por status

**AC:** [G4-AC1..4] PVV ✅. Zero emojis. tsc + tests.
**Deploy:** `scripts/deploy.sh` → 2.14.2-rc

---

### G5 — LegFormSheet redesign

**Wireframe ref:** `legformsheet_overview_flow`

**Milestones:**
- M5.1: **Header** — "Add Trip Leg" + subtítulo. Seções com ícone + título primary.
- M5.2: **Layout grid** — Dates side-by-side, times side-by-side. Labels mono uppercase.
- M5.3: **ChipGroup para dayType** — Chips selecionáveis (Active/Relaxed/Balanced) em vez de select.
- M5.4: **Toggles de seção** — Switch estilizado para Transport/Accommodation.
- M5.5: **Footer 3 botões** — Excluir (vermelho ghost) + Cancelar (ghost) + Salvar (primary).

**PVV checklist:**
- [ ] Título + subtítulo no topo
- [ ] Seções com ícone + título colorido
- [ ] Dates side-by-side
- [ ] Labels mono uppercase
- [ ] Chips de dayType (não select)
- [ ] Footer 3 botões

**AC:** [G5-AC1..5] PVV ✅. tsc + tests.
**Deploy:** `scripts/deploy.sh` → 2.14.3-rc

---

### G6 — CopilotFlow redesign (5 stages)

**Wireframes ref:** `itinerary_copilot_choice_stage`, `itinerary_copilot_guided_question`, `itinerary_copilot_free_text_input`, `itinerary_copilot_loading_state`, `itinerary_copilot_preview_refine`

**Milestones:**
- M6.1: **Choice** — Header "COPILOT" mono, cards com ícone, card AI com toque `--ai-bg-soft`.
- M6.2: **Guided** — Progress bar + "PERGUNTA X DE 6" mono, pergunta display, ícones Material em circle, botões sticky.
- M6.3: **Free text** — Subtítulo, textarea grande, contador "0/500", botão sparkle.
- M6.4: **Loading** — Anel circular animado, checklist 3 steps simulados.
- M6.5: **Preview** — Badge "AI Generated" pill, resumo estruturado, conectores entre legs, hospedagem sub-card, input refinamento inline.

**PVV checklist (5 screenshots, 1 por stage):**
- [ ] Choice: header mono, 2 cards com ícone
- [ ] Guided: progress bar, pergunta grande, ícones circle, botões sticky
- [ ] Free text: textarea grande, placeholder rico, contador, sparkle
- [ ] Loading: anel animado, 3 steps
- [ ] Preview: badge AI, resumo, conectores, sub-cards

**AC:** [G6-AC1..5] PVV ✅ para os 5 stages. tsc + tests.
**Deploy:** `scripts/deploy.sh` → 2.14.4-rc

---

### G7 — ItineraryMapPage split view

**Wireframe ref:** `itinerary_map_split_view_variant`

**Milestones:**
- M7.1: **Split layout** — Mapa ~45vh, lista scrollável abaixo.
- M7.2: **Dark tiles** — Configurar/usar tile layer escuro (CartoDB Dark).
- M7.3: **Labels permanentes** — Nome da cidade + "X dias" nos pins (em vez de popup).
- M7.4: **Lista de legs** — Cards com "DIAS X-Y" mono, cidade bold, descrição. Card ativo com borda primary.
- M7.5: **Cores de rota** — Percorrido = primary sólido, futuro = AI pontilhado.
- M7.6: **Sincronização** — Tap card → flyTo. Tap pin → scroll lista.

**PVV checklist:**
- [ ] Split view: mapa ~45% + lista ~55%
- [ ] Tiles escuros
- [ ] Labels nos pins (não popups)
- [ ] Card ativo com borda primary
- [ ] Rota percorrida sólida vs futura pontilhada

**AC:** [G7-AC1..6] PVV ✅. Sincronização funcional. tsc + tests.
**Deploy:** `scripts/deploy.sh` → 2.14.5-rc

---

### G8 — Settings + QuickAdd + Extras

**Wireframes ref:** `settings_notifications_reminders`, `quickadd_embedded_reference_variant`, `transport_reminder_neomorphic_variant`

**Milestones:**
- M8.1: **Settings — Transport Reminder** — Card rico com ícone circle, segmented control para lead time (não dropdown).
- M8.2: **QuickAdd — contexto itinerário** — Badge "📍 DIA X EM {CIDADE} · BUDGET: €XX" + sugestão AI do premise.
- M8.3: **In-app notification** — Overlay com blur + card centralizado para reminder quando app em foreground.
- M8.4: **Badge "LIVE"** — Em eventos da timeline que estão acontecendo AGORA (startTime ≤ now ≤ endTime).

**PVV checklist:**
- [ ] Settings: segmented control (não dropdown)
- [ ] QuickAdd: badge de contexto mono
- [ ] In-app: overlay blur + card
- [ ] LIVE: badge pulsante em evento ativo

**AC:** [G8-AC1..4] PVV ✅. tsc + tests.
**Deploy:** `scripts/deploy.sh` → 2.15.0-rc

---

### G9 — Segundo passe visual completo + finalização

**Milestones:**
- M9.1: **Screenshots de TUDO** — Todas as telas modificadas em todos os estados.
- M9.2: **Comparação com wireframes** — Item por item, todas as telas.
- M9.3: **Fix divergências** — Qualquer coisa que não bata.
- M9.4: **Suite completa** — `npm run test` + `tsc --noEmit` + `npm run build`.
- M9.5: **Deploy final** — `scripts/deploy.sh`.
- M9.6: **Brain sync** — project-status.md, decision-log (DECs APPROVED), release notes.

**AC:** [G9-AC1] 0 divergências visuais. [G9-AC2] Suite verde. [G9-AC3] Build ok. [G9-AC4] Deploy ok. [G9-AC5] Brain synced.

---

## §11. Terminal safety (WSL)

- `git --no-pager` SEMPRE.
- `commit -m` SEMPRE (HEREDOC para multiline).
- Nunca `less`/`more`/`man`/`vim`/`nano`/`-i`.
- Deploy via `scripts/deploy.sh` SEMPRE.
- Hang >30s → ler terminal file → kill pid.

---

## §12. Definition of Done

TODOS devem ser TRUE:

- [ ] V01-V21 implementados.
- [ ] PVV completo: 0 divergências.
- [ ] Segundo passe visual limpo (G9).
- [ ] Suite: 0 failures novas.
- [ ] tsc --noEmit: limpo.
- [ ] npm run build: sucesso.
- [ ] Style hygiene: 0 transition-all, 0 emojis na UI.
- [ ] Deploy: 2.15.x-rc no ar.
- [ ] dev-log.md atualizado.
- [ ] DECs 470-474 APPROVED.
- [ ] i18n: strings novas em pt-BR/en/es.
- [ ] Sem regressão funcional.

---

## §13. Anti-patterns

- ❌ Hardcoded colors/fonts.
- ❌ Emojis na UI.
- ❌ transition-all.
- ❌ Neumorfismo.
- ❌ APIs externas (imagens, clima).
- ❌ Mudar itinerary-domain.ts.
- ❌ Subagents/Task tool.
- ❌ Parar no meio de um gate sem fechar limpo.
- ❌ Avançar sem PVV.
- ❌ Commits sem dev-log entry.

---

## §14. Brain sync

- `src/dev-log.md` — cada milestone (Current State + entry).
- `brain/decision-log.md` — DECs PROPOSED → APPROVED por gate.
- `brain/project-status.md` — fim da leva.
- `src/utils/release-notes.ts` — nota a cada deploy.

---

## §15. Smoke matrix

| Jornada | Chrome | Android PWA | iOS Safari |
|---------|--------|------------|------------|
| Itinerário transit | timeline | timeline | timeline |
| Itinerário full day | hero+agenda | hero+agenda | hero+agenda |
| Itinerário empty | empty state | empty state | empty state |
| GPS opt-in → matched | card flow | card flow | card flow |
| Context card dashboard | colunas | colunas | colunas |
| Checklist → purchased | ações | ações | ações |
| Form → criar leg | seções | seções | seções |
| Copilot → guided → usar | flow | flow | flow |
| Mapa → clicar pin | flyTo | flyTo | flyTo |

---

## §16. Lock — LOCKED

Sem perguntas abertas. DECs 470-474 cobrem tudo.

---

## §17. GO — comece aqui

1. Leia §0–§9.
2. Leia `src/dev-log.md` (se existir, para saber onde retomar).
3. Execute G0 (setup, baseline, Playwright scaffold).
4. Para cada gate G1→G9:
   - Imprima ANCHOR (§3) com CURRENT STATE.
   - Leia wireframe(s) PNG do gate (Read tool).
   - Extraia checklist visual.
   - Implemente milestones.
   - PVV: screenshot → compare → fix → ✅.
   - Self-check 5 pontos.
   - Commit + deploy (se gate tem deploy).
   - Atualize dev-log.md.
5. **Se o contexto acabar:** feche o gate atual limpo (commit + deploy + dev-log handoff) e pare.
6. **Se reiniciar:** leia dev-log.md → retome do milestone IN PROGRESS.
7. Não pare até §12 TRUE.

**Confirme em UMA linha que leu o orquestrador e iniciou G0 — depois continue sem esperar reply.**

---

## Appendix: Wireframe → Gate map

| Wireframe | Gate |
|-----------|------|
| `itinerary_empty_state` | G2 (M2.1) |
| `itinerary_transit_day_view` | G1 (M1.1) + G2 (M2.6) |
| `itinerary_gps_opt_in_state` | G2 (M2.2) |
| `itinerary_gps_matched_state` | G2 (M2.4) |
| `itinerary_gps_override_state` | G2 (M2.5) |
| `itinerary_highlight_notes_view` | G1 (M1.2) + G2 (M2.7) |
| `itinerary_map_split_view_variant` | G7 |
| `booking_checklist_status_grouping_variant` | G4 |
| `dashboard_itinerary_info_variant` | G3 |
| `dashboard_itinerary_visual_variant` | G3 |
| `dashboard_gps_detecting_state` | G1 (M1.4) + G3 (M3.3) |
| `itinerary_copilot_choice_stage` | G6 (M6.1) |
| `itinerary_copilot_guided_question` | G6 (M6.2) |
| `itinerary_copilot_free_text_input` | G6 (M6.3) |
| `itinerary_copilot_loading_state` | G6 (M6.4) |
| `itinerary_copilot_preview_refine` | G6 (M6.5) |
| `legformsheet_overview_flow` | G5 |
| `quickadd_embedded_reference_variant` | G8 (M8.2) |
| `settings_notifications_reminders` | G8 (M8.1) |
| `transport_reminder_neomorphic_variant` | G8 (M8.3) |
| `travel_companion` (DESIGN.md only) | N/A — design system reference |
