# IMPLEMENTAÇÃO R4 — P2P SYNC (PAREAMENTO QR + MIGRAÇÃO + DÍVIDAS ESPELHADAS) — TripPilot

> **Modo**: Chat direto — sem agents, sem subagents, sem Task tool
> **Fonte da verdade**: ESTE prompt + DEC-103..108 — resultado da sessão de council de 2026-06-10 (MTG-2026-06-10). Cada requisito traz a especificação e o critério de aceite
> **Objetivo**: 14/14 requisitos implementados · DEC-103..108 já registrados · brain atualizado · Worker `trippilot-sync` no ar · deploy v0.5.0 no ar
> **Baseline protegida**: 264 unit + 29 e2e verdes, build/typecheck limpos — NUNCA pode regredir
> **Tema central**: "os dois celulares trocam informação sem backend de verdade — QR para apresentar, canal direto para transferir, e a verdade financeira NUNCA faz merge bidirecional"

---

## IDENTIDADE

Você é um desenvolvedor senior full-stack implementando a rodada R4 **sozinho, nesta conversa**. As decisões estão pré-resolvidas no decision-log (DEC-103..108). Onde este prompt especifica, execute.

**Regras absolutas:**
- NÃO delegue para agents/subagents/Task tool
- NÃO peça confirmação entre gates
- NÃO resuma — implemente
- PRESERVE a baseline de testes — regressão bloqueia o gate
- Cada requisito tem um "DONE quando" — critério de aceite não negociável

---

## ⚓ ÂNCORA — REGRAS INVIOLÁVEIS

Releia no início de CADA gate:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
1. VERDADE FINANCEIRA NUNCA FAZ MERGE BIDIRECIONAL (DEC-106):
   dono registra, espelho lê e responde confirmações. Ponto.
2. O Worker NUNCA vê plaintext: chave AES-GCM vai no QR (fragmento),
   payloads cifrados fim-a-fim, sala expira, nada é armazenado
3. Digitar nome continua o caminho PADRÃO; parear é upgrade opcional.
   Quick-add e Outing Mode são INTOCÁVEIS — zero passos novos
4. Money = integer cents | Soft delete + revision | Domain pure TS
   (protocolo de sync é domínio puro testável; WebRTC/camera ficam
   em src/data/sync e componentes — camada fina)
5. Dexie v4 SÓ pelas tabelas novas (peerLinks, mirroredStatements);
   campos novos não indexados NÃO justificam bump adicional
6. Backup v4: tabelas novas incluídas; arquivos v1-v3 normalizam
7. Zero cores hardcoded — tokens. Zero diálogos nativos
8. UI text = t() em pt-BR + en + es NO MESMO COMMIT (paridade)
9. npm run test + typecheck + build verdes em TODO checkpoint
10. Node 22 p/ wrangler/playwright:
    export PATH="$HOME/.nvm/versions/node/v22.22.3/bin:$PATH"
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

---

## DECISÕES PRÉ-RESOLVIDAS (já registradas)

| DEC | Título |
|---|---|
| DEC-103 | Canal device-to-device: WebRTC + Worker de sinalização + fallbacks (relay cifrado, 2 QRs offline, QR único ≤1,2 KB) |
| DEC-104 | Migração de aparelho via transferência direta (Welcome + Backup page) |
| DEC-105 | Identidade de ator sem contas (actorId = device id; `Participant.linkedActorId`) |
| DEC-106 | Modelo dono/espelho para dívidas (mirroredStatements + confirmações via DEC-071; Dexie v4) |
| DEC-107 | Worker `trippilot-sync`: salas efêmeras, relay opaco, zero armazenamento |
| DEC-108 | Deferrals V2 (split em tempo real, grupo, settlement handshake, QR animado) |

---

## STATE FILE (crie ANTES de qualquer código)

`TripPilot/src/gap-fix-log-r4.md` — mesmo formato dos anteriores: Current State (gate/item ativo, X/14, testes, build), checkboxes por gate, extras encontrados (anotar, não corrigir).

---

## MAPA DE GATES

```
GATE 0  Baseline + state file (brain já atualizado)
GATE 1  Domínio de sync: identidade, protocolo, chunking, QR codec   P2P-01..03
GATE 2  Worker trippilot-sync (salas + relay) + deploy               P2P-04
GATE 3  Transporte: signaling client, crypto, WebRTC, relay,         P2P-05..06
        sinalização manual por 2 QRs
GATE 4  UI: componentes QR + migração de aparelho                    P2P-07..09
GATE 5  Pareamento + extrato espelhado + confirmações remotas        P2P-10..13
GATE 6  Varredura + brain + verificação final + deploy v0.5.0        P2P-14
```

---

## GATE 1 — DOMÍNIO DE SYNC (pure TS, testável)

**P2P-01 — Identidade de ator (DEC-105)**
- `src/domain/sync/identity.ts`: tipo `ActorIdentity { actorId, displayName }`;
  payload de QR de identidade `{ v: 1, kind: 'identity', actorId, name }` com builder
  + parser Zod. O actorId vem do device id existente (`trippilot_device_id`) — expor
  getter em `src/utils/entity-factory.ts` (`getInstallationId()`)
- DONE quando: builder/parser round-trip testado; QR de identidade rejeita payloads malformados

**P2P-02 — Protocolo de mensagens + chunking**
- `src/domain/sync/protocol.ts`: envelopes JSON discriminados por `t`:
  `hello` (actorId, name, purpose: 'migration'|'statement', appVersion),
  `manifest` (kind, totalChunks, totalBytes, sha256),
  `chunk` (i, data base64), `done`, `ack` (ok, error?),
  `responses` (items: [{ shareId, status: 'confirmed'|'rejected' }]), `bye`
- Chunking de payload: deflate (CompressionStream) → base64 → fatias de 12 KB
  (margem sob o limite de 16 KB do DataChannel); SHA-256 via WebCrypto para o manifest
- `encodeSyncMessage`/`parseSyncMessage` com Zod — mensagem inválida nunca explode, retorna erro tipado
- DONE quando: teste round-trip de payload de 200 KB simulado → chunks → remontagem → hash confere; chunk corrompido → falha de checksum detectada

**P2P-03 — QR codec + payloads de negócio**
- `src/domain/sync/qr-codec.ts`: `encodeQrPayload(obj)` = deflate + base64url;
  `decodeQrPayload`; `fitsInSingleQr(encoded)` (limite conservador ~1,2 KB)
- `src/domain/sync/statement-payload.ts`: `buildStatementPayload(...)` — reusa
  `buildParticipantStatement` (DEC-102) e empacota linhas com `shareId`,
  `confirmationStatus`, valores, datas, payer, subcategoria + saldo líquido + moeda +
  identidade do dono; `applyStatementResponses(shares, items)` — função pura que
  retorna os shares atualizados (somente shares do participante espelhado, somente
  pending → confirmed/rejected)
- `src/domain/sync/migration-payload.ts`: wrapper `{ kind: 'backup', data: BackupData }`
  validado com o `backupFileSchema` existente
- DONE quando: extrato da Debora com 3 linhas (2 pending) → payload → respostas
  confirmam 1 e rejeitam 1 → `applyStatementResponses` atualiza exatamente esses 2
  shares com números exatos em cents

**Checkpoint** + commit `feat(gate-r4-1): sync domain — identity, protocol, chunking, qr codec, statement payloads`

---

## GATE 2 — WORKER DE SINALIZAÇÃO (DEC-107)

**P2P-04 — `worker/` + deploy**
- `worker/src/index.ts`: Worker com rotas
  `POST /rooms` → `{ code }` (6 chars, sem ambíguos), e
  `GET /rooms/:code/ws` → upgrade WebSocket roteado ao DO `SyncRoom`
- `SyncRoom` (Durable Object, classe SQLite): aceita no máximo 2 sockets;
  relay opaco de toda mensagem ao outro peer; mensagem `{"type":"peer-joined"}` /
  `{"type":"peer-left"}` geradas pelo DO; alarm expira a sala em 10 min;
  CORS liberado para o domínio do app
- `worker/wrangler.jsonc`: nome `trippilot-sync`, DO binding + migration
  `new_sqlite_classes`, observability on
- Deploy: `npx wrangler deploy` (a partir de `worker/`); anotar a URL e configurar em
  `src/data/sync/config.ts` (`VITE_SYNC_WORKER_URL` com default para a URL deployada)
- DONE quando: `curl -X POST .../rooms` retorna code; smoke de WebSocket (script Node)
  conecta 2 clientes na mesma sala e troca mensagem relayada

**Checkpoint** + commit `feat(gate-r4-2): trippilot-sync worker — ephemeral rooms + opaque relay (deployed)`

---

## GATE 3 — TRANSPORTE NO APP

**P2P-05 — Crypto + signaling client + relay**
- `src/data/sync/crypto.ts`: AES-GCM 256 (generate/export/import raw key base64url,
  encrypt/decrypt com IV aleatório por mensagem) via WebCrypto
- `src/data/sync/signaling-client.ts`: cria sala (POST), conecta WS, JSON in/out,
  eventos peer-joined/left, close limpo
- Tudo que passa pela sala (sinais WebRTC e payload em modo relay) vai cifrado com a
  chave da sessão; a chave NUNCA é enviada à sala — viaja apenas no QR
- DONE quando: testes de crypto (round-trip, IV únicos, chave errada falha) verdes

**P2P-06 — Transporte WebRTC + fallback + sinalização manual**
- `src/data/sync/webrtc-transport.ts`: RTCPeerConnection (STUN Google) + DataChannel
  `sync`; interface única `SyncChannel { send(msg), onMessage, close }` compartilhada
  com o relay
- `src/data/sync/connection.ts` (orquestrador): host cria sala → QR
  `{ v:1, kind:'session', code, key, purpose }` → guest entra → troca offer/answer/ICE
  cifrados pela sala → DataChannel abre; se não abrir em 8 s, **fallback automático**
  para relay cifrado pela própria sala (mesma interface, usuário não percebe)
- **Modo offline (2 QRs)**: `src/data/sync/manual-signaling.ts` — host gera offer
  (ICE gathering completo, host candidates), comprime via qr-codec → QR; guest escaneia,
  gera answer → QR; host escaneia → canal local sem Worker. Se o SDP comprimido não
  couber no limite de QR, erro claro orientando o modo online
- DONE quando: framing/chunk flow testado com um FakeChannel (sem WebRTC real);
  typecheck/build verdes

**Checkpoint** + commit `feat(gate-r4-3): sync transports — e2e crypto, signaling, webrtc + relay fallback, manual 2-qr signaling`

---

## GATE 4 — UI DE QR + MIGRAÇÃO (DEC-104)

**P2P-07 — Componentes QR**
- deps: `qrcode` (geração) + `jsqr` (leitura)
- `src/components/QrCodeDisplay.tsx`: payload → dataURL (módulo claro sobre fundo
  claro p/ contraste em tema escuro — quiet zone respeitada)
- `src/components/QrScanner.tsx`: getUserMedia (environment), varredura via canvas +
  jsQR (~10 fps), overlay de mira, tratamento de permissão negada com mensagem clara,
  cleanup do stream no unmount
- DONE quando: componentes renderizam; scanner desliga a câmera ao fechar

**P2P-08 — Fluxo de transferência (sheet/página reutilizável)**
- `src/features/sync/SyncTransferFlow.tsx`: máquina de estados
  `idle → creating-room → waiting-peer → connecting → transferring(progress) → done | error`
  com variantes enviar/receber e modo offline (stepper 2 QRs); textos no tom amigo
  sincero; barra de progresso por chunks
- Rota `/sync` (receiver genérico): abre o scanner; QR de sessão escaneado decide o
  fluxo pelo `purpose`
- DONE quando: estados navegáveis, erros recuperáveis (tentar de novo), i18n ×3

**P2P-09 — Migração de aparelho**
- BackupPage: card "Enviar para outro aparelho" (gera QR de sessão, envia backup
  completo) + card "Receber de outro aparelho"
- WelcomePage: botão "Receber de outro aparelho" → mesmo fluxo receiver
- Receiver: payload validado (backupFileSchema) → preview de import EXISTENTE
  (analysis + merge/replace) → `importBackup` → toast de sucesso
- `lastBackupDate` atualizado no remetente após envio com sucesso
- DONE quando: o caminho completo enviar→receber→preview→import funciona em dois
  contextos de navegador (smoke manual via dois tabs com o worker real)

**Checkpoint** + commit `feat(gate-r4-4): qr components + transfer flow + device migration`

---

## GATE 5 — PAREAMENTO + DÍVIDAS ESPELHADAS (DEC-105/106)

**P2P-10 — Dexie v4 + tipos + backup v4**
- Tipos: `PeerLink extends SyncMetadata { actorId, displayName, participantId | null, lastSyncAt | null }`;
  `MirroredStatement extends SyncMetadata { peerActorId, peerName, receivedAt, currency, netCents, lines: MirroredLine[], pendingResponses: StatementResponse[] }`
  (`MirroredLine` carrega shareId, descrição/subcategoria, data, valor cents, payer,
  confirmationStatus, kind owes/owed)
- `Participant.linkedActorId: string | null` (NÃO indexado — sem efeito no schema)
- `SCHEMA_V4`: `peerLinks: 'id, actorId, participantId, deletedAt'`;
  `mirroredStatements: 'id, peerActorId, deletedAt'`; upgrade() noop p/ dados antigos;
  `Participant.linkedActorId` default null no upgrade + import
- Backup: `BACKUP_VERSION = 4`, tabelas novas em `BACKUP_TABLE_KEYS`, schema Zod,
  `normalizeBackupToV4` (v1-v3 → arrays vazios + linkedActorId null)
- Repositórios: `peer-link-repository`, `mirrored-statement-repository`
- DONE quando: testes de import v3→v4 verdes; migração Dexie roda no fake-indexeddb

**P2P-11 — Pareamento por QR**
- /shared: "Meu QR" no topo (mostra identidade DEC-105 — nome = participante owner ou
  deviceName) e, no form de adicionar participante, opção "Adicionar por QR" (scanner)
- Escanear identidade: cria Participant (name = displayName, linkedActorId) + PeerLink;
  se já existir participante com o mesmo linkedActorId → toast "já conectado"
- Vínculo retroativo: no extrato do participante (sheet DEC-102), botão "Conectar por QR"
  quando linkedActorId é null → escaneia → vincula participante existente + PeerLink
- Badge visual (ícone link) nos participantes pareados
- DONE quando: parear cria participante+link; retroativo vincula sem duplicar; digitar nome continua intacto

**P2P-12 — Enviar extrato (dono → espelho)**
- No extrato do participante pareado: botão "Enviar extrato para [nome]" → sessão de
  sync (QR ou — se payload couber — opção "Mostrar como QR" offline de leitura única)
- Payload = `buildStatementPayload`; no fim da sessão, processa `responses` recebidas
  na hora (aplica `applyStatementResponses` via orchestrator → atualiza shares)
- DONE quando: extrato chega no outro aparelho e respostas pendentes do espelho voltam na mesma sessão

**P2P-13 — Receber extrato + confirmar/rejeitar no espelho**
- /shared ganha seção "Recebidos de outros aparelhos": um card por MirroredStatement
  (peerName, saldo, "atualizado há X") → sheet com linhas; linhas pending têm botões
  confirmar/rejeitar → grava em `pendingResponses` E envia na sessão ativa se houver;
  na próxima sessão com aquele peer, `pendingResponses` são enviadas primeiro (flush)
  e limpas após ack
- Timestamp visível SEMPRE (risco HIGH do council: espelho sem data gera desconfiança)
- Receber novo extrato do mesmo peer substitui o anterior (1 por peer), preservando
  pendingResponses ainda não enviadas de linhas que continuam existindo
- DONE quando: ciclo completo dono→espelho→confirmação→dono atualiza
  ParticipantShare.confirmationStatus com os mesmos cents; offline → respostas ficam
  em fila e flusham na próxima sessão (teste de domínio cobre a fila)

**Checkpoint** + commit `feat(gate-r4-5): qr pairing + mirrored debt statements + remote confirmations (dexie v4, backup v4)`

---

## GATE 6 — VERIFICAÇÃO FINAL + DEPLOY

**P2P-14 — Fechamento**
```
1. Brain: project-status.md (R4 implementada, números) + README index se preciso
2. package.json → 0.5.0
3. npm run test (100%) + typecheck + build + npx playwright test
4. RE-VERIFICAÇÃO: tabela P2P-01..14 com cada "DONE quando" confirmado NO CÓDIGO
5. Smokes:
   a) worker no ar: POST /rooms → code; sala expira
   b) dois contextos: migração completa de backup
   c) pareamento QR cria participante vinculado
   d) extrato espelhado + confirmação remota atualiza o dono
   e) quick-add e outing mode intocados (regressão)
6. Paridade i18n ×3 | 0 hardcoded | 0 nativos
7. Deploy worker (`worker/`): npx wrangler deploy
8. Deploy app: npm run build && npx wrangler pages deploy dist --project-name=trippilot
9. Entregar: 🚀 URLs + tabela 14/14 + resumo por gate
```

---

## PROTOCOLO DE CHECKPOINT (fim de CADA gate)

```
GATE [N] CONCLUÍDO
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Requisitos: [P2P-XX ✅ ...] | Arquivos: [lista]
Testes: X unit + Y e2e | Build ✅ | Typecheck ✅
i18n: [N] chaves novas ×3 (paridade ✅)
Regressão: [2-3 fluxos anteriores re-checados]
Fora de escopo tocado? [não / o quê e por quê]
State file ✅ | Commit: [hash]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[reproduza o bloco ÂNCORA]
PRÓXIMO: Gate [N+1]
```

---

## RECOVERY PROTOCOL

1. `TripPilot/src/gap-fix-log-r4.md` → gate/requisito ativo
2. Releia ÂNCORA + seção do gate ativo NESTE prompt
3. `npm run test` para confirmar estado real
4. Continue do último checkbox aberto — NUNCA refaça gate concluído

---

## CRITÉRIO DE PARADA

```
DONE quando TUDO = TRUE:
- [ ] 14/14 requisitos com "DONE quando" confirmado
- [ ] DEC-103..108 approved no decision-log (feito no início)
- [ ] Worker trippilot-sync deployado e smoke-testado
- [ ] Dexie v4 + backup v4 com import retrocompatível testado
- [ ] Ciclo dono→espelho→confirmação→dono coberto por teste de domínio
- [ ] Quick-add/Outing intocados | digitar nome continua padrão
- [ ] Testes ≥ baseline e 100% verdes | Build/Typecheck clean | i18n ×3
- [ ] Brain atualizado | Deploy v0.5.0 no ar com URL
```

**GO.**
