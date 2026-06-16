# Master Plan — Link Compartilhado para Participante (Convidado) — 2026-06-16

> Pedido do Julio (campo): "quero dividir algo com alguém e mandar um link; ela **não tem o app**,
> abre o link só porque mandei. Ela **não quer criar uma viagem** — só vê o que compartilhei com ela,
> o que ela me deve, o que eu devo a ela; faz parte da minha viagem **só naquela fatia**, **não vê a
> viagem toda**. Ela aprova os gastos e marca como **liquidado**. Depois, **se quiser**, pode começar a
> viagem dela também. Passe pelo conselho, pesquise muito, planeje, e coloque no masterplan."
>
> Tipo de entrega: **PLANEJAMENTO** (pesquisa + conselho + plano). **Não é build.** O build vira épica
> própria (a SEGUIR, depois da épica de notas — decisão do Julio).
> Conselho rodado **inline** (regra `tech-lead-delegation.mdc` proíbe subagents).
> Base de versão ao escrever: **0.55.1** · 1079 testes verdes.
> **Decisões do Julio TRAVADAS em 2026-06-16 (AskQuestion) — ver seção 7.**

---

## 0. Resumo executivo (1 parágrafo)

O modelo financeiro que o Julio descreveu **já existe** no TripPilot (DEC-106 owner/mirror: o dono é a
verdade, o par recebe um **extrato read-only**, confirma/rejeita e as respostas voltam para o dono). O
que **falta é o transporte**: hoje a partilha exige QR presencial ou P2P síncrono (os dois online ao
mesmo tempo) com sala **efêmera** que expira em ~10 min (DEC-107). O pedido é **assíncrono**: a pessoa
abre um link horas depois, com o dono possivelmente offline. **O Julio liberou armazenar no servidor**
("hoje não tem problema") com **duas restrições firmes: (a) custo zero / melhor custo-benefício por muito
tempo; (b) portabilidade total — nada amarrado à Cloudflare a ponto de não conseguir migrar depois**
(ele já viu um projeto ficar preso no Supabase). Ele **não quer** comunicação **em tempo real /
websocket** empurrando "te cobrei / pagou" no celular do outro — **assíncrono (pull) é o desejado**. E
ele quer **mais que um extrato**: ao abrir o link, **criar um usuário permanente sem pedir cadastro**,
com duas áreas — **"Minhas viagens"** e **"Compartilhadas comigo"** — onde o convidado pode **ver, editar
e adicionar** (quase um grupo), e depois **criar a própria viagem**. A liquidação é **proposta pelo
convidado e confirmada pelo dono** (ida-e-volta = exatamente owner/mirror DEC-106). Recomendação técnica
(grátis + portável): **API em Web Standards (Hono) + armazenamento atrás de uma interface adapter sobre
D1/R2 — NÃO Durable Object** (o único primitivo realmente preso à Cloudflare), tudo **E2E** (a chave no
`#fragment` do link, servidor só guarda ciphertext).

---

## 1. Os 2 tipos de usuário (definição precisa — atualizada com as decisões do Julio)

> Mudança-chave vs. o esboço inicial: o convidado **não** é uma sessão efêmera "só-extrato". Ao abrir o
> link, ganha um **usuário permanente, sem cadastro**, com vida própria dentro do app.

| | **Owner** (dono) | **Guest → usuário permanente** (convidado) |
|---|---|---|
| Tem o app? | Sim (PWA/APK, viagem ativa) | **Não precisa** — abre link no navegador; vira usuário do app ali mesmo |
| Como nasce | já existe | **abrir o link cria um usuário permanente** (sem formulário de cadastro) |
| Estrutura | suas viagens | **"Minhas viagens"** (próprias, 0..N) + **"Compartilhadas comigo"** (fatias recebidas) |
| Vê o quê | tudo | **só a fatia compartilhada** (gastos que o envolvem + saldo) — nunca a viagem inteira do dono |
| Pode | criar gasto, dividir, **gerar/revogar o link**, **confirmar** liquidações | **ver / editar / adicionar** na fatia (quase grupo) + **aprovar/rejeitar** (DEC-071) + marcar **"paguei"** (proposta) |
| Dinheiro | é a verdade | **propõe** mudanças/liquidação; **o dono reconcilia e confirma** (owner/mirror) |
| Identidade | `actorId` do device (DEC-105) | `actorId` local persistente do navegador/app (o link é a credencial; sem conta) |
| Futuro | — | **criar a própria viagem** e usar o app normalmente (vira Owner também) |

**Simetria importante:** todo usuário pode ser **dono das suas viagens** E **convidado em fatias de
outros**. Isso introduz uma área de topo nova **"Compartilhadas comigo"** no app (não só para quem chega
por link — qualquer usuário que receba uma fatia a vê ali). É uma mudança real de arquitetura de
informação (navegação/shell), não um bolt-on isolado.

**Privacidade por construção:** o dono **só criptografa a fatia do convidado**. Mesmo que o link vaze, o
que existe no servidor (cifrado) contém **apenas** os gastos daquela pessoa — nunca a viagem inteira.
Vira **mensagem de confiança** na UI: "O Julio compartilhou só a parte que envolve você. Você não vê o
resto da viagem dele."

---

## 2. Pesquisa de mercado (VERIFICADA — 2026-06-16)

> Regra `fact-verification.mdc`: cada afirmação competitiva tem fonte + data.

| App | Convidado sem app? | Como | Confiança |
|---|---|---|---|
| **Tricount** (17M+ users) | **Sim** | Convida por **link, sem cadastro**; o convidado "vê e **até adiciona** gastos no **navegador**, sem sign-up". Offline-first. **Porém** vêm recuando do web dashboard (reviews: "tiraram o web"). | VERIFIED — tricount.com/use-cases, Google Play, help.tricount.com |
| **Splitwise** | **Não** | **Exige conta de todos**; web quase read-only; share link **exige o app no destinatário**. Workaround: criar conta "fake" por e-mail. Settle: Venmo/PayPal. | VERIFIED — tapsmart, wikihow, split-the-bill.app/compare |
| **Settle Up** | **Sim** | "**não precisa todo mundo baixar o app**"; "compartilhar grupo **por link**"; **"dar acesso read-only"** explícito. Web + offline. | VERIFIED — Google Play (cz.destil.settleup) |
| **Splid** | **Sim** | "**sem cadastro**"; "compartilhar grupos online (no sign-up)"; offline-first; grupo offline + sync opcional. | VERIFIED — App Store, hermoney.com |
| **Settlify** (web-only) | **Sim** | Link puro, sem conta; **o link é a credencial** — "sessão vive no navegador; trocou de device → reabre o link". Organizador deve ter conta p/ recuperar. Adiciona pessoa **só pelo nome**. | VERIFIED — settlify.app/features/no-account-needed |
| **Split The Bill** | **Sim** | "**public share links** — manda a conta sem o outro instalar nada — existe na gente e **não no Splitwise**"; web-first, sem App Store gate; settle deep-links Venmo/PayPal/Revolut/Cash App/**Wise**/SEPA QR. | VERIFIED — split-the-bill.app/compare/splitwise |

### Padrões dos vencedores de "baixa fricção"
1. **Link = adoção** (Tricount/Settlify/Split The Bill). O muro de conta é a maior reclamação do Splitwise.
2. **O link é a credencial** (bearer); identidade local do navegador; sem conta/sem e-mail.
3. **Editar/adicionar pelo navegador sem cadastro** (Tricount/Settlify) — encaixa no que o Julio pediu (quase grupo).
4. **Dono recuperável** (Settlify): o dono mantém a verdade; o convidado reabre o link se perder.
5. **Settle por meio de pagamento** (Split The Bill) — no Brasil, **PIX** é o equivalente (nice-to-have).
6. **Loop viral:** convidado satisfeito → CTA suave "começar a sua viagem" → vira owner.

### Encaixe estratégico único do TripPilot
- O app **não está nas lojas** e **iOS é web** (DEC-206 addendum): um **link web sem instalar nada**
  transforma a "fraqueza" de distribuição em **força** — o convidado só abre uma URL.
- O TripPilot **já é E2E** (DEC-103: "a chave viaja no QR, nunca chega ao servidor"): estender para um
  canal **assíncrono via link** é evolução natural.

### 2.1 Pesquisa de backend — grátis + portável (VERIFIED 2026-06-16)

> Restrição do Julio: "de graça por bastante tempo" + "não quero ficar amarrado a uma plataforma; quero
> poder migrar fácil no futuro". → **evitar o primitivo mais preso à Cloudflare (Durable Object)**.

| Opção | Free tier (2026) | Portabilidade | Veredito p/ este caso |
|---|---|---|---|
| **Hono / Web-standard fetch** (camada de API) | grátis (roda no Worker atual) | **Altíssima** — Request/Response/fetch padrão roda em Workers, **Deno, Bun, Node, Vercel, Netlify, Lambda**; "começa num Node barato e move pra edge sem reescrever" | **USAR** como camada de API |
| **D1 (SQLite)** | **5 GB**, 5M leituras/dia, 100K escritas/dia; "Free **sempre** terá D1"; BLOB ≤ 2 MB/linha | **Alta** — `wrangler d1 export` → `.sql` SQLite padrão → importa em qualquer SQLite/Postgres | **USAR** como store estruturado (shareId, revision, TTL, respostas) |
| **R2 (object storage)** | **10 GB**, 1M Class A + 10M Class B/mês, **egress zero** | **Altíssima** — **API S3-compatible** (padrão universal); migra pra AWS S3/B2/MinIO trocando endpoint | **OPCIONAL** p/ blobs de ciphertext se crescerem |
| **Workers KV** | grátis (generoso) | Média — API específica CF (mas trivial de reimplementar) | alternativa simples |
| **Durable Objects** | free tier existe | **Baixa** — primitivo proprietário CF, sem equivalente fora | **EVITAR** p/ o store persistente (lock-in) |

**Decisão técnica (dentro do mandato "você escolhe, mas pesquise"):**
- **Camada de API = Hono (Web Standards)** no `worker/` — portável a Node/Deno/Bun/Vercel; nada exige CF.
- **Store atrás de uma interface `ShareStore`** (`put/get/delete` de slice + respostas por `shareId`) — o
  código depende **só da interface**, não do provider.
- **Implementação primária = D1 (SQLite)**: um único store SQL portável guardando `shareId`, ciphertext
  da fatia (BLOB ≤ 2 MB — uma fatia é pequena), respostas, `revision`, `expiresAt`. Migra via dump `.sql`.
- **R2 reservado** para blobs caso cresçam (S3 = portabilidade máxima). **Durable Object NÃO** entra no
  persistente (fica só no signaling efêmero atual, que **não** vamos expandir).
- **Sem websocket / tempo real** (pedido do Julio): tudo **pull assíncrono** (dono puxa respostas ao
  abrir; convidado puxa a fatia ao abrir). Sem push instantâneo.

Custo real esperado: alguns KB por fatia + poucas escritas → **muito abaixo de qualquer free tier**; o
gargalo de verdade é **portabilidade**, resolvida pela interface + D1/R2/Hono padrão.

---

## 3. Conselho (inline) — 5 lentes (resumo; recomendações já conciliadas com as decisões do Julio)

> Estrategista, Arquiteto, Crítico, Advogado do usuário, **Segurança/Privacidade**.

- **Estrategista:** maior alavanca de adoção e alinhada ao "sem loja / iOS web"; loop viral
  convidado→owner. Manter escopo de **copiloto** (extrato + ações + virar usuário), não rede social.
  Fazer como **épica dedicada agora**, antes de retomar waves A–E. *(Julio confirmou o timing.)*
- **Arquiteto:** o **motor está pronto** (DEC-106/102/071); o novo é **transporte assíncrono persistente**
  + **identidade de convidado permanente** + área "Compartilhadas comigo". Reusar redação de fatia
  (`buildParticipantStatement` DEC-102) e respostas de mirror (DEC-106). Store **portável** (D1/R2 +
  adapter + Hono), **não DO**. Ponto de atenção: **edição/adicionar do convidado** flui como
  **mudanças que o dono reconcilia** (estende DEC-071 de "confirmar share" para "confirmar linha
  adicionada/editada") — passo controlado rumo a grupo, **sem** CRDT/merge bidirecional (DEC-108 segue
  deferido).
- **Crítico (riscos):**
  - **HIGH — quebra "não armazena nada" (DEC-107/spec):** agora **armazenamos** (ciphertext). É reversão
    real → **DEC explícito** + spec reescrita honestamente. *(Julio liberou; ver DEC-207.)*
  - **HIGH — convidado reescrevendo dinheiro:** mitigado por **owner/mirror** (convidado **propõe**, dono
    **confirma**). *(É o que o Julio quer no settle.)*
  - **HIGH — link bearer:** mitigado por **redação na origem** (vaza só a fatia) + **E2E** + **TTL +
    revogar** + PIN opcional (default OFF).
  - **MEDIUM — custo/abuso do endpoint público:** rate-limit por `shareId`, teto de tamanho, TTL.
    *(free tier folgadíssimo p/ o volume real.)*
  - **MEDIUM — creep p/ tempo real:** o Julio **explicitamente NÃO quer websocket** → ficamos em
    **pull assíncrono**. Segura a linha.
  - **MEDIUM — "quase grupo" mexe no app principal:** a edição do convidado e a área "Compartilhadas
    comigo" tocam o shell/navegação e a reconciliação. **Recomendo corte de v1** (seção 5).
- **Advogado:** fricção zero p/ o convidado (abre → vê → aprova/edita → "paguei"); upgrade suave **depois**
  do valor (nunca travar atrás de cadastro). Gerar link = 1 toque; revogar fácil. PIX-first ajuda no BR.
- **Segurança:** E2E (chave no `#fragment`) preserva "servidor nunca vê texto claro" mesmo armazenando;
  redação na origem = defesa em profundidade; AES-GCM detecta adulteração; minimizar dados (sem e-mail).

**Confiança: HIGH** — motor provado (DEC-106) + padrão de mercado confirmado; risco concentrado em **um**
componente novo (share store), bem delimitado e **portável por design**.

---

## 4. Arquitetura recomendada (atualizada)

```
OWNER (app)                      SERVIDOR (Hono em Web Standards, free + portável)        GUEST (vira usuário permanente)
 buildGuestShareSlice(trip,p)      ShareStore (interface) → D1 (SQLite) [/ R2 opcional]      abre /s/<shareId>#<key>
  → fatia só da pessoa               guarda SÓ ciphertext + revision + expiresAt:             → cria actorId local permanente
 encrypt(fatia, key) ──PUT──▶          • slice (owner→guest)                  ──GET (pull)──▶  GET ciphertext por shareId
 link = /s/<shareId>#<key>             • respostas (guest→owner)                                decrypt(key do #fragment)
 (WhatsApp) ───────────────────────▶   TTL, rate-limit, tamanho máx                             "Compartilhadas comigo":
 ◀── GET respostas (pull no open) ──   (nunca vê texto claro; sem websocket)        ◀──PUT──   ver/editar/adicionar + aprovar
 reconcilia (owner = verdade):                                                                  + marcar "paguei" (proposta)
  confirma share / linha / Settlement                                                           (+ pode criar "Minhas viagens")
```

- **Reuso:** `buildParticipantStatement` (DEC-102), respostas de mirror (DEC-106), confirmação de share
  (DEC-071), AES-GCM (`src/data/sync/`), codec base (`src/domain/sync/`), `actorId`/`linkedActorId` (DEC-105).
- **Novo mínimo:** `buildGuestShareSlice` (domínio puro + testes); `ShareStore` interface + impl D1; API
  Hono no `worker/`; rota `/s/:id` fora do BootGate; provisão de **usuário-convidado permanente** + área
  **"Compartilhadas comigo"**; fluxo gerar/revogar link; reconciliação de respostas no dono; App Link nativo.
- **Portabilidade explícita:** API em Web Standards + store atrás de interface → trocar D1↔R2↔Postgres↔S3
  ou Worker↔Node/Deno/Bun **sem reescrever a lógica**. Sem Durable Object no caminho persistente.

---

## 5. Gates propostos (épica "Shared Participant Link") — build a seguir

> Cada gate: testes verdes + build + commit + deploy; APK só quando mexer em nativo (App Links).
> **Corte de v1 recomendado** para domar o "quase grupo": começar por **ver + aprovar + adicionar o
> PRÓPRIO gasto (como proposta) + liquidar**; **editar/excluir gastos de outros** fica para v1.1 (mais
> risco de merge). Confirmar esse corte com o Julio na abertura da épica.

- **S0 — DEC + spec (sem código):** DEC-207 (já aprovado, abaixo); reescrever a spec "V1 NOT in scope"
  ("no remote database" → "armazena só ciphertext E2E, TTL, revogável, portável; sem tempo real").
- **S1 — Domínio (web, OTA):** `buildGuestShareSlice` (redação) + tipos do canal assíncrono + `ShareStore`
  interface + testes (fatia nunca contém dado fora da pessoa; saldo bate com o engine de dívidas).
- **S2 — ShareStore portável (Worker/Hono):** API Hono + impl **D1** (ciphertext slice + respostas +
  revision + TTL), rate-limit, tamanho máx; PUT/GET slice + PUT/GET respostas. `wrangler deploy`.
- **S3 — Owner gera/gerencia link (web, OTA):** "Compartilhar" 1-toque no extrato do participante
  (copiar/WhatsApp), republicar no change (revision++), **revogar/rotacionar**; push da fatia cifrada.
- **S4 — Guest = usuário permanente (web, OTA):** rota `/s/:id` fora do BootGate; cria `actorId` local
  permanente; **home do convidado com "Minhas viagens" + "Compartilhadas comigo"**; decifra + extrato +
  mensagem de privacidade; **aprovar/rejeitar** (DEC-071) + **adicionar o próprio gasto (proposta)** +
  **marcar "paguei"** (proposta); PIX/Wise hint opcional.
- **S5 — Owner reconcilia (web, OTA):** pull das respostas ao abrir; aplica via DEC-106 (confirma share /
  linha adicionada / cria Settlement **pendente de confirmação do dono**); fila offline (igual DEC-106).
- **S6 — Upgrade path (web, OTA):** CTA suave "começar minha viagem" pós-valor → onboarding do convidado
  como Owner; "Compartilhadas comigo" continua acessível ao lado de "Minhas viagens".
- **S7 — Nativo (APK):** App Links de `/s/:id` (verificação de domínio) + `requiredNativeVersion`/versionCode.
- **S8 — v1.1 / polish (opcional):** convidado editar/excluir gastos de outros (com reconciliação madura);
  PIN/código por link (default OFF); "atualizado há X"; tela "links ativos"; backup do usuário-convidado.

---

## 6. Anti-regressão / âncoras a respeitar
- **Owner/mirror (DEC-106):** dinheiro nunca é reescrito pelo convidado — só **proposta + confirmação do dono**.
- **E2E (DEC-103):** chave só no `#fragment`; servidor nunca vê texto claro (mesmo agora armazenando).
- **Sem tempo real (decisão Julio):** só **pull assíncrono**; nada de websocket/push instantâneo de cobrança.
- **Portabilidade (decisão Julio):** API em Web Standards + store atrás de interface (D1/R2 padrão);
  **proibido** acoplar a lógica a primitivo CF proprietário (Durable Object) no caminho persistente.
- **Custo (decisão Julio):** ficar no free tier; reavaliar só se o volume real algum dia ameaçar o limite.
- **Redação na origem:** o convidado nunca recebe nada além da fatia dele (provar por teste).
- **DEC-108 (deferidos):** **não** virar merge bidirecional/CRDT/grupo em tempo real.
- **Spec honesta:** reescrever "no remote database" (README truth policy — não contradizer em silêncio).
- **Sem cadastro para o convidado** (DEC-105); upgrade nunca trava o extrato (anti-Splitwise).
- **i18n pt/en/es** p/ toda string nova. tsc 0 + build sem chunk >500KB. Deploy produção `--branch=master`.

---

## 7. Decisões TRAVADAS (Julio, 2026-06-16, via AskQuestion)

1. **Servidor persistente?** ✅ **SIM** — pode armazenar ("hoje não tem problema"), **mas**: (a) **custo
   zero** / melhor custo-benefício por muito tempo; (b) **portabilidade total** (sem lock-in; migrar fácil);
   (c) **sem tempo real/websocket** — assíncrono (pull). → atendido por Hono + D1/R2 + interface adapter,
   tudo E2E (ciphertext-only).
2. **Capacidade do convidado:** ✅ **quase um grupo** — **ver + editar + adicionar** na fatia, **+** virar
   **usuário permanente** ao abrir o link (sem cadastro), com **"Minhas viagens" + "Compartilhadas comigo"**,
   podendo **criar a própria viagem** depois. *(Corte de v1 recomendado: adicionar o próprio gasto já no v1;
   editar/excluir gastos de outros no v1.1 — confirmar na abertura.)*
3. **Liquidação:** ✅ **convidado marca "paguei" → volta pro dono → o dono confirma** (ida-e-volta;
   owner/mirror DEC-106). PIX-first/Wise hint = nice-to-have, não obrigatório.
4. **Timing:** ✅ **épica dedicada agora**, depois da épica de notas, **antes** de retomar waves A–E.
5. **Backend & detalhes:** ✅ **"você decide, mas pesquise certo"** + restrições de custo/portabilidade →
   escolha fundamentada (seção 2.1): **Hono (Web Standards) + `ShareStore` interface + D1 (primário) /
   R2 (opcional), SEM Durable Object**; TTL + revogar; PIN por link **default OFF**.

---

## 8. Relação com o que já está planejado
- **F19** (round2 masterplan, Wave C): "conexão por **link** (não só QR)" — o **pareamento** por link de
  dois usuários **com** app. Esta épica é o **superset assíncrono**: link para quem **não tem** app, fatia
  redigida + write-back + usuário-convidado permanente. **Funde F19** (mesmo roteamento `/s`+`/pair` e o
  mesmo hub de "compartilhar/conexão").
- **DEC-106/102/071:** motor financeiro reutilizado integralmente.
- **Entidades futuras já previstas** (technical-direction): `UserAccount, Group, GroupMembership,
  SharedExpenseConfirmation` — esta épica **não** exige `UserAccount` (convidado é bearer-link com actorId
  local), mas a área "Compartilhadas comigo" + "Minhas viagens" **prepara o terreno** para grupos.

---

*Fontes verificadas em 2026-06-16: mercado (Tricount, Splitwise, Settle Up, Splid, Settlify, Split The
Bill — §2) e backend (Cloudflare D1/R2 pricing+limits, Hono Web Standards — §2.1). Decisões do Julio
travadas (§7) → DEC-207 APROVADO → próxima entrega: abrir a épica em S0/S1.*

---

## ADDENDUM (2026-06-16, mesma noite) — CORREÇÃO: tempo real É desejado

> **Supersede** todas as menções acima a "sem websocket / sem tempo real" (§0, §2.1, §3.3, §6, §7-1c) —
> elas refletiam uma má-interpretação minha. **O Julio QUER tempo real + notificação**, com ressalva de
> viabilidade.

**O que o Julio disse:** "Seria muito legal SE tivesse em tempo real — criar uma dívida/gasto aqui agora,
já chega no celular do meu cunhado em tempo real, com uma notificação 'o Julio dividiu um gasto com
você', porque já estaria tudo conectado. Meu Android, o dele iPhone — não sei se funcionaria. **Agora, se
não for funcionar, for difícil, e nem dá notificação pro iPhone, aí não vale tanto a pena.** Ainda daria
pra mandar a notificação no Android, que já é legal. Mas tem que ver com o conselho se vale a pena."

**Conselho (inline) sobre tempo real + notificação — veredito:**
- **Estrategista/Advogado:** o "mágico" (dividiu → chegou na hora + aviso) é exatamente o que prende; vale
  como **camada best-effort**, sem comprometer o piso.
- **Arquiteto:** o piso **assíncrono (pull)** continua sendo a verdade que **sempre funciona** (S1–S6).
  Por cima: **relay WebSocket reusando o padrão do `SyncRoom` Durable Object** (já existe, free tier) —
  **só transporte**: quando os dois estão online, entrega a fatia/atualização ao vivo. **Portabilidade
  preservada** porque os DADOS persistem no **D1 portável**; o DO é transporte descartável (migrar = trocar
  o relay por um WebSocket server padrão; os dados saem via dump SQL).
- **Crítico (limites honestos):**
  - **Notificação com o app ABERTO/foreground (Android):** ✅ viável (in-app + LocalNotification).
  - **Notificação com o app FECHADO:** ❌ precisa push tipo **FCM**, que exige Google Play Services — e o
    app é **sideload, sem Play Services** (DEC-206). Fora de escopo por ora.
  - **iOS-web:** ❌ sem nativo; web push no iOS é limitadíssimo → cai no **assíncrono** (vê ao abrir o link).
  - **Não** virar merge bidirecional/CRDT (DEC-108 segue deferido).
- **Veredito:** **vale a pena** como **S7 best-effort**: tempo real + **notificação no Android (app
  aberto)**; iOS-web e app-fechado caem no piso assíncrono. Exatamente o trade-off que o Julio aceitou
  ("Android já é legal; se iPhone não dá, tudo bem").

**Gates revisados** (insere tempo real; empurra nativo/polish):
- **S1–S6** = piso assíncrono E2E (inalterado; é o que sempre funciona).
- **S7 — Tempo real + notificação (best-effort):** relay WebSocket (reusa `SyncRoom` DO = transporte;
  dados no D1) entrega ao vivo quando ambos online + **notificação Android (app aberto)** "Fulano dividiu
  um gasto com você". Fallback = piso assíncrono. **Fora:** push app-fechado (sem FCM) e iOS-web.
- **S8 — Nativo (APK):** App Links de `/s/:id` + bump nativo.
- **S9 — v1.1/polish:** editar/excluir de outros (reconciliação madura); PIN por link (default OFF);
  "links ativos"; backup do usuário-convidado.

**§7 decisão 1 corrigida:** servidor persistente **SIM** + **custo zero** + **portabilidade total
(sem lock-in)** + **tempo real best-effort SIM** (relay WS = transporte; dados no D1 portável). O único
"não" honesto é push **com app fechado** (sem FCM) e **iOS-web** (limite da plataforma) — esses caem no
piso assíncrono.
