# Gap Fix Log R3 — TripPilot

## Current State
- **Gate ativo**: Gate 2 (dashboard certo)
- **Requisito ativo**: R-06
- **Itens resolvidos**: 5/26
- **Testes**: 228 unit + 29 e2e (baseline preservada)
- **Build/Typecheck**: clean
- **Notas de ambiente**: Node 22 p/ wrangler/playwright (`export PATH="$HOME/.nvm/versions/node/v22.22.3/bin:$PATH"`); git via `bash -c 'git commit -F /tmp/commit-msg.txt'`; NUNCA criar Dexie v4 sem necessidade real de índice

## Por gate

### Gate 0 — Baseline + decision-log
- [x] Baseline: 228 unit ✅ · typecheck ✅ · build ✅ (sobre v0.3.0, commit 0bc779c)
- [x] State file criado
- [x] DEC-084..102 registradas como APPROVED no decision-log (Last updated 2026-06-10)

### Gate 1 — App feel (R-01..05)
- [x] R-01 — Headers fixos: padrão único `.page-sticky-header` (sticky, fundo `--surface`, full-bleed, elevação `.is-scrolled` via hook `useScrolled`) aplicado a Dashboard (header dia+fase+sino), Gastos (título+tabs+chips de filtro) e Planner (header+seletor de fases+resumo) — z-30, abaixo de nav/sheets
- [x] R-02 — Token `--page-padding-x: 16px` em tokens.css; AppShell main usa o token; Dashboard perdeu TODOS os `mx-5` (cards alinhados à mesma margem); carrossel full-bleed (`-mx`/`px` com o token)
- [x] R-03 — OccasionCounter com altura determinística: nome reserva 2 linhas (`min-h-[26px] line-clamp-2`), sublabel reserva `min-h-[12px]`, wrapper `flex` estica os cards
- [x] R-04 — Root cause: classe `no-scrollbar` usada em 5 lugares mas NUNCA definida. Definida em globals.css (`scrollbar-width:none` + `::-webkit-scrollbar{display:none}`) — corrige filtros de Gastos, carrossel, seletor de fases do Planner e 2 scrollers do OutingPage de uma vez
- [x] R-05 — `@media (display-mode: standalone) { html, body { overscroll-behavior-y: none } }` em globals.css — PWA instalado sem pull-to-refresh, browser preservado

### Gate 2 — Dashboard certo (R-06..10)
- [ ] R-06 — "Livre para usar hoje" subtrativo
- [ ] R-07 — Remover "Reservado para [próx. fase]" do hero
- [ ] R-08 — Sino → Central de notificações
- [ ] R-09 — Insights: swipe navega, tap detalha
- [ ] R-10 — Card de economia contextual

### Gate 3 — Amigo Sincero v2 + simulador (R-11..12)
- [ ] R-11 — Amigo Sincero baseado no plano + ImpactDetail
- [ ] R-12 — Simulador multi-métrica

### Gate 4 — Taxonomia (R-13..18)
- [ ] R-13 — Catálogo de subcategorias por tipo
- [ ] R-14 — Stepper ≥10s
- [ ] R-15 — Itens da sessão mostram subcategoria
- [ ] R-16 — Split pergunta o que foi
- [ ] R-17 — Eventos: 2 níveis
- [ ] R-18 — Detalhe de saída com itens específicos

### Gate 5 — Planner overhaul (R-19..24)
- [ ] R-19 — Margem livre ao vivo
- [ ] R-20 — Alerta over-budget no topo + negativo
- [ ] R-21 — Menu de categoria
- [ ] R-22 — Classificação por fase + cadeado real
- [ ] R-23 — Evento abre edição do evento
- [ ] R-24 — Perfis: editar e remover

### Gate 6 — Dívidas + cliques (R-25..26)
- [ ] R-25 — Extrato por participante
- [ ] R-26 — Varredura de cliques

### Gate 7 — Brain + verificação + deploy
- [ ] Brain atualizado (decision-log, project-status, product-spec, database-schema)
- [ ] package.json 0.4.0
- [ ] Verificação 26/26 + smokes + i18n ×3
- [ ] Deploy v0.4.0

## Extras encontrados (anotar, não corrigir)
- (nenhum ainda)

## Varredura de cliques (R-26)
- (preencher no Gate 6)
