# Pesquisa & Spec — Foto no gasto + leitura de nota (OCR/IA) → itens → divisão

> Documento de pesquisa e arquitetura. **Não é implementação.** Solicitado por Julio (2026-06-16) no meio da rodada de campo (Wave F entregue, Waves A–E pendentes).
> Idioma do documento: PT. Identificadores de código: EN.
> Política de verificação: afirmações de mercado/limites de API verificadas na web em **2026-06-16**, com fonte e nível de confiança (ver §11).

---

## 1. O problema real (a história do cunhado)

Julio recebeu um **recibo de mercado** com vários itens. Nem tudo é dele — parte é de outras pessoas. Hoje ele teria que:
1. digitar item por item à mão, e
2. dividir manualmente quem paga o quê.

Ele quer duas coisas, em ordem de ambição:

- **(A) Anexar imagem a QUALQUER gasto** — tirar/escolher uma foto (recibo, comprovante, etiqueta) e guardá-la junto do gasto, **no próprio aparelho**. Simples, fundacional.
- **(B) Ler a imagem e extrair os itens** — apontar a câmera para a nota → algo (OCR/IA) separa **item + valor** → o app monta uma **lista** → Julio **seleciona** quais itens entram e **divide** cada item entre as pessoas. Isso vale para **mercado, bar, restaurante** — qualquer conta com vários itens.

Pergunta dele, respondida já aqui: **"dá pra fazer? OCR simples serve? temos IA grátis?"**
→ **Sim, dá, e encaixa muito bem no que o app já tem.** "OCR simples" (tesseract) é a opção fraca; o caminho forte é **OCR on-device (ML Kit, agora que somos app nativo) + uma camada opcional de IA de visão grátis (Groq, que você já usa)**. Detalhes nas §3–§5.

---

## 2. O que o TripPilot JÁ tem (e por que isso de-risca tudo)

Esta feature **não inventa um fluxo novo** — ela reusa três peças maduras:

### 2.1 O padrão Wise Import = "parse → revisar/editar → commit atômico"
`src/domain/import/wise-import.ts` já faz exatamente o formato de saída que precisamos:
- `WiseImportDraft` = uma linha reviewável com `description`, `amountCents`, `category` (adivinhada por regra `CATEGORY_RULES`), `phaseId`, flags `importable` / `includeByDefault` e dedupe por `externalRef` (`wise:<id>`).
- `classifyWiseRows()` é **puro**: entra "linhas cruas", sai um `WiseImportPlan { drafts, summary }`.
- `commitWiseImport()` (`domain/orchestrators/import-orchestrators.ts`) grava tudo numa **transação Dexie única**, com undo.
- A UI `WiseImportPage` é "lista com checkbox + edição inline + total + importar N".

**→ O recibo é o mesmo molde:** `ReceiptDraftItem[]` (descrição, preço, qtd, categoria adivinhada, participantes, incluir?) → mesma tela de revisão → mesmo commit atômico. A IA/OCR só **produz os drafts**; o resto já existe.

### 2.2 O modelo de Saída (Session) + itens + divisão = "vários itens numa conta, cada um divisível"
`src/domain/outing/outing.ts` + tipos `Session` / `SessionItem`:
- `createSession()` cria uma **saída** (tripId, phaseId, budgetPoolId, `activityProfileId` pode ser `null` para evento avulso — DEC-073).
- `createSessionItem(sessionId, transactionId, order)` liga **cada item** (um `Transaction` `expense`) à saída.
- Divisão por item já existe: `participantShares` + `splitEqually`/`splitting.ts`, com `personalCostCents` por transação (DEC-047), motor de acerto (`settlement-engine`) e até `calculateReportedTotalDiff` (DEC-046) para reconciliar "total informado ≠ soma dos itens".

**→ Uma nota de mercado vira UMA saída** ("Mercadona BURGOS"), com **N itens** (cada um um `Transaction`), cada item podendo ser **dividido entre participantes**. É precisamente o que Julio descreveu — e já está construído e testado.

### 2.3 Câmera, Worker e schema já prontos para crescer
- **Câmera**: a Wave F (0.50.0) acabou de **liberar `CAMERA`** no manifest; o `QrScanner` já usa `getUserMedia`. Captura de imagem é território conhecido.
- **Worker Cloudflare** `trippilot-sync` já existe e já guarda segredos (mailbox/sync). É o lugar natural para um **proxy de OCR** que esconde a chave da IA (o mesmo papel que as funções Vercel cumprem no groupResume).
- **Schema Dexie** está em **v7**; adicionar tabela nova é o padrão seguro já usado (v5/v6/v7 criaram tabelas sem `upgrade()`). Não há **nenhum** storage de imagem hoje (confirmado por busca) → campo limpo.

### 2.4 Histórico: isto REABRE a decisão D4
Em `feature-expansion-master-plan-2026-06-13.md` (D4), OCR foi adiado: *"viável 100% local via tesseract.js, mas pesado/impreciso; não compensa agora"*. **O que mudou desde então e justifica reabrir:**
1. **Agora somos app nativo (Capacitor)** → dá pra usar **ML Kit on-device** (Google), muito superior ao tesseract.js em foto de recibo.
2. **IA de visão grátis amadureceu** (Groq `llama-4-scout` multimodal, que você já usa em outro projeto).
3. Julio agora classifica isto como **"uma das coisas mais importantes do app"** — mudou a prioridade, não só a viabilidade.

---

## 3. Pesquisa — como extrair itens de uma nota (opções reais)

Três famílias de solução. Todas verificadas em 2026-06-16 (fontes na §11).

### 3.1 On-device OCR (roda no aparelho, grátis, offline, privado)
- **ML Kit Text Recognition v2** via plugin Capacitor (`@pantrist/capacitor-plugin-ml-kit-text-recognition` ou `@jcesarmobile/capacitor-ocr`): recebe a imagem → devolve **texto + linhas + blocos com bounding boxes**, 100% no device, sem rede. (VERIFIED 2026-06-16.)
- **ML Kit Document Scanner** (`@capacitor-mlkit/document-scanner` / `@capgo/capacitor-document-scanner`): abre câmera, **auto-recorta, endireita e limpa** a nota (Android usa ML Kit; iOS usa VisionKit). Requer Google Play Services (baixa módulo no 1º uso), aparelho físico (não roda em emulador), API 21+, ~1.7GB RAM. (VERIFIED 2026-06-16.)
- **tesseract.js** (WASM, web/PWA): roda no navegador, mas é **pesado (MBs) e impreciso em foto** — serve só como **fallback web**.

**Limitação honesta:** OCR devolve **texto**, não "itens estruturados". Transformar `"LEITE 1L        1,29"` em `{desc:"Leite 1L", price:129}` exige um **parser heurístico** (preço = último número decimal da linha; descrição = resto) — é factível (espelha o parser do Wise), mas **frágil** em notas com colunas, quebras de linha, descontos e peso/kg.

### 3.2 IA de visão na nuvem (LLM multimodal devolve JSON pronto)
Aqui a imagem (ou o texto do OCR) vai para um modelo que **devolve a lista de itens já estruturada** — muito mais robusto em notas bagunçadas.

| Provedor | Modelo grátis multimodal | Limite free (2026-06) | Treina com seus dados? | Observação |
|---|---|---|---|---|
| **Groq** ⭐ | `meta-llama/llama-4-scout-17b-16e-instruct` | ~30 req/min, **~1.000 req/dia**, 30k tok/min | **NÃO** (DPA proíbe treino; retenção mínima) | API compatível com OpenAI; **você já usa Groq no groupResume**; sem cartão |
| **Google Gemini** | `gemini-2.5/3 Flash` / `Flash-Lite` | ~10–15 req/min, **1.500 req/dia**, contexto 1M | **SIM, no tier grátis** ⚠ Google usa conteúdo (incl. imagens) p/ treinar e **revisores humanos podem ler** | Só pago/Vertex não treina; problema p/ recibo com PII |
| **OpenAI / Anthropic** | GPT/Claude vision | sem free tier real (créditos) | Pago não treina | Mais caro; fora do "grátis" |

**Conclusão de privacidade (decisiva):** para uma nota (que pode ter loja, itens, horário, às vezes últimos dígitos de cartão), **Groq free é muito superior ao Gemini free** porque **não treina com seus dados**. Mesmo assim, **a imagem sai do aparelho** — o que conflita com a âncora "local-first" e portanto deve ser **opt-in explícito**.

> ⚠ Nuance a confirmar na implementação: a Groq serve `image_url` no `llama-4-scout` (multimodal nativo). HIGH CONFIDENCE de que o input de imagem é suportado no free tier; validar o `model id` + formato de payload no 1º spike (uma fonte listou "vision" como limitação genérica do free, mas o Scout é multimodal por arquitetura).

### 3.3 APIs dedicadas de recibo (Mindee, Taggun, Veryfi, Google Document AI, AWS Textract)
Extraem itens de recibo com **altíssima precisão** (são treinadas só pra isso), mas: **pagas** (free tiers minúsculos, ex. algumas centenas de docs/mês), **cloud obrigatória** (mesma questão de privacidade) e **dependência externa**. **Recomendação: descartar no V1** — não casa com "grátis + local-first". Reavaliar só se a precisão das opções grátis se mostrar insuficiente em campo.

### 3.4 Tabela-resumo (o trade-off central)

| Critério | On-device (ML Kit) + parser local | IA visão nuvem (Groq) | API de recibo (Mindee…) |
|---|---|---|---|
| Precisão "item+preço" | Média (texto ótimo, estrutura frágil) | **Alta** (JSON direto) | **Muito alta** |
| Privacidade | **Total (nada sai)** | Sai (Groq não treina) | Sai (treina/varia) |
| Offline | **Sim** | Não | Não |
| Custo | **Grátis** | **Grátis** (free tier) | Pago |
| Chave/segredo | Nenhum | Precisa proxy (Worker) | Precisa proxy + conta paga |
| Encaixe local-first | **Perfeito** | Opt-in | Ruim |
| Esforço | Médio | Baixo (sobre o on-device) | Baixo, mas custo/contrato |

**O ponto que muda o jogo:** o usuário **sempre revisa e seleciona** os itens (é o fluxo que o Julio pediu). Logo, **OCR não precisa ser perfeito** — precisa ser "bom o suficiente + fácil de corrigir". Isso favorece **on-device como padrão**, com **nuvem como turbo opcional**.

---

## 4. 🏛️ Conselho (inline, 6 perspectivas)

**Tema:** como implementar "foto no gasto + ler nota → itens → divisão" da melhor e mais segura forma.

### Architect (arquitetura/reuso)
A feature decompõe em duas camadas independentes que NÃO devem ser acopladas: **(A) anexo de imagem** (storage local puro, zero IA) e **(B) extração de itens** (pipeline OCR/IA → drafts). A camada B deve **reusar o molde Wise** (`*Draft[]` puro → tela de revisão → commit atômico) e **desaguar no motor de Saída** (`createSession` + `createSessionItem` + `participantShares`). Defina uma fronteira `domain/receipt/` (puro: parser de texto→itens, normalização, dedupe) e uma fronteira `utils/native/ocr.ts` (impuro: ML Kit / fallback / proxy), espelhando `utils/native/*` que já existe. A IA é um **provider plugável atrás de uma interface** (`extractItems(image): ReceiptDraftItem[]`), com 2 implementações (on-device, cloud) selecionáveis por config — assim trocar Groq por outro é trivial. **Bottom line:** reuso massivo; o risco técnico real é só o parser texto→itens e o storage de blobs.

### Critic (advogado do diabo)
Modos de falha que vão doer: **(1)** parser de texto vira um pântano de regex por causa da variedade de notas (idiomas, colunas, peso/kg, descontos, taxas, total no meio) → expectativa de "lê tudo certinho" não se sustenta com OCR puro. **(2)** **Backup**: imagens em IndexedDB podem inflar o backup JSON de KB para dezenas de MB → quebra export/restore e o mailbox P2P. **(3)** **Chave da IA**: se chamarem a Groq direto do client, a chave vaza no APK/bundle — **proibido**; tem que ser proxy. **(4)** **Privacidade**: mandar imagem de nota pra nuvem fere a promessa "nada sai do aparelho" — se não for opt-in claríssimo, é quebra de confiança. **(5)** ML Kit Document Scanner **não roda em emulador** e exige Play Services → só testável no aparelho do Julio. **Bottom line:** sem decisões firmes sobre backup-de-imagem e opt-in-de-nuvem, isto vira dívida; o parser puro sozinho decepciona — a nuvem (opcional) é o que entrega o "uau".

### User Advocate (experiência)
O valor está em **3 toques**: foto → lista marcável → dividir. A revisão é o coração — o usuário **espera corrigir** (ninguém confia 100% em OCR), então a tela tem que tornar corrigir item/preço e **arrastar item → pessoa** algo gostoso (chips de participante por linha, "dividir igual entre marcados", "este item é só meu/só dela"). Para mercado, o padrão é **uma saída com N itens**; para bar, idem (já existe "rodada"). Não obrigar a usar IA: quem só quer **anexar a foto** (comprovante) tem que conseguir sem nada de OCR. E **offline tem que degradar com elegância** (sem nuvem → usa on-device → se nada, abre os itens em branco com a foto do lado pra digitar olhando). **Bottom line:** "selecionar + dividir" bem-feito vale mais que OCR perfeito; anexar foto sozinho já é uma vitória de UX.

### Strategist (produto/posicionamento)
Isto é **diferenciação de verdade**: apps de orçamento de viagem raramente fazem "foto da nota → divisão por item entre amigos" offline-first. Casa com o DNA do TripPilot (dividir gasto em viagem em grupo). Risco estratégico: **escopo**. Estamos no meio das Waves A–E (feedback de campo já prometido). Enfiar uma feature grande agora atrasa o resto. **Sequência recomendada:** terminar as quick-wins já planejadas (ou ao menos a Wave A) e encaixar **(A) anexo de imagem** cedo (barato, fundacional, satisfação imediata) e **(B) extração** como **épico próprio** logo em seguida. Não competir por atenção com os bugs de campo. **Bottom line:** alto valor estratégico; tratar como épico dedicado, não espremer no meio das waves de polimento.

### Privacy/Security Officer (custom — âncora local-first)
Âncora do projeto: "sem servidor, nada sai do aparelho". Esta feature **pode** respeitá-la **se**: **(1)** on-device é o **default**; **(2)** nuvem é **opt-in** por gasto/sessão, com aviso claro do que sai ("a foto será enviada à Groq para ler os itens; a Groq não treina com seus dados, mas a imagem sai do seu aparelho"); **(3)** a chave vive **só no Worker** (secret), nunca no client; **(4)** o proxy **não loga** a imagem nem o resultado; **(5)** preferir enviar **o TEXTO do OCR on-device** em vez da imagem quando possível (menos exposição); **(6)** Groq sobre Gemini-free, justamente porque Gemini-free **treina com o conteúdo**. **Bottom line:** dá pra fazer sem ferir a âncora, desde que cloud seja opt-in, key fique no Worker e o default seja 100% local.

### Cost/Ops (custom — sustentabilidade grátis)
Custo de inferência: **R$0** nos volumes de um app pessoal/familiar. Groq free = ~1.000 req/dia (org-level) — Julio jamais encosta nisso. On-device = R$0 e ilimitado. Worker Cloudflare = free tier folgado para um proxy leve. Custos reais são **(1)** **tamanho do APK/bundle** (ML Kit adiciona peso — o Document Scanner baixa módulo via Play Services, então pouco peso no APK; Text Recognition empacota modelo, +alguns MB) e **(2)** **storage no device** (fotos somam; precisa compressão + limpeza). Rate-limit no proxy evita abuso se a URL vazar. **Bottom line:** financeiramente trivial e sustentável no grátis; vigiar peso do APK e storage de fotos, não a conta de API.

### Síntese & Recomendação do Conselho
- **Consenso:** (1) **separar (A) anexo de (B) extração**; (2) **reusar molde Wise + motor de Saída** (não reinventar); (3) **on-device como padrão, nuvem opt-in**; (4) **chave só no Worker**; (5) **resolver backup-de-imagem antes de codar**; (6) **Groq > Gemini-free** por privacidade.
- **Divergência principal:** *quando* fazer. Strategist quer **depois** das waves de campo (épico dedicado); o valor para o Julio é alto agora. → **Recomendação:** entregar **(A) anexo de imagem cedo** (barato) e agendar **(B) extração** como **épico próprio logo após a Wave A** (ou após toda a rodada de campo, decisão do Julio — ver §10).
- **Recomendação técnica:** pipeline em camadas — **captura → OCR on-device (default) → parser local → [opcional] turbo Groq via Worker → revisão/seleção/divisão (molde Wise) → commit como Saída**. APIs dedicadas de recibo ficam fora do V1.
- **Confiança:** **HIGH** na arquitetura e no encaixe (reuso comprovado). **MEDIUM** na precisão do parser puro on-device (mitigada pela revisão obrigatória + turbo Groq). **MEDIUM** no peso ML Kit (validar no APK).

---

## 5. Arquitetura recomendada

### 5.1 Visão em camadas
```
[Captura]  Câmera/galeria (Capacitor) ou ML Kit Document Scanner (auto-crop/clean)
   │                                            (web: getUserMedia + <input file>)
   ▼
[Imagem]   guardada LOCAL (Blob comprimido + thumbnail) → tabela device-local
   │
   ├──────────────► (A) só anexar: para no storage. Gasto ganha um clipe 📎.
   │
   ▼ (B) extrair itens
[OCR]   Default ON-DEVICE: ML Kit Text Recognition → texto+linhas   (offline, privado)
   │                       (web fallback: tesseract.js)
   │
   ├── parser local  domain/receipt/parse.ts → ReceiptDraftItem[]  (puro, testável)
   │
   └── [opcional, opt-in] TURBO NUVEM
         client → POST Worker /ocr (texto OU imagem) → Groq llama-4-scout
                → JSON {items:[{description, qty, unitPrice, total}], currency, total}
         (chave GROQ_API_KEY = secret do Worker; proxy não loga payload)
   │
   ▼
[Revisão]  Tela molde Wise: lista marcável + edição inline + chips de participante
   │        + "dividir igual entre marcados" + reconciliar total (DEC-046)
   ▼
[Commit]   commitReceipt() — UMA transação Dexie:
             cria Session ("Mercadona BURGOS") + N SessionItem (cada um um Transaction
             expense, categoria adivinhada) + participantShares por item.
             Liga a imagem à Session. externalRef = receipt:<uuid>:<line> (dedupe/undo).
```

### 5.2 Onde vive (fronteiras novas, seguindo o padrão do projeto)
- `src/domain/receipt/` **(puro)**: `types.ts` (`ReceiptDraftItem`, `ReceiptPlan`), `parse.ts` (texto OCR → itens; heurística de preço/descrição/qtd, reusa `normalizeText`/`guessCategory` do Wise), `reconcile.ts` (soma dos itens vs total lido).
- `src/utils/native/ocr.ts` **(impuro, `isNativeApp()`-guarded)**: `recognizeTextOnDevice(image)` (ML Kit / tesseract fallback), `captureReceiptImage()` (scanner/câmera).
- `src/utils/native/ai-ocr.ts` **(impuro)**: `extractItemsViaCloud(payload)` → chama o Worker; só quando opt-in + online.
- `src/data/repositories/attachment-repo.ts`: CRUD de imagem (Blob) device-local.
- `src/domain/orchestrators/receipt-orchestrators.ts`: `commitReceipt()` (transação única, espelha `commitWiseImport`).
- `worker/src/index.ts`: rota `POST /ocr` (novo) — valida origem/rate-limit, repassa à Groq com o secret, devolve JSON. **Não persiste nada.**
- UI: `src/features/receipt/ReceiptCapturePage.tsx` + `ReceiptReviewPage.tsx` (reusa componentes da `WiseImportPage`); botão "📎 / Ler nota" no `QuickAddPage` e no detalhe do gasto/saída.

### 5.3 Schema (Dexie v8 — aditivo, padrão seguro)
- **Nova tabela** `attachments: 'id, transactionId, sessionId, createdAt'` (tabela nova → **sem `upgrade()`**, igual v5/v6/v7). Guarda `{ id, transactionId?, sessionId?, mimeType, blob: Blob, thumbBlob: Blob, width, height, createdAt, ... SyncMetadata }`.
- **Itens do recibo NÃO viram entidade nova** — viram `Transaction` + `SessionItem` + `ParticipantShare` (reuso). O "draft" é **efêmero** (em memória, como `WiseImportPlan`).
- **Decisão de backup (crítica — ver §10):** `attachments` entra ou não em `BACKUP_TABLE_KEYS`?
  - **Fora (device-local)**: backup continua leve; **mas** fotos não sobrevivem a restore/troca de aparelho. (Padrão de `localSnapshots`.)
  - **Dentro (comprimido)**: fotos viajam no backup; **mas** infla o JSON (mitigável com JPEG ~100–200KB + só no backup "completo" opcional).

### 5.4 O proxy de OCR (lição do groupResume)
No groupResume a chave Groq vive em `process.env.GROQ_API_KEY` em função serverless (Vercel). Aqui o equivalente é o **Worker `trippilot-sync`**: `wrangler secret put GROQ_API_KEY`, rota `/ocr` que monta o prompt ("extraia os itens desta nota como JSON: description, qty, unitPrice, total, currency"), chama `api.groq.com/openai/v1/chat/completions` com `llama-4-scout`, e devolve o JSON. Rate-limit por device/IP. **Client nunca vê a chave.**

---

## 6. Fluxo de UX (o que o Julio vê)

1. **Entrada**: no gasto rápido ou no detalhe de um gasto/saída → botão **"📎 Foto / Ler nota"**.
2. **Captura**: escolhe **Câmera** (scanner auto-recorta) ou **Galeria**. A foto aparece e fica salva.
   - Se ele só quer **anexar** (comprovante) → pronto, fim.
   - Se quer **ler** → toca **"Ler itens"**.
3. **Extração**: barra "lendo nota…". On-device por padrão. Se ele ligou o **turbo IA** (opt-in), e está online, manda pra nuvem para um resultado melhor.
4. **Revisão (molde Wise)**: lista de itens marcáveis:
   - cada linha: ✓ incluir · descrição (editável) · qtd · preço (editável) · categoria (chip) · **quem paga** (chips de participantes).
   - ações: "marcar todos", "dividir igual entre marcados", "este item só meu / só dela", "+ adicionar item manual".
   - rodapé: **total lido vs soma dos selecionados** → se diferente, oferece criar ajuste (DEC-046) ou ignorar a diferença.
5. **Commit**: "Salvar saída · N itens · total" → cria a **Saída** com os itens e divisões; a **foto fica anexada** à saída. Undo disponível.
6. **Casos de borda**: nota ilegível (abre itens em branco com a foto ao lado para digitar olhando); offline (só on-device; turbo IA fica esmaecido "precisa de internet"); bar/restaurante (mesma tela; "rodada" já existe); item por peso/kg (preço total da linha é o que importa — o parser pega o último valor).

---

## 7. Privacidade & segurança (como não ferir a âncora local-first)

| Regra | Implementação |
|---|---|
| On-device é o **padrão** | ML Kit roda no aparelho; nada sai sem ação explícita |
| Nuvem é **opt-in** | toggle "Ler notas com IA (envia a foto/texto a um servidor)" em Settings + confirmação por uso |
| Aviso honesto | "A Groq lê os itens e **não treina** com seus dados, mas a imagem **sai do seu aparelho**." |
| Chave **só no Worker** | `GROQ_API_KEY` = secret; client chama o proxy, nunca a Groq direto |
| Minimizar exposição | mandar **texto do OCR** > mandar imagem, quando o on-device já leu bem |
| Proxy **sem log** | Worker não persiste imagem/itens; rate-limit por device |
| **Groq, não Gemini-free** | Gemini-free **treina** com o conteúdo e revisores humanos podem ler → reprovado para recibo |
| Foto local protegida | herda o app-lock (PIN) existente; fica no device |

---

## 8. Plano de fases (TRAVADO — build now; V1 = G1+G2+G3, nuvem Groq opt-in incluída — ver §10/DEC-206)

> Esforço em horas "cruas" → **Tier 3** (÷3) conforme `velocity-standard.mdc`.

- **P0 — Anexar imagem a qualquer gasto** *(fundacional, sem IA)*
  Captura (câmera/galeria), compressão + thumbnail, tabela `attachments` (Dexie v8), ver/abrir/excluir, clipe 📎 no gasto/saída. **~30h → ~10h.**
  AC: anexar/ver/excluir foto num gasto; sobrevive a reload; respeita app-lock; web faz upload de arquivo.
- **P1 — Ler nota on-device → itens → seleção → divisão → Saída** *(o coração)*
  Plugin ML Kit Text Recognition (+tesseract.js web) · `domain/receipt/parse.ts` (puro, com testes de matemática) · tela de revisão (molde Wise) com chips de participante e divisão · `commitReceipt()` atômico → Saída. **~75–100h → ~25–33h.**
  AC: foto de mercado real → ≥80% dos itens reconhecidos (valor certo) · editar/incluir/excluir item · dividir item entre pessoas · total reconciliado · vira Saída com shares corretos · funciona offline.
- **P2 — Turbo IA (Groq via Worker)** *(opcional, opt-in)*
  Rota `/ocr` no Worker + secret · `ai-ocr.ts` · toggle + avisos de privacidade · fallback gracioso. **~30h → ~10h.**
  AC: com turbo ON + online, nota bagunçada extrai itens melhor que on-device; chave nunca no client; offline degrada para on-device.
- **P3 — Polimento** *(divisão avançada, modos, reconciliação fina)*
  "este item é de fulano", modo bar/restaurante/rodada integrado, ajuste de diferença, categorias por item mais espertas. **~30–50h → ~10–17h.**

---

## 9. Riscos & mitigações

| Risco | Sev. | Mitigação |
|---|---|---|
| Parser texto→itens frágil | ALTO | Revisão obrigatória + turbo Groq (P2) + testes com notas reais do Julio |
| Backup inflado por imagens | ALTO | Decidir §10; default device-local OU JPEG comprimido só no backup completo |
| Chave de IA vaza | ALTO | Proxy no Worker; secret; nunca no client; rate-limit |
| Quebra da promessa de privacidade | ALTO | On-device default + nuvem opt-in + aviso + Groq (não treina) |
| Peso do APK (ML Kit) | MÉDIO | Document Scanner baixa módulo via Play Services; medir delta no APK; lazy-load no web |
| ML Kit não roda em emulador | MÉDIO | Testar no aparelho do Julio (já é o fluxo das ACs `[device]`) |
| Storage de fotos cresce | MÉDIO | Compressão agressiva + limite/limpeza + ver tamanho em Settings |
| Groq image input no free | MÉDIO | Spike de validação no início da P2; fallback p/ enviar texto OCR |

---

## 10. Decisões — TRAVADAS (Julio, 2026-06-16) → ver DEC-206

1. **Quando construir?** → **AGORA, prioridade máxima.** As Waves A–E de feedback de campo ficam **pausadas** até este épico andar.
2. **Backup das imagens?** → **Só no aparelho** (device-local; `attachments` fora de `BACKUP_TABLE_KEYS`). Fotos **não viajam** em restore/troca de celular.
3. **IA na nuvem no V1?** → **Sim, incluída no V1** como **turbo opt-in** (Groq), com o **default 100% on-device**.
4. **Fonte da foto?** → **Câmera + Galeria.**
5. **Provedor de IA?** → **Groq** (`llama-4-scout`) — não treina com os dados. (Gemini-free reprovado por treinar com o conteúdo.)

**Gate plan resultante (V1 = G1+G2+G3):**
- **G1** — Anexar foto a qualquer gasto (schema v8 `attachments` device-local; câmera+galeria; thumbnail; ver/excluir; clipe 📎).
- **G2** — Ler nota **on-device** (ML Kit Text Recognition + tesseract.js web) → `domain/receipt/parse.ts` → revisão/seleção/divisão (molde Wise) → `commitReceipt()` → Saída.
- **G3** — **Turbo Groq** (opt-in): rota `/ocr` no Worker `trippilot-sync` (secret) + toggle + avisos de privacidade + fallback on-device.
- **G4** — Polimento (divisão por item avançada, modos bar/restaurante, reconciliação de total).

---

## 11. Fontes (verificadas em 2026-06-16)

- **Projetos irmãos (código local):** `groupResume` usa **Groq** (`groq-sdk`, `GROQ_API_KEY`) com `llama-3.1-8b-instant`, `llama-3.3-70b-versatile`, `meta-llama/llama-4-scout-17b-16e-instruct` e `whisper-large-v3-turbo`, em funções **Vercel** (`@vercel/node`, `vercel.json`). `transparenTimages` usa **`@huggingface/transformers`** (Transformers.js **on-device**). *(VERIFIED — leitura direta dos arquivos.)*
- **Groq free tier (HIGH):** every model, sem cartão; `llama-4-scout` ~30 RPM / 30k TPM / **~1.000 RPD**; API compatível com OpenAI. Fontes: grizzlypeaksoftware.com, tokenmix.ai, apistatuscheck.com, cloudzero.com/blog/groq-pricing (mar–jun/2026).
- **Groq privacidade (HIGH):** DPA proíbe treino com dados de cliente; retenção mínima; **sem Privacy SLA no free**; US-only. Fontes: meetily.ai/llm-privacy/groq, groq.com/privacy-policy, trustkit.co (2026).
- **Gemini free tier + privacidade (HIGH):** só Flash/Flash-Lite no grátis (Pro virou pago em abr/2026); ~1.500 RPD; **Unpaid Services: Google usa conteúdo p/ treinar e revisores humanos podem ler** (pago/Vertex não treina). Fontes: ai.google.dev/gemini-api/terms, ai.google.dev/gemini-api/docs/logs-policy, findskill.ai, pecollective.com (mai/2026).
- **OCR on-device Capacitor (HIGH):** `@capacitor-mlkit/document-scanner`, `@capgo/capacitor-document-scanner` (ML Kit/VisionKit; emulador não suportado; Play Services; API 21+, 1.7GB RAM); Text Recognition via `@pantrist/...` / `@jcesarmobile/capacitor-ocr`. Fontes: capawesome.io, npmjs, github Cap-go, scanbot.io (abr–mai/2026).
- **Decisão prévia (interna):** `feature-expansion-master-plan-2026-06-13.md` D4 — OCR adiado (tesseract.js local, pesado/impreciso). **Este documento reabre D4** com base no app já ser nativo + IA de visão grátis madura.

---

## 12. Adendo (2026-06-16) — sem Play Store + usuários iOS/web (conselho curto)

Julio acrescentou duas restrições. Conselho curto + ajustes:

**(a) Somos Android fora da Play Store (e talvez continue assim). Funciona?**
**SIM (VERIFIED 2026-06-16).** O ML Kit Text Recognition tem variante **bundled** (`com.google.mlkit:text-recognition`, ~3.5MB Latin) que **embute o modelo no APK** → roda **100% offline, sem Google Play Services e sem Play Store**. Só a variante *unbundled* depende do Play Services. APK sideloaded funciona normalmente. → **Decisão: usar a variante bundled** no G3. Fontes: developers.google.com/ml-kit (bundled vs unbundled + installation-paths), react-native-nitro-ocr (bundla justamente p/ rodar sem GMS).

**(b) Temos usuários iOS — sem app nativo e sem PWA (são usuários WEB no Safari).**
Para eles **não há ML Kit nem Apple Vision** (isso é nativo); o on-device web seria só tesseract.js (fraco). → Para iOS/web, **a nuvem (Groq) é o ÚNICO caminho bom**. Logo a IA na nuvem deixa de ser "turbo opcional" e vira o **caminho universal** (Android + iOS + web).

**Conselho curto:**
- *Architect:* a camada de revisão/seleção/divisão e o `commitReceipt`→Saída são **agnósticos de plataforma**; só o "motor de OCR" varia (nuvem p/ todos; ML Kit bundled extra no Android). Construir a nuvem primeiro entrega a feature inteira a TODOS num gate só, **100% web (OTA, sem APK)**.
- *Advocate:* iOS é cidadão de 1ª classe aqui — nuvem primeiro evita deixar metade dos usuários sem nada.
- *Privacy:* nuvem continua **opt-in** com aviso; no Android, o ML Kit bundled (G3) vira o **default privado/offline**. Antes do G3, Android também usa nuvem (opt-in) — aceitável.
- *Critic:* risco = depender de rede/Groq para a feature inteira até o G3; mitigado porque G1 (anexar) já é útil offline e o G3 traz o offline no Android.

**Ordem dos gates REVISADA (cloud-first):**
- **G1** Anexar foto (universal; `<input capture>`; **OTA, sem APK**).
- **G2** Extração **na nuvem (Groq)** + revisão/seleção/divisão → Saída (universal: iOS+web+Android; **OTA, sem APK**).
- **G3** OCR **on-device** (ML Kit **bundled** Android + tesseract.js web) plugado na MESMA UI; default privado/offline no Android (**precisa APK**).
- **G4** Polimento.

→ **G1 e G2 sobem por OTA e já atendem iOS/web/Android.** Só o G3 (ML Kit nativo) gera APK novo.

---

*Status: pesquisa + conselho concluídos, decisões TRAVADAS (DEC-206 + adendo). Implementação iniciando pelo G1 (cloud-first).*
