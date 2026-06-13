# TripPilot — Plano Mestre de Expansão (Fase de Planejamento)

> Criado: 2026-06-13
> Status: **EM EXECUÇÃO — Fases 1, 2, 3 e 4 FEITAS** (Package 1, v0.8.3→v0.10.1, DEC-138..149; Package 2, v0.10.2→v0.12.1, DEC-150..156; 2026-06-13); **Pacote 3 (Fases 5+6) PRONTO p/ rodar** (`phase-package-3-context-security.md`); Fase 7 (P2P v2) = V2
> Fonte: brainstorm das 50 ideias + feedback idea-por-idea do Julio (2026-06-13)
> Base de código auditada: v0.8.2 (137 DECs, Dexie v4, 504 testes)

---

## 0. O que é este documento

Julio revisou as 50 ideias do brainstorm uma a uma e deu o veredito de cada uma.
Este documento faz o trabalho que ele pediu: **entender o app de verdade, agrupar as
ideias que na verdade são um produto só, descobrir onde cada coisa vive (tela, fluxo,
domínio, dados), o que ela toca (risco de regressão) e organizar tudo em fases grandes
priorizadas** — para implementar com o menor número de requests e sem introduzir bugs.

Não é uma lista de funções soltas. É um plano de produto: começa onde, termina onde,
precisa de tela nova ou não, e em que ordem faz sentido construir.

### Princípio condutor (decorrente da dor do Julio)

> "A gente está colocando muita coisa. Às vezes o usuário quer entrar e fazer uma coisa
> simples." — Julio

O app cresceu para 137 decisões. A reorientação central deste plano é **duas portas para
a mesma base de dados**: um **Modo Simples** (entra, vê 1 número, registra) e o **Modo
Completo** (tudo que já existe). Quase toda feature nova deve nascer perguntando "isso
aparece no Modo Simples?".

---

## 1. Princípios de execução (anti-bug)

Estas regras valem para TODAS as fases e existem para evitar o que o Julio teme
("adicionar uma função que mexe em outra função e causa bug"):

1. **Cada fase é contida a uma área de código.** Uma fase mexe em QuickAdd+Outing, OUTRA
   mexe em Insights+Dashboard. Não espalhar uma fase por todo o app — isso confina o risco
   de regressão e facilita o teste.
2. **Reusar padrões existentes, nunca criar paralelos.** Já existem: orquestradores atômicos
   (`registerExpense`, `endOutingSession`...), `BottomSheet`/`Toast`, sistema de cards
   configuráveis (`hiddenDashboardCards`/`dashboardCardOrder` + `DashboardConfigPage`),
   stepper de enriquecimento, `useAppData` (provider único). Toda feature pendura nesses
   trilhos.
3. **Schema-impact primeiro.** Antes de cada epic, declarar se precisa de migração Dexie.
   Boa notícia: `AppSettings` é linha única com campos não-indexados e `Transaction` aceita
   campos não-indexados → a MAIORIA das features novas **não precisa de migração** (igual
   `subcategoryId` em DEC-095). Migração só quando precisar de índice novo ou tabela nova.
4. **Toda função financeira nova ganha teste de matemática** (regra do workspace). Meta:
   manter os 504 testes verdes e só somar.
5. **Gates a cada 5-6 milestones** (regra phase-delivery-hardening): build + typecheck +
   testes verdes + golden-path (criar gasto / rodar saída / ver dashboard) antes de seguir.
6. **Cirúrgico.** Cada linha alterada rastreia a um milestone. Nada de "melhorar" código
   vizinho fora de escopo.
7. **Regression-watch explícito por epic.** Cada epic abaixo lista o que ele PODE quebrar e
   como evitar — esse é o coração do pedido do Julio.

---

## 2. Mapa do código que este plano toca

| Área | Arquivos-chave | Usado por epics |
|------|----------------|-----------------|
| Roteamento / shell / nav | `src/app/router.tsx`, `app/AppShell.tsx`, `components/BottomNav.tsx` | E1 |
| Onboarding | `features/onboarding/OnboardingPage.tsx`, `domain/onboarding/onboarding.ts`, `orchestrators/onboarding-orchestrators.ts` | E1 |
| Settings | `features/settings/SettingsPage.tsx`, `DashboardConfigPage.tsx`, `domain/types/app-settings.ts` | E1, E6, E10 |
| Quick Add | `features/expenses/QuickAddPage.tsx`, `domain/transactions/transactions.ts`, `orchestrators/expense-orchestrators.ts` | E2, E8, E9 |
| Saída | `features/outing/OutingPage.tsx`, `BarModeView.tsx`, `domain/outing/outing.ts`, `outing/enrichment.ts`, `orchestrators/outing-orchestrators.ts` | E3 |
| Insights / Dashboard | `domain/insights/insights.ts`, `insights/notifications.ts`, `features/dashboard/DashboardPage.tsx`, `DashboardCards.tsx`, `cards/*`, `domain/dashboard/dashboard-cards.ts` | E4, E5, E6 |
| Orçamento / previsão | `domain/budget/budget.ts`, `budget/honest-friend.ts`, `budget/rescue.ts`, `domain/forecasting/*` | E4, E5, E6, E9 |
| Aprendizado / perfis | `domain/profiles/profiles.ts`, `profile-presets.ts`, `orchestrators/profile-orchestrators.ts` | E3, E7 |
| Fases / ritmo | `domain/phases/phases.ts`, `phases/rhythm.ts` | E5, E7 |
| Divisão / dívidas | `domain/splitting/splitting.ts` (`resolvePayerExpense`, `calculateDebts`) | E3, E11 |
| Dinheiro / câmbio | `domain/money/money.ts`, `money/anchor.ts`, `domain/wallets/wallets.ts` | E9 |
| Backup / export | `domain/backup/backup.ts`, `backup/csv-export.ts`, `features/backup/BackupPage.tsx` | E10 |
| Sync P2P | `domain/sync/*`, `data/sync/*`, `features/sync/*`, `worker/` | E11 |
| Schema | `src/data/db/schema.ts` | qualquer migração |

---

## 3. Síntese: das 50 ideias para EPICS de produto

Aqui está o trabalho de convergência. Onde o Julio disse que "2 ideias são 1 coisa só",
elas viram um epic. Para cada epic: o que é, onde vive, fluxo, tela nova?, o que toca
(risco), impacto de schema, e dúvidas.

### E1 — Modos do App & Início Inteligente
**Funde:** ideia 1 (Modo Simples) + 2 (onboarding 1 pergunta) + 3 (defaults por tipo) + 4
(modo adaptativo). Julio: *"perguntar se ele quer início simples e depois vai adicionando,
ou início completo"*; *"defaults bons para o início simples"*.

- **O que vira:** o app passa a ter um estado `appMode: 'simple' | 'complete'` (em
  `AppSettings`, sem migração). No fim do onboarding o usuário escolhe a porta. Modo Simples
  = dashboard com 1 número grande ("livre hoje"), 1 botão registrar, e nada mais; esconde
  Planner, Perfis, Simulador e entrada de Saída da navegação. Modo Completo = o app atual.
  "Início inteligente" preenche typical/safe/ritmo/reserva por preset de viagem para o
  usuário só confirmar.
- **Onde vive:** `AppSettings.appMode`; `BottomNav` e `router` (quais abas/rotas aparecem);
  `OnboardingPage` (passo final "Simples vs Completo" + caminho de 1 pergunta);
  `onboarding.ts` (defaults calculados); `DashboardPage` (variante simples do hero).
- **Fluxo:** Welcome → onboarding mínimo (nome + quanto + até quando) → **escolha de modo** →
  dashboard. Em qualquer ponto, Settings tem "Mudar para Modo Completo/Simples". Modo
  adaptativo: depois de N gastos, um card discreto oferece desbloquear um recurso ("quer
  ativar o Modo Saída para noitadas?").
- **Tela nova?** Não há tela inédita pesada — é uma **variante** do Dashboard + um passo no
  onboarding + toggle em Settings. (Reusa tudo.)
- **O que toca / risco:** ALTO acoplamento (mexe em nav, onboarding, dashboard). Risco: um
  recurso escondido no Modo Simples ainda ser acessível por deep-link e confundir. Mitigação:
  `appMode` é só de *apresentação* — os dados e rotas continuam existindo; o Modo Simples
  apenas **oculta**, nunca apaga. Guardas de navegação redirecionam rotas "completas" para o
  dashboard quando em Modo Simples (com opção "abrir mesmo assim").
- **Schema:** sem migração (`appMode` é campo não-indexado em AppSettings).
- **Dúvida/decisão:** **D1** (modelo dos dois modos + o que exatamente some no Simples) e
  **D-ordem** (E1 primeiro ou depois da captura?).

### E2 — Captura Sem Atrito (QuickAdd)
**Funde:** ideia 10 (calculadora) + 5 (memória por descrição) + 6 (repetir/favoritos) + 14
(transporte ida-e-volta) + 22 (aviso de anomalia) + 9 (voz, opcional). Todos no MESMO fluxo
de registrar gasto. Julio: "perfeito/ótimo/prático" em todos; voz "só se não der muito
trabalho".

- **O que vira:** o formulário de gasto fica esperto: o campo de valor aceita `12+3,50`
  (calculadora); ao digitar a descrição, sugere categoria/subcategoria/valor do último gasto
  com aquele texto; uma linha de "repetir" mostra os 3-4 gastos mais frequentes (1 toque);
  transporte oferece "ida e volta?" para duplicar; se o valor está muito acima do típico do
  perfil, pede confirmação ("€18 de transporte? seu normal é €6").
- **Onde vive:** quase tudo em `features/expenses/QuickAddPage.tsx` + uma função de domínio
  nova pura (`domain/transactions/`) que deriva a memória/favoritos **das transações
  existentes** (sem tabela nova). Anomalia usa `ActivityProfile.typicalValueCents` já
  existente.
- **Fluxo:** começa no QuickAdd (FAB), termina no save (`registerExpense`). Memória e
  favoritos são derivadas, então funcionam desde o 2º gasto parecido.
- **Tela nova?** Não — tudo dentro do QuickAdd.
- **O que toca / risco:** MÉDIO. A calculadora muda o parsing do `amount` (hoje
  `type="number"` + `parseFloat`). Risco: quebrar entrada decimal/locale. Mitigação: avaliar
  a expressão só na hora de salvar, manter o input tolerante, testes de parsing
  (`1.234,56`, `12+3,5`, `10*2`). Anomalia NÃO bloqueia (regra DEC-053) — só confirma.
- **Schema:** sem migração.
- **Dúvida/decisão:** **D6** (incluir voz como milestone opcional ou cortar).

### E3 — Modo Saída v2
**Funde:** ideia "valores fixos viram últimos usados" + "repetir o item que acabei de pôr"
(feedback explícito do Julio) + 16 (rodada) + 36 (rotação "quem paga a próxima" → "sistema
de rodadas na saída ativa") + 18 ("e se a noite continuar") + 19 (pré-comprometimento →
**fundido**, não vira tela separada). Julio sobre pré-commit: *"isso já não é o modo saída?
ele já tem meta"* → correto, vira só um ajuste, não feature nova.

- **O que vira:** na saída ativa, os botões de valor rápido passam a refletir os **últimos
  valores usados** (gastei €4,50 → o €5 vira €4,50 e fica reaproveitável); um botão "repetir
  último item"; um botão "Rodada" que lança N × preço médio de uma vez; rotação de quem paga
  a rodada (leve, só sugestão); uma linha de **projeção temporal** ("no seu ritmo, em ~1h
  você chega no teto") usando tempo decorrido + taxa de gasto.
- **Onde vive:** `domain/outing/outing.ts` (valores dinâmicos a partir dos `SessionItem`
  recentes; projeção temporal — função pura nova; rodada = helper que cria N itens via
  orquestrador existente) + `features/outing/OutingPage.tsx` e `BarModeView.tsx` (UI).
  Rotação usa `participants` + quem pagou itens da sessão.
- **Fluxo:** dentro da sessão ativa; nada sai da tela de saída. Termina no end-of-session
  já existente (DEC-049).
- **Tela nova?** Não — incrementa a saída e o Bar Mode (DEC-127).
- **O que toca / risco:** MÉDIO. Mexe na matemática do total da sessão e nos limites
  (`calculateSessionTotal`, `getProgressiveAlerts`, `calculateNextDrinkImpact`). Risco:
  rodada compartilhada confundir custo pessoal vs total (DEC-047/114). Mitigação: rodada
  reusa `resolvePayerExpense`; testes para "rodada de 4, eu paguei" e "rodada dividida".
  Projeção temporal é só leitura (não altera dados).
- **Schema:** sem migração (valores dinâmicos derivam dos itens; opcional: persistir
  `quickAddValuesCents` aprendido no `ActivityProfile`, que já existe).
- **Dúvida/decisão:** **D5** ("Dividir a conta no fim" — Julio achou redundante com marcar
  divisão item a item; recomendo **não** construir o fluxo separado e deixar a divisão via
  rodada/stepper cobrir).

### E4 — Insights v2 & Check-in Diário
**Funde:** ideia 13 (modo fim do dia → "pergunta nos insights, só se não registrou nada") +
"liberar o limite de 4 insights, ordenar dos mais importantes aos menos, e girar
automático" (feedback explícito) + 23 (dia perigoso, "muito bem desenhado, só quando tem
algo diferente") + 26 (alerta de ritmo por categoria, "fazer") + 39 (check-in diário +
"notificação perguntando como será o dia, responder na notificação") + 21 (pegar emprestado
de amanhã → vira **aviso** no simulador, anexado aqui).

- **O que vira:** o bloco de insights deixa de ter teto de 4 — mostra **todos os
  significativos, ordenados por importância**, e **gira sozinho** a cada X segundos (além do
  swipe). Novos builders: "fim do dia" (só aparece se nada foi registrado hoje, perguntando
  o que gastou); "ritmo por categoria" ("Bar já comeu 60% do plano da fase no dia 3 de 10");
  "dia perigoso" (sábado você gasta 2× — só quando o desvio é real); "check-in de intenção"
  (tranquilo/passeio/noite). O check-in também pode chegar por notificação respondível.
- **Onde vive:** `domain/insights/insights.ts` — remover `MAX_INSIGHTS_PER_DAY`/`slice`,
  adicionar campo de prioridade por insight e ordenar; adicionar builders ao array
  `INSIGHT_BUILDERS`. Auto-rotação na UI (`DashboardCards.tsx`, já tem carrossel + dots).
  Notificação via SW (`insights/notifications.ts` + a infra de notificação de saída,
  DEC-124). "Emprestar de amanhã" em `domain/budget/honest-friend.ts`/simulador.
- **Fluxo:** tudo no Dashboard. Check-in: 1 toque arma o contexto do dia (alimenta previsão).
- **Tela nova?** Não — incrementa o bloco de insights e o card de check-in.
- **O que toca / risco:** MÉDIO. Risco nº1 (o que o Julio teme): virar spam. Mitigação:
  manter a disciplina de "builder retorna null quando não é significativo" e calibrar
  gatilhos (dia perigoso só com desvio ≥ X; ritmo só com ≥3 dias de dados). Auto-rotação
  precisa pausar ao tocar/segurar. Notificação respondível tem limites de PWA (pesquisar —
  pode virar item Capacitor, DEC-017/120).
- **Schema:** sem migração (insights são derivados; check-in pode persistir 1 campo em
  AppSettings ou um ForecastSnapshot, sem tabela nova).
- **Dúvida/decisão:** "emprestar de amanhã" = **aviso**, não bloqueio (Julio: "você não
  pode, mas dá pra pegar de amanhã se não for usar amanhã").

### E5 — Ciclo da Fase (transição)
**Funde:** ideia 24 (planejador de sobra de fase, "muito bom pensar nisso já") + 32
(contagem regressiva entre fases, "ótimo").

- **O que vira:** quando uma fase termina com saldo, o app pergunta o que fazer com a sobra
  (joga pra próxima fase / vira reserva / libera pra compras). E um aviso de transição
  ("faltam 3 dias pra Eurotrip; você tem €40/dia até lá").
- **Onde vive:** `domain/phases/phases.ts` + `domain/budget/budget.ts` (mover saldo entre
  pools reusa orquestradores de CRUD/fundos). Contagem regressiva = builder de insight/card.
- **Fluxo:** disparado por data (fim de fase detectado) → BottomSheet de decisão → ação
  reusa edição de fundo existente.
- **Tela nova?** Não — BottomSheet + card.
- **O que toca / risco:** MÉDIO-ALTO. Mexe em saldo entre pools/fases — núcleo financeiro.
  Mitigação: a "sobra" só PROPÕE; mover dinheiro é uma ação explícita e atômica
  (orquestrador), com testes de "pool A → pool B preserva total da viagem".
- **Schema:** sem migração.

### E6 — Motivação (Meta & Cofrinho)
**Funde:** ideia 37 (meta de economia, "perfeito") + 38 (cofrinho, "perfeito").

- **O que vira:** o usuário define "quero voltar com €200 sobrando" e o app acompanha o
  progresso *em direção* à meta, ao lado do orçamento. Quando subgasta, o economizado vira
  um "saldo extra liberado" visível (cofrinho) que ele escolhe gastar ou guardar.
- **Onde vive:** `AppSettings` (ou Trip) ganha `savingsGoalCents`; cards novos no Dashboard
  (reusam o sistema de cards configuráveis); cálculo em `domain/budget/`.
- **Fluxo:** define a meta em Settings/Trip; vê progresso no Dashboard.
- **Tela nova?** Não — cards + 1 campo de configuração.
- **O que toca / risco:** BAIXO-MÉDIO (aditivo). Risco: cofrinho conflitar com o "livre hoje"
  subtrativo (DEC-088). Mitigação: cofrinho é uma LEITURA derivada do subgasto acumulado,
  não um pool real — não mexe na matemática do livre.
- **Schema:** sem migração.

### E7 — Continuidade entre Viagens & Aprendizado
**Funde:** ideia 29 (templates de viagens passadas, "muito bom") + 31 (lições → priors,
"perfeito, mas já ir calculando na própria viagem") + aprendizado in-trip contínuo.

- **O que vira:** os valores típicos/safe dos perfis **se ajustam continuamente durante a
  viagem** pelas médias das últimas saídas (Julio quer isso já acontecendo na viagem, não só
  no fim); ao terminar a viagem, o app propõe salvar os valores aprendidos como **priors do
  próximo** e a estrutura como **template reutilizável**.
- **Onde vive:** `domain/profiles/profiles.ts` (engine de aprendizado já existe — reforçar a
  atualização contínua respeitando DEC-115 occasions=sessions, special/exclude flags);
  templates = export/clonagem de Trip+Phases+Profiles (reusa backup/clone).
- **Fluxo:** aprendizado é invisível (roda ao fechar saída). Template: ação no fim da
  viagem / ao criar nova viagem ("usar template de viagem anterior").
- **Tela nova?** Pequena — seletor de template no onboarding/nova viagem.
- **O que toca / risco:** MÉDIO-ALTO. Mexe no engine de aprendizado (delicado: não pode
  contaminar média com special/excluído; tem que contar sessão como 1 ocasião). Mitigação:
  testes de aprendizado já existem — só somar; nunca alterar valor sem o usuário ver
  (DEC-007 "no silent preference changes").
- **Schema:** templates podem reusar o formato de backup (sem tabela nova) ou uma tabela
  `tripTemplates` (migração leve). **Decisão menor:** derivar de backup vs tabela dedicada.

### E8 — Local & Hora em Todo Gasto
**Funde:** ideia 12 (tag de lugar) elevada pelo Julio: *"usar GPS, trazer bares mais
próximos, escolher da lista ou buscar; e TODOS os gastos sem exceção deveriam guardar e
exibir horário e localização exata"*.

- **O que vira:** ao registrar (e ao iniciar uma saída), o app usa o GPS para sugerir o local
  e lugares próximos; o usuário escolhe da lista ou busca/digita. Todo gasto passa a guardar
  e mostrar hora + local. **Local "grudento" (decisão do Julio):** o app NÃO pergunta o local
  a cada gasto — ele lembra o local atual e só repergunta quando o GPS indica que você mudou
  de área. Dá pra trocar a qualquer momento tocando no nome do lugar. A **saída ativa mostra
  em qual local está acontecendo** (e permite trocar ali).
- **Onde vive:** novos campos não-indexados em `Transaction` (`placeLabel`, `latitude`,
  `longitude`, `placeId?`); um "local atual" persistido (AppSettings/estado de sessão) para o
  comportamento grudento; captura via Geolocation API no QuickAdd/Outing; exibição na lista
  (`ExpenseListPage`), detalhe (`ExpenseDetailPage`) e na saída ativa (`OutingPage`); lista
  local de lugares derivada das transações.
- **Fluxo:** primeira vez na área → (com permissão) sugere local → fixa como local atual →
  gastos seguintes herdam sem perguntar → GPS detecta mudança de área OU toque no nome do
  lugar → repergunta. Salva geo+timestamp → aparece em lista/detalhe/saída.
- **Tela nova?** Não, mas é a feature mais "pesada" do conjunto (permissão, fonte de lugares
  próximos, exibição em vários lugares, comportamento grudento).
- **O que toca / risco:** MÉDIO-ALTO + **privacidade**. Decisão do Julio: **implementar
  completo mesmo sabendo que parte não funciona offline, já preparando a função pra isso.**
  Coords de GPS funcionam offline; a LISTA de lugares próximos (reverse-geocode/POI) precisa
  de rede → offline cai pro local atual + nome manual + lugares já salvos. Guardar localização
  é sensível → **opt-in, não-bloqueante, 100% local, nunca sai do device**; fallback gracioso
  quando GPS negado.
- **Schema:** campos não-indexados em Transaction (sem migração de índice) + incluir no
  backup (bump de versão de backup, não de Dexie).
- **Status:** **D2 aprovado** — entra na Fase 5.

### E9 — Multi-moeda
**Funde:** ideia 45 (captura multi-moeda com âncora) + 46 (snapshot de câmbio offline,
"ótimo"). Julio: *"converte pra moeda da viagem, mas salva que o gasto real foi em outra
moeda; ver como fica a carteira"*.

- **O que vira:** registrar um gasto em moeda estrangeira (ex.: CZK em Praga numa viagem em
  EUR); o app converte pra moeda base e **guarda o valor/moeda original**. Taxa via âncora
  manual (DEC-128 já existe) ou snapshot puxado uma vez quando online e congelado.
- **Onde vive:** os campos já existem em `Transaction` (`currency`,
  `baseCurrencyAmountCents`, `exchangeRate`) — falta a UI no QuickAdd e o tratamento na
  carteira (`domain/wallets/wallets.ts` assume moeda única). `money/anchor.ts` reusado para
  taxa.
- **Fluxo:** QuickAdd → escolhe moeda + valor → app mostra conversão → salva original + base.
- **Tela nova?** Não — incrementa QuickAdd + detalhe.
- **O que toca / risco:** MÉDIO-ALTO. `getWalletBalanceCents` assume 1 moeda por carteira;
  gastar moeda estrangeira de uma carteira EUR precisa de regra (Julio levantou isso).
  Mitigação: decidir o modelo de carteira (carteira tem moeda; gasto estrangeiro converte
  para a moeda da carteira no débito, mantém original para histórico). Snapshot de câmbio
  toca o princípio offline (puxa rede 1×, opt-in).
- **Schema:** sem migração (campos já existem).

### E10 — Segurança de Dados & Compartilhamento
**Funde:** ideia 41 (histórico de backups, "área avançada das configs") + 42 (cofre pra
nuvem via share, "ótimo") + 44 (bloqueio PIN/biometria, "desativado por padrão, quem quiser
ativa") + 43 (visualizador HTML read-only, "infográfico da viagem com todas as infos").

- **O que vira:** snapshots locais versionados (restaurar "para ontem"), em
  Configurações > Avançado; 1 toque para mandar o backup pro Drive/email pelo share do SO;
  trava opcional do app (WebAuthn/PIN), off por padrão; exportar um HTML autocontido da
  viagem (um infográfico com tudo) pra abrir em qualquer lugar.
- **Onde vive:** `domain/backup/*` + `features/backup/BackupPage.tsx` + `SettingsPage`
  (seção Avançado); HTML viewer reusa `domain/sharing/share-card.ts` + dados de relatório.
- **Fluxo:** tudo em Backup/Settings; HTML export a partir da Trip Overview.
- **Tela nova?** Só a seção "Avançado" em Settings; o resto é aditivo.
- **O que toca / risco:** BAIXO-MÉDIO (área isolada). Risco: histórico de snapshots ocupar
  muito IndexedDB. Mitigação: manter só os últimos N; reusar o snapshot de emergência que já
  existe (DEC-137).
- **Schema:** snapshots no IndexedDB (tabela leve nova ou em localStorage como o de
  emergência) — **decisão menor**.

### E11 — P2P v2 (V2 / depois)
**Funde:** ideia 34 (acerto via P2P) reinterpretada por Julio: *"se já existe conexão com o
outro celular, não precisa de QR — manda 'eu paguei a dívida' e a pessoa confirma"* + ideia
50 (modo casal: um orçamento, dois celulares, "acho legal sim").

- **O que vira:** sobre o canal P2P existente (DEC-103..108), um fluxo de "marquei como
  pago" → o outro confirma/rejeita (espelha DEC-106/071); e um modo casal com orçamento
  compartilhado entre dois aparelhos.
- **Onde vive:** `domain/sync/*`, `data/sync/*`, `worker/`.
- **Risco:** ALTO (merge bidirecional de dinheiro é o que DEC-106 deliberadamente evitou).
  Modo casal é grande. → **V2**, depois de tudo acima estabilizar.

### Itens fora de epic / decisões abertas
- **Custos fixos / diárias (ideia 49):** Julio em dúvida — *"as hospedagens eu já paguei, uso
  o app pra gastos durante a viagem; ver se é o sentido do app ou fora de escopo"*. → **D3:
  decisão de escopo** (recomendo deixar fora do V1 deste plano; revisitar se houver demanda).
- **Share Target + OCR (ideia 15):** são duas coisas. *Web Share Target* (receber texto/URL
  compartilhado e pré-preencher um gasto) é barato e offline → **ENTRA** (Fase 6, junto do
  sharing). *OCR de screenshot* **não precisa de servidor** — `tesseract.js` roda 100% local
  no PWA; o custo é peso (alguns MB de WASM + dados de idioma) e precisão fraca em foto. →
  **DECIDIDO: fica pro futuro** como add-on local opcional (não é bloqueado pela regra
  local-first, só não compensa agora).
- **Dividir conta no fim (ideia 17):** ver E3/D5 — recomendo não construir separado.

---

## 4. DECISÕES NECESSÁRIAS (preciso destas para fechar o plano)

| ID | Decisão | DECIDIDO (2026-06-13) |
|----|---------|------------------------|
| **D-ordem** | Qual fase primeiro? | **Captura + Saída v2 primeiro** (Julio), Modo Simples em seguida. |
| **D1** | O que o Modo Simples esconde | Confirmado: esconde Planner/Perfis/Simulador/entrada de Saída; onboarding pergunta simples/completo; troca em Settings; revelação adaptativa. (Detalhe fino reconfirmado no início da Fase 2.) |
| **D2** | Local+hora em TODO gasto (GPS) | **ENTRA, completo.** Opt-in, não-bloqueante, 100% local. Local "grudento": não pergunta toda hora — guarda o local atual e só repergunta se o GPS indicar mudança de área. Editável a qualquer momento tocando no nome do lugar. Saída ativa mostra "em qual local está acontecendo". Preparar a função pra offline (coords funcionam offline; lista de lugares próximos só online → fallback gracioso). |
| **D3** | Custos fixos / diárias | **Fora** deste plano (app é gasto-durante-viagem). Revisitar se houver demanda. |
| **D4** | Share Target / OCR | Share Target **ENTRA** (Fase 6, offline). OCR **futuro** — viável 100% local (tesseract.js) mas pesado/impreciso; não compensa agora. |
| **D5** | "Dividir conta no fim" separado | **Não** — rodada (E3) + divisão por item cobrem. |
| **D6** | Voz no QuickAdd | **Opcional** dentro da Fase 1; cortável se custar caro. |
| **D7** | Aprendizado in-trip ajusta perfis | **Sugere/mostra**, nunca muda sozinho (DEC-007). |

---

## 5. Plano de Fases (grandes, ~15-20 milestones, sequenciais)

Cada fase é uma sessão de implementação (1 "pacote" via `/deliver`), contida a uma área,
com gates a cada 5-6 milestones. **Ordem definida (2026-06-13): Captura primeiro** (escolha do Julio).

### FASE 1 — Captura Rápida + Saída v2  *(Epics E2 + E3)* — ✅ FEITA (Package 1, v0.9.0, 2026-06-13; DEC-138..145)
**Objetivo:** registrar gasto e tocar uma saída fica o mais rápido possível (o uso diário).
**Por que primeiro (escolha do Julio):** é o que se usa todo dia — ganho imediato — e fica
contido a QuickAdd + Saída, sem depender do Modo Simples.
- M1. Calculadora no campo de valor (parse de expressão no save).
- M2. Memória por descrição (derivação pura das transações).
- M3. Linha "repetir" / favoritos (3-4 mais frequentes).
- M4. Transporte ida-e-volta (duplicar no save).
- M5. Aviso de anomalia (confirma se ≫ típico; nunca bloqueia).
- M6. (Opcional) voz → valor+categoria (cortável se custar caro).
- M7. Saída: botões de valor viram "últimos usados".
- M8. Saída: repetir último item (1 toque).
- M9. Saída: botão "Rodada" (N × preço médio) reusando `resolvePayerExpense`.
- M10. Saída: rotação "quem paga a próxima" (sugestão leve).
- M11. Saída: projeção temporal ("em ~1h no teto").
- M12. Simulador: aviso "dá pra pegar de amanhã" (não bloqueio).
- M13. i18n.
- M14-17. Testes (parsing, memória, rodada compartilhada, projeção) + e2e.
- M18. Gate final + brain.

### FASE 2 — Modo Simples & Início Inteligente  *(Epic E1)* — ✅ FEITA (Package 1, v0.10.0, 2026-06-13; DEC-146..149)
**Objetivo:** o usuário escolhe "simples" e usa o app sem ver a complexidade; ou "completo"
e tem tudo. **Por que aqui:** estrutural — define a arquitetura "dois modos" que as fases
seguintes respeitam; vem logo após a captura por ser a dor nº1 do Julio.
- M1. `AppSettings.appMode` + leitura global (provider).
- M2. Passo final do onboarding: "Começar simples (vai adicionando) vs Completo".
- M3. Onboarding de 1 pergunta (nome + quanto + até quando) → entidades com defaults.
- M4. Defaults inteligentes por preset (typical/safe/ritmo/dias de pico/reserva).
- M5. Variante simples do Dashboard (1 número + 1 botão).
- M6. `BottomNav`/`router` mode-aware (esconde Planner/Perfis/Simulador/Saída no simples).
- M7. Guardas de rota (deep-link de tela "completa" no simples → dashboard + "abrir mesmo
  assim").
- M8. Toggle "Mudar de modo" em Settings.
- M9. Revelação adaptativa (após N gastos, oferta de desbloquear recurso).
- M10. Empty states / microcopy do Modo Simples.
- M11. i18n (pt/en/es).
- M12-14. Testes (onboarding simples, troca de modo, guardas) + e2e.
- M15. Gate final + dev-log + atualizar brain (DECs novas).

### FASE 3 — Insights v2, Check-in & Ciclo de Fase  *(Epics E4 + E5)* — ✅ FEITA (Package 2, v0.10.2→v0.11.0, 2026-06-13; DEC-150..153)
**Objetivo:** o dashboard vira inteligência glanceável e honesta, sem virar spam.
- M1. Remover teto de insights + ordenar por importância.
- M2. Auto-rotação (pausa ao tocar) + manter swipe/dots.
- M3. Builder "fim do dia" (só se nada registrado hoje).
- M4. Builder "ritmo por categoria".
- M5. Builder "dia perigoso" (gatilho calibrado, anti-spam).
- M6. Check-in de intenção (card) que arma o contexto do dia.
- M7. Check-in por notificação respondível (best-effort PWA; pesquisar limites).
- M8. Sobra de fase (BottomSheet de decisão no fim da fase).
- M9. Mover sobra entre pools (orquestrador atômico).
- M10. Contagem regressiva entre fases (card/insight).
- M11. i18n.
- M12-15. Testes (significância dos builders, sobra preserva total) + e2e.
- M16. Gate final + brain.

### FASE 4 — Motivação & Continuidade entre Viagens  *(Epics E6 + E7)* — ✅ FEITA (Package 2, v0.11.1→v0.12.1, 2026-06-13; DEC-154..156)
**Objetivo:** dar um alvo positivo e fazer o app aprender de viagem pra viagem.
- M1. `savingsGoalCents` + card de progresso da meta.
- M2. Cofrinho (saldo extra liberado, leitura derivada do subgasto).
- M3. Aprendizado in-trip contínuo (ajuste de typical/safe pós-saída, respeitando flags).
- M4. Sugestão "atualizar valores" (mostra, não muda sozinho — D7).
- M5. Lições → priors no fim da viagem.
- M6. Salvar viagem como template.
- M7. Aplicar template em nova viagem / onboarding.
- M8. i18n.
- M9-12. Testes (meta, cofrinho não mexe no livre, aprendizado não contamina) + e2e.
- M13. Gate final + brain.

### FASE 5 — Local & Hora + Multi-moeda  *(Epics E8 + E9)*  — D2 aprovado (GPS opt-in)
**Objetivo:** contexto rico em cada gasto (onde/quando/qual moeda).
- M1. Campos de local em `Transaction` + incluir no backup.
- M2. Captura de GPS (permissão explícita, opt-in, fallback).
- M3. Lugares próximos (fonte definida em D2) + busca/nome manual.
- M4. Exibir hora+local na lista e no detalhe.
- M5. Revisão "gastos por lugar".
- M6. Multi-moeda: UI de valor+moeda no QuickAdd (campos já existem).
- M7. Conversão + guardar original (âncora/manual).
- M8. Tratamento de carteira em moeda estrangeira (regra de débito).
- M9. Snapshot de câmbio offline (puxa 1× online, congela; opt-in).
- M10. i18n + nota de privacidade.
- M11-14. Testes (geo opcional, conversão, saldo de carteira) + e2e.
- M15. Gate final + brain.

### FASE 6 — Segurança de Dados, Compartilhamento & Share Target  *(Epic E10 + Share Target)*
**Objetivo:** o usuário nunca perde dado, pode levar/mostrar a viagem, e registrar via share.
- M1. Histórico de snapshots versionados (Configurações > Avançado).
- M2. Restaurar "para ontem" a partir do histórico.
- M3. Cofre pra nuvem via share sheet + lembrete.
- M4. Bloqueio PIN/biometria (WebAuthn), off por padrão.
- M5. Visualizador HTML read-only (infográfico da viagem).
- M6. Web Share Target (manifest): texto/URL compartilhado pré-preenche um gasto (offline).
- M7. i18n.
- M8-10. Testes + e2e.
- M11. Gate final + brain.

### FASE 7 (V2 / depois) — P2P v2  *(Epic E11)* + escopos abertos
- "Marquei como pago" → confirma no outro device (sobre canal existente).
- Modo casal (orçamento compartilhado, 2 devices).
- Revisitar D3 (custos fixos) e D4 (OCR) se virarem prioridade.

---

## 6. Priorização (por que esta ordem)

Critério do Julio: *"o que faz mais sentido, o que vou usar mais, mais importante."*

| Fase | Epics | Frequência de uso | Valor p/ a dor | Risco regressão | Esforço |
|------|-------|:-----------------:|:--------------:|:---------------:|:-------:|
| 1 | Captura + Saída v2 | **Altíssima** (todo gasto/saída) | Alto | Médio | Médio |
| 2 | Modo Simples | — (estrutural) | **Altíssimo** (a dor) | Alto (cross-cutting) | Médio |
| 3 | Insights + Ciclo de fase | Alta (diário) | Alto | Médio | Médio |
| 4 | Motivação + Continuidade | Média-alta | Médio-alto | Médio-alto (aprendizado) | Médio |
| 5 | Local/Hora + Multi-moeda | Média | Médio (eurotrip) | Médio-alto (carteira/privacidade) | Alto |
| 6 | Segurança & Sharing | Baixa-média | Médio | Baixo | Médio |
| V2 | P2P v2 | Nichada | Alto p/ grupos | Alto | Alto |

**Decidido (2026-06-13): Captura primeiro** (escolha do Julio — ganho de uso imediato), Modo
Simples logo em seguida. As duas não dependem tecnicamente uma da outra; a captura vive no
QuickAdd/Saída (usado pelos dois modos), então construí-la antes não gera retrabalho quando
o Modo Simples chegar e apenas ocultar telas.

---

## 6.1 Estratégia de empacotamento (custo de request × context-rot) — 2026-06-13

Pesquisa (Chroma/Anthropic/Cursor/OpenAI, 2026): o limitador de qualidade não é o nº de
fases, é o **context rot** — todo modelo degrada conforme o contexto enche, começando por
~40-60% da janela; resumo automático perde nuance. A defesa comprovada é **estado no disco +
checkpoints por teste + reset a partir de handoff**, não janela maior.

Decisão de empacotamento (atualizada 2026-06-13 com a diretriz do Julio):
- **2 fases por pacote** (teto recomendado). 3+ fases: ganho de request pequeno, risco de
  degradar as fases finais alto → não compensa.
- O roadmap de 6 fases → **3 pacotes**: P1 = Fases 1+2, P2 = Fases 3+4, P3 = Fases 5+6.
- **Execução autônoma, sem parada entre fases.** O Julio não dá OK no meio. A IA roda do
  GATE 0 ao fim do pacote sem pedir aprovação — nem entre gates, nem entre fases. A transição
  Fase 1→Fase 2 deixa de ser um "stop point": vira checkpoint (verde + commit + deploy +
  handoff) e a IA **continua direto**. Só há parada se o contexto realmente esgotar — e aí
  para LIMPO no fim de um gate (tudo commitado/deployado) e o Julio retoma em chat novo lendo
  o state file (sem precisar aprovar nada).
- **Entrega incremental por gate**: a cada gate concluído (verde) a IA faz **bump de versão
  (package.json + app-version.ts) + deploy no Cloudflare Pages + atualiza as Novidades**.
  Esquema PATCH por gate, MINOR ao fechar uma fase (0.8.3 → … → 0.9.0 Fase 1 → … → 0.10.0
  Fase 2 → 0.10.1 final). Assim o Julio testa cada gate no celular.
- **Tela de Novidades no Sobre** (`AboutPage.tsx` + `src/utils/release-notes.ts`): cada versão
  lista o que entrou (pt/en/es), pro Julio abrir o Sobre, ver a versão e saber o que testar.
  Construída logo no **GATE 0 (M0)** do Pacote 1 — não fica pra Fase 6.
- O que de fato corta requests: rodar sem aprovação + retomada barata (state file + RECOVERY).
- Pacote 1 escrito em `phase-package-1-capture-simple-mode.md` (formato testado no
  `stability-fix-prompt.md`: ÂNCORA, STATE FILE, gates, checkpoint, recovery). **FEITO.**
- Pacote 2 escrito em `phase-package-2-insights-motivation.md` (Fases 3+4; mesmo formato;
  versão 0.10.1→0.12.1, 8 gates, baseline 614 testes). Pronto pra rodar em chat novo.
- Pacote 3 escrito em `phase-package-3-context-security.md` (Fases 5+6; mesmo formato;
  versão 0.12.1→0.14.1, 8 gates). Fecha o V1 expandido. Única migração Dexie do pacote =
  tabela `localSnapshots` (histórico). Backup sobe v4→v5 (campos de local). Pronto pra rodar.
- Os 3 pacotes cobrem Fases 1-6. Fase 7 (P2P v2 + modo casal) fica pra V2.

## 7. O que fica de fora (consciente)
- Backend, contas, sync automático em background (mantém DEC / V1 exclusions).
- IA/LLM dentro do app.
- Custos fixos/diárias (D3 — fora até decidir).
- OCR de screenshot (D4 — viável 100% local via tesseract.js, mas pesado/impreciso → futuro).
- "Dividir conta no fim" como fluxo separado (D5 — coberto por E3).
- Modo casal e merge bidirecional de dinheiro → V2 (E11).

---

*Decisões fechadas em 2026-06-13 (ver §4). Próximo passo: ao aprovar a Fase 1 (Captura +
Saída v2), gerar o pacote `/deliver` (START-HERE.md com gates) e registrar as features dessa
fase como DECs no decision-log.*
