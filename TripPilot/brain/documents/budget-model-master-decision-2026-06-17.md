# Modelo de Orçamento — DOCUMENTO MESTRE (decisões consolidadas)

> Data: 2026-06-17
> Status: **DECIDIDO / PRONTO PARA IMPLEMENTAR** (aguarda apenas o "pode mandar" do Julio)
> Este é o documento de **verdade consolidada** da reforma do modelo de orçamento do TripPilot.
> Consolida e finaliza o que foi estudado em:
> - `budget-mental-model-study-2026-06-17.md` (Parte I — diagnóstico + modelo Trecho/Pote)
> - `budget-mental-model-study-part2-2026-06-17.md` (Parte II — potes, carteira, fases sobrepostas, onboarding)
> - + a rodada de conselho sobre **Eventos** desta sessão
> Implementação detalhada em: `budget-model-implementation-prompt-2026-06-17.md`

---

## 0. Empacotamento de release (decisão do Julio, 2026-06-17)

Esta reforma é o **Pacote de Implementação #1** — uma entrega **fechada e autocontida** (modelo Trecho/Pote/Evento/Compra planejada + carteira progressiva + dashboard da fase ativa + visão avançada + sub-trecho V2 no radar).

- **Tudo decidido aqui pertence ao Pacote #1.** Quando o Julio mandar implementar, é ISTO que será implantado (pelos 6 gates do prompt).
- **O que for estudado DAQUI PRA FRENTE NÃO entra no Pacote #1** — vira **Pacotes #2, #3…** separados, implantados depois. Ex.: a reorganização do **menu FAB** e a **auditoria de clareza de UX** (`ux-clarity-audit-2026-06-17.md`) são pacotes futuros, não fazem parte desta entrega.
- Objetivo: cada pacote é uma aplicação coesa, testável e deployável por si só, sem inchar o escopo de outro.

---

## 1. Por que esta reforma existe (resumo de 5 linhas)

O criador do TripPilot tentou modelar uma viagem real e **se confundiu sobre onde colocar cada valor**. A investigação revelou a causa raiz: o app **nunca decidiu o que ele é** — convivem dois modelos opostos de dinheiro ("pote compartilhado + reservas" da era DEC-007/153 vs "1 fundo por fase" da era DEC-089), o dashboard lê o fundo errado (`linkedPools[0]`), e ~10 conceitos vazam para o usuário (fundo, pool, link, envelope, future floor, carteira, ocorrência, compra planejada…). Esta reforma **define um modelo mental único, simples e canônico**, mantendo todo o poder no backend.

---

## 2. A viagem canônica (referência)

| Bloco | Período | Dinheiro | Natureza |
|---|---|---|---|
| **Burgos** | 06/06 → 15/07 | 628 € | Trecho (estadia) |
| **Eurotrip** | 16/07 → 04/08 | 678 € | Trecho (várias cidades) |
| **Volta** | 05/08 → 16/08 | 131 € | Trecho (estadia final) |
| **Tomorrowland** | 23–26/07 | +200 € (à parte) | **Evento com Pote próprio**, gasto ao longo do tempo (50 € já gastos em junho) |

Total da viagem = **1.437 €** (soma dos trechos) **+ 200 €** em potes à parte.

---

## 3. O MODELO CANÔNICO (o que o usuário vê)

> **Regra de ouro:** o usuário enxerga conceitos do mundo real ("trecho da viagem", "dinheiro à parte", "algo que vou fazer"). O vocabulário técnico (fundo/pool/link/envelope/ocorrência) **nunca** aparece no caminho feliz — só na "Visão avançada" das Configurações.

### 3.1 Os 4 conceitos visíveis

| Conceito | O que é (na cabeça do usuário) | Mapeia para (backend, escondido) |
|---|---|---|
| **Trecho** | Um pedaço da viagem: **datas + um orçamento** | `Phase` + `BudgetPool(linked_phases)` dedicado + `BudgetPoolPhaseLink` (1:1) |
| **Pote** | **Dinheiro à parte** com uma finalidade (festival, compras), gasto a qualquer momento | `BudgetPool(scope: 'global')` (+ data opcional) |
| **Evento** | **Algo que acontece numa data** (passeio, festa, show) | `PlannedOccurrence(kind: 'event')` |
| **Compra planejada** | **Algo que vou comprar** "uma hora dessas" (roupas, presentes) | `PlannedPurchase` |

### 3.2 O mapa que dissolve a confusão Evento × Pote (as 2 perguntas)

Todo "planejamento de gasto futuro" responde a **2 perguntas**, e isso define qual conceito é:

| | **Dinheiro vem do TRECHO** (reserva, subtrai do dia a dia) | **Dinheiro é À PARTE** (Pote, adicional) |
|---|---|---|
| **TEM data** (acontece) | **Evento** — ex.: passeio a Valladolid €35 (sai dos 678 da Eurotrip) | **Evento com Pote** — ex.: **Tomorrowland** €200 à parte |
| **SEM data** (intenção) | **Compra planejada** — ex.: roupas €100 (sai do trecho) | **Pote** — ex.: compras pessoais (dinheiro à parte) |

**Isto responde, de uma vez, todas as dúvidas do Julio sobre Eventos:**
- *"Por que Tomorrowland é Pote e não Evento?"* → **É os dois**: um **Evento** (acontece 23–26/07) cujo **dinheiro é um Pote** (€200 à parte). O usuário cria **uma coisa só** e escolhe a fonte do dinheiro.
- *"Um evento pode usar o fundo?"* → **Sim — é o padrão.** Ao criar um Evento, o usuário escolhe **a fonte do dinheiro** (3 opções, decisão do Julio):
  1. **Comer da fase** em que o evento acontece (reserva do trecho — padrão);
  2. **Criar um Pote novo** específico pra esse evento (ex.: Tomorrowland €200) → nasce um Pote ligado ao evento;
  3. **Usar um Pote já existente** (escolhe da lista).
- *"Evento está duplicado / é necessário?"* → No backend as tabelas continuam separadas (cada uma tem um papel), **mas na UX a criação vira UMA porta** ("planejar um gasto futuro") que roteia pelas 2 perguntas. Não há duplicação na cabeça do usuário.
- *"Evento está muito escondido."* → **Correto e será corrigido.** Hoje Eventos só existem dentro da edição de fase. Passa a ser **ação de primeira classe** (FAB "Planejar" + seção no hub da Viagem).

### 3.3 A "porta única" de planejamento (UX)
Em vez de o usuário escolher entre "Evento / Pote / Compra" (jargão), a criação é **um fluxo guiado**:

> **"Planejar um gasto"** →
> 1. *"Acontece numa data específica?"* (Sim → Evento · Não → Compra/Pote)
> 2. *"De onde vem o dinheiro?"* — **3 opções**:
>    - **Do dia a dia** (reserva do trecho onde acontece);
>    - **Um valor à parte só pra isso** → cria um **Pote novo** ligado ao evento;
>    - **Um Pote que já existe** → escolhe da lista.
> + **chips de exemplo** (ver §10.4) que pré-preenchem nome/categoria.

O app cria a entidade certa por baixo. O usuário nunca precisa saber o nome técnico.

---

## 4. DECISÕES CONFIRMADAS (a verdade desta sessão)

> Estas substituem/atualizam decisões antigas conflitantes. Quando o Julio autorizar a implementação, vão para o `decision-log.md` como DEC-2xx (propostas no §9).

| # | Decisão | Escolha do Julio | Confiança conselho |
|---|---|---|---|
| **D1** | **Modelo canônico = Trecho + Pote + Evento + Compra planejada** (4 conceitos), backend intacto | Aprovado (direção) | ALTA |
| **D2** | **Vocabulário**: "Trecho" e "Pote" | **Confirmado** | ALTA |
| **D3** | **Dashboard segue a FASE ATIVA** (corrige `linkedPools[0]`) | Implícito em D1 | ALTA |
| **D4** | **1 trecho = 1 orçamento dedicado** (Phase+Pool+Link automáticos); compartilhar entre trechos = modo avançado | Aprovado (direção) | ALTA |
| **D5** | **Trecho estourado → sugerir remanejar de outro trecho com 1 toque** (nunca bloquear, DEC-053) | **Confirmado** | ALTA |
| **D6** | **Tomorrowland = Evento com Pote** (não 4ª/5ª fase). Ao criar Evento, **3 opções de funding**: comer da fase · criar Pote novo · usar Pote existente | **Confirmado** | ALTA |
| **D7** | **Pote = 1 conceito, com data opcional e meta opcional** | Confirmado | ALTA |
| **D8** | **Visibilidade de Pote/Evento na Home**: sobe quando (entra no trecho dono) **OU** dentro da janela **D-7** da data; nunca aparece em trecho que não é dono; sempre acessível na aba dedicada | **Confirmado** (entrar na fase faz sentido + 7 dias ok) | ALTA |
| **D9** | **Aba/seção dedicada "Potes e planejados"** lista tudo sempre | **Confirmado** (criar; local: ver §6) | ALTA |
| **D10** | **Carteira progressiva**: invisível com 1 fonte; **acende automaticamente** com 2+ carteiras ou import Wise (com aviso) **E** tem toggle manual em Configurações | **Confirmado (opção C)** | ALTA |
| **D11** | **Carteira acesa vale para TODOS os gastos** ("sem carteira" cobrável, DEC-051) | Confirmado | ALTA |
| **D12** | **Fases sempre sequenciais** — validar e **impedir sobreposição** na criação | Confirmado | ALTA |
| **D13** | **Dia de fronteira pertence ao trecho que COMEÇA** (Eurotrip leva 15/07), sempre editável | **Confirmado (opção A)** | ALTA |
| **D14** | **Total da viagem = soma dos trechos** (+ potes à parte, somados separadamente), sempre visível; estouro avisa/sugere, nunca bloqueia | **Confirmado (opção A)** | ALTA |
| **D15** | **Criação de Pote/Evento com exemplo guiado** (chips) + microcopy do "porquê" | Confirmado | ALTA |
| **D16** | **Anti-regressão**: simplificar só o vocabulário confuso; **preservar** ritmo/pico/eventos/atividades como passos **opcionais e progressivos** | Confirmado | ALTA |
| **D17** | **"Visão avançada da viagem"** em Configurações expõe fundos/vínculos/envelopes/carteiras | Confirmado | ALTA |
| **D18** | **Sub-trecho aninhado** = **V2 no radar** (ver §5) | **Confirmado (radar)** | — |
| **D19** | **Reconciliar DEC-007 / DEC-089 / DEC-153** numa nova decisão canônica | Confirmado | ALTA |

---

## 5. Sub-trecho aninhado (V2 — no radar, documentado a pedido do Julio)

> Julio: *"na minha eurotrip vou passar por várias cidades e cada uma poderia ser um sub-trecho com suas próprias coisas, mas não sei como fazer."*

### 5.1 O problema real
Um **Trecho** (Eurotrip) cobre várias **cidades** (ex.: Bruxelas, Amsterdã, Paris). O usuário quer, **dentro** do trecho, acompanhar cada cidade com possivelmente: seu **gasto**, seu **ritmo**, seus **eventos** — sem que cada cidade vire um Trecho de primeiro nível (o que fragmentaria o orçamento e o dashboard).

### 5.2 Já existe a semente no backend
O `PlannedOccurrence` já tem **`kind: 'sub_destination'`** (DEC-072), descrito como *"eurotrip city"*, com `plannedDate`/`endDate` (intervalo) e rastreio de gasto-no-período. **A primitiva existe** — falta o enquadramento de produto e a UX.

### 5.3 Direção proposta para V2 (NÃO implementar agora)
- Um **Sub-trecho** é um **período DENTRO de um trecho** (datas contidas no trecho-pai), com **nome de cidade** e, opcionalmente, **ritmo/pico/atividades próprios**.
- **Dinheiro:** por padrão **NÃO** tem orçamento próprio — ele **gasta do trecho-pai** e apenas **rastreia "quanto gastei nesta cidade"** (como o `sub_destination` já faz). Opcionalmente (avançado), pode ter uma **fatia reservada** do trecho-pai.
- **Não sobrepõe** o eixo "quando" do trecho-pai (é aninhado, não paralelo) — coerente com a decisão D12 (sem fases sobrepostas).
- **Dashboard:** ao entrar na cidade (por data), o hero pode mostrar "Eurotrip · Amsterdã — dia 2 de 4" sem trocar o orçamento (que é do trecho-pai).
- **Por que V2 e não agora:** entrega valor real mas adiciona uma camada (aninhamento) que só compensa depois que o modelo Trecho+Pote+Evento estiver assentado. Risco de reintroduzir complexidade se feito cedo demais.

### 5.4 Gatilho para promover a V1.x
Quando houver demanda concreta (ex.: o próprio Julio rodando a Eurotrip e sentindo falta), reabrir com um mini-estudo de UX do aninhamento.

---

## 6. Onde fica a aba "Potes e planejados" (resolução do conselho)

**Contexto de navegação (atualizado):** a barra inferior hoje é **Início · Gastos · Viagem · Copiloto** (`nav-tabs.ts`). O antigo menu **"Mais" foi removido** — o **Copiloto ocupou** esse lugar. Portanto **não há** menu "Mais" para hospedar atalhos.

**Recomendação:** **NÃO** criar uma aba nova na barra inferior (slots são escassos e já ocupados). Em vez disso:
- **Casa canônica = seção "Potes e planejados" dentro do hub da Viagem** (`/viagem`, `TripHubPage`), logo abaixo da lista de Trechos — é o "mapa da viagem inteira", lugar natural para ver todos os potes/eventos/compras.
- **Criação pelo FAB central** ("Planejar um gasto" — a porta única do §3.3).
- **Na Home:** só os **relevantes agora** (regra D8), como cards discretos; o resto vive na seção da Viagem.
- **Copiloto** pode **referenciar/levar** a um pote relevante (deep-link), mas **não** é a casa da lista — só sugere.

**Confiança: ALTA** (respeita a nav atual sem o "Mais", agrupa a família "dinheiro futuro" num lugar só, e mantém a Home limpa).

---

## 7. Como a Europa 2026 fica (modelo final, ponta a ponta)

1. **Onboarding (1 pergunta):** "Europa 2026, 06/06–16/08, € total". Cria a viagem usável na hora.
2. **Dividir em trechos** (opcional, guiado): Burgos 628 (06/06–15/07) · Eurotrip 678 (16/07–04/08) · Volta 131 (05/08–16/08). O 15/07 vai pra **Eurotrip** (trecho que começa). Total exibido: **1.437 €**.
3. **Planejar Tomorrowland** (porta única): "acontece numa data?" → sim (23–26/07); "dinheiro do dia a dia ou à parte?" → **à parte, €200** → cria **Evento com Pote**. Fica na seção "Potes e planejados".
4. **Gasto antecipado (junho):** registra 50 € escolhendo o **Pote Tomorrowland** (acessível mesmo em Burgos pela seção). Pote vai a 150 €; **Burgos intacto**; aparece no extrato.
5. **Home em junho/Burgos:** mostra "Livre hoje" do **trecho Burgos**; Tomorrowland **não** polui (fica na seção). ~16/07, ao entrar na **Eurotrip**, o Tomorrowland **sobe pra Home** ("começa em 7 dias").
6. **Carteira:** se o Julio cadastrar Wise+Revolut+dinheiro (ou importar Wise), o gasto passa a perguntar "de onde saiu?"; senão, invisível.
7. **Ritmo/pico/eventos** continuam disponíveis por trecho, como passos opcionais (sem regressão).
8. **Configurações → Visão avançada:** quem quiser vê fundos/vínculos/envelopes/carteiras crus.

---

## 8. Princípio anti-regressão (registrar como regra permanente)

> **Simplificar o que CONFUNDE (vocabulário fundo/pool/link/carteira/ocorrência), preservar o que AGREGA e é compreensível (ritmo de fase, dias de pico, eventos, atividades, multimoeda, import Wise, saídas).** A simplificação é de **arquitetura de informação e nomenclatura**, nunca de **capacidade**. Tudo que existe hoje continua possível — só deixa de ser obrigatório/visível no caminho feliz.

---

## 9. Decisões propostas para o decision-log (registrar quando autorizado)

> NÃO gravadas ainda — o brain manda que só vá pro `decision-log.md` o que foi de fato aprovado para execução. Quando o Julio disser "pode implementar", registrar:

- **DEC-2xx — Modelo canônico Trecho/Pote/Evento/Compra planejada.** Reconcilia e supera a ambiguidade DEC-007 (pool compartilhado) × DEC-089 (1 fundo por fase) × DEC-153 (shared-pool). Define: 1 trecho = 1 pool dedicado; dashboard segue a fase ativa; vocabulário "Trecho/Pote"; backend mantido e exposto só em "Visão avançada".
- **DEC-2xx — Pote unificado** (global pool com data/meta opcionais) + regra de visibilidade D8 + seção "Potes e planejados".
- **DEC-2xx — Evento com funding** (reserva do trecho por padrão, ou Pote próprio) + porta única de planejamento + Evento como ação de primeira classe.
- **DEC-2xx — Carteira progressiva** (auto-acende com 2+ carteiras ou import Wise + toggle manual).
- **DEC-2xx — Fases sequenciais** (validação anti-sobreposição + dia de fronteira pertence ao trecho que começa).
- **DEC-2xx — Total da viagem = soma dos trechos** (+ potes à parte) com avisos de estouro.
- **DEC-2xx — Sub-trecho aninhado = V2** (no radar; sub_destination é a semente).

---

## 10. Micro-decisões — RESOLVIDAS (2026-06-17)

### 10.1 Janela de visibilidade
**V1: D-7 fixo.** Tornar **configurável depois**, em Configurações (ex.: 7/5/3 dias). Não bloqueia o V1.

### 10.2 "Travar um teto" da viagem (opção B do total)
**Fica para depois**, mas **documentado como recurso avançado planejado**: além do total = soma dos trechos (D14), o usuário poderá, em "Visão avançada", **travar um teto declarado** da viagem; quando a soma dos trechos passar do teto, o app **avisa** (nunca bloqueia). **NÃO entra nos 6 gates** — é backlog pós-reforma.

### 10.3 Sub-trecho aninhado
V2, no radar (§5).

### 10.4 Chips de exemplo (escolha do conselho) — referência de i18n
> Critério do conselho: poucos, concretos, cobrindo os casos mais comuns de viagem; nome curto que vira o nome do item; mesma ordem nos 3 idiomas.

**Evento (algo que acontece numa data):**
| pt-BR | en | es |
|---|---|---|
| Festival / Show | Festival / Show | Festival / Concierto |
| Passeio / Tour | Day trip / Tour | Excursión / Tour |
| Restaurante especial | Special dinner | Cena especial |
| Ingresso / Atração | Ticket / Attraction | Entrada / Atracción |

**Pote (dinheiro à parte) / Compra planejada:**
| pt-BR | en | es |
|---|---|---|
| Compras / Roupas | Shopping / Clothes | Compras / Ropa |
| Presentes / Lembranças | Gifts / Souvenirs | Regalos / Recuerdos |
| Emergência / Reserva | Emergency / Buffer | Emergencia / Reserva |
| Transporte extra | Extra transport | Transporte extra |

---

## 11. Documentos relacionados
- Diagnóstico e modelo: `budget-mental-model-study-2026-06-17.md`
- Aprofundamento (potes/carteira/fases/onboarding): `budget-mental-model-study-part2-2026-06-17.md`
- **Plano de implementação (fases/gates/testes/deploys):** `budget-model-implementation-prompt-2026-06-17.md`
