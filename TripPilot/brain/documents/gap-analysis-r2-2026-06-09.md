# TripPilot — Gap Analysis R2 (pós-uso real)

> **Status: RESOLVIDO em 2026-06-09 — 23/23 itens implementados e deployados em v0.3.0. Ver `src/gap-fix-log-r2.md`.**

> **Data**: 2026-06-09 · **Baseline**: 156/156 testes unitários verdes · typecheck limpo · build OK (v0.2.0)
> **Referências**: `gap-analysis-2026-06-09.md` (R1, 36 gaps) · `src/gap-fix-log.md` (fixes + DEC-061..070)
> **Fonte nova**: 14 achados de campo de uma viagem real do Julio
> **Verificação runtime**: dev server + Playwright headless (troca de tema ao vivo testada de verdade, screenshot do tema claro capturado) — zero código de produção modificado

---

## 1. Resumo Executivo

### Estado geral

A base saída da R1 está **sólida**: os 36 gaps continuam resolvidos (zero regressões), 156 testes verdes, typecheck e build limpos. Os achados de campo não derrubam a fundação — eles revelam (a) **dois bugs reais de tema claro e escopo de fase**, (b) **um problema crítico de distribuição** (service worker prende usuários em versão velha — explica por que o Julio viu comportamentos já corrigidos), e (c) **um conjunto coerente de features de planejamento** que o schema já antecipava (`plannedOccurrences` existe desde DEC-043 sem UI).

### Números


| Categoria                                                  | Quantidade                                                                               |
| ---------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| Regressões da R1                                           | **0** (36/36 mantidos)                                                                   |
| Bugs de campo investigados                                 | 7 (FIELD-03/04/10/11/12/13/14) — todos com root cause ou NÃO REPRODUZIDO com evidência   |
| Achados de campo com root cause confirmado no código atual | 5 (FIELD-04, 10, 11, 12b, 13, 14)                                                        |
| Achados NÃO REPRODUZIDOS no código atual (bundle velho)    | 2 (FIELD-03 card, FIELD-12a troca ao vivo) — mas o problema de produto subjacente é real |
| Gaps novos da re-auditoria (GAP-R2)                        | **9** (1 crítico, 1 alto, 4 médios, 3 baixos)                                            |
| Features desenhadas                                        | 7 (FIELD-01/02/05/06/07/08/09)                                                           |
| Decisões PROPOSED aguardando o Julio                       | **13** (DEC-071..083)                                                                    |


### Top 5 mais críticos

1. **[GAP-R2-001] Service worker prende o usuário na versão velha** — cache-first em `index.html` + atualização 100% silenciosa (`console.info` apenas). É a causa raiz provável de o Julio ter visto na viagem dois comportamentos que o v0.2.0 já corrige (FIELD-03 e FIELD-12a). Enquanto não for corrigido, **nenhum fix futuro chega ao usuário de forma confiável**.
2. **[FIELD-12b] Tema claro: BottomNav invisível** — `BottomNav.tsx:60` com fundo dark hardcoded; confirmado em screenshot runtime: ícones escuros sobre barra escura. + 11 outras cores dark hardcoded em 5 arquivos (GAP-R2-002) + tema nunca aplicado em rotas fora do AppShell (GAP-R2-003).
3. **[FIELD-04] Sessão única contamina Planner cross-phase e Perfis** — três causas combinadas: perfil custom global criado pela sessão (`OutingPage.tsx:170-176`), Planner semeia e PERSISTE allocations de todos os perfis em qualquer fase aberta (`PlannerPage.tsx:222` e `264-289`), forecasting sem escopo de fase (`forecasting.ts:59-61`).
4. **[FIELD-03] Pendência sem fluxo de confirmação** — DEC-019 (impacto provisório até confirmação) nunca ganhou o estado de confirmação no modelo; o critério atual (DEC-063) é derivado de dívida, não de confirmação. Proposta DEC-071 substitui.
5. **[FIELD-05] Eventos planejados** — a maior feature; `plannedOccurrences` já existe no schema com `phaseId`, `plannedDate`, `estimatedCostCents`, `isConfirmed` — o design (DEC-072) estende com multi-dia, tipo e reserva, e resolve FIELD-04 por definição (evento único ≠ perfil recorrente).

---

## 2. Regressão da R1 — 36/36 mantidos

Verificação por inspeção do código atual (greps e leituras nesta sessão; runtime test para GAP-013). Nenhuma regressão.


| Gap                                  | Status    | Evidência no código atual                                                                                                                                            |
| ------------------------------------ | --------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| GAP-001 saque banco→cash             | ✅ mantido | `createTransferTransaction` em QuickAddPage + `wallet-orchestrators.ts`                                                                                              |
| GAP-002 revisão de encerramento      | ✅ mantido | SessionReview em `OutingPage.tsx` (itens editáveis, carteira em lote, típica/especial)                                                                               |
| GAP-003 backup 21 tabelas            | ✅ mantido | `backup.ts` exporta sessions, settlements, scenarioPlans, plannedOccurrences, forecastSnapshots, futurePhaseReservePolicies, alertRules, devices; `BACKUP_VERSION=2` |
| GAP-004 import merge                 | ✅ mantido | `mergeBackupData` por revision/updatedAt em `backup-orchestrators.ts`, transação única                                                                               |
| GAP-005 alertas progressivos         | ✅ mantido | `getProgressiveAlerts` + `navigator.vibrate` (`OutingPage.tsx:198`) + `firedAlertPercents`                                                                           |
| GAP-006 registrar total atual        | ✅ mantido | `calculateReportedTotalDiff` em OutingPage                                                                                                                           |
| GAP-007 learning engine              | ✅ mantido | `updateProfileFromTransaction` chamado em `outing-orchestrators.ts:51`                                                                                               |
| GAP-008 future floor manual          | ✅ mantido | Campo na criação de fundo + edição por link em `FundsPage.tsx`                                                                                                       |
| GAP-009 envelopes                    | ✅ mantido | Painel expandido com CRUD de envelopes em `FundsPage.tsx`                                                                                                            |
| GAP-010 transferência                | ✅ mantido | `createTransferTransaction`, origem≠destino validado (QuickAddPage)                                                                                                  |
| GAP-011 reconciliação                | ✅ mantido | `reconcileWallet` importado e usado em `WalletsPage.tsx:8,88`                                                                                                        |
| GAP-012 split na sessão              | ✅ mantido | `buildSharesWithPayer` em domain/splitting, BottomSheet na OutingPage                                                                                                |
| GAP-013 tema ao vivo                 | ✅ mantido | **Runtime test**: clicar "Claro" → `data-theme="light"` aplicado SEM reload, `--surface` flipou para `#F5F0EB`. O relato FIELD-12a vem de bundle velho (ver §3)      |
| GAP-014 idioma no boot               | ✅ mantido | `i18n.changeLanguage` em `main.tsx` + live no AppShell                                                                                                               |
| GAP-015 config de sessão             | ✅ mantido | SessionStartConfigForm (3 limites, avg drink, quick values)                                                                                                          |
| GAP-016 critério de pendência        | ✅ mantido | `findPendingSharedTransactions` (`splitting.ts:284-307`) — netting zera o card (verificado por teste scratch)                                                        |
| GAP-017 pools globais por scope      | ✅ mantido | `scope === 'global'` em DashboardPage                                                                                                                                |
| GAP-018 pools por fase               | ✅ mantido | `getAvailablePoolsForPhase` em budget.ts + QuickAddPage                                                                                                              |
| GAP-019 edge cases DEC-053           | ✅ mantido | Sheets orçamento-zerado / over-max 15min / sessão cruzando fase                                                                                                      |
| GAP-020 contadores ligados ao plano  | ✅ mantido | `calculateOccasionForecasts` ligado ao ScenarioPlan (DashboardPage) — mas ver GAP-R2-006 (escopo de fase)                                                            |
| GAP-021 CSV 19 colunas               | ✅ mantido | Hora, Quem pagou, Custo pessoal etc. em `csv-export.ts`                                                                                                              |
| GAP-022 settings completo            | ✅ mantido | Moeda padrão, reminder 7/14 dias, banner via `isBackupReminderDue`                                                                                                   |
| GAP-023 Sobre                        | ✅ mantido | Item "Sobre" em `MorePage.tsx:35` → `/about` com `APP_VERSION`                                                                                                       |
| GAP-024 header navegável             | ✅ mantido | Nome da fase → /trip, sino → /shared (DashboardPage)                                                                                                                 |
| GAP-025 zero diálogos nativos        | ✅ mantido | `rg "alert(                                                                                                                                                          |
| GAP-026 carteiras no onboarding      | ✅ mantido | Default credit card + cash opcional em `onboarding.ts:105-112`                                                                                                       |
| GAP-027 gasto retroativo             | ✅ mantido | datetime-local opcional no QuickAdd                                                                                                                                  |
| GAP-028 quick values unificados      | ✅ mantido | `DEFAULT_QUICK_ADD_VALUES_CENTS` no domain                                                                                                                           |
| GAP-029 Zod no import                | ✅ mantido | `backupFileSchema.safeParse` em `backup.ts:172`                                                                                                                      |
| GAP-030 orquestradores               | ✅ mantido | 7 orchestrators em `src/domain/orchestrators/`                                                                                                                       |
| GAP-031 índices Dexie v2             | ✅ mantido | `version(2)` + índices compostos + `db.on('populate')`                                                                                                               |
| GAP-032 settle parcial + simplificar | ✅ mantido | Sheet com valor parcial (`SharedExpensesPage.tsx:53-76`), `suggestSimplifiedSettlements` real                                                                        |
| GAP-033 i18n 100%                    | ✅ mantido | en/es/pt-BR com 390 chaves cada (paridade verificada)                                                                                                                |
| GAP-034 deps removidas               | ✅ mantido | zustand e react-hook-form ausentes do `package.json`                                                                                                                 |
| GAP-035 demo rica                    | ✅ mantido | Shares, sessão completed, settlement parcial em `demo-data.ts:221+`                                                                                                  |
| GAP-036 toast offline-ready          | ✅ mantido | `pwa.ts:18-19` toast na primeira ativação; precache de assets no `sw.js`                                                                                             |


**Atenção especial pedida no prompt (GAP-013/DEC-066)**: investigado a fundo com teste runtime real (Playwright contra dev server). A troca de tema ao vivo **funciona** no código atual — `useLiveSettings.ts` (liveQuery no `app-settings`) + AppShell aplicam `data-theme` sem reload. Não regrediu. O que o Julio viu é outra coisa (ver FIELD-12 em §3).

---

## 3. Achados de Campo — Bugs

### [FIELD-03] Pendência de confirmação sem fluxo de confirmação — ALTO

**Relato (resumo)**: dois gastos de mercado divididos com a irmã (€20 cada, um pago por cada uma). Dívidas se anulam (correto no menu), mas o dashboard continua mostrando "2 gastos pendentes de confirmação" sem nenhuma forma de confirmar.

**Investigação no código atual (v0.2.0)**:

- Critério de pendência: `findPendingSharedTransactions` (`src/domain/splitting/splitting.ts:284-307`). Linha 291-292: calcula as dívidas e **se `debts.length === 0` retorna `[]`** — com netting natural (€20 ↔ €20), o card some.
- Verificado com teste scratch (cenário exato do relato): `calculateDebts` zera e `findPendingSharedTransactions` retorna vazio. **O sintoma do card NÃO REPRODUZ no v0.2.0.**
- O critério pré-fix (GAP-016, v0.1.x) era `settlementId === null` por share → mostrava os 2 gastos para sempre, **exatamente o que o Julio viu**. Conclusão: o dispositivo dele rodava o bundle velho (ver GAP-R2-001 — o SW segura versões antigas).

**Root cause do problema de produto (real e presente no v0.2.0)**:

- **DEC-019** ("impacto provisório até confirmação") **nunca foi implementado**: não existe estado de confirmação no modelo. `ParticipantShare` (`src/domain/types/participant-share.ts`) tem apenas `isPaid: boolean` — nada de confirmado/rejeitado.
- **DEC-063** definiu pendência como derivada de dívida/settlement — um proxy. O relato mostra que o usuário entende "pendente de confirmação" como **ação esperada dele** ("confirmar ou não os gastos"), e o app não oferece essa ação em lugar nenhum (zero UI de confirmação; o card em `DashboardPage.tsx:423` só navega para `/shared`).

**Fix necessário (acionável)** → ver DEC-071 (§6):

1. `ParticipantShare.confirmationStatus: 'pending' | 'confirmed' | 'rejected'` (migração Dexie v3, default `'confirmed'` para dados existentes — não quebrar histórico).
2. Card do dashboard = shares de terceiros com `confirmationStatus === 'pending'`; tap → tela/sheet de confirmação por gasto (confirmar / rejeitar / ajustar valor).
3. `calculateDebts` considera apenas shares confirmados; rejeitado devolve o valor ao custo pessoal do pagador.
4. Card some quando todos confirmados — independente de settlement ou netting.

**Esforço**: M · **DECs afetados**: DEC-019 (finalmente implementado), DEC-063 (substituído por DEC-071)

---

### [FIELD-04] Sessão única "Parral" contamina Planner cross-phase e Perfis — ALTO

**Relato (resumo)**: saída custom "Parral" (festa única, valor seguro 50). O Parral apareceu no Planner da OUTRA fase já com contagem 1, e também no menu Perfis de Atividade.

**Root cause (3 causas combinadas, todas confirmadas no código)**:

1. **Sessão custom cria ActivityProfile global à viagem**: `OutingPage.tsx:170-176` (`handleStartCustomSession`) chama `createCustomActivityProfile`, que persiste um perfil com `tripId` (sem escopo de fase) e `expectedFrequencyPerPhase: 1` (`src/domain/profiles/profiles.ts:97`). Perfis são listados por trip → "Parral" aparece em Perfis de Atividade.
2. **Planner semeia TODOS os perfis em QUALQUER fase**: hidratação em `PlannerPage.tsx:220-228` itera `profilesRef.current` (todos os perfis da viagem) e, sem allocation item salvo, usa o fallback da linha 222: `item?.quantity ?? p.expectedFrequencyPerPhase ?? 3`. Para o Parral isso é **1 — o "1" misterioso da outra fase vem daqui**, não de dado salvo.
3. **A contaminação se torna persistente**: o auto-save (`persist`, `PlannerPage.tsx:264-289`) cria `ScenarioAllocationItem` para **todo perfil sem item** na fase aberta (linha 277-288). Abrir o Planner na outra fase grava o Parral lá para sempre.
4. (Agravante nos contadores) `calculateOccasionForecasts` (`src/domain/forecasting/forecasting.ts:59-61`) faz `allocations.find(...)` sem filtrar por fase/plano e soma transações da viagem inteira → contadores do dashboard misturam fases (registrado como GAP-R2-006).

**Fix necessário (acionável)**:

- Produto: evento único ≠ perfil recorrente → sessão "one-off" deve criar/ligar um `PlannedOccurrence`, não um ActivityProfile (design conjunto com FIELD-05, DEC-072/073).
- Técnica imediata independente do design: Planner não semeia nem persiste perfis sem item salvo na fase que não estejam habilitados para ela (DEC-073/074); forecasting phase-scoped (GAP-R2-006).

**Esforço**: M (bug técnico) + faz parte do bloco FIELD-05 · **DECs afetados**: DEC-043 (reativado), DEC-006

---

### [FIELD-10] Texto selecionável no touch — MÉDIO

**Relato (resumo)**: tocar em textos que não são botões seleciona o texto como navegador, não parece app.

**Root cause**: ausência total de CSS de mobile feel. Verificado: nenhuma ocorrência de `user-select`, `-webkit-tap-highlight-color` ou `touch-action` em `src/styles/tokens.css`, `src/styles/globals.css` ou qualquer componente. O default do navegador (texto selecionável + flash azul de tap) vale para o app inteiro.

**Fix necessário (acionável)** → DEC-081:

```css
/* globals.css */
body {
  user-select: none;
  -webkit-user-select: none;
  -webkit-tap-highlight-color: transparent;
}
input, textarea, [contenteditable] {
  user-select: text;
  -webkit-user-select: text;
}
button, a, [role="button"] {
  touch-action: manipulation;
}
```

**Esforço**: S · **DECs afetados**: nenhum (novo: DEC-081)

---

### [FIELD-11] Fundos e fases sem editar/apagar — MÉDIO

**Relato (resumo)**: dá para adicionar fundos e fases, mas não editar/apagar fundos nem apagar fases.

**Root cause (CRUD intencionalmente incompleto, confirmado)**:

- `FundsPage.tsx`: criação de fundo + edição de future floor/envelopes existem; **não há UI para renomear/editar valor do fundo, apagar fundo ou remover link de fase**. (R1 já anotava em F-23; nunca entrou em escopo.)
- `TripEditPage.tsx`: edita nome/datas de trip e fases, adiciona fase; **não há excluir fase**.
- Bônus encontrado na investigação: o ícone de apagar envelope usa classe inexistente `text-danger` (`FundsPage.tsx:319`) — o `tailwind.config.ts` define `error`, não `danger` → ícone sem a cor pretendida (GAP-R2-007).

**Regras de segurança necessárias (para o fix)** → DEC-080:

- **Fundo**: soft delete (`deletedAt`) só se não houver transações ativas no pool; com transações → bloquear com explicação OU oferecer reatribuição das transações para outro pool. Links, envelopes e future floor policies do fundo são soft-deleted em cascata.
- **Fase**: soft delete só se não houver transações/sessões na fase; com dados → bloquear com explicação ("mova ou apague os X gastos primeiro"). Reordenar `order` das fases restantes. Nunca apagar a última fase (trip precisa de ≥1).
- Tudo via BottomSheet de confirmação (GAP-025/DEC padrão), nunca diálogo nativo.

**Esforço**: M · **DECs afetados**: nenhum existente (novo: DEC-080)

---

### [FIELD-12] Tema claro: não aplica na hora + bottom bar invisível — ALTO

**Relato (resumo)**: (a) selecionar tema claro exige recarregar; (b) no claro, a barra inferior fica escura e os ícones invisíveis.

**Investigação (com teste runtime real)**:

**(a) "Não muda na hora" — NÃO REPRODUZIDO no v0.2.0.** Teste Playwright contra o dev server: clicar "Claro" em `/settings` → `data-theme="light"` aplicado imediatamente, `--surface` flipou para `#F5F0EB`, **sem reload**. A cadeia `SettingsPage → appSettingsRepository.update → useLiveSettings (liveQuery) → AppShell setAttribute` funciona. O comportamento relatado é **exatamente o do v0.1.x pré-GAP-013** → bundle velho servido pelo SW (GAP-R2-001). Mesma explicação do FIELD-03.

**(b) Bottom bar invisível no claro — CONFIRMADO no v0.2.0, com evidência visual.** Root cause: `src/components/BottomNav.tsx:60`:

```tsx
style={{ background: '#0F1419e6', borderColor: '#EDE8E008' }}
```

Fundo dark **hardcoded** que não responde ao tema. Medição runtime no tema claro: nav com `rgba(15,20,25,0.9)` (escuro) e ícones inativos com `rgba(26,32,40,0.44)` (`--on-surface-faint` do tema claro = escuro) → **escuro sobre escuro, invisível**. Screenshot confirma: só o item ativo (laranja) é visível.

**Auditoria completa do tema claro (todos os componentes)** — outras cores dark hardcoded encontradas (GAP-R2-002):


| Arquivo:linha                                            | Valor                                         | Impacto no claro                                        |
| -------------------------------------------------------- | --------------------------------------------- | ------------------------------------------------------- |
| `BottomNav.tsx:60`                                       | `#0F1419e6` + `#EDE8E008`                     | **Crítico — barra invisível**                           |
| `index.html:6`                                           | `<meta name="theme-color" content="#0F1419">` | Status bar do Android fica escura no tema claro         |
| `FAB.tsx:90`                                             | overlay `#0A0F14f0`                           | Aceitável como scrim, mas não tokenizado                |
| `Toast.tsx:24`                                           | borda `#EDE8E020`                             | Borda quase invisível no claro                          |
| `DashboardPage.tsx:221`                                  | borda `#EDE8E010`                             | Idem                                                    |
| `OutingPage.tsx:1080,1191,1247`                          | fundos `#EDE8E00a/06`, glow `#EDE8E060`       | Chips/realces somem no claro                            |
| `PlannerPage.tsx:592,642,784,801,860`                    | fallback `#EDE8E0`, fundos `#EDE8E015/06`     | Chips/realces somem no claro                            |
| Contadores do dashboard (`DashboardPage.tsx:365,378...`) | `iconBg="#C75B3918"` etc.                     | Funciona nos dois temas (cor de marca translúcida) — ok |


**(c) Achado adicional**: rotas fora do AppShell (`router.tsx:61-67` — `/quick-add`, `/outings/`*, `/simulator`, welcome/onboarding) nunca aplicam `data-theme`. Em reload direto nessas rotas (PWA restaura onde parou), usuário de tema claro vê tudo dark (GAP-R2-003).

**Fix necessário (acionável)** → DEC-083:

1. `BottomNav.tsx:60` → tokens (`var(--surface-container-high)` + borda tokenizada) — 1 linha.
2. Varredura das 12 ocorrências hardcoded acima → tokens ou variáveis com variante clara.
3. Mover a aplicação de `data-theme` + idioma para o nível raiz (`main.tsx` ou layout raiz que envolva TODAS as rotas), mantendo o liveQuery.
4. `theme-color` dinâmica via JS conforme o tema.

**Esforço**: S/M · **DECs afetados**: DEC-066 (estendido para o app inteiro), DEC-022 (tokens)

---

### [FIELD-13] Gastos recentes do dashboard não clicáveis — BAIXO

**Relato (resumo)**: clicar num gasto recente da tela inicial deveria abrir o detalhe.

**Root cause**: `DashboardPage.tsx:545-558` — cada item recente é um `<div>` puro, sem `onClick`, sem `navigate`, sem role de botão. A rota de destino **já existe**: `/expenses/:id` (`router.tsx:47`, `ExpenseDetailPage`).

**Fix**: envolver o item em botão com `onClick={() => navigate(`/expenses/${tx.id}`)}` + estado pressionado (`btn-press` já existe no design system). **Esforço**: S.

---

### [FIELD-14] Contadores do dashboard não levam à lista filtrada — BAIXO

**Relato (resumo)**: clicar no ícone de Bar/Mercado deveria abrir a lista de gastos filtrada por aquele perfil.

**Root cause (2 pontas)**:

1. `OccasionCounter` (`DashboardPage.tsx:575-600`) não aceita nem dispara `onClick` — é um card estático (usos nas linhas 359-390).
2. `ExpenseListPage.tsx` tem filtro interno por estado, mas **não lê query params** — não há como chegar pré-filtrado por URL (`/expenses?profile=<id>` não existe).

**Fix**: (a) `onClick` no counter → `navigate('/expenses?profile=' + profileId)`; (b) `ExpenseListPage` inicializa o filtro de `useSearchParams` (perfil e categoria). **Esforço**: S. Se o carrossel (FIELD-06) for aprovado, fazer junto.

---

## 4. Gaps Novos da Re-Auditoria (ninguém relatou)


| ID             | Sev         | Fonte                   | Estado atual                                                                                                                                                                                                                                                                                                                            | O que falta                                                                                                                                                      | Esforço |
| -------------- | ----------- | ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------- |
| **GAP-R2-001** | **CRÍTICA** | PASS 5 (PWA)            | `public/sw.js`: cache-first para TODO GET incluindo `index.html` (linhas 44-56); `pwa.ts:20-22`: nova versão ativada gera só `console.info('[SW] New version available')` — usuário nunca fica sabendo e continua no bundle velho até refresh duplo. **Explica FIELD-03 e FIELD-12a terem sido vistos em viagem após o deploy v0.2.0.** | Network-first (com fallback offline) para `index.html`; toast/banner "Nova versão disponível — toque para atualizar" que chama `skipWaiting` + reload. → DEC-082 | S/M     |
| **GAP-R2-002** | ALTA        | PASS 3 (tema claro)     | 12 cores dark hardcoded em 6 arquivos + `meta theme-color` fixa (tabela completa em FIELD-12). Verificado por grep `#0F1419                                                                                                                                                                                                             | #0A0F14                                                                                                                                                          | #EDE8E0 |
| **GAP-R2-003** | MÉDIA       | PASS 3 (rotas)          | `router.tsx:61-67`: `/quick-add`, `/outings/`*, `/simulator`, `/welcome`, `/onboarding` fora do AppShell → `data-theme` nunca aplicado em hard reload nessas rotas (runtime: `data-theme` null antes do AppShell montar).                                                                                                               | Aplicar tema/idioma no nível raiz. → parte do DEC-083                                                                                                            | S       |
| **GAP-R2-004** | MÉDIA       | Round 3                 | Zero `ErrorBoundary` no app (grep em src/). Qualquer exceção de render num PWA local-first = tela branca sem recuperação.                                                                                                                                                                                                               | ErrorBoundary raiz com tela de erro do design system + botão recarregar                                                                                          | S       |
| **GAP-R2-005** | MÉDIA       | Round 5                 | Persistent storage é opt-in manual escondido em Settings (`SettingsPage.tsx:33-38`); `requestPersistentStorage` (`pwa.ts:33`) é dead code nunca chamado. Sem persist concedido, o navegador pode **evictar o IndexedDB** = perda total de dados de viagem.                                                                              | Solicitar `navigator.storage.persist()` automaticamente após onboarding/primeiro gasto; remover dead code                                                        | S       |
| **GAP-R2-006** | MÉDIA       | PASS 1 + FIELD-04       | `calculateOccasionForecasts` (`forecasting.ts:51-62`): `allocations.find` sem escopo de plano/fase e `transactions` da viagem inteira → contadores "X restantes / Y feitas" misturam fases.                                                                                                                                             | Receber `phaseId`/allocations do plano ativo da fase e filtrar transações por fase                                                                               | S       |
| **GAP-R2-007** | BAIXA       | FIELD-11 (investigação) | `FundsPage.tsx:319` usa classe `text-danger`; `tailwind.config.ts` define `error` — classe não existe, ícone sem cor de perigo.                                                                                                                                                                                                         | Trocar para `text-error`                                                                                                                                         | S       |
| **GAP-R2-008** | BAIXA       | Round 1 (a11y)          | Só 2 `aria-label` no app inteiro (BottomNav, FundsPage). Botões de ícone (sino, FAB, fechar sheets) sem nome acessível.                                                                                                                                                                                                                 | aria-labels nos botões de ícone; revisão de roles                                                                                                                | S       |
| **GAP-R2-009** | BAIXA       | Round 3                 | E2E cobre 5 specs (dashboard, navigation, onboarding, pwa, quick-add) — zero e2e para outing, planner, shared/settle, backup.                                                                                                                                                                                                           | Specs e2e para os fluxos core restantes                                                                                                                          | M       |


---

## 5. Design de Produto

> Numeração de decisões continua do decision-log (último: DEC-070). Todas PROPOSED.

### [FIELD-01] — Atividades selecionáveis por fase

**1. PROBLEMA**: perfis de atividade são globais à viagem; o Planner e os contadores assumem que toda fase tem todas as atividades. Na prática cada fase tem um "cardápio" próprio (mercado numa, não na outra).

**2. ESTADO ATUAL**: `ActivityProfile` tem só `tripId` (sem fase). `PlannerPage.tsx:220-228` semeia todos os perfis em todas as fases (root cause do FIELD-04). Não existe nenhuma estrutura fase↔perfil. `ScenarioAllocationItem` já é por plano de fase — o vínculo de fase existe, mas só DEPOIS de alocar.

**3. OPÇÕES**:

- **A. Campo `enabledProfileIds: string[]` na Phase** — simples, mas viola o padrão relacional do schema (todas as relações são tabelas) e complica merge de backup por revision.
- **B. Tabela `phaseProfileSettings` (phaseId, activityProfileId, isEnabled)** — segue o padrão (como `budgetPoolPhaseLinks`), indexável `[phaseId+activityProfileId]`, merge por revision natural. Ausência de linha = habilitado (default permissivo, zero migração de dados).
- **C. Mover perfis para a fase (profile.phaseId)** — quebra learning engine cross-fase (perfil "Bar" aprende a viagem toda) e duplica perfis. Descartada.

**4. RECOMENDAÇÃO**: **Opção B**. Consistente com o schema, default permissivo (nada muda para quem não configura), e dá ao Planner/forecasting um filtro explícito por fase que também conserta o FIELD-04 estruturalmente.

**5. DESIGN**:

- **Modelo**: nova tabela `phaseProfileSettings` (`SyncMetadata + phaseId + activityProfileId + isEnabled: boolean`). Dexie v3, índice `[phaseId+activityProfileId]`. Backup v3 inclui a tabela.
- **UX**: na criação/edição de fase (`TripEditPage`) e como primeira seção do Planner por fase: grade de chips com os perfis da viagem (ícone + nome), tap alterna habilitado/desabilitado, chip "+ Outros" cria perfil custom (reusa `ProfileForm`). Wireframe textual:

```
┌ Editar fase: Burgos ────────────────┐
│ Nome [Burgos]  Datas [..] [..]      │
│ O que vai ter nessa fase?           │
│ (●Restaurantes) (●Bar) (○Mercado)   │
│ (●Transporte) (○Hospedagem) (+Outro)│
└─────────────────────────────────────┘
```

- **Integração**: Planner hidrata/persiste só perfis habilitados (mata a contaminação); contadores do dashboard (FIELD-06) mostram só habilitados da fase atual; QuickAdd prioriza perfis habilitados na seleção.
- **Corte V1**: chips na edição de fase + filtro no Planner/contadores. Fica para depois: sugestão automática por tipo de destino.

**6. DECISÕES PROPOSTAS**: DEC-074 (ver §6).
**7. ESFORÇO**: M  
  
ok, só cria mais opções, pensem em opções para viagens e crie algumas mais, mais populares..

---

### [FIELD-02] — Tipo/ritmo da fase (intensidade de gasto)

**1. PROBLEMA**: o forecasting assume gasto uniforme por dia. Viagens reais têm ritmo: fases intensas vs tranquilas, picos no fim de semana. O "livre para usar por dia" fica errado nos dois sentidos (sobra em dia parado, falta em dia de pico).

**2. ESTADO ATUAL**: `Phase` (`phase.ts`) tem só nome/datas/order. `calculateFreeToSpend`/forecasting (DEC-006) é occasion-based por quantidade, sem dimensão temporal. `forecastSnapshots` existe (avgDailySpend, projectedEndSpend) sem UI.

**3. OPÇÕES**:

- **A. Preset de ritmo por fase** (`intense | moderate | relaxed | custom`) com multiplicadores fixos de dias-de-gasto — simples, mas não captura "fim de semana é pico".
- **B. Preset + padrão semanal** (`peakDays: number[]` 0-6, ex.: `[5,6]` = sex/sáb) — cobre o caso da Mira diretamente; cálculo de "dias efetivos de gasto" = dias da fase ponderados (pico=1.5, normal=1.0, calmo conforme preset).
- **C. Calendário dia-a-dia editável** — máxima precisão, esforço alto, fricção alta de input. V2.

**4. RECOMENDAÇÃO**: **Opção B** — atende o relato literalmente (fins de semana de pico), é dado simples de informar (1 preset + tap nos dias), e alimenta o forecasting com um conceito único: **dias efetivos**.

**5. DESIGN**:

- **Modelo**: campos novos em `Phase`: `rhythmPreset: 'intense' | 'moderate' | 'relaxed' | 'custom' | null` e `peakDays: number[] | null` (null = comportamento atual, uniforme). Sem tabela nova.
- **Domínio**: `calculateEffectiveSpendingDays(phase, fromDate)` → pondera dias restantes; `freeToSpendPerDay = freeToSpend / effectiveDaysRemaining`; hoje-é-pico ajusta o número exibido ("hoje é dia de pico: livre até €X").
- **UX**: na edição de fase, junto do FIELD-01:

```
│ Ritmo da fase                        │
│ (○Intensa) (●Moderada) (○Tranquila)  │
│ Dias de pico: S T Q Q S [S] [D]      │
```

- **Integração**: dashboard ("livre para usar hoje" ponderado + microcopy de pico), Planner (linha informativa de dias efetivos), forecasting/DEC-006 (projeção fim de fase usa dias efetivos — alimenta card do FIELD-07).
- **Corte V1**: preset + peakDays + freeToSpend diário ponderado. Depois: aprendizado do ritmo real vs declarado, calendário custom.

**6. DECISÕES PROPOSTAS**: DEC-075.
**7. ESFORÇO**: M

---

### [FIELD-05] — Eventos planejados dentro das fases (a maior feature)

**1. PROBLEMA**: gastos grandes e conhecidos com data (festa dia 12, praia de 2 dias, cada cidade da eurotrip) não têm lugar no modelo de recorrência. O usuário quer: declarar, reservar dinheiro, ser lembrado no dia, e iniciar a saída a partir do evento.

**2. ESTADO ATUAL**: `**plannedOccurrences` existe no schema desde DEC-043 com zero UI** (`planned-occurrence.ts`): `tripId, phaseId, activityProfileId, budgetPoolId, name, plannedDate, estimatedCostCents, isConfirmed, linkedTransactionId, notes`. Já está no backup (GAP-003). Envelopes (DEC-042) e future floor já sabem reservar dinheiro. Sessions persistem (GAP-003) mas não têm vínculo com occurrence.

**3. OPÇÕES**:

- **A. PlannedOccurrence estendida (1 entidade, 2 tipos)** — adicionar `endDate` (multi-dia), `kind: 'event' | 'sub_destination'` (festa vs cidade da eurotrip), `reservedCents`, `linkedSessionId`, tornar `activityProfileId` nullable. Reuso máximo, 1 tabela, merge de backup já resolvido.
- **B. Entidade nova `TripEvent` separada** — modelo "limpo", mas duplica 80% da PlannedOccurrence e contraria o princípio reuse-first do brain.
- **C. Sub-fases (cidade = fase filha)** — resolve eurotrip, mas explode a complexidade de pools/links/planner para o caso simples (festa de 1 dia). Descartada.

**4. RECOMENDAÇÃO**: **Opção A**. A tabela foi criada exatamente para isso (DEC-043); estender 5 campos resolve evento de 1 dia, multi-dia e sub-destino com a mesma UI; e `linkedSessionId` cria a ponte natural com o Outing Mode que resolve o FIELD-04 (Parral teria sido um evento, não um perfil).

**5. DESIGN**:

- **Modelo** (Dexie v3): `PlannedOccurrence` + `endDate: string | null` (null = 1 dia), `kind: 'event' | 'sub_destination'`, `reservedCents: number | null`, `linkedSessionId: string | null`; `activityProfileId` vira nullable (evento sem perfil). Índice `[phaseId+plannedDate]`.
- **Reserva de dinheiro**: `reservedCents` entra no cálculo de `freeToSpend` como dedução (mesma mecânica do future floor/envelope — função nova `calculateEventReserves(occurrences, phaseId)` somada em `budget.ts`). Ao iniciar a sessão do evento, a reserva vira o teto sugerido; ao encerrar, a occurrence marca `isConfirmed` e `linkedTransactionId`/`linkedSessionId`, e a reserva deixa de deduzir (o gasto real assume).
- **UX / menus** (3 pontos de entrada, 1 tela):
  - **Editar fase** (`TripEditPage`): seção "Eventos desta fase" com lista + "+ Evento" — onde se cria (nome, data ou intervalo, valor estimado, reservar?, tipo).
  - **Planner**: linha informativa por fase "Eventos: Parral €50 · Praia (2d) €120" com link para a edição (eventos não são sliders — são fixos).
  - **Dashboard**: card do dia (regra: `plannedDate <= hoje <= endDate ?? plannedDate` e sem sessão ligada):

```
┌──────────────────────────────────────┐
│ 🎉 Hoje: Parral · reservado €50      │
│ [Iniciar agora]            [Adiar →] │
└──────────────────────────────────────┘
```

  "Iniciar agora" → abre `/outings/new` pré-configurado (nome do evento, teto = reservedCents, `linkedSessionId` preenchido ao criar). "Adiar" → empurra `plannedDate` +1 dia.

- **Eurotrip (sub-destinos)**: mesmos campos com `kind: 'sub_destination'` e intervalo de datas; a fase mostra a lista de cidades com orçamento e gasto-até-agora por cidade (transações no intervalo de datas da cidade).
- **Integração**: dashboard (card do dia + reservas no hero), budget (`freeToSpend` deduz reservas ativas), outing (sessão nasce ligada ao evento — substitui o fluxo do Parral), Planner (linha informativa), backup/CSV (campos novos), FIELD-04 (sessão custom passa a perguntar: "é um evento único?" → cria occurrence, não perfil).
- **Corte V1**: criar/editar/apagar eventos na fase, reserva deduzindo do livre, card do dia com iniciar agora, lista por fase. Fica para depois: notificações push, sub-destinos com mini-dashboard próprio, sugestão de valor por histórico.

**6. DECISÕES PROPOSTAS**: DEC-072 (modelo+UX), DEC-073 (one-off ≠ perfil).
**7. ESFORÇO**: L

---

### [FIELD-06] — Contadores do dashboard dinâmicos (carrossel)

**1. PROBLEMA**: os 3 contadores são fixos (bar/mercado/restaurante); quem usa outros perfis não os vê.

**2. ESTADO ATUAL**: `DashboardPage.tsx:355-395` — `forecasts.slice(0, 3)` quando há plano; senão 3 contadores hardcoded. `OccasionCounter` é estático (FIELD-14).

**3. OPÇÕES**: **A.** Grid fixo "top 3 por uso" (sem scroll — esconde o resto); **B.** Carrossel horizontal com scroll-snap, 3 visíveis, ordenado por uso (relato literal); **C.** Grid expansível "ver todos" (mais um tap).

**4. RECOMENDAÇÃO**: **Opção B** — é o pedido literal, CSS puro (`overflow-x-auto` + `scroll-snap-type`, sem lib), e combina com o filtro por fase do FIELD-01.

**5. DESIGN**:

- **Modelo**: nenhum campo novo. Ordenação: perfis com gasto na fase (desc por nº de transações) primeiro, depois planejados sem uso (ordem do plano). Sem uso nenhum → 3 mais planejados (comportamento atual preservado).
- **UX**: faixa horizontal com snap; cards de largura fixa (~1/3 da viewport); indicador de página (dots) se >3; cada card clicável → lista filtrada (FIELD-14).
- **Integração**: respeita perfis habilitados na fase (FIELD-01) e forecasting phase-scoped (GAP-R2-006). Junto com FIELD-07 forma o dashboard final (§7).
- **Corte V1**: carrossel + ordenação por uso + clique. Depois: reordenar manual.

**6. DECISÕES PROPOSTAS**: DEC-076.
**7. ESFORÇO**: S

---

### [FIELD-07] — Mais informações úteis no dashboard

**1. PROBLEMA**: há dados no modelo que não viram insight. O usuário quer "informações legais e importantes" sem poluir.

**2. ESTADO ATUAL (dados disponíveis hoje, sem inventar nada)**: transações com data/categoria/perfil/sessão; sessions com duração (startedAt/endedAt) e limites; shares/settlements; scenarioPlans/allocations; `forecastSnapshots` (tabela pronta, zero UI); future floor/envelopes; ritmo (se FIELD-02 aprovado); eventos (se FIELD-05 aprovado).

**3-4. CANDIDATOS (priorizados por valor×esforço)**:


| #   | Card/Insight                                                                               | Dados                                                             | Valor      | Esforço                 |
| --- | ------------------------------------------------------------------------------------------ | ----------------------------------------------------------------- | ---------- | ----------------------- |
| 1   | **Projeção de fim de fase** ("nesse ritmo, a fase fecha em €X — €Y acima/abaixo do plano") | transações da fase + dias restantes (+ dias efetivos do FIELD-02) | Alto       | S                       |
| 2   | **Ritmo atual vs planejado** (média diária real vs orçada, com seta)                       | idem                                                              | Alto       | S                       |
| 3   | **Dias sem gasto** ("3 dias sem gastar nessa fase 👏")                                     | datas das transações                                              | Médio-alto | S                       |
| 4   | **Custo médio por saída** (+ comparação com a típica do perfil)                            | sessions + sessionItems                                           | Médio-alto | S                       |
| 5   | **Dia mais caro da semana** ("seus sábados custam em média €X")                            | transações por weekday                                            | Médio      | S                       |
| 6   | **Maior gasto da semana** (com link para o detalhe)                                        | transações                                                        | Médio      | S                       |
| 7   | **Saldo com participantes** ("Mira te deve €12") resumido no dashboard                     | debts (já calculadas)                                             | Médio      | S                       |
| 8   | **Evolução da fase** (sparkline de gasto acumulado vs linha do plano)                      | transações + plano                                                | Alto       | M                       |
| 9   | **Próximo evento** ("Praia em 3 dias — reservado €120")                                    | FIELD-05                                                          | Alto       | S (depende de FIELD-05) |
| 10  | **Streak de backup** ("último backup há 9 dias") — já existe banner; virar info passiva    | appSettings                                                       | Baixo      | S                       |


**5. RECOMENDAÇÃO/DESIGN**: V1 = cards **1, 2, 3, 4, 7, 9** num bloco "Insights" rotativo (1 card por vez, dot indicator, max 4 visíveis por dia para não poluir — regra: só mostrar quando o dado é significativo, ex.: projeção só com ≥3 dias de dados). Persistir cálculo diário em `forecastSnapshots` (a tabela finalmente ganha uso: histórico para a sparkline futura). Posição no dashboard: ver §7.

**6. DECISÕES PROPOSTAS**: DEC-077.
**7. ESFORÇO**: M (4 cards V1)

---

### [FIELD-08] — Categorização rápida pós-valor na saída

**1. PROBLEMA**: quick-add da sessão registra só valor → histórico pobre ("Parral €5, categoria outros, não sei se dividi"). O enriquecimento precisa ser opcional e instantâneo (Core Rule: nunca atrapalhar o registro).

**2. ESTADO ATUAL**: quick-add da sessão (`OutingPage.tsx`) cria transação com `category: null`/perfil da sessão, sem pergunta. Split na sessão existe (GAP-012) mas é fluxo separado via sheet. A revisão de encerramento (GAP-002) permite editar itens depois — tarde demais para lembrar.

**3. OPÇÕES**: **A.** Stepper inline pós-tap (2 micro-passos com ícones, auto-dismiss); **B.** Enriquecer só na revisão final (já existe; não resolve "não lembro mais"); **C.** Long-press no botão de valor abre versão completa (escondido demais).

**4. RECOMENDAÇÃO**: **Opção A** — o relato pede exatamente isso; o registro continua salvo NO TAP (o stepper enriquece depois, nunca bloqueia).

**5. DESIGN**:

- **Fluxo** (após tap no valor, transação JÁ salva):

```
[€5 salvo ✓]  O que foi?
( 🍺 ) ( 🍔 ) ( 🚕 ) ( 🎟 ) ( ⋯ )   [pular]
   ↓ tap único
Quem pagou?  ( Eu ) ( 👤 Mira )      [pular]
   ↓ se outro ou tap em "dividir"
Dividiu?     ( Não ) ( Meio a meio )  [pular]
```

  Cada passo: 1 tap = grava e avança; "pular" ou 3s sem interação = some. Total: 0-3 taps extras opcionais.

- **Modelo**: nenhum campo novo — atualiza `category`, `paidByParticipantId`, `isShared` + shares via `buildSharesWithPayer` (reuso do GAP-012). Ícones de categoria: conjunto fixo por perfil da sessão (bar → bebida/comida/transporte/entrada/outro).
- **Integração**: alimenta FIELD-09 (histórico rico), FIELD-03 (shares nascem confirmados pelo criador, pendentes para o outro), revisão de encerramento mostra o que já foi categorizado.
- **Corte V1**: os 3 micro-passos no quick-add da sessão. Depois: o mesmo stepper no QuickAdd geral, categorias personalizáveis.

**6. DECISÕES PROPOSTAS**: DEC-078.
**7. ESFORÇO**: M

---

### [FIELD-09] — Histórico de saídas

**1. PROBLEMA**: sessões encerradas desaparecem; o usuário quer rever o que gastou em cada saída, como pagou e quanto durou.

**2. ESTADO ATUAL**: dados 100% persistidos desde GAP-003 — `Session` (status, startedAt/endedAt, limites, nome) + `SessionItem` (ordem) + transações ligadas (`sessionId`). Falta só a tela. `session-repository.ts` já filtra ativas; falta query de encerradas.

**3. OPÇÕES**: **A.** Item "Histórico de saídas" no menu Mais (lista dedicada); **B.** Aba "Saídas" dentro de Gastos (segmented control Gastos|Saídas); **C.** Seção no Trip Overview.

**4. RECOMENDAÇÃO**: **Opção B** — saídas SÃO gastos agrupados; quem procura "quanto gastei na festa" vai em Gastos. Mais (opção A) vira atalho secundário para a mesma rota. C esconde demais.

**5. DESIGN**:

- **Modelo**: nenhum. Query nova `getCompletedSessions(tripId)` no repository.
- **UX**: `/expenses?tab=outings` — lista: nome, data, duração (endedAt-startedAt), total (Σ itens), nº itens, badge do perfil. Tap → detalhe `/outings/:id/review` (REUSA a tela de revisão do GAP-002 em modo leitura): itens com categoria/share (ricos se FIELD-08 aprovado), carteiras usadas, limites vs gasto final, com quem dividiu.

```
┌ Gastos ─ [Gastos|Saídas] ───────────┐
│ 🎉 Parral · 12 jun · 3h12 · €38 · 7 │
│ 🍺 Bar de tapas · 10 jun · 2h05 ·…  │
└─────────────────────────────────────┘
```

- **Integração**: card "custo médio por saída" (FIELD-07) linka para cá; eventos concluídos (FIELD-05) linkam à sua sessão.
- **Corte V1**: lista + detalhe read-only. Depois: comparativos entre saídas, exportar uma saída.

**6. DECISÕES PROPOSTAS**: DEC-079.
**7. ESFORÇO**: M

---

### Interações entre features (o sistema)

```
FIELD-01 (atividades/fase) ─┬─ moram na MESMA tela (edição de fase)
FIELD-02 (ritmo)           ─┘        │
FIELD-05 (eventos)  ── resolve FIELD-04 (Parral) ── card do dia no dashboard
FIELD-08 (categorização) ── alimenta FIELD-09 (histórico rico) e FIELD-03 (shares)
FIELD-06 + FIELD-07 + card FIELD-05 ── dashboard final único (§7)
GAP-R2-006 (forecasting/fase) ── pré-requisito técnico de FIELD-01/06
```

---

## 6. Decisões Propostas (consolidado — aguardando aprovação do Julio)


| DEC                    | Título                                             | Resumo                                                                                                                                                                                                                             | Substitui/afeta                       |
| ---------------------- | -------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------- |
| **DEC-071** (PROPOSED) | Confirmação explícita de gastos compartilhados     | `ParticipantShare.confirmationStatus` (pending/confirmed/rejected); dívidas só consolidam shares confirmados; card do dashboard = shares pendentes com tap→confirmar/rejeitar; some quando todos confirmados ok, eu confirmo       | Substitui DEC-063; implementa DEC-019 |
| **DEC-072** (PROPOSED) | Eventos planejados via PlannedOccurrence estendida | +`endDate`, `kind` (event/sub_destination), `reservedCents`, `linkedSessionId`; `activityProfileId` nullable; UI em Editar Fase + linha no Planner + card do dia com "Iniciar agora"; reserva deduz do freeToSpend ok, eu confirmo | Reativa DEC-043                       |
| **DEC-073** (PROPOSED) | Sessão única não cria perfil recorrente            | Fluxo de sessão custom pergunta "evento único?" → cria PlannedOccurrence ligada à sessão; ActivityProfile só nasce de Perfis/Planner/onboarding ok, eu confirmo                                                                    | Corrige FIELD-04; afeta DEC-037       |
| **DEC-074** (PROPOSED) | Atividades habilitadas por fase                    | Tabela `phaseProfileSettings` (phaseId, profileId, isEnabled; ausência=habilitado); chips na edição de fase; Planner/contadores/QuickAdd respeitam ok, eu confirmo                                                                 | Afeta DEC-015 (planner)               |
| **DEC-075** (PROPOSED) | Ritmo de fase + dias de pico                       | `Phase.rhythmPreset` + `Phase.peakDays`; "dias efetivos" ponderam o livre-por-dia e a projeção de fim de fase ok, eu confirmo                                                                                                      | Estende DEC-006                       |
| **DEC-076** (PROPOSED) | Contadores em carrossel ordenados por uso          | Scroll-snap horizontal, 3 visíveis, todos os perfis usados/planejados da fase, clicáveis → lista filtrada ok, eu confirmo                                                                                                          | Estende DEC-055                       |
| **DEC-077** (PROPOSED) | Insights V1 do dashboard                           | 8 cards rotativos, com regras de significância; cálculo diário persistido em `forecastSnapshots` ok, eu confirmo                                                                                                                   | Reativa forecastSnapshots             |
| **DEC-078** (PROPOSED) | Categorização rápida pós-valor                     | Stepper de ícones opcional (categoria→quem pagou→dividiu) após quick-add da sessão; transação salva ANTES; cada passo 1 tap ou pulado ok, eu confirmo                                                                              | Reforça DEC-053 (nunca bloquear)      |
| **DEC-079** (PROPOSED) | Histórico de saídas                                | Aba "Saídas" em Gastos + atalho no Mais; detalhe reusa a tela de revisão em modo leitura ok, eu confirmo                                                                                                                           | —                                     |
| **DEC-080** (PROPOSED) | Política de edição/exclusão de fundos e fases      | Soft delete; fundo com transações → bloquear ou reatribuir; fase com dados → bloquear com explicação; nunca apagar última fase; confirmação via BottomSheet ok, eu confirmo                                                        | —                                     |
| **DEC-081** (PROPOSED) | Mobile feel global                                 | `user-select:none` global (inputs preservados), tap-highlight transparente, `touch-action: manipulation` ok, eu confirmo                                                                                                           | —                                     |
| **DEC-082** (PROPOSED) | Atualização de versão visível                      | `index.html` network-first com fallback offline; toast "Nova versão — toque para atualizar" (skipWaiting+reload) ok, eu confirmo                                                                                                   | Estende DEC-053d/GAP-036              |
| **DEC-083** (PROPOSED) | Tema claro completo                                | Tema aplicado na raiz (todas as rotas); 12 cores hardcoded → tokens; `theme-color` dinâmica ok, eu confirmo                                                                                                                        | Estende DEC-066, DEC-022              |


---

## 7. Dashboard Final Proposto (FIELD-05 card + FIELD-06 + FIELD-07)

Ordem dos cards e regras de visibilidade (de cima para baixo):

```
1. Banner demo (se demo) / Banner backup (se isBackupReminderDue)     [existente]
2. Header: dia da fase + nome (→/trip) + sino (→/shared)              [existente]
3. ★ CARD DO EVENTO DO DIA (FIELD-05)                                 [novo]
   visível se: existe occurrence com plannedDate<=hoje<=endDate sem sessão ligada
   "🎉 Hoje: Parral · reservado €50  [Iniciar agora] [Adiar]"
4. Sessão ativa (se houver)                                           [existente]
5. HERO: Livre para usar (+ ponderação de ritmo FIELD-02:             [evolui]
   "hoje é dia de pico — livre até €X")
   sublinhas: saldo do fundo · reservas futuras · reserva protegida
   · reservado p/ eventos (FIELD-05)                                  [evolui]
6. ★ CARROSSEL DE CONTADORES (FIELD-06)                               [evolui]
   todos os perfis habilitados na fase (FIELD-01), ordenados por uso,
   3 visíveis + scroll, clicáveis → /expenses?profile=ID (FIELD-14)
7. ★ INSIGHT ROTATIVO (FIELD-07)                                      [novo]
   1 card por vez entre os 8 V1; só com dado significativo
8. Amigo Sincero (se aplicável)                                       [existente]
9. Pendentes de confirmação (critério DEC-071: shares pendentes;     [evolui]
   tap → confirmar/rejeitar)
10. Gastos recentes (itens CLICÁVEIS → /expenses/:id — FIELD-13)      [evolui]
11. Empty state (se sem gastos)                                       [existente]
```



---

## 8. Verificação por DEC (os 70)


| Faixa                                                      | Status                 | Observações                                                                                    |
| ---------------------------------------------------------- | ---------------------- | ---------------------------------------------------------------------------------------------- |
| DEC-001..005 (estrutura, PWA, stack, local-first, hosting) | ✅ respeitados          | —                                                                                              |
| DEC-006 (occasion-based forecasting)                       | ⚠️ parcial             | Implementado, mas sem escopo de fase (GAP-R2-006); FIELD-02 propõe extensão temporal (DEC-075) |
| DEC-007..018                                               | ✅ respeitados          | DEC-017 (Capacitor depois) inalterado                                                          |
| **DEC-019** (impacto provisório de shared)                 | ❌ **não implementado** | Sem estado de confirmação no modelo — raiz do FIELD-03; DEC-071 implementa                     |
| DEC-020..042                                               | ✅ respeitados          | DEC-022 (tokens) violado pontualmente por 12 cores hardcoded (GAP-R2-002)                      |
| **DEC-043** (PlannedOccurrence)                            | ⚠️ dormindo            | Tabela existe, zero UI — DEC-072 reativa                                                       |
| DEC-044..062                                               | ✅ respeitados          | —                                                                                              |
| **DEC-063** (critério de pendência)                        | ⚠️ insuficiente        | Funciona como proxy, mas o conceito está errado para o usuário (FIELD-03) — DEC-071 substitui  |
| DEC-064..065                                               | ✅ respeitados          | i18n 390 chaves × 3 idiomas                                                                    |
| **DEC-066** (liveQuery settings)                           | ✅ respeitado no código | Runtime test confirmou; mas não cobre rotas fora do AppShell (GAP-R2-003) — DEC-083 estende    |
| DEC-067 (orchestrators parciais)                           | ✅ respeitado           | Débito anotado segue válido                                                                    |
| DEC-068..070                                               | ✅ respeitados          | —                                                                                              |


---

## 9. Qualidade Transversal + Mobile Feel


| Área                           | Estado         | Evidência                                                                                                                                                                                                                                                                                                            |
| ------------------------------ | -------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| i18n                           | ✅              | 390 chaves × pt-BR/en/es, paridade total; zero strings PT hardcoded fora do i18n (grep heurístico limpo)                                                                                                                                                                                                             |
| Diálogos nativos               | ✅ 0            | Único match é comentário (`ExpenseDetailPage.tsx:376`)                                                                                                                                                                                                                                                               |
| Persistência/liveQuery         | ✅              | useLiveSettings + repositories; soft delete consistente                                                                                                                                                                                                                                                              |
| Testes                         | ✅ 156/156 unit | E2E: só 5 specs (GAP-R2-009)                                                                                                                                                                                                                                                                                         |
| PWA                            | ⚠️             | Instalável, offline ok; **update flow quebrado** (GAP-R2-001) e persistent storage manual (GAP-R2-005)                                                                                                                                                                                                               |
| Tema claro                     | ⚠️             | Troca ao vivo OK (runtime); 12 hardcoded dark + BottomNav invisível + rotas fora do shell (FIELD-12, GAP-R2-002/003)                                                                                                                                                                                                 |
| **Touch UX (pass específico)** | ⚠️             | `user-select`/tap-highlight/touch-action: **ausentes** (FIELD-10). Teclado numérico: ✅ `inputMode="decimal"` em 20+ inputs de valor. Áreas de toque: maioria ok; ícones 14-16px em botões pequenos em 8 arquivos merecem padding ≥44px na implementação do FIELD-13/14. Scroll bounce: sem tratamento (aceitável V1) |
| Acessibilidade                 | ⚠️             | aria-labels quase ausentes (GAP-R2-008)                                                                                                                                                                                                                                                                              |
| Performance                    | ✅              | Rotas lazy (`router.tsx`), bundles por página pequenos (maior: Dashboard ~15KB)                                                                                                                                                                                                                                      |


---

## 10. Log de Exaustividade


| Pass/Round | Lente                                                           | Achados novos                                                      |
| ---------- | --------------------------------------------------------------- | ------------------------------------------------------------------ |
| PASS 1     | Features (inventário R1 + Gates 1-7)                            | GAP-R2-006 (forecasting sem fase)                                  |
| PASS 2     | DECs 1-70                                                       | DEC-019 não implementado (consolidado no FIELD-03)                 |
| PASS 3     | Telas (tema claro E escuro, estados vazios)                     | GAP-R2-002 (12 hardcoded), GAP-R2-003 (rotas fora do shell)        |
| PASS 4     | Jornadas (golden paths + novas)                                 | — (settle parcial, backup 21 tabelas, multi-idioma re-traçados OK) |
| PASS 5     | Transversal (i18n, PWA, touch)                                  | GAP-R2-001 (SW update silencioso)                                  |
| Round 1    | i18n hardcoded / aria / diálogos nativos                        | +1 (GAP-R2-008 aria)                                               |
| Round 2    | SW/datas UTC/rotas órfãs                                        | 0 novos (refinou GAP-R2-001)                                       |
| Round 3    | ErrorBoundary / e2e / lazy loading                              | +2 (GAP-R2-004, GAP-R2-009)                                        |
| Round 4    | Moeda centralizada / reset / navegação Android                  | 0 novos                                                            |
| Round 5    | Sessão ativa pós-kill / persistent storage / demo               | +1 (GAP-R2-005)                                                    |
| Round 6    | Empty states / versão / settle parcial / import conflitos       | **0 novos**                                                        |
| Round 7    | Multi-trip / XSS / overflow de valores / soft delete em queries | **0 novos**                                                        |


**Critério atingido**: rounds 6 e 7 consecutivos com zero achados novos. ✅

---

## 11. Blocos de Implementação Recomendados

Bugs primeiro; features na ordem das dependências mapeadas (§5). Cada bloco é um gate candidato do próximo prompt.

### Bloco 1 — Distribuição + correções imediatas (S, ~alguns dias)

> Sem o item 1, nenhum fix chega ao usuário de forma confiável.

1. **GAP-R2-001 / DEC-082**: SW network-first p/ index.html + toast de atualização
2. **FIELD-12 / DEC-083 / GAP-R2-002/003**: BottomNav tokenizada, varredura das 12 cores, tema na raiz, theme-color dinâmica
3. **FIELD-10 / DEC-081**: user-select/tap-highlight/touch-action
4. **FIELD-13 + FIELD-14**: recentes clicáveis + counters → `/expenses?profile=` (query param na lista)
5. **GAP-R2-006**: forecasting phase-scoped · **GAP-R2-007**: `text-danger`→`text-error` · **GAP-R2-004**: ErrorBoundary · **GAP-R2-005**: persist() pós-onboarding

### Bloco 2 — Confirmação de shares + CRUD de fundos/fases (M)

1. **FIELD-03 / DEC-071**: `confirmationStatus` (Dexie v3 parte 1), UI de confirmação, dívidas só confirmadas
2. **FIELD-11 / DEC-080**: editar/apagar fundos e fases com regras de segurança

### Bloco 3 — Fase rica: atividades + ritmo (M)

1. **FIELD-01 / DEC-074**: `phaseProfileSettings` (Dexie v3 parte 2) + chips na edição de fase + Planner/contadores filtrados (fecha definitivamente o vetor do FIELD-04 no Planner)
2. **FIELD-02 / DEC-075**: rhythmPreset + peakDays + dias efetivos no freeToSpend/projeção

### Bloco 4 — Eventos planejados (L — a maior feature)

1. **FIELD-05 / DEC-072 + DEC-073**: PlannedOccurrence estendida (Dexie v3 parte 3), UI na fase, reserva no freeToSpend, card do dia + "Iniciar agora", sessão custom→evento (resolve FIELD-04 de produto)

### Bloco 5 — Outing rico + histórico (M)

1. **FIELD-08 / DEC-078**: stepper pós-valor (depende de DEC-071 p/ shares nascerem certos)
2. **FIELD-09 / DEC-079**: aba Saídas + detalhe read-only

### Bloco 6 — Dashboard final (M)

1. **FIELD-06 / DEC-076**: carrossel (depende de FIELD-01 e GAP-R2-006)
2. **FIELD-07 / DEC-077**: 4 insights V1 + forecastSnapshots (aproveita ritmo do FIELD-02 e eventos do FIELD-05)
3. Montagem da ordem final do dashboard (§7) + GAP-R2-008 (aria) + GAP-R2-009 (e2e dos fluxos novos)

> **Nota de migração**: blocos 2, 3 e 4 compartilham a migração Dexie v3 — se aprovados juntos, fazer UMA migração com todos os campos/tabelas (princípio do schema completo upfront, velocity-standard).

---

*Documento gerado pela auditoria R2 em 2026-06-09. Zero código de produção modificado nesta sessão. Todas as decisões DEC-071..083 aguardam aprovação do Julio antes de entrar no decision-log.*