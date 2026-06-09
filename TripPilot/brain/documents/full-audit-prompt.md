# AUDITORIA TOTAL + CORREÇÃO — TripPilot

> **Modelo**: composer-2.5
> **Modo**: Chat direto — sem agents
> **Objetivo**: App 100% funcional, zero dead-ends, zero strings hardcoded, toda feature acessível e testada
> **Método**: Simular um usuário real tentando usar CADA funcionalidade

---

## IDENTIDADE

Você é um QA lead + senior developer. Primeiro você DESTRÓI o app (encontra todo problema) — depois RECONSTRÓI (corrige cada um). Você é meticuloso, obsessivo, e NÃO deixa passar nada.

Seu padrão de qualidade: **"Se eu fosse um usuário real tentando usar isso durante uma viagem, eu ficaria preso em algum momento?"** Se a resposta for sim em QUALQUER ponto, é um bug.

---

## MÉTODO: GOLDEN PATH TESTING

Em vez de auditar por arquivo, audite por **jornada do usuário**. Cada golden path é uma sequência de ações que um usuário real faria. Se QUALQUER passo falhar, o path está quebrado.

### Golden Path 1: Primeiro Uso
```
1. Abrir app pela primeira vez → deve ver WelcomePage
2. Clicar "Criar viagem" → deve abrir OnboardingPage
3. Preencher: nome, datas, valor, reserva, nome do dono
4. Clicar "Começar" → deve ir para Dashboard
5. Dashboard mostra "Livre para usar" com o valor calculado
6. Notification icon visível (mesmo sem notificações)
7. Bottom nav funcional com 5 items + FAB central
```

### Golden Path 2: Registrar Gasto
```
1. No dashboard, clicar FAB (+) → menu com 6 opções abre
2. Clicar "Registrar gasto" → QuickAddPage abre
3. Digitar valor, selecionar categoria, escolher fundo
4. Opcionalmente selecionar carteira (ou deixar "não informada")
5. Salvar → volta para dashboard
6. "Livre para usar" DIMINUIU pelo valor registrado
7. Gasto aparece em "Gastos recentes" no dashboard
8. Ir para tab "Gastos" → gasto aparece na lista
```

### Golden Path 3: Registrar Mercado (via FAB)
```
1. FAB → "Registrar mercado" → QuickAdd abre COM categoria "market" pré-selecionada
2. Digitar valor → salvar → volta
3. Contador de "mercados" no dashboard incrementou
```

### Golden Path 4: Backup e Restauração
```
1. Tab "Mais" → "Backup e importação" → BackupPage
2. Clicar "Exportar JSON" → arquivo baixa
3. Clicar "Exportar CSV" → arquivo baixa com 17+ campos
4. Clicar "Importar JSON" → selecionar arquivo → ver preview
5. Escolher merge/replace → confirmar → dados carregados
```

### Golden Path 5: Navegação Completa
```
1. Tab "Início" → DashboardPage renderiza
2. Tab "Gastos" → ExpenseListPage renderiza
3. Tab "Planejar" → PlannerPage renderiza
4. Tab "Mais" → MorePage renderiza
5. Mais → "Visão geral" → ALGUMA PÁGINA funcional
6. Mais → "Editar fases" → ALGUMA PÁGINA funcional
7. Mais → "Fundos" → PlannerPage (ou dedicada)
8. Mais → "Participantes e dívidas" → SharedExpensesPage
9. Mais → "Carteiras" → ALGUMA PÁGINA funcional
10. Mais → "Backup" → BackupPage
11. Mais → "Exportar CSV" → ação executa ou BackupPage
12. Mais → "Configurações" → SettingsPage renderiza
```

### Golden Path 6: Demo Data
```
1. WelcomePage → "Dados de demonstração" → carrega
2. Dashboard mostra dados fictícios completos
3. Banner "demonstração" visível
4. Todas as seções do dashboard populadas
5. Lista de gastos tem 8-12 expenses
6. Planner mostra pools com dados
```

### Golden Path 7: Settings Completo
```
1. SettingsPage → tom de alerta: 3 opções, selecionável
2. Tema: dark/light/system, selecionável
3. Vibração: toggle funcional
4. Backup reminder: toggle + dias configurável
5. Idioma: seletor funcional (DEC-057)
6. Nome do dispositivo: campo editável (DEC-057)
7. Carteira padrão: seletor funcional (DEC-057)
```

### Golden Path 8: Simulador
```
1. FAB → "Simular compra" → SimulatorPage
2. Mostra saldo disponível atual
3. Digitar valor → ver resultado com risco colorido
4. Texto em português VIA i18n (não hardcoded)
5. Botão voltar funcional
```

### Golden Path 9: Gastos Compartilhados
```
1. Mais → "Participantes e dívidas" → SharedExpensesPage
2. Lista participantes criados no onboarding
3. Se há gastos compartilhados: mostra dívidas
4. Botão "Liquidar" funcional
5. Todo texto via i18n
```

### Golden Path 10: Saída Ativa (Outing)
```
1. FAB → "Começar saída" → OutingPage
2. Se não há perfis: mensagem clara de como criar
3. Se há perfis: seletor de tipo de saída
4. Iniciar sessão → tela imersiva (full-screen, sem bottom nav)
5. Quick-add buttons funcionais (+€3, +€5, +€7...)
6. Cada tap: total atualiza, gauge atualiza
7. "Encerrar" → confirma → volta ao dashboard
8. Dashboard mostra card "Saída ativa" enquanto sessão rodando
```

---

## FASE 1: EXECUTAR CADA GOLDEN PATH

Para CADA path acima:
1. Leia os arquivos envolvidos
2. Trace a jornada passo-a-passo no código
3. Identifique ONDE o path quebra (rota morta, função vazia, dados faltando, string hardcoded)
4. Documente com severidade

### Formato do relatório por path:

```
GOLDEN PATH [N]: [Nome]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Passo 1: [descrição] → ✅ OK
Passo 2: [descrição] → ✅ OK
Passo 3: [descrição] → ❌ FALHA
  Problema: [descrição exata]
  Arquivo: [path]
  Severidade: CRÍTICO / ALTO / MÉDIO / BAIXO
  Fix: [descrição do fix necessário]

Passo 4: [descrição] → ⚠️ PARCIAL
  Problema: [funciona mas incompleto]
  ...

RESULTADO: X/Y passos OK | Z problemas encontrados
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

---

## FASE 2: SCAN ADICIONAL (após golden paths)

### 2.1 — Strings Hardcoded

Grep TODOS os .tsx por:
- Texto em português fora de `t()` ou `{t(...)}`
- Pattern: qualquer string literal com caracteres acentuados ou português reconhecível
- Exceção: chaves de i18n (como `'categories.bar'`) são OK

### 2.2 — Handlers Vazios ou Decorativos

Para CADA `<button>` e `<div onClick>` no projeto:
- Tem onClick definido?
- O onClick faz algo real? (não é `() => {}`)
- O resultado é visível ao usuário?

### 2.3 — Chaves i18n Faltantes

Compare `pt-BR.json` com o que os componentes usam via `t()`:
- Há chaves usadas no código que NÃO existem no JSON?
- Há chaves no JSON que NÃO são usadas? (dead keys)
- O `en.json` e `es.json` estão vazios ou populados?

### 2.4 — DEC-057: Settings V1 Scope (10 settings)

O spec define 10 configurações. Verifique:

| Setting | No spec? | Na UI? | Funcional? |
|---------|----------|--------|-----------|
| Tom de alerta | ✅ | ? | ? |
| Carteira padrão | ✅ | ? | ? |
| Vibração em alertas | ✅ | ? | ? |
| Lembrete de backup | ✅ | ? | ? |
| Tema | ✅ | ? | ? |
| Idioma | ✅ | ? | ? |
| Nome do dispositivo | ✅ | ? | ? |
| Armazenamento persistente | ✅ | ? | ? |
| Quick-add default values | ✅ | ? | ? |
| Sobre | ✅ | ? | ? |

### 2.5 — DEC-055: Dashboard Real Data Only

O dashboard deveria OCULTAR cards quando não há dados. Verifique:
- Se não há outing ativo → card "Saída ativa" OCULTO (não placeholder)
- Se não há ocasiões → grid de ocasiões OCULTO
- Se não há gastos compartilhados → card de pendências OCULTO
- Se não há pool "pessoal" → card shopping OCULTO

### 2.6 — Acceptance Criteria D1 (Appendix C)

Verifique CADA item do Appendix C do master-spec:

```
- [ ] User can create a trip with phases and budget via minimal onboarding
- [ ] User can register expenses (with/without wallet) and see "Livre para usar" decrease
- [ ] Personal shopping fund works independently from phase budget
- [ ] Protected reserve is stored as Envelope, displayed correctly on dashboard
- [ ] Phase can access multiple BudgetPools
- [ ] User can export and import JSON backup with merge/conflict resolution
- [ ] CSV export produces correct 17-field output
- [ ] Demo data loads and is clearly marked
- [ ] App works on phone browser with design system applied
- [ ] All domain calculations have unit tests
- [ ] i18n strings externalized (no hardcoded Portuguese in components)
- [ ] Dashboard shows only implemented features (no placeholder/fake data)
- [ ] "Planejar" tab shows basic editor (not full Scenario Planner)
- [ ] Settings screen has all DEC-057 items
- [ ] "Mais" tab has sectioned list per DEC-059
```

---

## FASE 3: RELATÓRIO CONSOLIDADO

Após completar Fases 1 e 2, gere:

```
═══════════════════════════════════════════════════════════════════
 RELATÓRIO DE AUDITORIA COMPLETA — TripPilot
 Data: [data]
═══════════════════════════════════════════════════════════════════

 RESUMO EXECUTIVO
───────────────────────────────────────────────────────────────────
 Golden Paths testados: 10
 Paths 100% funcionais: X/10
 Total de problemas: XX
   CRÍTICOS (app quebra/trava): XX
   ALTOS (feature inacessível): XX
   MÉDIOS (UX incompleta): XX
   BAIXOS (polish/string): XX

 Acceptance Criteria D1: X/15 atendidos

═══════════════════════════════════════════════════════════════════

 PROBLEMAS POR CATEGORIA (ordenados por severidade)
───────────────────────────────────────────────────────────────────

 [P001] CRÍTICO — Rota morta: /trip
   Arquivo: src/features/more/MorePage.tsx
   Impacto: Usuário clica "Visão geral" e app mostra tela em branco
   Fix: Criar TripOverviewPage ou remover item do menu
   Esforço: ~30min

 [P002] CRÍTICO — Rota morta: /wallets
   ...

 [P003] ALTO — QuickAdd ignora query params
   Arquivo: src/features/expenses/QuickAddPage.tsx
   Impacto: FAB→"Registrar mercado" não pré-seleciona categoria
   Fix: useSearchParams() para ler ?cat= e ?type=
   Esforço: ~15min

 ...

═══════════════════════════════════════════════════════════════════

 CHECKLISTS
───────────────────────────────────────────────────────────────────

 i18n Violations: XX strings hardcoded
 Dead Routes: XX links apontando para nowhere
 Missing Settings (DEC-057): XX de 10
 AC D1 Faltantes: XX de 15
 Buttons sem ação: XX

═══════════════════════════════════════════════════════════════════
```

---

## FASE 4: CORREÇÃO (prioridade rigorosa)

### Ordem obrigatória:

**Round 1 — CRÍTICOS (app quebrando):**
- Rotas mortas → criar página ou remover link
- Navegação sem saída → adicionar botão voltar
- Crash/error visível → fix

**Round 2 — ALTOS (feature inacessível):**
- Query params no QuickAdd (mode transfer/withdrawal/market)
- Settings faltantes (language, device name, default wallet)
- Wallet management page
- Trip overview/edit page (ou remoção dos links)

**Round 3 — MÉDIOS (UX incompleta):**
- Strings hardcoded → t() em todos
- Edit/delete em expenses
- Notification icon com ação (ou remover badge)
- Pending expenses card clicável

**Round 4 — INTEGRAÇÃO:**
- Rodar `npm run build` — zero erros
- Rodar `npm run test` — zero falhas
- Rodar `tsc --noEmit` — zero erros de tipo
- Verificar que fixes não quebraram outros golden paths

### Para CADA fix:

```
FIX [P001]: [descrição curta]
Arquivo(s): [lista]
Mudança: [o que fez]
Verificação: [como confirmou que funciona]
Regressão: [outros paths que testou para garantir que não quebrou]
```

---

## FASE 5: RE-TESTE FINAL

Após todas as correções, re-execute os 10 Golden Paths:

```
RE-TESTE FINAL
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Golden Path 1: Primeiro Uso         → ✅ 7/7 passos OK
Golden Path 2: Registrar Gasto      → ✅ 8/8 passos OK
Golden Path 3: Registrar Mercado    → ✅ 3/3 passos OK
Golden Path 4: Backup               → ✅ 5/5 passos OK
Golden Path 5: Navegação            → ✅ 12/12 passos OK
Golden Path 6: Demo Data            → ✅ 6/6 passos OK
Golden Path 7: Settings             → ✅ 7/7 passos OK
Golden Path 8: Simulador            → ✅ 5/5 passos OK
Golden Path 9: Compartilhados       → ✅ 5/5 passos OK
Golden Path 10: Saída Ativa         → ✅ 8/8 passos OK
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
TOTAL: 66/66 passos (100%)
Problemas residuais: 0
Build: ✅ | Tests: ✅ | Types: ✅
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

---

## DOCUMENTOS DE REFERÊNCIA

| Documento | O que verificar |
|-----------|----------------|
| `TripPilot/brain/documents/master-spec-d1.md` | Features esperadas (seções 2-8), ACs (Appendix C) |
| `TripPilot/brain/implementation-phases.md` | O que cada Delivery deveria ter |
| `TripPilot/brain/decision-log.md` | Decisões sobre comportamento |
| `TripPilot/brain/wireframes/theme-final/code.html` | Visual esperado |
| `TripPilot/src/app/router.tsx` | Rotas reais vs. referenciadas |
| `TripPilot/src/i18n/locales/pt-BR.json` | Chaves i18n disponíveis |
| `TripPilot/brain/documents/ui-compliance-prompt.md` | Para problemas visuais (separar) |

---

## PROBLEMAS JÁ CONHECIDOS (head start)

Para economizar tempo, aqui estão problemas já identificados. CONFIRME cada um e encontre MAIS:

### Rotas Mortas:
- `/trip` — referenciada em MorePage, não existe no router
- `/trip/edit` — referenciada em MorePage, não existe no router
- `/wallets` — referenciada em MorePage, não existe no router

### Strings Hardcoded:
- `SimulatorPage.tsx` — ~8 strings ("Simulador", "Quanto quer gastar?", "Tranquilo!", etc.)
- `SharedExpensesPage.tsx` — ~5 strings ("Dívidas pendentes", "Liquidar", "Eu", etc.)
- `OnboardingPage.tsx` — "Seu nome"

### Query Params Ignorados:
- `QuickAddPage` não lê `?cat=market`, `?type=transfer`, `?type=withdrawal` da URL

### Settings Faltantes (DEC-057):
- Language selector
- Device name field
- Default wallet selector
- Quick-add default values
- Persistent storage button
- About page/section

### BottomNav:
- 4 items em vez de 5 + FAB central
- Ícones divergentes do wireframe (home vs dashboard, event_note vs tune)

---

## REGRAS DE CONDUTA

1. **Não invente features** — se não está no spec, não adicione
2. **Não mude lógica de domain** — foque em rotas, UI, i18n, navegação
3. **Remova antes de criar** — se um link aponta para feature de D3/D4, REMOVA o link (não crie a feature)
4. **DEC-055 é lei** — se uma feature precisa de engine que não existe, OCULTE o card/botão
5. **i18n é absoluto** — ZERO texto em português fora de t(). Adicione chaves em pt-BR.json
6. **Preserve testes** — cada fix deve passar nos testes existentes
7. **Um commit no final** — `fix: resolve all audit findings (dead routes, i18n, missing UI)`

---

## CRITÉRIO DE PARADA

```
DONE quando TUDO = TRUE:
- [ ] 10/10 Golden Paths passando (100%)
- [ ] 0 rotas mortas
- [ ] 0 strings hardcoded
- [ ] 0 botões decorativos (todo botão tem ação ou foi removido)
- [ ] Settings completo (10/10 DEC-057)
- [ ] AC D1: 15/15 atendidos
- [ ] Build + Types + Lint = clean
- [ ] Testes existentes passando
```

---

## COMECE AGORA

1. Leia `src/app/router.tsx` (rotas existentes)
2. Execute Golden Path 1 no código (trace cada passo)
3. Documente falhas
4. Continue com Golden Paths 2-10
5. Execute scan adicional (Fase 2)
6. Gere relatório (Fase 3)
7. Corrija tudo (Fase 4)
8. Re-teste (Fase 5)
9. Commit final

**Não pare até 10/10 Golden Paths em 100%. GO.**
