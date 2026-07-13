# Kickoff Prompt — Wave "Itinerary Polish"

> Cole este prompt inteiro no início de uma nova sessão de chat.

---

## Contexto

Você vai implementar a wave "Itinerary Polish" do TripPilot — 15 features de evolução visual, contextual e funcional para o itinerário V1 que já está no ar. O orquestrador completo está em:

**`TripPilot/brain/documents/2026-07-10-itinerary-polish-orchestrator.md`**

Leia-o INTEIRO antes de qualquer ação. Ele contém: todas as 15 features detalhadas, gates, ACs, testes, deploy.

---

## Estado atual

- **Version:** 2.12.0-rc
- **Baseline:** 327 files / 3391 passed / 2 failed (pré-existentes split-live-loop)
- **tsc:** 0 erros
- **Build:** OK
- **Itinerary V1 implementado:** Schema, domain functions (5), UI (ItineraryPage, ContextCard, CopilotFlow, Preview, LegFormSheet), Worker endpoints (build + refine)
- **Próximo gate:** G0 (baseline), depois G1 (Visual Foundation)

---

## O que fazer

1. **Leia o orquestrador** (`brain/documents/2026-07-10-itinerary-polish-orchestrator.md`) — §0 a §9
2. **Confirme baseline** — `npm run test`, `tsc --noEmit`, `npm run build`
3. **Execute G1** — Color coding + Progress bar + Timeline vertical + Swipe
4. **Depois G2** — Budget premise no QuickAdd + Companions + Spent/Planned + Notes
5. **Depois G3** — Card expandido + Booking checklist + Deep link gasto→leg
6. **Depois G4** — Mapa com rota + GPS auto-detect
7. **Depois G5** — Notificações + Sharing → deploy final 2.13.0-rc

---

## Regras críticas

- **Implementar → testar → corrigir → só avança se PERFEITO**
- SEM subagents. Tudo inline.
- Deploy a cada gate via `bash scripts/deploy.sh`
- Suite inteira deve rodar verde entre cada gate
- ZERO impacto em cálculos financeiros (ÂNCORA-POL-1)
- O itinerário continua OPT-IN (ÂNCORA-ITIN-1)
- GPS e notificações são OPT-IN com permission request
- Companion no QuickAdd é SUGESTÃO, não override (ÂNCORA-POL-4)
- Código em inglês. UI via `t()` em pt-BR/en/es.
- Terminal: sempre `git --no-pager`, nunca pager.

---

## BUG CRÍTICO para corrigir primeiro

O `ItineraryCopilotFlow.tsx` tem um gap: ambos os botões ("Passo a passo" e "Já tenho as infos") fazem `setStage('input')` — vão para a MESMA textarea. O modo guiado conversacional (IA pergunta → user responde → IA constrói) NÃO EXISTE. Implementar como P00 no G1, antes de tudo.

---

## Features desta wave (resumo)

| Gate | Features | Versão |
|------|----------|--------|
| G1 | **Conversational Flow (fix)** · Color coding · Progress bar · Timeline vertical · Swipe dias | 2.12.1-rc |
| G2 | Budget premise QuickAdd · Companions · Spent/planned · Quick notes | 2.12.2-rc |
| G3 | Card expandido · Booking checklist · Deep link gasto→leg | 2.12.3-rc |
| G4 | Mapa com rota · GPS auto-detect | 2.12.4-rc |
| G5 | Notificações transporte · Sharing itinerário | 2.13.0-rc |

---

## Documentos de referência

| Doc | O que é |
|-----|---------|
| `brain/documents/2026-07-10-itinerary-polish-orchestrator.md` | **FONTE DE VERDADE** — 15 features detalhadas, gates, ACs |
| `brain/documents/2026-07-10-itinerary-copilot-orchestrator.md` | Orquestrador da wave anterior (V1) |
| `brain/documents/2026-07-10-itinerary-feature-design.md` | Design original da feature |
| `src/dev-log.md` | Dev-log da wave anterior (G0-G5 complete) |
| `.cursor/rules/deploy-checklist.mdc` | Procedimento de deploy |

---

## Arquivos-chave para modificar

- `src/features/itinerary/ItineraryPage.tsx` — timeline visual, colors, swipe, progress
- `src/features/itinerary/ItineraryContextCard.tsx` — card expandido
- `src/features/expenses/QuickAddSheet.tsx` — budget hint + companions
- `src/features/dashboard/DashboardPage.tsx` — onde o card está
- `src/domain/itinerary/itinerary-domain.ts` — novas domain functions
- `src/features/map/` — rota no mapa
- Worker endpoints: sem mudança nesta wave

---

## Comece agora

Leia o orquestrador e execute G0 + G1 sem parar. A wave termina quando §11 (DoD) for ALL TRUE e apex mostrar 2.13.0-rc.
