# TripPilot — Orquestrador "Itinerary Copilot" (fonte de verdade de execução)

> **Última atualização:** 2026-07-10 · **App:** 2.11.3-rc → 2.12.0-rc por gate
> **Status:** ⏳ AWAITING KICKOFF
> **Deadline:** 14/Jul/2026 (antes da viagem de 15/Jul)
>
> **Origem:** análise completa da planilha de viagem do Julio + council de design. Feature de itinerário com IA conversacional — o TripPilot ganha logística ("onde/quando") além do financeiro ("quanto").

---

## 0. Missão

Você é um engenheiro full-stack sênior implementando a wave "Itinerary Copilot" de ponta a ponta, sozinho, nesta sessão. O app já existe, está testado e no ar (2.11.3-rc, ~3340 testes). Seu trabalho é:

1. **Criar a entidade ItineraryLeg** — novo modelo de dados que substitui sub-destinos (nunca usados)
2. **Criar o Worker endpoint** — IA conversacional que monta o itinerário por perguntas
3. **Criar a tela de conversa** — user responde, IA constrói, user confirma
4. **Criar o card "Próximo"** no Home — onde estou, o que vem
5. **Criar a tela de Agenda** — timeline do dia com transportes, hospedagem, atividades

**Implementar → testar → corrigir → só avançar quando PERFEITO → deploy.**

**Vá para §17 para começar.**

---

## 1. Identidade & regras absolutas

Você é o **executor**, não um coordenador.

1. SEM subagents / SEM Task tool. Tudo inline, nesta sessão.
2. NÃO peça permissão para avançar. Milestone done → testes verdes → commit → deploy → next.
3. NÃO pare porque "é muito trabalho". Continue até §12 ser toda TRUE.
4. NÃO resuma o que vai fazer — FAÇA. Minimize narração.
5. Código → inglês. UI → `t()` com pt-BR/en/es.
6. Domínio antes de UI, uma mudança por vez, teste junto com a mudança.
7. Terminal WSL: sempre `git --no-pager`, sempre `git commit -m`. Nunca pager/editor.
8. Deploy via `bash scripts/deploy.sh` (NUNCA manual). Version bump nos 3 lugares ANTES.
9. Brain em sincronia: dev-log cada milestone, decision-log cada decisão nova.

---

## 2. Ordem de leitura

1. Este documento §0–§9, depois o gate ativo em §10.
2. `src/dev-log.md`
3. `brain/decision-log.md`
4. Arquivos citados na §6
5. `brain/documents/2026-07-10-itinerary-feature-design.md` (design completo da feature)

---

## 3. Não-negociáveis (ÂNCORA)

**Herdados do app:**
- Dinheiro = inteiro em centavos. Domínio = TS puro, zero React.
- Texto de UI sempre via `t()`, três idiomas (pt-BR, en, es).
- Esconder, nunca deletar.
- Invariância de dados: nenhuma feature nova ALTERA o cálculo de livre/cofrinho/planner.
- Nunca bloquear o registro de gasto.

**Herdados da AI wave:**
- ÂNCORA-AI-1: App NUNCA confia na aritmética da IA.
- ÂNCORA-AI-3: Zero dados pessoais enviados à IA (nomes reais ficam no device).
- ÂNCORA-AI-4: Offline = funcional. IA é upgrade, não dependência.
- ÂNCORA-AI-5: Modo manual continua existindo (pode criar legs manualmente).

**Novos, desta wave:**
- ÂNCORA-ITIN-1: O itinerário é OPT-IN. Se não criou, o app é idêntico a antes. ZERO impacto em telas existentes.
- ÂNCORA-ITIN-2: O card no Home SÓ aparece se `itineraryLegs.length > 0`.
- ÂNCORA-ITIN-3: Prepaid é INFORMATIVO — não cria transação, não afeta livre/cofrinho/phase spend.
- ÂNCORA-ITIN-4: Legs SUBSTITUEM sub-destinos (`kind: 'sub_destination'` em PlannedOccurrence). Migration suave: código novo ignora sub-destinos; data antiga não é deletada.
- ÂNCORA-ITIN-5: O Itinerary Copilot é SEPARADO do Plan Copilot (DEC-492). Endpoints distintos, telas distintas, flows distintos.
- ÂNCORA-ITIN-6: A IA sugere fases com base no itinerário. User confirma com 1 tap para criar. Nunca cria silenciosamente.

---

## 4. Baseline — o que já existe

| Área | Arquivo(s) | Status |
|------|-----------|--------|
| PlannedOccurrence (sub-destino) | `src/domain/types/planned-occurrence.ts` | ⚠️ Existe mas NUNCA foi usado em produção real. Será substituído por ItineraryLeg. |
| Plan Copilot (DEC-492) | `src/features/plan-copilot/` + Worker | ✅ Existe — é o AI Planning de BUDGET. Não tocar. |
| Home Dashboard | `src/features/dashboard/` | ✅ Existe — adicionar card novo. |
| Worker (Groq) | `worker/src/index.ts` | ✅ Existe — adicionar endpoint novo. |
| Schema Dexie | `src/data/db/database.ts` + `schema.ts` | ✅ V13 — adicionar V14 com `itineraryLegs`. |
| Deploy script | `scripts/deploy.sh` | ✅ Usar como está. |

---

## 5. Decisões travadas (§12 respondido pelo Julio)

| # | Pergunta | Decisão | Implicação |
|---|----------|---------|------------|
| 1 | Gera fases ou sugere? | **Sugere + pronto para 1-tap confirm** | UI mostra "Criar estas fases?" com preview. Tap cria. |
| 2 | Legs vs sub-destinos? | **Legs substituem** | Nova entidade. Sub-destinos ignorados (não deletados). |
| 3 | Mesma conversa ou separada? | **Separadas** | Endpoint `/itinerary-copilot/build`. Tela própria. |
| 4 | Prepaid? | **Informativo, só no itinerário** | Não cria transação. Campo `isPrepaid` na leg. |
| 5 | Timing? | **Antes de 15/Jul** | 4 dias úteis. Scope tight. |

---

## 6. Schema da nova entidade

```typescript
// src/domain/types/itinerary-leg.ts
export type TransportType = 'flight' | 'train' | 'bus' | 'car' | 'ferry' | 'walk' | 'other';
export type BookingStatus = 'purchased' | 'booked' | 'priced' | 'estimated' | 'none';
export type DayType = 'full' | 'transit' | 'festival' | 'rest' | 'day_trip';

export interface ItineraryLeg {
  id: string;
  tripId: string;
  order: number;

  // Where
  cityName: string;
  countryCode: string | null;

  // When
  arrivalDate: string;       // ISO "2026-07-15"
  arrivalTime: string | null; // "18:05"
  departureDate: string;
  departureTime: string | null;

  // How you arrive
  arrivalTransport: {
    type: TransportType;
    company: string | null;
    route: string | null;
    bookingStatus: BookingStatus;
    costCents: number | null;
    costCurrency: string | null;
    isPrepaid: boolean;
    reference: string | null;
    notes: string | null;
  } | null;

  // Where you sleep
  accommodation: {
    name: string;
    type: 'hotel' | 'hostel' | 'apartment' | 'friend' | 'airbnb' | 'camping' | 'other';
    bookingStatus: BookingStatus;
    costCents: number | null;
    costCurrency: string | null;
    isPrepaid: boolean;
    nights: number;
    reference: string | null;
    notes: string | null;
  } | null;

  // Budget context
  dailyBudgetCents: number | null;
  dailyBudgetCurrency: string | null;
  budgetPremise: string | null;

  // Context
  companions: string[];
  dayType: DayType;
  highlights: string[];

  // Link to existing model
  linkedPhaseId: string | null;

  // Metadata
  createdAt: string;
  updatedAt: string;
}
```

---

## 7. Change-set normalizado

| ID | Item | Gate |
|----|------|:----:|
| F01 | Entidade `ItineraryLeg` + tipo + schema V14 (Dexie) | G1 |
| F02 | Repository CRUD (`itinerary-leg-repository.ts`) | G1 |
| F03 | Domain functions puras (`itinerary-domain.ts`: current leg, next transport, day agenda) | G1 |
| F04 | Worker endpoint `POST /itinerary-copilot/build` (Groq + prompt) | G2 |
| F05 | Worker endpoint `POST /itinerary-copilot/refine` (ajustes pós-criação) | G2 |
| F06 | Tela de conversa com IA (`ItineraryCopilotFlow.tsx`) | G3 |
| F07 | Tela de confirmação (preview do itinerário + 1-tap create) | G3 |
| F08 | Sugestão de fases + confirmação (`suggestPhasesFromLegs`) | G3 |
| F09 | Card "Próximo / Onde estou" no Home (`ItineraryContextCard`) | G4 |
| F10 | Tela de Agenda do dia (`/itinerary` + `/itinerary/:date`) | G4 |
| F11 | Entrada no "Mais" + rotas | G4 |
| F12 | i18n completo (pt-BR, en, es) | G4 |
| F13 | CRUD manual (criar/editar/deletar leg sem IA) | G5 |
| F14 | Deploy + verificação apex | G5 |

---

## 8. Estratégia de testes

### Unit tests (Vitest, domínio puro):
- `itinerary-domain.test.ts` — currentLeg, nextTransport, dayAgenda, suggestPhases
- `itinerary-leg-repository.test.ts` — CRUD com fixture realista (dados da planilha do Julio)
- `itinerary-copilot-parser.test.ts` — parsing da resposta da IA → array de ItineraryLeg

### Integration tests:
- Worker endpoint: curl com fixture → resposta válida parseável
- DB migration V13→V14: schema aceita legs sem quebrar tabelas existentes

### Regressão:
- Suite inteira DEVE rodar verde entre cada gate (baseline ~3340 tests)
- `tsc --noEmit` limpo
- `npm run build` verde
- ZERO impacto nas telas existentes (ÂNCORA-ITIN-1)

### Fixtures:
- Fixture principal: dados do CSV do Julio mapeados para ItineraryLeg[] (14 legs, 18 transportes)
- Fixture mini: 3 legs simples para testes rápidos

---

## 9. Protocolo por milestone (RIGOROSO)

**Antes de avançar ao próximo milestone, TODOS devem ser TRUE:**

1. ✅ Código implementado conforme o AC
2. ✅ Testes novos escritos e passando
3. ✅ Suite inteira rodada: `npm run test` — 0 failures novas
4. ✅ `tsc --noEmit` — 0 erros
5. ✅ `npm run build` — sucesso
6. ✅ Nomear 3 ACs anteriores com risco de regressão e VERIFICAR
7. ✅ Nenhum arquivo fora do escopo modificado
8. ✅ dev-log atualizado com o que foi feito

**Se QUALQUER item falhar:**
- NÃO avançar
- Investigar e corrigir
- Re-rodar checklist
- Só avançar quando TUDO verde

**Deploy: ao final de cada GATE (não cada milestone)**
- Version bump nos 3 lugares
- Release notes
- `bash scripts/deploy.sh`
- Verificar apex live: `curl https://trippilot.pages.dev/version.json`

---

## 10. THE BUILD — Gates G0→G5

---

### G0 — Setup & Baseline

**Milestones:**
- M0.1: `npm install` + `npm run test` + `npm run build` + `tsc --noEmit` → documentar baseline
- M0.2: Semear dev-log com tabela desta wave
- M0.3: Adicionar DECs relevantes no decision-log (DEC-510: ItineraryLeg, DEC-511: Itinerary Copilot separado, DEC-512: Legs substituem sub-destinos)

**AC:**
- [ ] Suite verde documentada (X files / Y tests)
- [ ] Build verde
- [ ] tsc limpo
- [ ] dev-log semeado
- [ ] DECs registrados

**Version:** 2.11.3-rc (sem bump, só setup)

---

### G1 — Schema + Domain + Repository (F01, F02, F03)

**Milestones:**

**M1.1 — Entidade + Schema V14:**
- Criar `src/domain/types/itinerary-leg.ts` com interface conforme §6
- Criar SCHEMA_V14 em `src/data/db/schema.ts`: `itineraryLegs: 'id, tripId, order, arrivalDate, linkedPhaseId'`
- Registrar V14 no `database.ts`
- Adicionar `itineraryLegs!: EntityTable<ItineraryLeg, 'id'>` na classe DB

**M1.2 — Repository:**
- Criar `src/data/repositories/itinerary-leg-repository.ts`
- Funções: `getAll(tripId)`, `getById(id)`, `save(leg)`, `saveBatch(legs)`, `remove(id)`, `removeAll(tripId)`
- Test file: `src/tests/unit/itinerary-leg-repository.test.ts`

**M1.3 — Domain functions:**
- Criar `src/domain/itinerary/itinerary-domain.ts`
- Funções puras:
  - `getCurrentLeg(legs, today)` → leg onde `arrivalDate <= today <= departureDate`
  - `getNextTransport(legs, today, now?)` → próximo transporte com hora (hoje ou próximo dia)
  - `getDayAgenda(legs, date)` → items do dia ordenados (transporte chegada + hospedagem + highlights)
  - `suggestPhasesFromLegs(legs)` → array de { name, startDate, endDate, legs[] } agrupando por proximidade geográfica/temporal
  - `getTripSummary(legs)` → { totalCities, totalDays, totalPrepaidCents, currencies[] }
- Test file: `src/tests/unit/itinerary-domain.test.ts` (com fixture do Julio: 14 legs)

**ACs (G1):**
- [ ] `ItineraryLeg` interface criada e tipada corretamente
- [ ] DB schema V14 registrado, migration aceita sem erros
- [ ] Repository CRUD funcional com testes passando
- [ ] `getCurrentLeg` retorna a leg correta para qualquer data da fixture
- [ ] `getNextTransport` retorna o próximo transporte com hora a partir de agora
- [ ] `getDayAgenda` retorna timeline correta para dia 04/Ago (dia complexo: Luzern→Zürich→MAD)
- [ ] `suggestPhasesFromLegs` agrupa as 14 legs em 3 fases (Itália/Bélgica/Suíça)
- [ ] Suite inteira verde: 0 failures novas
- [ ] tsc limpo, build verde

**Version:** 2.11.4-rc → deploy

---

### G2 — Worker Endpoint: Itinerary Copilot (F04, F05)

**Milestones:**

**M2.1 — Endpoint `/itinerary-copilot/build`:**
- Recebe: `{ tripName, startDate, endDate, baseCurrency, language, userInput: string }`
- `userInput` é texto LIVRE — pode ser "Veneza 2 dias, Ljubljana 2..." ou o CSV colado inteiro
- Prompt Groq (llama-3.3-70b-versatile, JSON mode):
  - System: "You are a travel itinerary assistant. Parse the user's trip information into structured legs."
  - Output schema definido (array de legs com todos os campos)
  - Forçar língua do `language` para `budgetPremise` e `highlights`
  - NUNCA inventar dados não mencionados (horários, preços, etc.)
- Rate limit: reusa `RL_AI` existente
- Retorna: `{ legs: ItineraryLeg[], suggestedPhases: { name, startDate, endDate }[], summary: string }`

**M2.2 — Endpoint `/itinerary-copilot/refine`:**
- Recebe: `{ currentLegs: ItineraryLeg[], refinement: string, language }`
- `refinement` é instrução de ajuste: "o hostel em Amsterdam é St Christopher's Inn" ou "adiciona 1 dia em Bruges"
- Retorna: `{ legs: ItineraryLeg[], changes: string[] }` (legs atualizadas + lista de mudanças em linguagem natural)

**M2.3 — Parser client-side:**
- Criar `src/domain/itinerary/itinerary-copilot-parser.ts`
- Valida e normaliza a resposta da IA (coerção defensiva — ÂNCORA-AI-1)
- IDs gerados no client (uuid), não confia na IA para IDs
- Valores monetários: string "€34.40" → centavos + currency code
- Datas: valida ISO, rejeita inválidas
- Test file: `src/tests/unit/itinerary-copilot-parser.test.ts`

**ACs (G2):**
- [ ] Endpoint `/itinerary-copilot/build` responde 200 com JSON válido
- [ ] Prompt produz output parseável para o input "Veneza 2 dias, Ljubljana 2, Trieste 1..."
- [ ] Prompt produz output parseável para o CSV colado inteiro do Julio
- [ ] Endpoint `/itinerary-copilot/refine` ajusta legs existentes corretamente
- [ ] Parser client normaliza todas as respostas sem crash (incluindo edge cases: campos faltando, tipos errados)
- [ ] Rate limit aplicado
- [ ] Testes do parser com 10+ cenários (happy path + edge cases)
- [ ] Suite inteira verde
- [ ] tsc limpo (app + worker)
- [ ] Worker deploy: `cd worker && npx wrangler deploy` → verde

**Version:** 2.11.5-rc → deploy (app + worker)

---

### G3 — UI: Conversa com IA + Confirmação (F06, F07, F08)

**Milestones:**

**M3.1 — Tela de conversa (`/itinerary/create`):**
- Criar `src/features/itinerary/ItineraryCopilotFlow.tsx`
- Flow:
  1. Pergunta: "Como quer criar o itinerário?" → [💬 Passo a passo] [📋 Já tenho as infos]
  2. Se "Passo a passo": perguntas sequenciais (cidades → tempo → transportes → hospedagem → eventos)
  3. Se "Já tenho": campo de texto grande (textarea) + botão "Montar"
  4. Loading state enquanto Worker processa
  5. Resultado: preview do itinerário + botão "Confirmar" ou "Ajustar"
- Usar pattern de `PlanCopilotFlow` como referência visual

**M3.2 — Tela de confirmação:**
- Preview: lista de legs com ícones (✈️🚂🚌), datas, cidades
- Seção "Fases sugeridas" com 1-tap confirm (ÂNCORA-ITIN-6):
  - Mostra preview: "Fase 1: Itália + Eslovênia (15-21 Jul) · Fase 2: ..."
  - Botão "Criar estas fases" → cria Phase + BudgetPool para cada
  - Botão "Pular" → salva legs sem criar fases
- Botão "Salvar itinerário" → persiste no IndexedDB
- Botão "Ajustar com IA" → campo de texto + `/refine`

**M3.3 — Sugestão de fases:**
- `suggestPhasesFromLegs` já existe no domain (G1)
- UI mostra as fases sugeridas como cards com toggle on/off
- Ao confirmar: cria Phase + BudgetPool vazios (user configura budget depois)
- Guard: se fases JÁ EXISTEM com budget > 0, mostra aviso "Já existem fases configuradas. Criar novas vai substituí-las?" com opção de cancelar.

**ACs (G3):**
- [ ] Tela de conversa abre em `/itinerary/create`
- [ ] Modo "Já tenho" envia texto ao Worker e recebe legs
- [ ] Modo "Passo a passo" faz perguntas sequenciais e acumula respostas
- [ ] Preview mostra todas as legs com informações corretas
- [ ] "Criar fases" cria Phase + BudgetPool para cada sugestão
- [ ] "Pular" salva legs sem criar fases
- [ ] "Ajustar com IA" envia refinamento e atualiza preview
- [ ] Loading states e error handling (offline, timeout, erro da IA)
- [ ] i18n: todo texto via `t()`, 3 idiomas
- [ ] Suite verde, tsc limpo, build verde
- [ ] Telas existentes (Home, Planner, Gastos) INTOCADAS

**Version:** 2.11.6-rc → deploy

---

### G4 — Home Card + Tela de Agenda (F09, F10, F11, F12)

**Milestones:**

**M4.1 — Card "Contexto" no Home:**
- Criar `src/features/itinerary/ItineraryContextCard.tsx`
- Lógica: `useItineraryContext(tripId, today)` → { currentLeg, nextTransport, dayNumber, totalDays }
- Mostra:
  - 📍 {cidade} · Dia {N} de {total}
  - ⏭️ {hora} {tipo} → {destino} ({duração}) — se há transporte hoje
  - 🏠 {hospedagem} — se há hospedagem
  - [Ver agenda →]
- Posição no Home: ABAIXO do hero "Livre hoje", ACIMA do carrossel de ocasiões
- GUARD (ÂNCORA-ITIN-2): componente retorna `null` se não há legs

**M4.2 — Tela de Agenda (`/itinerary`):**
- Criar `src/features/itinerary/ItineraryPage.tsx`
- Scroll horizontal de dias (today highlighted)
- Para o dia selecionado:
  - Header: cidade + tipo de dia + companheiros
  - Timeline cronológica com ícones
  - Seção "Budget do dia" com premissa
  - Highlights (atividades especiais)
- Tap em leg individual → sheet de detalhe (editar/remover)

**M4.3 — Navegação + Mais:**
- Adicionar rota `/itinerary` e `/itinerary/create` no router
- Adicionar entrada "Itinerário da viagem" no menu "Mais" (entre "Diário" e "Mapa")
- Card no Home linka para `/itinerary` com a data de hoje

**M4.4 — i18n completo:**
- Namespace `itinerary.*` com todas as strings
- 3 idiomas: pt-BR, en, es
- Termos: "Itinerário" / "Itinerary" / "Itinerario", "Próximo" / "Next" / "Próximo", etc.

**ACs (G4):**
- [ ] Card aparece no Home quando há legs no trip (ÂNCORA-ITIN-2)
- [ ] Card NÃO aparece quando não há legs (regressão zero)
- [ ] Card mostra cidade atual, dia N/total, próximo transporte
- [ ] Tela de agenda mostra timeline correta para o dia 04/Ago (fixture Julio)
- [ ] Scroll de dias funciona, today highlighted
- [ ] Menu "Mais" tem link para itinerário
- [ ] Navegação funcional: Home card → agenda, Mais → agenda, agenda → create
- [ ] i18n completo sem strings hardcoded
- [ ] Suite verde, tsc limpo, build verde
- [ ] Home dashboard INTOCADO fora do card novo

**Version:** 2.11.7-rc → deploy

---

### G5 — CRUD Manual + Polish + Deploy Final (F13, F14)

**Milestones:**

**M5.1 — CRUD manual:**
- Na tela de agenda, botão "+" para criar leg manualmente
- Form: cidade, datas, transporte, hospedagem (cada um colapsável)
- Editar: tap na leg → sheet com form preenchido
- Deletar: swipe ou botão no sheet

**M5.2 — Polish e edge cases:**
- Leg sem transporte (só cidade + datas) = válido
- Leg sem hospedagem (dia de transição que dorme na próxima) = válido
- Legs com gaps de data (dias sem leg = ok, não mostra)
- Reordenar legs (drag ou auto por data)
- Empty state: "Nenhum itinerário criado. [Criar com IA] ou [Criar manualmente]"

**M5.3 — Testes de integração finais:**
- Testar flow completo: criar via IA → confirmar → ver no Home → ver na agenda
- Testar flow manual: criar leg → editar → deletar
- Testar que NADA do financeiro foi afetado (rodar testes de budget/planner/dashboard)
- Confirmar que fixture do Julio (14 legs) funciona end-to-end

**M5.4 — Deploy final:**
- Version bump → `2.12.0-rc` (minor bump = feature nova)
- Release notes em 3 idiomas
- `bash scripts/deploy.sh` (pages)
- `cd worker && npx wrangler deploy` (worker com endpoints novos)
- Verificar apex: version.json, bundle, endpoint `/itinerary-copilot/build` responde

**ACs (G5):**
- [ ] CRUD manual funcional (criar, editar, deletar leg)
- [ ] Empty state quando sem itinerário
- [ ] Fixture completa (14 legs do Julio) carrega e exibe corretamente
- [ ] Suite inteira verde (ZERO failures novas)
- [ ] tsc limpo, build verde
- [ ] Deploy completo (pages + worker)
- [ ] Apex verde: version.json = 2.12.0-rc
- [ ] Worker verde: `/itinerary-copilot/build` responde 200

**Version:** 2.12.0-rc → deploy final

---

## 11. DoD (Definition of Done) — todas MUST be TRUE para fechar a wave

- [ ] Entidade `ItineraryLeg` no schema com CRUD funcional
- [ ] Worker endpoints `/itinerary-copilot/build` e `/refine` respondendo
- [ ] IA parseia texto livre e gera legs válidas
- [ ] Tela de conversa funcional (passo a passo + "já tenho")
- [ ] Sugestão de fases funcional com 1-tap confirm
- [ ] Card no Home mostrando contexto atual (cidade + próximo transporte)
- [ ] Tela de agenda com timeline do dia
- [ ] CRUD manual (criar/editar/deletar sem IA)
- [ ] i18n completo (pt-BR, en, es)
- [ ] Suite inteira verde (0 failures novas sobre baseline)
- [ ] tsc limpo, builds verdes
- [ ] Deploy completo (pages + worker)
- [ ] ÂNCORA-ITIN-1 verificada: sem itinerário, app idêntico a antes
- [ ] ÂNCORA-ITIN-3 verificada: prepaid não afeta livre/cofrinho

---

## 12. Context Refresh Protocol

### A cada gate boundary (OBRIGATÓRIO):
1. Re-ler este documento §3 (ÂNCORAS)
2. Re-ler `src/dev-log.md` (estado atual)
3. Rodar suite completa: `npm run test`
4. Rodar build: `npm run build`
5. Rodar tsc: `tsc --noEmit`
6. Output NON-NEGOTIABLES:
```
ÂNCORA-ITIN-1: Opt-in, zero impacto sem itinerário
ÂNCORA-ITIN-2: Card só com legs > 0
ÂNCORA-ITIN-3: Prepaid informativo
ÂNCORA-ITIN-4: Legs substituem sub-destinos
ÂNCORA-ITIN-5: Separado do Plan Copilot
ÂNCORA-ITIN-6: Sugere fases, user confirma
```
7. Output CURRENT STATE:
```
Gate: [G?]
Last milestone: [M?.?]
Tests: [X files / Y passed / Z failed]
Build: [OK/FAIL]
tsc: [OK/FAIL]
```

### Mid-gate refresh (a cada 2 milestones):
1. Re-ler §3 ÂNCORAS
2. Verificar que não tocou em arquivo fora do escopo
3. Rodar tsc + build

---

## 13. Fixture de referência (dados do Julio)

A fixture principal para testes é derivada do CSV da planilha. Usar como test data:

```typescript
// src/tests/fixtures/julio-eurotrip-legs.ts
export const JULIO_EUROTRIP_LEGS: Omit<ItineraryLeg, 'id' | 'createdAt' | 'updatedAt'>[] = [
  {
    tripId: 'test-trip',
    order: 1,
    cityName: 'Veneza/Mestre',
    countryCode: 'IT',
    arrivalDate: '2026-07-15',
    arrivalTime: null, // chegada madrugada
    departureDate: '2026-07-17',
    departureTime: null,
    arrivalTransport: {
      type: 'flight',
      company: 'Iberia',
      route: 'MAD → VCE',
      bookingStatus: 'purchased',
      costCents: 37971,
      costCurrency: 'BRL',
      isPrepaid: true,
      reference: null,
      notes: '1 bagagem de mão 10 kg',
    },
    accommodation: {
      name: 'Anda Venice Hostel',
      type: 'hostel',
      bookingStatus: 'booked',
      costCents: 28000,
      costCurrency: 'BRL',
      isPrepaid: true,
      nights: 2,
      reference: null,
      notes: '15-17 Jul',
    },
    dailyBudgetCents: 15000,
    dailyBudgetCurrency: 'BRL',
    budgetPremise: 'Dia de transição: lanche aeroporto + refeição simples na chegada. Dia cheio: café/padaria + almoço de rua + jantar takeaway.',
    companions: ['Jessika', 'Farfan'],
    dayType: 'transit',
    highlights: ['Veneza dia cheio com amigos (16/Jul)'],
    linkedPhaseId: null,
  },
  // ... mais 13 legs (Ljubljana, Trieste, Verona, Bruxelas, Tomorrowland, Bruges, Amsterdam, Berlin, Freiburg, Lucerna, Interlaken, Zurique, Madrid)
];
```

---

## 14. Prompt reference (Worker)

### ITINERARY_BUILD_SYSTEM_PROMPT (rascunho)

```
You are a travel itinerary assistant. Your job is to parse the user's trip information into structured itinerary legs.

RULES:
1. Output MUST be valid JSON matching the schema below.
2. NEVER invent data not mentioned by the user (no made-up times, prices, or places).
3. If information is missing, set the field to null.
4. All text fields (budgetPremise, highlights, notes) MUST be in the language: {language}.
5. Costs: extract the amount as integer cents and the currency code. "€34.40" → costCents: 3440, costCurrency: "EUR". "R$120" → costCents: 12000, costCurrency: "BRL".
6. Dates: ISO format "YYYY-MM-DD". Times: "HH:MM" 24h format.
7. Order legs chronologically by arrivalDate.
8. For booking status: "comprado"/"purchased"/"bought" → "purchased". "adquirido"/"booked"/"reserved" → "booked". "fechado"/"fixed price" → "priced". Otherwise → "estimated".
9. suggestedPhases: group legs into 2-4 phases by geographic/temporal proximity.

OUTPUT SCHEMA:
{
  "legs": [ItineraryLeg...],
  "suggestedPhases": [{ "name": string, "startDate": string, "endDate": string }...],
  "summary": "Brief 1-2 sentence summary of the trip"
}
```

---

## 15. Riscos e mitigações

| Risco | Probabilidade | Mitigação |
|-------|:---:|-----------|
| IA retorna JSON inválido | MED | Parser defensivo + retry 1x + fallback "não entendi, tente novamente" |
| Tempo insuficiente (5 dias) | MED | G1-G4 são core. G5 CRUD manual pode ser simplificado (só criar/deletar, sem edit inline) |
| Regressão em testes existentes | LOW | ÂNCORA-ITIN-1 garante isolamento total. Nova tabela, novas rotas, novo card condicional. |
| Schema migration quebra em devices existentes | LOW | V14 é additive-only (nova tabela, nenhum campo adicionado a tabelas existentes) |
| Worker rate limit excedido no teste | LOW | Reusa RL_AI com janela existente. Testes locais com mock. |

---

## 16. Locks (a confirmar pelo Julio antes do kickoff)

- [ ] **L-SCHEMA**: ItineraryLeg como entidade separada (não extensão de PlannedOccurrence)
- [ ] **L-ENDPOINT**: `/itinerary-copilot/build` e `/refine` como endpoints separados do Plan Copilot
- [ ] **L-CARD**: Card no Home abaixo do hero, acima do carrossel
- [ ] **L-NAV**: Itinerário acessível por "Mais" → "Itinerário da viagem"
- [ ] **L-PHASE-SUGGEST**: Ao criar itinerário, sugere fases com preview + 1-tap confirm

Defaults aceitos se não respondido: todos os 5 acima.

---

## 17. Kickoff — COMECE AQUI

1. Leia §0-§9 inteiro (já leu agora)
2. Execute G0 (baseline: install, test, build, tsc, dev-log)
3. Prossiga G1→G5 em sequência, sem parar
4. A cada gate: deploy via `bash scripts/deploy.sh`
5. Ao terminar G5: verifique §11 (DoD) — todas TRUE → wave fechada

**Critério de parada**: §11 ALL TRUE + apex verde com 2.12.0-rc.
