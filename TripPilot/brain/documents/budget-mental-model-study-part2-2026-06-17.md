# Estudo Profundo — Modelo Mental de Orçamento — PARTE II

> Data: 2026-06-17
> Continuação de: `budget-mental-model-study-2026-06-17.md` (Parte I)
> Status: **ESTUDO / PROPOSTA** — nada implementado; aprofunda as questões levantadas por Julio após ler a Parte I
> Método: investigação de código + pesquisa verificada + conselho inline (4 rodadas)

---

## 0. O que esta Parte II resolve

A Parte I definiu o modelo "Trecho + Pote" e foi aprovada na direção. Ao revisá-la, Julio levantou **6 questões novas e mais finas** que "mudam muita coisa" e pediu o mesmo tratamento profundo. Esta Parte II trata exatamente delas:

1. **Visibilidade de potes na Home** — não quero ver TODOS os potes na tela inicial. Tomorrowland em Burgos = ruído; "compras pessoais" talvez sim. Como decidir quem aparece? E afinal, **qual a real diferença entre um pote e outro** — será que "pote" é o conceito certo?
2. **Carteira é load-bearing** — na hora do gasto eu quero escolher se saiu do dinheiro físico, da Wise, da Revolut. E eu **importo extratos da Wise** como gastos, que mexem na carteira. Como conciliar "carteira opcional" com isso?
3. **Backend permanece completo** — manter carteiras/fundos/fases/viagem por baixo dos panos; o usuário não vê na cara, mas **vê em Configurações** ("visão avançada") e pode editar.
4. **Onboarding com contingências** — "valor da viagem → dividir em trechos" é ótimo, MAS: e se a soma dos trechos passar do total da viagem? Precisa de regras de "o que fazer e como".
5. **Pote precisa ser MUITO bem explicado** — "dinheiro à parte com finalidade própria" não é óbvio; precisa de exemplo guiado.
6. **Preservar especificidades sem regressão** — ritmo da fase, dias de pico, eventos são valiosos e simples; **não podem sumir**. Simplificar só o que confunde (vocabulário de fundo/carteira), não o que agrega.
7. **(bônus, levantada no fim)** **Fases sobrepostas / simultâneas** — dias de transição (15/07 ainda em Burgos e já começando a Eurotrip); e o caso hipotético de "Tomorrowland como fase EM CIMA da Eurotrip, as duas ao mesmo tempo". Faz sentido? Confunde? É possível?

### Decisões já batidas (Parte I, sessão 2026-06-17)
- **Vocabulário:** "Trecho" + "Pote".
- **Trecho estourado:** sugerir **remanejar de outro trecho com 1 toque** (não bloquear).
- **Modelo conceitual:** manter TODO o backend (Trip/Phase/Pool/Link/Envelope/Wallet); esconder do caminho feliz; expor em Configurações.

---

## 1. Novas evidências do código (verificadas nesta sessão)

### 1.1 Fases NÃO se sobrepõem hoje — o motor honra só UMA
`findActivePhase` retorna a **primeira** fase cujo intervalo `[startDate, endDate]` (fim inclusivo) contém o dia:

```5:13:TripPilot/src/domain/dates/dates.ts
export function findActivePhase(phases: Phase[], referenceDate: Date = new Date()): Phase | null {
  // BUG-002 (R6-02): compare by local day so the whole end date is inclusive —
  // parseISO(endDate) is midnight, which silently excluded the entire last day.
  const day = localDateString(referenceDate);
  const active = phases.filter((p) => p.deletedAt === null);
  return (
    active.find((p) => p.startDate.slice(0, 10) <= day && day <= p.endDate.slice(0, 10)) ?? null
  );
}
```

**Implicação:** se duas fases se sobrepõem (Burgos 06/06–15/07 e Eurotrip 15/07–04/08, ambas incluindo 15/07), em 15/07 o motor escolhe **a primeira do array** — comportamento não-determinístico do ponto de vista do usuário. Hoje **nada valida ou impede** sobreposição na criação, mas o motor **não foi desenhado para ela**. É um campo minado silencioso.

### 1.2 Wise import é amarrado a uma carteira (a carteira é estrutural para import)
O orquestrador de import recebe a carteira Wise e debita cada gasto importado dela:

```74:82:TripPilot/src/domain/orchestrators/import-orchestrators.ts
    const tx = createExpenseTransaction({
      tripId: input.tripId,
      phaseId: draft.phaseId ?? input.fallbackPhaseId,
      budgetPoolId: input.budgetPoolId,
      walletId: input.walletId,
      amountCents: draft.amountCents,
      currency: draft.currency,
      baseCurrencyAmountCents: draft.amountCents,
```

Transferências Wise→outra carteira **nunca tocam o orçamento** (`wallet_transfer`); um gasto da Wise debita a carteira E consome orçamento. Ou seja: **carteira = "de onde o dinheiro saiu"** é um eixo real e necessário — principalmente com import. Confirma a objeção do Julio: não dá para "remover" carteira.

### 1.3 TODOS os potes globais aparecem na Home, sempre
```386:390:TripPilot/src/features/dashboard/useDashboardModel.ts
    const globalPools = pools.filter((p) => p.scope === 'global' && p.deletedAt === null);
    const globalPoolSummaries = globalPools.map((pool) => ({
      pool,
      summary: createPoolSummary(pool, filterTransactionsByPool(transactions, pool.id)),
    }));
```

Nenhum filtro por data, relevância ou preferência. Hoje o Tomorrowland (pote global) **apareceria em Burgos** — exatamente a dor relatada. Existe, porém, infra de **dashboard configurável** (`DEC-119`: long-press no card → esconder/configurar) que pode ser reaproveitada.

---

## 2. Novas evidências da pesquisa (verificadas — 2026-06-17)

### 2.1 Dinheiro para evento futuro: existe, mas fica QUIETO até a data — YNAB Targets
**VERIFIED** — [support.ynab.com (Targets)](https://support.ynab.com/en_us/getting-started-with-targets-ryAEP08xC), [ynab.com/blog (Auto-Assign)](https://www.ynab.com/blog/auto-assign-in-ynab), [support.ynab.com (Underfunded)](https://support.ynab.com/en_us/underfunded-a-guide-BJwPhQO09)

- Uma categoria pode ter **valor-alvo + data ("needed by")**. O dinheiro para algo futuro **existe**, mas é **despriorizado** até a data chegar: *"Categories with a due date this month will be prioritized over categories with a target date out in the future."*
- Há **ícone de calendário** que só aparece quando uma despesa agendada está perto, e **soneca (snooze)** para silenciar uma categoria que não é prioridade agora.
- **Tradução p/ TripPilot:** um **Pote com janela de data** (Tomorrowland 23–26/07) deve ficar **recolhido/silencioso** até a data se aproximar — e então **subir** para a Home. Um **Pote sem data** (compras pessoais) é **sempre relevante**. Isso resolve "uns aparecem, outros não" com uma **regra, não com pergunta confusa**.

### 2.2 Carteira/conta é estrutural para IMPORT e RECONCILIAÇÃO — mas não para decidir "posso gastar?"
**VERIFIED** — [support.ynab.com (Reconcile)](https://support.ynab.com/getting-started-with-reconciling-accounts-an-overview-Sy3JWx4Js), [ynab.com/blog (Accounts don't match)](https://www.ynab.com/blog/accounts-dont-match-in-ynab)

- Contas existem para **importar** e **reconciliar** com o banco (a verdade do "onde está o dinheiro"). Toda transação importada entra numa conta específica.
- MAS a decisão "posso gastar isso?" se olha na **categoria** (para quê), não na conta (onde está) — princípio reafirmado da Parte I.
- **Tradução:** a carteira é o eixo **"de onde saiu / reconciliação / import"**; o trecho/pote é o eixo **"para quê / posso gastar"**. São **complementares, não concorrentes**. A carteira pode ficar **fora do caminho feliz do gasto manual**, mas precisa estar **presente e robusta** para quem tem múltiplas contas e/ou importa Wise.

### 2.3 Sobreposição de etapas: o mercado trata como ERRO; "duas coisas ao mesmo tempo" vira sub-elemento
**VERIFIED** — [1trip.app](https://1trip.app/), [Voyage Vault (MWM)](https://mwm.ai/apps/voyage-vault/6753010393), [TravelSmarty](https://travelsmarty.com/)

- **1trip** (Multi-City OS, 3–15 cidades): stops **sequenciais** com datas de chegada/saída, **"per-stop budgets"**, **"day trips as sub-destinations within each stop"**, e um validador que faz **"overlap detection"** — ou seja, **sobreposição é defeito a corrigir**, não recurso.
- **Voyage Vault**: o caso "dias sobrepostos longe da base" é modelado como **"side trip"** (uma sub-viagem), e várias viagens sob um **"trip group"** (guarda-chuva) — nunca duas etapas co-iguais simultâneas.
- **TravelSmarty**: cada destino pode ter **orçamento próprio**, e há um balde **"general expenses"** para o que não é de destino.
- **Tradução:** etapas principais (trechos) são **sequenciais**; "algo dentro de uma etapa" (Tomorrowland, um bate-volta) é **sub-elemento** (Pote/evento/sub-destino), não uma 2ª fase por cima. Dias de transição se resolvem com **fronteiras limpas** (um dia pertence a um trecho).

---

## 3. Conselho — Rodada II-1: Potes — visibilidade na Home e identidade

**Pergunta:** *Quais potes aparecem na Home, quando, e como isso é decidido? Qual a real diferença entre "Tomorrowland" e "compras pessoais"? "Pote" é mesmo o conceito certo, ou estamos forçando coisas diferentes no mesmo nome?*

Perspectivas: Advogado do Usuário · Arquiteto · Crítico · Simplificador.

### 👤 Advogado do Usuário
A dor é real e específica: *"eu não quero saber do Tomorrowland enquanto estou em Burgos, mas ele já gastou 50 € e eu preciso poder ver isso em algum lugar."* Logo, a regra não pode ser "todo pote na Home". A intuição certa: **a Home mostra o que é relevante AGORA**; o resto vive numa aba "Potes" (sempre acessível). Perguntar item a item "quer ver na Home?" é fricção — melhor o app **acertar por padrão** (pela data) e deixar o usuário **fixar/ocultar** se quiser. **Bottom line:** Home = potes relevantes agora; tudo some para uma aba "Potes"; pin/ocultar como ajuste fino.

### 🏛️ Arquiteto
Tecnicamente, "Tomorrowland" e "compras pessoais" são **o mesmo tipo** (`BudgetPool scope:'global'`). A única diferença é **janela de data**: Tomorrowland tem início/fim; compras pessoais não. Então **não precisamos de dois conceitos** — precisamos de **um Pote com data opcional**, e a visibilidade deriva disso:
- Pote **sem data** → sempre disponível (pode aparecer na Home; default: card discreto).
- Pote **com data** → fica em "Potes" e **sobe para a Home** dentro de uma janela (ex.: D-7 até o fim) — reusando o conceito de janela que já existe no countdown de fase (`COUNTDOWN_WINDOW_DAYS`, `DEC-153`).
Reaproveita o dashboard configurável (`DEC-119`) para pin/ocultar manual. **Bottom line:** 1 conceito (Pote) + atributo data opcional → visibilidade por regra; zero nova entidade.

### 🔴 Crítico
Cuidado com "esconder demais": se o Tomorrowland some completamente em Burgos, o usuário pode **esquecer que já comprometeu 50 €** e gastar como se tivesse mais. Risco MÉDIO de perder de vista um compromisso. Mitigação: mesmo recolhido, o pote precisa estar **a 1 toque** (aba "Potes" com badge) e o gasto antecipado deve aparecer no **extrato normal** (ele aconteceu de fato). Outro risco: regra de visibilidade "mágica" que o usuário não entende ("por que isso apareceu?"). Mitigação: microcopy explícita ("Tomorrowland começa em 6 dias"). **Bottom line:** esconder ≠ sumir; sempre 1 toque + extrato + microcopy do "porquê apareceu".

### ⚪ Simplificador
Não criar "tipos de pote". Um Pote = nome + valor + (opcional) janela de datas + (opcional) meta. A pergunta na criação é só: *"Tem data certa pra acontecer?"* Se sim, ele se comporta como evento (fica quieto, sobe perto da data). Se não, fica sempre à mão. **Bottom line:** 1 pergunta opcional ("tem data?") resolve toda a diferença de comportamento.

### Consenso
- **"Pote" é o conceito certo** — Tomorrowland e compras pessoais são o mesmo tipo; a diferença é **só a janela de data**.
- **A Home mostra potes relevantes agora**; uma aba **"Potes"** guarda todos, sempre a 1 toque.
- **Visibilidade por regra de data** (consagrada no YNAB), **+ pin/ocultar manual** (reusa `DEC-119`), **não** por pergunta item-a-item.
- O gasto antecipado **sempre** aparece no extrato (ele existe), mesmo com o pote recolhido.

### Divergência
- **Crítico vs. Simplificador** sobre o quão "escondido" o pote datado fica. Resolução: recolhido na Home, **visível na aba Potes com badge** + microcopy do porquê quando sobe.

### Síntese II-1
**Um conceito: Pote** = nome + valor + (opcional) **janela de datas** + (opcional) meta. Regra de visibilidade:
- Sem data → sempre disponível (card discreto na Home, pode ocultar).
- Com data → vive em "Potes"; **sobe para a Home** numa janela em torno das datas; microcopy "começa em N dias"; pode fixar/ocultar manualmente.
Isso responde "uns aparecem, outros não" com **regra clara**, sem perguntar nada confuso, e **resolve a dúvida de identidade** (é tudo Pote; só muda ter ou não data). O caso "compras pessoais" continua justificado por `DEC-011`/`DEC-041` (separar para não distorcer o gasto diário do trecho — análise de 2024).

**Confiança: ALTA** — alinha com YNAB (data-relevância + snooze), Monzo (pin/lock), e reusa mecânica interna existente (countdown, dashboard configurável).

---

## 4. Conselho — Rodada II-2: Carteira — opcional × load-bearing

**Pergunta:** *Como conciliar "carteira opcional por padrão" (Parte I) com (a) querer escolher a origem do gasto (dinheiro/Wise/Revolut) e (b) importar extratos da Wise, que mexem na carteira?*

Perspectivas: Arquiteto · Advogado do Usuário · Crítico · Estrategista.

### 🏛️ Arquiteto
Carteira (`Wallet`) é "onde o dinheiro está/de onde saiu". É **estrutural** para: import Wise (debita a carteira Wise), transferência entre carteiras (saque), reconciliação. A solução é **progressiva, dirigida por estado**, não um botão solto:
- **Estado simples (1 carteira):** o app tem 1 carteira default; o registro **não pergunta carteira** (cai na default). Carteira fica invisível — como a Parte I propôs.
- **Estado multi-conta (≥2 carteiras OU import Wise ativo):** a carteira **liga automaticamente** no registro (vira a 2ª pergunta: "de onde saiu?"). Não é o usuário que ativa um toggle abstrato — é o app que reage a um fato real (ele criou a Revolut, ou importou a Wise).
**Bottom line:** carteira não é "on/off por configuração"; ela **aparece quando passa a existir mais de uma** ou quando há import. Uma função (import) acende a outra (carteira).

### 👤 Advogado do Usuário
O Julio descreveu o gatilho perfeito: *"o principal é escolher se saiu do dinheiro físico, da Wise ou da Revolut."* Para quem tem várias contas, **a carteira é tão importante quanto o valor**. Então: para o turista médio (1 fonte), zero fricção; para o Julio (3 fontes + import), a carteira é primeira-classe. O erro seria forçar os dois no mesmo fluxo. **Bottom line:** o fluxo se adapta ao número de fontes do usuário — simples para um, completo para vários.

### 🔴 Crítico
O perigo é a **incoerência import × manual**: se o import Wise debita a carteira Wise mas o gasto manual não pede carteira, o saldo das carteiras fica **meio verdadeiro, meio vazio** — e a reconciliação (achado §2.2) perde sentido. Risco ALTO se o usuário acha que está controlando carteiras mas metade dos gastos não tem carteira. Mitigação: quando a carteira está "acesa", o "Carteira não informada" (`DEC-051`) precisa ser **visível e cobrável** ("N gastos sem carteira — revisar"). Quando está "apagada", nada disso aparece. **Bottom line:** se carteira está ligada, ela tem que valer para TODOS os gastos, senão vira saldo mentiroso.

### ♟️ Estrategista
A maioria esmagadora dos usuários tem 1 cartão/fonte e nunca importará nada — para eles, carteira é peso morto e deve sumir (alinha com a simplicidade que vende, Parte I §3.2). Mas o **usuário avançado (e o próprio Julio)** com Wise/Revolut + import é o **power user que valida e divulga o app**. Atender os dois com um modelo progressivo é o melhor dos mundos: simples por padrão, poderoso quando preciso. **Bottom line:** progressividade é vantagem competitiva, não meio-termo.

### Consenso
- Carteira **não pode ser removida**; é estrutural (import, transferência, reconciliação).
- **Padrão (1 fonte): invisível** no registro (cai na default) — como a Parte I.
- **Acende sozinha** quando há **≥2 carteiras** ou **import Wise** — vira a pergunta "de onde saiu?".
- Quando acesa, **vale para todos os gastos**; "sem carteira" passa a ser cobrável (`DEC-051`).
- Existe também a opção manual em Configurações ("controlar carteiras") para quem quer ligar sem ter 2 contas ainda.

### Divergência
- Pequena: ligar **automático** (Arquiteto/Advogado) vs **só por configuração** (mais previsível). Resolução: **automático com aviso** ("Você adicionou uma 2ª carteira — agora vou perguntar de onde sai cada gasto") + poder desligar em Configurações.

### Síntese II-2
Carteira é o eixo **"de onde saiu / import / reconciliação"** — complementar ao trecho/pote ("para quê"). Modelo **progressivo**: invisível com 1 fonte; **acende automaticamente** com 2+ carteiras ou import Wise, tornando-se a 2ª pergunta do gasto; quando acesa, cobre todos os gastos. Isso honra a simplicidade do iniciante **e** o controle multi-conta do Julio, e mantém o import Wise coerente.

**Confiança: ALTA** — respaldada pelo papel de contas no YNAB (import/reconcile) e pelo código atual (import já é wallet-bound).

---

## 5. Conselho — Rodada II-3: Fases sobrepostas / simultâneas (DEBATE)

**Proposição:** *"O TripPilot deve permitir fases sobrepostas / simultâneas (ex.: Tomorrowland como uma fase em cima da Eurotrip; ou dias de transição em que duas fases coexistem)."*

Modo: debate (Proponente vs Oponente vs Juiz) + Advogado do Usuário.

### ⚖️ Proponente — "Sim, deveria permitir"
A vida real é sobreposta: no dia 15/07 o usuário "ainda está saindo de Burgos e já começando a Eurotrip". E há quem queira um período especial (Tomorrowland) coexistindo com a Eurotrip, cada um com seu orçamento e ritmo. Permitir sobreposição deixaria o app "ajudar com esses dias", em vez de forçar uma fronteira artificial. Reusaria toda a maquinaria de fase (ritmo, eventos, contadores) para o período especial.

### ⚔️ Oponente — "Não; isso quebra o modelo e confunde"
Quatro argumentos:
1. **O motor não suporta** (achado §1.1): `findActivePhase` retorna **uma** fase. Com duas ativas no mesmo dia, "Livre hoje" fica **ambíguo** (de qual fase?). Suportar de verdade significaria **somar/repartir** dois orçamentos no mesmo dia — explosão de complexidade no número mais sagrado do app.
2. **O mercado trata como erro** (achado §2.3): 1trip faz *overlap detection* como defeito; Voyage Vault usa **side trip**; ninguém faz duas etapas co-iguais ao mesmo tempo. Há razão: sobreposição de "quando" não tem resposta única para "quanto posso gastar hoje".
3. **Confunde mais, não menos.** O usuário já se perdeu com fundo×fase. "Duas fases hoje, qual vale?" é pior. Contradiz o objetivo desta força-tarefa (simplificar).
4. **Os dois casos reais têm solução melhor SEM sobreposição:**
   - **Dia de transição (15/07):** é uma **fronteira**, não uma sobreposição. Resolve-se com regra clara (o dia pertence a um trecho — recomendação: o que **começa** ganha o dia, ou o usuário escolhe). Zero ambiguidade.
   - **Tomorrowland coexistindo:** é um **Pote** (Parte I) — dinheiro à parte que convive com a Eurotrip **sem ser uma fase**. Já resolvido, e melhor (aceita gasto antecipado, não fragmenta a Eurotrip).

### 👤 Advogado do Usuário
"Duas fases hoje" obriga o usuário a responder, toda vez, "de qual fase é esse gasto?" — a pergunta que mais cansa. O que ele realmente quer é: (a) que o dia de virada não seja um buraco, e (b) ver o dinheiro do Tomorrowland conviver com a Eurotrip. Ambos se entregam **sem** sobreposição: fronteira limpa + Pote. Sobreposição entregaria poder que ninguém pediu ao custo de confusão que todos sentem.

### 👨‍⚖️ Juiz — veredito
O Proponente acerta no **problema** (transição e coexistência são reais), mas erra na **solução** (sobreposição de fases). O Oponente vence em todos os pontos materiais: motor, mercado, simplicidade e a existência de soluções melhores. **Veredito: NÃO suportar fases sobrepostas/simultâneas.** Em vez disso:
- **Dia de transição:** tratar fronteira explicitamente — **validar e impedir** sobreposição na criação (avisar "as datas se encavalam — ajuste"); definir regra do dia-limite (default: o trecho que **começa** leva o dia; permitir trocar).
- **Coexistência de orçamento especial:** **Pote** (já decidido). Se o usuário quiser ritmo/eventos próprios para esse período, isso é candidato a um **"sub-trecho" V2** (um trecho aninhado dentro de outro, sem sobrepor o eixo "quando" do trecho-pai) — mas **fora de escopo agora** e só se houver demanda real.

### Síntese II-3
**Fases são sequenciais, nunca sobrepostas.** Adicionar **validação que impede sobreposição** (corrige o campo minado do §1.1) + **regra do dia de fronteira**. Os dois desejos legítimos (transição, coexistência) já têm solução melhor: fronteira limpa e **Pote**. "Sub-trecho aninhado" fica anotado como possível V2, não agora.

**Confiança: ALTA** — convergência total + respaldo de mercado + limitação técnica concreta do motor.

---

## 6. Conselho — Rodada II-4: Onboarding — contingências, especificidades e visão avançada

**Pergunta:** *Como fazer "valor da viagem → dividir em trechos" com contingências sólidas (soma dos trechos ≠ total)? Como explicar "Pote" com exemplo? Como preservar ritmo/pico/eventos sem regressão? Como expor o backend em Configurações?*

Perspectivas: Simplificador · Arquiteto · Advogado do Usuário · Crítico.

### 6.1 Contingência: total da viagem × soma dos trechos
**Fato do código:** hoje **não existe "orçamento da viagem"** — `Trip` não tem `totalAmountCents`; o dinheiro vive nos pools. O "total" do onboarding de 1 pergunta vira, na prática, o orçamento do 1º trecho/pool. Então "dividir em trechos" precisa de uma regra de origem da verdade.

- **Arquiteto:** duas arquiteturas possíveis:
  - **(A) Total é derivado** = soma dos trechos + potes. Não há "número da viagem" separado; o total **é** a soma. Simples, sem conflito possível. O onboarding de 1 pergunta cria 1 trecho com aquele valor; ao dividir, o usuário cria novos trechos e **realoca** o valor.
  - **(B) Total é teto declarado** = o usuário fixa "a viagem toda tem X"; os trechos consomem desse X; sobra = "não alocado"; excesso = aviso.
  - Recomendação: **(A) como padrão mental** ("seu total é o que você distribuiu"), com um **resumo sempre visível** ("Viagem: 1.437 € = Burgos 628 + Eurotrip 678 + Volta 131"). Opção (B) só se o usuário quiser "travar um teto".
- **Crítico:** o perigo é o usuário digitar 1.437 no onboarding e depois somar trechos que dão 1.500 sem perceber. Precisa de **feedback imediato**: ao editar trechos, mostrar "Distribuído: X / Total: Y" com **cor de alerta** se passar, e a ação **"sugerir ajuste"** (reusa a mecânica de remanejar da Parte I). Nunca bloquear (`DEC-053`), sempre avisar.
- **Advogado do Usuário:** o usuário pensa em **dinheiro que tem**, não em teto abstrato. Logo, **(A)** é mais natural: "tenho 628 aqui, 678 aqui, 131 aqui" → a viagem é 1.437. Se ele preferir começar pelo total e dividir, o app divide e ele ajusta cada trecho, sempre vendo "quanto falta distribuir".

**Regra recomendada (contingências):**
1. Total da viagem = **soma dos trechos + potes** (derivado), exibido sempre.
2. Fluxo "começar pelo total e dividir": ao criar trechos, mostrar **"Falta distribuir: €X"** ou **"Você passou €X do total — ajustar?"**.
3. Excesso nunca bloqueia; oferece **"reduzir outro trecho"** ou **"aumentar o total da viagem"**.
4. Potes são **adicionais** ao total dos trechos (Tomorrowland +200 não some nos 1.437) — deixar isso explícito no resumo ("+ Potes: 200 €").

### 6.2 Explicar "Pote" com exemplo guiado
- **Simplificador / Advogado:** nunca usar a frase abstrata "dinheiro à parte com finalidade própria" sozinha. A criação de Pote deve **ensinar com exemplo**:
  > *"Tem algum dinheiro guardado para uma finalidade específica, separado do dia a dia? Ex.: um festival ou show, compras/souvenirs, um passeio caro, um presente. Você pode ir gastando dele ao longo da viagem — até antes de chegar a hora."*
  - Oferecer **chips de exemplo** ("Festival/Show", "Compras pessoais", "Passeio especial", "Presentes", "+ Outro") que pré-preenchem nome e (se aplicável) sugerem data.
  - Mostrar o "porquê": *"assim ele não se mistura com seu gasto do dia a dia."* (a razão de `DEC-041`).
- **Resultado:** o usuário chega ao "Tomorrowland = Pote Festival" **sozinho**, guiado por exemplo, sem precisar entender a teoria.

### 6.3 Preservar especificidades sem regressão (ritmo, pico, eventos)
- **Crítico (alerta de regressão):** ritmo da fase (`DEC-075`), dias de pico (`DEC-075`), atividades por fase (`DEC-074`), eventos (`DEC-072`) são **valor real e diferencial** — e o Julio confirmou que são **simples** ("qual a intensidade?", "quais dias gastam mais?" são perguntas que o usuário entende). **NÃO podem ser removidos** na cruzada de simplificação.
- **Princípio (registrar como regra):** **simplificar o que CONFUNDE (vocabulário fundo/pool/link/carteira), preservar o que AGREGA e é compreensível (ritmo, pico, eventos, atividades).** A simplificação é de **arquitetura de informação e nomenclatura**, não de **capacidade**.
- **Como conciliar:** progressividade. A criação de trecho pede **primeiro o essencial** (nome + datas + valor) e oferece **depois, opcional**, "ajustar ritmo e dias de pico" e "eventos deste trecho" — cada um com microcopy clara e **pulável**. Quem quer o básico, termina em 10s; quem quer afinar, tem tudo.

### 6.4 Visão avançada em Configurações ("por baixo dos panos")
- **Arquiteto / Estrategista (do Julio):** manter Trip/Phase/Pool/Link/Envelope/Wallet no backend; **expor em Configurações → "Visão avançada da viagem"** uma tela que mostra a estrutura crua (fundos, vínculos, envelopes, carteiras) — somente para quem quer entender/editar. O caminho feliz nunca mostra isso; o curioso/power-user encontra e **aprende** com ele.
- Isso satisfaz literalmente o pedido: *"não na cara, mas se entrar nas configurações ele pode ver o que está acontecendo por baixo dos panos."*

### Síntese II-4
- **Total da viagem = soma de trechos (+ potes à parte)**, sempre visível; contingências por **aviso e sugestão de ajuste**, nunca bloqueio.
- **Pote sempre criado com exemplo guiado** (chips), explicando o "porquê".
- **Regra anti-regressão:** simplificar nomenclatura/IA, preservar ritmo/pico/eventos/atividades como passos **opcionais e progressivos**.
- **Configurações → "Visão avançada da viagem"** expõe o backend para quem quiser.

**Confiança: ALTA.**

---

## 7. Recomendações consolidadas (Parte II)

| Tema | Recomendação | Confiança |
|---|---|---|
| **Identidade do Pote** | 1 conceito "Pote" = nome + valor + **data opcional** + meta opcional. Sem "tipos". | ALTA |
| **Visibilidade na Home** | Potes **sem data**: sempre disponíveis (card discreto, ocultável). Potes **com data**: vivem na aba "Potes", **sobem para a Home** numa janela perto das datas (microcopy "começa em N dias"). Pin/ocultar manual reusa `DEC-119`. | ALTA |
| **Gasto antecipado** | Sempre aparece no extrato; pote a 1 toque mesmo recolhido. | ALTA |
| **Carteira** | **Progressiva**: invisível com 1 fonte; **acende** com 2+ carteiras ou import Wise (vira "de onde saiu?"); quando acesa, cobre todos os gastos; toggle manual em Configurações. | ALTA |
| **Fases sobrepostas** | **Não suportar.** Validar e **impedir sobreposição** na criação; **regra do dia de fronteira** (default: trecho que começa leva o dia). Coexistência especial = Pote; "sub-trecho aninhado" = possível V2. | ALTA |
| **Onboarding total×trechos** | Total = **soma dos trechos** (+ potes à parte), sempre visível; contingências por aviso/sugestão, nunca bloqueio. | ALTA |
| **Explicar Pote** | Criação **com exemplo guiado** (chips) + o "porquê" (não misturar com o dia a dia). | ALTA |
| **Anti-regressão** | Simplificar **nomenclatura/IA**, preservar **ritmo/pico/eventos/atividades** como passos **opcionais e progressivos**. | ALTA |
| **Visão avançada** | Configurações → "Visão avançada da viagem" expõe fundos/vínculos/envelopes/carteiras. | ALTA |

### Como a Europa 2026 fica (modelo completo, Partes I + II)
- **Trechos (sequenciais, fronteira limpa):** Burgos 628 (06/06–15/07) · Eurotrip 678 (16/07–04/08) · Volta 131 (05/08–16/08). Total da viagem = **1.437 €** (mostrado como soma).
- **Pote Tomorrowland**: 200 €, **com janela 23–26/07**. Em junho/Burgos ele fica na aba "Potes" (não polui a Home), mas o gasto de **50 €** aparece no extrato e o saldo do pote vai a 150 €. Lá por **~17/07** ele **sobe para a Home** ("Tomorrowland começa em 6 dias").
- **Pote Compras pessoais** (opcional): sem data → card discreto sempre disponível.
- **Carteira:** se o Julio cadastrar Wise + Revolut + dinheiro (ou importar Wise), o registro passa a perguntar "de onde saiu?"; senão, fica invisível.
- **Ritmo/pico/eventos:** continuam disponíveis por trecho, como passos opcionais.

---

## 8. Decisões necessárias do Julio (Parte II)

1. **Visibilidade de pote datado:** concorda com **subir para a Home numa janela perto da data** (ex.: D-7)? Qual janela (7/5/3 dias)?
2. **Aba "Potes":** criar uma aba/seção dedicada "Potes" (lista todos, sempre)? (Recomendado: sim.)
3. **Carteira progressiva:** concorda em **acender automaticamente** ao ter 2+ carteiras ou import Wise (com aviso), em vez de só por configuração?
4. **Dia de fronteira:** o dia-limite (ex.: 15/07) deve pertencer por padrão ao trecho que **começa** (Eurotrip) ou ao que **termina** (Burgos)? (Recomendação: o que começa; sempre editável.)
5. **Total da viagem:** confirma o modelo **(A) total = soma dos trechos** (com potes à parte), em vez de um teto declarado? Quer também a opção de **travar um teto** (B) como avançado?
6. **Sub-trecho aninhado (V2):** quer que eu mantenha isso no radar para quando um período especial precisar de ritmo/eventos próprios (além de dinheiro)? Ou descartar de vez?

---

## 9. Resumo executivo (Parte II)

As 6 questões novas do Julio têm respostas convergentes e bem fundamentadas. **Potes** não precisam de tipos: é um conceito só com **data opcional**, e a visibilidade na Home segue **relevância de data** (padrão YNAB) + pin/ocultar — resolvendo "não quero o Tomorrowland em Burgos" sem perguntas confusas e dissolvendo a dúvida "é mesmo um pote?". **Carteira** não pode ser removida (é estrutural para import Wise e reconciliação, confirmado no código e no YNAB); a solução é **progressiva** — invisível para quem tem 1 fonte, primeira-classe para quem tem várias contas ou importa. **Fases sobrepostas** devem ser **proibidas** (o motor honra só uma, o mercado trata overlap como erro, e os dois desejos reais — transição e coexistência — já têm solução melhor: fronteira limpa + Pote); cabe **adicionar validação** que impede sobreposição. O **onboarding** usa total = soma dos trechos com contingências por aviso (nunca bloqueio), **Pote criado com exemplo guiado**, e a regra de ouro **anti-regressão**: simplificar só o vocabulário confuso (fundo/carteira), **preservar** ritmo/pico/eventos como passos opcionais. Por fim, o backend completo permanece, exposto numa **"Visão avançada da viagem"** em Configurações. Nada disso exige refundar o schema — é orquestração, regra de visibilidade, validação e nomenclatura.
