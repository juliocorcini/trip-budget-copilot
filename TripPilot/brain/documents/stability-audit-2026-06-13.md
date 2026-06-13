# Stability Audit — TripPilot — 2026-06-13

> **Tipo:** Auditoria de confiabilidade (somente leitura). Nenhum código foi alterado.
> **Gatilho:** App ficou inutilizável em viagem real — travava, reiniciava sozinho, "perdia toda a memória" e voltava para a tela de criar viagem (onboarding), zerado.
> **Stack confirmada:** React 19 + react-router 7 (`createBrowserRouter`) + Dexie 4 (IndexedDB) + Vite 6 + Service Worker custom (`public/sw.js`) + i18next + Capacitor 8 (configurado, mas **sem build nativo gerado** — produção é PWA). Versão `0.8.1`.
> **Baseline:** `typecheck` ✅ · `vitest` **460/460** ✅ (56 arquivos) · `build` ✅ (aviso: chunk `index` de **635 KB**). Node 22.22.3.

---

## 0. Sumário executivo

### Causas-raiz mais prováveis do "reinicia e perde tudo"

Há **duas causas distintas que se confundem** no relato, e a combinação delas é exatamente o que torna o app "inutilizável":

1. **Causa de PERCEPÇÃO de reset (quase certa, 100% reproduzível): `start_url: "/"` + a `WelcomePage` não redireciona para o dashboard quando já existe viagem ativa.** Todo *cold start* do PWA instalado (o iOS mata PWAs da memória de forma agressiva, ainda mais durante uso intenso com câmera/sync) reabre em `/` → tela "Criar viagem". Os dados continuam intactos no IndexedDB, mas a tela inicial é a de onboarding. Se o usuário, achando que perdeu tudo, toca em "Criar viagem" ou "Demo", aí sim **a perda vira real** (cria nova viagem ativa e órfã a antiga). → **BUG-001**

2. **Causa de PERDA REAL de dados no iOS (alta probabilidade para iPhone/Safari): o armazenamento nunca fica persistente no iOS, e o WebKit descarta o IndexedDB.** `navigator.storage.persist()` no iOS Safari retorna `false` e o navegador limpa storage não-persistente após ~7 dias sem uso ou sob pressão de armazenamento. Quando isso acontece, o banco é genuinamente esvaziado, o `populate` recria um `appSettings` zerado (`activeTrip: null`) e o app cai no onboarding com o disco realmente vazio. → **BUG-002**

Essas duas alimentam um terceiro agravante: **o `appSettingsRepository.get()` recria e persiste silenciosamente um settings padrão quando a linha some** (`activeTrip: null`), e o `update()` faz read-modify-write em cima disso — podendo **gravar `activeTrip: null` em definitivo** e orfanar viagens que sobreviveram no disco. → **BUG-003**

E os "travamentos": não há um loop infinito de render evidente, mas há **carga de I/O duplicada e pesada no boot/uso** (sem contexto compartilhado de dados — cada consumidor de `useAppData` relê tudo; a Dashboard sozinha dispara 2 cargas completas), um **bundle de 635 KB**, e **escritas no IndexedDB a cada gasto que disparam recomputo em cascata** em todas as telas montadas. Em iPhone, sob memória apertada e durante uma saída ativa (timer + notificação + câmera), isso degrada para "travando". → **BUG-007, BUG-008**

### Total de bugs

| Severidade | Qtde |
|---|---|
| **P0** — crash / reset / perda de dados | 4 |
| **P1** — trava/congela ou bloqueia fluxo | 4 |
| **P2** — erros sérios sem travar | 7 |
| **P3** — menores com risco | 5 |
| **Total** | **20** |

---

## 1. P0 — CRASH / RESET / PERDA DE DADOS (corrigir primeiro)

### [BUG-001] `start_url: "/"` + Welcome sem redirect = todo cold start cai no onboarding
- **Arquivos:** `public/manifest.json:5` (`"start_url": "/"`); `src/app/router.tsx:75-76` (`/` e `/welcome` → `WelcomePage`); `src/features/onboarding/WelcomePage.tsx` (componente inteiro — **não tem `useEffect`/`<Navigate>` que mande para `/dashboard` quando existe viagem ativa**).
- **Dispara quando:** o PWA instalado é reaberto a frio (iOS standalone após o sistema matar o app da memória; também aba nova/relaunch). O manifest manda abrir em `/`, e `/` renderiza a tela "Criar viagem / Importar / Receber / Demo".
- **Efeito:** **RESET aparente.** O usuário vê a tela de onboarding mesmo com todos os dados no disco. É o sintoma exato relatado ("volta para a tela de criar viagem, zerado").
- **Severidade:** P0 (é a explicação mais direta e 100% reproduzível do sintoma principal).
- **Causa-raiz (hipótese):** não existe "boot router"/guard que leia `appSettings.activeTrip` e decida onboarding-vs-dashboard. O único caminho que leva ao `/dashboard` é o `navigate('/dashboard')` ao final do onboarding/demo/import (`OnboardingPage.tsx:85`, `WelcomePage.tsx:39`); em SPA isso só sobrevive enquanto a aba/processo vive. No iOS standalone, o cold start usa `start_url`.
- **Como reproduzir:** instalar o PWA no iOS → criar viagem → fechar o app pela bandeja (ou esperar o iOS matá-lo) → reabrir pelo ícone → cai em "Criar viagem". (No desktop, simular abrindo `https://…/` diretamente: mostra Welcome mesmo com dados.)
- **Sinal/evidência:** `WelcomePage` não consome `activeTrip`; `manifest start_url:"/"`; nenhuma rota index com `loader`/redirect em `router.tsx`.
- **Agravante:** se o usuário tocar em "Criar viagem" (`navigate('/onboarding')`) ou "Demo" (`WelcomePage.tsx:32-36`), o `appSettingsRepository.update({ activeTrip: <novo> })` repontará a viagem ativa, **orfanando a viagem real** → perda passa a ser percebida como permanente.

### [BUG-002] iOS nunca torna o storage persistente → WebKit descarta o IndexedDB (perda real)
- **Arquivos:** `src/utils/pwa.ts:55-62` (`requestPersistentStorage`); `src/main.tsx:30` (chamada no boot); reforço em `OnboardingPage.tsx:82` e `QuickAddPage.tsx:276`.
- **Dispara quando:** uso em iOS Safari/standalone. `navigator.storage.persist()` no iOS **não abre prompt e retorna `false`**; o WebKit aplica o cap de ~7 dias de inatividade para storage não-persistente e pode descartar sob pressão de armazenamento.
- **Efeito:** **PERDA REAL DE DADOS** — IndexedDB esvaziado pelo sistema. No próximo boot, o Dexie recria o DB, o hook `on('populate')` (`database.ts:90-93`) semeia um `appSettings` novo com `activeTrip: null`, e o app cai no onboarding com o disco vazio de verdade.
- **Severidade:** P0.
- **Causa-raiz (hipótese):** limitação conhecida do WebKit; o app pede persistência mas não trata o caso "não conseguiu persistir no iOS" como um risco de dado (só há banner informativo). Sem PWA instalado na home, o storage do Safari é elegível à limpeza.
- **Como reproduzir:** difícil forçar a limpeza do WebKit manualmente; reproduzível conceitualmente verificando `navigator.storage.persisted()` → `false` no iOS (a Dashboard já lê isso em `DashboardPage.tsx:207-213` e mostra o banner `storageNotPersisted`).
- **Sinal/evidência:** `requestPersistentStorage` retorna `false` em iOS; banner "armazenamento não persistente" aparece (R5-03). Histórico do projeto já registra que `persist()` não funciona no iOS.

### [BUG-003] `appSettingsRepository.get()` recria/persiste settings padrão → pode zerar `activeTrip` em definitivo
- **Arquivos:** `src/data/repositories/app-settings-repository.ts:6-13` (`get()` cria + **persiste** `createDefaultAppSettings()` com `activeTrip: null` quando a linha não é encontrada); `:26-31` (`update()` = read-modify-write sobre o resultado de `get()`); `src/data/db/seed.ts:8-35` (`activeTrip: null` no default); `src/hooks/useAppData.ts:81-98` (`loadAll` faz early-return de estado vazio quando `!refreshedSettings.activeTrip`).
- **Dispara quando:** a linha `appSettings` (id `'app-settings'`) está ausente ou ilegível — pós-eviction (BUG-002), DB criado primeiro pelo SW sem stores (BUG-006), ou migração parcial.
- **Efeito:** **mascara perda e pode torná-la permanente.** `get()` devolve `activeTrip: null` → `loadAll` limpa tudo → telas redirecionam ao onboarding. Pior: qualquer `update()` subsequente (ex.: trocar tema, esconder card, ativar persistência) faz `put` de um objeto com `activeTrip: null`, **gravando o estado zerado** mesmo que viagens existam no disco.
- **Severidade:** P0 (transforma um problema transitório em perda definitiva de "qual é a viagem ativa").
- **Causa-raiz (hipótese):** o fallback de conveniência (criar default quando falta a linha — comentário "GAP-031") não distingue "DB novo" de "DB existente com linha perdida"; e `update()` confia cegamente no `get()`.
- **Como reproduzir:** com DevTools, apagar a linha `appSettings` da store (mantendo `trips`) → recarregar → app vai ao onboarding apesar das viagens; em seguida mudar o tema → `activeTrip:null` é persistido.
- **Sinal/evidência:** `get()` faz `db.appSettings.add(defaults)` no caminho de falta de linha.

### [BUG-004] Telas redirecionam a `/welcome` em `!trip` SEM checar `error` (viola DEC-109)
- **Arquivos:** `src/features/trip/TripOverviewPage.tsx:24-25`; `src/features/trip/TripEditPage.tsx:399-400`; `src/features/wallets/WalletsPage.tsx:113-114`. (Contraste com `DashboardPage.tsx:398-404` e `QuickAddPage.tsx:286`, que **checam `error` → `DataErrorScreen`**.)
- **Dispara quando:** uma leitura do IndexedDB falha ou estoura o timeout (`useAppData.ts:19` — `LOAD_TIMEOUT_MS = 10000`) enquanto o usuário está nessas telas. `useAppData` mantém `trip` em memória mas, no primeiro load ou após `retry`, `trip` pode ser `null` com `error = true`.
- **Efeito:** **caminho de perda de dados** — em vez do `DataErrorScreen` (que diz "seus dados não foram apagados" e oferece retry), a tela manda para o onboarding, que convida a re-importar/criar viagem (destrutivo).
- **Severidade:** P0/P1 (mesma classe da regressão que o DEC-109 existia para evitar, mas em 3 telas que não foram cobertas).
- **Causa-raiz (hipótese):** essas telas não desestruturam `error` de `useAppData` (só `loading` e `trip`); o fix do DEC-109 foi aplicado só na Dashboard e no QuickAdd.
- **Como reproduzir:** forçar `db.open()` a falhar (ex.: bloquear o IndexedDB com outra aba em upgrade) e navegar para `/wallets` → vai para `/welcome` em vez de `DataErrorScreen`.

---

## 2. P1 — Trava/congela ou bloqueia o fluxo principal

### [BUG-005] `localStorage` sem try/catch no caminho de TODA escrita → quebra writes no iOS privado/quota
- **Arquivos:** `src/utils/entity-factory.ts:6-14` (`getDeviceId`: só trata `typeof localStorage === 'undefined'`, **não captura exceção** de `getItem/setItem`); chamado por `createSyncMetadata` (`:25-35`), `markUpdated` (`:37-44`) e `softDelete` (`:46-54`) — ou seja, em **todo create/update/delete** de entidade.
- **Dispara quando:** iOS em modo privado, storage bloqueado, ou `QuotaExceededError` ao escrever a chave `trippilot_device_id` — `localStorage.getItem/setItem` **lança** `SecurityError`/`QuotaExceededError`.
- **Efeito:** **trava o fluxo** — qualquer salvamento (gasto, saída, edição) estoura exceção; em handlers `async` sem `catch` específico vira rejeição não tratada e, em caminhos de render, pode subir ao `ErrorBoundary` (tela de erro → "reload" → repete).
- **Severidade:** P1.
- **Causa-raiz (hipótese):** o guard só cobre ambiente sem `localStorage`, não o acesso que lança.
- **Como reproduzir:** Safari iOS em janela privada, ou simular `localStorage.getItem` lançando no DevTools, e tentar registrar um gasto.

### [BUG-006] Service Worker abre o IndexedDB sem versão e sem guarda de store; `blocked`/`versionchange` não tratados
- **Arquivos:** `public/sw.js:110-116` (`openDb()` = `indexedDB.open('TripPilotDB')` **sem versão**), usado por `swDirectQuickAdd` (`:247-325`) e `swDirectSetSubcategory` (`:327-339`) no `notificationclick`.
- **Dispara quando:** (a) ação na notificação de saída enquanto o app está fazendo upgrade de schema; (b) SW abre o DB antes do Dexie algum dia ter criado as stores.
- **Efeito:**
  - **Deadlock de upgrade:** a conexão aberta pelo SW **bloqueia** um futuro upgrade do Dexie → `db.open()` do app fica pendente → `withTimeout` estoura em 10s → `DataErrorScreen`/congelamento.
  - **NotFoundError:** `tx.objectStore('sessions')` em DB sem stores rejeita → rejeição não tratada dentro do `event.waitUntil` (`sw.js:377`).
  - **`populate` pulado:** se o SW criar o DB vazio na versão 1 antes do Dexie, o Dexie trata como "DB existente" e **não roda `on('populate')`** → `appSettings`/`devices` nunca semeados → alimenta BUG-003.
- **Severidade:** P1.
- **Causa-raiz (hipótese):** acesso de baixo nível no SW não espelha o controle de versão/abertura do Dexie e não há `onblocked`/`onupgradeneeded` defensivo.
- **Como reproduzir:** manter uma notificação de saída ativa, forçar um bump de schema em outra aba e tocar num quick-add da notificação.

### [BUG-007] Sem contexto compartilhado de dados — `useAppData` roda inteiro por consumidor (2× na Dashboard)
- **Arquivos:** `src/hooks/useAppData.ts` (hook inteiro, com estado + `reload` + listeners próprios por instância); **25 call sites** de `useAppData()`; na rota Dashboard coexistem `DashboardPage.tsx:176` e `useNotifications.ts:18`.
- **Dispara quando:** sempre. Cada componente que chama `useAppData` executa o `loadAll` completo (7 queries em paralelo + links/envelopes por pool) e registra seus próprios listeners de `visibilitychange` e `APP_DATA_CHANGED`.
- **Efeito:** **I/O duplicado e re-render pesado.** Na Dashboard são 2 cargas completas no mount; a cada `notifyAppDataChanged()` ou foreground, todas as instâncias montadas releem tudo. Em iPhone com muitas transações, isso gera a sensação de "travando".
- **Severidade:** P1 (performance/escalabilidade do estado).
- **Causa-raiz (hipótese):** ausência de um Provider/Context único de app-data (decisão de remover Zustand — DEC-068 — não foi substituída por um contexto).
- **Como reproduzir:** abrir a Dashboard com DevTools→Network/Performance; observar a duplicação das leituras IndexedDB no load e a cada gasto.

### [BUG-008] Tela de boot pesada — `DashboardPage` ~1600 linhas com vários efeitos async disparando a cada mudança de `transactions`
- **Arquivos:** `src/features/dashboard/DashboardPage.tsx` (efeitos em `:207-235`, `:239-259`, `:307-340`, `:344-387`; cada um faz leituras adicionais ao IndexedDB e cálculos de orçamento). `reload()` é chamado após cada gasto (`QuickAddPage.tsx:278`).
- **Dispara quando:** cada registro de gasto → `reload()` → muda `transactions` → re-executa todos os efeitos da Dashboard (sessões, perfis, shares, settlements, forecasts, snapshot) + recomputa `calculateFreeToSpend`/insights/heatmap/burndown sobre todas as transações.
- **Efeito:** **jank/congelamento** após cada ação em viagens com muitos lançamentos; trabalho síncrono de cálculo na main thread durante o render.
- **Severidade:** P1 (degradação progressiva conforme a viagem cresce).
- **Causa-raiz (hipótese):** landing screen acumulou responsabilidades; cálculos não memoizados por dependência estável; combinado com BUG-007.

---

## 3. P2 — Erros sérios sem travar

### [BUG-009] `navigate()` chamado durante o render (anti-padrão React)
- **Arquivos:** `DashboardPage.tsx:403`, `TripOverviewPage.tsx:25`, `TripEditPage.tsx:400`, `WalletsPage.tsx:114` (todas chamam `navigate('/welcome')` no corpo do componente, não em `useEffect`).
- **Efeito:** warning "Cannot update a component (Router) while rendering a different component"; sob React 19 + `StrictMode` pode gerar navegação dupla/estado inconsistente. Deveria ser `<Navigate to="/welcome" replace />` ou efeito.
- **Severidade:** P2.

### [BUG-010] `formatMoney`/`Intl.NumberFormat` lança `RangeError` com currency inválida
- **Arquivos:** `src/domain/money/money.ts:15-26` e `:20` (`new Intl.NumberFormat(locale, { currency })`); `currency` vem de `trip.baseCurrency`, que pode chegar de import/sync sem validação ISO-4217.
- **Dispara quando:** uma viagem importada/sincronizada tem `baseCurrency` inválida (string arbitrária).
- **Efeito:** **crash de render** em qualquer tela que formata dinheiro → `ErrorBoundary`. (O `splitMoneyDisplay` da Dashboard, `DashboardPage.tsx:72-87`, tem fallback de símbolo, mas `formatMoney` não.)
- **Severidade:** P2.

### [BUG-011] Atualização do SW pode recarregar no meio do uso; cache pode servir bundle incompatível
- **Arquivos:** `src/utils/pwa.ts:22-28` (`controllerchange` → `window.location.reload()`); `public/sw.js:58-91` (`networkFirst` para navegação/`index.html`, `cacheFirst` para assets hashados); `sw.js:41-50` (`activate` deleta caches antigos + `clients.claim()`).
- **Dispara quando:** o usuário toca no toast de update (ou um segundo cliente dispara `SKIP_WAITING`); ou o `index.html` novo é servido (network-first) referenciando um chunk hashado que ainda não está em cache e a rede cai.
- **Efeito:** **"reiniciou sozinho"** — reload perde estado de formulário não salvo; pior caso de cache misto → import dinâmico falha → tela branca → reload. (Mitigado por DEC-082: skipWaiting só por ação do usuário; mas o reload em si interrompe o uso.)
- **Severidade:** P2.

### [BUG-012] Bundle principal de 635 KB (gzip 206 KB) — boot lento / mais memória no celular
- **Arquivos/evidência:** saída do `build`: `dist/assets/index-*.js` **635 KB**; `SyncTransferFlow-*.js` 188 KB; aviso do Vite "chunks larger than 500 kB". `vite`/rollup sem `manualChunks`.
- **Efeito:** primeira pintura lenta em rede/CPU fracas; mais pressão de memória no Safari iOS (contribui para o SO matar o app → BUG-001/002).
- **Severidade:** P2.

### [BUG-013] Onboarding não-transacional — 8 `add` sequenciais → viagem parcial se interromper
- **Arquivos:** `src/features/onboarding/OnboardingPage.tsx:66-79` (`db.trips.add` … `db.activityProfiles.bulkAdd`, **fora** de uma `db.transaction`), seguido de `appSettingsRepository.update({ activeTrip })`.
- **Dispara quando:** o app fecha/crasha entre os `add` (ex.: usuário troca de app no meio).
- **Efeito:** viagem sem pool/wallet/perfis vira a ativa → cálculos da Dashboard degradam; estado inconsistente. (Compare com `importBackup`, que é atômico — `backup-orchestrators.ts:45`.)
- **Severidade:** P2.

### [BUG-014] Tela branca em vez de recuperação em várias rotas no erro de dados
- **Arquivos:** `RescuePage.tsx:100`, `SimulatorPage.tsx:177`, `SharedExpensesPage.tsx:194`, `OutingPage.tsx:463` (todas `if (!trip) return null`, sem checar `error`).
- **Efeito:** erro/timeout de DB nessas rotas → página em branco (sem `DataErrorScreen`, sem retry). Em uma saída ativa (`OutingPage`), isso é especialmente ruim.
- **Severidade:** P2.

### [BUG-015] `repairDemoTripIfNeeded` recria perfis padrão a cada boot para QUALQUER viagem sem perfis ativos
- **Arquivos:** `src/data/demo-repair.ts:129-131` (`if (profiles.length === 0) await activityProfileRepository.bulkCreate(createDefaultProfiles(...))` — **fora** do guard `settings.isDemo` das linhas `:99-127`); roda em todo `loadAll` (`useAppData.ts:83`).
- **Dispara quando:** uma viagem real fica com 0 perfis ativos (usuário apagou/soft-deletou os perfis, ou viagem importada/sincronizada sem perfis). `getByTripId` filtra `deletedAt === null`, então perfis soft-deletados contam como 0.
- **Efeito:** **escrita no DB em todo boot** + perfis "ressuscitam" após o usuário apagá-los; se soft-deletados, **duplicatas se acumulam** a cada abertura.
- **Severidade:** P2.

---

## 4. P3 — Menores / cosméticos com risco

### [BUG-016] `new Date(customDate).toISOString()` pode lançar em data inválida
- **Arquivo:** `src/features/expenses/QuickAddPage.tsx:244`. Risco baixo (input `datetime-local` restringe o formato), mas sem validação explícita → `RangeError: Invalid time value` se o valor vier corrompido. Severidade P3.

### [BUG-017] `ErrorBoundary` sem telemetria e só com "reload" — risco de loop de crash
- **Arquivo:** `src/components/ErrorBoundary.tsx:21-23` (`componentDidCatch` só faz `console.error`); botão chama `window.location.reload()` (`:46`). Se a causa do crash for determinística (ex.: BUG-010), reload → mesmo crash → loop percebido como "reiniciando sozinho". Sem `window.onerror`/`onunhandledrejection`. Severidade P3 (mas alta como instrumentação — ver Seção 7).

### [BUG-018] `localStorage` sem try/catch em mais dois pontos
- **Arquivos:** `src/utils/outing-notification.ts:58,62` (flag de prompt); `src/components/QrScanner.tsx:30,38` (câmera preferida). Mesma classe do BUG-005, frequência menor. Severidade P3.

### [BUG-019] Auto-retry em `visibilitychange` pode causar churn quando o DB segue quebrado
- **Arquivo:** `src/hooks/useAppData.ts:168-176` — a cada foreground com `errorRef.current` true, chama `retry()` (que faz `db.close()` + `reload()`). Com várias instâncias (BUG-007), vira `close()/open()` repetido a cada troca de foco. Severidade P3.

### [BUG-020] Botão "voltar" do Android e deep-links sem tratamento explícito no PWA
- **Arquivos:** `createBrowserRouter` em `router.tsx`; uso difuso de `navigate(-1)`. Sem manejo do back de hardware (no shell Capacitor o back pode fechar o app na rota raiz). Severidade P3 (relevante quando o build Capacitor for gerado — hoje só PWA).

---

## 5. Hipótese consolidada do incidente do Julio

Sequência mais provável (do uso real em viagem no iPhone), ligando aos BUG-IDs:

1. **Uso intenso durante uma saída** (timer de elapsed a cada 10s — `OutingPage.tsx:247`, notificação persistente, câmera no sync). Memória sob pressão + bundle de 635 KB (**BUG-012**) + I/O duplicado e recomputo a cada gasto (**BUG-007/BUG-008**) → momentos de **"travando"**.
2. **iOS mata o PWA da memória** (comportamento padrão sob pressão) ou o usuário troca de app. Ao **reabrir pelo ícone**, o `start_url:"/"` reabre na **WelcomePage**, que não tem redirect para o dashboard → **tela "Criar viagem"** (**BUG-001**). Isso já é, sozinho, o "reiniciou e voltou pro onboarding".
3. Em paralelo (ou em dias subsequentes), como o **storage nunca ficou persistente no iOS** (**BUG-002**), o WebKit **descarta o IndexedDB**. Agora a perda é **real**: `populate` recria `appSettings` com `activeTrip:null` → onboarding com disco vazio.
4. **Agravante:** vendo a tela de criar viagem, o usuário toca em "Criar viagem"/"Demo" — `appSettingsRepository.update({activeTrip:<novo>})` repontou a viagem ativa (**BUG-003**), orfanando o que porventura sobrou. A perda passa a ser **percebida como definitiva**.
5. Se em algum momento uma leitura falhou/estourou os 10s numa tela como `Wallets`/`TripEdit` (**BUG-004**), o app mandou para `/welcome` em vez do `DataErrorScreen` — mais um caminho para o onboarding com dados no disco.

**Toda forma conhecida de chegar ao onboarding com dados ainda no disco:**
- (A) `start_url:"/"` + Welcome sem redirect no cold start → **BUG-001**.
- (B) `appSettings` ausente → `get()` devolve `activeTrip:null` (e pode persistir) → **BUG-003** (causas da ausência: eviction **BUG-002**, DB criado vazio pelo SW **BUG-006**, ou `populate` pulado).
- (C) `activeTrip` aponta para trip que `getById` retorna `undefined` (soft-deletada/ausente, ex.: backup parcial com `appSettings.activeTrip` fora de `trips`) → `trip=null` → telas com `!trip` vão ao welcome.
- (D) Falha/timeout de leitura nas telas sem guarda de `error` → **BUG-004**.
- (E) Perda real do DB (eviction iOS) → DB recriado vazio → **BUG-002**.

---

## 6. Cobertura (prova de exaustão)

| # | Categoria | Auditada? | Bugs | Arquivos vistos |
|---|---|---|---|---|
| 1 | Boot / providers / ordem de init | ✅ | 3 (BUG-001, 007, 012) | `main.tsx`, `router.tsx`, `RootLayout.tsx`, `AppShell.tsx`, `useLiveSettings.ts` |
| 2 | Onboarding ↔ app (decisão de tela) | ✅ | 4 (BUG-001, 003, 004, 014) | `WelcomePage.tsx`, `OnboardingPage.tsx`, `DashboardPage.tsx`, `app-settings-repository.ts`, `useAppData.ts` |
| 3 | Dexie schema/migração/abertura/erros | ✅ | 1 (BUG-006) + risco de downgrade (latente) | `database.ts`, `schema.ts`, `base-repository.ts`, `sw.js` |
| 4 | CRUD viagem/fase/fundo/carteira | ✅ | 1 (BUG-013); CRUD de pool/fase é atômico (OK); **não há `deleteTrip`** (não repointa `activeTrip`) | `crud-orchestrators.ts`, `OnboardingPage.tsx` |
| 5 | Registrar gasto (quick-add/form/saída) | ✅ | 2 (BUG-010, 016); double-submit guardado por `saving` (OK) | `QuickAddPage.tsx`, `splitting.ts`, `money.ts` |
| 6 | Saída ativa / sessão | ✅ | 1 (BUG-006 via SW direct write); listeners/intervalos com cleanup (OK) | `OutingPage.tsx`, `BarModeView.tsx`, `sw.js`, `outing` |
| 7 | Dívidas / compartilhados | ✅ | 0 (matemática robusta; divisões guardadas) | `splitting.ts`, `money.ts` |
| 8 | Dashboard / insights / Amigo Sincero | ✅ | 2 (BUG-007, 008); null-guards de owner presentes | `DashboardPage.tsx`, `useNotifications.ts`, `honest-friend.ts` |
| 9 | Planner / simulador | ✅ | 1 (BUG-014) | `RescuePage.tsx`, `SimulatorPage.tsx` |
| 10 | Backup / export / import | ✅ | 0 graves (import é transacional/atômico; JSON.parse guardado por zod) | `backup.ts`, `backup-orchestrators.ts`, `BackupPage.tsx` |
| 11 | Settings / i18n / idioma e moeda | ✅ | 1 (BUG-010); i18n com `fallbackLng`, chave faltante não lança (OK) | `i18n/index.ts`, `RootLayout.tsx`, `money.ts` |
| 12 | Navegação / rotas / deep-link / back | ✅ | 2 (BUG-001, 009) + back do Android (BUG-020) | `router.tsx`, telas com `navigate('/welcome')` |
| 13 | Concorrência (multi-aba, double-submit) | ✅ | 1 (BUG-006: SW vs app no IndexedDB; `versionchange`/`blocked` não tratados); double-submit OK (`saving`/`busy`) | `sw.js`, `useAppData.ts`, `QuickAddPage.tsx`, `BackupPage.tsx` |
| 14 | Limites / edge cases | ✅ | 3 (BUG-010 currency, BUG-015 perfis, BUG-016 data); `splitEqually` guarda `parts<=0` (OK) | `demo-repair.ts`, `money.ts`, `QuickAddPage.tsx` |

Todas as 14 categorias auditadas. Fases 1–4 respondidas (ver Seções 1–4 e a enumeração "toda forma de chegar ao onboarding" na Seção 5).

---

## 7. Recomendações de instrumentação (para capturar isto em produção)

Ordenado por valor vs. esforço (somente recomendações — nenhuma implementada nesta auditoria):

1. **Boot router/guard** que leia `appSettings.activeTrip` e redirecione `/` → `/dashboard` quando há viagem ativa (resolve BUG-001). Faz `start_url:"/"` deixar de cair sempre no onboarding.
2. **Endurecer o caminho de "sem viagem ativa":** antes de tratar como onboarding, **contar `db.trips`**; se houver trips mas `activeTrip` for nulo/órfão, **mostrar uma tela de "recuperar viagem"** (escolher entre as existentes) em vez do Welcome (resolve a percepção de BUG-003/004/C).
3. **`appSettingsRepository.get()` não-destrutivo:** quando a linha some mas existem trips, **não** persistir `activeTrip:null` automaticamente; logar `migration/settings-missing` e oferecer recuperação.
4. **Telemetria no `ErrorBoundary` + `window.onerror`/`window.onunhandledrejection`** com um buffer em IndexedDB/localStorage (BUG-017): captura o crash real do iOS que hoje só vai pro `console`.
5. **Log de falha de migração/abertura do Dexie:** envolver `db.open()` e os `upgrade()` em try/catch que grave um marcador (`db-open-failed`, versão instalada vs. esperada) — detecta `VersionError`/downgrade.
6. **`navigator.storage.persisted()` no boot + flag de risco:** registrar `persisted=false` (iOS) e a estimativa de quota (`navigator.storage.estimate()`); no iOS, orientar instalação na home e backup (já há banner — reforçar com evento de telemetria). Mitiga BUG-002.
7. **`error` em todas as telas:** padronizar o guard `if (error) return <DataErrorScreen .../>` antes de qualquer `navigate('/welcome')`/`return null` (resolve BUG-004 e BUG-014).
8. **try/catch em `localStorage`** (BUG-005/018): isolar `getDeviceId` num helper que cai para memória quando o acesso lança.
9. **SW: abrir o IndexedDB com a versão atual e `onblocked`/store-existence guard** (BUG-006); evitar abrir o DB no SW antes do app tê-lo criado.
10. **Contexto único de app-data** (BUG-007) e quebra do `DashboardPage`/`manualChunks` no build (BUG-008/012) para reduzir trava e memória.

---

### Anexos — checagens que passaram (não são bugs, registradas para evitar re-trabalho)
- **Sem `deleteDatabase`/`db.delete()` em código de produção** (só helpers de teste). O DB não é destruído por código do app.
- **`importBackup` é atômico** (uma `db.transaction`) e `appSettings` **fica fora** de `BACKUP_TABLE_KEYS` (não é limpa no `replace`); `activeTrip`/`onboardingCompleted` são repostos do incoming (`backup-orchestrators.ts:42-73`).
- **`parseBackupFileSafe` valida via zod e trata `JSON.parse`** (`backup.ts:222-239`) — arquivo malformado não escreve nada.
- **`splitEqually`/`centsPercentage`** guardam divisão por zero (`money.ts:28-35, 45-48`).
- **Hooks com listeners** (`useScrolled`, `useKeyboardInset`, `OutingPage` interval/listener, `BarModeView` wake-lock) **têm cleanup** correto.
- **i18n** usa `fallbackLng` e chave faltante retorna a chave (não lança).
- **WebRTC** já tem buffer de mensagens (R6-07, `webrtc-transport.ts:30-35`) e o `JSON.parse` do relay é guardado (`connection.ts:179-183`).
