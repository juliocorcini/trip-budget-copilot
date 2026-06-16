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

### G4 — Configurações + Meta + Layout [web]
- Configurações: página única com campo de busca (filtra seções) + seções
  recolhíveis (estado persistido). Nada removido.
- Meta de economia: editável pelo card `savings_goal` (sheet) + atalho em Ajustes.
- Layout: cards "compactos" pareáveis 2/linha na config de dashboard; render em
  grid quando 2 compactos adjacentes estão marcados como par.
- AC: toda config achável; meta editável da home; pares aparecem 2/linha,
  responsivo, sem quebrar os cards ricos.

### G5 — Caixa postal P2P [worker + web]
- Worker: endpoints de mailbox por `actorId` (POST guarda blob cifrado + TTL via
  alarm; GET drena). DO com storage; caps de tamanho/quantidade.
- Cliente: "enviar divisão"/"enviar backup" assíncrono p/ um par pareado; ao
  abrir o app, drena a caixa e aplica (preview p/ backup; confirmar p/ dívida).
- AC: enviar com o outro offline; ele recebe ao abrir; E2E mantém (servidor só
  vê bytes); expira por TTL.

### G6 — Backup enviar/salvar + zerar [web + native → APK]
- Instalar `@capacitor/share` + `@capacitor/filesystem`. `downloadFile`/novo util:
  nativo escreve em Cache + Share (abre menu do celular); botão "Salvar no
  aparelho" → `Directory.Documents`. Web mantém share/download.
- Zerar app: em Ajustes › Dados — cria restore point + exporta backup, depois
  oferece "apagar tudo (→onboarding)" OU "manter estrutura e limpar lançamentos",
  com confirmação forte (digitar p/ confirmar).
- AC: enviar abre o menu nativo; salvar grava arquivo; zerar faz backup antes e
  executa a opção escolhida atomicamente.

### G7 — Saída ativa [native → APK]
- Valor do botão da notificação chega na tela ativa: ponte nativa drena +
  dispara evento imediatamente (não só no resume).
- Zoom/sambando: corrigir overflow/viewport na OutingPage (provável interação com
  `#root { zoom }`); travar largura ao viewport.
- AC `[device]`: tap na notif reflete na tela na hora; tela cheia sem zoom/folga.

## Pós-gates
- Worker deploy (G5) `wrangler deploy` em `worker/`.
- APK único cobrindo G6+G7 (`npm run build` → `npx cap sync` → `assembleDebug`).
- Atualizar `project-status.md`, `decision-log.md` (novos DEC), `dev-log.md`.

## Anti-regressão (verificar a cada gate)
- Insights = carrossel rotativo (DEC-091/077); ocasiões = carrossel; hero
  breakdown (DEC-168); ÂNCORA 12 (check-in não grava); ÂNCORA 11 (meta/cofrinho
  read-only); ÂNCORA 10 (nunca bloquear registro); ÂNCORA 13 (transferência entre
  pools conserva total).
