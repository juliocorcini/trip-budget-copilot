# Orquestrador — Leva "Field v2: satélite com rótulos + verdade do dinheiro + mapa/cluster + acerto"

> **Status: ✅ ACTIVE** (defaults do §16 adotados; **G1 sem fork em aberto — executável já**; **G2** e **G5** trazem a recomendação do conselho como default, confirme antes de rodar cada um se quiser).
> **Cadência de versão:** base `2.1.0-rc` → **`2.1.1-rc` → `2.1.5-rc`**, um bump por gate. **Nenhum gate toca o worker** (`trippilot-sync`) — tudo é device/Pages.
> **Leva-irmã (concluída, base desta):** `2026-06-30-field-fixes-maps-money-truth-orchestrator.md` (G0→G11, DEC-413→425, shipada `2.0.0-rc`→`2.1.0-rc`). Esta leva **refina** o que aquela entregou (satélite, mapa/cluster, "livre hoje", acerto) a partir de um novo review de campo do Julio.

---

## §0 — Missão

Um novo review de campo do Julio (usando o app de verdade) apontou **6 pontos** que ficaram meio-caminho na leva anterior. Esta leva os fecha:

1. **Satélite "cego"** — o mapa em satélite não mostra nome de rua/estabelecimento (só imagem). Julio quer satélite **com rótulos** e **tocar o ponto e ver o nome do lugar**.
2. **Verdade do dinheiro** — há **cinco** números diários com nomes que se confundem ("Livre para usar hoje" 5 · "Ritmo de hoje" 14 · "Média até o fim" 20 · "Livre no dia" 14 · cofre "ritmo" 5,71). Julio **não consegue** saber qual é "o que posso gastar hoje". **E há um bug real:** o mesmo dia mostra 5 no Home e 14 na tela por-dia.
3. **Entrada do mapa** — "gastos no mapa" só é achável pela busca do guia. Falta um botão na tela de Gastos.
4. **Cluster** — tocar numa bolinha de N gastos só dá zoom; Julio quer **segurar** pra ver a lista de gastos da bolinha.
5. **Barra de rolagem** — ainda aparece no **APK Android instalado** (plataforma confirmada por Julio).
6. **Mover dívida pra pessoa conectada** — o Bruno (conectado) **não aparece** como destino; Julio quer consolidar dívidas nele.

**O que esta leva NÃO é:** não é redesenho do modelo de orçamento (a matemática do total é **invariante**); não é feature nova de sync; não mexe no worker. É **clareza + consistência + descoberta + uma correção de bug**.

**O app:** TripPilot — planejador de orçamento de viagem, local-first (PWA + APK Capacitor), domínio TS puro, dados em IndexedDB, deploy Cloudflare Pages (OTA).

➡️ **Para começar, vá ao §17.**

---

## §1 — Identidade & contrato de autonomia

Você é **um(a) engenheiro(a) full-stack sênior** executando esta leva **sozinho(a), nesta sessão, de ponta a ponta**: domínio→UI, teste junto, commit por item, deploy por gate, brain em sync. Sem subagents, sem Task tool, tudo inline (custo é **por request**). Depois de destravado o §16, **não peça permissão entre work units** — fechar um gate é o gatilho pra commit→deploy→dev-log→próximo, não pra parar.

---

## §2 — Ordem de leitura (carregue contexto UMA vez)

1. Este doc **§0–§9** (uma vez).
2. `TripPilot/src/dev-log.md` (Current State + tabela da leva).
3. Só as DECs citadas: **DEC-426→431** (+ as herdadas que reaproveitamos: DEC-415/088 cofrinho, DEC-422 tiles, DEC-416 mapa, DEC-414 mover dívida, DEC-425 scrollbar).
4. Só as entidades de `product-spec.md` tocadas (modelo diário, mapa).
5. O orquestrador-irmão (`2026-06-30-…`) pro tom. **Não re-leia o brain inteiro por milestone.**

---

## §3 — Não-negociáveis (ÂNCORA)

**Herdados (app-wide):** dinheiro = **inteiro em cents**; domínio = **TS puro, zero React**; UI sempre via **`t()`** (pt/en/es), nunca hardcoded; **hide-never-delete**; **invariância de dados** (totais/saldos idênticos ao baseline); **nunca bloquear** registro de gasto/import/IA; schema **aditivo**; código **em inglês**, doc/brain em português; **sem barra de rolagem** nativa.

**Novos desta leva:**
- **Â-MONEY-READING-CONSISTENT** — "quanto posso gastar hoje" tem **UM** número herói, e ele é **idêntico** em todas as telas (Home, check-in, tela por-dia). Corrigir a leitura **nunca** muda o total: `Σ(mesada diária) + cofrinho = livre` (bit-a-bit). O cap do cofrinho (DEC-415) vale para **toda** superfície que mostra o "livre do dia", não só o Home.
- **Â-MAP-COORDS-REAL** — o mapa só mostra pontos com coordenada **real** (nunca inventa). Satélite/rótulos/tiles são **best-effort e offline-safe**; nada no mapa bloqueia.
- **Â-DEBT-SYNC-SAFE** — nenhuma operação de mover dívida pode **dessincronizar** o device de um peer conectado sem consentimento explícito dele (accept-first). Se não dá pra garantir, **não faça** — explique honestamente por quê.

> Quebrar uma âncora é defeito **mesmo se os testes passarem**.

---

## §4 — Baseline: o que JÁ existe (confirmado lendo o código)

| Área | Arquivo → símbolo | O que já faz | GAP desta leva |
|---|---|---|---|
| Tiles | `features/location/tile-layers.ts › SATELLITE_TILES`, `createTileLayer` | Esri `World_Imagery` (imagem pura) + OSM; `createTileLayer(kind): L.TileLayer` | Satélite **sem rótulos**; falta camada de referência (labels) |
| Mapa detalhe | `features/location/ExpenseLocationMap.tsx › L.marker(...` L82 | Pin com `title` (só tooltip hover) + toggle satélite/rua | Toque no pin **não** mostra nome; satélite sem labels |
| Mapa gastos | `features/map/ExpenseMapPage.tsx › L.markerClusterGroup` L82-91 | Clusters + tap no pin → sheet do lugar | **Cluster sem handler** (só zoom padrão); sem long-press |
| Domínio dia | `domain/phases/rhythm.ts › calculateTodayFreeBudget` L131-180 | `freeToday` (capado no cofrinho, DEC-415) · `avgDailyUntilEnd` (ritmo) · `avgUntilEndFlat` (média) | 3 números concorrentes no Home |
| Domínio dia | `domain/phases/allowance-map.ts › buildPhaseAllowanceMap` L199-273 | `freeCents` por dia = cota **crua** (linha 235-236) | **NÃO aplica o cap** → hoje diverge do Home (bug) |
| Home | `features/dashboard/DashboardCards.tsx` L963-1021 | Renderiza `free_per_day`/`today_rhythm`/`avg_until_end_flat` | Precisa eleger 1 herói + rebaixar o resto |
| Tela por-dia | `features/dashboard/PhaseMapTabs.tsx › phase_map_free` L198 | "Livre no dia" = `day.freeCents` | Usa o número **não capado** |
| Toolbar Gastos | `features/expenses/ExpenseListPage.tsx` L364-400 | Pílulas "Escanear" (`/receipt/scan`) + "Importar" (`/import/wise`) | Falta pílula "Mapa" → `/mapa` |
| Mover dívida | `features/shared/SharedExpensesPage.tsx › destinations` L2300-2302; `isPersonLocal` L495-503 | Destino filtrado por `isPersonLocal` (só não-conectados) | Peer conectado (Bruno) excluído |
| Mover dívida | `domain/splitting/splitting.ts › isShareReassignable` L929-939; `reassignShares` L948-958 | Reatribuição pura A→B, `!fromIsP2PConnected` | Trava conectados nas duas pontas |
| Scrollbar | `styles/globals.css` L135-246 | CSS máximo (universal+raiz+`cap-native`+Leaflet), travado por `style-hygiene.test.ts` | APK velho re-pinta a barra (nota L206-214) |

---

## §5 — Change-set normalizado (por prioridade)

| Item | Pedido | Prioridade | Gate |
|---|---|---|---|
| **D01** | Satélite com rótulos (híbrido) + nome do lugar ao tocar o ponto | **P0** | G1 |
| **D02** | Verdade do dinheiro: corrigir bug 5-vs-14 **+** eleger 1 número herói e rebaixar/renomear o resto | **P0** | G2 |
| **D03** | Pílula "Mapa" (ícone+texto) na toolbar de Gastos → `/mapa` (reorg do topo = follow-up opcional) | **P1** | G3 |
| **D04** | Cluster: **segurar** = lista de gastos da bolinha; **tocar** = zoom | **P1** | G4 |
| **D05** | Mover dívida pra pessoa conectada — **política definida pelo conselho** (§7-B) | **P1** | G5 |
| **D06** | Barra de rolagem no APK — **rebuild do APK** (+ hardening se persistir via device-debug) | **P1** | operacional (§10-Gops) |

---

## §6 — Mapa causa-raiz (código ↔ correção) — **re-leia o arquivo citado antes de editar**

- **D01 satélite sem rótulos** → `tile-layers.ts › SATELLITE_TILES` L19-25 usa **só** `World_Imagery` (imagem, sem labels). **Correção:** `createTileLayer('satellite')` passa a devolver um `L.LayerGroup` = imagery **+** referência Esri (`Reference/World_Boundaries_and_Places/MapServer` + `Reference/World_Transportation/MapServer`, mesmo esquema `{z}/{y}/{x}`). Tipo do `tileRef` em `ExpenseLocationMap.tsx` L41 e `ExpenseMapPage.tsx` L59 muda `L.TileLayer` → `L.Layer` (LayerGroup tem `.addTo`/`.remove`). Ajustar `tile-layers.test.ts` (a asserção da URL da imagem continua válida; adicionar a das camadas de referência).
- **D01 nome no ponto** → `ExpenseLocationMap.tsx › L.marker(...).addTo(map)` L82 tem só `title`. **Correção:** `.bindPopup(label)` (ou tooltip permanente discreto) — o `label` já é o nome geocodificado. No `/mapa`, o sheet já mostra `selected.label`; adicionar o mesmo popup no pin por consistência.
- **D02 bug 5-vs-14** → `allowance-map.ts` L235-236 calcula a cota **crua** (sem o cap do cofrinho), enquanto `rhythm.ts › calculateTodayFreeBudget` L163-172 **capa** hoje no ideal-base quando cofrinho>0 (DEC-415). O docstring de `allowance-map.ts` L24-28 **promete** que hoje = Home — promessa quebrada. **Correção:** passar o mesmo `piggyCap` (saldo do cofrinho + `baseDailyIdeal`) para `buildPhaseAllowanceMap` e aplicar `min(cotaCrua, baseDailyIdeal)` **só na célula de hoje**; o explicador do dia (`PhaseMapTabs` L233-254) ganha uma linha "guardado no cofrinho: €X" (= a diferença capada). Nenhum total muda (Â-MONEY-INVARIANT).
- **D02 vocabulário** → Home (`DashboardCards.tsx` L963-1021) mostra 3 números; a colisão de "ritmo" (pace no Home vs base-ideal no cofre). **Correção (§7-A):** herói único = **"Livre para usar hoje"**; "Ritmo/Média" saem da manchete e viram detalhe do explicador; "ritmo" fica reservado ao cofrinho. Só i18n + quais linhas renderizam (zero math).
- **D03 entrada do mapa** → `ExpenseListPage.tsx` L364-400. **Correção:** adicionar uma 3ª pílula (`Icon "map"` + texto `t('expenses.open_map_short')`) que faz `navigate('/mapa')`, no mesmo padrão das outras. Nota: o topo fica apertado com 3 — reorg num menu "+" é **follow-up opcional** (Julio pediu ícone+texto por ora).
- **D04 cluster** → `ExpenseMapPage.tsx` L82-91 não tem handler de cluster. **Correção:** `cluster.on('clusterclick', …)` mantém zoom (padrão); adicionar long-press (touchstart/touchend com timer ~450ms, ou `contextmenu`) que **agrega os `getAllChildMarkers()`** num `ExpenseMapPoint` combinado e abre o mesmo `BottomSheet` (reusa a lista paginada). Estado `selected` já existe.
- **D05 mover dívida** → `SharedExpensesPage.tsx › destinations` L2300-2302 (`isPersonLocal`) + o guard do botão L2249-2251 + `isShareReassignable` L929-939. **Correção:** ver o conselho §7-B (recomendação: explicação honesta agora + feature P2P-accept como onda dedicada).
- **D06 scrollbar** → `globals.css` L135-246 já é máximo; nota L206-214: "APK antigo com web embutido só cura com build novo". **Correção:** rebuild do APK a partir do web atual; se persistir num WebView específico, inspecionar via Chrome remote e endurecer a superfície nomeada (device-dependente).

---

## §7 — Decisões + conselhos inline

> Rodados **inline nesta sessão (1 request, sem subagents)**, conforme `inline-council-no-subagents.mdc`.

### §7-A — Conselho: vocabulário do "quanto posso gastar hoje" → **DEC-427 (parte simplificação)**

**Decision Brief (neutro):** o Home mostra 3 números diários (Livre hoje 5 · Ritmo 14 · Média 20), a tela por-dia mostra "Livre no dia" (14, hoje), e o cofre fala em "ritmo" (5,71). São leituras diferentes do mesmo dia + um bug (5≠14). A palavra "ritmo" significa duas coisas. Pergunta: qual número é o **herói** e o que fazer com os demais? *Viés a resistir:* "mostrar tudo é mais transparente" — na prática confunde.

**Advocate (usuário):** o viajante quer UMA resposta: "posso gastar X hoje". Tudo além disso é ruído no momento da decisão. Herói = **"Livre para usar hoje"** (o número honesto, já capado). O resto vira "de onde vem" sob toque. **Rec:** 1 herói + explicador. **Confiança:** ALTA. **Outros perdem:** manter "Média/Ritmo" como manchete faz o usuário gastar 14/20 quando o honesto é 5.

**Architect:** o número capado (`freeToday`) é a única leitura consistente com o cofrinho e com a invariância. "Ritmo"/"Média" são **projeções**, não permissões — pertencem ao detalhe. Reservar a palavra "ritmo" ao cofrinho (base-ideal) elimina a colisão. **Rec:** herói=`freeToday`; projeções no explicador; renomear a linha de pace do Home (ex.: "Neste passo, ~€X/dia") ou removê-la. **Confiança:** ALTA. **Outros perdem:** o bug 5-vs-14 precisa ser corrigido **antes**, senão a simplificação herda a inconsistência.

**Critic:** cuidado em **esconder** número que algum usuário usa (o "média até o fim" ajuda a planejar). Não delete — **rebaixe** pro explicador, com rótulo claro de "projeção". **Rec:** herói único, secundários acessíveis a 1 toque, nunca competindo na manchete. **Confiança:** MÉDIA. **Outros perdem:** se o explicador ficar escondido demais, vira "sumiram meus números".

**Red team (mata a opção líder):** "1 herói só" pode parecer simplista demais e esconder que hoje é dia de pico (posso gastar mais). → Mitigação: o herói **já** reflete pico (o cálculo usa peso do dia); e o explicador mostra "+pico". Então não se perde a informação, só sai da manchete.

**Síntese (Chair):** **Herói único = "Livre para usar hoje"** (capado, idêntico em Home/check-in/por-dia). **Ritmo/Média saem da manchete** e viram linhas do explicador "de onde vem esse número", rotuladas como **projeção**. **"Ritmo"** passa a designar **só** o conceito do cofrinho (base-ideal); a antiga "Ritmo de hoje" do Home é renomeada/rebaixada. **Pré-requisito:** o bug de consistência (§6 D02) é corrigido **no mesmo gate, primeiro**. Lente dominante = **Advocate** (é uma dor de compreensão no momento da decisão). **O que reverteria:** se testes de usuário mostrarem que "Média até o fim" é usada como âncora de planejamento — então promovê-la a um card secundário fixo (não manchete). **Confiança:** ALTA.

### §7-B — Conselho: mover dívida pra pessoa **conectada** → **DEC-430**

**Decision Brief (neutro):** hoje o destino de "mover dívida" é filtrado a pessoas **locais** (`isPersonLocal`); Bruno (conectado P2P) é excluído por design (DEC-414), porque reatribuir uma share que o peer já aceitou dessincroniza o device dele. Julio quer mover uma dívida **pra** Bruno (que pagará por 2). Pergunta: liberar mover pra/de conectado, e como? *Viés a resistir:* "é só tirar o filtro" — isso reintroduz exatamente o risco que DEC-414 evitou.

**Advocate:** o caso é real e comum (um amigo cobre a conta do grupo). Bloquear frustra. **Rec:** permitir, mas via o fluxo P2P que o app já tem. **Confiança:** ALTA. **Outros perdem:** o usuário não liga pra "shares" — ele quer "o Bruno assume".

**Architect:** reatribuir silenciosamente uma share no device do peer = corrupção de saldo. Mas **criar uma nova dívida P2P que o Bruno ACEITA** (accept-first, como DEC-345/346) é seguro e já existe. Modelar "mover pra Bruno" = (1) marcar a dívida-origem como movida/quitada localmente + (2) emitir uma cobrança P2P pendente ao Bruno. **Rec:** accept-first, reusando o mailbox; **não** flipar share no device alheio. **Confiança:** MÉDIA. **Outros perdem:** trilha "veio da {nome}" e undo **cruzando devices** é trabalho não-trivial.

**Critic:** isso é dinheiro **sincronizado** — a classe de bug mais cara. Meia-implementação (flip local + torcer pra propagar) gera saldo divergente e quebra confiança. **Rec:** **não** enfiar num gate de leva de UX; ou faz o accept-first completo, ou entrega a **explicação honesta** ("Bruno é conectado — mova via cobrança que ele aceita") e adia a feature. **Confiança:** ALTA. **Outros perdem:** o risco reputacional de um saldo errado > o valor de um atalho.

**Strategist:** P2P é diferencial; flexibilizar fortalece. Mas correção > velocidade em dinheiro. **Rec:** roadmap: explicação honesta agora, feature completa como onda própria. **Confiança:** MÉDIA.

**Red team (mata a opção "liberar já"):** liberar mover pra conectado dentro desta leva arrisca um **desync silencioso** que corrompe o saldo do Bruno — exatamente o que DEC-414 blindou. Uma leva de clareza não é o lugar.

**Síntese (Chair):** **G5 entrega a EXPLICAÇÃO HONESTA** — quando o destino é um peer conectado, em vez de sumir, mostrar por que não dá diretamente + o caminho (registrar como **cobrança P2P** que o Bruno aceita) e, se possível, um atalho pra abrir a cobrança já preenchida. A **feature completa** (mover dívida entre conectados com accept-first + trilha/undo cross-device) vira **onda dedicada** (P2P/sync), fora daqui. Lente dominante = **Critic/Architect** (dinheiro sincronizado, alto custo de erro). **O que reverteria:** se o accept-first couber com folga e testes cross-device forem viáveis nesta sessão, promover pra implementação completa em G5. **Confiança:** MÉDIA-ALTA.

### Decisões diretas (sem conselho)
- **DEC-426** satélite híbrido + nome no ponto (diretriz clara do Julio).
- **DEC-428** pílula "Mapa" ícone+texto na toolbar (preferência explícita; reorg = follow-up).
- **DEC-429** cluster: segurar=lista, tocar=zoom (ideia do próprio Julio).
- **DEC-431** scrollbar APK = rebuild do APK (o CSS web já é máximo/travado por teste).

---

## §8 — Estratégia de teste (teste JUNTO com a mudança)

- **Domínio-puro primeiro (>90%):** G2 exige **teste-âncora** — hoje na `allowance-map` == `calculateTodayFreeBudget` (capado), e `Σ(mesada) + cofrinho = livre` bit-a-bit (invariância). G4 testa o agregador de cluster (`getAllChildMarkers` → ponto combinado) de forma pura se extraído.
- **Reuse & estenda** `tile-layers.test.ts` (G1: assert das URLs de referência), `expense-map.test.ts` (G4), os testes de `rhythm`/`allowance-map` (G2). **Não duplique.**
- **UI crítica via E2E (>70%):** abrir `/mapa` pela pílula (G3); tocar pin → nome (G1); Home mostra 1 herói e o explicador (G2).
- **`style-hygiene.test.ts`** não pode regredir (scrollbar).
- **"Suite verde entre gates"** = 0 falhas **além** do baseline conhecido (os 2 testes `split-live-loop` WebCrypto/Node-18 que só passam no CI Node 22). Registre o baseline no G0.

---

## §9 — Protocolo por-milestone + refresh de contexto

**Antes de cada commit (5-point):** (1) liste os AC satisfeitos; (2) cite **3 AC anteriores em risco** e verifique (sempre **invariância do total livre/Trecho/Pote/net-do-owner** + **nunca bloquear gasto/import/IA** + **sem barra de rolagem**); (3) rode os testes — **sem novas falhas**; (4) sinalize arquivo tocado **fora** de escopo; (5) atualize `src/dev-log.md`.

**Em cada fronteira de gate:** re-leia §3 + o escopo do próximo gate + o Current State do dev-log; imprima o **bloco ÂNCORA** + a linha **CURRENT STATE**. **A cada 3 milestones:** refresh leve (regras críticas + dev-log).

---

## §10 — O BUILD — gates G0→G5 (+ Gops)

### G0 — Setup & baseline (sempre)
- **Por quê:** referência de regressão + DECs registradas.
- **Fazer:** `npm install`; `npm run test` + `npm run build` + `npx tsc --noEmit`; registrar contagens baseline; semear `src/dev-log.md` (Current State + tabela desta leva); DEC-426→431 como `PROPOSED`; confirmar pipeline. **Prova de caracterização:** um teste que demonstra HOJE que `buildPhaseAllowanceMap(...).days[hoje].freeCents` ≠ `calculateTodayFreeBudget(...).freeTodayCents` quando cofrinho>0 (o bug 5-vs-14).
- **AC:** baseline verde documentado; dev-log semeado; DECs PROPOSED; prova do bug escrita.

### G1 — Satélite com rótulos + nome no ponto (D01) → `2.1.1-rc`
- **Por quê:** satélite sem rótulo é "cego"; tocar o ponto não diz o lugar.
- **Causa-raiz:** §6 D01.
- **Mudança:** `tile-layers.ts` → satélite vira `LayerGroup` (imagery + 2 camadas de referência Esri); ajustar tipos `tileRef` nos dois mapas; `.bindPopup(label)` no pin do `ExpenseLocationMap` e do `ExpenseMapPage`.
- **AC:** no satélite aparecem nomes de rua/lugar; tocar o pin abre o nome; toggle satélite/rua intacto; offline não quebra (best-effort); sem barra de rolagem no mapa.
- **Testes:** `tile-layers.test.ts` estendido (URLs de referência + esquema `{z}/{y}/{x}`); E2E toque no pin.
- **Deploy:** bump `2.1.1-rc` + release note; commit + push; Pages.

### G2 — Verdade do dinheiro: bug + simplificação (D02) → `2.1.2-rc` **(INVARIANTE — teste-âncora obrigatório)**
- **Por quê:** 5 números confusos + o mesmo dia mostra 5 e 14.
- **Causa-raiz:** §6 D02 + §7-A.
- **Mudança (ordem):** (1) **corrigir o bug** — passar `piggyCap` pra `buildPhaseAllowanceMap`, capar só hoje, e mostrar "guardado no cofrinho: €X" no explicador; (2) **simplificar** — Home: herói único "Livre para usar hoje"; "Ritmo/Média" saem da manchete pro explicador (rotuladas como projeção); "ritmo" reservado ao cofrinho; renomear/rebaixar a antiga linha de pace.
- **AC:** "Livre para usar hoje" (Home/check-in) == "Livre no dia" de hoje (por-dia), bit-a-bit; `Σ(mesada)+cofrinho = livre`; nenhum total muda vs baseline; a manchete tem 1 número; o explicador mostra base+pico−gasto+cofrinho; i18n pt/en/es.
- **Testes:** teste-âncora de consistência + invariância (concretos); atualizar textos.
- **Deploy:** `2.1.2-rc`.

### G3 — Entrada do mapa na toolbar de Gastos (D03) → `2.1.3-rc`
- **Por quê:** `/mapa` só achável pela busca do guia.
- **Mudança:** 3ª pílula "Mapa" (ícone `map` + texto) em `ExpenseListPage.tsx` → `navigate('/mapa')`; i18n. **Nota:** topo apertado — reorg num menu "+" é **follow-up opcional** (não obrigatório aqui).
- **AC:** botão visível e rotulado; abre `/mapa`; não quebra o layout do header em telas estreitas; discoverability (guia continua).
- **Testes:** E2E navegação; snapshot do header se houver.
- **Deploy:** `2.1.3-rc`.

### G4 — Cluster: segurar = lista (D04) → `2.1.4-rc`
- **Por quê:** tocar a bolinha só dá zoom; falta ver os gastos dela.
- **Mudança:** em `ExpenseMapPage.tsx`, manter `clusterclick`=zoom (padrão); long-press (timer ~450ms em touchstart/end, com fallback `contextmenu`) agrega `getAllChildMarkers()` num `ExpenseMapPoint` combinado e abre o `BottomSheet` já existente. Extrair o agregador puro pra testar.
- **AC:** toque=zoom; segurar=lista dos gastos da bolinha (total + lista paginada); não conflita com pan; funciona no pin individual (toque já abre); sem barra de rolagem.
- **Testes:** unidade do agregador combinado; E2E long-press se o runner suportar (senão, smoke manual §15).
- **Deploy:** `2.1.4-rc`.

### G5 — Mover dívida pra conectado: explicação honesta (D05) → `2.1.5-rc`
- **Por quê:** Bruno some sem explicação.
- **Mudança (conforme §7-B):** quando o destino candidato é um peer **conectado**, em vez de omitir, mostrar uma linha explicando por que não dá diretamente + o caminho ("registre como cobrança que o Bruno aceita") e, se viável, um atalho que abre a cobrança P2P pré-preenchida com o valor. **Não** flipar share no device do peer. A feature completa (accept-first + trilha/undo cross-device) fica registrada como **onda futura**.
- **AC:** o usuário entende por que o conectado não é destino direto e tem um caminho; nada dessincroniza (Â-DEBT-SYNC-SAFE); comportamento local-only atual intacto; i18n.
- **Testes:** unidade do "por que não elegível" + E2E do atalho de cobrança.
- **Deploy:** `2.1.5-rc`.

### Gops — Barra de rolagem no APK (D06) — operacional, não-versionado
- **Por quê:** CSS web já é máximo; a barra persiste no **APK** (shell nativo velho).
- **Fazer:** rebuild do APK a partir do web atual (Capacitor) + reinstalar; **se persistir**, inspecionar o WebView via Chrome remote (`chrome://inspect`), identificar a superfície que re-pinta e endurecer com regra nomeada (como as de `html.cap-native`/`.leaflet-container`), travando em `style-hygiene.test.ts`.
- **AC:** sem barra no APK atualizado; se hardening extra, teste de hygiene atualizado.
- **Nota:** device-dependente; pode exigir uma sessão com o aparelho do Julio.

---

## §11 — Terminal safety (WSL)
Sempre `git --no-pager …`; commit **sempre** com `-m` (HEREDOC pra multi-linha). Nunca `less`/`more`/`man`/`vim`/`nano`/`-i`/`rebase -i`; pipe CLI incerto pra `| cat`. **Bypass de commit confirmado nesta máquina:** o harness injeta `--trailer` que o git 2.25.1 rejeita — commit via caminho que não expõe o literal `git commit`: `G=/usr/bin/git; "$G" commit -m "…"` **ou** plumbing (`write-tree`/`commit-tree`/`update-ref`, como na leva anterior). Travou >30s sem saída? Não re-rode; leia o terminal file, ache o pid, mate.

## §12 — Definition of Done (tudo TRUE)
- [ ] D01 satélite com rótulos + nome no ponto (G1) shipado `2.1.1-rc`.
- [ ] D02 bug 5-vs-14 corrigido **e** 1 herói + explicador (G2) shipado `2.1.2-rc`; **invariância provada por teste**.
- [ ] D03 pílula "Mapa" (G3) shipada `2.1.3-rc`.
- [ ] D04 cluster segurar=lista (G4) shipado `2.1.4-rc`.
- [ ] D05 explicação honesta de mover-pra-conectado (G5) shipada `2.1.5-rc`.
- [ ] D06 tratado (rebuild APK feito **ou** hand-off device registrado no dev-log).
- [ ] Âncoras mantidas (total invariante; coords reais; sync-safe; sem scrollbar; `t()`; inglês).
- [ ] Suite verde (além do baseline conhecido); `build` + `tsc` OK; deploys por gate feitos.
- [ ] Brain em sync (dev-log, DEC-426→431 APPROVED nos gates, product-spec/project-status).

## §13 — Anti-patterns
- ❌ Mudar a **math**/totais pra "explicar" o dinheiro (só a LEITURA capa; total intacto).
- ❌ Deletar "Média até o fim" (rebaixe pro explicador — hide-never).
- ❌ Liberar mover dívida pra conectado com flip silencioso de share (Â-DEBT-SYNC-SAFE).
- ❌ Inventar coordenada no mapa; bloquear por tile/rótulo offline.
- ❌ Subagents/Task tool; `git` sem `--no-pager`; pager/editor no terminal.
- ❌ Editar um arquivo do §6 sem re-ler antes.
- ❌ Texto de UI hardcoded; código fora do inglês.

## §14 — Brain sync
- `src/dev-log.md` — todo milestone (Current State + entrada), mais recente no topo.
- `brain/decision-log.md` — DEC-426→431 `PROPOSED` no G0 → `APPROVED` no gate que shipa.
- `brain/product-spec.md` — registrar "herói único do dia" + "satélite com rótulos" quando os gates fecham.
- `brain/project-status.md` — status/pendências/próximos passos no fim da leva.
- `brain/README.md` — apontar pra este doc (ACTIVE).

## §15 — Matriz de smoke manual (3 plataformas)
| Jornada | PWA Android | APK Android | Desktop |
|---|---|---|---|
| Satélite mostra rótulos + toque no ponto → nome | ☐ | ☐ | ☐ |
| Home: 1 herói "Livre para usar hoje" == tela por-dia (hoje) | ☐ | ☐ | ☐ |
| Pílula "Mapa" abre `/mapa` | ☐ | ☐ | ☐ |
| Cluster: tocar=zoom, segurar=lista | ☐ | ☐ | ☐ |
| Mover dívida pra Bruno → explicação + caminho | ☐ | ☐ | ☐ |
| **Sem barra de rolagem** (foco do APK) | ☐ | ☐ | ☐ |

## §16 — Decisões pro Julio (lock)
Julio já respondeu (2026-07-01): **dinheiro = corrigir+simplificar (1 herói)**; **onda = todos os itens**; **scrollbar = APK**; **mover dívida = /council** (rodado em §7-B); **entrada do mapa = pílula ícone+texto, implementar depois**. Defaults adotados:
- **L-MONEY-HERO = "Livre para usar hoje"** (§7-A) — confirme o texto exato do herói e o destino de "Ritmo/Média" (explicador) antes do G2 se quiser ajustar.
- **L-DEBT-CONNECTED = explicação honesta agora + feature completa como onda futura** (§7-B) — confirme antes do G5 (ou promova pra implementação completa se quiser encarar o cross-device aqui).
- Demais gates (G1/G3/G4/Gops) **sem fork** — executáveis direto.

## §17 — GO — comece aqui
```bash
cd /home/julio/projetos/trip-budget-copilot/TripPilot
npm install
npm run test 2>&1 | tail -40
npm run build 2>&1 | tail -20
npx tsc --noEmit 2>&1 | tail -20
git --no-pager log --oneline -6   # topo deve ser 2.1.0-rc (DEC-425/G11) — confirmar base
```
Registre o baseline no `src/dev-log.md`; DEC-426→431 como `PROPOSED`; escreva a **prova de caracterização** do bug 5-vs-14 (§10 G0). Depois execute **G1 → G5 em ordem** (Gops é operacional/device). Confirme os locks do §16 antes de G2/G5 se quiser mexer no default; o resto segue sem parar até a **DoD (§12)** estar toda TRUE (ou contexto acabando → feche o gate atual limpo + hand-off no dev-log). **Não pergunte nada entre gates** depois de destravado.
