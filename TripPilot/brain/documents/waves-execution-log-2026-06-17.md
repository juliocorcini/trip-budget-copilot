# Waves Execution Log — Master Fix & Skipped-Features Plan (2026-06-17)

> **O que é este arquivo:** o diário de execução **vivo** das Ondas 1→5 do plano
> `master-fix-and-skipped-features-plan-2026-06-17.md`. Registra, por onda/gate: o que foi
> implementado, testes, build, deploy, verificação, **problemas encontrados**, **itens pulados
> e por quê**, e **desvios do padrão e por quê**. É o arquivo que o Julio deve abrir ao voltar.

## Ambiente verificado (baseline 2026-06-17)
- **Node:** ambiente padrão é 18.17.0, mas testes exigem **Node 22** (`crypto.subtle`). Uso
  `~/.nvm/versions/node/v22.22.3/bin` no PATH para todo test/build/deploy. **[DESVIO MENOR]**
  documentado: sempre rodar com Node 22.
- **Baseline de testes:** **1147 testes / 128 arquivos — TODOS verdes** (Node 22). tsc 0.
- **Playwright:** 1.60.0, chromium instalado, device Pixel 5, webServer `npm run dev` @5173.
- **Deploy:** wrangler 4.98.0 autenticado (OAuth, `pages write` + `workers write` + `kv write`).
  Projeto Pages = **`trippilot`** (apex `trippilot.pages.dev`). Deploy:
  `npx wrangler pages deploy dist --project-name=trippilot --branch=master`.
  Worker = `trippilot-sync` (`worker/wrangler.jsonc`).
- **Apex atual no início:** 0.64.0 (version.json + APK 200 OK).

## Princípio de execução (do pedido do Julio)
- Implementar **sem parar** até a Onda 5; testes perto do que mexo; **gate** = suíte completa +
  build + E2E + deploy + verificação; só avança com tudo verde. UI = Playwright + screenshot,
  iterar até a tela ficar boa. APK só quando mexe em nativo. Salvar problemas/skips/desvios aqui.

---

## Estado atual (atualizar a cada milestone)
- **Onda ativa:** **Onda 5 CONCLUÍDA + DEPLOYADA (0.70.0)** — fim do plano (Ondas 1→5 entregues). B15 (E2E no CI) + B13 (orquestrador atômico de fundo). B4/B11/B14/B16 fora por decisão/design.
- **Última versão deployada (web/OTA):** **0.70.0** (apex `trippilot.pages.dev` verificado: version.json 0.70.0 `no-store`+CORS, bundle 0.70.0.zip 200, **`/.well-known/assetlinks.json` agora JSON real** (`application/json`), `/trippilot.apk` preservado byte-idêntico no shell verificado 0.56.0 = 8.283.527 B, `/pair` + `/s/:id` SPA 200). Deployment `https://b4cf08d1.trippilot.pages.dev`.
- **APK:** **0.56.0 vivo** servido em `/trippilot.apk` (republicado byte-idêntico). O APK **0.69.0** do lote nativo (Onda 4) segue **NÃO promovido** em `android/app/build/outputs/apk/debug/app-debug.apk`, aguardando sessão de device. `latestNativeVersion` 0.56.0 / `requiredNativeVersion` 0.50.0.
- **Testes:** **1224/1224** verdes (136 arquivos, Node 22) — +3 orquestrador de fundo. tsc 0. **E2E 33/33**.
- **Build:** verde (vite OK; bundle 0.70.0.zip 683 KB).
- **CI:** novo `.github/workflows/ci.yml` (unit+build e e2e em Node 22; YAML validado).
- **Riscos abertos:** App Links — verificar em device se o `#fragment` sobrevive (fallback honesto já documentado em DEC-215). Lote nativo (B1/B2/B3) aguarda device para promoção do APK.
- **Escopo:** dentro do plano. Plano 100% executado até onde é possível sem aparelho físico.

---

## Problemas encontrados (consolidado)
- **Onda 4:** aviso de API depreciada `Intent.getParcelableExtra(String)` (depreciada na API 33) no
  `ShareTargetPlugin.java` — **resolvido** trocando por `IntentCompat.getParcelableExtra(intent, name, Uri.class)`
  (androidx.core 1.17). `assembleDebug` recompilou sem aviso. Nenhum problema bloqueante.

## Itens pulados / fora de escopo nesta execução
- **B4** (S9/v1.1 shared link) — congelado por decisão do Julio (2026-06-17). Onda 5 não o inclui.
- **B5 push app-fechado/FCM** — fora por decisão (sideload-first). Onda 2-A faz só o nudge de share.
- **B11** (P2P V2) e **B16** (close-on-background) — deferidos por design.
- **B14** (SW por plugin) — só com bateria de testes de update + device; condicional na Onda 5.
- **B18** (validação em device) e partes nativas que exigem aparelho físico — sem device aqui.
- **Onda 4 — ACs `[device]` de B1/B2/B3 adiados** (sem Android físico): (a) compartilhar um CSV do Wise/Files →
  abrir o preview; (b) abrir `…/pair` e `…/s/:id#k=` no app e cair na tela certa **com o fragment preservado**;
  (c) prompt de permissão de localização nativo. Código 100% pronto + gate de CI verde; falta só o aparelho.
- **Onda 4 — assetlinks de release** pendente: anexar a SHA-256 do keystore de release ao `assetlinks.json`
  quando houver build assinado (ambiente sem `keystore.properties`; só a SHA debug entrou agora).

## Desvios do padrão (consolidado)
- Uso de Node 22 via nvm (ver acima).
- **Onda 4 NÃO fez deploy web nem promoveu o APK** (desvio consciente do "deploy a cada gate"): os ACs são
  `[device]` e não há aparelho nesta sessão. Promover App Links/APK não verificados arriscaria o bug "abre e não
  navega" e empurraria casca não testada. `version.json`/`latestNativeVersion`/`requiredNativeVersion` ficam
  inalterados; o APK 0.69.0 aguarda a sessão de device. O `assetlinks.json` (web-safe) sobe junto com o deploy da
  Onda 5. Aderente ao gate da Onda 4 no plano (`cap sync` + `assembleDebug` verde + ACs `[device]`).

---

## Log por Onda

### Onda 1 — Quick wins (B17, B9, B12, B7) — ✅ CONCLUÍDA + DEPLOYADA (0.65.0)

**B17 — Planner empty state.** `PlannerPage.tsx` agora renderiza `EmptyState` (ícone, título,
corpo, CTA → `/trip`) quando `!loading && trip && phases.length === 0`. Antes podia ficar preso em
loading. i18n: `planner.no_phases_title/body/cta` (pt/en/es). Visual QA: `shot-b17-planner.png` OK.

**B9 — Vincular gasto já registrado a uma compra planejada.** Orquestrador
`linkExistingExpenseToPlannedPurchase` (+ `undoLinkExistingExpense`) em
`planned-purchase-orchestrators.ts`, reaproveitando `linkTransactionToPlannedPurchase` e persistindo.
UI em `PlannedPurchasesPage.tsx`: botão "Vincular gasto existente" + `BottomSheet` com candidatos
(mesma categoria, não já vinculados), com toast de undo. Sem criar gasto novo. i18n:
`planned.link_existing/link_sheet_title/link_sheet_hint/link_empty/linked_toast`.
Testes novos: `planned-purchase-link.test.ts` (vínculo, auto-close, undo). Visual QA:
`shot-b9-button.png` + `shot-b9-sheet.png` OK.

**B12 — Simulador R7: peso por orçamento monetário de categoria.** `contextual-simulation.ts`
ganhou `categorySpentCents` em `SimulationProfileContext`, novo fato/razão `category_over_budget`,
e `weightProfileByCategoryBudget` (escalonamento monotônico de tom quando o dinheiro da categoria
estoura o plano, mesmo com ocasiões restantes). `SimulatorPage.tsx` calcula `categorySpentCents`
por chip e formata o novo fato/veredito. i18n: `simulator.fact_category_over_budget` +
`reason_category_over_budget`. Testes ampliados em `contextual-simulation.test.ts` (fixtures +
casos de "category money-plan weighting"). Visual QA: `shot-b12-sim.png` OK.

**B7 — Piso automático de fase futura como sugestão.** Função pura `calculateRecommendedFloor` em
`budget.ts` (tiers Essencial/Recomendado/Confortável dividindo o fundo do pool entre fases pelos
dias efetivos de gasto — usa `calculateEffectiveSpendingDays`). `FundsPage.tsx` mostra os chips de
sugestão no editor de piso futuro (mapa `phaseById`, `poolLinkedPhases`, `floorTiers`). i18n:
`funds.floor_suggest_label` + `floor_tier_essential/recommended/comfortable`. Testes novos:
`recommended-floor.test.ts` (split por dias + tiers). Visual QA: `shot-b7-funds.png` OK.

**GATE Onda 1:** suíte completa **1161/1161 verde**, `tsc` 0, build verde. E2E visual (Playwright,
Pixel 5) capturou os 4 screenshots — todos bons (sem nova iteração necessária). Versão **0.65.0**
(app-version, package.json, version.json, release-notes pt/en/es). Bundle OTA `0.65.0.zip` (674 KB)
+ APK republicado (shell 0.56.0, sem mudança nativa → sem novo APK). Deploy
`wrangler pages deploy dist --branch=master` → **apex verificado 0.65.0** (version.json + bundle +
apk 200). **Problemas:** nenhum bloqueante (1 ajuste de seletor Playwright por causa de ligature de
ícone Material Symbols — resolvido com regex `/Bar$/`). **Skips:** nenhum nesta onda.

### Onda 2-A — Nudge de compartilhar link da divisão (B5) — ✅ CONCLUÍDA + DEPLOYADA (0.66.0)

**B5 (decisão sideload-first, SEM FCM).** Depois de uma divisão, o app oferece um **nudge** para
mandar a cada pessoa o link `/s` da parte dela (reusa toda a infra de shared link). Implementação:
- **Helper puro** `collectSplitNotifyTargets(shares, participants, ownerId)` em `domain/splitting`
  → participantes não-owner com fatia > 0 (dedupe, ignora soft-deleted, preserva ordem). 8 testes
  novos (`split-share.test.ts`).
- **`SplitShareNudgeSheet`** (novo, `features/shared/`) — BottomSheet reutilizável que lista os
  devedores; "Compartilhar com {nome}" navega para `/shared` com `state.shareWithParticipantId`.
- **`QuickAddPage`** — `persistExpense` agora devolve `{ transaction, shares }`; após salvar uma
  divisão não-transporte, abre o nudge (espelha o padrão do round-trip de transporte). Undo do toast
  continua funcionando junto.
- **`SharedExpensesPage`** — lê o `state` de navegação e abre o `ShareLinkSheet` da pessoa (onde já
  existe gerar/copiar/compartilhar com **mensagem pronta** `shareLink.message`); limpa o state com
  `replace` (não reabre). Reuso total — o nudge é só o gatilho.
- **i18n** `shareLink.nudge_title/nudge_body/nudge_share_with/nudge_later` (pt/en/es).

**GATE Onda 2-A:** suíte **1169/1169 verde** (+8), `tsc` 0, build verde. E2E visual (Playwright,
Pixel 5): divisão real no Quick Add (Julio+Ana) → nudge "Avise quem entrou na divisão" +
"Compartilhar com Ana" (`shot-b5-nudge.png`) → toque → rota `/shared` abre o share sheet da Ana com
"Gerar link" (`shot-b5-sharesheet.png`). Ambos bons. Versão **0.66.0**, bundle `0.66.0.zip` (675 KB),
APK preservado (sem mudança nativa). Deploy `--branch=master` → **apex verificado 0.66.0**
(version.json com `no-store`, bundle + apk 200). **Problemas:** nenhum. **Skips/desvios:** o nudge foi
ligado ao **fluxo primário** (Quick Add). Outing/Receipt **não** ganharam o gatilho nesta onda
(decisão de escopo: B5 é "barato"; o componente já é reutilizável e a infra `/s` está acessível de
qualquer lugar — adoção em Outing/Receipt fica como follow-up de baixo custo). Registrado aqui por
transparência (pedido do Julio: salvar skips/desvios).

### Onda 2-B — Tipo de transação `income` (B8) — ✅ CONCLUÍDA + DEPLOYADA (0.67.0)

**B8 (DEC-212) — entrada de dinheiro REAL no meio da viagem.** Estratégia **invariância primeiro**:
`income` é um quinto `TransactionType` puramente **aditivo** — com zero entradas, todo número a
jusante é **idêntico** ao de antes. Implementação do núcleo para fora:
- **Domínio (puro).** `common.ts`: `TransactionType += 'income'`. `budget.ts`: `calculatePoolIncome`
  (soma só `income`, em base currency) + threading em `calculateFreeToSpend` (`totalBudgetCents +
  totalIncomeCents − …`), `buildFreeToSpendBreakdown` (linha `income` `kind:'add'`, **omitida** se 0),
  `calculatePoolRemaining` e `createPoolSummary` (total efetivo + %used income-aware). `wallets.ts`:
  `calculateWalletBalance` credita `income` na carteira de destino. `transactions.ts`:
  `createIncomeTransaction` (personalCost null, category null, `excludeFromLearning: true`).
  `schemas.ts`: enum +`income`. `orchestrators`: `registerIncome` (sem shares).
- **`calculatePoolSpent` intocado** (segue só expense+adjustment) → income **nunca** é "gasto".
  `profile-learning` já filtrava expense → income **não** entra no aprendizado.
- **UI dedicada** `features/income/IncomePage.tsx` (rota `/income`, FAB → "Registrar entrada",
  `advanced`) — **NÃO** mexe no `QuickAddPage` (zero risco no fluxo crítico). Reusa
  `getAvailablePoolsForPhase` (seletor de fundo) + seletor de carteira. Moeda = base (V1).
- **Recentes** (`DashboardCards`): income aparece em **verde com `+` e ícone `savings`** (distinto
  de gasto). **Breakdown do FTS** mostra "Entradas recebidas" em verde aditivo.
- **i18n** `income.*` + `fab.register_income(_desc)` + `dashboard.fts_income` (pt/en/es).
- **Testes** `income.test.ts` (18 casos): `calculatePoolIncome`, invariância FTS (zero income =
  bit-idêntico), income cresce FTS, resgata fase estourada, breakdown (linha some/aparece),
  pool remaining/summary, carteira creditada, factory. Fixtures antigas `fts-breakdown`/`true-free`
  ganharam `totalIncomeCents: 0` (campo novo obrigatório no `FreeToSpendResult`).

**GATE Onda 2-B:** suíte completa **1187/1187 verde** (+18), `tsc` 0, build verde. **E2E visual**
(Playwright, Pixel 5): `/income` → preencher € 250 "Reembolso do hotel" → Salvar → toast "Entrada de
€ 250,00 registrada" → abrir "De onde vem esse número" mostra **"Entradas recebidas + € 250,00"**
(verde) e **reconcilia**: 1500 + 250 − 101,80 − 150 − 200 = **1.298,20** ✓; recentes mostram a
entrada em verde com ícone savings. 3 screenshots, todos bons (`shot-b8-income-empty/filled/breakdown-income`).
Versão **0.67.0** (app-version, package.json, version.json, release-notes pt/en/es; DEC-212 no
decision-log). Bundle `0.67.0.zip` (678 KB) + APK republicado (shell 0.56.0, sem mudança nativa).
Deploy `--branch=master` → **apex verificado 0.67.0** (version.json `no-store`+CORS, bundle 200, APK
200, `/income` SPA 200). Deployment `https://c1e8a613.trippilot.pages.dev`. **Problemas:** nenhum.
**Skips/desvios:** (1) income em **moeda base** apenas — o factory/domínio já aceitam
`baseCurrencyAmountCents` para entrada em moeda estrangeira, mas a página V1 coleta só base
(limitação documentada, follow-up barato). (2) `ExpenseDetailPage` vê/edita/exclui income de forma
**genérica** (sem UI específica de tipo — consistente com como transfer/adjustment já se comportam lá).

---

## Onda 3 — Copiloto v3 (B10) + biometria (B6) — v0.68.0 [CONCLUÍDA, OTA]
**Data:** 2026-06-17 · **DEC-213 (B6) + DEC-214 (B10)** no decision-log.

### B10 — quatro leituras data-gated do Copiloto
Funções **puras e auto-censuráveis** em `domain/copilot/copilot-insights.ts`, ligadas ao `CopilotPage`
como memos que só renderizam quando retornam não-nulo:
- **`summarizeHomeCurrencyTotal`** — âncora "No total" (viagem inteira na moeda de casa) + contagem de gastos.
- **`summarizePaymentMix`** — dinheiro × cartão (cartão = débito/crédito/digital; `other`/sem carteira = "untracked"); só aparece com **ambos** os lados.
- **`summarizePeakHour`** — hora local com mais gasto (≥3 gastos para virar padrão).
- **`summarizeDisciplineStreak`** — dias seguidos no/abaixo do ritmo diário da fase (alvo>0 e corrida ≥2).
Todas ignoram deletados/não-`expense` e usam `transactionBasePersonalCostCents`. i18n pt/en/es
(âncora, hora de pico, mix, streak). **Testes:** +16 casos em `copilot-insights.test.ts` (total **42**) —
matemática, empates, gasto exatamente no alvo, exclusão de deletado/transfer/settlement, limiares de censura.

### B6 — biometria como camada sobre o PIN (web/PWA, WebAuthn)
Boundary novo `utils/biometric-unlock.ts` sobre `navigator.credentials` (platform authenticator, UV
required). Settings → "Bloqueio do app" ganha o toggle **"Desbloquear com biometria"** (só quando
`isUserVerifyingPlatformAuthenticatorAvailable()` e já existe PIN); ativar **registra** um credential
local e guarda só o id (base64url). A `LockScreen` oferece atalho biométrico (auto-prompt 1×+botão) e o
**PIN continua sempre disponível como fallback**. Sem servidor → não verifica a assinatura; o valor é a
cerimônia de user-verification do dispositivo. Campos novos `appLockBiometricEnabled` /
`appLockBiometricCredentialId` (não-indexados, default off/null, backfill no repo + seed; fixtures de
backup atualizadas). **ÂNCORA 12:** biometria só liga com PIN; desligar o PIN limpa a biometria; falha/cancel/
device sem suporte cai no PIN; credential é local ao aparelho (inútil após restore noutro device → PIN assume).
**Testes:** `biometric-unlock.test.ts` (round-trip base64url + gate `isBiometricUnlockReady`).

**GATE Onda 3:** suíte completa **1208/1208 verde** (133 arquivos; +16 copilot, +7 biometria), `tsc` 0,
build verde. **E2E visual** (Playwright, Pixel 5): (a) `/copiloto` em dados demo renderiza as 4 leituras
(âncora € 105,30 / hora de pico 19h / sequência de disciplina / dinheiro × cartão) — screenshot bom; (b)
**fluxo biométrico completo com autenticador virtual CDP** — ativar PIN+biometria em Settings → reload →
**biometria FORÇADA a falhar → PIN ainda desbloqueia (ÂNCORA 12 provada)** → depois biometria OK →
auto-unlock. 3 screenshots revisados (copilot, settings-lock, lockscreen com "Usar biometria"), todos bons.
Versão **0.68.0** (app-version, package.json, version.json, release-notes pt/en/es). Bundle `0.68.0.zip`
(682 KB, 110 arquivos) + APK republicado (shell 0.56.0, sem mudança nativa). Deploy `--branch=master` →
**apex verificado 0.68.0** (version.json `no-store`+CORS, bundle 200, APK 200, `/copiloto` SPA 200).
Deployment `https://3211b200.trippilot.pages.dev`. **Problemas:** nenhum.
**Skips/desvios:** (1) **biometria nativa (plugin Capacitor) adiada para a Onda 4** (lote nativo) — esta
onda é web/OTA, então só a camada WebAuthn entrou; o plano já separa web/OTA × nativo por onda, então é
aderente ao padrão. (2) QA visual da UI biométrica feito com **autenticador virtual** (CDP WebAuthn) porque
o Chromium headless não expõe biometria real — a verificação em **device físico** fica no backlog de
verificação (B18, Onda 4).

---

## Onda 4 — Lote nativo (B1+B2+B3) — APK 0.69.0 [CÓDIGO-COMPLETO, GATE CI VERDE, DEVICE-PENDENTE]
**Data:** 2026-06-17 · **DEC-215** no decision-log. **Não houve deploy web nem promoção de APK** (justificativa abaixo).

### B1 — receber `.csv` compartilhado (Wise/Files → TripPilot)
- **Nativo:** `ShareTargetPlugin.java` (`@CapacitorPlugin("ShareTarget")`) lê o CSV do intent de
  launch/`onNewIntent` — ACTION_SEND (`EXTRA_STREAM` via `IntentCompat.getParcelableExtra`, ou
  `EXTRA_TEXT`) e ACTION_VIEW (`content://`/`file://`, só esquemas locais) — e guarda num buffer estático
  (a intent de cold-start é lida em `MainActivity.onCreate`, antes do bridge JS carregar o plugin).
  `MainActivity` registra o plugin + processa a intent no `onCreate`/`onNewIntent`.
- **Manifest:** intent-filters SEND para `text/csv` / `text/comma-separated-values` / `application/csv`
  (só MIME de CSV → **não** sequestra share de texto genérico) + VIEW `content`/`file` para "Abrir com".
- **Web boundary:** `utils/native/share-target.ts` mantém o CSV **em memória** (não na URL — statement é
  grande demais), expõe `hasPending/takePending/setNavHandler/deliverSharedCsv/initShareTarget` (registrado
  em `initNativeShell`). `RootLayout` (`useNativeIntents`) leva o usuário a `/import/wise?shared=1`;
  `WiseImportPage` drena o CSV pelo **mesmo caminho puro `parseWiseCsv`** do upload manual (refatorei o
  `handleFiles` num único `ingestCsvTexts` reutilizável — DRY).
- **Anti-regressão:** Web Share Target do PWA (DEC-161, `/quick-add`) intacto; tudo guardado por `isNativeApp()`.

### B2 — App Links `/pair` + `/s/:id`
- **`public/.well-known/assetlinks.json`** com a SHA-256 do **keystore debug** (`C9:D3:…:AC`) — vai ao ar no
  apex no próximo deploy web (Onda 5), antes da verificação em device.
- **Manifest:** `<intent-filter android:autoVerify="true">` para `https://trippilot.pages.dev/pair` e `/s/*`.
- **`utils/native/deep-link.ts`:** `parseDeepLink` (puro, testado) só aceita nosso host + prefixos `/pair`/`/s/`,
  e **preserva o `#fragment`** (onde vivem a chave `#k=` do `/s/:id` e a identidade do `/pair`); `initDeepLinks`
  trata o launch URL (cold) e o `appUrlOpen` (warm) e navega. Ligado no `RootLayout` (native-only).
- **Risco a verificar em device:** se o Android **descartar o fragment**, fallback honesto = App Links só para
  `/pair` e manter QR/scan para `/s/:id` (a chave nunca pode ir para query). Já documentado (plano + DEC-215).

### B3 — grant de GPS nativo
- **Já estava completo no código:** `ensureLocationPermission()` (`utils/geolocation.ts`) faz
  `checkPermissions`/`requestPermissions` via `@capacitor/geolocation`; `SettingsPage` chama antes de capturar;
  manifest já declara `ACCESS_FINE/COARSE_LOCATION`. **Sem mudança de código** — só falta o prompt em device.

**GATE Onda 4:** `tsc` 0 · suíte completa **1221/1221 verde** (135 arquivos; +9 `deep-link` +4 `share-target`) ·
**E2E 33/33** (guarda de regressão das edições compartilhadas em `RootLayout`/`WiseImportPage`) · `npm run build`
OK (assetlinks presente em `dist/.well-known/`) · `cap sync` OK (8 plugins) · `assembleDebug` **OK, 8.35 MB**,
versionCode **22** / 0.69.0. **Problemas:** 1 aviso de API depreciada (`getParcelableExtra`) — resolvido com
`IntentCompat` (androidx.core 1.17). **Por que NÃO promovi:** os ACs de B1/B2/B3 são `[device]` e não há Android
físico nesta sessão; shippar App Links sem device é exatamente o bug "abre e não navega" que o plano evita, e um
APK não verificado em `apkUrl` empurraria casca não testada. Então **não fiz deploy web** (preserva a higiene do
bundle OTA 0.68.0) e **não promovi o APK**: `version.json` segue 0.68.0 / `latestNativeVersion` 0.56.0 /
`requiredNativeVersion` 0.50.0. O APK construído espera em `android/app/build/outputs/apk/debug/app-debug.apk`
para a sessão de device (que também valida o backlog B18). **Pendência registrada:** anexar a SHA-256 do keystore
de **release** ao `assetlinks.json` quando houver build assinado (o array aceita múltiplas; este ambiente não tem
`keystore.properties`).

---

## Onda 5 — Tech-debt seguro (B15 + B13) — v0.70.0 [CONCLUÍDA + DEPLOYADA]
**Data:** 2026-06-17 · **DEC-216** no decision-log. **B4 fora** (link congelado); **B14/B11/B16** deferidos por design.

### B15 — E2E (Playwright) no CI
Antes o E2E só rodava local (DEC-054). Novo `.github/workflows/ci.yml` (na raiz do repo; o app vive em `TripPilot/`,
então `defaults.run.working-directory: TripPilot`), com dois jobs em push/PR:
- **unit** — Node 22, `npm ci` → `npm run typecheck` → `npm run test` → `npm run build`.
- **e2e** — `npx playwright install --with-deps chromium` → `npm run test:e2e`, com upload do `playwright-report/` como artefato.
Node 22 porque a suíte usa Web Crypto. O `playwright.config.ts` já sobe o dev server sozinho e ajusta retries/workers
quando `CI=true` (sem mudança de config). `.gitignore` ganhou `playwright-report/`, `test-results/`, `blob-report/`.
YAML validado (parse OK, 2 jobs, 6 steps cada).

### B13 — Orquestrador atômico de criação de fundo (DEC-067, oportunístico)
A `FundsPage.handleSave` criava o pool e depois os links de fase em chamadas **separadas** ao repositório — uma falha no
meio podia deixar pool órfão ou links parciais. Extraí **`createBudgetPoolWithPhaseLinks`** para `crud-orchestrators.ts`
(simétrico ao `deleteBudgetPool` já existente): monta pool + links pelas factories de domínio e persiste numa **única
transação Dexie `rw`** (`global` ignora links; `linked_phases` normaliza piso `<= 0`/null → null). A `FundsPage` agora chama
o orquestrador e deixou de importar as factories. **Comportamento idêntico** — 3 testes novos travam o contrato
(`budget-pool-create-orchestrator.test.ts`). O resto da dívida DEC-067 (páginas com escrita de tabela única / updates de
settings — baixo risco de atomicidade) fica como follow-up oportunístico documentado; **não** fiz refactor varrendo tudo
(fora de escopo + risco de regressão).

**GATE Onda 5:** `tsc` 0 · suíte completa **1224/1224 verde** (136 arquivos; +3 orquestrador) · `npm run build` OK ·
**E2E 33/33** (guarda de regressão do refactor da `FundsPage`). Versão **0.70.0** (app-version, package.json, version.json,
release-notes pt/en/es — nota honesta de estabilidade; **0.69.0 reservado ao APK nativo device-pendente**). Bundle
`0.70.0.zip` (683 KB, 111 arquivos). **APK preservado byte-idêntico:** o script `make-ota-bundle` copia o último APK do
build output (que agora é o 0.69.0 não verificado), então **movi o 0.69.0 de lado**, gerei o bundle, **rebaixei o
`/trippilot.apk` para o 0.56.0 vivo** (re-baixado do apex, 8.283.527 B) e devolvi o 0.69.0 ao lugar — garantindo que o
APK não verificado **não** foi promovido. Deploy `--branch=master` → **apex verificado 0.70.0** (version.json, bundle 200,
`assetlinks.json` agora **JSON real** `application/json`, `/trippilot.apk` 200 = 0.56.0, `/pair` + `/s/test` SPA 200).
Deployment `https://b4cf08d1.trippilot.pages.dev`. **Problemas:** nenhum. **Desvios:** o `assetlinks.json` (criado na Onda 4)
foi ao ar **agora** junto com este deploy web (Onda 4 não fez deploy) — antes dele o caminho devolvia o fallback HTML do SPA,
então App Links jamais verificariam; agora serve JSON correto, pronto para a sessão de device.

---

## Conclusão da execução (Ondas 1→5)
Plano `master-fix-and-skipped-features-plan-2026-06-17.md` **executado de ponta a ponta** até o limite do que é possível sem
aparelho físico. Entregue e deployado (web/OTA, apex `master`): **Onda 1** (B17/B9/B12/B7 → 0.65.0), **Onda 2-A** (B5 → 0.66.0),
**Onda 2-B** (B8 `income` → 0.67.0), **Onda 3** (B10/B6 → 0.68.0), **Onda 5** (B15/B13 → 0.70.0). **Onda 4** (B1/B2/B3) está
**código-completo, com gate de CI verde e APK 0.69.0 construído**, aguardando **uma sessão de device** para validar os ACs `[device]`
e promover o APK. Itens fora por decisão/design: **B4** (link congelado), **B5-push/FCM** (sideload-first), **B11** (P2P V2),
**B14** (SW por plugin — condicional, alto risco), **B16** (close-on-background). Estado final dos testes: **1224 unit / 136 arquivos**,
tsc 0, **E2E 33/33**. Ver o relatório de problemas/pendências em `brain/documents/waves-final-report-2026-06-17.md`.
