# Field Feedback — Master Plan, Councils & Implementation Spec (2026-06-22)

> Data: 2026-06-22 · Autor: assistente (a pedido do Julio) · Status: **PLANO DE IMPLEMENTAÇÃO — v2 com respostas do Julio; DEC-256..278 registradas (direção aprovada, implementação pendente).**
> Truth policy: nada aqui é decisão até virar `DEC-*` no `decision-log.md`. **Atualização:** os `DEC-256..DEC-278` foram **registrados** no `decision-log.md` (2026-06-22) com **direção aprovada/ratificada pelo Julio, implementação PENDENTE** — este doc é a especificação de execução deles.
> Pedido do Julio (resumo): um lote grande de feedback de campo (release notes, calculadora de câmbio, participantes, FAB/voltar, cofrinho, entrada de gastos/IA/nota, exclusão de evento, amigo sincero, carrossel "outros", saída, admin/Groq, etc.). Analisar cada ponto, pesquisar, passar pelo conselho o que precisar e produzir **um relatório de implementação** que a IA leia depois e implemente no nosso padrão, com **mínimo de regressão**.
> Cost contract: todos os conselhos abaixo rodaram **inline, nesta sessão (1 request, sem subagentes)** — conforme `inline-council-no-subagents.mdc`.

> ### v2 — Respostas do Julio integradas (2026-06-22, mesma sessão)
> Esta revisão incorpora as decisões/ratificações do Julio e **5 acréscimos novos**:
> - **Ratificado:** FB-03 (localização default ON, com a emenda à ÂNCORA 8), FB-04 (calculadora **+** intent de IA "quanto é X em Y?"), FB-09 (sem wizard único; manual ganha "✨ IA", IA ganha câmera), FB-10 (foto→1 gasto resumido), FB-15 (enxugar setup), FB-21 (granularidade grossa de aparelho).
> - **Mudou por decisão do Julio:** **FB-11** — ao excluir evento, **perguntar** ao usuário se apaga junto os gastos (default não é manter). **FB-12** — vozes selecionáveis no Settings + insight dentro do Amigo Sincero que leva às Configs + **reveal no fim do carrossel** (puxar além do fim revela a função; rotação automática nunca chega lá). **FB-18** — contabilização de tokens **100% server-side em tempo real** (o worker faz proxy de toda chamada Groq; não depende de heartbeat do cliente). **FB-19** — **investigar e nomear** o `00000000` (entender o consumo) antes de simplesmente parar de gravar.
> - **Itens novos:** **CC-IMG** (toda entrada de imagem = chooser "tirar foto / galeria", reusando o padrão DEC-206 do `AttachmentSection`), **FB-26** (degradação graciosa quando o free tier do Groq estoura, com countdown real via `retry-after`/`x-ratelimit-reset-*`), **FB-27** (registrar reembolso recebido — Pix/Wise/dinheiro/transferência — no split, reusando `Settlement`+`PaymentMethodKind`), **FB-28** (IA de ajuda/concierge do app ancorada numa KB compacta — condicionada a custo de token), e **C12** (viabilidade do "preço no Brasil" — **parado**: Groq não navega na web, preço alucinado violaria a regra "só preço real").
> - **Pesquisa nova (VERIFICADO 2026-06-22):** Groq **tem visão** (Llama 4 Scout/Maverick, text+image, JSON mode) → OCR/“o que é isto” viável; Groq **não navega na web** (cutoff 2024-08) → "preço real no Brasil + onde" **não** é viável só com Groq. 429 retorna `retry-after` (s) e toda resposta traz `x-ratelimit-remaining/reset-*` → countdown real possível.

---

## 0. Como usar este documento

1. **§1 — Baseline factual de código.** O que JÁ existe e está no ar. Leia antes de implementar qualquer item — vários pedidos do feedback já estão parcialmente prontos (Admin v2/DEC-251, multi-trip/DEC-249, modo Dia a dia/DEC-250, paridade de campos no AI Quick Entry/DEC-246). Não reconstruir o que existe.
2. **§2 — Conselhos inline** dos itens estratégicos (trade-off real).
3. **§3 — Especificações por item (FB-01..FB-28 + CC-IMG)**: causa-raiz com arquivos, abordagem, ACs, testes, guardas anti-regressão, esforço e risco.
4. **§4 — Sequenciamento em gates** com hardening (padrão `phase-delivery-hardening.mdc`).
5. **§5 — Perguntas abertas / DECs propostas** para o Julio ratificar.

Convenção de esforço (Tier 3, `velocity-standard.mdc`): **P** ≤ 0,5 dia · **M** ~1–2 dias · **G** ~3+ dias (já com auditoria/teste).

---

## 1. Baseline factual de código (verificado nesta sessão)

| Área | O que JÁ existe (arquivo) | Implicação para o feedback |
|---|---|---|
| **Release notes** | `src/utils/release-notes.ts` (3181 linhas, v0.99.39 no topo) + `src/features/more/AboutPage.tsx` (Novidades + "Versões anteriores" colapsável) | O mecanismo está pronto; o problema é **conteúdo defasado/faltando**, não código (FB-01). |
| **Guia de capacidades** | `src/domain/guide/guide-catalog.ts` (`GUIDE_SECTIONS`) renderizado pela GuidePage | Catálogo **desatualizado** — falta IA, Dividir conta, Spaces/Dia a dia, Escanear nota, Acerto de contas, etc. (FB-02). |
| **Câmbio** | `src/utils/exchange-rates.ts` (`fetchExchangeRates` via `open.er-api.com`, grátis, sem chave) + `src/domain/money/exchange.ts` (`convertToBaseCents`, `resolveFrozenRate`, `listSelectableCurrencies`) + `appSettings.frozenRates` + `anchorCurrency`/`anchorRatePer1` (DEC-128 "pensar em R$") | A calculadora (FB-04) **reusa** essa infra — não precisa de novo provedor nem chave. |
| **AI Quick Entry** | `src/features/assistant/AssistantSheet.tsx` + `src/domain/assistant/*` (DEC-246). Texto **+ voz** (Web Speech / Whisper). Preview + editor in-sheet com **categoria, data/hora, local (PlaceField), fundo, carteira** — paridade com QuickAdd. **Não** aceita imagem. | Surfaces de entrada (FB-09): hoje são 3 (IA texto/voz, manual `/quick-add`, Dividir conta via scan). |
| **Recibo / Dividir conta** | `ReceiptScanPage`, `src/domain/receipt/parse.ts` (extrai merchant, `placeLabel`, items com `guessCategory`), `src/domain/orchestrators/receipt-orchestrators.ts` (`commitReceipt`) | `commitReceipt` cria **1 sessão com N transações** (uma por item). Define `category` (guessCategory) mas **não** define `location` nem a **data do recibo** (usa data de criação). Base do FB-10 e FB-14. |
| **FAB** | `src/components/FAB.tsx` (`FABMenu`, overlay `fixed inset-0` controlado por `isOpen/onClose`) | **NÃO** se registra em `overlay-dismiss`. Causa-raiz do FB-07. |
| **Back button** | `src/utils/native/back-button.ts` (`initBackButton` → `dismissTopOverlay()`) + `src/utils/overlay-dismiss.ts` (LIFO) + `BottomSheet.tsx` registra via `registerOverlayDismiss`. Web: `RootLayout.tsx` só re-semeia history em rotas home. | FAB precisa registrar igual ao BottomSheet (FB-07). |
| **Cofrinho** | `src/domain/budget/motivation.ts` (`calculatePiggyBank` = under-spend acumulado, ≥0) + `src/domain/dashboard/dashboard-cards.ts` (`piggy_bank` é `contextual`) + `src/domain/check-in/lens.ts` (calm/no_spend → foco `piggy_bank`) + `DashboardCards.tsx` (renderiza **só se `piggyBankCents > 0`**) | Causa-raiz do FB-08: se está **no/acima do ritmo linear**, `piggyBankCents = 0` ⇒ não há foco ⇒ nada aparece, mesmo no check-in "não vou gastar". |
| **Carrossel de ocasiões** | `src/domain/dashboard/occasion-counters.ts` (`buildOccasionCounters`) — conta `txs.length` por categoria sem plano | Itens de recibo (cada linha = 1 transação `other`) inflam "Outros". Base do FB-14. |
| **Amigo Sincero** | `src/domain/budget/honest-friend.ts` (veredicto V2, kinds) + `honest-friend-extras.ts` (carrossel) + `AmigoSinceroCard.tsx`. O extra `phase_progress` é empurrado para **qualquer** `phaseSpent>0 && phaseBudget>0` (l.45-47) com **um único** template i18n `dashboard.amigo_extra_phase_progress` ("Olha, você já mandou {{percent}}% do orçamento dessa fase. Vale dar uma segurada."); só o **tom** muda (caution a partir de 90%). `percent` é **clampado a 100** → a 100%+ mostra "…mandou 100%… Vale dar uma segurada." | Base do FB-12: **uma única frase para toda a faixa 0–100%+**, tom errado quando já estourou. |
| **"Veja mais no copiloto"** | `DashboardCards.tsx` (~l.238) + i18n `dashboard.insights_more_copilot` | Ajuste de margem (FB-13). |
| **Admin** | `src/features/admin/AdminPage.tsx` + `src/utils/admin-api.ts` + `worker/src/index.ts` (`TelemetryStore` DO/SQLite). **DEC-251 já no ar**: `ai_usage(install_id, day, fn, tokens, runs)` com `fn ∈ {assistant, ocr, transcribe}`, `recordAiUsage` lê `usage.total_tokens` do Groq; `AiUsageSection` mostra totais + **por função** (global) + top users; `ErrorsSection` (dedupe por hash, com plataforma/versão); `Distribution "Plataformas"`. Modal `InstallModal` mostra por-usuário: counters, flags, plataforma, tokens **totais** + chamadas | Admin (DEC-248/251) está **em uso pelo Julio** (ele viu uso de IA, erros, plataformas, 00000000, modal). FB-17/19/20/21/22 são **refinamentos** (não features do zero); FB-18 (governança Groq) é novo. |
| **Plataforma** | `src/utils/platform.ts` (`webPlatformTag` → `ios-web`/`android-web`/`web`; DEC-253) + `isStandaloneDisplayMode()` | Falta distinguir **PWA (standalone)** de aba de navegador (FB-20). |
| **installId** | `src/utils/entity-factory.ts` (`getInstallationId` = `uuidv4` em localStorage; nunca zerado) · headers via `src/data/sync/config.ts` (`aiRequestHeaders` → `X-Install-Id`). O sentinel **all-zeros** `00000000-0000-0000-0000-000000000000` **não aparece em nenhum lugar** do app nem dos specs (os e2e usam `00000000-0000-4000-8000-000000000000`, um v4 **válido**, como id de **link** de share/split — sem relação com install id) | FB-19: o cliente real nunca emite all-zeros; origem provável = **probe de deploy / cliente externo / scanner** mandando placeholder → rejeitar server-side. |
| **Defaults** | `src/data/db/seed.ts`: `deviceName: 'Meu dispositivo'`, `locationCaptureEnabled: false`, `cloudReceiptOcrEnabled: false`, `aiQuickEntryEnabled: true (default)` | FB-03 (location on) e FB-05 (device name) mexem aqui — atenção à ÂNCORA 8 (privacy-first). |
| **Saída** | `src/features/outing/OutingPage.tsx` (3400+ linhas; setup `/outings/new`, sessão ativa, revisão) + `src/domain/outing/outing.ts` (`deriveSessionLimits`, `EVENT_CONTEXTS`, `avgDrinkPriceCents`) | FB-15/FB-16/FB-23. |
| **Captura de imagem (padrão)** | `src/features/attachments/AttachmentSection.tsx` (**DEC-206**) **já** abre um **chooser** (`BottomSheet`) com "Tirar foto agora" (`<input capture="environment">`) vs "Escolher da galeria" (`<input>` simples). Funciona web/iOS Safari/WebView nativo. | **CC-IMG**: este é o padrão canônico a **extrair/reusar** em TODA entrada de imagem (recibo, foto-na-IA). Não inventar outro. |
| **Settlements / reembolso** | `src/domain/types/settlement.ts` (`Settlement`: debtor→creditor, `amountCents`, `settledAt`, `linkedTransactionId`, `externalRef`) + `settlement-repository.ts` + `reimbursement-bridge.ts` + `payment-methods.ts` (`PaymentMethodKind = pix\|wise\|bank\|other`, DEC-244) | Base do **FB-27**: registrar "me pagaram de volta" reusa `Settlement` (+ método). Infra existe; falta a entrada de UI explícita "recebi o reembolso". |
| **Acerto de contas (cobrar/lembrar)** | `useRemindMessage.ts` + `buildPaymentInstructions` (anexa Pix/Wise/bank ao recado) | DEC-244: já listamos COMO me pagar; FB-27 fecha o ciclo (registrar o que foi pago). |

**Fatos externos verificados (2026-06-22):**
- **Groq free tier** (fonte: console.groq.com/docs/rate-limits + agregadores 2026): **~30 RPM**, **6.000 TPM** (tokens/min), **RPD por modelo** (1.000/dia em modelos 70B; até 14.400/dia no 8B), **TPD** 100K–500K. Limites por **modelo e por organização** (várias chaves não somam). `whisper-large-v3` ~20 RPM / 2.000 RPD. **VERIFICADO.**
- **Groq expõe a cota nos headers de resposta**: `x-ratelimit-limit-requests` (RPD), `x-ratelimit-limit-tokens` (TPM), `x-ratelimit-remaining-requests`, `x-ratelimit-remaining-tokens`, `x-ratelimit-reset-requests` (ex.: "2s"), `x-ratelimit-reset-tokens` (ex.: "6s"), e `retry-after` (segundos) no **429**. **VERIFICADO** — base sólida pro FB-18 (cota REAL) e FB-26 (countdown real). O 429 também traz no corpo qual limite estourou (RPM/TPM/RPD).
- **Groq tem VISÃO** (multimodal): `meta-llama/llama-4-scout-17b-16e-instruct` e `…-maverick-…` aceitam **texto + imagem**, com **JSON mode** e tool use, no endpoint OpenAI-compatível. Disponível no **free tier**. **VERIFICADO** (console.groq.com/docs/vision). → OCR de nota e "o que é este item?" são viáveis com Groq.
- **Groq NÃO navega na web** (knowledge cutoff ~2024-08; sem browsing nativo). → "preço real de X no Brasil **e onde**" **não** é confiável só com Groq (alucina preço) — ver **C12**. Faríamos isso só com um backend de busca de preço real (fora de escopo agora).
- **Conversão de moeda**: `open.er-api.com` (já usado no app) é grátis, sem chave, atualização diária. Suficiente para a calculadora (FB-04). Confiança ALTA.

---

## 2. Conselhos inline (itens estratégicos)

> Cada conselho segue o protocolo: Decision Brief neutro → perspectivas escritas às cegas → red team → síntese do Chair. Só os itens com trade-off real entram aqui; bugs viram spec direta na §3.

### C1 — Calculadora de conversão de moeda: onde e como (FB-04) · `/council`

**Decision Brief (neutro).** O usuário, no exterior, quer saber **rápido** quanto uma coisa custa na moeda de referência dele (R$/moeda de casa) — geralmente para decidir "compro ou não / vale a pena comparado ao Brasil". Existe `anchorCurrency` (DEC-128) e `fetchExchangeRates`/`frozenRates`. Decidir SE é uma calculadora dedicada, ONDE ela mora (acesso fácil, não escondido) e COMO mantém moedas atualizadas, com mínimo de regressão. _Viés a resistir: "é só uma telinha de calculadora" — o valor real é o caso de uso de comparação rápida e onipresente._

- **Strategist** (posição/retenção; teme feature órfã). Conversor é a função que o viajante abre **dezenas de vezes/dia** numa loja — é gancho de abertura diária e diferencia de apps que escondem câmbio. O ativo único do TripPilot é já saber a moeda da viagem e a âncora; a calculadora deve nascer "pré-configurada" (de→para já preenchidos). **Rec:** construir, com acesso de 1 toque. **Confiança: ALTA.** _Outros perdem:_ ela também alimenta a alfabetização do usuário sobre câmbio (some o atrito do "quanto é isso?").
- **Architect** (viabilidade/manutenção; teme duplicação). Reusar `exchange-rates.ts` + `frozenRates` + `convertToBaseCents`. Núcleo puro `convertAmount(cents, from, to, rates)` testável; UI fina. Atualização: botão "atualizar cotações" (já existe o fetch) + carimbo "cotação de DD/MM" + fallback offline com a snapshot congelada. **Não** criar provedor novo nem chave. **Rec:** domínio puro + 1 tela + 1 ponto de entrada. **Confiança: ALTA.** _Outros perdem:_ precisa de uma lista de moedas data-driven (reusar `listSelectableCurrencies` + moedas da viagem/carteiras).
- **Critic** (achar a falha; teme cotação enganosa). O risco fatal é **mostrar número errado** (cotação velha sem avisar, ou inverter a direção). Calculadora de câmbio que mente é pior que não ter. Também: virar "mais uma tela escondida". **Rec:** sempre carimbar a data/idade da cotação, deixar a direção óbvia (swap ⇄), permitir taxa manual, e **não** esconder num submenu. **Confiança: MÉDIA-ALTA.** _Outros perdem:_ offline é o caso comum no exterior → tem que funcionar com a última snapshot e dizer "offline, cotação de X".
- **Advocate** (valor/simplicidade; teme fricção). O sonho: abro, digito o preço da vitrine, vejo "≈ R$ X" instantâneo, e um selo "isso é caro/ok pro seu padrão" seria ouro. Tem que estar onde o polegar já vai: no FAB e/ou num atalho fixo. **Rec:** calculadora minimalista (um campo, dois seletores de moeda, resultado grande) + acesso no FAB e no header/Copiloto. **Confiança: ALTA.** _Outros perdem:_ o caso "vale a pena?" pede comparar com um preço de referência do próprio usuário (futuro: "no Brasil isso é ~R$Y").

**Red Team (matar o "fazer já").** Se a calculadora ficar com cotação congelada sem aviso e o usuário decidir uma compra com número errado, perde confiança em TODO o app (o orçamento usa a mesma cotação). E se o acesso ficar "mais um item de menu", ninguém usa e vira peso morto. Mitigação: idade da cotação sempre visível + atualização 1-toque + acesso de 1ª classe (FAB + atalho).

**Síntese (Chair).**
- **Consenso:** construir, reusando a infra de câmbio existente; acesso de 1ª classe; idade da cotação sempre visível.
- **Tensões:** Advocate quer simplicidade extrema; Critic quer salvaguardas (data, direção, manual). **Resolução:** tela minimalista por padrão (campo + ⇄ + resultado), com a linha de "cotação de DD/MM · atualizar" sempre presente e taxa manual atrás de um toque.
- **Recomendação:** **Calculadora dedicada** `domain/money/converter.ts` (puro) + `features/converter/ConverterPage.tsx` (`/converter`), com **dois pontos de entrada**: (1) chip no FAB (grupo capture, acima dos heroes) e (2) um atalho no Copiloto e no Guia. Pré-preenche **de = moeda da viagem/última usada → para = `anchorCurrency` ?? moeda de casa**. Botão "⇄ inverter". Reusa `fetchExchangeRates` (online) e `frozenRates` (offline) com selo de idade.
- **RATIFICADO pelo Julio (v2):** fazer **também** o **intent de IA** "quanto é X em Y?" no AssistantSheet (conversão informativa, sem criar gasto). Então o V1 entrega **os dois**: tela `/converter` **e** a resposta de câmbio na IA. (Cuidado de token: a conversão pode ser resolvida **localmente** com as taxas já em cache — a IA só precisa **extrair {valor, de, para}** e o app faz a conta; assim não gastamos token à toa e funciona offline.)
- **"No Brasil isso é ~R$Y" → PARADO (ver C12):** Julio topa a ideia **mas** só com "preço real, pesquisado, e onde". Groq **não navega na web** → preço alucinado violaria a regra dele e poderia queimar token do free tier. **Não construir agora**; fica registrado como ideia futura condicionada a um backend de busca de preço real.
- **Lente de maior peso:** Architect + Critic — o valor é óbvio (Strategist/Advocate); o que decide a qualidade é reuso correto da cotação e a honestidade da idade dela.
- **O que reverteria:** se medirmos que ninguém abre a tela dedicada → manter só o intent de IA. _Minoria vence:_ usuários casuais preferem perguntar à IA — por isso o intent entra já no V1.
- **Confiança: ALTA.** Esforço: **M** (tela) + **P** (intent, pois a conta é local).

### C2 — Maturidade/unificação das superfícies de entrada (FB-09) · `/council`

**Decision Brief (neutro).** Hoje o FAB oferece, separadamente: **IA (texto/voz)**, **Registrar gasto (manual, sem IA)** e **Dividir conta (via foto da nota)**. A IA **não** aceita imagem; a entrada manual não tem atalho de IA; a foto só existe dentro de "Dividir conta". O usuário sente desconexão e pergunta: imagem dentro da IA? atalho de IA no manual? uma entrada única que pergunta o método (áudio/imagem/texto/manual)? Sem perder a riqueza do registro manual completo. _Viés a resistir: "unificar tudo numa entrada só" — o registro manual completo é o mais rico e não pode ser diluído._

- **Strategist** (teme confusão de marca da feature). A IA é o headline; ter 3 portas para "lançar gasto" dilui a promessa. Mas o registro manual completo é o nosso diferencial de profundidade. **Rec:** **uma porta de captura clara** ("Lançar gasto") que oferece métodos (digitar/falar/foto), e mantém "registro detalhado" como o destino sempre alcançável. **Confiança: MÉDIA-ALTA.** _Outros perdem:_ "Dividir conta" é caso de uso distinto (mesa/itens) — não deve sumir dentro de "lançar gasto".
- **Architect** (teme retrabalho/regressão). As três telas já existem e são robustas. O barato é **costurar atalhos** entre elas, não fundir motores: (a) botão "📷 foto" dentro do AssistantSheet que chama o mesmo OCR; (b) botão "✨ preencher com IA" dentro do `/quick-add`; (c) deixar "Dividir conta" como está. Fundir tudo num wizard novo é G e arriscado. **Rec:** atalhos cruzados, sem motor novo. **Confiança: ALTA.** _Outros perdem:_ a foto na IA precisa decidir se vira 1 gasto (resumo) ou abre o fluxo de itens — definir isso evita ambiguidade.
- **Critic** (achar a falha). O perigo é **canibalizar o registro detalhado**: se a IA "engole" tudo, perdemos categoria/local/divisão finas que o manual faz melhor. E "perguntar o método toda vez" adiciona um passo a quem só quer digitar. **Rec:** não obrigar a escolher método; o AssistantSheet já é texto-first — só **adicionar** o ícone de foto e de voz ali, e um atalho de IA no manual. Nada de wizard modal obrigatório. **Confiança: MÉDIA-ALTA.** _Outros perdem:_ a entrada manual completa deve continuar a porta "padrão ouro" para quem quer controle.
- **Advocate** (valor/simplicidade). O usuário pensa "quero lançar esse gasto" e não "qual engine". Ele quer: digitar OU falar OU fotografar, e às vezes preencher tudo na mão. **Rec:** AssistantSheet vira a "caixa de captura" com 3 ícones (teclado já é o padrão, mic já existe, **+ câmera**), e um link discreto "registro detalhado" para o manual; no manual, um chip "✨ preencher com IA". **Confiança: ALTA.** _Outros perdem:_ precisa de consistência de privacidade (foto → OCR é opt-in `cloudReceiptOcrEnabled`; texto/voz → `aiQuickEntryEnabled`).

**Red Team.** Unificar cedo demais = matamos a feature mais trabalhada (registro detalhado) e quebramos um fluxo que funciona (Dividir conta). Wizard "como quer registrar?" vira fricção para o caso 90% (digitar). O caminho mais barato e seguro é **costura de atalhos**, não um novo fluxo unificado.

**Síntese (Chair).**
- **Consenso:** **não** criar um wizard único obrigatório nem fundir motores. Costurar atalhos entre as três superfícies existentes.
- **Tensões:** Strategist quer "uma porta"; Critic/Architect querem preservar telas. **Resolução:** o **AssistantSheet** assume o papel de "caixa de captura" (texto + voz + **foto**); o manual ganha um atalho "✨ IA"; "Dividir conta" segue separado (caso mesa/itens). Sem passo obrigatório de escolher método.
- **Recomendação (gatos pequenos, baixo risco):**
  1. **Foto na IA:** botão de câmera no `InputArea` do AssistantSheet → reaproveita `extractReceiptViaCloud`; o resultado vira (a) **1 gasto resumido** (default, via `summarizeReceiptTotal`, com merchant→categoria/local) **ou** (b) "abrir itens" → handoff pro fluxo de recibo. Gate por `cloudReceiptOcrEnabled`.
  2. **Atalho de IA no manual:** chip "✨ Preencher com IA" no topo do `/quick-add` que abre o AssistantSheet pré-focado (e devolve ao manual no "editar tudo").
  3. **Nomes/descrições** do FAB revisados para deixar claro: "Lançar gasto" (IA, recomendado) · "Registro detalhado" (manual) · "Dividir conta" (mesa/nota).
- **Lente de maior peso:** Architect — a viabilidade sem regressão manda; o valor (Advocate/Strategist) é alto mas só se não quebrarmos o registro detalhado.
- **O que reverteria:** se a foto-na-IA gerar gastos pobres (sem itens) e frustrar, manter foto só no "Dividir conta". _Minoria vence:_ usuários que querem controle total continuam no registro detalhado intacto.
- **Confiança: MÉDIA-ALTA.** Esforço: **M** (cada atalho é P; somados M).

### C3 — Fluxo de "Iniciar saída": ainda faz sentido? + margens (FB-15/FB-16) · `/council`

**Decision Brief (neutro).** O fluxo de "Iniciar saída" (`/outings/new`) pede, no setup, várias perguntas (categorias, e até **preço médio da bebida** mesmo quando o contexto é "mercado"). A tela está **sem as margens laterais/padding padrão** das outras telas. Mudou muita coisa no app (IA, Dividir conta, contadores). Decidir se o fluxo de saída ainda deve ser exatamente assim, o que perguntar, quando e onde, com mínimo de regressão. _Viés a resistir: "redesenhar a saída inteira" — a saída ativa ao vivo é amada e funciona; o problema é o **setup** e o enquadramento, não a sessão._

- **Strategist** (teme perder um diferencial). A "saída ao vivo" (capturar rodadas com gauge) é diferencial real do TripPilot — não matar. O atrito está no **setup** que pergunta coisas de bar para qualquer contexto. **Rec:** manter a saída; enxugar o setup e torná-lo **contextual** (mercado ≠ bar). **Confiança: ALTA.** _Outros perdem:_ "Dividir conta" hoje cobre parte do caso "saí com amigos" — clarear quando usar saída vs dividir.
- **Architect** (viabilidade). `EVENT_CONTEXTS` + `deriveSessionLimits` já existem; o setup pode **derivar** limites por contexto sem perguntar preço de bebida quando irrelevante. A margem é trivial: a tela não está dentro do container de padding padrão. **Rec:** (1) corrigir o wrapper de padding; (2) tornar perguntas data-driven por `EventContext` (mostrar "preço médio da bebida" só p/ bar/noite). **Confiança: ALTA.** _Outros perdem:_ checar todas as leituras de `avgDrinkPriceCents` para não quebrar o gauge quando ele for null em contexto não-bar.
- **Critic** (achar a falha). O risco é tratar a saída como "formulário de bar" universal — daí a pergunta de bebida no mercado. E o padding quebrado denuncia que a tela foi feita fora do layout padrão (pode ter outros desalinhos). **Rec:** auditar o setup inteiro por contexto + alinhar a tela ao layout padrão (não só a margem). **Confiança: MÉDIA-ALTA.** _Outros perdem:_ "finalizar sem salvar" (FB-23) é parte do mesmo desconforto — o usuário quer poder sair/descartar.
- **Advocate** (simplicidade). Quero iniciar uma saída em 1–2 toques: "onde/que tipo?" e pronto; só me pergunte preço de bebida se for bar. **Rec:** setup mínimo por contexto, perguntas avançadas colapsadas. **Confiança: ALTA.** _Outros perdem:_ rótulos: "saída" pode confundir com a viagem; manter linguagem clara.

**Red Team.** Redesenhar a saída do zero é caro e arrisca um fluxo amado. Mas deixar o setup perguntando bebida no mercado mina a credibilidade ("o app não me entende"). O barato e seguro: **enxugar o setup por contexto + corrigir layout + permitir descartar**, sem tocar na sessão ativa.

**Síntese (Chair).**
- **Consenso:** manter a saída ao vivo; o alvo é o **setup** (perguntas contextuais) + **layout** (padding padrão) + **descartar** (FB-23).
- **Tensões:** nenhuma forte; todos convergem em "enxugar, não reconstruir".
- **Recomendação:** (1) `OutingPage` setup passa a montar perguntas **data-driven por `EventContext`** — `avgDrinkPrice` só aparece quando o contexto a usa (bar/noite); `deriveSessionLimits` cobre o resto. (2) Envolver a tela no **container de padding padrão** (alinhar com `/quick-add`). (3) Auditar leituras de `avgDrinkPriceCents` null fora de bar. (4) FB-23: ação "Finalizar e descartar" na sessão ativa.
- **Lente de maior peso:** Architect — tudo é reuso/dados; risco de regressão concentrado nas leituras de `avgDrinkPriceCents`.
- **O que reverteria:** se a auditoria achar muitos lugares assumindo "saída = bar", aí sim virar uma fase dedicada de redesenho. _Minoria vence (Critic):_ se o acoplamento for fundo, fazer a auditoria antes de mexer.
- **Confiança: MÉDIA-ALTA.** Esforço: **M**.

### C4 — Participantes inline na hora de registrar (FB-06/FB-24) · `/council`

**Decision Brief (neutro).** Ao registrar um gasto sem ninguém cadastrado, o app mostra "Adicione participantes em Mais → Participantes e dívidas." (`expenses.no_participants_hint`, `QuickAddPage.tsx:1271`) — empurra o usuário para Configurações e **trava** o fluxo de dividir/registrar quem pagou. O usuário quer **adicionar/conectar pessoas ali mesmo**, sem perder a tela nem os dados já preenchidos, em qualquer lugar onde se escolhe participantes. _Viés a resistir: "é só um link melhor" — o pedido é poder criar/conectar pessoas in-place sem perder estado._

- **Strategist** (teme abandono). Forçar ida às Configurações no meio de um registro mata a divisão (a feature mais social/viral). Quem divide convida pessoas → crescimento. **Rec:** adicionar pessoa inline é alavanca de divisão/retenção. **Confiança: ALTA.**
- **Architect** (viabilidade). Já existe orquestração de criar participante e conectar (Acerto de contas, links). Falta um **componente reutilizável** "adicionar participante" (criar avulso + escolher de conectados) que possa ser montado em qualquer seletor sem navegar. Estado do form do gasto não pode se perder → o add tem que ser overlay/sheet sobre a mesma tela. **Rec:** extrair `AddParticipantSheet` reutilizável que retorna o id criado e o seletor já o marca. **Confiança: MÉDIA-ALTA.** _Outros perdem:_ idempotência (não duplicar pessoa) e não auto-trocar de viagem.
- **Critic** (achar a falha). O risco é **perder o gasto pela metade** (navegar p/ Settings e voltar zera o form) e duplicar pessoas. Também: misturar "criar pessoa local" com "conectar dispositivo" pode confundir. **Rec:** sheet inline que NUNCA desmonta a tela atual; separar claramente "digitar um nome" (rápido) de "conectar amigo" (QR/lista de conectados). **Confiança: MÉDIA-ALTA.** _Outros perdem:_ o mesmo problema existe no AssistantSheet (clarify "add_person") e no recibo — unificar.
- **Advocate** (simplicidade). Quero, na hora: "+ pessoa" → digito "Bruno" → já aparece marcável; ou toco num amigo conectado. Sem sair, sem refazer. **Rec:** botão "+ adicionar pessoa" embutido no seletor de participantes em todo lugar. **Confiança: ALTA.**

**Red Team.** Se o add inline navegar para outra rota (mesmo que "volte"), perde o estado e piora a experiência — o usuário some com o gasto digitado. Tem que ser overlay puro sobre a mesma árvore React. E se duplicar pessoas, o ledger fica sujo.

**Síntese (Chair).**
- **Consenso:** substituir o hint-que-empurra-pra-Settings por **adicionar pessoa inline** (overlay, sem perder estado), reutilizável.
- **Tensões:** rapidez (digitar nome) × conexão (QR/conectados). **Resolução:** um sheet com **dois caminhos**: "digitar nome" (cria participante local na hora) e "amigos conectados" (lista existente) — espelhando o que já existe em Acerto de contas.
- **Recomendação:** extrair `features/participants/AddParticipantSheet.tsx` (reusa orquestradores de criar/conectar) e montá-lo no seletor de participantes do `QuickAddPage`, do recibo e do `AssistantSheet` (clarify). Trocar `no_participants_hint` por um botão "+ Adicionar quem participou". Garantir idempotência por nome/nickname e nunca desmontar a tela.
- **Lente de maior peso:** Architect — o sucesso depende de não perder estado e reusar a orquestração existente.
- **O que reverteria:** se o componente reutilizável criar acoplamento ruim entre telas, manter ao menos no `/quick-add` (onde dói mais). _Minoria vence:_ —
- **Confiança: ALTA.** Esforço: **M**.

### C5 — Default de localização ligado + nome de dispositivo automático (FB-03/FB-05) · `/assess`

**Decision Brief (neutro).** Julio quer: (a) **registro de local de gastos LIGADO por padrão** (usuário desliga se quiser) — hoje `locationCaptureEnabled: false` por privacidade (ÂNCORA 8 / DEC-08x "GPS nunca lido até o usuário ligar"); (b) **nome do dispositivo automático** (ex.: modelo do aparelho) quando o usuário não digita nada — hoje default fixo "Meu dispositivo". Avaliar risco/viabilidade de ambos. _Viés a resistir: "ligar tudo por padrão é melhor UX" — há um anchor de privacidade explícito e a permissão de GPS é do SO, não do app._

- **Risk Analyst.** (a) Ligar location por padrão **conflita com a ÂNCORA 8 e DEC** de privacidade-first; risco reputacional/loja (permissões). PORÉM: o flag liga a **feature** (campo de local, lugar lembrado), não força leitura de GPS — o SO ainda pede permissão na 1ª vez. Risco real médio se separarmos "feature on" de "ler GPS sob permissão". (b) Nome automático = modelo do aparelho: UA não dá modelo confiável na web (Android dá pouco; iOS quase nada). Risco de mostrar string técnica feia. Mitigação: nome amigável derivado (ex.: "Android · Chrome", "iPhone (Safari)") em vez do modelo cru.
- **Opportunity Scout.** Location on por padrão destrava os insights por lugar/mapa para a maioria (hoje subutilizados por ficar off). Nome automático elimina "Meu dispositivo" repetido em conexões/admin → telas de pessoas/admin ficam legíveis na hora. Ganho de clareza alto, custo baixo.
- **Cost Analyst.** (a) **P-M**: trocar default + tela de onboarding/consentimento curto ("registrar local dos gastos? [Ligado] — você controla nas Configurações") + revisar telemetria `usesLocation`. (b) **P**: util `suggestDeviceName()` (plataforma + navegador) usada como placeholder/efetivo quando vazio. Custo de manutenção baixo.
- **Timeline Realist.** Ambos cabem num gate P-M. O caminho honesto para (a) é **opt-out com 1ª-execução transparente**, não ligar GPS escondido. Para (b), placeholder dinâmico é trivial; "efetivar o nome automático se vazio" precisa cuidar de backup/restore (não sobrescrever um nome já escolhido).

**Red Team / Opposição.** Ligar localização por padrão pode ser lido como regressão de privacidade e contradiz uma ÂNCORA — se mal feito (ler GPS sem aviso), é um problema sério de confiança, justo no app que se vende como "local-first e privado". A versão segura: **default ON da feature + permissão de SO sob demanda + texto claro + 1 toque para desligar**, e registrar como **emenda explícita à ÂNCORA 8** (decisão consciente do Julio), não um default silencioso.

**Síntese (Chair).**
- **Recomendação (a) Location — ✅ RATIFICADO pelo Julio (v2):** mudar `locationCaptureEnabled` **default → true**, MAS: (1) **não** ler GPS sem a permissão do SO (continua sob demanda); (2) onboarding/primeiro uso mostra um aviso curto "Registro de local: Ligado — você desliga quando quiser nas Configurações"; (3) ÂNCORA 8 recebe **emenda registrada** (DEC-265) dizendo que o default passou a ON por decisão de produto, mantendo opt-out 1-toque e sem leitura de GPS sem permissão. **Confiança: ALTA** (aprovado).
- **Recomendação (b) Device name:** `suggestDeviceName()` puro (plataforma + navegador, ex.: "Android · Chrome", "iPhone · Safari", "PC · Edge"; nativo: "Android" / "iPhone") usado como **placeholder** no campo e como **valor efetivo quando o usuário deixa em branco**. Nunca sobrescreve um nome digitado nem o nome vindo de backup. Evitar modelo cru (não confiável/feio). **Confiança: ALTA.**
- **Lente de maior peso:** Risk Analyst — o que decide é tratar privacidade com transparência, não a conveniência.
- **Confiança geral: MÉDIA-ALTA.** Esforço: **P-M**.

### C6 — Amigo Sincero: banco de frases contextual (FB-12) · `/brainstorm`

**Decision Brief (neutro).** O "Amigo Sincero" tem veredictos por `kind` (ok) mas o **extra** `phase_progress` usa **uma única frase template** (`amigo_extra_phase_progress`) para **toda** a faixa 0–100%+ (só muda a cor do tom a partir de 90%; o `percent` é clampado a 100), de modo que a 100%+ ("já estourou") ainda diz "…Vale dar uma segurada." — tom errado e repetitivo. Julio quer **muitas frases**, com **vários tons** ("tiradentes"/puxões de orelha reais) **conforme o contexto** (sob orçamento, perto, em 100%, acima/na reserva), com variedade. Manter honestidade (sem mentir os números). _Viés a resistir: "só escrever frases bonitas" — o valor é tom certo por faixa de contexto + variedade sem soar aleatório._

- **Visionary.** Um "amigo" com personalidade memorável: frases que mudam por **faixa** (folgado/no jeito/no limite/estourou/na reserva) e por **momento** (começo vs fim da fase), com leve humor quando está bem e seriedade real quando estourou. Poderia até ter "vozes" (econômico/zen/durão) escolhíveis. **Para hoje:** um banco por faixa com rotação.
- **Analyst.** Apps de orçamento que funcionam variam o reforço (positivo quando no trilho, alerta calibrado quando não). O erro clássico é alarmar igual em 60% e 100%. Basear nas faixas já calculadas (`getHonestFriendTone`) garante coerência tom↔número. Rotação determinística (por dia/seed) evita repetição sem virar aleatório irritante.
- **Connector.** Pegar de coaches/fitness/Duolingo: streaks elogiados, recaída tratada com firmeza-sem-culpa. Traduzir: <60% "tá voando, sobra X/dia"; 75–90% "atenção, o ritmo aperta"; 90–99% "reta final do caixa: faltam X"; 100% "acabou o livre desta fase — daqui é da reserva"; reserva "você já cavou X da reserva — segura agora".
- **Simplifier.** Mínimo viável que resolve o problema relatado: trocar a frase única por um **mapa faixa→[frases]** (3–5 por faixa, 3 idiomas), escolhendo por faixa e variando por índice estável. Sem novo motor — só dados + um seletor puro.

**Red Team.** Se as frases não respeitarem o número exato (ex.: dizer "segura" quando já estourou), o amigo perde credibilidade — pior que a frase única. E variedade demais sem regra vira ruído. A âncora: faixa derivada do número manda; variedade só dentro da faixa.

**Síntese (Chair).**
- **Recomendação:** criar `domain/budget/honest-friend-voice.ts` puro: `pickPhraseKey(band, seedDay)` mapeando **faixas** (definidas a partir de `percent` e do `kind`/tone já existentes) para listas de chaves i18n; o card escolhe por faixa + índice estável (data) → variedade sem aleatório. Popular i18n (`amigo_phase_band_*`) com **4–6 frases por faixa × 3 idiomas**, com **tom correto** (positivo/observador/cauteloso/sério). Em especial: **100%** e **na reserva** ganham frases próprias (sem "dar uma segurada" genérico). Testes unitários por faixa (a frase nunca contradiz o número).
- **Faixas propostas:** `under_easy` (<60%), `under_ok` (60–74%), `tight` (75–89%), `edge` (90–99%), `broke` (=100% / true free ≤ 0 sem reserva), `reserve` (cavando a reserva). Reusar `buildHonestFriendV2`/`getHonestFriendTone` como fonte da faixa.
- **Confiança: ALTA.** Esforço: **M** (texto + seletor puro + testes).

### C7 — Erros e info do aparelho por usuário no Admin (FB-21) · `/assess` (privacidade)

**Decision Brief (neutro).** Julio quer ver, no detalhe do usuário no Admin: **os erros que vieram do app dele** e **mais infos do aparelho** (qual aparelho, navegador) para debugar. Hoje os erros são agregados globalmente (por hash, com nº de usuários afetados) e o install só guarda `platform` (ios-web/android-web/web/native), versão, locale, país. Avaliar como expor por-usuário sem violar a política (sem valores, sem conteúdo de gasto). _Viés a resistir: "coletar tudo pra debugar" — a constituição de privacidade proíbe PII/valores; aparelho detalhado é sensível._

- **Risk Analyst.** Ligar erros a um install já é possível (o `ingestError` recebe `installId`). Mostrar "erros deste usuário" é baixo risco SE o texto já é scrubdado (truncado, sem dígitos longos). Coletar **modelo do aparelho/navegador** aumenta o fingerprint → risco de privacidade; mitigar com granularidade grossa (família de SO + navegador + versão do app), não modelo exato.
- **Opportunity Scout.** Erros por usuário + SO/navegador/versão tornam o debug real (reproduzir "no Android Chrome v X estoura"). Alто valor de suporte.
- **Cost Analyst.** **M**: (1) endpoint `/admin/install-errors?id=` (join via tabela que já guarda `install_id` no ingest de erro); (2) enriquecer telemetria com `browser` (família) + manter `platform` (com PWA, ver FB-20); (3) UI no modal. Sem novo dado monetário.
- **Timeline Realist.** Cabe num gate M junto do FB-17/FB-20. Cuidar de não estourar o tamanho do DO (limitar nº de erros por install).

**Red Team.** Acrescentar fingerprint de aparelho contradiz o discurso de privacidade do app; se vazar/parecer invasivo, custa confiança. Manter **granularidade grossa** (SO+navegador+versão), nunca modelo exato/serial, e sem qualquer valor.

**Síntese (Chair).**
- **Recomendação:** (1) no modal do usuário, listar **erros recentes daquele install** (reusa scrub existente; limitar a N); (2) enriquecer telemetria com **navegador (família)** e refinar `platform` com PWA (FB-20), exibindo "Android · Chrome · PWA · v0.99.39" — **sem** modelo exato; (3) documentar na política que isso é técnico-grosso e não-monetário.
- **Lente de maior peso:** Risk Analyst.
- **Confiança: MÉDIA-ALTA.** Esforço: **M**.

### C8 — Governança de tokens Groq + projeções no Admin (FB-18) · `/council` (curto)

**Decision Brief (neutro).** Plano Groq é **free**, com limites apertados (verificado: ~30 RPM, 6.000 TPM, RPD 1.000–14.400 por modelo). Julio quer no Admin: gráficos/uso de tokens **por minuto/dia/mês**, **quanto do limite estamos usando**, e **projeções** ("com a média de uso dos ativos de hoje, cabem N usuários ativos com IA ligada"). Já temos `ai_usage(day, fn, tokens, runs)` por install. _Viés a resistir: "inventar números" — usar os limites reais e, idealmente, a cota real dos headers do Groq._

- **Architect.** Já somamos `total_tokens` por dia/função. Para "por minuto", agregar por janela (precisamos do timestamp fino; hoje é por dia — adicionar um rollup `ai_usage_minute` leve ou usar os **headers `x-ratelimit-*`** do Groq como verdade de cota). Projeção = `tokens/usuário ativo/dia` × DAU → % do TPD/limite. **Rec:** capturar os headers do Groq no Worker (cota REAL) + rollups dia/mês + projeção simples. **Confiança: ALTA.**
- **Critic.** Projeção pode enganar (uso não é linear; picos batem no TPM/RPM antes do diário). **Rec:** mostrar os **três tetos** (RPM/TPM/RPD-TPD) e qual é o gargalo, não um número único; e exibir a cota REAL restante dos headers (não só estimativa). **Confiança: ALTA.**

**Síntese (Chair).**
- **Recomendação:** (1) Worker passa a **ler e persistir** o último snapshot dos headers `x-ratelimit-limit-tokens/remaining-tokens/limit-requests/remaining-requests/reset-*` de cada resposta Groq (por função/modelo) → "cota real agora"; (2) Admin "IA — governança Groq": uso por **dia** (já dá) e **mês** (soma), uso por **minuto** (rollup leve ou pico observado), **% do limite** com o **gargalo** destacado (TPM costuma ser o limite real); (3) **projeção** "média tokens/usuário ativo/dia × DAU → quantos ativos cabem antes do TPD/RPD", explicitando que TPM/RPM podem bater antes. Verificado pelos docs do Groq.
- **Confiança: ALTA.** Esforço: **M** (headers + rollups + seção). Subir "por minuto" real é o pedaço mais chato (timestamp fino) → começar pelos headers (cota real) + dia/mês + projeção.

### C9 — Planejador no modo "Dia a dia" (FB-25) · `/review` (curto)

**Decision Brief (neutro).** No modo contínuo (`Trip.kind='ongoing'`, DEC-250), as features acopladas a data devem ficar atrás do portão de capacidades. O planejador e pré-preenchimentos podem assumir datas/fases. Revisar o que realmente funciona no Dia a dia e o que não pode pré-preencher. _Viés a resistir: "o portão já cobre tudo" — pré-preenchimentos e o planejador podem vazar suposições de data._

- **Correctness.** Conferir que `/planner`, simulador, "disponível por dia", check-in lens e o forecasting **não rodam** ou **degradam** no `ongoing` (sem datas → NaN/0). O mapa de capacidades (DEC-250) precisa cobrir cada leitura.
- **Maintainability.** Centralizar o gate (um `capabilitiesFor(kind)`), não espalhar `if kind===` por telas.
- **Security/Perf.** N/A relevante.

**Bug concreto relatado pelo Julio (v2).** "Se eu **não entro** no planejador, não tem planos (ok). Mas **assim que entro**, por padrão ele **já adiciona planos** e o valor **já fica negativo**, já que não tem as outras funções de valores." → Ou seja, **abrir** o planejador tem efeito colateral de **criar/pré-preencher** planos (provavelmente sugestões por fase/datas), e no modo Dia a dia (sem datas/receita configurada) isso resulta em saldo negativo. **Abrir uma tela nunca deveria escrever dados.** (ÂNCORA: read-only na leitura.)

**Síntese.** **Recomendação:** (1) **Abrir o planejador não pode criar nem pré-preencher planos** — separar "sugestão" (apresentada, não persistida) de "plano salvo" (só por ação explícita do usuário). (2) Auditar as superfícies de planejamento/pré-preenchimento sob `kind==='ongoing'`; o que depende de data deve estar escondido pelo mapa de capacidades; o que pré-preenche por fase **não** pré-preenche no contínuo. (3) Garantir que saldo/valores **não ficam negativos** por falta de configuração — mostrar estado vazio ("configure receita/limite") em vez de número negativo. Teste de fumaça: criar espaço `ongoing`, abrir cada tela de planejamento → **zero gravações**, sem crash, sem número absurdo. **Confiança: MÉDIA-ALTA.** Esforço: **M** (auditoria + guardas + corrigir o efeito colateral de abertura).

### C10 — Degradação graciosa quando o free tier do Groq estoura (FB-26) · `/council`

**Decision Brief (neutro).** O plano grátis do Groq acaba (RPM/TPM/RPD). Quando isso acontece, as funções de IA (assistant, OCR, transcrição) param e hoje provavelmente mostram um erro genérico. Julio quer **avisar o usuário** sem dizer "nosso plano acabou": algo como "estamos com alta demanda de IA", e **estimar quando volta** (countdown) para ele saber quanto esperar. Verificado: o 429 traz `retry-after` (s) e toda resposta traz `x-ratelimit-reset-*`. _Viés a resistir: "é só um toast de erro" — o valor é transformar a falha numa espera previsível e manter o app 100% útil sem IA._

- **Strategist** (teme dano à marca da IA). Se a IA "morre" sem explicação, o usuário acha que o app quebrou. Uma mensagem honesta-mas-gentil + tempo de volta preserva confiança e ensina que o resto do app funciona sem IA. **Rec:** mensagem calorosa + countdown + sempre oferecer o caminho manual. **Confiança: ALTA.** _Outros perdem:_ é também um sinal de produto (se bate muito, é hora de pensar em upgrade/segunda chave).
- **Architect** (viabilidade). O Worker já é o proxy único do Groq → ele **vê o 429 e os headers** e pode devolver ao cliente um corpo estruturado `{ unavailable: true, retryAfterSec }`. O cliente mostra o countdown e desabilita o botão de IA por esse tempo. Pode até **prever** (se `remaining-tokens` ~0, entrar em modo degradado antes do 429). **Rec:** Worker normaliza 429→payload com `retryAfterSec`; cliente tem um `aiCooldownUntil`. **Confiança: ALTA.** _Outros perdem:_ o reset do TPM é rápido (segundos), do RPD é até meia-noite UTC — a mensagem deve diferenciar "volta em segundos" de "volta amanhã".
- **Critic** (achar a falha). Mentir ("alta demanda") quando o reset é só amanhã (RPD) frustra mais — o usuário fica apertando. E countdown errado destrói confiança. **Rec:** usar o **valor real** do header; se for RPD (volta só amanhã), dizer algo como "as funções de IA voltam amanhã; enquanto isso, registre manualmente" — honesto e útil; nunca um countdown falso. **Confiança: MÉDIA-ALTA.** _Outros perdem:_ precisa cair **graciosamente** — o caminho manual tem que estar a um toque do erro.
- **Advocate** (valor/simplicidade). Quero saber: "não dá agora, tenta em ~30s" ou "volta amanhã", e um botão "registrar na mão" ali mesmo. Sem jargão. **Rec:** banner/sheet curto com tempo + atalho manual. **Confiança: ALTA.** _Outros perdem:_ se eu estava no meio de um registro por IA, não posso perder o que digitei → cair pro manual **com o texto preservado**.

**Red Team.** Um countdown impreciso ou uma mensagem que esconde demais ("alta demanda" quando na verdade volta só amanhã) gera tentativas repetidas e raiva. Pior: se a falha de IA bloquear o registro do gasto (em vez de cair pro manual), o usuário perde o gasto. A salvaguarda: tempo **real** dos headers + sempre rebaixar para o manual preservando o input.

**Síntese (Chair).**
- **Consenso:** transformar a indisponibilidade em **espera previsível + caminho manual imediato**, com tempo **real** (nunca inventado), sem revelar detalhes de billing.
- **Tensões:** "tom gentil/vago" (Strategist) × "honestidade do tempo" (Critic). **Resolução:** mensagem gentil **com** tempo real: reset curto (TPM/RPM) → "Estamos com alta demanda de IA agora. Tente de novo em ~{n}s." ; reset longo (RPD, volta à meia-noite UTC) → "As funções de IA estão indisponíveis no momento e devem voltar mais tarde. Você pode registrar manualmente agora."
- **Recomendação:**
  1. **Worker:** ao receber 429 do Groq (ou `remaining` ~0), responder `200`/`503` com corpo `{ aiUnavailable: true, retryAfterSec, scope: 'minute'|'day' }` derivado de `retry-after`/`x-ratelimit-reset-*`. Aplicar a **assistant, ocr, transcribe**.
  2. **Cliente:** um `aiCooldownUntil` (memória + persistência leve) que desabilita os gatilhos de IA e mostra um banner/sheet com countdown (`scope:'minute'`) ou aviso "volta mais tarde" (`scope:'day'`), sempre com botão **"Registrar manualmente"** que abre o `/quick-add` **preservando o texto/áudio já digitado** quando houver.
  3. Opcional: registrar no Admin quantas vezes batemos no limite (sinal para FB-18/upgrade).
- **Lente de maior peso:** Critic — a honestidade do tempo é o que decide se a feature ajuda ou irrita.
- **O que reverteria:** se a maioria dos 429 for por minuto (volta em segundos), o banner pode ser bem leve; se for diário e frequente, vira sinal forte para upgrade/2ª chave (decisão de negócio).
- **Confiança: ALTA.** Esforço: **M**.

### C11 — IA de ajuda/concierge do app, ancorada numa KB (FB-28) · `/council` (com custo de token)

**Decision Brief (neutro).** Julio quer poder **perguntar à IA como o app funciona** ("como faço X?", "qual a melhor forma de economizar em Y?"). A IA não tem acesso ao código (e não pode ter), então precisaria de uma **base de conhecimento** do app para responder. Restrição dura do próprio Julio: **se gastar muito token, não fazer** — ler muito texto a cada pergunta consome o orçamento de tokens que os usuários precisam para as funções importantes (e pode derrubar a IA inteira no free tier). Avaliar se faz sentido, se usuários usariam, e como manter barato. _Viés a resistir: "RAG com o brain inteiro" — o brain é enorme; enfiar isso no prompt mata o free tier._

- **Strategist** (teme custo de oportunidade). Um concierge que ensina o app aumenta ativação e descoberta de features (temos MUITAS features escondidas — ver FB-02). Mas só vale se for barato; senão canibaliza a IA de registro, que é o core. **Rec:** fazer **enxuto** (FAQ curada), não um chatbot que lê tudo. **Confiança: MÉDIA.** _Outros perdem:_ metade do valor pode ser entregue **sem IA** (busca no Guia FB-02).
- **Architect** (viabilidade/custo). Caminho barato: uma **KB compacta** (~30–60 Q&A curtas, escritas por nós, em 3 idiomas) + **retrieval local** (sem IA) que casa a pergunta por palavra-chave/embeddings simples e mostra a resposta **direto** (0 token). Só **se** não casar, mandar à IA um **contexto pequeno** (os 2–3 trechos mais próximos, não o brain inteiro) → ~poucas centenas de tokens. Nunca enviar o brain todo. **Rec:** "ajuda híbrida": busca local primeiro, IA como fallback com contexto mínimo. **Confiança: ALTA.** _Outros perdem:_ a KB precisa ser mantida (cada feature nova → 1 Q&A), senão envelhece igual o Guia.
- **Critic** (achar a falha). Risco 1: **custo de token** descontrolado se cada "oi" vira chamada de IA com contexto grande → mata o core. Risco 2: a IA **alucina** funcionalidades que não existem (pior que não responder). Risco 3: vira suporte que precisa de manutenção eterna. **Rec:** (a) **gate por token-budget** (se estamos perto do limite, ajuda vira só busca local, sem IA); (b) a IA só pode responder **a partir** dos trechos fornecidos ("se não está no contexto, diga que não sabe e aponte o Guia"); (c) começar **sem IA** (busca no Guia) e só ligar a IA se houver demanda. **Confiança: MÉDIA-ALTA.** _Outros perdem:_ o maior valor/custo-benefício é a busca local; a IA é o topo do bolo.
- **Advocate** (valor). Quero digitar "como divido uma conta?" e receber a resposta + um botão que me leva à tela. Não me importa se é IA ou não. **Rec:** caixa de ajuda que responde e **leva à ação** (deep-link). **Confiança: ALTA.** _Outros perdem:_ a resposta tem que **linkar a rota** (reusa o catálogo do FB-02).

**Red Team.** Um concierge de IA que lê muito texto por pergunta é exatamente o que pode **derrubar a IA do app inteiro** ao estourar o TPD/TPM — sacrificando o core (registro por IA) por um nice-to-have. E se alucinar features, ensina errado. O caminho seguro é **busca local primeiro (0 token)**, IA só como fallback com contexto mínimo e **gate de orçamento**.

**Síntese (Chair).**
- **Consenso:** a versão valiosa e segura é **híbrida e barata**: busca local numa KB compacta curada (0 token) que responde e **deep-linka** para a tela; IA **apenas como fallback** com contexto mínimo (2–3 trechos) e **proibida de inventar** além do contexto.
- **Tensões:** "fazer com IA" (Advocate/Strategist) × "custo pode matar o core" (Critic). **Resolução:** **V1 = sem IA** (busca local no catálogo do Guia + KB de Q&A, reusando FB-02) — entrega 80% do valor a 0 token. **V2 = IA fallback** atrás de um **gate de orçamento de token** (só liga se houver folga no TPD) e instruída a responder só a partir dos trechos.
- **Recomendação:** (1) construir a **KB de ajuda** (Q&A curtas, 3 idiomas) + busca local que mostra resposta + botão para a rota; reusar o `guide-catalog` (FB-02). (2) **Só depois**, se houver demanda e folga de token, ligar o fallback de IA com contexto mínimo e o gate de orçamento (amarrado ao FB-18/FB-26). **Não** enviar o brain inteiro, nunca.
- **Lente de maior peso:** Critic + Architect — o que decide é o custo de token não ameaçar o core de IA.
- **O que reverteria:** se a busca local resolver quase tudo (provável), talvez nunca precise da IA — ótimo (custo zero). _Minoria vence:_ se usuários fizerem perguntas abertas que a KB não cobre, aí o fallback de IA justifica o custo.
- **Confiança: MÉDIA-ALTA.** Esforço: **M** (V1 sem IA) · **M** adicional (V2 IA fallback).

### C12 — "No Brasil isso é ~R$Y" (comparação de preço real) — viabilidade · `/assess`

**Decision Brief (neutro).** Extensão do FB-04: além de converter a moeda, dizer se o preço "vale a pena" mostrando **quanto custa no Brasil** (ou país de referência) — idealmente com **foto** do item (a IA entende o que é) + **descrição** para pesquisar **preço real e onde**. Regra dura do Julio: **só preço real, pesquisado**; se não der com a nossa IA (Groq), **não fazer**; e se gastar muito token a ponto de derrubar a IA do app, **não fazer**. _Viés a resistir: "a IA sabe o preço" — LLM sem browsing só "lembra" preços do treino (desatualizados/alucinados)._

- **Risk Analyst.** O risco central é **preço errado apresentado como real** → o usuário toma decisão de compra com base em alucinação. Groq não navega na web (cutoff 2024-08), então qualquer preço "do Brasil" seria memória de treino, sem fonte nem "onde". Isso **viola diretamente** a regra do Julio e a `fact-verification.mdc`. Risco ALTO de erro factual.
- **Opportunity Scout.** O caso de uso é ótimo ("compro ou não?") e diferenciaria o app — mas o valor depende de **preço confiável + onde**, que exige um provedor de busca de preço (ex.: API de varejo/preços) que **não temos**. Sem isso, a oportunidade não é capturável com qualidade.
- **Cost Analyst.** Visão (foto→"o que é") é viável e barata no Groq. Mas a parte cara/inviável é o **preço real**: ou (a) usamos a IA pra "chutar" (inaceitável), ou (b) integramos um backend de busca de preço (custo de engenharia + possível custo por chamada + manutenção). Token de visão + descrição também consome do mesmo free tier do core.
- **Timeline Realist.** Fazer direito = projeto próprio (provedor de preço, normalização de país/varejo, cache). Não cabe neste lote e não deve bloquear o FB-04.

**Red Team / Oposição.** Lançar "preço no Brasil" só com Groq seria entregar um número que **parece** autoridade e **mente** — exatamente o que mais corrói a confiança num app de dinheiro. Melhor não ter.

**Síntese (Chair).**
- **Recomendação:** **NÃO construir agora.** Entregar o FB-04 puro (conversão de moeda confiável). O "preço no Brasil + onde" fica **parado/backlog**, condicionado a: (1) um **provedor real de preços** (não a memória do LLM); (2) custo de token/infra que **não ameace** o core de IA. A parte "foto → o que é o item" pode ser explorada isolada no futuro (Groq vision), mas **sem** afirmar preço sem fonte.
- **Lente de maior peso:** Risk Analyst — a regra "só preço real" do Julio + `fact-verification.mdc` vetam a versão só-LLM.
- **Confiança: ALTA** (de que não devemos fazer agora). Esforço: **—** (parado).

### C13 — Cofrinho × check-in "não vou gastar hoje" (esclarecer FB-08) · `/council` (curto)

**Decision Brief (neutro).** Julio entende que sem economia real não há cofrinho, mas estranha: ao marcar "não vou gastar hoje", o app diz que vai **guardar esse dinheiro** — não deveria ir pro cofrinho? Hoje o check-in `no_spend` provavelmente usa `projectDailyBoostCents` (redistribui o livre de hoje para os **próximos dias**, aumentando o diário), enquanto o **cofrinho** (`calculatePiggyBank`) é o **under-spend acumulado vs ritmo linear**. São **dois modelos mentais diferentes** com a mesma promessa ("você economizou"), e isso confunde. _Viés a resistir: "é só copy" — pode ser conflito conceitual real entre dois mecanismos._

- **Architect.** São cálculos distintos e ambos read-only. "Não gastar hoje" hoje **espalha** o valor pra frente (mais diário nos próximos dias), não **acumula** num cofre. Tecnicamente dá pra (a) fazer o dia de não-gasto **creditar o cofrinho** (tratar o gasto planejado do dia como poupado), ou (b) manter o carry-forward e só **alinhar a linguagem**. **Rec:** decisão de produto; tecnicamente ambas são pequenas. **Confiança: MÉDIA.**
- **Advocate.** "Guardei" e "vou ter mais por dia" são sensações diferentes. Se o app fala "guardar", o usuário espera ver um **cofre crescendo**. O carry-forward ("+X/dia") é menos satisfatório que ver o cofrinho subir. **Rec:** unificar na narrativa do **cofrinho** (mais tangível). **Confiança: MÉDIA-ALTA.** _Outros perdem:_ ver o cofre subir vicia mais que diluir no diário.
- **Critic.** Se "não gastar hoje" credita o cofrinho **e** o cofrinho é "under-spend vs ritmo", há risco de **contar duas vezes** (o dia sem gasto já reduz o gasto total, o que por si já aumenta o under-spend). Precisa de uma definição única de cofrinho pra não inflar. **Rec:** **uma** fonte de verdade do "quanto poupei", evitando dupla contagem. **Confiança: MÉDIA-ALTA.** _Outros perdem:_ a matemática tem que fechar — não pode o cofrinho + carry-forward somarem mais que o real poupado.

**Red Team.** Prometer "guardei esse dinheiro" e não mostrar lugar nenhum guardando é quebra de promessa; mas creditar o cofrinho ingenuamente pode **dobrar** a contagem (dia sem gasto reduz o total → já vira under-spend; somar de novo no cofre infla). Qualquer mudança precisa de **uma definição matemática única**.

**Síntese (Chair).**
- **Consenso:** o problema é **conceitual/linguagem**, não um bug de render. Hoje "não vou gastar" faz **carry-forward** (+diário futuro), e isso **não** alimenta o cofrinho — daí a estranheza.
- **Tensões:** "creditar o cofrinho" (Advocate, mais satisfatório) × "evitar dupla contagem" (Critic).
- **✅ DECISÃO DO JULIO (v2): Opção A + cofrinho vira BUFFER.** Julio: "acho legal sim o cofrinho então, mas então temos que **usar o cofrinho automaticamente quando passarmos o valor de um dia**… se eu tenho o dinheiro do cofrinho, **antes de** diminuir quanto posso usar nos outros dias, ele **gasta o dinheiro guardado no cofrinho**." → O cofrinho deixa de ser só um troféu visual e passa a ser um **colchão**: ao estourar o limite de um dia, o excedente é **debitado do cofrinho primeiro**; só quando o cofrinho zera é que o **diário dos próximos dias** começa a ser cortado.

**Modelo matemático proposto (buffer-aware, ainda read-only/derivação — ÂNCORA 11/12).**
- `baseDailyIdeal = phaseBudget / totalDays` (ritmo linear, **constante**).
- `idealToDate = baseDailyIdeal × daysElapsed` ; `spentToDate = soma dos gastos até hoje`.
- `cofrinho = max(0, idealToDate − spentToDate)` (under-spend acumulado — **mesma fórmula de hoje**; nenhuma poupança é "guardada" mutável → continua derivação pura, sem dupla contagem).
- **Mudança central — "quanto posso gastar por dia" deixa de re-mediar pra baixo enquanto houver cofrinho.** Hoje o livre/dia ≈ `(phaseBudget − spentToDate) / daysRemaining` (re-média: estourar um dia **corta** os próximos). No modelo novo, o livre/dia exibido permanece em **`baseDailyIdeal`** enquanto `cofrinho > 0`; o estouro de um dia **aparece como o cofrinho descendo**, não como o diário caindo. Quando `cofrinho = 0` e o usuário segue acima do ritmo, **aí sim** o diário cai (volta a `(phaseBudget − spentToDate)/daysRemaining`, que nesse ponto é < baseDailyIdeal).
- **Sem dupla contagem:** o dia de não-gasto reduz `spentToDate`, o que **aumenta o cofrinho** pela fórmula — é o **mesmo** valor, exibido como o cofre subindo (não somado duas vezes).

- **Recomendação:** **Opção A + buffer.** O check-in "não vou gastar" mostra o **cofrinho subindo**; estourar um dia mostra o **cofrinho descendo**; o diário só cai quando o cofrinho zera. **Uma** definição de "poupado" (a fórmula acima) para tudo.
- **Atenção (Critic) — isto é uma evolução do motor de orçamento, não só UI.** Mexe em como o "livre por dia" reage a estouros. Precisa de **spec matemática dedicada + testes fortes** (cenários: under-pace, 1 dia estourado coberto pelo cofrinho, cofrinho esgotado, fase sem datas) e deve entrar como **emenda registrada** à mecânica de savings (ÂNCORA 11) — derivação continua pura, mas o comportamento do diário muda por decisão de produto.
- **Lente de maior peso:** Critic — a matemática tem que fechar (nenhum centavo dobrado nem sumido).
- **Confiança: MÉDIA-ALTA** (direção decidida). Esforço: **M-G** (motor + UI do check-in + testes) / risco médio-alto → **recomendo uma mini-spec/council de matemática no momento de implementar.**

---

### C14 — Cofrinho: compreensão + extrato + onde aparece (reabre o "buffer" do C13) · `/council`

> Cost contract: rodou **inline nesta sessão (1 request, sem subagentes)**. Perspectivas escritas às cegas, cada uma reancorada no brief.

**Decision Brief (neutro).** Hoje o cofrinho é **um número opaco derivado** (`calculatePiggyBank = max(0, idealToDate − spentToDate)`): aparece/some sem explicação, **não tem extrato** (não diz de onde veio cada centavo nem quando saiu) e **não tem propósito claro** — o próprio Julio (líder de produto) diz não entender o que é. O DEC-261 já decidiu torná-lo um **buffer** (consome a poupança ao estourar o dia antes de cortar os próximos dias), mas Julio **reabre** se essa dinâmica é a certa e pede: (1) **dar voz/compreensão** — explicar o que é/faz; (2) **extrato ao tocar** — de onde veio (dia X você não gastou → +Y), quando saiu (dia Z você estourou em tais itens → −W), incluindo **cobertura parcial** ("paguei parte com o cofrinho"); (3) **onde aparece** — provavelmente **não** um card fixo na home, mas um **aviso de movimentação** no carrossel do Amigo Sincero que faz **deep-link pro extrato**, além de surgir no check-in. _Viés a resistir: o chat já tende a "manter o buffer + só adicionar extrato" (inércia do DEC-261) — o conselho precisa testar de verdade se o buffer é a dinâmica certa, ou se um "cofrinho-troféu" mais simples basta._
**Fatos verificados (pesquisa desta sessão).** YNAB "Roll With the Punches" (Regra 3): cobrir estouro **vendo o dinheiro sair da poupança** é, segundo eles, *o* que faz o método "clicar". Rollover (FreeBudget/FinWise): cresce abaixo do ritmo, encolhe no estouro, **nunca modifica os lançamentos originais** e **recalcula pra frente** quando se edita um gasto passado; boa prática = mostrar *planejado + rollover + efetivo* lado a lado, com ícone/tooltip. Auditoria/UX: padrão **Activity Timeline** (linha do tempo record-level), começar simples.
**Fato técnico-chave.** Um **extrato fiel** (entradas/saídas dia-a-dia com cobertura parcial) **não fecha** com a fórmula atual end-clamped quando há "afunda e recupera" (ex.: dia1 estoura −50 → piso 0; dia2 poupa +80 ⇒ extrato corrente = 80, mas `max(0, −50+80)=30`). Logo o extrato **força** um **modelo de saldo corrente dia-ordenado** (replay dos lançamentos imutáveis por data, piso 0 por dia) — ainda **derivação pura** (ÂNCORA 11/12: nada mutável é gravado), só **path-dependent** (igual ao "recalcula pra frente" do rollover).

**Perspectivas (cada uma às cegas)**

- **Architect** — otimiza viabilidade/derivação pura; teme estado mutável e dupla contagem. Existem dois modelos: **(A)** o atual end-clamped (`max(0, idealToDate−spentToDate)`) — barato, mas um extrato em cima dele **não reconcilia** no "afunda-e-recupera"; **(B)** **ledger dia-ordenado** `bal_d = max(0, bal_{d-1} + idealDoDia_d − gastoDoDia_d)`, derivado por replay das transações imutáveis em ordem de data. B é a **única** base que produz um extrato verdadeiro **e** implementa o buffer do DEC-261 de forma honesta, mantendo a derivação pura (recalcula pra frente como o FreeBudget). O "livre/dia" exibido continua = `baseDailyIdeal` enquanto `bal>0` (o estouro aparece como o cofre descendo), e `calculateFreeToSpend` (total) pode ficar **byte-idêntico** — só a leitura **por-dia** e o ledger são novos. **Rec:** adotar **Modelo B** num módulo dedicado (`piggy-ledger.ts`), sem gravar saldo. **Confiança: ALTA.** _Outros perdem:_ pôr um extrato sobre o Modelo A é pior que não ter — números que não batem destroem a confiança.

- **Advocate (usuário)** — otimiza compreensão e satisfação; teme mecânica "esperta" que ninguém entende. O cofrinho hoje falha no básico: o usuário não sabe **o que é**, **por que mexeu** nem **onde ver**. Quer a narrativa do YNAB tornada visível: "você poupou nos dias 3 e 4; no dia 6 estourou no jantar, então saiu do cofrinho". Isso vira **três coisas**: (1) **frase-explicação** curta no próprio card + verbete no KB de ajuda (FB-28); (2) **extrato** ao tocar (linha do tempo de +depósitos/−saques, com os gastos que causaram o saque e cobertura parcial); (3) **aviso de movimentação** no carrossel ("seu cofrinho mexeu: −R$X hoje · saldo R$Y") com toque → extrato. **Não** fixar na home por padrão (fica volátil), mas aparecer no check-in `no_spend`/`calm` e quando houve movimento recente. **Rec:** voz + extrato + insight de movimentação; card sob demanda, não fixo. **Confiança: ALTA.** _Outros perdem:_ sem o "porquê" da movimentação, qualquer saldo parece arbitrário.

- **Critic (advogado do diabo)** — otimiza achar a falha; teme que o buffer path-dependent confunda mais do que ajuda. Riscos do Modelo B: (1) o piso diário em 0 faz um dia ótimo **não** desfazer totalmente um dia ruim anterior → "por que meu cofrinho não voltou?"; (2) editar um gasto antigo **reembaralha** o extrato (recalcula pra frente) → pode assustar; (3) é evolução do **motor** (não só UI) e mexe na sensação do "livre/dia". Se a compreensão **ainda** falhar em teste de uso, o buffer vira só barulho. **Rec:** ir de Modelo B **somente** acoplado a extrato+explicação+insight (são eles que tornam legível); manter um **fallback explícito**: se não "clicar", recuar pro **Modelo A como troféu read-only** (sem efeito no diário) + boa explicação. Invariante obrigatório: `saldo do extrato == saldo exibido == buffer que o "livre/dia" respeita` — nenhum centavo dobrado/sumido. **Confiança: MÉDIA-ALTA.** _Outros perdem:_ a feature só se paga se o usuário **entender**; legibilidade é pré-condição, não enfeite.

- **Behavioral (hábito/economia comportamental)** — otimiza formação de hábito; confia em como as pessoas leem dinheiro de verdade. Cofre que **sobe quando você se segura** e **desce visivelmente quando você fura** é exatamente o gatilho que YNAB credita como o "momento que faz clicar". A movimentação **tem que ser sentida**: um aviso no carrossel transforma um número invisível num **feedback loop** ("me segurei → cofre subiu"; "furei → vi sair"). O extrato vira **memória** ("esse dinheiro existe porque dias 3,4,7 eu evitei"). Risco comportamental: punição demais desmotiva — então o tom dos avisos segue o Amigo Sincero (não culpar; mostrar). **Rec:** tratar a **movimentação como evento de feedback** (insight no carrossel) e o extrato como **reforço positivo**, não como planilha. **Confiança: MÉDIA-ALTA.** _Outros perdem:_ o valor do cofrinho é **comportamental**, não contábil — sem o loop visível, é só um número derivado a mais.

**Red Team (matar a opção líder).** A opção líder é "Modelo B + extrato + insight". Ataque: estamos transformando um número derivado simples num **mini-motor de orçamento path-dependent** para um conceito que **o próprio dono não tinha certeza de querer** — clássico over-engineering. O piso diário em 0 é uma escolha arbitrária que produz resultados contra-intuitivos (afunda-e-recupera); o extrato expõe essa esquisitice em vez de escondê-la; e gastamos esforço **M-G** + risco de regressão no motor por uma feature de **engajamento**, não de exatidão. Mundo mais seguro: cofrinho continua **Modelo A read-only** (troféu), ganha **só** uma explicação clara + um extrato **descritivo** ("você esteve R$X abaixo do ritmo") que **não** promete mecânica de buffer — zero risco no motor, 80% da compreensão por 20% do custo.

**Síntese (Chair).**
- **Consenso:** o problema real é **legibilidade**, não o número. Cofrinho precisa de **voz** (explicação), **extrato** (de onde veio/quando saiu) e **um jeito de notar a movimentação**. Não deve ser card fixo na home.
- **Tensões:** **Modelo B (ledger buffer, honesto e path-dependent)** [Architect/Behavioral] × **Modelo A (troféu read-only, zero risco no motor)** [Critic/Red Team]. E: "buffer é o que faz clicar" (YNAB/Behavioral) × "buffer pode confundir e é over-engineering" (Critic).
- **Recomendação:** **Modelo B (ledger dia-ordenado, derivado puro) + voz + extrato + insight de movimentação no carrossel com deep-link; card sob demanda (check-in/movimento), não fixo.** A lente de maior peso aqui é a do **Architect** (só B reconcilia extrato + buffer mantendo derivação pura) reforçada pelo **Behavioral** (o buffer visível é o payoff). **Pré-condição inegociável do Critic:** `saldo extrato == saldo exibido == buffer respeitado pelo livre/dia`, com testes de invariante e de "afunda-e-recupera"; e **emenda registrada à ÂNCORA 11** (a leitura por-dia passa a refletir o buffer, embora `calculateFreeToSpend` total siga puro).
- **Condições:** módulo dedicado `piggy-ledger.ts` (sem estado mutável; replay por data; recalcula pra frente em edição); ongoing/sem-datas → esconder cofrinho (não mostrar 0); tom dos avisos = Amigo Sincero (mostrar, não culpar).
- **O que viraria o jogo (cenário da minoria vence):** se teste de uso mostrar que as pessoas **ainda** não entendem o buffer path-dependent, **recuar pro Modelo A como troféu read-only** (sem efeito no diário) + a mesma explicação/extrato descritivo. Por isso a UI do extrato deve funcionar nos **dois** modelos (só muda se há ou não efeito no "livre/dia").
- **Confiança: MÉDIA-ALTA** — direção clara; o risco está concentrado no motor (B), mitigado por módulo isolado + invariantes + fallback A. **Pendente de Julio confirmar A vs B** (ver §5.3).

---

## 3. Especificações por item (FB-01..FB-28)

> Formato: **Causa-raiz (arquivos) → Abordagem → ACs → Testes → Anti-regressão → Esforço/Risco.** Código sempre em inglês; copy de usuário em pt-BR/en/es.

### Grupo A — Sobre, Release Notes e Guia

#### FB-01 — Auditar e completar os release notes do "Sobre" (Novidades + Versões anteriores)
- **Causa-raiz.** `RELEASE_NOTES` (`release-notes.ts`) está no v0.99.39, mas há entregas importantes sem destaque adequado e o cabeçalho do `brain/README.md` está defasado (cita v0.99.14). O usuário percebe "coisas novas que não entraram". A AboutPage já mostra atual + anteriores corretamente.
- **Abordagem.** Fazer uma **auditoria DEC↔release-note** (DEC-240..255 vs entradas existentes) e **adicionar/ajustar** entradas de usuário (3 idiomas) para o que ficou de fora ou sem clareza. Candidatos a revisar/garantir cobertura: **multi-viagem/Spaces (DEC-249)**, **modo Dia a dia (DEC-250)**, **AI Quick Entry texto+voz (DEC-246)**, **Trip Wrapped (DEC-247)**, **Dividir conta + mesa ao vivo**, **Acerto de contas/Conexões (DEC-241/244)**, **novo ícone (DEC-255)**, **identidade no onboarding (DEC-252)**. Atualizar o `> Last updated` do `brain/README.md`.
- **ACs.** (1) Toda DEC com impacto de usuário desde a última coberta tem ≥1 item de release note nos 3 idiomas. (2) `findReleaseNote(APP_VERSION)` retorna a versão atual com a lista nova. (3) Nenhuma entrada cita valores/conteúdo de gasto. (4) README brain `Last updated` corrigido.
- **Testes.** Unit: `release-notes` continua ordenado desc e cada `ReleaseNote.items` tem as 3 chaves de idioma não-vazias (estender o teste existente, se houver). Visual: AboutPage rola Novidades + expande Anteriores.
- **Anti-regressão.** Apenas **adicionar** entradas/itens; não reescrever histórico publicado. Manter ordem desc.
- **Esforço/Risco.** **P** / baixo.

#### FB-02 — Atualizar o guia "Tudo o que dá para fazer" (catálogo defasado)
- **Causa-raiz.** `GUIDE_SECTIONS` (`guide-catalog.ts`) não inclui features recentes: AI Quick Entry, Dividir conta, Escanear nota, Spaces/multi-viagem, modo Dia a dia, Acerto de contas (cobrar/lembrar/conexões), Wise import, calculadora de câmbio (FB-04). Um teste garante que rotas existem no router.
- **Abordagem.** Adicionar entradas (com `titleKey/descKey/route/icon`) para cada capacidade nova, em seções coerentes (ex.: "Lançar com IA", "Dividir conta", "Pessoas e dívidas → Conexões", "Suas viagens / Dia a dia", "Câmbio"). Cada rota precisa existir (o teste guarda isso).
- **ACs.** (1) Toda rota de feature de 1ª classe aparece no guia. (2) i18n nas 3 línguas. (3) Teste de rotas passa.
- **Testes.** Unit existente de "todas as rotas do guia existem no router" continua verde com as novas entradas.
- **Anti-regressão.** Só adicionar/realocar entradas; não remover as atuais.
- **Esforço/Risco.** **P** / baixo.

### Grupo B — Captura e entrada de gastos

#### FB-09 — Costura das superfícies de entrada (ver C2) — ✅ RATIFICADO
- Implementar as 3 costuras do C2: **foto no AssistantSheet** (gate `cloudReceiptOcrEnabled`), chip "✨ IA" no `/quick-add`, rótulos do FAB clareados. **Sem** wizard único "como quer registrar?" (decisão do Julio).
- **Toda entrada de imagem usa o chooser CC-IMG** (tirar foto / galeria) — ver **CC-IMG**.
- A foto-na-IA vira **1 gasto resumido** por padrão, com "abrir itens" opcional (ratificado, ver FB-10). **Esforço M / risco médio.**

#### CC-IMG — Chooser "tirar foto / galeria" em TODA entrada de imagem (item transversal, novo)
- **Causa-raiz.** O padrão "duas opções ao clicar" (tirar foto agora vs escolher da galeria) **já existe e está validado** no `AttachmentSection.tsx` (DEC-206), mas outras superfícies de imagem (recibo/`ReceiptScanPage`, e a nova foto-na-IA do FB-09) podem ir direto pra câmera ou direto pra galeria, sem o chooser. Julio: "todo lugar de entrada de imagem, tem que ter duas opções quando clica, enviar imagem ou capturar com a câmera."
- **Abordagem.** **Extrair** o chooser do `AttachmentSection` para um componente/utilitário reutilizável (ex.: `components/ImageSourceChooser.tsx` ou um hook `usePickImage()` que abre o `BottomSheet` com as duas opções e devolve o `File`). Os dois `<input>` ocultos: câmera (`capture="environment"`) e galeria (sem `capture`). Aplicar em: recibo/Dividir conta, foto-na-IA (FB-09), e qualquer outra entrada futura. `AttachmentSection` migra para o componente extraído (sem mudar comportamento).
- **ACs.** (1) Em **toda** entrada de imagem, o clique abre o chooser com "Tirar foto" e "Escolher da galeria". (2) Câmera abre direto (capture) e galeria abre o seletor. (3) Funciona web/iOS Safari/WebView nativo (mantém o gesto do usuário síncrono → permissão de câmera preservada). (4) `AttachmentSection` mantém o comportamento atual.
- **Testes.** Render do chooser; clique em cada opção dispara o input certo. E2E onde possível (web).
- **Anti-regressão.** Reusar o padrão DEC-206 **exatamente**; não introduzir um 2º padrão. Preservar o gesto síncrono (clicar no input dentro do handler) — crítico para a permissão de câmera no iOS.
- **Esforço/Risco.** **P-M** / baixo (extração + aplicar em 1-2 telas).

#### FB-10 — Paridade de campos na nota lida por IA (categoria, local, data/hora) + UI colapsada pré-preenchida — ✅ RATIFICADO (foto→1 gasto resumido)
- **Causa-raiz.** `commitReceipt` cria transações com `category` (guessCategory) mas **sem `location`** e com **data de criação** (não a do recibo); o parse extrai `merchant`/`placeLabel` mas não vira local real nem categoria refinada por IA. No histórico, faltam infos que o registro padrão tem.
- **Decisão do Julio (v2):** a **foto dentro da IA** (FB-09) vira **1 gasto resumido** por padrão (merchant→categoria/local/data), com opção "abrir itens" para o fluxo detalhado de recibo. O fluxo "Dividir conta" (mesa/itens) segue gerando N itens como hoje.
- **Abordagem.**
  1. **Extrair mais no OCR** (`worker /ocr` + `parseReceiptResponse`): pedir ao modelo `date`, `merchantAddress/place`, e uma **categoria por item dentro das nossas categorias** (`EXPENSE_CATEGORY_KEYS`). `parse.ts` passa a popular `purchaseDate`, `placeLabel` e `category` mapeada às nossas categorias (fallback `guessCategory`).
  2. **Local real:** usar `placeLabel`/merchant para sugerir local (reusar `searchNearbyPlaces`/`reverseGeocodePlace`/`PlaceField`) — pré-preencher e permitir o usuário buscar/ajustar (gate `locationCaptureEnabled`).
  3. **commitReceipt** passa a setar nas transações: `category` (refinada), `placeLabel/place fields` (via `placeToTransactionFields`), e a **data do recibo** quando lida.
  4. **UI colapsada pré-preenchida:** na revisão do recibo, um bloco "Detalhes (IA preencheu)" colapsado com categoria/local/data editáveis (mesma máquina do `ExpenseEditor`/`PlaceField`).
- **ACs.** (1) Gasto vindo de nota carrega categoria, local (se location on) e data/hora do recibo quando disponíveis. (2) No histórico ("Todos"), um gasto de nota mostra as mesmas infos de um manual. (3) Usuário pode editar categoria/local/data antes de salvar. (4) Sem recibo legível, degrada para os defaults atuais (nada quebra).
- **Testes.** Unit: `parseReceiptResponse` mapeia categoria por item e `purchaseDate`; `commitReceipt` grava `category/place/date` corretos (com e sem location). Garantir que itens sem dados caem nos defaults.
- **Anti-regressão.** `commitReceipt` continua **1 sessão + N itens** transacional; `excludeFromLearning` mantido. Não mudar a matemática de split (`resolvePayerExpense`).
- **Esforço/Risco.** **M-G** / médio (toca worker prompt + parse + commit + UI). Recomendo gate próprio.

#### FB-06 / FB-24 — Participantes inline (ver C4)
- Extrair `AddParticipantSheet` reutilizável; montar no `QuickAddPage`, recibo e AssistantSheet; trocar `no_participants_hint` por botão "+ Adicionar quem participou". **Esforço M / risco médio.**

### Grupo C — Home / Dashboard

#### FB-07 — FAB deve fechar com o botão "voltar" do Android
- **Causa-raiz.** `FABMenu` (`FAB.tsx`) é um overlay próprio que **não** se registra em `overlay-dismiss`; `initBackButton` (nativo) só fecha quem registrou; web não trata overlay no popstate.
- **Abordagem.** No componente dono do `FABMenu` (provavelmente `BottomNav`/`AppShell`), registrar `onClose` em `registerOverlayDismiss` enquanto aberto (mesmo padrão do `BottomSheet`: `useEffect` com `registerOverlayDismiss(onClose)` + cleanup). Para web/PWA: como o BottomSheet hoje fecha no Escape mas o back web não chama `dismissTopOverlay`, avaliar (a) usar a mesma estratégia para todos os overlays e ligar `dismissTopOverlay` no `popstate` do `RootLayout` antes de re-semear, OU (b) tratar só o nativo agora (onde dói) e abrir item separado para o web. Recomendo (a) leve: no `popstate` da home, se `dismissTopOverlay()` fechou algo, não navega.
- **ACs.** (1) Nativo: FAB aberto + back → fecha o FAB (não navega/sai). (2) Web/PWA: back com FAB aberto fecha o FAB. (3) Sem FAB aberto, back segue normal.
- **Testes.** Unit: registrar/desregistrar no overlay-dismiss. E2E: abrir FAB → back → FAB fechado, rota intacta.
- **Anti-regressão.** Não mudar a animação de saída do FAB (`useAnimatedPresence`). Garantir cleanup ao fechar para não deixar dismisser órfão.
- **Esforço/Risco.** **P** / baixo (nativo) · baixo-médio (web popstate).

#### FB-08 — Cofrinho: invisível, sem voz e sem extrato → compreensão + ledger + onde aparece (ver C13 **e C14**)
- **Causa-raiz (dupla).** **(a) Invisibilidade:** o card `piggy_bank` só renderiza quando `model.piggyBankCents > 0` (`DashboardCards.tsx` l.588/1350/1401), e `calculatePiggyBank = max(0, idealToDate − spentToDate)` (`motivation.ts`) só é >0 abaixo do ritmo linear; no/acima do ritmo, ou ongoing/sem datas (`totalDays<=0`), fica 0 → `focusAvailable=false` → a lente `no_spend`/`calm` não tem o que mostrar. **(b) Caixa-preta:** mesmo quando aparece, é **um número sem voz e sem extrato** — o usuário (e o próprio Julio) não sabe **o que é**, **de onde veio** nem **por que mexeu**. **Não é bug de render — é falta de legibilidade + o número estar matematicamente zero.**
- **✅ Decisão (C13 buffer + C14 legibilidade · Modelo B RATIFICADO pelo Julio — §5.3).** O cofrinho deixa de ser troféu volátil e ganha **3 camadas**: **voz** (explica o que é), **extrato** (de onde veio/quando saiu) e **aviso de movimentação** (insight no carrossel com deep-link). Mecânica = **buffer** do C13 (estourou o dia → debita o cofrinho antes de cortar os próximos dias). O **modelo de cálculo é o B (ledger dia-ordenado)** — o único que torna o **extrato fiel** e o buffer honestos ao mesmo tempo. (Fallback pro Modelo A fica só como rede de segurança documentada.)
- **Abordagem (motor + UI — modelo matemático no C13/C14).**
  1. **Ledger derivado (`src/domain/budget/piggy-ledger.ts`, novo):** `buildPiggyLedger(dailyIdealCents, spentByDay[])` → série dia-a-dia `bal_d = max(0, bal_{d-1} + idealDoDia − gastoDoDia)`, **replay das transações imutáveis por data** (sem estado mutável; recalcula pra frente em edição, como o rollover do FreeBudget). Retorna `entries[]` (data, delta, saldo, gastos que causaram o saque) + `balanceCents`. **`balanceCents` substitui o `piggyBankCents` exibido.**
  2. **Livre/dia buffer-aware:** enquanto `balance > 0`, o livre/dia exibido permanece em `baseDailyIdeal` (o estouro aparece como o **cofre descendo**); quando `balance = 0` e segue acima do ritmo, o diário volta a `(phaseBudget − spentToDate)/daysRemaining`. `calculateFreeToSpend` **total** continua byte-idêntico (ÂNCORA 11) — muda só a **leitura por-dia** + o ledger.
  3. **Voz (compreensão):** frase curta no card ("Cofrinho: o que você deixou de gastar fica aqui e cobre os dias que você furar") + verbete completo no **KB de ajuda (FB-28)** com deep-link. Card mostra **efetivo = base + cofrinho** lado a lado (boa prática de rollover).
  4. **Extrato (ao tocar o card/insight):** linha do tempo (Activity Timeline) de **+depósitos** ("dia 3 você ficou R$X abaixo → +R$X") e **−saques** ("dia 6 você estourou R$W no Jantar → −R$W", com link aos gastos), incluindo **cobertura parcial** ("R$K pago do cofrinho"). Saldo corrente em cada linha.
  5. **Aviso de movimentação:** novo extra `piggy_movement` em `honest-friend-extras.ts` — só quando houve movimento desde a última visualização: "Seu cofrinho mexeu: −R$X hoje (estouro em Jantar) · saldo R$Y" (tom Amigo Sincero, mostrar-não-culpar). **Toque → deep-link pro extrato.**
  6. **Onde aparece (não fixo):** **não** é card fixo na home (Julio); surge no check-in `no_spend`/`calm` (subindo) e quando há movimento recente; usuário pode **fixar** via `toggleDashboardCardPinned` (já existe).
  7. **Bordas:** `totalDays<=0` / ongoing → **esconder** o conceito (não mostrar 0 nem extrato vazio).
- **ACs.** (1) Estourar um dia **debita o cofrinho** e **não** corta o diário enquanto `balance>0`. (2) `balance=0` + acima do ritmo → o diário cai. (3) Check-in "não vou gastar" mostra o cofrinho subindo (nunca tela vazia). (4) **Invariante:** `saldo do extrato == saldo exibido == buffer respeitado pelo livre/dia` (nenhum centavo dobrado/sumido). (5) Tocar o card/insight abre o **extrato** com entradas/saídas e os gastos que causaram cada saque. (6) Houve movimento → aparece **um** insight `piggy_movement` com deep-link. (7) Editar um gasto passado **recalcula o ledger pra frente**. (8) Ongoing/sem-datas: cofrinho oculto. (9) Existe a **frase-explicação** + verbete no KB (3 idiomas).
- **Testes (reforçados).** Unit `piggy-ledger`: under-pace (saldo cresce); 1 dia estourado coberto (diário **não** cai); **afunda-e-recupera** (dia1 −50 piso 0; dia2 +80 ⇒ saldo 80, conferindo o caráter path-dependent vs end-clamped); cofrinho esgotado → diário cai certo; edição de gasto passado recalcula; `totalDays 0`/ongoing → vazio/oculto; **invariante** saldo-extrato == saldo-exibido. `honest-friend-extras`: `piggy_movement` só com movimento; tom correto. Render: lente `no_spend` mostra o cofre; extrato lista entradas/saídas/cobertura parcial.
- **Anti-regressão.** Derivação **read-only** (sem saldo mutável; replay puro). **Emenda registrada à ÂNCORA 11** (leitura por-dia reflete o buffer; `calculateFreeToSpend` total intacto). **Fallback do C14:** a UI do extrato deve funcionar também no **Modelo A read-only** (troféu) caso Julio recue do buffer — só muda se há ou não efeito no "livre/dia". Validar que o orçamento total da fase não muda.
- **Esforço/Risco.** **G** / **médio-alto** (ledger novo + leitura por-dia + extrato + insight). **Mini-spec/council de matemática obrigatório ao implementar; gate com testes de invariante antes da UI.**

#### FB-13 — "Veja mais no copiloto" com margem inferior excessiva
- **Causa-raiz.** Espaçamento do bloco/barra de insights→copiloto (`DashboardCards.tsx`, ~l.238 e a barra que usa `dashboard.insights_more_copilot`).
- **Abordagem.** Ajustar a classe de espaçamento inferior da barra (provável `mb-*`/`pb-*` herdado do container). Conferir no design system o espaçamento padrão entre cards.
- **ACs.** (1) Espaçamento abaixo do texto consistente com os demais cards. (2) Sem regressão de toque/área clicável.
- **Testes.** Visual (Playwright) da home com o bloco de insights.
- **Anti-regressão.** Não mexer no roteamento da barra (`/copiloto`) nem no E2E `home-insights-cap.spec.ts`.
- **Esforço/Risco.** **P** / baixo (CSS).

#### FB-14 — Itens de nota aparecem como N "Outros" no carrossel da home
- **Causa-raiz.** `commitReceipt` cria N transações (uma por item); em `occasion-counters.ts` (l.84-89) os **activity counters** (categoria sem plano) usam `itemCount: txs.length` → uma nota de 40 itens em "Outros" vira "Outros · 40". **Precedente que já temos:** os **planned counters** já contam "uma sessão conta uma vez" (DEC-115, comentário l.8-9 do arquivo) — os activity counters simplesmente não herdaram essa regra. O usuário quer **contar o evento (a nota) como 1**, não cada item.
- **Abordagem.** No `buildOccasionCounters` (ou na seleção das transações que alimentam os contadores de atividade), **agrupar transações de uma mesma sessão de recibo como 1 ocasião**. As transações de recibo têm `sessionId` e `externalRef` `receipt:<sessionId>:<i>`. Opções: (a) contar **sessões distintas** (recibo/saída) em vez de itens individuais para categorias de atividade; (b) representar a nota como **1 contador "compra/nota"** em vez de inflar a categoria. Recomendo: contadores de atividade contam **transações avulsas + sessões (1 cada)**, não itens dentro de sessão.
- **ACs.** (1) Uma nota com 40 itens conta como **1** no carrossel (não 40). (2) Gastos avulsos seguem contando 1 cada. (3) Saídas (sessões de bar) também contam como ocasião única (consistência). (4) Totais financeiros inalterados (só a contagem do carrossel muda).
- **Testes.** Unit `occasion-counters`: dataset com 1 sessão de recibo (N itens) + M avulsos → contador correto (1 + por categoria dos avulsos). Garantir que planejadas (metas) não são afetadas.
- **Anti-regressão.** Não mudar agregações financeiras nem `groupTransactionsByCategory` para outros usos. Mudança restrita ao builder do carrossel (ÂNCORA 9: só geometria/contagem do card).
- **Esforço/Risco.** **M** / médio (precisa olhar como as transações de sessão chegam ao builder).

### Grupo D — Saída / Outing

#### FB-15 — "Iniciar saída" sem margens + repensar fluxo (ver C3)
- Corrigir o wrapper de padding (alinhar ao container padrão); enxugar o setup por contexto. **Esforço M / risco médio.**

#### FB-16 — Configurar saída pergunta itens irrelevantes (ex.: preço médio da bebida no "mercado")
- **Causa-raiz.** O setup pergunta `avgDrinkPrice`/limites de bar para qualquer `EventContext`.
- **Abordagem.** Tornar as perguntas **data-driven por `EventContext`** (mostrar preço médio de bebida só p/ bar/noite; mercado pede outras coisas ou nada além do essencial). `deriveSessionLimits` cobre defaults; só perguntar o que o contexto usa.
- **ACs.** (1) "Mercado" não pergunta preço de bebida. (2) Cada contexto pergunta só o relevante. (3) Gauge/alertas funcionam quando `avgDrinkPriceCents` é null fora de bar.
- **Testes.** Unit: perguntas por contexto; leituras null-safe de `avgDrinkPriceCents`.
- **Anti-regressão.** Auditar todos os usos de `avgDrinkPriceCents` (gauge, próxima rodada). Não quebrar saída de bar.
- **Esforço/Risco.** **M** / médio.

#### FB-23 — Finalizar uma saída sem necessariamente salvar (descartar)
- **Causa-raiz.** O usuário quer poder **encerrar e descartar** uma saída (ex.: começou errado), não só finalizar salvando.
- **Abordagem.** Na sessão ativa, ação "Finalizar e descartar" que faz `softDelete` da sessão + itens (reusar o padrão de `undoReceiptCommit`/`softDeleteSessionExpense`), com confirmação. Distinta de "Finalizar" (salva no histórico).
- **ACs.** (1) Posso descartar a saída ativa com confirmação. (2) Descartar remove a sessão e seus gastos (soft-delete) e volta à home. (3) "Finalizar" normal segue salvando.
- **Testes.** Unit/orquestrador: descartar soft-deleta sessão+itens+shares; budget volta ao estado anterior. E2E: iniciar → descartar → nada no histórico.
- **Anti-regressão.** Soft-delete (não hard) para manter sync/undo consistentes.
- **Esforço/Risco.** **P-M** / baixo-médio.

### Grupo E — Configurações e defaults

#### FB-03 — Localização ligada por padrão (ver C5(a)) — ✅ RATIFICADO
- `locationCaptureEnabled` default → true + 1ª-execução transparente ("Registro de local: Ligado — você desliga quando quiser") + **emenda à ÂNCORA 8 registrada como DEC-265** + **sem** leitura de GPS sem permissão do SO. **Esforço P-M / risco médio (privacidade — mitigado pela transparência).**
- **ACs.** (1) Instalação nova já vem com a feature de local ligada. (2) GPS só é lido após permissão do SO. (3) Aviso de 1ª execução visível + opt-out 1-toque nas Configurações. (4) Backup/restore não força o default sobre uma escolha prévia do usuário.
- **Anti-regressão.** Mudar só o **default** de seed; usuários existentes mantêm a escolha atual. Telemetria `usesLocation` continua sem coordenadas.

#### FB-05 — Nome de dispositivo automático quando vazio (ver C5(b))
- `suggestDeviceName()` (plataforma + navegador) como placeholder e valor efetivo quando em branco; nunca sobrescreve nome digitado/backup. **Esforço P / baixo.**

#### FB-11 — Excluir evento de onde ele é criado (hoje escondido) — decisão do Julio: PERGUNTAR sobre os gastos
- **Causa-raiz.** Criar evento é acessível de vários lugares; excluir só num lugar específico e escondido.
- **Decisão do Julio (v2).** Ao excluir um evento, **os gastos do evento vão junto** — MAS **perguntar ao usuário na hora da exclusão**: "Apagar também os N gastos deste evento?" → opções **"Apagar tudo"** (evento + gastos) vs **"Manter os gastos"** (desvincula e mantém no histórico). Não decidir silenciosamente.
- **Abordagem.** Adicionar ação "Excluir evento" na **tela de edição do evento** (`/trip/edit?occurrence=`) com confirmação que **conta os gastos vinculados** e oferece as duas opções. "Apagar tudo" soft-deleta a occurrence + as transações vinculadas; "Manter os gastos" soft-deleta só a occurrence e desvincula as transações (limpa o vínculo de evento). Garantir paridade entre os pontos de criação.
- **ACs.** (1) Da edição do evento dá para excluí-lo com confirmação. (2) A confirmação informa **quantos** gastos estão vinculados e pergunta se apaga junto ou mantém. (3) "Apagar tudo" remove evento + gastos (soft-delete); "Manter" desvincula e mantém os gastos. (4) Disponível de todos os pontos onde se edita o evento.
- **Testes.** Unit: soft-delete da occurrence com e sem cascata nos gastos; desvínculo correto na opção "Manter". E2E: criar → editar → excluir (cada opção).
- **Anti-regressão.** Soft-delete (não hard) p/ sync/undo. Garantir que "Manter" não deixa gastos apontando para occurrence inexistente (limpar o campo de vínculo).
- **Esforço/Risco.** **M** / médio (duas semânticas de exclusão + contagem).

### Grupo F — Admin

#### FB-17 — Detalhe do usuário: tokens **por função** + nº de vezes por função
- **Causa-raiz.** `InstallModal` mostra tokens **totais** + chamadas; `AiUsageSection` tem `byFn` só global. Falta o breakdown por função **por usuário**.
- **Abordagem.** Estender o endpoint de install (ou novo `/admin/install-detail?id=`) para retornar `byFn` daquele install (`SELECT fn, SUM(tokens), SUM(runs) FROM ai_usage WHERE install_id=? GROUP BY fn`); UI no modal mostra Assistente/Nota/Transcrição com tokens + chamadas.
- **ACs.** (1) Modal do usuário mostra tokens e chamadas **por função**. (2) Soma bate com o total já exibido.
- **Testes.** Worker: query por install agrupada por fn. UI: render do breakdown.
- **Anti-regressão.** Reusar `ai_usage`; não alterar ingest.
- **Esforço/Risco.** **P-M** / baixo.

#### FB-18 — Governança Groq: uso por min/dia/mês, % do limite, projeções (ver C8) — server-side em tempo real
- Capturar headers `x-ratelimit-*` no Worker (cota real) + rollups dia/mês + projeção com gargalo destacado. **Esforço M / médio.** Verificado pelos docs do Groq.
- **Observação do Julio (v2) — confirmada.** A contabilização é **100% server-side e em tempo real**: o Worker é o **proxy único** de toda chamada Groq (assistant/ocr/transcribe), então ele já vê `usage.total_tokens` e os headers `x-ratelimit-*` **na hora** — **não dependemos** do heartbeat do cliente para saber consumo. Isso permite:
  1. **TPM/RPM/RPD reais agora** (lidos dos headers da última resposta por modelo/função), não estimados.
  2. **Rollup por minuto** verdadeiro carimbando o timestamp no momento da chamada no Worker (não precisa do cliente).
  3. O heartbeat do cliente continua útil só para **DAU/ativos** (denominador da projeção "quantos usuários cabem"), não para contar token.
- **Anti-regressão.** `recordAiUsage` continua a fonte; adicionar o snapshot de headers e o rollup-minuto **sem** alterar o agregado diário existente (DEC-251).

#### FB-19 — Usuário "00000000" nos maiores consumidores de IA
- **Causa-raiz.** O cliente real nunca emite UUID all-zeros (`getInstallationId` = uuidv4). O all-zeros **não existe** no código nem nos e2e (os specs usam `0000…4000-8000…`, um v4 válido, como id de **link**, não install). Em produção, origem provável = **probe de deploy / scanner / cliente externo** mandando `X-Install-Id` placeholder, e a validação atual aceita all-zeros (passa no formato UUID).
- **Decisão do Julio (v2): INVESTIGAR e NOMEAR antes de só apagar.** Julio: "isso pode fazer com que esteja tendo gasto e a gente não saiba de onde; temos que descobrir o que é o 00000000, nomear e entender por que está gastando, para ter noção." → Não basta dropar; precisamos **entender a origem do consumo** (é gasto real de token que sumiria da nossa contabilidade).
- **Abordagem (em 2 fases).**
  1. **Investigar (antes de bloquear):** instrumentar o Worker para, quando chegar `X-Install-Id` all-zeros, **logar** o contexto (User-Agent, IP/ASN se disponível, função chamada, horário, versão do app no header) num bucket separado "Sistema/desconhecido" — para **descobrir** se é probe de deploy/uptime, scanner, ou um cliente antigo/bug. Mostrar esse bucket rotulado no Admin (não no ranking de usuários).
  2. **Depois de identificado:** se for **probe nosso** → dar a ele um id "system" claramente rotulado e **excluir** das métricas de usuário; se for **abuso/scanner externo** → **rejeitar** o sentinel `00000000-0000-0000-0000-000000000000` em `recordAiUsage`/ingest (não gravar) e contabilizar à parte como "rejeitado".
  3. **Limpeza retroativa:** depois de entender, **sim** limpar/realocar o histórico do all-zeros do ranking (Julio aprovou), preservando o total em "Sistema/desconhecido" para não "sumir gasto".
- **ACs.** (1) O consumo do all-zeros aparece **rotulado e isolado** ("Sistema/desconhecido") com contexto suficiente para identificar a origem. (2) Após identificado, deixa de poluir o ranking de usuários. (3) Nenhum token consumido "desaparece" da contabilidade (vai pro bucket Sistema). (4) Origem documentada (probe/scanner/bug).
- **Testes.** Worker: all-zeros é roteado ao bucket Sistema (não ao ranking de usuários); após regra final, ingest rejeita/realoca conforme decidido.
- **Anti-regressão.** Não apagar dados antes de entender a origem (Fase 1 só observa). A rejeição (Fase 2) não pode afetar ids válidos.
- **Esforço/Risco.** **P-M** / baixo.

#### FB-20 — Plataformas: Android web × iOS web × Android PWA × Android nativo
- **Causa-raiz.** `webPlatformTag` distingue ios-web/android-web/web; nativo vem do Capacitor; **PWA (standalone) não é distinguido** de aba.
- **Abordagem.** Refinar a tag enviada à telemetria usando `isStandaloneDisplayMode()`: `android-pwa`/`ios-pwa` quando standalone; `android-web`/`ios-web` em aba; nativo segue `android`/`ios`. Atualizar labels no Admin (`Distribution "Plataformas"`).
- **ACs.** (1) Admin distingue as 4+ categorias (incl. desktop `web`). (2) Instalações existentes re-classificam no próximo heartbeat.
- **Testes.** Unit `platform`: matriz UA × standalone → tag correta (estender `platform.test.ts`).
- **Anti-regressão.** Manter compatibilidade com tags antigas no agregador (não quebrar histórico — agregar por chave).
- **Esforço/Risco.** **P** / baixo.

#### FB-21 — Erros por usuário + info de aparelho/navegador no detalhe (ver C7)
- Endpoint de erros por install + enriquecer telemetria com navegador (família) + PWA; UI no modal. Granularidade grossa (privacidade). **Esforço M / médio.**

#### FB-22 — Modal do usuário centralizado no viewport + melhor layout no PC
- **Causa-raiz.** `InstallModal` usa `items-end sm:items-center` → no mobile abre colado embaixo (parece posição fixa); desktop pouco aproveitado.
- **Abordagem.** Centralizar no viewport em todos os tamanhos (`items-center`, `max-w` adequado, scroll interno) e, no desktop (`sm:`/`lg:`), distribuir em **2 colunas** (counters/flags numa, tokens/erros/plataforma noutra).
- **ACs.** (1) Modal centralizado vertical/horizontal no mobile e desktop. (2) No PC, layout em colunas legível. (3) Scroll interno quando excede a altura.
- **Testes.** Visual (Playwright) mobile + desktop do modal.
- **Anti-regressão.** Não alterar dados exibidos (só layout). Manter `aria-modal`.
- **Esforço/Risco.** **P** / baixo (CSS/layout).

### Grupo G — Outros

#### FB-04 — Calculadora de conversão de moeda (ver C1) — ✅ RATIFICADO (tela + intent de IA)
- `domain/money/converter.ts` puro + `ConverterPage` (`/converter`) + entradas no FAB e Copiloto/Guia + selo de idade da cotação + taxa manual + reuso de `fetchExchangeRates`/`frozenRates`.
- **No V1 também o intent de IA** "quanto é X em Y?": o roteador do AssistantSheet ganha uma intent de **conversão informativa** que **não cria gasto**; a IA só extrai `{amount, from, to}` e o **app faz a conta localmente** com as taxas em cache (barato, offline-friendly, sem queimar token à toa).
- **"No Brasil ~R$Y": PARADO (C12)** — não construir; Groq não pesquisa preço real.
- **ACs.** (1) `/converter` converte com cotação carimbada + ⇄ + taxa manual. (2) Perguntar "quanto é 20 euros em reais?" na IA responde o valor (conta local), sem criar transação. (3) Offline usa `frozenRates` com selo de idade.
- **Testes.** Unit `converter.ts` (direção, manual, offline); intent: extrai {amount,from,to} e a conta bate.
- **Anti-regressão.** Não alterar `convertToBaseCents`/orçamento; o conversor é leitura pura das taxas.
- **Esforço/Risco.** **M** (tela) + **P** (intent) / médio.

#### FB-12 — Banco de frases do Amigo Sincero (ver C6) — ✅ + vozes selecionáveis + reveal no fim do carrossel
- `honest-friend-voice.ts` (faixas → chaves i18n) + 4–6 frases/faixa × 3 idiomas, com tom correto a 100%/reserva.
- **Decisão do Julio (v2, lista final ratificada):** adicionar no **Settings** a escolha de "tom" do Amigo Sincero — exatamente **4 vozes: `padrao` / `zen` / `durao` / `economico`** (default = `padrao`). O banco de frases passa a ser indexado por **faixa × voz**.
- **Decisão do Julio (v2) — descoberta no fim do carrossel:** quando o usuário chega ao **fim real** do carrossel do Amigo Sincero (última bolinha), **não** mostrar mais bolinhas; se ele **puxar um pouco além** (overscroll com o dedo), revelar um cartão "Quer mudar o tom? Escolha nas Configurações →" que **leva ao Settings**. **A rotação automática NUNCA chega nesse cartão** (só aparece por gesto explícito de puxar além do fim) — é um easter-egg de descoberta, não polui a rotação.
- **Abordagem.** (1) `honest-friend-voice.ts`: `pickPhraseKey(band, voice, seedDay)`; i18n `amigo_phase_band_<band>_<voice>_<n>`. (2) Settings: seletor de voz persistido em `AppSettings`. (3) Carrossel: detectar overscroll no fim (sem adicionar à contagem de dots/rotação) → render do cartão de descoberta com deep-link p/ Settings. (4) Insight ocasional dentro do próprio Amigo Sincero mencionando que dá pra trocar o tom (texto leve, não intrusivo).
- **ACs.** (1) Frases variam por faixa e respeitam o número (nunca "segura" a 100%+). (2) Trocar a voz no Settings muda o tom das frases. (3) No fim do carrossel, puxar além revela o cartão de tom→Settings; a rotação automática não o mostra. (4) Clicar no cartão abre o Settings na seção do Amigo Sincero.
- **Testes.** Unit: `pickPhraseKey` por faixa×voz, sem contradizer o número; overscroll-reveal não entra na contagem de dots (lógica isolada testável).
- **Anti-regressão.** Manter o veredicto V2 (`honest-friend.ts`) intacto; só os **extras**/voz mudam. Não alterar a rotação automática existente além do reveal por gesto.
- **Esforço/Risco.** **M** / médio (texto + voz no settings + gesto de overscroll).

#### FB-25 — Planejador no Dia a dia: abrir não pode criar planos / ficar negativo (ver C9)
- **Causa-raiz (relatada pelo Julio, v2).** **Abrir** o planejador **já adiciona planos** por padrão e o saldo **fica negativo** no modo Dia a dia (sem datas/receita). Abrir uma tela está causando **escrita** de dados (efeito colateral) + assume datas/fases que não existem no `ongoing`.
- **Abordagem.** (1) **Abrir o planejador = zero gravação.** Separar "sugestão exibida" (efêmera) de "plano salvo" (só por ação explícita). (2) Guardar superfícies de planejamento/pré-preenchimento atrás do mapa de capacidades por `kind` (centralizar `capabilitiesFor(kind)`), sem pré-preencher por fase no `ongoing`. (3) Sem configuração, mostrar **estado vazio** ("configure receita/limite") em vez de número **negativo**.
- **ACs.** (1) Abrir o planejador no Dia a dia **não cria** nenhum plano e **não** persiste nada. (2) Nenhum valor fica negativo por falta de config — mostra estado vazio orientando o usuário. (3) Superfícies dependentes de data ficam ocultas no `ongoing`. (4) Modo viagem com datas segue funcionando igual.
- **Testes.** Unit/render: abrir planejador `ongoing` → 0 escritas (mock do repo não recebe writes), sem negativo. Smoke: criar espaço `ongoing`, abrir cada tela de planejamento sem crash.
- **Anti-regressão.** Não mudar o planejador do modo viagem (com datas). A correção do efeito colateral de abertura vale para ambos os modos (abrir nunca grava).
- **Esforço/Risco.** **M** / médio.

#### FB-26 — Degradação graciosa quando o free tier do Groq estoura (ver C10) — NOVO
- **Causa-raiz.** Quando o Groq retorna 429 (RPM/TPM/RPD), as funções de IA param com erro genérico; o usuário não sabe se quebrou nem quando volta.
- **Abordagem.** (1) **Worker:** ao pegar 429 (ou `x-ratelimit-remaining-*` ~0), responder corpo estruturado `{ aiUnavailable: true, retryAfterSec, scope: 'minute'|'day' }` derivado de `retry-after`/`x-ratelimit-reset-*`, para assistant/ocr/transcribe. (2) **Cliente:** `aiCooldownUntil` desabilita gatilhos de IA e mostra banner/sheet: `scope:'minute'` → countdown "tente em ~{n}s"; `scope:'day'` → "indisponível agora, volta mais tarde". Sempre com botão **"Registrar manualmente"** que abre `/quick-add` **preservando o texto/áudio já digitado**. (3) Mensagem **honesta mas sem billing** ("alta demanda de IA"). (4) Registrar no Admin a contagem de 429 (sinal p/ FB-18/upgrade).
- **ACs.** (1) Ao estourar, o usuário vê tempo **real** (do header) e/ou aviso "volta mais tarde", nunca um erro cru. (2) O caminho manual fica a 1 toque e **não perde** o input. (3) Os 3 endpoints de IA cobertos. (4) Sem countdown falso (usa o valor real; se não houver, fallback genérico).
- **Testes.** Worker: 429 com `retry-after` → payload correto (minute/day). Cliente: cooldown desabilita botões e libera ao fim; fallback manual preserva texto.
- **Anti-regressão.** Não bloquear o registro manual quando a IA cai. Não alterar o caminho feliz da IA.
- **Esforço/Risco.** **M** / médio.

#### FB-27 — Registrar reembolso recebido (Pix/Wise/dinheiro/transferência) no split — NOVO
- **Causa-raiz (cenário do Julio).** Eu pago a conta toda no meu cartão; os outros me devem e me **pagam de volta** via Pix/Wise/dinheiro/transferência. Hoje listamos **como** me pagar (DEC-244, `payment-methods`) e temos `Settlement` (debtor→creditor), mas falta uma **entrada de UI clara** para registrar "**recebi** o reembolso de fulano".
- **Decisão do Julio (rodada final): campo ESTRUTURADO** (não texto livre) — "ajuda a ir utilizando a função". Requisito: **cadastro acessível sem quebra de fluxo** (registrar sem sair do Acerto de contas, sem perder estado).
- **Abordagem.** No Acerto de contas (settle-up), ação **"Registrar pagamento recebido"** que cria um `Settlement` (debtor = quem pagou, creditor = eu, `amountCents`, `settledAt`) com um campo **estruturado** `method: PaymentMethodKind` (pix/wise/bank/cash/other) — adicionar `method?` ao tipo `Settlement` (opcional, retrocompatível). Atualiza o saldo devido daquela pessoa. Reusa `settlement-repository`/`reimbursement-bridge` e o seletor de `payment-methods` (DEC-244). UI inline (sheet) que não tira o usuário do hub.
- **ACs.** (1) Posso registrar que recebi X de fulano (total ou parcial) com método opcional. (2) O saldo que a pessoa me deve reduz pelo valor. (3) Aparece no histórico de acertos. (4) Funciona para reembolso parcial.
- **Testes.** Unit: criar settlement reduz o devido corretamente (parcial e total); dedupe por `externalRef` quando vier de import (Wise) mantém-se. 
- **Anti-regressão.** Reusar `Settlement` existente (não criar tipo novo); não afetar o import Wise→settlement (DEC-200).
- **Esforço/Risco.** **M** / médio.

#### FB-28 — IA de ajuda/concierge do app, ancorada em KB compacta (ver C11) — NOVO · **V1 BEM COMPLETO** (decisão do Julio)
- **Causa-raiz/pedido.** Poder perguntar "como faço X / como funciona Y / melhor forma de economizar". A IA não tem o código; precisaria de uma KB. Restrição dura: **se gastar muito token, não fazer** (mataria o core de IA).
- **Decisão do Julio (v2): fazer o V1, mas BEM COMPLETO — "para tirar todas as dúvidas do user, bem completo mesmo".** O V1 (sem IA, 0 token) precisa ser uma **central de ajuda abrangente**, não um FAQ raso.
- **Abordagem (V1 robusto, ver C11).**
  1. **KB de ajuda abrangente** (`domain/help/help-catalog.ts`): cobrir **todas** as features e dúvidas comuns — lançar gasto (IA/manual/foto), dividir conta + mesa ao vivo + passa-o-telefone, acerto de contas (cobrar/lembrar/conexões/Pix-Wise), orçamento/fases/potes/cofrinho, check-ins/Amigo Sincero, planejador/simulador, câmbio/conversor, multi-viagem/Dia a dia, backup/restore, privacidade/localização, importar Wise, atualização do app. Cada entrada: pergunta + resposta curta clara + **passos** + **deep-link** para a tela + tags de busca, nos **3 idiomas**.
  2. **Busca local** (0 token): match por palavra-chave/sinônimos sobre a KB **e** o `guide-catalog` (FB-02), agrupada por tema, com "perguntas relacionadas".
  3. **Ponto de entrada de 1ª classe:** uma tela "Ajuda / Como funciona" acessível do menu Mais e/ou um atalho ("?"), além de aparecer nos resultados quando o usuário digita uma dúvida.
  4. **Respostas levam à ação:** todo card de ajuda tem botão que abre a tela certa (reusa rotas do catálogo).
- **V2 (depois, condicionado).** Fallback de IA só quando a busca local não casar, com **contexto mínimo** (2–3 trechos da KB), **proibida de inventar** além do contexto, atrás de **gate de orçamento de token** (amarrado a FB-18/FB-26). **Nunca** enviar o brain inteiro.
- **ACs.** (1) V1 cobre **todas** as features de 1ª classe com Q&A + passos + deep-link (3 idiomas) — abrangência verificável contra a lista de features. (2) Busca local responde dúvidas comuns **sem IA** (0 token) e leva à ação. (3) Entrada de ajuda acessível e óbvia. (4) V2 (se ligado) só responde a partir dos trechos e respeita o gate de orçamento.
- **Testes.** V1: cobertura (cada feature de 1ª classe tem ≥1 entrada com rota existente — teste de catálogo, espelhando o do Guia); busca casa pergunta→resposta→rota; 3 idiomas não-vazios. V2: prompt inclui só os trechos; gate corta quando orçamento baixo.
- **Anti-regressão.** O concierge **nunca** degrada o core de IA (registro) — busca local é 0 token; o gate do V2 protege o TPD/TPM. Manter a KB sincronizada com features novas (cada feature nova → 1 entrada; ligar ao processo de release notes/FB-01).
- **Esforço/Risco.** **M-G** (V1 abrangente — sobretudo a redação da KB em 3 idiomas) · **M** adicional (V2). **V2 só após FB-18/FB-26.**

---

## 4. Sequenciamento em gates (mínima regressão, padrão de hardening)

> Cada gate só fecha com **testes verdes (0 falhas), build web + tsc limpos, smoke das 3 telas-núcleo (home, lançar gasto, dividir conta), ACs cumulativas re-verificadas, dev-log atualizado**. Ordem prioriza ganho rápido + risco baixo primeiro. **Protocolo de sessão única: ver §4.1 (C15 / DEC-280) — testes do gate + deploy no Cloudflare + commit + context-reset entre gates.**

**Gate 1 ✅ ENTREGUE (0.99.40) — Quick wins de baixo risco (P, sem dependências).**
- FB-07 (FAB ↔ back), FB-13 (margem copiloto), FB-22 (modal admin centralizado), FB-20 (plataformas PWA), FB-05 (device name auto), FB-01 (release notes), FB-02 (guia).
- _Aquecimento barato, valor imediato, quase tudo isolado._

**Gate 2 ✅ ENTREGUE (0.99.41) — Amigo Sincero + Cofrinho + Carrossel (G, home/feedback).**
- FB-12 (frases + vozes + reveal no fim do carrossel), **FB-08 (cofrinho: ledger `piggy-ledger.ts` Modelo B + `buildPiggySpendByDay` + voz/extrato `PiggyStatementSheet` + insight `piggy_movement` + livre/dia buffer-aware)**, FB-14 (nota/saída = 1 ocasião via `occasionCount`).
- _Sub-gate de matemática travado por invariantes (saldo == Σdeltas == buffer; afunda-e-recupera 8000≠3000) **antes** da UI. Modelo B (§5.3). TOTAL free-to-spend byte-idêntico; carrossel só mudou contagem/geometria (ÂNCORA 9); cofrinho read-only (ÂNCORA 11). DEC-279/DEC-264/DEC-262._

**Gate 3 — Saída (M).**
- FB-15 (margens+fluxo), FB-16 (perguntas por contexto), FB-23 (finalizar/descartar).
- _Auditar `avgDrinkPriceCents` null antes de mexer._

**Gate 4 — Captura de imagem + Participantes inline + Entrada (M).**
- **CC-IMG** (extrair chooser tirar-foto/galeria — base das fotos), FB-06/FB-24 (`AddParticipantSheet` reutilizável), FB-09 (costura das entradas: foto na IA + ✨IA no manual).
- _CC-IMG primeiro (as fotos dependem dele), depois participantes e costura._

**Gate 5 — Nota por IA com paridade (M-G).**
- FB-10 (categoria/local/data no recibo + UI colapsada + foto→1 gasto). Toca worker prompt → testar OCR de ponta a ponta. Depende de CC-IMG (Gate 4).

**Gate 6 — Câmbio (M).**
- FB-04 (calculadora `/converter`) **+** intent de IA "quanto é X em Y?" (conta local). C12 (preço no Brasil) fica parado.

**Gate 7 — Admin v3 + Resiliência de IA (M).**
- FB-17 (tokens por função no modal), FB-18 (governança Groq server-side + headers), FB-21 (erros/aparelho por usuário), FB-19 (investigar/nomear 00000000), **FB-26** (degradação graciosa da IA — usa os mesmos headers do FB-18).
- _FB-19 e FB-26 andam junto com a instrumentação server-side do Groq._

**Gate 8 — Localização default + Dia a dia + Reembolso (M).**
- FB-03 (location on-by-default + DEC-265), FB-25 (planejador: abrir não grava / sem negativo no ongoing), **FB-27** (registrar reembolso recebido).

**Gate 9 — IA de ajuda do app (M, opcional/condicionado).**
- **FB-28 V1** (KB de ajuda + busca local, 0 token, reusa FB-02). **FB-28 V2** (IA fallback) só depois de FB-18/FB-26 e se houver folga de token.
- _Último porque é o único nice-to-have e o V2 depende da governança de token estar no ar._

**Princípios anti-regressão transversais.**
- `useAppData` é o gargalo único de "qual viagem" — nenhum item muda isso.
- Cofrinho/savings continuam read-only (ÂNCORA 11). Câmbio reusa `frozenRates`/`fetchExchangeRates`.
- Mudanças no carrossel são só de **contagem/geometria** (ÂNCORA 9), nunca de agregação financeira.
- Receipt commit continua transacional (all-or-nothing) e `excludeFromLearning`.
- Telemetria continua sem valores/conteúdo (allowlist/scrub). Plataforma/erros em granularidade grossa.
- **Captura de imagem usa um único padrão** (CC-IMG, extraído do DEC-206) — não criar 2º padrão; preservar o gesto síncrono (permissão de câmera iOS).
- **IA nunca bloqueia o registro:** ao estourar o Groq (FB-26), sempre cai pro manual preservando o input; o concierge (FB-28) tem **gate de orçamento** e jamais degrada o core de IA.
- **Abrir tela nunca grava** (FB-25): sugestões são efêmeras; só ação explícita do usuário persiste.
- Cada gate adiciona testes unitários do domínio novo + E2E nas telas tocadas.

### 4.1 Protocolo de execução em sessão única (C15 · deploy + context-reset por gate) — DEC-280

> **C15 (inline, 1 request, sem subagentes).** Pergunta do Julio: rodando os gates **na mesma sessão** (sem reiniciar o chat), o contexto acumula e degrada — devemos **reordenar** (pesados primeiro, leves no fim) para mitigar? **Decisão: a ordem é mantida; o que muda é o ritual entre gates.** A ordem atual já é boa — quick-wins (G1) → **G2, o mais pesado em lógica, enquanto o contexto está fresco** → médios; respeita a única dependência dura (CC-IMG/G4 → Nota-IA/G5); agrupa os gates que tocam o worker (G5/G7); e cada gate é uma **superfície coerente e deployável** pro Julio testar no celular. **A alavanca real contra a degradação não é a ordem — é limitar o contexto POR gate.**

**Ritual obrigatório ao fechar cada gate (nesta ordem):**
1. **Testes do gate + áreas impactadas** verdes (não a suíte inteira sempre, mas tudo que o gate toca) + `build` + `tsc` limpos + smoke das 3 telas-núcleo.
2. **Deploy no Cloudflare Pages (web/OTA):** **cada gate ganha seu PRÓPRIO bump de versão + release note** (Julio: "não acumular várias novidades na mesma sessão e ir só crescendo") — `APP_VERSION` + `package.json` + **`public/version.json`** (`version` + `bundleUrl`→`bundles/<v>.zip` + `notes`); o bump de `package.json`/`APP_VERSION` **não** atualiza o manifesto OTA (caveat pego no 0.99.39) → `commit` escopado + `push master` → auto-build roda `build:pages` (gera o bundle). Verificar `/version.json` + `/bundles/<v>.zip` `application/zip`. **Julio testa no celular** enquanto o próximo gate avança.
3. **Context Reset (mesma sessão, 0 request extra):** descartar o "barulho" de construção do gate.
4. **Refresh:** reler o master plan §4 do **próximo** gate + `dev-log.md` (Current State) + as regras; emitir NON-NEGOTIABLES + estado atual (hardening).
5. **Refresh intra-gate** a cada 3 milestones; no gate mais pesado (G2), o **sub-gate de matemática** é checkpoint próprio (travado por testes de invariante **antes** da UI).

_Micro-ajuste considerado e descartado:_ adiantar o Câmbio (G6, isolado, alto uso diário) — rejeitado: nenhuma dependência pede, e o reset já neutraliza a ordem; manter o agrupamento worker (G5/G7) vale mais. _Lente de maior peso:_ **Architect** (o reset limita o contexto por gate melhor que qualquer reordenação), com a pré-condição do **Critic** (cada gate só abre depois do anterior fechar testes + deploy).

---

## 5. Estado de ratificação + DECs propostas

### 5.1 ✅ Já ratificado pelo Julio (v2 — pode virar DEC e implementar)
| # | Item | Decisão do Julio |
|---|---|---|
| FB-03 | Localização default ON | **Aprovado** com emenda à ÂNCORA 8 (DEC-265), 1ª-execução transparente, sem GPS sem permissão. |
| FB-04 | Calculadora de câmbio | **Aprovado** — tela `/converter` **e** intent de IA "quanto é X em Y?" (conta local). |
| FB-09 | Costura das entradas | **Aprovado** — manual ganha "✨ IA", IA ganha câmera; **sem** wizard único. |
| FB-10 | Foto na IA | **Aprovado** — foto vira **1 gasto resumido** (com "abrir itens" opcional). |
| FB-11 | Excluir evento | **Mudou** — **perguntar** ao excluir: apagar gastos junto ou manter (desvincular). |
| FB-12 | Amigo Sincero | **Aprovado +** vozes selecionáveis no Settings **+** reveal de descoberta no fim do carrossel (fora da rotação automática). |
| FB-15 | Setup de saída | **Aprovado** — enxugar (sem redesenho completo agora). |
| FB-18 | Governança Groq | **Confirmado** — contabilização **server-side em tempo real** (worker), sem depender de heartbeat. |
| FB-19 | User 00000000 | **Mudou** — **investigar e nomear** a origem (bucket "Sistema/desconhecido") antes de dropar; depois limpar retroativo. |
| FB-21 | Aparelho/erros | **Aprovado** — granularidade grossa (SO+navegador+versão, sem modelo exato). |
| CC-IMG | Imagem 2 opções | **Novo, aprovado** — toda entrada de imagem = chooser tirar-foto/galeria. |
| FB-26 | IA indisponível | **Novo, aprovado** — aviso "alta demanda" + countdown real + cair pro manual. |
| FB-27 | Reembolso recebido | **Novo, aprovado** — registrar Pix/Wise/dinheiro/transferência via `Settlement`. |
| C12 | "Preço no Brasil" | **PARADO** — só preço real; Groq não navega → não fazer agora. |

### 5.2 Decidido na v2 (rodada de respostas do Julio)
- **Cofrinho (FB-08/C13/C14):** ✅ **Opção A + buffer**, e **modelo de cálculo = B** (ledger dia-ordenado derivado puro, com efeito no "livre/dia") — ratificado na rodada final. Voz + extrato + insight de movimentação (DEC-279). Emenda à ÂNCORA 11.
- **FB-28 (IA de ajuda):** ✅ **V1 bem completo, sem IA** (central de ajuda abrangente, 0 token); V2 com IA só depois da governança de token.

### 5.3 ✅ Resolvido na rodada final (2026-06-22) — nada mais aberto neste lote
1. **FB-27 (reembolso):** ✅ **campo estruturado** (reusando `PaymentMethodKind`: pix/wise/bank/cash/other) — "ajuda a ir utilizando a função". Requisito: **cadastro acessível sem quebra de fluxo** (registrar o recebido sem sair do Acerto de contas / sem perder o estado).
2. **FB-12 (vozes):** ✅ lista do V1 = **padrão / zen / durão / econômico** (4 vozes, default = padrão).
3. **Groq (FB-18/FB-26):** ✅ **sinalizar no Admin** quando começar a bater o limite (RPD/TPM) → então avaliar 2ª chave/organização/upgrade como decisão de negócio (não bloqueia o lote; é instrumentação + alerta no Gate 7).
4. **Cofrinho (FB-08/C14):** ✅ **Modelo B** (ledger buffer dia-ordenado, com efeito no "livre/dia") — ratificado pelo Julio. Mantém-se o fallback documentado pro Modelo A só como rede de segurança se um teste de uso mostrar confusão; a UI de extrato/insight é a mesma nos dois.

### 5.4 DECs registradas no decision-log (2026-06-22; próximo id livre = **DEC-281**)
- **DEC-256** — Calculadora de câmbio: tela `/converter` + **intent de IA** (conta local) + selo de idade; reuso de `frozenRates`.
- **DEC-257** — Costura das entradas (foto na IA + ✨IA no manual; **sem** wizard único).
- **DEC-258** — Paridade de campos na nota por IA (categoria/local/data + UI colapsada; foto→1 gasto).
- **DEC-259** — Participantes inline reutilizável (sem forçar ida às Configurações).
- **DEC-260** — FAB fecha no back (nativo + web), via overlay-dismiss.
- **DEC-261** — Cofrinho vira **buffer**: consome a poupança ao estourar o dia antes de cortar os próximos dias; check-in "não vou gastar" mostra o cofre subindo; derivação pura, emenda à ÂNCORA 11 (ver C13). _Refinado por **DEC-279/C14** (modelo de cálculo B + legibilidade; Modelo A vs B pendente — §5.3)._
- **DEC-262** — Carrossel conta nota/saída como 1 ocasião (não por item).
- **DEC-263** — Setup de saída contextual + layout padrão + finalizar/descartar.
- **DEC-264** — Amigo Sincero: banco de frases por faixa **× voz** + reveal no fim do carrossel.
- **DEC-265** — Localização default ON (emenda explícita à ÂNCORA 8; opt-out 1-toque; sem GPS sem permissão).
- **DEC-266** — Nome de dispositivo automático quando vazio (plataforma+navegador, sem modelo cru).
- **DEC-267** — Excluir evento a partir da edição **perguntando** sobre os gastos (apagar junto vs manter).
- **DEC-268** — Admin: tokens por função no detalhe do usuário.
- **DEC-269** — Admin: governança de tokens Groq **server-side em tempo real** (headers `x-ratelimit-*` + rollup minuto/dia/mês + projeção/gargalo).
- **DEC-270** — 00000000: **investigar/nomear** (bucket Sistema) → depois rejeitar/limpar; nada de "gasto sumido".
- **DEC-271** — Telemetria de plataforma com PWA (android-pwa/ios-pwa) + navegador (família).
- **DEC-272** — Admin: erros por usuário no detalhe + modal centralizado/2-col no desktop.
- **DEC-273** — Release notes/Guia atualizados (auditoria DEC↔notes; catálogo de capacidades).
- **DEC-274** — Planejador/pré-preenchimento: **abrir não grava**; guardas no modo Dia a dia (ongoing); sem saldo negativo por falta de config.
- **DEC-275** — **CC-IMG:** padrão único de captura de imagem (chooser tirar-foto/galeria) extraído do DEC-206, aplicado a toda entrada de imagem.
- **DEC-276** — **FB-26:** degradação graciosa da IA (worker normaliza 429→`retryAfterSec/scope`; cliente com cooldown + fallback manual preservando input).
- **DEC-277** — **FB-27:** registrar reembolso recebido (Pix/Wise/dinheiro/transferência) reusando `Settlement` + `PaymentMethodKind`.
- **DEC-278** — **FB-28:** IA de ajuda do app — V1 busca local (KB compacta, 0 token, reusa Guia); V2 IA fallback com contexto mínimo atrás de gate de orçamento. **Nunca** enviar o brain inteiro.
- **DEC-279** — **FB-08/C14:** cofrinho ganha **legibilidade** — **voz** (explicação no card + verbete no KB), **extrato** (ledger dia-ordenado derivado puro em `piggy-ledger.ts`: +depósitos/−saques com os gastos e cobertura parcial; recalcula pra frente) e **aviso de movimentação** (`piggy_movement` no carrossel, deep-link pro extrato). Card **sob demanda** (check-in/movimento), não fixo. Recomenda **Modelo B** (ledger buffer com efeito no "livre/dia"); **Modelo A vs B pendente de Julio (§5.3)**; UI funciona nos dois. Invariante: saldo-extrato == saldo-exibido == buffer. **Emenda à ÂNCORA 11** (leitura por-dia; total intacto). **Status: ✅ APROVADO — Julio ratificou o Modelo B; implementação no Gate 2.**
- **DEC-280** — **Protocolo de entrega em sessão única (C15):** ordem dos gates **mantida**; entre gates, ritual obrigatório = testes do gate + áreas impactadas → **deploy Cloudflare (bump `public/version.json`)** → commit escopado + push → **context-reset na mesma sessão** → refresh (plano §4 do próximo gate + dev-log + regras). Princípio: **limitar o contexto por gate > reordenar**.

---

### Apêndice — Mapa feedback → item → arquivos-âncora

| Feedback do Julio | Item | Arquivos-âncora |
|---|---|---|
| Release notes/about defasados | FB-01 | `utils/release-notes.ts`, `features/more/AboutPage.tsx`, `brain/README.md` |
| Menu "tudo que dá pra fazer" | FB-02 | `domain/guide/guide-catalog.ts` |
| Localização ligada por padrão | FB-03 | `data/db/seed.ts`, `data/repositories/app-settings-repository.ts`, onboarding |
| Calculadora de câmbio | FB-04 | `utils/exchange-rates.ts`, `domain/money/exchange.ts`, novo `domain/money/converter.ts`, novo `features/converter/`, `components/FAB.tsx` |
| Nome de dispositivo automático | FB-05 | `data/db/seed.ts`, `features/settings/SettingsPage.tsx`, `utils/platform.ts` |
| Participantes inline | FB-06/24 | `features/expenses/QuickAddPage.tsx`, recibo, `features/assistant/AssistantSheet.tsx`, novo `features/participants/AddParticipantSheet.tsx` |
| FAB fecha no back | FB-07 | `components/FAB.tsx`, `components/BottomNav.tsx`, `utils/overlay-dismiss.ts`, `utils/native/back-button.ts`, `app/RootLayout.tsx` |
| Cofrinho (extrato/voz/insight) | FB-08 (C13/C14) | `domain/budget/motivation.ts`, **`domain/budget/piggy-ledger.ts` (novo)**, `domain/budget/honest-friend-extras.ts` (extra `piggy_movement`), `domain/check-in/lens.ts`, `features/dashboard/DashboardCards.tsx` (card + extrato/timeline), `useDashboardModel.ts`, KB de ajuda (FB-28) |
| Maturidade das entradas | FB-09 | `components/FAB.tsx`, `AssistantSheet.tsx`, `QuickAddPage.tsx`, `utils/ai-ocr.ts` |
| Nota por IA: campos faltando | FB-10 | `domain/receipt/parse.ts`, `orchestrators/receipt-orchestrators.ts`, `worker/src/index.ts` (/ocr), `ReceiptScanPage.tsx` |
| Excluir evento | FB-11 | `features/trip/*` edição de evento (`/trip/edit`) |
| Amigo Sincero frases | FB-12 | `domain/budget/honest-friend*.ts`, novo `honest-friend-voice.ts`, i18n, `cards/AmigoSinceroCard.tsx` |
| Margem "veja mais copiloto" | FB-13 | `features/dashboard/DashboardCards.tsx` |
| Itens de nota = "outros" | FB-14 | `domain/dashboard/occasion-counters.ts`, `useDashboardModel.ts` |
| Iniciar saída sem margens/fluxo | FB-15 | `features/outing/OutingPage.tsx` |
| Perguntas irrelevantes na saída | FB-16 | `features/outing/OutingPage.tsx`, `domain/outing/outing.ts` |
| Tokens por função no usuário | FB-17 | `worker/src/index.ts`, `utils/admin-api.ts`, `features/admin/AdminPage.tsx` |
| Governança Groq | FB-18 | `worker/src/index.ts`, `AdminPage.tsx`, `admin-api.ts` |
| Usuário 00000000 | FB-19 | `worker/src/index.ts` (`recordAiUsage`/ingest), `utils/admin-api.ts`, `AdminPage.tsx` |
| Plataformas PWA/nativo | FB-20 | `utils/platform.ts`, `utils/telemetry.ts`, `AdminPage.tsx` |
| Erros/aparelho por usuário | FB-21 | `worker/src/index.ts`, `utils/telemetry.ts`, `AdminPage.tsx` |
| Modal admin centralizado | FB-22 | `features/admin/AdminPage.tsx` |
| Finalizar saída sem salvar | FB-23 | `features/outing/OutingPage.tsx`, `domain/orchestrators/outing-orchestrators.ts` |
| Planejador no Dia a dia | FB-25 | `features/planning/PlannerPage.tsx`, `domain/spaces/*` (capabilities por `kind`), simulador/check-in |
| Imagem: tirar foto / galeria (transversal) | CC-IMG | `features/attachments/AttachmentSection.tsx` (DEC-206, padrão), novo `components/ImageSourceChooser` / hook `usePickImage`, `ReceiptScanPage.tsx`, `AssistantSheet.tsx` |
| IA indisponível (free tier estourou) | FB-26 | `worker/src/index.ts` (429→`retryAfterSec/scope`), `utils/ai-ocr.ts`/clientes de IA, `AssistantSheet.tsx`, `/quick-add` (fallback) |
| Registrar reembolso recebido | FB-27 | `domain/types/settlement.ts`, `data/repositories/settlement-repository.ts`, `domain/payment/payment-methods.ts`, settle-up UI |
| IA de ajuda do app | FB-28 | nova KB de ajuda + `domain/guide/guide-catalog.ts` (busca local), `worker/src/index.ts` (V2 fallback c/ gate de token) |
