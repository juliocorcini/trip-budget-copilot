# Gap Fix Log R3 — TripPilot

## Current State
- **Gate ativo**: Gate 1 (app feel)
- **Requisito ativo**: R-01
- **Itens resolvidos**: 0/26
- **Testes**: 228 unit (baseline) + e2e baseline em verificação
- **Build/Typecheck**: clean (baseline sobre commit 0bc779c, v0.3.0)
- **Notas de ambiente**: Node 22 p/ wrangler/playwright (`export PATH="$HOME/.nvm/versions/node/v22.22.3/bin:$PATH"`); git via `bash -c 'git commit -F /tmp/commit-msg.txt'`; NUNCA criar Dexie v4 sem necessidade real de índice

## Por gate

### Gate 0 — Baseline + decision-log
- [x] Baseline: 228 unit ✅ · typecheck ✅ · build ✅ (sobre v0.3.0, commit 0bc779c)
- [x] State file criado
- [x] DEC-084..102 registradas como APPROVED no decision-log (Last updated 2026-06-10)

### Gate 1 — App feel (R-01..05)
- [ ] R-01 — Headers fixos (Dashboard, Gastos, Planejar)
- [ ] R-02 — Margens compactas padronizadas (token `--page-padding-x`)
- [ ] R-03 — Cards do carrossel com mesma altura
- [ ] R-04 — Scrollbars horizontais invisíveis
- [ ] R-05 — Pull-to-refresh desativado no PWA

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
