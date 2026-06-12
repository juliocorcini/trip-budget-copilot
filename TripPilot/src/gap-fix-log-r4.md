# Gap-Fix Log — R4 Field Review (Julio's in-trip audio review)

- **Prompt**: `brain/documents/gap-fix-r4-implementation-prompt.md`
- **Note**: the previous file at this path (P2P sync round) was preserved as
  `src/gap-fix-log-r4-p2p-sync.md`. This round's decisions are DEC-114..123
  (D-R4-A..J — last DEC before this round was DEC-113, not DEC-102 as the
  prompt estimated).
- **Node**: `export PATH="$HOME/.nvm/versions/node/v22.22.3/bin:$PATH"`

## Current State

- **Active gate**: COMPLETE — all 10 gates done
- **Progress**: 12/12 requirements ✅
- **Tests**: 409 unit ✅ · 29 e2e ✅ · typecheck ✅ · build ✅
- **Build**: v0.7.0 (deployed)

## GATE 0 — Baseline + decision-log ✅
- [x] DEC-114..123 (D-R4-A..J) registered as APPROVED in decision-log.md
- [x] State file created (old P2P r4 log renamed, references updated)
- [x] Baseline confirmed: unit ✅ 343 · typecheck ✅ · build ✅ · e2e ✅ 29

## GATE 1 — Visual polish ✅
- [x] R-01 carousel alignment — `scroll-pl/pr-[var(--page-padding-x)]` on the counters
      carousel: rest position = initial render (first card aligned, 3 visible)
- [x] R-02 insights one-per-gesture — `snap-always` on insight slides (and counter cards)
- [x] R-03 chip label fit — chip labels wrap with `break-words hyphens-auto line-clamp-2`
      (QuickAdd + ExpenseDetail); `<html lang>` now follows the active language

## GATE 2 — Payer math (CRITICAL) ✅
- [x] R-04 `resolvePayerExpense` (domain/splitting) — single truth-table function used by
      QuickAdd, outing stepper and outing split. Row 4 fixed: "other paid, not split" =
      full personal cost + full debt (was: cost zeroed, no debt). Owner's own share born
      confirmed → debt appears in /shared immediately. `endOutingSession` no longer
      batch-assigns MY wallet to items paid by someone else (`isPaidByOwner`).
- [x] R-05 reconciliation verified over PERSONAL session total (calculateSessionTotal);
      composite test: own 20 + split (10→5) + other-paid (15) = personal 40; reported 50 →
      adjustment 10; debts to Ana (5+15=20) intact.
- [x] D-R4-J (DEC-123): "Quem pagou?" first-level in QuickAdd — Eu/outros; se outro:
      "Pagou tudo por mim" / "Dividimos" (split prefilled owner+payer); debt hints shown.
- New tests: payer-semantics.test.ts (8) + end-outing-session wallet protection (1).

## GATE 3 — Occasions = sessions ✅
- [x] R-06 `countProfileOccasions` (forecasting) — sessions count once, standalone = 1 each;
      `calculateOccasionForecasts` uses it → dashboard counters, Amigo Sincero (doneQuantity),
      ImpactDetail and Simulator all corrected centrally. New honest-friend kind `over_plan`
      (done > planned ≠ "dentro do plano") + copy ×3. Tests: 9+8+3 items + 2 avulsos = 5.

## GATE 4 — Simulator v3 ✅
- [x] R-07 contextual simulator (DEC-116) — new domain module
      `forecasting/contextual-simulation.ts`: `simulateContextualSpend` asks WHERE
      (profile / event / other) and returns structured FACTS + verdict WITH reason.
      Profile with plan → "consome ≈N das M ocasiões"; plan used up → over_plan;
      event → compares `reservedCents` (covers / short by €X / no reserve);
      no plan → free margin + daily allowance ("≈N dias do seu livre diário").
      SimulatorPage rewritten: amount → "Onde você vai gastar?" chips (enabled
      profiles + unconfirmed phase events + "outro") → verdict card with reason
      sentence + fact cards. Old metric_*/math_* raw-equation keys REMOVED
      (the "10 ÷ 2 ≈ 5× transporte" / "0 dias" displays are gone); 28 new
      simulator keys ×3 (parity 770 keys ✅). CTA register passes profile category.
      `simulateSpendMultiMetric` kept in domain (tested) but no longer used by UI.
- New tests: contextual-simulation.test.ts (10) — with plan (1 occasion ok /
      2.2 attention / whole-plan risk / over_plan), without plan (free + field
      scenario €20 vs €5.24/day ≈ 3.8 days), event (covers / short / no reserve),
      large values (exceeds_free wins even with plan target; large_share 60%).

## GATE 5 — Honest outing limits ✅
- [x] R-08 (DEC-117) `getOutingZone` domain function — zones change AT the target:
      under_target (success) / over_target (warning) / over_ceiling (error) /
      over_max (strong error). Status line per zone: "Você passou da meta em €X —
      isso sai de outras coisas do plano" / "€X acima do teto — comprometendo o
      orçamento da fase" / "€X acima do máximo". "Ainda pode gastar com
      tranquilidade: €0" eliminado (só aparece abaixo da meta, junto com
      "≈N bebidas cabem NA META"). "TETO SEGURO" → "TETO" ×3. Next-drink hint via
      `getNextDrinkMessageKind`: fits_target (convite só DENTRO da meta) /
      crosses_target / over_target ("aumenta o que você está tirando de outras
      coisas"). Alertas progressivos (DEC-048) re-ancorados nas zonas: 50% da
      meta / cruzou meta (warning) / cruzou teto (danger) / máximo (critical),
      ids estáveis 50/100/150/200 em firedAlertPercents; copy ×3 tons ×3 línguas.
      Dashboard: card de saída ativa usa total PESSOAL (calculateSessionTotal,
      coerência R-04) e "bebidas até a META" (era teto).
- New tests: outing.test.ts reescrito p/ zonas (6 alerts + 4 zone + 3 next-drink).

## GATE 6 — Long-press ✅
- [x] R-09 (DEC-118) multi-select in lists — new `useLongPress` hook (pointer events,
      500ms, move-cancel, synthetic-click suppression via onClickCapture) +
      `useMultiSelect` built on top. ExpenseListPage: long-press enters selection
      mode (tab "Gastos" e "Saídas"), tap toggles, `SelectionBar` fixed at bottom.
      Batch actions via new `batch-orchestrators.ts` (Dexie tx, soft delete):
      delete / move pool / change category (expenses); delete with cascade
      items+txs+shares (outings). Confirm sheets + toasts; selection cleared on
      tab change.
- [x] R-10 (DEC-119) configurable dashboard — `domain/dashboard/dashboard-cards.ts`
      catalog: 9 cards, anchors fixed (active_outing, hero), 7 movable with
      quickAction. AppSettings + `hiddenDashboardCards`/`dashboardCardOrder`
      (repo backfills old records). DashboardPage renders by resolved sequence;
      long-press on a card → sheet (quick action / hide / configure home);
      hidden cards → thin "N cards ocultos" entry. New page
      /settings/dashboard (DashboardConfigPage): reorder ↑↓ + show/hide,
      locked anchors marked. Settings entry "Personalizar" added. i18n ×3
      (selection.* + dashboard.* novos, parity ✅).
- New tests: dashboard-cards.test.ts (9) + batch-orchestrators.test.ts (4).

## GATE 7 — PWA outing notification ✅
- [x] R-11 (DEC-120) research VERIFIED 2026-06-11 (MDN + WHATWG + web.dev) →
      `brain/documents/pwa-notification-research.md`: actions/tag/renotify/
      requireInteraction OK em Android; ongoing real (Spotify-like) e
      media-style NÃO existem em PWA → registrado como item Capacitor
      (DEC-017). Implementado o viável: notificação persistente tag fixa
      (requireInteraction, updates silenciosos a cada gasto) com ações
      +€X/+€Y (2 primeiros quick values) e "Abrir app". App constrói payload
      completo (i18n, valores, follow-up subcategorias por proximidade
      DEC-095, deviceId) no data — SW sem i18n só o replê. Clique: SW delega
      a janela aberta (postMessage → quickAddSessionExpense, fluxo de domínio
      completo) ou grava direto no IDB (shape replicado). Follow-up "O que
      foi esse gasto?" com 2 subcategorias + abrir; clique grava
      subcategoryId. Permissão pedida no 1º início de sessão com sheet
      explicativo (localStorage, nunca no boot); encerrar limpa as 2 tags.
      Novos: domain/outing/outing-notification.ts (payload puro),
      orchestrators quickAddSessionExpense/assignTransactionSubcategory,
      utils/outing-notification.ts (bridge), sw.js v6 (notificationclick +
      fallback IDB). i18n ×3 (9 chaves outing.notification_*).
- New tests: outing-notification.test.ts (8) + quick-add-session-expense.test.ts (4).

## GATE 8 — Help mode ✅
- [x] R-12 (DEC-121) registry data-driven `domain/help/help-content.ts`:
      6 telas V1 (funds 6 tópicos / planner 5 / wallets 5 / phase_edit 4 /
      outing 6 / backup 4), cada tópico {id, anchorId} → chaves
      `help.<tela>.<id>_title/_body`. UI `components/HelpMode.tsx`:
      HelpButton "?" no header → overlay escurecido sobre a tela REAL,
      tópico a tópico (anterior/próximo/contador), scrollIntoView +
      anel de destaque no elemento real via `data-help-anchor` (spread
      shadow recorta o "buraco" no dim); sem âncora → só o card. Âncoras
      plantadas nas 6 telas (pool list, add fund, free margin, categorias,
      wallets list, fases, gauge, quick-add, itens, encerrar, export,
      import). Copy com exemplos CONCRETOS de viagem ("€300 reservados
      para Lisboa", "€700 em 10 dias = €70/dia", "esperava €87, contou
      €80 → ajuste €7") ×3 línguas (66 chaves novas; paridade 886 ✅).
- New tests: help-content.test.ts (6) — telas obrigatórias, intro 'what'
      primeiro, ids únicos, title/body resolvem nas 3 línguas, bodies >40
      chars e fundos com exemplo concreto.

## GATE 9 — Brain + final verification + deploy ✅
- [x] Brain updated: decision-log (DEC-114..123, Gate 0), product-spec §26
      (field review R4 completo com a tabela da verdade), project-status
      (sessão R4 field review, contagens 123 dec / 409 unit / 886 keys / v0.7.0)
- [x] Version bump minor → 0.7.0 (package.json + app-version.ts)
- [x] Full validation: typecheck ✅ · 409 unit ✅ · build ✅ · 29 e2e ✅
- [x] R-01..R-12 "DONE quando" confirmados NO CÓDIGO (greps dirigidos:
      scroll-pl/snap-always/hyphens-auto/resolvePayerExpense/
      countProfileOccasions+over_plan/simulateContextualSpend/getOutingZone/
      useMultiSelect+SelectionBar/resolveDashboardCardSequence/
      notificationclick+research doc/HelpButton ×6 telas)
- [x] 6 smokes do review rastreados a testes concretos:
      a) payer-semantics:159 (€20+€15 Ana → €35 + dívida) ✅
      b) forecasting:190 (9+8+3 itens + 2 avulsos = 5 ocasiões) ✅
      c) contextual-simulation (fits_plan/consume N/over_plan explicados) ✅
      d) outing:74/107 (cruzar meta muda zona e alerta na hora) ✅
      e) R-01/R-02 confirmados no código (scroll-pl + snap-always) ✅
      f) DashboardConfigPage persiste em AppSettings (update no DB) ✅
- [x] i18n paridade 886 ×3 ✅ · 0 native dialogs ✅
- [x] Deploy Cloudflare Pages ✅ — https://trippilot.pages.dev
      (deployment https://771063b5.trippilot.pages.dev, alias master)

## POST-R4 — Field feedback on v0.7.0 (same day, → v0.7.1) ✅

Feedback do Julio em campo sobre R-09/R-11/R-12:

- [x] R-09 fix: SelectionBar aparecia ATRÁS do bottom nav nos Gastos.
      Causa raiz: z-40 empatado com o nav (nav vence por ordem no DOM) +
      risco de stacking context. Fix: `createPortal(document.body)` +
      z-[45] (cobre o nav, abaixo dos sheets z-50) + min-h cobrindo o FAB.
- [x] R-12 fix: overlay de ajuda ficava atrás do menu inferior em telas
      com `.page-sticky-header` (sticky + z-30 cria stacking context que
      PRENDE o overlay interno; nav z-40 pintava por cima). Fix: portal
      para <body> + z-[80] + card AGORA DRAGGABLE (alça + pointer events,
      clamp na viewport) para nunca esconder o elemento destacado (DEC-125).
- [x] R-11 v2 (DEC-124): notificação reescrita single-path —
      clique de ação SEMPRE grava no IDB pelo SW e re-renderiza a própria
      notificação de estado fresco + broadcast OUTING_DATA_CHANGED (v1
      delegava à janela aberta; Android congela tabs em background e o
      postMessage só chegava no refocus → notificação travada em €0 e
      gasto "atrasado"). "Abrir" corrigido para /outings/active (rota
      /outing NÃO existia). Toggle em Configurações
      (AppSettings.outingNotificationEnabled + status bloqueado/não
      suportado) + banner "Ativar notificação" na saída ativa enquanto a
      permissão faltar + re-sync no boot e no visibilitychange. Corpo
      rico: total vs meta, restante/acima e "≈N bebidas até a meta"
      (templates embedados no data, SW re-renderiza; espelho documentado
      buildOutingNotificationBody ↔ buildOutingBodySw). sw.js → v7.
- [x] i18n +12 chaves ×3 (898 ✅) · 414 unit ✅ · 29 e2e ✅ · build ✅ · tsc ✅
- [x] Brain: DEC-124 + DEC-125 no decision-log; project-status atualizado
- [x] Version bump patch → 0.7.1 + deploy

## Extras found (not fixed)

- (none yet)
