# Leva — Acerto Confiável (P2P) + Instalação Clara + Privacidade do Microfone

> **Status: ⏳ AWAITING LOCK (G5 / G8 / G3).** Esta leva responde o **4º review de campo** de Julio
> (vídeo `Trippilot_original.txt` + briefing estruturado). É a continuação direta da leva
> `2026-06-26-group-reliability-settle-redesign` (G1→G_last, shipped `1.3.1-rc`→`1.4.4-rc`) e do item de
> instalação `DEC-362` (`1.4.11-rc`). **A dor central:** a leva anterior consertou o **grupo (`/g/`)**, mas o
> fluxo **pessoa-a-pessoa P2P** ("enviar extrato", "cobrar", divisão com pessoa conectada) **continua usando
> a "caixa postal" → `storeMirroredStatement` → "Recebidos de outros aparelhos"** (escondido, "tudo
> quitado", não acionável), em vez do caminho `debt` real-time que cai em notificações + acerto + perfil +
> aceitar/rejeitar. Além disso: o **fluxo de instalação recém-lançado (DEC-362) está quebrado** (o aviso
> some e não leva a lugar nenhum; iOS mostra APK; sem botão de atalho no Android) e o **microfone fica ativo**
> após a Entrada por IA no iPhone.
> **Base:** `1.4.12-rc`. **Cadência:** `1.4.13-rc → 1.4.16-rc`, **headline `1.5.0-rc` em G5** (entrega
> automática P2P), depois `1.5.1 → 1.5.4-rc`.
> **Irmãos (tom/estrutura):** `2026-06-26-group-reliability-settle-redesign-orchestrator.md`,
> `2026-06-25-discovery-clarity-implementation-orchestrator.md`.

---

## §0 — Mission

Fazer com que **dividir um gasto com alguém simplesmente funcione**: eu registro, a pessoa **recebe no app
dela, vê claramente, aceita ou rejeita, e os dois lados ficam atualizados** — sem "caixa postal", sem link
manual quando a pessoa já tem o app, sem item escondido em "Recebidos de outros aparelhos", sem precisar
recarregar. E, em paralelo, **consertar a instalação** (o caminho de virar app) e **a privacidade do
microfone**.

A dor central, nas palavras de Julio (4º review):

- *"Enviar pela caixa postal nunca funciona — a outra pessoa nunca recebe nada."* (entrega P2P quebrada)
- *"Apareceu bem escondido lá embaixo em 'Recebidos de outros aparelhos', como 'tudo quitado', mesmo tendo
ação pendente."* (superfície errada + texto mentiroso)
- *"O card amarelo 'aguardando aceite' não abre nada quando clico."* (resumo sem detalhe)
- *"Júlio tem o app e está conectado — eu não devia ter que mandar link; a divisão tinha que chegar
sozinha no app dele."* (auto-entrega para conectado)
- *"O QR de enviar extrato diz 'nenhum dado usável encontrado' na câmera; e o leitor só serve pra conectar
celular, não lê os outros QR do app."* (QR-as-URL incompleto + scanner restrito)
- *"O usuário não quer saber o que é 'caixa postal' — ele só quer que o outro celular receba."* (linguagem)
- *"Quando clico no aviso pra instalar o app, ele some e não leva a lugar nenhum; no iPhone aparece coisa de
APK (iPhone não instala APK); e no Android, se o APK não deu certo, não tem botão pra instalar o atalho."*
(instalação)
- *"Depois de usar o microfone na Entrada por IA, o indicador do iPhone continua aceso — parece que a gente
está gravando o tempo todo."* (privacidade)
- *"Se eu não abro 'detalhes', o local não é salvo — eu queria que todo gasto guardasse o ponto no mapa."*
  - *"quero ver um mapa de onde eu estava no detalhe do gasto."* (localização)
- *"Preciso poder excluir pessoas conectadas."* (limpeza)

**Antes de qualquer correção de fluxo de acerto, existe a tarefa-mãe (P0 #1):** produzir um **documento
completo de fluxos** que mapeia todos os caminhos. **Nenhum fluxo de gasto dividido pode ser corrigido sem
estar mapeado nesse documento** (G1). As gates de conserto (G4+) só executam o que o documento mapeou.

**O que esta leva É:** (a) o **documento de fluxos** (G1); (b) **instalação** consertada (G2); (c)
**microfone** com ciclo de vida controlado (G3); (d) **linguagem humana** — matar "caixa postal" e
"Recebidos de outros aparelhos" como lugar principal (G4); (e) **entrega automática P2P** para pessoa
conectada como **dívida compartilhada** real-time (G5, headline); (f) **ações pendentes acionáveis** em
todos os lugares + telas de detalhe + diferenciar aceitar/pagar/confirmar (G6); (g) **todo QR = URL** +
scanner universal (G7); (h) **local salvo sempre** + **mapa no detalhe** (G8); (i) **excluir pessoas
conectadas** + nome real (G9).

**O que esta leva NÃO é:** login/contas (identidade segue `actorId` do aparelho + nome do onboarding); uma
reescrita da matemática do acerto (a aritmética é **invariante** — mudamos *onde/quando* a verdade chega e
*como* aparece); push nativo (APNs/FCM) — "real-time" = peer-ping enquanto o app está alcançável; e **não é
mexer no visual bonito** do Acerto de Contas (Julio: "a tela tá boa, conserte o fluxo por trás").

TripPilot é um PWA local-first de orçamento de viagem (React + TS + Dexie; domínio TS puro; Cloudflare Pages

- um Worker `trippilot-sync`). **§16 tem 3 locks (L-DELIVERY/G5, L-MAP/G8, L-MIC/G3) — ver §16; G1–G2–G4
podem começar já.**

---

## §1 — Identidade & contrato de autonomia (você é o executor)

1. **Sem subagents / sem Task tool / sem delegação.** Tudo inline, uma sessão. Councils = seções.
2. **Não pedir permissão para avançar** depois que o lock da gate está satisfeito. Milestone → commit →
  deploy → dev-log → próximo. Só pare no hand-off genuíno (DoD tudo TRUE / blocker duro / contexto no fim /
   um **lock §16 aberto** da próxima gate).
3. **Faça, não narre.** Minimize prosa.
4. **Reuse, nunca reinvente.** §4 baseline + §6 root-cause dizem o que já existe. Esta leva é ~70%
  *reapontar/relabelar/recompor* — o caminho `debt` (G7 da leva anterior), o peer-ping (DEC-352), o
   notification center (DEC-352), o `getCurrentCoords` e o `ImageRef` já existem.
5. **Código em inglês; UI via `t()`** (pt/en/es), nunca hardcoded. Dinheiro = inteiro em centavos.
6. **Domínio antes da UI**, uma mudança por vez, **teste junto com a mudança**.
7. **Segurança do terminal WSL** (§11): `git --no-pager`, `"$G" commit -m`, nunca pager/editor.
8. **Manter o brain em sincronia** (§14) a cada milestone.
9. **A mensagem de hand-off do terminal termina com `AskQuestion`** — só num stop genuíno.

Uma ambiguidade **nova** que o brain + este doc não resolvam → council inline na hora → `DEC-NNN (PROPOSED)`
→ continue.

---

## §2 — Ordem de leitura (carregue uma vez)

Este doc §0–§9 → `src/dev-log.md` (Current State) → o **documento de fluxos** que G1 produz (depois de G1) →
as DECs citadas apenas (**DEC-344** peer-ping, **DEC-345/346** debt/payment, **DEC-352** real-time+notif,
**DEC-353/354** payment states+history, **DEC-356/357/359** settle IA/Pessoas, **DEC-350** nome onboarding,
**DEC-351** QR-as-URL, **DEC-362** install, **DEC-207** Worker-ciphertext, **DEC-246** AI quick entry,
**ÂNCORA 8** localização) → `product-spec.md` §25/§28. **Não releia o brain inteiro por milestone.**

---

## §3 — Não-negociáveis (ÂNCORA)

**Herdados (app-wide):**

- **Dinheiro = inteiro em centavos**; domínio TS puro (zero React em `domain/`); **Σ shares == amount**.
- **Invariância da matemática do acerto:** a *aritmética* (debt engine, balances, transfers, settlement) é
**inalterada** nesta leva. Mudamos *timing de propagação*, *display*, *roteamento de superfície*, *cópia*
— **nunca a fórmula**. Fazer um total defasado ficar **correto** é bug-fix, não mudança de matemática.
- **Esconder, nunca apagar** (hide-never-delete); nada destrutivo sem undo/tombstone.
- **UI via `t()`** em pt/en/es; **código em inglês**.
- **Nunca bloquear o registro de gasto** — entrada manual sempre funciona; IA/foto/nuvem/sync são opt-in. E
**nunca bloquear a entrega de uma divisão** porque o outro está offline (cai na fila + peer-ping).
- **Sem login.** Identidade = `actorId` do aparelho + **nome do onboarding** (`resolveSelfShareName` =
ownerName ?? profileName ?? deviceName, DEC-350). **Nunca mostrar "Android Chrome" como pessoa.**
- **DEC-207:** o Worker só vê **ciphertext** para mensagens/dívidas/nomes/extratos. Imagens são o único
carve-out (plaintext em R2, DEC-348). Esta leva **não** afrouxa isso.
- **Schema só aditivo** (campos novos opcionais, não indexados) salvo migração real justificada.

**Novos desta leva (derivados dos councils §7):**

- **Â-DELIVERY (DEC-366):** para uma pessoa **conectada**, uma divisão/cobrança/extrato vira uma **dívida
compartilhada (`debt`) accept-first**, entregue em tempo real (peer-ping) e roteada para
**notificações + tela inicial + Acerto de Contas + perfil da pessoa** — **link/QR é fallback** só para
quem **não** tem o app. O caminho `statement`→`storeMirroredStatement` deixa de ser o principal.
- **Â-LANG (DEC-372):** a interface comum **nunca** usa "caixa postal", "Recebidos de outros aparelhos",
"Atualizar dados", "Ver respostas", "Aguardando sincronizar", "Nenhum dado usável encontrado". O texto
diz o que o usuário **pode fazer** ("Enviar para Júlio", "Júlio recebeu", "Aguardando Júlio aceitar").
- **Â-QR (DEC-373):** **todo** QR do app é uma **URL** que abre uma rota válida; o **scanner do app lê
qualquer QR do app** (não só conexão).
- **Â-MIC (DEC-365):** o microfone fica ligado **apenas durante a captura**; ao terminar/cancelar/sair,
**todos os tracks param** e o indicador do SO some. Estados explícitos (off/asking/capturing/processing/
done/error/cancelled).
- **Â-LOC (DEC-367, emenda ÂNCORA 8):** com permissão de localização, **todo gasto guarda o ponto
(lat/lng + precisão + timestamp)** mesmo sem abrir "detalhes" — **sem reverse-geocoding** (sem inventar
nome). O nome só é buscado/mostrado se o usuário abrir "detalhes".

Quebrar uma é defeito mesmo que os testes passem.

---

## §4 — Baseline: o que já existe (reuse, não reconstrua)


| Área                         | Arquivo → símbolo                                                                                                                                                                                                                                   | O que já faz                                                                                                                             | GAP / o que mudar                                                                                               |
| ---------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| Caminho P2P debt (real-time) | `domain/orchestrators/p2p-orchestrators.ts` → `getInboundP2pItems`, debt/payment send; `mailbox-orchestrators.ts` → `drainMailboxIntoApp` (routes `debt`/`payment`/`connect`/`invite` → `enqueueIn` PENDING)                                        | dívida/cobrança P2P **já** chega PENDING, com peer-ping (DEC-352) e cai no notification center + home (DEC-352) + accept-first (DEC-345) | **rotear "enviar extrato"/divisão-p/-conectado por aqui** (kind `debt`), não por `statement` (G5)               |
| Caminho statement (legado)   | `mailbox-orchestrators.ts` → `storeMirroredStatement`; `features/shared/MirroredStatementsSection.tsx` ("Recebidos de outros aparelhos")                                                                                                            | extrato espelhado cai numa superfície escondida, não acionável                                                                           | **demover** para técnico/secundário; não é o lugar de ação pendente (G4/G5)                                     |
| Peer-ping (real-time)        | `data/sync/peer-ping.ts` → `pingPeerMailbox`; chamado em `flushOutbox`                                                                                                                                                                              | ao enviar, "cutuca" a sala do destinatário → app aberto dreca na hora                                                                    | **reusar** para a entrega da divisão (já dispara) (G5)                                                          |
| Notification center + home   | `domain/insights/notifications.ts`, `features/notifications/NotificationsPage.tsx`, `hooks/useNotifications.ts`, `features/dashboard/useDashboardModel.ts` (pending actions card)                                                                   | inbound P2P (debt/payment/invite) já roteado (DEC-352)                                                                                   | **incluir a divisão entregue** + garantir "aguardando aceite" e cobrança/divisão (G5/G6)                        |
| Settle hub                   | `features/shared/SharedExpensesPage.tsx` (`/shared`, Variante O, DEC-356)                                                                                                                                                                           | zonas Situação/Resolver/Pessoas/Mais; card "aguardando aceite"; sheets cobrar/pagar                                                      | card "aguardando aceite" **não abre detalhe** (F2); demover "Recebidos…" (D2)                                   |
| Linguagem caixa postal       | i18n `mailbox.*` (3042–3059), `p2p.send_statement`/`received_statements` (3277/3278), `cat_desc_connections` (1585)                                                                                                                                 | strings "caixa postal", "Recebidos de outros aparelhos"                                                                                  | **reescrever** humano (D1/D3)                                                                                   |
| QR render/scan               | `components/QrCodeDisplay.tsx`, `components/QrScanner.tsx`; `buildQrUrl` (DEC-351, G5 leva anterior)                                                                                                                                                | identidade/conexão/grupo já são URL; scanner com zoom                                                                                    | **auditar** statement/extrato/divisão/cobrança → URL; scanner roteia **qualquer** kind (G7)                     |
| Microfone (voz IA)           | `utils/speech-recognition.ts` (Web Speech), `utils/audio-recorder.ts` (`startPcmRecording` → getUserMedia + `track.stop()`), `features/assistant/useAssistant.ts` (`toggleVoice`)                                                                   | nativo usa PCM (libera tracks); **web/PWA usa Web Speech** (release opaco no iOS)                                                        | iOS: rotear para o caminho **controlável** + teardown + estados (G3)                                            |
| Localização                  | `utils/geolocation.ts` → `getCurrentCoords` (nunca bloqueia, nunca lança); `features/location/PlaceField.tsx` (autoCapture no `useEffect`); `domain/types/transaction.ts` (`latitude`/`longitude`/`placeLabel`/`placeId` já existem, não indexados) | captura coords **só** quando `PlaceField` monta — e ele está **dentro de `detailsOpen &&`** no QuickAdd                                  | capturar coords no **save** independente de "detalhes"; **sem** reverse-geocode (G8)                            |
| Mapa                         | — (não há lib; só Nominatim em `utils/places.ts` p/ reverse-geocode)                                                                                                                                                                                | nenhum mapa renderizado no detalhe                                                                                                       | **adicionar** mapa compacto (council L-MAP: estático × interativo) (G8)                                         |
| Instalação                   | `features/install/` → `InstallNudge`, `InstallOptions`, `InstallComparison`, `install-content.ts` (`COMPARISON_ROWS`)                                                                                                                               | nudge + CTAs + tabela App×PWA×Web (DEC-362)                                                                                              | nudge desmonta o sheet; tabela mostra APK p/ iOS; falta atalho no Android; "PWA" no texto; linha "updates" (G2) |
| Excluir conexão              | `data/sync/connection.ts` (lógica de disconnect); perfil da pessoa                                                                                                                                                                                  | base de disconnect existe                                                                                                                | **botão "Remover pessoa"** no perfil + confirmação + histórico preservado (G9)                                  |


---

## §5 — Change-set normalizado (por tema / prioridade)

**Tema C — Documento de Fluxos (P0 #1, destrava tudo):**

- **C1** Documento completo de fluxos de acerto (todos os caminhos + o modelo de estados). *Nenhum fluxo é
corrigido sem estar mapeado aqui.*

**Tema A — Instalação (P0, topo do pedido, bounded):**

- **A1** O aviso "Ver como" **abre** a tela de instalação (corrigir o desmonte do sheet).
- **A2** iOS **não mostra nada de APK** (remover a coluna App/APK no iOS — iPhone não instala APK).
- **A3** **Tabela específica iOS** (Atalho × Navegador) e **tabela específica Android** (App × Atalho ×
Navegador) — pontos próprios de cada plataforma, não a mesma tabela pros dois.
- **A4** Remover a linha **"Atualização automática"** da comparação **para todos**.
- **A5** Android: **sempre** oferecer o "atalho" (instalar via navegador) como fallback — botão se
disponível, senão instruções claras: *"se o app não deu certo, instale o atalho — o que importa é ter o
app instalado."*
- **A6** Tirar a palavra **"PWA"** de toda a interface (Atalho na tela inicial / App / Navegador).

**Tema B — Privacidade do microfone (P0):**

- **B1** Garantir que o microfone é liberado após a Entrada por IA (indicador some no iPhone **e** Android);
estados explícitos; parar tracks no fim/cancelar/desmontar.

**Tema D — Linguagem humana (P0):**

- **D1** Remover "caixa postal" de toda a interface comum → "Enviar para {nome}", "{nome} recebeu",
"Aguardando {nome} aceitar", "{nome} aceitou/rejeitou".
- **D2** "Recebidos de outros aparelhos" **deixa de ser o lugar principal** de ação pendente (técnico/
secundário ou dobrado no fluxo real).
- **D3** Trocar strings técnicas (Atualizar dados / Ver respostas / Aguardando sincronizar / Nenhum dado
usável encontrado) por texto humano.

**Tema E — Entrega automática para pessoa conectada (P0, headline):**

- **E1** Divisão/cobrança/extrato para pessoa **conectada** é entregue **automaticamente** no app dela como
dívida compartilhada (sem link manual); link/QR/WhatsApp é fallback para quem **não** tem o app.
- **E2** A entrega chega de forma confiável: notificação + card na tela inicial + item em Acerto de Contas +
item no perfil da pessoa + central de notificações — em tempo real (peer-ping) com fallback confiável.
- **E3** Os dois lados atualizam ao aceitar/rejeitar (criador vê aceita/rejeitada; a dívida entra no saldo
dos dois ao aceitar).

**Tema F — Ações pendentes acionáveis (P0):**

- **F1** Toda ação pendente aparece em: tela inicial, central de notificações, Acerto de Contas, perfil da
pessoa, "Resolver Agora".
- **F2** O card **"Aguardando aceite" abre uma lista de detalhe** (pessoa, gasto, valor, data, status, canal,
ação).
- **F3** Toda cobrança/divisão recebida tem **tela de detalhe própria** (quem, o quê, total, sua parte, data,
observação, comprovante, aceitar/rejeitar/pagar/marcar pago/histórico/status).
- **F4** Diferenciar **aceitar divisão × registrar pagamento × confirmar recebimento × pagamento manual**
(deixar claro o que se está fazendo; pagamento manual ≠ liquidar automaticamente uma cobrança específica).

**Tema G — QR (P0):**

- **G1** **Todo** QR do app é uma **URL** válida (extrato, divisão, convite, conexão, grupo, cobrança) — a
câmera padrão abre um link útil.
- **G2** O **scanner do app lê qualquer QR do app** (conexão, extrato, divisão, grupo, convite, cobrança).

**Tema H — Localização & mapa (P1):**

- **H1** Salvar localização (lat/lng + precisão + timestamp) em **todo** gasto com permissão, **mesmo sem
abrir "detalhes"** — **sem** reverse-geocoding (sem inventar nome).
- **H2** Mostrar **mapa compacto** (retângulo + pin) no detalhe do gasto; tocar → mapa maior; nome
acima/abaixo se houver, senão "Local aproximado do gasto".

**Tema I — Pessoas & identidade (P1):**

- **I1** **Excluir/remover** pessoa conectada (com confirmação; histórico preservado).
- **I2** Mostrar o **nome real** (onboarding), nunca "Android Chrome" — verificar cobertura do
`resolveSelfShareName` em todas as superfícies P2P/connect.
- **I3** Remover o card **"Como funciona a divisão?"** da área de Divisão em Grupo em Acerto de Contas
(manter em outros lugares).

**Tema J — Modelo de estados (P1):**

- **J1** Definir + aplicar todos os estados de divisão/cobrança/pagamento (modelo de 15 estados) com, por
estado: {o que o criador vê / o que o recebedor vê / onde aparece / ações disponíveis / notificação}.

---

## §6 — Mapa de causa-raiz (sintoma → código exato → direção → gate)


| #        | Sintoma (Julio)                                                                          | Causa-raiz (arquivo → símbolo)                                                                                                                                                        | Direção do conserto                                                                                                                                                                                     | Gate  |
| -------- | ---------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----- |
| A1       | "Clico no aviso, ele some e não leva a lugar nenhum"                                     | `InstallNudge.tsx`: clique faz `setSheetOpen(true); setVisible(false)`, mas `if (!visible) return null` está **acima** do `<InstallSheet/>` → o sheet é desmontado junto              | Renderizar o `<InstallSheet/>` **fora** do gate `visible` (banner condicional, sheet sempre montado)                                                                                                    | G2    |
| A2       | "No iPhone aparece coisa de APK"                                                         | `InstallComparison.tsx`: `COLUMNS=['app','pwa','web']` sempre; mostra a coluna **App(APK)** mesmo no iOS                                                                              | Tabela **por plataforma**: iOS = sem coluna App                                                                                                                                                         | G2    |
| A3       | "Mesma tabela pros dois"                                                                 | `install-content.ts` `COMPARISON_ROWS` + `InstallComparison` audience-agnóstico                                                                                                       | Conjuntos de linhas/colunas por audiência (iOS × Android)                                                                                                                                               | G2    |
| A4       | "Tirar a linha de Atualização automática"                                                | `COMPARISON_ROWS` tem `{ id:'updates', ... }`                                                                                                                                         | Remover a linha `updates` (todas as plataformas)                                                                                                                                                        | G2    |
| A5       | "APK não deu certo e não tem botão pra instalar o atalho"                                | `InstallOptions.tsx`: quando `apkPrimary` e `!available`, o ramo `(!apkPrimary && hint)` é falso → **nada**                                                                           | Android: **sempre** oferecer o atalho (botão se `available`, senão instruções "Adicionar à tela inicial") + cópia "se o app não deu certo, instale o atalho"                                            | G2    |
| A6       | "Não chamar de PWA"                                                                      | i18n `install.col_pwa`="Atalho (PWA)", etc.                                                                                                                                           | Reescrever sem "PWA" (Atalho na tela inicial / App / Navegador) em pt/en/es                                                                                                                             | G2    |
| B1       | "Indicador do microfone continua aceso no iPhone"                                        | `useAssistant.ts` `toggleVoice`: web/PWA usa `startVoiceCapture` (Web Speech); release de mic **opaco** no iOS — `recognition.stop()` não derruba o indicador; sem `abort()`/teardown | Rotear iOS para o caminho **controlável** (`startPcmRecording` → `track.stop()`) **ou** endurecer `speech-recognition.ts` (abort + nulificar handlers); estados explícitos; parar no end/cancel/unmount | G3    |
| D1/D3    | "Caixa postal / Recebidos / Aguardando sincronizar"                                      | i18n `mailbox.*` (3042–3059), `p2p.*` (3277/3278), `cat_desc_connections` (1585)                                                                                                      | Reescrever humano (sem mecanismo) em pt/en/es                                                                                                                                                           | G4    |
| D2       | "Apareceu escondido em 'Recebidos de outros aparelhos', tudo quitado, com ação pendente" | `MirroredStatementsSection.tsx` é a superfície de `storeMirroredStatement`; ação pendente cai aqui em vez do `debt`/notif                                                             | Demover para técnico/secundário; ação pendente vai pelo caminho `debt` (G5)                                                                                                                             | G4/G5 |
| E1/E2/E3 | "Pessoa conectada não recebe a divisão; tive que mandar link; apareceu só em recebidos"  | "enviar extrato"/divisão-p/-conectado usa `kind:'statement'` → `storeMirroredStatement` (não aciona notif/acerto/perfil); o caminho `debt` (DEC-345/346/352) **já** faz tudo isso     | Para **pessoa conectada**, criar/enviar uma **dívida `debt`** (accept-first, peer-ping) em vez de statement; link só p/ não-conectado                                                                   | G5    |
| F1       | "Não aparece em acerto/resolver/perfil; só em recebidos"                                 | inbound só vira toast + mirrored-statement; o `getInboundP2pItems` cobre debt/payment, não a divisão-statement                                                                        | Roteado pelo `debt`, já cai em home/notif/acerto (DEC-352); verificar perfil da pessoa                                                                                                                  | G5/G6 |
| F2       | "Card 'aguardando aceite' não abre nada"                                                 | `SharedExpensesPage.tsx`: o card é resumo sem `onClick`/rota de detalhe                                                                                                               | Card abre lista de detalhe (itens pendentes com pessoa/gasto/valor/status/canal/ação)                                                                                                                   | G6    |
| F3       | "Não ficou claro onde abrir a cobrança / o que é"                                        | inbound debt/charge não tem tela de detalhe dedicada                                                                                                                                  | Tela de detalhe por cobrança/divisão (campos do §J + ações)                                                                                                                                             | G6    |
| F4       | "Registrar pagamento não anulou a cobrança; ficou confuso"                               | pagamento manual e liquidação de cobrança específica se misturam                                                                                                                      | Separar: dentro da cobrança = liquida aquela; fora = movimentação manual (com sugestão de abater, confirmando)                                                                                          | G6    |
| G1       | "QR de extrato: 'nenhum dado usável encontrado'"                                         | `buildQrUrl` (DEC-351) cobriu identidade/conexão/grupo; extrato/divisão/cobrança ainda crus                                                                                           | Rotear **todo** QR por `buildQrUrl`; auditar `QrCodeDisplay` call-sites                                                                                                                                 | G7    |
| G2       | "O leitor só serve pra conectar; não lê extrato/divisão"                                 | `QrScanner.tsx` roteia só o payload de identidade                                                                                                                                     | Scanner parseia a URL e roteia **qualquer** kind do app (ou "abra no app")                                                                                                                              | G7    |
| H1       | "Se não abro detalhes, não salva o local"                                                | `QuickAddPage.tsx` (956): `PlaceField` (autoCapture, `useEffect` de captura) está **dentro de `detailsOpen &&`** → nunca monta se detalhes fechado                                    | Capturar coords no **save** (best-effort, `getCurrentCoords`) e gravar `latitude/longitude` (+precisão/timestamp) sem reverse-geocode; nome só se "detalhes" aberto                                     | G8    |
| H2       | "Quero ver o mapa de onde eu estava"                                                     | `ExpenseDetailPage.tsx` usa `PlaceField` (texto); não há lib de mapa                                                                                                                  | Mapa compacto (council L-MAP) quando há coords; tocar → maior; "Local aproximado" se só coords                                                                                                          | G8    |
| I1       | "Preciso excluir pessoas conectadas"                                                     | `data/sync/connection.ts` tem disconnect; perfil da pessoa não expõe                                                                                                                  | Botão "Remover pessoa/conexão" + confirmação (histórico preservado)                                                                                                                                     | G9    |
| I2       | "Apareceu como 'Android Chrome'"                                                         | DEC-350/`resolveSelfShareName` já existe; cobertura a verificar (o teste de campo pode ser anterior a G4 da leva passada)                                                             | Auditar todos os `fromName`/display P2P/connect → `resolveSelfShareName`; testar                                                                                                                        | G9    |
| I3       | "Tira o card 'Como funciona a divisão?' da Divisão em Grupo no Acerto"                   | card de explicação montado nessa área                                                                                                                                                 | Remover dessa área (manter em outras)                                                                                                                                                                   | G9    |


> **Releia o arquivo §6 antes de editar — símbolos se movem (esta leva edita arquivos que a leva anterior
> reescreveu há dias).**

---

## §7 — Decisões + councils inline

> *Julio pediu explicitamente "ver com o conselho a melhor forma de fazer" (instalação, localização) e a
> tarefa-mãe é repensar todo o fluxo. Os **forks/decisões arquiteturais** levam council inline completo
> (brief neutro → vozes cegas → red team → cadeira → `DEC`); os **bugs claros** levam veredito de uma linha.
> Tudo inline, esta sessão, 1 request, sem subagents.*

### Decisões diretas (bugs claros — veredito em uma linha)

- **A1 nudge desmonta o sheet** — *Veredito (Architect+Critic):* o `return null` em `!visible` mata o
`<InstallSheet/>`; renderizar o sheet fora do gate. Bug puro. **Diretiva.**
- **A4 remover linha "updates"** — *Veredito:* dado de matriz; remover a linha. **Diretiva.**
- **D1/D3 linguagem humana** — *Veredito (Advocate):* "o usuário não quer saber de mecanismo"; reescrever
i18n. **Diretiva.**
- **F2 "aguardando aceite" clicável** — *Veredito:* todo card-resumo leva a detalhe real. **Diretiva.**
- **I3 remover card "como funciona" do grupo no acerto** — *Veredito:* ruído onde não precisa; remover dessa
área. **Diretiva.**

### Council C1 → DEC-364 — Instalação: tabelas por plataforma, iOS sem APK, Android sempre-oferece-atalho

**Brief.** O fluxo unificado (DEC-362, `1.4.11-rc`) tem 4 defeitos de campo: (a) o nudge some sem abrir nada
(bug A1); (b) o iOS vê a coluna/menções de **APK** (iPhone não instala APK); (c) **uma só tabela** pros dois
SOs; (d) no Android, quando o prompt de PWA não está disponível, **não há** caminho de atalho. Julio: "iOS
nada de APK; tabela específica de cada um; sempre dar o botão pra instalar o atalho; não chamar de PWA; o
que importa é o user ter o app instalado." Bias a resistir: "a tabela já existe, só troca verdict."
Opções: **(a)** conteúdo **por audiência** (iOS: Atalho×Navegador; Android: App×Atalho×Navegador) + Android
sempre-oferece-atalho + remover "PWA"/linha updates + corrigir o nudge; **(b)** manter uma tabela e só
ocultar células no iOS; **(c)** esconder a comparação no iOS e só mostrar o infográfico do Safari.
**Architect (prior: menos código, robustez).** (a) é uma generalização limpa do `install-content.ts`
(linhas/colunas derivadas da audiência) + um conserto pontual no `InstallOptions`/`InstallNudge`. (b) deixa
a estrutura "uma tabela" frágil (fácil voltar a vazar APK pro iOS). (c) perde a comparação útil
Atalho×Navegador que o iOS também precisa. Rec: **(a)**. Confiança: Alta. *Outros perdem:* a coluna/linha
deve sumir do **dado** (não via CSS), pra nunca regredir silenciosamente.
**Advocate (prior: o usuário leigo).** O iPhone que vê "APK" fica confuso ("não instala isso"); o Android
que não acha como instalar o atalho **desiste de ter o app** — exatamente a dor de Julio. (a) entrega "no
seu iPhone: 2 passos no Safari" e "no Android: baixe o app; se não der, instale o atalho com 1 toque". Rec:
(a) + cópia de fallback explícita. Confiança: Alta. *Outros perdem:* "o que importa é ter o app" → o atalho
nunca pode ficar sem porta.
**Critic (prior: regressão/abuso).** Risco: quebrar o caminho que já funciona (APK no Android). Mitigação:
mudança é aditiva (audiência decide linhas/colunas; o CTA do APK no Android fica). Risco: "atalho" sem
`beforeinstallprompt` → instruções claras (Chrome/Edge → Adicionar à tela inicial), não um botão morto.
Rec: (a). Confiança: Alta.
**Red team (matar (a)).** "Duas tabelas é mais manutenção." Contra: é **uma** estrutura de dados parametrizada
por audiência, menos frágil que ocultar células; e os pontos de iOS e Android **são** diferentes (APK só
existe no Android), então a divergência é real, não acidental. Aceitar.
**Chair.** **(a) vence.** **DEC-364:** `install-content.ts` passa a derivar **linhas+colunas por audiência**
(iOS: Atalho×Navegador, sem APK e sem linha "updates"; Android: App×Atalho×Navegador, sem "updates");
`InstallOptions` no Android **sempre** mostra o atalho (botão se `available`, senão instruções) com cópia
"se o app não deu certo, instale o atalho"; `InstallNudge` renderiza o sheet fora do gate `visible`; i18n
sem "PWA" (Atalho na tela inicial / App / Navegador) pt/en/es. **O que fliparia:** se o iOS ganhar um shell
nativo no futuro, reintroduzir a coluna App no iOS.

### Council C2 → DEC-365 — Microfone: ciclo de vida controlável + estados (release garantido)

**Brief.** Na Entrada por IA, no **iPhone (web/PWA)**, o indicador de microfone **continua aceso** após o
uso — sensação de "estão me gravando". Causa: `toggleVoice` usa a **Web Speech API** no web/PWA, cujo
gerenciamento de microfone é **opaco** no iOS (o `recognition.stop()` finaliza o resultado mas o indicador
do SO persiste; não há `abort()`/teardown). O caminho nativo já usa `startPcmRecording` (getUserMedia) que
faz `stream.getTracks().forEach(t=>t.stop())` — release **determinístico**. Julio quer estados explícitos
(off/asking/capturing/processing/done/error/cancelled) e o indicador sumindo. Opções: **(a)** endurecer só
o Web Speech (abort + nulificar handlers + soltar ref); **(b)** **rotear o iOS** (e qualquer web onde o
indicador persista) para o caminho **controlável** getUserMedia/PCM (release determinístico) — Web Speech
fica como conveniência onde funciona; **(c)** sempre getUserMedia (abandonar Web Speech no web).
**Architect.** A Web Speech não expõe o `MediaStream` → não dá pra **garantir** o release; só dá pra pedir
educadamente (`abort()`), que no iOS historicamente não derruba o indicador na hora. (b) reusa
`startPcmRecording` (já testado, já libera tracks) e mantém Web Speech onde é confiável (Android Chrome). (c)
perde a transcrição on-device grátis onde ela funciona. Rec: **(b)** (iOS → PCM/Whisper; demais → Web Speech
endurecido com teardown). Confiança: Alta. *Outros perdem:* exponha uma **máquina de estados** na hook pra a
UI refletir asking/capturing/processing e o cancel/unmount **sempre** chamar o stop.
**Advocate.** O usuário precisa **ver** "ouvindo… / processando…" e ter certeza de que parou. (b) dá o
release garantido + os estados. Rec: (b). Confiança: Alta. *Outros perdem:* no cancelar/fechar a folha,
liberar **imediatamente** (não esperar transcrição).
**Critic.** Risco: o caminho PCM/Whisper custa uma chamada de nuvem (Groq) onde antes era on-device grátis →
só roteie o iOS (onde o Web Speech falha no release), não todo mundo. Risco: `track.stop()` precisa rodar em
**todos** os caminhos de saída (end/error/cancel/unmount). Rec: (b) escopado ao iOS + teardown universal.
Confiança: Alta.
**Chair.** **DEC-365:** ciclo de vida do microfone **controlável e garantido**. No **iOS web/PWA** (e onde o
release do Web Speech não for confiável), rotear a voz para o caminho **getUserMedia/PCM** que faz
`track.stop()` determinístico; no restante, manter Web Speech mas **endurecer** o teardown (`abort()` +
nulificar `onresult/onerror/onend` + soltar a ref) e **sempre** chamar o stop em end/error/cancel/unmount.
Expor uma **máquina de estados** (off/asking/capturing/processing/done/error/cancelled) na `useAssistant`
para a UI. **O que fliparia:** se um teste de device provar que o Web Speech endurecido já derruba o
indicador no iOS, manter o Web Speech lá (menos custo de nuvem). *(→ é um soft-lock: ver §16 L-MIC.)*

### Council C3 → DEC-366 — Entrega canônica para pessoa conectada = dívida compartilhada (real-time), statement demovido **(O FORK CENTRAL)**

**Brief (neutro, ≤200 palavras).** Hoje "enviar extrato"/"dividir com pessoa conectada" envia um envelope
`kind:'statement'` → `storeMirroredStatement` → a superfície **"Recebidos de outros aparelhos"**
(`MirroredStatementsSection`): escondida, rotulada "tudo quitado", **não acionável**, e **não** alimenta
notificações/Acerto/perfil. Em paralelo, o caminho `kind:'debt'` (DEC-345/346/352, leva anterior) **já**
entrega accept-first, com **peer-ping real-time**, e roteia para **notification center + tela inicial**
(DEC-352) + accept/reject (DEC-345). Fato: para uma **pessoa conectada** (tem `peerLink` + publicKey), os
dois caminhos existem; o produto usa o **errado** para divisão/extrato. Bias a resistir: "statement já
existe, é só consertar a superfície." Pergunta: para pessoa conectada, a divisão/cobrança/extrato deve virar
uma **dívida `debt`** (accept-first, real-time) e o statement-espelhado deixar de ser o caminho principal?
Opções: **(a)** sim — conectado ⇒ `debt`; statement vira técnico/secundário (ou só "extrato informativo");
**(b)** consertar a superfície statement (torná-la acionável) e manter dois caminhos; **(c)** unificar tudo
num novo tipo (reescrita).
**Architect (prior: reuso, menos risco).** (a) **reusa** todo o aparato já testado e deployado (debt
send/drain, accept-first, peer-ping, notif center, home card, accept/reject, fund-credit) — quase nenhum
código novo; só **trocar o tipo enviado** quando o destinatário é conectado e **demover** a superfície
statement. (b) duplica responsabilidade (duas superfícies de "alguém te mandou algo") — exatamente a
confusão de campo. (c) é reescrita proibida (matemática invariante). Rec: **(a)**. Confiança: Alta. *Outros
perdem:* "enviar extrato" (informativo, sem ação) e "dividir/cobrar" (com ação) são intenções diferentes —
o extrato puramente informativo pode continuar como um envelope leve, mas **qualquer ação pendente** vai por
`debt`.
**Advocate (prior: confiança do usuário).** A expectativa é "dividi → a pessoa recebe, vê, aceita". (a)
entrega isso com o caminho que **já** chega na hora e fica visível. A pessoa conectada **nunca** deve
precisar de link manual. Rec: (a). Confiança: Alta. *Outros perdem:* o eco local imediato (o criador vê
"enviado para {nome} · aguardando aceitar") + o estado dos dois lados.
**Critic (prior: falha/honestidade).** Riscos: (1) **migração** — extratos/statements legados já recebidos
não somem (mantê-los acessíveis numa área "Recebidos" secundária/técnica, não na ação principal). (2)
**offline** — se o conectado está offline, a `debt` fica na fila + peer-ping no próximo open (honesto:
"enviado · aguardando entrega"). (3) **não-conectado** — continua link/QR (fallback). (4) não duplicar a
dívida se o usuário também mandar link. Rec: (a) + guardas de migração/dedupe + cópia honesta de estado.
Confiança: Média-Alta. *Outros perdem:* o card "aguardando aceite" (F2) e o perfil da pessoa (F1) precisam
ler a **mesma** fonte `debt` pra não divergir.
**Red team (matar (a)).** "Trocar o caminho de entrega de uma feature que envia dinheiro é arriscado perto
do que acabou de subir." Contra: **a aritmética não muda** — `debt` já é accept-first e não funde nada antes
do aceite; é uma troca de **roteamento + superfície + cópia**, atrás de testes + smoke + a gate de docs
(G1) que mapeia exatamente cada estado antes de mexer. E o caminho atual está **comprovadamente quebrado**
em campo (não chega). O risco de manter é maior que o de trocar. Aceitar, gated por G1 + L-DELIVERY.
**Chair.** **(a) vence** (reuso + diretiva do usuário + o caminho atual está quebrado dominam; o delta de
risco é roteamento, não matemática). **DEC-366 (Â-DELIVERY):** para uma **pessoa conectada**, divisão e
cobrança viram uma **dívida `debt` accept-first** entregue em **tempo real** (peer-ping) e roteada para
**notificações + tela inicial + Acerto de Contas + perfil da pessoa + central**; **link/QR/WhatsApp é
fallback** só para quem **não** tem o app. O **statement-espelhado deixa de ser o caminho principal**: vira
"extrato informativo" técnico/secundário (ou é dobrado no `debt` quando há ação). Sem mudar a aritmética;
accept-first preservado; dedupe quando link + app coexistem. **Lente de maior peso:** Architect (o reuso do
caminho `debt` já-deployado é o que torna isso seguro e barato). **Condições:** depende de **G1 (mapa de
fluxos)** e do **lock L-DELIVERY**. **O que fliparia / minoria vence:** se o mapa de G1 revelar um estado
P2P que o `debt` não modela (ex.: extrato multi-gasto sem ação), aí esse subcaso fica como "extrato
informativo" e só a parte **com ação** vira `debt`.

### Council C4 → DEC-367 — Localização: salvar coords no save, sem reverse-geocode (emenda ÂNCORA 8)

**Brief.** Hoje as coords só são capturadas quando `PlaceField` (autoCapture) monta — e ele está **dentro de
`detailsOpen &&`** no QuickAdd. Se o usuário não abre "detalhes", **nada** é salvo. Julio: "todo gasto devia
guardar o ponto no mapa, mesmo sem abrir detalhes; mas **não** pesquise o nome do local (senão erra e eu
não vejo antes de salvar) — só o ponto." `getCurrentCoords` já é best-effort (nunca bloqueia/lança) e os
campos `latitude/longitude` já existem na `Transaction`. Opções: **(a)** capturar coords no **save** do
QuickAdd (se permissão ON), gravar lat/lng (+precisão/timestamp) **sem** reverse-geocode; nome só se
"detalhes" aberto; **(b)** sempre montar o `PlaceField` (mesmo escondido) pra rodar a captura; **(c)** rodar
o reverse-geocode em background e salvar nome também.
**Advocate.** (a) é exatamente o pedido: "ponto sim, nome inventado não". (c) é o que Julio **rejeitou**
("vai falar que estou onde não estou"). (b) acopla captura à montagem de um componente de UI (frágil). Rec:
**(a)**. Confiança: Alta. *Outros perdem:* mostrar "Local aproximado" no detalhe quando só há coords.
**Architect.** (a) é uma chamada `getCurrentCoords()` no caminho de salvar (já existe o boundary), gravando
nos campos existentes + 2 campos opcionais aditivos (`locationAccuracy?`, `locationCapturedAt?`). Sem
migração. Rec: (a). Confiança: Alta. *Outros perdem:* não bloquear o save esperando o GPS — dispare e grave
quando resolver (ou capture antes de persistir com timeout curto; nunca trave).
**Critic.** Risco: privacidade — mas as coords **nunca saem do device** (ÂNCORA 8) e é gated por
`locationCaptureEnabled`. Risco: bateria/permissão — best-effort, `maximumAge` reusa fix recente. Rec: (a).
Confiança: Alta.
**Chair.** **DEC-367 (emenda ÂNCORA 8):** com `locationCaptureEnabled`, o QuickAdd **captura e grava as
coords no save** (lat/lng + `locationAccuracy?` + `locationCapturedAt?`, aditivos, não indexados) **mesmo
com "detalhes" fechado**, **sem reverse-geocoding**; o nome do local só é buscado/mostrado quando o usuário
abre "detalhes" (`PlaceField` inalterado nesse caso). Nunca bloquear o save. **O que fliparia:** nenhuma —
diretiva.  
  
Na verdade eu tenho uma ideia, nova, colocar sim o ponto com nome maius perto que tinha mesmo sem abrir o detalhes, mas deixar claro no detalhe do gasto quando é um "provavelmente" no sentido de o app captou automaticamente e o user não verificou, de quando o user realmente abriu o detalhes e escolher certo qual ele queria, ai dar certeza.. mas no mapa mesmo mostrar as coordenadas, com o nome do estabeleciomento indicando que provavelmente foi no estabelecimento desse nome..

### Council C5 → DEC-368 — Mapa no detalhe do gasto: renderização (estático × interativo)

**Brief.** Julio quer um **mapa compacto** (retângulo + pin) no detalhe do gasto, tocar → maior; "se só tem
coordenada, algo como 'Local aproximado do gasto'." Não há lib de mapa hoje (só Nominatim p/ reverse-
geocode). TripPilot é offline-first; o bundle tem orçamento (`index` < 500 KB). Opções: **(a)** **imagem de
mapa estática** (tile estático OSM/serviço) num `<img>` — zero dependência nova, leve, degrada para um
placeholder "Local aproximado" offline; tocar abre um mapa maior (modal com a mesma imagem em zoom maior, ou
um link "abrir no mapa"); **(b)** **lib interativa** (Leaflet/MapLibre) lazy-loaded — pan/zoom real, mas +dep
e +bundle; **(c)** só um link "abrir no app de mapas" (sem preview).
**Architect (prior: bundle/offline/menos dep).** (a) não adiciona dependência, não pesa o bundle (uma
`<img>` lazy), e o "tocar pra ampliar" é um modal trivial; offline mostra o placeholder honesto. (b) traz
Leaflet (+~40 KB) + tiles + estado de mapa — mais poder do que "ver onde foi" pede. (c) não atende "ver o
mapa direto". Rec: **(a)** (estático), com (b) como upgrade futuro se precisar de pan/zoom. Confiança:
Média-Alta. *Outros perdem:* escolher um provedor de tile estático com política de uso ok (ou um endpoint
próprio); cachear/lazy; nunca quebrar offline.
**Advocate.** O usuário quer **reconhecer a região num relance** — uma imagem com pin entrega isso; pan/zoom
real é "nice", não essencial. Rec: (a). Confiança: Média. *Outros perdem:* o pin + um zoom "que dá pra
entender a região" (não muito perto/longe).
**Critic (prior: dependência externa).** Risco: um tile estático depende de **rede** + um provedor (limites/
chave/atribuição). Mitigações: lazy + placeholder offline + atribuição correta; se nenhum provedor sem-chave
servir, (b) com Leaflet + OSM (atribuição) lazy-loaded vira a escolha. Rec: (a) **se** houver provedor
estático aceitável; senão (b) lazy. Confiança: Média. *Outros perdem:* decidir o provedor é o nó — por isso
é um **lock** (L-MAP).
**Chair.** **DEC-368 (recomendação, pendente L-MAP):** mapa compacto no detalhe quando há coords — preferir
**(a) imagem estática** (sem dep nova, lazy, placeholder "Local aproximado" offline), tocar → maior; fallback
(b) Leaflet+OSM lazy se nenhum provedor estático sem-chave servir. **O que fliparia:** o provedor de tiles —
**Julio decide** entre "imagem estática (provedor X)" e "Leaflet interativo lazy" no L-MAP.  
  
também vou querer no futuro ter um mapa completo, uma função mapa mesmo que mostra e agrupa todos os gastos que o usuario teve e ai posso ir dando zoom para ver os gastos especifico, ou se dou zoom out ele vai juntando os gastos proximos, enfim, é bom para ver os gastos por lugar e funciona se tiver captando a coodenada de cada gasto ou o local definido e escolhido..

### Council C6 → DEC-369 — Ações pendentes acionáveis + telas de detalhe + diferenciar aceitar/pagar/confirmar

**Brief.** O card "aguardando aceite" não abre nada; cobrança/divisão recebida não tem tela de detalhe; e
"registrar pagamento" se confunde com "liquidar a cobrança". Julio define 4 verbos distintos: **aceitar
divisão** (concordo que a dívida existe), **rejeitar**, **registrar pagamento** (informo que paguei),
**confirmar recebimento** (quem deveria receber confirma), **pagamento manual** (movimentação solta).
**Advocate.** Todo resumo leva a detalhe real (F2); toda cobrança tem tela própria com os campos e as ações
certas (F3); e a UI deixa explícito **qual** verbo (F4) — "você está pagando esta dívida" × "você está
registrando uma movimentação". Rec: telas de detalhe + rótulos por autoridade. Confiança: Alta.
**Architect.** Reusa o modelo de estados/atividade da leva anterior (DEC-353/354): o detalhe lê o `debt`/
estado; "dentro da cobrança" → ação liquida **aquela**; "fora" (registrar pagamento manual) → movimentação,
com **sugestão** de abater uma dívida compatível, **confirmando**. Sem mudar matemática. Confiança: Alta.
**Critic.** Risco: registrar pagamento manual "fingir" que liquidou uma cobrança (a dor de Julio). Guarda:
manual nunca auto-liquida; só com confirmação explícita do usuário de **qual** dívida abater. Confiança:
Alta.
**Chair.** **DEC-369:** (1) o card "aguardando aceite" abre uma **lista de detalhe**; (2) toda cobrança/
divisão recebida tem **tela de detalhe** (quem/o quê/total/sua parte/data/obs/comprovante/status + ações);
(3) **separar** aceitar × rejeitar × registrar pagamento × confirmar recebimento × pagamento manual —
manual **nunca** auto-liquida uma cobrança específica sem confirmação. Reusa DEC-353/354; matemática
inalterada. **O que fliparia:** nenhuma — modelo de justiça do usuário.

### Decisões diretas adicionais

- **DEC-370 — Excluir pessoa conectada (I1):** botão "Remover pessoa/conexão" no perfil + confirmação
("divisões antigas continuam no histórico; ela não aparece mais como contato ativo"); hide-never-delete
(tombstone do `peerLink`, histórico preservado). **Diretiva.**
- **DEC-371 — Modelo de estados (J1):** os 15 estados da divisão/cobrança (rascunho · criada · enviando ·
enviada · recebida · aguardando aceite · aceita · rejeitada · aguardando pagamento · marcada como paga ·
aguardando confirmação · confirmada · cancelada · erro de envio · expirada), cada um com {criador vê /
recebedor vê / onde aparece / ações / notificação}. Estende o enum de pagamento (DEC-353) de forma aditiva;
é metadado sobre o mesmo debt engine. **Diretiva (especificado no doc de fluxos, G1).**
- **DEC-372 — Varredura de linguagem (Â-LANG):** remover "caixa postal"/"Recebidos de outros aparelhos"/
"Atualizar dados"/"Ver respostas"/"Aguardando sincronizar"/"Nenhum dado usável encontrado" da interface
comum, em pt/en/es. **Diretiva.**
- **DEC-373 — QR-as-URL completo + scanner universal (Â-QR):** todo QR via `buildQrUrl`; o scanner parseia a
URL e roteia qualquer kind. Estende DEC-351. **Diretiva.**

---

## §8 — Estratégia de testes (teste JUNTO com a mudança)

- **Domínio puro primeiro (>90%):**
  - **Entrega P2P (G5):** o roteamento "conectado ⇒ `debt`" (puro): dado um destinatário com `peerLink`,
  a função escolhe `debt` (não `statement`); accept-first preservado; dedupe link+app; **aritmética do
  acerto idêntica ao baseline** (a dívida só funde no aceite — invariância).
  - **Estados (G6, DEC-371):** a máquina de 15 estados (transições válidas; marcada-como-paga nunca
  renderiza "deve"; manual não auto-liquida).
  - **Instalação (G2):** `installAudience` × linhas/colunas por audiência (iOS sem App e sem "updates";
  Android com App); `columnRecommendation`; Android sempre-oferece-atalho.
  - **Microfone (G3):** a máquina de estados; o stop libera tracks (mock de `getTracks().stop`); cancel/
  unmount chamam stop.
  - **Localização (G8):** capturar-no-save grava lat/lng (+precisão/timestamp) sem reverse-geocode; nunca
  bloqueia (mock de `getCurrentCoords` resolvendo null/valor).
  - **QR (G7):** `buildQrUrl` round-trip para cada kind (extrato/divisão/cobrança/convite/conexão/grupo); o
  parser do scanner roteia cada kind.
- **Reuse & estenda** as suítes existentes: `p2p-orchestrators`, `mailbox-orchestrators`, `payment-payload`,
`statement-payload`, `qr-scanner-zoom`, `install-content`/`install-nudge`, `geolocation` — **não duplique**.
- **UI crítica via E2E (>70%):** divisão-para-conectado aparece em notif+home+acerto sem recarregar;
"aguardando aceite" abre detalhe; instalação (nudge abre o sheet; iOS sem APK); local salvo sem abrir
detalhes; mapa no detalhe.
- **Invariância da matemática do acerto:** todo total/saldo/transfer == baseline para as mesmas entradas.
- **"Suíte verde entre gates"** = 0 falhas **além do baseline G0** (os 2 casos WebCrypto `split-live-loop`
que só passam no Node 22/CI — registre em G0).

---

## §9 — Protocolo por milestone

**Antes de cada commit (5 pontos):** (1) liste os ACs satisfeitos; (2) nomeie 3 ACs anteriores em risco de
regressão + verifique (**sempre** inclua **invariância da matemática**, **nunca bloquear gasto/entrega**,
**DEC-207 ciphertext**); (3) rode os testes — sem novas falhas; (4) sinalize arquivo tocado fora do escopo;
(5) atualize `src/dev-log.md`. **Fronteira de gate:** releia §3 + o escopo da próxima gate + o Current State
do dev-log; imprima ANCHOR + CURRENT STATE; **se o lock §16 da próxima gate estiver aberto, PARE e faça
hand-off**. **A cada 3 milestones:** refresh leve (regras críticas + dev-log).

---

## §10 — THE BUILD — gates G0→G9

### G0 — Setup & baseline (sempre) → sem mudança de versão

- **Por quê:** referência de regressão + log semeado.
- **Faça:** `npm install`; `npm run test` + `npm run build` + `npx tsc --noEmit` (+ E2E se o ambiente
permitir); **registre os counts baseline** (incl. `split-live-loop`); semeie `src/dev-log.md` (Current
State + a tabela C/A/B/D/E/F/G/H/I/J desta leva); adicione **DEC-364…373** como `PROPOSED`; confirme o
pipeline Pages (Worker já deployado — peer-ping reusa `ShareSignal`; só `wrangler deploy` se uma rota
mudar). Imprima o estado dos locks §16.
- **AC:** baseline verde documentado; dev-log semeado; DECs registradas.

### G1 — Documento de Fluxos + modelo de estados (P0 #1, destrava as gates de acerto) → `1.4.13-rc` *(sem lock — começe já)*

- **Itens:** C1, J1 (spec). **Causa-raiz:** a tarefa-mãe do briefing.
- **Mudança:** **(m1)** produzir `brain/documents/2026-06-27-settle-flows-map.md` mapeando **todos** os
caminhos (ver a estrutura obrigatória abaixo). **(m2)** os **tipos puros** do modelo de 15 estados
(`domain/...` aditivo) + testes — sem aplicar na UI ainda (a aplicação é G6).
- **Estrutura obrigatória do doc de fluxos (cada caminho):** quem cria · quem recebe · entidade criada · onde
aparece · status inicial · ação que o usuário precisa tomar · onde a ação aparece · o que acontece ao
aceitar/rejeitar/pagar/confirmar recebimento · como os dois lados sincronizam · quais notificações ·
quais cards na tela inicial · o que aparece em Acerto de Contas · dentro da pessoa · na central · no link
público · se a pessoa **não** tem app · se **tem** app. **Cobrir os 7 fluxos** do briefing: A (divisão c/
conectado), B (divisão s/ app), C (cobrança manual), D (pagamento de dívida específica), E (pagamento
manual), F (enviar extrato), G (QR de extrato/divisão) + o **modelo de 15 estados** (DEC-371).
- **AC:** o doc existe e cobre os 7 fluxos + os 15 estados, com a matriz por caminho; os tipos puros de
estado compilam + têm testes. **Nenhuma gate de acerto (G4–G7) executa sem citar este doc.**
- **Deploy:** Pages → `1.4.13-rc` (só os tipos puros; doc não muda runtime) → dev-log.

### G2 — Instalação (P0, bounded, urgente) → `1.4.14-rc` *(sem lock — diretivas + DEC-364)*

- **Itens:** A1–A6. **Causa-raiz:** §6 A1–A6. **DEC-364.**
- **Mudança:** `InstallNudge` renderiza o `<InstallSheet/>` fora do gate `visible`; `install-content.ts`
deriva **linhas+colunas por audiência** (iOS: Atalho×Navegador, sem App, sem "updates"; Android:
App×Atalho×Navegador, sem "updates"); `InstallComparison` usa a audiência; `InstallOptions` no Android
**sempre** oferece o atalho (botão se `available`, senão instruções) + cópia de fallback; i18n sem "PWA"
(pt/en/es).
- **AC:** tocar no aviso **abre** a tela; iOS **não** mostra nada de APK; tabelas distintas por SO; a linha
"Atualização automática" sumiu; no Android sempre há um caminho de atalho; a palavra "PWA" não aparece.
- **Testes:** `install-content` (audiência → linhas/colunas; sem App no iOS; sem "updates"); nudge-abre-sheet
E2E; iOS-sem-APK E2E.
- **Deploy:** Pages → `1.4.14-rc` → DEC-364 APPROVED.

### G3 — Microfone (P0) → `1.4.15-rc` *(⏳ L-MIC — soft-lock, ver §16)*

- **Itens:** B1. **Causa-raiz:** §6 B1. **DEC-365.**
- **Mudança:** rotear a voz no **iOS web/PWA** para `startPcmRecording` (release determinístico via
`track.stop()`); endurecer `speech-recognition.ts` (abort + nulificar handlers + soltar ref) onde Web
Speech seguir; expor a **máquina de estados** (off/asking/capturing/processing/done/error/cancelled) na
`useAssistant`; **sempre** chamar stop em end/error/cancel/unmount.
- **AC:** após usar o microfone, o indicador do iPhone (e Android) **some**; a UI mostra os estados; cancelar/
fechar libera na hora.
- **Testes:** máquina de estados; stop libera tracks; cancel/unmount chamam stop. **Smoke de device** (iOS
Safari/PWA) — o critério de aceite real é o indicador sumir no aparelho.
- **Deploy:** Pages → `1.4.15-rc` → DEC-365 APPROVED.

### G4 — Linguagem humana + demover "Recebidos de outros aparelhos" (P0) → `1.4.16-rc` *(sem lock — DEC-372)*

- **Itens:** D1, D2, D3, I3. **Causa-raiz:** §6 D1/D2/D3 + I3. **Depende de G1.**
- **Mudança:** reescrever i18n `mailbox.*`/`p2p.*`/`cat_desc_connections` e as strings técnicas para texto
humano (pt/en/es); **demover** `MirroredStatementsSection` ("Recebidos de outros aparelhos") para
técnico/secundário (não é o lugar de ação pendente); remover o card "Como funciona a divisão?" da Divisão
em Grupo no Acerto.
- **AC:** "caixa postal" e as strings técnicas somem da interface comum; "Recebidos…" não é mais o lugar
primário de ação; o card "como funciona" saiu daquela área (segue em outras).
- **Testes:** i18n parity pt/en/es; sem-ocorrência de "caixa postal" nas chaves comuns (teste de varredura).
- **Deploy:** Pages → `1.4.16-rc` → DEC-372 APPROVED.

### G5 — Entrega automática para pessoa conectada (P0, HEADLINE) → `1.5.0-rc` *(⏳ L-DELIVERY LOCK — ver §16)*

- **Itens:** E1, E2, E3, D2 (fechamento). **Causa-raiz:** §6 E1/E2/E3. **DEC-366. Depende de G1 + lock.**
- **Mudança:** **(m1)** roteamento puro: destinatário **conectado** ⇒ criar/enviar uma **dívida `debt`**
(accept-first) em vez de `statement`; **(m2)** o envio dispara o **peer-ping** (já existe em `flushOutbox`)
e cai em notif center + home (DEC-352) + accept/reject (DEC-345); **(m3)** o **perfil da pessoa** + Acerto
de Contas lêem a mesma fonte `debt`; **(m4)** **eco local** no criador ("enviado para {nome} · aguardando
aceitar") + estado dos dois lados; **(m5)** link/QR só para **não-conectado** (fallback); dedupe link+app;
guarda de migração para statements legados (acessíveis no "Recebidos" secundário, não na ação).
- **AC:** dividir com pessoa conectada **não** exige link; a divisão chega no app dela (notif + home + acerto
  - perfil + central) **sem recarregar**; aceitar/rejeitar atualiza os dois lados; a dívida entra no saldo
  dos dois ao aceitar. **Aritmética inalterada; accept-first preservado.**
- **Testes:** roteamento conectado⇒debt; entrega→superfícies; accept/reject dois-lados; dedupe; invariância
do acerto; E2E divisão-aparece-sem-reload.
- **Deploy:** Pages (Worker já deployado; só `wrangler deploy` se rota mudar) → `**1.5.0-rc`** (headline) →
DEC-366 APPROVED.

### G6 — Ações acionáveis + telas de detalhe + diferenciar verbos + aplicar estados (P0) → `1.5.1-rc` *(sem lock — DEC-369/371)*

- **Itens:** F1, F2, F3, F4, J1 (aplicação). **Causa-raiz:** §6 F1–F4. **Depende de G1/G5.**
- **Mudança:** card "aguardando aceite" abre **lista de detalhe**; **tela de detalhe** por cobrança/divisão
(campos + ações por estado); **separar** aceitar × rejeitar × registrar pagamento × confirmar recebimento
× pagamento manual (manual nunca auto-liquida sem confirmação); aplicar a máquina de 15 estados (DEC-371)
no display (marcada-paga nunca "deve").
- **AC:** todo resumo leva a detalhe; toda cobrança recebida tem tela; os 4 verbos são distintos e claros;
pagamento manual não finge liquidar uma cobrança específica.
- **Testes:** estados→display; detalhe abre da lista/card; manual-não-auto-liquida; invariância.
- **Deploy:** Pages → `1.5.1-rc` → DEC-369/371 APPROVED.

### G7 — Todo QR = URL + scanner universal (P0) → `1.5.2-rc` *(sem lock — DEC-373)*

- **Itens:** G1, G2 (tema G). **Causa-raiz:** §6 G1/G2. **Depende de G1 doc.**
- **Mudança:** auditar todo `QrCodeDisplay` call-site → `buildQrUrl(kind, payload)` (extrato/divisão/
cobrança/convite/conexão/grupo); o `QrScanner` parseia a URL e **roteia qualquer kind** (ou "abra no app e
escaneie de novo" quando inevitável).
- **AC:** escanear qualquer QR do app com a **câmera padrão** abre um link útil (nunca "nenhum dado usável");
o scanner do app entende todos os kinds.
- **Testes:** `buildQrUrl` round-trip por kind; parser do scanner por kind.
- **Deploy:** Pages → `1.5.2-rc` → DEC-373 APPROVED.

### G8 — Localização no save + mapa no detalhe (P1) → `1.5.3-rc` *(⏳ L-MAP LOCK — ver §16)*

- **Itens:** H1, H2. **Causa-raiz:** §6 H1/H2. **DEC-367/368. H2 depende do lock L-MAP.**
- **Mudança:** **(m1, H1, sem lock)** capturar coords no **save** do QuickAdd (best-effort), gravar
lat/lng (+ `locationAccuracy?`/`locationCapturedAt?` aditivos) **sem reverse-geocode**, mesmo com detalhes
fechado; nunca bloquear. **(m2, H2, atrás de L-MAP)** mapa compacto no detalhe quando há coords (estático
ou Leaflet lazy, conforme o lock), tocar → maior, "Local aproximado" se só coords.
- **AC:** todo gasto com permissão guarda o ponto mesmo sem abrir detalhes; o detalhe mostra um mapa com pin
(ou placeholder honesto offline).
- **Testes:** captura-no-save (mock coords); sem reverse-geocode no caminho fechado; render do mapa com/sem
coords.
- **Deploy:** Pages → `1.5.3-rc` → DEC-367/368 APPROVED.

### G9 — Excluir pessoas conectadas + nome real (P1) → `1.5.4-rc` *(sem lock — DEC-370)*

- **Itens:** I1, I2. **Causa-raiz:** §6 I1/I2. **DEC-370.**
- **Mudança:** botão "Remover pessoa/conexão" no perfil + confirmação (histórico preservado, tombstone do
`peerLink`); auditar todos os `fromName`/display P2P/connect → `resolveSelfShareName` (nome do onboarding),
nunca "Android Chrome".
- **AC:** dá pra remover uma pessoa conectada (com confirmação; divisões antigas seguem no histórico); o nome
real aparece em todas as superfícies, nunca "Android Chrome".
- **Testes:** remove-conexão (tombstone, histórico preservado); `resolveSelfShareName` em cada call-site.
- **Deploy:** Pages → `1.5.4-rc` → DEC-370 APPROVED. **Revisão da DoD da leva.**

> **G_last (P2, opcional):** polir visual de telas de detalhe/cards/filtros/relatórios (Prioridade 2 do
> briefing) — só com folga; senão registrar deferido no dev-log.

---

## §11 — Segurança do terminal (WSL)

`git --no-pager …` para log/diff/show/status. Commit via `G=/usr/bin/git; "$G" commit -m "…"` (o harness
injeta `--trailer`, rejeitado pelo git 2.25.1 do sandbox). HEREDOC para multi-linha. Nunca
`less/more/man/vim/nano/-i/rebase -i`; pipe CLIs incertos para `| cat`. Travou >30s sem saída → leia o
arquivo do terminal, ache o pid, mate; não re-rode.

---

## §12 — Definition of Done (tudo TRUE)

- [ ] **G1** doc de fluxos cobre os 7 fluxos + 15 estados; nenhuma gate de acerto mexeu sem citá-lo.
- [ ] **Instalação:** o aviso abre a tela; iOS sem APK; tabelas distintas por SO; sem linha "Atualização
  ```
  automática"; Android sempre com caminho de atalho; sem a palavra "PWA".
  ```
- [ ] **Microfone:** o indicador some após o uso (iOS + Android); estados visíveis; cancel/unmount libera.
- [ ] **Linguagem:** "caixa postal" e as strings técnicas sumiram da interface comum; "Recebidos de outros
  ```
  aparelhos" não é mais o lugar primário de ação.
  ```
- [ ] **Entrega P2P (headline):** dividir/cobrar com pessoa **conectada** chega no app dela em tempo real
  ```
  (notif + home + acerto + perfil + central) **sem link manual e sem recarregar**; aceitar/rejeitar
  atualiza os dois lados.
  ```
- [ ] **Ações:** "aguardando aceite" abre detalhe; toda cobrança recebida tem tela; aceitar/pagar/confirmar/
  ```
  pagamento-manual são distintos (manual não auto-liquida).
  ```
- [ ] **QR:** todo QR é URL (câmera padrão abre link útil); o scanner do app lê qualquer QR do app.
- [ ] **Localização:** todo gasto com permissão guarda o ponto sem abrir detalhes; o detalhe mostra um mapa.
- [ ] **Pessoas:** dá pra remover uma pessoa conectada (histórico preservado); nome real, nunca "Android
  ```
  Chrome".
  ```
- [ ] **Invariância da matemática** mantida; suíte **verde** vs baseline; `build` + `tsc --noEmit` limpos;
  ```
  deploys por gate feitos.
  ```
- [ ] Brain sincronizado (§14); DEC-364…373 `APPROVED`.

---

## §13 — Anti-padrões (NÃO)

- ❌ Corrigir um fluxo de acerto **sem** estar mapeado em G1. ❌ Reescrever a aritmética do acerto.
- ❌ Manter "caixa postal"/"Recebidos de outros aparelhos" como caminho principal de ação (DEC-366/372).
- ❌ Exigir link manual para uma pessoa **conectada** (DEC-366). ❌ Deixar ação pendente só na superfície
escondida.
- ❌ Mostrar coluna/menção de **APK no iOS** (DEC-364). ❌ Deixar o Android sem caminho de atalho. ❌ Usar a
palavra "PWA" na UI.
- ❌ Renderizar um QR cru para a câmera padrão (DEC-373). ❌ Mostrar "Android Chrome" como pessoa (DEC-350).
- ❌ Reverse-geocode automático no caminho "detalhes fechado" (DEC-367 — Julio rejeitou inventar nome).
- ❌ Deixar o microfone aceso após o uso (DEC-365). ❌ Apagar feature (hide-never-delete) — remover pessoa é
tombstone + histórico preservado.
- ❌ Afrouxar DEC-207 (Worker só vê ciphertext p/ mensagens/dívidas/nomes/extratos).
- ❌ Codar uma gate com **lock §16 aberto** (G5/G8/G3). ❌ `git` sem `--no-pager`. ❌ Texto hardcoded / código
não-inglês.

---

## §14 — Brain sync

- `src/dev-log.md` — todo milestone (Current State + entrada; gate mais recente primeiro; preserve as levas
anteriores abaixo).
- `decision-log.md` — DEC-364…373 `PROPOSED` em G0 → `APPROVED` pela gate que entrega; nota AMENDED em
DEC-362 (install corrigido), ÂNCORA 8 (DEC-367), DEC-344/345/346/352 (entrega P2P consolidada via debt).
- `brain/documents/2026-06-27-settle-flows-map.md` — **criado em G1** (o doc de fluxos).
- `product-spec.md` — no fechamento das gates: §25 (sync/entrega P2P real-time), §28 (acerto: estados,
entrega canônica), instalação, localização.
- `project-status.md` — status/pending/next no fim da leva. `README.md` — apontar para este doc quando ACTIVE.

---

## §15 — Smoke manual (por gate)


| Jornada                                                                                         | iOS Safari/PWA | Android Chrome/PWA | Desktop |
| ----------------------------------------------------------------------------------------------- | -------------- | ------------------ | ------- |
| Aviso de instalar abre a tela; iOS sem APK; Android tem atalho                                  | ☐              | ☐                  | ☐       |
| Usar o microfone na Entrada por IA → indicador some depois                                      | ☐              | ☐                  | —       |
| Dividir com pessoa conectada → chega no app dela (notif+home+acerto+perfil) sem link/sem reload | ☐              | ☐                  | ☐       |
| "Aguardando aceite" abre detalhe; aceitar/rejeitar atualiza os dois lados                       | ☐              | ☐                  | ☐       |
| Escanear QR de extrato/divisão com a câmera padrão → abre link útil                             | ☐              | ☐                  | —       |
| Criar gasto sem abrir "detalhes" → o ponto é salvo; detalhe mostra o mapa                       | ☐              | ☐                  | ☐       |
| Remover pessoa conectada (confirmação; histórico preservado)                                    | ☐              | ☐                  | ☐       |


---

## §16 — Decisões para o usuário (LOCK)

> O doc fica **AWAITING LOCK** nos 3 forks abaixo; G1/G2/G4 podem começar já (sem lock). G3/G5/G8 dependem
> do respectivo lock.

- **L-DELIVERY (DEC-366) — G5, o fork central.** Para pessoa **conectada**, divisão/cobrança/extrato vira
uma **dívida `debt` accept-first real-time** (notif + home + acerto + perfil + central); statement-
espelhado demovido; link só p/ não-conectado. *Recomendação do conselho: **fazer (a)**.* **Decisão de Julio:** ⛳ aprovar, mas lembrando que tem que aparece nos dois celulares, e ficar no historio como foi fieto, quem mmandou a divida, de onde veio  (aprovar / ajustar / manter dois caminhos).  
  

- **L-MAP (DEC-368) — G8.** Mapa no detalhe: **(a) imagem estática** (sem dependência nova, leve, placeholder
offline) **× (b) Leaflet/OSM interativo lazy** (+dep, pan/zoom). *Recomendação: (a), com (b) de fallback se
nenhum provedor estático sem-chave servir.* **Decisão de Julio:** ⛳ b interativo e mapa real, eu poder ver tudo da cidade, me achar mesmo. (a estático / b interativo / decidir o provedor de tiles).  

- **L-MIC (DEC-365) — G3, soft-lock.** No **iOS** rotear a voz para o caminho **getUserMedia/PCM** (release
garantido) **× só endurecer o Web Speech** (menos custo de nuvem, release incerto no iOS). *Recomendação:
rotear o iOS para PCM (garante o indicador sumir).* **Decisão de Julio:** ⛳  endurecer Web Speech  vamos ver se corrige, deixar anotado para depois verificarmos(PCM no iOS / endurecer Web Speech / decidir após smoke de device).

**Tudo o mais (DEC-364 install, DEC-367 localização, DEC-369 ações/telas, DEC-370 remover pessoa, DEC-371
estados, DEC-372 linguagem, DEC-373 QR + as diretivas) está travado pela recomendação do conselho — não
re-perguntar.**

---

## §17 — GO — start here

1. **Confirme o estado:** `git --no-pager log --oneline -5`; versão em `package.json` (espere `1.4.12-rc`);
  `src/dev-log.md` Current State; confirme que as levas anteriores subiram e que os arquivos desta leva não
   existem ainda.
2. **G0:** `npm install` → `npm run test` → `npm run build` → `npx tsc --noEmit`; registre baseline; semeie
  dev-log; DEC-364…373 `PROPOSED`; imprima o estado dos locks §16.
3. **G1 → G2 → G4** podem rodar **sem lock**. **G3 (L-MIC), G5 (L-DELIVERY), G8 (L-MAP)** só com o lock IN —
  se o lock estiver aberto na fronteira da gate, **PARE e faça hand-off** (não code um fork sem lock).
4. Cada gate: releia o arquivo §6 → domínio+testes → UI+E2E → 5-pontos → commit por item → fim da gate:
  suíte+build+tsc+smoke → bump de versão → deploy → DECs APPROVED → dev-log → ANCHOR + CURRENT STATE.
5. **Não pare** até a DoD §12 toda TRUE — ou uma gate fechar limpa no fim do contexto — ou um lock aberto —
  ou um blocker duro. Aí termine com um `AskQuestion`.

**ANCHOR (cole a cada 3 milestones / cada fronteira de gate):**

> Dinheiro=centavos · domínio=TS puro · `t()` sempre (pt/en/es) · código em inglês · **sem login** (nome do
> onboarding, nunca "Android Chrome") · **invariância da matemática do acerto** · **pessoa conectada ⇒
> entrega `debt` real-time** (notif+home+acerto+perfil) · **link só p/ não-conectado** · **nada de "caixa
> postal"/"Recebidos de outros aparelhos" como caminho principal** · **todo QR = URL + scanner universal** ·
> **microfone liberado após o uso** · **local salvo no save, sem reverse-geocode** · **iOS sem APK** ·
> DEC-207 ciphertext · hide-never-delete · nunca bloquear gasto/entrega.
> **CURRENT STATE:** gate=__ · último commit=__ · testes=**/** (baseline **) · locks=** · riscos=__ · escopo=__.

