# UX/UI Polish Log — Autônomo

> Rodada autônoma de polish de UX/UI (madrugada 2026-06-14). Regra de ouro:
> ZERO funcionalidade removida — apenas REORGANIZAR (ordem, agrupamento,
> hierarquia, colapsar/expandir, sub-telas). Design system INTOCÁVEL.

## Current State

- **Gate**: 1 concluído → iniciando Gate 2 (Dashboard)
- **Telas analisadas**: 24/24 (21 rotas + welcome + Modo Simples + saída ativa) | **Telas melhoradas**: 0
- **Método de screenshot que funcionou**: **B (Playwright)** — `scripts/ux-shots.mjs`
  (chromium Pixel 5, semeia demo via botão, captura viewport + fullPage)
- **Mock aplicado**: botão "Dados de demonstração" (`generateDemoData`) — contexto
  efêmero do Playwright, nunca persistido no repo
- **Tests baseline**: **814 passed (98 files)** | **Typecheck**: 0 | **Build**: ✅ (maior chunk vendor-react 287 KB)
- **Dev server**: `npm run dev` em background → http://localhost:5173 (HTTP 200)
- **Git**: branch `master` (push → origin/master). **Cloudflare Pages produção = `--branch=main`** (master puro = Preview). Repo único na raiz (`TripPilot/.git` é stub vazio órfão, ignorado pelo git)
- **Versão atual**: 0.14.1

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

## Reverts

| # | O que | Por que reverteu | Nova abordagem |
|---|-------|------------------|----------------|

## Notas de ambiente / recovery

- Node 22: `export PATH="$HOME/.nvm/versions/node/v22.22.3/bin:$PATH"`
- Screenshots: `cd TripPilot && node scripts/ux-shots.mjs <label> [rota...]` → `.ux-shots/<label>/`
- Rotas conhecidas: dashboard, expenses, quick-add, planner, simulator, funds, wallets, profiles, trip, trip-edit, shared, more, settings, settings-backup, settings-dashboard, about, notifications, impact, rescue, outings-new (+ welcome antes do seed)
- Testes: `npx vitest run` | Typecheck: `npx tsc --noEmit` | Build: `npm run build`
- Deploy produção: `npx wrangler pages deploy dist --project-name=trippilot --branch=main`
