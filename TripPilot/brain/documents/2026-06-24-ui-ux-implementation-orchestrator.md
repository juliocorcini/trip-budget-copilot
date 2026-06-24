# TripPilot — Orquestrador de Implementação UI/UX (a única fonte de verdade de execução desta leva)

> **Última atualização:** 2026-06-24 · **App:** 0.99.50 → **0.99.57 (FAZER batch shipped)**
> **Status:** ✅ **DONE — G1→G7 all shipped** (0.99.51→0.99.57; DEC-285→294 all APPROVED). The **9 §16 questions**
> were answered by Julio (2026-06-24) and locked into decisions (§16 + §7, **DEC-285→294**); the gate order was
> ratified by **Council C5** (single-session). Every gate green (unit 2166/2168 — only the 2 documented WebCrypto
> baseline fails) + deployed to Pages. Only the on-device manual matrix (§15) remains ⏳ (sandbox has no device/
> Playwright browsers). Backlog parked: M07/M08, M16-density, M14, full closing M17 (post-validation). Este é o documento-mestre de execução para a leva de UI/UX decidida em
> `documents/ui-ux-change-checklist-2026-06-23.md`. Um novo chat pega este doc e implementa de ponta a ponta — **sem
> perguntar nada** (ambiguidade → council inline + `DEC-NNN` + segue).
>
> **Irmão de** `implementation-prompt.md` (o build original do TripPilot, padrão Tier-3 que provou esse formato) e
> **modelado** nos dois orquestradores do FestPilot (`2026-06-23-v1-implementation-orchestrator.md` +
> `2026-06-24-v1-review-remediation-orchestrator.md`). Aqueles construíram/consertaram apps inteiros; **este aplica
> uma leva de UI/UX a um app já maduro e no ar.** Mesmo contrato de autonomia, mesma disciplina de git/teste/deploy.
>
> **Fonte desta leva:** o checklist mestre (`ui-ux-change-checklist-2026-06-23.md`) + a "Validação — rodada
> 2026-06-24" (telemetria real + walkthrough especialista) que está no fim daquele doc. Ambos foram destilados aqui
> em **gates testáveis com critérios de aceite (AC)** e, principalmente, num **root-cause map (código ↔ mudança)**
> (§6) para o implementador ir direto ao arquivo certo.
>
> **Como ler o resto:** o brain é a verdade de *produto* (`product-spec.md`, `decision-log.md`,
> `technical-direction.md`). O checklist é a verdade do *escopo decidido*. **Este documento é a verdade de
> *execução*:** a ordem, o diagnóstico, a mudança, os testes, os deploys, os commits. Quando faltar detalhe de
> produto, ele aponta a seção exata do brain; quando a pergunta for "o que eu mudo e em que ordem", a resposta é *aqui*.

---

## 0. Missão (leia primeiro)

Você é um engenheiro full-stack sênior **aplicando a leva de UI/UX do TripPilot de ponta a ponta, sozinho, nesta
sessão**. O app **já existe, está testado e no ar** (0.99.50). Seu trabalho **não** é reconstruir nada: é
**aplicar mudanças de legibilidade, acessibilidade, clareza e consolidação** que o checklist decidiu,
**preservando tudo que já funciona e já está bonito**, em ordem de risco (global/baixo-risco → clareza → estrutural),
sem parar entre unidades de trabalho.

**Lembrete de uma linha do que é o TripPilot:** um copiloto de orçamento de viagem (e "Dia a dia"), local-first
(Dexie/IndexedDB), com captura de gastos (manual/IA/OCR), fases de viagem, fundos/potes, divisão de conta,
simulador, conversor, comparador, e um Copiloto de insights com a voz "Amigo Sincero". Tom caloroso e anti-culpa.

**Diretriz desta leva (palavras do Julio, normalizadas):**

> "Deixar o app mais *sleek*, menos confuso e mais bonito, sem quebrar o que é bom. Primeiro a legibilidade e a
> acessibilidade (são baratas e globais), depois o 'primeiro minuto' (a tela inicial tem opções demais), e juntar
> as telas de viagem que se sobrepõem. Nunca um botão/ícone sem ação; nunca texto que assusta sem motivo."

**Vá para §17 para começar.** Tudo entre aqui e lá é o contrato sob o qual você executa.

---

## 1. Identidade & regras absolutas (contrato de autonomia)

Você é o **executor**, não um coordenador. Você implementa, testa, faz deploy e commita você mesmo.

**REGRAS ABSOLUTAS — nunca violar** (espelham `.cursor/rules/inline-council-no-subagents.mdc`,
`tech-lead-delegation.mdc`, `execution-style.mdc`, `phase-delivery-hardening.mdc`, `velocity-standard.mdc`):

1. **SEM subagents / SEM Task tool / SEM delegação.** Tudo inline, nesta sessão. Múltiplas perspectivas =
  múltiplas *seções de uma resposta*, nunca múltiplos agentes. (Custo = por request; um subagent = +1 request.)
2. **NÃO peça permissão para avançar entre unidades de trabalho.** O escopo está especificado aqui + no checklist +
  nas respostas da §16. Terminar uma milestone/gate é a deixa para **commitar, fazer deploy, atualizar o dev-log e
   começar a próxima** — não para parar.
   *(Exceção de hand-off — `always-end-with-askquestion.mdc` + `never-end-chat.mdc`:* nunca pause **no meio** do
   build, mas no **hand-off genuíno** — todos os critérios de §12 TRUE, **ou** um bloqueador de credencial/custo
   intransponível, **ou** o contexto realmente acabar — a **mensagem final termina com um `AskQuestion`** oferecendo
   próximos passos.)
3. **NÃO pare porque "é muito trabalho" ou "a conversa está longa".** Continue até §12 ser toda TRUE, ou até o
  contexto acabar de verdade (então feche o gate atual limpo, commit + deploy, escreva o handoff no dev-log e PARE LIMPO).
4. **NÃO resuma o que vai fazer — FAÇA.** Minimize narração; cada token conta numa sessão longa.
5. **Todo código, identificadores, comentários, mensagens de commit, nomes de arquivo → inglês.** Texto de UI →
  pt-BR via i18n (`t()` sempre, zero hardcode). Este documento e o brain são em português; código é inglês.
6. **Domínio antes de UI**, uma mudança por vez, **teste junto com a mudança** (§8).
7. **Reuse o código existente — nunca reinvente** o que a §4 diz que já funciona. Extender > criar.
8. **Respeite a segurança de pager do WSL** (§11): sempre `git --no-pager …`, sempre `git commit -m`, nunca abra
  `less`/`vim`/flags interativas no terminal do agente.
9. **Mantenha o brain em sincronia** (§14): atualize `src/dev-log.md` a cada milestone, `decision-log.md` em
  qualquer decisão nova, `project-status.md` no fim da leva, e o `ui-ux-change-checklist-2026-06-23.md` (marque o
   item como ✅ feito).

Se aparecer ambiguidade genuína que o brain não resolve: **rode o council inline na hora** (1 request, sem
subagents), pegue a síntese, **escreva como `DEC-NNN` (PROPOSED)** no `decision-log.md` **e continue**. Não bloqueie.
*(Nesta leva específica, as dúvidas de produto já foram pré-pesquisadas em §16 — leia as respostas do Julio antes de
começar; se ele não respondeu, adote a Recomendação da §16 como o default.)*

---

## 2. Ordem de leitura (carregue o contexto uma vez, depois execute)

No **início da leva**, leia (nesta ordem):

1. **Este documento** §0–§9, depois o gate em que está em §10.
2. `ui-ux-change-checklist-2026-06-23.md` — o item M-NN do gate + a seção "Validação — rodada 2026-06-24".
3. `src/dev-log.md` — o estado de execução (semeado em G0).
4. `brain/decision-log.md` — só os `DEC-NNN` citados pelo gate (esp. DEC-176, DEC-249, DEC-251, DEC-256, DEC-265,
  DEC-278, DEC-283/284, e os **novos DEC-285→DEC-29x** desta leva — §7).
5. `brain/documents/design-system.md` + `src/styles/tokens.css` + `src/styles/globals.css` ao mexer em
  tokens/cores/foco (G1).

Não releia o brain inteiro por milestone. Leia uma vez, depois confie no dev-log + neste doc + no root-cause map (§6).
**Mas leia o arquivo citado no §6 ANTES de editá-lo** (os símbolos podem ter mudado).

---

## 3. Não-negociáveis (releia antes de CADA gate)

Invariantes desta leva. Quebrar um é defeito mesmo que os testes passem.

**Herdados do app (ÂNCORA — continuam absolutos):**

- **Dinheiro = inteiro em centavos** (DEC-020). **Domínio = TS puro, zero import de React**; nenhuma lógica de
negócio dentro de componente.
- **Texto de UI sempre via `t()`** (DEC-054), três idiomas (pt-BR/en/es) quando o item tiver cópia.
- **ÂNCORA 9: esconder, nunca deletar** — nenhuma ação/feature some; no máximo muda de lugar/hierarquia.
- **Nunca bloquear o registro de gasto** (DEC-053). **Honestidade da matemática** (empate técnico, recusa de
dimensões mistas, idade da cotação, cooldown honesto) — preservar.
- **Sistema de movimento** (60fps, `prefers-reduced-motion` já honrado em `globals.css`), **tokens de tema**,
`tabular-nums`, nav "glass" — preservar.
- `**/guide` + `/help`** (modelo de clareza), **voz de marca calorosa/anti-culpa, streaks, "Amigo Sincero"**,
modo **simples/completo**, as **4 portas do Welcome** — preservar.
- **DEC-176:** o lembrete de backup **já saiu da home** (vive nas notificações) — não reintroduzir na home.

**Novos, derivados desta leva:**

- **Sem dead affordance.** Todo botão/ícone/pílula ou faz algo claro ou é rotulado/removido.
- **Sem susto evitável.** "€0 da fase" e afins ganham frase que orienta, não que assusta.
- **AA em texto pequeno e no CTA primário** (M02) — é o objetivo "mais sleek/legível" do Julio.
- **Foco de teclado visível** em todo o app (M01) — um único `:focus-visible` global; **toque (mobile) não muda**.
- **Acento de IA é tokenizado** (`--ai`/`--ai-2`), nunca hard-coded, e herda no tema claro (M12).
- **Preserve o que já está bonito.** Polimento visual é dentro do componente que você já está tocando.

---

## 4. Baseline — onde o app REALMENTE está (NÃO reconstruir)

> Verificado da árvore-fonte, 2026-06-24. Trate como pronto; **ajuste, não recrie.**

**App:** `TripPilot/` — Vite 6 + React 19 + TS estrito + Tailwind 3 + i18next + react-router 7 + Dexie 4 (local-first,
sem backend de dados). Capacitor 8 (Android) + OTA via Capgo. Versão **0.99.50**. Testes: Vitest (unit/componente) +
Playwright (e2e). Worker Cloudflare só para IA-proxy (Groq) + telemetria DEC-248; dados ficam no device.

**Scripts (de `TripPilot/`):** `npm run dev`, `npm run build` (`tsc -b && vite build`), `npm run test` (vitest),
`npm run test:e2e` (playwright), `npm run typecheck`, `npm run lint`. Deploy: `build:pages` gera o bundle OTA;
push em `master` → Cloudflare Pages auto-build; **bump `public/version.json`** é o que atualiza o OTA (DEC-280).

**Arquivos-chave desta leva** (detalhe no §6): tokens/CSS `src/styles/{tokens,globals}.css`; nav
`src/components/BottomNav.tsx`; FAB `src/components/FAB.tsx`; dashboard `src/features/dashboard/{DashboardPage, OngoingHome,SimpleHome,DashboardCards,useDashboardModel}.tsx`; viagem `src/features/trip/{TripHubPage, TripOverviewPage,TripEditPage}.tsx` + `src/app/router.tsx`; welcome `src/features/onboarding/WelcomePage.tsx`;
planner `src/features/planning/PlannerPage.tsx`; conversor `src/features/converter/ConverterPage.tsx`; split
`src/features/split/SplitTablePage.tsx`; comparador `src/features/comparator/ComparatorPage.tsx`; ajuda
`src/domain/help/help-catalog.ts`; chip de contexto `src/features/spaces/SpaceSwitcherChip.tsx`.

**Correções de premissa do audit (VERIFIED 2026-06-24 — importante):**

- **M01:** `focus:outline-none` (forma citada pelo audit) = **0 hits**. O padrão real é a utility Tailwind
`outline-none` (sem prefixo `focus:`) em muitos inputs, e **não existe nenhuma regra `:focus-visible`** em
`globals.css`/`tokens.css`. O problema é real; a forma muda.
- **M19:** `transition: all` (CSS) = **0 hits**. O real são **8 usos da utility `transition-all`** (a contagem "8
arquivos" do audit bate) em: `QuickAddPage`, `OngoingHome`, `AmigoSinceroCard`, `OnboardingPage`, `BackupPage`,
`FastScroller`, `HelpMode`, `SyncTransferFlow`.
- **M12:** o acento de IA é hard-coded (`#6366F1`/`#818CF8`/`#8B5CF6` + gradiente) em **9 arquivos**; **não existe**
token `--ai`. Confirmado.
- **M09:** o `SpaceSwitcherChip` **já existe** (mostra o nome do espaço, abre `/spaces`); falta o **rótulo de modo**.
- `**user-select:none` JÁ está** no `body` (`tokens.css`) com inputs reabilitados — a higiene "app-feel" do FestPilot
R10.4 **já está feita** aqui; não refazer.
- **Telemetria DEC-248** NÃO mede Simulador/Comparador/FAB-por-ação nem funil de captura (ver §A da Validação). Onde
o checklist pedia "dado real", use o walkthrough/teste de 5 usuários (§15), não a telemetria.

---

## 5. O change-set, normalizado: prioridades

Ordem da leva (ratificada pelo **Council C5**, §7 — otimizada p/ **sessão única**): **fundações a11y/legibilidade
(G1) → estrutural M15 (G2) → onboarding multi-espaço (G3) → primeiro minuto/Dashboard (G4) → voz & momentos (G5) →
ferramentas/polish (G6) → divisão (G7)**. Lógica/fluxo mais pesados primeiro, com contexto fresco (DEC-280);
polimento e split por último. Não pule para polimento visual antes de a legibilidade/estrutura estarem certas.

- **FAZER nesta leva (checklist + §16 lockada):** M01, M02, M03 (carrossel de alertas — §16-Q9), M04 (promover o
existente — §16-Q3), M05, M06, M09, M10 (ajuste + carrossel — §16-Q9), M11, M12, M13, M15, **M16b** (voz do Amigo
Sincero — §16-Q6), **M17-lite** (recap leve reusando `OutingReviewPage` — §16-Q5), M18 (legibilidade **+ selo** —
§16-Q7), M19, M20, M21, M22, M23, M24, M25, **+ onboarding multi-espaço no Welcome** (viagem×dia-a-dia + rebaixar
backup/demo/receber — §16-Q4 → DEC-290).
- **Resolvidos na §16 (lockados 2026-06-24):** M02-CTA = **branco no CTA** (Q2); M04 = **promover o existente** (Q3);
M03/M10 = **carrossel, sem remover nada** (Q9); M16b = **sim** (Q6); M17 = **recap leve agora**, fechamento completo
pós-validação (Q5); M18 = **legibilidade + selo** (Q7); ordem dos gates = **Council C5** (Q8).
- **Fora desta leva:** **M07** (hierarquia do FAB — **DEPOIS**, §16-Q1), M08 (NÃO), M14 (DEPOIS), M16-densidade
(DEPOIS — só a *voz* M16b entra agora), M17-fechamento-completo (pós-validação com o kit §15/D).

---

## 6. Root-cause map (código ↔ mudança) — comece aqui em CADA item

> O coração da leva. Cada linha = um item do checklist, sua **causa-raiz confirmada no código real** (arquivo →
> símbolo, **não** número de linha — eles mudam), e a direção da correção. Os gates em §10 expandem em AC + testes.
> **Leia o arquivo citado antes de editar.**


| #   | Item / achado                                                  | Causa-raiz (arquivo → símbolo)                                                                                                                                                                                                                                                               | Direção da correção                                                                                                                                                                                                                                                                                                       | Gate |
| --- | -------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---- |
| M01 | Sem foco de teclado visível (WCAG 2.4.7)                       | `src/styles/globals.css` (nenhuma regra `:focus-visible`); utility `outline-none` espalhada em inputs/botões. Token `--glow` (#EDE8E060) existe e serve de anel.                                                                                                                             | **Uma** regra global `:focus-visible` em `globals.css` (anel `--glow`/`--primary`, theme-aware). Toque não muda. ~10 linhas.                                                                                                                                                                                              | G1   |
| M02 | Texto pequeno + CTA terracota abaixo de AA                     | `src/styles/tokens.css` → `--on-surface-faint` (#EDE8E070 ≈3.79:1), `--primary` (#C75B39; creme no CTA ≈3.46:1), `--error` (#D94040 ≈4.19:1). CTAs são inline `bg-primary text-on-surface`.                                                                                                  | (a) subir alpha de `--on-surface-faint` p/ ≈`80`; (b) CTA = **branco puro** sobre primary (council C2 / §16-Q2); (c) revisar `--error`. Só tokens + uma classe de CTA.                                                                                                                                                      | G1   |
| M11 | Aba ativa só por cor; sem `aria-current`                       | `src/components/BottomNav.tsx` (`.nav-ind` por `--primary`; `aria-current` = 0 hits no app)                                                                                                                                                                                                  | `aria-current="page"` na aba ativa + reforço não-cromático (peso/indicador já existe). XS.                                                                                                                                                                                                                                | G1   |
| M12 | Acento de IA hard-coded e não documentado; risco no tema claro | `#6366F1/#818CF8/#8B5CF6` + gradiente em 9 arquivos: `FAB`, `AssistantSheet`, `ComparatorPage`, `ExpenseListPage`, `QuickAddPage`, `SplitHistorySheet`, `ActiveSplitHomeCard`, `SplitResumeSheet`, `ActiveSplitBar`                                                                          | `--ai`/`--ai-2` (+ `--ai-gradient`) em `tokens.css` (2 temas), trocar os 9 hard-codes, documentar no design-system ("terracota=marca; índigo=IA").                                                                                                                                                                        | G1   |
| M19 | Anti-padrão `transition-all`                                   | 8 usos da utility `transition-all` (NÃO a forma CSS): `QuickAddPage`, `OngoingHome`, `AmigoSinceroCard`, `OnboardingPage`, `BackupPage`, `FastScroller`, `HelpMode`, `SyncTransferFlow`                                                                                                      | Trocar cada `transition-all` por `transition-[transform]`/`opacity`/`colors` específico.                                                                                                                                                                                                                                  | G1   |
| M03 | Banners do topo empilham; demo polui o 1º olhar        | `src/features/dashboard/DashboardPage.tsx` → demo banner (`settings.isDemo`), `LocationDefaultNoticeCard`, storage warning (`showStorageWarning`). Backup já fora da home (DEC-176).                                                                                                         | Topo vira **1 carrossel de alertas** (não remove nada — Â9; §16-Q9 + DEC-293); no demo, suprimir/colapsar o banner; condicionar location/storage a risco real; polish do header/hero. **Não** depende de Settings (≠ Welcome).                                                                                                                                        | G4   |
| M04 | "Livre hoje: €X" como pergunta-âncora                          | Número **já existe**: `SimpleHome` ("Livre hoje") + `DashboardCards` hero ("Livre para usar nesta fase") via `useDashboardModel` (`freeTodayCents`). Nota l.105 do checklist: novo número duplica.                                                                                           | **Promover o número existente** + 1 linha de razão + atalho "posso gastar ___?" → `/simulator` pré-preenchido. **Sem** número novo; regra "um 'livre' por tela". (§16-Q3.)                                                                                                                                               | G4   |
| M06 | "Livre da fase: €0" lido como "estou quebrado"                 | a cifra €0 da fase no hero (`DashboardCards`/`useDashboardModel`)                                                                                                                                                                                                                            | Trocar o "€0" cru por frase tranquilizadora/acionável quando a fase está toda planejada (microcópia + condição).                                                                                                                                                                                                          | G4   |
| M10 | Topo pede várias decisões juntas                               | `DashboardPage.tsx` (chip + banners + header + `ActiveSplitHomeCard` + check-in) — **já condicional** (Julio: "não ficam todas ao mesmo tempo")                                                                                                                                              | Ajuste leve: 1 ação primária por estado + **carrossel** p/ o resto (nada some — §16-Q9 + DEC-293); validar (5-second, §15).                                                                                                                                                                                                          | G4   |
| M09 | "Modo" é conceito de sistema; usuário não sabe onde está       | `SpaceSwitcherChip.tsx` (mostra nome do espaço, abre `/spaces`); eyebrow "Dia a dia" já existe; Planner já explica ausência por empty-state                                                                                                                                                  | Add rótulo de modo ("Dia a dia"/"Viagem: …") ao chip persistente; replicar o empty-state "explica ausência" onde uma tela some por modo.                                                                                                                                                                                  | G4   |
| M05 | Densidade de vocabulário; definições espalhadas                | **Não existe** registro de termos; `domain/help/help-catalog.ts` (DEC-278) é a KB; glosas hoje são inline                                                                                                                                                                                    | Novo `domain/help/glossary.ts` (termo→glosa→artigo) + um `<InfoDot>` tocável; ligar na 1ª aparição de cada conceito de dinheiro; deep-link p/ `/help`.                                                                                                                                                                    | G4   |
| M16b | Tons do "Amigo Sincero" quase iguais; não soa "amigo sincero" (§16-Q6) | `domain/budget/honest-friend-voice.ts` (+ `honest-friend-extras.ts`); a escolha de tom quase não muda o texto | Reescrever as strings p/ soar amigo sincero de verdade + fazer a escolha de tom **mudar o texto** (suave/sincero/escrachado distintos). Voz, não layout. DEC-291. | G5 |
| M17b | Fechamento "o fim que dá orgulho" — recap leve (§16-Q5) | Não há tela de fechamento; existe `OutingReviewPage` (resumo de saída) | **Recap leve** reusando `OutingReviewPage`/dados existentes (semente baixo risco). Fechamento completo fica **pós-validação** (kit §15/D). DEC-292. | G5 |
| M15 | `/viagem` × `/trip` se sobrepõem                               | `router.tsx` (`/trip`→`TripOverviewPage`, `/viagem`→`TripHubPage`, `/trip/edit`→`TripEditPage`; `/more`→`/viagem` redirect já existe). Único exclusivo do `TripOverviewPage` = share card (`buildShareCardStats`+`renderShareCard`+`deliverShareCard`, DEC-133) + `trip.overview_role_hint`. | Executar o **Apêndice — Plano de migração M15** do checklist: share card → header do Hub; `/trip`→`<Navigate to="/viagem" replace/>`; remover tile "Visão geral" do Hub; repointar Dashboard (nome-da-fase + insight `phase_countdown` em `handleInsightTap`) + Planner; i18n; testes; apagar `TripOverviewPage`; polish. | G2   |
| Onb | **Onboarding multi-espaço** no Welcome (viagem×dia-a-dia) + secundárias com peso de primárias (§16-Q4) | `WelcomePage.tsx` (4 portas de peso igual: criar viagem→`/onboarding`, importar backup, receber de device, demo; **só cria viagem**). Fork **Viagem×Dia a dia já existe** em `NewSpacePage` (`ForkCard`, `kind:'trip'\|'ongoing'`, `createOnboardingEntities`+`createTripFromOnboarding`; DEC-249/250/251). | Trazer o fork p/ o Welcome: **2 escolhas primárias** — "Criar viagem"→`/onboarding`; "Começar no Dia a dia"→criação ongoing reusando o caminho do `NewSpacePage`; **rebaixar** backup/receber/demo p/ tier secundário **no próprio Welcome** (não Settings); **+M20** (demo legível) **+M23** (linha de valor). DEC-290. | G3 |
| M13 | Tags "Opcional/Essencial" + cadeado sem explicação             | `src/features/planning/PlannerPage.tsx` (tags + lock + stepper desabilitado)                                                                                                                                                                                                                 | Microcópia/tooltip de 1 linha p/ tags + cadeado; estado desabilitado **com motivo** ("bloqueado: essencial").                                                                                                                                                                                                             | G6   |
| M22 | Pílula "Manual" do Planner sem rótulo                          | `PlannerPage.tsx` (a pílula "Manual")                                                                                                                                                                                                                                                        | Rotular "Modo: manual".                                                                                                                                                                                                                                                                                                   | G6   |
| M21 | Conversor abre EUR→EUR; placeholder "0" parece preenchido      | `src/features/converter/ConverterPage.tsx` (moedas default + placeholder "0" em `faint`)                                                                                                                                                                                                     | Abrir com **Para = moeda de casa**; placeholder "ex.: 2,50" com contraste melhor.                                                                                                                                                                                                                                         | G6   |
| M20 | Botão "Dados de demonstração" parece desabilitado (parte do Welcome)              | `src/features/onboarding/WelcomePage.tsx` → botão `load_demo` (`bg-surface-high text-on-surface-dim`)                                                                                                                                                                                        | Peso de botão secundário legível — **dentro do redesign do Welcome** (G3/DEC-290).                                                                                                                                                                                                                                           | G3   |
| M23 | Welcome sem linha de valor                                     | `WelcomePage.tsx` (só `welcome_subtitle` sob o título)                                                                                                                                                                                                                                       | 1 linha de benefício concreto (i18n) — **dentro do redesign do Welcome** (G3/DEC-290).                                                                                                                                                                                                                                                                                     | G3   |
| M24 | Resiliência ("funciona offline") invisível                     | global; ferramentas 0-token/offline reais mas não comunicadas                                                                                                                                                                                                                                | Selo discreto "funciona offline" onde faz sentido (ferramentas, cooldown de IA).                                                                                                                                                                                                                                          | G6   |
| M25 | Taxa de acerto da foto no Comparador                           | `src/features/comparator/ComparatorPage.tsx` (entrada por foto)                                                                                                                                                                                                                              | 1 linha ensinando a enquadrar a **etiqueta de preço**.                                                                                                                                                                                                                                                                    | G6   |
| M18 | Saldo da divisão sempre legível + selo "tudo acertado"         | `src/features/split/SplitTablePage.tsx` + fluxo de `Settlement`                                                                                                                                                                                                                              | **Construir os dois** (§16-Q7): legibilidade "você recebe/deve" + selo "tudo acertado ✓" quando o saldo zera.                                                                                                                                                                                  | G7   |


---

## 7. Decisões que esta leva adota + councils inline

> Estas resolvem tensões reais. São adotadas como **PROPOSED** em `decision-log.md` (esta leva usa **DEC-285→294**; 1º livre = **DEC-285**;
> o header do decision-log diz "next = DEC-281", mas DEC-281/282 foram consumidos pelo Gate 3 e DEC-283/284 já
> existem — o próximo genuinamente livre é **DEC-285**). Cada uma cita o que refina. **Os councils abaixo rodaram
> inline (1 request, sem subagents)** — só a síntese ficou registrada.

- **DEC-285 — Foco visível global (M01).** Uma regra `:focus-visible` em `globals.css` (anel `--glow`), theme-aware,
sem afetar toque. *(Implementa A-1/§3.3.)*
- **DEC-286 — Contraste AA (M02).** Subir `--on-surface-faint`; **CTA = branco puro sobre `--primary`** (não
escurecer o token — ver council C2); revisar `--error`. *(Implementa A-2/D-3/G-1.)*
- **DEC-287 — Token de IA (M12).** `--ai`/`--ai-2`/`--ai-gradient` em `tokens.css`; documentar no design-system.
- **DEC-288 — Consolidação `/viagem`×`/trip` (M15).** Share card → header do Hub; `/trip` redireciona; `TripOverviewPage`
é aposentado. *(Decidido pelo Julio 2026-06-24; refina a IA do redesign G1/DEC-249.)*
- **DEC-289 — Glossário por toque (M05).** Registro único `domain/help/glossary.ts` + `<InfoDot>`; deep-link p/ `/help`.
- **DEC-290 — Onboarding multi-espaço no Welcome (M-Onb, §16-Q4).** O Welcome passa a oferecer **2 escolhas
primárias** — "Criar viagem" (→`/onboarding`) e "Começar no Dia a dia" (criação `kind:'ongoing'` reusando o caminho
do `NewSpacePage`) — e **rebaixa** importar-backup / receber-de-device / demo a um **tier secundário no próprio
Welcome** (não Settings; pré-onboarding não tem Settings). Inclui M20 (botão demo legível) + M23 (linha de valor).
Fundamento: o fork Viagem×Dia-a-dia **já existe** em `NewSpacePage` (DEC-249/250/251) — isto leva-o ao 1º acesso.
*(Refina o onboarding; corrige a premissa "mover p/ Settings" da §16-Q4.)*
- **DEC-291 — Voz do Amigo Sincero de verdade (M16b, §16-Q6).** Reescrever as strings de `honest-friend-voice.ts`
(+ `-extras.ts`) p/ soarem um amigo sincero, e fazer a **escolha de tom mudar o texto** (suave/sincero/escrachado
realmente distintos). Voz/conteúdo, não densidade (M16 segue DEPOIS).
- **DEC-292 — Recap leve de fechamento (M17-lite, §16-Q5).** Construir um **recap mínimo** reusando `OutingReviewPage`/
dados existentes (baixo risco). O fechamento completo "o fim que dá orgulho" continua **pós-validação** (kit §15/D).
- **DEC-293 — Topo do Dashboard como carrossel (M03/M10, §16-Q9).** Os alertas/insights do topo passam a **rotacionar
num único slot** (padrão já usado pelo Amigo Sincero) em vez de empilhar — **nada some** (Â9); 1 ação primária por estado.
- **DEC-294 — Divisão: legibilidade + selo (M18, §16-Q7).** Construir **os dois**: "você recebe €X / você deve €Y"
sempre legível **e** o selo "tudo acertado ✓" quando o saldo zera.

> **§16 respondida pelo Julio em 2026-06-24** — estas decisões estão **lockadas**. Q1: M07 **DEPOIS**. Q2: branco no
> CTA. Q3: promover o nº existente. Q4: onboarding multi-espaço + rebaixar secundárias (DEC-290). Q5: recap leve
> (DEC-292). Q6: M16b sim (DEC-291). Q7: legibilidade + selo (DEC-294). Q8: ordem via Council C5. Q9: carrossel (DEC-293).

### Council C1 — Abordagem do M04 (`/council`, 4 perspectivas)

*Inline nesta sessão (1 request, sem subagents).*

**Decision Brief (neutro):** O job nº1 do usuário é "posso gastar agora sem me ferrar?". O número que responde isso
(`freeTodayCents`) **já é calculado e exibido** ("Livre hoje" no modo simples; "Livre para usar nesta fase" no hero
completo). O checklist pediu colocar "Livre hoje: €X" no topo — mas a nota l.105 alerta que isso **duplicaria**.
Viés a resistir: "feature nova é mais impressionante". Opções: (A) promover/elevar o número existente + atalho
"posso gastar?"; (B) faixa nova sempre-visível acima dos cards; (C) só adicionar o atalho ao Simulador.

- **Strategist** — O valor está no *momento de alívio* chegar primeiro, não em um widget novo. Reusar o número que o
domínio já calcula evita dívida e mantém uma só verdade. **Rec:** A. **Conf:** ALTA. **Outros perdem:** duplicar o
número cria duas "verdades" que podem divergir em modos diferentes.
- **Architect** — `freeTodayCents` vem do `useDashboardModel`; expô-lo já é trivial. Uma faixa nova (B) significa
novo estado/condição em 3 layouts (simple/complete/ongoing). A reusa caminhos testados. **Rec:** A. **Conf:** ALTA.
**Outros perdem:** o "Dia a dia" não tem fase — uma faixa "livre da fase" quebraria lá; A respeita isso.
- **Critic** — O risco real do M04 é *redundância visual* (dois "livres" na mesma tela) e o atalho do Simulador
abrir vazio. Qualquer opção tem que **deduplicar** primeiro. **Rec:** A, com regra "um número de 'livre' por tela".
**Conf:** MÉDIA. **Outros perdem:** sem o first-click test (§15), a gente não sabe se o usuário olha pro número ou
procura um botão.
- **Advocate (usuário)** — O usuário quer *uma resposta e um caminho*: "tenho €X; posso gastar isto?". O número +
um atalho que abre o Simulador pré-preenchido é exatamente o fluxo mental. **Rec:** A + atalho. **Conf:** ALTA.
**Outros perdem:** a "razão" (1 linha) é o que transforma número em permissão — não cortar.

**Red Team (matar a opção líder A):** se o número existente estiver visualmente fraco/enterrado, "promover" sem
redesenho não resolve a percepção — o usuário continua não vendo. Mitiga: o polish de M03/M02 sobe o contraste/hero
no mesmo gate, então A entra junto do realce.

**Síntese (Chair):** **Consenso:** A (promover existente + razão + atalho), nunca um segundo número. **Tensão:**
Critic quer validação antes; os outros topam construir A já porque é reuso de baixo risco. **Recomendação:** fazer
A em G2, com a regra "um 'livre' por tela", e rodar o first-click test (§15) **depois** para calibrar o realce — a
lente do Architect/Advocate pesa mais aqui porque A é reuso, não aposta. **Confiança:** ALTA. **Vira §16-Q3.**

### Council C2 — Contraste do CTA: escurecer token vs branco no botão (`/debate`)

**Brief:** creme sobre terracota = 3.46:1 (< AA). Duas saídas: (1) escurecer `--primary` ~6% no `tokens.css` (1
linha, mas muda **toda** uso de primary — ícones, `.nav-ind`, anéis, badges); (2) texto **branco puro** só nos CTAs
(`bg-primary`), via uma classe `.btn-primary` ou trocando `text-on-surface`→`text-white` nos botões primários.

- **Proponente (branco no CTA)** — Cirúrgico: corrige o contraste **onde o problema está** (texto sobre o botão)
sem mexer na identidade terracota em ícones/indicadores. Branco sobre #C75B39 ≈ 4.7:1 (passa AA). Uma classe nova,
reuso fácil.
- **Oponente (escurecer token)** — Um lugar só, consistência total, e o terracota fica levemente mais "sério".
Risco: muda a cor de dezenas de ícones/indicadores que hoje passam (nav 4.39:1) e podem ficar escuros demais no
tema claro.
- **Juiz** — O escopo do M02 é "CTA + faint + erro", não "rebrand". Escurecer o token tem blast radius alto e efeito
colateral no tema claro; branco-no-CTA é contido e reversível. **Decisão: branco puro no CTA** (+ subir faint +
nudge erro). Se o Julio quiser o terracota mais escuro como **escolha estética**, é outro item. **→ DEC-286; §16-Q2.**

### Council C3 — M17 "fechamento": validar antes vs construir agora (`/assess`)

**Brief:** M17 (fechamento de dia/rolê/viagem com resumo caloroso + micro-deleite) é **G/risco médio**, feature
**nova** (não existe tela de fechamento). Peak-End diz que é alto valor emocional. Mas é a aposta menos validada da
leva.

- **Risk Analyst** — Construir G às cegas arrisca esforço alto em algo que pode não ressoar; e mexe em
Dashboard/Viagem/Saídas (3 superfícies). Prob×impacto de retrabalho: médio-alto. Mitiga: validar conceito +
emotion-check (kit §15/D do checklist) antes.
- **Opportunity Scout** — É o maior gerador de recomendação espontânea (o "fim" fica na memória). Há um seed barato:
a saída **já tem** `OutingReviewPage` — um "fechamento" leve poderia reusá-la antes de construir o grande.
- **Cost Analyst** — Validar custa ~0 (mock + 5 pessoas). Construir o G completo custa o maior bloco da leva. ROI
manda validar primeiro e, se passar, construir num pacote próprio (não nesta leva de UI/UX).
- **Timeline Realist** — Enfiar um G novo nesta leva estoura o foco "legibilidade/clareza". Melhor: leva atual
entrega M01-M25; M17 vira pacote seguinte, **pós-validação**.

**Síntese:** **Validar antes** (consenso forte). Não construir o fechamento completo nesta leva. *Opcional* (se o
Julio topar): um recap mínimo reusando `OutingReviewPage`/dados existentes como semente de baixo risco. **→ §16-Q5.**

### Council C4 — M16 densidade vs textos do "Amigo Sincero" (quick council, 2)

**Brief:** M16 (reduzir parede de cards) está **DEPOIS**. Mas o Julio escreveu que **não gosta dos textos** do Amigo
Sincero (mesmo selecionando o tom escrachado, "não sinto diferença") — isso é **voz/conteúdo**, não layout.

- **Architect** — São dois problemas distintos com dois arquivos distintos: densidade = `DashboardCards` (layout);
voz = `domain/budget/honest-friend-voice.ts` (+ `honest-friend-extras.ts`). Misturar atrapalha. Separar.
- **Advocate** — O que dói pro usuário agora é o **tom** (ele não sente o "amigo sincero/escrachado"). Isso é barato
(reescrever strings + talvez intensidade por tom) e de alto retorno emocional. Densidade pode esperar (DEPOIS).

**Síntese:** **Separar.** Manter M16-densidade DEPOIS. Abrir **M16b — reescrever a voz do Amigo Sincero** (strings +
diferenciação real entre tons) como item próprio, pequeno, **se o Julio confirmar** que quer nesta leva. **→ §16-Q6.**

### Council C5 — Ordem dos gates p/ SESSÃO ÚNICA (§16-Q8) (`/council`, 4 + red team)

*Inline nesta sessão (1 request, sem subagents).*

**Decision Brief (neutro):** Tudo roda numa sessão só. A leva tem 7 blocos: fundações a11y (M01/02/11/12/19), M15
(estrutural), onboarding multi-espaço (Welcome), primeiro-minuto (Dashboard), voz & momentos (M16b/M17-lite),
ferramentas/polish, divisão (M18). Em sessão única o risco não é custo de request — é **deriva de contexto/qualidade**
ao longo de muitas edições. Viés a resistir: "fazer o mais bonito (Dashboard) primeiro". Pergunta: qual ordem
maximiza qualidade sem regressão?

- **Architect** — Fundações primeiro: os tokens (`--ai`, CTA branco, faint, focus-visible) são **consumidos** por
quase todos os gates seguintes; fazê-los antes evita repintar. Depois o trabalho de **fluxo/lógica mais pesado**
(M15 + onboarding) com o contexto fresco (DEC-280); Dashboard/voz/polish/split depois. **Rec:** G1→M15→onboarding→
dashboard→voz→ferramentas→split. **Conf:** ALTA. **Outros perdem:** polir o Dashboard antes dos tokens = repintar 2×.
- **Critic** — O perigo da sessão única é commit grande + regressão silenciosa. A defesa real **não é a ordem**, é o
**ritual por gate** (DEC-280): testes+smoke+deploy+dev-log+Context Refresh entre gates, e a ÂNCORA a cada ~3
milestones. Com o ritual, a ordem só precisa pôr o pesado cedo. **Rec:** ritual inegociável + M15/onboarding cedo.
**Conf:** ALTA. **Outros perdem:** ordem sem ritual não salva qualidade.
- **Advocate (usuário)** — O usuário sente primeiro o **primeiro minuto** (Dashboard) e o **onboarding**. Onboarding
cedo é ótimo (é a 1ª tela). Mas M15 **repinta entradas do Dashboard** — fazer Dashboard **depois** de M15 evita tocar
as mesmas linhas duas vezes. **Rec:** onboarding e M15 cedo; Dashboard logo após. **Conf:** MÉDIA. **Outros perdem:**
Dashboard antes de M15 = o repoint do M15 mexe no que acabou de ser polido.
- **Strategist** — Terminar por split (M18) + polish isola o mais autocontido pro fim, quando o contexto já está mais
carregado — itens pequenos/locais toleram isso. Os caros em raciocínio (estrutural, fluxo, voz) ficam na metade
fresca. **Rec:** split e ferramentas por último. **Conf:** ALTA. **Outros perdem:** deixar M15 pro fim seria o pior.

**Red Team (matar a ordem líder):** "Fazer M15 + onboarding antes do Dashboard atrasa o item de maior valor e, se a
sessão cair no meio, entrega o menos sexy." Resposta: o ritual **deploya cada gate** — caindo, o que entrou já está
no ar e testado; e a ordem põe os dois itens de maior risco-de-qualidade (M15, onboarding) onde o contexto rende
mais. O valor do Dashboard entra no gate seguinte, não no fim.

**Síntese (Chair):** **Consenso:** fundações primeiro; estrutural+fluxo (M15, onboarding) na metade fresca;
split/polish por último; **o ritual por gate (DEC-280) é o que garante qualidade, não a ordem sozinha.** **Tensão:**
Advocate quer Dashboard cedo (valor) × Architect/Strategist querem o pesado cedo (qualidade) — resolvida pondo
Dashboard **logo após** M15 (G4), colhendo valor sem repintar. **Ordem ratificada:** **G1 fundações → G2 M15 → G3
onboarding → G4 Dashboard → G5 voz & momentos → G6 ferramentas → G7 split.** **Confiança:** ALTA. **É a ordem oficial
de §5/§10; responde §16-Q8.**

---

## 8. Estratégia de testes (teste junto com a mudança — isto é o gate)

Espelha o app: **Vitest** (unit/componente, jsdom) + **Playwright** (e2e). Comandos de `TripPilot/`:

```bash
npm run typecheck && npm run test && npm run build
npm run test:e2e   # quando o item tocar um fluxo
```

- **Toda mudança de lógica é teste de domínio com números concretos** (TS puro em `src/domain/`**). Itens desta leva
são majoritariamente apresentação — então o foco é **não-regressão**:
  - **Tokens/CSS (M01/M02/M12/M19):** snapshot/teste de componente que o anel de foco aparece em `:focus-visible`;
  que o CTA primário usa a classe nova; que nenhum `transition-all` sobrou (um teste/grep no CI).
  - **M15:** atualizar `e2e/navigation.spec.ts` + o teste que monta `TripOverviewPage` em `/trip` (boot-recovery) →
  cobrir o **redirect** `/trip`→`/viagem` e o share card no header do Hub.
  - **M05:** unit no `glossary.ts` (termo→glosa→slug do help existe; sem termo órfão).
  - **Onboarding (DEC-290):** e2e — do `WelcomePage`, criar um **dia-a-dia** chega ao dashboard ongoing válido
  (`onboardingCompleted`/`appMode`/`activeTrip` setados); as 3 ações secundárias continuam presentes (Â9).
  - **M16b (DEC-291):** unit — p/ o mesmo estado, os 3 tons retornam textos **distintos** (nenhum igual, nenhum vazio).
  - **M03/M10 (DEC-293):** componente — o carrossel mostra N alertas em 1 slot (não pilha); no demo, 0 banner de medo.
  - **M18 (DEC-294):** unit garantindo "você recebe/deve" sempre derivável; o selo só quando saldo zera.
- **Golden-path smoke (passa em todo gate):** (1) abrir o app → home renderiza o número "livre" → (2) registrar um
gasto → (3) abrir `/viagem` (Hub) e o share card no header → (4) navegação entre abas com `aria-current` e foco
visível por teclado.
- **Cobertura:** > 90% no domínio tocado, > 70% na UI crítica tocada. **Nunca commitar com teste vermelho ou build
quebrado.**

---

## 9. Protocolo de execução (o loop, checkpoints, recuperação)

**Por milestone (item M-NN):** ler a linha do §6 + o arquivo citado → ajustar domínio (se houver) → ajustar UI →
escrever/estender o teste de não-regressão → `typecheck && test && build` verde → **um commit** → entrada no
`src/dev-log.md` → próximo.

**Self-check por milestone (antes de cada commit, 5 pontos — `phase-delivery-hardening.mdc`):** 1) cite os IDs M-NN

- DEC satisfeitos; 2) nomeie 3 comportamentos anteriores em risco de regressão e verifique (esp. registro de gasto
nunca bloqueia, motion/reduced-motion, modos simples/completo/ongoing); 3) testes verdes, **zero falha nova**; 4)
sinalize arquivos tocados fora do escopo; 5) entrada no dev-log.

**Checkpoint de gate (entre gates — ritual obrigatório, em ordem, DEC-280):** 1) testes do gate + áreas impactadas
verdes (`typecheck`/`test`/`build` limpos); 2) golden-path smoke (§8); 3) ACs cumulativos dos gates anteriores
re-verificados; 4) **deploy**: `npm run build:pages`, bump `public/version.json` + `package.json` version, commit
scoped, push `master` (Pages auto-build); verificar `/version.json` + `/bundles/<v>.zip`; 5) brain sync (§14); 6)
**Context Refresh in-session:** reler §3 + a próxima seção do gate + dev-log Current State; re-emitir a ÂNCORA.

**ÂNCORA (re-emitir a cada ~3 milestones):**

```text
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ÂNCORA — UI/UX pass — [gate] M[NN] CONCLUÍDA
REGRAS: sem subagent; sem perguntar p/ avançar; não parar no fim de gate.
Code=EN, UI=pt-BR via t(). Domínio=TS puro. Dinheiro=centavos.
Esconder≠deletar (Â9). Nunca bloquear gasto. Preserve o que já é bom.
Foco visível (M01); acento IA tokenizado (M12); 1 "livre" por tela (M04).
git --no-pager; git commit -m; deploy = build:pages + bump version.json.
ESTADO: [gate] | Testes: XX/0 | Próximo: [item]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

**Recuperação:** ler dev-log Current State → `npm run test` p/ achar a falha real → reler só a área que falha + a
linha do §6 → corrigir adiante com **novo** commit (nunca `--amend` em commit já enviado) → se o shell travar, §11.

---

## 10. O BUILD — gates

> Legenda: 🔨 fazer agora · ✅ feito · ⏳ pós-validação. Cada gate: **Por quê** (ref checklist), **Causa-raiz** (linha
> do §6), **Mudança**, **AC**, **Testes**, **Commit**. Construa de cima p/ baixo.
> **G1 → G2 → G3 → G4 → G5 → G6 → G7** — ordem **ratificada pelo Council C5** (§7; responde §16-Q8): fundações →
> estrutural → fluxo (onboarding) → primeiro minuto → voz → polish → split.

### G0 — Setup & trilhos de segurança 🔨

- Ler §0–§9 + checklist + a **§16 lockada**. Rodar `npm run typecheck && npm run test && npm run build` **verde no
estado atual antes de tocar em nada** (assim toda falha futura é sua).
- Registrar **DEC-285→294** (PROPOSED) no `decision-log.md` (todas já decididas — §7/§16).
- Semear `src/dev-log.md` com a seção "UI/UX pass (2026-06-24)" + checklist G0…G7.
- **Commit:** `chore(ui-ux): baseline green + seed dev-log + DEC-285..294 (PROPOSED)`.

### G1 — Fundações: Legibilidade & A11y (global, baixo risco) 🔨

**Por quê:** checklist M01/M02/M11/M12/M19 — tudo XS/S, risco baixo, alcance global. **Tokens consumidos pelos gates
seguintes (C5)** — por isso vêm primeiro.

- **G1.1 — Foco visível (M01, DEC-285).** *(§6 M01)* Add `:focus-visible` global em `globals.css`. **AC:** Tab/teclado
mostra anel em botões/links/inputs nos 2 temas; toque não muda. **Teste:** componente — foco programático aplica o
anel. **Commit:** `feat(a11y): global :focus-visible ring (DEC-285)`.
- **G1.2 — Contraste AA (M02, DEC-286).** *(§6 M02)* Subir `--on-surface-faint`; classe `.btn-primary` (ou
`text-white` nos CTAs) = branco sobre primary; nudge `--error`. **AC:** faint ≥ 4.5:1; CTA ≥ 4.5:1; erro ≥ 4.5:1.
**Teste:** snapshot do CTA usando a classe. **Commit:** `style(a11y): AA contrast — faint token, white CTA, error (DEC-286)`.
- **G1.3 — `aria-current` na nav (M11).** *(§6 M11)* `aria-current="page"` na aba ativa do `BottomNav` + reforço
não-cromático. **AC:** leitor de tela anuncia a aba; estado não é só cor. **Teste:** a aba ativa tem `aria-current`.
**Commit:** `feat(a11y): aria-current + non-color active tab (M11)`.
- **G1.4 — Tokenizar acento de IA (M12, DEC-287).** *(§6 M12)* `--ai`/`--ai-2`/`--ai-gradient` em `tokens.css` (2
temas), trocar os 9 hard-codes, documentar no design-system. **AC:** nenhum `#6366F1/#818CF8/#8B5CF6` literal
sobra; tema claro herda. **Teste:** grep no CI = 0 hard-codes de IA. **Commit:** `refactor(theme): tokenize AI accent (--ai/--ai-2) (DEC-287)`.
- **G1.5 — Remover `transition-all` (M19).** *(§6 M19)* Trocar nos 8 arquivos por transições específicas. **AC:**
0 `transition-all`; animações idênticas. **Teste:** grep no CI = 0. **Commit:** `perf(motion): replace transition-all with specific properties (M19)`.

**Fecho G1:** smoke + deploy + bump version; dev-log; ACs re-verificados.

### G2 — Estrutural: Consolidação da Viagem (M15, DEC-288) 🔨

**Por quê:** checklist M15 + Apêndice. Pacote **isolado** (risco G/Alto vira M controlado pelo redirect, padrão
provado). **Feito cedo, com contexto fresco (C5);** o repoint do Dashboard acontece aqui, **antes** do polish do
Dashboard (G4) — evita tocar as mesmas linhas duas vezes.

- **G2.1 — Share card → header do Hub.** Mover `handleShareCard` + botão `ios_share` p/ o header do `TripHubPage`
(reusar `buildShareCardStats`/`renderShareCard`/`deliverShareCard`). **AC:** share funciona do Hub. **Commit:**
`feat(trip): move share card to the Viagem hub header (DEC-288)`.
- **G2.2 — Redirect + limpeza.** `/trip`→`<Navigate to="/viagem" replace/>` no `router.tsx`; remover o tile "Visão
geral" do Hub (`structureItems`); repointar Dashboard (nome-da-fase + `handleInsightTap` case `phase_countdown` de
`/trip`→`/viagem`) + Planner. **AC:** todo link antigo cai no Hub; nada aponta p/ tela morta. **Commit:**
`refactor(nav): redirect /trip → /viagem; repoint entries (DEC-288)`.
- **G2.3 — i18n + testes + apagar.** Aposentar/realocar `trip.overview_title`/`overview_role_hint`/`trip_hub.overview_card`;
atualizar `e2e/navigation.spec.ts` + boot-recovery; apagar `TripOverviewPage.tsx`. **AC:** suite verde; sem
referência órfã. **Commit:** `test(trip): cover /trip redirect; remove TripOverviewPage (DEC-288)`.
- **G2.4 — Polish ("ficar mais bonita").** Tratamento visual no header do Hub + card de resumo ao consolidar. **AC:**
Hub mais sleek sem perder função. **Commit:** `style(trip): polish the consolidated Viagem hub`.

**Fecho G2:** smoke (3 fluxos + share + redirect) + deploy + bump minor; dev-log.

### G3 — Fluxo: Onboarding multi-espaço no Welcome (DEC-290) 🔨

**Por quê:** §16-Q4 — a 1ª tela só cria viagem e empilha 4 portas de peso igual; o app já é multi-espaço (viagem +
dia-a-dia, vários de cada — DEC-249/250/251). O fork **já existe** em `NewSpacePage`; aqui ele chega ao 1º acesso.
**Lógica de fluxo → feito cedo (C5).**

- **G3.1 — Welcome: 2 escolhas primárias (viagem × dia-a-dia).** *(§6 Onb)* No `WelcomePage`, oferecer "Criar viagem"
(→`/onboarding`, fluxo atual) e "Começar no Dia a dia" (criação `kind:'ongoing'` reusando o caminho do `NewSpacePage`:
`createOnboardingEntities` + `createTripFromOnboarding`). O 1º-run do dia-a-dia deve **finalizar como o onboarding**
(setar `onboardingCompleted` + `appMode` + `activeTrip`), não como o fork in-app. **AC:** no 1º acesso dá p/ escolher
viagem **ou** dia-a-dia; criar dia-a-dia cai no dashboard ongoing válido. **Teste:** e2e — do Welcome, criar um
dia-a-dia leva ao dashboard; unit do builder ongoing. **Commit:** `feat(onboarding): trip×daily choice on Welcome (DEC-290)`.
- **G3.2 — Rebaixar ações secundárias (sem remover — Â9).** *(§6 Onb)* Importar backup / receber de outro device /
demo saem do mesmo peso das primárias p/ um **tier secundário no próprio Welcome** (grupo "já tenho dados" + link
discreto p/ demo); **nada some**. **AC:** as 3 funções continuam acessíveis no Welcome, com peso visual menor que as
2 primárias. **Teste:** as 3 ações existem e não têm classe de CTA primário. **Commit:** `refactor(onboarding): demote secondary entries on Welcome (DEC-290)`.
- **G3.3 — M20 + M23 (dentro do redesign).** *(§6 M20/M23)* Botão demo com peso secundário **legível** (não parece
desabilitado) + 1 linha de valor concreto sob o título. **AC:** demo nítido; linha de valor presente (i18n).
**Commit:** `feat(onboarding): legible demo + value line on Welcome (M20/M23)`.
- **G3.4 — Polish do Welcome.** Header/hierarquia da tela inicial condizente com o app multi-espaço. **AC:** Welcome
mais sleek; primárias claras. **Commit:** `style(onboarding): polish the multi-space Welcome`.

**Fecho G3:** smoke (criar viagem + criar dia-a-dia do Welcome) + deploy + bump; dev-log.

### G4 — Primeiro Minuto & Clareza (Dashboard) 🔨

**Por quê:** checklist M03/M04/M06/M09/M05/M10 — "a tela inicial tem opções demais" + a maior alavanca funcional.
Vem **após** o M15 (G2) p/ não repintar entradas já repointadas (C5).

- **G4.1 — Topo como carrossel (M03/M10, DEC-293).** *(§6 M03/M10; §16-Q9)* Alertas/insights do topo **rotacionam num
único slot** (padrão do Amigo Sincero) em vez de empilhar — **nada some** (Â9); no demo, suprimir/colapsar o banner;
location/storage só em risco real; 1 ação primária por estado; polish do header/hero. **AC:** abertura calma (1 slot
rotativo, não pilha); nenhuma função some; no demo sem banner de medo. **Teste:** carrossel renderiza N alertas em 1
slot; no demo, 0 banner de medo. **Commit:** `feat(dashboard): top alerts as a carousel; calmer first glance (DEC-293)`.
- **G4.2 — Pergunta-âncora "Livre hoje" (M04, escopo C1).** *(§6 M04; §16-Q3)* Promover o número existente + 1 linha
de razão + atalho "posso gastar ___?" → `/simulator` pré-preenchido. Regra "um 'livre' por tela". **AC:** sem
duplicar número; atalho abre o Simulador preenchido. **Teste:** o atalho navega com query; não há 2 "livres" na mesma
tela. **Commit:** `feat(dashboard): anchor "free today" + ask-to-spend shortcut (M04)`.
- **G4.3 — "€0 da fase" que orienta (M06).** *(§6 M06)* Microcópia + condição. **AC:** fase 100% planejada mostra
frase tranquilizadora, não "€0". **Teste:** unit da condição. **Commit:** `copy(dashboard): reassuring phase-zero line (M06)`.
- **G4.4 — Chip de contexto/modo (M09).** *(§6 M09)* Rótulo de modo no `SpaceSwitcherChip` + replicar empty-state
"explica ausência". **AC:** sempre dá pra saber o modo; tela ausente por modo explica o porquê. **Teste:** o chip
renderiza o rótulo de modo. **Commit:** `feat(spaces): mode label on context chip + absence empty-states (M09)`.
- **G4.5 — Glossário por toque (M05, DEC-289).** *(§6 M05)* `domain/help/glossary.ts` + `<InfoDot>`; ligar nos
conceitos de dinheiro; deep-link p/ `/help`. **AC:** tocar o ⓘ abre glosa curta + link p/ a Ajuda; sem termo órfão.
**Teste:** unit do registro; componente do InfoDot. **Commit:** `feat(help): tap glossary (InfoDot → /help) (DEC-289)`.

**Fecho G4:** smoke + deploy + bump; dev-log. Rodar §15 (first-click + 5-second) se possível.

### G5 — Voz & Momentos (Amigo Sincero + recap) 🔨

**Por quê:** §16-Q6/Q5 — a voz não soa "amigo sincero" e os tons quase não diferem; e o "fim" é alto valor (Peak-End)
mas a aposta menos validada → entra a **versão leve**.

- **G5.1 — Voz do Amigo Sincero (M16b, DEC-291).** *(§6 M16b)* Reescrever as strings de `honest-friend-voice.ts`
(+ `-extras.ts`) p/ soarem amigo sincero; fazer a **escolha de tom mudar o texto** (suave/sincero/escrachado
distintos de verdade). **AC:** dado o mesmo estado, os 3 tons retornam textos **claramente diferentes**; o escrachado
é mais direto. **Teste:** unit — os 3 tons ≠ entre si p/ o mesmo input; nenhum vazio. **Commit:** `feat(voice): make honest-friend tones actually differ (DEC-291)`.
- **G5.2 — Recap leve de fechamento (M17-lite, DEC-292).** *(§6 M17b)* Recap mínimo reusando `OutingReviewPage`/dados
existentes ao fechar uma saída/dia — **sem** construir a tela de fechamento completa (essa fica ⏳ pós-validação,
kit §15/D). **AC:** ao fechar, aparece um recap leve com dados reais; nenhuma tela pesada nova. **Teste:** o recap
renderiza com dados existentes. **Commit:** `feat(moments): light closing recap reusing OutingReview (DEC-292)`.

**Fecho G5:** deploy + bump; dev-log.

### G6 — Ferramentas, Planner & polish (P3) 🔨

**Por quê:** checklist M13/M22/M21/M24/M25 — XS/S, baixo risco, alto retorno por toque; locais e autocontidos → fim
da sessão (C5).

- **G6.1 — Planner: tags + cadeado explicados (M13)** → `feat(planner): explain optional/essential + lock reason (M13)`.
- **G6.2 — Planner: pílula "Modo: manual" (M22)** → `copy(planner): label the manual pill (M22)`.
- **G6.3 — Conversor: Para=moeda de casa + placeholder (M21)** → `feat(converter): default to home currency + clear placeholder (M21)`.
- **G6.4 — Selo "funciona offline" (M24)** → `feat(ui): discreet offline-resilience seal (M24)`.
- **G6.5 — Comparador: microcópia de captura (M25)** → `copy(comparator): teach to frame the price label (M25)`.

Cada um: **AC** = a mudança visível + nada quebra; **Teste** = não-regressão do fluxo. **Fecho G6:** deploy + bump; dev-log.

### G7 — Legibilidade da divisão (M18, DEC-294) 🔨

**Por quê:** checklist M18 — confiança social mora na divisão. **Construir os dois** (§16-Q7): legibilidade + selo.
Autocontido → por último (C5).

- **G7.1 — "Você recebe €X / você deve €Y" sempre legível** em `SplitTablePage` + acertos. **AC:** estado sempre
derivável e legível. **Teste:** unit do saldo. **Commit:** `feat(split): always-legible per-person balance (M18)`.
- **G7.2 — Selo "tudo acertado ✓"** quando o saldo zera. **AC:** selo aparece exatamente quando tudo quita.
**Teste:** unit — selo só com saldo zero. **Commit:** `feat(split): all-settled seal (DEC-294)`.

**Fecho G7:** deploy + bump; dev-log. **Isto fecha a leva FAZER.**

### Backlog desta leva (fora do build — §16 lockada)

- **M07** (hierarquia do FAB) — **DEPOIS** (§16-Q1; o FAB já melhorou na 0.99.50/DEC-284). **M08** (NÃO).
- **M16-densidade** — DEPOIS (só a *voz* M16b entrou, em G5). **M14** — DEPOIS.
- **M17 — fechamento completo** ("o fim que dá orgulho") — ⏳ **pós-validação** (kit §15/D); o recap leve (M17-lite)
já entrou em G5.

---

## 11. Tabela de problemas (situação → ação) + segurança de pager WSL


| Situação                                         | Ação                                                                                                                                 |
| ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------ |
| **Qualquer leitura git** (`log`/`diff`/`show`)   | Sempre `git --no-pager …`; commit só com `-m`/HEREDOC. Nunca `-i`/interativo, nunca `less`/`vim`. (`terminal-pager-safety.mdc`.)     |
| Um comando trava >30s sem output                 | Não re-rode/espere. Leia o metadata do terminal p/ o pid do bash; `ps` p/ `less`/editor preso; mate-o. (incidente 2026-06-11.)       |
| Deploy/preview precisa de credencial que não tem | Faça o equivalente local (`npm run build`/`preview`), marque a etapa live ⏳ no dev-log, **continue**. Não pergunte.                  |
| Mudar `--primary` quebraria ícones/indicadores   | Não escurecer o token (council C2) — branco no CTA. Se quiser terracota mais escuro, é item estético separado.                       |
| Browser/screenshot trava (WSL)                   | Não bloqueie em verificação visual; valide por teste + build; deixe nota "rode no device".                                           |
| Uma mudança contradiria uma decisão do brain     | Se é direção do Julio (checklist/§16), adote como `DEC-NNN` PROPOSED (§7) e siga; senão pegue o default consistente e escreva o DEC. |
| Teste falha após mudança                         | Recuperação §9; corrija adiante com novo commit; nunca `--amend` em commit enviado.                                                  |
| Ambiguidade genuína, brain calado                | Rode o council inline **agora** (1 request), registre `DEC-NNN` PROPOSED, **continue** — não pare p/ perguntar.                      |


---

## 12. Definição de Pronto / Critérios de Parada

**Um gate está pronto quando:** seus testes + ACs cumulativos passam; `typecheck`/`test`/`build` limpos; smoke
passa; deployado (ou ⏳ com prova local); commitado; dev-log atualizado.

**Chegar a um gate NUNCA é razão p/ parar ou pedir permissão** — commit, deploy, dev-log e siga. **A leva está
pronta — PARE só quando TUDO for TRUE:**

- [x] **G1 (fundações a11y):** foco visível global; AA em faint/CTA/erro; `aria-current` na nav; acento de IA
  tokenizado; 0 `transition-all`. _✅ 0.99.51._
- [x] **G2 (M15):** share card no header do Hub; `/trip`→`/viagem`; `TripOverviewPage` apagado; tudo repointado; Hub polido. _✅ 0.99.52._
- [x] **G3 (onboarding):** Welcome oferece **viagem e dia-a-dia** (DEC-290); criar dia-a-dia funciona no 1º acesso;
  backup/receber/demo presentes porém **rebaixados** (Â9); demo legível + linha de valor. _✅ 0.99.53._
- [x] **G4 (primeiro minuto):** topo em **carrossel** (nada some); no demo sem banner de medo; "Livre hoje" promovido
  (1 por tela) + atalho "posso gastar?"; "€0 da fase" orienta; chip de modo; glossário ⓘ → Ajuda. _✅ 0.99.54._
- [x] **G5 (voz & momentos):** os 3 tons do Amigo Sincero **diferem de verdade** (DEC-291); recap leve reusando
  `OutingReviewPage` (DEC-292). _✅ 0.99.55._
- [x] **G6 (ferramentas):** Planner (tags/cadeado + "Modo: manual"); Conversor (Para=casa + placeholder); selo
  offline; microcópia do Comparador. _✅ 0.99.56._
- [x] **G7 (divisão):** saldo "recebe/deve" sempre legível **+ selo "tudo acertado"** (DEC-294). _✅ 0.99.57._
- [x] Sem dead affordance; sem susto evitável; nada hard-coded de IA; **nada foi removido** (só rebaixado/colapsado). _verificado por gate._
- [x] Suite verde (unit) — **2166/2168** (só as 2 falhas baseline de WebCrypto em `split-live-loop`, que passam no CI Node 22); cobertura nos códigos tocados. _e2e roda no CI (sandbox sem browsers Playwright) — ⏳._
- [x] `src/dev-log.md`, `decision-log.md` (DEC-285→294 APPROVED), `project-status.md`, checklist (itens ✅) atualizados;
  deployado em Pages (`master`) + `version.json` bumpado (0.99.57).
- [ ] A matriz de teste manual (§15) passa no celular — ⏳ **device-pending** (sandbox WSL sem device/browsers; validar nos APKs OTA 0.99.57; cada AC já coberto por unit/build).

---

## 13. Anti-padrões (NÃO faça)

- Reconstruir telas/fluxos que já funcionam em vez de ajustá-los. (§0)
- Pular para polimento visual antes da legibilidade/estrutura. (§5)
- Deixar botão/ícone/pílula sem ação, ou cópia que assusta sem motivo. (§3)
- Adicionar um **segundo** número de "livre" na mesma tela (M04 dedup). (C1)
- Escurecer `--primary` global em vez de branco no CTA (efeito colateral em ícones/tema claro). (C2)
- Hard-codear cor de IA em vez de usar `--ai`/`--ai-2`. (§6 M12)
- Reintroduzir o lembrete de backup na home (saiu em DEC-176). (§3)
- Apagar `TripOverviewPage` **antes** de migrar o share card. (G2 ordem)
- Lógica de negócio dentro de componente React; texto de UI hard-coded sem `t()`. (§3)
- Pedir confirmação p/ avançar; spawnar subagents; parar porque um gate acabou. (§1)
- `git log` sem `--no-pager`; `git commit` puro; qualquer `-i` interativo. (§11)
- Commit com teste vermelho; `--amend` em commit já enviado. (§9)

---

## 14. Regras de sincronia do brain

- **Cada milestone:** `src/dev-log.md` (seção "UI/UX pass (2026-06-24)", mais recente primeiro).
- **Cada decisão nova/alterada:** `DEC-285→29x` em `decision-log.md`; marcar o que refina; bumpar `Last updated`.
- **Cada item concluído:** marcar ✅ no `ui-ux-change-checklist-2026-06-23.md`.
- **Fim da leva:** `project-status.md` (o que a leva entregou, o que ficou ⏳/backlog).
- **Qualquer edição de doc:** atualizar seu `> Última atualização:`.

---

## 15. Matriz de teste manual (rode no celular nos fechos de gate)

**Fundações a11y (G1):** navegar por teclado (PWA desktop) → anel de foco visível em tudo; conferir contraste do
CTA/labels nos 2 temas; aba ativa anunciada. **Viagem (G2):** abrir `/viagem` → share card no header funciona; um
link antigo p/ `/trip` cai no Hub; nada aponta p/ tela morta. **Onboarding (G3):** app limpo → o Welcome deixa
escolher **criar viagem** ou **começar no dia a dia**; criar dia-a-dia chega ao dashboard; backup/receber/demo ainda
estão lá, porém discretos; botão demo nítido + linha de valor. **Primeiro minuto (G4):** abrir limpo (não-demo) →
topo é 1 carrossel, não pilha; em demo → sem banner de medo; o número "livre" é a 1ª coisa que se lê (**5-second
test:** ≥4/5 citam "livre/posso gastar"); **first-click:** "onde tocaria pra saber quanto pode gastar hoje?" cai no
número/atalho; tocar um ⓘ abre a glosa. **Voz & momentos (G5):** trocar o tom do Amigo Sincero muda o texto de
verdade (suave≠sincero≠escrachado); ao fechar uma saída, aparece o recap leve. **Ferramentas (G6):** Planner mostra
motivo do cadeado + "Modo: manual"; Conversor abre convertendo p/ a moeda de casa, placeholder claro. **Divisão
(G7):** "você recebe/deve" legível; ao quitar tudo, selo "tudo acertado". **Geral:** registrar gasto nunca bloqueia;
reduced-motion respeitado; trocar tema; tabs rápidas.

---

## 16. Perguntas para o Julio — ✅ RESPONDIDAS & LOCKADAS (2026-06-24)

> **Status:** todas respondidas pelo Julio e convertidas em decisões (§7, **DEC-285→294**) + na ordem do **Council
> C5**. As respostas inline (`→ Resposta:`) abaixo são o registro original. **Resolução (lock):** Q1→M07 **DEPOIS**
> (backlog) · Q2→**branco no CTA** (DEC-286/G1) · Q3→**promover o nº existente** (M04/G4) · Q4→**onboarding
> multi-espaço** + rebaixar secundárias no Welcome, **não** Settings (DEC-290/G3) · Q5→**recap leve** agora,
> fechamento completo pós-validação (DEC-292/G5) · Q6→**M16b sim** (DEC-291/G5) · Q7→legibilidade **+ selo**
> (DEC-294/G7) · Q8→ordem **G1→G7** (Council C5) · Q9→**carrossel**, nada some (DEC-293/G4). Nada pendente — pronto p/ rodar.

**Q1 — M07 (hierarquia do FAB) está marcado FAZER *e* DEPOIS ao mesmo tempo.** Houve reorg parcial na 0.99.50 (DEC-284)
e o M08 (complemento) está NÃO. **Recomendação:** **DEPOIS** (fora desta leva) — o FAB já melhorou e mexer no
componente mais usado é risco médio sem ganho urgente.
→ Resposta: depois(Rec: DEPOIS)  

**Q2 — M02 contraste do CTA: como corrigir?** Council C2. **Recomendação:** **branco puro no CTA** + subir
`--on-surface-faint` + nudge `--error` (cirúrgico, sem mudar ícones/indicadores nem arriscar o tema claro).
Alternativa: escurecer `--primary` ~6% globalmente (1 linha, mas muda todo uso de primary). → Resposta:  branco no CTA  (Rec: branco no CTA)

**Q3 — M04: confirmar a abordagem.** Council C1 + sua nota l.105. **Recomendação:** **promover o número que já
existe** ("Livre hoje"/"Livre para usar nesta fase") + 1 linha de razão + atalho "posso gastar?", **sem** criar um número novo (evita duplicar). → Resposta: sim (Rec: promover o existente, sem duplicar)

**Q4 — M03: para onde "esconder" demo + backup, e quanto de polish visual?** **Recomendação:** mover o acesso a
ambos para **Settings** (já existe `/settings/backup`), **suprimir o banner de demo no modo demo** (ou um chip minúsculo), condicionar location/storage a risco real, e fazer um polish leve do header/hero (sem rebrand). Confirme se topa "demo+backup em Settings" e o nível de capricho visual. → Resposta: não pois estamos falando da tela inicial de onboarding que o user n tem acesso ao settings ainda, ai nesse caso n teria como ele entrar sem criar toda a viagem.. inclusive ja fizemos um estudo de uso sem precisar criar a viagem né? ah acho que era interno depois de criado a viagem podemos fazer um tipo dia a dia, mas na realidade, n precisamos criar a viagem essa é uma mudança importante, tem que perguntar para o user se ele quer criar uma viagem ou usar dia a dia, lembrando que tambem pesquisamos que o user pode cirar varias viagens e varios dia a dia, enfim, a tela inicial de onboarding tem que ser condizente com o app atual. os coisas que precisamos tem que estar na tela de onboarding, só n porecisa estar no meio da tela e com o mesmo peso dos principais, pode estar mais escondido..  

**✅ Resolvido (Q4):** redesign do Welcome como **onboarding multi-espaço** — 2 escolhas primárias ("Criar viagem" →
`/onboarding`; "Começar no Dia a dia" reusando o fork do `NewSpacePage`); backup/receber/demo **rebaixados no próprio
Welcome** (não Settings — pré-onboarding não tem Settings), sem remover nada (Â9). Inclui M20 (demo legível) + M23
(linha de valor). → **DEC-290**, gate **G3**.

**Q5 — M17 (fechamento "o fim que dá orgulho"): validar antes ou construir já?** Council C3 (Peak-End é alto valor,
mas é a aposta menos validada). **Recomendação:** **validar antes** (kit §15/D — conceito + emotion-check, construir
só se média ≥4); **não** construir o fechamento completo nesta leva. *Opcional:* um recap mínimo reusando
`OutingReviewPage` como semente de baixo risco, se você quiser um gostinho já. → Resposta: fazer o recap leve (Rec: validar antes; opcional recap leve)

**Q6 — Textos do "Amigo Sincero": abrir M16b nesta leva?** Você disse que não sente a diferença entre os tons e que
o "escrachado" não escracha. Council C4 separa isso da densidade (M16, que fica DEPOIS). **Recomendação:** **sim** —
abrir **M16b** (reescrever as strings da voz em `honest-friend-voice.ts`/`-extras.ts` + diferenciar de verdade os tons), item pequeno, voz e não layout. → Resposta: sim, fazer bem um amigo soncero mesmo e fazer as escolhes de frases de tom funcionar, n faz sentido todas serem parecidas..(Rec: sim, M16b nesta leva)  

**Q7 — M18: o selo "tudo acertado ✓".** A legibilidade do saldo é baixo risco (construir já). O selo é a parte
hipótese. **Recomendação:** **construir a legibilidade agora** e **incluir o selo** (é barato e claramente positivo); validar só se você tiver dúvida do tom. → Resposta: contruir (Rec: construir os dois)

**Q8 — Ordem dos pacotes.** **Recomendação:** **G1 (a11y/legibilidade) → G2 (primeiro minuto) → G3 (M15) → G4 (ferramentas/polish) → G5 (split)** — risco baixo/global primeiro, estrutural no meio (contexto fresco), polish e split no fim. → Resposta: acho que como vamos fazer tudo em uma unica sessão tem que pensar nisso, rodar o conselho para entender como melhor fazer para ter o melhor aproveitamente de qualidade.(Rec: G1→G2→G3→G4→G5)

**✅ Resolvido (Q8):** rodei o **Council C5** (§7) p/ otimizar a sessão única. Ordem final **G1 fundações → G2 M15 →
G3 onboarding → G4 Dashboard → G5 voz → G6 ferramentas → G7 split** (estrutural/fluxo cedo, com contexto fresco; o
ritual por gate — DEC-280 — é o que garante a qualidade ao longo da sessão).

**Q9 — M10: validar antes ou ajuste leve direto?** O topo já é condicional (sua nota "não ficam todas ao mesmo
tempo"). **Recomendação:** **ajuste leve direto** em G2 (1 ação primária por estado) + validar com o 5-second test depois — sem bloquear. → Resposta: pode ajustar mas n quero que nada suma.. talvez um carrosel de problemas?(Rec: ajuste leve direto)

**✅ Resolvido (Q9):** o topo vira **carrossel de alertas** (mesmo padrão do Amigo Sincero) — **nada some** (Â9) — +
1 ação primária por estado. → **DEC-293**, gate **G4** (junto com M03).

---

## 17. GO

1. Ler §0–§9 + checklist + a **§16 lockada**. `npm run typecheck && npm run test && npm run build` verde antes de
   tocar em nada.
2. Semear `src/dev-log.md`, registrar **DEC-285→294** (PROPOSED), então ir **gate a gate G1 → G7** (fundações → M15 →
   onboarding → Dashboard → voz → ferramentas → split — ordem do **Council C5**), commitando por milestone e
   deployando por gate (Pages `master` + bump `version.json`), até §12 ser toda TRUE. Manter o brain em sincronia
   (§14). **Não perguntar p/ avançar**; ambiguidade → council inline + DEC + seguir. Não parar. Aplicar.

> *Este orquestrador é a verdade de execução desta leva; o brain é a verdade de produto; o checklist é a verdade do
> escopo. Se conflitarem, resolva explicitamente (atualize o brain + um `DEC-NNN`), depois continue.*

