# Kickoff — Mega-leva "Links que se apresentam + Números que batem + Acerto sem atrito"

> Cole esta mensagem numa sessão para executar a leva de ponta a ponta. O doc está **ACTIVE**; todos os locks do §16 foram resolvidos pelo Julio em 2026-07-03 — **nenhuma pergunta pendente**. Execute G0→G7 sem parar.

---

Você é um engenheiro sênior full-stack aplicando, sozinho e nesta única sessão, a mega-leva "Links + Números + Acerto" do TripPilot, de ponta a ponta.

**Fonte da verdade:** `TripPilot/brain/documents/2026-07-03-links-numbers-settle-orchestrator.md`. Leia §0–§9 UMA vez, depois execute §10 (G0→G7) na ordem. Não releia o brain inteiro por milestone. Estado vivo: `TripPilot/src/dev-log.md`.

**Estado da leva:** doc ACTIVE; locks resolvidos (mega-leva única · preview rico DEFAULT-ON com kill-switch · slug no caminho com chave no fragmento · lente de números investigação-primeiro · mover dívida IMEDIATO sem aceite). DEC-445→451 devem estar PROPOSED no `decision-log.md` (se faltarem, crie no G0). **Antes de tudo: confira `git --no-pager log --oneline -5` + dev-log — se a leva já tiver gates shippados, continue do gate seguinte; NUNCA re-execute gate concluído.**

**Contrato de autonomia (absoluto):**
1. Sem subagents/Task tool — tudo inline nesta sessão (councils novos = seções de UMA resposta).
2. Não pedir permissão entre milestones/gates; fechar gate = commit → deploy → dev-log → próximo.
3. Não narrar — fazer. Prosa mínima.
4. Reusar o que existe (§4 baseline); domínio puro antes de UI; teste junto com a mudança.
5. Código/commits/identificadores em inglês; UI via `t()` pt-BR/en/es; brain em pt-BR.
6. 5-point self-check antes de cada commit; ANCHOR block a cada 3 milestones e em toda fronteira de gate.
7. Fork conceitual novo → council inline na hora → `DEC-NNN (PROPOSED)` → continuar.
8. Suíte verde entre gates (Node 22: `nvm use 22`); `tsc --noEmit` app E worker limpos.
9. Stop legítimo só com §12 DoD todo TRUE, blocker de credencial/custo, ou fim real de contexto (feche o gate atual limpo + hand-off no dev-log). O hand-off final termina com AskQuestion.

**ÂNCORA (colar a cada 3 milestones / fronteira de gate):**
```
Â-KEY-IN-FRAGMENT — chave AES só no #k=; nunca em slug/preview/log/query.
Â-PREVIEW-SUMMARY-ONLY — preview ≤1KB: título/descrição/total/moeda/nº pessoas/updatedAt/imgId; NUNCA itens, nomes por item, chave, writeToken.
Â-OLD-LINKS-LIVE — link antigo por id cru abre para sempre; slug é camada nova.
Â-NUMBERS-EVIDENCE-FIRST — rótulo/explicação livre; matemática só com veredito do G2 + teste de invariância.
Â-MOVE-VISIBLE-BOTH-SIDES — mover dívida: imediato mas NUNCA silencioso; proveniência+histórico nos 2 aparelhos; undo propaga.
Â-WORKER-GUARDS-KEPT — rate-limit/CORS/logger/headers (DEC-436→444) intocados; rotas novas com logEvent; leituras sem rate limit.
+ herdados: cents inteiros; domínio TS puro; t() sempre; hide-never-delete; nunca bloquear registro de gasto.
CURRENT STATE: gate _ · commit _ · testes _/_ · riscos _ · escopo do próximo milestone _
```

**Gates (ordem e versões):**
- G0 — baseline (Node 22, suíte+build+tsc app/worker, dev-log seed, DECs PROPOSED, pipeline conta Pages **e146e88b**).
- G1 `2.2.1-rc` — filtro de fase na lista (default fase atual) + passo de tema no onboarding + notificação direcional "aguardando aceite de {nome}".
- G2 — investigação dos números com fixture do caso real (628/602/345/734/873/884) → §6-A addendum + veredito por número. SEM deploy.
- G3 `2.2.2-rc` — `PhaseSpendLens` + explainers que somam nas telas + só as correções com veredito.
- G4 — worker: preview blob + slug (create/put/revoke/GET `/preview/:idOrSlug`, resolve slug) + client compõe preview/slug + toggle Settings (default ON). `wrangler deploy`.
- G5 `2.2.3-rc` — OG estático global + Pages Function `functions/[[path]].ts` injetando OG por share + probe com crawler real (curl UA WhatsApp/facebookexternalhit + colar no WhatsApp). Se a Function não interceptar a rota SPA: degradar para OG estático, registrar follow-up, NÃO shippar quebrado.
- G6 `2.3.0-rc` — `debt_move` no mailbox: mover para conectado imediato + proveniência nos 2 lados + undo propagado + i18n.
- G7 — brain sync final (decision-log banner, product-spec, project-status, README) + commit.

**Terminal (WSL — crítico):** `git --no-pager` SEMPRE; commit multi-linha = escrever `/tmp/msg.txt` e `sh -c 'git commit -F /tmp/msg.txt'` (o harness injeta `--trailer`; o git 2.25.1 local rejeita; o subshell contorna — confirmado). Nunca pager/editor/`-i`. Deploy Pages na conta **e146e88b** (pessoal); re-rodar `fetch-live-apk.mjs` DEPOIS do bundle (landmine do APK debug 17 MB); APK final = 8.469.341 B.

**G0 — comandos exatos:**
```bash
cd /home/julio/projetos/trip-budget-copilot/TripPilot
export NVM_DIR="$HOME/.nvm" && . "$NVM_DIR/nvm.sh" && nvm use 22
npm install && npm run test 2>&1 | tail -5 && npx tsc --noEmit && (cd worker && npx tsc --noEmit)
```

Confirme em UMA linha que leu o orquestrador e iniciou o G0 — e siga sem esperar resposta, até o §12 estar todo TRUE.
