# Backlog de Melhorias — Garimpo Completo & Ranqueado (2026-06-19)

> **O que é este arquivo:** uma varredura de **tudo que já pesquisamos/planejamos mas NÃO
> implementamos**, cruzada com o que de fato foi entregue (DEC-001..DEC-244), filtrando o que
> ainda **faz sentido hoje** (não foi feito, não foi superado, não foi invalidado por outra
> mudança), e **ranqueado** por facilidade × valor p/ usuário × encaixe × ganho.
>
> **Gatilho (Julio, 2026-06-19):** *"faça uma pesquisa completa de coisas que pesquisamos para
> melhorias mas não fizemos, que realmente ainda funcionam fazer e não foram impactadas por
> outras mudanças… ache uma lista bem grande e rankeie tudo pelo que mais funciona, é mais
> fácil, mais interessante pro user, mais cabe, mais ganha."*
>
> **Estado de partida:** web/OTA **0.99.10** no apex `trippilot.pages.dev` (verificado), APK shell
> **0.56.0**, **1575 testes unit / 5 E2E** verdes, Dexie v9. Princípio inegociável: **ZERO
> regressão** (ÂNCORA 9) — só melhorias.
>
> **Método:** fontes lidas — `master-fix-and-skipped-features-plan-2026-06-17.md` (B1–B18),
> `ux-clarity-audit-2026-06-17.md` (§5 backlog P2/P3), `open-decisions-councils-...-2026-06-19.md`
> (OD-1/2/3), `apk-ota-self-update-study-2026-06-19.md` (OTA-1/2/3), `copilot-expansion` +
> `copilot-intelligence` (módulos A–H), `implementation-phases.md` (V2), `decision-log.md`
> (DEC-212..244) e `src/dev-log.md`. Confiança marcada per `fact-verification.mdc`:
> **[VERIFICADO]** = li no código/brain; **[A VERIFICAR]** = precisa olhar o código antes.

---

## 0. TL;DR — o que sobrou de verdade

De ~30 frentes pesquisadas no passado, a **maioria já foi entregue** desde os planos antigos
(income type, biometria web, Copiloto v3 com 7 módulos, E2E em CI, reforma do modelo de
orçamento, 4 pacotes de UX-clarity, bill-split completo, deep-dive de dívida, e o G4 de métodos
de pagamento desta sessão). O que **ainda faz sentido e ainda não foi feito** cai em 5 baldes:

| Balde | Quantos | Pode fazer sozinho agora? |
|---|---|---|
| **A — Faça hoje** (web/OTA, aditivo, baixo risco) | 5 | ✅ Sim |
| **B — Vale, precisa de 1 decisão sua** | 2 | ⚠️ Depois do seu OK |
| **C — Maiores / encanto (V2-radar)** | 2 | ✅ Sim, mais esforço |
| **D — Travadas no seu Android** (device) | 4 | ❌ Precisa do aparelho |
| **E — Deferidas por design / estratégicas** | 9 | ❌ Não fazer agora |

**Recomendação de ataque:** começar pelo **balde A** (todos somam pouco risco e fecham pontas já
pesquisadas), depois **C1 (Wrapped)** se quiser um item de encanto, e **B** só com seu input.

> **⚠️ Correção pós-verificação de código (2026-06-20, ao executar o balde A):** antes de
> implementar, abri o código vivo — e **A2, A3 (rótulo) e A5 já estavam no app**. Este balde foi
> montado a partir dos docs de estudo/auditoria antigos (OTA-study, UX-clarity), que não cruzaram
> com o estado atual do código. Estado **real** (per `fact-verification.mdc`, [VERIFICADO no código]):
> - **A1 — explicador no Wise:** era o único item de fato aberto → **✅ ENTREGUE em 0.99.11**
>   (`<SplitExplainer />` colapsado montado na folha "Classificar transferência" do importador Wise;
>   4ª e última tela de divisão → G9 completo nas 4 superfícies).
> - **A2 — consentimento do recibo:** **já existe** (`receiptScan.consent_title/body/enable` —
>   "a foto é enviada ao nosso serviço de leitura (Groq) … não treina … desligue quando quiser").
>   Nada a fazer.
> - **A3 — Simulador:** o alvo genérico `{kind:'other'}` **já existe** e o rótulo **"Posso
>   gastar?"** **já existe** (`more.simulate`). O resíduo ("avulso como PADRÃO") é **mudança de
>   comportamento** → rebaixado para o balde B (decisão), não "faça hoje".
> - **A5 — botão "buscar atualização":** **já existe** (`SettingsPage.handleCheckUpdate →
>   handleCheckUpdateNative` cobre APK **e** bundle web via `resolveAppVersionStatus`). O que falta
>   de verdade é **D1/OTA-1** (promover um shell verificado — device-dependente).
> - **A4 — atalho/glossário Wise:** continua **opcional** (a auditoria diz "manter como fluxo
>   avançado"; risco de poluir). Fica no radar, não no "faça hoje".
>
> **Saldo honesto:** o balde "faça hoje sozinho" era, na prática, **só A1** — o app já estava mais
> completo do que os docs antigos sugeriam. **A1 fechado nesta sessão (0.99.11)**; o resto exige a
> sua **decisão** (balde B) ou o seu **aparelho** (balde D).

---

## 1. Tabela-mestra ranqueada (composto = Facilidade + Valor + Encaixe + Ganho, máx. 20)

> Escala 1–5 por dimensão. "Auto?" = dá pra eu executar sozinho hoje (web/OTA, sem device/decisão).
> "Esforço" em Tier 3 (÷3). Ordenado por composto, depois por menor esforço.

| # | Item | Fac. | Valor | Enc. | Ganho | **Σ** | Esforço | Auto? | Risco |
|---|------|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| **A1** | OD-3 — Explicador de divisão no Wise (montar `SplitExplainer`) | 5 | 3 | 5 | 4 | **17** | ~1–2h | ✅ | mín. |
| **A2** | Recibo — microcopy de consentimento (o que sai do device) | 5 | 3 | 5 | 3 | **16** | ~0.5h | ✅ | mín. |
| **A3** | Simulador — alvo "avulso" padrão + rótulo "Posso gastar?" | 4 | 4 | 4 | 4 | **16** | ~2–3h | ✅ | baixo |
| **B1** | OD-2 — Fundo→Trecho/Pote (pass por natureza do pool) | 3 | 4 | 5 | 4 | **16** | ~3h | ⚠️ | baixo-méd |
| **A4** | Wise — atalho de import visível na lista + glossário inline | 4 | 3 | 4 | 3 | **14** | ~2h | ✅ | baixo |
| **C1** | Copiloto — "Wrapped" de fim de viagem (módulo H) | 2 | 4 | 4 | 4 | **14** | ~4–6h | ✅ | baixo |
| **A5** | OTA-2 — botão "Buscar atualização do app" em Settings | 4 | 2 | 5 | 2 | **13** | ~1–2h | ✅ | baixo |
| **B2** | OD-1 Path A — afiar papéis Hub × Visão geral (Overview read-only) | 3 | 3 | 4 | 3 | **13** | ~3h | ⚠️ | médio |
| **C2** | Auto-sugerir "iniciar Saída" ao detectar bar/restaurante seguidos | 3 | 3 | 3 | 3 | **12** | ~3h | ✅ | baixo-méd |

> **Travadas por device (não entram no ranking de "fazer hoje"):** D1 OTA-1 (promover shell
> verificado — **o que de fato resolve o "pegar da pasta Downloads"**), D2 lote nativo B1/B2/B3,
> D3 biometria nativa, D4 backlog B18. Detalhe na §4.

---

## 2. Balde A — Faça hoje (autônomo, web/OTA, aditivo, baixo risco)

### A1 — OD-3: Explicador de divisão no Wise [VERIFICADO · ✅ ENTREGUE 0.99.11]
- **Origem:** DEC-231 (GATE 11) montou o `SplitExplainer` ("Como funciona a divisão", 3 passos)
  em QuickAdd/Recibo/Shared, mas **deferiu o Wise** (fluxo power-user). Conselho em
  `open-decisions-...-2026-06-19.md` §3 = **montar** (unânime, menor risco dos três OD).
- **Plano:** montar `<SplitExplainer />` colapsado no topo do bloco "dividir" da BottomSheet de
  alocação do importador Wise; a copy **já existe** (namespace `split.*`). Estender
  `e2e/split-explainer.spec.ts` para o mount Wise.
- **Por que rankeou no topo:** copy pronta, 1 import, sem domínio/engine, fecha a consistência G9
  nas 4 telas de divisão. **Esforço ~1–2h. Confiança ALTA.**

### A2 — Recibo: microcopy de consentimento [VERIFICADO · ✅ JÁ EXISTIA — nada a fazer]
- **Origem:** UX-clarity §4.13 (P3) — "microcopy do consentimento (o que sai do device)" no scan
  por nuvem (Groq). Hoje o usuário escaneia sem uma linha clara do que é enviado.
- **Plano:** 1 linha calma acima do scan por nuvem ("a foto vai pro nosso servidor só pra ler os
  itens; não treina nada / não fica salva", pt/en/es). Aditivo, sem mudar fluxo.
- **Por que vale:** ganho de **confiança** num ponto sensível (privacidade), custo quase zero.
  **Esforço ~0.5h. Confiança ALTA.**

### A3 — Simulador: alvo "avulso" padrão + rótulo "Posso gastar?" [VERIFICADO · ✅ rótulo+alvo já existem; resíduo "avulso padrão" → balde B]
- **Origem:** UX-clarity §4.7 (P3) — "alvo 'outro/avulso' como padrão para não exigir perfil" +
  "considerar rótulo 'Posso gastar?' como sinônimo visível". Hoje o `registerHref` já cai num
  caminho genérico sem categoria, mas **[A VERIFICAR]** se a tela exige escolher um perfil antes.
- **Plano:** se exigir, oferecer um alvo genérico "avulso/outro" pré-selecionado (some a fricção
  de ter que ter perfil), e expor "Posso gastar?" como rótulo/sinônimo visível do Simulador (sem
  remover do FAB). Reusa o motor de simulação (sem domínio novo).
- **Por que vale:** o Simulador é a pergunta nº1 do viajante ("posso gastar isso?"); tirar a
  exigência de perfil amplia o uso. **Esforço ~2–3h. Confiança MÉDIA (validar o estado atual).**

### A4 — Wise: atalho de import visível + glossário inline [VERIFICADO · ⏸ opcional, fica no radar]
- **Origem:** UX-clarity §4.14 (P3) — "atalho de import mais visível na Lista de Gastos" +
  "glossário curto inline de 'alocação/ponte'". O scan de recibo ganhou entrada de destaque
  (DEC-206); o **import Wise** segue escondido no fluxo.
- **Plano:** uma entrada discreta "Importar Wise (.csv)" no header da Lista de Gastos (ou dentro
  do "Escanear"/FAB), e 1–2 tooltips inline para "alocação" e "ponte de reembolso" no importador.
  Manter como fluxo avançado. **Esforço ~2h. Confiança MÉDIA.**

### A5 — OTA-2: botão "Buscar atualização do app" em Settings [VERIFICADO · ✅ JÁ EXISTIA (handleCheckUpdateNative)]
- **Origem:** `apk-ota-self-update-study-2026-06-19.md` §4 (Gate OTA-2). A máquina toda já existe
  (`resolveAppVersionStatus` + `downloadAndInstallApk`); falta só o botão manual.
- **Plano:** botão na área de versão de Settings (guardado por `isNativeApp()`): chama
  `resolveAppVersionStatus()`; se `nativeUpdateAvailable` → instalador; senão "você já está na
  mais recente". Cobre o caso "quero puxar agora" sem esperar o toast do boot.
- **Ressalva honesta:** **valor só se materializa depois do OTA-1** (promover um shell verificado,
  que é device-dependente). É polimento seguro que **completa** o fluxo de update, mas não resolve
  sozinho o "pegar da pasta Downloads". **Esforço ~1–2h. Confiança ALTA (seguro).**

---

## 3. Balde B — Vale a pena, precisa de UMA decisão sua

### B1 — OD-2: "Fundo" → Trecho/Pote (rename por natureza do pool) [VERIFICADO]
- **Origem:** DEC-228 deferiu o rename geral porque **um pool pode ser Trecho OU Pote** — um
  "Fundo"→"Trecho" cego é semanticamente errado. Conselho em `open-decisions-...` §2 (DEBATE) =
  **fazer como pass por natureza, com fallback**, não blanket.
- **Plano:** resolver puro `domain/funds/pool-nature.ts` → `poolNature(pool): 'trecho'|'pote'|
  'generic'`; copy por natureza (`funds.label_trecho/_pote/_generic`) no editor `/funds`, no
  picker do QuickAdd e no "Mover de fundo" do `SelectionBar`. **Mantém** identificadores de código
  (`Fund`/`pool`/`/funds`). i18n ×3.
- **O que preciso de você (prereq):** confirmar o **mapa de termos** — Trecho = fundo ligado a uma
  fase/trecho · Pote = cofre/meta (opcional com data) · fallback quando nenhum → proposta
  **"Reserva"** (ou manter "Fundo"). Sem isso, o rename fica ambíguo.
- **Esforço ~3h. Confiança ALTA (depois do termo).**

### B2 — OD-1 Path A: afiar papéis Hub × Visão geral [VERIFICADO]
- **Origem:** UX-clarity §6 Q3 + `open-decisions-...` §1 (REVIEW). Veredito do conselho = **NÃO
  fundir** sob o mandato "sem bugs"; **afiar** os papéis (Overview = só leitura + compartilhar;
  Hub = planejar/editar).
- **Plano (Path A, baixo risco):** auditar `TripOverviewPage` e **remover qualquer affordance de
  edição** (deixar total, timeline read-only, fundos com barras read-only, share card); garantir
  que todo deep-link de plano/edição caia no Hub. (Opcional: no modo simples, `/trip` vira o alvo
  padrão da aba Viagem.)
- **O que preciso de você:** confirmar que **ainda sente** a sobreposição depois da microcopy do
  GATE-14 — o conselho condicionou o gate a isso (é mudança de navegação, alto impacto, você
  reservou pra si). **Esforço ~3h. Risco médio (navegação).**

---

## 4. Balde C — Maiores / encanto (V2-radar, mais esforço, ainda aditivo)

### C1 — Copiloto "Wrapped" de fim de viagem (módulo H) [VERIFICADO]
- **Origem:** `copilot-expansion` §2 (módulo H) + `copilot-intelligence` §2 (14) — único item do
  Copiloto ainda não construído; marcado V2 porque **depende da viagem encerrada**.
- **Plano:** módulo data-gated que só aparece quando a viagem termina — superlativos sobre dados
  que já temos (maior dia, categoria nº1, social×solo, streak de disciplina, total na moeda de
  casa). Reusa o **share card** (DEC-133) para exportar 1080×1350. Cálculo puro em
  `domain/copilot/` + testes de math.
- **Por que vale:** é o "Spotify Wrapped" da viagem — alto encanto, fecha o ciclo emocional, e
  toda a matéria-prima já existe. **Esforço ~4–6h (Wrapped é mini-épico). Confiança ALTA no dado,
  MÉDIA no design.**

### C2 — Auto-sugerir "iniciar Saída" ao detectar bar/restaurante seguidos [VERIFICADO]
- **Origem:** UX-clarity §4.12 (P3) — "sugerir iniciar saída ao detectar vários gastos seguidos
  de bar/restaurante".
- **Plano:** heurística leve (≥N gastos de categorias de bar/restaurante numa janela curta) → um
  nudge **não-intrusivo e dispensável** ("parece um rolê — quer abrir uma Saída pra acompanhar o
  teto?"). Reusa o orquestrador de saída; **nunca** bloqueia o registro (ÂNCORA 10).
- **Risco:** o gatilho precisa ser calmo (falso-positivo irrita). **Esforço ~3h. Confiança MÉDIA.**

---

## 5. Balde D — Travadas no seu Android (precisam de aparelho físico)

> Não são "fix" — são **uma sessão de QA em device** (idealmente seu S23). Política do projeto
> proíbe promover APK/App-Links não verificados em aparelho.

| # | Item | Origem | O que destrava |
|---|------|--------|----------------|
| **D1** | **OTA-1 — promover shell verificado** (bump `latestNativeVersion`) | DEC-243 / OTA study | **Resolve o "pegar da pasta Downloads"** — depois disso o toast de boot entrega o APK em 1 toque |
| **D2** | Lote nativo **B1+B2+B3** (receber `.csv`, App Links `/pair`+`/s/:id`, grant GPS) | DEC-215 (APK 0.69.0 pronto) | 3 features que dependem só do shell nativo |
| **D3** | Biometria **nativa** sobre o PIN | DEC-218 | desbloqueio biométrico no app instalado |
| **D4** | Backlog **B18** de validação em device (10 ACs) | master-fix §B18 | confirma features nativas já entregues (QR câmera, backup→Downloads, notif da saída, Capgo, etc.) |

---

## 6. Balde E — Deferidas por design / estratégicas (NÃO fazer agora)

| # | Item | Por que fica fora |
|---|------|-------------------|
| E1 | SW por build plugin (Workbox/Vite) — B14 | **Alto risco de regressão** (SW é zona crítica, DEC-082/137); só com bateria de testes de update + device |
| E2 | Refactor de orquestradores em páginas antigas — B13 | Tech-debt sem valor de usuário; oportunístico, página a página |
| E3 | P2P V2 / split de grupo ao vivo — B11 / DEC-108 | Deferido por design; subsumido pelo épico shared-link |
| E4 | Fechar conexão no `visibilitychange` — B16 | Deferido (risco de abortar escrita; a escada de recovery já cobre) |
| E5 | Shared-link v1.1 (editar de outros, PIN-por-link, revogar/rotacionar) — B4 | **Congelado** — você vai redesenhar o link |
| E6 | Push app-fechado (FCM) + real-time iOS-web — B5 | Decidido **fora** — sideload-first, sem Play Services |
| E7 | Login/contas · sync multiusuário remoto · widget Android | **V2 roadmap** (product-spec) — projetos estratégicos, não polimento |
| E8 | Onboarding: colapsar template/tipo sob "Mais opções" (§4.1 P3) | Estrutural, arrisca o caminho rápido; valor baixo |
| E9 | Gesto de borda descobrível / coachmark (§4.4 P3) | Precisa de infra de coachmark inexistente; valor baixo |

> **Já entregues (não confundir com backlog):** "por que esse card apareceu?" (DEC-233, "Como
> cheguei nisso"), "SOS é simulação" (DEC-232), microcopy "Income aumenta o fundo" (já no
> `income.intro`/`grows_fund`), explicador de divisão nas 3 telas principais (DEC-231), todos os
> módulos do Copiloto exceto Wrapped (DEC-181..184/214), income type (DEC-212), biometria web
> (DEC-213), E2E em CI (DEC-216), G4 métodos de pagamento (DEC-244).

---

## 7. Como executar (quando você quiser)

- **"Manda o balde A"** → eu faço A1→A5 em gates curtos (cada um: implementa → testa → Playwright
  → versão → commit → deploy OTA), na ordem do ranking, sem te perguntar nada entre eles.
- **"Aplica OD-2"** (depois de confirmar o mapa de termos) / **"aplica OD-1 Path A"** (se ainda
  sente a sobreposição) → viram gates normais.
- **"Faz o Wrapped"** → mini-épico C1 com share card.
- **Sessão de device** (quando tiver o Android): fecha D1–D4 de uma vez (checklist + screenshots),
  e aí o OTA nativo volta a fluir (acaba o "pegar da pasta Downloads").

---

## 8. Hook do decision-log
- Adicionar **DEC-245** = "Backlog de melhorias garimpado & ranqueado (2026-06-19): baldes A
  (faça hoje: OD-3, recibo consent, simulador avulso, Wise atalho, OTA-2), B (OD-2/OD-1 sob
  decisão), C (Wrapped, auto-saída), D (device: OTA-1 + lote nativo + biometria + B18), E
  (deferidos por design). Documento-fonte para próximas rodadas."
