# Field Feedback — Post-AI Wave Fixes & Onboarding UX

**Status: ⏳ AWAITING LOCK** (§16 tem 1 pergunta — UX do onboarding — a travar antes de G3)
**Version cadence:** `2.10.3-rc` → `2.10.6-rc` (um por gate)
**Sibling wave:** `2026-07-10-ai-planning-wave-orchestrator.md` (CLOSED — G0→G7 completa)
**Hotfixes já aplicados (pré-orquestrador):** `startsWith` crash, copilot redirect, deploy no apex

---

## §0 — Missão

**O que é esta wave:** consertar os bugs e fechar os gaps UX encontrados no smoke test de campo do TripPilot `2.10.2-rc` (wave "AI Planning & Marketing Gaps"), MAIS auditar que tudo que o último orquestrador definiu foi realmente entregue.

**O que NÃO é:** features novas, refactoring proativo, ou reescrita de fluxos.

**A dor central:** Julio testou no device e encontrou: (1) erro de crash no copilot, (2) copilot do onboarding não ativou, (3) 2 cards de instalação simultâneos no Android, (4) carteira não salva ao editar gasto, (5) data inicial faltando no onboarding simples, (6) error page default do React Router em vez da nossa, e (7) onboarding com muitos passos — precisa de uma opção "rápido vs detalhado" clara.

**TripPilot = app de orçamento de viagem, PWA + APK, offline-first, local-first.**

**Vá para §17 para começar.**

---

## §1 — Identidade & regras absolutas

Você é o **executor**, não um coordenador.

1. **SEM subagents / SEM Task tool.** Tudo inline, nesta sessão.
2. **NÃO peça permissão para avançar.** Milestone → commit → deploy → dev-log → próximo.
3. **NÃO pare porque "é muito trabalho".** Continue até §12 ser toda TRUE.
4. **NÃO resuma — FAÇA.** Minimize narração.
5. **Código → inglês. UI → `t()` com pt-BR/en/es.**
6. **Domínio antes de UI**, teste junto com a mudança.
7. **Terminal WSL:** sempre `git --no-pager`, sempre `G=/usr/bin/git; "$G" commit -m "…"`.
8. **Brain em sincronia:** `dev-log.md` cada milestone; `decision-log.md` cada DEC nova.

---

## §2 — Ordem de leitura

1. Este doc §0–§9, depois o gate ativo em §10.
2. `src/dev-log.md`
3. `brain/decision-log.md` — DEC-489→497 (wave anterior), + novos desta wave.
4. `brain/product-spec.md` — §7 Outing Mode (Amigo Sincero, alerts), §12 PWA, §14 Activity Profiles.

---

## §3 — Non-negotiables (ÂNCORA)

```
━━━ ANCHOR (Post-AI Field Fixes) ━━━
ÂNCORA-FIX-1: Nenhum fix pode quebrar o que já funciona — regressão = defeito
ÂNCORA-FIX-2: ErrorBoundary SEMPRE captura antes do React Router
ÂNCORA-FIX-3: Install banners são MUTUAMENTE EXCLUSIVOS
ÂNCORA-FIX-4: Salvar gasto PERSISTE a carteira escolhida
ÂNCORA-FIX-5: Onboarding simples pede data inicial + final
Dinheiro = cents | Domínio = TS puro | UI = t() | Hide never delete
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

---

## §4 — Baseline — o que já existe

| Arquivo | Símbolo | O que faz | Gap |
|---------|---------|-----------|-----|
| `src/components/ErrorBoundary.tsx` | `ErrorBoundary` class | Catch de erros React com loop detection + emergency backup | Wraps `<RouterProvider>` em main.tsx, MAS o router não tem `errorElement` → React Router captura primeiro |
| `src/app/router.tsx` | `createBrowserRouter([...])` | Roteamento principal | Sem `errorElement` na raiz → mostra a error page default do React Router |
| `src/features/install/InstallNudge.tsx` | `InstallNudge` | Banner PWA install no AppShell (todos as páginas) | Aparece junto com ApkBanner |
| `src/features/dashboard/ApkBanner.tsx` | `ApkBanner` | Banner APK install no dashboard | Não checa se InstallNudge está visível |
| `src/features/install/install-nudge.ts` | `shouldShowInstallNudge()` | Gate de visibilidade do nudge PWA | Não exclui Android (quando ApkBanner aparece) |
| `src/features/expenses/ExpenseDetailPage.tsx` | `handleSaveEdit` | Salva edição do gasto (wallet, category, amount...) | L304-306: `setEditWalletId(null)` se `!resolution.movesOwnerWallet` — state assíncrono mas `editWalletId` lido na mesma closure. Investigar se o editOtherPaid guard (L328) está zerando a carteira. |
| `src/features/onboarding/OnboardingPage.tsx` | `quickStep` | Passo simplificado do onboarding | L406: só tem `endDate`, falta `startDate` (default silencioso = hoje) |
| `src/features/onboarding/OnboardingPage.tsx` | `copilotChoice` state | Escolha copilot/manual no onboarding | ✅ HOTFIXED: agora redireciona para `/planner?copilot=1` |
| `src/features/plan-copilot/PlanCopilotQuestions.tsx` | `selectOption` + `startsWith` checks | Seleção de opção e detecção de "other" | ✅ HOTFIXED: `String()` coercion + safe startsWith |

---

## §5 — Change-set, normalizado

| ID | Descrição | Prioridade | Gate |
|----|-----------|-----------|------|
| D01 | ErrorBoundary: `errorElement` no router para capturar erros de rota com a nossa UI + botão copiar erro | P0 | G1 |
| D02 | Install banners mutuamente exclusivos: Android → ApkBanner ONLY; não-Android → InstallNudge ONLY | P0 | G1 |
| D03 | Onboarding simples: adicionar campo startDate | P0 | G1 |
| D04 | Wallet update: investigar e corrigir o bug de carteira que não persiste ao editar gasto | P0 | G2 |
| D05 | Onboarding UX: flow de escolha "rápido vs detalhado" (§16 lock) | P1 | G3 |
| D06 | Auditoria: verificar que todos os ACs da wave AI Planning foram realmente entregues no código | P1 | G4 |

---

## §6 — Root-cause map (código ↔ mudança)

| Sintoma | Root cause | Arquivo → Símbolo | Direção do fix | Gate |
|---------|-----------|-------------------|----------------|------|
| Error page default do React Router ("Unexpected Application Error!") | `createBrowserRouter` em `router.tsx` não tem `errorElement` → React Router captura antes do nosso `ErrorBoundary` | `src/app/router.tsx` → `createBrowserRouter()` L135 | Adicionar `errorElement` com componente dedicado `RouteErrorPage` que mostra erro + botão copiar + reload | G1 |
| 2 cards de instalação no Android | `InstallNudge` (AppShell) e `ApkBanner` (Dashboard) são independentes; no Android não-instalado ambos mostram | `src/features/install/install-nudge.ts` → `shouldShowInstallNudge()` + `src/features/dashboard/ApkBanner.tsx` → `shouldShow()` | Na `shouldShowInstallNudge()`, retornar false quando `installAudience() === 'android'` (no Android, o ApkBanner é mais relevante) | G1 |
| Simple onboarding sem data de início | `quickStep` em `OnboardingPage.tsx` L406 só tem `endDate`; `startDate` = default silencioso | `src/features/onboarding/OnboardingPage.tsx` → `quickStep` L399-408 | Adicionar campo `startDate` no quickStep | G1 |
| Carteira não salva ao editar gasto | Suspeita: `editOtherPaid` guard no L328 (`const finalWalletId = editOtherPaid ? null : editWalletId`) ou o `setEditWalletId(null)` assíncrono do L304-306. Possibilidade: o gasto tem `paidByParticipantId` diferente do owner | `src/features/expenses/ExpenseDetailPage.tsx` → `handleSaveEdit` L247+ | Investigar com breakpoint lógico (log antes do update L329); se for o guard editOtherPaid em gasto não-compartilhado, ajustar a condição | G2 |

---

## §7 — Decisões + councils inline

### DEC-498 — Router errorElement com UI própria e botão copiar erro [field feedback 10/07]
- **Date**: 2026-07-10 · **Status**: ✅ PROPOSED
- **Decision**: adicionar `errorElement` na rota raiz do `createBrowserRouter`. O componente `RouteErrorPage` usa `useRouteError()` para capturar o erro, mostra uma UI amigável (ícone, título, mensagem) com um botão "Ver detalhes" que expande o stack trace copiável. Botão "Recarregar" e "Voltar ao início". Mesmo visual do `ErrorBoundary.tsx` existente.
- **Rationale**: o `ErrorBoundary` de React wraps o `RouterProvider`, mas o React Router captura erros em seus route components ANTES de propagá-los ao boundary externo. Sem `errorElement`, mostra a página default.

### DEC-499 — Install banners mutuamente exclusivos por plataforma [field feedback 10/07]
- **Date**: 2026-07-10 · **Status**: ✅ PROPOSED
- **Decision**: `shouldShowInstallNudge()` retorna `false` quando `installAudience() === 'android'`. No Android, o `ApkBanner` é o único caminho de instalação mostrado (APK > PWA add-to-homescreen para a experiência completa com notificações e widgets). Em iOS/desktop/unknown, o `InstallNudge` é o único.
- **Rationale**: 2 banners simultâneos confundem o usuário e poluem a UI.

### DEC-500 — Campo startDate no onboarding simples [field feedback 10/07]
- **Date**: 2026-07-10 · **Status**: ✅ PROPOSED
- **Decision**: adicionar `startDate` como campo no `quickStep`, acima de `endDate`. Default: dia de hoje (pré-preenchido). Validação: `startDate` && `endDate` && `startDate <= endDate`.

---

## §8 — Test strategy

- **Domain-pure:** sem novos domain functions nesta wave — testes focam em integração (se wallet persiste, se `shouldShowInstallNudge` retorna false no Android).
- **Unit:** `shouldShowInstallNudge` com mock de `installAudience`.
- **"Full suite green":** baseline = 325 files / 3335 tests / 0 failures (mesma da wave anterior).

---

## §9 — Per-milestone protocol

A cada milestone: 5-point self-check (ACs, 3 regressões, tests, scope, dev-log). A cada gate: re-ler §3 + próximo gate + dev-log. ANCHOR + CURRENT STATE.

---

## §10 — THE BUILD — Gates G0→G4

### G0 — Setup & Baseline (2.10.2-rc, no bump)

**Why:** Documentar o ponto de partida e garantir que os hotfixes estão no ar.

**Tasks:**
1. `cd TripPilot && npm install`
2. `npm run test` — record count
3. `npm run build` + `tsc --noEmit`
4. Confirmar que apex `trippilot.pages.dev/version.json` mostra `2.10.2-rc`
5. Seed dev-log com nova wave
6. Add DEC-498→500 como PROPOSED no decision-log

**Commit: nenhum (dev-log + DECs apenas)**

---

### G1 — Quick Fixes: Error Page + Install Banner + Start Date (D01, D02, D03) → 2.10.3-rc

**Why:** Três fixes cirúrgicos que eliminam os bugs mais visíveis.

**Change D01 (errorElement):**
- Criar `src/components/RouteErrorPage.tsx` — usa `useRouteError()` do React Router; UI: ícone de erro, título (i18n), mensagem, botão "Ver detalhes" que revela stack trace num `<pre>` com botão copiar (clipboard API), "Recarregar" + "Voltar ao início"
- Em `src/app/router.tsx`: adicionar `errorElement: <RouteErrorPage />` na rota raiz
- i18n: 3 idiomas (errors.route_error_title, errors.route_error_message, errors.route_copy_error, errors.route_copied, errors.route_show_details, errors.route_hide_details, errors.route_go_home)

**Change D02 (install banners):**
- Em `src/features/install/install-nudge.ts` → `shouldShowInstallNudge()`: adicionar early return `false` quando `installAudience() === 'android'`
- Atualizar o teste unitário `install-nudge.test.ts`

**Change D03 (startDate no simples):**
- Em `OnboardingPage.tsx` → `quickStep`: adicionar campo `<Field label={t('onboarding.start_date')} type="date" value={startDate} onChange={setStartDate} />` antes do endDate
- Pré-preencher `startDate` com `localDateString(new Date())` no useState initializer (se flow === 'quick')
- Atualizar o validator do quickStep: `() => Boolean(totalAmount && startDate && endDate && startDate <= endDate)`

**AC:**
- [ ] G1-AC1: Erro em route component mostra RouteErrorPage com stack trace copiável (não a default do React Router)
- [ ] G1-AC2: No Android, apenas ApkBanner aparece (InstallNudge suprimido)
- [ ] G1-AC3: Em iOS/desktop, apenas InstallNudge aparece (ApkBanner não se aplica por design)
- [ ] G1-AC4: Onboarding simples tem campo de data inicial pré-preenchido com hoje
- [ ] G1-AC5: Suite verde

**Commit + deploy + version → 2.10.3-rc**

---

### G2 — Wallet Update Bug (D04) → 2.10.4-rc

**Why:** O usuário não consegue atualizar a carteira de um gasto existente.

**Investigation plan:**
1. Ler `ExpenseDetailPage.tsx` `handleSaveEdit` completo
2. Rastrear o valor de `editWalletId` → `finalWalletId` → `transactionRepository.update()`
3. Verificar se o problema é:
   a) `editOtherPaid` guard zerando a carteira em gasto não-compartilhado
   b) `setEditWalletId(null)` no L304-306 afetando a leitura (React state)
   c) O componente de seleção de carteira não chamando `setEditWalletId` corretamente
   d) A leitura após o save não refletindo o update (cache stale)

**Change:** Corrigir com base na investigação. Possíveis fixes:
- Se for (a): ajustar a condição `editOtherPaid` para excluir gastos do próprio owner
- Se for (b): usar `let localWalletId = editWalletId;` antes do bloco async e mutar local
- Se for (c): verificar o componente de wallet selection
- Se for (d): forçar refresh do state após o update

**AC:**
- [ ] G2-AC1: Editar a carteira de um gasto e salvar persiste o valor corretamente
- [ ] G2-AC2: O warning "X gastos sem carteira informada" desaparece após corrigir

**Commit + deploy + version → 2.10.4-rc**

---

### G3 — Onboarding UX: Rápido vs Detalhado (D05) → 2.10.5-rc (§16 lock)

**Why:** O onboarding tem muitos passos e o simples perde informação. O usuário quer uma escolha explícita logo no início.

**Change (pós §16 lock):**
Depende da decisão do council (§16). A direção provável:
- Adicionar um step de escolha logo após o passo de identidade: "Como quer começar?"
  - "Rápido — crio a viagem e depois ajusto pelo app" (mantém o quickStep atual)
  - "Detalhado — configuro tudo agora" (mantém o flow detalhado atual)
- O copilot offer aparece apenas no flow detalhado quando há chips selecionados

**AC:**
- [ ] G3-AC1: Step de escolha rápido/detalhado aparece logo no início
- [ ] G3-AC2: "Rápido" leva ao quickStep com menos campos
- [ ] G3-AC3: "Detalhado" leva ao flow completo
- [ ] G3-AC4: i18n em 3 idiomas

**Commit + deploy + version → 2.10.5-rc**

---

### G4 — Auditoria da Wave AI Planning (D06) → 2.10.6-rc (se houver fix)

**Why:** Verificar que os ACs G1→G7 do orquestrador anterior foram realmente implementados.

**Tasks:**
1. Ler cada AC do `2026-07-10-ai-planning-wave-orchestrator.md` §10
2. Para cada AC, verificar no código que a feature existe e funciona
3. Listar quaisquer gaps encontrados
4. Corrigir gaps menores inline; gaps maiores → novo gate ou nova wave

**AC:**
- [ ] G4-AC1: Relatório de auditoria gerado com status de cada AC
- [ ] G4-AC2: Gaps menores corrigidos
- [ ] G4-AC3: Suite verde

**Commit + deploy (version bump apenas se houver code change)**

---

## §11 — Terminal safety (WSL)

- Sempre `git --no-pager log/diff/show/status`
- Commit: `G=/usr/bin/git; "$G" commit -m "…"`
- Nunca `less`, `more`, `vim`, `nano`, flags `-i`

---

## §12 — Definition of Done

- [ ] G1-AC1→AC5 (error page + install + start date)
- [ ] G2-AC1→AC2 (wallet fix)
- [ ] G3-AC1→AC4 (onboarding UX) [dependente do §16 lock]
- [ ] G4-AC1→AC3 (auditoria)
- [ ] Suite verde (0 failures novas)
- [ ] Build OK (`npm run build` + `tsc --noEmit`)
- [ ] Deploy OK (Cloudflare Pages)
- [ ] Brain atualizado (decision-log, dev-log)

---

## §13 — Anti-patterns

- ❌ Mudar fluxo do copilot/IA (wave anterior fechou)
- ❌ Refatorar código adjacente sem justificativa
- ❌ Adicionar features novas (esta wave é só fix + UX)
- ❌ Alterar lógica de cálculo financeiro
- ❌ Ignorar o `editOtherPaid` guard sem entender o motivo (DEC-114)

---

## §14 — Brain sync

- `src/dev-log.md`: cada milestone
- `brain/decision-log.md`: DEC-498→500+ PROPOSED → APPROVED
- Sem mudança em `product-spec.md` (exceto se D05 mudar a spec do onboarding)

---

## §15 — Manual smoke matrix

| Jornada | Android APK | Android Browser | iOS |
|---------|-------------|-----------------|-----|
| Dashboard → erro no copilot → error page bonita | ✅ | ✅ | ✅ |
| Dashboard → apenas 1 card de install | — (APK only) | ✅ (ApkBanner) | ✅ (InstallNudge) |
| Editar gasto → mudar carteira → salvar | ✅ | ✅ | ✅ |
| Onboarding simples → data inicial aparece | ✅ | ✅ | ✅ |

---

## §16 — Decisões para o usuário (lock)

### L-ONBOARDING-FLOW — Onboarding: como apresentar rápido vs detalhado?

**Problema:** O onboarding tem muitos passos e o simples perde informação. O Julio quer uma escolha clara logo no início.

**Opções:**

**A) Step de escolha na identidade** — Após o nome, um passo com 2 botões: "Rápido" e "Detalhado". Rápido = quickStep (valor + datas + moeda). Detalhado = todos os passos atuais. O copilot offer aparece apenas no detalhado com chips selecionados.

**B) Consolidar tudo em um step** — Um único step com os campos essenciais (nome, datas, valor, moeda) e um acordeão "Personalizar mais" que abre os campos avançados (fases, ritmo, picos, perfis de atividade).

**C) Onboarding adaptativo** — Mostrar apenas valor+datas+moeda; depois da primeira semana de uso, um prompt "Quer personalizar sua viagem?" oferece o detalhamento. Sem escolha explícita no início.

**Recomendação do council (run inline durante a execução):** TBD — será rodado no G3.

**Default adotado (se Julio não travar antes):** Opção A (step de escolha).

---

## §17 — GO — Start here

```bash
cd TripPilot && npm install
npm run test 2>&1 | tail -5
npm run build
tsc --noEmit
```

Depois: seed dev-log, confirmar deploys, DEC-498→500 como PROPOSED. **Então executar G1→G4 na ordem.**

**ANCHOR block (paste every gate):**
```
━━━ ANCHOR (Post-AI Field Fixes) ━━━
ÂNCORA-FIX-1: Nenhum fix pode quebrar o que já funciona
ÂNCORA-FIX-2: ErrorBoundary SEMPRE captura antes do React Router
ÂNCORA-FIX-3: Install banners MUTUAMENTE EXCLUSIVOS
ÂNCORA-FIX-4: Salvar gasto PERSISTE a carteira
ÂNCORA-FIX-5: Onboarding simples pede data inicial + final
CURRENT STATE: Gate=G0 | Last=start | Tests=baseline | Risks=none | Scope=on-track
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

Confirme em UMA linha que leu o orquestrador e iniciou G0 — depois continue sem esperar resposta.
