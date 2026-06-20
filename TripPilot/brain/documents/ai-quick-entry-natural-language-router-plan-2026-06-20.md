# Entrada Rápida por IA — Roteador de Linguagem Natural (texto + voz) → todas as funções do app

> Last updated: 2026-06-20
> Status: **RESEARCH + BUILD-READY (proposta DEC-246)** — deep dive + 5 conselhos inline + arquitetura aterrada no código + gates G0–G3 com ACs e testes. Aguardando o "vai" do Julio (ou ajuste de escopo) antes de implementar.
> Scope owner: Julio (Product Lead). Origem: relato de campo de 2026-06-19 ("fui pro bar; marcar cada bebida no modo saída é lento; quero abrir uma caixa, escrever/falar 'o Bruno me pagou uma cerveja de 2 euros' e o app ser inteligente o bastante pra decidir o que fazer — conectar TODAS as funções à IA").
> Method note: todos os conselhos abaixo rodaram **inline, numa única sessão (sem subagentes)** conforme `inline-council-no-subagents.mdc`. Cada afirmação de estado está aterrada no código atual (refs inline). Capacidades do Groq verificadas via web em 2026-06-20 (§16). Nenhuma alegação de "ineditismo" (conforme `fact-verification.mdc`).

---

## 0. TL;DR (o que importa)

O atrito real não é "faltar funções" — o TripPilot já tem registro de gasto, dívida, divisão de conta, saída ao vivo, escanear nota, planejar compra/evento, transferência/saque, acerto de contas, renda. O atrito é **chegar até a função certa e preencher os campos** (valor, categoria, onde, quando, quem, dividir?) no meio de um bar.

**A proposta:** uma **caixa única** (como mandar uma mensagem) onde o usuário **escreve ou fala** uma frase em linguagem natural, e a IA:
1. **entende** a intenção e extrai as entidades (texto → JSON estruturado, via Groq — o mesmo provedor já usado no `/ocr`);
2. **resolve no aparelho** quem/onde/qual carteira/categoria/quando (ex.: "Bruno" → `Participant`; se não existe, pergunta; se há dois, pergunta qual);
3. **mostra uma prévia** ("Você vai registrar: Cerveja €2 · você deve €2 ao Bruno · Bar X · agora") com **Confirmar / Ajustar / Cancelar**;
4. **executa** chamando os **orquestradores que já existem** (nada de lógica financeira nova), com **desfazer** (DEC-126).

**A decisão de arquitetura que destrava tudo:** a IA é o **planejador** (entende e propõe um plano tipado), o **app é o executor** (resolve ids, faz as contas com os engines determinísticos, grava). Isso mantém **toda a lógica de dinheiro no aparelho** (coerente com "o worker é uma fronteira fina; o domínio no cliente é a fonte da verdade"), evita erro de aritmética do modelo, e **conecta a IA a todas as funções** sem reescrever nenhuma — basta um **registry de intents** que mapeia 1:1 para os orquestradores existentes.

**Por que não "tool-calling no servidor":** o Groq **não permite combinar tool-calling com structured output no mesmo request** (VERIFICADO §16) e a execução de ferramentas no servidor exigiria mandar o razão financeiro pra fora do aparelho (regressão de privacidade). Logo: **JSON mode** (já provado no `/ocr`) + **dispatch no cliente**. Tool-calling fica documentado como alternativa futura, fora do V1.

**Texto primeiro, voz logo em seguida.** Texto é o caminho mais rápido e confiável de digitar uma frase curta; a voz ("aperta, fala, vai embora") entra no gate seguinte com **dois motores**: Web Speech (instantâneo, onde houver) e **Whisper no Groq** (`/transcribe`, caminho seguro pro APK, <2s, ~US$0,02/h — VERIFICADO §16).

---

## 1. Visão & job-to-be-done

> "Era muito difícil toda vez que pego a bebida ir lá e marcar, mesmo no modo saída. Perco tempo marcando o que foi, onde foi… Quero uma entrada rápida de IA: falo 'o Bruno me pagou uma cerveja de 2 euros' e ele já é inteligente o bastante pra ver onde estou, qual bar mais perto, que horas, quem é o Bruno. Se o Bruno não existe, pergunta; se tem dois Brunos, pergunta qual. Conectar TODAS as funções à IA pra ela decidir o que fazer agora. Abro a caixa, escrevo/falo, fecho e envia — como uma mensagem." — Julio, 2026-06-19

**Job-to-be-done:** *"Quero registrar o que acabou de acontecer com o mínimo de toques — idealmente uma frase — e deixar o app descobrir qual ação e quais detalhes."*

Princípios de produto que isto precisa honrar (do brain):
- **Nunca bloquear registro** (DEC-053) — a frase sempre vira algo; na pior hipótese, abre o QuickAdd pré-preenchido.
- **Nada de mudança silenciosa de dinheiro** (Core Rule #7/#8) — toda escrita passa por prévia/confirmação e tem desfazer.
- **Privacidade primeiro / opt-in** (ÂNCORA 8, igual `cloudReceiptOcrEnabled`) — a foto/voz/texto só sai do device com consentimento; provedor no-train; fallback manual sempre disponível.
- **Reuso > reinvenção** — despachar para orquestradores existentes; zero lógica financeira nova.
- **Local-first** — o modelo nunca executa dinheiro nem faz conta; ele extrai; os engines do device calculam.

---

## 2. Estado atual (aterrado no código)

### 2.1 A IA que já roda (é **Groq**, não xAI Grok)
- O `/ocr` do Worker (`worker/src/index.ts:110-220`) manda a foto da nota para o **Groq** (`https://api.groq.com/openai/v1/chat/completions`, modelo `meta-llama/llama-4-scout-17b-16e-instruct`) com `temperature:0` e **`response_format: { type: 'json_object' }`**, e devolve o JSON cru. O segredo `GROQ_API_KEY` vive **só** como secret do Worker (`Env.GROQ_API_KEY`, `index.ts:36-40`); ausente → `503 ocr_not_configured` (degradação graciosa).
- Cliente: `extractReceiptViaCloud(imageDataUrl)` (`src/utils/ai-ocr.ts`) faz `POST ${getSyncWorkerUrl()}/ocr`, dobra todo erro de transporte num erro tipado (`not_configured | rate_limited | offline | failed`) e normaliza via `parseReceiptResponse`. Worker base: `https://trippilot-sync.trippilot.workers.dev` (`src/data/sync/config.ts`).
- Opt-in: `AppSettings.cloudReceiptOcrEnabled` (default **false**, `src/domain/types/app-settings.ts:116-120`). **Este é o padrão exato a copiar** para o novo recurso.

> Nota: o Julio chama de "Grok"; tecnicamente é **Groq** (provedor de inferência LPU rodando Llama/GPT-OSS/Whisper). A confusão não muda nada — o mesmo Worker/secret/modelo já está em produção.

### 2.2 A infraestrutura de voz que já existe
- `src/utils/speech-recognition.ts` — `isSpeechRecognitionSupported()`, `startVoiceCapture(language, handlers)`, `toSpeechLocale()` (pt-BR/en-US/es-ES). Web Speech API, single-shot, degrada para "unsupported".
- `src/domain/transactions/voice.ts` — `parseVoiceExpense(transcript)` (regex: pega o 1º número como valor, limpa verbos/moeda, resto vira descrição). É o **fallback offline** perfeito.
- Limitação conhecida: Web Speech é **inconstante na WebView do Android (APK)**. Daí o caminho Whisper no Worker (§8).

### 2.3 As "funções" que a IA vai acionar (orquestradores existentes — `src/domain/orchestrators/index.ts`)
Todas já são atômicas, testadas e usadas pelas telas atuais:

| Intenção do usuário | Orquestrador / entrada existente |
|---|---|
| Registrar gasto (e dívida quando alguém pagou) | `registerExpense` + `buildSharesWithPayer`/`resolvePayerExpense` |
| Registrar renda | `registerIncome` |
| Dividir a conta da mesa | `commitSplit` (fluxo `Dividir conta`, `/split/scan`) |
| Escanear nota → itens → dividir | `commitReceipt` (`/split/scan` ou Receipt) |
| Iniciar saída (sessão ao vivo) | `startOneOffEventSession` / `startSessionForOccurrence` |
| Adicionar rodada/item à saída ativa | `quickAddSessionExpense` / `addRoundExpenses` / `repeatLastSessionItem` |
| Planejar uma compra | `addPlannedPurchase` |
| Planejar um gasto/evento (com reserva/data) | `createPlannedExpense` (`routePlannedExpense`) |
| Transferir entre carteiras | `transferBetweenWallets` |
| Sacar dinheiro | `withdrawCash` |
| Acertar contas / quitar dívida | `createSettlement` / `proposeSettlement` |
| Adicionar pessoa (participante) | repositório `participant` (+ `pairParticipantFromIdentity` quando QR) |

### 2.4 O modelo de dívida (recém-consertado) que herdamos de graça
A épica "está me devendo" (DEC-241, v0.99.5–0.99.7) deixou o terreno pronto:
- `resolvePayerExpense` (tabela-verdade DEC-114) — "outro pagou, sem dividir → eu devo o valor cheio a ele" é exatamente o caso "Bruno me pagou uma cerveja".
- `resolveShareBirthStatus` (DEC-241/DL-1, `splitting.ts:115`) — para um amigo **não conectado** (sem device pareado/link), a parte **nasce `confirmed`** → a dívida aparece **na hora** em `/shared`, dashboard e Copiloto. Ou seja: criar a dívida via IA já reflete corretamente sem nenhum trabalho extra.

### 2.5 A "inteligência de contexto" que já existe
- **Pessoas:** `Participant { name, nickname, isOwner, linkedActorId }` por trip → base para resolver "Bruno".
- **Lugar/"bar mais perto":** captura opt-in de localização + nome reverso + **POIs próximos** (DEC-157/166), `currentPlace` em `AppSettings`, `buildPlaceSuggestions` (busca acento-insensível).
- **Fase ativa / pool:** `resolveActivePhase` + pool da fase ativa (DEC-219).
- **Carteira:** rastreamento progressivo (DEC-222) — só pergunta "de onde saiu?" com 2+ carteiras/Wise.
- **Categoria:** taxonomia de ~110 subcategorias com ordenação por proximidade de valor (DEC-095).
- **Multi-moeda / horário:** valor/moeda original preservados (DEC-158); hora por expense.

**Conclusão do mapa:** não falta capacidade; falta uma **camada de tradução** "frase → intenção → função" e a **cola de resolução** de entidades. É um trabalho de **orquestração + UX**, de baixo risco para o dinheiro (os engines não mudam).

---

## 3. A grande decisão de arquitetura — Planejador (nuvem) × Executor (device)

Duas camadas, fronteira nítida:

```
            ┌────────────────────────── DEVICE (fonte da verdade) ──────────────────────────┐
"texto/voz" │  AssistantSheet → useAssistant (máquina de estados)                            │
   ───────► │     │                                                                          │
            │     ├─(voz)→ Web Speech  ──ou──  /transcribe (Groq Whisper)  → transcript      │
            │     │                                                                          │
            │     ├─ context pack (NOMES e rótulos, sem ids, sem valores) ──────────┐        │
            │     ▼                                                                  ▼        │
            │  utils/ai-assistant.ts ──POST /assistant──►  WORKER (fino, stateless) ─► Groq   │
            │     ▲                                       response_format: json_object        │
            │     │  AiIntent JSON (intenção + entidades por NOME + confiança + perguntas)    │
            │     ▼                                                                          │
            │  domain/assistant/resolve.ts  (NOME→id no device: pessoa/carteira/categoria/    │
            │     │   lugar/data; gera clarifications quando 0/2+ matches)                    │
            │     ▼                                                                          │
            │  domain/assistant/dispatch.ts (orquestrador) → registerExpense / commitSplit /  │
            │     │   createSettlement / addPlannedPurchase / transfer / …  (ENGINES fazem a  │
            │     ▼   matemática; debt nasce confirmed p/ não-conectado — DEC-241)            │
            │  Prévia → Confirmar → grava → toast com Desfazer (DEC-126)                      │
            └───────────────────────────────────────────────────────────────────────────────┘
```

**Por que essa divisão (e não o modelo "agente executa ferramentas no servidor"):**

1. **Privacidade.** Só sai do device a **frase** + um **context pack mínimo** (nomes/apelidos de participantes, nomes de carteiras, rótulos de categoria, nome do lugar atual, hora, moeda, idioma). **Nunca** o razão, histórico ou valores. Opt-in e no-train, como o `/ocr`. (Há um modo "sem nomes" — §6.)
2. **Segurança financeira.** O modelo **propõe** um plano tipado; ele **nunca** grava dinheiro. O cliente valida, mostra prévia e o usuário confirma. Honra "nada de mudança silenciosa" (Core Rule #7) e "todo número é explicável" (#8).
3. **Determinismo.** O modelo **não faz conta** — extrai "2 euros"; o **engine** (`buildSharesWithPayer`/`resolvePayerExpense`) constrói a dívida. Elimina erro de aritmética de LLM.
4. **Reuso total.** O `dispatch` chama os **mesmos orquestradores** das telas. Conectar "todas as funções" = preencher o **registry de intents** (§4) — sem tocar em lógica financeira.
5. **Restrição técnica verificada.** Groq não combina `tools[]` + `response_format` no mesmo request (§16). JSON mode já está provado no `/ocr`. Então o caminho de menor risco e já validado é structured-JSON + dispatch no cliente.

---

## 4. O registry de intents — "expor todas as funções à IA"

Definir uma união discriminada `AiIntent` em `domain/assistant/intent.ts`. O modelo devolve **um** item com `confidence` (0–1) e, quando faltar dado, `clarifications[]`. **Entidades vêm por NOME/rótulo** (o device re-resolve para id — o modelo nunca recebe id).

| `kind` | Gatilho de exemplo (PT) | Orquestrador / destino | Campos extraídos |
|---|---|---|---|
| `register_expense` | "gastei 12 no mercado" | `registerExpense` | amount, currency?, categoryLabel?, description, when?, placeLabel?, walletLabel? |
| `someone_paid_for_me` | "o Bruno me pagou uma cerveja de 2 euros" | `registerExpense` (payer=outro, sem split → **eu devo o cheio** a Bruno, DEC-114 linha 4) | amount, personName, description, … |
| `i_paid_for_someone` | "paguei 30 do jantar da Ana" | `registerExpense` (payer=eu, split com Ana → **Ana me deve**) | amount, personName(s), split?, … |
| `settle_debt` | "acertei com o Bruno", "o Bruno me pagou os 20 que devia" | `createSettlement` | personName, amount?, direction |
| `split_bill` | "dividir a conta da mesa", "dividir 80 entre eu, Bruno e Ana" | seed do `Dividir conta` → `commitSplit` (`/split/scan`) | total?, personNames[], mode? |
| `scan_receipt` | "subir uma nota", "escanear o recibo" | abrir Receipt/`/split/scan` (câmera) | (nenhum) |
| `start_outing` | "tô indo pro bar", "começar uma saída" | `startOneOffEventSession` | type?, ceiling?, placeLabel? |
| `add_outing_item` | (saída ativa) "mais uma cerveja de 3" | `quickAddSessionExpense`/`addRoundExpenses` | amount, qty?, description |
| `plan_purchase` | "preciso comprar um presente, uns 50" | `addPlannedPurchase` | estimate, description, reserve? |
| `plan_expense` | "sábado tem o show, reserva 100" | `createPlannedExpense` | amount, date, reserve?, funding? |
| `transfer` | "passei 50 do Wise pra carteira" | `transferBetweenWallets` | amount, fromLabel, toLabel |
| `withdraw` | "saquei 100 no caixa" | `withdrawCash` | amount, walletLabel? |
| `register_income` | "recebi 200 de reembolso" | `registerIncome` | amount, description |
| `add_participant` | "adiciona o Bruno" | repo `participant` | name |
| `query` *(G3, read-only)* | "quanto o Bruno me deve?", "quanto posso gastar hoje?" | derivações do Copiloto/Dashboard (sem escrita) | question |
| `need_clarification` / `unknown` | frase ambígua/sem ação | — (pergunta ao usuário) | reason |

Esquema (resumo) por item:
```ts
type AiIntent =
  | { kind: 'someone_paid_for_me'; amount: number; currency?: string;
      personName: string; categoryLabel?: string; description?: string;
      placeLabel?: string; when?: string /* ISO ou relativo */;
      confidence: number; clarifications?: Clarification[] }
  | { kind: 'register_expense'; /* … */ }
  | /* … demais kinds … */ ;

interface Clarification { field: string; question: string; options?: string[] }
```
O Worker força `response_format: { type: 'json_object' }` com um prompt que descreve esse schema (espelhando o `OCR_PROMPT`). Normalização robusta no device em `parseAssistantResponse` (igual `parseReceiptResponse`): valida com Zod, descarta o que não bate, nunca lança.

**Regra de escopo V1 (DL-6):** **uma frase → no máximo uma ação primária**. "Bruno me pagou a cerveja E vamos dividir o jantar" → executa a 1ª e oferece a 2ª como **chip de follow-up** ("Quer dividir o jantar agora?"). Cadeias multi-ação são difíceis de verificar e quebram a confiança.

---

## 5. Resolução de entidades (a "inteligência" de quem/onde/quando)

Tudo em `domain/assistant/resolve.ts` — **puro, testável, no device**. O modelo manda **nomes**; o resolver vira **ids + clarifications**:

- **Pessoas (o "quem é o Bruno"):** match acento-insensível em `name`/`nickname` dos `Participant` da trip (reusa a ideia de `buildPlaceSuggestions`).
  - **0 matches** → clarification: *"Quem é o Bruno?"* → [➕ Adicionar "Bruno"] · [escolher existente]. Criar usa o caminho de participante; sendo **não conectado**, a dívida nasce `confirmed` (DEC-241) → aparece na hora. (Reusa a "porta de onboarding sem app" da épica de split.)
  - **1 match** → usa.
  - **2+ matches** ("qual Bruno?") → chips dos candidatos.
- **Carteira:** match por nome; se rastreamento inativo/única carteira (DEC-222), pula.
- **Categoria/subcategoria:** o modelo sugere rótulo; o device **encaixa na taxonomia** conhecida (proximidade, DEC-095). Sem match → categoria genérica (nunca bloqueia).
- **Lugar / "bar mais perto":** se `locationCaptureEnabled`, preenche com `currentPlace`/POIs próximos (DEC-157/166); senão usa o lugar falado ou deixa vazio. **Nunca bloqueia** (expense sempre salva).
- **Tempo:** default = agora; "ontem"/"sábado" via date-fns no device.
- **Fase/pool/moeda:** `resolveActivePhase` + pool ativo (DEC-219); moeda falada ou base (DEC-158).

---

## 6. O context pack & privacidade

O que vai ao Worker junto da frase (nomes/rótulos, **sem ids, sem valores, sem histórico**):
```jsonc
{
  "now": "2026-06-20T22:10:00-03:00",
  "language": "pt-BR",
  "baseCurrency": "EUR",
  "activePhase": "Lisboa",
  "people": ["Bruno", "Ana", "João"],        // nomes/apelidos
  "wallets": ["Wise", "Dinheiro"],
  "categories": ["Bar", "Mercado", "Restaurante", ...],
  "currentPlace": "Bar do Zé",                // se localização ligada
  "nearbyPlaces": ["Bar do Zé", "Café Central"], // opcional
  "activeOuting": true
}
```
O modelo devolve **o nome** que casou ("Bruno"); o **device** re-resolve para id (a autoridade do mapeamento fica no aparelho; não confiamos id ao modelo).

**Postura de privacidade (igual `/ocr`):**
- Opt-in `aiQuickEntryEnabled` (default **false**) + tela de divulgação clara (o que sai, pra onde, no-train, stateless).
- **Modo "sem nomes"** (`aiQuickEntryPrivateNames`): não envia `people`/lugares; o modelo retorna o nome **falado** e o device casa localmente (custo: menos desambiguação automática).
- Worker **stateless** (nada persistido/logado, como o `/ocr`).
- Fallback total offline: sem chave/sem rede → abre o QuickAdd pré-preenchido pelo `parseVoiceExpense` (regex local). Nunca beco sem saída (padrão DEC-206).

---

## 7. UX — a "caixa" (texto primeiro), prévia, clarificação, desfazer

**Superfícies de entrada (descoberta):**
- **Hero no FAB** "✦ Falar ou escrever" com o sotaque "smart" (índigo + sparkle, como o `Dividir conta` em `FAB.tsx:314-352`).
- **Barra compacta na Home** estilo mensagem: *"Diga o que rolou…"* → abre a caixa. (Opção a validar no conselho.)
- Reuso de **PWA shortcut** e **share_target** (DEC-161) apontando para a caixa.

**A caixa (BottomSheet):** campo de texto com autofoco + botão grande **Enviar** + botão de **microfone** ao lado. Fluxo:
1. Escreve → Enviar → estado "pensando…" (otimista, curtinho).
2. Volta uma **prévia tipada**: *"Registrar: 🍺 Cerveja €2 · você deve €2 ao **Bruno** · Bar do Zé · agora"* com **[Confirmar] [Ajustar] [Cancelar]**.
3. **Confirmar** → `dispatch` → orquestrador → **toast de sucesso com Desfazer** (DEC-126).
4. Se faltar dado → **chips de clarificação** inline ("Qual Bruno?" → toca; "Quanto?" → teclado numérico). Um toque por pergunta, como o Julio pediu.
5. **Ajustar** → abre a tela canônica (QuickAdd/Split/…) **pré-preenchida** com o plano — para quando ele quiser refinar.

**Invariantes de UX:**
- **Nunca grava sem prévia** (exceto o opcional auto-confirm de alta confiança — abaixo).
- **Nunca bloqueia** (DEC-053): se a IA falhar, cai no manual pré-preenchido.
- **Sempre desfazível.**
- **Opcional (G3): "confirmar automaticamente gastos simples"** — só para `register_expense`/`someone_paid_for_me` de **confiança alta e ação única**: executa direto e mostra só o toast com Desfazer. Off por default (decisão de conselho).

---

## 8. Voz — Web Speech × Whisper (web × nativo)

Texto é o caminho 1 (mais rápido/confiável para frase curta). Voz é o caminho 2, com **dois motores** sob a mesma caixa:
- **Web Speech** (`startVoiceCapture`) onde houver (navegador/PWA): instantâneo, grátis, transcrição local → preenche a caixa.
- **Whisper no Groq** (novo `/transcribe`): grava áudio (MediaRecorder na web; plugin de mic no APK) → Worker → `audio/transcriptions` (`whisper-large-v3-turbo`, `language` = idioma do app) → texto → mesmo roteador. **É o caminho que funciona no APK** (onde o Web Speech falha) — <2s, ~US$0,02/h (VERIFICADO §16).
- **"Fala e envia"** (one-shot): ao fim da fala, auto-envia. "Aperta, fala, vai embora."

> Honestidade de plataforma: capturar áudio na **WebView do Android** pode exigir um **plugin Capacitor de microfone** → essa parte específica pode ser **device-pending / lote nativo** (como outros itens nativos do brain). Web/PWA + Web Speech não precisam de APK.

---

## 9. Conselhos inline (5 passes — sem subagentes, 1 request)

> Rodados conforme `inline-council-no-subagents.mdc`: Decision Brief neutro, papéis em rascunho cego, red team, síntese com tensões e cenário "minoria vence". Lean do chat a resistir: "a IA é mágica, conecta tudo e executa sozinha" — resistido tratando a IA como **planejador**, não executor.

### Conselho A — /council: vale a pena e qual o formato?
**Papéis:** Strategist / Architect / Critic / Advocate · _Inline, 1 request, no subagents._

**Decision Brief (neutro):** O app tem todas as funções de dinheiro, mas chegar à função + preencher campos é lento em campo. Proposta: caixa de linguagem natural (texto+voz) que entende → resolve no device → prévia → executa via orquestradores existentes. Fatos: Groq+JSON mode já em produção (`/ocr`); voz local + Whisper disponíveis; modelo de dívida pronto (DEC-241); opt-in/privacidade já têm padrão (`cloudReceiptOcrEnabled`).

**Strategist.** O diferencial do TripPilot é decidir gasto **em tempo real**; a fricção de captura é o imposto que corrói esse diferencial. Uma entrada por linguagem natural ataca exatamente o momento de maior abandono (bar/noite). Estrategicamente, posiciona a IA como **camada de comando** sobre um domínio já maduro — alto retorno porque não compete com nada, amplifica tudo (split, dívida, saída). Risco estratégico: virar "chatbot que faz tudo mal". Mitigar começando pelo caso de maior volume (gasto + "alguém me pagou"). **Rec:** construir, faseado, começando pelo gasto/dívida. **Confiança:** ALTA. **Outros não veem:** o maior valor não é "voz", é **eliminar a navegação até a função** — texto já entrega 80%.

**Architect.** O encaixe é limpo **se** a IA for planejador e o device executor: um `AiIntent` tipado + `resolve` puro + `dispatch` para orquestradores. O Worker ganha um `/assistant` clonado do `handleOcr` (mesmo modelo, JSON mode) e um `/transcribe`. Zero mudança nos engines financeiros; a dívida nasce certa de graça (DEC-241). Acoplamento perigoso seria deixar o modelo retornar **ids** ou **fazer conta** — proibir ambos. **Rec:** adotar a divisão planejador/executor; schema discriminado. **Confiança:** ALTA. **Outros não veem:** a normalização robusta (`parseAssistantResponse`) é o que segura a confiabilidade — tratar o JSON do modelo como **não confiável** por padrão.

**Critic (advogado do diabo).** O modo de falha clássico: a IA classifica errado e cria uma **dívida fantasma** ou gasto no valor/pessoa errados — pior que digitar, porque o usuário *confia*. Segundo risco: latência de rede no bar (3G) deixando a "caixa rápida" mais lenta que o FAB. Terceiro: privacidade — mandar nomes de amigos pra nuvem. **Rec:** prévia obrigatória + gating por confiança + desfazer + fallback offline + modo sem-nomes; medir latência antes de prometer "rápido". **Confiança:** MÉDIA. **Outros não veem:** "uma frase = uma ação" é essencial; multi-ação multiplica erros silenciosos.

**Advocate (usuário).** É o recurso que o Julio realmente pediu, no momento em que ele realmente sofre. O que o usuário quer: abrir, dizer, confirmar com 1 toque, pronto. Ele tolera **uma** pergunta ("qual Bruno?") se for tap; não tolera formulário. A prévia precisa ser **legível em 1 segundo** ("você deve €2 ao Bruno"). **Rec:** otimizar para "frase → 1 prévia → 1 confirmação"; voz como atalho, não obrigação. **Confiança:** ALTA. **Outros não veem:** "Ajustar" (abrir a tela cheia pré-preenchida) é a válvula de escape que torna seguro confiar na IA.

**Red team (matar a ideia líder).** Se a classificação não for boa o bastante, a prévia vira teatro (o usuário confirma no automático e erra). Mitigação: começar pelos 2 intents de maior volume e **medir acurácia real** com as próprias frases do Julio antes de expandir; manter o caminho manual igualmente rápido.

**Síntese (Chair).** Consenso: **construir, planejador/executor, texto-first, prévia+desfazer obrigatórios, começar pelo gasto/dívida.** Tensões: velocidade (Advocate) × segurança contra erro (Critic) → resolvido com prévia de 1 linha + gating de confiança + "uma frase, uma ação". Recomendação: G0 entrega o núcleo (gasto + "alguém me pagou/eu paguei") com métricas de acurácia; só então expandir. **Confiança:** ALTA. **Minoria vence se:** a acurácia em campo for baixa → recolher para "pré-preencher o QuickAdd" (sem auto-execução) até melhorar o prompt.

### Conselho B — /debate: texto-first × voz-first
**Papéis:** Proponent / Opponent / Judge · _Inline, 1 request, no subagents._

**Decision Brief (neutro):** O Julio disse que texto pareceu mais rápido, mas quer voz clara também. Decidir qual é o caminho primário do V1. Fatos: Web Speech é instantâneo mas falha no APK; Whisper resolve no APK com custo/latência de rede; texto não depende de rede para *capturar* (só o parse é nuvem).

**Proponent (texto-first).** Texto é determinístico de capturar, silencioso (bar barulhento não atrapalha), editável antes de enviar e funciona em qualquer plataforma sem plugin. A frase curta ("Bruno cerveja 2") é rápida de digitar e fácil de revisar. Entrega 80% do valor no G0 sem depender de captura de áudio nativa. **Rec:** texto é o primário; voz é gate seguinte. **Confiança:** ALTA. **Outros não veem:** o gargalo do bar é **barulho** — voz erra transcrição justamente onde mais se usaria.

**Opponent (voz-first).** O pedido literal foi "aperta, fala e vai embora" — mãos ocupadas com a bebida, voz é o gesto natural. Se voz não vier junto, o recurso não resolve o momento descrito. **Rec:** voz no V1, com Whisper para garantir o APK. **Confiança:** MÉDIA. **Outros não veem:** voz + auto-envio é a única forma de ser realmente "zero toque de digitação".

**Judge.** Os dois concordam que voz é desejada; divergem no *quando*. O caminho de menor risco e maior velocidade de entrega é **texto-first no G0** (sem dependência de plugin nativo, sem barulho, revisável) e **voz no G2** com os dois motores (Web Speech + Whisper). Isso entrega valor cedo e não amarra o V1 a um plugin de microfone device-pending. As duas preocupações do Opponent são atendidas **sem** voz-first: o auto-envio e o "zero digitação" chegam no G2, e a caixa é a mesma. **Veredito: texto-first, voz no gate seguinte.** **Confiança:** ALTA. **Minoria vence se:** testes mostrarem que o Julio só usa por voz → promover o G2 antes do G1 (cobertura ampla).

### Conselho C — /review: a arquitetura do roteador
**Papéis:** Correctness / Performance / Security / Maintainability · _Inline, 1 request, no subagents._

**Decision Brief (neutro):** Avaliar a arquitetura planejador(nuvem)/executor(device): `/assistant` (JSON mode) + `/transcribe` (Whisper) no Worker; `intent.ts`/`resolve.ts`/`dispatch.ts` no device; prévia+desfazer; opt-in.

**Correctness.** O ponto crítico é **não confiar no JSON do modelo**: validar com Zod, snap de categoria/pessoa por resolvers puros, e **proibir matemática do modelo** (engine calcula). A tabela-verdade DEC-114 + `resolveShareBirthStatus` garantem dívida correta. Casos de borda: 0/2+ pessoas, moeda ausente, valor ambíguo ("dois e cinquenta"), tempo relativo. **Rec:** suíte de testes de `resolve`/`dispatch` com frases reais; nunca executar com `confidence` baixa sem confirmação. **Confiança:** ALTA. **Outros não veem:** normalizar números de fala ("dois euros", "2,5") é fonte silenciosa de bug — testar à parte.

**Performance.** Custo é dominado pela rede (frase é pequena). `/assistant` ~ centenas de ms; Whisper turbo <2s. Manter o context pack enxuto; mostrar estado otimista; permitir digitar a próxima enquanto resolve. Cache do prompt do Groq ajuda. **Rec:** payload mínimo + UI otimista + timeout→fallback manual. **Confiança:** MÉDIA. **Outros não veem:** em 3G, o fallback offline (`parseVoiceExpense`) precisa ser instantâneo, não um erro.

**Security/Privacy.** Segredo só no Worker (já é assim). Sai do device: frase + nomes + lugar. Mitigar: opt-in, modo sem-nomes, no-train, stateless, sem logs. Validar tamanho/rate no Worker (como o `/ocr`). **Rec:** divulgação explícita + caps + modo privado. **Confiança:** ALTA. **Outros não veem:** transcrição de voz pode capturar fala de terceiros no bar — a divulgação deve dizer isso.

**Maintainability.** Um `AiIntent` discriminado + um mapa `kind → orquestrador` é fácil de estender (novo recurso = novo case). Espelhar `ai-ocr.ts`/`handleOcr` mantém consistência. Risco: o prompt virar um monstro — versioná-lo e testá-lo. **Rec:** data-driven (registry), espelhar padrões existentes, prompt versionado. **Confiança:** ALTA. **Outros não veem:** documentar o schema como contrato Worker↔device evita drift.

**Red team.** Maior risco arquitetural: alguém "evoluir" para tool-calling no servidor e quebrar privacidade/restrição do Groq. Mitigar fixando no doc: **execução é sempre no device**; o Worker nunca vê dinheiro.

**Síntese (Chair).** Consenso: arquitetura sólida **se** o JSON for tratado como não-confiável, o modelo não fizer conta, e a privacidade for opt-in/sem-nomes/stateless. Tensão: performance em rede ruim → resolvida com UI otimista + fallback offline instantâneo. **Confiança:** ALTA. **Vira o jogo se:** structured-output `strict` (no `gpt-oss`) provar valer a troca de modelo para garantir schema — adotar no futuro.

### Conselho D — /assess: escopo, risco, custo, prazo
**Papéis:** Risk / Opportunity / Cost / Timeline · _Inline, 1 request, no subagents._

**Decision Brief (neutro):** Entregar entrada por IA conectada a todas as funções, autônomo, um deploy por versão, com testes, "sem bug". Escopo amplo ("todas as funções") com risco de inchar.

**Risk Analyst.** Top risco: **erro de classificação criando dinheiro errado** (P MÉDIA, impacto ALTO) → prévia+confiança+desfazer. 2º: **escopo "todas as funções" estourar** → gate por volume. 3º: **voz nativa** depender de plugin → isolar no G2/device-pending. **Rec:** G0 mínimo e medido; expandir por evidência. **Confiança:** ALTA. **Outros não veem:** a demo/testes precisam de frases reais multilíngues (pt/en/es).

**Opportunity Scout.** Transforma o momento de maior atrito no de maior magia: "Bruno me pagou uma cerveja" → dívida instantânea + "Lembrar" (DEC-241). Vira vitrine e dá casa para futuros (Pix/cobrar, query do Copiloto por voz). **Rec:** entregar o trio gasto/dívida/split cedo. **Confiança:** ALTA.

**Cost Analyst.** Esforço Tier-3: G0 ~10–14h, G1 ~10–14h, G2 (voz) ~8–12h, G3 ~6–10h ≈ **34–50h estruturadas ≈ 11–17h reais**. Custo de inferência: texto barato; Whisper ~US$0,02/h — postura do `/ocr` (free-tier-ish). **Rec:** 4 versões (uma por gate). **Confiança:** MÉDIA. **Outros não veem:** a maior parte é UX/resolução, não "IA".

**Timeline Realist.** Dependência: G0→G1→(G2 voz, paralelizável a G3 só no fim). G2 carrega o risco nativo. **Rec:** travar G0/G1 (web/OTA) antes de mexer em voz nativa; cap duro de extras. **Confiança:** ALTA. **Sinal de otimismo:** "conectar tudo" é aberto — resistir com o registry fechado (§4).

**Red team.** A morte por escopo: tentar todos os intents no G0. Matar com o cap: G0 = 2 intents (gasto + alguém-pagou/eu-paguei).

**Síntese (Chair).** Consenso: **4 gates, ordem estrita, G0 medido e mínimo, cap de escopo, voz isolada no G2.** Recomendação: prosseguir; tratar acurácia de classificação como o gate de qualidade primário. **Confiança:** ALTA. **Vira o jogo se:** a captura de áudio nativa travar → entregar G0/G1/G3 web/OTA e deixar a voz nativa para um lote APK.

### Conselho E — /brainstorm: o espaço de possibilidades
**Papéis:** Visionary / Analyst / Connector / Simplifier · _Inline, 1 request, no subagents._

**Decision Brief (neutro):** O Julio pediu para explorar "muitas outras possibilidades". Levantar o leque; implementar só o de maior valor/menor risco agora, o resto vira backlog.

**Visionary.** A caixa vira o **comando universal** do app: registra, pergunta ("quanto posso gastar hoje?"), planeja ("orçamento de 300 pro fim de semana"), e fecha a conta da viagem por voz. Um "modo bar" só-voz, mãos livres, auto-envio, tela gigante. **Rec:** semear `query` read-only cedo (barato, encanta). **Confiança:** MÉDIA.

**Analyst.** Entrada por linguagem natural em apps de finança existe no mercado (conhecimento geral, MÉDIA confiança — sem alegar ineditismo). O que falha nos outros: campos obrigatórios escondidos e zero correção. Nosso trunfo: **resolução local + prévia + desfazer**. **Rec:** apostar na qualidade da prévia/clarificação, não em "mágica". **Confiança:** ALTA.

**Connector.** Reusar o que já existe: o `share_target`/PWA shortcut (cola um texto de recibo → cai na caixa), o `parseVoiceExpense` (fallback), o "Lembrar" da dívida (após criar a dívida via IA, oferecer cobrar). A caixa é a irmã de comando do Copiloto (que é leitura). **Rec:** posicionar caixa=ação, Copiloto=leitura. **Confiança:** MÉDIA.

**Simplifier.** Os 20% que dão 80%: **(1)** uma caixa de texto, **(2)** `someone_paid_for_me` + `register_expense`, **(3)** prévia + desfazer. Tudo o mais é gravy. Resistir a "todas as funções no dia 1". **Rec:** exatamente esses três no G0. **Confiança:** ALTA. **Outros não veem:** o ganho mais barato é nem precisar abrir o FAB — a barra na Home.

**Red team (por que a ideia ousada falha).** "Comando universal + query + voz mãos-livres" de uma vez = superfície enorme, classificação frágil, confiança quebrada. Manter o seam: a caixa começa simples; query/voz/auto entram por gate.

**Síntese (Chair).** Adotar os **três do Simplifier** no G0 + plano de expandir o registry (G1) + voz (G2) + query/polish (G3). Visionário/Connector → backlog com seams claros (query read-only, modo bar voz, cobrar pós-dívida). **Confiança:** ALTA.

---

## 10. Decisões propostas (resultado dos conselhos) — DEC-246 (DL-1..DL-8)

- **DL-1 (arquitetura).** IA = **planejador**; device = **executor**. O modelo retorna `AiIntent` (JSON mode), **nunca** ids nem matemática; o device resolve e os engines calculam. Execução **sempre** no aparelho.
- **DL-2 (canal).** Novo Worker `/assistant` (clone do `handleOcr`, `response_format: json_object`, mesmo `GROQ_API_KEY`, stateless) e `/transcribe` (Groq Whisper `whisper-large-v3-turbo`). 503 quando sem chave (degradação).
- **DL-3 (texto-first).** Texto é o caminho primário (G0); voz (Web Speech + Whisper) entra no G2. (Conselho B.)
- **DL-4 (segurança).** Toda escrita passa por **prévia + confirmação + desfazer** (DEC-126). Gating por confiança; "uma frase = uma ação" no V1 (multi-ação vira chip de follow-up).
- **DL-5 (privacidade).** Opt-in `aiQuickEntryEnabled` (default false) + divulgação; **context pack só com nomes/rótulos** (sem ids/valores/histórico); **modo sem-nomes**; Worker stateless; fallback offline via `parseVoiceExpense`.
- **DL-6 (escopo/registry).** As funções expostas são exatamente o registry §4 (fechado). G0 = `register_expense` + `someone_paid_for_me`/`i_paid_for_someone`. Cobertura ampla no G1.
- **DL-7 (resolução de pessoa).** 0 matches → "Quem é o {nome}?" (adicionar/escolher); 1 → usa; 2+ → "qual?". Pessoa criada não conectada → dívida nasce `confirmed` (DEC-241).
- **DL-8 (reuso).** `dispatch` chama **apenas** orquestradores existentes; **zero** lógica financeira nova; debt/semântica herdadas de `resolvePayerExpense`/`resolveShareBirthStatus`.

---

## 11. Backlog (adiado, não perdido)
- `query` read-only por voz/texto ("quanto o Bruno me deve?", "quanto posso gastar hoje?") via derivações do Copiloto/Dashboard. *(seed no G3)*
- "Modo bar" só-voz, mãos-livres, auto-envio, tela grande.
- Multi-ação encadeada ("registra X e divide Y") com verificação por etapa.
- Cobrar/Pix logo após a IA criar a dívida (liga no "Lembrar" do DEC-241; Pix = épica G4 futura).
- `response_format: json_schema` strict (trocar para `gpt-oss` quando valer a garantia de schema).
- Captura de áudio nativa no APK (plugin de microfone) — lote nativo/device-pending se o MediaRecorder na WebView não bastar.
- Aprender atalhos do usuário (frases frequentes → execução ainda mais rápida), reusando memória de descrição/favoritos (DEC-139..142).

---

## 12. Plano de implementação (gates)

> Cada gate: testes (Vitest) + `tsc --noEmit` + build + Playwright dos fluxos tocados; **um deploy web/OTA por versão**; sem APK salvo onde indicado. Segue `phase-delivery-hardening` (self-check por milestone, dev-log por versão).

### G0 — Núcleo: caixa de texto → gasto & "alguém me pagou" · ~v1.x.0
**Escopo:**
1. Worker `/assistant` (clone de `handleOcr`): `POST { text, context, language }` → Groq JSON mode com o prompt do schema → relay JSON. Stateless; 503 sem chave; caps de tamanho/rate como o `/ocr`.
2. `domain/assistant/intent.ts` — tipos `AiIntent` (subset G0) + Zod + `parseAssistantResponse` (normaliza, nunca lança).
3. `domain/assistant/resolve.ts` — resolvers puros: pessoa (0/1/2+), valor/moeda, categoria (snap), tempo, fase/pool, lugar (se on).
4. `domain/assistant/dispatch.ts` — mapeia intent resolvido → `registerExpense` via `buildSharesWithPayer`/`resolvePayerExpense` (+ `resolveShareBirthStatus`). Constrói `Transaction` + `ParticipantShare[]` como o QuickAdd.
5. `utils/ai-assistant.ts` — fronteira cliente (espelha `extractReceiptViaCloud`, erros tipados).
6. `features/assistant/AssistantSheet.tsx` + `useAssistant.ts` — caixa de texto, "pensando", **prévia**, **clarificação** (chips), **Confirmar/Ajustar/Cancelar**, toast+Desfazer.
7. Entrada: hero "✦ Falar ou escrever" no `FAB.tsx` (texto no G0; mic no G2).
8. Settings: `aiQuickEntryEnabled` (+ divulgação) e `aiQuickEntryPrivateNames`. i18n ×3.
9. Fallback offline: sem chave/rede/timeout → abre QuickAdd pré-preenchido por `parseVoiceExpense`.

**Acceptance criteria:**
- AC1: "o Bruno me pagou uma cerveja de 2 euros" (Bruno existente, não conectado) → prévia "você deve €2 ao Bruno"; confirmar cria a dívida visível na hora em `/shared`.
- AC2: "gastei 12 no mercado" → gasto €12 categoria Mercado, fase ativa, sem split.
- AC3: "paguei 30 do jantar da Ana" → Ana me deve a parte dela (split) — prévia correta.
- AC4: Bruno inexistente → clarification "Quem é o Bruno?" → adicionar → segue. Dois Brunos → "qual?".
- AC5: sem chave/offline → cai no QuickAdd pré-preenchido (nunca erro/beco).
- AC6: toda confirmação tem Desfazer; nada grava sem prévia; o modelo nunca fez a conta (engine fez).
- AC7: suíte cheia verde + tsc/build limpos; E2E do fluxo "frase→prévia→dívida".

**Testes:** `resolve.test.ts` (nomes pt/en/es, números falados, 0/1/2+ pessoas, moeda/tempo), `dispatch.test.ts` (registerExpense + shares + born-status), `parseAssistantResponse` (JSON malformado/parcial), E2E `assistant-quick-entry`.

### G1 — Cobertura ampla do registry · ~v1.x+1
Estende `AiIntent`/`dispatch` para: `split_bill`, `scan_receipt`, `start_outing`/`add_outing_item`, `plan_purchase`, `plan_expense`, `transfer`, `withdraw`, `settle_debt`, `register_income`, `add_participant`. Cada um → seu orquestrador/rota. Chips de clarificação por intent. **AC:** cada intent tem um caminho feliz + um teste; "uma frase, uma ação" com follow-up chip; nada regride.

### G2 — Voz (Web Speech + Whisper) · ~v1.x+2
Mic na caixa; Web Speech onde houver; Worker `/transcribe` (Whisper turbo, `language`) para o caminho nativo/genérico; "fala e envia" one-shot. **AC:** ditar a frase preenche a caixa e segue o mesmo roteador; degradação clara quando voz indisponível; divulgação de privacidade da voz. *(Captura de áudio nativa no APK pode ser device-pending.)*

### G3 — Inteligência & polish · ~v1.x+3
`query` read-only (responde do Copiloto/Dashboard); auto-confirm de alta confiança (opt-in); preenchimento por localização/"bar mais perto"; modo sem-nomes refinado; 0–2 melhorias capadas. **AC:** query responde sem gravar; auto-confirm só em confiança alta+ação única; cada extra com teste.

---

## 13. Anti-regressão & verificação
- Engines financeiros **intocados** (ÂNCORA): toda a aritmética continua em `splitting`/orquestradores; o gate de qualidade primário é **acurácia de classificação** medida com frases reais do Julio (pt/en/es).
- Por gate: suítes tocadas → `tsc --noEmit` → Playwright dos fluxos → suíte cheia no boundary.
- Atualizar o brain: este doc + `decision-log.md` (DEC-246/DL-1..8) + `project-status.md` + `dev-log.md` por versão.
- Um deploy Pages/OTA por versão; verificar `version.json` + `APP_VERSION`. APK só se a captura de áudio nativa exigir plugin.

## 14. Riscos & mitigações
| Risco | Mitigação |
|---|---|
| Classificação errada cria dinheiro errado | Prévia obrigatória + gating de confiança + desfazer + "uma frase, uma ação" |
| Latência no bar (3G) | Payload mínimo, UI otimista, Whisper turbo, fallback offline instantâneo |
| Privacidade (nomes na nuvem) | Opt-in + modo sem-nomes + no-train + stateless + divulgação |
| Erro de aritmética do LLM | Modelo só extrai números; engines calculam (testado) |
| Voz nativa na WebView | Isolar no G2; possível plugin/lote nativo device-pending |
| Escopo "todas as funções" inchar | Registry fechado (§4); G0 = 2 intents; cap por gate |
| JSON do modelo inválido | Zod + `parseAssistantResponse` tolerante; nunca lança |

## 15. File index (touch list) & Worker
**Worker (`worker/src/index.ts`):** novo `/assistant` (clone de `handleOcr`, JSON mode) + `/transcribe` (Groq `audio/transcriptions`); ambos sob `GROQ_API_KEY`, stateless, com CORS/no-store.
**Device (novos, identificadores em inglês):**
- `src/domain/assistant/intent.ts` — `AiIntent` + Zod + `parseAssistantResponse`
- `src/domain/assistant/resolve.ts` — resolvers puros (pessoa/carteira/categoria/lugar/data)
- `src/domain/assistant/dispatch.ts` — intent resolvido → orquestrador existente
- `src/utils/ai-assistant.ts` — fronteira `/assistant` (espelha `ai-ocr.ts`)
- `src/utils/ai-transcribe.ts` — fronteira `/transcribe` (G2)
- `src/features/assistant/AssistantSheet.tsx` + `useAssistant.ts` — caixa/prévia/clarificação/estado
**Device (tocados):**
- `src/components/FAB.tsx` — hero "Falar ou escrever"
- `src/domain/types/app-settings.ts` — `aiQuickEntryEnabled`, `aiQuickEntryPrivateNames`, (G3) `aiQuickEntryAutoConfirm`
- `src/features/settings/SettingsPage.tsx` — toggle + divulgação (grupo "Conexões e compartilhamento")
- `src/i18n/locales/{pt-BR,en,es}.json` — copy ×3
- testes em `src/tests/unit/domain/assistant/*` + `e2e/assistant-*.spec.ts`

## 16. Verificações técnicas (Groq) — VERIFICADO 2026-06-20
Fontes: Groq Docs (console.groq.com/docs — structured-outputs, api-reference, speech-to-text), Groq API Cookbook (DeepWiki "Tool Use and Function Calling"), índice Hivebook da API Groq (mai/2026). Confiança: ALTA.
- **JSON mode** `response_format: { type: 'json_object' }` — suportado em todos; **já em uso** no `/ocr`. Base da camada de entendimento.
- **Structured Outputs** `json_schema` `strict:true` (decodificação restrita) só em `gpt-oss-20b/120b`; **best-effort** (`strict:false`) no `llama-4-scout`. Futuro (backlog) se quisermos garantia de schema.
- **Tool/function calling** — `tools[]` (máx 128), `tool_choice ∈ {none,auto,required,específico}`, `parallel_tool_calls` default true; suportado em `llama-4-scout`/`llama-3.3-70b-versatile`/`gpt-oss`. **Ressalva: não pode combinar com `response_format` no mesmo request** → por isso escolhemos JSON mode + dispatch no device (não tool-calling no servidor).
- **Whisper STT** — `POST https://api.groq.com/openai/v1/audio/transcriptions`, `whisper-large-v3` / `whisper-large-v3-turbo`, multilíngue, `language` (pt) opcional, `file` (multipart) ou `url` (Base64URL), ≤25MB, <2s, ~US$0,02/h. Base do caminho de voz nativo (G2).

---

*Proposta. Decisão real só entra em `decision-log.md` quando o Julio aprovar (Truth Policy). Sugestão de id: DEC-246.*
