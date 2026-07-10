# Kickoff — Leva "AI Planning & Marketing Gaps" (TripPilot)

Você é um engenheiro full-stack sênior aplicando a leva **"AI Planning & Marketing Gaps"** do TripPilot de ponta a ponta, sozinho, nesta sessão.

## Source of truth

**Orchestrator doc:** `TripPilot/brain/documents/2026-07-10-ai-planning-wave-orchestrator.md`
**Spec detalhada:** `docs/reports/2026-07-10-ai-powered-planning-spec.md` (prompts v5, lookup table, UX)

Read §0–§9 once, then execute G0→G7 in order.

## Wave state

O doc está **ACTIVE** (§16 lockada). Execute G0→G7. G6/G7 são P2 (optional, if slack).
- Q1 LOCKED: agente pode rodar `wrangler deploy`
- Q2 LOCKED: tela de perguntas = bottom sheet (70% da tela, scrollável)

## Autonomy contract (9 rules)

1. NO subagents, NO Task tool. Everything inline.
2. DON'T ask permission to advance. Milestone done → commit → deploy → next.
3. DON'T stop because "it's too much work". Continue until §12 DoD is all TRUE.
4. DON'T narrate — DO. Minimize prose.
5. Code → English. UI → `t()` with pt-BR/en/es.
6. Domain before UI. Test WITH the change.
7. Reuse what §4/§6 say exists.
8. WSL terminal: `git --no-pager`, `G=/usr/bin/git; "$G" commit -m "…"`. No pagers.
9. Brain sync: dev-log every milestone, decision-log every new DEC.

## Already-adopted decisions

- **DEC-489**: Sublabel → typical cost (not "X done")
- **DEC-490**: Swap insight as carousel card (not Amigo Sincero)
- **DEC-491**: Smart onboarding: chips → auto ScenarioPlan, balanced default
- **DEC-492**: AI Copilot: 2 Worker endpoints, prompts v5, lean JSON
- **DEC-493**: Mid-trip re-plan: herda spending_style, payload com current_spending
- **DEC-494**: Lookup table: IA lean + Client enrichment (6 clusters)
- **DEC-495**: spending_style = mandatory first question (4 levels)
- **DEC-496**: Budget limits style, never falsifies prices
- **DEC-497**: Progressive disclosure in result UI

## ÂNCORA block

```
━━━ ANCHOR (AI Planning Wave) ━━━
ÂNCORA-AI-1: App NUNCA confia na aritmética da IA
ÂNCORA-AI-2: cost ≤ 0 ou qty ≤ 0 = rejeição automática
ÂNCORA-AI-3: Zero dados pessoais enviados à IA
ÂNCORA-AI-4: Offline = funcional (IA é upgrade, não dependência)
ÂNCORA-AI-5: Modo manual continua existindo
Dinheiro = cents | Domínio = TS puro | UI = t() | Hide never delete
CURRENT STATE: Gate=G0 | Last=start | Tests=baseline | Risks=none | Scope=on-track
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

## Gate order

| Gate | Scope | Target Version |
|------|-------|:--------------:|
| G0 | Setup & baseline | 2.9.16-rc (no bump) |
| G1 | Sublabel → typical cost | 2.9.17-rc |
| G2 | Smart Onboarding (Fase 1, sem IA) | 2.9.18-rc |
| G3 | Troca Inteligente insight | 2.9.19-rc |
| G4 | Worker endpoints + lookup table | 2.9.20-rc |
| G5 | UI AI Copilot (Fase 2 frontend) | 2.10.0-rc |
| G6 | Mid-trip re-plan (P2) | 2.10.1-rc |
| G7 | Tom coloquial (P2) | 2.10.2-rc |

## G0 — Start here

```bash
cd TripPilot && npm install
npm run test
npm run build
tsc --noEmit
```

Record baseline counts. Seed dev-log. Add DEC-494→497 as PROPOSED in decision-log.md. Confirm deploy pipeline.

**Then execute G1→G7, don't stop until the DoD is all TRUE.**

Confirm in ONE line that you read the orchestrator and started G0 — then continue without waiting for a reply.
