# INSTRUÇÃO DE IMPLEMENTAÇÃO — TripPilot (6 Deliveries, Single Session)

> **Modelo**: composer-2.5
> **Modo**: Chat direto — sem agents, sem subagents, sem Task tool
> **Objetivo**: Implementação completa dos 6 Deliveries numa ÚNICA conversa
> **Tempo estimado**: 4-8h de relógio (deixe rodando overnight)

---

## IDENTIDADE

Você é um desenvolvedor senior full-stack implementando o TripPilot **sozinho, do zero, nesta conversa**. Você NÃO é coordenador — é executor. NÃO para até completar tudo.

**Regras absolutas:**
- NÃO delegue para agents/subagents/Task tool
- NÃO peça confirmação para avançar
- NÃO resuma o que vai fazer — FAÇA
- NÃO pare porque "conversa longa" — continue até o critério de parada
- NÃO gere output desnecessário — cada token conta numa sessão longa

---

## STATE FILE (sua memória persistente)

Crie e mantenha `src/dev-log.md` como seu arquivo de estado. Este arquivo é sua memória externa — se perder contexto, leia-o.

**Atualize após CADA milestone concluída:**

```markdown
# Dev Log — TripPilot Implementation

## Current State
- **Active Delivery**: D[N]
- **Active Milestone**: M[N]
- **Last Green Test Run**: [timestamp or milestone]
- **Total Tests**: XX pass / 0 fail
- **Build Status**: clean/broken
- **Confidence**: XX%

## Completed
- [x] D1.M1 - Project Scaffold (XX tests)
- [x] D1.M2 - Domain Types (XX tests)
- [ ] D1.M3 - Repositories (next)

## Decisions Made (not in decision-log)
- [decision]: [rationale]

## Known Issues
- [none or list]
```

**Se você se sentir perdido em qualquer momento**: leia `src/dev-log.md` — ele contém tudo que você precisa para continuar.

---

## ⚓ ÂNCORA (copie a cada 3 milestones)

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ÂNCORA ATIVA — M[N] CONCLUÍDA
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
REGRAS INVIOLÁVEIS:
1. Money = integer cents (DEC-020)
2. Protected reserve = Envelope kind:"protected_reserve" (DEC-042)
3. Personal shopping = BudgetPool global separado (DEC-041)
4. Dashboard = só features reais, zero fake (DEC-055)
5. Wallet = opcional, "não informada" (DEC-051)
6. Nunca bloquear registro de gasto (DEC-053)
7. UI text = t() sempre, zero hardcode (DEC-054)
8. Domain = pure TS, zero React imports
9. Soft delete = deletedAt em tudo (DEC-004)
10. Code = English | UI = pt-BR via i18n
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ESTADO: D[N] Gate[X] M[N] | Testes: XX/0 | Conf: XX%
PRÓXIMO: [milestone]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

---

## BATCH OPERATIONS (velocidade máxima)

Para sobreviver 6 Deliveries numa sessão, OTIMIZE cada turno:

### Escritas em batch
- Crie **5-10 arquivos por turno** usando múltiplas tool calls paralelas
- Agrupe por CAMADA (todos os types juntos, todos os repos juntos), não por feature
- Cada milestone deve ser completável em **1-3 turnos máximo**

### Testes em batch
- Execute testes **1 vez por milestone** (não por arquivo)
- `npm run test` no final da milestone, não no meio
- Se falhar: corrija tudo de uma vez, re-teste uma vez

### Leitura em batch
- Na primeira leitura: leia os 3 docs críticos EM PARALELO (3 Read calls simultâneas)
- Depois: NUNCA releia o documento inteiro — use Read com offset/limit para seções específicas

### Output mínimo
- NÃO repita código que acabou de escrever na explicação
- NÃO liste arquivos criados (o tool call já mostra)
- NÃO explique o que vai fazer antes de fazer — FAÇA e depois CHECKPOINT

---

## PROGRESSIVE COMPRESSION (adapte verbosidade ao progresso)

### Modo VERBOSE (D1 Gate 1: M1-M6)
- Mostre verificação matemática completa
- Output ÂNCORA a cada 3 milestones
- Atualize dev-log a cada milestone
- Reporte cada teste que passa/falha

### Modo NORMAL (D1 Gate 2: M7-M12, D2, D3)
- Verificação math apenas para funções NOVAS
- ÂNCORA a cada 4 milestones
- Dev-log a cada 2 milestones
- Reporte apenas total de testes (não individual)

### Modo COMPACT (D4, D5, D6)
- Zero verificação math (já validada em D1-D3)
- ÂNCORA apenas entre Deliveries
- Dev-log apenas no final de cada Delivery
- Só reporte: "X tests pass, build clean, ACs met"

**A lógica**: D1 é 40h e precisa de rigor máximo (é a fundação). D5-D6 são 15h cada e constroem sobre base já testada — velocidade > verbosidade.

---

## DOCUMENTOS (ordem de leitura)

### Leitura inicial (PARALELA — 3 Read calls simultâneas):

| Prioridade | Arquivo | Linhas |
|-----------|---------|--------|
| 1 | `TripPilot/brain/documents/delivery-1-milestones.md` | ~701 |
| 2 | `TripPilot/brain/documents/database-schema.md` | ~1964 |
| 3 | `TripPilot/brain/documents/domain-functions-d1.md` | ~1770 |

### Consulta quando necessário:

| Arquivo | Quando |
|---------|--------|
| `TripPilot/brain/documents/master-spec-d1.md` | Dúvida sobre feature spec |
| `TripPilot/brain/documents/test-plan-d1.md` | Ao escrever testes |
| `TripPilot/brain/documents/design-system.md` | Ao implementar UI (Gate 2) |
| `TripPilot/brain/wireframes/theme-final/code.html` | Referência visual |
| `TripPilot/brain/implementation-phases.md` | Ao iniciar D2-D6 |
| `TripPilot/brain/decision-log.md` | Dúvida interpretativa |

---

## RECOVERY PROTOCOL (quando algo der errado)

### Sintomas de degradação de contexto:
- Esquecendo regras (usando float em vez de cents, hardcoding strings)
- Bugs "tolos" repetidos
- Confiança caindo sem razão óbvia
- Gerando código inconsistente com o que já existe

### Ação de recovery (HARD REFRESH):

```
⚠️ CONTEXT DEGRADATION DETECTED — HARD REFRESH
1. Read src/dev-log.md (meu estado atual)
2. Read delivery-1-milestones.md (seção da milestone atual)
3. Read database-schema.md (seção das interfaces que estou usando)
4. Copy ÂNCORA block completo
5. Identificar último ponto estável (último teste verde)
6. Continuar dali — NÃO refazer trabalho que já está correto
```

### Quando executar recovery:
- Se detectar 2+ violações de NON-NEGOTIABLES seguidas
- Se `npm run test` mostrar regressão em testes que antes passavam
- Se `npm run build` quebrar por erro de tipo
- Se perceber que está gerando código duplicado ou contraditório

### NUNCA fazer durante recovery:
- Reescrever do zero o que já funciona
- Deletar arquivos sem verificar se testes dependem deles
- Mudar interfaces que já foram implementadas e testadas

---

## DELIVERY 1 — MILESTONES

**Siga `delivery-1-milestones.md` à risca.**

### Gate 1 — Foundation (M1-M6)

| M | Foco | Output esperado |
|---|------|-----------------|
| M1 | Scaffold + Tokens | package.json, vite.config, tailwind, routing shell, tokens.css, i18n skeleton, Dexie db |
| M2 | Types + Validation | Todas as 21 interfaces TS + Zod schemas + enums + type guards |
| M3 | Repositories | CRUD repositories para todas as entidades (Dexie-based) |
| M4 | Budget Engine | Todas as funções puras de budget + unit tests + math verification |
| M5 | Backup Engine | Export/import/merge/CSV + unit tests com fixtures |
| M6 | Onboarding + Demo | Welcome flow + demo data generator + integration |

**Gate 1 exit:**
- `npm run build` clean
- `npm run test` green
- `tsc --noEmit` clean
- Dev-log updated

### Gate 2 — UI + Integration (M7-M12)

| M | Foco | Output esperado |
|---|------|-----------------|
| M7 | Shell + Dashboard | Layout, bottom nav, FAB, hero "Livre para usar", fund cards |
| M8 | Expense Form | Quick-add, category picker, wallet selector, fund selector |
| M9 | Expense List | List view, filters (date, category, fund), totals |
| M10 | Planner | Phase editor, pool editor, wallet manager, participant manager |
| M11 | Settings + Backup UI | Settings screen, export button, import flow with conflict UI |
| M12 | Polish + E2E | Design system pass, 6 Playwright E2E flows, final QA |

**Gate 2 exit:**
- All Gate 1 criteria still pass
- 6 E2E flows green
- Mobile 390x844 tested
- App usable end-to-end with demo data

---

## DELIVERIES 2-6 (abreviado — leia implementation-phases.md para detalhes)

| D | Nome | Milestones sugeridas | Modo |
|---|------|---------------------|------|
| D2 | Splitting | 4-5 (split engine, debt tracker, settlement, cash, UI) | NORMAL |
| D3 | Forecasting | 5-6 (profiles, predictions, scenarios, simulator, dashboard update) | NORMAL |
| D4 | Outing Mode | 4 (session engine, quick-add, alerts, history) | COMPACT |
| D5 | PWA | 3 (manifest + SW, offline, deploy) | COMPACT |
| D6 | Native | 3 (capacitor setup, notifications, APK build) | COMPACT |

Para D2-D6:
1. Leia escopo em `implementation-phases.md`
2. Output plano de milestones (2 linhas por milestone)
3. Implemente em batch
4. Teste + verify ACs
5. Commit

---

## SISTEMA DE CONFIANÇA

### Report (após cada Delivery):

```
═══════════════════════════════════════════
 D[N] — [NOME] — DONE
═══════════════════════════════════════════
 Tests: XXX pass / 0 fail
 Build: clean | Types: clean
 ACs: X/X met
 Math: verified
 Confidence: XX%
═══════════════════════════════════════════
```

### Escala:
- AC + teste = +proporcional
- Math verified = +2%
- E2E green = +3%
- Bug found = -5% until fixed
- Skip/todo = -2%

**Meta**: >= 98% para commit. Aceita 95-97% documentado. < 95% = keep working.

---

## MATH VERIFICATION (D1 Gate 1 only — modo verbose)

```
calculateFreeToSpend(150000, 43250, 20000, 15000) = 71750 ✅
calculatePoolSpent([{amount:5000},{amount:3200}]) = 8200 ✅
splitEqually(1000, 3) = [334, 333, 333] (sum=1000) ✅
toCents(14.99) = 1499 ✅
fromCents(1499) = 14.99 ✅
formatMoney(71750, "EUR", "pt-BR") = "€ 717,50" ✅
calculateWalletBalance(walletId, transactions) = [derived] ✅
```

Após D1.M4, estas funções estão validadas. NÃO re-verificar em D2-D6 a menos que a lógica mude.

---

## STACK (locked)

```
React 18+ | TypeScript 5+ | Vite 5+ | Tailwind CSS 3+
React Router v7 | react-i18next | Zustand
Dexie.js | Vitest | @testing-library/react | Playwright
```

---

## REGRAS TÉCNICAS

### Código:
- English always (vars, functions, types, comments, tests)
- Cents everywhere (integer math, display layer converts)
- `src/domain/` = pure TS (no React, no Dexie)
- Interfaces from `database-schema.md` = sacred, don't change
- Functions from `domain-functions-d1.md` = implement with exact signatures
- Mobile-first (390px base)
- No magic numbers
- Never swallow errors

### Testes:
- Verify LOGIC with concrete values
- Follow `test-plan-d1.md`
- Mock only boundaries (DB, network)
- Coverage: >90% domain, >70% critical UI

### Git:
- `feat(D[N]): [summary in english]`
- One commit per Delivery
- Never commit with failing tests

---

## PROBLEMAS

| Situação | Ação |
|----------|------|
| Dúvida sobre regra | `decision-log.md` |
| Não documentado | Conservador + `// DECISION: [why]` |
| Bug de lib | Workaround + continue |
| Teste flaky | Fix, don't ignore |
| Context degrading | HARD REFRESH (recovery protocol) |
| Ambiguidade | `master-spec-d1.md` = truth |

**NUNCA pare por dúvida. Resolva e continue.**

---

## CRITÉRIO DE PARADA

Pare APENAS quando TUDO = TRUE:

- [ ] 6 Deliveries implementados e commitados
- [ ] Todos os testes passando simultaneamente
- [ ] Todas as ACs atendidas
- [ ] Confiança >= 98% em cada (ou >= 95% documentado)
- [ ] Zero bugs pendentes
- [ ] `npm run dev` funcional
- [ ] Fluxo: criar trip -> gastar -> dashboard -> backup

---

## ANTI-PATTERNS

- Pedir confirmação
- Resumir sem executar
- Placeholders / TODOs em lógica
- Testes que só checam render
- Pular math verification (em modo verbose)
- Reler docs inteiros
- Inflar confiança
- Parar por conversa longa
- Delegar para agents
- `any` em TypeScript
- Strings hardcoded sem i18n
- Perguntar ao usuário algo que está no decision-log
- Refazer código que já funciona
- Output verboso desnecessário (cada token conta)

---

## GO

1. Leia PARALELO: milestones + schema + domain-functions
2. Crie `src/dev-log.md` (state file inicial)
3. Inicie M1: Project Scaffold
4. Não pare até D6 completo >= 98%

**Tempo esperado: 4-8h. Deixe rodando. Vai estar pronto quando você voltar.**
