# Kickoff — Leva "Post-AI Field Fixes & Onboarding UX" (TripPilot)

Você é um engenheiro full-stack sênior aplicando a leva "Post-AI Field Fixes & Onboarding UX" do TripPilot de ponta a ponta, sozinho, nesta sessão.

## Source of truth

- **Orchestrator doc:** `TripPilot/brain/documents/2026-07-10-field-feedback-post-ai-wave-orchestrator.md`
- Read §0–§9 once, then execute G0→G4 in order.

## Wave state

O doc está **AWAITING LOCK** (§16: L-ONBOARDING-FLOW — default adotado = Opção A). Execute G0→G4. G3 depende do lock, mas o default é Opção A (step de escolha). Se o Julio não travar antes de G3, seguir com o default.

## Autonomy contract (8 rules)

1. NO subagents, NO Task tool. Everything inline.
2. DON'T ask permission to advance. Milestone done → commit → deploy → next.
3. DON'T stop because "it's too much work". Continue until §12 DoD is all TRUE.
4. DON'T narrate — DO. Minimize prose.
5. Code → English. UI → t() with pt-BR/en/es.
6. Domain before UI. Test WITH the change.
7. WSL terminal: `git --no-pager`, `G=/usr/bin/git; "$G" commit -m "…"`. No pagers.
8. Brain sync: dev-log every milestone, decision-log every new DEC.

## Already-adopted decisions

- DEC-498: Router errorElement com RouteErrorPage (stack trace copiável, ícone, reload, go home)
- DEC-499: Install banners mutuamente exclusivos (Android → ApkBanner only, não-Android → InstallNudge only)
- DEC-500: Campo startDate no quickStep do onboarding simples

## Hotfixes já no ar (2.10.2-rc)

- `startsWith` crash: `String()` coercion em `PlanCopilotQuestions.tsx`
- Copilot redirect: `OnboardingPage.tsx` → `/planner?copilot=1`
- Deploy no apex: sem `--branch=production`

## ÂNCORA block

```
━━━ ANCHOR (Post-AI Field Fixes) ━━━
ÂNCORA-FIX-1: Nenhum fix pode quebrar o que já funciona
ÂNCORA-FIX-2: ErrorBoundary SEMPRE captura antes do React Router
ÂNCORA-FIX-3: Install banners MUTUAMENTE EXCLUSIVOS
ÂNCORA-FIX-4: Salvar gasto PERSISTE a carteira
ÂNCORA-FIX-5: Onboarding simples pede data inicial + final
Dinheiro = cents | Domínio = TS puro | UI = t() | Hide never delete
CURRENT STATE: Gate=G0 | Last=start | Tests=baseline | Risks=none | Scope=on-track
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

## Gate order

| Gate | Scope | Target Version |
|------|-------|----------------|
| G0 | Setup & baseline | 2.10.2-rc (no bump) |
| G1 | Error page + Install banner + Start date | 2.10.3-rc |
| G2 | Wallet update bug | 2.10.4-rc |
| G3 | Onboarding UX: rápido vs detalhado (§16 lock) | 2.10.5-rc |
| G4 | Auditoria da wave AI Planning | 2.10.6-rc |

## G0 — Start here

```bash
cd TripPilot && npm install
npm run test 2>&1 | tail -5
npm run build
tsc --noEmit
```

Record baseline counts. Seed dev-log. Add DEC-498→500 as PROPOSED in decision-log.md. Confirm deploy pipeline (apex = `trippilot.pages.dev`, deploy SEM `--branch=production`).

Then execute G1→G4, don't stop until the DoD is all TRUE.

A cada versão nova: criar release note, fazer deploy completo para o Julio testar no app.

Confirm in ONE line that you read the orchestrator and started G0 — then continue without waiting for a reply.
