# TripPilot — Perguntas pré-implementação

> Gerado em: 2026-06-08
> Objetivo: Resolver todas as ambiguidades antes de começar a implementação.
> Instruções: Responda cada pergunta diretamente. Se não tiver certeza, escreva "decidir depois" e eu trato como escopo diferido.

---

## 1. Onboarding / Primeiro uso

### 1.1 Fluxo mínimo de criação
O onboarding wizard tem estes passos definidos: trip → phases → budget pool → activity profiles → preferences.

**Pergunta**: O usuário precisa preencher tudo isso antes de poder usar o app? Ou ele pode criar um trip + uma fase + um valor e já cair no dashboard, configurando o resto depois?

Exemplo mínimo: "Burgos · 1 jul - 15 jul · €760" → dashboard funcional.

### 1.2 Perfis de atividade no onboarding
Os ActivityProfiles (bar, mercado, restaurante, etc.) precisam de estimativas iniciais (quanto custa em média uma noite de bar, um mercado, etc.).

**Pergunta**: Essas estimativas vêm de onde no primeiro uso?
- (a) O usuário digita manualmente no onboarding (ex: "uma noite de bar custa em média €35")
- (b) O app sugere valores padrão baseados na moeda/região e o usuário ajusta se quiser
- (c) O usuário não define nada; o app começa sem estimativas e aprende com o uso

### 1.3 Demo data
O welcome tem opção "carregar dados de demonstração".

**Pergunta**: O que esses dados demo devem conter? Uma viagem fictícia completa com gastos, sessões, etc.? Ou algo mínimo só para mostrar como o app funciona?

---

## 2. BudgetPool & Fases

### 2.1 Exemplo concreto da estrutura
No seu caso real: €760 para duas estadias em Burgos (antes e depois da eurotrip).

**Pergunta**: Confirme se entendo certo:
- Trip: "Europa 2026"
- Phase 1: "Burgos antes da eurotrip" (1 jul - 15 jul)
- Phase 2: "Eurotrip" (16 jul - 10 ago)
- Phase 3: "Burgos depois da eurotrip" (11 ago - 31 ago)
- BudgetPool "Fundo Burgos": €760, ligado às fases 1 e 3
- BudgetPool "Fundo Eurotrip": €X, ligado à fase 2

Está correto? Ou a eurotrip não tem budget pool nessa V1?

### 2.2 Fase sem budget pool
**Pergunta**: É possível criar uma fase que não tenha budget pool associado? (ex: uma fase "Transição" de 1 dia onde não se gasta nada)

### 2.3 Múltiplos pools por fase
**Pergunta**: Uma única fase pode receber dinheiro de mais de um BudgetPool? (ex: fase Burgos recebe do "Fundo Burgos" + "Fundo Emergência")

---

## 3. Envelopes

### 3.1 Envelopes obrigatórios
O product spec define 4 tipos: operational, protected_reserve, personal_shopping, informational.

**Pergunta**: Esses envelopes são criados automaticamente quando o usuário cria um BudgetPool? Ou o usuário escolhe quais quer?

### 3.2 Valor do envelope personal_shopping
**Pergunta**: O limite inicial de €100 para compras pessoais — é por fase, por pool, ou por trip inteiro?

### 3.3 Envelope "informational"
**Pergunta**: O que exatamente é um envelope informational? É tipo "coisas que eu sei que vou gastar mas não quero controlar no nível de ocasião"? Me dê um exemplo concreto.

---

## 4. Ocasiões / ActivityProfiles

### 4.1 Lista completa de perfis
O spec menciona: home day, market, bar, restaurant, outing, transport, festival, special.

**Pergunta**: Essa lista é fixa ou o usuário pode criar perfis personalizados? Ex: "café da manhã fora", "lavanderia".

### 4.2 PlannedOccurrence
**Pergunta**: Quando o usuário define no scenario planner "4 noites de bar, 5 mercados, 2 restaurantes" — essas são PlannedOccurrences? Elas representam dias específicos ou apenas quantidades totais para a fase?

### 4.3 Custo por ocasião
**Pergunta**: O custo de cada tipo de ocasião é um número único (ex: "bar = €35") ou tem meta/teto/máximo igual ao outing mode?

O three-limit system (meta, teto seguro, máximo) se aplica apenas ao Outing Mode em tempo real, ou também se aplica ao planejamento de cada perfil?

---

## 5. Outing Mode

### 5.1 Valores dos quick-add
Os botões são +€3, +€5, +€7, +€10, +€15, Outro.

**Pergunta**: Esses valores são:
- (a) Fixos para todos
- (b) Configuráveis nas settings
- (c) Definidos ao iniciar cada saída (junto com "avg drink price")
- (d) O app sugere baseado no preço médio do drink e o usuário pode ajustar

### 5.2 "Registrar total atual" — flow completo
O botão pergunta: "Esse valor substitui o total atual da saída ou deve ser somado?"

**Pergunta**: Se o usuário escolhe "substituir" e o total anterior era €21 mas ele digita €35 — o que acontece com os 3 itens individuais que já estavam no histórico? Eles são substituídos por um único item "Total registrado: €35"? Ou continuam visíveis como referência?

### 5.3 Saída com múltiplos participantes
**Pergunta**: Durante uma saída ativa, o usuário pode registrar gastos compartilhados? Ex: "a conta do bar foi €60, dividida entre 3 pessoas". Ou gastos compartilhados só são registrados fora do outing mode?

### 5.4 Alertas progressivos — formato
**Pergunta**: Os alertas em 50%, 75%, 90%, 100%, >100% — são apenas visuais (toast/banner) ou incluem vibração do celular? (Vibração exigiria capacitor ou Vibration API do browser)

### 5.5 Encerrar saída — flow
**Pergunta**: Ao encerrar, o spec diz "confirmar gastos, cash check, shared items check, marcar típico/especial, atualizar aprendizado". Esse é um wizard de vários passos ou uma tela única com tudo?

---

## 6. Simulator

### 6.1 Onde mora o simulador?
**Pergunta**: O simulador é acessível de onde?
- (a) Apenas pelo FAB menu ("Simular compra")
- (b) Também tem entrada no bottom nav ou na tela "Mais"
- (c) É ativado automaticamente quando o "Amigo sincero" aparece no dashboard (o "Ver impacto completo" abre o simulador?)

### 6.2 Risk levels — thresholds
Os três níveis são: confortável / atenção / evitar.

**Pergunta**: Esses thresholds são baseados em quê?
- (a) Porcentagem do "livre para usar" que seria consumido
- (b) Impacto no número de ocasiões restantes
- (c) Combinação dos dois
- (d) Configurável pelo usuário

---

## 7. Carteiras (Wallets)

### 7.1 Carteiras padrão
**Pergunta**: Quantas carteiras você normalmente usa em viagem? Quais seriam as iniciais? Ex: Wise, Dinheiro (EUR), Cartão brasileiro?

### 7.2 Reconciliação de caixa
**Pergunta**: Como funciona a reconciliação de caixa no seu uso real? Você conta o dinheiro no final do dia e compara com o que o app diz que deveria ter? Se sim, o que acontece com a diferença — vira um gasto "não rastreado"?

### 7.3 Gasto sem carteira
**Pergunta**: O usuário é obrigado a selecionar uma carteira ao registrar um gasto, ou pode pular (e escolher depois)?

---

## 8. Relatórios

### 8.1 Conteúdo dos relatórios
O spec menciona "Spending by category, timeline, profiles, savings equivalence".

**Pergunta**: Isso entra na Delivery 1 ou é para uma fase posterior? Se for posterior, o que precisa existir no V1 mínimo? Apenas a tela de lista de gastos?

### 8.2 Visualizações
**Pergunta**: Os relatórios usam gráficos (pizza, barras, linhas) ou são apenas listas/tabelas numéricas? Se gráficos, temos que escolher uma lib de charts — alguma preferência? (recharts, chart.js, visx, nenhuma?)

---

## 9. Settings

### 9.1 O que exatamente é configurável?
**Pergunta**: Liste tudo que deve ser configurável nas settings V1:
- [ ] Tom de alerta (amigo sincero, calmo, direto)
- [ ] Moeda padrão (EUR fixo no V1)
- [ ] Valores dos quick-add
- [ ] Limite de compras pessoais
- [ ] Lembrete de backup (ligado/desligado, dias)
- [ ] O que mais?

---

## 10. Shared Expenses & Participantes

### 10.1 Dados de participante
**Pergunta**: Um participante precisa de quais dados? Apenas nome? Ou também email/telefone para futuro link?

### 10.2 Gasto compartilhado no dashboard
**Pergunta**: No dashboard, o card "2 gastos pendentes de confirmação" — o que significa "pendente"? O usuário registrou o gasto mas não confirmou a divisão? Ou alguém de fora enviou um gasto que precisa ser aceito?

Na V1 local-first (sem backend), como é que gastos compartilhados ficam "pendentes" se não há comunicação entre dispositivos?

---

## 11. Backup / Export

### 11.1 Lembrete de backup
**Pergunta**: Depois de quantos dias sem backup o app começa a lembrar? 7 dias? Configurável?

### 11.2 CSV — formato
**Pergunta**: O spec menciona "17 campos por gasto". Quais são esses 17 campos? Ou posso derivar dos campos da entidade Transaction?

---

## 12. Navegação & UX

### 12.1 Deep links / PWA shortcuts
Os shortcuts definidos são: /quick_add, /outings/new, /outings/active.

**Pergunta**: Esses são apenas atalhos da home screen do celular (manifest shortcuts), ou também URLs que funcionam se alguém digitar diretamente?

### 12.2 "Mais" — conteúdo
**Pergunta**: A aba "Mais" no bottom nav abre o quê? Lista com links para: Settings, Relatórios, Carteiras, Backup, Trip Editor? Ou é uma tela com cards?

### 12.3 Trip Overview vs. Dashboard
**Pergunta**: O Trip Overview (rota `/trip`) mostra todas as fases. Ele é acessível de onde? É a primeira tela que aparece se o trip tiver múltiplas fases? Ou o usuário sempre cai direto no dashboard da fase ativa?

---

## 13. Dados reais (seed)

### 13.1 Seu trip real
**Pergunta**: Para gerar o JSON de seed privado, preciso dos seguintes dados reais:
- Nome do trip
- Datas exatas de cada fase
- Valor do BudgetPool de Burgos (€760?)
- Reserva protegida (€100?)
- Valor reservado para a fase de agosto
- Limite de compras pessoais (€100?)
- Participantes (Julio, Bruno, Debora?)
- Carteiras (Wise, Cash EUR, outra?)
- Perfis de atividade com estimativas iniciais (bar = €35?, mercado = €25?)
- Quick-add values padrão

Pode me dar esses dados quando chegar a hora, ou quer que eu prepare o template e você preenche?

---

## 14. Edge cases

### 14.1 Budget zerado
**Pergunta**: O que acontece no dashboard quando o "Livre para usar" chega a €0? O app bloqueia algo? Mostra mensagem especial? Permite continuar gastando (com alertas)?

### 14.2 Outing excede o máximo
**Pergunta**: Se o gasto na saída ultrapassa o "máximo", o que acontece? Os botões quick-add continuam funcionando? Muda a cor da tela? Muda a mensagem do amigo sincero?

### 14.3 Fase encerra durante saída ativa
**Pergunta**: Se uma saída está ativa à meia-noite e a fase muda — o que acontece? A saída é forçada a encerrar? Ou continua na nova fase?

### 14.4 Primeiro uso offline
**Pergunta**: Se o usuário instalar a PWA e abrir offline pela primeira vez, tudo funciona? (Sim, se o service worker cachear tudo no primeiro load online)

---

## 15. Escopo técnico

### 15.1 Router
**Pergunta**: React Router v7 ou TanStack Router? Alguma preferência?

### 15.2 Testes na Delivery 1
**Pergunta**: A Delivery 1 já inclui testes automatizados (Vitest + RTL) ou é "primeiro funcionar, depois testar"?

### 15.3 i18n
**Pergunta**: Todos os textos em português hardcoded ou já preparamos com algum sistema de i18n (react-intl, react-i18next) pensando em futuro inglês/espanhol? Ou hardcoded está ok para V1?

### 15.4 Roteamento da PWA
**Pergunta**: Como lidar com refresh em sub-rotas na Cloudflare Pages? (precisa de _redirects ou configura o Cloudflare para SPA fallback?)

---

## 16. Prioridade de funcionalidades por delivery

### 16.1 Dashboard na Delivery 1
A Delivery 1 não inclui forecasting nem outing mode. Mas o dashboard desenhado mostra ocasiões, saída ativa, amigo sincero, etc.

**Pergunta**: Na Delivery 1, o dashboard mostra:
- (a) Apenas "Livre para usar" + lista de gastos recentes (mínimo)
- (b) Tudo que o design mostra, mas com dados zerados/placeholder onde não houver engine
- (c) Algo intermediário — quais cards aparecem na D1?

### 16.2 Scenario Planner na Delivery 1
**Pergunta**: O Scenario Planner está na Delivery 3 (Forecasting). Mas a aba "Planejar" no bottom nav já existe na D1. O que ela mostra antes do planner existir? Estado vazio com "em breve"? Ou nem aparece?

---

*Responda tudo de uma vez. Se alguma pergunta for irrelevante ou "óbvia demais", escreva "já definido" ou "óbvio". Se a resposta depender de algo que ainda não decidimos, escreva "decidir na fase X".*
