# IMPLEMENTAÇÃO R5 — ESTABILIDADE DE DADOS + CORREÇÕES DE CAMPO — TripPilot

> **Modo**: Chat direto — sem agents, sem subagents, sem Task tool
> **Fonte da verdade**: ESTE prompt — os 9 requisitos abaixo vêm do teste de campo do Julio pós-v0.4.0/v0.5.0. A investigação de root cause JÁ FOI FEITA e está embutida em cada requisito
> **Objetivo**: 9/9 requisitos implementados · DEC-109..113 registrados · brain atualizado · deploy v0.5.1 no ar
> **Baseline protegida**: 299 unit + 29 e2e verdes, typecheck/build limpos — NUNCA pode regredir
> **Tema central**: "o app perdeu todos os meus dados" — o problema nº 1 é confiabilidade de dados. Nada importa mais que isso

---

## IDENTIDADE

Você é um desenvolvedor senior full-stack implementando a rodada R5 **sozinho, nesta conversa**. O Gate 1 é o mais crítico já feito no projeto: o usuário perdeu (aparentemente) todos os dados em campo. A investigação mostrou que os dados provavelmente NÃO foram apagados — o app trata falha de IndexedDB como "estado vazio" e manda o usuário para o onboarding.

**Regras absolutas:**
- NÃO delegue para agents/subagents/Task tool
- NÃO peça confirmação entre gates — decisões pré-resolvidas (DEC-109..113)
- NÃO resuma — implemente
- PRESERVE a baseline de testes — regressão bloqueia o gate
- Cada requisito tem "DONE quando" — critério de aceite não negociável

---

## ⚓ ÂNCORA — REGRAS INVIOLÁVEIS

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
1. FALHA DE DB ≠ DADOS VAZIOS. O app NUNCA pode redirecionar
   para /welcome por causa de um erro de leitura. Welcome só
   quando o load TEVE SUCESSO e onboardingCompleted === false
2. Nenhuma operação de backup/export pode deixar o app em
   estado travado — try/catch + toast em TODA operação async
   disparada por botão
3. Money = integer cents | Soft delete + revision | Domain pure TS
4. Zero cores hardcoded — tokens. Zero diálogos nativos
5. UI text = t() em pt-BR + en + es NO MESMO COMMIT (paridade)
6. npm run test + typecheck + build verdes em TODO checkpoint
7. Node 22 p/ wrangler/playwright:
   export PATH="$HOME/.nvm/versions/node/v22.22.3/bin:$PATH"
   Git: bash -c 'git commit ...' (sem --trailer)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

---

## DECISÕES PRÉ-RESOLVIDAS (registrar como approved no Gate 0)

| DEC | Título | Resumo |
|---|---|---|
| DEC-109 | Falha de DB nunca vira onboarding | useAppData ganha estado de erro + watchdog; tela de recuperação com retry; /welcome só com load OK |
| DEC-110 | Export iOS-safe via Web Share | `navigator.share({files})` quando disponível; fallback âncora com revoke adiado; nunca navegar a página atual |
| DEC-111 | Repair de demo restrito a demo | `repairDemoTripIfNeeded` só roda quando `settings.isDemo === true` — nunca reescreve datas de viagem real |
| DEC-112 | Planner: aviso de déficit derivado do estado, não da sessão | Recomendação aparece sempre que houver over-allocation, mesmo sem mudanças na sessão atual |
| DEC-113 | Gauge da saída com mapeamento por trechos | Posição da bolinha mapeada trecho-a-trecho (0→meta→teto→max) sobre os segmentos visuais fixos |

---

## STATE FILE (crie ANTES de qualquer código)

`TripPilot/src/gap-fix-log-r5.md` — mesmo formato dos anteriores.

---

## MAPA DE GATES

```
GATE 0  Baseline + decision-log (DEC-109..113 → approved)
GATE 1  CRÍTICO — Confiabilidade de dados                R5-01..03
GATE 2  Onboarding: teclado + detalhes                   R5-04..05
GATE 3  Planner + navegação + gauge                      R5-06..09
GATE 4  Brain + verificação final + deploy v0.5.1
```

---

## GATE 1 — CONFIABILIDADE DE DADOS (CRÍTICO)

**R5-01 — useAppData resiliente + tela de recuperação (DEC-109)**
> Relato: "após exportar o json o app ficou só 'carregando...' e não funcionou mais; fechei e abri, estava zerado, pedindo para criar viagem ou importar backup; importei e travou de novo" + "se eu saio do app ele está perdendo todos os dados às vezes".
>
> Root cause investigada: `useAppData.reload()` tem `try/finally` SEM `catch`. Quando o IndexedDB falha ou trava (bug conhecido do WebKit em PWA standalone após share-sheet/background), acontece um de dois cenários: (a) a promise nunca resolve → `loading` fica `true` para sempre → "Carregando..." infinito em toda página que usa o hook (a aba "Mais" não usa — bate com o relato); (b) a promise rejeita → `settings`/`trip` ficam `null` → `DashboardPage:333` faz `navigate('/welcome')` → o usuário acha que perdeu tudo (os dados continuam no IndexedDB).
- `useAppData` ganha `error: boolean` no retorno: `catch` no `reload()` seta `error=true` e loga o erro real no console
- Watchdog: se o load não completar em 10s, seta `error=true` (timeout via `Promise.race` ou timer — limpar no sucesso)
- Novo componente `DataErrorScreen` (i18n: título "Não foi possível carregar seus dados", corpo explicando que os dados NÃO foram apagados, botão "Tentar novamente"): retry faz `db.close()` (se aberto) + reload; nada de /welcome
- `DashboardPage` (e `QuickAddPage`): só redireciona/retorna null para welcome quando `!loading && !error` e o load teve sucesso
- Resiliência Dexie: handler `db.on('close')` → tentar reabrir no próximo acesso; listener `visibilitychange` (document visível) → se houve erro, tentar `reload()` automaticamente uma vez
- DONE quando: simular falha de DB (mock) mostra a tela de recuperação em vez de welcome; retry funciona; teste unit cobrindo "reload rejeita → error=true, não limpa settings pré-existentes"

**R5-02 — Export/Import à prova de travamento (DEC-110)**
> Root cause: `downloadFile` cria âncora blob com `revokeObjectURL` IMEDIATO. No PWA standalone do iOS, `a.download` é ignorado e o webview navega para o blob já revogado → página quebrada/travada. Além disso `handleExport`/`handleImport` não têm try/catch: qualquer rejeição vira unhandled e pode deixar a UI em estado inconsistente.
- Novo `exportFile` em `src/utils/` (ou no módulo backup): 1º tenta `navigator.share({ files: [File] })` quando `navigator.canShare?.({files})` aceitar (mobile); fallback: âncora com `target="_blank"` + `rel="noopener"` e `revokeObjectURL` adiado via `setTimeout(..., 10000)`; NUNCA navegar a página atual
- `downloadFile` legado passa a delegar para o novo caminho (CSV incluído)
- `handleExport`, `handleImport`, `exportCsv`: try/catch com `showToast(..., 'danger')` no erro + estado `busy` desabilitando o botão durante a operação
- `importBackup` (orquestrador): garantir que erro dentro da transação propaga e a UI mostra erro — sem promise órfã
- DONE quando: export JSON/CSV funciona desktop + mobile sem deixar o app travado; erro simulado em import mostra toast e o app continua utilizável

**R5-03 — Persistência de storage + repair restrito a demo (DEC-111)**
> Root cause da perda real (quando há): storage não persistente → o SO pode despejar IndexedDB de PWA. `requestPersistentStorage()` só é chamado no fim do onboarding e no 1º gasto. E `repairDemoTripIfNeeded` reescreve `startDate/endDate` de viagens REAIS sempre que nenhuma fase está ativa (viagem futura ou encerrada) — corrupção silenciosa de dados.
- Chamar `requestPersistentStorage()` no boot do app (`main.tsx`/entry), idempotente
- Banner discreto no Dashboard quando `navigator.storage.persisted() === false` (i18n, dispensável por sessão, CTA → Configurações onde já existe o toggle)
- `repairDemoTripIfNeeded`: early-return quando `!settings.isDemo` (a recriação de profiles ausentes pode continuar para qualquer trip — só o rewrite de datas é restrito a demo)
- DONE quando: teste unit prova que viagem real fora do período NÃO tem datas reescritas; demo continua sendo reparada; banner aparece quando não persistido

---

## GATE 2 — ONBOARDING

**R5-04 — Teclado não cobre os botões (DEC-—, UX)**
> Relato: "quando o teclado está aberto, ele fica em cima dos botões voltar e próximo".
- Adicionar `interactive-widget=resizes-content` ao viewport meta do `index.html` (Android Chrome 108+)
- Hook `useKeyboardInset()` (visualViewport: `height`/`offsetTop` → inset em px) aplicado ao footer do onboarding: o bloco de botões recebe `margin-bottom`/`transform` igual ao inset quando o teclado abre (iOS)
- Onboarding usa `100dvh` (não `min-h-screen`/`100vh`) e o conteúdo do step rola se necessário (`overflow-y-auto`) com o footer sempre visível
- Campo focado faz `scrollIntoView({block:'center'})` no focus
- DONE quando: com teclado aberto em qualquer step, os botões voltar/próximo permanecem visíveis acima do teclado (Android e iOS)

**R5-05 — Onboarding pede os detalhes que o resto do app pede**
> Relato: "no onboarding se cria a fase e a viagem, mas sem tantos detalhes como criamos em outros lugares".
> Investigado: o editor completo de fase pede ritmo (`rhythmPreset`) e dias de pico (`peakDays`); o onboarding cria a fase com `rhythmPreset: null`, datas = viagem, sem perguntar nada.
- Step da fase (atual step 2) ganha: datas da fase (pré-preenchidas com as da viagem, editáveis, validadas dentro do range da viagem) + seletor de ritmo (chips: uniforme/intenso/moderado/relaxado — uniforme = null, default) + quando ritmo ≠ uniforme, seletor de dias de pico (chips seg..dom, opcional)
- `createOnboardingEntities` recebe `phaseStartDate`, `phaseEndDate`, `rhythmPreset`, `peakDays` e os aplica na Phase
- Tudo opcional além do que já era obrigatório — onboarding não pode ficar mais longo de completar (defaults inteligentes)
- DONE quando: fase criada no onboarding tem ritmo/datas conforme escolhido; sem escolher nada o comportamento atual se mantém

---

## GATE 3 — PLANNER + NAVEGAÇÃO + GAUGE

**R5-06 — Mensagem "você adicionou" detalhada por categoria**
> Relato: "ele fala 'você adicionou 23 café & padaria' sendo que adicionei 2 café, 16 transporte e 5 mercado".
> Root cause: `PlannerPage` linha ~999 soma `count - baselineCount` de TODOS os perfis modificados mas usa `modifiedProfiles[0]?.name` como rótulo.
- Construir a lista de adições POR PERFIL (`count > baselineCount` apenas; ignorar reduções) e renderizar itemizado: "Você adicionou 16 transporte, 5 mercado e 2 café & padaria"
- Nova key i18n `planner.added_breakdown` (en/pt-BR/es) usando lista montada com a conjunção existente `planner.and_conjunction`; remover/substituir o uso incorreto de `added_count`
- DONE quando: cenário 2+16+5 mostra os três itens com números corretos; teste unit da função pura que monta o breakdown

**R5-07 — Recomendação persiste enquanto houver déficit (DEC-112)**
> Relato: "se eu saio da tela quando tem a mensagem dizendo para tirar algo específico, quando volto a mensagem não aparece mais, só a de negativo".
> Root cause: o bloco déficit+recomendação é renderizado sob `hasDeficit && modifiedProfiles.length > 0`. Ao voltar à tela, o estado hidrata do plano persistido com `baselineCount = count` → `modifiedProfiles` vazio → bloco some, mesmo com o plano estourado (`liveMarginCents < 0`).
- Separar os dois conceitos: o card de recomendação ("reduza X e Y") passa a renderizar sempre que `recommendation !== null` (a recomendação já se baseia em `deficitCents`); o headline "você adicionou..." continua condicionado a haver adições na sessão
- `deficitCents` deve refletir over-allocation total quando não há mudanças na sessão: quando `modifiedProfiles` vazio e `liveMarginCents < 0`, o déficit é `-liveMarginCents` (hoje `extraCostCents = 0` zera tudo)
- No `recommendation`, o filtro `modifiedIds.has(p.id)` não pode excluir todo mundo quando não há modificados — comportamento atual já ok (set vazio)
- DONE quando: estourar o plano, sair do Planner, voltar → card "Recomendação: reduza ..." visível com sugestões válidas; teste unit do cálculo de déficit pós-rehidratação

**R5-08 — Botão voltar em Participantes & Dívidas, Backup e Configurações**
> Relato: páginas sem o botão de voltar no topo, "todas as outras do Mais têm".
> Padrão existente: `AboutPage`/`WalletsPage`/`FundsPage` — `<button onClick={() => navigate(-1)}>` com `Icon arrow_back` + `aria-label common.back`.
- Aplicar o mesmo header pattern em `SharedExpensesPage`, `BackupPage`, `SettingsPage` (manter o título existente ao lado da seta)
- DONE quando: as 3 páginas têm seta de voltar funcional no topo, visual idêntico às demais

**R5-09 — Gauge da saída: bolinha no trecho certo + design (DEC-113)**
> Relato: "meta 35, gasto seguro 45, máximo 55; estou com 40 e a bolinha já está no amarelo (depois de 45)" + "a bolinha com o valor está estranha, meio jogada".
> Root cause: os segmentos visuais têm proporções FIXAS (flex 3:2:1:1 → verde 0–42,9%, laranja 42,9–71,4%, âmbar 71,4–85,7%, vermelho 85,7–100%), mas a posição é linear `totalSpent/maxCents` (40/55 = 72,7% → cai no âmbar apesar de 40 < 45).
- Nova função pura no domínio (`src/domain/sessions/` ou módulo do gauge): `calculateGaugePosition(spent, target, ceiling, max): number` com mapeamento por trechos: `[0,target] → [0,42.86]`, `(target,ceiling] → (42.86,71.43]`, `(ceiling,max] → (71.43,100]`, `>max → 100`; tratar degenerados (target=0, ceiling=target, max=ceiling)
- Redesign do marcador: pill com o valor (fundo `var(--surface-high)`, borda sutil, tabular) ancorada ACIMA da bolinha, com `translateX` clampado para não vazar das bordas do bar; bolinha com anel do tema (sem "jogada")
- DONE quando: cenário 35/45/55 com gasto 40 posiciona a bolinha dentro do trecho laranja (entre meta e teto); teste unit com os números exatos do relato + degenerados

---

## GATE 4 — BRAIN + VERIFICAÇÃO FINAL + DEPLOY

1. `npm run test` (unit) + `npx playwright test` (e2e) + `npm run typecheck` + `npm run build` — tudo verde
2. Atualizar brain: `decision-log.md` (DEC-109..113 → implemented), `project-status.md` (v0.5.1, R5 done), `meetings-log.md` se aplicável
3. Bump `package.json` + `app-version.ts` → `0.5.1`
4. Deploy Pages: `npx wrangler pages deploy dist --project-name=trippilot`
5. Commit + atualizar `gap-fix-log-r5.md` para 9/9

---

## RECOVERY PROTOCOL

Se a conversa degradar: reler ÂNCORA, reler `gap-fix-log-r5.md` (Current State), continuar do item aberto.
