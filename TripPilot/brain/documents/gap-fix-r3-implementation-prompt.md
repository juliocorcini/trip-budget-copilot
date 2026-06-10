# IMPLEMENTAÇÃO R3 — REVIEW DE UX DO JULIO — TripPilot

> **Modo**: Chat direto — sem agents, sem subagents, sem Task tool
> **Fonte da verdade**: ESTE prompt — os 26 requisitos abaixo são a transcrição fiel de um review em áudio do Julio usando o app real (pós-v0.3.0). Não existe documento de auditoria desta rodada; cada requisito já traz o relato, o problema e a especificação
> **Objetivo**: 26/26 requisitos implementados · DEC-084..102 registrados · brain atualizado · deploy v0.4.0 no ar
> **Baseline protegida**: todos os testes unit + e2e atuais verdes, build/typecheck limpos — NUNCA pode regredir
> **Tema central do review**: "quero ter o sentimento de que é um aplicativo de verdade, não uma página da web" + "o usuário vai querer clicar em tudo — tudo que parece clicável tem que levar a algum lugar"

---

## IDENTIDADE

Você é um desenvolvedor senior full-stack + UX engineer implementando a rodada R3 **sozinho, nesta conversa**. Os requisitos vieram de um review minucioso do Julio usando o app numa viagem real. Onde o relato descreve o problema mas não a solução exata, a especificação deste prompt decide — execute-a.

**Regras absolutas:**
- NÃO delegue para agents/subagents/Task tool
- NÃO peça confirmação entre gates — as decisões estão pré-resolvidas (DEC-084..102)
- NÃO resuma — implemente
- NÃO pare porque "conversa longa" — use o recovery protocol
- PRESERVE a baseline de testes — regressão é sua e bloqueia o gate
- Cada requisito tem um "DONE quando" — é o critério de aceite, não negociável

---

## ⚓ ÂNCORA — REGRAS INVIOLÁVEIS

Releia no início de CADA gate e reproduza no checkpoint:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
1. INVESTIGUE ANTES DE MUDAR: cada requisito começa lendo o código
   atual envolvido. Vários têm root cause não-mapeado (ex.: de onde
   vem o "reservado para agosto", o que o cadeado faz hoje)
2. App feel é requisito funcional: headers fixos, scrollbars
   invisíveis, sem pull-to-refresh no PWA, alturas iguais — o Julio
   avalia ISSO tanto quanto lógica
3. Tudo que parece clicável LEVA a algum lugar; tudo que é
   informação tem detalhe acessível
4. Money = integer cents | Soft delete + revision | Domain pure TS
5. Registro NUNCA bloqueia: steppers são pós-save e puláveis
6. Campos novos NÃO indexados em Dexie NÃO exigem bump de versão —
   só types + Zod + backup + entity factory. NÃO crie Dexie v4
   sem necessidade real de índice
7. Zero cores hardcoded — tokens. Zero diálogos nativos
8. Taxonomia/catálogos = data-driven no domínio (como
   profile-presets.ts), nunca conditionals espalhados
9. UI text = t() em pt-BR + en + es NO MESMO COMMIT (paridade)
10. npm run test + typecheck + build verdes em TODO checkpoint
11. Node 22 p/ wrangler/playwright:
    export PATH="$HOME/.nvm/versions/node/v22.22.3/bin:$PATH"
    Git: bash -c 'git commit ...' (sem --trailer)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

---

## DECISÕES PRÉ-RESOLVIDAS (registrar como approved no Gate 0)

| DEC | Título | Resumo |
|---|---|---|
| DEC-084 | Headers fixos em todas as telas | Header + controles fixos no topo; só o conteúdo rola (specs em R-01) |
| DEC-085 | Margens compactas padronizadas | Margem lateral única e menor em todas as páginas; cards alinhados e com mesma largura/altura |
| DEC-086 | Scrollbars horizontais invisíveis | Scroll mantido, visual da barra removido (filtros de Gastos, carrosséis) |
| DEC-087 | Pull-to-refresh desativado no PWA | `overscroll-behavior` para eliminar o gesto de reload no app instalado |
| DEC-088 | "Livre para usar hoje" subtrativo | = allowance do dia − gastos de hoje; a média diária vira métrica secundária com nome claro |
| DEC-089 | Remover "Reservado para [próx. fase]" do hero | Cada fase tem fundo próprio; future floor continua existindo em Fundos/Planner, fora do hero |
| DEC-090 | Central de notificações | Sino → tela de notificações derivadas (dados existentes); nunca mais → /shared |
| DEC-091 | Insights: swipe navega, tap detalha | Carrossel interno por swipe; tap leva ao destino daquele insight |
| DEC-092 | Card de economia contextual | Copy referencia a última saída explicitamente, com valores de referência |
| DEC-093 | Amigo Sincero v2 baseado no plano | Compara com o PLANEJADO, projeta uso da reserva; "Ver impacto completo" → tela de detalhe (não simulador) |
| DEC-094 | Simulador multi-métrica | % do disponível + equivalência em dias de allowance + impacto nas ocasiões planejadas |
| DEC-095 | Taxonomia de subcategorias por tipo de saída | Catálogo data-driven com valores típicos; ordenação por proximidade do valor digitado |
| DEC-096 | Stepper ≥10s + categoria no split + 2 níveis p/ eventos | Tempo de interação ampliado; split pergunta o que foi; evento pergunta contexto → subcategoria |
| DEC-097 | Itens de sessão mostram subcategoria | Histórico da sessão ativa e detalhe de saída exibem O QUE foi comprado, não o tipo da saída |
| DEC-098 | Planner: margem livre ao vivo + alerta no topo | Margem atualiza a cada ajuste; estado negativo é enfático e fica no header fixo |
| DEC-099 | Menu de categoria no Planner + perfis editáveis | Tap no nome → menu (editar valor do perfil, remover da fase, classificação); Perfis ganha editar/remover |
| DEC-100 | Cadeado e classificação com efeito real, por fase | Classificação (essencial/planejado/opcional) é POR FASE; cadeado protege o item de presets/recomendações |
| DEC-101 | Evento do Planner abre a edição do evento | Tap no evento → editor do evento direto (não o topo do Trip Edit) |
| DEC-102 | Extrato de dívida por participante | Tap no participante → itens que compõem o saldo |

---

## STATE FILE (crie ANTES de qualquer código)

`TripPilot/src/gap-fix-log-r3.md` — mesmo formato dos anteriores: Current State (gate/item ativo, X/26, testes, build), checkboxes por gate, extras encontrados (anotar, não corrigir).

---

## MAPA DE GATES

```
GATE 0  Baseline + decision-log (DEC-084..102 → approved)
GATE 1  App feel: headers fixos, margens, scrollbars, PWA     R-01..05
GATE 2  Dashboard certo: livre hoje, hero, sino, insights     R-06..10
GATE 3  Amigo Sincero v2 + simulador multi-métrica            R-11..12
GATE 4  Taxonomia de subcategorias + stepper                  R-13..18
GATE 5  Planner overhaul                                      R-19..24
GATE 6  Dívidas detalhadas + varredura de cliques             R-25..26
GATE 7  Brain + verificação final + deploy v0.4.0
```

---

## GATE 1 — APP FEEL (o tema nº 1 do review)

**R-01 — Headers fixos (DEC-084)**
> Relato: "Quando eu rolo a página, o header deveria continuar sempre fixo em cima — dá um ar mais profissional ao aplicativo." Ele especificou tela a tela.
- **Dashboard**: header (intervalo de datas + nome da fase + sino) fixo; conteúdo rola por baixo
- **Gastos**: header + barra de filtros fixos; só a lista rola
- **Planejar**: header + seletor de fases + resumo (margem livre / alocado) + o aviso de over-budget (R-20) fixos; a partir de "Eventos" rola
- Padrão técnico único (sticky/fixed + scroll container), com fundo sólido do tema e elevação sutil ao rolar
- DONE quando: nas 3 telas, rolar mantém o bloco fixo legível, nos 2 temas

**R-02 — Margens compactas e padronizadas (DEC-085)**
> Relato: "Todas as páginas estão com margens laterais muito grandes — a de início é a pior. As outras estão melhores; dá para usar como padrão, só um pouquinho menos. O carrossel está certo: começa quase sem margem dos dois lados — faça os outros cards da tela inicial como o carrossel. E TODOS os cards têm que manter a mesma margem dos cantos para ficar com o mesmo visual."
- Definir token único de padding lateral de página (ex.: `--page-padding-x`, ~16px) e aplicar em TODAS as páginas; dashboard deixa de ter margem extra
- Todos os cards do dashboard com a MESMA largura/margem (alinhados ao carrossel)
- DONE quando: nenhuma página tem margem visivelmente maior que outra; cards do dashboard alinhados entre si

**R-03 — Cards do carrossel com mesma altura (DEC-085)**
> Relato: "'Bar — restantes' fica numa linha; 'Transporte — restantes' quebra em duas → cards com alturas diferentes, fica estranho. Todos os cards do carrossel têm que ter a mesma altura."
- Altura fixa no card do counter (reserve espaço de 2 linhas para o nome; 1 linha centraliza ou trunca consistentemente)
- DONE quando: qualquer combinação de nomes gera cards de altura idêntica

**R-04 — Scrollbars horizontais invisíveis (DEC-086)**
> Relato: "Na barra de filtros de Gastos aparece um scroll horizontal feio que fica visível. Mantém o scroll, tira o visual. O mesmo acontece no carrossel do início — lá já tem as bolinhas indicando."
- Utility CSS (`scrollbar-width: none` + `::-webkit-scrollbar { display: none }`) aplicada à barra de filtros de Gastos, ao carrossel de counters e a qualquer outro scroll horizontal do app
- DONE quando: zero scrollbars horizontais visíveis; scroll por gesto continua funcionando

**R-05 — Pull-to-refresh desativado no PWA (DEC-087)**
> Relato: "Se eu puxo a tela para baixo aparece o ícone de recarregar do navegador — mostra que é uma página web. No PWA instalado, desativa isso; no navegador pode manter."
- `overscroll-behavior-y: none` (root/body) — aplicar sempre ou condicionado a `display-mode: standalone` (media query) para preservar no browser; impedir o bounce que dispara reload
- DONE quando: no modo standalone, puxar para baixo no topo NÃO mostra o spinner de reload

**Checkpoint** + commit `fix(gate-r3-1): app feel — sticky headers, unified margins, hidden scrollbars, no pull-to-refresh`

---

## GATE 2 — DASHBOARD CERTO

**R-06 — "Livre para usar hoje" subtrativo (DEC-088)**
> Relato: "Mostrava €6,00 livre hoje. Registrei €2 de transporte e foi para €5,99. Não funciona para o que o título diz: se eu gasto €2, deveria sobrar €4. Entendo que deve ser uma média — pode até existir como média com outro nome — mas o 'livre para usar hoje' tem que diminuir pelo que eu gastei hoje."
- Investigar o cálculo atual (provável: freeToSpend ÷ dias efetivos recalculado após cada gasto)
- Novo modelo: `todayAllowance` fixado no início do dia (allowance ponderada por ritmo/dias efetivos, calculada SEM os gastos de hoje) − `todaySpent` (gastos do dia) = "Livre para usar hoje". Gastou €2 → número desce €2
- A média recalculada pode aparecer como linha secundária com nome explícito (ex.: "média diária até o fim da fase")
- Testes de domínio com o cenário do relato (6,00 − 2,00 = 4,00)
- DONE quando: registrar gasto reduz o "livre hoje" exatamente pelo valor

**R-07 — Remover "Reservado para [agosto]" do hero (DEC-089)**
> Relato: "Esse 'reservado para agosto' era de quando o app começou. Agora cada fase tem seu próprio fundo — nada do valor da fase atual vai para agosto. Não faz mais sentido; pode tirar. Quando for agosto, vai estar lá o saldo do fundo daquela fase."
- Investigar a origem da linha (future floor? policy legada? hardcode?); remover a linha do hero do dashboard
- Future floor/reservas continuam existindo e deduzindo onde configurados — exibidos em Fundos e Planner, não no hero
- DONE quando: hero sem a linha; mecânica de future floor intacta em Fundos

**R-08 — Sino → Central de notificações (DEC-090)**
> Relato: "Clico no sino e vai para participantes e dívidas — não faz sentido nenhum. Tem que ir para um menu de notificações do aplicativo. Se não tem notificação, deixa o menu vazio."
- Nova rota `/notifications` + tela: lista de notificações DERIVADAS dos dados existentes (sem tabela nova): shares pendentes de confirmação (tap → confirmar), evento de hoje (tap → iniciar), lembrete de backup vencido (tap → backup), saída ativa há muito tempo, over-budget de fase. Cada uma com ícone, texto e destino
- Empty state bonito ("Nenhuma notificação")
- Badge do sino = nº de notificações ativas; sino → `/notifications`
- DONE quando: sino nunca mais leva a /shared; itens navegam ao destino certo

**R-09 — Insights: swipe navega, tap abre detalhe (DEC-091)**
> Relato: "Para ver o próximo insight eu preciso CLICAR — não é intuitivo. Trocar de insight tem que ser arrastando o dedo (carrossel interno). E o clique tem que abrir o conteúdo: 'nesse ritmo a fase fecha em X' → clico e vejo detalhes de como cheguei nisso; 'você deve €1,38 à Débora' → clico e vou para a tela de divisões; 'Veneza em 36 dias, reservado €20' → clico e vou para o evento, ver e editar. O usuário vai querer clicar em tudo — tem que levar para algum lugar."
- Swipe horizontal (scroll-snap, mesma técnica do carrossel) troca o insight; dots mantidos; remover o tap-para-próximo
- Tap por tipo de insight: projeção/ritmo/dias-sem-gasto → sheet/tela de detalhe com o cálculo aberto (números, período, como chegou); dívida → `/shared`; próximo evento → edição do evento (reusa R-23); custo por saída → `/expenses?tab=outings`
- DONE quando: swipe troca, tap leva ao destino correto de CADA insight

**R-10 — Card de economia com copy contextual (DEC-092)**
> Relato: "'Você preservou €2 — 67% de uma noite comum no bar' é confuso: parece que preservei na viagem toda, mas é de um evento específico. Deveria ser 'Na sua última vez no bar, você preservou €2' e deixar clara a referência (uma noite comum custa €3)."
- Nova copy via i18n: "Na sua última saída de [perfil], você gastou €X — €Y abaixo do seu normal (€Z)" (valor típico de referência explícito; eliminar o % isolado sem base)
- Só exibir quando houver saída encerrada recente E typical confiável
- DONE quando: card cita a saída específica e a referência de valor

**Checkpoint** + commit `fix(gate-r3-2): dashboard correctness — today allowance, hero cleanup, notifications center, insights interaction`

---

## GATE 3 — AMIGO SINCERO V2 + SIMULADOR

**R-11 — Amigo Sincero baseado no PLANO (DEC-093)**
> Relato: "'Suas saídas de bar caíram de 197 para 195' — eu nunca teria 195 saídas de bar! Ele está pegando o valor livre restante e dividindo pelo custo típico. Não é assim. Tem que pensar no que é informação IMPORTANTE: eu planejei X saídas; com esses gastos, o que muda é o que eu PLANEJEI; se eu continuar nesse ritmo, vou começar a usar a reserva no dia tal. E 'Ver impacto completo' manda para o simulador pré-preenchido — não faz sentido NENHUM. Deveria abrir o detalhamento: antes você tinha planejado isto, gastou aquilo, caiu para isto, fique de olho, nesse ritmo a reserva começa a ser usada dia tal."
- **Novo modelo do card** (substituir o cálculo saldo÷típico):
  - Base = ScenarioPlan da fase ativa: "Você planejou [N] noites de bar; no ritmo atual cabem [M] das [K] restantes" (allocations − feitas vs orçamento restante da categoria)
  - Se ritmo atual > planejado: projeção de reserva — "se continuar assim, você começa a usar a reserva em [data]" (usa dias efetivos/projeção do insights engine)
  - Se está dentro do plano: reforço positivo curto
  - Sem plano para a categoria: fallback honesto (impacto no livre da fase), nunca números absurdos
- **"Ver impacto completo" → nova tela/sheet `ImpactDetailPage`** (NÃO simulador): planejado vs gasto por categoria afetada (antes/depois), gasto que disparou o card, projeção de fim de fase, risco da reserva com data estimada, CTA "ajustar plano" → Planner
- Testes de domínio das funções novas (planned-vs-actual, data projetada de uso da reserva)
- DONE quando: card nunca mostra contagens irreais; "Ver impacto completo" abre o detalhamento

**R-12 — Simulador multi-métrica (DEC-094)**
> Relato: "Coloco €20 e ele fala 'tranquilo, sobra €525, 4% do disponível'. Mas não é tão simples: eu tinha €5/dia para gastar — €20 são 4 dias do meu orçamento diário! Tem várias métricas para definir se faz sentido gastar. 'Posso gastar?' é diferente de 'tenho dinheiro?'."
- Resultado da simulação mostra 3 perspectivas:
  1. **Do total**: % do disponível + sobra (atual, mantém)
  2. **Do dia a dia**: "€20 = [N] dias do seu livre diário (€X/dia)" — usa a allowance do R-06
  3. **Do plano**: quais ocasiões planejadas encolhem ("≈ 2 noites de bar a menos" — reusa o motor do R-11)
- Veredito (tranquilo/atenção/risco) considera as 3 (a pior define o tom)
- DONE quando: simular €20 com €5/dia mostra explicitamente a equivalência em dias

**Checkpoint** + commit `feat(gate-r3-3): honest friend v2 (plan-based) + impact detail + multi-metric simulator`

---

## GATE 4 — TAXONOMIA DE SUBCATEGORIAS (a maior peça do review)

**R-13 — Catálogo de subcategorias por tipo de saída (DEC-095)**
> Relato: "Estou numa saída de BAR e ele me pergunta se o gasto é 'bar, restaurante, transporte' — isso é tipo de SAÍDA, não tipo de GASTO! Se estou no bar, pergunte coisas DE bar: drink, cerveja, comida, lanche, entrada. Vida noturna: drinks, entrada de festa. Café & padaria: café, pão, suco de laranja. Mercado: proteína, massas, categorias DE mercado. Restaurante: prato, suco, sobremesa. Vamos precisar de uma pesquisa bem grande para criar as opções de cada tipo. E cada opção tem um valor médio: se eu digito €3, aparecem primeiro as opções perto de €3; se digito €10, as perto de €10."
- **`expense-taxonomy.ts` no domínio** (data-driven): para CADA um dos 17 tipos de perfil do catálogo R2 + fallback genérico, lista de subcategorias `{ id, labelKey i18n, icon, typicalCents }`. Seja GENEROSO e realista (6-12 por tipo). Exemplos-semente (expanda com pesquisa própria):
  - bar: drink, cerveja, shot, comida, lanche/petisco, entrada, jogos, outros
  - restaurante: prato, bebida, sobremesa, café, entrada/couvert, gorjeta
  - mercado: proteínas, hortifruti, massas & grãos, laticínios, padaria, bebidas, snacks, limpeza, higiene, outros
  - café & padaria: café, pão, doce, suco, lanche
  - vida noturna: entrada, drink, cerveja, comida, chapelaria, transporte da noite
  - transporte: ônibus, trem, metrô, táxi/app, bike, combustível
  - praia: comida, bebida, cadeira/guarda-sol, passeio
  - museus & atrações: ingresso, audioguia, souvenir
  - compras & souvenirs: roupa, souvenir, presente, eletrônicos
  - festivais & eventos: entrada, drink, comida, souvenir, transporte
  - (complete TODOS os tipos restantes + genérico)
- **Ordenação por proximidade**: ao digitar o valor, subcategorias ordenadas por `|typicalCents − amountCents|` (mais próximas primeiro)
- **Persistência**: campo novo `subcategoryId: string | null` em Transaction (NÃO indexado → sem Dexie v4; atualizar type, factory, Zod, backup, CSV)
- Todos os labels em pt-BR + en + es
- DONE quando: numa saída de bar, o stepper oferece itens DE bar ordenados pela proximidade do valor

**R-14 — Stepper com mais tempo (DEC-096)**
> Relato: "Ele some muito rápido — não consegui clicar. Pelo menos uns 10 segundos."
- Auto-dismiss: 3s → **10s**, e qualquer interação (toque/scroll no stepper) reseta o timer
- DONE quando: stepper permanece ≥10s sem interação

**R-15 — Itens da sessão mostram a subcategoria (DEC-097)**
> Relato: "Nos últimos gastos da saída ativa aparece 'restaurante, restaurante, restaurante' — eu JÁ SEI que estou no restaurante! Tem que falar O QUE eu gastei."
- Histórico da sessão ativa: label = subcategoria (ícone + nome); sem subcategoria → valor + "toque para detalhar" (reabre o stepper para aquele item)
- DONE quando: itens categorizados mostram "drink €3", "comida €5"...

**R-16 — Split na sessão pergunta o que foi (DEC-096)**
> Relato: "No dividir gasto eu coloco valor e com quem, mas ele não pergunta O QUE foi — fica sem informação de novo."
- Fluxo de split da sessão ganha o passo de subcategoria (mesmo componente do stepper)
- DONE quando: gasto dividido na sessão sai com subcategoria

**R-17 — Eventos: pergunta em 2 níveis (DEC-096)**
> Relato: "No evento (Parral) a saída não tem tipo — pode ser várias coisas. Então primeiro pergunta ONDE/o que foi (bar, restaurante, mercado, souvenir...), e DEPOIS as opções daquele contexto (foi restaurante → prato, refrigerante, sobremesa)."
- Sessões de evento único (sem perfil): stepper nível 1 = contexto (bar, restaurante, mercado, transporte, souvenir, entrada, outros) → nível 2 = subcategorias do contexto; gravar contexto como `category` e subcategoria como `subcategoryId`
- DONE quando: gasto num evento sai com contexto + subcategoria

**R-18 — Detalhe de saída com itens específicos (DEC-097)**
> Relato: "No detalhe da saída do Parral está '3 itens: parral outros, parral transporte, parral bar' — não faço ideia do que gastei. Eu JÁ estou no detalhe do Parral: não repete o nome; mostra 'comprou um drink, comida, lembrancinha' — bem específico."
- Detalhe/review de saída: cada item = ícone + subcategoria (ou contexto+subcategoria p/ eventos) + valor; NUNCA prefixar com o nome da sessão
- DONE quando: detalhe do Parral lista "🍹 Drink €3 · 🍔 Comida €5 · 🎁 Lembrancinha €2"

**Checkpoint** + commit `feat(gate-r3-4): expense taxonomy per outing type + enriched stepper/split/events`

---

## GATE 5 — PLANNER OVERHAUL

**R-19 — Margem livre atualiza ao vivo (DEC-098)**
> Relato: "Subo transporte de €32 para €40: o alocado vai de 370 para 378, mas a margem livre continua 135. Me dá a sensação errada de que posso gastar. Os DOIS têm que mudar juntos."
- Investigar por que margem livre não recalcula no ajuste; margem livre = fundo − reservas − alocado, recalculada a CADA tap de [-]/[+]
- DONE quando: +€8 no alocado → −€8 na margem livre, instantâneo

**R-20 — Alerta de over-budget no topo, enfático (DEC-098)**
> Relato: "Estourei o valor e olhando o topo está tudo normal — margem livre 0, como se estivesse tudo certo. O aviso de 'alocação excede em €108' está escondido lá embaixo. Se tem problema, ele tem que estar EM PRIMEIRO LUGAR, visível, enfático. E a margem livre não deveria mostrar 0 — deveria mostrar o negativo."
- Margem livre exibe valor NEGATIVO em cor de erro quando estourado (−€108, não 0)
- Banner de over-budget sobe para o bloco fixo do header (R-01): cor de erro, ícone, "Alocação excede a margem livre em €X" — visível sem rolar, nos 2 temas
- O card de recomendação (reduzir item) permanece onde está — o Julio aprovou: "ele me ajuda a reduzir, está ótimo; só o problema precisava estar mais visível"
- DONE quando: estourar → header fixo mostra negativo vermelho + banner imediatamente

**R-21 — Menu de categoria: editar valor, remover da fase (DEC-099)**
> Relato: "O transporte está €8 — um transporte pode ser €1! Eu preciso poder clicar em transporte ali no Planner e editar o valor desse perfil. E também não consigo TIRAR uma categoria do planejador — mercado na eurotrip eu não vou usar; deveria ter um menu quando clico no nome com a opção de tirar."
- Tap no nome/linha da categoria → BottomSheet com: **Editar valor típico** (atualiza ActivityProfile), **Remover desta fase** (phaseProfileSettings.isEnabled=false + remove allocation da fase), **Classificação** (R-22)
- DONE quando: dá para mudar transporte de €8 → €1 e remover mercado da eurotrip sem sair do Planner

**R-22 — Classificação por fase + cadeado com efeito real (DEC-100)**
> Relato: "Mercado é essencial em Burgos mas NÃO na eurotrip — a classificação muda por fase. E o cadeado não faz NADA: aberto, fechado, verde, nenhuma diferença. Temos que entender por que essa informação está ali e fazer ela ajudar."
- Investigar onde a classificação vive hoje (provável: global no perfil) → mover para o nível por-fase (allocation item ou phaseProfileSettings — preferir estrutura existente; campo não indexado = sem migração)
- Classificação editável no menu do R-21; efeitos reais: **essencial** nunca é sugerido para redução pela recomendação; **opcional** é o primeiro candidato; chips visuais mantidos
- **Cadeado**: item travado é IGNORADO por presets e por "aplicar recomendação" (quantidade intocável) + feedback visual ao tentar alterar
- DONE quando: classificação difere entre fases; recomendação respeita essencial e cadeado

**R-23 — Evento do Planner abre a edição do evento (DEC-101)**
> Relato: "Cliquei em Veneza nos eventos do Planner e ele abriu o Editar Viagem lá no topo — a fase eurotrip estava lá embaixo. Deveria já mostrar o evento para eu editar."
- Tap num evento → editor do evento direto (sheet de edição da occurrence; preferir o sheet a navegar para Trip Edit)
- Mesmo destino usado pelo insight "próximo evento" (R-09) e pelo card do dia
- DONE quando: tap em "Veneza" abre a edição de Veneza

**R-24 — Perfis: editar e remover (DEC-099)**
> Relato: "Na tela de Perfis eu consigo adicionar, mas não consigo editar o valor de um perfil — nem dos que eu criei nem dos automáticos. E falta remover."
- ProfilesPage: tap no perfil → form de edição (nome, ícone, valor típico, valor seguro); remover via soft delete com regra de segurança (em uso → avisar e desabilitar das fases em vez de apagar)
- DONE quando: editar valor típico de qualquer perfil e remover perfil sem uso

**Checkpoint** + commit `feat(gate-r3-5): planner overhaul — live margin, top warning, category menu, per-phase classification, profile editing`

---

## GATE 6 — DÍVIDAS DETALHADAS + VARREDURA DE CLIQUES

**R-25 — Extrato por participante (DEC-102)**
> Relato: "Está 'Débora deve €1,12'. Eu clico na Débora e ele deveria mostrar exatamente DE ONDE veio — todos os itens que somaram esse €1,12."
- Tap no participante em /shared → sheet/área expandida com cada share que compõe o saldo: gasto (descrição/subcategoria), data, valor da parte, quem pagou, status; settlements aplicados listados
- DONE quando: o €1,12 da Débora é rastreável item a item

**R-26 — Varredura "tudo clicável leva a algum lugar"**
> Relato (princípio repetido o review todo): "O usuário vai querer clicar em tudo que parece clicável — tem que levar ele para algum lugar."
- Passada por todas as telas: cada card/linha/ícone com cara de interativo tem destino ou ação; o que for puramente informativo não deve PARECER botão (sem affordance falsa)
- Anotar no state file a lista verificada (tela → elementos → destino)
- DONE quando: a lista cobre todas as telas sem elemento órfão

**Checkpoint** + commit `feat(gate-r3-6): participant debt breakdown + clickability sweep`

---

## GATE 7 — BRAIN + VERIFICAÇÃO FINAL + DEPLOY

```
1. Brain:
   - decision-log.md → conferir DEC-084..102 registrados (Gate 0); Last updated
   - project-status.md → R3 implementada, números
   - product-spec.md → taxonomia de subcategorias, central de notificações,
     Amigo Sincero v2, simulador multi-métrica, planner por fase
   - database-schema.md → campos novos (subcategoryId, classificação por fase)
2. package.json → 0.4.0
3. npm run test (100%) + typecheck + build + npx playwright test
4. RE-VERIFICAÇÃO: tabela R-01..R-26 com cada "DONE quando" confirmado NO CÓDIGO
5. Smokes dos cenários do review (trace):
   a) gasto de €2 → "livre hoje" cai de 6,00 para 4,00
   b) saída de bar → stepper oferece drink/cerveja/comida ordenados pelo valor
   c) Planner: +1 transporte → alocado sobe E margem livre desce; estourar →
      alerta vermelho no header fixo
   d) Amigo Sincero nunca mostra "197 saídas"; "Ver impacto" abre detalhe
   e) sino → central de notificações; insight de evento → edição do evento
   f) PWA standalone: puxar para baixo não recarrega
6. Paridade i18n ×3 (incluindo TODAS as subcategorias) | 0 hardcoded | 0 nativos
7. Deploy: npx wrangler pages deploy dist --project-name=trippilot
8. Entregar: 🚀 URL + tabela 26/26 + resumo por gate
```

---

## PROTOCOLO DE CHECKPOINT (fim de CADA gate)

```
GATE [N] CONCLUÍDO
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Requisitos: [R-XX ✅ ...] | Arquivos: [lista]
Testes: X unit + Y e2e | Build ✅ | Typecheck ✅
i18n: [N] chaves novas ×3 (paridade ✅)
Regressão: [2-3 fluxos anteriores re-checados]
Fora de escopo tocado? [não / o quê e por quê]
State file ✅ | Commit: [hash]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[reproduza o bloco ÂNCORA]
PRÓXIMO: Gate [N+1]
```

**Mid-gate refresh**: a cada 3 requisitos, releia a ÂNCORA + Current State (3 linhas).

---

## RECOVERY PROTOCOL

1. `TripPilot/src/gap-fix-log-r3.md` → gate/requisito ativo
2. Releia ÂNCORA + seção do gate ativo NESTE prompt (o relato do requisito está aqui dentro)
3. `npm run test` para confirmar estado real
4. Continue do último checkbox aberto — NUNCA refaça gate concluído

---

## CRITÉRIO DE PARADA

```
DONE quando TUDO = TRUE:
- [ ] 26/26 requisitos com "DONE quando" confirmado (tabela do Gate 7)
- [ ] DEC-084..102 approved no decision-log
- [ ] Taxonomia completa: TODOS os tipos de perfil com subcategorias ×3 idiomas
- [ ] 6 smokes do review passando
- [ ] Headers fixos nas 3 telas | margens unificadas | zero scrollbars visíveis
- [ ] Amigo Sincero sem números absurdos | sino → notificações | livre hoje subtrativo
- [ ] Testes ≥ baseline e 100% verdes | Build/Typecheck clean | i18n ×3
- [ ] Brain atualizado | Deploy v0.4.0 no ar com URL
```

---

## COMECE AGORA

1. GATE 0: baseline + state file + DEC-084..102 no decision-log
2. GATE 1: app feel primeiro — é o tema nº 1 do review
3. Checkpoint por gate, recovery se precisar
4. Termine com deploy + tabela 26/26 + URL

**Este review é o Julio usando o app de verdade e apontando onde ele deixa de parecer um app profissional. Cada "DONE quando" é o que ele vai testar. GO.**