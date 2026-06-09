# TripPilot — Gap Analysis Completa

> Data: 2026-06-09 | Deploy auditado: https://trippilot.pages.dev | Commit: `dd5c404`
> Build: ✅ | Typecheck: ✅ (0 erros) | Testes: 105/105 passando (12 suites)
> Método: 5 passes independentes (feature, decisão, tela, jornada, transversal) + 7 rounds de verificação até 2 rounds consecutivos com zero achados novos.

---

## 1. Resumo Executivo

O app está **muito mais avançado do que o brain registra** (`project-status.md` diz "NOT STARTED"; o código contém D1–D6 implementados, com 21 tabelas Dexie, 16 telas, 105 testes unitários e deploy funcional). A estrutura geral — onboarding, dashboard com dados reais, registro rápido, fundos, fases, carteiras, split, planner com persistência, modo saída imersivo, backup/CSV, PWA — existe e funciona no caminho feliz. Porém, a auditoria DEC-por-DEC revela que **uma camada inteira de comportamentos de domínio definidos no brain não foi conectada à UI**: o saque de dinheiro reduz o orçamento (violação da Core Rule 3), o encerramento de saída não tem tela de revisão, alertas progressivos e aprendizado de perfis existem como funções puras mas nunca são chamados, reconciliações (de caixa e de total da saída) não geram ajustes, e o backup não exporta sessões/acertos/cenários — ou seja, restaurar um backup perde dados.

**Números:**

| Métrica | Resultado |
|---|---|
| Features auditadas (inventário A) | 46 |
| ✅ Completas | 24 |
| 🟡 Parciais | 15 |
| 🟠 Quebradas | 2 |
| 🔴 Ausentes | 5 |
| Acceptance Criteria D1 (Appendix C) | **8✅ / 5🟡 / 2❌** de 15 |
| DECs verificados | 60 |
| DECs violados (total ou parcialmente) | **21** |
| Gaps documentados | 36 (3 críticos, 12 altos, 14 médios, 7 baixos) |

**Top 5 gaps mais críticos:**

1. **[GAP-001]** Saque de dinheiro é gravado como `adjustment` com `budgetPoolId` → **reduz o orçamento e não credita a carteira de dinheiro** (viola Core Rule 3 / DEC-052).
2. **[GAP-002]** Encerrar saída não tem tela de revisão (DEC-049): sem carteira, sem classificação típica/especial, sem checagem de caixa — gastos da saída ficam órfãos de carteira para sempre.
3. **[GAP-003]** Backup JSON **não inclui** sessions, sessionItems, settlements, scenarioPlans, scenarioAllocationItems, plannedOccurrences → restauração perde dados silenciosamente (DEC-013).
4. **[GAP-005/007]** Alertas progressivos (DEC-048) e motor de aprendizado de perfis (DEC-006) existem no domínio mas **nunca são chamados pela UI** — o coração comportamental do produto está desligado.
5. **[GAP-008/009]** Future floor (DEC-016) e envelopes (DEC-042) **não têm nenhuma UI**: "Reservado para próximas fases" será sempre €0 em viagens reais e a reserva protegida não é editável após o onboarding.

---

## 2. Matriz de Cobertura de Features

Legenda: ✅ COMPLETA · 🟡 PARCIAL · 🟠 QUEBRADA · 🔴 AUSENTE · ⚪ FORA DO D-ATUAL

| ID | Feature | Fonte | Status | O que falta exatamente |
|---|---|---|---|---|
| F-01 | Onboarding mínimo (viagem + fase + valor → dashboard) | DEC-036, master-spec §4 | ✅ | — |
| F-02 | Onboarding: criação de carteiras / carteira "Cartão de crédito" | DEC-051 | 🔴 | Nenhuma etapa de carteira; usuário começa sem carteiras (GAP-026) |
| F-03 | Demo data carregável e marcada | DEC-038 | 🟡 | Banner ✅; mas demo não tem gastos compartilhados, sessões nem settlements (GAP-035) |
| F-04 | Importar backup na tela de boas-vindas | master-spec §4 | ✅ | — |
| F-05 | Dashboard hero "Livre para usar" + breakdown | DEC-023 | ✅ | — |
| F-06 | Dashboard apenas dados reais | DEC-055 | ✅ | — |
| F-07 | Contadores de ocasião | DEC-006, wireframe | 🟡 | Mostra contagem de gastos feitos, não previsão "X restantes" do planner (GAP-020) |
| F-08 | Card de economia ("Você preservou...") | wireframe, D3 | ✅ | — |
| F-09 | Amigo Sincero com antes/depois + CTA simulador | DEC-031/035 | ✅ | — |
| F-10 | Card compras pessoais no dashboard | DEC-011 | 🟡 | Detecta pool por NOME ('pessoal'/'shopping') em vez de `scope==='global'` (GAP-017) |
| F-11 | Card gastos pendentes de confirmação | DEC-019/056 | 🟡 | Conta TODOS os shared para sempre; não existe fluxo de confirmação (GAP-016) |
| F-12 | Card saída ativa no dashboard | wireframe | ✅ | — |
| F-13 | Registro rápido de gasto (valor, categoria, fundo, carteira, descrição) | product-spec, master-spec §6.2 | ✅ | (como página, não bottom sheet — GAP-027) |
| F-14 | Carteira opcional + "Carteira não informada" + filtro | DEC-051 | ✅ | Banner está na lista de gastos (aceitável) |
| F-15 | Data/hora editável no registro | master-spec §6.2 | 🟡 | Só editável depois, no ExpenseDetailPage; não no QuickAdd |
| F-16 | Transferência entre carteiras | FAB, schema | 🟡 | Funciona, mas grava `budgetPoolId` ≠ null e `personalCostCents` = valor, violando o schema; não usa `createTransferTransaction` existente (GAP-010) |
| F-17 | Saque de dinheiro (banco → cash) | Core Rule 3, DEC-052 | 🟠 | Gravado como `adjustment` com pool → reduz orçamento; não credita carteira cash (GAP-001) |
| F-18 | Lista de gastos com filtros | v1-screen-list | ✅ | — |
| F-19 | Detalhe do gasto: ver/editar/excluir | v1-screen-list tela 6 | ✅ | — |
| F-20 | Split: participantes, quem pagou, igual/custom | DEC-019/047/056, product-spec §5 | ✅ | No QuickAdd ✅ |
| F-21 | Split dentro do Outing Mode | DEC-047 | 🔴 | Quick-add da sessão não tem opção de compartilhar (GAP-012) |
| F-22 | Dívidas + acerto (settle) | product-spec §5 | 🟡 | Settle integral imediato; sem acerto parcial; `suggestSimplifiedSettlements` não usado (GAP-032) |
| F-23 | Fundos: criar, escopo global/linked, vincular fases | DEC-007/040/041 | ✅ | Sem edição/exclusão de fundo existente |
| F-24 | Fase sem pool → prompt para criar | DEC-039 | 🔴 | QuickAdd auto-seleciona `pools[0]` sem validar vínculo com a fase (GAP-018) |
| F-25 | Reserva protegida como Envelope | DEC-042 | 🟡 | Criada no onboarding ✅; sem UI para editar/criar depois (GAP-009) |
| F-26 | Future floor por fase | DEC-016 | 🔴 | Nenhuma UI define `futureFloorCents`; só existe em demo data (GAP-008) |
| F-27 | Multi-fase: criar/editar fases, timeline | product-spec | ✅ | — |
| F-28 | Trip overview com fases e fundos | DEC-060 | ✅ | Tap no nome da fase no header não navega (GAP-024) |
| F-29 | Carteiras: criar, saldo, default | DEC-051 | ✅ | — |
| F-30 | Reconciliação de caixa com ajuste | DEC-052 | 🟠 | Só mostra `alert()` com a diferença; nunca cria a transação de ajuste (GAP-011) |
| F-31 | Planner com [-]/[+], presets, lock | DEC-015, D3 | ✅ | — |
| F-32 | Planner: persistência de cenários | DEC-043 | ✅ | ScenarioPlan + items com debounce |
| F-33 | Planner: recomendação de trade-off | D3 | ✅ | — |
| F-34 | Categorias custom (perfil custom) | DEC-037 | ✅ | Planner, Profiles e Outing |
| F-35 | Simulador "posso gastar?" | DEC-050 | 🟡 | Risco usa % simples, não fatores combinados (reserva/essenciais); acessível por FAB+Amigo Sincero+rota, mas não por Planner/Mais |
| F-36 | Outing: iniciar por perfil + sessão custom | DEC-009/044 | 🟡 | Sem configuração de limites/valores no start; usa defaults do perfil (só "Bar" tem três limites no seed) (GAP-015) |
| F-37 | Outing: tela imersiva, gauge, três limites, zona | DEC-010/024/026/032 | ✅ | — |
| F-38 | Outing: quick-add + "Outro" | DEC-045 | 🟡 | Highlight fixo no 3º botão (não no mais próximo do avg drink); valores não editáveis na sessão; usa `prompt()` nativo (GAP-025/028) |
| F-39 | Outing: "Registrar total atual" com reconciliação | DEC-046 | 🟠* | Apenas adiciona valor como novo gasto; sem cálculo de diferença nem "Ajuste para total informado" (GAP-006) *registra, mas com semântica errada |
| F-40 | Outing: alertas progressivos 50/75/90/100 + vibração | DEC-048 | 🔴 | `getProgressiveAlerts` nunca chamado; sem toasts; sem `navigator.vibrate` (GAP-005) |
| F-41 | Outing: revisão ao encerrar | DEC-049 | 🔴 | `handleEndSession` apenas marca completed e volta ao dashboard (GAP-002) |
| F-42 | Aprendizado de perfis (typical/safe/confidence) | DEC-006, domain-functions | 🔴 | `updateProfileFromTransaction` nunca chamado (GAP-007) |
| F-43 | Backup JSON export/import com merge | DEC-013 | 🟡 | Exporta só 11 de 21 tabelas; merge ignora conflitos via `.catch(() => {})` (GAP-003/004) |
| F-44 | CSV export 17 campos (+ avançado) | DEC-058 | 🟡 | 10 colunas; sem Hora, Viagem, Caixa/Sessão, Quem pagou, Custo pessoal, Valor compartilhado, Observações; sem modo avançado (GAP-021) |
| F-45 | Settings completo DEC-057 | DEC-057 | 🟡 | Falta moeda padrão; reminder default 3≠7; vibração e backup reminder decorativos (GAP-022) |
| F-46 | PWA: manifest, SW, offline, installable | technical-direction, DEC-002 | 🟡 | Manifest+SW ✅; sem indicador "Pronto para uso offline" (DEC-053d) (GAP-036) |

⚪ Fora do delivery atual: ver Seção 9.

---

## 3. Gaps Detalhados

### 3.1 CRÍTICO

**[GAP-001] CRÍTICO — Saque de dinheiro reduz o orçamento e não credita a carteira cash**
- **O que o brain define:** Core Rule 3 (product-spec): "Cash withdrawal ≠ expense" — saque é movimento entre carteiras (banco → dinheiro físico), nunca impacto no orçamento. DEC-052 define o fluxo de dinheiro físico. `database-schema.md` (transactions): transferências têm `budgetPoolId = null`.
- **O que existe hoje:** `src/features/expenses/QuickAddPage.tsx` (rota `/quick-add?type=withdrawal`, acionada pelo FAB "Registrar saque") cria a transação via `createExpenseTransaction` com `type: 'adjustment'`, `category: 'cash_adjustment'`, `budgetPoolId = effectivePoolId` e `personalCostCents = amountCents`. `calculatePoolSpent` (`src/domain/budget/budget.ts:58-68`) soma `expense` + `adjustment` → o saque **diminui o "Livre para usar"**. `calculateWalletBalance` (`src/domain/wallets/wallets.ts`) debita a carteira origem mas nenhuma carteira recebe o valor.
- **O que falta exatamente:**
  1. Modelar saque como transferência banco→cash usando `createTransferTransaction` (já existe em `src/domain/transactions/transactions.ts:73`), com seleção de carteira destino (cash) na UI.
  2. Garantir `budgetPoolId = null` e `personalCostCents = null`.
  3. Remover o caminho atual `type=withdrawal → adjustment com pool`.
- **Esforço estimado:** M

**[GAP-002] CRÍTICO — Encerramento de saída sem tela de revisão (DEC-049)**
- **O que o brain define:** DEC-049: "End-of-session uses a single screen with expandable blocks: total, items, adjustments, shared items, wallet, cash difference, classification (típica/especial/excluir do aprendizado)... CTA 'Confirmar e encerrar saída'".
- **O que existe hoje:** `src/features/outing/OutingPage.tsx:146-154` — `handleEndSession` chama `endSession()` (marca `completed`), reseta estado e navega para o dashboard. Nenhuma revisão. Como `handleQuickAdd` grava `walletId: null` (linha 130), **todos os gastos da saída ficam permanentemente sem carteira** a menos que editados um a um.
- **O que falta exatamente:**
  1. Tela/sheet de revisão com: total da sessão, lista de itens (editáveis), atribuição de carteira em lote, diferença de caixa opcional, classificação típica/especial, flag `excludeFromLearning`, confirmação final.
  2. Persistir `isSpecialOccasion`/`excludeFromLearning` nas transações da sessão.
  3. Hook para o motor de aprendizado (ver GAP-007).
- **Esforço estimado:** L

**[GAP-003] CRÍTICO — Backup JSON não exporta 10 das 21 tabelas**
- **O que o brain define:** DEC-013 (transferência de dispositivo via JSON) e master-spec §7.8: backup completo de todas as entidades.
- **O que existe hoje:** `src/features/backup/BackupPage.tsx:30-51` — `buildLocalBackup` inclui: settings, trips, phases, budgetPools, links, envelopes, participants, wallets, transactions, participantShares, activityProfiles. **Faltam:** `sessions`, `sessionItems`, `settlements`, `scenarioPlans`, `scenarioAllocationItems`, `plannedOccurrences`, `forecastSnapshots`, `futurePhaseReservePolicies`, `alertRules`, `devices`. Restaurar em outro device perde histórico de saídas, acertos de dívidas e cenários do planner.
- **O que falta exatamente:**
  1. Incluir todas as tabelas no `createBackup`/`BackupData` (`src/domain/backup/backup.ts`) e no import.
  2. Versionar o formato do backup para compatibilidade.
- **Esforço estimado:** M

### 3.2 ALTO

**[GAP-004] ALTO — Import "merge" não resolve conflitos por revision**
- **Brain:** AC-06 (Appendix C): "export and import JSON backup **with merge/conflict resolution**"; schema doc define `revision`/`sourceDeviceId` exatamente para isso.
- **Hoje:** `BackupPage.tsx:95-104` — cada registro é inserido com `create(x).catch(() => {})`: se o ID já existe, o registro importado é **silenciosamente descartado**, mesmo que tenha `revision` maior. `analyzeImport` calcula new/updated/conflicts mas o resultado não é usado na gravação.
- **Falta:** comparar `revision`/`updatedAt` por registro; aplicar update quando o importado é mais novo; UI de decisão para conflitos reais.
- **Esforço:** M

**[GAP-005] ALTO — Alertas progressivos da saída desconectados (DEC-048, DEC-010)**
- **Brain:** DEC-048: alertas visuais (banner/toast) em marcos progressivos + vibração opcional (default on).
- **Hoje:** `getProgressiveAlerts` existe e está testado (`src/domain/outing/outing.ts:69`), mas **nenhum componente o importa**. `rg "navigator.vibrate" src` → 0 resultados. O usuário só percebe o estouro pela cor do gauge.
- **Falta:** disparar toast/banner ao cruzar 50/75/90/100% (com tom do `settings.alertTone`); vibrar se `settings.vibrationEnabled`; registrar marcos já disparados para não repetir.
- **Esforço:** M

**[GAP-006] ALTO — "Registrar total atual" não é reconciliação (DEC-046)**
- **Brain:** DEC-046: manter itens, criar "Ajuste para total informado" com a **diferença**; se total < soma, avisar conflito e pedir confirmação para ajuste negativo.
- **Hoje:** `OutingPage.tsx:598-605` — `prompt()` pega um valor e chama `onQuickAdd(cents)`, ou seja, **soma o total informado como mais um gasto**, dobrando o registro se o usuário já tinha itens.
- **Falta:** calcular `diff = informado - calculateSessionTotal()`; criar transação de ajuste (positiva/negativa com confirmação) descrita como "Ajuste para total informado"; nunca apagar itens.
- **Esforço:** M

**[GAP-007] ALTO — Motor de aprendizado nunca roda (DEC-006, domain-functions §forecasting)**
- **Brain:** perfis aprendem com gastos reais (typical/safe/confidence/dataPointCount); "Special occasion" exclui do aprendizado.
- **Hoje:** `updateProfileFromTransaction` (`src/domain/forecasting/forecasting.ts:14`) só é referenciado em `index.ts` e nos testes. Perfis ficam com os valores do seed para sempre; `isSpecialOccasion`/`excludeFromLearning` são sempre `false` (nenhuma UI os define).
- **Falta:** chamar o update ao registrar gasto com `activityProfileId` (quick-add da sessão e revisão de encerramento); UI para marcar ocasião especial.
- **Esforço:** M

**[GAP-008] ALTO — Future floor sem nenhuma UI (DEC-016)**
- **Brain:** DEC-016: usuário define piso manual por fase futura; dashboard mostra "Reservado para próximas fases" (DEC-023).
- **Hoje:** `futureFloorCents` só é ≠ null em `src/domain/demo/demo-data.ts:127`. `createBudgetPoolPhaseLink` sempre grava `null`; TripEditPage/FundsPage não expõem o campo. Em viagens reais a linha do dashboard é sempre €0 e nada impede gastar o dinheiro da fase 2.
- **Falta:** campo "reserva para esta fase" ao vincular fase↔fundo (TripEdit/Funds); exibição no Planner; (cálculo automático de recomendação é D3+, registrar na seção 9).
- **Esforço:** M

**[GAP-009] ALTO — Envelopes sem gestão pós-onboarding (DEC-042)**
- **Brain:** DEC-042: reserva protegida é Envelope (fonte única); envelopes `allocation` existem no modelo.
- **Hoje:** envelope de reserva é criado apenas no onboarding (`src/domain/onboarding/onboarding.ts`); `rg "envelopeRepository\." src` mostra que **nenhuma tela cria/edita/remove envelopes** depois. Reserva fica imutável; envelopes de alocação são inalcançáveis.
- **Falta:** edição da reserva protegida (em Fundos ou Trip Edit); CRUD básico de envelopes de alocação por fundo.
- **Esforço:** M

**[GAP-010] ALTO — Transferência não usa o domínio correto e grava dados inconsistentes**
- **Brain:** `database-schema.md` (transactions): transfer → `budgetPoolId = null`, `personalCostCents = null`; domain-functions define construtor próprio.
- **Hoje:** `QuickAddPage.tsx` usa `createExpenseTransaction` com `type: 'transfer'` e `budgetPoolId = effectivePoolId`, `personalCostCents = amountCents` (não-shared). `createTransferTransaction` (correto, `transactions.ts:73`) **nunca é chamado pela UI**. Hoje não soma no orçamento (filtro por tipo), mas polui `filterTransactionsByPool`, o CSV e qualquer relatório por fundo; exige seleção de fundo numa operação que não tem fundo.
- **Falta:** trocar para `createTransferTransaction`; remover seleção de fundo/categoria do fluxo transfer; validar carteira origem ≠ destino.
- **Esforço:** S

**[GAP-011] ALTO — Reconciliação de caixa não cria ajuste (DEC-052)**
- **Brain:** DEC-052: diferença negativa → oferecer criar "Ajuste de dinheiro físico" com categoria; positiva → correção com justificativa. Ambos afetam carteira e orçamento.
- **Hoje:** `WalletsPage.tsx:51-63` calcula a diferença e mostra `alert()` — **nada é gravado**. `createAdjustmentTransaction` (`transactions.ts:104`) nunca é usado.
- **Falta:** após contagem, CTA "Criar ajuste" → `createAdjustmentTransaction` com categoria escolhida (negativo) ou justificativa (positivo); persistir e recarregar.
- **Esforço:** S/M

**[GAP-012] ALTO — Sem gasto compartilhado dentro da saída (DEC-047)**
- **Brain:** DEC-047: split deve funcionar dentro do Outing Mode; custo pessoal da sessão = só a parte do usuário.
- **Hoje:** `handleQuickAdd` (OutingPage) cria gasto simples; não há botão/fluxo de split na sessão. O FAB não está disponível na tela imersiva.
- **Falta:** ação "dividir essa" no quick-add da sessão (participantes + quem pagou), reusando a lógica do QuickAddPage; total da sessão considerando `personalCostCents`.
- **Esforço:** M

**[GAP-013] ALTO — Tema não aplica ao trocar (estado não compartilhado)**
- **Brain:** DEC-057 (tema dark/light/system em settings); technical-direction prevê Zustand para estado de UI.
- **Hoje:** cada página instancia seu próprio `useAppData()` (`src/hooks/useAppData.ts`) — não há store/contexto compartilhado nem `liveQuery`. `SettingsPage.updateSetting → reload()` atualiza só a instância da SettingsPage; o `AppShell` (que aplica `data-theme`, `AppShell.tsx:9-18`) continua com settings antigos. O tema só muda após refresh da página. O mesmo vale para qualquer dado alterado numa tela e exibido em outra montada (ex.: BottomNav/AppShell).
- **Falta:** estado compartilhado (Zustand já instalado, ou Context, ou `useLiveQuery` do dexie-react-hooks já instalado) para settings — no mínimo para `themePreference`/`language`/`alertTone`.
- **Esforço:** S

**[GAP-014] ALTO — Idioma salvo não é restaurado no boot**
- **Brain:** DEC-054/057: idioma persistido em settings.
- **Hoje:** `src/i18n/index.ts` inicializa fixo com `lng: 'pt-BR'`; `settings.language` nunca é lido na inicialização (apenas `changeLanguage` em runtime na SettingsPage). Usuário que escolheu EN volta para PT a cada sessão (mitigado pelo fato de EN/ES estarem vazios — ver GAP-033).
- **Falta:** após carregar settings, `i18n.changeLanguage(settings.language)` no bootstrap.
- **Esforço:** S

**[GAP-015] ALTO — Início de saída sem configuração de limites (DEC-044/045)**
- **Brain:** DEC-045: valores quick-add editáveis "em session start e durante a sessão"; master-spec/D4: setup com nome, alvos e preço médio de bebida. DEC-010: três limites por sessão.
- **Hoje:** `handleStartSession` (OutingPage:94-107) cria a sessão direto dos defaults do perfil. No seed, **apenas o perfil "Bar" tem `defaultTarget/Ceiling/Max/AvgDrink`** (`demo-repair.ts`/`profiles.ts`); sessões de outros perfis nascem sem limites → gauge e "bebidas restantes" não funcionam.
- **Falta:** etapa de confirmação no start (nome, três limites, avg drink, quick-add values, editáveis); fallback derivado de `typical/safeValue` para perfis sem defaults.
- **Esforço:** M

### 3.3 MÉDIO

**[GAP-016] MÉDIO — "Gastos pendentes de confirmação" nunca esvazia (DEC-019/056)**
- **Brain:** DEC-019: impacto provisório até confirmação; DEC-056: "Pending shared expense card hidden when empty"; o próprio share do usuário pode ser confirmado imediatamente.
- **Hoje:** `DashboardPage.tsx:107-111` — `pendingShared = transactions.filter(isShared)`: **todo** gasto compartilhado conta como pendente para sempre; não existe estado de confirmação nem ação para resolver.
- **Falta:** definir critério de pendência (ex.: shares de terceiros não acertados) ou campo de confirmação; ligar o card a esse critério.
- **Esforço:** M

**[GAP-017] MÉDIO — Pool de compras pessoais identificado por nome (DEC-041)**
- **Brain:** DEC-041: compras pessoais = BudgetPool com `scope: 'global'`.
- **Hoje:** `DashboardPage.tsx:113` — `pools.find(p => p.name.includes('pessoal') || p.name.includes('shopping'))`. Fundo global chamado "Presentes" não aparece; fundo de fase chamado "Compras pessoais" apareceria errado.
- **Falta:** trocar para `pools.find(p => p.scope === 'global')` (ou listar todos os globais).
- **Esforço:** S

**[GAP-018] MÉDIO — Seleção de fundo no QuickAdd ignora vínculo fase↔fundo (DEC-039/040)**
- **Brain:** DEC-040: auto-seleção apenas quando há **um** pool operacional na fase; fundos globais exigem seleção consciente; DEC-039: fase sem pool → prompt para criar/vincular.
- **Hoje:** `QuickAddPage.tsx` — `effectivePoolId = poolId || pools[0]?.id`: lista todos os pools da viagem (sem filtrar por `BudgetPoolPhaseLink`) e auto-seleciona o primeiro, que pode ser o fundo global de compras. Sem pool → botão salvar simplesmente não habilita, sem mensagem.
- **Falta:** filtrar pools pela fase ativa + globais; auto-selecionar só com 1 operacional; empty-state "criar fundo" quando não houver.
- **Esforço:** S/M

**[GAP-019] MÉDIO — Edge cases DEC-053 não implementados**
- **Brain:** DEC-053: (a) orçamento zerado → estado crítico + confirmação; (b) saída acima do max → confirmação para novos quick-adds (15 min); (c) sessão cruzando fase → oferecer manter/mover/dividir; (d) "Pronto para uso offline" após cache.
- **Hoje:** (a) nenhum aviso ao registrar com `freeToSpend = 0` (QuickAdd nem lê o orçamento); (b) quick-add segue normal acima do max (apenas cor muda); (c) sessão não detecta troca de fase; (d) sem indicador offline.
- **Falta:** os quatro comportamentos (nenhum bloqueante, todos confirmatórios).
- **Esforço:** M

**[GAP-020] MÉDIO — Contadores de ocasião não são previsão (DEC-006/043)**
- **Brain:** occasion-based forecasting: dashboard mostra "quantas vezes ainda posso" (ligado ao planejado no ScenarioPlan); `calculateOccasionForecasts` foi escrito para isso.
- **Hoje:** `DashboardPage.tsx:101-105` conta transações por categoria ("3 noites de bar" = feitas). `calculateOccasionForecasts` nunca é chamado.
- **Falta:** conectar allocations do plano ativo da fase → exibir `remaining` ("4 restantes"); manter contagem atual como secundária se desejado.
- **Esforço:** S/M

**[GAP-021] MÉDIO — CSV com 10 campos vs 17 básicos + modo avançado (DEC-058, AC-07)**
- **Hoje:** `src/domain/backup/csv-export.ts` exporta: Data, Descrição, Valor, Valor Formatado, Categoria, Tipo, Fundo, Carteira, Fase, Compartilhado. Faltam: Hora, Viagem, Caixa(Sessão), Quem pagou, Custo pessoal, Valor compartilhado, Observações, Moeda, Valor em moeda base; e o modo avançado (+ID, Status, Criado/Atualizado em, Dispositivo).
- **Falta:** completar os 17 campos; opção básico/avançado na UI do Backup.
- **Esforço:** S/M

**[GAP-022] MÉDIO — Settings: itens faltando e toggles decorativos (DEC-057)**
- **Hoje:** `SettingsPage.tsx` não tem **moeda padrão** (DEC-057 exige); `backupReminderDays` default é 3 (`app-settings-repository.ts:15`) vs 7 do DEC-057 e opções limitadas a [1,2,3,5,7]; o lembrete de backup **nunca é exibido em lugar nenhum** (nenhuma lógica `lastBackupDate + days`); vibração **não tem efeito** (zero usos de `navigator.vibrate`).
- **Falta:** linha de moeda padrão; banner de lembrete de backup no dashboard quando vencido; vibração ligada aos alertas (GAP-005); default 7 dias.
- **Esforço:** S/M

**[GAP-023] MÉDIO — "Mais" sem "Relatórios" e "Sobre" (DEC-059)**
- **Hoje:** `MorePage.tsx` — seção Dados tem só Backup e Exportar CSV (sem Relatórios); seção Aplicativo tem só Configurações (Sobre está embutido na SettingsPage).
- **Falta:** item "Sobre" próprio (ou aceitar e registrar como decisão); "Relatórios" é D3+ — pode entrar desabilitado ou ficar para a seção 9.
- **Esforço:** S

**[GAP-024] MÉDIO — Navegação do header incompleta (DEC-060)**
- **Hoje:** Dashboard: nome da fase no header não é clicável (DEC-060: tap → trip overview); sino de notificações (`DashboardPage.tsx:172-185`) é puramente decorativo — tem badge de pendências mas nenhum `onClick`.
- **Falta:** tap no título → `/trip`; sino → `/shared` (ou remover o sino).
- **Esforço:** S

**[GAP-025] MÉDIO — Diálogos nativos do browser em fluxos centrais**
- **Brain:** design-system.md (componentes próprios, bottom sheets; anti-patterns visuais); DEC-022.
- **Hoje:** `prompt()` no "Outro" e "Registrar total" da saída (OutingPage:586,600), `alert()` na reconciliação (WalletsPage:57-59) e erro de saída, `window.confirm` no delete de gasto (ExpenseDetailPage:134). Quebram o tema e não respeitam i18n de botões.
- **Falta:** substituir por bottom sheet/modal do design system com teclado numérico.
- **Esforço:** M

**[GAP-026] MÉDIO — Onboarding sem etapa de carteiras (DEC-051)**
- **Brain:** DEC-051: "Add generic editable 'Cartão de crédito' wallet"; default wallet pré-seleciona no quick-add.
- **Hoje:** `OnboardingPage.tsx`/`onboarding.ts` criam viagem, fase, pool, reserva e owner — **zero carteiras**. Primeiro gasto nasce "sem carteira" e o usuário precisa descobrir `/wallets` sozinho.
- **Falta:** criar carteira(s) default no onboarding (ex.: "Cartão de crédito" + opcional "Dinheiro"), ou etapa opcional de carteiras.
- **Esforço:** S

**[GAP-027] MÉDIO — QuickAdd é página cheia, sem data/hora (master-spec §6.2, wireframe)**
- **Hoje:** `/quick-add` é rota standalone (não bottom sheet sobre o contexto); não permite registrar gasto retroativo (campo de data só na edição posterior).
- **Falta:** campo de data/hora opcional no registro; (bottom sheet é polish — pode ficar).
- **Esforço:** S

**[GAP-028] MÉDIO — Valores quick-add divergem do DEC-045**
- **Hoje:** default `[300,500,1000,1500,2000]` (`app-settings-repository.ts:21`) vs DEC-045 `+€3, +€5, +€7, +€10, +€15`; OutingPage usa fallback `[300,500,700,1000,1500]` (inconsistente com settings); highlight sempre no 3º botão (`OutingPage.tsx:559`) em vez do mais próximo do avg drink price; não editáveis por perfil nem durante a sessão.
- **Falta:** alinhar defaults; highlight dinâmico; edição por perfil/sessão.
- **Esforço:** S

**[GAP-029] MÉDIO — Zod sem uso em runtime (technical-direction §validation)**
- **Hoje:** `src/domain/validation/schemas.ts` define schemas completos, mas só os testes os importam. O import de backup (`parseBackupFile`) não valida o JSON contra os schemas — um arquivo malformado pode gravar lixo no Dexie.
- **Falta:** validar `BackupData` no import; validar inputs dos formulários críticos (QuickAdd, Funds).
- **Esforço:** S/M

### 3.4 BAIXO

**[GAP-030] BAIXO — Camada de orquestradores ausente** — `src/domain/orchestrators/` está vazia; `domain-functions-d1.md` define orquestradores (registerExpense, endOuting etc.) e as guidelines (§2.2) exigem o padrão. Hoje as páginas chamam repositórios diretamente (ex.: QuickAddPage cria tx + shares em sequência sem transação atômica). Esforço: M (refator).

**[GAP-031] BAIXO — Schema Dexie sem índices compostos nem populate** — `database-schema.md` especifica `[tripId+order]` (phases), `[tripId+date]` (transactions) etc. e seeding via `db.on('populate')`. `src/data/db/schema.ts` não tem nenhum índice composto; o populate inexiste (mitigado pelo lazy-create do `appSettingsRepository.get()`, e a tabela `devices` nunca é populada). Esforço: S.

**[GAP-032] BAIXO — Acertos sem simplificação nem parcial** — `suggestSimplifiedSettlements` exportado e nunca usado; `handleSettle` (SharedExpensesPage) quita o valor integral sem confirmação nem valor parcial. Fonte: product-spec §5. Esforço: S.

**[GAP-033] BAIXO — en/es são stubs de 8 linhas** — `en.json`/`es.json` têm só `nav.*` vazios; DEC-054 mandava "prepare en/es structure **without translating**" — a estrutura também não existe (faltam ~294 chaves). A SettingsPage oferece os 3 idiomas como se funcionassem (fallback silencioso para pt-BR). Esforço: S (copiar estrutura) / M (traduzir).

**[GAP-034] BAIXO — Dependências instaladas sem uso** — `zustand` e `react-hook-form` não têm nenhum import em `src/`; `@capacitor/core` + `capacitor.config.ts` presentes (DEC-017 diz "later" — ok, mas registrar). Esforço: S (remover ou usar).

**[GAP-035] BAIXO — Demo sem shared/sessões/settlements (DEC-038)** — `generateDemoData` cria 2 fases, 2 pools, 2 carteiras, 2 participantes e transações, mas nenhum gasto compartilhado (sem participantShares), nenhuma sessão e nenhum settlement — o demo não demonstra split, dívidas nem outing. Esforço: S.

**[GAP-036] BAIXO — PWA sem indicador offline (DEC-053d)** — manifest ✅ (com shortcuts), SW cache-first ✅, `_redirects` ✅; falta o estado "Pronto para uso offline" e o SW usa lista estática mínima (`/`, `/index.html`, `/manifest.json`) — assets hasheados só entram no cache após visita. Esforço: S.

---

## 4. Verificação por Decisão (DEC por DEC)

| DEC | Resumo | Respeitado? | Evidência | Gap |
|---|---|---|---|---|
| 001 | Estrutura do projeto | ✅ | `TripPilot/` com brain/ + src/ | — |
| 002 | PWA first | ✅ | manifest.json, sw.js, deploy Pages | GAP-036 (parcial offline) |
| 003 | Stack React+TS+Vite+Tailwind+Dexie | ✅ | package.json | — |
| 004 | Local-first IndexedDB | ✅ | Dexie, 21 tabelas | — |
| 005 | Cloudflare Pages | ✅ | deploy trippilot.pages.dev + `_redirects` | — |
| 006 | Occasion-based forecasting | ❌ | aprendizado e forecasts nunca chamados | GAP-007, GAP-020 |
| 007 | BudgetPool cross-phase | ✅ | BudgetPoolPhaseLink + FundsPage multi-fase | — |
| 008 | Hierarquia de entidades | ✅ | types/ completo conforme schema doc | — |
| 009 | Outing Mode core | 🟡 | tela imersiva existe; comportamentos centrais faltam | GAP-002/005/006/015 |
| 010 | Três limites | 🟡 | exibidos na sessão; sem alertas nem configuração | GAP-005/015 |
| 011 | Personal shopping isolado | 🟡 | pool global funciona; detecção por nome | GAP-017/018 |
| 012 | Tom "Amigo Sincero" | 🟡 | card no dashboard ✅; tom não afeta alertas (não existem) | GAP-005 |
| 013 | Transferência via JSON/CSV | 🟡 | export/import existem; incompletos | GAP-003/004/021 |
| 014 | Sem dados pessoais no build | ✅ | demo fictício ("Eurotrip Espanha 2026") | — |
| 015 | Scenario Planner manual | ✅ | PlannerPage com presets/lock/persistência | — |
| 016 | Future floor auto+manual | ❌ | sem UI; sempre null fora do demo | GAP-008 |
| 017 | Capacitor depois | ✅ | config presente, não bloqueia PWA | GAP-034 (nota) |
| 018 | Arquitetura multi-user futura | ✅ | SyncMetadata em todas as entidades | — |
| 019 | Impacto provisório shared | 🟡 | personalCost no orçamento ✅; "pendente" sem fluxo | GAP-016 |
| 020 | Money em cents | ✅ | `amountCents` int em todo o domínio; testes | — |
| 021 | EUR-only interface | ✅ | símbolos EUR default; multi-moeda preparado | — |
| 022 | Mediterranean Cockpit | ✅ | tokens.css conforme design-system | — |
| 023 | "Livre para usar" hero | ✅ | DashboardPage hero + breakdown | GAP-008 (linha futuro=0) |
| 024 | Outing tela dedicada | ✅ | rotas fora do AppShell, sem bottom nav | — |
| 025 | UI em português | ✅ | pt-BR.json 338 linhas; sem hardcode | — |
| 026 | Outing layout denso + histórico | ✅ | ActiveSession com histórico de 4 itens | — |
| 027 | FAB 6 opções | ✅ | FAB.tsx com 6 ações | — |
| 028 | Planner chips visuais | ✅ | badges essencial/planejado/opcional/modificado | — |
| 029/033 | Contrast tiers | ✅ | tokens dim 70% faint 44% | — |
| 030 | Dashboard prioridade de cards | ✅ | ordem: hero→saída→ocasiões→economia→pendentes→pessoal→amigo→recentes | — |
| 031/035 | Amigo Sincero acionável | ✅ | antes/depois + CTA simulador pré-preenchido | — |
| 032 | Gauge com marcador + zona | ✅ | OutingPage gauge + chip de zona | — |
| 034 | FAB overlay real | ✅ | overlay full-screen com blur | — |
| 036 | Onboarding mínimo | ✅ | 3 passos → dashboard | GAP-026 (carteira) |
| 037 | Perfis editáveis + skip | 🟡 | criação custom ✅; sem edição/exclusão de perfil existente | — |
| 038 | Demo completo | 🟡 | sem shared/sessões/settlements | GAP-035 |
| 039 | Fase sem pool permitida | 🟡 | modelo permite; QuickAdd sem prompt de criação | GAP-018 |
| 040 | Multi-pool por fase | 🟡 | modelo ✅; auto-seleção viola regra do pool único operacional | GAP-018 |
| 041 | Personal shopping = pool global | 🟡 | criação ✅ (FundsPage scope global); dashboard busca por nome | GAP-017 |
| 042 | Envelope simplificado | 🟡 | reserva como envelope ✅; sem gestão | GAP-009 |
| 043 | AllocationItem vs PlannedOccurrence | ✅ | planner manipula ScenarioAllocationItems | — |
| 044 | Perfis: typical+safe p/ planning | 🟡 | planner usa typical ✅; sessão sem configuração | GAP-015 |
| 045 | Quick-add dinâmico | ❌ | defaults divergentes, highlight fixo, não editável | GAP-028 |
| 046 | Registrar total = reconciliação | ❌ | soma como gasto novo | GAP-006 |
| 047 | Shared durante outing | ❌ | inexistente na sessão | GAP-012 |
| 048 | Alertas visuais + vibração | ❌ | engine nunca chamada; sem vibrate | GAP-005/022 |
| 049 | Revisão ao encerrar | ❌ | encerramento direto | GAP-002 |
| 050 | Simulador multi-acesso + risco combinado | 🟡 | FAB/AmigoSincero/rota ✅; risco % simples; sem acesso via Planner/Mais | F-35 |
| 051 | Carteira opcional + revisão | 🟡 | banner+filtro na lista ✅; sem carteira default no onboarding | GAP-026 |
| 052 | Reconciliação de caixa | ❌ | alert() sem criar ajuste; saque errado | GAP-001/011 |
| 053 | Edge cases nunca bloquear | ❌ | (a)(b)(c)(d) não implementados | GAP-019/036 |
| 054 | Router v7 + i18next + testes desde D1 | 🟡 | router/i18n/vitest ✅; en/es sem estrutura; e2e não roda local (sem browsers já instalados, não verificado em CI) | GAP-033 |
| 055 | Dashboard real data + planner básico | ✅ | sem fake data; planner além do básico | — |
| 056 | Participante mínimo | 🟡 | name+nickname ✅; card pendente nunca esconde | GAP-016 |
| 057 | Settings V1 | 🟡 | falta moeda padrão; reminder 3≠7; toggles decorativos | GAP-022 |
| 058 | CSV 17 campos | ❌ | 10 campos, sem avançado | GAP-021 |
| 059 | "Mais" seccionado | 🟡 | 3 seções ✅; falta Relatórios e Sobre | GAP-023 |
| 060 | Navegação trip overview | 🟡 | /outings/active sem sessão mostra start ✅; tap na fase do header não navega | GAP-024 |

**Violações (❌): 9** (006, 016, 045, 046, 047, 048, 049, 052, 053, 058 → 10) · **Parciais (🟡): 18** · **Respeitados: 32**.
Total violado (❌+🟡 relevante): **21 DECs precisam de ação**.

---

## 5. Verificação por Tela

| Tela (v1-screen-list) | Existe? | Rota | Completa vs wireframe/spec? | Gaps |
|---|---|---|---|---|
| Welcome | ✅ | `/`, `/welcome` | ✅ 3 ações (criar/importar/demo) | — |
| Onboarding | ✅ | `/onboarding` | 🟡 3 passos; sem carteiras; sem validação de datas | GAP-026 |
| Dashboard | ✅ | `/dashboard` | 🟡 todos os cards do wireframe; contadores ≠ previsão; sino decorativo; header sem tap | GAP-016/017/020/024 |
| Quick Add (sheet) | ✅ | `/quick-add` | 🟡 página em vez de sheet; sem data; pool sem filtro de fase; split ✅ | GAP-001/010/018/027 |
| Lista de gastos | ✅ | `/expenses` | ✅ filtros, banner sem-carteira, vazio | — |
| Detalhe do gasto | ✅ | `/expenses/:id` | ✅ ver/editar/excluir, shares, impacto pessoal | GAP-025 (confirm nativo) |
| Planner | ✅ | `/planner` | ✅ multi-fase, presets, recomendação, persistência | — |
| Outing start | ✅ | `/outings/new` | 🟡 escolha de perfil + custom; sem configuração de limites | GAP-015 |
| Outing ativa | ✅ | `/outings/active` | 🟡 visual completo; sem alertas/split/reconciliação/revisão | GAP-002/005/006/012 |
| Simulador | ✅ | `/simulator` | 🟡 funcional; risco simplificado | F-35 |
| Compartilhados/Participantes | ✅ | `/shared` | 🟡 saldos+dívidas+settle; sem parcial/simplificação | GAP-032 |
| Carteiras | ✅ | `/wallets` | 🟡 CRUD+default+contagem; reconcile sem ajuste | GAP-011 |
| Fundos | ✅ | `/funds` | 🟡 criar+vincular; sem editar/excluir; sem future floor | GAP-008/009 |
| Perfis | ✅ | `/profiles` | 🟡 listar+criar; sem editar/excluir | DEC-037 parcial |
| Trip overview | ✅ | `/trip` | ✅ timeline + fundos + budget | — |
| Trip edit | ✅ | `/trip/edit` | 🟡 editar viagem/fases + criar fase; sem excluir fase; sem re-vincular fundo de fase existente | — |
| Mais | ✅ | `/more` | 🟡 falta Relatórios/Sobre | GAP-023 |
| Settings | ✅ | `/settings` | 🟡 falta moeda padrão | GAP-022 |
| Backup | ✅ | `/settings/backup` | 🟡 export/import/CSV; incompletos | GAP-003/004/021 |
| Relatórios | ❌ | — | D3+ (registrado na seção 9) | — |

**Rotas mortas:** nenhuma (todos os links navegam para rotas existentes; todas as rotas têm pelo menos um ponto de acesso).
**Elementos decorativos:** sino de notificações no dashboard (sem handler) — GAP-024.

---

## 6. Acceptance Criteria D1 (Appendix C do master-spec)

| # | Critério | Status | Evidência |
|---|---|---|---|
| 1 | Criar viagem com fases e orçamento via onboarding mínimo | ✅ | OnboardingPage 3 passos → entidades → dashboard |
| 2 | Registrar gastos (com/sem carteira) e ver "Livre para usar" diminuir | ✅ | QuickAdd + `calculateFreeToSpend`; carteira opcional |
| 3 | Compras pessoais independentes do orçamento da fase | 🟡 | Pool global funciona; dashboard detecta por nome; QuickAdd pode auto-selecionar o pool global (GAP-017/018) |
| 4 | Reserva protegida como Envelope, exibida no dashboard | ✅ | `onboarding.ts` cria envelope `protected_reserve`; hero breakdown exibe |
| 5 | Fase acessa múltiplos BudgetPools | 🟡 | Modelo+FundsPage ✅; QuickAdd não filtra por vínculo (GAP-018) |
| 6 | Export/import JSON com merge/resolução de conflito | ❌ | 10 tabelas faltando; merge descarta conflitos (GAP-003/004) |
| 7 | CSV com 17 campos corretos | ❌ | 10 campos (GAP-021) |
| 8 | Demo carrega e é claramente marcado | ✅ | WelcomePage `handleDemo` + banner `demo.banner` |
| 9 | Funciona em browser de celular com design system | ✅ | max-w 430, tokens Mediterranean Cockpit, deploy testado (HTTP 200) |
| 10 | Todos os cálculos de domínio com testes unitários | 🟡 | 105 testes em 12 módulos; **sem testes**: `transactions.ts`, `demo`, `onboarding`, `csv-export` (parcial via backup.test) |
| 11 | i18n externalizado (sem pt hardcoded) | ✅ | grep: zero strings pt em .tsx; todas as 232 chaves usadas existem no pt-BR.json |
| 12 | Dashboard só com features implementadas | ✅ | sem placeholders; cards condicionais |
| 13 | "Planejar" com editor básico | ✅ | (excede: planner completo D3) |
| 14 | Settings com todos os itens DEC-057 | 🟡 | falta moeda padrão; defaults divergentes (GAP-022) |
| 15 | "Mais" seccionado conforme DEC-059 | 🟡 | falta Relatórios/Sobre (GAP-023) |

**Resultado: 8 ✅ · 5 🟡 · 2 ❌**

---

## 7. Qualidade Transversal

**i18n**
- pt-BR: 298 chaves, 338 linhas; todas as 232 chaves usadas em código existem (verificação automatizada por diff). Famílias dinâmicas (`categories.*`, `simulator.risk_*`, `planner.preset_*`) completas.
- en/es: **8 linhas cada** (apenas `nav.*` vazios). Botões de idioma na Settings ativos mas sem efeito visível (fallback pt-BR). Idioma salvo não restaurado no boot (GAP-014/033).
- Zero strings em português hardcoded em `.tsx` (nomes próprios e "TripPilot v1.0" são aceitáveis).

**Rotas / handlers**
- 20 rotas registradas, todas alcançáveis; nenhum link para rota inexistente.
- 1 elemento decorativo: sino do dashboard (GAP-024). Nenhum `onClick={() => {}}` encontrado.

**Persistência**
- Todas as mutações passam por repositórios Dexie ✅. Soft-delete + revision via `entity-factory` ✅.
- Risco: estado não compartilhado entre instâncias de `useAppData` → telas montadas exibem dados velhos até remount (tema é o caso visível — GAP-013). `dexie-react-hooks` instalado e não usado.
- QuickAdd shared: tx + N shares gravados em chamadas sequenciais sem transação Dexie (risco de share órfão em crash) — relacionado ao GAP-030.

**Testes**
- Unit: 105/105 ✅ em 12 módulos de domínio. Sem testes: `transactions`, `demo`, `onboarding`. Sem testes de componente (test-plan-d1 §component: QuickAdd, Dashboard, Onboarding). E2E: 5 specs Playwright presentes (dashboard, navigation, onboarding, pwa, quick-add) — não executados nesta auditoria (requer browsers instalados).
- test-plan-d1 prevê casos para split/withdrawal/multi-pool: split coberto em `splitting.test.ts`; withdrawal **não tem teste** (e está quebrado — GAP-001).

**PWA**
- manifest.json ✅ (icons 192/512 + maskable, shortcuts para quick-add e outing). SW manual cache-first ✅. `_redirects` SPA ✅. Typecheck/build limpos.
- Falta: indicador "Pronto para uso offline" (DEC-053d); precache só de 3 URLs estáticas (GAP-036).

**project-status.md vs realidade**
- Diz "Implementation: NOT STARTED — D1 não começou". Realidade: D1–D6 implementados (`src/dev-log.md`: "D6 COMPLETE — ALL DELIVERIES DONE"; `src/fix-log.md`: 13/13 issues corrigidos). Ver seção 8.

---

## 8. Contradições no Brain

1. **`project-status.md` × `src/dev-log.md`** — status diz "NOT STARTED / Next step: gerar pacote D1"; o dev-log registra D1–D6 completos com gates e testes. **Correção necessária:** atualizar project-status.md para refletir D6 + esta auditoria.
2. **`domain-functions-d1.md` × código** — o doc define orquestradores (`registerExpense`, `endOutingSession`...) como entregáveis D1; `src/domain/orchestrators/` está vazio e a UI chama repositórios diretamente. Ou o doc se ajusta, ou vira débito (GAP-030).
3. **DEC-057 (reminder 7 dias) × `master-spec`/código (3 dias)** — o default implementado (3) diverge do DEC (7). Decidir qual vale e alinhar.
4. **DEC-045 (defaults €3/5/7/10/15) × settings seed (€3/5/10/15/20)** — divergência interna entre decisão e implementação; nenhum doc do brain registra a mudança.
5. **`database-schema.md` (índices compostos + populate) × `schema.ts`** — schema doc promete `[tripId+order]`, `[tripId+date]`, populate de settings/devices; implementação não tem nenhum. Funciona (volumes pequenos), mas o doc afirma algo que o código não faz.
6. **`v1-screen-list.md` inclui "Relatórios"** enquanto `implementation-phases.md` coloca relatórios em D3+ — o "Mais" do DEC-059 lista Relatórios como item da seção Dados. Esclarecer se entra como placeholder ou só em D3.

---

## 9. Fora de Escopo do Delivery Atual (D2+ — registrado para não se perder)

| Item | Fonte | Observação |
|---|---|---|
| Multi-moeda com câmbio (`exchangeRate`) | DEC-021, schema | Campos existem, sempre null |
| Relatórios (tela + gráficos) | v1-screen-list, D3 | Inexistente (correto para agora) |
| Reserva futura automática (3 níveis essencial/recomendado/confortável) | DEC-016 | O **piso manual** é gap de agora (GAP-008); o cálculo automático é D3+ |
| PlannedOccurrence (eventos comprometidos com data) | DEC-043 | Tabela existe, nenhuma UI |
| AlertRules configuráveis | schema | Tabela existe, nenhuma UI |
| ForecastSnapshots (histórico de previsões) | schema | Tabela existe, nunca gravada |
| Notificações locais / haptics confiáveis | DEC-017 | Requer Capacitor (APK) |
| Multi-device sync real (linkedUserAccountId) | DEC-018/056 | Schema preparado ✅ |
| Risco combinado completo no simulador | DEC-050 | Versão % é aceitável em D1; combinada é D4+ |
| Tradução efetiva en/es | DEC-054 | Estrutura é gap (GAP-033); tradução é V2 |

---

## 10. Log de Exaustividade

Passes principais: **5/5 executados** (P1 features, P2 DECs, P3 telas, P4 jornadas/golden paths, P5 transversal).

Jornadas auditadas (P4): onboarding→dashboard ✅ · registrar gasto ✅ · gasto compartilhado+acerto 🟡 (pendência eterna) · saque 🟠 · transferência 🟡 · saída completa início→fim 🟠 (sem revisão) · saída custom ✅ · multi-fase (criar fase+fundo+planner) 🟡 (sem future floor) · simulador via Amigo Sincero ✅ · backup export→import 🟠 (perda de dados) · reconciliação de caixa 🟠 · troca de tema 🟠 (exige refresh).

Rounds de verificação (critério mecânico):

| Round | Lente | Gaps novos |
|---|---|---|
| R1 | Rotas mortas + elementos decorativos | 2 (sino decorativo; header sem tap) |
| R2 | Chaves i18n dinâmicas + categorias | 0 |
| R3 | Persistência/refresh + onboarding | 1 (sem carteiras no onboarding) |
| R4 | Appendix C item por item | 0 |
| R5 | Integridade do demo data | 1 (demo sem shared/sessões) |
| R6 | Anti-patterns design system | 0 |
| R7 | Configs/dependências | 0 |

`Gaps novos por round: [2, 0, 1, 0, 1, 0, 0]` → **dois rounds consecutivos com zero → critério de parada atingido.**

---

## 11. Próximos Passos Recomendados

**Bloco 1 — Integridade financeira (CRÍTICO, ~1 sessão)**
1. GAP-001: saque = transferência banco→cash (usar `createTransferTransaction` + UI de carteira destino).
2. GAP-010: transferência via domínio correto (`budgetPoolId null`).
3. GAP-011: reconciliação de caixa cria `createAdjustmentTransaction`.
4. GAP-006: "Registrar total atual" → ajuste pela diferença (DEC-046).
5. Testes unitários para os 4 fluxos (withdrawal/transfer/reconciliation/total-adjustment).

**Bloco 2 — Outing Mode completo (CRÍTICO/ALTO, ~1-2 sessões)**
6. GAP-002: tela de revisão de encerramento (carteira em lote, classificação, confirmação).
7. GAP-005: alertas progressivos + vibração (ligar `getProgressiveAlerts` + `settings.alertTone`).
8. GAP-015: configuração de limites no início da sessão + fallbacks de perfil.
9. GAP-012: split dentro da sessão.
10. GAP-007: ligar `updateProfileFromTransaction` no fim da sessão/registro.

**Bloco 3 — Dados seguros (ALTO, ~1 sessão)**
11. GAP-003: backup com as 21 tabelas + versão de formato.
12. GAP-004: merge por revision com resolução de conflito.
13. GAP-021: CSV 17 campos + modo avançado.
14. GAP-029: validar import com Zod.

**Bloco 4 — Orçamento completo (ALTO, ~1 sessão)**
15. GAP-008: UI de future floor (TripEdit/Funds) → linha "Reservado" real.
16. GAP-009: edição da reserva protegida + envelopes.
17. GAP-018: pools do QuickAdd filtrados por fase + prompt criar fundo.
18. GAP-017: personal shopping por `scope === 'global'`.
19. GAP-019: edge cases DEC-053 (a)(b)(c).

**Bloco 5 — UX e estado (MÉDIO, ~1 sessão)**
20. GAP-013/014: settings compartilhados (tema ao vivo) + idioma restaurado no boot.
21. GAP-016: critério real de "pendente de confirmação".
22. GAP-020: contadores de ocasião = previsão do planner.
23. GAP-024/025/026/027/028: navegação do header, modais próprios, carteiras no onboarding, data no QuickAdd, quick-add values alinhados.

**Bloco 6 — Polish e brain (BAIXO)**
24. GAP-022/023: settings/mais completos; lembrete de backup funcionando.
25. GAP-030/031/032/033/034/035/036: orquestradores, índices, settlements, estruturas en/es, deps, demo enriquecido, offline indicator.
26. Atualizar `project-status.md` (+ contradições da seção 8) no brain.

---

*Auditoria executada em chat direto, sem agentes, sem modificação de código de produção. Toda afirmação cita arquivo de origem; todo gap cita a fonte no brain.*
