# R6 — Prompt de Correção Total (Auditoria 2026-06-10 + Field Test R3-R5)

> **Fonte da verdade desta rodada.** Execute da Gate 0 à Gate 7 sem parar para pedir
> confirmação. Releia a gate ativa antes de começá-la. Só termine quando TUDO estiver
> implementado, testado (unit + typecheck + build + E2E) e deployado no Cloudflare.
>
> **Entradas consolidadas**:
> - `brain/documents/full-coverage-audit-2026-06-10.md` (BUG-001..004, PAR-001..006, seções 10/12)
> - `brain/documents/field-test-checklist-r3-r5.md` (achados de campo: P2P-09/12/13, P2P-06/07, R-02, R-12, R5-03/04/09)
> - Diagnóstico de causa raiz já confirmado no código (referências exatas em cada gate)

---

## NON-NEGOTIABLES (repetir mentalmente a cada gate)

1. **Dinheiro é sempre centavos inteiros**; nenhuma mudança pode introduzir float em valores.
2. **Datas de agregação diária são SEMPRE o dia local** (`localDayOf`/`localDateString`), nunca `slice(0,10)` de ISO UTC.
3. **Zero regressão**: a suíte completa (317+ unit, 29 E2E) passa a cada gate; novos testes cobrem cada bug corrigido.
4. **Código em inglês** (nomes, comentários, mensagens); UI via i18n nas 3 línguas (pt-BR/en/es) com paridade de chaves.
5. **Edits cirúrgicos**: cada linha alterada rastreia a um item deste prompt; sem refactors adjacentes.
6. **Commits por gate** (`fix(gate-r6-N): ...`), dev-log `src/gap-fix-log-r6.md` atualizado a cada milestone.
7. **Node 22** para wrangler/playwright: `export PATH="$HOME/.nvm/versions/node/v22.22.3/bin:$PATH"`.

---

## Gate 0 — Setup e baseline

- M0.1 Node 22 no PATH; `npm run test`, `npm run typecheck` verdes (baseline conhecida: 317 unit).
- M0.2 Criar `src/gap-fix-log-r6.md` com estado inicial e a lista de gates.

**AC-G0**: baseline verde documentada no dev-log.

---

## Gate 1 — Bugs de domínio da auditoria (P1/P2/P3)

### R6-01 · BUG-001 (P1) — Gasto noturno cai no dia errado (UTC vs dia local)
- **Causa**: `tx.date = new Date().toISOString()` (UTC) + comparações `t.date.slice(0,10) === dateIso`
  contra `localDateString()` (local). Após ~21h em UTC−3 o gasto não reduz o "livre hoje".
- **Arquivos**: `src/domain/transactions/transactions.ts` (calculateSpentOnDate e criação),
  `src/domain/occurrences/occurrences.ts` (sumSpentInOccurrenceInterval), `src/domain/insights/insights.ts`
  (streak), `src/domain/backup/csv-export.ts` (colunas Data/Hora), `src/features/expenses/ExpenseListPage.tsx`,
  `src/features/expenses/ExpenseDetailPage.tsx`, `src/features/expenses/QuickAddPage.tsx`
  (`new Date(customDate).toISOString()` — retroativo).
- **Fix**: criar `localDayOf(isoTimestamp: string): string` em `src/domain/dates/dates.ts`
  (= `format(new Date(iso), 'yyyy-MM-dd')`, dia LOCAL) e usar em todas as comparações/exibições
  de dia. Timestamps continuam ISO UTC (não migrar dados); apenas a projeção para "dia" muda.
- **Testes**: instantes de borda construídos relativos à meia-noite local (TZ-independentes):
  tx criada 1min antes da meia-noite local conta no dia local corrente; retroativo preserva o dia escolhido.

### R6-02 · BUG-002 (P1) — Último dia da fase tratado como "sem fase ativa"
- **Causa**: `findActivePhase` (`src/domain/dates/dates.ts`) usa `isWithinInterval` com
  `parseISO(endDate)` = 00:00 do último dia → o dia inteiro fica de fora. Consumidores caem
  no fallback `?? phases[0]` (QuickAddPage:62, WalletsPage:84, SimulatorPage:51, TripOverviewPage:66).
- **Fix**: comparar por dia local (`startDate <= localDateString(ref) <= endDate`). Trocar os
  fallbacks `?? phases[0]` por `resolveActivePhase` onde aplicável.
- **Testes**: 00:00, 14:00 e 23:59 do endDate → fase ativa; dia seguinte → null/próxima.

### R6-03 · BUG-003 (P2) — `calculateDebts` superaloca o maior credor
- **Causa**: `src/domain/splitting/splitting.ts:151-173` pareia devedores contra credores
  ordenados pelos saldos ORIGINAIS sem decrementar o crédito já alocado.
- **Fix**: alocar mutando saldos remanescentes (mesmo padrão de `suggestSimplifiedSettlements`,
  que está correto).
- **Teste**: A deve 50, B deve 30, C +40, D +30 → soma recebida por C = 4000, por D = 3000.

### R6-04 · BUG-004 (P3) — Edição de valor pós-rejeição ignora devolução ao pagador
- **Causa**: `ExpenseDetailPage.handleSaveEdit` rescala TODAS as shares (inclusive `rejected`)
  e usa `calculatePersonalCost`; DEC-071 manda devolver o valor rejeitado ao pagador
  (`calculateOwnerPersonalCost`).
- **Fix**: não rescalar shares rejeitadas; custo pessoal via `calculateOwnerPersonalCost`.
- **Teste**: total editado após rejeição → personalCost do dono inclui o valor rejeitado.

### R6-05 · PAR-006 — `calculateEffectiveSpendingDays` usa `cursor.toISOString()`
- **Fix**: formatar o cursor com data local (`rhythm.ts:48`). Teste de regressão simples.

**AC-G1**: todos os testes novos + suíte verde; commit `fix(gate-r6-1)`.

---

## Gate 2 — Sync P2P confiável (campo: P2P-09, P2P-12/13)

### R6-06 · Bug A — Remetente sempre termina em erro
- **Causa confirmada**: `SyncTransferFlow.runSender` envia hello mas NUNCA consome o hello do
  receptor (o receptor consome o do remetente em `runReceiver:153`). O hello órfão fica na fila
  da `SyncSession`; quando `sendPayload` faz `expect('ack')`, tira o hello → `protocol_error` →
  tela de erro mesmo com transferência OK. Idem para `waitForResponses` (SharedExpensesPage:718).
- **Fix**: simetria — `runSender` também consome o hello do peer (`expect('hello', 15s)` em
  try/catch tolerante, igual ao receptor) ANTES de `sendPayload`.

### R6-07 · Bug B — Primeira tentativa falha nos dois lados
- **Causa confirmada**: `wrapDataChannel` (webrtc-transport.ts) e `createRelayChannel`
  (connection.ts) inicializam `messageHandler = () => {}`; mensagens que chegam entre o
  open do canal e o `setMessageHandler` da `SyncSession` são descartadas em silêncio.
- **Fix**: buffer no canal — acumular mensagens enquanto não há handler e fazer flush no
  `setMessageHandler`. Implementar 1 helper compartilhado (ex.: em `channel.ts`) e usar nos
  dois transportes (webrtc/manual e relay).
- **Testes**: unit com canal em memória simulando a corrida (mensagem enviada antes do
  handler ser conectado é entregue após `setMessageHandler`); fluxo completo hello simétrico →
  payload → ack → responses sem `protocol_error`.

**AC-G2**: suíte verde; novos testes cobrem a corrida e a simetria; commit `fix(gate-r6-2)`.

---

## Gate 3 — Scanner de QR: escolher câmera + zoom (campo: P2P-06, desbloqueia modo offline)

### R6-08 · Troca de câmera
- **Causa**: `QrScanner.tsx` pede só `facingMode: 'environment'`; em iPhone multi-lente a
  escolhida pode não focar QR denso/perto.
- **Fix**: enumerar câmeras de vídeo (`enumerateDevices` após permissão), botão de alternância
  no overlay do scanner (ciclo entre câmeras), lembrar a última usada (localStorage).
  Recriar o stream com `deviceId: { exact }` ao trocar.

### R6-09 · Zoom (quando suportado)
- **Fix**: se a track suportar `zoom` (capabilities), mostrar controle simples (ex.: chips 1×/2×
  ou slider) aplicando `applyConstraints({ advanced: [{ zoom }] })`. Esconder quando não suportado.

### R6-10 · Permissão negada (P2P-07) — manter mensagem clara (já existe); garantir que os novos
controles não quebram o estado de erro.

**AC-G3**: typecheck + suíte verdes; i18n das novas strings nas 3 línguas; commit `fix(gate-r6-3)`.

---

## Gate 4 — Polimento de UI do field test

### R6-11 · Carrossel de perfis no Dashboard (R-02): 3 por página + cores por categoria
- **Causa**: `DashboardPage.tsx:776` usa `w-[30%]` → 3 cards + gaps ≈ 96% e o 4º "espia";
  ícones todos `var(--primary)` (terracota) — o grid fallback tinha cores por categoria.
- **Fix**: largura `calc((100% - 2*gap)/3)` para 3 exatos por página (snap alinhado);
  mapa categoria → cor/fundo (paleta mediterrânea: mercado verde, bar terracota, café âmbar etc.)
  aplicado nos ícones do carrossel (data-driven, sem condicional por card).

### R6-12 · Gauge da saída (R5-09): rótulos/ticks nas fronteiras reais
- **Causa**: barra segmentada 3:2:1:1 (fronteiras em 42,9% / 71,4% / 85,7%) mas os 3 rótulos
  usam `justify-between` (0/50/100%) — OutingPage.tsx:1704-1730.
- **Fix**: posicionar cada rótulo ancorado na fronteira real do seu segmento (42,9% target,
  71,4% ceiling, 85,7% max, com clamp nas bordas) + tick vertical na barra em cada fronteira,
  na cor do limite. Derivar as posições das mesmas proporções dos segmentos (constante única).

### R6-13 · Banner de persistência honesto no iOS (R5-03)
- **Causa**: `navigator.storage.persist()` no Safari/iOS não abre prompt e retorna false —
  o CTA "ativar" nunca funciona.
- **Fix**: detectar iOS Safari; se NÃO instalado como PWA → banner orienta "instale na tela
  inicial para proteger seus dados" (instruções share→add to home screen); se instalado →
  não alarmar (apenas lembrete de backup se vencido). Manter comportamento atual no Android/desktop.

### R6-14 · Teclado fecha mas viewport não volta (R5-04)
- **Causa**: iOS nem sempre re-ajusta o scroll ao fechar o teclado; `useKeyboardInset` só lê o inset.
- **Fix**: no hook, quando o inset volta a 0 após ter sido > 0, forçar `window.scrollTo(0, 0)`.

**AC-G4**: suíte + typecheck verdes; commit `fix(gate-r6-4)`.

---

## Gate 5 — i18n de formatação (PAR-001/002/004/005)

### R6-15 · PAR-001 — Datas no idioma ativo
- **Fix**: ponte de locale (i18n `languageChanged` → módulo de locale ativo); `formatDate`
  usa o locale date-fns do idioma + mapa de padrões por língua para os padrões pt
  ("d 'de' MMMM" → "MMMM d" em EN etc.), data-driven.

### R6-16 · PAR-002 — Números no idioma ativo
- **Fix**: `formatMoney` (money.ts) usa o locale ativo da mesma ponte como default (88 call
  sites inalterados); `splitMoneyDisplay` do Dashboard idem (separador decimal por locale).

### R6-17 · PAR-004 — Nomes gerados no onboarding localizados
- **Fix**: `createOnboardingEntities` recebe os nomes traduzidos como input (UI passa `t(...)`);
  remover "Fundo X"/"Reserva protegida" hardcoded de onboarding.ts.

### R6-18 · PAR-005 — WalletsPage: enum traduzido + tipos completos
- **Fix**: chaves `wallets.type_*` (3 línguas) para exibir tipo; criação oferece também
  `credit_card` e `other`.

**AC-G5**: paridade de chaves i18n nas 3 línguas (script/diff); suíte verde; commit `fix(gate-r6-5)`.

---

## Gate 6 — Simulador v3 (R-12) + learning prior (PAR-003a)

### R6-19 · Simulador mostra a conta
- Cada uma das 3 métricas exibe o "porquê" em 1 linha (ex.: "€30 = 7,5 dias do seu livre de €4/dia"),
  derivado dos números já calculados por `simulateSpendMultiMetric` (sem nova lógica de domínio,
  apenas exposição dos componentes do cálculo).

### R6-20 · Chips de valor rápido
- Chips €5/€10/€20 + campo livre (mesmo padrão visual dos quick-add da saída).

### R6-21 · CTA pós-veredito
- Após simular: "Registrar esse gasto" (navega ao quick-add com valor/categoria pré-preenchidos)
  e "Ver no planner". *(Simulação por categoria com plano estourado fica ADIADA — registrar
  no dev-log como candidata a R7, depende de decisão de produto.)*

### R6-22 · PAR-003a — Prior da estimativa inicial no learning
- **Fix**: tratar o preset como prior (ex.: `dataPointCount` virtual inicial = 3) em
  `updateProfileFromTransaction` (forecasting.ts) para o 1º dado real não descartar a estimativa.
- **Teste**: típico 1500, 1º dado 9000 → resultado intermediário (não 9000).

**AC-G6**: suíte verde; novas strings nas 3 línguas; commit `fix(gate-r6-6)`.

---

## Gate 7 — Housekeeping, validação final e deploy

### R6-23 · Brain housekeeping (auditoria seção 10)
- `implementation-phases.md`: status real das deliveries (D1-D5 entregues).
- Referências "102 decisões" → 113; `database-schema.md` nota v4/24 entidades.
- Notas D1 (Zustand removido DEC-068) e D5 (SW custom DEC-082).
- `project-status.md`: registrar R6 e nova versão.
- Atualizar `field-test-checklist-r3-r5.md` (itens corrigidos marcados como "corrigido na R6 — retestar").

### R6-24 · Versão e validação total
- Bump `package.json` + `src/utils/app-version.ts` → **0.6.0**.
- `npm run test` (todos) + `npm run typecheck` + `npm run build` + `npx playwright test` — tudo verde.

### R6-25 · Deploy Cloudflare
- App: `npm run build && npx wrangler pages deploy dist --project-name=trippilot` (Node 22).
- Worker (`worker/`): SEM mudanças nesta rodada — não redeployar.
- Registrar URL do deploy no dev-log e no project-status.

**AC-G7**: deploy publicado; dev-log completo; commit final `chore(gate-r6-7)`.

---

## Protocolo por milestone (self-check de 5 pontos)

1. ACs do item satisfeitos (listar IDs R6-NN no dev-log).
2. Nomear 3 ACs anteriores em risco de regressão e verificar.
3. Rodar testes — zero falhas NOVAS.
4. Sinalizar arquivos tocados fora do escopo do item (não deve haver).
5. Entrada no dev-log.

## Critério de parada

Só parar quando: 25 itens R6-01..R6-25 fechados, suíte completa verde, build ok,
E2E ok, deploy publicado e commits feitos. Nada de entrega parcial.
