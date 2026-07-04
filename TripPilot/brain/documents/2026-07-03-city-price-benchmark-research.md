# Pesquisa — Benchmark de preços por cidade ("Isso é caro aqui?")

> **Data**: 2026-07-03 · **Autor**: sessão de implementação (wave 2.5.0-rc)
> **Pergunta do Julio**: de onde viriam os dados de "quanto custa um café/cerveja/refeição/táxi em cada cidade"? *"A função tem que funcionar, não só existir. Se não for preciso ou não der para fazer certo, melhor nem fazer."*
> **Veredito**: **NÃO embarcar dataset externo agora** (nenhuma fonte gratuita, licenciada e confiável em nível de cidade existe). O caminho viável — se a feature avançar — é a variante **local-first**: benchmarks dos PRÓPRIOS gastos do usuário + cidades/preços adicionados manualmente (exatamente o fallback que o Julio sugeriu). Registrado como **DEC-461 (PROPOSED)**.

---

## 1. O que a feature precisa

Faixa típica de ~6–8 itens (café, cerveja, refeição média, táxi/km, água, ticket de transporte) por cidade, com estas propriedades:

1. **Precisão razoável** — errar o preço do café em 2× mata a confiança no app inteiro.
2. **Licença limpa** — o TripPilot é um produto (mesmo em beta); "peguei da internet" não serve.
3. **Offline-first** — dataset estático embarcado (o simulador funciona sem rede).
4. **Cobertura útil** — as ~20 cidades do V1 são europeias (caso de uso real do Julio).
5. **Manutenção viável** — preços mudam; um dataset morto de 2024 é pior que nenhum.

## 2. Fontes investigadas (verificação: 2026-07-03)

### 2.1 Numbeo — a referência do mercado, mas paga
- **O que é**: a maior base crowdsourced de custo de vida; ~60 itens por cidade, milhares de cidades, atualização contínua.
- **Custo**: API a partir de **USD 260/mês** (200k queries) — verificado em `numbeo.com/common/api.jsp`.
- **Licença**: uso gratuito só para fins **pessoais, acadêmicos e jornalísticos**; uso comercial/aplicação exige assinatura (Advantage USD 260/mês ou Premier USD 560/mês) — verificado em `numbeo.com/premium/commercial-license` e nos Terms of Use.
- **Scraping**: viola os termos; além de frágil (a estrutura muda).
- **Confiança**: **VERIFIED** (fonte oficial, 2026-07-03).
- **Conclusão**: fora do orçamento do projeto (custo fixo mensal maior que toda a infra atual, que é ~USD 0).

### 2.2 Teleport API — morta
- Era a alternativa gratuita clássica (dados urbanos + custo de vida). **Foi descontinuada** (aquisição pela Topia; projetos no GitHub que dependiam dela estão arquivados com aviso "the Teleport API has been retired").
- **Confiança**: **VERIFIED** (github.com/Rolv-Apneseth/ua-explorer README + topia.com/topia-and-teleport, 2026-07-03).

### 2.3 Expatistan — sem API oficial
- Crowdsourced, boa cobertura de cidades. **Não publica API pública oficial** — o que existe são scrapers de terceiros (Apify, parse.bot) em zona legal cinzenta, contornando Cloudflare.
- **Confiança**: **VERIFIED** (o próprio marketplace parse.bot declara "Expatistan does not publish a documented public developer API", 2026-07-03).
- **Conclusão**: construir feature de produto sobre scraper de terceiro = frágil + juridicamente arriscado. Descartado.

### 2.4 Open Prices (Open Food Facts) — licença ótima, dado errado
- **O que é**: projeto irmão do Open Food Facts; preços de PRODUTOS (código de barras) reportados pela comunidade, com localização OSM (cidade). Licença **ODbL** (uso livre com atribuição + share-alike). Dump Parquet diário.
- **Problema**: é preço de **produto de mercado** (ex.: leite X no supermercado Y), não "cerveja no bar / refeição em restaurante / táxi". Cobertura fortemente concentrada na França/Europa ocidental e esparsa por cidade. Não responde a pergunta do viajante.
- **Confiança**: **VERIFIED** (data.gouv.fr/datasets/open-prices, 2026-07-03).

### 2.5 GCCP (coffeeconsumerprice.com) — só café
- API gratuita sem chave, 150 cidades, preços de café/cappuccino/latte em USD, atualizada. Exige atribuição.
- **Problema**: cobre SÓ café; o site é pequeno e recente (longevidade incerta — risco de virar outra Teleport).
- **Confiança**: dados **VERIFIED** (api-docs oficial, 2026-07-03); confiabilidade/longevidade **LOW CONFIDENCE**.

### 2.6 Outras descartadas rápido
- **MarketPulse** (menus de restaurantes): só metrôs dos **EUA** — não serve para o caso de uso europeu. VERIFIED.
- **Big Mac Index / World Bank ICP / OECD / Eurostat**: nível de **país**, não cidade; itens não batem com a cesta do viajante. MEDIUM CONFIDENCE (conhecimento consolidado; não re-verificado em detalhe hoje).
- **Nomad List**: pago, dados fechados, scraping proibido. MEDIUM CONFIDENCE.

## 3. Quick council (inline, Architect + Critic)

_Rodado inline nesta sessão (1 request, sem subagents)._

**Decision Brief (neutro)**: precisamos de faixas de preço por cidade para ~8 itens, offline, licença limpa, custo ~zero, precisão que não destrua confiança. Fontes externas viáveis: nenhuma gratuita; Numbeo USD 260+/mês; scrapers violam ToS; GCCP cobre 1 item. Alternativa: dados do próprio usuário + entrada manual. Viés a resistir: o entusiasmo da lista top-10 ("HIGH se bem feito") empurra para "fazer de qualquer jeito".

**Architect** — O app já captura, por gasto: valor, categoria, subcategoria (`bar_drink` etc.), lugar e cidade (geocode DEC-367). Um benchmark **dos seus próprios gastos** ("seu café médio em Burgos: €1,80 · 12 registros") é uma agregação pura sobre dados que JÁ existem, 100% offline, sempre "correto" por construção (são os preços que a pessoa pagou). Entrada manual de cidade/preço é um CRUD pequeno. Zero dependência externa, zero licença, zero manutenção de dataset. Esforço: pequeno-médio. **Rec:** variante local-first; nunca embarcar dataset de terceiros sem licença. **Confidence:** HIGH. **Others miss:** o simulador (DEC-283/tools) já tem onde ancorar essa UI — não nasce tela nova do zero.

**Critic** — O risco central não é técnico, é de **promessa**: "isso é caro aqui?" implica autoridade estatística que dados pessoais não têm (n=3 cafés não é benchmark, é anedota). Se a UI disser "preço típico da cidade" com base em 3 registros do próprio usuário, é a MESMA mentira que a lente de números acabou de consertar. Também: usuário novo (0 gastos na cidade) vê tela vazia — a feature "não existe" exatamente quando mais prometia (antes da viagem). **Rec:** se fizer, rotular como "SEUS preços" (nunca "da cidade"), exigir n mínimo por item, e aceitar que o valor pré-viagem é ~zero. **Confidence:** MED. **Others miss:** o custo de NÃO fazer é zero — nenhum concorrente gratuito entrega isso bem (Numbeo cobra pelos dados), então não há gap competitivo urgente.

**Red team (matar a opção líder)**: "não fazer nada" pode estar descartando a única feature da lista com wow-factor pré-viagem; e a variante local poderia começar a acumular dados HOJE (cada gasto do Julio já alimenta o benchmark futuro) — adiar custa dados. Resposta: o acúmulo já acontece de graça (os gastos são registrados de toda forma); nada é perdido por decidir depois.

**Síntese (Chair)**:
- **Consenso**: dataset externo embarcado está morto — sem fonte gratuita licenciada confiável (fato verificado, não opinião).
- **Tensão**: Architect vê feature pequena e honesta; Critic vê promessa que dados pessoais não sustentam pré-viagem.
- **Recomendação**: **não implementar agora** (o critério do Julio — "se não der para fazer certo, melhor nem fazer" — é atendido pela evidência). Se/quando avançar: variante local-first ("seus preços por cidade" + cidades manuais), rotulada com honestidade estatística, ancorada no simulador. A lente que pesa mais aqui é a do **Critic**: precisão/honestidade é o requisito explícito do dono do produto.
- **O que viraria o jogo**: (a) Numbeo lançar tier gratuito/barato para apps pequenos; (b) uma fonte aberta ODbL de preços de serviços urbanos surgir com cobertura europeia; (c) o TripPilot ter base de usuários suficiente para benchmark comunitário próprio (aí o dado é NOSSO — cenário onde a minoria vence e a feature vira diferencial real).

## 4. DEC-461 (PROPOSED) — resumo

- **Decisão proposta**: NÃO embarcar benchmark de preços com dados externos. Feature adiada; se retomada, será a variante local-first (benchmarks dos próprios gastos + entrada manual), com rótulo honesto e n mínimo.
- **Racional**: nenhuma fonte externa passa nos 5 requisitos do §1 (Numbeo = USD 260+/mês; Teleport = morta; Expatistan = sem API; Open Prices = dado errado; GCCP = 1 item). O critério de corte foi dado pelo próprio Julio.
- **Custo de reverter**: zero — nada foi construído; os dados que alimentariam a variante local já são capturados hoje.
