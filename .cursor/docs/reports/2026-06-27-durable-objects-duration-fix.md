# Durable Objects — estouro de "duration" no free tier: diagnóstico, correção (TripPilot) e o que (não) fazer no FestPilot

- **Data:** 2026-06-27
- **Contexto:** e-mail da Cloudflare "Daily Durable Objects duration limit exceeded" (free tier, reset em 28/06 00:00 UTC).
- **Status:** TripPilot corrigido e deployado. FestPilot avaliado (não precisa da correção estrutural).
- **Confiança:** ALTA — números do dashboard reconciliados com o e-mail e com a [doc oficial de pricing](https://developers.cloudflare.com/durable-objects/platform/pricing/) (verificada 2026-06-27); arquitetura confirmada lendo o código dos dois apps.

---

## TL;DR

1. A conta Cloudflare é **compartilhada** por TripPilot e FestPilot (ambos em `*.trippilot.workers.dev` ⇒ mesmo subdomínio `workers.dev` ⇒ mesma conta ⇒ **mesmo orçamento de free tier de Durable Objects**).
2. O que estourou **não** foi número de requisições, foi **duration** (tempo que um Durable Object fica vivo). Free tier = **13.000 GB-s/dia**.
3. **~99% da duração veio do TripPilot**, do Durable Object `ShareSignal` (um relay WebSocket) que usava `server.accept()` **sem a WebSocket Hibernation API** → a Cloudflare cobra o socket conectado o tempo TODO, mesmo ocioso.
4. **Amplificador:** dev/preview/E2E apontavam para o worker de **produção** (a env var nunca era setada), então abas de teste seguravam sockets vivos de produção.
5. **Correção (feita no TripPilot):** (A) migrar `ShareSignal` + `SyncRoom` para a Hibernation API; (B) isolar o ambiente (dev/E2E/preview → staging).
6. **FestPilot:** o `GroupRoom` **já usa a Hibernation API corretamente** → **nada estrutural a fazer**. Só melhorias opcionais (abaixo).

---

## 1. O conceito-chave: como a Cloudflare cobra Durable Objects

Há **dois medidores** independentes, e é fácil confundir:

| Medidor | Free tier | O que conta |
|---|---|---|
| **Requests** | 100.000 / dia | HTTP, RPC, mensagens WebSocket (razão 20:1), alarms |
| **Duration** | **13.000 GB-s / dia** | **tempo de relógio que o DO fica vivo × 128 MB** |

`duration = segundos_vivo × 0,128 GB`. Então:
- **1 Durable Object vivo 24h = 86.400 s × 0,128 = 11.059 GB-s/dia = 85% de TODO o free diário.** Dois DOs vivos 24/7 já estouram sozinhos.
- O e-mail reportou `101562500000` (microssegundos × 0,128 GB) = 101.562,5 s = exatamente **13.000 GB-s**. A conta fecha.

**O detalhe que decide tudo (citação da doc oficial):**

> *"Calling `accept()` on a WebSocket in an Object will incur duration charges for the entire time the WebSocket is connected. It is recommended to use the WebSocket Hibernation API to avoid incurring duration charges once all event handlers finish running."*

Analogia: `server.accept()` é um **táxi com o taxímetro rodando enquanto a porta está aberta**, mesmo parado. A **Hibernation API** (`state.acceptWebSocket()`) só roda o taxímetro **quando chega uma mensagem** — entre mensagens, o DO hiberna e custa ~0. Como sinais de tempo real são raros, o socket fica ocioso ~99% do tempo.

O exemplo oficial da Cloudflare para esse caso: relay WebSocket **sem** hibernação ≈ US$133/mês; **com** hibernação ≈ US$1,91/mês (~95% de queda).

---

## 2. O que estourou (diagnóstico — TripPilot)

Do dashboard (Durable Objects, período 24/06+):

| Namespace | Requests | Errors | Duration (GB-s) |
|---|---|---|---|
| **`trippilot-sync_ShareSignal`** | 5,38k | 5,32k | **22,3k** ← ~99% |
| `trippilot-sync_Mailbox` | 4,22k | 655 | 0,2k |
| `trippilot-sync_ShareStore` | 3,64k | 0 | 0,03k |
| `trippilot-sync_SyncRoom` | 42 | 2 | 0,045k |
| `festpilot_GroupRoom` | 3,55k | 1,47k | **0,073k** ← baixo (já hiberna) |

- **`ShareSignal`** (relay de tempo real do compartilhamento de conta) e **`SyncRoom`** (sync entre 2 dispositivos) usavam `server.accept()` + `addEventListener` + um array `this.sockets` em memória → **sem hibernação** → cada socket aberto cobrava 128 MB por segundo, mesmo ocioso.
- **Gatilho:** `src/data/sync/config.ts` tinha `VITE_SYNC_WORKER_URL ?? 'https://trippilot-sync.trippilot.workers.dev'` e a env var **nunca era setada** em dev/preview/E2E → cada aba de teste segurava um socket vivo de produção.
- O app individual (local-first / IndexedDB) **nunca caiu**; só a camada de colaboração/sync.

---

## 3. A correção aplicada no TripPilot

### 3.1 Hibernação (estrutural) — `worker/src/index.ts`

**Padrão antigo (cobra sempre):**

```ts
server.accept();
this.sockets.push(server);
server.addEventListener('message', (e) => { /* fanout via this.sockets */ });
server.addEventListener('close', cleanup);
```

**Padrão novo (hiberna; idle custa ~0):**

```ts
this.state.acceptWebSocket(server);        // hibernatable accept
// handlers viram MÉTODOS de instância (o runtime os chama por nome):
webSocketMessage(ws, message) { /* fanout via this.state.getWebSockets() */ }
webSocketClose(ws)  { /* close + notify */ }
webSocketError(ws)  { /* close */ }
```

Regra de ouro: **nada de estado em campos de instância** (`this.sockets`, `this.opened`) — eles não sobrevivem à hibernação. Enumere sockets vivos com `this.state.getWebSockets()` e persista qualquer verdade necessária no `storage`/alarm (no `SyncRoom`, o alarm passou a ser a fonte de verdade de "sala aberta").

- **Sem nova migration** (hibernação é API de runtime; `wrangler.jsonc` inalterado).
- **Deployado em produção** (worker `trippilot-sync`, versão CF `bfa12d49-515b-4732-90a7-bc671663bc40`).
- Validado: `tsc` strict OK · `wrangler deploy --dry-run` OK · 2639/2641 testes (as 2 falhas são o teste de integração "real worker" falhando por causa do limite estourado — não-regressão).

### 3.2 Isolamento de ambiente (estanca o sangramento de teste)

| Arquivo | Papel |
|---|---|
| `.env.development` | `npm run dev` + E2E local (Playwright sobe `npm run dev`) → worker **staging** |
| `.env.staging` | builds em `--mode staging` → worker **staging** |
| `package.json` › `preview:staging` | build em `dist-staging/` separado + serve (preview → staging) |
| `.gitignore` | ignora `dist-staging/` |

**Por que é seguro:** o Vite só carrega `.env.development` em modo `development`; `npm run build` (produção / Cloudflare Pages) **ignora** e mantém o default de produção. **Provado** com build real + grep: o bundle de produção **não** contém a URL de staging; o de staging contém.

**Passo manual restante (só no dashboard):** Cloudflare → Workers & Pages → `trippilot` → Settings → Variables → ambiente **Preview** → `VITE_SYNC_WORKER_URL = https://trippilot-sync-staging.trippilot.workers.dev` (**não** adicionar em Production).

---

## 4. FestPilot — avaliação (a premissa "fazer o mesmo" se inverte)

**A conta é compartilhada**, então o estouro afetou os dois apps — mas **a causa foi o TripPilot**, e a correção do TripPilot é o que resolve.

**O `GroupRoom` do FestPilot já está correto** (`server/src/group/room.ts`):

```ts
export class GroupRoom implements DurableObject {
  // ...
  this.state.acceptWebSocket(server);                 // ✅ hibernável
  async webSocketMessage(ws, message) { if (message === "ping") ws.send("pong"); }  // keepalive
  async webSocketClose(ws, code) { /* ... */ }        // ✅
  // fan-out via this.state.getWebSockets()           // ✅ sem array em memória
}
```

Duração no dashboard: **~73 GB-s** (coerente com hibernação). **Conclusão: nada estrutural a fazer no FestPilot.**

### Melhorias OPCIONAIS no FestPilot (não urgentes, não foram a causa)

1. **Isolamento de ambiente** — `web/src/data/api.ts` usa `VITE_API_URL || 'https://festpilot.trippilot.workers.dev'`. O `web/.env.example` já sugere `VITE_API_URL=http://127.0.0.1:8787` para dev (worker local via `wrangler dev`) — que é ainda melhor que staging (zero produção). Recomendação: garantir que todo dev tenha um `.env` apontando para o worker local, e que E2E/CI não batam em produção. (O FestPilot não tem um worker de staging deployado hoje.)
2. **Micro-otimização do keepalive** — hoje o ping é tratado em `webSocketMessage` (cada ping **acorda** o DO brevemente). Trocar por `state.setWebSocketAutoResponse(new WebSocketRequestResponsePair("ping","pong"))` faz o ping ser respondido **sem acordar** o DO → zero duração nos keepalives.
3. **Investigar os 1,47k erros do `GroupRoom`** (dashboard) — provavelmente handshakes sem `Upgrade` (426) ou token `?t=` inválido. É **qualidade/ruído, não custo** (a duração é baixa). Item separado.

---

## 5. Runbook — auditar QUALQUER Worker + Durable Object para esse problema

1. **Achar DOs de WebSocket:** procure `new WebSocketPair` / `status: 101` no worker.
2. **Checar hibernação:** usa `state.acceptWebSocket()` (✅ hiberna) ou `server.accept()` (❌ cobra o tempo todo)? Se `accept()`, migrar (seção 3.1).
3. **Estado em memória:** se o DO guarda sockets/flags em campos de instância, migrar para `getWebSockets()` + `storage`/alarm.
4. **Keepalive:** se o cliente manda ping, usar `setWebSocketAutoResponse` em vez de tratar no `webSocketMessage`.
5. **Conexões outbound:** `connect()` ou `fetch` de saída dentro do DO **impedem hibernação** por até 15 min — evitar manter abertas.
6. **URL do worker no cliente:** existe default de produção? Há env var (`VITE_*`) para dev/preview/E2E apontarem para **staging/local**? Se não, criar (seção 3.2) — e garantir que **não vaze** para o build de produção.
7. **Medir:** dashboard → Durable Objects → Metrics → **Duration (GB-s)**; ver qual namespace domina.
8. **Backstop:** criar um **alerta de orçamento** (duração) no dashboard. Lembrar: free = 13.000 GB-s/dia; 1 socket sempre-vivo sem hibernação ≈ 11.059 GB-s/dia.

---

## Referências

- Cloudflare — Durable Objects Pricing: https://developers.cloudflare.com/durable-objects/platform/pricing/
- TripPilot: `worker/src/index.ts` (`ShareSignal`, `SyncRoom`), `src/data/sync/config.ts`, `.env.development`, `.env.staging`.
- FestPilot: `server/src/group/room.ts` (`GroupRoom`), `web/src/data/api.ts`, `web/.env.example`.
- Decisões: DEC-374 (isolamento), DEC-383 (hibernação), DEC-384 (peer-ping ocioso + plano) em `TripPilot/brain/decision-log.md`.
