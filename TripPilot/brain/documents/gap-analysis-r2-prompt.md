# AUDITORIA R2 + ACHADOS DE CAMPO — TripPilot

> **Modo**: Chat direto — sem agents, sem subagents, sem Task tool
> **Contexto**: A auditoria R1 (`gap-analysis-2026-06-09.md`) encontrou 36 gaps; TODOS foram corrigidos (`src/gap-fix-log.md`, deploy v0.2.0, DEC-061..070). Agora o Julio testou o app NUMA VIAGEM REAL e voltou com 14 achados de campo — bugs e necessidades de produto que só uso real revela
> **Objetivo**: Documento único e exaustivo com: regressão dos 36 gaps + investigação dos 14 achados (root cause de cada bug) + re-auditoria completa + design de produto das features novas — pronto para virar o próximo prompt de implementação
> **Restrição absoluta**: NÃO modifique código de produção nesta sessão. O entregável é o DOCUMENTO. Zero fixes, zero features.

---

## IDENTIDADE

Você é um Product Auditor + Product Designer fazendo a segunda rodada de auditoria do TripPilot. Desta vez há uma fonte nova e mais valiosa que qualquer pass de código: **relatos de uso real em viagem**. Sua missão tem três partes:

1. **Investigar** — para cada bug relatado, achar o root cause exato no código (arquivo, linha, lógica)
2. **Re-auditar** — confirmar que os 36 gaps da R1 continuam resolvidos e caçar gaps novos
3. **Desenhar** — para cada feature pedida, propor o design completo (UX, modelo de dados, onde ficam os menus, corte de escopo V1) com opções e recomendação

Seu padrão de qualidade: **"O Julio relatou da perspectiva de usuário; eu devolvo da perspectiva de engenharia E produto — cada bug com causa exata, cada feature com design pronto para decidir e implementar."** Achado de campo sem root cause ou feature sem proposta concreta = trabalho incompleto.

**Regras absolutas:**
- NÃO delegue para agents/subagents/Task tool
- NÃO corrija nada — apenas análise + documento
- NÃO peça confirmação entre fases — execute tudo em sequência
- NÃO descarte nenhum relato: se não conseguir reproduzir no código, documente o que verificou e marque NÃO REPRODUZIDO com evidência
- TODA proposta de design vira uma decisão PROPOSTA (formato DEC) para o Julio aprovar — nada entra no decision-log como approved sem ele
- TODA afirmação cita arquivo/fonte

---

## FASE 0 — BASELINE + REGRESSÃO DA R1

```
1. cd TripPilot
2. npm run test + npm run typecheck + npm run build → anote números
   (baseline esperada: 156 unit verdes, clean)
3. Leia src/gap-fix-log.md (o que foi feito) e gap-analysis-2026-06-09.md (os 36 "DONE quando")
4. PASS DE REGRESSÃO: para cada um dos 36 gaps, confirme NO CÓDIGO ATUAL
   que o "DONE quando" continua verdadeiro. Gere a tabela:
   GAP-001 ✅ mantido | GAP-002 ✅ mantido | ... | GAP-NNN ⚠️ REGREDIU (evidência)
   Atenção especial: FIELD-12 (tema) sugere que GAP-013/DEC-066 pode ter regredido
   ou ficado incompleto — investigue a fundo.
```

---

## FASE 1 — ABSORVER O BRAIN ATUALIZADO

Leia (paralelo): `product-spec.md`, `decision-log.md` (agora com DEC-061..070), `project-status.md`, `master-spec-d1.md`, `database-schema.md`, `domain-functions-d1.md`, `design-system.md`, `implementation-phases.md`, `v1-screen-list.md`, `gap-analysis-2026-06-09.md` (seção 9 — itens D2+ registrados).

Hooks do schema que os achados de campo vão reativar — estude estes com atenção:
- **`plannedOccurrences`** (DEC-043) — tabela existe, zero UI → base provável do FIELD-05 (eventos)
- **DEC-019** (impacto provisório de shared até confirmação) — nunca teve fluxo de confirmação → FIELD-03
- **DEC-063** (critério de pendência = settlement) — o relato FIELD-03 mostra que o critério está errado/incompleto
- **DEC-006** (occasion-based forecasting) — FIELD-02 (ritmo de fase) é uma extensão natural
- **`alertRules` / `forecastSnapshots`** — tabelas sem UI que podem servir aos designs

---

## FASE 2 — INVESTIGAÇÃO DOS 14 ACHADOS DE CAMPO

Para CADA item abaixo: releia o relato, trace o comportamento no código, encontre o root cause (bugs) ou levante o estado atual + restrições (features). Os relatos do Julio estão transcritos fielmente — eles são requisito, não sugestão.

### BUGS (root cause obrigatório: arquivo + linha + lógica errada)

**[FIELD-03] BUG ALTO — Pendência de confirmação sem fluxo de confirmação**
> Relato: "Tinha um gasto de mercado que dividi com a minha irmã, €20 para cada — apareceu na tela inicial 'gasto pendente de confirmação'. Depois fomos no mercado e ELA pagou, também €20 cada — como ela pagou, zerou o que ela me devia. O menu mostra que nem ela nem eu devemos nada (correto!), mas a tela inicial ainda mostra 2 gastos pendentes de confirmação — e como não aparece dívida, não tem COMO confirmar. Tem que ter como confirmar ou não os gastos, e acho que as dívidas só deveriam ficar 'fixadas' depois de confirmar os gastos."
- Investigar: critério atual de pendência (DEC-063: settlement-based) vs o cenário de netting natural (dívidas cruzadas que se anulam sem settlement); ausência total de UI de confirmação; DEC-019 manda impacto provisório até confirmação — onde está o estado de confirmação no modelo?
- Saída esperada: root cause + proposta de fluxo de confirmação (por gasto compartilhado: confirmar/rejeitar; dívidas consolidam só com gastos confirmados; card some quando todos confirmados) — vira decisão PROPOSTA substituindo/refinando DEC-063

**[FIELD-04] BUG ALTO — Sessão única "Parral" contamina Planner cross-phase e Perfis**
> Relato: "Iniciei uma saída com nome 'Parral' (festa que acontece UMA vez na viagem), valor seguro 50. Depois, no Planejar, o Parral está na fase em que iniciei a saída com contagem 1 — até ok. Mas é uma festa específica, não sei se precisa de algo próprio para essas ocasiões. O PIOR: quando clico na OUTRA fase no planejamento, o Parral aparece lá também e JÁ COM 1 — não faz sentido, era festa única. E o Parral também apareceu no menu Perfis de Atividade."
- Investigar: o fluxo de sessão custom cria ActivityProfile global? O Planner semeia allocations a partir de TODOS os perfis (sem escopo de fase)? De onde vem o "1" na outra fase?
- Conexão: a solução de produto correta provavelmente é FIELD-05 (evento único = PlannedOccurrence, não perfil recorrente) — trate os dois juntos no design

**[FIELD-10] BUG MÉDIO — Texto selecionável no touch**
> Relato: "Quando toco em alguns textos que não são botões, eles selecionam como se eu estivesse selecionando texto. Tem que arrumar — não deixar selecionar para parecer um app de verdade, só interagir com os botões."
- Investigar: ausência de `user-select: none` global (preservando inputs/textareas); verificar também `-webkit-tap-highlight-color` e `touch-action`

**[FIELD-11] BUG MÉDIO — Fundos e fases sem editar/apagar**
> Relato: "Consigo adicionar fundos e fases, mas não consigo editar ou apagar fundos, nem apagar fases. Precisa pensar como melhorar isso."
- Investigar: FundsPage (CRUD incompleto — R1 já anotava "sem edição/exclusão" em F-23) e TripEditPage (sem excluir fase). Levantar as regras de segurança necessárias: o que acontece com transações/links/planos ao apagar um fundo ou fase? (soft delete + reatribuição ou bloqueio com explicação)

**[FIELD-12] BUG ALTO — Tema claro: não aplica na hora + bottom bar invisível**
> Relato: "Quando seleciono o tema claro ele não muda na hora, tem que recarregar. E no tema claro a barra inferior fica com tom escuro e os ícones também — os ícones ficam invisíveis."
- Investigar: (a) regressão/incompletude do GAP-013/DEC-066 — o `useLiveQuery` cobre o AppShell? Quem aplica `data-theme`? (b) tokens do tema claro na BottomNav — cores hardcoded dark? Auditar TODOS os componentes no tema claro (não só a bottom bar): contrastes, ícones, cards

**[FIELD-13] BUG BAIXO — Gastos recentes do dashboard não clicáveis**
> Relato: "Nos gastos recentes da tela inicial, se clicar em um gasto tem que entrar no detalhe do gasto."
- Investigar: DashboardPage lista recentes sem navegação → `/expenses/:id`

**[FIELD-14] BUG BAIXO — Contadores do dashboard não levam à lista filtrada**
> Relato: "Na tela inicial, se eu clicar em um dos ícones de Bar, Mercado (gastos por perfil), tem que ir para a tela de gastos e mostrar só esses gastos."
- Investigar: contadores sem onClick; ExpenseListPage aceita filtro por categoria/perfil via query param?

### FEATURES (design completo obrigatório na Fase 4)

**[FIELD-01] FEATURE — Atividades selecionáveis por fase**
> Relato: "No planejamento, quando vamos criar uma fase, poder selecionar as coisas que vamos ter nessa fase: Restaurantes, Bar, Mercado, Transporte... várias opções, além da opção 'outros' customizada. Porque numa fase eu posso ter mercado e na outra não."
- Estado atual a levantar: perfis são globais à viagem? O Planner mostra todos em todas as fases?

**[FIELD-02] FEATURE — Tipo/ritmo da fase (intensidade de gasto)**
> Relato: "Poder colocar que tipo de fase é: viagem intensa (todo dia andando, viajando, gastando, comendo, bebendo) ou mais tranquila, com pausas sem gastos. Temos que tentar entender quantos dias vamos ficar SEM gastar e quantos dias vamos gastar MUITO — isso muda de fase para fase e muda o ritmo de gasto da viagem; a pessoa colocando as infos pode não ter percebido isso. No meu caso (viagem com a Mira): os dias que eu mais gastaria seriam os finais de semana, e durante a semana eu gastaria muito menos."
- Design deve cobrir: presets de ritmo (intensa/moderada/tranquila/custom), padrão semanal (dias de pico ex.: fds), como isso alimenta forecasting (DEC-006), planner e "livre para usar" diário

**[FIELD-05] FEATURE — Eventos planejados dentro das fases (a maior feature)**
> Relato: "Ter dentro das fases os eventos específicos que já sabemos que vão acontecer. Eu já sabia que o Parral ia acontecer no dia 12 dentro da fase. Já sei que dentro da fase de Burgos vou fazer uma viagem de praia de DOIS DIAS — já posso separar dinheiro para isso. E na tela inicial, quando chegar o dia, aparecer um card: 'hoje é dia desse evento, iniciar agora?'. Para a eurotrip, dentro da fase eurotrip eu posso colocar como eventos cada CIDADE e quanto tenho para usar em cada cidade. Não sei como ficaria o resto do app — o planejar e outros — como fazer da melhor forma? Onde colocar os menus? Precisa pensar bem."
- Design deve cobrir: entidade (provável `PlannedOccurrence` estendida — DEC-043), eventos de 1 dia vs multi-dia (praia 2 dias) vs sub-destinos com budget (cidades da eurotrip), reserva de dinheiro por evento (interação com future floor/envelopes), card do dia no dashboard com "iniciar agora" (vira outing session ligada ao evento), integração com Planner, onde ficam os menus (dentro de Editar fases? Planner? Trip overview?), e a relação com FIELD-04 (evento único ≠ perfil recorrente)

**[FIELD-06] FEATURE — Contadores do dashboard dinâmicos (carrossel)**
> Relato: "Os ícones grandes da tela inicial (bar: 1, mercado: 5) teriam que mostrar TODOS os gastos por perfil planejado, não só esses 3 fixos. Se não usou nada ainda, pode deixar os 3 mais planejados; assim que começar a usar, mostrar todos os usados — talvez manter 3 visíveis e rolar para o lado revelando os outros, tipo carrossel."

**[FIELD-07] FEATURE/EXPLORAÇÃO — Mais informações úteis no dashboard**
> Relato: "Pensar em mais informações para colocar na tela de início — informações legais e importantes para o usuário. Está legal assim, mas temos mais dados que podem virar informações úteis se pensarmos bem."
- Levante TODOS os dados disponíveis no modelo e proponha 5-10 candidatos a cards/insights com valor real (ex.: ritmo atual vs planejado, projeção de fim de fase, dia mais caro da semana, custo médio por saída, dias sem gasto). Priorize por valor×esforço. NÃO inventar dados que não existem

**[FIELD-08] FEATURE — Categorização rápida pós-valor na saída**
> Relato: "Numa saída tipo o Parral, só o valor fica estranho — para o MOMENTO é ótimo, mas para a visão de gastos depois fica ruim: você sabe que gastou 5 no Parral mas a categoria é 'outros'; não sabe se foi comida, bebida, se dividiu, se você pagou ou alguém pagou. Depois de colocar o valor, perguntar bem básico e rápido, SEM formulário, só ícone: o que foi? (ícones de categoria, um tap e salvou). E também, de forma bem rápida e simples, se você pagou ou não e se dividiu com alguém — aí ganhamos essas informações para deixar perfeita a divisão e o histórico."
- Design: stepper de ícones pós-quick-add (categoria → pagou eu/outro → dividiu?), tudo opcional/pulável em 1 tap, sem quebrar a velocidade do registro (Core Rule: nunca atrapalhar o registro)

**[FIELD-09] FEATURE — Histórico de saídas**
> Relato: "Falta um histórico das saídas: o que gastou em cada saída, como pagou, quanto tempo durou cada saída."
- Estado atual: sessions/sessionItems já persistem (R1/GAP-003) — falta a tela. Design: lista de sessões passadas (nome, data, duração, total, nº itens) + detalhe (itens, carteiras, shares); onde entra o menu (Mais? aba dentro de Gastos?)

---

## FASE 3 — RE-AUDITORIA COMPLETA (caçar o que NINGUÉM relatou)

Os relatos do Julio cobrem o que ELE percebeu. Agora rode os 5 passes da R1 no código atual para achar o resto:

```
PASS 1 — Features (inventário da R1 + as features dos Gates 1-7): estado real de cada uma
PASS 2 — DECs (agora 70): cada um respeitado? Atenção aos novos DEC-061..070
PASS 3 — Telas: incluindo as novas (revisão de encerramento, config de sessão,
         envelopes, future floor) — estados vazios, navegação, tema claro E escuro
PASS 4 — Jornadas: re-trace os golden paths + jornadas novas (saída completa com
         revisão, backup 21 tabelas, settle parcial, multi-idioma)
PASS 5 — Transversal: i18n (pt/en/es sincronizados?), diálogos nativos (deve ser 0),
         persistência/liveQuery, testes (156+), PWA, performance percebida,
         acessibilidade de toque (FIELD-10 indica que ninguém auditou touch UX —
         faça um pass específico de mobile feel: select, tap highlight, áreas de
         toque ≥44px, scroll bounce, teclado numérico em inputs de valor)
```

**Protocolo de exaustividade (igual à R1):** após os 5 passes, rounds extras de verificação com lentes livres; só pare quando **2 rounds consecutivos encontrarem zero achados novos**. Registre o log de rounds.

---

## FASE 4 — DESIGN DE PRODUTO (features FIELD-01/02/05/06/07/08/09)

Para CADA feature, produza:

```
[FIELD-NN] — Nome
1. PROBLEMA: o que o relato revela (necessidade real, não a solução literal)
2. ESTADO ATUAL: o que o app/modelo já tem que ajuda (tabelas, funções, telas)
3. OPÇÕES: 2-3 designs com trade-offs (esforço, complexidade, aderência ao brain)
4. RECOMENDAÇÃO: qual opção e por quê (1 parágrafo)
5. DESIGN DA RECOMENDADA:
   - Modelo de dados (entidades/campos novos ou reuso — preferir reuso: plannedOccurrences, alertRules...)
   - UX: telas/fluxos afetados, onde entram os menus, wireframe textual das telas novas
   - Integração: impacto em Planner, dashboard, forecasting, outing, backup/CSV
   - Corte V1 da feature: o mínimo que entrega o valor / o que fica para depois
6. DECISÕES PROPOSTAS: formato DEC-NNN (status: PROPOSED — aguardando Julio)
7. ESFORÇO: S/M/L
```

**Atenção às interações entre features** — elas formam um sistema:
- FIELD-01 (atividades por fase) + FIELD-02 (ritmo) moram juntos na criação/edição de fase
- FIELD-05 (eventos) resolve FIELD-04 (Parral) e alimenta o card do dashboard
- FIELD-08 (categorização rápida) alimenta FIELD-09 (histórico rico) e o split de FIELD-03
- FIELD-06 + FIELD-07 redesenham o dashboard juntos — proponha o dashboard final UMA vez
Desenhe a sequência de implementação considerando essas dependências.

---

## FASE 5 — DOCUMENTO FINAL

Crie: **`TripPilot/brain/documents/gap-analysis-r2-YYYY-MM-DD.md`** (data real)

```markdown
# TripPilot — Gap Analysis R2 (pós-uso real)
> Data | Baseline: X testes | Build/Typecheck | Referências: R1 + gap-fix-log

## 1. Resumo Executivo
- Estado geral pós-R1; números (regressões, bugs de campo, gaps novos, features desenhadas)
- Top 5 itens mais críticos

## 2. Regressão da R1
Tabela 36 gaps: mantido/regrediu + evidência

## 3. Achados de Campo — Bugs (FIELD-03/04/10/11/12/13/14)
Por bug: relato (resumo) | root cause (arquivo:linha + lógica) | severidade |
fix necessário (acionável) | esforço | DECs afetados

## 4. Gaps Novos da Re-Auditoria
Mesmo formato da R1 ([GAP-R2-NNN], severidade, fonte, estado, o que falta, esforço)

## 5. Design de Produto (FIELD-01/02/05/06/07/08/09)
Por feature: o formato completo da Fase 4

## 6. Decisões Propostas (consolidado)
Lista de todos os DEC-NNN PROPOSED para o Julio aprovar/ajustar — esta seção é o
que o Julio revisa ANTES do prompt de implementação

## 7. Dashboard Final Proposto
A visão consolidada (FIELD-06 + 07 + card de eventos do FIELD-05): wireframe
textual com a ordem dos cards e regras de visibilidade

## 8. Verificação por DEC (os 70)
Tabela atualizada

## 9. Qualidade Transversal + Mobile Feel
i18n, touch UX, tema claro, testes, PWA

## 10. Log de Exaustividade
Passes + rounds + gaps novos por round → critério atingido

## 11. Blocos de Implementação Recomendados
Ordem de ataque considerando dependências entre features (Fase 4) +
bugs primeiro; cada bloco pronto para virar gate do próximo prompt
```

---

## REGRAS DE CONDUTA

1. **Zero código modificado** — análise e documento, nada mais
2. **Relato do Julio = requisito** — pode propor solução DIFERENTE da literal (ele mesmo pediu: "não sei como fazer da melhor forma"), mas a NECESSIDADE relatada tem que ser 100% atendida pela proposta
3. **Evidência sempre** — bug sem root cause não entra como resolvido de análise; feature sem estado atual não entra como design
4. **Decisões são PROPOSTAS** — nada de status approved no decision-log; o documento consolida tudo na seção 6 para o Julio bater o martelo
5. **Reuso primeiro** — todo design começa pelo que o schema/domínio já tem (plannedOccurrences, alertRules, sessions persistidas, forecasting)
6. **Acionável** — cada bug/gap descrito para implementar sem reinvestigação; cada feature com corte V1 claro

---

## CRITÉRIO DE PARADA

```
DONE quando TUDO = TRUE:
- [ ] Baseline verificada + regressão dos 36 gaps (tabela completa)
- [ ] 14/14 achados de campo investigados (7 bugs com root cause, 7 features com estado atual)
- [ ] 5 passes de re-auditoria + 2 rounds consecutivos com zero achados novos
- [ ] 7 features com design completo (opções, recomendação, modelo, UX, menus, corte V1)
- [ ] Interações entre features mapeadas + dashboard final proposto
- [ ] Todas as decisões propostas consolidadas na seção 6
- [ ] gap-analysis-r2-YYYY-MM-DD.md criado com as 11 seções
- [ ] Resumo executivo no chat: regressões + top 5 críticos + nº de decisões aguardando aprovação
```

---

## COMECE AGORA

1. FASE 0: baseline + regressão dos 36
2. FASE 1: brain atualizado (atenção a DEC-019/043/063 e plannedOccurrences)
3. FASE 2: investigue os 14 achados (root cause dos bugs primeiro)
4. FASE 3: re-auditoria 5 passes + rounds até zero
5. FASE 4: design das 7 features (com as interações entre elas)
6. FASE 5: documento + resumo no chat

**Os relatos vieram de uma viagem real — cada um vale mais que dez passes de código. Nenhum pode ficar sem resposta completa. GO.**
