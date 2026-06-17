# START-HERE — Implementação da Reforma do Modelo de Orçamento

> Data: 2026-06-17 · App: TripPilot · Versão base: **0.70.0**
> **Como usar:** abra uma sessão no Cursor e diga: *"Leia este arquivo e execute o GATE 1."* (um gate por vez).
> **Execução DIRETA** — o agente implementa tudo ele mesmo. **Sem subagentes, sem delegação** (regra `tech-lead-delegation.mdc`).
> Este prompt implementa as decisões consolidadas em `budget-model-master-decision-2026-06-17.md`.

---

## ⛔ NON-NEGOTIABLES (releia antes de CADA gate)

1. **Nada de regressão.** Ritmo/pico/eventos/atividades/multimoeda/import Wise/saídas **continuam funcionando**. Simplificamos vocabulário e visibilidade — nunca capacidade.
2. **Backend preservado.** NÃO destruir schema. `Phase`, `BudgetPool`, `BudgetPoolPhaseLink`, `Envelope`, `PlannedOccurrence`, `PlannedPurchase`, `Wallet` permanecem. Mudança é orquestração + UX + nomenclatura + visibilidade.
3. **Compatibilidade retroativa.** Viagens existentes (1 pool ligado a N fases) **devem continuar 100% funcionais**. Toda migração é aditiva e idempotente; nunca corrompe totais (invariante: soma do dinheiro nunca muda numa migração).
4. **Nunca bloquear o registro** (DEC-053). Estouro de trecho → **avisa e sugere remanejar**, não impede.
5. **Todo número é explicável** (regra do produto): qualquer valor exibido tem "de onde vem esse número".
6. **Código em inglês** (nomes, comentários); UI em pt-BR (+ en/es via i18n).
7. **`.ts` sobre `.js`**: se existir o `.ts`, edite só o `.ts`.
8. **Cada gate termina verde:** `npm run typecheck` + `npm run test` + `npm run build` sem erros, e atualiza o `dev-log.md`.

---

## 0. Leitura obrigatória (antes do GATE 1)

Leia, nesta ordem:
1. `TripPilot/brain/documents/budget-model-master-decision-2026-06-17.md` — **as decisões** (D1–D19) e o modelo canônico.
2. `TripPilot/brain/documents/budget-mental-model-study-2026-06-17.md` — diagnóstico (Parte I).
3. `TripPilot/brain/documents/budget-mental-model-study-part2-2026-06-17.md` — potes/carteira/fases/onboarding (Parte II).
4. `TripPilot/brain/decision-log.md` — DEC-007, DEC-016/069, DEC-072, DEC-089, DEC-153, DEC-041, DEC-051, DEC-175 (contexto que vamos reconciliar).
5. `TripPilot/.cursor/rules/software-engineering-guidelines.mdc` — padrões (orquestradores, funções puras, reuso).

**Mapa de conceito → backend** (decorar):
| Usuário vê | Backend |
|---|---|
| Trecho | `Phase` + `BudgetPool(linked_phases)` dedicado + `BudgetPoolPhaseLink` |
| Pote | `BudgetPool(scope:'global')` (+ data/meta opcionais) |
| Evento | `PlannedOccurrence(kind:'event')` (reserva do trecho **ou** Pote próprio) |
| Compra planejada | `PlannedPurchase` |
| Sub-trecho (V2) | `PlannedOccurrence(kind:'sub_destination')` — **NÃO implementar agora** |

---

## 1. Stack, comandos e deploy

- **Stack:** React 19 + TypeScript + Vite 6 · Dexie 4 (IndexedDB, schema **v9**) · Vitest 3 · Playwright · Tailwind · i18next (pt-BR/en/es) · Capacitor 8 (Android) · Cloudflare Worker (`worker/`, Wrangler) · OTA via `@capgo/capacitor-updater`.
- **Qualidade (rodar a cada milestone):**
  - `npm run typecheck` — `tsc --noEmit`
  - `npm run test` — Vitest (unit/domain)
  - `npm run lint` — ESLint
- **Build/deploy (a cada gate):**
  - `npm run build` — `tsc -b && vite build`
  - `npm run test:e2e` — Playwright (golden path)
  - Deploy PWA conforme pipeline atual; bump de **version** no `package.json` + nota em `src/utils/release-notes.ts`; APK/OTA via Capacitor/capgo quando aplicável.
- **Padrão de teste** (regra `test-routing.mdc`): toda função financeira ganha teste de matemática com números concretos; mockar só fronteiras (DB/rede); domínio é puro.

---

## 2. Segurança de migração (ler antes de mexer em schema)

- Bump de Dexie **só quando** adicionar campos (ex.: Pote com `dateStart/dateEnd/goalCents`). Migração Dexie deve ser **aditiva** e com default seguro (campos `null`).
- **Invariante de dinheiro:** nenhuma migração pode alterar a soma total de dinheiro de uma viagem. Escreva um teste que cria uma viagem v(N-1), migra e assere `sum(before) === sum(after)`.
- **Viagem legada (1 pool / N fases):** continua válida. O seletor de "pool da fase ativa" (GATE 1) deve devolver esse pool único corretamente. NÃO recriar pools automaticamente em viagens existentes — só viagens novas nascem com 1 pool/trecho. Para legadas, oferecer (GATE 2) um assistente opcional "dividir por trecho" — nunca forçado.
- Antes de cada gate que mexe em dados: confirmar que o snapshot diário local (DEC-159) e o backup seguem íntegros.

---

## 3. Protocolos (padrão de hardening — valem para todos os gates)

### 3.1 Self-check por milestone (5 pontos, antes de cada commit)
1. Liste os IDs de AC satisfeitos pelo milestone.
2. Cite 3 ACs anteriores em risco de regressão e verifique-os.
3. Rode `npm run test` — confirme zero novas falhas.
4. Sinalize qualquer arquivo tocado fora do escopo do milestone.
5. Acrescente entrada no `dev-log.md`.

### 3.2 Gate Checkpoint (entre gates)
- Suite completa passando (0 falhas) + `build` ok + `typecheck` ok.
- Golden path E2E (criar viagem → trecho → pote → evento → gasto) ok.
- **Reverificar TODAS as ACs dos gates anteriores** (cumulativo).
- Revisar arquivos alterados contra "scope creep".
- Atualizar `dev-log.md` (status do gate) + **Context Refresh** (3.3).
- **Deploy** do gate (bump de versão + nota de release).

### 3.3 Context Refresh (início de cada gate, sessão única)
1. Reler `budget-model-master-decision-2026-06-17.md` (decisões).
2. Reler a seção do PRÓXIMO gate aqui.
3. Reler `dev-log.md` (estado atual).
4. Reescrever o bloco NON-NEGOTIABLES.
5. Imprimir CURRENT STATE (5 linhas: gate, último milestone, contagem de testes, build, riscos).

### 3.4 Mid-Gate Refresh (a cada 3 milestones dentro de um gate)
Reler regras críticas + `dev-log.md` Current State + reimprimir NON-NEGOTIABLES.

### 3.5 dev-log.md
Manter estado corrente (gate ativo, último milestone, contagem de testes, build) + entrada por milestone (o que foi feito, testes, riscos de regressão) + resumo por gate.

---

## 4. GATES

> 6 gates, cada um **deployável** sozinho. Implemente **um gate por vez** e pare para o Julio revisar.

### ✅ GATE 1 — Dashboard segue a FASE ATIVA (alto valor, baixo risco)
**Objetivo:** corrigir o `linkedPools[0]` para o pool da **fase ativa**. Funciona tanto pra viagem legada (1 pool) quanto pro modelo novo (N pools).

| Milestone | Entrega | Testes |
|---|---|---|
| M1.1 | `selectActivePhasePool(pools, links, activePhaseId)` puro em `domain/budget` | unit: 1-pool/N-fases → o pool; N-pools → o da fase ativa; sem fase ativa → fallback coerente |
| M1.2 | `useDashboardModel.ts`: usar o seletor no lugar de `linkedPools[0]` | regressão do hero "Livre hoje" |
| M1.3 | `TripHubPage.tsx`: `freeForPhase` usa o pool da fase (não `pools.find(scope)`) | regressão por-fase |
| M1.4 | Smoke E2E: dashboard mostra orçamento da fase ativa ao trocar de fase | e2e |

**ACs:** (AC1) viagem legada inalterada; (AC2) com N pools, hero reflete a fase ativa; (AC3) "de onde vem esse número" coerente. **Deploy:** bump patch (0.70.x).

---

### ✅ GATE 2 — Trecho com orçamento dedicado + vocabulário + fronteiras
**Objetivo:** criar trecho = criar Phase+Pool+Link automaticamente; vocabulário "Trecho"; impedir sobreposição; dia de fronteira → trecho que começa; total = soma.

| Milestone | Entrega | Testes |
|---|---|---|
| M2.1 | Orquestrador `createPhaseWithBudget` (atômico: Phase + Pool dedicado + Link) | unit: cria 3 entidades; rollback em erro |
| M2.2 | UI "Adicionar trecho" (nome+datas+valor); vocabulário "Trecho"/"Orçamento do trecho"; esconder "fundo/pool/link" | — |
| M2.3 | Validação anti-sobreposição (D12) + regra do dia de fronteira = trecho que começa (D13), editável | unit: detecta overlap; 15/07 → Eurotrip |
| M2.4 | Total da viagem = soma dos trechos (+ potes à parte) sempre visível; feedback "falta distribuir / passou €X"; sugerir remanejar (reusar `computePoolTransfer`/`applyPhaseLeftover`) | unit: soma; estouro; transfer preserva total |
| M2.5 | i18n pt-BR/en/es dos novos textos | — |

**ACs:** trecho criado em ≤3 campos; sem overlap possível; total correto; remanejar preserva total; legada migrável por assistente opcional. **Deploy:** bump minor.

---

### ✅ GATE 3 — Potes unificados + visibilidade + seção "Potes e planejados"
**Objetivo:** Pote = 1 conceito (global pool + data/meta opcionais); regra de visibilidade D8; seção dedicada; gasto antecipado entre trechos.

| Milestone | Entrega | Testes |
|---|---|---|
| M3.1 | Campos opcionais no Pote (`dateStart`,`dateEnd`,`goalCents`) — Dexie bump aditivo; invariante de dinheiro | unit migração: soma intacta |
| M3.2 | Criação de Pote com **chips de exemplo** (usar os textos do master §10.4, i18n pt-BR/en/es) + microcopy do "porquê" (DEC-041) | — |
| M3.3 | `selectVisiblePots(pots, activePhase, today)` (D8): sobe na Home se (no trecho dono) OU (≤ D-7 da data); nunca em trecho não-dono; aba lista todos | unit: Tomorrowland oculto em Burgos, visível na Eurotrip / D-7 |
| M3.4 | Seção "Potes e planejados" no `TripHubPage` (`/viagem`) + criação pelo FAB central. **NÃO** usar "Mais" (removido; Copiloto ocupou o slot, ver `nav-tabs.ts`); Copiloto pode só deep-linkar um pote relevante (§6 do master) | — |
| M3.5 | Gasto antecipado: QuickAdd seleciona Pote de qualquer trecho; aparece no extrato | unit/e2e: 50 € no Pote em junho; Burgos intacto |

**ACs:** Tomorrowland não polui Burgos; aparece ao entrar na Eurotrip; saldo do pote correto; pote sempre a 1 toque. **Deploy:** bump minor.

---

### ✅ GATE 4 — Eventos de primeira classe + porta única de planejamento
**Objetivo:** dissolver a confusão Evento×Pote; uma porta "Planejar um gasto" que roteia pelas 2 perguntas; Evento deixa de ser escondido; funding = reserva do trecho OU Pote próprio.

| Milestone | Entrega | Testes |
|---|---|---|
| M4.1 | Fluxo "Planejar um gasto": P1 *"tem data?"* + P2 *"de onde vem o dinheiro?"* (**3 opções**: comer da fase · criar Pote novo · usar Pote existente) → cria Evento / Evento+Pote novo / Evento+Pote existente / Compra / Pote; orquestrador roteador. Chips de exemplo do master §10.4 (i18n pt-BR/en/es) | unit: cada combinação cria a entidade certa e liga o pool certo |
| M4.2 | Evento como ação de primeira classe (FAB "Planejar" + seção da Viagem do §6); manter entrada na edição de fase | — |
| M4.3 | Funding do Evento em **3 vias**: (a) reserva do trecho (subtrai, padrão); (b) **criar Pote novo** ligado ao evento (aditivo); (c) **usar Pote existente** (escolhe da lista). Tomorrowland = Evento + Pote novo €200 | unit: (a) subtrai dos 678; (b) e (c) não subtraem do trecho; pote existente debita só o pote |
| M4.4 | Surface de eventos na Home por data (reusar D8; "Iniciar agora" já existe) | unit/e2e |

**ACs:** criar Tomorrowland numa única porta; "evento usa o fundo" por padrão; nenhum conceito técnico exposto; eventos visíveis sem entrar na edição de fase. **Deploy:** bump minor.

---

### ✅ GATE 5 — Carteira progressiva
**Objetivo:** invisível com 1 fonte; acende com 2+ carteiras ou import Wise (+ toggle manual); quando acesa, vale pra todos os gastos.

| Milestone | Entrega | Testes |
|---|---|---|
| M5.1 | `isWalletTrackingActive(wallets, settings, hasWiseImport)` + toggle manual em Configurações (D10) | unit: 1 carteira→off; 2+→on; import→on; toggle força |
| M5.2 | QuickAdd: pergunta "de onde saiu?" só quando ativo; senão cai na default | unit/e2e |
| M5.3 | "Sem carteira" cobrável só quando ativo (DEC-051); coerência import Wise (já wallet-bound) | unit |

**ACs:** turista 1-fonte não vê carteira; Julio (Wise+Revolut+dinheiro/import) escolhe a origem; saldos coerentes. **Deploy:** bump minor.

---

### ✅ GATE 6 — Visão avançada + anti-regressão + reconciliação do brain
**Objetivo:** expor o backend para curiosos; garantir zero regressão das especificidades; reconciliar o decision-log.

| Milestone | Entrega | Testes |
|---|---|---|
| M6.1 | Configurações → "Visão avançada da viagem": fundos/vínculos/envelopes/carteiras (ver + editar) (D17) | — |
| M6.2 | Verificar ritmo/pico/eventos/atividades como passos **opcionais e progressivos** (D16) — auditoria anti-regressão | suite completa de regressão |
| M6.3 | Reconciliar `decision-log.md`: escrever DEC-2xx (§9 do master), anotar/superar DEC-007/089/153; atualizar `product-spec.md` e `project-status.md` | — |
| M6.4 | Golden path E2E completo + suite + build final | e2e + build |

**ACs:** tudo do modelo antigo ainda possível; brain reconciliado e sem contradição de eras. **Deploy:** bump minor → candidata a release "modelo de orçamento v2".

---

## 5. Acceptance Criteria (cumulativo — reverificar a cada gate)
- [ ] Viagem legada (1 pool) 100% funcional após cada gate.
- [ ] Dashboard mostra o orçamento da **fase ativa**.
- [ ] Trecho criado com nome+datas+valor; total da viagem = soma; sem sobreposição possível; dia de fronteira → trecho que começa.
- [ ] Pote unificado com data/meta opcionais; Tomorrowland não polui Burgos e sobe na Eurotrip/D-7; gasto antecipado funciona; aba "Potes e planejados" lista tudo.
- [ ] Uma porta de "Planejar um gasto"; Evento reserva do trecho por padrão ou usa Pote próprio; eventos não ficam escondidos.
- [ ] Carteira progressiva (auto + toggle); coerente com import Wise.
- [ ] "Visão avançada" expõe o backend; nenhuma especificidade (ritmo/pico/eventos) perdida.
- [ ] decision-log reconciliado (DEC-007/089/153).
- [ ] `typecheck` + `test` + `build` + golden E2E verdes em todos os gates.

## 6. Riscos & mitigações
- **Migração de dados** → invariante de soma + testes de migração + nunca recriar pools em legadas automaticamente.
- **Sensação de "dinheiro único"** vs silos por trecho → total da viagem sempre visível + remanejar 1-toque (D5/D14).
- **Scope creep** → **fora de escopo dos 6 gates**: (a) **sub-trecho V2** (só `sub_destination` permanece como está); (b) **"travar teto" da viagem** (backlog avançado, master §10.2); (c) **janela de visibilidade configurável** (V1 = D-7 fixo, master §10.1).
- **Regressão de especificidades** → auditoria M6.2 + ACs cumulativas + suite a cada milestone.
- **Sessão única longa** → Context Refresh por gate + Mid-Gate Refresh a cada 3 milestones.

## 7. Ordem recomendada de entrega
GATE 1 (ganho rápido) → 2 → 3 → 4 → 5 → 6. Cada gate é deployável; pare para revisão do Julio entre gates.
