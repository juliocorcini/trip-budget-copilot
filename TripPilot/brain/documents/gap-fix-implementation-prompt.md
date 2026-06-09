# IMPLEMENTAÇÃO COMPLETA DOS GAPS — TripPilot

> **Modo**: Chat direto — sem agents, sem subagents, sem Task tool
> **Fonte da verdade**: `TripPilot/brain/documents/gap-analysis-2026-06-09.md` (36 gaps auditados com evidência)
> **Objetivo**: 36/36 gaps resolvidos · 21 DECs violados → 0 · AC D1 15/15 · brain atualizado · deploy novo no ar
> **Método**: 8 gates sequenciais com checkpoint, state file persistente e context refresh entre gates
> **Baseline protegida**: 105/105 testes passando, build limpo, typecheck limpo — NUNCA pode regredir

---

## IDENTIDADE

Você é um desenvolvedor senior full-stack implementando TODOS os fixes do gap analysis **sozinho, nesta conversa**. Você é executor — FAÇA, não fale sobre fazer.

**Regras absolutas:**
- NÃO delegue para agents/subagents/Task tool
- NÃO peça confirmação entre gates — todas as decisões ambíguas já estão pré-resolvidas neste prompt
- NÃO resuma o que vai fazer — implemente
- NÃO pare porque "conversa longa" — use o protocolo de recovery e continue
- NÃO corrija nada fora dos gaps listados — escopo é lei
- PRESERVE os 105 testes verdes — qualquer teste que quebrar é regressão sua e deve ser corrigido antes de seguir

---

## ⚓ ÂNCORA — REGRAS INVIOLÁVEIS

Releia este bloco no início de CADA gate e reproduza-o no checkpoint:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
1. PROCURE ANTES DE ESCREVER: a maioria dos gaps é função de domínio
   JÁ EXISTENTE e TESTADA que nunca foi ligada à UI. Antes de criar
   qualquer função, grep no src/domain/. Funções prontas esperando:
   createTransferTransaction, createAdjustmentTransaction,
   getProgressiveAlerts, updateProfileFromTransaction,
   calculateOccasionForecasts, suggestSimplifiedSettlements,
   analyzeImport, schemas Zod em validation/schemas.ts
2. Money = integer cents (DEC-020)
3. Transferência/saque: budgetPoolId = null, personalCostCents = null
   — NUNCA tocam o orçamento (Core Rule 3)
4. Brain vence o código: divergência → o código muda (exceto decisões
   pré-resolvidas abaixo, que atualizam o brain)
5. UI text = t() sempre, zero hardcode (DEC-054). Toda chave nova
   entra em pt-BR.json NA HORA
6. Domain = pure TS, zero React imports. UI nunca chama cálculo inline
7. Soft delete + revision via entity-factory em toda mutação (DEC-004)
8. Nunca bloquear registro de gasto — edge cases são confirmatórios,
   não bloqueantes (DEC-053)
9. Zero diálogos nativos novos (alert/prompt/confirm) — use os
   primitivos do design system (criados no Gate 2)
10. Code = English | UI = pt-BR via i18n
11. npm run test + npm run build + npm run typecheck verdes em
    TODO checkpoint de gate
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

---

## DECISÕES PRÉ-RESOLVIDAS (não pergunte — execute e registre no brain)

A auditoria encontrou ambiguidades e contradições (seção 8 do gap analysis). Para você nunca travar, elas já estão decididas. No Gate 7 você registra cada uma no `decision-log.md`:

| # | Ambiguidade | Decisão | Racional |
|---|---|---|---|
| D-A | Backup reminder: 3 dias (código) vs 7 (DEC-057) | **7 dias** | DEC vence o código (Truth Policy) |
| D-B | Quick-add defaults: €3/5/10/15/20 (código) vs €3/5/7/10/15 (DEC-045) | **€3/5/7/10/15** | DEC vence o código |
| D-C | "Pendente de confirmação" (GAP-016): qual critério? | Pendente = transação shared com pelo menos um `participantShare` de terceiro **não coberto por settlement**. Acertou tudo → some do card | Único critério verificável com o modelo atual; DEC-056 manda esconder quando vazio |
| D-D | "Relatórios" no menu Mais (contradição 6) | **NÃO adicionar** — é D3+. Adicionar apenas item "Sobre" próprio (DEC-059) | implementation-phases.md vence v1-screen-list.md |
| D-E | en/es vazios (GAP-033) | Criar estrutura completa (espelho do pt-BR) **e traduzir** en + es | Custo de tradução por IA é trivial; elimina o fallback silencioso da Settings |
| D-F | Estado compartilhado (GAP-013): Zustand vs Context vs liveQuery | **`useLiveQuery` do dexie-react-hooks** (já instalado) para settings no AppShell + telas que exibem settings | Idiomático para Dexie, zero camada nova; remove a necessidade do zustand |
| D-G | Deps sem uso (GAP-034) | Ao final do Gate 7: se `zustand`/`react-hook-form` continuarem sem import, **remover do package.json** | Hygiene §4.1 |
| D-H | Orquestradores (GAP-030): refactor total vs parcial | **Parcial**: criar orquestradores APENAS para os fluxos tocados nesta sessão (registerExpense c/ shares atômico via `db.transaction`, endOutingSession, withdrawCash, transferBetweenWallets, reconcileWallet). Refactor total das telas não tocadas fica registrado como débito | Corrige o risco real (share órfão) sem refactor gigante fora de escopo |
| D-I | Future floor automático (DEC-016) | Só o **piso manual** (campo na UI). Cálculo automático = D3+, registrar na seção 9 do brain | Conforme a própria auditoria delimitou |
| D-J | Datas do reminder de backup | Persistir `lastBackupDate` ao exportar; dashboard mostra banner discreto quando `hoje - lastBackupDate > backupReminderDays` | Único jeito do toggle deixar de ser decorativo |

---

## STATE FILE (crie ANTES de qualquer código)

Crie `TripPilot/src/gap-fix-log.md` e atualize após CADA gap concluído:

```markdown
# Gap Fix Log — TripPilot
## Current State
- **Gate ativo**: [0-8]
- **Gap ativo**: GAP-NNN
- **Gaps resolvidos**: X/36
- **Testes**: X passing (baseline 105)
- **Build/Typecheck**: clean/broken

## Por gate
### Gate 1
- [x] GAP-001 — saque como transferência — arquivos: [...] — teste novo: [...]
- [ ] GAP-010 — ...

## Decisões aplicadas
- [x] D-A registrada
...

## Problemas extras encontrados (NÃO corrigir — só anotar)
- [EXT-01]: ...
```

---

## MAPA DE GATES

```
GATE 0  Baseline + state file                          (setup)
GATE 1  Integridade financeira    GAP-001 010 011 006  (CRÍTICO)
GATE 2  Outing Mode completo      GAP-002 005 015 012 007 (CRÍTICO/ALTO)
GATE 3  Dados seguros             GAP-003 004 021 029  (ALTO)
GATE 4  Orçamento completo        GAP-008 009 018 017 019 (ALTO)
GATE 5  UX e estado vivo          GAP-013 014 016 020 024 025 (MÉDIO)
GATE 6  Polish de fluxo           GAP-026 027 028 022 023 (MÉDIO)
GATE 7  Infra + brain             GAP-030 031 032 033 034 035 036 + brain (BAIXO)
GATE 8  Verificação final + deploy
```

**Antes de cada gate**: releia a seção correspondente do `gap-analysis-2026-06-09.md` (ela tem o detalhe completo de cada gap: evidência, arquivos, "o que falta exatamente"). Este prompt define ordem, decisões e critérios de aceite — o gap analysis define o conteúdo. Os dois juntos são sua especificação.

---

## GATE 0 — BASELINE

```
1. cd TripPilot
2. npm run test && npm run build && npm run typecheck → anote números no state file
3. Crie src/gap-fix-log.md
4. Leia em paralelo: src/app/router.tsx, src/domain/transactions/transactions.ts,
   src/hooks/useAppData.ts, src/data/db/schema.ts
```

---

## GATE 1 — INTEGRIDADE FINANCEIRA (números errados que o Julio vê no primeiro teste)

**GAP-001 — Saque = transferência banco→cash**
- `QuickAddPage` rota `?type=withdrawal`: trocar o caminho atual (`adjustment` com pool) por `createTransferTransaction` com carteira origem (banco) + destino (cash), `budgetPoolId/personalCostCents = null`
- UI: remover seleção de fundo/categoria do fluxo withdrawal; adicionar seletor de carteira destino (filtrar carteiras tipo cash se o modelo tiver tipo; senão, seletor livre)
- DONE quando: saque não altera "Livre para usar"; origem debita; destino credita

**GAP-010 — Transferência via domínio correto**
- Mesmo arquivo: fluxo `?type=transfer` passa a usar `createTransferTransaction`; remover fundo/categoria; validar origem ≠ destino
- DONE quando: transfer grava `budgetPoolId = null`, `personalCostCents = null`

**GAP-011 — Reconciliação de caixa cria ajuste**
- `WalletsPage`: substituir o `alert()` por sheet com a diferença calculada → CTA "Criar ajuste" → `createAdjustmentTransaction` (negativo: escolher categoria; positivo: campo justificativa) — DEC-052
- Nota: o primitivo Sheet só nasce no Gate 2; aqui use um sheet inline simples e migre no Gate 2, OU antecipe a criação do primitivo aqui (preferível — veja Gate 2)
- DONE quando: confirmar ajuste grava transação, atualiza saldo da carteira e orçamento

**GAP-006 — "Registrar total atual" = reconciliação (DEC-046)**
- `OutingPage`: substituir `prompt()`; calcular `diff = informado - calculateSessionTotal()`; criar item "Ajuste para total informado" com a DIFERENÇA; se diff < 0, confirmação explícita; nunca apagar itens
- DONE quando: com itens somando €30, informar €45 cria ajuste de +€15 (não +€45)

**Milestone final do gate — testes:**
- Testes unitários novos para os 4 fluxos: withdrawal, transfer, reconcile (±), total-adjustment (±). `src/domain/transactions/` não tem testes hoje (AC-10) — crie `transactions.test.ts`

---

## GATE 2 — OUTING MODE COMPLETO

**Milestone 2.0 — Primitivos do design system (pré-requisito do gate):**
- `src/components/BottomSheet.tsx` e `src/components/Toast.tsx` seguindo `design-system.md` (tokens, contrast tiers, animação leve). Toast com variantes info/warning/danger
- Migrar o sheet inline do GAP-011 (se ficou inline) para o primitivo

**GAP-015 — Configuração de limites no início da sessão**
- `/outings/new`: após escolher perfil, etapa de confirmação editável: nome, três limites (target/ceiling/max — DEC-010), avg drink price, quick-add values (DEC-045)
- Fallback para perfis sem defaults: derivar de `typicalValue/safeValue` do perfil (ex.: target = safe, ceiling = typical×1.25, max = typical×1.5 — arredonde para múltiplos de €5); zero perfis com gauge morto
- DONE quando: TODA sessão nasce com três limites válidos

**GAP-005 — Alertas progressivos + vibração (DEC-048)**
- Ligar `getProgressiveAlerts` no fluxo de quick-add da sessão; Toast ao cruzar 50/75/90/100% com texto no tom do `settings.alertTone`; `navigator.vibrate` se `settings.vibrationEnabled`; registrar marcos já disparados no estado da sessão (não repetir)
- DONE quando: cruzar marco dispara toast 1x; vibração respeita o toggle

**GAP-012 — Split dentro da sessão (DEC-047)**
- Ação "dividir" no quick-add da sessão → BottomSheet com participantes + quem pagou + igual/custom, reusando a lógica/domínio do QuickAddPage (extraia para função compartilhada se preciso — não duplique)
- Total da sessão considera `personalCostCents` para gastos shared
- DONE quando: gasto shared na sessão grava shares e o gauge avança só a parte pessoal

**GAP-002 — Tela de revisão de encerramento (DEC-049) — o maior item da sessão**
- "Encerrar" abre revisão (página ou sheet expandido): total, lista de itens editáveis, **atribuição de carteira em lote** (resolve o `walletId: null` permanente), diferença de caixa opcional (reusa lógica do GAP-011), classificação típica/especial + flag `excludeFromLearning`, CTA "Confirmar e encerrar saída"
- Persistir `isSpecialOccasion`/`excludeFromLearning` nas transações da sessão
- DONE quando: encerrar passa pela revisão; carteira aplicada em lote; flags persistidas

**GAP-007 — Ligar o motor de aprendizado (DEC-006)**
- Chamar `updateProfileFromTransaction` ao confirmar encerramento (para cada item não-excluído) e ao registrar gasto com `activityProfileId`
- DONE quando: encerrar sessão atualiza typical/safe/confidence/dataPointCount do perfil; ocasião especial NÃO atualiza

**Orquestrador (D-H):** `endOutingSession` em `src/domain/orchestrators/` coordenando: aplicar carteira em lote → flags → aprendizado → completar sessão, com `db.transaction` onde couber. Teste unitário do orquestrador.

---

## GATE 3 — DADOS SEGUROS (backup/CSV)

**GAP-003 — Backup com as 21 tabelas**
- `src/domain/backup/backup.ts` + `BackupPage`: incluir sessions, sessionItems, settlements, scenarioPlans, scenarioAllocationItems, plannedOccurrences, forecastSnapshots, futurePhaseReservePolicies, alertRules, devices no export E no import
- Versionar formato (`schemaVersion` no JSON); import aceita versão antiga (tabelas ausentes = vazias)

**GAP-004 — Merge por revision**
- Import merge: para cada registro existente, comparar `revision`/`updatedAt` — importado mais novo → update; mais velho → manter; eliminar o `.catch(() => {})`. Usar o resultado do `analyzeImport` (já existe) no preview
- DONE quando: importar backup com registro de revision maior atualiza o registro local

**GAP-029 — Zod no import**
- `parseBackupFile` valida contra os schemas de `validation/schemas.ts` antes de gravar; arquivo malformado → erro claro via Toast, zero gravação parcial

**GAP-021 — CSV 17 campos + modo avançado (DEC-058)**
- `csv-export.ts`: adicionar Hora, Viagem, Caixa/Sessão, Quem pagou, Custo pessoal, Valor compartilhado, Observações, Moeda, Valor em moeda base; toggle básico/avançado na BackupPage (avançado: +ID, Status, Criado/Atualizado em, Dispositivo)
- Atualizar/adicionar testes de `csv-export`

**Milestone final:** teste round-trip — export completo → import em DB limpo → contagem de registros idêntica por tabela.

---

## GATE 4 — ORÇAMENTO COMPLETO

**GAP-018 — Pools do QuickAdd filtrados por fase (DEC-039/040)**
- Filtrar pools por `BudgetPoolPhaseLink` da fase ativa + globais; auto-selecionar SÓ quando houver exatamente 1 pool operacional (globais exigem escolha consciente); sem pool → empty-state com CTA "Criar fundo" (→ `/funds`)

**GAP-017 — Personal shopping por scope**
- `DashboardPage`: trocar detecção por nome por `p.scope === 'global'` (se houver vários globais, somar ou listar — escolha listar)

**GAP-008 — Future floor manual (DEC-016, decisão D-I)**
- Campo "Reservar para esta fase" (cents) ao vincular fase↔fundo em FundsPage/TripEditPage → grava `futureFloorCents` no link; linha "Reservado para próximas fases" do dashboard passa a refletir valores reais; exibir no Planner como restrição informativa

**GAP-009 — Gestão de envelopes (DEC-042)**
- Editar a reserva protegida pós-onboarding (em Fundos ou Trip Edit): alterar valor, com impacto refletido no hero breakdown; CRUD básico de envelopes `allocation` por fundo (lista + criar + editar valor + soft delete)

**GAP-019 — Edge cases DEC-053 (a)(b)(c) — todos confirmatórios, nunca bloqueantes**
- (a) registrar gasto com `freeToSpend <= 0` → sheet de confirmação "orçamento zerado, registrar mesmo assim?"
- (b) quick-add na sessão acima do max → confirmação, e lembrar por 15 min (timestamp no estado da sessão)
- (c) sessão ativa cruzando limite de fase → ao registrar, oferecer manter/mover/dividir
- ((d) offline indicator fica no Gate 7, GAP-036)

**Milestone final:** testes para `futureFloor` no cálculo de `freeToSpend` (se ainda não coberto) e para o filtro de pools por fase.

---

## GATE 5 — UX E ESTADO VIVO

**GAP-013 — Settings vivos (decisão D-F)**
- `AppShell` (e BottomNav se necessário) lê settings via `useLiveQuery` → trocar tema aplica NA HORA, sem refresh. Avalie aplicar o mesmo em `useAppData` para settings de forma geral (mínimo: theme/language/alertTone)

**GAP-014 — Idioma restaurado no boot**
- Bootstrap (main/App): após carregar settings, `i18n.changeLanguage(settings.language)` antes do primeiro render (ou com fallback visual mínimo)

**GAP-016 — Pendência real (decisão D-C)**
- `DashboardPage`: `pendingShared` = shared com share de terceiro sem settlement cobrindo; card some quando vazio (DEC-056); tap no card → `/shared`

**GAP-020 — Contadores = previsão (DEC-006/043)**
- Ligar `calculateOccasionForecasts` com o ScenarioPlan ativo da fase → contadores mostram "X restantes" (planejado − feito); manter contagem feita como secundária

**GAP-024 — Navegação do header (DEC-060)**
- Nome da fase no header → tap navega `/trip`; sino de notificações → tap navega `/shared` (badge já existe)

**GAP-025 — Matar diálogos nativos**
- Substituir TODOS os `alert/prompt/confirm` restantes por BottomSheet/Toast: "Outro" valor na sessão (teclado numérico), confirm de delete no ExpenseDetailPage, erros de saída. Ao final: `rg "alert\(|prompt\(|window.confirm" src/` → 0 resultados

---

## GATE 6 — POLISH DE FLUXO

**GAP-026 — Carteiras no onboarding (DEC-051)**
- `onboarding.ts`: criar carteira default "Cartão de crédito" (editável) + marcar como default wallet; passo opcional para adicionar "Dinheiro"

**GAP-027 — Data/hora no QuickAdd**
- Campo opcional de data/hora (default agora) no registro — permite gasto retroativo

**GAP-028 — Quick-add values alinhados (DEC-045, decisões D-B)**
- Default `[300,500,700,1000,1500]` no `app-settings-repository`; eliminar o fallback divergente da OutingPage (uma fonte só); highlight no botão mais próximo do avg drink price da sessão; valores editáveis na configuração de início (já feito no GAP-015) e durante a sessão

**GAP-022 — Settings completo (DEC-057, decisões D-A e D-J)**
- Adicionar moeda padrão; reminder default 7 dias (+ opção 7 na lista); persistir `lastBackupDate` no export; banner de lembrete no dashboard quando vencido; vibração já ficou funcional no Gate 2 — confirme

**GAP-023 — "Mais" com Sobre (decisão D-D)**
- Item "Sobre" próprio na seção Aplicativo (versão, link backup); NÃO adicionar Relatórios

---

## GATE 7 — INFRA + BRAIN

**Gaps pequenos (na ordem):**
- **GAP-031**: índices compostos no `schema.ts` (`[tripId+order]`, `[tripId+date]` etc. conforme database-schema.md) via nova versão Dexie; `db.on('populate')` para settings/device
- **GAP-032**: settle com confirmação + valor parcial; usar `suggestSimplifiedSettlements` para exibir sugestão "simplificar dívidas" quando houver 3+ participantes com dívidas cruzadas
- **GAP-033** (decisão D-E): `en.json` e `es.json` espelhando TODAS as chaves do pt-BR (incluindo as novas desta sessão), traduzidas. Settings: os 3 idiomas funcionam de verdade
- **GAP-035**: demo data ganha 2-3 gastos shared (com participantShares), 1 sessão completed com items e 1 settlement — demo demonstra split/dívidas/outing
- **GAP-036**: indicador "Pronto para uso offline" (DEC-053d) — toast/badge quando o SW ativa; melhorar precache com os assets do build se viável sem plugin (senão, registrar como débito)
- **GAP-030** (decisão D-H): garantir que os orquestradores criados (registerExpense, endOutingSession, withdrawCash, transferBetweenWallets, reconcileWallet) estão em `src/domain/orchestrators/` com testes; anotar refactor restante como débito no brain
- **GAP-034** (decisão D-G): `rg "zustand|react-hook-form" src/` → se 0 usos, remover do package.json + `npm install`

**Atualização do brain (obrigatória, mesma sessão):**
1. `project-status.md` → refletir realidade: D1–D6 implementados + esta sessão de gap-fixes; data de atualização
2. `decision-log.md` → registrar D-A..D-J como decisões (formato DEC-NNN sequencial, status approved, referência a este prompt)
3. Contradições da seção 8 do gap analysis → corrigir cada doc divergente (domain-functions: anotar orquestradores parciais; database-schema: agora bate com schema.ts; DEC-045/057: código alinhado)
4. `gap-analysis-2026-06-09.md` → adicionar no topo: "> Status: RESOLVIDO em 2026-MM-DD — ver gap-fix-log"
5. Bump version no `package.json` (0.1.0 → 0.2.0)

---

## GATE 8 — VERIFICAÇÃO FINAL + DEPLOY

```
1. npm run test       → 105+ testes, 100% verde (mais que a baseline — você criou novos)
2. npm run typecheck  → 0 erros
3. npm run build      → clean
4. npx playwright test → se browsers disponíveis (npx playwright install --with-deps chromium);
   se não der, registre no log e siga
5. RE-AUDITORIA RÁPIDA — para cada um dos 36 gaps, releia o "DONE quando"
   e confirme no código (não de memória). Gere a tabela:
   GAP-001 ✅ | GAP-002 ✅ | ... | GAP-036 ✅
6. Golden paths de regressão (trace no código): onboarding→dashboard,
   registrar gasto, saída completa início→revisão→fim, backup export→import,
   saque, troca de tema ao vivo
7. rg "alert\(|prompt\(|window.confirm" src/ → 0
8. Verificar chaves i18n: toda chave usada existe em pt-BR E en E es
9. Deploy: npx wrangler pages deploy dist --project-name=trippilot
10. Entregar: 🚀 URL + tabela 36/36 + resumo do que mudou por gate
```

---

## PROTOCOLO DE CHECKPOINT (obrigatório ao fim de CADA gate)

```
GATE [N] CONCLUÍDO
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Gaps resolvidos neste gate: [lista com ✅]
Arquivos modificados: [lista]
Testes: X passing (baseline 105 + Y novos) | Build ✅ | Typecheck ✅
Chaves i18n novas: [N] adicionadas ao pt-BR.json
Regressão verificada: [2-3 fluxos anteriores re-checados + resultado]
Fora de escopo tocado? [não / o quê e por quê]
State file atualizado: ✅
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[reproduza o bloco ÂNCORA]
PRÓXIMO: Gate [N+1] — [releia a seção do gap analysis correspondente]
```

**Mid-gate refresh**: após cada 3 gaps dentro de um gate, releia a ÂNCORA e o Current State do gap-fix-log.md (sem output longo — 3 linhas).

---

## RECOVERY PROTOCOL (se perder contexto a qualquer momento)

1. Leia `TripPilot/src/gap-fix-log.md` → gate/gap ativo
2. Releia a ÂNCORA e a seção do gate ativo NESTE prompt
3. Releia a seção do gap ativo no `gap-analysis-2026-06-09.md`
4. `npm run test` para confirmar o estado real
5. Continue do último checkbox aberto — NUNCA recomece um gate concluído

---

## REGRAS DE IMPLEMENTAÇÃO

- **Commits**: 1 por gate — `fix(gate-N): <resumo dos gaps>` (ex.: `fix(gate-1): financial integrity — withdrawal, transfer, reconciliation, session total adjustment`)
- **Reuso primeiro**: split da sessão reusa o domínio do QuickAdd; revisão de encerramento reusa a reconciliação do Gate 1; sheet/toast criados 1x no Gate 2 e reusados em tudo
- **Persistência**: toda mutação via repositório; multi-write relacionado (tx + shares) via `db.transaction` no orquestrador
- **Testes novos mínimos**: transactions (4 fluxos), endOutingSession, merge por revision, csv 17 campos, futureFloor no freeToSpend, pendência D-C
- **i18n em 2 tempos**: durante os Gates 1-6, novas chaves só em pt-BR; no Gate 7 (GAP-033) o en/es absorve TUDO de uma vez
- **Design system**: warnings amber, danger vermelho do tema, primário terracotta; contrast tiers dim/faint conforme tokens

---

## CRITÉRIO DE PARADA

```
DONE quando TUDO = TRUE:
- [ ] 36/36 gaps com "DONE quando" confirmado no código (tabela do Gate 8)
- [ ] 10 DECs violados (006,016,045,046,047,048,052,053,058,049) → ✅
- [ ] AC D1: 15/15 (os 2 ❌ e 5 🟡 da seção 6 resolvidos)
- [ ] 0 diálogos nativos em src/
- [ ] pt-BR + en + es completos e sincronizados
- [ ] Testes ≥ 105 + novos, 100% verdes | Build + Typecheck clean
- [ ] Decisões D-A..D-J registradas no decision-log.md
- [ ] project-status.md + contradições da seção 8 corrigidos
- [ ] Deploy novo no ar com URL entregue
- [ ] gap-fix-log.md completo (36 checkboxes + extras anotados)
```

---

## COMECE AGORA

1. GATE 0: baseline + state file
2. GATE 1: comece pelo GAP-001 (o bug que o Julio vê primeiro)
3. Checkpoint a cada gate, recovery se precisar, NUNCA pule a atualização do state file
4. Termine com deploy + tabela 36/36 + URL

**A baseline é 105 testes verdes. Você só termina com mais testes e todos verdes. GO.**
