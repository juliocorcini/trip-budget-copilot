# UX/UI Polish Log — Autônomo

> Rodada autônoma de polish de UX/UI (madrugada 2026-06-14). Regra de ouro:
> ZERO funcionalidade removida — apenas REORGANIZAR (ordem, agrupamento,
> hierarquia, colapsar/expandir, sub-telas). Design system INTOCÁVEL.

## Current State

- **Gate**: 3 concluído (Captura) → iniciando Gate 4 (planejamento/finanças)
- **Telas analisadas**: 24/24 (21 rotas + welcome + Modo Simples + saída ativa) | **Telas melhoradas**: 2 (dashboard + quick-add)
- **Método de screenshot que funcionou**: **B (Playwright)** — `scripts/ux-shots.mjs`
  (chromium Pixel 5, semeia demo via botão, captura viewport + fullPage)
- **Mock aplicado**: botão "Dados de demonstração" (`generateDemoData`) — contexto
  efêmero do Playwright, nunca persistido no repo
- **Tests**: **819 passed (98 files)** (+5 colapso) | **Typecheck**: 0 | **Build**: ✅ (maior chunk vendor-react 287 KB)
- **Dev server**: `npm run dev` em background → http://localhost:5173 (HTTP 200)
- **Git**: branch `master` (push → origin/master). **Cloudflare Pages produção = `--branch=main`** (master puro = Preview). Repo único na raiz (`TripPilot/.git` é stub vazio órfão, ignorado pelo git)
- **Deploy comando**: `CLOUDFLARE_ACCOUNT_ID=e146e88b34b2694243b1d74cee8de743 npx wrangler pages deploy dist --project-name=trippilot --branch=main` (env var obrigatório — 2 contas, sem ele o picker trava o terminal)
- **Release plumbing por deploy**: bump `package.json` + `src/utils/app-version.ts` + nova entrada em `src/utils/release-notes.ts` (newest first, pt/en/es) + `public/sw.js` CACHE_NAME (toast de update)
- **Versão atual**: 0.14.3 (SW cache v13) — Gate 3 em PRODUÇÃO → https://58763c5d.trippilot.pages.dev (alias prod trippilot.pages.dev). Gate 2 = 0.14.2 (https://412a81f0.trippilot.pages.dev)

## Inventário de telas (Gate 1) — shots em `.ux-shots/gate1/` e `.ux-shots/gate1-scenarios/`

> **Veredito geral**: o app é coeso e bem desenhado. As telas de finanças,
> captura e secundárias têm bom respiro e hierarquia clara. **O DASHBOARD é o
> único outlier denso** (a dor declarada: "muitos cards abertos"). O foco do
> polish é o dashboard (Gate 2); o resto recebe ajustes pontuais de
> consistência/densidade, sem reescrever nada.

| # | Tela | Densidade/1ª impressão | Problemas | Plano | Risco regressão |
|---|------|------------------------|-----------|-------|-----------------|
| 1 | **dashboard** (complete) | 🔴 ~15 seções + até 3 alertas no topo | (a) 2 banners de proteção de dados REDUNDANTES empilhados antes do hero; (b) muitos cards "abertos" — analytics pesados (recap, burndown, heatmap) sempre expandidos; (c) hero empurrado para baixo | **Gate 2**: A) consolidar alertas (1 por vez); B) reordenar defaults (contextual/acionável em cima, analytics em baixo); C) disclosure progressivo: analytics read-only colapsados por padrão (expansível, persistido) — reusa DEC-119; D) afinar ritmo vertical | Médio (mitigado por screenshots antes/depois + revert) |
| 2 | dashboard (Modo Simples) | 🟢 enxuto (hero + Registrar gasto) | herda os mesmos 3 alertas do topo | corrigido pela consolidação de alertas (A) | Baixo |
| 3 | dashboard (saída ativa) | 🟠 + card de saída ativa | mais um card no topo da pilha densa | aliviado por B/C; card de saída ativa é fixo (correto) | Baixo |
| 4 | **/outings/active** | 🟢 excelente | nenhum relevante — gauge/timer/stepper legíveis, quick-add grande | **PRESERVAR**. Só revisar consistência de espaçamento (Gate 3) | Baixo |
| 5 | **/quick-add** | 🟠 formulário longo | valor no topo ✓ mas "Salvar" no fim; muito scroll p/ confirmar (usuário com pressa) | **Gate 3**: avaliar barra de ação fixa (Cancelar/Salvar) p/ salvar sem rolar; manter todos os campos | Médio |
| 6 | /outings/new | 🟢 limpo | — | manter | Baixo |
| 7 | /expenses | 🟢 escaneável | metadados densos por linha (cat·hora·fundo·carteira) | Gate 3: revisar densidade da linha (opcional, leve) | Baixo |
| 8 | /planner | 🟢 claro | presets sob a nav no fim (scroll) | Gate 4: conferir respiro inferior | Baixo |
| 9 | /simulator | 🟢 input-first | muito espaço vazio antes de digitar | Gate 4: aceitável; talvez dica/exemplo | Baixo |
| 10 | /funds | 🟢 limpo | espaço vazio | manter | Baixo |
| 11 | /wallets | 🟢 limpo | — | manter | Baixo |
| 12 | /profiles | 🟢 limpo | — | manter | Baixo |
| 13 | /trip | 🟢 bem organizado | — | manter | Baixo |
| 14 | /trip/edit | 🟠 form longo | esperado p/ edição completa de fases | Gate 5: só consistência | Baixo |
| 15 | /shared | 🟢 seções claras | — | manter | Baixo |
| 16 | **/settings** | 🟠 muito longo/denso | parede de seções empilhadas | Gate 5: agrupar/seccionar visualmente (sem remover opções) | Médio |
| 17 | /more | 🟢 ótima IA (VIAGEM/DADOS/APP) | — | manter (referência de IA) | Baixo |
| 18 | /about | 🟢 limpo, histórico colapsável | — | manter | Baixo |
| 19 | /settings/dashboard | 🟢 funcional (reorder/hide) | — | Gate 2: refletir colapso se C for feito | Baixo |
| 20 | /notifications | 🟢 limpo | — | manter | Baixo |
| 21 | /impact | 🟢 bem organizado | — | manter | Baixo |
| 22 | /rescue | 🟢 input-first | espaço vazio | manter | Baixo |
| 23 | /settings/backup | 🟢 (revisar no Gate 5) | — | Gate 5: consistência | Baixo |
| 24 | /welcome | 🟢 centrado, claro | — | manter | Baixo |

### Lista PRIORIZADA por impacto no usuário
1. **Dashboard — consolidar alertas de topo** (remove redundância antes do hero) — alto impacto, baixo risco
2. **Dashboard — disclosure progressivo dos analytics** (resolve "muitos cards abertos") — alto impacto, risco médio
3. **Dashboard — reordenar defaults p/ hierarquia** (hero/ação primeiro, analytics depois) — alto impacto, baixo risco
4. **QuickAdd — barra de salvar fixa** (velocidade na captura) — médio impacto
5. **Settings — agrupamento visual** (reduzir parede de opções) — médio impacto
6. **Ritmo/espaçamento vertical** consistente no dashboard e telas longas — polish

### Foco crítico do DASHBOARD (respostas)
- **Cards demais abertos?** Sim. recap/burndown/heatmap (analytics read-only) podem colapsar por padrão; eventos/ação ficam.
- **Hero dominante?** É grande, mas empurrado por 2-3 alertas. Consolidar alertas devolve o hero ao topo.
- **Registrar em 1 toque?** FAB central sempre visível ✓; Modo Simples tem botão grande ✓.
- **Insights/contadores horizontais (ZONA PROTEGIDA)?** Tomam espaço, mas são charme aprovado (DEC-076/077/091/150). **Não mexer no comportamento**; no máximo conferir espaçamento.
- **Card informativo vs acionável?** Hoje todos têm peso visual parecido. Reordenar + colapsar separa "ler" de "agir".
- **Modo Simples?** Já é a versão enxuta correta; só herda o problema dos alertas.

## Decisões de UX (cada uma)

| # | Decisão | Motivo | Tela | Consultou doc? |
|---|---------|--------|------|----------------|
| D1 | Consolidar alertas de proteção de dados: no máx. 1 banner por vez (storage-não-persistente tem prioridade; senão lembrete de backup) | 2 banners redundantes empurravam o hero p/ baixo | Dashboard | DEC-057, BUG-002 (não contradiz; ambos vão p/ /settings/backup) |
| D2 | Reordenar ordem default dos cards: contextual/acionável no topo, analytics read-only (recap/burndown/heatmap) perto de "últimos gastos" | Hierarquia: separar "agir" de "ler" | Dashboard | DEC-119 (cards são movíveis por design — sem contradição) |
| D3 | Disclosure progressivo: analytics read-only colapsados por padrão (expansível, estado persistido) | Resolve "muitos cards abertos" sem remover nada | Dashboard | DEC-119/129/130/131 (estende o sistema configurável) |
| D4 | Afinar ritmo vertical (margens/alturas exageradas) mantendo tokens | Respiro + menos rolagem | Dashboard + telas longas | software-engineering-guidelines (tokens intocados) |

## Zona protegida — toquei? (insights / ações horizontais)

| Item | Mexi? | Por quê | Essência preservada? |
|------|-------|---------|----------------------|
| Carrossel de insights (DEC-077/091/150) | **Não** (planejado) | Charme aprovado; comportamento (swipe 1×1, dots, auto-rotação que pausa no toque) é intocável | Sim — só pode receber ajuste de espaçamento se necessário |
| Carrossel de contadores de ocasiões / scroll horizontal (DEC-076) | **Não** (planejado) | "Menu de ações com scroll horizontal" que o Julio gosta; ordenação por uso aprovada | Sim — preservar snap + 3 visíveis |

## Gate 2 — Dashboard (concluído) → 0.14.2 ✅

**Shots**: ANTES `.ux-shots/gate1/dashboard.full.png` · DEPOIS `.ux-shots/gate2-after/dashboard.full.png`
· colapsado/expandido `.ux-shots/gate2-expanded/` · cenários `.ux-shots/gate2-after-scenarios/`.

| Mudança | Arquivos | Resultado (antes→depois) |
|---------|----------|--------------------------|
| **D1** Consolidar alertas de topo (1 por vez: eviction-risk vence; senão backup) | `DashboardPage.tsx` | 2 banners empilhados → **1 banner**; hero sobe |
| **D2** Reordenar catálogo: contextual/ação no topo, analytics no fim | `domain/dashboard/dashboard-cards.ts` | analytics deixam de furar a hierarquia |
| **D3** Disclosure progressivo: recap+burndown+heatmap num drawer `trip_analytics` colapsável (fechado por padrão, estado persistido em `collapsedDashboardCards`) | `dashboard-cards.ts`, `DashboardCards.tsx`, `DashboardPage.tsx`, `types/app-settings.ts`, `data/db/seed.ts`, `domain/dashboard/index.ts`, i18n pt/en/es | 3 cards sempre abertos (~3 telas de scroll) → **1 cabeçalho "Análise da viagem"** que abre quando o usuário quiser. **Nada removido.** |
| **D4** Ritmo vertical | — | after já consistente; nenhuma mudança de espaçamento (evitar risco sem necessidade) |

**Verificação**: tap no header expande e renderiza os 3 analytics (recap "Ontem", Ritmo da fase, Mapa do mês) — confirmado por screenshot. **Zona protegida intocada**: carrosséis de insights (DEC-077/091/150) e contadores de ocasião (DEC-076) sem mudança de comportamento.

**Testes**: 819 verdes (+5 dos helpers `isDashboardCardCollapsed`/`toggleDashboardCardCollapsed` e ordem do catálogo atualizada em `dashboard-cards.test.ts`; fixtures de backup ganharam `collapsedDashboardCards: []`). Typecheck 0. Build sem chunk novo > 500 KB.

**Deploy**: PRODUÇÃO `--branch=main` → https://412a81f0.trippilot.pages.dev (atualiza `trippilot.pages.dev`). SW cache v12 → toast de update p/ instalados na 0.14.1.

## Gate 3 — Captura (concluído) → 0.14.3 ✅

**Shots**: ANTES viewport `.ux-shots/gate1/quick-add.png` · DEPOIS viewport `.ux-shots/gate3-after/quick-add.png`.

| Mudança | Arquivo | Resultado (antes→depois) |
|---------|---------|--------------------------|
| **Barra de ação sticky** no QuickAdd (Cancelar/Salvar fixos na base) | `features/expenses/QuickAddPage.tsx` | viewport antes terminava em "Carteira" (Salvar só no fim, muito scroll) → **Salvar sempre visível** no rodapé sem rolar. Conteúdo rola por baixo (borda + fundo da página). |

**Como**: `sticky bottom-0 z-10 -mx-5 px-5` + `pb-[calc(env(safe-area-inset-bottom)+0.75rem)]`, fundo `var(--surface)` + `border-top var(--border-faint)` — mesmo padrão de barras inferiores do app (`SelectionBar`/`BottomNav`). Página rola no body (fora do `AppShell`, sem bottom nav) → sticky fixa na viewport. Removido `pb-4` do container p/ a barra ficar rente.
**ZERO mudança de comportamento**: mesmos botões, mesmas regras de `disabled` (valor>0, fundo, taxa, transfer válido).

**Não mexido** (rated 🟢 no Gate 1, evitar risco): saída ativa (`/outings/active`), `/outings/new`, densidade da linha em `/expenses`.

**Testes**: 819 verdes (mudança só apresentacional). Typecheck 0. Build sem chunk novo > 500 KB.
**Deploy**: PRODUÇÃO `--branch=main` → https://58763c5d.trippilot.pages.dev. SW cache v13.

## Reverts

| # | O que | Por que reverteu | Nova abordagem |
|---|-------|------------------|----------------|

## Notas de ambiente / recovery

- Node 22: `export PATH="$HOME/.nvm/versions/node/v22.22.3/bin:$PATH"`
- Screenshots: `cd TripPilot && node scripts/ux-shots.mjs <label> [rota...]` → `.ux-shots/<label>/`
- Rotas conhecidas: dashboard, expenses, quick-add, planner, simulator, funds, wallets, profiles, trip, trip-edit, shared, more, settings, settings-backup, settings-dashboard, about, notifications, impact, rescue, outings-new (+ welcome antes do seed)
- Testes: `npx vitest run` | Typecheck: `npx tsc --noEmit` | Build: `npm run build`
- Deploy produção: `CLOUDFLARE_ACCOUNT_ID=e146e88b34b2694243b1d74cee8de743 npx wrangler pages deploy dist --project-name=trippilot --branch=main`
- **⚠️ COMMIT WORKAROUND (git 2.25.1)**: o shell do agente injeta `git commit --trailer 'Co-authored-by: …'`, que o git 2.25.1 NÃO suporta → todo `git commit` falha com `unknown option 'trailer'`. `status`/`log`/`push` funcionam normal. Solução (sem mexer em config nem `--no-verify`): commit via plumbing —
  `git add -A && tree=$(git write-tree) && c=$(git commit-tree "$tree" -p HEAD -F /tmp/msg.txt) && git update-ref HEAD "$c"` (incluir a linha `Co-authored-by:` no fim do /tmp/msg.txt). Depois `git push origin master`.
