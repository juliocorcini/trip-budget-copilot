# Orchestrator — Leva "Endurecimento: headers de segurança + conversor + admin token"

> Status: ✅ CONCLUÍDA 2026-07-03 (`2.1.4-rc` no ar — Pages `8e889c05` + worker `d36cdb89`; DEC-436→438 SHIPPED). Base de versão: `2.1.3-rc` → `2.1.4-rc` (deploy único).
> Fonte da investigação (root-cause): `brain/documents/2026-07-03-observability-security-pwa-audit.md` (Partes A.6, A.7, B).
> Método: `.cursor/skills/implementation-orchestrator/SKILL.md`. Inline, 1 sessão, sem subagents.

## §0 — Mission

Aplicar as **3 correções cirúrgicas de maior relação esforço/valor** do audit 2026-07-03, sem tocar em nada mais:

- **SEC-1** — Headers de segurança globais no `public/_headers` (anti-clickjacking + nosniff + referrer + permissions + HSTS). Hoje não existe **nenhum** header de segurança no projeto (grep vazio) → o app inteiro, incluindo as telas de convidado `/s/:id` e `/g/:id`, pode ser embutido em `<iframe>` de terceiro.
- **SEC-3** — Comparação **constante-no-tempo** do `ADMIN_TOKEN` no Worker (`handleAdmin` usa `!==`, side-channel de timing).
- **BUG-CONV** — `min-w-0` nos `<select>`/wrappers do conversor: o flex item com `min-width:auto` não encolhe e o seletor de moeda estoura o viewport.

**NÃO faz parte:** rate limit (SEC-2), logger estruturado (OBS-*), fallback de PWA (PWA-1). Ficam para levas seguintes.

## §1 — Contrato de autonomia

Executor único, inline, sem Task tool. Código em inglês; texto de UI só via `t()` (não há texto novo aqui). Terminal WSL: sempre `git --no-pager`, commit com `-m`. **Commit/deploy só com o GO explícito do Julio** — o working tree já tem a leva Field v2.1 (`2.1.3-rc`) **não commitada**, então misturar tudo num commit é decisão do dono.

## §3 — Não-negociáveis (ÂNCORA)

- **Â-NO-BREAK**: nenhuma funcionalidade viva pode quebrar. `frame-ancestors 'none'` só é seguro porque nada legítimo embute o app hoje; `Permissions-Policy` **precisa** liberar `geolocation`/`microphone`/`camera` para `self` (o app usa GPS, voz, câmera) — senão quebra recursos.
- **Â-CSP-INCREMENTAL**: começar só com `frame-ancestors`/`X-Frame-Options` (não quebra nada). **NÃO** subir uma CSP com `script-src`/`style-src` nesta leva (o app usa Tailwind/estilos inline + Google Fonts/Material Symbols → exigiria gate dedicado com testes).
- **Â-DATA-INVARIANCE**: nenhuma mudança de matemática/UX de dados. BUG-CONV é puramente layout (classes CSS).
- **Â-WORKER-MINIMAL**: SEC-3 é uma troca de comparação por uma equivalente constante-no-tempo; nenhuma rota/contrato muda.

## §6 — Root-cause map (código ↔ mudança)

| Sintoma | Root cause (arquivo → símbolo) | Direção do fix |
|---|---|---|
| Clickjacking possível | `public/_headers` só tem CORS em `/version.json` e `/bundles/*`; sem headers de segurança | Adicionar bloco `/*` com X-Frame-Options/CSP frame-ancestors/nosniff/referrer/permissions/HSTS |
| Timing side-channel no admin | `worker/src/index.ts › handleAdmin`: `token !== env.ADMIN_TOKEN` | `safeEqual()` constante-no-tempo (espelha `timingSafeEqualHex` do app-lock) |
| Seletor de moeda sai do viewport | `src/features/converter/ConverterPage.tsx › selectClass` + wrappers `.flex-1` sem `min-w-0` | `min-w-0 w-full` no select + `min-w-0` nos wrappers |

## §10 — Build (gate único G1)

- **G1.m1** — `public/_headers`: bloco `/*` de segurança (SEC-1).
- **G1.m2** — `worker/src/index.ts`: `safeEqual` + uso em `handleAdmin` (SEC-3).
- **G1.m3** — `ConverterPage.tsx`: `min-w-0`/`w-full` (BUG-CONV).
- **G1.m4** — suíte completa + `tsc --noEmit` + `build`; atualizar dev-log; DEC-436→438 PROPOSED→(APPROVED no ship).

## §8 — Testes

- Domínio puro: nada novo (as 3 mudanças são config/CSS/troca-de-compare). Manter a suíte inteira verde (baseline 2972/2972 no Node 22; os 2 `split-live-loop` dependem de Node 22).
- SEC-1: verificação **manual pós-deploy** (curl aos headers) — Cloudflare Pages `_headers` não é testável por Vitest.
- SEC-3: `safeEqual` é trivial e espelha `timingSafeEqualHex` já testado; o Worker não está no include do Vitest (sem harness). Correção verificada por leitura + `tsc`.
- BUG-CONV: verificação por build verde + smoke manual em `/converter` (viewport estreito, i18n pt/en/es, sem scroll horizontal).

## §12 — Definition of Done

- [x] `public/_headers` com bloco `/*` (frame-ancestors 'none' + nosniff + referrer + permissions self + HSTS) — **6 headers verificados ao vivo no apex**.
- [x] `handleAdmin` usa `safeEqual` — worker `d36cdb89` no ar; probes 401 sem/errado token.
- [x] Conversor com `min-w-0` (selects + wrappers).
- [x] Suíte verde (2972/2972 no Node 22), `tsc --noEmit` limpo (app+worker), `build:pages` OK.
- [x] dev-log + decision-log (DEC-436→438 SHIPPED) atualizados; sw.js → v79; release notes 2.1.4-rc pt/en/es.
- [x] Deploy: Pages `8e889c05` (conta e146e88b) + worker deploy; APK vivo preservado (8.469.341 B — `fetch-live-apk` re-rodado após o `make-ota-bundle` republicar o debug local de 17 MB).
- [ ] Commit: **aguardando decisão do Julio** — o working tree ainda tem a leva Field v2.1 (`2.1.3-rc`) não commitada junto desta.

## §13 — Anti-patterns

- ❌ Subir CSP completa (script-src/style-src) sem gate próprio (quebraria estilos/fonts).
- ❌ Esquecer de liberar geolocation/microphone/camera no Permissions-Policy (quebraria GPS/voz/câmera).
- ❌ Commitar a leva Field v2.1 alheia junto sem o dono decidir.
- ❌ Mexer em qualquer outra frente (rate limit, logger, PWA) — fora de escopo.
