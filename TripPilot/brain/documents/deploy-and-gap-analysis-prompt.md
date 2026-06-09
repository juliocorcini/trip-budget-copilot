# DEPLOY + ANÁLISE COMPLETA DE GAPS — TripPilot

> **Modo**: Chat direto — sem agents, sem subagents, sem Task tool
> **Objetivo**: 1) Deploy funcionando para teste manual; 2) Documento exaustivo de TUDO que falta, está incompleto ou divergente do brain
> **Método**: Deploy primeiro. Depois auditoria multi-pass (5 passes independentes) com cross-check até zero achados novos
> **Restrição absoluta**: NÃO modifique código de produção nesta sessão. O entregável é o DEPLOY + o DOCUMENTO. Zero fixes.

---

## IDENTIDADE

Você é um Product Auditor + Tech Lead fazendo a auditoria de prontidão do TripPilot. Sua missão NÃO é corrigir nada — é construir o mapa mais completo e honesto possível da distância entre **o que o brain define** e **o que o app realmente é hoje**.

Seu padrão de qualidade: **"Se o Julio ler este documento, ele deve saber EXATAMENTE o que falta para o app estar pronto — sem precisar abrir o código nem descobrir surpresas depois."** Qualquer gap que você não documentar é uma surpresa futura. Surpresas são falha sua.

**Regras absolutas:**
- NÃO delegue para agents/subagents/Task tool
- NÃO corrija nada — apenas deploy + análise + documento
- NÃO peça confirmação entre fases — execute tudo em sequência
- NÃO confie em memória — toda afirmação sobre o app vem de leitura real do código
- NÃO liste um gap sem citar a fonte no brain (DEC, seção do spec, tela do wireframe)

---

## FASE 0 — DEPLOY (primeira coisa, antes de qualquer análise)

O Julio precisa testar o app no celular. Faça o deploy AGORA, antes da auditoria:

```
1. cd TripPilot
2. npm run build          → DEVE compilar sem erros (se falhar, reporte o erro exato e pare a Fase 0 — NÃO conserte código; só prossiga para a auditoria)
3. npm run typecheck      → reporte resultado (não bloqueia deploy)
4. npm run test           → reporte X passed / Y failed (não bloqueia deploy)
5. Deploy via Cloudflare Pages:
   npx wrangler pages deploy dist --project-name=trippilot
   (se o projeto não existir, crie: npx wrangler pages project create trippilot --production-branch=main)
6. ENTREGUE A URL imediatamente em destaque:
   🚀 DEPLOY: https://trippilot.pages.dev (ou URL gerada)
7. Smoke test pós-deploy: abra a URL e confirme que a WelcomePage carrega
   (se houver browser tool disponível; senão, confirme que o deploy retornou sucesso)
```

**Checkpoint obrigatório antes de seguir:**

```
FASE 0 — DEPLOY
━━━━━━━━━━━━━━━━━━━━━━━━━━━
URL: [url]
Build: ✅/❌  | Typecheck: ✅/❌ (X erros) | Tests: X/Y
Smoke test: ✅/❌
━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

Só depois disso, comece a Fase 1. **Não espere resposta do Julio — continue direto.**

---

## FASE 1 — ABSORVER O BRAIN (visão completa do que o app DEVERIA ser)

Leia TODOS os arquivos abaixo (use leituras paralelas). Enquanto lê, construa três artefatos de trabalho que vão guiar a auditoria:

### Leitura obrigatória (ordem de prioridade):

| # | Arquivo | Extrair |
|---|---------|---------|
| 1 | `TripPilot/brain/product-spec.md` | Lista completa de features V1 + regras de comportamento |
| 2 | `TripPilot/brain/decision-log.md` | TODAS as decisões `approved` — cada uma vira item verificável |
| 3 | `TripPilot/brain/documents/master-spec-d1.md` | Spec detalhado D1 + Acceptance Criteria (Appendix C) |
| 4 | `TripPilot/brain/implementation-phases.md` | O que cada Delivery (D1-D6) deveria entregar + critérios |
| 5 | `TripPilot/brain/documents/v1-screen-list.md` | Lista de telas esperadas |
| 6 | `TripPilot/brain/documents/database-schema.md` | Entidades e campos esperados |
| 7 | `TripPilot/brain/documents/domain-functions-d1.md` | Funções de domínio esperadas |
| 8 | `TripPilot/brain/documents/design-system.md` | Tokens, componentes, padrões visuais |
| 9 | `TripPilot/brain/documents/test-plan-d1.md` | Cobertura de testes esperada |
| 10 | `TripPilot/brain/project-status.md` | O que o brain ACHA que está pronto (verificar depois!) |
| 11 | `TripPilot/brain/documents/delivery-1-milestones.md` | Milestones D1 |
| 12 | `TripPilot/brain/technical-direction.md` | Stack, arquitetura, PWA, deployment esperados |
| 13 | `TripPilot/brain/wireframes/theme-final/code.html` | Visual de referência (skim — estrutura das telas) |

### Artefatos de trabalho (construa enquanto lê):

```
A. INVENTÁRIO DE FEATURES — toda feature/comportamento prometido, com fonte
   (ex: "F-023: Split de gasto com quem pagou + divisão custom — fonte: product-spec item 5, DEC-056")

B. INVENTÁRIO DE DECISÕES — todo DEC approved que tem efeito verificável no código
   (ex: "DEC-020: money = integer cents", "DEC-055: dashboard sem fake data")

C. INVENTÁRIO DE TELAS — toda tela esperada com seus elementos
   (ex: "ExpenseDetailPage: ver/editar/excluir gasto, impacto — fonte: v1-screen-list tela 6")
```

**Importante**: registre também contradições ENTRE arquivos do brain (Truth Policy #4) — elas entram no documento final numa seção própria.

---

## FASE 2 — MAPEAR O APP REAL

Agora mapeie o que EXISTE, sem julgar ainda:

```
1. src/app/router.tsx        → todas as rotas reais
2. src/features/**           → todas as páginas e componentes (liste TODOS os arquivos)
3. src/domain/**             → todas as funções de domínio implementadas
4. src/db/** (ou data/**)    → schema Dexie real (tables, campos, versões)
5. src/i18n/locales/*.json   → chaves pt-BR + estado de en/es
6. src/tests/** + e2e/**     → o que está testado de verdade
7. package.json + configs    → PWA configurado? Service worker? Manifest?
```

Produza um **mapa de implementação**: rota → página → features que ela contém → estado aparente.

---

## FASE 3 — AUDITORIA MULTI-PASS (o coração do trabalho)

Execute **5 passes independentes**. Cada pass olha o app por uma lente diferente — é assim que se atinge exaustividade real, porque cada lente pega gaps que as outras não pegam.

### PASS 1 — Por Feature (inventário A)
Para CADA feature do inventário: encontre onde está implementada e classifique:

```
✅ COMPLETA    — funciona conforme spec, acessível pelo usuário
🟡 PARCIAL     — existe mas falta parte do comportamento (diga QUAL parte)
🟠 QUEBRADA    — existe mas não funciona / não persiste / não é alcançável
🔴 AUSENTE     — não existe nada
⚪ FORA DO D-ATUAL — pertence a D2+ (registre, mas separe — não é gap de agora)
```

### PASS 2 — Por Decisão (inventário B)
Para CADA DEC approved: o código respeita? Cite arquivo+evidência. Um DEC violado é gap mesmo que a feature "funcione".

### PASS 3 — Por Tela (inventário C)
Para CADA tela esperada: existe? Tem rota? Compare elemento por elemento com o wireframe/spec: o que a tela deveria ter vs. o que tem. Inclua estados vazios, loading, erros.

### PASS 4 — Por Jornada de Usuário (simulação no código)
Trace no código as jornadas completas (reuse os 10 Golden Paths de `full-audit-prompt.md` + crie jornadas para features novas: split de gastos, multi-fase, outing custom, Amigo Sincero). Onde a jornada quebra ou termina num dead-end = gap.

### PASS 5 — Qualidade Transversal
```
- i18n: strings hardcoded em pt nos .tsx; chaves usadas que não existem no JSON; en/es vazios
- Rotas mortas: links → rotas inexistentes; rotas → sem link de acesso
- Handlers vazios: onClick={() => {}} ou botões decorativos
- Persistência: toda mutação de estado vai pro Dexie? O que se perde no refresh?
- Testes: domain functions sem teste; testes falhando; cobertura vs test-plan-d1.md
- PWA: manifest, service worker, offline, installable — conforme technical-direction.md?
- Acceptance Criteria: CADA item do Appendix C do master-spec, um por um
- project-status.md vs realidade: o que o brain diz "done" mas não está
```

### Protocolo de exaustividade (critério objetivo de parada):

Após os 5 passes, faça **rounds de verificação**:

```
ROUND N: releia o inventário completo de gaps e faça UM pass extra livre
         (escolha a lente que parecer mais promissora para achar algo novo)
→ Se o round encontrou ≥1 gap novo: faça outro round
→ Se DOIS rounds consecutivos encontraram ZERO gaps novos: PARE — exaustividade atingida
```

Não use "sensação de confiança" — use este critério mecânico.

---

## FASE 4 — DOCUMENTO FINAL

Crie: **`TripPilot/brain/documents/gap-analysis-2026-06-09.md`**

Estrutura obrigatória:

```markdown
# TripPilot — Gap Analysis Completa
> Data: 2026-06-09 | Deploy auditado: [url] | Commit: [hash]

## 1. Resumo Executivo
- Visão em 1 parágrafo: quão longe o app está do V1 definido no brain
- Números: X features completas / Y parciais / Z ausentes / W quebradas
- Acceptance Criteria D1: X/15
- DECs violados: X de Y verificados
- Top 5 gaps mais críticos (1 linha cada)

## 2. Matriz de Cobertura de Features
Tabela completa: ID | Feature | Fonte (DEC/spec) | Status | O que falta exatamente

## 3. Gaps Detalhados (agrupados por área, ordenados por severidade)
Para CADA gap:
  [GAP-NNN] SEVERIDADE — Título
  - O que o brain define: [citação + fonte exata]
  - O que existe hoje: [estado real + arquivo(s)]
  - O que falta exatamente: [lista acionável — detalhada o suficiente
    para virar issue de implementação sem investigação adicional]
  - Esforço estimado: S / M / L

  Severidades:
  CRÍTICO — bloqueia uso real do app numa viagem
  ALTO    — feature prometida inacessível ou sem persistência
  MÉDIO   — incompleta, UX ruim, estados faltando
  BAIXO   — polish, i18n, consistência visual

## 4. Verificação por Decisão (DEC por DEC)
Tabela: DEC | Resumo | Respeitado? | Evidência | Gap relacionado

## 5. Verificação por Tela
Tabela: Tela | Existe? | Rota | Completa vs wireframe? | Gaps relacionados

## 6. Acceptance Criteria D1 (Appendix C)
Checklist item por item: ✅/🟡/❌ + evidência

## 7. Qualidade Transversal
i18n, rotas mortas, persistência, testes, PWA — números e listas concretas

## 8. Contradições no Brain
Arquivos do brain que se contradizem ou que afirmam status incorreto
(inclui correções necessárias em project-status.md)

## 9. Fora de Escopo do Delivery Atual
Features D2+ encontradas no brain — registradas para não se perderem,
claramente separadas dos gaps de agora

## 10. Log de Exaustividade
Rounds executados: N | Gaps novos por round: [5, 2, 1, 0, 0] → critério atingido

## 11. Próximos Passos Recomendados
Ordem sugerida de ataque (blocos priorizados, prontos para virar
um próximo prompt de implementação)
```

---

## REGRAS DE CONDUTA

1. **Zero código modificado** — esta sessão é deploy + análise. Nenhum fix, nem "rapidinho"
2. **Evidência sempre** — todo status (✅ ou ❌) cita arquivo e, quando relevante, linha/trecho
3. **Brain é a verdade** — divergência código vs brain = gap do código (exceto contradição interna do brain → seção 8)
4. **Acionável** — cada gap descrito de forma que um dev implemente sem reinvestigar
5. **Separe D1 de D2+** — não infle a lista com features de deliveries futuros (mas registre-as na seção 9)
6. **Não minimize** — "quase funciona" = 🟡 PARCIAL com descrição do que falta. Nunca arredonde para ✅

---

## CRITÉRIO DE PARADA

```
DONE quando TUDO = TRUE:
- [ ] Deploy no ar + URL entregue ao Julio (Fase 0)
- [ ] Todos os 13 arquivos do brain lidos
- [ ] 3 inventários construídos (features, DECs, telas)
- [ ] 5 passes de auditoria executados
- [ ] 2 rounds consecutivos com ZERO gaps novos
- [ ] gap-analysis-2026-06-09.md criado com as 11 seções
- [ ] Todo gap tem: fonte no brain + estado real + o que falta + severidade + esforço
- [ ] Resumo executivo respondido ao Julio no chat (URL + top 5 gaps + números)
```

---

## COMECE AGORA

1. FASE 0: build + deploy + entregue a URL (em destaque, logo no início)
2. FASE 1: leia o brain inteiro (leituras paralelas)
3. FASE 2: mapeie o app real
4. FASE 3: 5 passes + rounds até zero achados novos
5. FASE 4: escreva o documento completo
6. Termine com o resumo executivo no chat

**Deploy primeiro. Depois não pare até dois rounds seguidos sem gaps novos. GO.**
