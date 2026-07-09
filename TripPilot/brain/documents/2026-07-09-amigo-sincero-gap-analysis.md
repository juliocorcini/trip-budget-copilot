# Amigo Sincero — Gap Analysis: Por que não aparece e o que mudar

> **Data**: 2026-07-09
> **Origem**: Investigação do código após conselho de marketing identificar desconexão entre promessa de marketing e experiência real
> **Arquivos investigados**: `honest-friend.ts`, `amigo-trigger.ts`, `honest-friend-extras.ts`, `honest-friend-voice.ts`, `AmigoSinceroCard.tsx`, `useDashboardModel.ts`

---

## 1. Diagnóstico: Por que o Julio quase nunca vê o Amigo Sincero

### Causa raiz: O Amigo Sincero é REATIVO, não PROATIVO

O `buildHonestFriendV2` (linha 243 de `honest-friend.ts`) tem como **primeira condição**:

```typescript
if (input.recentSpendCents <= 0) {
  return { kind: 'none' };
}
```

Isso significa: **sem gasto recente, sem amigo**. O card só aparece quando há uma despesa para comentar. Se o usuário:
- Não registrou gastos hoje → nada
- Está em dia de descanso (hospedado com família, dia sem sair) → nada
- Está planejando mas ainda não gastou → nada

### Causa 2: `on_plan` é ESCONDIDO na Home

No `AmigoSinceroCard.tsx`, a Home passa `hideOnPlan={true}`:

```typescript
const verdictShown =
  amigo.kind !== 'none' && !(hideOnPlan && amigo.kind === 'on_plan');
```

Resultado: quando as coisas estão bem (dentro do plano), a Home **não mostra nada**. O usuário só vê o amigo quando tem problema — criando a percepção de "ele nunca aparece" (porque a maioria dos dias são normais).

### Causa 3: `no_plan` é genérico e repetitivo

Quando o gasto não tem activity profile ou o profile não tem plano, o fallback é:

```typescript
// "Esse gasto levou X% do dinheiro livre"
kind: 'no_plan', impactPercent
```

Isso se repete para qualquer gasto sem perfil — "esse gasto levou 1% do livre", "esse levou 3%". Monótono. Julio flagou isso como "sempre a mesma coisa".

### Causa 4: Extras dependem de condições estreitas

Os extras (carousel slides) só aparecem quando:
- `piggy_movement`: o cofrinho teve movimento HOJE (se não gastou, não tem)
- `daily_left`: precisa ter dias restantes > 0
- `phase_progress`: precisa ter orçamento > 0
- `top_category`: precisa ter gastos categorizados
- `receivable`: precisa ter dívidas a receber

Se o cofrinho não moveu, não tem receivables, e o gasto não tem perfil → o amigo fica com um slide genérico só.

### Causa 5: Voice lines existem mas ficam presas no fluxo

As voice lines (DEC-264, `honest-friend-voice.ts`) têm frases emocionais por tom (positivo, cauteloso, alerta), mas elas só falam **por cima de um verdict**. Se o verdict é `none` ou `on_plan` (escondido), a voz nunca soa.

---

## 2. O que o marketing promete vs. o que o app entrega

| Promessa de marketing | Existe no código? | Aparece para o usuário? | Por quê não? |
|---|---|---|---|
| "Para aí. Mais um drink e você entra na reserva." | Sim (`over_budget`, `over_pace`) | Só quando está REALMENTE no limite | Funciona, mas é raro — requer gastar até o limite |
| "Manda ver! Guardou €24 — suficiente para uma noite extra!" | **Parcialmente** — piggy_movement mostra economia | Raramente | Depende de (a) cofrinho ter movido HOJE e (b) o gasto recente ser profilado |
| "Troca inteligente: uma noite a menos no bar = 2 idas ao mercado" | **NÃO existe** como mensagem proativa | Nunca | O planner mostra trade-offs, mas o amigo sincero nunca sugere trocas espontaneamente |
| "Você pode pedir mais uma cerveja" (outing mode) | Sim — alertas progressivos na sessão ativa | Sim, durante outings | Funciona. O problema é fora do outing mode |
| Insights diários e proativos | Sim — insights carousel (DEC-076/077) | Sim, mas limitados a 4/dia com regras de significância | Funciona, mas é o carousel de insights, não o "amigo sincero" com personalidade |

---

## 3. O que mudar — Proposta de melhoria

### Nível 1: Ajustes rápidos (sem mudança de modelo)

**1.1. Mostrar `on_plan` na Home (com tom celebratório)**
- Remover `hideOnPlan` da Home ou torná-lo condicional
- Quando `on_plan`: mostrar "Tudo dentro do plano — 3 de 5 noites no bar feitas, 2 ainda cabem" com tom verde
- Isso faz o amigo aparecer TODO DIA que o usuário tem um plano e gastos

**1.2. Adicionar mensagem proativa SEM gasto recente**
- Novo kind: `proactive_check_in` — quando NÃO tem gasto recente mas o cofrinho cresceu ou o dia está dentro do ritmo
- Frases: "Dia tranquilo? O cofrinho cresceu €X. Você tem €Y guardado." / "Sem gastos hoje — o ritmo está ótimo"
- Trigger: rodar `buildHonestFriendV2` mesmo sem `recentSpendCents > 0`

**1.3. Mensagem de "pode gastar mais" quando cofrinho está grande**
- Novo kind: `can_afford_more` — quando o cofrinho acumulou mais que 1 ocasião típica
- Frase: "O cofrinho tem €45 — suficiente para uma noite extra no bar (típico: €35). Aproveita!"
- Condição: `piggyBalanceCents >= (melhor perfil típico × 1)`

**1.4. Troca inteligente proativa**
- Novo kind: `smart_trade` — quando o perfil de maior gasto está acima do ritmo mas outro está abaixo
- Frase: "Restaurantes estão acima do ritmo (5 de 4 planejados). Se cortar 1, ganha 2 idas ao mercado."
- Condição: algum perfil `doneQuantity > plannedQuantity` E outro `doneQuantity < plannedQuantity`

### Nível 2: Repensar o modelo (mudança de lógica)

**2.1. Amigo Sincero DIÁRIO ao invés de por-gasto**
- Hoje: o amigo comenta UM gasto. Deveria: comentar O DIA
- Nova lógica: todo dia ao abrir o app, o amigo tem algo para dizer — sobre o dia anterior, sobre o cofrinho, sobre o ritmo, sobre uma oportunidade
- O gasto recente continua sendo UM dos triggers, mas não o único

**2.2. Banco de frases por situação (expandir voice lines)**
- Hoje: as voice lines são genéricas por tom (positive/caution/alert)
- Proposta: frases específicas por situação:
  - Cofrinho crescendo: "Dia bom pro cofrinho! +€{X} guardados."
  - Under budget consistente: "3 dias seguidos abaixo do ritmo — está sobrando para uma noite extra."
  - Primeiro gasto do dia: "Bom dia! Livre hoje: €{X}. O que vai rolar?"
  - Fim do dia sem gastos: "Dia sem gastos! O cofrinho agradece."
  - Categoria acima do ritmo: "Bar está puxando: {done} de {planned}. Tudo bem?"
  - Economia equivalente: "Ontem você economizou €{X} — isso é {percent}% de uma noite no bar."

**2.3. Card sempre visível na Home com conteúdo rotativo**
- O Amigo Sincero nunca fica vazio na Home — sempre tem algo
- Hierarquia de conteúdo (do mais urgente ao mais tranquilo):
  1. Alerta real (over_budget, over_pace com reserva em risco) → vermelho
  2. Verdito do gasto recente (se houver) → cor por tom
  3. Check-in proativo (ritmo, cofrinho, oportunidade) → verde/neutro
  4. Frase do dia (motivacional, baseada no estado geral) → neutro

---

## 4. Comparativo: Estado atual vs. Estado desejado

| Aspecto | Hoje | Desejado |
|---|---|---|
| Visibilidade na Home | Só com gasto recente + fora do `on_plan` | Sempre — sempre tem algo para dizer |
| Tom | Predominantemente neutro/negativo | Equilibrado: celebra, incentiva E avisa |
| Tipo de trigger | Reativo (precisa de gasto) | Reativo + proativo (estado do dia/fase) |
| Variedade de frases | ~5 voice lines por tom | 15-20 frases por situação específica |
| "Pode gastar mais" | Não existe explicitamente | Proativo quando cofrinho > 1 ocasião típica |
| "Troca inteligente" | Só no Planner (interativo) | Sugestão proativa no amigo quando detecta oportunidade |
| Check-in matinal | Não existe | "Bom dia! Livre hoje: €X" |

---

## 5. Prioridade de implementação

| # | Mudança | Impacto | Esforço | Prioridade |
|---|---|---|---|---|
| 1 | Mostrar `on_plan` na Home | ALTO — amigo aparece nos dias bons | BAIXO — trocar `hideOnPlan` | P0 |
| 2 | Kind `can_afford_more` (cofrinho grande) | ALTO — realiza a promessa de marketing | MÉDIO — novo kind + lógica | P0 |
| 3 | Kind `proactive_check_in` (sem gasto) | ALTO — amigo fala todo dia | MÉDIO — novo trigger path | P1 |
| 4 | Banco de frases por situação | ALTO — variedade | BAIXO — i18n strings | P1 |
| 5 | Kind `smart_trade` proativo | MÉDIO — diferenciador | MÉDIO — lógica de comparação entre perfis | P2 |
| 6 | Card sempre visível (hierarquia) | ALTO — elimina "nunca vejo" | MÉDIO — refatorar o fallback | P1 |

---

## 6. Resumo executivo

**O problema não é que o Amigo Sincero está "quebrado"** — a lógica funciona corretamente para o que foi projetado (DEC-092/093). O problema é que ele foi projetado como **reativo** (comenta gastos) e o marketing o vende como **proativo** (companheiro de viagem que fala com você).

**A correção mais rápida (P0)** é:
1. Mostrar `on_plan` na Home com tom celebratório
2. Adicionar `can_afford_more` quando o cofrinho tem 1+ ocasião típica

Essas duas mudanças fazem o amigo aparecer **na maioria dos dias** ao invés de apenas nos dias de problema, e realizam a promessa mais diferenciadora do marketing: "o app que também manda gastar".

---

*Documento de investigação. Sujeito a decisão de produto (DEC) para implementação.*
