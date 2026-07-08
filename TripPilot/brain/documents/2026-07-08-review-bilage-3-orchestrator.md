# Review Bilage 3 — Orchestrator

**Status: ✅ ACTIVE** · Versão base `2.7.7-rc` → alvo `2.8.0-rc` (um bump por gate)  
**Sibling waves:** `2.7.5-rc` (multi-moeda/cobrança, DEC-474→477), `2.7.3-rc` (notas/wallet/bulk, DEC-473)

---

## §0 — Missão

**O que esta leva É:** um batch de correções e melhorias vindas do 3º review de campo (Bilage 3) — 6 itens: FOUT de ícones, rótulo "Você" errado no board de grupo, saldo que não reflete pagamento confirmado, imagem OG cortando fotos do WhatsApp, opção de dividir ausente na edição de gasto, e atalho para registrar entrada ao confirmar pagamento.

**O que NÃO é:** nenhuma mudança de matemática de orçamento/dívida, nenhum refactor arquitetural, nenhuma feature fora do briefing.

**O app é:** TripPilot — copiloto de orçamento de viagem, offline-first PWA + Capacitor Android, React 19 + TS + Vite + Tailwind + Dexie + Cloudflare Pages.

**Dor do usuário nas palavras dele:**
- "os ícones aparecem primeiro como texto e depois carregam"
- "o nome Julio Corsine aparece como 'Você' sendo que não é você — é outra pessoa vendo"
- "aqui no pagamento já devia atualizar falando que a Bia já pagou"
- "todas as imagens foram recortadas pra caber num tamanho padrão — quero manter a proporção original"
- "quando eu clico em editar, não aparece pra eu dividir com outras pessoas"
- "se eu confirmei que ela pagou, já tem que fazer uma entrada, um registro"

**→ vá para §17 para começar.**

---

## §1 — Identidade & contrato de autonomia

Você é um engenheiro full-stack sênior aplicando a leva "Review Bilage 3" sozinho, nesta sessão, sem subagentes. Os 9 contratos do projeto (sem Task tool, sem pedir permissão entre milestones, sem narrar o que vai fazer, reutilizar o que existe, código em inglês, UI via `t()`, domínio antes de UI, testar junto com a mudança, respeitar terminal WSL, manter o brain em sincronia) são absolutos.

---

## §2 — Ordem de leitura

1. Este doc §0–§9 (contexto completo)
2. `src/dev-log.md` (estado atual)
3. Decisões citadas: DEC-297 (group-split), DEC-458 (footer OG), DEC-114 (payer semantics)
4. `product-spec.md` §28 (Group Split), §9 (Shared Expenses)
5. O orquestrador irmão para tom: `2026-07-06-multi-moeda-charge-planner-orchestrator.md`

Não releia o brain inteiro a cada milestone.

---

## §3 — Não-negociáveis (ÂNCORA)

**Herdados (app-wide):**
1. Dinheiro = centavos inteiros (`toCents`/`fromCents`)
2. Domínio = TS puro, zero React
3. UI text via `t()`, nunca hardcoded
4. Hide-never-delete
5. Data invariance — nunca mudar totais existentes
6. Nunca bloquear registro de gasto
7. `isShared` + shares → `calculateOwnerPersonalCost` governa o custo pessoal
8. Payer semantics DEC-114 (quem pagou × dividiu × custo pessoal × dívida × carteira)

**Novos desta leva:**
9. **Â-ICON-INVISIBLE:** ícones NUNCA aparecem como texto — o font deve estar carregado ou o ícone invisível
10. **Â-OG-RATIO:** quando a imagem OG tem foto do usuário, manter o aspect ratio original; imagens geradas (sem foto) mantêm 1200×630
11. **Â-BALANCE-REFLECTS-PAYMENT:** o painel "Pagamentos" do group-split DEVE mostrar que um participante pagou quando o status é `confirmed`
12. **Â-EDIT-PARITY:** o formulário de edição de gasto deve ter as mesmas opções de divisão que o QuickAdd

---

## §4 — Baseline — o que já existe

| Área | Arquivo | Símbolo | Estado |
|------|---------|---------|--------|
| Ícones | `index.html` | `<link>` Material Symbols via Google Fonts CDN | Sem `font-display`, sem preload → FOUT |
| Ícones | `src/components/Icon.tsx` | `Icon` → `<span className="material-symbols-outlined">{name}</span>` | Texto visível antes da fonte |
| GroupClaim label | `src/features/group-split/GroupClaimPage.tsx:373` | `t('group_split.owner_tag')` | Renderiza "você" em pt-BR |
| GroupClaim label | `src/i18n/locales/pt-BR.json:3050` | `group_split.owner_tag: "você"` | "você" para owner no board guest |
| GroupSplit balances | `src/features/group-split/GroupSplitDetailPage.tsx:812-830` | `computeGroupBalances` → render | Mostra saldo matemático, ignora `paymentStatus` |
| GroupSplit transfers | `GroupSplitDetailPage.tsx:833-853` | `buildGroupSettlementStatus` | Mostra status `confirmed` corretamente |
| OG footer | `src/utils/image/og-footer.ts` | `composeOgImageWithFooter` | Canvas fixo 1200×630, `computeCoverCrop` force-fit → corta fotos altas |
| Edit expense | `src/features/expenses/ExpenseDetailPage.tsx:608-741` | Formulário de edição | Tem: valor, descrição, categoria, data, local, verba, carteira. **NÃO TEM:** divisão/compartilhado |
| QuickAdd split | `src/features/expenses/QuickAddPage.tsx` | Seção de split (quem pagou, dividir com) | A referência do que expor na edição |
| Payment confirm | `GroupSplitDetailPage.tsx:485-520` | `handleSetPayment` | Muda `paymentStatus` + activity log, não cria entrada financeira |

---

## §5 — Change-set, normalizado

| ID | Item | Prioridade | Gate |
|----|------|-----------|------|
| D01 | **FOUT dos ícones**: Material Symbols aparece como texto antes de carregar | P0 | G1 |
| D02 | **GroupClaim "Você"**: rótulo do dono no board de guest mostra "você" em vez de "Organizador" | P0 | G1 |
| D03 | **Saldos não refletem pagamento**: painel "Pagamentos" do group-split ignora o `paymentStatus` confirmed | P1 | G3 |
| D04 | **OG image aspect ratio**: `composeOgImageWithFooter` força 1200×630 cortando fotos altas do usuário | P1 | G2 |
| D05 | **Editar gasto sem opção de dividir**: formulário de edição não tem split/shared options | P1 | G4 |
| D06 | **Registrar entrada ao confirmar pagamento**: quando o dono confirma um pagamento no group-split, oferecer atalho para registrar como entrada na verba | P2 | G5 |

---

## §6 — Root-cause map (código ↔ mudança)

| Sintoma | Root cause | Arquivo → símbolo | Direção do fix | Gate |
|---------|------------|-------------------|----------------|------|
| Ícones aparecem como texto | Material Symbols CDN link sem `font-display` nem preload; Icon.tsx renderiza `{name}` sem guard | `index.html:38` (link tag), `src/components/Icon.tsx:12` | Adicionar `&display=block` no URL do font + CSS `.material-symbols-outlined` com `font-display: block` | G1 |
| Board guest mostra "você" pro dono | `group_split.owner_tag` = "você" em pt-BR é contextual ao dono, mas o guest vê | `pt-BR.json:3050`, `en.json`, `es.json` (group_split.owner_tag) | Mudar para "Organizador"/"Organizer"/"Organizador" | G1 |
| Painel "Pagamentos" ignora status | `computeGroupBalances` retorna `netCents` puro; o render não cruza com `paymentStatus` | `GroupSplitDetailPage.tsx:812-830` (render loop) | Cruzar `balances` com `participant.paymentStatus` para mostrar "Confirmado" quando `confirmed` | G3 |
| Fotos cortadas no WhatsApp | `composeOgImageWithFooter` usa canvas fixo 1200×630 + `computeCoverCrop` | `og-footer.ts:17-18` (`OG_IMAGE_WIDTH/HEIGHT`), `og-footer.ts:107-173` | Calcular canvas dinâmico: largura fixa 1200, altura = `1200/aspectRatio + FOOTER_HEIGHT`; imagem contain em vez de cover; foto sem crop | G2 |
| Edição de gasto sem split | `ExpenseDetailPage.tsx` edit mode não inclui picker de participantes/payer/split | `ExpenseDetailPage.tsx:608-741` | Adicionar seção de split (quem pagou + dividir com) reutilizando patterns do QuickAdd; no save, atualizar shares via `participantShareRepository` | G4 |
| Sem atalho de entrada ao confirmar | `handleSetPayment` só muda `paymentStatus` + log; não oferece criar Transaction.income | `GroupSplitDetailPage.tsx:494-519` | Após `confirmed`, mostrar sheet perguntando se quer registrar entrada na verba; usar `transactionRepository.add` com type `expense` (crédito) ou futuro `income` | G5 |

---

## §7 — Decisões + inline councils

### DEC-478 — FOUT prevention via font-display: block (DIRETO)
- **Decisão:** adicionar `&display=block` ao URL do Google Fonts Material Symbols E adicionar regra CSS `.material-symbols-outlined { font-display: block; }` em `tokens.css`. O `block` garante que o texto é invisível (até 3s) enquanto a fonte não carrega, em vez de mostrar o texto fallback.
- **Alternativa descartada:** `font-display: swap` (mostraria o texto e depois trocaria — exatamente o que não queremos). Preload sozinho não resolve porque a fonte é variável e grande. JS-based font-loading API adicionaria complexidade desnecessária.

### DEC-479 — GroupClaim owner label = "Organizador" (DIRETO)
- **Decisão:** mudar `group_split.owner_tag` de "você" para "Organizador" (pt), "Organizer" (en), "Organizador" (es). No `GroupClaimPage`, também tornar o botão do owner não-clicável **e** mostrar que é o organizador claramente. No `GroupSplitDetailPage`, a label interna do dono fica "Eu" via `shared.owner_tag` (separado), não afetado.
- **Racional:** no board de guest, "você" é ambíguo — o guest pensa que é ele. "Organizador" identifica claramente o criador da divisão.

### DEC-480 — OG image preserva aspect ratio da foto do usuário (DIRETO)
- **Decisão:** `composeOgImageWithFooter` passa a calcular a altura do canvas dinamicamente: `canvasHeight = ceil(1200 / (srcW/srcH)) + FOOTER_HEIGHT`. A foto é desenhada em contain (inteira, sem crop), o footer é colado embaixo. Quando não há foto do usuário (imagens geradas), manter o formato fixo 1200×630 como antes.
- **OG meta tags:** `og:image:height` passa a ser dinâmico no client e no Pages Function.

### DEC-481 — Saldos do group-split refletem pagamentos confirmados (DIRETO)
- **Decisão:** no painel "Pagamentos" (balances), cruzar o `participant.paymentStatus` com o saldo. Quando `confirmed`, mostrar "✓ Confirmado" ao lado do valor em vez de "Deve €63". O cálculo matemático (`computeGroupBalances`) permanece inalterado — é o display que muda.
- **Racional:** a matemática está correta; a UX é que não reflete a realidade do pagamento.

### DEC-482 — Edição de gasto inclui divisão (INLINE COUNCIL)

**Decision Brief (neutral, ≤200 words):**
O formulário de edição de gasto (ExpenseDetailPage, modo edit) não tem opções de divisão — não se pode alterar quem pagou, com quem dividir, ou se o gasto é compartilhado. O QuickAdd tem essas opções. A pergunta é: como adicionar split ao edit sem duplicar código ou criar regressões no fluxo de persistência de shares?

**Perspectives (blind):**

**Architect** — Reutilizar os componentes do QuickAdd é tentador, mas o QuickAdd opera em CRIAÇÃO (insere tx + shares) enquanto o edit opera em ATUALIZAÇÃO (modifica tx + recalcula/insere/remove shares). A direção segura: extrair a seção de split do QuickAdd como componente isolado (`SplitPicker`), e no save do edit, usar `scaleSharesToTotal` (já existe) para recalcular + `participantShareRepository` para persistir delta. Não tocar em `resolvePayerExpense`. **Rec:** Extrair componente + salvar via repositório direto. **Confidence:** HIGH. **Others miss:** O edit pode converter um gasto NÃO compartilhado em compartilhado — precisa criar shares do zero nesse caso.

**Critic** — O risco principal é o case "tornar compartilhado um gasto que não era". Isso muda o `personalCostCents`, o `isShared` flag, e pode criar dívidas. É o cenário mais perigoso. Mas o inverso (remover divisão) também precisa limpar shares e restaurar personalCost = amount. Ambos os caminhos precisam de teste. **Rec:** Implementar com teste explícito de cada transição (solo→shared, shared→solo, shared→re-shared). **Confidence:** HIGH. **Others miss:** O undo do edit vai precisar restaurar os shares anteriores.

**Red Team:** E se o componente extraído ficar acoplado ao estado do QuickAdd? O QuickAdd tem um fluxo complexo (walletChoice, fund selection, occurrence, etc.) que não deve contaminar o edit. Contra-argumento: o split picker é independente — ele só precisa da lista de participantes e retorna `{paidByParticipantId, isShared, participantIds[]}`. O risco é baixo se a interface for limpa.

**Chair Synthesis:**
- **Consensus:** Extrair a seção de split como componente reutilizável; salvar via repositório direto.
- **Tensions:** Architect quer reuso máximo; Critic quer testes para cada transição de estado.
- **Recommendation:** Implementar split picker reutilizável, testar as 3 transições (solo→shared, shared→solo, shared→re-shared), usar `calculateOwnerPersonalCost` para recalcular custo pessoal.
- **Confidence:** HIGH — o padrão de shares já é bem estabelecido no codebase.

### DEC-483 — Atalho de entrada ao confirmar pagamento (INLINE COUNCIL)

**Decision Brief (neutral, ≤200 words):**
Quando o dono confirma que recebeu um pagamento no group-split (Bia pagou €63), o usuário quer que o sistema pergunte se deseja registrar isso como entrada na verba associada. Hoje o `handleSetPayment` só muda o `paymentStatus`. A pergunta: como implementar isso dado que `TransactionType = 'income'` ainda não existe (technical-direction.md diz que é planejado mas não implementado)?

**Perspectives (blind):**

**Architect** — Sem `income` type no schema, a opção mais pragmática é usar um `Transaction` com `type: 'expense'` e valor negativo, OU criar o type `income` agora. Valor negativo é um hack. Criar `income` é o certo mas expande o escopo. Uma terceira via: criar uma `Transaction` normal de ajuste (`type: 'adjustment'`) com descrição explicativa. **Rec:** Usar `adjustment` com metadado descritivo, que é o tipo correto para entradas/saídas fora de gasto. **Confidence:** MED. **Others miss:** O schema já tem `adjustment` type — é o mecanismo de reconciliação.

**Advocate** — O usuário quer um fluxo RÁPIDO: confirma → "Registrar como entrada?" → sim → pronto. Um sheet com a verba pré-selecionada (a do evento se trip-linked, senão a ativa) e o valor já preenchido. Não precisa ser um type novo — precisa ser SIMPLES. **Rec:** Sheet de confirmação rápida com 1 toque. **Confidence:** HIGH. **Others miss:** O valor e a moeda já são conhecidos pelo contexto — não pedir nada que já se sabe.

**Red Team:** `adjustment` type é usado para reconciliação de caixa (DEC-046) — reutilizá-lo para "entrada de pagamento recebido" pode confundir os relatórios que filtram por tipo. O `adjustment` soma/subtrai do caixa; uma entrada de grupo-split é conceitualmente diferente. Contra: para o MVP, é funcional e não cria schema migration.

**Chair Synthesis:**
- **Consensus:** Sheet rápido após confirmar pagamento. Valor e verba pré-preenchidos.
- **Tensions:** Architect quer `adjustment`; Advocate quer simplicidade; Red Team alerta sobre semântica. 
- **Recommendation:** Usar `type: 'adjustment'` com `notes` explicativo (e.g., "Pagamento recebido: Bia — Eurotrip"). Marcar com metadado para futura migração quando `income` existir. A verba é a do evento trip-linked ou a da fase ativa. O sheet só aparece quando o dono é o credor (não faz sentido registrar entrada quando confirmou pagamento de outro).
- **Conditions:** O owner deve ser o credor da transferência confirmada.
- **What would flip it:** Se `income` type já estivesse implementado, usaríamos ele direto.
- **Confidence:** MED-HIGH — funcional, sem schema change, migrável.

---

## §8 — Estratégia de teste

- **Domínio puro (>90%):** `computeCoverCrop` dinâmico (aspect ratio tests), `groupPaymentTone` com `confirmed`, i18n key parity
- **Reutilizar/estender:** testes existentes de `og-footer`, `group-split`, `group-payment-status`
- **Data invariance:** totais de group-split inalterados após mudança visual de balances
- **"Suite green"** = 0 novos failures; baseline conhecida: 2 `split-live-loop` WebCrypto (passam em CI Node 22)

---

## §9 — Protocolo por milestone

5-point self-check antes de cada commit:
1. Listar ACs satisfeitas do gate
2. Nomear 3 ACs anteriores em risco de regressão e verificar
3. Rodar testes — 0 novos failures
4. Flaggar arquivos tocados fora do escopo
5. Atualizar `src/dev-log.md`

Context refresh a cada gate boundary: reler §3 (ÂNCORA) + próximo gate + dev-log.

---

## §10 — THE BUILD — Gates G0→G5

### G0 — Baseline & Setup
**Why:** Estabelecer o estado verde antes de qualquer mudança.
**Change:** `npm install`, `npm run test`, `npm run build`, `tsc --noEmit`. Documentar contagens. Seed dev-log.
**AC:**
- G0-AC1: Suite green documentada (count + known failures)
- G0-AC2: Build + tsc green
- G0-AC3: dev-log seeded com tabela desta leva
- G0-AC4: DECs 478-483 registradas como PROPOSED no decision-log

### G1 — FOUT Prevention + GroupClaim Owner Label (D01 + D02) → `2.7.8-rc`
**Why:** Dois fixes visuais rápidos de alto impacto — o FOUT afeta cada abertura do app.

**D01 — FOUT:**
- **Root cause:** `index.html:38` carrega Material Symbols sem `display=block`; `Icon.tsx` renderiza o nome como texto visível.
- **Change:** (1) Adicionar `&display=block` ao URL do Google Fonts em `index.html`. (2) Adicionar CSS em `tokens.css`: `.material-symbols-outlined { font-display: block; }` para garantia local. (3) Adicionar `<link rel="preload">` para o font file.
- **Tests:** Verificar manualmente que os ícones não piscam texto.

**D02 — Owner label:**
- **Root cause:** `group_split.owner_tag` = "você" no `pt-BR.json:3050`.
- **Change:** Mudar para "Organizador"/"Organizer"/"Organizador" nos 3 locales.
- **Tests:** i18n parity check.

**AC:**
- G1-AC1: Material Symbols URL tem `&display=block`
- G1-AC2: CSS tem `font-display: block` para `.material-symbols-outlined`
- G1-AC3: `group_split.owner_tag` = "Organizador" (pt), "Organizer" (en), "Organizador" (es)
- G1-AC4: Suite green, build green

**Commit/Deploy:** `2.7.8-rc`, deploy Pages.

### G2 — OG Image Preserva Aspect Ratio (D04) → `2.7.9-rc`
**Why:** WhatsApp cards cortam fotos do usuário — degradação introduzida na DEC-458.

**Root cause:** `og-footer.ts` usa canvas fixo 1200×630 + `computeCoverCrop` que center-crops.

**Change:**
1. `composeOgImageWithFooter` ganha um flag `preserveAspectRatio: boolean` (default `true`).
2. Quando `true`: canvas width = 1200, height = `round(1200 * (srcH/srcW)) + FOOTER_HEIGHT`. A foto é desenhada em tamanho total (`drawImage(img, 0, 0, 1200, scaledH)`), o footer ocupa os últimos `FOOTER_HEIGHT` px. **Máximo:** `og:image:height` capped em 1260 (2:1 ratio) pra não gerar imagens enormes; fotos mais altas que 2:1 usam contain com barras laterais.
3. `computeCoverCrop` fica para o caso `preserveAspectRatio: false` (imagens geradas sem foto).
4. Callers (`expense-share.ts`, `group-link.ts`) passam `preserveAspectRatio: true` quando há foto do usuário.

**Tests:** Novos testes unitários para `composeOgImageWithFooter` com aspect ratios diferentes (16:9, 4:3, 9:16, 1:1).

**AC:**
- G2-AC1: Foto 9:16 gera canvas mais alto (1200 × ~2233, capped em 1260)
- G2-AC2: Foto 16:9 gera canvas 1200 × (630+footer)
- G2-AC3: Imagem gerada (sem foto) mantém 1200×630
- G2-AC4: Footer sempre visível na parte inferior
- G2-AC5: Suite green, build green

**Commit/Deploy:** `2.7.9-rc`, deploy Pages.

### G3 — Saldos Refletem Pagamento Confirmado (D03) → `2.8.0-rc`
**Why:** Painel "Pagamentos" mostra "Deve €63" mesmo depois do dono confirmar pagamento.

**Root cause:** `GroupSplitDetailPage.tsx:812-830` renderiza `computeGroupBalances` sem cruzar com `paymentStatus`.

**Change:**
1. No render loop de `balances` (linha 812-830), cruzar cada balance com o `participant.paymentStatus`:
   - Se `confirmed` + `netCents < 0` → mostrar "✓ Confirmado" em `text-success` em vez de "Deve €X"
   - Se `marked` + `netCents < 0` → mostrar "⏳ Marcado como pago" em `text-on-surface-dim`
   - Demais: comportamento atual
2. Criar mapa `statusByPid` dos participants para lookup rápido.

**Tests:** Teste unitário garantindo que `computeGroupBalances` retorna valores inalterados (data invariance).

**AC:**
- G3-AC1: Participante com `confirmed` mostra "✓ Confirmado" no painel de saldos
- G3-AC2: Participante com `marked` mostra status "Aguardando confirmação" 
- G3-AC3: `computeGroupBalances` retorna mesmos valores (math untouched)
- G3-AC4: Suite green, build green

**Commit/Deploy:** `2.8.0-rc`, deploy Pages.

### G4 — Editar Gasto com Opções de Divisão (D05) → `2.8.1-rc`
**Why:** O formulário de edição não permite mudar a divisão — o único jeito é excluir e recriar.

**Root cause:** `ExpenseDetailPage.tsx` edit mode não inclui seção de split.

**Change:**
1. No edit mode, adicionar seção de divisão (abaixo da carteira):
   - Toggle "Gasto compartilhado" (liga/desliga `isShared`)
   - Picker "Quem pagou" (owner vs outros participantes)
   - Picker "Dividir com" (checkboxes dos participantes)
   - Modo de divisão: igual (default, único modo por agora)
2. No save, 3 transições possíveis:
   - **Solo → Shared:** criar shares via `resolvePayerExpense` (do domain), recalcular `personalCostCents`
   - **Shared → Solo:** remover shares (soft-delete), `personalCostCents = amountCents`
   - **Shared → Re-shared:** atualizar participantIds, recalcular shares via `scaleSharesToTotal`
3. Estados gerenciados por novos `editIsShared`, `editPaidByParticipantId`, `editParticipantIds`.

**Tests:** 3 testes unitários cobrindo as transições solo↔shared.

**AC:**
- G4-AC1: Edit mode mostra toggle de compartilhamento
- G4-AC2: Pode mudar quem pagou
- G4-AC3: Pode adicionar/remover participantes da divisão
- G4-AC4: Transição solo→shared cria shares e recalcula personalCost
- G4-AC5: Transição shared→solo remove shares
- G4-AC6: Suite green, build green

**Commit/Deploy:** `2.8.1-rc`, deploy Pages.

### G5 — Atalho de Entrada ao Confirmar Pagamento (D06) → `2.8.2-rc`
**Why:** Quando confirma que recebeu dinheiro, o dono quer registrar como entrada na verba sem navegar pro QuickAdd.

**Root cause:** `handleSetPayment` muda `paymentStatus` mas não oferece criar Transaction.

**Change:**
1. Após `handleSetPayment` com `status === 'confirmed'`, verificar se o owner é credor:
   - Buscar os transfers onde `toParticipantId === ownerParticipantId`
   - Se existe pelo menos 1 → abrir sheet de registro de entrada
2. Sheet de entrada rápida (`IncomeFromPaymentSheet`):
   - Valor pré-preenchido (soma dos transfers do debtor para o owner)
   - Moeda do evento
   - Verba pré-selecionada (do trip-linked event ou fase ativa)
   - Descrição: "Pagamento recebido: {nome} — {evento}"
   - Botão "Registrar entrada" + "Pular"
3. Ao confirmar, criar `Transaction` com `type: 'adjustment'`, valor negativo na verba (que funciona como crédito/entrada), `notes` com contexto.
4. i18n: 3 línguas para o sheet + labels.

**Tests:** Teste da lógica pura de detecção de credor + construção do draft de entrada.

**AC:**
- G5-AC1: Confirmar pagamento onde owner é credor abre sheet de entrada
- G5-AC2: Sheet tem valor, verba e descrição pré-preenchidos
- G5-AC3: "Registrar" cria Transaction adjustment
- G5-AC4: "Pular" fecha sem criar nada
- G5-AC5: Owner não é credor → sem sheet (silencioso)
- G5-AC6: Suite green, build green

**Commit/Deploy:** `2.8.2-rc`, deploy Pages.

---

## §11 — Terminal Safety (WSL)

- Sempre `git --no-pager ...`
- Commit via `G=/usr/bin/git; "$G" commit -m "..."`
- Nunca `less`/`more`/`vim`/`nano`/`-i`
- Pipe CLIs desconhecidos para `| cat`

---

## §12 — Definition of Done

- [ ] D01 (FOUT) — ícones nunca aparecem como texto
- [ ] D02 (Owner label) — "Organizador" no board guest
- [ ] D03 (Saldos) — pagamento confirmado refletido nos saldos
- [ ] D04 (OG ratio) — foto do usuário mantém aspect ratio
- [ ] D05 (Edit split) — edição de gasto tem opções de divisão
- [ ] D06 (Income shortcut) — confirmar pagamento oferece registrar entrada
- [ ] Suite green (0 novos failures)
- [ ] Build + tsc green
- [ ] Deploys por gate
- [ ] Brain sincronizado (dev-log, decision-log, project-status)

---

## §13 — Anti-patterns

- ❌ Mudar `computeGroupBalances` — a matemática está certa, é o display
- ❌ Criar type `income` no schema — fora do escopo (planejado separadamente)
- ❌ Duplicar código do QuickAdd — extrair/reutilizar
- ❌ `font-display: swap` — é exatamente o que causa o FOUT
- ❌ Mudar `shared.owner_tag` ("Eu") — esse é correto no contexto do dono

---

## §14 — Brain sync

- `src/dev-log.md` — cada milestone
- `brain/decision-log.md` — DEC-478→483 PROPOSED no G0, APPROVED gate a gate
- `brain/product-spec.md` — §28 atualizar com a nova label "Organizador"
- `brain/project-status.md` — ao final da leva

---

## §15 — Manual smoke matrix

| Jornada | Web | APK | iOS PWA |
|---------|-----|-----|---------|
| Abrir app → ícones não piscam texto | ◻ | ◻ | ◻ |
| Abrir link `/g/` guest → dono mostra "Organizador" | ◻ | N/A | N/A |
| Confirmar pagamento → saldo mostra "Confirmado" | ◻ | ◻ | ◻ |
| Compartilhar gasto com foto 9:16 → WhatsApp mostra foto inteira | ◻ | ◻ | ◻ |
| Editar gasto → dividir com participante | ◻ | ◻ | ◻ |
| Confirmar pagamento como credor → sheet de entrada aparece | ◻ | ◻ | ◻ |

---

## §16 — Decisões para o usuário (lock)

Nenhuma decisão pendente — todos os defaults adotados pelo conselho. **Doc ACTIVE.**

---

## §17 — GO — comece aqui

1. `cd TripPilot && npm install`
2. `npm run test` — documentar contagem
3. `npm run build && npx tsc --noEmit` — confirmar verde
4. Seed `src/dev-log.md` com a seção "Review Bilage 3"
5. Registrar DEC-478→483 como PROPOSED
6. Executar G1→G5 em ordem, sem parar até o DoD ser ALL TRUE.
