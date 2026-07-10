# Auditoria: Marketing vs Realidade — TripPilot

> **Data:** 2026-07-10
> **Escopo:** Comparação entre as promessas do marketing (landing page + copy do Julio) e o que o código realmente entrega.
> **Método:** Análise do código-fonte (`domain/`, `features/`, `i18n/pt-BR.json`, `landing.html`) contra cada claim do marketing.

---

## Resumo Executivo

O TripPilot entrega a **grande maioria** do que o marketing promete, e em vários pontos o código é **mais sofisticado** do que o marketing sugere. Porém, existem **3 gaps significativos** e **5 pontos de fricção** onde o que o usuário encontra não bate exatamente com o que o marketing vende.

### Placar Geral

| Categoria | Status |
|-----------|--------|
| Simulador "Posso Gastar?" | ✅ Entrega o core, mas UX é 2 passos (não 1) |
| Previsão por Ocasiões | ✅ Funciona, mas requer setup prévio (marketing omite) |
| "Manda ver!" (incentivo a gastar) | ✅ Implementado e com safety guards |
| "Para aí." (freio no bar) | ⚠️ Parcial — tom diferente do marketing |
| "Troca inteligente" (trade-offs) | ❌ **NÃO IMPLEMENTADO** como feature proativa |
| Resposta "em 1 segundo" | ⚠️ Requer 2 passos (valor + destino) |
| Custo típico por ocasião no carousel | ⚠️ Exibição depende do formato do sublabel |
| "Amigo sincero" proativo | ✅ Implementado (proactive_check_in, 2026-07-09) |

---

## 1. Simulador "Posso Gastar?" — Verde / Amarelo / Vermelho

### O que o marketing diz

> "Está no restaurante, vê o prato de €28. Quer pedir mas não sabe se pode. Abre o TripPilot, digita o valor. **Em 1 segundo:**
> - Verde — Tranquilo. Cabe no orçamento sem afetar nada.
> - Amarelo — Atenção. Cabe, mas reduz uma noite no bar ou uma ida ao mercado.
> - Vermelho — Para. Entra na reserva de segurança."

### O que o código entrega

O simulador está em `contextual-simulation.ts` (DEC-116, v3) e `SimulatorPage.tsx`. A implementação é **mais rica** que o marketing:

**Funciona corretamente:**
- ✅ 3 tons de verdito: `ok` (verde), `attention` (amarelo), `risk` (vermelho)
- ✅ Cada verdito vem com **razão concreta** (nunca um tom sem explicação)
- ✅ Mostra impacto no plano de ocasiões ("consumes 2 of 3 remaining bar nights")
- ✅ "Borrow from tomorrow" warning (DEC-053) — honestidade extra que o marketing nem menciona
- ✅ Após simulação: CTAs para registrar o gasto ou salvar como planejado

**Gaps e fricções:**

| # | Tipo | Descrição |
|---|------|-----------|
| **F1** | Fricção UX | O marketing diz "digita o valor, em 1 segundo". Na realidade, o usuário precisa: (1) digitar o valor, (2) selecionar o **destino** (bar? mercado? evento? outro?) — só então o resultado aparece. São **2 passos, não 1**. O flow "digita e vê" do marketing é simplificado demais. |
| **F2** | Copy gap | O marketing mostra "Tranquilo — pode gastar" como texto do verdito verde. O app mostra `"Tranquilo!"` (verdict_ok) + uma razão estruturada como "Cabe no plano — ainda sobram 3 noites de bar." — que é **melhor**, mas não é o texto visual limpo e direto do marketing. |
| **F3** | Visualização | O mockup do landing mostra o simulador com "Livre hoje (depois): €19 / Noites no bar restantes: 3 / Reserva protegida: Intacta" num layout tabular limpo. O app real mostra isso como cards de "fato" empilhados. O conteúdo é o mesmo, a forma é diferente. |

**Veredicto:** ⚠️ **FUNCIONA**, mas a promessa de "1 input → 1 segundo" é simplificação. O passo extra de "onde vai gastar" é necessário para a precisão contextual (DEC-116), mas o marketing deveria mencioná-lo ou o UX deveria ter um atalho de 1 toque.

### Recomendações

1. **Quick Simulate**: Adicionar um path rápido que assuma `target: 'other'` quando o usuário digitar o valor, mostrando um resultado genérico imediato. Ao selecionar um destino específico, refinar.
2. **Marketing**: Ajustar o copy para "digita o valor, escolhe o tipo de gasto, e em 1 segundo..."
3. **Atalho do dashboard**: O "Posso gastar um valor?" já existe (`AskToSpendShortcut.tsx`), mas leva à página do simulador completo. Considerar um mini-simulador inline.

---

## 2. Previsão por Ocasiões — "Pense em noites no bar"

### O que o marketing diz

> "O TripPilot aprende quanto custa cada tipo de saída e te conta: '**ainda cabem 3 noites no bar, 5 idas ao mercado e 1 passeio.**'"
>
> 🍺 3 noites no bar (~€35/noite)
> 🛒 5 idas ao mercado (~€18/ida)
> 🍽️ 2 restaurantes (~€22/refeição)
> 🏛️ 1 passeio (~€15/passeio)

### O que o código entrega

O engine está em `forecasting.ts` (`calculateOccasionForecasts`, `countProfileOccasions`) e o display em `occasion-counters.ts` + `OccasionCounter.tsx`.

**Funciona corretamente:**
- ✅ Contadores de ocasiões planejadas com `remaining` (quantas faltam)
- ✅ Contadores de atividades sem plano (contagem de ocasiões feitas)
- ✅ Learning engine que atualiza o `typicalValueCents` com média ponderada (prior de 3 data points)
- ✅ Sessões (outing) contam como 1 ocasião, não N itens (DEC-115)
- ✅ Carousel com CSS scroll-snap, dots, ordenação por uso

**Gaps e fricções:**

| # | Tipo | Descrição |
|---|------|-----------|
| **F4** | Pré-requisito oculto | O marketing mostra os counters como se fossem automáticos. Na realidade, o carrossel de ocasiões planejadas **só aparece se o usuário configurou um ScenarioPlan** com alocações. Sem plano = sem os numbers "3 noites no bar". O marketing **omite completamente** que o usuário precisa ir ao Planejador e definir quantas ocasiões de cada tipo quer. |
| **F5** | "Aprende" vs. realidade | O marketing diz "O TripPilot aprende quanto custa cada tipo de saída". O learning engine EXISTE (`updateProfileFromTransaction`), mas: (a) precisa de vários data points para refinar (prior de 3, low confidence até 5 pontos), e (b) os valores iniciais vêm dos presets de onboarding — pode parecer "adivinhação" para quem nunca usou. |
| **G1** | Gap visual confirmado | O marketing mostra `~€35/noite` como sublabel dos counters. **O código real mostra "X feitas"** (`t('dashboard.occasion_done')`) como sublabel — o custo típico por ocasião NÃO é exibido. O usuário vê "3 restantes / 5 feitas" mas nunca "~€35/noite". A informação de custo existe no `ActivityProfile.typicalValueCents` mas não chega ao OccasionCounter. |

**Veredicto:** ✅ **FUNCIONA**, mas o marketing vende como "automático" algo que precisa de setup (ScenarioPlan). Sem o plano, os números de "quantas faltam" não existem — só contagens brutas de "quantas já fez".

### Recomendações

1. **Auto-plan mínimo**: Quando o usuário cria perfis de atividade no onboarding mas não vai ao Planner, sugerir um plano automático baseado no orçamento e nos valores típicos.
2. **Marketing**: Adicionar "Configure seu plano e o app conta quantas ocasiões cabem" — ser honesto sobre o input necessário.
3. **Sublabel**: Garantir que o custo típico ("~€35/noite") aparece no sublabel do OccasionCounter em todos os contextos (dashboard + copiloto).

---

## 3. "O único app que também manda gastar" — Incentivo via Cofrinho

### O que o marketing diz

> 🎉 "Manda ver!" Você guardou €24 nos últimos dias — suficiente para uma noite extra no bar. Aproveita!

### O que o código entrega

Implementado em `honest-friend-extras.ts` como o extra `can_afford_more`:

```
"Manda ver! Guardou {{balance}} nos últimos dias — dá pra {{count}} {{profile}} 
 e ainda sobra colchão. Aproveita!"
```

**Funciona corretamente:**
- ✅ Copy EXATAMENTE como no marketing — "Manda ver!" está no i18n
- ✅ Safety guards robustos: só incentiva quando `piggy ≥ 1.5× típico` OU (`piggy ≥ 1× típico` E a fase sobrevive 2 dias sem o piggy)
- ✅ Variante segura `piggy_healthy` para quando o cofrinho tem saldo mas não passa nos gates de segurança
- ✅ Ícone `celebration` (🎉), tom `positive` (verde)

**Gaps e fricções:**

| # | Tipo | Descrição |
|---|------|-----------|
| **F6** | Condição de ativação | O `can_afford_more` requer: (a) cofrinho com saldo, (b) `profileTypicals` passados como input, (c) um perfil cujo típico cabe no saldo. Se o caller do dashboard NÃO passar `profileTypicals`, o slide nunca aparece. Preciso confirmar que o dashboard model está injetando esses dados. |
| **F7** | Frequência percebida | O safety guard é conservador (bom!), mas pode significar que muitos usuários NUNCA vejam o "Manda ver!" — precisam de um cofrinho com saldo >= 1.5x de uma noite no bar, o que em viagens apertadas é raro. O marketing posiciona isso como feature central, mas pode ser raro na prática. |

**Veredicto:** ✅ **BEM IMPLEMENTADO**. O código é até mais cuidadoso do que o marketing sugere, com dois níveis de safety.

---

## 4. ✋ "Para aí." — O freio honesto

### O que o marketing diz

> ✋ "Para aí." Mais um drink e você entra na reserva. Água agora, bar amanhã.

### O que o código entrega

Existem DOIS sistemas relevantes:

**A) Amigo Sincero (Dashboard) — `honest-friend.ts`:**
- `over_budget`: "Acabou o dinheiro livre desta fase. Daqui pra frente, todo gasto cava mais fundo."
- `over_plan`: "Você planejou X ocasiões de {{type}} e já fez Y — acima do plano."
- `over_pace`: "No ritmo atual, cabem só N dos M que faltam dentro do plano."

**B) Modo Saída (Outing) — alertas progressivos:**
- `at_max`: "Máximo atingido. Hora de parar de verdade."
- Alertas em 50%, 75%, 90%, 100%, >100%

**Gaps e fricções:**

| # | Tipo | Descrição |
|---|------|-----------|
| **G2** | Tom diferente | O marketing usa "Para aí. Água agora, bar amanhã." — curto, coloquial, direto. O app usa "Acabou o dinheiro livre desta fase. Daqui pra frente, todo gasto cava mais fundo." — correto mas mais formal/técnico. O marketing vende um amigo que fala como gente; o app fala como um consultor financeiro educado. |
| **G3** | Contexto errado | "Água agora, bar amanhã" é linguagem de **outing** (bar mode). No outing, o alerta existe ("Hora de parar de verdade"), mas não usa a frase do marketing. No dashboard (amigo sincero), a linguagem é sobre fases e planos, não sobre drinks e água. O marketing **mistura contextos** — pega o cenário do bar mas mostra como se fosse o amigo do dashboard. |

**Veredicto:** ⚠️ **PARCIAL**. A funcionalidade de freio existe nos dois contextos, mas o **tom** e a **linguagem** são diferentes do marketing. O marketing vende uma personalidade; o app entrega uma análise.

### Recomendações

1. **Voice system**: O sistema de vozes do amigo (padrao/zen/durão/econômico) já existe. Adicionar ao voice "durão" frases curtas e coloquiais como "Para aí. Água agora, bar amanhã." para o over_budget/alert.
2. **Outing alerts**: Os alertas do outing mode poderiam usar linguagem mais direta ("Para aí!") em vez de frases genéricas.

---

## 5. 💡 "Troca inteligente" — ❌ NÃO IMPLEMENTADO

### O que o marketing diz

> 💡 "Troca inteligente:" Uma noite a menos no bar = 2 idas a mais ao mercado. Vale a pena?

### O que o código tem

Busquei em todo o codebase por: `tradeoff`, `trade_off`, `troca inteligente`, `smart swap`, `suggestion` em contexto de planner. **Resultado: ZERO implementação desta feature como descrita no marketing.**

O que EXISTE de relacionado:
- **Rescue Mode** (`rescue.ts`): dado um valor para economizar, sugere quais ocasiões pular. Mas é "pule 2 bares para salvar €70" — não é "troque 1 bar por 2 mercados".
- **Scenario Planner**: permite [-]/[+] manual nas quantidades e vê o impacto em tempo real. Mas é o USUÁRIO quem faz a conta mental "se tiro 1 bar, cabem 2 mercados" — o app não CALCULA nem SUGERE isso.

| # | Tipo | Descrição |
|---|------|-----------|
| **G4** | **GAP CRÍTICO** | A "Troca inteligente" é uma das 3 features headline do marketing (junto com "Manda ver!" e "Para aí."). **Não existe no código.** Nenhuma função, nenhum componente, nenhuma string i18n para essa feature. O marketing promete uma sugestão proativa de trade-off entre categorias; o app só tem ajuste manual (Planner) e sugestão de corte (Rescue). |

**Veredicto:** ❌ **NÃO IMPLEMENTADO**. É uma promessa vazia no marketing.

### Recomendação de implementação

Criar uma função pura `buildTradeOffSuggestions` no domínio:

```typescript
interface TradeOffSuggestion {
  fromProfile: { name: string; typicalCents: number };
  toProfile: { name: string; typicalCents: number };
  skipFromCount: number;
  gainToCount: number;
}
```

**Input**: perfis com plano, valores típicos, remaining.
**Lógica**: Para cada par de perfis (A, B) onde `A.typicalCents > B.typicalCents`, calcular quantos B cabem se pular 1 A. Retornar as trocas mais valiosas (maior razão ganho/perda).
**UI**: Slide extra no Amigo Sincero (carousel), tom `caution` ou `neutral`, com CTA "Ajustar no planejador".

Complexidade estimada: ~4h (domínio + i18n + slide no carousel).

---

## 6. "Responde em tempo real" — Nuance

### O que o marketing diz

> "TripPilot responde em tempo real. Não é um tracker que mostra o que você já gastou — é o amigo sincero que diz se pode gastar agora."

### Avaliação

| Aspecto | Status | Nota |
|---------|--------|------|
| Simulador: resposta instantânea | ✅ | Cálculo é síncrono, ~0ms |
| Outing: alertas em tempo real | ✅ | Após cada quick-add, alerta imediato |
| Dashboard: atualização ao registrar | ✅ | useAppData reativo, atualiza counters |
| "Não é um tracker" | ⚠️ | O app TEM uma lista de gastos, histórico, filtros — é TAMBÉM um tracker. A distinção do marketing é exagerada. |

**Veredicto:** ✅ O app é rápido e responsivo. O claim de "tempo real" é justo. O claim de "não é um tracker" é marketing forçado — é um tracker COM inteligência forward-looking.

---

## 7. Proactive Check-in — Amigo que fala sem ser provocado

### O que o marketing implica

O marketing posiciona o amigo como alguém que está "sempre presente", não apenas reactivo a gastos.

### O que o código entrega

`buildProactiveAmigo` (2026-07-09, marketing P1) — implementado literalmente para cumprir esta promessa:
- `no_spend_today`: "Dia tranquilo até agora! Livre hoje: €X. A economia de ontem já está no cofrinho."
- `piggy_grew`: "O cofrinho cresceu com a economia de ontem — guardados: €X."
- `on_rhythm`: "Tudo no ritmo! Livre para usar hoje: €X."

**Veredicto:** ✅ **BEM IMPLEMENTADO**. Adicionado especificamente para fechar o gap entre marketing e realidade.

---

## 8. Mockup do Landing — Precisão Visual

O phone mockup do landing mostra:

| Elemento | Marketing | Código | Match? |
|----------|-----------|--------|--------|
| "Livre para gastar hoje: €47" | Sim | `calculateTodayFreeBudget` → hero number | ✅ |
| "No plano — tranquilo" | Sim | Honest friend `on_plan` | ✅ |
| Bar: 3 / Mercado: 5 / Passeio: 1 | Sim | `OccasionCounter` carousel | ✅* |
| "Cofrinho: Guardou €24 — 73% de uma noite no bar!" | Sim | `piggy_movement` + equivalência | ⚠️ |
| Cidade + hora no header | Sim | Não existe no dashboard real | ❌ |

\* Requer ScenarioPlan configurado.

| # | Tipo | Descrição |
|---|------|-----------|
| **G5** | Gap visual | O mockup mostra "Espanha · Burgos" e "23:14" como header do app. O dashboard real NÃO mostra a cidade/hora — mostra o nome do trecho ativo. Detalle cosmético, mas é uma promessa visual que não existe. |
| **F8** | Equivalência do cofrinho | O marketing mostra "73% de uma noite no bar!" como equivalência. O `piggy_movement` extra mostra "Seu cofrinho rendeu €X — agora tem €Y guardado" mas NÃO calcula a equivalência em % de uma ocasião. A equivalência SÓ aparece no `can_afford_more` (quando incentiva a gastar). Quando o cofrinho apenas cresce, ele não diz "isso é 73% de uma noite". |

---

## Tabela Consolidada de Gaps

### ❌ Gaps Críticos (feature prometida mas não implementada)

| ID | Feature | Descrição | Impacto | Esforço |
|----|---------|-----------|---------|---------|
| **G4** | Troca Inteligente | "1 bar = 2 mercados" — feature de trade-off proativo entre categorias. Não existe no código. | **Alto** — é 1 das 3 mensagens headline do marketing | ~4h |

### ⚠️ Gaps Médios (funciona mas com diferença notável)

| ID | Feature | Descrição | Impacto | Esforço |
|----|---------|-----------|---------|---------|
| **G1** | Custo típico no counter | Marketing mostra "~€35/noite" como sublabel; app mostra "X feitas" | Médio — info útil para decisão rápida | ~1h |
| **G2** | Tom do "Para aí" | Marketing usa tom coloquial/direto; app usa tom técnico/formal | Médio — afeta a percepção emocional | ~2h (strings i18n) |
| **G3** | Contexto do freio | Marketing mistura cenário de bar com card de dashboard | Baixo — percepção correta em uso real | ~1h (copy) |
| **G5** | Cidade/hora no header | Mockup mostra localização; dashboard real não tem | Baixo — cosmético | ~3h (feature nova) |

### ⚠️ Fricções (funciona mas a experiência não é como o marketing vende)

| ID | Feature | Descrição | Impacto | Esforço |
|----|---------|-----------|---------|---------|
| **F1** | Simulador 2-step | Marketing: "digita o valor". Real: valor + destino | Médio — impressão de complexidade | ~3h (quick simulate) |
| **F4** | Setup obrigatório | Counters exigem ScenarioPlan, marketing não menciona | Alto — novo usuário vê dashboard vazio | ~6h (auto-plan) |
| ~~F6~~ | ~~Ativação do "Manda ver!"~~ | ~~Requer profileTypicals no dashboard model~~ | **CONFIRMADO OK** — `useDashboardModel.ts` injeta `profileTypicals` corretamente | ~0h |
| **F7** | Frequência do "Manda ver!" | Safety guard conservador = feature rara na prática | Médio — feature-headline do marketing raramente vista | ~2h (ajustar thresholds) |
| **F8** | Equivalência do cofrinho | "73% de uma noite" só aparece ao incentivar, não ao depositar | Baixo — info útil mas não crítica | ~2h |

---

## Plano de Ação Recomendado

### Prioridade 1 — Fechar os gaps do marketing (a trinca promessa)

1. **Implementar "Troca Inteligente"** (~4h)
   - Função pura `buildTradeOffSuggestions` em `domain/budget/`
   - Novo extra no carousel do Amigo Sincero: `trade_off`
   - Copy: "Troca inteligente: 1 {{from}} a menos = {{gain}} {{to}} a mais. Vale a pena?"
   - Gatilho: disparar quando o planner tem pelo menos 2 perfis com quantidades restantes e valores típicos diferentes

2. **Ajustar o tom do "Para aí"** (~2h)
   - No voice "durão", adicionar frases curtas e coloquiais para `over_budget`/`alert`
   - Ex: "Para aí. Mais um e você entra na reserva."
   - Dentro do outing mode, tornar os alertas mais diretos

### Prioridade 2 — Reduzir fricção de primeiro uso

3. **Auto-plan minimal** (~6h)
   - Após onboarding, se o usuário criou perfis mas não foi ao Planner, sugerir quantidades automáticas baseadas em: `floor(freeToSpend / typical) distribuído por perfil`
   - Uma notificação card: "O TripPilot sugeriu um plano. Quer ajustar?"

4. **Quick Simulate** (~3h)
   - Ao abrir o simulador, assumir `target: 'other'` como default
   - Mostrar resultado genérico imediato ao digitar o valor
   - Chips de destino REFINAM o resultado, não são pré-requisito

### Prioridade 3 — Polish

5. **Equivalência percentual no cofrinho** (~2h)
   - Quando o `piggy_movement` mostra um depósito, adicionar "isso já é X% de uma {{bestProfile}}"

6. ~~Confirmar injeção de profileTypicals~~ — **VERIFICADO OK**: `useDashboardModel.ts` (linha ~990) já injeta corretamente.

### Total estimado: ~19h (Tier 3: ~6.5h)

---

## Conclusão

O TripPilot é um produto **honesto** — a maior parte do marketing corresponde a features reais e bem implementadas. O gap mais grave é a "Troca Inteligente", que é uma promessa vazia. Os outros gaps são de **tom e UX**, não de funcionalidade. O plano de ação acima fecha todos os gaps com ~20h de trabalho (~7h Tier 3), priorizando o que o marketing posiciona como headline.
