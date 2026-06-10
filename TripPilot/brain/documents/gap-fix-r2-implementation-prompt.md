# IMPLEMENTAÇÃO R2 — BUGS DE CAMPO + FEATURES DE PLANEJAMENTO — TripPilot

> **Modo**: Chat direto — sem agents, sem subagents, sem Task tool
> **Fonte da verdade**: `TripPilot/brain/documents/gap-analysis-r2-2026-06-09.md` (auditoria R2 completa: root causes, designs aprovados, blocos)
> **Decisões**: DEC-071..083 — **TODAS APROVADAS pelo Julio** (anotado "ok, eu confirmo" na seção 6 do documento). Você as registra como `approved` no decision-log no Gate 0
> **Objetivo**: 7 bugs de campo + 9 gaps R2 + 7 features de planejamento implementados · dashboard final montado (§7 do R2) · brain atualizado · deploy v0.3.0 no ar
> **Baseline protegida**: 156 testes unit verdes + 22 e2e, build/typecheck limpos — NUNCA pode regredir

---

## IDENTIDADE

Você é um desenvolvedor senior full-stack implementando a rodada R2 do TripPilot **sozinho, nesta conversa**. Os bugs vieram de uma viagem REAL do Julio e as features foram desenhadas e aprovadas — seu trabalho é executar com precisão, não redesenhar.

**Regras absolutas:**
- NÃO delegue para agents/subagents/Task tool
- NÃO peça confirmação entre gates — as 13 decisões já estão aprovadas
- NÃO redesenhe o que a auditoria desenhou — o design das features (§5 do R2) é especificação, não sugestão
- NÃO pare porque "conversa longa" — use o protocolo de recovery
- PRESERVE a baseline — teste quebrado é regressão sua; corrija antes de seguir
- NO Gate 1 PRIMEIRO o service worker (GAP-R2-001): sem ele, NADA do que você fizer chega ao usuário

---

## ⚓ ÂNCORA — REGRAS INVIOLÁVEIS

Releia no início de CADA gate e reproduza no checkpoint:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
1. O design aprovado (§5 do gap-analysis-r2) é especificação.
   Releia a seção da feature ANTES de implementá-la
2. UMA migração Dexie v3 só (Gate 3) com TUDO: confirmationStatus,
   phaseProfileSettings, PlannedOccurrence estendida, índices.
   NUNCA criar v4/v5 nos gates seguintes
3. Money = integer cents | Soft delete + revision em toda mutação
4. Registro NUNCA bloqueia: stepper/confirmações são pós-save e puláveis
   (transação salva ANTES de qualquer pergunta — DEC-078/053)
5. Default permissivo: ausência de phaseProfileSettings = habilitado;
   confirmationStatus default 'confirmed' p/ dados existentes —
   migração NUNCA muda comportamento de dados antigos
6. Zero cores hardcoded novas — só tokens (var(--...)). O Gate 1
   elimina as 12 existentes; não recrie o problema
7. UI text = t() em pt-BR + en + es NO MESMO COMMIT (paridade 390+)
8. Domain = pure TS; mutações multi-tabela via orchestrators
   (db.transaction); UI não chama repositório direto em fluxo novo
9. Zero diálogos nativos — BottomSheet/Toast existentes
10. Reserva de evento (reservedCents) DEDUZ do freeToSpend até a
    occurrence ser confirmada/ligada a sessão — depois o gasto real assume
11. npm run test + typecheck + build verdes em TODO checkpoint
12. Node 22 p/ wrangler/playwright:
    export PATH="$HOME/.nvm/versions/node/v22.22.3/bin:$PATH"
    Git: usar bash -c 'git commit ...' (sem --trailer)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

---

## AJUSTE DO JULIO AO DESIGN (única mudança sobre o documento)

No FIELD-01 (atividades por fase), o Julio pediu: **"crie mais opções, pensem em opções para viagens, mais populares"**. Implemente um **catálogo de presets de atividades** maior que os 5 do wireframe — chips selecionáveis na edição de fase que criam o ActivityProfile sob demanda (se ainda não existir na viagem):

```
Restaurantes · Bar · Mercado · Transporte · Hospedagem · Café & padaria ·
Passeios & tours · Museus & atrações · Vida noturna · Praia ·
Compras & souvenirs · Festivais & eventos · Esportes & aventura ·
Lavanderia · Internet & SIM · Farmácia & saúde · + Outro (custom)
```

- Catálogo é estrutura de dados no domínio (`profile-presets.ts`: id, nome i18n, ícone, valores típicos default razoáveis em EUR) — data-driven, sem conditionals
- Selecionar chip de preset numa fase: cria o ActivityProfile da viagem (se não existir) + linha `phaseProfileSettings` habilitada
- Os 17 nomes entram em pt-BR/en/es

---

## STATE FILE (crie ANTES de qualquer código)

Crie `TripPilot/src/gap-fix-log-r2.md`:

```markdown
# Gap Fix Log R2 — TripPilot
## Current State
- **Gate ativo**: [0-9] | **Item ativo**: [ID]
- **Itens resolvidos**: X/23 (7 FIELD bugs+features-bugs · 9 GAP-R2 · 7 features)
- **Testes**: X unit (baseline 156) + Y e2e (baseline 22)
- **Build/Typecheck**: clean/broken
- **Migração Dexie v3**: pendente/feita (Gate 3)

## Por gate
### Gate 1
- [x] DEC-082 — SW network-first + toast update — arquivos: [...] — teste: [...]
...

## Problemas extras encontrados (NÃO corrigir — anotar)
- [EXT-01]: ...
```

---

## MAPA DE GATES

```
GATE 0  Baseline + decision-log (DEC-071..083 → approved)
GATE 1  Distribuição + tema + mobile feel   DEC-082 DEC-083 DEC-081 (CRÍTICO)
GATE 2  Correções rápidas                   FIELD-13 14 · GAP-R2-004 005 006 007
GATE 3  Migração Dexie v3 unificada         (schema completo upfront)
GATE 4  Shares confirmáveis + CRUD          DEC-071 (FIELD-03) · DEC-080 (FIELD-11)
GATE 5  Fase rica                           DEC-074 (FIELD-01+catálogo) · DEC-075 (FIELD-02)
GATE 6  Eventos planejados                  DEC-072 + DEC-073 (FIELD-05, resolve FIELD-04)
GATE 7  Outing rico + histórico             DEC-078 (FIELD-08) · DEC-079 (FIELD-09)
GATE 8  Dashboard final                     DEC-076 DEC-077 + §7 + aria + e2e
GATE 9  Brain + verificação final + deploy v0.3.0
```

**Antes de cada gate**: releia a(s) seção(ões) correspondente(s) do `gap-analysis-r2-2026-06-09.md` — §3 para bugs (root cause exato com arquivo:linha), §5 para features (design completo com modelo/UX/integração/corte V1).

---

## GATE 0 — BASELINE + DECISION-LOG

```
1. cd TripPilot && npm run test && npm run typecheck && npm run build → anote
2. Crie src/gap-fix-log-r2.md
3. decision-log.md: registrar DEC-071..083 como **approved** (2026-06-09),
   com o conteúdo da §6 + referência à seção de design (§5/§3) de cada um.
   Marcar DEC-063 como SUPERSEDED por DEC-071. Anotar DEC-019 como
   "implemented via DEC-071". Atualizar Last updated.
4. Leia: src/data/db/schema.ts, src/domain/types/, router.tsx
```

---

## GATE 1 — DISTRIBUIÇÃO + TEMA + MOBILE FEEL

**M1.1 — DEC-082 / GAP-R2-001 — SW update visível (PRIMEIRO DE TUDO)**
- `public/sw.js`: network-first com fallback de cache para navegação/`index.html` (assets hasheados continuam cache-first)
- `pwa.ts`: ao detectar novo SW waiting → Toast persistente "Nova versão disponível — toque para atualizar" → `skipWaiting` + reload
- DONE quando: deploy novo → usuário com app aberto recebe o toast; tap atualiza sem refresh duplo

**M1.2 — DEC-083 / FIELD-12b — BottomNav + 12 cores hardcoded → tokens**
- `BottomNav.tsx:60` → `var(--surface-container-high)` + borda tokenizada
- Varredura da tabela do FIELD-12 (§3): FAB overlay, Toast border, DashboardPage, OutingPage (3), PlannerPage (5) → tokens com variante clara correta
- Verificação final: `rg "#0F1419|#0A0F14|#EDE8E0" src/ --type tsx` → 0 (exceto tokens.css)
- DONE quando: tema claro 100% legível em todas as telas (BottomNav incluída)

**M1.3 — DEC-083 / GAP-R2-003 — Tema na raiz**
- Aplicação de `data-theme` + idioma movida para nível raiz (main.tsx ou layout que envolva TODAS as rotas, incluindo `/quick-add`, `/outings/*`, `/simulator`, welcome/onboarding), mantendo liveQuery
- `theme-color` da meta dinâmica via JS conforme tema
- DONE quando: hard reload em `/outings/active` com tema claro renderiza claro

**M1.4 — DEC-081 / FIELD-10 — Mobile feel**
- CSS do FIELD-10 (§3): `user-select: none` global, inputs/textarea preservados, tap-highlight transparente, `touch-action: manipulation` em interativos
- DONE quando: nenhum texto seleciona no touch; inputs continuam selecionáveis

**Checkpoint Gate 1** + commit `fix(gate-r2-1): distribution, light theme, mobile feel`

---

## GATE 2 — CORREÇÕES RÁPIDAS

- **M2.1 — FIELD-13**: gastos recentes do dashboard clicáveis → `/expenses/:id` (com `btn-press`)
- **M2.2 — FIELD-14**: `OccasionCounter` com onClick → `/expenses?profile=<id>`; `ExpenseListPage` lê `useSearchParams` (profile e categoria) para inicializar filtro
- **M2.3 — GAP-R2-006**: `calculateOccasionForecasts` phase-scoped (allocations do plano ativo da fase + transações filtradas por fase) — pré-requisito dos Gates 5/8. Atualizar testes de forecasting
- **M2.4 — GAP-R2-007**: `text-danger` → `text-error` (FundsPage.tsx:319)
- **M2.5 — GAP-R2-004**: ErrorBoundary raiz com tela de erro do design system + botão recarregar (i18n)
- **M2.6 — GAP-R2-005**: `navigator.storage.persist()` automático após onboarding concluído e após o 1º gasto (idempotente); remover dead code; manter o status visível em Settings

**Checkpoint** + commit `fix(gate-r2-2): clickable dashboard, phase-scoped forecasting, error boundary, persistent storage`

---

## GATE 3 — MIGRAÇÃO DEXIE V3 UNIFICADA (nada de UI neste gate)

Uma migração única com TODO o schema dos Gates 4/5/6 (nota de migração do §11):

```
1. ParticipantShare.confirmationStatus: 'pending'|'confirmed'|'rejected'
   — upgrade() popula 'confirmed' em shares existentes (DEC-071)
2. Tabela nova phaseProfileSettings: SyncMetadata + phaseId +
   activityProfileId + isEnabled — índice [phaseId+activityProfileId] (DEC-074)
3. Phase.rhythmPreset: 'intense'|'moderate'|'relaxed'|'custom'|null
   + Phase.peakDays: number[]|null (DEC-075)
4. PlannedOccurrence: +endDate string|null, +kind 'event'|'sub_destination',
   +reservedCents number|null, +linkedSessionId string|null,
   activityProfileId → nullable — índice [phaseId+plannedDate] (DEC-072)
5. Types + entity factories + Zod schemas atualizados
6. Backup v3: BACKUP_VERSION=3, phaseProfileSettings incluída, campos novos;
   import aceita v2 (campos ausentes = defaults da migração)
7. CSV: avaliar colunas novas relevantes (confirmação do share) — modo avançado
8. Testes: migração (dados v2 → v3 preservados), backup round-trip v3,
   import de backup v2 antigo
```

DONE quando: app abre com dados pré-existentes intactos e comportamento IDÊNTICO ao Gate 2 (campos novos dormentes). **Checkpoint** + commit `feat(gate-r2-3): dexie v3 unified migration + backup v3`

---

## GATE 4 — SHARES CONFIRMÁVEIS + CRUD DE FUNDOS/FASES

**M4.1-4.3 — DEC-071 / FIELD-03 — Confirmação de gastos compartilhados**
- Shares nascem: criador → `confirmed`; terceiros → `pending` (QuickAdd, sessão, stepper futuro)
- `calculateDebts` considera APENAS `confirmed`; `rejected` devolve o valor ao custo pessoal do pagador (função de domínio + teste com o cenário exato da irmã do Julio: 2×€20 cruzados)
- Card do dashboard = nº de shares de terceiros `pending`; tap → sheet de confirmação por gasto: confirmar / rejeitar / ajustar valor; card some quando todos confirmados (independente de netting/settlement)
- SharedExpensesPage exibe status por share
- DONE quando: cenário do relato → card mostra 2 pendentes COM ação; confirmar os dois → card some, dívidas zeradas continuam zeradas

**M4.4-4.5 — DEC-080 / FIELD-11 — Editar/apagar fundos e fases**
- Fundo: editar nome/valor; apagar via soft delete SE sem transações ativas; com transações → sheet oferece reatribuir para outro pool OU bloqueia com explicação; cascata soft em links/envelopes/policies
- Fase: apagar via soft delete SE sem transações/sessões; com dados → bloquear com explicação ("mova ou apague os X gastos primeiro"); reordenar `order`; NUNCA apagar a última fase
- Tudo via BottomSheet; orchestrators `deleteBudgetPool`/`deletePhase` com `db.transaction` + testes
- DONE quando: CRUD completo com as regras de segurança; nenhum dado órfão

**Checkpoint** + commit `feat(gate-r2-4): share confirmation flow + fund/phase edit-delete`

---

## GATE 5 — FASE RICA (atividades + ritmo)

**M5.1-5.3 — DEC-074 / FIELD-01 — Atividades por fase + catálogo**
- `profile-presets.ts` no domínio: catálogo dos 17 presets (ver AJUSTE DO JULIO) — data-driven
- TripEditPage (criar/editar fase): grade de chips (presets + perfis existentes da viagem + "+ Outro"); tap alterna `phaseProfileSettings.isEnabled`; preset sem perfil → cria ActivityProfile + setting
- Planner: hidrata/persiste SÓ perfis habilitados na fase (mata a contaminação do FIELD-04 no Planner — root causes 2 e 3 do §3); contadores e QuickAdd respeitam habilitados
- DONE quando: desabilitar "Mercado" numa fase → some do Planner/contadores dela e continua na outra; abrir Planner não semeia mais perfis não habilitados

**M5.4-5.5 — DEC-075 / FIELD-02 — Ritmo + dias de pico**
- Edição de fase (mesma tela): preset de ritmo (Intensa/Moderada/Tranquila) + seletor de dias de pico (S T Q Q S S D)
- Domínio: `calculateEffectiveSpendingDays(phase, fromDate)` (pico=1.5, normal=1.0, calmo conforme preset — null = uniforme, comportamento atual); `freeToSpendPerDay` ponderado; microcopy "hoje é dia de pico — livre até €X" no hero
- Testes com o cenário da Mira (fds pico, semana calma)
- DONE quando: fase com peakDays=[5,6] mostra livre-por-dia maior no sábado que na terça

**Checkpoint** + commit `feat(gate-r2-5): per-phase activities catalog + phase rhythm`

---

## GATE 6 — EVENTOS PLANEJADOS (a maior feature — releia §5 FIELD-05 inteiro antes)

- **M6.1**: domínio — `calculateEventReserves(occurrences, phaseId)` deduz `reservedCents` de occurrences não-confirmadas no `freeToSpend` (budget.ts) + testes
- **M6.2**: UI na fase — TripEditPage seção "Eventos desta fase": lista + "+ Evento" (nome, data ou intervalo, valor estimado, reservar €, tipo evento/sub-destino); editar/apagar (soft)
- **M6.3**: card do dia no dashboard — regra `plannedDate <= hoje <= (endDate ?? plannedDate)` e sem `linkedSessionId`: "🎉 Hoje: Parral · reservado €50 [Iniciar agora] [Adiar]"; Iniciar → `/outings/new` pré-configurado (nome, teto = reservedCents) e `linkedSessionId` gravado ao criar a sessão; Adiar → +1 dia
- **M6.4**: encerramento de sessão ligada a evento → occurrence `isConfirmed=true` + `linkedTransactionId`; reserva deixa de deduzir (gasto real assume)
- **M6.5 — DEC-073 / FIELD-04**: fluxo de sessão custom pergunta "é um evento único?" → SIM cria PlannedOccurrence ligada (NÃO cria ActivityProfile); NÃO mantém fluxo atual de perfil custom. `createCustomActivityProfile` só via Perfis/Planner/onboarding
- **M6.6**: Planner — linha informativa por fase "Eventos: Parral €50 · Praia (2d) €120" (link para edição; sem sliders); sub-destinos (`kind: 'sub_destination'`, eurotrip): lista de cidades com orçamento + gasto-até-agora (transações no intervalo de datas)
- DONE quando: cenário Parral completo — criar evento dia 12 com €50 reservados → freeToSpend deduz €50 → card aparece no dia → iniciar sessão pelo card → encerrar → occurrence confirmada, dedução some, NADA aparece no Planner de outra fase nem em Perfis

**Checkpoint** + commit `feat(gate-r2-6): planned events (occurrences UI, reserves, day card, one-off sessions)`

---

## GATE 7 — OUTING RICO + HISTÓRICO

**M7.1-7.2 — DEC-078 / FIELD-08 — Stepper pós-valor na sessão**
- Após tap no quick-add (transação JÁ SALVA): stepper inline de até 3 micro-passos — "O que foi?" (ícones de categoria por perfil da sessão) → "Quem pagou?" (Eu / participantes) → "Dividiu?" (Não / meio a meio); cada passo 1 tap = grava e avança; "pular" ou 3s sem interação = some
- Atualiza `category`/`paidByParticipantId`/shares via `buildSharesWithPayer` (reuso GAP-012); shares seguem DEC-071 (criador confirmed, terceiros pending)
- DONE quando: registro continua 1 tap; enriquecimento opcional funciona; ignorar o stepper não muda NADA do comportamento atual

**M7.3-7.4 — DEC-079 / FIELD-09 — Histórico de saídas**
- `getCompletedSessions(tripId)` no repository; `/expenses?tab=outings` — segmented control Gastos|Saídas; lista: nome, data, duração, total, nº itens, badge do perfil
- Detalhe: REUSA a tela de revisão (GAP-002) em modo leitura (rota `/outings/:id/review`); atalho "Histórico de saídas" no Mais → mesma rota
- DONE quando: Parral encerrado aparece na aba com duração e total; tap abre o detalhe read-only com itens categorizados

**Checkpoint** + commit `feat(gate-r2-7): post-add enrichment stepper + outing history`

---

## GATE 8 — DASHBOARD FINAL

- **M8.1 — DEC-076 / FIELD-06**: carrossel de contadores — scroll-snap horizontal CSS puro, 3 visíveis, dots se >3; todos os perfis habilitados na fase (Gate 5), ordenação: com gasto na fase (desc por nº transações) → planejados sem uso; sem uso nenhum → 3 mais planejados; clicáveis (Gate 2)
- **M8.2-8.3 — DEC-077 / FIELD-07**: bloco "Insights" rotativo (1 card por vez, dots, máx 4/dia) com os 6 cards V1: projeção de fim de fase (usa dias efetivos do Gate 5), ritmo real vs planejado, dias sem gasto, custo médio por saída, saldo com participantes, próximo evento (Gate 6); regras de significância (ex.: projeção só com ≥3 dias de dados); cálculo diário persistido em `forecastSnapshots` (a tabela ganha uso)
- **M8.4**: montagem final do dashboard na ordem EXATA do §7 do R2 (11 posições, regras de visibilidade)
- **M8.5 — GAP-R2-008**: aria-labels nos botões de ícone (sino, FAB, fechar sheets, navegação) + revisão de roles
- **M8.6 — GAP-R2-009**: e2e novos — outing (iniciar→quick-add→encerrar), planner, shared/confirmar+settle, backup export/import, eventos (criar→card do dia)

**Checkpoint** + commit `feat(gate-r2-8): final dashboard (carousel, insights), aria, e2e coverage`

---

## GATE 9 — BRAIN + VERIFICAÇÃO FINAL + DEPLOY

```
1. Brain:
   - project-status.md → R2 implementada, data, números
   - gap-analysis-r2-2026-06-09.md → header "> Status: RESOLVIDO em [data]
     — ver src/gap-fix-log-r2.md"
   - database-schema.md → Dexie v3 (tabela nova, campos, índices)
   - product-spec.md → features novas (eventos, ritmo, atividades/fase,
     confirmação de shares, histórico de saídas)
2. package.json → 0.3.0
3. npm run test (156+novos, 100%) + typecheck + build
4. npx playwright test (22+novos)
5. RE-VERIFICAÇÃO: tabela completa — cada um dos 23 itens com seu
   "DONE quando" confirmado NO CÓDIGO (não de memória):
   FIELD-03..14 ✅ | GAP-R2-001..009 ✅ | DEC-071..083 ✅
6. Smoke dos cenários do Julio (trace no código):
   a) mercado 2×€20 cruzado → card pendente COM confirmação → confirma → some
   b) Parral como evento → card do dia → sessão → encerra → zero contaminação
   c) tema claro → BottomNav legível, troca ao vivo, rota fora do shell
   d) fds de pico da Mira → livre-por-dia ponderado
7. rg cores hardcoded → 0 | rg diálogos nativos → 0 | paridade i18n ×3
8. Deploy: npx wrangler pages deploy dist --project-name=trippilot
9. Entregar: 🚀 URL + tabela de verificação + resumo por gate
   + AVISO ao Julio: o fix do SW (Gate 1) só vale a partir DESTE deploy —
   na primeira abertura ainda pode precisar de um refresh manual; depois
   disso as atualizações passam a ser anunciadas pelo toast
```

---

## PROTOCOLO DE CHECKPOINT (fim de CADA gate)

```
GATE [N] CONCLUÍDO
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Itens: [lista ✅] | Arquivos: [lista]
Testes: X unit (baseline 156 + Y novos) | Build ✅ | Typecheck ✅
i18n: [N] chaves novas em pt-BR + en + es (paridade ✅)
Regressão: [2-3 fluxos anteriores re-checados]
Fora de escopo tocado? [não / o quê e por quê]
State file atualizado ✅ | Commit: [hash]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[reproduza o bloco ÂNCORA]
PRÓXIMO: Gate [N+1] — releia §[X] do gap-analysis-r2
```

**Mid-gate refresh**: a cada 3 milestones dentro de um gate, releia a ÂNCORA + Current State do state file (output de 3 linhas).

---

## RECOVERY PROTOCOL

1. Leia `TripPilot/src/gap-fix-log-r2.md` → gate/item ativo
2. Releia a ÂNCORA + seção do gate ativo NESTE prompt
3. Releia a seção do item ativo no `gap-analysis-r2-2026-06-09.md`
4. `npm run test` para confirmar estado real
5. Continue do último checkbox aberto — NUNCA refaça gate concluído

---

## CRITÉRIO DE PARADA

```
DONE quando TUDO = TRUE:
- [ ] 23/23 itens com "DONE quando" confirmado (tabela do Gate 9)
- [ ] DEC-071..083 approved no decision-log; DEC-063 SUPERSEDED; DEC-019 implementado
- [ ] Migração Dexie v3 única; backup v3 com import de v2 funcionando
- [ ] Cenários do Julio (4 smokes do Gate 9) passando
- [ ] Dashboard na ordem do §7 | Catálogo de 17 atividades no ar
- [ ] 0 cores hardcoded | 0 diálogos nativos | i18n ×3 em paridade
- [ ] Testes > baseline e 100% verdes | e2e ampliado | Build/Typecheck clean
- [ ] Brain atualizado (project-status, schema, product-spec, R2 marcado resolvido)
- [ ] Deploy v0.3.0 no ar com URL entregue + aviso do SW
```

---

## COMECE AGORA

1. GATE 0: baseline + registrar DEC-071..083 no decision-log
2. GATE 1: SW primeiro (GAP-R2-001) — sem ele nenhum fix chega ao Julio
3. Checkpoint por gate, state file sempre atualizado, recovery se precisar
4. Termine com deploy + tabela 23/23 + URL + aviso do SW

**Os bugs vieram de uma viagem real e as features foram aprovadas uma a uma. Execute o design como especificado — a baseline é 156 testes verdes e você só termina com mais. GO.**
