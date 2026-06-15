# Redesign de Navegação & Hierarquia — Plano Completo (2026-06-15)

> Base: feedback detalhado do Julio sobre os wireframes da aba "Viagem"/"Copiloto".
> Versão atual do app: **0.19.0**. Este documento é a MEMÓRIA do redesign — nada
> aqui pode regredir função existente. Pode reformular/re-exibir; não pode perder.

---

## 0.0 Contrato de Design (CRÍTICO — leitura do Julio em 15/06, 2ª rodada de wireframe)

> O Julio aprovou a **organização/posicionamento** do redesign, mas deixou claro que
> **prefere o visual (a "cara") do app de HOJE**. Isto **não é um redesign visual**.
> É uma mudança de **navegação + hierarquia + alguns ajustes pontuais de clareza**.

**Regras do contrato:**

1. **Linguagem visual de hoje = mantida.** Mesmos componentes, mesmos estilos de card,
   mesma estética. Não trocar "a cara" do app. O wireframe v2 parecia um app novo —
   isso confundiu; **não é a meta**.
2. **Todo componente/comportamento atual é preservado verbatim.** Em especial:
   - **Insights = CARROSSEL ROTATIVO** (DEC-091/DEC-077): auto-rotação 7s, máx 4/dia,
     bolinhas indicadoras, pausa ao tocar, respeita reduced-motion. A v2 achatou num
     card estático de 2 caixas — **isso foi um ERRO e está revertido**. Insights ficam
     exatamente como hoje (versão profunda no Copiloto é adição, não substituição).
   - Ocasiões = carrossel scroll-snap com acentos por categoria (como hoje).
   - Hero, divisões, fundos, gastos recentes etc. = mesmos componentes de hoje.
3. **Wireframe = referência ESTRUTURAL apenas, nunca alvo visual.** O preview honesto
   é o **app real rodando** (screenshots do app de hoje, reorganizado), não um HTML
   inventado. Daqui pra frente, validar com screenshots do app real.
4. **Ajustes de clareza permitidos (os que o Julio elogiou) — só estes:**
   - Hero: nome da fase no lugar da data repetida; **"Livre hoje €X" explícito**
     (não só um número solto); sinal de ritmo **com significado** (ex.: "€72 abaixo do
     ritmo ideal" em vez de "72 ▾"); **breakdown "de onde vem" PRESERVADO** no tap.
   - Check-in: microcopy explicando *por que* perguntamos + modos com **efeito real**.
   - Amigo sincero: **sem barrinha colorida** à esquerda; mensagem reconciliada.
   - Mover analytics pesados (mapa do mês, ritmo, projeção) pra **Copiloto**.
5. **Em caso de dúvida entre "mudar visual" e "manter visual de hoje": manter o de hoje.**

---

## 0. Princípio inegociável — ZERO regressão

Construímos muita coisa até a v0.19. Em **qualquer** mudança de tela, cada função
e cada informação tem que continuar existindo (pode mudar de lugar/forma). Abaixo,
o **inventário-auditoria**: toda função atual → onde ela vive no novo desenho.

### 0.1 Telas (rotas) hoje
`/dashboard` (Início) · `/expenses` (Gastos + aba Saídas) · `/expenses/:id` (detalhe + breakdown "de onde vem") · `/outings/new|active|:id/review` (saídas) · `/planner` (planejar: ocasiões restaurante/bar/mercado + margem) · `/simulator` (posso gastar?) · `/rescue` (resgate) · `/trip` + `/trip/edit` (visão geral + editar fases) · `/funds` (fundos) · `/wallets` (carteiras) · `/planned` (compras planejadas) · `/profiles` (perfis/ocasiões) · `/shared` (participantes & dívidas) · `/notifications` · `/impact` (planejado vs gasto, projeção, reserva) · `/more` (Mais) · `/settings` · `/settings/backup` · `/settings/dashboard` · `/about` (sobre & diagnóstico) · `/sync` · onboarding.

### 0.2 Cards configuráveis da home hoje (DEC-119)
`today_events`, `daily_checkin`, `savings_goal` (meta), `piggy_bank` (cofrinho), `active_outing`, `hero` (livre pra usar), `occasion_counters` (restam X no restaurante/bar/mercado), `insights` (carrossel), `amigo_sincero`, `pending_shares` (DIVISÕES), `funds_summary`, `planned_purchases`, `trip_analytics` (gaveta: recap de ontem + burndown da fase + mapa do mês), `recent_expenses`. **Reordenáveis e ocultáveis pelo usuário.**

### 0.3 Ações do FAB (+)
registrar gasto · iniciar saída · simular compra · registrar mercado · planejar compra · registrar transferência · registrar saque.

### 0.4 Mapa anti-regressão (função → novo lar)
| Função atual | Novo lar |
|---|---|
| Livre pra usar + **breakdown "de onde vem"** (tap → ponto a ponto) | **Início** (hero) — breakdown PRESERVADO no tap |
| Check-in do dia | **Início** — "Como vai ser hoje?" agora **com efeito real** (lente) |
| Insights (carrossel) | **Início** (fica — amado) + versão profunda no Copiloto |
| Amigo sincero | **Início** (manchete) + **Copiloto** (completo, reconciliado) |
| Divisões / pendências de split | **Início** (card pending_shares — fica) + `/shared` |
| Ocasiões (restam X restaurante/bar/mercado) | **Início** (card — fica) + ritmo no **Copiloto** + config em Perfis/Planner |
| Meta de economia / Cofrinho | **Início** (cards — ficam, configuráveis) |
| Compras planejadas | **Início** (card) + **Viagem › Planejamento** (CRUD) |
| Compras pessoais | **Início** (card, configurável) + dentro de Fundos/envelope |
| Recap de ontem / Burndown / **Mapa do mês** | **Copiloto** (saem da home pra lá — agrupados com maior dia/média) |
| Gastos recentes | **Início** (peek pequeno, configurável) + **Gastos** (lista completa) |
| Ritmo da fase | **Copiloto** (principal) |
| Projeção / Ver impacto | **Copiloto** ("pra onde vai" + ferramenta "ver impacto") |
| Simulador "posso gastar?" | **Copiloto › Ferramentas** + FAB |
| Resgate (SOS) | **Copiloto › Ferramentas** |
| Saídas (iniciar/ativa/rodadas/recap) | **Gastos** (aba Saídas) + FAB |
| Planejar (cenários/margem/ocasiões) | **Viagem › Planejamento › Cenários & margem** (com preview inline) |
| Fundos | **Viagem › Fundos** (com explicação "o que é um fundo") |
| Carteiras | **Viagem › Estrutura › Carteiras** |
| Perfis / Pessoas (participantes & dívidas) / Fases | **Viagem › Estrutura** |
| Notificações | sino no header do Início (fica) |
| Ajustes (config, backup, export CSV, dashboard config, lock, tema, idioma, modo, persistência, sync, sobre/diagnóstico) | **engrenagem** no header do Início → `/settings` |
| **NOVO** Guia "tudo que dá pra fazer" | dentro de Ajustes (e destaque no 1º uso) |

Resultado: **nada sai do app.** O que muda é *onde mora* e *como aparece*.

---

## 1. Arquitetura final (barra)

`Início · Gastos · ( + ) · Viagem · Copiloto`  — o "Mais" deixa de existir.

- **Início (Hoje):** manchete viva — os sinais processados mais importantes, glance rápido. Mantém o sistema de cards configurável.
- **Gastos:** gastos + saídas (sem mudança estrutural).
- **( + ):** ações rápidas (FAB) — sem mudança.
- **Viagem:** o *plano/estrutura* — fases (cross-phase), planejamento (cenários + compras planejadas), fundos, estrutura (perfis, pessoas, carteiras).
- **Copiloto:** a *inteligência* — como está, pra onde vai, o que fazer, de onde veio + ferramentas (simulador, resgate, ocasiões, mapa do mês).
- **Ajustes:** engrenagem no header do Início (não ocupa slot). O sino de notificações continua no header.

Modo simples: barra enxuta (Início, Gastos, +, Viagem). Copiloto e itens "advanced" seguem `visibleInMode`.

---

## 2. Especificação por tela

### 2.1 Início (Hoje) — correções do feedback
- **Header:** `DIA 5 · até 22 jun` (olho) + **nome da fase** (h1). Direita: **sino** + **engrenagem** (Ajustes).
- **Hero "Livre pra usar":**
  - NÃO repetir a data (o header já tem). Referenciar a **fase** ("Fase Lisboa") quando útil.
  - **"Livre hoje" explícito** com rótulo e moeda: `Livre hoje: €49` (não o minimalista "·hoje ~49", que confunde). Mantém o grande "Livre nesta fase €900".
  - **Tap → breakdown "de onde vem"** (DEC-172) PRESERVADO.
  - Sinal de ritmo **com significado claro** + cor: em vez de "72 à frente do ritmo ↓", usar **"Você está €72 no azul (abaixo do ritmo ideal)"** com cor de sucesso; se acima, **"€X acima do ritmo"** em alerta.
  - "Reserva €150 intacta" — mantém.
- **Check-in "Como vai ser hoje?"** (ver §3 — agora com efeito real) + **micro-explicação** do porquê.
- **Cards (configuráveis, ficam):** amigo_sincero (manchete + "ver no Copiloto"), insights (carrossel), occasion_counters, pending_shares (divisões), planned_purchases, funds_summary, savings_goal, piggy_bank, recent_expenses (peek).
- **Saem da home → Copiloto:** trip_analytics (recap de ontem, burndown, **mapa do mês**).
- **Regra de design:** **remover a barrinha colorida à esquerda dos cards** (parece "cara de AI"). Cards limpos: ícone + conteúdo, hierarquia por peso/cor de texto.

### 2.2 Copiloto (a inteligência) — a estrela
Fluxo em capítulos (história):
1. **Veredito** — "Você está no controle — gastando abaixo do planejado, dá pra relaxar." + gráfico de ritmo. (APROVADO)
2. **Pra onde vai** — "Neste ritmo de gastos, a fase fecha em €1.037 — €116 **abaixo** do plano. Reserva intacta." (frase condicional, abaixo/acima). (APROVADO)
3. **Ritmo da fase** — barra gasto vs ideal vs orçamento (vinda da home).
4. **O que eu faria — Amigo sincero (reconciliado)** — ver §4. + ações: "Simular um gasto" / "Ver impacto". (APROVADO)
5. **De onde veio** — categorias (comida/bares/transporte/passeio). (APROVADO "muito bom")
6. **Mapa do mês + maior dia + média** — agrupados (todos sobre "dias"). (sugestão do Julio)
7. **Ferramentas** — Posso gastar? (simulador, com detalhe) · Resgate (SOS) · Ocasiões.
8. (a explorar) comparação com fase anterior, projeção por fundo, "o que fazer/ não fazer".

### 2.3 Viagem (o plano) — precisa de foco a mais (feedback)
- **Redundância filtro × "Fases da viagem":** resolver. Decisão (ver §5): **um seletor de fase** (dropdown/segmented) define o contexto. Com **"Todas"** → mostra os cards ricos "Fases da viagem" (cross-phase). Com **uma fase** escolhida → a página inteira filtra pra aquela fase (planejamento, fundos, ocasiões daquela fase) e a lista "Fases da viagem" some (não duplica).
- **Planejamento "escondido":** mostrar **preview inline** de "Cenários & margem" (fase livre, quanto pra restaurante/mercado) em vez de só um link — reduz o "tenho que clicar pra ver". + Compras planejadas (CRUD).
- **Fundos × Carteiras (inconsistência):** padronizar. Fundos = **seção** (tem saldo vivo) com micro-explicação "o que é um fundo". Carteiras = **tile** em Estrutura. (ver §5)
- **Estrutura:** Fases · Perfis · Pessoas (participantes & dívidas) · Carteiras.

### 2.4 Ajustes (engrenagem) + Guia
- `/settings` com tudo de config + backup + export + dashboard config + lock + tema + idioma + modo + persistência + sync + sobre/diagnóstico.
- **NOVO — Guia "Tudo que dá pra fazer":** página que lista cada função (o que faz · como faz · atalho pra ir lá). Combate o "função escondida": o usuário descobre tudo que o app entrega. Entrada em Ajustes + destaque sutil no 1º uso.

---

## 3. Check-in como LENTE com efeito real (ponto crítico do Julio)

Hoje o check-in "não muda nada" → confunde. Novo: o modo é uma **lente** que muda
visivelmente o enquadramento do dia (sem corromper o orçamento — é camada de
exibição/projeção, dados não são alterados).

- **Micro-explicação:** "Diz como vai ser seu dia que eu te mostro quanto dá pra gastar — e ajusto o ritmo."
- **Sair à noite:** "À noite você tem **€49 livres** + **€X** reservados de bar/restaurante que cabem hoje." (soma livre + reservas de ocasião)
- **Passeio:** "Hoje: **€49 livres** + **€X** de passeios planejados."
- **Tranquilo (economizar):** reduz o sugerido de hoje e mostra **"guardando ~€X de hoje → seus próximos dias ganham +€Y/dia."**
- **Sem gastos:** "Hoje **€0**. Os €49 de hoje vão pros próximos dias → **+€Y/dia.**" (efeito mais forte e claro)

Risco: MÉDIO (não pode duplicar contagem). É projeção/realce, reversível, nunca grava gasto.

---

## 4. Amigo sincero reconciliado (mantém cálculo por categoria)

Decisão do Julio: manter o cálculo por categoria, mas **explicar o porquê** e dar a saída.
Mensagem-modelo (caso "over_pace" com folga na fase):

> "Você curtiu mais bares do que tinha planejado — por isso, no limite que você deu pra **bares**, cabem só **+3** dos 4 que faltam. Mas a fase tem **€900 livres**: o 4º cabe se quiser, sem culpa. Se for manter o plano de bares, segura 1."

- Sem folga na fase: "...cabem +3; o 4º começa a usar sua reserva em [data]."
- Aparece como **manchete no Início** (curta) e **completa no Copiloto**.
- Sem barrinha colorida à esquerda.

---

## 5. Resoluções do Conselho (pontos em dúvida)

- **Filtro × "Fases da viagem" (Viagem):** Conselho → eliminar redundância. Seletor de fase único; lista de fases só em "Todas"; fase específica filtra a página. Confiança ALTA.
- **Fundos vs Carteiras:** Conselho → consistência por *natureza do dado*: Fundos têm saldo vivo (seção); Carteiras são cadastro (tile). + explicar "fundo". Confiança MÉDIA-ALTA.
- **Gastos recentes na home:** Conselho (Defensor vs Simplificador) → manter **peek pequeno** (continuidade) e lista completa em Gastos; configurável (pode ocultar). Confiança MÉDIA.
- **Ocasiões na home:** manter card (amado) + ritmo no Copiloto + config em Perfis. Confiança ALTA.
- **Planejamento "escondido":** preview inline resolve a maior parte; resto é hábito. Confiança MÉDIA.
- **Mapa do mês / maior dia / média:** Copiloto (agrupados, tema "dias"). Confiança ALTA.
- **Nome "Copiloto" vs "Análise":** Copiloto (marca) + ícone `insights` + subtítulo. Confiança MÉDIA.
- **Guia de funções:** adicionar (combate função escondida). Confiança ALTA.

---

## 6. Regras de design (aplicar em todo redesign)
1. **Sem barrinha colorida vertical** à esquerda de cards.
2. Toda informação que existe hoje continua acessível (anti-regressão §0.4).
3. Números importantes são **tocáveis → breakdown "de onde vem"**.
4. Microcopy explica o "porquê" de cada interação (check-in, sinais de ritmo).
5. Hierarquia por peso/cor de texto e espaçamento, não por enfeite.

---

## 7. Plano de implementação (gates, sem parar; commits + deploys)
- **G1 — Navegação & Ajustes:** remove "Mais"; barra `Início·Gastos·+·Viagem·Copiloto`; engrenagem→Ajustes no header; rotas/`visibleInMode`. Deploy.
- **G2 — Viagem (hub + cross-phase):** seletor de fase, preview de planejamento, compras planejadas, fundos+explicação, estrutura. Passo 1 e 2. Deploy.
- **G3 — Copiloto:** tela narrativa + consolida simulador/insights/projeção/impacto/resgate/mapa do mês/ritmo. Deploy.
- **G4 — Início v2:** header (gear), hero clareza + breakdown, sinais com significado, sem barrinha, cards preservados, analytics→Copiloto. Deploy.
- **G5 — Check-in lente:** efeito real + microcopy + "sem gastos". Deploy.
- **G6 — Amigo sincero reconciliado** (Início + Copiloto). Deploy.
- **G7 — Guia "tudo que dá pra fazer".** Deploy.
- Cada gate: testes verdes + build + commit + deploy; dev-log atualizado.

> Próximo passo imediato: novo wireframe refletindo este plano, pra aprovação do Julio antes do G1.
