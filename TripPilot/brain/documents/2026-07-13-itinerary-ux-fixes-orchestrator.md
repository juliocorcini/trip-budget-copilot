# TripPilot — Orquestrador "Itinerary UX Fixes" (Correções Críticas)

> **Última atualização:** 2026-07-13 · **App:** 2.13.4-rc → 2.14.x-rc
> **Status:** ✅ ACTIVE — pronto para rodar.
> **Contexto:** Feedback direto do Julio após o Visual Redesign. Múltiplos problemas de UX identificados.

---

## §0. Missão

Corrigir problemas de UX críticos no módulo de itinerário que divergem dos wireframes Stitch e da experiência esperada. Os problemas foram identificados pelo usuário após o deploy da wave visual.

**Problemas identificados:**
1. CopilotFlow: "Criar com IA" pula direto para text input, não oferece escolha (guided vs free text)
2. CopilotFlow: Não pergunta se quer itinerário novo do zero ou incrementar o existente
3. ItineraryPreview: Usa emojis (VIS-2), muito básico vs wireframe (deveria mostrar cards de cidade com hotel, transporte entre cidades)
4. Dashboard ItineraryContextCard: Muito pobre, expand não funciona, não bate com wireframe
5. Dashboard: Itinerário no dia certo deveria ser parte principal (mais acima)
6. Map page: Mapa conflita com gestos de arrastar para trocar de tela; info embaixo do mapa
7. Personal Notes: Layout não condiz com wireframe
8. Vários elementos dos wireframes ausentes

---

## §3. ÂNCORA

```
═══════════════════════════════════════════════════════
ÂNCORA — Itinerary UX Fixes
· VIS-1: Tokens.css = ÚNICA fonte de cor/fonte/espaçamento
· VIS-2: Emojis PROIBIDOS na UI → Material Symbols
· VIS-7: itinerary-domain.ts INTOCADO
· UX-1: CopilotFlow SEMPRE mostra choice stage primeiro
· UX-2: Opção "novo do zero" vs "incrementar" quando já existem legs
· UX-3: ItineraryPreview deve corresponder ao wireframe (city cards + connectors)
· UX-4: Dashboard card expande corretamente + proeminente no dia ativo
· UX-5: Map page não conflita com gestos de navegação
CURRENT STATE: gate=G0 | version=2.13.4-rc | tests=baseline | scope=UX Fixes
═══════════════════════════════════════════════════════
```

---

## §5. Change-set

| ID | Problema | Prioridade | Gate |
|----|----------|-----------|------|
| F01 | CopilotFlow: add mode pula choice stage | P0 | G1 |
| F02 | CopilotFlow: sem opção "novo do zero" vs "incrementar" | P0 | G1 |
| F03 | ItineraryPreview: emojis (VIS-2 violation) | P0 | G1 |
| F04 | ItineraryPreview: não bate com wireframe | P0 | G1 |
| F05 | Dashboard card: expand não funciona | P0 | G2 |
| F06 | Dashboard card: muito básico vs wireframe | P0 | G2 |
| F07 | Dashboard: itinerário deveria ser proeminente no dia ativo | P0 | G2 |
| F08 | Map page: gesture conflict | P1 | G3 |
| F09 | Personal notes: layout ruim | P1 | G3 |

---

## §6. Root-cause map

| ID | Arquivo | Root cause | Fix |
|----|---------|-----------|-----|
| F01 | `ItineraryCopilotFlow.tsx:73` | `isAddMode ? 'input' : 'choice'` pula direto | Sempre iniciar em 'choice', adaptar choice para add mode |
| F02 | `ItineraryCopilotFlow.tsx:285-386` | Choice stage não tem opção "novo do zero" vs "incrementar" | Adicionar 3ª opção ou adaptar flow |
| F03 | `ItineraryPreview.tsx:7-23` | `TRANSPORT_EMOJI` e `BOOKING_LABEL` usam emojis | Trocar por Material Symbols + Icon component |
| F04 | `ItineraryPreview.tsx:44-128` | Preview é lista simples, wireframe mostra city cards ricos | Redesenhar para corresponder ao wireframe |
| F05 | `ItineraryContextCard.tsx:78-83` | `toggleExpanded` funciona mas o estado pode não persistir corretamente | Verificar e corrigir expansion logic |
| F06 | `ItineraryContextCard.tsx:155-431` | Card básico vs wireframe rico com agenda timeline, budget bar, "Ver agenda" | Redesenhar para corresponder ao wireframe |
| F07 | `DashboardPage.tsx:823` | `ItineraryContextCard` está APÓS `DashboardCards` | Mover ANTES quando no dia ativo da trip |
| F08 | `ItineraryMapPage.tsx:140-145` | Map Leaflet captura touch events, conflita com swipe | Adicionar `dragging: false` ou `touchZoom: false` em mobile, ou wrapper com touch handling |
| F09 | `ItineraryPage.tsx:832-898` | Notes section funcional mas layout simples | Melhorar para corresponder ao wireframe |

---

## §10. THE BUILD

### G0 — Baseline ✅
- Versão: 2.13.4-rc
- tsc: 0 erros
- Tests: rodando

### G1 — CopilotFlow + Preview Fix (P0)
**F01+F02**: CopilotFlow choice stage
- Sempre mostrar choice stage (remover `isAddMode ? 'input' : 'choice'`)
- Quando existem legs E mode=add: choice entre "criar novo do zero" (limpa existing) e "adicionar ao existente"
- Quando não existem legs: choice normal (guided vs free text)
- Choice stage deve corresponder ao wireframe `itinerary_copilot_choice_stage`

**F03+F04**: ItineraryPreview redesign
- Remover todos os emojis → Material Symbols via Icon component
- Redesenhar para corresponder ao wireframe `itinerary_copilot_preview_refine`:
  - "AI Generated" pill badge no topo
  - Summary (X dias, Y cidades, Z países)
  - City cards com: nome, datas mono, hotel sub-card com Icon, transporte conector entre cidades
  - "Usar este itinerário" button prominente
  - Input de refinamento inline com "Refinar" button

### G2 — Dashboard ItineraryContextCard Fix (P0)
**F05**: Expand fix — garantir que expand/collapse funciona corretamente
**F06**: Redesenhar card para corresponder ao wireframe `dashboard_itinerary_info_variant`:
  - Header: dot verde + cidade bold + "..." menu + "Dia X de Y"
  - 2-col grid: TRANSPORTE + HOSPEDAGEM com sub-cards
  - AGENDA DO DIA com mini-timeline (horários mono, dots coloridos, items)
  - Orçamento do Dia com progress bar
  - "Ver agenda completa →" link

**F07**: Mover card para ANTES de DashboardCards quando no dia ativo

### G3 — Map + Notes Polish (P1)
**F08**: Map gesture fix — impedir conflito com navegação
**F09**: Notes — melhorar layout para corresponder ao wireframe

### G4 — Deploy
- tsc --noEmit
- npm run build
- Deploy via scripts/deploy.sh

---

## §12. Definition of Done

- [ ] CopilotFlow mostra choice stage sempre (inclusive em add mode)
- [ ] Opção "novo" vs "incrementar" quando existem legs
- [ ] ItineraryPreview sem emojis, com city cards ricos
- [ ] Dashboard card expande corretamente
- [ ] Dashboard card corresponde ao wireframe
- [ ] Itinerário proeminente no dashboard quando no dia ativo
- [ ] Map page sem conflito de gestos
- [ ] Notes com layout do wireframe
- [ ] tsc: 0 erros
- [ ] Build: OK
- [ ] Deploy: feito via script
