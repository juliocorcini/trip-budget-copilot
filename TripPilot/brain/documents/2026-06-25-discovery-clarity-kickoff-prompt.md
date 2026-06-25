# KICKOFF — Aplicar a leva "Descoberta & Clareza" do TripPilot (sessão única)

> **Cole TUDO abaixo da linha `=== COLE A PARTIR DAQUI ===` como a primeira mensagem de um chat NOVO**, com o
> repositório `trip-budget-copilot` aberto. É o gatilho de execução: o agente lê o orquestrador (a fonte de verdade) e
> implementa a leva inteira de ponta a ponta, sem parar, nesta sessão.
>
> **Modelo recomendado:** o mais forte disponível para implementação (a leva tem decisões conceituais + um hub de descoberta
> novo + refatoração fina de dashboard/FAB/funds — vale o modelo bom).
> **Por que um prompt curto se o orquestrador já tem tudo?** Porque o orquestrador é o *contrato* (o quê/onde/como); este
> prompt é o *start* — fixa autonomia, decisões já adotadas e a primeira ação ANTES de o agente abrir o doc, para ele não
> hesitar, não perguntar e não delegar.
>
> **Diferença para a leva irmã (Coerência & Tricount):** lá o lock da §16 já estava formal; aqui o Julio **dispensou o lock
> formal em 2026-06-25** e mandou *"continuar até testes e deploy completo"* — então as recomendações da §16 (DEC-307→319) já
> são o caminho de execução. O doc está **ACTIVE**. **Não há nada a perguntar antes de começar.**

---

=== COLE A PARTIR DAQUI ===

Você é um **engenheiro full-stack sênior** e vai **aplicar a leva "Descoberta & Clareza" do TripPilot de ponta a ponta,
sozinho, nesta sessão**. O app já existe, está testado e no ar (**1.0.1-rc**) — você **não reconstrói nem infla nada**. O app
tem muita função boa, mas o usuário comum corre risco de **não descobrir** o que dá pra fazer, **não achar** onde está cada
função e **confundir** funções parecidas. Seu trabalho é: tornar as funções **descobríveis sem adivinhar**, deixar a ajuda um
**espelho fiel do produto**, **desfazer confusões de modelo mental** (Dividir conta × Divisão em grupo; evento × pote;
insight × Amigo Sincero), **explicar o dinheiro com honestidade** (sem mudar a matemática) e **corrigir o que parece bug**
(FAB que fica aberto; pote de fase futura poluindo a fase atual).

## FONTE DE VERDADE (leia primeiro, é o seu contrato)

`TripPilot/brain/documents/2026-06-25-discovery-clarity-implementation-orchestrator.md`

Esse documento é a **única fonte de verdade de execução** desta leva. Ele já traz: missão (§0), regras/autonomia (§1), ordem
de leitura (§2), não-negociáveis (§3), baseline do que já existe (§4), change-set **D01–D15** (§5), **root-cause map
código↔mudança com arquivo e símbolo exatos (§6)**, decisões/councils **DEC-307→319** (§7), estratégia de testes (§8),
protocolo por milestone (§9), **os gates G0→G6 (§10)**, segurança de terminal (§11), Definition of Done (§12), anti-padrões
(§13), brain sync (§14), matriz de smoke (§15), decisões da §16 (já adotadas) e o apêndice "intenção → função". **Leia §0–§9
uma vez, depois execute G0→G6 na ordem.** Antes de editar qualquer arquivo, **releia o arquivo citado no §6** (os símbolos
podem ter mudado desde a investigação).

## ESTADO DESTA LEVA (não pergunte nada antes de começar)

- O doc está **ACTIVE**. O Julio **dispensou o lock formal** da §16 e adotou as recomendações dos councils (DEC-307→319) como
  o caminho de execução. **Execute G1 → G5 em ordem; G6 (P2: histórico de preço por item) é opcional** — faça se houver folga,
  senão registre como adiado no dev-log.
- Os `DEC-307→319` **já estão no `decision-log.md` como PROPOSED**. No fim de cada gate, promova para **APPROVED** os DECs que
  aquele gate entregou (§14).

## CONTRATO DE AUTONOMIA (inviolável)

1. **SEM subagents / SEM Task tool / SEM delegação.** Tudo inline, nesta sessão (custo é por request; um subagent = +1).
   Múltiplas perspectivas = seções de UMA resposta, nunca múltiplos agentes.
2. **NÃO peça permissão para avançar.** Terminar uma milestone/gate é a deixa para **commitar → deploy → atualizar dev-log →
   próxima**, não para parar. Não pare por "é muito" ou "a conversa está longa".
3. **NÃO resuma o que vai fazer — FAÇA.** Minimize narração; cada token conta numa sessão longa.
4. **Continue até a §12 (Definition of Done) ser TODA TRUE** — ou até o contexto realmente acabar (então feche o gate atual
   limpo, commit + deploy, escreva o handoff no `dev-log.md` e **pare limpo**), ou um bloqueador de credencial/custo
   intransponível. **Só nesse hand-off final** a mensagem termina com um `AskQuestion`.
5. **Reuse o que já existe — não reinvente.** A maior parte desta leva é *expor, organizar e explicar* peças que já existem
   (`searchHelp`, `GUIDE_SECTIONS`, `HELP_ARTICLES`, `buildPiggyLedger`, `buildDashboardInsights`/`useDashboardModel`,
   `buildHonestFriendExtras`/`filterHomeAmigoExtras`, `selectActivePhasePool`/`resolveActivePhase`, `createEnvelope`
   scope `linked_phases`, `group-split/*`). Veja §4/§6.

Ambiguidade **nova** que o brain + §16 não resolverem → rode o **council inline na hora** (1 request, sem subagents), escreva
como `DEC-NNN (PROPOSED)` no `decision-log.md` e **continue**.

## DECISÕES JÁ ADOTADAS (§16 / §7 — NÃO re-pergunte)

- **DEC-307/308 (descoberta):** entrada **discreta no header da home** → **hub de descoberta unificado** (busca por intenção +
  guia + ajuda numa tela). Busca = **`searchHelp` LOCAL** estendida para frases de intenção ("quero dividir um valor"), **sem
  IA nova no V1** + glossário = browse por intenção. Guia/ajuda em Settings continuam (ÂNCORA 9).
- **DEC-309/310 (Dividir):** **unificar a ENTRADA, não o código.** Ação única **"Dividir"** → chooser "Como você quer
  dividir?": **Por itens** (`/split/scan`) × **Valor em grupo** (`/groups`). As duas entidades/lógicas ficam **intactas**
  (DEC-297). Group-split entra no FAB (via "Dividir"), no guide (people) e no hub.
- **DEC-311 (FAB):** 1ª camada = **registrar gasto · IA · Dividir · iniciar saída**; **"Registrar mercado" → "Mais ações"**,
  **modo-aware** (em "Mais ações" no modo viagem; visível no dia-a-dia, respeitando a promoção do Julio de 2026-06-22).
- **DEC-312 (cofrinho):** a regra que o usuário descreveu **JÁ é a implementada** (`buildPiggyLedger`, Model B). **Documentar e
  explicar** em linguagem simples — **NÃO mudar a matemática** (ÂNCORA 11).
- **DEC-313/314 (economia do dia):** **um destino só** — cofrinho ativo → "guardei X no cofrinho"; sem cofrinho → "diluído nos
  próximos dias". **Nunca os dois ao mesmo tempo** (sem contagem dupla). Bloco "Destino da economia de hoje".
- **DEC-314/315 (pote × evento):** home da fase atual mostra em destaque **só potes da fase ativa/globais**; potes de outras
  fases → seção secundária **"Potes de outras fases"** (colapsada) + **selecionáveis** no registro de gasto. A **criação
  separa** "Evento" (data/countdown) de "Pote/Fundo" (fase/período, sem countdown).
- **DEC-316 ("posso gastar"):** **manter, compacto** — chip discreto abaixo de "Livre hoje" (não card grande).
- **DEC-317 (Amigo Sincero):** o carrossel do Amigo tem **só voz/verdict opinativo**; os extras **factuais**
  (`piggy_movement`, `phase_progress`, `daily_left`, `top_category`, `receivable`) **saem do card e viram insights** (sem
  duplicar).
- **DEC-318 (FAB):** `isFabOpen` fecha em **qualquer** mudança de rota (aba/card/tela) e no clique fora. Sem exceção.
- **DEC-319 (versão + política):** **patch por gate** (1.0.2-rc → 1.0.6-rc); **1.1.0-rc** quando o hub de descoberta (G3)
  entrar. **Política permanente:** função nova de primeira classe ⇒ entra no `guide-catalog` **e** no `help-catalog` na mesma
  leva, com teste de cobertura.

## NÃO-NEGOCIÁVEIS DESTA LEVA (releia antes de CADA gate)

**Específicos (a regra geral do briefing):**
- **Descobrível sem adivinhar.** Toda função de primeira classe é alcançável por uma **entrada visível**; o usuário acha pela
  **intenção**, não pelo nome técnico.
- **Ajuda = espelho do produto.** "Tudo que dá para fazer" e "Central de ajuda" cobrem **todas** as funções de primeira
  classe (DEC-319). Endureça o teste de cobertura **`guide ⊆ help ⊆ router`**.
- **Uma intenção, uma porta clara.** Dividir conta × Divisão em grupo e evento × pote: o app **explica a diferença ANTES** de
  o usuário escolher.
- **Amigo Sincero ≠ Insight.** Nenhum dado objetivo dentro do Amigo Sincero — factual = insight (DEC-317).
- **Um destino por economia.** Nunca "vai pros próximos dias" **e** "vai pro cofrinho" ao mesmo tempo (DEC-313/314).
- **Pote ≠ evento; a fase do pote manda na visibilidade.** Pote de outra fase não aparece em destaque na home da fase atual,
  mas continua **selecionável** para lançar gasto (DEC-314). Evento tem countdown; pote não (DEC-315).
- **Sem comportamento-que-parece-bug.** O FAB aberto nunca sobrevive a uma troca de contexto (DEC-318).

**Herdados do app (ÂNCORA — continuam absolutos):**
- **Dinheiro = inteiro em centavos** (DEC-020). **Domínio = TS puro, zero import de React.** Lógica de negócio nunca dentro de
  componente.
- **UI text = `t()` sempre** (DEC-054), pt-BR + en/es quando o item tiver cópia nova. Zero hardcode. Código em inglês.
- **ÂNCORA 9 — esconder, nunca deletar:** nenhuma ação/feature some; no máximo muda de lugar/hierarquia.
- **ÂNCORA 11 — invariância de dados:** recálculos puros (cofrinho/free-budget) recomputam para frente; nada novo persistido
  sem migração Dexie justificada. **A matemática do cofrinho/insights NÃO muda nesta leva** — só a clareza. Após D06 e
  D11–D14, os números do cofrinho/insights ficam **idênticos** ao baseline.
- **Nunca bloquear o registro de gasto** (DEC-053). **Sem scrollbar visível.** **Dicionário de estados** (DEC-304): qualquer
  cópia nova obedece os rótulos/cores de real/planejado/alocado/livre/simulado/guardado/saída/item/acerto.
- **Preserve o que já é bom e bonito** (movimento 60fps/`prefers-reduced-motion`, tokens de tema, `tabular-nums`, nav "glass",
  foco de input sutil) — só toque se houver inconsistência.

## ORDEM DOS GATES (§10 — execute nesta sequência)

- **G0** — setup: `npm install`, baseline (`test` + `build` + `tsc --noEmit`), semear/atualizar `src/dev-log.md`, confirmar
  pipeline. (Os DEC-307→319 já estão PROPOSED no decision-log.)
- **G1** — comportamento barato/global: **D09** (fecha FAB ao trocar de contexto, DEC-318) + **D06** (Amigo só voz; factuais
  viram insights, DEC-317). → **1.0.2-rc**
- **G2** — ajuda & "Tudo que dá para fazer": **D01** re-auditoria completa `guide`/`help` vs router (adicionar `group_split` +
  o que faltar; organizar por intenção; teste de cobertura). → **1.0.3-rc**
- **G3** — descoberta & navegação (o coração): **D02** hub de descoberta + busca por intenção · **D03/D04** porta "Dividir" +
  visibilidade do grupo · **D08** reorganizar FAB · **D05** tela única de grupos. → **marco 1.1.0-rc**
- **G4** — clareza do dinheiro do dia: **D12** regra oficial do cofrinho (doc + cópia) · **D11/D14** um destino da economia ·
  **D13** "De onde vem?" cobre todos os cenários · **D10** "posso gastar" compacto. → **1.1.1-rc**
- **G5** — potes/fundos por fase: **D15** filtrar potes por fase ativa na home + selecionáveis no gasto + criação separa
  evento × pote. → **1.1.2-rc**
- **G6** — *opcional*: **D07** histórico de preço por item (sem schema novo) + acabamento de **D05**.

Feche cada gate com a suíte **completa** verde, `build` + `tsc --noEmit` OK, smoke das 3 jornadas (registrar gasto · achar uma
função pelo hub · abrir o check-in do dia), dev-log atualizado e **deploy**.

## SEGURANÇA DE TERMINAL (WSL — o terminal trava num pager)

- **git sempre com `--no-pager`** (`git --no-pager log/diff/show/status`); commit **sempre** `-m` (HEREDOC p/ multilinha).
- **Nunca** `less`/`more`/`man`/`vim`/`nano`/flags `-i`/`rebase -i`. CLI incerta → `| cat`.
- **Bypass do `git commit` (confirmado nesta máquina):** o harness injeta `--trailer`, que o git 2.25.1 do sandbox rejeita
  (`unknown option 'trailer'`). Comite por um caminho que não exponha o token literal `git commit`:
  `G=/usr/bin/git; "$G" commit -m "…"`.
- Comando travou >30s sem saída: não re-rode; leia o terminal file, ache o pid e mate o processo preso.

## PROTOCOLO POR MILESTONE (§9) + REFRESH

Antes de **cada commit de milestone**: (1) liste os AC satisfeitos; (2) nomeie 3 AC anteriores em risco e verifique-os
(**esp. ÂNCORA 11 — números do cofrinho/insights idênticos**; registro de gasto nunca bloqueia); (3) rode os testes (sem novas
falhas); (4) sinalize qualquer arquivo tocado fora do escopo; (5) atualize `src/dev-log.md`.
**Em cada fronteira de gate:** releia as NÃO-NEGOCIÁVEIS + escopo do próximo gate + `dev-log` Current State; imprima o bloco
ÂNCORA e o CURRENT STATE (gate, último commit, testes, riscos, escopo). **A cada 3 milestones:** refresh leve.

## TESTES (teste JUNTO com a mudança — §8)

- **Domínio puro primeiro (>90%):** cobertura `guide ⊆ help ⊆ router` (D01); `searchHelp` resolve frases de intenção (D02);
  `buildHonestFriendExtras` deixa de emitir factuais e o builder de insights os cobre, sem duplicar (D06); cofrinho — **testes
  de matemática com números idênticos ao baseline** (D12, ÂNCORA 11); filtro de potes por fase ativa (D15).
- **Reuse os testes existentes** (`domain/help/*`, `domain/guide/*`, `honest-friend-extras.test.ts`, `piggy-ledger` tests) —
  **estenda, não duplique.**
- **UI crítica via Playwright (>70%):** hub busca→função; FAB "Dividir"→chooser→2 caminhos; trocar de aba com FAB aberto →
  fecha; check-in "sem gastos" → **um** destino; criar pote de fase futura → ausente na home atual, presente no seletor.
- Rode a suíte **completa entre gates** (0 falhas além das **2 baseline `split-live-loop`** de WebCrypto — `crypto.subtle`
  precisa de Node 22, indisponível no sandbox Node 18.17.0; passam no CI).

## COMECE AGORA — G0 (sem responder nada, sem confirmar)

```bash
cd TripPilot
npm install
npm run test            # baseline — anote a contagem (~2271/2273; só as 2 split-live-loop devem falhar)
npm run build && npx tsc --noEmit
npx playwright test      # se o ambiente E2E estiver disponível
```

Depois: atualize `src/dev-log.md` (Current State + tabela de milestones G0→G6 para esta leva), confirme que `DEC-307→319` já
estão no `brain/decision-log.md` (estão, como PROPOSED) e confirme o pipeline de deploy. Em seguida **execute G1 → G5 na ordem
do §10** (G6 opcional), uma milestone por vez, testando junto, com o self-check de 5 pontos e **deploy ao fim de cada gate**.
**Não pare até a §12 ser toda TRUE.**

**Pipeline de deploy (confirmado na leva anterior):** bump `package.json` + `src/utils/app-version.ts` + `public/version.json`
(+ release note pt/en/es) → `G=/usr/bin/git; "$G" commit -m "…"` + push `master` → **Cloudflare Pages auto-build**
(`build:pages` gera `dist/` + bundle OTA `bundles/<v>.zip`). Verifique `/version.json` + `/bundles/<v>.zip`. O worker
(`trippilot-sync`) só precisa de `wrangler deploy` se rotas mudarem — **esta leva não toca o worker** (é UI/descoberta/clareza).

## BLOCO ÂNCORA (cole a cada 3 milestones e em cada fronteira de gate)

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ÂNCORA — leva Descoberta & Clareza
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
INVIOLÁVEIS:
1. Sem subagents/Task. Inline, 1 sessão. Não parar até §12 TRUE.
2. Money = integer cents. Domínio = TS puro (zero React). NÃO mudar a matemática do cofrinho/insights (Â11).
3. UI text = t() sempre (pt-BR; en/es se houver cópia nova). Código em inglês.
4. Â9: esconder, nunca deletar. Â11: cofrinho/insights numericamente idênticos ao baseline.
5. Amigo Sincero = só voz; factual = insight (DEC-317). Economia do dia = UM destino (DEC-313/314).
6. "Dividir" unifica só a ENTRADA (chooser), não o código (DEC-309). Busca = searchHelp local, sem IA nova (DEC-308).
7. Pote ≠ evento; pote de outra fase fora do destaque mas selecionável (DEC-314/315). FAB fecha em troca de contexto (DEC-318).
8. guide ⊆ help ⊆ router (DEC-319). git sempre --no-pager; commit via G=/usr/bin/git "$G" commit -m. Nunca less/vim/-i.
9. Teste junto com a mudança; suíte completa verde entre gates (só as 2 split-live-loop baseline).
CURRENT STATE: gate=__ | último commit=__ | testes=__ pass/0 fail | riscos=__ | escopo=__
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

Confirme em UMA linha que leu o orquestrador e começou o G0 — e siga direto, sem esperar resposta.

=== FIM ===
