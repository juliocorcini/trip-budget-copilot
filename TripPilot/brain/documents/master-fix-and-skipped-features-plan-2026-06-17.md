# Master Fix & Skipped-Features Plan — Repasse Completo (2026-06-17)

> **O que é este arquivo:** um repasse completo do brain + código cruzando TUDO que
> foi pulado, adiado, implementado diferente do planejado, ou ficou stale/contraditório,
> com a causa-raiz, o plano de correção detalhado, conselho inline e anti-regressão de
> cada item — pensado para ser **a única base** que precisamos abrir para executar as
> correções no futuro.
>
> **Versão de partida:** `0.64.0` (apex `trippilot.pages.dev`, OTA sobre o APK nativo
> `0.50.0`). Qualidade atual: **1147 testes / 128 arquivos**, tsc 0, E2E 34/34.
>
> **Princípio inegociável (todas as âncoras valem):** **ZERO regressão** — nada some,
> só pode mudar de lugar/forma (ÂNCORA 9); meta/cofrinho/renda-futura read-only nunca
> entram no free-to-spend (ÂNCORA 11); check-in nunca grava (ÂNCORA 12); transferência
> entre pools conserva o total (ÂNCORA 13); GPS bruto 100% local (ÂNCORA 8); nunca
> bloquear registro (ÂNCORA 10); campos não-indexados não exigem migração (ÂNCORA 14/18).
>
> **Conselho:** rodado **inline** (4 lentes — Estrategista / Arquiteto / Crítico /
> Advogado do usuário), conforme `tech-lead-delegation.mdc` (sem subagents).
>
> **Política de verificação (fact-verification.mdc):** cada afirmação está marcada
> **[VERIFICADO]** (li o código/brain direto), **[A VERIFICAR]** (precisa device/repro)
> ou **[DECISÃO]** (precisa escolha do Julio antes de construir).

---

## 0. Sumário executivo

Repasse de **211 decisões logadas (DEC-001..DEC-211)**, do `project-status.md`,
`product-spec.md`, `technical-direction.md`, `implementation-phases.md`, dos planos das
duas rodadas de campo, dos épicos (receipt, shared link) e do `src/` (schema, budget,
tipos). Achados em três frentes:

1. **Integridade do brain (Parte A):** 8 documentos canônicos estão **defasados ou se
   contradizem** com as decisões novas (DEC-200..211). Os mais graves: `product-spec.md`
   ainda lista "sem backend / sem AI / sem import de recibo" como **fora de escopo**
   (contradiz DEC-206 e DEC-207), o `decision-log.md` tem um **buraco de 16 decisões**
   (DEC-185..199 + DEC-201 — todo o arco nativo + motion + post-animation foi entregue
   mas nunca logado), e o `technical-direction.md` lista **Zustand e Workbox** como stack
   travado (ambos removidos por DEC-068/082) e jura "no server / no remote database"
   (contradiz o KV/Worker do DEC-207).

2. **Funções que pulamos (Parte B):** 18 frentes adiadas/cortadas/parciais, da mais
   barata (planner empty state) à mais arquitetural (tipo de transação de **entrada/renda**,
   que não existe — `TransactionType = expense|transfer|settlement|adjustment`). Inclui
   todo o **lote nativo pendente** (F15 receber `.csv`, App Links de `/pair` e `/s/:id`,
   grant de GPS nativo do F14), os **limites honestos do shared link** (push com app
   fechado, real-time iOS-web, editar gastos de outros), e tech-debts antigos
   (floor automático, biometria, orquestradores, SW por plugin, E2E em CI).

3. **Bugs / desvios e backlog de verificação em device (Parte C):** nenhum bug **novo**
   confirmado no 0.64.0 (o time é disciplinado, sem TODO/FIXME soltos no código), mas há
   uma pilha grande de **ACs `[device]`-pendentes** (features nativas entregues e nunca
   validadas num Android físico) e um par de **smells de clareza** para confirmar.

As Partes D/E trazem a **priorização do conselho**, a **ordem de execução em ondas/gates**
(com o padrão de hardening) e a **Parte F** é o checklist de atualização do brain.

> **Importante (escopo desta tarefa):** este documento é **planejamento**. Ele NÃO altera
> código nem reescreve o brain ainda — lista exatamente o que mudar, onde e por quê, para
> implementarmos depois a partir daqui. As correções de brain da Parte A já estão prontas
> para aplicar (são baixo risco) e as de código da Parte B vêm com plano cirúrgico.

---

## 1. Metodologia & fontes lidas

| Fonte | O que extraí |
|------|--------------|
| `decision-log.md` (180 KB, DEC-001..211) | índice completo de decisões; achei o buraco DEC-185..199/201; deltas honestos (KV vs D1, ShareSignal vs SyncRoom) |
| `project-status.md` | topo atual (0.64.0) vs tabelas congeladas (~0.14–0.17); tech-debt table |
| `product-spec.md` | lista "NOT in Scope" contraditória; specs por feature |
| `technical-direction.md` | stack travado defasado; "no server" desatualizado |
| `implementation-phases.md` | D1–D5 entregue; **D6 "NOT STARTED"** (mas o nativo foi entregue) |
| `improvements-master-plan-2026-06-16.md` (rodada 1, G1–G8) | itens 1–20; deferrals; correção de topologia de deploy |
| `improvements-master-plan-2026-06-16-round2.md` (rodada 2, F + A–E + F14) | F1–F22; §7 pendências por design |
| `shared-participant-link-research-and-plan-2026-06-16.md` | gates S0–S9; S8/S9 deferidos; limites honestos |
| `receipt-ocr-item-split-research-2026-06-16.md` (via DEC-206/208/209) | G1–G4; on-device removido |
| `src/dev-log.md` (114 KB) | detalhe gate-a-gate; todos os `[device]`-pending e `[deferred]` |
| `src/data/db/schema.ts` | **schema real = v9** (5 tabelas device-local novas) |
| `src/domain/budget/budget.ts` | confirmei o "livre de verdade" (`calculateTrueFree`) |
| `src/domain/types/common.ts` | confirmei: **não há tipo de transação de entrada** |

---

# PARTE A — Integridade do brain (stale / contradições)

> ✅ **APLICADO 2026-06-17 (Onda 0).** A1–A7 foram corrigidos nos arquivos do brain (README,
> project-status, implementation-phases, product-spec, technical-direction, decision-log). A8
> (meetings-log / competitive-landscape) ficou como revisão leve pendente. O texto abaixo é o
> registro do diagnóstico e da correção exata aplicada.

> Estes são os "atualizamos algo que envolvia decisão do passado?" que você temia. Cada
> um vem com **o que está errado**, **por que importa** e a **correção exata**. Risco
> baixo (edição de doc), mas precisam ser feitos para o brain voltar a ser fonte da verdade.

### A1 — `README.md` do brain está congelado em 2026-06-08 [VERIFICADO]
- **Errado:** `> Last updated: 2026-06-08`; o índice diz `decision-log.md | All **113** decisions`
  e `implementation-phases.md | **6 deliveries**`. Hoje são **211 decisões logadas** e o
  projeto passou por 6 deliveries **+** R1–R6 + field reviews + 3 pacotes de expansão +
  arco nativo + receipt + shared link + 2 rodadas de campo.
- **Por que importa:** é a porta de entrada do brain; quem chega lê um retrato de um mês atrás.
- **Correção:** atualizar data; contagem de decisões (ver A6 sobre o buraco); reescrever a
  linha de phases ("6 deliveries + rounds + expansion packages"); adicionar ao índice os
  docs novos (`documents/` dos épicos, `src/dev-log.md` como log de execução vivo).

### A2 — `project-status.md`: topo atual, tabelas congeladas em ~v0.14–0.17 [VERIFICADO]
- **Errado:** o cabeçalho está em 0.64.0, mas a **"Status Summary"** e as seções abaixo dizem:
  - "Decision log: **165 decisions (DEC-001 to DEC-165)**" → são 211.
  - "Data model: 24 entities + `localSnapshots`; Dexie schema **v5**; backup **v5**" → schema
    real é **v9** (tabelas device-local: `localSnapshots` v5, `plannedPurchases` v6,
    `mailboxQueue` v7, `attachments` v8, `shareLinks` v9).
  - "Tests: **820 unit + 29 Playwright**" → **1147 unit / 128 arquivos + E2E 34**.
  - "Deploy: **v0.14.5** … production branch is **main**" → produção é **`master`**/apex,
    versão **0.64.0** (DEC-203 corrigiu a topologia: `--branch=main` cai em Preview).
  - "Implementation D1–D6: ✅ DONE" coexiste com `implementation-phases.md` dizendo D6 não
    iniciado (ver A3) — incoerência interna.
- **Correção:** atualizar a tabela Status Summary inteira; "Key Decisions Reference" e
  "Next Steps" (estão falando de re-testar v0.10.1/v0.8.0); "Blockers: None" pode ficar.
  Mover "Next Steps" para apontar a este plano.

### A3 — `implementation-phases.md`: D6 "NOT STARTED" [VERIFICADO]
- **Errado:** `> D6 (Native Layer) not started.` e a tabela final marca D6 como "NOT STARTED".
  Mas o **arco nativo (v0.28.0→v0.50.0)** entregou Capacitor 8, APK, notificações nativas,
  live-update (Capgo), permissões, etc. — D6 está **substancialmente entregue**.
- **Por que importa:** alguém planejando "o que falta" pode achar que o nativo é greenfield.
- **Correção:** marcar D6 **DELIVERED** (referenciando o arco nativo + DEC-204/205); nota de
  que o projeto migrou para entrega **por rodadas** depois do D5. Atualizar o **V2 Roadmap**:
  vários itens lá já foram entregues (Wise import, receipt scanning, multi-currency, trip
  templates, spending insights) — mover para "Entregue em V1-expandido"; deixar no V2 só o
  que de fato falta (login/contas, sync remoto multiuser, widget Android, push remoto).

### A4 — `product-spec.md` "V1 — Explicitly NOT in Scope" contradiz DEC-206/207 [VERIFICADO]
- **Errado (3 linhas agora falsas):**
  1. "**Remote database or backend** (… the Worker stores nothing …)" → **DEC-207** armazena
     **ciphertext** em **Cloudflare KV** (`SHARE_STORE`) + relay `ShareSignal`/`Mailbox`
     Durable Objects. O próprio DEC-207 diz: *"The product-spec 'V1 NOT in scope' line must
     be rewritten (README truth policy) at S0"* — **isso não foi feito.**
  2. "**PDF/receipt import**" → **DEC-206** entregou scan de recibo → itens → divisão.
  3. "**AI/LLM features inside the app**" → **DEC-206** usa **Groq** (vision LLM) via Worker `/ocr`.
- **Ainda verdade (manter):** sem login/contas; sem Play Store/App Store; sem iOS nativo
  (iOS é web); sem widget; sem push remoto; sem social/gamificação; sem monetização.
  "Map visualization" segue fora (o mapa da fase F4 é **calendário**, não mapa geográfico).
- **Por que importa:** é o documento que define o que o app **é**; está mentindo sobre 3
  capacidades centrais já no ar. Viola a Truth Policy do próprio brain.
- **Correção:** mover as 3 linhas para uma nova subseção **"V1 — In Scope com restrições"**:
  - *Backend mínimo, portável, E2E:* armazena só ciphertext (TTL + revoke), chave só no
    `#fragment`, portável (interface `ShareStore`, sem lock-in) — DEC-207.
  - *Import de recibo (foto → itens → divisão):* DEC-206/208/209.
  - *AI opcional (Groq, não treina nos dados, opt-in):* DEC-206/209.
  Adicionar as seções de feature do **receipt epic** e do **shared link** (hoje só vivem em
  `documents/` + dev-log, não na spec canônica).

### A5 — `technical-direction.md`: stack travado defasado + "no server" [VERIFICADO]
- **Errado:**
  - Tabela de stack lista "**State | Zustand**" — removido em **DEC-068** (`useAppData` +
    repositories).
  - "**PWA | vite-plugin-pwa (Workbox)**" — substituído por **SW escrito à mão** (DEC-082);
    a própria seção de Database mais abaixo já diz "hand-written service worker" (contradição
    interna no mesmo arquivo).
  - "Schema Version — Dexie **v5** / backup **v5**" → **v9** (ver A2).
  - "**No server, no monthly cost, no remote database.**" → contradiz DEC-207 (KV + Workers +
    Durable Objects) e o Worker `/ocr` Groq do DEC-206.
  - Não menciona: camada **Capacitor** (nativo), **Capgo** (OTA), **Groq Worker `/ocr`**,
    **KV `SHARE_STORE`**, **`ShareSignal`/`Mailbox` DOs**, **Hono** (planejado para o backend
    portável do DEC-207).
- **A confirmar:** "Forms | React Hook Form + Zod" — **Zod é usado** (`domain/validation/schemas.ts`
  [VERIFICADO]); React Hook Form **[A VERIFICAR]** (pode nunca ter entrado).
- **Correção:** corrigir a tabela (remover Zustand; SW próprio; confirmar/remover RHF);
  adicionar uma seção **"Native layer (Capacitor)"** e **"Edge/server (opcional, portável)"**
  com os endpoints e DOs reais; schema v9 + as 5 tabelas device-local; trocar "no server"
  por "**local-first; servidor de borda opcional, portável e E2E** (só ciphertext)".

### A6 — `decision-log.md`: buraco DEC-185..199 + DEC-201, fora de ordem, supersessões não marcadas [VERIFICADO]
- **Buraco:** os DECs logados pulam de **DEC-184** direto para **DEC-200**. Faltam
  **DEC-185, 186, 187, 188, 189, 190, 191, 192, 193, 194, 195, 196, 197, 198, 199 e 201**.
  Vários são **referenciados como entregues** no `project-status.md` e nos planos do arco
  nativo (DEC-194 = motion system; DEC-195..199/201 = post-animation fixes), mas **nunca
  foram escritos no log canônico**. DEC-185..193 sequer são referenciados (ou foram numerados
  e abandonados, ou o trabalho nativo foi entregue sem DEC formal).
- **Fora de ordem:** no arquivo, DEC-176 → DEC-180 → DEC-177/178/179 → DEC-181..184.
- **Supersessões não marcadas (a Truth Policy exige `SUPERSEDED`):**
  - **DEC-059 / DEC-064** ("Mais" tab sectioned list) → superado por **DEC-180** ("Mais" virou
    Viagem + Copiloto; `MorePage` deletado). Não marcado.
  - **DEC-164** (Settings = página única com grupos rotulados) e o item 4 da rodada 1
    (single page + busca + recolhíveis) → superados por **DEC-211 Wave C** (Settings =
    **subpáginas** estilo Samsung). Não marcado.
  - **DEC-088 / DEC-089** (hero subtrativo / tirar "reservado p/ próxima fase" do hero) →
    refinados por **FIELD-18** ("livre de verdade", `calculateTrueFree`). Coerente, mas o
    elo não está anotado.
  - **DEC-206 G3** (OCR on-device) → **DEC-209** (removido). Este **está** marcado ("Reverses
    DEC-206 G3"). 👍 (modelo a seguir nos demais).
- **Correção:**
  1. **Backfill** das entradas DEC-185..199 + DEC-201 a partir dos planos do arco nativo
     (`android-native-strategy`, `animation-system-spec`, `post-animation-fixes-and-wise-import-plan`,
     `post-apk-improvements-plan`) + `src/dev-log.md`. Se o trabalho real não cobre 16
     números, registrar explicitamente quais foram **pulados** (ex.: "DEC-185..193: números
     não usados; o arco nativo foi logado a partir de DEC-194") para a numeração ficar honesta.
  2. Reordenar 176/177/178/179/180.
  3. Adicionar tags `SUPERSEDED by DEC-NNN` nas decisões acima.
  4. Atualizar a contagem no README/status para refletir "logadas vs referenciadas".

### A7 — Tabela de tech-debt do `project-status.md` está parcialmente resolvida [VERIFICADO]
- **Errado:** lista **"Nearby POI list (Overpass)"** como deferido — mas **DEC-166** entregou
  o picker de estabelecimentos próximos. Linha obsoleta. Também: "E2E 29" (são 34) e "Dexie v5".
- **Correção:** remover/marcar a linha do POI como **DONE (DEC-166)**; atualizar contagens.
  As demais debts seguem válidas (ver Parte B: B7 floor automático, B6 biometria, B13
  orquestradores, B14 SW plugin, B15 E2E em CI).

### A8 — `competitive-landscape.md` e `meetings-log.md` [A VERIFICAR]
- `meetings-log.md` só tem 2 reuniões antigas com "Action Items"; provavelmente desatualizado
  mas baixo impacto. `competitive-landscape.md` não foi auditado a fundo aqui.
- **Correção:** revisão leve numa próxima passada de brain-hygiene (não bloqueia nada).

---

# PARTE B — Funções que pulamos (backlog de execução)

> Cada item é uma frente de trabalho completa: **origem**, **o que foi planejado**,
> **o que de fato entrou**, **o que falta**, **causa-raiz**, **conselho** (quando ambíguo),
> **plano cirúrgico** (arquivos), **anti-regressão**, **testes**, **gate**, **esforço**
> (raw → Tier 3 = ÷3). Itens nativos são agrupados num **único APK** por lote (regra: só
> gera APK novo quando mexe em nativo).

## Bloco 1 — Lote nativo pendente (1 APK fecha B1+B2+B3)

### B1 — F15: receber `.csv` compartilhado de outro app (Wise → TripPilot) [DECISÃO de spike]
- **Origem:** rodada 2 F15; `[deferred]` em DEC-211 §7 e dev-log.
- **Planejado:** outro app ("Compartilhar" do Wise/Files) manda um `.csv` → TripPilot abre o
  fluxo de import já existente.
- **Entrou:** nada (a parte web do import existe e funciona; falta o **handler de intent nativo**).
- **Causa-raiz:** Android precisa de `<intent-filter>` para `ACTION_SEND`/`ACTION_VIEW` com
  `text/csv` + um handler que leia o `content://` URI (via `ContentResolver`, sem permissão
  de storage para SEND) e entregue o texto à WebView. A rodada 2 §4 condicionou ao "caminho
  limpo" (plugin/Capacitor App) — daí o spike.
- **Plano:**
  1. **Spike (1–2h):** comparar (a) `@capacitor/app` `appUrlOpen`/`getLaunchUrl` para
     `ACTION_VIEW` de arquivo vs (b) um plugin nativo minúsculo `ShareTargetPlugin` que leia
     `Intent.EXTRA_STREAM` no `onNewIntent`/`onCreate`, copie para um temp e emita um evento
     Capacitor com o texto.
  2. Manifest: intent-filters para `text/csv`, `text/comma-separated-values`, `application/csv`
     (e `ACTION_VIEW` com `scheme=content`/`file` + `pathPattern *.csv`).
  3. Web: nova entrada no `/import/wise` que aceita um **CSV injetado em memória** (reusa o
     parser puro `parseWiseCsv` — já testado contra 3 statements reais). Rota
     `/import/wise?shared=1`; o texto vem por um store em memória/evento, **não** por query
     (grande demais).
- **Arquivos:** `android/app/src/main/AndroidManifest.xml`, (talvez) `ShareTargetPlugin.java`,
  `utils/native/share-target.ts`, `features/import/WiseImportPage.tsx`.
- **Anti-regressão:** o **Web Share Target** do PWA (DEC-161, `/quick-add`) **não pode quebrar**;
  todo caminho nativo guardado por `isNativeApp()`.
- **Testes:** parser já coberto; +1 teste de fronteira (evento→parse, mockado).
- **Gate:** lote nativo. **AC `[device]`:** compartilhar um CSV do Wise/Files → abre o preview.
- **Esforço:** ~10h → **~3h**.

### B2 — App Links nativos: `/pair` + `/s/:id` (deep link abre e navega) [A VERIFICAR em device]
- **Origem:** DEC-211 (F19 nativo) + DEC-207 **S8**; `[deferred]` consistente.
- **Planejado:** abrir um link `…/pair#<identidade>` ou `…/s/:id#k=<chave>` **no app nativo**
  e cair na tela certa (hoje funciona 100% no navegador/PWA).
- **Entrou:** só a parte web. O handoff nativo foi adiado por **não termos device** para
  verificar o assetlinks + a SHA-256 do certificado.
- **Causa-raiz:** App Links exigem (a) `<intent-filter android:autoVerify="true">` no
  manifest, (b) `/.well-known/assetlinks.json` com a **SHA-256 do cert de assinatura**, (c)
  `App.addListener('appUrlOpen')` → roteamento interno (a WebView carrega assets locais, não
  a URL remota). Risco real: **App Links podem descartar o `#fragment`** — e a chave E2E do
  `/s/:id` vive justamente no fragment.
- **Plano:**
  1. Gerar SHA-256 dos keystores **debug e release** → publicar `public/.well-known/assetlinks.json`
     (Pages serve no apex).
  2. Manifest: intent-filters `autoVerify` para `https://trippilot.pages.dev/pair` e `/s/*`.
  3. `utils/native/deep-link.ts`: listener `appUrlOpen` → parse path + `#fragment` →
     `navigate()` preservando `#k=`.
  4. **Verificar em device** se o fragment sobrevive. Se **não** sobreviver: a chave NÃO pode
     ir para query (vaza no servidor/logs) → fallback honesto = manter QR/scan para `/s/:id`
     e usar App Links só para `/pair` (cuja identidade não é segredo). Documentar o resultado.
- **Arquivos:** `AndroidManifest.xml`, `public/.well-known/assetlinks.json`, `utils/native/deep-link.ts`,
  `RootLayout`.
- **Anti-regressão:** rotas web inalteradas; listener guardado por `isNativeApp()`.
- **Gate:** lote nativo **+ verificação em device** (sem device, não shippar — foi a decisão
  consciente para evitar "abre o app mas não navega").
- **Esforço:** ~12h → **~4h** (maioria é verificação em device).

### B3 — F14: grant de **GPS nativo** (parte que faltou) [A VERIFICAR em device]
- **Origem:** rodada 2 F14; a parte web (busca/recentes/find-online) entrou no 0.64.0; só o
  grant nativo de localização ficou.
- **Causa-raiz:** análogo ao **F12 câmera (DEC-205)** — o WebView do Capacitor 8 já dispara o
  grant de `getUserMedia` (câmera) via `onPermissionRequest`, mas **geolocation** usa outro
  hook (`WebChromeClient.onGeolocationPermissionsShowPrompt`) e precisa de
  `ACCESS_FINE_LOCATION`/`ACCESS_COARSE_LOCATION` no manifest. **[A VERIFICAR]** se o
  `BridgeWebChromeClient` do Capacitor 8 já concede geolocation como faz com câmera.
- **Plano:** confirmar se `@capacitor/geolocation` está instalado ou se `utils/geolocation.ts`
  usa o `navigator.geolocation` da WebView. Provável fix: permissões de localização no
  manifest + (se necessário) override de `onGeolocationPermissionsShowPrompt` no `MainActivity`
  (mesmo padrão do fix de câmera).
- **Arquivos:** `AndroidManifest.xml`, possivelmente `MainActivity.java`.
- **Gate:** lote nativo + device. **AC `[device]`:** registrar gasto/saída com localização ON
  → o Android pede a permissão → lugares próximos aparecem.
- **Esforço:** ~4h → **~1.5h**.

> **Fechamento do Bloco 1:** B1+B2+B3 fecham num **único APK** (bump `requiredNativeVersion`
> + `versionCode`). Custo combinado **~8.5h Tier 3** + a sessão de verificação em device.

## Bloco 2 — Shared link: limites honestos e v1.1

### B4 — S9/v1.1: editar/excluir gastos **de outros** + PIN por link + UI de revogar/rotacionar [DECISÃO de escopo]
- **Origem:** DEC-207 cortou o v1 para **ver + aprovar + adicionar o próprio (como proposta)
  + liquidar**; **editar/excluir de outros** ficou para **v1.1/S9**. PIN por link (default OFF)
  e UI madura de revogar/rotacionar também ficaram no S9.
- **Entrou:** v1 completo (0.57.0 async + 0.58.0 real-time S7).
- **Causa-raiz:** o convidado **nunca reescreve dinheiro** (owner é a verdade, DEC-106). Editar
  a linha de **outra pessoa** vira uma **proposta** que o dono reconcilia — reconciliação mais
  pesada que adicionar o próprio gasto.
- **Plano:** estender o modelo de proposta/confirmação (DEC-071/106) para diffs de edição/
  exclusão de linhas que o convidado não criou; o dono vê o diff e confirma/rejeita. PIN por
  link = checagem opcional antes de decifrar a fatia. Hub de conexões ganha revogar/rotacionar
  com `revision++`.
- **Conselho:** ver **D-Conselho-1** (vale a pena agora?). Recomendação preliminar: **adiar**
  até o Julio realmente sentir falta; o v1 cobre o caso dominante (ele divide e o outro
  confirma/paga).
- **✅ DECIDIDO (2026-06-17): NÃO mexer no shared link por enquanto.** Julio: *"não precisa fazer
  nada mais no link porque eu vou fazer muitas mudanças nele ainda"*. **S9/v1.1 fica congelado** —
  sem editar-de-outros, sem PIN por link, sem UI de revogar/rotacionar nesta rodada. Remover B4 do
  caminho crítico (a Onda 5 some; ver Parte E). Reabrir só quando o Julio trouxer o redesenho dele.
- **Esforço:** ~16h → **~5h** *(fora de escopo agora)*.

### B5 — Push com app **fechado** (FCM) + real-time **iOS-web** [DECISÃO ESTRATÉGICA — conselho obrigatório]
- **Origem:** DEC-207 — limites honestos: push app-fechado precisa de **FCM/Play Services**
  (mas somos **sideload, fora da Play Store** — DEC-206), e **iOS-web** não tem nativo/web-push
  decente. Hoje o piso é **pull assíncrono**; o real-time S7 só funciona **com o app aberto**.
- **✅ DECIDIDO (2026-06-17): sideload-first, SEM FCM.** Julio: *"a gente tem que fazer as coisas
  pensando que o aplicativo não vai estar na Play Store … não necessariamente vai estar"*. Então o
  app **não assume Play Services**. O caso "o dinheiro caiu no outro celular" é resolvido por:
  (a) **nudge de compartilhar/copiar link** com texto pronto após dividir, (b) o **piso de pull
  assíncrono** já existente, e (c) **S7 ao abrir o app**. Push real com app fechado fica como item
  explícito de V2 (só entra se algum dia formos pra Play Store). iOS-web real-time permanece fora
  (coberto pelo pull). Ver **D-Conselho-2** (registro do raciocínio).

## Bloco 3 — Gaps de produto antigos (alguns tech-debt)

### B6 — Biometria (WebAuthn / native biometric) sobre o PIN [VERIFICADO: cortado em DEC-161]
- **Planejado:** desbloqueio biométrico. **Entrou:** só PIN (PBKDF2, ÂNCORA 12 — recovery
  nunca preso). **Falta:** biometria como **camada por cima** do PIN.
- **Plano:** WebAuthn platform authenticator (web/PWA) atrás de detecção de suporte; no nativo,
  `@aparajita/capacitor-biometric-auth` (ou similar). PIN continua de fallback; recovery
  allowlist intacta. **Anti-regressão:** ÂNCORA 12 — nunca prender o usuário; sessão sem lock
  segue sem lock.
- **Esforço:** ~8h → **~2.5h**.

### B7 — Cálculo **automático** de floor de fase futura (3 níveis) [VERIFICADO: só manual hoje]
- **Origem:** DEC-016 (auto + manual) e DEC-069 (V1 = só manual; auto = "D3+"). A spec
  (§2 BudgetPool) ainda promete "Automatic reserve calculation for future linked phases".
- **Falta:** o cálculo automático (essencial/recomendado/confortável) — hoje o usuário digita
  o floor à mão por link de fase.
- **Plano:** função pura `calculateRecommendedFloor(phase, profiles, rhythm, days)` → 3 tiers;
  expor como **sugestão** no editor do link de fase (ÂNCORA 10 — sugestão, não imposição); o
  tier escolhido grava `BudgetPoolPhaseLink.futureFloorCents`. Reusa forecasting/ritmo.
- **Anti-regressão:** o floor manual continua funcionando; FTS já subtrai `futureFloorCents`
  (`calculateFutureFloor`) — só muda a **origem** do número.
- **Esforço:** ~10h → **~3h**.

### B8 — Tipo de transação de **ENTRADA/RENDA** (e a relação com F17) [DECISÃO ARQUITETURAL — conselho obrigatório]
- **Achado [VERIFICADO]:** `TransactionType = 'expense' | 'transfer' | 'settlement' | 'adjustment'`
  (`src/domain/types/common.ts`). **Não existe** tipo de entrada. O `dev-log.md` (Wise transfer)
  registra: *"incoming 'wallet inflow' (an arbitrary top-up) intentionally NOT built — there is
  no income transaction type, so it would need a schema change (high-impact, deferred)."*
- **Consequência:** o **F17 (renda planejada por fase)** entrou como **projeção only** (alimenta
  só o forecast, ÂNCORA 11). Não há como registrar **renda REAL recebida** no meio da viagem e
  ver o orçamento/pool crescer. Para quem recebe dinheiro durante a viagem (reembolso grande,
  pagamento, mesada), o modelo "orçamento é fixo no início" não cobre.
- **Por que é o item mais sensível:** mexe no coração do dinheiro (FTS, breakdown, wallet,
  backup, learning-exclusion, simulador). Ver **D-Conselho-3** para a escolha de abordagem.
- **✅ DECIDIDO (2026-06-17): criar um `TransactionType = 'income'` COMPLETO** (abordagem mais
  invasiva, opção 2 do conselho). Julio escolheu o tipo de transação de entrada de verdade — renda
  REAL recebida no meio da viagem **faz o orçamento/pool crescer**, não só projeção. Tratar como
  **gate próprio e isolado** (sai do "quick wins"): tocar `TransactionType`, FTS
  (`calculateFreeToSpend`/`calculateTrueFree`), breakdown, wallet (crédito em vez de débito),
  backup/normalização, `excludeFromLearning` (entrada NUNCA entra no aprendizado de valor), e o
  simulador. **Anti-regressão obrigatória:** suíte de **invariância** garantindo que, com zero
  `income`, todo número (FTS, saldos, dívidas, breakdown) permanece **bit-idêntico** ao de hoje;
  só então habilitar a UI de registrar entrada. Conecta com F17: a renda planejada por fase vira a
  **expectativa**, e a entrada real **realiza** contra ela.
- **Esforço (abordagem completa):** ~20h → **~6–7h** (gate dedicado, fora da Onda 1).

### B9 — Vincular gasto **pré-existente** a uma compra planejada [VERIFICADO: deferido em DEC-175]
- **Falta:** "comprei isso antes de criar o planejado" — hoje só o "Comprei" por loja (cria txn
  nova e linka). **Plano:** picker "vincular gasto existente" no detalhe do `PlannedPurchase`,
  reusando o caminho de **link** de `logPlannedPurchaseExpense` sem criar transação nova
  (a reserva encolhe pelo gasto vinculado — já é assim). **Esforço:** ~5h → **~1.5h**.

### B10 — Backlog do Copiloto (DEC-184) [VERIFICADO: "Backlog (council, not built)"]
- **Falta:** cash×card (confiabilidade do método), **total na moeda de casa** (âncora), hora de
  pico, streak de disciplina, **"Wrapped" de fim de viagem** (V2 — precisa da viagem fechada).
- **Plano:** cada um é um módulo **data-gated** puro como os outros do Copiloto
  (`domain/copilot/`), self-censored sem sinal. "Wrapped" é o único que depende do fim da
  viagem (tratar como mini-épico). **Esforço:** ~12h → **~4h** (Wrapped à parte).

### B11 — P2P V2 (DEC-108) [VERIFICADO: deferido por design, parte subsumida]
- **Itens:** split de mesa ao vivo, merge multi-device de grupo, saída compartilhada ao vivo,
  handshake de liquidação, multi-QR animado.
- **Status:** **largamente subsumido** pelo épico shared link (DEC-207 entregou async + real-time
  best-effort). DEC-207 tem guardrail explícito: **não** virar merge bidirecional/CRDT/grupo em
  tempo real. **Recomendação:** **manter deferido**; só reabrir se o Julio repriorizar
  "saída compartilhada ao vivo" ou "grupo". (Sem plano detalhado aqui — fora de escopo atual.)

### B12 — R7: ponderação de simulação **por categoria** quando o plano da categoria estourou [VERIFICADO: deferido]
- **Plano:** estender o motor de simulação para ponderar por categoria quando aquela categoria
  já passou do plano (adição pura ao `simulation`/`honest-friend`). **Esforço:** ~5h → **~1.5h**.

## Bloco 4 — Tech-debt de engenharia (baixo valor de usuário, importam p/ saúde)

### B13 — Refactor completo de orquestradores em páginas antigas (DEC-067) — algumas páginas chamam repositórios direto. Auditar e migrar. **Risco:** médio; fazer oportunisticamente, página a página, com testes. ~12h → **~4h**.

### B14 — SW por **build plugin** (Workbox/Vite) em vez de parsear `index.html` no install (GAP-036). **Risco ALTO de regressão** (o SW é zona sensível — DEC-082/137 são estabilidade crítica). **Recomendação (conselho):** manter como está; só mexer com bateria de testes E2E de update e device. ~8h → **~2.5h** (mas com risco).

### B15 — E2E (Playwright) em **CI** (DEC-054) — hoje roda local. Adicionar com install de browser no pipeline. Aumenta a rede de segurança. ~6h → **~2h**.

### B16 — Prevenção do DEC-170: fechar a conexão no `visibilitychange` — **deferido de propósito** (risco de abortar escrita em voo; a escada de recovery já neutraliza o wedge). **Recomendação:** manter deferido; reabrir só se incidentes persistirem.

### B17 — Empty state do **Planner** (DEC-171 deferido) — adicionar `EmptyState` quando a viagem não tem fases (raro). Baixa prioridade. ~2h → **~0.7h**.

### B18 — **Backlog de validação em device** (não é código novo; é QA) [A VERIFICAR]
Features **entregues mas nunca validadas num Android físico** (consolidado de todo o dev-log):

| Feature | Origem | AC `[device]` |
|---|---|---|
| QR pela câmera (grant) | DEC-205 F12 | abrir scanner → Android pede câmera → lê QR |
| Backup → Downloads públicos | DEC-205 F1 | salvar → aparece em Downloads |
| Sem overscroll/stretch | DEC-205 F13 | rolar além do fim → sem esticar |
| Notif da saída → tela | DEC-204 G7 | tap no valor da notif reflete na hora |
| Saída sem zoom/sambando | DEC-204 G7 | tela cheia sem folga/zoom |
| Capgo baixa/troca OTA | DEC-204 G8b | release só-web chega no APK |
| APK self-update (installer) | DEC-210 | one-tap instala APK novo |
| Live Update A16 (visual) | arco nativo | promotion/now-bar no A16 real |
| Haptics N8 / zoom N7 | arco nativo | padrões hápticos no aparelho |
| Real-time S7 (toast app-aberto) | DEC-207 | dono atualiza → convidado vê o toast |

> Estes não têm "fix" — têm **um ciclo de teste em device** (idealmente o S23 do Julio).
> Sugiro um **gate de verificação de device** dedicado (Parte E), com checklist e captura de tela.

---

## Resumo de esforço (Tier 3)

| Bloco | Itens | Tier 3 |
|------|-------|:---:|
| 1 — Lote nativo | B1, B2, B3 | ~8.5h (+ device) |
| 2 — Shared link | B4 (v1.1), B5 (decisão) | ~5h (se aprovado) |
| 3 — Gaps de produto | B6, B7, B8, B9, B10, B12 | ~16–19h |
| 4 — Eng. tech-debt | B13, B14, B15, B17 | ~9h |
| Verificação device | B18 | ~1 sessão QA |
| **Brain (Parte A)** | A1–A8 | ~2–3h |

> Decisões (B5, B8) e escopo (B4) precisam do Julio **antes** de virar horas. B11/B16 ficam
> deferidos por design.

---

# PARTE C — Bugs / desvios & smells (honestos)

> **Nenhum bug NOVO confirmado** no 0.64.0: a varredura de `TODO/FIXME/HACK/XXX/@ts-ignore`
> no `src/**/*.ts(x)` só achou `eslint-disable react-hooks/exhaustive-deps` pontuais (padrão
> aceito) e comentários de workaround documentados — não há código quebrado escondido. Abaixo,
> só **desvios já decididos** e **smells a confirmar** (nada para "corrigir às cegas").

### C1 — "Livre de verdade" foi implementado com **nome diferente** do rascunho [VERIFICADO — NÃO é bug]
- O plano da rodada 1 propôs `allocationsRemainingCents` dentro de `calculateFreeToSpend`. O
  que entrou: a subtração do plano acontece na **camada do hero** via
  `calculateTrueFree(phaseFree, allocated, allocatedSpent)` → `planReservedCents = max(0,
  allocated − allocatedSpent)` e `trueFree = max(0, phaseFree − planReserved)`; o breakdown
  (`buildFreeToSpendBreakdown(fts, planReservedCents)`) adiciona a linha `plan` por último.
  **Está correto e sem dupla-contagem** (usa o gasto real nos perfis alocados). É só um delta
  de nomenclatura — **anotar no brain**, não mexer no código.

### C2 — `FreeToSpendResult.allocationsCents` é calculado mas **não entra na fórmula** [VERIFICADO — smell menor]
- `calculateFreeToSpend` computa `allocationsCents` (soma de envelopes `allocation`) e o
  retorna, mas **não** o subtrai (a subtração real é `planReservedCents`, calculado fora). O
  campo parece **morto** dentro do core. **[A VERIFICAR]** se algum consumidor de UI usa
  `fts.allocationsCents`; se não, é candidato a **limpeza** (remover o campo ou documentar por
  que existe). Risco: baixo, mas **não tocar sem rodar a suíte** (é o número mais importante do app).

### C3 — Desvios **intencionais** já decididos (garantir que o brain reflita) [VERIFICADO]
- Storage do shared link = **KV**, não D1 (DEC-207 delta honesto — token sem escopo d1).
- Real-time = **`ShareSignal` DO** (o *padrão* SyncRoom, não a mesma instância).
- Settings: **página única → subpáginas** (DEC-164 → DEC-211 Wave C).
- "Mais" → **Viagem + Copiloto** (DEC-059/064 → DEC-180).
- OCR on-device → **removido** (DEC-206 G3 → DEC-209).
- Estes são **corretos**; o trabalho é de **higiene de brain** (marcar SUPERSEDED — ver A6).

---

# PARTE D — Conselho (4 lentes) nos pontos estratégicos

> Lentes: **Estrategista** (produto/longo prazo) · **Arquiteto** (viabilidade/padrões) ·
> **Crítico** (risco/regressão) · **Advogado do usuário** (uso real). Inline, sem subagents.

## D-Conselho-1 — Vale construir o v1.1 do shared link (editar/excluir de outros) agora? (B4)
- **Estrategista:** o diferencial já foi entregue (dividir + o outro confirma/paga). Editar
  gasto **de outro** é caso de borda; o ganho marginal é pequeno perto do custo de
  reconciliação.
- **Arquiteto:** reusa DEC-071/106, mas diffs de edição/exclusão de terceiros são a parte
  pesada (conflito, ordem, revisão). Dá para fazer, não é barato.
- **Crítico:** mais superfície de reconciliação = mais chance de corromper a verdade do dono.
  Alto cuidado.
- **Advogado:** o convidado quase sempre quer **ver/aprovar/pagar**, não reescrever a planilha
  do outro. PIN por link e revogar/rotacionar são mais pedidos que editar-de-outros.
- **RECOMENDAÇÃO:** **adiar editar/excluir-de-outros**; se for fazer algo do S9, priorizar
  **revogar/rotacionar link** + **PIN por link (default OFF)** (segurança > reescrita). Confirmar
  com o Julio se ele sente falta de editar gasto de outro.
- **✅ DECISÃO FINAL (2026-06-17):** **congelar todo o S9/v1.1**. O Julio vai redesenhar o shared
  link por conta própria; nada de editar-de-outros, PIN-por-link nem revogar/rotacionar nesta
  rodada. (Supera a recomendação preliminar — não há nem o subconjunto de segurança agora.)

## D-Conselho-2 — Push com app fechado / real-time iOS-web (B5)
- **Estrategista:** notificar com o app fechado é o que dá a sensação "chegou no celular do
  outro". Mas o preço é **depender de Play Services/FCM**, o que **fere a âncora sideload/sem
  Play Store** (DEC-206) e amarra ao Google.
- **Arquiteto:** sem FCM não há push app-fechado confiável no Android sideload; no iOS-web o web
  push é fraco. Alternativas sem FCM: (a) piso assíncrono (já temos); (b) **deep-link de nudge
  por WhatsApp/e-mail** disparado pelo dono ("te mandei uma divisão: link") — usa o canal que o
  par já usa, zero backend de push; (c) Periodic Background Sync onde existir (cobertura
  irregular).
- **Crítico:** trazer FCM é uma mudança grande de postura (privacidade, dependência, build).
  Não justifica para um app de viagem pessoal sideload.
- **Advogado:** na prática, o dono **manda o link** por WhatsApp de qualquer forma. Um botão
  "**Compartilhar link da divisão**" + (opcional) texto pronto cobre 95% do "chegar no outro"
  sem push.
- **RECOMENDAÇÃO:** **não** adotar FCM. Manter piso assíncrono + S7 (app aberto). Investir num
  **"compartilhar/copiar link" com mensagem pronta** (barato, já existe a base do `/pair`/`/s`).
  Registrar como **decisão consciente** ("push app-fechado e iOS-web ficam fora; nudge via
  share").
- **✅ DECISÃO FINAL (2026-06-17):** **aprovada como recomendada** — sideload-first, **sem FCM**.
  Julio confirmou que o app **não necessariamente vai pra Play Store**, então não dependemos de
  Play Services. Construir o **botão de compartilhar/copiar link da divisão** (Onda 2). Push
  app-fechado vira item de V2 condicionado a uma futura ida à Play Store.

## D-Conselho-3 — Tipo de transação de ENTRADA/RENDA (B8)
- **Estrategista:** receber dinheiro durante a viagem é real (reembolso grande, pagamento). O
  F17 só projeta; não deixa o orçamento **crescer de verdade**. É um buraco conceitual, mas
  mexe no núcleo.
- **Arquiteto:** três caminhos:
  1. **`income` como novo `TransactionType`** que **aumenta** o budget efetivo do pool —
     mais limpo conceitualmente, mas toca FTS, breakdown, wallet, backup, learning-exclusion,
     simulador (alto impacto, exige testes de invariância).
  2. **Top-up via `adjustment`/pool** — registrar a entrada como ajuste que **soma em
     `pool.totalAmountCents`** (ou um termo aditivo no FTS) — menos invasivo, reusa o que existe.
  3. **Não fazer** — manter orçamento fixo; entrada só como projeção (F17) ou como redução de
     dívida (já coberto pelas pontes de reembolso do Wise — F16a).
- **Crítico:** o risco da opção 1 é gigante (é o número do hero). A opção 2 mantém a invariante
  "FTS = budget − compromissos" e é testável. A opção 3 é honesta se o caso for raro.
- **Advogado:** o Julio já tem **pontes de reembolso** (entrada Wise → quita dívida/divide).
  O que falta de verdade é "**ganhei €X agora, posso gastar mais**". Se isso for comum, vale a
  opção 2; se for raro, F16a + F17 já cobrem.
- **RECOMENDAÇÃO:** **não** criar `income` type às cegas. **Perguntar ao Julio** se ele quer
  renda **real** que aumenta o que pode gastar. Se sim → **opção 2** (top-up via ajuste no pool,
  com termo aditivo no breakdown e teste de invariância), evitando reescrever o core. Se for
  raro → manter F17 (projeção) + pontes de reembolso e **documentar como fora de escopo**.
- **✅ DECISÃO FINAL (2026-06-17): opção 1 — `TransactionType = 'income'` COMPLETO.** O Julio
  escolheu a abordagem mais invasiva (renda real que faz o orçamento crescer), **acima** da
  recomendação preliminar (opção 2). Implicação aceita: é um **gate dedicado e isolado** com
  **testes de invariância** obrigatórios (zero `income` ⇒ todo número bit-idêntico ao de hoje)
  antes de expor a UI, mais cobertura de FTS/breakdown/wallet/backup/learning/simulador. Sai da
  Onda 1 e passa a ser sua própria onda (ver Parte E, Onda 2-B).

## D-Conselho-4 — Continuar adiando o lote nativo (B1–B3, B18)? 
- **Estrategista:** o nativo trava 3 features que o Julio pediu (receber CSV, abrir link no app,
  GPS). E há uma pilha de ACs nativos **nunca testados em device**.
- **Arquiteto:** B1/B2/B3 fecham num único APK; o caro é o **ciclo de device**, não o código.
- **Crítico:** shippar App Links sem device = risco de "abre e não navega" (o bug que evitamos).
- **Advogado:** sem uma sessão no S23, o lote nativo fica em limbo indefinido.
- **RECOMENDAÇÃO:** agendar **uma sessão de device** (Julio + APK de debug) que feche **B1+B2+B3
  e valide B18** de uma vez. É o desbloqueio de maior alavancagem do backlog nativo.

## D-Conselho-5 — Ordem de ataque (priorização geral)
- **Consenso das 4 lentes:** maior valor/menor risco primeiro; brain antes de tudo (barato e
  destrava clareza); decisões (B5/B8) viram pergunta única; nativo agrupado num APK; tech-debt
  arriscado (B14) por último e só com rede de testes.

---

# PARTE E — Plano de execução (ondas, gates, hardening)

> Aplica `phase-delivery-hardening.mdc`: gates de ≤5–6 milestones, checkpoint entre gates
> (suíte verde + build app/worker + golden path + ACs cumulativos + dev-log + context refresh),
> e o bloco **NÃO-NEGOCIÁVEIS** repetido a cada gate.

### NÃO-NEGOCIÁVEIS (reler a cada gate)
1. ZERO regressão — nada some (ÂNCORA 9). 2. meta/cofrinho/renda-futura read-only (ÂNCORA 11).
3. check-in nunca grava (ÂNCORA 12). 4. transfer entre pools conserva total (ÂNCORA 13).
5. GPS bruto 100% local (ÂNCORA 8). 6. nunca bloquear registro (ÂNCORA 10). 7. i18n pt/en/es
para toda string nova; tsc 0; nenhum chunk >500 KB; deploy produção `--branch=master` (apex);
APK só quando mexe em nativo.

### Onda 0 — Higiene de brain [doc, sem código] — ✅ **CONCLUÍDA 2026-06-17**
- Aplicado **A1–A7** (A8 = revisão leve, pendente). README, project-status, implementation-phases,
  product-spec e technical-direction reconciliados; decision-log com **bloco de reconciliação**
  DEC-185–199/201 (números pulados, não deletados — **não houve backfill inventado**) + tags
  **SUPERSEDED** (DEC-059/064→180; DEC-164→211).
- **Gate:** brain coerente; gap de numeração explicado com honestidade; contradições
  product-spec ↔ technical-direction ↔ status resolvidas. **Sem testes** (doc). Risco: baixo. ✅

### Onda 1 — Quick wins de produto [web/OTA]
- **B9** (vincular gasto existente a planejado), **B12** (R7 simulação por categoria),
  **B17** (empty state do Planner), **B7** (floor automático como sugestão).
- **Gate:** suíte verde + build + E2E; deploy OTA `--branch=master`. ACs por item. Tier 3 ~6.7h.

### Onda 2-A — Nudge de compartilhar link (B5, decidido) [web/OTA]
- Botão **"compartilhar/copiar link da divisão"** com mensagem pronta após dividir/atribuir uma
  fatia (reusa `/pair` + `/s`). **Sem FCM** (decisão B5). Barato; cobre o "chegou no outro celular".
- **Gate:** suíte verde + build + E2E; deploy OTA `--branch=master`. Tier 3 ~1.5–2h.

### Onda 2-B — `TransactionType = 'income'` completo (B8, decidido) — **gate isolado** [web/OTA]
- Novo tipo de transação de **entrada real** que faz o orçamento/pool **crescer**. Toca
  `TransactionType`, FTS (`calculateFreeToSpend`/`calculateTrueFree`), breakdown, wallet (crédito),
  backup/normalização (sem migração indexada se der), `excludeFromLearning` (entrada nunca aprende
  valor), simulador. Conecta com F17 (planejado = expectativa; entrada real = realização).
- **Gate (rígido):** **teste de invariância PRIMEIRO** — com zero `income`, FTS/saldos/dívidas/
  breakdown **bit-idênticos** ao de hoje; só então habilitar a UI. ÂNCORA 11/13 intactas;
  backup round-trip preserva entradas. Tier 3 ~6–7h. **Não** misturar com a Onda 1.

### Onda 3 — Copiloto v3 + biometria [web/OTA]
- **B10** (módulos do Copiloto: cash×card, total na moeda de casa, hora de pico, streak; Wrapped
  à parte), **B6** (biometria sobre o PIN).
- **Gate:** módulos data-gated (nada aparece sem sinal); biometria nunca prende recovery.
  Tier 3 ~6.5h.

### Onda 4 — Lote nativo (1 APK) + verificação em device [native → APK]
- **B1** (receber `.csv`), **B2** (App Links `/pair`+`/s/:id`), **B3** (GPS nativo). Fecha em
  **um APK** (bump `requiredNativeVersion` + `versionCode`). **Sessão de device** valida B1–B3
  **e** o backlog **B18** (checklist + screenshots).
- **Gate:** `cap sync` + `assembleDebug` verde; ACs `[device]` confirmados; se App Links
  descartar o fragment, aplicar o fallback honesto (B2). Tier 3 ~8.5h + sessão QA.

### Onda 5 — Tech-debt seguro [web/OTA + CI]  (B4 REMOVIDO — shared link congelado)
- **B4 fora de escopo** (decisão 2026-06-17: Julio vai redesenhar o link). Resta: **B15** (E2E em
  CI), **B13** (orquestradores, oportunístico).
- **Deixar por último/condicional:** **B14** (SW por plugin) só com bateria de testes de update
  + device; **B11/B16** deferidos por design.

### Anti-regressão (checar a cada gate) — repetir do round2 §5
- Insights = carrossel rotativo (DEC-091/077/150); ocasiões = carrossel (DEC-076).
- Hero breakdown (DEC-168) + true-free (FIELD-18) reconciliam (`calculateTrueFree`).
- ÂNCORA 11 provada por teste de invariância do free-to-spend.
- Mapa diário consistente com `calculateTodayFreeBudget`.
- Deploy produção `--branch=master`; APK só quando mexe em nativo.

---

# PARTE F — Checklist de atualização do brain (Onda 0) — ✅ aplicado 2026-06-17

- [x] `README.md`: data 2026-06-17; descrição do decision-log (DEC-001..211 + nota de
  reconciliação) e das phases (D1–D6 + rounds); índice com `documents/` e `src/dev-log.md`.
- [x] `project-status.md`: Status Summary (decisões DEC-001..211, schema **v9**, testes
  **1147/128 + E2E 34**, deploy **master/apex 0.64.0**, APK 0.50.0, produção é **master**);
  "Next Steps" → aponta este plano + decisões travadas; tech-debt (POI/DEC-166 marcado DONE).
- [x] `implementation-phases.md`: **D6 DELIVERED** (arco nativo v0.28→v0.50); nota de migração
  para entrega por rodadas; V2 Roadmap (Wise/receipt/multi-currency/templates/insights → entregue).
- [x] `product-spec.md`: **backend/ciphertext**, **import de recibo**, **AI/Groq** movidos de
  "NOT in Scope" → **"In Scope com restrições"**; seções do **receipt epic** e do **shared link**;
  cumprido o pedido do DEC-207 (reescrita da linha "V1 NOT in scope").
- [x] `technical-direction.md`: **Zustand** removido (Context+repos); SW próprio (não Workbox);
  **RHF confirmado como NÃO usado** (só num log markdown); schema **v9** + 5 tabelas device-local;
  seções **Native (Capacitor)** e **Edge/Server Layer** (KV `SHARE_STORE`, Worker `/ocr` Groq,
  `ShareSignal` DO); "no server" → "local-first + borda opcional portável E2E".
- [x] `decision-log.md`: **bloco de reconciliação** DEC-185..199 + DEC-201 (números **pulados,
  não deletados** — sem backfill inventado, por integridade); tags **SUPERSEDED**
  (DEC-059/064→180; DEC-164→211). Reordenação física 176–180 **não** feita (a não-monotonia é
  histórica e está explicada na nota — mexer reescreveria a história sem ganho).
- [ ] `meetings-log.md` / `competitive-landscape.md`: revisão leve (A8) — **pendente** (baixo
  impacto; fora da Onda 0 mínima).

---

## Apêndice — Estado de referência (2026-06-17)

- **Schema (Dexie):** v9. Tabelas device-local (fora do backup): `localSnapshots` (v5),
  `plannedPurchases` (v6), `mailboxQueue` (v7), `attachments` (v8), `shareLinks` (v9).
- **TransactionType:** `expense | transfer | settlement | adjustment` (sem `income` HOJE —
  **decidido criar `income` completo** na Onda 2-B).
- **Hero "livre de verdade":** `calculateFreeToSpend` (subtrai spent/protected/future-floor/
  event-reserves/planned-purchases) → `calculateTrueFree` aplica `planReserved` na camada do
  hero; `buildFreeToSpendBreakdown` mostra a aritmética (reconcilia a 0).
- **Decisões logadas (entrada formal):** DEC-001..184 + DEC-200..211. **DEC-185..199 e 201** não
  têm entrada formal no log, mas os IDs estão **mapeados** (shell nativo 185–193, motion 194,
  post-animation 195–199/201) na nota de reconciliação do `decision-log.md` e narrados no
  `project-status.md` §"Native Android arc". Próximo ID novo = **DEC-212**.
- **Versões:** web/OTA **0.64.0** (apex), APK nativo mais recente **0.56.0**
  (`latestNativeVersion` 0.56.0; `requiredNativeVersion` 0.50.0), Capgo OTA ativo.
- **Deferidos por design (manter):** B11 (P2P V2), B16 (close-on-background); push app-fechado/
  iOS-web real-time (**B5 decidido**: fora — sideload sem FCM); editar-gasto-de-outros / S9
  (**B4 decidido**: congelado — Julio vai redesenhar).

*Fim do plano. Status 2026-06-17: **Onda 0 (brain) CONCLUÍDA**; decisões travadas — B4 (link
congelado), B5 (sideload-first, sem FCM, nudge via share), B8 (criar `income` completo, gate
isolado). Próximo passo executável: **Onda 1** (B9, B12, B17, B7) e **Onda 2-A** (botão de
compartilhar link). A **Onda 2-B** (`income`) entra como gate dedicado com testes de invariância.
O lote nativo (Onda 4) aguarda uma sessão de device.*
