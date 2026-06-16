# Master Plan — Field Feedback Round (2026-06-16)

> Base: lista detalhada do Julio (18 itens) após o arco nativo + Wise (v0.40.0).
> Decisões tomadas via AskQuestion (2026-06-16). Conselho rodado inline (regra
> `tech-lead-delegation.mdc` proíbe subagents). Versão de partida: **0.40.0**.
> Princípio inegociável: **ZERO regressão** — nada some, pode mudar de lugar/forma.

## Decisões do Julio (locked)

| # | Item | Decisão |
|---|------|---------|
| 18 | "Livre para usar" | Hero = **livre de verdade** (desconta o plano do planejador), total da fase como secundário + breakdown atualizado. Anti-dupla-contagem obrigatório. |
| 17 | Check-in | Vira **lente com efeito real** no número de HOJE (projeção, NÃO grava — preserva ÂNCORA 12) + card mais compacto. |
| 8 | P2P/worker | **Caixa postal efêmera criptografada** (assíncrono; o outro pega ao abrir; TTL; sem contas; servidor não lê nada). Sem push. |
| 14 | Wise TRANSFER | Detectar + classificar (carteira/dívida com match de nome/expense/dividir) + **quebrar 1 transferência em várias**. Sempre confirmando. |
| 16 | Layout home | **Curado**: cards compactos pareáveis 2/linha na config; ricos seguem largura cheia. |
| 3 | Zerar app | Ponto de restauração + backup, depois **2 opções**: apagar tudo (→onboarding) OU manter estrutura e limpar lançamentos. |
| 4 | Configurações | **Página única** com **busca + seções recolhíveis**. |
| 13 | Importação | **Topo da tela de Gastos** + manter também em Carteiras. |
| 5 | Meta de economia | **Editável pelo card** na home + atalho em Ajustes. |
| 2 | Swipe entre abas | **Sim, global** (Início↔Gastos↔Viagem↔Copiloto) com handoff e sem conflitar com carrosséis. |

Bugs (sem pergunta): 1 (swipe do fundo), 6 (enviar backup nativo), 7 (salvar
backup), 9 (foco abaixo do check-in), 10 (valor da notif na saída), 11 (zoom da
saída), 12 (telas abrem roladas), 15 (recentes compactos).

## Rodada 2 — feedback de campo (2026-06-16, pós-G3)

| # | Item | Decisão / status |
|---|------|------------------|
| 19 | Mapa diário | **FEITO (0.45.0)**. Ao tocar no hero ("livre nesta fase"), a sheet do breakdown ganha um mapa por dia: barra proporcional por dia restante da fase (picos do fim de semana maiores), valor livre do dia, reservas datadas (eventos/compras com data) por baixo e planejados sem data à parte. Mesma matemática do `calculateTodayFreeBudget` (base = trueFree + gasto de hoje, distribuída pelos pesos de ritmo). Copy do hero virou "X na fase − Y no plano" (subtração explícita). Domínio puro `buildPhaseAllowanceMap` + 8 testes. |
| 20 | Atualização OTA | **PENDENTE DE DECISÃO** (ver G8). Hoje o APK serve assets locais (sem `server.url`), então deploy web no Cloudflare NÃO chega no app instalado — a versão interna fica congelada no build. "Buscar atualização" só funciona no PWA do navegador. |

### Diagnóstico OTA (item 20) — confirmado no código
- `capacitor.config.ts`: sem `server.url` → WebView carrega `dist` empacotado (`https://localhost`). `checkForAppUpdate()` (`utils/pwa.ts`) chama `reg.update()`, que rebusca o `/sw.js` LOCAL → nunca muda. Por isso a versão interna não sobe no APK.
- `@capacitor/app` (já instalado) expõe `App.getInfo()` → `version`/`build` nativos do APK — base para detectar "APK desatualizado".
- Solução OTA real e offline-first: plugin live-update `@capgo/capacitor-updater` (MPL-2.0, Capacitor 8, self-hosted). Hospedar `dist.zip` + manifesto `latest.json` (com `version`, `url`, `requiredNativeVersion`) no próprio Pages. OTA cobre só HTML/CSS/JS; mudança nativa exige novo APK → o manifesto declara o `requiredNativeVersion` e o app avisa quando o APK instalado é mais antigo. Custa 1 APK para introduzir o plugin; depois, releases só-web sobem pela internet.

## Causas-raiz confirmadas

- **1/2 swipe**: `useHorizontalSwipe` preso ao conteúdo (Gastos/Viagem). Fundo é do `AppShell` (sem handler). → subir paginação de abas pro `AppShell`.
- **12 scroll**: não há `<ScrollRestoration/>` no router v7 → telas abrem na posição anterior.
- **18 livre**: `calculateFreeToSpend` calcula `allocationsCents` mas **não subtrai** (budget.ts L63-65 vs L84-92). Planejador subtrai → 988 vs 574.
- **17 check-in**: `planCheckInDay` é read-only (ÂNCORA 12). Vira projeção do "hoje".
- **6/7 backup**: `downloadFile` usa `navigator.share({files})` que falha no WebView → cai no download. Precisa `@capacitor/share` + `@capacitor/filesystem`.
- **8 worker**: relay efêmero 2-peers ao vivo, zero storage. → adicionar mailbox (DO storage + alarm TTL).
- **11 zoom**: `html.cap-native #root { zoom: 1.06 }` provável interação com overflow na OutingPage tela cheia.

## Gates (cada um: testes verdes + build + commit + deploy; APK quando nativo)

### G1 — Navegação & continuidade [web]
- Swipe global entre as 4 abas no `AppShell`, ignorando scrollers horizontais
  (carrosséis) e regiões `[data-inpage-swipe]`; Gastos/Viagem mantêm swipe
  interno + **handoff** na borda para a aba vizinha.
- `<ScrollRestoration/>` no `RootLayout` (reset no avanço, restaura no voltar).
- Gastos recentes na home: peek compacto (3 itens densos) + "ver todos".
- AC: swipe do fundo funciona; troca de aba por swipe; carrossel não dispara
  troca de aba; sub-telas abrem no topo; recentes ocupam ~metade do espaço.

### G2 — Números da home (o coração) [web, domain-heavy]
- `calculateFreeToSpend`: novo termo `allocationsRemainingCents` =
  max(0, alocações − gasto real já feito nas categorias planejadas) e subtrai do
  livre (anti-dupla-contagem). Hero = livre de verdade; linha secundária "total
  na fase"; breakdown ganha a linha de alocações.
- Check-in lente: `planCheckInDay` passa a reenquadrar o **"livre hoje"** exibido
  (tranquilo baixa hoje e mostra +€/dia futuro; sem-gastos zera hoje; noite
  reserva parte) — projeção, nunca grava. Card compacto (resultado enxuto).
- Card-foco abaixo do check-in: render do card destacado pela lente logo após o
  check-in.
- AC: hero da home == margem livre do planejador; gastar na categoria planejada
  não conta duas vezes; check-in muda visivelmente o "hoje"; nenhuma gravação.

### G3 — Importação visível + Wise transfer [web]
- Importação: entrada no topo de Gastos (ícone) + manter em Carteiras; copy
  "Importar gastos/movimentações".
- Wise: novo kind `transfer` para linhas TRANSFER com pessoa. Review permite
  classificar cada uma: transferência entre carteiras / pagar dívida (match de
  nome → participante; listar dívidas p/ marcar pagas) / gasto / dividir /
  ignorar. **Split**: alocar 1 transferência em vários alvos (dívida + gastos).
- AC: TRANSFER não vira gasto automático; match sugere participante; marcar
  dívida paga gera settlement; split soma exatamente o valor da transferência.

### G4 — Configurações + Meta + Layout [web] — **FEITO (0.46.0)**
- Configurações: página única com campo de busca (filtra seções) + seções
  recolhíveis (estado persistido). Nada removido.
- Meta de economia: editável pelo card `savings_goal` (sheet) + atalho em Ajustes.
- Layout: cards "compactos" pareáveis 2/linha na config de dashboard; render em
  grid quando 2 compactos adjacentes estão marcados como par.
- AC: toda config achável; meta editável da home; pares aparecem 2/linha,
  responsivo, sem quebrar os cards ricos.
- **Entregue**: `SettingsPage` virou página única — header de busca multilíngue
  (label + keywords por seção) + 7 grupos recolhíveis `CollapsibleGroup` (estado
  em `localStorage`, abre forçado e auto-oculta na busca; "nada encontrado" com a
  query). Card `savings_goal` abre `SavingsGoalSheet` (editar/remover; ÂNCORA 11,
  read-only — nunca toca no orçamento); atalho em Ajustes › Dinheiro intacto.
  Grade 2-up curada: flag `pairable` no catálogo (`savings_goal`, `piggy_bank`,
  `planned_purchases`, `funds_summary`), opt-in por card
  (`dashboardPairedCards` em AppSettings; backfill/seed) via long-press e
  "Configurar tela inicial". Domínio puro `groupDashboardRows` (só pareia
  compactos adjacentes, opt-in e COM conteúdo; o card-foco do dia segue cheio).
  Tiles compactos uniformes + 20 testes (catálogo + grupos). 1012 testes verdes.

### G5 — Caixa postal P2P [worker + web] — FEITO (0.47.0)
- Worker: endpoints de mailbox por `actorId` (POST guarda blob cifrado + TTL via
  alarm; GET drena). DO com storage; caps de tamanho/quantidade.
- Cliente: "enviar divisão"/"enviar backup" assíncrono p/ um par pareado; ao
  abrir o app, drena a caixa e aplica (preview p/ backup; confirmar p/ dívida).
- AC: enviar com o outro offline; ele recebe ao abrir; E2E mantém (servidor só
  vê bytes); expira por TTL.
- ENTREGUE: `Mailbox` Durable Object (`/mailbox/:actorId`, chunk 120 KB, caps
  40/4MB/1MB, TTL 7d por `alarm`, guarda só ciphertext) — migration v2, deployado
  + smoke-test curl. Cripto E2E `domain/sync/ecies.ts` (ECDH P-256 efêmero →
  HKDF-SHA256 → AES-256-GCM); identidade extraível (JWK) em `AppSettings.deviceIdentity`
  (viaja no backup → restaurar mantém pareamento, adota `actorId` via `setInstallationId`).
  QR de identidade += `pk`; `PeerLink.publicKey`. Fila local `mailboxQueue` (schema v7,
  fora do backup). Boot drena em `utils/mailbox-boot.ts` (boot+online+foreground, 30s
  throttle). Decisões Julio: caixa LIGADA por padrão (toggle em Ajustes › Dados),
  chave no backup, sempre preview/confirm. UI: enviar divisão em Compartilhados;
  inbox de backup + enviar p/ aparelho em Backup. i18n pt/en/es. 1021 testes (+9 ECIES).
- Nota V1: divisão e backup vão one-way (resposta de confirmação da divisão segue
  no canal ao vivo); pares pareados antes da 0.47.0 precisam re-compartilhar o QR
  uma vez para capturar a chave pública.

### G6 — Backup enviar/salvar + zerar [web + native → APK]
- **Zerar app — FEITO (0.48.0, fatia web)**: em Ajustes › Dados e segurança —
  sempre exporta um backup JSON primeiro; "manter estrutura" também grava um
  restore point. Duas opções: "apagar tudo (→onboarding)" OU "manter estrutura e
  limpar lançamentos", com digitar-p/-confirmar. Orquestradores puros
  `resetKeepStructure`/`resetWipeAll` (1 transação Dexie) + 3 testes.
- **Enviar/salvar nativo — no lote do APK**: instalar `@capacitor/share` +
  `@capacitor/filesystem`. `downloadFile`/novo util: nativo escreve em Cache +
  Share (abre menu do celular); botão "Salvar no aparelho" → `Directory.Documents`.
  Web mantém share/download.
- AC: enviar abre o menu nativo; salvar grava arquivo; zerar faz backup antes e
  executa a opção escolhida atomicamente.

### G7 — Saída ativa [native → APK]
- Valor do botão da notificação chega na tela ativa: ponte nativa drena +
  dispara evento imediatamente (não só no resume).
- Zoom/sambando: corrigir overflow/viewport na OutingPage (provável interação com
  `#root { zoom }`); travar largura ao viewport.
- AC `[device]`: tap na notif reflete na tela na hora; tela cheia sem zoom/folga.

### G8 — Atualização OTA + consciência de versão (item 20) [web + native → APK]
> Pendente da decisão de abordagem (AskQuestion). Plano para a opção recomendada
> (Capgo self-hosted), em duas partes:
- **G8a (web, sem dep nativa) — FEITO (0.48.0)**: manifesto `public/version.json`
  no Pages (`version`, `requiredNativeVersion`, `apkUrl`, `notes`). Domínio puro
  `domain/version/version-check.ts` (`compareSemver`, `evaluateVersionStatus` →
  up_to_date / web_update_available / apk_outdated / unknown) + 14 testes.
  Boundary `utils/app-update.ts` (`App.getInfo()` lê o APK; fetch absoluto do
  manifesto). "Sobre o app" mostra versão interna (web) × versão do APK; "Buscar
  atualização" no nativo responde honesto (novidade web / APK desatualizado com
  link / em dia); no PWA segue o fluxo do service worker.
- **G8b (native → APK)**: instalar `@capgo/capacitor-updater`; no boot/`atBackground`
  buscar o manifesto, baixar o `dist.zip` e trocar o bundle (offline-first
  preservado, com rollback). Gate por `requiredNativeVersion`: se o APK for mais
  antigo que o exigido pelo bundle novo, NÃO troca às cegas — avisa para baixar o
  APK. Build step para gerar/publicar o zip + manifesto a cada release web.
- AC: release só-web chega no APK pela internet sem reinstalar; ao precisar de
  nativo, o app avisa "APK desatualizado (interno 45, APK exige 45, você tem 40)";
  rollback se o bundle quebrar; PWA do navegador segue igual.

## Pós-gates
- Worker deploy (G5) `wrangler deploy` em `worker/`.
- APK único cobrindo G6(nativo)+G7 (+G8b) (`npm run build` → `npx cap sync` → `assembleDebug`).
- Atualizar `project-status.md`, `decision-log.md` (novos DEC), `dev-log.md`.

## ⚠️ Correção de topologia de deploy (descoberta na 0.48.0)
- A branch de **produção** do projeto Cloudflare Pages é **`master`** (conectado
  ao Git), servida no apex **`trippilot.pages.dev`**. Deploys via CLI usando
  `--branch=main` caem como **Preview** (`main.trippilot.pages.dev`).
- Resultado: o apex de produção tinha ficado CONGELADO em `trippilot-v35`
  enquanto os builds reais (até v47) iam para o alias `main.` de Preview.
- Corrigido: a 0.48.0 foi publicada com `--branch=master` → o apex agora serve
  v48 + `/version.json`. O manifesto de versão (G8a) aponta para o apex.
- Daqui pra frente: deploy de produção com `--branch=master` (ou dar push do
  `master` local p/ o origin — local está 11 commits à frente — para o build do
  Git bater com o apex).

## Anti-regressão (verificar a cada gate)
- Insights = carrossel rotativo (DEC-091/077); ocasiões = carrossel; hero
  breakdown (DEC-168); ÂNCORA 12 (check-in não grava); ÂNCORA 11 (meta/cofrinho
  read-only); ÂNCORA 10 (nunca bloquear registro); ÂNCORA 13 (transferência entre
  pools conserva total).
