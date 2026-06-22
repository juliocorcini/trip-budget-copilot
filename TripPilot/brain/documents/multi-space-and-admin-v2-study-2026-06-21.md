# Estudo — Múltiplas viagens, Modo "dia a dia" (contínuo) e Admin v2

> Data: 2026-06-21 · Autor: assistente (a pedido do Julio) · Status: **ESTUDO / PROPOSTA — pendente de ratificação.**
> Truth policy: nada aqui é decisão até virar `DEC-*` no `decision-log.md`. Os `DEC-249/250/251` abaixo são **propostos**.
> Pedido do Julio (resumo): (1) ideias/viabilidade de melhorias no Admin — tokens de IA por usuário, por função, histórico por dia/hora/mês + captura de erros dos usuários; (2) estudo completo de **mais de uma viagem ao mesmo tempo** (criar/planejar/ trocar/ver detalhes); (3) estudo de um **uso sem viagem** (conta contínua, sem data de início/fim) para uso diário (caso do cunhado: recebe gente em casa, divide tudo o tempo todo). Sempre com conselho, UX/UI pensados, e **mínimo de regressão**.

---

## 0. Achados de código que mudam o jogo (base factual do estudo)

Antes de qualquer conselho, o que o código JÁ tem (verificado):

1. **A camada de dados já é multi-viagem.** Todas as entidades são escopadas por `tripId` e o `useAppData` carrega tudo via `getByTripId(settings.activeTrip)` — `phases`, `pools`, `transactions`, `wallets`, `participants`, `occurrences`, `plannedPurchases`. O "qual viagem" é **um único ponteiro** `appSettings.activeTrip`. (`src/hooks/useAppData.ts`)
2. **Criar viagem é aditivo.** `createTripFromOnboarding` só faz `add` numa transação Dexie; **não apaga** viagens existentes. (`src/domain/orchestrators/onboarding-orchestrators.ts`)
3. **Status de viagem já existe:** `TripStatus = 'planning' | 'active' | 'completed'` e `tripRepository.getByStatus/getActive`. Uma viagem futura já tem onde morar (`planning`). (`src/domain/types/common.ts`, `trip-repository.ts`)
4. **O núcleo de divisão/acerto/pessoas/carteiras NÃO depende de data.** Splits, settlements, participants, wallets e `peerLinks` (registro global cross-trip) funcionam sem datas.
5. **O modelo de orçamento já modela "pote SEM data"** (sempre disponível) — base pronta para um "orçamento mensal" opcional num modo contínuo. (`brain/documents/budget-mental-model-study-part2-2026-06-17.md`)
6. **O que É acoplado a data:** fases (`phases`), pote da fase ativa / "dias restantes" / orçamento diário, forecasting, check-in "lente do dia", simulador. Esses são os pontos a **blindar** num modo sem data.
7. **IA:** o Worker chama Groq em `/assistant` (`max_tokens 2000`) e `/ocr` (`max_tokens 4096`); a resposta OpenAI-compatível traz `usage{prompt_tokens,completion_tokens,total_tokens}` que **hoje é ignorada**. (`worker/src/index.ts`)
8. **Erros:** já existe buffer local rotativo dos últimos 10 crashes com `message/stack/componentStack` + contador cumulativo `crashes` (já no Admin v1). (`src/utils/crash-log.ts`)

**Conclusão factual:** multi-viagem é **UX + orquestração** (risco de dados BAIXO). Modo contínuo é **reuso de Trip com um flag `kind` + portão de capacidades** (risco MÉDIO, concentrado nas superfícies de data). Admin v2 é **reuso do padrão DO+admin já entregue** (esforço M, não é pesado/impossível).

---

## 1. Admin v2 — tokens de IA por usuário + captura de erros (DEC-251 proposto)

### 1.1 Viabilidade (resposta direta ao "fica muito pesado/impossível?")
**Não é pesado nem impossível.** Tudo reusa o `TelemetryStore` (DO + SQLite) e o painel `/admin` que acabamos de entregar.

**Tokens de IA — desenho recomendado (server-authoritative):**
- O cliente passa o `installId` (UUID pseudônimo que já existe) no corpo das chamadas `/assistant` e `/ocr`.
- O Worker lê `usage.total_tokens` da resposta do Groq (a verdade está no servidor — não dá pra subnotificar) e grava numa nova tabela do DO `ai_usage(install_id, day, fn, tokens, runs)` (fn = `assistant` | `ocr`), com `UPSERT` por `(install_id, day, fn)`.
- Admin agrega: **tokens por usuário**, **por função**, **nº de execuções por função**, e **série temporal por dia** (e um rollup global leve `ai_usage_hourly(hour_bucket, tokens, runs)` para "por hora"; mês = soma de dias).
- Por que server-side e não cliente: a contagem real só existe na resposta do Groq; client-tally perde granularidade/histórico e subnotifica offline.

**Captura de erros — desenho recomendado:**
- Novo `POST /e` (ingest de erro, anônimo, com `installId`): envia os crashes do buffer local (`message` truncada, `stack` só dos N primeiros frames). **Scrub server-side**: trunca, remove sequências numéricas longas (anti-valor), allowlist de campos — nunca o entorno do erro.
- DO `errors(install_id, day, msg_hash, message, count, last_seen, app_version, platform)` deduplicado por hash da mensagem.
- Admin: top erros por frequência + nº de usuários afetados + última ocorrência + versão/plataforma. Vira um mini "Sentry caseiro" sem dependência externa.

**Esforço:** tokens = **M** (Worker lê usage + passar installId em 2 chamadas + tabela + seção admin); erros = **M** (ingest + scrub + tabela + seção). **Risco:** privacidade nos erros → mitigado por scrub/allowlist/truncação server-side (mesma filosofia do allowlist de telemetria que rejeita valores com 400).

### 1.2 Conselho rápido (inline · Architect + Critic)
- **Architect:** reusar 100% o `TelemetryStore` (mesma migration pattern, mesmas rotas `/admin/*` token-gated). Tokens server-authoritative; erros como tabela deduplicada por hash. Manter o allowlist como contrato de privacidade. **Rec:** fazer; é incremental, sem novo serviço. **Confiança: ALTA.**
- **Critic:** o risco real é **PII/valor vazar no texto de erro** e o **custo de IA ficar visível sem teto** (um usuário pode estourar tokens). **Rec:** scrub agressivo + truncação dura nos erros; e o painel de tokens deve servir também de **alerta de abuso** (top consumidores). Não capturar `console.log` arbitrário — só crashes estruturados. **Confiança: ALTA.**

### 1.3 Outras melhorias "deixar mais legal" (baixo esforço, alto valor)
- **Gráfico de DAU no tempo** — o endpoint `/timeseries` **já existe**; falta só desenhar a linha no `/admin` (P, alto valor).
- **Ordenar/buscar a tabela de usuários** (por última vez, dias ativos, gastos) + **exportar CSV** (P).
- **Retenção D1/D7** e **funil** (instalou → onboarding → ativo) a partir de `first_seen`/heartbeats (M).
- **"Sparkline" por usuário** (mini histórico de dias ativos) (P-M).

**Recomendação Admin v2:** fazer em 2 ondas — **Onda A (P):** gráfico DAU + ordenar/buscar/CSV (puro front, reusa endpoints). **Onda B (M):** tokens de IA (server-authoritative) + captura de erros. Ratificar como **DEC-251**.

---

## 2. Múltiplas viagens ao mesmo tempo (DEC-249 proposto)

### 2.1 O problema do Julio
"Quero planejar uma segunda viagem (ex.: logo depois de Burgos) sem mexer na viagem Europa atual; trocar entre viagens e ver os detalhes de cada uma (talvez clicando no nome da viagem)."

### 2.2 Conselho (inline · Strategist / Architect / Critic / Advocate)

**Decision Brief (neutro):** Hoje o app só expõe UMA viagem (ponteiro `activeTrip`), embora o dado já seja multi-viagem e criar seja aditivo. Decidir SE e COMO permitir várias viagens simultâneas, troca e visão de cada uma — com mínimo de regressão. _Viés a resistir: "o dado já suporta, então é trivial" — a parte sensível é evitar lançar gasto na viagem errada._

**Strategist** — Otimiza retenção/posição. Um app de orçamento que "esquece" o usuário entre viagens perde a baixa temporada; deixar **planejar a próxima** mantém o app aberto o ano todo, e habilita "clonar de uma viagem passada" (template) como upsell futuro. Risco de dado baixo (modelo pronto). **Rec:** é a feature de retenção mais barata disponível — fazer. **Confiança: ALTA.** _Outros perdem:_ multi-viagem é também o funil natural para o modo contínuo (§3).

**Architect** — Otimiza viabilidade/manutenção. O trabalho real é só: (1) uma **entrada de criação in-app** que reusa `createTripFromOnboarding` (sem passar pelo `/welcome` destrutivo); (2) um **switcher** que seta `appSettings.activeTrip` + `reload()`; (3) uma **lista de viagens**. `useAppData` já é o único ponto que lê `activeTrip` → a troca é um swap atômico + reload. **Rec:** reusar orquestrador + `TripListPage` + ação de troca. **Confiança: ALTA.** _Outros perdem:_ `peerLinks`/live-split são globais — trocar de viagem no meio de uma mesa ao vivo precisa de guarda.

**Critic** — Otimiza achar a falha. O maior risco é **lançar dado na viagem errada** (FAB, IA quick-entry, mesa ao vivo e acertos miram `activeTrip` silenciosamente) e o usuário **perder a noção de qual viagem está ativa**. Settlements/peerLinks são cross-trip → uma dívida pode confundir entre viagens. **Rec:** tornar a viagem ativa **inconfundível** (chip persistente com nome+datas no topo), **confirmar na troca**, **nunca auto-trocar**, e a IA ecoar o nome da viagem na confirmação. **Confiança: MÉDIA-ALTA.** _Outros perdem:_ interações com backup/restore e o modo demo (a viagem demo é especial; entrar/sair dela precisa ser seguro).

**Advocate** — Otimiza valor/simplicidade ao usuário. O sonho é "toco no nome da viagem → vejo todas → toco em outra → estou nela". A viagem futura nasce em `planning` e **não polui** o dashboard ativo. Viagens `completed` ficam navegáveis para revisão (não apagadas). **Rec:** switcher atrás do nome no header + "+ Nova viagem" no mesmo fluxo simples + separação visual das que estão em planejamento. **Confiança: ALTA.** _Outros perdem:_ as pessoas vão querer **rever** uma viagem terminada — `completed` deve ser navegável.

**Red Team (matar o "fazer agora"):** o perigo é a entrada de dados na viagem errada nas MUITAS superfícies que miram `activeTrip` em silêncio. Se o indicador de viagem ativa não for onipresente e a troca não for "barulhenta", usuários vão corromper o próprio ledger e culpar o app. **Mitigação:** chip de viagem ativa sempre visível + confirmar-na-troca + sem auto-troca + IA/quick-entry ecoando o nome da viagem.

**Síntese (Chair):**
- **Consenso:** dado pronto; é feature de **UX+orquestração**, risco de dado baixo, valor de retenção alto. Construir.
- **Tensões:** Advocate quer troca de 1 toque; Critic quer confirmação barulhenta anti-erro. **Resolução:** 1 toque **abre** o switcher (barato); **efetivar** a troca mostra um confirm curto e o chip de header passa a exibir a nova viagem.
- **Recomendação — Fase MT (multi-trip):**
  1. **Chip de viagem ativa** no shell (nome + datas + status), sempre visível — fundação (ajuda até o caso de 1 viagem hoje).
  2. **`TripListPage` (`/trips`)**: lista todas as não-deletadas agrupadas por status (ativa/planejamento/concluída); tocar troca (`activeTrip` + `reload` + toast "Agora em <viagem>"); a atual marcada.
  3. **"+ Nova viagem"** reusa o fluxo de criação do onboarding (mesmo builder/orquestrador) lançado in-app, status por data de início (futura → `planning`), **sem tocar na viagem atual**; após criar, perguntar "entrar agora ou continuar planejando?".
  4. **Guardas:** confirmar na troca; avisar/bloquear troca com mesa ao vivo em andamento; tratar viagem demo.
- **Lente de maior peso:** Architect (viabilidade) + Critic (anti-corrupção) — o valor é óbvio; o que pode dar errado é o lançamento na viagem errada.
- **O que reverteria:** se a troca exigisse tocar inseguramente em muitas superfícies acopladas a `activeTrip` (não deve — `useAppData` é o gargalo único). _Minoria vence:_ se o usuário só tem 1 viagem, chip+lista são leves — segue ok.
- **Confiança: ALTA.**

### 2.3 UI/UX (multi-trip)
- **Header chip** (no `AppShell`): `▾ Europa · 12–30 jun · ativa`. Toque abre o switcher (bottom sheet com a lista) — reusa o padrão de bottom sheet existente.
- **`/trips`**: seções "Ativa", "Planejando", "Concluídas"; card com nome, datas (ou "sem datas" no modo contínuo §3), moeda, status, mini-resumo (gastos/saldo). Ações: **abrir/trocar**, **editar**, **arquivar/concluir**.
- **Criar**: reusa as telas do onboarding (nome, moeda, datas, fase, carteira) — mas com um topo que pergunta o **tipo** (ver §3: Viagem vs Dia a dia).
- **Anti-erro:** confirm na troca; IA e FAB ecoam o nome da viagem no preview/confirmação.

---

## 3. Modo "dia a dia" / contínuo — sem viagem (DEC-250 proposto)

### 3.1 O problema do Julio (caso do cunhado)
"Ele quer usar no dia a dia: gente vem visitar, ele está sempre dividindo, cobrando, acompanhando gastos — **sem ter uma viagem** (sem data de início/fim). É como uma viagem, mas é só um estado contínuo de uso."

### 3.2 Decisão de arquitetura central
**Reusar `Trip` com um campo `kind: 'trip' | 'ongoing'`** (default `'trip'`; toda viagem existente intacta — ÂNCORA 9), em vez de um novo tipo de entidade. Justificativa: o núcleo (split/acerto/pessoas/carteiras/peerLinks) já é independente de data; um novo "espaço" do zero duplicaria toda a plumbing escopada por `tripId` (alto risco). O modo contínuo então é **só mais uma entrada no switcher do multi-trip (§2)** — por isso **MT é pré-requisito de OS**.

### 3.3 Conselho (inline · Strategist / Architect / Critic / Advocate)

**Decision Brief (neutro):** Permitir um "espaço" de gastos compartilhados **sem datas**, de uso contínuo (divisão/acerto/cobrança/acompanhamento), reusando a infra de viagem. Decidir SE faz sentido e COMO, sem quebrar as features acopladas a data nem virar um Splitwise pela metade. _Viés a resistir: "é só tirar as datas" — as superfícies de orçamento/fase/forecast assumem datas em vários lugares._

**Strategist** — Dobra o TAM: o app deixa de ser "só para viagens" e vira "gastos compartilhados, a qualquer hora". A persona do cunhado (anfitrião que divide o tempo todo) é recorrente e **viral** (convidados entram → viram usuários). **Rec:** construir como "tipo de espaço" de primeira classe. **Confiança: ALTA.** _Outros perdem:_ contínuo é o funil natural para viagens (usuário diário que decide viajar já tem app + contatos).

**Architect** — O risco é as superfícies que assumem data: pote da fase, orçamento diário, "dias restantes", check-in "lente do dia", forecasting, simulador. **Estratégia:** **portão de capacidades** — cada feature dependente de data fica atrás de `kind === 'trip'`; o contínuo mostra um home mais simples (saldo + recentes + dividir + quem deve a quem). **Não forkar o dado.** **Rec:** flag `kind` + mapa de capacidades por tipo. **Confiança: MÉDIA-ALTA.** _Outros perdem:_ o onboarding precisa **bifurcar** no topo ("planejar viagem" vs "dia a dia").

**Critic** — A armadilha é um modo contínuo **meio-suportado** onde features de data quebram ou mostram absurdo (NaN dias, pote de fase vazio, "viagem termina em -3 dias"). E o **significado de orçamento muda**: viagem tem orçamento finito; contínuo é aberto (talvez teto mensal, talvez nenhum). Bolar contínuo em cima do código de viagem **sem auditar cada leitura de data** = bugs. **Rec:** portão estrito + escolha explícita "sem orçamento / orçamento mensal" + auditoria das leituras de data. **Confiança: MÉDIA.** _Outros perdem:_ semântica de "concluir/arquivar" é diferente (um espaço contínuo nunca "termina").

**Advocate** — O cunhado quer: adicionar pessoas, lançar um gasto compartilhado, ver **quem deve a quem**, acertar — zero moldura de "viagem". O home deve dizer "Saldos / Quem te deve", não "Dias restantes". **Nomenclatura importa:** chamar de "Espaço"/"Casa"/"Grupo"/"Conta contínua", não "viagem". **Rec:** home contínuo focado em saldos + dividir rápido; esconder todo o vocabulário de viagem. **Confiança: ALTA.** _Outros perdem:_ padrões recorrentes (aluguel/mercado mensal) — um "recorrente" leve pode vir depois; não no v1.

**Red Team (matar o "fazer agora"):** o risco real é **scope creep** — virar um clone de Splitwise feito pela metade — e o **código acoplado a data** (fases, orçamento diário, forecasting, check-in, simulador) quebrando em silêncio no modo contínuo. Se o portão de capacidades não for hermético, cada uma dessas telas é um bug. **Caminho mais barato:** lançar **multi-trip primeiro**; oferecer como paliativo uma "viagem com data de fim aberta"; só construir o modo contínuo de verdade quando o portão estiver provado.

**Síntese (Chair):**
- **Consenso:** valor alto (dobra casos de uso, persona viral) e **viável reusando `Trip` com `kind`** — NÃO um novo modelo de dados. O core de divisão/acerto/pessoas/carteira já é independente de data.
- **Tensões:** Strategist/Advocate querem espaço de 1ª classe já; Critic/Architect exigem portão hermético sobre as superfícies de data. **Resolução:** construir **depois/encima do multi-trip**, porque o contínuo **É** só mais uma entrada no switcher. Introduzir `Trip.kind` + mapa de capacidades; contínuo esconde fases/orçamento-diário/forecasting/simulador/check-in e mostra home de saldos.
- **Recomendação — sequência: Fase MT (multi-trip) PRIMEIRO, depois Fase OS (ongoing space)** reusando o switcher. OS =
  1. `kind: 'trip' | 'ongoing'` em `Trip` (default `'trip'`; viagens existentes inalteradas).
  2. **bifurcação no criar** ("Viagem" vs "Dia a dia / contínuo").
  3. **portão de capacidades** que esconde features dependentes de data no contínuo.
  4. **home contínuo** (saldos + recentes + dividir rápido + quem deve a quem).
  5. opcional: **pote "orçamento mensal"** sem data, via o modelo existente.
- **Lente de maior peso:** Architect — a viabilidade inteira depende de um portão de capacidades hermético sobre as superfícies de data; acertando isso, o resto é reuso.
- **O que reverteria:** se a auditoria achar suposições de data cravadas fundo no motor de orçamento a ponto do portão vazar → cair para o paliativo "viagem de fim aberto". _Minoria vence (Critic):_ se o portão vazar, lançar o paliativo em vez de um contínuo meio-quebrado.
- **Confiança: MÉDIA-ALTA** (ALTA no valor e no reuso de dados; MÉDIA no esforço de auditoria do acoplamento a data).

### 3.4 UI/UX (modo contínuo)
- **Nome sugerido:** "Dia a dia" (ou "Espaço contínuo"). Evitar "viagem" no vocabulário desse tipo.
- **Criar:** topo do fluxo pergunta o tipo. Contínuo pede só **nome + moeda** (sem datas, sem fase); orçamento mensal **opcional**.
- **Home contínuo:** hero de **saldos** ("Quem te deve / Você deve"), botão grande **Dividir**, lista de gastos recentes, pessoas/conexões. Sem "dias restantes", sem pote de fase, sem simulador.
- **Capacidades por tipo (mapa):**
  | Feature | `trip` | `ongoing` |
  |---|:---:|:---:|
  | Gastos / carteiras | ✓ | ✓ |
  | Dividir / acertar / cobrar / pessoas / conexões | ✓ | ✓ |
  | IA quick-entry / escanear nota | ✓ | ✓ |
  | Fases / pote da fase / orçamento diário / "dias restantes" | ✓ | ✗ |
  | Forecasting / simulador / check-in "lente do dia" | ✓ | ✗ (ou versão sem-data depois) |
  | Orçamento mensal (pote sem data) | opcional | opcional |

---

## 4. Sequenciamento, risco e entrega

**Ordem recomendada (cada uma só entra com testes verdes e zero regressão):**
1. **Admin v2 — Onda A** (P, independente): gráfico DAU (endpoint já existe) + ordenar/buscar/CSV. _Aquecimento barato, valor imediato._
2. **Fase MT — Múltiplas viagens** (M, fundação de produto): chip de viagem ativa → `/trips` → criar in-app → trocar com guarda. _Pré-requisito do modo contínuo._
3. **Fase OS — Modo contínuo** (M-G, encima de MT): `Trip.kind` + bifurcação no criar + portão de capacidades + home de saldos.
4. **Admin v2 — Onda B** (M, independente): tokens de IA server-authoritative + captura de erros.

**Princípios de não-regressão (atендem o pedido "não mexer onde não precisa"):**
- `useAppData` é o **gargalo único** de "qual viagem" → a troca vive lá; nenhuma superfície de feature muda o jeito de ler dados.
- `kind` default `'trip'` + portão de capacidades → todo código de viagem existente roda idêntico (ÂNCORA 9).
- Reuso de `createTripFromOnboarding` (já atômico/transacional) para criar — sem novo caminho de escrita.
- Cada fase com testes unitários do domínio novo (switch/seleção de viagem; mapa de capacidades; ingest de tokens/erros com allowlist) + E2E nas superfícies tocadas.

**Decisões propostas (pendentes de ratificação do Julio):**
- **DEC-249** — Múltiplas viagens (switcher + lista + criar in-app; ponteiro `activeTrip`; anti-erro com chip + confirm).
- **DEC-250** — Modo contínuo via `Trip.kind='ongoing'` + portão de capacidades (reuso, não novo modelo).
- **DEC-251** — Admin v2 (tokens de IA server-authoritative por user/função/dia; captura de erros com scrub; gráfico DAU + busca/CSV).

**Perguntas abertas para o Julio (ratificar antes de implementar):**
1. Modo contínuo tem **orçamento mensal** opcional (teto) ou é totalmente aberto no v1?
2. Nomenclatura do modo contínuo: "Dia a dia", "Espaço", "Conta", "Grupo"?
3. Admin: tokens de IA **e** erros já na Onda B, ou erros depois?
4. Multi-trip: viagem `completed` fica **somente leitura** ou totalmente editável ao reabrir?
