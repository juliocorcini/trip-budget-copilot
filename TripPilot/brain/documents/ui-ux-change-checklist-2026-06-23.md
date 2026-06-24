# Checklist Mestre de Mudanças de UI/UX — para decisão (Fazer / Não / Depois)

> **Consolidado em:** 2026-06-23 · **App:** 0.99.50
> **Para quê:** lista única e acionável de **todas as mudanças reais** levantadas nas duas passadas de UI/UX que você pediu. Você marca, item a item, o que **vamos** e o que **não vamos** fazer. Cada item já traz **o motivo (por que fazer)** e **o impacto pro usuário**.
> **Fontes consolidadas (sem repetir):**
>
> - `ux-audit-round2-2026-06-22.md` — a11y, contraste medido, foco, heurística, densidade (IDs A-/B-/C-/D-/F-/G-/N-/W-/T-/V-/P-).
> - `ux-ui-experience-study-2026-06-22.md` — fluxo, emoção, intuição, necessidade (pacotes EXP-1..5, problemas X1..X10).
> Itens que apareceram nos **dois** documentos foram **fundidos** (a "Origem" cita ambos).
> **Status:** documento de DECISÃO — **não altera código**. O que for marcado "FAZER" vira escopo de pacote (com DEC própria).
> **Validação anexada em 2026-06-24** (telemetria real + vereditos por item + plano de migração do M15) — ver as seções no fim do documento.
> **Orquestrador de execução (2026-06-24) — ✅ ACTIVE/pronto p/ rodar:** `documents/2026-06-24-ui-ux-implementation-orchestrator.md` — root-cause map (código↔mudança), gates **G1–G7** (ordem do Council C5), councils inline e a **§16 RESPONDIDA/LOCKADA** pelo Julio (DEC-285→294). Um novo chat pega esse doc + o **prompt de kickoff** (`documents/2026-06-24-ui-ux-kickoff-prompt.md`) e implementa de ponta a ponta.

---

## Como usar

1. Em cada item, troque o estado em **Decisão** para `(x)`:
  `(x) FAZER` · `( ) NÃO` · `( ) DEPOIS`. Se quiser, escreva o motivo da sua escolha na mesma linha.
2. A **tabela-painel** logo abaixo é só visão geral/priorização — **a marcação vale nos itens detalhados** (pra não marcar em dois lugares).
3. Sugestão de ordem de leitura: **P1 → P2 → P3**. Nada aqui é P0 (não há bloqueador; todos os fluxos funcionam).

**Legenda**

- **Prioridade:** **P1** (alto impacto / faça primeiro) · **P2** (médio) · **P3** (polimento).
- **Esforço:** **XS** (≈minutos/1 regra) · **S** (1 sessão pequena) · **M** (1 tela/fluxo) · **G** (várias telas / estrutural).
- **Risco:** chance de regressão ou de mexer em muita coisa (Baixo / Médio / Alto).

**Já feito nesta leva (não precisa decidir):** reorganização do FAB (comparador → "Mais ações", "Registrar mercado" promovido) e Comparador V2 por foto com selo **"confira"** — ambos na **0.99.50**. Alguns itens abaixo (M07, M08) levam isso em conta.

---

## Painel de priorização (visão geral — marque nos itens abaixo)


| ID      | Mudança                                                    | Prio | Esforço | Risco | Origem                 |
| ------- | ---------------------------------------------------------- | ---- | ------- | ----- | ---------------------- |
| **M01** | Foco de teclado visível (`:focus-visible` global)          | P1   | XS      | Baixo | A-1 / §3.3 / N1        |
| **M02** | Contraste AA: token `faint` + CTA terracota + `erro`       | P1   | S       | Baixo | A-2 / B / D-3 / G-1    |
| **M03** | Banners do topo do Dashboard (consolidar/condicionar)      | P1   | S       | Baixo | B-1 / D-1 / "C"        |
| **M04** | Pergunta-Âncora no Dashboard ("Livre hoje: €X" + razão)    | P1   | M       | Médio | EXP-1 / Necessidade #1 |
| **M05** | Vocabulário humano (glossário por toque ⓘ → Ajuda)         | P1   | M       | Baixo | B-4 / EXP-2 / G1 / V-1 |
| **M06** | "Livre da fase: €0" → frase que orienta à ação             | P1   | S       | Baixo | EXP-3 / X1             |
| **M07** | Hierarquia do FAB (1 herói + grupos nomeados)              | P2   | M       | Médio | B-3 / F-1 / F-2 / G4   |
| **M08** | "+" do FAB não-mudo (rótulo + recência da 1ª ação)         | P2   | S       | Baixo | EXP-3 / X3             |
| **M09** | Chip persistente de contexto/modo ("Dia a dia"/"Viagem")   | P2   | S       | Baixo | EXP-3 / X2             |
| **M10** | 1 ação primária por estado no Dashboard                    | P2   | M       | Médio | B-2 / D-2              |
| **M11** | `aria-current` + reforço não-cromático na aba ativa        | P2   | XS      | Baixo | A-3 / F / N4           |
| **M12** | Tokenizar + documentar o acento de IA (índigo/violeta)     | P2   | S       | Baixo | A-4 / E / N3 / G-2     |
| **M13** | Affordance de "Opcional/Essencial" + cadeado (Planner)     | P2   | S       | Baixo | C-2 / P-1              |
| **M14** | Metadados de Gastos truncados/apagados                     | P2   | S       | Baixo | C-3 / G-1              |
| **M15** | Consolidar `/viagem` × `/trip` (1 mapa + 1 editor)         | P2   | G       | Alto  | C-5 / G7 / V-2         |
| **M16** | Reduzir "parede de cards" do Copiloto                      | P2   | M       | Médio | C-6 / G3               |
| **M17** | "O fim que dá orgulho" (fechamento de dia/rolê/viagem)     | P2   | G       | Médio | EXP-4 / Peak-End       |
| **M18** | Saldo da divisão sempre legível + selo "tudo acertado"     | P2   | M       | Médio | Estudo §5.4 / §8       |
| **M19** | Trocar `transition: all` por propriedades específicas      | P3   | S       | Baixo | A-5 / N5               |
| **M20** | Botão "Dados de demonstração" legível                      | P3   | XS      | Baixo | C-1 / W-1              |
| **M21** | Defaults do Conversor (Para = moeda de casa) + placeholder | P3   | S       | Baixo | C-4 / T-1 / T-2        |
| **M22** | Pílula "Manual" do Planner com rótulo de contexto          | P3   | XS      | Baixo | P-2                    |
| **M23** | Welcome "value-first" (1 linha de benefício)               | P3   | XS      | Baixo | W-2                    |
| **M24** | Resiliência visível ("funciona offline")                   | P3   | S       | Baixo | EXP-5                  |
| **M25** | Microcópia de captura no Comparador-foto                   | P3   | XS      | Baixo | Estudo §5.5            |


---

# P1 — Alto impacto (decidir primeiro)

### M01 · Foco de teclado visível em todo o app · P1

**Decisão:** `( x) FAZER`   `( ) NÃO`   `( ) DEPOIS`  — *motivo:*

- **O quê:** adicionar **uma** regra global `:focus-visible` (anel usando `--primary`/`--glow`, respeitando claro/escuro) e parar de remover o contorno nativo sem substituto.
- **Por que fazer:** hoje há `focus:outline-none` em ~37 arquivos e **zero** `focus-visible` → falha WCAG 2.4.7 (F78). É a lacuna de a11y mais clara do app.
- **Impacto pro usuário:** quem usa **teclado, tablet com teclado, PWA no desktop ou leitor de tela** deixa de navegar "às cegas". Pré-requisito pra chamar o app de acessível. No toque (mobile) **não muda nada** — risco visual zero.
- **Esforço:** XS (~10 linhas) · **Risco:** Baixo · **Área:** global · **Origem:** Audit A-1 (§3.3, N1).

### M02 · Contraste AA de texto pequeno e do CTA principal · P1

**Decisão:** `(x ) FAZER`   `( ) NÃO`   `( ) DEPOIS`  — *motivo:*

- **O quê:** ajustar 2–3 tokens medidos abaixo de 4.5:1 — (a) subir o alpha de `--on-surface-faint` (hoje **3.79:1**, mira ≥4.5), (b) CTA terracota com **texto branco puro** ou escurecer `--primary` ~6% (creme sobre terracota = **3.46:1**), (c) revisar `--error` (**4.19:1**, por pouco).
- **Por que fazer:** três falhas reais de AA em texto pequeno: rótulos de nav (10px), metadados e o **CTA primário** que aparece em dezenas de telas ("Criar viagem", "Abrir saída", "Adicionar item").
- **Impacto pro usuário:** tudo fica **mais legível de relance** — é literalmente o "mais sleek / menos confuso" que você pediu. Ajuda muito baixa visão e leitura sob luz ruim (mercado/rua).
- **Esforço:** S · **Risco:** Baixo (só tokens) · **Área:** global · **Origem:** Audit A-2 / §3.1 / D-3 / parte de G-1.

### M03 · Banners do topo do Dashboard (consolidar/condicionar) · P1

**Decisão:** `(x ) FAZER`   `( ) NÃO`   `( ) DEPOIS`  — *motivo:*

- **O quê:** no modo demo, **suprimir** o aviso "seus dados podem ser perdidos" (não há o que perder); fora do demo, transformá-lo em **1 chip discreto** que só vira banner quando há risco real. Não empilhar 2 alertas antes do conteúdo.
- **Por que fazer:** hoje a abertura empilha **dois banners de medo** ("demo" + "backup") que empurram o número-herói pra baixo e geram ansiedade no primeiro olhar.
- **Impacto pro usuário:** primeiro contato **calmo** em vez de assustador; o conteúdo útil aparece antes. Reduz abandono no "primeiro minuto".
- **Esforço:** S · **Risco:** Baixo · **Área:** Dashboard · **Origem:** Audit B-1 / D-1 (alavanca "C").
- **Direção do Julio (2026-06-24):** a tela inicial tem opções demais no 1º olhar — um recém-chegado não sabe o que é "backup". **Mover "modo demonstração" + "backup" juntos pra um lugar mais escondido**, deixar a home mais limpa **e mais bonita** (polish visual). Manter o acesso a essas funções, só não na primeira tela. (Verificado: o lembrete de backup já saiu da home em DEC-176; o que ainda empilha é demo + localização + storage.)

### M04 · Pergunta-Âncora glanceável no Dashboard · P1

**Decisão:** `(x ) FAZER`   `( ) NÃO`   `( ) DEPOIS`  — *motivo:*

- **O quê:** colocar no topo, sempre visível, **"Livre hoje: €X"** (número grande) + **1 linha de razão**; e um atalho "posso gastar ___?" que abre o Simulador já preenchido. Reusa números que o domínio já calcula.
- **Por que fazer:** o job nº 1 do usuário é *"posso gastar isso agora sem me ferrar?"*. Hoje a melhor resposta (Simulador) está a 2 toques dentro do FAB; o Dashboard abre mostrando **estrutura** (fases/livres) antes da resposta.
- **Impacto pro usuário:** transforma o **melhor momento do app** (alívio/permissão) no **primeiro** que a pessoa vê. Resposta em <3s, uma mão. É a maior alavanca de "funcional".
- **Esforço:** M · **Risco:** Médio (mexe no topo do Dashboard — combinar com M03/M10) · **Área:** Dashboard · **Origem:** Estudo EXP-1 / Necessidade latente #1.

só tem que ver pois no card de livre para usar nessa fase já tem um texto de livro hoje, tem que ver se precisa mesmo, se n vai ficar duplicado..

### M05 · Vocabulário humano (glossário por toque) · P1

**Decisão:** `(x ) FAZER`   `( ) NÃO`   `( ) DEPOIS`  — *motivo:*

- **O quê:** um **registro único** "termo → glosa curta → artigo da Ajuda" e um **"ⓘ" discreto e tocável** em cada conceito de dinheiro (fase, livre da fase, livre diário, pote, fundo, alocado, margem). Glosa humana na **1ª aparição** de cada termo.
- **Por que fazer:** o ponto fraco recorrente (heurística #2/#8, persona Jordan) é **densidade de vocabulário**. As definições inline ajudam, mas estão espalhadas e inconsistentes. A Central de Ajuda já existe — falta o **gancho contextual** de cada termo até ela.
- **Impacto pro usuário:** o iniciante para de travar em "não entendo esses termos"; aprende **no ritmo dele**, sob demanda, sem tutorial chato. Menos ansiedade, uso mais profundo.
- **Esforço:** M · **Risco:** Baixo (camada de apresentação; centralizar evita dívida) · **Área:** global · **Origem:** Audit B-4 / V-1 / G1 + Estudo EXP-2.

### M06 · "Livre da fase: €0" → frase que orienta à ação · P1

**Decisão:** `(x ) FAZER`   `( ) NÃO`   `( ) DEPOIS`  — *motivo:*

- **O quê:** trocar o "€0" cru por uma frase tranquilizadora e acionável (ex.: *"Esta fase está toda planejada — o gasto sai do próximo dia ou de um pote"*).
- **Por que fazer:** "Livre da fase: €0" é **correto** mas lido como *"estou quebrado"*. É um susto evitável com uma linha de texto (problema X1, alta probabilidade × alto impacto).
- **Impacto pro usuário:** elimina um pico de ansiedade e de **desconfiança do app** (a pessoa acha que tem bug ou que errou). Sensação de controle no lugar de pânico.
- **Esforço:** S · **Risco:** Baixo (microcópia + condição) · **Área:** Dashboard/Viagem · **Origem:** Estudo EXP-3 / X1.

---

# P2 — Médio impacto

### M07 · Hierarquia do FAB (1 herói + grupos nomeados) · P2

**Decisão:** `(x ) FAZER`   `( ) NÃO`   `( x) DEPOIS`  — *motivo:*

- **O quê:** eleger **1 ação herói** (provável: "Entrada por IA"), rebaixar as demais a linhas consistentes e **agrupar por natureza** (Capturar / Planejar / Ferramentas). Manter todas as ações (ÂNCORA 9 — hierarquia, não remoção). *Já houve reorg parcial na 0.99.50; isto fecha o trabalho.*
- **Por que fazer:** o menu tem ~9 ações (Material 3 recomenda 3–6) e **3 cards grandes competem** pelo "caminho primário" com visuais diferentes — o usuário relê tudo sob pressa (Lei de Hick).
- **Impacto pro usuário:** decidir **mais rápido**, com menos leitura; fica óbvio qual é o caminho principal. Bom pro uso "uma mão, com pressa".
- **Esforço:** M · **Risco:** Médio (mexe no componente mais usado) · **Área:** FAB · **Origem:** Audit B-3 / F-1 / F-2 / D / G4.

### M08 · "+" do FAB não-mudo + recência · P2

**Decisão:** `( ) FAZER`   `(x ) NÃO`   `( ) DEPOIS`  — *motivo:*

- **O quê:** dar um **micro-rótulo/âncora ao "+"** (ex.: "Registrar") e fazer a **1ª ação ser a que o usuário mais usa** (memória de recência).
- **Por que fazer:** o "+" é um *affordance* sem *signifier* — não diz o que produz; o usuário "descobre" toda vez (problema X3).
- **Impacto pro usuário:** menos hesitação na porta de captura mais frequente; o app parece **mais rápido e pessoal** (a ação certa já está na mão).
- **Esforço:** S · **Risco:** Baixo · **Área:** FAB · **Origem:** Estudo EXP-3 / X3 (complementa M07).

### M09 · Chip persistente de contexto/modo · P2

**Decisão:** `(x ) FAZER`   `( ) NÃO`   `( ) DEPOIS`  — *motivo:*

- **O quê:** um chip sempre visível dizendo o contexto atual ("Dia a dia" / "Viagem: Lisboa") e **explicar ausências** quando uma tela some por causa do modo (o Planner já faz isso com empty-state — replicar o padrão).
- **Por que fazer:** "modo" é um conceito do **sistema**, não do usuário; ele nem sempre sabe em qual está nem por que algo sumiu (problema X2). Parece bug.
- **Impacto pro usuário:** sempre sabe "onde está", para de achar que o app quebrou; transições viagem↔dia a dia ficam compreensíveis.
- **Esforço:** S · **Risco:** Baixo · **Área:** global (header) · **Origem:** Estudo EXP-3 / X2.

### M10 · 1 ação primária por estado no Dashboard · P2

**Decisão:** `( ) FAZER`   `( ) NÃO`   `( ) DEPOIS`  — *motivo:*

- **O quê:** eleger **uma** ação primária por estado do Dashboard e rebaixar as secundárias (hoje o topo pede 3–4 decisões juntas: trocar viagem, ler alerta, check-in, "Abrir saída").
- **Por que fazer:** "uma coisa por vez" reduz a carga cognitiva no momento de maior densidade (a primeira tela).
- **Impacto pro usuário:** sabe **o que fazer agora** sem pesar 4 opções; sensação de direção em vez de "painel de avião".
- **Esforço:** M · **Risco:** Médio (combinar com M03/M04) · **Área:** Dashboard · **Origem:** Audit B-2 / D-2.  
  
não precisa tirar tudo até pq elas n ficam todas ao mesmo tempo

### M11 · `aria-current` + reforço não-cromático na aba ativa · P2

**Decisão:** `(x ) FAZER`   `( ) NÃO`   `( ) DEPOIS`  — *motivo:*

- **O quê:** marcar a aba ativa com `aria-current="page"` e um reforço **não só por cor** (peso/indicador), já que hoje é comunicada só por terracota (4.39:1).
- **Por que fazer:** "não usar cor sozinha" (WCAG 1.4.1) + o estado ativo não é anunciado a leitores de tela (4.1.2).
- **Impacto pro usuário:** daltônicos e leitores de tela passam a saber **em que aba estão**; reforço visual ajuda todo mundo.
- **Esforço:** XS · **Risco:** Baixo · **Área:** nav inferior · **Origem:** Audit A-3 / F / N4.

### M12 · Tokenizar + documentar o acento de IA · P2

**Decisão:** `(x ) FAZER`   `( ) NÃO`   `( ) DEPOIS`  — *motivo:*

- **O quê:** transformar o índigo/violeta de IA em tokens (`--ai`, `--ai-2`), validar contraste no tema claro e **documentar no design-system** ("terracota = marca; índigo = IA").
- **Por que fazer:** existe uma 2ª família de acento (ex.: "Escanear", "Entrada por IA") **não documentada e hard-coded** — inconsistência (heurística #4) e risco no tema claro (não herda).
- **Impacto pro usuário:** o significado das cores fica **previsível** ("roxo = é coisa de IA"); consistência aumenta a confiança. Evita cor quebrada no tema claro.
- **Esforço:** S · **Risco:** Baixo · **Área:** global/tema · **Origem:** Audit A-4 / E / N3 / G-2.

### M13 · Affordance de "Opcional/Essencial" + cadeado (Planner) · P2

**Decisão:** `(x ) FAZER`   `( ) NÃO`   `( ) DEPOIS`  — *motivo:*

- **O quê:** microcópia/tooltip de 1 linha para as tags "Opcional/Essencial" e o cadeado; estado desabilitado **com motivo** ("bloqueado: essencial") em vez de stepper cinza sem explicação.
- **Por que fazer:** Jordan (1ª viagem) não sabe o que o cadeado faz nem por que um controle está cinza (problema P-1) — parece bug/limitação.
- **Impacto pro usuário:** entende o que pode/não pode mexer e **por quê**; menos medo de usar o Planner.
- **Esforço:** S · **Risco:** Baixo · **Área:** Planner · **Origem:** Audit C-2 / P-1.

### M14 · Metadados de Gastos truncados/apagados · P2

**Decisão:** `( ) FAZER`   `( ) NÃO`   `(x ) DEPOIS`  — *motivo:*

- **O quê:** priorizar **2 metadados** por linha (e mover o resto ao detalhe) + subir contraste (depende de M02). Hoje: "categoria · hora · fundo · método" em `faint` e **truncado** ("Fundo Burgos + …").
- **Por que fazer:** perde informação **e** legibilidade na lista mais consultada do app (persona Casey, de relance).
- **Impacto pro usuário:** lê o essencial de cada gasto **num relance**, sem abrir; lista mais limpa.
- **Esforço:** S · **Risco:** Baixo · **Área:** Gastos · **Origem:** Audit C-3 / G-1.

### M15 · Consolidar `/viagem` × `/trip` (1 mapa + 1 editor) · P2

**Decisão:** `(x ) FAZER`   `( ) NÃO`   `( ) DEPOIS`  — *motivo:*

- **O quê:** unificar as duas superfícies de "viagem" (`/viagem` Hub e `/trip` Overview/edit/funds/planner) em **1 mapa + 1 editor** claros.
- **Por que fazer:** sobreposição herdada (G7) gera dúvida de "qual é a tela da viagem?" e inconsistência (heurística #4).
- **Impacto pro usuário:** um lugar previsível pra ver/editar a viagem; menos "me perdi entre telas parecidas".
- **Esforço:** **G** · **Risco:** **Alto** (mexe em rotas/navegação — exige plano próprio) · **Área:** Viagem · **Origem:** Audit C-5 / G7 / V-2.

### M16 · Reduzir a "parede de cards" do Copiloto · P2

**Decisão:** `( ) FAZER`   `( ) NÃO`   `(x ) DEPOIS`  — *motivo:*

- **O quê:** mostrar **2–3 insights-chave + "ver mais"** em vez de empilhar todos (Retrospectiva, Agora, Ontem, Amigo sincero, No total, Sequência…). O carrossel do "Amigo sincero" já é um bom padrão a seguir.
- **Por que fazer:** densidade alta (G3) cansa e dilui o que importa (heurística #8).
- **Impacto pro usuário:** vê o insight relevante **primeiro**, sem rolar uma parede; o Copiloto vira mais "conselheiro", menos "mural".
- **Esforço:** M · **Risco:** Médio · **Área:** Copiloto · **Origem:** Audit C-6 / G3 / C-1. **Não quebrar:** tom, streaks e "Amigo sincero" (coração emocional).  
  
  
Amigo sincero está com o cofrinho dentro dele, o cofrinho é dos insights.  
  
o amigo sincero n estou gostando dos textos, ainda n está legal mesmo selecionando no settings para ele ser amigo sincero, escrachado ele n vai, e nem sinto a diferenca entre os texto, fazer textos mais amigo sincero mesmo.

### M17 · "O fim que dá orgulho" (fechamento) · P2

**Decisão:** `(x ) FAZER`   `( ) NÃO`   `( ) DEPOIS`  — *motivo:*

- **O quê:** um **fechamento** de dia / rolê / viagem com resumo caloroso ("gastou €X, ficou €Y abaixo do plano, dividiu certinho") + micro-deleite sóbrio nos picos (cabe! / acertado! / melhor compra!).
- **Por que fazer:** a memória de uma experiência é dominada pelo **pico e pelo fim** (Peak-End, Kahneman). O app captura e planeja, mas **não tem um "fim" desenhado** — perde a chance de marcar positivamente.
- **Impacto pro usuário:** termina cada ciclo com **orgulho/alívio** em vez de "só parou"; é o que gera recomendação espontânea e retorno.
- **Esforço:** **G** · **Risco:** Médio (feature de experiência nova) · **Área:** Dashboard/Viagem/Saídas · **Origem:** Estudo EXP-4 / Necessidade latente #2.

### M18 · Saldo da divisão sempre legível + selo "tudo acertado" · P2

**Decisão:** `(x ) FAZER`   `( ) NÃO`   `( ) DEPOIS`  — *motivo:*

- **O quê:** garantir que, no fluxo de dividir, o estado **"você recebe €X / você deve €Y"** esteja sempre legível, e marcar um **"tudo acertado ✓"** explícito quando zera.
- **Por que fazer:** a divisão é onde mora a **confiança social** (persona Sam, job J3); ambiguidade sobre "quem deve quanto" vira atrito entre amigos.
- **Impacto pro usuário:** dividir e acertar **na frente do grupo** sem desconfiança; o "fim" da divisão (que fica na memória de todos) é positivo.
- **Esforço:** M · **Risco:** Médio · **Área:** Split/Acertos · **Origem:** Estudo §5.4 / §8 (necessidade latente #4). *Hipótese — validar (ver §validação).*

---

# P3 — Polimento (incremental)

### M19 · Trocar `transition: all` por propriedades específicas · P3

**Decisão:** `(x ) FAZER`   `( ) NÃO`   `( ) DEPOIS`  — *motivo:*

- **O quê:** substituir `transition: all` (8 arquivos) por transições de propriedades específicas (transform/opacity/color).
- **Por que fazer:** `transition: all` é anti-padrão do **próprio design-system** do app (custo de performance, animações acidentais).
- **Impacto pro usuário:** animações mais previsíveis e leves; menos jank em telas densas. (Imperceptível individualmente, mas é higiene.)
- **Esforço:** S · **Risco:** Baixo · **Área:** global · **Origem:** Audit A-5 / N5.

### M20 · Botão "Dados de demonstração" legível · P3

**Decisão:** `(x ) FAZER`   `( ) NÃO`   `( ) DEPOIS`  — *motivo:*

- **O quê:** dar a ele peso de botão secundário (borda/`surface-container`, texto ≥`on-surface-dim`); hoje parece **desabilitado**.
- **Por que fazer:** Jordan pode não perceber que é clicável (W-1) e perder a melhor forma de explorar sem compromisso.
- **Impacto pro usuário:** mais gente experimenta o app via demo antes de criar viagem → melhor 1ª impressão.
- **Esforço:** XS · **Risco:** Baixo · **Área:** Welcome · **Origem:** Audit C-1 / W-1.

### M21 · Defaults do Conversor + placeholder · P3

**Decisão:** `(x ) FAZER`   `( ) NÃO`   `( ) DEPOIS`  — *motivo:*

- **O quê:** abrir com **Para = moeda de casa** (não EUR→EUR) e placeholder claro ("ex.: 2,50") com contraste melhor (hoje "0" em `faint` parece já preenchido).
- **Por que fazer:** abrir convertendo para a mesma moeda é um passo morto (T-1); placeholder "0" confunde (T-2).
- **Impacto pro usuário:** conversor **já útil no 1º toque**, sem ter que trocar moeda nem apagar o "0".
- **Esforço:** S · **Risco:** Baixo · **Área:** Conversor · **Origem:** Audit C-4 / T-1 / T-2.

### M22 · Pílula "Manual" do Planner com rótulo · P3

**Decisão:** `(x ) FAZER`   `( ) NÃO`   `( ) DEPOIS`  — *motivo:*

- **O quê:** rotular a pílula "Manual" com contexto ("Modo: manual").
- **Por que fazer:** sem rótulo, o usuário não sabe o que aquela pílula significa (P-2).
- **Impacto pro usuário:** entende o estado do Planner num relance.
- **Esforço:** XS · **Risco:** Baixo · **Área:** Planner · **Origem:** Audit P-2.

### M23 · Welcome "value-first" · P3

**Decisão:** `(x ) FAZER`   `( ) NÃO`   `( ) DEPOIS`  — *motivo:*

- **O quê:** preencher o vazio do topo do Welcome com **1 linha de benefício concreto** (além de "seu copiloto de orçamento").
- **Por que fazer:** estado vazio que **converte/ensina** > estado que só informa (W-2).
- **Impacto pro usuário:** entende o valor do app **antes** de criar conta/viagem.
- **Esforço:** XS · **Risco:** Baixo · **Área:** Welcome · **Origem:** Audit W-2.

### M24 · Resiliência visível ("funciona offline") · P3

**Decisão:** `(x ) FAZER`   `( ) NÃO`   `( ) DEPOIS`  — *motivo:*

- **O quê:** tornar perceptível, num selo discreto onde fizer sentido, que o app **não trava** offline / quando a IA cai (já é verdade no código — só não é comunicado).
- **Por que fazer:** a resiliência (cooldown honesto, OCR gracioso, ferramentas 0-token offline) é um **traço de marca** que hoje fica invisível.
- **Impacto pro usuário:** tranquilidade no mercado/viagem internacional ("posso usar mesmo sem rede").
- **Esforço:** S · **Risco:** Baixo · **Área:** global (pontual) · **Origem:** Estudo EXP-5.

### M25 · Microcópia de captura no Comparador-foto · P3

**Decisão:** `(x ) FAZER`   `( ) NÃO`   `( ) DEPOIS`  — *motivo:*

- **O quê:** uma linha que ensine a **fotografar a etiqueta de preço** (não o produto inteiro) para subir a taxa de acerto da leitura.
- **Por que fazer:** a leitura por foto (V2, 0.99.50) acerta mais com a etiqueta enquadrada; o selo "confira" já protege contra erro, mas prevenir é melhor.
- **Impacto pro usuário:** menos linhas marcadas "confira", veredito confiável mais rápido no mercado.
- **Esforço:** XS · **Risco:** Baixo · **Área:** Comparador · **Origem:** Estudo §5.5.

---

## Não mexer (protegido — contexto pra decisão)

Estes **não são mudanças** — são o que as duas passadas pediram para **preservar** ao mexer no resto:

- Sistema de movimento (60fps, `prefers-reduced-motion`), tokens de tema, `tabular-nums`, nav "glass".
- **Guia** (`/guide`) + **Central de Ajuda** (`/help`) — o modelo de clareza do app (Nielsen #10 = 4/4).
- **Voz de marca** calorosa e anti-culpa, **streaks**, **"Amigo sincero"** — coração emocional.
- Definições inline já existentes; modo **simples/completo**; as 4 portas do Welcome.
- A honestidade da matemática (empate técnico, recusa de dimensões mistas, idade da cotação, cooldown honesto).

## Perguntas que mudam a prioridade (decida junto)

1. **Vamos publicar como app "acessível" (loja/distribuição)?** Se sim, **M01/M02/M11 sobem para P0** (a11y vira requisito, não polimento).  
ainda não.
2. **Existe sinal de abandono no primeiro minuto?** ⚠️ **A telemetria DEC-248 não responde isso hoje** (não há funil de sessão; ver "Validação" abaixo). Proxy grosseiro possível: install com `active_days=1` e `expenses=0`. Para medir de verdade, falta instrumentar (ver §C da Validação). Se houver sinal, **M03+M04+M10 ("Primeiro Minuto") viram prioridade única.**  
**ainda não sei, mas não gosto da tela de inicio com varias opções, não sei, o user acabou de chaegar, ele la sabe o que é backup e outras coisas? mas precisamos dessas coisas..** e modo demonstração deveria ir junto com o backup, para algum lugar mais escondido, para a tela inicial fiucar mais limpa..  
  
e atualizar a UI, para ficar mais bonita também a tela.  

3. **M15 (consolidar `/viagem`×`/trip`) é estrutural/alto risco** — só entra se você topar um plano próprio com migração de rotas. Quer manter como candidato ou descartar?  
quero manter e fazer pode juntar.  

→ **DECIDIDO (Julio, 2026-06-24): fazer a consolidação.** Share card vai pro **header** da aba Viagem (escolha do Julio). Plano técnico pronto em **"Apêndice — Plano de migração M15"** (no fim do doc).  

4. **M17/M18 são hipóteses de experiência** — vale rodar uma validação barata (teste com 5 usuários + "emotion check") antes de construir? (ver abaixo)  
→ **Veredito 2026-06-24 (§B da Validação):** **M17 = validar antes** (feature nova de fechamento; nada igual existe hoje). **M18 = construir a parte de legibilidade** (melhora de baixo risco no Split já existente) **+ validar só o selo "tudo acertado"** (a parte-hipótese). *Aguardando seu ok pra qual caminho.*

## Como validar barato o que for marcado "FAZER" (opcional)

- **Teste com 5 usuários** (NN/g) em 3 tarefas: registrar um gasto; "posso gastar X?"; "qual produto vale mais?". 5 pessoas revelam ~85% dos problemas.
- **First-click test:** "onde você tocaria pra saber quanto pode gastar hoje?" (valida M04).
- **5-second test no Dashboard:** mede clareza do primeiro olhar (valida M03/M04/M10).
- **Telemetria que já existe (DEC-248):** ⚠️ **corrigido em 2026-06-24** — a telemetria atual **NÃO** mede Simulador/Comparador/FAB-por-ação nem captura concluída × abandonada (esses counters não existem no código). Ela mede adoção estrutural (trips/expenses/outings/splits/…), flags de uso (usesAI/usesSplit/…) e retenção (DAU/WAU/`active_days`). Ver a seção **"Validação — rodada 2026-06-24"** abaixo para o que dá pra extrair hoje e o que falta instrumentar.

---

> **Sugestão de pacote inicial** (se quiser um caminho default): marcar **M01, M02, M03, M11** como primeiro pacote ("Legibilidade & A11y" — tudo XS/S, risco baixo, alcance global) e **M04, M06, M05** como segundo ("Primeiro Minuto & Clareza"). São os de maior impacto por menor risco. Mas a decisão é sua, item a item, acima.

---

## Validação — rodada 2026-06-24 (resultados)

> Executada inline (1 request, sem subagents). **Como rodei:** tentei o dado real (telemetria DEC-248) → dois bloqueios (acesso por `ADMIN_TOKEN`; e cobertura — ela não mede os fluxos certos). Então rodei um **cognitive walkthrough especialista** sobre o código real de cada tela: um *proxy* dos testes de usabilidade que pega boa parte dos mesmos problemas, mas **não substitui** 5 usuários para emoção/surpresa. Vereditos heurísticos vêm com confiança; o que depende de dado humano está sinalizado.

### A. O que a telemetria DEC-248 realmente mede — VERIFIED (código)

Heartbeat estrutural/cumulativo (1/dia/install), **não** um funil de eventos.

- **Mede hoje:** counters `trips, expenses, outings, splits, settlements, plannedPurchases, wallets, participants, connections, aiEntries, receiptScans, crashes`; flags `usesAI, usesReceiptOcr, usesSplit, usesWallets, usesLocation, usesAppLock, isNative`; retenção (DAU/WAU/MAU, `active_days`), plataforma/versão/browser/locale; AI tokens por função; erros (dedupe por hash).
- **NÃO mede:** ❌ Simulador/Comparador (abertura/uso) · ❌ FAB por ação · ❌ captura concluída × abandonada (só conta as concluídas) · ❌ abandono no 1º minuto (sem sessão/funil) · ❌ termos que levam à Ajuda.
- **Acesso:** dados no Worker Cloudflare (DO SQLite) atrás de `/admin` + `ADMIN_TOKEN`. Pra puxar: me passar URL+token, **ou** colar o painel `/admin`, **ou** eu tentar via Cloudflare MCP (se as credenciais estiverem configuradas).

### B. Veredito por item (walkthrough especialista — proxy)

| Item | Achado (código real) | Veredito | Confiança |
|---|---|---|---|
| **M03** banners | "demo + backup" **parcialmente desatualizado**: o lembrete de backup já saiu da home (DEC-176). No topo ainda podem empilhar: banner de **demo**, aviso de **localização** e aviso de **storage** (Web, fora do demo). Direção do Julio: esconder demo+backup juntos, home mais limpa e bonita. | **Construir** (esconder demo+backup; condicionar o resto; polish) | HIGH |
| **M04** "Livre hoje €X" | O número **já existe e é calculado** (`freeTodayCents`): "Livre hoje" (modo simples) e "Livre para usar nesta fase" (cards). Nota l.103 procede: novo número no topo **duplica**. | **Ajustar escopo:** promover/fundir o existente + 1 linha de razão + atalho "posso gastar?" (abre o Simulador, que já responde). First-click antes. | MED-HIGH |
| **M06** "€0 da fase" | Microcópia + condição, isolado. | **Construir direto** | HIGH |
| **M10** 1 ação primária | Nota l.163 procede: topo é **condicional**, não simultâneo. Casa com a direção do M03. | **Validar (5-second) + ajustar**, junto de M03/M04 | MED |
| **M15** /viagem×/trip | **DECIDIDO (Julio): fazer.** Sobreposição real; a tela que sai só tem 1 conteúdo exclusivo (share card → **header**); redirect já é padrão. | **Fazer como pacote isolado** → ver Apêndice | DECIDIDO |
| **M16** Copiloto | São **2 problemas**: densidade de cards **e** os **textos do "Amigo sincero"** (notas l.220-222: voz/conteúdo, não layout). | **Separar:** M16 = densidade; abrir item próprio pros textos do Amigo Sincero | MED |
| **M17** "fim que dá orgulho" | Não existe tela de fechamento hoje — feature nova (G). | **Validar antes de construir** (emotion-check + conceito) | Recomendação HIGH |
| **M18** saldo da divisão | Split já existe; legibilidade = baixo risco; "tudo acertado" = a parte-hipótese. | **Construir a legibilidade** + **validar o selo/emoção** | MED-HIGH |

### C. Instrumentação que falta (pra telemetria responder as perguntas)

Tudo NON-MONETARY (contrato DEC-248). Entra em `TelemetryCounts` + `TELEMETRY_COUNTERS` (Worker) + pontos de `bump`:

- `simulatorOpens`, `comparatorOpens` — uso das ferramentas (M04/M16).
- `fabActions` por tipo — qual porta do "+" (M07/M08).
- `captureStarted` × `captureCommitted` (por canal: ai/ocr/manual) — concluída × abandonada.
- 1º minuto: `timeToFirstExpense` (bucket) ou flag `firstExpenseSameDay` — proxy de abandono inicial.
- `helpOpens` por termo — termos que levam à Ajuda (M05).

→ **Pacote de implementação próprio** (pequeno; cliente + Worker). Sem ele, "Primeiro Minuto" (Q2) e uso de ferramentas seguem **sem dado real**.

### D. Kit pronto pra rodar (quando quiser dado humano)

- **5 usuários (moderado), 3 tarefas** — sucesso = conclui sem ajuda; medir tempo, toques errados, 1 emoji (😟/😐/🙂) no fim:
  1. "Registre um gasto de €12 no almoço." (captura/FAB)
  2. "Veja quanto pode gastar hoje sem furar o plano." (M04 — *first-click*: 1º toque deve cair no número/atalho do topo)
  3. "Tem 2 marcas de arroz; veja qual compensa." (Comparador)
- **5-second test** (M03/M04/M10): mostrar 5s → "qual o número mais importante? o que o app quer que você faça?". Passa se ≥4/5 citarem o "livre/posso gastar".
- **Conceito + emotion-check do M17:** mock do fechamento → "como se sente?" (1-5 + 1 palavra). Construir só se média ≥4.

---

## Apêndice — Plano de migração M15 (consolidar `/viagem` × `/trip`)

> **Decisão:** Julio aprovou (2026-06-24) — *"quero manter e fazer, pode juntar"*. Share card → **header** da aba Viagem. **Status:** plano pronto; execução pendente do "vai".

**Meta:** 1 mapa (aba `/viagem` = `TripHubPage`) + 1 editor (`/trip/edit` = `TripEditPage`). Aposentar `/trip` (`TripOverviewPage`) com redirect.

**Passos (ordem segura — cada etapa é reversível e testável):**

1. **Mover o share card** de `TripOverviewPage` → header do `TripHubPage` (ícone `ios_share`, canto direito). Reusar `buildShareCardStats` + `renderShareCard` + `deliverShareCard` (já existem; o cálculo do card é autocontido).
2. **Redirect** em `router.tsx`: `/trip` → `<Navigate to="/viagem" replace />` (igual ao `/more`). `/trip/edit` fica intacto.
3. **Remover o tile "Visão geral da viagem"** de `structureItems` (`TripHubPage`) — deixaria de apontar pra si mesma. Manter "Editar fases" → `/trip/edit`.
4. **Apontar entradas diretas pra `/viagem`** (funcionam via redirect, mas limpar): Dashboard nome-da-fase + insight `phase_countdown`; Planner. As que usam `/trip/edit?occurrence=` ficam iguais.
5. **i18n:** aposentar/realocar `trip.overview_title`, `trip.overview_role_hint`, `trip_hub.overview_card`.
6. **Testes:** atualizar `e2e/navigation.spec.ts` e `boot-recovery.test.tsx` (hoje montam `TripOverviewPage` em `/trip`) + cobrir o redirect.
7. **Apagar** `TripOverviewPage.tsx` após o share card migrado.
8. **Polish (pedido do Julio: "ficar mais bonita"):** dar um tratamento visual no header do Hub + card de resumo ao consolidar.

**Atenção:** links órfãos pra `/trip` (mitigado pelo redirect) · não perder o share card (mover primeiro) · "total" do Hub usa trechos vs potes — manter · `phase-preview` segue acessível (já é sibling no Hub).

**Esforço/risco:** G/Alto vira **M controlado** por ser pacote isolado com redirect (padrão provado).

