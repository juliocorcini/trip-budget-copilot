# Prompt de kickoff — Leva UI/UX TripPilot

> Cole **todo o bloco abaixo** (entre as linhas `=====`) num chat novo deste mesmo projeto. Ele manda o agente
> implementar a leva de ponta a ponta, sem perguntar nada. O orquestrador é a fonte de verdade; este prompt só dá o
> empurrão e o contrato.

=====

Você é o **agente executor** da leva de UI/UX do TripPilot. Sua missão: **implementar de ponta a ponta** as mudanças
já decididas, **sem me perguntar nada**, entregando tudo o que foi combinado, com qualidade alta.

## Fonte de verdade — leia primeiro, nesta ordem
1. `TripPilot/brain/documents/2026-06-24-ui-ux-implementation-orchestrator.md` — **o orquestrador desta leva**
   (Status ACTIVE; §16 lockada; DEC-285→294; gates **G1→G7** ratificados pelo **Council C5**). É a sua verdade de
   execução — siga à risca: §0 missão · §1 regras · §3 não-negociáveis · §4 baseline · §6 **root-cause map (arquivo→
   símbolo)** · §9 protocolo (loop, checkpoints, ÂNCORA) · §10 **os 7 gates com AC/testes/commit** · §12 definição de
   pronto · §13 anti-padrões · §15 matriz manual.
2. `TripPilot/brain/documents/ui-ux-change-checklist-2026-06-23.md` — escopo dos itens (M-NN) + a validação no fim.
3. Brain do TripPilot: `TripPilot/brain/decision-log.md`, `technical-direction.md`, `project-status.md`, e o
   `TripPilot/src/dev-log.md`.

## Contrato de autonomia (inegociável)
- **Não me pergunte nada para avançar.** Ambiguidade real → rode um **council inline** (1 request, **sem subagents /
  sem Task tool** — regra do projeto), registre `DEC-NNN` PROPOSED no `decision-log.md` e **siga**.
- **Não pare ao fim de um gate** — commit, deploy, dev-log e vá para o próximo. Só pare quando a **§12 inteira for
  TRUE** (ou num bloqueio real de ambiente/credencial — e, mesmo assim, faça o equivalente local, marque ⏳ no
  dev-log e continue).
- Trabalhe **numa sessão só**, contínua, sem interromper o meio. (No fechamento final você pode oferecer próximos
  passos.)
- **Código em inglês** (nomes, comentários, mensagens de commit); **UI em pt-BR via `t()`**. Lógica de negócio =
  **TS puro** em `src/domain/`; dinheiro em **centavos**.
- **Esconder/rebaixar ≠ deletar (Â9): nada some.** **Nunca bloquear o registro de gasto.** Preserve o que já é bom —
  esta é uma leva de ajuste, não um rebuild.

## Setup, build e deploy (rode de dentro de `TripPilot/`)
- Verde **antes de tocar em nada**: `npm run typecheck && npm run test && npm run build`. E2E quando tocar fluxo:
  `npm run test:e2e`.
- **Por milestone:** domínio → UI → teste de não-regressão → tudo verde → **1 commit** → entrada no
  `src/dev-log.md`. Self-check de 5 pontos antes de cada commit (§9).
- **Por gate:** testes do gate + smoke verdes → **deploy**: `npm run build:pages`, bump `public/version.json` +
  `package.json`, commit scoped, push `master` (Cloudflare Pages faz o build) → brain sync (§14) → **Context
  Refresh** (re-ler §3 + o próximo gate + dev-log; re-emitir a ÂNCORA do §9).
- **Git seguro (WSL):** sempre `git --no-pager …`; `git commit -m`/HEREDOC; **nunca** `-i`/`less`/editor interativo;
  nunca `--amend` em commit já enviado.

## A ordem (Council C5) — gate a gate
**G0** setup (registrar DEC-285→294 PROPOSED + semear dev-log) → **G1** fundações a11y/legibilidade (M01 foco
visível, M02 contraste AA/branco no CTA, M11 `aria-current`, M12 tokenizar IA, M19 sem `transition-all`) → **G2**
consolidar a viagem **M15** (share card → header do Hub; `/trip`→`/viagem`; apagar `TripOverviewPage`; repointar
tudo) → **G3** **onboarding multi-espaço** no Welcome (2 escolhas primárias viagem×dia-a-dia reusando o fork do
`NewSpacePage`; rebaixar backup/receber/demo no próprio Welcome; M20 demo legível + M23 linha de valor — DEC-290) →
**G4** primeiro minuto/Dashboard (topo como **carrossel** que não remove nada — M03/M10/DEC-293; M04 promover o
"livre" + atalho; M06 "€0" que orienta; M09 chip de modo; M05 glossário por toque) → **G5** voz & momentos
(reescrever a voz do **Amigo Sincero** e fazer os 3 tons diferirem de verdade — M16b/DEC-291; **recap leve**
reusando `OutingReviewPage` — M17-lite/DEC-292) → **G6** ferramentas/polish (M13 Planner tags/cadeado, M22 "Modo:
manual", M21 Conversor p/ moeda de casa, M24 selo offline, M25 microcópia do Comparador) → **G7** divisão (M18
"recebe/deve" sempre legível **+ selo "tudo acertado"** — DEC-294).

## Comece agora
Leia o orquestrador inteiro, deixe o baseline verde, semeie o `src/dev-log.md`, registre **DEC-285→294** e execute
**G1 até G7** até a **§12** ser toda TRUE — commitando por milestone e deployando por gate, mantendo o brain em
sincronia. Não pare. Aplique.

=====
