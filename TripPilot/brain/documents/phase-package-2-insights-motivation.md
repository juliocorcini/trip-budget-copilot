# PACOTE 2 — TripPilot — Insights v2 + Ciclo de Fase + Motivação + Continuidade (Fases 3 e 4)

> **Modo**: Chat direto — sem agents, sem subagents, sem Task tool (regra `tech-lead-delegation`)
> **Fonte da verdade**: `TripPilot/brain/documents/feature-expansion-master-plan-2026-06-13.md` (Epics E4, E5, E6, E7 / Fases 3 e 4)
> **Pré-requisito**: Pacote 1 FEITO (Fases 1 e 2, v0.10.1, DEC-138..149). Modo Simples, captura rápida, saída v2, release-notes/Novidades já existem.
> **Objetivo**: Fase 3 (Insights v2 + Check-in + Ciclo de Fase) e Fase 4 (Meta/Cofrinho + Aprendizado/Templates), com MUITOS testes, ZERO regressão, **deploy + versão nova a cada gate** (pro Julio testar no celular) e Novidades atualizadas no Sobre.
> **Baseline**: rode `npm run test` no GATE 0 e ANOTE a contagem (≈614, fim do Pacote 1) — NUNCA regredir.
> **Execução**: AUTÔNOMA do começo ao fim. NÃO pare entre gates nem entre fases. Só pare se o contexto realmente esgotar — e aí pare LIMPO (commit + deploy feitos) no fim de um gate; o Julio retoma num chat novo lendo o state file. O Julio NÃO vai dar OK no meio.

---

## IDENTIDADE

Você é um engenheiro de produto sênior somando inteligência ao TripPilot — um app local-first, offline, PWA, sem backend, já estabilizado (20 bugs corrigidos) e com Modo Simples/Completo. Sua missão: a Fase 3 transforma o dashboard em **inteligência glanceável e honesta sem virar spam**; a Fase 4 dá um **alvo positivo** (meta/cofrinho) e faz o app **aprender de viagem pra viagem** — tudo sem reintroduzir bug de estabilidade e sem ferir nenhuma das 149 decisões.

**Regras absolutas:**
- NÃO delegue para agents/subagents/Task tool — implemente direto.
- **NÃO peça confirmação pra NADA. Implemente o gate completo, faça deploy, e siga pro próximo.** O Julio não está disponível pra dar OK.
- NÃO resuma — implemente.
- **Só pare se o contexto realmente esgotar.** Mesmo assim: termine o gate atual, faça commit+deploy, escreva o handoff no state file, e PARE LIMPO. O Julio retoma em chat novo (sem aprovar nada).
- INVESTIGUE antes de mudar: leia o código atual do arquivo antes de cada milestone (é feature, não fix com linha exata — confirme o estado real).
- Cada milestone tem "DONE quando" — critério de aceite inegociável.
- SEMPRE `npm run test` + `npx tsc --noEmit` + `npm run build` ao fim de cada gate.
- Reuse os padrões existentes (orquestradores atômicos, BottomSheet/Toast, sistema de cards configuráveis `hiddenDashboardCards`/`dashboardCardOrder` + `DashboardConfigPage`, carrossel de insights com dots, `useAppData`/`AppDataProvider`). NÃO crie padrões paralelos.

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

PRODUTO (invioláveis das 149 DECs):
8. ANTI-SPAM é a regra nº1 da Fase 3 (medo explícito do Julio): todo builder de
   insight RETORNA null quando o sinal não é significativo. "Dia perigoso" só com
   desvio real; "ritmo/categoria" só com ≥3 dias; nunca mostrar por mostrar
9. Auto-rotação de insights PAUSA ao tocar/segurar/swipe e retoma depois
10. NADA bloqueia registro (DEC-053). Avisos/insights CONFIRMAM ou informam, nunca impedem
11. Cofrinho/meta = LEITURA derivada do subgasto. NUNCA um pool real; NUNCA altera a
    matemática do "livre hoje" (DEC-088)
12. Aprendizado NUNCA muda valor do usuário sozinho (DEC-007 / D7): sugere e mostra,
    o usuário aceita. Não contaminar média com special/excluído; sessão = 1 ocasião (DEC-115)
13. Mover sobra de fase é ação EXPLÍCITA e ATÔMICA (orquestrador); preserva o total da viagem
14. Respeitar appMode: a explosão de insights/cards é do Modo COMPLETO. O Modo Simples
    (SimpleHome) continua mínimo — não virar mural. Só OCULTA, nunca apaga (ÂNCORA 16-Pacote1)
15. Money = integer cents. Toda função financeira nova → teste de matemática
16. UI text = t() em pt-BR + en + es no MESMO commit. Zero string hardcoded
17. Zero cores hardcoded — tokens do design-system. Zero diálogos nativos
18. Sem migração Dexie a menos que precise de índice/tabela nova. AppSettings e Transaction
    aceitam campos não-indexados SEM migração (igual appMode/simpleRevealDismissed no Pacote 1)
19. Notificações são best-effort PWA — degradam limpo onde não há suporte

PROCESSO (autonomia + entrega):
20. RODE TUDO SEM PARAR. Sem OK entre gates/fases. Só pare se o contexto esgotar
21. A cada gate concluído: bump de versão + deploy + atualizar Novidades (ver seção própria)
22. Versão SEMPRE em sync: package.json + src/utils/app-version.ts no mesmo commit
23. Node 22: export PATH="$HOME/.nvm/versions/node/v22.22.3/bin:$PATH"
24. Deploy: CLOUDFLARE_ACCOUNT_ID=e146e88b34b2694243b1d74cee8de743 npx wrangler pages
    deploy dist --project-name=trippilot   (2 contas → sem o env var o picker trava o terminal)
25. Git: bash -c 'git commit -m "..."' (sem --trailer)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

---

## STATE FILE (crie ANTES de qualquer código)

`TripPilot/src/phase-3-4-log.md` — fonte de verdade da execução (sobrevive a resumo/reset):

```
# Pacote 2 — Insights v2 + Ciclo de Fase + Motivação + Continuidade — Log
## Current State
- Fase: — | Gate: 0 | Milestone: — | Done: 0/26 | Tests: <baseline 614> | Versão: 0.10.1 | Último deploy: — | Build: ✅
## Decisões tomadas durante a execução
- (registre aqui qualquer escolha de implementação relevante — sobrevive ao reset)
## Deploys
- (versão → URL do deploy, por gate)
## GATE 0
- [ ] Baseline + state file
(etc. — crie a lista completa do MAPA DE GATES, M0..M25)
```

Atualize o `Current State` ao fim de CADA milestone.

---

## 🚀 VERSÃO, DEPLOY E NOVIDADES (regra contínua — vale em TODO gate)

O Julio testa no celular a cada gate concluído. Ao fim de CADA gate (depois do checkpoint verde, SEM pedir aprovação):

1. **Bump de versão** nos DOIS arquivos juntos:
   - `package.json` → `"version"`
   - `src/utils/app-version.ts` → `APP_VERSION`
   - Esquema: **PATCH a cada gate; MINOR ao concluir uma FASE.** A partir de 0.10.1 (GATE 0 não faz bump — pipeline já provado no Pacote 1):

   | Gate | Versão | Marco |
   |------|--------|-------|
   | GATE 0 | 0.10.1 | baseline (sem bump/deploy) |
   | GATE 1 | 0.10.2 | insights liberados + ordenação + auto-rotação |
   | GATE 2 | 0.10.3 | builders calibrados + check-in |
   | **GATE 3** | **0.11.0** | **Fase 3 completa** (ciclo de fase) |
   | GATE 4 | 0.11.1 | meta + cofrinho |
   | GATE 5 | 0.11.2 | aprendizado in-trip |
   | **GATE 6** | **0.12.0** | **Fase 4 completa** (templates) |
   | GATE 7 | 0.12.1 | finalização |

2. **Atualize as Novidades**: adicione uma entrada em `src/utils/release-notes.ts` (helpers/estrutura já existem do Pacote 1) com `version`, `date` e os `items` (pt-BR/en/es) — linguagem do usuário final, curtas, "o que dá pra testar".
3. **Deploy**: `npm run build` → `CLOUDFLARE_ACCOUNT_ID=e146e88b34b2694243b1d74cee8de743 npx wrangler pages deploy dist --project-name=trippilot`. Anote a URL no state file.
4. **Commit** (inclua o bump + release-notes + tudo do gate) via `bash -c 'git commit -m "..."'`.

Cada deploy é um build VERDE — seguro pro Julio testar. NUNCA peça aprovação pra versionar/deployar.

---

## MAPA DE GATES

```
GATE 0  Baseline + state file (sem deploy)

── FASE 3: INSIGHTS v2 + CHECK-IN + CICLO DE FASE (Epics E4 + E5) ──
GATE 1  Insights liberados (0.10.2)
        M1 Prioridade + remover teto · M2 Auto-rotação · M3 Guarda de appMode
GATE 2  Builders calibrados + check-in (0.10.3)
        M4 Ritmo por categoria · M5 Dia perigoso · M6 Fim do dia
        M7 Check-in card · M8 Check-in por notificação (best-effort)
GATE 3  Ciclo de fase + i18n + testes → FASE 3 COMPLETA (0.11.0)
        M9 Sobra de fase (sheet) · M10 Mover sobra (atômico) · M11 Contagem regressiva
        M12 i18n Fase 3 · M13 Testes Fase 3 (muitos)

>>> TRANSIÇÃO FASE 3 → FASE 4 (sem parada — continue) <<<

── FASE 4: MOTIVAÇÃO + CONTINUIDADE (Epics E6 + E7) ──
GATE 4  Meta + cofrinho (0.11.1)
        M14 Meta de economia + card · M15 Cofrinho (leitura derivada) · M16 UI da meta
        M17 Testes E6
GATE 5  Aprendizado in-trip (0.11.2)
        M18 Ajuste contínuo de perfis · M19 Sugestão "atualizar valores" (D7) · M20 Testes
GATE 6  Templates + i18n + testes → FASE 4 COMPLETA (0.12.0)
        M21 Lições → priors (fim da viagem) · M22 Salvar template · M23 Aplicar template
        M24 i18n Fase 4 · M25 Testes Fase 4 (muitos)

GATE 7  Testes finais + brain + deploy final (0.12.1)
```

---

## GATE 0 — BASELINE

```
1. export PATH="$HOME/.nvm/versions/node/v22.22.3/bin:$PATH"
2. Leia o master plan (E4/E5/E6/E7 + Fases 3 e 4) e este arquivo inteiro
3. npm run test → ANOTE a contagem (baseline ≈614) | npx tsc --noEmit → 0 | npm run build → ok
4. Crie TripPilot/src/phase-3-4-log.md com a lista completa de milestones (M0..M25)
5. Sem bump/deploy aqui — o pipeline já foi provado no Pacote 1; o 1º deploy é no GATE 1
```

---

## FASE 3 — INSIGHTS v2 + CHECK-IN + CICLO DE FASE

> Princípio: o dashboard fica esperto **sem virar spam**. Vive em `domain/insights/insights.ts`, `features/dashboard/DashboardCards.tsx` (+`dashboard-format.ts`, `useDashboardModel.ts`), `domain/dashboard/dashboard-cards.ts` (registry de cards), `insights/notifications.ts`, `domain/phases/*`, `domain/budget/budget.ts`. O Modo Simples NÃO recebe a explosão de insights (ÂNCORA 14).

### GATE 1 — Insights liberados + ordenação + auto-rotação → 0.10.2

Estado atual: `MAX_INSIGHTS_PER_DAY = 4`; `buildDashboardInsights` faz `.slice(0, MAX_INSIGHTS_PER_DAY)`; `DashboardInsight` tem `{ kind, tone, values }` (SEM prioridade). UI no case `'insights'` do `DashboardCards.tsx` (carrossel scroll-snap + `insightScrollRef` + `insightIndex` + dots).

#### M1 — Prioridade + remover teto
- **O quê**: liberar o limite de 4 — mostrar TODOS os insights significativos, ordenados por importância.
- **Onde**: `insights.ts` — adicionar `priority: number` a `DashboardInsight` (cada builder define o seu), `buildDashboardInsights` ordena por `priority` desc e remove o `.slice(0, MAX_INSIGHTS_PER_DAY)` (ou eleva o teto a um nº alto de segurança, ex. 12, pra não estourar a UI). Manter "builder retorna null quando não é significativo".
- **DONE quando**: com 6+ sinais reais, todos aparecem ordenados (warning antes de neutral/positive em empate); sem sinal, o bloco some. Testes de ordenação por prioridade + "null não entra".

#### M2 — Auto-rotação
- **O quê**: o carrossel de insights gira sozinho a cada ~7s (além do swipe), pausando na interação.
- **Onde**: case `'insights'` do `DashboardCards.tsx` — `useEffect` com `setInterval` que faz `insightScrollRef.current?.scrollTo(next)`; pausa ao `touchstart`/`pointerdown`/scroll manual (e ao `useLongPress`), retoma após X s de inatividade. Respeitar `prefers-reduced-motion` (sem auto-rotação se reduzido).
- **DONE quando**: gira sozinho com 2+ insights; tocar/segurar/swipe pausa; sem layout shift; some com 0-1 insight. (Difícil testar timer em unit — garantir lógica de "próximo índice" pura e testável, e que `reduced-motion` desliga.)

#### M3 — Guarda de appMode
- **O quê**: garantir que o Modo Simples NÃO vira mural de insights.
- **Onde**: `SimpleHome.tsx` / ramo simples do `DashboardPage`. Decisão: no simples, no máximo o **check-in** (M7) e/ou 1 insight de maior prioridade — nada de carrossel cheio.
- **DONE quando**: modo simples segue mínimo; modo completo recebe tudo. Registre a decisão no log.

**Checkpoint Gate 1** → versão/deploy/novidades (0.10.2) → commit `feat(insights): liberar teto + ordenar por prioridade + auto-rotação (0.10.2)`

### GATE 2 — Builders calibrados (anti-spam) + check-in → 0.10.3

#### M4 — Builder "ritmo por categoria"
- **O quê**: "Bar já comeu 60% do plano da fase, e estamos no dia 3 de 10."
- **Onde**: novo builder puro em `insights.ts` (+ `kind` no union + ícone/i18n). Usa gasto por categoria/perfil da fase vs plano da fase. Gatilho: ≥3 dias de dados E a categoria tem plano/orçamento E consumo desproporcional ao tempo decorrido.
- **DONE quando**: dispara só no cenário desproporcional; null caso contrário. Testes de gatilho.

#### M5 — Builder "dia perigoso"
- **O quê**: "sábado você gasta 2× mais; hoje é sábado."
- **Onde**: builder puro — agrega gasto médio por dia-da-semana sobre o histórico da viagem; dispara só quando HOJE é um dia cujo gasto médio ≥ fator (ex. 1.8×) da média geral E há amostra suficiente (≥2 ocorrências daquele dia). NUNCA todo dia (ÂNCORA 8).
- **DONE quando**: dispara só com desvio real no dia certo; null nos demais. Testes com séries conhecidas (sábado 2× → dispara no sábado; terça normal → null).

#### M6 — Builder "fim do dia"
- **O quê**: se NADA foi registrado hoje, perguntar "o que você gastou hoje?" com atalho ao registro.
- **Onde**: builder/card que só aparece quando não há transação com `localDayOf(date) === todayDate` E já passou da tarde (ex. ≥18h) — evitar perguntar de manhã. Toque abre o QuickAdd.
- **DONE quando**: aparece só sem registro no dia (e no fim do dia); some assim que algo é registrado. Teste do gatilho.

#### M7 — Check-in de intenção (card)
- **O quê**: 1 toque (tranquilo / passeio / noite de bar) arma o contexto do dia e alimenta a previsão.
- **Onde**: card no Dashboard (registry `dashboard-cards.ts`) + campo não-indexado em AppSettings (`dailyCheckIn: { date: string; intent: 'calm'|'outing'|'night' } | null`, sem migração — ÂNCORA 18). O intent ajusta o tom/orçamento do dia (leitura; nunca grava valor do usuário — ÂNCORA 12).
- **DONE quando**: tocar grava o intent do dia; reabrir no mesmo dia mostra o escolhido; vira no dia seguinte. Teste do helper de check-in.

#### M8 — Check-in por notificação respondível (best-effort)
- **O quê**: notificação "como vai ser o dia?" respondível direto (ações = intents).
- **Onde**: reusar a infra de notificação da saída (DEC-124) + `insights/notifications.ts` + SW. Notification Actions onde houver suporte; **fallback gracioso**: onde não dá pra responder na notificação, a notificação só abre o app no check-in. **CORTÁVEL**: se as ações respondíveis exigirem muito (limites de PWA), entregue "notificação abre o app no check-in" e registre "M8 reduzida a abrir-app" no log.
- **DONE quando**: agenda/dispara o lembrete; responder (ou tocar) seta o intent; sem suporte → degrada limpo (ÂNCORA 19). 

**Checkpoint Gate 2** → versão/deploy/novidades (0.10.3) → commit `feat(insights): ritmo/categoria, dia perigoso, fim do dia, check-in (0.10.3)`

### GATE 3 — Ciclo de fase + i18n + testes → FASE 3 COMPLETA → 0.11.0

#### M9 — Sobra de fase (BottomSheet de decisão)
- **O quê**: fase fechou com saldo → "economizou €120 — joga pra próxima fase / vira reserva / libera pra compras".
- **Onde**: detectar fim de fase (data) no dashboard model/orquestrador; BottomSheet de decisão. Só PROPÕE.
- **DONE quando**: ao cruzar o fim de uma fase com saldo positivo, o sheet aparece uma vez; dispensar não repete no mesmo ciclo. Teste do detector de "fase encerrou com sobra".

#### M10 — Mover sobra entre pools (orquestrador atômico)
- **O quê**: a ação escolhida no M9 move o saldo (próxima fase / reserva / pool de compras).
- **Onde**: orquestrador atômico novo (reusa CRUD de fundos/pools); transação única. NÃO recalcula nada na camada de UI.
- **DONE quando**: mover preserva o TOTAL da viagem (pool A↓ = pool B↑); ação é atômica e reversível pelos meios existentes. Teste "pool A → pool B preserva total" (ÂNCORA 13/15).

#### M11 — Contagem regressiva entre fases
- **O quê**: "faltam 3 dias pra Eurotrip; você tem €40/dia até lá."
- **Onde**: builder de insight/card — só quando há próxima fase com data futura próxima.
- **DONE quando**: aparece na janela de transição; some fora dela; €/dia coerente. Teste do cálculo.

#### M12 — i18n (pt-BR + en + es) de tudo dos Gates 1-3.

#### M13 — Testes da Fase 3 (MUITOS)
- Cobrir todos os builders novos (gatilhos + null), prioridade/ordenação, check-in, sobra preserva total, countdown. **Alvo: ≥18 testes novos na Fase 3.** Verde + typecheck + build.

**Checkpoint Gate 3** → versão/deploy/novidades (**0.11.0 — Fase 3**) → commit `feat(fase-3): insights v2 + check-in + ciclo de fase (0.11.0)`

---

## >>> TRANSIÇÃO FASE 3 → FASE 4 (continue — NÃO pare) <<<

A Fase 3 já está commitada e deployada (0.11.0) no checkpoint do GATE 3.

```
1. Confirme verde: npm run test + typecheck + build
2. Smoke golden-path: criar gasto · ver insights girando · ver dashboard (simples e completo)
3. Re-verifique 3 invariantes (ÂNCORA 8 anti-spam, 11 cofrinho não existe ainda mas livre intacto, 14 appMode)
4. Escreva no STATE FILE um HANDOFF da Fase 4 (resumo Fase 3, estado, próximo = GATE 4 / M14)
5. CONTINUE direto no GATE 4. NÃO pare pra pedir OK.
   Exceção: se o contexto realmente esgotou, PARE LIMPO aqui (tudo commitado/deployado) e
   escreva: "Para retomar: chat novo → 'Leia phase-3-4-log.md + o pacote e execute do GATE 4'".
```

---

## FASE 4 — MOTIVAÇÃO + CONTINUIDADE ENTRE VIAGENS

> Princípio: alvo positivo (não só limites) + o app aprende de viagem pra viagem. Vive em `AppSettings`/`Trip`, `domain/budget/*`, cards do Dashboard, `domain/profiles/profiles.ts` (engine de aprendizado), backup/clone (templates). Aprendizado NUNCA muda valor sozinho (ÂNCORA 12).

### GATE 4 — Meta de economia + cofrinho → 0.11.1

#### M14 — Meta de economia + card de progresso
- **O quê**: usuário define "quero voltar com €200 sobrando"; o app acompanha o progresso *em direção* à meta, ao lado do orçamento.
- **Onde**: `savingsGoalCents: number | null` em AppSettings ou Trip (não-indexado — sem migração); card no registry `dashboard-cards.ts` + render em `DashboardCards.tsx`; cálculo de progresso em `domain/budget/`.
- **DONE quando**: definida a meta, o card mostra progresso (projeção de sobra vs meta) sem afetar o "livre hoje". Teste do progresso.

#### M15 — Cofrinho (saldo extra liberado)
- **O quê**: quando subgasta, o economizado vira um "saldo extra liberado" visível — gastar ou guardar.
- **Onde**: LEITURA derivada do subgasto acumulado (estende o conceito `model.savings` já existente). **NÃO é pool real** e **não toca a matemática do livre** (ÂNCORA 11 / DEC-088). Card no dashboard.
- **DONE quando**: subgasto acumulado aparece como cofrinho; "guardar/gastar" é só apresentação; o "livre hoje" permanece idêntico com e sem o cofrinho exibido. Teste: cofrinho não altera `freeToSpend`.

#### M16 — UI pra definir a meta (Settings/Trip).
- **DONE quando**: dá pra setar/limpar a meta; persiste; reflete no card.

#### M17 — Testes E6 (meta, cofrinho não mexe no livre).

**Checkpoint Gate 4** → versão/deploy/novidades (0.11.1) → commit `feat(motivation): meta de economia + cofrinho (0.11.1)`

### GATE 5 — Aprendizado in-trip → 0.11.2

#### M18 — Ajuste contínuo dos perfis
- **O quê**: os valores típicos/safe dos perfis se ajustam DURANTE a viagem pelas médias das últimas saídas (Julio: "já ir calculando na própria viagem").
- **Onde**: `domain/profiles/profiles.ts` (engine de aprendizado já existe — reforçar atualização contínua ao fechar saída). Respeitar flags `special`/`exclude` e DEC-115 (sessão = 1 ocasião); não contaminar média.
- **DONE quando**: ao fechar saídas, a média recente alimenta o cálculo SUGERIDO (não grava o perfil sozinho — ver M19). Testes: special/excluído não entram; sessão conta 1.

#### M19 — Sugestão "atualizar valores" (D7 — mostra, não muda sozinho)
- **O quê**: "seus bares custaram €22, não €15 — atualizar?" O usuário aceita.
- **Onde**: card/sheet que propõe a atualização do perfil; só grava no aceite (ÂNCORA 12 / DEC-007).
- **DONE quando**: a sugestão aparece quando a média diverge do típico; aceitar atualiza o perfil; ignorar não muda nada. Teste do gatilho + "nada muda sem aceite".

#### M20 — Testes do aprendizado (não contamina; nada silencioso).

**Checkpoint Gate 5** → versão/deploy/novidades (0.11.2) → commit `feat(learning): ajuste in-trip + sugestão de valores (0.11.2)`

### GATE 6 — Templates + i18n + testes → FASE 4 COMPLETA → 0.12.0

#### M21 — Lições → priors do próximo (fim da viagem)
- **O quê**: ao encerrar a viagem, propor salvar os valores aprendidos como priors da próxima.
- **Onde**: fluxo de fim de viagem; reusa os valores do engine de aprendizado.
- **DONE quando**: encerrar oferece salvar priors; aceitar persiste pro próximo uso. Teste.

#### M22 — Salvar viagem como template
- **O quê**: salvar a estrutura (fases/perfis/típicos) como molde reutilizável.
- **Onde**: reusa o formato de backup/clone (`domain/backup/*`). **Decisão menor a registrar**: derivar de backup vs tabela `tripTemplates` dedicada — preferir o caminho leve (sem migração) se atender.
- **DONE quando**: dá pra salvar um template a partir de uma viagem; ele fica disponível. Teste de serialização do template.

#### M23 — Aplicar template em nova viagem / onboarding
- **Onde**: seletor "usar template de viagem anterior" no onboarding/nova viagem; reaproveita `createTripFromOnboarding` atômico (BUG-013).
- **DONE quando**: aplicar um template recria fases/perfis/típicos numa viagem nova, atômico. Teste "aplicar template recria a estrutura".

#### M24 — i18n (pt/en/es) de tudo da Fase 4.

#### M25 — Testes da Fase 4 (MUITOS)
- Meta, cofrinho, aprendizado, priors, template salvar/aplicar. **Alvo: ≥12 testes novos na Fase 4.** Verde + typecheck + build.

**Checkpoint Gate 6** → versão/deploy/novidades (**0.12.0 — Fase 4**) → commit `feat(fase-4): motivação + continuidade entre viagens (0.12.0)`

---

## GATE 7 — TESTES FINAIS + BRAIN + DEPLOY FINAL → 0.12.1

```
1. TESTES (MUITOS — o pacote inteiro)
   a) npm run test → TODOS verdes (baseline + ≥30 novos das Fases 3 e 4)
   b) npx tsc --noEmit → 0 | npm run build → sem aviso de chunk > 500 KB
   c) Conte os testes novos do pacote

2. SMOKE (golden path completo)
   a) Insights: vários aparecem ordenados e giram sozinhos; pausam ao tocar
   b) "Dia perigoso"/"ritmo" NÃO aparecem sem gatilho (anti-spam)
   c) Check-in arma o dia; "fim do dia" some ao registrar
   d) Fim de fase com sobra → sheet → mover preserva o total
   e) Meta + cofrinho aparecem e NÃO alteram o "livre hoje"
   f) Sugestão de valores só grava no aceite; salvar/aplicar template recria estrutura
   g) Modo Simples segue mínimo (sem mural de insights)
   h) Estabilidade: cold start com dados → dashboard (não onboarding)
   i) Sobre → versão 0.12.x + Novidades acumuladas

3. BRAIN (registrar as features como DECs aprovadas)
   - decision-log.md → 1 DEC por feature relevante (insights sem teto + prioridade,
     auto-rotação, ritmo/categoria, dia perigoso, fim do dia, check-in (+notificação),
     sobra de fase, mover sobra, countdown, meta de economia, cofrinho, aprendizado in-trip,
     sugestão de valores, priors, templates salvar/aplicar)
   - project-status.md → Fases 3 e 4 implementadas + versões
   - product-spec.md → comportamento novo visível
   - feature-expansion-master-plan-2026-06-13.md → marcar Fases 3 e 4 como FEITAS

4. DEPLOY FINAL
   - Bump 0.12.0 → 0.12.1 (package.json + app-version.ts) + entrada de novidades
   - npm run build → CLOUDFLARE_ACCOUNT_ID=... npx wrangler pages deploy dist --project-name=trippilot → URL
   - commit: chore(release): pacote 2 finalizado (0.12.1)

5. ENTREGA (resumo pro Julio)
   - Tabela M0..M25 com status + arquivo(s) tocados
   - Testes: novos / total | chunks | TODAS as URLs de deploy por versão
   - DECs registradas | M8 (notificação respondível): completa ou reduzida?
```

---

## PROTOCOLO DE CHECKPOINT (fim de CADA gate)

```
GATE [N] CONCLUÍDO
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Milestones: [M.. ✅] | Arquivos: [lista]
Testes: X total (Y novos) | Build ✅ | Typecheck ✅
Anti-spam: [builders novos retornam null fora do gatilho? confirmado]
Regressão: [2-3 invariantes de estabilidade re-checados]
Fora de escopo tocado? [não / o quê e por quê]
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
1. Leia TripPilot/src/phase-3-4-log.md → Fase/Gate/Milestone ativo + handoff
2. Releia a ÂNCORA + a seção do gate ativo NESTE arquivo + a seção VERSÃO/DEPLOY/NOVIDADES
3. Releia o epic correspondente no master plan (E4/E5/E6/E7) se precisar de contexto
4. npm run test → confirme o estado real | confira a versão atual em app-version.ts
5. Continue do último checkbox aberto — NUNCA refaça gate concluído
```

---

## CRITÉRIO DE PARADA

```
DONE quando TUDO = TRUE:
- [ ] M0..M25 com "DONE quando" confirmado (M8 notificação pode estar reduzida)
- [ ] Insights: sem teto fixo, ordenados por prioridade, auto-rotação com pausa
- [ ] Builders calibrados: ritmo/categoria, dia perigoso, fim do dia — NUNCA spam
- [ ] Check-in (card + notificação best-effort) arma o dia
- [ ] Ciclo de fase: sobra (sheet) + mover (atômico, preserva total) + countdown
- [ ] Meta de economia + cofrinho (leitura derivada, NÃO altera o "livre hoje")
- [ ] Aprendizado in-trip sugere (nunca muda sozinho) + templates salvar/aplicar
- [ ] Modo Simples segue mínimo (sem mural de insights)
- [ ] NENHUMA regressão de estabilidade (itens 1-7 da ÂNCORA)
- [ ] i18n pt/en/es em tudo | tokens (zero cor hardcoded)
- [ ] Cada gate gerou versão + deploy + novidades (7 deploys: 0.10.2 → 0.12.1)
- [ ] Testes ≥ baseline + ≥30 novos, verdes | typecheck/build limpos
- [ ] Brain atualizado (DECs) | Deploy final no ar com URL
```

---

## COMECE AGORA

```
1. GATE 0: baseline + state file (sem deploy)
2. FASE 3 (Gates 1-3): insights v2 + check-in + ciclo de fase — deploy a cada gate (0.10.2, 0.10.3, 0.11.0)
3. TRANSIÇÃO: Fase 3 verde/deployada → handoff → CONTINUE (não pare)
4. FASE 4 (Gates 4-6): meta/cofrinho + aprendizado + templates (0.11.1, 0.11.2, 0.12.0)
5. GATE 7: testes finais + brain + deploy final (0.12.1)
```

**Roda TUDO sozinho. Deploy + versão + novidades a cada gate. Anti-spam é sagrado. Só para se o contexto esgotar — e aí para limpo. GO.**
