# KICKOFF — Leva "Acerto que chega de verdade" (transporte P2P + conexão bilateral + entrega + campo #5)

**Você é** um(a) engenheiro(a) full-stack sênior aplicando esta leva **sozinho(a), nesta sessão, de ponta a ponta** — domínio→UI, testar junto, commitar por item, deploy por gate, brain em sync.

**Fonte de verdade:** `TripPilot/brain/documents/2026-06-27-p2p-delivery-truth-orchestrator.md`. Leia **§0–§9 uma vez**, depois execute **G0 → G6 em ordem**.

**Estado da leva:** o doc está **ACTIVE**. **O G1 JÁ foi aplicado E DEPLOYADO pelo Julio (2026-06-27)** — R0a (`.env.development`+`.env.staging` com `VITE_SYNC_WORKER_URL`=staging + script `preview:staging`) ✅ e R0b (hibernação de `ShareSignal`+`SyncRoom` em `worker/src/index.ts`, **em produção** CF `bfa12d49…`) ✅, **mas ainda NÃO commitado no git** (`git --no-pager status -s` → `M worker/src/index.ts` + `A .env.*` + `M package.json`, staged). **Não reescreva o G1 do zero nem re-deploye às cegas**: verifique o diff e complete só o que falta — **commit**, passo manual no dashboard (Pages → Preview env), opcionais (`setWebSocketAutoResponse`+`/health` → estes exigem novo `wrangler deploy`), bump `1.5.6-rc`. A **verificação ao vivo (2xx + duração caindo) só após o reset 28/06 00:00 UTC ou no Workers Paid** — não bloqueie G2→G6 por isso. Há 3 calls em §16 com **default adotado** — só pare se Julio mandar flipar: **L-CONNECT** (bilateral visível), **L-SPLIT** (split manual auto-entrega no salvar), **L-PLAN** (free vs Workers Paid US$5, default free). Leva **NOVA** — a settle-flows (DEC-364→373) já shippou `1.5.5-rc`; **não re-rode**.

## A descoberta-chave (keystone — causa REAL, diagnóstico do Julio, confiança ALTA)
O `500/1101` **não** é bug de código: é o **teto de DURAÇÃO do free tier** (13k GB-s/dia) exaurido — a Cloudflare corta as requisições a Durable Objects até o **reset diário (28/06 00:00 UTC)**. **~99% da duração veio do `ShareSignal`** (WebSocket com `server.accept()` **sem** Hibernation API → cobra o socket conectado o tempo todo, mesmo ocioso), **amplificado por dev/preview/E2E apontando para o worker de PRODUÇÃO** (`config.ts` nunca seta `VITE_SYNC_WORKER_URL`), então abas de teste seguravam sockets vivos de prod. **O app individual nunca caiu** (local-first); só a colaboração/sync. **G1 = (a) isolar ambiente (staging) + (b) migrar ShareSignal+SyncRoom para Hibernation (~95% menos duração) + (c) opcionais (peer-ping ocioso / plano US$5).** O código cliente do wave anterior (DEC-366/369) está certo — ficou invisível porque o transporte estava capado.

## Contrato de autonomia (9 regras, condensado)
1. **Sem subagent / sem Task tool / tudo inline** nesta sessão (custo é por request).
2. **Não peça permissão entre work units** depois de ACTIVE — fechar gate = commit→deploy→dev-log→próximo.
3. **Não narre o que vai fazer — faça.** Minimize prosa.
4. **Reuse o que existe** (DEC-366 `shareDebtWithPeer`/`drainMailboxIntoApp`; DEC-369/371 estados; DEC-293 carrossel) — não reinvente.
5. **Código em inglês; UI via `t()`** (pt/en/es); doc/brain em português.
6. **Domínio antes de UI**, uma mudança por vez, **teste junto**.
7. **Terminal WSL:** sempre `git --no-pager`; commit via `G=/usr/bin/git; "$G" commit -m "…"`; nunca pager/editor/`-i`.
8. **Brain em sync:** dev-log todo milestone; decision-log nas DECs; product-spec/project-status nos momentos certos.
9. **Hand-off final termina com `AskQuestion`** — só num stop genuíno (DoD toda TRUE, ou stop de credencial do G1, ou contexto acabando), nunca no meio.

## Decisões já adotadas (não re-pergunte)
- **DEC-374** isolamento de ambiente (teste→staging, $0) · **DEC-383** hibernação ShareSignal+SyncRoom (estrutural) · **DEC-384** peer-ping ocioso + plano (L-PLAN, default free) — todos **G1** · **DEC-375** status honesto (G2) · **DEC-376** conexão bilateral (G2, default visível) · **DEC-377** split manual entrega (G3, default auto-no-salvar) · **DEC-378** seleção+badge (G4) · **DEC-379** carrossel altura (G5) · **DEC-380** dedupe install + soneca (G5) · **DEC-381** deep-link modo (G5) · **DEC-382** câmera Android (G6, P2).

## ÂNCORA (cole a cada 3 milestones / em cada fronteira de gate)
```
ÂNCORA — Acerto que chega de verdade
- A aritmética do acerto é INVARIANTE (saldos idênticos ao baseline; dívida só entra no aceite).
- Nunca bloquear o registro de gasto; entrega/stamp P2P é best-effort em background.
- Pós-G1: teste nunca aponta para produção (staging via VITE_SYNC_WORKER_URL); WebSocket DOs usam Hibernation API; UI nunca mente "sem internet" online (Â-TRANSPORT/Â-HONEST).
- Conectar aparece nos DOIS lados (Â-BILATERAL). "Registrar gasto" dividido entrega igual a "Dividir conta" (Â-CONSISTENT-SPLIT).
- Hide-never-delete; t() sempre; código em inglês; reusar DEC-366/369/371, não reinventar.
CURRENT STATE: gate=<g> · last_commit=<sha> · tests=<n passing/known-base> · risks=<...> · scope=<itens>
```

## Ordem dos gates (+ versão alvo)
- **G0** baseline + reproduzir o 500 (curl) + checar `wrangler whoami`.
- **G1** TRANSPORTE/duração keystone — **R0a ✅ + R0b ✅ DEPLOYADO (Julio, CF `bfa12d49…`)**; falta **commit no git** + passo manual Preview no dashboard + opcionais (`setWebSocketAutoResponse`/`GET /health` → exigem novo deploy) + bump `1.5.6-rc`; verificação ao vivo **pós-reset**.
- **G2** conexão bilateral + status honesto → `1.6.0-rc` (HEADLINE).
- **G3** split manual entrega igual ao dividir (L-SPLIT) → `1.6.1-rc`.
- **G4** seleção não-marca-todos + badge de conectado → `1.6.2-rc`.
- **G5** carrossel altura + dedupe install + soneca + deep-link de modo → `1.6.3-rc`.
- **G6** câmera Android (P2, opcional) → `1.6.4-rc` ou deferred.

## Per-milestone (5-point) + deploy
Antes de cada commit: (1) liste AC satisfeitos; (2) cite 3 AC anteriores em risco + verifique (sempre A1/A6 invariância de saldo + A5 nunca bloquear gasto); (3) testes sem novas falhas; (4) sinalize arquivo fora de escopo; (5) atualize dev-log. **Deploy por gate:** bump `package.json` + `src/utils/app-version.ts` + `public/version.json` (+ release note pt/en/es) → `G=/usr/bin/git; "$G" commit -m "…"` + push `master` → Pages auto-build. **G1 também:** `wrangler deploy` (worker). Verifique `/version.json` + os endpoints de DO em 2xx.

## G0 — comandos exatos (rode já)
```bash
cd /home/julio/projetos/trip-budget-copilot/TripPilot
npm install
npm run test 2>&1 | tail -40
npm run build 2>&1 | tail -20
npx tsc --noEmit 2>&1 | tail -20
U="https://trippilot-sync.trippilot.workers.dev"; ID="11111111-1111-4111-8111-111111111111"
curl -s -o /dev/null -w "GET /  -> %{http_code}\n" "$U/"   # 500/1101 = capado por duração até 28/06 00:00 UTC (não é bug)
curl -s -w "GET /mailbox -> [%{http_code}]\n" "$U/mailbox/$ID"
curl -s -w "POST /share -> [%{http_code}]\n" -X POST "$U/share" -H "Content-Type: application/json" -d '{"payload":"x"}'
npx wrangler whoami 2>&1 | tail -5
npx wrangler deployments list --name trippilot-sync-staging 2>&1 | tail -5
grep -rn "VITE_SYNC_WORKER_URL" .env* playwright.config.* 2>/dev/null || echo "VITE_SYNC_WORKER_URL nao setado (R0a a corrigir)"
```
Registre baseline + curls no `src/dev-log.md`; DEC-374→384 como `PROPOSED`. Depois **execute G1→G6, sem parar até a Definition of Done (§12) estar toda TRUE** (ou o stop de credencial do G1, ou contexto acabando → feche o gate atual limpo + hand-off no dev-log).

**Confirme em UMA linha que leu o orchestrator e começou o G0 — depois continue sem esperar resposta.**
