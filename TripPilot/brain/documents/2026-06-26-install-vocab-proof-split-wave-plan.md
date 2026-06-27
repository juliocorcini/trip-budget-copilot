# Frente "Distribuição & Clareza" — Plano de implementação

> **Data:** 2026-06-26 · **Baseline:** v1.4.7-rc (master, no ar) · **Autor:** sessão inline (1 request, sem subagents)
> **Status:** PLANO — aguarda decisões do Julio nos pontos marcados ⛳ antes de implementar.
> **Idioma:** documento em PT-BR (idioma do pedido); todo código/IDs em inglês.

Este documento reúne **tudo que vamos implementar** nesta frente, com estado atual verificado no
código, decisões (incluindo 2 conselhos rodados inline) e escopo por item. Foi escrito para virar,
em seguida, um orchestrator/leva de implementação.

---

## 0. O que vamos implementar (resumo)


| #     | Item                                                                                                       | Tipo        | Depende de decisão?                           |
| ----- | ---------------------------------------------------------------------------------------------------------- | ----------- | --------------------------------------------- |
| **A** | Instalar o app: nudge Android (PWA nativo + APK), infográfico iOS, tabela comparativa App×PWA×Web, chooser | Feature     | ⛳ sim (atrito do APK / "web não recomendado") |
| **B** | Sumir com a barra de rolagem (regressão) + teste forte que nunca deixe voltar                              | Bug P1      | ⛳ sim (onde você está vendo a barra)          |
| **C** | Renomear "Trecho/Fundo" para nomes que soem a **dinheiro**                                                 | Vocabulário | ⛳ **sim** (qual sistema de nomes)             |
| **D** | Anexar **comprovante** a pagamentos entre usuários (P2P) + confirmação com prova                           | Feature     | ⛳ sim (limite/retention da imagem)            |
| **E** | Explicar **bem** as 2 opções de divisão no chooser do FAB                                                  | UX/copy     | não (recomendação pronta)                     |


---

## 1. Estado atual verificado (para não reinventar)

Antes de planejar, varri o código. Boa parte da infra **já existe** — o trabalho é
**surfacing/fortalecimento**, não construir do zero:

- **Instalação (PWA):**
  - `src/utils/pwa.ts` → `captureInstallPrompt()` captura o `beforeinstallprompt` no boot e
  `promptAppInstall()` dispara o **install nativo do PWA** (Android/Chrome). Retorna
  `accepted | dismissed | unavailable`. (DEC-135)
  - `src/hooks/useInstallPrompt.ts` → expõe `{ available, install }` para a UI (true só quando
  instalável e ainda não instalado).
  - `src/utils/platform.ts` → `isIosDevice()`, `isStandaloneDisplayMode()`,
  `webPlatformTag()` (`ios-web | ios-pwa | android-web | android-pwa | web`). Já dá pra fazer
  nudge por plataforma e medir conversão.
  - Hoje o install aparece **só** em: `SettingsPage` (botão "Adicionar à tela inicial" +
  dica iOS quando não-standalone) e `DashboardPage` (CTA de storage com texto iOS
  "Compartilhar → Adicionar à Tela de Início"). É discreto e atrelado à mensagem de backup,
  não a um fluxo dedicado de "instale o app".
  - **APK JÁ ESTÁ NA NUVEM:** `https://trippilot.pages.dev/trippilot.apk` → **HTTP 200, 8,47 MB**.
  Referenciado em `public/version.json` (`apkUrl`). Ou seja: dá pra oferecer o download do APK
  hoje — só não está exposto num fluxo bom.
- **Barra de rolagem:** `src/styles/globals.css` (linhas ~125–200) já tem o lock global do
DEC-331 (`*::-webkit-scrollbar{display:none!important}`, `scrollbar-width:none!important` em
`html,body,`*, regra explícita `html/body::-webkit-scrollbar`, e até o fix de zoom
`html.cap-native #root`). O teste `src/tests/unit/components/style-hygiene.test.ts` tem 4
asserts fortes e **passa (16/16)**. → A barra que "voltou" é um **vetor não coberto** (uma tela
nova, um container específico, ou desktop), não a ausência da regra.
- **Divisão (FAB → Dividir):** `src/components/FAB.tsx` chama `onDivide()` →
`src/features/split/DivideChooserSheet.tsx` mostra **2 cartões**: "Dividir uma conta" (`/split/scan`)
e "Divisão em grupo" (`/groups`). Copy atual existe (`divideChooser.`*) e é razoável, mas o
usuário ainda erra a escolha.
- **Pagamentos P2P:** máquina de estados pura `unpaid → marked → confirmed (+contested/cancelled)`
(DEC-353/354), timeline append-only `GroupActivity[]`, e o payload de share é **E2E** e
**nunca legível pelo Worker** (DEC-207). É aí que o comprovante se encaixa.

---

## 2. Item A — Instalar o app (nudge + APK + comparação)

### Problema (suas palavras)

Quem usa pela web devia ser empurrado pro app — "no app é muito melhor". No iPhone já existe o
aviso de "Compartilhar → Adicionar à Tela de Início" (e você fez um **infográfico** lindo pra isso).
No Android dá pra disparar a instalação nativa (1 toque). E o APK existe — então queremos oferecer:
instalar PWA (fácil) **ou** baixar o APK (mais poderoso), com uma **tabela comparativa** App × PWA ×
Web deixando claro que **só web não é recomendado** — sem ser chato a ponto de irritar.

### Decisão de produto

Um **fluxo único "Instalar o TripPilot"**, plataforma-aware, acessível de um nudge dispensável e do
Settings. Caminho **recomendado por plataforma**:

- **Android:** 1º **Instalar como app** (PWA nativo via `promptAppInstall()` — 1 toque, sem atrito);
2º **Baixar APK** (mais recursos, mas avisa do atrito de "fontes desconhecidas" e cai pro PWA se falhar).
- **iPhone/iPad:** **infográfico** (4 passos no Safari) + aviso "use o Safari, não outro navegador".
iOS não tem APK nem `beforeinstallprompt` — o caminho é o A2HS manual.
- **Desktop/web:** instalar o PWA; deixar claro que ficar só na aba não é o recomendado.

### Escopo

- **A1 — `InstallSheet` (novo componente) plataforma-aware.** Usa `webPlatformTag()` para escolher o
conteúdo. Reusa `useInstallPrompt()` (não recria captura de evento).
- **A2 — Android:** botão primário "Instalar como app" (`promptAppInstall()`); se `unavailable`
(já instalado ou navegador sem suporte), esconde/explica. Botão secundário "Baixar APK"
(`apkUrl` do `version.json`) com nota curta de "vai pedir permissão de fontes desconhecidas — é
normal" e **fallback explícito**: "deu erro/bloqueou? instale como app (acima)".
- **A3 — iOS:** render do `public/guides/ios-install.png` (já commitado) + aviso Safari. Detectar
navegador não-Safari no iOS e reforçar "abra no Safari".
- **A4 — Tabela comparativa** App (APK) × PWA × Web: o que cada uma habilita (offline, notificações,
ícone na tela, durabilidade dos dados, atualização). Web = **"não recomendado"** visível.
(Conteúdo data-driven, i18n pt/en/es.)
- **A5 — Nudge não-chato:** banner dispensável para `*-web` (não-standalone), com **cap de
frequência** (ex.: reaparece a cada N dias / após M sessões; "não mostrar de novo" persistido em
settings). Nunca em cima de fluxo crítico (saída ativa etc.).
- **A6 — Telemetria:** marcar exibição/aceite/dispensa do nudge e plataforma (já temos
`webPlatformTag`) p/ medir conversão web→PWA/APK.

### Arquivos prováveis

`src/features/install/InstallSheet.tsx` (novo), `src/features/install/install-content.ts` (tabela
data-driven, novo), `src/hooks/useInstallPrompt.ts` (reuso), `src/utils/platform.ts` (reuso, talvez
helper `isSafari`), `DashboardPage`/`SettingsPage` (pontos de entrada + banner), i18n pt/en/es,
`public/guides/ios-install.png` (já lá).

### Aceitação (AC)

- Android web: vejo "Instalar como app" e instala em 1 toque; vejo "Baixar APK" com aviso e fallback.
- iOS web (Safari): vejo o infográfico + aviso; em não-Safari, vejo "abra no Safari".
- Existe tabela App×PWA×Web com "web não recomendado".
- Banner é dispensável e respeita cap de frequência; some quando standalone.

### Riscos / pontos ⛳

- Atrito real do APK (Play Protect / fontes desconhecidas) pode frustrar → por isso PWA é o
**primeiro** caminho no Android e o APK vem com aviso + fallback. **Decidir:** topamos manter o APK
como opção "avançada" (sim, recomendado) ou escondê-lo atrás de "tive problema com o app"?
- "Não ser chato": definir o cap (sugestão: banner some por 7 dias ao dispensar; nunca mais se
"não mostrar"). **Decidir** os números.

---

## 3. Item B — Sumir com a barra de rolagem (regressão) + teste forte

### Problema

A barra de rolagem que tínhamos removido (com teste) **voltou**. Tirar de qualquer lugar do app e
blindar com teste forte pra **nunca** voltar.

### Estado atual

O lock global do DEC-331 está no `globals.css` e o teste `style-hygiene.test.ts` passa (16/16). Logo,
a regra global existe — a barra reapareceu por um **vetor não coberto**. Hipóteses (ordem de
probabilidade):

1. **Tela/colunas novas do G8/G9** (Pessoas, settle Variante O, group invite) com container
  `overflow-y:auto` que, em algum Android WebView/Chrome, pinta a barra apesar do `*`.
2. **Desktop/web** (você falou "todo mundo no web") — em desktop a barra do documento aparece se
  alguma regra root foi afetada.
3. Algum container com **stacking/transform** próprio (o fix `html.cap-native #root` sugere que isso
  já mordeu antes no modo zoom/nativo).

### Escopo

- **B1 — Reproduzir** na build ao vivo na tela exata (⛳ preciso saber **onde** você vê: tela + iPhone/
Android/desktop + PWA ou aba).
- **B2 — Identificar o container** ofensor (inspeção CDP/DevTools).
- **B3 — Estender o lock** DEC-331 pra cobrir o vetor (provável: garantir o `::-webkit-scrollbar` nos
containers internos e/ou `html.cap-native`-style para o caso achado; remover `overflow-scroll`
residual se houver).
- **B4 — Reforçar o teste:** adicionar asserts ao `style-hygiene.test.ts` para o vetor novo (ex.:
cobrir o container/`overflow` específico) e, se fizer sentido, um **smoke E2E** (Playwright) que
abre as telas-chave e falha se `scrollWidth/clientWidth` revelar uma barra renderizada.

### AC

- Nenhuma barra visível em nenhuma tela (mobile PWA, mobile web, desktop web).
- Teste novo falha de propósito se alguém reintroduzir o vetor.

### Risco / ⛳

- Sem o "onde", o B1 vira caça às cegas. **Me diga a tela e o dispositivo** e isto vira fix rápido.

---

## 4. Item C — Renomear "Trecho/Fundo" (Conselho 1)

### Problema

Você não concorda com **"Trecho"** para o bucket de dinheiro: "trecho de quê? parece parte da
viagem, mas nada a ver com dinheiro." Procede — "trecho" evoca a perna do roteiro, não grana.

> Lembrete: o DEC-228 (já no ar em 1.4.5–1.4.7-rc) trocou o antigo "Fundo" por **Trecho** (pool
> ligado a fase) / **Pote** (pool global/meta) / **Reserva** (genérico). Você objetou só ao "Trecho".

### Conselho 1 — Council · nomes do bucket de dinheiro

*Inline nesta sessão (1 request, sem subagents). Perspectivas: Advogado do usuário, Estrategista, Arquiteto, Crítico.*

**Decision Brief (neutro).** O TripPilot organiza o dinheiro da viagem em *buckets*. Dois tipos:
(1) ligado a uma **fase/perna** da viagem — gasto no dia a dia daquela etapa (hoje "Trecho",
`scope=linked_phases`); (2) **meta** avulsa, não ligada a fase — dinheiro guardado pra um objetivo
(hoje "Pote", `scope=global`); + um genérico ("Reserva"). Precisamos de nomes que **soem a dinheiro**,
curtos, naturais em PT-BR (e idealmente en/es). IDs de código **não mudam** (só vocabulário de UI).
Já existe um "nature chip" que recebe esses rótulos. **Viés a resistir:** acabamos de shipar
"Trecho/Pote" — há pressão de custo afundado pra manter; julgar os nomes pelo mérito. Coexistir com
**"Carteira"** (conta de dinheiro real: banco/dinheiro vivo) — o bucket é PARA QUÊ, a carteira é ONDE.

**Advogado do usuário** — Otimiza clareza imediata e calor; teme fricção e jargão. O usuário pensa
"quanto posso gastar **em Lisboa**?" e "quanto já juntei pros **souvenirs**?". A dupla ideal separa
**gastar agora** de **guardar pra depois**. "Caixa de Lisboa" (a grana de Lisboa) + "Cofrinho/Pote de
Souvenirs" (o que tô juntando) é instantâneo e quente. "Trecho" obriga tradução mental. **Rec:**
*Caixa* (fase) + *Pote* (meta). **Confiança:** ALTA. **Outros podem não ver:** o par precisa
contrastar verbo (gastar × guardar), não só escopo.

**Estrategista** — Otimiza posição de marca e padrão de categoria; teme nome "fofo" que não escala e
não conversa com concorrentes (YNAB/Mobills falam *orçamento*, *meta*, *envelope*). Um app de
**orçamento** de viagem ganha com o vocabulário-âncora da categoria: **"Orçamento de Lisboa"**
(inequívoco, ótimo em en *Budget*/es *Presupuesto*) + **"Meta de Souvenirs"** (en *Goal*/es *Meta*).
Mais sério, melhor SEO/onboarding, traduz limpo. **Rec:** *Orçamento* (fase) + *Meta/Pote* (meta).
**Confiança:** MÉDIA-ALTA. **Outros podem não ver:** "Trecho" não tem tradução boa (en "leg/stretch"
soa estranho num app de dinheiro) — qualquer nome-dinheiro melhora o i18n.

**Arquiteto** — Otimiza consistência entre superfícies e i18n; teme colisão semântica e migração
ruidosa. Risco central: **"Caixa" colide com "Carteira"/dinheiro em caixa** — dois recipientes de
dinheiro confundem (ONDE × PARA QUÊ). "Orçamento" nunca colide (é plano, não lugar). A troca é barata
(rótulos i18n + chip + `poolNature` labels; reusa o pipeline do DEC-228) **se** trocarmos só o
substantivo problemático e mantivermos "Pote" (que você não contestou). Trocar os dois multiplica
churn de tradução. **Rec:** trocar **só** Trecho→*Orçamento* (ou *Verba*), manter *Pote* + *Reserva*.
**Confiança:** ALTA. **Outros podem não ver:** o genérico "Reserva" também é money-word — manter.

**Crítico** — Otimiza achar a falha; teme ambiguidade nova pior que a antiga. "Caixa" tem o problema
Carteira. "Orçamento" tem o problema do **duplo nível**: o app inteiro é um orçamento; "o orçamento de
Lisboa" vs "o orçamento (da viagem)" pode embaralhar o todo com a parte. "Verba" resolve dinheiro mas
é **formal/corporativo** (pouco quente). Nenhum nome é perfeito: o teste real é *"X de Lisboa"* e
*"X de Souvenirs"* lidos rápido sem confundir com carteira nem com o orçamento global. **Rec:** evitar
"Caixa"; preferir *Orçamento* (fase) **com** qualificador visual de fase, ou *Verba* se quiser
distância do orçamento-todo. **Confiança:** MÉDIA. **Outros podem não ver:** validar com 1 frase real
na Home ("Livre hoje em [X]") antes de migrar tudo.

**Red Team (matar a opção líder "Orçamento de Lisboa").** Se o app já se vende como "orçamento de
viagem", chamar cada fase de "orçamento" diz ao usuário que ele tem **N orçamentos** — exatamente a
fragmentação que confunde iniciantes. Pior em telas que somam tudo ("orçamento total" vs "orçamentos
por fase"). Nesse cenário, um substantivo **distinto do guarda-chuva** (Verba/Caixa/Pote) comunica
melhor "isto é uma **fatia** do orçamento", não outro orçamento.

**Síntese (Chair).**

- **Consenso:** "Trecho" sai; o substituto tem que ser money-word; "Pote" e "Reserva" ficam.
- **Tensões:** *Caixa* (quente, mas colide com Carteira) × *Orçamento* (padrão, mas colide com o
orçamento-todo) × *Verba* (dinheiro e sem colisão, mas formal).
- **Recomendação:** o lente que mais pesa aqui é o **Arquiteto** (colisão semântica é o maior risco
real de UX num app onde já existe "Carteira" e "orçamento"). Proponho **dois sistemas** pra você
escolher (decisão é sua):
  - **Sistema 1 (recomendado — mínima colisão):** fase = **"Verba"** ("Verba de Lisboa"),
  meta = **"Pote"**, genérico = **"Reserva"**. Money-word, sem bater em Carteira nem no orçamento-todo;
  en *Allowance/Budget* + *Pot* / es *Partida/Fondo* + *Bote/Fondo*.
  - **Sistema 2 (mais quente):** fase = **"Caixa"** ("Caixa de Lisboa"), meta = **"Pote"**,
  genérico = **"Reserva"** — só se aceitarmos mitigar a confusão com Carteira (ex.: Carteira sempre
  com ícone de banco/dinheiro e Caixa com ícone de orçamento).
  - *(Alternativa de categoria:* fase = **"Orçamento da fase"** se você priorizar padrão de mercado e
  i18n sobre o risco todo×parte.)*
- **Condições:** validar a frase da Home com o nome escolhido antes da migração em massa.
- **O que viraria o jogo:** se um teste rápido mostrar que usuários NÃO confundem "Caixa" com
"Carteira", o Sistema 2 (mais quente) vence.
- **Confiança:** MÉDIA-ALTA.

⛳ **Decisão do Julio:** escolher Sistema 1 (Verba+Pote), Sistema 2 (Caixa+Pote) ou a alternativa
(Orçamento da fase). Migração reusa o pipeline do DEC-228 (i18n pt/en/es + labels do `poolNature`),
custo baixo.  
  
 Sistema 1 (Verba+Pote)

### Escopo da migração (após decisão)

Trocar só o rótulo do bucket de fase em pt/en/es; manter Pote/Reserva. Atualizar `funds.nature_`*,
títulos (`funds.title` = "… e potes"), chips (`FundsPage`, `ExpenseListPage`), `divideChooser`/help
onde citar, e os "stragglers" já mapeados. Atualizar decision-log (DEC-228 → revisão de nome).

---

## 5. Item D — Comprovante em pagamentos P2P

### Problema

Em qualquer transferência entre celulares (alguém me paga / eu pago alguém / quito uma dívida), quero
**anexar um comprovante** (imagem). Quando eu digo "paguei essa dívida", anexo a prova; o **dono da
dívida** vê a mensagem "fulano pagou" **com o comprovante** e pode **confirmar**. Não expor dados
bancários — só a imagem de prova é opcional.

### Estado atual (onde encaixa)

- Máquina de estados de pagamento `unpaid → marked → confirmed` (DEC-353/354); quem recebe confirma.
- Timeline `GroupActivity[]` append-only (cap 200) que **viaja no payload E2E** e no backup, **nunca
legível pelo Worker** (DEC-207). O ping P2P (DEC-352) avisa o destinatário.
- Já temos captura/▢ de imagem no app (recibos — `ReceiptScanPage`, `GroupImage`), então há boundary
de imagem reaproveitável.

### Design proposto

1. Ao marcar **"paguei"** (`marked`), abrir opção **"anexar comprovante"** (câmera/galeria),
  **opcional**.
2. **Comprimir forte** a imagem (a timeline anda no payload E2E **limitado** — DEC-207). Definir teto
  (ex.: lado máx ~1000px, JPEG ~70%, alvo < ~120 KB). Guardar como blob local + referência no evento
   `payment_marked` (campo `proofRef`/`proofThumb`).
3. **Transmissão:** anexar uma versão pequena ao evento que já viaja no payload E2E (criptografado).
  ⛳ **Decisão:** mandar a imagem **inline** no payload (simples, mas pesa o payload — talvez só
   thumbnail) **ou** só o thumbnail inline + imagem cheia sob demanda via mailbox/relay (mais
   trabalho). Recomendo **começar com thumbnail comprimido inline** (1 imagem, pequena) e avaliar.
4. **Confirmação:** quem recebe vê "fulano pagou" + miniatura do comprovante → abre → **Confirmar**
  (vira `confirmed`) ou **Contestar**. O comprovante entra na timeline como prova do evento.
5. **Privacidade:** E2E only (DEC-207); nada de dado bancário estruturado — **só a imagem** que o
  usuário escolher anexar. Sem expor "para onde mandei".

### Arquivos prováveis

`domain/group-split/`* (tipo do evento `payment_marked` + `proof`), `group-split-orchestrators.ts`,
`p2p-orchestrators.ts` (anexar no announce), schema do share-payload (Zod) + backup (migração),
`GroupSplitDetailPage.tsx` (anexar ao marcar + ver/confirmar), util de compressão de imagem, i18n.

### AC

- Ao marcar "paguei", consigo anexar 1 comprovante (opcional) e ele aparece pro recebedor confirmar.
- Imagem comprimida abaixo do teto; payload E2E continua dentro do limite; guest links não quebram
(schema aceita o campo novo).
- Sem comprovante, o fluxo atual segue idêntico.

### Riscos / ⛳

- **Tamanho do payload E2E** é o maior risco (timeline + imagem). ⛳ Decidir teto e se vai inline vs
sob-demanda. Recomendo thumbnail inline no V1.
- **Retenção:** comprovante fica pra sempre na timeline (cap 200) ou expira? ⛳ Decidir.
- iOS eviction (sem persistência) pode perder blobs locais — alinhar com a estratégia de backup.

---

## 6. Item E — Explicar as 2 opções de divisão (Conselho 2)

### Problema

No FAB → **Dividir** abrem 2 opções (`DivideChooserSheet`). É **ali** que a diferença tem que ficar
clara, pra o usuário saber qual escolher.

> Copy atual: título "Como você quer dividir?", subtítulo "São duas coisas diferentes — escolha a que
> resolve o seu caso." · **Dividir uma conta**: "Uma conta agora, na mesa: por item, por igual ou só
> o seu — com mesa ao vivo." · **Divisão em grupo**: "Várias despesas de um grupo ou evento
> (Tricount): vários pagadores e o app calcula quem deve a quem."

### Conselho 2 — Council · como explicar a escolha

*Inline nesta sessão (1 request, sem subagents). Perspectivas: Advogado, Crítico, Arquiteto, Estrategista.*

**Decision Brief (neutro).** Dois fluxos intactos atrás de um chooser: **"Dividir uma conta"**
(`/split/scan`) = UMA conta agora (mesa ao vivo; por item/igual/só o seu); **"Divisão em grupo"**
(`/groups`) = MUITAS despesas ao longo do tempo, vários pagadores, o app acerta quem deve a quem
(estilo Tricount/Splitwise). Copy atual é decente mas o usuário ainda erra. Só melhorar a explicação
(copy + dicas visuais/exemplos); **não** virar wizard. **Viés a resistir:** achar que "mais texto"
resolve — o chooser precisa decidir em ~2s.

**Advogado** — O destravador é **exemplo concreto**, não definição. O usuário reconhece a SITUAÇÃO
dele, não a categoria. Uma linha de exemplo por cartão ("Ex.: o jantar de hoje, €80 pra 4" / "Ex.: a
viagem com os amigos — casa, carro, mercado"). **Rec:** título-pergunta + 1 exemplo real por opção.
**Confiança:** ALTA. **Outros podem não ver:** o exemplo tem que ser do mundo do usuário (mesa × viagem).

**Crítico** — Texto demais num bottom-sheet mata a decisão. Dois parágrafos já é muito. O risco não é
falta de info, é **falta de DISCRIMINADOR** — uma única frase que separa os dois sem ambiguidade.
**Rec:** um discriminador binário no subtítulo: **"É só uma conta agora, ou várias contas ao longo do
tempo?"** e cada cartão responde 1 lado. Cortar o resto. **Confiança:** MÉDIA-ALTA. **Outros podem não
ver:** se ambos têm "ao vivo/cálculo", o usuário não distingue — destacar **1 conta × muitas contas**.

**Arquiteto** — Otimiza consistência com o resto do app. Os nomes têm que bater com onde levam:
"Dividir uma conta" → tela de conta/recibo; "Divisão em grupo" → Grupos/Tricount. **Rec:** manter os
títulos, mas ancorar com um **selo de tempo/escopo** ("agora, 1 conta" × "a viagem toda") e ícones que
reforcem (1 recibo × várias pessoas). Opcional: um link "Não sei qual escolher?" que faz **1 pergunta**
e roteia. **Confiança:** MÉDIA. **Outros podem não ver:** reaproveitar o mesmo vocabulário no help.

**Estrategista** — Posicionamento: "Divisão em grupo" é o território **Splitwise/Tricount** (familiar);
"Dividir uma conta" é o diferencial do TripPilot (mesa ao vivo, scan). **Rec:** nomear o grupo com a
âncora conhecida — **"Grupo de viagem (tipo Tricount)"** — e vender a conta única como o rápido do dia
a dia. **Confiança:** MÉDIA. **Outros podem não ver:** citar Tricount reduz a carga de explicação (o
usuário já tem o modelo mental).

**Red Team (matar a opção líder "exemplos + discriminador").** Se cada cartão ganhar exemplo +
discriminador + selo, o sheet vira parede de texto e perde os 2s. Talvez a verdade seja que **dois
caminhos confundem por existirem**: o ideal poderia ser **um só** ("Dividir") que detecta (1 conta vs
grupo contínuo) e adapta — eliminando a escolha. Contra-argumento: os fluxos são realmente diferentes
e unificar a tela é caro/arriscado agora; o chooser barato com copy melhor entrega 80% do ganho.

**Síntese (Chair).**

- **Consenso:** o que falta é **discriminador + exemplo**, não mais definição; manter 2 cartões e os 2
fluxos.
- **Tensões:** riqueza (exemplos/selos) × concisão (2s). Resolver com **1 exemplo + 1 discriminador
curto**, nada além.
- **Recomendação (pronta, não bloqueia):**
  1. Subtítulo vira o discriminador: **"É uma conta agora, ou várias contas ao longo do tempo?"**
  2. Cada cartão ganha **1 linha de exemplo**: conta → *"Ex.: o jantar de hoje, €80 pra 4"*; grupo →
    *"Ex.: a viagem com os amigos — casa, carro, mercado"*.
  3. Selo de escopo no cartão: **"agora · 1 conta"** × **"contínuo · a viagem toda"**.
  4. (Opcional V2) link **"Não sei qual escolher?"** → 1 pergunta → roteia.
  5. (Opcional) renomear grupo p/ ancorar: **"Divisão em grupo · tipo Tricount"**.
- **Condições:** caber no sheet sem rolar; manter ícones distintos (1 recibo × várias pessoas).
- **O que viraria o jogo:** se a métrica mostrar que ainda erram muito, considerar o caminho único
auto-detectado (custo maior).
- **Confiança:** ALTA (é só copy/visual, reversível).

### Escopo

Editar `divideChooser.`* (pt/en/es) com discriminador + exemplos + selos; ajuste leve de layout no
`DivideChooserSheet.tsx` (linha de exemplo + chip de escopo). Sem mexer nos fluxos.

---

## 7. Sequenciamento sugerido + estimativas (Tier 3)

Ordem por **valor/risco e dependência de decisão** (datas dependem das suas escolhas ⛳):


| Ordem | Item                     | Por quê primeiro                                           | Estimativa Tier 3 |
| ----- | ------------------------ | ---------------------------------------------------------- | ----------------- |
| 1     | **E** — copy do chooser  | Pronto (sem decisão), valor imediato, baixíssimo risco     | ~1–2 h            |
| 2     | **B** — barra de rolagem | Bug P1; rápido **assim que você me disser onde aparece**   | ~1–3 h            |
| 3     | **C** — renomear bucket  | Reusa pipeline DEC-228; **precisa da sua escolha de nome** | ~2–4 h            |
| 4     | **A** — instalar app     | Maior; muita infra já existe (PWA/APK/telemetria)          | ~6–10 h           |
| 5     | **D** — comprovante P2P  | Mais delicado (payload E2E, schema, backup, privacidade)   | ~6–10 h           |


(Se preferir, A e D podem virar gates separados com checkpoint entre eles, no padrão da casa.)

---

## 8. Decisões pendentes do Julio (⛳ bloqueiam parte do trabalho)

1. **Nomes (Item C):** Sistema 1 **Verba + Pote** (recomendado), Sistema 2 **Caixa + Pote**, ou
  alternativa **"Orçamento da fase" + Meta/Pote**?
2. **Barra de rolagem (Item B):** em qual **tela** + **dispositivo** (iPhone/Android/desktop) e
  **PWA ou aba** você está vendo? (destrava o fix rápido)  
    
  android apk instalado mas apk antigo, barra de rolagem voltou a aparecer.
3. **Instalar (Item A):** manter o **APK** como opção avançada visível (recomendado) ou só como
  "tive problema"? E o **cap do banner** (sugestão: some 7 dias ao dispensar; some pra sempre se
   "não mostrar de novo").  
  Apk sempre como opção, para android, na verdade sempre o mais recomendado. some em 7 dias ok
4. **Comprovante (Item D):** teto de tamanho da imagem e **inline vs sob-demanda** (recomendo
  thumbnail inline no V1); o comprovante **expira** ou fica na timeline (cap 200)?  
  inline? precisa ter um lugar para colocar, não entendi, fazer o que o conselho achar melhor para o user..

## 9. Open questions (não bloqueiam o documento)

- Item A: queremos uma **página** `/install` dedicada além do sheet (p/ link compartilhável "instala aí")?  
ah é bom sim
- Item D: comprovante também para os **outros** tipos de transferência (não só dívida de grupo)?  
sim, não só duvuda de grupo, todas as dividas de qualquer gasto, se eu estou pagando uma divida para outra pesso, ter comprovante , o user enviar é opcional.
- Item E: medir taxa de erro do chooser exige um evento de telemetria — vale a pena no V1?  
n precisa.

---

### Anexos

- Infográfico iOS (4 passos Safari): `public/guides/ios-install.png` (commitado nesta frente).
- APK ao vivo: `https://trippilot.pages.dev/trippilot.apk` (HTTP 200, 8,47 MB).

