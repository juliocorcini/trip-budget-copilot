# TripPilot — Orquestrador de Implementação "Descoberta & Clareza" (a única fonte de verdade de execução desta leva)

> **Última atualização:** 2026-06-25 · **App:** 1.0.1-rc → 1.0.2-rc..1.0.6-rc por gate; **1.1.0-rc** quando o hub de descoberta (G3) entrar
> **Status:** ✅ **ACTIVE — recomendações dos councils ADOTADAS** (Julio pediu "continuar até testes e deploy completo" e dispensou o lock formal em 2026-06-25; as recomendações da §16 viram o caminho de execução — ajustes pontuais, ex. Q5/Q3, podem vir depois; tudo reversível e registrado). Os 10 conselhos foram rodados
> **inline** (1 request, sem subagents — §7) e destilados em **DEC-307→DEC-316 (PROPOSED)** + 3 decisões diretas
> **DEC-317→DEC-319**. Diferente da leva "Coerência & Tricount" (que já entrou ACTIVE com a §16 lockada), **esta leva tem
> decisões conceituais e de arquitetura de produto** que o próprio briefing do Julio mandou **"passar pelo conselho antes de
> codar"** (briefing §16). Então: **G1 e G2 (P0 sem dúvida conceitual) já são executáveis**; **G3, G4 e G5 dependem do lock da
> §16.** Quando o Julio lockar (ou aprovar as recomendações em bloco), o doc vira **ACTIVE** e um agente o implementa de ponta
> a ponta — sem perguntar nada (ambiguidade NOVA → council inline + `DEC-NNN` + segue).
>
> **Irmão de** `documents/2026-06-24-coherence-implementation-orchestrator.md` (a leva anterior, mesmo padrão), de
> `documents/2026-06-24-ui-ux-implementation-orchestrator.md` e do `implementation-prompt.md` (build original, Tier-3).
> Aqueles construíram/consertaram/alinharam o app; **este resolve um problema diferente: o app já tem MUITA função boa, mas o
> usuário comum pode não descobrir, não achar, ou confundir funções parecidas.** A leva é sobre **descoberta, clareza de
> fluxos e correção de conceitos** — não sobre adicionar features novas grandes.
>
> **Fonte desta leva:** o segundo briefing de revisão do Julio (2026-06-25, 9 temas + 16 pontos + 3 níveis de prioridade +
> 10 decisões abertas), destilado aqui em **gates testáveis com critérios de aceite (AC)** e num **root-cause map (código ↔
> mudança)** (§6) que aponta arquivo e símbolo exatos — a investigação já foi feita (este doc é o resultado dela).
>
> **Como ler o resto:** o brain é a verdade de *produto* (`product-spec.md`, `decision-log.md`, `technical-direction.md`).
> **Este documento é a verdade de *execução*:** a ordem, o diagnóstico, a mudança, os testes, os deploys, os commits.

---

## 0. Missão (leia primeiro)

Você é um engenheiro full-stack sênior **aplicando a leva "Descoberta & Clareza" do TripPilot de ponta a ponta, sozinho,
nesta sessão**. O app **já existe, está testado e no ar** (1.0.1-rc, com o Tricount/divisão de grupo já entregue). Seu
trabalho **não** é reconstruir nem inflar nada: é

1. **Tornar as funções descobríveis** — o usuário precisa responder "o que eu consigo fazer aqui?", "qual função resolve meu
   problema?", "onde fica isso?" **sem adivinhar** e **sem saber o nome técnico** da função;
2. **Atualizar a referência oficial** — "Tudo que dá para fazer" (guide) e "Central de ajuda" (help) precisam refletir o
   **estado real** do produto (toda função criada recentemente, organizadas por **intenção** do usuário, não por nome técnico);
3. **Desfazer confusões de modelo mental** — "Dividir conta" (por itens) × "Divisão em grupo" (valor entre pessoas, tipo
   Tricount); "evento com data" × "pote/fundo de fase"; **insight factual** × **frase do Amigo Sincero**;
4. **Explicar o dinheiro com honestidade** — para onde vai a economia do dia, quando o cofrinho é usado, quando os próximos
   dias mudam — **sem mudar a matemática** (ela já está correta — §7 C-F), só a **clareza**;
5. **Corrigir comportamentos que parecem bug** — o FAB que continua aberto ao trocar de aba; o pote de fase futura poluindo a
   fase atual.

Tudo isso **preservando o que já funciona e já está bonito**, em ordem de risco (comportamento barato/global → conteúdo de
ajuda → descoberta/navegação → clareza do dinheiro → potes por fase), **sem parar entre unidades de trabalho**.

**Lembrete de uma linha do que é o TripPilot:** um copiloto de orçamento de viagem (e "Dia a dia"), local-first
(Dexie/IndexedDB), com captura de gastos (manual/IA/OCR), fases, fundos/potes, divisão de conta, divisão de grupo (Tricount),
simulador, conversor, comparador, cofrinho, e um Copiloto de insights com a voz "Amigo Sincero". Tom caloroso e anti-culpa.

**A dor central, nas palavras do Julio (normalizadas):**

> "O app tem muita função boa, mas agora tem risco real do usuário **não entender tudo que pode fazer**, **onde** está cada
> função e **qual** usar em cada situação. 'Tudo que dá para fazer' e a 'Central de ajuda' provavelmente estão desatualizadas
> e escondidas nas configurações. 'Dividir conta' e 'Divisão em grupo' parecem a mesma coisa. O Amigo Sincero está mostrando
> insight comum no lugar de frase de Amigo Sincero. O FAB fica aberto quando troco de aba. E criei um pote de hospedagem da
> Eurotrip e ele apareceu na fase atual de Burgos, como se fosse um evento com data."

**Vá para §17 para começar.** Tudo entre aqui e lá é o contrato sob o qual você executa.

---

## 1. Identidade & regras absolutas (contrato de autonomia)

Você é o **executor**, não um coordenador. Você implementa, testa, faz deploy e commita você mesmo.

**REGRAS ABSOLUTAS — nunca violar** (espelham `.cursor/rules/inline-council-no-subagents.mdc`,
`tech-lead-delegation.mdc`, `execution-style.mdc`, `phase-delivery-hardening.mdc`, `velocity-standard.mdc`):

1. **SEM subagents / SEM Task tool / SEM delegação.** Tudo inline, nesta sessão. Múltiplas perspectivas = múltiplas
   *seções de uma resposta*, nunca múltiplos agentes. (Custo = por request; um subagent = +1 request.)
2. **NÃO peça permissão para avançar entre unidades de trabalho** *depois que a §16 estiver lockada*. Terminar uma
   milestone/gate é a deixa para **commitar, fazer deploy, atualizar o dev-log e começar a próxima** — não para parar.
   *(Exceção de hand-off — `always-end-with-askquestion.mdc` + `never-end-chat.mdc`:* nunca pause **no meio** do build, mas
   no **hand-off genuíno** — todos os critérios de §12 TRUE, **ou** bloqueador intransponível, **ou** o contexto realmente
   acabar — a **mensagem final termina com um `AskQuestion`**.)
3. **GATE DE DECISÃO DESTA LEVA (diferente da anterior):** a §16 tem **10 decisões abertas conceituais/de arquitetura**. O
   briefing do Julio é explícito: *"Tudo que envolver dúvida conceitual ou mudança de arquitetura de produto deve ser passado
   pelo conselho antes de codar."* Os councils já rodaram (§7) com recomendação para cada uma. **Não code G3/G4/G5 sem o
   Julio ter lockado a §16** (ou aprovado as recomendações em bloco). **G1 e G2 não dependem de lock** (são diretrizes claras
   do briefing — Amigo Sincero, fechar FAB, atualizar ajuda) e podem rodar imediatamente.
4. **NÃO resuma o que vai fazer — FAÇA.** Minimize narração; cada token conta numa sessão longa.
5. **Todo código, identificadores, comentários, mensagens de commit, nomes de arquivo → inglês.** Texto de UI → pt-BR via
   i18n (`t()` sempre, zero hardcode), com en/es quando o item tiver cópia nova. Este documento e o brain são em português.
6. **Domínio antes de UI**, uma mudança por vez, **teste junto com a mudança** (§8).
7. **Reuse o código existente — nunca reinvente** o que a §4/§6 dizem que já existe (a maior parte desta leva é *expor,
   organizar e explicar* peças que já existem — `searchHelp`, `GUIDE_SECTIONS`, `HELP_ARTICLES`, `buildPiggyLedger`,
   `buildDashboardInsights`, `selectActivePhasePool`, `group-split/*`).
8. **Respeite a segurança de pager do WSL** (§11): sempre `git --no-pager …`, sempre `git commit -m`, nunca abra
   `less`/`vim`/flags interativas no terminal do agente.
9. **Mantenha o brain em sincronia** (§14): `src/dev-log.md` a cada milestone, `decision-log.md` em qualquer decisão nova,
   `project-status.md` no fim da leva.

Se aparecer ambiguidade genuína que o brain + §16 não resolvem: **rode o council inline na hora** (1 request, sem subagents),
pegue a síntese, **escreva como `DEC-NNN` (PROPOSED)** no `decision-log.md` **e continue**.

---

## 2. Ordem de leitura (carregue o contexto uma vez, depois execute)

No **início da leva**, leia (nesta ordem):

1. **Este documento** §0–§9, depois o gate em que está em §10.
2. `src/dev-log.md` — o estado de execução (semeado em G0).
3. `brain/decision-log.md` — só os `DEC-NNN` citados pelo gate (esp. **DEC-278** help center, **DEC-279/261** cofrinho,
   **DEC-289** "livre hoje"/atalho, **DEC-093/236/264/301** Amigo Sincero, **DEC-256/283/284/226** FAB,
   **DEC-219→225** modelo Trecho/Pote/Evento, **DEC-297/306** Tricount/bridge, e os **novos DEC-307→DEC-319** desta leva — §7).
4. `brain/product-spec.md` — entidades (Phase, BudgetPool/scope, Session/Transaction, GroupSplitEvent) e regras.
5. `brain/documents/2026-06-24-coherence-implementation-orchestrator.md` — o padrão/voz dos gates e o dicionário de estados (DEC-304).

Não releia o brain inteiro por milestone. **Mas leia o arquivo citado no §6 ANTES de editá-lo** (símbolos podem ter mudado).

---

## 3. Não-negociáveis (releia antes de CADA gate)

Invariantes desta leva. Quebrar um é defeito mesmo que os testes passem.

**Herdados do app (ÂNCORA — continuam absolutos):**

- **Dinheiro = inteiro em centavos** (DEC-020). **Domínio = TS puro, zero import de React**; nenhuma lógica de negócio dentro de componente.
- **Texto de UI sempre via `t()`** (DEC-054), três idiomas quando o item tiver cópia.
- **ÂNCORA 9: esconder, nunca deletar** — nenhuma ação/feature some; no máximo muda de lugar/hierarquia.
- **ÂNCORA 11: invariância de dados** — recálculos puros (cofrinho/free-budget) recomputam para frente; nada novo é
  persistido sem migração Dexie justificada. **A matemática do cofrinho NÃO muda nesta leva** (§7 C-F) — só a clareza.
- **Nunca bloquear o registro de gasto** (DEC-053). **Honestidade da matemática** — preservar.
- **Sistema de movimento** (60fps, `prefers-reduced-motion`), **tokens de tema**, `tabular-nums`, nav "glass", sem scrollbar
  visível (DEC C03) — preservar. **Foco de input sutil** (DEC-305) — preservar.
- **Dicionário de estados** (DEC-304): real/planejado/alocado/livre/simulado/guardado/saída/item/acerto têm rótulo e cor
  consistentes — qualquer cópia nova desta leva **obedece** o dicionário.

**Novos, derivados desta leva (a regra geral do briefing):**

- **Descobrível sem adivinhar.** Toda função de primeira classe é alcançável a partir de uma **entrada visível** (não só por
  quem sabe o caminho). O usuário acha pela **intenção** ("quero dividir um valor com o grupo"), não pelo nome técnico.
- **Ajuda = espelho do produto.** "Tudo que dá para fazer" e "Central de ajuda" cobrem **todas** as funções de primeira
  classe. **Regra permanente:** função nova criada ⇒ entra no `guide-catalog` **e** no `help-catalog` na mesma leva (DEC-319).
- **Uma intenção, uma porta clara.** Quando duas funções parecem a mesma coisa (Dividir conta × Divisão em grupo; evento ×
  pote), o app **explica a diferença ANTES** de o usuário escolher, com uma porta única que roteia.
- **Amigo Sincero ≠ Insight.** O carrossel do Amigo Sincero só tem **frases opinativas com personalidade**. Todo dado
  objetivo (cofrinho rendeu X, dá pra gastar Y/dia, categoria Z = N%) é **insight** e mora no **carrossel de insights**.
- **Um destino por economia.** A economia do dia tem **um** destino mostrado (o cofrinho, quando ativo) — nunca "vai pros
  próximos dias" **e** "vai pro cofrinho" ao mesmo tempo (sem contagem dupla).
- **Pote ≠ evento; fase do pote manda na visibilidade.** Um pote/fundo pertence a uma **fase**; não aparece em destaque na
  home de **outra** fase, mas continua **selecionável** para lançar gasto a qualquer momento. Evento tem data/countdown; pote não.
- **Sem comportamento-que-parece-bug.** O FAB aberto nunca sobrevive a uma troca de contexto (aba/card/tela).

---

## 4. Baseline — o que JÁ existe e funciona (NÃO reinvente)

Mapa do que o app já tem (confirmado por leitura de código nesta investigação). A leva é, em grande parte, **expor,
organizar e explicar** estas peças:

**Descoberta / ajuda (o coração dos P0 #1–#2):**

- `src/domain/guide/guide-catalog.ts` → **`GUIDE_SECTIONS`** ("Tudo que dá para fazer", DEC G7): data-driven, seções
  `daily/planning/trip/people/copilot/settings`, cada entry com `route`. Um teste garante que as rotas existem.
  **GAP confirmado:** a seção `people` só tem `split` (`/split/scan`) e `shared` (`/shared`) — **falta `group_split`
  (`/groups`)** e não há entradas explícitas de IA/foto que o help tem.
- `src/domain/help/help-catalog.ts` → **`HELP_ARTICLES`** (Central de ajuda, DEC-278, 100% local/0-token): mais completo —
  **já tem `group_split` (`/groups`)**, `piggy`, `checkin`, `funds`, `log_ai`, `log_photo`. Tem **`searchHelp(query)`** —
  uma **busca local por sinônimos multilíngue, sem IA** (já normaliza acento, pontua por token). Há um teste de cobertura
  ("collectively the routes cover the whole feature guide").
- **Inconsistência-chave:** o **help está mais atualizado que o guide**. Reuse o help como referência ao re-auditar o guide.
- `src/features/settings/SettingsPage.tsx` → hoje guia + central de ajuda vivem aqui (escondidos), já em `grid grid-cols-2` (C16/DEC).

**FAB / navegação (P0 #4, P1 #4):**

- `src/components/FAB.tsx` → **`GROUPED_ACTIONS`** (grupos `capture`/`plan`/`other`), `HERO_EXPENSE` + AI hero na base,
  `renderSplitBill` → **"Dividir conta"** (`/split/scan`). **"Registrar mercado"** é chip **visível** no grupo `plan`
  (l.85-97, promovido pelo Julio 2026-06-22). **Não há "Divisão em grupo" (`/groups`)** no FAB. `visibleInMode` já esconde
  os `advanced` no modo simples.
- `src/components/BottomNav.tsx` → **`isFabOpen`** (l.41). `registerOverlayDismiss(()=>setIsFabOpen(false))` trata só o
  back-gesture (l.61-63). O **onClick das abas** (l.70-74) faz `navigate(item.path)` **sem** `setIsFabOpen(false)`; quando
  aberto a nav vira `z-[60]` (acima do scrim z-50), então clicar numa aba navega **e o FAB continua aberto**. → causa-raiz #9.

**Dividir conta × Divisão em grupo (P0/P1 #3–#5):**

- `src/features/split/*` (`/split/scan`) → **divisão de conta por itens** (uma conta/um momento, ao vivo). `useActiveSplit`.
- `src/features/group-split/GroupSplitListPage.tsx` (`/groups`) + `domain/group-split/*` → **divisão de grupo (Tricount,
  DEC-297)**: evento persistente, várias despesas/pagadores, link público `/g/`, divisão igual/personalizada. Tela com
  "Novo grupo" + lista.
- `src/features/shared/SharedExpensesPage.tsx` → "Acerto de contas": tem um **botão de entrada para `/groups`** (l.521-539)
  **e** uma seção read-only **"Em divisões de grupo"** (l.590+, DEC-306). Dois pontos de "grupo" na mesma tela → confusão #5.

**Amigo Sincero × Insights (P0 #3):**

- `src/domain/budget/honest-friend-extras.ts` → **`buildHonestFriendExtras`** injeta extras **factuais** como slides do card:
  `piggy_movement`, `phase_progress`, `daily_left`, `top_category`, `receivable`. `filterHomeAmigoExtras` já faz de-dupe vs
  insights na home. `src/features/dashboard/cards/AmigoSinceroCard.tsx` renderiza (verdict + extras).
- `src/features/dashboard/useDashboardModel.ts` → monta `insights` (l.355, via `buildDashboardInsights`, cap 6 — field-feedback)
  e `amigoExtras` (l.633). `src/features/dashboard/DashboardCards.tsx` → carrossel de insights + Amigo Sincero.
- **O verdict/voz (frases opinativas) vive em** `src/domain/budget/honest-friend*.ts` (tons) — **esse** é o Amigo Sincero
  legítimo; os `extras` factuais são insights disfarçados.

**Cofrinho / check-in / "de onde vem" (P0 #5):**

- `src/domain/budget/piggy-ledger.ts` → **`buildPiggyLedger`** (Model B, DEC-279/261): `bal_d = max(0, bal_{d-1} + dailyIdeal
  − spent_d)`. **Gasto abaixo do dia deposita no cofrinho; gasto acima saca do cofrinho; o que o cofrinho não cobre
  (`uncovered`) corta os dias seguintes.** ⇒ **é exatamente a regra que o usuário descreveu** (briefing #12). Puro, nada
  persistido. **NÃO mudar.**
- `src/features/dashboard/DashboardCards.tsx` → case `daily_checkin` (l.363-544): mostra `checkin_redistribute` ("vai pros
  próximos dias", l.512) **e** dá foco ao `piggy_bank` (l.532) **ao mesmo tempo** → a contagem-dupla #11/#14.
- `onOpenHeroBreakdown` (l.730) + `src/components/Breakdown.tsx` + sheet em `DashboardSheets.tsx` → o **"De onde vem?"** (#13).
- `src/features/dashboard/AskToSpendShortcut.tsx` → o **"Posso gastar um valor"**, montado no hero (`DashboardCards` l.885,
  DEC-289/M04) → abre o simulador com o valor livre (#10).

**Potes/fundos × eventos (P0 #6, P2):**

- `src/features/funds/FundsPage.tsx` → **`createEnvelope`** com **`scope: 'linked_phases' | 'global'`** (l.150/182) — o pool
  **já pode ser ligado a fases** específicas (com `floorCents` por fase). O conceito de "pote por fase" **já existe** no dado.
- `src/domain/phases/allowance-map.ts` (`indexPlanByDay`) + `src/features/dashboard/cards/OccasionCounter.tsx` → **evento com
  data** (reserva distribuída por dia + countdown "faltam X dias"). `selectActivePhasePool(pools, links, activePhaseId)` +
  `resolveActivePhase(phases, date)` → resolvem o pool/fase ativa (helpers já usados na leva de field-feedback).

**Histórico de preço por item (P2/futuro):**

- `src/features/expenses/ExpenseDetailPage.tsx` + `SessionItem`/itens de nota → a tela de detalhe do item; o histórico de
  preço por nome normalizado seria construído sobre os itens já persistidos (sem schema novo).

---

## 5. Change-set, normalizado (o QUE muda nesta leva)

Os 16 pontos do briefing → itens **D-NN** (D de "Discovery & Clarity"), agrupados pela prioridade do Julio. Cada um aterrissa
num gate em §10 e tem causa-raiz em §6.

**P0 — corrigir agora:**

- **D01** Atualizar profundamente **"Tudo que dá para fazer"** e **"Central de ajuda"** (re-auditoria completa; toda função
  nova; organizado por intenção) (briefing #1).
- **D06** Corrigir o conceito do **Amigo Sincero** — só frases opinativas; extras factuais migram para os **insights** (#6).
- **D09** Fechar o **FAB** ao trocar de aba / clicar fora / mudar de tela (#9).
- **D11** Explicar melhor o **check-in do dia** — destino claro da economia (#11).
- **D12** Explicar a **função real do cofrinho** (a regra já existe — só documentar + explicar) (#12).
- **D13** Melhorar o **"De onde vem?"** — cobrir todos os cenários do dinheiro (#13).
- **D14** **Consistência visual** check-in × cofrinho × próximos dias (sem contagem dupla) (#14).
- **D15** **Pote/fundo com fase própria** — não poluir a fase atual; criação separa evento × pote (#15).

**P1 — muito importante:**

- **D02** Melhorar a **descoberta de funções** — entrada visível na home + busca/glossário por intenção (#2).
- **D03** Resolver a confusão **Dividir conta × Divisão em grupo** — porta única "Dividir" que explica e roteia (#3).
- **D04** Dar **mais visibilidade** para "Divisão em grupo" (FAB + guide + hub) (#4).
- **D08** **Reorganizar o FAB** — ações mais usadas na 1ª camada; "Registrar mercado" para "Mais ações" (#8).
- **D10** Revisar o card **"Posso gastar um valor"** — compacto, sem poluir a home (#10).

**P2 — melhoria futura:**

- **D05** Revisar a **estrutura visual de "Divisões em grupo"** (tela única clara; tirar a duplicidade de botões) (#5).
- **D07** **Histórico de preço por item** — comparar compras antigas do mesmo item (#7).

---

## 6. Root-cause map (código ↔ mudança) — vá direto ao arquivo certo

> Leia o arquivo citado **antes** de editar (os símbolos podem ter mudado). Cada linha já traz a *direção* da correção.

| # | Sintoma (briefing) | Causa-raiz (arquivo → símbolo) | Direção da correção | Gate |
|---|---|---|---|---|
| D01 | "Tudo que dá pra fazer" desatualizado | `domain/guide/guide-catalog.ts` → `GUIDE_SECTIONS`; seção `people` só `split`+`shared`, **falta `group_split`**; sem entradas de IA/foto | Re-auditar contra o **router + `HELP_ARTICLES`**; adicionar `group_split` e o que faltar; **organizar por intenção**; teste de cobertura `guide ⊆ help ⊆ router` | G2 |
| D01 | "Central de ajuda" desatualizada | `domain/help/help-catalog.ts` → `HELP_ARTICLES` (já tem group_split/piggy/searchHelp) | Revisar **cópia/steps** das features novas (Tricount, IA, cofrinho buffer, potes por fase); garantir 1 artigo por capability; manter `searchHelp` | G2 |
| D02 | Descoberta escondida (só em Settings) | guia/help só alcançáveis por Settings; `searchHelp` existe mas vive dentro do help | **Entrada visível no topo da home** (chip/ícone discreto perto de notif/config) → **hub unificado** (busca por intenção + guia + ajuda numa tela). Reusa `searchHelp`+`GUIDE_SECTIONS`+`HELP_ARTICLES` (DEC-307/308) | G3 |
| D03 | "Dividir conta" × "Divisão em grupo" confundem | `features/split/*` (`/split/scan`) vs `features/group-split/*` (`/groups`); FAB só tem "Dividir conta" | **Porta única "Dividir"** → chooser "Como você quer dividir?": **Por itens** (`/split/scan`) × **Valor em grupo** (`/groups/new`), cada um explicado. **Código das duas entidades intacto** (DEC-309) | G3 |
| D04 | Divisão em grupo muito escondida | `/groups` só via `SharedExpensesPage` (l.521); ausente no FAB e no guide | Entrar no **FAB** (via "Dividir"), no **guide** (people) e no **hub** de descoberta (DEC-310) | G3 |
| D05 | Duplicidade de botões em grupo | `SharedExpensesPage.tsx` botão→`/groups` (l.521-539) **+** seção read-only "Em divisões de grupo" (l.590+, DEC-306); `GroupSplitListPage` "Novo grupo"+lista | **Tela única de grupos** clara (Novo · que criei · que participo · a receber/pagar/pagos/pendentes); em "Acerto de contas" manter só um **resumo→link** (não dois pontos de entrada) | G3 |
| D06 | Amigo Sincero mostra insight comum | `domain/budget/honest-friend-extras.ts` → `buildHonestFriendExtras` injeta `piggy_movement`/`phase_progress`/`daily_left`/`top_category`/`receivable` como slides; `AmigoSinceroCard` os renderiza | **Amigo Sincero = só verdict/voz opinativa.** Mover os extras **factuais** para o **carrossel de insights** (`buildDashboardInsights`/`useDashboardModel` l.355); manter de-dupe. Card sem dado objetivo (DEC-317) | G1 |
| D07 | Sem histórico de preço por item | `features/expenses/ExpenseDetailPage.tsx` + `SessionItem` (itens de nota) | **P2/futuro:** na tela do item, "Ver histórico de preço" comparando itens por **nome normalizado** (menor/maior/média/variação). Sem schema novo; começa no detalhe do item | G6 |
| D08 | FAB com ações erradas na 1ª camada | `components/FAB.tsx` → `GROUPED_ACTIONS`; `register_market` chip visível (l.85-97); sem group-split | 1ª camada = **registrar gasto · IA · Dividir(chooser) · iniciar saída**; **"Registrar mercado" → "Mais ações"** (group `other`), modo-aware (DEC-311); comparador já em `other` | G3 |
| D09 | FAB continua aberto ao trocar de aba | `components/BottomNav.tsx` → `isFabOpen` (l.41); onClick das abas (l.70-74) navega **sem** `setIsFabOpen(false)`; nav vira `z-[60]` sobre o scrim | `useEffect(() => setIsFabOpen(false), [location.pathname])` (fecha em **qualquer** mudança de rota) + `setIsFabOpen(false)` no onClick das abas/centro; scrim já fecha no clique fora (DEC-318) | G1 |
| D10 | "Posso gastar um valor" poluindo a home | `features/dashboard/AskToSpendShortcut.tsx` montado no hero (`DashboardCards.tsx` l.885) | Manter o acesso, **compactar** para chip discreto logo abaixo de "Livre hoje" (é a pergunta natural seguinte ao número-âncora). Não remover (DEC-316) | G4 |
| D11 | Check-in: economia vai pro cofrinho ou pros próximos dias? | `DashboardCards.tsx` case `daily_checkin` (l.363-544): `checkin_redistribute` (l.512) + foco `piggy_bank` (l.532) **simultâneos** | Mostrar **UM destino**: quando o cofrinho está ativo (fase com datas) → "guardei X no cofrinho"; sem cofrinho → "diluído nos próximos dias". Nunca os dois (DEC-313) | G4 |
| D12 | Cofrinho: regra não explicada | `domain/budget/piggy-ledger.ts` → `buildPiggyLedger` (a regra do usuário **já é a implementada**) | **Documentar a regra oficial** (DEC-312) + explicar em linguagem simples no card/check-in/"de onde vem". **Sem mudar matemática** (ÂNCORA 11) | G4 |
| D13 | "De onde vem?" não tira a dúvida | `DashboardCards.tsx` `onOpenHeroBreakdown` (l.730) + `components/Breakdown.tsx` + `DashboardSheets.tsx` | Cobrir os cenários: livre × valor do dia × gastou menos × gastou mais × quando o cofrinho entra × quando os próximos dias mudam × **guardado vs redistribuído vs simulado** | G4 |
| D14 | Parece que a mesma economia vai pra dois lugares | mesmos arquivos de D11/D13 | Bloco **"Destino da economia de hoje"** com **um** resultado (cofrinho **ou** próximos dias); nunca contar duas vezes (DEC-313/314) | G4 |
| D15 | Pote de fase futura aparece na fase atual | `features/funds/FundsPage.tsx` → `createEnvelope` (scope `linked_phases`/`global`) **já existe**; falta filtrar na home + a criação confunde com evento (`OccasionCounter`/`allowance-map`, countdown) | Home da fase atual mostra **só potes da fase ativa/globais**; potes de outras fases → área secundária **"Potes de outras fases"** (colapsada) + **selecionáveis** no registro de gasto (`selectActivePhasePool`). Criação **separa** "Evento" (data/countdown) de "Pote/Fundo" (fase/período) (DEC-314/315) | G5 |

---

## 7. Decisões + councils inline (rodados AGORA, sem subagents)

> Cada council rodou **inline, 1 request, sem subagents** (per `inline-council-no-subagents.mdc`): brief neutro → vozes
> cegas → red team → síntese. Aqui ficam destiladas. **DEC-307→316 = PROPOSED** (aguardando lock do Julio na §16);
> **DEC-317→319 = decisões diretas** (diretrizes claras do briefing, sem dúvida conceitual).

### Council C-A — Como expor "Tudo que dá para fazer" sem poluir (§16 Q1)
**Brief:** guia/help vivem em Settings (escondido); briefing quer entrada visível no topo da home, sem competir com o número-âncora.
**Vozes (cegas):** *Advocate* — uma entrada discreta no topo resolve "não sei o que dá pra fazer"; *Architect* — não criar
superfície nova pesada; consolidar guia+ajuda+busca num **hub** reusando `searchHelp`/`GUIDE_SECTIONS`/`HELP_ARTICLES`;
*Critic* — mais um elemento fixo polui; tem que ser **ícone/chip pequeno no header**, não um card; *Strategist* — uma "porta
de descoberta" única é mais memorável que 3 entradas espalhadas. **Red team:** "mais um botão = poluição" → mitigado: ícone
discreto no header (não card), conteúdo 100% reusado. **Síntese/Rec:** UMA entrada discreta no header da home (ex.: ícone
`explore`/`help` ou chip "O que dá pra fazer?") → **hub de descoberta unificado** (busca + guia + ajuda numa tela). Guia/help
em Settings continuam (ÂNCORA 9). → **DEC-307.**

### Council C-B — Buscador inteligente de funções? (§16 Q2)
**Brief:** briefing quer busca em linguagem natural ("quero dividir uma conta" → "use Divisão em grupo"). Já existe
`searchHelp` (local, 0-token, sinônimos multilíngue). **Vozes:** *Architect* — V1 = reusar `searchHelp` sobre guia+help,
estendendo keywords para **frases de intenção** ("quero…"); 0 custo, offline; *Critic* — não prometer IA (custo/escopo); a
busca local cobre o caso; *Advocate* — o glossário por intenção (Opção 3 do briefing) é a **mesma tela em modo browse**
(guide reordenado por intenção); *Strategist* — busca local boa = diferencial sem custo recorrente. **Red team:** "busca
local não é linguagem natural de verdade" → o **assistant IA já existe** e pode rotear "como faço X" para o hub (fallback
V2, fora do escopo). **Síntese/Rec:** SIM — **busca por intenção local (reusa `searchHelp`)** + **glossário por intenção**
(browse), **sem IA nova** no V1. → **DEC-308.**

### Council C-C — Unificar "Dividir conta" e "Divisão em grupo" numa função "Dividir"? (§16 Q3) — *o mais pesado*
**Brief:** `split` (por itens, conta única ao vivo, `/split/scan`) × `group-split` (valor/várias despesas entre pessoas,
persistente, `/groups`, DEC-297). Briefing recomenda um "Dividir" com 2 caminhos. **Vozes (cegas):**
- *Advocate (usuário):* um "Dividir" com tela "Como você quer dividir?" → "Por itens da conta" / "Valor entre pessoas" mata o
  "por que tem dois?". **Rec:** unificar a porta. **Confiança:** ALTA.
- *Architect:* as duas são **entidades/fluxos distintos** (DEC-297 separou de propósito). Unir só a **porta de entrada** (um
  chooser que roteia), **sem tocar a lógica**. **Rec:** chooser, código separado. **Outros perdem:** fundir o código
  arriscaria o bill-split ao vivo (provado em 2 devices). **Confiança:** ALTA.
- *Critic:* um chooser adiciona **+1 toque** ao caso comum (bar). Não pode pesar para quem já sabe. **Rec:** chooser com
  atalho/“lembra o último”. **Confiança:** MÉDIA.
- *Strategist:* "Dividir" como guarda-chuva é forte (todo mundo divide conta); o Tricount ganha um nome conhecido. **Confiança:** MÉDIA.
**Red team (mata a opção líder):** o chooser puro penaliza o fluxo de bar mais usado. **Mitigação:** o FAB pode manter um
atalho direto "Por itens" **além** de "Dividir", ou o chooser destacar o mais usado. **Síntese/Rec:** **unificar a ENTRADA,
não o código** — ação única "Dividir" → chooser "Como você quer dividir?" (Por itens × Valor em grupo), cada caminho
explicado; entidades/lógicas intactas (DEC-297). Decisão fina (chooser puro × chooser + atalho direto) fica para a
implementação/§16. → **DEC-309.**

### Council C-D — Posição da "Divisão em grupo" no FAB (§16 Q4)
**Brief:** depende de C-C. **Vozes (quick, Architect+Advocate):** se "Dividir" vira chooser, o FAB tem **"Dividir"** (que
leva aos 2 caminhos) pareado com "Iniciar saída", **no lugar do atual "Dividir conta"**; group-split fica a **1 nível**.
**Rec:** FAB ganha "Dividir" (chooser); group-split também no **guide** (people) e no **hub**. → **DEC-310.**

### Council C-E — "Registrar mercado" sai da 1ª camada do FAB? (§16 Q5)
**Brief:** hoje `register_market` é chip visível (`plan`); briefing acha menos usado que Divisão em grupo/custo-benefício.
**ATENÇÃO:** o Julio **promoveu** "Registrar mercado" há poucos dias (2026-06-22, comentário no FAB) para o modo "dia a dia".
**Vozes (quick):** *Architect* — mover para "Mais ações" libera a linha visível para "Dividir"; *Advocate* — no modo
**dia-a-dia**, mercado é captura diária (manter); no modo **viagem**, pode ir para "Mais ações". **Red team:** remover agora
o que o Julio promoveu há 3 dias é ioiô. **Síntese/Rec:** **modo-aware** — mercado em "Mais ações" no modo viagem; visível no
modo dia-a-dia. **Conflita com a decisão recente do Julio → pergunta explícita na §16.** → **DEC-311 (PROPOSED).**

### Council C-F — Regra oficial do cofrinho (§16 Q6) — *confirmada no código*
**Brief:** o usuário descreveu (briefing #12): gasto acima do dia usa o cofrinho primeiro (próximos dias não caem); o que o
cofrinho não cobrir é redistribuído. **Achado (leitura de `piggy-ledger.ts`):** `bal_d = max(0, bal_{d-1} + dailyIdeal −
spent_d)`; gasto abaixo deposita, gasto acima saca, `uncovered` (o que não cobriu) corta os dias seguintes. **⇒ a regra do
usuário JÁ É a implementada** (Model B, DEC-279/261). **Vozes:** *Architect* — confirmar + documentar; não mexer na
matemática; *Critic* — confirmar no código ANTES de prometer (feito); *Advocate* — escrever em linguagem simples no card /
check-in / "de onde vem". **Síntese/Rec:** **formalizar a regra como o usuário descreveu** (ela já vale) e explicá-la em UI.
**Sem mudança de matemática** (ÂNCORA 11). → **DEC-312.**

### Council C-G — Economia do dia: cofrinho, próximos dias ou ambos? (§16 Q7)
**Brief:** o check-in mostra "vai pros próximos dias" **e** destaca o cofrinho (contagem dupla). **Achado:** pela matemática
(C-F), gastar abaixo do dia **deposita no cofrinho** (delta > 0); o saldo do cofrinho é que dá folga futura (não há
"+X/dia nos próximos dias" como destino separado). **Exceção:** sem fase com datas (cofrinho oculto), a sobra dilui no
free-to-spend total (rollover). **Vozes:** *Architect* — destino canônico = **cofrinho** quando ativo; *Advocate* — mostrar
**só** isso; *Critic* — quando não há cofrinho, mostrar "diluído nos próximos dias" (e só então). **Síntese/Rec:** **um
destino**: cofrinho ativo → economia vai pro **cofrinho** (mostrar só isso; a relação com os próximos dias é "o cofrinho
protege os próximos dias", não "+X/dia"); sem cofrinho → diluição nos próximos dias. **Nunca os dois ao mesmo tempo.** →
**DEC-313.**

### Council C-H — Mostrar pote futuro sem misturar com a fase atual (§16 Q8)
**Brief:** pool `linked_phases` já existe; o pote "Hospedagens Eurotrip" apareceu na home de Burgos. **Vozes:** *Architect* —
a home deve filtrar potes pela **fase ativa** (só potes da fase atual/globais em destaque); *Advocate* — o usuário precisa
**lançar gasto agora** no pote futuro → ele continua **selecionável** no registro mesmo sem aparecer em destaque; *Critic* —
não esconder a ponto de sumir: "Potes de outras fases" achável; *Strategist* — envelope por fase bem feito é diferencial.
**Síntese/Rec:** home da fase atual mostra em destaque só potes da fase ativa/globais; potes de outras fases →
seção secundária **"Potes de outras fases"** (colapsada) + selecionáveis no registro (reusa `selectActivePhasePool`/scope).
→ **DEC-314.**

### Council C-I — Pote com data × evento com data (§16 Q9)
**Brief:** criar pote com data parece criar um **evento** (countdown "faltam X dias"). Briefing distingue: **evento** (data,
countdown, pontual) × **pote/fundo** (fase/período, recebe lançamentos antes, não pontual). **Vozes:** *Architect* — são dois
conceitos (`OccasionCounter`/`allowance-map` = evento; `pool linked_phases` = fundo); a **criação** deve perguntar qual;
*Critic* — sem essa escolha, vira evento sem querer; *Advocate* — o usuário quer "um pote pra Eurotrip" sem "faltam X dias".
**Síntese/Rec:** **separar explicitamente na criação** — "Evento" (data/countdown, reserva distribuída nos dias) × "Pote/Fundo"
(ligado a fase/período, sem countdown, recebe lançamentos a qualquer momento). Reusa allowance-map (evento) e pool/envelope
(pote). → **DEC-315.**

### Council C-J — "Posso gastar um valor" continua na home? (§16 Q10)
**Brief:** `AskToSpendShortcut` no hero (l.885, DEC-289/M04) ocupa espaço. **Vozes (quick, Advocate+Critic):** *Advocate* — é
a pergunta natural seguinte ao "Livre hoje"; manter perto do número-âncora; *Critic* — só não pode ser um card grande →
**chip discreto**. **Red team:** é gosto do Julio (ele adicionou) → pergunta explícita. **Síntese/Rec:** **manter, mas
compacto** (chip discreto abaixo de "Livre hoje"); alternativa = mover para o FAB/hub. → **DEC-316.**

### Decisões diretas (sem council — diretrizes claras do briefing)

- **DEC-317** — **Amigo Sincero = só voz** (D06): o carrossel do Amigo Sincero contém **apenas** frases opinativas com
  personalidade; os extras **factuais** (`piggy_movement`, `phase_progress`, `daily_left`, `top_category`, `receivable`) saem
  do card e viram **insights** no carrossel de insights. Critério de aceite do briefing: "nenhum insight comum aparece dentro
  do Amigo Sincero". Refina DEC-301 (que tornou os CTAs por slide) — agora os slides factuais deixam de existir no Amigo.
- **DEC-318** — **Fechar o FAB ao trocar de contexto** (D09): `isFabOpen` fecha em qualquer mudança de rota (aba/card/tela) e
  no clique fora. Comportamento padrão, sem exceção.
- **DEC-319** — **Versão + política de ajuda**: bump **patch por gate** (1.0.2-rc → 1.0.6-rc); **1.1.0-rc** como marco quando
  o hub de descoberta (G3) entrar. **Política permanente:** toda função de primeira classe nova ⇒ entra no `guide-catalog`
  **e** no `help-catalog` na mesma leva (com teste de cobertura).

---

## 8. Estratégia de testes (teste JUNTO com a mudança)

Stack: **Vitest** (unit, domínio) + **Playwright** (E2E). Regra do projeto (`.cursor/rules/test-routing.mdc`): rodar e
escrever testes **direto** (sem subagents). Comandos em §17.

- **Domínio puro primeiro** (>90%): cobertura `guide ⊆ help ⊆ router` (D01); `searchHelp` resolve frases de intenção →
  função certa (D02); separação Amigo×insights — `buildHonestFriendExtras` deixa de emitir factuais e o builder de insights
  passa a cobri-los (D06); cofrinho — **testes de matemática com números** confirmando a regra (D12: gasto acima saca do
  cofrinho, `uncovered` corta dias seguintes; gasto abaixo deposita) **sem alterar resultados existentes** (ÂNCORA 11);
  filtro de potes por fase ativa (D15: pote de outra fase não aparece em destaque, mas é selecionável).
- **Reuse os testes existentes** — `domain/help/*`, `domain/guide/*`, `domain/budget/honest-friend-extras.test.ts`,
  `domain/budget/piggy-ledger` tests, `domain/budget/*` — **estenda, não duplique**.
- **UI crítica via Playwright** (>70%): entrada de descoberta na home → hub abre e busca acha a função (D02); FAB "Dividir" →
  chooser → cada caminho (D03/D04); trocar de aba com FAB aberto → FAB fecha (D09); check-in "sem gastos" → **um** destino
  (D11/D14); criar pote de fase futura → não aparece na home da fase atual, aparece no seletor de gasto (D15).
- **Invariante de dados:** nenhuma mudança desta leva altera um total/saldo (é exposição/explicação/organização). Após D06 e
  D11–D14, os números do cofrinho/insights permanecem **idênticos**. Rode a suíte **completa** entre gates (0 falhas além das
  2 baseline `split-live-loop` de WebCrypto, que passam no CI Node 22) — §10/§12.

---

## 9. Protocolo de execução por milestone (5-point self-check) + refresh

Antes de **cada commit de milestone** (espelha `phase-delivery-hardening.mdc`):

1. Liste os AC satisfeitos (IDs do gate).
2. Nomeie **3 AC anteriores em risco de regressão** e verifique-os (esp. ÂNCORA 11, registro de gasto nunca bloqueia,
   números do cofrinho/insights idênticos).
3. Rode os testes — **sem novas falhas**.
4. Sinalize qualquer arquivo tocado **fora** do escopo do milestone.
5. Atualize `src/dev-log.md` (o que fez, testes, riscos).

**Refresh de contexto (in-session) em cada fronteira de gate:** releia §3 deste doc + o escopo do **próximo** gate + o
`dev-log` Current State; imprima o bloco NÃO-NEGOCIÁVEIS (§3) e o CURRENT STATE (gate, commit, testes, riscos, escopo).
**Mid-gate (a cada 3 milestones):** refresh leve (regras críticas + dev-log).

---

## 10. O BUILD — gates (G0→G6)

> Cada gate: **Por quê · Causa-raiz · Mudança · AC · Testes · Commit/Deploy.** Feche o gate com a suíte **completa** verde,
> build OK, smoke das 3 jornadas (registrar gasto · achar uma função pelo hub · abrir o check-in do dia), dev-log atualizado,
> refresh. **G1–G2 são executáveis já; G3–G5 exigem o lock da §16.**

### G0 — Setup, baseline e dev-log
**Por quê:** começar de um chão verde e rastreável.
**Mudança:** `npm install`; rodar `npm run test` + `npm run build` + `tsc --noEmit` e registrar o baseline; criar/atualizar
`src/dev-log.md` (Current State + tabela de milestones); registrar `DEC-307→319` no `decision-log.md` como PROPOSED;
confirmar pipeline de deploy (Cloudflare Pages auto-build no push para `master`; OTA via `version.json` + bundle).
**AC:** baseline verde documentado; dev-log semeado; DECs registrados.
**Commit:** `chore(discovery): seed dev-log + baseline for discovery & clarity leva`.

### G1 — Comportamento barato/global (D06, D09) — *executável já*
**Por quê:** barato, isolado, alta dor, calibra o olho; não depende de lock.
**Causa-raiz:** §6 D06 (Amigo Sincero injeta factuais), D09 (FAB não fecha ao navegar).
**Mudança:**
- D09 (DEC-318): `useEffect(() => setIsFabOpen(false), [location.pathname])` em `BottomNav.tsx` + `setIsFabOpen(false)` no
  onClick das abas/centro; manter o scrim que já fecha no clique fora. Verificar que nenhuma jornada do FAB regrediu.
- D06 (DEC-317): `buildHonestFriendExtras` deixa de alimentar o card do Amigo Sincero com dados objetivos; os tópicos
  factuais (`piggy_movement`/`daily_left`/`top_category`/`phase_progress`/`receivable`) passam a ser **insights** (via
  `buildDashboardInsights`/`useDashboardModel`), sem duplicar. O Amigo Sincero mostra só o **verdict/voz** (e variações de voz).
**AC:** FAB aberto **nunca** sobrevive a troca de aba/card/tela; o carrossel do Amigo Sincero **não** mostra nenhum dado
objetivo (só frases opinativas); os dados objetivos continuam visíveis como **insights**; números idênticos (ÂNCORA 11).
**Testes:** unit — `buildHonestFriendExtras` não emite factuais para o Amigo; os insights cobrem os tópicos; E2E — FAB fecha
ao trocar de aba; Amigo só voz.
**Commit (por item):** `fix(nav): close FAB on route change / outside tap` · `refactor(dashboard): Amigo Sincero = voice only; factual extras become insights`. **Deploy** ao fim do gate (1.0.2-rc).

### G2 — Ajuda & "Tudo que dá para fazer" (D01) — *executável já*
**Por quê:** a referência oficial precisa espelhar o produto; pré-requisito da descoberta (G3).
**Causa-raiz:** §6 D01 (guide desatualizado vs help/router).
**Mudança (DEC-319):** **re-auditoria completa** — cruzar `GUIDE_SECTIONS` e `HELP_ARTICLES` com **o router** e com a lista
real de features (dev-log/release-notes); **adicionar o que falta** (no mínimo `group_split` no guide; revisar IA/foto/cofrinho
buffer/potes por fase/Tricount); **organizar por intenção** do usuário (não por nome técnico); revisar cópia/steps das features
novas (3 idiomas). Endurecer o **teste de cobertura** `guide ⊆ help ⊆ router`. **Gate maior → milestones por área**
(captura/IA/nota · divisão conta/grupo/acerto · cofrinho/potes/planejados/fundos · copiloto/insights/Amigo · descoberta/modo).
**AC:** nenhuma função importante fica fora de "Tudo que dá para fazer"; a Central de ajuda explica as funções principais;
conteúdo organizado por intenção; teste de cobertura verde.
**Testes:** cobertura `guide ⊆ help ⊆ router`; `searchHelp` resolve as frases de intenção das features novas.
**Commit (por área):** `docs(help): re-audit guide+help — add group-split, AI, piggy buffer, phase pots; group by intent`. **Deploy** (1.0.3-rc).

### G3 — Descoberta & navegação (D02, D03, D04, D08, D05) — *requer lock §16 Q1–Q5*
**Por quê:** o coração do briefing — o usuário precisa achar a função certa sem adivinhar.
**Causa-raiz:** §6 D02 (descoberta escondida), D03 (dividir conta×grupo), D04 (visibilidade grupo), D08 (FAB), D05 (tela de grupo).
**Mudança (DEC-307→311):**
- D02: **entrada discreta no header da home** → **hub de descoberta** (busca por intenção reusando `searchHelp` + guia +
  ajuda numa tela; glossário = browse por intenção). **Marco 1.1.0-rc.**
- D03/D04: **porta única "Dividir"** (chooser "Como você quer dividir?": Por itens × Valor em grupo), código das duas
  entidades intacto; group-split no FAB (via "Dividir"), no guide e no hub.
- D08: 1ª camada do FAB = registrar gasto · IA · Dividir · iniciar saída; "Registrar mercado" → "Mais ações" (modo-aware,
  conforme Q5 lockada).
- D05: **tela única de grupos** (Novo · criei · participo · a receber/pagar/pagos/pendentes); em "Acerto de contas", manter só
  um **resumo→link** (não dois pontos de entrada).
**AC:** o usuário acha a função certa pela **intenção** sem saber o nome; antes de dividir, entende qual tipo está
escolhendo; "Divisão em grupo" alcançável sem camadas escondidas; FAB com as ações mais usadas na frente; tela de grupos sem
duplicidade confusa.
**Testes:** E2E hub busca→função; FAB "Dividir"→chooser→2 caminhos; unit do roteamento por intenção.
**Commit (por item):** `feat(discovery): home discovery hub (search by intent + guide + help)` · `feat(split): unified "Dividir" chooser` · `fix(fab): rank actions; market → more` · `fix(group-split): single clear groups screen`. **Deploy** (1.1.0-rc).

### G4 — Clareza do dinheiro do dia (D11, D12, D13, D14, D10) — *requer lock §16 Q6, Q7, Q10*
**Por quê:** o usuário precisa entender, sem dúvida, para onde vai o dinheiro economizado e de onde vem o que pode gastar.
**Causa-raiz:** §6 D11–D14 (check-in/cofrinho/"de onde vem"/consistência), D10 ("posso gastar").
**Mudança (DEC-312/313/316):**
- D12: documentar a **regra oficial do cofrinho** (já implementada — §7 C-F) e explicá-la em linguagem simples; **sem mudar
  matemática**.
- D11/D14: o check-in mostra **um** destino da economia (cofrinho quando ativo; diluição nos próximos dias quando não há
  cofrinho) — bloco "Destino da economia de hoje", sem contagem dupla; não destacar o cofrinho quando o dinheiro não vai pra ele.
- D13: "De onde vem?" cobre todos os cenários (livre × valor do dia × gastou menos/mais × quando o cofrinho entra × quando os
  próximos dias mudam × guardado/redistribuído/simulado), seguindo o dicionário de estados (DEC-304).
- D10: "Posso gastar um valor" vira **chip discreto** abaixo de "Livre hoje" (compacto, não card grande).
**AC:** o usuário sabe exatamente para onde foi a economia do dia; entende quando o cofrinho é usado e quando os próximos
dias mudam; a tela nunca parece contar o mesmo dinheiro duas vezes; "posso gastar" acessível sem poluir.
**Testes:** unit dos rótulos de destino (um por contexto); unit do cofrinho (regra com números, idêntica ao baseline); E2E
check-in "sem gastos" → um destino.
**Commit (por item):** `docs(piggy): official cofrinho rule + UI copy` · `fix(checkin): single saving destination, no double-count` · `fix(dashboard): compact "posso gastar" chip`. **Deploy** (1.1.1-rc).

### G5 — Potes/fundos por fase (D15) — *requer lock §16 Q8, Q9*
**Por quê:** o pote de fase futura não pode poluir a fase atual, mas precisa receber gasto desde já.
**Causa-raiz:** §6 D15 (`FundsPage` scope já existe; falta filtrar na home + criação confunde com evento).
**Mudança (DEC-314/315):** a home da fase atual mostra em destaque só potes da fase ativa/globais; potes de outras fases →
seção secundária **"Potes de outras fases"** (colapsada) + **selecionáveis** no registro de gasto (`selectActivePhasePool`);
a **criação** separa explicitamente **"Evento"** (data/countdown) de **"Pote/Fundo"** (fase/período, sem countdown, recebe
lançamentos a qualquer momento).
**AC:** criar um pote para uma fase futura → não aparece em destaque na fase atual, mas é selecionável para lançar gasto
agora, e aparece corretamente ao entrar na fase; pote não vira evento nem mostra "faltam X dias".
**Testes:** unit do filtro de potes por fase ativa; unit evento × pote (data/countdown só no evento); E2E criar pote
futuro → ausente na home atual, presente no seletor.
**Commit (por item):** `feat(funds): phase-scoped pots — hide off-phase from home, keep selectable` · `feat(funds): split create flow event × pot`. **Deploy** (1.1.2-rc).

### G6 — Futuro/P2 (D07, D05 acabamento) — *opcional nesta leva*
**Por quê:** melhorias que o briefing marcou como futuras; só se houver folga e o Julio quiser nesta leva.
**Mudança:** D07 — na tela de detalhe do item, "Ver histórico de preço" (comparar itens por nome normalizado: menor/maior/
média/variação); começa no detalhe do item, sem schema novo. D05 — acabamento fino da estrutura visual de grupos.
**AC:** ao abrir um item com histórico, o usuário vê quanto pagou pelo mesmo item antes.
**Commit:** `feat(items): price history per item`. **Deploy** ao fim.

---

## 11. Segurança de terminal (WSL) — leia antes de qualquer git

Espelha `.cursor/rules/terminal-pager-safety.mdc`. O terminal do agente trava para sempre num pager.

- **git sempre com `--no-pager`**: `git --no-pager log/diff/show/status`. Commit **sempre** `-m` (HEREDOC para multi-linha).
- **Nunca** `less`/`more`/`man`/`vim`/`nano`/`-i`/`rebase -i`. CLIs incertas → `| cat`.
- Se um comando travar >30s sem saída: não re-rode; leia o terminal file, ache o pid e mate o processo preso.

---

## 12. Definition of Done (a leva acabou quando TUDO é TRUE)

- [ ] **§16 lockada** pelo Julio (ou recomendações aprovadas em bloco) — pré-requisito de G3/G4/G5.
- [ ] **P0** completo: D01 (guide+help re-auditados), D06 (Amigo só voz), D09 (FAB fecha), D11/D12/D13/D14 (dinheiro do dia
      claro, um destino, regra do cofrinho documentada), D15 (pote por fase não polui a fase atual).
- [ ] **P1** completo: D02 (hub de descoberta + busca por intenção), D03 (porta "Dividir"), D04 (visibilidade grupo),
      D08 (FAB reorganizado), D10 ("posso gastar" compacto).
- [ ] **P2** conforme escopo aprovado: D05 (tela de grupos), D07 (histórico de preço) — ou explicitamente adiados.
- [ ] **Política de ajuda** (DEC-319) aplicada e testada: `guide ⊆ help ⊆ router`.
- [ ] **ÂNCORA 11**: nenhum total/saldo mudou (a leva é exposição/clareza); cofrinho/insights numericamente idênticos.
- [ ] Suíte **completa** verde (só as 2 baseline `split-live-loop`), `npm run build` + `tsc --noEmit` OK, smoke OK.
- [ ] `dev-log.md`, `decision-log.md` (DEC-307→319 APPROVED), `project-status.md` atualizados; versões por gate + 1.1.x-rc.
- [ ] Deploy feito; nada que já funcionava/era bonito regrediu (ÂNCORA 9/11).

---

## 13. Anti-padrões (NÃO faça)

- ❌ Mudar a **matemática do cofrinho** para "explicar" a regra — ela já está correta; é só doc + clareza (D12/ÂNCORA 11).
- ❌ Deixar **qualquer dado objetivo** no Amigo Sincero (D06) — factual = insight.
- ❌ Mostrar **dois destinos** da economia do dia ao mesmo tempo (D11/D14).
- ❌ Fundir o **código** do bill-split com o do group-split — só a **porta** "Dividir" é unificada (D03/DEC-309).
- ❌ Criar um **buscador com IA nova** no V1 — reusar `searchHelp` (D02/DEC-308).
- ❌ Deixar um pote de **outra fase** em destaque na home da fase atual (D15) — ou torná-lo não-selecionável.
- ❌ Codar **G3/G4/G5 sem o lock da §16**. ❌ Deletar qualquer ação/feature (ÂNCORA 9). ❌ Hardcode de texto (use `t()`).
- ❌ Subagents/Task tool. ❌ git sem `--no-pager`. ❌ Parar no meio (depois do lock) sem §12 TRUE.

---

## 14. Sincronia com o brain

- `src/dev-log.md` — a cada milestone (Current State + entrada).
- `brain/decision-log.md` — `DEC-307→319` (PROPOSED no G0 → APPROVED por gate conforme lockados/entregues).
- `brain/product-spec.md` — registrar a **regra oficial do cofrinho** (DEC-312), o **hub de descoberta** e a **distinção
  evento × pote** (DEC-315) quando os gates fecharem.
- `brain/project-status.md` — status/itens pendentes/próximos passos no fim da leva.
- Apontar deste doc no índice do brain quando ACTIVE.

---

## 15. Matriz de teste manual (smoke por plataforma)

| Jornada | Desktop (PWA) | Mobile (PWA) | cap-native |
|---|---|---|---|
| Entrada de descoberta na home → hub abre; buscar "dividir um valor com o grupo" → acha Divisão em grupo | ☐ | ☐ | ☐ |
| FAB "Dividir" → chooser → Por itens × Valor em grupo (cada um abre o fluxo certo) | ☐ | ☐ | ☐ |
| Abrir o FAB → tocar uma aba → **FAB fecha** | ☐ | ☐ | ☐ |
| Amigo Sincero: só frases opinativas; os dados objetivos aparecem como **insights** | ☐ | ☐ | ☐ |
| Check-in "sem gastos" → **um** destino (cofrinho) explicado; sem contagem dupla | ☐ | ☐ | ☐ |
| "De onde vem?" responde livre/dia/gastei menos/gastei mais/cofrinho/próximos dias | ☐ | ☐ | ☐ |
| Criar pote de fase futura → **não** aparece na home da fase atual; **aparece** no seletor de gasto | ☐ | ☐ | ☐ |
| "Tudo que dá para fazer" inclui Divisão em grupo, IA, cofrinho, potes por fase | ☐ | ☐ | ☐ |

---

## 16. Decisões para o Julio — ⏳ AGUARDANDO LOCK (10 abertas + versão)

> O briefing manda: *"Tudo que envolver dúvida conceitual ou mudança de arquitetura de produto deve ser passado pelo conselho
> antes de codar."* Os councils já rodaram (§7) com **recomendação**. **Locke (ou aprove em bloco)** para liberar G3/G4/G5.
> G1/G2 não dependem disso.

| # | Pergunta | Recomendação do council (PROPOSED) |
|---|----------|------------------------------------|
| Q1 | Como expor "Tudo que dá para fazer" sem poluir? | **Entrada discreta no header da home → hub unificado** (busca + guia + ajuda) (DEC-307) |
| Q2 | Criar buscador inteligente de funções? | **Sim, busca por intenção LOCAL** reusando `searchHelp` (sem IA nova no V1) + glossário browse (DEC-308) |
| Q3 | Unificar "Dividir conta" e "Divisão em grupo"? | **Unificar a ENTRADA** (chooser "Dividir"), **não o código** (entidades intactas) (DEC-309) |
| Q4 | Posição da "Divisão em grupo" no FAB? | Via **"Dividir"** no FAB (pareado com "Iniciar saída") + guide + hub (DEC-310) |
| Q5 | "Registrar mercado" sai da 1ª camada do FAB? | **Modo-aware**: "Mais ações" no modo viagem; visível no dia-a-dia (⚠️ conflita com sua promoção de 2026-06-22) (DEC-311) |
| Q6 | Regra oficial do cofrinho? | **A sua descrição JÁ é a regra implementada** — confirmar e documentar; sem mudar matemática (DEC-312) |
| Q7 | Economia do dia: cofrinho, próximos dias ou ambos? | **Cofrinho** (quando ativo) — um destino; sem cofrinho → diluição. Nunca os dois (DEC-313) |
| Q8 | Mostrar pote futuro sem misturar com a fase atual? | Home só com potes da fase ativa; **"Potes de outras fases"** secundária + selecionável no gasto (DEC-314) |
| Q9 | Pote com data separado de evento com data? | **Sim** — criação separa "Evento" (data/countdown) de "Pote/Fundo" (fase/período) (DEC-315) |
| Q10 | "Posso gastar um valor" continua na home? | **Manter, compacto** (chip discreto abaixo de "Livre hoje") (DEC-316) |
| Vers | Versão da leva | Patch por gate (1.0.2-rc…); **1.1.0-rc** quando o hub de descoberta entrar (DEC-319) |

**Efeito no plano:** Q1–Q5 destravam **G3**; Q6/Q7/Q10 destravam **G4**; Q8/Q9 destravam **G5**. Se o Julio aprovar todas as
recomendações em bloco, o doc vira **ACTIVE** e a execução vai de G1 a G5 (G6 opcional) sem novas perguntas.

---

## 17. GO — comece aqui

1. **Confirme o estado da §16.** Se as 10 decisões estão **lockadas/aprovadas**, o doc está **ACTIVE** — siga as
   recomendações sem re-perguntar. Se **não**, execute **só G1 e G2** (não dependem de lock) e pare no hand-off com um
   `AskQuestion` pedindo o lock para G3+.
2. **G0:** instale, rode baseline, semeie `dev-log.md`, registre `DEC-307→319` (PROPOSED).
   ```bash
   cd TripPilot
   npm install
   npm run test            # baseline (anote a contagem; só as 2 split-live-loop devem falhar)
   npm run build && npx tsc --noEmit
   npx playwright test      # se o ambiente E2E estiver disponível
   ```
3. **Execute G1 → G5 em ordem** (§10), uma milestone por vez, **testando junto** (§8), com o self-check de 5 pontos (§9) antes
   de cada commit e **refresh** em cada fronteira de gate. **G3/G4/G5 só após o lock da §16.**
4. **Deploy** ao fim de cada gate (Cloudflare Pages auto-build no push para `master`; bump `version.json` + bundle OTA +
   release notes pt/en/es; registre no dev-log).
5. **Não pare** (depois do lock) até §12 ser toda TRUE — ou até o contexto realmente acabar (feche o gate atual limpo, commit
   + deploy, handoff no dev-log, **pare limpo**) — ou um bloqueador intransponível (mensagem final termina com `AskQuestion`).

---

## Apêndice — Mapa rápido "intenção → função" (semente do glossário/hub, D02)

| O usuário quer… | Função | Onde |
|---|---|---|
| Registrar um gasto rápido | Registrar gasto | FAB · `/quick-add` |
| Lançar gasto falando/escrevendo | Entrada por IA | FAB (AI hero) · assistant |
| Importar uma nota de mercado | Ler nota (foto/IA) | `/quick-add` (foto) |
| Dividir uma conta **por itens** | Dividir conta | "Dividir" → Por itens · `/split/scan` |
| Dividir um **valor total** com um grupo | Divisão em grupo (Tricount) | "Dividir" → Valor em grupo · `/groups` |
| Saber quanto pode gastar hoje | "Posso gastar" / Check-in do dia | Home (chip) · `/simulator` · `/dashboard` |
| Saber se está dentro do plano | Copiloto | `/copiloto` |
| Reservar dinheiro para uma fase | Pote/Fundo | `/funds` |
| Planejar um evento com data | Evento | `/viagem?plan=1` |
| Ver quem te deve / acertar | Acerto de contas | `/shared` |
| Comparar preço (custo-benefício) | Comparador | `/comparator` |
| Converter moeda | Conversor | `/converter` |
| Entender o app / achar uma função | Hub de descoberta · Tudo que dá para fazer · Central de ajuda | Home (entrada nova) · Settings |
