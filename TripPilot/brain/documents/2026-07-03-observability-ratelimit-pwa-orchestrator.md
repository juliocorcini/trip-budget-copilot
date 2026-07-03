# Orchestrator — Mega-leva "Observabilidade + Rate Limit + PWA fallback" (todas as levas restantes do audit)

> Status: ✅ **CONCLUÍDA (2026-07-03)** — DEC-439→444 SHIPPED. `2.1.4-rc` → **`2.2.0-rc`** deployado (worker Version `85edfeed` + Pages `6d4ec69e`, apex verde, APK 8.469.341 B preservado). Suíte 2995/2995 (+23 novos). Todos os itens do §12 verificados (429 ao vivo no 21º hit em conexão reutilizada; X-Request-Id ecoado; admin CORS negado p/ origem estranha; 1 JSON/request no tail; zero console de produto; fallback de instalação ativo com guia pt/en/es).
> Fonte: `brain/documents/2026-07-03-observability-security-pwa-audit.md` — itens **SEC-2, SEC-4(resto), OBS-1, OBS-2, OBS-3(camada de negócio), OBS-4, PWA-1, PWA-2**. Julio: "fazer todas as levas de uma vez".
> Método: `.cursor/skills/implementation-orchestrator/SKILL.md`. Inline, 1 sessão, sem subagents.

## §0 — Mission

Fechar o backlog do audit numa leva única:

| Item | O quê | Sev |
|---|---|---|
| **SEC-2** | Rate limit de borda nos endpoints de IA/ingest/write (binding `ratelimits` nativo do Workers, GA) | P1 |
| **SEC-4** | CORS allowlist no `/admin/*` (o `Referrer-Policy` já saiu na leva anterior) | P2 |
| **OBS-1** | Logger estruturado JSON por runtime: `worker/src/logger.ts` + `src/utils/logger.ts` + middleware de request no worker | P1 |
| **OBS-2** | Migrar os ~22 `console.*` do app → `logger.*`; console silencioso em prod | P1 |
| **OBS-3** | Varredura dos `catch {}` na **camada de negócio** (orchestrators + boundaries de IA + mailbox/p2p) | P2 |
| **OBS-4** | `X-Request-Id` ponta a ponta (app → worker → app) | P2 |
| **PWA-1/2** | Fallback de instalação **ativo** (botão que tenta instalar e, se não der, abre passo-a-passo por navegador) | P1 |

**Fora de escopo (deliberado, com justificativa):** OBS-5/OpenTelemetry (audit D.11: infra que o projeto evita; Workers Logs + logger já entregam 90%); varredura dos catch em transporte best-effort (`peer-ping`/`share-signal`/`media-link`/`connection`/`session` — retry loops, viraria ruído; passe futuro); CSP completa (Â-CSP-INCREMENTAL da leva anterior); WAF rules de dashboard (o binding nativo cobre e fica versionado no código).

## §3 — Não-negociáveis (ÂNCORA)

- **Â-NO-PII-LOGS**: log NUNCA carrega `text`, `imageDataUrl`, `audioBase64`, `blob`, `key`, `writeToken`, `token`, `authorization`, `pin`, valores/itens/saldos/nomes de participantes. Denylist automática no logger + `scrubErrorMessage` (dígitos 4+ → `#`) em toda string. Path de share nos logs do worker vira **template** (`/share/:id`) — o id-capability não vai para log.
- **Â-SWALLOW-BUT-LOG**: a UX "nunca estoura para o usuário" fica INTACTA — todo catch continua engolindo; a mudança é **registrar antes de engolir** (warn/error). Guardas triviais e contratos null (ex.: `decryptText`→null, `safeJsonParse`→null) continuam mudos.
- **Â-TELEMETRY-NO-LOOP**: `utils/telemetry.ts` e `utils/error-report.ts` continuam 100% silenciosos — logar erro do próprio pipeline de erro cria loop.
- **Â-RL-FAIL-OPEN**: rate limiter indisponível (binding ausente/erro) → **allow**. Rate limit nunca derruba um usuário legítimo por falha da infra. Leituras (GET share/statement/responses/img, drain de mailbox, WS) ficam **sem limite** — o live split pooling não pode quebrar.
- **Â-CRASH-BUFFER-SANE**: só `error`/`fatal` gravam no crash buffer (10 entradas); `warn` é dev-only. ErrorBoundary NÃO loga em duplicidade (já tem `recordCrash` próprio).
- **Â-DATA-INVARIANCE**: zero mudança de matemática/contratos de dados. Tudo aqui é logging, headers, limite de borda e UI de instalação.

## §6 — Root-cause map

| Sintoma (audit) | Root cause | Fix |
|---|---|---|
| Abuso de custo/cota grátis (Groq RPD, DO duration) | Nenhum limite por chamador nos endpoints públicos | Binding `ratelimits` (3 classes: AI 20/min, ingest 30/min, writes 60/min), chave = `installId \|\| CF-Connecting-IP` |
| `/admin` herda CORS `*` | `CORS_HEADERS` global | `withAdminCors` — echo só de origem allowlisted + `Vary: Origin` |
| Worker cego (1 console em 2.185 linhas) | Sem logger/middleware | `logger.ts` + wrap do `fetch` com requestId/rota-template/status/duração |
| 237 catch mudos / 25 console soltos | Sem logger central | `utils/logger.ts` (browser) + migração + varredura da camada de negócio |
| Impossível rastrear ponta a ponta | Nenhum id comum | `X-Request-Id` gerado no `aiRequestHeaders()`, ecoado pelo worker, logado nos dois lados |
| "Adicionar à tela inicial" morto quando `beforeinstallprompt` não veio | Fallback é `<div>` estático | Botão: tenta `install()`; se `unavailable` → passo-a-passo por navegador (`manualInstallStepKeys`, dado-puro + i18n) |

## §10 — Gates

- **G1 (worker)**: `wrangler.jsonc` ratelimits + `worker/src/logger.ts` + middleware/requestId + `edgeRateLimited` nas rotas + `withAdminCors`. `tsc` worker limpo.
- **G2 (app obs)**: `src/utils/logger.ts` (núcleo puro testável `buildLogEntry`) + migração dos console.* + requestId no `aiRequestHeaders()` + warn nos boundaries de IA.
- **G3 (catch sweep negócio)**: share-link/p2p/mailbox orchestrators + parse-failures dos 4 boundaries de IA.
- **G4 (PWA)**: `manualInstallStepKeys` puro + `InstallOptions` fallback ativo + i18n pt/en/es.
- **G5 (qualidade)**: testes novos (logger, install guide) + suíte inteira + `tsc` + `build:pages`.
- **G6 (ship)**: bump `2.2.0-rc`, sw v80, release notes, deploy worker+Pages (conta **e146e88b**; re-rodar `fetch-live-apk` DEPOIS do bundle — landmine do APK 17 MB), probes ao vivo (429 no 21º hit, X-Request-Id ecoado, admin CORS negado p/ origem estranha).
- **G7 (brain)**: DEC-439→444, dev-log, audit atualizado.

## §12 — Definition of Done

- [x] 21 POSTs seguidos em `/assistant` → o excedente responde **429** com `aiUnavailable`/`retryAfterSec` (shape que o cliente já entende). *(Verificado ao vivo: 30 hits numa conexão reutilizada → 20×400 + 10×429 `assistant_rate_limited`. Nota: counters por-colo — bursts por conexões novas espalham entre colos.)*
- [x] `GET /admin/overview` com `Origin: https://evil.example` → resposta **sem** `Access-Control-Allow-Origin` (+`Vary: Origin`); com `Origin: https://trippilot.pages.dev` → echo.
- [x] Toda request não-OPTIONS do worker gera 1 log JSON com `requestId/route(template)/status/durationMs` (visto no `wrangler tail`; `/health` só loga falha).
- [x] `X-Request-Id` enviado pelo app volta no header da resposta e aparece nos logs dos dois lados (`probe-mega-leva-0001` ecoado).
- [x] Zero `console.*` de produto no app fora de `utils/logger.ts` (testes e `public/sw.js` ficam) — `rg` limpo.
- [x] Catches de negócio logam `warn` com `err` antes de engolir; telemetria/error-report seguem mudos (Â-TELEMETRY-NO-LOOP).
- [x] Fallback de instalação clicável: tenta instalar; senão abre passos por navegador (Chrome/Edge/Samsung/Firefox/desktop/genérico) em pt/en/es (8 testes garantem toda chave i18n nas 3 línguas).
- [x] Suíte verde no Node 22 (**2995/2995**, +23 novos) + `tsc` app/worker limpos + build/OTA OK + deploy verificado (APK **8.469.341 B** preservado).

## §13 — Anti-patterns

- ❌ Rate limit em GET de share/statement/responses ou WS (mata o live split).
- ❌ Logar body/text/imagem/token/path com capability id cru.
- ❌ `logger.error` dentro de telemetry/error-report (loop).
- ❌ recordCrash em `warn` (estoura o buffer de 10 e o `isCrashLooping`).
- ❌ Prometer instalação programática sem `beforeinstallprompt` (teto da plataforma — o fallback é guiar, não fingir).
- ❌ Commitar sem decisão do Julio (tree ainda tem Field v2.1 + leva anterior não commitadas).
