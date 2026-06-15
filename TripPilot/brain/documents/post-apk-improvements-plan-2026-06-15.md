# Plano Mestre — Melhorias pós-APK (Android nativo + UX)

> **Fonte:** feedback do Julio testando o **APK debug v0.27.0** no celular (15/06/2026).
> **Tipo:** documento de PLANEJAMENTO. Nada aqui é implementado ainda — define
> *o quê*, *como* e *quando* fazer, no padrão dos nossos pacotes de fase.
> **Não pode regredir nenhuma função existente** (contrato §0).

**Documentos irmãos (ler junto):**
- `android-native-strategy-2026-06-15.md` — estratégia Capacitor + Kotlin, Play Store, Fase A (APK) já executada, Fase B (Live Updates/Now Bar).
- `navigation-redesign-plan-2026-06-15.md` — DEC-180, redesign de navegação (Início·Gastos·+·Viagem·Copiloto). Vários pontos deste feedback continuam/fecham gates de lá.
- `pwa-notification-research.md` — DEC-120, limites do PWA para notificações (motivo de irmos nativo).

---

## 0. Princípios inegociáveis (contrato)

1. **ZERO regressão.** Cada função/informação de hoje continua existindo (pode mudar de lugar/forma). Todo item abaixo tem AC e checklist anti-regressão (§9).
2. **`.ts` sempre, nunca `.js` compilado.** Regra do projeto.
3. **Detectar plataforma nativa.** Comportamentos divergem entre Web/PWA e APK nativo. Criar um único ponto de verdade (`isNativeApp()`), nunca espalhar `if (Capacitor...)`.
4. **Contrato visual de hoje mantido (DEC-180 §0.0).** Isto é integração nativa + ajustes de hierarquia/IA, **não** um redesign visual. Mesmos componentes, mesma "cara".
5. **Domínio puro.** Lógica de negócio fica em `domain/**` (testável); plugins nativos ficam isolados em `utils/**` (boundary). Nada de plugin nativo dentro de componente/regra.
6. **Testes verdes + build limpo por gate** (898 testes unit hoje; manter 0 falhas; `tsc --noEmit` e build web sem erro).
7. **Verificação no aparelho.** Itens marcados `[device]` só fecham com APK reinstalado e testado no celular real (não dá pra validar no browser).

**Legenda:** Prioridade `P0`(crítico)…`P3` · Esforço `S/M/L/XL` · Risco `BAIXO/MÉDIO/ALTO` · Confiança da abordagem `ALTA/MÉDIA/BAIXA`.

---

## 1. Diagnóstico técnico (causa-raiz de cada queixa do APK)

> Resultado da auditoria do código atual. Isto define *como* cada correção precisa ser feita.

| # | Queixa do Julio (APK) | Causa-raiz encontrada | Direção de correção |
|---|---|---|---|
| 1 | Conteúdo/título/botão voltar **atrás da barra de status** | `index.html` tem `viewport-fit=cover` (edge-to-edge), mas só rodapés usam `env(safe-area-inset-bottom)`. **Headers não aplicam `safe-area-inset-top`**. Android 15+ (targetSdk 35/36) força edge-to-edge. | Aplicar `safe-area-inset-top` no(s) header(s)/AppShell + plugin StatusBar com `overlaysWebView` controlado. (N1) |
| 2 | Barra de status **branca no tema claro** (ícones somem) | Tema só troca a meta `theme-color` (`RootLayout.tsx`/DEC-083). Isso governa Chrome/PWA, **não** a status bar nativa. | `@capacitor/status-bar`: `setBackgroundColor` + `setStyle` (Dark/Light) reagindo ao tema. (N2) |
| 3 | Botão **voltar sai do app** | `useBackButtonGuard` (`RootLayout.tsx`) é hack de `history` do PWA. Comentário no código: *"o shell Capacitor vai assumir via `App.addListener('backButton')` depois"*. No nativo não está integrado. | `@capacitor/app` backButton → integra com history do React Router; só sai do app na raiz (com "tocar de novo pra sair"). (N3) |
| 4 | **Armazenamento persistente** não faz nada / banner "dados podem ser perdidos" | `requestPersistentStorage()` usa `navigator.storage.persist()`. No app nativo os dados **já são duráveis** (sem despejo de browser). Banner+toggle são irrelevantes ali. `utils/platform.ts` só detecta iOS/standalone, não Capacitor. | Detectar nativo → tratar persistência como garantida: **esconder banner e o toggle** no APK; manter no Web. (N4) |
| 5 | **GPS nunca pediu permissão** | `getCurrentCoords` (`utils/geolocation.ts`) chama `navigator.geolocation` direto e **engole o erro** (resolve `null` em qualquer falha). Sem plugin nativo + permissão no manifest, o WebView falha calado. | `@capacitor/geolocation` (requestPermissions) + permissões no `AndroidManifest`. Boundary nativo, domínio intacto. (N5) |
| 6 | "Este **navegador não suporta notificações** com botões" / nenhuma notificação | `utils/notifications.ts` usa Web Notifications API; no WebView do Capacitor é limitada/indisponível. `outing-notification.ts` depende de SW. | Migrar para `@capacitor/local-notifications` (permissão `POST_NOTIFICATIONS`, canais, botões). Base para a Fase B (Live Update/Now Bar). (N6 + Track B) |
| 7 | App **"menor", tudo mais espaçado** (como se DPI fosse maior) | Layout-viewport do WebView difere do PWA Chrome (largura CSS efetiva maior → tudo escala menor). | Calibrar **medindo no aparelho** (`innerWidth`/`devicePixelRatio`) e ajustar (viewport/`textZoom`/`initialScale`). `[device]` (N7) |
| 8 | Falta **feedback háptico** | Não há haptics no app. | `@capacitor/haptics` num boundary `utils/haptics.ts` + mapa de gatilhos. (N8) |
| 9 | **Página de notificações** = lista gigante | `NotificationsPage` é lista linear. | Reorganizar em seções/grupos (hoje/semana/tipo). Web layer. (U1) |
| 10 | **Viagem › Estrutura** é lista | `TripHubPage` `structureItems` renderiza lista com `border-b`. | Virar grid de tiles. (U2) |
| 11 | **Copiloto › Ferramentas** é lista | `CopilotPage` `tools` é lista com `desc` embaixo (o próprio Julio achou que a lista faz sentido por ter texto). | Decisão de conselho: grid 2-col com desc OU manter. (U3) |
| 12 | **Mapa do mês:** clicar no dia vai pra Gastos | `HeatmapCard` (no Copiloto) navega direto. | Tap no dia → **sheet flutuante** com o gasto daquele dia; botão "ver gastos" leva à lista. (U4) |
| 13 | **Análise do dia** ainda na Início (devia ser Copiloto) | É o card `trip_analytics` (recap+burndown). DEC-180 G4 já previu mover pro Copiloto; Copiloto já tem o `HeatmapCard`, falta recap/burndown. | Fechar DEC-180 G4: mover recap+burndown pro Copiloto; remover gaveta da Início. (U5) |
| 14 | **Contadores de ocasião** confusos (só 3 subcats; mistura "restantes/feitos" com "quantos") | Card `occasion_counters` cobre só ocasiões do planner (restaurante/bar/mercado). Mistura unidade (ocasião planejada × itens). | Modelo unificado (Conselho §3.1): todas as subcats; planejadas com meta primeiro; sem-meta só contagem. (U6) |
| 15 | Quer **busca de gastos** | `ExpenseListPage` só tem filtros por chip/categoria/lugar. Sem texto. | Campo de busca por descrição/valor. (G2) |
| 16 | Quer **scroll rápido tipo Google Fotos** | Lista agrupada por dia, sem scrubber. | Fast-scroll/scrubber com indicador de dia. `[device-feel]` (G3) |
| 17 | Quer **navegação por gestos** (swipe entre abas/fases/seções) | Abas/fases trocam só por toque. | Conselho §3.3: swipe em abas/fases (contido) confiável; swipe entre seções da barra = stretch com guarda. (G1) |

---

## 2. Inventário completo de mudanças (catalogado)

> 4 trilhas: **N** Native Shell, **B** Notificações avançadas, **U** UX/IA, **G** Gestos & busca.
> Cada item: problema → comportamento desejado → abordagem → arquivos-alvo → deps → AC.

### TRACK N — Native Shell Hardening (o app *correto* no Android)

#### N0 — Fundamentos nativos (pré-requisito de toda a Track N)
- **Objetivo:** ter os plugins e o detector de plataforma antes de tudo.
- **Abordagem:** instalar plugins (§5), criar `utils/native/` com `isNativeApp()` (wrapper de `Capacitor.isNativePlatform()`) e boundaries finos. Inicialização única em `main.tsx`/bootstrap.
- **Arquivos:** `utils/platform.ts` (estender), novo `utils/native/index.ts`, `main.tsx`, `capacitor.config.ts`, `android/app/src/main/AndroidManifest.xml`.
- **AC:** `isNativeApp()` retorna `true` no APK e `false` no Web; build web inalterado; nenhum import de plugin fora de `utils/native/**`.
- `P0 · S · BAIXO · ALTA`

#### N1 — Safe-area no topo (conteúdo não fica atrás da status bar) **[#1 do Julio — CRÍTICO]**
- **Desejado:** todo header/título/botão voltar começa **abaixo** da status bar; o espaço acima fica preenchido com a cor do app (integrado, bonito), sem o app "vazar" pra trás dos ícones.
- **Abordagem:** (a) StatusBar plugin: definir se sobrepõe o WebView e a cor; (b) garantir `env(safe-area-inset-top)` no contêiner de topo (AppShell + páginas com header próprio, ex.: `ExpenseListPage.page-sticky-header`, páginas fora do AppShell). Criar utilitário CSS `.safe-top`/token, reutilizável, para não espalhar.
- **Arquivos:** `app/AppShell` (ou layout do header), `index.css`/tokens, headers de páginas que rolam no body (lista de gastos, quick-add, etc.), `RootLayout.tsx`.
- **Risco:** MÉDIO — tem que cobrir **todas** as telas (algumas rolam fora do AppShell). Auditar rota a rota.
- **AC `[device]`:** em todas as rotas, nada fica sob a status bar; topo preenchido com a cor do tema; sem "pulo" ao rolar; bottom inset (já existente) intacto.
- `P0 · M · MÉDIO · ALTA`

#### N2 — Status bar segue o tema (sem barra branca cega) **[CRÍTICO]**
- **Desejado:** status bar com a cor do tema atual e ícones legíveis (claros no tema escuro, escuros no tema claro). Trocar tema → trocar barra na hora.
- **Abordagem:** em `applyTheme()` (hoje só mexe na meta `theme-color`), quando `isNativeApp()`, chamar `StatusBar.setBackgroundColor({ color })` + `StatusBar.setStyle({ style: Dark|Light })`. Manter a meta tag pro Web.
- **Arquivos:** `RootLayout.tsx` (`applyTheme`), `utils/native/status-bar.ts`.
- **AC `[device]`:** tema claro → barra clara, ícones escuros; tema escuro → barra escura, ícones claros; `system` segue o SO; troca ao vivo.
- `P0 · S · BAIXO · ALTA`

#### N3 — Botão voltar do Android navega no app (não sai) **[ALTO]**
- **Desejado:** voltar = voltar uma tela dentro do app; só na raiz (Início) faz "toque de novo pra sair".
- **Abordagem:** `@capacitor/app` `addListener('backButton', ...)`. Se há history → `history.back()`/router. Se está na raiz → padrão "press again to exit" (toast) e `App.exitApp()`. Quando nativo, **desativar** o hack `useBackButtonGuard` (era proxy do PWA) pra não brigar.
- **Arquivos:** `RootLayout.tsx` (gate o guard antigo por `!isNativeApp()`), novo `utils/native/back-button.ts`, integração com o router.
- **Risco:** MÉDIO — interação com bottom sheets/modais (voltar deve fechar o sheet aberto antes de navegar).
- **AC `[device]`:** voltar fecha sheet aberto → senão volta tela → na raiz pede confirmação; nunca sai "do nada"; Web inalterado.
- `P0 · M · MÉDIO · ALTA`

#### N4 — Persistência: refletir a realidade nativa **[MÉDIO]**
- **Desejado:** no APK, sumir com o banner "seus dados podem ser perdidos" e com o toggle "Armazenamento persistente" (são irrelevantes — dado nativo é durável). No Web continua como hoje.
- **Abordagem:** `isNativeApp()` ⇒ tratar como persistido. Esconder o banner de backup-urgente e o item de Ajustes; o backup manual continua existindo (é útil em qualquer plataforma — só some o alarme de "vai perder").
- **Arquivos:** `SettingsPage.tsx`, o componente do banner (backup), `utils/pwa.ts`/`platform.ts`.
- **AC:** APK sem banner de perda e sem toggle de persistência; Web idêntico ao de hoje; backup manual permanece nas duas plataformas.
- `P1 · S · BAIXO · ALTA`

#### N5 — Permissão de GPS nativa (registrar local do gasto) **[ALTO]**
- **Desejado:** ao ativar "registrar local", o app **pede a permissão** nativa; concedida → captura coords; negada → mensagem clara (e não fica em silêncio).
- **Abordagem:** `@capacitor/geolocation` (`checkPermissions`/`requestPermissions`/`getCurrentPosition`) atrás do boundary. `getCurrentCoords` passa a usar o plugin quando nativo; no Web mantém `navigator.geolocation`. Adicionar `ACCESS_FINE/COARSE_LOCATION` no manifest. Tratar negação com feedback (hoje engole o erro).
- **Arquivos:** `utils/geolocation.ts` (boundary), `AndroidManifest.xml`, ponto de UI onde liga a captura (Ajustes/quick-add).
- **AC `[device]`:** primeiro uso dispara o diálogo do Android; concedido → coords no gasto; negado → toast explicando; offline ok; coords nunca saem do device.
- `P1 · M · MÉDIO · ALTA`

#### N6 — Notificações nativas (base que FUNCIONA) **[ALTO]**
- **Desejado:** a tela de notificações para de dizer "navegador não suporta"; passa a pedir permissão nativa e a disparar notificações reais (ainda simples nesta fase — base pro Now Bar vir na Track B).
- **Abordagem:** `@capacitor/local-notifications`: permissão `POST_NOTIFICATIONS` (Android 13+), canais, `schedule`, action buttons. `utils/notifications.ts` vira boundary que escolhe nativo×web. Migrar `outing-notification.ts` (hoje via SW) pro caminho nativo quando `isNativeApp()`.
- **Arquivos:** `utils/notifications.ts`, `domain/outing/outing-notification.ts` (mantém puro; só troca o adapter), `SettingsPage` (texto/estado), `AndroidManifest.xml`.
- **Risco:** MÉDIO — não regredir o comportamento Web/PWA atual.
- **AC `[device]`:** APK pede permissão; dispara notificação de saída ativa com pelo menos 1 botão; Web/PWA mantém o que tem.
- `P1 · L · MÉDIO · MÉDIA`

#### N7 — Calibração de escala/DPI **[device]** **[MÉDIO]**
- **Desejado:** tamanho/proporção iguais ao que o Julio espera (um "zoom" pra cima — hoje está pequeno).
- **Abordagem:** **medir primeiro** no APK (logar `innerWidth`, `devicePixelRatio`, `visualViewport`) e comparar com o PWA. Depois escolher a alavanca de menor risco:
  - se `innerWidth` está maior que o baseline de design → ajustar a meta viewport no nativo (ex.: largura base) **ou** `setInitialScale`/`webView.settings.textZoom` no `MainActivity`;
  - evitar `transform: scale()` global (quebra `position:fixed`/100vh).
- **Arquivos:** `MainActivity` (Kotlin/Java) e/ou injeção de viewport no nativo; doc de medição.
- **Risco:** MÉDIO — empírico; pode exigir 2 iterações no aparelho.
- **AC `[device]`:** alvos de toque e tipografia no tamanho esperado; sem scroll horizontal; sem corte de layout.
- `P1 · M · MÉDIO · MÉDIA`

#### N8 — Feedback háptico **[MÉDIO]** (brainstorm em §3.2)
- **Desejado:** vibrações curtas em interações-chave (abrir menu por long-press, tocar no "+", confirmar, trocar aba, etc.).
- **Abordagem:** `@capacitor/haptics` atrás de `utils/haptics.ts` (`tapLight/medium`, `success/warning/error`, `selectionChanged`). No-op no Web. Respeitar uma preferência (Ajustes) e `prefers-reduced-motion`/acessibilidade. Mapa de gatilhos em §3.2.
- **Arquivos:** `utils/haptics.ts`, pontos de interação (FAB, long-press `useMultiSelect`, toggles, toasts de sucesso/erro, tabs).
- **AC `[device]`:** gatilhos do §3.2 vibram sutilmente; toggle em Ajustes desliga tudo; Web sem efeito/erro.
- `P2 · M · BAIXO · ALTA`

---

### TRACK B — Notificações avançadas (Live Update / Now Bar) — a ambição
> Detalhe técnico completo em `android-native-strategy-2026-06-15.md` (Fase B). Resumo de escopo aqui.

#### B1 — Notificação "viva" da saída ativa (ProgressStyle / Live Update)
- Notificação ongoing, com progresso/gasto da saída em tempo real, **cor do app**, botões (registrar rodada, encerrar), atualizável.
- **Abordagem:** módulo nativo Kotlin (Notification `ProgressStyle` Android 16 + fallback custom layout/`MediaStyle` em versões antigas) + Foreground Service; ponte Capacitor (plugin custom) chamada pelo domínio de saída.
- **Deps/manifest:** `FOREGROUND_SERVICE` (+ `FOREGROUND_SERVICE_*`), canal dedicado.
- `P2 · XL · ALTO · MÉDIA`

#### B2 — Integração Now Bar (Samsung) / suporte a fabricantes
- Aproveitar a Live Update na Now Bar (Samsung One UI) — **verificar disponibilidade real por device** (NOT VERIFIED até testar em Samsung).
- `P3 · L · ALTO · BAIXA`

> **Sequenciamento:** Track B só começa **depois** de N6 (base de notificação nativa) sólida.

---

### TRACK U — UX / IA (camada web; alinhado ao DEC-180)

#### U1 — Reorganizar a Página de Notificações
- **Desejado:** sair da lista gigante → agrupar (ex.: seções "Hoje / Esta semana / Antes" ou por tipo) com cabeçalhos; possibilidade de cards/quadrados.
- **Arquivos:** `features/notifications/NotificationsPage.tsx`.
- **AC:** sem perda de nenhuma notificação/ação; agrupamento claro; "marcar lida"/navegação preservados.
- `P2 · M · BAIXO · ALTA`

#### U2 — Viagem › Estrutura: lista → grid
- **Desejado:** os tiles de Estrutura (Fases/Perfis/Pessoas/Carteiras…) em **grid** (≈2 col), não lista.
- **Arquivos:** `features/trip/TripHubPage.tsx` (`structureItems` render).
- **AC:** todos os destinos atuais presentes; navegação igual; visual consistente com o resto.
- `P3 · S · BAIXO · ALTA`

#### U3 — Copiloto › Ferramentas: lista → grid (DECIDIR — §3.3 mini)
- **Contexto:** a lista tem `desc` embaixo (o Julio achou que faz sentido). Avaliar grid 2-col com ícone+label+desc curto **ou** manter lista.
- **Arquivos:** `features/copilot/CopilotPage.tsx` (`tools`).
- **AC:** todas as ferramentas presentes; se virar grid, `desc` legível; sem regressão de navegação.
- `P3 · S · BAIXO · MÉDIA`

#### U4 — Mapa do mês: tap no dia → sheet flutuante (não pular pra Gastos)
- **Desejado:** tocar num dia abre um **sheet** mostrando o que gastou naquele dia (simples); botão "ver gastos do dia" aí sim leva à lista filtrada.
- **Arquivos:** `features/dashboard/cards/HeatmapCard.tsx`, `CopilotPage.tsx`, reutilizar `BottomSheet`.
- **AC:** tap = sheet (não navega); sheet lista gastos do dia + total; botão leva à lista filtrada por aquele dia; fechar volta ao mapa.
- `P2 · M · BAIXO · ALTA`

#### U5 — Mover "Análise do dia/viagem" da Início → Copiloto (fecha DEC-180 G4)
- **Desejado:** recap de ontem + burndown/ritmo saem da Início e ficam no Copiloto (inteligência). Mapa do mês já está no Copiloto.
- **Abordagem:** mover conteúdo do card `trip_analytics` (recap+burndown) pro Copiloto (junto do heatmap/ritmo); remover a gaveta da Início. Garantir que nada some (anti-regressão DEC-180 §0.4).
- **Arquivos:** `domain/dashboard/dashboard-cards.ts` (catálogo), `DashboardCards.tsx`, `CopilotPage.tsx`, `cards/RecapCard.tsx`, `cards/BurndownCard.tsx`.
- **AC:** Início sem a análise; Copiloto com recap+burndown+mapa+ritmo agrupados; config de cards atualizada sem quebrar `DashboardConfigPage`.
- `P2 · M · MÉDIO · ALTA`

#### U6 — Contadores de ocasião: modelo unificado (Conselho §3.1)
- **Desejado:** **todas as subcategorias** aparecem. Com meta planejada → "X restantes · Y feitas" (planejadas primeiro). Sem meta → só a contagem de itens ("Y gastos de passeio"), pra **todas**, não só 3.
- **Arquivos:** `features/dashboard/useDashboardModel.ts` + `domain/dashboard/dashboard-cards.ts` (auditar fórmula atual), `cards/OccasionCounter.tsx` (suportar 2 modos), i18n.
- **Risco:** MÉDIO — mistura de unidades (ocasião × item). Resolver com rótulo explícito e/ou seção (ver §3.1).
- **AC:** planejadas com meta na frente (restantes/feitas); sem-meta com contagem de itens; unidade clara; teste de domínio com números reais.
- `P2 · M · MÉDIO · MÉDIA` — **depende de decisão do Julio (§8 Q1)**

---

### TRACK G — Gestos & busca/descoberta

#### G1 — Navegação por gestos (swipe) (Conselho §3.3)
- **Desejado:** swipe horizontal: Gastos↔Saídas (abas), entre fases na Viagem, e (stretch) entre seções da barra inferior.
- **Abordagem faseada:**
  - **G1a (confiável):** swipe entre abas segmentadas (Gastos/Saídas) e entre fases (seletor de fase da Viagem) — área de conteúdo, sem conflito com chips horizontais. Hook leve de pointer + `scroll-snap`/`translate`, respeitando `prefers-reduced-motion`.
  - **G1b (stretch):** swipe entre seções da bottom-nav só na **borda da tela** e quando não há scroll horizontal sob o dedo (chips!). Guardas contra disparo acidental.
- **Arquivos:** novo `hooks/useSwipeNavigation.ts`, `ExpenseListPage.tsx`, hub de fases (`TripHubPage`/`TripOverviewPage`), AppShell (G1b).
- **Risco:** ALTO (G1b) — conflito com scroll, acessibilidade, transição de rota. Preferir solução leve (sem dep pesada — hygiene GAP-034).
- **AC `[device]`:** G1a fluido e previsível; sem conflito com a barra de chips/listas; G1b atrás de flag, só se passar no teste de não-disparo acidental.
- `P2(G1a)/P3(G1b) · L · ALTO · MÉDIA`

#### G2 — Busca de gastos
- **Desejado:** campo de busca por descrição/valor (e talvez lugar/categoria) na lista de Gastos.
- **Abordagem:** input de busca no `page-sticky-header`; filtro client-side sobre `transactions` (já em memória); combina com os filtros/chips existentes; debounce.
- **Arquivos:** `features/expenses/ExpenseListPage.tsx`, i18n.
- **AC:** busca filtra a lista agrupada por dia; combina com chips; limpar restaura; sem perda dos filtros atuais.
- `P2 · M · BAIXO · ALTA`

#### G3 — Fast-scroll tipo Google Fotos (scrubber por dia) **[device-feel]**
- **Desejado:** arrastar uma barra de rolagem que "pula" por dias, mostrando sob o dedo o dia atual.
- **Abordagem:** scrollbar custom à direita; ao arrastar, mostra bolha com o dia (a lista já é agrupada por dia — reaproveitar `expenseGroups`). Virtualização opcional se a lista crescer muito.
- **Arquivos:** `ExpenseListPage.tsx`, novo componente `DayScrubber`.
- **Risco:** MÉDIO — sensação depende de teste no aparelho.
- **AC `[device]`:** arrastar navega por dias com indicador; toque normal inalterado; performático com muitos dias.
- `P3 · L · MÉDIO · MÉDIA`

---

## 3. Conselho & Brainstorm (decisões com trade-off)

> Conduzido inline (regra do projeto: sem subagentes). Perspectivas: **Arquiteto**, **Simplificador**, **Defensor do usuário**, **Crítico**.

### 3.1 — Modelo dos contadores de ocasião (U6) — **CONSELHO**
**Tensão central:** o card mistura duas unidades — **ocasião/sessão** (uma "noite de bar" = uma saída planejada) e **item/lançamento** (gastos avulsos por subcategoria). O Julio quer ver tudo, mas sem confundir.

- **Arquiteto:** são dois conceitos. Ou unifica com a unidade explícita no rótulo, ou separa em dois grupos. Misturar sem rótulo = bug de percepção (foi o que aconteceu).
- **Simplificador:** um card só, duas seções rotuladas. Topo "Metas de ocasião" (planejadas: restantes/feitas). Abaixo "Atividade por categoria" (todas as subcats com itens: só contagem). Cada tile já carrega a unidade ("4 restantes" vs "8 gastos").
- **Defensor do usuário:** ele AMA o card (ÂNCORA 10). Não pode ficar pesado. Manter carrossel/scroll-snap; planejadas primeiro (com meta), sem-meta depois.
- **Crítico:** cuidado com card infinito (toda subcategoria com 1 gasto vira tile). Limitar a subcats com atividade > 0 OU com meta; talvez top-N + "ver todas".

**Recomendação (Confiança MÉDIA-ALTA):**
1. Um card, **ordenação:** (a) subcats com meta → tile "X restantes · Y feitas" (unidade = ocasião); (b) subcats sem meta com atividade → tile "Y" + "gastos de \<subcat\>" (unidade = item).
2. **Unidade sempre explícita** no sublabel pra nunca confundir os dois mundos.
3. Limite/agrupamento pra não explodir (subcats sem atividade não aparecem).
4. **DECIDIDO (Julio, 15/06):** **card único em carrossel** (scroll-snap, como hoje — ÂNCORA 10). Ordem: **primeiro as metas** (subcats planejadas: "X restantes · Y feitas"), **depois a atividade por categoria** (subcats sem meta: contagem de itens). **Cada tile traz o rótulo da unidade** ("4 restantes" vs "8 gastos de passeio") pra nunca confundir ocasião × item.

### 3.2 — Mapa de gatilhos hápticos (N8) — **BRAINSTORM**
| Interação | Tipo de háptico |
|---|---|
| Long-press abre menu de seleção (`useMultiSelect`) | `impact medium` |
| Tocar no FAB "+" / abrir ações | `impact light` |
| Selecionar/desselecionar item (multi-select) | `selectionChanged` |
| Trocar aba (Gastos/Saídas) / swipe completo | `selectionChanged` |
| Confirmar/salvar gasto, encerrar saída | `notification success` |
| Erro de validação / ação bloqueada | `notification warning/error` |
| Deletar (antes do confirm) | `impact medium` |
| Atingir meta/cofrinho, marco | `notification success` |
| Pull-to-refresh disparado | `impact light` |
- **Governança:** toggle "Vibração" em Ajustes (default on no nativo); no-op no Web; respeitar acessibilidade. **Não** vibrar em tudo (fadiga) — só nos gatilhos acima.

### 3.3 — Navegação por gestos (G1) — **CONSELHO**
- **Defensor:** swipe entre abas/fases deixa o app "de verdade" — alto valor, baixo custo.
- **Crítico:** swipe entre **seções da barra** conflita com chips horizontais, carrosséis (ocasiões/insights) e a barra de lugares — disparo acidental e perda de scroll. Acessibilidade e transição de rota complicam.
- **Arquiteto:** fazer em camadas. G1a (abas/fases, contido) primeiro. G1b (cross-section) só com guardas fortes (borda da tela; abortar se há `overflow-x` sob o ponto) e atrás de flag.
- **Simplificador:** nada de lib pesada (hygiene). Hook próprio de pointer + `translate`/`scroll-snap`.

**Recomendação:** G1a já (ALTA confiança). G1b experimental, atrás de flag, validado no aparelho (MÉDIA). **Mini-decisão U3 (grid de ferramentas):** manter lista com `desc` **ou** grid 2-col — recomendo testar grid 2-col mantendo o `desc` curto; reversível.

### 3.4 — Escala/DPI (N7) — **RISCO/MÉTODO**
- Não dá pra "chutar" o fator no escuro. **Método:** (1) instrumentar e medir no APK; (2) comparar com baseline; (3) aplicar a alavanca de menor risco (viewport/textZoom/initialScale); (4) re-testar no aparelho. Evitar `transform: scale()` global. Confiança MÉDIA até medir.

---

## 4. Plano de fases (quando fazer) — gates

> Padrão de hardening do projeto: cada gate fecha com **testes verdes + build web + (quando aplicável) APK reinstalado + dev-log atualizado + commit/deploy**. Telas `[device]` exigem APK no celular real.

### Fase 1 — "App nativo correto" (Track N) · **P0/P1** · ~1 APK novo
Ordem: **N0 → N1 → N2 → N3 → N4 → N5 → N6 → N7 → N8**.
- **Gate 1A (layout/sistema):** N0, N1, N2, N3 → status bar e voltar 100% certos. APK de validação.
- **Gate 1B (permissões/serviços):** N4, N5, N6 → persistência coerente, GPS pede permissão, notificação nativa dispara. APK.
- **Gate 1C (sensação):** N7, N8 → escala calibrada + haptics. APK.
- **Saída:** o app "parece nativo e correto". Destrava feedback honesto do Julio sobre o resto.

### Fase 2 — UX/IA quick wins (Track U + G2) · **P2/P3** · Web + APK
- U5 (análise→Copiloto, fecha DEC-180 G4) → U1 (notificações) → U2 (grid Estrutura) → U4 (sheet do dia) → U6 (contadores, após Q1) → G2 (busca) → U3 (grid ferramentas).
- Mistura de fechamento do DEC-180 e melhorias de IA. Maioria é web → deploy contínuo.

### Fase 3 — Interações ricas (Track G) · **P2/P3** · `[device]`
- G1a (swipe abas/fases) → G3 (fast-scroll) → G1b (swipe cross-section, experimental).
- Exigem muito teste no aparelho; entram depois do app estar correto e da IA estável.

### Fase 4 — Notificações ambiciosas (Track B) · **P2/P3** · Kotlin nativo
- B1 (Live Update/ProgressStyle + foreground service) → B2 (Now Bar/Samsung, a verificar).
- Maior esforço/risco; só após N6 sólido. É o "uau" do projeto.

> **Por que esta ordem:** primeiro o app **correto** (Fase 1), porque os bugs nativos contaminam qualquer outro julgamento; depois **clareza/IA** (Fase 2), barata e de alto valor; depois **gestos** (Fase 3), que dependem de base estável; por fim a **ambição** de notificação (Fase 4), cara e isolável.

---

## 5. Dependências técnicas (instalar/configurar)

**Plugins Capacitor (oficiais):**
- `@capacitor/status-bar` (N1/N2) · `@capacitor/app` (N3) · `@capacitor/geolocation` (N5) · `@capacitor/local-notifications` (N6) · `@capacitor/haptics` (N8).
- (Track B) plugin **custom** Kotlin para Live Update/Now Bar.

**AndroidManifest (permissões):**
- `ACCESS_FINE_LOCATION` + `ACCESS_COARSE_LOCATION` (N5)
- `POST_NOTIFICATIONS` (N6, Android 13+)
- `VIBRATE` (N8 — normalmente já vem pelo plugin)
- (Track B) `FOREGROUND_SERVICE` + `FOREGROUND_SERVICE_DATA_SYNC`/`SPECIAL_USE`

**Boundaries novos (isolar nativo do domínio):** `utils/native/index.ts` (`isNativeApp`), `utils/native/status-bar.ts`, `utils/native/back-button.ts`, `utils/haptics.ts`; estender `utils/geolocation.ts` e `utils/notifications.ts`. Domínio (`domain/**`) permanece puro e testável.

**Processo de cada ciclo nativo:** `npm run build` → `npx cap sync android` (Node 22) → Gradle `assembleDebug` → reinstalar APK (já documentado em `android-native-strategy`/script `setup-android-toolchain.sh`).

---

## 6. Decisões propostas (PENDENTES de aprovação do Julio)

> Numeradas a partir de **DEC-191** (DEC-185..190 já estão *propostas* em `android-native-strategy`). Nada vira "decidido" até entrar no `decision-log.md`.

- **DEC-191 (proposta):** No app nativo, comportamentos divergentes do Web passam por um único `isNativeApp()`; nenhum import de plugin fora de `utils/native/**`.
- **DEC-192 (proposta):** Edge-to-edge tratado por safe-area no topo + StatusBar plugin; status bar segue o tema (substitui o efeito que a meta `theme-color` tinha só no PWA).
- **DEC-193 (proposta):** Botão voltar nativo controlado por `@capacitor/app` (fecha sheet → volta tela → confirma saída na raiz); hack `useBackButtonGuard` só no Web.
- **DEC-194 (proposta):** No nativo, persistência é garantida → banner de perda e toggle de persistência ocultos (backup manual permanece).
- **DEC-195 (proposta):** GPS e notificações via plugins nativos (permissões no manifest); domínio inalterado, só troca de adapter.
- **DEC-196 (proposta):** Contadores de ocasião = **card único em carrossel**; metas (planejadas: restantes/feitas) primeiro, depois atividade por categoria (sem-meta: contagem de itens); **unidade explícita em cada tile** (Q1 DECIDIDA por Julio em 15/06).
- **DEC-197 (proposta):** Análise/inteligência sai da Início e consolida no Copiloto (fecha DEC-180 G4).
- **DEC-198 (proposta):** Haptics governados por toggle em Ajustes, com mapa de gatilhos curados (§3.2).
- **DEC-199 (proposta):** Navegação por gestos em camadas: abas/fases já; cross-section atrás de flag.

---

## 7. Estimativa (Tier 3 — velocity-standard)

| Fase | Itens | Estimativa bruta | Tier 3 (÷3) |
|---|---|---|---|
| 1 — Native correto | N0–N8 | ~36–48h | **~12–16h** |
| 2 — UX/IA | U1–U6, G2 | ~30–40h | **~10–13h** |
| 3 — Gestos | G1, G3 | ~24–32h | **~8–11h** |
| 4 — Notif. ambição | B1, B2 | ~40–60h | **~13–20h** |

> Fases 1–3 são as de maior retorno imediato (~30–40h Tier 3). Fase 4 é isolável e pode esperar.

---

## 8. Perguntas para o Julio — RESPONDIDAS (15/06/2026)

> **Decisões tomadas:**
> - **Q4 (ordem):** Fase 1 (app nativo correto) primeiro. ✅
> - **Q1 (contadores):** card único em carrossel; metas primeiro, atividade por categoria depois, com rótulo de unidade. ✅ (ver §3.1 / DEC-196)
> - **Q3 (gestos):** G1a (abas/fases) agora; G1b (cross-section) depois, atrás de flag. ✅
> - **Q2 (ferramentas Copiloto):** entregar em **grid 2-col com descrição** pra avaliação. ✅
> - **Q5 (Live Update/Now Bar):** detalhar o protótipo técnico **agora** → `live-update-nowbar-technical-spec-2026-06-15.md`. ✅

### Registro original das perguntas

- **Q1 — Contadores de ocasião:** card único com 2 grupos ("Metas" + "Atividade por categoria") **ou** separar (metas na Início, atividade por categoria no Copiloto)? (afeta U6/DEC-196)
- **Q2 — Ferramentas do Copiloto (U3):** testar grid 2-col (com texto) **ou** manter lista? (reversível — posso entregar grid e você decide vendo)
- **Q3 — Swipe cross-section (G1b):** topo de prioridade agora **ou** deixar como experimento depois do swipe de abas/fases (G1a)?
- **Q4 — Ordem de ataque:** confirmar Fase 1 (app nativo correto) primeiro? É a minha recomendação forte.
- **Q5 — Notificação avançada (Track B):** quer que eu já detalhe o protótipo do Live Update na próxima leva, ou só depois das Fases 1–2?

---

## 9. Checklist anti-regressão (aplicar em cada gate)

1. **Web/PWA intacto:** toda mudança nativa atrás de `isNativeApp()`; rodar o app no browser e confirmar comportamento de hoje.
2. **`.ts` apenas** (nunca editar `.js` compilado).
3. **Domínio puro:** nenhuma regra de negócio passou a depender de plugin nativo.
4. **Testes:** suíte unit verde (0 falhas, manter ≥898); funções financeiras com teste de números reais; novos domínios (contadores) com teste de matemática.
5. **Build:** `tsc --noEmit` + build web sem erro; `cap sync` + APK compila.
6. **Anti-regressão de telas (DEC-180 §0.4):** nenhuma função/informação some — só muda de lugar/forma.
7. **`[device]`:** itens marcados validados com APK reinstalado no celular real.
8. **dev-log + versão:** bump de versão e entrada no dev-log por gate.

---

> **Estado (15/06):** decisões da §8 tomadas. Artefatos derivados criados:
> - `phase1-native-execution-package-2026-06-15.md` — pacote executável da Fase 1 (gates 1A/1B/1C, milestones, ACs, self-checks).
> - `live-update-nowbar-technical-spec-2026-06-15.md` — spec técnica do Live Update/Now Bar (Q5).
>
> **Próximo passo:** com o aval do Julio para instalar os plugins nativos (mudança de alto impacto — 5 deps + manifest), começar por **M1A.0 (fundamentos)** → **M1A.1 (safe-area no topo)**, o "primeiro problema a arrumar".
