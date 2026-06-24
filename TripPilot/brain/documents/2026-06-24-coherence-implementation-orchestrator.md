# TripPilot — Orquestrador de Implementação "Coerência & Tricount" (a única fonte de verdade de execução desta leva)

> **Última atualização:** 2026-06-24 · **App:** 0.99.51 → 0.99.6x por gate; **1.0.0-rc** quando o Tricount (G8) entrar (§16 Q9 LOCKED)
> **Status:** ✅ ACTIVE — pronto para rodar. As **9 perguntas da §16 foram respondidas e lockadas pelo Julio (2026-06-24)**
> (§16 + §7, **DEC-295→304**). Um novo chat pega este doc e implementa de ponta a ponta — **sem perguntar nada**
> (ambiguidade nova → council inline + `DEC-NNN` + segue). **Destaques das respostas:** Tricount **COMPLETO** (com leitura de
> nota por IA + divisão personalizada), ajuda em **re-auditoria COMPLETA**, nav do modo simples **2+2**, versão **1.0.0-rc**
> quando o Tricount entrar. · **Adendo 2026-06-24:** **C25** — remover a borda laranja de foco nos inputs (DEC-305, entra no G1).
>
> **Irmão de** `documents/2026-06-24-ui-ux-implementation-orchestrator.md` (a leva de UI/UX anterior, mesmo padrão) e do
> `implementation-prompt.md` (o build original do TripPilot, Tier-3). **Modelado** nos dois orquestradores do FestPilot
> (`2026-06-23-v1-implementation-orchestrator.md` + `2026-06-24-v1-review-remediation-orchestrator.md`). Aqueles
> construíram/consertaram apps inteiros; **este alinha a LÓGICA de um app já maduro e no ar** — para que toda tela conte a
> mesma história — e adiciona **uma feature nova grande (divisão de grupo tipo Tricount)**.
>
> **Fonte desta leva:** o briefing de campo do Julio (2026-06-24, 28 pontos + 4 níveis de prioridade P0→P3), destilado aqui
> em **gates testáveis com critérios de aceite (AC)** e, principalmente, num **root-cause map (código ↔ mudança)** (§6) que
> aponta arquivo e símbolo exatos — porque a investigação já foi feita (este doc é o resultado dela).
>
> **Como ler o resto:** o brain é a verdade de *produto* (`product-spec.md`, `decision-log.md`, `technical-direction.md`).
> **Este documento é a verdade de *execução*:** a ordem, o diagnóstico, a mudança, os testes, os deploys, os commits.

---

## 0. Missão (leia primeiro)

Você é um engenheiro full-stack sênior **aplicando a leva "Coerência & Tricount" do TripPilot de ponta a ponta, sozinho,
nesta sessão**. O app **já existe, está testado e no ar** (0.99.51). Seu trabalho **não** é reconstruir nada: é

1. **Alinhar a lógica do app inteiro** para que todas as telas contem a mesma história — o mesmo gasto, a mesma saída, o
   mesmo número, o mesmo estado (real × planejado × alocado × livre × simulado × guardado) — **em qualquer superfície**;
2. **Tirar a confusão e o susto** (saída agrupada vs item solto; vermelho que assusta sem motivo; copiloto que contradiz o
   planejador; botão que não faz nada);
3. **Entregar a função nova de divisão de grupo (tipo Tricount)** reaproveitando a infra de link público + claim + acerto
   que **já existe** no app.

Tudo isso **preservando o que já funciona e já está bonito**, em ordem de risco (global/barato → clareza de dados → coerência
→ feature nova), **sem parar entre unidades de trabalho**.

**Lembrete de uma linha do que é o TripPilot:** um copiloto de orçamento de viagem (e "Dia a dia"), local-first
(Dexie/IndexedDB), com captura de gastos (manual/IA/OCR), fases, fundos/potes, divisão de conta, simulador, conversor,
comparador, cofrinho, e um Copiloto de insights com a voz "Amigo Sincero". Tom caloroso e anti-culpa.

**A dor central, nas palavras do Julio (normalizadas):**

> "O app mistura **saída agrupada** (uma compra de mercado por nota/IA) com os **itens internos** dela (arroz, pão, água).
> Em telas de resumo aparecem os itens soltos, e parece que os dados estão errados. Além disso, uma tela diz 'você está no
> controle' e outra mostra vermelho e margem negativa. E tem elemento fixo demais (Amigo Sincero, botões do copiloto). O app
> precisa falar a mesma língua em todo lugar. E falta uma divisão de grupo simples tipo Tricount."

**Vá para §17 para começar.** Tudo entre aqui e lá é o contrato sob o qual você executa.

---

## 1. Identidade & regras absolutas (contrato de autonomia)

Você é o **executor**, não um coordenador. Você implementa, testa, faz deploy e commita você mesmo.

**REGRAS ABSOLUTAS — nunca violar** (espelham `.cursor/rules/inline-council-no-subagents.mdc`,
`tech-lead-delegation.mdc`, `execution-style.mdc`, `phase-delivery-hardening.mdc`, `velocity-standard.mdc`):

1. **SEM subagents / SEM Task tool / SEM delegação.** Tudo inline, nesta sessão. Múltiplas perspectivas = múltiplas
   *seções de uma resposta*, nunca múltiplos agentes. (Custo = por request; um subagent = +1 request.)
2. **NÃO peça permissão para avançar entre unidades de trabalho.** O escopo está aqui + nas respostas da §16. Terminar uma
   milestone/gate é a deixa para **commitar, fazer deploy, atualizar o dev-log e começar a próxima** — não para parar.
   *(Exceção de hand-off — `always-end-with-askquestion.mdc` + `never-end-chat.mdc`:* nunca pause **no meio** do build, mas
   no **hand-off genuíno** — todos os critérios de §12 TRUE, **ou** um bloqueador de credencial/custo intransponível, **ou**
   o contexto realmente acabar — a **mensagem final termina com um `AskQuestion`**.)
3. **NÃO pare porque "é muito trabalho" ou "a conversa está longa".** Continue até §12 ser toda TRUE, ou até o contexto
   acabar de verdade (então feche o gate atual limpo, commit + deploy, escreva o handoff no dev-log e PARE LIMPO).
4. **NÃO resuma o que vai fazer — FAÇA.** Minimize narração; cada token conta numa sessão longa.
5. **Todo código, identificadores, comentários, mensagens de commit, nomes de arquivo → inglês.** Texto de UI → pt-BR via
   i18n (`t()` sempre, zero hardcode), com en/es quando o item tiver cópia nova. Este documento e o brain são em português.
6. **Domínio antes de UI**, uma mudança por vez, **teste junto com a mudança** (§8).
7. **Reuse o código existente — nunca reinvente** o que a §4/§6 dizem que já existe (a maior parte do trabalho desta leva é
   *ligar e dar coerência* a peças que já existem — `buildSessionFeed`, `piggy-ledger`, `connections`, `share-link`/`/t/`).
8. **Respeite a segurança de pager do WSL** (§11): sempre `git --no-pager …`, sempre `git commit -m`, nunca abra
   `less`/`vim`/flags interativas no terminal do agente.
9. **Mantenha o brain em sincronia** (§14): `src/dev-log.md` a cada milestone, `decision-log.md` em qualquer decisão nova,
   `project-status.md` no fim da leva.

Se aparecer ambiguidade genuína que o brain não resolve: **rode o council inline na hora** (1 request, sem subagents), pegue
a síntese, **escreva como `DEC-NNN` (PROPOSED)** no `decision-log.md` **e continue**. As dúvidas grandes já foram
pré-pesquisadas na §16 e pré-resolvidas tecnicamente em §7 (councils C-A…C-D).

---

## 2. Ordem de leitura (carregue o contexto uma vez, depois execute)

No **início da leva**, leia (nesta ordem):

1. **Este documento** §0–§9, depois o gate em que está em §10.
2. `src/dev-log.md` — o estado de execução (semeado em G0).
3. `brain/decision-log.md` — só os `DEC-NNN` citados pelo gate (esp. **DEC-206** rollup saída/item, **DEC-262** occasion
   count, **DEC-279/DEC-261** cofrinho, **DEC-098/DEC-112** margem do planner, **DEC-207** share link, **DEC-247** Wrapped,
   **DEC-093/DEC-236/DEC-264** Amigo Sincero, e os **novos DEC-295→DEC-30x** desta leva — §7).
4. `brain/product-spec.md` — entidades (Session/Transaction/SessionItem, Split, Settlement, Connections) e regras.
5. `brain/documents/design-system.md` + `src/styles/tokens.css` + `src/styles/globals.css` ao mexer em scrollbar/cores/barras (G1).

Não releia o brain inteiro por milestone. **Mas leia o arquivo citado no §6 ANTES de editá-lo** (símbolos podem ter mudado).

---

## 3. Não-negociáveis (releia antes de CADA gate)

Invariantes desta leva. Quebrar um é defeito mesmo que os testes passem.

**Herdados do app (ÂNCORA — continuam absolutos):**

- **Dinheiro = inteiro em centavos** (DEC-020). **Domínio = TS puro, zero import de React**; nenhuma lógica de negócio dentro
  de componente.
- **Texto de UI sempre via `t()`** (DEC-054), três idiomas quando o item tiver cópia.
- **ÂNCORA 9: esconder, nunca deletar** — nenhuma ação/feature some; no máximo muda de lugar/hierarquia.
- **ÂNCORA 11: invariância de dados** — recálculos puros (cofrinho/free-budget) recomputam para frente; nada novo é
  persistido sem migração Dexie justificada. Σ de itens de uma saída == total da saída, sempre.
- **Nunca bloquear o registro de gasto** (DEC-053). **Honestidade da matemática** — preservar.
- **Sistema de movimento** (60fps, `prefers-reduced-motion`), **tokens de tema**, `tabular-nums`, nav "glass" — preservar.
- **`/guide` + `/help`**, voz calorosa/anti-culpa, streaks, "Amigo Sincero", modo simples/completo — preservar.

**Novos, derivados desta leva (a regra geral do briefing):**

- **Uma saída é UMA entidade.** Em QUALQUER tela de resumo/filtro/carrossel/recentes/mapa/padrões, uma compra de
  nota/IA aparece como **1 saída** (não N itens). Itens só aparecem (a) dentro do detalhe da saída ou (b) numa **busca
  textual** explícita. Item sempre referencia a saída-mãe.
- **O app fala uma língua só.** Nenhuma tela diz "está tudo bem" enquanto outra parece dizer "está tudo errado" sem
  explicar a diferença. Os **estados** (real / planejado / alocado / livre / simulado / guardado / saída / item / acerto —
  §dicionário no fim) têm rótulo consistente em todo lugar.
- **Sem dead affordance.** Todo botão/ícone/CTA ou faz algo claro e **relacionado ao conteúdo ao lado dele**, ou é ocultado.
  (Amigo Sincero e cards do copiloto: CTA contextual, nunca fixo genérico.)
- **Sem susto evitável.** Vermelho = problema real (acabou / estourou / risco / crítico). Progresso normal = cor neutra/positiva.
  Todo alerta explica: o que aconteceu · por que importa · o que fazer · se é problema real ou só ajuste de planejamento.
- **Sem scrollbar visível** em nenhuma tela/modal/lista/card, em desktop/mobile/PWA. A rolagem funciona; a barra não aparece.
- **Preserve o que já está bom** (ponto 20: fases/carteiras/atividades; ponto 27: conversor/comparador) — só toque se houver
  inconsistência visual/texto confuso.

---

## 4. Baseline — o que JÁ existe e funciona (NÃO reinvente)

Mapa rápido do que o app já tem (confirmado por leitura de código nesta investigação). A leva é, em grande parte, **dar
coerência** a estas peças:

**Modelo de dados (o coração do briefing):**

- `src/domain/types/session.ts` → **`Session`** = a **"saída" agrupada** (nome, limites, status, `startedAt`/`endedAt`).
  **`SessionItem`** = ordem (sessionId ↔ transactionId).
- `src/domain/types/transaction.ts` → **`Transaction`** = um gasto/**item**. Carrega `sessionId: string | null`
  (quando ≠ null, o gasto é item de uma saída), `category`, `paidByParticipantId`, `personalCostCents`, `isShared`, etc.
- `src/domain/orchestrators/receipt-orchestrators.ts` → **`commitReceipt`** já cria **1 `Session` (completed) + N
  `Transaction`** com o mesmo `sessionId` + `SessionItem`s, tudo numa transação Dexie. **A estrutura está correta** — o
  problema é só de *leitura/exibição* em algumas telas.

**Leitura agrupada (já existe, parcialmente ligada):**

- `src/features/expenses/expense-feed.ts` → **`buildSessionFeed(txs, sessionById, collapse)`** já colapsa as N transações de
  uma sessão em UMA linha quando `collapse === true`. Usado em `ExpenseListPage.tsx` (l.197) e em
  `useDashboardModel.ts` (l.241, recentes). **Funciona** — o bug é o *gatilho* (ver §6, ponto 1).
- `src/domain/dashboard/occasion-counters.ts` → **`countOccasions`** (DEC-262) já conta saída como 1 ("Mercado, 2 gastos" =
  2 ocasiões, não 20 itens). O número do carrossel **já está certo**; o tap é que cai na lista itemizada.
- `src/domain/dashboard/heatmap.ts` → totais por dia/categoria já são agregados (corretos). O drill é que herda o bug.

**Cofrinho, copiloto, planner:**

- `src/domain/budget/piggy-ledger.ts` → **`buildPiggyLedger`** (Model B, DEC-279/261): saldo derivado por replay imutável;
  só "fecha" por dia. Simulação = previsão; saldo real = dias fechados. **Lógica correta** — falta só *clareza de UI*.
- `src/domain/copilot/copilot-insights.ts` → verdict de ritmo (`buildCopilotVerdict`), `summarizeDisciplineStreak`, etc.
- `src/features/planning/PlannerPage.tsx` → `freeMarginCents` (DEC-098, "nunca clampar — o negativo é informação") + o
  `over_allocation_warning`. **Correto**, mas mede *alocação futura*, não *ritmo real* → contradição é de mensagem.
- `src/features/dashboard/cards/PiggyStatementSheet.tsx` → extrato do cofrinho (reaproveitável no Copiloto).

**Amigo Sincero:**

- `src/features/dashboard/cards/AmigoSinceroCard.tsx` (carrossel verdict + extras) + `src/domain/budget/honest-friend*.ts`
  (voz/extras). O slide `piggy_movement` **já tem CTA próprio** (`onOpenPiggyStatement`) — é o **precedente** para tornar
  TODOS os CTAs contextuais.

**Pessoas conectadas / acerto / link público (a base do Tricount):**

- `src/domain/connections/connections.ts` → estados honestos `connected | waiting | offline` + `buildConnectionViews`.
- `src/domain/types/participant-share.ts` → `confirmationStatus: 'pending' | 'confirmed' | 'rejected'`.
- `src/domain/types/settlement.ts` + `src/domain/splitting/splitting.ts` → saldo líquido/acerto entre pessoas.
- `src/domain/sync/share-link.ts` → link público **`/s/`** (statement mirror → `SharedLinkPage`) e **`/t/`** (claim board ao
  vivo → `SplitTablePage`). Chave AES no fragmento (worker guarda ciphertext opaco). `src/domain/split/*`
  (`from-receipt`, `share-payload`, `claim-response`, `history`) + `src/features/split/*` + o worker Cloudflare.
- `src/utils/share-card.ts` → `renderShareCard` (canvas PNG) + `deliverShareCard` (OS share → fallback download).

**Navegação / FAB / settings:**

- `src/components/BottomNav.tsx` (RIGHT_NAV = Viagem + Copiloto[advanced]); `src/domain/app-mode.ts` (`visibleInMode`).
- `src/components/FAB.tsx` (ações curadas por valor/grupo).
- `src/features/settings/SettingsPage.tsx` (guia + central de ajuda + grid já usado em outra seção).
- `src/domain/help/help-catalog.ts` + `src/domain/guide/guide-catalog.ts` + `src/components/HelpMode.tsx` +
  atributos `data-help-anchor` espalhados.

---

## 5. Change-set, normalizado (o QUE muda nesta leva)

Os 28 pontos do briefing → itens de trabalho **C-NN** (C de "coherence"), agrupados por prioridade do Julio. Cada um aterrissa
num gate em §10 e tem causa-raiz em §6. **C25 é um adendo posterior (2026-06-24): foco de input.**

**P0 — corrigir agora (alta dor):**

- **C01** Saída × item: leitura **agrupada** em resumos/filtros/carrossel/recentes/mapa/padrões (pontos 1, 4, 5, 22).
- **C02** Detalhe da saída **acionável** (editar saída/itens/divisão, ver pagador, custo pessoal, itens, status de acerto) +
  item sempre referencia a saída-mãe (ponto 2).
- **C03** Remover **scrollbar visível** que voltou em várias telas (ponto 3).
- **C04** Coerência **Copiloto × Planejador** (mesma língua: gasto real × alocação futura) (ponto 11).
- **C05** Retrospectiva: botão **Compartilhar** dá feedback visível em todas as plataformas (ponto 21).
- **C06** Modo simples: **barra inferior** equilibrada (ponto 26).

**P1 — muito importante:**

- **C07** Amigo Sincero **contextual** (CTA por slide; ocultar se não houver ação) (ponto 7).
- **C08** Amigo Sincero na home **só quando relevante** (não duplicar insight) (ponto 8).
- **C09** Cofrinho **sempre acessível no Copiloto** (seção fixa) (ponto 12).
- **C10** Cofrinho: **simulado × será guardado × já guardado** explícitos (ponto 13).
- **C11** Acerto de contas + **pessoas conectadas**: estados claros + sync (ponto 9).
- **C12** **Vermelho** só quando há problema real; progresso normal = neutro/positivo (ponto 16).
- **C13** **Ajuda/tutoriais** atualizados para o que mudou + features novas (ponto 28).

**P2 — acabamento:**

- **C14** Espaçamento dos **insights** (dots) na home (ponto 6).
- **C15** **FAB**: "Iniciar saída" + "Dividir conta" lado a lado (ponto 17).
- **C16** **Settings**: dois botões grandes viram **grid** 2-up (ponto 24).
- **C17** Settings: revisar **menus internos** (ordem/nomes/avançado escondido) (ponto 25).
- **C18** **Prévia da fase**: separar "reservado" (pote) de "planejado" com microcópia (ponto 18).
- **C19** **Fundos** (tela interna): essencial primeiro, avançado depois (ponto 19, baixa pri).
- **C20** **Cards de padrões**: cada um diz se o dado é bom/ruim/neutro (ponto 23).
- **C21** Cards do Copiloto: **destino do clique combina com a mensagem** (economia diária → cofrinho) (ponto 14).
- **C22** "Sequência de disciplina": ícone/cópia coerentes (medalha só se positivo) (ponto 15).
- **C25** Foco dos inputs: **borda laranja** feia ao focar → foco discreto/neutro, preservando o anel de teclado (a11y)
  *(adendo 2026-06-24, fora dos 28 pontos originais)*.

**P3 — feature nova grande:**

- **C23** **Divisão de grupo tipo Tricount**: evento de grupo com várias despesas/pagadores, link público, participante
  escolhe o nome, vê quanto deve e marca como pago; criador confirma; sincroniza com os acertos para quem tem app
  (ponto 10).

**Revisar-e-confirmar (sem mexer salvo inconsistência):**

- **C24** Fases/carteiras/atividades (ponto 20) e Conversor/Comparador (ponto 27): só verificar; corrigir apenas se houver
  inconsistência visual/texto confuso.

---

## 6. Root-cause map (código ↔ mudança) — vá direto ao arquivo certo

> Leia o arquivo citado **antes** de editar (os símbolos podem ter mudado). Cada linha já traz a *direção* da correção.

| # | Sintoma (briefing) | Causa-raiz (arquivo → símbolo) | Direção da correção | Gate |
|---|---|---|---|---|
| C01 | Clicar "Mercado, 2 gastos" abre 20 itens soltos | `features/expenses/ExpenseListPage.tsx` → `isBrowsing` (l.191-192) **junta** filtros + busca; com qualquer filtro ativo, `buildSessionFeed(..., isBrowsing=false)` itemiza | Separe: **colapsa por sessão sempre que NÃO houver busca textual** (`collapseSessions = !searchQuery`), mesmo com filtro de categoria/perfil/lugar/carteira ativo. Só a **busca textual** itemiza. `expense-feed.ts` já suporta | G2 |
| C01 | Carrossel de categoria leva à lista itemizada | `features/dashboard/DashboardCards.tsx` → `navigate('/expenses?category=…')` (l.915) e `?profile=` (l.898); `DashboardPage.tsx` insight → `?category=` (l.300). Contagem já correta (`occasion-counters.countOccasions`) | Herdado de G2 (a lista passa a agrupar sob filtro). Verifique o destino abre a **lista de saídas** da categoria | G2 |
| C01 | Mapa do mês / padrões "explodem" a saída | `domain/dashboard/heatmap.ts` (totais agregados, OK) → drill em `features/dashboard/PhaseMapTabs.tsx` `SpentDayBreakdown` (l.264) é read-only agregado; o caminho p/ lista itemizada herda o bug de filtro | Herdado de G2. Garanta que nenhum resumo quebra saída em itens sem busca | G2 |
| C02 | Saída de nota/IA não dá pra editar/ver divisão | `features/outing/OutingReviewPage.tsx` é **read-only** (DEC-079, "without any editing affordances") | Torne o detalhe da saída **acionável**: editar nome/data, ver/editar divisão e pagador, custo pessoal, lista de itens (cada item → `ExpenseDetailPage`), status de acerto. Reuse os padrões de edição de `ExpenseDetailPage.tsx` e o review de fim de sessão de `OutingPage.tsx` | G3 |
| C02 | Item não mostra a que saída pertence | `features/expenses/ExpenseDetailPage.tsx` carrega `splitRecord` por `sessionId` (l.86) mas **não exibe** "parte de [saída]" | Adicione um chip **"parte de · [nome da saída]"** que abre o detalhe da saída; mostre categoria/data/hora/fundo/carteira/fluxo/custo pessoal/pagador/divisão (a maioria já existe no form) | G3 |
| C03 | Scrollbar visível voltou | `styles/globals.css` **já** esconde via `*::-webkit-scrollbar{display:none!important}` + `scrollbar-width:none` (l.135-145) + reforço `.cap-native #root` (l.186-194). Regressão = elemento/lib novo reexpondo (ex.: `scrollbar-gutter`, `overflow` em engine não-WebKit, root com `zoom`) | **Auditar** todas as telas/modais/listas-em-card por containers que reexpõem a barra; reaplicar `.no-scrollbar`/regra global; validar **desktop + mobile + PWA + cap-native**. Não reintroduzir `scrollbar-*: auto` | G1 |
| C04 | Copiloto diz "no controle", planner mostra -318 vermelho | `features/copilot/CopilotPage.tsx` verdict (ritmo real, `buildCopilotVerdict`) **vs** `features/planning/PlannerPage.tsx` `freeMarginCents` (l.409) + `over_allocation_warning` (l.870) (alocação futura) | **Reconciliar a cópia** (não a matemática): o aviso do planner explicita "isto é **planejamento/alocação futura**, não seu gasto real"; o copiloto, quando o plano está super-alocado, adiciona uma linha "seu gasto real está ok; ajuste o **plano**". Helper compartilhado que classifica os 5 casos (gasto real / planejamento / alocação / projeção / falta de ajuste) | G4 |
| C05 | "Compartilhar" na retrospectiva não faz nada | `features/copilot/TripWrappedSheet.tsx` → `handleShare` só dá toast em `'failed'` (l.86-87); em `'shared'/'downloaded'` **não há feedback** → no desktop baixa silenciosamente = "nada acontece". `TripOverviewPage.tsx` faz certo (toast em downloaded/shared, l.68-69) | Espelhe o `TripOverviewPage`: toast em `shared`/`downloaded`/`failed`; garanta canvas não-"tainted"; desktop baixa/copia com aviso visível | G6 |
| C06 | Modo simples: 2 ícones de um lado, 1 do outro | `components/BottomNav.tsx` → `RIGHT_NAV = [viagem, copiloto(advanced)]`; em simples, `visibleInMode` tira o copiloto → 2 (esq) + FAB + 1 (dir) | Rebalancear para **2+2** (Julio §16 Q1 / DEC-298): Início, Gastos · + · Viagem, **Ajustes** (settings ocupa a vaga do Copiloto escondido). Layout intencional, `visibleInMode` data-driven | G7 |
| C07 | Amigo Sincero: mesmo botão "Ver impacto" em tudo | `features/dashboard/cards/AmigoSinceroCard.tsx` → linha de ações (l.276-311) é **fixa, ancorada no verdict**, ignora o slide ativo. O slide `piggy_movement` já tem CTA próprio (l.426-434, precedente) | CTA **derivado do slide ativo** (`safeIndex`): verdict → "Ver impacto"; `top_category` → impacto da categoria; `piggy_movement` → cofrinho; `daily_left` → simular; sem ação útil → **ocultar botão** | G5 |
| C08 | Amigo Sincero na home duplica insight | `features/dashboard/useDashboardModel.ts` + `DashboardCards.tsx` (gating) + prop `hideOnPlan` (já esconde "on plan") | Mostrar só quando **acionável/novo**; não repetir o que o carrossel de insights já diz (de-dupe por tópico) | G5 |
| C09 | Cofrinho não aparece sempre no Copiloto | `features/copilot/CopilotPage.tsx` não tem seção de cofrinho (só o dashboard a tem) | **Seção fixa de cofrinho no Copiloto** reusando `PiggyStatementSheet`/`piggy-ledger`: saldo, entrou recente, extrato, relação com dias abaixo do plano, explicação curta | G4 |
| C10 | Cofrinho: simulado muda, saldo não | `domain/budget/piggy-ledger.ts` (Model B: saldo = dias fechados; simulação = previsão). Lógica correta | **Clareza de UI** nos modos (tranquilo/sem gastos) e no card: rótulos "**simulado** / **será guardado no fechamento** / **já guardado**". Nunca dizer "cofrinho agora tem X" se ainda não entrou | G4 |
| C11 | Acerto confuso com pessoas conectadas | `features/shared/SharedExpensesPage.tsx` + `domain/connections/connections.ts` (estados ok) + `participant-share.confirmationStatus` + `settlement` + `mirrored-statement` | Superfície clara de estados: **conectada / convite enviado / abriu link sem conta / confirmou participação / marcou pago / pagamento confirmado pelo criador**; quem deve, quem pagou, o que falta. Sync quando ambos têm app | G6 |
| C12 | Barra "livre na fase" verde+vermelho assusta | `features/dashboard/DashboardCards.tsx` barra hero free-to-spend (l.804 `linear-gradient(90deg, var(--success), var(--primary))`) + estados que viram `--error` cedo. `--primary` (terracota) lê como alerta | Rampa **neutra/positiva** para progresso normal; `--error` só em over-limit/reserva/crítico real. Estar perto do fim ≠ problema (pode ser fim da fase) | G1 |
| C13 | Ajuda/tutoriais desatualizados | `domain/help/help-catalog.ts` + `domain/guide/guide-catalog.ts` + `components/HelpMode.tsx` + `data-help-anchor` | Auditar/atualizar para: saídas, itens, divisão, conectados, acerto, cofrinho, potes, planejados, fundos, copiloto, Amigo Sincero, IA, nota, **Tricount**, modo simples (**re-auditoria COMPLETA** — Julio §16 Q8) | G7 |
| C14 | Dots de insights muito longe da linha de baixo | `features/dashboard/DashboardCards.tsx` → dots `flex justify-center gap-1.5 pb-2` (l.988) + padding inferior do card | Reduzir o gap inferior pra casar com os outros cards (ex.: "ver mais" do copiloto) | G1 |
| C15 | FAB: "Começar saída" full-width sozinho | `components/FAB.tsx` → `renderWideAction` (start_outing full) + hero "Dividir conta" separado | Parear "Iniciar saída" + "Dividir conta" 2-up (grupo data-driven), mantendo ÂNCORA 9 e a hierarquia dos heróis (IA/registrar) | G1 |
| C16 | Settings: 2 botões grandes empilhados | `features/settings/SettingsPage.tsx` → guia (l.658) + central de ajuda (l.678) empilhados; já há `grid grid-cols-2` (l.792) como precedente | `grid grid-cols-2`: esquerda "Tudo que dá pra fazer", direita "Central de ajuda" | G1 |
| C17 | Menus internos das settings confusos | `features/settings/SettingsPage.tsx` (seções) | Revisar ordem/nomes; mais usados primeiro; avançado escondido. Sem deletar (ÂNCORA 9) | G7 |
| C18 | Prévia da fase: pote × planejado confuso | `features/phases/PhasePreviewPage.tsx` + `domain/phases/phase-preview.ts` | Separar "**dinheiro reservado** (pote)" de "**gasto planejado**" com microcópia + exemplo curto; menos texto | G7 |
| C19 | Fundos: tela interna confusa | `features/funds/FundsPage.tsx` (view interna) | Baixa pri: essencial primeiro (saldo/entrada/saída/planejado/histórico); avançado em área secundária | G7 |
| C20 | Cards de padrões sem dizer bom/ruim/neutro | `features/copilot/CopilotPage.tsx` cards (weekday/peak/social/efficiency/projection/runway via `copilot-insights.ts`) | Cada card ganha uma linha de leitura (bom/ruim/neutro). Sem mexer no cálculo | G7 |
| C21 | Card "ontem gastou 0" leva a gastos, não cofrinho | `features/copilot/CopilotPage.tsx` navegações dos cards (ex.: l.912) | Cards de **economia diária** → cofrinho/explicação da economia do dia | G4 |
| C22 | Streak quebrado mostra **medalha** | `features/copilot/CopilotPage.tsx` (l.482) ícone `military_tech` (medalha) quando quebrado + copy `streak_broken`; `summarizeDisciplineStreak` | Medalha/fogo só quando **dentro do alvo**; quebrado = ícone neutro (ex.: `restart_alt`) + copy clara ("passou do alvo; melhor sequência foi N") | G4 |
| C23 | Falta divisão de grupo tipo Tricount | Novo, sobre `domain/split/*` + `share-link.ts` (`/t/` `SplitTablePage`, `/s/` `SharedLinkPage`) + `claim-response` + `mirrored-statement` + `settlement` + worker | **Entidade nova de evento de grupo** (decisão C-C/§16 Q4) agregando várias despesas/pagadores; link público de claim; marca pago; criador confirma; sincroniza com acertos. Escopo MVP em **§16 Q3** | G8 |
| C24 | Fases/carteiras/conversor/comparador | `features/{trip,wallets,converter,comparator}/*` | **Revisar e confirmar**; só corrigir inconsistência visual/texto. Não mexer no que funciona | G7 |
| C25 | Inputs com **borda laranja** feia ao focar | `styles/globals.css` → `:focus-visible { outline: 2px solid var(--primary); box-shadow: 0 0 0 4px var(--glow) }` (l.339-342); `--primary` = terracota `#C75B39` (`tokens.css` l.9/117). Em campo de texto o `:focus-visible` dispara **também no clique de mouse** → anel laranja ao focar input. Criado por **M01/DEC-285** (WCAG 2.4.7) | **Neutralizar e deixar BEM sutil** o foco de formulário (`input/textarea/select/[contenteditable]`): remover o outline laranja + glow; foco **mínimo/discreto** — ex.: `outline:none` + leve realce de `border-color` neutra **ou** ring fino de 1–2px em `--border-subtle`, **sem glow**. Manter só o mínimo perceptível por teclado (a11y; não regredir DEC-285). **Julio (2026-06-24): o mais sutil possível, sem remover de vez.** DEC-305 | G1 |

---

## 7. Decisões + councils inline (resolvidos AGORA, sem subagents)

> Cada council rodou **inline, 1 request, sem subagents** (per `inline-council-no-subagents.mdc`): brief neutro → 4 vozes
> cegas → red team → síntese. Aqui ficam destiladas em decisões. **DEC-295→DEC-30x** entram no `decision-log.md` como
> PROPOSED no G0 (ou já estão lá).

### Council C-A — Ordem dos gates para sessão única
**Brief:** 28 itens + 1 feature grande, executados numa sessão contínua por 1 agente; minimizar drift de contexto e
regressão; maximizar valor cedo. **Síntese:** comece pelo **global/barato e isolável** (G1: scrollbar, cores, spacing,
FAB, settings grid) — pega muitas telas com baixo risco e calibra o olho. Depois a **clareza de dados** (G2 leitura
agrupada; G3 detalhe da saída) — é a maior dor e desbloqueia confiança. Depois **coerência de mensagem** (G4 copiloto/
cofrinho/streak; G5 Amigo Sincero) — agora que os dados estão certos, a narrativa pode alinhar. Depois **pessoas/
compartilhar** (G6 acerto+conectados+retrospectiva). Depois **estrutura/acabamento/ajuda** (G7 nav simples, prévia,
fundos, padrões, settings menus, ajuda). **Por último a feature nova** (G8 Tricount) — maior risco/maior superfície,
isolada, com tudo o resto já estável e testado. → **DEC-295.**

### Council C-B — Semântica do colapso Saída × Item sob filtro
**Brief:** ao filtrar por categoria/lugar, uma saída pode ter itens de várias categorias; o que a linha colapsada mostra?
**Síntese:** colapsa por `sessionId` **entre as transações que casam com o filtro**; a linha mostra **nome da saída +
"N itens nesta categoria" + subtotal filtrado** (honesto ao filtro), e o tap abre o **detalhe completo da saída** (total
cheio + todos os itens). Busca textual continua itemizando (o usuário quer o item específico). Split-commit continua só em
Gastos (não vira "saída" na aba Saídas) — comportamento já existente preservado. → **DEC-296.**

### Council C-C — Tricount: nova entidade vs estender o bill-split
**Brief:** o bill-split atual é de **uma conta/um momento** (scan → dividir → commit), com link `/t/` + claim. O Tricount é
**multi-despesa, multi-pagador, persistente** (um churrasco com várias notas). **Síntese:** criar uma **entidade-agregado
nova** ("evento de divisão de grupo") que **reusa** a infra existente (link público `/t/`/`/s/`, `claim-response`,
`mirrored-statement`, `settlement`, worker) em vez de sobrecarregar o `Split` de conta única. Razão: modelos mentais e
ciclos de vida diferentes; sobrecarregar o split single-bill arriscaria regressão num fluxo crítico. Reuso de transporte e
de acerto, agregado novo. **Red team:** "duas entidades parecidas = dívida" → mitigado mantendo o **transporte/crypto/claim
100% compartilhados**; só o agregado (lista de despesas + participantes do evento) é novo. → **DEC-297.**

### Council C-D — Layout da barra no modo simples
**Brief:** remover o Copiloto deixa 2-1 ao redor do FAB. **Síntese (quick, Architect+Advocate):** simetria importa mais que
manter um item específico. **Recomendação:** **2+2** — Início, Gastos · (+) · Viagem, **Ajustes** (settings entra à direita
no lugar do Copiloto escondido, é beginner-safe). Alternativas: **1+1** mínimo (Início · + · Gastos — mais limpo, mas tira
Viagem) ou remover um item à esquerda. **Julio (§16 Q1) escolheu 2+2.**
→ **DEC-298 (LOCKED: 2+2 — Início, Gastos · + · Viagem, Ajustes).**

### Decisões diretas (sem council — claras pelo briefing/código)

- **DEC-299** — **Política de cor das barras** (C12): progresso normal = neutro/positivo (`--success`/`--steady`/`--surface`);
  `--error` só quando dinheiro acabou / estourou limite / entrou na reserva / fase crítica. Tokenizado, herda no tema claro.
- **DEC-300** — **Cofrinho fixo no Copiloto** (C09) e **estados simulado/será-guardado/guardado** (C10) como cópia padrão em
  todo lugar que toca o cofrinho (check-in, card, extrato).
- **DEC-301** — **CTA contextual do Amigo Sincero** (C07): o CTA é função do slide ativo; sem ação útil → sem botão.
- **DEC-302** — **Detalhe de saída acionável** (C02): a saída ganha editar/divisão/pagador/itens; o item ganha back-link à
  saída. Sem nova entidade (usa Session/Transaction existentes).
- **DEC-303** — **Feedback de share universal** (C05): toda ação de compartilhar dá retorno visível (share/baixou/falhou).
- **DEC-304** — **Dicionário de estados** (regra geral de linguagem): real/planejado/alocado/livre/simulado/guardado/saída/
  item/acerto têm rótulo e cor consistentes em todo o app (ver fim do doc).
- **DEC-305** — **Foco de input neutro e BEM sutil** (C25, adendo 2026-06-24; **Julio escolheu o mais discreto possível, sem
  remover de vez**): o anel de foco global laranja (`outline: 2px solid var(--primary)` + `--glow`, de DEC-285) fica feio nos
  campos de texto (o `:focus-visible` dispara até no clique de mouse). Para `input/textarea/select/[contenteditable]`, trocar
  por foco **mínimo, neutro e discreto** — sem laranja e **sem glow**; ex.: leve realce de `border-color` neutra **ou** ring
  fino de 1–2px em `--border-subtle`. **Manter só o mínimo perceptível por teclado** (WCAG 2.4.7 / DEC-285 preservado);
  botões/links/cards mantêm o anel atual.

---

## 8. Estratégia de testes (teste JUNTO com a mudança)

Stack: **Vitest** (unit, domínio) + **Playwright** (E2E). Regra do projeto (`.cursor/rules/test-routing.mdc`): rodar e
escrever testes **direto** (sem subagents). Comandos em §17.

- **Domínio puro primeiro.** Toda mudança de lógica/colapso/cofrinho/acerto/Tricount nasce com teste de matemática com
  números concretos (>90% no domínio). Ex.: `buildSessionFeed` sob filtro (C01), reconciliação copiloto/planner (C04),
  estados de conexão/acerto (C11), split de grupo igual/personalizado (C23).
- **Reuse os testes existentes** (`src/tests/unit/features/expenses/expense-feed.test.ts`,
  `domain/dashboard/*`, `domain/budget/*`, `domain/splitting/*`) — estenda, não duplique.
- **UI crítica via Playwright** (>70%): clicar categoria → ver **saídas** (não itens) (C01); abrir saída → editar/ver divisão
  (C02); compartilhar retrospectiva → toast (C05); modo simples → barra equilibrada (C06); Tricount → criar/dividir/link/
  marcar pago (C23).
- **Sem scrollbar (C03):** teste visual/asserção de que containers roláveis têm a classe/regra; checagem manual desktop+
  mobile+PWA na matriz §15.
- **Invariante de dados:** após qualquer mudança de leitura, Σ itens == total da saída; nenhum total muda só por reorganizar
  exibição (ÂNCORA 11). Rode a suíte **completa** entre gates (0 falhas) — §10/§12.

---

## 9. Protocolo de execução por milestone (5-point self-check) + refresh

Antes de **cada commit de milestone** (espelha `phase-delivery-hardening.mdc`):

1. Liste os AC satisfeitos (IDs do gate).
2. Nomeie **3 AC anteriores em risco de regressão** e verifique-os (esp. ÂNCORA 11, registro de gasto nunca bloqueia,
   números idênticos).
3. Rode os testes — **sem novas falhas**.
4. Sinalize qualquer arquivo tocado **fora** do escopo do milestone.
5. Atualize `src/dev-log.md` (o que fez, testes, riscos).

**Refresh de contexto (in-session) em cada fronteira de gate:** releia `project-rules`/§3 deste doc, releia o escopo do
**próximo** gate, releia o `dev-log` Current State, imprima o bloco NÃO-NEGOCIÁVEIS (§3) e o CURRENT STATE (gate, commit,
testes, riscos, escopo). **Mid-gate (a cada 3 milestones):** refresh leve (regras críticas + dev-log).

---

## 10. O BUILD — gates (G0→G8)

> Cada gate: **Por quê · Causa-raiz · Mudança · AC · Testes · Commit/Deploy.** Feche o gate com a suíte **completa** verde,
> build OK, smoke das 3 jornadas (registrar gasto · "posso gastar?" · abrir saída/divisão), dev-log atualizado, refresh.

### G0 — Setup, baseline e dev-log
**Por quê:** começar de um chão verde e rastreável.
**Mudança:** `npm install`; rodar `npm run test` + `npm run build` + `tsc --noEmit` e registrar o baseline; criar/atualizar
`src/dev-log.md` (Current State + tabela de milestones); registrar `DEC-295→304` no `decision-log.md` como PROPOSED;
confirmar deploy pipeline (§17).
**AC:** baseline verde documentado; dev-log semeado; DECs registrados.
**Commit:** `chore(coherence): seed dev-log + baseline for coherence leva`.

### G1 — Higiene global & baixo risco (C03, C12, C14, C15, C16, C25)
**Por quê:** barato, global, calibra o olho, baixo risco de regressão.
**Causa-raiz:** §6 C03 (scrollbar), C12 (cores das barras), C14 (dots insights), C15 (FAB), C16 (settings grid),
C25 (borda laranja de foco nos inputs).
**Mudança:**
- C03: auditar e eliminar scrollbar visível (telas/modais/listas-em-card; desktop/mobile/PWA/cap-native).
- C12: rampa de cor neutra/positiva no progresso; `--error` só em risco real (tokenizado).
- C14: reduzir o gap inferior dos dots de insights.
- C15: parear "Iniciar saída" + "Dividir conta" no FAB.
- C16: settings → `grid grid-cols-2` para guia + central de ajuda.
- C25: deixar o foco dos campos de formulário (`input/textarea/select/[contenteditable]`) **neutro e BEM sutil** — tirar o
  outline laranja (`var(--primary)`) + glow; usar o mínimo (ex.: borda neutra levemente realçada ou ring fino 1–2px
  `--border-subtle`, sem glow), **mantendo o foco perceptível por teclado** (DEC-305/DEC-285, WCAG 2.4.7).
**AC:** zero scrollbar visível em qualquer superfície; nenhuma barra de progresso normal lê como alerta; dots compactos;
FAB equilibrado; settings 2-up; **inputs sem borda laranja ao focar, com foco por teclado ainda visível**. Nada de função
some (ÂNCORA 9).
**Testes:** asserção de classe no-scrollbar; teste de mapeamento cor↔estado (C12) com números; **asserção de que o foco de
input não usa `--primary` no outline**; visual manual teclado×mouse (§15).
**Commit (por item):** `fix(ui): …` / `style(ui): …`. **Deploy** ao fim do gate.

### G2 — Saída × Item: leitura agrupada (C01)
**Por quê:** a maior dor — "os dados parecem errados".
**Causa-raiz:** §6 C01 (`ExpenseListPage.isBrowsing` junta filtro+busca; carrossel/heatmap herdam).
**Mudança:** separar **colapso por sessão** (ativo sempre que NÃO há busca textual) de **itemização** (só na busca textual).
Garantir que carrossel de categoria, recentes, mapa do mês e padrões caem na **lista de saídas** da categoria. Implementa
DEC-296 (linha = nome da saída + N itens da categoria + subtotal filtrado; tap → detalhe completo).
**AC (do briefing):** clicar categoria/agrupamento → **saídas principais**; buscar "queijo" → pode mostrar o item; item →
referencia a saída; nenhuma tela de resumo explode a compra em itens sem o usuário pedir.
**Testes:** `expense-feed` sob filtro de categoria (colapsa) vs busca textual (itemiza), com números; E2E carrossel→saídas.
**Commit:** `fix(expenses): group outings under category/card filters; itemise only on text search`.

### G3 — Saída: detalhe acionável + item→saída (C02)
**Por quê:** abrir uma saída e "não conseguir fazer quase nada".
**Causa-raiz:** §6 C02 (`OutingReviewPage` read-only; `ExpenseDetailPage` sem back-link).
**Mudança:** detalhe da saída ganha editar (nome/data), ver/editar **divisão** e **pagador**, **custo pessoal**, **itens**
(cada item → `ExpenseDetailPage`), **status de acerto** e participantes conectados/não. Item ganha chip "parte de · [saída]".
Implementa DEC-302 (sem nova entidade).
**AC:** ao abrir qualquer saída (inclusive de IA/nota), o usuário entende tudo e edita sem caçar item a item; o item sempre
mostra a saída-mãe.
**Testes:** E2E abrir saída de recibo → editar item → divisão visível; unit do mapeamento saída↔itens↔shares.
**Commit:** `feat(outing): actionable outing detail (edit/split/payer/items) + item→outing back-link`.

### G4 — Copiloto coerente + cofrinho (C04, C09, C10, C21, C22)
**Por quê:** o app precisa falar uma língua só; o cofrinho é importante e some.
**Causa-raiz:** §6 C04 (copiloto×planner), C09/C10 (cofrinho), C21 (destino de card), C22 (streak).
**Mudança:**
- C04: helper de reconciliação + cópia que separa **gasto real** de **alocação/planejamento futuro**; planner e copiloto
  deixam de se contradizer (DEC-295 contexto).
- C09: **seção fixa de cofrinho no Copiloto** (reusa `PiggyStatementSheet`/`piggy-ledger`): saldo, entrou recente, extrato,
  relação com dias abaixo do plano, explicação curta.
- C10: rótulos **simulado / será guardado no fechamento / já guardado** em todo lugar que toca o cofrinho.
- C21: cards de economia diária → cofrinho/explicação.
- C22: ícone/cópia da "sequência de disciplina" coerentes (medalha só dentro do alvo).
**AC:** nunca uma tela diz "tudo bem" e outra "tudo errado" sem explicar; cofrinho sempre acessível no Copiloto; o usuário
distingue simulado de guardado; destino do clique combina com a mensagem; nada de medalha em mensagem negativa.
**Testes:** unit do classificador real×plano (C04); unit dos rótulos do cofrinho (C10); E2E copiloto→cofrinho.
**Commit (por item):** `feat(copilot): …` / `fix(copilot): …`.

### G5 — Amigo Sincero contextual (C07, C08)
**Por quê:** "recurso falso" quando o botão é sempre o mesmo.
**Causa-raiz:** §6 C07 (ação fixa ancorada no verdict) + C08 (relevância na home).
**Mudança:** CTA derivado do **slide ativo** (`safeIndex`): verdict→impacto; `top_category`→impacto da categoria;
`piggy_movement`→cofrinho; `daily_left`→simular; sem ação útil→**ocultar** (DEC-301). Home: mostrar só quando acionável/novo,
sem duplicar o carrossel de insights.
**AC:** cada insight do Amigo Sincero tem CTA próprio que explica a frase clicada; nada de "Ver impacto" repetido; sem botão
quando não há ação boa; na home não duplica insight nem ocupa espaço com frase fraca.
**Testes:** unit do mapeamento slide→CTA; E2E swipe muda o CTA; gating da home.
**Commit:** `feat(amigo-sincero): per-slide contextual CTA + home relevance gating`.

### G6 — Acerto, pessoas conectadas & retrospectiva (C11, C05)
**Por quê:** clareza de quem deve/pagou/conectou; e o share que "não faz nada".
**Causa-raiz:** §6 C11 (`SharedExpensesPage`+`connections`+`participant-share`+`settlement`), C05 (`TripWrappedSheet.handleShare`).
**Mudança:**
- C11: superfície de estados (conectada / convite enviado / abriu sem conta / confirmou / marcou pago / confirmado pelo
  criador); quem deve, quem pagou, o que falta; sync quando ambos têm app.
- C05: feedback visível em todo share (toast share/baixou/falhou), espelhando `TripOverviewPage` (DEC-303).
**AC:** a tela de acerto deixa claro o ciclo todo de cada pessoa; clicar compartilhar **sempre** executa ação visível.
**Testes:** unit dos estados de conexão/acerto; E2E acerto com pessoa conectada; E2E share→toast.
**Commit:** `feat(shared): explicit connection+settlement states` · `fix(wrapped): visible share feedback on all platforms`.

### G7 — Estrutura, acabamento & ajuda (C06, C17, C18, C19, C20, C13, C24)
**Por quê:** acabamento e clareza fina + ajuda em dia.
**Causa-raiz:** §6 C06 (nav simples), C17 (menus settings), C18 (prévia fase), C19 (fundos), C20 (padrões), C13 (ajuda),
C24 (revisar fases/carteiras/conversor).
**Mudança:** rebalancear barra do modo simples para **2+2** (DEC-298/§16 Q1: Início, Gastos · + · Viagem, Ajustes); revisar
menus internos de settings (ordem/avançado escondido); prévia da fase separa reservado×planejado com microcópia; fundos
interno mostra essencial primeiro; cada card de padrões diz bom/ruim/neutro; **RE-AUDITORIA COMPLETA da ajuda** (Julio §16 Q8)
— `help`/`guide`/`HelpMode`/`data-help-anchor` em TODAS as superfícies (saídas/itens/divisão/conectados/acerto/cofrinho/potes/
planejados/fundos/copiloto/Amigo Sincero/IA/nota/Tricount/modo simples), atualizando os existentes e criando os que faltam;
revisar fases/carteiras/conversor/comparador (corrigir só inconsistência). **Gate maior pela re-auditoria → divida a ajuda em
milestones por área** (ex.: saídas/itens, divisão/acerto/conectados, cofrinho/potes/planejados/fundos, copiloto/Amigo Sincero,
IA/nota/Tricount, modo simples) e mantenha a suíte verde entre cada um.
**AC:** modo simples parece intencional; settings/prévia/fundos mais claros; padrões com leitura; **toda** a ajuda do app
está revisada e cobre as features novas; nada que funciona foi quebrado.
**Testes:** E2E modo simples (layout) + smoke de ajuda nas telas-chave.
**Commit (por item):** `fix(nav)/fix(settings)/fix(phases)/fix(funds)/docs(help): …`.

### G8 — Função tipo Tricount (C23) — feature nova grande, por último
**Por quê:** maior risco/superfície; só depois que tudo está estável.
**Causa-raiz:** §6 C23 (novo agregado sobre `split/*`+`share-link`+`claim-response`+`mirrored-statement`+`settlement`+worker).
**Mudança (DEC-297; escopo COMPLETO — Julio §16 Q3):** entidade nova de **evento de divisão de grupo** (nome do evento,
participantes por nome + conectados do app + sem app, despesas **manuais + por IA + leitura de nota fiscal**, quem pagou,
divisão **igual E personalizada — ambas no escopo desta leva**), **link público de claim** (reusa `/t/`/`/s/`): a pessoa
escolhe o nome, vê quanto deve e a quem, marca pago; criador confirma; **sincroniza com os acertos** para quem tem app;
histórico salvo no app. Pessoa **sem app** vê tudo e marca pago sem criar conta.
**Gate grande → divida em milestones:** (m1) agregado + CRUD do evento + participantes (nome/conectados/sem app); (m2)
despesas manuais + divisão igual + multi-pagador; (m3) IA + leitura de nota dentro do evento; (m4) divisão personalizada;
(m5) link público + claim (escolher nome) + marcar/confirmar pago; (m6) sync com acertos + histórico salvo + guest sem app.
**AC (do briefing):** cobre o caso básico do Tricount — criar grupo, adicionar despesas, dividir, compartilhar link,
controlar pagamentos; sem-app vê evento/lista/total/seu valor/para quem/status/botão pago; com-app recebe no app, entra nos
acertos, histórico salvo, pagamento atualiza o acerto.
**Testes:** unit do split de grupo (igual/personalizado, multi-pagador) com números; E2E criar evento→link→claim→marcar pago→
confirmar→acerto sincronizado; teste do guest sem conta.
**Commit (por milestone):** `feat(group-split): …`. **Deploy + smoke** ao fim.

---

## 11. Segurança de terminal (WSL) — leia antes de qualquer git

Espelha `.cursor/rules/terminal-pager-safety.mdc`. O terminal do agente trava para sempre num pager.

- **git sempre com `--no-pager`**: `git --no-pager log/diff/show/status`. Commit **sempre** `-m` (HEREDOC para multi-linha).
- **Nunca** `less`/`more`/`man`/`vim`/`nano`/`-i`/`rebase -i`. CLIs incertas → `| cat`.
- Se um comando travar >30s sem saída: não re-rode; leia o terminal file, ache o pid e mate o processo preso.

---

## 12. Definition of Done (a leva acabou quando TUDO é TRUE)

- [ ] **P0** completo: C01 (agrupado), C02 (detalhe acionável), C03 (zero scrollbar), C04 (copiloto×planner coerentes),
      C05 (share com feedback), C06 (modo simples equilibrado).
- [ ] **P1** completo: C07/C08 (Amigo Sincero contextual + relevante), C09/C10 (cofrinho no copiloto + estados claros),
      C11 (acerto+conectados), C12 (vermelho só em risco real), C13 (ajuda — **re-auditoria COMPLETA**, §16 Q8).
- [ ] **P2** completo: C14 (insights), C15 (FAB), C16 (settings grid), C17 (menus), C18 (prévia), C19 (fundos), C20 (padrões),
      C21 (destino de card), C22 (streak), **C25 (foco de input sem borda laranja)**.
- [ ] **P3**: C23 (Tricount) **escopo COMPLETO** (§16 Q3) — criar/despesas (manuais + IA + leitura de nota)/dividir (igual **e
      personalizada**)/link/pagamentos — com sem-app e com-app+sync.
- [ ] **Dicionário de estados** (DEC-304) aplicado: real/planejado/alocado/livre/simulado/guardado/saída/item/acerto
      consistentes em rótulo e cor.
- [ ] Suíte **completa** verde (0 falhas), `npm run build` + `tsc --noEmit` OK, smoke das 3 jornadas OK.
- [ ] `dev-log.md`, `decision-log.md` (DEC-295→304 APPROVED), `project-status.md` atualizados; versão = **1.0.0-rc** ao entrar
      o Tricount (§16 Q9), 0.99.6x por gate até lá.
- [ ] Deploy feito; nada que já funcionava/era bonito regrediu (ÂNCORA 9/11).

---

## 13. Anti-padrões (NÃO faça)

- ❌ Mudar a **matemática** para "resolver" a contradição copiloto×planner — é cópia/contexto, não cálculo (C04).
- ❌ Persistir saldo de cofrinho ou "simular = guardar" — Model B é puro; é só rótulo (C10/ÂNCORA 11).
- ❌ Itemizar resumos por padrão — só a **busca textual** itemiza (C01).
- ❌ Sobrecarregar o `Split` de conta única para virar Tricount — agregado novo, transporte reusado (C23/DEC-297).
- ❌ Reintroduzir scrollbar com `scrollbar-*: auto`/`scrollbar-gutter` (C03).
- ❌ Deletar qualquer ação/feature (ÂNCORA 9). ❌ Hardcode de texto (use `t()`). ❌ Vermelho em progresso normal (C12).
- ❌ Subagents/Task tool. ❌ git sem `--no-pager`. ❌ Parar no meio sem §12 TRUE.

---

## 14. Sincronia com o brain

- `src/dev-log.md` — a cada milestone (Current State + entrada).
- `brain/decision-log.md` — `DEC-295→304` (PROPOSED no G0 → APPROVED no fim); novas decisões de council inline = novos DEC.
- `brain/product-spec.md` — adicionar a feature de **divisão de grupo (Tricount)** e o **dicionário de estados** quando G8/DEC-304 fecharem.
- `brain/project-status.md` — status/itens pendentes/próximos passos no fim da leva.
- (Opcional) apontar deste doc no índice do brain quando ACTIVE.

---

## 15. Matriz de teste manual (smoke por plataforma)

| Jornada | Desktop (PWA) | Mobile (PWA) | cap-native |
|---|---|---|---|
| Clicar categoria no carrossel → ver **saídas** (não itens) | ☐ | ☐ | ☐ |
| Buscar "queijo" → ver o **item**; abrir → mostra a saída-mãe | ☐ | ☐ | ☐ |
| Abrir saída de nota → editar item / ver divisão / pagador | ☐ | ☐ | ☐ |
| **Sem scrollbar** visível em telas/modais/listas-em-card | ☐ | ☐ | ☐ |
| Focar um input → **sem borda laranja**; foco por teclado ainda visível | ☐ | ☐ | ☐ |
| Copiloto não contradiz o planner (mensagem clara) | ☐ | ☐ | ☐ |
| Cofrinho acessível no Copiloto; simulado × guardado claros | ☐ | ☐ | ☐ |
| Amigo Sincero: CTA muda com o slide; some sem ação | ☐ | ☐ | ☐ |
| Compartilhar retrospectiva → ação visível (toast) | ☐ | ☐ | ☐ |
| Modo simples → barra equilibrada | ☐ | ☐ | ☐ |
| Tricount: criar evento → link → claim → marcar pago → acerto | ☐ | ☐ | ☐ |

---

## 16. Perguntas para o Julio — ✅ RESPONDIDAS & LOCKADAS (2026-06-24)

> As 9 dúvidas foram respondidas pelo Julio em **2026-06-24** e estão **lockadas** abaixo (e refletidas em §6/§7/§10/§12). O
> implementador **segue estas respostas** — não re-pergunta. Ambiguidade NOVA → council inline + `DEC-NNN` + segue.

| # | Pergunta | Resposta LOCKADA |
|---|----------|------------------|
| Q1 | Barra do modo simples (C06) | **2+2 simétrico** — Início, Gastos · (+) · Viagem, **Ajustes** (DEC-298) |
| Q2 | Colapso da saída sob filtro (C01) | **Subtotal filtrado** ("Mercado · N itens nesta categoria · €X"); tap abre a saída completa (DEC-296) |
| Q3 | Escopo do Tricount (C23) | **COMPLETO agora** — manuais + **IA/leitura de nota** + divisão **igual E personalizada** (G8 vira gate maior, em milestones) |
| Q4 | Arquitetura do Tricount (C23) | **Entidade-agregado nova**, reusando link/claim/acerto (DEC-297) |
| Q5 | Cor das barras (C12) | **Sim** — progresso normal neutro/positivo; vermelho só em risco real (DEC-299) |
| Q6 | Amigo Sincero na home (C08) | **Ocultar** quando for só "on plan"/duplicado; só com algo acionável/novo |
| Q7 | Cofrinho no Copiloto (C09) | **Seção fixa**, sempre acessível (DEC-300) |
| Q8 | Ajuda/tutoriais (C13) | **Re-auditoria COMPLETA** de toda a ajuda agora (G7 vira gate maior, ajuda em milestones por área) |
| Q9 | Versão | **1.0.0-rc** quando o Tricount entrar; 0.99.6x por gate até lá |

**Efeito no plano:** Q3 e Q8 ampliam **G8** e **G7** — ambos viram gates maiores, divididos em milestones (§10), mantendo a
suíte verde entre cada um. As demais respostas confirmaram os defaults já desenhados (nenhum retrabalho).

---

## 17. GO — comece aqui

1. **Leia** §0–§9 (uma vez). As respostas da §16 já estão **lockadas** e o doc está **ACTIVE** — não re-pergunte; siga os
   valores lockados (nav **2+2**, colapso = subtotal filtrado, Tricount **completo**, ajuda **re-auditoria completa**,
   vermelho só em risco real, Amigo Sincero oculto quando redundante, cofrinho seção fixa, versão **1.0.0-rc** no Tricount).
2. **G0:** instale, rode baseline, semeie `dev-log.md`, registre `DEC-295→304` (PROPOSED).
   ```bash
   cd TripPilot
   npm install
   npm run test            # baseline (anote contagem)
   npm run build && npx tsc --noEmit
   npx playwright test      # se o ambiente E2E estiver disponível
   ```
3. **Execute G1 → G8 em ordem** (§10), uma milestone por vez, **testando junto** (§8), com o self-check de 5 pontos (§9) antes
   de cada commit, **refresh** em cada fronteira de gate.
4. **Deploy** ao fim de cada gate (pipeline padrão do projeto — Cloudflare Pages/worker; confirme o comando no `package.json`/
   `wrangler` e registre no dev-log no G0).
5. **Não pare** até §12 ser toda TRUE — ou até o contexto realmente acabar (feche o gate atual limpo, commit + deploy,
   handoff no dev-log, **pare limpo**) — ou um bloqueador intransponível (então a mensagem final termina com `AskQuestion`).

---

## Apêndice — Dicionário de estados (DEC-304, a "mesma língua" do app)

| Estado | Significado | Cor/Tom |
|---|---|---|
| **Gasto real** | Dinheiro que já saiu de verdade | neutro |
| **Planejado** | Dinheiro que o usuário pretende gastar | informativo |
| **Alocado** | Reservado em plano/pote | informativo |
| **Livre** | Ainda pode ser usado | positivo |
| **Cofrinho** | Economizado por gastar abaixo do ritmo/plano | positivo |
| **Simulado** | Hipotético, ainda não confirmado | neutro/itálico |
| **Guardado** | Já entrou no cofrinho | positivo |
| **Saída** | Gasto principal, pode conter vários itens | — |
| **Item** | Parte interna de uma saída | — |
| **Acerto** | Dívida/reembolso entre pessoas | atenção só se pendente real |

**Regra geral de alerta:** todo aviso explica **o que aconteceu · por que importa · o que fazer · se é problema real ou só
ajuste de planejamento**. Vermelho = problema real. Nunca assustar sem explicar.
