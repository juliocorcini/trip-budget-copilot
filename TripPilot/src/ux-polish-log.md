# UX/UI Polish Log — Autônomo

> Rodada autônoma de polish de UX/UI (madrugada 2026-06-14). Regra de ouro:
> ZERO funcionalidade removida — apenas REORGANIZAR (ordem, agrupamento,
> hierarquia, colapsar/expandir, sub-telas). Design system INTOCÁVEL.

## Current State

- **Gate**: 0 concluído → iniciando Gate 1
- **Telas analisadas**: 0/~21 | **Telas melhoradas**: 0
- **Método de screenshot que funcionou**: **B (Playwright)** — `scripts/ux-shots.mjs`
  (chromium Pixel 5, semeia demo via botão, captura viewport + fullPage)
- **Mock aplicado**: botão "Dados de demonstração" (`generateDemoData`) — contexto
  efêmero do Playwright, nunca persistido no repo
- **Tests baseline**: **814 passed (98 files)** | **Typecheck**: 0 | **Build**: ✅ (maior chunk vendor-react 287 KB)
- **Dev server**: `npm run dev` em background → http://localhost:5173 (HTTP 200)
- **Git**: branch `master` (push → origin/master). **Cloudflare Pages produção = `--branch=main`** (master puro = Preview). Repo único na raiz (`TripPilot/.git` é stub vazio órfão, ignorado pelo git)
- **Versão atual**: 0.14.1

## Inventário de telas (Gate 1)

| # | Tela | Shot ANTES | Problemas | Plano | Shot DEPOIS | Status |
|---|------|-----------|-----------|-------|-------------|--------|
| — | (preenchido no Gate 1) | | | | | |

## Decisões de UX (cada uma)

| # | Decisão | Motivo | Tela | Consultou doc? |
|---|---------|--------|------|----------------|

## Zona protegida — toquei? (insights / ações horizontais)

| Item | Mexi? | Por quê | Essência preservada? |
|------|-------|---------|----------------------|
| Carrossel de insights | (a decidir no Gate 1) | | |
| Menu de ações planejadas (scroll horizontal) | (a decidir no Gate 1) | | |

## Reverts

| # | O que | Por que reverteu | Nova abordagem |
|---|-------|------------------|----------------|

## Notas de ambiente / recovery

- Node 22: `export PATH="$HOME/.nvm/versions/node/v22.22.3/bin:$PATH"`
- Screenshots: `cd TripPilot && node scripts/ux-shots.mjs <label> [rota...]` → `.ux-shots/<label>/`
- Rotas conhecidas: dashboard, expenses, quick-add, planner, simulator, funds, wallets, profiles, trip, trip-edit, shared, more, settings, settings-backup, settings-dashboard, about, notifications, impact, rescue, outings-new (+ welcome antes do seed)
- Testes: `npx vitest run` | Typecheck: `npx tsc --noEmit` | Build: `npm run build`
- Deploy produção: `npx wrangler pages deploy dist --project-name=trippilot --branch=main`
