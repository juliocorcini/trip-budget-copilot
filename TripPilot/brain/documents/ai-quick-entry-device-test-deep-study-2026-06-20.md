# Estudo Completo — IA Entrada Rápida + 3 Bugs de Campo (2026-06-20)

> Origem: teste real no celular (v0.99.15). Julio reportou 4 problemas e pediu
> um **estudo extremamente completo com verificação real** antes de implementar,
> porque correções anteriores da divisão "tentaram arrumar e continua quebrado".
>
> Metodologia desta vez: **parei de adivinhar**. Sondei o worker REAL em produção
> com uma matriz de frases (evidência abaixo), li o caminho de código do
> dispositivo linha a linha, e isolei a camada exata de cada falha.

---

## TL;DR (a descoberta que muda tudo)

**O bug da divisão NUNCA foi a IA.** O modelo na nuvem (Groq llama-3.3-70b)
retorna o intent **correto** para a frase que falha. O planejador
(`plan.ts`) também calcula **correto** (€4 por pessoa). O executor
(`dispatch.ts` → `resolvePayerExpense`) **grava correto** (dívida de €4).

A falha está numa **única função de exibição** (`composePreview` em
`AssistantSheet.tsx`): ela mostra o **valor TOTAL (€12)** em vez da **minha parte
(€4)** sempre que a direção é "eu devo". Por isso eu vinha "consertando a IA" e
nada mudava — a IA já estava certa há tempos; quem mente é o texto do preview.

| # | Problema | Camada da causa-raiz | Entrega via |
|---|----------|----------------------|-------------|
| 2 | Divisão mostra €12 em vez de €4 | **UI preview** (device) | OTA (JS) |
| 1 | Falar (mic) não funciona | **Nativo** (AndroidManifest sem RECORD_AUDIO) | **APK novo** |
| 3 | Nota de 40 itens vira 40 linhas no acerto | **UI** (sem agrupar/paginar) | OTA (JS) |
| 4 | Amigo Sincero travado em 1 insight | **Domínio + UI** (1 veredito só) | OTA (JS) |

---

## Problema #2 — Divisão (CRÍTICO) — RESOLVIDO NA RAIZ

### Frase que falha (print do Julio)
`"Bruno pagou 12 euros na tortilha, eu ele e a Débora vamos dividir o valor"`
→ App mostrou: **"Você vai dever € 12,00 para Bruno"** (errado; deveria ser €4).

### Evidência real — sondagem do worker em produção
Rodei `node /tmp/probe-assistant.mjs` contra
`https://trippilot-sync.trippilot.workers.dev/assistant` (produção):

```
[SPLIT/other-paid/3way/pronoun (a que falha no celular)]
  IN : Bruno pagou 12 euros na tortilha, eu ele e a Débora vamos dividir o valor
  200 OUT: {"action":"split_expense","amount":12,"payer":"other",
            "person":"Bruno","participants":["Bruno","Débora"]}   ← CORRETO

[SPLIT/other-paid/3way (a antiga que falhava)]
  IN : Bruno pagou 12,80 euros pelas tortilhas, dividimos entre ele eu e a débora
  200 OUT: {"action":"split_expense","amount":12.8,"payer":"other",
            "person":"Bruno","participants":["Bruno","Débora"]}   ← CORRETO
```

O intent está perfeito: `split_expense`, pagador = Bruno (`payer:"other"`),
participantes = [Bruno, Débora]. O usuário ("eu") é implícito → 3 pessoas.

### O caminho no dispositivo (rastreado)
1. `plan.ts` → `planExpense` → ramo `split_expense` → `equalSplit(Bruno, [eu, Bruno, Débora])`.
   - `perPersonCents = round(1200 / 3) = 400` (€4). ✅
   - `preview.debtDirection = 'i_owe'`, `preview.personName = 'Bruno'`,
     `preview.participantNames = [eu, Bruno, Débora]`, `preview.amountCents = 1200`.
2. `dispatch.ts` → `resolvePayerExpense` (tabela DEC-114, linha "other + split=yes")
   → `personalCostCents = 400`, grava dívida de **€4** a Bruno. ✅ (gravação correta!)
3. `AssistantSheet.tsx` → `composePreview` ← **AQUI mora o bug**:

```ts
// AssistantSheet.tsx (ANTES)
function composePreview(preview, t, money) {
  const amount = money(preview.amountCents, preview.currency); // = €12,00 (TOTAL)
  if (preview.op === 'expense') {
    if (preview.debtDirection === 'i_owe')
      return t('assistant.preview.someone_paid', { person, amount }); // ← €12, ERRADO p/ split
    if (preview.debtDirection === 'owes_me')
      return t('assistant.preview.i_paid_for', { person, amount });
    if (preview.participantNames?.length)                            // nunca chega aqui p/ i_owe
      return t('assistant.preview.split', { amount, count, per });
    ...
```

A condição `debtDirection === 'i_owe'` dispara **antes** do ramo de divisão.
Numa divisão paga por outro, o `plan.ts` seta **ao mesmo tempo** `i_owe` **e**
`perPersonCents` — então o código entra no ramo errado e imprime o total.

> Bônus encontrado: o ramo `owes_me` (paguei para vários, eles rateiam) também
> estava bugado — `personName` é `undefined` nesse caso ("undefined te deve…").

### Correção (deste pass)
Reordenar `composePreview`: se é divisão (`participantNames` presente), usar a
**parte por pessoa** mesmo quando há `debtDirection`. Novas chaves i18n:
- `assistant.preview.split_i_owe` = "Você vai dever {per} para {person} (sua parte de {amount} ÷ {count})"
- `assistant.preview.split_owes_me` = "{count} pessoas te devem {per} cada — {amount} no total"

Mantém intactos os casos puros: `someone_paid` (devo o total) e `i_paid_for`
(1 pessoa me deve o total).

### Por que as tentativas anteriores falharam
Todas mexeram no **prompt do worker** (a camada que já estava certa). O preview
nunca foi tocado. Lição: **sondar a saída real antes de "consertar"**.

---

## Matriz de teste de frases (verificação real no worker de produção)

| Tipo de entrada | Frase | Intent retornado | Veredito |
|---|---|---|---|
| Split, outro pagou, 3-way, pronome | "Bruno pagou 12 euros na tortilha, eu ele e a Débora vamos dividir o valor" | split_expense / other / [Bruno,Débora] | ✅ IA ok · UI corrigida |
| Split, outro pagou, 3-way | "Bruno pagou 12,80 … dividimos entre ele eu e a débora" | split_expense / other / [Bruno,Débora] | ✅ IA ok · UI corrigida |
| Split, eu paguei, 2-way | "almoço 35 dividido com a Ana" | split_expense / me / [Ana] | ✅ |
| Alguém pagou (total) | "o Bruno me pagou uma cerveja de 2 euros" | someone_paid / Bruno | ✅ |
| Paguei por alguém | "paguei 20 euros de uber pra Ana" | i_paid_for / me / Ana | ✅ |
| Gasto simples | "gastei 15 euros no almoço" | log_expense / me | ✅ |
| Local+carteira+data | "paguei 8 euros no crédito no bar do Zé ontem" | log_expense + place="bar do Zé" + date=2026-06-19 + fromWallet="crédito" | ✅ extração rica ok |
| Split meio a meio (eles pagaram) | "dividi 100 meio a meio com o Bruno, ele pagou" | **429 (rate limit)** | ⚠️ ver abaixo |
| Split "a gente" 3 | "a gente dividiu uma pizza de 30, eu, Bruno e Ana" | **429** | ⚠️ |
| Receita | "recebi 50 euros de reembolso" | **429** | ⚠️ |
| Acerto | "acertei o que devia pro Bruno" | **429** | ⚠️ |
| Split "racha" 3 | "rachei o táxi de 18 com a Ana e o Bruno" | **429** | ⚠️ |

### Achado secundário importante: RATE LIMIT (429) do Groq
6 de 12 chamadas seguidas voltaram **429** (limite de req/min do tier free do
Groq). O worker mapeia para `assistant_rate_limited` → o app cai no fallback
manual. Para o usuário em campo (vários lançamentos seguidos no bar) isso vira
"não funciona". Mitigações a avaliar (Problema futuro, não bloqueia #2):
- retry com backoff curto (1 tentativa após ~2s) no cliente;
- mensagem clara "muitos pedidos, tente em instantes" (em vez de erro genérico);
- avaliar outro modelo/limite. Confiança do diagnóstico 429: **ALTA** (reproduzido).

---

## Problema #1 — Falar (mic) não funciona

### Sintoma (Julio)
"O mic muda o ícone e some; não me pediu permissão."

### Causa-raiz (CONFIRMADA no código)
`android/app/src/main/AndroidManifest.xml` declara CAMERA, LOCATION,
NOTIFICATIONS — **mas NÃO declara `RECORD_AUDIO`**. No APK:
- A Web Speech API (`webkitSpeechRecognition`) **não existe** no Android WebView
  → `isSpeechRecognitionSupported()` = false → cai no fallback Whisper.
- O fallback usa `getUserMedia({audio})` (MediaRecorder → `/transcribe`).
- O próprio comentário ao lado de CAMERA já avisa: *"Capacitor 8 pede o grant em
  runtime no onPermissionRequest, mas só se estiver declarado aqui; sem essa
  linha o Android nega antes de mostrar qualquer prompt."*
- Sem `RECORD_AUDIO` declarado → Android nega o mic **sem prompt** → ícone pisca
  e some. Exatamente o sintoma.

### Correção
Adicionar ao manifest:
```xml
<uses-permission android:name="android.permission.RECORD_AUDIO" />
<uses-permission android:name="android.permission.MODIFY_AUDIO_SETTINGS" />
```
**ATENÇÃO:** isso é mudança **nativa**. OTA (bundle JS) **não** adiciona permissão
nativa. Requer **rebuild + reinstalação do APK**. Feito neste pass no repositório;
o APK precisa ser gerado de novo para o mic funcionar no celular.

Confiança: **ALTA** (causa idêntica ao caso resolvido da câmera/QR, mesmo
mecanismo do Capacitor).

---

## Problema #3 — Nota importada vira 40 linhas no Acerto de Contas

### Sintoma (Julio)
Nota (foto/OCR) com ~42 itens paga pelo Bruno. No total do acerto está certo
(devo €53). Mas em "Gastos compartilhados" **cada item virou uma linha** (~42),
deixando a tela "ilegível" e longuíssima. Em "Gastos" aparece agrupado como
"mercado · evento único · 42 itens" — só o acerto que não agrupa.

### Causa-raiz (CONFIRMADA)
O fluxo de OCR/itemização cria **uma transação por item** (42 transações
`isShared`). Em `SharedExpensesPage.tsx` a seção "Gastos compartilhados"
(linhas ~581-615) faz `sharedTxs.map(...)` — **1 card por transação**, **sem
agrupar por evento/outing e sem paginação**. Logo, 42 transações = 42 cards.

A lista de "Gastos" agrupa por outing/ocasião (por isso lá aparece "evento único
42 itens"), mas o acerto não usa esse agrupamento.

### Correção (planejada — maior, requer alinhamento)
Em `SharedExpensesPage`:
1. **Agrupar** `sharedTxs` por `sessionId`/outing (quando existir): 1 card-evento
   com total + contagem ("Mercado · 42 itens · €X"), **expansível** para ver os
   itens. Transações soltas (sem evento) seguem como card individual.
2. **Paginar/limitar**: mostrar N (ex.: 6) e botão "Ver mais".
Pura UI + uma função de domínio de agrupamento (testável). Sem mexer em cálculo.

---

## Problema #4 — Amigo Sincero travado em "1%"

### Sintoma (Julio)
Há tempo só mostra "esse gasto levou 1% do dinheiro livre…". Quer que ele rode
**outras** verdades (carrossel), não fixe numa só.

### Causa-raiz (CONFIRMADA)
`buildHonestFriendV2` (domain/budget/honest-friend.ts) produz **UM** veredito,
amarrado ao **último gasto gatilho** (`recentSpendCents`). Sem plano de categoria
para o gasto (ex.: €150 em "Outros"), cai no fallback `no_plan` → mostra
`impactPercent`. `AmigoSinceroCard.tsx` renderiza **um** read. Não há rotação.
Ele realmente tem mais a dizer (categoria que mais pesa, ritmo vs plano, dias de
fôlego, dívidas a receber, etc.), mas o gerador só emite a verdade dominante.

### Correção (planejada — maior, decisão de produto)
1. Gerador de **múltiplos** insights honestos (lista priorizada e pura).
2. **Carrossel** no card (auto-rotação suave + swipe), reaproveitando o
   `TONE_STYLE` existente. Decisão: quais insights e quantos (sugiro 3-5).

---

## Plano de implementação (ordem)

**Neste pass (agora, com verificação):**
- ✅ #2 preview da divisão — `composePreview` + chaves i18n + testes unitários.
- ✅ #1 `RECORD_AUDIO` no manifest (sinalizar rebuild de APK).
- ✅ bump 0.99.15 → 0.99.16 + release notes + deploy OTA (Pages).
- ✅ re-sondar/verificar versão viva = 0.99.16.

**Próximo pass (maiores, pedir luz verde):**
- #3 agrupar+paginar gastos compartilhados no acerto.
- #4 multi-insight + carrossel do Amigo Sincero.
- (futuro) mitigar rate limit 429 do Groq.

## Estratégia de testes
- **Unit (rápido, determinístico):** `composePreview` (todas as variações de
  expense, foco nos splits i_owe/owes_me) + matriz de `plan.ts` split.
- **Integração real (a verdade da IA):** o script `probe-assistant.mjs` bate no
  worker de produção (evidência acima). É o teste "real com todos os tipos de
  fala" — repetível a cada deploy.
- **E2E (próximo):** Playwright na sheet com `/assistant` mockado, travando
  "mostra €4" para a frase das tortilhas (regressão visual do preview).
