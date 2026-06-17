# Master Plan — Field Feedback Round 2 (2026-06-16)

> Base: segunda lista de campo do Julio após o APK 0.49.0 (arco nativo + Wise + OTA).
> Versão de partida: **0.49.0** · 1038 testes verdes · git limpo.
> Princípio inegociável: **ZERO regressão** — nada some; pode mudar de lugar/forma.
> Conselho rodado **inline** (regra `tech-lead-delegation.mdc` proíbe subagents).
> Decisões do Julio coletadas via AskQuestion (ver seção "Decisões pendentes").

---

## 0. Âncoras que NÃO podem ser violadas (relembrar a cada gate)

- ÂNCORA 8: privacidade — GPS bruto fica 100% local; mailbox é escape hatch.
- ÂNCORA 9: nada é removido, só escondido/movido (rotas e dados persistem).
- ÂNCORA 10: nunca bloquear registro; tudo offline-first; sugestão ≠ imposição.
- ÂNCORA 11: meta/cofrinho/savings são read-only — NUNCA entram no free-to-spend.
- ÂNCORA 12: check-in não grava; aprendizado não auto-escreve; recovery nunca preso.
- ÂNCORA 13: transferência entre pools conserva o total; Share Target revisa antes de salvar.
- ÂNCORA 14: simple mode só esconde; campos não-indexados não precisam de migração.

---

## 1. Inventário dos itens (mapa item → causa-raiz no código)

| ID | Item do Julio | Onde vive no código | Tipo |
|----|---------------|---------------------|------|
| F1 | Salvar backup na pasta **Downloads** (não Documents) | `utils/native/file-share.ts` `saveFileToDevice` usa `Directory.Documents` | bug nativo |
| F2 | Sumir com a barra de scroll (menos o FastScroller de Gastos) | `.no-scrollbar` existe mas não é global; root/html mostra scrollbar | CSS |
| F3 | Fechar card flutuante arrastando a alça pra baixo | `components/BottomSheet.tsx` só fecha por tap fora | UX |
| F4 | Mapa diário estilo **agenda/calendário** (como no copiloto) + clicar no dia detalha | `domain/phases/allowance-map.ts` (barras) + `DashboardSheets.PhaseDayMapSection` | feature |
| F5 | Cofrinho não precisa aparecer o tempo todo | card `piggy_bank` em `DashboardCards.tsx` (sempre que >0) | UX |
| F6 | Amigo sincero + divisões 2 por linha? | cards `amigo_sincero` / `pending_shares` (full-width) | UX |
| F7 | Gastos recentes ainda dá pra melhorar | card `recent_expenses` (peek de 3) | polish |
| F8 | Check-in ocupa muito espaço → mais discreto/integrado ao "livre hoje" | card `daily_checkin` + hero em `DashboardCards.tsx` | UX |
| F9 | Em Gastos, swipe esquerda→direita vai pra Início (deveria voltar p/ Gastos) | `ExpenseListPage` tabSwipe + `AppShell` pager global | bug |
| F10 | Transição arrastando a tela (dedo acompanha) | hoje é "decide no touch-end + slide CSS" (`AppShell`/`useTabPaging`) | feature (caro) |
| F11 | Configurações estilo Samsung (lista de categorias com ícone + descrição → subpágina) | `SettingsPage.tsx` (página única + busca + grupos recolhíveis) | redesign |
| F12 | TODAS as permissões pedíveis — câmera do QR não está liberada | `AndroidManifest.xml` sem `CAMERA`; `MainActivity` sem `onPermissionRequest` | bug nativo |
| F13 | Tirar o "esticar" de overscroll (ou localizar só no conteúdo) | `globals.css`: `overscroll-behavior` só em `display-mode: standalone` | CSS nativo |
| F14 | Saída ativa: local com mesma inteligência do gasto (buscar perto, lista, pesquisar) | `OutingPage` place sheet usa `NearbyPlaceList` mas depende de GPS+online; sem busca livre | feature |
| F15 | App aceitar `.csv` compartilhado de outros apps (ex.: Wise → TripPilot) | `AndroidManifest.xml` sem intent-filter de SEND/`text/csv`; sem handler | feature nativa |
| F16 | Importação inteligente: ligar entrada (Bianca +100) à compra (Paylogic −150) como dívida/divisão + criar pessoa | `wise-transfer.ts` / `WiseImportPage` (já tem split, falta a "ponte" gasto↔transfer) | feature (grande) |
| F16b | Criar a **fase** na hora da importação se ela não existe (Tomorrowland) | `WiseImportPage.handleCommit` usa `resolveActivePhase` (fallback) | feature |
| F17 | Renda planejada por fase (sei que vai entrar €X) p/ a **visão de futuro** da fase | não existe; budget é só pool atual | feature (cuidar ÂNCORA 11) |
| F18 | Navegar/planejar "como se estivesse em outra fase" (visão de futuro) | `resolveActivePhase` fixa a fase ativa por data; home é 100% "hoje" | feature (grande) |
| F19 | Conexão por **link** (não só QR) + repaginar telas de backup/conexão/dívidas | `SharedExpensesPage` + `BackupPage` (pareamento espalhado/confuso) | feature + redesign |
| F20 | Valor do dia no mapa deve somar reservado (63 livre + 60 creme = 123) com explicação | `allowance-map.ts` mostra só `freeCents` + tag separada | math/UX |
| F21 | Amigo sincero sempre laranja (parece erro) — cor por tom; sumir quando nada ruim | `AmigoSinceroCard.tsx` cor fixa primary p/ todo `kind` | UX |
| F22 | Card único com 2 abas: **Mapa de gastos da fase** + **Mapa disponível da fase** | heatmap (Copiloto) + allowance-map (sheet do hero) hoje separados | feature |

---

## 2. Conselho (inline) — recomendações por item ambíguo

> 4 lentes: **Estrategista** (produto/longo prazo), **Arquiteto** (viabilidade/padrões),
> **Crítico** (riscos/regressão), **Advogado do usuário** (uso real). Resumo + recomendação.

### F4 + F20 + F22 — Mapa da fase (calendário + matemática + 2 abas) ⭐ coração da rodada
- **Estrategista**: dois mapas complementares — "quanto já gastei" (heatmap, existe) e "quanto posso gastar por dia" (allowance, vira calendário) — é a tese de "copiloto de planejamento", não só tracker. Forte diferencial.
- **Arquiteto**: reaproveita `buildPhaseAllowanceMap` (planejamento) + heatmap (gastos). Vira **um card com 2 abas** (segmented, ambas visíveis). O mapa "disponível" passa de barras → **agenda/calendário**: cada dia mostra data + **total do dia = livre + reservado** (F20); tocar no dia → breakdown ("63 livre + 60 reservado p/ creme = 123"). Matemática preserva a garantia de consistência com `calculateTodayFreeBudget`.
- **Crítico**: **auto-alternância de abas é anti-padrão** (usuário perde controle, briga com reduced-motion, troca no meio da leitura). O próprio Julio ficou em dúvida. Risco de dupla-contagem na soma livre+reservado — mas o reservado já saiu do `trueFree` uma vez, então somá-lo de volta **só na exibição do dia** é correto e não altera o orçamento.
- **Advogado**: 2 abas com rótulos visíveis (sem auto-rotação) deixam a 2ª óbvia; calendário é mais legível que barras; tocar no dia para entender "por que tenho tanto hoje" é exatamente o pedido.
- **RECOMENDAÇÃO**: 1 card, 2 abas visíveis ("Disponível por dia" = calendário, **padrão**; "Gastos por dia" = heatmap). **Sem** auto-alternar. Dia mostra total (livre+reservado) e abre breakdown. → *confirmar default/abas com Julio (Q6)*.

### F5 — Cofrinho contextual
- **Advogado/Estrategista**: recompensa permanente vira papel de parede e perde efeito. Melhor como "momento": no check-in calmo/sem-gastos e no Copiloto/insights (recompensa variável).
- **Arquiteto**: já é card movível/escondível e read-only; a "lente" do check-in já foca `piggy_bank` no modo calmo. Tornar contextual = condição de render + manter pinável.
- **Crítico**: quem gosta pode não achar — manter opção de fixar via config.
- **RECOMENDAÇÃO**: default = contextual (lente calmo/sem-gastos + Copiloto), removido do fluxo permanente, **pinável** por quem quiser. → *confirmar (Q7)*.

### F6 — Amigo sincero + divisões 2 por linha?
- **Arquiteto/Crítico**: o grid 2-up é p/ tiles compactos de **um número** (savings/cofrinho/planejados/fundos). Amigo sincero tem texto multi-linha + 2 botões; divisões tem texto + ação. A ~200px cada, viram ilegíveis. O próprio Julio suspeita ("muito texto?").
- **RECOMENDAÇÃO**: **NÃO** parear esses dois. Em vez disso, **compactar** o amigo sincero (copy mais curta, menos padding) e, opcionalmente, transformar `pending_shares` em tile compacto (contagem + valor) que pode parear. → decidido pelo conselho; sem pergunta.

### F7 — Gastos recentes
- **Advogado**: já é peek compacto (3 linhas) + "ver todos". Ganho marginal: rótulo relativo (hoje/ontem) + horário. Baixa prioridade.
- **RECOMENDAÇÃO**: polish leve dentro de um gate de acabamento. Sem pergunta.

### F8 — Check-in mais discreto / integrado ao "livre hoje"
- **Estrategista/Arquiteto**: o propósito do check-in é **reenquadrar o "livre hoje"** — que é justo a linha do hero. Integrar o seletor de intenção ao hero (linha sutil) é conceitualmente certo e economiza espaço. Depois de escolher, colapsa em um chip pequeno (ex.: "☾ noite") tocável p/ trocar.
- **Crítico**: manter ÂNCORA 12 (read-only) e preservar a "lente" que reposiciona o card-foco. Não lotar o hero — controle compacto e colapsável.
- **RECOMENDAÇÃO**: fundir o check-in na área do hero como controle compacto/colapsável; remover o card cheio padrão. → *confirmar (Q7)*.

### F13 — Overscroll (esticar)
- **Arquiteto/Crítico**: no WebView Android o "stretch" age no scroller inteiro (root); header é `sticky`, nav é `fixed`, então distorce tudo junto. Localizar (conteúdo com scroller próprio + header/footer fora) é refactor grande e arriscado (quebra sticky/scroll-restore/swipe). Remover via `overscroll-behavior: none` no root nativo é simples e seguro; o Julio aceitou "ou não ter mesmo".
- **RECOMENDAÇÃO**: **remover** o bounce no app nativo (web/PWA intactos). Sem pergunta.

### F21 — Cor do amigo sincero por tom
- **Crítico/Advogado**: laranja-sobre-laranja sempre lê como "alerta/erro", mesmo p/ "está dentro do plano". Mapear `kind`→tom (verde p/ `on_plan`; âmbar p/ `over_pace`/`over_plan`; data-reserva mais forte) como o `VERDICT_STYLE` do Copiloto.
- **RECOMENDAÇÃO**: recolorir por tom; manter o card (é querido). Avaliar demover `on_plan` na home (só Copiloto) — incluí como sub-pergunta em Q7. → mostra principalmente decidido; cor sem pergunta.

### F10 — Transição arrastando a tela (dedo acompanha)
- **Arquiteto/Crítico**: hoje é "decide no touch-end + slide CSS" (barato e robusto). Drag interativo de verdade exige montar a tela vizinha durante o arraste e transladar ambas seguindo o dedo — com 4 rotas lazy + muitos scrollers horizontais + scroll-restoration, é médio-alto esforço e **alto risco de regressão/jank**. Pode ficar PIOR que o slide limpo atual.
- **Estrategista**: é polish, não valor central.
- **RECOMENDAÇÃO**: **adiar** (manter slide atual) ou versão leve depois das entregas de maior valor. → *confirmar (Q8)*.

### F18 — Navegar "como se estivesse em outra fase" (+ F17 renda futura)
- **Estrategista**: diferencial real de planejamento ("visão de futuro"). Grande.
- **Arquiteto**: `resolveActivePhase` escolhe a fase por data. Uma "lente de fase" passaria um `viewedPhaseId` + "data como se fosse o dia 1" pelo `useDashboardModel` (já memoizado), recomputando o modelo como se aquela fase fosse a ativa. F17 (renda planejada por fase) dá números reais à fase futura. Precisa banner "PRÉVIA — vendo a fase X" + saída clara, **read-only** (não confundir presente com futuro).
- **Crítico**: risco de confundir presente/futuro; F17 não pode tocar o free-to-spend de hoje (ÂNCORA 11) — é só forecast/visão futura.
- **RECOMENDAÇÃO**: prévia read-only de fase a partir da lista (Viagem) + renda planejada por fase alimentando só a visão futura. Gate próprio (grande). → *confirmar escopo (Q4)*.

### F19 — Conexão por link + hub de backup/conexão
- **Estrategista**: link (copiar, mandar no WhatsApp) derruba o atrito do QR (precisa estar lado a lado). Grande ganho de adoção das features sociais.
- **Arquiteto**: o payload de identidade do QR (`buildIdentityQrPayload`) já é uma string compacta; cabe numa rota `/pair#<payload>` (web/PWA) + App Links/scheme (nativo, exige APK + verificação de domínio). Ao abrir, decodifica e pareia (reusa `pairParticipantFromIdentity`) **com confirmação**.
- **Crítico**: link é compartilhável/interceptável (QR tinha proximidade); exigir confirmação "Conectar com o aparelho de Julio?". App Links é config nativa.
- **RECOMENDAÇÃO**: (a) pareamento por link com confirmação; (b) consolidar backup + conexão num hub claro. Gate próprio. → *confirmar (Q5)*.

### F16/F16b — Importação inteligente (dívida + criar pessoa + criar fase)
- **Estrategista**: é a "inteligência" que o Julio quer — o app **prever** relações reais (compra dividida + reembolso) na hora de importar. Diferencial forte.
- **Arquiteto**: a base existe — `wise-transfer.ts` já casa nome→participante e divide a transferência em "buckets" (pagar dívida / pessoa pagou / etc.). Falta a **ponte gasto↔transferência**: detectar que uma entrada (Bianca +100) é próxima no tempo/valor de uma compra (Paylogic −150) e propor "essa compra foi dividida? Bianca devia 100 de 150" → cria pessoa + share + settlement. Heurística pura (janela de dias, valor ≤ compra, nome). Tudo **sugestão, confirma sempre** (ÂNCORA 10/13).
- **Crítico**: falsos positivos (entrada não relacionada). Mitigar: só **sugerir** com confiança, nunca aplicar sozinho; usuário confirma o vínculo e o valor.
- **RECOMENDAÇÃO**: heurística de vínculo entrada↔gasto + fluxo "essa compra foi dividida?" criando pessoa/divisão/quitação; e criar fase inline no picker de importação. → *confirmar profundidade (Q2/Q3)*.

### F11 — Configurações estilo Samsung
- **Advogado**: a página única com busca + acordeões ficou difícil de escanear ("não sei o que está em cada lugar"). Lista de categorias (ícone + título + descrição do que tem dentro) → subpágina é o padrão Android/Samsung, mais previsível.
- **Arquiteto**: hoje há 7 grupos (`SETTINGS_GROUPS`). Vira lista de 7 cartões de categoria → 7 subpáginas (reusa as `Section`s atuais). Mantém busca global opcional. ÂNCORA 9 (nada removido).
- **RECOMENDAÇÃO**: lista de categorias → subpáginas (mantendo uma busca global). → *confirmar (Q1)*.

### F9 — Bug do swipe em Gastos
- **Arquiteto**: na tela de Gastos, o swipe interno faz handoff p/ a aba vizinha na borda (Gastos→Início ao puxar p/ direita; é o design G1). Hipótese do bug: **quando a lista é curta**, o swipe na área vazia abaixo cai no pager GLOBAL do `AppShell` (que não respeita a sub-aba) → pula p/ Início. Correção: a região `data-inpage-swipe` precisa **preencher a altura** (e/ou o pager global respeitar a sub-aba). Reproduzir no emulador e confirmar a causa.
- **RECOMENDAÇÃO**: reproduzir + corrigir (sem pergunta). Decidir se na sub-aba Gastos o swipe-p/-direita deve ir p/ Início ou ser "contido" — incluído como nuance em Q8.

---

## 3. Waves & gates propostos (cada gate: testes verdes + build + commit + deploy; APK quando nativo)

> Ordem por valor × risco × dependências. Itens nativos agrupados em **1 APK** ao final
> de cada bloco nativo (regra: só gera APK novo quando mexe em nativo).

- **Wave A — Quick wins web/UX [web]**: F2 (scrollbar), F3 (sheet arrasta p/ fechar),
  F7 (recentes), F21 (cor amigo sincero), F9 (bug swipe), F5 (cofrinho contextual),
  F8 (check-in no hero), F6 (não-parear + compactar). Sem nativo.
- **Wave B — Mapa da fase [web, domain-heavy]**: F4+F20+F22 (calendário + matemática
  do dia + 2 abas). Domínio puro + testes.
- **Wave C — Configurações + Conexão [web]**: F11 (settings Samsung) + F19-web
  (hub backup/conexão + rota `/pair` por link no PWA).
- **Wave D — Visão de futuro [web, domain-heavy]**: F17 (renda planejada por fase) +
  F18 (prévia de fase). Interligados.
- **Wave E — Importação inteligente [web]**: F16 (ponte gasto↔transfer + criar pessoa)
  + F16b (criar fase na importação).
- **Wave F — Nativo (1 APK) [native → APK]**: F1 (backup→Downloads), F12 (câmera/QR),
  F13 (overscroll), F14 (local da saída — parte nativa de GPS), F15 (receber `.csv`),
  F19-nativo (App Links do link de pareamento). Fecha em UM APK + bump
  `requiredNativeVersion` + versionCode.
- **Wave G — Polish opcional**: F10 (drag interativo) se aprovado.

> F14 (paridade do local da saída) é majoritariamente web (reusa `NearbyPlaceList` +
> `searchNearbyPlaces` + busca livre) — entra em Wave A/B; só a parte de permissão/GPS
> depende do APK (já coberto por F12-style grant).

---

## 4. Decisões travadas (Julio, 2026-06-16)

- **Ordem das waves: F → A → B → C → D → E.** Nativo PRIMEIRO (APK cedo p/ testar no celular).
- F11 Configurações: **lista de categorias estilo Samsung** (ícone+título+descrição) → subpáginas, com busca global.
- F16: **todas** as inteligências — (a) vínculo entrada↔compra + criar pessoa + divisão/quitação; (b) criar fase na importação; (c) adivinhar categoria/local de compras especiais (Paylogic→ingresso/festival). Sempre confirmando.
- F17+F18: **ambos** — renda planejada por fase + prévia read-only de fase (dia 1).
- F19: **link de pareamento** (confirmação ao abrir) + **hub** repaginado de backup/conexão.
- F22: **1 card, 2 abas visíveis**, padrão "Disponível por dia", **sem** auto-alternar.
- F8/F5/F21/F6 (home): aplicar **todos** — check-in fundido no hero; cofrinho contextual; amigo sincero esconde `on_plan` na home + recolorir por tom.
- F10: **drag interativo completo agora** (Julio aceitou o custo/risco). Cuidado redobrado com regressão de scroll/paging.

### Re-scope após decisões
- **Wave F (1º APK)** = permissões (câmera p/ QR + localização) & WebChromeClient grant (F12) · overscroll off no nativo (F13) · backup→Downloads (F1). Receber `.csv` (F15) → ver nota.
- **F15 (receber .csv)**: o handler de intent é a parte pesada; só entra no APK se houver caminho limpo (plugin/Capacitor App). Senão, anda junto com a Wave E (alimenta o fluxo de import que será melhorado). A decidir após spike.
- **F14 (local da saída)**: parte web (busca/lista/pesquisa) entra na Wave A/B; depende da permissão de localização (Wave F).
- **F19 App Links (link nativo)**: depende da rota `/pair` (Wave C) → entra num 2º APK junto da Wave C.
- **F10 drag**: Wave A (mas com testes manuais pesados; se ameaçar regressão, isolar atrás de flag).

---

## 5. Anti-regressão (checar a cada gate)

- Insights = carrossel rotativo (DEC-091/077/150); ocasiões = carrossel (DEC-076).
- Hero breakdown (DEC-168) + true-free (FIELD-18) reconciliam.
- ÂNCORA 11 (meta/cofrinho/renda-futura read-only — provar por teste de invariância do free-to-spend).
- ÂNCORA 12 (check-in não grava). ÂNCORA 13 (transfer entre pools conserva total).
- Mapa diário mantém consistência com `calculateTodayFreeBudget`.
- i18n pt/en/es para toda string nova. tsc 0 + build sem chunk >500KB.
- Deploy de produção: `--branch=master` (apex). APK só quando mexe em nativo.

---

## 6. Log de execução

### ✅ Wave F — APK nativo 0.50.0 (2026-06-16) — ENTREGUE
- F12 (câmera QR): `CAMERA` no manifest (Capacitor 8 já pede o grant em runtime).
- F1 (backup → Downloads): plugin nativo `DeviceFile` via `MediaStore.Downloads` (fallback Documents).
- F13 (overscroll): `setOverScrollMode(NEVER)` na WebView + `.cap-native overscroll-behavior:none`.
- versionCode 16 / 0.50.0 · `requiredNativeVersion` 0.50.0 · 1038 testes verdes (Node 22).
- Deploy `--branch=master` (apex serve version.json/apk/bundle). APK em `dist/trippilot.apk` + `/mnt/c/Users/julio/Downloads/TripPilot-0.50.0-debug.apk`. DEC-205.
- `[device]` pendente: ler QR (câmera), salvar backup (cai em Downloads), rolar além do fim (sem esticar).

### ✅ Wave A — UX/home quick wins 0.59.0 (web, OTA) — ENTREGUE
- F2 scrollbar global escondida (FastScroller mantido) · F3 BottomSheet arrasta-p/-fechar · F7 recentes com dia/hora relativos.
- F21 Amigo Sincero recolorido por tom + `on_plan` escondido na home · F9 fix do bug de swipe em Gastos (lista curta → pager global).
- F5 cofrinho contextual + fixável · F8 check-in fundido no hero (compacto/recolhível) · F6 amigo + divisões não pareados (tile `pending_shares`).
- **F10 drag interativo completo** (dedo acompanha a transição de página) — Julio aceitou o custo; sem regressão de scroll/paging.
- commit `b9155bb` · deploy `--branch=master` · screenshots Playwright OK.

### ✅ Wave B — Mapa de fase 0.60.0 (web, OTA) — ENTREGUE
- F20: total do dia = **livre + reservado** (domínio `dayTotalCents`/`maxDayTotalCents` + testes) consistente com `calculateTodayFreeBudget` (anti-regressão §5).
- F4: mapa vira calendário/agenda; tocar no dia abre o breakdown.
- F22: **1 card, 2 abas visíveis** ("Disponível por dia" padrão + "Gastos por dia" heatmap), **sem** auto-alternar.
- i18n pt/en/es · 1106 testes · commit `9d6de17` · deploy apex · screenshots OK.

### ✅ Wave C — Configurações Samsung + pareamento por link 0.61.0 (web, OTA) — ENTREGUE
- F11: Configurações como lista de categorias (ícone+título+descrição) → subpáginas, com busca global.
- F19-web: rota `/pair` (decodifica identidade + confirma ao abrir) + copiar/compartilhar + **hub de conexões** repaginado.
- i18n pt/en/es · 1115 testes · commit `716f420` · deploy apex · screenshots OK.
- `[deferred]` F19 App Links (link nativo) → 2º APK (depende da rota `/pair`, já entregue).

### ✅ Wave D — Visão de futuro 0.62.0 (web, OTA) — ENTREGUE
- F17: **renda planejada por fase** que alimenta SÓ a projeção (ÂNCORA 11 provada por teste de invariância do free-to-spend).
- F18: **prévia read-only de fase** ("dia 1") reusando a matemática viva de allowance.
- i18n pt/en/es · 1123 testes · commit `6550006` · deploy apex · screenshots OK.

### ✅ Wave E — Import Wise inteligente 0.63.0 (web, OTA) — ENTREGUE
- F16c: `guessCategory` reconhece bilheteiras/festivais (Paylogic, Eventim, Ticketmaster, Tomorrowland…) → `entertainment`.
- F16a: **ponte de reembolso** — `detectReimbursementBridges` (puro) liga uma entrada de reembolso a uma compra próxima (valor ≤ compra, janela ±21d, 1:1 guloso); `commitWiseImport` ganha `ownerId` + `bridges` → registra a compra como dividida (share já `confirmed`) e a entrada correspondente quita a dívida no mesmo import. UI "Sugestões inteligentes" + sheet de confirmação (escolher/criar pessoa) + badge "Dividido c/".
- F16b: `WiseImportDraft.inPhase` (via `findActivePhase` estrito) revela banner fora-de-fase → sheet criar-fase → re-classifica (seleção/transfer/bridge preservados).
- i18n pt/en/es · **1139 testes / 127 arquivos** · E2E 33/33 · commit `09804cd` · deploy apex · screenshots Playwright OK.
- `[deferred]` F15 (receber `.csv` por intent) → próximo lote nativo.

### ✅ F14 — Paridade do local da saída 0.64.0 (web, OTA) — ENTREGUE
- Parte **web** do F14 (que o §3 nota / §4 / re-scope tinham adiado das waves A/B; só o grant de GPS nativo era da Wave F, já entregue).
- A sheet de **local da saída ativa** agora tem a **mesma inteligência do registro de gasto**: novo domínio puro `buildPlaceSuggestions` unifica **lugares próximos** (online) + **lugares recentes** (histórico offline, `deriveRecentPlaces`) numa lista **pesquisável** — dedupe por id/rótulo normalizado (nearby vence), exclui o local já escolhido, filtra por substring **sem acento** (o mesmo campo busca E nomeia um lugar novo) + botão **"buscar nome (online)"** (reverse geocode).
- `OutingPage` lê `transactions` p/ derivar recentes (memoizado) · fluxo de gasto **intacto** (zero regressão — ÂNCORA 9; GPS opt-in/local — ÂNCORA 8).
- i18n pt/en/es · **1147 testes / 128 arquivos** (+8 `place-suggestions`) · **E2E 34/34** · commit `8a6c923` · deploy apex · screenshots Playwright OK (busca filtra sem acento, recentes aparecem, salvar-como-novo).
- `[deferred]` F14 só a parte de **grant de GPS nativo** → próximo lote nativo.

---

## 7. Fechamento (2026-06-17)

**Todas as waves da Rodada 2 entregues** (F nativo + A·B·C·D·E web/OTA + **F14 web**). Versão final **0.64.0** (apex `trippilot.pages.dev`, bundle OTA para o APK 0.50.0). Qualidade final: **1147 testes verdes / 128 arquivos**, tsc 0, build limpo, **E2E 34/34**. Brain atualizado: **DEC-211** (waves web A–E + F14) + `project-status.md` + `src/dev-log.md`.

**Pendências por design (próximo APK nativo):** F15 (intent `.csv`), F19 App Links (`/pair`+`/s/:id`), F14 apenas a parte de **permissão/GPS nativo** (a busca/recentes/find-online já entraram no 0.64.0).
