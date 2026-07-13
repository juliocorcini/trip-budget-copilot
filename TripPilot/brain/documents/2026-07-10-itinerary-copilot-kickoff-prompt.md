# Kickoff Prompt — Wave "Itinerary Copilot"

> Cole este prompt inteiro no início de uma nova sessão de chat.

---

## Contexto

Você vai implementar a wave "Itinerary Copilot" do TripPilot — uma feature nova que adiciona itinerário da viagem ao app (cidades, transportes, hospedagem, timeline do dia). O orquestrador completo está em:

**`TripPilot/brain/documents/2026-07-10-itinerary-copilot-orchestrator.md`**

Leia-o INTEIRO antes de qualquer ação. Ele contém: schema, decisões, gates, milestones, ACs, testes, deploy.

---

## Estado atual

- **Version:** 2.11.3-rc
- **Baseline:** 325 files / 3338 passed / 2 failed (pré-existentes split-live-loop)
- **tsc:** 0 erros
- **Build:** OK
- **G0 completo:** dev-log semeado, DECs 505-508 registrados no decision-log
- **Próximo gate:** G1 (Schema + Domain + Repository)

---

## O que fazer

1. **Leia o orquestrador** (`brain/documents/2026-07-10-itinerary-copilot-orchestrator.md`) — §0 a §9 completos
2. **Confirme baseline** — `npm run test`, `tsc --noEmit`, `npm run build`
3. **Execute G1** — criar ItineraryLeg entity, schema V14, repository, domain functions com testes
4. **Depois G2** — Worker endpoints `/itinerary-copilot/build` e `/refine`
5. **Depois G3** — UI de conversa com IA + tela de confirmação + sugestão de fases
6. **Depois G4** — Card "Próximo" no Home + tela de Agenda do dia
7. **Depois G5** — CRUD manual + deploy final 2.12.0-rc

---

## Regras críticas (resumo, detalhe no orquestrador §1 e §3)

- **Implementar → testar → corrigir → só avança se PERFEITO**
- SEM subagents. Tudo inline.
- Deploy a cada gate via `bash scripts/deploy.sh`
- Suite inteira deve rodar verde entre cada gate
- ZERO impacto em telas existentes (ÂNCORA-ITIN-1)
- Prepaid é INFORMATIVO (ÂNCORA-ITIN-3)
- Card no Home SÓ com legs > 0 (ÂNCORA-ITIN-2)
- Itinerário Copilot SEPARADO do Plan Copilot (ÂNCORA-ITIN-5)
- Código em inglês. UI via `t()` em pt-BR/en/es.
- Terminal: sempre `git --no-pager`, nunca pager.

---

## Documentos de referência

| Doc | O que é |
|-----|---------|
| `brain/documents/2026-07-10-itinerary-copilot-orchestrator.md` | **FONTE DE VERDADE** — gates, milestones, ACs, schema |
| `brain/documents/2026-07-10-itinerary-feature-design.md` | Design completo da feature (UX, modelo, fluxo IA) |
| `brain/documents/2026-07-10-eurotrip-data-analysis-and-app-evolution.md` | Análise dos dados do Julio + gaps |
| `src/dev-log.md` | Estado da wave (atualizar a cada milestone) |
| `brain/decision-log.md` | DECs 505-508 (ItineraryLeg, separação, fases, prepaid) |
| `.cursor/rules/deploy-checklist.mdc` | Procedimento de deploy |

---

## Fixture de teste (dados reais do Julio)

O orquestrador §13 tem a fixture completa. As 14 legs são derivadas da planilha de viagem real:
- Veneza/Mestre (15-17, 19-21 Jul)
- Ljubljana (17-19 Jul)
- Trieste (19 Jul, bate-volta)
- Verona (20 Jul, bate-volta)
- Bruxelas (21-28 Jul, inclui Tomorrowland 23-26)
- Amsterdam (28-29 Jul)
- Berlin (30-31 Jul)
- Freiburg (01-02 Ago)
- Lucerna (02-04 Ago)
- Zurique (04 Ago, bate-volta)
- Madrid/Burgos (04 Ago, retorno)

---

## Comece agora

Leia o orquestrador e execute G1 sem parar. Ao terminar G1, deploy e continue G2. A wave termina quando §11 (DoD) for ALL TRUE e apex mostrar 2.12.0-rc.
