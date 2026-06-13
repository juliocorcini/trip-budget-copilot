# PACOTE 1 — TripPilot — Captura Rápida + Saída v2 + Modo Simples (Fases 1 e 2)

> **Modo**: Chat direto — sem agents, sem subagents, sem Task tool (regra `tech-lead-delegation`)
> **Fonte da verdade**: `TripPilot/brain/documents/feature-expansion-master-plan-2026-06-13.md` (Epics E2, E3, E1 / Fases 1 e 2)
> **Objetivo**: implementar a Fase 1 (captura rápida + saída v2) e a Fase 2 (modo simples + início inteligente), com MUITOS testes, ZERO regressão dos fixes de estabilidade, **deploy + versão nova a cada gate** (pro Julio testar no celular) e novidades visíveis no Sobre.
> **Baseline**: rode `npm run test` no GATE 0 e ANOTE a contagem (≈504) — NUNCA regredir.
> **Execução**: AUTÔNOMA do começo ao fim. NÃO pare entre gates nem entre fases. Só pare se o contexto realmente esgotar — e aí pare LIMPO (commit + deploy feitos) no fim de um gate; o Julio retoma num chat novo lendo o state file. O Julio NÃO vai dar OK no meio.

---

## IDENTIDADE

Você é um engenheiro de produto sênior adicionando features a um app **que acabou de ser estabilizado** (20 bugs P0-P3 corrigidos). O app é local-first, offline, PWA, sem backend. Sua missão: construir as features das Fases 1 e 2 **sem reintroduzir nenhum bug de estabilidade** e sem quebrar nenhuma das 137 decisões — testando muito e entregando versões testáveis a cada gate.

**Regras absolutas:**
- NÃO delegue para agents/subagents/Task tool — implemente direto.
- **NÃO peça confirmação pra NADA. Implemente o gate completo, faça deploy, e siga pro próximo.** O Julio não está disponível pra dar OK. O escopo está todo especificado abaixo.
- NÃO resuma — implemente.
- **Só pare se o contexto realmente esgotar.** Mesmo assim: termine o gate atual, faça commit+deploy, escreva o handoff no state file, e PARE LIMPO. O Julio retoma em chat novo (sem precisar aprovar nada).
- INVESTIGUE antes de mudar: leia o código atual do arquivo antes de cada milestone (isto é feature, não fix com linha exata — confirme o estado real).
- Cada milestone tem "DONE quando" — critério de aceite inegociável.
- SEMPRE `npm run test` + `npx tsc --noEmit` + `npm run build` ao fim de cada gate — nunca confie em "acho que está certo".
- Reuse os padrões existentes (orquestradores, BottomSheet, sistema de cards, `useAppData`/`AppDataProvider`). NÃO crie padrões paralelos.

---

## ⚓ ÂNCORA — REGRAS INVIOLÁVEIS

Releia no início de CADA gate e reproduza no checkpoint:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ESTABILIDADE (não regredir — fixes recém-feitos):
1. NUNCA cair no onboarding com dados no disco. WelcomePage só p/ DB vazio
2. appSettings READ-ONLY quando há trips — nunca grava activeTrip:null
3. Toda tela: if (error) → DataErrorScreen; nunca navigate('/welcome') em erro
4. localStorage SEMPRE via safeLocalStorage (try/catch + fallback memória)
5. navigate() NUNCA no corpo do render — usar <Navigate> declarativo
6. AppDataProvider: 1 leitura compartilhada do DB (não reler por consumidor)
7. SW não cria DB vazio nem bloqueia upgrade do Dexie

PRODUTO (invioláveis das 137 DECs):
8. NADA bloqueia registro (DEC-053). Avisos CONFIRMAM, nunca impedem
9. Modo Simples só OCULTA — nunca apaga dados nem rotas. Deep-link a tela
   "completa" no Simples → guarda + opção "abrir mesmo assim"
10. NUNCA mudar valor/preferência do usuário sozinho (DEC-007). Sugere/mostra
11. Money = integer cents. Toda função financeira nova → teste de matemática
12. UI text = t() em pt-BR + en + es no MESMO commit. Zero string hardcoded
13. Zero cores hardcoded — tokens do design-system. Zero diálogos nativos
14. Sem migração Dexie a menos que precise de índice/tabela nova. AppSettings e
    Transaction aceitam campos não-indexados SEM migração (igual subcategoryId)
15. Reusar orquestradores atômicos — sem acesso cru ao DB na camada de feature

PROCESSO (autonomia + entrega):
16. RODE TUDO SEM PARAR. Sem OK entre gates/fases. Só pare se o contexto esgotar
17. A cada gate concluído: bump de versão + deploy + atualizar Novidades (ver seção própria)
18. Versão SEMPRE em sync: package.json + src/utils/app-version.ts no mesmo commit
19. Node 22: export PATH="$HOME/.nvm/versions/node/v22.22.3/bin:$PATH"
20. Git: bash -c 'git commit -m "..."' (sem --trailer)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

---

## STATE FILE (crie ANTES de qualquer código)

`TripPilot/src/phase-1-2-log.md` — fonte de verdade da execução (sobrevive a resumo/reset):

```
# Pacote 1 — Captura + Saída v2 + Modo Simples — Log
## Current State
- Fase: — | Gate: 0 | Milestone: — | Done: 0/26 | Tests: <baseline> | Versão: 0.8.2 | Último deploy: — | Build: ✅
## Decisões tomadas durante a execução
- (registre aqui qualquer escolha de implementação relevante — sobrevive ao reset)
## Deploys
- (versão → URL do deploy, por gate)
## GATE 0
- [ ] Baseline + M0 Novidades + pipeline de deploy
(etc. — crie a lista completa do MAPA DE GATES)
```

Atualize o `Current State` ao fim de CADA milestone.

---

## 🚀 VERSÃO, DEPLOY E NOVIDADES (regra contínua — vale em TODO gate)

O Julio testa no celular a cada gate concluído. Então, ao fim de CADA gate (depois do checkpoint verde, SEM pedir aprovação):

1. **Bump de versão** nos DOIS arquivos juntos (têm que ficar sincronizados):
   - `package.json` → `"version"`
   - `src/utils/app-version.ts` → `APP_VERSION`
   - Esquema: **PATCH a cada gate; MINOR ao concluir uma FASE** (último gate da fase). A partir de 0.8.2:

   | Gate | Versão | Marco |
   |------|--------|-------|
   | GATE 0 | 0.8.3 | infra novidades + pipeline |
   | GATE 1 | 0.8.4 | captura |
   | GATE 2 | 0.8.5 | saída v2 |
   | **GATE 3** | **0.9.0** | **Fase 1 completa** |
   | GATE 4 | 0.9.1 | fundação modo |
   | GATE 5 | 0.9.2 | UI modo |
   | **GATE 6** | **0.10.0** | **Fase 2 completa** |
   | GATE 7 | 0.10.1 | finalização |

2. **Atualize as Novidades** dessa versão (ver M0): adicione uma entrada em `src/utils/release-notes.ts` com `version`, `date` e os `items` (pt-BR/en/es) — linguagem do usuário final, curtas, "o que dá pra testar".
3. **Deploy**: `npm run build` → `npx wrangler pages deploy dist --project-name=trippilot`. Anote a URL no state file.
4. **Commit** (inclua o bump de versão + release-notes + tudo do gate).

Cada deploy é um build VERDE (testes + typecheck + build passam) — seguro pro Julio testar. NUNCA peça aprovação pra versionar/deployar. Só faz.

---

## MAPA DE GATES

```
GATE 0  Baseline + M0 Novidades no Sobre + pipeline de deploy (0.8.3)

── FASE 1: CAPTURA RÁPIDA + SAÍDA v2 (Epics E2 + E3) ──
GATE 1  Captura no QuickAdd (0.8.4)
        M1 Calculadora · M2 Memória por descrição · M3 Repetir/favoritos
        M4 Transporte ida-e-volta · M5 Aviso de anomalia
GATE 2  Saída v2 (0.8.5)
        M6 Botões "últimos valores usados" · M7 Repetir último item
        M8 Rodada · M9 Rotação "quem paga" · M10 Projeção temporal
GATE 3  Extras + i18n + testes da Fase 1 → FASE 1 COMPLETA (0.9.0)
        M11 (Opcional) voz · M12 Simulador "pegar de amanhã" · M13 i18n
        M14 Testes Fase 1 (muitos)

>>> TRANSIÇÃO FASE 1 → FASE 2 (sem parada — continue) <<<

── FASE 2: MODO SIMPLES + INÍCIO INTELIGENTE (Epic E1) ──
GATE 4  Fundação do modo (0.9.1)
        M15 appMode em AppSettings · M16 Onboarding 1-pergunta + escolha
        simples/completo · M17 Defaults inteligentes por preset
GATE 5  UI do modo (0.9.2)
        M18 Dashboard simples (1 número + 1 botão) · M19 Nav mode-aware
        M20 Guardas de rota · M21 Toggle "mudar de modo" em Settings
GATE 6  Adaptativo + polish + i18n + testes → FASE 2 COMPLETA (0.10.0)
        M22 Revelação adaptativa · M23 Empty states/microcopy · M24 i18n
        M25 Testes Fase 2 (muitos)

GATE 7  Testes finais + brain + deploy final (0.10.1)
```

---

## GATE 0 — BASELINE + INFRA DE VERSÃO/NOVIDADES

```
1. export PATH="$HOME/.nvm/versions/node/v22.22.3/bin:$PATH"
2. Leia o master plan (E1/E2/E3 + Fases 1 e 2) e este arquivo inteiro
3. npm run test → ANOTE a contagem (baseline) | npx tsc --noEmit → 0 | npm run build → ok
4. Crie TripPilot/src/phase-1-2-log.md com a lista completa de milestones (M0..M25)
```

**M0 — Tela de Novidades no Sobre** (feature — o Julio pediu)
- **O quê**: o Sobre (que já mostra a versão) passa a listar "Novidades desta versão" — o que entrou, pra ele saber o que testar.
- **Onde**:
  - Criar `src/utils/release-notes.ts`: `export const RELEASE_NOTES: Array<{ version: string; date: string; items: { 'pt-BR': string[]; en: string[]; es: string[] } }>` (ordem desc por versão). 1ª entrada: `0.8.3` — "Tela de novidades adicionada".
  - `src/features/more/AboutPage.tsx`: seção "Novidades desta versão" mostrando os `items` da versão atual (`APP_VERSION`) no idioma ativo; abaixo, um expandível "Versões anteriores".
  - i18n dos rótulos (`about.whats_new`, `about.previous_versions`) em pt/en/es.
- **DONE quando**: abrir o Sobre mostra a versão + a lista de novidades dela no idioma do app. Teste de render (versão atual → seus items).

```
5. Pipeline de versão/deploy (confirmar que funciona ANTES das features):
   - Bump 0.8.2 → 0.8.3 (package.json + src/utils/app-version.ts)
   - Adicione a entrada 0.8.3 em release-notes.ts
   - npm run build → npx wrangler pages deploy dist --project-name=trippilot → anote URL
6. Commit: chore(release): novidades no Sobre + pipeline de deploy (0.8.3)
```

---

## FASE 1 — CAPTURA RÁPIDA + SAÍDA v2

> Princípio: é o uso DIÁRIO. Tudo aqui vive em `QuickAddPage.tsx`, `OutingPage.tsx`/`BarModeView.tsx`, `domain/outing/outing.ts`, `domain/transactions/`, e o simulador. NÃO toca onboarding/nav (isso é a Fase 2).

### GATE 1 — Captura no QuickAdd → versão 0.8.4

Arquivo central: `src/features/expenses/QuickAddPage.tsx` (`amount` é `type="number"` + `toCents(parseFloat(amount))`).

#### M1 — Campo de valor vira calculadora
- **O quê**: o campo de valor aceita expressão (`12+3,50`, `10*2`, `5+5+2`). Avalia no save (e no preview já existente).
- **Onde**: `QuickAddPage.tsx` + helper puro `domain/money/` `evaluateAmountExpression(raw): number | null` (parser seguro: só dígitos, `+ - * /`, `.`/`,`; SEM `eval`).
- **DONE quando**: `12+3,50` salva €15,50; entrada inválida cai pro parse atual sem quebrar; `1.234,56` continua certo. Teste de parsing (`12+3,5`, `10*2`, `5,5`, `abc`).

#### M2 — Memória por descrição (sem IA)
- **O quê**: ao digitar a descrição, se já houve gasto com texto igual/parecido, sugere categoria/subcategoria/valor do último uso (1 toque preenche).
- **Onde**: `domain/transactions/` `suggestFromDescription(transactions, text)` (derivada das transações do `useAppData`; SEM tabela nova). UI: chip de sugestão sob o campo descrição.
- **DONE quando**: "café" pela 2ª vez sugere categoria/valor do anterior; aceitar preenche; nada grava até salvar. Teste da função pura.

#### M3 — Repetir / favoritos
- **O quê**: linha com os 3-4 gastos mais frequentes (descrição+categoria+valor) em 1 toque.
- **Onde**: `domain/transactions/` `getFrequentExpenses(transactions, n=4)`. UI: chips no topo do QuickAdd.
- **DONE quando**: chips aparecem após repetição; tocar preenche (não salva sozinho). Teste da função.

#### M4 — Transporte ida-e-volta
- **O quê**: ao salvar gasto `transport`, oferecer "ida e volta?" → duplica na hora.
- **Onde**: `QuickAddPage.handleSave` — BottomSheet "registrar a volta também?"; se sim, 2ª `registerExpense`.
- **DONE quando**: passagem de transporte oferece duplicar; sim=2 tx, não=1. Nunca bloqueia.

#### M5 — Aviso de anomalia
- **O quê**: valor ≥3× o `typicalValueCents` do perfil/categoria → confirma ("€180? seu normal é ~€6"). Pega erro de digitação. NUNCA bloqueia (DEC-053).
- **Onde**: `domain/transactions/` `detectAmountAnomaly(amountCents, typicalCents, factor=3)`. UI: BottomSheet (padrão do `showZeroBudgetConfirm`).
- **DONE quando**: ≥3× típico confirma; confirmar salva; sem dado prévio → sem aviso. Teste da função.

**Checkpoint Gate 1** → versão/deploy/novidades (0.8.4) → commit `feat(quick-add): calculadora, memória, favoritos, ida-e-volta, anomalia (0.8.4)`

### GATE 2 — Saída v2 → versão 0.8.5

Arquivos: `OutingPage.tsx`, `BarModeView.tsx`, `domain/outing/outing.ts` (`Session.quickAddValuesCents`, `findHighlightedQuickValueIndex`, `calculateNextDrinkImpact`).

#### M6 — Botões de valor viram "últimos usados"
- **O quê**: gastei €4,50 → o botão €5 vira €4,50 e fica reutilizável.
- **Onde**: `outing.ts` `updateQuickValuesFromItem(currentValuesCents, newItemCents)` (substitui o mais próximo, mantém ordem/tamanho); atualiza `session.quickAddValuesCents` no orquestrador de adicionar item.
- **DONE quando**: item de €4,50 reflete nos botões; highlight segue coerente. Teste (substitui o mais próximo, não duplica, mantém tamanho).

#### M7 — Repetir último item
- **Onde**: `OutingPage`/`BarModeView` botão que reusa o orquestrador com os dados do último `SessionItem`.
- **DONE quando**: cria item idêntico ao anterior; respeita compartilhamento.

#### M8 — Rodada
- **O quê**: botão "Rodada" lança N × preço médio de uma vez.
- **Onde**: `outing.ts` monta N itens via orquestrador; se compartilhada, `resolvePayerExpense`.
- **DONE quando**: "Rodada de 4" a €5 = €20; rodada dividida calcula certo (DEC-047/114). Testes: "rodada de 4 eu paguei" e "rodada dividida".

#### M9 — Rotação "quem paga a próxima"
- **Onde**: `suggestNextPayer(participants, sessionItems)`. UI: linha discreta na saída ativa (só ≥2 participantes).
- **DONE quando**: sugere o próximo após alguém pagar; é só sugestão. Teste da função.

#### M10 — Projeção temporal
- **O quê**: "no seu ritmo, em ~1h você chega no teto" (tempo desde `startedAt` + taxa). Só leitura.
- **Onde**: `outing.ts` `projectTimeToCeiling(currentTotalCents, ceilingCents, startedAt, now)` → minutos (null se não dá pra estimar). UI: linha na saída ativa (≥2 itens e ≥10 min).
- **DONE quando**: projeção coerente; some sem dados; nunca altera dados. Teste (ritmo conhecido → minutos esperados).

**Checkpoint Gate 2** → versão/deploy/novidades (0.8.5) → commit `feat(outing): últimos valores, repetir item, rodada, rotação, projeção (0.8.5)`

### GATE 3 — Extras + i18n + testes → FASE 1 COMPLETA → versão 0.9.0

#### M11 — (Opcional) Quick-add por voz
- **O quê**: "vinte e cinco euros mercado" → valor + categoria (Web Speech API + parser PT/EN/ES; sem IA). Fallback se a API não existe.
- **Onde**: `QuickAddPage` botão de microfone + `domain/transactions/` `parseVoiceExpense(transcript, lang)`.
- **DONE quando**: funciona onde há Web Speech; sem API → botão escondido (sem erro). **CORTÁVEL**: se passar de ~1 milestone de esforço, registre "M11 adiada (custo alto)" no log e siga.

#### M12 — Simulador: "pegar emprestado de amanhã"
- **O quê**: quando o gasto deixa hoje negativo, AVISO: "te deixa €8 negativo hoje; dá pra puxar de amanhã (se não for usar amanhã)". Aviso, NÃO bloqueio.
- **Onde**: `domain/budget/honest-friend.ts` + `SimulatorPage.tsx`.
- **DONE quando**: aviso aparece no cenário negativo com o trade-off; nunca impede. Teste da mensagem/limiar.

#### M13 — i18n (pt-BR + en + es) de todas as strings novas dos Gates 1-3.

#### M14 — Testes da Fase 1 (MUITOS)
- Cobrir TODAS as funções puras novas (parsing, memória, favoritos, anomalia, quick-values, rodada, rotação, projeção, simulador) + casos de borda. **Alvo: ≥18 testes novos na Fase 1.** Verde + typecheck + build.

**Checkpoint Gate 3** → versão/deploy/novidades (**0.9.0 — Fase 1**) → commit `feat(fase-1): captura rápida + saída v2 completa (0.9.0)`

---

## >>> TRANSIÇÃO FASE 1 → FASE 2 (continue — NÃO pare) <<<

A Fase 1 já está commitada e deployada (0.9.0) no checkpoint do GATE 3.

```
1. Confirme verde: npm run test + typecheck + build
2. Smoke golden-path: criar gasto · rodar uma saída · ver dashboard
3. Re-verifique 3 invariantes de estabilidade (itens 1, 3, 8 da ÂNCORA)
4. Escreva no STATE FILE um HANDOFF da Fase 2 (resumo Fase 1, estado, próximo = GATE 4 / M15)
5. CONTINUE direto no GATE 4. NÃO pare pra pedir OK.
   Exceção: se o contexto realmente esgotou (já houve resumo automático e respostas
   ficando genéricas), PARE LIMPO aqui (tudo já commitado/deployado) e escreva no fim
   do log: "Para retomar: chat novo → 'Leia phase-1-2-log.md + o pacote e execute do GATE 4'".
   O Julio retoma sozinho — sem precisar aprovar nada.
```

---

## FASE 2 — MODO SIMPLES + INÍCIO INTELIGENTE

> Princípio: a reorientação "duas portas". Vive em `AppSettings`, `OnboardingPage`, `BottomNav`, `router.tsx`, `DashboardPage` (variante), `SettingsPage`. NÃO altera a lógica financeira nem a captura da Fase 1 — só APRESENTAÇÃO.

### GATE 4 — Fundação do modo → versão 0.9.1

#### M15 — `appMode` em AppSettings
- **Onde**: `src/domain/types/app-settings.ts` (`appMode: 'simple' | 'complete'`, NÃO-indexado → SEM migração), seed default, repository, `AppDataProvider`.
- **DONE quando**: persiste e é lido via contexto; backups antigos sem o campo assumem default seguro (`complete`). Teste do default.

#### M16 — Onboarding de 1 pergunta + escolha simples/completo
- **O quê**: caminho mínimo "Quanto você tem e até quando?" → cria viagem+fase+fundo+diária (reusa `createOnboardingEntities`). No fim: **"Começar simples (vai adicionando depois) ou completo?"** → seta `appMode`.
- **Onde**: `OnboardingPage.tsx` + `domain/onboarding/onboarding.ts`.
- **DONE quando**: cria viagem com 1 pergunta e cai no dashboard; modo gravado; onboarding ATÔMICO (transação — BUG-013). Teste do fluxo.

#### M17 — Defaults inteligentes por preset
- **Onde**: `domain/profiles/profile-presets.ts` (defaults typical/safe/ritmo/dias de pico/% reserva por tipo família/urbana/festival) + uso no onboarding.
- **DONE quando**: preset preenche valores plausíveis; usuário ajusta; nada forçado. Teste dos presets.

**Checkpoint Gate 4** → versão/deploy/novidades (0.9.1) → commit `feat(simple-mode): appMode, onboarding 1-pergunta, defaults por preset (0.9.1)`

### GATE 5 — UI do modo → versão 0.9.2

#### M18 — Dashboard simples
- **O quê**: `appMode==='simple'` → dashboard com 1 número grande ("livre hoje") + 1 botão "registrar" + essencial; esconde planner/forecast/cards avançados.
- **Onde**: `DashboardPage.tsx` variante condicional (reusa os componentes extraídos no fix BUG-008; mesma matemática, só mostra menos).
- **DONE quando**: simples = enxuto, completo = atual, mesma base de dados. Teste de render condicional.

#### M19 — Navegação mode-aware
- **Onde**: `src/components/BottomNav.tsx` (lê `appMode`). Esconde Planner/Perfis/Simulador/entrada de Saída no simples.
- **DONE quando**: abas avançadas somem no simples, voltam no completo; sem layout quebrado.

#### M20 — Guardas de rota
- **O quê**: deep-link a rota "completa" no simples → redireciona pro dashboard com "abrir mesmo assim" (nunca apaga/bloqueia — ÂNCORA 9).
- **Onde**: `router.tsx` guard usando `<Navigate>` (ÂNCORA 5).
- **DONE quando**: rota completa no simples redireciona com escape hatch; rotas seguem existindo. Teste do guard.

#### M21 — Toggle "mudar de modo" em Settings
- **Onde**: `SettingsPage.tsx` (alterna simple/complete + microcopy).
- **DONE quando**: trocar reflete em nav + dashboard sem reload destrutivo.

**Checkpoint Gate 5** → versão/deploy/novidades (0.9.2) → commit `feat(simple-mode): dashboard simples, nav/rotas mode-aware, toggle (0.9.2)`

### GATE 6 — Adaptativo + polish + i18n + testes → FASE 2 COMPLETA → versão 0.10.0

#### M22 — Revelação adaptativa
- **O quê**: após N gastos no simples, card discreto oferece desbloquear um recurso ("ativar o Modo Saída?"). Opt-in, dispensável.
- **Onde**: card no dashboard simples + flag em AppSettings (não repetir).
- **DONE quando**: oferta aparece após o gatilho, uma vez, dispensável; aceitar leva ao recurso.

#### M23 — Empty states / microcopy do modo simples (tom "amigo sincero").

#### M24 — i18n (pt-BR + en + es) de tudo da Fase 2.

#### M25 — Testes da Fase 2 (MUITOS)
- appMode default/persistência, onboarding mínimo atômico, presets, guard de rota, render condicional, toggle. **Alvo: ≥12 testes novos na Fase 2.** Verde + typecheck + build.

**Checkpoint Gate 6** → versão/deploy/novidades (**0.10.0 — Fase 2**) → commit `feat(fase-2): modo simples + início inteligente completo (0.10.0)`

---

## GATE 7 — TESTES FINAIS + BRAIN + DEPLOY FINAL → versão 0.10.1

```
1. TESTES (MUITOS — o pacote inteiro)
   a) npm run test → TODOS verdes (baseline + ≥30 novos das Fases 1 e 2)
   b) npx tsc --noEmit → 0 | npm run build → sem aviso de chunk > 500 KB
   c) Conte os testes novos do pacote

2. SMOKE (golden path completo)
   a) Onboarding 1-pergunta → simples → dashboard enxuto
   b) Gasto com calculadora + memória/favoritos
   c) Saída: últimos valores, rodada, projeção temporal
   d) Troca pra completo → planner/saída/simulador voltam
   e) Estabilidade: cold start com dados → dashboard (não onboarding)
   f) Sobre → versão 0.10.x + lista de Novidades acumuladas

3. BRAIN (registrar as features como DECs aprovadas)
   - decision-log.md → 1 DEC por feature relevante (calculadora, memória, favoritos,
     anomalia, saída v2/rodada/projeção, appMode/modo simples, onboarding 1-pergunta,
     defaults por preset, revelação adaptativa, tela de novidades)
   - project-status.md → Fases 1 e 2 implementadas + versões
   - product-spec.md → comportamento novo visível (modo simples, captura rápida, novidades)
   - feature-expansion-master-plan-2026-06-13.md → marcar Fases 1 e 2 como FEITAS

4. DEPLOY FINAL
   - Bump 0.10.0 → 0.10.1 (package.json + app-version.ts) + entrada de novidades
   - npm run build → npx wrangler pages deploy dist --project-name=trippilot → URL
   - commit: chore(release): pacote 1 finalizado (0.10.1)

5. ENTREGA (resumo pro Julio)
   - Tabela M0..M25 com status + arquivo(s) tocados
   - Testes: novos / total | chunks | TODAS as URLs de deploy por versão
   - DECs registradas | M11 (voz): feita ou adiada?
```

---

## PROTOCOLO DE CHECKPOINT (fim de CADA gate)

```
GATE [N] CONCLUÍDO
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Milestones: [M.. ✅] | Arquivos: [lista]
Testes: X total (Y novos) | Build ✅ | Typecheck ✅
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
1. Leia TripPilot/src/phase-1-2-log.md → Fase/Gate/Milestone ativo + handoff
2. Releia a ÂNCORA + a seção do gate ativo NESTE arquivo + a seção VERSÃO/DEPLOY/NOVIDADES
3. Releia o epic correspondente no master plan se precisar de contexto de produto
4. npm run test → confirme o estado real | confira a versão atual em app-version.ts
5. Continue do último checkbox aberto — NUNCA refaça gate concluído
```

---

## CRITÉRIO DE PARADA

```
DONE quando TUDO = TRUE:
- [ ] M0..M25 com "DONE quando" confirmado (M11 voz pode estar adiada)
- [ ] Captura: calculadora, memória, favoritos, ida-e-volta, anomalia
- [ ] Saída v2: últimos valores, repetir item, rodada, rotação, projeção
- [ ] Simulador: aviso "pegar de amanhã" (não bloqueia)
- [ ] Modo simples: appMode, dashboard enxuto, nav/rotas mode-aware, toggle
- [ ] Onboarding 1-pergunta atômico + escolha de modo + defaults por preset
- [ ] Revelação adaptativa | Tela de Novidades no Sobre
- [ ] NENHUMA regressão de estabilidade (itens 1-7 da ÂNCORA)
- [ ] i18n pt/en/es em tudo | tokens (zero cor hardcoded)
- [ ] Cada gate gerou versão + deploy + entrada de novidades (8 deploys: 0.8.3 → 0.10.1)
- [ ] Testes ≥ baseline + ≥30 novos, verdes | typecheck/build limpos
- [ ] Brain atualizado (DECs) | Deploy final no ar com URL
```

---

## COMECE AGORA

```
1. GATE 0: baseline + Novidades no Sobre + confirma pipeline de deploy (0.8.3)
2. FASE 1 (Gates 1-3): captura + saída v2 — deploy a cada gate (0.8.4, 0.8.5, 0.9.0)
3. TRANSIÇÃO: Fase 1 verde/deployada → handoff → CONTINUE (não pare)
4. FASE 2 (Gates 4-6): modo simples + início inteligente (0.9.1, 0.9.2, 0.10.0)
5. GATE 7: testes finais + brain + deploy final (0.10.1)
```

**Roda TUDO sozinho. Deploy + versão + novidades a cada gate. Só para se o contexto esgotar — e aí para limpo. GO.**
