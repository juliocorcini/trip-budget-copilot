# UX/UI POLISH AUTÔNOMO — TripPilot — Análise Visual + Melhoria Contínua

> **Modo**: Chat direto — sem agents, sem subagents, sem Task tool
> **Execução**: TOTALMENTE AUTÔNOMA, A MADRUGADA TODA. O Julio vai dormir. NÃO pergunte NADA. NÃO abra chat novo. NÃO pare entre gates. Se o contexto esgotar, pare LIMPO (commit + deploy feitos) no fim de um gate, com handoff no state file
> **Objetivo**: rodar o app local, POPULAR com dados mock (todas as funções visíveis), VER cada tela via screenshots, planejar muito bem, implementar melhorias de UX/UI, verificar com novos screenshots, e autocorrigir até ficar excelente
> **Regra de ouro**: ZERO funcionalidade removida. O Julio AMA as funções do app. Você pode REORGANIZAR (ordem, agrupamento, hierarquia, páginas, fluxo, colapsar/expandir) — mas tudo que existe hoje CONTINUA existindo e funcionando
> **Design system**: cores, tokens, tipografia, raios, sombras = INTOCÁVEIS. Você mexe em LAYOUT, HIERARQUIA, DENSIDADE e FLUXO — não na identidade visual

---

## IDENTIDADE

Você é um UX engineer sênior + desenvolvedor frontend fazendo um **polish pass autônomo** no TripPilot. O app funciona, está estável (20 bugs corrigidos) e tem features completas que o Julio adora. Mas o uso real mostrou telas com informação demais, hierarquia confusa e fluxos que pedem reorganização — a tela inicial, por exemplo, tem muitos cards abertos.

Sua missão: **pensar de forma inteligente em cada tela e cada uso, ser maleável, e saber o que faz bem ao usuário.** Não aplique regras cegamente — entenda o propósito de cada tela e melhore com critério. Você tem olho de designer, mão de desenvolvedor e disciplina de QA.

**Regras absolutas:**
- NÃO pergunte ao Julio — ele está dormindo. Decida TUDO sozinho, com bom senso de produto
- NÃO delegue para agents/subagents/Task tool
- NÃO pare entre gates — trabalhe a madrugada toda
- NÃO remova funcionalidades — reorganize, agrupe, simplifique a apresentação
- NÃO mude o design system (cores, tokens, font, radius, shadow)
- PLANEJE MUITO antes de mudar qualquer coisa (Gate 1 é só análise)
- Em caso de dúvida sobre o gosto do Julio → CONSULTE OS DOCUMENTOS (seção abaixo)
- SEMPRE veja a tela (screenshot) ANTES e DEPOIS de cada mudança significativa
- Se um screenshot pós-mudança ficou pior → REVERTA e tente diferente
- SEMPRE rode testes após cada gate. COMITE a cada gate

---

## ⚓ ÂNCORA — REGRAS INVIOLÁVEIS

Releia no início de CADA gate e reproduza no checkpoint:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ESTABILIDADE (do fix anterior — NÃO regredir):
1. NUNCA cair no onboarding com dados no disco
2. appSettings READ-ONLY quando há trips
3. Toda tela: if (error) → DataErrorScreen
4. localStorage SEMPRE via safeLocalStorage
5. navigate() NUNCA no corpo do render — usar <Navigate> declarativo
6. AppDataProvider: 1 leitura compartilhada do DB
7. SW não cria DB vazio nem bloqueia upgrade

UX/UI POLISH (regras desta rodada):
8. ZERO funcionalidade removida — REORGANIZAR é permitido, REMOVER não
9. Design system (cores, tokens, tipografia) = INTOCÁVEL
10. ZONA PROTEGIDA (o Julio AMA): carrossel de insights e o menu de
    ações planejadas com scroll horizontal — preserve por padrão; só
    mexa se for MUITO necessário, com cuidado redobrado e justificativa
11. Pensar como USUÁRIO EM VIAGEM: com pressa, sol na tela, uma mão
12. Dashboard é a tela nº1 (80% do uso começa ali)
13. App PRECISA estar rodando local + POPULADO com dados mock p/ ver de verdade
14. Cada mudança = screenshot ANTES/DEPOIS. Pior que antes → reverte
15. npm run test + typecheck + build verdes em TODO checkpoint
16. Node 22: export PATH="$HOME/.nvm/versions/node/v22.22.3/bin:$PATH"
17. i18n: texto novo/alterado = t() em pt-BR + en + es
18. Git: bash -c 'git commit ...' (sem --trailer)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

---

## RODAR O APP LOCAL (obrigatório — sem isso não há análise visual)

```
1. export PATH="$HOME/.nvm/versions/node/v22.22.3/bin:$PATH"
2. npm install (se necessário)
3. npm run dev  → sobe o Vite (normalmente http://localhost:5173)
   - confirme a porta real no output do terminal
   - rode em background e confirme que respondeu (curl/HEAD ou abrir no browser)
4. O app DEVE carregar antes de qualquer análise. Se não subir, conserte
   o ambiente (porta ocupada, deps) antes de seguir
```

---

## COMO VER O APP — ESTRATÉGIAS EM CASCATA (não desista de ver)

Você PRECISA conseguir ver as telas (screenshots) e popular dados. Um método pode falhar — então tenha plano B, C, D. **Tente exaustivamente antes de desistir de qualquer tela.**

### Estratégia A — Browser MCP (cursor-ide-browser)
- `browser_navigate` para a URL local
- `browser_take_screenshot` para a imagem
- `browser_snapshot` para a árvore de acessibilidade (estrutura/hierarquia)
- `browser_cdp` com `Runtime.evaluate` para inspeção/medições e para injetar dados (ver seção de mock)
- Se precisar interagir: `browser_click`, `browser_type`, etc.

### Estratégia B — Playwright (CONFIRME se existe no Gate 0)
- Cheque `package.json` por `@playwright/test` e por `playwright.config.*`. Se houver:
  - Escreva um script de screenshot (`page.goto`, `page.screenshot({ path })`) que percorre as rotas e salva PNGs numa pasta temporária (ex.: `TripPilot/.ux-shots/`)
  - O Playwright também roda lógica de seed antes de tirar a foto (injeção no IndexedDB / clicar no fluxo de Demo) — ótimo para deixar TUDO visível
  - Rode em viewport mobile (ex.: 390×844, iPhone) — é o uso real do app
- Se não houver Playwright instalado, NÃO instale sem necessidade; prefira a Estratégia A. Só considere adicionar se A e C falharem e for barato

### Estratégia C — Outras formas
- Screenshot via `browser_cdp` `Page.captureScreenshot` (fallback do MCP)
- Servir o `dist` buildado e abrir
- Em último caso: análise por código + `browser_snapshot` (estrutura) — mas isso é o ÚLTIMO recurso; o objetivo é VER de verdade

### Regra
- Se a Estratégia A falhar, vá para B; se B falhar, C. Documente no state file qual método funcionou
- Sempre tire a foto em **viewport mobile** (o app é mobile-first/PWA)
- Se NENHUM método de imagem funcionar após tentativa séria, registre exatamente o que tentou e os erros, e prossiga com snapshot+código — mas deixe claro que a validação visual ficou limitada

---

## DADOS MOCK — ATIVAR TODAS AS FUNÇÕES (crítico)

Um app vazio ESCONDE os problemas de UX. Insights só aparecem com histórico; cards de saída ativa só com sessão; "amigo sincero", dívidas, eventos próximos, heatmap, burndown — tudo precisa de dados. **Você tem que ver o app no estado mais DENSO que um usuário real veria.**

### O que popular (viagem realista e rica):
- 1 viagem com **múltiplas fases** e **vários eventos** (alguns próximos/hoje)
- **Fundos** múltiplos + **carteiras** + pool principal com distribuição
- **Perfis de atividade** variados habilitados (bar, comida, transporte, passeios, compras, entretenimento...)
- **Muitos gastos**: avulsos + **várias saídas/sessões** (umas com muitos itens), ao longo de vários dias → o suficiente para insights/forecasts dispararem
- **Gastos compartilhados e dívidas** (com participantes, "quem pagou", divisões) → para ver /shared e settlements
- Pelo menos um cenário de **saída ATIVA em andamento** → para ver o gauge, timer, stepper, notificação
- Um estado de **acima da meta / over-budget** em alguma categoria → para ver alertas e cores
- Dados que façam o **dashboard mostrar o máximo de cards possível**, todos abertos

### Como popular (escolha o que funcionar):
1. **Modo Demo do app** (mais rápido): o app tem botão "Demo" na WelcomePage. Use-o como base e, se faltar densidade, complemente
2. **Seed programático**: localize a função de seed/demo no código (`src/data/...`, `seed.ts`, `demo-repair.ts`) e dispare-a; ou injete via `browser_cdp`/Playwright direto no IndexedDB respeitando o schema do Dexie
3. **Fluxo manual** pelo browser MCP: criar viagem, registrar gastos, abrir saída — mais lento, use só se 1 e 2 não bastarem

### Regras do mock:
- Os dados mock são para ANÁLISE VISUAL. NÃO comitar dados mock; NÃO deixar resíduo que vá pro deploy
- Teste tanto o **estado denso** (tudo visível — o pior caso de poluição) quanto **estados específicos** (saída ativa, over-budget, Modo Simples vs Completo, viagem recém-criada quase vazia)
- O objetivo: ver o que o usuário REALMENTE encontra e descobrir o que precisa melhorar

---

## CONSULTAR OS DOCUMENTOS — OS GOSTOS DO JULIO ESTÃO ESCRITOS

O Julio documentou preferências e decisões durante todo o projeto. **Em qualquer dúvida sobre "o Julio gostaria disso?", a resposta provavelmente já está num documento.** Leia ANTES de planejar (Gate 1) e reconsulte quando bater dúvida:

- `TripPilot/brain/product-spec.md` — features, regras, escopo
- `TripPilot/brain/decision-log.md` — TODAS as decisões aprovadas (DEC-XXX). NUNCA contradiga uma decisão aprovada
- `TripPilot/brain/technical-direction.md` — stack e padrões
- `TripPilot/brain/project-status.md` — estado atual
- `TripPilot/brain/documents/` — histórico rico de gostos do Julio:
  - `stability-audit-2026-06-13.md` e `stability-fix-prompt.md` (o que NÃO pode regredir)
  - `phase-package-1-capture-simple-mode.md`, `phase-package-2-insights-motivation.md` (Modo Simples/Completo, insights anti-spam, cards configuráveis)
  - `gap-analysis-*.md` e `gap-fix-*` (reclamações e desejos reais de campo)
  - qualquer doc de design system / wireframes
- Se houver dúvida específica, vale procurar nas conversas antigas (transcripts) por palavras-chave

**Padrões que JÁ existem e devem ser reusados (não criar paralelos):** sistema de cards configuráveis (`hiddenDashboardCards` / `dashboardCardOrder` + `DashboardConfigPage`), carrossel de insights com dots + auto-rotação que pausa no toque, BottomSheet/Toast, Modo Simples vs Completo, `AppDataProvider`/`useAppData`, orquestradores atômicos.

---

## ZONA PROTEGIDA — O QUE O JULIO AMA (mexer só se for muito necessário)

O Julio disse explicitamente que gosta MUITO destes e, por padrão, NÃO quer mexer. Trate como **zona amarela**: preserve a essência; só altere se a análise mostrar necessidade real; e, se alterar, faça com cuidado redobrado, screenshot comparativo e justificativa no state file.

1. **Carrossel de insights** (dots embaixo, auto-rotação que pausa ao tocar, swipe 1 por vez, clicar no dot leva ao insight). É um charme do app. Pode no máximo: deixá-lo mais compacto se estiver alto demais — mas mantendo o comportamento que o Julio adora
2. **Menu de ações planejadas com scroll horizontal**. O Julio gosta do formato. Preserve o padrão de scroll horizontal; melhorias só de polish (alinhamento de margem, snap, tamanho de item consistente — vide aprendizados anteriores de carrossel)

**Todas as demais funções também ficam** — a liberdade é para REORGANIZAR (ordem, agrupamento, colapsar por padrão, mover para sub-tela, melhorar hierarquia), nunca para REMOVER.

---

## PRINCÍPIOS DE UX (guia, não dogma — seja maleável)

### Hierarquia de informação
1. **Ação principal** = maior, mais contrastada
2. **Contexto** = menor, suporta a ação
3. **Ações secundárias** = acessíveis sem competir
4. **Avançado** = em expansão/sub-tela, não poluindo

### Densidade (referência, não lei)
- ~3 ações de destaque e ~5 seções/cards visíveis sem scroll é um bom alvo de respiro
- Listas/menus com >7 itens pedem agrupamento ou colapso
- Use bom senso por tela — algumas telas pedem mais densidade que outras

### Disclosure progressivo
- Seção não-principal com muitos itens → considerar colapsar por padrão ("Ver mais"), persistindo o estado nas settings quando fizer sentido
- Reuse o sistema de cards configuráveis que já existe

### Mobile real
- Touch targets ≥ 44px; alcançável com polegar; legível sob sol; feedback claro ao tocar

### Consistência
- Mesmo espaçamento, mesmos componentes (cards, botões, sheets, headers) entre telas

---

## STATE FILE (criar ANTES de começar)

`TripPilot/src/ux-polish-log.md`:

```markdown
# UX/UI Polish Log — Autônomo
## Current State
- Gate: 0 | Telas analisadas: 0/N | Telas melhoradas: 0/N
- Método de screenshot que funcionou: [A/B/C]
- Mock aplicado: [como] | Tests: [baseline] | Build: ✅
## Inventário de telas (Gate 1)
| # | Tela | Shot ANTES | Problemas | Plano | Shot DEPOIS | Status |
## Decisões de UX (cada uma)
| # | Decisão | Motivo | Tela | Consultou doc? |
## Zona protegida — toquei? (insights / ações horizontais)
| Item | Mexi? | Por quê | Essência preservada? |
## Reverts
| # | O que | Por que reverteu | Nova abordagem |
```

---

## MAPA DE GATES

```
GATE 0  Baseline + app local + confirmar Playwright + mock + 1º screenshot
GATE 1  INVENTÁRIO VISUAL + PLANO (só análise — NÃO implementar)
GATE 2  DASHBOARD (tela nº1: hero, cards, densidade, hierarquia)
GATE 3  FLUXOS DE CAPTURA (registrar gasto, quick-add, saída ativa)
GATE 4  PLANEJAMENTO/FINANÇAS (planner, simulador, fundos, carteiras)
GATE 5  TELAS SECUNDÁRIAS (overview, settings, backup, shared, help, sobre)
GATE 6  NAVEGAÇÃO + CONSISTÊNCIA GERAL (bottom nav, spacing, estados vazios)
GATE 7  VERIFICAÇÃO FINAL (screenshot pass + testes de fluxo) + deploy
```

---

## GATE 0 — BASELINE + AMBIENTE + MOCK

```
1. export PATH (Node 22) + npm install se preciso
2. Ler o brain (seção "Consultar os documentos") — entender o app e os gostos
3. npm run test → anotar baseline | npx tsc --noEmit → 0 | npm run build → ✅
4. CONFIRMAR ferramenta visual:
   - checar package.json: existe @playwright/test? playwright.config? → anotar
   - subir npm run dev e abrir no browser MCP
   - tirar 1 screenshot de teste → confirmar QUAL estratégia (A/B/C) funciona
5. POPULAR DADOS MOCK (modo Demo ou seed) até o app ficar denso
6. Tirar 1 screenshot do dashboard populado → confirmar que dá pra ver tudo
7. Criar o state file ux-polish-log.md (anotar método visual + mock usados)
8. Commit: chore: add UX polish state file
```

Se ao fim do Gate 0 você ainda NÃO conseguiu nem ver uma tela nem popular dados, ESGOTE as estratégias A/B/C antes de prosseguir — ver é pré-requisito de tudo.

---

## GATE 1 — INVENTÁRIO VISUAL + PLANO (NÃO mude código — só veja, pense, planeje)

**Todo este gate é análise e planejamento profundo. NÃO implemente nada.** "Planejar muito bem antes de mudar" é regra do Julio.

### Para CADA tela: screenshot + snapshot + responder:
- **Primeira impressão (3s)**: o olho vai pro mais importante?
- **Densidade**: quantos elementos sem scroll? Sobrecarregado?
- **Hierarquia**: há ação principal clara, ou tudo tem o mesmo peso?
- **Agrupamento**: o que é relacionado está junto e separado por grupos?
- **Fluxo**: o caminho mais comum é óbvio?
- **Contexto**: o que o usuário PRECISA aqui vs o que ESTÁ aqui?
- **Mobile/uma mão**: toque de polegar OK?

### Telas a percorrer (com dados mock ativos):
dashboard (e abaixo da fold) · quick-add (fluxo todo) · saída ativa + stepper · planner · simulador · fundos · carteiras · trip overview · trip edit (fases/eventos) · histórico de gastos · compartilhados · settings · backup · sobre/novidades · bottom nav · sheets de long-press e configuração de dashboard · Modo Simples vs Completo

### Foco crítico no DASHBOARD (a dor declarada):
- Cards demais abertos? Quais poderiam colapsar / virar sub-tela / reordenar?
- Hero (livre hoje/saldo) é dominante?
- Registrar gasto em 1 toque?
- Insights e ações horizontais (ZONA PROTEGIDA) — estão tomando espaço demais? Dá pra compactar mantendo a essência?
- Diferença clara entre card informativo (leitura) e acionável?
- Como fica em Modo Simples? Faz sentido?

### Entrega do Gate 1 (no state file):
- Tabela completa: cada tela → problemas → plano de mudança → risco de regressão
- Lista PRIORIZADA por impacto no usuário
- Para a zona protegida: decisão explícita de mexer ou não, com motivo
- NENHUMA mudança de código

**Checkpoint** + commit `docs: UX visual inventory and improvement plan`

---

## GATES 2–6 — IMPLEMENTAÇÃO (tela por tela, com loop visual)

Para cada tela/área, siga o LOOP:
```
1. Screenshot ANTES (com mock ativo)
2. Implementar a mudança planejada no Gate 1
3. Screenshot DEPOIS
4. Comparar: ficou mais claro/limpo/fácil para o usuário?
   - SIM → anotar decisão no state file, seguir
   - NÃO/DÚVIDA → reverter (git checkout -- arquivo), tentar abordagem
     diferente, repetir. NUNCA deixar mudança que piorou
5. Conferir que a funcionalidade continua intacta (clicar, navegar, salvar)
```

### GATE 2 — DASHBOARD
- Hero dominante; registrar gasto em 1 toque; informação progressiva; agrupar cards relacionados; colapsar informativos não-essenciais (reusando o sistema de cards configuráveis); reduzir alturas exageradas
- Insights e ações horizontais: preservar essência; no máximo compactar
- Validar: long-press, configurar dashboard (reordenar/esconder), carrossel (swipe 1 por vez), registrar gasto, Modo Simples
- Commit `ux: dashboard hierarchy, grouping and progressive disclosure`

### GATE 3 — FLUXOS DE CAPTURA
- Velocidade e foco (usuário com pressa no bar): chips de valor claros; stepper enxuto e óbvio; categorias/subcategorias legíveis; "quem pagou/dividiu" claro; confirmação com bom feedback; gauge/timer da saída legíveis
- Validar cada fluxo ponta a ponta
- Commit `ux: capture flows — speed, clarity, focus`

### GATE 4 — PLANEJAMENTO/FINANÇAS
- Compreensão dos números; ação óbvia quando algo está fora do plano; planejado vs gasto claro; fundos com hierarquia clara (pool vs fundos); simulador interpretável; sem intimidar
- Commit `ux: planner, simulator, funds — clarity`

### GATE 5 — TELAS SECUNDÁRIAS
- Encontrabilidade, consistência com dashboard/captura, agrupamento lógico, estados vazios úteis
- Commit `ux: secondary screens — consistency and findability`

### GATE 6 — NAVEGAÇÃO + CONSISTÊNCIA
- Bottom nav (itens/labels/ícones); transições e orientação; padding/margin consistentes; headers e botão voltar consistentes; estados vazios em todas as telas
- Commit `ux: navigation consistency, spacing, empty states`

**Cada gate:** `npm run test` + screenshots de validação + checkpoint.
**Mid-gate refresh:** a cada 3 telas, releia a ÂNCORA + Current State.

---

## GATE 7 — VERIFICAÇÃO FINAL + DEPLOY

```
1. SCREENSHOT PASS FINAL (com mock): percorrer TODAS as telas do inventário;
   comparar ANTES (Gate 1) × AGORA; anotar o que mudou e se melhorou;
   qualquer tela PIOR → corrigir agora
2. TESTES: npm run test (≥ baseline, verdes) · tsc --noEmit (0) · build (✅)
3. FLUXOS NO BROWSER (testar cada um):
   dashboard→registrar gasto→volta · iniciar saída→itens→encerrar ·
   planner · simulador · fundos · backup/export · long-press→sheet ·
   configurar dashboard→reordenar→reload→persistiu · carrossel swipe 1 ·
   bottom nav→todas as telas · Modo Simples↔Completo
4. LIMPAR MOCK: garantir que nenhum dado mock vai pro build/deploy
5. BRAIN: decision-log.md (decisões de UX) + project-status.md (polish feito)
6. BUMP + DEPLOY: package.json patch → npm run build →
   npx wrangler pages deploy dist --project-name=trippilot → anotar URL
7. ENTREGA (state file): tabela ANTES×DEPOIS por tela · decisões de UX ·
   zona protegida (mexeu? por quê) · contagem de telas/componentes/testes ·
   URL do deploy · screenshots das mudanças mais significativas
```

---

## PROTOCOLO DE CHECKPOINT (fim de CADA gate)

```
GATE [N] CONCLUÍDO
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Telas analisadas/melhoradas: [N]/[N] | Reverts: [N]
Método visual: [A/B/C] | Mock: ativo ✅
Zona protegida tocada? [não / o quê e por quê]
Testes: X total | Build ✅ | Typecheck ✅
Fora de escopo? [não / o quê]
State file ✅ | Commit: [hash]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[reproduza o bloco ÂNCORA]
PRÓXIMO: Gate [N+1]
```

---

## RECOVERY PROTOCOL (se o contexto esgotar)

1. `TripPilot/src/ux-polish-log.md` → gate ativo, método visual, mock, decisões
2. Releia ÂNCORA + inventário/plano do Gate 1 + zona protegida
3. Reabra o app local + reaplique o mock + confirme o método de screenshot
4. `npm run test` para confirmar estado
5. Continue do último gate não concluído
6. **PARE LIMPO**: commit + deploy antes de parar. O Julio retoma em chat novo lendo o state file — NÃO precisa aprovar nada

---

## CRITÉRIO DE PARADA

```
DONE quando TUDO = TRUE:
- [ ] App rodou local e foi POPULADO com mock (todas as funções visíveis)
- [ ] Screenshots reais obtidos (método A/B/C documentado)
- [ ] Todas as telas inventariadas, analisadas e planejadas (Gate 1)
- [ ] Dashboard, captura, finanças, secundárias e navegação melhorados
- [ ] Zona protegida preservada (ou alterada com justificativa e essência mantida)
- [ ] ZERO funcionalidade removida
- [ ] Screenshot final: nenhuma tela pior que antes
- [ ] Mock limpo (não vai pro deploy)
- [ ] Testes ≥ baseline + verdes | Build/Typecheck clean | i18n ×3
- [ ] Brain atualizado | Deploy no ar com URL | State file completo (ANTES×DEPOIS)
```

---

## COMECE AGORA

1. GATE 0: app local + confirmar Playwright + popular mock + 1º screenshot
2. GATE 1: ver TUDO, pensar com inteligência tela por tela, planejar fundo — sem implementar
3. GATES 2–6: implementar com loop screenshot ANTES/DEPOIS + autocorreção
4. GATE 7: verificação final + deploy

**O Julio vai dormir e adora as funções do app. Reorganize com inteligência, preserve tudo que ele ama, e faça a UX/UI ficar excelente. Trabalhe a madrugada toda, sem parar. GO.**