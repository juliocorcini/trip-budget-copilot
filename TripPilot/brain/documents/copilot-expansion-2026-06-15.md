# Copiloto — Expansão da Inteligência (2026-06-15)

> 2ª rodada de conselho (inline, 4 lentes de brainstorm + priorização), pedida pelo
> Julio: "agora que o Copiloto tem tela própria, o que MAIS dá pra entregar cruzando
> os dados que já temos? O usuário coloca muito dado; a gente precisa cruzar nas
> formas certas e devolver informação que ele não consegue ver sozinho."
>
> Continuação de `copilot-intelligence-2026-06-15.md` (1ª rodada → G3). Aqui só
> entram cruzamentos **novos** (não duplicar o que o G3/G6 já entregam).

---

## 0. O que o Copiloto JÁ entrega (G3+G6) — não duplicar

Veredito · Pra onde vai (projeção+reserva) · Amigo sincero reconciliado · De onde
veio (categorias) · Mapa do mês (+maior dia/média) · Ritmo da fase (burndown) ·
Comparar com a fase anterior · Social × solo · Acertos (dívidas) · Ferramentas.

## 0.1 Matéria-prima ainda SUBaproveitada (auditoria do useDashboardModel/dados)

- **`forecast_snapshots`** — 1 snapshot por fase **por dia** (fts, gasto, projeção de
  fechamento, média/dia, dias de dado). **Persistido desde o M8.3, quase não exibido.**
  É a única série temporal do app → permite "como ESTAVA × como ESTÁ".
- **`tx.date`** completo (dia da semana, hora) — padrões temporais inexplorados.
- **`completedSessions` + `targetCents`** — eficiência de saídas (bateu o alvo?).
- **`wallet`/método** — cash × cartão (reconciliação).
- **anchor** (settings) — converter total pra "moeda de casa" (R$).

---

## 1. Brainstorm — 4 lentes

### Visionário (10x — "e se o app pensasse por você?")
- **Curva da rota:** com os snapshots diários, mostrar a **correção de rota** —
  "há 4 dias você projetava fechar €1.100; hoje €980. Você puxou o freio." É o
  "como era pra ser × como está ficando" que o Julio pediu, literal.
- **ETA do dinheiro (Waze):** "no ritmo de hoje, seu livre acaba dia 22 — 3 dias
  antes do fim da fase". Visceral, acionável.
- **Narrador:** o Copiloto fala em 1ª pessoa ("puxei o freio", "soltei no fds").

### Analista (dado/evidência)
- **Tendência da projeção** (série de snapshots): Δ projeção nos últimos N dias.
- **Dia da semana:** fds custa Nx o dia útil (de `tx.date`). Clássico (YNAB/Mint).
- **Eficiência de saídas:** % das saídas que bateram o alvo + economia média/saída.
- **Cash × cartão:** divisão por método; lembrete de reconciliar quando divergir.
- **Total na moeda de casa:** "você já gastou ~R$ X" (anchor).

### Conector (analogias)
- **Strava/Whoop "trend":** seta ↑/↓ vs ontem/início, com leitura humana.
- **Apple Health:** "você está melhorando" (rota corrigindo) > número cru.
- **Waze ETA:** runway do dinheiro.
- **Spotify Wrapped:** superlativos ("seu maior gasto", "categoria nº1") — V2 fim.

### Simplificador (o 20% que dá 80%)
- O usuário já tem MUITA coisa. Cada módulo novo precisa passar no teste:
  **"isso muda uma decisão hoje?"** Se não, é poluição → backlog.
- Passa no teste: **rota corrigindo** (motiva/alerta), **runway** (decisão de gasto
  hoje), **dia da semana** (planejar o fds). Eficiência de saídas: motiva quem usa
  saídas. Os demais (cash×cartão, R$, superlativos) são "legal", não "decisivo".
- Tudo **data-gated**: sem dado suficiente, não renderiza (regra anti-poluição do G3).

---

## 2. Catálogo novo — fonte · valor · gate · esforço

| # | Módulo | Fonte | Quando aparece | Valor | Esforço |
|---|---|---|---|---|---|
| A | **Rota corrigindo** (tendência da projeção) | forecast_snapshots | ≥2 snapshots com projeção e Δ ≥ tolerância | ALTO (único) | médio |
| B | **Runway** (seu livre dura / acaba em DATA) | fts + média/dia | fts>0 e média/dia>0 | ALTO (acionável) | baixo |
| C | **Dia da semana** (fds × útil) | tx.date | ≥1 dia fds e ≥1 útil com gasto | MÉDIO-ALTO | médio |
| D | **Eficiência de saídas** | sessions + targetCents | ≥2 saídas fechadas com alvo | MÉDIO | médio |
| E | Cash × cartão (reconciliar) | wallet/método | divergência | BAIXO-MÉDIO | médio |
| F | Total em R$ (moeda de casa) | anchor | anchor definido | BAIXO | baixo |
| G | Hora de pico / streak | tx.date | volume | BAIXO | médio |
| H | Wrapped fim de viagem | tudo | viagem encerrada | ALTO (V2) | alto |

---

## 3. Prioridade do conselho (o que entra no G8, ordem na tela, gate)

**G8 (construir agora) — A, B, C, D.** Todos respondem perguntas que o Julio
nomeou (pra onde vou / o que faço certo / como estava × como está) e cada um pode
mudar uma decisão. A é o destaque (dado exclusivo, série temporal).

**Ordem na tela (encaixe no fluxo existente, sem quebrar a narrativa):**
1. Veredito *(existe)*
2. Pra onde vai — projeção *(existe)*
   - **+A Rota corrigindo** (logo após a projeção — mesma história "futuro")
   - **+B Runway** (logo após — "e dura até quando")
3. Amigo sincero *(existe)*
4. De onde veio *(existe)*
5. Mapa do mês + maior dia/média *(existe)*
   - **+C Dia da semana** (logo após o mapa — mesmo tema "dias")
6. Ritmo da fase *(existe)*
7. Comparar com fase anterior *(existe)*
   - **+D Eficiência de saídas** (perto do "como ficou" — leitura de comportamento)
8. Social × solo · Acertos *(existem)*
9. Ferramentas *(existe)*

**Regras de exibição (anti-poluição, mantidas do G3):**
- Cada módulo tem gate de dado (tabela §2). Sem dado → não renderiza.
- Nada de número cru sem leitura humana (seta + frase). Reuso de derivações.
- Cálculo novo nasce em `src/domain/copilot/` (puro + teste de math).

**Backlog (não agora):** E (cash×cartão), F (R$), G (hora/streak), H (Wrapped V2).
Motivo: valor "legal" mas não decisivo, ou exige volume/encerramento.

**Confiança:** ALTA para A, B (dado já existe; math simples). MÉDIA para C, D
(dependem de volume: ≥1 fds / ≥2 saídas).

---

## 4. Decisões (para o decision-log)

- **DEC-181:** Copiloto ganha "Rota corrigindo" — tendência da projeção de
  fechamento sobre os `forecast_snapshots` (série temporal já persistida). Só
  aparece quando há ≥2 snapshots e o Δ supera a tolerância.
- **DEC-182:** Runway do livre ("dura ~N dias / acaba em DATA") — derivação de
  fts ÷ média-diária; reuso, sem novo dado. Mensagem positiva quando cobre a fase.
- **DEC-183:** Padrão por dia da semana (fds × útil) entra com gate ≥1 dia de cada
  tipo com gasto; abaixo disso fica oculto.
- **DEC-184:** Eficiência de saídas (bateu o alvo + economia média) entra com gate
  ≥2 saídas fechadas com alvo. Cálculo puro em domain/copilot + testes.
- Backlog registrado: cash×cartão, total em moeda-casa, hora/streak, Wrapped fim.
