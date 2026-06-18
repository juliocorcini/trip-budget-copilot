# Divisão de conta na mesa ("passa a nota") — brainstorm + conselho ×5 + ranking

> Documento de pesquisa, brainstorm e decisão. **Não é implementação.** Solicitado por Julio (2026-06-18) por áudio.
> Idioma do documento: PT. Identificadores de código: EN.
> Política de verificação: afirmações competitivas verificadas na web em **2026-06-18** (fontes na §16), com nível de confiança.

> ## ⚠️ ATUALIZAÇÃO 2026-06-18 (2ª rodada de áudio do Julio) — decisões TRAVADAS + reversões
> Este documento é o **registro do brainstorm/ranking**. As decisões e o spec build-ready vivem agora em **`bill-split-implementation-support-2026-06-18.md`** (o arquivo de implantação). Reversões/refinamentos principais que o Julio travou:
> 1. **NÃO é efêmero.** O momento é rápido/ágil, mas os dados **são salvos**: gasto dividido na minha página de gastos (com todos os itens, quem participou, quem pagou o quê, histórico da divisão), **dívidas** (quem me deve / eu devo), **integração de orçamento** (simulador quando pago a minha parte) e **propaga para o app de quem também tem o TripPilot**.
> 2. **A feature se chama "Dividir conta"** (vai no FAB). "Nota" como função isolada **sai** — escanear é só um **input**; anexar foto continua dentro do registro de gasto normal.
> 3. **Claim ao vivo (C) é V1**, não V2.
> 4. **Taxa de serviço:** proporcional; a IA **procura a taxa na nota**; se não achar, infere se já está inclusa; se não estiver, **pergunta** quanto.
> 5. **Pessoas ad-hoc** por padrão, **com opção de adicionar como Participants/contas reais** para uso futuro.
> 6. **Pix "copiar" descartado** (não dá pra gerar Pix). Vira **feature futura**: o usuário guarda os próprios dados de pagamento (Pix/Wise/banco); quem deve vê como pagar e **anexa comprovante**.
> 7. **Mecânica de entrada:** passa-o-celular **+** um link único (todo mundo se adiciona/reivindica ao vivo) **+** híbrido (os dois ao mesmo tempo); **o dono é o gerente/fonte da verdade**. Link secundário: um por pessoa (pré-montado).
>
> O §11 (ranking) e §14 (decisões em aberto) abaixo ficam como **histórico**; as respostas estão no doc de implantação.

---

## 0. TL;DR (a uma respirada)

Julio quer o **momento** de dividir a conta na mesa: *"passa a nota, eu tiro a foto e já entrego rápido o que cada um vai pagar"*. Não é gestão de dívida — é **velocidade + clareza + justiça**, com a **taxa de serviço entrando e sendo rateada automaticamente**, cada um pagando o seu.

O TripPilot **já tem 70% das peças** (scan de nota por IA → itens → divisão → Saída; motor de split/dívida; link `/s` E2E "sua fatia no celular do outro"). O que falta é **o enquadramento certo**: hoje a feature é *dono-cêntrica e contábil* (vira MEU gasto + dívidas que os outros me devem); o Julio quer *mesa-cêntrica e efêmera* (vira o número de cada um, e pronto).

**Recomendação (1º lugar): a Híbrida "H" — unificar "Nota & Divisão" numa única função** com um **fork de modos** logo após ler/digitar a conta (Por igual → Cada um pega o seu → Só meu), **taxa de serviço como linha explícita rateada proporcionalmente**, **pessoas ad-hoc** (sem poluir os Participants da viagem), **"registrar a minha parte" no orçamento como opt-in** (a ponte com o DNA do TripPilot), e **um cartão por pessoa + link** reusando o `/s`. O *claim ao vivo multi-celular* (estilo pay-at-table) entra como **camada V2**.

Pódio: **🥇 H (unificada) · 🥈 B (fluxo efêmero dedicado) · 🥉 C (claim ao vivo via link)**. Fora do pódio: A (empurrar tudo na tela de revisão atual — anti-padrão) e D (igual+taxa — bom demais para ser produto sozinho, então vira o *caminho rápido padrão* dentro de H).

---

## 1. O que o Julio pediu (fiel ao áudio)

Decompondo a fala, a visão tem **seis núcleos**:

1. **Entrada por foto, como a "nota".** *"Eu tiro uma foto da conta, ele lê como a gente faz na nota."* Ele mesmo nota que **"tem alguma coisa a ver com a nota… é uma função muito parecida"** e pergunta se é a mesma coisa. (É — ver §3.)
2. **Mostra os itens + taxa de serviço.** *"Mostra o item da conta… muito provavelmente vai ter taxa de serviço, e ela tem que ser dividida para todos."*
3. **Entra o fluxo de divisão, com dois caminhos.**
   - **Por igual:** *"divide por igual → divide para quantas pessoas? → cada um paga tanto."*
   - **Cada um pega o seu (claim por rodízio):** *"estamos em N pessoas → eu sou a Bianca → mostra os itens disponíveis → ela seleciona os dela → passa pro Ricardo, e os itens da Bianca já não aparecem → cada um seleciona o seu."*
4. **Fechamento com itens órfãos.** *"vai chegar a hora em que todo mundo selecionou; aí ele tem que falar: isso aqui ninguém está pagando, falta alguém pagar."* Inclui **itens duplicados** (*"€10 = 2× €5, manda pra 2 pessoas"*) e **meio-item** (*"ela combinou de pagar metade do item"*).
5. **É um MOMENTO, não um gerenciamento.** *"Não é sobre uma pessoa pagar o de todo mundo — cada um paga o seu. É menos uma função de gerenciamento… é mais aquele momento rápido. Sempre foi um caos saber quanto eu tinha que pagar; agora foi fácil."*
6. **Compartilhar o resultado.** *"Mando um link pra todo mundo no WhatsApp; cada um abre e já vê quanto tem que pagar, detalhado — você pediu tal, tal, tal + taxa de serviço = tanto. E quem quiser vê o resto da conta."*

E um pedido explícito de método: *"pensa em outras formas… faça um brainstorm… depois chame o conselho 5 vezes, visões diferentes, tipos de viagem diferentes, tipos de gasto diferentes… e chegue num documento muito completo com um ranking: o que ganhou, 2º, 3º."*

> **Tensão que ele mesmo plantou:** ele quer que seja **rápido/efêmero** ("não é gerenciamento") **e** que **"conecte melhor com o nosso aplicativo"** e "gerencie da melhor forma". Resolver essa tensão é o coração deste documento (§3, §9).

---

## 2. O que o TripPilot JÁ tem (grounding — isto de-risca tudo)

Buscas diretas no código confirmam que **a "nota" já existe** e que **boa parte do que o Julio descreveu já está construída** — só não com o enquadramento que ele quer.

| Peça pronta | Onde | O que faz hoje |
|---|---|---|
| **Scan de nota por IA** (DEC-206/209) | `features/receipt/ReceiptScanPage.tsx`, `utils/ai-ocr.ts`, Worker `/ocr` (Groq) | Foto → IA extrai `{merchant, currency, total, items[]}` → `ReceiptPlan`. Opt-in com consentimento; entrada manual sempre disponível. On-device foi **removido** (DEC-209: "não leu nada certo"). |
| **Revisão estilo Wise** | `ReceiptScanPage` | Lista marcável, editar item (descrição/valor/categoria), incluir/excluir, adicionar manual. |
| **Divisão por item** (DEC-208) | `domain/receipt`, `domain/splitting/splitting.ts` | Picker explícito "Dividir com quem?" (não auto-todos); set uniforme aplicado aos itens; override por item; "quem pagou". |
| **Bater o total** (G4) | `parse.ts → matchItemsToReadTotal` | **Já rateia taxa/gorjeta/desconto proporcionalmente** entre os itens incluídos para somar o total impresso (com arredondamento exato ao centavo). |
| **Motor de split/dívida** (DEC-114) | `domain/splitting/splitting.ts → resolvePayerExpense`, `calculateDebts`, `suggestSimplifiedSettlements`, `buildParticipantStatement` | Tabela-verdade do pagador; dívidas só de shares confirmados; acerto simplificado (mínimo de transferências); extrato por participante. |
| **Commit como Saída** | `domain/orchestrators/receipt-orchestrators.ts → commitReceipt` | Nota vira **uma Session `completed`** com N `Transaction` + `participantShares` + foto anexada, numa transação Dexie atômica, com undo. |
| **Link "sua fatia" E2E** (DEC-207) | `features/shared/*`, Worker KV `SHARE_STORE`, `ShareSignal` DO | `…/s/:id#k=<key>` → a pessoa **sem o app** vê **só a fatia dela**, confirma/marca pago; chave no `#fragment`, servidor só guarda ciphertext; tempo real best-effort (S7). |
| **Empurrão "manda o link pra cada um"** (B5) | `SplitShareNudgeSheet.tsx`, `collectSplitNotifyTargets` | Depois de dividir, sugere mandar o `/s` link de cada pessoa (via share sheet/WhatsApp). |
| **Foto device-local** (DEC-206) | Dexie v8 `attachments` (fora do backup) | Imagens não viajam em backup/restore. |

**Conclusão do grounding:** não estamos inventando do zero. **A maior parte do "como" existe.** O trabalho real é de **produto/enquadramento + 3 lacunas concretas**, não de infraestrutura.

### 2.1 As lacunas reais (o delta entre o que existe e a visão do Julio)

| # | Lacuna | Hoje | O que o Julio quer |
|---|---|---|---|
| **L1** | **Modelo mental** | Dono-cêntrico: a nota vira **MEUS gastos** + **dívidas persistentes** (os outros me devem; ou eu devo ao pagador). Sempre entra no orçamento. | Mesa-cêntrico **efêmero**: vira o **número de cada um**; cada um paga o seu; entrar no orçamento é **opcional** (só "a minha parte"). |
| **L2** | **Taxa de serviço explícita** | Existe só implícita via `matchItemsToReadTotal` (dilui a diferença nos itens ao "bater o total"). Não há linha "Taxa de serviço 10%" nem rateio transparente. | Linha **explícita**, entra automática, **rateada para todos** (proporcional ao consumo ou por cabeça). |
| **L3** | **Claim por rodízio + itens órfãos** | Fluxo inverso: o dono atribui cada item a um set de pessoas. Não-atribuído = pessoal (do dono). | **Rodízio:** cada pessoa pega os seus, somem para o próximo; no fim, **detecta itens que ninguém pegou**. |
| **L4** | **Pessoas ad-hoc** | Dividir exige `Participant`s da viagem (≥2). Criar 7 amigos polui o roster/dívida pra sempre. | Nomes leves só para aquela conta; **sem poluir** a viagem; promover a Participant só se quiser o ledger. |
| **L5** | **Meio-item / quantidade** | `participantIds` divide um item **igualmente** entre marcados. Não trata qty=2 como 2 unidades distintas nem "metade/metade" como ação rápida. | Item de qty 2 → 2 donos; um item → metade pra cada; ações de 1 toque. |
| **L6** | **Link = "sua parte da conta"** | Link é **fatia de dívida com o dono** (confirma/paga). | Link é **"o seu número"** itemizado (você pediu X, Y + taxa = total), com opção de ver a conta toda. |

> Note que **L2 já está 80% resolvido matematicamente** (`matchItemsToReadTotal` faz rateio proporcional exato) — falta só **tornar explícito/transparente** como uma linha de serviço. Isso reduz muito o custo de L2.

---

## 3. O reframe central: "Nota" e "Divisão" são a mesma função?

A pergunta do Julio — *"tem a ver com a nota? é a mesma função?"* — tem uma resposta limpa:

> **A foto/scan é o INPUT. A divisão é o PROPÓSITO. São uma feature só.**
>
> Hoje elas estão fundidas numa tela que é **"scan → revisa → (divide) → vira meu gasto"**. O Julio quer **"scan/digita → DIVIDE → entrega o número de cada um → (opcional: minha parte vira meu gasto)"**. Mesma matéria-prima, **ordem e ênfase diferentes**.

### 3.1 Os dois modelos mentais que colidem

| | **Modelo Ledger (o que existe)** | **Modelo Mesa (o que o Julio quer)** |
|---|---|---|
| Pergunta que responde | "Quem deve quanto a quem, ao longo do tempo?" | "Quanto **eu** pago **agora**?" |
| Quem fronta | Uma pessoa paga, os outros devem a ela | **Ninguém** fronta — cada um paga o seu |
| Persistência | Sempre: gera Transaction + dívidas | **Efêmero** por padrão; persiste só "minha parte" se eu quiser |
| Análogo de mercado | Splitwise / Tricount / Supasplit (ledger) | SplitEven / ReceiptSplit / pay-at-table (calculadora justa) |
| Caso de uso | Viagem longa, república, "acerta no fim" | Jantar de amigos, rolê, "resolve na hora" |
| TripPilot hoje | ✅ construído (DEC-114/207) | ⚠️ é a lacuna L1 |

**O insight que destrava tudo (e que o teste de personas na §8 confirma):** o TripPilot **não deve escolher um** — deve deixar **o mesmo scan/claim desaguar em QUALQUER um dos dois**, por escolha do usuário no momento. É isso que nenhum concorrente faz bem (uns são só ledger, outros só calculadora). E a ponte natural com o DNA do TripPilot é: **a minha parte vira UM gasto limpo no trecho ativo** (com simulador "isso cabe no teto de hoje?"), enquanto as partes dos outros são só **exibidas/compartilhadas** — viram dívida **só se eu pedir**.

---

## 4. As abordagens candidatas (o que será testado pelo conselho)

Defino 5 apostas concretas para o conselho ranquear. Todas reusam scan + itens + `resolvePayerExpense` + `/s`; diferem em **enquadramento, fluxo e persistência**.

### Abordagem A — "Modo Divisão" dentro da tela de nota atual (evoluir mínimo)
Adiciona um seletor de modo na própria `ReceiptScanPage` (Por igual / Cada um pega o seu / Só meu) e uma linha de taxa. Mantém o commit atual (vira Saída + dívidas).
- **Prós:** reuso máximo, 1 tela, rápido de entregar.
- **Contras:** a tela **já é densa**; empilhar dois modelos mentais ali vira o pior dos dois mundos; continua dono-cêntrico/contábil (não resolve L1).

### Abordagem B — "Dividir a conta" como fluxo efêmero dedicado (calculadora-first)
Porta separada ("Dividir conta") ao lado de "Escanear nota". Sessão de divisão **efêmera**: scan **ou** manual → headcount/nomes leves → modo (igual/claim) → **linha de taxa explícita** → cartão por pessoa → links. **Nada toca o orçamento** até tocar "registrar minha parte". Entidade `SplitSession` device-local.
- **Prós:** é o que mais combina com "é um momento, não gerenciamento"; rápido; não polui orçamento/dívida; aceita gente que não é da viagem.
- **Contras:** duplica parte do scan/split; cria um **segundo conceito de "dividir"** que pode confundir vs o existente.

### Abordagem C — Claim ao vivo multi-celular (estilo pay-at-table)
Dono escaneia → compartilha **um** link da mesa → cada um abre no próprio celular e **reivindica os seus itens ao vivo**; a tela do dono preenche; taxa rateia; cada um vê o seu total. Reusa `/s` + `ShareSignal` (S7 tempo real).
- **Prós:** o "uau"; terceiriza o trabalho de atribuir para cada um; muito diferenciado; reusa a infra E2E.
- **Contras:** exige **todos online e dispostos a abrir link na hora** (atrito numa mesa barulhenta); tempo real é best-effort; mais pesado. **Melhor como camada V2 sobre A/B/H.**

### Abordagem D — Mínimo: igual + taxa (o 20% que entrega 80%)
Scan **ou** digita o total → "quantas pessoas?" → soma taxa → cada um paga total/N → compartilha. **Sem atribuição de item.**
- **Prós:** simplíssimo; cobre a maioria dos casos casuais; custo quase zero.
- **Contras:** ignora "cada um pega o seu" (que o Julio quer explicitamente); não diferencia. **Bom demais para ser produto sozinho → vira o caminho-padrão dentro de H.**

### Abordagem H — Híbrida recomendada: "Nota & Divisão" unificada
A **espinha** = uma feature só (evolui a tela de nota, princípios de B): **scan/manual → fork de modo (D como padrão ⊂ claim por item ⊂ meio-item) → taxa de serviço explícita rateada proporcionalmente → pessoas ad-hoc efêmeras → cartão por pessoa → "registrar a minha parte" no orçamento opt-in (a ponte) → link por pessoa reusando `/s`**. **C** entra como camada V2 ("todo mundo pega ao vivo").
- **Prós:** cobre personas 1–4 **e** preserva o ledger da persona 5; rápido por padrão, profundo quando preciso; reuso alto; é a única que conecta divisão + orçamento + offline + grátis/sem-login.
- **Contras:** exige disciplina de *progressive disclosure* pra não inchar; precisa do modelo de "parte efêmera vs gasto persistido" bem desenhado.

---

## 5. 🏛️ Conselho 1 — Enquadramento & Arquitetura

> **Modo:** council (Strategist · Architect · Critic · Advocate). **Pergunta:** feature nova vs evoluir a nota? Ledger vs efêmero? Como conectar ao orçamento?
> *Metodologia: conselhos rodados **inline** pelo agente principal — mesmo padrão dos documentos `receipt-ocr-item-split-research` (§4) e `shared-participant-link` deste brain, e em conformidade com `tech-lead-delegation.mdc` (sem subagentes) + `execution-style.mdc` (custo por request). Cada papel é uma lente analítica genuína e independente.*

### Strategist (negócio / posicionamento)
O momento "passa a nota" é a **porta de entrada social** do TripPilot: é quando 7 pessoas veem o app funcionar numa mesa — aquisição orgânica embutida. Estrategicamente, **não competir como ledger** (Splitwise/Tricount ganham no histórico de dívida) e sim **vencer no momento + no orçamento**: somos o único que diz *"sua parte são €23 — e isso ainda cabe no seu teto de hoje"*. O risco é escopo: a feature de nota acabou de fechar (DEC-206→209) e o app está em polimento (Package #4). Mas isto **não é polimento, é diferenciação** — merece épico próprio. Reusar a nota (não criar uma porta concorrente) protege a coerência. **Bottom line:** evoluir a nota numa "Nota & Divisão" unificada; o diferencial é divisão+orçamento, não virar mais um ledger.

### Architect (arquitetura / reuso)
Tecnicamente, **A↔B↔H são a mesma árvore** com fronteiras diferentes. A camada certa: `domain/split-session/` **puro** (cálculo de quem-paga-o-quê, rateio de serviço, detecção de órfãos, meio-item) **agnóstico** de "vira gasto ou não". A persistência é uma **decisão de saída**: (i) descartar (efêmero), (ii) `registerExpense` só da minha parte, (iii) `commitReceipt` completo (ledger atual). Isso evita o erro de acoplar cálculo a commit. **Pessoas ad-hoc** devem ser um tipo leve (`SplitParticipant {name}`) que **só** vira `Participant` no caminho (iii). O claim por rodízio é **camada de apresentação** sobre o mesmo `participantIds` — não muda o domínio. **Bottom line:** uma feature, um domínio puro de split, três saídas plugáveis; o claim e a taxa são UI+helper puro, não reescrita.

### Critic (advogado do diabo)
Modos de falha: **(1) Dois "dividir" no app** (a nota atual + uma porta nova) = usuário perdido sobre qual usar → **proibir B como porta separada**; tem que ser a MESMA feature. **(2) Densidade:** a `ReceiptScanPage` já carrega scan+revisão+split+reconciliação+explainer; jogar claim+taxa+ad-hoc+cartões ali (Abordagem A pura) explode a tela → precisa de **passos**, não mais widgets na mesma tela. **(3) Efêmero que some:** se for calculadora pura e o usuário fechar, perdeu tudo — e a foto/itens já custaram um request de IA. **(4) Pessoas ad-hoc vs dívida:** se eu "registro minha parte" mas combinei de cobrir o Pedro, o app some com essa dívida → o opt-in de ledger tem que ser claro. **(5) Taxa de serviço dupla:** se a IA já leu a taxa como item E o usuário soma de novo → cobra 2×. **Bottom line:** unificar (matar B-como-porta), fluxo em passos, persistir o rascunho localmente, e blindar a taxa contra contagem dupla.

### Advocate (experiência do usuário)
Na mesa, com 7 pessoas e comida esfriando, o que importa é **tempo até "todo mundo sabe quanto paga"**. O padrão de ouro do mercado é **<15s** (Supasplit) e **"nunca dividir um filé de €58 igual"** (justiça por item). Então: **caminho rápido = igual+taxa em 2 toques** (a maioria das mesas), e **escalar para "cada um pega o seu"** só quando alguém disser "ah, eu só tomei água". O claim por rodízio (passa o celular) é **realista** num jantar; o claim multi-celular ao vivo é lindo mas **só funciona se todos toparem abrir link** — não pode ser o caminho obrigatório. O cartão final por pessoa ("Bianca: €23 — risoto + ½ vinho + €2 serviço") é o **entregável emocional** — é o "uau, foi fácil". **Bottom line:** padrão rápido (igual+taxa), profundidade opcional (claim), entrega = cartão claro por pessoa; link é bônus, não pré-requisito.

### Síntese do Conselho 1
- **Consenso:** (1) **uma feature só** — evoluir a nota, **não** criar porta concorrente; (2) **fluxo em passos** (não empilhar na tela densa atual); (3) **domínio de split puro** com **3 saídas plugáveis** (efêmero / minha-parte / ledger completo); (4) **persistir o rascunho local** pra não perder o trabalho/IA; (5) a **ponte com o orçamento = "minha parte"**, não o ledger inteiro.
- **Divergência:** Strategist/Architect aceitam o ledger como saída opcional; Critic alerta que o opt-in de dívida precisa ser explícito pra não "sumir" com combinados. → resolvido tornando ledger uma escolha visível.
- **Confiança:** **ALTA** no "unificar + passos + domínio puro"; **MÉDIA** na UX do claim por rodízio (precisa protótipo).

---

## 6. 🏛️ Conselho 2 — Brainstorm de fluxos ideais

> **Modo:** brainstorm (Visionary · Analyst · Connector · Simplifier). **Pergunta:** qual o fluxo ideal? Gere/refine as abordagens.

### Visionary (10×, "e se…")
E se a mesa inteira resolvesse a conta **antes de chamar o garçom**? O dono aponta a câmera, a IA lê, e aparece um **"baralho" de itens** que cada um vai "puxando" pro seu nome — como repartir cartas. E se o app **ouvisse**: "eu fui o risoto e dividi o vinho com a Ana" → atribui por voz (o app já tem `parseVoiceExpense`). E se, ao fim, cada um recebesse não só o número, mas **"e isso te deixa com €40 livres pro resto da viagem"** — a divisão vira **conselho de orçamento**, não só matemática. E se o link da pessoa virasse a **porta de entrada dela no TripPilot** ("gostou? comece sua viagem") — crescimento viral. **Bottom line:** o teto da ideia é "dividir = repartir cartas + falar + virar conselho de orçamento + recrutar novos usuários".

### Analyst (dados / benchmarks)
O mercado 2026 convergiu num padrão claro (VERIFIED, §16): **scan → IA extrai itens+taxa+gorjeta → toca pra atribuir → taxa/gorjeta rateada PROPORCIONALMENTE ao consumo → link de cobrança sem o destinatário ter o app → funciona offline (só o scan precisa de net)**. ReceiptSplit oferece **"By Person" e "By Item" como duas visões** da mesma conta e deixa **misturar** rateio proporcional/igual por recibo. Supasplit promete **<15s** e **"todo mundo vê a parte exata, taxa e gorjeta incluídas"**. Pay-at-table (TabSettle/Settl/me&u) faz **claim ao vivo multi-device, sem app**, mas **depende do PDV do restaurante** — fora do nosso alcance, logo a versão **offline/foto** é onde temos espaço. **Bottom line:** copiar o padrão vencedor (scan→atribui→rateio proporcional→link sem-app→offline), e ganhar no que eles não têm: **orçamento + grátis/sem-login + web/PWA/APK**.

### Connector (analogias de outros domínios)
- **Repartir cartas / draft de fantasy:** o claim por rodízio é um "draft" — cada um escolhe na sua vez; itens "saem do board". UX conhecida e divertida.
- **Carrinho de compras compartilhado (Uber Eats em grupo):** cada um monta o "seu carrinho" a partir de um cardápio comum (= os itens da nota) — exatamente o claim multi-celular.
- **Planilha "By Person × By Item" (pivot):** alternar entre ver por pessoa e por item é o truque do ReceiptSplit — duas leituras do mesmo dado.
- **Vaquinha/cobrança (PIX "split"):** o link por pessoa = um "boleto social" itemizado. No Brasil, **PIX** seria o settlement natural (vs Venmo lá fora) — o link pode trazer **"copiar valor pra Pix"**.
**Bottom line:** o claim é um "draft de cartas"; a saída é um "boleto social com Pix"; a visão dupla By Person/By Item é barata e poderosa.

### Simplifier (mínimo viável)
A maioria das mesas **não precisa de claim por item** — precisa de **"total ÷ N, com a taxa já dentro"**. Esse é o **caminho de 2 toques** e tem que ser o padrão. Tudo além (claim, meio-item, ao vivo) é **disclosure progressivo**, atrás de um "dividir diferente?". O MVP de verdade: **digitar/escanear total → N pessoas → taxa → pronto + compartilhar**. O item-claim é a **2ª camada**; o ao-vivo é a **3ª**. Não construa a 3ª antes da 1ª provar uso. **Bottom line:** o produto é uma escada: degrau 1 (igual+taxa) cobre 70% e é quase de graça; só suba degrau conforme o uso pedir.

### Síntese do Conselho 2 (fluxos refinados)
O fluxo ideal é uma **escada de 3 degraus** sobre uma base comum:
1. **Base:** entrada (foto IA **ou** manual **ou** "só o total") → moeda → **taxa de serviço** (linha explícita; default rateio **proporcional**, alterna pra "por cabeça").
2. **Degrau 1 (padrão, 70%):** **Por igual** entre N (nomes ad-hoc opcionais) → cartão por pessoa.
3. **Degrau 2:** **Cada um pega o seu** — visão **By Item** (rodízio: passa o celular) **ou** **By Person**; meio-item e qty→2-donos como toques; **detecção de órfãos** no fim.
4. **Degrau 3 (V2):** **Ao vivo** — um link da mesa, cada um reivindica no próprio celular (reusa `/s`+`ShareSignal`).
5. **Saída (qualquer degrau):** cartão por pessoa + **link por pessoa** (itemizado + "ver conta toda" opcional + "copiar pro Pix"); e **"registrar a minha parte"** no orçamento (opt-in) com leitura de simulador.

---

## 7. 🏛️ Conselho 3 — Teste por tipo de viagem & gasto (5 personas)

> O pedido explícito do Julio: *"pensem tipos de viagem diferentes, tipos de gasto diferentes… pessoa com pessoa, viagem com viagem."* Cinco personas, cada uma julga as abordagens e aponta **killer feature** e **o que quebra**.

### Persona 1 — "Os 7 amigos / jantar urbano com taxa de serviço" (o caso canônico do áudio)
Mesa de 7, restaurante, conta grande, **10% de serviço**, cada um pediu coisas diferentes, 1 dividiu vinho.
- **Precisa:** ler a nota, atribuir por item, **taxa rateada proporcional**, meio-item (vinho), cartão por pessoa, link.
- **Vence:** **H** (degrau 2 + taxa proporcional + cartões + link). **C** brilha **se** todos abrirem o link.
- **Quebra:** D (igual ignora que um só tomou água); A (densa demais pra 7 pessoas e claim).
- **Killer:** o cartão final *"você: risoto + ½ vinho + €2,30 serviço = €27,80"* + link no Whats.

### Persona 2 — "Família hospedada / recibo de mercado misto" (o caso do cunhado, DEC-206)
Recibo de mercado com 40 itens; parte é da casa toda, parte é só sua (sua cerveja, fralda do sobrinho).
- **Precisa:** ler muitos itens, marcar **alguns compartilhados / alguns pessoais**, talvez **registrar a parte da casa** no orçamento.
- **Vence:** **H** (By Item + "só meu" por item + minha-parte no orçamento). É literalmente o caso que a nota foi feita pra resolver — H só melhora com ad-hoc + clareza.
- **Quebra:** D (não dá pra dividir igual um mercado misto); C (ninguém vai abrir link pra um mercado).
- **Killer:** alternar **By Item** rápido marcando "meu/nosso", e a parte compartilhada virar 1 gasto no trecho.

### Persona 3 — "Festival / hostel / rodadas de bar, sem recibo, gente entra e sai"
Bar sem nota itemizada; rodadas; o grupo muda (chega gente, sai gente); ninguém quer formalidade.
- **Precisa:** **entrada manual / só o total**, divisão **por igual** com headcount **variável**, rápido, **offline**.
- **Vence:** **D / caminho rápido de H** (+ o **Modo Saída/Bar** que já existe pra rodadas, DEC-127). **B** também serve por ser efêmero.
- **Quebra:** C (caótico, gente offline, ninguém abre link no show); claim por item (não há itens).
- **Killer:** "total €120, somos 6 agora → €20 cada" em 2 toques, sem criar Participant nenhum.

### Persona 4 — "Casal / splits diários rápidos"
Dois, o dia todo: café, mercado, táxi. Querem 50/50 sem fricção.
- **Precisa:** **50/50 instantâneo**, talvez "hoje você paga, amanhã eu".
- **Vence:** **D** (50/50 é 1 toque). Claim é overkill.
- **Quebra:** C e claim por item (peso desnecessário pra 2 pessoas).
- **Killer:** botão "dividir 50/50" coladinho no quick-add; nem precisa de tela de divisão.

### Persona 5 — "Mochileiro / viagem longa / splits parciais / alguém cobre / acerta no fim"
Semanas viajando; gastos compartilhados recorrentes; às vezes um cobre o outro; **acerto no fim** da viagem.
- **Precisa:** o **LEDGER** — quem deve quanto a quem ao longo do tempo, acerto simplificado, extrato por pessoa. Território Splitwise.
- **Vence:** o **modelo atual (ledger, DEC-114/207)** — `calculateDebts` + `suggestSimplifiedSettlements` + `/s`.
- **Quebra:** B/efêmero puro (perde o histórico!); D.
- **Killer:** "no fim da viagem, o Pedro te deve €74 (3 transferências viram 1)".

### Matriz persona × abordagem (qual serve melhor)

| Persona | A | B | C | D | **H** | Modo a usar dentro de H |
|---|:---:|:---:|:---:|:---:|:---:|---|
| 1 · 7 amigos jantar | ◐ | ● | ●(online) | ✗ | **★** | claim By Item + taxa proporcional + links |
| 2 · família mercado | ● | ● | ✗ | ✗ | **★** | By Item "meu/nosso" + minha-parte no orçamento |
| 3 · festival/bar | ◐ | ● | ✗ | ● | **★** | caminho rápido igual + entrada manual (Modo Bar) |
| 4 · casal diário | ◐ | ◐ | ✗ | ● | **★** | 50/50 de 1 toque |
| 5 · mochileiro longo | ● | ✗ | ◐ | ✗ | **★** | saída = **ledger** (debts + acerto + `/s`) |

★ = melhor · ● = serve bem · ◐ = parcial · ✗ = ruim

### Síntese do Conselho 3 (o achado mais importante do documento)
As personas **provam** que o TripPilot precisa dos **dois modelos**: efêmero (P1–P4) **e** ledger (P5, P2-casa). **A genialidade da H é que o MESMO scan/claim desagua em qualquer saída por escolha.** Nenhuma abordagem pura serve às 5 personas; **H serve às 5** porque trata "vira gasto / vira dívida / não vira nada" como **decisão de saída**, não como features separadas. **Confiança: ALTA** — o teste de personas é unânime a favor de H como guarda-chuva.

---

## 8. 🏛️ Conselho 4 — Risco / Custo / Prazo (avaliação da H)

> **Modo:** assess (Risk Analyst · Opportunity Scout · Cost Analyst · Timeline Realist).

### Risk Analyst
- **R1 (ALTA×ALTA) — Contagem dupla da taxa:** IA lê "Serviço €8" como item E o usuário liga taxa → cobra 2×. *Mitigação:* detectar linhas de serviço/tax na IA e **promovê-las ao campo taxa** (não a itens); reconciliação valida.
- **R2 (MÉDIA×ALTA) — "Sumir" com combinados:** efêmero descarta a dívida que o usuário queria lembrar. *Mitigação:* opt-in de ledger explícito + "isto NÃO será lembrado como dívida" no modo efêmero.
- **R3 (MÉDIA×MÉDIA) — Privacidade do link:** o link itemizado mostra o que cada um comeu. *Mitigação:* já é E2E (chave no `#fragment`); cada link expõe **só a fatia daquela pessoa**; "ver conta toda" é opt-in do dono.
- **R4 (MÉDIA×MÉDIA) — Poluição de Participants:** criar 7 amigos por jantar entope o roster/dívida. *Mitigação:* ad-hoc `SplitParticipant` que só promove a `Participant` no caminho ledger.
- **R5 (BAIXA×MÉDIA) — Dependência da IA/rede:** sem net, sem scan. *Mitigação:* entrada manual + "só o total" sempre disponíveis (offline).
- **Bottom line:** todos os riscos têm mitigação conhecida; R1 (taxa dupla) é o que mais exige cuidado de implementação.

### Opportunity Scout
- **O1 — Aquisição viral:** o link por pessoa é a vitrine; "comece sua viagem" recruta (já existe upgrade signup-less, DEC-207).
- **O2 — Diferenciação defensável:** divisão **+ orçamento prospectivo** ("sua parte cabe no teto de hoje") não existe nos concorrentes (ledger puro ou calculadora pura). Combinado com **grátis, sem login, web+PWA+APK, offline** = posição única (Splitwise cobra pelo scan; os dedicados são iOS/assinatura).
- **O3 — Brasil/Pix:** "copiar valor pro Pix" no link encaixa no mercado-base do Julio melhor que o Venmo dos concorrentes.
- **O4 — Reaproveita 70% do código** → ROI altíssimo.
- **Bottom line:** alta oportunidade de marketing + retenção; o link é o ativo de crescimento.

### Cost Analyst
- **Reuso:** scan/IA, revisão, `resolvePayerExpense`, `commitReceipt`, `/s`, nudge — **prontos**. Custo de inferência ~R$0 (Groq free, já em uso).
- **Novo:** `domain/split-session` (cálculo puro + rateio de serviço + órfãos + meio-item), UI de fork/claim/cartões, modelo `SplitParticipant` ad-hoc, link itemizado "sua parte". Camada V2 (ao vivo) reusa `ShareSignal`.
- **Estimativa (horas cruas → Tier 3 ÷3.0, por `velocity-standard.mdc`):** Degrau 1+taxa+cartões+link ~**45h→15h**; Degrau 2 (claim/By Item/By Person/meio-item/órfãos) ~**60h→20h**; ponte orçamento (minha-parte) ~**18h→6h**; Degrau 3 ao vivo (V2) ~**45h→15h**. **V1 (degraus 1–2 + ponte) ≈ 41h Tier 3 (~5 dias úteis).**
- **Bottom line:** financeiramente trivial (grátis), esforço médio concentrado em UI + 1 domínio puro; V1 cabe numa janela curta.

### Timeline Realist
- **Dependência:** o app está em polimento (Package #4 fechado, v0.90.0). Não há bloqueio técnico; schema Dexie é aditivo (padrão seguro v5–v9).
- **Caminho crítico:** desenhar o **domínio puro de split** + **regra da taxa** primeiro (com testes de matemática), depois UI. O claim por rodízio precisa de **1 rodada de protótipo no aparelho do Julio** (UX de "passa o celular").
- **Ordem realista:** G1 base+igual+taxa+cartões+link (OTA, serve todos) → G2 claim/By Item/meio-item/órfãos (OTA) → G3 ponte orçamento → **G4 ao vivo (V2, depois de provar uso)**.
- **Otimismo a vigiar:** a UX do claim e do meio-item costuma ter mais idas-e-vindas que o previsto. Reserve buffer no G2.
- **Bottom line:** V1 (G1–G3) é entregável web/OTA em ~1 semana Tier 3; o "uau" ao vivo fica pra V2 sem bloquear o valor principal.

### Síntese do Conselho 4
H é **baixo risco / alto retorno / custo médio**, com **R1 (taxa dupla)** como o ponto de implementação mais sensível e o **domínio puro + regra de taxa** como caminho crítico. V2 (ao vivo) não bloqueia o valor. **Confiança: ALTA.**

---

## 9. 🏛️ Conselho 5 — Debate final & conexão com o produto

> **Modo:** debate + papéis custom. **Proposição:** *"A divisão deve ser EFÊMERA por padrão (calculadora), com 'registrar minha parte' e 'virar ledger' como opt-ins."*

### Proponent (a favor — efêmero por padrão)
O Julio foi explícito 4 vezes: *"é um momento, não gerenciamento."* O padrão de mercado vencedor é a **calculadora justa** (SplitEven/ReceiptSplit) — rápida, descartável, sem obrigar ninguém a nada. Efêmero por padrão = **menor carga cognitiva**, **zero poluição** do orçamento/dívida, e **respeita "cada um paga o seu"** (ninguém fronta). A conexão com o app não some — ela vira **um toque opt-in** ("registrar minha parte"), que é a dose certa de "conectar com o app" sem transformar um jantar em contabilidade. **Bottom line:** padrão efêmero honra a fala do Julio e o benchmark; a integração é opcional e suficiente.

### Opponent (contra — deveria persistir/ledger)
Efêmero puro **joga fora dados valiosos**: o histórico de "quanto gastei dividindo", o aprendizado de orçamento, e os **combinados de dívida** (persona 5, persona 2-casa). O TripPilot **não é uma calculadora** — é um **copiloto de orçamento**; uma divisão que não alimenta o orçamento é uma oportunidade perdida de inteligência. Se o padrão é "não registra", o usuário **esquece** de registrar a parte dele e o orçamento fica furado. **Bottom line:** o default deveria **pelo menos registrar a minha parte** automaticamente (com opção de não), senão sabotamos o próprio DNA do app.

### Judge (veredito)
Os dois têm razão em metades diferentes. O **cálculo/entrega** deve ser **efêmero e rápido** (Proponent vence aqui) — ninguém deve ser forçado a criar dívidas pra ver quanto paga. Mas o **Opponent acerta** que "minha parte" não pode depender de o usuário lembrar. **Veredito:** *efêmero para a MESA, com um nudge forte (não silencioso, não obrigatório) de "registrar a sua parte de €X no orçamento"* ao fim — pré-marcado quando a divisão acontece dentro de uma viagem ativa, desmarcável em 1 toque. O **ledger completo** (dívidas dos outros) é opt-in claro para quem quer (persona 5). Assim: rápido por padrão, conectado por default-suave, contábil só sob demanda. **Vence a proposição, com a emenda do nudge forte para "minha parte".**

### Integration Architect (custom — conexão com o DNA do orçamento)
A ponte de ouro: a **minha parte vira UM `Transaction` limpo no trecho ativo** (categoria = categoria dominante da nota; descrição = nome do lugar), via `registerExpense` — **não** N itens, **não** dívidas. Antes de confirmar, passa pelo **simulador** (DEC-116): *"€27,80 — cabe no seu teto de hoje (sobra €40)"* ou *"consome ~1 das suas 3 jantas da fase"*. Isso transforma a divisão em **decisão de orçamento**, que é o único lugar onde o TripPilot vence Splitwise. Para a persona 5, a saída "ledger" reusa `commitReceipt` inteiro (vira Saída + shares + dívidas). **Bottom line:** "minha parte" = 1 gasto + leitura do simulador é a conexão mais poderosa e barata; o ledger fica como saída avançada.

### Share/Link Designer (custom — o link por pessoa)
Reusar `/s` (E2E) mudando **o enquadramento do payload**: hoje é "fatia de dívida com o dono"; para a mesa, é **"a sua parte desta conta"** — itemizada (*risoto €18 + ½ vinho €6,50 + serviço €2,30 = €26,80*), com **"ver a conta toda"** opt-in e, no Brasil, **"copiar valor / chave Pix"**. Um toque "mandar pra todos" gera os N links e abre o share sheet (reusa `SplitShareNudgeSheet` + `collectSplitNotifyTargets`). Quem não tem o app vê uma página linda read-only; quem quiser, "comece sua viagem". **Bottom line:** o link já existe — falta um **modo de apresentação "sua parte da conta"** e o gancho Pix; é UI sobre infra pronta.

### Síntese do Conselho 5
**Efêmero para a mesa + nudge forte (default-suave) para "registrar minha parte" + ledger opt-in + link "sua parte" com Pix.** É a formulação final da H. **Confiança: ALTA.**

---

## 10. Matriz de pontuação ponderada (as 5 abordagens)

Pesos derivados das prioridades que o Julio **repetiu** no áudio (velocidade/clareza acima de tudo; justiça; baixa fricção). Escala 1–5. Máx = 125.

| Critério (peso) | A | B | C | D | **H** |
|---|:---:|:---:|:---:|:---:|:---:|
| Velocidade & clareza do momento (×5) | 3 | 4 | 3 | 5 | **5** |
| Justiça & granularidade — cada-um-o-seu, taxa, meio-item (×4) | 4 | 4 | 5 | 1 | **5** |
| Baixa carga cognitiva / simplicidade na mesa (×4) | 3 | 4 | 3 | 5 | **4** |
| Conexão com o orçamento (DNA TripPilot) (×3) | 4 | 3 | 3 | 3 | **5** |
| Sem atrito de adoção — não exige todos com app/online (×3) | 3 | 4 | 2 | 4 | **4** |
| Reuso / custo de build (×2) | 5 | 3 | 3 | 5 | **4** |
| Diferenciação competitiva (×2) | 3 | 3 | 4 | 2 | **5** |
| Privacidade / local-first (×2) | 4 | 5 | 3 | 5 | **4** |
| **TOTAL PONDERADO (máx 125)** | **88** | **95** | **82** | **94** | **114** |

**Leitura:** H domina (114). B (95) e D (94) quase empatam — e **não por acaso**: H **é** a união do princípio efêmero de B com o caminho-rápido de D, realizada sobre o ativo de A (reuso). C (82) tem a maior nota de *justiça/diferenciação* mas é a pior em *atrito de adoção* → confirma seu lugar como **camada V2**. A (88) é a mais barata mas a mais fraca em *carga cognitiva/velocidade* → confirma que **empurrar tudo na tela densa atual é anti-padrão**.

---

## 11. 🏆 RANKING FINAL (o pódio)

### 🥇 1º lugar — **H: "Nota & Divisão" unificada** (114/125)
Uma feature só, escada de degraus (igual+taxa → claim por item → ao vivo V2), **taxa de serviço explícita rateada proporcionalmente**, **pessoas ad-hoc**, **saída plugável** (efêmero / minha-parte no orçamento / ledger), **cartão + link "sua parte" por pessoa**. **Vence as 5 personas.** É rápida por padrão, justa quando preciso, e a **única que conecta divisão + orçamento + grátis/sem-login + offline**.
> *Por que ganhou:* honra o "momento rápido" do Julio **sem** sacrificar o DNA de orçamento nem o ledger de quem precisa; reusa 70% do que existe; é a síntese que o teste de personas e os 5 conselhos convergem.

### 🥈 2º lugar — **B: fluxo efêmero dedicado "Dividir a conta"** (95/125)
Pureza máxima do "é um momento": calculadora separada, ad-hoc, nada toca o orçamento sem opt-in. **Perdeu para H por um motivo só:** criar uma **porta separada** ("Dividir conta" ao lado de "Escanear nota") gera **dois conceitos de dividir** que confundem o usuário (Crítico, Conselho 1) e **duplica** scan/split. H captura **todo o valor de B** (efemeridade, ad-hoc, sem-poluição) **dentro** da feature existente. Se um dia a tela unificada ficar pesada demais, B é o plano B literal.

### 🥉 3º lugar — **C: claim ao vivo multi-celular (estilo pay-at-table)** (82/125)
O maior "uau" e a maior justiça (cada um reivindica o seu no próprio celular, ao vivo). **Perdeu por atrito de adoção:** exige todos **online e dispostos a abrir link na hora** — irreal numa mesa barulhenta como **caminho obrigatório**, e o tempo real é best-effort. **É ouro como camada V2 sobre a H** (reusa `/s` + `ShareSignal`), depois que os degraus 1–2 provarem uso.

**Fora do pódio (com motivo):**
- **D — Igual + taxa (94):** pontuação altíssima, mas **não é um produto sozinho** (ignora "cada um o seu", que o Julio quer). Seu lugar correto é **ser o caminho-rápido padrão dentro de H** — e é por isso que H herda os 94 pontos de simplicidade de D.
- **A — empilhar na tela de nota atual (88):** a mais barata, mas **anti-padrão**: a `ReceiptScanPage` já é densa; somar claim+taxa+ad-hoc+cartões ali piora os dois usos. H usa o **código** de A (reuso) mas em **fluxo de passos**, não na mesma tela.

---

## 12. A recomendação detalhada (a H, pronta pra virar spec)

### 12.1 Fluxo completo (o que o Julio vê)
1. **Entrada** (uma porta, "Nota & Divisão"): **Escanear** (IA, opt-in) · **Digitar itens** · **Só o total** (atalho do bar/festival).
2. **Conta lida** → moeda + **linha de Taxa de serviço** (detectada da nota OU adicionada; default **rateio proporcional ao consumo**, alterna pra **por cabeça**; blindada contra contagem dupla — R1).
3. **"Como dividir?"** (fork):
   - **Por igual** → "quantas pessoas / quem?" (nomes ad-hoc opcionais) → cada um = (subtotal+taxa)/N.
   - **Cada um pega o seu** → visão **By Item** (rodízio "passa o celular": eu sou a Bianca → marco os meus → some pro próximo) **ou** **By Person**; **meio-item** (½/½) e **qty→2 donos** em 1 toque; ao fim, **detecção de órfãos** ("isto ninguém pegou").
   - **Só meu** → tudo é seu (vira 1 gasto, sem divisão).
4. **Resultado:** **cartão por pessoa** (*Bianca: risoto + ½ vinho + €2,30 serviço = €27,80*).
5. **Saída (escolha, com default-suave):**
   - **Nudge forte:** "**Registrar a sua parte (€27,80)** nesta viagem?" — **pré-marcado** quando há viagem ativa, desmarcável em 1 toque → vira **1 `Transaction`** no trecho ativo + **leitura do simulador** ("cabe no teto de hoje"). ← *a ponte com o DNA.*
   - **Mandar pra todos:** gera N **links "sua parte"** (reusa `/s`, E2E) + share sheet (WhatsApp); página read-only itemizada, **"ver conta toda"** opt-in, **"copiar pro Pix"**.
   - **Virar ledger** (avançado, persona 5): "lembrar quem me deve" → reusa `commitReceipt` (Saída + shares + dívidas + acerto).
   - **Descartar:** efêmero, nada persiste (mas o rascunho fica salvo local até confirmar — não perde o request de IA).

### 12.2 Regra da taxa de serviço (a fricção #1 do Julio)
- **Default = proporcional ao consumo** (padrão de mercado VERIFIED: SplitEven/ReceiptSplit/Supasplit) — quem pediu mais, paga mais taxa. Reusa a matemática de `matchItemsToReadTotal` (rateio proporcional exato ao centavo, último absorve arredondamento).
- **Alternativa = por cabeça** (taxa/N), 1 toque.
- **Anti-dupla-contagem (R1):** a IA deve classificar linhas "serviço/service/gorjeta/tax/IVA" como **taxa**, não item; se o usuário também ligar taxa manual, avisar.

### 12.3 Pessoas ad-hoc (não poluir a viagem — L4/R4)
- Novo tipo leve `SplitParticipant { id, name }` **efêmero**, só dentro da SplitSession.
- **Só** vira `Participant` da viagem **se** o usuário escolher a saída "ledger". Caso contrário, somem com a sessão. Resolve o medo de "criar 7 amigos por jantar".

### 12.4 Conexão com o orçamento (a resposta à pergunta do Julio "como conecta?")
- **Mínima e poderosa:** minha parte → **1 gasto** no trecho ativo + **simulador**. Não N itens, não dívidas. É o que diferencia de Splitwise.
- Opcional: a parte "compartilhada da casa" (persona 2) também pode virar 1 gasto.

### 12.5 O link "sua parte" (o WhatsApp do Julio)
- Reusa `/s` (E2E, sem app, sem login). **Novo enquadramento de payload:** itemizado "sua parte desta conta" (vs "fatia de dívida"). "Ver conta toda" opt-in do dono. Gancho **Pix** (copiar valor/chave).

---

## 13. Plano de gates proposto (faseamento, reuso, Tier 3)

| Gate | Escopo | Reusa | Novo | Esforço (cru→Tier 3) | Entrega |
|---|---|---|---|---|---|
| **G1** | Base + **Por igual** + **taxa explícita** + cartão por pessoa + entrada manual/"só total" | scan/IA, revisão, `splitEqually`, `matchItemsToReadTotal` | `domain/split-session` (puro), fork de modo, linha de taxa, cartões, `SplitParticipant` ad-hoc | ~45h→**15h** | Web/OTA (serve iOS+web+Android) |
| **G2** | **Cada um pega o seu**: By Item/By Person, claim por rodízio, **meio-item**, qty→2-donos, **órfãos** | `participantIds`, `resolvePayerExpense` | UI de claim (draft de cartas), detecção de órfãos, meio-item | ~60h→**20h** | Web/OTA |
| **G3** | **Ponte com o orçamento**: "registrar minha parte" (nudge forte) + leitura do simulador; saída "ledger" opt-in | `registerExpense`, simulador (DEC-116), `commitReceipt` | nudge de saída, mapeamento parte→gasto | ~18h→**6h** | Web/OTA |
| **G4 (V2)** | **Link "sua parte"** itemizado + Pix + "mandar pra todos" | `/s`, `ShareLinkSheet`, `SplitShareNudgeSheet`, `collectSplitNotifyTargets` | payload "sua parte", gancho Pix | ~20h→**7h** | Web/OTA |
| **G5 (V2)** | **Claim ao vivo multi-celular** (Abordagem C) | `/s`, `ShareSignal` DO (S7) | sessão de mesa ao vivo, claim remoto | ~45h→**15h** | Web/OTA (best-effort) |

**V1 = G1+G2+G3 ≈ 41h Tier 3 (~1 semana).** G4/G5 = V2.

---

## 14. Decisões em aberto para o Julio (batch — responder de uma vez)

1. **Persistência padrão:** concorda com **efêmero + nudge forte pré-marcado** para "registrar minha parte" (Conselho 5)? Ou prefere **sempre** registrar minha parte / **nunca** (calculadora pura)?
2. **Unificar ou porta separada:** evoluir a **tela de nota atual** numa "Nota & Divisão" (H, recomendado) ou criar uma **porta "Dividir conta"** dedicada (B)?
3. **Taxa de serviço default:** **proporcional ao consumo** (recomendado, padrão de mercado) ou **por cabeça**?
4. **Claim ao vivo (C):** é **V2** (recomendado) ou você quer já no V1?
5. **Pessoas ad-hoc:** ok com nomes leves que **não** viram Participant (a não ser no caminho ledger)?
6. **Pix no link:** incluir "copiar valor/chave Pix" no link "sua parte"? (encaixa no seu mercado-base)
7. **Escopo agora:** começa este épico **agora** (depois do Package #4 fechado) ou entra na fila depois do backlog atual?

---

## 15. DECs propostas (PENDING — não decididas)

> Nenhuma entra no `decision-log.md` até o Julio aprovar (truth policy do brain).

- **DEC-2xx (proposta) — Unificar "Nota & Divisão" (Abordagem H).** Evoluir a feature de nota numa função única com fork de modos (igual / cada-um-o-seu / só-meu), domínio puro `split-session` com saídas plugáveis. *Supersede parcial do enquadramento dono-cêntrico de DEC-206 no contexto de mesa.*
- **DEC-2xx (proposta) — Taxa de serviço como linha explícita, rateio proporcional default.** Reusa `matchItemsToReadTotal`; blindagem anti-dupla-contagem.
- **DEC-2xx (proposta) — Divisão efêmera por padrão + "registrar minha parte" (nudge forte) + ledger opt-in.** A ponte com o orçamento = 1 gasto + simulador; ledger reusa `commitReceipt`.
- **DEC-2xx (proposta) — `SplitParticipant` ad-hoc** (efêmero; só promove a `Participant` no caminho ledger).
- **DEC-2xx (proposta) — Link "sua parte"** (reusa `/s` E2E; payload itemizado; Pix opcional; claim ao vivo = V2 sobre `ShareSignal`).

---

## 16. Riscos & fontes

### Riscos-chave (detalhe na §8)
R1 taxa dupla (ALTA) · R2 sumir-com-combinado (MÉDIA) · R3 privacidade do link (MÉDIA, mitigada por E2E) · R4 poluição de Participants (MÉDIA, mitigada por ad-hoc) · R5 dependência de rede para scan (BAIXA, mitigada por manual/offline).

### Fontes (VERIFIED 2026-06-18)
- **Splitwise Pro** — scan + itemização (atribuir itens a pessoas) é **pago** ($4.99/mês), só câmera (sem galeria em 2026), **"everyone needs the app"**. Fontes: splitwise.com/pro, areweeven.com/blog/splitwise-free-vs-pro-2026, apps.apple.com (v26.5.5), blog.splitwise.com. *(HIGH)*
- **Apps dedicados de divisão por item (2026):** SplitEven (getspliteven.com), Split Check (splitcheck.app), **Supasplit** (supasplit.app), **ReceiptSplit** (receiptsplit.work). Padrão comum verificado: scan IA → itens+taxa+gorjeta → atribuir → **taxa/gorjeta proporcional ao consumo** → **link de cobrança sem o destinatário ter o app** → **offline** (só o scan precisa de net) → **By Person/By Item** → sem login. *(HIGH)*
- **Pay-at-table por QR:** TabSettle (tabsettle.com), Settl (getsettl.app), Plait (eatplait.com), Tably (tably.tech), me&u (meandu) — **claim ao vivo multi-device, sem app**, atualiza todas as telas na hora, "split em 60s para mesa de 6" — **mas dependem de integração com o PDV do restaurante**. *(HIGH)*
- **Gap (HIGH CONFIDENCE, inferência):** dos apps revisados, **nenhum** combina divisão-na-hora **+ offline-first + integração com orçamento prospectivo de viagem + grátis/sem-login/web+PWA+APK**. Não afirmo "ninguém no mundo faz" (não verificável); afirmo que **os concorrentes revisados não cobrem essa combinação**.
- **Grounding interno (leitura direta do código):** `ReceiptScanPage.tsx`, `domain/receipt/{types,parse}.ts`, `domain/orchestrators/receipt-orchestrators.ts`, `domain/splitting/splitting.ts`, `features/shared/SplitShareNudgeSheet.tsx`; brain DEC-206/207/208/209, product-spec §§5/9/25/26, technical-direction (Dexie v9, Worker `/ocr` + KV `SHARE_STORE` + `ShareSignal`). *(VERIFIED)*

---

*Status: brainstorm + 5 conselhos concluídos; recomendação H rankeada em 1º. Aguardando as 7 decisões da §14 para travar DECs e gerar o pacote de implementação (`/deliver`).*
