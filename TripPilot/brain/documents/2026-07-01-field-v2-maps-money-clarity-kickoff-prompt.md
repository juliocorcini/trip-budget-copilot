# KICKOFF — Leva "Field v2: satélite com rótulos + verdade do dinheiro + mapa/cluster + acerto"

**Você é** um(a) engenheiro(a) full-stack sênior aplicando esta leva **sozinho(a), nesta sessão, de ponta a ponta** — domínio→UI, testar junto, commitar por item, deploy por gate, brain em sync. **Sem worker nesta leva** (tudo device/Pages).

**Fonte de verdade:** `TripPilot/brain/documents/2026-07-01-field-v2-maps-money-clarity-orchestrator.md`. Leia **§0–§9 uma vez**, depois **G0 já**, e **G1 → G5 em ordem** (Gops é operacional/device).

**Estado da leva:** ✅ **ACTIVE**. Julio respondeu (2026-07-01): dinheiro = **corrigir bug + simplificar (1 herói)**; onda = **todos os itens**; scrollbar = **APK**; mover dívida = **/council** (já rodado, §7-B); entrada do mapa = **pílula ícone+texto, implementar depois**. **Dois locks do §16** (L-MONEY-HERO no G2, L-DEBT-CONNECTED no G5) trazem a recomendação do conselho como **default adotado** — confirme antes desses dois gates só se quiser ajustar; **G1/G3/G4 não têm fork — rode direto**. Base **`2.1.0-rc`** (DEC-425/G11 shipado) — **não re-rode** a leva anterior; esta **refina** o que ela entregou. Esta leva **consome** o que já existe: `tile-layers.ts`/`createTileLayer` (DEC-422), `ExpenseLocationMap`/`ExpenseMapPage` (DEC-398/416), `calculateTodayFreeBudget`+cap do cofrinho (DEC-088/415), `buildPhaseAllowanceMap`, `markerClusterGroup`, `isShareReassignable`/`reassignShares` (DEC-414), o CSS de scrollbar travado por `style-hygiene.test.ts` (DEC-425).

## A descoberta-chave (causas REAIS, verificadas lendo o código, confiança ALTA)
São **6 pedidos** → **5 gates + G0 + Gops**. (D01) **Satélite sem rótulos** — `tile-layers.ts › SATELLITE_TILES` usa **só** Esri `World_Imagery` (imagem pura, sem labels); pin tem só `title` (hover) → satélite vira `LayerGroup` (imagery + `Reference/World_Boundaries_and_Places` + `World_Transportation`) + `.bindPopup(label)` no pin (G1). (D02, **keystone**) **Bug 5-vs-14 + confusão** — `rhythm.ts › calculateTodayFreeBudget` capa "livre hoje" no ideal-base quando cofrinho>0 (DEC-415), mas `allowance-map.ts` L235-236 calcula a cota **crua** sem o cap → o **mesmo dia** mostra 5 no Home e 14 na tela por-dia (o docstring L24-28 promete que são iguais — promessa quebrada); e o Home tem 3 números diários concorrentes + "ritmo" com 2 sentidos → corrigir o cap na `allowance-map` (só hoje) + eleger **1 herói** ("Livre para usar hoje") e rebaixar Ritmo/Média pro explicador (G2, **invariante — teste-âncora**). (D03) **Sem entrada pro mapa** — `ExpenseListPage.tsx` L364-400 só tem Escanear/Importar → 3ª pílula "Mapa"→`/mapa` (G3). (D04) **Cluster** — `ExpenseMapPage.tsx` L82-91 sem handler de cluster → segurar agrega `getAllChildMarkers()` e abre o `BottomSheet`; tocar = zoom (G4). (D05) **Mover dívida pra conectado** — `SharedExpensesPage.tsx` L2300-2302 filtra destino por `isPersonLocal` → conselho §7-B: **explicação honesta + caminho P2P agora**, feature completa = onda futura (G5). (D06) **Scrollbar no APK** — CSS web já máximo (`globals.css` L135-246, nota L206-214: APK velho só cura com **build novo**) → rebuild do APK + hardening device-dependente se persistir (Gops).

## Contrato de autonomia (9 regras, condensado)
1. **Sem subagent / sem Task tool / tudo inline** (custo por request).
2. **Não peça permissão entre work units** depois de destravado — fechar gate = commit→deploy→dev-log→próximo.
3. **Não narre o que vai fazer — faça.** Minimize prosa.
4. **Reuse o que existe** (tiles, mapas, cofrinho/ideal-base, allowance-map, cluster, shares) — não reinvente.
5. **Código em inglês; UI via `t()`** (pt/en/es); doc/brain em português.
6. **Domínio antes de UI**, uma mudança por vez, **teste junto**.
7. **Terminal WSL:** sempre `git --no-pager`; commit via `G=/usr/bin/git; "$G" commit -m "…"` **ou** plumbing; nunca pager/editor/`-i`.
8. **Brain em sync:** dev-log todo milestone; decision-log DEC-426→431; product-spec/project-status nos momentos certos.
9. **Hand-off final termina com `AskQuestion`** — só num stop genuíno (DoD toda TRUE, ou contexto acabando), nunca no meio.

## Decisões (DEC-426→431 · defaults §16 adotados)
- **DEC-426** satélite híbrido (imagery + referência Esri) + nome do lugar no ponto (popup) — G1.
- **DEC-427** verdade do dinheiro: (a) corrigir o cap do cofrinho na `allowance-map` (só hoje) → consistência; (b) 1 herói "Livre para usar hoje" + Ritmo/Média no explicador; "ritmo" reservado ao cofrinho — G2 (**invariante**).
- **DEC-428** pílula "Mapa" (ícone+texto) na toolbar de Gastos → `/mapa`; reorg do topo = follow-up — G3.
- **DEC-429** cluster: **segurar** = lista de gastos da bolinha; **tocar** = zoom — G4.
- **DEC-430** mover dívida pra conectado = **explicação honesta + caminho P2P agora**; feature completa (accept-first + trilha/undo cross-device) = onda futura — G5.
- **DEC-431** scrollbar no APK = **rebuild do APK** (+ hardening nomeado se persistir, travado por teste) — Gops.

## ÂNCORA (cole a cada 3 milestones / em cada fronteira de gate)
```
ÂNCORA — Field v2: satélite/rótulos + verdade do dinheiro + mapa/cluster + acerto
- O TOTAL do livre/Trecho/Pote e o net pairwise do owner é INVARIANTE vs baseline.
- Única mudança de "dinheiro" = a LEITURA: "Livre para usar hoje" (capado no cofrinho) é UM herói, IDÊNTICO em Home/check-in/por-dia; o total NÃO muda; Σ(mesada)+cofrinho = livre (bit-a-bit) (Â-MONEY-READING-CONSISTENT).
- Mapa só mostra coords REAIS; satélite/rótulos/tiles best-effort e offline-safe; nunca bloquear.
- Mover dívida NUNCA dessincroniza o device de um conectado sem accept-first; se não garante, explique (Â-DEBT-SYNC-SAFE).
- Sem barra de rolagem; t() (pt/en/es); código em inglês; schema aditivo; hide-never-delete.
CURRENT STATE: gate=<g> · last_commit=<sha> · tests=<n passing/known-base> · risks=<...> · scope=<itens>
```

## Ordem dos gates (+ versão alvo · nenhum toca o worker)
- **G0** baseline (`install`/`test`/`build`/`tsc`) + DEC-426→431 `PROPOSED` + **prova**: `allowance-map`(hoje) ≠ `calculateTodayFreeBudget` quando cofrinho>0 (bug 5-vs-14).
- **G1** satélite com rótulos (híbrido) + nome no ponto → `2.1.1-rc`.
- **G2** verdade do dinheiro: bug + 1 herói + explicador → `2.1.2-rc` (**invariante — teste-âncora obrigatório**).
- **G3** pílula "Mapa" na toolbar de Gastos → `2.1.3-rc`.
- **G4** cluster: segurar = lista → `2.1.4-rc`.
- **G5** mover dívida pra conectado: explicação honesta + caminho → `2.1.5-rc`.
- **Gops** scrollbar no APK: rebuild + hardening device-dependente (não-versionado).

## Per-milestone (5-point) + deploy
Antes de cada commit: (1) liste AC satisfeitos; (2) cite 3 AC anteriores em risco + verifique (sempre **invariância do total** + **nunca bloquear** + **sem barra de rolagem** + **coords reais**); (3) testes sem novas falhas; (4) sinalize arquivo fora de escopo; (5) atualize dev-log. **Deploy por gate:** bump `package.json` + `src/utils/app-version.ts` + `public/version.json` + `package-lock.json` (+ release note pt/en/es em `src/utils/release-notes.ts`) → commit + push `master` → Pages auto-build. Verifique `/version.json`. **Nenhum gate roda `wrangler deploy`.**

## G0 — comandos exatos (rode já)
```bash
cd /home/julio/projetos/trip-budget-copilot/TripPilot
npm install
npm run test 2>&1 | tail -40
npm run build 2>&1 | tail -20
npx tsc --noEmit 2>&1 | tail -20
git --no-pager log --oneline -6   # topo = 2.1.0-rc (DEC-425/G11) — confirmar base
```
Registre as contagens baseline no `src/dev-log.md`; DEC-426→431 como `PROPOSED`; escreva a **prova de caracterização** (o bug 5-vs-14). Locks §16 com defaults adotados → **execute G1→G5 direto**; confirme L-MONEY-HERO/L-DEBT-CONNECTED só se quiser ajustar antes de G2/G5. **Não pare** até a DoD (§12) estar toda TRUE (ou contexto acabando → feche o gate atual limpo + hand-off no dev-log). **Não pergunte nada entre gates.**

**Confirme em UMA linha que leu o orchestrator e começou o G0 — depois continue sem esperar resposta (G1→G5).**
