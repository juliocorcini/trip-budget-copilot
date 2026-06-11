# AUDITORIA TOTAL DE COBERTURA + CORRETUDE — TripPilot

> **Modo**: Chat direto — sem agents, sem subagents, sem Task tool
> **Contexto**: O app passou por 3 rodadas (R1: 36 gaps · R2: 23 itens + 7 features · R3: 26 requisitos de UX). O brain acumula 102 decisões (DEC-001..102), spec completo, 6 deliveries planejadas e itens adiados registrados. Esta é a auditoria de FECHAMENTO: confirmar que TUDO que foi planejado e definido está mapeado — feito certo, feito errado, incompleto ou ainda não feito
> **Objetivo**: UM documento com a visão 100% completa da distância entre o app HOJE e o app TOTALMENTE PLANEJADO — incluindo fases/funções futuras E bugs em coisas já implementadas
> **Restrição absoluta**: ZERO modificação de código de produção. Testes scratch, dev server e Playwright são permitidos PARA VERIFICAR (nada commitado, nada alterado em src/)

---

## IDENTIDADE

Você é um Principal Engineer fazendo a auditoria de cobertura total do TripPilot. Sua missão tem uma diferença crucial em relação às auditorias anteriores: **"implementado" não basta — tem que estar implementado CERTO**. Você vai:

1. **Inventariar TUDO que foi prometido** — cada linha do brain que define comportamento, em qualquer delivery (passada ou futura)
2. **Classificar cada promessa** — correto / parcial / com bug / ausente / planejado-para-depois
3. **Caçar bugs no que existe** — verificação de corretude com runtime, matemática e edge cases, não só leitura de código
4. **Entregar o roadmap completo** — o que falta para o app ser 100% o que o brain define, em ordem

Seu padrão de qualidade: **"Depois deste documento, NENHUMA promessa do brain pode estar sem status, e NENHUM status pode estar baseado em suposição."** Item sem evidência = trabalho incompleto. "Funciona" sem teste = suposição.

**Regras absolutas:**
- NÃO delegue para agents/subagents/Task tool
- NÃO corrija nada — análise e documento, apenas
- NÃO peça confirmação entre fases
- NÃO marque ✅ por leitura superficial: corretude exige evidência (teste runtime, teste scratch de domínio, trace matemático completo, ou teste unitário existente que cubra o caso REAL)
- NÃO descarte itens "óbvios demais" — as rodadas anteriores acharam bugs em saque, tema e service worker que pareciam triviais
- TODA afirmação cita arquivo/linha/teste; toda promessa cita a fonte no brain

---

## FASE 0 — BASELINE + REGRESSÃO DAS 3 RODADAS

```
1. cd TripPilot
2. npm run test + npm run typecheck + npm run build → anote números exatos
3. npx playwright test (instalar browsers se necessário:
   export PATH="$HOME/.nvm/versions/node/v22.22.3/bin:$PATH"
   npx playwright install --with-deps chromium)
4. Leia os 3 state files: src/gap-fix-log.md, src/gap-fix-log-r2.md,
   src/gap-fix-log-r3.md → o que cada rodada afirma ter entregue
5. PASS DE REGRESSÃO TOTAL: verifique no código atual o "DONE quando" de:
   - R1: 36 gaps (gap-analysis-2026-06-09.md)
   - R2: 23 itens (gap-analysis-r2-2026-06-09.md + gap-fix-r2-implementation-prompt.md)
   - R3: 26 requisitos (gap-fix-r3-implementation-prompt.md)
   Tabela: item | ✅ mantido / ⚠️ regrediu / 🐛 "feito" mas errado | evidência
```

---

## FASE 1 — INVENTÁRIO TOTAL DO PLANEJADO (a base de tudo)

Leia o brain INTEIRO (paralelo) e construa o **Inventário Mestre**: toda promessa verificável, com fonte e delivery alvo. Fontes obrigatórias:

| Fonte | O que extrair |
|---|---|
| `product-spec.md` | TODA feature e regra (V1 completo + menções V2) |
| `decision-log.md` | TODOS os 102 DECs approved — cada um vira item verificável |
| `implementation-phases.md` | As 6 deliveries: cada entregável de CADA delivery (D1..D6), feito ou não |
| `master-spec-d1.md` | Spec detalhado + Appendix C (ACs) |
| `documents/domain-functions-d1.md` | Cada função de domínio prometida |
| `documents/database-schema.md` | Cada entidade/campo/índice — existe? é usado? |
| `documents/v1-screen-list.md` | Cada tela com seus elementos |
| `documents/design-system.md` | Tokens, componentes, anti-patterns |
| `documents/test-plan-d1.md` | Cobertura prometida vs real |
| `technical-direction.md` | PWA, deployment, validação, arquitetura |
| `project-status.md` + `meetings-log.md` | O que o brain ACHA que está pronto |
| **Seção 9 do gap-analysis R1 + R2** | Itens explicitamente ADIADOS (multi-moeda, relatórios, future floor automático, PlannedOccurrence avançado, AlertRules UI, forecastSnapshots/sparkline, notificações push/Capacitor, multi-device sync, risco combinado do simulador, traduções V2...) — TODOS entram no inventário como 🔮 futuro |
| `competitive-landscape.md` | Promessas de posicionamento que viram feature |

Formato de cada item do inventário:

```
[INV-NNN] Descrição verificável | Fonte: DEC-XXX / spec §Y / delivery DN | Delivery alvo: D1..D6/V2
```

**Meta**: o inventário deve ter TUDO. Se durante as fases seguintes você encontrar qualquer comportamento prometido que não está no inventário, é falha da Fase 1 — adicione e anote o furo no log de exaustividade.

---

## FASE 2 — CLASSIFICAÇÃO DE COBERTURA (item por item)

Para CADA item do Inventário Mestre, encontre a implementação e classifique:

```
✅ CORRETO     — implementado E verificado certo (evidência de corretude obrigatória)
🟡 PARCIAL     — existe mas falta parte do comportamento prometido (qual parte?)
🐛 COM BUG     — existe mas faz a coisa ERRADA (a categoria mais importante desta auditoria)
🔴 AUSENTE     — prometido para uma delivery já "concluída" e não existe
🔮 FUTURO      — planejado para delivery/versão posterior, corretamente ainda não feito
   (com delivery alvo — isto NÃO é problema, é roadmap)
⚠️ ÓRFÃO       — existe no código mas NÃO está no brain (feature não documentada,
   campo morto, tela sem spec) — viola a Truth Policy, precisa entrar no brain ou sair
```

Regra de ouro da classificação: **✅ exige evidência de corretude** — uma das quatro:
(a) teste unitário existente que cubra o caso real (não trivial), (b) teste scratch seu com números concretos, (c) verificação runtime (dev server + Playwright), (d) trace matemático completo documentado. Leitura de código sem verificação → no máximo 🟡 com nota "não verificado em profundidade".

---

## FASE 3 — CAÇA AOS BUGS (corretude do que existe)

Esta fase é o diferencial. Rode **baterias de verificação** nas áreas de maior risco. Para cada bateria: monte o cenário com números/dados concretos, execute (scratch test de domínio ou runtime), compare com o comportamento que o brain define.

### Bateria 1 — Matemática financeira (a alma do app)
- Split com resto: €10 ÷ 3 pessoas — soma das partes = total? Quem absorve o centavo?
- Split custom que não soma 100% — o que acontece?
- Netting de dívidas cruzadas (cenário da irmã: 2×€20) + settle parcial em cima
- Saque/transferência: orçamento intocado, carteiras corretas dos dois lados
- Reconciliação negativa e positiva; "ajuste para total informado" com diff negativo
- freeToSpend: fundo − reservas (protegida + eventos + future floor onde configurado) − gasto; cada parcela com valor concreto
- "Livre para usar hoje" (R3): allowance − gastos de hoje; virada do dia; dia de pico vs normal
- Rejeição de share devolve valor ao pagador?

### Bateria 2 — Datas e fronteiras
- Gasto à meia-noite / fuso: cai no dia certo? (datas locais vs UTC — grep por `toISOString`/`new Date` em cálculos de dia)
- Transição de fase: último dia da fase 1 / primeiro da fase 2 — dashboard, planner, contadores apontam para a fase certa?
- Evento multi-dia: card aparece em TODOS os dias do intervalo? Some quando ligado a sessão?
- Fase sem datas / viagem que já acabou / viagem que não começou — o que o dashboard mostra?

### Bateria 3 — Fluxos compostos (runtime com Playwright contra dev server)
- Jornada completa: onboarding → gasto → saída com stepper → encerramento com revisão → histórico → backup export → import em DB limpo → TUDO igual (contagem por tabela + spot-check de valores)
- Confirmação de shares: criar → pendente → confirmar/rejeitar → dívidas e card reagem
- Planner: ajustar → margem live → estourar → alerta no topo → recomendação respeita cadeado/essencial → persistência ao sair e voltar
- Tema claro E escuro em TODAS as telas (screenshots); troca ao vivo; rotas fora do shell
- Notificações: cada tipo aparece quando deve e navega certo

### Bateria 4 — Estado e concorrência
- Duas abas abertas: gasto numa, dashboard na outra atualiza? (liveQuery onde prometido)
- Sessão ativa + kill do app (reload) → sessão recuperada com firedAlertPercents?
- Import de backup durante sessão ativa — corrompe algo?
- Soft delete: registros deletados aparecem em alguma query/lista/CSV/contagem?

### Bateria 5 — i18n e taxonomia em runtime
- Trocar para EN e ES: alguma chave crua na tela? (runtime, não só diff de JSON)
- Subcategorias: todos os 17 tipos têm lista? Ordenação por proximidade com valores reais?
- Textos com interpolação ({{count}}, plurais) nas 3 línguas

### Bateria 6 — PWA e distribuição
- SW: nova versão → toast aparece? index.html network-first de fato? (inspecionar sw.js + teste)
- Offline: app abre? Registrar gasto offline funciona?
- Pull-to-refresh desativado em standalone; manifest/ícones/shortcuts válidos

Para cada bug encontrado: **[BUG-NNN]** relato + root cause (arquivo:linha) + o que o brain define + fix acionável + severidade + esforço.

---

## FASE 4 — EXAUSTIVIDADE

Após as Fases 2 e 3, rode rounds extras com lentes livres (escolha as mais promissoras: a11y, performance, CSV/backup campo a campo, empty states, fluxos de erro, dados extremos — valores gigantes, 50 fases, 100 participantes...).

**Critério mecânico de parada**: 2 rounds consecutivos com ZERO achados novos (nem item de inventário faltante, nem bug, nem gap). Registre o log de rounds.

---

## FASE 5 — DOCUMENTO FINAL

Crie: **`TripPilot/brain/documents/full-coverage-audit-YYYY-MM-DD.md`** (data real)

```markdown
# TripPilot — Auditoria Total de Cobertura e Corretude
> Data | Baseline (testes/build) | Deploy auditado | Refs: R1, R2, R3

## 1. Resumo Executivo
- A frase que importa: "O app está X% do que foi planejado; faltam N itens,
  M estão com bug, K são futuros"
- Números por classificação (✅/🟡/🐛/🔴/🔮/⚠️) e por delivery (D1..D6)
- Top 10 mais críticos (bugs primeiro)

## 2. Regressão R1+R2+R3 (85 itens)
Tabela completa: mantido / regrediu / "feito" mas errado

## 3. INVENTÁRIO MESTRE — Matriz de Cobertura Total
A tabela mais importante do documento: TODOS os INV-NNN com
fonte | delivery alvo | status | evidência | o que falta (1 linha)
Agrupada por área (orçamento, gastos, saídas, planner, social,
dados, PWA, configurações, dashboard)

## 4. Bugs Encontrados (🐛 detalhados)
[BUG-NNN] formato completo: relato, root cause, brain define, fix, sev, esforço

## 5. Incompletos e Ausentes (🟡 + 🔴 detalhados)
Mesmo formato acionável das auditorias anteriores

## 6. Órfãos (⚠️ — código sem brain)
O que existe sem estar documentado → propor: documentar ou remover

## 7. ROADMAP FUTURO (🔮 consolidado)
Tudo que foi planejado para depois, organizado por delivery/versão alvo,
com dependências e esforço — a visão completa do que falta para o
TripPilot ser 100% o produto definido no brain

## 8. Verificação por DEC (1..102)
Tabela completa — TODOS, sem pular faixas

## 9. Verificação por Delivery (D1..D6)
Por delivery: % entregue, itens pendentes, divergências do plano

## 10. Contradições e Atualizações do Brain
project-status, docs desatualizados pelos 3 ciclos, decisões implícitas
nunca registradas

## 11. Log de Exaustividade
Baterias executadas + rounds + achados por round → critério atingido

## 12. Blocos de Implementação Recomendados
Bugs → incompletos → futuros em ordem de dependência; cada bloco pronto
para virar gate do próximo prompt de implementação
```

---

## REGRAS DE CONDUTA

1. **Zero código de produção modificado** — scratch tests e dev server são para LER o comportamento; nada commitado, nada alterado em src/ (se criar arquivos scratch, delete-os ao final)
2. **Evidência ou rebaixa** — sem evidência de corretude, o item NÃO é ✅
3. **🔮 não é problema** — futuro planejado entra no roadmap com respeito; não infle a lista de gaps com ele, mas ele TEM que estar no documento (o Julio quer a visão completa, incluindo o que falta de fases futuras)
4. **🐛 é a prioridade da auditoria** — coisa errada que parece certa é pior que coisa faltando
5. **Brain é a verdade** — divergência = gap do código; contradição interna do brain → seção 10
6. **Acionável** — cada bug/gap descrito para implementar sem reinvestigação

---

## CRITÉRIO DE PARADA

```
DONE quando TUDO = TRUE:
- [ ] Baseline + regressão dos 85 itens das 3 rodadas (tabela completa)
- [ ] Inventário Mestre cobre TODAS as fontes da Fase 1 (incl. itens adiados)
- [ ] 100% dos itens classificados COM evidência (zero "não verificado" sem nota)
- [ ] 6 baterias de corretude executadas com cenários concretos
- [ ] 102 DECs verificados um a um | 6 deliveries avaliadas
- [ ] 2 rounds consecutivos com zero achados novos
- [ ] full-coverage-audit-YYYY-MM-DD.md com as 12 seções
- [ ] Roadmap futuro consolidado (seção 7) — a visão completa que o Julio pediu
- [ ] Resumo no chat: % de cobertura + top 10 críticos + nº de bugs + tamanho do roadmap
```

---

## COMECE AGORA

1. FASE 0: baseline + regressão R1/R2/R3
2. FASE 1: inventário mestre (leia o brain INTEIRO)
3. FASE 2: classificação com evidência
4. FASE 3: as 6 baterias de caça a bugs
5. FASE 4: rounds até zero
6. FASE 5: documento + resumo no chat

**Três rodadas provaram que "parece pronto" e "está certo" são coisas diferentes. Desta vez nenhuma promessa fica sem status e nenhum status fica sem prova. GO.**