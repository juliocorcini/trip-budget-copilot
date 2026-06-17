# Master Fix Plan — Força-Tarefa dos Bugs de Device (2026-06-17)

> **O que é este arquivo:** o **plano mestre de correção** dos achados da sessão de teste em
> celular (v0.50→v0.70) do Julio. É a continuação direta do
> `master-fix-and-skipped-features-plan-2026-06-17.md` (cujas Ondas 0–5 já foram entregues): agora
> que as features estão no ar, o **B18 (verificação em device)** rodou e revelou regressões, bugs e
> problemas de clareza. Evidência crua em `device-test-results-2026-06-17.md`.
>
> **Versão de partida:** **web/OTA 0.70.0** (apex `trippilot.pages.dev`) + **APK 0.69.0 debug**
> (nativo construído, ainda **não promovido**). Qualidade atual: **1224 testes / 136 arquivos**,
> tsc 0, E2E 33/33, maior chunk vendor-react 290 KB.
>
> **Conselho:** rodado **inline** (4 lentes — Estrategista / Arquiteto / Crítico / Advogado do
> usuário), `tech-lead-delegation.mdc` (sem subagents).
>
> **Política de verificação (fact-verification.mdc):** **[VERIFICADO]** = li o código e confirmei a
> causa-raiz · **[A VERIFICAR]** = precisa repro/screenshot em device · **[DECISÃO]** = escolha do
> Julio (resolvida inline por conselho com default pragmático).

---

## NÃO-NEGOCIÁVEIS (reler a cada gate)

1. **ZERO regressão** — nada some, só muda de lugar/forma (ÂNCORA 9).
2. **meta/cofrinho/renda-futura read-only** nunca entram no free-to-spend (ÂNCORA 11).
3. **check-in nunca grava** (ÂNCORA 12a); **biometria/PIN nunca prende o usuário** — PIN sempre é
   fallback, DB vazio nunca trava (ÂNCORA 12b).
4. **transferência entre pools conserva o total** (ÂNCORA 13); **GPS bruto 100% local** (ÂNCORA 8).
5. **nunca bloquear registro** (ÂNCORA 10); campos não-indexados não exigem migração (ÂNCORA 14/18).
6. **i18n pt/en/es** para toda string nova; **tsc 0**; **nenhum chunk > 500 KB**.
7. **Deploy produção `--branch=master`** (apex); **APK só quando mexe em nativo** (e nunca promover
   App Links/APK não verificados em device).
8. **Invariância do `income`** (Onda 2-B já entrega): com zero entradas, todo número é bit-idêntico.
   Qualquer mexida em lista/import que toque `income` mantém essa invariância.

---

## 0. Sumário executivo

A sessão de device confirmou que o app está **rico e majoritariamente funcional** — os fluxos
nativos mais arriscados passaram (notificação da saída com app fechado, CSV nativo cold/warm, import
inteligente, escanear nota). Sobraram **20 bugs**, **7 melhorias** e **5 decisões**, concentrados em:

1. **Um bug crítico que cascateia (D-BUG-01):** o link de divisão/pareamento é montado com
   `window.location.origin`, que **no WebView nativo é `https://localhost`** (DEC: `androidScheme:'https'`).
   Isso quebra abrir-link, tempo real, "compartilhadas comigo" e **bloqueia o Bloco J inteiro**
   (App Links). Uma correção de **origem canônica** destrava 4 áreas de teste.
2. **Um bug crítico de iOS (D-BUG-02):** sem `maximum-scale`, qualquer input com fonte < 16px faz o
   Safari dar zoom e **não voltar**. Conserto = meta viewport + (defesa) fonte ≥ 16px nos inputs.
3. **Regressões de UI bem localizadas:** câmera do QR (perdeu 1×/2×/3× e o botão frontal virou
   round-robin), barra de rolagem reaparecendo, "amigo sincero" verde dizendo algo ruim, direção da
   animação de aba, dois "X" na busca, bloco de fotos da saída empurrando a tela.
4. **Buracos de visibilidade/edição:** entrada (income) não aparece na aba Gastos; foto da saída some
   na revisão; GPS não aparece na edição; crédito do CSV não importa; "ver prévia da fase" e
   "vincular gasto a planejado" escondidos; receber conexão só pelo backup.
5. **1 item que pede APK novo:** biometria nativa (hoje só WebAuthn web, invisível no WebView).

**Tudo, exceto a biometria nativa, é corrigível por OTA (web)** e testável **no APK 0.69 que o Julio
já tem**. O lote nativo (biometria + promoção do 0.69 já verificado) fecha num único APK 0.71.

---

## 1. Metodologia & fontes lidas (código desta sessão)

| Fonte lida | O que confirmei |
|---|---|
| `domain/sync/share-link.ts` · `pair-link.ts` | URLs montadas com `origin` recebido; call sites passam `window.location.origin` |
| `features/shared/ShareLinkSheet.tsx` · `SharedExpensesPage.tsx` | `buildShareUrl(window.location.origin,…)` e `pairLinkFromEncoded(window.location.origin,…)` |
| `capacitor.config.ts` + `dev-log.md` | `androidScheme:'https'` → WebView roda em `https://localhost` (raiz do D-BUG-01) |
| `utils/app-update.ts` · `utils/native/deep-link.ts` | apex `trippilot.pages.dev` já é constante conhecida (reuso para o helper de origem) |
| `index.html` | viewport sem `maximum-scale`/`user-scalable` (raiz do D-BUG-02) |
| `components/QrScanner.tsx` | `switchCamera` cicla TODOS os deviceIds; presets `[1,2,3]` só com `zoom` capability |
| `features/expenses/ExpenseListPage.tsx` | feed filtra `type==='expense'` (exclui income); `input type="search"` (2º X nativo) |
| `features/expenses/ExpenseDetailPage.tsx` | edição de local = input de texto puro (sem nearby/GPS) |
| `features/attachments/AttachmentSection.tsx` | viewer `fixed inset-0 bg-black/95`, `object-contain`, sem zoom |
| `features/outing/OutingReviewPage.tsx` | **não** renderiza `AttachmentSection` (foto da sessão some) |
| `features/outing/OutingPage.tsx` | `photosSlot` = `AttachmentSection` inteiro acima do quick-add |
| `domain/import/wise-import.ts` | `importable = expense\|fee` → crédito é display-only |
| `domain/budget/honest-friend.ts` · `cards/AmigoSinceroCard.tsx` | `over_pace + overflowFitsPhase` → tone `positive` (verde) |
| `app/AppShell.tsx` · `RootLayout.tsx` · `styles/globals.css` | `data-nav` só pelo idx do histórico; scrollbar escondido global; `#root{zoom:1.06}` nativo |
| `features/dashboard/cards/AvailableCalendar.tsx` | célula só com nº do dia; valor só no `aria-label` |
| `utils/biometric-unlock.ts` · `features/security/LockScreen.tsx` | WebAuthn (sem suporte no WebView); PIN exige submit |

---

# PARTE A — Bugs (causa-raiz + plano cirúrgico)

> Cada item: **origem** (fala do Julio) · **o que acontece** · **causa-raiz** · **plano**
> (arquivos) · **anti-regressão** · **testes** · **gate/onda** · **esforço** (raw → Tier 3 ÷3).

## P0 — Críticos

### D-BUG-01 — Link de divisão/pareamento vem `https://localhost` no app nativo [VERIFICADO]
- **O que acontece:** ao "Compartilhar com Ana" (ou copiar link em Pessoas/dívidas), o link copiado é
  `https://localhost/s/<id>#k=…`. Não abre em lugar nenhum. **Bloqueia** abrir-link, tempo real,
  "compartilhadas comigo" e o Bloco J (App Links).
- **Causa-raiz:** `ShareLinkSheet.tsx` (l.61, 98) e `SharedExpensesPage.tsx` (l.213, 224) montam a
  URL com `window.location.origin`. No WebView do Capacitor com `androidScheme:'https'`, isso é
  `https://localhost` (confirmado no `dev-log` da OTA: "the APK runs at `https://localhost`"). Na
  web/PWA o `origin` é o apex correto — por isso só quebra no app instalado.
- **Plano:**
  1. Novo helper puro `utils/share-origin.ts` → `getShareOrigin()`: retorna `PUBLIC_APP_ORIGIN`
     (`https://trippilot.pages.dev`) quando `isNativeApp()`, senão `window.location.origin`.
     Reusar a constante do apex (mesma de `app-update.ts`/`deep-link.ts` → extrair p/ um `constants`).
  2. Trocar os 4 call sites (`ShareLinkSheet` ×2, `SharedExpensesPage` ×2) para `getShareOrigin()`.
  3. (Conferir) qualquer outro `window.location.origin` em contexto de link gerado (share-card só
     desenha texto — não é link; deixar).
- **Anti-regressão:** web/PWA inalterado (`getShareOrigin()===window.location.origin` fora do nativo).
  As funções puras `buildShareUrl`/`pairLinkFromEncoded` **não mudam** (continuam recebendo `origin`)
  — só muda **quem** passa o origin. Testes de `share-link`/`pair-link` seguem verdes.
- **Testes:** +unit `share-origin` (nativo→apex, web→origin, sem barra dupla). Mock `isNativeApp`.
- **Onda 1.** **Esforço:** 3h → **1h**. *(Verificação final do App Link `#fragment` = device, Onda 5.)*

### D-BUG-02 — iPhone (web): input dá zoom e não volta [VERIFICADO]
- **O que acontece:** no iPhone (navegador), tocar em qualquer campo dá zoom na página e **não volta**.
- **Causa-raiz:** `index.html` viewport = `width=device-width, initial-scale=1.0, viewport-fit=cover,
  interactive-widget=resizes-content` — **sem** `maximum-scale`/`user-scalable`. O Safari iOS dá
  auto-zoom em foco de input com `font-size < 16px` (vários inputs usam `text-sm`=14px) e, com zoom
  livre, não desfaz.
- **Plano:** adicionar `maximum-scale=1, user-scalable=no` ao viewport. Alinha com o desejo do Julio
  ("não quero aquele zoom que mexe no app todo") e com o zoom da foto que será **interno** (D-BUG-17).
  Defesa adicional: garantir `font-size: 16px` nos inputs de texto/busca críticos (utilitário CSS
  `.app-input` ou regra base para `input,select,textarea`), para acessibilidade caso o `user-scalable`
  seja revisto.
- **Anti-regressão:** Android WebView usa `--native-zoom` próprio (não afetado). Verificar que
  desabilitar pinch não quebra nada que dependa dele (não há — o zoom de foto vira componente).
- **Testes:** E2E/Playwright não cobre zoom nativo de Safari; verificação real = device iOS (Julio).
  Unit não se aplica. Marcar AC `[device-iOS]`.
- **Onda 1.** **Esforço:** 1h → **0.4h**.

## P1 — Altos

### D-BUG-03 — Câmera do QR regrediu (zoom + botão frontal) [VERIFICADO]
- **O que acontece:** sumiu **1×/2×/3×**; o botão de câmera vira **round-robin de todas as câmeras**
  (traseira→frontal→frontal2→traseira) em vez de só alternar frente/trás.
- **Causa-raiz:** `QrScanner.tsx` `switchCamera` cicla `cameraIds` em round-robin (l.142). Os presets
  de zoom só aparecem se a câmera ativa expõe `zoom` capability E `zoomLevels.length > 1` (l.192) —
  ao ciclar para uma lente sem `zoom`, os presets somem (`setZoom(null)` em cada troca).
- **Plano (restaurar o modelo limpo):**
  1. **Botão de troca = front↔back por `facingMode`** (não deviceId round-robin): manter um estado
     `facing: 'environment'|'user'`; `getUserMedia({ video: { facingMode } })`; o botão alterna os dois.
  2. **Presets 1×/2×/3× = zoom óptico/digital** da câmera traseira (quando a track expõe `zoom`).
     Manter o filtro por capability, mas **não** zerar/perder ao alternar frente/trás (re-derivar do
     novo track). Em multi-lente onde o SO mapeia lentes como zoom, os presets cobrem o caso.
  3. (Opcional, escondido) manter um "tentar outra lente" só se `facingMode` falhar foco — sem
     poluir o botão principal. Preferir simplicidade (decisão do Julio: "volte ao que era").
- **Anti-regressão:** lembrar a preferência (localStorage) por `facingMode`, não por deviceId. O
  fallback `OverconstrainedError` continua. R6-08/09 (multi-lente foco) vira caso de borda, não default.
- **Testes:** unit é limitado (getUserMedia é browser); +teste do seletor de zoom/`facingMode` puro
  (extrair a lógica de presets para função pura testável). Visual = Playwright (mock de devices) +
  device real.
- **Onda 2.** **Esforço:** 5h → **1.7h**.

### D-BUG-04 — Entrada (income) não aparece na aba Gastos [VERIFICADO] → ver D-DEC-D
- **Causa-raiz:** `ExpenseListPage.tsx` l.124 filtra `tx.type === 'expense'`. Income/transfer/etc.
  ficam de fora. Income hoje só é visível no "gastos recentes" da Home e via deep-link ao detalhe.
- **Plano (D-DEC-D = inline verde):**
  1. Incluir `type==='income'` no feed (ordenado por data), como **linha distinta** (cor `success`,
     sinal `+`, ícone `savings`), tap → `ExpenseDetailPage` (que já vê/edita/exclui income).
  2. **Total do cabeçalho permanece = só `expense`** (income NÃO entra no "total gasto" — ÂNCORA 11/
     invariância). O subtotal do dia também ignora income; a linha de income mostra `+€X` à parte.
  3. Busca/filtros: income entra na busca por descrição; chips de categoria não se aplicam (income
     tem `category:null`) — ok.
- **Anti-regressão:** `totalCents`/subtotais bit-idênticos com zero income; rollup de sessão intacto;
  income nunca vira "gasto".
- **Testes:** +unit do feed (income aparece como linha, não soma ao total/subtotal); E2E visual.
- **Onda 3.** **Esforço:** 4h → **1.3h**.

### D-BUG-05 — Foto da saída some após encerrar [VERIFICADO]
- **Causa-raiz:** a foto é anexada à **sessão** (`AttachmentSection sessionId`), mas a
  `OutingReviewPage` (rota `/outings/:id/review`, onde se vê a saída concluída) **não renderiza**
  `AttachmentSection`. A foto está no banco, mas nenhuma tela concluída a mostra.
- **Plano:** adicionar `<AttachmentSection sessionId={session.id} />` na `OutingReviewPage` (seção
  "Comprovantes/Fotos"), reaproveitando o componente existente (leitura + add/remover).
- **Anti-regressão:** componente já testado; não toca o fluxo ativo. Detalhe do gasto individual
  continua mostrando anexos da transação (separado da sessão).
- **Testes:** +E2E visual (saída concluída mostra a foto anexada).
- **Onda 2.** **Esforço:** 1.5h → **0.5h**.

### D-BUG-06 — Linha de crédito do CSV não importa [VERIFICADO]
- **Causa-raiz:** `wise-import.ts` l.261 `importable = kind === 'expense' || kind === 'fee'` →
  crédito (`kind==='credit'`) é **display-only** (l.53). Antes do tipo `income` não havia como
  representar dinheiro recebido; **agora há** (DEC-212, entregue 0.67).
- **Plano:**
  1. Tornar crédito **importável**: `includeByDefault` quando `status==='new'`.
  2. No commit (`import-orchestrators.ts`), crédito → `createIncomeTransaction` (credita a carteira
     alvo + cresce o pool da fase por data), reusando a fábrica de income. Categoria `null`,
     `excludeFromLearning:true` (como toda entrada).
  3. Dedupe de crédito por `externalRef` (mesmo do expense) p/ reimport não duplicar.
- **Anti-regressão:** transferências com contraparte (payeeName) continuam no fluxo de transferência
  (já funciona — Bruno passou); só o **crédito puro** (sem contraparte) vira income. Invariância do
  income mantida (com zero crédito importado, nada muda).
- **Testes:** +unit (crédito → draft importável; commit cria income; reimport dedupe); E2E visual.
- **Onda 3.** **Esforço:** 5h → **1.7h**.

### D-BUG-07 — Barra de rolagem reapareceu (nativo) [A VERIFICAR — elemento exato]
- **O que acontece:** voltou a barra de rolagem no app instalado.
- **Causa-raiz provável:** o CSS global **já esconde** scrollbars (`globals.css` l.129-137). Hipótese
  forte: `html.cap-native #root { zoom: 1.06 }` (l.158) — sob `zoom`, algumas versões do Android
  System WebView **não aplicam** `::-webkit-scrollbar{display:none}` ao container zoomado, expondo a
  barra. Alternativa: um container de scroll específico com gutter.
- **Plano:**
  1. Reforçar a regra: aplicar `scrollbar-width:none` + `::-webkit-scrollbar{width:0;display:none}`
     **explicitamente no `#root` e no `main`/scroller** (não só no universal), e em `html.cap-native`.
  2. Se persistir sob `zoom`, avaliar trocar `zoom` por `transform: scale()` com `transform-origin`
     no `#root` (mais previsível) — **só** se o device confirmar que é o `zoom` (risco de layout).
  3. **Confirmar em device** qual elemento mostra a barra (screenshot) antes de fechar.
- **Anti-regressão:** o `FastScroller` (overlay próprio) é a única barra visível intencional — não
  mexer. Web/PWA não afetado.
- **Testes:** Playwright não reproduz o WebView; AC `[device]`.
- **Onda 1** (CSS barato) + **confirmação device** Onda 5. **Esforço:** 1.5h → **0.5h**.

### D-BUG-08 — GPS/lugar não aparece na edição do gasto [VERIFICADO]
- **Causa-raiz:** `ExpenseDetailPage.tsx` (l.387-395) edita o local com **input de texto puro** —
  sem "usar minha localização", sem lugares próximos, sem "buscar nome online". Esse aparato vive
  **inline** no `QuickAddPage` (não é componente reusável).
- **Plano:**
  1. **Extrair** o seletor de local do QuickAdd para um componente reusável `features/location/
     PlaceField.tsx` (estado: place + gpsCoords + nearby + recents + find-online), parametrizado por
     categoria (para o nearby).
  2. Usar `PlaceField` em **QuickAdd** (substituir o inline, sem mudar comportamento) e na **edição**
     do `ExpenseDetailPage`.
  3. (Oportunístico) a saída (`OutingPage`) tem um 3º clone — **não** tocar agora (escopo), só anotar.
- **Anti-regressão:** QuickAdd deve ficar **idêntico** em comportamento (extração pura, sem regressão).
  GPS bruto continua 100% local (ÂNCORA 8).
- **Testes:** unit da lógica de sugestões já existe (`place-suggestions`); +E2E visual (editar gasto
  → usar localização/nearby aparece).
- **Onda 3.** **Esforço:** 6h → **2h** (a extração é o custo).

### D-BUG-09 — Caixa postal não entrega no outro aparelho [A VERIFICAR]
- **O que acontece:** "enviei extrato pela caixa postal, falou 'entregue', mas o outro aparelho não
  recebeu nada."
- **Causa-raiz:** **a confirmar** — depende de 2 aparelhos pareados e do relay (`Mailbox` DO). Pode
  estar acoplado ao **D-BUG-19** (pareamento conecta e para). Se o pareamento não completa, a caixa
  postal não tem destino.
- **Plano:** investigar junto com D-BUG-19 (mesma raiz provável). Confirmar: (a) o pareamento grava o
  par; (b) o envio publica no DO; (c) o destino lê ao abrir. Repro com 2 telas/aparelhos.
- **Onda 5** (sync, precisa de 2 aparelhos). **Esforço:** 4h → **1.3h** (após repro).

## P2 — Médios

### D-BUG-10 — Direção da animação de aba não é bidirecional [VERIFICADO]
- **Causa-raiz:** `RootLayout.useNavDirection` define `data-nav` só pelo **idx do histórico**; navegar
  pela barra inferior é sempre **push** (idx sobe) → sempre `forward` → a página entra sempre do mesmo
  lado (+16px). O `pane-next/prev` já resolve isso para **sub-abas** (Gastos/Saídas), mas não para a
  **barra inferior** (Início/Gastos/Viagem/Copiloto).
- **Plano:** classificar a direção da troca de aba pelo **índice da aba** (ordem `nav-tabs.ts`), não
  pelo histórico. Ao trocar de aba (tap no `BottomNav` ou swipe via `useTabPaging`), setar
  `document.documentElement.dataset.nav` = `forward` (índice maior) / `back` (menor) **antes** da
  navegação, e deixar o `route-view` animar conforme. O `useTabSwipePager` (drag interativo) já move
  na direção certa; só a **entrada** pós-commit precisa do sinal.
- **Anti-regressão:** navegação não-aba (push/pop de subpáginas) continua pelo idx. Garantir que o
  `data-nav` da aba não vaze para a próxima navegação normal (resetar no próximo location). Respeitar
  `prefers-reduced-motion`.
- **Testes:** unit puro da função "direção por índice de aba"; E2E visual (ir e voltar entre abas
  anima em lados opostos).
- **Onda 4.** **Esforço:** 4h → **1.3h**.

### D-BUG-11 — "Amigo sincero" verde dizendo algo ruim [VERIFICADO] → D-DEC-E
- **Causa-raiz:** `honest-friend.ts` `getHonestFriendTone` retorna `positive` (verde) para
  `over_pace + overflowFitsPhase` (l.96) — mesmo com a mensagem "cabem só 5 dos 6 que faltam".
- **Plano (D-DEC-E = nova tonalidade `steady`):**
  1. Novo tone **`steady`** (azul/teal calmo = "atenção, mas tranquilo"). Mapear
     `over_pace + overflowFitsPhase` → `steady` (em vez de `positive`).
  2. Adicionar `steady` ao `TONE_STYLE` (`AmigoSinceroCard`) e ao `VERDICT_STYLE` do Copiloto se
     compartilham a forma. Token de cor azul (ver tokens; adicionar `--info`/`--steady` se faltar).
  3. (Microcopy) liderar a frase com a parte tranquilizadora ("a fase cobre o resto; segure N pra
     ficar no plano") — opcional, sem mudar a chave principal.
- **Anti-regressão:** `on_plan`→verde, `over_plan`/`over_pace` com reserva em risco→vermelho,
  reserva segura→âmbar permanecem; só o caso "cabe na folga" deixa de ser verde. `hideOnPlan` da
  Home intacto.
- **Testes:** atualizar `honest-friend`/tone tests (novo `steady`); E2E visual do card azul.
- **Onda 3** (junto do amigo). **Esforço:** 2.5h → **0.8h**.

### D-BUG-12 — Fechar card flutuante só pela alça [VERIFICADO — direção]
- **Causa-raiz:** o drag-to-close vive no `components/BottomSheet.tsx` (alça). O gesto não inicia no
  corpo do card.
- **Plano:** no `BottomSheet`, permitir iniciar o **drag-to-dismiss pelo corpo** quando o conteúdo
  está no topo (`scrollTop===0`) e o gesto é pra baixo — padrão "puxar conteúdo no topo fecha". A
  alça continua funcionando sempre. Threshold/velocidade iguais.
- **Anti-regressão:** scroll interno do sheet continua quando `scrollTop>0`; não capturar gestos
  horizontais; não quebrar sheets com listas longas. Testar com sheet rolável (config da Home).
- **Testes:** unit do gesto (puro, se extraível) + E2E manual/visual.
- **Onda 4.** **Esforço:** 4h → **1.3h**.

### D-BUG-13 — Gastos recentes da Home sem rollup + hoje/ontem [VERIFICADO + A VERIFICAR]
- **Causa-raiz:** `DashboardCards.tsx` (`recent_expenses`, l.1078) lista transações **individuais**
  (`rodada 3/2`) sem agrupar a sessão — inconsistente com a `ExpenseListPage` que faz rollup. O
  "hoje/ontem" usa as chaves certas; o "não funciona direito" é provavelmente os rounds soltos da
  sessão de bar aparecendo como itens.
- **Plano:** aplicar o **mesmo rollup de sessão** do feed de Gastos no preview da Home (uma linha
  "Bar · N itens" em vez de "rodada 3/2/1"). Reusar a lógica de rollup (extrair p/ helper puro
  compartilhado entre Home e Lista). Confirmar rótulos hoje/ontem com screenshot.
- **Anti-regressão:** a lista completa (1 toque) continua igual; rollup idêntico ao da `ExpenseListPage`.
- **Testes:** +unit do helper de rollup compartilhado; E2E visual.
- **Onda 4.** **Esforço:** 3h → **1h**.

### D-BUG-14 — Dois "X" na busca de Gastos [VERIFICADO]
- **Causa-raiz:** `ExpenseListPage.tsx` l.369 usa `<input type="search">` (o WebKit/Chromium renderiza
  um **botão de limpar nativo**) **+** um botão "X" customizado (l.376-384) = dois X.
- **Plano:** trocar `type="search"` por `type="text"` (mantém o X customizado e o teclado), **ou**
  esconder o nativo com CSS `::-webkit-search-cancel-button { display:none }`. Preferir `type="text"`
  (simples, consistente com os outros inputs). Conferir outros `type="search"` no app (mesmo fix).
- **Anti-regressão:** comportamento de busca idêntico; `inputMode` se necessário.
- **Testes:** E2E visual (um X só).
- **Onda 1** (trivial). **Esforço:** 0.5h → **0.2h**.

### D-BUG-15 — Saída ativa sem margem dos lados [A VERIFICAR — elemento]
- **Causa-raiz:** **a confirmar** — a `OutingPage` é rota standalone (fora do AppShell) e usa `px-5`
  por seção (20px), não o token `--page-padding-x` (16px). Algum elemento (gauge/segments/banner)
  pode sangrar full-bleed, ou faltar inset de safe-area lateral.
- **Plano:** unificar o inset horizontal da saída ativa com o padrão do app (`--page-padding-x` +
  safe-area) e garantir que nenhum elemento vá full-bleed sem querer. Confirmar com screenshot qual
  elemento o Julio viu sem margem.
- **Anti-regressão:** não quebrar o modo bar fullscreen (que é intencionalmente cheio).
- **Testes:** E2E visual.
- **Onda 2.** **Esforço:** 1.5h → **0.5h**.

### D-BUG-16 — Bloco de fotos da saída empurra a tela [VERIFICADO]
- **Causa-raiz:** `OutingPage.tsx` l.2686 renderiza o `AttachmentSection` **inteiro** acima do
  quick-add; o estado vazio é um botão grande `py-6` → empurra e gera scroll já no 1º gasto.
- **Plano:** na saída ativa, render **compacto** das fotos por padrão — um **botão/linha pequena**
  ("Anexar foto" + miniaturas em fileira horizontal), expandindo só sob demanda. Manter o
  `AttachmentSection` completo na **revisão** (não tem pressão de espaço lá). Pode ser uma prop
  `compact` no `AttachmentSection` ou um wrapper colapsável.
- **Anti-regressão:** anexar/remover continua; a foto chega na sessão (e agora aparece na revisão —
  D-BUG-05).
- **Testes:** E2E visual (saída com 1 gasto não precisa rolar pra ver o quick-add).
- **Onda 2.** **Esforço:** 3h → **1h**.

### D-BUG-17 — Visualizador de foto: fundo preto + sem zoom [VERIFICADO]
- **Causa-raiz:** `AttachmentViewer` é `fixed inset-0 bg-black/95` com `object-contain` e **sem zoom**.
- **Plano:**
  1. **Zoom interno** (pinch + double-tap + pan) **só no componente** via transform na `<img>` (com
     handlers de toque), sem afetar o app. Casa com D-BUG-02 (zoom global desligado).
  2. **Fundo:** trocar `bg-black/95` por um scrim do tema (ex.: `var(--scrim)` / surface escura) p/
     não destoar — manter contraste pra foto, mas alinhado ao app.
- **Anti-regressão:** fechar/excluir/`safe-top` intactos; revogar objectURL no unmount mantido.
- **Testes:** E2E visual (abrir foto, dar zoom, fundo coerente).
- **Onda 2.** **Esforço:** 4h → **1.3h**.

### D-BUG-18 — UI de dividir item da nota confusa [VERIFICADO — clareza]
- **Causa-raiz:** no `ReceiptScanPage`, abrir um item mostra "divisão" + botão "pessoal" — não fica
  claro que é divisão (achado **G9** da auditoria de UX: divisão inconsistente em 4 telas).
- **Plano:** microcopy mais claro: pergunta direta ("Dividir este item com quem?" / "Quem vai
  pagar?") e rótulos consistentes com QuickAdd/Compartilhar. Sem mudar a mecânica (que funciona).
- **Anti-regressão:** lógica de rateio intacta (ajustar ao total etc. funcionam).
- **Testes:** E2E visual; i18n pt/en/es.
- **Onda 4.** **Esforço:** 2h → **0.7h**.

### D-BUG-19 — Pareamento por QR conecta e para [A VERIFICAR]
- **O que acontece:** "li o QR, 'conectado à Ana', mas depois não faz mais nada."
- **Causa-raiz:** **a confirmar** — provável falta de **próximo passo/feedback** pós-pareamento (o
  par é gravado mas a tela não navega/confirma o que fazer agora). Pode ser a raiz de D-BUG-09.
- **Plano:** investigar o fluxo (`PairPage`/`SyncTransferFlow`/`sync`): após parear, mostrar próximo
  passo claro (ex.: "Conectado. Enviar/receber extrato" CTA) e/ou navegar para a caixa postal.
- **Onda 5** (sync, 2 aparelhos). **Esforço:** 4h → **1.3h**.

### D-BUG-20 — Receber conexão/dívida só pelo Backup [VERIFICADO — IA]
- **Causa-raiz:** o "receber de outro aparelho" (ler QR) vive dentro de **Backup → importação**.
  Pouco acessível para uma ação de pessoas/dívidas.
- **Plano:** adicionar porta de entrada de **"Receber de outro aparelho / ler QR"** em
  **Pessoas e dívidas** (e/ou no hub de Conexões), reusando o mesmo fluxo. Manter o atalho no Backup.
- **Anti-regressão:** mesmo fluxo, nova entrada; sem duplicar lógica.
- **Testes:** E2E visual (entrada visível em Pessoas).
- **Onda 4.** **Esforço:** 2h → **0.7h**.

---

# PARTE B — Melhorias pedidas

### D-IMP-01 — Calendários mostram € por dia sem clicar [VERIFICADO]
- **Hoje:** `AvailableCalendar`/heatmap mostram só o nº do dia (valor só no `aria-label`).
- **Plano:** render do **valor em € compacto** abaixo do nº do dia em cada célula (ex.: "46",
  "1,2k"). Vale para "disponível por dia" **e** "gastos por dia" (HeatmapGrid). Clicar continua
  abrindo o detalhe (mais info). Formatação compacta nova (`formatMoneyCompact`) p/ caber na célula.
- **Anti-regressão:** cores/intensidade e seleção intactas; legível em pt/en/es.
- **Testes:** +unit do `formatMoneyCompact`; E2E visual.
- **Onda 4.** **Esforço:** 4h → **1.3h**.

### D-IMP-02 — "Ver prévia da fase" / "Gerenciar fundo" muito escondidos [VERIFICADO]
- **Plano:** **subir** as entradas para a aba **Viagem** (no card/seletor de fase): botões "Ver
  prévia" e "Gerenciar fundo" diretos, além do caminho atual (cabeçalho da Home → visão geral).
  Casa parcialmente com a futura "porta única de planejamento" (Pacote #1), mas aqui é só
  **descoberta** (sem reescrever o modelo).
- **Anti-regressão:** rotas inalteradas; só novas portas de entrada.
- **Testes:** E2E visual.
- **Onda 4.** **Esforço:** 3h → **1h**.

### D-IMP-03 — "Vincular gasto existente a planejado" pelo lado do gasto [VERIFICADO]
- **Hoje:** a função existe na **Compras planejadas** (B9, 0.65), mas o Julio a procurou **no gasto**.
- **Plano:** adicionar no `ExpenseDetailPage` uma ação "Vincular a uma compra planejada" → picker de
  planejados compatíveis → reusa `linkExistingExpenseToPlannedPurchase` (mesma orquestração, sem
  criar gasto novo). Porta reversa da que já existe.
- **Anti-regressão:** orquestração testada reusada; sem novo caminho de dados.
- **Testes:** +unit (link pelo detalhe) reusando o existente; E2E visual.
- **Onda 4.** **Esforço:** 3h → **1h**.

### D-IMP-04 — Compartilhamento nativo após dividir [VERIFICADO — depende de D-BUG-01]
- **Hoje:** após dividir, o nudge **copia** o link.
- **Plano:** usar `navigator.share()` (Web Share / share nativo) quando disponível, com texto pronto
  + o link **correto** (pós D-BUG-01); fallback = copiar. O `SharedExpensesPage` já usa
  `navigator.share` no pair link — reusar o padrão no `ShareLinkSheet`/nudge.
- **Anti-regressão:** fallback de copiar mantido onde `navigator.share` não existe.
- **Testes:** E2E (mock de `navigator.share`).
- **Onda 4** (após D-BUG-01). **Esforço:** 2h → **0.7h**.

### D-IMP-05 — Nome do estabelecimento + categoria na nota [VERIFICADO — OCR]
- **Plano:** estender o parsing do OCR (Worker `/ocr` Groq) para extrair **nome do estabelecimento**
  → vira o nome da nota; e **categoria/subgrupo** sugeridos. Opt-in já existe (IA na nuvem).
- **Anti-regressão:** fallback manual intacto; nada quebra se o campo vier vazio.
- **Testes:** unit do parser (mock de resposta); E2E visual.
- **Onda 4** (médio). **Esforço:** 5h → **1.7h**. *(pode ir pra um pacote de OCR se estourar a onda.)*

### D-IMP-06 — PIN entra sozinho ao completar [VERIFICADO]
- **Hoje:** `LockScreen` exige clicar "Desbloquear".
- **Plano:** auto-verificar quando o PIN atinge o comprimento configurado (ou ≥ mínimo), desbloqueando
  na hora se correto; silencioso enquanto incompleto/errado. Manter o botão como fallback acessível.
- **Anti-regressão:** ÂNCORA 12 — PIN sempre funciona; nunca prende.
- **Testes:** unit (auto-submit ao atingir comprimento) + E2E.
- **Onda 4.** **Esforço:** 1.5h → **0.5h**.

### D-IMP-07 — Imagem default ao configurar saída [A VERIFICAR — cosmético]
- **Plano:** dar uma imagem/ícone default ao configurar saída (como Veneza tem). Baixa prioridade.
- **Onda 4** (cosmético). **Esforço:** 1h → **0.3h**.

---

# PARTE C — Decisões (conselho 4 lentes) — RESOLVIDAS inline

> Lentes: **Estrategista** · **Arquiteto** · **Crítico** · **Advogado do usuário**.

### D-DEC-D — Como a entrada (income) aparece na lista de Gastos
- **Opções:** (1) inline verde no feed; (2) chip de filtro "Entradas"; (3) sub-aba dedicada.
- **Estrategista:** o usuário busca "todos os meus lançamentos" na aba Gastos — uma timeline só é
  mais natural. **Arquiteto:** inline reusa a linha do feed; baixo risco; o **total do cabeçalho deve
  continuar = gastos** (income não é gasto). **Crítico:** somar income ao total corromperia o "total
  gasto" — proibido; linha distinta e fora do subtotal. **Advogado:** ele quer ver/editar/excluir —
  inline + tap no detalhe (que já trata income) resolve direto.
- **✅ DECISÃO:** **inline verde no feed**, fora do total/subtotal de gasto, tap → detalhe. Chip
  "Entradas" fica como melhoria futura. *(Mantém a invariância do número do hero.)*

### D-DEC-E — Terceira cor do "amigo sincero"
- **Estrategista:** o card precisa de um estado "ok, mas de olho" distinto de verde (tudo bem) e
  âmbar (aviso). **Arquiteto:** adicionar tone `steady` (azul/teal) é aditivo e data-driven.
  **Crítico:** não reusar âmbar (Julio rejeitou — "parece aviso"); azul comunica "informativo/
  estável". **Advogado:** é exatamente o "não tá tudo bem, mas não tá tudo mal" que ele pediu.
- **✅ DECISÃO:** **novo tone `steady` (azul/teal)** para `over_pace + overflowFitsPhase`. Demais
  tones inalterados.

### D-DEC-C — Biometria nativa (precisa de APK)
- **Estrategista:** biometria é esperada num app de dinheiro; hoje só existe via WebAuthn web, que o
  WebView Android não expõe → **invisível no app instalado**. **Arquiteto:** adicionar um plugin
  Capacitor de biometria (ex.: `capacitor-native-biometric`/`@aparajita/capacitor-biometric-auth`)
  atrás de `isNativeApp()`, com WebAuthn como caminho web; PIN sempre fallback. **Crítico:** muda o
  nativo → **novo APK + verificação em device**; ÂNCORA 12 (nunca prender) obrigatória.
  **Advogado:** Julio claramente quer (procurou e não achou).
- **✅ DECISÃO:** **implementar a biometria nativa** atrás de `isNativeApp()`, mesma gate
  `isBiometricUnlockReady`. Entra no **lote nativo (Onda 5)** com o APK 0.71. PIN nunca preso.

### D-DEC-A — Categoria por item da nota → **ADIADO**
- Julio: "seria melhor, mas se for difícil, nem precisa." **Crítico/Arquiteto:** é trabalho de
  schema/UX/OCR (médio) e não bloqueia nada. **✅ DECISÃO:** **adiar** para um pacote futuro de
  recibo (documentado). Fora da força-tarefa.

### D-DEC-B — 2 cards por linha auto + descoberta → **ADIADO (parcial)**
- **Arquiteto:** auto-densidade é heurística frágil; o problema real é descoberta. **✅ DECISÃO:**
  **adiar a auto-densidade**; descoberta entra como microcopy/hint leve se sobrar tempo na Onda 4
  (senão, backlog). Fora do caminho crítico.

---

# PARTE D — Plano de execução (ondas, gates, hardening)

> `phase-delivery-hardening.mdc`: gates ≤5–6 milestones; entre gates → suíte verde + build web +
> (cap sync/assembleDebug quando nativo) + golden path + ACs cumulativos + dev-log + context refresh.
> Bloco **NÃO-NEGOCIÁVEIS** relido a cada gate. Cada milestone: testes antes de commit; só avança
> quando verde. **Playwright** (Pixel 5 / iPhone viewport) valida o visual de cada item com UI.

### Onda 1 — Críticos + triviais [web/OTA] — *desbloqueio máximo*
- **D-BUG-01** (origem do link), **D-BUG-02** (zoom iOS), **D-BUG-14** (X duplo), **D-BUG-07** (CSS da
  barra de rolagem — parte barata).
- **Gate:** suíte verde + build + E2E; deploy OTA `--branch=master`. **Tier 3 ~2.1h.**

### Onda 2 — Câmera + fotos + saída [web/OTA]
- **D-BUG-03** (câmera front/back + zoom), **D-BUG-17** (zoom/bg do viewer), **D-BUG-05** (foto na
  revisão da saída), **D-BUG-16** (bloco de fotos compacto), **D-BUG-15** (margens da saída).
- **Gate:** suíte verde + build + E2E visual (5 telas). **Tier 3 ~4.6h.**

### Onda 3 — Dinheiro + lista + amigo [web/OTA] — *invariância*
- **D-BUG-04**+**D-DEC-D** (income na lista), **D-BUG-06** (crédito→income), **D-BUG-08** (PlaceField
  na edição), **D-BUG-11**+**D-DEC-E** (tone `steady`).
- **Gate:** **invariância do income PRIMEIRO** (zero income ⇒ números bit-idênticos); suíte verde +
  build + E2E. **Tier 3 ~5.8h.**

### Onda 4 — Motion + UX + descoberta [web/OTA]
- **D-BUG-10** (direção de aba), **D-BUG-12** (drag-to-close), **D-BUG-13** (rollup recentes),
  **D-BUG-18** (clareza divisão), **D-BUG-20** (receber conexão em Pessoas), **D-IMP-01** (€ no
  calendário), **D-IMP-02** (ver prévia/fundo), **D-IMP-03** (vincular pelo gasto), **D-IMP-04**
  (share nativo), **D-IMP-06** (PIN auto). **D-IMP-05** (OCR nome) e **D-IMP-07** se couber.
- **Gate (2 sub-gates por volume):** suíte verde + build + E2E. **Tier 3 ~9–11h.**

### Onda 5 — Lote nativo + verificação em device [native → APK 0.71]
- **D-DEC-C** (biometria nativa), **D-BUG-19/09** (pareamento + caixa postal — repro 2 aparelhos),
  **confirmar D-BUG-07/15** (elemento exato), e **verificação device** do D-BUG-01 (App Link
  `#fragment`), B1/B2/B3 (promover o 0.69 já testado), B18 restante.
- **Gate:** `cap sync` + `assembleDebug` verde; ACs `[device]`; **promover APK só após device OK**.
  **Tier 3 ~5h + sessão QA do Julio.**

### Anti-regressão (checar a cada gate)
- Free-to-spend / true-free reconciliam; **income nunca entra no gasto**; meta/cofrinho read-only.
- Rollup de sessão consistente entre Home e Lista; carrosséis/insights rotativos intactos.
- `navigator.share` com fallback; web/PWA não afetado pelos guards `isNativeApp()`.
- Deploy produção `--branch=master`; **APK só na Onda 5** (e só promove com device OK).

---

# PARTE E — Atualização de brain / test-plan (pós-implementação)

- [ ] `decision-log.md`: registrar **DEC-217+** (origem canônica do link; tone `steady`; income na
  lista; crédito→income; biometria nativa) — **quando** o Julio autorizar/implementar (a força-tarefa
  já está autorizada, então registrar ao fim de cada onda entregue).
- [ ] `project-status.md`: bump de versão, contagem de testes, status das ondas.
- [ ] `device-test-plan-v50-v70-2026-06-17.md`: marcar os itens reverificados após cada onda.
- [ ] `src/dev-log.md`: entrada por onda (o que entrou, testes, regressão-risco) — padrão de hardening.
- [ ] README do brain: indexar este plano + o de resultados (feito).

---

## Apêndice — Matriz de rastreabilidade (ponto do device → ID → onda)

| Achado (device) | ID | Onda |
|---|---|---|
| Link localhost | D-BUG-01 | 1 |
| Zoom input iOS | D-BUG-02 | 1 |
| X duplo na busca | D-BUG-14 | 1 |
| Barra de rolagem voltou | D-BUG-07 | 1/5 |
| Câmera QR (zoom + frontal) | D-BUG-03 | 2 |
| Viewer de foto (bg+zoom) | D-BUG-17 | 2 |
| Foto da saída some | D-BUG-05 | 2 |
| Bloco de fotos grande | D-BUG-16 | 2 |
| Margem da saída | D-BUG-15 | 2/5 |
| Income fora da lista | D-BUG-04 / D-DEC-D | 3 |
| Crédito CSV não importa | D-BUG-06 | 3 |
| GPS na edição | D-BUG-08 | 3 |
| Amigo sincero verde | D-BUG-11 / D-DEC-E | 3 |
| Direção da animação de aba | D-BUG-10 | 4 |
| Drag-to-close | D-BUG-12 | 4 |
| Recentes sem rollup | D-BUG-13 | 4 |
| Clareza divisão item | D-BUG-18 | 4 |
| Receber conexão escondido | D-BUG-20 | 4 |
| € no calendário | D-IMP-01 | 4 |
| Ver prévia/fundo escondidos | D-IMP-02 | 4 |
| Vincular gasto a planejado | D-IMP-03 | 4 |
| Share nativo pós-dividir | D-IMP-04 | 4 |
| Nome/categoria da nota | D-IMP-05 | 4 |
| PIN auto-submit | D-IMP-06 | 4 |
| Imagem default saída | D-IMP-07 | 4 |
| Biometria nativa | D-DEC-C | 5 |
| Pareamento conecta e para | D-BUG-19 | 5 |
| Caixa postal não entrega | D-BUG-09 | 5 |
| Categoria por item | D-DEC-A | adiado |
| 2 cards auto | D-DEC-B | adiado |
| Banner demo / cofrinho copiloto / self-update APK | D-VER-01/02/03 | verificar |

*Fim do plano. Próximo passo: executar a **Onda 1** com o protocolo de hardening (testes + commit +
Playwright por milestone), sem parar até completar, buildar e conferir.*
