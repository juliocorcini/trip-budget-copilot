# PACOTE 3 — TripPilot — Local & Hora + Multi-moeda + Segurança & Sharing (Fases 5 e 6)

> **Modo**: Chat direto — sem agents, sem subagents, sem Task tool (regra `tech-lead-delegation`)
> **Fonte da verdade**: `TripPilot/brain/documents/feature-expansion-master-plan-2026-06-13.md` (Epics E8, E9, E10 + Share Target / Fases 5 e 6)
> **Pré-requisito**: Pacotes 1 e 2 FEITOS (Fases 1-4). Este é o ÚLTIMO pacote do V1 expandido (Fase 7 = P2P v2 fica pra V2).
> **Objetivo**: Fase 5 (contexto rico em cada gasto: onde/quando/qual moeda) e Fase 6 (nunca perder dado, levar/mostrar a viagem, registrar via share), com MUITOS testes, ZERO regressão, **deploy + versão nova a cada gate** e Novidades no Sobre.
> **Baseline**: rode `npm run test` no GATE 0 e ANOTE a contagem (≈644+, fim do Pacote 2) — NUNCA regredir.
> **Execução**: AUTÔNOMA do começo ao fim. NÃO pare entre gates nem entre fases. Só pare se o contexto realmente esgotar — e aí pare LIMPO (commit + deploy feitos) no fim de um gate; o Julio retoma num chat novo lendo o state file. O Julio NÃO vai dar OK no meio.

---

## IDENTIDADE

Você é um engenheiro de produto sênior fechando o V1 expandido do TripPilot — local-first, offline, PWA, sem backend, já estabilizado e com Modo Simples/Completo, captura rápida, saída v2, insights v2 e motivação. Sua missão: a Fase 5 dá **contexto** a cada gasto (local+hora+moeda) preservando o princípio offline e a **privacidade**; a Fase 6 garante **durabilidade e portabilidade** dos dados (snapshots, cofre, viewer, lock) e captura via **Share Target** — tudo sem reintroduzir bug e sem ferir as DECs.

**Regras absolutas:**
- NÃO delegue para agents/subagents/Task tool — implemente direto.
- **NÃO peça confirmação pra NADA. Implemente o gate completo, faça deploy, e siga pro próximo.** O Julio não está disponível pra dar OK.
- NÃO resuma — implemente.
- **Só pare se o contexto realmente esgotar.** Mesmo assim: termine o gate atual, faça commit+deploy, escreva o handoff no state file, e PARE LIMPO. O Julio retoma em chat novo (sem aprovar nada).
- INVESTIGUE antes de mudar: leia o código atual do arquivo antes de cada milestone. **Atenção especial**: confirme a versão atual do Dexie em `data/db/schema.ts` e o `BACKUP_VERSION` em `domain/backup/backup.ts` ANTES de migrar/bumpar.
- Cada milestone tem "DONE quando" — critério de aceite inegociável.
- SEMPRE `npm run test` + `npx tsc --noEmit` + `npm run build` ao fim de cada gate.
- Reuse padrões existentes (orquestradores atômicos, BottomSheet/Toast, `money/anchor.ts`, `emergency-snapshot.ts`, `domain/sharing/*`, `useAppData`/`AppDataProvider`, normalizers de backup). NÃO crie padrões paralelos.

---

## ⚓ ÂNCORA — REGRAS INVIOLÁVEIS

Releia no início de CADA gate e reproduza no checkpoint:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ESTABILIDADE (não regredir):
1. NUNCA cair no onboarding com dados no disco. WelcomePage só p/ DB vazio
2. appSettings READ-ONLY quando há trips — nunca grava activeTrip:null
3. Toda tela: if (error) → DataErrorScreen; nunca navigate('/welcome') em erro
4. localStorage SEMPRE via safeLocalStorage (try/catch + fallback memória)
5. navigate() NUNCA no corpo do render — usar <Navigate> declarativo
6. AppDataProvider: 1 leitura compartilhada do DB (não reler por consumidor)
7. SW não cria DB vazio nem bloqueia upgrade do Dexie

PRODUTO (invioláveis das DECs):
8. PRIVACIDADE é a regra nº1 da Fase 5: geolocalização é OPT-IN, 100% LOCAL, NUNCA
   sai do device. GPS negado → fallback gracioso (nome manual). NUNCA bloqueia registro
9. Local "grudento": NÃO perguntar o local a cada gasto — guarda o local atual e só
   repergunta se o GPS indicar mudança de área OU o usuário tocar no nome do lugar
10. OFFLINE-FIRST intacto: coords de GPS funcionam offline; LISTA de lugares próximos e
    SNAPSHOT de câmbio usam rede → são OPT-IN, online-only, com fallback offline. Nenhuma
    feature nova pode quebrar o uso 100% offline do app
11. Multi-moeda: SEMPRE guardar a moeda+valor ORIGINAL além do base. Nunca perder o original.
    Carteira debita NA MOEDA DELA (tx.currency==wallet.currency → amountCents; senão, se
    wallet.currency==base → baseCurrencyAmountCents)
12. App lock é OFF por padrão e NUNCA tranca a recuperação de dados (emergency snapshot /
    import de backup continuam funcionando). PIN é o baseline; biometria é opcional
13. Share Target só PRÉ-PREENCHE um gasto (nunca salva sozinho). Funciona offline (GET)
14. MIGRAÇÃO DEXIE: só UMA no pacote inteiro — a tabela de histórico de snapshots (M14).
    Todo o resto é campo NÃO-INDEXADO (local em Transaction) ou bump de BACKUP_VERSION.
    Confirme a versão atual do Dexie antes de adicionar a tabela
15. Money = integer cents. Toda função financeira nova → teste de matemática
16. UI text = t() em pt-BR + en + es no MESMO commit. Zero string hardcoded
17. Zero cores hardcoded — tokens do design-system. Zero diálogos nativos
18. Respeitar appMode: features novas aparecem coerentes no Simples (mínimo) e no Completo

PROCESSO (autonomia + entrega):
19. RODE TUDO SEM PARAR. Sem OK entre gates/fases. Só pare se o contexto esgotar
20. A cada gate concluído: bump de versão + deploy + atualizar Novidades (ver seção própria)
21. Versão SEMPRE em sync: package.json + src/utils/app-version.ts no mesmo commit
22. Node 22: export PATH="$HOME/.nvm/versions/node/v22.22.3/bin:$PATH"
23. Deploy: CLOUDFLARE_ACCOUNT_ID=e146e88b34b2694243b1d74cee8de743 npx wrangler pages
    deploy dist --project-name=trippilot   (2 contas → sem o env var o picker trava o terminal)
24. Git: bash -c 'git commit -m "..."' (sem --trailer)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

---

## STATE FILE (crie ANTES de qualquer código)

`TripPilot/src/phase-5-6-log.md` — fonte de verdade da execução (sobrevive a resumo/reset):

```
# Pacote 3 — Local & Hora + Multi-moeda + Segurança & Sharing — Log
## Current State
- Fase: — | Gate: 0 | Milestone: — | Done: 0/24 | Tests: <baseline> | Versão: 0.12.1 | Último deploy: — | Build: ✅
## Decisões tomadas durante a execução
- (registre aqui qualquer escolha de implementação relevante — sobrevive ao reset)
## Deploys
- (versão → URL do deploy, por gate)
## GATE 0
- [ ] Baseline + state file
(etc. — crie a lista completa do MAPA DE GATES, M0..M23)
```

Atualize o `Current State` ao fim de CADA milestone.

---

## 🚀 VERSÃO, DEPLOY E NOVIDADES (regra contínua — vale em TODO gate)

Ao fim de CADA gate (depois do checkpoint verde, SEM pedir aprovação):

1. **Bump de versão** nos DOIS arquivos juntos: `package.json` `"version"` + `src/utils/app-version.ts` `APP_VERSION`.
   Esquema: **PATCH a cada gate; MINOR ao concluir uma FASE.** A partir de 0.12.1 (GATE 0 sem bump):

   | Gate | Versão | Marco |
   |------|--------|-------|
   | GATE 0 | 0.12.1 | baseline (sem bump/deploy) |
   | GATE 1 | 0.12.2 | local: campos + GPS + sticky |
   | GATE 2 | 0.12.3 | lugares próximos + exibição + por lugar |
   | **GATE 3** | **0.13.0** | **Fase 5 completa** (multi-moeda) |
   | GATE 4 | 0.13.1 | histórico de snapshots + restore |
   | GATE 5 | 0.13.2 | cofre nuvem + HTML viewer |
   | **GATE 6** | **0.14.0** | **Fase 6 completa** (lock + Share Target) |
   | GATE 7 | 0.14.1 | finalização |

2. **Atualize as Novidades**: adicione uma entrada em `src/utils/release-notes.ts` (estrutura já existe) com `version`, `date` e `items` (pt-BR/en/es) — curtas, "o que dá pra testar".
3. **Deploy**: `npm run build` → `CLOUDFLARE_ACCOUNT_ID=e146e88b34b2694243b1d74cee8de743 npx wrangler pages deploy dist --project-name=trippilot`. Anote a URL no state file.
4. **Commit** (inclua o bump + release-notes + tudo do gate) via `bash -c 'git commit -m "..."'`.

Cada deploy é um build VERDE — seguro pro Julio testar. NUNCA peça aprovação pra versionar/deployar.

---

## MAPA DE GATES

```
GATE 0  Baseline + state file (sem deploy)

── FASE 5: LOCAL & HORA + MULTI-MOEDA (Epics E8 + E9) ──
GATE 1  Local: captura (0.12.2)
        M1 Campos de local em Transaction + backup v5 · M2 GPS opt-in + permissão + fallback
        M3 Local "grudento" (lembra/repergunta por área)
GATE 2  Local: contexto + exibição (0.12.3)
        M4 Lugares próximos (online) + busca/nome manual · M5 Hora+local na lista/detalhe
        M6 Saída ativa mostra o local · M7 "Gastos por lugar"
GATE 3  Multi-moeda + i18n + testes → FASE 5 COMPLETA (0.13.0)
        M8 UI moeda+valor no QuickAdd · M9 Conversão + guardar original · M10 Débito de
        carteira por moeda · M11 Snapshot de câmbio offline (opt-in) · M12 i18n + privacidade
        M13 Testes Fase 5 (muitos)

>>> TRANSIÇÃO FASE 5 → FASE 6 (sem parada — continue) <<<

── FASE 6: SEGURANÇA, COMPARTILHAMENTO & SHARE TARGET (Epic E10 + Share Target) ──
GATE 4  Histórico de snapshots (0.13.1)
        M14 Tabela de snapshots (ÚNICA migração Dexie) · M15 Restaurar "para ontem" · M16 Testes
GATE 5  Cofre + viewer (0.13.2)
        M17 Cofre pra nuvem via share sheet + lembrete · M18 Visualizador HTML read-only · M19 Testes
GATE 6  Lock + Share Target + i18n + testes → FASE 6 COMPLETA (0.14.0)
        M20 Bloqueio PIN/biometria (off por padrão) · M21 Web Share Target (manifest + rota)
        M22 i18n · M23 Testes Fase 6 (muitos)

GATE 7  Testes finais + brain + deploy final (0.14.1)
```

---

## GATE 0 — BASELINE

```
1. export PATH="$HOME/.nvm/versions/node/v22.22.3/bin:$PATH"
2. Leia o master plan (E8/E9/E10 + Fases 5 e 6) e este arquivo inteiro
3. npm run test → ANOTE a contagem (baseline) | npx tsc --noEmit → 0 | npm run build → ok
4. Confirme: versão atual do Dexie em data/db/schema.ts e BACKUP_VERSION em domain/backup/backup.ts
5. Crie TripPilot/src/phase-5-6-log.md com a lista completa de milestones (M0..M23)
6. Sem bump/deploy aqui — o 1º deploy é no GATE 1
```

---

## FASE 5 — LOCAL & HORA + MULTI-MOEDA

> Vive em `Transaction` (campos novos não-indexados), `QuickAddPage.tsx`, `OutingPage.tsx`, `ExpenseListPage`/`ExpenseDetailPage`, `domain/wallets/wallets.ts`, `money/anchor.ts`, `domain/backup/*` (bump v5), AppSettings (local atual grudento). Privacidade e offline-first são sagrados (ÂNCORA 8-11).

### GATE 1 — Local: captura → 0.12.2

Estado atual: `Transaction` NÃO tem campos de local (tem `subcategoryId` como exemplo de campo não-indexado). `BACKUP_VERSION = 4` com `normalizeBackupToV3/V4`.

#### M1 — Campos de local em Transaction + backup v5
- **O quê**: `Transaction` ganha `placeLabel: string | null`, `latitude: number | null`, `longitude: number | null`, `placeId: string | null` (todos NÃO-indexados → sem migração Dexie — ÂNCORA 14).
- **Onde**: `domain/types/transaction.ts`; default null no factory/orquestrador de transação (`entity-factory`/`expense-orchestrators`); `domain/validation/schemas.ts` (campos opcionais/nullable no Zod); `domain/backup/backup.ts` → `BACKUP_VERSION = 5` + `normalizeBackupToV5` (defaults null) chamado em `parseBackupFileSafe`/`readEmergencySnapshot`; atualizar fixtures de backup-test.
- **DONE quando**: criar gasto persiste os campos (null por padrão); backup v4 antigo importa com local=null sem erro; teste do normalizer v5.

#### M2 — Captura de GPS (opt-in, permissão, fallback)
- **O quê**: ao registrar (e ao iniciar saída), com permissão, capturar coords via Geolocation API.
- **Onde**: boundary novo `utils/geolocation.ts` (Promise com timeout + detecção de suporte/erro); chamado no QuickAdd/Outing. Opt-in: só pede permissão quando o usuário ativa "local" (flag em AppSettings `locationCaptureEnabled`, não-indexado, default false). Coords funcionam offline (ÂNCORA 10).
- **DONE quando**: ativado, captura lat/long; negado/sem suporte → segue sem local (nunca bloqueia — ÂNCORA 8); teste do boundary (mock de sucesso/erro).

#### M3 — Local "grudento"
- **O quê**: lembra o local atual e só repergunta ao mudar de área; trocável tocando no nome do lugar.
- **Onde**: "local atual" persistido (AppSettings/estado de sessão: `currentPlace: { label, lat, lng, placeId } | null`); helper puro `shouldReaskPlace(current, newCoords, thresholdMeters)` (distância haversine). Gastos herdam o local atual sem perguntar.
- **DONE quando**: 2º gasto na mesma área herda o local sem perguntar; mover além do threshold reperguntar; toque no nome permite trocar. Teste do haversine + `shouldReaskPlace`.

**Checkpoint Gate 1** → versão/deploy/novidades (0.12.2) → commit `feat(location): campos + GPS opt-in + local grudento (0.12.2)`

### GATE 2 — Local: contexto + exibição → 0.12.3

#### M4 — Lugares próximos (online) + busca/nome manual
- **O quê**: com as coords, sugerir lugares próximos pra escolher; ou buscar/digitar o nome.
- **Onde**: boundary `utils/places.ts` — reverse-geocode/POI via serviço público (ex.: OSM Nominatim) SOMENTE quando online, opt-in; fallback offline = nome manual + lugares já salvos (derivados das transações). Respeitar rate limit/atribuição do provedor.
- **DONE quando**: online sugere lista; offline/negado cai pro manual + recentes; nunca trava. **CORTÁVEL**: se o provedor de POI for problema (rate limit/atribuição), entregue coords + nome manual + recentes (100% offline) e registre "M4: lista de POI adiada" no log.

#### M5 — Hora + local na lista e no detalhe
- **Onde**: `ExpenseListPage` (linha mostra hora+lugar quando houver) e `ExpenseDetailPage` (bloco local+hora; editar o lugar).
- **DONE quando**: gastos com local mostram lugar+hora; sem local, layout intacto (sem buraco). 

#### M6 — Saída ativa mostra o local
- **Onde**: `OutingPage.tsx` — cabeçalho da sessão mostra "em [lugar]" e permite trocar ali (usa o local grudento).
- **DONE quando**: a saída ativa exibe o local atual e troca no toque.

#### M7 — "Gastos por lugar"
- **O quê**: agrupar/filtrar gastos por lugar.
- **Onde**: filtro em `ExpenseListPage` (reusa o padrão de filtro por categoria/perfil já existente, ex.: `?place=`) + agregação derivada.
- **DONE quando**: dá pra ver os gastos de um lugar; total por lugar coerente. Teste da agregação.

**Checkpoint Gate 2** → versão/deploy/novidades (0.12.3) → commit `feat(location): lugares próximos + exibição + gastos por lugar (0.12.3)`

### GATE 3 — Multi-moeda + i18n + testes → FASE 5 COMPLETA → 0.13.0

Estado atual: `Transaction` JÁ tem `currency`, `baseCurrencyAmountCents`, `exchangeRate`. `Wallet` tem `currency`. `calculateWalletBalance` soma `amountCents` cru (assume moeda única — É O RISCO).

#### M8 — UI de moeda + valor no QuickAdd
- **O quê**: escolher a moeda do gasto (ex.: CZK numa viagem EUR) + valor.
- **Onde**: `QuickAddPage.tsx` — seletor de moeda (default = moeda da viagem) ao lado do valor.
- **DONE quando**: dá pra registrar em moeda estrangeira; default é a base; UI clara.

#### M9 — Conversão + guardar original
- **O quê**: converter pra base e guardar valor/moeda original (DEC-128 âncora ou taxa manual por moeda).
- **Onde**: reusa `money/anchor.ts` pra taxa; salva `currency`+`amountCents` (original) + `baseCurrencyAmountCents`+`exchangeRate`. Mostra a conversão antes de salvar.
- **DONE quando**: gasto estrangeiro salva original + base corretos; detalhe mostra "X CZK (≈ Y EUR)". Teste da conversão (cents, arredondamento).

#### M10 — Débito de carteira por moeda (regra)
- **O quê**: gastar moeda estrangeira de uma carteira não pode debitar o número cru.
- **Onde**: `domain/wallets/wallets.ts` — `calculateWalletBalance(wallet, transactions, baseCurrency)`: por transação, debita `amountCents` se `tx.currency===wallet.currency`; senão, se `wallet.currency===baseCurrency`, debita `baseCurrencyAmountCents`. Documentar o edge triplo (carteira nem base nem igual à do gasto) como fora de escopo (assumir carteira em base ou na moeda do gasto). Atualizar todos os call sites da função.
- **DONE quando**: carteira EUR + gasto CZK debita o valor convertido; carteira CZK + gasto CZK debita o original. Testes dos 3 casos (ÂNCORA 11/15).

#### M11 — Snapshot de câmbio offline (opt-in)
- **O quê**: quando online, puxar e congelar as taxas do dia, usadas offline depois.
- **Onde**: boundary `utils/exchange-rates.ts` (fetch 1× online, opt-in) → guarda em AppSettings (taxas congeladas por moeda) ou num registro local. Reusa como taxa default no M9.
- **DONE quando**: online opt-in congela as taxas; offline usa as congeladas; sem nunca quebrar offline (ÂNCORA 10). Teste do uso da taxa congelada.

#### M12 — i18n (pt/en/es) de tudo dos Gates 1-3 + nota de privacidade do local.

#### M13 — Testes da Fase 5 (MUITOS)
- Geo opcional (boundary mockado), haversine/grudento, normalizer backup v5, conversão de moeda, saldo de carteira por moeda, agregação por lugar. **Alvo: ≥18 testes novos na Fase 5.** Verde + typecheck + build.

**Checkpoint Gate 3** → versão/deploy/novidades (**0.13.0 — Fase 5**) → commit `feat(fase-5): local & hora + multi-moeda (0.13.0)`

---

## >>> TRANSIÇÃO FASE 5 → FASE 6 (continue — NÃO pare) <<<

A Fase 5 já está commitada e deployada (0.13.0) no checkpoint do GATE 3.

```
1. Confirme verde: npm run test + typecheck + build
2. Smoke golden-path: criar gasto com local · gasto em moeda estrangeira (carteira certa) · offline ainda funciona
3. Re-verifique 3 invariantes (ÂNCORA 8 privacidade/opt-in, 10 offline intacto, 11 original preservado)
4. Escreva no STATE FILE um HANDOFF da Fase 6 (resumo Fase 5, estado, próximo = GATE 4 / M14)
5. CONTINUE direto no GATE 4. NÃO pare pra pedir OK.
   Exceção: se o contexto realmente esgotou, PARE LIMPO aqui (tudo commitado/deployado) e
   escreva: "Para retomar: chat novo → 'Leia phase-5-6-log.md + o pacote e execute do GATE 4'".
```

---

## FASE 6 — SEGURANÇA, COMPARTILHAMENTO & SHARE TARGET

> Vive em `domain/backup/*`, `features/backup/BackupPage.tsx`, `SettingsPage` (seção Avançado), `utils/emergency-snapshot.ts` (padrão a estender), `domain/sharing/*` (HTML viewer), `public/manifest.json` (Share Target — manifest é ESTÁTICO, sem plugin PWA), `data/db/schema.ts` (a ÚNICA migração: tabela de snapshots). Área isolada, risco baixo-médio, mas a migração precisa de cuidado.

### GATE 4 — Histórico de snapshots → 0.13.1

Estado atual: `emergency-snapshot.ts` guarda UM snapshot em localStorage (≤2.5 MB). Histórico de N não cabe em localStorage → tabela Dexie leve.

#### M14 — Tabela de snapshots (ÚNICA migração Dexie do pacote)
- **O quê**: guardar os últimos N (ex.: 7) snapshots diários pra "restaurar para ontem".
- **Onde**: nova tabela leve em `data/db/schema.ts` (`localSnapshots`: `id`, `createdAt`, `json`) com upgrade Dexie (confirme a versão atual e suba +1 — ÂNCORA 14, padrão dos upgrades v3/v4); repositório; escreve 1×/dia (reusa o gatilho de `recordExpenseForSnapshot`, mas diário); poda além de N. Tabela é LOCAL-only (NÃO entra no BackupData).
- **DONE quando**: até N snapshots diários ficam guardados; o N+1 poda o mais antigo; migração não apaga dado existente. Teste da poda (mantém os N mais novos).

#### M15 — Restaurar "para ontem"
- **Onde**: `SettingsPage` > seção "Avançado" (nova) → lista de snapshots (data + nº de gastos) → restaurar reusa o fluxo de import de backup existente (confirmação clara, atômico).
- **DONE quando**: escolher um snapshot restaura aquele estado; confirmação antes; sem perda silenciosa. 

#### M16 — Testes (poda, leitura/escrita do histórico, restore usa o import existente).

**Checkpoint Gate 4** → versão/deploy/novidades (0.13.1) → commit `feat(backup): histórico de snapshots locais + restaurar (0.13.1)`

### GATE 5 — Cofre + viewer → 0.13.2

#### M17 — Cofre pra nuvem via share sheet + lembrete
- **O quê**: 1 toque manda o JSON do backup pro Drive/Files/email pelo share do SO.
- **Onde**: `BackupPage.tsx` — botão "enviar backup" usando **Web Share API** (`navigator.share` com arquivo, com fallback pra download onde não suportar); reusa o lembrete de backup existente (`isBackupReminderDue`).
- **DONE quando**: compartilha o arquivo de backup pelo share do SO; sem suporte → cai no download atual; nunca trava. 

#### M18 — Visualizador HTML read-only (infográfico da viagem)
- **O quê**: exportar um HTML autocontido com o resumo da viagem (totais, fases, gastos por categoria/lugar, saídas) — abre em qualquer lugar, sem instalar o app.
- **Onde**: `domain/sharing/*` (reusa `share-card.ts` + dados de relatório) → gera uma string HTML self-contained (CSS inline, sem rede) → compartilha/baixa.
- **DONE quando**: gera um HTML que abre offline em qualquer navegador e mostra o resumo; sem PII além do que o usuário compartilha. Teste da geração (contém os totais certos).

#### M19 — Testes (share fallback, geração de HTML).

**Checkpoint Gate 5** → versão/deploy/novidades (0.13.2) → commit `feat(sharing): cofre via share sheet + viewer HTML read-only (0.13.2)`

### GATE 6 — Lock + Share Target + i18n + testes → FASE 6 COMPLETA → 0.14.0

#### M20 — Bloqueio PIN/biometria (off por padrão)
- **O quê**: trava opcional do app pra celular emprestado/perdido.
- **Onde**: `AppSettings` (`appLockEnabled`, não-indexado, default false; PIN guardado como HASH via Web Crypto, nunca em claro); tela de lock no boot (depois do BootGate, antes do app) — **NUNCA tranca a recuperação** (ÂNCORA 12: emergency snapshot/import seguem acessíveis). Biometria = WebAuthn platform authenticator onde suportado.
- **DONE quando**: ativável nas configs; com lock on, abrir o app pede PIN; off por padrão; recuperação de dados não fica trancada. **CORTÁVEL**: se WebAuthn local der trabalho, entregue PIN-only e registre "M20: biometria adiada" no log.

#### M21 — Web Share Target
- **O quê**: registrar o app como destino de compartilhamento — compartilhar texto/URL pré-preenche um gasto.
- **Onde**: `public/manifest.json` (estático) → adicionar `share_target` (method GET, action `/quick-add`, params `{title,text,url}`); `QuickAddPage.tsx` lê os params (`useSearchParams`) e pré-preenche valor (parse de número do texto) + descrição. Confirmar que o SW serve a rota offline (fallback SPA pra index — já é o caso). Pré-preenche só, NUNCA salva sozinho (ÂNCORA 13).
- **DONE quando**: compartilhar um texto pro TripPilot abre o QuickAdd preenchido; funciona offline; salvar é decisão do usuário. Teste do parser de texto→valor/descrição.

#### M22 — i18n (pt/en/es) de tudo da Fase 6.

#### M23 — Testes da Fase 6 (MUITOS)
- Histórico/poda, restore, share fallback, HTML, lock (hash do PIN), parser do Share Target. **Alvo: ≥12 testes novos na Fase 6.** Verde + typecheck + build.

**Checkpoint Gate 6** → versão/deploy/novidades (**0.14.0 — Fase 6**) → commit `feat(fase-6): segurança, sharing & share target (0.14.0)`

---

## GATE 7 — TESTES FINAIS + BRAIN + DEPLOY FINAL → 0.14.1

```
1. TESTES (MUITOS — o pacote inteiro)
   a) npm run test → TODOS verdes (baseline + ≥30 novos das Fases 5 e 6)
   b) npx tsc --noEmit → 0 | npm run build → sem aviso de chunk > 500 KB
   c) Conte os testes novos do pacote

2. SMOKE (golden path completo)
   a) Gasto com local (grudento herda; troca por toque); offline ainda registra
   b) Gasto em moeda estrangeira: original guardado, carteira debita certo
   c) Snapshot diário acumula; restaurar "para ontem" funciona; migração não perdeu dado
   d) Cofre: share do backup; viewer HTML abre offline com os totais certos
   e) Lock on → pede PIN no boot; off por padrão; recuperação não trancada
   f) Share Target: compartilhar texto abre QuickAdd preenchido (não salva sozinho)
   g) Estabilidade: cold start com dados → dashboard (não onboarding); 100% offline intacto
   h) Sobre → versão 0.14.x + Novidades acumuladas

3. BRAIN (registrar as features como DECs aprovadas)
   - decision-log.md → 1 DEC por feature (local+hora em todo gasto, GPS opt-in/grudento,
     lugares próximos, gastos por lugar, multi-moeda + débito de carteira, snapshot de câmbio,
     histórico de snapshots, restaurar, cofre via share, viewer HTML, app lock, Share Target)
   - project-status.md → Fases 5 e 6 implementadas + versões (V1 expandido COMPLETO; Fase 7=V2)
   - product-spec.md / technical-direction.md → backup v5, tabela localSnapshots, manifest share_target
   - feature-expansion-master-plan-2026-06-13.md → marcar Fases 5 e 6 como FEITAS

4. DEPLOY FINAL
   - Bump 0.14.0 → 0.14.1 (package.json + app-version.ts) + entrada de novidades
   - npm run build → CLOUDFLARE_ACCOUNT_ID=... npx wrangler pages deploy dist --project-name=trippilot → URL
   - commit: chore(release): pacote 3 finalizado — V1 expandido completo (0.14.1)

5. ENTREGA (resumo pro Julio)
   - Tabela M0..M23 com status + arquivo(s) tocados
   - Testes: novos / total | chunks | TODAS as URLs de deploy por versão
   - DECs registradas | cortes: M4 (POI) e M20 (biometria) — completos ou adiados?
```

---

## PROTOCOLO DE CHECKPOINT (fim de CADA gate)

```
GATE [N] CONCLUÍDO
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Milestones: [M.. ✅] | Arquivos: [lista]
Testes: X total (Y novos) | Build ✅ | Typecheck ✅
Privacidade/Offline: [geo opt-in? offline intacto? original preservado? confirmado]
Regressão: [2-3 invariantes de estabilidade re-checados]
Migração Dexie tocada? [só no GATE 4 / M14; senão NÃO]
VERSÃO: [bump nos 2 arquivos] | NOVIDADES atualizadas ✅ | DEPLOY: [URL]
State file ✅ | Commit: [hash]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[reproduza o bloco ÂNCORA]
PRÓXIMO: Gate [N+1] (sem parar)
```

**Mid-gate refresh**: a cada 3 milestones, releia a ÂNCORA + Current State do state file.

---

## RECOVERY PROTOCOL (se a conversa resumir/perder o fio)

```
1. Leia TripPilot/src/phase-5-6-log.md → Fase/Gate/Milestone ativo + handoff
2. Releia a ÂNCORA + a seção do gate ativo NESTE arquivo + a seção VERSÃO/DEPLOY/NOVIDADES
3. Releia o epic correspondente no master plan (E8/E9/E10) se precisar de contexto
4. npm run test → confirme o estado real | confira a versão atual em app-version.ts
5. Continue do último checkbox aberto — NUNCA refaça gate concluído
```

---

## CRITÉRIO DE PARADA

```
DONE quando TUDO = TRUE:
- [ ] M0..M23 com "DONE quando" confirmado (M4 POI e M20 biometria podem estar adiados)
- [ ] Local+hora em todo gasto (opt-in, grudento, editável); offline intacto
- [ ] Lugares próximos online + nome manual offline; gastos por lugar
- [ ] Multi-moeda: original preservado + carteira debita na moeda dela + câmbio offline
- [ ] Histórico de snapshots (1 migração Dexie) + restaurar "para ontem"
- [ ] Cofre via share + viewer HTML read-only offline
- [ ] App lock off por padrão (recuperação nunca trancada) + Share Target (só pré-preenche)
- [ ] NENHUMA regressão de estabilidade (itens 1-7 da ÂNCORA) | uso 100% offline intacto
- [ ] PRIVACIDADE: geo 100% local, nunca sai do device
- [ ] i18n pt/en/es em tudo | tokens (zero cor hardcoded)
- [ ] Cada gate gerou versão + deploy + novidades (7 deploys: 0.12.2 → 0.14.1)
- [ ] Testes ≥ baseline + ≥30 novos, verdes | typecheck/build limpos
- [ ] Brain atualizado (DECs) | Deploy final no ar com URL | V1 EXPANDIDO COMPLETO
```

---

## COMECE AGORA

```
1. GATE 0: baseline + state file (sem deploy)
2. FASE 5 (Gates 1-3): local & hora + multi-moeda — deploy a cada gate (0.12.2, 0.12.3, 0.13.0)
3. TRANSIÇÃO: Fase 5 verde/deployada → handoff → CONTINUE (não pare)
4. FASE 6 (Gates 4-6): segurança + sharing + share target (0.13.1, 0.13.2, 0.14.0)
5. GATE 7: testes finais + brain + deploy final (0.14.1) — fecha o V1 expandido
```

**Roda TUDO sozinho. Deploy + versão + novidades a cada gate. Privacidade e offline são sagrados. Só uma migração Dexie (M14). Só para se o contexto esgotar — e aí para limpo. GO.**
