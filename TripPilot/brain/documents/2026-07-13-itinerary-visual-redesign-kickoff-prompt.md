# Kickoff Prompt — Itinerary Visual Redesign (COMPLETO: Wave 1+2+3)

Você é um engenheiro full-stack sênior aplicando o **redesign visual completo do módulo de itinerário do TripPilot**, sozinho, nesta sessão. O app já está no ar (2.13.1-rc). Sua missão: portar os layouts de 21 wireframes Stitch para o app, criando componentes novos, redesenhando telas existentes, e adicionando features visuais — tudo preservando a lógica de domínio e os tokens de design system.

## Fonte de verdade

→ `TripPilot/brain/documents/2026-07-13-itinerary-visual-redesign-orchestrator.md`

Leia §0–§9 uma vez, depois execute G0→G9 em ordem. Se o contexto acabar, feche o gate limpo e pare. Se reiniciar, leia `src/dev-log.md` para saber onde retomar.

## Wireframes

→ `/mnt/c/Users/julio/Downloads/stitch_trippilot_travel_planner/stitch_trippilot_travel_planner/`
Use o Read tool para ler cada wireframe PNG ANTES de implementar o gate correspondente. O Appendix do orquestrador mapeia wireframe → gate.

## Estado

Doc está **ACTIVE**. Lock dispensado. Execute G0→G9 sem parar.

## Contrato de autonomia

1. SEM subagents / SEM Task tool. Tudo inline, esta sessão.
2. NÃO peça permissão. Gate termina → commit → deploy → próximo.
3. NÃO pare. Continue até §12 TRUE ou contexto acabar (feche gate limpo).
4. Código em inglês. UI via `t()`. Doc em português.
5. Tokens de design system — NUNCA hardcoded.
6. Deploy SEMPRE via `scripts/deploy.sh`.
7. Terminal WSL safe: `git --no-pager`, `commit -m`, nunca pager.
8. Brain sync: dev-log a cada milestone.

## Decisões adotadas (DECs 470-474)

- Timeline vertical apenas para transit days. Full days: HeroBanner + agenda.
- Sem imagens de cidades. Hero usa gradiente por dayType.
- Renderização condicional por dayType na ItineraryPage.
- PVV: Playwright screenshots (375×812) + checklist + 3 cenários.
- Manter design system (tokens.css). Wireframes definem layout, não tokens.

## ÂNCORA

```
═══════════════════════════════════════════════════════
ÂNCORA — Itinerary Visual Redesign (COMPLETO)
· VIS-1: Tokens.css = ÚNICA fonte de cor/fonte/espaçamento
· VIS-2: Emojis PROIBIDOS na UI → Material Symbols
· VIS-3: Sem neumorfismo → tonal layering
· VIS-4: transition-all PROIBIDO → propriedades explícitas
· VIS-5: Dados sparse DEVEM degradar gracefully
· VIS-6: Viewport de screenshot = 375×812
· VIS-7: itinerary-domain.ts INTOCADO
· VIS-8: Checklist visual do wireframe = gate pass
· VIS-9: Sem APIs externas (imagens, clima) — MVP com gradientes
CURRENT STATE: gate=G0 | version=2.13.1-rc | tests=?? | scope=Full
═══════════════════════════════════════════════════════
```

## Gates (10 gates, 3 waves)

| Gate | Wave | Conteúdo | Deploy |
|------|------|---------|--------|
| G0 | — | Setup, baseline, Playwright scaffold, screenshots before | — |
| G1 | 1 | TimelineView + HeroBanner + BudgetStatusBadge + SkeletonLoader | — |
| G2 | 1 | ItineraryPage redesign (empty, GPS×4, transit, full day) | 2.14.0-rc |
| G3 | 1 | ItineraryContextCard (colunas, timeline, skeleton, budget) | 2.14.1-rc |
| G4 | 2 | BookingChecklistPage (cards ricos, ações por status) | 2.14.2-rc |
| G5 | 2 | LegFormSheet (seções, chips, footer) | 2.14.3-rc |
| G6 | 2 | CopilotFlow (5 stages completos) | 2.14.4-rc |
| G7 | 3 | ItineraryMapPage (split view, dark tiles, sync) | 2.14.5-rc |
| G8 | 3 | Settings + QuickAdd contexto + In-app notification + LIVE badge | 2.15.0-rc |
| G9 | — | Segundo passe visual completo + finalização | 2.15.x-rc |

## PVV — Protocolo de Verificação Visual

Para CADA gate visual:
1. Read wireframe PNG → extrair checklist numerado
2. Implementar milestones
3. Playwright screenshot (375×812) com 3 cenários (normal/mínimo/extremo)
4. Read screenshot + wireframe → comparar item por item
5. Divergências → fix → re-screenshot
6. Quando 100% ✅ → embedar side-by-side no chat
7. Só avança quando checklist completo

## Recuperação de contexto

Se o contexto zerar:
1. Leia `src/dev-log.md` → Current State diz gate + milestone + version
2. Leia este doc (orquestrador) §3 + o gate atual em §10
3. Leia o componente que estava sendo editado
4. Continue de onde parou

O dev-log é a ÚNICA fonte de verdade do estado de execução. Atualize a CADA milestone.

## G0 — Começo

```bash
cd /home/julio/projetos/trip-budget-copilot/TripPilot
npm run test
npm run build
npx tsc --noEmit
```

Documentar baseline → criar visual-verification.spec.ts → semear dev-log → screenshots before.

Depois: G1 → G2 → ... → G9. Não pare até §12 TRUE.

**Confirme em UMA linha que leu o orquestrador e iniciou G0 — depois continue sem esperar reply.**
