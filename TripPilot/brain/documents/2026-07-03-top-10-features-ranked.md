# Top 10 features que os usuários realmente querem — ranking do conselho

> **Data**: 2026-07-03 · **Pedido**: Julio — "pensar em mais 10 features importantes que os usuários gostariam… pensar com o conselho e colocar em um documento, e rankear de acordo com os melhores reais para os users, os reais diferenciais e porquê. Não ficar focado em privacidade!!!"
>
> _Conselho rodado inline nesta sessão (1 request, sem subagents). Modo: brainstorm. Perspectivas: Visionary, Analyst, Connector, Simplifier._
>
> **Verificação de fatos**: afirmações competitivas checadas em 2026-07-03 contra travel-spend.com, App Store/Play Store (TravelSpend 2.8.0), comparativos Splitwise vs Tricount 2026 (usefairsplit.com, partly-app.com). Cada claim carrega o nível de confiança da regra `fact-verification.mdc`.

---

## Decision Brief (neutro)

O TripPilot hoje: PWA local-first de orçamento de viagem com previsão por ocasiões, modo saída, simulador, divisão em grupo estilo Tricount com link público, links curtos com preview (2.4.0-rc), multi-moeda automática, importação Wise CSV, IA de entrada (texto/voz/recibo), mapa de gastos, cofrinho, insights. Sem contas/login; 1 dono por viagem + espelhos read-only por mailbox.

Pergunta: **quais 10 features novas dariam mais valor real aos usuários**, rankeadas por valor + diferencial?

Fatos verificados relevantes:
- TravelSpend (líder da categoria): sync em tempo real multi-aparelho e viagem compartilhada com amigos/família é a feature de capa; tem mapa, multi-moeda, split básico, CSV premium. **VERIFIED** (travel-spend.com, 2026-07-03).
- Splitwise free: ~3-5 lançamentos/dia com anúncios; multi-moeda e OCR são pagos ($40-50/ano). **VERIFIED** (usefairsplit.com/partly-app.com, 2026-07-03).
- Tricount: grátis ilimitado, mas splits ponderados ("adulto paga inteiro, criança metade") são fracos/básicos. **VERIFIED** (tetras-ltd.com comparativo, 2026-07-03).
- Nenhum dos três tem: previsão por ocasiões, modo saída com teto, "posso gastar?", IA de voz. **HIGH CONFIDENCE** (feature lists oficiais não mencionam; não exaustivo).

Viés da conversa a resistir: a sessão vinha de trabalho em privacidade/criptografia — o Julio pediu explicitamente para NÃO puxar features de privacidade. Nenhuma entrou.

---

## Perspectivas (cada uma escrita às cegas a partir do Brief)

### Visionary — o que faria alguém trocar de app amanhã
Pensando sem restrição: o TripPilot já ganha de qualquer concorrente em *inteligência* (ocasiões, saída, simulador), mas perde em *convivência* — viagem é uma experiência social e o app ainda é de UMA pessoa. O 10x está em três movimentos: (1) **viagem verdadeiramente compartilhada** — casal/grupo lançando no mesmo orçamento, cada um do seu aparelho, offline, com merge automático; é a feature de capa do líder da categoria e o TripPilot tem a infra (mailbox, DOs, CRDT-ish revisions) para fazer melhor: com *orçamento inteligente* compartilhado, não só uma lista de gastos. (2) **A viagem como memória** — o dado financeiro é um diário involuntário: cada gasto tem lugar, hora, foto; um "diário da viagem" (timeline por dia com fotos + mapa + export bonito) transforma planilha em lembrança e é o gancho de compartilhamento orgânico que nenhum concorrente de orçamento tem. (3) **O app que responde "isso é caro?"** — benchmark de preços por cidade ("café em Lisboa ≈ €1,20") viraria o simulador de "posso?" em "devo?". Trabalhando de volta ao alcançável: (1) e (2) são evoluções diretas da infra existente; (3) começa com dataset estático embarcado.
**Rec:** viagem compartilhada real é o salto de categoria. · **Confiança:** HIGH · **Os outros vão esquecer:** o diário/memória — todo mundo ranqueia utilidade e esquece que viagem termina e a pessoa quer LEVAR algo.

### Analyst — o que a evidência diz que os usuários pedem
Dos comparativos 2026 e das reviews dos líderes: (a) a razão nº 1 de escolha do TravelSpend é **sync + viagem compartilhada** (feature de capa, VERIFIED); (b) a reclamação nº 1 do Splitwise é o **cap do free tier**, e a fraqueza documentada do Tricount é **split ponderado** (adulto/criança, casal 2×) — VERIFIED; (c) o review do Finny aponta **fricção de captura** ("several taps") como downside do TravelSpend, e IA de captura como diferencial emergente — o TripPilot já tem voz/IA, mas não tem o caso "estou no caixa, sem tempo": **foto agora, gasto depois**; (d) recorrências (hostel por noite, eSIM semanal, seguro) são paywall no Splitwise e inexistentes no TravelSpend fora do "spread over days" — gasto recorrente é dor real de viagem longa; (e) importação bancária: Wise só; Revolut/N26 são os cartões de viagem dominantes na Europa — cada importador novo é valor direto. Ranqueando por (frequência de uso × dor × prova de demanda): compartilhada > captura sem fricção > recorrências > splits ponderados > importadores.
**Rec:** priorizar o que os usuários já provaram pagar/reclamar: shared trip, captura, recorrências. · **Confiança:** HIGH · **Os outros vão esquecer:** recorrências — invisível em demo, enorme em viagem de 30+ dias.

### Connector — o que outras categorias ensinam
Analogias que destravam: (1) **Strava** — ninguém posta a planilha do treino, posta o CARD do treino; o TripPilot já gera cards de share e Wrapped; o próximo passo é o **"acompanhe a viagem"**: um link vivo read-only (a infra de link curto + preview JÁ existe) que a mãe/parceiro abre e vê "dia 5, tudo bem, €38 hoje" — transforma quem ficou em casa em audiência, e cada viagem em marketing orgânico. (2) **Google Photos** — captura sem decisão ("joga tudo, organiza depois") é o padrão vencedor de apps de momento; a "pilha de captura" (foto do recibo → inbox → vira gasto depois, com o OCR que já existe) copia esse padrão para dinheiro. (3) **Duolingo/widgets** — o dado que importa (livre hoje) tem que estar na home screen, não atrás de 2 taps; com o APK Capacitor, um widget Android é viável e nenhum PWA concorrente consegue. (4) **Airbnb "total price"** — o modo pré-viagem (reservas pagas meses antes, separadas do orçamento diário) resolve a mentira do "orçamento da viagem" que só começa no dia 1.
**Rec:** "acompanhe a viagem" é a feature com melhor razão valor/custo — reusa tudo que existe. · **Confiança:** MED · **Os outros vão esquecer:** o widget — parece cosmético, mas glanceability é o que faz o app ser CONSULTADO antes de gastar, que é a promessa do produto.

### Simplifier — os 20% que entregam 80%
Cortando tudo que precisa de infra nova: (1) **Recorrências** — é um gerador de `PlannedOccurrence`/transações sobre o que já existe; 3 telas pequenas, valor gigante em viagem longa. (2) **Split ponderado** — o motor de split já aceita custom por valor; pesos são UMA função de domínio + UI de frações; mata a fraqueza documentada do Tricount. (3) **Pilha de captura** — attachment + OCR já existem; é um estado "rascunho" novo + uma tela de inbox. (4) **Importadores CSV** — o pipeline Wise já parseia/deduplica/geocodifica; cada banco novo é um adapter de colunas. (5) **Widget** — leitura de um número que o domínio já calcula. O que EU cortaria: benchmark de preços (dataset caro de manter, valor incerto — LOW CONFIDENCE de adoção) e qualquer coisa de gamificação (contra o tom "amigo sincero" do produto). A viagem compartilhada real é a maior, mas é a ÚNICA que mexe em modelo de dados profundo — fazer por último ou fatiar (começar com "casal: 2 aparelhos, 1 orçamento, merge por mailbox" antes de grupo N).
**Rec:** shippar 4 baratas (recorrências, pesos, pilha, importadores) antes da grande. · **Confiança:** HIGH · **Os outros vão esquecer:** que "compartilhada" dá para FATIAR — casal primeiro (2 aparelhos já funciona no sync atual), grupo depois.

---

## Red Team — matando a líder (viagem compartilhada em tempo real)

O caso mais forte CONTRA fazer a viagem compartilhada agora: (1) é a única feature da lista que exige repensar o modelo de dono único — merge de escrita concorrente offline em orçamento (não só em lista de gastos) não tem prior art bom; TravelSpend faz sync de LISTA, não de envelope/reserva/cofrinho — a complexidade não é comparável; (2) o custo de oportunidade são ~4-6 features médias; (3) o usuário real do TripPilot hoje (Julio + círculo) já resolve 80% do caso com divisão em grupo + espelhos + debt_move — a dor restante é do CASAL, não do grupo; (4) risco de corromper a confiança nos números (a marca do produto é "números que batem") se o merge errar. Mitigação honesta: fatiar como o Simplifier propôs — "modo casal" com 2 aparelhos e verba compartilhada única, merge por mailbox com carimbo de origem, ANTES de qualquer coisa N-way. Se a fatia casal travar, a lista inteira acima dela continua de pé.

---

## Síntese (Chair) — o ranking

**Critérios**: valor real (frequência × dor) 40% · diferencial competitivo 25% · alinhamento com a promessa "copiloto que responde antes de você gastar" 20% · custo/risco na stack atual 15%.

| # | Feature | Por que ganha | Diferencial | Custo |
|---|---------|---------------|-------------|-------|
| 1 | **Modo casal/grupo: um orçamento, vários aparelhos** — lançamentos de 2+ aparelhos no MESMO orçamento inteligente, offline-first, merge automático com origem carimbada | Feature de capa do líder da categoria (VERIFIED); a dor nº 1 de quem viaja acompanhado; o TripPilot faria a versão INTELIGENTE (orçamento/ocasiões compartilhados, não só lista) | Único com orçamento inteligente compartilhado — **HIGH CONFIDENCE** | ALTO — fatiar: casal (2 aparelhos) primeiro |
| 2 | **Recorrências de viagem** — hostel por noite, eSIM semanal, seguro, assinaturas; gera os lançamentos sozinho e aparece no planejamento | Dor real de viagem 15+ dias; paywall no Splitwise (VERIFIED), ausente no TravelSpend; barato sobre `PlannedOccurrence` | Recorrência COM impacto no livre-por-dia — **MED** | BAIXO |
| 3 | **Pilha de captura: foto agora, gasto depois** — botão "fotografar recibo" que só guarda; inbox de rascunhos vira gasto com 1 toque (OCR existente preenche) | Mata a fricção do caixa/pressa (downside documentado dos concorrentes); zero decisão no momento; usa OCR/attachments existentes | Captura-sem-decisão em app de orçamento — **MED** | BAIXO |
| 4 | **Split ponderado no grupo** — pesos por pessoa (adulto 1×, criança 0,5×, casal 2×), frações e "X não participa desta" | Fraqueza documentada do Tricount (VERIFIED); pedido clássico de viagem em família; motor de split já suporta a matemática | Melhor split ponderado da categoria grátis — **MED** | BAIXO |
| 5 | **Widget Android "Livre hoje"** (+ quick tile de registrar) | A promessa do produto é ser consultado ANTES do gasto; widget é glanceability real; viável no APK Capacitor (sideload já existe) | PWA/APK de orçamento de viagem com widget — **MED** (Splitwise tem widget, mas de dívidas, não de ritmo diário) | MÉDIO |
| 6 | **"Acompanhe a viagem" — link vivo para quem ficou** — página read-only auto-atualizada (dia, total, livre hoje, últimos lugares), reusa link curto + preview + R2 | Vira cada viagem em audiência (padrão Strava); custo mínimo (infra 100% existente pós-DEC-455/457); gancho orgânico de aquisição | Nenhum concorrente de orçamento tem "seguir a viagem" — **MED** (não exaustivo) | BAIXO |
| 7 | **Modo pré-viagem** — reservas pagas meses antes (voo, hotel, festival) num balde próprio, fora do orçamento diário, com visão "custo total da viagem" | Toda viagem começa antes do dia 1; hoje o dinheiro pré-viagem distorce ou fica de fora; TravelSpend trata mal (spread manual) | "Custo total honesto" (pré + durante) — **MED** | MÉDIO |
| 8 | **Importadores de extrato: Revolut + N26 + Nubank** — mesmos dedupe/geocode/venue do Wise | Revolut/N26 dominam cartão de viagem na Europa; cada adapter é barato e recorrente em valor; import é o caminho anti-fricção para dias inteiros | Import multi-banco SEM conta/API (CSV local) — **MED** | BAIXO por banco |
| 9 | **Diário da viagem** — timeline por dia (gastos + fotos + lugares no mapa) com export bonito (HTML/PDF) e cards por dia | Transforma dado em memória; extensão natural do report HTML + Wrapped; é o que a pessoa MOSTRA depois | Orçamento que vira diário — **MED** | MÉDIO |
| 10 | **"Isso é caro aqui?" — benchmark por cidade** — faixa típica de café/cerveja/refeição/táxi da cidade no simulador e no detalhe do gasto (dataset estático embarcado, sem rede) | Responde a pergunta que todo viajante faz; profundiza o simulador; começa pequeno (20 cidades, 8 itens) | Simulador com contexto local — **HIGH** se bem feito | MÉDIO (curadoria do dataset) |

- **Consenso**: as 4 baratas (2, 3, 4, 8) entregam valor imediato sem risco; a compartilhada (1) é o salto de categoria e deve ser fatiada começando pelo casal; memória/social (6, 9) é o vetor de crescimento orgânico que a categoria ignora.
- **Tensões**: Visionary quer a #1 primeiro (salto de categoria); Simplifier quer as baratas primeiro (4 ships enquanto a #1 ainda estaria em design); Analyst fica com o Simplifier pelo custo de oportunidade; Connector defende a #6 como melhor ROI absoluto.
- **Recomendação**: ordem de execução ≠ ranking de valor: **shippar 2→3→4→6→8 (baratas, ~2-3 levas) enquanto a #1 é especificada com council próprio de modelo de dados**, e então atacar a #1 fatiada (casal primeiro). A lente que mais pesa aqui é a do **Analyst** (evidência de demanda) temperada pelo **Simplifier** (custo real na stack) — porque o produto já É diferenciado em inteligência; o gap é de conveniência comprovada, não de visão.
- **Condições**: #1 exige council de merge/conflito antes de qualquer código; #5 depende do pipeline APK atual (sem Play Store); #10 só entra se houver fonte de dados sustentável.
- **O que viraria o jogo**: se o uso real mostrar 2+ pessoas por viagem na maioria dos casos (hoje é 1 dono + espelhos), a #1 pula para execução imediata — cenário onde a minoria (Visionary) vence. Se o WhatsApp share dos links atuais gerar aquisição mensurável, a #6 sobe para o topo do próximo ciclo.
- **Confiança geral**: HIGH no top-5 (demanda verificada ou custo trivial); MED do 6 ao 10 (valor plausível, evidência indireta).

---

## Fora da lista (e porquê)

- **Gamificação/streaks** — contra o tom "amigo sincero, não coach de vendinha" (state dictionary DEC-304); o pacote Motivação (metas, cofrinho) já cobre o saudável.
- **Integração bancária por API** — fora de escopo declarado (V1 NOT in scope; CSV cobre 80% sem custo de compliance).
- **Features de privacidade** — excluídas por instrução direta do Julio neste pedido.
- **Push remoto com app fechado** — bloqueado pela postura sideload-first (sem FCM); reavaliar se houver Play Store.
