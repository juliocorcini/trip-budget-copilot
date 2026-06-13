# FIX DE ESTABILIDADE — TripPilot — 20 BUGS

> **Modo**: Chat direto — sem agents, sem subagents, sem Task tool
> **Fonte da verdade**: `TripPilot/brain/documents/stability-audit-2026-06-13.md` — 20 bugs (4 P0, 4 P1, 7 P2, 5 P3) que tornaram o app INUTILIZÁVEL em uso real
> **Objetivo**: 20/20 bugs corrigidos · testes verdes + novos testes para cada P0/P1 · build limpo · deploy no Cloudflare Pages
> **Baseline**: 460/460 testes verdes · typecheck ✅ · build ✅ (aviso de chunk) — NUNCA regredir

---

## IDENTIDADE

Você é um engenheiro de confiabilidade (SRE) senior corrigindo um app que **falhou em produção**. O usuário tentou usar durante uma viagem real e não conseguiu — travava, reiniciava, perdia dados e voltava pro onboarding zerado. Os 20 bugs estão catalogados no audit com arquivo:linha, causa-raiz e como reproduzir. Sua missão: corrigir TODOS, testar, e colocar no ar.

**Regras absolutas:**
- NÃO delegue para agents/subagents/Task tool
- NÃO peça confirmação entre gates — as soluções estão especificadas abaixo
- NÃO resuma — implemente
- NÃO pare porque "conversa longa" — use o recovery protocol
- PRESERVE a baseline de 460 testes — regressão bloqueia o gate
- Cada bug tem "DONE quando" — critério de aceite inegociável
- INVESTIGUE antes de mudar: leia o código atual do arquivo:linha do audit antes de cada fix
- SEMPRE rode `npm run test` + typecheck após cada gate — nunca confie em "acho que está certo"

---

## ⚓ ÂNCORA — REGRAS INVIOLÁVEIS

Releia no início de CADA gate e reproduza no checkpoint:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
1. NUNCA cair no onboarding com dados no disco. Se há viagens no DB,
   MOSTRE a viagem (ou tela de recuperação). WelcomePage é SÓ para
   DB genuinamente vazio
2. appSettings.get() é READ-ONLY quando trips existem — NUNCA persiste
   activeTrip:null se há viagens no disco
3. Toda tela: if (error) → DataErrorScreen; NUNCA navigate('/welcome')
   quando o problema é erro de leitura, não ausência de dados
4. localStorage SEMPRE em try/catch — fallback para memória
5. SW NUNCA abre IndexedDB sem versão; NUNCA bloqueia upgrade do Dexie
6. Money = integer cents | navigate() NUNCA no corpo do render
7. npm run test + typecheck + build verdes em TODO checkpoint
8. Node 22: export PATH="$HOME/.nvm/versions/node/v22.22.3/bin:$PATH"
9. UI text = t() em pt-BR + en + es no mesmo commit
10. Zero cores hardcoded — tokens. Zero diálogos nativos
11. Git: bash -c 'git commit ...' (sem --trailer)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

---

## STATE FILE (crie ANTES de qualquer código)

`TripPilot/src/stability-fix-log.md` — formato:

```
# Stability Fix Log
## Current State
- Gate: 0 | Bug: — | Fixed: 0/20 | Tests: 460 | Build: ✅
## Gate 0
- [ ] Baseline confirmada
## Gate 1 — Boot/Onboarding (P0)
- [ ] BUG-001 ...
(etc. para todos os 20)
```

---

## MAPA DE GATES

```
GATE 0  Baseline + state file
GATE 1  Boot/Onboarding — "nunca cair no onboarding com dados"
        BUG-001 BUG-003 BUG-004 BUG-009 BUG-014
GATE 2  Safety net — localStorage + formatMoney + ErrorBoundary
        BUG-005 BUG-010 BUG-016 BUG-017 BUG-018
GATE 3  Service Worker hardening
        BUG-006 BUG-011
GATE 4  Persistência iOS + integridade de dados
        BUG-002 BUG-013 BUG-015
GATE 5  Performance — contexto compartilhado + code splitting
        BUG-007 BUG-008 BUG-012 BUG-019 BUG-020
GATE 6  Testes finais + brain + deploy
```

---

## GATE 0 — BASELINE

```
1. export PATH="$HOME/.nvm/versions/node/v22.22.3/bin:$PATH"
2. Leia stability-audit-2026-06-13.md (a fonte da verdade dos bugs)
3. npm run test → confirme 460/460
4. npx tsc --noEmit → 0 erros
5. npm run build → confirme build ok (anote o aviso de chunk)
6. Crie o state file stability-fix-log.md
7. Commit: chore: add stability fix state file
```

---

## GATE 1 — BOOT / ONBOARDING — "NUNCA CAIR NO ONBOARDING COM DADOS" (5 bugs P0)

Este é o gate mais importante: resolve o sintoma principal do usuário ("reinicia e volta pro onboarding zerado").

### BUG-001 — `start_url:"/"` + WelcomePage sem redirect
**Arquivos**: `public/manifest.json:5`, `src/app/router.tsx:75-76`, `src/features/onboarding/WelcomePage.tsx`
**O que fazer**:
1. Na `WelcomePage`: adicionar hook que lê `appSettings.activeTrip` (via `useAppData` ou acesso direto ao DB). Se `activeTrip` existe e a trip existe no DB → `<Navigate to="/dashboard" replace />`
2. TAMBÉM: adicionar um **boot guard** na rota `/` do router que faça o redirect antes mesmo de renderizar a WelcomePage (loader ou componente wrapper) — se há viagem ativa, vai pro dashboard; se não, vai pro welcome
3. **Bônus de segurança**: se `activeTrip` é null MAS existem trips no DB → mostrar uma **tela de recuperação** ("Encontramos uma viagem existente — deseja continuar?") em vez de ir pro Welcome. Isso cobre o cenário órfão (BUG-003 em cascata)
4. `manifest.json`: manter `start_url:"/"` (o guard resolve)
**Teste**: mock do DB com trip existente + `activeTrip` setado → renderizar `/` → deve redirecionar para `/dashboard`; mock com trip existente + `activeTrip:null` → deve mostrar tela de recuperação, não Welcome
**DONE quando**: cold start com dados no DB NUNCA mostra a WelcomePage

### BUG-003 — `appSettingsRepository.get()` persiste `activeTrip:null` destrutivamente
**Arquivos**: `src/data/repositories/app-settings-repository.ts:6-13`, `src/data/db/seed.ts`
**O que fazer**:
1. `get()`: quando a linha `appSettings` não existe, checar se há trips no DB (`db.trips.count()`). Se sim → **NÃO persistir** um default com `activeTrip:null`; em vez disso, buscar a primeira trip e setá-la como ativa (ou retornar um transient default sem persistir e deixar a tela de recuperação do BUG-001 resolver)
2. `update()`: adicionar guarda — se o payload contém `activeTrip:null` e existem trips no DB, **recusar** a escrita e logar warning (protege contra sobrescrita acidental)
3. Alternativa mínima aceitável: `get()` retorna default sem persistir quando falta a linha; a persistência só acontece num `ensureSettings()` explícito chamado após o onboarding/import
**Teste**: deletar a linha appSettings com trips existentes → `get()` não grava `activeTrip:null`; chamar `update({activeTrip:null})` com trips existentes → recusado
**DONE quando**: é IMPOSSÍVEL `activeTrip:null` ser gravado quando existem trips no disco

### BUG-004 — Telas que vão pro `/welcome` em `!trip` sem checar `error`
**Arquivos**: `TripOverviewPage.tsx:24-25`, `TripEditPage.tsx:399-400`, `WalletsPage.tsx:113-114`
**O que fazer**:
1. Nessas 3 telas: desestruturar `error` de `useAppData()`. Se `error` → `<DataErrorScreen />`. Só ir pro Welcome se `!trip && !error && !loading`
2. Usar `<Navigate to="/welcome" replace />` em vez de `navigate()` imperativo (resolve BUG-009 nessas telas ao mesmo tempo)
**Teste**: forçar `useAppData` a retornar `{trip:null, error:true}` → deve renderizar DataErrorScreen, não redirecionar
**DONE quando**: nenhuma tela manda pro Welcome quando o problema é erro de leitura

### BUG-009 — `navigate()` chamado durante o render
**Arquivos**: `DashboardPage.tsx:403`, `TripOverviewPage.tsx:25`, `TripEditPage.tsx:400`, `WalletsPage.tsx:114`
**O que fazer**:
1. Substituir `navigate('/welcome')` no corpo do render por `<Navigate to="/welcome" replace />` (componente declarativo do react-router)
2. Para a DashboardPage: verificar se já usa o pattern correto; se não, aplicar o mesmo fix
**Teste**: React StrictMode sem warning "Cannot update a component while rendering"
**DONE quando**: zero chamadas `navigate()` no corpo de render em toda a codebase

### BUG-014 — Tela branca (`return null`) em várias rotas sem `DataErrorScreen`
**Arquivos**: `RescuePage.tsx:100`, `SimulatorPage.tsx:177`, `SharedExpensesPage.tsx:194`, `OutingPage.tsx:463`
**O que fazer**:
1. Nessas 4 telas: desestruturar `error` e `loading` de `useAppData()`. Pattern correto:
   - `if (loading) return <LoadingScreen />`
   - `if (error) return <DataErrorScreen />`
   - `if (!trip) return <Navigate to="/welcome" replace />`
2. A `OutingPage` é especialmente crítica (saída ativa) — garantir que um erro transitório de DB não destrua a sessão em andamento
**Teste**: forçar `error:true` em cada tela → renderiza DataErrorScreen
**DONE quando**: NENHUMA tela retorna `null` em cenário de erro — sempre DataErrorScreen com retry

**Checkpoint Gate 1** + commit `fix(stability): boot guard, settings safety, error screens — BUG-001/003/004/009/014`

---

## GATE 2 — SAFETY NET: localStorage + formatMoney + ErrorBoundary (5 bugs)

### BUG-005 — `localStorage` sem try/catch em TODA escrita
**Arquivo**: `src/utils/entity-factory.ts:6-14` (`getDeviceId`)
**O que fazer**:
1. Criar helper `safeLocalStorage` com `get(key)` e `set(key,value)` que envolve tudo em try/catch e cai para fallback em memória (variável de módulo) se lançar
2. `getDeviceId`: usar `safeLocalStorage.get/set`. Se ambos falharem, gerar ID em memória (volatile — funciona para a sessão)
3. Como `getDeviceId` é usado em `createSyncMetadata`, `markUpdated` e `softDelete` (ou seja, em TODO create/update/delete), esse fix protege TODA escrita
**Teste**: mock de `localStorage.getItem` lançando → `getDeviceId` retorna ID sem crashar
**DONE quando**: nenhum `localStorage.getItem/setItem` direto fora do helper (grep confirma)

### BUG-018 — localStorage sem try/catch em mais 2 pontos
**Arquivos**: `src/utils/outing-notification.ts:58,62`, `src/components/QrScanner.tsx:30,38`
**O que fazer**: migrar para o `safeLocalStorage` criado no BUG-005
**DONE quando**: grep por `localStorage\.(get|set)Item` fora do helper retorna 0 resultados

### BUG-010 — `formatMoney` lança RangeError com currency inválida
**Arquivo**: `src/domain/money/money.ts:15-26`
**O que fazer**:
1. Envolver `new Intl.NumberFormat(locale, { currency })` em try/catch
2. Se `RangeError` → fallback: formatar como número simples + currency code como texto (`"12.50 XYZ"`)
3. Validar que `currency` é string de 3 letras uppercase antes do `Intl` call
**Teste**: `formatMoney(1250, 'INVALID')` → não lança, retorna string legível
**DONE quando**: `formatMoney` NUNCA lança, independente do input

### BUG-016 — `new Date(customDate).toISOString()` pode lançar
**Arquivo**: `src/features/expenses/QuickAddPage.tsx:244`
**O que fazer**: validar a data antes; se inválida, usar `new Date().toISOString()` (fallback seguro)
**DONE quando**: data inválida não lança RangeError

### BUG-017 — ErrorBoundary sem telemetria + loop de reload
**Arquivo**: `src/components/ErrorBoundary.tsx`
**O que fazer**:
1. Em `componentDidCatch`: além do `console.error`, gravar o erro num buffer de `localStorage` (via `safeLocalStorage`): `{timestamp, message, stack, componentStack}` (últimos 10 erros, rotaciona)
2. No render do fallback: antes de `reload()`, checar o buffer — se houve mais de 3 crashes nos últimos 60s, mostrar mensagem "O app está com problemas persistentes" + botão "Limpar cache e recarregar" (que limpa SW cache + reload) + botão "Exportar dados" (para backup de emergência)
3. Adicionar `window.addEventListener('error', ...)` e `window.addEventListener('unhandledrejection', ...)` no `main.tsx` — logam no mesmo buffer
**Teste**: simular 4 crashes rápidos → ErrorBoundary mostra tela de "problemas persistentes" em vez de loop
**DONE quando**: loop de crash é detectado e interrompido com opções de recuperação

**Checkpoint Gate 2** + commit `fix(stability): safe localStorage, formatMoney guard, error boundary anti-loop — BUG-005/010/016/017/018`

---

## GATE 3 — SERVICE WORKER HARDENING (2 bugs)

### BUG-006 — SW abre IndexedDB sem versão, sem guards
**Arquivo**: `public/sw.js:110-116` (`openDb()`), `:247-325` (`swDirectQuickAdd`), `:327-339` (`swDirectSetSubcategory`)
**O que fazer**:
1. `openDb()`: abrir com a versão correta do schema (importar/duplicar a constante de versão — no SW vanilla JS, a forma mais simples é hardcodar a versão e manter sincronizada via comentário + lint manual, ou usar um build step que injete)
2. Adicionar `onblocked` handler que fecha a conexão e não tenta operar
3. Adicionar `onupgradeneeded` handler: se o DB não tem as stores esperadas, **NÃO criar** — fechar e abortar a operação (o Dexie do app é quem cria as stores)
4. Verificar existência da store antes de `tx.objectStore('sessions')` — se não existe, abortar sem crash
5. Envolver TODO o handler de `notificationclick` em try/catch para que rejeições não subam ao `event.waitUntil` sem tratamento
**Teste**: simular `notificationclick` quando o DB não tem stores → não lança, não cria DB vazio
**DONE quando**: o SW NUNCA cria um DB vazio antes do Dexie e NUNCA bloqueia um upgrade

### BUG-011 — Atualização do SW pode recarregar no meio do uso
**Arquivo**: `src/utils/pwa.ts:22-28` (`controllerchange`)
**O que fazer**:
1. O `controllerchange` → `reload()` deve checar se há uma saída ativa (`sessionStorage` flag ou query rápida ao DB). Se houver, **adiar** o reload e mostrar um toast "Atualização disponível — será aplicada ao encerrar a saída" (via `sessionStorage` flag que o encerramento da saída verifica)
2. Garantir que o reload é suave: não perder state de formulário não salvo (se houver — checar)
**Teste**: simular `controllerchange` com saída ativa → não recarrega; sem saída ativa → recarrega normalmente
**DONE quando**: nenhum reload automático durante saída ativa

**Checkpoint Gate 3** + commit `fix(stability): SW IndexedDB safety, deferred reload during outing — BUG-006/011`

---

## GATE 4 — PERSISTÊNCIA iOS + INTEGRIDADE DE DADOS (3 bugs)

### BUG-002 — iOS nunca torna o storage persistente
**Arquivo**: `src/utils/pwa.ts:55-62`, `src/main.tsx:30`
**O que fazer**:
1. Em `requestPersistentStorage`: após o `persist()`, checar `navigator.storage.persisted()`. Se `false` (iOS), setar flag `storagePersistenceFailed: true` nos settings
2. Reforçar o banner existente (`storageNotPersisted` na Dashboard) com um **CTA mais forte**: "Seus dados podem ser perdidos pelo sistema. Faça backup agora." + botão direto para backup
3. No boot (se `persisted()` é false): checar `navigator.storage.estimate()` e logar quota/usage (para diagnóstico futuro)
4. Documentar no brain: limitação do iOS; backup é a única proteção real; Capacitor (DEC-017) resolve de vez
5. Adicionar auto-backup periódico: a cada N gastos (ou a cada sessão encerrada), salvar um snapshot JSON no `localStorage` (comprimido se possível) como recovery de emergência — se no próximo boot o DB estiver vazio mas o snapshot existir, oferecer restauração
**Teste**: mock de `persisted()` retornando false → banner CTA aparece; snapshot de auto-backup é criado após gasto
**DONE quando**: o usuário iOS é ALERTADO claramente E tem auto-backup de emergência

### BUG-013 — Onboarding não-transacional
**Arquivo**: `src/features/onboarding/OnboardingPage.tsx:66-79`
**O que fazer**:
1. Envolver os 8 `add` sequenciais numa `db.transaction('rw', [db.trips, db.pools, ...(todas as stores usadas)], async () => { ... })` — se um falhar, nenhum é gravado
2. Mover o `appSettingsRepository.update({ activeTrip })` para DEPOIS da transação confirmar (não dentro — appSettings pode estar em store diferente)
3. Se a transação falhar: mostrar erro + retry, não estado parcial
**Teste**: mock de falha no 5º add → nenhum dos 8 é persistido; retry cria tudo
**DONE quando**: onboarding é atômico — tudo ou nada

### BUG-015 — `repairDemoTripIfNeeded` recria perfis para qualquer viagem
**Arquivo**: `src/data/demo-repair.ts:129-131`
**O que fazer**:
1. O bloco de recriação de perfis (`:129-131`) deve estar **dentro** do guard `settings.isDemo` que começa na linha `:99` — mover para dentro do bloco condicional
2. Ou: adicionar guard explícito `if (settings.isDemo && profiles.length === 0)` no bloco de recriação
3. Confirmar que não afeta a demo trip (a demo continua reparando)
**Teste**: viagem real com 0 perfis ativos → `repairDemoTripIfNeeded` NÃO cria perfis; viagem demo com 0 perfis → cria
**DONE quando**: viagens reais nunca têm perfis "ressuscitados" pelo repair

**Checkpoint Gate 4** + commit `fix(stability): iOS persistence warning + auto-backup, atomic onboarding, demo repair scope — BUG-002/013/015`

---

## GATE 5 — PERFORMANCE: CONTEXTO COMPARTILHADO + CODE SPLITTING (5 bugs)

### BUG-007 — `useAppData` roda inteiro por consumidor, sem contexto compartilhado
**Arquivo**: `src/hooks/useAppData.ts` (hook inteiro)
**O que fazer**:
1. Criar um `AppDataProvider` (React Context + Provider) que roda `loadAll` UMA vez e expõe o resultado via context
2. `useAppData()` vira um `useContext(AppDataContext)` — os 25 call sites consumem a mesma instância
3. `reload()` / `notifyAppDataChanged()` atualiza o Provider, que propaga via context (uma única re-leitura do DB, uma única cascata de re-render)
4. Manter os listeners de `visibilitychange` e `APP_DATA_CHANGED` apenas no Provider (remover duplicatas)
5. Posicionar o Provider no `RootLayout` ou `AppShell` — ACIMA de todas as rotas
**Teste**: montar Dashboard → contar chamadas ao DB no mount → deve ser 1 batch (não 2+)
**DONE quando**: apenas 1 instância de leitura do DB, compartilhada por todo o app

### BUG-008 — DashboardPage ~1600 linhas com efeitos pesados
**Arquivo**: `src/features/dashboard/DashboardPage.tsx`
**O que fazer**:
1. Extrair seções em componentes filhos: `DashboardInsights`, `DashboardHeatmap`, `DashboardBurndown`, `DashboardSessions`, etc. — cada um com seus próprios `useMemo`/`useEffect` e deps estáveis
2. Memoizar cálculos pesados (`calculateFreeToSpend`, forecasts, insights) com `useMemo` sobre dependências estáveis (IDs/counts, não objetos inteiros)
3. Os efeitos async que releem o DB (sessões, perfis, shares, settlements) devem usar o contexto compartilhado do BUG-007, não releituras independentes
4. **NÃO** mover lógica para o Provider — os cálculos de dashboard ficam no dashboard, mas consomem os dados do Provider
**Teste**: registrar um gasto na Dashboard → Performance tab não mostra mais que 1 ciclo completo de re-render
**DONE quando**: DashboardPage < 500 linhas; sem re-render em cascata

### BUG-012 — Bundle de 635 KB
**Arquivo**: `vite.config.ts` (build config)
**O que fazer**:
1. Adicionar `manualChunks` no rollup config para separar: `vendor` (react, react-dom, react-router, dexie), `i18n` (i18next + locales), `features` (lazy-load por rota)
2. Usar `React.lazy` + `Suspense` para rotas não-críticas (Simulator, SharedExpenses, Backup, Settings, TripEdit, TripOverview)
3. Alvo: chunk principal < 300 KB; rotas secundárias carregam sob demanda
4. Verificar que o SW faz precache dos novos chunks hashados
**Teste**: `npm run build` → chunk principal < 300 KB; nenhum aviso de chunk > 500 KB
**DONE quando**: bundle principal < 300 KB e rotas secundárias são lazy

### BUG-019 — Auto-retry em `visibilitychange` causa churn
**Arquivo**: `src/hooks/useAppData.ts:168-176`
**O que fazer**:
1. Com o Provider do BUG-007, o retry de `visibilitychange` fica centralizado (1 instância)
2. Adicionar debounce/cooldown no retry: mínimo 30s entre retries, e máximo de 3 tentativas antes de parar e ficar no `DataErrorScreen`
3. O `db.close()` no retry deve ser removido ou feito com cuidado — fechar e reabrir o Dexie em foreground é arriscado; preferir um simples re-`loadAll`
**DONE quando**: foreground repetido com DB em erro não causa storm de close/open

### BUG-020 — Botão voltar do Android + deep-links
**Arquivo**: `src/app/router.tsx`
**O que fazer**:
1. Na rota raiz, tratar o "back" quando não há histórico: `window.history.length <= 1` → não navegar (fica na tela atual). Isso impede fechar o PWA no Android ao apertar back na Dashboard
2. Adicionar handler de `popstate` ou equivalente no RootLayout para tratar back on root
3. Para o Capacitor (futuro): registrar como item do DEC-017 — `App.addListener('backButton')` com `App.exitApp()` ou confirmação
**DONE quando**: back na Dashboard do PWA Android não fecha o app

**Checkpoint Gate 5** + commit `perf(stability): shared data context, code splitting, dashboard decomposition — BUG-007/008/012/019/020`

---

## GATE 6 — TESTES FINAIS + BRAIN + DEPLOY

```
1. TESTES
   a) npm run test → TODOS verdes (baseline 460 + novos testes desta rodada)
   b) npx tsc --noEmit → 0 erros
   c) npm run build → 0 avisos de chunk > 500 KB
   d) Contagem de novos testes escritos nesta rodada (mínimo esperado: ~15-20)

2. VERIFICAÇÃO MANUAL (smoke dos cenários do audit)
   a) Abrir "/" com trip no DB → vai pro dashboard (BUG-001)
   b) Deletar linha appSettings com trips existentes → recuperação (BUG-003)
   c) Forçar error em useAppData nas telas corrigidas → DataErrorScreen (BUG-004/014)
   d) Mock localStorage lançando → app funciona normalmente (BUG-005/018)
   e) formatMoney com currency inválida → não lança (BUG-010)
   f) 4 crashes rápidos → ErrorBoundary mostra tela de recovery (BUG-017)
   g) grep localStorage\.(get|set)Item fora do helper → 0 resultados
   h) grep 'navigate(' nas telas corrigidas → 0 no corpo do render (BUG-009)
   i) build: chunk principal < 300 KB (BUG-012)

3. BRAIN
   - decision-log.md → registrar decisões novas (boot guard, tela de
     recuperação, auto-backup iOS, AppDataProvider, etc.)
   - project-status.md → stability fix implementado
   - product-spec.md → se houver comportamento novo visível ao usuário
     (tela de recuperação, banner iOS reforçado, anti-loop do ErrorBoundary)

4. BUMP + DEPLOY
   - package.json: bump patch version
   - npm run build (última vez, confirmar tudo limpo)
   - npx wrangler pages deploy dist --project-name=trippilot
   - Anotar a URL do deploy

5. ENTREGA
   Tabela 20/20 com cada BUG-ID + status + arquivo modificado
   URL do deploy
   Contagem: testes novos, testes totais, chunks
   Lista de decisões registradas no brain
```

---

## PROTOCOLO DE CHECKPOINT (fim de CADA gate)

```
GATE [N] CONCLUÍDO
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Bugs: [BUG-XXX ✅ ...] | Arquivos: [lista]
Testes: X total (Y novos) | Build ✅ | Typecheck ✅
Regressão: [2-3 fluxos re-checados]
Fora de escopo tocado? [não / o quê e por quê]
State file ✅ | Commit: [hash]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[reproduza o bloco ÂNCORA]
PRÓXIMO: Gate [N+1]
```

**Mid-gate refresh**: a cada 3 bugs, releia a ÂNCORA + Current State.

---

## RECOVERY PROTOCOL

1. `TripPilot/src/stability-fix-log.md` → gate/bug ativo
2. Releia ÂNCORA + seção do gate ativo NESTE prompt
3. Releia o bug no `stability-audit-2026-06-13.md` para o contexto completo (arquivo:linha, como reproduzir)
4. `npm run test` para confirmar estado real
5. Continue do último checkbox aberto — NUNCA refaça gate concluído

---

## CRITÉRIO DE PARADA

```
DONE quando TUDO = TRUE:
- [ ] 20/20 bugs com "DONE quando" confirmado
- [ ] Cold start com dados no DB → dashboard (nunca onboarding)
- [ ] Nenhuma tela manda pro Welcome em cenário de erro
- [ ] Zero localStorage direto fora do helper
- [ ] Zero navigate() no corpo do render
- [ ] formatMoney nunca lança
- [ ] ErrorBoundary detecta loop de crash
- [ ] SW não cria DB vazio nem bloqueia upgrade
- [ ] Onboarding é transação atômica
- [ ] Demo repair não afeta viagens reais
- [ ] Bundle principal < 300 KB
- [ ] AppDataProvider: 1 instância de leitura
- [ ] iOS: banner reforçado + auto-backup de emergência
- [ ] Testes ≥ 460 + novos verdes | Build/Typecheck clean
- [ ] Brain atualizado | Deploy no ar com URL
```

---

## COMECE AGORA

1. GATE 0: confirme baseline
2. GATE 1: os 5 bugs que causam "volta pro onboarding" — é a RAIZ do problema do Julio
3. GATE 2: safety net para que crashes não travem
4. GATE 3: SW não pode mais sabotar o Dexie
5. GATE 4: iOS e integridade de dados
6. GATE 5: performance para o app não "travar" em uso real
7. GATE 6: testes finais + deploy

**O app está inutilizável. Gate 1 resolve o sintoma principal. GO.**