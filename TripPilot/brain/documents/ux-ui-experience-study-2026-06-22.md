# Estudo de Experiência — UI, Fluxo, Usuário, Sensação, Intuição e Necessidade

> **Data:** 2026-06-22 · **Versão do app analisada:** 0.99.50
> **Status:** ESTUDO — documento para leitura/decisão. **Não altera código.**
> **Pedido do Julio:** *"fazer como o estudo do UX um estudo de UI, de fluxo, de usuário, de sensação, de melhorias, de intuição e necessidade — entender como o app deveria ser, o que os usuários podem encontrar de problemas, o que eles gostariam que fosse diferente."*
> **Complementa (não repete):** `ux-audit-round2-2026-06-22.md` (a11y, contraste, foco de teclado, heurística, evidência medida). Aquele documento responde *"o app está acessível e correto?"*. **Este** responde *"o app é intuitivo, faz sentido para a cabeça do usuário e produz a sensação certa?"*.

---

## 0. TL;DR — o que ler se você só tem 3 minutos

1. **O app é tecnicamente sólido e honesto, mas pede mais "aprendizado" do que o usuário de mercado/viagem quer dar.** O modelo mental do usuário é simples ("quanto posso gastar agora sem me ferrar?"); o app expressa isso com muitos conceitos (fases, potes, livre da fase, livre diário, dia a dia, cenários). A ponte entre os dois é o maior trabalho de UX pendente.
2. **A maior alavanca não é adicionar — é *traduzir e sequenciar*.** As features certas já existem. O ganho está em (a) **uma frase de cabeçalho** que responda a pergunta-âncora em 3s, (b) **um primeiro minuto guiado** e (c) **vocabulário humano** sobre os conceitos financeiros.
3. **A sensação dominante hoje oscila entre "controle" e "dúvida".** Onde o app diz um número claro com uma razão ("cabe: sobra X"), ele gera alívio. Onde mostra um conceito sem explicar ("Livre da fase: €0"), gera ansiedade. **Honestidade já é um ativo** (empate técnico, recusa de comparar peso×unidade, selo de idade da cotação) — falta torná-la *calorosa*, não só correta.
4. **Intuição falha em 3 pontos previsíveis:** o **FAB** (porta de captura escondida atrás de um "+"), os **modos** (viagem vs dia a dia — quando estou em qual?) e o **planejador** (cenários é poderoso, mas "abrir não grava" precisa ser sentido, não só verdadeiro).
5. **Recomendação central (síntese do conselho):** adotar um **north-star de "uma mão, 3 segundos, sem ansiedade"** e atacar **Primeiro-Minuto + Pergunta-Âncora + Vocabulário** antes de qualquer feature nova. É o que mais muda a percepção por real investido.

---

## 1. Método e lentes (como estudei)

Não houve teste com usuários reais nesta rodada (ver §15 — honestidade). O estudo combina:

- **Leitura do código real** (telas, domínio, i18n, FAB, fluxos de IA/foto/voz) — para descrever o app *como ele é*, não como imagino.
- **Evidência medida herdada** do `ux-audit-round2` (contraste, alvos de toque, foco) — reuso, não repito.
- **5 lentes de experiência**, cada uma com uma pergunta-guia:
  1. **Usuário / JTBD** — *que "trabalho" a pessoa contrata o app para fazer?*
  2. **Fluxo** — *a tarefa flui do início ao fim sem o usuário parar para pensar "e agora?"*
  3. **Sensação (look & feel + tom)** — *o que a pessoa sente em cada momento? alívio? culpa? confiança?*
  4. **Intuição / descoberta** — *dá para adivinhar onde tocar e o que vai acontecer, sem ler manual?*
  5. **Necessidade (manifesta e latente)** — *o que ela precisa de verdade — inclusive o que não sabe pedir?*
- **Frameworks de apoio (fontes em §16):** Jobs-to-be-Done (Christensen/Klement), Signifiers & Mapeamento (Norman, *Design of Everyday Things*), 10 heurísticas (Nielsen), Lei de Hick (custo de escolha), Lei de Fitts (alvo/distância), Progressive Disclosure e Peak-End Rule (Kahneman).

> **Confiança:** descrições do app = **ALTA** (vêm do código). Comportamento/emoção do usuário = **hipóteses MED/LOW** marcadas como tal — são para *validar barato* (§14), não para tratar como fato.

---

## 2. Quem usa e por quê — JTBD, momentos e personas

### 2.1 Os "trabalhos" (Jobs-to-be-Done)
O app é contratado para **3 trabalhos** distintos — e a tensão de UX vem de servir os 3 na mesma casca:

| # | Job (na voz do usuário) | Momento | Emoção alvo | Onde o app entrega hoje |
|---|---|---|---|---|
| **J1** | *"Me diz se eu posso gastar isso agora sem estourar."* | No balcão, **em segundos**, uma mão | Alívio / permissão | Simulador, "livre", QuickAdd |
| **J2** | *"Registra rápido o que gastei pra eu não perder a conta."* | Logo após pagar | Quitação / dever cumprido | QuickAdd, voz, foto/OCR, FAB |
| **J3** | *"Me ajuda a planejar e a dividir com os outros sem briga."* | Em casa / fim do rolê | Controle / justiça | Planejador, Split, acertos, reembolso |

**Insight:** J1 e J2 são **diários, ansiosos e rápidos** (uma mão, 3s). J3 é **ocasional, reflexivo e tolerante a complexidade** (duas mãos, sentado). Hoje a interface trata os três com densidade parecida. **A experiência melhora muito se J1/J2 forem radicalmente mais leves que J3.**

### 2.2 Momentos de uso (o contexto manda)
- **No mercado (dia a dia):** uma mão, carrinho na outra, pressa, luz ruim, talvez offline. → favorece **voz, foto, números grandes, 1 toque**. É exatamente o palco do **Comparador** (V2 agora lê foto) e do Simulador.
- **Depois de pagar (viagem):** 10 segundos antes de guardar o celular. → favorece **captura sem fricção** e confirmação que *some sozinha*.
- **No fim do dia/rolê:** "gastei demais?" → favorece **um placar glanceável** e a **divisão** justa.
- **Em casa, planejando:** café na mão. → favorece **cenários, potes, projeções** — aqui complexidade é bem-vinda.

### 2.3 Personas (curtas, ancoradas nos momentos)
- **Jordan — primeira viagem, ansioso.** Quer permissão e alívio. Medo: "não entendo esses termos, será que tô fazendo certo?".
- **Casey — usuário de dia a dia, mercado.** Quer velocidade e um veredito. Medo: "isso vai me fazer digitar muito".
- **Sam — divide com amigos.** Quer justiça e prova. Medo: "vai dar treta na hora de acertar".
- **Robin — planejador.** Curte cenários e potes. Não é o gargalo de UX — é quem mais perdoa complexidade.

---

## 3. Modelos mentais — o app pensa como o usuário pensa?

O usuário tem um modelo **simples e único**: *uma bolsa de dinheiro que esvazia*. Ele pensa em **"quanto sobra"**, **"até quando"** e **"com quem divido"**.

O app introduz um modelo **mais rico**: viagem com **fases**, **livre da fase**, **livre diário**, **potes/cofrinho (early-spend)**, **cenários** e dois **modos** (viagem × dia a dia). É um modelo *melhor* para planejar — mas **mais caro de aprender**.

**Onde casa bem (manter):**
- "Disponível agora / livre diário" mapeia direto no "quanto posso gastar" — é a tradução certa do J1.
- Reservar para um evento (pote) mapeia em "separei esse dinheiro" — metáfora física forte.

**Onde diverge (atenção):**
- **"Livre da fase: €0"** é tecnicamente correto e emocionalmente assustador. O usuário lê "estou quebrado" mesmo quando só significa "esta fase está toda alocada". → precisa de **frase de tradução** ("Você planejou tudo desta fase; o gasto sai do próximo dia/pote").
- **Dois modos (viagem × dia a dia):** o usuário nem sempre sabe *em qual está* nem *por que algumas telas somem* (ex.: planejador bloqueado no dia a dia). Modo é um conceito do sistema, não do usuário. → **sinalizar o modo de forma persistente e explicar a ausência** (o app já faz isso no planejador com empty-state — ótimo padrão a replicar).
- **Cenários (planejador):** "abrir não grava" foi resolvido tecnicamente (DEC-274). Mas o usuário não *sente* essa garantia — ele teme mexer. → precisa de **sinal explícito** ("nada é salvo até você confirmar").

> **Princípio (Norman — mapeamento):** quando o modelo do sistema é mais rico que o do usuário, a UI tem que **traduzir continuamente**, não só **expor** os conceitos.

---

## 4. A curva emocional (onde o app gera alívio × ansiedade)

Mapeando a emoção ao longo do uso (hipóteses MED — validar com "emotion check", §14):

```
ALÍVIO  ▲                       ┌─ "cabe: sobra €X" (Simulador) 
        │      ┌─ captura ok ─┐  │        ┌─ veredito comparador ("A vale +17%")
        │  ┌──┘               └─┐│      ┌─┘
 neutro ┼──┘ primeiro toque      └┴─────┘
        │        no FAB ("o que é isso?")     
        │   ┌─ "Livre da fase: €0" (susto)
ANSIEDADE▼──┘            └─ termos sem explicação · cenários "será que salvei?"
        └───────────────────────────────────────────────► tempo
```

**Leitura:**
- **Picos de alívio** acontecem onde o app **dá um número + uma razão**: Simulador ("cabe, sobra X porque…"), Comparador ("A vale mais, ~17%/kg"), captura que confirma e some. **É a assinatura emocional certa do produto — replicar o padrão "número + porquê" em todo lugar.**
- **Vales de ansiedade** acontecem em **conceitos crus** (livre €0), **dúvida de ação** (cenários, "isso gravou?") e **primeiro toque** (FAB sem rótulo do que faz).
- **Peak-End (Kahneman):** a memória de uma sessão é dominada pelo **pico** e pelo **fim**. Hoje o app não tem um **"fim" desenhado** (ex.: fechamento do dia/rolê/viagem com um resumo que dê orgulho). → **maior oportunidade de sensação** (ver §8 e §9).

---

## 5. Mapa de fluxos (ponta a ponta) com fricção e emoção

Para cada fluxo: passos → fricção → emoção → técnica de correção. Foco nos fluxos que mais pesam (J1/J2) e nos ocasionais que mais marcam (J3, recuperação).

### 5.1 Primeiro minuto (onboarding → primeira captura)
- **Passos:** Welcome → criar viagem/ativar dia a dia → cair no Dashboard → (?) achar como registrar/perguntar.
- **Fricção:** o salto do "criei" para o "e agora o que eu faço?" é abrupto; o Dashboard mostra estrutura (fases, livres) antes de o usuário ter **qualquer dado** — então mostra **zeros e conceitos**, o pior primeiro contato.
- **Emoção:** curiosidade → leve desorientação.
- **Técnica:** **primeira-execução guiada** (1 dica que aponta o FAB: "Toque + para registrar seu 1º gasto") + **estado vazio que ensina** (o Dashboard vazio deveria dizer *o que vai aparecer aqui e como começar*, não exibir €0 em conceitos). Fonte: NN/g *Empty States* + *First-Time UX*.

### 5.2 Loop diário de captura (J2 — o mais frequente)
- **Passos:** FAB → escolher (gasto/voz/foto/mercado…) → preencher/confirmar → some.
- **Fricção:** o FAB é uma **gaveta de 9 ações** atrás de um "+" sem rótulo (Lei de Hick: custo de escolha cresce com nº de opções; o usuário relê toda vez). A reorg recente (0.99.50: "Registrar mercado" promovido, comparador recolhido) ajuda — mas a **porta ainda é um '+' mudo**.
- **Emoção:** dever cumprido **quando** flui; hesitação **quando** tem que reler a grade.
- **Técnica:** (a) manter a **fila visível enxuta** (3–4 ações de maior valor) e o resto em "Mais ações" — já é a direção certa; (b) **memória de recência** (a 1ª ação = a que você mais usa); (c) considerar um **rótulo/àncora** no FAB ("Registrar") para o "+" não ser mudo. Fontes: Hick, Fitts (alvo grande no canto = bom), Material 3 FAB menu (3–6 ações).

### 5.3 "Posso gastar isso?" (J1 — o mais ansioso)
- **Passos:** Simulador → digita valor → vê veredito (cabe / aperta / arriscado / estoura) + fato.
- **Fricção:** ótimo **quando alcançado** — mas o Simulador **compete por descoberta** com QuickAdd dentro do FAB; o usuário no balcão pode não lembrar que ele existe.
- **Emoção:** **alívio** — é o pico positivo do app.
- **Técnica:** **elevar a pergunta-âncora ao Dashboard** (um campo "posso gastar ___?" ou um número glanceável "livre hoje: €X" no topo, sempre). Transformar o melhor momento do app no **primeiro** que a pessoa vê. Fonte: princípio de *Anchoring* + *Recognition over recall* (Nielsen #6).

### 5.4 Dividir a conta (J3 — marca a memória social)
- **Passos:** Split → participantes → itens/valor → quem paga → acerto (com método, DEC-277) → histórico.
- **Fricção:** poderoso, porém dual (split ao vivo × pós); o usuário pode não saber qual usar. O **acerto** (settlement) é onde mora a confiança — e ele está fundo no fluxo.
- **Emoção:** alívio de **justiça** quando o saldo zera; tensão se a UI parecer ambígua sobre "quem deve quanto".
- **Técnica:** garantir **estado de saldo sempre legível** ("você recebe €X / você deve €Y") e um **fim explícito** ("tudo acertado ✓"). Peak-End: o "fim" da divisão é o que fica na memória do grupo.

### 5.5 Ferramentas de balcão (Conversor + Comparador)
- **Passos:** abrir (FAB/IA/Guia) → input → veredito.
- **Fricção:** ambas são **leitura pura, 0 token, offline** — excelente para o contexto. O Comparador V2 agora **lê foto (multi-imagem)**: ótimo, mas a confiança da leitura é o ponto sensível.
- **Emoção:** **controle** ("não preciso fazer conta de cabeça").
- **Técnica (V2):** o padrão recém-implementado — **selo "confira" âmbar + revisão antes de confiar** — é exatamente o certo (honestidade calorosa). Reforçar com **microcópia** que ensine a tirar a foto da etiqueta (não do produto inteiro) para subir a taxa de acerto.

### 5.6 Recuperação (erros, offline, IA indisponível)
- **Passos:** IA estoura cota → cooldown honesto; foto sem rede → cai em manual; cotação velha → selo de idade.
- **Fricção:** **baixa** — o app degrada com graça (DEC-276 cooldown honesto, DEC-206 OCR gracioso, agora `/unit-extract` idem). **Isto é um diferencial de sensação** (o app não "quebra na sua mão").
- **Emoção:** confiança ("mesmo dando errado, ele me deixa seguir").
- **Técnica:** **dar nome a esse valor** — uma linha em algum lugar tipo "funciona offline" constrói marca. Não esconder a resiliência; ela é parte da personalidade.

---

## 6. Intuição e descoberta — dá para adivinhar?

**Teste de "primeiro clique" mental** (onde a pessoa tocaria para cada job, sem ler nada):

| Quer fazer | Toca onde espera | O app põe onde | Veredito |
|---|---|---|---|
| Registrar um gasto | um "+" grande | FAB "+" (ok) | ✅ adivinha |
| Saber se cabe | um campo "quanto posso?" no topo | dentro do FAB → Simulador | ⚠️ não óbvio |
| Comparar preços | algo no mercado/ferramentas | FAB → "Mais ações" (recolhido) | ⚠️ escondido (por decisão) |
| Trocar moeda | "conversor" | FAB grupo ferramentas + IA + Guia | ✅ múltiplas portas |
| Dividir | "dividir" | nav/Split | ✅ |
| Entender um termo | tocar no termo | tooltips (DEC-121) + Ajuda | ⚠️ depende do termo ter tooltip |

**Sinais (signifiers) que faltam (Norman):**
- O **"+"** é um *affordance* sem *signifier* do que produz. Um micro-rótulo ("Registrar") ou a 1ª ação pré-anunciada reduz o "o que tem aqui?".
- **Conceitos financeiros** (livre da fase, pote) carecem de **signifier de explicação** consistente (um "ⓘ" tocável em todo termo, levando ao artigo certo da Ajuda). A Central de Ajuda existe (FB-28) — falta o **gancho contextual** de cada termo até ela.
- **Modo atual** precisa de um *signifier* persistente (chip no header "Dia a dia" / "Viagem: Lisboa") para o usuário sempre saber o contexto.

**Naming (vocabulário):** termos de sistema ("fase", "livre da fase", "alocação", "cenário") são precisos mas técnicos. **Recomendação:** manter o termo curto + **sempre** acompanhar de uma **glosa humana** na primeira aparição ("Livre da fase — o que ainda dá pra gastar neste trecho da viagem").

---

## 7. Sensação (look & feel + tom de voz)

**O que o app já transmite bem:**
- **Calma visual** (tema escuro como primário, superfícies em camadas, motion contido com `prefers-reduced-motion`). É um app que *não grita* — adequado a dinheiro/ansiedade.
- **Honestidade** como traço de personalidade (empate técnico, recusa de comparar dimensões, idade da cotação, cooldown honesto). **Raro e valioso.**

**Onde a sensação pode subir:**
- **Tom da microcópia:** hoje correto, às vezes seco. Em momentos de **ansiedade** (livre €0, estouro no simulador), o tom deveria virar **tranquilizador e orientado a ação** ("Sem problema — dá pra puxar do pote X ou ajustar amanhã"), não só informativo.
- **Calor na vitória:** os picos (cabe! / acertado! / melhor compra!) merecem um **micro-momento de deleite** sóbrio (um respiro de cor/ícone), porque é o que a memória guarda (Peak-End). Sem exageros — alinhado ao tom calmo.
- **Consistência de acento:** o app tem cores de acento com significado (sucesso/aviso/primário). Garantir que **"o verde sempre quer dizer a mesma coisa"** (confiança previsível). O audit já apontou hard-codes a tokenizar — aqui o ângulo é *semântico*, não só técnico.

> **Princípio:** dinheiro é emocional. Um app financeiro que é **correto + calmo + caloroso** vence um que é só correto.

---

## 8. Necessidades latentes (o que falta e o usuário talvez não peça)

Hipóteses de necessidade (validar — §14), ordenadas por impacto na sensação:

1. **Um placar glanceável da pergunta-âncora.** "Quanto posso gastar hoje, sem pensar?" merece estar **sempre visível** (Dashboard/topo), em número grande, com 1 frase de razão. É a necessidade #1 e está "a 2 toques".
2. **Um "fim" desenhado (fechamento).** Fim do dia / do rolê / da viagem com um **resumo que dê orgulho** ("Você gastou €X, ficou €Y abaixo do plano, dividiu certinho"). Hoje o app captura e planeja, mas **não celebra o fechamento** — e é o que a memória guarda.
3. **Tradução viva dos termos.** Cada conceito financeiro com um "ⓘ" que abre a explicação certa. Reduz a ansiedade de "não entendo".
4. **Confiança no compartilhado.** Em J3, "todo mundo vê a mesma verdade" precisa ser *sentido* (estado de saldo sempre legível + selo "tudo acertado").
5. **Reforço de "funciona offline".** Tornar a resiliência **visível** vira tranquilidade (especialmente no mercado/viagem internacional).
6. **Recência/atalho pessoal.** A ação que **eu** mais uso deveria estar mais perto do polegar (memória de recência no FAB).

---

## 9. Como o app DEVERIA ser — visão north-star

Três princípios para guiar decisões (e dizer "não"):

### N1 — "Uma mão, 3 segundos, sem ansiedade" (para J1/J2)
Os jobs diários têm que ser **completáveis com o polegar, em 3s, sem reler nada**. Tudo que for diário e ansioso obedece a isso. O que for planejamento (J3) pode ser denso — em **outra "marcha"**.

### N2 — "Número + porquê, sempre" (a assinatura)
Todo veredito do app vem com **um número claro e uma razão curta**. É o que gera alívio (Simulador, Comparador já fazem). Padronizar isso é a maior alavanca de sensação.

### N3 — "Honesto e caloroso por padrão"
Manter a honestidade (não mentir números), **mas** com tom que tranquiliza e orienta à ação nos momentos ruins, e que celebra (sóbrio) nos bons. Honestidade sem calor é frieza; calor sem honestidade é engano — o app fica no cruzamento.

**Como isso muda telas concretas:**
- **Dashboard** abre com a **pergunta-âncora** respondida (N1+N2), não com a estrutura do plano.
- **Termos** sempre traduzidos (N3) com gancho para a Ajuda.
- **Modo** sempre sinalizado; ausências sempre explicadas (já é padrão no planejador).
- **Fechamentos** desenhados (Peak-End) — o "fim" que faltava.

---

## 10. Problemas que os usuários podem encontrar (catálogo)

Probabilidade × Impacto (hipóteses; P=prob, I=impacto, ambos A/M/B):

| # | Problema | P | I | Onde | Sintoma esperado |
|---|---|---|---|---|---|
| X1 | "Livre da fase: €0" lido como "estou quebrado" | A | A | Dashboard | ansiedade, desconfiança do app |
| X2 | Não sabe em que **modo** está / por que uma tela sumiu | M | A | global | confusão, sensação de bug |
| X3 | "+" mudo: relê a grade de ações toda vez | A | M | FAB | lentidão percebida, hesitação |
| X4 | Não acha o Simulador no balcão (está no FAB) | M | A | J1 | deixa de usar o melhor recurso |
| X5 | Teme mexer no planejador ("isso salvou?") | M | M | Cenários | evita a feature poderosa |
| X6 | Foto do comparador lê errado e ele não percebe | B | A | Comparador V2 | decisão errada de compra — **mitigado** pelo selo "confira" |
| X7 | Não entende termos (alocação, pote, livre diário) | A | M | global | abandono parcial, uso raso |
| X8 | Split: dúvida sobre "quem deve quanto" | M | A | Split | atrito social, desconfiança |
| X9 | Primeiro minuto sem rumo (zeros + conceitos) | A | A | Onboarding | desistência precoce |
| X10 | Foco de teclado invisível (a11y) | A | A | global | **ver audit round-2** (já catalogado) |

**Top 3 por P×I:** X1, X9, X7 — todos resolvidos por **tradução + sequência**, não por features.

---

## 11. O que os usuários gostariam que fosse diferente (hipóteses a validar)

Formulado como **desejos** (não fatos — validar em §14):

- *"Que ele já me diga, de cara, quanto eu posso gastar hoje."* → north-star N1, placar glanceável.
- *"Que eu não precise aprender termos pra usar."* → tradução viva.
- *"Que registrar fosse 1 toque e sumisse."* → loop de captura mais leve + recência.
- *"Que, no fim, ele me mostrasse como eu fui."* → fechamento (Peak-End).
- *"Que eu confie na divisão na frente dos amigos."* → saldo legível + selo "acertado".
- *"Que a foto do preço fosse à prova de erro."* → microcópia de captura + revisão (já há o selo).

---

## 12. Conselho estratégico (inline, nesta sessão — 1 request, sem subagentes)

_Rodado inline conforme a constituição de custo. Perspectivas escritas às cegas a partir do Brief; síntese ao final._

### Decision Brief (neutro)
O app TripPilot serve 3 jobs (decidir se pode gastar, registrar rápido, planejar/dividir) numa só casca. As features necessárias **já existem** e são tecnicamente sólidas e honestas. O problema relatado é de **clareza/intuição/sensação**: o modelo do sistema (fases, livres, potes, modos, cenários) é mais rico que o modelo simples do usuário ("quanto sobra?"). A pergunta: **onde investir esforço de UX para o app ficar "menos confuso, mais sleek e funcional" e produzir a sensação certa** — sabendo que adicionar conceitos custa simplicidade, e que J1/J2 são diários/ansiosos enquanto J3 é ocasional/tolerante. _Viés do chat a resistir: "implementar mais" — o pedido é entender e desenhar, não encher de features._

### Perspectivas (às cegas)

**Advocate (valor real ao usuário, simplicidade) —** O usuário quer permissão e alívio em segundos. Tudo que for diário tem que caber numa mão e responder "quanto posso gastar?" sem reler. O ganho mora em **traduzir** os conceitos (glosa humana + ⓘ) e em **elevar a pergunta-âncora** ao primeiro olhar. Não adicionar nada novo até o existente estar legível. **Rec:** Primeiro-Minuto + Pergunta-Âncora + Vocabulário. **Confiança:** ALTA. **Outros perdem:** que "livre €0" é um susto evitável só com uma frase.

**Architect (viabilidade, consistência) —** Quase tudo é **camada de apresentação**: microcópia, um header glanceável reusando números que o domínio já calcula, ⓘ ligando ao catálogo de Ajuda que já existe, e padronizar "número + porquê". Baixo risco, sem schema, sem worker. O risco é **espalhar exceções** (cada tela traduzindo do seu jeito) → precisa de **um componente/registro único** de "termo→glosa→artigo" e um de "veredito (número+razão)". **Rec:** investir num *kit de tradução/veredito* reusável. **Confiança:** ALTA. **Outros perdem:** que sem centralizar, a "tradução" vira dívida.

**Critic (modo de falha, ponto cego) —** O maior risco não é o app fazer pouco — é **parecer que faz pouco/errado** por confundir. "Livre €0", "+" mudo e modos invisíveis fazem o usuário desconfiar de um app **correto**. E há armadilha na direção oposta: encher o Dashboard de "ajudinhas" vira **ruído** e mata a calma que é um ativo. Qualquer tradução tem que ser **discreta e sob demanda** (ⓘ, não parágrafos). **Rec:** corrigir os 3 pontos de desconfiança (X1/X3/X2) com o mínimo de tinta. **Confiança:** MED. **Outros perdem:** que "mais explicação" pode degradar a sensação se não for contida.

**Strategist (posição de longo prazo) —** A identidade defensável do TripPilot é **"honesto + calmo + funciona offline"** num mercado de apps financeiros barulhentos. A sensação é o produto. Investir no **fechamento (Peak-End)** e na **assinatura "número+porquê"** constrói memória e boca-a-boca; features avulsas não. **Rec:** transformar honestidade em **honestidade calorosa** e desenhar o "fim". **Confiança:** MED. **Outros perdem:** que falta um "fim" que dê orgulho — onde nasce a recomendação espontânea.

### Red Team (matar a opção líder = "traduzir e sequenciar antes de adicionar")
- "Tradução" pode ser **paliativo**: se o modelo (fases/modos) é confuso demais, glosar termos só maquia — talvez precise **simplificar o modelo**, não explicá-lo. → Resposta: começar pela tradução é barato e reversível; se a validação mostrar que o conceito em si trava (não o nome), aí sim revisitar o modelo. Tradução primeiro **revela** se o problema é nome ou conceito.
- Elevar a pergunta-âncora ao Dashboard pode **poluir** a calma. → Mitigar com **um número + uma linha**, nada mais; testar contra a versão atual.
- Foco em sensação/fechamento pode **adiar** correções de a11y (audit round-2) que são P0. → Não competem: a11y é base técnica (UX-A); este estudo é a camada de significado. Rodam em paralelo.

### Síntese (Chair)
- **Consenso:** as features certas existem; o trabalho é **clareza + sensação**, não adição. Baixo risco, alta percepção.
- **Tensões:** Advocate/Strategist querem **elevar e celebrar** (mais presença); Critic quer **conter** (menos tinta, calma é ativo). Architect resolve a tensão com **componentes únicos** (tradução/veredito) que dão consistência sem espalhar ruído.
- **Recomendação:** priorizar, nesta ordem — **(1) Pergunta-Âncora glanceável** (N1+N2 no Dashboard, discreta), **(2) Vocabulário traduzido** (ⓘ→Ajuda, via um registro único), **(3) Corrigir os 3 pontos de desconfiança** (livre €0, "+" mudo, modo invisível), **(4) Desenhar o "fim"** (fechamento Peak-End). A **lente que mais pesa aqui é a do Advocate** (intuição/simplicidade no diário), porque os jobs dominantes (J1/J2) são diários e ansiosos — é onde a percepção do app se forma.
- **Condições:** tudo **discreto e sob demanda** (Critic); **centralizado em componentes** (Architect); **medido** contra a versão atual (§14).
- **O que viraria o jogo (cenário minoria vence):** se a validação mostrar que usuários **não entendem o conceito** (não só o nome) de fases/modos/potes, então a prioridade vira **simplificar o modelo mental** (menos conceitos no caminho diário) — e aí o Strategist/Architect lideram uma revisão estrutural, não cosmética.
- **Confiança geral:** MED-ALTA — direção robusta; números de comportamento ainda por validar.

---

## 13. Recomendações priorizadas (matéria-prima dos próximos pacotes)

> Complementa os pacotes **UX-A/B/C** do audit round-2 (que cobrem a11y/legibilidade). Aqui está a **camada de significado/sensação**. Sem código — são intenções de design.

### Pacote EXP-1 — "Pergunta-Âncora" (alto impacto · baixo risco)
- Header glanceável no Dashboard: **"Livre hoje: €X"** (número grande) + 1 linha de razão. Reusa números já calculados pelo domínio.
- Campo/atalho "posso gastar ___?" levando ao Simulador (elevar o melhor momento).
- **Sucesso:** usuário responde "quanto posso gastar hoje?" em <3s, sem navegar (first-click test).

### Pacote EXP-2 — "Vocabulário humano" (alto impacto · baixo risco)
- Registro único **termo → glosa curta → artigo de Ajuda**; um "ⓘ" tocável e discreto em cada conceito (livre da fase, livre diário, pote, alocação, modo).
- Glosa humana na **primeira aparição** de cada termo.
- **Sucesso:** queda de "o que é isso?" em teste moderado; tooltips/ⓘ cobrindo 100% dos termos financeiros.

### Pacote EXP-3 — "Pontos de desconfiança" (médio impacto · baixo risco)
- **X1 "livre €0":** trocar o vazio assustador por frase orientada à ação ("Esta fase está toda planejada — o gasto sai do próximo dia ou de um pote").
- **X3 "+" mudo:** micro-rótulo/àncora "Registrar" + recência da 1ª ação.
- **X2 modo invisível:** chip persistente de contexto ("Dia a dia" / "Viagem: …") + manter o padrão de explicar ausências (como o planejador já faz).

### Pacote EXP-4 — "O fim que dá orgulho" (alto impacto em memória · médio esforço)
- Fechamento de **dia/rolê/viagem**: resumo caloroso (gastou, vs plano, dividiu) — Peak-End.
- Micro-deleite sóbrio nos picos (cabe! / acertado! / melhor compra!).
- **Sucesso:** aumento de retorno pós-fechamento; reações qualitativas positivas.

### Pacote EXP-5 — "Resiliência visível" (baixo esforço · marca)
- Tornar "funciona offline / sem te travar" perceptível (selo discreto onde fizer sentido).

---

## 14. Como validar barato (antes de construir)

- **Teste de 5 usuários (NN/g):** 5 pessoas, 3 tarefas (registrar um gasto; "posso gastar X?"; "qual produto vale mais?"). Observar onde param. 5 já revelam ~85% dos problemas de usabilidade.
- **First-click test:** "onde você tocaria para saber quanto pode gastar hoje?" — mede a Pergunta-Âncora.
- **Emotion check:** após cada tarefa, 1 pergunta ("como você se sentiu: aliviado / neutro / ansioso?") — mede a curva do §4.
- **5-second test no Dashboard:** mostrar 5s e perguntar "o que esse app faz e quanto você pode gastar?" — mede clareza do primeiro olhar.
- **Instrumentação que já existe (DEC-248 telemetria anônima):** medir uso real de Simulador/Comparador/FAB-por-ação, taxa de captura concluída × abandonada, e quais termos levam à Ajuda. **Sem custo de usuário, dado real.**
- **Comprehension test de termos:** mostrar "Livre da fase: €0" e perguntar "o que isso significa pra você?" — valida X1/X7.

---

## 15. O que NÃO consegui verificar (honestidade)

- **Comportamento e emoção reais:** sem teste com usuários nesta rodada → tudo em §2–§4, §10–§11 são **hipóteses** (MED/LOW), não fatos. Marcadas como tal.
- **Métricas de funil** (quantos abandonam o primeiro minuto, quantos usam o Simulador no balcão): exigem ler a telemetria (DEC-248) — **não consultei dados** aqui.
- **Acessibilidade fina:** coberta no `ux-audit-round2` (com medição). Não remedi para não duplicar.
- **Variações por idioma/cultura:** o estudo assume pt-BR como base; tom/termos podem soar diferente em en/es.
- **Concorrência:** não fiz claims comparativos (regra de verificação) — "honesto + calmo + offline" é descrição do *nosso* app, não afirmação de unicidade no mercado.

---

## 16. Referências (princípios aplicados)

- **Nielsen, J.** — *10 Usability Heuristics* (esp. #1 visibilidade do estado, #2 match com o mundo real, #6 reconhecer > lembrar) · Nielsen Norman Group.
- **Norman, D.** — *The Design of Everyday Things* (affordances, **signifiers**, mapeamento, modelo do sistema × do usuário).
- **Christensen/Klement** — *Jobs to be Done* (o "trabalho" que o usuário contrata).
- **Kahneman, D.** — *Peak-End Rule* (memória dominada por pico e fim).
- **Hick, W.** — *Hick's Law* (tempo de decisão cresce com nº de opções → enxugar o FAB).
- **Fitts, P.** — *Fitts's Law* (alvo grande/perto = mais rápido → FAB no canto, números grandes).
- **NN/g** — *Progressive Disclosure*, *Empty States*, *First-Time UX*, *Why You Only Need to Test with 5 Users*.
- **Material Design 3** — FAB menu (3–6 ações) · base da reorg do FAB.
- **Internos:** `ux-audit-round2-2026-06-22.md` (evidência medida/a11y), `decision-log.md` (DEC-250 dia a dia, DEC-256 conversor, DEC-276 cooldown honesto, DEC-283/284 comparador), `design-system.md`.
