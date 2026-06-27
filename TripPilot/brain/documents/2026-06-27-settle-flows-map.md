# Mapa de Fluxos de Acerto P2P + Modelo de 15 Estados (G1, leva 2026-06-27)

> **Tarefa-mãe (P0 #1) da leva `2026-06-27-settle-flows-reliability`.** Este documento mapeia **todos** os
> caminhos de "dividir / cobrar / enviar / pagar" entre pessoas (P2P) e define o **modelo canônico de 15
> estados** (DEC-371). **Regra de ouro:** nenhum fluxo de acerto pode ser corrigido (G4–G7) sem estar
> mapeado aqui. As gates de conserto só executam o que este doc descreve.
>
> **Fonte de verdade do código (lido em G1):** `domain/orchestrators/p2p-orchestrators.ts`,
> `domain/orchestrators/mailbox-orchestrators.ts`, `domain/sync/debt-payload.ts`,
> `domain/sync/payment-payload.ts`, `domain/sync/statement-payload.ts`, `domain/types/mailbox.ts`,
> `domain/group-split/group-payment-status.ts`, `domain/group-split/types.ts`, e o módulo puro novo
> `domain/settle-flows/settle-state.ts` (criado nesta gate).
>
> **Decisões que governam este mapa:** DEC-366 (Â-DELIVERY: conectado ⇒ `debt` real-time; **lock de Julio:**
> aparece nos **dois celulares** + histórico de **quem mandou / de onde veio**), DEC-371 (15 estados),
> DEC-372 (linguagem humana), DEC-373 (QR = URL + scanner universal), DEC-345/346/352/353/354 (debt/payment/
> real-time/estados/histórico já existentes), DEC-350 (`resolveSelfShareName`), DEC-207 (Worker só vê
> ciphertext).

---

## §0 — Vocabulário e convenções

- **Conectado:** a pessoa tem um `PeerLink` com `publicKey` (escaneou/abriu a conexão; DEC-344). Só para
  conectados existe o caminho `debt`/`payment` real-time (selado para `peer.publicKey`).
- **Não-conectado:** sem `publicKey` → o app **não** consegue selar/entregar nada; o único caminho é
  **link/QR/WhatsApp** (fallback público).
- **Criador (`creator`):** quem inicia a divisão/cobrança/extrato. Por convenção, o **credor**.
- **Recebedor (`receiver`):** a contraparte. Por convenção, o **devedor**. (No fluxo E "eu paguei", os
  papéis invertem na camada de orquestração; a máquina de estados mantém a convenção credor=criador.)
- **Dinheiro:** inteiro em centavos. **A aritmética do acerto é invariante nesta leva** — só mudamos
  *quando/onde* a verdade chega e *como* aparece.
- **Entidade canônica de uma ação pendente entre conectados = `debt`** (`SharedDebtPayload`, accept-first).
  Statement-espelhado (`storeMirroredStatement` → "Recebidos de outros aparelhos") deixa de ser o caminho
  principal (DEC-366/372).
- **Idempotência:** `debtId` (debt) e `paymentId` (payment) são estáveis → re-drain/redelivery nunca
  funde/liquida em dobro (`externalRefForDebt`, `payment:<actor>:<id>`).
- **Provˆ-nância (lock DEC-366):** todo `debt` carrega `fromActorId` + `fromName` (quem mandou) e
  `description`/`occurredAt` (de onde veio / qual gasto). Ao aceitar, isso vira a `externalRef` + a linha de
  histórico, visível dos **dois lados**.

---

## §1 — Modelo de 15 estados (DEC-371)

Definido em `domain/settle-flows/settle-state.ts` (puro, data-driven, sem React/IO/i18n). Cada estado tem
`{ tone, closesObligation, terminal, inFlight, showsAsOwing, actionableBy, notifies }`. **Aplicação na UI =
G6** (aqui é só a especificação).

| # | Estado (code) | pt-BR | O que o **criador** vê | O que o **recebedor** vê | Onde aparece | Ações disponíveis | Notificação | Tom · "deve"? |
|---|---|---|---|---|---|---|---|---|
| 1 | `draft` | rascunho | compondo a divisão (ainda não real) | — (nada) | tela de criar | editar · enviar · descartar | — | muted · não |
| 2 | `created` | criada | "pronta para enviar" | — | tela de criar / fila | enviar · cancelar | — | pending · não |
| 3 | `sending` | enviando | "enviando…" (in-flight) | — | eco local | (sistema) | — | pending · não |
| 4 | `sent` | enviada | "enviado para {nome} · aguardando aceitar" (eco local) | ainda nada (vai drenar) | eco local + perfil da pessoa | cancelar | — | pending · não |
| 5 | `received` | recebida | (sem mudança no criador) | "{criador} te enviou uma divisão" | central + home + acerto + perfil | abrir detalhe | → recebedor | pending · não |
| 6 | `awaiting_acceptance` | aguardando aceite | "aguardando {nome} aceitar" | "Aceitar ou recusar esta divisão" | central + home + acerto + perfil (dos dois) | aceitar · rejeitar | — | pending · não |
| 7 | `accepted` | aceita | "{nome} aceitou" | "Você aceitou · agora deve {valor}" | acerto + perfil (dos dois) | (criador) lembrar · (recebedor) pagar | → criador | neutral · **sim** (recebedor) |
| 8 | `rejected` | rejeitada | "{nome} rejeitou" | "Você recusou" | central + acerto (criador) | reenviar · cancelar | → criador | danger · não |
| 9 | `awaiting_payment` | aguardando pagamento | "aguardando {nome} pagar" | "Você deve {valor} para {nome}" | acerto + perfil + home (recebedor) | registrar pagamento · pagamento manual | — | pending · **sim** (recebedor) |
| 10 | `marked_paid` | marcada como paga | "{nome} marcou como pago — confirme" | "Você marcou como pago · aguardando confirmação" | acerto + perfil (dos dois) | (criador) confirmar/contestar | → criador | **neutral · NUNCA "deve"** |
| 11 | `awaiting_confirmation` | aguardando confirmação | "confirme o recebimento de {nome}" | "aguardando {nome} confirmar" | acerto + perfil (dos dois) | (criador) confirmar · rejeitar | — | **neutral · NUNCA "deve"** |
| 12 | `confirmed` | confirmada | "recebido de {nome} ✓" | "{nome} confirmou ✓ · quitado" | acerto (quitado) + histórico (dos dois) | reabrir (Â9) | → recebedor | positive · não |
| 13 | `cancelled` | cancelada | "você cancelou" | "{criador} cancelou" | histórico | reativar (Â9) | → recebedor | muted · não |
| 14 | `send_failed` | erro de envio | "falha ao enviar — tentar de novo" | — | eco local / fila | tentar de novo · cancelar | → criador | danger · não |
| 15 | `expired` | expirada | "expirou sem resposta" | — | histórico | reenviar | → criador | muted · não |

**Invariantes pinados por teste (`settle-state.test.ts`, 19 testes):** os 15 existem; a máquina é total
(todo alvo é estado conhecido) e reversível (Â9); **`marked_paid`/`awaiting_confirmation` são `neutral`,
nunca `danger`, e `showsAsOwing=false`** (a regra de justiça — nunca penalizar quem disse "paguei");
**só `confirmed` fecha obrigação**; a ponte `settleStateFromGroupPayment` reconcilia os 5 estados do grupo
(DEC-353) com o vocabulário de 15.

**Ponte com o grupo (DEC-353 → DEC-371):** `unpaid→awaiting_payment`, `marked→marked_paid`,
`confirmed→confirmed`, `contested→awaiting_payment` (devedor ainda deve após "paguei" contestado — o tom
danger do contestado é nuance só-do-grupo), `cancelled→cancelled`.

---

## §2 — Estrutura obrigatória por fluxo

Cada fluxo abaixo cobre: **quem cria · quem recebe · entidade criada · onde aparece · status inicial · ação
do usuário · onde a ação aparece · accept/reject/pay/confirm · sync dos dois lados · notificações · cards na
home · em Acerto de Contas · dentro da pessoa · na central · no link público · sem app · com app.**

---

### Fluxo A — Divisão com pessoa **conectada** (o caminho canônico, DEC-366) — alvo G5

| Campo | Mapa |
|---|---|
| **Quem cria** | Eu (criador/credor), ao dividir um gasto com uma pessoa **conectada**. |
| **Quem recebe** | A pessoa conectada (recebedor/devedor da sua parte). |
| **Entidade criada** | Um **`debt`** (`SharedDebtPayload`: `debtId`, `fromActorId`, `fromName`, `currency`, `amountCents`=parte dela, `description`=nome do gasto, `occurredAt`). **NÃO** um `statement`. Selado para `peer.publicKey` via `shareDebtWithPeer`/`sealAndQueue`. |
| **Onde aparece (criador)** | **Eco local** imediato: "enviado para {nome} · aguardando aceitar" (estado `sent`→`awaiting_acceptance`), no perfil da pessoa + em Acerto de Contas. **Lock DEC-366: aparece no MEU celular também**, não só no dela. |
| **Onde aparece (recebedor)** | `received`→`awaiting_acceptance`: **central de notificações + card na home ("ações pendentes") + Acerto de Contas + perfil da pessoa** (via `getInboundP2pItems` → fila inbound PENDING; DEC-352). |
| **Status inicial** | criador: `sent`/`awaiting_acceptance`; recebedor: `received`→`awaiting_acceptance` (accept-first — nada funde no ledger até aceitar). |
| **Ação do usuário** | Recebedor: **aceitar** ou **rejeitar** (`acceptInboundDebt` / `dismissInboundP2p`). |
| **Onde a ação aparece** | Card "aguardando aceite" na home + item na central + linha no Acerto + no perfil da pessoa — **todos abrindo o mesmo detalhe** (G6, F2/F3). |
| **Aceitar** | `acceptInboundDebt`: funde como **shared expense** no ledger do recebedor (payer = o remetente/credor; share confirmado = o valor). Idempotente via `externalRefForDebt`. → estado `accepted`/`awaiting_payment`. **A dívida entra no saldo dos dois ao aceitar.** |
| **Rejeitar** | `dismissInboundP2p` (hide-never-corrupt: dropa o item). → `rejected`; notifica o criador. |
| **Pagar / confirmar** | depois de `accepted`, o devedor paga (Fluxo D) → `marked_paid`→`awaiting_confirmation`→`confirmed`. |
| **Sync dos dois lados** | `flushOutbox` → `postToMailbox` → **`pingPeerMailbox`** (peer-ping real-time, DEC-352): o app aberto do recebedor drena na hora. Accept/reject volta via o caminho debt/estado; os dois convergem **sem recarregar**. |
| **Notificações** | recebedor em `received`; criador em `accepted`/`rejected` (ver §1). Roteadas por `domain/insights/notifications.ts` + `useNotifications`. |
| **Cards na home** | recebedor: card "ações pendentes" (`useDashboardModel`). criador: "aguardando aceite". |
| **Em Acerto de Contas** | a divisão é uma linha real (não em "Recebidos…"); estado da §1; abre detalhe. |
| **Dentro da pessoa** | perfil da pessoa lê a **mesma fonte `debt`** (não diverge) — linha com estado + ação + **histórico (quem mandou / de onde veio)**. |
| **Na central** | item acionável (abre detalhe), nunca só toast. |
| **No link público** | **não usado** para conectado (é o fallback do Fluxo B). |
| **Sem app** | N/A (este fluxo é só para conectado). |
| **Com app** | ✅ este é o caminho. |
| **GAP atual / conserto (G5)** | hoje "dividir com conectado"/"enviar extrato" usa `kind:'statement'`→`storeMirroredStatement`→"Recebidos…" (escondido, "tudo quitado", não-acionável). **Conserto:** rotear conectado ⇒ `debt`; eco local; perfil/acerto lêem a mesma fonte; dedupe link+app; statement legado vira secundário. |

---

### Fluxo B — Divisão com pessoa **sem app** (fallback público) — alvo G5/G7

| Campo | Mapa |
|---|---|
| **Quem cria** | Eu, ao dividir com alguém **não-conectado** (sem `publicKey`). |
| **Quem recebe** | A pessoa, por **link/QR/WhatsApp**. |
| **Entidade criada** | Um **link público** (`buildQrUrl`, DEC-351/373) que abre uma rota válida com o payload da divisão no fragmento (`#`), **OU** um registro local de dívida nascida-confirmada no meu ledger (a pessoa não tem como aceitar no app). |
| **Onde aparece (criador)** | Acerto de Contas (dívida a receber) + perfil da pessoa (manual). |
| **Onde aparece (recebedor)** | só ao abrir o link (web `/s/` ou similar) — não há app para drenar. |
| **Status inicial** | criador: `created`/`sent` (link gerado); a confirmação é manual. |
| **Ação do usuário** | Criador: compartilhar o link. Recebedor (web): ver o resumo; opcionalmente instalar o app e conectar (vira Fluxo A daí em diante). |
| **Onde a ação aparece** | sheet de compartilhar (WhatsApp/copiar/QR). |
| **Aceitar/Rejeitar** | não há accept-first remoto (sem app); o criador gerencia manualmente. |
| **Pagar/Confirmar** | manual no Acerto (o credor marca quando recebe). |
| **Sync dos dois lados** | nenhum (não-conectado). Se a pessoa instalar + conectar, migra para o caminho `debt` (dedupe pelo conteúdo). |
| **Notificações** | nenhuma push (sem app do outro lado). |
| **Cards na home / Acerto / pessoa / central** | só no lado do criador (dívida manual). |
| **No link público** | ✅ é o caminho. O link **tem que** abrir algo útil (DEC-373 — nunca "nenhum dado usável"). |
| **Sem app** | ✅ este é o caminho. |
| **Com app** | se a pessoa passar a ter app + conexão → Fluxo A (preferir `debt`; dedupe). |
| **GAP / conserto (G5/G7)** | garantir que o link é `buildQrUrl` (G7) e que, quando a pessoa **é** conectada, o app **não** cai aqui (Fluxo A vence; link é só fallback). |

---

### Fluxo C — Cobrança manual (criar uma dívida "você me deve X") — alvo G5/G6

| Campo | Mapa |
|---|---|
| **Quem cria** | Eu (credor), cobrando alguém por um valor (sem um gasto dividido formal). |
| **Quem recebe** | A pessoa cobrada. |
| **Entidade criada** | Conectado: `debt` (`shareDebtWithPeer`, `description`=motivo da cobrança). Não-conectado: link (Fluxo B). |
| **Onde aparece (criador)** | eco local "cobrança enviada para {nome} · aguardando aceitar"; Acerto + perfil. |
| **Onde aparece (recebedor)** | central + home + Acerto + perfil (igual Fluxo A). |
| **Status inicial** | `sent`→`awaiting_acceptance`. |
| **Ação do usuário** | recebedor: **aceitar** (concordo que devo) ou **rejeitar** (não devo). |
| **Onde a ação aparece** | card/central/acerto/perfil → mesmo **detalhe da cobrança** (G6, F3). |
| **Aceitar** | `acceptInboundDebt` → dívida real nos dois saldos; estado `accepted`/`awaiting_payment`. |
| **Rejeitar** | `dismissInboundP2p` → `rejected`; notifica o criador (que pode reabrir conversa fora do app). |
| **Pagar/Confirmar** | Fluxo D. |
| **Sync dos dois lados** | peer-ping real-time; convergem sem reload. |
| **Notificações** | igual §1. |
| **Cards / Acerto / pessoa / central** | igual Fluxo A. |
| **No link público** | só no fallback não-conectado. |
| **Sem app / Com app** | igual A/B. |
| **GAP / conserto (G6)** | a cobrança recebida precisa de **tela de detalhe própria** (quem/o quê/total/sua parte/data/obs/comprovante/status + ações) — F3. |

---

### Fluxo D — Pagamento de uma **dívida específica** — alvo G6

| Campo | Mapa |
|---|---|
| **Quem cria** | O **devedor** (recebedor original), pagando uma dívida `accepted`/`awaiting_payment`. |
| **Quem recebe** | O **credor** (criador original), que confirma o recebimento. |
| **Entidade criada** | Um **`payment`** (`PaymentPayload`, `direction:'paid'`, `paymentId`, `amountCents`, `note?`, `proof?`/`proofThumb?` DEC-363) atrelado àquela dívida. `announcePaymentToPeer`. |
| **Onde aparece (devedor)** | "marquei como pago · aguardando {credor} confirmar" (`marked_paid`/`awaiting_confirmation`). |
| **Onde aparece (credor)** | central + Acerto + perfil: "{devedor} marcou como pago — confirme" (inbound `payment` PENDING, `getInboundP2pItems`). |
| **Status inicial** | devedor: `marked_paid`→`awaiting_confirmation`; credor: recebe pendência de confirmação. |
| **Ação do usuário** | credor: **confirmar recebimento** (`confirmInboundPayment`) ou **contestar** (não recebi). |
| **Onde a ação aparece** | detalhe da dívida/cobrança + central + acerto. |
| **Aceitar/Confirmar** | `confirmInboundPayment`: cria `Settlement` (fecha a obrigação, nunca vermelho) e, se **eu recebi** o dinheiro, credita o fundo/carteira (L8). Idempotente (`payment:<actor>:<id>`). → `confirmed`. |
| **Rejeitar/Contestar** | volta para `awaiting_payment` (o devedor realmente precisa pagar). **Justiça:** enquanto `marked_paid`/`awaiting_confirmation`, o devedor **nunca** aparece como "deve" (§1). |
| **Pagamento manual ≠ aqui** | dentro da dívida = liquida **aquela** dívida; fora = movimentação manual (Fluxo E), que **nunca** auto-liquida sem confirmação (F4). |
| **Sync dos dois lados** | peer-ping; os dois convergem; o credor vê "confirmado", o devedor vê "quitado". |
| **Notificações** | `marked_paid`→criador/credor; `confirmed`→recebedor/devedor (§1). |
| **Cards / Acerto / pessoa / central** | a dívida muda de estado em todas as superfícies (mesma fonte). |
| **No link público** | N/A (entre conectados). |
| **Sem app / Com app** | sem app: o credor marca manualmente no Acerto. Com app: o caminho `payment`. |
| **GAP / conserto (G6)** | separar claramente **aceitar divisão × registrar pagamento × confirmar recebimento × pagamento manual** (F4); rótulos por autoridade. |

---

### Fluxo E — Pagamento **manual** (movimentação solta) — alvo G6

| Campo | Mapa |
|---|---|
| **Quem cria** | Eu, registrando um pagamento solto ("paguei/recebi X de fulano") **sem** estar dentro de uma cobrança específica. `announcePaymentToPeer` (`direction:'paid'`/`'received'`). |
| **Quem recebe** | A contraparte conectada (confirma), se houver. |
| **Entidade criada** | `payment` (mesma estrutura do Fluxo D) **OU** só um `Settlement` local quando não-conectado. |
| **Onde aparece** | Acerto + perfil; eco local. |
| **Status inicial** | criador: liquida **o seu lado** imediatamente (o dinheiro moveu); o outro lado confirma. |
| **Ação do usuário** | contraparte: **confirmar** (igual Fluxo D). |
| **Aceitar/Confirmar/Rejeitar** | igual Fluxo D (`confirmInboundPayment`). |
| **REGRA F4 (a dor de Julio):** | um **pagamento manual NUNCA auto-liquida** uma cobrança específica. Se houver dívida compatível, a UI **sugere** abater **confirmando qual** — nunca silenciosamente. |
| **Sync / Notificações / Cards / Acerto / pessoa / central** | igual Fluxo D. |
| **No link público / Sem app / Com app** | igual D (sem app: só `Settlement` local). |
| **GAP / conserto (G6)** | a confusão "registrei pagamento e a cobrança não sumiu" se resolve **separando** os verbos + a sugestão-com-confirmação. |

---

### Fluxo F — Enviar **extrato** (informativo) — alvo G4/G5

| Campo | Mapa |
|---|---|
| **Quem cria** | Eu, querendo mostrar a outra pessoa o resumo das nossas contas. |
| **Quem recebe** | A pessoa (conectada ou não). |
| **Entidade criada (hoje)** | `kind:'statement'` (`StatementPayload`) → `storeMirroredStatement` → superfície **"Recebidos de outros aparelhos"** (`MirroredStatementsSection`): escondida, "tudo quitado", **não-acionável**. |
| **Decisão (DEC-366):** | o **statement deixa de ser o caminho principal**. Se há **ação pendente** (divisão/cobrança), vai por `debt` (Fluxo A/C). O extrato **puramente informativo** (multi-gasto, sem ação) pode continuar como "extrato informativo" técnico/secundário — **mas nunca como o lugar de uma ação pendente**. |
| **Onde aparece** | (informativo) numa área secundária "extrato informativo"; (com ação) nas superfícies do Fluxo A. |
| **Status inicial** | informativo: sem estado de obrigação; com ação: estados §1. |
| **Ação do usuário** | informativo: só ler; com ação: aceitar/pagar (vira Fluxo A/D). |
| **Sync / Notificações** | informativo: sem push acionável; com ação: real-time como Fluxo A. |
| **Cards / Acerto / pessoa / central** | informativo: **não** ocupa o lugar de ação pendente (DEC-372); fica secundário. |
| **No link público** | um extrato informativo pode virar link `buildQrUrl` (G7) que abre o resumo. |
| **Sem app / Com app** | conectado com ação ⇒ Fluxo A (`debt`); senão informativo/secundário. |
| **GAP / conserto (G4/G5)** | (G4) **demover** `MirroredStatementsSection` e matar a linguagem "caixa postal"/"Recebidos…"; (G5) rotear qualquer **ação** por `debt`. |

---

### Fluxo G — QR de extrato / divisão / cobrança — alvo G7

| Campo | Mapa |
|---|---|
| **Quem cria** | Eu, gerando um QR para compartilhar uma divisão/cobrança/extrato/convite/conexão/grupo. |
| **Quem recebe** | Quem escaneia (câmera padrão **ou** o scanner do app). |
| **Entidade criada** | Um **QR = URL** (`buildQrUrl(kind, payload)` → `https://…/<rota>#<payload>`), DEC-351/373. |
| **Onde aparece** | `QrCodeDisplay` (todos os call-sites auditados em G7). |
| **Status inicial** | depende do kind (divisão→Fluxo A/B; cobrança→C; extrato→F). |
| **Ação do usuário** | **câmera padrão:** abre a URL → rota útil (instala/conecta/aceita). **Scanner do app:** parseia a URL e **roteia qualquer kind** (não só conexão). |
| **Aceitar/etc** | conforme o kind, recai nos fluxos A–F. |
| **Sync / Notificações / Cards / Acerto / pessoa / central** | conforme o kind. |
| **No link público** | ✅ é o ponto: o QR **é** o link público. |
| **Sem app** | a câmera padrão abre a web (`/s/`, `/install`, etc.) — nunca "nenhum dado usável encontrado" (DEC-373). |
| **Com app** | o scanner do app entende o kind e roteia direto; se inevitável, "abra no app e escaneie de novo". |
| **GAP / conserto (G7)** | hoje `buildQrUrl` cobriu identidade/conexão/grupo (DEC-351); **extrato/divisão/cobrança** ainda crus e o `QrScanner` só roteia identidade → estender ambos. |

---

## §3 — Matriz cruzada (superfície × fluxo) — onde cada ação pendente DEVE aparecer

> DEC-366/F1: **toda ação pendente** aparece em **todas** as superfícies abaixo, lendo a **mesma fonte
> `debt`/estado** (nunca divergir). "Recebidos de outros aparelhos" **sai** da coluna de ação.

| Superfície | A (divisão conect.) | C (cobrança) | D (pagar dívida) | E (pgto manual) | F (extrato) |
|---|---|---|---|---|---|
| Central de notificações | ✅ acionável | ✅ | ✅ confirmar | ✅ confirmar | ➖ informativo |
| Card "ações pendentes" (home) | ✅ | ✅ | ✅ | ✅ | ➖ |
| Acerto de Contas (linha + detalhe) | ✅ | ✅ | ✅ | ✅ | ➖ secundário |
| Perfil da pessoa (mesma fonte + histórico) | ✅ | ✅ | ✅ | ✅ | ➖ |
| "Resolver Agora" | ✅ | ✅ | ✅ | ✅ | ➖ |
| "Recebidos de outros aparelhos" | ❌ (sai) | ❌ | ❌ | ❌ | ➖ técnico/secundário |

---

## §4 — Provˆ-nância & histórico (lock DEC-366 de Julio)

Julio: *"tem que aparecer nos dois celulares, e ficar no histórico como foi feito, quem mandou a dívida, de
onde veio."*

- **Dois celulares:** o criador tem o **eco local** (`sent`/`awaiting_acceptance`) e o recebedor tem a
  pendência (`received`/`awaiting_acceptance`); ambos evoluem pelos mesmos estados via peer-ping.
- **Histórico (quem mandou / de onde veio):** o `debt` carrega `fromActorId` + `fromName` (quem mandou) e
  `description` + `occurredAt` (de onde veio / qual gasto / quando). Ao aceitar, vira `externalRef` no
  ledger + uma linha de histórico no perfil da pessoa (reusa o padrão `GroupActivity`/DEC-354 para o P2P em
  G6). Os dois lados veem "quem · o quê · quando · estado".
- **Implementação:** sem campo novo de transporte para "quem mandou" (já está no payload). Em G6, o
  **detalhe** e o **histórico do perfil** renderizam essa proveniência; em G5, a entrega já preserva
  `fromActorId`/`fromName` no inbound item (`InboundP2pItem.fromActorId`).

---

## §5 — Gates que este doc destrava

- **G4** (linguagem/demover): executa o "Recebidos… sai da ação" (Fluxo F, §3) + mata "caixa postal".
- **G5** (entrega): executa Fluxo A/C (conectado ⇒ `debt`), eco local, dedupe, statement demovido.
- **G6** (ações/telas/estados): executa Fluxo D/E (verbos distintos, detalhe, F4) + aplica as 15 states (§1).
- **G7** (QR): executa Fluxo G (todo QR = URL + scanner universal).

**Nenhuma dessas gates pode editar um fluxo que não esteja mapeado acima.** Se um caso novo aparecer em
campo, mapeie aqui primeiro (emenda a este doc) e só então conserte.

---

_G1 (leva 2026-06-27). Tipos puros: `domain/settle-flows/settle-state.ts` (+ 19 testes). Doc gating para
G4–G7._
