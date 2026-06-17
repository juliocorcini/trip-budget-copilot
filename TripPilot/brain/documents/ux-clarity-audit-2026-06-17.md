# Auditoria de Clareza de UX — Todas as Áreas

> Data: 2026-06-17
> Status: **DIAGNÓSTICO** (não é decisão de implementação — alimenta os Pacotes #2, #3…)
> Escopo: revisar **cada área** do app e responder, por área: o usuário entende o que é, onde está, como usar? O que dá pra deixar **mais claro e mais direto** (não necessariamente "mais simples")?
> Gatilho: pedido do Julio após a reforma de orçamento — começando pelo **menu FAB** (muito cheio) e seguindo por todas as áreas.
> Companheiro do `budget-model-master-decision-2026-06-17.md` (aquele = Pacote #1, finanças/carteira/eventos). **Este documento NÃO altera o Pacote #1.**

---

## 0. Empacotamento (a pedido do Julio)

- **Pacote #1 = reforma do modelo de orçamento** (Trecho/Pote/Evento/Compra planejada + carteira progressiva + dashboard da fase ativa). **Fechado.** Verdade em `budget-model-master-decision-2026-06-17.md`; implantação em `budget-model-implementation-prompt-2026-06-17.md`.
- **Tudo que sai desta auditoria entra em pacotes SEPARADOS** (#2, #3…), implantados depois, na ordem que o Julio escolher. Nada aqui se mistura ao Pacote #1.
- Cada bloco de melhoria abaixo recebe uma **prioridade (P0–P3)** que vira a matéria-prima dos próximos pacotes.

---

## 1. Método

**Lente de conselho (inline, sem subagentes)** aplicada a cada área, com 5 vozes:
- **Simplificador** — o que dá pra remover/agrupar sem perder capacidade.
- **Arquiteto de IA** — cada coisa está no lugar certo da navegação?
- **Crítico (ergonomia)** — alcance do polegar, fricção, leitura.
- **Advogado (preservar)** — o que é bom e NÃO pode quebrar (anti-regressão).
- **Usuário de primeira viagem** — abro a tela e entendo?

**Nota de clareza:** 1 (confuso) a 5 (cristalino). **Confiança:** ALTA (li o código nesta sessão) · MÉDIA (conheço de logs/rotas) · BAIXA (inferência, precisa de passada dedicada).

**Princípio anti-regressão (mesmo do Pacote #1):** simplificar o que **confunde**, preservar o que **agrega**. O app é MUITO rico em recursos — o risco dominante é **sobrecarga conceitual e descoberta**, não falta de função.

---

## 2. Achados transversais (valem para o app inteiro)

| # | Tema | Sintoma | Direção |
|---|---|---|---|
| **G1** | **Sobrecarga conceitual** | ~10 conceitos (fundo, pool, envelope, ocorrência, perfil, carteira, compra planejada…) vazam na UI | Estender o vocabulário do Pacote #1 (Trecho/Pote) a todo o app; esconder jargão atrás de "Visão avançada" |
| **G2** | **Fricção na captura** | "Registrar gasto" (ação #1) é um formulário longo (valor, categoria, descrição, data, local, fundo, carteira, quem pagou, anexos) | Disclosure progressivo: campos avançados recolhidos por padrão |
| **G3** | **"Parede de cards"** | Copiloto ≈ 18 seções num scroll; Home pode empilhar muitos avisos | Priorizar/agrupar; mostrar o essencial, "ver mais" para o resto |
| **G4** | **FAB sobrecarregado** | 9 ações; as mais importantes longe do polegar (ver §3) | **Reordenar p/ polegar + expanders**, mantendo as 9 ações e o design (decisão do Julio) |
| **G5** | **Descoberta × pressão de navegação** | "Mais" saiu; recursos migraram p/ Viagem/Copiloto/engrenagem; o "Guia" compensa | Manter o "Guia" como rede de descoberta; clarear as entradas de planejamento (porta única do Pacote #1) |
| **G6** | **Modo simples/completo é subutilizado** | já existe um ótimo botão de progressive disclosure | Usar o modo como alavanca em mais áreas (ex.: campos do QuickAdd, Planner) |
| **G7** | **Duas superfícies de "viagem"** | `/viagem` (Hub) **e** `/trip` (Overview) + `/trip/edit` + `/funds` + `/planner` + `/phase-preview` se sobrepõem | Consolidar/clarear: 1 mapa, 1 editor (casa parcial com Pacote #1) |
| **G8** | **Planejamento é uma teia** | Planner + Simulador + SOS + Compras planejadas + Eventos, cada um com vocabulário próprio (cenários, ocasiões, alocação, margem, reserva) | Porta única de planejamento (Pacote #1) + microcopy de conceito |
| **G9** | **Divisão repetida em 4 telas** | "Quem pagou / dividir" aparece em QuickAdd, Recibo, Compartilhar e Import Wise, com variações | Um explicador único + microcopy consistente entre as 4 |

---

## 3. ÁREA PRIORITÁRIA — Menu FAB (botão "+")

### 3.1 Como está hoje (`FAB.tsx`, `BottomNav.tsx`)
Folha ancorada embaixo, conteúdo flui de cima pra baixo. Em **modo completo**:
1. **Hero (full-width, laranja):** Registrar gasto → `/quick-add`
2. **Destaque (full-width, índigo "smart"):** Escanear nota → `/receipt/scan`
3. **Grade 2-col (7 itens):** Iniciar saída*, Simular compra*, Registrar mercado, Planejar compra, Transferência, Saque, Receita*
   (* = `advanced`, somem no modo simples)

### 3.2 O problema (confirmado no código)
- **9 ações** = é um menu, não um atalho rápido.
- **Ergonomia invertida:** a folha cresce pra cima e o conteúdo começa no topo → o **hero "Registrar gasto" fica no TOPO, longe do polegar**; saque/receita (raros) ficam embaixo, perto do dedo. Exatamente o que o Julio sentiu ("longe pra ir com o dedo até registrar gasto").
- **Mistura de naturezas:** captura (gasto, nota, mercado, saída) + operações raras (transferência, saque, receita) + **planejamento** (simular, planejar compra) no mesmo lugar.

### 3.3 Conselho v2 — manter ou tirar? (re-rodado a pedido do Julio)

Julio **discordou de remover** Simular e Planejar do FAB ("são importantes; Planejar quase certeza que fica ali; talvez esconder atrás de ícones que expandem") e escolheu **manter as 9 ações, só reorganizar**. O conselho reconsiderou:

- **Proponente (manter):** o FAB é o caminho mais rápido; remover uma capacidade dele é perda real de velocidade. A identidade do app é poder + captura. **Manter as 9.**
- **Crítico:** o problema nunca foi "capacidade demais" — foi **apresentação plana + ordem ruim pro polegar**. Agrupar + reordenar resolve sem remover nada.
- **Simplificador (concede):** **expanders** entregam a simplicidade (menos coisa visível em repouso) SEM remover — o melhor dos dois mundos.
- **Arquiteto:** Simular também viver no Copiloto é ok (múltiplas entradas pra mesma ferramenta; o FAB é a "rápida"). **Manter.**
- **Veredito:** **manter as 9, reorganizar — não podar.**

**Estrutura decidida (nada removido):**
| Bloco | Ações | Apresentação |
|---|---|---|
| **Heróis (zona do polegar)** | Registrar gasto, Escanear nota | sempre visíveis, na **base** da folha (perto do "+") |
| **Captura** | Iniciar saída, Registrar mercado | chips visíveis |
| **Planejar** | Planejar compra, Simular compra | visíveis, ou atrás de um ícone **"Planejar"** que expande (ideia do Julio) |
| **Outros registros** (raros) | Transferência, Saque, Receita | atrás do expander **"Outros registros…"** |

### 3.4 Recomendação (P0 — pedido explícito)
1. **Manter a linguagem visual** (hero, card "smart", grade tonal, mola) **e manter as 9 ações**. Não mexer no estilo.
2. **Reordenar pela ergonomia do polegar** (escolha do Julio: "só reordenar"): heróis na **base** da folha (perto do "+"); itens menores acima.
3. **Agrupar com expanders** (ideia do Julio "esconder atrás de ícones que expandem"): **"Outros registros…"** recolhe Transferência/Saque/Receita; opcionalmente um **"Planejar"** recolhe Planejar+Simular. Em repouso a folha mostra poucos itens; expande sob demanda.
4. **Planejar compra continua no FAB** (decisão do Julio). Quando o Pacote #1 entrar, "Planejar compra" passa a abrir a **porta única de planejamento**.
5. **Modo simples** continua escondendo os avançados.

**Resultado:** folha curta em repouso (heróis + captura), tudo a 1 toque via expanders, ordem certa pro polegar, **nada removido**, design preservado. **Confiança: ALTA.**

---

## 4. Auditoria área por área (análise profunda, código lido nesta sessão)

> Cada área traz: **Função** · **Fluxo real** (o que o código faz) · **Claro** · **Confunde** (com evidência) · **Melhorias** (com prioridade) · **Nota** · **Confiança**.
> Todas as áreas abaixo estão em **ALTA** (li o componente nesta sessão), salvo onde indicado.

---

### BLOCO A — Entrada e captura

#### 4.1 Onboarding — `OnboardingPage` · Nota 4/5 · ALTA
- **Função:** criar a 1ª viagem e calibrar o app (moeda, modo, reserva).
- **Fluxo real:** caminho **rápido** (valor + "até quando" + nome + moeda → cria na hora) ou **detalhado** (5 passos progressivos); a 1ª tela do rápido oferece template + tipo de viagem + "personalizar"; criação é **atômica** (rollback se falhar); termina escolhendo **modo simples × completo**.
- **Claro:** o caminho rápido é genuinamente rápido; criação atômica evita estado quebrado; progressivo.
- **Confunde:** a **escolha de modo no fim** é uma bifurcação que o novato não tem base para responder; **"reserva protegida"** é jargão sem exemplo; a 1ª tela do rápido mistura 3 decisões (template, tipo, personalizar).
- **Melhorias:** (P2) auto-recomendar modo + "dá pra mudar depois"; (P3) rotular "reserva protegida" com exemplo monetário; (P3) colapsar template/tipo sob "Mais opções".

#### 4.2 Home / Dashboard — `DashboardPage` (+ `DashboardConfigPage`) · Nota 4.5/5 · ALTA
- **Função:** responder "quanto posso gastar hoje?" e dar acesso ao essencial.
- **Fluxo real:** `SimpleHome` (modo simples) × cards configuráveis (modo completo); `DashboardConfigPage` permite **reordenar (↑/↓), esconder (olho), fixar contextuais, parear em grade 2-up**; âncoras (saída ativa / hero) ficam **travadas**; cabeçalho com dia/fase, sino e engrenagem.
- **Claro:** progressivo de verdade; "esconder card" é reversível (não deleta dado); resultados confirmados por toast; config de home é poderosa e auto-explicada.
- **Confunde:** vários **avisos contextuais podem empilhar** (storage, sobra de fase, sugestão de valor, priors); o hero "Livre hoje" hoje lê `linkedPools[0]` → **corrigido no Pacote #1 GATE 1**.
- **Melhorias:** (P2) teto/ordem de no máx. N avisos por vez; (P3) "por que esse card apareceu?" nos contextuais. **A área mais saudável do app.**

#### 4.3 Registrar gasto — `QuickAddPage` · Nota 3/5 · ALTA
- **Função:** a ação #1 — lançar um gasto.
- **Fluxo real:** valor (com calculadora inline + âncora "≈ R$" multimoeda) + categoria (grade 9) + descrição (com sugestão e voz) + data + local (sticky) + **fundo** + **carteira** + [quem pagou/split] + anexos; preview "depois disso sobra X"; repetir frequentes.
- **Claro:** muita inteligência real (sugestões, voz, cálculo, preview de saldo, frequentes).
- **Confunde:** é **longo demais para a ação #1**. Para um gasto trivial o usuário ainda vê **fundo** (mesmo com auto-seleção quando só há 1) e **carteira sempre** (→ **Pacote #1 GATE 5** torna progressivo). São ~8 decisões para "café €3".
- **Melhorias:** (P1) **disclosure progressivo** — visível: valor + categoria + (descrição); sob "Detalhes": data/local/fundo/carteira/anexos; (P1) esconder fundo quando só há 1; (P2) carteira progressiva (Pacote #1). **Meta: gasto típico em 3 toques.**

#### 4.4 Lista de Gastos — `ExpenseListPage` · Nota 3.5/5 · ALTA
- **Função:** ver e gerenciar o histórico.
- **Fluxo real:** 2 abas segmentadas (**Gastos × Saídas**); **swipe** pagina entre abas e, **na borda, entrega para a aba vizinha do app** (gesto inteligente, mas é um modelo escondido); busca + **chips de filtro** (categorias + locais ranqueados por gasto + perfil + "sem carteira"); agrupamento por dia com subtotal; **rollup** de recibo/saída em 1 linha com selo de IA; barra de aviso "sem carteira"; **long-press → multi-seleção** + ações em lote (categoria/mover fundo/excluir) com undo; cabeçalho com **escanear** (indigo) + **importar**.
- **Claro:** rollup mantém a lista limpa; lote + undo é poderoso; busca/filtro cobrem muito.
- **Confunde:** **cabeçalho denso** — título+total+scan+import, depois abas, depois busca, depois chips = ~4 faixas antes da lista; os **chips misturam 3 naturezas** (categoria, local, perfil) sem rótulo de grupo; a aba **"Saídas"** e o **swipe-handoff** entre apps são modelos não anunciados.
- **Melhorias:** (P2) agrupar/rotular chips por tipo e permitir recolher; (P2) microcopy do que é "Saída" na aba; (P3) tornar o gesto de borda descobrível (ou opcional).

#### 4.5 Detalhe do gasto — `ExpenseDetailPage` · Nota 4/5 · ALTA
- **Função:** ver/editar um gasto, inclusive divisões.
- **Fluxo real:** hero com valor + âncora + equivalente em moeda estrangeira; linhas (categoria/data/hora/local/**fundo**/**carteira**); se compartilhado, separa **"Fluxo financeiro"** (o que saiu da sua carteira) de **"Custo pessoal"** (sua fatia) + status por participante; notas; anexos; edição inline completa (valor, descrição, categoria 5-col, data, local, fundo em chips, carteira em chips); excluir.
- **Claro:** hierarquia boa; aviso "carteira: não definida" útil; edição no mesmo lugar.
- **Confunde:** os rótulos **"Fluxo financeiro" × "Custo pessoal"** são corretos mas técnicos para quem não pensa em contabilidade.
- **Melhorias:** (P3) microcopy/explicador de 1 linha nesses dois rótulos quando há divisão (casa com G9).

---

### BLOCO B — Inteligência e planejamento

#### 4.6 Copiloto — `CopilotPage` · Nota 3/5 · ALTA
- **Função:** transformar dados em conversa ("estou bem? pra onde vai? o que eu faria?").
- **Fluxo real:** ~18 seções que se auto-censuram sem dado (veredito, recap, projeção, tendência, runway, streak, "amigo", âncora, categorias, mapa, dia-da-semana, hora-pico, ritmo, comparação, eficiência de saída, social, meio de pagamento, dívidas); ferramentas no rodapé (Impacto, Simular, SOS, Guia); ótimo estado vazio.
- **Claro:** narrativa boa; cada bloco isolado é útil; degrada bem sem dados.
- **Confunde:** com dados, vira **parede de ~18 seções num scroll** — o achado G3. O usuário não sabe onde olhar primeiro.
- **Melhorias:** (P1) **priorizar 3–5 seções-chave + "ver mais análises"**; (P2) agrupar por tema (Agora / Para onde vai / Padrões / Pessoas) colapsável; (P3) fixar favoritas.

#### 4.7 Simulador — `SimulatorPage` · Nota 3.5/5 · ALTA
- **Função:** "posso gastar X agora?".
- **Fluxo real:** valor + chips rápidos; **"Onde vai gastar?"** = chips de alvo (perfis + eventos + compras planejadas + "outro"); **veredito** com motivo + cards de fatos; aviso "isso pega de amanhã"; CTAs (registrar / abrir planner); cross-link para SOS.
- **Claro:** explica **cada número** do veredito; reusa a mecânica de reserva; honesto sobre "pegar de amanhã".
- **Confunde:** exige escolher um **alvo (perfil/evento)** — pressupõe que o usuário entende "perfis"; vive no **FAB e no Copiloto** (2 entradas); nome "Simular compra" soa técnico. *(Decisão do Julio: continua no FAB — ver §3; não remover.)*
- **Melhorias:** (P3) alvo "outro/avulso" como padrão para não exigir perfil; (P3) considerar rótulo "Posso gastar?" como sinônimo visível. **Sem remover do FAB.**

#### 4.8 SOS / Rescue — `RescuePage` · Nota 3/5 · ALTA
- **Função:** plano de recuperação quando o ritmo estourou.
- **Fluxo real:** define "guardar €X até o fim da fase" → recalcula **novo teto diário** e **quais ocasiões pular** para chegar lá; é **cálculo ao vivo, não persiste** nada.
- **Claro:** transforma pânico em plano concreto (corta diária ou ocasiões).
- **Confunde:** **descoberta baixa** (só via Simulador/Copiloto/Guia); **quando** usar não é óbvio; opera só sobre **fase**, não sobre Pote; relação com "remanejar trecho" (Pacote #1 D5) pode soar redundante.
- **Melhorias:** (P2) **oferecer SOS contextualmente** quando um trecho fura feio; (P2) alinhar narrativa com "remanejar de outro trecho" (Pacote #1); (P3) deixar claro que é simulação (não muda orçamento).

#### 4.9 Planner — `PlannerPage` · Nota 3/5 · ALTA
- **Função:** desenhar o **cenário de gastos de uma fase** (quantas saídas, refeições, passeios…).
- **Fluxo real:** por fase, **cards de perfil** com stepper de quantidade, **cadeado**, **prioridade** (essencial/planejado/opcional); **presets** (econômico/equilibrado/mais social); **margem livre ao vivo** (fica negativa se estoura) + aviso de super-alocação + **motor de recomendação** ("reduza 2 noites de bar"); folha de detalhamento da margem; lista de **eventos planejados** da fase (informativa, deep-link pro editor); adicionar categoria custom.
- **Claro:** é a ferramenta mais poderosa de planejamento; recomendação automática é excelente; margem ao vivo educa.
- **Confunde:** **muito denso e conceitual** — "cenário", "alocação", "margem livre", "prioridade", "cadeado", presets; **descoberta:** não está nas abas, chega-se via CTA do Simulador/Guia/Hub. É a parte "fundo da piscina" do app.
- **Melhorias:** (P2) tratar Planner como **avançado** (esconder no modo simples por padrão) e dar um modo "guiado" leve; (P2) microcopy dos termos (margem/alocação); (P1, casa com G8) integrar à **porta única de planejamento** do Pacote #1.

#### 4.10 Viagem / Hub — `TripHubPage` · Nota 3/5 · ALTA
- **Função:** o "mapa" da viagem e contexto de fase.
- **Fluxo real:** seletor de fase único (define o contexto do app); resumo + cards por fase; preview de planejamento inline; **compras planejadas**; **fundos**; grade "Estrutura" (6 tiles); usa `pools.find(scope==='linked_phases')` (mesma base do Pacote #1).
- **Claro:** seletor de fase como contexto é forte; é o lar natural de "Potes e planejados" (Pacote #1).
- **Confunde:** **muito densa** (seletor + resumo + fases + planejamento + compras + fundos + estrutura num scroll); expõe jargão **"Fundos"** e **"Perfis"**; **se sobrepõe a `/trip`** (Overview) — achado G7.
- **Melhorias:** (P1, casa com Pacote #1) renomear "Fundos"→Trecho/Pote e abrigar "Potes e planejados"; (P2) recolher seções menos usadas; (P2, G7) **definir o papel de `/viagem` vs `/trip`**.

#### 4.11 Visão da viagem / Editar / Preview de fase — `TripOverviewPage`, `TripEditPage`, `PhasePreviewPage` · Nota 3/5 · ALTA
- **Função:** `/trip` = resumo total + linha do tempo; `/trip/edit` = **editor** da viagem/fases/eventos; `/phase-preview` = projeção "como se fosse o dia 1".
- **Fluxo real:** **Overview** mostra orçamento total (= soma dos pools, alinhado ao Pacote #1) vs gasto, timeline de fases (selos ativa/próxima), fundos com barras, **share card**; toca fase→editor, toca fundo→funds. **Edit** altera nome/datas da viagem, fases (nome/datas/**preset de ritmo**/**dias de pico**), atividades por fase (chips de perfil + presets + custom) e **eventos planejados** (nome/datas/estimado/**reservado**/`kind` **event|sub_destination**) — **é aqui que Eventos nascem**; excluir fase com trava de segurança. **Preview** reusa o mapa de diária por dia + calendário e deixa setar **renda planejada** (só alimenta a projeção).
- **Claro:** Overview é limpo e "total = soma" bate com o Pacote #1; Preview é um diferencial (ver a fase antes de viver).
- **Confunde:** **`/viagem` e `/trip` competem** (G7); o Edit é a **sala de máquinas** e expõe os termos mais técnicos (preset de ritmo, dias de pico, `sub_destination`); "renda planejada só na projeção" é sutil.
- **Melhorias:** (P2, G7) consolidar/clarear Overview×Hub (1 mapa); (P2) suavizar termos do editor; (P3) explicar "renda planejada" no Preview.

---

### BLOCO C — Captura especial

#### 4.12 Modo Saída (Outing) — `OutingPage` · Nota 3.5/5 · ALTA (li ~320/3259 linhas; restante MÉDIA)
- **Função:** companheiro de "rolê" — sair com um teto e registrar rodadas em 1 toque.
- **Fluxo real:** picker de início (perfis habilitados na fase) → pergunta de evento avulso / pré-config de ocorrência → **modo bar fullscreen** com valores rápidos e "repetir última" → **gauge** com zonas (alvo/teto/máximo) e alertas progressivos → **stepper de enriquecimento** pós-lançamento (quem/dividir) → na **fronteira de fase**, diálogo "manter/mover/dividir" → confirmação ao passar do máximo → **notificação rica** que loga sem abrir o app; snapshot de emergência.
- **Claro:** é o recurso mais "TripPilot" que existe; a notificação ao vivo é excelente; gauge comunica risco bem.
- **Confunde:** o **conceito de "saída"** não é óbvio pro novato; é a tela com **mais gates/folhas** do app (enriquecimento, escolha de fase, over-max) — poderoso, porém pesado.
- **Melhorias:** (P2) microcopy de abertura ("Saída = uma noite/rolê com teto; registre rodadas em 1 toque"); (P3) **sugerir iniciar saída** ao detectar vários gastos seguidos de bar/restaurante; (P3) tornar o stepper de enriquecimento pulável.

#### 4.13 Escanear nota — `ReceiptScanPage` · Nota 4/5 · ALTA
- **Função:** foto da nota → itens lançados.
- **Fluxo real:** captura (consentimento de IA na nuvem **1×**) → leitura → **revisão** com reconciliação contra o total lido ("bater total") → **divisão por nota** (quem + quem pagou) + **editor por item** → commit com **undo**; fallback manual.
- **Claro:** muito polido; reconciliação evita erro de soma; undo protege. (Julio: "funcionou 100%".)
- **Confunde:** reaparece o **modelo de divisão** (G9); o consentimento de nuvem pode assustar.
- **Melhorias:** (P3) microcopy do consentimento (o que sai do device); (P3) alinhar UI de divisão com as outras 3 telas (G9).

#### 4.14 Importar (Wise) — `WiseImportPage` · Nota 3.5/5 · ALTA (poder de especialista)
- **Função:** trazer extrato Wise (CSV) para dentro do app.
- **Fluxo real:** parse do CSV → **classificação** (novo/duplicado/transferência/tarifa/crédito) com stats → carteira-alvo → fora de fase → **criar fase inline** → **pontes de reembolso** → classificar transferências com **alocações** (pagar dívida / pessoa pagou um gasto / transferência entre carteiras / meu gasto / receber acerto / ignorar) + checagem de saldo → commit com undo.
- **Claro:** deduplica, adivinha categoria/cidade/fase, tudo editável e reversível; scaffolding com dicas.
- **Confunde:** é a tela **mais complexa do app**; vocabulário de **alocações** e **pontes** é de power-user.
- **Melhorias:** (P3) atalho de import mais visível na Lista de Gastos; (P3) glossário curto inline de "alocação/ponte". **Manter como fluxo avançado.**

---

### BLOCO D — Pessoas e dinheiro

#### 4.15 Compartilhar / Dividir — `shared/*` (+ split em QuickAdd/Recibo) · Nota 3/5 · ALTA
- **Função:** dividir gastos e acertar com gente da viagem.
- **Fluxo real:** participantes com **saldos**; adicionar por nome **ou QR (pareamento)**; extratos espelhados; gastos compartilhados com status por fatia; **dívidas** com sugestão de **simplificação**; folha de **acerto** (parcial); extrato detalhado; **link sem pareamento** (DEC-207, a pessoa vê só a sua fatia); enviar extrato (caixa postal / ao vivo / QR).
- **Claro:** "Quem pagou?" é de primeira classe; o link E2E é um diferencial real; acerto com confirmação do dono.
- **Confunde:** **muitos modos** (parear × link × extrato × acertar × simplificar) e muitas folhas; o modelo mental é o mais pesado do app (junto com Funds).
- **Melhorias:** (P2) **um explicador único** "como funciona a divisão" (G9); (P2) reduzir nº de folhas/decidir um caminho primário (link vs pareamento); (P3) consistência de microcopy com QuickAdd/Recibo/Wise.

#### 4.16 Gestão: Fundos / Carteiras / Compras planejadas / Perfis / Receita — `funds`, `wallets`, `planned`, `profiles`, `income` · Nota 2.5–4/5 · ALTA
- **Funds** (2.5/5 — **a tela mais cheia de jargão**): lista de pools com barra/saldo; expandir → detalhamento (total−gasto=disponível); editar/excluir com **reatribuição**; **pisos futuros** por fase com sugestões em camadas (essencial/recomendado/confortável); **envelopes** (alocação / **reserva protegida**); criar pool (**escopo** linked/global, vínculos de fase, reservas). → **Alvo central do Pacote #1** (renomear Fundo→Trecho/Pote, esconder "envelope/escopo/piso" atrás de "Visão avançada").
- **Wallets** (4/5): total (só se tudo na moeda base) + saldo animado por carteira; definir padrão; **reconciliar** (contar dinheiro → ajuste com categoria/motivo); atalho de import. Limpo. → **Pacote #1** torna a presença de carteira **progressiva**.
- **Planned purchases** (3.5/5): toggle de **reserva** (tira do livre agora × só acompanhar), categoria, loja, data-alvo, fundo, notas; baldes aberto/feito; folha **"Comprei"** (valor + fechar) com undo; vincular gasto existente; barra de progresso. → **Pacote #1** unifica com Eventos sob "Planejar um gasto".
- **Profiles** (3/5): perfis de atividade (tag custom, frequência por fase, valor típico); criar/editar; soft-delete. **"Perfis" = na real "categorias/atividades planejáveis"** — nome técnico.
- **Income** (4/5): registrar entrada real → **cresce um fundo + credita uma carteira**; valor, descrição, fundo (auto), carteira, data. Focada e clara; descoberta via FAB (avançado).
- **Melhorias:** (P1, Pacote #1) Funds→Trecho/Pote + "Visão avançada" para envelope/escopo/piso; (P2) renomear "Perfis"→"Categorias/Atividades"; (P2) carteira progressiva (Pacote #1); (P3) microcopy "cresce o fundo" em Income.

---

### BLOCO E — Sistema e descoberta

#### 4.17 Configurações — `SettingsPage` · Nota 4/5 · ALTA
- **Função:** tudo "extra" e ajustes.
- **Fluxo real:** estilo Samsung — **7 grupos** (preferences, notifications, money, home, data_security, device, about) → subpáginas, com **busca multilíngue por palavra-chave**.
- **Claro:** IA forte para um app denso; a busca salva a navegação.
- **Confunde:** **muitíssimos itens** (é o ralo de tudo); **"Dados e segurança"** é larga demais (backup, PIN, biometria, reset, caixa postal, recibo, conexão num grupo só).
- **Melhorias:** (P3) quebrar "Conexões/Compartilhamento" para fora de "Dados e segurança"; abrigar a futura **"Visão avançada da viagem"** (Pacote #1) aqui.

#### 4.18 Descoberta e secundárias — `GuidePage`, `NotificationsPage`, Sobre, Impacto, Sync/Pair · Nota ~4/5 · ALTA
- **Guia ("Tudo que dá pra fazer")** 4.5/5: **catálogo data-driven** de todas as capacidades, com link direto — o **antídoto à sobrecarga** e a rede de descoberta nº 1. Manter e **manter sempre atualizado**.
- **Notificações** 4/5: agrupadas (ação / hoje / lembretes), data-driven, bom estado vazio.
- **Sobre / Impacto / Sync / Pair:** focadas e coerentes; sem dor evidente. (P3) passadas pontuais.

---

## 5. Backlog priorizado (vira os Pacotes #2, #3…)

| Prio | Item | Área | Vira pacote |
|---|---|---|---|
| **P0** | **Reorganizar o FAB** — manter as 9 ações e o design; **reordenar** p/ polegar (heróis na base) + **expanders** ("Outros registros…", opcional "Planejar"). Nada removido. | FAB | candidato a **Pacote #2** |
| **P1** | **Disclosure progressivo no QuickAdd** (gasto típico em 3 toques; fundo some quando só há 1) | Captura | Pacote #2/#3 |
| **P1** | **Priorizar o Copiloto** (3–5 seções-chave + "ver mais", agrupar por tema) | Copiloto | Pacote #3 |
| **P1** | Estender vocabulário **Trecho/Pote** ao Hub Viagem + Funds + Gestão (casa com Pacote #1) | Viagem/Gestão | depende do Pacote #1 |
| **P1** | **Porta única de planejamento** (Planner + Simulador + Compras planejadas + Eventos) — unificar entradas (casa com Pacote #1, G8) | Planejamento | depende do Pacote #1 |
| **P2** | **Resolver G7** — papel de `/viagem` (Hub) vs `/trip` (Overview): 1 mapa, 1 editor | Viagem | Pacote #3 |
| **P2** | **Planner como avançado** (esconder no modo simples) + microcopy dos termos (margem/alocação) | Planner | Pacote #3 |
| **P2** | **Explicador único de divisão** + microcopy consistente nas 4 telas (G9) | Shared/QuickAdd/Recibo/Wise | Pacote #3 |
| **P2** | Renomear "Perfis"→"Categorias/Atividades" | Gestão/Viagem | Pacote #3 |
| **P2** | Teto de avisos na Home; "por que apareceu?" | Home | Pacote #3 |
| **P2** | Microcopy de conceito: Saída, SOS (+ surfacing contextual do SOS) | Outing/Rescue | Pacote #3 |
| **P2** | Lista de Gastos: agrupar/rotular chips de filtro; explicar aba "Saídas" e gesto de borda | Gastos | Pacote #3 |
| **P3** | Onboarding: recomendação de modo + colapsar opções + exemplo de "reserva protegida" | Onboarding | Pacote #4 |
| **P3** | Revisar categoria "Dados e segurança"; abrigar "Visão avançada da viagem" | Settings | Pacote #4 |
| **P3** | Editor da viagem: suavizar "preset de ritmo / dias de pico / sub_destination" | Trip Edit | Pacote #4 |

---

## 6. Perguntas em aberto (pro Julio / próxima rodada)

> **FAB já resolvido:** manter as 9 ações, **só reordenar** + expanders, preservando o design (Simular e Planejar **continuam** no FAB). Ver §3.

1. **Ordem dos próximos pacotes:** sugiro **#2 = FAB (reordenar+expanders) + QuickAdd progressivo** (captura, alto impacto/baixo risco); **#3 = Copiloto priorizado + porta única de planejamento + vocabulário Trecho/Pote**. Concorda com essa ordem?
2. **Planner** é claramente "fundo da piscina": esconder no **modo simples** por padrão (P2) e oferecer um modo guiado? Ou manter sempre visível?
3. **G7 — duas telas de viagem** (`/viagem` Hub × `/trip` Overview): consolidar numa só, ou manter as duas com papéis bem rotulados (mapa × resumo)?
4. **"Perfis"** → confirma renomear para **"Categorias/Atividades"** (ou outro termo que você prefira)?
5. **Divisão (G9):** quer o **explicador único** + UI consistente nas 4 telas já no Pacote #3, ou deixar para depois?

---

## 7. Documentos relacionados
- Pacote #1 (não alterado por este): `budget-model-master-decision-2026-06-17.md` + `budget-model-implementation-prompt-2026-06-17.md`
- Estudos de origem: `budget-mental-model-study-2026-06-17.md`, `…-part2-2026-06-17.md`
