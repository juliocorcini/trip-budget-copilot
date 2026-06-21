# Auditoria de Integrações Sobrepostas / Incompletas — TripPilot

**Data:** 2026-06-20 · **Origem:** Julio — _"faça uma análise completa de integrações incompletas: coisas muito parecidas, em lugares errados, ou que fazem a mesma coisa de duas formas diferentes. Ex.: Gastos→Escanear nota vs Dividir conta; Acerto de contas/pessoas conectadas (queria 'amigos' persistentes); amigo sincero virou insights. Entender o que o conselho acha a fundo. Vai pegando e adicionando à lista a fazer."_

**Status:** ANÁLISE + BACKLOG (nada implementado ainda — aguarda direção do Julio nos 2 forks estruturais).
**Método:** mapeado direto no código (rotas em `src/app/router.tsx`, FAB, dashboard, domínio). Cada item cita o arquivo/linha que comprova o achado — sem achismo.

---

## 1. Mapa dos pontos de entrada (o que existe hoje)

### 1.1 Capturar um gasto — **5 caminhos** que se sobrepõem
| Caminho | Rota / entrada | O que faz | OCR? | Divide? | Ao vivo? |
|---|---|---|---|---|---|
| Registrar gasto | `/quick-add` (FAB hero laranja) | 1 gasto manual (+ voz) | não | não | não |
| Escanear nota | `/receipt/scan` (botão indigo em **Gastos**, `ExpenseListPage` L313) | foto → OCR → **1 gasto meu** | sim | não | não |
| Dividir conta | `/split/scan` (FAB, accent indigo) | foto → OCR → **dividir** → commit | sim | sim | opcional (mesa ao vivo) |
| Iniciar saída | `/outings/new` · `/outings/active` (FAB) | sessão de captura **ao vivo** (rodada a rodada) | não | parcial | sim |
| Entrada por IA | assistente (FAB topo) | texto/voz → roteia p/ os de cima | — | — | — |

**Evidência da sobreposição:** o próprio FAB chama Dividir conta de _"the superset of the receipt scanner (capture → tax → split → commit)"_ (`FAB.tsx` L315-318). Ou seja: **Escanear nota e Dividir conta usam a MESMA captura+OCR**; divergem só em "isso é compartilhado?". Para o usuário são dois botões quase idênticos em lugares diferentes (um em Gastos, outro no FAB).

### 1.2 Conectar com outra pessoa/dispositivo — **6 mecanismos** ad-hoc
1. **Pareamento por QR** (DEC-105) — `my_qr` + `QrScanner` em `/shared` → `pairParticipantFromIdentity` grava `Participant.linkedActorId`. **Por viagem.**
2. **Link de pareamento** (F19) — `/pair` (`PairPage`): a mesma identidade como URL.
3. **Enviar extrato / mailbox espelhado** (DEC-106) — `MirroredStatementsSection`, manda o extrato pro device pareado.
4. **Link de participante** (DEC-207) — `/s/:id` (`SharedLinkPage`): link criptografado por extrato, sem pareamento.
5. **Mesa ao vivo** — `/t/:id` (`SplitTablePage`): link por sessão de divisão.
6. **Sincronizar dispositivos** — `/sync` (`SyncTransferFlow`): transfere a conta inteira entre aparelhos.

**O buraco (exatamente a dor do Julio):** `Participant.linkedActorId` existe (`domain/types/participant.ts` L11) mas é **por viagem + por pareamento pontual**. Não existe nenhuma "agenda de amigos conectados" reutilizável. Toda vez que quero mandar uma dívida em tempo real, refaço QR/link. Não há um lugar que diga "estes são meus amigos no app; quando eu dividir/cobrar, já vai pra eles ao vivo".

### 1.3 Onde aparece "quem deve / acerto" — **4 superfícies**
- `/shared` (`SharedExpensesPage`) — hub "Acerto de contas".
- Dashboard card **`debt_summary`** ("te devem / você deve", `DashboardCards` L1055).
- Dashboard card **`pending_shares`** ("aguardando aceite", L1090).
- Copiloto **"Acertos"** (`copilot.debts_title`, `CopilotPage` L840).

### 1.4 Amigo sincero vs Insights — viraram a mesma coisa
- **Insights** (`DashboardCards` `case 'insights'`, L924): carrossel **deslizável** de verdade (`overflow-x-auto snap-x snap-mandatory`, arrasta o dedo) + bolinhas. É o "carrossel de cima" que o Julio gosta.
- **Amigo sincero** (`AmigoSinceroCard.tsx`): virou carrossel **só de bolinhas** (sem arrastar) + auto-avanço. E o conteúdo extra (`honest-friend-extras.ts`) são **métricas genéricas** (% da fase, sobra/dia, categoria top, a receber) — isto é literalmente "virou insights". A voz real de amigo (`buildHonestFriendV2`: `over_budget`/`over_pace`/`on_plan`/`over_plan`/`no_plan`) ficou só no slide 0.

### 1.5 Outros pares confusos (menores, mas reais)
- **"Registrar mercado"** = `/quick-add?cat=market` — é "Registrar gasto" pré-filtrado numa categoria. Duplicata explícita (o próprio FAB comenta isso, L56-65).
- **Renda vs movimentações**: renda tem **página própria** (`/income`) mas transferência/saque são **modos do quick-add** (`/quick-add?type=transfer|withdrawal`). Inconsistência de "onde mora cada tipo de lançamento".
- **Saída (outing) vs Mesa ao vivo (split table)**: ambos são "captura ao vivo num rolê". Um é solo, o outro compartilhado — mas o modelo mental se confunde (o próprio Julio já chamou split de "saída de bar").
- **Simulador vs Planejados**: `/simulator` ("posso gastar?") e `/planned` (compras planejadas) se tocam — "vou gastar X" pode virar simulação OU item planejado.

---

## 2. Conselhos (inline, 1 request, sem subagentes)

### 2.1 `/council` — Escanear nota vs Dividir conta

**Decision Brief (neutro):** Hoje há 2 entradas quase idênticas que capturam uma nota por OCR: `/receipt/scan` (vira 1 gasto meu) e `/split/scan` (divide). Mesma captura, decisão "é compartilhado?" só no fim. Pergunta: unificar em um fluxo só (capturar → o app/usuário decide "só meu" ou "dividir") ou manter dois? Viés a resistir: "unificar é sempre mais limpo" — pode tirar a clareza de 1-toque de cada intenção.

**Architect** — Uma captura+OCR única já existe nos dois; manter dois caminhos duplica manutenção (toda melhoria de OCR/itens precisa entrar em dois lugares). Propõe: **um fluxo de captura** com um seletor logo após o OCR ("é só seu? / dividir com alguém?"). Rec: unificar com bifurcação tardia. Confiança: ALTA. Outros não veem: o split já é tecnicamente superset — o receipt-scan é um subconjunto que pode ser um atalho que entra no mesmo fluxo com a bifurcação pré-respondida ("só meu").

**Advocate (usuário)** — No bar, intenção importa: "isso é meu" e "vamos rachar" são momentos mentais diferentes. Dois botões claros podem ser melhores que um fluxo que pergunta. Rec: manter DUAS portas, mas que **levem ao mesmo motor** (atalhos), nunca dois motores. Confiança: MÉDIA. Outros não veem: o problema do Julio não é "ter dois botões", é eles parecerem iguais e estarem em lugares diferentes — resolve-se com rótulos/posições claras, não necessariamente fundindo.

**Critic** — Fundir cedo demais cria um fluxo com um galho "dividir" que 80% das vezes não é usado (a maioria dos scans é gasto solo) → fricção pra todo mundo por causa da minoria. E mexer no `/split/scan` (que acabou de estabilizar, epic G1-G3) tem risco de regressão. Rec: NÃO refazer o motor; só alinhar as portas. Confiança: ALTA. Outros não veem: risco de regressão no split recém-entregue.

**Simplifier** — O mínimo que mata a confusão: **uma porta de captura** ("Escanear/Foto") e, **depois do OCR**, uma pergunta de 1 toque "Só meu / Dividir". Dois botões viram um. Rec: bifurcação pós-OCR. Confiança: MÉDIA-ALTA.

**Red Team (matar a opção líder = "unificar"):** se o OCR demora/erra, somar a pergunta de divisão no mesmo fluxo aumenta o tempo até salvar um gasto solo simples — que é o caso mais comum. E o split tem estado ao vivo (mesa), service charge, claims — embutir isso no "scan comum" incha o caminho simples.

**Síntese (Chair):**
- **Consenso:** deve existir **um único motor de captura+OCR**; os dois caminhos NÃO devem ter lógicas separadas.
- **Tensão:** Architect/Simplifier querem 1 porta com bifurcação; Advocate/Critic querem 2 portas claras → 1 motor.
- **Recomendação:** lente que pesa aqui = **Advocate + Critic** (intenção do usuário + risco). **Manter 2 portas, unificar o motor por baixo, e tornar a relação óbvia:** depois do OCR, ambos mostram a MESMA tela com um toggle "Só meu ↔ Dividir" (pré-marcado conforme a porta de entrada). Não reescrever o split; fazer o `/receipt/scan` desembocar no mesmo componente com `mode=solo`. Ganho do Julio: deixa de parecer "dois apps diferentes pra mesma foto".
- **O que mudaria isto:** se telemetria mostrar que quase todo scan acaba dividido, aí sim vale 1 porta só. Hoje não temos esse dado → manter 2 portas é o mais seguro.
- **Confiança:** ALTA.

### 2.2 `/council` — Modelo de conexão: criar "Amigos conectados" persistentes?

**Decision Brief (neutro):** Há 6 mecanismos de conexão ad-hoc (QR, /pair, mirror, /s/:id, /t/:id, /sync) e nenhum conceito durável de "amigo". `Participant.linkedActorId` guarda o device pareado mas por viagem. Julio quer: adicionar um amigo (usuário do app) UMA vez e, no futuro, dividir/cobrar e isso ir em tempo real sem refazer QR. Pergunta: construir uma camada persistente de "Amigos/Conexões" reutilizável entre viagens? Viés a resistir: "fazer rede social" — o app é local-first, sem servidor de contas.

**Strategist** — Conexão persistente é o que transforma o app de "planilha pessoal" em "app de grupo" — o maior diferencial e retenção (cada amigo conectado é um vetor de convite). Vale o investimento. Rec: SIM, camada de Conexões durável. Confiança: ALTA. Outros não veem: efeito de rede — quem te deve vira quem instala.

**Architect** — Hoje é local-first + E2E por link; não há "diretório de usuários". Um "amigo persistente" = guardar a **identidade/actorId do outro device** (a mesma que o QR já troca) num registro global `connections`, e ao dividir, reusar essa identidade pra publicar no canal que já existe (mirror/share). **Não precisa de servidor de contas** — é persistir o que o pareamento já produz e reaproveitar. Risco real: entrega "em tempo real" depende do outro device buscar (foreground re-pull já existe). Rec: SIM, mas como **camada fina sobre o que já existe**, não rede nova. Confiança: MÉDIA-ALTA. Outros não veem: o transporte já existe; falta só a persistência + reuso.

**Critic** — Perigo de virar um CRM meia-boca: "amigo conectado" que na verdade nunca confirma, dívida que o outro nunca aceita, identidade que muda quando reinstala o app (actorId novo) → "amigos fantasma". Sem servidor, a fonte da verdade continua sendo o dono; "tempo real" é best-effort. Rec: SIM, mas com estado honesto ("conectado / aguardando / offline") e recuperação quando o actorId muda. Confiança: MÉDIA. Outros não veem: ciclo de vida da identidade (reinstalar quebra o vínculo).

**Advocate (usuário)** — O Julio descreveu a dor exata: "não quero ficar passando QR toda vez". Uma lista "Meus amigos" (foto/nome/status) onde eu escolho na hora de dividir é exatamente o esperado de qualquer app de divisão (Splitwise-like). Rec: SIM — priorizar a experiência "escolher amigo da lista" no fluxo de dividir/cobrar. Confiança: ALTA. Outros não veem: o valor aparece no momento de dividir, não numa tela de "amigos" isolada.

**Red Team (matar a opção líder = "construir Amigos persistentes"):** sem servidor de contas, "amigo persistente" é uma promessa que o transporte best-effort pode não cumprir: o amigo reinstala → actorId muda → a conexão morre silenciosa; offline por dias → "tempo real" vira "quando ele abrir". Pode gerar mais "por que não chegou?" do que o QR ad-hoc (que ao menos é explícito por evento). Risco de prometer rede social num app local-first.

**Síntese (Chair):**
- **Consenso:** TODOS os 4 querem a camada de Conexões persistente — é o maior salto de produto e resolve a dor literal.
- **Tensão:** Strategist/Advocate (ousar, é diferencial) vs Critic (ciclo de vida da identidade é frágil sem servidor).
- **Recomendação:** lente que pesa = **Architect** (porque define se é viável sem virar projeto gigante). **Construir "Conexões/Amigos" como camada FINA e durável que persiste a identidade trocada no pareamento e a reusa nos fluxos de dividir/cobrar** — com estado honesto (conectado/aguardando/offline) e um caminho de "reconectar" quando o actorId mudar. Começar pequeno: (1) persistir conexões num registro global; (2) no split/cobrança, "escolher de Amigos" em vez de re-QR; (3) reaproveitar mirror/share pra entrega; (4) tela "Amigos" unificando os 6 mecanismos sob um teto. **NÃO** prometer push server-side (manter o honest-limit do DEC-220).
- **Cenário onde a minoria (Critic) vence:** se ao primeiro protótipo o vínculo quebrar muito (reinstalações), recuar para "amigo = atalho que regenera o link automaticamente" em vez de "canal sempre vivo".
- **Confiança:** MÉDIA-ALTA. **É o item mais arquitetural do backlog — precisa de um mini-plano próprio antes de codar.**

### 2.3 `/review` (rápido) — Amigo sincero (voz vs métrica) + carrossel

**Correctness/Advocate:** o pedido é claro e quase um spec: (1) conteúdo = **voz de amigo** ("tô vendo que você já gastou X% da fase, segura aí" / "esse rolê puxou mais que seu normal" / "no ritmo de hoje a reserva começa dia Y" / "te devem Z, vai cobrar"), não readout de métrica seca; (2) **esconder** quando não há nada de amigo a dizer; (3) **carrossel deslizável** igual ao de insights (arrastar), não só bolinhas. **Maintainability:** reaproveitar o padrão `snap-x snap-mandatory` do `case 'insights'` no `AmigoSinceroCard` — uma técnica só nos dois. **Veredito:** baixo risco, alto valor percebido, sem decisão estratégica pendente → **quick win**. Substituir/encapar `honest-friend-extras` por reads em voz de amigo (derivados dos mesmos números, mas redigidos como conselho), e trocar o pager de bolinhas por scroll-snap deslizável.

---

## 3. Lista a fazer (priorizada)

Legenda: **Impacto** (clareza p/ usuário) · **Esforço** · **Risco**.

### Quick wins (sem decisão estratégica — dá pra fazer já)
- [ ] **A1 · Amigo sincero = voz de amigo + carrossel deslizável + esconder vazio.** Trocar os extras-métrica por reads em voz de amigo; reusar o swipe `snap-x` dos insights; sumir quando `slides.length===0`. _Impacto: ALTO · Esforço: M · Risco: BAIXO._ (§2.3)
- [ ] **A2 · Dedup "Registrar mercado".** É `/quick-add?cat=market`. Manter só como atalho/chip dentro do quick-add (ou remover do FAB), não como ação irmã de "Registrar gasto". _Impacto: BAIXO · Esforço: P · Risco: BAIXO._
- [ ] **A3 · Unificar a linguagem de dívida nas 4 superfícies.** Garantir que `/shared`, card `debt_summary`, card `pending_shares` e Copiloto "Acertos" usem os MESMOS rótulos/cores/ordem e que cada um diga claramente seu papel (resumo vs ação vs aguardando). _Impacto: MÉDIO · Esforço: P-M · Risco: BAIXO._

### Estruturais (precisam da sua direção antes de codar)
- [ ] **B1 · Captura unificada (Escanear nota ⟷ Dividir conta).** Um motor de OCR; depois do scan, toggle "Só meu ↔ Dividir" (pré-marcado pela porta). `/receipt/scan` desemboca no componente do split com `mode=solo`. **Não reescrever o split.** _Impacto: ALTO · Esforço: M-G · Risco: MÉDIO (regressão no split)._ (§2.1)
- [ ] **B2 · Camada "Amigos / Conexões" persistente.** Registro global de conexões (identidade do device reaproveitada do pareamento); escolher amigo da lista ao dividir/cobrar; estado honesto (conectado/aguardando/offline) + reconectar; tela "Amigos" unificando os 6 mecanismos. **Precisa de mini-plano próprio.** _Impacto: ALTO · Esforço: G · Risco: MÉDIO-ALTO._ (§2.2)

### Consistência (menores)
- [ ] **C1 · Renda vs transferência/saque no mesmo lugar.** Decidir: ou renda também vira modo do quick-add, ou transfer/withdrawal ganham simetria com `/income`. _Impacto: BAIXO-MÉDIO · Esforço: M · Risco: BAIXO._
- [ ] **C2 · Saída (outing) vs Mesa ao vivo (split).** Clarear quando usar cada um (solo ao vivo vs dividir ao vivo) — possivelmente um ponto de entrada que pergunta "sozinho ou em grupo?". _Impacto: MÉDIO · Esforço: M · Risco: MÉDIO._
- [ ] **C3 · Simulador vs Planejados.** Conectar: de uma simulação "posso gastar?" oferecer "salvar como planejado". _Impacto: BAIXO-MÉDIO · Esforço: P-M · Risco: BAIXO._

---

## 4. Recomendação de ordem
1. **A1** (amigo sincero) — quick win com pedido explícito e claro.
2. **A2 + A3** — limpeza barata de duplicidade/linguagem.
3. **B2 mini-plano** (Amigos persistentes) — é o maior salto; merece um documento de plano + conselho dedicado antes de codar.
4. **B1** (captura unificada) — depois que B2 definir como "dividir com amigo" funciona (os dois se tocam no momento "dividir").
5. **C1–C3** — quando sobrar janela.

> **Decisões ainda PENDENTES (não entram no decision-log até o Julio aprovar):** B1 (unificar captura — 1 motor, 2 portas) e B2 (camada de Amigos). A1/A2/A3/C* são execução, sem fork estratégico.
