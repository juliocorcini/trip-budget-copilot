# Comparador de Custo-Benefício V2 — Multi-imagem (OCR de várias fotos → extrai de todas → compara)

> **Data:** 2026-06-22
> **Status:** ✅ **IMPLEMENTADO** (0.99.50) — registrado como **DEC-284** no `decision-log.md`. Worker `POST /unit-extract`, domínio `domain/shopping/unit-extract.ts` (+12 testes), transporte `utils/ai-unit-extract.ts`, UI multi-foto na `ComparatorPage` e reorg do FAB. _Deploy do worker pendente (`wrangler deploy`) p/ a rota nova ir ao ar._
> **Pede decisão:** ~~registrar como DEC-284~~ → feito (depende de DEC-283 = Comparador V1, no ar na 0.99.49).
> **Pedido do Julio:** *"fazer o C [foto/OCR], mas deixar mandar **várias imagens de uma vez** e ele tira a info de **todas** as imagens e faz a comparação."*

---

## 1. Contexto — o que já existe (V1, DEC-283)

O V1 já entregou a base **determinística e agnóstica de moeda**:

- **Domínio puro:** `src/domain/shopping/unit-price.ts` — `compareUnitPrice(items)` calcula preço por unidade (€/kg, €/L, €/un), elege melhor/pior, % de economia, empate e dimensões mistas. Testado.
- **Intent de IA:** `AiIntent.comparisonItems: AiComparisonItem[]`, onde `AiComparisonItem = { price, quantity, unit, label }`. Coerção robusta em `intent.ts` (exige `price` e `quantity`).
- **Navegação:** `plan.ts` serializa `comparisonItems` e abre `/comparator?items=<JSON>`.
- **Tela:** `src/features/comparator/ComparatorPage.tsx` — 2–6 linhas (preço/qtd/unidade/rótulo), veredito em tempo real, aceita pré-preenchimento via `?items=`.
- **Entradas hoje:** **texto/voz** (via IA) e **manual** (digitar). **Falta a foto.**

E existe um **pipeline de visão pronto para reuso** (DEC-206, OCR de recibo):

- **Worker** (`worker/src/index.ts`): rota que recebe **`imageDataUrl`** (uma imagem, data URL), valida (`data:image/`, `OCR_MAX_IMAGE_CHARS`), repassa para o **modelo de visão do Groq** (`{ type: 'image_url', image_url: { url } }`) e devolve **JSON estruturado**.
- **Cliente:** já faz **downscale 1600px / q0.82** antes de enviar, e tem `ImageSourceChooser` (câmera ou galeria) e `QrScanner`/anexos.

> **Conclusão:** o V2 é majoritariamente **composição de peças existentes**. O novo é: (a) entrada **multi-imagem**, (b) um **prompt/rota de extração** que devolve o shape do comparador, (c) um **orquestrador** que lê N fotos em paralelo e cai na tela já preenchida para o usuário **confirmar**.

---

## 2. Objetivo e princípio

**Objetivo:** o usuário fotografa **as etiquetas/embalagens dos produtos** (uma foto por produto, várias de uma vez), o app **lê preço + quantidade + unidade de cada foto** e mostra **qual vale mais por kg/L/unidade** — sem digitar.

**Princípio inegociável (OCR é falível):** o resultado da leitura é um **rascunho editável**, não verdade. O usuário **sempre** cai na `ComparatorPage` **pré-preenchida**, vê o que foi lido, **corrige** o que estiver errado e só então lê o veredito. Nada é comparado "às escondidas".

---

## 3. Escopo

**Dentro (V2):**
- Selecionar/tirar **múltiplas imagens** (até **6**, igual ao teto de linhas do comparador).
- **1 produto por imagem** (a etiqueta/preço dominante da foto).
- Extrair por imagem: `price`, `quantity`, `unit`, `label` (+ `currency` e `confidence` para UX).
- **Leitura em paralelo** das N imagens; cada imagem → 1 linha do comparador.
- Cair na `ComparatorPage` **pré-preenchida**, com linhas de **baixa confiança / falha** destacadas para revisão.
- **Resiliência:** uma foto ilegível **não derruba** as outras — vira linha "não consegui ler, confira".

**Fora (V3+):**
- **Vários produtos numa mesma foto** (ex.: prateleira inteira) → exige detecção/recorte, maior ambiguidade.
- **Porcentagem / "tem X% de algo"** (ex.: % de cacau, % de suco) como dimensão de comparação.
- **Moedas diferentes** entre fotos → normalizar via Conversor (hoje: assume mesma moeda; avisa se detectar símbolos diferentes).
- Histórico/salvar comparações.

---

## 4. Fluxo de UX (V2)

```
ComparatorPage
   └─ botão "Adicionar por foto"  (usa ImageSourceChooser: Câmera | Galeria, multi-seleção)
        └─ usuário escolhe 2–6 fotos
             └─ tela de progresso: "Lendo 4 fotos…" (uma a uma, em paralelo)
                  └─ cada foto vira uma linha:
                       • lido com confiança  → linha preenchida (preço/qtd/unidade/rótulo)
                       • baixa confiança       → linha preenchida + chip "confira"
                       • ilegível/sem preço    → linha vazia + chip "não consegui ler"
                  └─ ComparatorPage mostra veredito + banner "Confira os valores lidos antes de decidir"
```

- **Entrada alternativa (V2.1):** pela IA/FAB — *"compara essas duas fotos"* + anexos → mesmo pipeline → mesma tela.
- **Microcopy honesto:** "A IA leu da foto — confira preço e quantidade." (define expectativa; evita confiança cega.)
- **Acessibilidade:** botões rotulados (`aria-label`), foco e contraste seguindo o **Pacote UX-A** da auditoria; chips de estado **não** dependem só de cor (ícone + texto).

---

## 5. Arquitetura (reuso primeiro)

### 5.1 Mapa de reuso vs novo
| Camada | Reusa (existe) | Novo (V2) |
|---|---|---|
| UI seleção de imagem | `ImageSourceChooser` (câmera/galeria) | flag **multi-seleção** + cap 6 |
| Downscale/encode | util de downscale do recibo (1600px/q0.82) | — |
| Worker relay de visão | infra do OCR de recibo (validação, `OCR_MAX_IMAGE_CHARS`, modelo Groq) | **rota/prompt de extração unitária** |
| Domínio de comparação | `compareUnitPrice` + `AiComparisonItem` (DEC-283) | — |
| Navegação | `ComparatorPage?items=` | campos `confidence`/`needsReview` |
| Tela | `ComparatorPage` | estado "pré-preenchido por foto" + destaque de revisão |

### 5.2 Orquestração no cliente (segue `software-engineering-guidelines`)
Função-orquestradora pequena, composta de unidades focadas; chamadas independentes em paralelo (`Promise.all`):

```ts
// src/domain/shopping/unit-extract.ts  (NOVO — domínio, sem UI)
export interface ExtractedUnitItem extends AiComparisonItem {
  currency: string | null;
  confidence: number;        // 0..1 (do modelo)
  needsReview: boolean;      // confidence baixa OU campos faltando
  sourceIndex: number;       // qual foto originou
}

// orquestrador: lê N imagens em paralelo, resiliente (falha isolada vira linha needsReview)
export async function extractUnitItemsFromImages(
  images: string[],                         // data URLs já com downscale
): Promise<ExtractedUnitItem[]>;

// unidade: 1 imagem → 1 item (chama o worker; normaliza via resolveUnit do V1)
async function extractUnitItemFromImage(image: string, index: number): Promise<ExtractedUnitItem>;
```

- Reaproveita `resolveUnit`/`normalizeQuantity` do V1 para **normalizar a unidade lida** (ex.: "g", "gr", "gramas" → grama) antes de cair na tela.
- **Resiliência:** `extractUnitItemFromImage` nunca rejeita o lote — em erro/timeout devolve `{ needsReview: true, price/quantity nulos }`.
- **Limite de custo/latência:** cap de 6; se o Groq limitar (429), cair para sequencial com backoff (reusar guarda do recibo).

### 5.3 Contrato do worker (NOVO, espelha o OCR de recibo)
```
POST /unit-extract            (mesma origem/relay do OCR; stateless)
req:  { imageDataUrl: "data:image/..." }
res:  { price: number|null, quantity: number|null, unit: string|null,
        label: string|null, currency: string|null, confidence: number }
guardas: começa com "data:image/"; tamanho ≤ OCR_MAX_IMAGE_CHARS (413 se exceder)
prompt (resumo): "Desta foto de etiqueta/embalagem, extraia SÓ o produto em destaque:
        price (número), quantity (número), unit (g|kg|ml|l|un), label (curto),
        currency (ISO se visível). Não invente; campo ausente = null;
        confidence 0..1. Responda só JSON."
```
> Alternativa considerada e **descartada para V2**: mandar as N imagens numa **única** chamada (o chat de visão aceita vários `image_url`). Descartado porque dificulta **atribuir erro por foto** e **isola pior** uma leitura ruim. **N chamadas em paralelo** = mais resiliente e reusa a rota 1-imagem quase de graça. (Reavaliar em V3 por custo.)

### 5.4 Por que não pôr tudo na IA genérica (`compare_unit_price`)?
O intent `compare_unit_price` (texto/voz) **continua** para a entrada falada. A **foto** é um pipeline determinístico (imagem→extração→tela) que **não** precisa passar pelo roteador de linguagem natural — é mais barato, previsível e testável chamá-lo direto da `ComparatorPage`. Os dois caminhos **convergem** na mesma tela e no mesmo `compareUnitPrice`.

---

## 6. Tratamento de erros e bordas (Crítico)
| Caso | Comportamento |
|---|---|
| Foto sem preço/qtd legível | linha vazia + chip "não consegui ler — preencha" (não dropar) |
| Confiança baixa | linha preenchida + chip "confira" + destaque |
| Unidade desconhecida | cair na unidade crua + pedir seleção (reusa seletor do V1) |
| Moedas diferentes entre fotos | comparar mesmo assim (por-unidade), **avisar**: "preços em moedas diferentes — confira"; normalização real fica p/ V3 |
| >6 fotos | aceitar 6, avisar que o resto foi ignorado |
| Offline / Groq fora | erro claro + manter o que já foi lido + permitir entrada manual |
| Imagem gigante | guarda 413 do worker; cliente já faz downscale |

---

## 7. Fases de entrega
- **V2.0 (núcleo):** botão "Adicionar por foto" na `ComparatorPage` (multi-seleção até 6) → `extractUnitItemsFromImages` (paralelo, resiliente) → pré-preenche → usuário confirma. **Reusa** intent/tela/domínio do V1. Worker ganha `/unit-extract`.
- **V2.1 (voz/IA):** caminho "compare essas fotos" pelo FAB/IA com anexos → mesmo pipeline.
- **V3 (futuro):** múltiplos produtos por foto; dimensão "%"; normalização cross-moeda via Conversor; salvar comparações.

---

## 8. Critérios de aceite (V2.0)
1. Selecionar 2–6 fotos (câmera ou galeria) a partir da `ComparatorPage`.
2. Cada foto legível vira **uma linha** com `price/quantity/unit/label` corretos para casos comuns (etiqueta de supermercado nítida).
3. Foto ilegível **não** quebra o lote → vira linha de revisão.
4. Usuário **sempre** revisa antes do veredito; banner "confira os valores lidos".
5. `compareUnitPrice` produz o mesmo veredito do V1 dados os mesmos números.
6. A11y: alvos ≥44px, rótulos, foco visível, estado por ícone+texto (não só cor).
7. Sem regressão no fluxo manual/voz do V1.

## 9. Plano de teste
- **Unidade (domínio):** `extractUnitItemsFromImages` com mocks do worker — sucesso, baixa confiança, falha isolada, unidade-alias, >6 imagens. `extractUnitItemFromImage` normaliza via `resolveUnit`.
- **Worker:** validação `data:image/`, 413 acima do limite, parse do JSON do modelo (campos nulos), `confidence`.
- **Integração/E2E (Playwright):** stub da rota `/unit-extract`; subir 2 imagens fixtures → ver 2 linhas pré-preenchidas + veredito; 1 imagem ruim → linha de revisão.
- **Fixtures:** 3–4 fotos reais de etiquetas (g, kg, ml, un) + 1 borrada.

## 10. Estimativa (Tier 3 — velocidade estruturada ÷3)
| Bloco | Bruto | Tier 3 |
|---|---:|---:|
| Worker `/unit-extract` (prompt + guardas + teste) | 6h | ~2h |
| Domínio `unit-extract.ts` + testes | 8h | ~2.5h |
| UI multi-seleção + estados na `ComparatorPage` | 10h | ~3h |
| E2E + fixtures + polimento a11y | 6h | ~2h |
| **Total V2.0** | **30h** | **~10h (1–1.5 dia)** |

## 11. Decisões em aberto (para o Julio)
1. **Teto de fotos:** 6 (igual às linhas) — ok? ou 4 para conter custo de IA?
2. **Confiança visível:** mostrar um selo de confiança por linha, ou só destacar as duvidosas?
3. **Moedas diferentes:** avisar e comparar mesmo assim (V2) vs bloquear até V3 (normalização)?
4. **Entrada por voz (V2.1):** entra junto ou depois do núcleo?
5. **Rota nova vs reuso:** `/unit-extract` dedicado (recomendado) vs reaproveitar o OCR de recibo e pós-processar?

---

## 12. Referências
- `cost-benefit-comparator-council-2026-06-22.md` (conselho V1) · DEC-283 (V1).
- DEC-206 (OCR de recibo — pipeline de visão reaproveitado) · `receipt-ocr-item-split-research-2026-06-16.md`.
- `src/domain/shopping/unit-price.ts`, `src/features/comparator/ComparatorPage.tsx`, `src/domain/assistant/intent.ts`, `worker/src/index.ts`.
- `software-engineering-guidelines` (orquestradores, reuso, paralelismo, abstração via função dedicada).
