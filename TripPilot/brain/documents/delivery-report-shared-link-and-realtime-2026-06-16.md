# Relatório de Entrega — Link Compartilhado + Tempo Real (e correções de campo)

- **Data**: 2026-06-16 (trabalho noturno, sessão única)
- **Versões entregues**: **0.56.0** (correções de campo) → **0.57.0** (Link Compartilhado assíncrono) → **0.58.0** (tempo real / S7)
- **Status**: ✅ implementado, testado e em produção (`trippilot.pages.dev`)
- **Decisões**: DEC-207 (link compartilhado, **IMPLEMENTED**), DEC-208/209/210 (correções de campo)
- **Plano-mestre**: `brain/documents/shared-participant-link-research-and-plan-2026-06-16.md`
- **Dev-log**: `src/dev-log.md` (estado atual + seção do épico)

> Este documento explica **tudo o que foi feito, em todas as fases**, por quê, como funciona e quais são os limites honestos. Linguagem do documento: português. Identificadores de código, caminhos e comandos: inglês (padrão do projeto).

---

## 1. O que você pediu (resumo das instruções)

Nesta rodada você trouxe quatro frentes e me deu autonomia total para executar a noite toda e entregar pronto, testado e com documento explicando tudo:

1. **Tempo real (mudança de rumo)**: antes tínhamos travado "sem websocket / sem tempo real". Você **reverteu**: quer sim que, ao criar/dividir um gasto, **chegue na hora no celular da outra pessoa com uma notificação** — desde que seja viável e portável. Aceitou os limites (notificação no iPhone / app fechado é difícil), mas pediu para fazer o que dá, principalmente no Android com o app aberto.
2. **APK não se auto-atualiza**: a atualização **web** (OTA) passou a funcionar, mas o **APK nativo** não vinha sozinho — você precisava achar o APK gerado, mandar pro celular e instalar na mão. Pediu para corrigir e, se não der pra automatizar 100%, ao menos **sempre deixar o APK na pasta Downloads**.
3. **Divisão da nota fiscal**: a leitura por IA "funcionou 100%, perfeito", **mas** na hora de dividir o app **colocava todas as pessoas cadastradas automaticamente**. Você quer **escolher quem** entra na divisão. E a leitura **local (on-device)** "simplesmente não funcionou, não leu nada certo" → pediu para **remover e deixar só a IA**.
4. **Link compartilhado + dívidas compartilhadas**: fazer toda a pesquisa, juntar com o plano-mestre, aplicar tudo com testes entre as etapas, commits e deploys completos, seguindo todas as regras. E **depois escrever este documento**.

As três primeiras já tinham sido resolvidas e empacotadas na **0.56.0**; a quarta (mais o tempo real) é o grosso desta entrega (**0.57.0** e **0.58.0**).

---

## 2. Linha do tempo de versões (contexto)

| Versão | Entrega | Tipo |
|---|---|---|
| 0.51.0 | G1 — anexar foto a despesas | OTA |
| 0.52.0 | Correção crítica de versão/OTA + anexos em toda parte | OTA + APK |
| 0.53.0 | G2 — leitura de nota por IA (Groq) → revisão/divisão → Outing | OTA |
| 0.54.0 | G4 — modos de divisão da conta inteira + "bater com o total" | OTA |
| 0.55.1 | G3 — OCR on-device (ML Kit/tesseract) | OTA + APK |
| **0.56.0** | **Correções de campo**: seletor de quem divide (DEC-208), só IA na nuvem (DEC-209), APK auto-update (DEC-210) | OTA + APK |
| **0.57.0** | **Link Compartilhado** assíncrono, E2E, portável (DEC-207 S1–S4) | OTA |
| **0.58.0** | **Tempo real** no link compartilhado (DEC-207 S7) | OTA |

> 0.57.0 e 0.58.0 são **web-only OTA**: a casca nativa (APK) não mudou, então `latestNativeVersion` continua **0.56.0**. Quem tem o APK 0.56.0 instalado recebe tudo isso pela atualização web, sem reinstalar.

---

## 3. Fase 0 — Pesquisa, conselho e atualização do plano

**Objetivo**: transformar suas instruções em um plano executável, sem suposições silenciosas.

O que fiz:

- **Revisão do plano de tempo real (DEC-207, decisão 1c)**: reescrevi a decisão para registrar honestamente que **tempo real passou a ser desejado**, como uma **camada best-effort sobre o piso de "pull assíncrono"**. Documentei os limites reais (push com app fechado exige FCM/Play Services, que não temos por sermos sideload; iOS-web não tem push nativo viável) — nesses casos cai no pull assíncrono (a pessoa vê na próxima vez que abre).
- **Conselho inline** (multi-perspectiva, conforme `auto-council.mdc`): pesos entre "transporte simples e portável" vs. "tempo real de verdade". Conclusão: usar um **relay de sinal** (WebSocket) que só carrega "mudou algo, vá buscar" — o dado em si continua criptografado no armazenamento. Isso dá o tempo real **sem** criar dependência nova nem vazar conteúdo no transporte.
- **Atualização do plano-mestre** (`shared-participant-link-research-and-plan-2026-06-16.md`): adendo com a nova postura de tempo real e a ordem de gates revisada — **S1–S4** (link assíncrono), **S7** (tempo real), **S8** (recursos nativos do APK), **S9** (polimento).
- **Decisões registradas** no `decision-log.md`: DEC-207 (atualizada para APPROVED + REVISED), e as três de campo (DEC-208/209/210).

Por que assim: suas duas restrições duras continuam valendo — **custo ~zero por muito tempo** e **portabilidade total (sem lock-in)**. Todo o desenho respeita isso.

---

## 4. Fase 1 — Correções de campo (0.56.0)

Três problemas que você reportou usando o app de verdade. Todas as três são puramente de produto/UX e foram empacotadas juntas na 0.56.0.

### 4.1 Divisão da nota: seletor explícito de participantes — DEC-208
- **Problema**: ao dividir a nota, o app **incluía todo mundo cadastrado** automaticamente.
- **Solução**: troquei o preset "Igual (todos)" por um **multi-seleção explícito** ("Dividir com quem?"). Você escolhe 1, 2, … pessoas; os itens incluídos são divididos **igualmente entre os selecionados**; **ninguém selecionado = pessoal**. O editor item-a-item não defaulta mais para "todos" — ele parte da seleção do nível da nota (ou só você).
- **Onde**: `features/receipt/ReceiptScanPage.tsx` (UI/estado puros sobre `ReceiptDraftItem.participantIds`; **zero mudança de matemática/engine**). Mantém "pessoal" como estado-zero.

### 4.2 Leitura de nota: só a IA na nuvem (on-device removido) — DEC-209
- **Problema**: a IA na nuvem leu "100%, perfeito"; a leitura **local** "não leu nada certo".
- **Solução**: removi o caminho on-device da UI de scan. **Groq (opt-in) é o único leitor**, com **entrada manual** como fallback sempre disponível. Removi as dependências `@jcesarmobile/capacitor-ocr` (ML Kit nativo, ~13 MB) e `tesseract.js`, e os arquivos mortos `device-ocr.ts` / `parse-text.ts`.
- **Bônus**: o APK caiu de **21 MB → 8 MB** (ótimo para o novo auto-updater, que baixa o APK).
- **Privacidade preservada**: Groq não treina com os dados (DEC-206), consentimento opt-in continua; offline/sem-consentimento → entrada manual.

### 4.3 APK se auto-atualiza (instalador in-app) + APK sempre no Downloads — DEC-210
- **Problema**: o OTA (Capgo) só troca o **bundle web**; a **casca nativa** só muda reinstalando. E `requiredNativeVersion` só marca o APK como "vencido" quando um bundle *exige* casca nova — então um APK novo-mas-não-obrigatório ficava invisível.
- **Solução** (3 partes):
  1. O manifesto ganhou **`latestNativeVersion`** (o versionName do APK em `apkUrl`). O app sinaliza **`nativeUpdateAvailable`** quando o nativo instalado < `latestNativeVersion`.
  2. **Atualizador in-app Android**: baixa o APK (Filesystem) → dispara o **Intent do instalador do sistema** via um plugin nativo pequeno + FileProvider, com a permissão **`REQUEST_INSTALL_PACKAGES`**. O Android ainda mostra a própria tela de confirmação (não dá pra instalar silenciosamente — e nem deveria). iOS/web: no-op (PWA se auto-atualiza).
  3. O pipeline de build **sempre copia o APK recém-buildado** para `/mnt/c/Users/julio/Downloads/TripPilot-<version>.apk` (one-click mesmo se o caminho in-app for pulado).
- **Onde**: plugin `ApkInstaller` (Android), `utils/app-update.ts` (pure `nativeUpdateAvailable`), `SettingsPage` + boot (`live-update-boot.ts`), `scripts/make-ota-bundle.mjs` (cópia para Downloads).
- **Honesto**: "um toque pra instalar" (você ainda confirma no diálogo do SO), nunca silencioso; sem Play Services/FCM; degrada para o link de download nas cascas antigas.

> **Sobre sua dúvida "por que o APK não vinha por OTA?"**: por design ele **não pode** vir 100% por OTA — só o conteúdo web é trocável no ar; o binário nativo precisa de reinstalação aprovada pelo SO. O que fizemos é o **máximo viável e honesto**: detectar APK novo, baixar e abrir o instalador do sistema com um toque, e sempre deixar o arquivo no Downloads. As entregas 0.57.0/0.58.0 são web-only, então **chegam sozinhas** no seu APK 0.56.0.

---

## 5. Fase 2 — Link Compartilhado assíncrono, E2E e portável (0.57.0) — DEC-207

**A ideia**: você compartilha uma divisão com alguém que **não tem o app**, por um link. A pessoa abre, vê **só a fatia dela** (o que deve / tem a receber), **sem ver a viagem inteira** e **sem criar conta**, podendo **confirmar** despesas e **marcar como pago**. Depois pode, se quiser, "começar a própria viagem".

**A base já existia**: o modelo financeiro é o **owner/mirror** (DEC-106) — o dono é a verdade; o convidado recebe um extrato somente-leitura, confirma/rejeita; as respostas voltam. O que faltava era o **transporte assíncrono** (o convidado abre depois; o dono pode estar offline) → precisávamos de um **artefato persistente no servidor**, endereçado pelo link.

Construí em camadas (gates S1–S4):

### 5.1 S1 — Domínio puro (testável, sem I/O)
- `domain/sync/share-link.ts`: `buildShareUrl(origin, id, key)` e `parseShareKeyFromHash(hash)`. **A chave AES vai no `#fragment` da URL** (`…/s/:id#k=<key>`), que **o navegador nunca envia ao servidor** — mesmo princípio do QR do DEC-103.
- `domain/sync/share-response.ts`: schema Zod `shareResponseBatch` (confirmar/rejeitar linha + proposta de quitação), com `buildShareResponseBatch` / `parseShareResponseBatch` / `mergeShareResponseBatches`.
- `types/share-link.ts`: estrutura `ShareLink` do lado do dono. `MirroredStatement` ganhou a origem `share` (id + chave) para statements vindos de link.
- **Testes**: incluindo um **ciclo real AES-GCM dono↔convidado** (`share-link-cycle.test.ts`) — criptografa, transmite (simulado), descriptografa, responde e reconcilia, tudo com `crypto.subtle` de verdade.

### 5.2 S2 — Worker (armazenamento em Cloudflare KV)
- Namespace **`SHARE_STORE`** (KV).
- Rotas: `POST /share` → `{ id, writeToken, expiresAt }`; `GET /share/:id` (**leitura aberta** do ciphertext — é opaco); `PUT`/`DELETE /share/:id` (operações do dono, autenticadas pelo header `X-Share-Token`); `POST/GET /share/:id/responses` (convidado anexa `{id,blob}` / dono puxa).
- **Segurança do servidor**: o servidor guarda apenas o **SHA-256** do write-token (nunca o token em claro); TTL de 14 dias; `DELETE` vira **tombstone** → leituras futuras retornam **410**; limites de tamanho e quantidade; validação de formato do id (`SHARE_ID_RE`).
- **Por que KV e não D1?** O plano previa D1, mas o **token de deploy não tinha o escopo `d1`** (tinha `workers_kv`). KV é um armazenamento `id → ciphertext` ainda mais simples e **igualmente portável** (valores ciphertext autocontidos + TTL nativo por chave; migrar = copiar chaves para qualquer KV/object store, sem schema preso). **Respeita as duas restrições** (custo zero, portabilidade). Registrei essa troca honestamente na DEC-207 (nota IMPLEMENTED).

### 5.3 S3 — UI do dono (`ShareLinkSheet.tsx`)
- **Gerar link**: criptografa a fatia (`buildStatementPayload` reaproveitado) e cria o registro (`createShareLink`); mostra o link, com **copiar** e **Web Share**.
- **Atualizar dados**: re-criptografa o extrato e dá `PUT` (sobe a revisão) — útil quando você adiciona/edita gastos depois de já ter compartilhado.
- **Ver respostas**: `pullShareResponses` busca o que o convidado confirmou/propôs e **reconcilia** pelo owner/mirror.
- **Revogar**: invalida o link (410).
- O `ShareLink` do dono é rastreado no Dexie: **tabela `shareLinks`, schema v9**, com `share-link-repository`.

### 5.4 S4 — Superfície do convidado (sem precisar de viagem)
- Rotas **fora do `AppShell`** (para um convidado sem viagem conseguir entrar):
  - `/s/:id` → `SharedLinkPage`: lê a URL, `ingestSharedLink` (descriptografa + grava), redireciona para `/shared-with-me`; em erro, mostra mensagem amigável e recuperável (revogado, link malformado, etc.).
  - `/shared-with-me` → `SharedWithMePage`: lista `MirroredStatementsSection`, com intro, estado-vazio e um CTA "começar minha viagem".
- `BootGate`: se a pessoa **não tem viagens** mas **tem statements espelhados**, ela é roteada direto para `/shared-with-me` (experiência de convidado limpa).
- **Convidado confirma/rejeita linha** e marca **"paguei"** → `POST /responses` **best-effort** (se estiver offline, fica na fila e vai quando reconectar). O convidado **nunca reescreve dinheiro** — tudo são **propostas** que o dono reconcilia (estende o confirm/reject do DEC-071).

---

## 6. Fase 3 — Tempo real (0.58.0, S7) — DEC-207

**O que você queria**: criar/dividir um gasto e **já chegar na hora** no celular da outra pessoa, com aviso. Entregue como uma **camada best-effort sobre o pull assíncrono** (que continua sendo o piso garantido).

### 6.1 Worker — `ShareSignal` Durable Object
- Um **Durable Object** que é um **relay de fanout WebSocket puro**, chaveado pelo `shareId`. **Não guarda nada** — só repassa pings minúsculos `{t:'upd'|'resp'}` ("mudou algo, vá buscar"). O conteúdo continua criptografado **no KV**, e o relay nunca vê a chave AES.
- Rota `GET /share/:id/ws`; binding `SHARE_SIGNAL`; migração **v3** (`new_sqlite_classes`).
- **Portabilidade preservada**: o DO é transporte descartável — dá pra trocar por qualquer servidor WebSocket sem tocar nos dados (que estão no KV). Por isso não viola "sem lock-in".

### 6.2 Cliente — transporte (`data/sync/share-signal.ts`)
- `connectShareSignal`: WebSocket (`wss`) com **auto-reconexão**, **backoff exponencial** e um **outbox** (mensagens enfileiradas antes do socket abrir não se perdem).

### 6.3 Fiação (quem ouve o quê)
- **Convidado** (`MirroredStatementsSection.tsx`): ouve `upd` → faz `refreshSharedLink` automático + mostra toast **"Fulano atualizou os gastos compartilhados com você"** (`shareLink.live_update`). Emite `resp` depois de confirmar uma linha ou propor quitação.
- **Dono** (`ShareLinkSheet.tsx`): ouve `resp` → **auto-pull silencioso** das respostas (toast `shareLink.live_response`). Emite `upd` depois de atualizar os dados.
- Resultado prático: **com os dois aparelhos abrindo o link**, você edita e aparece na hora no aparelho dele; ele confirma e aparece na hora pra você.

### 6.4 Limites honestos (fora de escopo, caem no pull assíncrono)
- **Push com app fechado**: exige FCM/Play Services — não temos (somos sideload, DEC-206).
- **iOS-web**: sem push nativo viável.
- Nesses casos, a pessoa vê **na próxima vez que abrir** (o pull assíncrono é o piso garantido — nada se perde).
- **Notificação nativa Android com app em primeiro plano** e **App Links `/s/:id`** ficaram **adiados para o S8** (próximo bump nativo), porque exigem rebuild do APK — não dá por OTA.

---

## 7. Fase 4 — Testes e verificação

Seguindo as regras de qualidade do projeto (testar entre as etapas, lógica com números reais, mockar só as bordas):

- **Unitários (Vitest)**: **1096 testes passando, 124 arquivos**. Inclui o **ciclo real AES-GCM dono↔convidado** e os testes de build/parse/merge dos lotes de resposta. `tsc --noEmit` limpo (app + worker); lints limpos nos arquivos tocados.
- **E2E (Playwright)** — **3 specs PASSANDO** em contextos de navegador isolados (simulando aparelhos diferentes), com **6 screenshots**:
  - `share-link.spec.ts`:
    - dono → convidado isolado → dono: dono gera link, convidado abre, confirma linha, dono puxa e a fatia vira **Pendente → Confirmado**.
    - link malformado mostra **erro amigável e recuperável**.
    - **S7 ao vivo**: o dono atualiza e o convidado (conectado por WebSocket) recebe o **toast na hora, sem nenhuma ação** dele.
  - `receipt-split.spec.ts`: o seletor de divisão **começa pessoal** (botão "Todos" é opt-in) — prova do DEC-208 (nada de auto-todos).
- **Por que Playwright e não o navegador do MCP**: o daemon do navegador do plugin não sobe neste ambiente WSL (sem Chrome/display). O Playwright já estava integrado, roda headless e dá contextos isolados — exatamente o que você pediu ("usar o playwright pra confirmar UI e ler as imagens").

---

## 8. Fase 5 — Build, deploy e verificação em produção

- **Build web**: `npm run build` (verde) → `make-ota-bundle.mjs` gera `dist/bundles/0.58.0.zip` (**649 KB**) e **re-publica o APK 0.56.0** em `dist/trippilot.apk` (+ cópia para o Downloads).
- **Deploy Pages** (produção, apex): `wrangler pages deploy dist --project-name=trippilot --branch=master`. (Lembrete de topologia: `--branch=main` cairia como **Preview**; produção é **`master`**.)
- **Worker** (`trippilot-sync`): redeployado com `SHARE_STORE` (KV) + `ShareSignal` (DO, migração v3).
- **Verificação em produção (ao vivo)**:
  - `GET /version.json` → **0.58.0**, com `access-control-allow-origin: *` + `cache-control: no-store`.
  - `GET /bundles/0.58.0.zip` → 200, CORS `*`. `GET /trippilot.apk` → 200.
  - SPA fallback: `/s/abc123` e `/shared-with-me` → 200 (HTML do app).
  - Ciclo do Worker: `POST /share` → `writeToken`; `GET` aberto; `POST /share/:id/responses {id,blob}` → `{"ok":true}`; `GET /share/:id/ws` → o **Durable Object** respondeu `expected_websocket` (prova de que o relay de tempo real **está ligado** em produção); `DELETE` (dono) → ok; `GET` pós-revogação → **410**. (Registro de teste revogado em seguida, sem deixar lixo.)
- **Commits** (no branch `master`, fluxo local + deploy por CLI — sem push, como nas etapas anteriores):
  - `0.57.0` link compartilhado (`b29012e`) · Playwright (`5d0a785`) · **`ad777db`** tempo real S7 + bump 0.58.0.
  - Obs.: `git commit` está quebrado neste ambiente (injeção de `--trailer` incompatível com o git 2.25.1) → uso o caminho de plumbing (`write-tree` + `commit-tree` + `update-ref`), que funciona.

---

## 9. Como usar (fluxo de ponta a ponta)

**Dono (quem tem o app):**
1. Abra a tela de gastos compartilhados → escolha um participante que não é você → **"Compartilhar por link"**.
2. **Gerar link** → **copiar**/compartilhar (WhatsApp etc.). O link é `…/s/<id>#k=<chave>`.
3. Se mudar gastos depois: **"Atualizar dados"** (sobe a revisão; se o convidado estiver com o link aberto, chega na hora).
4. **"Ver respostas"** quando o convidado confirmar/pagar (ou chega sozinho via tempo real).
5. Pode **revogar** o link quando quiser.

**Convidado (não precisa do app/conta):**
1. Abre o link → cai em **"Compartilhadas comigo"** vendo **só a fatia dele**.
2. **Confirma/rejeita** linhas; marca **"paguei"** (vira proposta para o dono confirmar).
3. Com o link aberto, mudanças do dono aparecem **na hora** com aviso.
4. Opcional: **"começar minha viagem"** para virar usuário pleno.

**Privacidade**: o servidor só vê ciphertext; a chave de descriptografia está no `#` do link (nunca trafega). Um link vazado expõe **apenas aquela fatia**.

---

## 10. O que NÃO foi feito (honesto) e próximos passos

- **S8 — nativo (adiado, exige novo APK)**: Android **App Links** para `/s/:id` (abrir o link direto no app via `assetlinks.json`) + **`LocalNotification`** quando o app está em primeiro plano. Vai no próximo bump nativo (não dá por OTA).
- **Push com app fechado** e **tempo real no iOS-web**: fora de escopo por limitação de plataforma (sem FCM/Play Services; sem push web viável no iOS). Cobertos pelo **pull assíncrono** (piso garantido).
- **Editar/excluir gastos de terceiros pelo convidado**: deixado para uma v1.1 (reconciliação mais pesada); hoje o convidado **adiciona/confirma/quita como proposta**.

---

## 11. Mapa de arquivos (referência rápida)

**Domínio (puro)**
- `src/domain/sync/share-link.ts` · `src/domain/sync/share-response.ts`
- `src/domain/types/share-link.ts` · `src/domain/types/mirrored-statement.ts` (origem `share`)
- `src/domain/orchestrators/share-link-orchestrators.ts` (dono + convidado, push best-effort)

**Dados / transporte**
- `src/data/db/schema.ts` (v9) · `src/data/db/database.ts` · `src/data/repositories/share-link-repository.ts`
- `src/data/sync/share-client.ts` (HTTP) · `src/data/sync/share-signal.ts` (WebSocket)

**UI**
- `src/features/shared/ShareLinkSheet.tsx` (dono) · `src/features/shared/MirroredStatementsSection.tsx` (convidado + tempo real)
- `src/features/shared/SharedWithMePage.tsx` · `src/features/shared/SharedLinkPage.tsx`
- `src/features/onboarding/BootGate.tsx` (rota de convidado) · `src/app/router.tsx` (`/s/:id`, `/shared-with-me`)

**Worker**
- `worker/src/index.ts` (`handleShare` + `ShareSignal` DO + rota `/share/:id/ws`) · `worker/wrangler.jsonc` (`SHARE_STORE`, `SHARE_SIGNAL`, migração v3)

**Testes**
- `src/tests/unit/domain/sync/share-link.test.ts` · `share-response.test.ts` · `share-link-cycle.test.ts`
- `e2e/share-link.spec.ts` · `e2e/receipt-split.spec.ts`

**i18n**: `src/i18n/locales/{pt-BR,en,es}.json` (namespace `shareLink.*`)

**Release**: `src/utils/app-version.ts` · `src/utils/release-notes.ts` · `package.json` · `public/version.json`

---

## 12. Resumo executivo

Em uma sessão: fechei as três correções de campo (seletor de divisão, só-IA na nuvem, auto-update do APK) na **0.56.0**; entreguei o **Link Compartilhado** completo (assíncrono, E2E, portável em KV, reaproveitando owner/mirror) na **0.57.0**; e por cima dele o **tempo real best-effort** (relay `ShareSignal`, toasts ao vivo nos dois lados) na **0.58.0** — tudo com **1096 testes unitários + 3 specs Playwright** passando, **deployado e verificado em produção**, com as decisões registradas com honestidade (incluindo as duas trocas em relação ao plano: KV no lugar de D1, e um `ShareSignal` DO no lugar de reusar o `SyncRoom`). Os limites que não dá para entregar agora (push com app fechado, iOS-web, App Links nativos) estão claramente documentados e cobertos pelo piso de pull assíncrono ou adiados para o S8.
