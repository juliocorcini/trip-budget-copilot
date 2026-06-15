# Copiloto — Inteligência & Informações Cruzadas (2026-06-15)

> Brainstorm do conselho (inline) sobre o que a tela **Copiloto** pode entregar agora
> que tem espaço próprio. Princípio: o app já coleta MUITOS dados do usuário; o
> Copiloto cruza esses dados em informação que o usuário **não consegue ver sozinho**.
> "Pra onde vou? O que faço certo? O que faço errado? Como está vs como deveria ser?"

---

## 0. Dados que já temos (matéria-prima)

**Brutos:** transações (valor, categoria, perfil/ocasião, data, fase, carteira, método,
participantes/divisões, sessão/saída, nota) · fases (orçamento, datas, atividades) ·
fundos/envelopes · carteiras · perfis (valor típico aprendido, categoria) · divisões e
acertos · saídas (alvo, preço médio de rodada, itens) · compras planejadas (reservado) ·
eventos planejados · **snapshots diários de previsão** (fts/gasto/projeção por dia).

**Derivações já prontas (reuso):** free-to-spend, livre-hoje, projeção fim-de-fase,
burndown (gasto real vs ideal), heatmap do mês, recap de ontem, savings da última saída,
meta/cofrinho, insights rotativos, amigoV2, categoryRhythm (plano×real por categoria),
debts (quem deve a quem), forecasts de ocasião, valueSuggestion, tripPriors.

---

## 1. Brainstorm — 4 lentes

### Visionário (10x — "e se o app pensasse por você?")
- **Narrativa viva da viagem:** Copiloto conta a viagem como história — "começou cauteloso,
  soltou no fim de semana, voltou ao ritmo". Capítulos, não tabelas.
- **"O futuro provável":** com snapshots diários, projetar não só o total, mas a **curva** —
  "se nada mudar, fecha €X; reserva começa a ser usada em DATA".
- **Comparar fases como temporadas:** Burgos vs Madrid lado a lado ("temporada 1 vs 2").
- **Recomendação proativa do dia:** "hoje dá pra um jantar caprichado sem sair do plano".

### Analista (dado/evidência)
- **De onde veio (categorias)** — barras, % do total. (já validado pelo Julio)
- **Plano × real por categoria** — reusar ImpactDetail/categoryRhythm.
- **Padrão por dia-da-semana** — fim de semana custa Nx o dia útil (de `tx.date`).
- **Maior dia · média/dia · mediana** — agrupar com o mapa do mês (sugestão do Julio).
- **Ritmo (burndown)** — gasto real vs ideal vs folga. (vinda da home)
- **Eficiência de saídas** — quantas saídas bateram o alvo; média de economia por saída.
- **Social vs solo** — % gasto compartilhado (de `isShared`/shares).
- **Carteira** — cash vs cartão; lembrete de reconciliar quando divergir.

### Conector (analogias de outros apps)
- **Spotify Wrapped / Strava:** "resumo" com superlativos ("seu maior dia", "categoria nº1").
- **Apple Health "trends":** seta ↑/↓ vs período anterior, com leitura humana ("melhor que ontem").
- **Mint/YNAB "insights":** "você gasta 32% em comida — média de viagem é ~25%".
- **Waze "chegada prevista":** ETA do orçamento — "no ritmo, sobra €X no fim".

### Simplificador (o 20% que dá 80%)
- A tela só precisa responder **3 perguntas**, no topo, em 1 frase cada:
  1. **Estou bem?** (veredito) 2. **Pra onde vou?** (projeção) 3. **O que faço agora?** (1 ação).
- Tudo abaixo é "se quiser se aprofundar". Nada de sobrecarregar.
- Reusar derivações existentes; **não** criar cálculo novo onde já existe.
- Cada módulo só aparece **quando tem dado suficiente** (senão polui).

---

## 2. Catálogo de módulos (consolidado) — fonte · valor · quando mostrar · esforço

| # | Módulo | Fonte de dado | Quando aparece | Esforço |
|---|---|---|---|---|
| 1 | **Veredito** (estou bem?) | burndown/projeção | sempre que há fase ativa + ≥1 gasto | reuso |
| 2 | **Pra onde vai** (projeção + reserva) | projeção + reserveDate | ≥2 dias de dado | reuso |
| 3 | **Ritmo da fase** | burndown | ≥1 gasto | reuso |
| 4 | **O que eu faria** (amigo reconciliado + ação) | amigoV2 + fts | há perfil recente | reuso+ |
| 5 | **De onde veio** (categorias) | groupByCategory | ≥3 gastos | baixo |
| 6 | **Mapa do mês + maior dia/média** | heatmap + tx | ≥3 dias com gasto | baixo |
| 7 | **Dia da semana** (fim de semana × útil) | tx.date | ≥7 dias de dado | médio |
| 8 | **Comparar com fase anterior** | tx por fase | ≥2 fases com gasto | médio |
| 9 | **Eficiência de saídas** | sessions + savings | ≥2 saídas fechadas | médio |
| 10 | **Social vs solo** | isShared/shares | há gasto compartilhado | baixo |
| 11 | **Dívidas (quem deve a quem)** | calculateDebts | há dívida ≠ 0 | reuso |
| 12 | **Carteira/reconciliar** | wallets vs tx | divergência detectada | médio |
| 13 | **Ferramentas** (simular · resgate · ocasiões) | páginas existentes | sempre | reuso |
| 14 | **Resumo "Wrapped" da viagem** | tudo | viagem encerrada | alto (V2) |

---

## 3. Priorização do conselho (ordem na tela + quando)

**Topo fixo (as 3 perguntas — sempre que houver dado):**
1. Veredito · 2. Pra onde vai · 3. O que eu faria (amigo + 1 ação).

**Aprofundamento (na ordem, cada um se tiver dado):**
4. Ritmo da fase → 5. De onde veio → 6. Mapa do mês + maior dia/média →
7. Comparar com fase anterior (quando 2+ fases) → 8. Dia da semana (quando ≥7 dias) →
9. Eficiência de saídas → 10. Social vs solo / Dívidas.

**Rodapé:** Ferramentas (simular · resgate · ocasiões).

**Regras de exibição (anti-poluição):**
- Cada módulo tem um **gate de dados** (tabela §2). Sem dado → não renderiza (não mostra "vazio").
- **Modo simples:** só topo (1–3) + ritmo + ferramentas. Avançado: tudo.
- Estado inicial (viagem nova, 0 gasto): Copiloto mostra um **onboarding curto** ("comece a
  registrar gastos que eu começo a te mostrar pra onde sua viagem vai") em vez de tela vazia.

**Confiança:** ALTA para 1–6 e 13 (reuso ou cálculo simples sobre dado existente).
MÉDIA para 7–9, 12 (dependem de volume de dado / novos cálculos). 14 é V2.

---

## 4. Implementação por fases (dentro do G3)

- **G3.1 — esqueleto + topo:** página `/copiloto`, header, módulos 1–3 (reuso de
  burndown/projeção/amigoV2). Gate de dados + estado inicial.
- **G3.2 — aprofundamento barato:** 4 (ação), 5 (de onde veio), 6 (mapa+maior/média),
  3 (ritmo). Tudo reuso/baixo.
- **G3.3 — cruzamentos novos:** 7 (fase anterior), 10 (social/solo), 11 (dívidas). Domínio
  puro + testes unitários (math verificada).
- **G3.4 — ferramentas:** 13 (simular/resgate/ocasiões) no rodapé.
- (8 dia-da-semana, 9 eficiência, 12 carteira, 14 wrapped) — backlog priorizado p/ próximas.

Cada submódulo novo de cálculo nasce em `src/domain/copilot/` (puro, testável), e a página
só **orquestra** (regra de engenharia: lógica fora da UI).

---

## 5. Decisões registradas (para o decision-log)

- **DEC-177 (proposto):** Copiloto é a tela de inteligência; responde 3 perguntas no topo
  (estou bem / pra onde vou / o que faço) e aprofunda por módulos com **gate de dados**.
- **DEC-178 (proposto):** novos cálculos de cruzamento vivem em `src/domain/copilot/`
  (puros + testados); a página só orquestra.
- **DEC-179 (proposto):** comparação entre fases e dia-da-semana entram quando há volume
  de dado (≥2 fases / ≥7 dias); até lá ficam ocultos.
